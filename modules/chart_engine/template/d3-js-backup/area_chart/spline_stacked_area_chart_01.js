/* REQUIREMENTS_BEGIN
{
  "chart_type": "Stacked Area Chart",
  "chart_name": "spline_stacked_area_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 6]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "ascending",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data.data;
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || data.colors || {}; // Prefer dark theme colors
    const imagesConfig = data.images || {};
    const dataColumns = data.data.columns || [];

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
        let missingFields = [];
        if (!xFieldName) missingFields.push(xFieldRole);
        if (!yFieldName) missingFields.push(yFieldRole);
        if (!groupFieldName) missingFields.push(groupFieldRole);
        
        const errorMsg = `Critical chart config missing: roles [${missingFields.join(', ')}] not found in dataColumns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: {},
        colors: {}
    };

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = (typographyConfig.title && typographyConfig.title.font_family) || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = (typographyConfig.title && typographyConfig.title.font_size) || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = (typographyConfig.title && typographyConfig.title.font_weight) || defaultTypography.title.font_weight;
    fillStyle.typography.labelFontFamily = (typographyConfig.label && typographyConfig.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (typographyConfig.label && typographyConfig.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (typographyConfig.label && typographyConfig.label.font_weight) || defaultTypography.label.font_weight;
    // Annotation typography is defined but not explicitly used in this chart based on original
    fillStyle.typography.annotationFontFamily = (typographyConfig.annotation && typographyConfig.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (typographyConfig.annotation && typographyConfig.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (typographyConfig.annotation && typographyConfig.annotation.font_weight) || defaultTypography.annotation.font_weight;

    // Color defaults (dark theme oriented)
    fillStyle.colors.chartBackground = colorsConfig.background_color || '#222222';
    fillStyle.colors.textColor = colorsConfig.text_color || '#E0E0E0';
    fillStyle.colors.gridLineColor = colorsConfig.other && colorsConfig.other.gridLine ? colorsConfig.other.gridLine : '#444444'; // Assuming gridLine could be in other
    fillStyle.colors.axisLineColor = colorsConfig.other && colorsConfig.other.axisLine ? colorsConfig.other.axisLine : '#666666'; // Assuming axisLine could be in other
    
    const defaultCategoricalColors = d3.schemeTableau10;
    let colorIndex = 0;
    fillStyle.colors.getGroupColor = (groupName) => {
        if (colorsConfig.field && colorsConfig.field[groupName]) {
            return colorsConfig.field[groupName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            // Find groupName in sorted unique group names to get a consistent index
            const uniqueGroups = [...new Set(chartDataInput.map(d => d[groupFieldName]))].sort();
            const idx = uniqueGroups.indexOf(groupName);
            return colorsConfig.available_colors[idx % colorsConfig.available_colors.length];
        }
        const uniqueGroups = [...new Set(chartDataInput.map(d => d[groupFieldName]))].sort();
        const idx = uniqueGroups.indexOf(groupName);
        return defaultCategoricalColors[idx % defaultCategoricalColors.length];
    };
    
    fillStyle.images.getGroupImage = (groupName) => {
        if (imagesConfig.field && imagesConfig.field[groupName]) {
            return imagesConfig.field[groupName];
        }
        return (imagesConfig.other && imagesConfig.other.default) || null; // Optional: default image
    };
    
    // Helper: In-memory text measurement (Not used in this specific chart's logic but good practice to have)
    // function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
    //     const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    //     const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    //     textEl.setAttribute('font-weight', fontWeight);
    //     textEl.setAttribute('font-size', fontSize);
    //     textEl.setAttribute('font-family', fontFamily);
    //     textEl.textContent = text;
    //     svg.appendChild(textEl);
    //     const width = textEl.getBBox().width;
    //     return width;
    // }

    // Helper: Date parsing (assuming ISO 8601 or a format d3.autoType handles, or customize)
    const parseDate = d3.isoParse; // More robust than custom parsing if dates are ISO

    // Helper: X-axis scale and ticks configuration
    function createXAxisConfiguration(processedChartData, xValueAccessor, chartInnerWidth) {
        const dates = processedChartData.map(xValueAccessor);
        const xDomain = d3.extent(dates);
        
        const xScale = d3.scaleTime().domain(xDomain).range([0, chartInnerWidth]);
    
        let xTicks, xFormat;
        const timeSpanDays = (xDomain[1] - xDomain[0]) / (1000 * 60 * 60 * 24);
    
        if (timeSpanDays <= 2) {
            xTicks = xScale.ticks(d3.timeHour.every(6));
            xFormat = d3.timeFormat("%H:%M");
        } else if (timeSpanDays <= 30) {
            xTicks = xScale.ticks(d3.timeDay.every(Math.ceil(timeSpanDays / 7) || 1));
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 365 * 2) {
            xTicks = xScale.ticks(d3.timeMonth.every(Math.ceil(timeSpanDays / 30 / 7) || 1));
            xFormat = d3.timeFormat("%b '%y");
        } else {
            xTicks = xScale.ticks(d3.timeYear.every(Math.ceil(timeSpanDays / 365 / 7) || 1));
            xFormat = d3.timeFormat("%Y");
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
        .style("background-color", fillStyle.colors.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 60, bottom: 50, left: 80 }; // Adjusted bottom for X-axis labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    let processedChartData = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]), // Ensure xField is Date object
        [yFieldName]: +d[yFieldName] // Ensure yField is number
    }));
    
    // Get unique group values and sort them by average yFieldName value (ascending)
    const groupNames = [...new Set(processedChartData.map(d => d[groupFieldName]))]
        .sort((a, b) => {
            const avgA = d3.mean(processedChartData.filter(d => d[groupFieldName] === a), d => d[yFieldName]);
            const avgB = d3.mean(processedChartData.filter(d => d[groupFieldName] === b), d => d[yFieldName]);
            return avgA - avgB;
        });

    // Group data by date (xFieldName) for stacking
    const groupedByDate = d3.group(processedChartData, d => d[xFieldName]);
    
    const stackInputData = Array.from(groupedByDate, ([date, values]) => {
        const obj = { date: date }; // date is already a Date object
        groupNames.forEach(group => obj[group] = 0); // Initialize all groups with 0
        values.forEach(v => {
            obj[v[groupFieldName]] = v[yFieldName];
        });
        return obj;
    }).sort((a, b) => a.date - b.date); // Sort by date

    const stackGenerator = d3.stack()
        .keys(groupNames)
        .order(d3.stackOrderNone) // Use order from groupNames array
        .offset(d3.stackOffsetNone);

    const stackedData = stackGenerator(stackInputData);

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisConfiguration(processedChartData, d => d[xFieldName], innerWidth);
    
    const yMax = d3.max(stackedData[stackedData.length - 1], d => d[1]) * 1.1 || 10; // Ensure yMax is at least 10 if data is all 0
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Y-axis and Gridlines
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");
        
    const yAxisTicks = yScale.ticks(5);

    yAxisTicks.forEach(tick => {
        yAxisGroup.append("line")
            .attr("class", "grid-line")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", innerWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.colors.gridLineColor)
            .attr("stroke-opacity", 0.7); // Original was 0.1 on white, adjust for dark theme

        yAxisGroup.append("text")
            .attr("class", "axis-label tick-label y-tick-label")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.colors.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(d3.format("~s")(tick)); // Use ~s for SI prefix, .1s can be too specific
    });
    
    // Y-axis Title
    mainChartGroup.append("text")
        .attr("class", "axis-title y-axis-title label")
        .attr("transform", "rotate(-90)")
        .attr("y", -chartMargins.left + 20)
        .attr("x", -innerHeight / 2)
        .attr("text-anchor", "middle")
        .attr("fill", fillStyle.colors.textColor)
        .style("font-family", fillStyle.typography.titleFontFamily)
        .style("font-size", fillStyle.typography.titleFontSize)
        .style("font-weight", fillStyle.typography.titleFontWeight)
        .text(yFieldName);

    // X-axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .attr("class", "axis x-axis");

    xTicks.forEach(tick => {
        xAxisGroup.append("text")
            .attr("class", "axis-label tick-label x-tick-label")
            .attr("x", xScale(tick))
            .attr("y", chartMargins.bottom / 2) // Position in the middle of bottom margin
            .attr("text-anchor", "middle") // Changed from "start" for better centering
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.colors.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xFormat(tick));
    });
    
    // Add X axis line if desired (often omitted if gridlines are present)
    // xAxisGroup.append("line")
    //     .attr("x1", 0).attr("x2", innerWidth)
    //     .attr("y1", 0).attr("y2", 0)
    //     .attr("stroke", fillStyle.colors.axisLineColor);


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const areaGenerator = d3.area()
        .x(d => xScale(d.data.date))
        .y0(d => yScale(d[0]))
        .y1(d => yScale(d[1]))
        .curve(d3.curveBasis); // Smooth curve

    mainChartGroup.selectAll(".area-path")
        .data(stackedData)
        .enter()
        .append("path")
        .attr("class", d => `mark area-path area-${d.key.replace(/\s+/g, '-').toLowerCase()}`)
        .attr("fill", d => fillStyle.colors.getGroupColor(d.key))
        .attr("d", areaGenerator);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Logic for placing group labels and icons within areas
    stackedData.forEach((seriesData) => {
        const groupName = seriesData.key;
        const seriesPoints = seriesData; // This is an array of [y0, y1, data: {date, groupValues...}]

        const gridSize = 10; // pixels
        const numGrids = Math.floor(innerWidth / gridSize);
        let gridMetrics = [];

        for (let gridIdx = 0; gridIdx < numGrids; gridIdx++) {
            const currentGridX = gridIdx * gridSize;
            const currentDate = xScale.invert(currentGridX);

            let leftIdx = 0;
            for (let j = 0; j < seriesPoints.length - 1; j++) {
                if (seriesPoints[j].data.date <= currentDate && seriesPoints[j+1].data.date >= currentDate) {
                    leftIdx = j;
                    break;
                }
            }
            const rightIdx = Math.min(leftIdx + 1, seriesPoints.length - 1);

            const leftPoint = seriesPoints[leftIdx];
            const rightPoint = seriesPoints[rightIdx];
            
            let y0Value, y1Value;
            if (leftPoint.data.date.getTime() === rightPoint.data.date.getTime() || leftPoint.data.date >= currentDate) { // At or before first point
                 y0Value = leftPoint[0];
                 y1Value = leftPoint[1];
            } else if (rightPoint.data.date <= currentDate) { // At or after last point
                 y0Value = rightPoint[0];
                 y1Value = rightPoint[1];
            } else { // Interpolate
                const ratio = (currentDate - leftPoint.data.date) / (rightPoint.data.date - leftPoint.data.date);
                y0Value = d3.interpolateNumber(leftPoint[0], rightPoint[0])(ratio);
                y1Value = d3.interpolateNumber(leftPoint[1], rightPoint[1])(ratio);
            }
            
            gridMetrics.push({
                gridIdx: gridIdx,
                gridX: currentGridX,
                yScreenBottom: yScale(y0Value), // Screen Y for bottom of segment (larger Y value)
                yScreenTop: yScale(y1Value),     // Screen Y for top of segment (smaller Y value)
            });
        }
        
        if (gridMetrics.length < 11) { // Not enough data points for the window calculation
             // Potentially add a simpler label placement here if desired, or skip
            return;
        }

        let avgWidths = [];
        // Original logic for avgWidths calculation (window size 11: 5 before, center, 5 after)
        for (let i = 5; i < gridMetrics.length - 5; i++) {
            let currentYScreenBottom = gridMetrics[i].yScreenBottom;
            let currentYScreenTop = gridMetrics[i].yScreenTop;
            let sumOfEffectiveHeights = currentYScreenBottom - currentYScreenTop; // Height at current point i

            // Backward pass
            let tempYBottom = currentYScreenBottom;
            let tempYTop = currentYScreenTop;
            for (let j = i - 1; j >= i - 5; j--) {
                if (gridMetrics[j].yScreenBottom < tempYBottom) tempYBottom = gridMetrics[j].yScreenBottom; // This seems to be finding min y_bottom (highest on screen)
                if (gridMetrics[j].yScreenTop > tempYTop) tempYTop = gridMetrics[j].yScreenTop;       // This seems to be finding max y_top (lowest on screen)
                // The original logic was: if (gridWidths[j].y0 < curY0) curY0 = gridWidths[j].y0;
                // This means curY0 tracks the smallest screen Y for the bottom edge (highest position on screen).
                // And curY1 tracks the largest screen Y for the top edge (lowest position on screen).
                // This would make (curY0 - curY1) potentially small or negative.
                // Let's use the direct interpretation of the original code's variable names y0, y1
                // y0 = screen val for data val d[0], y1 = screen val for data val d[1]
                // Original: if (gridWidths[j].y0 < curY0) curY0 = gridWidths[j].y0;
                // Original: if (gridWidths[j].y1 > curY1) curY1 = gridWidths[j].y1;
                // This implies curY0 is tracking the highest bottom edge, curY1 the lowest top edge.
                // This is likely not what was intended for "width".
                // Sticking to the original structure:
                if (gridMetrics[j].yScreenBottom < tempYBottom) tempYBottom = gridMetrics[j].yScreenBottom;
                if (gridMetrics[j].yScreenTop > tempYTop) tempYTop = gridMetrics[j].yScreenTop;
                sumOfEffectiveHeights += (tempYBottom - tempYTop);
            }

            // Forward pass (resetting tempYBottom, tempYTop to center point)
            tempYBottom = currentYScreenBottom;
            tempYTop = currentYScreenTop;
            for (let j = i + 1; j <= i + 5; j++) {
                if (gridMetrics[j].yScreenBottom < tempYBottom) tempYBottom = gridMetrics[j].yScreenBottom;
                if (gridMetrics[j].yScreenTop > tempYTop) tempYTop = gridMetrics[j].yScreenTop;
                sumOfEffectiveHeights += (tempYBottom - tempYTop);
            }
            
            avgWidths.push({
                gridX: gridMetrics[i].gridX,
                avgWidth: sumOfEffectiveHeights / 11, // 11 points in window
                yScreenBottomAtGridX: gridMetrics[i].yScreenBottom,
                yScreenTopAtGridX: gridMetrics[i].yScreenTop
            });
        }
        
        if (avgWidths.length === 0) return;

        let maxGain = -Infinity;
        let bestGrid = null;
        // Search only in the latter half of avgWidths
        const searchStartIndex = Math.floor(avgWidths.length / 2);
        for (let i = searchStartIndex; i < avgWidths.length; i++) {
            const gain = avgWidths[i].avgWidth + (0.1 * i); // Bonus for being further right
            if (gain > maxGain) {
                maxGain = gain;
                bestGrid = avgWidths[i];
            }
        }

        if (!bestGrid) return;

        const areaThicknessAtBestX = bestGrid.yScreenBottomAtGridX - bestGrid.yScreenTopAtGridX;
        const minHeightForImage = 70;
        const imgSize = 60;
        
        let labelX = bestGrid.gridX;
        let labelY = bestGrid.yScreenTopAtGridX + (areaThicknessAtBestX / 2); // Midpoint of the segment vertically

        const imageUrl = fillStyle.images.getGroupImage(groupName);
        if (areaThicknessAtBestX >= minHeightForImage && imageUrl) {
            labelY += 25; // Move text label down to make space for image
            
            mainChartGroup.append("image")
                .attr("class", "icon data-icon")
                .attr("x", labelX - imgSize / 2)
                .attr("y", labelY - imgSize - 5 - 25) // Place image above original labelY, adjusted for new labelY
                .attr("width", imgSize)
                .attr("height", imgSize)
                .attr("xlink:href", imageUrl)
                .style("pointer-events", "none");
        }

        mainChartGroup.append("text")
            .attr("class", "label data-label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize) // Using labelFontSize for group names on areas
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.colors.textColor) // Ensure contrast with area fill
            .style("opacity", 0.9) // Slightly reduced opacity from original
            .text(groupName);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}