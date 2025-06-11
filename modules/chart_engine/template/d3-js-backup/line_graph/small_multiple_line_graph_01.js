/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiple Line Graph",
  "chart_name": "small_multiple_line_graph_01",
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
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function generates a small multiple line graph.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // or data.colors_dark for dark themes, assuming light for now
    const images = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const missingFields = [];
    if (!xFieldConfig) missingFields.push("x field (role='x')");
    if (!yFieldConfig) missingFields.push("y field (role='y')");
    if (!groupFieldConfig) missingFields.push("group field (role='group')");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    if (!chartData || chartData.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    
    const uniqueGroups = [...new Set(chartData.map(d => d[groupFieldName]))];
    if (uniqueGroups.length === 0) {
        const errorMsg = "No groups found in data for small multiples.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) || '14px',
            titleFontWeight: (typography.title && typography.title.font_weight) || 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '10px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            // annotationFontFamily, etc. not used in this chart
        },
        textColor: colors.text_color || '#0f223b',
        subplotTitleColor: colors.text_color || '#1a1a4f', // Specific from original, or use textColor
        axisLabelColor: colors.text_color || '#1a1a4f', // Specific from original, or use textColor
        axisTickColor: colors.text_color || '#110c57', // Specific from original, or use textColor
        gridLineColor: (colors.other && colors.other.grid) || '#1a1a4f', // Use a semantic token or default
        gridLineOpacity: 0.1,
        baselineStrokeColor: (colors.other && colors.other.baseline) || '#333333',
        otherLinesColor: (colors.other && colors.other.background_line) || '#cccccc',
        defaultLineColor: (colors.other && colors.other.primary) || '#1f77b4',
        getGroupColor: (groupName, index) => {
            if (colors.field && colors.field[groupName]) {
                return colors.field[groupName];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return d3.schemeCategory10[index % 10];
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // Note: getBBox on an unattached element can sometimes be unreliable.
        // For full reliability, it might need temporary attachment to DOM, but prompt forbids.
        return textElement.getBBox().width;
    }
    
    function parseItemDate(value) {
        // Assuming value is a string that can be parsed by Date constructor, or already a Date object.
        // More robust parsing might be needed based on dataColumns[x].format if available.
        return new Date(value);
    }

    function createXAxisScaleAndTicks(allChartData, xField, subplotInnerWidth) {
        const allXValues = allChartData.map(d => parseItemDate(d[xField]));
        const xDomain = d3.extent(allXValues);
        
        const xScale = d3.scaleTime()
            .domain(xDomain)
            .range([0, subplotInnerWidth]);

        const timeSpanDays = (xDomain[1] - xDomain[0]) / (1000 * 60 * 60 * 24);
        let xTicks, xFormat;

        if (timeSpanDays <= 1) { // Single day or less
             xTicks = xScale.ticks(d3.timeHour.every(6));
             xFormat = d3.timeFormat("%H:%M");
        } else if (timeSpanDays <= 35) { // ~1 month
            xTicks = xScale.ticks(d3.timeDay.every(Math.max(1, Math.ceil(timeSpanDays / 7))));
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 365 * 2) { // Up to 2 years
            xTicks = xScale.ticks(d3.timeMonth.every(Math.max(1, Math.ceil(timeSpanDays / 30 / 6))));
            xFormat = d3.timeFormat("%b '%y");
        } else { // More than 2 years
            xTicks = xScale.ticks(d3.timeYear.every(Math.max(1, Math.ceil(timeSpanDays / 365 / 5))));
            xFormat = d3.timeFormat("%Y");
        }
        
        if (xDomain[0].getTime() === xDomain[1].getTime()) { // Single distinct date
            xTicks = [xDomain[0]];
             if (timeSpanDays === 0) xFormat = d3.timeFormat("%b %d, %H:%M"); // More specific for single point in time
        } else if (xTicks.length < 2 && xDomain[0] < xDomain[1]) {
             xTicks = xScale.ticks(2); // Ensure at least two ticks if range exists
        }


        return { xScale, xTicks, xFormat };
    }

    function findClosestDataPoint(dataArray, targetDate, xField) {
        if (!dataArray || dataArray.length === 0) return null;
        let closest = dataArray[0];
        let minDiff = Math.abs(parseItemDate(closest[xField]) - targetDate);
        for (let i = 1; i < dataArray.length; i++) {
            const diff = Math.abs(parseItemDate(dataArray[i][xField]) - targetDate);
            if (diff < minDiff) {
                minDiff = diff;
                closest = dataArray[i];
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
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Overall margins

    let numRows, numCols;
    const numGroups = uniqueGroups.length;

    if (numGroups === 4) { numRows = 2; numCols = 2; }
    else if (numGroups === 5) { numRows = 2; numCols = 3; } // 2 on top, 3 on bottom
    else if (numGroups === 6) { numRows = 2; numCols = 3; }
    else if (numGroups === 7) { numRows = 3; numCols = 3; } // 2-3-2 layout
    else if (numGroups <= 3) { numRows = 1; numCols = numGroups; }
    else {
        numCols = Math.ceil(Math.sqrt(numGroups));
        numRows = Math.ceil(numGroups / numCols);
    }

    const subplotWidth = (containerWidth - chartMargins.left - chartMargins.right) / numCols;
    const subplotHeight = (containerHeight - chartMargins.top - chartMargins.bottom) / numRows;
    
    const subplotMargins = { top: 40, right: 20, bottom: 40, left: 40 }; // Margins within each subplot
    const subplotInnerWidth = subplotWidth - subplotMargins.left - subplotMargins.right;
    const subplotInnerHeight = subplotHeight - subplotMargins.top - subplotMargins.bottom;

    if (subplotInnerWidth <=0 || subplotInnerHeight <=0) {
        const errorMsg = "Calculated subplot dimensions are too small. Increase container size or reduce number of groups.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    const baselineValue = d3.mean(chartData, d => d[yFieldName]);

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartData, xFieldName, subplotInnerWidth);

    const yMin = d3.min(chartData, d => d[yFieldName]);
    const yMax = d3.max(chartData, d => d[yFieldName]);
    const yDomainPadding = (yMax - yMin) * 0.1 || Math.abs(yMax * 0.1) || 1; // Handle yMin=yMax or yMin=yMax=0

    const yScale = d3.scaleLinear()
        .domain([yMin - yDomainPadding, yMax + yDomainPadding])
        .range([subplotInnerHeight, 0]);

    const lineGenerator = d3.line()
        .x(d => xScale(parseItemDate(d[xFieldName])))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveMonotoneX);

    // Block 7: Chart Component Rendering (Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Axes and gridlines are rendered per subplot in Block 8.

    // Block 8: Main Data Visualization Rendering
    uniqueGroups.forEach((currentGroup, groupIndex) => {
        let rowIndex, colIndex;
        let actualColOffset = 0; // For centering in special layouts

        if (numGroups === 5) {
            if (groupIndex < 2) { // First 2 groups on top row (0)
                rowIndex = 0;
                colIndex = groupIndex;
                actualColOffset = 0.5; // Center these 2 in a 3-col space
            } else { // Next 3 groups on bottom row (1)
                rowIndex = 1;
                colIndex = groupIndex - 2;
            }
        } else if (numGroups === 7) {
            if (groupIndex < 2) { // First 2 on row 0
                rowIndex = 0;
                colIndex = groupIndex;
                actualColOffset = 0.5; // Center these 2 in a 3-col space
            } else if (groupIndex < 5) { // Next 3 on row 1
                rowIndex = 1;
                colIndex = groupIndex - 2;
            } else { // Last 2 on row 2
                rowIndex = 2;
                colIndex = groupIndex - 5;
                actualColOffset = 0.5; // Center these 2 in a 3-col space
            }
        } else {
            rowIndex = Math.floor(groupIndex / numCols);
            colIndex = groupIndex % numCols;
        }

        const subplotX = chartMargins.left + (colIndex + actualColOffset) * subplotWidth;
        const subplotY = chartMargins.top + rowIndex * subplotHeight;

        const subplotGroup = svgRoot.append("g")
            .attr("class", "mark subplot-group")
            .attr("transform", `translate(${subplotX}, ${subplotY})`);

        const chartAreaGroup = subplotGroup.append("g")
            .attr("class", "chart-area")
            .attr("transform", `translate(${subplotMargins.left}, ${subplotMargins.top})`);

        // Render Y-axis grid lines
        const yAxisTicks = yScale.ticks(3);
        yAxisTicks.forEach(tick => {
            chartAreaGroup.append("line")
                .attr("class", "gridline y-gridline")
                .attr("x1", 0)
                .attr("y1", yScale(tick))
                .attr("x2", subplotInnerWidth)
                .attr("y2", yScale(tick))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-opacity", fillStyle.gridLineOpacity)
                .attr("stroke-dasharray", "2,2");
        });

        // Render baseline
        if (baselineValue !== undefined && baselineValue !== null) {
            chartAreaGroup.append("line")
                .attr("class", "line baseline-line")
                .attr("x1", 0)
                .attr("y1", yScale(baselineValue))
                .attr("x2", subplotInnerWidth)
                .attr("y2", yScale(baselineValue))
                .attr("stroke", fillStyle.baselineStrokeColor)
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3");
        }
        
        // Render X-axis ticks (on baseline) & labels (only for first subplot)
        xTicks.forEach(tickDate => {
            if (baselineValue !== undefined && baselineValue !== null) {
                chartAreaGroup.append("line")
                    .attr("class", "tick x-axis-tick")
                    .attr("x1", xScale(tickDate))
                    .attr("y1", yScale(baselineValue) - 3)
                    .attr("x2", xScale(tickDate))
                    .attr("y2", yScale(baselineValue) + 3)
                    .attr("stroke", fillStyle.axisTickColor)
                    .attr("stroke-width", 1);
            }

            if (groupIndex === 0) { // Only for the first subplot
                const groupDataForXLabel = chartData.filter(d => d[groupFieldName] === uniqueGroups[0]);
                const closestDataPoint = findClosestDataPoint(groupDataForXLabel, tickDate, xFieldName);
                
                let textY = yScale(baselineValue) + 10; // Default below baseline
                let textAnchor = "start"; // Default for rotated text below
                const rotation = -45; // Rotated for better readability

                if (closestDataPoint && baselineValue !== undefined && baselineValue !== null) {
                    const isAboveBaseline = closestDataPoint[yFieldName] > baselineValue;
                    textY = isAboveBaseline ? yScale(baselineValue) + 10 : yScale(baselineValue) - 10;
                    // For rotated text, anchor might need adjustment based on rotation angle and position
                    // With -45 deg rotation, 'end' if above, 'start' if below might work better.
                    textAnchor = isAboveBaseline ? "end" : "start";
                }
                
                chartAreaGroup.append("text")
                    .attr("class", "label x-axis-label")
                    .attr("x", xScale(tickDate))
                    .attr("y", textY)
                    .attr("transform", `rotate(${rotation}, ${xScale(tickDate)}, ${textY})`)
                    .attr("text-anchor", textAnchor)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.axisLabelColor)
                    .text(xFormat(tickDate));
            }
        });

        // Render other groups' lines (background)
        uniqueGroups.forEach(otherGroup => {
            if (otherGroup !== currentGroup) {
                const otherGroupData = chartData.filter(d => d[groupFieldName] === otherGroup);
                if (otherGroupData.length > 0) {
                    chartAreaGroup.append("path")
                        .datum(otherGroupData)
                        .attr("class", "line background-line other")
                        .attr("fill", "none")
                        .attr("stroke", fillStyle.otherLinesColor)
                        .attr("stroke-width", 1)
                        .attr("opacity", 0.5)
                        .attr("d", lineGenerator);
                }
            }
        });

        // Render current group's line (foreground)
        const currentGroupData = chartData.filter(d => d[groupFieldName] === currentGroup);
        if (currentGroupData.length > 0) {
            chartAreaGroup.append("path")
                .datum(currentGroupData)
                .attr("class", "line main-line value")
                .attr("fill", "none")
                .attr("stroke", fillStyle.getGroupColor(currentGroup, groupIndex))
                .attr("stroke-width", 3)
                .attr("d", lineGenerator);
        }

        // Render Y-axis tick labels
        yAxisTicks.forEach(tick => {
            chartAreaGroup.append("text")
                .attr("class", "label y-axis-label")
                .attr("x", -5)
                .attr("y", yScale(tick))
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.axisLabelColor)
                .text(d3.format(".1s")(tick));
        });

        // Render subplot title (group name)
        const titleText = String(currentGroup); // Ensure it's a string
        const titleEstimatedWidth = estimateTextWidth(
            titleText, 
            fillStyle.typography.titleFontFamily, 
            fillStyle.typography.titleFontSize, 
            fillStyle.typography.titleFontWeight
        );
        const titleKeyWidth = 30;
        const titleKeyPadding = 5;
        const totalTitleWidth = titleKeyWidth + titleKeyPadding + titleEstimatedWidth;
        const titleX = (subplotInnerWidth - totalTitleWidth) / 2; // Centered

        chartAreaGroup.append("rect")
            .attr("class", "mark subplot-title-key")
            .attr("x", titleX)
            .attr("y", -subplotMargins.top + 13) // Position relative to chartAreaGroup, adjust to be in margin
            .attr("width", titleKeyWidth)
            .attr("height", 3)
            .attr("fill", fillStyle.getGroupColor(currentGroup, groupIndex));

        chartAreaGroup.append("text")
            .attr("class", "text subplot-title")
            .attr("x", titleX + titleKeyWidth + titleKeyPadding)
            .attr("y", -subplotMargins.top + 15) // Position relative to chartAreaGroup
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", fillStyle.typography.titleFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .style("fill", fillStyle.subplotTitleColor)
            .text(titleText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}