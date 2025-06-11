/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_standardized",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[1, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 300,
  "min_width": 300,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Could be data.colors_dark for dark themes, adapt if necessary
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");

    if (!xFieldCol || !yFieldCol) {
        let missing = [];
        if (!xFieldCol) missing.push("x role");
        if (!yFieldCol) missing.push("y role");
        const errorMsg = `Critical chart config missing: column roles [${missing.join(', ')}] not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = xFieldCol.name;
    const valueFieldName = yFieldCol.name;

    if (!categoryFieldName || !valueFieldName) {
        let missing = [];
        if (!categoryFieldName) missing.push("x field name");
        if (!valueFieldName) missing.push("y field name");
        const errorMsg = `Critical chart config missing: field names for roles [${missing.join(', ')}] are undefined. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    
    const valueFieldUnit = (yFieldCol.unit && yFieldCol.unit !== "none") ? yFieldCol.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        barColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4', // Default D3 blue
        textColor: colors.text_color || '#0f223b', // Default dark blue/black
        axisLineColor: colors.text_color || '#CCCCCC', // Default light gray for axis lines if shown
        chartBackground: colors.background_color || '#FFFFFF',
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            // Title and annotation fonts are defined here for completeness, though not used in this chart
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        }
    };

    function formatValue(value) {
        if (value >= 1000000000) {
            return d3.format("~s")(value).replace('G', 'B'); // Use 'B' for billions
        } else if (value >= 1000000) {
            return d3.format("~s")(value);
        } else if (value >= 1000) {
            return d3.format("~s")(value);
        }
        return d3.format("~g")(value); // For smaller numbers or when no suffix applies
    }
    
    // estimateTextWidth utility (as required, though not actively used for layout in this version)
    function estimateTextWidth(text, fontProps) {
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.style.fontFamily = fontProps.font_family || fillStyle.typography.labelFontFamily;
        textElement.style.fontSize = fontProps.font_size || fillStyle.typography.labelFontSize;
        textElement.style.fontWeight = fontProps.font_weight || fillStyle.typography.labelFontWeight;
        textElement.textContent = text;
    
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.appendChild(textElement);
        // getBBox on an unattached element can be unreliable.
        let width = 0;
        try {
            width = textElement.getBBox().width;
            if (width === 0 && text && text.length > 0) { // Fallback for common issue
                const fontSize = parseFloat(textElement.style.fontSize) || 12;
                width = text.length * fontSize * 0.6; 
            }
        } catch (e) {
            console.warn("estimateTextWidth: getBBox failed. Using crude fallback.", e);
            const fontSize = parseFloat(textElement.style.fontSize) || 12;
            width = text.length * fontSize * 0.6;
        }
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 20,
        right: (variables.margin_right || 60) + (valueFieldUnit.length * (parseFloat(fillStyle.typography.labelFontSize)*0.6)), // Adjust right margin for value labels and unit
        bottom: 30,
        left: variables.margin_left || 120 // Generous left margin for Y-axis labels
    };
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartData.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure value is numeric
    }));
    // Sorting is not applied as per valueSortDirection: "none"

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerHeight])
        .padding(variables.bar_padding || 0.3);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 0]) // Ensure domain starts at 0, handle empty data
        .range([0, innerWidth])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxis = d3.axisBottom(xScale)
        .ticks(variables.x_axis_ticks || 5)
        .tickFormat(d => formatValue(d) + (valueFieldUnit ? ` ${valueFieldUnit}` : ''))
        .tickSize(0)
        .tickPadding(10);

    mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove()) // Remove X-axis line
        .selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("opacity", 0); // Hide X-axis text as per original behavior (minimal axis)

    const yAxis = d3.axisLeft(yScale)
        .tickSize(0) // Remove Y-axis tick marks
        .tickPadding(10);

    mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis)
        .call(g => g.select(".domain").remove()) // Remove Y-axis line
        .selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label"); // Add class to tick labels

    // Block 8: Main Data Visualization Rendering
    mainChartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar") // Standardized class
        .attr("y", d => yScale(d.category))
        .attr("x", 0)
        .attr("height", yScale.bandwidth())
        .attr("width", d => Math.max(0, xScale(d.value))) // Ensure width is not negative
        .attr("fill", fillStyle.barColor);

    mainChartGroup.selectAll(".value-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label value-label") // Standardized class
        .attr("y", d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr("x", d => xScale(d.value) + 5) // Position to the right of the bar
        .attr("dy", ".35em") // Vertical centering
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "start")
        .text(d => formatValue(d.value) + (valueFieldUnit ? ` ${valueFieldUnit}` : ''));

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}