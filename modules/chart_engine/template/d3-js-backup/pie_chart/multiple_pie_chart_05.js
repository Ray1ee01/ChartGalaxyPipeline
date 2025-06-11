/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Pie Chart",
  "chart_name": "multiple_pie_chart_05",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 10], [0, "inf"], [2, 10]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
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
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    const images = data.images || {}; // Though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const dimensionField = dimensionFieldConfig?.name;
    const valueField = valueFieldConfig?.name;
    const groupField = groupFieldConfig?.name;

    let missingFields = [];
    if (!dimensionField) missingFields.push("x role (dimensionField)");
    if (!valueField) missingFields.push("y role (valueField)");
    if (!groupField) missingFields.push("group role (groupField)");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionUnit = dimensionFieldConfig?.unit !== "none" ? dimensionFieldConfig.unit : "";
    const valueUnit = valueFieldConfig?.unit !== "none" ? valueFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: rawTypography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: rawTypography.label?.font_size || '12px',
            labelFontWeight: rawTypography.label?.font_weight || 'normal',
            annotationFontFamily: rawTypography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: rawTypography.annotation?.font_size || '10px',
            annotationFontWeight: rawTypography.annotation?.font_weight || 'normal',
        },
        textColor: rawColors.text_color || '#0f223b',
        chartBackground: rawColors.background_color || '#FFFFFF',
        primaryColor: rawColors.other?.primary || '#1f77b4',
        defaultSliceColor: '#CCCCCC',
        getSliceColor: (groupValue) => {
            if (rawColors.field && rawColors.field[groupValue]) {
                return rawColors.field[groupValue];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                // Simple hash function to pick a color consistently
                let hash = 0;
                for (let i = 0; i < groupValue.length; i++) {
                    hash = groupValue.charCodeAt(i) + ((hash << 5) - hash);
                }
                return rawColors.available_colors[Math.abs(hash) % rawColors.available_colors.length];
            }
            return fillStyle.defaultSliceColor;
        }
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.position = 'absolute';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        document.body.appendChild(tempSvg); // Needs to be in DOM for getBBox to work reliably cross-browser
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    }
    
    function estimateTextHeight(fontProps) { // Simplified: assumes single line height
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.position = 'absolute';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = 'Tg'; // Sample text for height
        tempSvg.appendChild(tempText);
        document.body.appendChild(tempSvg);
        const height = tempText.getBBox().height;
        document.body.removeChild(tempSvg);
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
            return fillStyle.textColor; // Use configured text color for light backgrounds
        }
        hexColor = hexColor.replace("#", "");
        if (hexColor.length === 3) {
            hexColor = hexColor.split("").map(char => char + char).join("");
        }
        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        return brightness > 130 ? fillStyle.textColor : '#FFFFFF'; // Use configured or pure white
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

    // Legend Height Calculation (early, as it affects top margin)
    const allGroupsForLegend = Array.from(new Set(chartData.map(d => d[groupField])));
    let actualLegendHeight = 0;
    if (allGroupsForLegend.length > 0) {
        const legendRectSize = 15;
        const legendRectTextPadding = 5;
        const legendItemPadding = 15;
        const legendRowSpacing = 10;
        const legendTopMargin = 10;
        const legendBottomMargin = 10;

        const legendFontProps = {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        };
        
        const legendTextHeight = estimateTextHeight(legendFontProps);
        const singleRowHeight = Math.max(legendTextHeight, legendRectSize);
        
        const legendItemWidths = allGroupsForLegend.map(group =>
            legendRectSize + legendRectTextPadding + estimateTextWidth(group, legendFontProps) + legendItemPadding
        );

        const legendMaxWidth = containerWidth - chartMargins.left - chartMargins.right;
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
        if (currentRow.length > 0) legendRows.push(currentRow);

        actualLegendHeight = legendRows.length * singleRowHeight +
                             (legendRows.length > 0 ? (legendRows.length - 1) * legendRowSpacing : 0) +
                             legendTopMargin + legendBottomMargin;
        chartMargins.top = actualLegendHeight + 20; // Add some padding below legend
    }
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const groupedByDimension = d3.group(chartData, d => d[dimensionField]);
    const dimensionGroups = Array.from(groupedByDimension, ([key, values]) => {
        const total = d3.sum(values, d => d[valueField]);
        return { dimension: key, values, total };
    }).sort((a, b) => String(a.dimension).localeCompare(String(b.dimension)));

    // Grid layout calculation for multiple pies
    const numCharts = dimensionGroups.length;
    if (numCharts === 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No data to display.");
        return svgRoot.node();
    }

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

    const innerCellWidth = cellWidth - chartSpacingHorizontal;
    const innerCellHeight = cellHeight - chartSpacingVertical;
    
    // Radius calculation considers space for dimension label above pie
    const dimensionLabelFontProps = {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    };
    const dimensionLabelHeight = estimateTextHeight(dimensionLabelFontProps) + 10; // 10 for padding
    const pieChartRadius = Math.min(innerCellWidth / 2, (innerCellHeight - dimensionLabelHeight) / 2) * 0.95;


    // Adjust dimension label font size if too wide for pie area
    let maxDimensionWidth = 0;
    dimensionGroups.forEach(group => {
        const width = estimateTextWidth(group.dimension, dimensionLabelFontProps);
        if (width > maxDimensionWidth) maxDimensionWidth = width;
    });
    
    const maxChartAreaForLabel = pieChartRadius * 2.2; // Max width for label above pie
    let dimensionScaleFactor = 1;
    if (maxDimensionWidth > maxChartAreaForLabel && maxDimensionWidth > 0) {
        dimensionScaleFactor = maxChartAreaForLabel / maxDimensionWidth;
    }
    const adjustedDimensionFontSize = `${Math.max(8, Math.floor(parseFloat(fillStyle.typography.labelFontSize) * dimensionScaleFactor))}px`;


    // Block 6: Scale Definition & Configuration
    // Pie and Arc generators are defined in Block 8 as they are specific to each pie.
    // Color scale logic is within fillStyle.getSliceColor.

    // Block 7: Chart Component Rendering (Legend)
    if (allGroupsForLegend.length > 0) {
        const legendRectSize = 15;
        const legendRectTextPadding = 5;
        const legendItemPadding = 15; // Horizontal padding between items
        const legendRowSpacing = 10;   // Vertical padding between rows
        const legendTopActualMargin = 10; // Margin from the very top of SVG to legend block

        const legendFontProps = {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        };
        const legendTextHeight = estimateTextHeight(legendFontProps);
        const singleRowHeight = Math.max(legendTextHeight, legendRectSize);

        const legendItemWidths = allGroupsForLegend.map(group =>
            legendRectSize + legendRectTextPadding + estimateTextWidth(group, legendFontProps) + legendItemPadding
        );
        
        const legendContainerWidth = containerWidth - chartMargins.left - chartMargins.right;

        const legendRowsData = [];
        let currentRowItems = [];
        let currentRowTotalWidth = 0;

        allGroupsForLegend.forEach((group, index) => {
            const itemWidth = legendItemWidths[index];
            if (currentRowItems.length === 0 || (currentRowTotalWidth + itemWidth) <= legendContainerWidth) {
                currentRowItems.push({ group, width: itemWidth });
                currentRowTotalWidth += itemWidth;
            } else {
                legendRowsData.push({ items: currentRowItems, totalWidth: currentRowTotalWidth });
                currentRowItems = [{ group, width: itemWidth }];
                currentRowTotalWidth = itemWidth;
            }
        });
        if (currentRowItems.length > 0) {
            legendRowsData.push({ items: currentRowItems, totalWidth: currentRowTotalWidth });
        }
        
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${chartMargins.left}, ${legendTopActualMargin})`);

        let currentY = 0;
        legendRowsData.forEach(rowData => {
            const rowStartX = (legendContainerWidth - rowData.totalWidth) / 2; // Center each row
            let currentX = rowStartX;
            rowData.items.forEach(item => {
                const legendItem = legendGroup.append("g")
                    .attr("class", "legend-item")
                    .attr("transform", `translate(${currentX}, ${currentY})`);

                legendItem.append("circle")
                    .attr("cx", legendRectSize / 2)
                    .attr("cy", singleRowHeight / 2) // Vertically center circle in row
                    .attr("r", legendRectSize / 2)
                    .attr("fill", fillStyle.getSliceColor(item.group))
                    .attr("class", "mark");

                legendItem.append("text")
                    .attr("x", legendRectSize + legendRectTextPadding)
                    .attr("y", singleRowHeight / 2) // Vertically center text
                    .style("font-family", legendFontProps.fontFamily)
                    .style("font-size", legendFontProps.fontSize)
                    .style("font-weight", legendFontProps.fontWeight)
                    .style("fill", fillStyle.textColor)
                    .style("dominant-baseline", "middle")
                    .attr("class", "label")
                    .text(item.group);
                
                currentX += item.width;
            });
            currentY += singleRowHeight + legendRowSpacing;
        });
    }


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
            const currentPieDataGroup = dimensionGroups[dataIndex];

            const chartCenterX = rowOffset + (c * cellWidth) + (cellWidth / 2);
            const chartCenterY = (r * cellHeight) + (cellHeight / 2);

            const pieChartContainer = mainChartGroup.append("g")
                .attr("class", "other pie-chart-container")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const pieGenerator = d3.pie()
                .value(d => d[valueField])
                .sort(null);

            const arcGenerator = d3.arc()
                .innerRadius(0)
                .outerRadius(pieChartRadius);

            const labelArcGenerator = d3.arc() // For positioning labels
                .innerRadius(pieChartRadius * 0.6)
                .outerRadius(pieChartRadius * 1.1);


            const arcs = pieGenerator(currentPieDataGroup.values);

            pieChartContainer.selectAll(".pie-slice")
                .data(arcs)
                .enter()
                .append("path")
                .attr("class", "mark value pie-slice")
                .attr("d", arcGenerator)
                .attr("fill", d => fillStyle.getSliceColor(d.data[groupField]));

            // Data labels on slices
            pieChartContainer.selectAll(".pie-data-label")
                .data(arcs)
                .enter()
                .append("text")
                .attr("class", "label value-label pie-data-label")
                .each(function(d) {
                    const thisLabel = d3.select(this);
                    const sliceColor = fillStyle.getSliceColor(d.data[groupField]);
                    const labelTextColor = getContrastColor(sliceColor);
                    const arcAngle = d.endAngle - d.startAngle;
                    const percentage = arcAngle / (2 * Math.PI);
                    
                    let labelText = formatValue(d.data[valueField]);
                    if (valueUnit) labelText += ` ${valueUnit}`;

                    thisLabel
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", fillStyle.typography.annotationFontSize)
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .style("fill", labelTextColor)
                        .style("pointer-events", "none")
                        .text(labelText);
                    
                    const textBBox = thisLabel.node().getBBox();

                    if (percentage > 0.07 && textBBox.width < pieChartRadius * 0.8) { // Label inside if slice is big enough and text fits
                        const centroid = arcGenerator.centroid(d);
                        thisLabel
                            .attr("transform", `translate(${centroid[0]}, ${centroid[1]})`)
                            .attr("text-anchor", "middle")
                            .style("dominant-baseline", "middle");
                    } else { // Label outside
                        const pos = labelArcGenerator.centroid(d);
                        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                        pos[0] = pieChartRadius * 1.05 * (midAngle < Math.PI || midAngle > 2 * Math.PI ? 1 : -1);
                        
                        thisLabel
                            .attr("transform", `translate(${pos[0]}, ${pos[1]})`)
                            .attr("text-anchor", (midAngle < Math.PI || midAngle > 2 * Math.PI ? "start" : "end"))
                            .style("dominant-baseline", "middle")
                            .style("fill", fillStyle.textColor); // Ensure outside labels are readable against background
                        
                        // Optional: Add a line from slice to label for small slices
                        // This can get complex and cluttered, so omitted for simplicity here.
                    }
                });

            // Dimension label for this pie
            pieChartContainer.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -pieChartRadius - (dimensionLabelHeight * 0.3)) // Position above pie
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(currentPieDataGroup.dimension + (dimensionUnit ? ` (${dimensionUnit})` : ''));

            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // None in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}