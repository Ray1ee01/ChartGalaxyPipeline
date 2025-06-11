/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Area Chart",
  "chart_name": "area_plain_chart_02",
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
  "background": "light",

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
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is external)

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {}; // Not used in this chart, but extract for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');

    if (!xFieldConfig || !xFieldConfig.name || !yFieldConfig || !yFieldConfig.name) {
        const missing = [];
        if (!xFieldConfig || !xFieldConfig.name) missing.push("x field configuration (role: 'x')");
        if (!yFieldConfig || !yFieldConfig.name) missing.push("y field configuration (role: 'y')");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        positiveAreaColor: (colorsConfig.other && colorsConfig.other.positive) || '#4CAF50',
        negativeAreaColor: (colorsConfig.other && colorsConfig.other.negative) || '#E53935',
        gridLineColor: (colorsConfig.other && colorsConfig.other.gridLine) || '#e0e0e0',
        zeroLineColor: (colorsConfig.other && colorsConfig.other.zeroLine) || '#000000',
        stripedBackgroundFill: (colorsConfig.other && colorsConfig.other.stripedBackground) || '#f0f0f0',
        stripedBackgroundOpacity: typeof variables.stripedBackgroundOpacity === 'number' ? variables.stripedBackgroundOpacity : 0.5,
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        textColor: colorsConfig.text_color || '#333333',
        axisTextColor: (colorsConfig.other && colorsConfig.other.axis_text_color) || colorsConfig.text_color || '#666666',
    };

    fillStyle.typography = {
        axisLabelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
        axisLabelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '10px',
        axisLabelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
        annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
        annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
        annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'bold',
    };
    
    const parseDate = d3.isoParse;

    function estimateTextWidth(text, fontSize, fontFamily, fontWeight = 'normal') {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // No need to style tempSvg itself if not appending to DOM
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement); 
        // getBBox should work on unattached SVG elements for text.
        return textElement.getBBox().width;
    }

    function getContrastingTextColor(backgroundColor) {
        const color = d3.color(backgroundColor);
        if (!color) return fillStyle.textColor;
        const rgb = color.rgb();
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness < 180 ? '#FFFFFF' : '#000000';
    }

    function createNumericalFormatter(data, field) {
        const values = data.map(d => parseFloat(d[field])).filter(v => !isNaN(v));
        if (values.length === 0) return d => `${d}`;
        const extent = d3.extent(values);
        
        let formatSpecifier = ",.2f";
        if (Math.abs(extent[1]) >= 10000 || Math.abs(extent[0]) >= 10000) formatSpecifier = d3.formatSpecifier("s").precision(2).type === "s" ? "~s" : ",.0f"; // SI or large number
        else if (Math.abs(extent[1]) < 1 && Math.abs(extent[0]) < 1 && (Math.abs(extent[1]) > 0.0001 || Math.abs(extent[0]) > 0.0001)) formatSpecifier = ",.3f";
        else if (Math.abs(extent[1]) < 10 && Math.abs(extent[0]) < 10) formatSpecifier = ",.2f";
        else if (Math.abs(extent[1]) < 100 && Math.abs(extent[0]) < 100) formatSpecifier = ",.1f";
        else formatSpecifier = ",.0f";
        
        return d3.format(formatSpecifier);
    }
    const numericalFormatter = createNumericalFormatter(rawChartData, yFieldName);

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
        .attr("class", "chart-root area-chart");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 40, bottom: 60, left: 60 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    let chartData = rawChartData.map(d => {
        const date = parseDate(d[xFieldName]);
        const value = parseFloat(d[yFieldName]);
        if (date && !isNaN(value)) {
            return { x: date, y: value, original: d };
        }
        return null;
    }).filter(d => d !== null);

    chartData.sort((a, b) => a.x - b.x);

    if (chartData.length < 2) { // Need at least 2 points for an area chart
        const msg = chartData.length === 0 ? "No data available." : "Not enough data points to draw an area chart.";
        console.warn(msg + " Cannot render chart.");
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.axisLabelFontFamily)
            .attr("font-size", "14px")
            .attr("fill", fillStyle.textColor)
            .text(msg);
        return svgRoot.node();
    }
    
    const processedData = [];
    for (let i = 0; i < chartData.length; i++) {
        const current = chartData[i];
        processedData.push({ x: current.x, y: current.y, original: current.original });

        if (i < chartData.length - 1) {
            const next = chartData[i + 1];
            if ((current.y > 0 && next.y < 0) || (current.y < 0 && next.y > 0)) { // Strictly different signs
                const ratio = Math.abs(current.y) / (Math.abs(current.y) + Math.abs(next.y));
                const zeroDate = new Date(current.x.getTime() + ratio * (next.x.getTime() - current.x.getTime()));
                processedData.push({ x: zeroDate, y: 0, isZeroPoint: true });
            }
        }
    }
    processedData.sort((a, b) => a.x - b.x);

    const positiveData = processedData.filter(d => d.y >= 0);
    const negativeData = processedData.filter(d => d.y <= 0);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(processedData, d => d.x))
        .range([0, innerWidth]);

    const yMin = d3.min(processedData, d => d.y);
    const yMax = d3.max(processedData, d => d.y);
    const yDomainMin = yMin !== undefined ? Math.min(0, yMin * (yMin < 0 ? 1.2 : 1)) : 0;
    const yDomainMax = yMax !== undefined ? Math.max(0, yMax * (yMax > 0 ? 1.2 : 1)) : 0;
    
    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax === yDomainMin ? yDomainMin + 1 : yDomainMax]) // Avoid domain[0] === domain[1]
        .range([innerHeight, 0])
        .nice();

    const numXTicks = Math.max(2, Math.floor(innerWidth / 100));
    const xTicks = xScale.ticks(numXTicks);
    
    let xTickFormat;
    const timeDomain = xScale.domain();
    const timeSpanDays = (timeDomain[1] - timeDomain[0]) / (1000 * 60 * 60 * 24);

    if (timeSpanDays <= 2) xTickFormat = d3.timeFormat("%H:%M");
    else if (timeSpanDays <= 120) xTickFormat = d3.timeFormat("%b %d");
    else if (timeSpanDays <= 365 * 3) xTickFormat = d3.timeFormat("%b '%y");
    else xTickFormat = d3.timeFormat("%Y");

    const numYTicks = Math.max(2, Math.floor(innerHeight / 50));
    const yTicks = yScale.ticks(numYTicks);

    // Block 7: Chart Component Rendering
    xTicks.forEach((tick, i) => {
        if (i % 2 === 0) {
            const x1 = xScale(tick);
            const x2 = (i < xTicks.length - 1) ? xScale(xTicks[i + 1]) : innerWidth;
            if (x2 > x1) {
                 mainChartGroup.append("rect")
                    .attr("x", x1)
                    .attr("y", 0)
                    .attr("width", x2 - x1)
                    .attr("height", innerHeight)
                    .attr("fill", fillStyle.stripedBackgroundFill)
                    .attr("opacity", fillStyle.stripedBackgroundOpacity)
                    .attr("class", "grid-background striped-background");
            }
        }
    });
    mainChartGroup.selectAll(".striped-background").lower();

    mainChartGroup.selectAll(".horizontal-grid-line")
        .data(yTicks.filter(d => Math.abs(yScale(d) - yScale(0)) > 0.1)) // Don't draw at zero line
        .enter().append("line")
        .attr("class", "grid-line horizontal-grid-line")
        .attr("x1", 0).attr("y1", d => yScale(d))
        .attr("x2", innerWidth).attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor).attr("stroke-width", 1);

    if (yScale.domain()[0] < 0 && yScale.domain()[1] > 0) {
        mainChartGroup.append("line")
            .attr("class", "axis-guide zero-line")
            .attr("x1", 0).attr("y1", yScale(0))
            .attr("x2", innerWidth).attr("y2", yScale(0))
            .attr("stroke", fillStyle.zeroLineColor).attr("stroke-width", 1.5);
    }

    const xAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis x-axis");
    xTicks.forEach(tick => {
        xAxisLabelsGroup.append("text")
            .attr("class", "text axis-label x-axis-label")
            .attr("x", xScale(tick)).attr("y", innerHeight + 20)
            .attr("text-anchor", "middle").attr("fill", fillStyle.axisTextColor)
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .text(xTickFormat(tick));
    });

    const yAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis y-axis");
    yTicks.forEach(tick => {
        yAxisLabelsGroup.append("text")
            .attr("class", "text axis-label y-axis-label")
            .attr("x", -10).attr("y", yScale(tick))
            .attr("text-anchor", "end").attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.axisTextColor)
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .text(numericalFormatter(tick));
    });

    // Block 8: Main Data Visualization Rendering
    const areaGenerator = d3.area()
        .x(d => xScale(d.x))
        .y0(yScale(0))
        .y1(d => yScale(d.y))
        .curve(d3.curveLinear);

    if (positiveData.length > 1) {
        mainChartGroup.append("path")
            .datum(positiveData)
            .attr("class", "mark area positive-area")
            .attr("fill", fillStyle.positiveAreaColor)
            .attr("d", areaGenerator);
    }

    if (negativeData.length > 1) {
        mainChartGroup.append("path")
            .datum(negativeData)
            .attr("class", "mark area negative-area")
            .attr("fill", fillStyle.negativeAreaColor)
            .attr("d", areaGenerator);
    }
    
    // Block 9: Optional Enhancements & Post-Processing (Annotations)
    if (chartData.length > 0) {
        const maxPoint = chartData.reduce((max, current) => (current.y > max.y ? current : max), chartData[0]);
        const minPoint = chartData.reduce((min, current) => (current.y < min.y ? current : min), chartData[0]);
        
        const annotationPadding = 5; // Padding inside bubble
        const pointerSize = 3; // Triangle pointer base/height
        const bubblePointerOffset = 10; // Distance from point to bubble edge

        // Max point annotation
        if (maxPoint && maxPoint.y > 0) { // Only show if positive
            const maxX = xScale(maxPoint.x);
            const maxY = yScale(maxPoint.y);
            const displayText = `+${numericalFormatter(maxPoint.y)}`;
            const textWidth = estimateTextWidth(displayText, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontWeight);
            const labelWidth = textWidth + 2 * annotationPadding;
            const labelHeight = parseFloat(fillStyle.typography.annotationFontSize) + 2 * annotationPadding;

            let bubbleX = maxX + bubblePointerOffset;
            let bubbleY = maxY - labelHeight; // Bubble top edge
            let pointerPoints = `${maxX + pointerSize},${maxY} ${bubbleX},${maxY - pointerSize} ${bubbleX},${maxY}`; // Points right, bubble above
            
            if (bubbleX + labelWidth > innerWidth) { // Flip to left
                bubbleX = maxX - bubblePointerOffset - labelWidth;
                pointerPoints = `${maxX - pointerSize},${maxY} ${bubbleX + labelWidth},${maxY - pointerSize} ${bubbleX + labelWidth},${maxY}`; // Points left, bubble above
            }
            if (bubbleY < 0) { // Flip below
                bubbleY = maxY + bubblePointerOffset; // Bubble top edge
                // pointerPoints needs adjustment for below
                 if (bubbleX > maxX) { // Bubble right of point
                    pointerPoints = `${maxX + pointerSize},${maxY} ${bubbleX},${maxY + pointerSize} ${bubbleX},${maxY}`;
                 } else { // Bubble left of point
                    pointerPoints = `${maxX - pointerSize},${maxY} ${bubbleX + labelWidth},${maxY + pointerSize} ${bubbleX + labelWidth},${maxY}`;
                 }
            }

            const pathDefMax = `M${pointerPoints.split(" ")[0]} L${pointerPoints.split(" ")[1]} L${bubbleX},${bubbleY} L${bubbleX + labelWidth},${bubbleY} L${bubbleX + labelWidth},${bubbleY + labelHeight} L${pointerPoints.split(" ")[2]} Z`;
            
            mainChartGroup.append("path")
                .attr("class", "mark annotation-bubble max-point-bubble")
                .attr("d", pathDefMax)
                .attr("fill", fillStyle.positiveAreaColor);

            mainChartGroup.append("text")
                .attr("class", "text annotation-text max-point-text")
                .attr("x", bubbleX + labelWidth / 2)
                .attr("y", bubbleY + labelHeight / 2)
                .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                .attr("fill", getContrastingTextColor(fillStyle.positiveAreaColor))
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(displayText);
        }

        // Min point annotation
        if (minPoint && minPoint.y < 0) { // Only show if negative
            const minX = xScale(minPoint.x);
            const minY = yScale(minPoint.y);
            const displayText = numericalFormatter(minPoint.y);
            const textWidth = estimateTextWidth(displayText, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontWeight);
            const labelWidth = textWidth + 2 * annotationPadding;
            const labelHeight = parseFloat(fillStyle.typography.annotationFontSize) + 2 * annotationPadding;

            let bubbleX = minX - bubblePointerOffset - labelWidth; // Default to left
            let bubbleY = minY; // Bubble bottom edge
            let pointerPoints = `${minX - pointerSize},${minY} ${bubbleX + labelWidth},${minY + pointerSize} ${bubbleX + labelWidth},${minY}`; // Points left, bubble below (extends up)

            if (bubbleX < 0) { // Flip to right
                bubbleX = minX + bubblePointerOffset;
                pointerPoints = `${minX + pointerSize},${minY} ${bubbleX},${minY + pointerSize} ${bubbleX},${minY}`; // Points right, bubble below
            }
             if (bubbleY - labelHeight < 0) { // Flip bubble to be below point (original was above)
                bubbleY = minY + bubblePointerOffset + labelHeight; // Bubble bottom edge
                 if (bubbleX < minX) { // Bubble left of point
                    pointerPoints = `${minX - pointerSize},${minY} ${bubbleX + labelWidth},${minY - pointerSize} ${bubbleX + labelWidth},${minY}`;
                 } else { // Bubble right of point
                    pointerPoints = `${minX + pointerSize},${minY} ${bubbleX},${minY - pointerSize} ${bubbleX},${minY}`;
                 }
            }
            
            const pathDefMin = `M${pointerPoints.split(" ")[0]} L${pointerPoints.split(" ")[1]} L${bubbleX},${bubbleY} L${bubbleX},${bubbleY - labelHeight} L${bubbleX + labelWidth},${bubbleY - labelHeight} L${pointerPoints.split(" ")[2]} Z`;

            mainChartGroup.append("path")
                .attr("class", "mark annotation-bubble min-point-bubble")
                .attr("d", pathDefMin)
                .attr("fill", fillStyle.negativeAreaColor);

            mainChartGroup.append("text")
                .attr("class", "text annotation-text min-point-text")
                .attr("x", bubbleX + labelWidth / 2)
                .attr("y", bubbleY - labelHeight / 2)
                .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                .attr("fill", getContrastingTextColor(fillStyle.negativeAreaColor))
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(displayText);
        }
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}