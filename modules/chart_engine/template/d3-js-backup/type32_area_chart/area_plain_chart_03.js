/* REQUIREMENTS_BEGIN
{
  "chart_type": "Area Chart",
  "chart_name": "area_plain_chart_03",
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
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
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
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    const imagesConfig = data.images || {}; // Though not used in this chart type
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldColumn = dataColumns.find(col => col.role === "x");
    const yFieldColumn = dataColumns.find(col => col.role === "y");

    const xFieldName = xFieldColumn ? xFieldColumn.name : undefined;
    const yFieldName = yFieldColumn ? yFieldColumn.name : undefined;

    if (!xFieldName || !yFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push("x-role field");
        if (!yFieldName) missingFields.push("y-role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) || '16px',
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) || 'bold',
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
        },
        primaryColor: (colorsConfig.other && colorsConfig.other.primary) || '#c62828', // Original default
        textColor: colorsConfig.text_color || '#333333',
        axisColor: colorsConfig.text_color || '#666666', // Specific for axis text
        gridLineColor: '#e0e0e0', // Default grid line color
        dataLabelBackgroundColor: (colorsConfig.other && colorsConfig.other.primary) || '#c62828',
        dataLabelTextColor: '#FFFFFF',
        chartBackground: colorsConfig.background_color || '#FFFFFF', // Not directly used on SVG, but for consistency
    };

    const parseDate = (dateString) => {
        if (dateString instanceof Date) return dateString;
        const parsers = [
            d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ"),
            d3.timeParse("%Y-%m-%dT%H:%M:%S%Z"),
            d3.timeParse("%Y-%m-%d %H:%M:%S"),
            d3.timeParse("%Y-%m-%d"),
            d3.timeParse("%m/%d/%Y"),
            d3.timeParse("%d-%b-%y")
        ];
        for (let parser of parsers) {
            const parsed = parser(dateString);
            if (parsed) return parsed;
        }
        console.warn("Could not parse date:", dateString);
        return null;
    };
    
    const estimateTextWidth = (text, fontProps = {}) => {
        const {
            fontSize = fillStyle.typography.labelFontSize,
            fontFamily = fillStyle.typography.labelFontFamily,
            fontWeight = fillStyle.typography.labelFontWeight
        } = fontProps;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but the requirement is not to append to DOM.
        // For simple cases, direct getBBox might work, but can be less accurate.
        // A common workaround is to append to an off-screen live SVG, but that's more complex.
        // For this refactor, we'll assume this in-memory approach is sufficient.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on non-rendered elements is problematic
            return text.length * (parseInt(fontSize) * 0.6); // Rough estimate
        }
    };

    const temporalFilter = (data, dateField) => {
        return data.filter(d => parseDate(d[dateField]) !== null)
                   .sort((a, b) => parseDate(a[dateField]) - parseDate(b[dateField]));
    };

    const createNumericalFormatter = (/* chartData, yField */) => { // Simplified, as original logic wasn't provided
        return d3.format(".1f"); // Example: one decimal place
    };

    const createXAxisScaleAndTicks = (data, field, rangeMin, rangeMax) => {
        const dates = data.map(d => parseDate(d[field]));
        const extent = d3.extent(dates);
        
        const xScale = d3.scaleTime().domain(extent).range([rangeMin, rangeMax]);
        
        const timeSpanDays = (extent[1] - extent[0]) / (1000 * 60 * 60 * 24);
        let xTicks, xFormat;

        if (timeSpanDays <= 31) { // Approx 1 month
            xTicks = xScale.ticks(d3.timeDay.every(Math.ceil(timeSpanDays / 7) || 1)); // Weekly or daily
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 365 * 2) { // Approx 2 years
            xTicks = xScale.ticks(d3.timeMonth.every(Math.ceil(timeSpanDays / 30 / 6) || 1)); // Aim for ~6 ticks
            xFormat = d3.timeFormat("%b '%y");
        } else {
            xTicks = xScale.ticks(d3.timeYear.every(Math.ceil(timeSpanDays / 365 / 6) || 1));
            xFormat = d3.timeFormat("%Y");
        }
        return { xScale, xTicks, xFormat, timeSpan: timeSpanDays };
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 30, bottom: 50, left: 60 }; // Adjusted bottom/left for labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    // const xAxisTextHeight = 30; // Original, now handled by margin.bottom

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    let chartData = temporalFilter(rawChartData, xFieldName);

    if (chartData.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .text("No data available for the selected period.");
        return svgRoot.node();
    }
    
    const numericalFormatter = createNumericalFormatter(chartData, yFieldName);

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartData, xFieldName, 0, innerWidth);
    
    const yMinRaw = d3.min(chartData, d => +d[yFieldName]);
    const yMaxRaw = d3.max(chartData, d => +d[yFieldName]);
    
    const yPadding = (yMaxRaw - yMinRaw) * 0.1 || yMaxRaw * 0.1 || 1; // Handle single point or all zero
    const yDomainMax = yMaxRaw + yPadding;
    const yDomainMin = Math.max(0, yMinRaw - yPadding);
    
    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0])
        .nice(); // Ensure nice ticks

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    // X-Axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .attr("class", "axis x-axis");

    xTicks.forEach(tick => {
        xAxisGroup.append("text")
            .attr("x", xScale(tick))
            .attr("y", chartMargins.bottom / 2) // Position within margin
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.axisColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xFormat(tick))
            .attr("class", "label");
    });
     xAxisGroup.append("line") // X-axis line
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", fillStyle.axisColor)
        .attr("stroke-width", 1)
        .attr("class", "axis-line");


    // Y-Axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");
    const yAxisTicks = yScale.ticks(5);

    yAxisTicks.forEach(tick => {
        yAxisGroup.append("text")
            .attr("x", -chartMargins.left / 2 + 10) // Position within margin
            .attr("y", yScale(tick))
            .attr("text-anchor", "middle") // Centered in margin space
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.axisColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(numericalFormatter(tick))
            .attr("class", "label");

        // Horizontal Gridlines
        mainChartGroup.append("line")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", innerWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,2")
            .attr("class", "gridline");
    });
     yAxisGroup.append("line") // Y-axis line
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisColor)
        .attr("stroke-width", 1)
        .attr("class", "axis-line");


    // Block 8: Main Data Visualization Rendering
    const areaGenerator = d3.area()
        .x(d => xScale(parseDate(d[xFieldName])))
        .y0(innerHeight)
        .y1(d => yScale(+d[yFieldName]))
        .curve(d3.curveLinear);
    
    const lineGenerator = d3.line()
        .x(d => xScale(parseDate(d[xFieldName])))
        .y(d => yScale(+d[yFieldName]))
        .curve(d3.curveLinear);

    mainChartGroup.append("path")
        .datum(chartData)
        .attr("fill", fillStyle.primaryColor)
        .attr("fill-opacity", 0.6) // Kept from original, as it's common for area charts
        .attr("d", areaGenerator)
        .attr("class", "mark area");
    
    mainChartGroup.append("path")
        .datum(chartData)
        .attr("fill", "none")
        .attr("stroke", fillStyle.primaryColor)
        .attr("stroke-width", 3)
        .attr("d", lineGenerator)
        .attr("class", "mark line");

    // Block 9: Optional Enhancements & Post-Processing (Data Labels)
    const firstPoint = chartData[0];
    const lastPoint = chartData[chartData.length - 1];
    const lowestPoint = chartData.reduce((min, current) => 
        +current[yFieldName] < +min[yFieldName] ? current : min, chartData[0]);

    const addDataLabel = (point, isHighIndicator) => {
        const xPos = xScale(parseDate(point[xFieldName]));
        const yPos = yScale(+point[yFieldName]);
        const displayText = numericalFormatter(+point[yFieldName]);
        
        const textEstimatedWidth = estimateTextWidth(displayText, {
            fontSize: fillStyle.typography.annotationFontSize, // Smaller for data labels
            fontWeight: 'bold'
        });
        
        const labelPadding = { x: 8, y: 4 };
        const labelWidth = textEstimatedWidth + 2 * labelPadding.x;
        const labelHeight = parseInt(fillStyle.typography.annotationFontSize) + 2 * labelPadding.y;
        const pointerSize = 5;
        const offsetFromPoint = 10;

        let labelX = xPos - labelWidth / 2;
        let labelY, pointerPath;

        if (isHighIndicator) { // Label above point
            labelY = yPos - labelHeight - offsetFromPoint;
            pointerPath = `M${xPos},${yPos - pointerSize} L${xPos - pointerSize},${labelY + labelHeight} L${xPos + pointerSize},${labelY + labelHeight} Z`;
        } else { // Label below point
            labelY = yPos + offsetFromPoint;
            pointerPath = `M${xPos},${yPos + pointerSize} L${xPos - pointerSize},${labelY} L${xPos + pointerSize},${labelY} Z`;
        }

        // Ensure labels stay within chart bounds (simple adjustment)
        if (labelX < 0) labelX = 0;
        if (labelX + labelWidth > innerWidth) labelX = innerWidth - labelWidth;
        if (isHighIndicator && labelY < 0) { // If label above goes off screen top
            labelY = yPos + offsetFromPoint; // Flip to below
             pointerPath = `M${xPos},${yPos + pointerSize} L${xPos - pointerSize},${labelY} L${xPos + pointerSize},${labelY} Z`;
        }
        if (!isHighIndicator && labelY + labelHeight > innerHeight) { // If label below goes off screen bottom
            labelY = yPos - labelHeight - offsetFromPoint; // Flip to above
            pointerPath = `M${xPos},${yPos - pointerSize} L${xPos - pointerSize},${labelY + labelHeight} L${xPos + pointerSize},${labelY + labelHeight} Z`;
        }


        const labelGroup = mainChartGroup.append("g").attr("class", "data-label-group");

        labelGroup.append("rect")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("width", labelWidth)
            .attr("height", labelHeight)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", fillStyle.dataLabelBackgroundColor)
            .attr("class", "label data-label-box");
        
        labelGroup.append("path")
            .attr("d", pointerPath)
            .attr("fill", fillStyle.dataLabelBackgroundColor)
            .attr("class", "mark data-label-pointer");
        
        labelGroup.append("text")
            .attr("x", labelX + labelWidth / 2)
            .attr("y", labelY + labelHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.dataLabelTextColor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", "bold") // Make label text bold
            .text(displayText)
            .attr("class", "label data-label-text");
    };
    
    if (chartData.length > 0) {
        if (lowestPoint !== firstPoint && lowestPoint !== lastPoint) {
            addDataLabel(lowestPoint, false); // 'false' indicates it's a low point, label below
        }
        addDataLabel(firstPoint, true);    // 'true' indicates it's a high/start/end point, label above
        addDataLabel(lastPoint, true);
    }
    

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}