/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_chart_5",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 4]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data;
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed in colors_dark
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x"; // Typically dimension
    const yFieldRole = "y"; // Typically value
    const groupFieldRole = "group";

    const dimensionColumn = dataColumns.find(col => col.role === xFieldRole);
    const valueColumn = dataColumns.find(col => col.role === yFieldRole);
    const groupColumn = dataColumns.find(col => col.role === groupFieldRole);

    const dimensionField = dimensionColumn?.name;
    const valueField = valueColumn?.name;
    const groupField = groupColumn?.name;

    const missingFields = [];
    if (!dimensionField) missingFields.push(`field with role '${xFieldRole}'`);
    if (!valueField) missingFields.push(`field with role '${yFieldRole}'`);
    if (!groupField) missingFields.push(`field with role '${groupFieldRole}'`);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    if (!chartDataInput || chartDataInput.length === 0) {
        const errorMsg = "No data provided to chart. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionUnit = (dimensionColumn?.unit && dimensionColumn.unit !== "none") ? dimensionColumn.unit : "";
    const valueUnit = (valueColumn?.unit && valueColumn.unit !== "none") ? valueColumn.unit : "";
    // const groupUnit = (groupColumn?.unit && groupColumn.unit !== "none") ? groupColumn.unit : ""; // Not used in original rendering

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyInput.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyInput.title?.font_size || '18px',
            titleFontWeight: typographyInput.title?.font_weight || 'bold',
            labelFontFamily: typographyInput.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyInput.label?.font_size || '12px',
            labelFontWeight: typographyInput.label?.font_weight || 'normal',
            annotationFontFamily: typographyInput.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyInput.annotation?.font_size || '12px', // Original used 14px for data labels, let's use annotation
            annotationFontWeight: typographyInput.annotation?.font_weight || 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        barCategoryColor: (group, groupIndex, allGroups) => {
            if (colorsInput.field && colorsInput.field[group]) {
                return colorsInput.field[group];
            }
            if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                const idx = allGroups ? allGroups.indexOf(group) : groupIndex;
                return colorsInput.available_colors[idx % colorsInput.available_colors.length];
            }
            return colorsInput.other?.primary || '#4682B4'; // Default color
        },
        iconUrl: (dimensionValue) => {
            if (imagesInput.field && imagesInput.field[dimensionValue]) {
                return imagesInput.field[dimensionValue];
            }
            if (imagesInput.other && imagesInput.other.primary && dimensionValue === "default_icon_key") { // Example for a generic icon
                 return imagesInput.other.primary;
            }
            return null;
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // document.body.appendChild(svg); // Temporary append for measurement if getBBox fails on detached elements in some environments
        const width = textElement.getBBox().width;
        // document.body.removeChild(svg); // Clean up
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    const formatValueWithUnit = (value) => {
        const formattedVal = formatValue(value);
        if (valueUnit && valueUnit.length > 3) { // If unit is long, don't append
            return formattedVal;
        }
        return valueUnit ? `${formattedVal}${valueUnit}` : formattedVal;
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root-svg")
        .style("background-color", fillStyle.chartBackground);


    // Block 4: Core Chart Dimensions & Layout Calculation
    const iconSize = 24; // Reduced from 32 for potentially tighter layouts
    const iconPadding = 8;
    const legendSquareSize = 12;
    const legendSpacing = 5;
    const legendItemGap = 10;

    // Calculate max dimension label width (icon + text) for left margin
    let maxDimLabelWidth = 0;
    const tempDimensionsForWidthCalc = [...new Set(chartDataInput.map(d => d[dimensionField]))];
    tempDimensionsForWidthCalc.forEach(dim => {
        const text = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const textW = estimateTextWidth(text, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        let currentLabelWidth = textW;
        if (fillStyle.iconUrl(dim)) { // Check if icon exists for this dimension
            currentLabelWidth += iconSize + iconPadding;
        }
        maxDimLabelWidth = Math.max(maxDimLabelWidth, currentLabelWidth);
    });
    
    const chartMargins = {
        top: variables.margin_top || 80,
        right: variables.margin_right || 160,
        bottom: variables.margin_bottom || 60,
        left: variables.margin_left || Math.max(80, maxDimLabelWidth + 20) // Ensure space for labels
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;


    // Block 5: Data Preprocessing & Transformation
    const allDimensions = [...new Set(chartDataInput.map(d => d[dimensionField]))];
    const allGroups = [...new Set(chartDataInput.map(d => d[groupField]))];

    // Specific filter from original code - kept for visual consistency with original example if it relied on this.
    // For a truly generic chart, this might be removed or made configurable.
    const displayGroups = allGroups.filter(g => g !== "Total Paid Leave"); 

    const dimensionTotals = {};
    allDimensions.forEach(dim => {
        let total = 0;
        displayGroups.forEach(group => {
            const dataPoint = chartDataInput.find(d => d[dimensionField] === dim && d[groupField] === group);
            if (dataPoint && typeof +dataPoint[valueField] === 'number' && !isNaN(+dataPoint[valueField])) {
                total += +dataPoint[valueField];
            }
        });
        dimensionTotals[dim] = total;
    });

    const dimensions = [...allDimensions].sort((a, b) => {
        const diff = dimensionTotals[b] - dimensionTotals[a];
        if (diff !== 0) return diff;
        return a.localeCompare(b);
    });
    

    // Block 6: Scale Definition & Configuration
    const maxBarHeight = variables.max_bar_height || 24;
    const minBarHeight = variables.min_bar_height || 16;
    const dataLabelGap = 5; // Gap between bar and its data label below

    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(variables.bar_padding || 0.5); // Padding between dimension bands

    // Ensure calculatedBarHeight does not exceed available band space
    const bandHeight = yScale.bandwidth();
    const calculatedBarHeight = Math.min(
        maxBarHeight,
        Math.max(minBarHeight, bandHeight * 0.6) // e.g. 60% of band height
    );
    
    const maxTotalValue = d3.max(Object.values(dimensionTotals));
    const xScale = d3.scaleLinear()
        .domain([0, maxTotalValue > 0 ? maxTotalValue * 1.05 : 1]) // Handle empty/zero data
        .range([0, innerWidth]);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickSize(0)
        .tickPadding(10)
        .tickFormat(d => {
            const formattedNum = formatValue(d);
            if (valueUnit && valueUnit.length > 3) return formattedNum;
            return valueUnit ? `${formattedNum}${valueUnit}` : formattedNum;
        });

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll(".tick line").remove();
    xAxisGroup.selectAll(".tick text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // Legend
    const legendContainerGroup = svgRoot.append("g")
        .attr("class", "legend-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top - 30})`); // Position above chart area

    let currentX = 0;
    const legendItems = [];
    displayGroups.forEach((group, i) => {
        const groupText = group; // Assuming groupUnit is not typically displayed in legend
        const textWidth = estimateTextWidth(groupText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        const itemWidth = legendSquareSize + legendSpacing + textWidth;
        legendItems.push({ group, text: groupText, width: itemWidth, index: i });
    });
    
    // Simple legend layout: try to fit in one line, adjust font if too long.
    // More complex wrapping or multi-line logic could be added if needed.
    let legendFontSize = parseFloat(fillStyle.typography.labelFontSize);
    let totalLegendWidth = legendItems.reduce((sum, item) => sum + item.width, 0) + (legendItems.length - 1) * legendItemGap;
    const availableLegendWidth = innerWidth + chartMargins.right - 20; // Use full available width

    while (totalLegendWidth > availableLegendWidth && legendFontSize > 8) {
        legendFontSize -= 0.5;
        totalLegendWidth = 0;
        legendItems.forEach(item => {
            const newTextWidth = estimateTextWidth(item.text, fillStyle.typography.labelFontFamily, `${legendFontSize}px`, fillStyle.typography.labelFontWeight);
            item.width = legendSquareSize + legendSpacing + newTextWidth;
            totalLegendWidth += item.width;
        });
        totalLegendWidth += (legendItems.length - 1) * legendItemGap;
    }
    
    currentX = 0; // Reset for drawing
    legendItems.forEach(item => {
        const legendItemG = legendContainerGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, 0)`);

        legendItemG.append("rect")
            .attr("class", "mark")
            .attr("width", legendSquareSize)
            .attr("height", legendSquareSize)
            .attr("fill", fillStyle.barCategoryColor(item.group, item.index, displayGroups));

        legendItemG.append("text")
            .attr("class", "label")
            .attr("x", legendSquareSize + legendSpacing)
            .attr("y", legendSquareSize / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${legendFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(item.text);
        
        currentX += item.width + legendItemGap;
    });


    // Block 8: Main Data Visualization Rendering
    dimensions.forEach((dim) => {
        const bandTopY = yScale(dim);
        const bandCenterY = bandTopY + yScale.bandwidth() / 2;

        const dimensionRowGroup = mainChartGroup.append("g")
            .attr("class", "dimension-row-group")
            .attr("transform", `translate(0, ${bandCenterY})`);

        // Dimension label and icon (Icon | Text | Bar starts at x=0)
        const dimText = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const dimTextWidth = estimateTextWidth(dimText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        const iconUrl = fillStyle.iconUrl(dim);
        
        let currentLabelX = -iconPadding; // End of text will be at -iconPadding from bar start
        
        dimensionRowGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", currentLabelX)
            .attr("y", 0) // Centered by transform and dominant-baseline
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(dimText);

        if (iconUrl) {
            dimensionRowGroup.append("image")
                .attr("class", "icon dimension-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", currentLabelX - dimTextWidth - iconPadding - iconSize)
                .attr("y", -iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

        // Bars and Data Labels
        let currentBarX = 0;
        const barRectY = -calculatedBarHeight / 2; // Relative to bandCenterY
        const dataLabelY = calculatedBarHeight / 2 + dataLabelGap; // Relative to bandCenterY, below bar

        const segmentLabelsData = [];

        displayGroups.forEach((group, groupIdx) => {
            const dataPoint = chartDataInput.find(d => d[dimensionField] === dim && d[groupField] === group);
            if (dataPoint) {
                const value = +dataPoint[valueField];
                if (typeof value === 'number' && !isNaN(value) && value > 0) {
                    const barWidth = xScale(value);

                    mainChartGroup.append("rect") // Append to mainChartGroup for correct Y positioning
                        .attr("class", "mark value bar-segment")
                        .attr("x", currentBarX)
                        .attr("y", bandCenterY + barRectY) // Absolute Y
                        .attr("width", barWidth)
                        .attr("height", calculatedBarHeight)
                        .attr("fill", fillStyle.barCategoryColor(group, groupIdx, displayGroups));
                    
                    const labelText = formatValueWithUnit(value);
                    const labelTextWidth = estimateTextWidth(labelText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
                    
                    segmentLabelsData.push({
                        text: labelText,
                        x: currentBarX + barWidth, // Default end of bar
                        y: bandCenterY + dataLabelY, // Absolute Y
                        width: labelTextWidth,
                        color: fillStyle.barCategoryColor(group, groupIdx, displayGroups), // Or a contrasting color
                        barStartX: currentBarX,
                        barWidth: barWidth,
                        isOutOfBound: false, // Will be updated
                        textAnchor: "end" // Default
                    });
                    currentBarX += barWidth;
                }
            }
        });
        
        // Adjust data label positions for overlap and fit
        segmentLabelsData.forEach(label => {
            // Check if label is out of its bar segment (if anchored at end)
            if (label.x - label.width < label.barStartX) {
                label.isOutOfBound = true;
            }

            if (label.isOutOfBound) {
                if (label.barWidth > label.width + 2 * dataLabelGap) { // Enough space to center inside
                    label.x = label.barStartX + label.barWidth / 2;
                    label.textAnchor = "middle";
                } else { // Not enough space, anchor at start
                    label.x = label.barStartX + dataLabelGap;
                    label.textAnchor = "start";
                }
            }
        });

        // Update effective left/right edges after initial placement
        segmentLabelsData.forEach(label => {
            if (label.textAnchor === "end") {
                label.leftEdge = label.x - label.width;
                label.rightEdge = label.x;
            } else if (label.textAnchor === "middle") {
                label.leftEdge = label.x - label.width / 2;
                label.rightEdge = label.x + label.width / 2;
            } else { // start
                label.leftEdge = label.x;
                label.rightEdge = label.x + label.width;
            }
        });
        
        // Simple overlap avoidance: shift rightwards if overlap with previous
        // This is a basic version; more sophisticated algorithms exist.
        for (let i = 1; i < segmentLabelsData.length; i++) {
            const prevLabel = segmentLabelsData[i-1];
            const currentLabel = segmentLabelsData[i];
            const minSpacing = 5; // Minimum space between labels

            if (prevLabel.rightEdge + minSpacing > currentLabel.leftEdge) {
                // Overlap detected. Try to shift currentLabel to the right.
                // This might push it out of its own bar, or make it overlap next.
                // For simplicity, we just adjust its position.
                const newXStart = prevLabel.rightEdge + minSpacing;
                currentLabel.x = newXStart;
                currentLabel.textAnchor = "start";
                // Re-calculate edges
                currentLabel.leftEdge = currentLabel.x;
                currentLabel.rightEdge = currentLabel.x + currentLabel.width;
            }
        }

        segmentLabelsData.forEach(label => {
            // Final check: if label now extends beyond chart width, hide or adjust
            if (label.rightEdge > innerWidth) {
                if (label.textAnchor === "start" && label.barStartX + label.barWidth > innerWidth - dataLabelGap - label.width) {
                    // Try to fit it by anchoring end, if it's better
                    label.x = innerWidth - dataLabelGap;
                    label.textAnchor = "end";
                } else if (label.textAnchor === "middle" && label.x + label.width/2 > innerWidth) {
                     label.x = innerWidth - dataLabelGap - label.width/2; // shift left
                }
                 // If still too wide, it might be truncated by SVG clipping or could be hidden
            }


            mainChartGroup.append("text")
                .attr("class", "label value data-label")
                .attr("x", label.x)
                .attr("y", label.y) // Absolute Y
                .attr("text-anchor", label.textAnchor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", label.color) // Consider a contrasting text color logic if needed
                .text(label.text);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Removed alternating row backgrounds and other complex effects per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}