/* REQUIREMENTS_BEGIN
{
  "chart_type": "Layered Area Chart",
  "chart_name": "layered_area_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "prominent",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const inputColors = data.colors_dark || data.colors || {}; // Prefer dark theme if available
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    if (!xFieldConfig || !yFieldConfig || !groupFieldConfig) {
        const missing = [
            !xFieldConfig ? "x field" : null,
            !yFieldConfig ? "y field" : null,
            !groupFieldConfig ? "group field" : null
        ].filter(Boolean).join(', ');
        const errorMsg = `Critical chart config missing: [${missing} role definition in dataColumns]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    if (!rawChartData.every(d => typeof d[xFieldName] !== 'undefined' && typeof d[yFieldName] !== 'undefined' && typeof d[groupFieldName] !== 'undefined')) {
        const errorMsg = `Critical chart data missing: Ensure all data points have '${xFieldName}', '${yFieldName}', and '${groupFieldName}' fields. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        chartBackground: inputColors.background_color || '#1A202C', // Dark default
        textColor: inputColors.text_color || '#BDC4D4', // Light text for dark bg
        axisLineColor: inputColors.other && inputColors.other.axis_line ? inputColors.other.axis_line : '#9badd3',
        gridLineColor: inputColors.other && inputColors.other.grid_line ? inputColors.other.grid_line : '#87aac0', // Original: #87aac0
        gridLineOpacity: 0.2,
        areaOpacity: 0.7, // Simplified from original 0.8, removed gradient/shadow
        defaultCategoricalColor: '#CCCCCC',
        dataLabelBackgroundColorOpacity: 0.9,
        dataLabelTextColor: '#FFFFFF',
        annotationColor: inputColors.other && inputColors.other.annotation ? inputColors.other.annotation : '#87aac0',
    };

    fillStyle.getCategoryColor = (groupName, index) => {
        if (inputColors.field && inputColors.field[groupName]) {
            return inputColors.field[groupName];
        }
        if (inputColors.available_colors && inputColors.available_colors.length > 0) {
            return inputColors.available_colors[index % inputColors.available_colors.length];
        }
        // Fallback to d3.schemeCategory10 if nothing else is available
        return d3.schemeCategory10[index % d3.schemeCategory10.length] || fillStyle.defaultCategoricalColor;
    };
    
    // Image URLs (though not used in this specific chart type, defined for completeness)
    fillStyle.getImageUrl = (fieldName, key) => {
        if (images.field && images.field[fieldName] && images.field[fieldName][key]) {
            return images.field[fieldName][key];
        }
        if (images.other && images.other[key]) {
            return images.other[key];
        }
        return null;
    };


    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textEl.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textEl.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // No need to append to DOM for getBBox if it's an SVG element in some browsers,
        // but safer to do so for full compatibility, then remove.
        // However, for strict adherence to "MUST NOT be appended to the document DOM", we rely on getBBox on unattached SVG.
        // If this fails in some environments, a temporary append/remove might be needed, but prompt says not to.
        let width = 0;
        try {
            width = textEl.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth could not measure text without DOM attachment.", e);
            // Fallback: crude estimation
            width = text.length * (parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
        return width;
    };

    const parseDateInternal = d3.isoParse; // Assuming ISO 8601 date strings

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
    const chartMargins = { top: 30, right: 80, bottom: 50, left: 70 }; // Adjusted for labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    let chartData = rawChartData.map(d => {
        const parsedDate = parseDateInternal(d[xFieldName]);
        if (!parsedDate) {
            console.warn(`Invalid date format for value: ${d[xFieldName]}. Skipping data point.`);
            return null;
        }
        return {
            ...d,
            _parsedX: parsedDate,
            [yFieldName]: +d[yFieldName] // Ensure y is numeric
        };
    }).filter(d => d !== null && d._parsedX instanceof Date && !isNaN(d._parsedX) && !isNaN(d[yFieldName]));

    if (chartData.length === 0) {
        const errorMsg = "No valid data points remaining after parsing and filtering. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))]
        .sort((a, b) => {
            const aLast = chartData.filter(d => d[groupFieldName] === a).sort((da, db) => db._parsedX - da._parsedX)[0];
            const bLast = chartData.filter(d => d[groupFieldName] === b).sort((da, db) => db._parsedX - da._parsedX)[0];
            if (!aLast || !bLast) return 0;
            return aLast[yFieldName] - bLast[yFieldName]; // Ascending sort by last Y value
        });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(chartData, d => d._parsedX))
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d[yFieldName]) * 1.5]) // *1.5 for top space
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .attr("class", "axis x-axis");

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    // X-axis Ticks and Labels
    const xTicks = xScale.ticks(Math.min(10, Math.floor(innerWidth / 80))); // Aim for ~80px per tick
    const xTimeFormat = d3.timeFormat(xScale.domain()[1].getFullYear() - xScale.domain()[0].getFullYear() > 2 ? "%Y" : "%b %Y");

    xAxisGroup.selectAll(".tick-label")
        .data(xTicks.slice(0, -1)) // Skip last tick label as per original logic (handled by annotation)
        .enter()
        .append("text")
        .attr("class", "label tick-label x-axis-label")
        .attr("x", d => xScale(d))
        .attr("y", chartMargins.bottom / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => xTimeFormat(d));
    
    // X-axis Line
    xAxisGroup.append("line")
        .attr("class", "axis-line x-axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", innerWidth)
        .attr("y2", 0)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Y-axis Ticks (as labels) and Gridlines
    const yTicks = yScale.ticks(5); // Target 5 ticks

    yAxisGroup.selectAll(".tick-label")
        .data(yTicks.filter(tick => tick > 0)) // Skip 0 tick label
        .enter()
        .append("text")
        .attr("class", "label tick-label y-axis-label")
        .attr("x", -10)
        .attr("y", d => yScale(d))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d);

    // Horizontal Gridlines
    yAxisGroup.selectAll(".grid-line-horizontal")
        .data(yTicks.filter(tick => tick > 0)) // Skip 0 line if it aligns with x-axis
        .enter()
        .append("line")
        .attr("class", "grid-line grid-line-horizontal other")
        .attr("x1", 0)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-opacity", fillStyle.gridLineOpacity)
        .attr("stroke-width", 1);
        
    // Vertical Gridlines
    mainChartGroup.selectAll(".grid-line-vertical")
        .data(xTicks)
        .enter()
        .append("line")
        .attr("class", "grid-line grid-line-vertical other")
        .attr("x1", d => xScale(d))
        .attr("y1", 0)
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-opacity", fillStyle.gridLineOpacity)
        .attr("stroke-width", 1);

    // Block 8: Main Data Visualization Rendering
    const areaGenerator = d3.area()
        .x(d => xScale(d._parsedX))
        .y0(innerHeight)
        .y1(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    // Draw areas in reverse order of sorted groups (smallest final Y at bottom, largest at top)
    [...groups].reverse().forEach((group, index) => {
        const groupData = chartData.filter(d => d[groupFieldName] === group)
                                   .sort((a, b) => a._parsedX - b._parsedX); // Ensure data is sorted by date for area path
        
        if (groupData.length > 1) { // Area needs at least 2 points
            mainChartGroup.append("path")
                .datum(groupData)
                .attr("class", `area mark series-${index}`)
                .attr("fill", fillStyle.getCategoryColor(group, groups.length - 1 - index)) // index reversed for color consistency
                .attr("opacity", fillStyle.areaOpacity)
                .attr("d", areaGenerator);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Last Tick Annotation (original "last year annotation")
    const lastTickValue = xTicks[xTicks.length - 1];
    if (lastTickValue) {
        const lastTickX = xScale(lastTickValue);
        const annotationGroup = mainChartGroup.append("g").attr("class", "annotation-group other");

        annotationGroup.append("text")
            .attr("class", "label annotation-label")
            .attr("x", lastTickX)
            .attr("y", -10) // Position above the chart area
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.annotationColor)
            .text(xTimeFormat(lastTickValue));

        annotationGroup.append("path") // Triangle marker
            .attr("class", "mark annotation-mark")
            .attr("d", d3.symbol().type(d3.symbolTriangle).size(36))
            .attr("transform", `translate(${lastTickX}, ${-2}) rotate(180)`) // Pointing down, slightly above 0
            .attr("fill", fillStyle.annotationColor);
        
        annotationGroup.append("line") // Dashed line to x-axis
            .attr("class", "other annotation-line")
            .attr("x1", lastTickX)
            .attr("y1", 0)
            .attr("x2", lastTickX)
            .attr("y2", innerHeight)
            .attr("stroke", fillStyle.annotationColor)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");
    }

    // Final Value Labels
    let prevLabelYBase = null;
    const minLabelDistance = parseInt(fillStyle.typography.labelFontSize) * 3.5; // Approx 3.5 lines of text
    const labelPaddingFactor = 1.3;

    groups.forEach((group, groupIndex) => { // Iterate in original sorted order (smallest Y to largest Y)
        const groupData = chartData.filter(d => d[groupFieldName] === group)
                                   .sort((a, b) => a._parsedX - b._parsedX);
        if (groupData.length === 0) return;

        const lastPoint = groupData[groupData.length - 1];
        const groupColor = fillStyle.getCategoryColor(group, groupIndex);

        let labelYBase = yScale(lastPoint[yFieldName]);
        const labelXBase = xScale(lastPoint._parsedX) + 10; // Offset slightly to the right of the line end

        // Adjust Y position to avoid overlap (pushes labels upwards)
        if (prevLabelYBase !== null && (prevLabelYBase - labelYBase) < minLabelDistance) {
            labelYBase = prevLabelYBase - minLabelDistance;
        }
        // Ensure label is within chart bounds (top)
        labelYBase = Math.max(labelYBase, parseInt(fillStyle.typography.labelFontSize) * 2.5); // Enough space for 2 lines of text + pointer
        // Ensure label is within chart bounds (bottom)
        labelYBase = Math.min(labelYBase, innerHeight - parseInt(fillStyle.typography.labelFontSize) * 0.5);


        prevLabelYBase = labelYBase;

        const labelTextGroup = mainChartGroup.append("g")
            .attr("class", `data-label-group series-${groupIndex} other`);

        const groupNameText = String(group);
        const valueText = String(Math.round(lastPoint[yFieldName]));
        
        const groupNameFont = { fontFamily: fillStyle.typography.annotationFontFamily, fontSize: fillStyle.typography.annotationFontSize, fontWeight: fillStyle.typography.annotationFontWeight };
        const valueFont = { fontFamily: fillStyle.typography.labelFontFamily, fontSize: fillStyle.typography.titleFontSize, fontWeight: fillStyle.typography.titleFontWeight }; // Use title for larger value

        const groupNameWidth = estimateTextWidth(groupNameText, groupNameFont);
        const valueWidth = estimateTextWidth(valueText, valueFont);
        const textBlockWidth = Math.max(groupNameWidth, valueWidth) * labelPaddingFactor;
        const textBlockHeight = (parseInt(groupNameFont.fontSize) + parseInt(valueFont.fontSize)) * 1.3;


        // Label Background
        labelTextGroup.append("rect")
            .attr("class", "mark data-label-background")
            .attr("x", labelXBase - textBlockWidth / 2)
            .attr("y", labelYBase - textBlockHeight * 0.85) // Adjusted Y for pointer
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("width", textBlockWidth)
            .attr("height", textBlockHeight)
            .attr("fill", groupColor)
            .attr("opacity", fillStyle.dataLabelBackgroundColorOpacity);

        // Pointer Triangle
        labelTextGroup.append("path")
            .attr("class", "mark data-label-pointer")
            .attr("d", `M${labelXBase}, ${labelYBase} L${labelXBase - 6}, ${labelYBase - 8} L${labelXBase + 6}, ${labelYBase - 8} Z`) // Pointing up to the box
            .attr("fill", groupColor)
            .attr("opacity", fillStyle.dataLabelBackgroundColorOpacity);
        
        // Group Name Text
        labelTextGroup.append("text")
            .attr("class", "label data-label text")
            .attr("x", labelXBase)
            .attr("y", labelYBase - textBlockHeight * 0.55) // Upper part of the box
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", groupNameFont.fontFamily)
            .style("font-size", groupNameFont.fontSize)
            .style("font-weight", groupNameFont.fontWeight)
            .style("fill", fillStyle.dataLabelTextColor)
            .text(groupNameText);
        
        // Value Text
        labelTextGroup.append("text")
            .attr("class", "label data-label value")
            .attr("x", labelXBase)
            .attr("y", labelYBase - textBlockHeight * 0.15) // Lower part of the box
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", valueFont.fontFamily)
            .style("font-size", valueFont.fontSize)
            .style("font-weight", valueFont.fontWeight)
            .style("fill", fillStyle.dataLabelTextColor)
            .text(valueText);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}