/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Donut Charts",
  "chart_name": "small_multiples_donut_plain_chart_01",
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
    const chartDataArray = data.data?.data || [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    const rawImages = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldRole = "x";
    const valueFieldRole = "y";
    const groupFieldRole = "group";

    const dimensionColumn = dataColumns.find(col => col.role === dimensionFieldRole);
    const valueColumn = dataColumns.find(col => col.role === valueFieldRole);
    const groupColumn = dataColumns.find(col => col.role === groupFieldRole);

    const dimensionFieldName = dimensionColumn?.name;
    const valueFieldName = valueColumn?.name;
    const groupFieldName = groupColumn?.name;

    const missingFields = [];
    if (!dimensionFieldName) missingFields.push(`Field for role '${dimensionFieldRole}'`);
    if (!valueFieldName) missingFields.push(`Field for role '${valueFieldRole}'`);
    if (!groupFieldName) missingFields.push(`Field for role '${groupFieldRole}'`);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionUnit = dimensionColumn.unit !== "none" ? dimensionColumn.unit : "";
    const valueUnit = valueColumn.unit !== "none" ? valueColumn.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            title: {
                font_family: rawTypography.title?.font_family || "Arial, sans-serif",
                font_size: rawTypography.title?.font_size || "16px",
                font_weight: rawTypography.title?.font_weight || "bold",
            },
            label: {
                font_family: rawTypography.label?.font_family || "Arial, sans-serif",
                font_size: rawTypography.label?.font_size || "12px",
                font_weight: rawTypography.label?.font_weight || "normal",
            },
            annotation: {
                font_family: rawTypography.annotation?.font_family || "Arial, sans-serif",
                font_size: rawTypography.annotation?.font_size || "10px",
                font_weight: rawTypography.annotation?.font_weight || "normal",
            }
        },
        textColor: rawColors.text_color || "#0f223b",
        backgroundColor: rawColors.background_color || "#FFFFFF",
        primaryColor: rawColors.other?.primary || "#1f77b4",
        defaultColors: rawColors.available_colors || d3.schemeCategory10,
        segmentStrokeColor: "#FFFFFF", // Standard stroke for segments
    };

    fillStyle.getSegmentColor = (groupValue) => {
        if (rawColors.field && rawColors.field[groupValue]) {
            return rawColors.field[groupValue];
        }
        const uniqueGroupValues = Array.from(new Set(chartDataArray.map(d => d[groupFieldName])));
        const idx = uniqueGroupValues.indexOf(groupValue);
        if (idx !== -1 && fillStyle.defaultColors.length > 0) {
            return fillStyle.defaultColors[idx % fillStyle.defaultColors.length];
        }
        return fillStyle.primaryColor;
    };
    
    fillStyle.getImageUrl = (dimensionValue) => {
        return rawImages.field?.[dimensionValue] || rawImages.other?.primary || null;
    };

    function _estimateTextSize(text, fontProps) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const textNode = document.createElementNS(svgNS, 'text');
        textNode.style.fontFamily = fontProps.font_family;
        textNode.style.fontSize = fontProps.font_size;
        textNode.style.fontWeight = fontProps.font_weight;
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        const bbox = textNode.getBBox();
        return { width: bbox.width, height: bbox.height };
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return `${d3.format("~.2s")(value / 1000000000)}B`;
        if (value >= 1000000) return `${d3.format("~.2s")(value / 1000000)}M`;
        if (value >= 1000) return `${d3.format("~.2s")(value / 1000)}K`;
        return d3.format("~g")(value);
    };

    const getContrastColor = (hexColor) => {
        if (!hexColor || typeof hexColor !== 'string') return fillStyle.textColor;
        hexColor = hexColor.replace("#", "");
        if (hexColor.length === 3) hexColor = hexColor.split("").map(char => char + char).join("");
        if (hexColor.length !== 6) return fillStyle.textColor; // Invalid hex

        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        return brightness > 130 ? "#333333" : "#FFFFFF"; // Standard contrast logic
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
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 75, right: 70, bottom: 75, left: 70 }; // Initial margins

    // Legend calculation (affects top margin)
    const allGroupValues = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort();
    const legendRectSize = 15;
    const legendRectTextPadding = 5;
    const legendItemPadding = 15;
    const legendRowSpacing = 12;
    const legendTopMargin = 10;
    const legendBottomMargin = 10;

    const legendTextSizes = {};
    let maxLegendTextHeight = 0;
    allGroupValues.forEach(group => {
        const size = _estimateTextSize(group, fillStyle.typography.annotation);
        legendTextSizes[group] = size.width;
        maxLegendTextHeight = Math.max(maxLegendTextHeight, size.height);
    });
    
    const singleLegendRowHeight = Math.max(maxLegendTextHeight, legendRectSize);
    const legendItemWidths = allGroupValues.map(group =>
        legendRectSize + legendRectTextPadding + legendTextSizes[group] + legendItemPadding
    );

    const legendMaxWidth = containerWidth - chartMargins.left - chartMargins.right - 20; // Available width for legend items
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
    
    const actualLegendHeight = legendRowsData.length * singleLegendRowHeight +
                               (legendRowsData.length > 0 ? (legendRowsData.length - 1) * legendRowSpacing : 0) +
                               legendTopMargin + legendBottomMargin;
    
    chartMargins.top = actualLegendHeight + 20; // Adjust top margin for legend

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const groupedByDimension = d3.group(chartDataArray, d => d[dimensionFieldName]);
    const dimensionGroups = Array.from(groupedByDimension, ([key, values]) => {
        const total = d3.sum(values, d => d[valueFieldName]);
        return { dimension: key, values, total };
    }).sort((a, b) => a.dimension.localeCompare(b.dimension));

    // Small multiples grid layout
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
    
    const baseRadius = Math.min(innerCellWidth / 2, innerCellHeight / 2.2) * 0.9; // Slightly smaller base

    // Dimension label font size adjustment
    let maxDimensionLabelWidth = 0;
    dimensionGroups.forEach(group => {
        const size = _estimateTextSize(group.dimension, fillStyle.typography.label);
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, size.width);
    });

    const maxAllowedLabelWidth = baseRadius * 2; // Label should fit above donut
    let dimensionLabelScaleFactor = 1;
    if (maxDimensionLabelWidth > maxAllowedLabelWidth && maxAllowedLabelWidth > 0) {
        dimensionLabelScaleFactor = maxAllowedLabelWidth / maxDimensionLabelWidth;
    }
    const adjustedDimensionFontSize = `${Math.max(8, Math.floor(parseFloat(fillStyle.typography.label.font_size) * dimensionLabelScaleFactor))}px`;


    // Block 6: Scale Definition & Configuration
    // Pie and Arc generators are configured per small multiple in Block 8

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${legendTopMargin})`);

    legendRowsData.forEach((rowInfo, rowIndex) => {
        const rowY = rowIndex * (singleLegendRowHeight + legendRowSpacing);
        const rowStartX = (innerWidth - rowInfo.width) / 2; // Center the row
        let currentX = rowStartX;

        rowInfo.items.forEach(itemIndex => {
            const groupName = allGroupValues[itemIndex];
            const itemWidth = legendItemWidths[itemIndex];
            
            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${rowY})`);

            legendItem.append("circle")
                .attr("class", "mark")
                .attr("cx", legendRectSize / 2)
                .attr("cy", singleLegendRowHeight / 2) // Vertically center in row height
                .attr("r", legendRectSize / 2)
                .attr("fill", fillStyle.getSegmentColor(groupName));

            legendItem.append("text")
                .attr("class", "text label")
                .attr("x", legendRectSize + legendRectTextPadding)
                .attr("y", singleLegendRowHeight / 2) // Vertically center
                .style("font-family", fillStyle.typography.annotation.font_family)
                .style("font-size", fillStyle.typography.annotation.font_size)
                .style("font-weight", fillStyle.typography.annotation.font_weight)
                .style("fill", fillStyle.textColor)
                .style("dominant-baseline", "middle")
                .text(groupName);
            
            currentX += itemWidth;
        });
    });

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const currentDimensionGroup = dimensionGroups[dataIndex];

            const chartCenterX = rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = (r + 0.5) * cellHeight - chartSpacingVertical / 2; // Adjusted Y for spacing

            const smallMultipleGroup = mainChartGroup.append("g")
                .attr("class", "chart-multiple mark-group") // Added mark-group
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const radius = baseRadius; // Use consistent radius

            const pieGenerator = d3.pie()
                .value(d => d[valueFieldName])
                .sort(null);

            const arcGenerator = d3.arc()
                .innerRadius(radius * 0.6)
                .outerRadius(radius * 0.9);

            const pieArcs = pieGenerator(currentDimensionGroup.values);

            smallMultipleGroup.selectAll(".mark.segment")
                .data(pieArcs)
                .enter()
                .append("path")
                .attr("class", "mark segment")
                .attr("d", arcGenerator)
                .attr("fill", d => fillStyle.getSegmentColor(d.data[groupFieldName]))
                .style("stroke", fillStyle.segmentStrokeColor)
                .style("stroke-width", 1.5);

            // Center icon/image
            const imageUrl = fillStyle.getImageUrl(currentDimensionGroup.dimension);
            if (imageUrl) {
                const imageSize = Math.max(24, radius * 0.5);
                const clipId = `clip-donut-center-${dataIndex}`;

                smallMultipleGroup.append("defs").append("clipPath")
                    .attr("id", clipId)
                    .append("circle")
                    .attr("r", imageSize / 2);

                smallMultipleGroup.append("image")
                    .attr("class", "image icon")
                    .attr("xlink:href", imageUrl)
                    .attr("clip-path", `url(#${clipId})`)
                    .attr("x", -imageSize / 2)
                    .attr("y", -imageSize / 2)
                    .attr("width", imageSize)
                    .attr("height", imageSize);
            }
            
            // Data labels for segments
            smallMultipleGroup.selectAll(".label.value")
                .data(pieArcs)
                .enter()
                .append("text")
                .attr("class", "label value")
                .each(function(d) {
                    const segmentArc = d3.select(this);
                    const segmentColor = fillStyle.getSegmentColor(d.data[groupFieldName]);
                    
                    const arcAngle = d.endAngle - d.startAngle;
                    const percent = arcAngle / (2 * Math.PI);
                    const valueText = valueUnit ? `${formatValue(d.data[valueFieldName])}${valueUnit}` : formatValue(d.data[valueFieldName]);
                    
                    segmentArc
                        .style("font-family", fillStyle.typography.annotation.font_family)
                        .style("font-size", `${parseFloat(fillStyle.typography.annotation.font_size) * (percent < 0.03 ? 0.95 : 1.1)}px`)
                        .style("font-weight", fillStyle.typography.annotation.font_weight)
                        .style("pointer-events", "none")
                        .text(valueText);

                    let labelX, labelY, textAnchor;
                    if (percent > 0.07) { // Inside label
                        const centroid = arcGenerator.centroid(d);
                        const angle = (d.startAngle + d.endAngle) / 2;
                        const unitX = Math.sin(angle);
                        const unitY = -Math.cos(angle);
                        labelX = centroid[0] + unitX * (radius * 0.15); // Adjusted for better centering
                        labelY = centroid[1] + unitY * (radius * 0.15);
                        textAnchor = "middle";
                        segmentArc.style("fill", getContrastColor(segmentColor));
                    } else { // Outside label
                        const centroid = arcGenerator.centroid(d);
                        const angle = (d.startAngle + d.endAngle) / 2;
                        const unitX = Math.sin(angle);
                        const unitY = -Math.cos(angle);
                        labelX = centroid[0] + unitX * (radius * 0.6 + 8); // Adjusted for better placement
                        labelY = centroid[1] + unitY * (radius * 0.6 + 8);
                        textAnchor = angle > Math.PI ? "end" : "start";
                        segmentArc.style("fill", fillStyle.textColor);
                    }
                    segmentArc.attr("transform", `translate(${labelX}, ${labelY})`)
                              .attr("text-anchor", textAnchor)
                              .style("dominant-baseline", "middle");
                });

            // Dimension label (above donut)
            smallMultipleGroup.append("text")
                .attr("class", "label title") // Using "title" for semantic role of this label
                .attr("x", 0)
                .attr("y", -radius - 10)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.label.font_family)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.label.font_weight)
                .style("fill", fillStyle.textColor)
                .text(currentDimensionGroup.dimension + (dimensionUnit ? ` (${dimensionUnit})` : ''));

            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // None for this chart based on requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}