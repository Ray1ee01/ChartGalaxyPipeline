/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Lollipop Chart",
    "chart_name": "lollipop_icon_chart_02",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 12], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": [],
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

// 垂直lollipop_icon_chart实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "14px", font_weight: "bold" },
        description: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "16px", font_weight: "bold" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];
    
    d3.select(containerSelector).html("");
    
    // 数值格式化函数
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }
    
    // ---------- 2. 尺寸和布局设置 ----------
    const width = variables.width || 800;
    const height = variables.height || 600;
    const margin = { top: 40, right: 60, bottom: 90, left: 60 };
    
    // ---------- 3. 提取字段名和单位 ----------
    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "dimension";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "value";
    
    let valueUnit = "";
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y")?.unit;
    }
    
    // ---------- 4. 数据处理 ----------
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);
    
    // ---------- 5. 计算布局参数 ----------
    // 创建临时SVG元素用于文本测量
    const tempSvgForWidth = d3.select(containerSelector)
        .append("svg")
        .attr("width", 1)
        .attr("height", 1)
        .style("position", "absolute")
        .style("visibility", "hidden");
    
    // 辅助函数：估算文本宽度
    const estimateTextWidth = (text, fontConfig) => {
        const tempText = tempSvgForWidth.append("text")
            .style("font-family", fontConfig.font_family)
            .style("font-size", fontConfig.font_size)
            .style("font-weight", fontConfig.font_weight)
            .text(text);
        const width = tempText.node().getBBox().width;
        tempText.remove();
        return width;
    };

    // 计算动态文本大小的函数
    const calculateFontSize = (text, maxWidth, baseSize = 12) => {
        const avgCharWidth = baseSize * 0.6;
        const textWidth = text.length * avgCharWidth;
        if (textWidth < maxWidth) return baseSize;
        return Math.max(8, Math.floor(baseSize * (maxWidth / textWidth)));
    };
    
    // 预计算所有维度标签的宽度
    const dimLabelWidths = {};
    sortedData.forEach(d => {
        const dimensionText = d[dimensionField];
        dimLabelWidths[dimensionText] = estimateTextWidth(dimensionText, typography.label);
    });
    
    tempSvgForWidth.remove();
    
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
    
    // ---------- 7. 创建比例尺 ----------
    const xScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerWidth])
        .padding(0.2);
    
    const columnWidth = xScale.bandwidth();
    const barWidth = Math.max(columnWidth * 0.6, 15);
    const iconRadius = barWidth / 2;
    const iconPadding = iconRadius / 4;
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueField]) * 1.1])
        .range([innerHeight - (iconRadius * 2 + iconPadding * 4), 0]);
    
    // ---------- 8. 创建主图表组 ----------
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 添加水平网格线
    const gridValues = yScale.ticks(5);
    gridValues.forEach(value => {
        g.append("line")
            .attr("class", "gridline")
            .attr("x1", 0)
            .attr("y1", yScale(value))
            .attr("x2", innerWidth)
            .attr("y2", yScale(value))
            .attr("stroke", "#e0e0e0")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");
    });
    
    // 创建并添加左侧值轴
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat(d => d);
    
    const yAxisGroup = g.append("g")
        .attr("class", "axis")
        .call(yAxis);
    
    yAxisGroup.select(".domain").attr("stroke", "none");
    yAxisGroup.selectAll(".tick text")
        .attr("class", "value")
        .style("font-family", typography.annotation.font_family)
        .style("font-size", "12px")
        .style("fill", colors.text_color);
    
    // ---------- 9. 绘制图表元素 ----------
    const primaryColor = colors.other && colors.other.primary ? colors.other.primary : "#F7941D";
    
    // 计算统一字体大小
    const longestLabel = sortedDimensions.reduce((a, b) => 
        a.toString().length > b.toString().length ? a : b, "").toString();
    const labelMaxWidth = xScale.bandwidth() * 1.5;
    const baseFontSize = parseInt(typography.label.font_size) || 14;
    const uniformFontSize = calculateFontSize(longestLabel, labelMaxWidth, baseFontSize);
    
    sortedData.forEach((d, i) => {
        const dimension = d[dimensionField];
        const value = +d[valueField];
        const x = xScale(dimension);
        const circleX = x + columnWidth / 2;
        const circleY = yScale(value);
        
        // 1. 绘制垂直线
        g.append("line")
            .attr("class", "mark")
            .attr("x1", circleX)
            .attr("y1", innerHeight)
            .attr("x2", circleX)
            .attr("y2", circleY)
            .attr("stroke", primaryColor)
            .attr("stroke-width", barWidth / 4);
        
        // 2. 添加类别标题（在底部）
        const textLabel = g.append("text")
            .attr("class", "label")
            .attr("x", circleX)
            .attr("y", innerHeight + 20)
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${uniformFontSize}px`)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color);
            
        // 检查是否需要文本换行
        if (dimLabelWidths[dimension] > labelMaxWidth) {
            wrapText(textLabel, dimension, labelMaxWidth, 1.1, 'top');
        } else {
            textLabel.text(dimension);
        }
        
        // 3. 添加图标圆圈（在线的顶部）
        g.append("circle")
            .attr("class", "mark")
            .attr("cx", circleX)
            .attr("cy", circleY)
            .attr("r", iconRadius)
            .attr("fill", primaryColor);
        
        // 4. 添加图标（如果有）
        if (images.field && images.field[dimension]) {
            const iconSize = iconRadius * 1.5;
            g.append("image")
                .attr("class", "image")
                .attr("x", circleX - iconSize / 2)
                .attr("y", circleY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", images.field[dimension]);
        }
        
        // 5. 添加数值标签（在圆圈上方）
        const formattedValue = formatValue(value) + (valueUnit ? ` ${valueUnit}` : '');
        const valueLabelMaxWidth = barWidth * 2;
        let valueFontSize = Math.min(20, Math.max(barWidth * 0.5, parseFloat(typography.annotation.font_size)));
        
        // 创建临时文本来测量宽度
        const tempValueText = g.append("text")
            .style("visibility", "hidden")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", `${valueFontSize}px`)
            .style("font-weight", typography.annotation.font_weight)
            .text(formattedValue);
            
        const valueTextWidth = tempValueText.node().getComputedTextLength();
        tempValueText.remove();
        
        // 如果超出宽度，调整字体大小
        if (valueTextWidth > valueLabelMaxWidth) {
            valueFontSize = Math.max(8, valueFontSize * (valueLabelMaxWidth / valueTextWidth));
        }
        
        // 定义标签位置，确保与圆形图标有适当间距
        const iconTop = circleY - iconRadius;
        const labelPadding = iconRadius * 0.3;
        const labelY = iconTop - labelPadding;
        
        const valueTextLabel = g.append("text")
            .attr("class", "value")
            .attr("x", circleX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", `${valueFontSize}px`)
            .style("font-weight", typography.annotation.font_weight)
            .style("fill", colors.text_color);
            
        // 应用换行处理（如果需要）
        if (valueTextWidth > valueLabelMaxWidth) {
            valueTextLabel.text(null);
            
            const words = formattedValue.split(/\s+/);
            if (words.length <= 1) {
                // 字符级拆分
                const chars = formattedValue.split('');
                let line = '';
                let lines = [];
                
                for (let i = 0; i < chars.length; i++) {
                    const testLine = line + chars[i];
                    const testTspan = valueTextLabel.append("tspan").text(testLine);
                    const testWidth = testTspan.node().getComputedTextLength();
                    testTspan.remove();
                    
                    if (testWidth > valueLabelMaxWidth && line.length > 0) {
                        lines.push(line);
                        line = chars[i];
                    } else {
                        line = testLine;
                    }
                }
                
                if (line.length > 0) lines.push(line);
                
                const lineHeight = valueFontSize * 1.2;
                const totalHeight = lineHeight * lines.length;
                const firstLineY = labelY - (totalHeight - lineHeight);
                
                lines.forEach((lineText, i) => {
                    valueTextLabel.append("tspan")
                        .attr("x", circleX)
                        .attr("y", firstLineY)
                        .attr("dy", `${i * 1.2}em`)
                        .text(lineText);
                });
            } else {
                // 单词级换行
                let line = [];
                let lines = [];
                
                while (words.length) {
                    const word = words.shift();
                    line.push(word);
                    
                    const testTspan = valueTextLabel.append("tspan").text(line.join(' '));
                    const testWidth = testTspan.node().getComputedTextLength();
                    testTspan.remove();
                    
                    if (testWidth > valueLabelMaxWidth && line.length > 1) {
                        line.pop();
                        lines.push(line.join(' '));
                        line = [word];
                    }
                }
                
                if (line.length > 0) lines.push(line.join(' '));
                
                const lineHeight = valueFontSize * 1.2;
                const totalHeight = lineHeight * lines.length;
                const firstLineY = labelY - (totalHeight - lineHeight);
                
                lines.forEach((lineText, i) => {
                    valueTextLabel.append("tspan")
                        .attr("x", circleX)
                        .attr("y", firstLineY)
                        .attr("dy", `${i * 1.2}em`)
                        .text(lineText);
                });
            }
        } else {
            valueTextLabel.text(formattedValue);
        }
    });
    
    // ---------- 10. 辅助函数 ----------
    // 增强的文本换行函数
    function wrapText(text, str, width, lineHeight = 1.1, alignment = 'middle') {
        const words = str.split(/\s+/).reverse();
        let word;
        let line = [];
        const initialY = parseFloat(text.attr("y"));
        const initialX = parseFloat(text.attr("x"));

        text.text(null);
        let tspans = [];

        // 优先按单词换行
        if (words.length > 1) {
            let currentLine = [];
            while (word = words.pop()) {
                currentLine.push(word);
                const tempTspan = text.append("tspan").text(currentLine.join(" "));
                const isOverflow = tempTspan.node().getComputedTextLength() > width;
                tempTspan.remove();

                if (isOverflow && currentLine.length > 1) {
                    currentLine.pop();
                    tspans.push(currentLine.join(" "));
                    currentLine = [word];
                }
            }
            if (currentLine.length > 0) {
                tspans.push(currentLine.join(" "));
            }
        } else {
            // 按字符换行
            const chars = str.split('');
            let currentLine = '';
            for (let i = 0; i < chars.length; i++) {
                const nextLine = currentLine + chars[i];
                const tempTspan = text.append("tspan").text(nextLine);
                const isOverflow = tempTspan.node().getComputedTextLength() > width;
                tempTspan.remove();

                if (isOverflow && currentLine.length > 0) {
                    tspans.push(currentLine);
                    currentLine = chars[i];
                } else {
                    currentLine = nextLine;
                }
            }
            if (currentLine.length > 0) {
                tspans.push(currentLine);
            }
        }

        // 计算对齐偏移
        const totalLines = tspans.length;
        let startDy = 0;
        
        if (alignment === 'middle') {
            startDy = -((totalLines - 1) * lineHeight / 2);
        } else if (alignment === 'bottom') {
            const totalHeightEm = totalLines * lineHeight;
            startDy = -(totalHeightEm - lineHeight);
        }

        // 创建所有行的tspan元素
        tspans.forEach((lineText, i) => {
            text.append("tspan")
                .attr("x", initialX)
                .attr("dy", (i === 0 ? startDy : lineHeight) + "em")
                .text(lineText);
        });
    }
    
    return svg.node();
}