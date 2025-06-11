/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_chart",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 2]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function creates a horizontal stacked bar chart.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Prefer dark if specified, else normal, else empty
    const rawImages = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    let missingFields = [];
    if (!dimensionFieldDef) missingFields.push("x role field");
    if (!valueFieldDef) missingFields.push("y role field");
    if (!groupFieldDef) missingFields.push("group role field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionFieldName = dimensionFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const groupFieldName = groupFieldDef.name;

    const dimensionUnit = (dimensionFieldDef.unit && dimensionFieldDef.unit !== "none") ? dimensionFieldDef.unit : "";
    const valueUnit = (valueFieldDef.unit && valueFieldDef.unit !== "none") ? valueFieldDef.unit : "";
    // const groupUnit = (groupFieldDef.unit && groupFieldDef.unit !== "none") ? groupFieldDef.unit : ""; // Not typically used for legend items

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: rawTypography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: rawTypography.label?.font_size || '12px',
            labelFontWeight: rawTypography.label?.font_weight || 'normal',
            annotationFontFamily: rawTypography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: rawTypography.annotation?.font_size || '10px',
            annotationFontWeight: rawTypography.annotation?.font_weight || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF',
        defaultBarColor: '#CCCCCC',
        labelColorLight: '#FFFFFF',
        labelColorDark: '#000000', // For contrast on light bars if needed, or for external labels
        groupColors: {},
        dimensionIcons: {}
    };
    
    const minAnnotationFontSize = 8; // Minimum font size for data labels inside bars

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.position = 'absolute';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document append/remove is not strictly necessary for getBBox if SVG is fully defined,
        // but some browsers might need it for accurate measurement.
        // For true in-memory, ensure all styles are applied directly.
        // However, to be safe and simple for this context:
        document.body.appendChild(tempSvg);
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    }
    
    const formatValue = (value) => {
        return valueUnit ? `${value}${valueUnit}` : `${value}`;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    svgRoot.style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const iconWidth = 20;
    const iconHeight = 15; // Aspect ratio maintained if possible by image
    const iconPadding = 5;
    const legendSquareSize = 12;
    const legendItemSpacing = 10; // Spacing between legend items (rect + text)
    const legendTextPadding = 5; // Spacing between legend square and text

    let chartMargins = { top: 50, right: 20, bottom: 30, left: 60 }; // Initial left margin

    // Dynamically calculate left margin based on dimension labels and icons
    const allDimensionNames = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    let maxDimLabelWidth = 0;
    allDimensionNames.forEach(dimName => {
        const formattedDimName = dimensionUnit ? `${dimName}${dimensionUnit}` : `${dimName}`;
        const textWidth = estimateTextWidth(formattedDimName, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        maxDimLabelWidth = Math.max(maxDimLabelWidth, textWidth);
    });
    
    chartMargins.left = Math.max(chartMargins.left, maxDimLabelWidth + iconWidth + iconPadding + 10); // 10 for extra space

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const uniqueGroupNames = [...new Set(chartData.map(d => d[groupFieldName]))];
    
    // Filter out "Total Paid Leave" and take the first two groups as per original logic
    const displayGroups = uniqueGroupNames.filter(g => g !== "Total Paid Leave").slice(0, 2);
    if (displayGroups.length === 0) {
        console.error("No displayable groups found after filtering. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>No displayable groups.</div>");
        return null;
    }
    if (displayGroups.length === 1) {
        console.warn("Only one displayable group found. Chart will show single segment bars.");
    }


    const firstGroupName = displayGroups[0];
    const secondGroupName = displayGroups.length > 1 ? displayGroups[1] : null;

    displayGroups.forEach((group, i) => {
        if (rawColors.field && rawColors.field[group]) {
            fillStyle.groupColors[group] = rawColors.field[group];
        } else if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            fillStyle.groupColors[group] = rawColors.available_colors[i % rawColors.available_colors.length];
        } else {
            fillStyle.groupColors[group] = d3.schemeCategory10[i % 10];
        }
    });
    
    allDimensionNames.forEach(dimName => {
        if (rawImages.field && rawImages.field[dimName]) {
            fillStyle.dimensionIcons[dimName] = rawImages.field[dimName];
        }
    });

    const dimensionTotals = {};
    allDimensionNames.forEach(dimName => {
        dimensionTotals[dimName] = 0;
        chartData.forEach(d => {
            if (d[dimensionFieldName] === dimName && displayGroups.includes(d[groupFieldName])) {
                dimensionTotals[dimName] += +d[valueFieldName] || 0;
            }
        });
    });

    const sortedDimensionNames = [...allDimensionNames].sort((a, b) => {
        const diff = dimensionTotals[b] - dimensionTotals[a];
        return diff !== 0 ? diff : a.localeCompare(b);
    });

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensionNames)
        .range([0, innerHeight])
        .padding(0.25); // A fixed padding

    const maxTotalValue = d3.max(Object.values(dimensionTotals)) || 1; // Ensure maxTotalValue is at least 1
    const xScale = d3.scaleLinear()
        .domain([0, maxTotalValue * 1.05]) // 5% padding on the right
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2})`); // Position above chart area

    let currentLegendX = 0;
    const legendItems = [];

    displayGroups.forEach((groupName, index) => {
        const legendItemG = legendGroup.append("g")
            .attr("class", "legend-item");

        legendItemG.append("rect")
            .attr("class", "mark")
            .attr("width", legendSquareSize)
            .attr("height", legendSquareSize)
            .style("fill", fillStyle.groupColors[groupName]);

        const legendTextElement = legendItemG.append("text")
            .attr("class", "label")
            .attr("x", legendSquareSize + legendTextPadding)
            .attr("y", legendSquareSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(groupName);
        
        legendItems.push({
            element: legendItemG,
            textElement: legendTextElement,
            text: groupName,
            baseFontSize: parseFloat(fillStyle.typography.labelFontSize)
        });
    });
    
    // Position legend items and adjust font size if necessary
    let totalLegendWidth = 0;
    legendItems.forEach((item, index) => {
        item.element.attr("transform", `translate(${currentLegendX}, 0)`);
        const itemWidth = item.textElement.node().getBBox().width + legendSquareSize + legendTextPadding;
        currentLegendX += itemWidth + (index < legendItems.length - 1 ? legendItemSpacing : 0);
        totalLegendWidth = currentLegendX;
    });

    if (totalLegendWidth > innerWidth) {
        const scaleFactor = innerWidth / totalLegendWidth;
        currentLegendX = 0;
        legendItems.forEach((item, index) => {
            const newFontSize = Math.max(8, item.baseFontSize * scaleFactor); // Min font size 8px
            item.textElement.style("font-size", `${newFontSize}px`);
            item.element.attr("transform", `translate(${currentLegendX}, 0)`);
            const itemWidth = item.textElement.node().getBBox().width + legendSquareSize + legendTextPadding;
            currentLegendX += itemWidth + (index < legendItems.length - 1 ? legendItemSpacing : 0);
        });
    }
    
    // Center the legend block if space allows (optional, but nice)
    if (currentLegendX < innerWidth) {
        legendGroup.attr("transform", `translate(${chartMargins.left + (innerWidth - currentLegendX) / 2}, ${chartMargins.top / 2})`);
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    sortedDimensionNames.forEach(dimName => {
        const dimensionGroup = mainChartGroup.append("g")
            .attr("class", "dimension-group")
            .attr("transform", `translate(0, ${yScale(dimName)})`);

        // Render Icon
        if (fillStyle.dimensionIcons[dimName]) {
            dimensionGroup.append("image")
                .attr("class", "icon dimension-icon")
                .attr("xlink:href", fillStyle.dimensionIcons[dimName])
                .attr("x", -(iconWidth + iconPadding))
                .attr("y", (yScale.bandwidth() - iconHeight) / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

        // Render Dimension Label
        dimensionGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", -(iconWidth + iconPadding + 5)) // 5 for space between icon and text
            .attr("y", yScale.bandwidth() / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(dimensionUnit ? `${dimName}${dimensionUnit}` : dimName);

        let currentX = 0;
        const barHeight = yScale.bandwidth();

        // First group bar and label
        const firstGroupDataPoint = chartData.find(d => d[dimensionFieldName] === dimName && d[groupFieldName] === firstGroupName);
        if (firstGroupDataPoint) {
            const value = +firstGroupDataPoint[valueFieldName] || 0;
            const barWidth = xScale(value);

            dimensionGroup.append("rect")
                .attr("class", "mark bar-segment")
                .attr("x", currentX)
                .attr("y", 0)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .style("fill", fillStyle.groupColors[firstGroupName] || fillStyle.defaultBarColor);

            if (value > 0) { // Only add label if there's a value
                const labelText = formatValue(value);
                let targetFontSize = parseFloat(fillStyle.typography.annotationFontSize);
                let labelWidth = estimateTextWidth(labelText, { 
                    fontFamily: fillStyle.typography.annotationFontFamily, 
                    fontSize: `${targetFontSize}px`, 
                    fontWeight: fillStyle.typography.annotationFontWeight 
                });

                if (barWidth < labelWidth + 2 * iconPadding) { // Use iconPadding for text padding inside bar
                    const scale = barWidth / (labelWidth + 2 * iconPadding);
                    targetFontSize = Math.max(minAnnotationFontSize, targetFontSize * scale);
                }
                
                if (targetFontSize >= minAnnotationFontSize && barWidth > (iconPadding*2) ) { // Only render if font not too small and bar has some width
                    dimensionGroup.append("text")
                        .attr("class", "value data-label")
                        .attr("x", currentX + barWidth / 2)
                        .attr("y", barHeight / 2)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "middle")
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", `${targetFontSize}px`)
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .style("fill", fillStyle.labelColorLight)
                        .text(labelText);
                }
            }
            currentX += barWidth;
        }

        // Second group bar and label (if exists)
        if (secondGroupName) {
            const secondGroupDataPoint = chartData.find(d => d[dimensionFieldName] === dimName && d[groupFieldName] === secondGroupName);
            if (secondGroupDataPoint) {
                const value = +secondGroupDataPoint[valueFieldName] || 0;
                const barWidth = xScale(value);

                dimensionGroup.append("rect")
                    .attr("class", "mark bar-segment")
                    .attr("x", currentX)
                    .attr("y", 0)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .style("fill", fillStyle.groupColors[secondGroupName] || fillStyle.defaultBarColor);

                if (value > 0) {
                    const labelText = formatValue(value);
                    let targetFontSize = parseFloat(fillStyle.typography.annotationFontSize);
                    let labelWidth = estimateTextWidth(labelText, { 
                        fontFamily: fillStyle.typography.annotationFontFamily, 
                        fontSize: `${targetFontSize}px`, 
                        fontWeight: fillStyle.typography.annotationFontWeight 
                    });

                    if (barWidth < labelWidth + 2 * iconPadding) {
                         const scale = barWidth / (labelWidth + 2 * iconPadding);
                         targetFontSize = Math.max(minAnnotationFontSize, targetFontSize * scale);
                    }

                    if (targetFontSize >= minAnnotationFontSize && barWidth > (iconPadding*2)) {
                        dimensionGroup.append("text")
                            .attr("class", "value data-label")
                            .attr("x", currentX + barWidth / 2)
                            .attr("y", barHeight / 2)
                            .attr("dy", "0.35em")
                            .attr("text-anchor", "middle")
                            .style("font-family", fillStyle.typography.annotationFontFamily)
                            .style("font-size", `${targetFontSize}px`)
                            .style("font-weight", fillStyle.typography.annotationFontWeight)
                            .style("fill", fillStyle.labelColorLight)
                            .text(labelText);
                    }
                }
                // currentX += barWidth; // Not needed if only two groups
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex visual effects like shadows, gradients, or hand-drawn styles.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}