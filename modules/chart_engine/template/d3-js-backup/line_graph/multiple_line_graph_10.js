/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Line Graph",
  "chart_name": "multiple_line_graph_10",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 30], ["-inf", "inf"], [2, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["grid", "axis"],
  "min_height": 400,
  "min_width": 800,
  "background": "yes",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "prominent",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data?.data;
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // Assuming light theme, not handling data.colors_dark explicitly
    const images = data.images || {}; // Not used in this chart type but extracted per spec
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getFieldNameByRole = (role) => dataColumns.find(col => col.role === role)?.name;

    const xFieldName = getFieldNameByRole(xFieldRole);
    const yFieldName = getFieldNameByRole(yFieldRole);
    const groupFieldName = getFieldNameByRole(groupFieldRole);

    const criticalFields = { xFieldName, yFieldName, groupFieldName };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }
    
    if (!rawChartData || rawChartData.length === 0) {
        const errorMessage = "Chart data is missing or empty. Cannot render.";
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

    const chartData = rawChartData.map(d => ({
        ...d,
        [xFieldName]: new Date(d[xFieldName]), // Ensure xField is Date objects
        [yFieldName]: parseFloat(d[yFieldName]) // Ensure yField is numbers
    })).filter(d => !isNaN(d[xFieldName]) && !isNaN(d[yFieldName]));


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e", grid: "#e0e0e0", axis: "#b0b0b0" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"], // d3.schemeCategory10
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };

    fillStyle.typography = {
        axisLabelFontFamily: rawTypography.label?.font_family || defaultTypography.label.font_family,
        axisLabelFontSize: rawTypography.label?.font_size || defaultTypography.label.font_size,
        axisLabelFontWeight: rawTypography.label?.font_weight || defaultTypography.label.font_weight,
        
        legendFontFamily: rawTypography.label?.font_family || defaultTypography.label.font_family,
        // Original used 14px bold for legend, map to label, allow override
        legendFontSize: rawTypography.label?.font_size || "14px", 
        legendFontWeight: rawTypography.label?.font_weight || "bold",

        dataLabelFontFamily: rawTypography.annotation?.font_family || defaultTypography.annotation.font_family,
        // Original used 14px bold for data labels, map to annotation, allow override
        dataLabelFontSize: rawTypography.annotation?.font_size || "14px",
        dataLabelFontWeight: rawTypography.annotation?.font_weight || "bold",
    };

    fillStyle.chartBackground = rawColors.background_color || defaultColors.background_color;
    fillStyle.textColor = rawColors.text_color || defaultColors.text_color;
    fillStyle.axisLabelColor = rawColors.text_color || defaultColors.text_color; // Specific for axis labels
    fillStyle.gridLineColor = (rawColors.other && rawColors.other.grid) || defaultColors.other.grid;
    fillStyle.axisLineColor = (rawColors.other && rawColors.other.axis) || defaultColors.other.axis;
    
    const uniqueGroupNames = [...new Set(chartData.map(d => d[groupFieldName]))].sort();
    
    fillStyle.lineColor = (groupName) => {
        if (rawColors.field && rawColors.field[groupName]) {
            return rawColors.field[groupName];
        }
        const colorPalette = (rawColors.available_colors && rawColors.available_colors.length > 0) ? rawColors.available_colors : defaultColors.available_colors;
        const index = uniqueGroupNames.indexOf(groupName);
        return colorPalette[index % colorPalette.length];
    };

    fillStyle.dataLabelTextColor = rawColors.other?.dataLabelText || "#FFFFFF"; // Default white text on colored background
    fillStyle.dataLabelBackgroundColor = (groupName) => fillStyle.lineColor(groupName);

    const LINE_WIDTH = variables.lineWidth || 4;
    const DATA_LABEL_RECT_RADIUS = 5;
    const DATA_LABEL_HEIGHT_PIXELS = parseInt(fillStyle.typography.dataLabelFontSize) * 1.5 + 8; // Dynamic height based on font

    function estimateTextWidth(text, fontStyles) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // Position off-screen to be safe, though not strictly necessary for non-appended SVG
        svg.style.position = 'absolute';
        svg.style.left = '-9999px';
        svg.style.top = '-9999px';

        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontStyles.font_family || 'Arial');
        textEl.setAttribute('font-size', fontStyles.font_size || '12px');
        textEl.setAttribute('font-weight', fontStyles.font_weight || 'normal');
        textEl.textContent = text;
        svg.appendChild(textEl);
        // No need to append to body for getBBox if font properties are set directly
        const width = textEl.getBBox().width;
        return width;
    }

    function parseDate(dateString) { // Kept simple as original was not provided
        return new Date(dateString);
    }

    function formatValue(value) { // For data labels and Y-axis ticks
        return Math.round(value);
    }

    function createXAxisScaleAndTicks(currentChartData, xName, rangeMin, rangeMax) {
        const dates = currentChartData.map(d => d[xName]);
        const extent = d3.extent(dates);
        
        const xScale = d3.scaleTime().domain(extent).range([rangeMin, rangeMax]);
        
        const width = rangeMax - rangeMin;
        let tickCount = Math.max(2, Math.floor(width / 100)); // Approx 100px per tick
        
        let tickFormat;
        const timeSpanDays = (extent[1] - extent[0]) / (1000 * 60 * 60 * 24);

        if (timeSpanDays <= 1) {
            tickFormat = d3.timeFormat("%H:%M");
            tickCount = Math.min(tickCount, 12); // Max 12 ticks for hourly
        } else if (timeSpanDays <= 7) {
            tickFormat = d3.timeFormat("%a %d"); // Mon 05
        } else if (timeSpanDays <= 90) {
            tickFormat = d3.timeFormat("%b %d"); // Jan 05
            tickCount = Math.min(tickCount, 10);
        } else if (timeSpanDays <= 365 * 2) {
            tickFormat = d3.timeFormat("%b '%y"); // Jan '23
            tickCount = Math.min(tickCount, 12);
        } else {
            tickFormat = d3.timeFormat("%Y"); // 2023
            tickCount = Math.min(tickCount, 10);
        }
        
        const xTicks = xScale.ticks(tickCount);
        return { xScale, xTicks, xTickFormat: tickFormat, timeSpan: "" }; // timeSpan not strictly used later
    }
    
    function layoutLegend(legendContainer, groupData, colorScaleFunc, typographyStyles, options) {
        const { itemHPadding = 5, itemVPadding = 5, shapeSize = 15, textOffset = 5, itemMaxWidth = 150 } = options;
        let currentX = 0;
        let currentY = 0;
        let maxItemHeight = 0;
        let totalWidth = 0;
        let totalHeight = 0;
        const rowHeight = shapeSize + itemVPadding;
        
        const items = groupData.map(groupName => {
            const itemGroup = legendContainer.append("g").attr("class", "legend-item");
            
            itemGroup.append("line")
                .attr("class", "mark legend-shape")
                .attr("x1", 0)
                .attr("y1", shapeSize / 2)
                .attr("x2", shapeSize)
                .attr("y2", shapeSize / 2)
                .attr("stroke", colorScaleFunc(groupName))
                .attr("stroke-width", LINE_WIDTH);

            const textElement = itemGroup.append("text")
                .attr("class", "text legend-label")
                .attr("x", shapeSize + textOffset)
                .attr("y", shapeSize / 2)
                .attr("dominant-baseline", "middle")
                .style("font-family", typographyStyles.legendFontFamily)
                .style("font-size", typographyStyles.legendFontSize)
                .style("font-weight", typographyStyles.legendFontWeight)
                .style("fill", fillStyle.textColor)
                .text(groupName);
            
            // Basic wrapping (crude)
            let textWidth = estimateTextWidth(groupName, {font_family: typographyStyles.legendFontFamily, font_size: typographyStyles.legendFontSize, font_weight: typographyStyles.legendFontWeight });
            if (textWidth > itemMaxWidth - shapeSize - textOffset) {
                 // This is a simplified layout, true text wrapping is complex.
                 // For now, we assume text fits or truncates visually by chart constraints.
            }
            
            const itemWidth = shapeSize + textOffset + textWidth;
            maxItemHeight = Math.max(maxItemHeight, shapeSize); // For line shape, height is shapeSize

            return { group: itemGroup, width: itemWidth, height: shapeSize };
        });

        let currentRowWidth = 0;
        items.forEach(item => {
            if (currentX + item.width > options.maxWidth && currentX > 0) { // New row
                currentX = 0;
                currentY += maxItemHeight + itemVPadding;
                maxItemHeight = 0; // Reset for new row
            }
            item.group.attr("transform", `translate(${currentX}, ${currentY})`);
            currentX += item.width + itemHPadding;
            currentRowWidth = Math.max(currentRowWidth, currentX);
            maxItemHeight = Math.max(maxItemHeight, item.height);
        });
        
        totalWidth = currentRowWidth > 0 ? currentRowWidth - itemHPadding : 0; // Remove last padding
        totalHeight = currentY + maxItemHeight;

        return { width: totalWidth, height: totalHeight };
    }

    function placeLabelsDP(points, chartHeightPx) {
        const GRID_SIZE_PX = 3; 
        const PROTECTION_RADIUS_GRID_UNITS = 3;
        const LABEL_HEIGHT_GRID_UNITS = Math.ceil(DATA_LABEL_HEIGHT_PIXELS / GRID_SIZE_PX);
    
        const gridCount = Math.ceil(chartHeightPx / GRID_SIZE_PX);
        points.sort((a, b) => a.y - b.y);
    
        const occupied = new Array(gridCount).fill(false);
        points.forEach(point => {
            const pointGridY = Math.floor(point.y / GRID_SIZE_PX);
            for (let i = Math.max(0, pointGridY - PROTECTION_RADIUS_GRID_UNITS); i <= Math.min(gridCount - 1, pointGridY + PROTECTION_RADIUS_GRID_UNITS); i++) {
                occupied[i] = true;
            }
        });
    
        const n = points.length;
        if (n === 0) return [];
    
        const dp = Array(n).fill(null).map(() => Array(gridCount).fill(Infinity));
        const prev = Array(n).fill(null).map(() => Array(gridCount).fill(-1));
    
        const firstPointGridY = Math.floor(points[0].y / GRID_SIZE_PX);
        for (let j = 0; j < gridCount; j++) {
            if (j + LABEL_HEIGHT_GRID_UNITS <= gridCount) {
                let canPlace = true;
                for (let k = 0; k < LABEL_HEIGHT_GRID_UNITS; k++) {
                    if (occupied[j + k]) { // Check only occupied by protection zone, not other labels yet
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
            const pointGridY = Math.floor(points[i].y / GRID_SIZE_PX);
            for (let j = 0; j < gridCount; j++) {
                if (j + LABEL_HEIGHT_GRID_UNITS <= gridCount) {
                    let canPlaceCurrent = true;
                    for (let k = 0; k < LABEL_HEIGHT_GRID_UNITS; k++) {
                        if (occupied[j + k]) {
                            canPlaceCurrent = false;
                            break;
                        }
                    }
                    if (canPlaceCurrent) {
                        for (let k_prev = 0; k_prev < gridCount; k_prev++) {
                            if (dp[i-1][k_prev] !== Infinity) {
                                // Check for overlap: current label [j, j+LH-1] vs prev label [k_prev, k_prev+LH-1]
                                // This DP assumes labels for point i and i-1 don't overlap horizontally, only vertically.
                                // A stricter check would be if (j + LABEL_HEIGHT_GRID_UNITS <= k_prev || k_prev + LABEL_HEIGHT_GRID_UNITS <= j)
                                // The original code implies k (k_prev here) is the start of the previous label slot.
                                // And it tries to place current label at j, ensuring j is AFTER previous label k_prev + LABEL_HEIGHT_GRID_UNITS
                                if (k_prev + LABEL_HEIGHT_GRID_UNITS <= j) { // Ensure current label is below previous
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
        }
    
        let minCost = Infinity;
        let lastPos = -1;
        for (let j = 0; j < gridCount; j++) {
            if (dp[n-1][j] < minCost) {
                minCost = dp[n-1][j];
                lastPos = j;
            }
        }
    
        const labelPlacements = [];
        if (lastPos !== -1) {
            for (let i = n - 1; i >= 0; i--) {
                labelPlacements.unshift({ point: points[i], labelY: lastPos * GRID_SIZE_PX });
                lastPos = prev[i][lastPos];
                 if (lastPos === -1 && i > 0) { // Path broken, something went wrong or no solution for remaining
                    // Fallback for remaining points if DP path breaks
                    for (let k = i - 1; k >= 0; k--) {
                        labelPlacements.unshift({ point: points[k], labelY: points[k].y + 20 }); // Simple offset
                    }
                    break;
                 }
            }
        } else { // Fallback for all points
            let lastLabelBottomY = 0;
            for (let i = 0; i < n; i++) {
                const point = points[i];
                let targetY = Math.max(point.y + 10, lastLabelBottomY + 5); // Place below point and below previous label
                targetY = Math.min(targetY, chartHeightPx - DATA_LABEL_HEIGHT_PIXELS); // Keep within bounds
                labelPlacements.push({ point: point, labelY: targetY });
                lastLabelBottomY = targetY + DATA_LABEL_HEIGHT_PIXELS;
            }
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 60, left: 60 }; // Original margins
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groupedData = d3.group(chartData, d => d[groupFieldName]);
    groupedData.forEach(values => {
        values.sort((a, b) => a[xFieldName] - b[xFieldName]); // Sort by date
    });

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xTickFormat } = createXAxisScaleAndTicks(chartData, xFieldName, 0, innerWidth);

    const yMin = d3.min(chartData, d => d[yFieldName]);
    const yMax = d3.max(chartData, d => d[yFieldName]);
    const yPadding = (yMax - yMin) * 0.30; // Original padding
    const yDomainMax = yMax + yPadding;
    const yDomainMin = Math.min(0, yMin - yPadding); // Ensure 0 is included if data is positive

    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0]);

    const yAxisTicks = yScale.ticks(5); // Suggest 5 ticks for Y-axis

    // Color scale is fillStyle.lineColor(groupName)

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Y-axis Gridlines
    const yGridlinesGroup = mainChartGroup.append("g").attr("class", "grid y-grid");
    yAxisTicks.forEach(tick => {
        yGridlinesGroup.append("line")
            .attr("class", "gridline major")
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
            yGridlinesGroup.append("line")
                .attr("class", "gridline minor")
                .attr("x1", 0)
                .attr("y1", yScale(midValue))
                .attr("x2", innerWidth)
                .attr("y2", yScale(midValue))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "2,2"); // Minor gridlines dashed
        }
    }
    
    // Y-axis Ticks and Labels
    const yAxisGroup = mainChartGroup.append("g").attr("class", "axis y-axis");
    yAxisTicks.forEach(tick => {
        yAxisGroup.append("text")
            .attr("class", "text axis-label y-axis-label")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .style("fill", fillStyle.axisLabelColor)
            .text(formatValue(tick));
    });

    // X-axis Ticks and Labels
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    xTicks.forEach(tick => {
        xAxisGroup.append("text")
            .attr("class", "text axis-label x-axis-label")
            .attr("x", xScale(tick))
            .attr("y", 20) // Offset below the axis line
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .style("fill", fillStyle.axisLabelColor)
            .text(xTickFormat(tick));
    });
    
    // X-axis Line
    xAxisGroup.append("line")
        .attr("class", "axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", innerWidth)
        .attr("y2", 0)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Legend
    const legendGroup = mainChartGroup.append("g").attr("class", "legend");
    const legendOptions = {
        x: 0, y: 0, // Relative to legendGroup
        itemHPadding: 10, itemVPadding: 5, shapeSize: 20, textOffset: 8,
        maxWidth: innerWidth, // Max width for legend layout
    };
    const legendSize = layoutLegend(legendGroup, uniqueGroupNames, fillStyle.lineColor, fillStyle.typography, legendOptions);
    
    // Position legend (original logic: centered, above chart content)
    const yPositionOfHighestYTicks = yScale(yAxisTicks[yAxisTicks.length - 1]); // y-coord of max Y value (top of chart)
    legendGroup.attr("transform", `translate(${(innerWidth - legendSize.width) / 2}, ${yPositionOfHighestYTicks - 50 - legendSize.height / 2})`);


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    const linesGroup = mainChartGroup.append("g").attr("class", "lines-group");

    const labelPointsCollection = { start: [], middle: [], end: [] };

    groupedData.forEach((values, group) => {
        linesGroup.append("path")
            .datum(values)
            .attr("class", "mark line-series")
            .attr("fill", "none")
            .attr("stroke", fillStyle.lineColor(group))
            .attr("stroke-width", LINE_WIDTH)
            .attr("d", lineGenerator);

        const middleIndex = Math.floor(values.length / 2);
        values.forEach((d, i) => {
            const pointData = {
                x: xScale(d[xFieldName]),
                y: yScale(d[yFieldName]),
                value: d[yFieldName],
                color: fillStyle.lineColor(group), // For potential use by label styling if needed
                group: group,
                originalData: d 
            };
            if (i === 0) labelPointsCollection.start.push(pointData);
            else if (i === values.length - 1) labelPointsCollection.end.push(pointData);
            else if (i === middleIndex) labelPointsCollection.middle.push(pointData);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing (Data Labels)
    const dataLabelsGroup = mainChartGroup.append("g").attr("class", "data-labels-group");

    function drawDataLabels(labelPlacements) {
        labelPlacements.forEach(placement => {
            const point = placement.point; // This is the pointData object
            const labelText = formatValue(point.value);
            const textWidth = estimateTextWidth(labelText, { 
                font_family: fillStyle.typography.dataLabelFontFamily, 
                font_size: fillStyle.typography.dataLabelFontSize, 
                font_weight: fillStyle.typography.dataLabelFontWeight 
            });
            const labelWidth = textWidth + 10; // Padding for rect
            const labelHeight = DATA_LABEL_HEIGHT_PIXELS; // Use constant height

            // Original label positioning logic preserved:
            const rectY = placement.labelY + labelHeight / 2;
            const textY = placement.labelY + labelHeight;

            dataLabelsGroup.append("rect")
                .attr("class", "mark data-label-background")
                .attr("x", point.x - labelWidth / 2)
                .attr("y", rectY)
                .attr("width", labelWidth)
                .attr("height", labelHeight)
                .attr("rx", DATA_LABEL_RECT_RADIUS)
                .attr("ry", DATA_LABEL_RECT_RADIUS)
                .attr("fill", fillStyle.dataLabelBackgroundColor(point.group));
            
            dataLabelsGroup.append("text")
                .attr("class", "text data-label")
                .attr("x", point.x)
                .attr("y", textY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.dataLabelFontFamily)
                .style("font-size", fillStyle.typography.dataLabelFontSize)
                .style("font-weight", fillStyle.typography.dataLabelFontWeight)
                .style("fill", fillStyle.dataLabelTextColor)
                .text(labelText);
        });
    }
    
    if (labelPointsCollection.start.length > 0) {
      const startLabelPlacements = placeLabelsDP(labelPointsCollection.start, innerHeight);
      drawDataLabels(startLabelPlacements);
    }
    if (labelPointsCollection.middle.length > 0) {
      const middleLabelPlacements = placeLabelsDP(labelPointsCollection.middle, innerHeight);
      drawDataLabels(middleLabelPlacements);
    }
    if (labelPointsCollection.end.length > 0) {
      const endLabelPlacements = placeLabelsDP(labelPointsCollection.end, innerHeight);
      drawDataLabels(endLabelPlacements);
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}