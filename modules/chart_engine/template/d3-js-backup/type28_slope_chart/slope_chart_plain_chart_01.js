/* REQUIREMENTS_BEGIN
{
  "chart_type": "Slope Chart",
  "chart_name": "slope_chart_plain_chart_01",
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Assuming data.colors is primary, not handling data.colors_dark explicitly here
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    const missingFields = [];
    if (!xFieldConfig) missingFields.push("x role");
    if (!yFieldConfig) missingFields.push("y role");
    if (!groupFieldConfig) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: column roles [${missingFields.join(', ')}] not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const errorMsg = `Critical chart config missing: field names for roles x, y, or group are undefined. Cannot render.`;
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
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
        textColor: colorsConfig.text_color || '#0f223b',
        chartBackground: colorsConfig.background_color || '#FFFFFF', // Not used for SVG background directly
        primaryColor: (colorsConfig.other && colorsConfig.other.primary) || '#1f77b4',
        defaultCategoricalColors: colorsConfig.available_colors || d3.schemeCategory10,
        gridLineColor: (colorsConfig.other && colorsConfig.other.gridLine) || '#dddddd',
        axisLineColor: (colorsConfig.other && colorsConfig.other.axisLine) || '#aaaaaa',
        slopeLineWidth: variables.slopeLineWidth || 4, // Example of a variable-driven style
        dataLabelColor: '#FFFFFF', // Specific for this chart's label design
    };

    fillStyle.getColor = (category) => {
        if (colorsConfig.field && colorsConfig.field[category]) {
            return colorsConfig.field[category];
        }
        const uniqueGroups = [...new Set(chartDataInput.map(d => d[groupFieldName]))];
        const index = uniqueGroups.indexOf(category);
        return fillStyle.defaultCategoricalColors[index % fillStyle.defaultCategoricalColors.length];
    };
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight = 'normal') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // getBBox should work on an in-memory SVG element in modern browsers.
        const width = textEl.getBBox().width;
        return width;
    }

    function parseDateValue(dateStr) {
        // Attempt to parse common date formats. d3.autoType might be more robust if applied earlier.
        // For this refactoring, assuming new Date() is sufficient or a pre-parsing step occurred.
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }
    
    function createXAxisScaleAndTicksHelper(data, fieldName, rangeMin, rangeMax) {
        const dates = data.map(d => parseDateValue(d[fieldName])).filter(d => d !== null);
        if (dates.length === 0) {
            return { xScale: d3.scaleTime().domain([new Date(), new Date()]).range([rangeMin, rangeMax]), xTicks: [], xFormat: () => "" };
        }
        const xDomain = d3.extent(dates);
        const xScale = d3.scaleTime().domain(xDomain).range([rangeMin, rangeMax]);
        
        const timeSpanDays = (xDomain[1] - xDomain[0]) / (1000 * 60 * 60 * 24);
        let xTicks, xFormat;

        if (timeSpanDays <= 31) { // Approx 1 month
            xTicks = xScale.ticks(d3.timeDay.every(Math.ceil(timeSpanDays / 7) || 1)); // Weekly or daily
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 365 * 2) { // Approx 2 years
            xTicks = xScale.ticks(d3.timeMonth.every(Math.ceil(timeSpanDays / 30 / 6) || 1)); // Monthly or bi-monthly
            xFormat = d3.timeFormat("%b '%y");
        } else { // Longer
            xTicks = xScale.ticks(d3.timeYear.every(Math.ceil(timeSpanDays / 365 / 5) || 1)); // Yearly
            xFormat = d3.timeFormat("%Y");
        }
        return { xScale, xTicks, xFormat };
    }

    function layoutLegendHelper(legendContainer, groupNames, colorScaleFunc, options) {
        const { x, y, itemHeight = 20, shapeSize = 10, padding = 5, maxWidth } = options;
        let currentX = x;
        let currentY = y;
        let totalWidth = 0;
        let totalHeight = 0;
        let maxLineWidth = 0;

        const legendItems = legendContainer.selectAll(".legend-item")
            .data(groupNames)
            .enter()
            .append("g")
            .attr("class", "legend-item other") // Added class
            .attr("transform", (d, i) => {
                const textWidth = estimateTextWidth(d, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
                const itemWidth = shapeSize + padding + textWidth;
                
                if (currentX + itemWidth > maxWidth && i > 0) {
                    currentX = x;
                    currentY += itemHeight;
                    maxLineWidth = Math.max(maxLineWidth, totalWidth - padding); // totalWidth before reset
                    totalWidth = 0;
                }
                const transform = `translate(${currentX}, ${currentY})`;
                currentX += itemWidth + padding;
                totalWidth += itemWidth + padding;
                totalHeight = currentY + itemHeight - y;
                return transform;
            });

        legendItems.append("line")
            .attr("class", "mark")
            .attr("x1", 0)
            .attr("y1", shapeSize / 2)
            .attr("x2", shapeSize)
            .attr("y2", shapeSize / 2)
            .attr("stroke", d => colorScaleFunc(d))
            .attr("stroke-width", 2);

        legendItems.append("text")
            .attr("class", "text label") // Added class
            .attr("x", shapeSize + padding)
            .attr("y", shapeSize / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d => d);
        
        maxLineWidth = Math.max(maxLineWidth, totalWidth - padding); // Final line width
        if (maxLineWidth <=0 && groupNames.length > 0) maxLineWidth = totalWidth - padding;


        return { width: maxLineWidth > 0 ? maxLineWidth : 0, height: totalHeight };
    }
    
    function placeLabelsDP(points, chartHeightPx) {
        const GRID_SIZE = 3; 
        const PROTECTION_RADIUS_GRID_UNITS = 3; 
        const LABEL_HEIGHT_GRID_UNITS = Math.ceil((parseFloat(fillStyle.typography.labelFontSize) * 1.5) / GRID_SIZE); // Approx label height in grid units

        const minY = 0;
        const maxY = chartHeightPx;
        const gridCount = Math.ceil((maxY - minY) / GRID_SIZE);

        points.sort((a, b) => a.y - b.y);

        const occupied = new Array(gridCount).fill(false);
        points.forEach(point => {
            const gridY = Math.floor(point.y / GRID_SIZE);
            for (let i = Math.max(0, gridY - PROTECTION_RADIUS_GRID_UNITS); i <= Math.min(gridCount - 1, gridY + PROTECTION_RADIUS_GRID_UNITS); i++) {
                occupied[i] = true;
            }
        });

        const n = points.length;
        if (n === 0) return [];
        
        const dp = Array(n).fill(null).map(() => Array(gridCount).fill(Infinity));
        const prev = Array(n).fill(null).map(() => Array(gridCount).fill(-1));

        const firstPointGridY = Math.floor(points[0].y / GRID_SIZE);
        for (let j = 0; j < gridCount; j++) {
            if (j + LABEL_HEIGHT_GRID_UNITS <= gridCount) {
                let canPlace = true;
                for (let k = 0; k < LABEL_HEIGHT_GRID_UNITS; k++) {
                    if (occupied[j + k]) {
                        canPlace = false;
                        break;
                    }
                }
                if (canPlace) {
                    dp[0][j] = Math.abs(j - firstPointGridY);
                }
            }
        }

        for (let i = 1; i < n; i++) {
            const pointGridY = Math.floor(points[i].y / GRID_SIZE);
            for (let j = 0; j < gridCount; j++) {
                if (j + LABEL_HEIGHT_GRID_UNITS <= gridCount) {
                    let canPlace = true;
                    for (let k = 0; k < LABEL_HEIGHT_GRID_UNITS; k++) {
                        if (occupied[j + k]) {
                            canPlace = false;
                            break;
                        }
                    }
                    if (canPlace) {
                        for (let k_prev = 0; k_prev + LABEL_HEIGHT_GRID_UNITS <= j; k_prev++) { // Ensure no overlap with previous label
                            if (dp[i-1][k_prev] !== Infinity) {
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
        let lastBestPos = -1;
        for (let j = 0; j < gridCount; j++) {
            if (dp[n-1][j] < minCost) {
                minCost = dp[n-1][j];
                lastBestPos = j;
            }
        }

        const labelPositions = [];
        if (lastBestPos !== -1) {
            let currentPos = lastBestPos;
            for (let i = n - 1; i >= 0; i--) {
                labelPositions.unshift({ point: points[i], labelY: currentPos * GRID_SIZE });
                currentPos = prev[i][currentPos];
                 if (currentPos === -1 && i > 0) { // Should not happen in a valid path
                    // Fallback if path is broken (e.g. no solution found for earlier points)
                    // This indicates an issue with DP logic or extreme constraints
                    // For now, break and let fallback handle
                    labelPositions.length = 0; // Clear partially built positions
                    break;
                 }
            }
        }
        
        if (labelPositions.length === 0) { // Fallback if DP fails or no solution
            let lastY = 0;
            const labelHeightPx = parseFloat(fillStyle.typography.labelFontSize) * 1.7;
            for (let i = 0; i < n; i++) {
                const point = points[i];
                let targetY = Math.max(point.y - labelHeightPx / 2, lastY + 5); // Try to center on point.y, ensure separation
                if (targetY + labelHeightPx > chartHeightPx) {
                    targetY = chartHeightPx - labelHeightPx;
                }
                if (i > 0 && targetY < lastY + labelHeightPx) { // Ensure no overlap with previous
                    targetY = lastY + labelHeightPx;
                }
                labelPositions.push({ point: point, labelY: targetY });
                lastY = targetY;
            }
        }
        return labelPositions;
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
        .style("background-color", fillStyle.chartBackground); // Optional: set SVG background

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.marginTop || 60, 
        right: variables.marginRight || 60, // Increased for end labels
        bottom: variables.marginBottom || 60, 
        left: variables.marginLeft || 60 // Increased for start labels
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartData = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: parseDateValue(d[xFieldName]),
        [yFieldName]: +d[yFieldName] // Ensure y is numeric
    })).filter(d => d[xFieldName] !== null && !isNaN(d[yFieldName]));

    const uniqueGroups = [...new Set(chartData.map(d => d[groupFieldName]))].sort(); // Sort for consistent legend order
    const groupedData = d3.group(chartData, d => d[groupFieldName]);

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicksHelper(chartData, xFieldName, 0, innerWidth);

    const yMin = d3.min(chartData, d => d[yFieldName]);
    const yMax = d3.max(chartData, d => d[yFieldName]);
    const yPadding = (yMax - yMin) * 0.15; // Reduced padding slightly from original
    
    const yDomainMin = (yMin === undefined || yMax === undefined) ? 0 : yMin - yPadding;
    const yDomainMax = (yMin === undefined || yMax === undefined) ? 1 : yMax + yPadding;


    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0]);

    const colorScale = (groupValue) => fillStyle.getColor(groupValue);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const yAxisTicks = yScale.ticks(5);

    // Y-axis Gridlines
    const gridLinesGroup = mainChartGroup.append("g").attr("class", "grid-lines other");
    yAxisTicks.forEach(tick => {
        gridLinesGroup.append("line")
            .attr("class", "grid-line other")
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
            gridLinesGroup.append("line")
                .attr("class", "grid-line other minor")
                .attr("x1", 0)
                .attr("y1", yScale(midValue))
                .attr("x2", innerWidth)
                .attr("y2", yScale(midValue))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-dasharray", "2,2") // Make minor gridlines dashed
                .attr("stroke-width", 0.5);
        }
    }
    
    // Y-axis Ticks
    const yAxisGroup = mainChartGroup.append("g").attr("class", "axis y-axis");
    yAxisTicks.forEach(tick => {
        yAxisGroup.append("text")
            .attr("class", "axis-label text label")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(Math.round(tick));
    });

    // X-axis Ticks and Line
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    xTicks.forEach(tick => {
        xAxisGroup.append("text")
            .attr("class", "axis-label text label")
            .attr("x", xScale(tick))
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(xFormat(tick));
    });
    xAxisGroup.append("line")
        .attr("class", "axis-line mark")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", innerWidth)
        .attr("y2", 0)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Legend
    const legendGroup = mainChartGroup.append("g").attr("class", "legend other");
    const legendOptions = {
        x: 0, 
        y: 0, 
        itemHeight: parseFloat(fillStyle.typography.labelFontSize) * 1.5 || 20,
        shapeSize: parseFloat(fillStyle.typography.labelFontSize) * 0.8 || 10,
        padding: 5,
        maxWidth: innerWidth
    };
    const legendSize = layoutLegendHelper(legendGroup, uniqueGroups, colorScale, legendOptions);
    
    const legendYPosition = (yScale(yAxisTicks[yAxisTicks.length-1] || yDomainMax)) - (parseFloat(fillStyle.typography.labelFontSize) * 2) - legendSize.height; // Place above highest tick
    legendGroup.attr("transform", `translate(${(innerWidth - legendSize.width) / 2}, ${Math.min(-chartMargins.top + 15, legendYPosition )})`);


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    const slopeLinesGroup = mainChartGroup.append("g").attr("class", "slope-lines-group mark");
    
    const startPointsForLabels = [];
    const endPointsForLabels = [];

    groupedData.forEach((values, group) => {
        values.sort((a, b) => a[xFieldName] - b[xFieldName]);
        if (values.length < 2) return; // Need at least two points for a slope

        const firstPoint = values[0];
        const lastPoint = values[values.length - 1];
        const slopeData = [firstPoint, lastPoint];
        const groupColor = colorScale(group);

        slopeLinesGroup.append("path")
            .datum(slopeData)
            .attr("class", "slope-line mark")
            .attr("fill", "none")
            .attr("stroke", groupColor)
            .attr("stroke-width", fillStyle.slopeLineWidth)
            .attr("d", lineGenerator);
        
        startPointsForLabels.push({
            x: xScale(firstPoint[xFieldName]),
            y: yScale(firstPoint[yFieldName]),
            value: firstPoint[yFieldName], // Keep original value for formatting
            color: groupColor,
            group: group,
            pointData: firstPoint
        });
        
        endPointsForLabels.push({
            x: xScale(lastPoint[xFieldName]),
            y: yScale(lastPoint[yFieldName]),
            value: lastPoint[yFieldName],
            color: groupColor,
            group: group,
            pointData: lastPoint
        });
    });

    // Block 9: Optional Enhancements & Post-Processing (Data Labels)
    const dataLabelsGroup = mainChartGroup.append("g").attr("class", "data-labels-group other");

    function drawDataLabels(labelPlacements, isStartLabel) {
        labelPlacements.forEach(placement => {
            const { point, labelY } = placement;
            const labelText = Math.round(point.value).toString();
            const textFontFamily = fillStyle.typography.labelFontFamily;
            const textFontSize = fillStyle.typography.labelFontSize;
            const textFontWeight = 'bold'; // Specific style for these labels

            const estimatedTextWidth = estimateTextWidth(labelText, textFontFamily, textFontSize, textFontWeight);
            const labelPadding = parseFloat(textFontSize) * 0.4;
            const labelRectWidth = estimatedTextWidth + 2 * labelPadding;
            const labelRectHeight = parseFloat(textFontSize) + 2 * labelPadding;
            const rectRx = 5;

            const labelX = isStartLabel ? point.x - labelRectWidth - 5 : point.x + 5; // Position left for start, right for end

            dataLabelsGroup.append("rect")
                .attr("class", "data-label-bg mark")
                .attr("x", labelX)
                .attr("y", labelY - labelRectHeight / 2 + labelPadding/2) // Adjust Y to center rect on labelY
                .attr("width", labelRectWidth)
                .attr("height", labelRectHeight)
                .attr("rx", rectRx)
                .attr("ry", rectRx)
                .attr("fill", point.color);
            
            dataLabelsGroup.append("text")
                .attr("class", "data-label-text text label")
                .attr("x", labelX + labelRectWidth / 2)
                .attr("y", labelY + parseFloat(textFontSize) / 2 ) // Center text in rect
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-family", textFontFamily)
                .style("font-size", textFontSize)
                .style("font-weight", textFontWeight)
                .style("fill", fillStyle.dataLabelColor)
                .text(labelText);
        });
    }
    
    if (startPointsForLabels.length > 0) {
        const startLabelPlacements = placeLabelsDP(startPointsForLabels, innerHeight);
        drawDataLabels(startLabelPlacements, true);
    }
    if (endPointsForLabels.length > 0) {
        const endLabelPlacements = placeLabelsDP(endPointsForLabels, innerHeight);
        drawDataLabels(endLabelPlacements, false);
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}