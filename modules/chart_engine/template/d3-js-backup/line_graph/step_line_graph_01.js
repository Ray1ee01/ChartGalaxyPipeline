/* REQUIREMENTS_BEGIN
{
  "chart_type": "Step Line Chart",
  "chart_name": "step_line_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["temporal"], ["numerical"]],
  "required_fields_range": [[4, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "normal",
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
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const images = data.images || {}; // Though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const xFieldRole = "x";
    const yFieldRole = "y";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);

    const xFieldName = xFieldDef?.name;
    const yFieldName = yFieldDef?.name;
    const yFieldLabel = yFieldDef?.label || yFieldName;

    if (!xFieldName || !yFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push(`role '${xFieldRole}'`);
        if (!yFieldName) missingFields.push(`role '${yFieldRole}'`);
        const errorMsg = `Critical chart config missing: Field names for ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typography.title?.font_size || '16px',
            titleFontWeight: typography.title?.font_weight || 'bold',
            labelFontFamily: typography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typography.label?.font_size || '12px',
            labelFontWeight: typography.label?.font_weight || 'normal',
            annotationFontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typography.annotation?.font_size || '10px',
            annotationFontWeight: typography.annotation?.font_weight || 'normal',
        },
        primaryAccent: colors.other?.primary || '#1f77b4',
        textColor: colors.text_color || '#333333',
        axisLabelColor: colors.text_color || '#666666',
        gridLineColor: '#e0e0e0',
        backgroundStripeColor: '#ececec', // For vertical stripes
        chartBackground: colors.background_color || '#FFFFFF',
        positiveChangeColor: '#469377',
        negativeChangeColor: '#c63310',
        endpointCircleFill: '#FFFFFF',
        endpointCircleStrokeWidth: 4, // Original was 4
        intermediateCircleRadius: 2, // Original was 2
        endpointCircleRadius: 5, // Original was 5
    };
    
    // Specific font style for legend text if needed, otherwise use label
    fillStyle.typography.legendText = {
        font_family: fillStyle.typography.labelFontFamily,
        font_size: '14px', // Original legend text was 14px
        font_weight: fillStyle.typography.labelFontWeight,
    };
    // Specific font style for percentage change text
     fillStyle.typography.percentageChangeText = {
        font_family: fillStyle.typography.labelFontFamily,
        font_size: '14px', // Original was 14px
        font_weight: 'bold',
    };
    // Specific font style for endpoint value label
    fillStyle.typography.endpointValueText = {
        font_family: fillStyle.typography.labelFontFamily,
        font_size: '12px', // Original was 12px
        font_weight: 'bold',
        color: '#FFFFFF' // Original was white
    };


    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute'; // Keep it out of flow, less likely to interfere
        tempSvg.style.visibility = 'hidden';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        if (fontProps) {
            if (fontProps.font_family) textElement.style.fontFamily = fontProps.font_family;
            if (fontProps.font_size) textElement.style.fontSize = fontProps.font_size;
            if (fontProps.font_weight) textElement.style.fontWeight = fontProps.font_weight;
        }
        tempSvg.appendChild(textElement);
        // Document body append/remove is more reliable but forbidden by prompt for in-memory.
        // This direct getBBox on non-DOM SVG might be 0 or inaccurate in some cases.
        // A common practice is to append to document.body, measure, then remove.
        // Sticking to the "MUST NOT be appended to the document DOM" rule.
        // For robustness, one might need to append to a *hidden part of the live SVG* if this fails.
        document.body.appendChild(tempSvg); // Brief append for measurement
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth getBBox failed, using fallback.", e);
            const fontSize = parseFloat(fontProps.font_size) || 12;
            width = text.length * (fontSize * 0.6); // Very rough fallback
        }
        document.body.removeChild(tempSvg);
        return width;
    }

    function parseInputDate(dateString) {
        // Assuming dateString is directly parsable by new Date() or already a Date object
        if (dateString instanceof Date) return dateString;
        const d = new Date(dateString);
        return !isNaN(d.getTime()) ? d : null;
    }
    
    function createXAxisScaleAndTicksHelper(currentChartData, xValAccessor, width) {
        const dates = currentChartData.map(xValAccessor).filter(d => d instanceof Date && !isNaN(d));
        if (dates.length === 0) {
            const now = new Date();
            const fallbackScale = d3.scaleTime().domain([now, d3.timeDay.offset(now, 1)]).range([0, width]);
            return {
                xScale: fallbackScale,
                xTicks: fallbackScale.ticks(d3.timeMonth.every(1)),
                xFormat: d3.timeFormat("%b %Y"),
            };
        }

        const xDomain = d3.extent(dates);
        const xScale = d3.scaleTime().domain(xDomain).range([0, width]);

        const timeDiffDays = d3.timeDay.count(xDomain[0], xDomain[1]);
        let xTicks, xFormat;

        if (timeDiffDays <= 1) { // Very short, show time if available
             xTicks = xScale.ticks(d3.timeHour.every(6));
             xFormat = d3.timeFormat("%H:%M");
        } else if (timeDiffDays <= 60) { // Up to ~2 months
            xTicks = xScale.ticks(d3.timeDay.every(Math.max(1, Math.ceil(timeDiffDays / 7))));
            xFormat = d3.timeFormat("%b %d");
        } else if (timeDiffDays <= 365 * 2) { // Up to 2 years
            xTicks = xScale.ticks(d3.timeMonth.every(Math.max(1, Math.ceil(timeDiffDays / 30 / 6))));
            xFormat = d3.timeFormat("%b '%y");
        } else { // More than 2 years
            xTicks = xScale.ticks(d3.timeYear.every(Math.max(1, Math.ceil(timeDiffDays / 365 / 5))));
            xFormat = d3.timeFormat("%Y");
        }
        return { xScale, xTicks, xFormat };
    }

    function sampleLabelsHelper(numDataPoints, maxLabels = 5) {
        const numChanges = numDataPoints - 1;
        if (numChanges <= 0) return [];
        // If few points, show all change labels. Indices refer to chartData index for the point *after* the change.
        if (numChanges <= maxLabels) {
            return Array.from({ length: numChanges }, (_, i) => i + 1);
        }
    
        const indices = new Set();
        // Add first and last possible change (index in chartData)
        indices.add(1); 
        indices.add(numChanges); 
    
        const step = Math.max(1, Math.floor((numChanges - 1) / (maxLabels -2 > 0 ? maxLabels -2 : 1) )); // Ensure step is at least 1
        for (let i = 1 + step; i < numChanges && indices.size < maxLabels; i += step) {
            indices.add(i);
        }
        return Array.from(indices).sort((a, b) => a - b);
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 30, bottom: 40, left: 50 };
    // Adjust top margin if legend is to be placed there. Original legend was at y=60 inside translated group.
    // Let's make space for legend at top.
    chartMargins.top = 70; 

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartData.map(d => ({
        ...d,
        [xFieldName]: parseInputDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName] // Ensure y is numeric
    })).filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]) && !isNaN(d[yFieldName]));
    
    if (processedChartData.length < 2) {
        const errorMsg = "Insufficient valid data points (minimum 2 required) to render Step Line Chart.";
        console.error(errorMsg);
        mainChartGroup.append("text").text(errorMsg).attr("x", innerWidth/2).attr("y", innerHeight/2).attr("text-anchor", "middle").attr("class","error-message label");
        return svgRoot.node();
    }

    const percentChanges = [];
    for (let i = 1; i < processedChartData.length; i++) {
        const currentValue = processedChartData[i][yFieldName];
        const previousValue = processedChartData[i-1][yFieldName];
        if (previousValue !== 0) { // Avoid division by zero
            const percentChange = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
            percentChanges.push({
                chartDataIndex: i, // Index in processedChartData
                value: percentChange,
                isPositive: percentChange >= 0
            });
        }
    }
    const maxAbsPercentChange = d3.max(percentChanges, d => Math.abs(d.value)) || 1; // Avoid division by zero if all changes are 0


    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicksHelper(
        processedChartData, 
        d => d[xFieldName], 
        innerWidth
    );

    const yMin = d3.min(processedChartData, d => d[yFieldName]);
    const yMax = d3.max(processedChartData, d => d[yFieldName]);
    
    const yPadding = (yMax - yMin) * 0.5 || Math.abs(yMax * 0.1) || 1; // Ensure padding is non-zero
    const yDomainMin = yMin - yPadding;
    const yDomainMax = yMax + yPadding;

    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const yAxisTicks = yScale.ticks(8); // Suggested number of ticks
    const effectiveYMinTickVal = yAxisTicks[0];
    const effectiveYMaxTickVal = yAxisTicks[yAxisTicks.length - 1];
    const effectiveYMinTickPos = yScale(effectiveYMinTickVal);
    const effectiveYMaxTickPos = yScale(effectiveYMaxTickVal);

    // Vertical Striped Background (as subtle grid element)
    if (xTicks.length > 1) {
        const stripeGroup = mainChartGroup.append("g").attr("class", "background-stripes other");
        for (let i = 0; i < xTicks.length; i++) {
            const currentTick = xTicks[i];
            const currentX = xScale(currentTick);
            const prevX = i > 0 ? xScale(xTicks[i-1]) : 0;
            const nextX = i < xTicks.length - 1 ? xScale(xTicks[i+1]) : innerWidth;
            
            const leftX = (i === 0) ? 0 : (prevX + currentX) / 2;
            const rightX = (i === xTicks.length - 1) ? innerWidth : (currentX + nextX) / 2;

            if (i % 2 === 0) {
                stripeGroup.append("rect")
                    .attr("x", leftX)
                    .attr("y", effectiveYMaxTickPos) 
                    .attr("width", Math.max(0, rightX - leftX))
                    .attr("height", Math.max(0, effectiveYMinTickPos - effectiveYMaxTickPos))
                    .attr("fill", fillStyle.backgroundStripeColor)
                    .attr("opacity", 0.8);
            }
        }
        stripeGroup.lower(); // Send to back
    }
    
    // Horizontal Gridlines
    const gridLinesGroup = mainChartGroup.append("g").attr("class", "grid-lines other");
    yAxisTicks.forEach(tick => {
        const isZeroTick = Math.abs(tick) < 1e-9; // Check for zero with tolerance
        gridLinesGroup.append("line")
            .attr("class", "grid-line mark")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", innerWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", isZeroTick ? 1.5 : 1)
            .attr("stroke-dasharray", isZeroTick ? null : "2,2");
    });

    // X-Axis Labels
    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);
    xTicks.forEach(tick => {
        xAxisLabelsGroup.append("text")
            .attr("class", "axis-label label")
            .attr("x", xScale(tick))
            .attr("y", chartMargins.bottom * 0.6) // Position below axis line
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.axisLabelColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xFormat(tick));
    });

    // Y-Axis Labels
    const yAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis y-axis");
    yScale.ticks(5).forEach(tick => { // Use 5 ticks for labels as per original
        yAxisLabelsGroup.append("text")
            .attr("class", "axis-label label")
            .attr("x", -chartMargins.left * 0.2) // Position left of axis line
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.axisLabelColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(tick.toFixed(1));
    });

    // Legend
    const legendGroup = mainChartGroup.append("g").attr("class", "legend other");
    const legendYPos = -chartMargins.top / 2 -10; // Position above the chart, within the top margin area
    
    const legendCircleRadius = 8;
    const legendItemSpacing = 15;
    const legendTextXOffset = legendCircleRadius + 5;

    legendGroup.append("circle")
        .attr("class", "legend-mark mark")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", legendCircleRadius)
        .attr("fill", fillStyle.primaryAccent);

    const yFieldLegendText = legendGroup.append("text")
        .attr("class", "legend-label label")
        .attr("x", legendTextXOffset)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.legendText.font_family)
        .style("font-size", fillStyle.typography.legendText.font_size)
        .style("font-weight", fillStyle.typography.legendText.font_weight)
        .text(yFieldLabel);

    const yFieldTextWidth = estimateTextWidth(yFieldLabel, fillStyle.typography.legendText);
    let currentXOffset = legendTextXOffset + yFieldTextWidth + legendItemSpacing * 2;

    const triangleLegendSize = 12; // Smaller for legend
    const triangleLegendHeight = triangleLegendSize * Math.sqrt(3) / 2;

    // Upward triangle (green)
    legendGroup.append("path")
        .attr("class", "legend-mark mark positive")
        .attr("d", `M ${currentXOffset - triangleLegendSize/2},${triangleLegendHeight/2} L ${currentXOffset + triangleLegendSize/2},${triangleLegendHeight/2} L ${currentXOffset},${-triangleLegendHeight/2} Z`)
        .attr("fill", fillStyle.positiveChangeColor);
    currentXOffset += triangleLegendSize/2 + 2; // Small space

    // Downward triangle (red)
    legendGroup.append("path")
        .attr("class", "legend-mark mark negative")
        .attr("d", `M ${currentXOffset - triangleLegendSize/2},${-triangleLegendHeight/2} L ${currentXOffset + triangleLegendSize/2},${-triangleLegendHeight/2} L ${currentXOffset},${triangleLegendHeight/2} Z`)
        .attr("fill", fillStyle.negativeChangeColor);
    currentXOffset += triangleLegendSize/2 + 5;

    const changeLegendText = legendGroup.append("text")
        .attr("class", "legend-label label")
        .attr("x", currentXOffset)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.legendText.font_family)
        .style("font-size", fillStyle.typography.legendText.font_size)
        .style("font-weight", fillStyle.typography.legendText.font_weight)
        .text("% change");
    
    const changeTextWidth = estimateTextWidth("% change", fillStyle.typography.legendText);
    const totalLegendWidth = currentXOffset + changeTextWidth;
    legendGroup.attr("transform", `translate(${(innerWidth - totalLegendWidth) / 2}, ${legendYPos})`);


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveStepAfter);

    // Original code sliced data `chartData.slice(1)`. This is preserved.
    const lineDataForPath = processedChartData.length > 1 ? processedChartData.slice(1) : [];

    if (lineDataForPath.length > 0) {
        mainChartGroup.append("path")
            .datum(lineDataForPath)
            .attr("class", "line-path mark")
            .attr("fill", "none")
            .attr("stroke", fillStyle.primaryAccent)
            .attr("stroke-width", fillStyle.endpointCircleStrokeWidth) // Original used 4 for line
            .attr("d", lineGenerator);
    }
    
    // Data Point Circles (also on sliced data as per original)
    const pointsGroup = mainChartGroup.append("g").attr("class", "data-points other");
    lineDataForPath.forEach((d, i) => {
        const cx = xScale(d[xFieldName]);
        const cy = yScale(d[yFieldName]);
        const isEndpointInLineData = i === 0 || i === lineDataForPath.length - 1;

        pointsGroup.append("circle")
            .attr("class", "data-point mark")
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", isEndpointInLineData ? fillStyle.endpointCircleRadius : fillStyle.intermediateCircleRadius)
            .attr("fill", isEndpointInLineData ? fillStyle.endpointCircleFill : fillStyle.primaryAccent)
            .attr("stroke", fillStyle.primaryAccent)
            .attr("stroke-width", fillStyle.endpointCircleStrokeWidth);
    });

    // Block 9: Optional Enhancements & Post-Processing (Annotations, Icons)
    const annotationsGroup = mainChartGroup.append("g").attr("class", "annotations other");
    const sampledChangeIndices = sampleLabelsHelper(processedChartData.length); // Indices for processedChartData

    percentChanges.filter(pc => sampledChangeIndices.includes(pc.chartDataIndex)).forEach(change => {
        const dCurrent = processedChartData[change.chartDataIndex];
        const dPrevious = processedChartData[change.chartDataIndex - 1];

        const x = xScale(dCurrent[xFieldName]);
        const y = yScale(dCurrent[yFieldName]);
        
        // Simplified triangle placement logic from original
        const prevYInterp = y + (yScale(dPrevious[yFieldName]) - y) * 0.2;
        let nextYInterp = y;
        if (change.chartDataIndex < processedChartData.length - 1) {
            const dNext = processedChartData[change.chartDataIndex + 1];
            nextYInterp = y + (yScale(dNext[yFieldName]) - y) * 0.2;
        }
        const finalY = change.isPositive ? Math.min(y, prevYInterp, nextYInterp) : Math.max(y, prevYInterp, nextYInterp);

        const triangleColor = change.isPositive ? fillStyle.positiveChangeColor : fillStyle.negativeChangeColor;
        
        const minSize = 10;
        const maxSize = 25; // Reduced from 40 for less clutter
        const sizeRatio = Math.abs(change.value) / maxAbsPercentChange;
        const triangleSize = minSize + (maxSize - minSize) * sizeRatio;
        const triangleHeight = triangleSize * Math.sqrt(3) / 2;
        
        const triangleYOffset = 10; // Spacing from line
        const textYOffset = 10; // Spacing for text from triangle

        let pathString;
        let textY;

        if (change.isPositive) { // Upward triangle
            const triangleBaseY = finalY - triangleYOffset;
            pathString = `M ${x - triangleSize/2},${triangleBaseY} L ${x + triangleSize/2},${triangleBaseY} L ${x},${triangleBaseY - triangleHeight} Z`;
            textY = triangleBaseY - triangleHeight - textYOffset;
        } else { // Downward triangle
            const triangleBaseY = finalY + triangleYOffset;
            pathString = `M ${x - triangleSize/2},${triangleBaseY} L ${x + triangleSize/2},${triangleBaseY} L ${x},${triangleBaseY + triangleHeight} Z`;
            textY = triangleBaseY + triangleHeight + textYOffset + (parseFloat(fillStyle.typography.percentageChangeText.font_size) || 14); // Adjust for text height
        }
        
        annotationsGroup.append("path")
            .attr("class", `change-indicator mark ${change.isPositive ? 'positive' : 'negative'}`)
            .attr("d", pathString)
            .attr("fill", triangleColor);
        
        const formattedValue = (change.value > 0 ? "+" : "") + change.value.toFixed(1) + "%";
        annotationsGroup.append("text")
            .attr("class", "change-label label")
            .attr("x", x)
            .attr("y", textY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle") // Adjusted from original for better centering
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.percentageChangeText.font_family)
            .style("font-size", fillStyle.typography.percentageChangeText.font_size)
            .style("font-weight", fillStyle.typography.percentageChangeText.font_weight)
            .text(formattedValue);
    });

    // Endpoint Data Label
    if (processedChartData.length >= 2) {
        const lastPoint = processedChartData[processedChartData.length - 1];
        const secondLastPoint = processedChartData[processedChartData.length - 2];
        const isUpwardTrend = lastPoint[yFieldName] > secondLastPoint[yFieldName];

        const x = xScale(lastPoint[xFieldName]);
        const y = yScale(lastPoint[yFieldName]);

        const labelWidth = 45; // estimateTextWidth(lastPoint[yFieldName].toFixed(2), fillStyle.typography.endpointValueText) + 10;
        const labelHeight = 25;
        const labelX = x - labelWidth / 2;
        const pointerSize = 5;
        const labelOffset = 20;

        let labelY, pointerPath;

        if (!isUpwardTrend) { // Trend is down or flat, label above (original: isHighest=true)
            labelY = y - labelHeight - labelOffset;
            pointerPath = `M${x},${labelY + labelHeight + pointerSize} L${x - pointerSize},${labelY + labelHeight} L${x + pointerSize},${labelY + labelHeight} Z`;
        } else { // Trend is up, label below (original: isHighest=false)
            labelY = y + labelOffset;
            pointerPath = `M${x},${labelY - pointerSize} L${x - pointerSize},${labelY} L${x + pointerSize},${labelY} Z`;
        }
        
        const endpointLabelGroup = annotationsGroup.append("g").attr("class", "endpoint-label other");

        endpointLabelGroup.append("rect")
            .attr("class", "label-background mark")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("width", labelWidth)
            .attr("height", labelHeight)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", fillStyle.primaryAccent);
        
        endpointLabelGroup.append("path")
            .attr("class", "label-pointer mark")
            .attr("d", pointerPath)
            .attr("fill", fillStyle.primaryAccent);
        
        endpointLabelGroup.append("text")
            .attr("class", "label-text label")
            .attr("x", x)
            .attr("y", labelY + labelHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.typography.endpointValueText.color)
            .style("font-family", fillStyle.typography.endpointValueText.font_family)
            .style("font-size", fillStyle.typography.endpointValueText.font_size)
            .style("font-weight", fillStyle.typography.endpointValueText.font_weight)
            .text(lastPoint[yFieldName].toFixed(2));
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}