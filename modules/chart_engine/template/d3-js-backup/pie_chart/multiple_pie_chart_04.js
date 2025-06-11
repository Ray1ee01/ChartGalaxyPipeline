/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Pie Chart",
  "chart_name": "multiple_pie_chart_04",
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    // const rawImages = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const groupFieldName = dataColumns.find(col => col.role === "group")?.name;

    const valueFieldUnit = dataColumns.find(col => col.role === "y")?.unit !== "none" ?
                           dataColumns.find(col => col.role === "y").unit : "";

    const criticalFields = { dimensionFieldName, valueFieldName, groupFieldName };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Filter out data points with missing critical fields if necessary, or rely on D3 to handle them.
    // For this refactoring, assume valid data points after field name validation.
    const chartDataArray = rawChartData.filter(d =>
        d[dimensionFieldName] !== undefined &&
        d[valueFieldName] !== undefined && typeof d[valueFieldName] === 'number' &&
        d[groupFieldName] !== undefined
    );
    
    if (chartDataArray.length === 0) {
        const errorMessage = "No valid data to render after filtering.";
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography
    fillStyle.typography.labelFontFamily = rawTypography.label?.font_family || "Arial, sans-serif";
    fillStyle.typography.labelFontSize = rawTypography.label?.font_size || "12px";
    fillStyle.typography.labelFontWeight = rawTypography.label?.font_weight || "normal";

    fillStyle.typography.annotationFontFamily = rawTypography.annotation?.font_family || "Arial, sans-serif";
    fillStyle.typography.annotationFontSize = rawTypography.annotation?.font_size || "10px";
    fillStyle.typography.annotationFontWeight = rawTypography.annotation?.font_weight || "normal";
    
    // Colors
    fillStyle.colors.textColor = rawColors.text_color || "#0f223b";
    fillStyle.colors.chartBackground = rawColors.background_color || "#FFFFFF"; // Not directly used on SVG, but good practice
    fillStyle.colors.sliceStrokeColor = "#FFFFFF"; // Standard for pie charts
    fillStyle.colors.defaultSliceColor = (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : (rawColors.available_colors && rawColors.available_colors.length > 0 ? rawColors.available_colors[0] : "#1f77b4");
    
    const d3CategoryColors = d3.schemeCategory10;
    let colorIndex = 0;
    const assignedGroupColors = {};

    function getSliceColor(groupName) {
        if (rawColors.field && rawColors.field[groupName]) {
            return rawColors.field[groupName];
        }
        if (assignedGroupColors[groupName]) {
            return assignedGroupColors[groupName];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            const color = rawColors.available_colors[colorIndex % rawColors.available_colors.length];
            assignedGroupColors[groupName] = color;
            colorIndex++;
            return color;
        }
        // Fallback to d3.schemeCategory10 if available_colors is not provided
        const color = d3CategoryColors[colorIndex % d3CategoryColors.length];
        assignedGroupColors[groupName] = color;
        colorIndex++;
        return color;
    }
    
    // Helper: In-memory text dimension estimation
    function estimateTextDimensions(text, fontFamily, fontSize, fontWeight) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const textElement = document.createElementNS(svgNS, 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // Note: getBBox on an un-rendered SVG element might be unreliable in some environments.
        // The prompt strictly forbids appending to DOM.
        let bbox = { width: 0, height: 0, x: 0, y: 0 };
        try {
            bbox = textElement.getBBox();
        } catch (e) {
            // console.warn("estimateTextDimensions getBBox failed:", e);
            const numFontSize = parseFloat(fontSize) || 10;
            bbox.width = text.length * numFontSize * 0.6; // Approximation
            bbox.height = numFontSize * 1.2; // Approximation
        }
        return { width: bbox.width, height: bbox.height };
    }

    // Helper: Format numeric values
    const formatValue = (value) => {
        if (value === 0) return "0";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B');
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~.2g")(value); // Use .2g for smaller numbers to avoid excessive precision
    };

    // Helper: Get contrasting color for text on a colored background
    const getContrastColor = (hexColor) => {
        if (!hexColor || typeof hexColor !== 'string') return '#000000';
        hexColor = hexColor.replace("#", "");
        if (hexColor.length === 3) {
            hexColor = hexColor.split("").map(char => char + char).join("");
        }
        if (hexColor.length !== 6) return '#000000'; // Invalid hex

        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        return brightness > 130 ? "#333333" : "#FFFFFF";
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.colors.chartBackground); // Optional: set background

    // No defs needed as complex effects like shadows are removed.

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 40, bottom: 40, left: 40 }; // Initial margins

    // Legend layout calculation (dynamic part of margins)
    const allGroupNames = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort();
    
    const legendRectSize = 15;
    const legendRectTextPadding = 5;
    const legendItemPadding = 15;
    const legendRowSpacing = 10;
    const legendTopMargin = 15;
    const legendBottomMargin = 15;

    let maxLegendItemHeight = 0;
    const legendItemsMetrics = allGroupNames.map(groupName => {
        const textMetrics = estimateTextDimensions(groupName,
            fillStyle.typography.annotationFontFamily,
            fillStyle.typography.annotationFontSize,
            fillStyle.typography.annotationFontWeight
        );
        maxLegendItemHeight = Math.max(maxLegendItemHeight, textMetrics.height, legendRectSize);
        return {
            name: groupName,
            textWidth: textMetrics.width,
            itemWidth: legendRectSize + legendRectTextPadding + textMetrics.width + legendItemPadding
        };
    });
    
    const legendAvailableWidth = containerWidth - chartMargins.left - chartMargins.right;
    const legendRowsLayout = [];
    let currentLegendRow = [];
    let currentLegendRowWidth = 0;

    legendItemsMetrics.forEach(item => {
        if (currentLegendRow.length === 0 || (currentLegendRowWidth + item.itemWidth <= legendAvailableWidth)) {
            currentLegendRow.push(item);
            currentLegendRowWidth += item.itemWidth;
        } else {
            legendRowsLayout.push({ items: currentLegendRow, width: currentLegendRowWidth - legendItemPadding }); // Adjust width
            currentLegendRow = [item];
            currentLegendRowWidth = item.itemWidth;
        }
    });
    if (currentLegendRow.length > 0) {
        legendRowsLayout.push({ items: currentLegendRow, width: currentLegendRowWidth - legendItemPadding }); // Adjust width
    }
    
    const legendHeight = legendRowsLayout.length * maxLegendItemHeight +
                         (legendRowsLayout.length > 0 ? (legendRowsLayout.length - 1) * legendRowSpacing : 0) +
                         legendTopMargin + legendBottomMargin;

    chartMargins.top = legendHeight > (legendTopMargin + legendBottomMargin) ? legendHeight : chartMargins.top;


    // Block 5: Data Preprocessing & Transformation
    const groupedByDimension = d3.group(chartDataArray, d => d[dimensionFieldName]);
    const dimensionGroups = Array.from(groupedByDimension, ([key, values]) => {
        return { dimension: key, values: values, total: d3.sum(values, d => d[valueFieldName]) };
    }).sort((a, b) => a.dimension.localeCompare(b.dimension)); // Sort for consistent order

    // Block 6: Scale Definition & Configuration
    // No explicit X/Y scales. Color scale logic is in getSliceColor.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    if (allGroupNames.length > 0 && legendHeight > 0) {
        const legendContainer = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${chartMargins.left}, ${legendTopMargin})`);

        let yOffset = 0;
        legendRowsLayout.forEach(rowInfo => {
            const rowStartX = (legendAvailableWidth - rowInfo.width) / 2; // Center each row
            let xOffset = rowStartX;
            rowInfo.items.forEach(item => {
                const legendItem = legendContainer.append("g")
                    .attr("class", "legend-item")
                    .attr("transform", `translate(${xOffset}, ${yOffset})`);

                legendItem.append("circle")
                    .attr("class", "mark legend-swatch")
                    .attr("cx", legendRectSize / 2)
                    .attr("cy", maxLegendItemHeight / 2)
                    .attr("r", legendRectSize / 2)
                    .style("fill", getSliceColor(item.name));

                legendItem.append("text")
                    .attr("class", "label legend-label")
                    .attr("x", legendRectSize + legendRectTextPadding)
                    .attr("y", maxLegendItemHeight / 2)
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.colors.textColor)
                    .style("dominant-baseline", "middle")
                    .text(item.name);
                xOffset += item.itemWidth;
            });
            yOffset += maxLegendItemHeight + legendRowSpacing;
        });
    }
    
    // Block 8: Main Data Visualization Rendering
    const numCharts = dimensionGroups.length;
    if (numCharts === 0) {
         d3.select(containerSelector).html("<div style='color:orange; font-family: sans-serif;'>No data groups to render pies for.</div>");
         return null; // Or an empty SVG
    }

    let gridRows, gridCols;
    if (numCharts <= 3) { gridRows = 1; gridCols = numCharts; }
    else if (numCharts === 4) { gridRows = 2; gridCols = 2; }
    else if (numCharts <= 6) { gridRows = 2; gridCols = 3; }
    else if (numCharts <= 9) { gridRows = 3; gridCols = 3; }
    else {
        gridRows = Math.min(4, Math.ceil(Math.sqrt(numCharts)));
        gridCols = Math.ceil(numCharts / gridRows);
    }

    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const cellWidth = chartAreaWidth / gridCols;
    const cellHeight = chartAreaHeight / gridRows;

    const pieRadiusPaddingFactor = 0.15; // Space around pie within its cell part
    const pieRadius = Math.min(cellWidth * (1 - pieRadiusPaddingFactor) / 2, cellHeight * (1 - pieRadiusPaddingFactor) / 2.2); // Adjusted for label space
    
    // Font size adjustment for dimension labels
    let maxDimensionLabelWidth = 0;
    dimensionGroups.forEach(group => {
        const metrics = estimateTextDimensions(group.dimension, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, metrics.width);
    });

    const maxAllowedDimensionLabelWidth = pieRadius * 2.2;
    let dimensionLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
    if (maxDimensionLabelWidth > maxAllowedDimensionLabelWidth && maxDimensionLabelWidth > 0) {
        dimensionLabelFontSize = dimensionLabelFontSize * (maxAllowedDimensionLabelWidth / maxDimensionLabelWidth);
    }
    const adjustedDimensionLabelFontSize = `${Math.max(8, Math.floor(dimensionLabelFontSize))}px`; // Min font size 8px


    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-content")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    let dataIndex = 0;
    for (let r = 0; r < gridRows; r++) {
        const itemsInThisRow = (r === gridRows - 1) ? (numCharts - dataIndex) : gridCols;
        if (itemsInThisRow <= 0) break;
        const rowOffset = (gridCols - itemsInThisRow) * cellWidth / 2; // Center last row if not full

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const currentGroupData = dimensionGroups[dataIndex];

            const chartCenterX = rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = (r + 0.5) * cellHeight;

            const pieChartGroup = mainChartGroup.append("g")
                .attr("class", "mark pie-chart-group")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const pieGenerator = d3.pie()
                .value(d => d[valueFieldName])
                .sort(null); // Keep original data order for slices

            const arcGenerator = d3.arc()
                .innerRadius(0) // Solid pie
                .outerRadius(pieRadius * 0.9); // Slightly smaller radius for pie itself

            const pieSliceData = pieGenerator(currentGroupData.values);

            pieChartGroup.selectAll(".pie-slice")
                .data(pieSliceData)
                .enter()
                .append("path")
                .attr("class", "mark pie-slice")
                .attr("d", arcGenerator)
                .style("fill", d => getSliceColor(d.data[groupFieldName]))
                .style("stroke", fillStyle.colors.sliceStrokeColor)
                .style("stroke-width", 1.5);

            // Dimension label above pie
            pieChartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -pieRadius - 10)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionLabelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(currentGroupData.dimension);

            // Data labels on slices
            pieChartGroup.selectAll(".data-label")
                .data(pieSliceData)
                .enter()
                .append("text")
                .attr("class", "label data-label")
                .each(function(d) {
                    const slice = d3.select(this);
                    const sliceAngle = d.endAngle - d.startAngle;
                    const percentageOfTotalPie = sliceAngle / (2 * Math.PI);
                    
                    const centroid = arcGenerator.centroid(d);
                    let labelX = centroid[0];
                    let labelY = centroid[1];
                    let textAnchor = "middle";

                    const formattedVal = formatValue(d.data[valueFieldName]);
                    const labelText = valueFieldUnit ? `${formattedVal}${valueFieldUnit}` : formattedVal;

                    let labelFontSizePx = parseFloat(fillStyle.typography.annotationFontSize);

                    if (percentageOfTotalPie > 0.07) { // Label inside for larger slices
                        // Position slightly adjusted from centroid for better fit
                        const angle = (d.startAngle + d.endAngle) / 2;
                        const unitX = Math.sin(angle);
                        const unitY = -Math.cos(angle);
                        labelX = centroid[0] + unitX * (pieRadius * 0.1);
                        labelY = centroid[1] + unitY * (pieRadius * 0.1);
                    } else { // Label outside for smaller slices
                        const midAngle = (d.startAngle + d.endAngle) / 2;
                        // Use a label arc slightly outside the pie
                        const labelArc = d3.arc().innerRadius(pieRadius * 1.05).outerRadius(pieRadius * 1.05);
                        const pos = labelArc.centroid(d);
                        labelX = pos[0] * 1.1; // Push further out
                        labelY = pos[1] * 1.1;
                        textAnchor = (midAngle < Math.PI) ? "start" : "end";
                        if (percentageOfTotalPie < 0.03) {
                           labelFontSizePx *= 0.9; // Smaller font for very small slices
                        }
                    }
                    
                    // Check if label fits, otherwise omit (simple check)
                    const labelMetrics = estimateTextDimensions(labelText, 
                        fillStyle.typography.annotationFontFamily, 
                        `${labelFontSizePx}px`, 
                        fillStyle.typography.annotationFontWeight);

                    // A very basic check for label fitting within slice (for inside labels)
                    // or not being excessively long (for outside labels)
                    // This could be more sophisticated.
                    const sliceVisualWidth = Math.abs(arcGenerator.centroid({startAngle: d.startAngle, endAngle: d.endAngle})[0] - arcGenerator.centroid({startAngle: d.startAngle + Math.PI/18, endAngle: d.endAngle - Math.PI/18})[0]) * 2;


                    if (percentageOfTotalPie > 0.02 && (percentageOfTotalPie > 0.07 || labelMetrics.width < pieRadius * 0.8)) { // Render if slice is not too tiny and label fits reasonably
                        slice.attr("transform", `translate(${labelX}, ${labelY})`)
                            .attr("text-anchor", textAnchor)
                            .style("font-family", fillStyle.typography.annotationFontFamily)
                            .style("font-size", `${labelFontSizePx}px`)
                            .style("font-weight", fillStyle.typography.annotationFontWeight)
                            .style("fill", percentageOfTotalPie > 0.07 ? getContrastColor(getSliceColor(d.data[groupFieldName])) : fillStyle.colors.textColor)
                            .style("dominant-baseline", "middle")
                            .text(labelText);
                    }
                });
            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // No additional enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    // Temporary elements for measurement are not appended to DOM, so no explicit cleanup needed.
    return svgRoot.node();
}