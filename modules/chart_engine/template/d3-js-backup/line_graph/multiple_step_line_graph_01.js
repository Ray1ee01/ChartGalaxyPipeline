/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Step Line Graph",
  "chart_name": "multiple_step_line_graph_01",
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
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or colors_dark would be handled by caller
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldCol = dataColumns.find(col => col.role === 'x');
    const yFieldCol = dataColumns.find(col => col.role === 'y');
    const groupFieldCol = dataColumns.find(col => col.role === 'group');

    if (!xFieldCol || !yFieldCol || !groupFieldCol) {
        const missing = [
            !xFieldCol ? "x role" : null,
            !yFieldCol ? "y role" : null,
            !groupFieldCol ? "group role" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: column roles [${missing}] not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const groupFieldName = groupFieldCol.name;

    // Filter out data points with undefined/null critical fields
    const chartDataArray = rawChartData.filter(d => 
        d[xFieldName] !== undefined && d[xFieldName] !== null &&
        d[yFieldName] !== undefined && d[yFieldName] !== null &&
        d[groupFieldName] !== undefined && d[groupFieldName] !== null
    );
    
    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points to render after filtering.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) || '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) || 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '14px', // Original used 14px
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            labelFontWeightBold: (typography.label && typography.label.font_weight_bold) || 'bold', // For data labels
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
        },
        textColor: colors.text_color || '#333333',
        chartBackground: colors.background_color || '#FFFFFF',
        gridLineColor: (colors.other && colors.other.gridColor) || '#DDDDDD',
        axisLineColor: (colors.other && colors.other.axisColor) || '#AAAAAA',
        defaultLineColor: (colors.other && colors.other.primary) || '#1f77b4',
        getGroupColor: (groupName, groupIndex) => {
            if (colors.field && colors.field[groupName]) {
                return colors.field[groupName];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[groupIndex % colors.available_colors.length];
            }
            return d3.schemeCategory10[groupIndex % 10]; // Fallback to D3 scheme
        }
    };
    
    // Helper: Text width estimation
    function estimateTextWidth(text, fontPropsKey = 'label') {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontStyle = fillStyle.typography[fontPropsKey] || fillStyle.typography.label;
        context.font = `${fontStyle.labelFontWeight || 'normal'} ${fontStyle.labelFontSize || '12px'} ${fontStyle.labelFontFamily || 'Arial'}`;
        if (fontPropsKey === 'dataLabel') { // Special handling for bold data labels
             context.font = `${fillStyle.typography.labelFontWeightBold} ${fillStyle.typography.labelFontSize} ${fillStyle.typography.labelFontFamily}`;
        }
        return context.measureText(text).width;
    }

    // Helper: Date parsing (robustly handles Date objects or ISO strings)
    function parseDate(dateValue) {
        if (dateValue instanceof Date) {
            return dateValue;
        }
        return d3.isoParse(dateValue);
    }

    // Helper: Value formatting
    function formatValue(value) {
        return Math.round(value).toString();
    }
    
    // Helper: X-axis scale and ticks
    function createXAxisScaleAndTicks(data, xAccessor, minRange, maxRange) {
        const dates = data.map(xAccessor).filter(d => d !== null).sort(d3.ascending);
        if (dates.length === 0) {
            // Fallback if no valid dates
            const now = new Date();
            const xScale = d3.scaleTime().domain([now, d3.timeDay.offset(now, 1)]).range([minRange, maxRange]);
            return { xScale, xTicks: xScale.ticks(5), xFormat: d3.timeFormat("%H:%M"), timeSpan: oneDay };
        }

        const xScale = d3.scaleTime()
            .domain(d3.extent(dates))
            .range([minRange, maxRange]);

        let ticks, format;
        const duration = xScale.domain()[1] - xScale.domain()[0];
        const oneHour = 3600000;
        const oneDay = 86400000;

        if (duration < oneDay * 2) { 
            ticks = xScale.ticks(d3.timeHour.every(Math.max(1, Math.floor(duration / oneHour / 6 )))); // at most 6 ticks
            format = d3.timeFormat("%H:%M");
        } else if (duration < oneDay * 60) { 
            const numDays = duration / oneDay;
            ticks = xScale.ticks(d3.timeDay.every(Math.max(1, Math.ceil(numDays / 10))));
            format = d3.timeFormat("%b %d");
        } else if (duration < oneDay * 365 * 2) { 
            const numMonths = duration / (oneDay * 30.44); // Avg days per month
            ticks = xScale.ticks(d3.timeMonth.every(Math.max(1, Math.ceil(numMonths / 12))));
            format = d3.timeFormat("%b '%y");
        } else {
            const numYears = duration / (oneDay * 365.25);
            ticks = xScale.ticks(d3.timeYear.every(Math.max(1, Math.ceil(numYears / 10))));
            format = d3.timeFormat("%Y");
        }
        return { xScale, xTicks: ticks, xFormat: format, timeSpan: duration };
    }

    // Helper: Legend layout
    function layoutLegend(legendContainer, groupNames, colorAccessor, typographyStyle, itemShape = "line", itemSize = 15, padding = 5, maxLegendWidth) {
        legendContainer.selectAll("*").remove(); // Clear previous legend items

        const legendItems = legendContainer.selectAll(".legend-item")
            .data(groupNames)
            .join("g")
            .attr("class", "legend-item");

        let currentX = 0;
        let currentY = 0;
        let rowMaxItemHeight = 0;
        const itemPadding = padding * 2; // Padding between items

        legendItems.each(function(d, i) {
            const itemGroup = d3.select(this);
            const color = colorAccessor(d, i); // Pass index for default color schemes

            if (itemShape === "line") {
                itemGroup.append("line")
                    .attr("class", "legend-mark line-mark")
                    .attr("x1", 0)
                    .attr("y1", itemSize / 2)
                    .attr("x2", itemSize)
                    .attr("y2", itemSize / 2)
                    .attr("stroke", color)
                    .attr("stroke-width", 3); // Thicker line for legend
            } else { // rect (default)
                itemGroup.append("rect")
                    .attr("class", "legend-mark rect-mark")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", itemSize)
                    .attr("height", itemSize)
                    .attr("fill", color);
            }

            const textElement = itemGroup.append("text")
                .attr("class", "legend-label")
                .attr("x", itemSize + padding)
                .attr("y", itemSize / 2)
                .attr("dominant-baseline", "middle")
                .attr("fill", typographyStyle.textColor)
                .style("font-family", typographyStyle.labelFontFamily)
                .style("font-size", typographyStyle.labelFontSize)
                .style("font-weight", typographyStyle.labelFontWeightBold) // Legend text bold
                .text(d);
            
            const textWidth = estimateTextWidth(d, 'label'); // Use 'label' style for estimation, actual style applied above
            const itemWidth = itemSize + padding + textWidth;
            const itemHeight = Math.max(itemSize, parseFloat(typographyStyle.labelFontSize));
            rowMaxItemHeight = Math.max(rowMaxItemHeight, itemHeight);

            if (currentX + itemWidth > maxLegendWidth && i > 0) { // Wrap if wider than max width
                currentX = 0;
                currentY += rowMaxItemHeight + padding;
                rowMaxItemHeight = itemHeight; // Reset for new row
            }
            itemGroup.attr("transform", `translate(${currentX}, ${currentY})`);
            currentX += itemWidth + itemPadding;
        });
        
        const bbox = legendContainer.node().getBBox();
        // If bbox height is 0 (e.g. no items or single row not fully wrapped), calculate based on rowMaxItemHeight
        const calculatedHeight = currentY + rowMaxItemHeight;
        return { width: bbox.width, height: (bbox.height > 0 ? bbox.height : calculatedHeight) };
    }

    // Helper: Dynamic Programming for Label Placement (simplified, no debug drawing)
    function placeLabelsDP(points, chartHeight, labelPixelHeight, labelPixelWidthFn) {
        const GRID_SIZE = 3; // pixels
        const PROTECTION_RADIUS_GRID = 3; // grid units around data point
        const LABEL_HEIGHT_GRID = Math.ceil(labelPixelHeight / GRID_SIZE);

        const minY = 0;
        const maxY = chartHeight;
        const gridCount = Math.ceil((maxY - minY) / GRID_SIZE);

        points.sort((a, b) => a.y - b.y); // Sort by Y to process top-to-bottom or vice-versa

        const occupied = new Array(gridCount).fill(false);
        points.forEach(point => {
            const pointGridY = Math.floor(point.y / GRID_SIZE);
            for (let i = Math.max(0, pointGridY - PROTECTION_RADIUS_GRID); i <= Math.min(gridCount - 1, pointGridY + PROTECTION_RADIUS_GRID); i++) {
                occupied[i] = true; // Mark data point vicinity as occupied for labels
            }
        });

        const n = points.length;
        if (n === 0) return [];

        const dp = Array(n).fill(null).map(() => Array(gridCount).fill(Infinity));
        const prev = Array(n).fill(null).map(() => Array(gridCount).fill(-1));

        // Initialize for the first point
        const firstPointGridY = Math.floor(points[0].y / GRID_SIZE);
        for (let j = 0; j < gridCount; j++) {
            if (j + LABEL_HEIGHT_GRID > gridCount) continue; // Not enough space for label height
            let canPlace = true;
            for (let k = 0; k < LABEL_HEIGHT_GRID; k++) {
                if (occupied[j + k]) { canPlace = false; break; }
            }
            if (canPlace) {
                dp[0][j] = Math.abs(j - firstPointGridY); // Cost is distance from point's ideal Y
            }
        }

        // Fill DP table
        for (let i = 1; i < n; i++) {
            const pointGridY = Math.floor(points[i].y / GRID_SIZE);
            for (let j = 0; j < gridCount; j++) { // Current label's proposed top grid line
                if (j + LABEL_HEIGHT_GRID > gridCount) continue;
                let canPlaceCurrent = true;
                for (let k = 0; k < LABEL_HEIGHT_GRID; k++) {
                    if (occupied[j + k]) { canPlaceCurrent = false; break; }
                }
                if (!canPlaceCurrent) continue;

                for (let k = 0; k < gridCount; k++) { // Previous label's top grid line
                    if (dp[i-1][k] === Infinity) continue;
                    // Ensure labels don't overlap: current label (j to j+LH) must not overlap prev label (k to k+LH)
                    // This is implicitly handled if prev point is higher (y sorted) and prev label is higher (k < j - LH)
                    if (j < k + LABEL_HEIGHT_GRID && k < j + LABEL_HEIGHT_GRID) { // Overlap condition
                         // More sophisticated check: if points are far apart on X, Y overlap is fine.
                         // For now, assume strict Y non-overlap for simplicity if Ys are close.
                         // This DP assumes points are processed in an order (e.g. Y-sorted)
                         // and tries to place labels without them overlapping vertically.
                    }
                    
                    // A simpler non-overlap: ensure current label is below previous label's bottom
                    if (j >= k + LABEL_HEIGHT_GRID || k >= j + LABEL_HEIGHT_GRID) { // No vertical overlap
                        const cost = Math.abs(j - pointGridY);
                        if (dp[i-1][k] + cost < dp[i][j]) {
                            dp[i][j] = dp[i-1][k] + cost;
                            prev[i][j] = k;
                        }
                    } else if (points[i].x !== points[i-1].x) { // If different X positions, allow some overlap
                        const cost = Math.abs(j - pointGridY);
                        if (dp[i-1][k] + cost < dp[i][j]) {
                            dp[i][j] = dp[i-1][k] + cost;
                            prev[i][j] = k;
                        }
                    }
                }
            }
        }
        
        let minCost = Infinity;
        let lastBestPos = -1;
        for (let j = 0; j < gridCount; j++) {
            if (dp[n-1][j] < minCost) {
                minCost = dp[n-1][j];
                lastBestPos = j;
            }
        }

        const labelPlacements = [];
        if (lastBestPos !== -1) {
            let currentPos = lastBestPos;
            for (let i = n - 1; i >= 0; i--) {
                labelPlacements.unshift({ point: points[i], labelY: currentPos * GRID_SIZE });
                currentPos = prev[i][currentPos];
                if (currentPos === -1 && i > 0) { // Path broken, fallback for remaining
                    for (let k = i - 1; k >= 0; k--) {
                         labelPlacements.unshift({ point: points[k], labelY: points[k].y + 10 }); // Simple fallback
                    }
                    break;
                }
            }
        } else { // Fallback for all if no solution
            let lastY = 0;
            points.forEach((p, idx) => {
                let yPos = p.y + 10; // Default above point
                if (idx > 0) yPos = Math.max(yPos, lastY + labelPixelHeight);
                yPos = Math.min(yPos, chartHeight - labelPixelHeight);
                labelPlacements.push({ point: p, labelY: yPos });
                lastY = yPos;
            });
        }
        return labelPlacements;
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 60, left: 60 };
    // Adjust margins if legend is very tall, or for very small charts
    if (containerHeight < 400) chartMargins.top = 30;
    if (containerWidth < 400) chartMargins.left = 40;


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartDataArray.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]), // Ensure dates are parsed
        [yFieldName]: +d[yFieldName] // Ensure numbers are numbers
    })).sort((a,b) => a[xFieldName] - b[xFieldName]); // Sort globally by date for correct line progression

    const groupedData = d3.group(processedChartData, d => d[groupFieldName]);
    const uniqueGroups = Array.from(groupedData.keys()).sort(); // Sort groups for consistent color mapping

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(
        processedChartData, 
        d => d[xFieldName], 
        0, 
        innerWidth
    );

    const yMin = d3.min(processedChartData, d => d[yFieldName]);
    const yMax = d3.max(processedChartData, d => d[yFieldName]);
    const yPadding = (yMax - yMin) * 0.2; // Reduced padding slightly from original
    
    const yDomainMin = (yMin > 0 && yMin - yPadding < 0) ? 0 : (yMin - yPadding); // Try to keep 0 if positive data dips below with padding
    const yDomainMax = yMax + yPadding;

    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0]);

    const yAxisTicks = yScale.ticks(5); // Suggest 5 ticks

    // Block 7: Chart Component Rendering (Axes, Gridlines, Legend)
    // Y-Axis Gridlines
    const yGridlinesGroup = mainChartGroup.append("g").attr("class", "gridlines-y");
    yAxisTicks.forEach(tick => {
        yGridlinesGroup.append("line")
            .attr("class", "gridline")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", innerWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 0.5) // Thinner grid lines
            .attr("stroke-dasharray", tick === 0 ? "none" : "2,2"); // Dashed, solid for zero line
    });
    // Mid-tick gridlines (subtler)
    if (yAxisTicks.length > 1) {
        for (let i = 0; i < yAxisTicks.length - 1; i++) {
            const midValue = (yAxisTicks[i] + yAxisTicks[i+1]) / 2;
            yGridlinesGroup.append("line")
                .attr("class", "gridline minor")
                .attr("x1", 0)
                .attr("y1", yScale(midValue))
                .attr("x2", innerWidth)
                .attr("y2", yScale(midValue))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-opacity", 0.5)
                .attr("stroke-width", 0.5)
                .attr("stroke-dasharray", "1,3");
        }
    }

    // X-Axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickValues(xTicks).tickFormat(xFormat));
    
    xAxisGroup.select(".domain").attr("stroke", fillStyle.axisLineColor);
    xAxisGroup.selectAll(".tick line").attr("stroke", fillStyle.axisLineColor);
    xAxisGroup.selectAll(".tick text")
        .attr("class", "label")
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);

    // Y-Axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickValues(yAxisTicks).tickFormat(formatValue));

    yAxisGroup.select(".domain").attr("stroke", fillStyle.axisLineColor);
    yAxisGroup.selectAll(".tick line").attr("stroke", fillStyle.axisLineColor);
    yAxisGroup.selectAll(".tick text")
        .attr("class", "label")
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);

    // Legend
    const legendGroup = svgRoot.append("g") // Append to svgRoot for positioning above chart if needed
        .attr("class", "legend");
    
    const legendMaxHeight = chartMargins.top * 0.8; // Limit legend height
    const legendSize = layoutLegend(
        legendGroup, 
        uniqueGroups, 
        fillStyle.getGroupColor, 
        {...fillStyle.typography, textColor: fillStyle.textColor}, // Pass combined typography style
        "line", 
        15, // itemSize
        5,  // padding
        innerWidth // maxLegendWidth
    );

    // Position legend: centered above the chart area
    const legendX = chartMargins.left + (innerWidth - legendSize.width) / 2;
    const legendY = Math.max(5, chartMargins.top - legendSize.height - 10); // 10px padding below legend
    legendGroup.attr("transform", `translate(${legendX}, ${legendY})`);


    // Block 8: Main Data Visualization Rendering
    const lineStrokeWidth = variables.lineWidth || 3; // Original was 4, using 3 for a bit finer look

    const stepLineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveStepAfter);

    const linesGroup = mainChartGroup.append("g").attr("class", "lines-group");
    const allLabelPoints = []; // Collect points for labeling

    uniqueGroups.forEach((group, groupIndex) => {
        const groupData = groupedData.get(group).sort((a,b) => a[xFieldName] - b[xFieldName]); // Ensure sorted by X for line
        const groupColor = fillStyle.getGroupColor(group, groupIndex);

        linesGroup.append("path")
            .datum(groupData)
            .attr("class", "mark line step-line")
            .attr("fill", "none")
            .attr("stroke", groupColor)
            .attr("stroke-width", lineStrokeWidth)
            .attr("d", stepLineGenerator);

        // Collect points for labeling (start, middle, end of each segment)
        if (groupData.length > 0) {
            allLabelPoints.push({ x: xScale(groupData[0][xFieldName]), y: yScale(groupData[0][yFieldName]), value: groupData[0][yFieldName], color: groupColor, group: group, pointData: groupData[0] });
            if (groupData.length > 1) {
                allLabelPoints.push({ x: xScale(groupData[groupData.length-1][xFieldName]), y: yScale(groupData[groupData.length-1][yFieldName]), value: groupData[groupData.length-1][yFieldName], color: groupColor, group: group, pointData: groupData[groupData.length-1] });
            }
            if (groupData.length > 2) {
                 const midIndex = Math.floor(groupData.length / 2);
                 allLabelPoints.push({ x: xScale(groupData[midIndex][xFieldName]), y: yScale(groupData[midIndex][yFieldName]), value: groupData[midIndex][yFieldName], color: groupColor, group: group, pointData: groupData[midIndex] });
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing (Data Labels)
    const dataLabelsGroup = mainChartGroup.append("g").attr("class", "data-labels-group");
    
    const labelPixelHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.5; // Approx height for one line of text
    const labelPlacements = placeLabelsDP(
        allLabelPoints, 
        innerHeight, 
        labelPixelHeight,
        (text) => estimateTextWidth(text, 'dataLabel') // Pass function to estimate width
    );

    labelPlacements.forEach(placement => {
        const point = placement.point;
        const labelY = placement.labelY; // This is the top of the label area from DP
        const labelText = formatValue(point.value);
        
        const textMetrics = { 
            font_family: fillStyle.typography.labelFontFamily, 
            font_size: fillStyle.typography.labelFontSize,
            font_weight: fillStyle.typography.labelFontWeightBold
        };
        const labelTextWidth = estimateTextWidth(labelText, textMetrics);
        const labelPadding = 4;
        const rectWidth = labelTextWidth + labelPadding * 2;
        const rectHeight = labelPixelHeight; // Use calculated pixel height

        // Add background rect for label
        dataLabelsGroup.append("rect")
            .attr("class", "data-label-box")
            .attr("x", point.x - rectWidth / 2)
            .attr("y", labelY)
            .attr("width", rectWidth)
            .attr("height", rectHeight)
            // .attr("rx", 3) // Removed rounded corners per spec V.2
            // .attr("ry", 3)
            .attr("fill", point.color)
            .attr("opacity", 0.9);

        // Add label text
        dataLabelsGroup.append("text")
            .attr("class", "data-label-text label")
            .attr("x", point.x)
            .attr("y", labelY + rectHeight / 2) // Vertically center text in rect
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#FFFFFF") // White text for contrast on colored background
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeightBold)
            .text(labelText);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}