/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Line Graph",
  "chart_name": "multiple_line_graph_11",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 30], ["-inf", "inf"], [2, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
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
    const providedTypography = data.typography || {};
    const providedColors = data.colors || (data.colors_dark || {});
    const providedImages = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    const criticalFields = {};
    if (xFieldConfig) criticalFields.xFieldName = xFieldConfig.name;
    if (yFieldConfig) criticalFields.yFieldName = yFieldConfig.name;
    if (groupFieldConfig) criticalFields.groupFieldName = groupFieldConfig.name;
    
    const yFieldUnits = yFieldConfig && yFieldConfig.unit ? yFieldConfig.unit : "";


    const missingFields = ["xFieldName", "yFieldName", "groupFieldName"]
        .filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        return null;
    }
    const { xFieldName, yFieldName, groupFieldName } = criticalFields;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {},
        images: {} // Store image URLs if needed
    };

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" }, // Not used
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.labelFontFamily = (providedTypography.label && providedTypography.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (providedTypography.label && providedTypography.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (providedTypography.label && providedTypography.label.font_weight) || defaultTypography.label.font_weight;

    fillStyle.typography.annotationFontFamily = (providedTypography.annotation && providedTypography.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (providedTypography.annotation && providedTypography.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (providedTypography.annotation && providedTypography.annotation.font_weight) || defaultTypography.annotation.font_weight;
    
    // Color defaults
    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };

    fillStyle.colors.chartBackground = providedColors.background_color || defaultColors.background_color;
    fillStyle.colors.textColor = providedColors.text_color || defaultColors.text_color;
    fillStyle.colors.axisLineColor = providedColors.other && providedColors.other.secondary ? providedColors.other.secondary : '#AAAAAA';
    fillStyle.colors.gridLineColor = providedColors.other && providedColors.other.grid_subtle ? providedColors.other.grid_subtle : '#DDDDDD';
    fillStyle.colors.dataLabelTextContrastColor = "#FFFFFF"; // For text on colored backgrounds

    const uniqueGroupNames = [...new Set(rawChartData.map(d => d[groupFieldName]))];
    fillStyle.colors.groupColorScale = (groupName) => {
        if (providedColors.field && providedColors.field[groupName]) {
            return providedColors.field[groupName];
        }
        const colorList = (providedColors.available_colors && providedColors.available_colors.length > 0) ? providedColors.available_colors : defaultColors.available_colors;
        const index = uniqueGroupNames.indexOf(groupName);
        return colorList[index % colorList.length];
    };
    
    // Image handling (not used in this chart, but per spec)
    fillStyle.images.field = providedImages.field || {};
    fillStyle.images.other = providedImages.other || {};


    const DATA_LINE_WIDTH = variables.lineWidth || 2; // Original was 4, making it configurable or a bit thinner
    const LABEL_PADDING = { horizontal: 6, vertical: 3 }; // Padding for data labels

    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        return context.measureText(text).width;
    }

    function parseDateRobust(dateString) {
        if (dateString instanceof Date) return dateString;
        if (typeof dateString === 'number') return new Date(dateString); // Handle timestamps

        let date = d3.isoParse(dateString);
        if (date) return date;
        const commonFormats = ["%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y %H:%M", "%b %d %Y"];
        for (let fmt of commonFormats) {
            let parsed = d3.timeParse(fmt)(dateString);
            if (parsed) return parsed;
        }
        date = new Date(dateString); // Fallback to native Date parser
        return !isNaN(date.getTime()) ? date : null;
    }
    
    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [xFieldName]: parseDateRobust(d[xFieldName]),
        [yFieldName]: +d[yFieldName] // Ensure y is numeric
    })).filter(d => d[xFieldName] instanceof Date && !isNaN(d[yFieldName]));


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
    const chartMargins = { top: 60, right: 30, bottom: 60, left: 60 };
    if (variables.dynamicMarginLeft) { // Allow dynamic left margin based on Y-axis labels
        const maxYVal = d3.max(chartDataArray, d => d[yFieldName]);
        const sampleYLabelWidth = estimateTextWidth(
            formatValue(maxYVal || 0, yFieldUnits), 
            fillStyle.typography.labelFontWeight, 
            fillStyle.typography.labelFontSize, 
            fillStyle.typography.labelFontFamily
        );
        chartMargins.left = Math.max(chartMargins.left, sampleYLabelWidth + 20);
    }


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort();
    const groupedData = d3.group(chartDataArray, d => d[groupFieldName]);

    groupedData.forEach(values => {
        values.sort((a, b) => a[xFieldName] - b[xFieldName]); // Sort by date
    });

    // Block 6: Scale Definition & Configuration
    function createXAxisScaleAndTicksInternal(data, xField, rangeMin, rangeMax) {
        const dates = data.map(d => d[xField]).filter(d => d instanceof Date);
        if (dates.length === 0) {
            const now = new Date();
            const xScale = d3.scaleTime().domain([now, d3.timeDay.offset(now, 1)]).range([rangeMin, rangeMax]);
            return { xScale, xTicks: xScale.ticks(Math.max(2, Math.floor(innerWidth / 100))), xFormat: d3.timeFormat("%b %d") };
        }

        const xDomain = d3.extent(dates);
        const xScale = d3.scaleTime().domain(xDomain).range([rangeMin, rangeMax]);
        
        const numTicks = Math.max(2, Math.floor(innerWidth / 100)); // Dynamic number of ticks
        let xTicks = xScale.ticks(numTicks);
        let xFormat;

        const timeDiff = xDomain[1] && xDomain[0] ? xDomain[1].getTime() - xDomain[0].getTime() : 0;
        const oneDay = 24 * 60 * 60 * 1000;

        if (timeDiff > 365 * 2 * oneDay) xFormat = d3.timeFormat("%Y");
        else if (timeDiff > 30 * 2 * oneDay) xFormat = d3.timeFormat("%b %Y");
        else if (timeDiff > 2 * oneDay) xFormat = d3.timeFormat("%b %d");
        else xFormat = d3.timeFormat("%H:%M");
        
        // Ensure ticks are within domain, add extents if needed
        if (xDomain[0] && xDomain[1]) {
            xTicks = xTicks.filter(tick => tick >= xDomain[0] && tick <= xDomain[1]);
            if (xTicks.length > 0) {
                 if (xTicks[0] > xDomain[0]) xTicks.unshift(xDomain[0]);
                 if (xTicks[xTicks.length - 1] < xDomain[1]) xTicks.push(xDomain[1]);
            } else {
                 xTicks = [xDomain[0], xDomain[1]];
            }
        } else if (xDomain[0]) {
            xTicks = [xDomain[0]];
        } else {
            xTicks = [];
        }


        return { xScale, xTicks, xFormat };
    }

    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicksInternal(chartDataArray, xFieldName, 0, innerWidth);

    const yMin = d3.min(chartDataArray, d => d[yFieldName]);
    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const yPadding = (yMax - yMin) * 0.3 || (yMax * 0.3 || 10); // Handle yMin=yMax or yMin/yMax=0
    
    const yDomainMin = (yMin === undefined || yMax === undefined) ? 0 : Math.min(yMin, yMin - yPadding); // Allow negative if data is negative
    if (yMin >= 0 && yDomainMin < 0) { // If all data is positive, don't let y-axis go negative unless yMin itself is negative
       // yDomainMin = 0; // Original logic: Math.max(0, yMin - yPadding)
    }
    const yDomainMax = (yMin === undefined || yMax === undefined) ? 100 : yMax + yPadding;


    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0])
        .nice(); // .nice() is generally good for scales

    const yAxisTicks = yScale.ticks(5); // Suggest 5 ticks

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Y-Axis Gridlines
    const yGridlinesGroup = mainChartGroup.append("g").attr("class", "grid y-grid other");
    yAxisTicks.forEach(tick => {
        yGridlinesGroup.append("line")
            .attr("class", "grid-line other")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", innerWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.colors.gridLineColor)
            .attr("stroke-width", 0.5); // Thinner grid lines
    });
    if (yAxisTicks.length > 1) { // Mid-point gridlines
        for (let i = 0; i < yAxisTicks.length - 1; i++) {
            const midValue = (yAxisTicks[i] + yAxisTicks[i+1]) / 2;
            if (midValue > yScale.domain()[0] && midValue < yScale.domain()[1]) { // Ensure midValue is within domain
                 yGridlinesGroup.append("line")
                    .attr("class", "grid-line other subtle")
                    .attr("x1", 0)
                    .attr("y1", yScale(midValue))
                    .attr("x2", innerWidth)
                    .attr("y2", yScale(midValue))
                    .attr("stroke", fillStyle.colors.gridLineColor)
                    .attr("stroke-dasharray", "2,2") // Dashed for subtle
                    .attr("stroke-width", 0.5);
            }
        }
    }

    // Y-Axis
    const yAxisGroup = mainChartGroup.append("g").attr("class", "axis y-axis");
    yAxisTicks.forEach(tick => {
        yAxisGroup.append("text")
            .attr("class", "label axis-label")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.colors.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(formatValue(tick, yFieldUnits));
    });

    // X-Axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    xTicks.forEach(tick => {
        xAxisGroup.append("text")
            .attr("class", "label axis-label")
            .attr("x", xScale(tick))
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.colors.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xFormat(tick));
    });
    xAxisGroup.append("line")
        .attr("class", "axis-line mark")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", innerWidth)
        .attr("y2", 0)
        .attr("stroke", fillStyle.colors.axisLineColor)
        .attr("stroke-width", 1);

    // Legend
    function layoutLegendInternal(legendContainerGroup, groupNames, colorScaleFunc, styleFill, options) {
        const { x, y, align, maxWidth, shape } = options;
        const itemPadding = 5;
        const shapeSize = parseFloat(styleFill.typography.labelFontSize) * 0.8;
        const textPadding = 5;
        let currentX = x;
        let currentY = y;
        let maxLineWidth = 0;
        let currentLineHeight = 0;
    
        const legendItems = legendContainerGroup.selectAll(".legend-item")
            .data(groupNames)
            .enter()
            .append("g")
            .attr("class", "legend-item other");
    
        legendItems.each(function(groupNameStr, i) {
            const itemGroup = d3.select(this);
            const color = colorScaleFunc(groupNameStr);
            let itemWidth = 0;
    
            if (shape === "line") {
                itemGroup.append("line")
                    .attr("class", "mark legend-shape")
                    .attr("x1", 0).attr("y1", shapeSize / 2)
                    .attr("x2", shapeSize * 1.5).attr("y2", shapeSize / 2)
                    .attr("stroke", color).attr("stroke-width", DATA_LINE_WIDTH);
                itemWidth += shapeSize * 1.5 + textPadding;
            } else {
                itemGroup.append("rect")
                    .attr("class", "mark legend-shape")
                    .attr("width", shapeSize).attr("height", shapeSize)
                    .attr("fill", color);
                itemWidth += shapeSize + textPadding;
            }
    
            const textElement = itemGroup.append("text")
                .attr("class", "label legend-label")
                .attr("x", itemWidth).attr("y", shapeSize / 2).attr("dy", "0.35em")
                .attr("fill", styleFill.colors.textColor)
                .style("font-family", styleFill.typography.labelFontFamily)
                .style("font-size", styleFill.typography.labelFontSize)
                .style("font-weight", styleFill.typography.labelFontWeight)
                .text(groupNameStr);
            
            const textBBoxWidth = estimateTextWidth(groupNameStr, styleFill.typography.labelFontWeight, styleFill.typography.labelFontSize, styleFill.typography.labelFontFamily);
            itemWidth += textBBoxWidth;
            currentLineHeight = Math.max(currentLineHeight, shapeSize);
    
            if (currentX + itemWidth > x + maxWidth && i > 0) {
                currentX = x;
                currentY += currentLineHeight + itemPadding;
                currentLineHeight = shapeSize; 
            }
            itemGroup.attr("transform", `translate(${currentX}, ${currentY})`);
            
            maxLineWidth = Math.max(maxLineWidth, currentX + itemWidth - x);
            currentX += itemWidth + itemPadding * 2;
        });
        
        const totalHeight = (groupNames.length === 0) ? 0 : (currentY + currentLineHeight - y);
        return { width: Math.max(0, maxLineWidth), height: Math.max(0, totalHeight) };
    }

    const legendGroup = mainChartGroup.append("g").attr("class", "legend-group other");
    const legendSize = layoutLegendInternal(legendGroup, groups, fillStyle.colors.groupColorScale, fillStyle, {
        x: 0, y: 0,
        align: "left", // 'left', 'center', 'right'
        maxWidth: innerWidth,
        shape: "line", // 'line' or 'rect'
    });
    
    const legendX = (innerWidth - legendSize.width) / 2; // Centered
    const legendY = yScale(yAxisTicks[yAxisTicks.length-1]) - (variables.legendOffset || 50) - legendSize.height; // Position above highest tick
    legendGroup.attr("transform", `translate(${legendX}, ${Math.max(-chartMargins.top + 10, legendY)})`);


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    const linesGroup = mainChartGroup.append("g").attr("class", "lines-group mark");

    const pointsForLabelling = { start: [], middle: [], end: [] };

    groupedData.forEach((values, group) => {
        const color = fillStyle.colors.groupColorScale(group);
        linesGroup.append("path")
            .datum(values)
            .attr("class", "line mark")
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", DATA_LINE_WIDTH)
            .attr("d", lineGenerator);

        const middleIndex = Math.floor(values.length / 2);
        values.forEach((d, i) => {
            const pointData = {
                x: xScale(d[xFieldName]),
                y: yScale(d[yFieldName]),
                value: d[yFieldName],
                color: color,
                group: group,
                originalPoint: d // Keep original point for context
            };
            if (i === 0) pointsForLabelling.start.push(pointData);
            else if (i === values.length - 1) pointsForLabelling.end.push(pointData);
            else if (i === middleIndex) pointsForLabelling.middle.push(pointData);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing (Data Labels)
    const dataLabelsGroup = mainChartGroup.append("g").attr("class", "data-labels-group other");
    
    const annotationTextHeight = parseFloat(fillStyle.typography.annotationFontSize);
    const renderedLabelHeight = annotationTextHeight + 2 * LABEL_PADDING.vertical;

    function formatValue(value, units = "") {
        if (typeof value !== 'number' || isNaN(value)) return String(value);
        return Math.round(value) + units;
    }

    function drawLabelsInternal(labelPlacements) {
        labelPlacements.forEach(placement => {
            const point = placement.point; // This is the pointData object
            const labelY = placement.labelY; // This is the calculated Y for the top of the label
            
            const labelText = formatValue(point.value, yFieldUnits);
            const labelTextWidth = estimateTextWidth(labelText, fillStyle.typography.annotationFontWeight, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontFamily);
            const labelRectWidth = labelTextWidth + 2 * LABEL_PADDING.horizontal;
            
            dataLabelsGroup.append("rect")
                .attr("class", "data-label-bg mark")
                .attr("x", point.x - labelRectWidth / 2)
                .attr("y", labelY) // labelY is top of rect
                .attr("width", labelRectWidth)
                .attr("height", renderedLabelHeight)
                .attr("rx", 0) // No rounded corners
                .attr("ry", 0)
                .attr("fill", point.color);
            
            dataLabelsGroup.append("text")
                .attr("class", "data-label label")
                .attr("x", point.x)
                .attr("y", labelY + renderedLabelHeight / 2) // Vertically center text
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.colors.dataLabelTextContrastColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(labelText);
        });
    }
    
    // placeLabelsDP: Dynamic Programming Label Placement (Simplified and adapted)
    function placeLabelsDPInternal(points, chartH, labelPixelHeight) {
        const GRID_SIZE_PX = 3; // Each grid cell is 3px high
        const PROTECTION_RADIUS_GRID_UNITS = 3; // Protect 3 grid cells around data point
        const LABEL_HEIGHT_GRID_UNITS = Math.ceil(labelPixelHeight / GRID_SIZE_PX);

        const minY = 0;
        const maxY = chartH;
        const gridCount = Math.ceil((maxY - minY) / GRID_SIZE_PX);

        points.sort((a, b) => a.y - b.y); // Sort by Y-coordinate of data point

        const occupied = new Array(gridCount).fill(false);
        points.forEach(point => {
            const pointGridY = Math.floor(point.y / GRID_SIZE_PX);
            for (let i = Math.max(0, pointGridY - PROTECTION_RADIUS_GRID_UNITS); 
                 i <= Math.min(gridCount - 1, pointGridY + PROTECTION_RADIUS_GRID_UNITS); i++) {
                occupied[i] = true;
            }
        });

        const n = points.length;
        if (n === 0) return [];
        
        const dp = Array(n).fill(null).map(() => Array(gridCount).fill(Infinity));
        const prev = Array(n).fill(null).map(() => Array(gridCount).fill(-1));

        // Initial condition for the first point
        const firstPointGridY = Math.floor(points[0].y / GRID_SIZE_PX);
        for (let j = 0; j < gridCount; j++) { // j is potential top grid cell for label
            if (j + LABEL_HEIGHT_GRID_UNITS > gridCount) continue; // Label doesn't fit

            let canPlace = true;
            for (let k = 0; k < LABEL_HEIGHT_GRID_UNITS; k++) {
                if (occupied[j + k]) { canPlace = false; break; }
            }
            if (canPlace) {
                dp[0][j] = Math.abs(j - firstPointGridY); // Cost is distance from data point's Y
            }
        }

        // Fill DP table
        for (let i = 1; i < n; i++) {
            const pointGridY = Math.floor(points[i].y / GRID_SIZE_PX);
            for (let j = 0; j < gridCount; j++) { // Current label's top grid cell
                if (j + LABEL_HEIGHT_GRID_UNITS > gridCount) continue;

                let canPlaceCurrent = true;
                for (let k = 0; k < LABEL_HEIGHT_GRID_UNITS; k++) {
                    if (occupied[j + k]) { canPlaceCurrent = false; break; }
                }
                if (!canPlaceCurrent) continue;

                for (let k_prev = 0; k_prev < gridCount; k_prev++) { // Previous label's top grid cell
                    if (dp[i-1][k_prev] === Infinity) continue;
                    // Ensure no overlap: current label (j to j+LH-1) must not overlap prev label (k_prev to k_prev+LH-1)
                    // This is implicitly handled if labels are sorted by Y and placed one after another without overlap.
                    // The critical constraint is that current label must be below previous label: j >= k_prev + LABEL_HEIGHT_GRID_UNITS
                    if (j < k_prev + LABEL_HEIGHT_GRID_UNITS) continue;


                    const cost = Math.abs(j - pointGridY);
                    if (dp[i-1][k_prev] + cost < dp[i][j]) {
                        dp[i][j] = dp[i-1][k_prev] + cost;
                        prev[i][j] = k_prev;
                    }
                }
            }
        }

        let minCost = Infinity;
        let bestLastPos = -1;
        for (let j = 0; j < gridCount; j++) {
            if (dp[n-1][j] < minCost) {
                minCost = dp[n-1][j];
                bestLastPos = j;
            }
        }

        const finalPositions = [];
        if (bestLastPos !== -1) {
            let currentPos = bestLastPos;
            for (let i = n - 1; i >= 0; i--) {
                finalPositions.unshift({ point: points[i], labelY: currentPos * GRID_SIZE_PX });
                currentPos = prev[i][currentPos];
            }
        } else { // Fallback: simple greedy placement if DP fails
            let lastLabelBottomY = -Infinity;
            points.forEach(point => {
                let targetY = Math.max(point.y + 5, lastLabelBottomY + 2); // Try below point, or below last label
                targetY = Math.min(targetY, chartH - labelPixelHeight); // Don't go off chart
                targetY = Math.max(0, targetY); // Don't go above chart
                finalPositions.push({ point: point, labelY: targetY });
                lastLabelBottomY = targetY + labelPixelHeight;
            });
        }
        return finalPositions;
    }

    if (variables.showDataLabels !== false) { // Default to true or if var undefined
        const startLabelPlacements = placeLabelsDPInternal(pointsForLabelling.start, innerHeight, renderedLabelHeight);
        const middleLabelPlacements = placeLabelsDPInternal(pointsForLabelling.middle, innerHeight, renderedLabelHeight);
        const endLabelPlacements = placeLabelsDPInternal(pointsForLabelling.end, innerHeight, renderedLabelHeight);

        drawLabelsInternal(startLabelPlacements);
        drawLabelsInternal(middleLabelPlacements);
        drawLabelsInternal(endLabelPlacements);
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}