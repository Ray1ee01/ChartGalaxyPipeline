/* REQUIREMENTS_BEGIN
{
  "chart_type": "Layered Spline Area Chart",
  "chart_name": "layered_spline_area_plain_chart_01",
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
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "prominent",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "ascending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors_dark || data.colors || {}; // Prefer dark, fallback to light, then empty
    const images = data.images || {}; // Not used in this chart type
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    if (!xFieldConfig || !yFieldConfig || !groupFieldConfig) {
        const missing = [
            !xFieldConfig ? "x field" : null,
            !yFieldConfig ? "y field" : null,
            !groupFieldConfig ? "group field" : null
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: [${missing} role definition in dataColumns]. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "20px")
            .html(errorMessage);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            axisLabelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            axisLabelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '16px',
            axisLabelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal', // original used bold for x-axis
            
            finalValueLabelFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            finalValueGroupFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px', // original 10px
            finalValueValueFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '22px', // original 22px
            finalValueFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal', // original used bold for value
            
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '14px',
        },
        chartBackground: colors.background_color || '#1e293b', // Dark background default
        textColor: colors.text_color || '#e2e8f0', // Light text for dark background
        axisLineColor: (colors.other && colors.other.secondary) ? colors.other.secondary : '#9badd3', // Original #9badd3
        gridLineColor: (colors.other && colors.other.grid) ? colors.other.grid : '#87aac0', // Original #87aac0
        gridBackgroundColor: (colors.other && colors.other.grid_background) ? colors.other.grid_background : '#87aac0', // Original #87aac0 for rect fill
        areaOpacity: 0.7, // Original 0.8, slightly reduced for better layering if many groups
        finalValueLabelTextColor: '#FFFFFF', // Original #ffffff
    };

    fillStyle.areaColors = {};
    const uniqueGroupsForColor = [...new Set(rawChartData.map(d => d[groupFieldName]))];
    const defaultColorPalette = d3.schemeCategory10;
    uniqueGroupsForColor.forEach((group, i) => {
        if (colors.field && colors.field[groupFieldName] && colors.field[groupFieldName][group]) {
            fillStyle.areaColors[group] = colors.field[groupFieldName][group];
        } else if (colors.available_colors && colors.available_colors.length > 0) {
            fillStyle.areaColors[group] = colors.available_colors[i % colors.available_colors.length];
        } else {
            fillStyle.areaColors[group] = defaultColorPalette[i % defaultColorPalette.length];
        }
    });
    
    // Helper for text width estimation (not strictly needed here as labels are simple, but good practice)
    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontProps.fontFamily || 'Arial');
        textEl.setAttribute('font-size', fontProps.fontSize || '12px');
        textEl.setAttribute('font-weight', fontProps.fontWeight || 'normal');
        textEl.textContent = text;
        svg.appendChild(textEl);
        // Note: Appending to body and then removing is more reliable for getBBox if styles are complex,
        // but for simple font properties, direct creation often works.
        // For this refactor, we'll assume direct creation is sufficient.
        // If not, it would be: document.body.appendChild(svg); const width = textEl.getBBox().width; document.body.removeChild(svg);
        return textEl.getBBox().width;
    }

    const parseDate = d3.timeParse("%Y-%m-%d"); // Assuming YYYY-MM-DD format, adjust if different

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const chartMargins = { top: 20, right: 80, bottom: 50, left: 70 }; // Adjusted right/left for labels

    // Block 4: Core Chart Dimensions & Layout Calculation
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
    })).filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]) && !isNaN(d[yFieldName]));

    if (chartDataArray.length === 0) {
        const errorMessage = "No valid data points after processing. Cannot render chart.";
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:20px;'>${errorMessage}</div>`);
        return null;
    }
    
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))]
        .sort((a, b) => {
            const aLast = chartDataArray.filter(d => d[groupFieldName] === a).sort((p1, p2) => p1[xFieldName] - p2[xFieldName]).slice(-1)[0];
            const bLast = chartDataArray.filter(d => d[groupFieldName] === b).sort((p1, p2) => p1[xFieldName] - p2[xFieldName]).slice(-1)[0];
            if (!aLast || !bLast) return 0;
            return aLast[yFieldName] - bLast[yFieldName]; // Ascending sort by last Y value
        });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(chartDataArray, d => d[xFieldName]))
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => d[yFieldName]) * 1.3]) // original * 1.5, adjusted to 1.3
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .attr("class", "axis x-axis");
    
    // X-axis line (original style)
    xAxisGroup.append("line")
        .attr("class", "axis-line")
        .attr("x1", -40) // Original offset
        .attr("y1", 0)
        .attr("x2", innerWidth)
        .attr("y2", 0)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("opacity", 0.6)
        .attr("stroke-width", 1);

    const xTicks = xScale.ticks(d3.timeYear.every(Math.max(1, Math.floor(d3.timeYear.count(xScale.domain()[0], xScale.domain()[1]) / 7 )))); // Aim for ~7 ticks or yearly
    const xTickFormat = d3.timeFormat("%Y");

    xAxisGroup.selectAll(".tick-label")
        .data(xTicks.slice(0, -1)) // Exclude last tick for labels as per original
        .enter().append("text")
        .attr("class", "label tick-label")
        .attr("x", d => xScale(d))
        .attr("y", chartMargins.bottom / 2) // Position below axis line
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.axisLabelFontFamily)
        .style("font-size", fillStyle.typography.axisLabelFontSize)
        .style("font-weight", "bold") // Original was bold
        .style("fill", fillStyle.gridLineColor) // Original #87aac0
        .text(d => xTickFormat(d));

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    const yTicks = yScale.ticks(5);

    yAxisGroup.selectAll(".tick-label")
        .data(yTicks.filter(tick => tick !== 0)) // Skip 0 tick label
        .enter().append("text")
        .attr("class", "label tick-label")
        .attr("x", -10) // Original offset
        .attr("y", d => yScale(d))
        .attr("dy", "0.35em") // Vertical centering tweak, original used +15px
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.axisLabelFontFamily)
        .style("font-size", fillStyle.typography.axisLabelFontSize)
        .style("font-weight", fillStyle.typography.axisLabelFontWeight)
        .style("fill", fillStyle.gridLineColor) // Original #87aac0
        .text(d => d);
    
    // Grid background rectangle (plot area fill)
    mainChartGroup.append("rect")
        .attr("class", "grid-background mark") // Added mark class
        .attr("x", 0)
        .attr("y", 0) // yScale(d3.max(yTicks)) in original, now full plot area
        .attr("width", innerWidth)
        .attr("height", innerHeight) // chartHeight - yScale(d3.max(yTicks)) in original
        .attr("fill", fillStyle.gridBackgroundColor)
        .attr("opacity", 0.05); // Reduced opacity from 0.1

    // Vertical Gridlines
    mainChartGroup.selectAll(".grid-line-vertical")
        .data(xTicks)
        .enter().append("line")
        .attr("class", "grid-line grid-line-vertical mark")
        .attr("x1", d => xScale(d))
        .attr("y1", 0) // From top of plot area
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight) // To bottom of plot area (axis line)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("opacity", 0.2)
        .attr("stroke-width", 1);

    // Horizontal Gridlines
    mainChartGroup.selectAll(".grid-line-horizontal")
        .data(yTicks)
        .enter().append("line")
        .attr("class", "grid-line grid-line-horizontal mark")
        .attr("x1", -40) // Original offset
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("opacity", 0.2)
        .attr("stroke-width", 1);

    // Block 8: Main Data Visualization Rendering
    const areaGenerator = d3.area()
        .x(d => xScale(d[xFieldName]))
        .y0(innerHeight)
        .y1(d => yScale(d[yFieldName]))
        .curve(d3.curveMonotoneX);

    const areaPathsGroup = mainChartGroup.append("g").attr("class", "area-paths-group");

    // Draw areas in reverse order of sorted groups (smallest final Y value at bottom, largest at top)
    [...groups].reverse().forEach(group => {
        const groupData = chartDataArray.filter(d => d[groupFieldName] === group)
            .sort((a, b) => a[xFieldName] - b[xFieldName]); // Ensure data is sorted by xField for area generator

        if (groupData.length > 1) { // Need at least 2 points for an area
            areaPathsGroup.append("path")
                .datum(groupData)
                .attr("class", `area-path mark value series-${group.toString().replace(/\s+/g, '-')}`)
                .attr("fill", fillStyle.areaColors[group] || defaultColorPalette[0])
                .attr("opacity", fillStyle.areaOpacity)
                .attr("d", areaGenerator);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Last X-tick annotation (original style)
    if (xTicks.length > 0) {
        const lastTickDate = xTicks[xTicks.length - 1];
        const lastTickX = xScale(lastTickDate);
        const annotationGroup = mainChartGroup.append("g").attr("class", "annotation-group other");

        annotationGroup.append("text")
            .attr("class", "text annotation-text")
            .attr("x", lastTickX)
            .attr("y", -5) // Above plot area, original was yScale(d3.max(yTicks)) - 10
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("fill", fillStyle.gridLineColor) // Original #87aac0
            .text(xTickFormat(lastTickDate));

        annotationGroup.append("path") // Small triangle marker
            .attr("class", "marker annotation-marker")
            .attr("d", `M${lastTickX - 5},0 L${lastTickX + 5},0 L${lastTickX},5 Z`) // Pointing down to axis
            .attr("fill", fillStyle.gridLineColor);

        annotationGroup.append("line") // Vertical dashed line
            .attr("class", "line annotation-line")
            .attr("x1", lastTickX)
            .attr("y1", 5) // Start from marker
            .attr("x2", lastTickX)
            .attr("y2", innerHeight) // End at X-axis
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");
    }

    // Final value labels
    const finalLabelsGroup = mainChartGroup.append("g").attr("class", "final-labels-group");
    let prevLabelYBase = null;
    const minLabelDistance = 35; // Original 50, adjusted
    const labelWidth = 80;
    const labelHeight = 40;

    groups.forEach(group => { // Iterate in original sorted order (smallest Y first for placement logic)
        const groupData = chartDataArray.filter(d => d[groupFieldName] === group)
            .sort((a,b) => a[xFieldName] - b[xFieldName]);
        
        if (groupData.length === 0) return;
        const lastPoint = groupData[groupData.length - 1];
        
        const color = fillStyle.areaColors[group] || defaultColorPalette[0];
        let labelXBase = xScale(lastPoint[xFieldName]);
        let labelYBase = yScale(lastPoint[yFieldName]);

        // Adjust Y position to avoid overlap, pushing subsequent labels UP if too close
        if (prevLabelYBase !== null && (prevLabelYBase - labelYBase) < minLabelDistance) {
            labelYBase = prevLabelYBase - minLabelDistance;
        }
        // Ensure label doesn't go above chart top
        labelYBase = Math.max(labelHeight / 2, labelYBase); 
        // Ensure label doesn't go below chart bottom (less likely with this logic)
        labelYBase = Math.min(innerHeight - labelHeight / 2, labelYBase);


        prevLabelYBase = labelYBase;

        const labelGroup = finalLabelsGroup.append("g")
            .attr("class", `label-group other series-${group.toString().replace(/\s+/g, '-')}`)
            .attr("transform", `translate(${labelXBase}, ${labelYBase})`);

        // Background rect for label
        labelGroup.append("rect")
            .attr("class", "label-background mark")
            .attr("x", -labelWidth / 2)
            .attr("y", -labelHeight / 2 - 7) // Adjusted for triangle space
            .attr("width", labelWidth)
            .attr("height", labelHeight)
            // .attr("rx", 0) // No rounded corners
            // .attr("ry", 0)
            .attr("fill", color);

        // Triangle pointer
        labelGroup.append("path")
            .attr("class", "label-pointer mark")
            .attr("d", `M0,${labelHeight/2 - 7} L-7,${labelHeight/2 - 14} L7,${labelHeight/2 - 14} Z`) // Pointing down from rect bottom center
            .attr("fill", color);
        
        // Group name text
        labelGroup.append("text")
            .attr("class", "text label-group-name")
            .attr("x", 0)
            .attr("y", -labelHeight / 2 + labelHeight / 4 - 7) // Centered in top half
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.finalValueLabelFontFamily)
            .style("font-size", fillStyle.typography.finalValueGroupFontSize)
            .style("fill", fillStyle.finalValueLabelTextColor)
            .style("opacity", 0.7) // Original 0.5
            .text(group);

        // Value text
        labelGroup.append("text")
            .attr("class", "text label-value value")
            .attr("x", 0)
            .attr("y", labelHeight / 4 - 7) // Centered in bottom half
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.finalValueLabelFontFamily)
            .style("font-size", fillStyle.typography.finalValueValueFontSize)
            .style("font-weight", "bold") // Original bold
            .style("fill", fillStyle.finalValueLabelTextColor)
            .text(Math.round(lastPoint[yFieldName]));
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}