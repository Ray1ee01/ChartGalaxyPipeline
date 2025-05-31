/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Lollipop Chart",
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
    }
    
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
        return Math.max(8, Math.floor(baseSize * (maxWidth / textWidth)));
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
        const formattedValue = formatValue(d[valueField]) + (valueUnit ? ` ${valueUnit}` : '');
            
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
    
    // 找出最长的x轴标签文本
    const longestLabel = sortedDimensions.reduce((a, b) => 
        a.toString().length > b.toString().length ? a : b, "").toString();

    // 定义每个标签的最大允许宽度
    const labelMaxWidth = xScale.bandwidth() * 1.5;

    // 计算统一字体大小
    const baseFontSize = parseInt(typography.label.font_size) || 14;
    const uniformFontSize = calculateFontSize(longestLabel, labelMaxWidth, baseFontSize);
    
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
        const textLabel = g.append("text")
            .attr("x", x + columnWidth / 2)
            .attr("y", innerHeight + 20)
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${uniformFontSize}px`) // 使用计算出的统一字体大小
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color);
            
        // 检查是否需要文本换行
        if (dimLabelWidths[dimension] > labelMaxWidth) {
            wrapText(textLabel, dimension, labelMaxWidth, 1.1, 'top');
        } else {
            textLabel.text(dimension);
        }
        
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
        const formattedValue = formatValue(value) + (valueUnit ? ` ${valueUnit}` : '');
        
        // 计算数值标签的最大宽度
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
        const labelPadding = iconRadius * 0.3; // 图标顶部与文本底部之间的间距
        const labelY = iconTop - labelPadding; // 文本基线位置
        
        const valueTextLabel = g.append("text")
            .attr("class", "value-label")
            .attr("x", circleX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", `${valueFontSize}px`)
            .style("font-weight", typography.annotation.font_weight)
            .style("fill", colors.text_color);
            
        // 放宽换行条件：如果文本宽度超出最大宽度(即使字体不是最小)，也应用换行
        if (valueTextWidth > valueLabelMaxWidth) {
            // 清除当前文本
            valueTextLabel.text(null);
            
            // 应用换行处理函数
            const words = formattedValue.split(/\s+/);
            // 如果只有一个词，考虑字符级拆分
            if (words.length <= 1) {
                const chars = formattedValue.split('');
                let line = '';
                let lines = [];
                
                // 逐字构建行，确保不超过最大宽度
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
                
                // 添加最后一行
                if (line.length > 0) {
                    lines.push(line);
                }
                
                // 计算所有行所需的总高度
                const lineHeight = valueFontSize * 1.2; // 行高
                const totalHeight = lineHeight * lines.length;
                
                // 计算第一行的垂直位置，使最后一行恰好位于圆形图标上方
                const firstLineY = labelY - (totalHeight - lineHeight);
                
                // 创建所有行
                lines.forEach((lineText, i) => {
                    valueTextLabel.append("tspan")
                        .attr("x", circleX)
                        .attr("y", firstLineY)
                        .attr("dy", `${i * 1.2}em`) // 使用行高系数
                        .text(lineText);
                });
            } else {
                // 有多个单词时，按单词换行
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
                
                // 添加最后一行
                if (line.length > 0) {
                    lines.push(line.join(' '));
                }
                
                // 计算所有行所需的总高度
                const lineHeight = valueFontSize * 1.2; // 行高
                const totalHeight = lineHeight * lines.length;
                
                // 计算第一行的垂直位置，使最后一行恰好位于圆形图标上方
                const firstLineY = labelY - (totalHeight - lineHeight);
                
                // 创建所有行
                lines.forEach((lineText, i) => {
                    valueTextLabel.append("tspan")
                        .attr("x", circleX)
                        .attr("y", firstLineY)
                        .attr("dy", `${i * 1.2}em`)
                        .text(lineText);
                });
            }
        } else {
            // 单行文本直接显示
            valueTextLabel.text(formattedValue);
        }
    });
    
    // ---------- 12. 辅助函数 ----------
    
    // 增强的文本换行函数
    function wrapText(text, str, width, lineHeight = 1.1, alignment = 'middle') {
        const words = str.split(/\s+/).reverse(); // 按空格分割单词
        let word;
        let line = [];
        let lineNumber = 0;
        const initialY = parseFloat(text.attr("y")); // 获取原始y坐标
        const initialX = parseFloat(text.attr("x")); // 获取原始x坐标
        const actualFontSize = parseFloat(text.style("font-size")); // 获取实际应用的字体大小

        text.text(null); // 清空现有文本

        let tspans = []; // 存储最终要渲染的行

        // 优先按单词换行
        if (words.length > 1) {
            let currentLine = [];
            while (word = words.pop()) {
                currentLine.push(word);
                const tempTspan = text.append("tspan").text(currentLine.join(" ")); // 创建临时tspan测试宽度
                const isOverflow = tempTspan.node().getComputedTextLength() > width;
                tempTspan.remove(); // 移除临时tspan

                if (isOverflow && currentLine.length > 1) {
                    currentLine.pop(); // 回退一个词
                    tspans.push(currentLine.join(" ")); // 添加完成的行
                    currentLine = [word]; // 新行以当前词开始
                    lineNumber++;
                }
            }
            // 添加最后一行
            if (currentLine.length > 0) {
                tspans.push(currentLine.join(" "));
            }
        } else { // 如果没有空格或只有一个词，则按字符换行
            const chars = str.split('');
            let currentLine = '';
            for (let i = 0; i < chars.length; i++) {
                const nextLine = currentLine + chars[i];
                const tempTspan = text.append("tspan").text(nextLine); // 测试宽度
                const isOverflow = tempTspan.node().getComputedTextLength() > width;
                tempTspan.remove();

                if (isOverflow && currentLine.length > 0) { // 如果加了新字符就超长了，并且当前行不为空
                    tspans.push(currentLine); // 添加当前行
                    currentLine = chars[i]; // 新行从这个字符开始
                    lineNumber++;
                } else {
                    currentLine = nextLine; // 没超长就继续加字符
                }
            }
            // 添加最后一行
            if (currentLine.length > 0) {
                tspans.push(currentLine);
            }
        }

        // 计算总行数
        const totalLines = tspans.length;
        let startDy = 0;
        
        // 根据对齐方式计算起始偏移
        if (alignment === 'middle') {
             // 垂直居中：向上移动半行*(总行数-1)
            startDy = -( (totalLines - 1) * lineHeight / 2);
        } else if (alignment === 'bottom') {
            // 底部对齐：计算总高度，向上移动 总高度 - 单行高度(近似)
            const totalHeightEm = totalLines * lineHeight;
            startDy = -(totalHeightEm - lineHeight); // 将底部对齐到原始y
        }
        // 如果是 'top' 对齐，startDy 保持为 0，即第一行基线在原始y位置

        // 创建所有行的tspan元素
        tspans.forEach((lineText, i) => {
            text.append("tspan")
                .attr("x", initialX) // x坐标与父<text>相同
                .attr("dy", (i === 0 ? startDy : lineHeight) + "em") // 第一行应用起始偏移，后续行应用行高
                .text(lineText);
        });
    }
    
    // 返回SVG节点
    return svg.node();
}