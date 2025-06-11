/* REQUIREMENTS_BEGIN
{
  "chart_type": "Lollipop Chart",
  "chart_name": "lollipop_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // Note: The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // Assuming light theme, or use data.colors_dark if a theme mechanism is present
    // const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;

    if (!dimensionField || !valueField) {
        console.error("Critical chart config missing: dimensionField or valueField from dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration (dimension or value field) is missing.</div>");
        return null;
    }

    let valueUnit = dataColumns.find(col => col.role === "y")?.unit;
    if (valueUnit === "none") {
        valueUnit = "";
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            title: { // Not used in this chart, but defined per spec
                font_family: (rawTypography.title && rawTypography.title.font_family) ? rawTypography.title.font_family : "Arial, sans-serif",
                font_size: (rawTypography.title && rawTypography.title.font_size) ? rawTypography.title.font_size : "16px",
                font_weight: (rawTypography.title && rawTypography.title.font_weight) ? rawTypography.title.font_weight : "bold",
            },
            label: {
                font_family: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : "Arial, sans-serif",
                font_size: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : "12px",
                font_weight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : "normal",
            },
            annotation: {
                font_family: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : "Arial, sans-serif",
                font_size: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : "10px",
                font_weight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : "normal",
            }
        },
        textColor: rawColors.text_color || "#0f223b",
        primaryColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : "#1f77b4",
        gridLineColor: "#e0e0e0", // Default, not from config
        lollipopValueColor: "#ffffff", // Default, for text inside circle
        chartBackground: rawColors.background_color || "#FFFFFF" // Not directly used to set SVG bg, but available
    };

    // Helper: Text measurement (in-memory)
    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-weight', fontWeight);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-family', fontFamily);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but forbidden by spec.
        // This in-memory approach might be less accurate in some browsers/contexts for getBBox.
        // For simple cases or if not critically relied upon for layout, it's okay.
        // A common workaround is to append to DOM, measure, then remove, but spec says "MUST NOT be appended".
        // If getBBox on an unattached element is unreliable, this helper's utility is limited.
        // For this chart, it's not critically used.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails (e.g. in a very restricted environment or for empty text)
            return text.length * (parseInt(fontSize, 10) || 10) * 0.6; // Rough estimate
        }
    }

    // Helper: Value formatting
    const formatValue = (value) => {
        if (value == null || isNaN(value)) return "";
        if (Math.abs(value) >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (Math.abs(value) >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (Math.abs(value) >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Optional: set background color

    const chartMargins = { top: 40, right: 60, bottom: 90, left: 60 }; // Original margins

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => +b[valueField] - +a[valueField]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerWidth])
        .padding(0.2);

    const columnWidth = xScale.bandwidth();
    // lollipopCircleRadius and lollipopStemThickness are derived from columnWidth, similar to original logic
    const lollipopCircleRadius = Math.max(columnWidth * 0.6, 15) / 2; // Original: barWidth / 2, barWidth = max(colWidth*0.6, 15)
    const lollipopStemThickness = lollipopCircleRadius * 2 / 4; // Original: barWidth / 4 => (lollipopCircleRadius*2) / 4

    // Effective top padding for lollipop elements, similar to original iconRadius * 2 in yScale range
    const yAxisEffectiveTopPadding = lollipopCircleRadius * 2;

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueField]) * 1.1 || 10]) // Added || 10 for empty/all-zero data
        .range([innerHeight - yAxisEffectiveTopPadding, 0]);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Gridlines
    const gridValues = yScale.ticks(5);
    mainChartGroup.append("g")
        .attr("class", "gridlines")
        .selectAll("line.gridline")
        .data(gridValues)
        .enter()
        .append("line")
        .attr("class", "gridline")
        .attr("x1", 0)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // Y-Axis
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat(d => formatValue(d));

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    yAxisGroup.select(".domain").remove(); // No axis line

    yAxisGroup.selectAll(".tick text")
        .attr("class", "label") // Standardized class
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .style("fill", fillStyle.textColor);

    // Block 8: Main Data Visualization Rendering
    const lollipopGroup = mainChartGroup.append("g")
        .attr("class", "lollipop-group");

    sortedData.forEach((d, i) => {
        const dimension = d[dimensionField];
        const value = +d[valueField];

        const xPos = xScale(dimension) + columnWidth / 2;
        const yPosCircle = yScale(value);
        const yPosStemBase = innerHeight; // Stems start from the bottom of the chart area

        // Lollipop Stem
        lollipopGroup.append("line")
            .attr("class", "mark lollipop-stem")
            .attr("x1", xPos)
            .attr("y1", yPosStemBase)
            .attr("x2", xPos)
            .attr("y2", yPosCircle)
            .attr("stroke", fillStyle.primaryColor)
            .attr("stroke-width", lollipopStemThickness);

        // Lollipop Circle
        lollipopGroup.append("circle")
            .attr("class", "mark lollipop-circle")
            .attr("cx", xPos)
            .attr("cy", yPosCircle)
            .attr("r", lollipopCircleRadius)
            .attr("fill", fillStyle.primaryColor);

        // Value Label (inside circle)
        const formattedValue = formatValue(value);
        const valueLabelFontSize = Math.min(lollipopCircleRadius * 1.2, Math.max(lollipopCircleRadius * 0.8, parseInt(fillStyle.typography.annotation.font_size) * 0.8, 9)); // Adjusted dynamic sizing slightly
        
        lollipopGroup.append("text")
            .attr("class", "value data-label")
            .attr("x", xPos)
            .attr("y", yPosCircle)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotation.font_family)
            .style("font-size", `${valueLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.annotation.font_weight)
            .style("fill", fillStyle.lollipopValueColor)
            .text(formattedValue);

        // Dimension Label (bottom)
        lollipopGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", xPos)
            .attr("y", innerHeight + 20) // Position below the chart area
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", fillStyle.typography.label.font_size)
            .style("font-weight", fillStyle.typography.label.font_weight)
            .style("fill", fillStyle.textColor)
            .text(dimension);

        // Unit Label (for first lollipop, if unit exists)
        if (i === 0 && valueUnit) {
            lollipopGroup.append("text")
                .attr("class", "text unit-label")
                .attr("x", xPos) // Centered with the first lollipop
                .attr("y", yPosCircle - lollipopCircleRadius - 15) // Above the first circle
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotation.font_family)
                .style("font-size", fillStyle.typography.annotation.font_size) // Use annotation size
                .style("font-weight", fillStyle.typography.annotation.font_weight)
                .style("fill", fillStyle.textColor)
                .text(valueUnit);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No enhancements in this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}