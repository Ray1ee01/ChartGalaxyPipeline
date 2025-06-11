/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Donut Chart",
  "chart_name": "multiple_donut_chart_04",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["x", "group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 10], [0, "inf"], [2, 10]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "dark",

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
    // The REQUIREMENTS_BEGIN...END block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors_dark || data.colors || {}; // Prioritize dark theme colors if available
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    const valueFieldUnit = dataColumns.find(col => col.role === "y")?.unit !== "none" ? dataColumns.find(col => col.role === "y").unit : "";

    if (!dimensionField || !valueField || !groupField) {
        const missingFields = [];
        if (!dimensionField) missingFields.push("x role field");
        if (!valueField) missingFields.push("y role field");
        if (!groupField) missingFields.push("group role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            title: {
                font_family: (rawTypography.title && rawTypography.title.font_family) || "Arial, sans-serif",
                font_size: (rawTypography.title && rawTypography.title.font_size) || "16px",
                font_weight: (rawTypography.title && rawTypography.title.font_weight) || "bold",
            },
            label: {
                font_family: (rawTypography.label && rawTypography.label.font_family) || "Arial, sans-serif",
                font_size: (rawTypography.label && rawTypography.label.font_size) || "12px",
                font_weight: (rawTypography.label && rawTypography.label.font_weight) || "normal",
            },
            annotation: {
                font_family: (rawTypography.annotation && rawTypography.annotation.font_family) || "Arial, sans-serif",
                font_size: (rawTypography.annotation && rawTypography.annotation.font_size) || "10px",
                font_weight: (rawTypography.annotation && rawTypography.annotation.font_weight) || "normal",
            }
        },
        textColor: rawColors.text_color || '#E0E0E0', // Default for dark theme
        chartBackground: rawColors.background_color || '#1A1A1A', // Default for dark theme
        primaryColor: (rawColors.other && rawColors.other.primary) || '#3498db',
        defaultSliceColor: (rawColors.other && rawColors.other.primary) || '#3498db',
        categoricalColors: rawColors.available_colors || d3.schemeCategory10
    };

    fillStyle.getSliceColor = (groupName, index) => {
        if (rawColors.field && rawColors.field[groupName]) {
            return rawColors.field[groupName];
        }
        return fillStyle.categoricalColors[index % fillStyle.categoricalColors.length];
    };

    fillStyle.getImageUrl = (dimensionName) => {
        if (rawImages.field && rawImages.field[dimensionName]) {
            return rawImages.field[dimensionName];
        }
        if (rawImages.other && rawImages.other.primary) {
            return rawImages.other.primary;
        }
        return null;
    };
    
    function measureText(text, fontProps) {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        d3.select(tempSvgNode)
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('width', 'auto')
            .style('height', 'auto');
        
        const tempText = d3.select(tempSvgNode).append('text')
            .style('font-family', fontProps.font_family)
            .style('font-size', fontProps.font_size)
            .style('font-weight', fontProps.font_weight)
            .text(text);
        
        const bbox = tempText.node().getBBox();
        // tempSvgNode.remove(); // Not needed as it's not in DOM
        return bbox;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return `${d3.format("~.2s")(value / 1000000000)}B`;
        if (value >= 1000000) return `${d3.format("~.2s")(value / 1000000)}M`;
        if (value >= 1000) return `${d3.format("~.2s")(value / 1000)}K`;
        return d3.format("~g")(value);
    };

    const getContrastingTextColor = (hexColor) => {
        if (!hexColor || typeof hexColor !== 'string') return fillStyle.textColor; // fallback
        hexColor = hexColor.replace("#", "");
        if (hexColor.length === 3) {
            hexColor = hexColor.split("").map(char => char + char).join("");
        }
        if (hexColor.length !== 6) return fillStyle.textColor; // fallback for invalid hex

        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        return brightness > 130 ? "#333333" : "#FFFFFF";
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = { top: 20, right: 40, bottom: 40, left: 40 }; // Initial margins

    // Legend metrics calculation (before finalizing margins)
    const allGroupNames = Array.from(new Set(rawChartData.map(d => d[groupField]))).sort();
    let legendHeight = 0;
    if (allGroupNames.length > 0) {
        const legendRectSize = 15;
        const legendRectTextPadding = 5;
        const legendItemPadding = 15;
        const legendRowSpacing = 12;
        const legendTopMargin = 10;
        const legendBottomMargin = 10;
        
        const legendTextFontProps = fillStyle.typography.annotation;
        const legendTextWidths = {};
        let legendTextMaxHeight = 0;

        allGroupNames.forEach(groupName => {
            const bbox = measureText(groupName, legendTextFontProps);
            legendTextWidths[groupName] = bbox.width;
            legendTextMaxHeight = Math.max(legendTextMaxHeight, bbox.height);
        });

        const singleRowHeight = Math.max(legendTextMaxHeight, legendRectSize);
        const legendItemWidths = allGroupNames.map(groupName => 
            legendRectSize + legendRectTextPadding + legendTextWidths[groupName] + legendItemPadding
        );
        
        const legendMaxWidth = containerWidth - chartMargins.left - chartMargins.right;
        const legendRowsData = [];
        let currentRow = [];
        let currentRowWidth = 0;

        legendItemWidths.forEach((itemWidth, index) => {
            if (currentRow.length === 0 || currentRowWidth + itemWidth <= legendMaxWidth) {
                currentRow.push(index);
                currentRowWidth += itemWidth;
            } else {
                legendRowsData.push(currentRow);
                currentRow = [index];
                currentRowWidth = itemWidth;
            }
        });
        if (currentRow.length > 0) legendRowsData.push(currentRow);

        legendHeight = legendRowsData.length * singleRowHeight + 
                       (legendRowsData.length > 1 ? (legendRowsData.length - 1) * legendRowSpacing : 0) + 
                       legendTopMargin + legendBottomMargin;
        
        chartMargins.top = legendHeight + 20; // Adjust top margin for legend
    }
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const groupedByDimension = d3.group(rawChartData, d => d[dimensionField]);
    const dimensionGroups = Array.from(groupedByDimension, ([key, values]) => {
        const total = d3.sum(values, d => d[valueField]);
        return { dimension: key, values, total };
    }).sort((a, b) => String(a.dimension).localeCompare(String(b.dimension)));

    // Grid layout calculation
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
    
    // Radius calculation, considering space for dimension label above
    const dimensionLabelHeightApproximation = parseFloat(fillStyle.typography.label.font_size) * 1.5; // Approx height for label
    const donutRadius = Math.min(innerCellWidth / 2, (innerCellHeight - dimensionLabelHeightApproximation) / 2) * 0.9; // Slightly smaller for padding

    // Block 6: Scale Definition & Configuration
    const pieGenerator = d3.pie()
        .value(d => d[valueField])
        .sort(null)
        .padAngle(0.015); // Slightly increased padding

    const arcGenerator = d3.arc()
        .innerRadius(donutRadius * 0.6)
        .outerRadius(donutRadius * 0.9);

    // Block 7: Chart Component Rendering (Legend)
    if (allGroupNames.length > 0) {
        const legendRectSize = 15;
        const legendRectTextPadding = 5;
        const legendItemPadding = 15; // Horizontal padding between items
        const legendRowSpacing = 12;
        const legendTopMargin = 10;

        const legendTextFontProps = fillStyle.typography.annotation;
        const legendTextWidths = {};
        let legendTextMaxHeight = 0;
        allGroupNames.forEach(groupName => {
            const bbox = measureText(groupName, legendTextFontProps);
            legendTextWidths[groupName] = bbox.width;
            legendTextMaxHeight = Math.max(legendTextMaxHeight, bbox.height);
        });
        const singleRowHeight = Math.max(legendTextMaxHeight, legendRectSize);
        const legendItemWidths = allGroupNames.map(groupName => 
            legendRectSize + legendRectTextPadding + legendTextWidths[groupName] + legendItemPadding
        );
        
        const legendMaxWidth = containerWidth - chartMargins.left - chartMargins.right;
        const legendRowsData = [];
        let currentRow = [];
        let currentRowWidth = 0;
        legendItemWidths.forEach((itemWidth, index) => {
            if (currentRow.length === 0 || currentRowWidth + itemWidth <= legendMaxWidth) {
                currentRow.push(index);
                currentRowWidth += itemWidth;
            } else {
                legendRowsData.push(currentRow);
                currentRow = [index];
                currentRowWidth = itemWidth;
            }
        });
        if (currentRow.length > 0) legendRowsData.push(currentRow);

        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${chartMargins.left}, ${legendTopMargin})`);

        legendRowsData.forEach((rowIndices, rowIndex) => {
            const rowY = rowIndex * (singleRowHeight + legendRowSpacing);
            const rowTotalWidth = rowIndices.reduce((sum, itemIndex) => sum + legendItemWidths[itemIndex], 0) - legendItemPadding; // Adjust for last item
            const rowStartX = (innerWidth - rowTotalWidth) / 2; // Center row within innerWidth
            
            let currentX = rowStartX;
            rowIndices.forEach(itemIndex => {
                const groupName = allGroupNames[itemIndex];
                const legendItem = legendGroup.append("g")
                    .attr("class", "legend-item")
                    .attr("transform", `translate(${currentX}, ${rowY})`);

                legendItem.append("circle")
                    .attr("class", "mark")
                    .attr("cx", legendRectSize / 2)
                    .attr("cy", singleRowHeight / 2 - legendRectSize / 2 + legendRectSize / 2) // Align with text baseline
                    .attr("r", legendRectSize / 2)
                    .attr("fill", fillStyle.getSliceColor(groupName, allGroupNames.indexOf(groupName)));

                legendItem.append("text")
                    .attr("class", "label")
                    .attr("x", legendRectSize + legendRectTextPadding)
                    .attr("y", singleRowHeight / 2)
                    .style("font-family", legendTextFontProps.font_family)
                    .style("font-size", legendTextFontProps.font_size)
                    .style("font-weight", legendTextFontProps.font_weight)
                    .style("fill", fillStyle.textColor)
                    .style("dominant-baseline", "middle")
                    .text(groupName);
                
                currentX += legendItemWidths[itemIndex];
            });
        });
    }

    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const chartDataGroup = dimensionGroups[dataIndex];

            const chartCenterX = chartMargins.left + rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (r + 0.5) * cellHeight;

            const singleChartGroup = svgRoot.append("g")
                .attr("class", "chart-group mark")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const pieArcs = pieGenerator(chartDataGroup.values);

            singleChartGroup.selectAll("path.slice")
                .data(pieArcs)
                .enter()
                .append("path")
                .attr("class", "mark value slice")
                .attr("d", arcGenerator)
                .attr("fill", d => fillStyle.getSliceColor(d.data[groupField], allGroupNames.indexOf(d.data[groupField])));

            // Center image
            const imageUrl = fillStyle.getImageUrl(chartDataGroup.dimension);
            if (imageUrl) {
                const imageSize = donutRadius * 0.8; // Image size relative to inner hole
                const clipId = `clip-center-${dataIndex}`;
                
                singleChartGroup.append("defs").append("clipPath")
                    .attr("id", clipId)
                    .append("circle")
                    .attr("r", imageSize / 2);

                singleChartGroup.append("image")
                    .attr("class", "image icon")
                    .attr("xlink:href", imageUrl)
                    .attr("clip-path", `url(#${clipId})`)
                    .attr("x", -imageSize / 2)
                    .attr("y", -imageSize / 2)
                    .attr("width", imageSize)
                    .attr("height", imageSize);
            }

            // Slice labels
            singleChartGroup.selectAll("text.slice-label")
                .data(pieArcs)
                .enter()
                .append("text")
                .attr("class", "label value-label slice-label")
                .each(function(d) {
                    const thisLabel = d3.select(this);
                    const arcAngle = d.endAngle - d.startAngle;
                    const percent = arcAngle / (2 * Math.PI);
                    const valueText = valueFieldUnit ? `${formatValue(d.data[valueField])} ${valueFieldUnit}` : formatValue(d.data[valueField]);
                    
                    thisLabel.style("font-family", fillStyle.typography.annotation.font_family)
                             .style("font-weight", fillStyle.typography.annotation.font_weight)
                             .style("pointer-events", "none")
                             .text(valueText);

                    if (percent > 0.07) { // Label inside for larger slices
                        const centroid = arcGenerator.centroid(d);
                        thisLabel.attr("x", centroid[0])
                                 .attr("y", centroid[1])
                                 .attr("text-anchor", "middle")
                                 .style("dominant-baseline", "middle")
                                 .style("font-size", fillStyle.typography.annotation.font_size)
                                 .style("fill", getContrastingTextColor(fillStyle.getSliceColor(d.data[groupField], allGroupNames.indexOf(d.data[groupField]))));
                    } else if (percent > 0.01) { // Label outside for smaller slices, if space
                        const labelArc = d3.arc().innerRadius(donutRadius * 1.05).outerRadius(donutRadius * 1.05);
                        const [lx, ly] = labelArc.centroid(d);
                        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                        thisLabel.attr("x", lx)
                                 .attr("y", ly)
                                 .attr("text-anchor", midAngle < Math.PI ? "start" : "end")
                                 .style("dominant-baseline", "middle")
                                 .style("font-size", `calc(${fillStyle.typography.annotation.font_size} * 0.9)`)
                                 .style("fill", fillStyle.textColor);
                    } // Very small slices: no label
                });

            // Dimension label
            let dimensionLabelText = chartDataGroup.dimension;
            const labelFontProps = fillStyle.typography.label;
            let adjustedLabelFontSize = labelFontProps.font_size;
            
            // Adjust font size if dimension label is too wide for the donut area
            const maxLabelWidth = donutRadius * 2 * 0.9; // 90% of donut diameter
            let textMetrics = measureText(dimensionLabelText, {...labelFontProps, font_size: adjustedLabelFontSize});

            if (textMetrics.width > maxLabelWidth) {
                const scaleFactor = maxLabelWidth / textMetrics.width;
                adjustedLabelFontSize = `${Math.floor(parseFloat(labelFontProps.font_size) * scaleFactor)}px`;
                // Optional: Truncate text if still too long after font reduction (not implemented here to keep it simpler)
            }
            
            singleChartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -donutRadius - (parseFloat(adjustedLabelFontSize) * 0.5)) // Position above donut
                .attr("text-anchor", "middle")
                .style("font-family", labelFontProps.font_family)
                .style("font-size", adjustedLabelFontSize)
                .style("font-weight", labelFontProps.font_weight)
                .style("fill", fillStyle.textColor)
                .text(dimensionLabelText);

            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // (Font size adjustment for dimension labels is handled in Block 8)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}