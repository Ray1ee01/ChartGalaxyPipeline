/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (pentagram)",
    "chart_name": "proportional_area_chart_pentagram_02",
    "is_composite": false,
    "required_fields": ["x","y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "stroke"],
    "min_height": 300,
    "min_width": 300,
    "background": "no",
    "icon_mark": "overlay",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// Proportional Area Chart (Star with Icon) - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333",
        other: { primary: "#FFD700" } // 默认为金色
    };
    const dataColumns = jsonData.data.columns || [];
    
    variables.has_shadow = variables.has_shadow || false;
    variables.has_stroke = variables.has_stroke || false;
    
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
    
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    const width = variables.width || 600;
    const height = variables.height || 350;
    const margin = { top: 100, right: 30, bottom: 80, left: 30 };
    
    // ---------- 3. 提取字段名和单位 ----------
    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    let valueUnit = "";
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    
    // ---------- 4. 数据处理 ----------
    const sortedData = [...chartData]
        .filter(d => d[valueField] > 0)
        .sort((a, b) => b[valueField] - a[valueField]);
    const maxValue = sortedData.length > 0 ? sortedData[0][valueField] : 0;
    
    // ---------- 5. 创建SVG容器 ----------
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    const defs = svg.append("defs");
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("width", "200%")
            .attr("height", "200%");
        filter.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 2);
        filter.append("feOffset").attr("dx", 1).attr("dy", 1).attr("result", "offsetblur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // ---------- 6. 计算网格布局 ----------
    const numCharts = sortedData.length;
    let rows, cols;
    if (numCharts <= 3) { rows = 1; cols = numCharts; }
    else if (numCharts === 4) { rows = 2; cols = 2; }
    else if (numCharts <= 8) { rows = 2; cols = Math.ceil(numCharts / 2); }
    else if (numCharts <= 12) { rows = 3; cols = Math.ceil(numCharts / 3); }
    else { rows = 4; cols = Math.ceil(numCharts / 4); }

    const itemsPerRow = [];
    for (let i = 0; i < rows; i++) {
        itemsPerRow.push(i < rows - 1 ? cols : numCharts - cols * (rows - 1));
    }
    
    const chartAreaWidth = width - margin.left - margin.right;
    const chartAreaHeight = height - margin.top - margin.bottom;
    const cellWidth = chartAreaWidth / cols;
    const cellHeight = chartAreaHeight / rows;
    
    const tempSvg = d3.select(containerSelector).append("svg").attr("width", 0).attr("height", 0).style("visibility", "hidden");
    const dimensionFontSize = parseFloat(typography.label.font_size);
    const valueFontSize = parseFloat(typography.annotation.font_size);
    let maxDimensionWidth = 0;
    let maxValueWidth = 0;
    
    sortedData.forEach(d => {
        const dimText = tempSvg.append("text").style("font-family", typography.label.font_family).style("font-size", typography.label.font_size).style("font-weight", typography.label.font_weight).text(d[dimensionField]);
        maxDimensionWidth = Math.max(maxDimensionWidth, dimText.node().getBBox().width);
        dimText.remove();
        const valText = tempSvg.append("text").style("font-family", typography.annotation.font_family).style("font-size", typography.annotation.font_size).style("font-weight", typography.annotation.font_weight).text(valueUnit ? `${formatValue(d[valueField])} ${valueUnit}` : formatValue(d[valueField]));
        maxValueWidth = Math.max(maxValueWidth, valText.node().getBBox().width);
        valText.remove();
    });
    tempSvg.remove();
    
    const spacingFactorHorizontal = 0.20; 
    const spacingFactorVertical = 0.20;   
    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    const cellRadius = Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10; 
    
    // ---------- 7. 检查文本是否会溢出并调整字体大小 ----------
    const maxChartAreaWidth = cellRadius * 2.5; 
    let dimensionScaleFactor = 1;
    if (maxDimensionWidth > maxChartAreaWidth) {
        dimensionScaleFactor = maxChartAreaWidth / (maxDimensionWidth + 3);
    }
    let valueScaleFactor = 1;
    if (maxValueWidth > maxChartAreaWidth) {
        valueScaleFactor = maxChartAreaWidth / (maxValueWidth + 3);
    }
    const adjustedDimensionFontSize = `${Math.floor(dimensionFontSize * dimensionScaleFactor)}px`;
    const adjustedValueFontSize = `${Math.floor(valueFontSize * valueScaleFactor)}px`;

    // ---------- 8. 创建五角星点和路径生成函数 ----------
    function getStarPoints(numArms, outerR, innerR) {
        const points = [];
        const angleStep = Math.PI / numArms;
        for (let i = 0; i < 2 * numArms; i++) {
            const r = (i % 2 === 0) ? outerR : innerR;
            const currentAngle = i * angleStep - (Math.PI / 2);
            const x = r * Math.cos(currentAngle);
            const y = r * Math.sin(currentAngle);
            points.push([x, y]);
        }
        return points;
    }
    
    // ---------- 9. 为每个数据点创建图形 ----------
    const baseColor = d3.color(colors.other.primary || "#FFD700");
    const colorDark = baseColor.darker(0.6).toString();
    const colorLight = baseColor.brighter(0.6).toString();
    const innerRadiusRatio = 0.4; 
    const minOuterRadiusDisplay = 8;

    let dataIndex = 0;
    for (let row = 0; row < rows; row++) {
        const itemsInThisRow = itemsPerRow[row];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;
        for (let colIdx = 0; colIdx < itemsInThisRow; colIdx++) {
            if (dataIndex >= numCharts) break;
            const d = sortedData[dataIndex];
            const chartCenterX = margin.left + rowOffset + (colIdx + 0.5) * cellWidth;
            const chartCenterY = margin.top + (row + 0.5) * cellHeight;
            
            const chartGroup = svg.append("g").attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);
            
            // ---------- 10. 绘制五角星和图标 ----------
            const maxPossibleOuterRadius = cellRadius; 
            const proportionalOuterRadius = maxValue > 0 ? maxPossibleOuterRadius * Math.sqrt(d[valueField] / maxValue) : 0;
            
            let displayOuterRadius = proportionalOuterRadius;
            if (proportionalOuterRadius > 0 && proportionalOuterRadius < minOuterRadiusDisplay) {
                displayOuterRadius = minOuterRadiusDisplay;
            }
            const displayInnerRadius = displayOuterRadius * innerRadiusRatio;

            if (displayOuterRadius > 0) {
                const starVertices = getStarPoints(5, displayOuterRadius, displayInnerRadius);
                const iconUrl = jsonData.images?.field?.[d[dimensionField]];

                // 绘制10个三角形面以形成3D效果
                for (let i = 0; i < 10; i++) {
                    const p1 = starVertices[i];
                    const p2 = starVertices[(i + 1) % 10];
                    const trianglePathData = `M 0,0 L ${p1[0]},${p1[1]} L ${p2[0]},${p2[1]} Z`;
                    chartGroup.append("path")
                        .attr("d", trianglePathData)
                        .attr("fill", (i % 2 === 0) ? colorDark : colorLight)
                        .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
                }

                if (iconUrl && displayInnerRadius > 1) { // 仅当内半径足够大时显示图标
                    const innerPentagonVertices = [
                        starVertices[1],
                        starVertices[3],
                        starVertices[5],
                        starVertices[7],
                        starVertices[9]
                    ];
                    const clipId = `clip-pentagon-${dataIndex}`;

                    defs.append("clipPath")
                        .attr("id", clipId)
                        .append("polygon")
                        .attr("points", innerPentagonVertices.map(p => p.join(",")).join(" "));

                    const iconBoxSize = displayInnerRadius * 2.1; // 确保覆盖内五边形
                    chartGroup.append("image")
                        .attr("x", -iconBoxSize / 2)
                        .attr("y", -iconBoxSize / 2)
                        .attr("width", iconBoxSize)
                        .attr("height", iconBoxSize)
                        .attr("xlink:href", iconUrl)
                        .attr("preserveAspectRatio", "xMidYMid slice")
                        .attr("clip-path", `url(#${clipId})`);
                }

                // 如果需要描边，绘制一个整体的星星轮廓 (在图标和3D面之上)
                if (variables.has_stroke) {
                    const outerStarPath = d3.line()(starVertices) + "Z";
                    chartGroup.append("path")
                        .attr("d", outerStarPath)
                        .attr("fill", "none")
                        .attr("stroke", colors.text_color || "#333333")
                        .attr("stroke-width", 1) 
                        .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
                }
            }
            
            // ---------- 11. 添加标签 ----------
            chartGroup.append("text") // 维度标签
                .attr("x", 0)
                .attr("y", -cellRadius - 10) 
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(d[dimensionField]);
            
            const valueTextContent = valueUnit ? `${formatValue(d[valueField])} ${valueUnit}` : formatValue(d[valueField]);
            chartGroup.append("text") // 数值标签
                .attr("x", 0)
                .attr("y", displayOuterRadius + 5) 
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", adjustedValueFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(valueTextContent);
            
            dataIndex++;
        }
    }
    
    return svg.node();
} 