/* REQUIREMENTS_BEGIN
{
  "chart_type": "Stepped Line Chart",
  "chart_name": "stepped_line_plain_chart_01",
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
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a stepped line chart with percentage change indicators.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or colors_dark would be handled by caller
    const images = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data.columns || [];

    const xFieldRole = "x";
    const yFieldRole = "y";

    const xDataColumn = dataColumns.find(col => col.role === xFieldRole);
    const yDataColumn = dataColumns.find(col => col.role === yFieldRole);

    let missingConfigs = [];
    if (!xDataColumn) missingConfigs.push(`Data column with role '${xFieldRole}'`);
    if (!yDataColumn) missingConfigs.push(`Data column with role '${yFieldRole}'`);

    if (missingConfigs.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingConfigs.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xDataColumn.name;
    const yFieldName = yDataColumn.name;
    const yFieldLabel = yDataColumn.label || yDataColumn.name;


    if (!chartDataInput || chartDataInput.length < 2) {
        const errorMsg = "Chart data must contain at least two data points.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography
    fillStyle.typography.axisLabelFontFamily = (typography.label && typography.label.font_family) || 'Arial, sans-serif';
    fillStyle.typography.axisLabelFontSize = (typography.label && typography.label.font_size) || '12px';
    fillStyle.typography.axisLabelFontWeight = (typography.label && typography.label.font_weight) || 'normal';

    fillStyle.typography.legendTextFontFamily = (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif';
    fillStyle.typography.legendTextFontSize = (typography.annotation && typography.annotation.font_size) || '14px'; // Defaulting to 14px for this chart
    fillStyle.typography.legendTextFontWeight = (typography.annotation && typography.annotation.font_weight) || 'normal';

    fillStyle.typography.percentChangeTextFontFamily = (typography.title && typography.title.font_family) || 'Arial, sans-serif';
    fillStyle.typography.percentChangeTextFontSize = (typography.title && typography.title.font_size) || '14px'; // Defaulting to 14px
    fillStyle.typography.percentChangeTextFontWeight = (typography.title && typography.title.font_weight) || 'bold';

    fillStyle.typography.dataValueAnnotationFontFamily = (typography.label && typography.label.font_family) || 'Arial, sans-serif';
    fillStyle.typography.dataValueAnnotationFontSize = (typography.label && typography.label.font_size) || '12px';
    fillStyle.typography.dataValueAnnotationFontWeight = (typography.label && typography.label.font_weight) || 'bold'; // Defaulting to bold

    // Colors
    fillStyle.colors.textColor = colors.text_color || '#333333';
    fillStyle.colors.axisTextColor = colors.text_color || '#666666';
    fillStyle.colors.primaryLineColor = (colors.other && colors.other.primary) || '#1f77b4';
    fillStyle.colors.gridLineColor = '#e0e0e0';
    fillStyle.colors.stripeBackgroundColor = '#ececec';
    fillStyle.colors.trendUpColor = '#469377';
    fillStyle.colors.trendDownColor = '#c63310';
    fillStyle.colors.annotationRectFill = fillStyle.colors.primaryLineColor;
    fillStyle.colors.annotationRectText = '#FFFFFF'; // Contrast for annotation background

    const parseDate = (dateStr) => new Date(dateStr); // Assuming ISO date strings or similar parsable by new Date()

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        // document.body.appendChild(tempSvg); // Temporarily append to getBBox to work reliably
        let width = 0;
        try {
             width = textNode.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth failed, using fallback. Error:", e);
            const avgCharWidth = parseFloat(fontSize) * 0.6;
            width = text.length * avgCharWidth;
        }
        // tempSvg.remove();
        return width;
    }
    
    function internalCreateXAxisScaleAndTicks(currentChartData, xField, parseDateFunc, width) {
        const dates = currentChartData.map(d => parseDateFunc(d[xField]));
        const xMin = d3.min(dates);
        const xMax = d3.max(dates);

        const xScale = d3.scaleTime().domain([xMin, xMax]).range([0, width]);

        const timeSpan = xMax - xMin; // milliseconds
        let xTicks, xFormat;

        if (timeSpan < 2 * 24 * 60 * 60 * 1000) { // Less than 2 days
            xTicks = xScale.ticks(d3.timeHour.every(6));
            xFormat = d3.timeFormat("%H:%M");
        } else if (timeSpan < 30 * 24 * 60 * 60 * 1000) { // Less than 30 days
            xTicks = xScale.ticks(d3.timeDay.every(Math.max(1, Math.floor(currentChartData.length / 10)))); // Dynamic tick interval
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpan < 365 * 24 * 60 * 60 * 1000) { // Less than 1 year
            xTicks = xScale.ticks(d3.timeMonth.every(1));
            xFormat = d3.timeFormat("%b");
        } else {
            xTicks = xScale.ticks(d3.timeYear.every(1));
            xFormat = d3.timeFormat("%Y");
        }
        if (xTicks.length > 10) xTicks = xScale.ticks(10);
        if (xTicks.length === 0 && currentChartData.length > 0) xTicks = [dates[0]];


        return { xScale, xTicks, xFormat, timeSpan };
    }

    function internalSampleLabels(dataLength) {
        const indices = [];
        if (dataLength <= 0) return indices;
        if (dataLength <= 5) {
            for (let i = 0; i < dataLength; i++) indices.push(i);
        } else {
            indices.push(0); 
            indices.push(Math.floor(dataLength / 2)); 
            indices.push(dataLength - 1); 
            if (dataLength > 10) {
                indices.push(Math.floor(dataLength / 4));
                indices.push(Math.floor(3 * dataLength / 4));
            }
        }
         // The indices here are for the `percentChanges` array, which is 1 shorter than chartDataInput
         // and its items correspond to chartDataInput[1], chartDataInput[2], ...
         // So, if percentChanges has length L, its indices are 0 to L-1.
         // These correspond to chartDataInput indices 1 to L.
         // The sampleLabels function in original code was used with percentChanges.length
         // and then change.index was checked. change.index is chartDataInput index.
         // So, sampleLabels should return chartDataInput indices.
        const chartDataIndices = [];
        if (chartDataInput.length <= 1) return chartDataIndices;

        if (chartDataInput.length <= 6) { // Show for all if 5 changes or less (6 data points)
            for (let i = 1; i < chartDataInput.length; i++) chartDataIndices.push(i);
        } else {
            chartDataIndices.push(1); // First change (corresponds to chartDataInput[1])
            chartDataIndices.push(Math.floor(chartDataInput.length / 2)); 
            chartDataIndices.push(chartDataInput.length - 1); // Last change
            if (chartDataInput.length > 11) { // if more than 10 changes
                chartDataIndices.push(Math.floor(chartDataInput.length / 4));
                chartDataIndices.push(Math.floor(3 * chartDataInput.length / 4));
            }
        }
        return [...new Set(chartDataIndices.filter(idx => idx > 0 && idx < chartDataInput.length))].sort((a,b) => a-b);
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    if (colors.background_color) {
        svgRoot.style("background-color", colors.background_color);
    }

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 30, bottom: 40, left: 50 }; // Original margins
    const legendAreaHeight = 80; // Approximate space for legend if placed above chart. Original legend was at y=60 within chart.
    
    // Adjust top margin if legend is to be placed above main chart area.
    // For this refactor, legend is placed inside the chart area as per original.
    // chartMargins.top = 80; // If legend was outside.

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartData = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName]
    }));
    
    const percentChanges = [];
    for (let i = 1; i < chartData.length; i++) {
        const currentValue = chartData[i][yFieldName];
        const previousValue = chartData[i-1][yFieldName];
        let percentChange = 0;
        if (previousValue !== 0) {
            percentChange = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
        } else if (currentValue !== 0) {
            percentChange = currentValue > 0 ? Infinity : -Infinity; // Or handle as 100% / -100% if preferred
        }

        percentChanges.push({
            chartDataIndex: i, // Index in the original chartData array
            value: percentChange,
            isPositive: percentChange >= 0
        });
    }
    const maxPercentChange = d3.max(percentChanges, d => Math.abs(d.value === Infinity || d.value === -Infinity ? 100 : d.value)) || 100;


    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = internalCreateXAxisScaleAndTicks(chartData, xFieldName, d => d, innerWidth);

    const yMin = d3.min(chartData, d => d[yFieldName]);
    const yMax = d3.max(chartData, d => d[yFieldName]);
    
    const yPaddingPercentage = 0.5; // Original 0.5
    const yRange = yMax - yMin;
    const yPadding = yRange === 0 ? (yMax === 0 ? 1 : Math.abs(yMax * yPaddingPercentage)) : yRange * yPaddingPercentage; // Handle yRange = 0

    const yDomainMin = yMin - yPadding;
    const yDomainMax = yMax + yPadding;
    
    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const yAxisTicks = yScale.ticks(8); // Original 8 ticks for grid, 5 for labels
    const maxYTickVal = yAxisTicks.length > 0 ? yAxisTicks[yAxisTicks.length - 1] : yDomainMax;
    const minYTickVal = yAxisTicks.length > 0 ? yAxisTicks[0] : yDomainMin;
    const maxYTickPosition = yScale(maxYTickVal);
    const minYTickPosition = yScale(minYTickVal);

    // X-axis stripes
    if (xTicks.length > 0) {
        for (let i = 0; i < xTicks.length; i++) {
            const currentTick = xTicks[i];
            const currentX = xScale(currentTick);
            const prevX = i > 0 ? xScale(xTicks[i-1]) : 0;
            const nextX = i < xTicks.length - 1 ? xScale(xTicks[i+1]) : innerWidth;
            
            const leftX = (prevX + currentX) / 2;
            const rightX = (currentX + nextX) / 2;
            
            if (i % 2 === 0) {
                mainChartGroup.append("rect")
                    .attr("x", leftX)
                    .attr("y", maxYTickPosition)
                    .attr("width", Math.max(0, rightX - leftX))
                    .attr("height", Math.max(0, minYTickPosition - maxYTickPosition))
                    .attr("fill", fillStyle.colors.stripeBackgroundColor)
                    .attr("class", "background stripe")
                    .attr("opacity", 0.8);
            }
        }
    }
    mainChartGroup.selectAll("rect.stripe").lower(); // Move stripes to bottom

    // Horizontal gridlines
    const gridLinesGroup = mainChartGroup.append("g").attr("class", "grid-lines");
    yAxisTicks.forEach(tick => {
        const isZeroTick = Math.abs(tick) < 1e-9; // Check for zero with tolerance
        gridLinesGroup.append("line")
            .attr("class", "gridline y-gridline")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", innerWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.colors.gridLineColor)
            .attr("stroke-width", isZeroTick ? 1.5 : 1)
            .attr("stroke-dasharray", isZeroTick ? null : "2,2");
    });

    // X-axis labels
    const xAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis x-axis-labels");
    xTicks.forEach(tick => {
        xAxisLabelsGroup.append("text")
            .attr("class", "label x-axis-label")
            .attr("x", xScale(tick))
            .attr("y", minYTickPosition + 25) // Position below lowest Y tick line
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.colors.axisTextColor)
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .text(xFormat(tick));
    });

    // Y-axis labels
    const yAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis y-axis-labels");
    yScale.ticks(5).forEach(tick => { // Original used 5 ticks for labels
        yAxisLabelsGroup.append("text")
            .attr("class", "label y-axis-label")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.colors.axisTextColor)
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .text(tick.toFixed(1));
    });

    // Legend
    const legendGroup = mainChartGroup.append("g").attr("class", "legend");
    const legendItemSpacing = 20;
    const legendSymbolSize = 8;
    const legendTriangleSize = 18;
    const legendTriangleHeight = legendTriangleSize * Math.sqrt(3) / 2;
    const legendTriangleSpacing = -4; // Original spacing

    // Item 1: Line
    legendGroup.append("circle")
        .attr("class", "legend-symbol mark")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", legendSymbolSize)
        .attr("fill", fillStyle.colors.primaryLineColor);

    const legendText1 = legendGroup.append("text")
        .attr("class", "label legend-label")
        .attr("x", legendSymbolSize + 5)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.colors.textColor)
        .style("font-family", fillStyle.typography.legendTextFontFamily)
        .style("font-size", fillStyle.typography.legendTextFontSize)
        .style("font-weight", fillStyle.typography.legendTextFontWeight)
        .text(yFieldLabel);

    const text1Width = estimateTextWidth(yFieldLabel, fillStyle.typography.legendTextFontFamily, fillStyle.typography.legendTextFontSize, fillStyle.typography.legendTextFontWeight);
    let currentXOffset = legendSymbolSize + 5 + text1Width + legendItemSpacing;

    // Item 2: Percent Change Triangles
    const upTriangleX = currentXOffset + legendTriangleSize / 2;
    const upTop = [upTriangleX, 0 - legendTriangleHeight / 2];
    const upBottomLeft = [upTriangleX - legendTriangleSize / 2, 0 + legendTriangleHeight / 2];
    const upBottomRight = [upTriangleX + legendTriangleSize / 2, 0 + legendTriangleHeight / 2];

    legendGroup.append("path")
        .attr("class", "legend-symbol mark trend-up-indicator")
        .attr("d", `M ${upBottomLeft[0]},${upBottomLeft[1]} L ${upBottomRight[0]},${upBottomRight[1]} L ${upTop[0]},${upTop[1]} Z`)
        .attr("fill", fillStyle.colors.trendUpColor);

    currentXOffset = upTriangleX + legendTriangleSize / 2 + legendTriangleSpacing;

    const downTriangleX = currentXOffset + legendTriangleSize / 2;
    const downBottom = [downTriangleX, 0 + legendTriangleHeight / 2];
    const downTopLeft = [downTriangleX - legendTriangleSize / 2, 0 - legendTriangleHeight / 2];
    const downTopRight = [downTriangleX + legendTriangleSize / 2, 0 - legendTriangleHeight / 2];

    legendGroup.append("path")
        .attr("class", "legend-symbol mark trend-down-indicator")
        .attr("d", `M ${downTopLeft[0]},${downTopLeft[1]} L ${downTopRight[0]},${downTopRight[1]} L ${downBottom[0]},${downBottom[1]} Z`)
        .attr("fill", fillStyle.colors.trendDownColor);
    
    currentXOffset = downTriangleX + legendTriangleSize / 2 + 5;

    const legendText2 = legendGroup.append("text")
        .attr("class", "label legend-label")
        .attr("x", currentXOffset)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.colors.textColor)
        .style("font-family", fillStyle.typography.legendTextFontFamily)
        .style("font-size", fillStyle.typography.legendTextFontSize)
        .style("font-weight", fillStyle.typography.legendTextFontWeight)
        .text("% change");
    
    const text2Width = estimateTextWidth("% change", fillStyle.typography.legendTextFontFamily, fillStyle.typography.legendTextFontSize, fillStyle.typography.legendTextFontWeight);
    const totalLegendWidth = currentXOffset + text2Width;
    const legendTopOffset = 60; // Original y-position for legend group
    legendGroup.attr("transform", `translate(${(innerWidth - totalLegendWidth) / 2}, ${legendTopOffset})`);


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveStepAfter);

    const lineData = chartData.slice(1); // Line starts from the second data point as per original

    if (lineData.length > 0) {
        mainChartGroup.append("path")
            .datum(lineData)
            .attr("class", "line-mark mark")
            .attr("fill", "none")
            .attr("stroke", fillStyle.colors.primaryLineColor)
            .attr("stroke-width", 4)
            .attr("d", lineGenerator);

        // Data point circles (also starting from the second data point)
        const dataPointsGroup = mainChartGroup.append("g").attr("class", "data-points");
        lineData.forEach((d, i) => {
            const x = xScale(d[xFieldName]);
            const y = yScale(d[yFieldName]);
            const isEndpoint = i === 0 || i === lineData.length - 1;

            dataPointsGroup.append("circle")
                .attr("class", "data-point-mark mark")
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", isEndpoint ? 5 : 2)
                .attr("fill", isEndpoint ? fillStyle.colors.annotationRectText : fillStyle.colors.primaryLineColor) // Assuming white for endpoints
                .attr("stroke", fillStyle.colors.primaryLineColor)
                .attr("stroke-width", 4); // Original was 4, seems thick, but preserving
        });
    }

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons)
    const percentChangeMarkersGroup = mainChartGroup.append("g").attr("class", "percent-change-markers");
    const sampleLabelIndices = internalSampleLabels(chartData.length); // Get indices for chartData

    percentChanges.forEach(change => {
        if (!sampleLabelIndices.includes(change.chartDataIndex)) {
            return;
        }
        const d = chartData[change.chartDataIndex];
        const x = xScale(d[xFieldName]);
        const y = yScale(d[yFieldName]);

        const prevY = yScale(chartData[change.chartDataIndex - 1][yFieldName]);
        
        // Determine interpolated Y for triangle base to avoid line crossing
        // This logic is simplified from original; original had nextYInterp too.
        // For stepped line, the triangle should be relative to the current point's Y or previous point's Y.
        // Let's place it relative to current point 'y' and previous point 'prevY'.
        const finalY = change.isPositive ? Math.min(y, prevY) : Math.max(y, prevY);

        const triangleColor = change.isPositive ? fillStyle.colors.trendUpColor : fillStyle.colors.trendDownColor;
        
        const absChange = Math.abs(change.value === Infinity || change.value === -Infinity ? 100 : change.value);
        const minSize = 10;
        const maxSize = 40;
        const ratio = maxPercentChange > 0 ? absChange / maxPercentChange : 0;
        const size = minSize + (maxSize - minSize) * ratio;
        const triHeight = size * Math.sqrt(3) / 2;
        const radius = 3; // For rounded corners

        let pathDef;
        const triangleYOffset = 10; // Offset from line
        let textYOffset = 20; // Offset for text from triangle

        if (change.isPositive) {
            const triY = finalY - triHeight - triangleYOffset;
            const topPt = [x, triY];
            const bL = [x - size/2, triY + triHeight];
            const bR = [x + size/2, triY + triHeight];
            pathDef = `M ${bL[0] + radius},${bL[1]} L ${bR[0] - radius},${bR[1]} Q ${bR[0]},${bR[1]} ${bR[0] - radius * 0.5},${bR[1] - radius * 0.866} L ${topPt[0] + radius * 0.5},${topPt[1] + radius * 0.866} Q ${topPt[0]},${topPt[1]} ${topPt[0] - radius * 0.5},${topPt[1] + radius * 0.866} L ${bL[0] + radius * 0.5},${bL[1] - radius * 0.866} Q ${bL[0]},${bL[1]} ${bL[0] + radius},${bL[1]} Z`;
            textYOffset = triY - textYOffset;
        } else {
            const triY = finalY + triangleYOffset;
            const botPt = [x, triY + triHeight];
            const tL = [x - size/2, triY];
            const tR = [x + size/2, triY];
            pathDef = `M ${tL[0] + radius},${tL[1]} L ${tR[0] - radius},${tR[1]} Q ${tR[0]},${tR[1]} ${tR[0] - radius * 0.5},${tL[1] + radius * 0.866} L ${botPt[0] + radius * 0.5},${botPt[1] - radius * 0.866} Q ${botPt[0]},${botPt[1]} ${botPt[0] - radius * 0.5},${botPt[1] - radius * 0.866} L ${tL[0] + radius * 0.5},${tL[1] + radius * 0.866} Q ${tL[0]},${tL[1]} ${tL[0] + radius},${tL[1]} Z`;
            textYOffset = triY + triHeight + textYOffset;
        }
        
        percentChangeMarkersGroup.append("path")
            .attr("class", `mark percent-change-triangle ${change.isPositive ? 'up' : 'down'}`)
            .attr("d", pathDef)
            .attr("fill", triangleColor);

        let formattedValue = "";
        if (isFinite(change.value)) {
            formattedValue = (change.value > 0 ? "+" : "") + change.value.toFixed(1) + "%";
        } else {
            formattedValue = change.value > 0 ? "+Inf%" : "-Inf%";
        }
        
        percentChangeMarkersGroup.append("text")
            .attr("class", "text percent-change-label")
            .attr("x", x)
            .attr("y", textYOffset)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle") // Adjusted baseline
            .attr("fill", fillStyle.colors.textColor)
            .style("font-family", fillStyle.typography.percentChangeTextFontFamily)
            .style("font-size", fillStyle.typography.percentChangeTextFontSize)
            .style("font-weight", fillStyle.typography.percentChangeTextFontWeight)
            .text(formattedValue);
    });

    // Last point annotation
    if (chartData.length >= 2) {
        const lastPoint = chartData[chartData.length - 1];
        const secondLastPoint = chartData[chartData.length - 2];
        const isUpwardTrend = lastPoint[yFieldName] > secondLastPoint[yFieldName];

        const lx = xScale(lastPoint[xFieldName]);
        const ly = yScale(lastPoint[yFieldName]);
        
        const labelWidth = 45; // Fixed width
        const labelHeight = 25; // Fixed height
        const labelX = lx - labelWidth / 2;
        const labelYOffset = 20;
        const trianglePointerSize = 5;

        let finalLabelY, trianglePath;

        if (!isUpwardTrend) { // If trend is down or flat, label above (original: isHighest=true)
            finalLabelY = ly - labelHeight - labelYOffset;
            trianglePath = `M${lx},${finalLabelY + labelHeight + trianglePointerSize} L${lx - trianglePointerSize},${finalLabelY + labelHeight} L${lx + trianglePointerSize},${finalLabelY + labelHeight} Z`;
        } else { // If trend is up, label below (original: isHighest=false)
            finalLabelY = ly + labelYOffset;
            trianglePath = `M${lx},${finalLabelY - trianglePointerSize} L${lx - trianglePointerSize},${finalLabelY} L${lx + trianglePointerSize},${finalLabelY} Z`;
        }

        const annotationGroup = mainChartGroup.append("g").attr("class", "annotation last-point-label");

        annotationGroup.append("rect")
            .attr("class", "mark annotation-background")
            .attr("x", labelX)
            .attr("y", finalLabelY)
            .attr("width", labelWidth)
            .attr("height", labelHeight)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", fillStyle.colors.annotationRectFill);
        
        annotationGroup.append("path")
            .attr("class", "mark annotation-pointer")
            .attr("d", trianglePath)
            .attr("fill", fillStyle.colors.annotationRectFill);
        
        annotationGroup.append("text")
            .attr("class", "text annotation-text")
            .attr("x", lx)
            .attr("y", finalLabelY + labelHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.colors.annotationRectText)
            .style("font-family", fillStyle.typography.dataValueAnnotationFontFamily)
            .style("font-size", fillStyle.typography.dataValueAnnotationFontSize)
            .style("font-weight", fillStyle.typography.dataValueAnnotationFontWeight)
            .text(lastPoint[yFieldName].toFixed(2));
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}