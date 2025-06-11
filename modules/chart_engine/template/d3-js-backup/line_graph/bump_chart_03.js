/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bump Chart",
  "chart_name": "bump_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 12], [0, "inf"], [3, 10]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
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
    const colors = data.colors_dark || data.colors || {}; // Prefer dark, fallback to light, then empty
    const images = data.images || {}; // Not used in this chart, but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldCol ? xFieldCol.name : undefined;
    const yFieldName = yFieldCol ? yFieldCol.name : undefined;
    const groupFieldName = groupFieldCol ? groupFieldCol.name : undefined;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x field" : null,
            !yFieldName ? "y field" : null,
            !groupFieldName ? "group field" : null
        ].filter(Boolean).join(", ");
        
        const errorMessage = `Critical chart config missing: [${missingFields} definition in data.data.columns]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography defaults
    fillStyle.typography.defaultFontFamily = 'Arial, sans-serif';
    fillStyle.typography.defaultFontSize = '12px';
    fillStyle.typography.defaultFontWeight = 'normal';
    fillStyle.typography.defaultTextColor = colors.text_color || '#CCCCCC'; // Default for dark background

    // Title (not used, but for completeness if other charts use it)
    fillStyle.typography.titleFontFamily = (typography.title && typography.title.font_family) || fillStyle.typography.defaultFontFamily;
    fillStyle.typography.titleFontSize = (typography.title && typography.title.font_size) || '16px';
    fillStyle.typography.titleFontWeight = (typography.title && typography.title.font_weight) || 'bold';

    // Label (for axes, group names, etc.)
    fillStyle.typography.labelFontFamily = (typography.label && typography.label.font_family) || fillStyle.typography.defaultFontFamily;
    fillStyle.typography.labelFontSize = (typography.label && typography.label.font_size) || '14px'; // Original used 18px for group, 16px for rank, 14px for time
    fillStyle.typography.labelFontWeight = (typography.label && typography.label.font_weight) || 'bold'; // Original used bold for group/rank

    // Annotation (for data point labels)
    fillStyle.typography.annotationFontFamily = (typography.annotation && typography.annotation.font_family) || fillStyle.typography.defaultFontFamily;
    fillStyle.typography.annotationFontSize = (typography.annotation && typography.annotation.font_size) || '12px'; // Original used 14px
    fillStyle.typography.annotationFontWeight = (typography.annotation && typography.annotation.font_weight) || 'normal';
    fillStyle.typography.annotationTextColor = '#FFFFFF'; // Specific for labels on dark lines

    // Colors
    fillStyle.colors.chartBackground = colors.background_color || '#333333'; // Dark background default
    fillStyle.colors.defaultLineColor = (colors.other && colors.other.primary) || '#888888';
    
    const getColor = (groupValue) => {
        if (colors.field && colors.field[groupFieldName] && colors.field[groupFieldName][groupValue]) {
            return colors.field[groupFieldName][groupValue];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            // Simple hash to pick a color, or use index if groups are consistently ordered
            let index = 0;
            const uniqueGroups = [...new Set(chartData.map(d => d[groupFieldName]))];
            index = uniqueGroups.indexOf(groupValue);
            return colors.available_colors[index % colors.available_colors.length];
        }
        return fillStyle.colors.defaultLineColor;
    };

    // Helper: In-memory text measurement
    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const svgNs = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNs, 'svg');
        const tempText = document.createElementNS(svgNs, 'text');
        tempText.setAttributeNS(null, 'font-family', fontProps.fontFamily || fillStyle.typography.defaultFontFamily);
        tempText.setAttributeNS(null, 'font-size', fontProps.fontSize || fillStyle.typography.defaultFontSize);
        tempText.setAttributeNS(null, 'font-weight', fontProps.fontWeight || fillStyle.typography.defaultFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document body append/remove is not ideal but getBBox needs layout.
        // A more robust way might involve a hidden persistent SVG if performance is critical.
        // For this refactor, sticking to no DOM append as per prompt.
        // However, getBBox on an unattached element might not be reliable across all browsers.
        // A common workaround is to attach to DOM, measure, then detach.
        // Given the strict "MUST NOT be appended to the document DOM", we rely on getBBox behavior for unattached elements.
        // If this proves unreliable, the constraint might need re-evaluation for practical text measurement.
        // For now, let's assume it works or use a simpler estimation if it doesn't.
        // A simpler estimation (less accurate): text.length * (fontSizePx * 0.6)
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached fails (e.g. JSDOM without layout)
            const fontSizePx = parseFloat(fontProps.fontSize || fillStyle.typography.defaultFontSize);
            return text.length * (fontSizePx * 0.6); // Rough estimate
        }
    };
    
    // Helper: Date parsing (assuming xField values are ISO 8601 or similar parseable by Date constructor)
    // More robust parsing might be needed for specific date formats (e.g., using d3.timeParse)
    const parseDate = (dateString) => {
        const parsed = new Date(dateString);
        return isNaN(parsed.getTime()) ? null : parsed;
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
        .style("background-color", fillStyle.colors.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 180, bottom: 50, left: 100 }; // Adjusted for labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartData.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]), // Parse dates early
        [yFieldName]: +d[yFieldName] // Ensure y is numeric
    })).filter(d => d[xFieldName] !== null); // Filter out unparseable dates

    if (processedChartData.length === 0 && chartData.length > 0) {
        const errorMessage = "Warning: All date values in x-field are unparseable. Cannot render chart.";
        console.warn(errorMessage);
        d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMessage}</div>`);
        return null;
    }
     if (processedChartData.length === 0 && chartData.length === 0) {
        const errorMessage = "No data provided to render the chart.";
        console.warn(errorMessage);
        d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMessage}</div>`);
        return null;
    }


    const groupValues = [...new Set(processedChartData.map(d => d[groupFieldName]))].sort();
    const xValuesUnique = [...new Set(processedChartData.map(d => d[xFieldName].getTime()))] // Use time for uniqueness
                            .map(time => new Date(time)) // Convert back to Date objects
                            .sort((a, b) => a - b);


    const rankData = {};
    xValuesUnique.forEach(xVal => {
        const itemsAtX = processedChartData.filter(d => d[xFieldName].getTime() === xVal.getTime());
        itemsAtX.sort((a, b) => b[yFieldName] - a[yFieldName]); // Higher Y = better rank
        
        itemsAtX.forEach((d, i) => {
            const group = d[groupFieldName];
            if (!rankData[group]) rankData[group] = [];
            rankData[group].push({
                x: xVal,
                rank: i + 1,
                value: d[yFieldName]
            });
        });
    });
    
    // Ensure all groups have entries for all xValues, even if they have to be assigned a default low rank
    // This is important if a group disappears and reappears, or for consistent y-scale domain
    const maxRank = groupValues.length;
    groupValues.forEach(group => {
        if (!rankData[group]) rankData[group] = [];
        xValuesUnique.forEach(xVal => {
            if (!rankData[group].find(r => r.x.getTime() === xVal.getTime())) {
                // Find if the group has ANY data. If not, it shouldn't be ranked.
                // This logic is tricky: if a group has no data for a specific xVal, what's its rank?
                // For bump charts, typically groups persist. If a group truly has no data for an xVal,
                // it might be an issue with the input data or imply the group "drops out".
                // For simplicity, if a group exists overall but misses an xVal, we might assign it last rank.
                // However, the original code implies groups are continuous.
                // Let's stick to original behavior: only rank present data.
                // The y-scale domain will be [1, groupValues.length], so missing ranks are implicitly handled.
            }
        });
        // Sort by date just in case
        if (rankData[group]) {
            rankData[group].sort((a,b) => a.x - b.x);
        }
    });


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scalePoint()
        .domain(xValuesUnique)
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([1, Math.max(1, groupValues.length)]) // Rank 1 at top
        .range([0, innerHeight]);

    // Time formatting for X-axis labels
    const timeFormat = d3.timeFormat("%b %Y"); // Example: "Jan 2023" or "%Y-%m-%d" or "%b %d"
    // Heuristic to choose a format based on time span
    const firstDate = xValuesUnique[0];
    const lastDate = xValuesUnique[xValuesUnique.length - 1];
    let chosenTimeFormat = timeFormat; // Default
    if (firstDate && lastDate) {
        const diffYears = lastDate.getFullYear() - firstDate.getFullYear();
        const diffMonths = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + (lastDate.getMonth() - firstDate.getMonth());
        const diffDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

        if (diffYears > 1) chosenTimeFormat = d3.timeFormat("%Y"); // Just year
        else if (diffMonths > 1 || xValuesUnique.length <=6 ) chosenTimeFormat = d3.timeFormat("%b %Y"); // Month and Year
        else if (diffDays > 1) chosenTimeFormat = d3.timeFormat("%b %d"); // Month and Day
        else chosenTimeFormat = d3.timeFormat("%H:%M"); // Hours and Minutes if very short span
    }


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    
    // Y-axis rank labels (left side)
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis-ranks");

    if (groupValues.length > 0) {
        for (let i = 1; i <= groupValues.length; i++) {
            yAxisGroup.append("text")
                .attr("class", "label y-axis-rank-label")
                .attr("x", -10)
                .attr("y", yScale(i))
                .attr("dy", "0.32em") // Vertical centering
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize) // Was 16px
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .attr("fill", fillStyle.typography.defaultTextColor)
                .text(i);
        }
    }

    // X-axis time labels (top)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis-time");
    
    // Optimized X Ticks logic (simplified from original, can be expanded)
    let xTicksToDisplay = xValuesUnique;
    if (xValuesUnique.length > 10) { // Basic optimization: if too many, take a subset
        const step = Math.ceil(xValuesUnique.length / 10);
        xTicksToDisplay = xValuesUnique.filter((d, i) => i % step === 0);
        if (xValuesUnique.length > 0 && !xTicksToDisplay.includes(xValuesUnique[xValuesUnique.length - 1])) {
             xTicksToDisplay.push(xValuesUnique[xValuesUnique.length - 1]); // Ensure last tick
        }
    }


    xTicksToDisplay.forEach(tickValue => {
        xAxisGroup.append("text")
            .attr("class", "label x-axis-time-label")
            .attr("x", xScale(tickValue))
            .attr("y", -chartMargins.top / 2 + 10) // Position above chart
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize) // Was 14px
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.typography.defaultTextColor)
            .text(chosenTimeFormat(tickValue));
    });


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.rank))
        .curve(d3.curveCatmullRom.alpha(0.5)); // Smooth curve

    groupValues.forEach(group => {
        const groupPathData = rankData[group];
        if (!groupPathData || groupPathData.length === 0) return;

        // Line
        mainChartGroup.append("path")
            .datum(groupPathData)
            .attr("class", "mark data-line")
            .attr("fill", "none")
            .attr("stroke", getColor(group))
            .attr("stroke-width", variables.line_stroke_width || 15) // Configurable stroke width
            .attr("stroke-linecap", "round")
            .attr("d", lineGenerator);

        // Value labels on lines
        groupPathData.forEach(d => {
            mainChartGroup.append("text")
                .attr("class", "value data-value-label")
                .attr("x", xScale(d.x))
                .attr("y", yScale(d.rank))
                .attr("text-anchor", "middle")
                .attr("dy", "0.32em") // Vertical centering
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .attr("fill", fillStyle.typography.annotationTextColor)
                .text(d.value);
        });

        // Group labels (left and right)
        const firstPoint = groupPathData[0];
        if (firstPoint) {
            mainChartGroup.append("text")
                .attr("class", "label group-label-start")
                .attr("x", -chartMargins.left + 20) // Adjusted position
                .attr("y", yScale(firstPoint.rank))
                .attr("dy", "0.32em")
                .attr("text-anchor", "start") // Changed from end to start for consistency with right side
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize) // Was 18px
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .attr("fill", getColor(group))
                .text(group);
        }

        const lastPoint = groupPathData[groupPathData.length - 1];
        if (lastPoint) {
            mainChartGroup.append("text")
                .attr("class", "label group-label-end")
                .attr("x", innerWidth + 10)
                .attr("y", yScale(lastPoint.rank))
                .attr("dy", "0.32em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize) // Was 18px
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .attr("fill", getColor(group))
                .text(group);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., advanced label collision detection, tooltips - not implemented here for simplicity)
    // The `optimizeTimeLabels` logic from original was simplified and integrated into X-axis rendering.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}