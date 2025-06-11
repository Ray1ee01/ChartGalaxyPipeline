/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Line Graphs",
  "chart_name": "small_multiples_line_graphs_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 8]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is external)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {}; // Parsed, but not used in this chart type
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const getFieldByRole = (role) => {
        const col = dataColumns.find(c => c.role === role);
        return col ? col.name : null;
    };

    const xFieldName = getFieldByRole("x");
    const yFieldName = getFieldByRole("y");
    const groupFieldName = getFieldByRole("group");

    const criticalFields = { xFieldName, yFieldName, groupFieldName };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key.replace("Name", ""));

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing for role(s): [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    if (!chartDataInput || chartDataInput.length === 0) {
        const errorMsg = "Chart data is empty. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) || '14px',
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) || 'bold',
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '10px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
        },
        textColor: colorsConfig.text_color || '#0F223B',
        gridLineColor: (colorsConfig.other && colorsConfig.other.gridLine) || colorsConfig.text_color || '#DDDDDD',
        baselineColor: (colorsConfig.other && colorsConfig.other.baseline) || '#333333',
        otherGroupLineColor: (colorsConfig.other && colorsConfig.other.subtleLine) || '#CCCCCC',
        chartBackground: colorsConfig.background_color || 'transparent',
        groupSpecificColors: colorsConfig.field || {},
        categoricalPalette: colorsConfig.available_colors || d3.schemeCategory10,
        defaultLineColor: (colorsConfig.other && colorsConfig.other.primary) || '#1f77b4'
    };
    
    fillStyle.subplotTitleColor = (colorsConfig.other && colorsConfig.other.subplotTitleColor) || fillStyle.textColor;
    fillStyle.axisLabelColor = (colorsConfig.other && colorsConfig.other.axisLabelColor) || fillStyle.textColor;

    function estimateTextWidth(text, fontFamily, fontSizeString) {
        if (!text || text.length === 0) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSizeString);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Not appended to DOM
        const width = tempText.getBBox().width;
        return width;
    }

    function parseDateValue(dateInput) {
        if (dateInput instanceof Date && !isNaN(dateInput)) return dateInput;
        if (typeof dateInput !== 'string' && typeof dateInput !== 'number') return null;
        
        let parsed = d3.isoParse(String(dateInput));
        if (parsed) return parsed;
        
        parsed = new Date(dateInput); // General fallback
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    
    const chartData = chartDataInput.map(d => {
        const xVal = parseDateValue(d[xFieldName]);
        const yVal = parseFloat(d[yFieldName]);
        return {
            ...d, // Keep original data structure
            [xFieldName]: xVal,
            [yFieldName]: (xVal === null || isNaN(yVal)) ? undefined : yVal // Mark y as undefined if x is null or y is NaN
        };
    }).filter(d => d[xFieldName] !== null && d[yFieldName] !== undefined);


    if (chartData.length === 0) {
        const errorMsg = "No valid data points after parsing and cleaning. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    function createXAxisScaleAndTicksInternal(currentChartData, xValAccessorFn, rangeMin, rangeMax, availableWidth) {
        const xDomain = d3.extent(currentChartData, xValAccessorFn);

        if (xDomain[0] === undefined || xDomain[1] === undefined || xDomain[0] === null || xDomain[1] === null) {
             return { xScale: d3.scaleTime(), xTicks: [], xFormat: () => "", timeSpan: 0 };
        }

        const xScale = d3.scaleTime().domain(xDomain).range([rangeMin, rangeMax]);
        
        const timeDiffMs = xDomain[1].getTime() - xDomain[0].getTime();
        let xTicks, xFormat;

        const numTicksTarget = Math.max(2, Math.min(7, Math.floor(availableWidth / 70)));

        if (timeDiffMs < 2 * 24 * 60 * 60 * 1000) { // Less than 2 days
            xTicks = xScale.ticks(d3.timeHour.every(Math.ceil(48 / numTicksTarget)));
            xFormat = d3.timeFormat("%H:%M");
        } else if (timeDiffMs < 60 * 24 * 60 * 60 * 1000) { // Less than 2 months
            xTicks = xScale.ticks(d3.timeDay.every(Math.ceil(60 / numTicksTarget)));
            xFormat = d3.timeFormat("%b %d");
        } else if (timeDiffMs < 2 * 365 * 24 * 60 * 60 * 1000) { // Less than 2 years
            xTicks = xScale.ticks(d3.timeMonth.every(Math.ceil(24 / numTicksTarget)));
            xFormat = d3.timeFormat("%b '%y");
        } else {
            const numYears = xDomain[1].getFullYear() - xDomain[0].getFullYear();
            xTicks = xScale.ticks(d3.timeYear.every(Math.ceil(Math.max(1, numYears / numTicksTarget ))));
            xFormat = d3.timeFormat("%Y");
        }
        if (xTicks.length > numTicksTarget + 2 && xTicks.length > 3) xTicks = xScale.ticks(numTicksTarget);

        return { xScale, xTicks, xFormat, timeSpan: timeDiffMs };
    }

    function getGroupColor(groupName, groupList) {
        if (fillStyle.groupSpecificColors && fillStyle.groupSpecificColors[groupName]) {
            return fillStyle.groupSpecificColors[groupName];
        }
        if (fillStyle.categoricalPalette && fillStyle.categoricalPalette.length > 0) {
            const colorIndex = groupList.indexOf(groupName);
            return fillStyle.categoricalPalette[colorIndex % fillStyle.categoricalPalette.length];
        }
        return fillStyle.defaultLineColor;
    }

    function findClosestDataPoint(groupDataArray, dateToMatch) {
        if (!groupDataArray || groupDataArray.length === 0 || !(dateToMatch instanceof Date)) return null;
        
        let closest = null;
        let minDiff = Infinity;
        
        for (let i = 0; i < groupDataArray.length; i++) {
            const point = groupDataArray[i];
            if (point[xFieldName] instanceof Date) {
                const diff = Math.abs(point[xFieldName].getTime() - dateToMatch.getTime());
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = point;
                }
            }
        }
        return closest;
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
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 };

    const uniqueGroups = [...new Set(chartData.map(d => d[groupFieldName]))].sort();
    if (uniqueGroups.length === 0) {
         const errorMsg = "No unique groups found in data. Cannot render subplots.";
         console.warn(errorMsg);
         d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMsg}</div>`);
         return svgRoot.node();
    }

    let numRows, numCols;
    const numGroups = uniqueGroups.length;

    if (numGroups === 4) { numRows = 2; numCols = 2; }
    else if (numGroups === 5) { numRows = 2; numCols = 3; }
    else if (numGroups === 6) { numRows = 2; numCols = 3; }
    else if (numGroups === 7) { numRows = 3; numCols = 3; }
    else if (numGroups <= 3) { numRows = 1; numCols = numGroups; }
    else {
        numCols = Math.ceil(Math.sqrt(numGroups));
        numRows = Math.ceil(numGroups / numCols);
    }

    const subplotWidth = (containerWidth - chartMargins.left - chartMargins.right) / numCols;
    const subplotHeight = (containerHeight - chartMargins.top - chartMargins.bottom) / numRows;
    
    const subplotContentMargin = { top: 40, right: 20, bottom: 40, left: 45 }; // Increased left for Y-axis labels
    const innerWidth = subplotWidth - subplotContentMargin.left - subplotContentMargin.right;
    const innerHeight = subplotHeight - subplotContentMargin.top - subplotContentMargin.bottom;

    if (innerWidth <= 10 || innerHeight <= 10) { // Increased threshold
        const errorMsg = `Calculated subplot dimensions (w:${innerWidth.toFixed(1)}, h:${innerHeight.toFixed(1)}) are too small. Adjust overall width/height or reduce number of groups.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    const baselineValue = d3.mean(chartData, d => d[yFieldName]);

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicksInternal(
        chartData, d => d[xFieldName], 0, innerWidth, innerWidth
    );

    const yMinAll = d3.min(chartData, d => d[yFieldName]);
    const yMaxAll = d3.max(chartData, d => d[yFieldName]);
    const yRange = yMaxAll - yMinAll;
    const yPadding = yRange === 0 ? Math.abs(yMaxAll * 0.1) || 1 : yRange * 0.1;

    const yScale = d3.scaleLinear()
        .domain([yMinAll - yPadding, yMaxAll + yPadding])
        .range([innerHeight, 0]);

    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .defined(d => d[xFieldName] != null && d[yFieldName] != null && 
                      xScale(d[xFieldName]) != null && !isNaN(xScale(d[xFieldName])) &&
                      yScale(d[yFieldName]) != null && !isNaN(yScale(d[yFieldName])))
        .curve(d3.curveMonotoneX);

    // Block 7 & 8: Chart Component Rendering & Main Data Visualization
    uniqueGroups.forEach((groupName, i) => {
        let r_idx, c_idx; 
        let colOffset = 0; 

        if (numGroups === 5) {
            if (i < 2) { r_idx = 0; c_idx = i; colOffset = (numCols - 2) / 2; } 
            else { r_idx = 1; c_idx = i - 2; colOffset = 0; } 
        } else if (numGroups === 7) {
            if (i < 2) { r_idx = 0; c_idx = i; colOffset = (numCols - 2) / 2; } 
            else if (i < 5) { r_idx = 1; c_idx = i - 2; colOffset = 0; } 
            else { r_idx = 2; c_idx = i - 5; colOffset = (numCols - 2) / 2; } 
        } else {
            r_idx = Math.floor(i / numCols);
            c_idx = i % numCols;
        }

        const subplotX = chartMargins.left + (c_idx + colOffset) * subplotWidth;
        const subplotY = chartMargins.top + r_idx * subplotHeight;

        const subplotWrapper = svgRoot.append("g")
            .attr("class", "subplot mark")
            .attr("transform", `translate(${subplotX}, ${subplotY})`);

        const subplotGroup = subplotWrapper.append("g")
            .attr("class", "subplot-content")
            .attr("transform", `translate(${subplotContentMargin.left}, ${subplotContentMargin.top})`);

        const titleText = String(groupName);
        const titleFontSizeStr = fillStyle.typography.titleFontSize;
        const titleFontFamily = fillStyle.typography.titleFontFamily;
        const titleEstimatedWidth = estimateTextWidth(titleText, titleFontFamily, titleFontSizeStr);
        const titleRectWidth = 20;
        const titleSpacing = 5;
        const totalTitleWidth = titleRectWidth + titleSpacing + titleEstimatedWidth;
        const titleX = Math.max(0, (innerWidth - totalTitleWidth) / 2); 

        subplotGroup.append("rect")
            .attr("x", titleX)
            .attr("y", -parseFloat(titleFontSizeStr) - 12) 
            .attr("width", titleRectWidth)
            .attr("height", 3)
            .attr("fill", getGroupColor(groupName, uniqueGroups))
            .attr("class", "mark legend-color-sample");

        subplotGroup.append("text")
            .attr("x", titleX + titleRectWidth + titleSpacing)
            .attr("y", -parseFloat(titleFontSizeStr) / 2 - 7) 
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", titleFontFamily)
            .style("font-size", titleFontSizeStr)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .style("fill", fillStyle.subplotTitleColor)
            .attr("class", "label subplot-title")
            .text(titleText);

        const yAxisTicks = yScale.ticks(Math.max(2, Math.min(innerHeight / 30, 4))); // Dynamic ticks
        const yAxisGroup = subplotGroup.append("g").attr("class", "axis y-axis");

        yAxisTicks.forEach(tick => {
            yAxisGroup.append("line")
                .attr("class", "grid-line mark")
                .attr("x1", 0)
                .attr("y1", yScale(tick))
                .attr("x2", innerWidth)
                .attr("y2", yScale(tick))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-opacity", 0.3)
                .attr("stroke-dasharray", "2,2");

            yAxisGroup.append("text")
                .attr("class", "label axis-label y-axis-label")
                .attr("x", -8) // Adjusted for more space
                .attr("y", yScale(tick))
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.axisLabelColor)
                .text(d3.format(".2s")(tick)); // .2s for better precision if needed
        });
        
        if (baselineValue !== undefined && !isNaN(baselineValue) && yScale(baselineValue) >=0 && yScale(baselineValue) <= innerHeight) {
            subplotGroup.append("line")
                .attr("class", "mark baseline")
                .attr("x1", 0)
                .attr("y1", yScale(baselineValue))
                .attr("x2", innerWidth)
                .attr("y2", yScale(baselineValue))
                .attr("stroke", fillStyle.baselineColor)
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3");
        }

        const xAxisGroup = subplotGroup.append("g").attr("class", "axis x-axis");
        if (baselineValue !== undefined && !isNaN(baselineValue) && xTicks.length > 0 && yScale(baselineValue) >=0 && yScale(baselineValue) <= innerHeight) {
            xTicks.forEach(tick => {
                if (xScale(tick) === undefined || isNaN(xScale(tick))) return;

                xAxisGroup.append("line")
                    .attr("class", "mark axis-tick-mark x-axis-tick-mark")
                    .attr("x1", xScale(tick))
                    .attr("y1", yScale(baselineValue) - 3)
                    .attr("x2", xScale(tick))
                    .attr("y2", yScale(baselineValue) + 3)
                    .attr("stroke", fillStyle.axisLabelColor)
                    .attr("stroke-width", 1);

                if (i === 0) { 
                    const groupDataForXLabel = chartData.filter(d => d[groupFieldName] === uniqueGroups[0]);
                    const closestDataPoint = findClosestDataPoint(groupDataForXLabel, tick);
                    
                    const isDataAboveBaseline = closestDataPoint && closestDataPoint[yFieldName] > baselineValue;
                    const labelFontSizePx = parseFloat(fillStyle.typography.labelFontSize);
                    const textYOffset = labelFontSizePx * 1.2;
                    
                    const textY = isDataAboveBaseline 
                        ? yScale(baselineValue) + textYOffset
                        : yScale(baselineValue) - textYOffset;
                    
                    const rotation = 90; 
                    const textAnchor = isDataAboveBaseline ? "start" : "end";

                    xAxisGroup.append("text")
                        .attr("class", "label axis-label x-axis-label")
                        .attr("x", xScale(tick))
                        .attr("y", textY)
                        .attr("transform", `rotate(${rotation}, ${xScale(tick)}, ${textY})`)
                        .attr("text-anchor", textAnchor)
                        .attr("dominant-baseline", "middle")
                        .style("font-family", fillStyle.typography.labelFontFamily)
                        .style("font-size", fillStyle.typography.labelFontSize)
                        .style("font-weight", fillStyle.typography.labelFontWeight)
                        .style("fill", fillStyle.axisLabelColor)
                        .style("opacity", 0.7)
                        .text(xFormat(tick));
                }
            });
        }

        const currentGroupData = chartData.filter(d => d[groupFieldName] === groupName);

        uniqueGroups.forEach(otherGroupName => {
            if (otherGroupName !== groupName) {
                const otherGroupData = chartData.filter(d => d[groupFieldName] === otherGroupName);
                subplotGroup.append("path")
                    .datum(otherGroupData)
                    .attr("class", "line value other-group-line")
                    .attr("fill", "none")
                    .attr("stroke", fillStyle.otherGroupLineColor)
                    .attr("stroke-width", 1)
                    .attr("opacity", 0.5)
                    .attr("d", lineGenerator);
            }
        });

        subplotGroup.append("path")
            .datum(currentGroupData)
            .attr("class", "line value current-group-line")
            .attr("fill", "none")
            .attr("stroke", getGroupColor(groupName, uniqueGroups))
            .attr("stroke-width", 2.5)
            .attr("d", lineGenerator);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None beyond subplot rendering)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}