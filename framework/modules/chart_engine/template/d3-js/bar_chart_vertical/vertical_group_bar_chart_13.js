/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Group Bar Chart",
    "chart_name": "vertical_group_bar_chart_13",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": [],
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


// 垂直分组条形图实现 - 手绘风格
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    const jsonData = data;
    const chartData = jsonData.data.data || [];
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        // Use a sketch-like font for labels
        label: { font_family: "'Comic Sans MS', cursive", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || {
        text_color: "#333333",
        field: {},
        other: {
            primary: "#4682B4" // Default primary color (less relevant now)
        }
    };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];

    typography.subtitle = typography.subtitle || typography.description;

    // Sketch style doesn't usually use rounded corners or gradients
    variables.has_rounded_corners = false; // Force disable rounded corners for sketch style
    variables.has_gradient = false;      // Force disable gradient
    variables.has_shadow = variables.has_shadow || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;

    d3.select(containerSelector).html("");

    // ---------- 2. 尺寸和布局设置 ----------
    const width = variables.width || 800;
    const height = variables.height || 500;
    const margin = {
        top: 100, right: 30, bottom: 100, // Increased bottom margin for sketch labels + icons
        left: 30
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // ---------- 3. 提取字段名称和单位 ----------
    let xField, yField, groupField;
    let xUnit = "", yUnit = "";
    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const groupColumn = dataColumns.find(col => col.role === "group");
    if (xColumn) xField = xColumn.name;
    if (yColumn) yField = yColumn.name;
    if (groupColumn) groupField = groupColumn.name;
    xUnit = xColumn?.unit === "none" ? "" : (xColumn?.unit || "");
    yUnit = yColumn?.unit === "none" ? "" : (yColumn?.unit || "");

    // ---------- 4. 数据处理 ----------
    let useData = chartData;
    const xValues = [...new Set(useData.map(d => d[xField]))];
    let groupValues = [...new Set(useData.map(d => d[groupField]))];
    if (groupValues.length !== 2) {
        console.warn("此图表需要恰好2个组字段");
        // Handle error or default behavior if groups != 2
        if (groupValues.length < 2) return; // Stop if not enough groups
        groupValues = groupValues.slice(0, 2); // Take first two if more than 2
    }
    const leftBarGroup = groupValues[0];
    const rightBarGroup = groupValues[1];

     // 获取分组颜色，若未在colors.field中定义，则使用默认颜色
    const leftGroupColor = colors.field[leftBarGroup] || "#4269d0";
    const rightGroupColor = colors.field[rightBarGroup] || "#ff725c";


    // ---------- 5. 创建SVG容器 ----------
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // ---------- 6. 创建视觉效果 (Patterns for Sketch Style) ----------
    const defs = svg.append("defs");

    // --- Sketch Pattern for Left Bars ---
    const patternLeft = defs.append("pattern")
        .attr("id", "pattern-sketch-left")
        .attr("width", 8) // Pattern tile size
        .attr("height", 8)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("patternTransform", "rotate(45)"); // Rotate lines

    // Background color for the pattern tile
    patternLeft.append("rect")
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", leftGroupColor);

    // Sketch lines (white in example image)
    patternLeft.append("path")
        .attr("d", "M -1,2 l 10,0 M -1,5 l 10,0 M -1,8 l 10,0") // Horizontal lines, rotation makes them diagonal
        .attr("stroke", "#FFFFFF") // White lines like example
        .attr("stroke-width", 0.8); // Thinner lines

    // --- Sketch Pattern for Right Bars ---
    const patternRight = defs.append("pattern")
        .attr("id", "pattern-sketch-right")
        .attr("width", 8)
        .attr("height", 8)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("patternTransform", "rotate(45)");

    patternRight.append("rect")
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", rightGroupColor);

    patternRight.append("path")
        .attr("d", "M -1,2 l 10,0 M -1,5 l 10,0 M -1,8 l 10,0")
        .attr("stroke", "#FFFFFF")
        .attr("stroke-width", 0.8);

    // *** 添加: 新的 Sketch Pattern for Label Backgrounds ***
    const patternLabelSketch = defs.append("pattern")
         .attr("id", "pattern-label-sketch") // 新 ID
         .attr("width", 8) // 可以与 bar pattern 保持一致或调整
         .attr("height", 8)
         .attr("patternUnits", "userSpaceOnUse")
         .attr("patternTransform", "rotate(45)"); // 保持斜线

     // 添加白色背景矩形
     patternLabelSketch.append("rect")
         .attr("width", 8)
         .attr("height", 8)
         .attr("fill", "#FFFFFF"); // 白色背景

     // 添加灰色斜线
     patternLabelSketch.append("path")
         .attr("d", "M -1,2 l 10,0 M -1,5 l 10,0 M -1,8 l 10,0") // 与 bar pattern 线条一致
         .attr("stroke", "#CCCCCC") // *** 修改: 灰色线条 ***
         .attr("stroke-width", 0.6); // 可以调整线条粗细

    // Shadow Filter (if enabled)
    if (variables.has_shadow) {
        // ... (shadow filter code remains the same as original)
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

    // ---------- 7. 创建图表区域 ----------
    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // ---------- 8. 创建比例尺 ----------
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.2);

    const groupScale = d3.scaleBand()
        .domain([0, 1]) // Left (0) and Right (1) bars within a group
        .range([0, xScale.bandwidth()])
        .padding(variables.has_spacing ? 0.2 : 0.1); // Adjust spacing within group

    const dataMax = d3.max(useData, d => +d[yField]) || 100;
    const yScale = d3.scaleLinear()
        .domain([0, dataMax * 1.1]) // Add some top padding for labels
        .range([innerHeight, 0]);

    const barWidth = groupScale.bandwidth();

    // ---------- 9. 文本格式化 ----------
    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    };

    // 计算动态文本大小的函数
    const calculateFontSize = (text, maxWidth, baseSize = 12) => {
        // 估算每个字符的平均宽度 (假设为baseSize的60%)
        const avgCharWidth = baseSize * 0.6;
        // 计算文本的估计宽度
        const textWidth = text.length * avgCharWidth;
        // 如果文本宽度小于最大宽度，返回基础大小
        if (textWidth < maxWidth) {
            return baseSize;
        }
        // 否则，按比例缩小字体大小
        return Math.max(10, Math.floor(baseSize * (maxWidth / textWidth)));
    };
    function wrapText(text, str, width, lineHeight) {
        const words = str.split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const y = text.attr("y");
        const dy = parseFloat(text.attr("dy") || 0);
        
        // 先清空文本
        text.text(null);
        
        // 处理文本
        let tspans = [];
        
        // 如果没有空格可分割，按字符分割
        if (words.length <= 1) {
            const chars = str.split('');
            let currentLine = '';
            
            for (let i = 0; i < chars.length; i++) {
                currentLine += chars[i];
                
                // 创建临时tspan来测量宽度
                const tempTspan = text.append("tspan").text(currentLine);
                const isOverflow = tempTspan.node().getComputedTextLength() > width;
                tempTspan.remove();
                
                if (isOverflow && currentLine.length > 1) {
                    // 当前行过长，回退一个字符并换行
                    currentLine = currentLine.slice(0, -1);
                    
                    // 添加到tspans数组
                    tspans.push(currentLine);
                    
                    // 重新开始下一行
                    currentLine = chars[i];
                    lineNumber++;
                }
            }
            
            // 添加最后一行
            if (currentLine.length > 0) {
                tspans.push(currentLine);
            }
        } else {
            // 处理有空格的文本
            let currentLine = [];
            
            while (word = words.pop()) {
                currentLine.push(word);
                
                // 创建临时tspan来测量宽度
                const tempTspan = text.append("tspan").text(currentLine.join(" "));
                const isOverflow = tempTspan.node().getComputedTextLength() > width;
                tempTspan.remove();
                
                if (isOverflow && currentLine.length > 1) {
                    // 回退一个词
                    currentLine.pop();
                    
                    // 添加到tspans数组
                    tspans.push(currentLine.join(" "));
                    
                    // 重新开始下一行
                    currentLine = [word];
                    lineNumber++;
                }
            }
            
            // 添加最后一行
            if (currentLine.length > 0) {
                tspans.push(currentLine.join(" "));
            }
        }
        
        // 计算总行数
        const totalLines = tspans.length;
        
        // 计算垂直居中的起始位置
        // 对于单行文本，y位置保持不变
        // 对于多行文本，需要向上偏移以保持垂直居中
        let startY = y;
        if (totalLines > 1) {
            // 向上偏移半行距离 * (总行数-1)
            startY = parseFloat(y) - (lineHeight * (totalLines - 1) / 2);
        }
        
        // 创建所有行的tspan元素
        tspans.forEach((lineText, i) => {
            text.append("tspan")
                .attr("x", text.attr("x"))
                .attr("y", startY)
                .attr("dy", `${i * lineHeight}em`)
                .text(lineText);
        });
    }

    // ---------- 10. 创建X坐标轴标签 (新逻辑) ----------
    const xAxisGroup = chart.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    // 计算标签最大宽度和统一字体大小 (同 chart_12)
    const labelMaxWidth = xScale.bandwidth() * 1.1; // 允许稍微宽一点以便背景有空间
    const longestLabel = xValues.reduce((a, b) => a.toString().length > b.toString().length ? a.toString() : b.toString(), "");
    const baseFontSize = parseInt(typography.label.font_size);
    const uniformFontSize = calculateFontSize(longestLabel, labelMaxWidth * 0.9, baseFontSize); // 计算字体时用稍小的宽度

    // 定义手绘背景的内边距
    const sketchPadding = 5;

    // 绘制X轴标签组
    xAxisGroup.selectAll(".x-label-group")
        .data(xValues)
        .enter()
        .append("g")
        .attr("class", "x-label-group")
        .attr("transform", d => `translate(${xScale(d) + xScale.bandwidth() / 2}, 25)`) // Group 定位不变
        .each(function(d) {
            const group = d3.select(this);
            const textContent = d.toString();

            // 1. 创建文本元素
            const text = group.append("text")
                .attr("class", "x-label")
                .attr("x", 0) // 相对于 group 居中
                .attr("y", 0) // 相对于 group 垂直基线 (会被 wrapText 调整)
                .attr("text-anchor", "middle")
                .style("font-family", "'Comic Sans MS', cursive")
                .style("font-size", `${uniformFontSize}px`) // 应用统一字体
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(textContent);

            // 2. 检查宽度并应用换行 (同 chart_12)
            // 注意: wrapText 需要在 chart_13 中可用
            if (text.node().getComputedTextLength() > labelMaxWidth) {
                wrapText(text, textContent, labelMaxWidth, 1.1); // 1.1 是行高倍数
            }

            // 3. 获取最终文本边界框 (换行后)
            const bbox = text.node().getBBox();

            // 4. 计算手绘背景尺寸和位置
            const bgWidth = bbox.width + 2 * sketchPadding;
            const bgHeight = bbox.height + 1.5 * sketchPadding;
            // bgX/bgY 相对于 group 的 (0,0) 点计算
            const bgX = bbox.x - sketchPadding;
            const bgY = bbox.y - sketchPadding * 0.75; // 调整 Y 使背景居中

            // 5. 插入手绘背景矩形 (在文本之前)
            group.insert("rect", "text") 
                .attr("class", "label-background")
                .attr("x", bgX)
                .attr("y", bgY)
                .attr("width", bgWidth)
                .attr("height", bgHeight)
                .attr("fill", "url(#pattern-label-sketch)") 
                .attr("stroke", "#AAAAAA")
                .attr("stroke-width", 0.5);
        });

    // ---------- 11. 绘制图例 ----------
    const tempTextLegend = svg.append("text").attr("opacity", 0).style("font-family", "'Comic Sans MS', cursive").style("font-size", "12px");
    const legendData = [
        { key: leftBarGroup, color: leftGroupColor, pattern: "url(#pattern-sketch-left)" },
        { key: rightBarGroup, color: rightGroupColor, pattern: "url(#pattern-sketch-right)" }
    ];
    const legendItemWidths = legendData.map(item => {
        tempTextLegend.text(item.key);
        return tempTextLegend.node().getComputedTextLength() + 25; // text + square(15) + padding(10)
    });
    const legendSpacing = 20;
    const totalLegendWidth = legendItemWidths.reduce((sum, width) => sum + width, 0) + (legendItemWidths.length - 1) * legendSpacing;
    tempTextLegend.remove();

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(width - totalLegendWidth) / 2}, 30)`);

    let legendOffset = 0;
    legendData.forEach((item, i) => {
        const legendItem = legend.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${legendOffset}, 0)`);

        // Use pattern for legend square
        legendItem.append("rect")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", item.pattern) // Apply sketch pattern
            .attr("stroke", "#555")     // Add a border to the legend rect
            .attr("stroke-width", 0.5);

        legendItem.append("text")
            .attr("x", 20)
            .attr("y", 7.5)
            .attr("dy", "0.35em")
            .style("font-family", "'Comic Sans MS', cursive") // Use sketch font
            .style("font-size", "12px")
            .style("fill", colors.text_color)
            .text(item.key);

        legendOffset += legendItemWidths[i] + legendSpacing;
    });

    // ---------- 12. 绘制条形图和数值标签 (带手绘背景) ----------
    xValues.forEach(xValue => {
        const xData = useData.filter(d => d[xField] === xValue);
        const leftBarData = xData.find(d => d[groupField] === leftBarGroup);
        const rightBarData = xData.find(d => d[groupField] === rightBarGroup);

        const baseFontSizeValue = parseInt(typography.label.font_size); // 数值标签基础大小
        const valueLabelMaxWidth = barWidth * 1.1; // 数值标签最大宽度

        // --- Left Bar --- 
        if (leftBarData) {
            const leftValue = +leftBarData[yField];
            if (isNaN(leftValue)) return; // Skip if value is not a number

            const leftBarHeight = innerHeight - yScale(leftValue);
            const leftBarY = yScale(leftValue);
            const leftBarX = xScale(xValue) + groupScale(0); // Use groupScale for position

            // Draw Bar
            chart.append("rect")
                .attr("class", "bar left-bar")
                .attr("x", leftBarX)
                .attr("y", leftBarY)
                .attr("width", barWidth)
                .attr("height", Math.max(0, leftBarHeight)) // Ensure height is not negative
                .attr("fill", "url(#pattern-sketch-left)") // Use sketch pattern
                .attr("stroke", variables.has_stroke ? "#555" : "none")
                .attr("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");

            // --- 修改: 绘制数值标签，不带手绘背景 ---
            if (leftBarHeight > 5) { 
                const labelX = leftBarX + barWidth / 2;
                const labelY = leftBarY - 5; // 将标签放置在柱子上方5个像素
                const textContent = formatValue(leftValue) + (yUnit ? ` ${yUnit}` : '');
                
                // 计算字体大小
                const tempText = chart.append("text").style("visibility", "hidden")
                    .style("font-family", "'Comic Sans MS', cursive")
                    .style("font-size", `${baseFontSizeValue}px`)
                    .style("font-weight", "bold")
                    .text(textContent);
                
                let currentFontSize = baseFontSizeValue;
                const textWidth = tempText.node().getComputedTextLength();
                
                if (textWidth > valueLabelMaxWidth) {
                    currentFontSize = Math.max(8, baseFontSizeValue * (valueLabelMaxWidth / textWidth));
                }
                
                // 添加实际文本标签
                const textLabel = chart.append("text")
                    .attr("class", "bar-label")
                    .attr("x", labelX)
                    .attr("y", labelY)
                    .attr("text-anchor", "middle")
                    .style("font-family", "'Comic Sans MS', cursive")
                    .style("font-size", `${currentFontSize}px`)
                    .style("font-weight", "bold")
                    .style("fill", colors.text_color);
                
                // 如果即使缩小到8px后文本仍然超出宽度，应用文本换行
                if (currentFontSize <= 8 && textWidth > valueLabelMaxWidth) {
                    wrapText(textLabel, textContent, barWidth, 1.1);
                    
                    // 获取tspan元素计算最后一行位置
                    const tspans = textLabel.selectAll("tspan");
                    const lineCount = tspans.size();
                    
                    if (lineCount > 1) {
                        // 计算文本高度以确保最后一行紧贴柱子顶部
                        const lineHeight = currentFontSize * 1.1;
                        const totalTextHeight = lineHeight * lineCount;
                        
                        // 重新定位所有tspan，使最后一行紧贴柱子顶部
                        tspans.each(function(d, i) {
                            const tspan = d3.select(this);
                            tspan.attr("y", labelY - totalTextHeight + (i + 1) * lineHeight);
                        });
                    }
                } else {
                    textLabel.text(textContent);
                }
                
                tempText.remove();
            }
        }

        // --- Right Bar --- (类似地修改数值标签)
        if (rightBarData) {
            const rightValue = +rightBarData[yField];
             if (isNaN(rightValue)) return; // Skip if value is not a number

            const rightBarHeight = innerHeight - yScale(rightValue);
            const rightBarY = yScale(rightValue);
            const rightBarX = xScale(xValue) + groupScale(1); // Use groupScale for position

            // Draw Bar
            chart.append("rect")
                .attr("class", "bar right-bar")
                .attr("x", rightBarX)
                .attr("y", rightBarY)
                .attr("width", barWidth)
                .attr("height", Math.max(0, rightBarHeight)) // Ensure height is not negative
                .attr("fill", "url(#pattern-sketch-right)") // Use sketch pattern
                .attr("stroke", variables.has_stroke ? "#555" : "none")
                .attr("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");

            // --- 修改: 绘制数值标签，不带手绘背景 ---
            if (rightBarHeight > 5) { 
                const labelX = rightBarX + barWidth / 2;
                const labelY = rightBarY - 5; // 将标签放置在柱子上方5个像素
                const textContent = formatValue(rightValue) + (yUnit ? ` ${yUnit}` : '');
                
                // 计算字体大小
                const tempText = chart.append("text").style("visibility", "hidden")
                    .style("font-family", "'Comic Sans MS', cursive")
                    .style("font-size", `${baseFontSizeValue}px`)
                    .style("font-weight", "bold")
                    .text(textContent);
                
                let currentFontSize = baseFontSizeValue;
                const textWidth = tempText.node().getComputedTextLength();
                
                if (textWidth > valueLabelMaxWidth) {
                    currentFontSize = Math.max(8, baseFontSizeValue * (valueLabelMaxWidth / textWidth));
                }
                
                // 添加实际文本标签
                const textLabel = chart.append("text")
                    .attr("class", "bar-label")
                    .attr("x", labelX)
                    .attr("y", labelY)
                    .attr("text-anchor", "middle")
                    .style("font-family", "'Comic Sans MS', cursive")
                    .style("font-size", `${currentFontSize}px`)
                    .style("font-weight", "bold")
                    .style("fill", colors.text_color);
                
                // 如果即使缩小到8px后文本仍然超出宽度，应用文本换行
                if (currentFontSize <= 8 && textWidth > valueLabelMaxWidth) {
                    wrapText(textLabel, textContent, barWidth, 1.1);
                    
                    // 获取tspan元素计算最后一行位置
                    const tspans = textLabel.selectAll("tspan");
                    const lineCount = tspans.size();
                    
                    if (lineCount > 1) {
                        // 计算文本高度以确保最后一行紧贴柱子顶部
                        const lineHeight = currentFontSize * 1.1;
                        const totalTextHeight = lineHeight * lineCount;
                        
                        // 重新定位所有tspan，使最后一行紧贴柱子顶部
                        tspans.each(function(d, i) {
                            const tspan = d3.select(this);
                            tspan.attr("y", labelY - totalTextHeight + (i + 1) * lineHeight);
                        });
                    }
                } else {
                    textLabel.text(textContent);
                }
                
                tempText.remove();
            }
        }
    });

    // ---------- 14. 返回SVG节点 ----------
    return svg.node();
}