/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Line Graph",
  "chart_name": "multiple_line_graph_06",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 30], [0, "inf"], [2, 8]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data; // Renamed for clarity
    const chartDataArray = chartConfig.data.data;
    const variables = chartConfig.variables || {};
    const typographyConfig = chartConfig.typography || {};
    const colorsConfig = chartConfig.colors_dark || chartConfig.colors || {}; // Prioritize dark theme colors
    const imagesConfig = chartConfig.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = chartConfig.data.columns || [];

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    const missingFields = [];
    if (!xFieldConfig) missingFields.push("x role");
    if (!yFieldConfig) missingFields.push("y role");
    if (!groupFieldConfig) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: Roles [${missingFields.join(', ')}] not found in data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            try {
                d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
            } catch (e) { /* Suppress errors if d3 or containerSelector is invalid */ }
        }
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const errorMsg = `Critical chart config missing: Field names for roles x, y, or group are undefined. Cannot render.`;
        console.error(errorMsg);
         if (containerSelector) {
            try {
                d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
            } catch (e) { /* Suppress errors if d3 or containerSelector is invalid */ }
        }
        return null;
    }
    
    const container = d3.select(containerSelector);
    if (container.empty()) {
        console.error(`Container element "${containerSelector}" not found. Cannot render chart.`);
        return null;
    }
    container.html(""); // Clear the container

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            axisLabelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            axisLabelFontSize: typographyConfig.label?.font_size || '12px',
            axisLabelFontWeight: typographyConfig.label?.font_weight || 'normal',
        },
        textColor: colorsConfig.text_color || '#E0E0E0', // Default light text for dark background
        axisLineColor: colorsConfig.other?.primary || '#9badd3', // Use 'primary' or a specific axis color if available
        chartBackground: colorsConfig.background_color || '#121212', // Default dark background
        defaultLineStrokeWidth: 2, // Standardized stroke width
    };

    // Color scale for lines based on group
    const availableColors = colorsConfig.available_colors || d3.schemeCategory10;
    const colorScale = d3.scaleOrdinal(availableColors);
    fillStyle.getLineColor = (groupValue) => {
        if (colorsConfig.field && colorsConfig.field[groupFieldName] && colorsConfig.field[groupFieldName][groupValue]) {
            return colorsConfig.field[groupFieldName][groupValue];
        }
        if (colorsConfig.field && colorsConfig.field[groupValue]) { // Fallback if groupFieldName key isn't used in colors.field
             return colorsConfig.field[groupValue];
        }
        return colorScale(groupValue);
    };
    
    // Helper to parse date strings (assuming they are valid for new Date())
    function parseDate(dateString) {
        return new Date(dateString);
    }

    // Helper for X-axis scale and ticks (adapted from original)
    function createXAxisScaleAndTicks(data, xField, minXRange, maxXRange) {
        const dates = data.map(d => parseDate(d[xField])).filter(d => !isNaN(d)).sort((a, b) => a - b);
        if (dates.length === 0) {
            // Handle no valid dates: create a default 1-day domain
            const today = new Date();
            const tomorrow = d3.timeDay.offset(today, 1);
            const xScale = d3.scaleTime().domain([today, tomorrow]).range([minXRange, maxXRange]);
            return { xScale, xTicks: xScale.ticks(2), xFormat: d3.timeFormat("%m/%d"), timeSpan: 1 };
        }

        let minDate = dates[0];
        let maxDate = dates[dates.length - 1];

        const timeSpanDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);

        let xTicks, xFormat;

        if (minDate.getTime() === maxDate.getTime()) { // Single point in time
            minDate = d3.timeDay.offset(dates[0], -1);
            maxDate = d3.timeDay.offset(dates[0], 1);
            xTicks = [minDate, dates[0], maxDate];
            xFormat = d3.timeFormat("%m/%d %H:%M"); // More precise for single point
        } else if (timeSpanDays <= 30) {
            xTicks = d3.timeDay.every(Math.max(1, Math.ceil(timeSpanDays / 7))).range(minDate, maxDate);
            if (xTicks.length < 2) xTicks = [minDate, maxDate];
            xFormat = d3.timeFormat("%m/%d");
        } else if (timeSpanDays <= 365 * 2) {
            xTicks = d3.timeMonth.every(Math.max(1, Math.ceil(timeSpanDays / 30 / 6))).range(minDate, maxDate);
            if (xTicks.length < 2) xTicks = [minDate, maxDate];
            xFormat = d3.timeFormat("%Y/%m");
        } else {
            xTicks = d3.timeYear.every(Math.max(1, Math.ceil(timeSpanDays / 365 / 7))).range(minDate, maxDate);
            if (xTicks.length < 2) xTicks = [minDate, maxDate];
            xFormat = d3.timeFormat("%Y");
        }
        
        if (xTicks.length === 0 && dates.length > 0) xTicks = [dates[0]]; // Fallback if range is too small for .every()

        const xScale = d3.scaleTime()
            .domain([minDate, maxDate])
            .range([minXRange, maxXRange]);
        
        // Ensure ticks are within the final domain
        xTicks = xTicks.filter(tick => tick.getTime() >= xScale.domain()[0].getTime() && tick.getTime() <= xScale.domain()[1].getTime());
        if (xTicks.length < 2 && xScale.domain()[0].getTime() < xScale.domain()[1].getTime()) {
             xTicks = xScale.ticks(Math.min(5, Math.ceil(timeSpanDays/2) || 2)); // Auto ticks if custom logic fails
        }
        if (xTicks.length === 0 && dates.length > 0) { // Absolute fallback
            xTicks = [xScale.domain()[0], xScale.domain()[1]];
        }


        return { xScale, xTicks, xFormat, timeSpan: timeSpanDays };
    }
    
    // In-memory text measurement (not strictly needed if no legend/labels, but kept for compliance)
    function estimateTextWidth(text, fontProps) {
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.axisLabelFontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.axisLabelFontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.axisLabelFontWeight);
        textElement.textContent = text;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.appendChild(textElement); // Append to an in-memory SVG, not to DOM
        let width = 0;
        try {
            width = textElement.getComputedTextLength();
        } catch (e) {
            // Fallback for environments where getComputedTextLength might fail without DOM
            const avgCharWidth = (parseFloat(fontProps.fontSize || fillStyle.typography.axisLabelFontSize) || 12) * 0.6;
            width = text.length * avgCharWidth;
        }
        return width;
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 600;

    const svgRoot = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 30, bottom: 50, left: 50 }; // Adjusted right margin as no end-labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort(); // Sort groups for consistent color mapping

    // (Data transformation per group will happen in Block 8 before drawing lines)

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartDataArray, xFieldName, 0, innerWidth);

    const yDataValues = chartDataArray.map(d => parseFloat(d[yFieldName])).filter(v => !isNaN(v));
    const yMinVal = yDataValues.length > 0 ? d3.min(yDataValues) : 0;
    const yMaxVal = yDataValues.length > 0 ? d3.max(yDataValues) : 0;
    
    const yDomainMin = Math.min(0, yMinVal < 0 ? yMinVal * 1.2 : yMinVal * 0.8); // Extend slightly below data min or 0
    const yDomainMax = yMaxVal * 1.1 || 10; // Extend slightly above data max, or default if no data

    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0])
        .nice();


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Y-Axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    yAxisGroup.append("line") // Y-axis line
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1)
        .attr("class", "axis-line");

    yScale.ticks(5).forEach(tickValue => {
        if (tickValue === 0 && yDomainMin < 0 && yDomainMax > 0) { // Don't draw tick line for 0 if it's not an edge
             // but still draw label
        } else {
            yAxisGroup.append("line") // Tick line
                .attr("class", "tick-line")
                .attr("x1", -5)
                .attr("y1", yScale(tickValue))
                .attr("x2", 0) 
                .attr("y2", yScale(tickValue))
                .attr("stroke", fillStyle.axisLineColor)
                .attr("stroke-width", 1);
        }
        yAxisGroup.append("text")
            .attr("class", "label y-axis-label")
            .attr("x", -10)
            .attr("y", yScale(tickValue))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(tickValue);
    });

    // X-Axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .attr("class", "axis x-axis");

    xAxisGroup.append("line") // X-axis line
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", innerWidth)
        .attr("y2", 0)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1)
        .attr("class", "axis-line");

    xTicks.forEach((tickValue, i) => {
        xAxisGroup.append("line") // Tick line
            .attr("class", "tick-line")
            .attr("x1", xScale(tickValue))
            .attr("y1", 0)
            .attr("x2", xScale(tickValue))
            .attr("y2", 5)
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);

        let textAnchor = "middle";
        if (i === 0 && xScale(tickValue) < chartMargins.left/2) textAnchor = "start"; // Avoid collision with Y axis labels
        if (i === xTicks.length - 1 && xScale(tickValue) > innerWidth - chartMargins.right/2) textAnchor = "end";

        xAxisGroup.append("text")
            .attr("class", "label x-axis-label")
            .attr("x", xScale(tickValue))
            .attr("y", 20)
            .attr("text-anchor", textAnchor)
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(xFormat(tickValue));
    });

    // No Legend as per requirements ("legend": "none")
    // No Gridlines as per requirements ("gridLineType": "none")

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const lineGenerator = d3.line()
        .x(d => xScale(parseDate(d[xFieldName])))
        .y(d => yScale(parseFloat(d[yFieldName])))
        .defined(d => d[xFieldName] != null && d[yFieldName] != null && !isNaN(parseFloat(d[yFieldName])) && !isNaN(parseDate(d[xFieldName]).getTime()) ); // Ensure data is valid

    groups.forEach(groupValue => {
        let groupData = chartDataArray
            .filter(d => d[groupFieldName] === groupValue)
            .sort((a, b) => parseDate(a[xFieldName]) - parseDate(b[xFieldName])); // Sort data by date for line

        // Data transformation: Extend line to the end of the x-axis if last point is earlier
        if (groupData.length > 0) {
            const xMaxDate = xScale.domain()[1];
            const lastDataPointDate = parseDate(groupData[groupData.length - 1][xFieldName]);
            if (lastDataPointDate.getTime() < xMaxDate.getTime()) {
                const endPoint = { ...groupData[groupData.length - 1] }; // Clone last point
                endPoint[xFieldName] = xMaxDate; // Set date to axis end (as Date object)
                // y-value remains the same as the last actual data point
                groupData = [...groupData, endPoint];
            }
        }
        
        if (groupData.length > 1) { // Need at least two points to draw a line
            mainChartGroup.append("path")
                .datum(groupData)
                .attr("class", "mark line series-" + String(groupValue).replace(/\s+/g, '-')) // Sanitize groupValue for class
                .attr("fill", "none")
                .attr("stroke", fillStyle.getLineColor(groupValue))
                .attr("stroke-width", fillStyle.defaultLineStrokeWidth)
                .attr("d", lineGenerator);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No end-of-line labels as per requirements ("dataLabelPosition": "none")
    // No other annotations or interactive elements specified.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}