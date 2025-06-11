/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Hexagon)",
  "chart_name": "proportional_area_chart_hexagon_01",
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
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const inputTypography = data.typography || {};
    const typography = {
        title: { ...defaultTypography.title, ...(inputTypography.title || {}) },
        label: { ...defaultTypography.label, ...(inputTypography.label || {}) },
        annotation: { ...defaultTypography.annotation, ...(inputTypography.annotation || {}) }
    };

    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };
    const colors = { ...defaultColors, ...(data.colors || {}) };
    colors.other = { ...defaultColors.other, ...(colors.other || {}) };
    
    // Images are not used in this chart, but extract if present for completeness.
    // const images = data.images || {}; 

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    let valueUnit = dataColumns.find(col => col.role === "y")?.unit || "";
    if (valueUnit === "none") valueUnit = "";

    if (!dimensionField || !valueField) {
        const missingFields = [];
        if (!dimensionField) missingFields.push("x role field");
        if (!valueField) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: colors.other.primary || "#1f77b4",
        textColor: colors.text_color || "#0f223b",
        valueLabelInsideColor: "#FFFFFF", // Standard contrasting color for labels inside elements
        typography: {
            labelFontFamily: typography.label.font_family,
            labelFontSize: typography.label.font_size,
            labelFontWeight: typography.label.font_weight,
            annotationFontFamily: typography.annotation.font_family,
            annotationFontSize: typography.annotation.font_size,
            annotationFontWeight: typography.annotation.font_weight,
        }
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.width = '0px'; // Ensure it doesn't affect layout if accidentally appended
        tempSvg.style.height = '0px';

        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        
        // Appending to body to getBBox, then removing. This is a common workaround.
        // For true in-memory, one might need more complex canvas-based measurement.
        // However, getBBox often requires the element to be in the DOM tree.
        // Let's try without appending first, if it works across browsers.
        // If not, this is the point to reconsider.
        // For D3, often a detached SVG element works if it's created via d3.create('svg').
        // The current method uses raw DOM elements.
        // Let's stick to the prompt's example: "document.createElementNS... append text, style, measure... then discard"
        // This implies it doesn't need to be in the main DOM.
        
        // A more robust way if not appended to DOM:
        // document.body.appendChild(tempSvg); // Temporarily append
        // const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg); // Clean up
        // return width;
        // For now, assuming getBBox works on detached elements for simple text.
        // If not, the above append/remove is the fallback.
        // After testing, getBBox on a detached element created with createElementNS often returns 0 width.
        // So, we will use the append/remove method for reliable measurement.
        document.body.appendChild(tempSvg);
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    }
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value).replace('G', 'B'); // Use ~s for SI, then replace G with B
        if (value >= 1000000) return d3.format("~s")(value);
        if (value >= 1000) return d3.format("~s")(value);
        return d3.format("~g")(value); // ~g for general formatting for smaller numbers
    };

    const hexagonPath = (sideLength) => {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = ((i * 60) + 30) * Math.PI / 180;
            const x = sideLength * Math.sin(angle);
            const y = -sideLength * Math.cos(angle);
            points.push([x, y]);
        }
        return d3.line()(points) + "Z";
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 350;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "proportional-area-chart-hexagon")
        .attr("xmlns", "http://www.w3.org/2000/svg");
        // No viewBox, no responsive width/height attributes

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 50, left: 30 }; // Adjusted for less top/bottom space
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData]
        .filter(d => d[valueField] != null && parseFloat(d[valueField]) > 0)
        .sort((a, b) => b[valueField] - a[valueField]);
    
    if (sortedData.length === 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No data to display.");
        return svgRoot.node();
    }
    
    const maxValue = sortedData.length > 0 ? sortedData[0][valueField] : 0;

    // Grid layout calculation
    const numCharts = sortedData.length;
    let rows, cols;
    if (numCharts <= 3) { rows = 1; cols = numCharts; }
    else if (numCharts === 4) { rows = 2; cols = 2; }
    else if (numCharts <= 8) { rows = 2; cols = Math.ceil(numCharts / 2); }
    else if (numCharts <= 12) { rows = 3; cols = Math.ceil(numCharts / 3); }
    else { rows = 4; cols = Math.ceil(numCharts / 4); } // Max 4 rows, adjust cols

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
    
    const maxHexagonBoundingBoxRadius = Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10; // 'radius' of hexagon's bounding box

    // Block 6: Scale Definition & Configuration (Includes font size adjustments)
    let maxDimensionWidth = 0;
    sortedData.forEach(d => {
        const width = estimateTextWidth(d[dimensionField], {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (width > maxDimensionWidth) maxDimensionWidth = width;
    });

    let maxValueWidth = 0;
    sortedData.forEach(d => {
        const text = valueUnit ? `${formatValue(d[valueField])} ${valueUnit}` : formatValue(d[valueField]);
        const width = estimateTextWidth(text, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        });
        if (width > maxValueWidth) maxValueWidth = width;
    });
    
    const maxTextAllowedWidth = maxHexagonBoundingBoxRadius * 1.8; // Allow text to be a bit wider than hexagon itself, but within cell constraints
    
    let dimensionScaleFactor = 1;
    if (maxDimensionWidth > maxTextAllowedWidth && maxTextAllowedWidth > 0) {
        dimensionScaleFactor = maxTextAllowedWidth / maxDimensionWidth;
    }
    
    let valueScaleFactor = 1;
    if (maxValueWidth > maxTextAllowedWidth && maxTextAllowedWidth > 0) {
        valueScaleFactor = maxTextAllowedWidth / maxValueWidth;
    }

    const baseDimensionFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const baseValueFontSize = parseFloat(fillStyle.typography.annotationFontSize);

    const adjustedDimensionFontSize = `${Math.max(8, Math.floor(baseDimensionFontSize * dimensionScaleFactor))}px`; // Min font size 8px
    const adjustedValueFontSize = `${Math.max(7, Math.floor(baseValueFontSize * valueScaleFactor))}px`; // Min font size 7px

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2; // Center rows with fewer items
        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const d = sortedData[dataIndex];
            
            const chartCenterX = rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = (r + 0.5) * cellHeight;
            
            const chartGroup = mainChartGroup.append("g")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`)
                .attr("class", "other chart-item-group"); // "other" for complex group
            
            const proportionalRadius = maxValue > 0 ? maxHexagonBoundingBoxRadius * Math.sqrt(d[valueField] / maxValue) : 0;
            let displayRadius = proportionalRadius;
            if (proportionalRadius > 0 && proportionalRadius < 10) { // Minimum visual size for hexagon
                displayRadius = 10;
            }

            if (displayRadius > 0) {
                chartGroup.append("path")
                    .attr("d", hexagonPath(displayRadius)) // hexagonPath expects side length, displayRadius is outer radius
                    .attr("fill", fillStyle.primaryColor)
                    // No stroke by default for simplification, as per V.3
                    // .attr("stroke", fillStyle.strokeColor) 
                    // .attr("stroke-width", 1)
                    .style("opacity", 0.85)
                    .attr("class", "mark hexagon-mark");
            }
            
            // Dimension Label (above hexagon)
            chartGroup.append("text")
                .attr("x", 0)
                .attr("y", -maxHexagonBoundingBoxRadius - 8) // Position above the largest possible hexagon
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(d[dimensionField])
                .attr("class", "label dimension-label");
            
            // Value Label
            const valueTextContent = valueUnit ? `${formatValue(d[valueField])} ${valueUnit}` : formatValue(d[valueField]);
            const valueLabel = chartGroup.append("text")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", adjustedValueFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(valueTextContent)
                .attr("class", "label value-label");

            const tempValueLabelBBox = valueLabel.node().getBBox(); // Measure actual rendered size

            // Hexagon inner radius (apothem) is outerRadius * cos(30deg) = outerRadius * sqrt(3)/2 ~ outerRadius * 0.866
            const hexagonInnerRadius = displayRadius * 0.866;
            const canFitInside = displayRadius >= 15 && // Hexagon must be large enough
                                 tempValueLabelBBox.width < hexagonInnerRadius * 1.6 && // Allow some padding
                                 tempValueLabelBBox.height < hexagonInnerRadius * 1.6;

            if (canFitInside) {
                valueLabel
                    .attr("x", 0)
                    .attr("y", 0) 
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "central") 
                    .style("fill", fillStyle.valueLabelInsideColor);
            } else {
                valueLabel
                    .attr("x", 0)
                    .attr("y", displayRadius + 5) // Position below the hexagon
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging") 
                    .style("fill", fillStyle.textColor);
            }
            
            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements)
    // None in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}