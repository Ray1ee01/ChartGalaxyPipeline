/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Dot Bar Chart",
    "chart_name": "vertical_dot_bar_plain_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["gradient"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// vertical_dot_bar垂直点状条形图plain_chart_01实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // 数据准备
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333",
        other: { primary: "#4A90E2" }
    };  
    const dataColumns = jsonData.data.columns || [];
    
    // 数值格式化函数
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    // 计算适合的字体大小
    const calculateFontSize = (text, maxWidth, baseFontSize) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let fontSize = baseFontSize;
        
        do {
            ctx.font = `${typography.label.font_weight} ${fontSize}px ${typography.label.font_family}`;
            if (ctx.measureText(text).width <= maxWidth) break;
            fontSize -= 0.5;
        } while (fontSize > 8);
        
        return fontSize;
    };
    
    // 文本自动换行函数 - 支持底部对齐
    const wrapText = (textElement, str, maxWidth) => {
        const words = str.split(/\s+/).reverse();
        const lines = [];
        let currentLine = [];
        let word;
        
        textElement.text(null);
        
        if (words.length > 1) {
            while (word = words.pop()) {
                currentLine.push(word);
                const testTspan = textElement.append("tspan").text(currentLine.join(" "));
                if (testTspan.node().getComputedTextLength() > maxWidth && currentLine.length > 1) {
                    testTspan.remove();
                    currentLine.pop();
                    lines.push(currentLine.join(" "));
                    currentLine = [word];
                } else {
                    testTspan.remove();
                }
            }
            if (currentLine.length > 0) lines.push(currentLine.join(" "));
        } else {
            lines.push(str);
        }
        
        // 底部对齐：最后一行在原始Y位置
        const lineHeight = 1.1;
        const startDy = -(lines.length - 1) * lineHeight;
        
        lines.forEach((line, i) => {
            textElement.append("tspan")
                .attr("x", textElement.attr("x"))
                .attr("dy", (i === 0 ? startDy : lineHeight) + "em")
                .text(line);
        });
    };
    
    d3.select(containerSelector).html("");
    
    // 尺寸设置
    const width = variables.width || 800;
    const height = variables.height || 600;
    const margin = { top: 80, right: 30, bottom: 40, left: 30 };
    
    // 提取字段信息
    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "dimension";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "value";
    
    let valueUnit = "";
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y")?.unit || "";
    }
    
    // 数据处理
    const maxValue_ = d3.max(chartData, d => Math.abs(+d[valueField]));
    chartData.forEach(d => {
        d[`${valueField}_`] = d[valueField];
    });
    if (maxValue_ > 100) {
        chartData.forEach(d => {
            d[`${valueField}_`] = Math.max(1, Math.floor(+d[valueField] / maxValue_ * 50));
        });
    }
    
    // 按数值降序排序
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);
    
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;");
    
    const defs = svg.append("defs");
    const primaryColor = colors.other.primary || "#4A90E2";
    
    // 创建渐变定义
    const maxGroups = 10;
    for (let group = 0; group < maxGroups; group++) {
        const gradient = defs.append("linearGradient")
            .attr("id", `bar-gradient-${group}`)
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "0%").attr("y2", "100%");
        
        const groupDarkenFactor = 0.15 * group;
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(primaryColor).brighter(0.8 - groupDarkenFactor));
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(primaryColor).darker(0.2 + groupDarkenFactor));
    }
    
    // 创建比例尺
    const xScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerWidth])
        .padding(0.2);
    
    const maxValue = d3.max(chartData, d => +d[`${valueField}_`]);
    
    // 计算条形尺寸
    const availableHeight = innerHeight - 60; // 预留标签和数值空间
    const defaultBarHeight = 8;
    const defaultBarSpacing = 3;
    const groupSpacing = 12;
    const groupSize = 10;
    
    const groupBaseHeight = groupSize * defaultBarHeight + (groupSize - 1) * defaultBarSpacing;
    const requiredGroups = Math.ceil(maxValue / groupSize);
    const requiredHeight = requiredGroups * groupBaseHeight + (requiredGroups - 1) * groupSpacing;
    
    let barHeight, barSpacing;
    if (requiredHeight > availableHeight) {
        const scaleFactor = availableHeight / requiredHeight;
        barHeight = Math.max(3, Math.floor(defaultBarHeight * scaleFactor));
        barSpacing = Math.max(1, Math.floor(defaultBarSpacing * scaleFactor));
    } else {
        barHeight = defaultBarHeight;
        barSpacing = defaultBarSpacing;
    }
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 预计算统一字体大小
    const baseFontSize = parseInt(typography.label.font_size) || 12;
    const longestDimension = sortedDimensions.reduce((a, b) => 
        a.toString().length > b.toString().length ? a : b, "").toString();
    const maxLabelWidth = xScale.bandwidth() * 0.8;
    const uniformFontSize = calculateFontSize(longestDimension, maxLabelWidth, baseFontSize);
    
    // 绘制图表元素
    sortedDimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const columnWidth = xScale.bandwidth();
            const barWidth = columnWidth * 0.7;
            const barX = xScale(dimension) + (columnWidth - barWidth) / 2;
            const barCount = Math.round(dataPoint[`${valueField}_`]);
            
            // 维度标签（优先使用统一字体，必要时换行）
            const labelText = g.append("text")
                .attr("class", "label")
                .attr("x", xScale(dimension) + columnWidth / 2)
                .attr("y", 0)
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${uniformFontSize}px`)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(dimension);
            
            // 检查是否需要换行
            if (labelText.node().getComputedTextLength() > maxLabelWidth) {
                wrapText(labelText, dimension, maxLabelWidth);
            }
            
            // 绘制条形（从顶部向下）
            for (let i = 0; i < barCount; i++) {
                const groupIndex = Math.floor(i / groupSize);
                const inGroupIndex = i % groupSize;
                
                // 从顶部开始计算Y位置
                const barY = 10 + (groupIndex * (groupSize * (barHeight + barSpacing) + groupSpacing)) + 
                           (inGroupIndex * (barHeight + barSpacing));
                
                const gradientId = `bar-gradient-${groupIndex}`;
                
                g.append("rect")
                    .attr("class", "mark")
                    .attr("x", barX)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("fill", `url(#${gradientId})`)
                    .attr("rx", barHeight / 2)
                    .attr("ry", barHeight / 2);
            }
            
            // 数值标签（在条形末端）
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            const lastGroupIndex = Math.floor((barCount - 1) / groupSize);
            const lastInGroupIndex = (barCount - 1) % groupSize;
            const lastBarY = 10 + (lastGroupIndex * (groupSize * (barHeight + barSpacing) + groupSpacing)) + 
                           (lastInGroupIndex * (barHeight + barSpacing));
            
            g.append("text")
                .attr("class", "value")
                .attr("x", xScale(dimension) + columnWidth / 2)
                .attr("y", lastBarY + barHeight + 15)
                .attr("text-anchor", "middle")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", "10px")
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(formattedValue);
        }
    });
    
    return svg.node();
}