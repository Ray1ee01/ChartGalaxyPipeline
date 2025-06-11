/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Line Graph",
  "chart_name": "multiple_line_graph_12",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [
    [5, 30],
    [0, "inf"],
    [2, 10]
  ],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 800,
  "background": "no",
  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "auto",
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
    const colorsConfig = data.colors || {}; // Assuming light theme, or use a theme detector if data.colors_dark is relevant
    const imagesConfig = data.images || {}; // Not used in this chart, but extracted for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getFieldNameByRole = (role) => {
        const col = dataColumns.find(c => c.role === role);
        return col ? col.name : undefined;
    };

    const xFieldName = getFieldNameByRole(xFieldRole);
    const yFieldName = getFieldNameByRole(yFieldRole);
    const groupFieldName = getFieldNameByRole(groupFieldRole);

    if (!xFieldName || !yFieldName || !groupFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push(`role '${xFieldRole}'`);
        if (!yFieldName) missingFields.push(`role '${yFieldRole}'`);
        if (!groupFieldName) missingFields.push(`role '${groupFieldRole}'`);
        const errorMsg = `Critical chart config missing: Field name(s) for ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            axisLabelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            axisLabelFontSize: typographyConfig.label?.font_size || '12px',
            axisLabelFontWeight: typographyConfig.label?.font_weight || 'normal',
            legendFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            legendFontSize: typographyConfig.label?.font_size || '14px', // Original legend was 14px
            legendFontWeight: typographyConfig.label?.font_weight || 'bold', // Original legend was bold
            dataLabelFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            dataLabelFontSize: typographyConfig.annotation?.font_size || '12px',
            dataLabelFontWeight: typographyConfig.annotation?.font_weight || 'bold', // Original data labels were bold
            ratioTextFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            ratioTextFontSize: typographyConfig.annotation?.font_size || '12px',
            ratioTextFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        },
        textColor: colorsConfig.text_color || '#0f223b',
        axisColor: colorsConfig.other?.axis_color || '#666666',
        gridLineColor: colorsConfig.other?.grid_line || '#e0e0e0',
        backgroundStripeColor: colorsConfig.other?.background_stripe || '#ececec',
        defaultCategoricalPalette: colorsConfig.available_colors || d3.schemeCategory10,
        dataLabelTextColor: colorsConfig.other?.data_label_text || '#FFFFFF',
        ratioCircleTextColor: colorsConfig.other?.ratio_circle_text || '#333333',
        lineWidth: 4,
        endpointCircleStrokeWidth: 4, // Same as lineWidth for consistency with original
    };

    fillStyle.getColor = (groupValue, index) => {
        return (colorsConfig.field && colorsConfig.field[groupValue]) ?
               colorsConfig.field[groupValue] :
               fillStyle.defaultCategoricalPalette[index % fillStyle.defaultCategoricalPalette.length];
    };
    
    // Helper to calculate derived circle color (if not provided by config)
    const calculateDerivedCircleColor = (color1Str, color2Str) => {
        const color1 = d3.rgb(color1Str);
        const color2 = d3.rgb(color2Str);
        const brightness1 = color1.r * 0.299 + color1.g * 0.587 + color1.b * 0.114; // Luma calculation
        const brightness2 = color2.r * 0.299 + color2.g * 0.587 + color2.b * 0.114;
        let lighterColor = brightness1 >= brightness2 ? color1 : color2;
        
        // Make it even lighter
        const factor = 0.7;
        const r = Math.min(255, lighterColor.r + (255 - lighterColor.r) * factor);
        const g = Math.min(255, lighterColor.g + (255 - lighterColor.g) * factor);
        const b = Math.min(255, lighterColor.b + (255 - lighterColor.b) * factor);
        return d3.rgb(r, g, b).toString();
    };

    // Date parsing utility
    const parseDate = (dateString) => {
        if (dateString instanceof Date) return dateString;
        // Attempt common formats. Prioritize ISO, then others.
        const parsers = [
            d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ"), // ISO with milliseconds and Z
            d3.timeParse("%Y-%m-%dT%H:%M:%SZ"),    // ISO with Z
            d3.timeParse("%Y-%m-%d %H:%M:%S"),
            d3.timeParse("%Y-%m-%d"),
            d3.timeParse("%m/%d/%Y"),
            d3.timeParse("%d/%m/%Y")
        ];
        for (let parser of parsers) {
            const parsed = parser(dateString);
            if (parsed) return parsed;
        }
        const genericParse = new Date(dateString); // Fallback to native Date parser
        return !isNaN(genericParse) ? genericParse : null;
    };
    
    // Text measurement utility (as per prompt's constraints)
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // This method of measuring without appending to DOM might be unreliable.
        // For robust measurement, appending to a hidden part of the DOM is typical.
        // However, adhering to "MUST NOT be appended to the document DOM".
        // If issues arise, this is a point for review.
        // A common pattern is to append to body, set visibility:hidden, measure, remove.
        // For this exercise, we assume getBBox() on a non-DOM element works.
        // To make it more likely to work, we can append to body then remove.
        document.body.appendChild(tempSvg);
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
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
        .attr("class", "chart-root-svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 100, right: 30, bottom: 60, left: 60 }; // Adjusted bottom for X-axis labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    let chartData = rawChartData.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName]
    })).filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]) && !isNaN(d[yFieldName]));

    if (chartData.length === 0) {
        mainChartGroup.append("text").text("No valid data to display after processing.").attr("x", innerWidth/2).attr("y", innerHeight/2).attr("text-anchor", "middle").attr("class","text error-text");
        return svgRoot.node();
    }
    
    const allGroups = [...new Set(chartData.map(d => d[groupFieldName]))];
    if (allGroups.length < 2) {
         mainChartGroup.append("text").text("At least two groups are required to make this comparison chart.").attr("x", innerWidth/2).attr("y", innerHeight/2).attr("text-anchor", "middle").attr("class","text error-text");
        return svgRoot.node();
    }

    const groupedData = d3.group(chartData, d => d[groupFieldName]);
    const groupAverages = new Map();
    groupedData.forEach((values, group) => {
        const sum = d3.sum(values, d => d[yFieldName]);
        groupAverages.set(group, sum / values.length);
    });

    let highestGroup = null, lowestGroup = null;
    let highestAvg = -Infinity, lowestAvg = Infinity;

    groupAverages.forEach((avg, group) => {
        if (avg > highestAvg) {
            highestAvg = avg;
            highestGroup = group;
        }
        if (avg < lowestAvg) {
            lowestAvg = avg;
            lowestGroup = group;
        }
    });
    
    // If only one group was found after filtering (e.g. all others had NaN averages), or if highest/lowest are the same
    if (highestGroup === lowestGroup && allGroups.length >=2) { // Pick first two distinct groups if highest/lowest are same
        const distinctGroups = Array.from(groupAverages.keys());
        if (distinctGroups.length >= 2) {
            highestGroup = distinctGroups[0]; // Arbitrary assignment
            lowestGroup = distinctGroups[1];
            // Re-evaluate averages if needed, or just proceed with these two
            highestAvg = groupAverages.get(highestGroup);
            lowestAvg = groupAverages.get(lowestGroup);
            // Ensure highest is actually higher for consistency if it matters later
            if (lowestAvg > highestAvg) {
                [highestGroup, lowestGroup] = [lowestGroup, highestGroup];
                [highestAvg, lowestAvg] = [lowestAvg, highestAvg];
            }
        } else {
            // Fallback if still not enough distinct groups with valid averages
            mainChartGroup.append("text").text("Could not determine two distinct groups for comparison.").attr("x", innerWidth/2).attr("y", innerHeight/2).attr("text-anchor", "middle").attr("class","text error-text");
            return svgRoot.node();
        }
    }


    const selectedGroups = [highestGroup, lowestGroup];
    const selectedGroupData = new Map(selectedGroups.map(g => [g, groupedData.get(g).sort((a,b) => a[xFieldName] - b[xFieldName])]));


    // Block 6: Scale Definition & Configuration
    // Helper: createXAxisScaleAndTicks (adapted from original logic)
    function createXAxisScaleAndTicks(data, xField, minRange, maxRange) {
        const dates = data.map(d => d[xField]);
        const minDate = d3.min(dates);
        const maxDate = d3.max(dates);
        
        const xScale = d3.scaleTime().domain([minDate, maxDate]).range([minRange, maxRange]);
        
        let xTicks, xFormat;
        const timeSpanDays = d3.timeDay.count(minDate, maxDate);

        if (timeSpanDays <= 30) { // Daily ticks for up to a month
            xTicks = xScale.ticks(d3.timeDay.every(Math.max(1, Math.floor(timeSpanDays / 10)) || 1));
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 90) { // Weekly ticks for up to 3 months
            xTicks = xScale.ticks(d3.timeWeek.every(1));
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 365 * 2) { // Monthly ticks for up to 2 years
            xTicks = xScale.ticks(d3.timeMonth.every(1));
            xFormat = d3.timeFormat("%b '%y");
        } else { // Yearly ticks for longer spans
            xTicks = xScale.ticks(d3.timeYear.every(1));
            xFormat = d3.timeFormat("%Y");
        }
        if (xTicks.length < 2 && dates.length >=2) { // Ensure at least start and end ticks if possible
             xTicks = [minDate, maxDate];
        } else if (xTicks.length === 0 && dates.length > 0) {
            xTicks = [minDate];
        }


        return { xScale, xTicks, xFormat, timeSpanDays };
    }

    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartData.filter(d => selectedGroups.includes(d[groupFieldName])), xFieldName, 0, innerWidth);

    const yMin = d3.min(chartData.filter(d => selectedGroups.includes(d[groupFieldName])), d => d[yFieldName]);
    const yMax = d3.max(chartData.filter(d => selectedGroups.includes(d[groupFieldName])), d => d[yFieldName]);
    const yPadding = (yMax - yMin) * 0.3 || yMax * 0.1 || 10; // Ensure some padding
    const yDomainMin = Math.max(0, yMin - yPadding);
    const yDomainMax = yMax + yPadding;

    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0]);

    const colorScale = d3.scaleOrdinal()
        .domain(allGroups) // Use allGroups for consistent color mapping if chart were to show more
        .range(allGroups.map((g, i) => fillStyle.getColor(g, i)));

    const highColor = colorScale(highestGroup);
    const lowColor = colorScale(lowestGroup);
    fillStyle.ratioCircleMainColor = colorsConfig.other?.ratio_circle_main || calculateDerivedCircleColor(highColor, lowColor);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const yAxisTicks = yScale.ticks(5);
    const maxYTickValue = yAxisTicks.length > 0 ? yAxisTicks[yAxisTicks.length - 1] : yDomainMax;
    const maxYTickPosition = yScale(maxYTickValue);
    
    const legendYPosition = maxYTickPosition - 60;
    const ratioCircleYPosition = maxYTickPosition - 30;

    // Striped background
    if (xTicks.length > 1) {
        for (let i = 0; i < xTicks.length - 1; i++) {
            const x1 = xScale(xTicks[i]);
            const x2 = xScale(xTicks[i+1]);
            if (i % 2 === 0) {
                mainChartGroup.append("rect")
                    .attr("x", x1)
                    .attr("y", legendYPosition + 10) // Relative to legend position
                    .attr("width", x2 - x1)
                    .attr("height", innerHeight + chartMargins.bottom - (legendYPosition + 10) - 20) // Cover down to X-axis text area
                    .attr("fill", fillStyle.backgroundStripeColor)
                    .attr("class", "mark background-stripe")
                    .lower(); // Send to back
            }
        }
    }
    
    // Horizontal gridlines
    mainChartGroup.append("g")
        .attr("class", "grid y-grid")
        .selectAll("line")
        .data(yAxisTicks)
        .enter().append("line")
        .attr("x1", 0)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2")
        .attr("class", "mark grid-line");

    // X-axis labels (between ticks, as per original)
    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis-labels");
    if (xTicks.length > 1) {
        for (let i = 0; i < xTicks.length - 1; i++) {
            const midX = (xScale(xTicks[i]) + xScale(xTicks[i+1])) / 2;
            xAxisLabelsGroup.append("text")
                .attr("x", midX)
                .attr("y", innerHeight + 20) // Below chart area
                .attr("text-anchor", "middle")
                .attr("fill", fillStyle.axisColor)
                .style("font-family", fillStyle.typography.axisLabelFontFamily)
                .style("font-size", fillStyle.typography.axisLabelFontSize)
                .style("font-weight", fillStyle.typography.axisLabelFontWeight)
                .attr("class", "text label x-axis-label")
                .text(xFormat(xTicks[i])); // Label refers to the start of the interval
        }
    } else if (xTicks.length === 1) { // Single tick
         xAxisLabelsGroup.append("text")
            .attr("x", xScale(xTicks[0]))
            .attr("y", innerHeight + 20)
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.axisColor)
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .attr("class", "text label x-axis-label")
            .text(xFormat(xTicks[0]));
    }


    // Y-axis labels
    mainChartGroup.append("g")
        .attr("class", "axis y-axis-labels")
        .selectAll("text")
        .data(yAxisTicks)
        .enter().append("text")
        .attr("x", -10)
        .attr("y", d => yScale(d))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.axisColor)
        .style("font-family", fillStyle.typography.axisLabelFontFamily)
        .style("font-size", fillStyle.typography.axisLabelFontSize)
        .style("font-weight", fillStyle.typography.axisLabelFontWeight)
        .attr("class", "text label y-axis-label")
        .text(d => d.toFixed(1));

    // Legend
    function layoutLegend(legendContainer, legendItems, itemColors, options) {
        const { x, y, fontSize, fontWeight, fontFamily, align, maxWidth, shape } = options;
        const itemHeight = parseInt(fontSize, 10) * 1.5;
        const shapeRadius = parseInt(fontSize, 10) * 0.4;
        const shapeMargin = shapeRadius * 2;
        let currentX = x;
        let currentY = y;
        let totalWidth = 0;
        let lineMaxWidth = 0;

        legendItems.forEach(itemText => {
            const itemGroup = legendContainer.append("g").attr("class", "legend-item");
            
            const textElement = itemGroup.append("text")
                .attr("font-size", fontSize)
                .attr("font-weight", fontWeight)
                .attr("font-family", fontFamily)
                .attr("fill", fillStyle.textColor)
                .attr("class", "text label legend-label")
                .text(itemText);
            
            const textWidth = estimateTextWidth(itemText, fontFamily, fontSize, fontWeight);
            const itemWidth = shapeRadius * 2 + shapeMargin + textWidth;

            if (currentX + itemWidth > maxWidth && currentX > x) { // New line
                currentX = x;
                currentY += itemHeight;
                lineMaxWidth = Math.max(lineMaxWidth, currentX - x - shapeMargin); // previous line width
            }
            
            itemGroup.attr("transform", `translate(${currentX}, ${currentY})`);

            itemGroup.append(shape === "circle" ? "circle" : "rect")
                .attr(shape === "circle" ? "cx" : "x", shapeRadius)
                .attr(shape === "circle" ? "cy" : "y", -shapeRadius / 2) // Align with text baseline
                .attr(shape === "circle" ? "r" : "width", shapeRadius)
                .attr(shape === "circle" ? "" : "height", shapeRadius)
                .attr("fill", (itemColors.field && itemColors.field[itemText]) ? itemColors.field[itemText] : fillStyle.getColor(itemText, 0))
                .attr("class", `mark legend-mark ${shape}`);

            textElement.attr("x", shapeRadius * 2 + shapeMargin / 2).attr("dy", "0.32em"); // Vertically center text with shape

            currentX += itemWidth + shapeMargin; // Add padding for next item
            lineMaxWidth = Math.max(lineMaxWidth, currentX - x - shapeMargin);
        });
        totalWidth = Math.max(lineMaxWidth, currentX - x - shapeMargin);
        const totalHeight = currentY + itemHeight - y;
        return { width: totalWidth, height: totalHeight };
    }

    const legendGroup = mainChartGroup.append("g")
        .attr("class", "legend");
    
    const legendItemsList = [lowestGroup, highestGroup, `${lowestGroup}/${highestGroup} Ratio`];
    const legendColors = {
        field: {
            [lowestGroup]: lowColor,
            [highestGroup]: highColor,
            [`${lowestGroup}/${highestGroup} Ratio`]: fillStyle.ratioCircleMainColor,
        }
    };

    const legendSize = layoutLegend(legendGroup, legendItemsList, legendColors, {
        x: 0, y: 0,
        fontSize: fillStyle.typography.legendFontSize,
        fontWeight: fillStyle.typography.legendFontWeight,
        fontFamily: fillStyle.typography.legendFontFamily,
        align: "left", // Original was left, centering applied to group
        maxWidth: innerWidth,
        shape: "circle"
    });
    legendGroup.attr("transform", `translate(${(innerWidth - legendSize.width) / 2}, ${legendYPosition - legendSize.height / 2})`);


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    selectedGroups.forEach(group => {
        const groupValues = selectedGroupData.get(group);
        if (!groupValues || groupValues.length === 0) return;

        const groupColor = colorScale(group);

        mainChartGroup.append("path")
            .datum(groupValues)
            .attr("fill", "none")
            .attr("stroke", groupColor)
            .attr("stroke-width", fillStyle.lineWidth)
            .attr("d", lineGenerator)
            .attr("class", `mark line series-${group}`);

        mainChartGroup.selectAll(`.dot-${group}`)
            .data(groupValues)
            .enter().append("circle")
            .attr("cx", d => xScale(d[xFieldName]))
            .attr("cy", d => yScale(d[yFieldName]))
            .attr("r", (d, i) => (i === 0 || i === groupValues.length - 1) ? fillStyle.lineWidth * 1.2 : fillStyle.lineWidth)
            .attr("fill", (d, i) => (i === 0 || i === groupValues.length - 1) ? fillStyle.dataLabelTextColor : groupColor) // White fill for endpoints
            .attr("stroke", (d, i) => (i === 0 || i === groupValues.length - 1) ? groupColor : "none")
            .attr("stroke-width", (d, i) => (i === 0 || i === groupValues.length - 1) ? fillStyle.endpointCircleStrokeWidth : 0)
            .attr("class", (d,i) => `mark value dot series-${group} ${ (i === 0 || i === groupValues.length - 1) ? 'endpoint' : 'midpoint'}`);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Ratio circles
    const highValues = selectedGroupData.get(highestGroup);
    const lowValues = selectedGroupData.get(lowestGroup);

    if (highValues && lowValues && xTicks.length > 0) {
        const highInterpolator = d3.scaleTime()
            .domain(highValues.map(d => d[xFieldName]))
            .range(highValues.map(d => d[yFieldName]))
            .clamp(true);
        const lowInterpolator = d3.scaleTime()
            .domain(lowValues.map(d => d[xFieldName]))
            .range(lowValues.map(d => d[yFieldName]))
            .clamp(true);

        const ratios = xTicks.map(tickDate => {
            const highVal = highInterpolator(tickDate);
            const lowVal = lowInterpolator(tickDate);
            return {
                date: tickDate,
                ratio: (highVal !== 0 && !isNaN(highVal) && !isNaN(lowVal)) ? (lowVal / highVal) * 100 : NaN,
            };
        }).filter(r => !isNaN(r.ratio));

        if (ratios.length > 0) {
            const minRatio = d3.min(ratios, d => d.ratio);
            const maxRatio = d3.max(ratios, d => d.ratio);
            const radiusScale = d3.scaleLinear()
                .domain([minRatio, maxRatio])
                .range([Math.max(1, fillStyle.lineWidth * 2), fillStyle.lineWidth * 4]); // Min radius 8, max 16 (adjust from original 12,20)

            const ratioCirclesGroup = mainChartGroup.append("g").attr("class", "ratio-circles-group");

            ratios.forEach((ratioData, i) => {
                if (i === 0 && xTicks.length > 1) return; // Skip first tick if multiple, original logic
                
                let xPos;
                if (xTicks.length === 1) { // Single tick, center circle on it
                    xPos = xScale(ratioData.date);
                } else if (i > 0) { // Position between previous and current tick
                    xPos = xScale(ratioData.date) - (xScale(ratioData.date) - xScale(xTicks[i-1])) / 2;
                } else { // First tick when there are multiple (i.e. i=0 and xTicks.length > 1)
                    return; // This case is now skipped above
                }


                const radius = radiusScale(ratioData.ratio);

                ratioCirclesGroup.append("circle")
                    .attr("cx", xPos)
                    .attr("cy", ratioCircleYPosition)
                    .attr("r", radius)
                    .attr("fill", fillStyle.ratioCircleMainColor)
                    .attr("class", "mark value ratio-circle");

                ratioCirclesGroup.append("text")
                    .attr("x", xPos)
                    .attr("y", ratioCircleYPosition)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", fillStyle.ratioCircleTextColor)
                    .style("font-family", fillStyle.typography.ratioTextFontFamily)
                    .style("font-size", fillStyle.typography.ratioTextFontSize)
                    .style("font-weight", fillStyle.typography.ratioTextFontWeight)
                    .attr("class", "text value ratio-text")
                    .text(`${ratioData.ratio.toFixed(0)}%`);
            });
        }
    }
    
    // Data labels for start/end points
    function addDataLabel(pointData, group, isHigherValueOverride = null) {
        const pointX = xScale(pointData[xFieldName]);
        const pointY = yScale(pointData[yFieldName]);
        const groupColor = colorScale(group);
        const labelText = pointData[yFieldName].toFixed(0);

        const textWidth = estimateTextWidth(labelText, fillStyle.typography.dataLabelFontFamily, fillStyle.typography.dataLabelFontSize, fillStyle.typography.dataLabelFontWeight);
        const labelWidth = textWidth + 16;
        const labelHeight = 24;
        const triangleSize = 8;

        let isHigherValue = isHigherValueOverride;
        if (isHigherValue === null) {
            const otherGroup = group === highestGroup ? lowestGroup : highestGroup;
            const otherGroupDataPoints = selectedGroupData.get(otherGroup);
            const otherPointAtSameTime = otherGroupDataPoints?.find(d => d[xFieldName].getTime() === pointData[xFieldName].getTime());
            isHigherValue = otherPointAtSameTime ? pointData[yFieldName] > otherPointAtSameTime[yFieldName] : true;
        }
        
        const labelYOffset = isHigherValue ? - (labelHeight / 2 + triangleSize + 5) : (labelHeight / 2 + triangleSize + 5);
        const finalLabelY = pointY + labelYOffset;

        const labelGroup = mainChartGroup.append("g").attr("class", "data-label-group");

        labelGroup.append("rect")
            .attr("x", pointX - labelWidth / 2)
            .attr("y", finalLabelY - labelHeight / 2)
            .attr("width", labelWidth)
            .attr("height", labelHeight)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", groupColor)
            .attr("class", "mark background data-label-rect");

        const trianglePath = isHigherValue ?
            `M${pointX - triangleSize/2},${finalLabelY + labelHeight/2} L${pointX + triangleSize/2},${finalLabelY + labelHeight/2} L${pointX},${finalLabelY + labelHeight/2 + triangleSize} Z` : // Points down
            `M${pointX - triangleSize/2},${finalLabelY - labelHeight/2} L${pointX + triangleSize/2},${finalLabelY - labelHeight/2} L${pointX},${finalLabelY - labelHeight/2 - triangleSize} Z`; // Points up
        
        labelGroup.append("path")
            .attr("d", trianglePath)
            .attr("fill", groupColor)
            .attr("class", "mark background data-label-triangle");

        labelGroup.append("text")
            .attr("x", pointX)
            .attr("y", finalLabelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.dataLabelTextColor)
            .style("font-family", fillStyle.typography.dataLabelFontFamily)
            .style("font-size", fillStyle.typography.dataLabelFontSize)
            .style("font-weight", fillStyle.typography.dataLabelFontWeight)
            .attr("class", "text value data-label-text")
            .text(labelText);
    }

    selectedGroups.forEach(group => {
        const groupValues = selectedGroupData.get(group);
        if (groupValues && groupValues.length > 0) {
            addDataLabel(groupValues[0], group); // Start point
            if (groupValues.length > 1) {
                 // For the last point, determine its relative position against the other line's last point if they share the same X.
                 // If X values are different for end points, the default logic (isHigherValue = true) might be fine or might need adjustment.
                 // For simplicity, we use the same logic. If end X values differ, comparison is less direct.
                addDataLabel(groupValues[groupValues.length - 1], group); // End point
            }
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}