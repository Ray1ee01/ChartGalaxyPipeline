/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Donut Chart",
  "chart_name": "multiple_donut_chart_03",
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
    // This function generates multiple donut charts based on provided data and configuration.

    // Block 1: Configuration Parsing & Validation
    const config = data; // Renaming for clarity as per standardization
    const chartDataArray = config.data.data;
    const variables = config.variables || {};
    const rawTypography = config.typography || {};
    const rawColors = config.colors || (config.colors_dark || {});
    const rawImages = config.images || {};
    const dataColumns = config.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    if (!xField || !yField || !groupField) {
        const missingFields = [
            !xField ? "x field (dimension)" : null,
            !yField ? "y field (value)" : null,
            !groupField ? "group field" : null
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        return null;
    }

    const yFieldUnit = dataColumns.find(col => col.role === "y")?.unit !== "none" ? dataColumns.find(col => col.role === "y").unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: rawTypography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: rawTypography.title?.font_size || '16px',
            titleFontWeight: rawTypography.title?.font_weight || 'bold',
            labelFontFamily: rawTypography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: rawTypography.label?.font_size || '12px',
            labelFontWeight: rawTypography.label?.font_weight || 'normal',
            annotationFontFamily: rawTypography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: rawTypography.annotation?.font_size || '10px',
            annotationFontWeight: rawTypography.annotation?.font_weight || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        sliceStrokeColor: '#FFFFFF', // Standard stroke for slices
        defaultPrimaryColor: rawColors.other?.primary || '#1f77b4', // Default primary color
        getSliceColor: (groupValue, index) => {
            if (rawColors.field && rawColors.field[groupValue]) {
                return rawColors.field[groupValue];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[index % rawColors.available_colors.length];
            }
            return fillStyle.defaultPrimaryColor;
        },
        getCenterImageURL: (xFieldValue) => {
            if (rawImages.field && rawImages.field[xFieldValue]) {
                return rawImages.field[xFieldValue];
            }
            if (rawImages.other && rawImages.other.primary) {
                return rawImages.other.primary;
            }
            return null;
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.visibility = 'hidden';
        svg.style.position = 'absolute';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        document.body.appendChild(svg); // Needs to be in DOM for getBBox to work reliably
        const width = textElement.getBBox().width;
        document.body.removeChild(svg);
        return width;
    }
    
    function estimateTextHeight(fontFamily, fontSize) { // Simplified for height, assuming single line
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.visibility = 'hidden';
        svg.style.position = 'absolute';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.textContent = "M"; // Sample character for height
        svg.appendChild(textElement);
        document.body.appendChild(svg);
        const height = textElement.getBBox().height;
        document.body.removeChild(svg);
        return height;
    }


    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    const getContrastColor = (hexColor) => {
        if (!hexColor || hexColor.toLowerCase() === "#ffffff" || hexColor.toLowerCase() === "white") {
            return fillStyle.textColor; // Default dark text for light backgrounds
        }
        hexColor = hexColor.replace("#", "");
        if (hexColor.length === 3) {
            hexColor = hexColor.split("").map(char => char + char).join("");
        }
        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        return brightness > 130 ? '#000000' : '#FFFFFF'; // Simplified contrast: black or white
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-container")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 75, right: 70, bottom: 75, left: 70 }; // Initial margins

    // Legend dimensions (calculated later, will adjust chartMargins.top)
    const legendRectSize = 15;
    const legendRectTextPadding = 5;
    const legendItemPadding = 15;
    const legendRowSpacing = 12;
    const legendTopMargin = 10;
    const legendBottomMargin = 10;
    
    // Block 5: Data Preprocessing & Transformation
    const groupedByXField = d3.group(chartDataArray, d => d[xField]);
    const dimensionGroups = Array.from(groupedByXField, ([key, values]) => {
        const total = d3.sum(values, d => d[yField]);
        return { dimension: key, values, total };
    }).sort((a, b) => String(a.dimension).localeCompare(String(b.dimension)));

    // Block 7: Chart Component Rendering (Legend - rendered first to determine top margin)
    const allGroupFieldValues = Array.from(new Set(chartDataArray.map(d => d[groupField]))).sort((a,b) => String(a).localeCompare(String(b)));
    
    const legendTextWidths = {};
    let legendTextHeight = estimateTextHeight(fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize);

    allGroupFieldValues.forEach(group => {
        legendTextWidths[group] = estimateTextWidth(group, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
    });

    const singleRowLegendHeight = Math.max(legendTextHeight, legendRectSize);
    const legendItemWidths = allGroupFieldValues.map(group => 
        legendRectSize + legendRectTextPadding + legendTextWidths[group] + legendItemPadding
    );

    const legendMaxWidth = containerWidth - chartMargins.left - chartMargins.right - 40; // Max width for legend area
    const legendRowsData = [];
    let currentLegendRow = [];
    let currentLegendRowWidth = 0;

    legendItemWidths.forEach((itemWidth, index) => {
        if (currentLegendRow.length === 0 || currentLegendRowWidth + itemWidth <= legendMaxWidth) {
            currentLegendRow.push(index);
            currentLegendRowWidth += itemWidth;
        } else {
            legendRowsData.push(currentLegendRow);
            currentLegendRow = [index];
            currentLegendRowWidth = itemWidth;
        }
    });
    if (currentLegendRow.length > 0) {
        legendRowsData.push(currentLegendRow);
    }

    const actualLegendHeight = legendRowsData.length * singleRowLegendHeight + 
                               (legendRowsData.length > 0 ? (legendRowsData.length - 1) * legendRowSpacing : 0) + 
                               legendTopMargin + legendBottomMargin;
    
    chartMargins.top = actualLegendHeight > legendTopMargin + legendBottomMargin ? actualLegendHeight + 20 : chartMargins.top; // Adjust top margin for legend

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${legendTopMargin})`);

    legendRowsData.forEach((rowIndices, rowIndex) => {
        const rowY = rowIndex * (singleRowLegendHeight + legendRowSpacing);
        const rowTotalWidth = rowIndices.reduce((sum, itemIndex) => sum + legendItemWidths[itemIndex], 0) - legendItemPadding; // Subtract last padding
        const rowStartX = (containerWidth - chartMargins.left - chartMargins.right - rowTotalWidth) / 2;
        let currentX = rowStartX;

        rowIndices.forEach((itemIndex, idxInRow) => {
            const groupValue = allGroupFieldValues[itemIndex];
            
            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${rowY})`);

            legendItem.append("circle")
                .attr("class", "mark legend-marker")
                .attr("cx", legendRectSize / 2)
                .attr("cy", singleRowLegendHeight / 2 - (singleRowLegendHeight - legendRectSize)/2) // Vertically center marker
                .attr("r", legendRectSize / 2)
                .attr("fill", fillStyle.getSliceColor(groupValue, itemIndex));
            
            legendItem.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendRectSize + legendRectTextPadding)
                .attr("y", singleRowLegendHeight / 2) // Vertically center text
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .style("dominant-baseline", "middle")
                .text(groupValue);
            
            currentX += legendItemWidths[itemIndex];
        });
    });

    // Recalculate inner dimensions after legend potentially changed margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const numCharts = dimensionGroups.length;
    let rows, cols;
    if (numCharts <= 3) { rows = 1; cols = numCharts; }
    else if (numCharts === 4) { rows = 2; cols = 2; }
    else if (numCharts <= 6) { rows = 2; cols = 3; }
    else if (numCharts <= 9) { rows = 3; cols = 3; }
    else {
        rows = Math.min(4, Math.ceil(Math.sqrt(numCharts)));
        cols = Math.ceil(numCharts / rows);
    }

    const itemsPerRow = [];
    for (let i = 0; i < rows; i++) {
        itemsPerRow.push(i < rows - 1 ? cols : numCharts - cols * (rows - 1));
    }

    const cellWidth = innerWidth / cols;
    const cellHeight = innerHeight / rows;

    const spacingFactorHorizontal = 0.15;
    const spacingFactorVertical = 0.15;
    const chartSpacingHorizontal = cellWidth * spacingFactorHorizontal;
    const chartSpacingVertical = cellHeight * spacingFactorVertical;
    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    const baseRadius = Math.min(innerCellWidth / 2, innerCellHeight / 2.2) * 0.9; // Slightly reduced to avoid crowding

    // Dimension label font size adjustment
    let maxDimensionWidth = 0;
    const baseDimensionFontSize = parseFloat(fillStyle.typography.labelFontSize);
    dimensionGroups.forEach(group => {
        const width = estimateTextWidth(group.dimension, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        maxDimensionWidth = Math.max(maxDimensionWidth, width);
    });
    
    const maxChartAreaWidthForLabel = baseRadius * 2.4;
    let dimensionScaleFactor = 1;
    if (maxDimensionWidth > maxChartAreaWidthForLabel && maxDimensionWidth > 0) {
        dimensionScaleFactor = maxChartAreaWidthForLabel / maxDimensionWidth;
    }
    const adjustedDimensionFontSize = `${Math.max(8, Math.floor(baseDimensionFontSize * dimensionScaleFactor))}px`; // Ensure min font size

    // Block 6: Scale Definition & Configuration (Pie and Arc generators)
    const pieGenerator = d3.pie()
        .value(d => d[yField])
        .sort(null);

    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let row = 0; row < rows; row++) {
        const itemsInThisRow = itemsPerRow[row];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;

        for (let colIdx = 0; colIdx < itemsInThisRow; colIdx++) {
            if (dataIndex >= numCharts) break;
            const groupData = dimensionGroups[dataIndex];
            
            const chartCenterX = chartMargins.left + rowOffset + (colIdx + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (row + 0.5) * cellHeight - chartSpacingVertical / 2; // Adjusted Y for better spacing

            const donutChartGroup = svgRoot.append("g")
                .attr("class", "mark donut-group")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const currentRadius = baseRadius; // Use consistent radius for all donuts

            const arcGenerator = d3.arc()
                .innerRadius(currentRadius * 0.6)
                .outerRadius(currentRadius * 0.9);

            const arcsData = pieGenerator(groupData.values);

            donutChartGroup.selectAll(".donut-slice")
                .data(arcsData)
                .enter()
                .append("path")
                .attr("class", "mark donut-slice")
                .attr("d", arcGenerator)
                .attr("fill", (d, i) => fillStyle.getSliceColor(d.data[groupField], allGroupFieldValues.indexOf(d.data[groupField])))
                .style("stroke", fillStyle.sliceStrokeColor)
                .style("stroke-width", 1.5);

            const centerImageURL = fillStyle.getCenterImageURL(groupData.dimension);
            if (centerImageURL) {
                const imageSize = Math.max(24, currentRadius * 0.5);
                const clipId = `clip-center-${dataIndex}`;
                
                donutChartGroup.append("defs")
                    .append("clipPath")
                    .attr("id", clipId)
                    .append("circle")
                    .attr("r", imageSize / 2);

                donutChartGroup.append("image")
                    .attr("class", "image center-image")
                    .attr("xlink:href", centerImageURL)
                    .attr("clip-path", `url(#${clipId})`)
                    .attr("x", -imageSize / 2)
                    .attr("y", -imageSize / 2)
                    .attr("width", imageSize)
                    .attr("height", imageSize);
            }

            // Data Labels for slices
            donutChartGroup.selectAll(".data-label")
                .data(arcsData)
                .enter()
                .append("text")
                .attr("class", "label data-label")
                .each(function(d) {
                    const thisLabel = d3.select(this);
                    const arcAngle = d.endAngle - d.startAngle;
                    const percent = arcAngle / (2 * Math.PI);
                    const valueText = yFieldUnit ? `${formatValue(d.data[yField])} ${yFieldUnit}` : formatValue(d.data[yField]);
                    
                    thisLabel.style("font-family", fillStyle.typography.annotationFontFamily)
                             .style("font-weight", fillStyle.typography.annotationFontWeight)
                             .style("pointer-events", "none");

                    if (percent > 0.07) { // Label inside
                        const centroid = arcGenerator.centroid(d);
                        thisLabel.attr("x", centroid[0])
                                 .attr("y", centroid[1])
                                 .attr("text-anchor", "middle")
                                 .style("dominant-baseline", "middle")
                                 .style("font-size", `${parseFloat(fillStyle.typography.annotationFontSize) * 1}px`) // Adjusted factor
                                 .style("fill", getContrastColor(fillStyle.getSliceColor(d.data[groupField], allGroupFieldValues.indexOf(d.data[groupField]))))
                                 .text(valueText);
                    } else if (percent > 0.01) { // Label outside for smaller, but not tiny, slices
                        const labelArc = d3.arc()
                            .innerRadius(currentRadius * 1.0) // Position outside the donut
                            .outerRadius(currentRadius * 1.05);
                        const centroid = labelArc.centroid(d);
                        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                        
                        thisLabel.attr("x", centroid[0])
                                 .attr("y", centroid[1])
                                 .attr("text-anchor", (midAngle < Math.PI || midAngle > 2 * Math.PI) ? "start" : "end")
                                 .style("dominant-baseline", "middle")
                                 .style("font-size", `${parseFloat(fillStyle.typography.annotationFontSize) * 0.9}px`)
                                 .style("fill", fillStyle.textColor)
                                 .text(valueText);
                    } // Tiny slices: no label
                });

            // Dimension Label for each donut
            donutChartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -currentRadius - 10)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(groupData.dimension);
            
            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // No shadows or other complex effects as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}