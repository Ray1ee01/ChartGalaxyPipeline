/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiple Area Chart",
  "chart_name": "small_multiple_area_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 20]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["background_color", "text_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
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
    // This function renders a small multiple area chart.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via colors_dark
    const imagesInput = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldConfig = dataColumns.find(col => col.role === xFieldRole);
    const yFieldConfig = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldConfig = dataColumns.find(col => col.role === groupFieldRole);

    const xFieldName = xFieldConfig?.name;
    const yFieldName = yFieldConfig?.name;
    const groupFieldName = groupFieldConfig?.name;

    const missingFields = [];
    if (!xFieldName) missingFields.push(`x-axis field (role: ${xFieldRole})`);
    if (!yFieldName) missingFields.push(`y-axis value field (role: ${yFieldRole})`);
    if (!groupFieldName) missingFields.push(`grouping field (role: ${groupFieldRole})`);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }

    if (!chartDataInput || chartDataInput.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>Warning: ${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {},
        images: {} // For consistency, though not used here
    };

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = typographyInput.title?.font_family || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = typographyInput.title?.font_size || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = typographyInput.title?.font_weight || defaultTypography.title.font_weight;

    fillStyle.typography.labelFontFamily = typographyInput.label?.font_family || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = typographyInput.label?.font_size || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = typographyInput.label?.font_weight || defaultTypography.label.font_weight;
    
    fillStyle.typography.groupLabelFontSize = typographyInput.label?.font_size ? (parseInt(typographyInput.label.font_size) + 2) + 'px' : '14px'; // Slightly larger for group names

    fillStyle.typography.annotationFontFamily = typographyInput.annotation?.font_family || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = typographyInput.annotation?.font_size || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = typographyInput.annotation?.font_weight || defaultTypography.annotation.font_weight;

    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: [...d3.schemeCategory10], // Use a copy
        background_color: "#FFFFFF",
        text_color: "#333333",
        gridline_color: "#e0e0e0",
        axis_line_color: "#888888"
    };

    fillStyle.colors.backgroundColor = colorsInput.background_color || defaultColors.background_color;
    fillStyle.colors.textColor = colorsInput.text_color || defaultColors.text_color;
    fillStyle.colors.gridLineColor = colorsInput.gridline_color || defaultColors.gridline_color;
    fillStyle.colors.axisLineColor = colorsInput.axis_line_color || defaultColors.axis_line_color; // For potential axis lines if added
    fillStyle.colors.primary = colorsInput.other?.primary || defaultColors.other.primary;

    fillStyle.colors.getColorForGroup = (groupName, index) => {
        if (colorsInput.field && colorsInput.field[groupFieldName] && colorsInput.field[groupFieldName][groupName]) {
            return colorsInput.field[groupFieldName][groupName];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[index % colorsInput.available_colors.length];
        }
        return defaultColors.available_colors[index % defaultColors.available_colors.length];
    };
    
    // Helper to parse date strings
    function robustParseDate(dateStr) {
        if (dateStr instanceof Date && !isNaN(dateStr)) {
            return dateStr;
        }
        let parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate)) {
            return parsedDate;
        }
        if (typeof dateStr === 'string' && /^\d{4}$/.test(dateStr)) { // Handle "YYYY" strings
            parsedDate = new Date(dateStr, 0, 1); // Jan 1st of that year
             if (!isNaN(parsedDate)) return parsedDate;
        }
        return null;
    }

    // In-memory text measurement utility
    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const defaultFP = {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        };
        const fp = { ...defaultFP, ...fontProps };
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fp.fontFamily);
        textNode.setAttribute('font-size', fp.fontSize);
        textNode.setAttribute('font-weight', fp.fontWeight);
        textNode.textContent = text;
        svg.appendChild(textNode);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM append.
        // This method might be less accurate for complex fonts or kerning.
        // For simple cases, it's an approximation. A fixed SVG in DOM is better but not allowed here.
        // A more robust approach without DOM append would involve canvas measureText or more complex SVG calculations.
        // Given constraints, this is a simplified version.
        // A common rough estimate: text.length * (parseInt(fp.fontSize) * 0.6)
        return text.length * (parseInt(fp.fontSize) * 0.6); // Simplified estimation
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.colors.backgroundColor)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const uniqueGroupNames = [...new Set(chartDataInput.map(d => d[groupFieldName]))];
    
    const maxGroupNameLength = d3.max(uniqueGroupNames, group => group ? String(group).length : 0) || 0;
    const groupLabelFontSizePx = parseInt(fillStyle.typography.groupLabelFontSize);
    const dynamicLeftMargin = Math.max(120, maxGroupNameLength * (groupLabelFontSizePx * 0.65) + 50); // Adjusted factor and padding

    const chartMargins = {
        top: 60,
        right: 60, 
        bottom: 60,
        left: dynamicLeftMargin 
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartData = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: robustParseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName] // Ensure y-value is numeric
    })).filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]) && typeof d[yFieldName] === 'number' && !isNaN(d[yFieldName]));


    if (chartData.length === 0) {
        const errorMsg = "No valid data points after processing. Check date formats and numeric values.";
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }
    
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))].sort(); // Sort groups for consistent order

    const groupMaxValues = {};
    groups.forEach(group => {
        const groupData = chartData.filter(d => d[groupFieldName] === group);
        groupMaxValues[group] = d3.max(groupData, d => d[yFieldName]) || 0;
    });

    const numGroups = groups.length;
    if (numGroups === 0) {
         console.warn("No groups found in data.");
         return svgRoot.node(); // Or display a message
    }
    const groupPlotHeight = innerHeight / (numGroups * 1.5); // Height for each individual plot area
    const groupSlotHeight = innerHeight / numGroups; // Total vertical slot per group including its spacing

    const groupPositions = {}; // Top Y coordinate for each group's slot
    groups.forEach((group, i) => {
        groupPositions[group] = i * groupSlotHeight;
    });
    
    const actualChartHeightPerGroup = groupSlotHeight * 0.666; // roughly 2/3 of slot for chart, 1/3 for spacing

    // Block 6: Scale Definition & Configuration
    const xExtent = d3.extent(chartData, d => d[xFieldName]);
    const xScale = d3.scaleTime().domain(xExtent).range([0, innerWidth]);
    
    const xTicks = xScale.ticks(Math.max(2, Math.min(10, Math.floor(innerWidth / 80)))); // Dynamic number of ticks
    const xTickFormat = d3.timeFormat("%Y");

    const yScales = {};
    groups.forEach(group => {
        yScales[group] = d3.scaleLinear()
            .domain([0, Math.max(1, groupMaxValues[group])]) // Ensure domain doesn't collapse if max is 0
            .range([actualChartHeightPerGroup, 0]); // From bottom to top of the individual plot area
    });

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Vertical Gridlines (from X-axis ticks)
    xTicks.forEach(tick => {
        mainChartGroup.append("line")
            .attr("class", "gridline vertical-gridline")
            .attr("x1", xScale(tick))
            .attr("y1", 0)
            .attr("x2", xScale(tick))
            .attr("y2", innerHeight)
            .attr("stroke", fillStyle.colors.gridLineColor)
            .attr("stroke-opacity", 0.7)
            .attr("stroke-width", 1);
    });

    // X-axis Tick Labels (Top)
    xTicks.forEach(tick => {
        mainChartGroup.append("text")
            .attr("class", "axis-label x-axis-label top")
            .attr("x", xScale(tick))
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "alphabetic")
            .attr("fill", fillStyle.colors.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xTickFormat(tick));
    });

    // X-axis Tick Labels (Bottom)
    xTicks.forEach(tick => {
        mainChartGroup.append("text")
            .attr("class", "axis-label x-axis-label bottom")
            .attr("x", xScale(tick))
            .attr("y", innerHeight + 15)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("fill", fillStyle.colors.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xTickFormat(tick));
    });

    // Y-axes and Horizontal Helper Lines (per group)
    groups.forEach((group, i) => {
        const groupG = mainChartGroup.append("g")
            .attr("class", `group-container group-${i}`)
            .attr("transform", `translate(0, ${groupPositions[group]})`);

        // Y-axis on the right
        const yAxisGenerator = d3.axisRight(yScales[group])
            .ticks(3)
            .tickSize(0) // No tick lines from axis path
            .tickPadding(5)
            .tickFormat(d => d3.format(".1s")(d));

        const yAxisGroup = groupG.append("g")
            .attr("class", "axis y-axis")
            .attr("transform", `translate(${innerWidth}, 0)`)
            .call(yAxisGenerator);

        yAxisGroup.select(".domain").remove(); // Remove Y-axis line

        yAxisGroup.selectAll("text")
            .attr("class", "axis-label y-axis-label")
            .attr("fill", fillStyle.colors.textColor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight);
            // .attr("dx", "0.5em"); // Original had this, adjust if needed

        // Horizontal helper lines for this group
        yScales[group].ticks(3).forEach(tickValue => {
            if (tickValue > 0) { // Skip 0-line, handled by area base or specific 0-line
                groupG.append("line")
                    .attr("class", "gridline horizontal-gridline")
                    .attr("x1", 0)
                    .attr("y1", yScales[group](tickValue))
                    .attr("x2", innerWidth)
                    .attr("y2", yScales[group](tickValue))
                    .attr("stroke", fillStyle.colors.getColorForGroup(group, i))
                    .attr("stroke-opacity", 0.2)
                    .attr("stroke-width", 0.5)
                    .attr("stroke-dasharray", "2,2");
            }
        });
    });


    // Block 8: Main Data Visualization Rendering
    const areaGenerator = (group) => d3.area()
        .x(d => xScale(d[xFieldName]))
        .y0(groupPositions[group] + actualChartHeightPerGroup) // Base of the area plot for this group
        .y1(d => groupPositions[group] + yScales[group](d[yFieldName])) // Top of the area plot
        .curve(d3.curveBasis);

    groups.forEach((group, i) => {
        const groupData = chartData.filter(d => d[groupFieldName] === group)
                                 .sort((a, b) => a[xFieldName] - b[xFieldName]);
        
        if (groupData.length === 0) return;

        const groupColor = fillStyle.colors.getColorForGroup(group, i);
        const currentGroupTopY = groupPositions[group];

        // Area Path
        mainChartGroup.append("path")
            .datum(groupData)
            .attr("class", "mark area-mark")
            .attr("fill", groupColor)
            .attr("d", d3.area() // Redefine area generator with correct y0 and y1 for this specific group
                .x(d_item => xScale(d_item[xFieldName]))
                .y0(currentGroupTopY + actualChartHeightPerGroup)
                .y1(d_item => currentGroupTopY + yScales[group](d_item[yFieldName]))
                .curve(d3.curveBasis)
            );

        // Group 0-line (baseline for each chart)
        mainChartGroup.append("line")
            .attr("class", "mark zero-line")
            .attr("x1", -chartMargins.left + 20) // Original positioning
            .attr("y1", currentGroupTopY + actualChartHeightPerGroup)
            .attr("x2", innerWidth)
            .attr("y2", currentGroupTopY + actualChartHeightPerGroup)
            .attr("stroke", groupColor)
            .attr("stroke-width", 1.5)
            .attr("stroke-opacity", 0.8);

        // Group Name Label
        mainChartGroup.append("text")
            .attr("class", "label group-label")
            .attr("x", -chartMargins.left + 20) // Original positioning
            .attr("y", currentGroupTopY + actualChartHeightPerGroup - 10) // 10px above baseline
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "alphabetic") // better for y alignment
            .attr("fill", groupColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.groupLabelFontSize)
            .style("font-weight", "bold")
            .text(group);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}