/* REQUIREMENTS_BEGIN
{
  "chart_type": "Spline Graph",
  "chart_name": "spline_graph_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["temporal"], ["numerical"]],
  "required_fields_range": [[5, 30], ["-inf", "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
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
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via colors_dark
    const imagesConfig = data.images || {}; // Not used in this chart, but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldColumn = dataColumns.find(col => col.role === 'x');
    const yFieldColumn = dataColumns.find(col => col.role === 'y');

    if (!xFieldColumn || !xFieldColumn.name) {
        console.error("Critical chart config missing: X-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: X-axis field name is not configured.</div>");
        return null;
    }
    if (!yFieldColumn || !yFieldColumn.name) {
        console.error("Critical chart config missing: Y-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Y-axis field name is not configured.</div>");
        return null;
    }

    const xFieldName = xFieldColumn.name;
    const yFieldName = yFieldColumn.name;
    const yFieldLabelText = yFieldColumn.label || yFieldName;


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
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'bold', // Made bold for data values
        },
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        textColor: colorsConfig.text_color || '#333333',
        primaryLineColor: (colorsConfig.other && colorsConfig.other.primary) || '#1e90ff',
        gridLineColor: (colorsConfig.other && colorsConfig.other.secondary) || '#e0e0e0', // Softer default
        dataPointStrokeColor: (colorsConfig.other && colorsConfig.other.primary) || '#1e90ff',
        dataPointFillColor: colorsConfig.background_color || '#FFFFFF', // Use chart background for hollow effect
    };
    fillStyle.axisLabelColor = fillStyle.textColor;
    fillStyle.dataValueColor = fillStyle.primaryLineColor;
    fillStyle.yAxisTitleColor = fillStyle.textColor;
    fillStyle.yAxisTitleBorderColor = fillStyle.textColor;


    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        document.body.appendChild(tempSvg); // Needs to be in DOM for getBBox
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    };
    
    const parseDate = d => {
        if (d instanceof Date) return d;
        if (typeof d === 'number') return new Date(d, 0, 1); // Assume year if number
        if (typeof d === 'string') {
            const parts = d.split(/[-/]/); // Allow more delimiters
            if (parts.length === 3) { // YYYY-MM-DD or MM/DD/YYYY etc.
                const year = parseInt(parts[0].length === 4 ? parts[0] : parts[2]);
                const month = parseInt(parts[0].length === 4 ? parts[1] : parts[0]) -1;
                const day = parseInt(parts[0].length === 4 ? parts[2] : parts[1]);
                if (!isNaN(year) && !isNaN(month) && !isNaN(day)) return new Date(year, month, day);
            }
            if (parts.length === 2) { // YYYY-MM
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                 if (!isNaN(year) && !isNaN(month)) return new Date(year, month, 1);
            }
            if (parts.length === 1 && /^\d{4}$/.test(parts[0])) { // YYYY
                const year = parseInt(parts[0]);
                if (!isNaN(year)) return new Date(year, 0, 1);
            }
            // Try general date parsing as a fallback
            const parsed = new Date(d);
            if (!isNaN(parsed.getTime())) return parsed;
        }
        return null; // Return null if unparseable
    };

    const createXAxisScaleAndTicks = (processedData, xAccessor, rangeStart, rangeEnd, padding = 0.05) => {
        const dates = processedData.map(xAccessor).filter(d => d instanceof Date);
        if (dates.length === 0) {
            return {
                xScale: d3.scaleTime().domain([new Date(), new Date()]).range([rangeStart, rangeEnd]),
                xTicks: [],
                xFormat: d3.timeFormat("%Y-%m-%d")
            };
        }

        const xExtent = d3.extent(dates);
        const xRange = xExtent[1].getTime() - xExtent[0].getTime();
        const xPadding = xRange * padding;
        
        const xScale = d3.scaleTime()
            .domain([
                new Date(xExtent[0].getTime() - xPadding),
                new Date(xExtent[1].getTime() + xPadding)
            ])
            .range([rangeStart, rangeEnd]);
        
        const timeSpan = xExtent[1].getTime() - xExtent[0].getTime();
        const daySpan = timeSpan / (1000 * 60 * 60 * 24);
        const monthSpan = daySpan / 30;
        const yearSpan = daySpan / 365;
        
        let timeInterval;
        let formatFunction;
        
        if (yearSpan > 35) { timeInterval = d3.timeYear.every(10); formatFunction = d3.timeFormat("%Y"); }
        else if (yearSpan > 15) { timeInterval = d3.timeYear.every(5); formatFunction = d3.timeFormat("%Y"); }
        else if (yearSpan > 7) { timeInterval = d3.timeYear.every(2); formatFunction = d3.timeFormat("%Y"); }
        else if (yearSpan > 2) { timeInterval = d3.timeYear.every(1); formatFunction = d3.timeFormat("%Y"); }
        else if (yearSpan > 1) {
            timeInterval = d3.timeMonth.every(3);
            formatFunction = d => {
                const month = d.getMonth();
                const quarter = Math.floor(month / 3) + 1;
                return `${d3.timeFormat("%y")(d)}Q${quarter}`;
            };
        } else if (monthSpan > 6) { timeInterval = d3.timeMonth.every(1); formatFunction = d3.timeFormat("%b %Y"); }
        else if (monthSpan > 2) { timeInterval = d3.timeWeek.every(1); formatFunction = d3.timeFormat("%d %b"); }
        else {
            const dayInterval = Math.max(1, Math.ceil(daySpan / 10));
            timeInterval = d3.timeDay.every(dayInterval);
            formatFunction = d3.timeFormat("%d %b");
        }
        
        const xTicks = xScale.ticks(timeInterval);
        if (xTicks.length > 0 && xExtent[1] > xTicks[xTicks.length - 1]) {
             if (xTicks.length > 7 && xTicks[xTicks.length -1].getTime() + timeInterval.every(1).round(xExtent[1]).getTime() - xExtent[1].getTime() > (xExtent[1].getTime() - xTicks[xTicks.length-1].getTime())/2 ) { // Heuristic to avoid crowding last tick
                xTicks.pop();
            }
            xTicks.push(xExtent[1]);
        }
        
        return { xScale, xTicks, xFormat: formatFunction };
    };

    const findTickDataPoints = (processedData, xAccessor, yAccessor, xTicks) => {
        const tickDataPoints = [];
        if (processedData.length === 0 || xTicks.length === 0) return [];

        xTicks.forEach(tick => {
            let closestPoint = null;
            let minDistance = Infinity;
            
            processedData.forEach(d => {
                const dataDate = xAccessor(d);
                if (!(dataDate instanceof Date)) return;
                const distance = Math.abs(dataDate.getTime() - tick.getTime());
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPoint = d;
                }
            });
            
            if (closestPoint) {
                tickDataPoints.push(closestPoint);
            }
        });
        
        const uniquePoints = [];
        const addedPoints = new Set();
        tickDataPoints.forEach(point => {
            const key = `${xAccessor(point).toISOString()}-${yAccessor(point)}`;
            if (!addedPoints.has(key)) {
                addedPoints.add(key);
                uniquePoints.push(point);
            }
        });
        return uniquePoints;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 50, bottom: 60, left: 60 };
    // Adjust margins if yFieldLabelText is very long
    const yAxisTitleFontProps = {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    };
    const yAxisTitleWidth = estimateTextWidth(yFieldLabelText, yAxisTitleFontProps);
    if (yAxisTitleWidth + 20 > chartMargins.left) { // 20 for padding and triangle
        // chartMargins.left = yAxisTitleWidth + 30; // Make space for Y-axis title
    }
    // Make more space for Y axis labels if numbers are large
    // This is a heuristic, a more robust way would be to measure max tick label width
    const tempYScaleForLabelCheck = d3.scaleLinear().domain([0, d3.max(rawChartData, d => d[yFieldName]) || 1000]).range([0,100]);
    const maxYTicksLabelWidth = d3.max(tempYScaleForLabelCheck.ticks(5), tick => estimateTextWidth(String(tick), yAxisTitleFontProps));
    if (maxYTicksLabelWidth + 10 > chartMargins.left) {
        chartMargins.left = maxYTicksLabelWidth + 15;
    }


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]), // Parse date for xField
        [yFieldName]: parseFloat(d[yFieldName]) // Ensure yField is numeric
    })).filter(d => d[xFieldName] instanceof Date && !isNaN(d[yFieldName])); // Filter out invalid data

    if (chartDataArray.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "label")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No valid data to display.");
        return svgRoot.node();
    }
    
    // Sort data by date to ensure line is drawn correctly
    chartDataArray.sort((a, b) => a[xFieldName] - b[xFieldName]);


    // Block 6: Scale Definition & Configuration
    const xAccessor = d => d[xFieldName];
    const yAccessor = d => d[yFieldName];

    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartDataArray, xAccessor, 0, innerWidth);
    
    const yMin = d3.min(chartDataArray, yAccessor);
    const yMax = d3.max(chartDataArray, yAccessor);
    const yScale = d3.scaleLinear()
        .domain([
            Math.min(0, yMin - (yMax - yMin) * 0.1), // Extend slightly below min or 0
            yMax + (yMax - yMin) * 0.2  // Extend slightly above max for labels
        ])
        .range([innerHeight, 0])
        .nice();


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const yAxisTicks = yScale.ticks(5);
    const gridExtension = 5; // How much grid lines extend beyond chart area

    // Horizontal Gridlines
    mainChartGroup.append("g")
        .attr("class", "gridlines-y")
        .selectAll("line.gridline-y")
        .data(yAxisTicks)
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", -gridExtension)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    // Vertical Gridlines (excluding first and last if they are on the edge)
    mainChartGroup.append("g")
        .attr("class", "gridlines-x")
        .selectAll("line.gridline-x")
        .data(xTicks.filter((d, i) => xScale(d) > 0 && xScale(d) < innerWidth)) // Filter ticks strictly within plot area
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", d => xScale(d))
        .attr("y1", 0)
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight + gridExtension)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    // X-Axis Labels
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    xAxisGroup.selectAll("text.axis-label-x")
        .data(xTicks)
        .enter().append("text")
        .attr("class", "label axis-label-x")
        .attr("x", d => xScale(d))
        .attr("y", chartMargins.bottom / 2) // Position in the middle of bottom margin
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.axisLabelColor)
        .text(d => xFormat(d));

    // Y-Axis Labels
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    yAxisGroup.selectAll("text.axis-label-y")
        .data(yAxisTicks)
        .enter().append("text")
        .attr("class", "label axis-label-y") // Changed from "value" to "label" for consistency
        .attr("x", -gridExtension - 5) // Position left of the axis line
        .attr("y", d => yScale(d))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.axisLabelColor)
        .text(d => d);

    // Y-Axis Field Label (with triangle)
    if (yFieldLabelText) {
        const yAxisTitleGroup = mainChartGroup.append("g")
            .attr("class", "other y-axis-title-group");
            // Position dynamically based on available space and label length
            // Simplified positioning: top-left of chart area.
        
        const labelTextWidth = estimateTextWidth(yFieldLabelText, yAxisTitleFontProps);
        const labelPadding = 10; // Reduced padding
        const finalLabelWidth = labelTextWidth + 2 * labelPadding;
        const labelHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.5; // Relative to font size
        const triangleSize = 6;

        // Position it above the highest y-tick, or at top of chart if ticks are low
        const yTitlePosY = Math.min(yScale(yAxisTicks[yAxisTicks.length-1]) - labelHeight - triangleSize - 10, -labelHeight - triangleSize - 5);
        const yTitlePosX = -chartMargins.left + 15; // Relative to mainChartGroup

        yAxisTitleGroup.attr("transform", `translate(${yTitlePosX}, ${yTitlePosY})`);

        const labelPath = `
            M 0,0 
            H ${finalLabelWidth} 
            V ${labelHeight} 
            H ${finalLabelWidth/2 + triangleSize} 
            L ${finalLabelWidth/2},${labelHeight + triangleSize} 
            L ${finalLabelWidth/2 - triangleSize},${labelHeight} 
            H 0 
            Z
        `;

        yAxisTitleGroup.append("path")
            .attr("d", labelPath)
            .attr("fill", "none") // Transparent fill
            .attr("stroke", fillStyle.yAxisTitleBorderColor)
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 0.7)
            .attr("class", "other y-axis-title-path");

        yAxisTitleGroup.append("text")
            .attr("x", finalLabelWidth / 2)
            .attr("y", labelHeight / 2) // Vertically center in the rectangle part
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("class", "text y-axis-title-text")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.yAxisTitleColor)
            .text(yFieldLabelText);
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const lineGenerator = d3.line()
        .x(d => xScale(xAccessor(d)))
        .y(d => yScale(yAccessor(d)))
        .curve(d3.curveMonotoneX);

    mainChartGroup.append("path")
        .datum(chartDataArray)
        .attr("class", "mark data-line")
        .attr("fill", "none")
        .attr("stroke", fillStyle.primaryLineColor)
        .attr("stroke-width", 3)
        .attr("d", lineGenerator);

    const tickDataPoints = findTickDataPoints(chartDataArray, xAccessor, yAccessor, xTicks);
    
    const dataPointsGroup = mainChartGroup.append("g").attr("class", "data-points-group");

    tickDataPoints.forEach(d => {
        const cx = xScale(xAccessor(d));
        const cy = yScale(yAccessor(d));
        const value = yAccessor(d);
        
        // Check if point is within visible plot area before rendering
        if (cx >= 0 && cx <= innerWidth && cy >=0 && cy <= innerHeight) {
            dataPointsGroup.append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", 6) // Slightly smaller radius
                .attr("class", "mark data-point-circle")
                .attr("fill", fillStyle.dataPointFillColor)
                .attr("stroke", fillStyle.dataPointStrokeColor)
                .attr("stroke-width", 2.5); // Slightly thinner stroke
            
            dataPointsGroup.append("text")
                .attr("x", cx)
                .attr("y", cy - 12) // Adjusted offset
                .attr("text-anchor", "middle")
                .attr("class", "value data-value-label")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.dataValueColor)
                .text(Math.round(value));
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Removed gradient background as per requirements. Solid background is set on SVG root.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}