/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Semi Donut Chart",
  "chart_name": "multiple_semi_donut_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 10], [0, "inf"], [2, 10]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const chartData = data.data.data;
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const dimensionFieldName = dimensionFieldConfig?.name;
    const valueFieldName = valueFieldConfig?.name;
    const groupFieldName = groupFieldConfig?.name;

    const missingFields = [];
    if (!dimensionFieldName) missingFields.push("x role field");
    if (!valueFieldName) missingFields.push("y role field");
    if (!groupFieldName) missingFields.push("group role field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        }
        return null;
    }

    const valueFieldUnit = valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyConfig.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyConfig.label?.font_size || "12px",
            labelFontWeight: typographyConfig.label?.font_weight || "normal",
            annotationFontFamily: typographyConfig.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyConfig.annotation?.font_size || "10px",
            annotationFontWeight: typographyConfig.annotation?.font_weight || "normal",
        },
        chartBackground: colorsConfig.background_color || "#FFFFFF",
        textColor: colorsConfig.text_color || "#0F223B",
        defaultPrimaryColor: colorsConfig.other?.primary || "#1f77b4",
        defaultAvailableColors: colorsConfig.available_colors || d3.schemeCategory10,
    };

    fillStyle.getSegmentColor = (groupValue, groupIndex) => {
        if (colorsConfig.field && colorsConfig.field[groupValue]) {
            return colorsConfig.field[groupValue];
        }
        if (fillStyle.defaultAvailableColors.length > 0) {
            return fillStyle.defaultAvailableColors[groupIndex % fillStyle.defaultAvailableColors.length];
        }
        return fillStyle.defaultPrimaryColor;
    };

    fillStyle.getIconUrl = (dimensionValue) => {
        if (imagesConfig.field && imagesConfig.field[dimensionValue]) {
            return imagesConfig.field[dimensionValue];
        }
        if (imagesConfig.other && imagesConfig.other.primary) {
            return imagesConfig.other.primary;
        }
        return null;
    };

    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextNode.setAttribute('font-family', fontProps.fontFamily);
        tempTextNode.setAttribute('font-size', fontProps.fontSize);
        tempTextNode.setAttribute('font-weight', fontProps.fontWeight);
        tempTextNode.textContent = text;
        tempSvgNode.appendChild(tempTextNode);
        // Note: Appending to body and then getting BBox is more reliable across browsers
        // but the requirement is not to append to DOM. getComputedTextLength might be an alternative
        // but getBBox on an in-memory SVG text node is often sufficient.
        // For robustness if issues arise:
        // document.body.appendChild(tempSvgNode);
        // const width = tempTextNode.getBBox().width;
        // document.body.removeChild(tempSvgNode);
        // return width;
        // Simplified approach for now:
        try {
            return tempTextNode.getBBox().width;
        } catch (e) { // if getBBox fails on non-rendered element
            let estimatedWidth = 0;
            const avgCharWidth = parseFloat(fontProps.fontSize) * 0.6; // Rough estimate
            estimatedWidth = text.length * avgCharWidth;
            return estimatedWidth;
        }
    };
    
    const formatValue = (value) => {
        if (value >= 1000000000) return `${d3.format("~.2s")(value / 1000000000)}B`;
        if (value >= 1000000) return `${d3.format("~.2s")(value / 1000000)}M`;
        if (value >= 1000) return `${d3.format("~.2s")(value / 1000)}K`;
        return d3.format("~g")(value);
    };

    const getContrastingTextColor = (hexColor) => {
        if (!hexColor) return fillStyle.textColor; // Default if no color
        const hex = hexColor.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#FFFFFF';
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 850;
    const containerHeight = chartConfig.height || 550;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = { top: 20, right: 40, bottom: 20, left: 40 }; // Initial margins

    // Legend layout calculation (before main chart area, as it affects margins)
    const allGroupNames = Array.from(new Set(chartData.map(d => d[groupFieldName])));
    const legendRectSize = 15;
    const legendRectTextPadding = 5;
    const legendItemPadding = 15;
    const legendRowSpacing = 10;
    const legendTopMargin = 10;
    const legendBottomMargin = 10;

    const legendTextFontProps = {
        fontFamily: fillStyle.typography.annotationFontFamily,
        fontSize: fillStyle.typography.annotationFontSize,
        fontWeight: fillStyle.typography.annotationFontWeight,
    };

    const legendTextWidths = {};
    let legendTextHeight = 0;
    allGroupNames.forEach(groupName => {
        legendTextWidths[groupName] = estimateTextWidth(groupName, legendTextFontProps);
        // Estimate height based on font size (a bit more robust than BBox for single line)
        legendTextHeight = Math.max(legendTextHeight, parseFloat(legendTextFontProps.fontSize) * 1.2);
    });
    
    const singleRowLegendItemHeight = Math.max(legendTextHeight, legendRectSize);
    const legendItemWidths = allGroupNames.map(groupName => 
        legendRectSize + legendRectTextPadding + legendTextWidths[groupName] + legendItemPadding
    );

    const legendMaxWidth = containerWidth - chartMargins.left - chartMargins.right;
    const legendRowsData = [];
    let currentLegendRow = [];
    let currentLegendRowWidth = 0;

    legendItemWidths.forEach((itemWidth, index) => {
        if (currentLegendRow.length === 0 || currentLegendRowWidth + itemWidth <= legendMaxWidth) {
            currentLegendRow.push(index);
            currentLegendRowWidth += itemWidth;
        } else {
            legendRowsData.push({ items: currentLegendRow, width: currentLegendRowWidth - legendItemPadding }); // Subtract last padding
            currentLegendRow = [index];
            currentLegendRowWidth = itemWidth;
        }
    });
    if (currentLegendRow.length > 0) {
        legendRowsData.push({ items: currentLegendRow, width: currentLegendRowWidth - legendItemPadding });
    }
    
    const actualLegendHeight = legendRowsData.length * singleRowLegendItemHeight +
                               (legendRowsData.length > 0 ? (legendRowsData.length - 1) * legendRowSpacing : 0) +
                               legendTopMargin + legendBottomMargin;
    
    chartMargins.top = actualLegendHeight + 20; // Adjust top margin for legend

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const groupedByDimension = d3.group(chartData, d => d[dimensionFieldName]);
    const dimensionGroups = Array.from(groupedByDimension, ([key, values]) => {
        return { dimension: key, values: values };
    }).sort((a, b) => a.dimension.localeCompare(b.dimension));

    // Grid layout for multiple donuts
    const numCharts = dimensionGroups.length;
    let gridRows, gridCols;
    if (numCharts <= 3) { gridRows = 1; gridCols = numCharts; }
    else if (numCharts === 4) { gridRows = 2; gridCols = 2; }
    else if (numCharts <= 6) { gridRows = 2; gridCols = 3; }
    else if (numCharts <= 9) { gridRows = 3; gridCols = 3; }
    else {
        gridRows = Math.min(4, Math.ceil(Math.sqrt(numCharts)));
        gridCols = Math.ceil(numCharts / gridRows);
    }

    const itemsPerRow = [];
    for (let i = 0; i < gridRows; i++) {
        itemsPerRow.push( (i < gridRows - 1) ? gridCols : numCharts - gridCols * (gridRows - 1) );
    }

    const cellWidth = innerWidth / gridCols;
    const cellHeight = innerHeight / gridRows;
    
    const chartSpacingHorizontalFactor = 0.15;
    const chartSpacingVerticalFactor = 0.15; // Also accounts for dimension label above
    
    const donutOuterRadius = Math.min(
        (cellWidth * (1 - chartSpacingHorizontalFactor)) / 2,
        (cellHeight * (1 - chartSpacingVerticalFactor)) / 1.8 // Semi-circle needs more relative height
    );
    const donutInnerRadius = donutOuterRadius * 0.6;


    // Block 6: Scale Definition & Configuration (Pie and Arc generators)
    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null)
        .padAngle(0.01)
        .startAngle(-Math.PI / 2)
        .endAngle(Math.PI / 2);

    const arcGenerator = d3.arc()
        .innerRadius(donutInnerRadius)
        .outerRadius(donutOuterRadius);

    const labelArcGenerator = d3.arc() // For labels outside segments
        .innerRadius(donutOuterRadius * 1.05)
        .outerRadius(donutOuterRadius * 1.15);

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${legendTopMargin})`);

    let currentLegendY = 0;
    legendRowsData.forEach(rowInfo => {
        const rowStartX = (innerWidth - rowInfo.width) / 2; // Center each row
        let currentLegendX = rowStartX;
        rowInfo.items.forEach(itemIndex => {
            const groupName = allGroupNames[itemIndex];
            const itemWidth = legendItemWidths[itemIndex];
            
            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentLegendX}, ${currentLegendY})`);

            legendItem.append("circle")
                .attr("class", "mark")
                .attr("cx", legendRectSize / 2)
                .attr("cy", singleRowLegendItemHeight / 2)
                .attr("r", legendRectSize / 2)
                .style("fill", fillStyle.getSegmentColor(groupName, itemIndex));

            legendItem.append("text")
                .attr("class", "label")
                .attr("x", legendRectSize + legendRectTextPadding)
                .attr("y", singleRowLegendItemHeight / 2)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .style("dominant-baseline", "middle")
                .text(groupName);
            
            currentLegendX += itemWidth;
        });
        currentLegendY += singleRowLegendItemHeight + legendRowSpacing;
    });

    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let r = 0; r < gridRows; r++) {
        const numItemsInRow = itemsPerRow[r];
        const rowOffsetX = (gridCols - numItemsInRow) * cellWidth / 2; // Center rows with fewer items

        for (let c = 0; c < numItemsInRow; c++) {
            if (dataIndex >= numCharts) break;
            const donutDataGroup = dimensionGroups[dataIndex];

            const chartCenterX = chartMargins.left + rowOffsetX + (c + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (r + 0.55) * cellHeight; // Adjusted Y for semi-circle and top label

            const singleDonutGroup = svgRoot.append("g")
                .attr("class", "chart-group")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const arcsData = pieGenerator(donutDataGroup.values);

            singleDonutGroup.selectAll(".mark")
                .data(arcsData)
                .enter()
                .append("path")
                .attr("class", "mark")
                .attr("d", arcGenerator)
                .style("fill", (d, i) => fillStyle.getSegmentColor(d.data[groupFieldName], allGroupNames.indexOf(d.data[groupFieldName])))
                .style("stroke", "none");

            // Data labels on segments
            singleDonutGroup.selectAll(".data-label")
                .data(arcsData)
                .enter()
                .append("text")
                .attr("class", "label value data-label")
                .each(function(d) {
                    const segmentArc = d;
                    const textElement = d3.select(this);
                    const segmentColor = fillStyle.getSegmentColor(segmentArc.data[groupFieldName], allGroupNames.indexOf(segmentArc.data[groupFieldName]));
                    textElement.style("fill", getContrastingTextColor(segmentColor));
                    
                    const arcAngle = segmentArc.endAngle - segmentArc.startAngle;
                    const percentOfSemiCircle = arcAngle / Math.PI;
                    const valueText = formatValue(segmentArc.data[valueFieldName]) + (valueFieldUnit ? ` ${valueFieldUnit}` : "");

                    let labelFontSize = parseFloat(fillStyle.typography.annotationFontSize);
                    if (percentOfSemiCircle < 0.08) labelFontSize *= 0.9; // Smaller font for tiny segments

                    textElement
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", `${labelFontSize}px`)
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .style("pointer-events", "none")
                        .text(valueText);

                    if (percentOfSemiCircle > 0.12) { // Place inside if segment is large enough
                        const centroid = arcGenerator.centroid(segmentArc);
                        textElement.attr("transform", `translate(${centroid[0]}, ${centroid[1]})`)
                            .attr("text-anchor", "middle")
                            .style("dominant-baseline", "middle");
                    } else { // Place outside for smaller segments
                        const centroid = labelArcGenerator.centroid(segmentArc);
                         // Adjust text-anchor based on position in semi-circle
                        const midAngle = (segmentArc.startAngle + segmentArc.endAngle) / 2;
                        const anchor = (midAngle < 0) ? "end" : "start"; // Left half vs Right half of semi-circle

                        textElement.attr("transform", `translate(${centroid[0]}, ${centroid[1]})`)
                            .attr("text-anchor", anchor)
                            .style("dominant-baseline", "middle");
                    }
                });
            
            // Dimension label (title for the donut)
            const dimensionLabelText = donutDataGroup.dimension;
            const dimensionLabelFontProps = {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize, // Will be adjusted if too wide
                fontWeight: fillStyle.typography.labelFontWeight,
            };
            let adjustedDimensionFontSize = parseFloat(dimensionLabelFontProps.fontSize);
            const maxDimensionLabelWidth = donutOuterRadius * 2 * 0.9; // Max width for label
            let currentDimensionLabelWidth = estimateTextWidth(dimensionLabelText, {
                ...dimensionLabelFontProps, 
                fontSize: `${adjustedDimensionFontSize}px`
            });

            while(currentDimensionLabelWidth > maxDimensionLabelWidth && adjustedDimensionFontSize > 8) {
                adjustedDimensionFontSize -= 1;
                 currentDimensionLabelWidth = estimateTextWidth(dimensionLabelText, {
                    ...dimensionLabelFontProps, 
                    fontSize: `${adjustedDimensionFontSize}px`
                });
            }

            singleDonutGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -donutOuterRadius - 10) // Position above the donut
                .attr("text-anchor", "middle")
                .style("font-family", dimensionLabelFontProps.fontFamily)
                .style("font-size", `${adjustedDimensionFontSize}px`)
                .style("font-weight", dimensionLabelFontProps.fontWeight)
                .style("fill", fillStyle.textColor)
                .text(dimensionLabelText);

            dataIndex++;

            // Block 9: Optional Enhancements & Post-Processing (Center Image)
            const iconUrl = fillStyle.getIconUrl(donutDataGroup.dimension);
            if (iconUrl) {
                const imageSize = donutInnerRadius * 1.5; // Make image slightly larger than inner hole but fit
                const clipId = `clip-center-${dataIndex}`;

                defs.append("clipPath")
                    .attr("id", clipId)
                    .append("circle")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", imageSize / 2);

                singleDonutGroup.append("image")
                    .attr("class", "image icon")
                    .attr("xlink:href", iconUrl)
                    .attr("clip-path", `url(#${clipId})`)
                    .attr("x", -imageSize / 2)
                    .attr("y", -imageSize / 2)
                    .attr("width", imageSize)
                    .attr("height", imageSize);
            }
        }
    }

    // Block 10: Cleanup & SVG Node Return
    // Temporary SVG for text measurement is created in memory and not appended, so no cleanup needed.
    return svgRoot.node();
}