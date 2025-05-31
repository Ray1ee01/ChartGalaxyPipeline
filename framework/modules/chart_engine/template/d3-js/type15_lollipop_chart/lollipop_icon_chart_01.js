/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Lollipop Chart",
    "chart_name": "lollipop_icon_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], [1, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
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


// 水平lollipop_icon_chart实现 - 使用D3.js
function makeChart(containerSelector, data) {
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "14px", font_weight: "bold" },
        description: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "16px", font_weight: "bold" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    d3.select(containerSelector).html("");

    const width = variables.width || 800;
    let height = variables.height || 600;
    const margin = { top: 90, right: 40, bottom: 60, left: 60 };

    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "dimension";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "value";
    let valueUnit = "";
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y")?.unit;
    }

    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);

    // 动态调整高度
    if (sortedDimensions.length > 15) {
        const extraDimensions = sortedDimensions.length - 15;
        const heightAdjustmentFactor = 1 + (extraDimensions * 0.03);
        height = Math.round(height * heightAdjustmentFactor);
    }

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(0.2);

    const rowHeight = yScale.bandwidth();
    const barHeight = Math.max(rowHeight * 0.6, 15);
    const iconRadius = barHeight / 2;
    const iconPadding = iconRadius / 4;

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueField]) * 1.1])
        .range([0, innerWidth - (iconRadius * 2 + iconPadding * 4)]);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // 网格线
    const gridValues = xScale.ticks(5);
    gridValues.forEach(value => {
        g.append("line")
            .attr("class", "gridline")
            .attr("x1", xScale(value))
            .attr("y1", 0)
            .attr("x2", xScale(value))
            .attr("y2", innerHeight)
            .attr("stroke", "#e0e0e0")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");
    });

    // X轴
    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat(d => formatValue(d));

    const xAxisGroup = g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.select(".domain").attr("stroke", "none");
    xAxisGroup.selectAll(".tick text")
        .attr("class", "value")
        .style("font-family", typography.annotation.font_family)
        .style("font-size", "12px")
        .style("fill", colors.text_color);

    const primaryColor = colors.other && colors.other.primary ? colors.other.primary : "#F7941D";

    sortedData.forEach((d, i) => {
        const dimension = d[dimensionField];
        const value = +d[valueField];
        const y = yScale(dimension);
        const barWidth = xScale(value);
        const circleX = barWidth;
        const circleY = y + barHeight / 2;

        // 绘制线条
        g.append("line")
            .attr("class", "mark")
            .attr("x1", 0)
            .attr("y1", y + barHeight / 2)
            .attr("x2", barWidth)
            .attr("y2", y + barHeight / 2)
            .attr("stroke", primaryColor)
            .attr("stroke-width", barHeight / 4);

        // 计算标签位置
        const tempText = g.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("visibility", "hidden")
            .text(dimension);
        const dimLabelWidth = tempText.node().getBBox().width;
        tempText.remove();

        const circleLeftEdge = circleX - iconRadius;
        const labelPadding = 5;
        let labelX = 0;
        let labelAnchor = "start";
        let labelY = y;
        let labelFontSize = typography.label.font_size;

        if (dimLabelWidth > circleLeftEdge - labelPadding) {
            labelX = circleX + iconRadius + labelPadding;
            const availableHeight = barHeight * 0.6;
            const originalSize = parseFloat(labelFontSize);
            const reducedSize = Math.max(8, Math.min(originalSize, availableHeight));
            labelFontSize = `${reducedSize}px`;
        }

        // 维度标签
        g.append("text")
            .attr("class", "label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", labelAnchor)
            .style("font-family", typography.label.font_family)
            .style("font-size", labelFontSize)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(dimension);

        // 圆圈
        g.append("circle")
            .attr("class", "mark")
            .attr("cx", circleX)
            .attr("cy", circleY)
            .attr("r", iconRadius)
            .attr("fill", primaryColor);

        // 图标
        if (images.field && images.field[dimension]) {
            const iconSize = iconRadius * 1.5;
            g.append("image")
                .attr("class", "image")
                .attr("x", circleX - iconSize / 2)
                .attr("y", circleY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", images.field[dimension]);
        }

        // 数值标签
        const formattedValue = `${formatValue(value)}${valueUnit ? ` ${valueUnit}` : ''}`;
        g.append("text")
            .attr("class", "value")
            .attr("x", circleX + iconRadius + iconPadding * 2)
            .attr("y", circleY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", `${Math.min(20, Math.max(barHeight * 0.5, parseFloat(typography.annotation.font_size)))}px`)
            .style("font-weight", typography.annotation.font_weight)
            .style("fill", colors.text_color)
            .text(formattedValue);
    });

    return svg.node();
}