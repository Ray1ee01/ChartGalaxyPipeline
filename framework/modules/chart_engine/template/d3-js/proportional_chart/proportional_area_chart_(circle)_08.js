/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Circle)",
    "chart_name": "proportional_area_chart_circle_08",
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

    // 初始半径比例尺 - 增大最大半径值以增加多样性
    const radiusScale = d3.scaleSqrt()
        .domain([d3.min(raw, d => +d[yField]), d3.max(raw, d => +d[yField])])
        .range([20, 150]); // 将最大半径从120增加到150
        
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
    // 设置最小和最大半径限制
    const MIN_RADIUS = 10;
    const MAX_RADIUS = Math.min(H, W) * 0.3; // 不超过较短边的30%
    
    // 应用半径限制
    nodes.forEach(node => {
        node.radius = Math.max(MIN_RADIUS, Math.min(node.radius, MAX_RADIUS));
        node.area = Math.PI * node.radius * node.radius; // 更新面积
    });
    
    // 创建防碰撞力模拟布局，但不立即运行
    const simulation = d3.forceSimulation()
        .force("center", d3.forceCenter(W/2, H/2 + 10).strength(0.03)) // 增强中心引力，稍微下移
        .force("charge", d3.forceManyBody().strength(-15)) // 减弱排斥力
        .force("collide", d3.forceCollide().radius(d => d.radius + 8).strength(0.95)) // 增强碰撞力
        .stop();

    // 计算虚拟中心圆的半径 - 基于可用空间和节点数量
    const centralCircleRadius = Math.min(W, H) * 0.25; // 虚拟中心圆半径，占绘图区较小边的25%
    
    // 设置初始位置 - 所有圆按大小围绕虚拟中心圆排列
    if (nodes.length > 0) {
        // 计算排列角度和间距
        const totalAngle = 2 * Math.PI; // 完整圆周
        const angleStep = totalAngle / nodes.length; // 每个节点的角度间隔
        
        // 按照顺序排列圆形（从最大到最小）
        for (let i = 0; i < nodes.length; i++) {
            const angle = i * angleStep; // 当前节点的角度
            const node = nodes[i];
            
            // 计算距离中心的距离（虚拟中心圆半径 + 当前节点半径 + 一些间距）
            const distance = centralCircleRadius + node.radius + 10;
            
            // 设置初始位置
            node.x = W/2 + distance * Math.cos(angle);
            node.y = H/2 + distance * Math.sin(angle);
            
            // 对较大的圆（前1/3的圆）应用固定位置以保持稳定的环形布局
            if (i < nodes.length / 3) {
                node.fx = node.x;
                node.fy = node.y;
            }
        }
    }

    // 设置节点
    simulation.nodes(nodes);

    // 运行模拟至少轮迭代(手动调用tick)
    const MIN_ITERATIONS = 150; // 增加到150轮以获得更稳定的布局
    // 顶部保护区域，防止与图例重叠
    const TOP_PROTECTED_AREA = Math.max(margin.top - 20, 0); // 保护区域高度
    
    for (let i = 0; i < MIN_ITERATIONS; ++i) {
        simulation.tick();
        
        // 每次迭代后应用边界约束和环形力
        nodes.forEach(d => {
            if (!d.fx) { // 如果节点没有被固定
                // 向中心的力 - 保持环形布局
                const dx = d.x - W/2;
                const dy = d.y - H/2;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const targetDistance = centralCircleRadius + d.radius + 10;
                const factor = 0.1; // 调整力度
                
                if (Math.abs(distance - targetDistance) > d.radius * 0.2) {
                    // 如果偏离目标距离，施加力将其拉回环形路径
                    const angle = Math.atan2(dy, dx);
                    d.x = W/2 + (distance * (1 - factor) + targetDistance * factor) * Math.cos(angle);
                    d.y = H/2 + (distance * (1 - factor) + targetDistance * factor) * Math.sin(angle);
                }
                
                // 水平边界约束
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
        .attr("id", "drop-shadow")
        .attr("height", "130%");
    
    filter.append("feGaussianBlur")
        .attr("in", "SourceAlpha")
        .attr("stdDeviation", 3)
        .attr("result", "blur");
    
    filter.append("feOffset")
        .attr("in", "blur")
        .attr("dx", 3)
        .attr("dy", 3)
        .attr("result", "offsetBlur");
    
    const feComponentTransfer = filter.append("feComponentTransfer")
        .attr("in", "offsetBlur")
        .attr("result", "offsetBlur");
    
    feComponentTransfer.append("feFuncA")
        .attr("type", "linear")
        .attr("slope", 0.3);
    
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode")
        .attr("in", "offsetBlur");
    feMerge.append("feMergeNode")
        .attr("in", "SourceGraphic");

    // 创建图例
    // 图例水平布局
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${fullW/2}, 20)`);
    
    const legendItems = uniqueGroups;
    const legendItemWidth = 80; // 每个图例项的宽度
    const legendItemHeight = 20; // 每个图例项的高度
    
    // 计算图例的总宽度以居中对齐
    const legendWidth = legendItems.length * legendItemWidth;
    const legendStartX = -legendWidth / 2;
    
    // 为每个组创建图例项
    legendItems.forEach((group, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(${legendStartX + i * legendItemWidth}, 0)`);
        
        // 添加颜色矩形
        legendItem.append("rect")
            .attr("width", 16)
            .attr("height", 16)
            .attr("fill", colorScale(group));
        
        // 添加文本标签
        legendItem.append("text")
            .attr("x", 20)
            .attr("y", 8)
            .attr("dy", ".35em")
            .style("font-size", "12px")
            .text(group);
    });

    // 创建气泡
    const circles = g.selectAll(".circle")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "circle")
        .attr("transform", d => `translate(${d.x}, ${d.y})`);
    
    // 绘制圆形
    circles.append("circle")
        .attr("r", d => d.radius)
        .attr("fill", d => d.color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .style("filter", "url(#drop-shadow)");

    /* ============ 6. 工具函数 ============ */
    // 文本宽度测量
    function getTextWidth(text, fontFamily, fontSize, fontWeight) {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        context.font = `${fontWeight || "normal"} ${fontSize}px ${fontFamily || "Arial"}`;
        return context.measureText(text).width;
    }
    
    // 颜色亮度计算
    function getColorBrightness(color) {
        color = color.replace("#", "");
        const r = parseInt(color.substr(0, 2), 16);
        const g = parseInt(color.substr(2, 2), 16);
        const b = parseInt(color.substr(4, 2), 16);
        return (r * 299 + g * 587 + b * 114) / 1000;
    }
    
    // 文本颜色选择
    function getTextColorForBackground(bgColor) {
        return getColorBrightness(bgColor) > 128 ? "#000000" : "#ffffff";
    }
    
    // 数值格式化
    function formatValue(value) {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + "M" + yUnit;
        } else if (value >= 1000) {
            return (value / 1000).toFixed(1) + "k" + yUnit;
        } else if (value % 1 !== 0) {
            return value.toFixed(1) + yUnit;
        } else {
            return value.toString() + yUnit;
        }
    }
    
    // 计算适合的文本大小
    function getCircleSize(d) {
        if (d.radius < 20) return 0; // 太小的圆不显示文本
        if (d.radius < 35) return 10;
        if (d.radius < 50) return 12;
        if (d.radius < 70) return 14;
        return 16;
    }
    
    // 文本截断
    function fitTextToWidth(text, maxWidth, fontFamily, fontSize, fontWeight) {
        if (getTextWidth(text, fontFamily, fontSize, fontWeight) <= maxWidth) {
            return text;
        }
        
        let ellipsis = "...";
        let ellipsisWidth = getTextWidth(ellipsis, fontFamily, fontSize, fontWeight);
        
        // 如果连省略号都放不下，返回空字符串
        if (maxWidth <= ellipsisWidth) {
            return "";
        }
        
        // 二分查找合适的长度
        let low = 0;
        let high = text.length;
        let best = 0;
        
        while (low <= high) {
            let mid = Math.floor((low + high) / 2);
            let testText = text.substr(0, mid);
            let testWidth = getTextWidth(testText + ellipsis, fontFamily, fontSize, fontWeight);
            
            if (testWidth <= maxWidth) {
                best = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        
        return text.substr(0, best) + ellipsis;
    }
    
    // 添加文本标签
    circles.each(function(d) {
        const fontSize = getCircleSize(d);
        if (fontSize === 0) return; // 跳过太小的圆
        
        const textColor = getTextColorForBackground(d.color);
        const fontFamily = "Arial, sans-serif";
        const g = d3.select(this);
        
        // 值标签
        g.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.1em")
            .attr("fill", textColor)
            .style("font-family", fontFamily)
            .style("font-size", `${fontSize}px`)
            .style("font-weight", "bold")
            .text(formatValue(d.value));
        
        // 如果圆足够大，添加类别标签
        if (d.radius >= 40 && d.label) {
            const maxTextWidth = d.radius * 1.5;
            const truncatedLabel = fitTextToWidth(d.label, maxTextWidth, fontFamily, fontSize - 2, "normal");
            
            g.append("text")
                .attr("text-anchor", "middle")
                .attr("dy", `${fontSize + 5}px`) // 放在值标签下方
                .attr("fill", textColor)
                .style("font-family", fontFamily)
                .style("font-size", `${fontSize - 2}px`)
                .text(truncatedLabel);
        }
    });

    return svg.node(); // 返回SVG节点
} 