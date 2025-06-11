/* REQUIREMENTS_BEGIN
{
  "chart_type": "Slope Chart",
  "chart_name": "slope_chart_02",
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
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "prominent",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a Slope Chart.
    // It expects data with x (temporal), y (numerical), and group (categorical) fields.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors_dark || data.colors || {}; // Prioritize dark theme colors
    const images = data.images || {}; // Though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getFieldNameByRole = (role) => {
        const column = dataColumns.find(col => col.role === role);
        return column ? column.name : undefined;
    };

    const xFieldName = getFieldNameByRole(xFieldRole);
    const yFieldName = getFieldNameByRole(yFieldRole);
    const groupFieldName = getFieldNameByRole(groupFieldRole);

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? `"x" role field` : null,
            !yFieldName ? `"y" role field` : null,
            !groupFieldName ? `"group" role field` : null
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: ${missingFields}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '14px', // Original used 14px
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '12px', // Adjusted from 10px for data labels
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'bold', // For data labels
        },
        textColor: colors.text_color || '#FFFFFF', // Default for dark background
        backgroundColor: colors.background_color || '#1E1E1E', // Default for dark background
        gridLineColor: (colors.other && colors.other.gridColor) ? colors.other.gridColor : '#555555', // Darker default for dark bg
        axisLineColor: (colors.other && colors.other.axisColor) ? colors.other.axisColor : '#AAAAAA',
        defaultCategoryColors: d3.schemeCategory10,
        getGroupColor: function(groupValue, index) {
            if (colors.field && colors.field[groupFieldName] && colors.field[groupFieldName][groupValue]) {
                return colors.field[groupFieldName][groupValue];
            }
            if (colors.field && colors.field[groupValue]) { // Fallback if groupFieldName key is not present
                return colors.field[groupValue];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return this.defaultCategoryColors[index % this.defaultCategoryColors.length];
        }
    };
    
    function estimateTextWidth(text, fontSize, fontFamily, fontWeight = 'normal') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Document append/remove is not strictly necessary for getBBox if styles are applied directly
        // but some browsers might be more consistent if it's briefly in a document context.
        // However, per spec, it should not be appended to the main DOM.
        // For this implementation, we assume direct style application is sufficient.
        // document.body.appendChild(svg); // Not appending to DOM as per directive
        const width = textElement.getBBox().width;
        // document.body.removeChild(svg); // Not appending to DOM
        return width;
    }

    function parseDateInternal(dateString) {
        // Attempt to parse common date formats, including ISO
        const parsed = d3.isoParse(dateString) || new Date(dateString);
        return parsed instanceof Date && !isNaN(parsed) ? parsed : null;
    }
    
    function createXAxisScaleAndTicksHelper(chartDataArray, xName, rangeMin, rangeMax) {
        const dates = chartDataArray.map(d => parseDateInternal(d[xName])).filter(d => d !== null);
        if (dates.length === 0) {
            // Fallback if no valid dates
            const now = new Date();
            const xScale = d3.scaleTime().domain([d3.timeMonth.offset(now, -1), now]).range([rangeMin, rangeMax]);
            return {
                xScale,
                xTicks: xScale.ticks(5),
                xFormat: d3.timeFormat("%b %Y"),
                timeSpan: 0 // Indicate fallback
            };
        }

        const xDomain = d3.extent(dates);
        const xScale = d3.scaleTime().domain(xDomain).range([rangeMin, rangeMax]);
        
        const timeSpanDays = (xDomain[1] - xDomain[0]) / (1000 * 60 * 60 * 24);
        let xTicks, xFormat;

        if (timeSpanDays <= 31) { // Approx 1 month
            xTicks = xScale.ticks(d3.timeDay.every(Math.ceil(timeSpanDays / 7) || 1));
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 365 * 2) { // Approx 2 years
            xTicks = xScale.ticks(d3.timeMonth.every(Math.ceil(timeSpanDays / 30 / 6) || 1));
            xFormat = d3.timeFormat("%b %Y");
        } else { // More than 2 years
            xTicks = xScale.ticks(d3.timeYear.every(Math.ceil(timeSpanDays / 365 / 6) || 1));
            xFormat = d3.timeFormat("%Y");
        }
        
        // Ensure first and last points are included if they are not already ticks
        const uniqueDates = [...new Set(dates.map(d => d.getTime()))].map(t => new Date(t)).sort((a,b) => a - b);
        if (uniqueDates.length > 0) {
            const firstDate = uniqueDates[0];
            const lastDate = uniqueDates[uniqueDates.length - 1];
            if (!xTicks.find(t => t.getTime() === firstDate.getTime())) xTicks.unshift(firstDate);
            if (!xTicks.find(t => t.getTime() === lastDate.getTime())) xTicks.push(lastDate);
            xTicks.sort((a,b) => a - b);
            // Remove duplicates that might arise
            xTicks = xTicks.filter((d, i, arr) => i === 0 || d.getTime() !== arr[i-1].getTime());
        }


        return { xScale, xTicks, xFormat, timeSpan: timeSpanDays };
    }

    function layoutLegendHelper(legendContainerGroup, groupNames, fillStyleRef, options) {
        const { x, y, fontSize, fontWeight, align, maxWidth, shape, textColor } = options;
        const itemPadding = 5;
        const shapeSize = 10;
        const textOffsetY = shapeSize / 2;
        let currentX = x;
        let currentY = y;
        let maxLineWidth = 0;
        let totalHeight = 0;

        const legendItems = legendContainerGroup.selectAll(".legend-item")
            .data(groupNames)
            .enter()
            .append("g")
            .attr("class", "legend-item value");

        legendItems.each(function(d, i) {
            const group = d3.select(this);
            const color = fillStyleRef.getGroupColor(d, i);

            if (shape === "line") {
                group.append("line")
                    .attr("class", "mark legend-shape")
                    .attr("x1", 0)
                    .attr("y1", shapeSize / 2)
                    .attr("x2", shapeSize * 2)
                    .attr("y2", shapeSize / 2)
                    .attr("stroke", color)
                    .attr("stroke-width", 2);
            } else { // Default to rect
                group.append("rect")
                    .attr("class", "mark legend-shape")
                    .attr("width", shapeSize)
                    .attr("height", shapeSize)
                    .attr("fill", color);
            }

            const textElement = group.append("text")
                .attr("class", "label legend-text")
                .attr("x", (shape === "line" ? shapeSize * 2 : shapeSize) + itemPadding)
                .attr("y", textOffsetY)
                .attr("dy", "0.35em") // Vertical alignment
                .style("font-family", fillStyleRef.typography.labelFontFamily)
                .style("font-size", fontSize + "px")
                .style("font-weight", fontWeight)
                .attr("fill", textColor)
                .text(d);
            
            const itemWidth = (shape === "line" ? shapeSize * 2 : shapeSize) + itemPadding + estimateTextWidth(d, fontSize + "px", fillStyleRef.typography.labelFontFamily, fontWeight);
            const itemHeight = Math.max(shapeSize, parseFloat(fontSize));

            if (currentX + itemWidth > x + maxWidth && i > 0) { // Wrap line
                currentX = x;
                currentY += itemHeight + itemPadding;
            }
            group.attr("transform", `translate(${currentX}, ${currentY})`);
            currentX += itemWidth + itemPadding * 2;
            maxLineWidth = Math.max(maxLineWidth, currentX - x - itemPadding *2); // currentX is end of last item + padding
            totalHeight = currentY + itemHeight - y;
        });
        
        return { width: maxLineWidth, height: totalHeight };
    }

    const labelBoxHeightInPixels = parseFloat(fillStyle.typography.annotationFontSize) * 1.5; // e.g., 24px if font size is 16px

    function placeLabelsDPInternal(points, chartHeightPx) {
        const GRID_SIZE = 3; // pixels
        const PROTECTION_RADIUS_GRID_UNITS = 3; // grid units around data point
        const LABEL_HEIGHT_GRID_UNITS = Math.ceil(labelBoxHeightInPixels / GRID_SIZE);
    
        const minY = 0;
        const maxY = chartHeightPx;
        const gridCount = Math.ceil((maxY - minY) / GRID_SIZE);
    
        points.sort((a, b) => a.y - b.y); // Sort by y-coordinate (pixel value)
    
        const occupied = new Array(gridCount).fill(false);
    
        points.forEach((point) => {
            const pointGridY = Math.floor(point.y / GRID_SIZE);
            for (let i = Math.max(0, pointGridY - PROTECTION_RADIUS_GRID_UNITS); i <= Math.min(gridCount - 1, pointGridY + PROTECTION_RADIUS_GRID_UNITS); i++) {
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
                        for (let k_prev = 0; k_prev + LABEL_HEIGHT_GRID_UNITS <= j; k_prev++) { // Ensure labels don't overlap
                            if (dp[i-1][k_prev] !== Infinity) {
                                const cost = dp[i-1][k_prev] + Math.abs(j - pointGridY);
                                if (cost < dp[i][j]) {
                                    dp[i][j] = cost;
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
                 if (currentPos === -1 && i > 0) { // Should not happen if solution found
                    // Fallback for this point if path broken, though DP should ensure path
                    labelPositions[0].labelY = Math.max(0, Math.min(points[i].y - labelBoxHeightInPixels / 2, chartHeightPx - labelBoxHeightInPixels));
                 }
            }
        } else { // Fallback: simple placement if DP fails
            let lastLabelBottomY = 0;
            points.forEach(point => {
                let idealY = point.y - labelBoxHeightInPixels / 2;
                let labelTopY = Math.max(lastLabelBottomY, idealY);
                labelTopY = Math.min(labelTopY, chartHeightPx - labelBoxHeightInPixels);
                labelPositions.push({ point: point, labelY: labelTopY });
                lastLabelBottomY = labelTopY + labelBoxHeightInPixels + GRID_SIZE; // Add small gap
            });
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
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink") // For images if used, though not in this chart
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 100, bottom: 60, left: 100 }; // Increased margins for labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [xFieldName]: parseDateInternal(d[xFieldName]),
        [yFieldName]: +d[yFieldName] // Ensure y is numeric
    })).filter(d => d[xFieldName] !== null && !isNaN(d[yFieldName]) && d[groupFieldName] !== undefined);

    if (chartDataArray.length === 0) {
        const errorMessage = "No valid data points after processing. Cannot render chart.";
        console.error(errorMessage);
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .text(errorMessage);
        return svgRoot.node();
    }
    
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort();
    
    const groupedData = d3.group(chartDataArray, d => d[groupFieldName]);
    
    groupedData.forEach(values => {
        values.sort((a, b) => a[xFieldName] - b[xFieldName]);
    });

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicksHelper(chartDataArray, xFieldName, 0, innerWidth);

    const yMin = d3.min(chartDataArray, d => d[yFieldName]);
    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const yPadding = (yMax - yMin) * 0.2 || 1; // Ensure padding even if min=max
    
    const yScale = d3.scaleLinear()
        .domain([yMin - yPadding, yMax + yPadding])
        .range([innerHeight, 0]);

    const yAxisTicks = yScale.ticks(5);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Y-axis Gridlines
    const yGridlinesGroup = mainChartGroup.append("g").attr("class", "gridlines y-gridlines");
    yAxisTicks.forEach(tick => {
        yGridlinesGroup.append("line")
            .attr("class", "gridline")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", innerWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 0.5)
            .attr("stroke-dasharray", "2,2");
    });
    if (yAxisTicks.length > 1) { // Mid-gridlines
        for (let i = 0; i < yAxisTicks.length - 1; i++) {
            const midValue = (yAxisTicks[i] + yAxisTicks[i+1]) / 2;
            yGridlinesGroup.append("line")
                .attr("class", "gridline minor")
                .attr("x1", 0)
                .attr("y1", yScale(midValue))
                .attr("x2", innerWidth)
                .attr("y2", yScale(midValue))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 0.5)
                .attr("stroke-dasharray", "2,2");
        }
    }

    // Y-axis Labels
    const yAxisGroup = mainChartGroup.append("g").attr("class", "axis y-axis");
    yAxisTicks.forEach(tick => {
        yAxisGroup.append("text")
            .attr("class", "label axis-label y-axis-label")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(Math.round(tick));
    });

    // X-axis Ticks and Line
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    xTicks.forEach(tick => {
        xAxisGroup.append("text")
            .attr("class", "label axis-label x-axis-label")
            .attr("x", xScale(tick))
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xFormat(tick));
    });
    xAxisGroup.append("line")
        .attr("class", "axis-line x-axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", innerWidth)
        .attr("y2", 0)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Legend
    const legendGroup = mainChartGroup.append("g").attr("class", "legend");
    const legendOptions = {
        x: 0,
        y: 0, // Placeholder, will be transformed
        fontSize: parseFloat(fillStyle.typography.labelFontSize),
        fontWeight: fillStyle.typography.labelFontWeight,
        align: "left",
        maxWidth: innerWidth,
        shape: "line",
        textColor: fillStyle.textColor,
    };
    const legendSize = layoutLegendHelper(legendGroup, groups, fillStyle, legendOptions);
    const legendX = (innerWidth - legendSize.width) / 2;
    const legendY = -chartMargins.top + 15; // Position above chart area
    legendGroup.attr("transform", `translate(${legendX}, ${legendY})`);


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const slopeLineWidth = 4;
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    const startPointsForLabels = [];
    const endPointsForLabels = [];

    groupedData.forEach((values, groupName) => {
        if (values.length < 2) return; // Need at least two points for a slope

        const groupColor = fillStyle.getGroupColor(groupName, groups.indexOf(groupName));
        const firstPoint = values[0];
        const lastPoint = values[values.length - 1];
        const slopeData = [firstPoint, lastPoint];

        mainChartGroup.append("path")
            .datum(slopeData)
            .attr("class", "mark slope-line")
            .attr("fill", "none")
            .attr("stroke", groupColor)
            .attr("stroke-width", slopeLineWidth)
            .attr("d", lineGenerator);

        startPointsForLabels.push({
            x: xScale(firstPoint[xFieldName]),
            y: yScale(firstPoint[yFieldName]),
            value: firstPoint[yFieldName],
            color: groupColor,
            group: groupName,
            pointData: firstPoint 
        });
        endPointsForLabels.push({
            x: xScale(lastPoint[xFieldName]),
            y: yScale(lastPoint[yFieldName]),
            value: lastPoint[yFieldName],
            color: groupColor,
            group: groupName,
            pointData: lastPoint
        });
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    const startLabelPlacements = placeLabelsDPInternal(startPointsForLabels, innerHeight);
    const endLabelPlacements = placeLabelsDPInternal(endPointsForLabels, innerHeight);

    function drawDataLabels(labelPlacements, isStartLabel) {
        const labelGroup = mainChartGroup.append("g").attr("class", `data-labels ${isStartLabel ? 'start-labels' : 'end-labels'}`);
        
        labelPlacements.forEach(placement => {
            const point = placement.point;
            const labelY = placement.labelY; // This is the top of the label box
            const labelText = Math.round(point.value);
            
            const textWidth = estimateTextWidth(
                labelText, 
                fillStyle.typography.annotationFontSize, 
                fillStyle.typography.annotationFontFamily,
                fillStyle.typography.annotationFontWeight
            );
            const labelPadding = 5;
            const labelRectWidth = textWidth + 2 * labelPadding;
            const labelRectHeight = labelBoxHeightInPixels;

            let labelRectX = point.x + (isStartLabel ? -labelRectWidth - 5 : 5); // Place left for start, right for end
            
            // Adjust if out of bounds
            if (isStartLabel && labelRectX < -chartMargins.left + 5) labelRectX = point.x + 5;
            if (!isStartLabel && labelRectX + labelRectWidth > innerWidth + chartMargins.right - 5) labelRectX = point.x - labelRectWidth - 5;


            labelGroup.append("rect")
                .attr("class", "mark label-background")
                .attr("x", labelRectX)
                .attr("y", labelY)
                .attr("width", labelRectWidth)
                .attr("height", labelRectHeight)
                .attr("rx", 3)
                .attr("ry", 3)
                .attr("fill", point.color)
                .attr("stroke", fillStyle.backgroundColor) // Contrast border
                .attr("stroke-width", 1);

            labelGroup.append("text")
                .attr("class", "label data-label")
                .attr("x", labelRectX + labelRectWidth / 2)
                .attr("y", labelY + labelRectHeight / 2)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("fill", fillStyle.textColor) // Assuming text_color contrasts with point.color (group colors)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(labelText);
        });
    }

    drawDataLabels(startLabelPlacements, true);
    drawDataLabels(endLabelPlacements, false);

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}