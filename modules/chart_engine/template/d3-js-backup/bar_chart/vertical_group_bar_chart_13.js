/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Bar Chart",
  "chart_name": "vertical_group_bar_chart_13",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // Note: REQUIREMENTS_BEGIN block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data.data || [];
    const config = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    // const rawImages = data.images || {}; // Not used in this chart
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    let criticalErrors = [];
    if (!xFieldCol) criticalErrors.push("x field configuration (role='x')");
    if (!yFieldCol) criticalErrors.push("y field configuration (role='y')");
    if (!groupFieldCol) criticalErrors.push("group field configuration (role='group')");

    if (criticalErrors.length > 0) {
        const errorMsg = `Critical chart config missing: ${criticalErrors.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const groupFieldName = groupFieldCol.name;
    const xFieldUnit = xFieldCol.unit === "none" ? "" : (xFieldCol.unit || "");
    const yFieldUnit = yFieldCol.unit === "none" ? "" : (yFieldCol.unit || "");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography defaults
    const defaultFontFamily = "Arial, sans-serif";
    fillStyle.typography.titleFontFamily = (rawTypography.title && rawTypography.title.font_family) || defaultFontFamily;
    fillStyle.typography.titleFontSize = (rawTypography.title && rawTypography.title.font_size) || "16px";
    fillStyle.typography.titleFontWeight = (rawTypography.title && rawTypography.title.font_weight) || "bold";

    fillStyle.typography.labelFontFamily = (rawTypography.label && rawTypography.label.font_family) || defaultFontFamily;
    fillStyle.typography.labelFontSize = (rawTypography.label && rawTypography.label.font_size) || "12px";
    fillStyle.typography.labelFontWeight = (rawTypography.label && rawTypography.label.font_weight) || "normal";
    
    fillStyle.typography.annotationFontFamily = (rawTypography.annotation && rawTypography.annotation.font_family) || defaultFontFamily;
    fillStyle.typography.annotationFontSize = (rawTypography.annotation && rawTypography.annotation.font_size) || "10px";
    fillStyle.typography.annotationFontWeight = (rawTypography.annotation && rawTypography.annotation.font_weight) || "normal";

    // Color defaults
    fillStyle.colors.textColor = rawColors.text_color || "#333333";
    fillStyle.colors.chartBackground = rawColors.background_color || "#FFFFFF"; // Not directly used unless chart needs explicit bg
    const defaultCategoricalPalette = d3.schemeCategory10;
    const groupColorPalette = (rawColors.available_colors && rawColors.available_colors.length > 0) 
        ? rawColors.available_colors 
        : defaultCategoricalPalette;

    function getGroupColor(groupName, groupIndex) {
        if (rawColors.field && rawColors.field[groupName]) {
            return rawColors.field[groupName];
        }
        return groupColorPalette[groupIndex % groupColorPalette.length];
    }
    
    function estimateTextWidth(text, fontProps = { family: fillStyle.typography.labelFontFamily, size: fillStyle.typography.labelFontSize, weight: fillStyle.typography.labelFontWeight }) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontProps.family);
        textEl.setAttribute('font-size', fontProps.size);
        textEl.setAttribute('font-weight', fontProps.weight);
        textEl.textContent = text;
        tempSvg.appendChild(textEl);
        // No need to append tempSvg to DOM for getBBox to work
        const width = textEl.getBBox().width;
        return width;
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    function formatValueWithUnit(value, unit) {
        return `${formatValue(value)}${unit}`;
    }

    function wrapText(d3TextSelection, textContent, maxWidth, lineHeight = 1.1) {
        // Ensure textContent is a string
        const str = String(textContent === null || typeof textContent === 'undefined' ? '' : textContent);
        d3TextSelection.each(function() {
            const textNode = d3.select(this);
            const words = str.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textNode.attr("x") || 0;
            const y = textNode.attr("y") || 0;
            // dy is not used from original, relying on lineHeight for multi-line y adjustment
            
            textNode.text(null); // Clear existing text
            let tspan = textNode.append("tspan").attr("x", x).attr("dy", `0em`);
            let tspanGenerated = false;

            if (words.length === 1 && words[0] === "") { // Handle empty string
                 tspan.text("");
                 return;
            }
            
            // Simplified logic: try full text, if too wide, then attempt word wrap
            // For more complex char wrapping, original logic was more robust but also complex
            // This version prioritizes word wrapping.
            tspan.text(str);
            if (tspan.node().getComputedTextLength() <= maxWidth) {
                // If it fits, we might need to adjust y for vertical centering if it was meant to be multi-line
                // but for single line, this is fine.
                // The vertical centering logic below handles this.
                tspanGenerated = true;
            } else {
                tspan.text(null); // Clear if it didn't fit
                 // Re-add first tspan for line-by-line construction
                tspan = textNode.append("tspan").attr("x", x).attr("dy", `0em`);

                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                        line.pop(); // remove last word
                        tspan.text(line.join(" ")); // set tspan to previous state
                        line = [word]; // start new line with current word
                        tspan = textNode.append("tspan").attr("x", x).attr("dy", `${lineHeight}em`).text(word);
                        lineNumber++;
                        tspanGenerated = true;
                    }
                }
                 if (!tspanGenerated && line.length > 0) { // Ensure at least one tspan if there was text
                    tspan.text(line.join(" "));
                }
            }
            
            // Vertical centering for multiple lines
            const tspans = textNode.selectAll("tspan");
            const numLines = tspans.size();
            if (numLines > 1) {
                const firstTspanDy = parseFloat(tspans.node().getAttribute("dy") || 0);
                const initialYOffset = -( (numLines -1) * lineHeight / 2);
                tspans.each(function(d, i) {
                    // Calculate dy relative to the baseline of the text element
                    // The first tspan dy is initialYOffset, subsequent are lineHeight relative to previous
                    if (i === 0) {
                        d3.select(this).attr("dy", `${initialYOffset}em`);
                    } else {
                         // dy is already relative from previous tspan due to append order.
                         // No, dy is relative to text element's y or previous tspan's dy.
                         // We need to set absolute dy from the text element's y.
                         d3.select(this).attr("dy", `${lineHeight}em`); // This makes it relative to previous.
                    }
                });
                 // Alternative for absolute positioning of tspans if above is problematic:
                 // tspans.attr("dy", function(d,i) { return `${initialYOffset + i * lineHeight}em`; });
            }
        });
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 80, left: 30 }; // Adjusted top for legend, bottom for labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({...d})); // Shallow copy

    const xValues = [...new Set(chartDataArray.map(d => d[xFieldName]))];
    const groupValues = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    if (groupValues.length !== 2) {
        const errorMsg = `Configuration error: The 'group' field must define exactly 2 unique groups based on the provided data. Found ${groupValues.length} unique groups. Chart requires 2.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }
    const leftBarGroupKey = groupValues[0];
    const rightBarGroupKey = groupValues[1];


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.2);

    const groupScale = d3.scaleBand()
        .domain([0, 1]) // 0 for left bar, 1 for right bar
        .range([0, xScale.bandwidth()])
        .padding(0.1); // Fixed padding between bars in a group

    const yMax = d3.max(chartDataArray, d => +d[yFieldName]);
    const yDomainMax = (yMax === undefined || yMax === 0) ? 1 : yMax; // Ensure domain is not [0,0] if all values are 0 or data is empty

    const yScale = d3.scaleLinear()
        .domain([0, yDomainMax * 1.1]) // Add 10% padding at the top
        .range([innerHeight, 0]);

    const barWidth = groupScale.bandwidth();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // X-Axis Labels
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    const labelMaxWidth = xScale.bandwidth() * 1.1; // Allow labels to be slightly wider than band
    
    xAxisGroup.selectAll(".x-axis-label-group")
        .data(xValues)
        .enter()
        .append("g")
        .attr("class", "x-axis-label-group")
        .attr("transform", d => `translate(${xScale(d) + xScale.bandwidth() / 2}, 25)`) // Position group center, 25px below axis line
        .each(function(d) {
            const group = d3.select(this);
            const textContent = String(d === null || typeof d === 'undefined' ? '' : d);

            const textLabel = group.append("text")
                .attr("class", "text x-axis-label")
                .attr("x", 0)
                .attr("y", 0) 
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(textContent);
            
            wrapText(textLabel, textContent, labelMaxWidth);
        });

    // Legend
    const legendData = [
        { key: leftBarGroupKey, color: getGroupColor(leftBarGroupKey, 0) },
        { key: rightBarGroupKey, color: getGroupColor(rightBarGroupKey, 1) }
    ];

    const legendItemHeight = 20;
    const legendRectSize = 15;
    const legendSpacing = 15; // Horizontal spacing between items
    const legendTextPadding = 5; // Padding between rect and text

    let totalLegendWidth = 0;
    const legendItemWidths = legendData.map(item => {
        const textWidth = estimateTextWidth(item.key, {
            family: fillStyle.typography.labelFontFamily,
            size: fillStyle.typography.labelFontSize,
            weight: fillStyle.typography.labelFontWeight
        });
        return legendRectSize + legendTextPadding + textWidth;
    });
    totalLegendWidth = legendItemWidths.reduce((sum, width) => sum + width, 0) + (legendData.length - 1) * legendSpacing;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2 - legendItemHeight / 2})`); // Center legend in top margin

    let currentX = 0;
    legendData.forEach((item, i) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, 0)`);

        itemGroup.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", item.color);

        itemGroup.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendRectSize + legendTextPadding)
            .attr("y", legendRectSize / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(item.key);
        
        currentX += legendItemWidths[i] + legendSpacing;
    });


    // Block 8: Main Data Visualization Rendering
    const barsGroup = mainChartGroup.append("g").attr("class", "bars-group");

    xValues.forEach(xVal => {
        const xData = chartDataArray.filter(d => d[xFieldName] === xVal);
        const leftBarDataPoint = xData.find(d => d[groupFieldName] === leftBarGroupKey);
        const rightBarDataPoint = xData.find(d => d[groupFieldName] === rightBarGroupKey);

        // Left Bar
        if (leftBarDataPoint) {
            const value = +leftBarDataPoint[yFieldName];
            const barHeight = innerHeight - yScale(value);
            const yPos = yScale(value);
            const xPos = xScale(xVal) + groupScale(0);

            barsGroup.append("rect")
                .attr("class", "mark bar left-bar")
                .attr("x", xPos)
                .attr("y", yPos)
                .attr("width", barWidth)
                .attr("height", Math.max(0, barHeight))
                .attr("fill", getGroupColor(leftBarGroupKey, 0));

            if (barHeight > 5) { // Only add label if bar is somewhat visible
                barsGroup.append("text")
                    .attr("class", "label data-label left-data-label")
                    .attr("x", xPos + barWidth / 2)
                    .attr("y", yPos - 5) // Position 5px above the bar
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize) // Use standard label size
                    .style("font-weight", "bold") // Make data labels bold
                    .style("fill", fillStyle.colors.textColor)
                    .text(formatValueWithUnit(value, yFieldUnit));
            }
        }

        // Right Bar
        if (rightBarDataPoint) {
            const value = +rightBarDataPoint[yFieldName];
            const barHeight = innerHeight - yScale(value);
            const yPos = yScale(value);
            const xPos = xScale(xVal) + groupScale(1);

            barsGroup.append("rect")
                .attr("class", "mark bar right-bar")
                .attr("x", xPos)
                .attr("y", yPos)
                .attr("width", barWidth)
                .attr("height", Math.max(0, barHeight))
                .attr("fill", getGroupColor(rightBarGroupKey, 1));
            
            if (barHeight > 5) {
                barsGroup.append("text")
                    .attr("class", "label data-label right-data-label")
                    .attr("x", xPos + barWidth / 2)
                    .attr("y", yPos - 5)
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", "bold")
                    .style("fill", fillStyle.colors.textColor)
                    .text(formatValueWithUnit(value, yFieldUnit));
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex visual effects like shadows or patterns are applied per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}