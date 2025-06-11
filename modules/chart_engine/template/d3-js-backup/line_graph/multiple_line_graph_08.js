/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Line Graph",
  "chart_name": "multiple_line_graph_08",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 30], [0, "inf"], [2, 7]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 800,
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "subtle",
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
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    // Prioritize colors_dark if background is dark, otherwise use colors
    const rawColors = data.colors_dark || data.colors || {};
    const rawImages = data.images || {}; // Though not used in this specific chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    let criticalConfigError = false;
    let missingFields = [];
    if (!xFieldConfig) missingFields.push("x field configuration (role: 'x')");
    if (!yFieldConfig) missingFields.push("y field configuration (role: 'y')");
    if (!groupFieldConfig) missingFields.push("group field configuration (role: 'group')");

    if (missingFields.length > 0) {
        criticalConfigError = true;
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;
    const yFieldLabel = yFieldConfig.label || yFieldName;


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = (rawTypography.title && rawTypography.title.font_family) || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = (rawTypography.title && rawTypography.title.font_size) || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = (rawTypography.title && rawTypography.title.font_weight) || defaultTypography.title.font_weight;

    fillStyle.typography.labelFontFamily = (rawTypography.label && rawTypography.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (rawTypography.label && rawTypography.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (rawTypography.label && rawTypography.label.font_weight) || defaultTypography.label.font_weight;
    
    fillStyle.typography.annotationFontFamily = (rawTypography.annotation && rawTypography.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (rawTypography.annotation && rawTypography.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (rawTypography.annotation && rawTypography.annotation.font_weight) || defaultTypography.annotation.font_weight;


    // Color defaults (assuming dark theme based on original)
    fillStyle.colors.chartBackground = rawColors.background_color || '#1E1E1E'; // Dark background
    fillStyle.colors.textColor = rawColors.text_color || '#FFFFFF';
    fillStyle.colors.axisColor = rawColors.text_color || '#CCCCCC';
    fillStyle.colors.gridLineColor = rawColors.other && rawColors.other.grid_subtle ? rawColors.other.grid_subtle : 'rgba(255, 255, 255, 0.2)';
    fillStyle.colors.defaultLineColor = rawColors.other && rawColors.other.primary ? rawColors.other.primary : '#007bff';
    fillStyle.colors.xAxisTickBg = rawColors.other && rawColors.other.xAxisTickBg ? rawColors.other.xAxisTickBg : '#fde7e5'; // From original
    fillStyle.colors.xAxisTickText = rawColors.other && rawColors.other.xAxisTickText ? rawColors.other.xAxisTickText : '#333333'; // From original

    fillStyle.getColorForGroup = (group) => {
        if (rawColors.field && rawColors.field[groupFieldName] && rawColors.field[groupFieldName][group]) {
            return rawColors.field[groupFieldName][group];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            // Simple hash function to pick a color consistently
            let hash = 0;
            for (let i = 0; i < group.length; i++) {
                hash = group.charCodeAt(i) + ((hash << 5) - hash);
            }
            return rawColors.available_colors[Math.abs(hash) % rawColors.available_colors.length];
        }
        return fillStyle.colors.defaultLineColor;
    };
    
    // In-memory text measurement utility
    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but forbidden.
        // This in-memory approach might be less accurate for complex fonts or kerning.
        // For robustness in a real scenario, a hidden live SVG element might be used.
        try {
            return textElement.getComputedTextLength ? textElement.getComputedTextLength() : (text.length * (parseInt(fontProps.fontSize) || 12) * 0.6); // Fallback approximation
        } catch (e) {
            return text.length * (parseInt(fontProps.fontSize) || 12) * 0.6; // Fallback if getBBox fails on non-rendered element
        }
    }

    // Date parsing utility
    function parseDate(dateString) {
        const parsed = d3.isoParse(dateString) || new Date(dateString);
        return isNaN(parsed.getTime()) ? null : parsed;
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
        .style("background-color", fillStyle.colors.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 60, bottom: 60, left: 0 }; // Left margin 0 as per original
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName]
    })).filter(d => d[xFieldName] !== null && !isNaN(d[yFieldName]));

    if (chartDataArray.length === 0) {
        console.error("No valid data points after parsing. Cannot render chart.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>No valid data to display.</div>");
        return null;
    }
    
    chartDataArray.sort((a, b) => a[xFieldName] - b[xFieldName]); // Sort by date for line chart

    const uniqueGroups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    const groupedData = uniqueGroups.map(group => {
        return {
            group: group,
            values: chartDataArray.filter(d => d[groupFieldName] === group),
            color: fillStyle.getColorForGroup(group)
        };
    });

    // Block 6: Scale Definition & Configuration
    const xExtent = d3.extent(chartDataArray, d => d[xFieldName]);
    const xScale = d3.scaleTime()
        .domain(xExtent)
        .range([0, innerWidth]);

    const yMin = d3.min(chartDataArray, d => d[yFieldName]);
    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const yRange = yMax - yMin;
    // Add some padding to y-axis unless range is zero
    const yDomainMin = yRange === 0 ? yMin - 1 : yMin - yRange * 0.2;
    const yDomainMax = yRange === 0 ? yMax + 1 : yMax + yRange * 0.2;
    
    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0]);

    // X-axis ticks and format (simplified from original's missing helper)
    let xTicks, xFormat;
    const timeSpanDays = (xExtent[1] - xExtent[0]) / (1000 * 60 * 60 * 24);
    if (timeSpanDays > 365 * 2) { // Multiple years
        xTicks = xScale.ticks(d3.timeYear.every(Math.max(1, Math.floor(timeSpanDays / (365 * 2))))); // Aim for ~2-3 ticks
        xFormat = d3.timeFormat("%Y");
    } else if (timeSpanDays > 60) { // Multiple months
        xTicks = xScale.ticks(d3.timeMonth.every(Math.max(1, Math.floor(timeSpanDays / 60)))); // Aim for ~2-3 ticks
        xFormat = d3.timeFormat("%b %Y");
    } else { // Days
        xTicks = xScale.ticks(d3.timeDay.every(Math.max(1, Math.floor(timeSpanDays / 5)))); // Aim for ~5 ticks
        xFormat = d3.timeFormat("%b %d");
    }
    if (xTicks.length === 0 && xExtent[0] && xExtent[1]) { // Ensure at least start and end if possible
        xTicks = [xExtent[0], xExtent[1]];
    }


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    // Custom X-axis (line in middle, rects for ticks)
    const xAxisYPosition = innerHeight / 2;

    mainChartGroup.append("line")
        .attr("class", "axis x-axis-line")
        .attr("x1", -chartMargins.left) // Extend to full SVG width
        .attr("y1", xAxisYPosition)
        .attr("x2", innerWidth + chartMargins.right) // Extend to full SVG width
        .attr("y2", xAxisYPosition)
        .attr("stroke", fillStyle.colors.axisColor)
        .attr("stroke-width", 1)
        .attr("opacity", 0.5)
        .attr("stroke-dasharray", "1,1");

    const xAxisTicksGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis-ticks");

    xTicks.forEach(tick => {
        const xPos = xScale(tick);
        const tickText = xFormat(tick);
        const tickTextWidth = estimateTextWidth(tickText, { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: "11px", // As per original
            fontWeight: "bold" // As per original
        });

        const rectWidth = tickTextWidth + 10;
        const rectHeight = 18; // Slightly larger to fit text better

        xAxisTicksGroup.append("rect")
            .attr("class", "x-axis-tick-bg mark")
            .attr("x", xPos - rectWidth / 2)
            .attr("y", xAxisYPosition - rectHeight / 2)
            .attr("width", rectWidth)
            .attr("height", rectHeight)
            .attr("rx", 6)
            .attr("ry", 6)
            .attr("fill", fillStyle.colors.xAxisTickBg);

        xAxisTicksGroup.append("text")
            .attr("class", "x-axis-tick-label label")
            .attr("x", xPos)
            .attr("y", xAxisYPosition) // Vertically centered by dominant-baseline
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily) // Use token
            .style("font-size", "11px") // Specific size from original
            .style("font-weight", "bold") // Specific weight from original
            .style("fill", fillStyle.colors.xAxisTickText)
            .text(tickText);
    });

    // Horizontal gridlines
    mainChartGroup.selectAll(".grid-line")
        .data(yScale.ticks(5))
        .enter()
        .append("line")
        .attr("class", "grid-line other")
        .attr("x1", -chartMargins.left) // Extend to full SVG width
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth + chartMargins.right) // Extend to full SVG width
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.colors.gridLineColor)
        .attr("stroke-width", 1);

    // Y-axis tick values (labels inside chart area)
    mainChartGroup.selectAll(".y-axis-tick-label")
        .data(yScale.ticks(5))
        .enter()
        .append("text")
        .attr("class", "y-axis-tick-label label")
        .attr("x", 10) // Position inside chart area
        .attr("y", d => yScale(d) + 15) // Offset for better readability
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(d => d.toLocaleString());


    // Block 8: Main Data Visualization Rendering (Lines, End Markers)
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    groupedData.forEach(gd => {
        if (gd.values.length === 0) return;

        mainChartGroup.append("path")
            .datum(gd.values)
            .attr("class", "data-line mark")
            .attr("fill", "none")
            .attr("stroke", gd.color)
            .attr("stroke-width", 3)
            .attr("d", lineGenerator);

        // End-of-line marker (rect + value) and group label
        const lastPoint = gd.values[gd.values.length - 1];
        const xEnd = xScale(lastPoint[xFieldName]);
        const yEnd = yScale(lastPoint[yFieldName]);

        const valueText = lastPoint[yFieldName].toFixed(1);
        const valueTextFontProps = { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: "12px", // As per original
            fontWeight: "bold" // As per original
        };
        const valueTextWidth = estimateTextWidth(valueText, valueTextFontProps);
        
        const markerRectWidth = valueTextWidth + 10;
        const markerRectHeight = 18; // Adjusted for better padding
        const markerRectX = xEnd + 5; // Position to the right of the line end
        const markerRectY = yEnd - markerRectHeight / 2;

        mainChartGroup.append("rect")
            .attr("class", "line-end-marker-bg mark")
            .attr("x", markerRectX)
            .attr("y", markerRectY)
            .attr("width", markerRectWidth)
            .attr("height", markerRectHeight)
            .attr("rx", 6)
            .attr("ry", 6)
            .attr("fill", gd.color);

        mainChartGroup.append("text")
            .attr("class", "line-end-value-label value")
            .attr("x", markerRectX + markerRectWidth / 2)
            .attr("y", markerRectY + markerRectHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", valueTextFontProps.fontFamily)
            .style("font-size", valueTextFontProps.fontSize)
            .style("font-weight", valueTextFontProps.fontWeight)
            .style("fill", fillStyle.colors.chartBackground) // Contrasting color (e.g. background)
            .text(valueText);

        // Group name label
        const groupLabelFontProps = {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: "14px", // As per original
            fontWeight: "bold" // As per original
        };
        mainChartGroup.append("text")
            .attr("class", "line-end-group-label label")
            .attr("x", markerRectX + markerRectWidth + 8) // Space after marker
            .attr("y", markerRectY + markerRectHeight / 2)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", groupLabelFontProps.fontFamily)
            .style("font-size", groupLabelFontProps.fontSize)
            .style("font-weight", groupLabelFontProps.fontWeight)
            .style("fill", gd.color)
            .text(gd.group);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Y-axis encoding name and triangle for the highest ending line
    let highestEndGroupData = null;
    let highestEndValue = -Infinity;

    groupedData.forEach(gd => {
        if (gd.values.length > 0) {
            const lastPoint = gd.values[gd.values.length - 1];
            if (lastPoint[yFieldName] > highestEndValue) {
                highestEndValue = lastPoint[yFieldName];
                highestEndGroupData = gd;
            }
        }
    });

    if (highestEndGroupData && highestEndGroupData.values.length > 0) {
        const lastPoint = highestEndGroupData.values[highestEndGroupData.values.length - 1];
        const xEndHighest = xScale(lastPoint[xFieldName]);
        const yEndHighest = yScale(lastPoint[yFieldName]);

        const annotationFontProps = {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: "bold" // As per original for this label
        };
        
        const yAxisLabelText = yFieldLabel;
        const yAxisLabelTextWidth = estimateTextWidth(yAxisLabelText, annotationFontProps);
        
        // Position above the end of the highest line, centered on its x-coordinate
        const labelX = xEndHighest;
        const labelY = yEndHighest - 30; // Offset above the line

        mainChartGroup.append("text")
            .attr("class", "y-axis-encoding-label annotation")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "alphabetic") // baseline for text above pointer
            .style("font-family", annotationFontProps.fontFamily)
            .style("font-size", annotationFontProps.fontSize)
            .style("font-weight", annotationFontProps.fontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(yAxisLabelText);

        // Triangle pointing down to the line end
        const triangleSize = 6;
        const triangleY = labelY + 5; // Below the text, pointing down

        mainChartGroup.append("path")
            .attr("class", "y-axis-encoding-pointer mark")
            .attr("d", `M${labelX},${triangleY + triangleSize} L${labelX - triangleSize / 1.5},${triangleY} L${labelX + triangleSize / 1.5},${triangleY} Z`)
            .attr("fill", fillStyle.colors.textColor);
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}