/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle)",
  "chart_name": "proportional_area_chart_circle_11",
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
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    // const imagesConfig = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!dimensionFieldName || !valueFieldName) {
        const missingFields = [];
        if (!dimensionFieldName) missingFields.push("dimension field (role 'x')");
        if (!valueFieldName) missingFields.push("value field (role 'y')");
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const valueFieldUnit = dataColumns.find(col => col.role === "y")?.unit || "";


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#FF4136',
        textColor: colorsConfig.text_color || '#333333',
        labelColorInside: '#FFFFFF', // Fixed for contrast
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '14px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '12px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        }
    };
    fillStyle.labelColorOutside = fillStyle.textColor;


    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.position = 'absolute';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        document.body.appendChild(tempSvg); // Needs to be in DOM for getBBox to work reliably
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // Use .2s for significant figures, G for Giga (Billion)
        if (value >= 1000000) return d3.format("~.2s")(value);    // M for Mega (Million)
        if (value >= 1000) return d3.format("~.2s")(value);       // k for kilo (Thousand)
        return d3.format("~g")(value); // General format for smaller numbers
    };
    

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 600;
    const containerHeight = chartConfig.height || 350;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray]
        .filter(d => d[valueFieldName] > 0)
        .sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    const numCharts = sortedData.length;
    if (numCharts === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "label no-data-label")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No data to display.");
        return svgRoot.node();
    }
    
    const maxValue = sortedData.length > 0 ? sortedData[0][valueFieldName] : 0;

    // Grid layout calculation
    let rows, cols;
    if (numCharts <= 3) { rows = 1; cols = numCharts; }
    else if (numCharts === 4) { rows = 2; cols = 2; }
    else if (numCharts <= 8) { rows = 2; cols = Math.ceil(numCharts / 2); }
    else if (numCharts <= 12) { rows = 3; cols = Math.ceil(numCharts / 3); }
    else { rows = 4; cols = Math.ceil(numCharts / 4); }

    const itemsPerRow = [];
    for (let i = 0; i < rows; i++) {
        itemsPerRow.push( (i < rows - 1) ? cols : numCharts - cols * (rows - 1) );
    }

    const cellWidth = innerWidth / cols;
    const cellHeight = innerHeight / rows;
    
    const spacingFactorHorizontal = 0.15;
    const spacingFactorVertical = 0.15;
    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    const maxRadiusPerCell = Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10; // -10 for label padding

    // Block 6: Scale Definition & Configuration (Includes font size adjustments)
    let maxDimensionWidth = 0;
    let maxValueWidth = 0;

    sortedData.forEach(d => {
        const dimText = String(d[dimensionFieldName]);
        const valText = valueFieldUnit ? `${formatValue(d[valueFieldName])} ${valueFieldUnit}` : formatValue(d[valueFieldName]);
        
        maxDimensionWidth = Math.max(maxDimensionWidth, estimateTextWidth(dimText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight));
        maxValueWidth = Math.max(maxValueWidth, estimateTextWidth(valText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight));
    });
    
    const maxAllowedTextWidthInCell = innerCellWidth * 0.95; // Max width for text within a cell, with some padding

    let dimensionScaleFactor = 1;
    if (maxDimensionWidth > maxAllowedTextWidthInCell) {
        dimensionScaleFactor = maxAllowedTextWidthInCell / maxDimensionWidth;
    }
    
    let valueScaleFactor = 1;
    if (maxValueWidth > maxAllowedTextWidthInCell) {
        valueScaleFactor = maxAllowedTextWidthInCell / maxValueWidth;
    }

    const baseDimensionFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const baseValueFontSize = parseFloat(fillStyle.typography.annotationFontSize);

    const adjustedDimensionFontSize = `${Math.max(8, Math.floor(baseDimensionFontSize * dimensionScaleFactor))}px`; // Min font size 8px
    const adjustedValueFontSize = `${Math.max(7, Math.floor(baseValueFontSize * valueScaleFactor))}px`; // Min font size 7px


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2; // Center rows with fewer items

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const d = sortedData[dataIndex];

            const chartCenterX = rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = (r + 0.5) * cellHeight;

            const chartItemGroup = mainChartGroup.append("g")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`)
                .attr("class", "mark-group");

            const proportionalRadius = maxValue > 0 ? maxRadiusPerCell * Math.sqrt(d[valueFieldName] / maxValue) : 0;
            let displayRadius = proportionalRadius;
            if (proportionalRadius > 0 && proportionalRadius < 5) {
                displayRadius = 5; // Minimum visible radius
            }
            
            if (displayRadius <= 0) { // Skip rendering if radius is zero or negative
                dataIndex++;
                continue;
            }


            chartItemGroup.append("circle")
                .attr("r", displayRadius)
                .attr("fill", fillStyle.primaryColor)
                .style("opacity", 0.85)
                .attr("class", "mark value proportional-circle");

            // Dimension Label (above circle)
            chartItemGroup.append("text")
                .attr("x", 0)
                .attr("y", -maxRadiusPerCell - 8) // Positioned relative to max cell radius
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .attr("class", "label dimension-label")
                .text(String(d[dimensionFieldName]).length > 30 ? String(d[dimensionFieldName]).substring(0,27) + "..." : String(d[dimensionFieldName])); // Basic truncation

            // Value Label (inside/outside circle)
            const valueTextContent = valueFieldUnit ? `${formatValue(d[valueFieldName])} ${valueFieldUnit}` : formatValue(d[valueFieldName]);
            const valueLabel = chartItemGroup.append("text")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", adjustedValueFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .attr("class", "label value-label")
                .text(valueTextContent);
            
            // Temporarily append to measure, then remove and re-append with correct attributes
            // This is more robust for getBBox than relying on the estimateTextWidth for precise placement decisions
            const tempValueLabelForBBox = chartItemGroup.append("text")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", adjustedValueFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("visibility", "hidden") 
                .text(valueTextContent);
            const labelBBox = tempValueLabelForBBox.node().getBBox();
            tempValueLabelForBBox.remove();


            const canFitInside = labelBBox.width < displayRadius * 2 * 0.85 &&
                                 labelBBox.height < displayRadius * 2 * 0.85 &&
                                 displayRadius > labelBBox.height * 0.6; // Ensure circle is large enough

            if (canFitInside && displayRadius > 5) {
                valueLabel
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "central")
                    .style("fill", fillStyle.labelColorInside);
            } else {
                valueLabel
                    .attr("x", 0)
                    .attr("y", displayRadius + 4) // Position below the circle
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .style("fill", fillStyle.labelColorOutside);
            }
            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable for this chart type.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}