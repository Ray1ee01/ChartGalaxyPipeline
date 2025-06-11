/* REQUIREMENTS_BEGIN
{
  "chart_type": "Stacked Area Chart",
  "chart_name": "stacked_area_chart_icons_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 10]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartRawData = data.data.data;
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    const missingFields = [];
    if (!xFieldCol || !xFieldCol.name) missingFields.push("x field");
    if (!yFieldCol || !yFieldCol.name) missingFields.push("y field");
    if (!groupFieldCol || !groupFieldCol.name) missingFields.push("group field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const groupFieldName = groupFieldCol.name;
    const yAxisTitleText = yFieldCol.label || yFieldCol.name;


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};

    fillStyle.typography = {
        titleFontFamily: (typographyInput.title && typographyInput.title.font_family) ? typographyInput.title.font_family : 'Arial, sans-serif',
        titleFontSize: (typographyInput.title && typographyInput.title.font_size) ? typographyInput.title.font_size : '16px',
        titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) ? typographyInput.title.font_weight : 'bold',
        labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
        labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px', // For axis ticks
        labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
        annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
        annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '14px', // For data labels on chart, axis titles
        annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
    };

    let activeColors = {};
    const defaultLightColors = {
        background_color: "#FFFFFF",
        text_color: "#0F223B",
        grid_color: "#E0E0E0",
        available_colors: [...d3.schemeCategory10],
        field: {}, other: {}
    };
    const defaultDarkColors = {
        background_color: "#121212",
        text_color: "#E0E0E0",
        grid_color: "rgba(255, 255, 255, 0.1)",
        available_colors: [...d3.schemeTableau10],
        field: {}, other: {}
    };

    if (data.colors_dark) {
        activeColors = { ...defaultDarkColors, ...data.colors_dark };
        activeColors.other = { ...defaultDarkColors.other, ...(data.colors_dark.other || {}) };
        activeColors.field = { ...defaultDarkColors.field, ...(data.colors_dark.field || {}) };
    } else if (data.colors) {
        activeColors = { ...defaultLightColors, ...data.colors };
        activeColors.other = { ...defaultLightColors.other, ...(data.colors.other || {}) };
        activeColors.field = { ...defaultLightColors.field, ...(data.colors.field || {}) };
    } else {
        activeColors = defaultLightColors;
    }

    fillStyle.chartBackground = activeColors.background_color;
    fillStyle.textColor = activeColors.text_color;
    fillStyle.gridLineColor = activeColors.other?.grid_color || (data.colors_dark ? defaultDarkColors.grid_color : defaultLightColors.grid_color);
    fillStyle.axisTickColor = activeColors.other?.axis_tick_color || fillStyle.textColor;
    fillStyle.yAxisTitleColor = fillStyle.textColor;

    const areaColorPalette = activeColors.available_colors || (data.colors_dark ? defaultDarkColors.available_colors : defaultLightColors.available_colors);
    fillStyle.getAreaColor = (group, index) => {
        if (activeColors.field && activeColors.field[group]) {
            return activeColors.field[group];
        }
        return areaColorPalette[index % areaColorPalette.length];
    };

    fillStyle.getImageUrl = (group) => {
        if (imagesInput.field && imagesInput.field[group]) {
            return imagesInput.field[group];
        }
        return null;
    };
    
    function parseDate(dateString) {
        if (dateString instanceof Date && !isNaN(dateString)) return dateString;
        let date = new Date(dateString);
        if (!isNaN(date)) return date;
        // Add more robust parsing if specific formats are expected beyond ISO-like strings
        console.warn(`Date parsing failed for: ${dateString}. Using current date as fallback.`);
        return new Date(); // Fallback to avoid errors, though data might be incorrect
    }

    function createXAxisScaleAndTicksHelper(chartDataForScale, xName, innerWidth) {
        const dates = chartDataForScale.map(d => parseDate(d[xName])).sort((a, b) => a - b);
        constxScale = d3.scaleTime()
            .domain(d3.extent(dates))
            .range([0, innerWidth]);

        let xTicks, xFormat;
        const timeDiff = constxScale.domain()[1] - constxScale.domain()[0];
        const oneDay = 24 * 60 * 60 * 1000;
        const oneMonth = 30 * oneDay; // Approximate
        const oneYear = 365 * oneDay; // Approximate

        const numTicksTarget = Math.max(2, Math.floor(innerWidth / 100)); // Aim for a tick every 100px

        if (timeDiff < 2 * oneDay) {
            xTicks = constxScale.ticks(d3.timeHour.every(Math.ceil(24 / numTicksTarget)));
            xFormat = d3.timeFormat("%H:%M");
        } else if (timeDiff < 2 * oneMonth) {
            xTicks = constxScale.ticks(d3.timeDay.every(Math.ceil(30 / numTicksTarget)));
            xFormat = d3.timeFormat("%b %d");
        } else if (timeDiff < 2 * oneYear) {
            xTicks = constxScale.ticks(d3.timeMonth.every(Math.ceil(12 / numTicksTarget)));
            xFormat = d3.timeFormat("%b %Y");
        } else {
            xTicks = constxScale.ticks(d3.timeYear.every(Math.ceil((timeDiff / oneYear) / numTicksTarget)));
            xFormat = d3.timeFormat("%Y");
        }
        return { xScale: constxScale, xTicks, xFormat };
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const svgWidth = variables.width || 800;
    const svgHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 60, bottom: 50, left: 80 }; // Increased bottom for X labels
    const innerWidth = svgWidth - chartMargins.left - chartMargins.right;
    const innerHeight = svgHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "other chart-main-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = [...new Set(chartRawData.map(d => d[groupFieldName]))]
        .sort((a, b) => {
            const avgA = d3.mean(chartRawData.filter(d => d[groupFieldName] === a), d => d[yFieldName]);
            const avgB = d3.mean(chartRawData.filter(d => d[groupFieldName] === b), d => d[yFieldName]);
            return avgA - avgB; // Ascending sort, smaller averages at bottom of stack
        });

    const groupedByX = d3.group(chartRawData, d => d[xFieldName]);
    
    const stackInputData = Array.from(groupedByX, ([key, values]) => {
        const obj = { date: parseDate(key) };
        values.forEach(v => {
            obj[v[groupFieldName]] = v[yFieldName];
        });
        return obj;
    });

    stackInputData.forEach(d => {
        groups.forEach(group => {
            if (d[group] === undefined) {
                d[group] = 0; // Ensure all groups have a value (0 if missing)
            }
        });
    });

    stackInputData.sort((a, b) => a.date - b.date);

    const stackGenerator = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone) // Uses the order of keys (groups)
        .offset(d3.stackOffsetNone);

    const stackedData = stackGenerator(stackInputData);

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicksHelper(chartRawData, xFieldName, innerWidth);

    const yMax = d3.max(stackedData[stackedData.length - 1], d => d[1]) * 1.1 || 10; // Ensure yMax is at least 10
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    // Y-axis Gridlines
    const yAxisTicks = yScale.ticks(5);
    yAxisTicks.forEach(tick => {
        mainChartGroup.append("line")
            .attr("class", "other gridline y-axis-gridline")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", innerWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-opacity", tick === 0 ? 0.5 : 1); // Make baseline slightly more prominent if needed, or remove opacity
    });

    // Y-axis Tick Labels
    yAxisTicks.forEach(tick => {
        mainChartGroup.append("text")
            .attr("class", "label tick-label y-axis-tick-label")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.axisTickColor)
            .text(d3.format(".1s")(tick));
    });
    
    // Y-axis Title
    mainChartGroup.append("text")
        .attr("class", "label axis-title y-axis-title")
        .attr("transform", "rotate(-90)")
        .attr("y", -chartMargins.left + 20)
        .attr("x", -innerHeight / 2)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .attr("fill", fillStyle.yAxisTitleColor)
        .text(yAxisTitleText);

    // X-axis Tick Labels
    xTicks.forEach((tick) => {
        mainChartGroup.append("text")
            .attr("class", "label tick-label x-axis-tick-label")
            .attr("x", xScale(tick))
            .attr("y", innerHeight + 25) // Position below the axis line
            .attr("text-anchor", "middle") // Changed to middle for better centering under ticks
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.axisTickColor)
            .text(xFormat(tick));
    });

    // Block 8: Main Data Visualization Rendering
    const areaGenerator = d3.area()
        .x(d => xScale(d.data.date))
        .y0(d => yScale(d[0]))
        .y1(d => yScale(d[1]))
        .curve(d3.curveLinear);

    stackedData.forEach((seriesData, i) => {
        const groupName = seriesData.key;
        mainChartGroup.append("path")
            .datum(seriesData)
            .attr("class", "mark area-series")
            .attr("fill", fillStyle.getAreaColor(groupName, i))
            .attr("d", areaGenerator);
    });

    // Block 9: Optional Enhancements & Post-Processing (Icons and Labels on Areas)
    stackedData.forEach((seriesData) => {
        const groupName = seriesData.key;
        const d = seriesData; // d is the array of [y0, y1] points for this series

        const gridSize = 10; // 10px wide grid cells for sampling
        const numGrids = Math.floor(innerWidth / gridSize);
        let gridWidths = [];

        for (let gridIdx = 0; gridIdx < numGrids; gridIdx++) {
            const gridX = gridIdx * gridSize + gridSize / 2; // Center of grid cell
            if (gridX > innerWidth) continue;
            const gridDate = xScale.invert(gridX);

            let leftIdx = -1, rightIdx = -1;
            for (let j = 0; j < d.length - 1; j++) {
                if (d[j].data.date <= gridDate && d[j + 1].data.date >= gridDate) {
                    leftIdx = j;
                    rightIdx = j + 1;
                    break;
                }
            }
             if (leftIdx === -1 && d.length > 0) { // If gridDate is before first data point or after last
                if (gridDate < d[0].data.date && d.length > 0) { leftIdx = 0; rightIdx = 0; }
                else if (gridDate > d[d.length-1].data.date && d.length > 0) { leftIdx = d.length-1; rightIdx = d.length-1; }
                else { continue; } // Should not happen if data spans range
            } else if (leftIdx === -1) {
                continue;
            }


            const leftDate = d[leftIdx].data.date;
            const rightDate = d[rightIdx].data.date;
            let ratio = 0;
            if (rightDate - leftDate !== 0) {
                ratio = (gridDate - leftDate) / (rightDate - leftDate);
            } else if (gridDate.getTime() === leftDate.getTime()) {
                ratio = 0; // Or 1, depending on which point to pick if dates are identical
            } else { // Should not happen if dates are sorted and distinct
                continue;
            }
            ratio = Math.max(0, Math.min(1, ratio)); // Clamp ratio


            const y0Val = d3.interpolateNumber(d[leftIdx][0], d[rightIdx][0])(ratio);
            const y1Val = d3.interpolateNumber(d[leftIdx][1], d[rightIdx][1])(ratio);
            
            gridWidths.push({
                gridIdx: gridIdx,
                gridX: gridX,
                y0: yScale(y0Val), // Screen coordinate
                y1: yScale(y1Val)  // Screen coordinate
            });
        }
        
        if (gridWidths.length === 0) continue;

        let avgWidths = [];
        const windowSize = 5; // 5 before, current, 5 after (total 11)
        for (let i = 0; i < gridWidths.length; i++) {
            let sumWidth = 0;
            let count = 0;
            let currentSliceY0 = gridWidths[i].y0; // Screen y0 (top of slice)
            let currentSliceY1 = gridWidths[i].y1; // Screen y1 (bottom of slice)

            // Iterate over window
            for (let j = Math.max(0, i - windowSize); j <= Math.min(gridWidths.length - 1, i + windowSize); j++) {
                // The original logic for sum was complex, let's simplify to average of actual widths in window
                sumWidth += (gridWidths[j].y0 - gridWidths[j].y1); // height of slice at j (y0 is larger if lower on screen)
                count++;
            }
            if (count > 0) {
                 avgWidths.push({
                    gridIdx: gridWidths[i].gridIdx,
                    gridX: gridWidths[i].gridX,
                    avgWidth: sumWidth / count, // Average height of area in window
                    y0: gridWidths[i].y0, // Keep original y0, y1 for this specific gridX
                    y1: gridWidths[i].y1
                });
            }
        }
        
        if (avgWidths.length === 0) continue;

        let maxGain = -Infinity;
        let bestGrid = null;
        // Search in the latter half of the chart for a good spot
        const searchStartIndex = Math.floor(avgWidths.length / 2);
        for (let i = searchStartIndex; i < avgWidths.length; i++) {
            const gain = avgWidths[i].avgWidth + 0.1 * i; // Original gain formula
            if (gain > maxGain) {
                maxGain = gain;
                bestGrid = avgWidths[i];
            }
        }

        if (!bestGrid) { // Fallback if no suitable grid found
            bestGrid = avgWidths[Math.floor(avgWidths.length / 2)]; // Pick middle one
            if (!bestGrid) continue; // Still no grid
        }
        
        const labelX = bestGrid.gridX;
        let labelY = bestGrid.y1 + (bestGrid.y0 - bestGrid.y1) * 0.5; // Midpoint of the area slice (y1 is top, y0 is bottom in screen coords)
        const areaHeightAtLabel = bestGrid.y0 - bestGrid.y1;

        const imageUrl = fillStyle.getImageUrl(groupName);
        const imgSize = 60;
        const minHeightForImage = imgSize + 10; // Min area height to show image

        if (imageUrl && areaHeightAtLabel >= minHeightForImage) {
            const imageYPosition = labelY - imgSize / 2 - 5; // Image centered slightly above text
            mainChartGroup.append("image")
                .attr("class", "image icon data-icon")
                .attr("x", labelX - imgSize / 2)
                .attr("y", imageYPosition)
                .attr("width", imgSize)
                .attr("height", imgSize)
                .attr("xlink:href", imageUrl)
                .style("pointer-events", "none");
            
            labelY += imgSize / 2; // Shift text label down to be below the image
        }

        mainChartGroup.append("text")
            .attr("class", "label data-label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", fillStyle.textColor) // Ensure contrast with area fill
            .style("opacity", 0.9)
            .text(groupName);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}