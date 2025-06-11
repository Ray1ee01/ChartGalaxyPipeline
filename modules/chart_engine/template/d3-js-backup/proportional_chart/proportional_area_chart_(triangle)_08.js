/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Triangle)",
  "chart_name": "proportional_area_chart_triangle_08",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
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
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
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
    const rawColors = data.colors || {};
    // const rawImages = data.images || {}; // Not used in this chart, but good practice to extract
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    const dimensionFieldName = dimensionFieldDef ? dimensionFieldDef.name : undefined;
    const valueFieldName = valueFieldDef ? valueFieldDef.name : undefined;
    const valueFieldUnit = (valueFieldDef && valueFieldDef.unit !== "none") ? valueFieldDef.unit : "";

    if (!dimensionFieldName || !valueFieldName) {
        let missingFields = [];
        if (!dimensionFieldName) missingFields.push("dimension field (role 'x')");
        if (!valueFieldName) missingFields.push("value field (role 'y')");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};

    fillStyle.typography = {
        titleFontFamily: (rawTypography.title && rawTypography.title.font_family) || 'Arial, sans-serif',
        titleFontSize: (rawTypography.title && rawTypography.title.font_size) || '16px',
        titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || 'bold',
        labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
        labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
        labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
        annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
        annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
        annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal'
    };

    fillStyle.primaryColor = (rawColors.other && rawColors.other.primary) || '#FF4136';
    fillStyle.textColor = rawColors.text_color || '#0f223b';
    fillStyle.chartBackground = rawColors.background_color || '#FFFFFF';

    function estimateTextWidth(text, fontProps = {}) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family || 'Arial, sans-serif');
        tempText.setAttribute('font-size', fontProps.font_size || '12px');
        tempText.setAttribute('font-weight', fontProps.font_weight || 'normal');
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox works on in-memory elements in modern browsers
        return tempText.getBBox().width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    const trianglePath = (sideLength) => {
        const height = sideLength * Math.sqrt(3) / 2;
        const points = [
            [0, -height * 2/3],
            [sideLength / 2, height * 1/3],
            [-sideLength / 2, height * 1/3]
        ];
        return d3.line()(points) + "Z";
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 350;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 100, right: 30, bottom: 80, left: 30 }; // Adjusted for labels

    const numCharts = chartData.filter(d => d[valueFieldName] > 0).length;
    if (numCharts === 0) {
        // No data to render or all values are zero
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

    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const cellWidth = chartAreaWidth / cols;
    const cellHeight = chartAreaHeight / rows;

    const spacingFactorHorizontal = 0.15;
    const spacingFactorVertical = 0.15;
    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    const radius = Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10; // Half max dimension of shape's bounding box

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData]
        .filter(d => d[valueFieldName] > 0)
        .sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    
    const maxValue = sortedData.length > 0 ? sortedData[0][valueFieldName] : 0;

    // Text size adjustment pre-calculation
    let maxDimensionTextWidth = 0;
    let maxValueTextWidth = 0;
    sortedData.forEach(d => {
        maxDimensionTextWidth = Math.max(maxDimensionTextWidth, estimateTextWidth(d[dimensionFieldName], {
            font_family: fillStyle.typography.labelFontFamily,
            font_size: fillStyle.typography.labelFontSize,
            font_weight: fillStyle.typography.labelFontWeight
        }));
        const valueTextContent = valueFieldUnit ? `${formatValue(d[valueFieldName])} ${valueFieldUnit}` : formatValue(d[valueFieldName]);
        maxValueTextWidth = Math.max(maxValueTextWidth, estimateTextWidth(valueTextContent, {
            font_family: fillStyle.typography.annotationFontFamily,
            font_size: fillStyle.typography.annotationFontSize,
            font_weight: fillStyle.typography.annotationFontWeight
        }));
    });
    
    const maxChartAreaWidthForText = radius * 2.8; // Max width for text based on cell's capacity
    let dimensionScaleFactor = 1;
    if (maxDimensionTextWidth > maxChartAreaWidthForText) {
        dimensionScaleFactor = maxChartAreaWidthForText / (maxDimensionTextWidth + 3);
    }
    let valueScaleFactor = 1;
    if (maxValueTextWidth > maxChartAreaWidthForText) {
        valueScaleFactor = maxChartAreaWidthForText / (maxValueTextWidth + 3);
    }

    const adjustedDimensionFontSize = `${Math.floor(parseFloat(fillStyle.typography.labelFontSize) * dimensionScaleFactor)}px`;
    const adjustedValueFontSize = `${Math.floor(parseFloat(fillStyle.typography.annotationFontSize) * valueScaleFactor)}px`;

    // Block 6: Scale Definition & Configuration (Proportional sizing logic)
    // Max possible side for a triangle based on 'radius' (which is half bounding box)
    const maxPossibleSide = radius * 2; 

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - Not applicable for this chart)

    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let row = 0; row < rows; row++) {
        const itemsInThisRow = itemsPerRow[row];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2; // Center rows with fewer items
        for (let colIdx = 0; colIdx < itemsInThisRow; colIdx++) {
            if (dataIndex >= numCharts) break;
            const d = sortedData[dataIndex];
            
            const chartCenterX = chartMargins.left + rowOffset + (colIdx + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (row + 0.5) * cellHeight;

            const chartItemGroup = svgRoot.append("g")
                .attr("class", "chart-item")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const proportionalSide = maxValue > 0 ? maxPossibleSide * Math.sqrt(d[valueFieldName] / maxValue) : 0;
            let displaySide = proportionalSide;
            if (proportionalSide > 0 && proportionalSide < 12) { // Minimum visual size
                displaySide = 12;
            }

            if (displaySide > 0) {
                chartItemGroup.append("path")
                    .attr("class", "mark triangle-mark")
                    .attr("d", trianglePath(displaySide))
                    .attr("fill", fillStyle.primaryColor)
                    .style("opacity", 0.85);
            }

            // Dimension Label
            chartItemGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -radius - 10) // Position above the max possible triangle area
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(d[dimensionFieldName]);

            // Value Label
            const triangleHeight = displaySide * Math.sqrt(3) / 2;
            const valueTextContent = valueFieldUnit ? `${formatValue(d[valueFieldName])} ${valueFieldUnit}` : formatValue(d[valueFieldName]);
            
            const valueLabel = chartItemGroup.append("text")
                .attr("class", "label value-label")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", adjustedValueFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(valueTextContent);

            const valueLabelBBox = valueLabel.node().getBBox();
            const inCircleRadius = displaySide * Math.sqrt(3) / 6; // Triangle's incircle radius

            const canFitInside = displaySide >= 30 && 
                                 valueLabelBBox.width < inCircleRadius * 1.8 && 
                                 valueLabelBBox.height < inCircleRadius * 1.8;

            if (canFitInside) {
                valueLabel
                    .attr("x", 0)
                    .attr("y", triangleHeight * 1/6) // Position inside, towards center
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("fill", "#FFFFFF"); // Contrast color for inside
            } else {
                valueLabel
                    .attr("x", 0)
                    .attr("y", triangleHeight * 1/3 + 5 + valueLabelBBox.height / 2) // Position below triangle
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .style("fill", fillStyle.textColor);
            }
            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing (None for this chart)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}