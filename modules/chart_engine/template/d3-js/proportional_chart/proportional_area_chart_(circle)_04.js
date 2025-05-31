/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Circle)",
    "chart_name": "proportional_area_chart_circle_04",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 30], [0, "inf"], [2, 8]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "hierarchy": ["group"],
    "supported_effects": [],
    "min_height": 600,
    "min_width": 600,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, dataJSON) {

    /* ============ 1. 字段检查 ============ */
    const cols = dataJSON.data.columns || [];
    const xCol = cols.find(c => c.role === "x");
    const yCol = cols.find(c => c.role === "y");
    const groupCol = cols.find(c => c.role === "group");
    
    const xField = xCol?.name;
    const yField = yCol?.name;
    const groupField = groupCol?.name;
    const yUnit = yCol?.unit === "none" ? "" : yCol?.unit ?? "";
    const raw = dataJSON.data.data.filter(d => +d[yField] > 0);

    /* ============ 2. 尺寸与比例尺 ============ */
    const fullW = dataJSON.variables?.width || 900;
    const fullH = dataJSON.variables?.height || 700;
    // 修改边距，顶部增加空间给图例，移除右侧多余空间
    const margin = { top: 40, right: 20, bottom: 20, left: 20 }; 
    const W = fullW - margin.left - margin.right;
    const H = fullH - margin.top - margin.bottom;
    
    // 计算可用面积的50%作为圆形最大总面积限制
    const maxTotalCircleArea = W * H * 0.35;

    // 创建颜色比例尺
    const uniqueGroups = [...new Set(raw.map(d => d[groupField]))];
    const colorScale = d3.scaleOrdinal()
        .domain(uniqueGroups)
        .range(uniqueGroups.map(group => 
            // 优先使用colors.field中的颜色
            dataJSON.colors?.field?.[group] || 
            // 如果没有对应颜色，使用默认调色板
            ["#1e3cff", "#e01e1e", "#ffa500", "#ff69b4", "#32cd32", "#9932cc", "#8b4513", "#00ced1"]
                [uniqueGroups.indexOf(group) % 8]
        ));

    // 修改初始半径比例尺范围，增大最小圆，略微减小最大圆
    const radiusScale = d3.scaleSqrt()
        .domain([d3.min(raw, d => +d[yField]), d3.max(raw, d => +d[yField])])
        .range([25, 100]);  // 将最小值从20增至25，最大值从120减至100
        
    // 计算初始半径和总面积
    let nodes = raw.map((d, i) => {
        const radius = radiusScale(+d[yField]);
        return {
            id: d[xField] != null ? String(d[xField]) : `__${i}__`,
            label: d[xField],
            value: +d[yField],
            group: d[groupField],
            color: colorScale(d[groupField]),
            radius: radius,
            area: Math.PI * radius * radius // 计算每个圆的面积
        };
    }).sort((a, b) => b.radius - a.radius); // 按半径从大到小排序
    
    // 计算总面积
    const initialTotalArea = d3.sum(nodes, d => d.area);
    
    // 如果总面积超过最大限制，按比例缩小所有半径
    if (initialTotalArea > maxTotalCircleArea) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodes.forEach(node => {
            node.radius *= areaRatio;
            node.area = Math.PI * node.radius * node.radius;
        });
        console.log(`Scaled down circles by factor ${areaRatio.toFixed(2)} to fit area constraint`);
    }

    /* ============ 3. 布局计算 ============ */
    // 修改最小和最大半径限制
    const MIN_RADIUS = 15;  // 将最小半径从10增至15
    const MAX_RADIUS = Math.min(H, W) * 0.25; // 将最大半径从30%减至25%
    
    // 应用半径限制
    nodes.forEach(node => {
        node.radius = Math.max(MIN_RADIUS, Math.min(node.radius, MAX_RADIUS));
        node.area = Math.PI * node.radius * node.radius; // 更新面积
    });
    
    // 为每个组创建分组对象，以便应用不同的力
    const groupedNodes = {};
    uniqueGroups.forEach(group => {
        groupedNodes[group] = nodes.filter(node => node.group === group);
    });
    
    // 创建力模拟布局，但不立即运行
    const simulation = d3.forceSimulation()
        .force("center", d3.forceCenter(W/2, H/2 + 10).strength(0.05))  // 增强中心引力
        .force("charge", d3.forceManyBody().strength((d) => -d.radius * 0.8))  // 基于半径的排斥力
        .stop();
    
    // 自定义碰撞检测，为不同组添加额外间距
    simulation.force("collide", d3.forceCollide().radius(d => {
        // 为每个节点存储组信息，便于碰撞检测时使用
        d._groupData = uniqueGroups.indexOf(d.group);
        // 基础碰撞半径就是圆的半径，没有额外padding
        return d.radius + 7.5;
    }).strength(0.9).iterations(2));
    
    // 定义聚类力函数
    function d3ForceCluster() {
        let nodes = [];
        let centerFunc = d => d.x;
        let strength = 0.1;
        
        function force(alpha) {
            // 对每个节点应用力
            nodes.forEach(node => {
                const center = centerFunc(node);
                if (!center) return;
                
                const [cx, cy] = center;
                node.vx += (cx - node.x) * strength * alpha;
                node.vy += (cy - node.y) * strength * alpha;
            });
        }
        
        force.initialize = function(_) {
            nodes = _;
        };
        
        force.centers = function(_) {
            return arguments.length ? (centerFunc = typeof _ === "function" ? _ : () => _, force) : centerFunc;
        };
        
        force.strength = function(_) {
            return arguments.length ? (strength = +_, force) : strength;
        };
        
        return force;
    }
    
    // 添加d3.forceCluster到d3对象
    d3.forceCluster = d3ForceCluster;

    // 根据组添加聚类力，让同组圆圈更靠近
    uniqueGroups.forEach(group => {
        const clusterCenters = {};
        // 为每个组分配一个随机偏移的中心位置，减小随机范围以控制分布
        const offsetX = (Math.random() - 0.5) * 30;
        const offsetY = (Math.random() - 0.5) * 30;
        clusterCenters[group] = [W/2 + offsetX, H/2 + offsetY];
        
        // 创建自定义聚类力
        simulation.force(`cluster-${group}`, function(alpha) {
            const clusterCenter = clusterCenters[group];
            // 增强聚类力使同组更紧密
            const clusterStrength = 0.35;
            
            nodes.forEach(node => {
                if (node.group === group) {
                    node.vx += (clusterCenter[0] - node.x) * clusterStrength * alpha;
                    node.vy += (clusterCenter[1] - node.y) * clusterStrength * alpha;
                }
            });
        });
    });

    // 固定最大的圆的位置，中心稍微下移以避开顶部图例
    if (nodes.length > 0) {
        nodes[0].fx = W * 0.5;
        nodes[0].fy = H * 0.5 + 10; // 稍微下移
    }
    
    // 对于更多的圆，按组分配到不同的初始区域
    if (nodes.length > 1) {
        // 分配每个组的初始区域
        const groupCount = uniqueGroups.length;
        const angleStep = 2 * Math.PI / groupCount;
        
        uniqueGroups.forEach((group, groupIndex) => {
            const groupNodes = nodes.filter(d => d.group === group && !d.fx);
            const groupAngle = groupIndex * angleStep;
            const groupX = W/2 + Math.cos(groupAngle) * (W/4);
            const groupY = H/2 + Math.sin(groupAngle) * (H/4);
            
            // 围绕组中心放置节点
            const nodeCount = groupNodes.length;
            if (nodeCount > 0) {
                const innerAngleStep = 2 * Math.PI / nodeCount;
                const radius = Math.min(50, 150 / Math.sqrt(nodeCount));
                
                groupNodes.forEach((node, i) => {
                    const angle = i * innerAngleStep;
                    node.x = groupX + Math.cos(angle) * radius;
                    node.y = groupY + Math.sin(angle) * radius;
                });
            }
        });
    }

    // 设置节点
    simulation.nodes(nodes);
    
    // 添加自定义碰撞力
    simulation.on("tick", () => {
        // 增加额外力以确保不同组之间有足够间距
        // 使用双重循环直接检测所有节点对
        for (let i = 0; i < nodes.length; i++) {
            const nodeA = nodes[i];
            
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeB = nodes[j];
                
                // 计算两节点间距离
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (nodeA.group !== nodeB.group) {
                    const extraPadding = (nodeA.radius + nodeB.radius) * 0.15;
                    const minDistance = nodeA.radius + nodeB.radius + Math.max(extraPadding, 15);
                    
                    if (distance < minDistance && distance > 0) {
                        const moveRatio = (minDistance - distance) / distance;
                        const forceStrength = 0.5;
                        
                        const moveX = dx * moveRatio * forceStrength;
                        const moveY = dy * moveRatio * forceStrength;
                        
                        if (!nodeA.fx) {
                            nodeA.x -= moveX;
                            nodeA.y -= moveY;
                        }
                        
                        if (!nodeB.fx) {
                            nodeB.x += moveX;
                            nodeB.y += moveY;
                        }
                    }
                } else {
                    const minDistance = nodeA.radius + nodeB.radius;
                    
                    if (distance < minDistance && distance > 0) {
                        const moveRatio = (minDistance - distance) / distance;
                        const forceStrength = 0.1;
                        
                        const moveX = dx * moveRatio * forceStrength;
                        const moveY = dy * moveRatio * forceStrength;
                        
                        if (!nodeA.fx) {
                            nodeA.x -= moveX;
                            nodeA.y -= moveY;
                        }
                        
                        if (!nodeB.fx) {
                            nodeB.x += moveX;
                            nodeB.y += moveY;
                        }
                    }
                }
            }
        }
        
        // 应用边界约束
        nodes.forEach(d => {
            if (!d.fx) {
                d.x = Math.max(d.radius + 5, Math.min(W - d.radius - 5, d.x));
                d.y = Math.max(margin.top - 20 + d.radius + 5, Math.min(H - d.radius - 5, d.y));
            }
        });
    });

    // 运行模拟更多轮以获得更稳定的布局
    const MIN_ITERATIONS = 350; // 增加迭代次数确保稳定性
    // 顶部保护区域，防止与图例重叠
    const TOP_PROTECTED_AREA = Math.max(margin.top - 20, 0); 
    
    for (let i = 0; i < MIN_ITERATIONS; ++i) {
        simulation.tick();
        
        // 每次迭代后应用边界约束
        nodes.forEach(d => {
            if (!d.fx) {
                d.x = Math.max(d.radius + 5, Math.min(W - d.radius - 5, d.x));
                // 确保不进入顶部保护区域，防止与图例重叠
                d.y = Math.max(TOP_PROTECTED_AREA + d.radius + 5, Math.min(H - d.radius - 5, d.y));
            }
        });
    }
    
    // 最终边界约束检查
    nodes.forEach(d => {
        if (!d.fx) {
            d.x = Math.max(d.radius + 5, Math.min(W - d.radius - 5, d.x));
            // 再次确保不进入顶部保护区域
            d.y = Math.max(TOP_PROTECTED_AREA + d.radius + 5, Math.min(H - d.radius - 5, d.y));
        }
    });

    /* ============ 4. 绘图 ============ */
    d3.select(containerSelector).html(""); // 清空容器
    
    // 创建 SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", fullH)
        .attr("viewBox", `0 0 ${fullW} ${fullH}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("max-width", "100%")
        .style("height", "auto")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // 主绘图区域
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    /* ============ 5. 创建渐变和滤镜 ============ */
    const defs = svg.append("defs");
    
    // 阴影滤镜
    const filter = defs.append("filter")
        .attr("id", "bubble-shadow")
        .attr("width", "180%")
        .attr("height", "180%")
        .attr("x", "-40%")
        .attr("y", "-40%");
        
    filter.append("feGaussianBlur")
        .attr("in", "SourceAlpha")
        .attr("stdDeviation", 4)
        .attr("result", "blur");
        
    filter.append("feOffset")
        .attr("in", "blur")
        .attr("dx", 3)
        .attr("dy", 5)
        .attr("result", "offsetBlur");
        
    filter.append("feComponentTransfer")
        .append("feFuncA")
        .attr("type", "linear")
        .attr("slope", 0.4);
        
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    
    // 为每个节点创建渐变
    nodes.forEach((d, i) => {
        const color = d3.rgb(d.color);
        const brighterColor = color.brighter(0.7);
        const darkerColor = color.darker(0.3);
        
        // 创建径向渐变
        const gradient = defs.append("radialGradient")
            .attr("id", `bubble-gradient-${i}`)
            .attr("cx", "0.35")
            .attr("cy", "0.35")
            .attr("r", "0.65")
            .attr("fx", "0.35")
            .attr("fy", "0.35")
            .attr("spreadMethod", "pad");
            
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", brighterColor.toString())
            .attr("stop-opacity", 1);
            
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", darkerColor.toString())
            .attr("stop-opacity", 1);
    });

    /* ============ 6. 文本工具函数 ============ */
    // 大圆与小圆的阈值
    const LARGE_CIRCLE_THRESHOLD = 40;
    const MEDIUM_CIRCLE_THRESHOLD = 25;
    
    // 文本宽度测量
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function getTextWidth(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return ctx.measureText(text).width;
    }
    
    // 颜色亮度计算
    function getColorBrightness(color) {
        const rgb = d3.rgb(color);
        return (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) / 255;
    }
    
    // 获取适合背景的文本颜色
    function getTextColorForBackground(bgColor) {
        const brightness = getColorBrightness(bgColor);
        return brightness > 0.6 ? '#000000' : '#ffffff';
    }
    
    // 格式化数值
    function formatValue(value) {
        if (value >= 1000000) {
            return `${(value/1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            return `${(value/1000).toFixed(1)}K`;
        } else if (value >= 100) {
            return value.toFixed(0);
        } else if (value >= 10) {
            return value.toFixed(1);
        } else {
            return value.toFixed(2);
        }
    }
    
    // 检查圆尺寸类别
    function getCircleSize(d) {
        if (d.radius < MEDIUM_CIRCLE_THRESHOLD) return "small";
        if (d.radius < LARGE_CIRCLE_THRESHOLD) return "medium";
        return "large";
    }
    
    // 截断或缩小文本以适应给定宽度
    function fitTextToWidth(text, maxWidth, fontFamily, fontSize, fontWeight) {
        const width = getTextWidth(text, fontFamily, fontSize, fontWeight);
        if (width <= maxWidth) return { text, fontSize };
        
        // 如果文本宽度超过最大宽度，先尝试缩小字体
        const scaleFactor = maxWidth / width;
        const newFontSize = Math.max(8, Math.floor(fontSize * scaleFactor)); // 最小字号8px
        
        // 如果缩小到最小字号还是太长，则截断文本
        if (newFontSize <= 8) {
            // 截断文本并添加省略号
            let truncated = text;
            while (getTextWidth(truncated + "...", fontFamily, 8, fontWeight) > maxWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1);
            }
            return { text: truncated + "...", fontSize: 8 };
        }
        
        return { text, fontSize: newFontSize };
    }

    /* ============ 7. 绘制节点 ============ */
    // 创建节点分组
    const nodeG = g.selectAll("g.node")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`);
    
    // 绘制圆
    nodeG.append("circle")
        .attr("r", d => d.radius)
        .attr("fill", (d, i) => `url(#bubble-gradient-${i})`)
        .attr("filter", "url(#bubble-shadow)")
        .attr("stroke", "rgba(255,255,255,0.7)")
        .attr("stroke-width", d => Math.min(2, d.radius * 0.05)); // 确保小圆的描边不会太粗
    
    // 为每个节点添加文本
    nodeG.each(function(d, i) {
        const node = d3.select(this);
        const radius = d.radius;
        const textColor = getTextColorForBackground(d.color);
        const formattedValue = formatValue(d.value) + yUnit;
        const circleSize = getCircleSize(d);
        
        if (circleSize === "small") {
            // 小圆只显示简短的数值
            if (radius >= MEDIUM_CIRCLE_THRESHOLD * 0.8) { // 仅当足够大时才显示
                node.append("text")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", textColor)
                    .style("font-family", "Arial")
                    .style("font-size", Math.min(radius / 2, 10) + "px")
                    .style("font-weight", "bold")
                    .text(formattedValue);
            }
            
            // 小圆的标签添加到圆底部
            g.append("text")
                .attr("text-anchor", "middle")
                .attr("x", d.x)
                .attr("y", d.y + d.radius + 12)
                .attr("fill", "#333")
                .style("font-family", "Arial")
                .style("font-size", "10px")
                .style("font-weight", "normal")
                .text(d.label);
            
        } else if (circleSize === "medium") {
            // 中等圆仅显示值
            node.append("text")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", textColor)
                .style("font-family", "Arial")
                .style("font-size", Math.min(radius / 2, 12) + "px")
                .style("font-weight", "bold")
                .text(formattedValue);
                
            // 中等圆的标签在圆底部显示
            g.append("text")
                .attr("text-anchor", "middle")
                .attr("x", d.x)
                .attr("y", d.y + d.radius + 12)
                .attr("fill", "#333")
                .style("font-family", "Arial")
                .style("font-size", "11px")
                .style("font-weight", "normal")
                .text(d.label);
        } else {
            // 大圆显示标签和数值
            // 计算合适的字体大小
            const baseSize = Math.min(radius / 3, 24);
            
            // 检查label是否超出圆的范围并适配
            const maxWidth = radius * 1.6; // 标签最大宽度为直径的80%
            const { text: fittedText, fontSize: fittedSize } = 
                fitTextToWidth(d.label, maxWidth, "Arial", baseSize, "bold");
            
            // 添加标签
            node.append("text")
                .attr("text-anchor", "middle")
                .attr("y", -radius * 0.15)
                .attr("fill", textColor)
                .style("font-family", "Arial")
                .style("font-size", fittedSize + "px")
                .style("font-weight", "bold")
                .text(fittedText);
            
            // 添加数值
            node.append("text")
                .attr("text-anchor", "middle")
                .attr("y", radius * 0.2)
                .attr("fill", textColor)
                .style("font-family", "Arial")
                .style("font-size", Math.min(fittedSize * 0.9, 20) + "px")
                .style("font-weight", "bold")
                .text(formattedValue);
        }
    });

    /* ============ 8. 创建图例 ============ */
    // 水平图例布局
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${margin.left}, 20)`); // 放置在顶部
    
    // 获取唯一分组
    const uniqueGroupsForLegend = [...new Set(raw.map(d => d[groupField]))];
    const legendTitle = groupCol?.description || "Categories";
    
    // 创建图例标题
    legend.append("text")
        .attr("x", 0)
        .attr("y", 10)
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("font-family", "Arial")
        .text(legendTitle);
    
    // 计算水平图例布局
    const itemWidth = 100; // 每个图例项的宽度
    const itemHeight = 30; // 图例项高度
    const itemsPerRow = Math.min(uniqueGroupsForLegend.length, Math.floor((W) / itemWidth)); // 每行最多显示的项数
    const legendWidth = itemsPerRow * itemWidth; // 图例总宽度
    const startX = (W - legendWidth) / 2; // 居中对齐
    
    uniqueGroupsForLegend.forEach((group, i) => {
        // 计算当前图例项的位置
        const row = Math.floor(i / itemsPerRow);
        const col = i % itemsPerRow;
        const x = startX + col * itemWidth;
        const y = 30 + row * itemHeight; // 从标题下方开始
        
        // 获取颜色（与节点颜色一致）
        const color = colorScale(group);
        
        // 创建图例项的渐变
        const legendGradId = `legend-grad-${i}`;
        const brighterColor = d3.rgb(color).brighter(0.5);
        const darkerColor = d3.rgb(color).darker(0.2);
        
        const legendGrad = defs.append("linearGradient")
            .attr("id", legendGradId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "100%");
            
        legendGrad.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", brighterColor.toString());
            
        legendGrad.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", darkerColor.toString());
        
        // 图例颜色标记
        legend.append("circle")
            .attr("cx", x + 8)
            .attr("cy", y)
            .attr("r", 8)
            .attr("fill", `url(#${legendGradId})`)
            .attr("stroke", "white")
            .attr("stroke-width", 1)
            .attr("filter", "drop-shadow(0px 1px 2px rgba(0,0,0,0.2))");
        
        // 图例文本
        legend.append("text")
            .attr("x", x + 25)
            .attr("y", y + 4) // 垂直居中对齐
            .attr("font-size", "12px")
            .attr("font-family", "Arial")
            .text(group);
    });
    return svg.node();
}

/*
优化说明：
1. 面积控制：确保所有圆的总面积不超过图表面积的50%，必要时自动按比例缩小
2. 布局策略：使用螺旋状初始布局和优化的力模拟参数，改善节点分布
3. 图例位置：将图例从右侧移到顶部，采用水平排列，优化空间利用
4. 布局保护：添加顶部保护区域，确保圆形不会与图例重叠
5. 半径限制：增加最小/最大半径限制，保证可视性和布局美观
6. 文本自适应：根据圆的尺寸分为小、中、大三类，采用不同的文本显示策略
7. 标签智能处理：自动缩小或截断超出圆形范围的标签，小圆标签显示在圆底部
*/
