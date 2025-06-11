/* REQUIREMENTS_BEGIN
{
  "chart_type": "Stacked Area Chart",
  "chart_name": "stacked_area_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 10], [0, "inf"], [2, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "light",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data.data;
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    const imagesConfig = data.images || {}; // Though not used in this chart type
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    if (!xFieldConfig || !yFieldConfig || !groupFieldConfig) {
        const missing = [
            !xFieldConfig ? "x field config" : null,
            !yFieldConfig ? "y field config" : null,
            !groupFieldConfig ? "group field config" : null
        ].filter(Boolean).join(', ');
        const errorMsg = `Critical chart config missing: [${missing}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    if (!rawChartData || rawChartData.length === 0) {
        const errorMsg = "No data provided to chart. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyConfig.title?.font_size || '16px',
            titleFontWeight: typographyConfig.title?.font_weight || 'bold',
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '14px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal', // Y-axis labels were bold, X-axis normal. Standardize.
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationSmallFontSize: typographyConfig.annotation?.font_size || '10px', // For original value
            annotationMediumFontSize: typographyConfig.annotation?.font_size || '12px', // For percentage
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'bold',
        },
        textColor: colorsConfig.text_color || '#333333',
        legendTextColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        gridLineColor: '#DDDDDD',
        axisLineColor: '#AAAAAA',
        defaultCategoryColors: d3.schemeCategory10,
        getCategoryColor: (groupName, index) => {
            if (colorsConfig.field && colorsConfig.field[groupFieldName] && colorsConfig.field[groupFieldName][groupName]) {
                return colorsConfig.field[groupFieldName][groupName];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
            }
            return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
        }
    };

    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM.
        // For simple cases, this might work, but it's less robust than appending to DOM.
        // If issues arise, a temporary DOM append/remove might be needed for getBBox.
        // However, for this refactoring, sticking to "MUST NOT be appended to the document DOM".
        // A more robust in-memory approach might involve Canvas's measureText if SVG context is tricky.
        // For now, assuming getBBox on an unattached element provides a reasonable estimate.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements fails (e.g., jsdom older versions)
            return (text?.length || 0) * (parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
    }
    
    function getDarkerColor(color, factor = 0.7) {
        const c = d3.color(color);
        if (!c) return color; // Return original if color parsing fails
        return d3.rgb(c.r * factor, c.g * factor, c.b * factor).toString();
    }

    function layoutLegend(legendGroup, items, colorsConfig, options) {
        const {
            x = 0, y = 0, fontSize = 12, fontWeight = "normal",
            align = "left", maxWidth = 200, shape = "rect",
            itemPadding = 5, lineSpacing = 18, shapeSize = 10
        } = options;

        legendGroup.selectAll("*").remove(); // Clear previous legend items

        let currentX = x;
        let currentY = y;
        let maxLineWidth = 0;
        let totalHeight = lineSpacing; // Start with one line height

        items.forEach((item, i) => {
            const itemColor = fillStyle.getCategoryColor(item, i);
            const itemText = item;

            const textWidth = estimateTextWidth(itemText, { fontSize: `${fontSize}px`, fontWeight });
            const itemWidth = shapeSize + 5 + textWidth + itemPadding;

            if (currentX + itemWidth > x + maxWidth && currentX > x) { // Wrap line
                currentX = x;
                currentY += lineSpacing;
                totalHeight += lineSpacing;
            }

            const gItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${currentY})`);

            if (shape === "rect") {
                gItem.append("rect")
                    .attr("class", "mark legend-shape")
                    .attr("x", 0)
                    .attr("y", -shapeSize / 2)
                    .attr("width", shapeSize)
                    .attr("height", shapeSize)
                    .attr("fill", itemColor);
            } else if (shape === "circle") {
                gItem.append("circle")
                    .attr("class", "mark legend-shape")
                    .attr("cx", shapeSize / 2)
                    .attr("cy", 0)
                    .attr("r", shapeSize / 2)
                    .attr("fill", itemColor);
            }

            gItem.append("text")
                .attr("class", "label legend-text")
                .attr("x", shapeSize + 5)
                .attr("y", 0)
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.legendTextColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${fontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight) // Use label weight for consistency
                .text(itemText);

            currentX += itemWidth;
            if (currentX - x > maxLineWidth) {
                maxLineWidth = currentX - x;
            }
        });
        
        if (items.length === 0) totalHeight = 0;

        return { width: Math.min(maxLineWidth, maxWidth), height: totalHeight };
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 20, bottom: 60, left: 60 }; // Adjusted left for Y-axis labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const groups = [...new Set(rawChartData.map(d => d[groupFieldName]))]
        .sort((a, b) => {
            const avgA = d3.mean(rawChartData.filter(d => d[groupFieldName] === a), d => d[yFieldName]);
            const avgB = d3.mean(rawChartData.filter(d => d[groupFieldName] === b), d => d[yFieldName]);
            return avgB - avgA; // Larger average at the bottom of stack
        });

    const xValuesByGroup = {};
    groups.forEach(group => {
        xValuesByGroup[group] = new Set(
            rawChartData.filter(d => d[groupFieldName] === group).map(d => d[xFieldName])
        );
    });

    let commonXValues = groups.length > 0 ? [...xValuesByGroup[groups[0]]] : [];
    for (let i = 1; i < groups.length; i++) {
        commonXValues = commonXValues.filter(x => xValuesByGroup[groups[i]].has(x));
    }

    commonXValues.sort((a, b) => {
        const aIndex = rawChartData.findIndex(d => d[xFieldName] === a);
        const bIndex = rawChartData.findIndex(d => d[xFieldName] === b);
        return aIndex - bIndex;
    });

    const filteredChartData = rawChartData.filter(d => commonXValues.includes(d[xFieldName]));
    
    if (commonXValues.length === 0 || filteredChartData.length === 0) {
        const errorMsg = "No common X values found across all groups, or filtered data is empty. Cannot render chart.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }


    const groupedDataByX = d3.group(filteredChartData, d => d[xFieldName]);

    const stackInputData = Array.from(groupedDataByX, ([key, values]) => {
        const obj = { category: key };
        values.forEach(v => {
            obj[v[groupFieldName]] = v[yFieldName];
        });
        return obj;
    });

    stackInputData.forEach(d => {
        groups.forEach(group => {
            if (d[group] === undefined) {
                d[group] = 0;
            }
        });
    });

    stackInputData.sort((a, b) => {
        return commonXValues.indexOf(a.category) - commonXValues.indexOf(b.category);
    });

    stackInputData.forEach(d => {
        const total = groups.reduce((sum, group) => sum + (d[group] || 0), 0);
        groups.forEach(group => {
            d[group + "_original"] = d[group] || 0;
            d[group] = total === 0 ? 0 : ((d[group] || 0) / total) * 100;
        });
    });

    const stackGenerator = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone) // Groups are already sorted for stacking order
        .offset(d3.stackOffsetNone);

    const stackedSeriesData = stackGenerator(stackInputData);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(commonXValues)
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, 100]) // Percentages
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (Axes, Gridlines, Legend)
    // Y-axis Gridlines & Labels
    const yAxisGroup = mainChartGroup.append("g").attr("class", "axis y-axis");
    const yTicks = [0, 20, 40, 60, 80, 100];
    yTicks.forEach(tick => {
        yAxisGroup.append("line")
            .attr("class", "gridline")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", innerWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,2");

        yAxisGroup.append("text")
            .attr("class", "label y-axis-label")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(tick + "%");
    });

    // X-axis Labels & Line
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    commonXValues.forEach(category => {
        xAxisGroup.append("text")
            .attr("class", "label x-axis-label")
            .attr("x", xScale(category) + xScale.bandwidth() / 2)
            .attr("y", 25) // Position below axis line
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(category);
    });

    xAxisGroup.append("line")
        .attr("class", "line x-axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", innerWidth)
        .attr("y2", 0)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Legend
    const legendGroup = mainChartGroup.append("g")
        .attr("class", "legend");
    
    const legendTitleText = groupFieldConfig.label || groupFieldName;
    const legendTitleWidth = estimateTextWidth(legendTitleText, { 
        fontFamily: fillStyle.typography.titleFontFamily, 
        fontSize: fillStyle.typography.titleFontSize,
        fontWeight: fillStyle.typography.titleFontWeight 
    });
    const legendTitleMargin = 15;

    const legendItemsGroup = legendGroup.append("g").attr("class", "legend-items");
    const legendSize = layoutLegend(legendItemsGroup, groups, colorsConfig, {
        x: 0, // Relative to legendItemsGroup
        y: 0, // Relative to legendItemsGroup
        fontSize: parseFloat(fillStyle.typography.labelFontSize),
        fontWeight: fillStyle.typography.labelFontWeight,
        align: "left",
        maxWidth: innerWidth - legendTitleWidth - legendTitleMargin,
        shape: "rect",
    });
    
    legendGroup.append("text")
        .attr("class", "text legend-title")
        .attr("x", 0)
        .attr("y", legendSize.height / 2) // Vertically center with items
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.titleFontFamily)
        .style("font-size", fillStyle.typography.titleFontSize)
        .style("font-weight", fillStyle.typography.titleFontWeight)
        .text(legendTitleText);

    legendItemsGroup.attr("transform", `translate(${legendTitleWidth + legendTitleMargin}, 0)`);
    
    const totalLegendWidth = legendTitleWidth + legendTitleMargin + legendSize.width;
    legendGroup.attr("transform", `translate(${(innerWidth - totalLegendWidth) / 2}, ${-chartMargins.top / 2 - legendSize.height / 2})`);


    // Block 8: Main Data Visualization Rendering
    const barAndTransitionGroup = mainChartGroup.append("g").attr("class", "data-visualization-group");

    commonXValues.forEach((categoryXValue, categoryIndex) => {
        const barDataForCategory = stackInputData.find(d => d.category === categoryXValue);
        if (!barDataForCategory) return;

        const barXPosition = xScale(categoryXValue);
        const barWidth = xScale.bandwidth();
        let cumulativeYPercentage = 0; // Tracks the top of the current segment in percentage

        groups.forEach((groupName, groupIndex) => {
            const percentageValue = barDataForCategory[groupName]; // This is already percentage
            const originalValue = barDataForCategory[groupName + "_original"];
            
            // y0 is the bottom of the segment, y1 is the top, in percentage
            const y0Percentage = cumulativeYPercentage;
            const y1Percentage = cumulativeYPercentage + percentageValue;

            const segmentYPosition = yScale(y1Percentage); // Top of the segment in pixels
            const segmentHeight = yScale(y0Percentage) - yScale(y1Percentage); // Height in pixels

            const segmentColor = fillStyle.getCategoryColor(groupName, groupIndex);

            // Render bar segment
            barAndTransitionGroup.append("rect")
                .attr("class", "mark bar-segment")
                .attr("x", barXPosition)
                .attr("y", segmentYPosition)
                .attr("width", barWidth)
                .attr("height", segmentHeight)
                .attr("fill", segmentColor);

            // Data Labels (Percentage and Original Value)
            const minHeightForLabel = 25; // pixels
            if (segmentHeight >= minHeightForLabel) {
                const labelX = barXPosition + barWidth / 2;
                const labelY = segmentYPosition + segmentHeight / 2;

                // Percentage Label
                barAndTransitionGroup.append("text")
                    .attr("class", "label value-label percentage-label")
                    .attr("x", labelX)
                    .attr("y", labelY - (segmentHeight > 35 ? 7 : 0)) // Adjust if enough space for two lines
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", "#FFFFFF") // Assuming white is good contrast
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationMediumFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .text(`${percentageValue.toFixed(1)}%`);

                // Original Value Label (if space allows or different styling)
                 if (segmentHeight > 35) { // Only show original if more space
                    barAndTransitionGroup.append("text")
                        .attr("class", "label value-label original-value-label")
                        .attr("x", labelX)
                        .attr("y", labelY + 7)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .attr("fill", getDarkerColor(segmentColor, 0.3)) // Darker shade of bar for contrast
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", fillStyle.typography.annotationSmallFontSize)
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .text(`(${originalValue.toFixed(1)})`);
                 }
            }

            // Transition Area to next category's segment
            if (categoryIndex < commonXValues.length - 1) {
                const nextCategoryXValue = commonXValues[categoryIndex + 1];
                const nextBarDataForCategory = stackInputData.find(d => d.category === nextCategoryXValue);

                if (nextBarDataForCategory) {
                    const nextPercentageValue = nextBarDataForCategory[groupName];
                    
                    // Calculate cumulative Y for the *next* bar up to this group
                    let nextCumulativeYPercentage = 0;
                    for (let k = 0; k < groupIndex; k++) {
                        nextCumulativeYPercentage += nextBarDataForCategory[groups[k]];
                    }
                    const nextY0Percentage = nextCumulativeYPercentage;
                    const nextY1Percentage = nextCumulativeYPercentage + nextPercentageValue;

                    const transitionPath = d3.path();
                    transitionPath.moveTo(barXPosition + barWidth, segmentYPosition); // Current top-right
                    transitionPath.lineTo(xScale(nextCategoryXValue), yScale(nextY1Percentage)); // Next top-left
                    transitionPath.lineTo(xScale(nextCategoryXValue), yScale(nextY0Percentage)); // Next bottom-left
                    transitionPath.lineTo(barXPosition + barWidth, segmentYPosition + segmentHeight); // Current bottom-right
                    transitionPath.closePath();
                    
                    barAndTransitionGroup.append("path")
                        .attr("class", "mark transition-area")
                        .attr("d", transitionPath.toString())
                        .attr("fill", getDarkerColor(segmentColor, 0.9)); // Slightly darker for transition
                }
            }
            cumulativeYPercentage = y1Percentage; // Update for the next group in the same bar
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements required for this chart based on directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}