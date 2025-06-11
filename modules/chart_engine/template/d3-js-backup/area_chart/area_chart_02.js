/* REQUIREMENTS_BEGIN
{
  "chart_type": "Area Chart",
  "chart_name": "area_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["temporal"], ["numerical"]],
  "required_fields_range": [[5, 30], [-100, 100]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["positive", "negative"],
  "min_height": 400,
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
    // This function renders an area chart distinguishing positive and negative values.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {}; // Not used in this chart, but extracted for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');

    if (!xFieldConfig || !yFieldConfig) {
        const missing = [];
        if (!xFieldConfig) missing.push("x-role column");
        if (!yFieldConfig) missing.push("y-role column");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        positiveAreaColor: (colorsConfig.other && colorsConfig.other.positive) ? colorsConfig.other.positive : "#4CAF50",
        negativeAreaColor: (colorsConfig.other && colorsConfig.other.negative) ? colorsConfig.other.negative : "#E53935",
        gridLineColor: colorsConfig.other && colorsConfig.other.gridLine ? colorsConfig.other.gridLine : "#e0e0e0",
        zeroLineColor: colorsConfig.other && colorsConfig.other.zeroLine ? colorsConfig.other.zeroLine : "#000000",
        axisTextColor: colorsConfig.text_color || "#666666",
        alternateXStripeColor: colorsConfig.other && colorsConfig.other.stripe ? colorsConfig.other.stripe : "#f0f0f0",
        chartBackground: colorsConfig.background_color || "#FFFFFF", // Default to white if not specified
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '12px', // Original used 12px implicitly
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'bold',
        }
    };

    function estimateTextWidth(text, fontSize = fillStyle.typography.labelFontSize, fontFamily = fillStyle.typography.labelFontFamily, fontWeight = fillStyle.typography.labelFontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // Note: Appending to body and then removing is more reliable for getBBox, but trying without first.
        // If issues, uncomment: document.body.appendChild(svg);
        const width = textEl.getBBox().width;
        // if (svg.parentNode === document.body) document.body.removeChild(svg);
        return width;
    }
    
    function getTextColorForBackground(bgColor) {
        const color = d3.color(bgColor);
        if (!color) return '#000000'; // Fallback if color parsing fails
        const rgb = color.rgb();
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness < 180 ? "#FFFFFF" : "#000000";
    }

    function parseDate(dateString) {
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? null : d;
    }
    
    // Simplified temporalFilter - assuming data is mostly fine
    function temporalFilter(data, dateField) {
        return data.filter(d => d[dateField] != null && parseDate(d[dateField]) !== null)
                   .sort((a, b) => parseDate(a[dateField]) - parseDate(b[dateField]));
    }

    function createNumericalFormatter(data, field) {
        // Basic formatter, can be expanded (e.g., for units from dataColumns)
        return d3.format(".2~f"); // Show significant digits, remove trailing zeros
    }

    function createXAxisScaleAndTicks(chartData, xField, minRange, maxRange) {
        const dates = chartData.map(d => parseDate(d[xField]));
        const xScale = d3.scaleTime()
            .domain(d3.extent(dates))
            .range([minRange, maxRange]);

        const timeSpanDays = (xScale.domain()[1] - xScale.domain()[0]) / (1000 * 60 * 60 * 24);
        let xTicks, xFormat;

        if (timeSpanDays <= 1) { // Intra-day
            xTicks = xScale.ticks(d3.timeHour.every(3));
            xFormat = d3.timeFormat("%H:%M");
        } else if (timeSpanDays <= 7) { // Week
            xTicks = xScale.ticks(d3.timeDay.every(1));
            xFormat = d3.timeFormat("%a %d");
        } else if (timeSpanDays <= 31) { // Month
            xTicks = xScale.ticks(d3.timeDay.every(5));
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 365) { // Year
            xTicks = xScale.ticks(d3.timeMonth.every(1));
            xFormat = d3.timeFormat("%b '%y");
        } else { // Multi-year
            xTicks = xScale.ticks(d3.timeYear.every(1));
            xFormat = d3.timeFormat("%Y");
        }
        return { xScale, xTicks, xFormat, timeSpan: timeSpanDays };
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("style", `background-color: ${fillStyle.chartBackground};`)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 40, bottom: 60, left: 60 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    let chartDataArray = temporalFilter(rawChartData, xFieldName);
    if (chartDataArray.length === 0) {
        console.warn("Filtered chartData is empty. Cannot render chart.");
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "text error-message")
            .style("fill", fillStyle.axisTextColor)
            .text("No data available for the selected period.");
        return svgRoot.node();
    }
    
    const numericalFormatter = createNumericalFormatter(chartDataArray, yFieldName);

    const processedData = [];
    for (let i = 0; i < chartDataArray.length; i++) {
        const current = chartDataArray[i];
        const currentValue = current[yFieldName];
        
        processedData.push({
            x: parseDate(current[xFieldName]),
            y: currentValue,
            original: current
        });
        
        if (i < chartDataArray.length - 1) {
            const next = chartDataArray[i + 1];
            const nextValue = next[yFieldName];
            if ((currentValue >= 0 && nextValue < 0) || (currentValue < 0 && nextValue >= 0)) {
                if (currentValue !== 0 && nextValue !== 0) { // Avoid double zero if one is already zero
                    const currentDate = parseDate(current[xFieldName]);
                    const nextDate = parseDate(next[xFieldName]);
                    const ratio = Math.abs(currentValue) / (Math.abs(currentValue) + Math.abs(nextValue));
                    const zeroDate = new Date(currentDate.getTime() + ratio * (nextDate.getTime() - currentDate.getTime()));
                    processedData.push({ x: zeroDate, y: 0, isZeroPoint: true });
                }
            }
        }
    }
    processedData.sort((a, b) => a.x - b.x); // Ensure sorted after adding zero points

    const positiveData = processedData.filter(d => d.y >= 0 || d.isZeroPoint);
    const negativeData = processedData.filter(d => d.y <= 0 || d.isZeroPoint);

    const maxPoint = chartDataArray.reduce((max, current) => 
        current[yFieldName] > max[yFieldName] ? current : max, chartDataArray[0]);
    
    const minPoint = chartDataArray.reduce((min, current) => 
        current[yFieldName] < min[yFieldName] ? current : min, chartDataArray[0]);

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartDataArray, xFieldName, 0, innerWidth);
    
    const yDomainMin = d3.min(chartDataArray, d => d[yFieldName]);
    const yDomainMax = d3.max(chartDataArray, d => d[yFieldName]);

    const yScale = d3.scaleLinear()
        .domain([
            Math.min(0, yDomainMin * 1.2),
            Math.max(0, yDomainMax * 1.2) 
        ])
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Horizontal Gridlines
    mainChartGroup.selectAll(".grid-line-horizontal")
        .data(yScale.ticks(8))
        .enter()
        .append("line")
        .attr("class", "grid grid-line-horizontal")
        .attr("x1", 0)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    // Vertical Stripe Backgrounds
    xTicks.forEach((tick, i) => {
        const x1 = xScale(tick);
        const x2 = i < xTicks.length - 1 ? xScale(xTicks[i + 1]) : innerWidth;
        if (i % 2 === 0 && x2 > x1) { // Ensure width is positive
            mainChartGroup.append("rect")
                .attr("class", "grid alternate-stripe")
                .attr("x", x1)
                .attr("y", 0)
                .attr("width", x2 - x1)
                .attr("height", innerHeight)
                .attr("fill", fillStyle.alternateXStripeColor)
                .attr("opacity", 0.5);
        }
    });
    mainChartGroup.selectAll(".alternate-stripe").lower(); // Send stripes to back

    // Zero Line
    if (yScale.domain()[0] < 0 && yScale.domain()[1] > 0) {
        mainChartGroup.append("line")
            .attr("class", "axis zero-line")
            .attr("x1", 0)
            .attr("y1", yScale(0))
            .attr("x2", innerWidth)
            .attr("y2", yScale(0))
            .attr("stroke", fillStyle.zeroLineColor)
            .attr("stroke-width", 1);
    }

    // X-Axis Labels
    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis");
    xTicks.forEach(tick => {
        xAxisLabelsGroup.append("text")
            .attr("class", "label x-axis-label")
            .attr("x", xScale(tick))
            .attr("y", innerHeight + 20)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.axisTextColor)
            .text(xFormat(tick));
    });

    // Y-Axis Labels
    const yAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");
    yScale.ticks(8).forEach(tick => {
        yAxisLabelsGroup.append("text")
            .attr("class", "label y-axis-label")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.axisTextColor)
            .text(numericalFormatter(tick));
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const positiveAreaGenerator = d3.area()
        .x(d => xScale(d.x))
        .y0(yScale(0))
        .y1(d => yScale(Math.max(0, d.y))) // Ensure positive area stays above zero line
        .curve(d3.curveLinear);

    const negativeAreaGenerator = d3.area()
        .x(d => xScale(d.x))
        .y0(yScale(0))
        .y1(d => yScale(Math.min(0, d.y))) // Ensure negative area stays below zero line
        .curve(d3.curveLinear);

    if (positiveData.length > 1) {
        mainChartGroup.append("path")
            .datum(positiveData)
            .attr("class", "mark area positive-area")
            .attr("fill", fillStyle.positiveAreaColor)
            .attr("d", positiveAreaGenerator);
    }

    if (negativeData.length > 1) {
        mainChartGroup.append("path")
            .datum(negativeData)
            .attr("class", "mark area negative-area")
            .attr("fill", fillStyle.negativeAreaColor)
            .attr("d", negativeAreaGenerator);
    }

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    const annotationGroup = mainChartGroup.append("g").attr("class", "annotations-group");

    function renderAnnotation(pointData, value, isMax) {
        const pointX = xScale(parseDate(pointData[xFieldName]));
        const pointY = yScale(value);
        const color = isMax ? fillStyle.positiveAreaColor : fillStyle.negativeAreaColor;
        const textColor = getTextColorForBackground(color);
        
        const textContent = (value > 0 ? "+" : "") + numericalFormatter(value);
        const textElementWidth = estimateTextWidth(textContent, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontWeight);
        
        const padding = { x: 8, y: 4 };
        const bubbleWidth = textElementWidth + 2 * padding.x;
        const bubbleHeight = parseFloat(fillStyle.typography.annotationFontSize) + 2 * padding.y;
        const pointerSize = 8;

        let bubbleX, bubbleY, pathCommands;

        if (isMax) { // Annotation above and to the right
            bubbleX = pointX + pointerSize / 2;
            bubbleY = pointY - bubbleHeight - pointerSize / 2;
            if (bubbleX + bubbleWidth > innerWidth) bubbleX = pointX - bubbleWidth - pointerSize / 2; // Flip if out of bounds

            pathCommands = `M${pointX},${pointY} L${bubbleX + pointerSize},${bubbleY + bubbleHeight} H${bubbleX + bubbleWidth - pointerSize} L${bubbleX + bubbleWidth},${bubbleY + bubbleHeight - pointerSize} V${bubbleY + pointerSize} L${bubbleX + bubbleWidth - pointerSize},${bubbleY} H${bubbleX + pointerSize} L${bubbleX},${bubbleY + pointerSize} V${bubbleY + bubbleHeight - pointerSize} Z`;
            // Simplified rectangular bubble with pointer
            pathCommands = `M${pointX},${pointY} 
                            L${pointX + pointerSize / 2},${pointY - pointerSize / 2} 
                            L${pointX - pointerSize / 2},${pointY - pointerSize / 2} Z
                            M${bubbleX},${bubbleY} h${bubbleWidth} v${bubbleHeight} h-${bubbleWidth} Z`;
            // A more common callout shape:
            const actualBubbleY = pointY - bubbleHeight - pointerSize;
            bubbleX = pointX - bubbleWidth / 2;
             if (bubbleX < 0) bubbleX = 0;
             if (bubbleX + bubbleWidth > innerWidth) bubbleX = innerWidth - bubbleWidth;

            pathCommands = `
                M${pointX},${pointY}
                L${pointX - pointerSize / 2},${pointY - pointerSize}
                H${bubbleX}
                V${actualBubbleY}
                H${bubbleX + bubbleWidth}
                V${actualBubbleY + bubbleHeight}
                H${pointX + pointerSize / 2}
                Z
            `;
        } else { // Annotation below and to the right (or left if needed)
            bubbleX = pointX + pointerSize / 2;
            bubbleY = pointY + pointerSize / 2;
             if (bubbleX + bubbleWidth > innerWidth) bubbleX = pointX - bubbleWidth - pointerSize / 2;

            const actualBubbleY = pointY + pointerSize;
            bubbleX = pointX - bubbleWidth / 2;
            if (bubbleX < 0) bubbleX = 0;
            if (bubbleX + bubbleWidth > innerWidth) bubbleX = innerWidth - bubbleWidth;

            pathCommands = `
                M${pointX},${pointY}
                L${pointX - pointerSize / 2},${pointY + pointerSize}
                H${bubbleX}
                V${actualBubbleY + bubbleHeight}
                H${bubbleX + bubbleWidth}
                V${actualBubbleY}
                H${pointX + pointerSize / 2}
                Z
            `;
        }
        
        annotationGroup.append("path")
            .attr("class", `mark annotation-bubble ${isMax ? 'max' : 'min'}`)
            .attr("d", pathCommands)
            .attr("fill", color);

        annotationGroup.append("text")
            .attr("class", `text annotation-text ${isMax ? 'max' : 'min'}`)
            .attr("x", bubbleX + bubbleWidth / 2)
            .attr("y", (isMax ? actualBubbleY : actualBubbleY) + bubbleHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", textColor)
            .text(textContent);
    }

    if (maxPoint && maxPoint[yFieldName] > 0) {
         renderAnnotation(maxPoint, maxPoint[yFieldName], true);
    }
    if (minPoint && minPoint[yFieldName] < 0) {
         renderAnnotation(minPoint, minPoint[yFieldName], false);
    }


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}