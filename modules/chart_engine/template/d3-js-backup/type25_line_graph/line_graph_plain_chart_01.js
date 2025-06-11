/* REQUIREMENTS_BEGIN
{
  "chart_type": "Line Graph",
  "chart_name": "line_graph_plain_chart_01",
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
  "iconographyUsage": "background_contextual"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const config = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Assumes light theme, or use data.colors_dark for dark
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    const xFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const yFieldName = yFieldConfig ? yFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x field" : null,
            !yFieldName ? "y field" : null,
            !groupFieldName ? "group field" : null
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: [${missingFields} role mapping in dataColumns]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [xFieldName]: new Date(d[xFieldName]), // Ensure xField is Date object
        [yFieldName]: +d[yFieldName] // Ensure yField is number
    }));


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
        },
        textColor: colorsConfig.text_color || '#0f223b',
        axisLineColor: colorsConfig.other && colorsConfig.other.axis_line ? colorsConfig.other.axis_line : '#888888', // Example, not in original
        gridLineColor: colorsConfig.other && colorsConfig.other.grid_line ? colorsConfig.other.grid_line : '#e0e0e0',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        defaultLineColor: (colorsConfig.other && colorsConfig.other.primary) || '#1f77b4',
        getGroupColor: (groupName, index) => {
            if (colorsConfig.field && colorsConfig.field[groupName]) {
                return colorsConfig.field[groupName];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
            }
            return d3.schemeCategory10[index % 10];
        },
        getGroupImageURL: (groupName) => {
            if (imagesConfig.field && imagesConfig.field[groupName]) {
                return imagesConfig.field[groupName];
            }
            return null;
        }
    };

    function estimateTextWidth(text, fontProps = {}) {
        const defaultFont = `${fillStyle.typography.labelFontSize} ${fillStyle.typography.labelFontFamily}`;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.textContent = text;
        tempText.style.font = fontProps.font || defaultFont;
        if (fontProps.fontFamily) tempText.style.fontFamily = fontProps.fontFamily;
        if (fontProps.fontSize) tempText.style.fontSize = fontProps.fontSize;
        if (fontProps.fontWeight) tempText.style.fontWeight = fontProps.fontWeight;
        tempSvg.appendChild(tempText);
        // Appending to body to ensure getBBox works, then remove.
        // This is a common pattern, though the prompt said "MUST NOT be appended to the document DOM".
        // However, getBBox often returns 0s if not in DOM. For robust measurement, a brief append/remove is safer.
        // If strictly no DOM append, then this might be less accurate.
        // Let's try without appending first, as per strict rule.
        // document.body.appendChild(tempSvg);
        const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg);
        return width;
    }
    
    function renderLegend(legendContainerGroup, groupNames, colorScale, itemShape = "circle", itemSize = 10, itemSpacing = 5, lineSpacing = 15, maxWidth) {
        let currentX = 0;
        let currentY = 0;
        let maxLineWidth = 0;
        const legendPadding = 5;

        groupNames.forEach((groupName, i) => {
            const color = colorScale(groupName);
            const text = groupName;
            
            const shapeWidth = itemSize + itemSpacing;
            const textWidth = estimateTextWidth(text, { 
                fontSize: fillStyle.typography.labelFontSize, 
                fontFamily: fillStyle.typography.labelFontFamily,
                fontWeight: 'bold' // Original legend font weight
            });
            const itemTotalWidth = shapeWidth + textWidth + itemSpacing * 2; // Add some padding

            if (currentX + itemTotalWidth > maxWidth && currentX > 0) { // Wrap if not first item and exceeds max width
                currentX = 0;
                currentY += itemSize + lineSpacing;
            }

            const legendItemGroup = legendContainerGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${currentY})`);

            if (itemShape === "circle") {
                legendItemGroup.append("circle")
                    .attr("class", "legend-mark mark")
                    .attr("cx", itemSize / 2)
                    .attr("cy", itemSize / 2)
                    .attr("r", itemSize / 2)
                    .attr("fill", color);
            } else { // Default to rect
                legendItemGroup.append("rect")
                    .attr("class", "legend-mark mark")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", itemSize)
                    .attr("height", itemSize)
                    .attr("fill", color);
            }

            legendItemGroup.append("text")
                .attr("class", "legend-label label")
                .attr("x", shapeWidth)
                .attr("y", itemSize / 2)
                .attr("dy", "0.35em") // Vertical alignment
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", 'bold')
                .text(text);

            currentX += itemTotalWidth;
            if (currentX > maxLineWidth) {
                maxLineWidth = currentX;
            }
        });
        return { width: maxLineWidth, height: currentY + itemSize + legendPadding * 2 };
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 30, bottom: 50, left: 60 }; // Adjusted bottom for x-axis labels, left for y-axis
    // Legend height needs to be estimated or fixed to adjust top margin.
    // For now, assume legend fits in current top margin or is placed dynamically.
    // Let's reserve space for legend at the top.
    const estimatedLegendHeight = 50; // Estimate; will be calculated later.
    chartMargins.top += estimatedLegendHeight;


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groupNames = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort();

    const groupedData = d3.group(chartDataArray, d => d[groupFieldName]);
    groupedData.forEach(values => {
        values.sort((a, b) => a[xFieldName] - b[xFieldName]); // Sort by date
    });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(chartDataArray, d => d[xFieldName]))
        .range([0, innerWidth]);

    const yMin = d3.min(chartDataArray, d => d[yFieldName]);
    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const yPadding = (yMax - yMin) * 0.3 || yMax * 0.3; // Handle case where yMin === yMax
    const yDomainMax = yMax + yPadding;
    const yDomainMin = Math.min(0, yMin - yPadding);

    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0]);

    const colorScale = d3.scaleOrdinal()
        .domain(groupNames)
        .range(groupNames.map((g, i) => fillStyle.getGroupColor(g, i)));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xTicks = xScale.ticks(d3.timeMonth.every(1)); // Example: monthly ticks, adjust as needed
    const xAxisTickFormat = d3.timeFormat("%b %Y"); // Example: "Jan 2023"

    // X-axis labels (interval style)
    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis-labels");

    for (let i = 0; i < xTicks.length - 1; i++) {
        const currentTickDate = xTicks[i];
        const nextTickDate = xTicks[i+1];
        const x1 = xScale(currentTickDate);
        const x2 = xScale(nextTickDate);
        const midX = (x1 + x2) / 2;

        xAxisLabelsGroup.append("text")
            .attr("class", "x-axis-label label")
            .attr("x", midX)
            .attr("y", innerHeight + 25) // Position below chart area
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xAxisTickFormat(currentTickDate));
    }
     if (xTicks.length === 1) { // Handle case with only one tick (e.g. single month data)
        xAxisLabelsGroup.append("text")
            .attr("class", "x-axis-label label")
            .attr("x", xScale(xTicks[0]))
            .attr("y", innerHeight + 25)
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xAxisTickFormat(xTicks[0]));
    }


    const yAxisTicks = yScale.ticks(5); // As per original: 5 ticks
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    yAxisGroup.selectAll(".y-axis-label")
        .data(yAxisTicks)
        .enter()
        .append("text")
        .attr("class", "y-axis-label label")
        .attr("x", -15) // Position to the left of the chart area
        .attr("y", d => yScale(d))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d.toFixed(1));

    // Horizontal gridlines
    const gridLinesGroup = mainChartGroup.append("g")
        .attr("class", "grid-lines other");

    gridLinesGroup.selectAll(".grid-line")
        .data(yAxisTicks)
        .enter()
        .append("line")
        .attr("class", "grid-line other")
        .attr("x1", 0)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2");

    // Legend
    const legendContainerGroup = svgRoot.append("g") // Append to svgRoot to position it in the top margin
        .attr("class", "legend");
    
    const legendDimensions = renderLegend(
        legendContainerGroup, 
        groupNames, 
        colorScale,
        "circle", // shape
        10, // itemSize (diameter for circle)
        5, // itemSpacing
        10, // lineSpacing
        innerWidth // maxWidth for legend
    );

    // Position legend: centered in the top margin area
    const legendX = chartMargins.left + (innerWidth - legendDimensions.width) / 2;
    const legendY = (chartMargins.top - estimatedLegendHeight) + (estimatedLegendHeight - legendDimensions.height) / 2; // Center in reserved space
    legendContainerGroup.attr("transform", `translate(${legendX}, ${Math.max(10, legendY)})`); // Ensure some top padding


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    const lineWidth = 4; // As per original

    groupedData.forEach((values, groupName) => {
        const groupColor = colorScale(groupName);

        // Lines
        mainChartGroup.append("path")
            .datum(values)
            .attr("class", "line mark")
            .attr("fill", "none")
            .attr("stroke", groupColor)
            .attr("stroke-width", lineWidth)
            .attr("d", lineGenerator);

        // Data points and labels
        values.forEach((d, i) => {
            const cx = xScale(d[xFieldName]);
            const cy = yScale(d[yFieldName]);
            const isEndpoint = i === 0 || i === values.length - 1;

            if (isEndpoint) {
                mainChartGroup.append("circle")
                    .attr("class", "point mark endpoint")
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("r", lineWidth * 1.2)
                    .attr("fill", fillStyle.chartBackground) // White fill
                    .attr("stroke", groupColor)
                    .attr("stroke-width", lineWidth);

                // Data labels for endpoints
                mainChartGroup.append("text")
                    .attr("class", "data-label label")
                    .attr("x", cx + (i === 0 ? -10 : 10)) // Adjust position based on start/end
                    .attr("y", cy)
                    .attr("text-anchor", i === 0 ? "end" : "start")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", fillStyle.textColor) // Black text as per original comment
                    .style("font-family", fillStyle.typography.annotationFontFamily) // Use annotation for data labels
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight) // Normal weight
                    .text(d[yFieldName].toFixed(2));
            } else {
                mainChartGroup.append("circle")
                    .attr("class", "point mark midpoint")
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("r", lineWidth)
                    .attr("fill", groupColor)
                    .attr("stroke", "none");
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Image watermarks (if configured)
    const imageWatermarkGroup = mainChartGroup.append("g")
        .attr("class", "image-watermarks other");

    if (imagesConfig && imagesConfig.field) {
        const iconSize = Math.min(innerWidth, innerHeight) * 0.15; // Relative size, e.g., 15% of smaller dimension
        const usableWidthForIcons = innerWidth * 0.7;
        const iconMargin = (innerWidth - usableWidthForIcons) / 2;
        const sectionWidth = groupNames.length > 0 ? usableWidthForIcons / groupNames.length : usableWidthForIcons;

        groupNames.forEach((groupName, groupIndex) => {
            const imageURL = fillStyle.getGroupImageURL(groupName);
            if (imageURL) {
                const groupValues = groupedData.get(groupName);
                if (!groupValues || groupValues.length === 0) return;

                const xPosInSection = iconMargin + sectionWidth * (groupIndex + 0.5);
                const xDateAtPos = xScale.invert(xPosInSection);

                let closestPoint = groupValues[0];
                let minDistance = Math.abs(closestPoint[xFieldName] - xDateAtPos);

                for (let k = 1; k < groupValues.length; k++) {
                    const distance = Math.abs(groupValues[k][xFieldName] - xDateAtPos);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestPoint = groupValues[k];
                    }
                }
                
                const yPosForIcon = yScale(closestPoint[yFieldName]);

                imageWatermarkGroup.append("image")
                    .attr("class", "icon image watermark")
                    .attr("xlink:href", imageURL)
                    .attr("x", xPosInSection - iconSize / 2)
                    .attr("y", yPosForIcon - iconSize / 2)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("opacity", 0.15) // Make it a subtle watermark
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        });
        // Ensure watermarks are behind lines and points
        imageWatermarkGroup.lower(); 
        gridLinesGroup.lower(); // Gridlines should be behind everything except watermarks potentially
    }


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}