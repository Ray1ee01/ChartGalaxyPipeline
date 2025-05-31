/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Hexagon)",
    "chart_name": "proportional_area_chart_hexagon_01",
    "is_composite": false,
    "required_fields": ["x","y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "stroke"],
    "min_height": 300,
    "min_width": 300,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// Proportional Area Chart (Hexagon) - 使用D3.js
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
        other: { primary: "#FF4136" }
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
    // 过滤掉值为0的数据点，并按值降序排序
    const sortedData = [...chartData]
        .filter(d => d[valueField] > 0) // 过滤掉值为0的数据点
        .sort((a, b) => b[valueField] - a[valueField]);
    const maxValue = sortedData.length > 0 ? sortedData[0][valueField] : 0; // 确保有数据时才取值
    
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
        const valText = tempSvg.append("text").style("font-family", typography.annotation.font_family).style("font-size", typography.annotation.font_size).style("font-weight", typography.annotation.font_weight).text(valueUnit ? `${d[valueField]} ${valueUnit}` : d[valueField]);
        maxValueWidth = Math.max(maxValueWidth, valText.node().getBBox().width);
        valText.remove();
    });
    tempSvg.remove();
    
    const spacingFactorHorizontal = 0.15;
    const spacingFactorVertical = 0.15;
    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    // 'radius' here means half the max dimension of the shape's bounding box in the cell
    const radius = Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10; 
    
    // ---------- 7. 检查文本是否会溢出并调整字体大小 ----------
    const maxChartAreaWidth = radius * 2.8; // Max width for text based on cell's capacity for a shape
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
    
    // ---------- 8. 创建六边形路径生成函数 ----------
    const hexagonPath = (sideLength) => {
        // 六边形的顶点坐标，从30度开始以使平边朝上
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = ((i * 60) + 30) * Math.PI / 180; // 从30度开始，60度一个点
            const x = sideLength * Math.sin(angle);
            const y = -sideLength * Math.cos(angle);
            points.push([x, y]);
        }
        // 构建路径
        return d3.line()(points) + "Z";
    };
    
    // ---------- 9. 为每个数据点创建图形 ----------
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
            
            // ---------- 10. 绘制六边形 ----------
            // 使用半径而不是边长，以确保六边形的外接圆半径与数值成比例
            const maxPossibleRadius = radius;
            const proportionalRadius = maxValue > 0 ? maxPossibleRadius * Math.sqrt(d[valueField] / maxValue) : 0;
            
            let displayRadius = proportionalRadius;
            if (proportionalRadius > 0 && proportionalRadius < 10) { // 最小半径为10
                displayRadius = 10;
            }

            if (displayRadius > 0) { // 仅当半径为正时绘制
                chartGroup.append("path")
                    .attr("d", hexagonPath(displayRadius))
                    .attr("fill", colors.other.primary || "#FF4136")
                    .attr("stroke", variables.has_stroke ? (colors.text_color || "#333333") : "none")
                    .attr("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
                    .style("opacity", 0.85);
            }
            
            // ---------- 11. 添加标签 ----------
            chartGroup.append("text") // 维度标签
                .attr("x", 0)
                .attr("y", -radius - 10) // 定位在图形可能的最大范围之上
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(d[dimensionField]);
            
            const valueTextContent = valueUnit ? `${formatValue(d[valueField])} ${valueUnit}` : formatValue(d[valueField]);
            const valueLabel = chartGroup.append("text")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", adjustedValueFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .text(valueTextContent);

            const labelBBox = valueLabel.node().getBBox();
            
            // 计算六边形内接圆半径，约为外接圆半径的0.866倍
            const innerRadius = displayRadius * 0.866;
            const canFitInside = displayRadius >= 15 && // 确保六边形足够大
                                 labelBBox.width < innerRadius * 1.5 && 
                                 labelBBox.height < innerRadius * 1.5;

            if (canFitInside) {
                valueLabel
                    .attr("x", 0)
                    .attr("y", 0) 
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "central") 
                    .style("fill", "#FFFFFF");
            } else {
                valueLabel
                    .attr("x", 0)
                    .attr("y", displayRadius + 3) // 定位在六边形下方
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging") 
                    .style("fill", colors.text_color || "#333333");
            }
            
            dataIndex++;
        }
    }
    
    return svg.node();
} 