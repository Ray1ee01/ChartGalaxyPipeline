/* REQUIREMENTS_BEGIN
{
  "chart_type": "Split Bar Chart",
  "chart_name": "split_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group", "group2"],
  "hierarchy": ["group2"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"], ["categorical"]],
  "required_fields_range": [
    [2, 50],
    [0, "inf"],
    [2, 2],
    [1, 20]
  ],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group2"],
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
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const groupColumn = dataColumns.find(col => col.role === "group"); // For left/right split
    const group2Column = dataColumns.find(col => col.role === "group2"); // For color

    const categoryFieldName = xColumn ? xColumn.name : undefined;
    const valueFieldName = yColumn ? yColumn.name : undefined;
    const conditionFieldName = groupColumn ? groupColumn.name : undefined;
    const colorFieldName = group2Column ? group2Column.name : undefined;
    const valueUnit = (yColumn && yColumn.unit && yColumn.unit !== "none") ? yColumn.unit : "";

    const criticalFields = {
        categoryFieldName,
        valueFieldName,
        conditionFieldName,
        colorFieldName
    };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        chartBackground: colors.background_color || 'transparent',
        textColor: colors.text_color || '#333333',
        dataLabelColor: colors.text_color || '#FFFFFF', // Default for labels inside bars
        defaultBarColor: '#cccccc',
        typography: {
            sectionHeader: {
                fontFamily: (typography.title && typography.title.font_family) || 'Arial, sans-serif',
                fontSize: (typography.title && typography.title.font_size) || '16px',
                fontWeight: (typography.title && typography.title.font_weight) || 'bold',
            },
            legendItem: {
                fontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
                fontSize: (typography.label && typography.label.font_size) || '12px',
                fontWeight: (typography.label && typography.label.font_weight) || 'normal',
            },
            dataLabel: {
                fontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
                fontSize: (typography.annotation && typography.annotation.font_size) || '10px',
                fontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
            }
        }
    };

    function estimateTextWidth(text, fontFamily, fontSizeString, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSizeString);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox() on a programmatically created text element not in the DOM can be tricky.
        // For robustness, one might briefly append to a hidden SVG in the DOM.
        // However, adhering to "MUST NOT be appended to the document DOM":
        // This approach relies on the browser's ability to calculate BBox for non-rendered elements.
        // If it returns 0, an alternative like canvas measureText or temporary DOM append would be needed.
        // For this refactoring, we assume this works as per the strict constraint.
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth using getBBox on detached element failed, falling back to approximate length:", e);
            width = text.length * (parseFloat(fontSizeString) * 0.6); // Very rough fallback
        }
        return width;
    }

    function calculateScaledFontSize(baseFontSizeString, scaleFactor, minSize = 6) {
        const baseSize = parseFloat(baseFontSizeString);
        return Math.max(minSize, baseSize * scaleFactor);
    }

    function roundedRectPath(x, y, width, height, radius) {
        const r = Math.min(radius, height / 2, width / 2); // Ensure radius isn't too large
        if (width <= 0 || height <= 0) return "";
        return `M${x + r},${y} H${x + width - r} A${r},${r} 0 0 1 ${x + width},${y + r} V${y + height - r} A${r},${r} 0 0 1 ${x + width - r},${y + height} H${x + r} A${r},${r} 0 0 1 ${x},${y + height - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y}`;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 30, bottom: 60, left: 30 }; // Adjusted for potential legend/headers
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const leftChartWidthRatio = 0.35;
    const rightChartWidthRatio = 0.35;
    const leftChartWidth = innerWidth * leftChartWidthRatio;
    const rightChartWidth = innerWidth * rightChartWidthRatio;
    const rightChartStartX = innerWidth - rightChartWidth;

    // Block 5: Data Preprocessing & Transformation
    const conditions = [...new Set(chartData.map(d => d[conditionFieldName]))];
    if (conditions.length !== 2) {
        const errorMsg = `Condition field '${conditionFieldName}' must have exactly 2 unique values. Found ${conditions.length}.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    const conditionLeft = conditions[0];
    const conditionRight = conditions[1];

    const uniqueColorGroups = [...new Set(chartData.map(d => d[colorFieldName]))];

    const processedData = {};
    chartData.forEach(d => {
        const cat = d[categoryFieldName];
        if (!processedData[cat]) {
            processedData[cat] = { leftValue: null, rightValue: null, colorGroup: null };
        }
        if (d[conditionFieldName] === conditionLeft) {
            processedData[cat].leftValue = +d[valueFieldName] || 0;
        } else if (d[conditionFieldName] === conditionRight) {
            processedData[cat].rightValue = +d[valueFieldName] || 0;
        }
        processedData[cat].colorGroup = d[colorFieldName];
    });

    const baseDataArray = Object.entries(processedData)
        .map(([category, values]) => ({ category, ...values }));

    const sortedDataLeft = baseDataArray
        .filter(d => d.leftValue !== null)
        .sort((a, b) => b.leftValue - a.leftValue);

    const sortedDataRight = baseDataArray
        .filter(d => d.rightValue !== null)
        .sort((a, b) => b.rightValue - a.rightValue);

    const sortedCategoriesLeft = sortedDataLeft.map(d => d.category);
    const sortedCategoriesRight = sortedDataRight.map(d => d.category);

    // Block 6: Scale Definition & Configuration
    const maxCategoryCount = Math.max(sortedDataLeft.length, sortedDataRight.length);

    const yScale = d3.scaleBand()
        .domain(d3.range(maxCategoryCount))
        .range([0, innerHeight])
        .padding(0.2); // Standardized padding

    const colorScale = d3.scaleOrdinal()
        .domain(uniqueColorGroups)
        .range(uniqueColorGroups.map((cg, i) =>
            (colors.field && colors.field[cg]) ||
            (colors.available_colors && colors.available_colors[i % colors.available_colors.length]) ||
            d3.schemeCategory10[i % d3.schemeCategory10.length]
        ));

    const barHeight = yScale.bandwidth();
    const barRadius = barHeight > 0 ? barHeight / 2 : 0; // Avoid NaN if barHeight is 0
    const fixedBarPixelWidth = barHeight > 0 ? leftChartWidth * 0.98 : 0; // Avoid issues if no bars

    const leftBarLeftEdge = 0;
    const leftBarRightEdge = leftBarLeftEdge + fixedBarPixelWidth;
    const rightBarRightEdge = innerWidth;
    const rightBarLeftEdge = rightBarRightEdge - fixedBarPixelWidth;

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    let sectionHeaderY = -chartMargins.top / 2; // Default position if no bars
    let legendY = sectionHeaderY - parseFloat(fillStyle.typography.sectionHeader.fontSize) - 15; // Default

    if (maxCategoryCount > 0 && barHeight > 0) {
        const baseSectionHeaderFontSizeStr = fillStyle.typography.sectionHeader.fontSize;
        const sectionHeaderFontFamily = fillStyle.typography.sectionHeader.fontFamily;
        const sectionHeaderFontWeight = fillStyle.typography.sectionHeader.fontWeight;

        let leftHeaderWidth = estimateTextWidth(String(conditionLeft), sectionHeaderFontFamily, baseSectionHeaderFontSizeStr, sectionHeaderFontWeight);
        let rightHeaderWidth = estimateTextWidth(String(conditionRight), sectionHeaderFontFamily, baseSectionHeaderFontSizeStr, sectionHeaderFontWeight);
        
        let headerScaleFactor = 1;
        if (leftHeaderWidth > leftChartWidth) {
            headerScaleFactor = Math.min(headerScaleFactor, (leftChartWidth / leftHeaderWidth) * 0.98);
        }
        if (rightHeaderWidth > rightChartWidth) {
            headerScaleFactor = Math.min(headerScaleFactor, (rightChartWidth / rightHeaderWidth) * 0.98);
        }
        const finalSectionHeaderFontSize = calculateScaledFontSize(baseSectionHeaderFontSizeStr, headerScaleFactor);
        const sectionHeaderPaddingBottom = 10;
        sectionHeaderY = yScale(0) - sectionHeaderPaddingBottom - finalSectionHeaderFontSize / 2; // Adjusted for better centering if possible

        // --- Legend ---
        const relevantColorGroups = [...new Set(baseDataArray.map(d => d.colorGroup).filter(Boolean))];
        if (relevantColorGroups.length > 0) {
            const baseLegendFontSizeStr = fillStyle.typography.legendItem.fontSize;
            const legendFontFamily = fillStyle.typography.legendItem.fontFamily;
            const legendFontWeight = fillStyle.typography.legendItem.fontWeight;
            let legendSquareSize = parseFloat(baseLegendFontSizeStr);
            const legendItemPadding = 8;
            const legendColumnPadding = 20;

            let totalLegendWidth = 0;
            relevantColorGroups.forEach((cg) => {
                const textWidth = estimateTextWidth(String(cg), legendFontFamily, baseLegendFontSizeStr, legendFontWeight);
                totalLegendWidth += legendSquareSize + legendItemPadding + textWidth + legendColumnPadding;
            });
            totalLegendWidth -= legendColumnPadding;

            let legendScaleFactor = 1;
            if (totalLegendWidth > innerWidth) {
                legendScaleFactor = (innerWidth / totalLegendWidth) * 0.98;
            }
            const finalLegendFontSize = calculateScaledFontSize(baseLegendFontSizeStr, legendScaleFactor);
            legendSquareSize *= legendScaleFactor;

            let finalLegendWidth = 0;
            relevantColorGroups.forEach((cg) => {
                const textWidth = estimateTextWidth(String(cg), legendFontFamily, `${finalLegendFontSize}px`, legendFontWeight);
                finalLegendWidth += legendSquareSize + legendItemPadding + textWidth + legendColumnPadding;
            });
            finalLegendWidth -= legendColumnPadding;

            const legendStartX = (innerWidth - finalLegendWidth) / 2;
            const legendPaddingBottom = 5;
            legendY = sectionHeaderY - finalSectionHeaderFontSize - legendPaddingBottom - legendSquareSize / 2;

            const legendGroup = mainChartGroup.append("g")
                .attr("class", "legend")
                .attr("transform", `translate(${legendStartX}, ${legendY})`);

            let currentLegendX = 0;
            relevantColorGroups.forEach((cg) => {
                const color = colorScale(cg);
                const textWidth = estimateTextWidth(String(cg), legendFontFamily, `${finalLegendFontSize}px`, legendFontWeight);
                
                const legendItem = legendGroup.append("g")
                    .attr("class", "legend-item")
                    .attr("transform", `translate(${currentLegendX}, 0)`);

                legendItem.append("rect")
                    .attr("x", 0)
                    .attr("y", -legendSquareSize / 2)
                    .attr("width", legendSquareSize)
                    .attr("height", legendSquareSize)
                    .attr("fill", color)
                    .attr("class", "mark legend-mark");

                legendItem.append("text")
                    .attr("x", legendSquareSize + legendItemPadding)
                    .attr("y", 0)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "start")
                    .style("font-family", legendFontFamily)
                    .style("font-size", `${finalLegendFontSize}px`)
                    .style("font-weight", legendFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(String(cg))
                    .attr("class", "label legend-label");
                
                currentLegendX += legendSquareSize + legendItemPadding + textWidth + legendColumnPadding;
            });
        }

        // --- Section Headers (formerly "Titles") ---
        mainChartGroup.append("text")
            .attr("class", "label section-header header-left")
            .attr("x", 0)
            .attr("y", sectionHeaderY)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", sectionHeaderFontFamily)
            .style("font-size", `${finalSectionHeaderFontSize}px`)
            .style("font-weight", sectionHeaderFontWeight)
            .style("fill", fillStyle.textColor)
            .text(String(conditionLeft));

        mainChartGroup.append("text")
            .attr("class", "label section-header header-right")
            .attr("x", innerWidth)
            .attr("y", sectionHeaderY)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", sectionHeaderFontFamily)
            .style("font-size", `${finalSectionHeaderFontSize}px`)
            .style("font-weight", sectionHeaderFontWeight)
            .style("fill", fillStyle.textColor)
            .text(String(conditionRight));
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const dataLabelPadding = 8;
    const baseDataLabelFontSizeStr = fillStyle.typography.dataLabel.fontSize;
    const dataLabelFontFamily = fillStyle.typography.dataLabel.fontFamily;
    const dataLabelFontWeight = fillStyle.typography.dataLabel.fontWeight;
    
    let finalDataLabelFontSize = parseFloat(baseDataLabelFontSizeStr); // Default if no scaling needed

    if (maxCategoryCount > 0 && barHeight > 0 && fixedBarPixelWidth > 0) {
        const targetDataLabelFontSize = barHeight > 0 ? Math.min(20, Math.max(barHeight * 0.6, parseFloat(baseDataLabelFontSizeStr))) : parseFloat(baseDataLabelFontSizeStr);
        
        let maxRequiredWidthLeft = 0;
        sortedDataLeft.forEach(d => {
            const valueText = (d.leftValue !== null ? d.leftValue.toFixed(0) : "N/A") + valueUnit;
            const valueWidth = estimateTextWidth(valueText, dataLabelFontFamily, `${targetDataLabelFontSize}px`, dataLabelFontWeight);
            const nameWidth = estimateTextWidth(d.category, dataLabelFontFamily, `${targetDataLabelFontSize}px`, dataLabelFontWeight);
            maxRequiredWidthLeft = Math.max(maxRequiredWidthLeft, dataLabelPadding + valueWidth + dataLabelPadding + nameWidth + dataLabelPadding);
        });

        let maxRequiredWidthRight = 0;
        sortedDataRight.forEach(d => {
            const valueText = (d.rightValue !== null ? d.rightValue.toFixed(0) : "N/A") + valueUnit;
            const valueWidth = estimateTextWidth(valueText, dataLabelFontFamily, `${targetDataLabelFontSize}px`, dataLabelFontWeight);
            const nameWidth = estimateTextWidth(d.category, dataLabelFontFamily, `${targetDataLabelFontSize}px`, dataLabelFontWeight);
            maxRequiredWidthRight = Math.max(maxRequiredWidthRight, dataLabelPadding + nameWidth + dataLabelPadding + valueWidth + dataLabelPadding);
        });

        let labelScaleFactor = 1;
        if (maxRequiredWidthLeft > fixedBarPixelWidth && fixedBarPixelWidth > 0) {
            labelScaleFactor = Math.min(labelScaleFactor, (fixedBarPixelWidth / maxRequiredWidthLeft) * 0.98);
        }
        if (maxRequiredWidthRight > fixedBarPixelWidth && fixedBarPixelWidth > 0) {
            labelScaleFactor = Math.min(labelScaleFactor, (fixedBarPixelWidth / maxRequiredWidthRight) * 0.98);
        }
        finalDataLabelFontSize = calculateScaledFontSize(`${targetDataLabelFontSize}px`, labelScaleFactor);
    }
    
    const finalDataLabelFontSizeStr = `${finalDataLabelFontSize}px`;
    let maxLeftValueWidth = 0;
    sortedDataLeft.forEach(d => {
        const text = (d.leftValue !== null ? d.leftValue.toFixed(0) : "N/A") + valueUnit;
        maxLeftValueWidth = Math.max(maxLeftValueWidth, estimateTextWidth(text, dataLabelFontFamily, finalDataLabelFontSizeStr, dataLabelFontWeight));
    });
    let maxRightValueWidth = 0;
    sortedDataRight.forEach(d => {
        const text = (d.rightValue !== null ? d.rightValue.toFixed(0) : "N/A") + valueUnit;
        maxRightValueWidth = Math.max(maxRightValueWidth, estimateTextWidth(text, dataLabelFontFamily, finalDataLabelFontSizeStr, dataLabelFontWeight));
    });


    if (maxCategoryCount > 0 && barHeight > 0) {
        // --- Connectors ---
        mainChartGroup.append("g")
            .attr("class", "connectors")
            .selectAll("path.connector")
            .data(baseDataArray.filter(d => d.leftValue !== null && d.rightValue !== null))
            .enter()
            .append("path")
            .attr("class", "mark connector")
            .attr("d", d => {
                const category = d.category;
                const indexLeft = sortedCategoriesLeft.indexOf(category);
                const indexRight = sortedCategoriesRight.indexOf(category);
                if (indexLeft === -1 || indexRight === -1) return null;

                const yPosLeft = yScale(indexLeft);
                const yPosRight = yScale(indexRight);
                if (yPosLeft === undefined || yPosRight === undefined) return null;

                const leftConnectX = leftBarLeftEdge + fixedBarPixelWidth - (barRadius > 0 ? barRadius : 0);
                const rightConnectX = rightBarLeftEdge + (barRadius > 0 ? barRadius : 0);
                return `M${leftConnectX},${yPosLeft} L${rightConnectX},${yPosRight} L${rightConnectX},${yPosRight + barHeight} L${leftConnectX},${yPosLeft + barHeight} Z`;
            })
            .attr("fill", d => colorScale(d.colorGroup) || fillStyle.defaultBarColor)
            .style("opacity", 0.3); // Connectors are often subtle

        // --- Left Bars & Labels ---
        const leftBarsGroup = mainChartGroup.append("g").attr("class", "left-bars");
        sortedDataLeft.forEach((d, i) => {
            const yPos = yScale(i);
            if (yPos === undefined) return;
            const color = colorScale(d.colorGroup) || fillStyle.defaultBarColor;

            leftBarsGroup.append("path")
                .attr("class", "mark bar bar-left")
                .attr("d", roundedRectPath(leftBarLeftEdge, yPos, fixedBarPixelWidth, barHeight, barRadius))
                .attr("fill", color);

            if (finalDataLabelFontSize >= 6 && fixedBarPixelWidth > dataLabelPadding * 2) {
                const valueText = (d.leftValue !== null ? d.leftValue.toFixed(0) : "N/A") + valueUnit;
                const nameText = d.category;

                leftBarsGroup.append("text")
                    .attr("class", "label data-label data-label-value")
                    .attr("x", leftBarLeftEdge + dataLabelPadding)
                    .attr("y", yPos + barHeight / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "start")
                    .style("font-family", dataLabelFontFamily)
                    .style("font-size", finalDataLabelFontSizeStr)
                    .style("font-weight", dataLabelFontWeight)
                    .style("fill", fillStyle.dataLabelColor)
                    .text(valueText);

                if (leftBarLeftEdge + dataLabelPadding + maxLeftValueWidth + dataLabelPadding < leftBarRightEdge - dataLabelPadding) {
                    leftBarsGroup.append("text")
                        .attr("class", "label data-label data-label-name")
                        .attr("x", leftBarLeftEdge + dataLabelPadding + maxLeftValueWidth + dataLabelPadding)
                        .attr("y", yPos + barHeight / 2)
                        .attr("dominant-baseline", "middle")
                        .attr("text-anchor", "start")
                        .style("font-family", dataLabelFontFamily)
                        .style("font-size", finalDataLabelFontSizeStr)
                        .style("font-weight", dataLabelFontWeight)
                        .style("fill", fillStyle.dataLabelColor)
                        .text(nameText);
                }
            }
        });

        // --- Right Bars & Labels ---
        const rightBarsGroup = mainChartGroup.append("g").attr("class", "right-bars");
        sortedDataRight.forEach((d, i) => {
            const yPos = yScale(i);
            if (yPos === undefined) return;
            const color = colorScale(d.colorGroup) || fillStyle.defaultBarColor;

            rightBarsGroup.append("path")
                .attr("class", "mark bar bar-right")
                .attr("d", roundedRectPath(rightBarLeftEdge, yPos, fixedBarPixelWidth, barHeight, barRadius))
                .attr("fill", color);

            if (finalDataLabelFontSize >= 6 && fixedBarPixelWidth > dataLabelPadding * 2) {
                const valueText = (d.rightValue !== null ? d.rightValue.toFixed(0) : "N/A") + valueUnit;
                const nameText = d.category;

                rightBarsGroup.append("text")
                    .attr("class", "label data-label data-label-value")
                    .attr("x", rightBarRightEdge - dataLabelPadding)
                    .attr("y", yPos + barHeight / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "end")
                    .style("font-family", dataLabelFontFamily)
                    .style("font-size", finalDataLabelFontSizeStr)
                    .style("font-weight", dataLabelFontWeight)
                    .style("fill", fillStyle.dataLabelColor)
                    .text(valueText);
                
                if (rightBarRightEdge - dataLabelPadding - maxRightValueWidth - dataLabelPadding > rightBarLeftEdge + dataLabelPadding) {
                    rightBarsGroup.append("text")
                        .attr("class", "label data-label data-label-name")
                        .attr("x", rightBarRightEdge - dataLabelPadding - maxRightValueWidth - dataLabelPadding)
                        .attr("y", yPos + barHeight / 2)
                        .attr("dominant-baseline", "middle")
                        .attr("text-anchor", "end")
                        .style("font-family", dataLabelFontFamily)
                        .style("font-size", finalDataLabelFontSizeStr)
                        .style("font-weight", dataLabelFontWeight)
                        .style("fill", fillStyle.dataLabelColor)
                        .text(nameText);
                }
            }
        });
    } else if (chartData.length > 0) { // Has data but cannot render bars (e.g. height too small)
         mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "label error-label")
            .style("fill", fillStyle.textColor)
            .text("Not enough space to render chart elements.");
    } else { // No data
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "label nodata-label")
            .style("fill", fillStyle.textColor)
            .text("No data available to display.");
    }


    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactoring)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}