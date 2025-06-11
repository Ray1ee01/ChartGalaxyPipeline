/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Spline Graph",
  "chart_name": "multiple_spline_graph_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 8]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || data.colors || {}; // Prioritize dark theme colors
    const imagesConfig = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getFieldNameByRole = (role) => {
        const column = dataColumns.find(col => col.role === role);
        return column ? column.name : null;
    };

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

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        },
        chartBackground: colorsConfig.background_color || '#282c34', // Dark background default
        textColor: colorsConfig.text_color || '#f0dcc1', // Light text for dark background
        axisColor: colorsConfig.text_color || '#f0dcc1', // Axis lines and text
        gridColor: colorsConfig.text_color || '#f0dcc1', // Grid lines (opacity will be applied)
        labelTextContrastColor: '#1c1c1c', // For text on colored backgrounds
        defaultLineColor: colorsConfig.other?.primary || '#3498db', // Default for lines if no specific color
    };

    fillStyle.getGroupColor = (groupName, index = 0) => {
        if (colorsConfig.field && colorsConfig.field[groupName]) {
            return colorsConfig.field[groupName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        const defaultCategoricalScheme = d3.schemeTableau10; // A scheme with good contrast
        return defaultCategoricalScheme[index % defaultCategoricalScheme.length] || fillStyle.defaultLineColor;
    };
    
    function estimateTextWidth(text, fontSize, fontFamily = 'Arial, sans-serif', fontWeight = 'normal') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Document append/remove is not strictly necessary for getBBox on 'text' if styled directly,
        // but some complex scenarios might require it. For safety with getBBox:
        // document.body.appendChild(svg);
        const width = textElement.getBBox().width;
        // document.body.removeChild(svg);
        return width;
    }

    function parseDate(dateString) {
        if (dateString instanceof Date) return dateString;
        const formats = [
            d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ"),
            d3.timeParse("%Y-%m-%dT%H:%M:%S"),
            d3.timeParse("%Y-%m-%d"),
            d3.timeParse("%m/%d/%Y"),
            d3.timeParse("%d-%b-%y")
        ];
        for (let format of formats) {
            const parsed = format(dateString);
            if (parsed) return parsed;
        }
        console.warn(`Could not parse date: ${dateString}`);
        return new Date(dateString); // Fallback to native Date parser
    }
    
    function createXAxisScaleAndTicksHelper(data, xField, width) {
        const dates = data.map(d => parseDate(d[xField])).filter(d => d instanceof Date && !isNaN(d));
        if (dates.length === 0) {
            return { 
                xScale: d3.scaleTime().domain([new Date(), new Date()]).range([0, width]), 
                xTicks: [], 
                xFormat: d => "" 
            };
        }
        const [minDate, maxDate] = d3.extent(dates);
        
        const xScale = d3.scaleTime()
            .domain([minDate, maxDate])
            .range([0, width]);

        let xTicks;
        let xFormat;

        const durationDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);

        if (durationDays <= 1) { // Hours
            xTicks = xScale.ticks(d3.timeHour.every(Math.max(1, Math.floor(durationDays * 24 / 6))));
            xFormat = d3.timeFormat("%H:%M");
        } else if (durationDays <= 70) { // Days
            xTicks = xScale.ticks(d3.timeDay.every(Math.max(1, Math.floor(durationDays / 7))));
            xFormat = d3.timeFormat("%b %d");
        } else if (durationDays <= 365 * 2) { // Months
            xTicks = xScale.ticks(d3.timeMonth.every(Math.max(1, Math.floor(durationDays / 30 / 7))));
            xFormat = d3.timeFormat("%b '%y");
        } else { // Years
            xTicks = xScale.ticks(d3.timeYear.every(Math.max(1, Math.floor(durationDays / 365 / 7))));
            xFormat = d3.timeFormat("%Y");
        }
        if (xTicks.length === 0 && dates.length > 0) { // Ensure at least start and end if possible
             xTicks = xScale.ticks(2);
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
    const chartMargins = { top: 40, right: 180, bottom: 60, left: 80 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const gridExtension = 5; // How much grid lines extend beyond axes

    // Block 5: Data Preprocessing & Transformation
    const chartData = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName] // Ensure Y is numeric
    })).filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]) && !isNaN(d[yFieldName]));


    if (chartData.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No valid data to display.");
        return svgRoot.node();
    }
    
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];

    // Sort groups for label placement (descending by last Y value)
    groups.sort((a, b) => {
        const aData = chartData.filter(d => d[groupFieldName] === a).sort((p1, p2) => d3.ascending(p1[xFieldName], p2[xFieldName]));
        const bData = chartData.filter(d => d[groupFieldName] === b).sort((p1, p2) => d3.ascending(p1[xFieldName], p2[xFieldName]));
        if (aData.length === 0) return 1;
        if (bData.length === 0) return -1;
        return d3.descending(aData[aData.length - 1][yFieldName], bData[bData.length - 1][yFieldName]);
    });


    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicksHelper(chartData, xFieldName, innerWidth);

    const yMin = d3.min(chartData, d => d[yFieldName]);
    const yMax = d3.max(chartData, d => d[yFieldName]);
    
    const yScale = d3.scaleLinear()
        .domain([
            Math.min(0, yMin * (yMin < 0 ? 1.1 : 0.9)), // Extend slightly if negative
            yMax * 1.1
        ])
        .range([innerHeight, 0])
        .nice();


    // Block 7: Chart Component Rendering (Axes, Gridlines)
    const yAxisTicks = yScale.ticks(5);
    const maxYTickValue = yAxisTicks[yAxisTicks.length - 1];
    const maxYTickPosition = yScale(maxYTickValue);

    // Horizontal Gridlines
    mainChartGroup.append("g")
        .attr("class", "gridlines horizontal-gridlines")
        .selectAll("line.grid-line-y")
        .data(yAxisTicks)
        .enter()
        .append("line")
        .attr("class", "gridline grid-line-y")
        .attr("x1", -gridExtension)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridColor)
        .attr("stroke-width", 1)
        .attr("opacity", 0.2);

    // Vertical Gridlines (excluding first and last X tick)
    mainChartGroup.append("g")
        .attr("class", "gridlines vertical-gridlines")
        .selectAll("line.grid-line-x")
        .data(xTicks.filter((d, i) => i > 0 && i < xTicks.length -1)) // Original filter
        .enter()
        .append("line")
        .attr("class", "gridline grid-line-x")
        .attr("x1", d => xScale(d))
        .attr("y1", 0)
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight + gridExtension) // Extend slightly below
        .attr("stroke", fillStyle.gridColor)
        .attr("stroke-width", 1)
        .attr("opacity", 0.3);

    // X-Axis Labels
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    xAxisGroup.selectAll("text.axis-label")
        .data(xTicks)
        .enter()
        .append("text")
        .attr("class", "text axis-label x-axis-label")
        .attr("x", d => xScale(d))
        .attr("y", chartMargins.bottom / 2) // Positioned within bottom margin
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => xFormat(d));

    // Y-Axis Labels
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    yAxisGroup.selectAll("text.axis-label")
        .data(yAxisTicks)
        .enter()
        .append("text")
        .attr("class", "text axis-label y-axis-label")
        .attr("x", -gridExtension - 5) // Position left of axis line
        .attr("y", d => yScale(d))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d);
    
    // Y-Axis Title/Unit Label
    const yAxisTitleGroup = mainChartGroup.append("g")
        .attr("class", "axis-title y-axis-title-group")
        .attr("transform", `translate(${-chartMargins.left + 25}, ${Math.max(0, maxYTickPosition - 40)})`); // Adjusted positioning

    const yAxisTitleText = dataColumns.find(col => col.role === yFieldRole)?.label || yFieldName;
    const yAxisTitleTextWidth = estimateTextWidth(yAxisTitleText, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontFamily);
    const yAxisTitlePadding = 10;
    const yAxisTitleRectWidth = yAxisTitleTextWidth + 2 * yAxisTitlePadding;
    const yAxisTitleRectHeight = 20;
    const yAxisTitleTriangleHeight = 6;

    const yAxisTitlePath = `
        M 0,0 
        H ${yAxisTitleRectWidth} 
        V ${yAxisTitleRectHeight} 
        H ${yAxisTitleRectWidth / 2 + yAxisTitleTriangleHeight} 
        L ${yAxisTitleRectWidth / 2},${yAxisTitleRectHeight + yAxisTitleTriangleHeight} 
        L ${yAxisTitleRectWidth / 2 - yAxisTitleTriangleHeight},${yAxisTitleRectHeight} 
        H 0 
        Z
    `;

    yAxisTitleGroup.append("path")
        .attr("class", "mark axis-title-background")
        .attr("d", yAxisTitlePath)
        .attr("fill", "transparent") // As per original, could be fillStyle.chartBackground for contrast
        .attr("stroke", fillStyle.axisColor)
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.7);

    yAxisTitleGroup.append("text")
        .attr("class", "text axis-title-text")
        .attr("x", yAxisTitleRectWidth / 2)
        .attr("y", yAxisTitleRectHeight / 2 + 2) // +2 for better vertical centering
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(yAxisTitleText);


    // Block 8: Main Data Visualization Rendering (Lines)
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveMonotoneX); // Retain spline curve

    const linesGroup = mainChartGroup.append("g").attr("class", "lines-group");

    groups.forEach((group, index) => {
        const groupData = chartData
            .filter(d => d[groupFieldName] === group)
            .sort((a, b) => d3.ascending(a[xFieldName], b[xFieldName])); // Ensure data is sorted by X for lines

        if (groupData.length > 0) {
            linesGroup.append("path")
                .datum(groupData)
                .attr("class", `mark line series-${String(group).replace(/\s+/g, '-').toLowerCase()}`)
                .attr("fill", "none")
                .attr("stroke", fillStyle.getGroupColor(group, index))
                .attr("stroke-width", 2)
                .attr("d", lineGenerator);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing (End-of-line Labels)
    const endLabelsGroup = mainChartGroup.append("g").attr("class", "end-labels-group");
    let labelYPositions = []; // For collision avoidance
    const labelVerticalSpacing = 22; // Min space between labels (font size + padding)
    const labelHeight = 20; // Height of the label background rectangle

    groups.forEach((group, index) => {
        const groupData = chartData
            .filter(d => d[groupFieldName] === group)
            .sort((a, b) => d3.ascending(a[xFieldName], b[xFieldName]));

        if (groupData.length === 0) return;

        const lastPoint = groupData[groupData.length - 1];
        const pointColor = fillStyle.getGroupColor(group, index);
        const circleY = yScale(lastPoint[yFieldName]);
        
        let targetLabelY = circleY;

        // Collision avoidance for labels
        let resolved = false;
        while(!resolved) {
            resolved = true;
            for (const pos of labelYPositions) {
                if (Math.abs(targetLabelY - pos.y) < labelVerticalSpacing) {
                    targetLabelY = Math.max(pos.y + labelVerticalSpacing, targetLabelY + labelVerticalSpacing / 2); // Try to move down
                    if (targetLabelY + labelHeight / 2 > innerHeight) { // If it goes off screen bottom
                        targetLabelY = Math.min(pos.y - labelVerticalSpacing, circleY - labelVerticalSpacing / 2); // Try to move up from original point
                    }
                    resolved = false;
                    break;
                }
            }
        }
        // Ensure label is within chart bounds
        targetLabelY = Math.max(labelHeight / 2, Math.min(targetLabelY, innerHeight - labelHeight / 2));
        labelYPositions.push({ y: targetLabelY, group });


        const individualLabelGroup = endLabelsGroup.append("g")
            .attr("class", `label end-label-group series-label-${String(group).replace(/\s+/g, '-').toLowerCase()}`)
            .attr("transform", `translate(${innerWidth + 20}, ${targetLabelY})`);

        const valueText = `${Math.round(lastPoint[yFieldName])}`;
        const valueTextWidth = estimateTextWidth(valueText, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontFamily, "bold");
        const groupNameTextWidth = estimateTextWidth(group, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontFamily, "bold");
        
        const labelRectWidth = valueTextWidth + 10; // Padding for value text
        const totalLabelWidth = labelRectWidth + 5 + groupNameTextWidth; // Value rect + spacing + group name

        // Label background rectangle (for value)
        individualLabelGroup.append("rect")
            .attr("class", "mark label-background")
            .attr("x", 0)
            .attr("y", -labelHeight / 2)
            .attr("width", labelRectWidth)
            .attr("height", labelHeight)
            .attr("fill", pointColor)
            .attr("rx", 0) 
            .attr("ry", 0);

        // Triangle pointer
        const relativeCircleY = circleY - targetLabelY; // Y of circle relative to label's Y
        const trianglePath = `M -10,${relativeCircleY} L 0,${-labelHeight/2 + 2} L 0,${labelHeight/2 - 2} Z`; // Pointy part on left, flat on right
        
        individualLabelGroup.append("path")
            .attr("class", "mark label-pointer")
            .attr("d", trianglePath)
            .attr("fill", pointColor);

        // Value Text
        individualLabelGroup.append("text")
            .attr("class", "text data-label value-text")
            .attr("x", labelRectWidth / 2)
            .attr("y", 0) // Vertically centered
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold") // Value often bold
            .style("fill", fillStyle.labelTextContrastColor)
            .text(valueText);

        // Group Name Text
        individualLabelGroup.append("text")
            .attr("class", "text group-label name-text")
            .attr("x", labelRectWidth + 5) // Spacing after rect
            .attr("y", 0) // Vertically centered
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold") // Group name often bold
            .style("fill", pointColor) // Use group color for text
            .text(group);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}