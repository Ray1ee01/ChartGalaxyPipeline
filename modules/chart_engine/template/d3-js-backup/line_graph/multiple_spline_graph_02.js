/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Spline Graph",
  "chart_name": "multiple_spline_graph_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 8]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, use data.colors_dark for dark theme if specified
    const images = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    const missingFields = [];
    if (!xFieldConfig) missingFields.push("x role");
    if (!yFieldConfig) missingFields.push("y role");
    if (!groupFieldConfig) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: Column roles not found for ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;
    const yFieldLabel = yFieldConfig.label || yFieldName;


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#333333',
        axisLineColor: colors.other && colors.other.axis_line ? colors.other.axis_line : '#888888',
        gridLineColor: colors.other && colors.other.grid_line ? colors.other.grid_line : '#e0e0e0',
        backgroundColor: colors.background_color || '#FFFFFF',
        getGroupColor: (group, index, allGroups) => {
            if (colors.field && colors.field[groupFieldName] && colors.field[groupFieldName][group]) {
                return colors.field[groupFieldName][group];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return d3.schemeCategory10[index % 10];
        }
    };

    function estimateTextWidth(text, fontProps) {
        const defaultFontSize = fillStyle.typography.labelFontSize;
        const defaultFontFamily = fillStyle.typography.labelFontFamily;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        svg.style.width = 'auto';
        svg.style.height = 'auto';

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        textElement.style.fontFamily = (fontProps && fontProps.fontFamily) || defaultFontFamily;
        textElement.style.fontSize = (fontProps && fontProps.fontSize) || defaultFontSize;
        textElement.style.fontWeight = (fontProps && fontProps.fontWeight) || fillStyle.typography.labelFontWeight;

        svg.appendChild(textElement);
        // Temporarily append to body to ensure getBBox works in some environments, then remove.
        // This is a common workaround, though the spec says it shouldn't be needed.
        document.body.appendChild(svg);
        const width = textElement.getBBox().width;
        document.body.removeChild(svg);
        return width;
    }

    // Helper to parse date strings, assuming they are in a format Date.parse can handle
    function parseDate(dateStr) {
        const parsed = new Date(dateStr);
        return isNaN(parsed) ? null : parsed;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 150, bottom: 60, left: 70 }; // Adjusted right margin for labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartData.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: parseFloat(d[yFieldName])
    })).filter(d => d[xFieldName] !== null && !isNaN(d[yFieldName]));

    if (processedChartData.length === 0) {
        const errorMsg = "No valid data points after processing. Cannot render chart.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const groups = [...new Set(processedChartData.map(d => d[groupFieldName]))].sort((a, b) => {
        const aLastPoint = processedChartData.filter(d => d[groupFieldName] === a).sort((p1, p2) => p2[xFieldName] - p1[xFieldName])[0];
        const bLastPoint = processedChartData.filter(d => d[groupFieldName] === b).sort((p1, p2) => p2[xFieldName] - p1[xFieldName])[0];
        if (aLastPoint && bLastPoint) {
            return bLastPoint[yFieldName] - aLastPoint[yFieldName]; // Sort descending by last Y value
        }
        return 0;
    });


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(processedChartData, d => d[xFieldName]))
        .range([0, innerWidth]);

    const yMin = d3.min(processedChartData, d => d[yFieldName]);
    const yMax = d3.max(processedChartData, d => d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([Math.min(0, yMin * (yMin > 0 ? 0.9 : 1.1)), yMax * 1.1]) // Ensure 0 is included if all positive, extend slightly
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // X-Axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .attr("class", "axis x-axis")
        .call(d3.axisBottom(xScale).ticks(Math.min(10, innerWidth / 80)).tickSizeOuter(0));

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("fill", fillStyle.textColor);

    xAxisGroup.selectAll("line, path")
        .attr("class", "axis-line")
        .style("stroke", fillStyle.axisLineColor);

    // Y-Axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickSizeOuter(0));

    yAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("fill", fillStyle.textColor);

    yAxisGroup.selectAll("line, path")
        .attr("class", "axis-line")
        .style("stroke", fillStyle.axisLineColor);

    // Gridlines
    // Horizontal gridlines
    mainChartGroup.append("g")
        .attr("class", "grid grid-y")
        .selectAll("line")
        .data(yScale.ticks())
        .enter().append("line")
        .attr("class", "grid-line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-dasharray", "2,2");

    // Vertical gridlines
    mainChartGroup.append("g")
        .attr("class", "grid grid-x")
        .selectAll("line")
        .data(xScale.ticks(Math.min(10, innerWidth / 80)))
        .enter().append("line")
        .attr("class", "grid-line")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-dasharray", "2,2");

    // Y-Axis Label
    mainChartGroup.append("text")
        .attr("class", "label y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - chartMargins.left + 20) // Adjust position
        .attr("x", 0 - (innerHeight / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(yFieldLabel);

    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveMonotoneX);

    groups.forEach((group, i) => {
        const groupData = processedChartData.filter(d => d[groupFieldName] === group)
            .sort((a, b) => a[xFieldName] - b[xFieldName]); // Ensure data is sorted by x-value for line generator

        if (groupData.length > 0) {
            mainChartGroup.append("path")
                .datum(groupData)
                .attr("class", "mark line-series")
                .attr("fill", "none")
                .attr("stroke", fillStyle.getGroupColor(group, i, groups))
                .attr("stroke-width", 2)
                .attr("d", lineGenerator);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing (End-of-line labels)
    const labelPadding = 5;
    const labelLineHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.2;
    let lastLabelYPositions = [];

    groups.forEach((group, i) => {
        const groupData = processedChartData.filter(d => d[groupFieldName] === group)
            .sort((a, b) => a[xFieldName] - b[xFieldName]);

        if (groupData.length > 0) {
            const lastPoint = groupData[groupData.length - 1];
            let targetY = yScale(lastPoint[yFieldName]);

            // Basic overlap avoidance for labels
            let adjustedY = targetY;
            let attempts = 0;
            const maxAttempts = 20;
            while (attempts < maxAttempts && lastLabelYPositions.some(posY => Math.abs(posY - adjustedY) < labelLineHeight)) {
                adjustedY += (targetY > innerHeight / 2) ? -labelLineHeight * 0.5 : labelLineHeight * 0.5; // Move away from center
                 if (adjustedY < 0 || adjustedY > innerHeight) { // If out of bounds, try other direction
                    adjustedY = targetY - ( (targetY > innerHeight / 2) ? -labelLineHeight * 0.5 : labelLineHeight * 0.5);
                 }
                attempts++;
            }
             if (attempts === maxAttempts) adjustedY = targetY; // Fallback if too many attempts

            lastLabelYPositions.push(adjustedY);
            lastLabelYPositions.sort((a,b) => a-b);


            const labelGroup = mainChartGroup.append("g")
                .attr("class", "label-group value")
                .attr("transform", `translate(${innerWidth + labelPadding}, ${adjustedY})`);

            // Line connecting actual point to label y position if adjusted
            if (Math.abs(targetY - adjustedY) > 1) {
                 labelGroup.append("line")
                    .attr("class", "label-connector")
                    .attr("x1", 0)
                    .attr("y1", 0)
                    .attr("x2", xScale(lastPoint[xFieldName]) - (innerWidth + labelPadding))
                    .attr("y2", targetY - adjustedY)
                    .attr("stroke", fillStyle.getGroupColor(group, i, groups))
                    .attr("stroke-width", 1)
                    .attr("stroke-dasharray", "2,2");
            }

            labelGroup.append("text")
                .attr("class", "text group-name-label")
                .attr("x", labelPadding)
                .attr("y", 0)
                .attr("dy", "0.35em") // Vertical alignment
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", "bold")
                .style("fill", fillStyle.getGroupColor(group, i, groups))
                .style("text-anchor", "start")
                .text(group);

            const valueText = `${Math.round(lastPoint[yFieldName] * 10) / 10}`; // Format to one decimal place
            const groupNameWidth = estimateTextWidth(group, { fontSize: fillStyle.typography.labelFontSize, fontWeight: "bold" });

            labelGroup.append("text")
                .attr("class", "text value-label")
                .attr("x", labelPadding + groupNameWidth + labelPadding) // Position after group name
                .attr("y", 0)
                .attr("dy", "0.35em") // Vertical alignment
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("fill", fillStyle.textColor)
                .style("text-anchor", "start")
                .text(`(${valueText})`);
        }
    });


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}