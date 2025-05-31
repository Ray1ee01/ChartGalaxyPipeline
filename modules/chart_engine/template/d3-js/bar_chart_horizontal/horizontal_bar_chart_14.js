/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart With Circle",
    "chart_name": "horizontal_bar_chart_14",
    "is_composite": true,
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [
        ["categorical"],
        ["numerical"],
        ["numerical"]
    ],
    "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": ["radius_corner", "spacing", "shadow", "gradient", "stroke"],
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

// 水平条形图与比例圆复合图表实现 - 使用D3.js  horizontal bar proportional circle area chart 02
function makeChart(containerSelector, data) {
        // ---------- 1. 数据准备阶段 ----------
        
        // 提取数据和配置
        const jsonData = data;                           // 完整的JSON数据对象
        const chartData = jsonData.data.data                 // 实际数据点数组  
        const variables = jsonData.variables || {};      // 图表配置
        const typography = jsonData.typography || {      // 字体设置，如果不存在则使用默认值
            title: { font_family: "Arial", font_size: "28px", font_weight: 700 },
            label: { font_family: "Arial", font_size: "16px", font_weight: 500 },
            description: { font_family: "Arial", font_size: "16px", font_weight: 500 },
            annotation: { font_family: "Arial", font_size: "12px", font_weight: 400 }
        };
        const colors = jsonData.colors || { 
            text_color: "#000000", 
            background_color: "#FFFFFF",
            other: { primary: "#83C341" }
        };
        const images = jsonData.images || { field: {}, other: {} };   // 图像设置
        const dataColumns = jsonData.data.columns || []; // 数据列定义
        const titles = jsonData.titles || {};           // 标题配置
        
        // 设置视觉效果变量的默认值
        variables.has_rounded_corners = variables.has_rounded_corners !== undefined ? variables.has_rounded_corners : false;
        variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : false;
        variables.has_shadow = variables.has_shadow !== undefined ? variables.has_shadow : false;
        variables.has_gradient = variables.has_gradient !== undefined ? variables.has_gradient : false;
        variables.has_stroke = variables.has_stroke !== undefined ? variables.has_stroke : false;
        
        // 清空容器
        d3.select(containerSelector).html("");
        
        // ---------- 2. 尺寸和布局设置 ----------
        
        // 设置图表总尺寸
        const width = variables.width || 800;
        const height = variables.height || 600;
        
        // 设置边距
        const margin = {
            top: 100,      // 顶部留出标题空间
            right: 5,      // 右侧边距
            bottom: 40,    // 底部边距
            left: 10       // 左侧边距，给文字留出一些空间
        };
        
        // ---------- 3. 提取字段名和单位 ----------
        
        // 根据数据列提取字段名
        const dimensionField = dataColumns.find(col => col.role === "x")?.name || "Country";
        const valueField1 = dataColumns.find(col => col.role === "y" )?.name || "Crypto Ownership Percentage";
        const valueField2 = dataColumns.find(col => col.role === "y2")?.name || "Number of Owners";
        
        // 获取字段单位
        let valueUnit1 = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : 
                           dataColumns.find(col => col.role === "y")?.unit;
        let valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit === "none"? "" :
                           dataColumns.find(col => col.role === "y2")?.unit;
        valueUnit1 = valueUnit1 ? valueUnit1 : "";
        valueUnit2 = valueUnit2 ? valueUnit2 : "";
        
        // 列标题（使用数据列的name字段，而不是description）
        const columnTitle1 = dataColumns.find(col => col.role === "y")?.name || 
                              "Crypto Ownership Percentage";
        const columnTitle2 = dataColumns.find(col => col.role === "y2")?.name || 
                              "Number of Owners";
        
        // ---------- 4. 数据处理 ----------
        
        // 按第一个数值字段降序排序数据
        const sortedData = [...chartData].sort((a, b) => b[valueField1] - a[valueField1]);
        const sortedDimensions = sortedData.map(d => d[dimensionField]);
        
        // 添加数值格式化函数
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
        
        // ---------- 5. 布局计算 ----------
        
        // 设置条形图和圆形图的布局比例
        const leftColumnRatio = 0.85;  // 左列占比
        const rightColumnRatio = 0.15; // 右列占比
        
        // 计算内部绘图区域尺寸
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        
        // 计算两列的宽度
        const barChartWidth = innerWidth * leftColumnRatio;
        const circleChartWidth = innerWidth * rightColumnRatio;
        
        // ---------- 6. 创建比例尺 ----------
        
        // 计算条形的额外间距（如果启用）
        const barPadding = variables.has_spacing ? 0.2 : 0.1;
        
        // Y轴比例尺（用于维度）
        const yScale = d3.scaleBand()
            .domain(sortedDimensions)
            .range([0, innerHeight])
            .padding(barPadding);
        
        // X轴比例尺（用于第一个数值）- 条形图
        const xScale = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => +d[valueField1]) * 1.05]) // 添加5%边距
            .range([0, barChartWidth]);
        
        // 圆形面积比例尺（用于第二个数值）
        const maxValue2 = d3.max(chartData, d => +d[valueField2]);
        const minRadius = yScale.bandwidth() * 0.1;  // 最小半径
        // 最大半径限制在条形高度的一半和右侧列宽的一半之间取较小值
        const maxRadius = Math.min(yScale.bandwidth() * 0.5, circleChartWidth * 0.4); // 稍微缩小一点以防边缘碰撞
        
        const radiusScale = d3.scaleSqrt()  // 使用平方根比例尺确保面积比例正确
            .domain([0, maxValue2])
            .range([minRadius, maxRadius]);
        
        // ---------- 7. 创建SVG容器 ----------
        
        const svg = d3.select(containerSelector)
            .append("svg")
            .attr("width", "100%")
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("style", "max-width: 100%; height: auto;")
            .attr("xmlns", "http://www.w3.org/2000/svg")
            .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
        
    // ---------- Temporary SVG for text measurement (for titles) ----------
    const tempTextSvgForTitles = svg.append("g").attr("visibility", "hidden");

    // ---------- Helper: Estimate Generic Text Width (for titles) ----------
    const estimateGenericTextWidth_forTitles = (text, fontConfig) => {
        tempTextSvgForTitles.selectAll("text").remove(); // Clear old text
        const tempText = tempTextSvgForTitles.append("text")
            .style("font-family", fontConfig.font_family)
            .style("font-size", fontConfig.font_size)
            .style("font-weight", fontConfig.font_weight)
            .text(text);
        const width = tempText.node().getBBox().width;
        tempText.node().remove(); // Remove the temporary text element
        return width;
    };

    // ---------- Helper: Get Wrapped Lines (for titles) ----------
    function getWrappedLines_forTitles(textContent, availableWidth, fontConfig) {
        const words = (textContent || "").trim().split(/\s+/).filter(w => w !== "");
        const lines = [];
        const fontSizeValue = parseFloat(fontConfig.font_size);
        const lineHeight = fontSizeValue * 1.2; // Estimate line height

        if (words.length === 0) {
            return { linesArray: [], numLines: 0, lineHeight: lineHeight };
        }

        let currentLine = words[0];
        if (words.length === 1) {
             if (estimateGenericTextWidth_forTitles(currentLine, fontConfig) > availableWidth) {
                // Attempt to break the single word if it's too long
                let tempLine = "";
                for (let char of currentLine) {
                    if (estimateGenericTextWidth_forTitles(tempLine + char, fontConfig) > availableWidth && tempLine !== "") {
                        lines.push(tempLine);
                        tempLine = char;
                    } else {
                        tempLine += char;
                    }
                }
                if (tempLine !== "") lines.push(tempLine);
                if (lines.length === 0 && currentLine !== "") lines.push(currentLine); // Fallback for very short availableWidth
             } else {
                lines.push(currentLine);
             }
             return { linesArray: lines, numLines: lines.length, lineHeight: lineHeight };
        }
        
        // For multiple words
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine + " " + word;
            if (estimateGenericTextWidth_forTitles(testLine, fontConfig) > availableWidth && currentLine !== "") {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine !== "") { // Add the last line
            // Check if the last line (which could be a single word) itself needs breaking
            if (estimateGenericTextWidth_forTitles(currentLine, fontConfig) > availableWidth && !currentLine.includes(" ")) {
                let tempLine = "";
                for (let char of currentLine) {
                     if (estimateGenericTextWidth_forTitles(tempLine + char, fontConfig) > availableWidth && tempLine !== "") {
                        lines.push(tempLine);
                        tempLine = char;
                    } else {
                        tempLine += char;
                    }
                }
                if (tempLine !== "") lines.push(tempLine);
                if (lines.length === 0 && currentLine !== "") lines.push(currentLine);
            } else if (estimateGenericTextWidth_forTitles(currentLine, fontConfig) > availableWidth && currentLine.includes(" ")) {
                 // Re-process the last line as if it's a new text to wrap (if it's multi-word but still too long)
                const subWrapped = getWrappedLines_forTitles(currentLine, availableWidth, fontConfig);
                lines.push(...subWrapped.linesArray);
            }
            else {
                lines.push(currentLine);
            }
        }
        
        return { linesArray: lines.filter(l => l.length > 0), numLines: lines.filter(l => l.length > 0).length, lineHeight: lineHeight };
    }

        // ---------- 8. 添加SVG定义 ----------
        
        // 添加defs用于视觉效果
        const defs = svg.append("defs");
        
        // 添加阴影滤镜（如果启用）
        if (variables.has_shadow) {
            const filter = defs.append("filter")
                .attr("id", "shadow")
                .attr("filterUnits", "userSpaceOnUse")
                .attr("width", "200%") // 增加滤镜区域以包含阴影
                .attr("height", "200%");
            
            filter.append("feGaussianBlur")
                .attr("in", "SourceAlpha")
                .attr("stdDeviation", 3) // 阴影模糊度
                .attr("result", "blur");
            
            filter.append("feOffset")
                .attr("in", "blur") // 输入为模糊后的图像
                .attr("dx", 2) // 水平偏移
                .attr("dy", 2) // 垂直偏移
                .attr("result", "offsetBlur");
            
            const feMerge = filter.append("feMerge");
            feMerge.append("feMergeNode") // 添加阴影层
                .attr("in", "offsetBlur");
            feMerge.append("feMergeNode") // 添加原始图形层（置于顶层）
                .attr("in", "SourceGraphic");
        }
        
        // 为每个维度创建渐变（如果启用）
        if (variables.has_gradient) {
            sortedDimensions.forEach(dimension => {
                const barColor = getBarColor(dimension);
                
                const gradient = defs.append("linearGradient")
                    .attr("id", `bar-gradient-${dimension.replace(/\s+/g, '-')}`)
                    .attr("x1", "0%")
                    .attr("y1", "0%")
                    .attr("x2", "100%") // 水平渐变
                    .attr("y2", "0%");
                
                gradient.append("stop")
                    .attr("offset", "0%")
                    .attr("stop-color", d3.rgb(barColor).brighter(0.5)); // 渐变起始颜色（较亮）
                
                gradient.append("stop")
                    .attr("offset", "100%")
                    .attr("stop-color", d3.rgb(barColor).darker(0.3)); // 渐变结束颜色（较暗）
            });
        }
        
        // ---------- 9. 添加标题和标题下的线条 ----------
       
        // 计算标题位置 - Refactored for wrapping
        const titleFontConfig = typography.description;
        const titleTextBottomMargin = 15; // Space between title text's last line and the decorative line
        const decorativeLineY = margin.top - titleTextBottomMargin; // Y position of the decorative line
        const desiredBaselineOfLastTitleLine = decorativeLineY - 5; // Baseline of the last line of title text (5px above the decorative line)
        
        // 左侧列标题
        const leftTitleAvailableWidth = innerWidth * 0.6;
        const leftTitleXPos = margin.left;
        const columnTitle1Upper = columnTitle1.toUpperCase();
        const wrappedLeftTitle = getWrappedLines_forTitles(columnTitle1Upper, leftTitleAvailableWidth, titleFontConfig);
        
        if (wrappedLeftTitle.numLines > 0) {
            const initialYLeft = desiredBaselineOfLastTitleLine - (wrappedLeftTitle.numLines - 1) * wrappedLeftTitle.lineHeight;
            const leftTitleText = svg.append("text")
                .attr("x", leftTitleXPos)
                .attr("y", initialYLeft)
                .attr("text-anchor", "start")
                .style("font-family", titleFontConfig.font_family)
                .style("font-size", titleFontConfig.font_size)
                .style("font-weight", titleFontConfig.font_weight)
                .style("fill", colors.text_color);
    
            wrappedLeftTitle.linesArray.forEach((line, i) => {
                leftTitleText.append("tspan")
                    .attr("x", leftTitleXPos)
                    .attr("dy", i === 0 ? 0 : wrappedLeftTitle.lineHeight)
                    .text(line);
            });
        }
    
        // 右侧列标题
        const rightTitleAvailableWidth = innerWidth * 0.4;
        const rightTitleXPos = width - margin.right; // Align to the right edge of the chart
        const columnTitle2Upper = columnTitle2.toUpperCase();
        const wrappedRightTitle = getWrappedLines_forTitles(columnTitle2Upper, rightTitleAvailableWidth, titleFontConfig);
    
        if (wrappedRightTitle.numLines > 0) {
            const initialYRight = desiredBaselineOfLastTitleLine - (wrappedRightTitle.numLines - 1) * wrappedRightTitle.lineHeight;
            const rightTitleText = svg.append("text")
                .attr("x", rightTitleXPos)
                .attr("y", initialYRight)
                .attr("text-anchor", "end") // Right-align
                .style("font-family", titleFontConfig.font_family)
                .style("font-size", titleFontConfig.font_size)
                .style("font-weight", titleFontConfig.font_weight)
                .style("fill", colors.text_color);
    
            wrappedRightTitle.linesArray.forEach((line, i) => {
                rightTitleText.append("tspan")
                    .attr("x", rightTitleXPos)
                    .attr("dy", i === 0 ? 0 : wrappedRightTitle.lineHeight)
                    .text(line);
            });
        }
    
        // 标题下的黑线 (Adjusted Y position)
        svg.append("line")
            .attr("x1", margin.left)
            .attr("y1", decorativeLineY)
            .attr("x2", width - margin.right)
            .attr("y2", decorativeLineY)
            .attr("stroke", "#000000")
            .attr("stroke-width", 1.5);
        
        // 左侧标题下的三角形 (Adjusted X and Y position)
        const leftTriangleCenterX = margin.left + leftTitleAvailableWidth / 2;
        svg.append("polygon")
            .attr("points", `${leftTriangleCenterX - 6},${decorativeLineY + 1} ${leftTriangleCenterX + 6},${decorativeLineY + 1} ${leftTriangleCenterX},${decorativeLineY + 8}`)
            .attr("fill", "#000000");
        
        // 右侧标题下的三角形 (Adjusted X and Y position)
        const rightTriangleCenterX = (margin.left + leftTitleAvailableWidth) + (rightTitleAvailableWidth / 2);
        svg.append("polygon")
            .attr("points", `${rightTriangleCenterX - 6},${decorativeLineY + 1} ${rightTriangleCenterX + 6},${decorativeLineY + 1} ${rightTriangleCenterX},${decorativeLineY + 8}`)
            .attr("fill", "#000000");
        
        // Remove the temporary SVG element for title measurement once done with titles
        tempTextSvgForTitles.remove();

        // ---------- 10. 创建主图表组 ----------
        
        const g = svg.append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`); // 应用边距
        
        // ---------- 11. 获取条形图颜色的辅助函数 ----------
        
        // 获取条形图颜色
        const getBarColor = (dimension) => {
            // 优先使用字段特定颜色
            if (colors.field && colors.field[dimension]) {
                return colors.field[dimension];
            }
            // 否则使用主要的备用颜色
            return colors.other?.primary || "#83C341"; // 使用可选链和默认值增加健壮性
        };
        
        // ---------- 12. 绘制所有圆形（先绘制，以免被条形覆盖，确保阴影等效果完整）----------
        // 注意：这里只绘制圆形本身，标签将在后面的循环中添加
        sortedDimensions.forEach((dimension, index) => {
            const dataPoint = chartData.find(d => d[dimensionField] === dimension);
            if (!dataPoint || isNaN(+dataPoint[valueField2])) return; // 跳过无效数据
            
            const barHeight = yScale.bandwidth();
            const y = yScale(dimension);
            const centerY = y + barHeight / 2;
            
            // 绘制圆形（应用视觉效果）
            const circleRadius = radiusScale(+dataPoint[valueField2]);
            // 圆心X坐标位于右侧列的中心
            const circleX = barChartWidth + circleChartWidth / 2; 
            
            g.append("circle")
                .attr("cx", circleX)
                .attr("cy", centerY)
                .attr("r", Math.max(0, circleRadius)) // 确保半径不为负
                .attr("fill", getBarColor(dimension))
                .style("stroke", variables.has_stroke ? d3.rgb(getBarColor(dimension)).darker(0.5) : "none") // 添加描边（如果启用）
                .style("stroke-width", variables.has_stroke ? 1.5 : 0) // 描边宽度
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none"); // 应用阴影（如果启用）
        });
        
        // ---------- 13. 为每个维度绘制条形、标签和连接线 ----------
        
        // Helper function for text wrapping (can be defined here as it uses getTextWidth from the loop's scope)
        function getWrappedLines_local(text, maxWidth, style, getTextWidthFunc) {
            const words = text.split(/\s+/).filter(w => w.length > 0);
            const lines = [];
        
            if (words.length === 0) return [""]; // Return an empty string in an array if no words
        
            // Helper to wrap a single word if it's too long
            const wrapSingleWord = (singleWord) => {
                const wordLines = [];
                let currentWordPart = "";
                for (let char of singleWord) {
                    if (getTextWidthFunc(currentWordPart + char, style) > maxWidth && currentWordPart !== "") {
                        wordLines.push(currentWordPart);
                        currentWordPart = char;
                    } else {
                        currentWordPart += char;
                    }
                }
                if (currentWordPart !== "") wordLines.push(currentWordPart);
                return wordLines.length > 0 ? wordLines : [singleWord]; // Fallback to original word if wrapping fails
            };
        
            if (words.length === 1) {
                if (getTextWidthFunc(words[0], style) > maxWidth) {
                    return wrapSingleWord(words[0]);
                } else {
                    return [words[0]];
                }
            }
        
            let currentLine = words[0];
            // Check if the first word itself is too long
            if (getTextWidthFunc(currentLine, style) > maxWidth) {
                const wrappedFirstWordLines = wrapSingleWord(currentLine);
                lines.push(...wrappedFirstWordLines.slice(0, -1));
                currentLine = wrappedFirstWordLines.length > 0 ? wrappedFirstWordLines[wrappedFirstWordLines.length - 1] : "";
                 if (currentLine === "" && words.length > 1) currentLine = words[1]; // Move to next word if first was fully consumed and broken
                 else if (currentLine === "" && words.length ===1) { lines.push(...wrapSingleWord(words[0])); return lines.filter(l => l!="");}


            }


            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                 // First check if the current word itself is too long
                if (getTextWidthFunc(word, style) > maxWidth) {
                    if (currentLine !== "") lines.push(currentLine); // Push the line before this long word
                    lines.push(...wrapSingleWord(word)); // Push the wrapped parts of the long word
                    currentLine = ""; // Reset currentLine
                    continue;
                }

                const testLine = currentLine === "" ? word : currentLine + " " + word;
                if (getTextWidthFunc(testLine, style) > maxWidth && currentLine !== "") {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                     currentLine = testLine;
                }
            }

            if (currentLine !== "") { // Add the last line
                if (getTextWidthFunc(currentLine, style) > maxWidth && !currentLine.includes(" ") ) { // Single long word as last line
                     lines.push(...wrapSingleWord(currentLine));
                } else if (getTextWidthFunc(currentLine, style) > maxWidth && currentLine.includes(" ")) { // Last line has multiple words but still too long (edge case after loop logic)
                    // Re-process the last line as if it's a new text to wrap
                    const subLines = getWrappedLines_local(currentLine, maxWidth, style, getTextWidthFunc);
                    lines.push(...subLines);
                }
                else {
                    lines.push(currentLine);
                }
            }
            return lines.filter(l => l !== ""); // Ensure no empty lines
        }
        
        sortedDimensions.forEach((dimension, index) => {
            try {
                const dataPoint = chartData.find(d => d[dimensionField] === dimension);
                
                if (!dataPoint) {
                    console.warn(`No data found for dimension: ${dimension}`); // 使用warn而不是error
                    return; // 继续下一个循环
                }
                
                // 检查数据值是否有效
                if (isNaN(+dataPoint[valueField1]) || isNaN(+dataPoint[valueField2])) {
                    console.warn(`Invalid data values for ${dimension}: ${dataPoint[valueField1]}, ${dataPoint[valueField2]}`);
                    return; // 继续下一个循环
                }
                
                const barHeight = yScale.bandwidth();
                const y = yScale(dimension);
                if (typeof y !== 'number') { // 检查yScale返回是否有效
                    console.warn(`Invalid y position for dimension: ${dimension}`);
                    return; // 继续下一个循环
                }
                
                const centerY = y + barHeight / 2; // 条形和圆形的中心Y坐标
                const barWidthValue = xScale(+dataPoint[valueField1]); // 计算条形宽度
                const labelPadding = 5; // 标签与元素之间的通用内边距/外边距
                const labelPaddingInside = 10; // 标签在条形内部时的左右内边距
                const countryTextOriginal = dimension; // Keep original case for data, use uppercase for display if needed
                const value1Text = `${formatValue(+dataPoint[valueField1])}${valueUnit1}`; // 第一个数值的文本
                const value2Text = `${formatValue(+dataPoint[valueField2])}${valueUnit2}`; // 第二个数值的文本
                
                // 1. 绘制条形（应用视觉效果）
                const barFill = variables.has_gradient 
                    ? `url(#bar-gradient-${dimension.replace(/\s+/g, '-')})` // 使用渐变填充（如果启用）
                    : getBarColor(dimension); // 使用纯色填充
                    
                g.append("rect")
                    .attr("x", 0)
                    .attr("y", y)
                    .attr("width", Math.max(0, barWidthValue)) // 确保宽度不为负
                    .attr("height", barHeight)
                    .attr("fill", barFill)
                    .attr("rx", variables.has_rounded_corners ? barHeight * 0.2 : 0) // 圆角（如果启用）
                    .attr("ry", variables.has_rounded_corners ? barHeight * 0.2 : 0) // 圆角（如果启用）
                    .style("stroke", variables.has_stroke ? d3.rgb(getBarColor(dimension)).darker(0.5) : "none") // 描边（如果启用）
                    .style("stroke-width", variables.has_stroke ? 1.5 : 0) // 描边宽度
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none"); // 阴影（如果启用）
    
                // --- 标签定位逻辑 ---
    
                // Helper to measure text width (already defined in outer scope by user, but ensuring it's clear)
                const getTextWidth = (text, style) => {
                    const tempText = g.append("text")
                        .attr("x", -10000).attr("y", -10000) // 移出可视区域 更大的负值
                        .style("font-family", style.font_family)
                        .style("font-size", style.font_size)
                        .style("font-weight", style.font_weight)
                        .text(text);
                    const width = tempText.node().getBBox().width;
                    tempText.remove();
                    return width;
                };

                // --- Dimension Label (countryText) Processing ---
                const countryTextForDisplay = countryTextOriginal.toUpperCase();
                const maxAllowedDimLabelWidth = innerWidth * 0.3;
                let finalDimFontSize = parseFloat(typography.label.font_size);
                let currentDimLabelWidth = getTextWidth(countryTextForDisplay, { ...typography.label, font_size: `${finalDimFontSize}px` });

                if (currentDimLabelWidth > maxAllowedDimLabelWidth) {
                    let tempSize = finalDimFontSize;
                    while (tempSize > 8) { // Min font size 8px
                        tempSize--;
                        const tempWidth = getTextWidth(countryTextForDisplay, { ...typography.label, font_size: `${tempSize}px` });
                        if (tempWidth <= maxAllowedDimLabelWidth) {
                            break; 
                        }
                    }
                    finalDimFontSize = tempSize;
                    currentDimLabelWidth = getTextWidth(countryTextForDisplay, { ...typography.label, font_size: `${finalDimFontSize}px` });
                }
                
                const finalDimLabelStyle = { 
                    ...typography.label, 
                    font_size: `${finalDimFontSize}px`
                };

                let dimLabelLines = [countryTextForDisplay];
                let dimLabelIsWrapped = false;
                let dimLabelEffectiveWidth = currentDimLabelWidth; // Width after font reduction

                if (currentDimLabelWidth > maxAllowedDimLabelWidth) { // Still too wide, so wrap
                    dimLabelIsWrapped = true;
                    dimLabelLines = getWrappedLines_local(countryTextForDisplay, maxAllowedDimLabelWidth, finalDimLabelStyle, getTextWidth);
                    // Recalculate effective width based on the longest wrapped line
                    let maxWidthOfWrappedLine = 0;
                    dimLabelLines.forEach(line => {
                        const lineWidth = getTextWidth(line, finalDimLabelStyle);
                        if (lineWidth > maxWidthOfWrappedLine) maxWidthOfWrappedLine = lineWidth;
                    });
                    dimLabelEffectiveWidth = maxWidthOfWrappedLine > 0 ? maxWidthOfWrappedLine : maxAllowedDimLabelWidth; // Use measured if available
                }

                let dimLabelX, dimLabelColor, dimLabelAnchor;
                let dimLabelEndPosX; 

                if (!dimLabelIsWrapped && barWidthValue >= labelPaddingInside + dimLabelEffectiveWidth + labelPaddingInside) {
                    dimLabelX = labelPaddingInside;
                    dimLabelColor = "#FFFFFF";
                    dimLabelAnchor = "start";
                    dimLabelEndPosX = dimLabelX + dimLabelEffectiveWidth;
                } else {
                    dimLabelX = barWidthValue + labelPadding;
                    dimLabelColor = colors.text_color;
                    dimLabelAnchor = "start";
                    dimLabelEndPosX = dimLabelX + dimLabelEffectiveWidth; 
                }

                // Render Dimension Label
                const dimLabelLineHeight = parseFloat(finalDimLabelStyle.font_size) * 1.2;
                const totalDimLabelHeight = dimLabelLines.length * dimLabelLineHeight;
                const firstDimLineY = centerY - (totalDimLabelHeight / 2) + (dimLabelLineHeight / 2);

                const dimTextElement = g.append("text")
                    .attr("y", firstDimLineY) 
                    .attr("text-anchor", dimLabelAnchor)
                    .style("font-family", finalDimLabelStyle.font_family)
                    .style("font-size", finalDimLabelStyle.font_size)
                    .style("font-weight", finalDimLabelStyle.font_weight)
                    .style("fill", dimLabelColor);

                dimLabelLines.forEach((line, i) => {
                    dimTextElement.append("tspan")
                        .attr("x", dimLabelX) // X is set per tspan for consistent alignment
                        .attr("dy", i === 0 ? 0 : dimLabelLineHeight)
                        .text(line);
                });

                // --- Value 1 Label (Percentage) Processing ---
                const value1LabelStyle = typography.label; // Assuming value1 uses standard label typography
                const value1LabelWidth = getTextWidth(value1Text, value1LabelStyle);
                
                let value1LabelX, value1LabelColor, value1LabelAnchor;
                let value1LabelEndPos;

                // Check if dimension label is effectively inside the bar for positioning value1
                const isDimLabelInsideBar = (dimLabelX === labelPaddingInside);

                if (isDimLabelInsideBar) { 
                    if (barWidthValue >= dimLabelEndPosX + labelPadding + value1LabelWidth + labelPaddingInside) {
                        value1LabelX = barWidthValue - labelPaddingInside;
                        value1LabelColor = "#FFFFFF";
                        value1LabelAnchor = "end";
                        value1LabelEndPos = barWidthValue;
                    } else { 
                        value1LabelX = barWidthValue + labelPadding;
                        value1LabelColor = colors.text_color;
                        value1LabelAnchor = "start";
                        value1LabelEndPos = value1LabelX + value1LabelWidth;
                    }
                } else { 
                    value1LabelX = dimLabelEndPosX + labelPadding; 
                    value1LabelColor = colors.text_color;
                    value1LabelAnchor = "start";
                    value1LabelEndPos = value1LabelX + value1LabelWidth;
                }
                
                // Render Value 1 Label
                g.append("text")
                    .attr("x", value1LabelX)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", value1LabelAnchor)
                    .style("font-family", value1LabelStyle.font_family)
                    .style("font-size", value1LabelStyle.font_size)
                    .style("font-weight", value1LabelStyle.font_weight)
                    .style("fill", value1LabelColor)
                    .text(value1Text);
                    
                // 4. 添加圆形数值标签 (Value 2)
                const circleRadius = radiusScale(+dataPoint[valueField2]);
                // 圆心X坐标在右侧列的中心
                const circleX = barChartWidth + circleChartWidth / 2; 
                let value2LabelX, value2LabelY, value2LabelColor, value2LabelAnchor, value2LabelDy;
                const value2LabelWidth = getTextWidth(value2Text, typography.label); // Re-measure for value2
    
                // 判断文本宽度是否小于圆的直径 (留一些边距)
                if (circleRadius * 2 > value2LabelWidth + labelPadding * 2) {
                     // 空间足够，文本放在圆内，白色
                    value2LabelX = circleX;
                    value2LabelY = centerY;
                    value2LabelColor = "#FFFFFF";
                    value2LabelAnchor = "middle";
                    value2LabelDy = "0.35em"; // 垂直居中
                } else {
                     // 空间不足，文本放在圆上方，与圆相同颜色
                    value2LabelX = circleX;
                    value2LabelY = centerY - circleRadius - labelPadding; // 圆顶上方加一点间距
                    value2LabelColor = getBarColor(dimension); // 使用圆的颜色
                    value2LabelAnchor = "middle";
                    value2LabelDy = "0em"; // 基线对齐
                     // 如果标签放在上方后低于图表顶部标题线，则尝试放在下方
                    if (value2LabelY - (parseFloat(typography.label.font_size)/2) < -(margin.top - decorativeLineY -10) ){ // -margin.top是g元素的顶部，decorativeLineY是线的位置
                         value2LabelY = centerY + circleRadius + labelPadding + parseFloat(typography.label.font_size); // 圆底下方加间距和字体高度
                         value2LabelDy = "0.8em"; // 调整基线使文本看起来在圆下方
                    }
                }
    
                g.append("text")
                    .attr("x", value2LabelX)
                    .attr("y", value2LabelY)
                    .attr("dy", value2LabelDy)
                    .attr("text-anchor", value2LabelAnchor)
                    .style("font-family", typography.label.font_family)
                    .style("font-size", typography.label.font_size)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", value2LabelColor)
                    .text(value2Text);
    
                // 5. 添加连接线 - 从条形图（或标签）到圆形
                const lineColor = getBarColor(dimension); // 线条颜色与条形/圆形一致
                
                // 确定线的起始X坐标：应在数值1标签的右侧结束位置之后
                const lineStartX = value1LabelEndPos + labelPadding;
    
                // 计算线的终点X坐标（圆的左边缘）
                const lineEndX = circleX - circleRadius;
                
                // 只有当起始点在结束点左侧时才绘制线
                if (lineStartX < lineEndX - 1) { // 减1避免绘制极短的线
                    // 绘制连接线
                    g.append("line")
                        .attr("x1", lineStartX)
                        .attr("y1", centerY)
                        .attr("x2", lineEndX)
                        .attr("y2", centerY)
                        .attr("stroke", lineColor)
                        .attr("stroke-width", 0.8); // 线条粗细
                }
                
            } catch (error) {
                console.error(`Error rendering chart element for ${dimension}:`, error);
                // 继续处理下一个元素，而不是停止整个图表渲染
            }
        });
        
        // 返回SVG节点
        return svg.node();
    }