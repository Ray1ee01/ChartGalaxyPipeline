/*
REQUIREMENTS_BEGIN
{
    "chart_type": "vertical Bar Chart with Proportional Circles",
    "chart_name": "vertical_bar_proportional_circle_area_chart_02",
    "is_composite": true,
    "required_fields": [["x", "y"], ["x", "y2"]],
    "required_fields_type": [
        [["categorical"], ["numerical"]],
        [["categorical"], ["numerical"]]
    ],
    "required_fields_range": [
        [[2, 30], ["-inf", "inf"]],
        [[2, 30], [0, "inf"]]
    ],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary","secondary"],
    "supported_effects": ["radius_corner", "spacing"],
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

// 垂直条形图与比例圆复合图表实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------

    // 提取数据和配置
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "28px", font_weight: 700 },
        label: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        description: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: 400 }
    };
    const colors = jsonData.colors || {
        text_color: "#000000",
        background_color: "#FFFFFF",
        other: { primary: "#008080", secondary: "#FF0000" }, // 默认颜色: 蓝绿色和红色
        available_colors: ["#FFBF00"] // 默认: 黄色
    };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];

    // *** 添加: 创建用于文本测量的Canvas Context ***
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // *** 修改: 提前提取字段名和单位 ***
    const dimensionField = dataColumns.find(col => col.role === "x")?.name ;
    const valueField = dataColumns.find(col => col.role === "y")?.name ;
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name ;

    let valueUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" :
                      dataColumns.find(col => col.role === "y")?.unit || ""; // 默认为百分号
    let valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" :
                       dataColumns.find(col => col.role === "y2")?.unit || "";

    // 确保单位是字符串
    valueUnit = valueUnit || "";
    valueUnit2 = valueUnit2 || "";

    // 清空容器
    d3.select(containerSelector).html("");

    // ---------- 2. 尺寸和布局设置 ----------

    const width = variables.width || 800;
    const height = variables.height || 600;

    // 边距 - 需要足够空间给标签和条形图
    const margin = { top: 90, right: 50, bottom: 60, left: 50 }; // 增加底部边距给X轴标签和图标
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 定义中间灰色区域和标签区域的高度
    const centralBandHeight = innerHeight * 0.20; // 中间区域占20%高度
    
    const barAreaHeight = innerHeight - centralBandHeight ; // 上下条形图的总可用高度
    // *** 修改: 按正负最大值比例分配高度 ***
    const maxPositiveY = d3.max(chartData, d => Math.max(0, d[valueField])) || 0;
    const maxNegativeY = Math.abs(d3.min(chartData, d => Math.min(0, d[valueField])) || 0);
    const totalMagnitudeRange = maxPositiveY + maxNegativeY;

    let topBarAreaHeight;
    let bottomBarAreaHeight;

    if (totalMagnitudeRange > 0) {
        topBarAreaHeight = barAreaHeight * (maxPositiveY / totalMagnitudeRange);
        bottomBarAreaHeight = barAreaHeight * (maxNegativeY / totalMagnitudeRange);
    } else {
        // 如果所有值都为0，则平分高度
        topBarAreaHeight = barAreaHeight / 2;
        bottomBarAreaHeight = barAreaHeight / 2;
    }

    // 计算中间灰色区域的Y坐标 (现在依赖于 topBarAreaHeight)
    const centralBandTopY = margin.top + topBarAreaHeight;
    const centralBandBottomY = centralBandTopY + centralBandHeight;

    // 定义图标和标签尺寸
    const iconSize = 20;
    const iconMargin = 3; // 图标和标签之间的距离 (减小)
    const labelMargin = 3; // 圆圈和下方标签的距离 (减小)
    const circlePadding = 5; // 圆圈与其标签之间的内边距

    // *** 修改: 预定义基础字体大小 ***
    const baseFontSizeLabel = parseFloat(typography.label.font_size) || 14;
    const baseFontSizeAnnotation = parseFloat(typography.annotation.font_size) || 12;
    const minFontSize = 8;

    // *** 修改: 为中央区域内的元素计算Y坐标 ***
    const bandTopPadding = 5;
    const iconY = centralBandTopY + bandTopPadding + iconSize / 2;
    const dimensionLabelY = iconY + iconSize / 2 + iconMargin + baseFontSizeLabel / 2; // 在图标下方
    // 剩余空间给圆圈
    const circleAreaTopY = dimensionLabelY + baseFontSizeLabel / 2 + labelMargin;
    const circleAreaHeight = centralBandBottomY - circleAreaTopY - bandTopPadding;
    const circleY = circleAreaTopY + circleAreaHeight / 2;
    // 最大半径是可用高度的90%的一半
    const maxCircleRadiusAvailableBasedOnHeight = Math.max(0, (circleAreaHeight * 0.9) / 2);
    // *** 添加: 限制最大半径不超过bar宽度的一半 ***
    const maxRadiusFromBarWidth = innerWidth / 2;
    const maxCircleRadiusAvailable = Math.min(maxCircleRadiusAvailableBasedOnHeight, maxRadiusFromBarWidth);

    // ---------- 4. 数据处理 ----------

    // 转换数值类型
    chartData.forEach(d => {
        d[valueField] = +d[valueField];
        d[valueField2] = +d[valueField2];
    });

    // *** 修改: 按 y 值 (valueField) 降序排序数据 ***
    chartData.sort((a, b) => b[valueField] - a[valueField]);

    // 获取排序后的维度列表
    const dimensions = chartData.map(d => d[dimensionField]);

    // ---------- 5. 创建比例尺 ----------

    // X轴比例尺 (类别)
    const xScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerWidth])
        .padding(0.2); // 柱子之间的间距

    // *** 恢复: 使用独立的比例尺，但范围基于比例计算的高度 ***
    // 正值比例尺
    const yScalePositive = d3.scaleLinear()
        .domain([0, maxPositiveY === 0 ? 1 : maxPositiveY]) // 处理max为0的情况
        .range([centralBandTopY, centralBandTopY - topBarAreaHeight]);

    // 负值比例尺
    const yScaleNegative = d3.scaleLinear()
        .domain([0, maxNegativeY === 0 ? 1 : maxNegativeY]) // 处理max为0的情况
        .range([centralBandBottomY, centralBandBottomY + bottomBarAreaHeight]);

    // 圆形面积比例尺 (销售额 - y2)
    const maxValue2 = d3.max(chartData, d => d[valueField2]) || 0;
    const minRadius = 2; // 最小半径，防止圆点太小看不见
    // *** 修改: 最大半径基于圆圈可用空间 ***
    const maxRadius = Math.max(minRadius, maxCircleRadiusAvailable);

    const radiusScale = d3.scaleSqrt() // 平方根比例尺保证面积正比
        .domain([0, maxValue2])
        .range([minRadius, maxRadius]); // 半径范围

    // *** 添加: 文本换行辅助函数 ***
    function wrapText(textElement, text, width, x, y, fontSize, fontWeight, fontFamily) {
        textElement.each(function() {
            let words = text.split(/\s+/).reverse(),
                word,
                line = [],
                lineNumber = 0,
                lineHeight = 1.1, // ems
                tspan = textElement.text(null).append("tspan").attr("x", x).attr("y", y),
                dy = 0; // Initial dy for first line

            // Estimate width function (simple version)
            const estimate = (txt) => txt.length * fontSize * 0.6;

            // Check total estimated width first
            if (getTextWidth(text, fontSize, fontWeight, fontFamily) <= width) {
                tspan.text(text);
                return; // No wrapping needed
            }

            // Try to wrap (limit to max 2 lines for simplicity here)
            let lines = [];
            let currentLine = "";
            while (word = words.pop()) {
                line.push(word);
                currentLine = line.join(" ");
                if (getTextWidth(currentLine, fontSize, fontWeight, fontFamily) > width && line.length > 1) {
                    // Line exceeds width, back up one word
                    line.pop(); // remove the word that broke the limit
                    lines.push(line.join(" ")); // Add the previous line
                    line = [word]; // Start new line with the current word
                    if (lines.length >= 1) { // Stop after creating the first line break potential
                        line = [word].concat(words.reverse()); // Put remaining words on the second line
                        break;
                    }
                }
            }
            lines.push(line.join(" ")); // Add the last line

            // Render the lines (max 2)
            lines.slice(0, 2).forEach((lineText, i) => {
                if (i > 0) dy = lineHeight;
                tspan = textElement.append("tspan")
                             .attr("x", x)
                             .attr("y", y)
                             .attr("dy", `${dy}em`)
                             .text(lineText);
            });
            // If more than 2 lines would be needed, the second line might truncate

        });
    }

    // *** 修改: 字体大小计算函数 -> 精确测量 ***
    function getTextWidth(text, fontSize, fontWeight, fontFamily) {
        context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        return context.measureText(text).width;
    }

    let minDimensionLabelRatio = 1.0;
    let minCircleLabelRatio = 1.0;
    let minBarLabelRatio = 1.0;

    const maxDimensionLabelWidth = xScale.bandwidth() * 1.03;
    const maxCircleLabelWidth = xScale.bandwidth() * 1.03; // 圆圈标签也用这个宽度限制
    const maxBarLabelWidth = xScale.bandwidth(); // 条形图标签限制在条形宽度内

    chartData.forEach(d => {
        // 维度标签
        const dimensionText = String(d[dimensionField]); // Ensure string
        // *** 修改: 使用精确宽度计算 ***
        let currentWidth = getTextWidth(dimensionText, baseFontSizeLabel, typography.label.font_weight, typography.label.font_family);
        if (currentWidth > maxDimensionLabelWidth) {
            minDimensionLabelRatio = Math.min(minDimensionLabelRatio, maxDimensionLabelWidth / currentWidth);
        }

        // 圆圈标签
        const circleText = d[valueField2].toLocaleString() + valueUnit2; // *** 修改: 单位放在后面 ***
        currentWidth = getTextWidth(circleText, baseFontSizeLabel, typography.label.font_weight, typography.label.font_family);
        // *** 修改: 圆圈标签宽度只受bar宽度限制 ***
        const effectiveMaxCircleWidth = maxCircleLabelWidth; // Remove constraint from maxAllowedCircleWidth
        if (currentWidth > effectiveMaxCircleWidth) {
            minCircleLabelRatio = Math.min(minCircleLabelRatio, effectiveMaxCircleWidth / currentWidth);
        }

        // 条形图标签
        const barValue = d[valueField];
        const barText = (barValue > 0 ? "+" : "") + barValue.toFixed(1) + valueUnit;
        // *** 修改: 使用精确宽度计算 ***
        currentWidth = getTextWidth(barText, baseFontSizeAnnotation, typography.annotation.font_weight, typography.annotation.font_family);
        if (currentWidth > maxBarLabelWidth) {
            minBarLabelRatio = Math.min(minBarLabelRatio, maxBarLabelWidth / currentWidth);
        }
    });

    // 计算最终字体大小 (应用最小比例并限制最小值)
    const finalDimensionFontSize = Math.max(minFontSize, baseFontSizeLabel * minDimensionLabelRatio);
    const finalCircleFontSize = Math.max(minFontSize, baseFontSizeLabel * minCircleLabelRatio);
    const finalBarFontSize = Math.max(minFontSize, baseFontSizeAnnotation * minBarLabelRatio);

    // ---------- 6. 创建SVG容器 ----------

    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet") // 保持宽高比
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    

    // ---------- 7. 创建主图表组 ----------

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`); // Y方向不移动，因为Y坐标已包含margin.top

    // ---------- 7.5 添加图例 ----------
    const legendY = margin.top - 30; // 在顶部边距上方留出空间放置图例
    const legendSquareSize = 12;
    const legendCircleRadius = 6;
    const legendPadding = 15; // 各项之间的主间距
    const legendItemPadding = 5; // 图形和文本之间的间距

    // 获取图例文本和颜色
    const yName = valueField; // 使用提取的字段名
    const y2Name = valueField2;
    const positiveColor = colors.other.primary || "#008080";
    const negativeColor = colors.other.secondary || "#FF0000";
    const circleColor = colors.available_colors[0] ;
    const legendFontFamily = typography.annotation.font_family;
    const legendFontSize = parseFloat(typography.annotation.font_size);
    const legendFontWeight = typography.annotation.font_weight;

    // 计算文本宽度
    const yNameWidth = getTextWidth(yName, legendFontSize, legendFontWeight, legendFontFamily);
    const y2NameWidth = getTextWidth(y2Name, legendFontSize, legendFontWeight, legendFontFamily);

    // 计算总宽度
    const totalLegendWidth = legendSquareSize + legendItemPadding + // Positive square + padding
                           legendSquareSize + legendItemPadding + // Negative square + padding
                           yNameWidth + legendPadding +            // Y name text + main padding
                           (legendCircleRadius * 2) + legendItemPadding + // Circle diameter + padding
                           y2NameWidth;                           // Y2 name text

    // 计算起始X坐标以居中
    const legendStartX = margin.left + (innerWidth - totalLegendWidth) / 2;

    // 创建图例组
    const legendGroup = svg.append("g")
        .attr("class", "chart-legend")
        .attr("transform", `translate(${legendStartX}, ${legendY})`);

    let currentX = 0;

    // 1. 正值方块
    legendGroup.append("rect")
        .attr("x", currentX)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", positiveColor);
    currentX += legendSquareSize + legendItemPadding;

    // 2. 负值方块
    legendGroup.append("rect")
        .attr("x", currentX)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", negativeColor);
    currentX += legendSquareSize + legendItemPadding;

    // 3. Y 名称文本
    legendGroup.append("text")
        .attr("x", currentX)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFontFamily)
        .style("font-size", `${legendFontSize}px`)
        .style("font-weight", legendFontWeight)
        .style("fill", colors.text_color || "#000000")
        .text(yName);
    currentX += yNameWidth + legendPadding; // 使用主间距

    // 4. 圆圈图例
    legendGroup.append("circle")
        .attr("cx", currentX + legendCircleRadius)
        .attr("cy", 0)
        .attr("r", legendCircleRadius)
        .attr("fill", circleColor);
    currentX += (legendCircleRadius * 2) + legendItemPadding;

    // 5. Y2 名称文本
    legendGroup.append("text")
        .attr("x", currentX)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFontFamily)
        .style("font-size", `${legendFontSize}px`)
        .style("font-weight", legendFontWeight)
        .style("fill", colors.text_color || "#000000")
        .text(y2Name);

    // ---------- 8. 绘制中间灰色矩形区域 ----------

    // *** 修改: 使用 path 绘制带半圆结束的灰色区域 ***
    const bandRadius = centralBandHeight / 2;
    g.append("path")
        // *** 修改: 调整 d 属性使半圆在 0 和 innerWidth 外侧绘制 ***
        .attr("d", `
            M ${0},${centralBandTopY} 
            L ${innerWidth},${centralBandTopY}
            A ${bandRadius},${bandRadius} 0 0 1 ${innerWidth},${centralBandBottomY}
            L ${0},${centralBandBottomY}
            A ${bandRadius},${bandRadius} 0 0 1 ${0},${centralBandTopY}
            Z
        `)
        .attr("class","background")
        .attr("fill", "#f0f0f0"); // 浅灰色背景

    // ---------- 9. 绘制图表元素 (循环处理每个数据点) ----------

    chartData.forEach((d, i) => {
        const x = xScale(d[dimensionField]); // 获取当前类别的X坐标
        const barWidth = xScale.bandwidth(); // 获取条形的宽度
        const centerX = x + barWidth / 2; // 当前类别的中心X坐标

        // 9.1 绘制垂直条形图 (y值)
        const yValue = d[valueField];
        let barHeight, barY, barColor;

        // *** 修改: 使用 yScalePositive/yScaleNegative 计算高度和位置 ***
        if (yValue > 0) {
            barY = yScalePositive(yValue);
            barHeight = centralBandTopY - barY; // 高度是 band 顶部 和 scale 输出的差值
            barColor = colors.other.primary || "#008080"; // 正值颜色
        } else if (yValue < 0) {
            barY = centralBandBottomY; // 负值条从 band 底部开始
            const scaledY = yScaleNegative(Math.abs(yValue));
            barHeight = scaledY - barY; // 高度是 scale 输出 和 band 底部的差值
            barColor = colors.other.secondary || "#FF0000"; // 负值颜色
        } else {
            barHeight = 0; // 如果值为0，则不绘制条形
            barY = centralBandTopY;
            barColor = "none";
        }

        // Ensure minimum height for tiny bars if needed, e.g., barHeight = Math.max(barHeight, 0.5);
        if (barHeight < 0) barHeight = 0; // Prevent negative height due to floating point issues

        if (barHeight > 0) { // 只有高度大于0才绘制
            g.append("rect")
                .attr("x", x)
                // .attr("y", barY) // y and height set below
                .attr("width", barWidth)
                // .attr("height", barHeight)
                .attr("fill", barColor)
                // *** 修改: Apply y and height correctly ***
                .attr("y", barY)
                .attr("height", barHeight);

            // 9.2 添加条形图数值标签 (y值)
            const labelText = (yValue > 0 ? "+" : "") + yValue.toFixed(1) + valueUnit;
            const labelY = (yValue >= 0) ? barY - 5 : barY + barHeight + (finalBarFontSize * 0.8); // 调整下方标签距离
            const textAnchor = "middle";

            g.append("text")
                .attr("x", centerX)
                .attr("y", labelY)
                .attr("text-anchor", textAnchor)
                .style("font-family", typography.annotation.font_family)
                // *** 修改: 应用计算后的字体大小 ***
                .style("font-size", `${finalBarFontSize}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#000000")
                .text(labelText);
        }


        // *** 修改: 将圆圈和标签移到灰色区域下半部分 ***
        // 9.3 绘制圆圈 (y2值)
        const circleRadius = radiusScale(d[valueField2]);
        // *** 修改: 使用计算好的 circleY ***
        // const circleY = centralBandTopY + centralBandHeight * 0.70; // 旧方式
        // *** 修改: 圆圈颜色统一使用 available_colors[0] ***
        const circleColor = colors.available_colors[0] || "#FFBF00"; // Use first color consistently

        g.append("circle")
            .attr("cx", centerX)
            .attr("cy", circleY)
            .attr("r", circleRadius)
            .attr("fill", circleColor)
            .attr("opacity", 0.8);

        // 9.4 添加圆圈数值标签 (y2值) - 放置在圆心
        const circleLabelText = d[valueField2].toLocaleString() + valueUnit2; // *** 修改: 单位放在后面 ***
        // *** 修改: Y坐标就是 circleY ***
        // const circleLabelY = circleY + labelMargin + 15; // 旧方式

        g.append("text")
            .attr("x", centerX)
            .attr("y", circleY) // 文本垂直居中于圆心
            .attr("dy", "0.35em") // 微调使文本基线居中
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            // *** 修改: 应用计算后的字体大小 ***
            .style("font-size", `${finalCircleFontSize}px`)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color || "#000000")
            .text(circleLabelText);


        // *** 修改: 将维度图标和标签移到灰色区域上半部分 ***
        // 9.5 添加维度图标和标签 (x值)
        // *** 修改: 使用计算好的 iconY 和 dimensionLabelY ***
        // const labelBaseY = centralBandTopY + centralBandHeight * 0.25; // 旧方式

        // 添加图标 (如果存在)
        if (images.field && images.field[d[dimensionField]]) {
            g.append("image")
                .attr("x", centerX - iconSize / 2)
                .attr("y", iconY - iconSize / 2) // 图标中心对准 iconY
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", images.field[d[dimensionField]])
                .attr("preserveAspectRatio","xMidYMid meet");
        }

        // 添加维度标签文字
        // const dimensionLabelY = labelBaseY + iconSize + iconMargin; // 旧方式
        g.append("text")
            .attr("x", centerX)
            .attr("y", dimensionLabelY)
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${finalDimensionFontSize}px`) // Apply final size first
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color || "#000000")
             // *** 修改: 调用 wrapText 处理文本内容和换行 ***
            .call(wrapText, d[dimensionField], maxDimensionLabelWidth, centerX, dimensionLabelY, finalDimensionFontSize, typography.label.font_weight, typography.label.font_family); // Pass font props
            // .text(d[dimensionField]); // Text set by wrapText


    }); 

    // ---------- 10. 返回SVG节点 ----------
    return svg.node();
}