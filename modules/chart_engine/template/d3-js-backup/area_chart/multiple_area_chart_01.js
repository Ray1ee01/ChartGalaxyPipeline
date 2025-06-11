/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Area Chart",
  "chart_name": "multiple_area_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

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
    const rawChartData = data.data?.data;
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors_dark || data.colors || {}; // Prefer dark theme if available
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getField = (role) => dataColumns.find(col => col.role === role);

    const xFieldDef = getField(xFieldRole);
    const yFieldDef = getField(yFieldRole);
    const groupFieldDef = getField(groupFieldRole);

    const xFieldName = xFieldDef?.name;
    const yFieldName = yFieldDef?.name;
    const groupFieldName = groupFieldDef?.name;
    
    const yFieldLabel = yFieldDef?.label || yFieldName;

    const criticalFields = { xFieldName, yFieldName, groupFieldName };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    if (!rawChartData || rawChartData.length === 0) {
        const errorMsg = "Chart data is missing or empty. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: rawTypography.label?.font_family || "Arial, sans-serif",
            labelFontSize: rawTypography.label?.font_size || "12px",
            labelFontWeight: rawTypography.label?.font_weight || "normal",
            annotationFontFamily: rawTypography.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: rawTypography.annotation?.font_size || "14px", // Group labels were 14px
            annotationFontWeight: rawTypography.annotation?.font_weight || "bold", // Group labels were bold
        },
        textColor: rawColors.text_color || "#E0E0E0",
        chartBackground: rawColors.background_color || "#121212",
        axisLineColor: rawColors.other?.axis_line || "#888888", // Generic axis line
        centerBand: {
            background: rawColors.other?.center_band_bg || "#1F1F1F",
            lineColor: rawColors.other?.center_band_line || "#555555",
            tickColor: rawColors.other?.center_band_tick || "#CCCCCC",
        },
        groupSideLabel: {
            backgroundColor: rawColors.other?.group_label_bg || "#333333",
            // Text color for side labels will be the group's data color
        },
        defaultGroupColorPalette: d3.schemeCategory10,
        getGroupColor: (groupName, index) => {
            if (rawColors.field && rawColors.field[groupFieldName] && rawColors.field[groupFieldName][groupName]) {
                return rawColors.field[groupFieldName][groupName];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[index % rawColors.available_colors.length];
            }
            return fillStyle.defaultGroupColorPalette[index % fillStyle.defaultGroupColorPalette.length];
        }
    };

    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontProps.fontFamily || 'Arial, sans-serif');
        textEl.setAttribute('font-size', fontProps.fontSize || '12px');
        textEl.setAttribute('font-weight', fontProps.fontWeight || 'normal');
        textEl.textContent = text;
        svg.appendChild(textEl);
        let width = 0;
        try {
            // getBBox on unattached elements is not universally reliable.
            // This adheres to "MUST NOT be appended to the document DOM".
            width = textEl.getBBox().width;
            if (width === 0 && text.length > 0) { // Safari might return 0 for unattached
                 throw new Error("getBBox returned 0 for unattached element.");
            }
        } catch (e) {
            const fontSize = parseFloat(fontProps.fontSize || '12px') || 12;
            width = text.length * (fontSize * 0.6); // Rough fallback
            console.warn("estimateTextWidth: getBBox on unattached SVG text element failed or returned 0, using rough estimate.", e.message);
        }
        return width;
    }

    function parseDate(dateString) {
        if (!dateString) return null;
        // Handle if it's already a Date object
        if (dateString instanceof Date && !isNaN(dateString)) {
            return dateString;
        }
        let parsedDate;
        // Try ISO format first, then general parsing
        parsedDate = d3.isoParse(dateString);
        if (parsedDate) return parsedDate;

        // If it's just a year "YYYY"
        if (/^\d{4}$/.test(String(dateString))) {
            return new Date(String(dateString), 0, 1); // Jan 1st of that year
        }
        
        parsedDate = new Date(dateString);
        if (isNaN(parsedDate.getTime())) {
            console.warn(`Failed to parse date: ${dateString}`);
            return null;
        }
        return parsedDate;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink") // For potential image use, though not in this chart
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 20, bottom: 60, left: 20 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "chart-area");

    const centerAreaWidth = 60; // Width for central year labels
    const halfCenterAreaWidth = centerAreaWidth / 2;

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName] // Ensure y is numeric
    })).filter(d => d[xFieldName] !== null && !isNaN(d[yFieldName]));

    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points after parsing. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }
    
    chartDataArray.sort((a, b) => a[xFieldName] - b[xFieldName]);

    let uniqueGroups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    if (uniqueGroups.length > 2) {
        console.warn(`This chart is designed for two groups, but data has ${uniqueGroups.length}. Using the first two: ${uniqueGroups.slice(0,2).join(', ')}.`);
        uniqueGroups = uniqueGroups.slice(0, 2);
    }
    if (uniqueGroups.length < 2 && uniqueGroups.length > 0) {
         console.warn(`This chart is designed for two groups, but data has ${uniqueGroups.length}. The visualization might look incomplete.`);
    }
     if (uniqueGroups.length === 0) {
        const errorMsg = "No groups found in data. Cannot render this chart type.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(chartDataArray, d => d[xFieldName]))
        .range([0, innerHeight]);

    const yMax = d3.max(chartDataArray, d => d[yFieldName]) * 1.05 || 1; // Add 5% padding, ensure not 0

    const yScaleLeft = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerWidth / 2 - halfCenterAreaWidth, 0]); // From center-left outwards to left edge

    const yScaleRight = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerWidth / 2 + halfCenterAreaWidth, innerWidth]); // From center-right outwards to right edge

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Center band for X-axis (year) labels
    mainChartGroup.append("rect")
        .attr("class", "center-band-background other")
        .attr("x", innerWidth / 2 - halfCenterAreaWidth)
        .attr("y", 0)
        .attr("width", centerAreaWidth)
        .attr("height", innerHeight)
        .attr("fill", fillStyle.centerBand.background);

    mainChartGroup.append("line")
        .attr("class", "center-band-line mark")
        .attr("x1", innerWidth / 2 - halfCenterAreaWidth)
        .attr("y1", 0)
        .attr("x2", innerWidth / 2 - halfCenterAreaWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.centerBand.lineColor)
        .attr("stroke-width", 1);

    mainChartGroup.append("line")
        .attr("class", "center-band-line mark")
        .attr("x1", innerWidth / 2 + halfCenterAreaWidth)
        .attr("y1", 0)
        .attr("x2", innerWidth / 2 + halfCenterAreaWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.centerBand.lineColor)
        .attr("stroke-width", 1);

    // X-axis ticks and labels (vertical, in the center)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis");
    
    const xNumTicks = Math.max(2, Math.floor(innerHeight / 50)); // Dynamic number of ticks
    const xTicks = xScale.ticks(xNumTicks);
    const xTickFormat = d3.timeFormat("%Y");

    xTicks.forEach(tick => {
        xAxisGroup.append("text")
            .attr("class", "label")
            .attr("x", innerWidth / 2)
            .attr("y", xScale(tick))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xTickFormat(tick));

        xAxisGroup.append("line") // Left tick mark
            .attr("class", "mark")
            .attr("x1", innerWidth / 2 - halfCenterAreaWidth + 10)
            .attr("y1", xScale(tick))
            .attr("x2", innerWidth / 2 - halfCenterAreaWidth)
            .attr("y2", xScale(tick))
            .attr("stroke", fillStyle.centerBand.tickColor)
            .attr("stroke-width", 1.5);

        xAxisGroup.append("line") // Right tick mark
            .attr("class", "mark")
            .attr("x1", innerWidth / 2 + halfCenterAreaWidth)
            .attr("y1", xScale(tick))
            .attr("x2", innerWidth / 2 + halfCenterAreaWidth - 10)
            .attr("y2", xScale(tick))
            .attr("stroke", fillStyle.centerBand.tickColor)
            .attr("stroke-width", 1.5);
    });

    // Y-axis ticks and labels (horizontal, at the bottom)
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    const yNumTicks = 5;
    const yTicks = d3.ticks(0, yMax, yNumTicks);

    yTicks.forEach(tick => {
        // Left side ticks
        if (yScaleLeft(tick) >= 0) { // Ensure tick is within the positive range of the scale
            yAxisGroup.append("text")
                .attr("class", "label")
                .attr("x", yScaleLeft(tick))
                .attr("y", innerHeight + 20)
                .attr("text-anchor", "middle")
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .text(tick);
        }

        // Right side ticks
         if (yScaleRight(tick) <= innerWidth) { // Ensure tick is within the positive range of the scale
            yAxisGroup.append("text")
                .attr("class", "label")
                .attr("x", yScaleRight(tick))
                .attr("y", innerHeight + 20)
                .attr("text-anchor", "middle")
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .text(tick);
         }
    });

    // Y-axis title (bottom center)
    if (yFieldLabel) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title y-axis-title")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight + chartMargins.bottom - 15) // Adjusted position
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize) // Could use a different size if defined
            .style("font-weight", "bold") // Often axis titles are bold
            .text(yFieldLabel);
    }

    // Block 8: Main Data Visualization Rendering
    uniqueGroups.forEach((group, i) => {
        const groupColor = fillStyle.getGroupColor(group, i);
        const groupData = chartDataArray.filter(d => d[groupFieldName] === group);
        // Data is already sorted by xFieldName (time)

        const currentYScale = i === 0 ? yScaleLeft : yScaleRight;
        const areaBaseline = i === 0 ? innerWidth / 2 - halfCenterAreaWidth : innerWidth / 2 + halfCenterAreaWidth;

        const areaGenerator = d3.area()
            .x0(areaBaseline)
            .x1(d => currentYScale(d[yFieldName]))
            .y(d => xScale(d[xFieldName]))
            .curve(d3.curveLinear);

        mainChartGroup.append("path")
            .datum(groupData)
            .attr("class", `mark area area-group-${i}`)
            .attr("fill", groupColor)
            .attr("d", areaGenerator);

        // Group labels (side labels)
        const labelText = String(group);
        const labelFontSize = fillStyle.typography.annotationFontSize;
        const labelFontFamily = fillStyle.typography.annotationFontFamily;
        const labelFontWeight = fillStyle.typography.annotationFontWeight;

        // Estimate width for background rect
        const textWidth = estimateTextWidth(labelText, { fontSize: labelFontSize, fontFamily: labelFontFamily, fontWeight: labelFontWeight });
        const rectPadding = { x: 6, y: 4 };
        const rectWidth = textWidth + 2 * rectPadding.x;
        const rectHeight = parseFloat(labelFontSize) + 2 * rectPadding.y;
        
        const labelYPos = innerHeight / 2;

        if (i === 0) { // Left group
            mainChartGroup.append("rect")
                .attr("class", "other group-label-background")
                .attr("x", 2)
                .attr("y", labelYPos - rectHeight / 2)
                .attr("width", rectWidth)
                .attr("height", rectHeight)
                .attr("fill", fillStyle.groupSideLabel.backgroundColor);

            mainChartGroup.append("text")
                .attr("class", "label group-label")
                .attr("x", 2 + rectPadding.x)
                .attr("y", labelYPos)
                .attr("text-anchor", "start")
                .attr("dominant-baseline", "middle")
                .attr("fill", groupColor)
                .style("font-family", labelFontFamily)
                .style("font-size", labelFontSize)
                .style("font-weight", labelFontWeight)
                .text(labelText);
        } else { // Right group
             mainChartGroup.append("rect")
                .attr("class", "other group-label-background")
                .attr("x", innerWidth - 2 - rectWidth)
                .attr("y", labelYPos - rectHeight / 2)
                .attr("width", rectWidth)
                .attr("height", rectHeight)
                .attr("fill", fillStyle.groupSideLabel.backgroundColor);

            mainChartGroup.append("text")
                .attr("class", "label group-label")
                .attr("x", innerWidth - 2 - rectPadding.x)
                .attr("y", labelYPos)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("fill", groupColor)
                .style("font-family", labelFontFamily)
                .style("font-size", labelFontSize)
                .style("font-weight", labelFontWeight)
                .text(labelText);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No additional enhancements in this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}