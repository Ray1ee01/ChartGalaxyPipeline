/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Bar Chart",
    "chart_name": "vertical_bar_chart_13",
    "is_composite": true,
    "required_fields": [["x", "y"], ["x", "y2"]],
    "required_fields_type": [
        [["categorical"], ["numerical"]],
        [["categorical"], ["numerical"]]
    ],
    "required_fields_range": [
        [[2, 30], [0, "inf"]],
        [[2, 30], [0, "inf"]]
    ],
    "required_fields_icons": [],
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

// 垂直条形图与比例方形复合图表实现 - 使用D3.js  
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

    // *** 添加数值格式化函数 ***
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

    // 边距 - 减少底部边距，因为标签上移
    const margin = { top: 90, right: 50, bottom: 30, left: 50 }; // *** 修改: 减少 bottom ***
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom; // *** 修改: 重新计算 innerHeight ***

    // 定义中间区域的高度 (保持不变或按需调整)
    const centralBandHeight = innerHeight * 0.20; // 中间区域占20%高度
    
    // 上下条形图的总可用高度
    const barAreaHeight = innerHeight - centralBandHeight; 
    
    // 按正负最大值比例分配高度
    const maxPositiveY = d3.max(chartData, d => Math.max(0, d[valueField])) || 0;
    const maxNegativeY = Math.abs(d3.min(chartData, d => Math.min(0, d[valueField])) || 0);
    const totalMagnitudeRange = maxPositiveY + maxNegativeY;

    let topBarAreaHeight;
    let bottomBarAreaHeight;

    if (totalMagnitudeRange > 0) {
        topBarAreaHeight = barAreaHeight * (maxPositiveY / totalMagnitudeRange);
        bottomBarAreaHeight = barAreaHeight * (maxNegativeY / totalMagnitudeRange);
    } else {
        topBarAreaHeight = barAreaHeight / 2;
        bottomBarAreaHeight = barAreaHeight / 2;
    }

    // *** 修改: 重新计算中间区域的 Y 坐标 ***
    const centralBandTopY = margin.top + topBarAreaHeight;
    const centralBandBottomY = centralBandTopY + centralBandHeight;

    // *** 修改: 移除图标尺寸定义 ***
    // const iconSize = 20;
    // const iconMargin = 3; 
    const labelMargin = 3; 
    const circlePadding = 5; // 重命名为 shapePadding?

    const baseFontSizeLabel = parseFloat(typography.label.font_size) || 14;
    const baseFontSizeAnnotation = parseFloat(typography.annotation.font_size) || 12;
    const minFontSize = 8;

    // *** 修改: 仅在此处预估中间区域元素 Y 坐标 ***
    const estDimensionLabelY = centralBandTopY + centralBandHeight * 0.30; 
    const estShapeY = centralBandTopY + centralBandHeight * 0.70; // *** 重命名: estCircleY -> estShapeY ***
    
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

    // *** 修改: 更新 Y 轴比例尺范围以适应中间区域 ***
    const yScalePositive = d3.scaleLinear()
        .domain([0, maxPositiveY === 0 ? 1 : maxPositiveY]) 
        .range([centralBandTopY, margin.top]); // 从中间区域顶部到图表顶部边距

    const yScaleNegative = d3.scaleLinear()
        .domain([0, maxNegativeY === 0 ? 1 : maxNegativeY]) 
        .range([centralBandBottomY, height - margin.bottom]); // 从中间区域底部到图表底部边距

    // *** 修改: 方形面积比例尺 (y2值) ***
    const maxValue2 = d3.max(chartData, d => d[valueField2]) || 0;
    const minSideLength = 3; // *** 重命名: minRadius -> minSideLength (方形最小边长) ***

    // *** 修改: 计算精确的中间区域 Y 坐标和最大方形边长 ***
    const dimensionLabelY = centralBandTopY + centralBandHeight * 0.35; 
    const shapeY = centralBandTopY + centralBandHeight * 0.75;       // *** 重命名: circleY -> shapeY ***
    
    const maxSideLengthFromBarWidth = xScale.bandwidth() * 0.9; // *** 重命名并调整: 方形边长不能超过 bar 宽度的 90% ***
    const actualShapeAreaTopY = dimensionLabelY + baseFontSizeLabel + labelMargin; // *** 重命名: actualCircleAreaTopY -> actualShapeAreaTopY ***
    const shapeAreaHeight = centralBandBottomY - actualShapeAreaTopY; // *** 重命名: circleAreaHeight -> shapeAreaHeight ***
    // *** 修改: 最大边长受可用高度限制 ***
    const maxSideLengthAvailableBasedOnHeight = Math.max(0, shapeAreaHeight * 0.9); 
    const maxSideLengthAvailable = Math.min(maxSideLengthAvailableBasedOnHeight, maxSideLengthFromBarWidth);
    const maxSideLength = Math.max(minSideLength, maxSideLengthAvailable); // *** 重命名: maxRadius -> maxSideLength ***

    // *** 重命名: radiusScale -> sideLengthScale ***
    const sideLengthScale = d3.scaleSqrt() 
        .domain([0, maxValue2])
        .range([minSideLength, maxSideLength]); // 输出边长范围

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

            // Render the lines (max 4)
            lines.slice(0, 4).forEach((lineText, i) => {
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

    const maxDimensionLabelWidth = xScale.bandwidth() * 0.90;
    const maxCircleLabelWidth = xScale.bandwidth() * 1.03; 
    const maxBarLabelWidth = xScale.bandwidth();

    // *** 注意: 这里的 finalDimensionFontSize, finalCircleFontSize, finalBarFontSize 
    //          是在循环之后计算的，但在循环内部以及半径计算中可能需要提前估算或使用基础值。
    //          当前代码在半径计算中使用了 finalDimensionFontSize || baseFontSizeLabel 

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

    // *** 添加: 定义渐变 ***
    const defs = svg.append("defs");

    // 获取基础颜色 (已在图例部分定义)
    const positiveColor = colors.other.primary || "#008080";
    const negativeColor = colors.other.secondary || "#FF0000";

    // --- 正值条形图渐变 ---
    const gradientPositive = defs.append("linearGradient")
        .attr("id", "gradient-positive")
        .attr("x1", "0%")
        .attr("y1", "0%") // 从顶部开始
        .attr("x2", "0%")
        .attr("y2", "100%"); // 到顶部结束 (垂直)

    gradientPositive.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d3.rgb(positiveColor).darker(0.5)); // 顶部稍暗

    gradientPositive.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", d3.rgb(positiveColor).brighter(1.5)); // 中间最亮

    gradientPositive.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d3.rgb(positiveColor).darker(0.5)); // 底部稍暗

    // --- 负值条形图渐变 ---
    const gradientNegative = defs.append("linearGradient")
        .attr("id", "gradient-negative")
        .attr("x1", "0%")
        .attr("y1", "0%") // 从顶部开始
        .attr("x2", "0%")
        .attr("y2", "100%"); // 到底部结束 (垂直)

    gradientNegative.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d3.rgb(negativeColor).darker(0.5)); // 顶部稍暗

    gradientNegative.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", d3.rgb(negativeColor).brighter(1.5)); // 中间最亮

    gradientNegative.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d3.rgb(negativeColor).darker(0.5)); // 底部稍暗

    // --- 创建主绘图区域 --- 
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`); 

    // ---------- 7.5 添加图例 (恢复原始逻辑) ----------
    const legendY = margin.top / 2; // 保持较高的位置
    const legendSquareSize = 12;
    // const legendCircleRadius = 6; // 使用方形，移除半径
    const legendPadding = 15; 
    const legendItemPadding = 5; 

    // *** 恢复: 获取图例文本和颜色 (positive, negative, shape) ***
    const yName = valueField; 
    const y2Name = valueField2;
    const shapeLegendColor = colors.available_colors[0] || "#FFBF00";
    
    const legendFontFamily = typography.annotation.font_family;
    const legendFontSize = parseFloat(typography.annotation.font_size);
    const legendFontWeight = typography.annotation.font_weight;

    const yNameWidth = getTextWidth(yName, legendFontSize, legendFontWeight, legendFontFamily);
    const y2NameWidth = getTextWidth(y2Name, legendFontSize, legendFontWeight, legendFontFamily);

    // *** 恢复: 计算图例总宽度 (两个条形方块 + 一个形状方块) ***
    const totalLegendWidth = legendSquareSize + legendItemPadding + // Positive square
                           legendSquareSize + legendItemPadding + // Negative square
                           yNameWidth + legendPadding +            
                           legendSquareSize + legendItemPadding + // Shape square
                           y2NameWidth;                           

    const legendStartX = margin.left + (innerWidth - totalLegendWidth) / 2;

    const legendGroup = svg.append("g")
        .attr("class", "chart-legend")
        .attr("transform", `translate(${legendStartX}, ${legendY})`);

    let currentX = 0;

    // *** 恢复: 绘制正值方块 ***
    legendGroup.append("rect")
        .attr("x", currentX)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", positiveColor);
    currentX += legendSquareSize + legendItemPadding;
    
    // *** 恢复: 绘制负值方块 ***
    legendGroup.append("rect")
        .attr("x", currentX)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", negativeColor);
    currentX += legendSquareSize + legendItemPadding;

    // Y 名称文本 (不变)
    legendGroup.append("text")
        .attr("x", currentX)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFontFamily)
        .style("font-size", `${legendFontSize}px`)
        .style("font-weight", legendFontWeight)
        .style("fill", colors.text_color || "#000000")
        .text(yName);
    currentX += yNameWidth + legendPadding; 

    // *** 恢复: 绘制形状方块图例 ***
    legendGroup.append("rect") 
        .attr("x", currentX) 
        .attr("y", -legendSquareSize / 2) 
        .attr("width", legendSquareSize) 
        .attr("height", legendSquareSize) 
        .attr("fill", shapeLegendColor); 
    currentX += legendSquareSize + legendItemPadding; 

    // Y2 名称文本 (不变)
    legendGroup.append("text")
        .attr("x", currentX)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFontFamily)
        .style("font-size", `${legendFontSize}px`)
        .style("font-weight", legendFontWeight)
        .style("fill", colors.text_color || "#000000")
        .text(y2Name);

    // ---------- 9. 绘制图表元素 (循环处理每个数据点) ----------

    chartData.forEach((d, i) => {
        const x = xScale(d[dimensionField]); // 获取当前类别的X坐标
        const barWidth = xScale.bandwidth(); // 获取条形的宽度
        const centerX = x + barWidth / 2; // 当前类别的中心X坐标

        // 9.1 绘制垂直条形图 (y值)
        const yValue = d[valueField];
        let barHeight, barY, barColor; // *** 恢复: barColor 变量 ***

        // *** 修改: 使用更新后的 yScale 和边界计算高度/位置, 并恢复原始颜色逻辑 ***
        if (yValue > 0) {
            barY = yScalePositive(yValue);
            barHeight = centralBandTopY - barY; 
            barColor = colors.other.primary || "#008080"; // *** 恢复: 正值颜色 ***
        } else if (yValue < 0) {
            barY = centralBandBottomY; 
            const scaledY = yScaleNegative(Math.abs(yValue));
            barHeight = scaledY - barY; 
            barColor = colors.other.secondary || "#FF0000"; // *** 恢复: 负值颜色 ***
        } else {
            barHeight = 0; 
            barY = centralBandTopY; 
            barColor = "none"; // *** 恢复: 零值颜色 ***
        }

        if (barHeight < 0) barHeight = 0; 

        if (barHeight > 0) { // 只有高度大于0才绘制
            // *** 修改: 使用 path 绘制带半圆顶底的条形 ***
            const r = barWidth / 2; // 半圆半径
            let pathData;

            if (yValue > 0) {
                // 正值条形路径
                pathData = `
                    M ${x},${centralBandTopY} 
                    A ${r},${r} 0 0 0 ${x + barWidth},${centralBandTopY} 
                    L ${x + barWidth},${barY} 
                    A ${r},${r} 0 0 0 ${x},${barY} 
                    Z
                `;
            } else { // yValue < 0
                // 负值条形路径
                const scaledY = yScaleNegative(Math.abs(yValue)); // 底部Y坐标
                pathData = `
                    M ${x},${barY} 
                    A ${r},${r} 0 0 1 ${x + barWidth},${barY} 
                    L ${x + barWidth},${scaledY} 
                    A ${r},${r} 0 0 1 ${x},${scaledY} 
                    Z
                `;
            }

            g.append("path") 
                .attr("d", pathData) 
                // *** 修改: 根据正负值应用不同的渐变填充 ***
                .attr("fill", yValue >= 0 ? "url(#gradient-positive)" : "url(#gradient-negative)"); 
                // .attr("fill", barColor); // 旧的纯色填充

            // 9.2 添加条形图数值标签 (y值)
            const labelText = (yValue > 0 ? "+" : "") + formatValue(yValue) + valueUnit;
            const labelY = (yValue >= 0) ? barY + 3 : barY + barHeight + (finalBarFontSize * 0.8); 
            const textAnchor = "middle";

            g.append("text")
                .attr("x", centerX)
                .attr("y", labelY)
                .attr("text-anchor", textAnchor)
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${finalBarFontSize}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", "#ffffff")
                .text(labelText);
                
            // 9.3 绘制形状 (y2值) - 方形
            const squareSideLength = sideLengthScale(d[valueField2]);
            // *** 恢复: 使用 available_colors[0] 作为形状颜色 ***
            const shapeColor = colors.available_colors[0] || "#FFBF00"; 

            g.append("rect") 
                .attr("x", centerX - squareSideLength / 2) 
                .attr("y", shapeY - squareSideLength / 2) 
                .attr("width", squareSideLength) 
                .attr("height", squareSideLength) 
                .attr("fill", shapeColor) // *** 恢复: 使用 shapeColor ***
                .attr("opacity", 0.8);

            // 9.4 添加形状数值标签 (y2值) - 基于方形调整
            const shapeLabelText = formatValue(d[valueField2]) + valueUnit2; // *** 重命名 ***
            const textWidth = getTextWidth(shapeLabelText, finalCircleFontSize, typography.label.font_weight, typography.label.font_family);
            // *** 修改: 判断条件基于方形边长 ***
            const isShapeBigEnough = textWidth < (squareSideLength * 0.9); // 例如，宽度小于边长的90%
            let labelColor, labelActualY, labelDy;
            
            // *** 修改: 判断条件使用 squareSideLength ***
            if (isShapeBigEnough && squareSideLength > minFontSize * 1.2) { // 边长至少比最小字体大一点
                labelColor = "#ffffff"; 
                labelActualY = shapeY; // *** 内部标签使用 shapeY ***
                labelDy = "0.35em"; // 垂直居中
            } else {
                labelColor = colors.text_color || "#000000";
                // *** 修改: 外部标签基于 shapeY 和方形边长定位 ***
                labelActualY = shapeY + squareSideLength / 2 + (finalCircleFontSize * 0.6) + 6; // 方形底部再往下一点
                labelDy = "0em"; 
            }

            g.append("text")
                .attr("x", centerX)
                .attr("y", labelActualY) 
                .attr("dy", labelDy) 
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                // *** 注意: 这里仍然使用 finalCircleFontSize，如果需要可以区分 ***
                .style("font-size", `${finalCircleFontSize}px`) 
                .style("font-weight", typography.label.font_weight)
                .style("fill", labelColor)
                .text(shapeLabelText); // *** 使用重命名后的变量 ***

            // 9.5 添加维度标签 (x值)
            g.append("text")
                .attr("x", centerX)
                .attr("y", dimensionLabelY)
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${finalDimensionFontSize}px`) 
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#000000")
                .call(wrapText, d[dimensionField], maxDimensionLabelWidth, centerX, dimensionLabelY, finalDimensionFontSize, typography.label.font_weight, typography.label.font_family);
            
        }
    }); 

    // ---------- 10. 返回SVG节点 ----------
    return svg.node();
}