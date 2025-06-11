/* REQUIREMENTS_BEGIN
{
  "chart_type": "Line Graph",
  "chart_name": "line_graph_01",
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
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via colors_dark
    const images = data.images || {}; // Though not used in this specific chart
    const dataColumns = data.data?.columns || [];

    const xFieldRole = dataColumns.find(col => col.role === "x");
    const yFieldRole = dataColumns.find(col => col.role === "y");
    const groupFieldRole = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldRole?.name;
    const yFieldName = yFieldRole?.name;
    const groupFieldName = groupFieldRole?.name;

    const criticalFields = { xFieldName, yFieldName, groupFieldName };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {}
    };

    // Typography
    fillStyle.typography.defaultFontFamily = 'Arial, sans-serif';
    fillStyle.typography.titleFontFamily = typography.title?.font_family || fillStyle.typography.defaultFontFamily;
    fillStyle.typography.titleFontSize = typography.title?.font_size || '16px';
    fillStyle.typography.titleFontWeight = typography.title?.font_weight || 'bold';

    fillStyle.typography.labelFontFamily = typography.label?.font_family || fillStyle.typography.defaultFontFamily;
    fillStyle.typography.labelFontSize = typography.label?.font_size || '12px';
    fillStyle.typography.labelFontWeight = typography.label?.font_weight || 'normal';

    fillStyle.typography.annotationFontFamily = typography.annotation?.font_family || fillStyle.typography.defaultFontFamily;
    fillStyle.typography.annotationFontSize = typography.annotation?.font_size || '10px';
    fillStyle.typography.annotationFontWeight = typography.annotation?.font_weight || 'normal';
    
    // Specific application of typography tokens
    fillStyle.typography.axisLabelFontFamily = fillStyle.typography.labelFontFamily;
    fillStyle.typography.axisLabelFontSize = fillStyle.typography.labelFontSize;
    fillStyle.typography.axisLabelFontWeight = fillStyle.typography.labelFontWeight;

    fillStyle.typography.dataLabelFontFamily = fillStyle.typography.annotationFontFamily;
    fillStyle.typography.dataLabelFontSize = fillStyle.typography.annotationFontSize; // Original used 14px, spec implies annotation
    fillStyle.typography.dataLabelFontWeight = 'bold'; // Original used bold, overriding annotation default

    fillStyle.typography.legendLabelFontFamily = fillStyle.typography.labelFontFamily;
    fillStyle.typography.legendLabelFontSize = fillStyle.typography.labelFontSize; // Original used 14px
    fillStyle.typography.legendLabelFontWeight = 'bold'; // Original used bold

    // Colors
    fillStyle.chartBackground = colors.background_color || '#FFFFFF';
    fillStyle.textColor = colors.text_color || '#0f223b';
    fillStyle.gridLineColor = colors.other?.gridLine || '#DDDDDD';
    fillStyle.axisLineColor = colors.other?.axisLine || '#AAAAAA';
    fillStyle.labelTextContrastColor = '#FFFFFF'; // For text on colored backgrounds

    const defaultColorPalette = d3.schemeCategory10;
    let colorIndex = 0;
    const assignedGroupColors = {};

    fillStyle.lineColor = (groupName) => {
        if (colors.field && colors.field[groupName]) {
            return colors.field[groupName];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            if (!assignedGroupColors[groupName]) {
                 assignedGroupColors[groupName] = colors.available_colors[colorIndex % colors.available_colors.length];
                 colorIndex++;
            }
            return assignedGroupColors[groupName];
        }
        if (!assignedGroupColors[groupName]) {
            assignedGroupColors[groupName] = defaultColorPalette[colorIndex % defaultColorPalette.length];
            colorIndex++;
        }
        return assignedGroupColors[groupName];
    };
    
    fillStyle.labelBackgroundColor = (groupName) => fillStyle.lineColor(groupName);


    function estimateTextWidth(text, fontProps) {
        const defaultFP = {
            fontFamily: fillStyle.typography.defaultFontFamily,
            fontSize: '12px',
            fontWeight: 'normal'
        };
        const fp = {...defaultFP, ...fontProps};
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fp.fontFamily);
        textElement.setAttribute('font-size', fp.fontSize);
        textElement.setAttribute('font-weight', fp.fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but against spec.
        // This in-memory method might be less accurate for some browsers/fonts.
        // For robustness if this fails, one might need to briefly append to DOM.
        // However, adhering strictly to "MUST NOT be appended to the document DOM".
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback if getBBox is not available or fails in this context
            return (text || '').length * (parseInt(fp.fontSize) * 0.6);
        }
    }

    function parseDateInternal(dateValue) {
        if (dateValue instanceof Date && !isNaN(dateValue)) return dateValue;
        if (typeof dateValue === 'number') { // Assume timestamp
             const d = new Date(dateValue);
             if (!isNaN(d)) return d;
        }
        if (typeof dateValue === 'string') {
            let date = d3.isoParse(dateValue);
            if (date) return date;
            date = new Date(dateValue);
            if (!isNaN(date)) return date;
        }
        return null;
    }

    function formatValueInternal(value) {
        if (typeof value === 'number') {
            return Math.round(value).toString();
        }
        return value ? value.toString() : "";
    }
    
    // Integrated X-axis scale and ticks creation logic
    function createXAxisScaleAndTicksHelper(data, xName, width, parseFunc) {
        const xValues = data.map(d => parseFunc(d[xName])).filter(d => d !== null);
        if (xValues.length === 0) {
            // Fallback if no valid dates
            const now = new Date();
            const then = new Date(now.getTime() - (24*60*60*1000)); // 1 day ago
            return {
                xScale: d3.scaleTime().domain([then, now]).range([0, width]),
                xTicks: [then, now],
                xFormat: d3.timeFormat("%H:%M")
            };
        }

        const xDomain = d3.extent(xValues);
        const xScale = d3.scaleTime().domain(xDomain).range([0, width]);
    
        let xTicks, xFormat;
        const timeSpanDays = (xDomain[1] - xDomain[0]) / (1000 * 60 * 60 * 24);
    
        const numTicksTarget = Math.max(2, Math.min(7, Math.floor(width / 100))); // Aim for a reasonable number of ticks
        xTicks = xScale.ticks(numTicksTarget);
    
        if (xTicks.length > 1) {
            const tickIntervalMs = xTicks[1] - xTicks[0];
            if (timeSpanDays <= 1 && tickIntervalMs < 1000 * 60 * 60 * 12) { // Less than 1 day span, ticks are hours/minutes
                xFormat = d3.timeFormat("%H:%M");
            } else if (timeSpanDays <= 7 && tickIntervalMs < 1000 * 60 * 60 * 24 * 2) { // Up to 1 week span, ticks are days/hours
                 xFormat = d3.timeFormat("%b %d %Hh");
            } else if (timeSpanDays <= 30 * 3) { // Up to ~3 months, show day/month
                xFormat = d3.timeFormat("%b %d");
            } else if (timeSpanDays <= 365 * 2) { // Up to 2 years, show month/year
                xFormat = d3.timeFormat("%b '%y");
            } else { // Longer, show year
                xFormat = d3.timeFormat("%Y");
            }
        } else if (xValues.length > 0) { // Single data point or very narrow domain
            xFormat = d3.timeFormat("%Y-%m-%d %H:%M");
            if (xTicks.length === 0 && xDomain[0] && xDomain[1]) { // If d3.ticks returns empty for very small domain
                xTicks = [xDomain[0], xDomain[1]]; // Show at least domain extent
            } else if (xTicks.length === 0 && xDomain[0]) {
                 xTicks = [xDomain[0]];
            }
        } else { // No data or ticks
            xFormat = d3.timeFormat("%Y-%m-%d");
            xTicks = [];
        }
        return { xScale, xTicks, xFormat };
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.marginTop || 60, 
        right: variables.marginRight || 40, // Increased right margin for end labels
        bottom: variables.marginBottom || 60, 
        left: variables.marginLeft || 60 
    };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    // Ensure chartDataInput is an array and parse dates
    const chartDataArray = chartDataInput.map(d => ({
        ...d,
        [xFieldName + "_parsed"]: parseDateInternal(d[xFieldName])
    })).filter(d => d[xFieldName + "_parsed"] instanceof Date); // Filter out items with unparseable dates

    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points after date parsing. Cannot render chart.";
        console.error(errorMsg);
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .text(errorMsg)
            .attr("class", "text error-message");
        return svgRoot.node();
    }
    
    const uniqueGroups = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort();
    // Re-initialize color assignment based on sorted unique groups for consistency
    colorIndex = 0;
    assignedGroupColors = {};
    uniqueGroups.forEach(group => fillStyle.lineColor(group)); // Pre-assign colors

    const groupedData = d3.group(chartDataArray, d => d[groupFieldName]);

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicksHelper(chartDataArray, xFieldName + "_parsed", innerWidth, d => d);

    const yMin = d3.min(chartDataArray, d => d[yFieldName]);
    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const yRange = yMax - yMin;

    // Adjust padding: if range is 0 (all values same), add some padding.
    const yPadding = yRange === 0 ? Math.abs(yMax * 0.1) || 1 : yRange * 0.15; // Original was 0.3
    
    const yDomainMin = (yMin === yMax) ? yMin - (Math.abs(yMin * 0.1) || 1) : (yMin - yPadding);
    const yDomainMax = (yMin === yMax) ? yMax + (Math.abs(yMax * 0.1) || 1) : (yMax + yPadding);

    const yScale = d3.scaleLinear()
        .domain([Math.min(0, yDomainMin), yDomainMax]) // Ensure 0 is included if min is positive
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const yAxisTicks = yScale.ticks(5);

    // Y-Axis Gridlines
    const yGridlinesGroup = mainChartGroup.append("g")
        .attr("class", "grid y-grid");

    yAxisTicks.forEach(tick => {
        yGridlinesGroup.append("line")
            .attr("class", "gridline")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", innerWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1);
    });

    if (yAxisTicks.length > 1) {
        for (let i = 0; i < yAxisTicks.length - 1; i++) {
            const midValue = (yAxisTicks[i] + yAxisTicks[i+1]) / 2;
            // Only add mid-gridline if it's visually distinct enough from main ticks
            if (Math.abs(yScale(yAxisTicks[i]) - yScale(midValue)) > 5) {
                 yGridlinesGroup.append("line")
                    .attr("class", "gridline minor")
                    .attr("x1", 0)
                    .attr("y1", yScale(midValue))
                    .attr("x2", innerWidth)
                    .attr("y2", yScale(midValue))
                    .attr("stroke", fillStyle.gridLineColor)
                    .attr("stroke-width", 0.5) // Thinner for minor lines
                    .attr("stroke-dasharray", "2,2");
            }
        }
    }
    
    // Y-Axis
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => formatValueInternal(d));
        
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);
    yAxisGroup.select(".domain").attr("stroke", fillStyle.axisLineColor);
    yAxisGroup.selectAll("line").attr("stroke", fillStyle.axisLineColor);
    yAxisGroup.selectAll("text")
        .attr("class", "label y-axis-label")
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.axisLabelFontFamily)
        .style("font-size", fillStyle.typography.axisLabelFontSize)
        .style("font-weight", fillStyle.typography.axisLabelFontWeight);

    // X-Axis
    const xAxis = d3.axisBottom(xScale)
        .tickValues(xTicks)
        .tickFormat(xFormat);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);
    xAxisGroup.select(".domain").attr("stroke", fillStyle.axisLineColor);
    xAxisGroup.selectAll("line").attr("stroke", fillStyle.axisLineColor);
    xAxisGroup.selectAll("text")
        .attr("class", "label x-axis-label")
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.axisLabelFontFamily)
        .style("font-size", fillStyle.typography.axisLabelFontSize)
        .style("font-weight", fillStyle.typography.axisLabelFontWeight);
        
    // Legend (helper function integrated)
    function layoutLegendInternal(legendContainer, groupNames, colorFunc, options) {
        const { x, y, fontSize, fontFamily, fontWeight, align, maxWidth, shape, itemPadding, shapeSize } = {
            x: 0, y: 0, fontSize: '12px', fontFamily: fillStyle.typography.defaultFontFamily, fontWeight: 'normal',
            align: 'left', maxWidth: innerWidth, shape: 'rect', itemPadding: 5, shapeSize: 12, ...options
        };

        let currentX = x;
        let currentY = y;
        let maxLineWidth = 0;
        let totalHeight = 0;
        const lineHeight = parseInt(fontSize) * 1.5;

        groupNames.forEach(name => {
            const itemGroup = legendContainer.append("g").attr("class", "legend-item");
            
            const textWidth = estimateTextWidth(name, { fontSize, fontFamily, fontWeight });
            const itemWidth = shapeSize + 5 + textWidth + itemPadding;

            if (align === 'left' && currentX + itemWidth > maxWidth && currentX > x) { // Wrap line
                currentX = x;
                currentY += lineHeight;
            }
            
            itemGroup.attr("transform", `translate(${currentX}, ${currentY})`);

            if (shape === 'line') {
                itemGroup.append("line")
                    .attr("class", "mark legend-shape")
                    .attr("x1", 0)
                    .attr("y1", shapeSize / 2)
                    .attr("x2", shapeSize)
                    .attr("y2", shapeSize / 2)
                    .attr("stroke", colorFunc(name))
                    .attr("stroke-width", 2);
            } else { // Default to rect
                itemGroup.append("rect")
                    .attr("class", "mark legend-shape")
                    .attr("width", shapeSize)
                    .attr("height", shapeSize)
                    .attr("fill", colorFunc(name));
            }

            itemGroup.append("text")
                .attr("class", "text legend-label")
                .attr("x", shapeSize + 5)
                .attr("y", shapeSize / 2)
                .attr("dy", "0.35em") // Vertical alignment
                .text(name)
                .attr("fill", fillStyle.textColor)
                .style("font-family", fontFamily)
                .style("font-size", fontSize)
                .style("font-weight", fontWeight);
            
            currentX += itemWidth;
            if (currentX > maxLineWidth) maxLineWidth = currentX;
        });
        
        totalHeight = currentY + lineHeight - y;
        if (align === 'center') {
             // This requires pre-calculating all widths and then re-positioning.
             // Simplified: assumes single line for center, or manual adjustment.
        }
        return { width: maxLineWidth, height: totalHeight };
    }

    const legendGroup = mainChartGroup.append("g").attr("class", "legend");
    const legendOptions = {
        fontSize: fillStyle.typography.legendLabelFontSize,
        fontFamily: fillStyle.typography.legendLabelFontFamily,
        fontWeight: fillStyle.typography.legendLabelFontWeight,
        maxWidth: innerWidth,
        shape: 'line',
        itemPadding: 15,
        shapeSize: 20
    };
    
    const legendSize = layoutLegendInternal(legendGroup, uniqueGroups, fillStyle.lineColor, legendOptions);
    
    // Position legend: Centered horizontally, above the chart plotting area (in top margin)
    const legendX = (innerWidth - legendSize.width) / 2;
    const legendY = -(chartMargins.top / 2) - (legendSize.height / 2) + 10; // Adjust +10 for some padding from top edge
    legendGroup.attr("transform", `translate(${legendX}, ${legendY})`);


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName + "_parsed"]))
        .y(d => yScale(d[yFieldName]))
        .defined(d => d[yFieldName] != null && d[xFieldName + "_parsed"] != null) // Handle missing data points
        .curve(d3.curveLinear);

    const lineWidth = variables.lineWidth || 3;

    groupedData.forEach((values, group) => {
        // Sort values by date for correct line drawing
        const sortedValues = values.sort((a, b) => a[xFieldName + "_parsed"] - b[xFieldName + "_parsed"]);
        
        mainChartGroup.append("path")
            .datum(sortedValues)
            .attr("class", `mark line series-${group.toString().replace(/\s+/g, '-')}`)
            .attr("fill", "none")
            .attr("stroke", fillStyle.lineColor(group))
            .attr("stroke-width", lineWidth)
            .attr("d", lineGenerator);
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    
    // Dynamic Programming Label Placer (simplified, debug removed)
    function placeLabelsDPInternal(points, chartH, chartW) {
        const GRID_SIZE = 3; 
        const PROTECTION_RADIUS_GRID = 3; 
        const LABEL_HEIGHT_GRID = 10; // Corresponds to 30px
        const LABEL_ACTUAL_HEIGHT_PX = 24; // From drawLabelsInternal

        const gridCount = Math.ceil(chartH / GRID_SIZE);
        points.sort((a, b) => a.y - b.y);

        const occupied = new Array(gridCount).fill(false);
        points.forEach(point => {
            const pointGridY = Math.floor(point.y / GRID_SIZE);
            for (let i = Math.max(0, pointGridY - PROTECTION_RADIUS_GRID); i <= Math.min(gridCount - 1, pointGridY + PROTECTION_RADIUS_GRID); i++) {
                occupied[i] = true;
            }
        });

        const n = points.length;
        if (n === 0) return [];
        
        const dp = Array(n).fill(null).map(() => Array(gridCount).fill(Infinity));
        const prev = Array(n).fill(null).map(() => Array(gridCount).fill(-1));

        const firstPointGridY = Math.floor(points[0].y / GRID_SIZE);
        for (let j = 0; j < gridCount; j++) {
            if (j + LABEL_HEIGHT_GRID > gridCount) continue;
            let canPlace = true;
            for (let k = 0; k < LABEL_HEIGHT_GRID; k++) {
                if (occupied[j + k]) { canPlace = false; break; }
            }
            if (canPlace) {
                dp[0][j] = Math.abs(j * GRID_SIZE - points[0].y); // Cost is pixel distance
            }
        }

        for (let i = 1; i < n; i++) {
            const pointGridY = Math.floor(points[i].y / GRID_SIZE);
            for (let j = 0; j < gridCount; j++) {
                if (j + LABEL_HEIGHT_GRID > gridCount) continue;
                let canPlaceCurrent = true;
                for (let k = 0; k < LABEL_HEIGHT_GRID; k++) {
                    if (occupied[j + k]) { canPlaceCurrent = false; break; }
                }
                if (!canPlaceCurrent) continue;

                for (let k_prev = 0; k_prev < gridCount; k_prev++) {
                    if (dp[i-1][k_prev] === Infinity) continue;
                    // Ensure labels don't overlap: current label (j to j+LH) must be after previous label (k_prev to k_prev+LH)
                    if (j >= k_prev + LABEL_HEIGHT_GRID || k_prev >= j + LABEL_HEIGHT_GRID) { // Non-overlapping
                        const cost = Math.abs(j * GRID_SIZE - points[i].y);
                        if (dp[i-1][k_prev] + cost < dp[i][j]) {
                            dp[i][j] = dp[i-1][k_prev] + cost;
                            prev[i][j] = k_prev;
                        }
                    }
                }
            }
        }

        let minCost = Infinity;
        let lastBestPosGrid = -1;
        for (let j = 0; j < gridCount; j++) {
            if (dp[n-1][j] < minCost) {
                minCost = dp[n-1][j];
                lastBestPosGrid = j;
            }
        }

        const labelPlacements = [];
        if (lastBestPosGrid !== -1) {
            let currentPosGrid = lastBestPosGrid;
            for (let i = n - 1; i >= 0; i--) {
                labelPlacements.unshift({ point: points[i], labelY: currentPosGrid * GRID_SIZE });
                currentPosGrid = prev[i][currentPosGrid];
            }
        } else { // Fallback: simple placement if DP fails
            let lastY = -Infinity;
            points.forEach(p => {
                let yPos = Math.max(p.y - LABEL_ACTUAL_HEIGHT_PX / 2, lastY + 5); // Try to center on point, avoid overlap
                yPos = Math.min(yPos, chartH - LABEL_ACTUAL_HEIGHT_PX); // Keep in bounds
                yPos = Math.max(0, yPos); // Keep in bounds
                labelPlacements.push({ point: p, labelY: yPos });
                lastY = yPos + LABEL_ACTUAL_HEIGHT_PX;
            });
        }
        return labelPlacements;
    }

    function drawLabelsInternal(labelPlacements) {
        const dataLabelGroup = mainChartGroup.append("g").attr("class", "data-labels-group");
        const labelBoxHeight = 24; // As per original
        const labelPadding = 5;

        labelPlacements.forEach(placement => {
            const point = placement.point.originalDataPoint;
            const xPos = placement.point.x;
            const yPos = placement.point.y; // Original point y for context
            const labelY = placement.labelY; // Calculated label y (top of box)

            const labelText = formatValueInternal(point[yFieldName]);
            const textElementFont = {
                fontSize: fillStyle.typography.dataLabelFontSize,
                fontFamily: fillStyle.typography.dataLabelFontFamily,
                fontWeight: fillStyle.typography.dataLabelFontWeight
            };
            const textWidth = estimateTextWidth(labelText, textElementFont);
            const labelBoxWidth = textWidth + 2 * labelPadding;
            
            // Adjust labelX to be centered on point.x, but prevent going off-chart
            let labelX = xPos - labelBoxWidth / 2;
            if (labelX < 0) labelX = 0;
            if (labelX + labelBoxWidth > innerWidth) labelX = innerWidth - labelBoxWidth;

            dataLabelGroup.append("rect")
                .attr("class", "mark data-label-box")
                .attr("x", labelX)
                .attr("y", labelY)
                .attr("width", labelBoxWidth)
                .attr("height", labelBoxHeight)
                .attr("rx", 5)
                .attr("ry", 5)
                .attr("fill", fillStyle.labelBackgroundColor(point[groupFieldName]));

            dataLabelGroup.append("text")
                .attr("class", "text data-label-text")
                .attr("x", labelX + labelBoxWidth / 2)
                .attr("y", labelY + labelBoxHeight / 2)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("fill", fillStyle.labelTextContrastColor)
                .style("font-family", textElementFont.fontFamily)
                .style("font-size", textElementFont.fontSize)
                .style("font-weight", textElementFont.fontWeight)
                .text(labelText);
            
            // Optional: Add a small line/pointer from label to data point if they are far apart
            // This was not in original, so skipping for now to preserve output.
        });
    }

    const allLabelPoints = [];
    groupedData.forEach((values, group) => {
        const sortedValues = values.sort((a, b) => a[xFieldName + "_parsed"] - b[xFieldName + "_parsed"]);
        const pointsForLabelling = [];
        if (sortedValues.length > 0) {
            pointsForLabelling.push(sortedValues[0]); // Start point
            if (sortedValues.length > 1) {
                pointsForLabelling.push(sortedValues[sortedValues.length - 1]); // End point
            }
            if (sortedValues.length > 2) {
                 // Middle point - ensure it's distinct from start/end if only 3 points
                const midIndex = Math.floor(sortedValues.length / 2);
                if (midIndex !== 0 && midIndex !== sortedValues.length -1) {
                    pointsForLabelling.push(sortedValues[midIndex]);
                }
            }
        }
        
        pointsForLabelling.forEach(d => {
            allLabelPoints.push({
                x: xScale(d[xFieldName + "_parsed"]),
                y: yScale(d[yFieldName]),
                value: d[yFieldName], // for DP cost, not directly for display text
                group: d[groupFieldName],
                originalDataPoint: d // Keep reference to original data for text, color
            });
        });
    });
    
    // The original DP was applied per group of points (start, middle, end).
    // For simplicity and better global collision avoidance, could apply to all points together,
    // but this might deviate from original look. Sticking to original's grouped approach.
    
    const startPoints = [], middlePoints = [], endPoints = [];
    groupedData.forEach((values, group) => {
        const sortedValues = values.sort((a, b) => a[xFieldName + "_parsed"] - b[xFieldName + "_parsed"]);
        if (sortedValues.length > 0) {
            const first = sortedValues[0];
            startPoints.push({ x: xScale(first[xFieldName + "_parsed"]), y: yScale(first[yFieldName]), value: first[yFieldName], group, originalDataPoint: first });
            if (sortedValues.length > 1) {
                const last = sortedValues[sortedValues.length - 1];
                endPoints.push({ x: xScale(last[xFieldName + "_parsed"]), y: yScale(last[yFieldName]), value: last[yFieldName], group, originalDataPoint: last });
            }
            if (sortedValues.length > 2) {
                const midIndex = Math.floor(sortedValues.length / 2);
                 if (midIndex !== 0 && midIndex !== sortedValues.length -1) { // ensure distinct
                    const middle = sortedValues[midIndex];
                    middlePoints.push({ x: xScale(middle[xFieldName + "_parsed"]), y: yScale(middle[yFieldName]), value: middle[yFieldName], group, originalDataPoint: middle });
                }
            }
        }
    });

    const startLabelPlacements = placeLabelsDPInternal(startPoints, innerHeight, innerWidth);
    const middleLabelPlacements = placeLabelsDPInternal(middlePoints, innerHeight, innerWidth);
    const endLabelPlacements = placeLabelsDPInternal(endPoints, innerHeight, innerWidth);

    drawLabelsInternal(startLabelPlacements);
    drawLabelsInternal(middleLabelPlacements);
    drawLabelsInternal(endLabelPlacements);

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}