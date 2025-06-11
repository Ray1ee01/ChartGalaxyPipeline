/* REQUIREMENTS_BEGIN
{
  "chart_type": "Range Area Chart",
  "chart_name": "range_area_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": [],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 2]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_edge"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const yFieldName = yFieldConfig ? yFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    const yFieldDescription = yFieldConfig ? yFieldConfig.description : yFieldName;
    const yFieldUnit = yFieldConfig ? yFieldConfig.unit : "";


    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x field" : null,
            !yFieldName ? "y field" : null,
            !groupFieldName ? "group field" : null,
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: [${missingFields} role mapping in dataColumns]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    if (chartDataInput.length === 0) {
        const errorMsg = "Chart data is empty. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
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
            axisLabelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '10px', // Specific for axis ticks
            axisTitleFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px', // Specific for axis titles
            valueLabelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '16px', // For endpoint values
            groupNameFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px', // For group names at endpoints
            ratioLabelFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '16px', // For ratio numbers
            ratioTextFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '12px', // For "Ratio" text
        },
        textColor: colorsConfig.text_color || '#0f223b',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        gridLineColor: colorsConfig.other && colorsConfig.other.grid_subtle ? colorsConfig.other.grid_subtle : '#cccccc',
        axisLineColor: colorsConfig.other && colorsConfig.other.axis_line ? colorsConfig.other.axis_line : '#666666',
        areaFillColor: (colorsConfig.other && colorsConfig.other.primary) || (colorsConfig.available_colors && colorsConfig.available_colors[0]) || '#e0e0e0',
        lineColors: {}, // To be populated based on selected groups
        groupImageUrls: {}, // To be populated
        arrowColor: colorsConfig.other && colorsConfig.other.annotation_line ? colorsConfig.other.annotation_line : '#333333',
    };

    const defaultColors = d3.schemeCategory10;

    // Helper to parse date, assuming common formats or ISO 8601
    const parseDate = (dateStr) => {
        if (dateStr instanceof Date) return dateStr;
        // Attempt common formats
        const formats = ["%Y-%m-%dT%H:%M:%S.%LZ", "%Y-%m-%dT%H:%M:%S%Z", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"];
        for (const format of formats) {
            const parsed = d3.timeParse(format)(dateStr);
            if (parsed) return parsed;
        }
        // Fallback for simple year strings if x-axis is just years
        if (/^\d{4}$/.test(dateStr)) return d3.timeParse("%Y")(dateStr);
        console.warn(`Date parsing failed for: ${dateStr}. Returning null.`);
        return null;
    };
    
    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('style', `font-family: ${fontProps.fontFamily}; font-size: ${fontProps.fontSize}; font-weight: ${fontProps.fontWeight};`);
        textNode.textContent = text;
        svg.appendChild(textNode);
        // Note: Appending to body and then removing is more reliable for getBBox, but against rules.
        // This in-memory approach might be less accurate for some browsers/fonts.
        // For more accuracy if issues arise: document.body.appendChild(svg); const width = textNode.getBBox().width; document.body.removeChild(svg); return width;
        try {
            return textNode.getBBox().width;
        } catch (e) {
            // Fallback if getBBox is not available (e.g. JSDOM without layout)
            return text.length * (parseInt(fontProps.fontSize) || 10) * 0.6;
        }
    };


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
    const chartMargins = { top: 60, right: 80, bottom: 60, left: 80 };
    if (variables.dynamic_margins) { // Example of a variable that might affect margins
        // Adjust margins based on variables if needed
    }
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartData = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName]
    })).filter(d => d[xFieldName] !== null && !isNaN(d[yFieldName]));

    if (chartData.length < 2) { // Need at least 2 points for a line/area
        const errorMsg = "Insufficient valid data points after parsing. Cannot render chart.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }
    
    const groupNames = [...new Set(chartData.map(d => d[groupFieldName]))];

    if (groupNames.length < 2) {
        const errorMsg = "Range area chart requires at least two groups. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    const groupAverages = groupNames.map(group => {
        const groupData = chartData.filter(d => d[groupFieldName] === group);
        const avg = d3.mean(groupData, d => d[yFieldName]);
        return { group, avg };
    });
    groupAverages.sort((a, b) => b.avg - a.avg); // Sort descending by average

    const highestGroup = groupAverages[0].group;
    const lowestGroup = groupAverages[groupAverages.length - 1].group;
    const selectedGroupNames = [highestGroup, lowestGroup];

    // Populate dynamic fillStyle colors and images
    selectedGroupNames.forEach((groupName, i) => {
        fillStyle.lineColors[groupName] = (colorsConfig.field && colorsConfig.field[groupName]) ||
                                         (colorsConfig.available_colors && colorsConfig.available_colors[i % colorsConfig.available_colors.length]) ||
                                         defaultColors[i % defaultColors.length];
        if (imagesConfig.field && imagesConfig.field[groupName]) {
            fillStyle.groupImageUrls[groupName] = imagesConfig.field[groupName];
        }
    });


    let group1Data = chartData.filter(d => d[groupFieldName] === highestGroup)
                              .sort((a, b) => a[xFieldName] - b[xFieldName]);
    let group2Data = chartData.filter(d => d[groupFieldName] === lowestGroup)
                              .sort((a, b) => a[xFieldName] - b[xFieldName]);

    // Ensure both groups have data for the area calculation
    if (group1Data.length === 0 || group2Data.length === 0) {
        const errorMsg = "One or both selected groups have no valid data points. Cannot render range area.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    const areaData = [];
    const allXValues = new Set([...group1Data.map(d => d[xFieldName].getTime()), ...group2Data.map(d => d[xFieldName].getTime())]);
    const sortedXValues = Array.from(allXValues).map(t => new Date(t)).sort((a,b) => a - b);

    sortedXValues.forEach(date => {
        const g1Point = group1Data.find(d => d[xFieldName].getTime() === date.getTime());
        const g2Point = group2Data.find(d => d[xFieldName].getTime() === date.getTime());

        // For area, we need values from both. If one is missing, we might interpolate or skip.
        // For simplicity, this version requires points at same X for area.
        // A more robust version might interpolate.
        if (g1Point && g2Point) {
             areaData.push({
                [xFieldName]: date,
                group1Value: g1Point[yFieldName],
                group2Value: g2Point[yFieldName]
            });
        }
    });
    
    if (areaData.length < 2) {
        // This can happen if the two groups don't have overlapping x-values.
        // The chart can still draw lines, but the area might be empty or look odd.
        // For this version, we'll allow lines to be drawn but area might not.
        console.warn("Area data has less than 2 points, area path might not be visible.");
    }


    // Block 6: Scale Definition & Configuration
    const xDomain = d3.extent(chartData, d => d[xFieldName]);
    const xScale = d3.scaleTime().domain(xDomain).range([0, innerWidth]);

    const timeSpanDays = (xDomain[1] - xDomain[0]) / (1000 * 60 * 60 * 24);
    let xTicks, xAxisFormat;
    if (timeSpanDays > 365 * 5) { // Very long spans, show years, maybe every 2-5 years
        xTicks = xScale.ticks(d3.timeYear.every(Math.max(1, Math.ceil(timeSpanDays / 365 / 7)))); // ~7 ticks
        xAxisFormat = d3.timeFormat("%Y");
    } else if (timeSpanDays > 365) { // Multi-year, show years
        xTicks = xScale.ticks(d3.timeYear.every(1));
        xAxisFormat = d3.timeFormat("%Y");
    } else if (timeSpanDays > 60) { // Multi-month, show Mon 'YY
        xTicks = xScale.ticks(d3.timeMonth.every(Math.max(1, Math.ceil(timeSpanDays / 30 / 7)))); // ~7 ticks
        xAxisFormat = d3.timeFormat("%b '%y");
    } else if (timeSpanDays > 7) { // Multi-week, show Mon Day
        xTicks = xScale.ticks(d3.timeWeek.every(Math.max(1, Math.ceil(timeSpanDays / 7 / 7)))); // ~7 ticks
        xAxisFormat = d3.timeFormat("%b %d");
    } else { // Daily, show Day
        xTicks = xScale.ticks(d3.timeDay.every(1));
        xAxisFormat = d3.timeFormat("%a %d");
    }


    const yMinRaw = d3.min(chartData, d => d[yFieldName]);
    const yMaxRaw = d3.max(chartData, d => d[yFieldName]);
    const yPadding = (yMaxRaw - yMinRaw) * 0.15 || yMaxRaw * 0.15 || 10; // Handle case where min=max
    
    const yDomain = [Math.max(0, yMinRaw - yPadding), yMaxRaw + yPadding];
    const yScale = d3.scaleLinear().domain(yDomain).range([innerHeight, 0]).nice();
    const yTicks = yScale.ticks(5);

    // Block 7: Chart Component Rendering
    // Y-Axis Gridlines
    mainChartGroup.append("g")
        .attr("class", "gridline y-grid")
        .selectAll("line")
        .data(yTicks.filter(tick => tick > 0 && tick < yDomain[1])) // Avoid overdrawing on domain boundary if not needed
        .enter().append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    // Y-Axis Ticks and Labels
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    yAxisGroup.selectAll(".tick-label")
        .data(yTicks)
        .enter().append("text")
        .attr("class", "label y-axis-label")
        .attr("x", -10)
        .attr("y", d => yScale(d))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.axisLabelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d3.format(",.0f")(d));
    
    // Y-Axis Line
    yAxisGroup.append("line")
        .attr("class", "line y-axis-line")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", yScale(yDomain[1])) // Use actual scale domain max
        .attr("y2", yScale(Math.max(0, yDomain[0]))) // Use actual scale domain min (or 0)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Y-Axis Title
    const yAxisTitleText = `${yFieldDescription}${yFieldUnit ? ` (${yFieldUnit})` : ''}`;
    mainChartGroup.append("text")
        .attr("class", "label axis-title y-axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -chartMargins.left + 20)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.axisTitleFontSize)
        .style("font-weight", fillStyle.typography.titleFontWeight) // Often bolder
        .style("fill", fillStyle.textColor)
        .text(yAxisTitleText);

    // X-Axis Ticks and Labels
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    xAxisGroup.selectAll(".tick-label")
        .data(xTicks)
        .enter().append("text")
        .attr("class", "label x-axis-label")
        .attr("x", d => xScale(d))
        .attr("y", chartMargins.bottom / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.axisLabelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => xAxisFormat(d));

    // X-Axis Line
    xAxisGroup.append("line")
        .attr("class", "line x-axis-line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]));

    const areaGenerator = d3.area()
        .x(d => xScale(d[xFieldName]))
        .y0(d => yScale(d.group2Value)) // Lower line
        .y1(d => yScale(d.group1Value)); // Upper line

    // Render Area
    if (areaData.length >= 2) {
        mainChartGroup.append("path")
            .datum(areaData)
            .attr("class", "mark area range-area")
            .attr("fill", fillStyle.areaFillColor)
            .attr("d", areaGenerator);
    }

    // Render Lines
    // Line for Group 1 (highest average, typically on top)
    if (group1Data.length >=2) {
        mainChartGroup.append("path")
            .datum(group1Data)
            .attr("class", `mark line line-group1`)
            .attr("fill", "none")
            .attr("stroke", fillStyle.lineColors[selectedGroupNames[0]])
            .attr("stroke-width", 3) // Simplified stroke width
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("d", lineGenerator);
    }

    // Line for Group 2 (lowest average, typically on bottom)
    if (group2Data.length >= 2) {
        mainChartGroup.append("path")
            .datum(group2Data)
            .attr("class", `mark line line-group2`)
            .attr("fill", "none")
            .attr("stroke", fillStyle.lineColors[selectedGroupNames[1]])
            .attr("stroke-width", 3) // Simplified stroke width
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("d", lineGenerator);
    }

    // Block 9: Optional Enhancements & Post-Processing
    const imageSize = variables.iconSize || 32; // Configurable icon size

    [
        { data: group1Data, name: selectedGroupNames[0], yOffsetFactor: -1 },
        { data: group2Data, name: selectedGroupNames[1], yOffsetFactor: 1 }
    ].forEach(groupInfo => {
        if (groupInfo.data.length === 0) return;

        const firstPoint = groupInfo.data[0];
        const lastPoint = groupInfo.data[groupInfo.data.length - 1];
        const groupColor = fillStyle.lineColors[groupInfo.name];
        const groupImageUrl = fillStyle.groupImageUrls[groupInfo.name];

        // Start point icon and label
        if (groupImageUrl) {
            mainChartGroup.append("image")
                .attr("class", "icon endpoint start-icon")
                .attr("xlink:href", groupImageUrl)
                .attr("x", xScale(firstPoint[xFieldName]) - imageSize / 2)
                .attr("y", yScale(firstPoint[yFieldName]) - imageSize / 2)
                .attr("width", imageSize)
                .attr("height", imageSize);
        }
        mainChartGroup.append("text")
            .attr("class", "label value start-value")
            .attr("x", xScale(firstPoint[xFieldName]) - imageSize / 2 - 5)
            .attr("y", yScale(firstPoint[yFieldName]))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.valueLabelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", groupColor)
            .text(d3.format(",.0f")(firstPoint[yFieldName]));

        // End point icon and label
        if (groupImageUrl) {
            mainChartGroup.append("image")
                .attr("class", "icon endpoint end-icon")
                .attr("xlink:href", groupImageUrl)
                .attr("x", xScale(lastPoint[xFieldName]) - imageSize / 2)
                .attr("y", yScale(lastPoint[yFieldName]) - imageSize / 2)
                .attr("width", imageSize)
                .attr("height", imageSize);
        }
        mainChartGroup.append("text") // Group Name
            .attr("class", "label groupname end-groupname")
            .attr("x", xScale(lastPoint[xFieldName]) + imageSize / 2 + 5)
            .attr("y", yScale(lastPoint[yFieldName]) + (groupInfo.yOffsetFactor * (imageSize/2 + 5))) // Offset based on group position
            .attr("text-anchor", "start")
            .attr("dominant-baseline", groupInfo.yOffsetFactor === -1 ? "alphabetic" : "hanging")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.groupNameFontSize)
            .style("font-weight", "bold")
            .style("fill", fillStyle.textColor)
            .text(groupInfo.name);
        mainChartGroup.append("text") // Value
            .attr("class", "label value end-value")
            .attr("x", xScale(lastPoint[xFieldName]) + imageSize / 2 + 5)
            .attr("y", yScale(lastPoint[yFieldName]) + (groupInfo.yOffsetFactor * (imageSize/2 + 20))) // Further offset
            .attr("text-anchor", "start")
            .attr("dominant-baseline", groupInfo.yOffsetFactor === -1 ? "alphabetic" : "hanging")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.valueLabelFontSize)
            .style("font-weight", "bold")
            .style("fill", groupColor)
            .text(d3.format(",.0f")(lastPoint[yFieldName]));
    });

    // Ratio Annotations (Start and End)
    if (group1Data.length > 0 && group2Data.length > 0) {
        const processRatioPoint = (point1, point2, xVal) => {
            if (!point1 || !point2) return;
            const val1 = point1[yFieldName];
            const val2 = point2[yFieldName];
            if (val2 === 0) return; // Avoid division by zero

            const ratio = (val1 / val2).toFixed(1);
            const midY = (yScale(val1) + yScale(val2)) / 2;
            const xPos = xScale(xVal);

            const arrowLength = 15;
            const arrowOffset = 5; // Offset from text to start of arrow line
            const headSize = 3;

            // Upper arrow
            mainChartGroup.append("line")
                .attr("class", "mark annotation-line ratio-arrow-up-line")
                .attr("x1", xPos).attr("x2", xPos)
                .attr("y1", midY - arrowOffset)
                .attr("y2", midY - arrowOffset - arrowLength)
                .attr("stroke", fillStyle.arrowColor).attr("stroke-width", 1);
            mainChartGroup.append("polygon") // Arrow head
                .attr("class", "mark annotation-head ratio-arrow-up-head")
                .attr("points", `${xPos},${midY - arrowOffset - arrowLength} ${xPos - headSize},${midY - arrowOffset - arrowLength + headSize} ${xPos + headSize},${midY - arrowOffset - arrowLength + headSize}`)
                .attr("fill", fillStyle.arrowColor);
            
            // Lower arrow
            mainChartGroup.append("line")
                .attr("class", "mark annotation-line ratio-arrow-down-line")
                .attr("x1", xPos).attr("x2", xPos)
                .attr("y1", midY + arrowOffset)
                .attr("y2", midY + arrowOffset + arrowLength)
                .attr("stroke", fillStyle.arrowColor).attr("stroke-width", 1);
            mainChartGroup.append("polygon") // Arrow head
                .attr("class", "mark annotation-head ratio-arrow-down-head")
                .attr("points", `${xPos},${midY + arrowOffset + arrowLength} ${xPos - headSize},${midY + arrowOffset + arrowLength - headSize} ${xPos + headSize},${midY + arrowOffset + arrowLength - headSize}`)
                .attr("fill", fillStyle.arrowColor);

            mainChartGroup.append("text")
                .attr("class", "label annotation ratio-value")
                .attr("x", xPos)
                .attr("y", midY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.ratioLabelFontSize)
                .style("font-weight", "bold")
                .style("fill", fillStyle.textColor)
                .text(ratio);
        };
        
        // Find corresponding points for start ratio
        const firstDate1 = group1Data[0][xFieldName];
        const firstDate2 = group2Data[0][xFieldName];
        // Use the later of the two start dates for the start ratio, or the earliest if they align
        const startRatioDate = firstDate1.getTime() > firstDate2.getTime() ? firstDate1 : firstDate2;
        const startPoint1 = group1Data.find(d => d[xFieldName].getTime() === startRatioDate.getTime());
        const startPoint2 = group2Data.find(d => d[xFieldName].getTime() === startRatioDate.getTime());
        processRatioPoint(startPoint1, startPoint2, startRatioDate);

        // Find corresponding points for end ratio
        const lastDate1 = group1Data[group1Data.length - 1][xFieldName];
        const lastDate2 = group2Data[group2Data.length - 1][xFieldName];
        // Use the earlier of the two end dates for the end ratio
        const endRatioDate = lastDate1.getTime() < lastDate2.getTime() ? lastDate1 : lastDate2;
        const endPoint1 = group1Data.find(d => d[xFieldName].getTime() === endRatioDate.getTime());
        const endPoint2 = group2Data.find(d => d[xFieldName].getTime() === endRatioDate.getTime());
        
        if (endPoint1 && endPoint2) {
            processRatioPoint(endPoint1, endPoint2, endRatioDate);
            // "Ratio" text near the end ratio
            mainChartGroup.append("text")
                .attr("class", "label annotation ratio-text")
                .attr("x", xScale(endRatioDate))
                .attr("y", (yScale(endPoint1[yFieldName]) + yScale(endPoint2[yFieldName])) / 2 + parseFloat(fillStyle.typography.ratioLabelFontSize) * 0.75 + 5) // Below ratio number
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.ratioTextFontSize)
                .style("font-weight", "bold")
                .style("fill", fillStyle.textColor)
                .text("Ratio");
        }
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}