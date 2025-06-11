/* REQUIREMENTS_BEGIN
{
  "chart_type": "Spline Area Chart",
  "chart_name": "spline_area_chart_01",
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
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = (data.colors_dark || data.colors) || {};
    const imagesConfig = data.images || {}; // Extracted, though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const xFieldName = xColumn ? xColumn.name : undefined;
    const yFieldName = yColumn ? yColumn.name : undefined;

    if (!xFieldName || !yFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push("x field (role='x')");
        if (!yFieldName) missingFields.push("y field (role='y')");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    if (rawChartData.length === 0) {
        const errorMsg = "Chart data is empty. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography
    fillStyle.typography.axisLabelFontFamily = (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif';
    fillStyle.typography.axisLabelFontSize = (typographyConfig.label && typographyConfig.label.font_size) || '14px'; // Original used 14px
    fillStyle.typography.axisLabelFontWeight = (typographyConfig.label && typographyConfig.label.font_weight) || 'normal';

    fillStyle.typography.dataValueFontFamily = (typographyConfig.annotation && typographyConfig.annotation.font_family) || (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif';
    fillStyle.typography.dataValueFontSize = (typographyConfig.annotation && typographyConfig.annotation.font_size) || (typographyConfig.label && typographyConfig.label.font_size) || '14px'; // Original used 14px
    fillStyle.typography.dataValueFontWeight = (typographyConfig.annotation && typographyConfig.annotation.font_weight) || (typographyConfig.label && typographyConfig.label.font_weight) || 'bold'; // Original used bold

    // Colors (assuming dark theme context from original `colors_dark` usage)
    fillStyle.colors.chartBackground = colorsConfig.background_color || '#121212'; // Dark background default
    fillStyle.colors.textColor = colorsConfig.text_color || '#E0E0E0'; // Light text default
    fillStyle.colors.primary = (colorsConfig.other && colorsConfig.other.primary) || '#BB86FC'; // Vibrant primary for dark theme
    fillStyle.colors.axisTickColor = colorsConfig.text_color || '#AAAAAA'; // Specific for ticks, or general text color
    fillStyle.colors.labelTextColorOnPrimary = '#FFFFFF'; // Text on primary-colored background

    fillStyle.areaFillOpacity = 0.4;
    fillStyle.lineStrokeWidth = 3;
    fillStyle.labelRectRx = 5; // Corner radius for label background

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.axisLabelFontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.axisLabelFontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.axisLabelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No need to append to DOM for getBBox if part of an SVG structure
        const width = tempText.getBBox().width;
        return width;
    }
    
    function robustDateParse(dateString) {
        if (dateString instanceof Date && !isNaN(dateString)) return dateString;
        let date = d3.isoParse(String(dateString));
        if (date) return date;
        date = new Date(String(dateString));
        if (!isNaN(date)) return date;
        console.warn(`Could not parse date: ${dateString}`);
        return null;
    }

    function createXAxisScaleAndTicksHelper(chartDataArray, xValAccessor, width, dateParserFunc) {
        const dates = chartDataArray.map(d => dateParserFunc(xValAccessor(d))).filter(d => d !== null);
        if (dates.length === 0) {
            return { xScale: d3.scaleTime().domain([new Date(), new Date()]).range([0, width]), xTicks: [], xTickFormat: d3.timeFormat("") };
        }
        const xMin = d3.min(dates);
        const xMax = d3.max(dates);

        const xScale = d3.scaleTime().domain([xMin, xMax]).range([0, width]);
        const timeSpanDays = (xMax - xMin) / (1000 * 60 * 60 * 24);
        let xTickFormat;

        if (timeSpanDays <= 2) { // Increased from 1 to 2 for better HH:MM visibility
            xTickFormat = d3.timeFormat("%H:%M");
        } else if (timeSpanDays <= 10) { // Increased from 7 to 10
            xTickFormat = d3.timeFormat("%a %d");
        } else if (timeSpanDays <= 30 * 9) { // Increased from 6 to 9 months
            xTickFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 365 * 3) { // Increased from 2 to 3 years
            xTickFormat = d3.timeFormat("%b '%y");
        } else {
            xTickFormat = d3.timeFormat("%Y");
        }
        
        const numTicksTarget = Math.max(2, Math.min(10, Math.floor(width / 80)));
        const xTicks = xScale.ticks(numTicksTarget);
        return { xScale, xTicks, xTickFormat };
    }

    function sampleLabelsHelper(totalPoints, maxLabels = 7) { // Increased maxLabels for better coverage
        if (totalPoints <= 0) return [];
        if (totalPoints <= maxLabels) {
            return Array.from({ length: totalPoints }, (_, i) => i);
        }
        const indices = new Set();
        indices.add(0);
        indices.add(totalPoints - 1);

        if (maxLabels > 2) {
            const numIntermediatePoints = maxLabels - 2;
            const step = (totalPoints - 1) / (numIntermediatePoints + 1); // Ensure distribution across the range
            for (let i = 0; i < numIntermediatePoints; i++) {
                indices.add(Math.round(step * (i + 1)));
            }
        }
        return Array.from(indices).filter(idx => idx >= 0 && idx < totalPoints).sort((a, b) => a - b);
    }

    function formatValueHelper(value) {
        if (typeof value !== 'number') return String(value);
        if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + 'M';
        if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(1) + 'K';
        if (Number.isInteger(value)) return String(value);
        return value.toFixed(1);
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
        .style("background-color", fillStyle.colors.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 60, left: 60 }; // Reduced top/bottom margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    let chartData = rawChartData.map(d => {
        const date = robustDateParse(d[xFieldName]);
        const value = parseFloat(d[yFieldName]); // Ensure yValue is a number
        if (date === null || isNaN(value)) {
            console.warn(`Skipping invalid data point: Date=${d[xFieldName]}, Value=${d[yFieldName]}`);
            return null; 
        }
        return { ...d, [xFieldName]: date, [yFieldName]: value };
    }).filter(d => d !== null);
    
    if (chartData.length === 0) {
        const errorMsg = "No valid data points after parsing. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    chartData.sort((a, b) => a[xFieldName] - b[xFieldName]);

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xTickFormat } = createXAxisScaleAndTicksHelper(
        chartData, 
        d => d[xFieldName], 
        innerWidth,
        d => d // Dates are already parsed
    );

    const yMax = d3.max(chartData, d => d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([0, yMax * 1.4]) // Keep 40% headroom for labels
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .attr("class", "axis x-axis");

    xTicks.forEach(tickValue => {
        xAxisGroup.append("text")
            .attr("class", "text tick-label")
            .attr("x", xScale(tickValue))
            .attr("y", chartMargins.bottom / 2) // Position ticks below the chart area
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.colors.axisTickColor)
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .text(xTickFormat(tickValue));
    });

    // Block 8: Main Data Visualization Rendering
    const areaGenerator = d3.area()
        .x(d => xScale(d[xFieldName]))
        .y0(innerHeight)
        .y1(d => yScale(d[yFieldName]))
        .curve(d3.curveBasis);

    mainChartGroup.append("path")
        .datum(chartData)
        .attr("class", "mark area")
        .attr("fill", fillStyle.colors.primary)
        .attr("opacity", fillStyle.areaFillOpacity)
        .attr("d", areaGenerator);

    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveBasis);

    mainChartGroup.append("path")
        .datum(chartData)
        .attr("class", "mark line")
        .attr("fill", "none")
        .attr("stroke", fillStyle.colors.primary)
        .attr("stroke-width", fillStyle.lineStrokeWidth)
        .attr("d", lineGenerator);

    // Block 9: Optional Enhancements & Post-Processing (Data Labels)
    const labelIndices = sampleLabelsHelper(chartData.length);

    labelIndices.forEach(i => {
        const d = chartData[i];
        const x = xScale(d[xFieldName]);
        const y = yScale(d[yFieldName]);
        
        let labelY = y; // Default label Y position

        // Refined label Y position logic (preserved from original)
        if (chartData.length > 1) {
            if (i === 0) {
                const nextPoint = chartData[i+1];
                const nextY = yScale(nextPoint[yFieldName]);
                const forwardY = y + (nextY - y) * 0.2;
                labelY = Math.min(y, forwardY) - 4;
            } else if (i === chartData.length - 1) {
                const prevPoint = chartData[i-1];
                const prevY = yScale(prevPoint[yFieldName]);
                const backwardY = y + (prevY - y) * 0.2;
                labelY = Math.min(y, backwardY) - 4;
            } else {
                const prevPoint = chartData[i-1];
                const nextPoint = chartData[i+1];
                const prevY = yScale(prevPoint[yFieldName]);
                const nextY = yScale(nextPoint[yFieldName]);
                const forwardY = y + (nextY - y) * 0.2;
                const backwardY = y + (prevY - y) * 0.2;
                labelY = Math.min(y, forwardY, backwardY) - 4;
            }
        }
        labelY = Math.min(labelY, y - 4); // Ensure at least 4px above point
        labelY = Math.max(labelY, 25); // Ensure label doesn't go off top of chart (25 is approx height of label box)


        const labelValueText = formatValueHelper(d[yFieldName]);
        const textWidth = estimateTextWidth(labelValueText, {
            fontFamily: fillStyle.typography.dataValueFontFamily,
            fontSize: fillStyle.typography.dataValueFontSize,
            fontWeight: fillStyle.typography.dataValueFontWeight
        });
        
        const labelPadding = { horizontal: 10, vertical: 5 };
        const labelContentHeight = parseFloat(fillStyle.typography.dataValueFontSize);
        const labelRectWidth = textWidth + 2 * labelPadding.horizontal;
        const labelRectHeight = labelContentHeight + 2 * labelPadding.vertical;
        const labelBoxYOffset = 15; // Space between pointer and label box
        const pointerSize = 8;

        const labelGroup = mainChartGroup.append("g")
            .attr("class", "label data-label")
            .attr("transform", `translate(${x - labelRectWidth / 2}, ${labelY - labelRectHeight - labelBoxYOffset - pointerSize})`);

        labelGroup.append("rect")
            .attr("class", "other label-background")
            .attr("width", labelRectWidth)
            .attr("height", labelRectHeight)
            .attr("rx", fillStyle.labelRectRx)
            .attr("ry", fillStyle.labelRectRx)
            .attr("fill", fillStyle.colors.primary)
            .attr("opacity", 0.9);

        labelGroup.append("text")
            .attr("class", "text value")
            .attr("x", labelRectWidth / 2)
            .attr("y", labelRectHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.colors.labelTextColorOnPrimary)
            .style("font-family", fillStyle.typography.dataValueFontFamily)
            .style("font-size", fillStyle.typography.dataValueFontSize)
            .style("font-weight", fillStyle.typography.dataValueFontWeight)
            .text(labelValueText);
        
        // Triangle pointer
        mainChartGroup.append("path")
            .attr("class", "other label-pointer")
            .attr("d", `M${x - pointerSize / 2},${labelY - labelBoxYOffset - pointerSize} L${x + pointerSize / 2},${labelY - labelBoxYOffset - pointerSize} L${x},${labelY - labelBoxYOffset} Z`)
            .attr("fill", fillStyle.colors.primary)
            .attr("opacity", 0.9);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}