/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples Semicircle Donut",
  "chart_name": "small_multiples_semicircle_donut_01",
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
  "min_width": 400,
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
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const inputImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const groupFieldName = dataColumns.find(col => col.role === "group")?.name;

    const criticalFields = { dimensionFieldName, valueFieldName, groupFieldName };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const valueFieldUnit = dataColumns.find(col => col.role === "y")?.unit || "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (inputTypography.title && inputTypography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (inputTypography.title && inputTypography.title.font_size) || '16px',
            titleFontWeight: (inputTypography.title && inputTypography.title.font_weight) || 'bold',
            labelFontFamily: (inputTypography.label && inputTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (inputTypography.label && inputTypography.label.font_size) || '12px',
            labelFontWeight: (inputTypography.label && inputTypography.label.font_weight) || 'normal',
            annotationFontFamily: (inputTypography.annotation && inputTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (inputTypography.annotation && inputTypography.annotation.font_size) || '10px',
            annotationFontWeight: (inputTypography.annotation && inputTypography.annotation.font_weight) || 'normal',
        },
        textColor: inputColors.text_color || '#333333',
        chartBackground: inputColors.background_color || '#FFFFFF', // Not used directly on SVG, but available
        primaryAccent: (inputColors.other && inputColors.other.primary) || '#1f77b4',
        // Segment color function will be fully defined after allGroups is known
    };

    const allGroups = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort((a,b) => a.localeCompare(b));

    fillStyle.segmentColor = (groupValue) => {
        if (inputColors.field && inputColors.field[groupValue]) {
            return inputColors.field[groupValue];
        }
        const groupIndex = allGroups.indexOf(groupValue);
        if (inputColors.available_colors && inputColors.available_colors.length > 0) {
            return inputColors.available_colors[groupIndex % inputColors.available_colors.length];
        }
        if (inputColors.other && inputColors.other.primary) {
            return inputColors.other.primary;
        }
        // Fallback to d3.schemeCategory10 if all else fails
        const defaultScheme = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];
        return defaultScheme[groupIndex % defaultScheme.length];
    };
    
    fillStyle.getImageUrl = (key) => {
        if (inputImages.field && inputImages.field[key]) {
            return inputImages.field[key];
        }
        // Example: Fallback to a primary image if defined, though not used in this specific chart's logic
        // if (inputImages.other && inputImages.other.primary) {
        //     return inputImages.other.primary;
        // }
        return null;
    };


    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const tempSvg = d3.select(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
        const textElement = tempSvg.append('text')
            .style('font-family', fontFamily)
            .style('font-size', fontSize)
            .style('font-weight', fontWeight)
            .text(text);
        const width = textElement.node().getBBox().width;
        // tempSvg.remove(); // Not strictly necessary as it's not in DOM
        return width;
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.2s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.2s")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 850;
    const containerHeight = variables.height || 550;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Apply background to SVG itself

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = {
        top: 75,
        right: 70,
        bottom: 75,
        left: 70
    };

    // Legend dimensions (calculated in Block 7, affects margins)
    let actualLegendHeight = 0;

    // Grid layout calculation (deferred until after legend height is known and margins updated)
    
    // Block 5: Data Preprocessing & Transformation
    const groupedByDimension = d3.group(chartDataArray, d => d[dimensionFieldName]);
    const dimensionGroups = Array.from(groupedByDimension, ([key, values]) => {
        const total = d3.sum(values, d => d[valueFieldName]);
        return { dimension: key, values, total };
    }).sort((a, b) => a.dimension.localeCompare(b.dimension));

    // Block 6: Scale Definition & Configuration
    // Scales are mostly implicit in pie/arc generators. Font scaling is handled dynamically.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendRectSize = 15;
    const legendRectTextPadding = 5;
    const legendItemPadding = 15;
    const legendRowSpacing = 12;
    const legendTopMargin = 10;
    const legendBottomMargin = 10;

    const legendTextWidths = {};
    let legendTextHeight = 0;

    allGroups.forEach(group => {
        const textWidth = estimateTextWidth(group, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        legendTextWidths[group] = textWidth;
        // Estimate height based on font size (a bit simplistic but avoids another SVG measure)
        legendTextHeight = Math.max(legendTextHeight, parseFloat(fillStyle.typography.annotationFontSize) * 1.2);
    });
    
    const singleRowHeight = Math.max(legendTextHeight, legendRectSize);
    const legendItemWidths = allGroups.map(group =>
        legendRectSize + legendRectTextPadding + legendTextWidths[group] + legendItemPadding
    );

    const legendMaxWidth = containerWidth - chartMargins.left - chartMargins.right; // Use full available width initially
    const legendRows = [];
    let currentRow = [];
    let currentRowWidth = 0;

    legendItemWidths.forEach((itemWidth, index) => {
        if (currentRow.length === 0 || currentRowWidth + itemWidth <= legendMaxWidth) {
            currentRow.push(index);
            currentRowWidth += itemWidth;
        } else {
            legendRows.push(currentRow);
            currentRow = [index];
            currentRowWidth = itemWidth;
        }
    });
    if (currentRow.length > 0) {
        legendRows.push(currentRow);
    }

    actualLegendHeight = legendRows.length * singleRowHeight +
                         (legendRows.length > 0 ? (legendRows.length - 1) * legendRowSpacing : 0) +
                         legendTopMargin + legendBottomMargin;
    
    chartMargins.top = actualLegendHeight + 20; // Update top margin based on legend

    const legendGroup = svgRoot.append("g")
        .attr("class", "other legend")
        .attr("transform", `translate(0, ${legendTopMargin})`); // Position from top, centering handled per row

    legendRows.forEach((rowIndices, rowIndex) => {
        const rowY = rowIndex * (singleRowHeight + legendRowSpacing);
        const rowTotalWidth = rowIndices.reduce((sum, itemIndex) => sum + legendItemWidths[itemIndex], 0) - legendItemPadding; // Subtract last padding
        const rowStartX = (containerWidth - rowTotalWidth) / 2;
        let currentX = rowStartX;

        rowIndices.forEach(itemIndex => {
            const groupName = allGroups[itemIndex];
            const itemWidth = legendItemWidths[itemIndex];

            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${rowY})`);

            legendItem.append("circle")
                .attr("class", "mark")
                .attr("cx", legendRectSize / 2)
                .attr("cy", singleRowHeight / 2) // Center vertically in row
                .attr("r", legendRectSize / 2)
                .attr("fill", fillStyle.segmentColor(groupName));

            legendItem.append("text")
                .attr("class", "text label")
                .attr("x", legendRectSize + legendRectTextPadding)
                .attr("y", singleRowHeight / 2)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .style("dominant-baseline", "middle")
                .text(groupName);
            currentX += itemWidth;
        });
    });

    // Recalculate chart area dimensions now that margins are final
    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;

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

    const cellWidth = chartAreaWidth / cols;
    const cellHeight = (chartAreaHeight / rows) * 1.2 - 40; // Original logic, keep for now

    const spacingFactorHorizontal = 0.15;
    const spacingFactorVertical = 0.15;
    const chartSpacingHorizontal = cellWidth * spacingFactorHorizontal; // Not directly used, innerCellWidth implies it
    const chartSpacingVertical = cellHeight * spacingFactorVertical; // Not directly used

    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    const radius = Math.min(innerCellWidth / 2, innerCellHeight / 1.8) * 1.2;

    let maxDimensionWidth = 0;
    dimensionGroups.forEach(group => {
        const width = estimateTextWidth(group.dimension, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        maxDimensionWidth = Math.max(maxDimensionWidth, width);
    });
    
    const maxChartAreaWidthForTitle = radius * 2.4; // Max width for the title above a semicircle
    let dimensionScaleFactor = 1;
    if (maxDimensionWidth > maxChartAreaWidthForTitle && maxChartAreaWidthForTitle > 0) {
        dimensionScaleFactor = maxChartAreaWidthForTitle / (maxDimensionWidth + 3); // Add padding
    }
    const baseDimFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const adjustedDimensionFontSize = `${Math.max(8, Math.floor(baseDimFontSize * dimensionScaleFactor))}px`; // Ensure min size


    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const groupData = dimensionGroups[dataIndex];

            const chartCenterX = chartMargins.left + rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (r + 0.6) * cellHeight;

            const chartGroup = svgRoot.append("g")
                .attr("class", "other small-multiple-group")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const pie = d3.pie()
                .value(d => d[valueFieldName])
                .sort(null)
                .padAngle(0.01)
                .startAngle(-Math.PI / 2)
                .endAngle(Math.PI / 2);

            const arcGenerator = d3.arc()
                .innerRadius(radius * 0.6)
                .outerRadius(radius * 0.9);

            const arcsData = pie(groupData.values);

            chartGroup.selectAll("path.mark")
                .data(arcsData)
                .enter()
                .append("path")
                .attr("class", "mark")
                .attr("d", arcGenerator)
                .attr("fill", d => fillStyle.segmentColor(d.data[groupFieldName]))
                .style("stroke", "none");

            const imageSize = radius * 0.5;
            const minImageSize = 32;
            const actualImageSize = Math.max(minImageSize, imageSize);
            const imageUrl = fillStyle.getImageUrl(groupData.dimension);

            if (imageUrl) {
                const clipId = `clip-center-${dataIndex}`;
                defs.append("clipPath")
                    .attr("id", clipId)
                    .append("circle")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", actualImageSize / 2);

                chartGroup.append("image")
                    .attr("class", "image icon")
                    .attr("xlink:href", imageUrl)
                    .attr("clip-path", `url(#${clipId})`)
                    .attr("x", -actualImageSize / 2)
                    .attr("y", -actualImageSize / 2)
                    .attr("width", actualImageSize)
                    .attr("height", actualImageSize);
            }

            chartGroup.selectAll("text.data-label")
                .data(arcsData)
                .enter()
                .append("text")
                .attr("class", "text label data-label")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .style("pointer-events", "none")
                .each(function(d) {
                    const self = d3.select(this);
                    const arcAngle = d.endAngle - d.startAngle;
                    const valueText = valueFieldUnit && valueFieldUnit !== "none" ?
                        `${formatValue(d.data[valueFieldName])} ${valueFieldUnit}` :
                        formatValue(d.data[valueFieldName]);
                    const percent = arcAngle / Math.PI;
                    
                    let labelFontSize = parseFloat(fillStyle.typography.annotationFontSize) * 1.1;

                    if (percent > 0.12) { // Slightly increased threshold for internal placement
                        const centroid = arcGenerator.centroid(d);
                        self.attr("x", centroid[0])
                            .attr("y", centroid[1])
                            .attr("text-anchor", "middle")
                            .style("dominant-baseline", "middle");
                    } else {
                        const labelRadiusOuter = radius * 1.05; // Adjusted for better clearance
                        const angle = (d.startAngle + d.endAngle) / 2;
                        const x = labelRadiusOuter * Math.cos(angle - Math.PI / 2);
                        const y = labelRadiusOuter * Math.sin(angle - Math.PI / 2);
                        const textAnchor = (angle - Math.PI / 2 > -Math.PI / 2 && angle - Math.PI / 2 < Math.PI / 2) ? "start" : "end"; // Simplified logic for semicircle
                        
                        if (angle - Math.PI / 2 === -Math.PI / 2 || angle - Math.PI / 2 === Math.PI / 2) { // Top or bottom edge
                             textAnchor = "middle";
                        }


                        self.attr("x", x)
                            .attr("y", y)
                            .attr("text-anchor", textAnchor)
                            .style("dominant-baseline", "middle");
                        if (percent < 0.05) {
                            labelFontSize = parseFloat(fillStyle.typography.annotationFontSize) * 0.95;
                        }
                    }
                    self.style("font-size", `${labelFontSize}px`).text(valueText);
                });

            chartGroup.append("text")
                .attr("class", "text label dimension-title")
                .attr("x", 0)
                .attr("y", -radius * 0.9 - 10)
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
    // (None in this refactored version beyond what's in Block 8)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}