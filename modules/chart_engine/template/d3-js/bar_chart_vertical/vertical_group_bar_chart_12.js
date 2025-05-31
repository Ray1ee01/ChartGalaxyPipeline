/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Group Bar Chart",
    "chart_name": "vertical_group_bar_chart_12",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
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

// 垂直分组条形图实现 - 带有图标和数值标签
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
    
    // *** 添加: 定义斜线纹理模式 ***
    const patternDensity = 6; // 固定斜线密度
    const patternStrokeWidth = 1.5; // 固定斜线宽度
    const groups = [leftBarGroup, rightBarGroup]; // 使用之前确定的分组名称
    const defaultColors = ["#4269d0", "#ff725c"]; // 默认颜色

    groups.forEach((group, i) => {
        // 为每个组获取颜色
        const groupColor = colors.field && colors.field[group] ? 
                         colors.field[group] : 
                         defaultColors[i % defaultColors.length]; // 使用预设的默认颜色
        
        // 创建斜线纹理模式
        const patternId = `pattern-${i === 0 ? 'left' : 'right'}`; // 使用 'left'/'right' 作为 ID 一部分
        const pattern = defs.append("pattern")
            .attr("id", patternId)
            .attr("patternUnits", "userSpaceOnUse")
            .attr("width", patternDensity) 
            .attr("height", patternDensity) 
            .attr("patternTransform", "rotate(45)");
        
        // 添加背景矩形
        pattern.append("rect")
            .attr("width", patternDensity)
            .attr("height", patternDensity) 
            .attr("fill", groupColor)
            .attr("opacity", 0.8); // 设置背景透明度
        
        // 添加斜线
        pattern.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", patternDensity) 
            .attr("stroke", "white") // 斜线颜色
            .attr("stroke-width", patternStrokeWidth) 
            .attr("opacity", 0.6); // 斜线透明度
    });
    // *** 结束添加纹理 ***
    
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
    
    // 创建格式化函数
    const formatValue = (value) => `${value}${yUnit}`;
    
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
    
    // *** 修改: 计算图例起始 X 坐标以实现右对齐 ***
    const legendStartX = width - margin.right - totalLegendWidth; // 将图例右边缘对齐到图表右边缘
    const legendY = 50; // 保持 Y 坐标不变 (或者根据需要调整)

    // 创建图例组
    const legend = svg.append("g")
        .attr("class", "legend")
        // *** 修改: 使用新的 legendStartX ***
        .attr("transform", `translate(${legendStartX}, ${legendY})`);
    
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
        
        // --- Variables to track label/bar positions for icon placement ---
        let minBarTopY = innerHeight;
        let minExternalLabelTopY = innerHeight;
        let leftLabelIsOutside = false; // Track label position
        let rightLabelIsOutside = false;
        // -------------------------------------------------------------

        if (leftBarData) {
            leftValue = leftBarData[yField];
            leftBarHeight = innerHeight - yScale(leftValue);
            leftBarY = yScale(leftValue);
            minBarTopY = Math.min(minBarTopY, leftBarY);
            
            // 绘制左侧柱子
            chart.append("rect")
                .attr("class", "bar left-bar")
                .attr("x", leftBarX)
                .attr("y", leftBarY)
                .attr("width", barWidth)
                .attr("height", leftBarHeight)
                .attr("fill", "url(#pattern-left)")
                .attr("rx", barWidth/2)
                .attr("ry", barWidth/2)
                .attr("stroke", variables.has_stroke ? "#555" : "none")
                .attr("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            
            // 绘制左侧柱子顶部的标签
            const leftValueText = formatValue(leftValue) + (yUnit ? ` ${yUnit}` : '');
            let leftLabelFontSize = valueFontSize; // Start with calculated size
            const tempLeftValueText = chart.append("text").style("visibility", "hidden").style("font-family", typography.label.font_family).style("font-size", `${leftLabelFontSize}px`).style("font-weight", "bold").text(leftValueText);
            let leftTextWidth = tempLeftValueText.node().getBBox().width;
            const maxLabelWidth = barWidth * 1.1;
            if (leftTextWidth > maxLabelWidth) {
                leftLabelFontSize = Math.max(4, leftLabelFontSize * (maxLabelWidth / leftTextWidth));
            }
            tempLeftValueText.remove();

            // *** 修改: 判断标签是否能放入 Bar 内 ***
            const labelHeightRequired = leftLabelFontSize + 10; // 字体高度 + 上下 padding
            let leftLabelY, leftLabelColor, leftDominantBaseline = "auto"; // Default baseline
            
            if (leftBarHeight > labelHeightRequired) {
                // --- 放内部 ---
                leftLabelY = leftBarY + 5; // 顶部向下一点
                leftLabelColor = "#ffffff";
                leftDominantBaseline = "hanging"; // 锚定到顶部
                leftLabelIsOutside = false;
            } else {
                // --- 放外部 ---
                leftLabelY = leftBarY - 5; // 柱子顶部向上一点
                leftLabelColor = colors.text_color || "#333333";
                // leftDominantBaseline remains 'auto' (middle-ish)
                minExternalLabelTopY = Math.min(minExternalLabelTopY, leftLabelY - leftLabelFontSize); // Update highest point if label is outside
                leftLabelIsOutside = true;
            }

            chart.append("text")
                .attr("class", "bar-label left-label")
                .attr("x", leftBarX + barWidth / 2)
                .attr("y", leftLabelY) // 使用计算的 Y
                .attr("dominant-baseline", leftDominantBaseline) // 设置 baseline
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${leftLabelFontSize}px`) 
                .style("font-weight", "bold")
                .style("fill", leftLabelColor) // 使用计算的颜色
                .text(leftValueText);
        } else {
             leftValue = 0;
             leftBarHeight = 0;
             leftBarY = innerHeight;
        }
        
        const rightBarX = leftBarX + barWidth + xScale.bandwidth() * 0.1;
        let rightBarY, rightBarHeight, rightValue;

        if (rightBarData) {
            rightValue = rightBarData[yField];
            rightBarHeight = innerHeight - yScale(rightValue);
            rightBarY = yScale(rightValue);
            minBarTopY = Math.min(minBarTopY, rightBarY);
            
            // 绘制右侧柱子
            chart.append("rect")
                .attr("class", "bar right-bar")
                .attr("x", rightBarX)
                .attr("y", rightBarY)
                .attr("width", barWidth)
                .attr("height", rightBarHeight)
                .attr("fill", "url(#pattern-right)")
                .attr("rx", barWidth/2)
                .attr("ry", barWidth/2)
                .attr("stroke", variables.has_stroke ? "#555" : "none")
                .attr("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            
            // 绘制右侧柱子顶部的标签
            const rightValueText = formatValue(rightValue) + (yUnit ? ` ${yUnit}` : '');
            let rightLabelFontSize = valueFontSize; // Start with calculated size
            const tempRightValueText = chart.append("text").style("visibility", "hidden").style("font-family", typography.label.font_family).style("font-size", `${rightLabelFontSize}px`).style("font-weight", "bold").text(rightValueText);
            let rightTextWidth = tempRightValueText.node().getBBox().width;
            const rightMaxLabelWidth = barWidth * 1.1;
            if (rightTextWidth > rightMaxLabelWidth) {
                rightLabelFontSize = Math.max(4, rightLabelFontSize * (rightMaxLabelWidth / rightTextWidth));
            }
            tempRightValueText.remove();

            // *** 修改: 判断标签是否能放入 Bar 内 ***
            const rightLabelHeightRequired = rightLabelFontSize + 10; // 字体高度 + 上下 padding
            let rightLabelY, rightLabelColor, rightDominantBaseline = "auto";
            
            if (rightBarHeight > rightLabelHeightRequired) {
                // --- 放内部 ---
                rightLabelY = rightBarY + 5;
                rightLabelColor = "#ffffff";
                rightDominantBaseline = "hanging";
                rightLabelIsOutside = false;
            } else {
                // --- 放外部 ---
                rightLabelY = rightBarY - 5;
                rightLabelColor = colors.text_color || "#333333";
                minExternalLabelTopY = Math.min(minExternalLabelTopY, rightLabelY - rightLabelFontSize);
                rightLabelIsOutside = true;
            }

            chart.append("text")
                .attr("class", "bar-label right-label")
                .attr("x", rightBarX + barWidth / 2)
                .attr("y", rightLabelY) // 使用计算的 Y
                .attr("dominant-baseline", rightDominantBaseline) // 设置 baseline
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${rightLabelFontSize}px`) 
                .style("font-weight", "bold")
                .style("fill", rightLabelColor) // 使用计算的颜色
                .text(rightValueText);
        } else {
             rightValue = 0;
             rightBarHeight = 0;
             rightBarY = innerHeight;
        }
        
        // --- 图标绘制逻辑 --- 
        const iconMargin = 5; // 图标与上方元素的间距
        const iconSize = 30;  // 保持图标大小
        
        // 确定图标需要放置的最高点 (取 bar 顶部和外部标签顶部的最小值)
        const placementRefY = Math.min(minBarTopY, minExternalLabelTopY);
        
        // 计算图标 Y 坐标 (使其位于最高点上方)
        const iconY = placementRefY - iconMargin - iconSize / 2 - 10; 

        // 获取图标 URL (假设 xValue 对应图标)
        if (images.field && images.field[xValue]) {
            const iconX = xScale(xValue) + xScale.bandwidth() / 2; // 中心 X

            chart.append("image")
                .attr("class", "category-icon-above") // 新类名?
                .attr("x", iconX - iconSize / 2)
                .attr("y", iconY) // 使用计算出的 Y 坐标
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", images.field[xValue]);
        }
        // --- 结束图标绘制逻辑 ---

    }); // --- END xValues.forEach ---

    // 返回SVG节点
    return svg.node();
}