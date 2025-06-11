/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle)",
  "chart_name": "proportional_area_chart_circle_12",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 300,
  "min_width": 300,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];
    let chartDataArray = data.data?.data || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!dimensionFieldName || !valueFieldName) {
        const missingFields = [];
        if (!dimensionFieldName) missingFields.push("dimension field (role 'x')");
        if (!valueFieldName) missingFields.push("value field (role 'y')");
        
        const errorMessage = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const DEFAULT_TYPOGRAPHY_STYLES = {
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const DEFAULT_COLOR_STYLES = {
        text_color: "#333333",
        primary: "#1f77b4" // Default primary, though not directly used for elements if icons are present
    };

    const fillStyle = {
        textColor: colorsInput.text_color || DEFAULT_COLOR_STYLES.text_color,
        primaryColor: (colorsInput.other && colorsInput.other.primary) || DEFAULT_COLOR_STYLES.primary,
        typography: {
            dimension: {
                font_family: (typographyInput.label?.font_family) || DEFAULT_TYPOGRAPHY_STYLES.label.font_family,
                font_size: (typographyInput.label?.font_size) || DEFAULT_TYPOGRAPHY_STYLES.label.font_size,
                font_weight: (typographyInput.label?.font_weight) || DEFAULT_TYPOGRAPHY_STYLES.label.font_weight,
            },
            value: {
                font_family: (typographyInput.annotation?.font_family) || DEFAULT_TYPOGRAPHY_STYLES.annotation.font_family,
                font_size: (typographyInput.annotation?.font_size) || DEFAULT_TYPOGRAPHY_STYLES.annotation.font_size,
                font_weight: (typographyInput.annotation?.font_weight) || DEFAULT_TYPOGRAPHY_STYLES.annotation.font_weight,
            }
        }
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.font_family);
        textElement.setAttribute('font-size', fontProps.font_size);
        textElement.setAttribute('font-weight', fontProps.font_weight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // Note: getBBox on an un-rendered SVG text element is generally reliable.
        // No need to append to DOM per constraints.
        return textElement.getBBox().width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.1f")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    const dimensionUnit = dataColumns.find(col => col.role === "x")?.unit !== "none" ? dataColumns.find(col => col.role === "x").unit : "";
    const valueUnit = dataColumns.find(col => col.role === "y")?.unit !== "none" ? dataColumns.find(col => col.role === "y").unit : "";


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 600;
    const containerHeight = chartConfig.height || 350;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root proportional-area-chart-container")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 60, left: 30 }; // Adjusted for typical label space

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray]
        .filter(d => d[valueFieldName] > 0 && d[dimensionFieldName] != null)
        .sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    if (sortedData.length === 0) {
        const message = "No valid data to display after filtering.";
        console.warn(message);
        d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding: 20px;'>${message}</div>`);
        return null;
    }
    
    const maxValue = sortedData.length > 0 ? sortedData[0][valueFieldName] : 0;

    // Grid layout calculation
    const numCharts = sortedData.length;
    let rows, cols;
    if (numCharts <= 3) { rows = 1; cols = numCharts; }
    else if (numCharts === 4) { rows = 2; cols = 2; }
    else if (numCharts <= 8) { rows = 2; cols = Math.ceil(numCharts / 2); }
    else if (numCharts <= 12) { rows = 3; cols = Math.ceil(numCharts / 3); }
    else { rows = 4; cols = Math.ceil(numCharts / 4); }

    const itemsPerRow = [];
    for (let i = 0; i < rows; i++) {
        itemsPerRow.push(i < rows - 1 ? cols : numCharts - cols * (rows - 1));
    }

    const cellWidth = innerWidth / cols;
    const cellHeight = innerHeight / rows;

    const spacingFactorHorizontal = 0.15;
    const spacingFactorVertical = 0.15;
    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    const maxCellRadius = Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10; // Max radius for layout

    // Text measurement for font scaling
    let maxDimensionWidth = 0;
    let maxValueWidth = 0;
    const initialDimensionFontSizeNumeric = parseFloat(fillStyle.typography.dimension.font_size);
    const initialValueFontSizeNumeric = parseFloat(fillStyle.typography.value.font_size);

    sortedData.forEach(d => {
        maxDimensionWidth = Math.max(maxDimensionWidth, estimateTextWidth(d[dimensionFieldName], fillStyle.typography.dimension));
        const valueTextContent = valueUnit ? `${formatValue(d[valueFieldName])} ${valueUnit}` : formatValue(d[valueFieldName]);
        maxValueWidth = Math.max(maxValueWidth, estimateTextWidth(valueTextContent, fillStyle.typography.value));
    });
    
    const maxTextAllowedWidth = maxCellRadius * 2.8; // Heuristic for available width for text
    let dimensionScaleFactor = 1;
    if (maxDimensionWidth > maxTextAllowedWidth) {
        dimensionScaleFactor = maxTextAllowedWidth / (maxDimensionWidth + 3); // +3 for padding
    }
    let valueScaleFactor = 1;
    if (maxValueWidth > maxTextAllowedWidth) {
        valueScaleFactor = maxTextAllowedWidth / (maxValueWidth + 3);
    }

    const adjustedDimensionFontSize = `${Math.max(8, Math.floor(initialDimensionFontSizeNumeric * dimensionScaleFactor))}px`;
    const adjustedValueFontSize = `${Math.max(7, Math.floor(initialValueFontSizeNumeric * valueScaleFactor))}px`;

    // Block 6: Scale Definition & Configuration (Proportional radius is main scaling here)
    // No explicit D3 scales needed for axes.

    // Block 7: Chart Component Rendering (No axes, gridlines, legend)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const d = sortedData[dataIndex];

            const chartCenterX = chartMargins.left + rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (r + 0.5) * cellHeight;

            const chartGroup = svgRoot.append("g")
                .attr("class", "mark chart-item")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const proportionalRadius = maxValue > 0 ? maxCellRadius * Math.sqrt(d[valueFieldName] / maxValue) : 0;
            let displayRadius = proportionalRadius;
            if (proportionalRadius > 0 && proportionalRadius < 5) {
                displayRadius = 5; // Minimum visible radius
            }
            if (displayRadius <= 0) displayRadius = 0; // Ensure non-negative

            const iconUrl = imagesInput.field && imagesInput.field[d[dimensionFieldName]]
                ? imagesInput.field[d[dimensionFieldName]]
                : (imagesInput.other && imagesInput.other.primary ? imagesInput.other.primary : null);


            if (iconUrl && displayRadius > 1) {
                const clipPathId = `clip-${dataIndex}-${String(d[dimensionFieldName]).replace(/\W/g, '')}`;
                defs.append("clipPath")
                    .attr("id", clipPathId)
                    .append("circle")
                    .attr("r", displayRadius)
                    .attr("cx", 0)
                    .attr("cy", 0);

                chartGroup.append("image")
                    .attr("class", "image icon-mark")
                    .attr("x", -displayRadius)
                    .attr("y", -displayRadius)
                    .attr("width", displayRadius * 2)
                    .attr("height", displayRadius * 2)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", iconUrl)
                    .attr("clip-path", `url(#${clipPathId})`);
            } else if (displayRadius > 1) { // Fallback to a simple circle if no icon
                 chartGroup.append("circle")
                    .attr("class", "mark fallback-circle")
                    .attr("r", displayRadius)
                    .attr("fill", fillStyle.primaryColor) // Use a default/primary color
                    .style("opacity", 0.85);
            }


            // Dimension Label (above circle area)
            chartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -maxCellRadius - 10) // Positioned relative to max cell radius for consistency
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.dimension.font_family)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.dimension.font_weight)
                .style("fill", fillStyle.textColor)
                .text(d[dimensionFieldName] + (dimensionUnit ? ` (${dimensionUnit})` : ''));

            // Value Label (below circle area)
            const valueTextContent = valueUnit ? `${formatValue(d[valueFieldName])} ${valueUnit}` : formatValue(d[valueFieldName]);
            chartGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", 0)
                .attr("y", displayRadius + 5) // Positioned relative to actual display radius
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .style("font-family", fillStyle.typography.value.font_family)
                .style("font-size", adjustedValueFontSize)
                .style("font-weight", fillStyle.typography.value.font_weight)
                .style("fill", fillStyle.textColor)
                .text(valueTextContent);

            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // No shadows, gradients, or complex effects as per requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}