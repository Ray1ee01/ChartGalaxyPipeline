/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Lollipop Chart",
    "chart_name": "horizontal_lollipop_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/


// 带图标的水平条形图实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                           // 完整的JSON数据对象
    const chartData = jsonData.data.data;            // 实际数据点数组  
    const variables = jsonData.variables || {};      // 图表配置
    const typography = jsonData.typography || {      // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "14px", font_weight: "bold" },
        description: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "16px", font_weight: "bold" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置
    const images = jsonData.images || { field: {}, other: {} };   // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    variables.has_gradient = variables.has_gradient || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距
    const margin = {
        top: 90,      // 顶部留出标题空间
        right: 40,   // 右侧留出垂直标题块空间
        bottom: 60,   // 底部边距
        left: 60     // 左侧留出描述文本空间
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "dimension";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "value";
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; 
    
    if (dataColumns.find(col => col.role === "x")?.unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x")?.unit;
    }
    
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y")?.unit;
    }
    
    
    // ---------- 4. 数据处理 ----------
    
    // 按数值降序排序数据
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);
    
    // ---------- 5. 计算布局参数 ----------
    
    // 创建临时SVG元素用于文本测量
    const tempSvgForWidth = d3.select(containerSelector)
        .append("svg")
        .attr("width", 1) // Minimal size
        .attr("height", 1)
        .style("position", "absolute") // Avoid affecting layout
        .style("visibility", "hidden"); // Keep it hidden
    
    // 辅助函数：估算文本宽度
    const estimateTextWidth = (text, fontConfig) => {
        const tempText = tempSvgForWidth.append("text")
            .style("font-family", fontConfig.font_family)
            .style("font-size", fontConfig.font_size)
            .style("font-weight", fontConfig.font_weight)
            .text(text);
        const width = tempText.node().getBBox().width;
        tempText.remove(); // 清理临时文本元素
        return width;
    };
    
    // 预计算所有维度标签的宽度
    const dimLabelWidths = {};
    sortedData.forEach(d => {
        const dimensionText = d[dimensionField];
        dimLabelWidths[dimensionText] = estimateTextWidth(dimensionText, typography.label);
    });
    
    // 计算最大数值标签宽度
    let maxValueWidth = 0;
    sortedData.forEach(d => {
        const formattedValue = valueUnit ? 
            `${d[valueField]}${valueUnit}` : 
            `${d[valueField]}`;
            
        const tempText = tempSvgForWidth.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .text(formattedValue);
        
        const textWidth = tempText.node().getBBox().width;
        maxValueWidth = Math.max(maxValueWidth, textWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvgForWidth.remove();
    
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 添加defs用于视觉效果
    const defs = svg.append("defs");
    
    // 添加阴影滤镜（如果启用）
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("width", "200%")
            .attr("height", "200%");
        
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 3);
        
        filter.append("feOffset")
            .attr("dx", 2)
            .attr("dy", 2)
            .attr("result", "offsetblur");
        
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // 添加渐变效果（如果启用）
    if (variables.has_gradient) {
        // 获取主题色
        const primaryColor = colors.other && colors.other.primary ? colors.other.primary : "#F7941D";
        
        const gradient = defs.append("linearGradient")
            .attr("id", "barGradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
            
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(primaryColor).brighter(0.2));
            
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", primaryColor);
    }
    
    
    
    // ---------- 8. 创建比例尺 ----------
    
    // 使用变量中定义的固定SVG尺寸
    // 不会调整SVG尺寸，而是让比例尺适应给定的空间
    
    // 创建Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])  // 使用固定的innerHeight
        .padding(0.2); // 增加padding以确保有足够空间
    
    // 根据比例尺的bandwidth计算行高和间距
    const rowHeight = yScale.bandwidth();  // 行高直接由比例尺决定
    const barHeight = Math.max(rowHeight * 0.6, 15); // 条形高度为行高的60%，但至少15px
    
    // 圆形图标的半径 - 与行高成比例
    const iconRadius = barHeight / 2;
    const iconPadding =  iconRadius / 4;
    
    // X轴比例尺（用于数值）
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueField]) * 1.1]) // 添加10%边距
        .range([0, innerWidth - (iconRadius * 2 + iconPadding * 4)]); // 减去图标和边距空间
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 创建网格线组 - 将其放在数据条前面这样它们会显示在后面
    const gridGroup = g.append("g")
        .attr("class", "grid-lines");
        
    // 添加垂直网格线
    const gridValues = xScale.ticks(5); // 约 5 条竖直网格线
    
    gridValues.forEach(value => {
        gridGroup.append("line")
            .attr("x1", xScale(value))
            .attr("y1", 0)
            .attr("x2", xScale(value))
            .attr("y2", innerHeight)
            .attr("stroke", "#e0e0e0")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3"); // 虚线样式
    });
    
    // 创建并添加底部值轴
    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickSize(0)  // 不显示刻度线
        .tickPadding(8)
        .tickFormat(d => d); // New format: only show the number
    
    const xAxisGroup = g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);
    
    // 隐藏轴线
    xAxisGroup.select(".domain").attr("stroke", "none");
    
    xAxisGroup.selectAll(".tick text")
        .style("font-family", typography.annotation.font_family)
        .style("font-size", "12px")
        .style("fill", colors.text_color);
    
    // ---------- 11. 为每个维度绘制条形和标签 ----------
    
    // 获取主题色
    const primaryColor = colors.other && colors.other.primary ? colors.other.primary : "#F7941D";
    
    // 获取描边颜色的辅助函数
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333";
    };
    
    sortedData.forEach((d, i) => {
        const dimension = d[dimensionField];
        
        const value = +d[valueField];
        
        const y = yScale(dimension);
        const barWidth = xScale(value);
        
        // 1. 绘制粗横线（替代原来的条形）
        g.append("line")
            .attr("x1", 0)
            .attr("y1", y + barHeight / 2)
            .attr("x2", barWidth)
            .attr("y2", y + barHeight / 2)
            .attr("stroke", primaryColor)
            .attr("stroke-width", barHeight / 4)  // 使用一半的条形高度作为线宽
            .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
        
        // Define circle position early for label calculation
        const circleX = barWidth;
        const circleY = y + barHeight / 2;
        
        // 3. 添加类别标题（在条形左侧上方 或 图标右侧）
        const dimLabelWidth = dimLabelWidths[dimension];
        const circleLeftEdge = circleX - iconRadius;
        const labelPadding = 5; // Define padding

        let labelX = 0; // Default position: left
        let labelAnchor = "start";

        // Check if label overlaps with the icon circle area
        if (dimLabelWidth > circleLeftEdge - labelPadding) {
            // If overlap, move label to the right of the circle
            labelX = circleX + iconRadius + labelPadding;
            // labelAnchor remains "start"
        }

        g.append("text")
            .attr("x", labelX) // Use calculated X position
            .attr("y", y)      // Keep Y position above the bar
            .attr("text-anchor", labelAnchor) // Use calculated anchor
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(dimension);
        
        // 4. 添加图标圆圈（在线的右端）
        // Use the already defined circleX, circleY
        
        // 绘制主色调圆圈
        g.append("circle")
            .attr("cx", circleX)
            .attr("cy", circleY)
            .attr("r", iconRadius)
            .attr("fill", primaryColor)  // 使用主题色填充圆圈
            .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
        
        // 添加图标（如果有）
        if (images.field && images.field[dimension]) {
            // 图标尺寸稍小于圆圈
            const iconSize = iconRadius * 1.5;
            
            g.append("image")
                .attr("x", circleX - iconSize / 2)
                .attr("y", circleY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio","xMidYMid meet")
                .attr("xlink:href", images.field[dimension]);
        }
        
        // 5. 添加数值标签（在圆圈右侧）
        const formattedValue = valueUnit ? 
            `${value}${valueUnit}` : 
            `${value}`;
            
        g.append("text")
            .attr("x", circleX + iconRadius + iconPadding * 2) // Use circleX here
            .attr("y", circleY) // Use circleY here
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", typography.annotation.font_family)
            .style("font-size",`${Math.min(20,Math.max(barHeight * 0.5, parseFloat(typography.annotation.font_size)))}px`)
            .style("font-weight", typography.annotation.font_weight)
            .style("fill", colors.text_color)
            .text(formattedValue);
    });
    
    // ---------- 12. 辅助函数 ----------
    
    // 文本换行函数
    function wrapText(text, width, lineHeight) {
        text.each(function() {
            const text = d3.select(this);
            const words = text.text().split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const y = text.attr("y");
            const dy = parseFloat(text.attr("dy") || 0);
            let tspan = text.text(null).append("tspan")
                .attr("x", 0)
                .attr("y", y)
                .attr("dy", dy + "em");
                
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > width) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = text.append("tspan")
                        .attr("x", 0)
                        .attr("y", y)
                        .attr("dy", ++lineNumber * lineHeight + dy + "em")
                        .text(word);
                }
            }
        });
    }
    
    // 返回SVG节点
    return svg.node();
}