/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_chart_01",
  "is_composite": false,
  "required_fields": ["y", "x", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 4]],
  "required_fields_icons": ["y"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data;
    const chartData = chartConfig.data?.data;
    const variables = chartConfig.variables || {};
    const typographyConfig = chartConfig.typography || {};
    const colorsConfig = chartConfig.colors || {};
    const imagesConfig = chartConfig.images || {};
    const dataColumns = chartConfig.data?.columns || [];

    const yCategoryFieldConfig = dataColumns.find(col => col.role === "y");
    const xValueFieldConfig = dataColumns.find(col => col.role === "x");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const yCategoryFieldName = yCategoryFieldConfig?.name;
    const xValueFieldName = xValueFieldConfig?.name;
    const groupFieldName = groupFieldConfig?.name;

    const missingFields = [];
    if (!yCategoryFieldName) missingFields.push("Y-category field (role: 'y') name");
    if (!xValueFieldName) missingFields.push("X-value field (role: 'x') name");
    if (!groupFieldName) missingFields.push("Group field (role: 'group') name");
    if (!chartData || chartData.length === 0) missingFields.push("Chart data (data.data is missing or empty)");
    
    // Check if fields actually exist in data objects
    if (chartData && chartData.length > 0) {
        const samplePoint = chartData[0];
        if (yCategoryFieldName && typeof samplePoint[yCategoryFieldName] === 'undefined') missingFields.push(`Y-category field '${yCategoryFieldName}' not found in data`);
        if (xValueFieldName && typeof samplePoint[xValueFieldName] === 'undefined') missingFields.push(`X-value field '${xValueFieldName}' not found in data`);
        if (groupFieldName && typeof samplePoint[groupFieldName] === 'undefined') missingFields.push(`Group field '${groupFieldName}' not found in data`);
    }


    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing or invalid: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html("");

    const yCategoryUnit = (yCategoryFieldConfig?.unit && yCategoryFieldConfig.unit !== "none") ? yCategoryFieldConfig.unit : "";
    const xValueUnit = (xValueFieldConfig?.unit && xValueFieldConfig.unit !== "none") ? xValueFieldConfig.unit : "";
    const groupUnit = (groupFieldConfig?.unit && groupFieldConfig.unit !== "none") ? groupFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || "Arial, sans-serif",
            titleFontSize: typographyConfig.title?.font_size || "16px",
            titleFontWeight: typographyConfig.title?.font_weight || "bold",
            labelFontFamily: typographyConfig.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyConfig.label?.font_size || "12px",
            labelFontWeight: typographyConfig.label?.font_weight || "normal",
            annotationFontFamily: typographyConfig.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyConfig.annotation?.font_size || "10px",
            annotationFontWeight: typographyConfig.annotation?.font_weight || "normal",
        },
        textColor: colorsConfig.text_color || "#333333",
        chartBackground: colorsConfig.background_color || "#FFFFFF",
        primaryAccent: colorsConfig.other?.primary || "#1f77b4",
        defaultCategoryColors: colorsConfig.available_colors || d3.schemeCategory10,
    };
    
    const uniqueGroupsForColorScale = [...new Set(chartData.map(d => d[groupFieldName]))];
    fillStyle.getSegmentColor = (groupValue) => {
        if (colorsConfig.field && colorsConfig.field[groupValue]) {
            return colorsConfig.field[groupValue];
        }
        const groupIndex = uniqueGroupsForColorScale.indexOf(groupValue);
        return fillStyle.defaultCategoryColors[groupIndex % fillStyle.defaultCategoryColors.length] || fillStyle.primaryAccent;
    };
    
    fillStyle.getYCategoryIconUrl = (categoryValue) => {
        return imagesConfig.field && imagesConfig.field[categoryValue] ? imagesConfig.field[categoryValue] : null;
    };

    function estimateTextWidth(text, styleProps) {
        const { fontFamily, fontSize, fontWeight } = styleProps;
        const tempTextNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tempTextNode.setAttribute("font-family", fontFamily);
        tempTextNode.setAttribute("font-size", fontSize);
        tempTextNode.setAttribute("font-weight", fontWeight);
        tempTextNode.textContent = text;
        
        // Create a temporary SVG, append the text, measure, then discard.
        // This SVG is not added to the main document DOM.
        const tempSvgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        tempSvgNode.appendChild(tempTextNode);
        // Temporarily append to body to ensure layout calculation, then remove.
        // This is often needed for getBBox to work reliably.
        // However, prompt says: "This temporary SVG MUST NOT be appended to the document DOM."
        // So we rely on getBBox working on a detached element.
        return tempTextNode.getBBox().width;
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (Math.abs(value) >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (Math.abs(value) >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    const formatValueWithUnit = (value, unit) => {
        const formattedValue = formatValue(value);
        if (unit && unit.length > 3) { 
            return formattedValue;
        }
        return unit ? `${formattedValue}${unit}` : formattedValue;
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

    // Block 4: Core Chart Dimensions & Layout Calculation
    const iconSize = 32;
    const iconPadding = 10;
    const legendSquareSize = 12;
    const legendSpacing = 5;
    const legendItemGap = 10; // Gap between legend items

    let chartMargins = { top: 80, right: 160, bottom: 60, left: 80 };

    let maxLabelWidthForMargin = 0;
    const tempYCategoriesForMargin = [...new Set(chartData.map(d => d[yCategoryFieldName]))];
    tempYCategoriesForMargin.forEach(cat => {
        const formattedDimension = yCategoryUnit ? `${cat}${yCategoryUnit}` : `${cat}`;
        const textWidth = estimateTextWidth(formattedDimension, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        const hasIcon = !!fillStyle.getYCategoryIconUrl(cat);
        const currentLabelWidth = (hasIcon ? iconSize + iconPadding : 0) + textWidth;
        maxLabelWidthForMargin = Math.max(maxLabelWidthForMargin, currentLabelWidth);
    });
    chartMargins.left = Math.max(chartMargins.left, maxLabelWidthForMargin + 20);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const allYCategories = [...new Set(chartData.map(d => d[yCategoryFieldName]))];
    const allGroups = [...new Set(chartData.map(d => d[groupFieldName]))];
    
    const displayGroups = allGroups.filter(g => g !== "Total Paid Leave"); 

    const yCategoryTotals = {};
    allYCategories.forEach(cat => {
        let total = 0;
        displayGroups.forEach(group => {
            const dataPoint = chartData.find(d => d[yCategoryFieldName] === cat && d[groupFieldName] === group);
            if (dataPoint) {
                 const val = parseFloat(dataPoint[xValueFieldName]);
                 if (!isNaN(val)) total += val;
            }
        });
        yCategoryTotals[cat] = total;
    });

    const sortedYCategories = [...allYCategories].sort((a, b) => {
        const diff = yCategoryTotals[b] - yCategoryTotals[a];
        if (diff !== 0) return diff;
        return a.localeCompare(b);
    });

    // Block 6: Scale Definition & Configuration
    const maxBarHeight = 24;
    const minBarHeight = 16;
    const calculatedBarHeight = Math.min(
        maxBarHeight,
        Math.max(minBarHeight, innerHeight / (sortedYCategories.length || 1) / 2.5)
    );
    const barLabelGap = 8; // Increased gap between bar and its labels below

    const yScale = d3.scaleBand()
        .domain(sortedYCategories)
        .range([0, innerHeight])
        .padding(0.5);

    const maxTotalXValue = d3.max(Object.values(yCategoryTotals));
    const xScale = d3.scaleLinear()
        .domain([0, maxTotalXValue > 0 ? maxTotalXValue * 1.05 : 1])
        .range([0, innerWidth]);

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 7: Chart Component Rendering
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top - 30})`);

    let currentLegendX = 0;
    displayGroups.forEach((group) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, 0)`);

        legendItem.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendSquareSize)
            .attr("height", legendSquareSize)
            .attr("fill", fillStyle.getSegmentColor(group));

        const legendTextContent = groupUnit ? `${group}${groupUnit}` : group;
        legendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendSquareSize + legendSpacing)
            .attr("y", legendSquareSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(legendTextContent);
        
        const legendItemWidth = legendSquareSize + legendSpacing + estimateTextWidth(legendTextContent, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        currentLegendX += legendItemWidth + legendItemGap;
    });

    const xAxis = d3.axisBottom(xScale)
        .ticks(Math.max(2, Math.min(5, Math.floor(innerWidth / 80)))) // Responsive ticks
        .tickSize(0)
        .tickFormat(d => formatValueWithUnit(d, xValueUnit));

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll(".tick text")
        .attr("class", "label axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // Block 8: Main Data Visualization Rendering
    sortedYCategories.forEach((yCategory) => {
        const yCategoryRowGroup = mainChartGroup.append("g")
            .attr("class", "y-category-row");

        const rowCenterY = yScale(yCategory) + yScale.bandwidth() / 2;
        const barYPosition = rowCenterY - calculatedBarHeight / 2;
        const labelAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
        const labelRowYPosition = rowCenterY + calculatedBarHeight / 2 + barLabelGap;


        const yCategoryLabelText = yCategoryUnit ? `${yCategory}${yCategoryUnit}` : yCategory;
        const textWidthForLayout = estimateTextWidth(yCategoryLabelText, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });

        const iconUrl = fillStyle.getYCategoryIconUrl(yCategory);
        let textXPosition;
        const availableLeftSpace = chartMargins.left - 20; // Space from margin line to actual edge
        
        if (iconUrl) {
            const combinedWidth = iconSize + iconPadding + textWidthForLayout;
            const startX = -Math.min(combinedWidth, availableLeftSpace); // Ensure it fits
            
            yCategoryRowGroup.append("image")
                .attr("class", "icon y-axis-icon")
                .attr("x", startX)
                .attr("y", rowCenterY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
            textXPosition = startX + iconSize + iconPadding;
        } else {
            textXPosition = -Math.min(textWidthForLayout + iconPadding, availableLeftSpace);
        }
        
        yCategoryRowGroup.append("text")
            .attr("class", "label y-axis-label")
            .attr("x", textXPosition)
            .attr("y", rowCenterY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(yCategoryLabelText);

        let currentXPosition = 0;
        const segmentLabelsData = [];

        displayGroups.forEach(group => {
            const dataPoint = chartData.find(d => d[yCategoryFieldName] === yCategory && d[groupFieldName] === group);
            if (dataPoint) {
                const value = +dataPoint[xValueFieldName];
                if (typeof value === 'number' && !isNaN(value) && value > 0) {
                    const barSegmentWidth = xScale(value);

                    yCategoryRowGroup.append("rect")
                        .attr("class", "mark bar-segment")
                        .attr("x", currentXPosition)
                        .attr("y", barYPosition)
                        .attr("width", barSegmentWidth)
                        .attr("height", calculatedBarHeight)
                        .attr("fill", fillStyle.getSegmentColor(group));

                    const labelText = formatValueWithUnit(value, xValueUnit);
                    const labelWidth = estimateTextWidth(labelText, {
                        fontFamily: fillStyle.typography.annotationFontFamily,
                        fontSize: fillStyle.typography.annotationFontSize,
                        fontWeight: fillStyle.typography.annotationFontWeight
                    });
                    
                    segmentLabelsData.push({
                        text: labelText,
                        x: currentXPosition + barSegmentWidth, 
                        y: labelRowYPosition,
                        width: labelWidth,
                        color: fillStyle.getSegmentColor(group),
                        barStartX: currentXPosition,
                        barEndX: currentXPosition + barSegmentWidth,
                        barWidth: barSegmentWidth,
                    });
                    currentXPosition += barSegmentWidth;
                }
            }
        });
        
        if (segmentLabelsData.length > 0) {
            segmentLabelsData.forEach(label => {
                label.textAnchor = "end";
                label.currentX = label.x;
                label.leftEdge = label.currentX - label.width;
                label.rightEdge = label.currentX;

                if (label.leftEdge < label.barStartX) {
                    if (label.barWidth > label.width + 8) {
                        label.textAnchor = "middle";
                        label.currentX = label.barStartX + label.barWidth / 2;
                    } else { 
                        label.textAnchor = "start";
                        label.currentX = label.barStartX + 4;
                    }
                }
                if (label.textAnchor === "middle") {
                    label.leftEdge = label.currentX - label.width / 2;
                    label.rightEdge = label.currentX + label.width / 2;
                } else if (label.textAnchor === "start") {
                    label.leftEdge = label.currentX;
                    label.rightEdge = label.currentX + label.width;
                }
            });

            segmentLabelsData.sort((a, b) => a.barStartX - b.barStartX);

            const minSpaceBetweenLabels = 5;
            for (let i = 0; i < segmentLabelsData.length - 1; i++) {
                const currentLbl = segmentLabelsData[i];
                const nextLbl = segmentLabelsData[i+1];
                if (currentLbl.rightEdge + minSpaceBetweenLabels > nextLbl.leftEdge) {
                    const potentialNewXStart = currentLbl.rightEdge + minSpaceBetweenLabels;
                    if (nextLbl.textAnchor === 'start' && potentialNewXStart + nextLbl.width < nextLbl.barEndX - 4) { // -4 to keep it inside bar
                         nextLbl.currentX = potentialNewXStart;
                         nextLbl.leftEdge = nextLbl.currentX;
                         nextLbl.rightEdge = nextLbl.currentX + nextLbl.width;
                    } else if (nextLbl.textAnchor === 'middle' && potentialNewXStart + nextLbl.width/2 < nextLbl.barEndX -4 && potentialNewXStart - nextLbl.width/2 > nextLbl.barStartX + 4) {
                         // Shift middle, more complex, ensure it stays centered if possible
                         // For now, if simple shift for 'start' anchor doesn't work, we accept some overlap or suboptimal placement
                    }
                }
            }
            
            const labelBgHeight = labelAnnotationFontSize + 4;
            const labelBgY = labelRowYPosition - labelBgHeight / 2; // Center background around text y

            segmentLabelsData.forEach(label => {
                yCategoryRowGroup.append("rect")
                    .attr("class", "other label-background")
                    .attr("x", label.barStartX)
                    .attr("y", labelBgY)
                    .attr("width", label.barWidth)
                    .attr("height", labelBgHeight)
                    .attr("fill", fillStyle.chartBackground);
            });

            segmentLabelsData.forEach(label => {
                if (label.currentX + (label.textAnchor === 'start' ? label.width : (label.textAnchor === 'middle' ? label.width/2 : 0)) > innerWidth) {
                    label.currentX = innerWidth - (label.textAnchor === 'start' ? label.width : (label.textAnchor === 'middle' ? label.width/2 : 0)) - 2; // Adjust if overflowing chart
                }
                if (label.currentX - (label.textAnchor === 'end' ? label.width : (label.textAnchor === 'middle' ? label.width/2 : 0)) < 0) {
                     label.currentX = (label.textAnchor === 'end' ? label.width : (label.textAnchor === 'middle' ? label.width/2 : 0)) + 2; // Adjust if overflowing chart
                }


                if (label.barWidth >= label.width / 3 && label.barWidth > 5) { // Only draw if bar is somewhat visible and can hold some text
                    yCategoryRowGroup.append("text")
                        .attr("class", "label data-label")
                        .attr("x", label.currentX)
                        .attr("y", label.y) 
                        .attr("text-anchor", label.textAnchor)
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", fillStyle.typography.annotationFontSize)
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .style("fill", label.color)
                        .attr("dy", "0.35em")
                        .text(label.text);
                }
            });
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // None

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}