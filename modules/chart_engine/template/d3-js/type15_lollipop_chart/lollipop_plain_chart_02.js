/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Lollipop Chart",
    "chart_name": "lollipop_plain_chart_02",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 12], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": [],
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

// 垂直lollipop_plain_chart#2实现 - 使用D3.js
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
    const height = variables.height || 600;
    const margin = { top: 40, right: 60, bottom: 90, left: 60 };

    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "dimension";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "value";
    let valueUnit = "";
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y")?.unit;
    }

    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);

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

    const xScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerWidth])
        .padding(0.2);

    const columnWidth = xScale.bandwidth();
    const barWidth = Math.max(columnWidth * 0.6, 15);
    const iconRadius = barWidth / 2;

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueField]) * 1.1])
        .range([innerHeight - iconRadius * 2, 0]);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // 网格线
    const gridValues = yScale.ticks(5);
    gridValues.forEach(value => {
        g.append("line")
            .attr("class", "gridline")
            .attr("x1", 0)
            .attr("y1", yScale(value))
            .attr("x2", innerWidth)
            .attr("y2", yScale(value))
            .attr("stroke", "#e0e0e0")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");
    });

    // Y轴
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat(d => formatValue(d));

    const yAxisGroup = g.append("g")
        .attr("class", "axis")
        .call(yAxis);

    yAxisGroup.select(".domain").attr("stroke", "none");
    yAxisGroup.selectAll(".tick text")
        .attr("class", "value")
        .style("font-family", typography.annotation.font_family)
        .style("font-size", "12px")
        .style("fill", colors.text_color);

    const primaryColor = colors.other && colors.other.primary ? colors.other.primary : "#F7941D";

    sortedData.forEach((d, i) => {
        const dimension = d[dimensionField];
        const value = +d[valueField];
        const x = xScale(dimension);
        const circleX = x + columnWidth / 2;
        const circleY = yScale(value);

        // 绘制垂直线条
        g.append("line")
            .attr("class", "mark")
            .attr("x1", circleX)
            .attr("y1", innerHeight)
            .attr("x2", circleX)
            .attr("y2", circleY)
            .attr("stroke", primaryColor)
            .attr("stroke-width", barWidth / 4);

        // 维度标签（底部）
        g.append("text")
            .attr("class", "label")
            .attr("x", circleX)
            .attr("y", innerHeight + 20)
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
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

        // 圆圈内数值标签
        const formattedValue = formatValue(value);
        g.append("text")
            .attr("class", "value")
            .attr("x", circleX)
            .attr("y", circleY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", `${Math.min(iconRadius * 1.2, Math.max(iconRadius * 0.8, 12))}px`)
            .style("font-weight", typography.annotation.font_weight)
            .style("fill", "#ffffff")
            .text(formattedValue);

        // 单位标签（仅第一个）
        if (i === 0 && valueUnit) {
            g.append("text")
                .attr("class", "text")
                .attr("x", circleX)
                .attr("y", circleY - iconRadius - 15)
                .attr("text-anchor", "middle")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", "12px")
                .style("font-weight", "normal")
                .style("fill", colors.text_color)
                .text(valueUnit);
        }
    });

    return svg.node();
}