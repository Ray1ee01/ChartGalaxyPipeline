/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Group Bar Chart",
    "chart_name": "vertical_group_bar_plain_chart_03",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 垂直分组条形图实现   Vertical Grouped Bar Chart  plain chart#3  bar顶端三角
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    // 提取数据和配置
    const jsonData = data;                          
    const chartData = jsonData.data.data || [];          
    const variables = jsonData.variables || {};     
    const typography = jsonData.typography || {     
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333", 
        field: {},
        other: { 
            primary: "#4682B4" // 默认主色调
        } 
    };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];
    
    // 如果不存在，添加副标题字段
    typography.subtitle = typography.subtitle || typography.description;
    
    // 设置视觉效果变量
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 清除容器
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
    // 设置图表尺寸和边距
    const width = variables.width || 800;
    const height = variables.height || 500;
    
    // 边距：上，右，下，左
    const margin = { 
        top: 100,    // 标题和标签的空间
        right: 30,  // 右侧标签的空间
        bottom: 80, // x轴和标签的空间
        left: 30    // y轴和标签的空间
    };
    
    // 计算实际绘图区域大小
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 3. 提取字段名称和单位 ----------
    let xField, yField, groupField;
    let xUnit = "", yUnit = "";
    
    // 安全提取字段名称
    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const groupColumn = dataColumns.find(col => col.role === "group");
    
    if (xColumn) xField = xColumn.name;
    if (yColumn) yField = yColumn.name;
    if (groupColumn) groupField = groupColumn.name;
    
    // 获取字段单位
    xUnit = xColumn?.unit === "none" ? "" : (xColumn?.unit || "");
    yUnit = yColumn?.unit === "none" ? "" : (yColumn?.unit || "");
    
    // ---------- 4. 数据处理 ----------
    // 使用提供的数据
    let useData = chartData;
    
    // 获取x轴和分组的唯一值
    const xValues = [...new Set(useData.map(d => d[xField]))];
    let groupValues = [...new Set(useData.map(d => d[groupField]))];
    
    // 如果组的数量不符合要求，给出警告
    if (groupValues.length !== 2) {
        console.warn("此图表需要恰好2个组字段");
    }
    
    // 第一个组是左侧柱子，第二个组是右侧柱子
    const leftBarGroup = groupValues[0];
    const rightBarGroup = groupValues[1];
    
    // ---------- 5. 创建SVG容器 ----------
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // ---------- 6. 创建视觉效果 ----------
    const defs = svg.append("defs");
    
    // 如果需要，创建阴影滤镜
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
    
    // ---------- 7. 创建图表区域 ----------
    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 8. 创建比例尺 ----------
    // X比例尺（分类）用于主分类
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.2);
    
    // 分组比例尺，用于每个类别内的细分
    const groupScale = d3.scaleBand()
        .domain([0, 1]) // 只有两个柱子，左侧和右侧
        .range([0, xScale.bandwidth()])
        .padding(0.2); // 同一维度柱子之间的间隙，增加间隔
    
    // Y比例尺（数值）- 直接使用最大值映射到可用高度
    const dataMax = d3.max(useData, d => +d[yField]) || 100;
    const yScale = d3.scaleLinear()
        .domain([0, dataMax])
        .range([innerHeight, 0]);
    
    // ---------- 9. 文本宽度计算和字体大小调整 (移动到这里，在绘制坐标轴之前) ----------
    // 使用临时文本元素计算标签宽度
    const tempText = svg.append("text")
        .style("opacity", 0)
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", "bold"); // 数值标签使用粗体
    
    // 数值标签的可用宽度 = bar宽度 + 间距
    const barWidth = groupScale.bandwidth();
    const valueSpacing = xScale.bandwidth() * 0.1;
    const valueLabelAvailableWidth = barWidth; // 每个值标签只能占据其柱子的宽度
    
    // 维度标签的可用宽度 = 两个bar宽度 + bar间距
    const dimensionLabelAvailableWidth = xScale.bandwidth();
    
    // 计算最长的数值标签和维度标签
    let maxValueLabelWidth = 0;
    let maxDimensionLabelWidth = 0;
    
    // 计算所有数值标签的最大宽度
    useData.forEach(d => {
        tempText.text(formatValue(d[yField]) + (yUnit ? ` ${yUnit}` : ''));
        const textWidth = tempText.node().getComputedTextLength();
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });
    
    // 计算所有维度标签的最大宽度
    xValues.forEach(xValue => {
        tempText.text(xValue);
        const textWidth = tempText.node().getComputedTextLength();
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, textWidth);
    });
    
    // 删除临时文本元素
    tempText.remove();
    
    // 计算需要的字体缩放比例
    const valueFontScale = Math.min(1, valueLabelAvailableWidth / maxValueLabelWidth);
    const dimensionFontScale = Math.min(1, dimensionLabelAvailableWidth / maxDimensionLabelWidth);
    
    // 计算实际使用的字体大小
    const valueFontSize = Math.max(8, parseInt(typography.label.font_size) * valueFontScale); // 最小字体8px
    const dimensionFontSize = Math.max(8, parseInt(typography.label.font_size) * dimensionFontScale);
    
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
    
    // ---------- 10. 创建坐标轴 (原来的第9步) ----------
    // 底部的X轴（仅一条长线）
    chart.append("line")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    
    // 创建x轴组，用于添加刻度标签
    const xAxisGroup = chart.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);
    
    // 第一步：找出最长的标签并计算统一的字体大小
    let maxLabelLength = 0;
    const allLabels = xValues.map(d => d.toString());
    
    // 找出最长的标签
    const longestLabel = allLabels.reduce((a, b) => a.length > b.length ? a : b, "");
    
    // 使用最长标签计算合适的统一字体大小
    const labelMaxWidth = xScale.bandwidth()*1.3;
    const uniformFontSize = calculateFontSize(longestLabel, labelMaxWidth, parseInt(typography.label.font_size));
    
    // 绘制x轴标签
    xAxisGroup.selectAll(".x-label")
        .data(xValues)
        .enter()
        .append("text")
        .attr("class", "x-label")
        .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .style("font-family", typography.label.font_family)
        .style("font-size", `${uniformFontSize}px`) // 应用统一的字体大小
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(d => d)
        .each(function(d) {
            const text = d3.select(this);
            
            // 检查使用统一字体大小后，文本是否仍然超过可用宽度
            if (this.getComputedTextLength() > labelMaxWidth) {
                // 如果仍然太长，应用文本换行
                wrapText(text, d.toString(), labelMaxWidth, 1.1);
            }
        });
    
    // 文本换行助手函数
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
    
    // ---------- 11. 绘制图例 (原来的第10步) ----------
    // 创建临时文本元素计算文本宽度
    const tempText1 = svg.append("text")
        .style("opacity", 0)
        .style("font-family", typography.label.font_family)
        .style("font-size", "12px")
        .style("font-weight", typography.label.font_weight);
    
    // 图例数据
    const legendData = [
        { key: leftBarGroup, color: colors.field[leftBarGroup] || "#4269d0" }, 
        { key: rightBarGroup, color: colors.field[rightBarGroup] || "#ff725c" } 
    ];
    
    // 计算每个图例项的宽度
    const legendItemWidths = legendData.map(item => {
        tempText1.text(item.key);
        return tempText1.node().getComputedTextLength() + 25; // 文本长度 + 方块(15) + 间距(10)
    });
    
    // 计算图例总宽度，包括图例项之间的间距
    const legendSpacing = 20;
    const totalLegendWidth = legendItemWidths.reduce((sum, width) => sum + width, 0) 
                            + (legendItemWidths.length - 1) * legendSpacing;
    
    // 移除临时文本元素
    tempText1.remove();
    
    // 创建图例并居中放置
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(width - totalLegendWidth) / 2}, 30)`);
    
    // 为每个组添加一个图例项，使用计算好的宽度
    let legendOffset = 0;
    legendData.forEach((item, i) => {
        const legendItem = legend.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${legendOffset}, 0)`);
        
        // 图例颜色方块
        legendItem.append("rect")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", item.color)
            .attr("rx", variables.has_rounded_corners ? 2 : 0)
            .attr("ry", variables.has_rounded_corners ? 2 : 0);
        
        // 图例文本
        legendItem.append("text")
            .attr("x", 20)
            .attr("y", 7.5)
            .attr("dy", "0.35em")
            .style("font-family", typography.label.font_family)
            .style("font-size", "12px")
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(item.key);
        
        // 累加偏移量，为下一个图例项做准备
        legendOffset += legendItemWidths[i] + legendSpacing;
    });
    
    // 计算图标大小 - 基于柱子宽度，但不受圆形限制
    const iconSize = Math.min(barWidth * 0.8, 30); // 图标大小为柱子宽度的80%，最大30px
    
    // 使用setTimeout确保DOM更新完成，从而获取精确的标签边界框
    setTimeout(() => {
        // 精确计算维度标签的最下方位置并绘制图标
        let actualMaxLabelBottomY = Number.NEGATIVE_INFINITY;
        
        const xLabels = chart.selectAll(".x-label").nodes(); // 获取DOM节点数组
        if (xLabels.length > 0) {
            xLabels.forEach(labelNode => {
                try {
                    const bbox = labelNode.getBBox();
                    // bbox.y是相对于父元素xAxisGroup的，xAxisGroup已经向下平移了innerHeight
                    // 所以，标签的绝对底部Y坐标 = innerHeight + bbox.y + bbox.height
                    const absoluteLabelBottom = innerHeight + bbox.y + bbox.height;
                    actualMaxLabelBottomY = Math.max(actualMaxLabelBottomY, absoluteLabelBottom);
                } catch (e) {
                    console.warn("无法获取标签边界框:", e);
                }
            });
        } else {
            // 如果没有标签，提供一个默认的回退位置
            actualMaxLabelBottomY = innerHeight + 20; // 默认在x轴下方20px
        }
        
        // 如果由于某种原因actualMaxLabelBottomY仍然是NEGATIVE_INFINITY，则使用默认值
        if (actualMaxLabelBottomY === Number.NEGATIVE_INFINITY) {
            actualMaxLabelBottomY = innerHeight + 20;
        }

        // 图标顶部的Y位置 = 计算出的标签最下方 + 5px间距
        const iconTopY = actualMaxLabelBottomY + 5;
        
        // 绘制所有图标
        xValues.forEach(xValue => {
            if (images.field && images.field[xValue]) {
                const iconX = xScale(xValue) + xScale.bandwidth() / 2;
                chart.append("image")
                    .attr("class", "category-icon")
                    .attr("x", iconX - iconSize / 2)
                    .attr("y", iconTopY) // 图标的顶部Y坐标
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", images.field[xValue]);
            }
        });
    }, 0);
    
    // 绘制条形图和标签
    xValues.forEach(xValue => {
        // 获取当前x类别的数据
        const xData = useData.filter(d => d[xField] === xValue);
        
        // 获取左侧柱子的数据
        const leftBarData = xData.find(d => d[groupField] === leftBarGroup);
        
        // 获取右侧柱子的数据
        const rightBarData = xData.find(d => d[groupField] === rightBarGroup);
        
        // 计算左侧柱子的位置和高度
        const leftBarX = xScale(xValue);
        let leftBarY, leftBarHeight, leftValue;
        
        if (leftBarData) {
            leftValue = leftBarData[yField];
            leftBarHeight = innerHeight - yScale(leftValue);
            leftBarY = yScale(leftValue);
            
            // 绘制左侧柱子 - 改为path以添加三角形顶部
            // 如果高度为0，跳过绘制
            if (leftBarHeight > 0) {
                // 三角形的高度，设置为条形图宽度，但最小10px，最大30px
                const leftTriangleHeight = Math.min(30, Math.max(10, barWidth));
                // 确保三角形高度不超过总高度
                const leftActualTriangleHeight = Math.min(leftTriangleHeight, leftBarHeight);
                
                chart.append("path")
                    .attr("class", "bar left-bar")
                    .attr("d", () => {
                        // 构建路径 - 从左下角开始
                        let path = `M ${leftBarX} ${innerHeight}`;
                        // 到左上角（矩形顶部）
                        path += ` L ${leftBarX} ${leftBarY + leftActualTriangleHeight}`;
                        // 到三角形左侧点
                        path += ` L ${leftBarX} ${leftBarY + leftActualTriangleHeight}`;
                        // 到三角形顶点
                        path += ` L ${leftBarX + barWidth / 2} ${leftBarY}`;
                        // 到三角形右侧点
                        path += ` L ${leftBarX + barWidth} ${leftBarY + leftActualTriangleHeight}`;
                        // 到右上角（矩形顶部）
                        path += ` L ${leftBarX + barWidth} ${leftBarY + leftActualTriangleHeight}`;
                        // 到右下角
                        path += ` L ${leftBarX + barWidth} ${innerHeight}`;
                        // 闭合路径
                        path += ` Z`;
                        return path;
                    })
                    .attr("fill", colors.field[leftBarGroup] || "#4269d0")
                    .attr("stroke", variables.has_stroke ? "#555" : "none")
                    .attr("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            }
            
            // 绘制左侧柱子顶部的标签
            // 首先计算标签文本宽度并调整字体大小
            const leftValueText = formatValue(leftValue) + (yUnit ? ` ${yUnit}` : '');
            let leftLabelFontSize = valueFontSize; // 默认使用之前计算的字体大小
            
            // 创建临时文本元素测量宽度
            const tempLeftValueText = chart.append("text")
                .style("visibility", "hidden")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${leftLabelFontSize}px`)
                .style("font-weight", "bold")
                .text(leftValueText);
            
            // 计算文本宽度
            let leftTextWidth = tempLeftValueText.node().getBBox().width;
            // 最大允许宽度为柱子宽度的1.1倍
            const maxLabelWidth = barWidth * 1.1;
            
            // 如果文本宽度超过允许值，动态缩小字体
            if (leftTextWidth > maxLabelWidth) {
                // 按比例计算新字体大小
                leftLabelFontSize = Math.max(4, leftLabelFontSize * (maxLabelWidth / leftTextWidth));
                // 更新临时文本以验证新尺寸
                tempLeftValueText.style("font-size", `${leftLabelFontSize}px`);
                leftTextWidth = tempLeftValueText.node().getBBox().width;
            }
            
            // 移除临时文本
            tempLeftValueText.remove();
            
            // 使用调整后的字体大小绘制标签
            chart.append("text")
                .attr("class", "bar-label")
                .attr("x", leftBarX + barWidth / 2)
                .attr("y", leftBarY - 5)
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${leftLabelFontSize}px`) // 使用动态调整的字体大小
                .style("font-weight", "bold")
                .style("fill", colors.text_color)
                .text(leftValueText);
        }
        
        // 计算右侧柱子的位置和高度
        // 使用groupScale正确计算右侧柱子的位置，确保两个柱子之间有间距
        const rightBarX = leftBarX + barWidth + xScale.bandwidth() * 0.1; // 添加额外间距为柱子宽度的10%
        let rightBarY, rightBarHeight, rightValue;
        
        if (rightBarData) {
            rightValue = rightBarData[yField];
            rightBarHeight = innerHeight - yScale(rightValue);
            rightBarY = yScale(rightValue);
            
            // 绘制右侧柱子 - 改为path以添加三角形顶部
            // 如果高度为0，跳过绘制
            if (rightBarHeight > 0) {
                // 三角形的高度，设置为条形图宽度，但最小10px，最大30px
                const rightTriangleHeight = Math.min(30, Math.max(10, barWidth));
                // 确保三角形高度不超过总高度
                const rightActualTriangleHeight = Math.min(rightTriangleHeight, rightBarHeight);
                
                chart.append("path")
                    .attr("class", "bar right-bar")
                    .attr("d", () => {
                        // 构建路径 - 从左下角开始
                        let path = `M ${rightBarX} ${innerHeight}`;
                        // 到左上角（矩形顶部）
                        path += ` L ${rightBarX} ${rightBarY + rightActualTriangleHeight}`;
                        // 到三角形左侧点
                        path += ` L ${rightBarX} ${rightBarY + rightActualTriangleHeight}`;
                        // 到三角形顶点
                        path += ` L ${rightBarX + barWidth / 2} ${rightBarY}`;
                        // 到三角形右侧点
                        path += ` L ${rightBarX + barWidth} ${rightBarY + rightActualTriangleHeight}`;
                        // 到右上角（矩形顶部）
                        path += ` L ${rightBarX + barWidth} ${rightBarY + rightActualTriangleHeight}`;
                        // 到右下角
                        path += ` L ${rightBarX + barWidth} ${innerHeight}`;
                        // 闭合路径
                        path += ` Z`;
                        return path;
                    })
                    .attr("fill", colors.field[rightBarGroup] || "#ff725c")
                    .attr("stroke", variables.has_stroke ? "#555" : "none")
                    .attr("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            }
            
            // 绘制右侧柱子顶部的标签
            // 首先计算标签文本宽度并调整字体大小
            const rightValueText = formatValue(rightValue) + (yUnit ? ` ${yUnit}` : '');
            let rightLabelFontSize = valueFontSize; // 默认使用之前计算的字体大小
            
            // 创建临时文本元素测量宽度
            const tempRightValueText = chart.append("text")
                .style("visibility", "hidden")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${rightLabelFontSize}px`)
                .style("font-weight", "bold")
                .text(rightValueText);
            
            // 计算文本宽度
            let rightTextWidth = tempRightValueText.node().getBBox().width;
            // 最大允许宽度为柱子宽度的1.1倍
            const rightMaxLabelWidth = barWidth * 1.1;
            
            // 如果文本宽度超过允许值，动态缩小字体
            if (rightTextWidth > rightMaxLabelWidth) {
                // 按比例计算新字体大小
                rightLabelFontSize = Math.max(4, rightLabelFontSize * (rightMaxLabelWidth / rightTextWidth));
                // 更新临时文本以验证新尺寸
                tempRightValueText.style("font-size", `${rightLabelFontSize}px`);
                rightTextWidth = tempRightValueText.node().getBBox().width;
            }
            
            // 移除临时文本
            tempRightValueText.remove();
            
            // 使用调整后的字体大小绘制标签
            chart.append("text")
                .attr("class", "bar-label")
                .attr("x", rightBarX + barWidth / 2)
                .attr("y", rightBarY - 5)
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${rightLabelFontSize}px`) // 使用动态调整的字体大小
                .style("font-weight", "bold")
                .style("fill", colors.text_color)
                .text(rightValueText);
        }
    });
    
    // 返回SVG节点
    return svg.node();
}