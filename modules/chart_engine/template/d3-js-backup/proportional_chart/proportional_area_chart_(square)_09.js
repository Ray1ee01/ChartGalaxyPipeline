/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Square)",
  "chart_name": "proportional_area_chart_square_09",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || {};
    const inputImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    
    if (!dimensionField || !valueField) {
        const missingFields = [];
        if (!dimensionField) missingFields.push("dimensionField (role: x)");
        if (!valueField) missingFields.push("valueField (role: y)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const valueColumnDef = dataColumns.find(col => col.role === "y");
    let valueUnit = "";
    if (valueColumnDef && valueColumnDef.unit && valueColumnDef.unit !== "none") {
        valueUnit = valueColumnDef.unit;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (inputTypography.label && inputTypography.label.font_family) ? inputTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (inputTypography.label && inputTypography.label.font_size) ? inputTypography.label.font_size : '14px',
            labelFontWeight: (inputTypography.label && inputTypography.label.font_weight) ? inputTypography.label.font_weight : 'normal',
            annotationFontFamily: (inputTypography.annotation && inputTypography.annotation.font_family) ? inputTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (inputTypography.annotation && inputTypography.annotation.font_size) ? inputTypography.annotation.font_size : '12px',
            annotationFontWeight: (inputTypography.annotation && inputTypography.annotation.font_weight) ? inputTypography.annotation.font_weight : 'normal',
        },
        textColor: inputColors.text_color || '#333333',
        primaryColor: (inputColors.other && inputColors.other.primary) ? inputColors.other.primary : '#FF4136',
        chartBackground: inputColors.background_color || '#FFFFFF', // Not used directly on SVG, but available
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text || typeof text !== 'string' || text.trim() === "") return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        
        let width = 0;
        try {
            // Note: getBBox on an element not in the live DOM can be unreliable.
            width = tempText.getBBox().width;
        } catch (e) {
            console.warn("Error getting BBox for text measurement:", e);
        }
        if (width === 0 && text.length > 0) {
            // Fallback for unreliable getBBox
            width = text.length * (parseFloat(fontSize) || 12) * 0.6;
        }
        return width;
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 350;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "proportional-area-chart-svg")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 60, left: 30 }; // Adjusted margins for labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData
        .filter(d => d[valueField] != null && parseFloat(d[valueField]) > 0)
        .map(d => ({ ...d, [valueField]: parseFloat(d[valueField]) }))
        .sort((a, b) => b[valueField] - a[valueField]);

    const maxValue = chartDataArray.length > 0 ? chartDataArray[0][valueField] : 0;
    const numCharts = chartDataArray.length;

    if (numCharts === 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "label")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No data to display.");
        return svgRoot.node();
    }
    
    // Grid layout calculation
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
    const spacingFactorVertical = 0.25; // Increased vertical spacing for labels
    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    // 'maxShapeDimension' is the max dimension of the shape's bounding box in the cell
    const maxShapeDimension = Math.min(innerCellWidth, innerCellHeight * 0.7); // Reserve more space for labels

    // Block 6: Scale Definition & Configuration (Text scaling part)
    let maxDimensionTextWidth = 0;
    let maxValueTextWidth = 0;
    
    chartDataArray.forEach(d => {
        maxDimensionTextWidth = Math.max(maxDimensionTextWidth, estimateTextWidth(d[dimensionField], fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight));
        const valueTextContent = valueUnit ? `${formatValue(d[valueField])} ${valueUnit}` : formatValue(d[valueField]);
        maxValueTextWidth = Math.max(maxValueTextWidth, estimateTextWidth(valueTextContent, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight));
    });
    
    const maxAllowedTextWidth = innerCellWidth * 0.9; // Max width for text based on cell's capacity
    let dimensionScaleFactor = 1;
    if (maxDimensionTextWidth > maxAllowedTextWidth) {
        dimensionScaleFactor = maxAllowedTextWidth / (maxDimensionTextWidth + 1); // +1 to avoid zero division
    }
    let valueScaleFactor = 1;
    if (maxValueTextWidth > maxAllowedTextWidth) {
        valueScaleFactor = maxAllowedTextWidth / (maxValueTextWidth + 1);
    }

    const adjustedDimensionFontSize = `${Math.max(8, Math.floor(parseFloat(fillStyle.typography.labelFontSize) * dimensionScaleFactor))}px`;
    const adjustedValueFontSize = `${Math.max(8, Math.floor(parseFloat(fillStyle.typography.annotationFontSize) * valueScaleFactor))}px`;

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2; // Center rows with fewer items
        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const d = chartDataArray[dataIndex];
            
            const cellCenterX = chartMargins.left + rowOffset + (c + 0.5) * cellWidth;
            const cellCenterY = chartMargins.top + (r + 0.5) * cellHeight;
            
            const chartItemGroup = svgRoot.append("g")
                .attr("class", "mark-group")
                .attr("transform", `translate(${cellCenterX}, ${cellCenterY})`);
            
            const proportionalSide = (maxValue > 0) ? maxShapeDimension * Math.sqrt(d[valueField] / maxValue) : 0;
            let displaySide = Math.max(proportionalSide, Math.min(10, maxShapeDimension * 0.1)); // Min side 10px or 10% of maxShapeDimension
            displaySide = Math.min(displaySide, maxShapeDimension); // Ensure it doesn't exceed maxShapeDimension

            if (displaySide > 0) {
                const iconUrl = inputImages.field && inputImages.field[d[dimensionField]] ? inputImages.field[d[dimensionField]] : null;

                if (iconUrl) {
                    const clipId = `clip-${dataIndex}`;
                    defs.append("clipPath")
                        .attr("id", clipId)
                        .append("rect")
                        .attr("x", -displaySide / 2)
                        .attr("y", -displaySide / 2)
                        .attr("width", displaySide)
                        .attr("height", displaySide);
                    
                    // Background rect for icon (optional, could be transparent)
                    chartItemGroup.append("rect")
                        .attr("class", "mark background-rect")
                        .attr("x", -displaySide / 2)
                        .attr("y", -displaySide / 2)
                        .attr("width", displaySide)
                        .attr("height", displaySide)
                        .attr("fill", "white") // Or a configurable background
                        .attr("opacity", 0); // Make it transparent unless a fill is desired

                    const imageSize = displaySide; // Image will be contained within the square
                    chartItemGroup.append("image")
                        .attr("class", "mark image")
                        .attr("x", -imageSize / 2)
                        .attr("y", -imageSize / 2)
                        .attr("width", imageSize)
                        .attr("height", imageSize)
                        .attr("xlink:href", iconUrl)
                        .attr("preserveAspectRatio", "xMidYMid meet") // 'meet' ensures icon is fully visible
                        .attr("clip-path", `url(#${clipId})`);
                } else {
                    chartItemGroup.append("rect")
                        .attr("class", "mark square")
                        .attr("x", -displaySide / 2)
                        .attr("y", -displaySide / 2)
                        .attr("width", displaySide)
                        .attr("height", displaySide)
                        .attr("fill", fillStyle.primaryColor)
                        .style("opacity", 0.85);
                }
            }
            
            // Dimension Label (above the shape)
            chartItemGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -(maxShapeDimension / 2) - 8) // Position above the max possible shape
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(d[dimensionField]);
            
            // Value Label (below the shape)
            const valueTextContent = valueUnit ? `${formatValue(d[valueField])} ${valueUnit}` : formatValue(d[valueField]);
            chartItemGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", 0)
                .attr("y", (maxShapeDimension / 2) + 8) // Position below the max possible shape
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", adjustedValueFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(valueTextContent);
            
            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // No shadows, strokes, or other complex effects as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}