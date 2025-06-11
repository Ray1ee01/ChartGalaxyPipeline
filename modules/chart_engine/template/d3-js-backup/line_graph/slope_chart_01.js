/* REQUIREMENTS_BEGIN
{
  "chart_type": "Slope Chart",
  "chart_name": "slope_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], ["-inf", "inf"], [2, 6]],
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
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    const imagesConfig = data.images || {}; // Not used in this chart, but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    const missingFields = [];
    if (!xFieldConfig) missingFields.push("x role");
    if (!yFieldConfig) missingFields.push("y role");
    if (!groupFieldConfig) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: Role(s) ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    if (!chartDataArray || chartDataArray.length === 0) {
        const errorMsg = "Chart data is empty. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    // Filter out data points with undefined/null critical fields to prevent scale errors
    chartDataArray = chartDataArray.filter(d => 
        d[xFieldName] != null && d[yFieldName] != null && d[groupFieldName] != null
    );

    if (chartDataArray.length === 0) {
        const errorMsg = "All data points have missing critical fields after filtering. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            axisLabelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            axisLabelFontSize: typographyConfig.label?.font_size || '12px',
            axisLabelFontWeight: typographyConfig.label?.font_weight || 'normal',
            dataLabelFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            dataLabelFontSize: typographyConfig.annotation?.font_size || '11px',
            dataLabelFontWeight: typographyConfig.annotation?.font_weight || 'bold',
            legendLabelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            legendLabelFontSize: typographyConfig.label?.font_size || '12px',
            legendLabelFontWeight: typographyConfig.label?.font_weight || 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        gridLineColor: colorsConfig.other?.grid || '#e0e0e0',
        axisLineColor: colorsConfig.other?.axis || '#888888',
        chartBackground: colorsConfig.background_color || 'transparent', // Use transparent if no background needed
        defaultLineColor: colorsConfig.other?.primary || '#007bff',
        labelTextContrastColor: '#FFFFFF', // Assuming labels on colored backgrounds
        lineStrokeWidth: chartConfig.lineStrokeWidth || 3,
    };

    fillStyle.getGroupColor = (groupValue) => {
        if (colorsConfig.field && colorsConfig.field[groupFieldName] && colorsConfig.field[groupFieldName][groupValue]) {
            return colorsConfig.field[groupFieldName][groupValue];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
            const index = groups.indexOf(groupValue);
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
        const index = groups.indexOf(groupValue);
        return d3.schemeCategory10[index % d3.schemeCategory10.length];
    };
    
    // Helper: Parse date (robustly handles various inputs)
    function parseDate(dateStr) {
        if (dateStr instanceof Date) return dateStr;
        const parsed = new Date(dateStr);
        if (!isNaN(parsed)) return parsed;
        // Try common date formats if direct parsing fails (e.g., "YYYY-MM-DD", "MM/DD/YYYY")
        // This is a simplified example; a more robust solution might use a library like moment.js or date-fns
        // For now, rely on Date.parse() behavior.
        return new Date(Date.parse(dateStr)); // Fallback to Date.parse
    }

    // Helper: In-memory text measurement (Not strictly needed for this chart's layout, but good practice)
    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontProps.fontFamily || 'Arial, sans-serif');
        textNode.setAttribute('font-size', fontProps.fontSize || '12px');
        textNode.setAttribute('font-weight', fontProps.fontWeight || 'normal');
        textNode.textContent = text;
        svg.appendChild(textNode);
        // Note: Appending to body and then removing is more reliable for getBBox if not using a canvas fallback.
        // However, for strict adherence to "MUST NOT be appended to the document DOM", we rely on direct getBBox.
        // This might be less accurate in some browsers without rendering.
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached SVG fails (e.g. JSDOM)
            // A simple approximation:
            width = text.length * (parseInt(fontProps.fontSize, 10) || 12) * 0.6;
            console.warn("estimateTextWidth: getBBox failed, using approximation.", e);
        }
        return width;
    }

    // Helper: Create X-axis scale and ticks (Simplified version)
    function createXAxisScaleAndTicks(data, field, rangeMin, rangeMax) {
        const dates = data.map(d => parseDate(d[field])).sort((a, b) => a - b);
        const xScale = d3.scaleTime()
            .domain(d3.extent(dates))
            .range([rangeMin, rangeMax]);

        let xTicks;
        const uniqueDates = [...new Set(dates.map(d => d.getTime()))].map(t => new Date(t));
        
        if (uniqueDates.length <= 10) {
            xTicks = uniqueDates;
        } else {
            xTicks = xScale.ticks(d3.timeYear.every(1) || 5); // Sensible default ticks
        }

        const xFormat = d3.timeFormat("%Y"); // Default format, can be made more dynamic
        return { xScale, xTicks, xFormat };
    }

    // Helper: Layout legend (Simplified version)
    function layoutLegend(legendGroup, groupNames, config) {
        const { x, y, align, maxWidth, shape } = config;
        const itemHeight = 20;
        const itemSpacing = 5;
        const shapeSize = 10;
        const textPadding = 5;
        let currentX = x;
        let currentY = y;
        let legendWidth = 0;
        let legendHeight = 0;

        const items = groupNames.map(name => {
            const g = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${currentY})`);

            if (shape === "line") {
                g.append("line")
                    .attr("class", "mark legend-mark")
                    .attr("x1", 0)
                    .attr("y1", shapeSize / 2)
                    .attr("x2", shapeSize * 2)
                    .attr("y2", shapeSize / 2)
                    .attr("stroke", fillStyle.getGroupColor(name))
                    .attr("stroke-width", fillStyle.lineStrokeWidth);
            } else { // default to rect
                g.append("rect")
                    .attr("class", "mark legend-mark")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", shapeSize)
                    .attr("height", shapeSize)
                    .attr("fill", fillStyle.getGroupColor(name));
            }

            const textElement = g.append("text")
                .attr("class", "label legend-label")
                .attr("x", (shape === "line" ? shapeSize * 2 : shapeSize) + textPadding)
                .attr("y", shapeSize / 2)
                .attr("dy", "0.35em")
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.legendLabelFontFamily)
                .style("font-size", fillStyle.typography.legendLabelFontSize)
                .style("font-weight", fillStyle.typography.legendLabelFontWeight)
                .text(name);
            
            const itemWidth = (shape === "line" ? shapeSize * 2 : shapeSize) + textPadding + estimateTextWidth(name, {
                fontFamily: fillStyle.typography.legendLabelFontFamily,
                fontSize: fillStyle.typography.legendLabelFontSize,
                fontWeight: fillStyle.typography.legendLabelFontWeight
            });

            if (currentX + itemWidth > x + maxWidth && currentX > x) { // new row
                currentX = x;
                currentY += itemHeight + itemSpacing;
                g.attr("transform", `translate(${currentX}, ${currentY})`);
            }
            currentX += itemWidth + itemSpacing * 2;
            legendWidth = Math.max(legendWidth, currentX - x);
            legendHeight = Math.max(legendHeight, currentY + itemHeight - y);
            return { g, width: itemWidth };
        });
        
        if (align === 'center' && legendWidth < maxWidth) {
             const totalRowWidth = items.reduce((sum, item, i) => {
                if (items[i-1] && items[i-1].g.attr("transform").split(',')[1] !== item.g.attr("transform").split(',')[1]) { // new row
                    return item.width;
                }
                return sum + item.width + (i > 0 ? itemSpacing * 2 : 0);
            },0); // This needs to be smarter for multi-row centered legends
            // For simplicity, we'll center the whole block if it's single row or roughly estimate.
            const offsetX = (maxWidth - legendWidth) / 2;
            legendGroup.selectAll(".legend-item").attr("transform", function() {
                const currentTransform = d3.select(this).attr("transform");
                const parts = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
                return `translate(${parseFloat(parts[1]) + offsetX}, ${parts[2]})`;
            });
        }

        return { width: legendWidth, height: legendHeight };
    }
    
    // Helper: placeLabelsDP (Dynamic Programming for label placement)
    // This is a complex helper. For brevity in this refactoring, its internal logic is kept largely as-is,
    // but debug drawing is removed and styling should use fillStyle if any visual elements were part of it.
    function placeLabelsDP(points, chartHeight) {
        const GRID_SIZE = 3;
        const PROTECTION_RADIUS_POINTS = 3; // Radius around data points
        const LABEL_HEIGHT_GRID_UNITS = Math.ceil( (parseFloat(fillStyle.typography.dataLabelFontSize) + 8) / GRID_SIZE); // Approx label height in grid units

        const minY = 0;
        const maxY = chartHeight;
        const gridCount = Math.ceil((maxY - minY) / GRID_SIZE);

        points.sort((a, b) => a.y - b.y);

        const occupied = new Array(gridCount).fill(false);
        points.forEach(point => {
            const gridY = Math.floor(point.y / GRID_SIZE);
            for (let i = Math.max(0, gridY - PROTECTION_RADIUS_POINTS); i <= Math.min(gridCount - 1, gridY + PROTECTION_RADIUS_POINTS); i++) {
                occupied[i] = true;
            }
        });

        const n = points.length;
        const dp = Array(n).fill(null).map(() => Array(gridCount).fill(Infinity));
        const prev = Array(n).fill(null).map(() => Array(gridCount).fill(-1));

        // First point
        const firstPointGridY = Math.floor(points[0].y / GRID_SIZE);
        for (let j = 0; j < gridCount; j++) {
            if (j + LABEL_HEIGHT_GRID_UNITS <= gridCount) {
                let canPlace = true;
                for (let k = 0; k < LABEL_HEIGHT_GRID_UNITS; k++) {
                    if (occupied[j + k]) { canPlace = false; break; }
                }
                if (canPlace) {
                    dp[0][j] = Math.abs(j - firstPointGridY);
                }
            }
        }

        // Fill DP table
        for (let i = 1; i < n; i++) {
            const pointGridY = Math.floor(points[i].y / GRID_SIZE);
            for (let j = 0; j < gridCount; j++) {
                if (j + LABEL_HEIGHT_GRID_UNITS <= gridCount) {
                    let canPlaceCurrent = true;
                    for (let k = 0; k < LABEL_HEIGHT_GRID_UNITS; k++) {
                        if (occupied[j + k]) { canPlaceCurrent = false; break; }
                    }
                    if (canPlaceCurrent) {
                        for (let k_prev = 0; k_prev < gridCount; k_prev++) {
                            if (dp[i-1][k_prev] !== Infinity && (k_prev + LABEL_HEIGHT_GRID_UNITS <= j || j + LABEL_HEIGHT_GRID_UNITS <= k_prev)) { // No overlap
                                const cost = Math.abs(j - pointGridY);
                                if (dp[i-1][k_prev] + cost < dp[i][j]) {
                                    dp[i][j] = dp[i-1][k_prev] + cost;
                                    prev[i][j] = k_prev;
                                }
                            }
                        }
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

        const labelPositions = [];
        if (bestLastPos !== -1) {
            let currentPos = bestLastPos;
            for (let i = n - 1; i >= 0; i--) {
                labelPositions.unshift({ point: points[i], labelY: currentPos * GRID_SIZE });
                currentPos = prev[i][currentPos];
                 if (currentPos === -1 && i > 0) { // Should not happen if solution found
                    console.warn("Label placement DP: Lost track in backtracking.");
                    // Fallback for this point if backtracking fails mid-way
                    labelPositions[0].labelY = Math.max(0, Math.min(chartHeight - LABEL_HEIGHT_GRID_UNITS * GRID_SIZE, points[i].y - (LABEL_HEIGHT_GRID_UNITS * GRID_SIZE / 2)));
                 }
            }
        } else { // Fallback if DP fails
            console.warn("Label placement DP: No solution found, using simple fallback.");
            let lastY = 0;
            points.forEach(point => {
                const idealY = point.y - (LABEL_HEIGHT_GRID_UNITS * GRID_SIZE / 2);
                const labelY = Math.max(lastY, idealY);
                labelPositions.push({ point: point, labelY: Math.min(labelY, chartHeight - LABEL_HEIGHT_GRID_UNITS * GRID_SIZE) });
                lastY = labelY + LABEL_HEIGHT_GRID_UNITS * GRID_SIZE;
            });
        }
        return labelPositions;
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: chartConfig.marginTop || 60, 
        right: chartConfig.marginRight || 60, // Increased for end labels
        bottom: chartConfig.marginBottom || 50, 
        left: chartConfig.marginLeft || 60 // Increased for start labels
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const uniqueGroups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    const groupedData = d3.group(chartDataArray, d => d[groupFieldName]);

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartDataArray, xFieldName, 0, innerWidth);

    const yMin = d3.min(chartDataArray, d => +d[yFieldName]);
    const yMax = d3.max(chartDataArray, d => +d[yFieldName]);
    const yPadding = (yMax - yMin) * 0.15 || 1; // Ensure padding even if min=max

    const yScale = d3.scaleLinear()
        .domain([Math.min(0, yMin - yPadding), yMax + yPadding]) // Ensure 0 is included if min is positive
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const yAxisTicks = yScale.ticks(5);

    // Y-Axis Gridlines
    const yGridlinesGroup = mainChartGroup.append("g")
        .attr("class", "gridlines y-gridlines");
    
    yAxisTicks.forEach(tick => {
        yGridlinesGroup.append("line")
            .attr("class", "gridline y-gridline")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", innerWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 0.5);
    });
    
    // Add mid-point gridlines if desired (original had this)
    if (yAxisTicks.length > 1) {
        for (let i = 0; i < yAxisTicks.length - 1; i++) {
            const midValue = (yAxisTicks[i] + yAxisTicks[i+1]) / 2;
            yGridlinesGroup.append("line")
                .attr("class", "gridline y-gridline minor")
                .attr("x1", 0)
                .attr("y1", yScale(midValue))
                .attr("x2", innerWidth)
                .attr("y2", yScale(midValue))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-dasharray", "2,2")
                .attr("stroke-width", 0.5);
        }
    }

    // Y-Axis Labels
    const yAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis-labels");

    yAxisTicks.forEach(tick => {
        yAxisLabelsGroup.append("text")
            .attr("class", "axis-label y-axis-label value")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .text(Math.round(tick));
    });

    // X-Axis Ticks & Labels
    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis-labels")
        .attr("transform", `translate(0, ${innerHeight})`);

    xTicks.forEach(tick => {
        xAxisLabelsGroup.append("text")
            .attr("class", "axis-label x-axis-label")
            .attr("x", xScale(tick))
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .text(xFormat(tick));
    });

    // X-Axis Line
    mainChartGroup.append("line")
        .attr("class", "axis-line x-axis-line")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Legend
    const legendGroup = mainChartGroup.append("g")
        .attr("class", "legend chart-legend");
    
    const legendConfig = {
        x: 0,
        y: 0, // Will be repositioned
        align: "center",
        maxWidth: innerWidth,
        shape: "line",
    };
    const legendSize = layoutLegend(legendGroup, uniqueGroups, legendConfig);
    
    // Position legend above chart, centered
    const legendYPosition = -(chartMargins.top / 2) - (legendSize.height / 2) + 10; // Adjust for better spacing
    legendGroup.attr("transform", `translate(${(innerWidth - legendSize.width) / 2}, ${legendYPosition})`);


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const lineGenerator = d3.line()
        .x(d => xScale(parseDate(d[xFieldName])))
        .y(d => yScale(+d[yFieldName]))
        .curve(d3.curveLinear);

    const startLabelPoints = [];
    const endLabelPoints = [];

    groupedData.forEach((values, group) => {
        values.sort((a, b) => parseDate(a[xFieldName]) - parseDate(b[xFieldName]));
        
        if (values.length < 2) {
            console.warn(`Group ${group} has less than 2 points, cannot draw slope line.`);
            return;
        }

        const firstPoint = values[0];
        const lastPoint = values[values.length - 1];
        const slopeData = [firstPoint, lastPoint];
        const groupColor = fillStyle.getGroupColor(group);

        mainChartGroup.append("path")
            .datum(slopeData)
            .attr("class", "mark line slope-line")
            .attr("fill", "none")
            .attr("stroke", groupColor)
            .attr("stroke-width", fillStyle.lineStrokeWidth)
            .attr("d", lineGenerator);

        startLabelPoints.push({
            x: xScale(parseDate(firstPoint[xFieldName])),
            y: yScale(+firstPoint[yFieldName]),
            value: Math.round(+firstPoint[yFieldName]),
            color: groupColor,
            group: group,
            originalPoint: firstPoint,
            side: 'start'
        });

        endLabelPoints.push({
            x: xScale(parseDate(lastPoint[xFieldName])),
            y: yScale(+lastPoint[yFieldName]),
            value: Math.round(+lastPoint[yFieldName]),
            color: groupColor,
            group: group,
            originalPoint: lastPoint,
            side: 'end'
        });
    });

    function drawDataLabels(labelPlacements, isStartLabel) {
        const labelGroup = mainChartGroup.append("g")
            .attr("class", `data-labels ${isStartLabel ? 'start-labels' : 'end-labels'}`);

        labelPlacements.forEach(placement => {
            const point = placement.point;
            const labelY = placement.labelY;
            const labelText = String(point.value);
            
            const textMetrics = estimateTextWidth(labelText, {
                fontFamily: fillStyle.typography.dataLabelFontFamily,
                fontSize: fillStyle.typography.dataLabelFontSize,
                fontWeight: fillStyle.typography.dataLabelFontWeight
            });
            const labelWidth = textMetrics + 10; // Padding
            const labelHeight = parseFloat(fillStyle.typography.dataLabelFontSize) + 8; // Padding

            const rectX = isStartLabel ? point.x - labelWidth - 5 : point.x + 5;
            const textX = isStartLabel ? point.x - labelWidth/2 - 5 : point.x + labelWidth/2 + 5;
            
            labelGroup.append("rect")
                .attr("class", "data-label-bg mark")
                .attr("x", rectX)
                .attr("y", labelY - labelHeight / 2)
                .attr("width", labelWidth)
                .attr("height", labelHeight)
                .attr("rx", 3)
                .attr("ry", 3)
                .attr("fill", point.color);
            
            labelGroup.append("text")
                .attr("class", "data-label-text value")
                .attr("x", textX)
                .attr("y", labelY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.labelTextContrastColor)
                .style("font-family", fillStyle.typography.dataLabelFontFamily)
                .style("font-size", fillStyle.typography.dataLabelFontSize)
                .style("font-weight", fillStyle.typography.dataLabelFontWeight)
                .text(labelText);
        });
    }
    
    if (startLabelPoints.length > 0) {
        const startLabelPositions = placeLabelsDP(startLabelPoints, innerHeight);
        drawDataLabels(startLabelPositions, true);
    }
    if (endLabelPoints.length > 0) {
        const endLabelPositions = placeLabelsDP(endLabelPoints, innerHeight);
        drawDataLabels(endLabelPositions, false);
    }


    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements)
    // None in this refactored version beyond the label placement.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}