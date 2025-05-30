/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Bar Chart With Circle",
    "chart_name": "vertical_bar_chart_03",
    "is_composite": true,
    "required_fields": [["x", "y", "y2"]],
    "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
    "required_fields_range": [[2, 12], ["-inf", "inf"], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": [],
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

// 垂直条形图与比例圆复合图表实现 - 使用D3.js   vertical_bar_proportional_circle_area_chart_01
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
    
    // 数值单位规范
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

    // *** 修改: 文本大小和换行辅助函数 ***
    // 计算字体大小的函数，确保文本在指定宽度内
    const calculateFontSize = (text, maxWidth, baseSize = 14) => {
        // 检查参数是否有效
        if (!text || typeof text !== 'string' || !maxWidth || maxWidth <= 0 || !baseSize || baseSize <= 0) {
            return Math.max(10, baseSize || 14); // 返回一个合理的默认值或最小尺寸
        }
        
        // 估算每个字符的平均宽度 (假设为baseSize的60%)
        const avgCharWidth = baseSize * 0.6;
        // 计算文本的估计宽度
        const textWidth = text.length * avgCharWidth;
        
        // 如果文本宽度小于最大宽度，返回基础大小
        if (textWidth < maxWidth) {
            return baseSize;
        }
        
        // 否则，按比例缩小字体大小，确保不小于10
        return Math.max(10, Math.floor(baseSize * (maxWidth / textWidth)));
    };

    // 文本换行辅助函数 (添加 alignment 参数)
    function wrapText(textElement, text, width, x, y, fontSize, fontWeight, fontFamily, alignment = 'middle') {
        textElement.each(function() {
            const text_element = d3.select(this);
            const words = text.split(/\s+/).reverse(); // 按空格分割单词
            let word;
            let lineNumber = 0;
            const lineHeight = 1.3; // 增加行高，避免行间重叠
            
            text_element.text(null); // 清空现有文本

            let tspans = []; // 存储最终要渲染的行

            // 优先按单词换行
            if (words.length > 1) {
                let currentLine = [];
                while (word = words.pop()) {
                    currentLine.push(word);
                    const currentText = currentLine.join(" ");
                    // 使用getTextWidth函数计算宽度
                    const currentWidth = getTextWidth(currentText, fontSize, fontWeight, fontFamily);
                    
                    if (currentWidth > width && currentLine.length > 1) {
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
                const chars = text.split('');
                let currentLine = '';
                for (let i = 0; i < chars.length; i++) {
                    const nextLine = currentLine + chars[i];
                    const currentWidth = getTextWidth(nextLine, fontSize, fontWeight, fontFamily);
                    
                    if (currentWidth > width && currentLine.length > 0) { // 如果加了新字符就超长了，并且当前行不为空
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
                startDy = -((totalLines - 1) * lineHeight / 2);
            } else if (alignment === 'bottom') {
                // 底部对齐：计算总高度，向上移动 总高度 - 单行高度
                const totalHeightEm = totalLines * lineHeight;
                startDy = -(totalHeightEm - lineHeight); // 将底部对齐到原始y
            }
            // 如果是 'top' 对齐，startDy 保持为 0，即第一行基线在原始y位置

            // 创建所有行的tspan元素
            tspans.forEach((lineText, i) => {
                text_element.append("tspan")
                    .attr("x", x) // x坐标固定
                    .attr("dy", (i === 0 ? startDy : lineHeight) + "em") // 第一行应用起始偏移，后续行应用行高
                    .text(lineText);
            });
            
            // 保存行数以供外部使用
            text_element.attr("data-lines", totalLines);
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

    const maxDimensionLabelWidth = xScale.bandwidth() * 0.95;
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
        const circleText = formatValue(d[valueField2]) + (valueUnit2 ? ` ${valueUnit2}` : ''); // *** 修改: 单位放在后面 ***
        currentWidth = getTextWidth(circleText, baseFontSizeLabel, typography.label.font_weight, typography.label.font_family);
        // *** 修改: 圆圈标签宽度只受bar宽度限制 ***
        const effectiveMaxCircleWidth = maxCircleLabelWidth; // Remove constraint from maxAllowedCircleWidth
        if (currentWidth > effectiveMaxCircleWidth) {
            minCircleLabelRatio = Math.min(minCircleLabelRatio, effectiveMaxCircleWidth / currentWidth);
        }

        // 条形图标签
        const barValue = d[valueField];
        const barText = (barValue > 0 ? "+" : "") + formatValue(barValue) + (valueUnit ? ` ${valueUnit}` : '');
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

    // 首先创建所有维度标签，确定最大高度
    const dimensionLabels = [];
    let maxLabelHeight = 0;
    
    chartData.forEach((d, i) => {
        const x = xScale(d[dimensionField]); // 获取当前类别的X坐标
        const barWidth = xScale.bandwidth(); // 获取条形的宽度
        const centerX = x + barWidth / 2; // 当前类别的中心X坐标
        
        // 添加维度标签文字 (先仅计算高度，不添加到DOM)
        const labelInfo = {
            x: centerX,
            y: dimensionLabelY,
            text: d[dimensionField],
            width: maxDimensionLabelWidth
        };
        
        // 创建一个临时文本元素来计算行数
        const tempText = g.append("text")
            .attr("x", centerX)
            .attr("y", dimensionLabelY)
            .attr("text-anchor", "middle")
            .attr("class", "temp-dimension-label")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${finalDimensionFontSize}px`)
            .style("font-weight", typography.label.font_weight)
            .style("fill", "none") // 不可见
            .call(wrapText, d[dimensionField], maxDimensionLabelWidth, centerX, dimensionLabelY, 
                  finalDimensionFontSize, typography.label.font_weight, typography.label.font_family, 'top');
        
        // 获取行数并计算高度
        const lineCount = parseInt(tempText.attr("data-lines") || "1");
        const labelHeight = lineCount * finalDimensionFontSize * 1.3; // 使用增加的行高计算
        
        // 保存标签信息和高度
        labelInfo.lineCount = lineCount;
        labelInfo.height = labelHeight;
        dimensionLabels.push(labelInfo);
        
        // 更新最大高度
        maxLabelHeight = Math.max(maxLabelHeight, labelHeight);
        
        // 删除临时元素
        tempText.remove();
    });
    
    // 计算统一的圆圈Y坐标 (基于最大标签高度)
    const uniformCircleY = dimensionLabelY + maxLabelHeight + circlePadding +5;
    
    // 现在绘制所有元素
    chartData.forEach((d, i) => {
        const x = xScale(d[dimensionField]); // 获取当前类别的X坐标
        const barWidth = xScale.bandwidth(); // 获取条形的宽度
        const centerX = x + barWidth / 2; // 当前类别的中心X坐标
        const labelInfo = dimensionLabels[i];

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
                .attr("width", barWidth)
                .attr("fill", barColor)
                .attr("y", barY)
                .attr("height", barHeight);

            // 9.2 添加条形图数值标签 (y值)
            const labelText = (yValue > 0 ? "+" : "") + formatValue(yValue) + (valueUnit ? ` ${valueUnit}` : '');
            const labelY = (yValue >= 0) ? barY - 5 : barY + barHeight + (finalBarFontSize * 0.8); // 调整下方标签距离
            const textAnchor = "middle";

            g.append("text")
                .attr("x", centerX)
                .attr("y", labelY)
                .attr("text-anchor", textAnchor)
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${finalBarFontSize}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#000000")
                .text(labelText);
        }

        // 绘制维度标签
        const dimensionText = g.append("text")
            .attr("x", centerX)
            .attr("y", dimensionLabelY)
            .attr("text-anchor", "middle")
            .attr("class", "dimension-label")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${finalDimensionFontSize}px`)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color || "#000000")
            .call(wrapText, d[dimensionField], maxDimensionLabelWidth, centerX, dimensionLabelY, 
                  finalDimensionFontSize, typography.label.font_weight, typography.label.font_family, 'top');
        
        // 9.3 绘制圆圈 (y2值) - 使用统一的Y坐标
        const circleRadius = radiusScale(d[valueField2]);
        const circleColor = colors.available_colors[0] || "#FFBF00";

        g.append("circle")
            .attr("cx", centerX)
            .attr("cy", uniformCircleY)
            .attr("r", circleRadius)
            .attr("fill", circleColor)
            .attr("opacity", 0.8);

        // 9.4 添加圆圈数值标签 (y2值) - 放置在圆心
        const circleLabelText = formatValue(d[valueField2]) + (valueUnit2 ? ` ${valueUnit2}` : '');

        g.append("text")
            .attr("x", centerX)
            .attr("y", uniformCircleY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${finalCircleFontSize}px`)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color || "#000000")
            .text(circleLabelText);

        // 9.5 添加维度图标和标签 (x值)
        // 添加图标 (如果存在)
        if (images.field && images.field[d[dimensionField]]) {
            g.append("image")
                .attr("x", centerX - iconSize / 2)
                .attr("y", iconY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", images.field[d[dimensionField]])
                .attr("preserveAspectRatio","xMidYMid meet");
        }
    });

    // ---------- 10. 返回SVG节点 ----------
    return svg.node();
}