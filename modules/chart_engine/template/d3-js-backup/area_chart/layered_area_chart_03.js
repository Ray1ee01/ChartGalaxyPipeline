/* REQUIREMENTS_BEGIN
{
  "chart_type": "Layered Area Chart",
  "chart_name": "layered_area_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 6]],
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
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || data.colors || {}; // Prefer dark theme if available
    const imagesConfig = data.images || {}; // Though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    if (!xFieldConfig || !yFieldConfig || !groupFieldConfig) {
        const missing = [
            !xFieldConfig ? "x field" : null,
            !yFieldConfig ? "y field" : null,
            !groupFieldConfig ? "group field" : null
        ].filter(Boolean).join(', ');
        const errorMsg = `Critical chart config missing: [${missing} role definition in dataColumns]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    // Assuming temporalFilter is a simple filter, let's define a basic one if not available globally.
    // For this refactoring, we'll assume chartData is already appropriately filtered or doesn't need it.
    // If temporalFilter was complex, it would need to be provided or inlined.
    // const chartData = temporalFilter(rawChartData, xFieldName); // Original call
    let chartData = rawChartData.map(d => ({...d})); // Make a mutable copy

    if (chartData.length === 0) {
        console.warn("Chart data is empty after initial processing.");
        // Optionally render a message in the container
        d3.select(containerSelector).html("<div style='font-family: sans-serif; padding: 10px;'>No data to display.</div>");
        return null;
    }
    
    // Parse dates early
    const parseDate = d3.timeParse("%Y-%m-%d"); // Assuming "YYYY-MM-DD" format, adjust if different
    chartData.forEach(d => {
        d[xFieldName] = parseDate(d[xFieldName]);
    });
    chartData = chartData.filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]));


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyConfig.title?.font_size || '16px',
            titleFontWeight: typographyConfig.title?.font_weight || 'bold',
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        },
        textColor: colorsConfig.text_color || '#D0D0D0', // Default for dark theme
        axisLineColor: colorsConfig.other?.axis_line || '#9badd3', // Example semantic token
        gridLineColor: colorsConfig.other?.grid_line || '#87aac0', // Example semantic token
        chartBackground: colorsConfig.background_color || '#1E1E1E', // Default for dark theme
        defaultGroupColors: d3.schemeCategory10,
        getGroupColor: (groupName, index) => {
            if (colorsConfig.field && colorsConfig.field[groupName]) {
                return colorsConfig.field[groupName];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
            }
            return fillStyle.defaultGroupColors[index % fillStyle.defaultGroupColors.length];
        }
    };
    
    // In-memory text measurement utility
    function estimateTextWidth(text, fontProps = {}) {
        const { fontFamily = fillStyle.typography.labelFontFamily, fontSize = fillStyle.typography.labelFontSize, fontWeight = fillStyle.typography.labelFontWeight } = fontProps;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM.
        // For simple cases, this might suffice. If not, a temporary append/remove is needed.
        // However, the prompt says "MUST NOT be appended to the document DOM".
        // A common workaround is to have a hidden SVG in the DOM for measurements,
        // or accept that getBBox on non-rendered elements can be inconsistent.
        // For this exercise, we follow the "no DOM append" strictly.
        try {
            return textEl.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails (e.g. in some test environments)
            return text.length * (parseFloat(fontSize) * 0.6);
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("class", "chart-root");
        // No viewBox, width/height are absolute.
        // Removed xmlns:xlink as it's not strictly needed for modern SVG unless using xlink:href for older browser compatibility.

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 80, bottom: 50, left: 70 }; // Adjusted right margin for labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))]
        .sort((a, b) => {
            const aLast = chartData.filter(d => d[groupFieldName] === a && d[xFieldName]).sort((da, db) => da[xFieldName] - db[xFieldName]).slice(-1)[0];
            const bLast = chartData.filter(d => d[groupFieldName] === b && d[xFieldName]).sort((da, db) => da[xFieldName] - db[xFieldName]).slice(-1)[0];
            if (!aLast || !bLast) return 0; // Handle cases where a group might be empty after filtering
            return aLast[yFieldName] - bLast[yFieldName];
        });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(chartData, d => d[xFieldName]))
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d[yFieldName]) * 1.2]) // Adjusted multiplier for padding
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .attr("class", "axis x-axis")
        .call(d3.axisBottom(xScale).ticks(5).tickSizeOuter(0)); // Example: 5 ticks

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    xAxisGroup.selectAll("line, path")
        .attr("class", "axis-tick") // "line" for ticks, "path" for domain path
        .style("stroke", fillStyle.axisLineColor);
    
    // Custom X-axis line (if specific styling needed beyond d3.axis)
    // mainChartGroup.append("line")
    //     .attr("class", "axis-line x-axis-line")
    //     .attr("x1", 0) // Adjusted to start from 0, not -40
    //     .attr("y1", innerHeight)
    //     .attr("x2", innerWidth)
    //     .attr("y2", innerHeight)
    //     .attr("stroke", fillStyle.axisLineColor)
    //     .attr("opacity", 0.6)
    //     .attr("stroke-width", 1);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".0f")).tickSizeOuter(0)); // Example: 5 ticks, integer format

    yAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);
        
    yAxisGroup.selectAll("line, path")
        .attr("class", "axis-tick")
        .style("stroke", fillStyle.axisLineColor);

    // Gridlines
    mainChartGroup.append("g")
        .attr("class", "grid y-grid")
        .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(""))
        .selectAll("line")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-opacity", 0.2);
    mainChartGroup.selectAll(".y-grid .domain").remove(); // Remove y-axis line from grid

    mainChartGroup.append("g")
        .attr("class", "grid x-grid")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(5).tickSize(-innerHeight).tickFormat(""))
        .selectAll("line")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-opacity", 0.2);
    mainChartGroup.selectAll(".x-grid .domain").remove(); // Remove x-axis line from grid
    
    // Block 8: Main Data Visualization Rendering (e.g., Areas)
    const areaGenerator = d3.area()
        .x(d => xScale(d[xFieldName]))
        .y0(innerHeight)
        .y1(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear); // Removed .defined for simplicity, ensure data is clean

    // Draw areas (reversed for correct layering)
    [...groups].reverse().forEach((group, index) => {
        const groupData = chartData.filter(d => d[groupFieldName] === group && d[xFieldName] && d[yFieldName] != null);
        if (groupData.length < 2) return; // Area needs at least 2 points

        mainChartGroup.append("path")
            .datum(groupData)
            .attr("class", "mark area-mark")
            .attr("fill", fillStyle.getGroupColor(group, groups.length - 1 - index)) // Use reversed index for color consistency
            .attr("opacity", 0.7) // Simplified opacity, removed gradients/shadows
            .attr("d", areaGenerator);
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Labels)
    const lastDate = xScale.domain()[1]; // Get the last date from the scale domain

    // Last date annotation (simplified)
    const lastDateAnnotationGroup = mainChartGroup.append("g").attr("class", "annotation last-date-annotation");
    
    lastDateAnnotationGroup.append("line")
        .attr("class", "annotation-line")
        .attr("x1", xScale(lastDate))
        .attr("y1", 0) // Top of the chart
        .attr("x2", xScale(lastDate))
        .attr("y2", innerHeight)
        .style("stroke", fillStyle.textColor)
        .style("stroke-width", 1)
        .style("stroke-dasharray", "3,3")
        .style("opacity", 0.5);

    lastDateAnnotationGroup.append("text")
        .attr("class", "label annotation-label")
        .attr("x", xScale(lastDate))
        .attr("y", -5) // Position above the chart area slightly
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("fill", fillStyle.textColor)
        .text(d3.timeFormat("%Y")(lastDate)); // Format as year, adjust if needed

    // Final value labels for each group
    let prevLabelYBase = null;
    const minLabelDistance = parseFloat(fillStyle.typography.labelFontSize) * 2.5; // Min distance based on font size

    groups.forEach((group, groupIndex) => {
        const groupData = chartData.filter(d => d[groupFieldName] === group && d[xFieldName] && d[yFieldName] != null)
                                   .sort((a, b) => a[xFieldName] - b[xFieldName]);
        if (groupData.length === 0) return;

        const lastPoint = groupData[groupData.length - 1];
        const groupColor = fillStyle.getGroupColor(group, groupIndex);

        let labelY = yScale(lastPoint[yFieldName]);
        const labelX = xScale(lastPoint[xFieldName]) + 5; // Slight offset to the right of the area end

        // Adjust labelY to avoid overlap
        if (prevLabelYBase !== null && Math.abs(prevLabelYBase - labelY) < minLabelDistance) {
            if (prevLabelYBase > labelY) { // Current label is above previous
                labelY = prevLabelYBase - minLabelDistance;
            } else { // Current label is below previous
                labelY = prevLabelYBase + minLabelDistance;
            }
        }
        // Ensure label is within chart bounds
        labelY = Math.max(parseFloat(fillStyle.typography.labelFontSize), Math.min(innerHeight - parseFloat(fillStyle.typography.labelFontSize), labelY));
        prevLabelYBase = labelY;
        
        const labelGroup = mainChartGroup.append("g").attr("class", "value-label-group");

        const valueText = Math.round(lastPoint[yFieldName]).toString();
        const groupNameText = group.toString();
        
        const valueTextWidth = estimateTextWidth(valueText, { fontSize: fillStyle.typography.labelFontSize, fontWeight: 'bold' });
        const groupNameTextWidth = estimateTextWidth(groupNameText, { fontSize: fillStyle.typography.annotationFontSize });
        const rectWidth = Math.max(valueTextWidth, groupNameTextWidth) + 10;
        const rectHeight = parseFloat(fillStyle.typography.labelFontSize) + parseFloat(fillStyle.typography.annotationFontSize) + 10;

        // Label background
        labelGroup.append("rect")
            .attr("class", "label-background")
            .attr("x", labelX)
            .attr("y", labelY - rectHeight / 2)
            .attr("width", rectWidth)
            .attr("height", rectHeight)
            .attr("rx", 3)
            .attr("ry", 3)
            .style("fill", groupColor)
            .style("opacity", 0.9);
        
        // Group name text
        labelGroup.append("text")
            .attr("class", "label group-name-label")
            .attr("x", labelX + rectWidth / 2)
            .attr("y", labelY - rectHeight / 4 + 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("fill", d3.hsl(groupColor).l > 0.5 ? '#333333' : '#FFFFFF') // Contrast color
            .style("opacity", 0.7)
            .text(groupNameText);

        // Value text
        labelGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", labelX + rectWidth / 2)
            .attr("y", labelY + rectHeight / 4 - 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold")
            .style("fill", d3.hsl(groupColor).l > 0.5 ? '#333333' : '#FFFFFF') // Contrast color
            .text(valueText);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}