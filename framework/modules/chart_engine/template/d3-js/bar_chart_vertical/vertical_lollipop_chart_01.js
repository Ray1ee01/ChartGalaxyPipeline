/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Lollipop Chart",
    "chart_name": "vertical_lollipop_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 12], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "overlay",
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
        top: 40,      // 顶部边距
        right: 60,    // 右侧留出数值标签空间
        bottom: 90,   // 底部留出维度标签空间
        left: 60      // 左侧留出描述文本空间
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
    
    // 创建X轴比例尺（用于维度）
    const xScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerWidth])  // 使用固定的innerWidth
        .padding(0.2); // 增加padding以确保有足够空间
    
    // 根据比例尺的bandwidth计算列宽和间距
    const columnWidth = xScale.bandwidth();  // 列宽直接由比例尺决定
    const barWidth = Math.max(columnWidth * 0.6, 15); // 条形宽度为列宽的60%，但至少15px
    
    // 圆形图标的半径 - 与列宽成比例
    const iconRadius = barWidth / 2;
    const iconPadding = iconRadius / 4;
    
    // Y轴比例尺（用于数值）
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueField]) * 1.1]) // 添加10%边距
        .range([innerHeight - (iconRadius * 2 + iconPadding * 4), 0]); // 减去图标和边距空间
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 创建网格线组
    const gridGroup = g.append("g")
        .attr("class", "grid-lines");
        
    // 添加水平网格线
    const gridValues = yScale.ticks(5); // 约 5 条水平网格线
    
    gridValues.forEach(value => {
        gridGroup.append("line")
            .attr("x1", 0)
            .attr("y1", yScale(value))
            .attr("x2", innerWidth)
            .attr("y2", yScale(value))
            .attr("stroke", "#e0e0e0")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3"); // 虚线样式
    });
    
    // 创建并添加左侧值轴
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickSize(0)  // 不显示刻度线
        .tickPadding(8)
        .tickFormat(d => d);
    
    const yAxisGroup = g.append("g")
        .attr("class", "y-axis")
        .call(yAxis);
    
    // 隐藏轴线
    yAxisGroup.select(".domain").attr("stroke", "none");
    
    yAxisGroup.selectAll(".tick text")
        .style("font-family", typography.annotation.font_family)
        .style("font-size", "12px")
        .style("fill", colors.text_color);
    
    // ---------- 11. 为每个维度绘制条形和标签 ----------
    
    // 获取主题色
    const primaryColor = colors.other && colors.other.primary ? colors.other.primary : "#F7941D";
    
    sortedData.forEach((d, i) => {
        const dimension = d[dimensionField];
        const value = +d[valueField];
        
        const x = xScale(dimension);
        const barHeight = innerHeight - yScale(value);
        
        // 1. 绘制垂直线
        g.append("line")
            .attr("x1", x + columnWidth / 2)
            .attr("y1", innerHeight)
            .attr("x2", x + columnWidth / 2)
            .attr("y2", yScale(value))
            .attr("stroke", primaryColor)
            .attr("stroke-width", barWidth / 4)  // 使用一半的条形宽度作为线宽
            .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
        
        // Define circle position
        const circleX = x + columnWidth / 2;
        const circleY = yScale(value);
        
        // 3. 添加类别标题（在底部）
        g.append("text")
            .attr("x", x + columnWidth / 2)
            .attr("y", innerHeight + 20)
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(dimension);
        
        // 4. 添加图标圆圈（在线的顶部）
        g.append("circle")
            .attr("cx", circleX)
            .attr("cy", circleY)
            .attr("r", iconRadius)
            .attr("fill", primaryColor)
            .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
        
        // 添加图标（如果有）
        if (images.field && images.field[dimension]) {
            const iconSize = iconRadius * 1.5;
            
            g.append("image")
                .attr("x", circleX - iconSize / 2)
                .attr("y", circleY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio","xMidYMid meet")
                .attr("xlink:href", images.field[dimension]);
        }
        
        // 5. 添加数值标签（在圆圈上方）
        const formattedValue = valueUnit ? 
            `${value}${valueUnit}` : 
            `${value}`;
            
        g.append("text")
            .attr("x", circleX)
            .attr("y", circleY - iconRadius - iconPadding)
            .attr("text-anchor", "middle")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", `${Math.min(20, Math.max(barWidth * 0.5, parseFloat(typography.annotation.font_size)))}px`)
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