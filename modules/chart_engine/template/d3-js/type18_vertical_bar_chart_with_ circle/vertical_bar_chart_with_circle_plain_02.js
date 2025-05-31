/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Bar Chart With Circle",
    "chart_name": "vertical_bar_chart_with_circle_plain_02",
    "is_composite": true,
    "required_fields": [["x", "y", "y2"]],
    "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
    "required_fields_range": [[2, 12], ["-inf", "inf"], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": [],
    "supported_effects": [],
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

// 垂直条形图与比例圆复合图表实现 - 使用D3.js  vertical_bar_chart_with_circle_plain_02  半圆
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
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
        other: { primary: "#008080", secondary: "#FF0000" },
        available_colors: ["#FFBF00"]
    };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];

    // 创建文本测量Context
    const context = document.createElement('canvas').getContext('2d');

    // 提取字段名和单位
    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name;
    const valueUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y")?.unit || "");
    const valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y2")?.unit || "");
    
    // 数值格式化函数
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    d3.select(containerSelector).html("");

    // ---------- 2. 尺寸和布局设置 ----------
    const width = variables.width || 800;
    const height = variables.height || 600;
    const margin = { top: 90, right: 50, bottom: 60, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const centralBandHeight = innerHeight * 0.20;
    const barAreaHeight = innerHeight - centralBandHeight;
    
    // 按正负最大值比例分配高度
    const maxPositiveY = d3.max(chartData, d => Math.max(0, d[valueField])) || 0;
    const maxNegativeY = Math.abs(d3.min(chartData, d => Math.min(0, d[valueField])) || 0);
    const totalMagnitudeRange = maxPositiveY + maxNegativeY;
    const topBarAreaHeight = totalMagnitudeRange > 0 ? barAreaHeight * (maxPositiveY / totalMagnitudeRange) : barAreaHeight / 2;
    const bottomBarAreaHeight = barAreaHeight - topBarAreaHeight;

    // 计算关键Y坐标
    const centralBandTopY = margin.top + topBarAreaHeight;
    const centralBandBottomY = centralBandTopY + centralBandHeight;

    // 布局参数
    const iconSize = 20;
    const baseFontSizeLabel = parseFloat(typography.label.font_size) || 14;
    const baseFontSizeAnnotation = parseFloat(typography.annotation.font_size) || 12;
    const minFontSize = 8;

    // 计算元素Y坐标
    const iconY = centralBandTopY + 5 + iconSize / 2;
    const dimensionLabelY = iconY + iconSize / 2 + 3 + baseFontSizeLabel / 2;
    const circleAreaHeight = centralBandBottomY - (dimensionLabelY + baseFontSizeLabel / 2 + 3) - 5;
    const maxCircleRadiusAvailable = Math.min((circleAreaHeight * 0.9) / 2, innerWidth / 2);

    // ---------- 3. 数据处理和比例尺 ----------
    chartData.forEach(d => { d[valueField] = +d[valueField]; d[valueField2] = +d[valueField2]; });
    chartData.sort((a, b) => b[valueField] - a[valueField]);
    const dimensions = chartData.map(d => d[dimensionField]);

    const xScale = d3.scaleBand().domain(dimensions).range([0, innerWidth]).padding(0.2);
    const yScalePositive = d3.scaleLinear().domain([0, maxPositiveY || 1]).range([centralBandTopY, centralBandTopY - topBarAreaHeight]);
    const yScaleNegative = d3.scaleLinear().domain([0, maxNegativeY || 1]).range([centralBandBottomY, centralBandBottomY + bottomBarAreaHeight]);
    const radiusScale = d3.scaleSqrt().domain([0, d3.max(chartData, d => d[valueField2]) || 0]).range([2, Math.max(2, maxCircleRadiusAvailable)]);

    // ---------- 4. 辅助函数 ----------
    // 文本宽度测量
    const getTextWidth = (text, fontSize, fontWeight, fontFamily) => {
        context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        return context.measureText(text).width;
    };

    // 文本换行函数
    function wrapText(textElement, text, width, x, y, fontSize, fontWeight, fontFamily, alignment = 'middle') {
        textElement.each(function() {
            const element = d3.select(this);
            const words = text.split(/\s+/).reverse();
            const lineHeight = 1.3;
            
            element.text(null);
            let tspans = [];

            if (words.length > 1) {
                let currentLine = [];
                let word;
                while (word = words.pop()) {
                    currentLine.push(word);
                    if (getTextWidth(currentLine.join(" "), fontSize, fontWeight, fontFamily) > width && currentLine.length > 1) {
                        currentLine.pop();
                        tspans.push(currentLine.join(" "));
                        currentLine = [word];
                    }
                }
                if (currentLine.length > 0) tspans.push(currentLine.join(" "));
            } else {
                let currentLine = '';
                for (let char of text.split('')) {
                    const nextLine = currentLine + char;
                    if (getTextWidth(nextLine, fontSize, fontWeight, fontFamily) > width && currentLine.length > 0) {
                        tspans.push(currentLine);
                        currentLine = char;
                    } else {
                        currentLine = nextLine;
                    }
                }
                if (currentLine.length > 0) tspans.push(currentLine);
            }

            // 计算对齐偏移
            const totalLines = tspans.length;
            let startDy = 0;
            if (alignment === 'middle') startDy = -((totalLines - 1) * lineHeight / 2);
            else if (alignment === 'bottom') startDy = -(totalLines * lineHeight - lineHeight);

            tspans.forEach((lineText, i) => {
                element.append("tspan")
                    .attr("x", x)
                    .attr("dy", (i === 0 ? startDy : lineHeight) + "em")
                    .text(lineText);
            });
            
            element.attr("data-lines", totalLines);
        });
    }

    // 计算字体大小
    let minDimensionLabelRatio = 1.0, minCircleLabelRatio = 1.0, minBarLabelRatio = 1.0;
    const maxDimensionLabelWidth = xScale.bandwidth() * 0.95;
    const maxCircleLabelWidth = xScale.bandwidth() * 1.03;
    const maxBarLabelWidth = xScale.bandwidth();

    chartData.forEach(d => {
        // 维度标签
        let currentWidth = getTextWidth(String(d[dimensionField]), baseFontSizeLabel, typography.label.font_weight, typography.label.font_family);
        if (currentWidth > maxDimensionLabelWidth) minDimensionLabelRatio = Math.min(minDimensionLabelRatio, maxDimensionLabelWidth / currentWidth);

        // 圆圈标签
        currentWidth = getTextWidth(formatValue(d[valueField2]) + (valueUnit2 ? ` ${valueUnit2}` : ''), baseFontSizeLabel, typography.label.font_weight, typography.label.font_family);
        if (currentWidth > maxCircleLabelWidth) minCircleLabelRatio = Math.min(minCircleLabelRatio, maxCircleLabelWidth / currentWidth);

        // 条形图标签
        currentWidth = getTextWidth((d[valueField] > 0 ? "+" : "") + formatValue(d[valueField]) + (valueUnit ? ` ${valueUnit}` : ''), baseFontSizeAnnotation, typography.annotation.font_weight, typography.annotation.font_family);
        if (currentWidth > maxBarLabelWidth) minBarLabelRatio = Math.min(minBarLabelRatio, maxBarLabelWidth / currentWidth);
    });

    const finalDimensionFontSize = Math.max(minFontSize, baseFontSizeLabel * minDimensionLabelRatio);
    const finalCircleFontSize = Math.max(minFontSize, baseFontSizeLabel * minCircleLabelRatio);
    const finalBarFontSize = Math.max(minFontSize, baseFontSizeAnnotation * minBarLabelRatio);

    // ---------- 5. 创建SVG容器 ----------
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const g = svg.append("g").attr("transform", `translate(${margin.left}, 0)`);

    // ---------- 6. 添加图例 ----------
    const legendY = margin.top - 30;
    const legendData = [
        { type: 'rect', color: colors.other.primary || "#008080" },
        { type: 'rect', color: colors.other.secondary || "#FF0000" },
        { type: 'text', text: valueField },
        { type: 'circle', color: colors.available_colors[0] || "#FFBF00" },
        { type: 'text', text: valueField2 }
    ];

    const legendWidths = [12, 12, getTextWidth(valueField, 12, 400, typography.annotation.font_family), 12, getTextWidth(valueField2, 12, 400, typography.annotation.font_family)];
    const totalLegendWidth = legendWidths.reduce((a, b) => a + b, 0) + 20; // 20 for padding
    const legendStartX = margin.left + (innerWidth - totalLegendWidth) / 2;

    const legendGroup = svg.append("g").attr("class", "text").attr("transform", `translate(${legendStartX}, ${legendY})`);
    let currentX = 0;

    legendData.forEach((item, i) => {
        if (item.type === 'rect') {
            legendGroup.append("rect").attr("class", "mark").attr("x", currentX).attr("y", -6).attr("width", 12).attr("height", 12).attr("fill", item.color);
        } else if (item.type === 'circle') {
            legendGroup.append("circle").attr("class", "mark").attr("cx", currentX + 6).attr("cy", 0).attr("r", 6).attr("fill", item.color);
        } else {
            legendGroup.append("text").attr("class", "text").attr("x", currentX).attr("y", 0).attr("dominant-baseline", "middle")
                .style("font-family", typography.annotation.font_family).style("font-size", "12px").style("font-weight", 400)
                .style("fill", colors.text_color || "#000000").text(item.text);
        }
        currentX += legendWidths[i] + (i < legendData.length - 1 ? 5 : 0);
    });

    // ---------- 7. 绘制图表元素 ----------
    // 计算维度标签最大高度
    let maxLabelHeight = 0;
    const dimensionLabels = chartData.map((d, i) => {
        const tempText = g.append("text").style("visibility", "hidden")
            .call(wrapText, d[dimensionField], maxDimensionLabelWidth, 0, 0, finalDimensionFontSize, typography.label.font_weight, typography.label.font_family, 'top');
        const lineCount = parseInt(tempText.attr("data-lines") || "1");
        const height = lineCount * finalDimensionFontSize * 1.3;
        maxLabelHeight = Math.max(maxLabelHeight, height);
        tempText.remove();
        return { lineCount, height };
    });
    
    const uniformCircleY = dimensionLabelY + maxLabelHeight + 10;
    
    // 绘制所有元素
    chartData.forEach((d, i) => {
        const x = xScale(d[dimensionField]);
        const barWidth = xScale.bandwidth();
        const centerX = x + barWidth / 2;
        const yValue = d[valueField];

        // 绘制条形图
        if (yValue !== 0) {
            let barY, barHeight, barColor;
            if (yValue > 0) {
                barY = yScalePositive(yValue);
                barHeight = centralBandTopY - barY;
                barColor = colors.other.primary || "#008080";
            } else {
                barY = centralBandBottomY;
                barHeight = yScaleNegative(Math.abs(yValue)) - barY;
                barColor = colors.other.secondary || "#FF0000";
            }

            if (barHeight > 0) {
                g.append("rect").attr("class", "mark").attr("x", x).attr("width", barWidth).attr("fill", barColor)
                    .attr("y", barY).attr("height", barHeight).attr("rx", barWidth / 2).attr("ry", barWidth / 2);

                // 条形数值标签
                const labelText = (yValue > 0 ? "+" : "") + formatValue(yValue) + (valueUnit ? ` ${valueUnit}` : '');
                const labelY = yValue >= 0 ? barY - 5 : barY + barHeight + finalBarFontSize * 0.8;
                g.append("text").attr("class", "value").attr("x", centerX).attr("y", labelY).attr("text-anchor", "middle")
                    .style("font-family", typography.annotation.font_family).style("font-size", `${finalBarFontSize}px`)
                    .style("font-weight", typography.annotation.font_weight).style("fill", colors.text_color || "#000000").text(labelText);
            }
        }

        // 维度标签
        g.append("text").attr("class", "label").attr("x", centerX).attr("y", dimensionLabelY).attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family).style("font-size", `${finalDimensionFontSize}px`)
            .style("font-weight", typography.label.font_weight).style("fill", colors.text_color || "#000000")
            .call(wrapText, d[dimensionField], maxDimensionLabelWidth, centerX, dimensionLabelY, finalDimensionFontSize, typography.label.font_weight, typography.label.font_family, 'top');
        
        // 圆圈
        const circleRadius = radiusScale(d[valueField2]);
        g.append("circle").attr("class", "mark").attr("cx", centerX).attr("cy", uniformCircleY).attr("r", circleRadius)
            .attr("fill", colors.available_colors[0] || "#FFBF00").attr("opacity", 0.8);

        // 圆圈数值标签
        const circleLabelText = formatValue(d[valueField2]) + (valueUnit2 ? ` ${valueUnit2}` : '');
        g.append("text").attr("class", "value").attr("x", centerX).attr("y", uniformCircleY).attr("dy", "0.35em").attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family).style("font-size", `${finalCircleFontSize}px`)
            .style("font-weight", typography.label.font_weight).style("fill", colors.text_color || "#000000").text(circleLabelText);

        // 图标
        if (images.field && images.field[d[dimensionField]]) {
            g.append("image").attr("class", "image").attr("x", centerX - iconSize / 2).attr("y", iconY - iconSize / 2)
                .attr("width", iconSize).attr("height", iconSize).attr("xlink:href", images.field[d[dimensionField]]).attr("preserveAspectRatio", "xMidYMid meet");
        }
    });

    return svg.node();
}