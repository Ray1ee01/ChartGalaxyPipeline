/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Circle)",
    "chart_name": "proportional_area_chart_circle_10",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 30], [0, "inf"], [2, 8]],
    "required_fields_icons": ["x"],
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
    const images = dataJSON.images;

    /* ============ 2. 基础设置 ============ */
    const fullW = dataJSON.variables?.width || 900;
    const fullH = dataJSON.variables?.height || 700;

    // 先计算图例行数来确定顶部边距
    const uniqueGroups = [...new Set(raw.map(d => d[groupField]))];

    // 根据标签长度自适应计算图例项宽度
    function calculateItemWidth(group) {
        // 使用简单估算，每个字符大约8px
        return 8 + 6 + (group.length * 8) + 20;
    }

    // 计算每个图例项的宽度并确定图例行数
    const itemWidths = uniqueGroups.map(calculateItemWidth);
    const itemHeight = 24; // 图例项高度
    let currentRowWidth = 0;
    let rowCount = 1;
    let itemsInCurrentRow = 0;
    const maxRowWidth = fullW - 80; // 留有边距

    // 计算图例行数
    uniqueGroups.forEach((group, i) => {
        if (currentRowWidth + itemWidths[i] > maxRowWidth && itemsInCurrentRow > 0) {
            // 需要换行
            rowCount++;
            currentRowWidth = itemWidths[i];
            itemsInCurrentRow = 1;
        } else {
            currentRowWidth += itemWidths[i];
            itemsInCurrentRow++;
        }
    });

    // 修改边距，顶部增加空间适应图例的行数
    const additionalTopMargin = Math.max(0, (rowCount - 1) * itemHeight);
    const margin = { 
        top: 40 + additionalTopMargin, 
        right: 20, 
        bottom: 20, 
        left: 20 
    }; 
    const W = fullW - margin.left - margin.right;
    const H = fullH - margin.top - margin.bottom;

    // 计算圆形面积总限制
    const maxTotalCircleArea = W * H * 0.35;

    /* ============ 3. 数据处理和比例尺 ============ */
    // 创建颜色比例尺
    const colorScale = d3.scaleOrdinal()
        .domain(uniqueGroups)
        .range(uniqueGroups.map(group => 
            // 优先使用colors.field中的颜色
            dataJSON.colors?.field?.[group] || 
            // 如果没有对应颜色，使用默认调色板
            ["#1e3cff", "#e01e1e", "#ffa500", "#ff69b4", "#32cd32", "#9932cc", "#8b4513", "#00ced1"]
                [uniqueGroups.indexOf(group) % 8]
        ));

    // 半径比例尺
    const radiusScale = d3.scaleSqrt()
        .domain([d3.min(raw, d => +d[yField]), d3.max(raw, d => +d[yField])])
        .range([25, 100]);
        
    // 计算节点数据
    let nodes = raw.map((d, i) => {
        const radius = radiusScale(+d[yField]);
        return {
            id: d[xField] != null ? String(d[xField]) : `__${i}__`,
            label: d[xField],
            value: +d[yField],
            group: d[groupField],
            color: colorScale(d[groupField]),
            radius: radius,
            area: Math.PI * radius * radius,
            icon: images?.field?.[d[xField]] || null
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
    }

    /* ============ 4. 布局计算 ============ */
    // 半径限制
    const MIN_RADIUS = 15;
    const MAX_RADIUS = Math.min(H, W) * 0.25;
    
    // 应用半径限制
    nodes.forEach(node => {
        node.radius = Math.max(MIN_RADIUS, Math.min(node.radius, MAX_RADIUS));
        node.area = Math.PI * node.radius * node.radius; // 更新面积
    });
    
    // 为环形布局计算虚拟中心圆半径
    const centralCircleRadius = Math.min(W, H) * 0.25; // 虚拟中心圆半径
    
    // 为每个组创建分组对象
    const groupedNodes = {};
    uniqueGroups.forEach(group => {
        groupedNodes[group] = nodes.filter(node => node.group === group);
    });
    
    // 创建力模拟布局
    const simulation = d3.forceSimulation()
        .force("center", d3.forceCenter(W/2, H/2 + 10).strength(0.05))
        .force("charge", d3.forceManyBody().strength((d) => -d.radius * 0.8))
        .stop();
    
    // 碰撞检测设置
    simulation.force("collide", d3.forceCollide().radius(d => {
        d._groupData = uniqueGroups.indexOf(d.group);
        return d.radius + 7.5;
    }).strength(0.9).iterations(2));
    
    // 创建组间碰撞力 - 让不同组的圆能够更好地分离
    simulation.force("group-collide", function(alpha) {
        const quadtree = d3.quadtree()
            .x(d => d.x)
            .y(d => d.y)
            .addAll(nodes);
            
        nodes.forEach(node => {
            const nodeGroup = node._groupData;
            const r = node.radius;
            const nx1 = node.x - r;
            const nx2 = node.x + r;
            const ny1 = node.y - r;
            const ny2 = node.y + r;
            
            // 查找周围的节点并应用组间斥力
            quadtree.visit((quad, x1, y1, x2, y2) => {
                if (!quad.length) {
                    do {
                        const otherNode = quad.data;
                        if (otherNode && otherNode !== node) {
                            const otherGroup = otherNode._groupData;
                            // 如果是不同组，增加斥力
                            if (nodeGroup !== otherGroup) {
                                const x = node.x - otherNode.x;
                                const y = node.y - otherNode.y;
                                const l = Math.sqrt(x * x + y * y);
                                const r = node.radius + otherNode.radius + 15; // 额外15像素间距
                                
                                if (l < r) {
                                    const f = Math.min(0.1, (l - r) / l) * alpha;
                                    node.vx -= x * f;
                                    node.vy -= y * f;
                                }
                            }
                        }
                    } while (quad = quad.next);
                }
                return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
            });
        });
    });
    
    // 设置组中心位置 - 基于环形布局
    const groupCenters = {};
    
    // 计算各组在环形上的位置
    if (uniqueGroups.length > 0) {
        const angleStep = (2 * Math.PI) / uniqueGroups.length;
        
        uniqueGroups.forEach((group, i) => {
            const angle = i * angleStep;
            const distance = centralCircleRadius * 0.8; // 各组中心距离中心点的距离
            const centerX = W/2 + distance * Math.cos(angle);
            const centerY = H/2 + distance * Math.sin(angle);
            groupCenters[group] = [centerX, centerY];
            
            // 为每个组添加聚类力
            simulation.force(`cluster-${group}`, function(alpha) {
                nodes.forEach(node => {
                    if (node.group === group) {
                        node.vx += (centerX - node.x) * 0.2 * alpha;
                        node.vy += (centerY - node.y) * 0.2 * alpha;
                    }
                });
            });
        });
    }
    
    // 设置初始节点位置
    if (nodes.length > 0) {
        // 按组和大小围绕虚拟中心圆排列
        const groupCounts = {};
        uniqueGroups.forEach(group => {
            groupCounts[group] = nodes.filter(d => d.group === group).length;
        });
        
        nodes.forEach((node, i) => {
            const groupIndex = uniqueGroups.indexOf(node.group);
            const nodesInGroup = groupCounts[node.group];
            const angle = (2 * Math.PI) / uniqueGroups.length * groupIndex;
            
            // 计算该组内的位置
            const groupNodes = nodes.filter(d => d.group === node.group);
            const inGroupIndex = groupNodes.indexOf(node);
            const inGroupAngle = angle + (Math.PI / (nodesInGroup + 1)) * (inGroupIndex + 1) * 0.5;
            
            // 距离中心的距离
            const distance = centralCircleRadius + node.radius * 1.5;
            
            // 设置初始位置
            node.x = W/2 + distance * Math.cos(inGroupAngle);
            node.y = H/2 + distance * Math.sin(inGroupAngle);
            
            // 固定较大的圆
            if (inGroupIndex < nodesInGroup / 3) {
                node.fx = node.x;
                node.fy = node.y;
            }
        });
    }
    
    // 设置节点并运行模拟
    simulation.nodes(nodes);

    // 运行模拟迭代
    const MIN_ITERATIONS = 200;
    const TOP_PROTECTED_AREA = Math.max(margin.top - 20, 0);
    
    for (let i = 0; i < MIN_ITERATIONS; ++i) {
        simulation.tick();
        
        // 每次迭代应用环形力和边界约束
        nodes.forEach(d => {
            if (!d.fx) {
                // 环形力
                const dx = d.x - W/2;
                const dy = d.y - H/2;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const targetDistance = centralCircleRadius + d.radius * 1.2;
                const factor = 0.08;
                
                if (Math.abs(distance - targetDistance) > d.radius * 0.3) {
                    const angle = Math.atan2(dy, dx);
                    d.x = W/2 + (distance * (1 - factor) + targetDistance * factor) * Math.cos(angle);
                    d.y = H/2 + (distance * (1 - factor) + targetDistance * factor) * Math.sin(angle);
                }
                
                // 边界约束
                d.x = Math.max(d.radius + 5, Math.min(W - d.radius - 5, d.x));
                d.y = Math.max(TOP_PROTECTED_AREA + d.radius, Math.min(H - d.radius - 5, d.y));
            }
        });
    }

    /* ============ 5. 绘图 ============ */
    d3.select(containerSelector).html(""); // 清空容器
    
    // 创建SVG
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

    // 创建滤镜
    const defs = svg.append("defs");
    const dropShadow = defs.append("filter")
        .attr("id", "drop-shadow")
        .attr("width", "130%")
        .attr("height", "130%");
        
    dropShadow.append("feGaussianBlur")
        .attr("in", "SourceAlpha")
        .attr("stdDeviation", 3)
        .attr("result", "blur");
        
    dropShadow.append("feOffset")
        .attr("in", "blur")
        .attr("dx", 3)
        .attr("dy", 3)
        .attr("result", "offsetBlur");
        
    const feComponentTransfer = dropShadow.append("feComponentTransfer")
        .attr("in", "offsetBlur")
        .attr("result", "offsetBlur");
        
    feComponentTransfer.append("feFuncA")
        .attr("type", "linear")
        .attr("slope", 0.3);
        
    const feMerge = dropShadow.append("feMerge");
    feMerge.append("feMergeNode")
        .attr("in", "offsetBlur");
    feMerge.append("feMergeNode")
        .attr("in", "SourceGraphic");

    // 主绘图区域
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // 创建图例
    const legendG = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${margin.left}, 15)`);
    
    // 绘制图例
    let legendX = 0;
    let legendY = 0;
    const legendSpacing = 10;
    
    uniqueGroups.forEach((group, i) => {
        // 计算当前项宽度
        const itemWidth = itemWidths[i];
        
        // 检查是否需要换行
        if (legendX + itemWidth > maxRowWidth) {
            legendX = 0;
            legendY += itemHeight;
        }
        
        // 创建图例项
        const legendItem = legendG.append("g")
            .attr("transform", `translate(${legendX}, ${legendY})`);
        
        // 颜色矩形
        legendItem.append("rect")
            .attr("width", 16)
            .attr("height", 16)
            .attr("fill", colorScale(group));
        
        // 文本
        legendItem.append("text")
            .attr("x", 20)
            .attr("y", 8)
            .attr("dominant-baseline", "central")
            .style("font-size", "12px")
            .text(group);
        
        legendX += itemWidth + legendSpacing;
    });
    
    // 创建节点
    const bubbles = g.selectAll(".node")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`);
    
    // 绘制圆形
    bubbles.append("circle")
        .attr("r", d => d.radius)
        .attr("fill", d => d.color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .style("filter", d => d.radius > 20 ? "url(#drop-shadow)" : null);

    /* ============ 6. 辅助函数 ============ */
    // 文本宽度计算
    function getTextWidth(text, fontFamily, fontSize, fontWeight) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return context.measureText(text).width;
    }
    
    // 颜色亮度计算
    function getColorBrightness(color) {
        if (!color || !color.startsWith('#')) return 0.5;
        
        const hex = color.slice(1);
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        
        return 0.299 * r + 0.587 * g + 0.114 * b; // 感知亮度公式
    }
    
    // 文本颜色选择
    function getTextColorForBackground(bgColor) {
        return getColorBrightness(bgColor) > 0.6 ? '#000000' : '#ffffff';
    }
    
    // 数值格式化
    function formatValue(value) {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + "M" + yUnit;
        } else if (value >= 1000) {
            return (value / 1000).toFixed(1) + "k" + yUnit;
        } else {
            return value.toString() + yUnit;
        }
    }
    
    // 文本截断
    function fitTextToWidth(text, maxWidth, fontFamily, fontSize, fontWeight) {
        if (!text) return "";
        
        const textWidth = getTextWidth(text, fontFamily, fontSize, fontWeight);
        if (textWidth <= maxWidth) return text;
        
        const ellipsis = "...";
        const ellipsisWidth = getTextWidth(ellipsis, fontFamily, fontSize, fontWeight);
        
        if (maxWidth <= ellipsisWidth) return "";
        
        const availableWidth = maxWidth - ellipsisWidth;
        let truncatedText = text;
        
        while (getTextWidth(truncatedText, fontFamily, fontSize, fontWeight) > availableWidth && truncatedText.length > 0) {
            truncatedText = truncatedText.slice(0, -1);
        }
        
        return truncatedText + ellipsis;
    }

    // 图标大小计算
    function getIconSize(radius) {
        if (radius < 20) return 0;
        if (radius < 30) return 16;
        if (radius < 40) return 24;
        if (radius < 60) return 32;
        return 40;
    }

    // 添加图标和文本
    bubbles.each(function(d) {
        const node = d3.select(this);
        const textColor = getTextColorForBackground(d.color);
        const fontFamily = "Arial, sans-serif";
        
        // 添加图标
        if (d.icon && d.radius >= 20) {
            const iconSize = getIconSize(d.radius);
            node.append("image")
                .attr("xlink:href", d.icon)
                .attr("x", -iconSize / 2)
                .attr("y", -iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
        
        // 添加值标签
        if (d.radius >= 25) {
            const fontSize = Math.max(10, Math.min(d.radius / 5, 16));
            const yPos = d.icon ? d.radius / 2 - fontSize : 0;
            
            node.append("text")
                .attr("class", "value")
                .attr("text-anchor", "middle")
                .attr("y", yPos)
                .attr("fill", textColor)
                .style("font-family", fontFamily)
                .style("font-size", `${fontSize}px`)
                .style("font-weight", "bold")
                .text(formatValue(d.value));
        }
        
        // 添加类别标签
        if (d.radius >= 35 && d.label) {
            const fontSize = Math.max(8, Math.min(d.radius / 6, 14));
            const maxWidth = d.radius * 1.5;
            const truncatedText = fitTextToWidth(d.label, maxWidth, fontFamily, fontSize, "normal");
            const yPos = d.icon ? d.radius / 2 + 5 : fontSize * 1.5;
            
            node.append("text")
                .attr("class", "label")
                .attr("text-anchor", "middle")
                .attr("y", yPos)
                .attr("fill", textColor)
                .style("font-family", fontFamily)
                .style("font-size", `${fontSize}px`)
                .text(truncatedText);
        }
    });

    return svg.node();
} 