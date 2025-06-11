/* REQUIREMENTS_BEGIN
{
  "chart_type": "Spline Area Chart",
  "chart_name": "spline_area_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["temporal"], ["numerical"]],
  "required_fields_range": [[5, 30], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Assuming light theme or theme already resolved
    const imagesConfig = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xCol = dataColumns.find(col => col.role === "x");
    const yCol = dataColumns.find(col => col.role === "y");

    if (!xCol || !xCol.name || !yCol || !yCol.name) {
        const missing = [];
        if (!xCol || !xCol.name) missing.push("x-axis field");
        if (!yCol || !yCol.name) missing.push("y-axis field");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xCol.name;
    const yFieldName = yCol.name;

    // Filter out data points with null/undefined essential values early
    chartDataArray = chartDataArray.filter(d =>
        d[xFieldName] !== null && d[xFieldName] !== undefined &&
        d[yFieldName] !== null && d[yFieldName] !== undefined
    );
    
    if (chartDataArray.length < 2) { // Need at least 2 points for an area/line chart
        const errorMsg = "Insufficient data points to render the chart (minimum 2 required).";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    // Typography
    const defaultTypographyStyles = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = (typographyConfig.title && typographyConfig.title.font_family) || defaultTypographyStyles.title.font_family;
    fillStyle.typography.titleFontSize = (typographyConfig.title && typographyConfig.title.font_size) || defaultTypographyStyles.title.font_size;
    fillStyle.typography.titleFontWeight = (typographyConfig.title && typographyConfig.title.font_weight) || defaultTypographyStyles.title.font_weight;

    fillStyle.typography.labelFontFamily = (typographyConfig.label && typographyConfig.label.font_family) || defaultTypographyStyles.label.font_family;
    fillStyle.typography.labelFontSize = (typographyConfig.label && typographyConfig.label.font_size) || defaultTypographyStyles.label.font_size;
    fillStyle.typography.labelFontWeight = (typographyConfig.label && typographyConfig.label.font_weight) || defaultTypographyStyles.label.font_weight;
    
    // Specific for data labels, using 'label' tokens but allowing for a bolder default if not specified.
    // As per strict rules, data labels will use labelFontWeight. If "bold" is desired, it must be in typographyConfig.label.font_weight.
    // The original had bold data labels. This will now depend on config.

    fillStyle.typography.annotationFontFamily = (typographyConfig.annotation && typographyConfig.annotation.font_family) || defaultTypographyStyles.annotation.font_family;
    fillStyle.typography.annotationFontSize = (typographyConfig.annotation && typographyConfig.annotation.font_size) || defaultTypographyStyles.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (typographyConfig.annotation && typographyConfig.annotation.font_weight) || defaultTypographyStyles.annotation.font_weight;

    // Colors
    fillStyle.primaryColor = (colorsConfig.other && colorsConfig.other.primary) || (d3.schemeCategory10 && d3.schemeCategory10[0]) || '#007bff';
    fillStyle.textColor = colorsConfig.text_color || '#212529'; // Default dark text
    fillStyle.chartBackground = colorsConfig.background_color || '#FFFFFF';
    fillStyle.primaryAreaOpacity = 0.3; // For solid area fill

    // Helper: In-memory text measurement
    function estimateTextWidth(text, fontFamily, fontSize) {
        if (!text || typeof text !== 'string') return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        // Note: Appending to body is not allowed by spec for this utility.
        // getBBox() should work on unattached elements in modern browsers.
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            width = text.length * (parseInt(fontSize, 10) * 0.6 || 7); // Simple heuristic
        }
        return width;
    }
    
    // Helper: Date parsing
    const parseDate = (dateStr) => new Date(dateStr);

    // Helper: Sample label indices
    function sampleLabelIndices(dataLength, maxLabels = 5) {
        if (dataLength <= 0) return [];
        if (dataLength <= maxLabels) {
            return Array.from({ length: dataLength }, (_, i) => i);
        }
        const indices = [0, dataLength - 1]; // Always include first and last
        const numIntermediatePoints = Math.max(0, maxLabels - 2);
        if (numIntermediatePoints > 0) {
            const step = (dataLength - 1) / (numIntermediatePoints + 1);
            for (let k = 1; k <= numIntermediatePoints; k++) {
                indices.push(Math.round(step * k));
            }
        }
        return [...new Set(indices)].sort((a, b) => a - b);
    }

    // Helper: X-axis scale and ticks
    function createXAxisScaleAndTicks(data, xField, parseFn, rangeStart, rangeEnd, typographyStyle, estTextWidthFn) {
        const dates = data.map(d => parseFn(d[xField]));
        const xScale = d3.scaleTime().domain(d3.extent(dates)).range([rangeStart, rangeEnd]);
    
        const approxTickLabelWidth = estTextWidthFn("MM/DD/YYYY", typographyStyle.labelFontFamily, typographyStyle.labelFontSize) || 80;
        const numTicks = Math.max(2, Math.min(10, Math.floor((rangeEnd - rangeStart) / (approxTickLabelWidth + 20) )));
    
        const xTicks = xScale.ticks(numTicks);
    
        const timeSpan = xScale.domain()[1] - xScale.domain()[0];
        let xFormat;
        if (timeSpan < 2 * 24 * 60 * 60 * 1000) xFormat = d3.timeFormat("%H:%M");
        else if (timeSpan < 31 * 24 * 60 * 60 * 1000) xFormat = d3.timeFormat("%b %d");
        else if (timeSpan < 366 * 24 * 60 * 60 * 1000) xFormat = d3.timeFormat("%b"); // Short month for denser ticks
        else xFormat = d3.timeFormat("%Y");
        
        return { xScale, xTicks, xFormat };
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(chartConfig.width) || 800;
    const containerHeight = parseFloat(chartConfig.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Apply background color to SVG

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 60, left: 60 }; // Reduced top/bottom margin
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    chartDataArray.sort((a, b) => parseDate(a[xFieldName]) - parseDate(b[xFieldName]));

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(
        chartDataArray, xFieldName, parseDate, 0, innerWidth, 
        fillStyle.typography, estimateTextWidth
    );

    const yMax = d3.max(chartDataArray, d => +d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([0, (yMax || 0) * 1.4]) // Ensure yMax is a number, provide 0 default
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .attr("class", "axis x-axis");

    xTicks.forEach(tick => {
        xAxisGroup.append("text")
            .attr("class", "label x-axis-label")
            .attr("x", xScale(tick))
            .attr("y", chartMargins.bottom / 2) // Position within bottom margin
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xFormat(tick));
    });
    
    // No Y-axis is rendered as per original chart's characteristics.

    // Block 8: Main Data Visualization Rendering
    const areaGenerator = d3.area()
        .x(d => xScale(parseDate(d[xFieldName])))
        .y0(innerHeight)
        .y1(d => yScale(+d[yFieldName]))
        .curve(d3.curveBasis);

    mainChartGroup.append("path")
        .datum(chartDataArray)
        .attr("class", "mark area-mark")
        .attr("fill", fillStyle.primaryColor)
        .attr("fill-opacity", fillStyle.primaryAreaOpacity)
        .attr("d", areaGenerator);

    const lineGenerator = d3.line()
        .x(d => xScale(parseDate(d[xFieldName])))
        .y(d => yScale(+d[yFieldName]))
        .curve(d3.curveBasis);

    mainChartGroup.append("path")
        .datum(chartDataArray)
        .attr("class", "mark line-mark")
        .attr("fill", "none")
        .attr("stroke", fillStyle.primaryColor)
        .attr("stroke-width", 3)
        .attr("d", lineGenerator);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    const labelIndices = sampleLabelIndices(chartDataArray.length, 5); // Max 5 labels

    labelIndices.forEach(i => {
        const d = chartDataArray[i];
        const x = xScale(parseDate(d[xFieldName]));
        const y = yScale(+d[yFieldName]);

        let labelY = y - 10; // Default position above the point

        // Simplified label positioning: ensure it's within chart bounds
        const labelValue = Math.round(+d[yFieldName]);
        // Heuristic for label width, as in original
        const labelTextWidth = String(labelValue).length * (parseInt(fillStyle.typography.labelFontSize) * 0.6) + 20;
        const labelHeight = parseInt(fillStyle.typography.labelFontSize, 10) + 10; // Approx height based on font size
        
        const rectY = labelY - labelHeight - 15; // Top of rect
        const textY = labelY - 15 - labelHeight / 2; // Middle of text
        const triangleBaseY = labelY - 15; // Base of triangle pointing down

        // Adjust if too high
        if (rectY < -chartMargins.top) { // Check against top of mainChartGroup
            const diff = -chartMargins.top - rectY;
            labelY += diff;
        }
        
        // Recalculate positions based on potentially adjusted labelY
        const finalRectY = labelY - labelHeight - 15;
        const finalTextY = labelY - 15 - labelHeight / 2;
        const finalTriangleBaseY = labelY - 15;

        const labelGroup = mainChartGroup.append("g").attr("class", "data-label-group");

        labelGroup.append("rect")
            .attr("class", "mark data-label-background")
            .attr("x", x - labelTextWidth / 2)
            .attr("y", finalRectY)
            .attr("width", labelTextWidth)
            .attr("height", labelHeight)
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("fill", fillStyle.primaryColor)
            .attr("opacity", 0.9);

        labelGroup.append("text")
            .attr("class", "label data-value-label")
            .attr("x", x)
            .attr("y", finalTextY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#FFFFFF") // Assuming primaryColor is dark enough for white text
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight) // Uses configured label weight
            .text(labelValue);

        const triangleSize = 8;
        labelGroup.append("path")
            .attr("class", "mark data-label-pointer")
            .attr("d", `M${x - triangleSize / 2},${finalTriangleBaseY} L${x + triangleSize / 2},${finalTriangleBaseY} L${x},${finalTriangleBaseY + triangleSize} Z`)
            .attr("fill", fillStyle.primaryColor);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}