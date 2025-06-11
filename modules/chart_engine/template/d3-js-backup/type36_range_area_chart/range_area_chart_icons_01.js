/* REQUIREMENTS_BEGIN
{
  "chart_type": "Dual Line Chart with Range Area",
  "chart_name": "dual_line_range_area_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 2]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 800,
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    if (!xFieldConfig || !yFieldConfig || !groupFieldConfig) {
        const missing = [
            !xFieldConfig ? "x field" : null,
            !yFieldConfig ? "y field" : null,
            !groupFieldConfig ? "group field" : null
        ].filter(Boolean).join(', ');
        const errorMsg = `Critical chart config missing: [${missing} configuration in dataColumns]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;
    const yFieldDescription = yFieldConfig.description || yFieldName;


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyConfig.title?.font_size || '16px',
            titleFontWeight: typographyConfig.title?.font_weight || 'bold',
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
            dataLabelFontSize: '16px', // Specific for this chart's data labels
            dataLabelFontWeight: 'bold',
            groupLabelFontSize: '12px', // Specific for group names near icons
            ratioLabelFontSize: '16px',
            ratioSubLabelFontSize: '12px',
        },
        textColor: colorsConfig.text_color || '#222222',
        axisLineColor: '#666666',
        gridLineColor: '#cccccc',
        areaFillColor: (colorsConfig.other && colorsConfig.other.primary) || (colorsConfig.available_colors && colorsConfig.available_colors[0]) || '#ebbc48',
        arrowColor: '#030300',
        defaultLineStrokeWidth: 3,
        imageSize: 36,
        getGroupColor: (groupName, index) => {
            if (colorsConfig.field && colorsConfig.field[groupName]) {
                return colorsConfig.field[groupName];
            }
            if (colorsConfig.available_colors) {
                return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
            }
            return d3.schemeCategory10[index % 10];
        },
        getGroupImage: (groupName) => {
            return (imagesConfig.field && imagesConfig.field[groupName]) || null;
        }
    };

    function parseDate(dateString) {
        return d3.timeParse("%Y-%m-%d")(dateString) || new Date(dateString); // Fallback for other date formats if %Y-%m-%d fails
    }

    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontProps.fontFamily);
        textNode.setAttribute('font-size', fontProps.fontSize);
        textNode.setAttribute('font-weight', fontProps.fontWeight);
        textNode.textContent = text;
        svg.appendChild(textNode);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM.
        // This might be less accurate if not in DOM, but adheres to constraints.
        // For more accuracy if needed: document.body.appendChild(svg); const width = textNode.getBBox().width; document.body.removeChild(svg); return width;
        try {
            return textNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            return text.length * (parseInt(fontProps.fontSize) || 12) * 0.6;
        }
    }
    
    function createXAxisScaleAndTicks(data, field, rangeMin, rangeMax) {
        const dates = data.map(d => parseDate(d[field]));
        const extent = d3.extent(dates);
        
        const xScale = d3.scaleTime().domain(extent).range([rangeMin, rangeMax]);
        
        const timeSpanDays = (extent[1] - extent[0]) / (1000 * 60 * 60 * 24);
        let xTicks, xFormat;

        if (timeSpanDays <= 31) { // Daily/Weekly ticks for up to a month
            xTicks = xScale.ticks(d3.timeDay.every(Math.ceil(timeSpanDays / 7))); // approx weekly
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 365 * 2) { // Monthly ticks for up to 2 years
            xTicks = xScale.ticks(d3.timeMonth.every(Math.ceil(timeSpanDays / 30 / 6))); // approx 6 ticks
            xFormat = d3.timeFormat("%b %Y");
        } else { // Yearly ticks for longer spans
            xTicks = xScale.ticks(d3.timeYear.every(Math.ceil(timeSpanDays / 365 / 6))); // approx 6 ticks
            xFormat = d3.timeFormat("%Y");
        }
        return { xScale, xTicks, xFormat, timeSpan: timeSpanDays };
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
        .style("background-color", colorsConfig.background_color || 'transparent');

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 60, bottom: 60, left: 80 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName]
    }));

    const groupNames = [...new Set(processedChartData.map(d => d[groupFieldName]))];
    if (groupNames.length < 2) {
        const errorMsg = "Range Area Chart requires at least two groups in the data. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    
    const groupAverages = groupNames.map(group => {
        const groupData = processedChartData.filter(d => d[groupFieldName] === group);
        const avg = d3.mean(groupData, d => d[yFieldName]);
        return { group, avg };
    });
    groupAverages.sort((a, b) => b.avg - a.avg); // Sort by average, descending

    const highestGroup = groupAverages[0].group;
    const lowestGroup = groupAverages[groupAverages.length - 1].group;
    const selectedGroupNames = [highestGroup, lowestGroup];

    let group1Data = processedChartData.filter(d => d[groupFieldName] === selectedGroupNames[0]);
    let group2Data = processedChartData.filter(d => d[groupFieldName] === selectedGroupNames[1]);

    group1Data.sort((a, b) => a[xFieldName] - b[xFieldName]);
    group2Data.sort((a, b) => a[xFieldName] - b[xFieldName]);

    const areaData = [];
    group1Data.forEach(d1 => {
        const d2 = group2Data.find(d => d[xFieldName].getTime() === d1[xFieldName].getTime());
        if (d2) {
            areaData.push({
                [xFieldName]: d1[xFieldName],
                group1Value: d1[yFieldName],
                group2Value: d2[yFieldName]
            });
        }
    });
    areaData.sort((a,b) => a[xFieldName] - b[xFieldName]);


    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(processedChartData, xFieldName, 0, innerWidth);

    const yMin = d3.min(processedChartData, d => d[yFieldName]);
    const yMax = d3.max(processedChartData, d => d[yFieldName]);
    const yPadding = (yMax - yMin) * 0.3; // 30% padding

    const yScale = d3.scaleLinear()
        .domain([Math.max(0, yMin - yPadding), yMax + yPadding])
        .range([innerHeight, 0]);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const yAxisTicks = yScale.ticks(5);

    // Y-axis Gridlines
    const yGridLinesGroup = mainChartGroup.append("g").attr("class", "grid y-grid");
    yAxisTicks.forEach(tick => {
        if (tick > 0) { // Skip 0 line if it's the bottom
             yGridLinesGroup.append("line")
                .attr("class", "gridline")
                .attr("x1", 0)
                .attr("y1", yScale(tick))
                .attr("x2", innerWidth)
                .attr("y2", yScale(tick))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 1);
        }
    });
    
    // Y-axis Labels and Line
    const yAxisGroup = mainChartGroup.append("g").attr("class", "axis y-axis");
    yAxisTicks.forEach(tick => {
        yAxisGroup.append("text")
            .attr("class", "label y-axis-label")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d3.format(",.0f")(tick));
    });
    
    yAxisGroup.append("line")
        .attr("class", "axis-line")
        .attr("x1", 0)
        .attr("y1", yScale.range()[1]) // Top of Y-axis (yScale(yMax+yPadding))
        .attr("x2", 0)
        .attr("y2", yScale.range()[0]) // Bottom of Y-axis (yScale(0 or yMin-yPadding))
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Y-axis Title
    const yAxisTitle = yAxisGroup.append("text")
        .attr("class", "label y-axis-title")
        .attr("x", -25) // Adjusted for better placement
        .attr("y", yScale.range()[1] - 25) // Above the top of the axis line
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.titleFontFamily)
        .style("font-size", fillStyle.typography.titleFontSize)
        .style("font-weight", fillStyle.typography.titleFontWeight)
        .style("fill", fillStyle.textColor);

    yAxisTitle.append("tspan")
        .style("font-weight", "bold")
        .text(yFieldDescription);
    
    const dateExtent = d3.extent(processedChartData, d => d[xFieldName]);
    if (dateExtent[0] && dateExtent[1]) {
         yAxisTitle.append("tspan")
            .attr("dy", "1.2em") // New line
            .attr("x", -25)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(` (${d3.timeFormat("%Y")(dateExtent[0])}-${d3.timeFormat("%Y")(dateExtent[1])})`);
    }
   
    yAxisGroup.append("text")
        .attr("class", "label y-axis-subtitle")
        .attr("x", -25)
        .attr("y", yScale.range()[1] - 10)
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize) // Smaller for subtitle
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(yFieldName);


    // X-axis Labels and Line
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    xTicks.forEach(tick => {
        xAxisGroup.append("text")
            .attr("class", "label x-axis-label")
            .attr("x", xScale(tick))
            .attr("y", 15)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(xFormat(tick));
    });

    xAxisGroup.append("line")
        .attr("class", "axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", innerWidth)
        .attr("y2", 0)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]));

    const areaGenerator = d3.area()
        .x(d => xScale(d[xFieldName]))
        .y0(d => yScale(d.group2Value))
        .y1(d => yScale(d.group1Value));

    mainChartGroup.append("path")
        .datum(areaData)
        .attr("class", "mark area-mark")
        .attr("fill", fillStyle.areaFillColor)
        .attr("opacity", 0.3) // Make area semi-transparent
        .attr("d", areaGenerator);

    // Line 1 (Highest Group)
    mainChartGroup.append("path")
        .datum(group1Data)
        .attr("class", "mark line-mark group1-line")
        .attr("fill", "none")
        .attr("stroke", fillStyle.getGroupColor(selectedGroupNames[0], 0))
        .attr("stroke-width", fillStyle.defaultLineStrokeWidth)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("d", lineGenerator);

    // Line 2 (Lowest Group)
    mainChartGroup.append("path")
        .datum(group2Data)
        .attr("class", "mark line-mark group2-line")
        .attr("fill", "none")
        .attr("stroke", fillStyle.getGroupColor(selectedGroupNames[1], 1))
        .attr("stroke-width", fillStyle.defaultLineStrokeWidth)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("d", lineGenerator);


    // Block 9: Optional Enhancements & Post-Processing
    const firstPoint1 = group1Data[0];
    const lastPoint1 = group1Data[group1Data.length - 1];
    const firstPoint2 = group2Data[0];
    const lastPoint2 = group2Data[group2Data.length - 1];

    // Helper to add icons and labels
    function addEndpointMarkers(pointData, groupName, groupIndex, isStart, isTopGroup) {
        const pointX = xScale(pointData[xFieldName]);
        const pointY = yScale(pointData[yFieldName]);
        const groupColor = fillStyle.getGroupColor(groupName, groupIndex);
        const groupImage = fillStyle.getGroupImage(groupName);

        if (groupImage) {
            mainChartGroup.append("image")
                .attr("class", "icon endpoint-icon")
                .attr("x", pointX - fillStyle.imageSize / 2)
                .attr("y", pointY - fillStyle.imageSize / 2)
                .attr("width", fillStyle.imageSize)
                .attr("height", fillStyle.imageSize)
                .attr("xlink:href", groupImage);
        } else { // Fallback circle if no image
             mainChartGroup.append("circle")
                .attr("class", "mark endpoint-marker")
                .attr("cx", pointX)
                .attr("cy", pointY)
                .attr("r", fillStyle.imageSize / 4)
                .attr("fill", groupColor);
        }

        // Value Label
        mainChartGroup.append("text")
            .attr("class", "label data-label")
            .attr("x", isStart ? pointX - fillStyle.imageSize / 2 - 5 : pointX + fillStyle.imageSize / 2 + 5)
            .attr("y", pointY)
            .attr("text-anchor", isStart ? "end" : "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.dataLabelFontSize)
            .style("font-weight", fillStyle.typography.dataLabelFontWeight)
            .style("fill", groupColor)
            .text(d3.format(",.0f")(pointData[yFieldName]));

        // Group Name Label (for end points only)
        if (!isStart) {
            const yOffset = isTopGroup ? -fillStyle.imageSize * 0.75 : fillStyle.imageSize * 0.75;
            const valYOffset = isTopGroup ? yOffset - 18 : yOffset + 18;

            mainChartGroup.append("text")
                .attr("class", "label group-name-label")
                .attr("x", pointX)
                .attr("y", pointY + yOffset)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", isTopGroup ? "alphabetic" : "hanging")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.groupLabelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(groupName);
            
            // Re-add value label near group name for clarity at end points
            mainChartGroup.append("text")
                .attr("class", "label data-label-end")
                .attr("x", pointX)
                .attr("y", pointY + valYOffset)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", isTopGroup ? "alphabetic" : "hanging")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.dataLabelFontSize)
                .style("font-weight", fillStyle.typography.dataLabelFontWeight)
                .style("fill", groupColor)
                .text(d3.format(",.0f")(pointData[yFieldName]));
        }
    }

    if (firstPoint1) addEndpointMarkers(firstPoint1, selectedGroupNames[0], 0, true, true);
    if (lastPoint1) addEndpointMarkers(lastPoint1, selectedGroupNames[0], 0, false, true);
    if (firstPoint2) addEndpointMarkers(firstPoint2, selectedGroupNames[1], 1, true, false);
    if (lastPoint2) addEndpointMarkers(lastPoint2, selectedGroupNames[1], 1, false, false);

    // Ratio Annotations
    function addRatioAnnotation(p1, p2, pointX) {
        if (!p1 || !p2) return;
        const ratio = (p1[yFieldName] / p2[yFieldName]);
        if (!isFinite(ratio)) return;

        const ratioText = ratio.toFixed(1);
        const y1 = yScale(p1[yFieldName]);
        const y2 = yScale(p2[yFieldName]);
        const midY = (y1 + y2) / 2;
        const arrowOffset = 5; // Distance from line to arrow tip
        const arrowLength = 15; // Length of the arrow line
        const arrowHeadSize = 5;

        // Arrows
        // Top arrow (pointing down to p1)
        mainChartGroup.append("line")
            .attr("class", "other arrow-line")
            .attr("x1", pointX)
            .attr("y1", midY - arrowLength / 2)
            .attr("x2", pointX)
            .attr("y2", y1 + arrowOffset)
            .attr("stroke", fillStyle.arrowColor)
            .attr("stroke-width", 1);
        mainChartGroup.append("polygon") // Arrowhead
            .attr("class", "other arrow-head")
            .attr("points", `${pointX},${y1 + arrowOffset} ${pointX - arrowHeadSize/2},${y1 + arrowOffset + arrowHeadSize} ${pointX + arrowHeadSize/2},${y1 + arrowOffset + arrowHeadSize}`)
            .attr("fill", fillStyle.arrowColor);

        // Bottom arrow (pointing up to p2)
        mainChartGroup.append("line")
            .attr("class", "other arrow-line")
            .attr("x1", pointX)
            .attr("y1", midY + arrowLength / 2)
            .attr("x2", pointX)
            .attr("y2", y2 - arrowOffset)
            .attr("stroke", fillStyle.arrowColor)
            .attr("stroke-width", 1);
        mainChartGroup.append("polygon") // Arrowhead
            .attr("class", "other arrow-head")
            .attr("points", `${pointX},${y2 - arrowOffset} ${pointX - arrowHeadSize/2},${y2 - arrowOffset - arrowHeadSize} ${pointX + arrowHeadSize/2},${y2 - arrowOffset - arrowHeadSize}`)
            .attr("fill", fillStyle.arrowColor);
        
        // Ratio Text
        mainChartGroup.append("text")
            .attr("class", "label ratio-label")
            .attr("x", pointX)
            .attr("y", midY - 5)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "alphabetic")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.ratioLabelFontSize)
            .style("font-weight", fillStyle.typography.dataLabelFontWeight) // Bold for ratio number
            .style("fill", fillStyle.textColor)
            .text(ratioText);
        
        mainChartGroup.append("text")
            .attr("class", "label ratio-sublabel")
            .attr("x", pointX)
            .attr("y", midY + 10)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.ratioSubLabelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text("Ratio");
    }

    if (firstPoint1 && firstPoint2) addRatioAnnotation(firstPoint1, firstPoint2, xScale(firstPoint1[xFieldName]));
    if (lastPoint1 && lastPoint2) addRatioAnnotation(lastPoint1, lastPoint2, xScale(lastPoint1[xFieldName]));


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}