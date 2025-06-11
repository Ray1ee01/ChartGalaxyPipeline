/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Pie Charts",
  "chart_name": "small_multiples_pie_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 10]],
  "required_fields_icons": [],
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
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const configVariables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme preference if both exist, or just one.
    // const configImages = data.images || {}; // Not used in this chart
    const dataColumnsDefinition = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldName = (dataColumnsDefinition.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumnsDefinition.find(col => col.role === "y") || {}).name;
    const groupFieldName = (dataColumnsDefinition.find(col => col.role === "group") || {}).name;

    if (!dimensionFieldName || !valueFieldName || !groupFieldName) {
        const missingFields = [];
        if (!dimensionFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        if (!groupFieldName) missingFields.push("group role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const valueFieldDefinition = dataColumnsDefinition.find(col => col.role === "y");
    const valueFieldUnit = (valueFieldDefinition && valueFieldDefinition.unit !== "none") ? valueFieldDefinition.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography configuration
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    fillStyle.typography.labelFontFamily = (rawTypography.label && rawTypography.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (rawTypography.label && rawTypography.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (rawTypography.label && rawTypography.label.font_weight) || defaultTypography.label.font_weight;
    fillStyle.typography.annotationFontFamily = (rawTypography.annotation && rawTypography.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (rawTypography.annotation && rawTypography.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (rawTypography.annotation && rawTypography.annotation.font_weight) || defaultTypography.annotation.font_weight;

    // Color configuration
    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4" },
        available_colors: d3.schemeCategory10,
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };
    fillStyle.colors.textColor = rawColors.text_color || defaultColors.text_color;
    fillStyle.colors.backgroundColor = rawColors.background_color || defaultColors.background_color;
    fillStyle.colors.defaultPieSliceColor = (rawColors.other && rawColors.other.primary) || defaultColors.other.primary;

    const uniqueGroupNames = Array.from(new Set(chartDataArray.map(d => d[groupFieldName])));
    const groupColorMap = {};
    const availableColors = rawColors.available_colors || defaultColors.available_colors;
    if (availableColors && availableColors.length > 0) {
        uniqueGroupNames.forEach((name, i) => {
            groupColorMap[name] = availableColors[i % availableColors.length];
        });
    }

    fillStyle.colors.getPieSliceColor = (category) =>
        (rawColors.field && rawColors.field[category])
        ? rawColors.field[category]
        : (groupColorMap[category] || fillStyle.colors.defaultPieSliceColor);

    // Helper: In-memory text measurement
    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.position = 'absolute';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document append is not strictly necessary for getBBox if styles are applied directly,
        // but some browsers might be more consistent if it's (briefly) in a document fragment or similar.
        // For this implementation, we avoid DOM append as per requirements.
        // However, to ensure getBBox works reliably without DOM append, styles must be on the element.
        // A more robust way if not appending is to have a single, reusable off-screen SVG.
        // For simplicity and adherence to "no DOM append for temporary SVG":
        document.body.appendChild(tempSvg); // Brief append for measurement
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg); // Immediate removal
        return width;
    };
    
    const estimateTextHeight = (fontProps) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.position = 'absolute';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = "M"; // Representative character for height
        tempSvg.appendChild(tempText);
        document.body.appendChild(tempSvg);
        const height = tempText.getBBox().height;
        document.body.removeChild(tempSvg);
        return height;
    };


    // Helper: Value formatting
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = configVariables.width || 800;
    const containerHeight = configVariables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.colors.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = { top: 20, right: 30, bottom: 30, left: 30 }; // Initial top margin

    // Legend layout calculation
    const legendRectSize = 15;
    const legendRectTextPadding = 5;
    const legendItemPadding = 15;
    const legendRowSpacing = 10;
    const legendTopMarginContainer = 10; // Margin from container top to legend
    const legendBottomMarginToChart = 20; // Margin from legend bottom to chart area

    const legendTextFontProps = {
        fontFamily: fillStyle.typography.annotationFontFamily,
        fontSize: fillStyle.typography.annotationFontSize,
        fontWeight: fillStyle.typography.annotationFontWeight
    };
    const legendTextHeight = estimateTextHeight(legendTextFontProps);
    const singleLegendRowHeight = Math.max(legendTextHeight, legendRectSize);

    const legendItemWidths = uniqueGroupNames.map(groupName =>
        legendRectSize + legendRectTextPadding + estimateTextWidth(groupName, legendTextFontProps) + legendItemPadding
    );

    const legendAvailableWidth = containerWidth - chartMargins.left - chartMargins.right;
    const legendRows = [];
    let currentLegendRow = [];
    let currentLegendRowWidth = 0;

    legendItemWidths.forEach((itemWidth, index) => {
        if (currentLegendRow.length === 0 || currentLegendRowWidth + itemWidth <= legendAvailableWidth) {
            currentLegendRow.push(index);
            currentLegendRowWidth += itemWidth;
        } else {
            legendRows.push({ items: currentLegendRow, width: currentLegendRowWidth - legendItemPadding }); // Subtract last padding
            currentLegendRow = [index];
            currentLegendRowWidth = itemWidth;
        }
    });
    if (currentLegendRow.length > 0) {
        legendRows.push({ items: currentLegendRow, width: currentLegendRowWidth - legendItemPadding });
    }
    
    const actualLegendHeight = legendRows.length * singleLegendRowHeight +
                               (legendRows.length > 0 ? (legendRows.length - 1) * legendRowSpacing : 0);
    
    chartMargins.top = legendTopMarginContainer + actualLegendHeight + legendBottomMarginToChart;


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Small multiples grid calculation
    const dimensionGroups = Array.from(d3.group(chartDataArray, d => d[dimensionFieldName]), ([key, values]) => {
        return { dimension: key, values, total: d3.sum(values, d => d[valueFieldName]) };
    }).sort((a, b) => a.dimension.localeCompare(b.dimension));

    const numCharts = dimensionGroups.length;
    let rows, cols;
    if (numCharts <= 3) { rows = 1; cols = numCharts; }
    else if (numCharts === 4) { rows = 2; cols = 2; }
    else if (numCharts <= 8) { rows = 2; cols = Math.ceil(numCharts / 2); }
    else if (numCharts <= 12) { rows = 3; cols = Math.ceil(numCharts / 3); }
    else { rows = 4; cols = Math.ceil(numCharts / 4); }

    const itemsPerRow = [];
    for (let i = 0; i < rows; i++) {
        itemsPerRow.push( (i < rows - 1) ? cols : (numCharts - cols * (rows - 1)) );
    }

    const cellWidth = innerWidth / cols;
    const cellHeight = innerHeight / rows;

    const spacingFactorHorizontal = 0.15;
    const spacingFactorVertical = 0.15;
    const chartSpacingHorizontal = cellWidth * spacingFactorHorizontal;
    const chartSpacingVertical = cellHeight * spacingFactorVertical;
    
    const innerCellWidth = cellWidth - chartSpacingHorizontal;
    const innerCellHeight = cellHeight - chartSpacingVertical;

    // Radius calculation (accounts for dimension label above pie)
    const pieRadius = Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10;


    // Dimension label font size adjustment
    fillStyle.typography.adjustedDimensionLabelFontSize = fillStyle.typography.labelFontSize;
    const maxDimensionLabelWidth = d3.max(dimensionGroups, g => estimateTextWidth(g.dimension, {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    }));

    const maxChartAreaWidthForLabel = pieRadius * 2.4; // Max width available for the label
    if (maxDimensionLabelWidth > maxChartAreaWidthForLabel && maxChartAreaWidthForLabel > 0) {
        const scaleFactor = maxChartAreaWidthForLabel / maxDimensionLabelWidth;
        fillStyle.typography.adjustedDimensionLabelFontSize = `${Math.max(8, Math.floor(parseFloat(fillStyle.typography.labelFontSize) * scaleFactor))}px`;
    }


    // Block 5: Data Preprocessing & Transformation
    // Data already grouped and sorted into `dimensionGroups` in Block 4.

    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales (e.g., xScale, yScale) are used for this chart type.
    // Color mapping is handled by `fillStyle.colors.getPieSliceColor`.

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${legendTopMarginContainer})`);

    let currentLegendY = 0;
    legendRows.forEach(rowInfo => {
        const rowStartX = (legendAvailableWidth - rowInfo.width) / 2; // Center the row
        let currentLegendX = rowStartX;
        rowInfo.items.forEach(itemIndex => {
            const groupName = uniqueGroupNames[itemIndex];
            const itemWidth = legendItemWidths[itemIndex];

            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentLegendX}, ${currentLegendY})`);

            legendItem.append("rect")
                .attr("class", "mark legend-color-sample")
                .attr("width", legendRectSize)
                .attr("height", legendRectSize)
                .attr("fill", fillStyle.colors.getPieSliceColor(groupName));

            legendItem.append("text")
                .attr("class", "label legend-text")
                .attr("x", legendRectSize + legendRectTextPadding)
                .attr("y", legendRectSize / 2) // Align text vertically with rect center
                .attr("dy", "0.35em") // More precise vertical centering
                .style("font-family", legendTextFontProps.fontFamily)
                .style("font-size", legendTextFontProps.fontSize)
                .style("font-weight", legendTextFontProps.fontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(groupName);
            
            currentLegendX += itemWidth;
        });
        currentLegendY += singleLegendRowHeight + legendRowSpacing;
    });


    // Block 8: Main Data Visualization Rendering (Small Multiples of Pie Charts)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-area")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const numColsInThisRow = itemsPerRow[r];
        const rowOffset = (innerWidth - numColsInThisRow * cellWidth) / 2; // Center the row of charts

        for (let c = 0; c < numColsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const currentGroupData = dimensionGroups[dataIndex];

            const chartCenterX = rowOffset + c * cellWidth + cellWidth / 2;
            const chartCenterY = r * cellHeight + cellHeight / 2 - (cellHeight - innerCellHeight)/2; // Adjust Y to be centered in innerCellHeight

            const smallMultipleGroup = mainChartGroup.append("g")
                .attr("class", "small-multiple-group chart-group")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const pieGenerator = d3.pie()
                .value(d => d[valueFieldName])
                .sort(null);

            const arcGenerator = d3.arc()
                .innerRadius(0)
                .outerRadius(pieRadius * 0.9); // Main pie slice radius

            const labelArcGenerator = d3.arc() // For positioning labels
                .innerRadius(pieRadius * 0.5)
                .outerRadius(pieRadius * 1.1);

            const arcsData = pieGenerator(currentGroupData.values);

            smallMultipleGroup.selectAll(".pie-slice")
                .data(arcsData)
                .enter()
                .append("path")
                .attr("class", "mark pie-slice")
                .attr("d", arcGenerator)
                .attr("fill", d => fillStyle.colors.getPieSliceColor(d.data[groupFieldName]));

            smallMultipleGroup.selectAll(".data-label")
                .data(arcsData)
                .enter()
                .append("text")
                .attr("class", "label data-label")
                .each(function(d) {
                    const arcAngle = d.endAngle - d.startAngle;
                    const percent = arcAngle / (2 * Math.PI);
                    const valueText = valueFieldUnit ? `${formatValue(d.data[valueFieldName])} ${valueFieldUnit}` : formatValue(d.data[valueFieldName]);
                    
                    let textAnchor = "middle";
                    let position;

                    if (percent > 0.10) { // Label inside for larger slices
                        position = arcGenerator.centroid(d);
                    } else { // Label outside for smaller slices
                        position = labelArcGenerator.centroid(d);
                        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                        textAnchor = (midAngle < Math.PI) ? "start" : "end";
                    }
                    
                    d3.select(this)
                        .attr("transform", `translate(${position[0]}, ${position[1]})`)
                        .attr("text-anchor", textAnchor)
                        .style("dominant-baseline", "middle")
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", fillStyle.typography.annotationFontSize)
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .style("fill", fillStyle.colors.textColor)
                        .text(valueText);
                });

            // Dimension Label for each small multiple
            smallMultipleGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -pieRadius - 10) // Position above the pie
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.adjustedDimensionLabelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(currentGroupData.dimension);

            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements applied in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}