/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Star Grid)",
  "chart_name": "proportional_area_chart_star_grid_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[1, 20], [0, "inf"]],
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
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartRawData = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    // const images = data.images || {}; // Not used in this chart
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    let valueFieldUnit = dataColumns.find(col => col.role === "y")?.unit;
    if (valueFieldUnit === "none") valueFieldUnit = "";

    if (!dimensionFieldName || !valueFieldName) {
        const missingFields = [];
        if (!dimensionFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryStarColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4', // Default primary from prompt example
        textColor: colors.text_color || '#0f223b', // Default text_color from prompt example
        chartBackground: colors.background_color || '#FFFFFF', // Default background
    };

    const baseStarColor = d3.color(fillStyle.primaryStarColor);
    fillStyle.starDarkFaceColor = baseStarColor.darker(0.6).toString();
    fillStyle.starLightFaceColor = baseStarColor.brighter(0.6).toString();

    fillStyle.typography = {
        labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
        labelFontSize: (typography.label && typography.label.font_size) || '12px',
        labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
        annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
        annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
        annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox across browsers
        // but per directive III.2, it must not be appended to DOM.
        // This might lead to inaccuracies in some environments if not rendered.
        // For robustness in a real scenario, one might briefly append to DOM, measure, and remove.
        // However, adhering strictly to "MUST NOT be appended to the document DOM".
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails in non-rendered context
            return text.length * (parseFloat(fontSize) * 0.6); 
        }
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~.2s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.2s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.2s")(value / 1000) + "K";
        return d3.format("~.2s")(value); // Use .2s for consistency
    }

    function getStarPoints(numArms, outerR, innerR) {
        const points = [];
        const angleStep = Math.PI / numArms;
        for (let i = 0; i < 2 * numArms; i++) {
            const r = (i % 2 === 0) ? outerR : innerR;
            const currentAngle = i * angleStep - (Math.PI / 2); // First point up
            points.push([r * Math.cos(currentAngle), r * Math.sin(currentAngle)]);
        }
        return points;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 350;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 30, right: 15, bottom: 30, left: 15 };
    // Adjust margins based on typical label heights if needed, for now fixed.
    // floatLabelFontSize = parseFloat(fillStyle.typography.labelFontSize)
    // floatAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize)
    // chartMargins.top = floatLabelFontSize + 20;
    // chartMargins.bottom = floatAnnotationFontSize + 20;


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Data preprocessing is done before layout calculation that depends on numCharts
    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartRawData
        .filter(d => d[valueFieldName] != null && typeof d[valueFieldName] === 'number' && d[valueFieldName] > 0)
        .sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    const numCharts = chartDataArray.length;
    if (numCharts === 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "label no-data-label")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No data to display.");
        return svgRoot.node();
    }
    
    const maxValue = chartDataArray.length > 0 ? chartDataArray[0][valueFieldName] : 0;

    // Resume Block 4: Layout Calculation (dependent on numCharts)
    let rows, cols;
    if (numCharts <= 3) { rows = 1; cols = numCharts; }
    else if (numCharts === 4) { rows = 2; cols = 2; }
    else if (numCharts <= 8) { rows = 2; cols = Math.ceil(numCharts / 2); }
    else if (numCharts <= 12) { rows = 3; cols = Math.ceil(numCharts / 3); }
    else { rows = Math.ceil(Math.sqrt(numCharts)); cols = Math.ceil(numCharts / rows); } // More generic grid

    const itemsPerRow = [];
    let count = 0;
    for (let i = 0; i < rows; i++) {
        let numInRow = Math.min(cols, numCharts - count);
        if (i === rows - 1) numInRow = numCharts - count; // Ensure last row takes all remaining
        itemsPerRow.push(numInRow);
        count += numInRow;
    }
    // Ensure cols is the max items in any row for consistent cellWidth calculation
    cols = Math.max(...itemsPerRow, 1);


    const cellWidth = innerWidth / cols;
    const cellHeight = innerHeight / rows;

    let maxDimensionWidth = 0;
    let maxValueWidth = 0;
    chartDataArray.forEach(d => {
        maxDimensionWidth = Math.max(maxDimensionWidth, estimateTextWidth(d[dimensionFieldName], fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight));
        const valueText = valueFieldUnit ? `${formatValue(d[valueFieldName])} ${valueFieldUnit}` : formatValue(d[valueFieldName]);
        maxValueWidth = Math.max(maxValueWidth, estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight));
    });

    const spacingFactorHorizontal = 0.15;
    const spacingFactorVertical = 0.15;
    const actualCellContentWidth = cellWidth * (1 - spacingFactorHorizontal);
    const actualCellContentHeight = cellHeight * (1 - spacingFactorVertical);
    
    // Max radius for star, considering space for labels above/below
    const labelSpace = parseFloat(fillStyle.typography.labelFontSize) + parseFloat(fillStyle.typography.annotationFontSize) + 15; // 10px padding for top label, 5px for bottom
    const maxStarHeight = actualCellContentHeight - labelSpace;
    const maxStarRadiusBasedOnHeight = maxStarHeight / 2.2; // 2.2 factor from original, relates to star aspect and label placement
    const maxStarRadiusBasedOnWidth = actualCellContentWidth / 2;
    const maxPossibleOuterRadius = Math.max(5, Math.min(maxStarRadiusBasedOnWidth, maxStarRadiusBasedOnHeight) - 5); // -5 padding, min 5 radius

    let dimensionScaleFactor = 1;
    const maxLabelWidthAllowed = actualCellContentWidth * 0.95; // Allow 5% padding
    if (maxDimensionWidth > maxLabelWidthAllowed) {
        dimensionScaleFactor = maxLabelWidthAllowed / maxDimensionWidth;
    }
    let valueScaleFactor = 1;
    if (maxValueWidth > maxLabelWidthAllowed) {
        valueScaleFactor = maxLabelWidthAllowed / maxValueWidth;
    }
    
    const adjustedDimensionFontSize = `${Math.floor(parseFloat(fillStyle.typography.labelFontSize) * dimensionScaleFactor)}px`;
    const adjustedValueFontSize = `${Math.floor(parseFloat(fillStyle.typography.annotationFontSize) * valueScaleFactor)}px`;

    // Block 6: Scale Definition & Configuration
    const innerRadiusRatio = 0.4; // Star points' inner to outer radius ratio
    const minOuterRadiusDisplay = 5; // Minimum visual radius for a star if its value is > 0

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-area")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        if (itemsInThisRow === 0) continue;
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2; // Center rows with fewer items

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const d = chartDataArray[dataIndex];

            const chartCellX = rowOffset + (c * cellWidth) + (cellWidth / 2);
            const chartCellY = (r * cellHeight) + (cellHeight / 2);

            const chartGroup = mainChartGroup.append("g")
                .attr("class", "mark-group chart-item")
                .attr("transform", `translate(${chartCellX}, ${chartCellY})`);

            const proportionalOuterRadius = (maxValue > 0 && d[valueFieldName] > 0) ? maxPossibleOuterRadius * Math.sqrt(d[valueFieldName] / maxValue) : 0;
            
            let displayOuterRadius = proportionalOuterRadius;
            if (proportionalOuterRadius > 0) { // Only apply min display for non-zero, positive values
                 displayOuterRadius = Math.max(proportionalOuterRadius, minOuterRadiusDisplay);
            } else {
                 displayOuterRadius = 0; // Ensure zero values are zero radius
            }
            const displayInnerRadius = displayOuterRadius * innerRadiusRatio;

            if (displayOuterRadius > 0) {
                const starVertices = getStarPoints(5, displayOuterRadius, displayInnerRadius);
                for (let i = 0; i < 10; i++) { // 10 triangles for 3D-like star
                    const p1 = starVertices[i];
                    const p2 = starVertices[(i + 1) % 10];
                    const trianglePathData = `M 0,0 L ${p1[0]},${p1[1]} L ${p2[0]},${p2[1]} Z`;
                    
                    chartGroup.append("path")
                        .attr("class", "mark star-face")
                        .attr("d", trianglePathData)
                        .attr("fill", (i % 2 === 0) ? fillStyle.starDarkFaceColor : fillStyle.starLightFaceColor);
                }
            }
            
            // Dimension Label (above star)
            const topLabelY = - (maxPossibleOuterRadius + parseFloat(fillStyle.typography.labelFontSize) * 0.5 + 5); // Position above max star size
            chartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", topLabelY)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(d[dimensionFieldName]);
            
            // Value Label (below star)
            const bottomLabelY = displayOuterRadius + 5; // Position below actual star size
            const valueTextContent = valueFieldUnit ? `${formatValue(d[valueFieldName])} ${valueFieldUnit}` : formatValue(d[valueFieldName]);
            chartGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", 0)
                .attr("y", bottomLabelY)
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
    // Not applicable for this chart's current requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}