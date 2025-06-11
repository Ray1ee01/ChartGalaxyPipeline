/* REQUIREMENTS_BEGIN
{
  "chart_type": "Area Chart",
  "chart_name": "area_chart_04",
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
  "background": "dark",

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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || data.colors || {}; // Prefer dark theme if available
    const imagesConfig = data.images || {}; // Not used in this chart, but parsed as per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');

    let missingConfigs = [];
    if (!xFieldConfig) missingConfigs.push("x-axis field (role: 'x')");
    if (!yFieldConfig) missingConfigs.push("y-axis field (role: 'y')");

    if (missingConfigs.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingConfigs.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : "#a67eb7",
        areaOpacity: 0.3, // Replaces gradient with solid color + opacity
        lineStrokeWidth: 3,
        textColor: colorsConfig.text_color || "#E0E0E0", // Default for dark background
        labelBackgroundColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : "#a67eb7", // Match primary
        labelTextColor: colorsConfig.background_color || "#FFFFFF", // Contrast with label background
        axisTextColor: colorsConfig.text_color || "#AAAAAA", // Specific for axis, can be same as textColor
        chartBackground: colorsConfig.background_color || "#121212", // Default dark background
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '14px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            labelFontWeightBold: (typographyConfig.label && typographyConfig.label.font_weight_bold) ? typographyConfig.label.font_weight_bold : 'bold', // Custom for data labels if needed
            
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '12px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        }
    };
    
    // Helper: Parse date strings
    function parseDate(dateString) {
        if (!dateString) return null;
        if (dateString instanceof Date) return dateString;
        let date = d3.isoParse(dateString); // Try ISO 8601 first
        if (date) return date;
        date = new Date(dateString); // Fallback to Date constructor
        return !isNaN(date.getTime()) ? date : null;
    }

    // Helper: Estimate text width (in-memory)
    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.textContent = text;
        textNode.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        textNode.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        textNode.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        tempSvg.appendChild(textNode);
        // document.body.appendChild(tempSvg); // Temporarily append to DOM for getBBox if issues arise
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-DOM elements
            const avgCharWidth = (parseInt(fontProps.fontSize || '12px', 10) || 12) * 0.6;
            width = text.length * avgCharWidth;
            console.warn("estimateTextWidth: getBBox failed, using fallback estimation.", e);
        }
        // document.body.removeChild(tempSvg); // Clean up if appended
        return width;
    }

    // Helper: Temporal filter (stub/placeholder - original logic assumed external or simple)
    function temporalFilter(data, dateField) {
        if (!data) return [];
        return data.filter(d => {
            const date = parseDate(d[dateField]);
            return date && !isNaN(date.getTime());
        });
    }
    
    // Helper: Numerical formatter (stub/placeholder)
    function createNumericalFormatter(data, valueField) {
        // Example: const yMax = d3.max(data, d => d[valueField]);
        return function(value) {
            if (typeof value !== 'number' || isNaN(value)) return "N/A";
            if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + "M";
            if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(1) + "K";
            return value.toFixed(0);
        };
    }

    // Helper: Create X-axis scale and ticks (adapted from original's presumed functionality)
    function createXAxisScaleAndTicksHelper(currentChartData, dateField, availableWidth) {
        const dates = currentChartData.map(d => parseDate(d[dateField])).filter(d => d);
        if (dates.length === 0) {
            return { 
                xScale: d3.scaleTime().domain([new Date(), new Date()]).range([0, availableWidth]), 
                xTicks: [], 
                xFormat: d3.timeFormat("%Y-%m-%d") 
            };
        }
        const xDomain = d3.extent(dates);
        const xScale = d3.scaleTime().domain(xDomain).range([0, availableWidth]).nice();
    
        const timeSpanDays = (xDomain[1] - xDomain[0]) / (1000 * 60 * 60 * 24);
        let xTicks, xFormat;
    
        if (timeSpanDays <= 2) { 
            xTicks = xScale.ticks(d3.timeHour.every(6));
            xFormat = d3.timeFormat("%H:%M");
        } else if (timeSpanDays <= 14) { 
            xTicks = xScale.ticks(d3.timeDay.every(1));
            xFormat = d3.timeFormat(timeSpanDays > 7 ? "%b %d" : "%a %d");
        } else if (timeSpanDays <= 90) { 
            xTicks = xScale.ticks(d3.timeWeek.every(1));
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 730) { 
            xTicks = xScale.ticks(d3.timeMonth.every(1));
            xFormat = d3.timeFormat("%b '%y");
        } else { 
            xTicks = xScale.ticks(d3.timeYear.every(1));
            xFormat = d3.timeFormat("%Y");
        }
        return { xScale, xTicks, xFormat };
    }

    let chartDataArray = temporalFilter(rawChartData, xFieldName);
    if (chartDataArray.length === 0) {
        d3.select(containerSelector).html("<div style='color:grey; font-family: sans-serif;'>No data available after filtering.</div>");
        return null;
    }
    const numericalFormatter = createNumericalFormatter(chartDataArray, yFieldName);

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
    const chartMargins = { top: 60, right: 30, bottom: 80, left: 60 }; // Adjusted margins for labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    chartDataArray.sort((a, b) => parseDate(a[xFieldName]) - parseDate(b[xFieldName]));
    
    // Ensure all yField values are numbers, coerce or default if necessary
    chartDataArray.forEach(d => {
        d[yFieldName] = +d[yFieldName]; // Coerce to number
        if (isNaN(d[yFieldName])) d[yFieldName] = 0; // Default for non-numeric
    });


    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicksHelper(chartDataArray, xFieldName, innerWidth);
    
    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([0, (yMax || 0) * 1.4]) // Ensure yMax is not undefined, provide 40% headroom
        .range([innerHeight, 0])
        .nice();

    // Interpolate data for each X tick to place labels accurately on the line/area
    const tickDataForLabels = xTicks.map(tickDate => {
        const tickTime = tickDate.getTime();
        let leftPoint = null, rightPoint = null;

        for (let i = 0; i < chartDataArray.length - 1; i++) {
            const currTime = parseDate(chartDataArray[i][xFieldName]).getTime();
            const nextTime = parseDate(chartDataArray[i+1][xFieldName]).getTime();
            if (currTime <= tickTime && tickTime <= nextTime) {
                leftPoint = { time: currTime, value: chartDataArray[i][yFieldName] };
                rightPoint = { time: nextTime, value: chartDataArray[i+1][yFieldName] };
                break;
            }
        }

        if (leftPoint && rightPoint) {
            if (rightPoint.time === leftPoint.time) return { xField: tickDate, yField: leftPoint.value }; // Avoid division by zero
            const ratio = (tickTime - leftPoint.time) / (rightPoint.time - leftPoint.time);
            const interpolatedValue = leftPoint.value + (rightPoint.value - leftPoint.value) * ratio;
            return { xField: tickDate, yField: interpolatedValue };
        }
        
        // If tick is outside data range, find closest point (or could choose to not show label)
        if (chartDataArray.length > 0) {
            const closestPoint = chartDataArray.reduce((prev, curr) => {
                return Math.abs(parseDate(curr[xFieldName]).getTime() - tickTime) < Math.abs(parseDate(prev[xFieldName]).getTime() - tickTime) ? curr : prev;
            });
            return { xField: tickDate, yField: closestPoint[yFieldName] };
        }
        return { xField: tickDate, yField: 0 }; // Fallback if no data
    });


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .attr("class", "axis x-axis");

    xTicks.forEach(tick => {
        const xPos = xScale(tick);
        // Optional: Add tick lines
        // xAxisGroup.append("line")
        //     .attr("x1", xPos).attr("x2", xPos)
        //     .attr("y1", 0).attr("y2", 5)
        //     .attr("stroke", fillStyle.axisTextColor)
        //     .attr("class", "tick-line");

        xAxisGroup.append("text")
            .attr("x", xPos)
            .attr("y", 25) // Position below the axis line
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.axisTextColor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .text(xFormat(tick))
            .attr("class", "text axis-label");
    });
    // No Y-axis is rendered as per original chart and requirements.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const areaGenerator = d3.area()
        .x(d => xScale(parseDate(d[xFieldName])))
        .y0(innerHeight)
        .y1(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    mainChartGroup.append("path")
        .datum(chartDataArray)
        .attr("fill", fillStyle.primaryColor)
        .attr("fill-opacity", fillStyle.areaOpacity) // Use solid color with opacity
        .attr("d", areaGenerator)
        .attr("class", "mark area-mark");

    const lineGenerator = d3.line()
        .x(d => xScale(parseDate(d[xFieldName])))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    mainChartGroup.append("path")
        .datum(chartDataArray)
        .attr("fill", "none")
        .attr("stroke", fillStyle.primaryColor)
        .attr("stroke-width", fillStyle.lineStrokeWidth)
        .attr("d", lineGenerator)
        .attr("class", "mark line-mark");

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    const dataLabelsGroup = mainChartGroup.append("g")
        .attr("class", "data-labels-group");

    const minLabelSpacingPx = 60;
    let validLabelIndices = [];
    if (tickDataForLabels.length > 0) {
        let lastLabelX = -Infinity;
        tickDataForLabels.forEach((d, i) => {
            const currentX = xScale(d.xField);
            if (i === tickDataForLabels.length - 1) { // Last label
                if (validLabelIndices.length > 0 && (currentX - xScale(tickDataForLabels[validLabelIndices[validLabelIndices.length - 1]].xField) < minLabelSpacingPx)) {
                    validLabelIndices.pop(); // Remove previous if last one is too close
                }
                validLabelIndices.push(i);
            } else if (currentX - lastLabelX >= minLabelSpacingPx) {
                validLabelIndices.push(i);
                lastLabelX = currentX;
            }
        });
    }
    
    validLabelIndices.forEach(index => {
        const d = tickDataForLabels[index];
        const x = xScale(d.xField);
        const y = yScale(d.yField);

        // Skip if y value is invalid (e.g. for ticks outside actual data range after interpolation)
        if (isNaN(y) || y === null) return;

        const labelValue = numericalFormatter(d.yField);
        const textFontProps = { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: fillStyle.typography.labelFontSize, 
            fontWeight: fillStyle.typography.labelFontWeightBold // Use bold for data labels
        };
        const textWidth = estimateTextWidth(labelValue, textFontProps);
        
        const labelPaddingHorizontal = 10;
        const labelPaddingVertical = 4;
        const labelWidth = textWidth + 2 * labelPaddingHorizontal;
        const labelHeight = (parseInt(fillStyle.typography.labelFontSize, 10) || 14) + 2 * labelPaddingVertical;
        
        const labelBoxY = y - labelHeight - 20; // Position above point, with space for triangle
        const triangleSize = 8;

        // Add label background
        dataLabelsGroup.append("rect")
            .attr("x", x - labelWidth / 2)
            .attr("y", labelBoxY)
            .attr("width", labelWidth)
            .attr("height", labelHeight)
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("fill", fillStyle.labelBackgroundColor)
            .attr("class", "label data-label-background");
        
        // Add label text
        dataLabelsGroup.append("text")
            .attr("x", x)
            .attr("y", labelBoxY + labelHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.labelTextColor)
            .style("font-family", textFontProps.fontFamily)
            .style("font-size", textFontProps.fontSize)
            .style("font-weight", textFontProps.fontWeight)
            .text(labelValue)
            .attr("class", "text data-label-text");
        
        // Add connecting triangle
        dataLabelsGroup.append("path")
            .attr("d", `M${x - triangleSize / 2},${labelBoxY + labelHeight} L${x + triangleSize / 2},${labelBoxY + labelHeight} L${x},${labelBoxY + labelHeight + triangleSize} Z`)
            .attr("fill", fillStyle.labelBackgroundColor)
            .attr("class", "mark data-label-connector");
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}