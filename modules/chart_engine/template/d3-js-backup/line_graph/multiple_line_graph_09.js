/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Line Graph",
  "chart_name": "multiple_line_graph_09",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 10]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data.data;
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || (data.colors_dark || {});
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

    const criticalFields = { xFieldName, yFieldName, groupFieldName };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')} (derived from dataColumns roles '${xFieldRole}', '${yFieldRole}', '${groupFieldRole}'). Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMessage}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};

    fillStyle.typography = {
        title: { // Not actively used for chart main title by this template
            font_family: (typographyConfig.title && typographyConfig.title.font_family) || 'Arial, sans-serif',
            font_size: (typographyConfig.title && typographyConfig.title.font_size) || '16px',
            font_weight: (typographyConfig.title && typographyConfig.title.font_weight) || 'bold',
        },
        label: { // For axis labels, legend text
            font_family: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            font_size: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            font_weight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
        },
        annotation: { // For data point labels
            font_family: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            font_size: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
            font_weight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
        }
    };

    fillStyle.chartBackground = colorsConfig.background_color || '#FFFFFF';
    fillStyle.textColor = colorsConfig.text_color || '#333333';
    fillStyle.gridLineColor = (colorsConfig.other && colorsConfig.other.gridLine) || '#e0e0e0';
    
    const defaultCategoricalColors = d3.schemeCategory10;
    fillStyle.getColor = (groupName, index) => {
        if (colorsConfig.field && colorsConfig.field[groupName]) {
            return colorsConfig.field[groupName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        return defaultCategoricalColors[index % defaultCategoricalColors.length];
    };

    fillStyle.getImageUrl = (groupName) => {
        if (imagesConfig.field && imagesConfig.field[groupName]) {
            return imagesConfig.field[groupName];
        }
        return null;
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        textElement.style.fontFamily = fontProps.font_family || fillStyle.typography.label.font_family;
        textElement.style.fontSize = fontProps.font_size || fillStyle.typography.label.font_size;
        textElement.style.fontWeight = fontProps.font_weight || fillStyle.typography.label.font_weight;
        textElement.style.opacity = '0'; // Keep it invisible
        tempSvg.appendChild(textElement);
        // document.body.appendChild(tempSvg); // Temporarily append to measure accurately
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might not work well without DOM attachment
            const fontSize = parseFloat(fontProps.font_size || fillStyle.typography.label.font_size);
            width = text.length * fontSize * 0.6; // Rough estimate
            // console.warn("estimateTextWidth getBBox failed, using fallback. For accurate measurement, temporary DOM append might be needed if allowed.", e);
        }
        // document.body.removeChild(tempSvg); // Clean up
        return width;
    }
    
    const parseDate = d3.isoParse; // Assuming ISO 8601 date strings

    function createXAxisScaleAndTicksHelper(data, xField, rangeMin, rangeMax) {
        if (!data || data.length === 0) {
            const now = new Date();
            const defaultScale = d3.scaleTime().domain([now, now]).range([rangeMin, rangeMax]);
            return { xScale: defaultScale, xTicks: defaultScale.ticks(0), xFormat: d3.timeFormat(""), timeSpan: 0 };
        }
        const xValues = data.map(d => d[xField]).filter(d => d instanceof Date && !isNaN(d));
        if (xValues.length === 0) {
            const now = new Date();
            const defaultScale = d3.scaleTime().domain([now, now]).range([rangeMin, rangeMax]);
            return { xScale: defaultScale, xTicks: defaultScale.ticks(0), xFormat: d3.timeFormat(""), timeSpan: 0 };
        }

        const xDomain = d3.extent(xValues);
        const xScale = d3.scaleTime().domain(xDomain).range([rangeMin, rangeMax]);

        const timeSpanDays = (xDomain[1] - xDomain[0]) / (1000 * 60 * 60 * 24);
        let xTicks, xFormat;
        const maxTicks = Math.max(2, Math.floor(rangeMax / 75)); // Aim for ticks every 75px

        if (timeSpanDays <= 2) { 
            xTicks = xScale.ticks(d3.timeHour.every(Math.max(1, Math.floor(timeSpanDays * 24 / maxTicks))));
            xFormat = d3.timeFormat("%H:%M");
        } else if (timeSpanDays <= 90) { 
            xTicks = xScale.ticks(d3.timeDay.every(Math.max(1, Math.ceil(timeSpanDays / maxTicks))));
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 365 * 3) { 
            xTicks = xScale.ticks(d3.timeMonth.every(Math.max(1, Math.ceil(timeSpanDays / 30 / maxTicks))));
            xFormat = d3.timeFormat("%b '%y");
        } else { 
            xTicks = xScale.ticks(d3.timeYear.every(Math.max(1, Math.ceil(timeSpanDays / 365 / maxTicks))));
            xFormat = d3.timeFormat("%Y");
        }
        return { xScale, xTicks, xFormat, timeSpan: timeSpanDays };
    }

    function layoutLegendHelper(legendContainer, groups, colorScale, settings) {
        const FONT_FAMILY = settings.fontFamily || fillStyle.typography.label.font_family;
        const FONT_SIZE_PX = settings.fontSizePx || parseFloat(fillStyle.typography.label.font_size);
        const FONT_WEIGHT = settings.fontWeight || fillStyle.typography.label.font_weight;
        const TEXT_COLOR = settings.textColor || fillStyle.textColor;
        const SHAPE_SIZE = FONT_SIZE_PX * 0.8;
        const ITEM_PADDING = settings.itemPadding || 5;
        const LINE_HEIGHT = settings.lineHeight || FONT_SIZE_PX * 1.5;

        let currentX = 0;
        let currentY = 0; // Start Y at 0 relative to the legendContainer
        let overallMaxWidth = 0;
        let totalHeight = LINE_HEIGHT;

        groups.forEach((group, i) => {
            const groupColor = colorScale(group);
            const itemGroup = legendContainer.append("g")
                .attr("class", "legend-item other") // Class for individual legend item
                .attr("transform", `translate(${currentX}, ${currentY})`);

            if (settings.shape === "circle") {
                itemGroup.append("circle")
                    .attr("class", "legend-shape mark")
                    .attr("cx", SHAPE_SIZE / 2)
                    .attr("cy", LINE_HEIGHT / 2 - FONT_SIZE_PX * 0.1) // Adjusted for better vertical alignment
                    .attr("r", SHAPE_SIZE / 2)
                    .attr("fill", groupColor);
            } else {
                itemGroup.append("rect")
                    .attr("class", "legend-shape mark")
                    .attr("x", 0)
                    .attr("y", (LINE_HEIGHT - SHAPE_SIZE) / 2 - FONT_SIZE_PX * 0.1) // Adjusted
                    .attr("width", SHAPE_SIZE)
                    .attr("height", SHAPE_SIZE)
                    .attr("fill", groupColor);
            }

            const textElement = itemGroup.append("text")
                .attr("class", "legend-label label")
                .attr("x", SHAPE_SIZE + ITEM_PADDING)
                .attr("y", LINE_HEIGHT / 2) 
                .attr("dominant-baseline", "middle")
                .attr("fill", TEXT_COLOR)
                .style("font-family", FONT_FAMILY)
                .style("font-size", `${FONT_SIZE_PX}px`)
                .style("font-weight", FONT_WEIGHT)
                .text(group);
            
            const textWidth = estimateTextWidth(group, { font_family: FONT_FAMILY, font_size: `${FONT_SIZE_PX}px`, font_weight: FONT_WEIGHT });
            const itemWidth = SHAPE_SIZE + ITEM_PADDING + textWidth + ITEM_PADDING * 2;

            if (settings.maxWidth && currentX + itemWidth > settings.maxWidth && i > 0) {
                currentX = 0;
                currentY += LINE_HEIGHT;
                totalHeight += LINE_HEIGHT;
                itemGroup.attr("transform", `translate(${currentX}, ${currentY})`);
            }
            currentX += itemWidth;
            if (currentX > overallMaxWidth) {
                overallMaxWidth = currentX;
            }
        });
        return { width: overallMaxWidth, height: totalHeight };
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
        .attr("class", "chart-svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    // Calculate legend size first to adjust top margin if needed.
    // Temporary legend settings for size calculation
    const tempLegendGroups = [...new Set(chartDataInput.map(d => d[groupFieldName]))].sort();
    const legendSettingsForSizing = {
        fontSizePx: parseFloat(fillStyle.typography.label.font_size),
        maxWidth: containerWidth * 0.8, // Assume legend won't exceed 80% of chart width
        // Other settings like fontFamily, fontWeight, itemPadding, lineHeight will use defaults in layoutLegendHelper
    };
    // Need a dummy group and colorScale for sizing
    const dummyLegendGroup = svgRoot.append("g").style("opacity",0); // Hidden
    const dummyColorScale = d3.scaleOrdinal().domain(tempLegendGroups).range(tempLegendGroups.map((g,i) => fillStyle.getColor(g,i)));
    const estimatedLegendSize = layoutLegendHelper(dummyLegendGroup, tempLegendGroups, dummyColorScale, legendSettingsForSizing);
    dummyLegendGroup.remove();

    const legendHeight = estimatedLegendSize.height + 10; // Add some padding for legend area

    const chartMargins = { 
        top: legendHeight + 20, // Reserve space for legend + padding
        right: 30, 
        bottom: 40, // For X-axis labels
        left: 50    // For Y-axis labels
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Check container dimensions and margins.");
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: Chart dimensions are too small for margins.</div>");
        return null;
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName]
    })).filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]) && typeof d[yFieldName] === 'number' && !isNaN(d[yFieldName]));

    if (processedChartData.length === 0) {
        console.error("No valid data points after processing. Cannot render chart.");
         d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: No valid data to display.</div>");
        return null;
    }
    
    const groups = [...new Set(processedChartData.map(d => d[groupFieldName]))].sort();
    const groupedData = d3.group(processedChartData, d => d[groupFieldName]);
    groupedData.forEach(values => {
        values.sort((a, b) => a[xFieldName] - b[xFieldName]);
    });

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicksHelper(processedChartData, xFieldName, 0, innerWidth);

    const yDataValues = processedChartData.map(d => d[yFieldName]);
    const yMin = d3.min(yDataValues);
    const yMax = d3.max(yDataValues);
    
    let yDomainMin, yDomainMax;
    if (yMin === yMax) { // Handle case with single Y value
        yDomainMin = yMin - Math.abs(yMin * 0.1 || 1); // Add/subtract 10% or 1 if yMin is 0
        yDomainMax = yMax + Math.abs(yMax * 0.1 || 1);
    } else {
        const yPadding = (yMax - yMin) * 0.1;
        yDomainMin = yMin - yPadding;
        yDomainMax = yMax + yPadding;
    }
    // Ensure 0 is included if range spans positive and negative, or if min is close to 0
    if (yDomainMin > 0) yDomainMin = Math.min(yDomainMin, 0);


    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0])
        .nice(); // Adjust domain to round numbers

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((g, i) => fillStyle.getColor(g, i)));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const yAxisTicks = yScale.ticks(Math.max(2, Math.floor(innerHeight / 50))); // Aim for ticks every 50px

    const yAxisGridGroup = mainChartGroup.append("g").attr("class", "axis y-axis-grid other");
    yAxisGridGroup.selectAll(".grid-line")
        .data(yAxisTicks)
        .enter()
        .append("line")
        .attr("class", "grid-line mark")
        .attr("x1", 0)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2");

    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    xAxisLabelsGroup.selectAll(".x-tick-label")
        .data(xTicks)
        .enter()
        .append("text")
        .attr("class", "x-tick-label label")
        .attr("x", d => xScale(d))
        .attr("y", chartMargins.bottom / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .text(d => xFormat(d));

    const yAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis y-axis");
    yAxisLabelsGroup.selectAll(".y-tick-label")
        .data(yAxisTicks)
        .enter()
        .append("text")
        .attr("class", "y-tick-label label")
        .attr("x", -chartMargins.left / 2)
        .attr("y", d => yScale(d))
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .text(d => d3.format(".2~s")(d)); // Use SI prefix formatting, remove trailing zeros

    const legendRenderGroup = svgRoot.append("g") // Append to svgRoot for positioning above mainChartGroup
        .attr("class", "legend other");
    
    const legendSettings = {
        fontFamily: fillStyle.typography.label.font_family,
        fontSizePx: parseFloat(fillStyle.typography.label.font_size),
        fontWeight: fillStyle.typography.label.font_weight,
        textColor: fillStyle.textColor,
        shape: "circle",
        itemPadding: 5,
        lineHeight: parseFloat(fillStyle.typography.label.font_size) * 1.5,
        maxWidth: innerWidth 
    };
    const legendSizeInfo = layoutLegendHelper(legendRenderGroup, groups, colorScale, legendSettings);
    const legendX = chartMargins.left + (innerWidth - legendSizeInfo.width) / 2;
    const legendY = (chartMargins.top - legendSizeInfo.height) / 2; // Center in the reserved top margin space
    legendRenderGroup.attr("transform", `translate(${legendX}, ${Math.max(5, legendY)})`);


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .defined(d => d[yFieldName] != null && !isNaN(d[yFieldName])) // Handle null/NaN y-values for gaps
        .curve(d3.curveLinear);

    const lineWidth = 2.5;

    // Render images/icons first so lines can be on top if desired (or adjust opacity)
    const iconSize = Math.min(innerWidth, innerHeight) * 0.08; // Relative icon size
    const iconGroup = mainChartGroup.append("g").attr("class", "icon-group other");

    groupedData.forEach((values, group) => {
        const imageUrl = fillStyle.getImageUrl(group);
        if (imageUrl && values.length > 0) {
            const midIndex = Math.floor(values.length / 2);
            const midPoint = values[midIndex];
            if (midPoint && midPoint[xFieldName] && midPoint[yFieldName] != null) {
                const xPos = xScale(midPoint[xFieldName]);
                const yPos = yScale(midPoint[yFieldName]);
                 // Check if position is within bounds
                if (xPos >= 0 && xPos <= innerWidth && yPos >=0 && yPos <= innerHeight) {
                    iconGroup.append("image")
                        .attr("class", "icon image")
                        .attr("x", xPos - iconSize / 2)
                        .attr("y", yPos - iconSize / 2)
                        .attr("width", iconSize)
                        .attr("height", iconSize)
                        .attr("href", imageUrl)
                        .attr("opacity", 0.6) 
                        .attr("preserveAspectRatio", "xMidYMid meet");
                }
            }
        }
    });
    
    const linesGroup = mainChartGroup.append("g").attr("class", "lines-group other");
    const pointsGroup = mainChartGroup.append("g").attr("class", "points-group other");
    const labelsGroup = mainChartGroup.append("g").attr("class", "labels-group other");

    groupedData.forEach((values, group) => {
        const groupColor = colorScale(group);
        const validValues = values.filter(d => d[yFieldName] != null && !isNaN(d[yFieldName]));
        if (validValues.length === 0) return;

        linesGroup.append("path")
            .datum(validValues)
            .attr("class", "line-mark mark")
            .attr("fill", "none")
            .attr("stroke", groupColor)
            .attr("stroke-width", lineWidth)
            .attr("d", lineGenerator);

        pointsGroup.selectAll(`.data-point-${group.replace(/\W/g, '_')}`)
            .data(validValues)
            .enter()
            .append("circle")
            .attr("class", `data-point mark data-point-${group.replace(/\W/g, '_')}`)
            .attr("cx", d => xScale(d[xFieldName]))
            .attr("cy", d => yScale(d[yFieldName]))
            .attr("r", (d, i) => (i === 0 || i === validValues.length - 1) ? lineWidth * 1.8 : lineWidth * 1.2)
            .attr("fill", (d, i) => (i === 0 || i === validValues.length - 1) ? fillStyle.chartBackground : groupColor)
            .attr("stroke", groupColor)
            .attr("stroke-width", (d, i) => (i === 0 || i === validValues.length - 1) ? lineWidth * 0.8 : 0);

        const firstPoint = validValues[0];
        const lastPoint = validValues[validValues.length - 1];

        if (firstPoint) {
            labelsGroup.append("text")
                .attr("class", "data-label annotation text")
                .attr("x", xScale(firstPoint[xFieldName]) - 6)
                .attr("y", yScale(firstPoint[yFieldName]))
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.annotation.font_family)
                .style("font-size", fillStyle.typography.annotation.font_size)
                .style("font-weight", fillStyle.typography.annotation.font_weight)
                .text(d3.format(".2~s")(firstPoint[yFieldName]));
        }

        if (lastPoint && validValues.length > 1) {
            labelsGroup.append("text")
                .attr("class", "data-label annotation text")
                .attr("x", xScale(lastPoint[xFieldName]) + 6)
                .attr("y", yScale(lastPoint[yFieldName]))
                .attr("text-anchor", "start")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.annotation.font_family)
                .style("font-size", fillStyle.typography.annotation.font_size)
                .style("font-weight", fillStyle.typography.annotation.font_weight)
                .text(d3.format(".2~s")(lastPoint[yFieldName]));
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Icons already rendered in Block 8 to control layering.
    // No other complex enhancements for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}