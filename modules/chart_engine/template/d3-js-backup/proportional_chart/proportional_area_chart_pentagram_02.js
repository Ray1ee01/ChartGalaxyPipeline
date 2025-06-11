/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (pentagram)",
  "chart_name": "proportional_area_chart_pentagram_02",
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
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a grid of proportional pentagrams, where each pentagram's area
    // represents a value. Icons can be displayed in the center of the pentagrams.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const C_typography = data.typography || {};
    const C_colors = data.colors || {};
    const C_images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;
    let valueFieldUnit = (dataColumns.find(col => col.role === "y" && col.unit && col.unit !== "none") || {}).unit || "";

    if (!dimensionFieldName || !valueFieldName) {
        const missingFields = [];
        if (!dimensionFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (C_typography.label && C_typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (C_typography.label && C_typography.label.font_size) || '14px',
            labelFontWeight: (C_typography.label && C_typography.label.font_weight) || 'normal',
            annotationFontFamily: (C_typography.annotation && C_typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (C_typography.annotation && C_typography.annotation.font_size) || '12px',
            annotationFontWeight: (C_typography.annotation && C_typography.annotation.font_weight) || 'normal',
        },
        textColor: C_colors.text_color || '#333333',
        primaryMarkColor: (C_colors.other && C_colors.other.primary) || '#FFD700', // Gold default
        chartBackground: C_colors.background_color || 'transparent', // Assuming transparent if not specified
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        svg.style.width = 'auto';
        svg.style.height = 'auto';
        // No need to append to DOM for getBBox if attributes are set directly on text element

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Document body append/remove is more robust for getBBox in some edge cases,
        // but trying without first as per spec. If issues, this might need adjustment.
        // For simple text, direct attribute setting and no append should work.
        // Let's ensure it's appended to a temporary SVG in memory that itself is not in DOM.
        // The created 'svg' element is already in memory and not in DOM.
        return textElement.getBBox().width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    function getStarPoints(numArms, outerR, innerR) {
        const points = [];
        const angleStep = Math.PI / numArms;
        for (let i = 0; i < 2 * numArms; i++) {
            const r = (i % 2 === 0) ? outerR : innerR;
            const currentAngle = i * angleStep - (Math.PI / 2); // Start pointing up
            const x = r * Math.cos(currentAngle);
            const y = r * Math.sin(currentAngle);
            points.push([x, y]);
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
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root other");

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 20, bottom: 60, left: 20 }; // Adjusted for labels outside stars

    // Data preprocessing is done before some layout calcs that depend on numCharts
    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData
        .filter(d => d[valueFieldName] != null && d[valueFieldName] > 0)
        .sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    const numCharts = chartDataArray.length;
    if (numCharts === 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "label text")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No data to display.");
        return svgRoot.node();
    }
    
    const maxValue = chartDataArray.length > 0 ? chartDataArray[0][valueFieldName] : 0;

    // Continue Block 4: Layout Calculation
    let gridRows, gridCols;
    if (numCharts <= 3) { gridRows = 1; gridCols = numCharts; }
    else if (numCharts === 4) { gridRows = 2; gridCols = 2; }
    else if (numCharts <= 8) { gridRows = 2; gridCols = Math.ceil(numCharts / 2); }
    else if (numCharts <= 12) { gridRows = 3; gridCols = Math.ceil(numCharts / 3); }
    else { gridRows = 4; gridCols = Math.ceil(numCharts / 4); }

    const itemsPerRowDistribution = [];
    for (let i = 0; i < gridRows; i++) {
        itemsPerRowDistribution.push(i < gridRows - 1 ? gridCols : numCharts - gridCols * (gridRows - 1));
    }

    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const cellWidth = chartAreaWidth / gridCols;
    const cellHeight = chartAreaHeight / gridRows;

    const initialLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const initialAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    let maxDimensionTextWidth = 0;
    let maxAnnotationTextWidth = 0;

    chartDataArray.forEach(d => {
        maxDimensionTextWidth = Math.max(maxDimensionTextWidth, estimateTextWidth(d[dimensionFieldName], fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight));
        const valueString = valueFieldUnit ? `${formatValue(d[valueFieldName])} ${valueFieldUnit}` : formatValue(d[valueFieldName]);
        maxAnnotationTextWidth = Math.max(maxAnnotationTextWidth, estimateTextWidth(valueString, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight));
    });
    
    const horizontalSpacingFactor = 0.15;
    const verticalSpacingFactor = 0.15; 
    const innerCellWidth = cellWidth * (1 - horizontalSpacingFactor);
    const innerCellHeightAvailableForStar = cellHeight * (1 - verticalSpacingFactor) - initialLabelFontSize - initialAnnotationFontSize - 15; // Approx space for labels

    const maxStarDiameter = Math.min(innerCellWidth, innerCellHeightAvailableForStar);
    const cellRadiusForStar = Math.max(10, maxStarDiameter / 2); // Max radius for the star itself

    let dimensionFontScaleFactor = 1;
    if (maxDimensionTextWidth > innerCellWidth * 0.9) { // Allow text to be slightly wider than star
        dimensionFontScaleFactor = (innerCellWidth * 0.9) / maxDimensionTextWidth;
    }
    let annotationFontScaleFactor = 1;
    if (maxAnnotationTextWidth > innerCellWidth * 0.9) {
        annotationFontScaleFactor = (innerCellWidth * 0.9) / maxAnnotationTextWidth;
    }

    const finalLabelFontSize = `${Math.floor(initialLabelFontSize * dimensionFontScaleFactor)}px`;
    const finalAnnotationFontSize = `${Math.floor(initialAnnotationFontSize * annotationFontScaleFactor)}px`;
    
    // Block 6: Scale Definition & Configuration
    // Proportional area scaling: radius is proportional to sqrt(value)
    // No explicit D3 scales for axes are used.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other");

    const starInnerRadiusRatio = 0.4; // Pointiness of the star
    const minOuterRadiusForDisplay = 8; // Minimum visual size for a star

    let dataItemIndex = 0;
    for (let r = 0; r < gridRows; r++) {
        const itemsInCurrentRow = itemsPerRowDistribution[r];
        const rowHorizontalOffset = (gridCols - itemsInCurrentRow) * cellWidth / 2;
        for (let c = 0; c < itemsInCurrentRow; c++) {
            if (dataItemIndex >= numCharts) break;
            const d = chartDataArray[dataItemIndex];

            const cellCenterX = rowHorizontalOffset + (c + 0.5) * cellWidth;
            const cellCenterY = (r + 0.5) * cellHeight;

            const itemGroup = mainChartGroup.append("g")
                .attr("transform", `translate(${cellCenterX}, ${cellCenterY})`)
                .attr("class", "chart-item other");

            const proportionalOuterRadius = maxValue > 0 ? cellRadiusForStar * Math.sqrt(d[valueFieldName] / maxValue) : 0;
            
            let displayOuterRadius = proportionalOuterRadius;
            if (proportionalOuterRadius > 0 && proportionalOuterRadius < minOuterRadiusForDisplay) {
                displayOuterRadius = minOuterRadiusForDisplay;
            }
            const displayInnerRadius = displayOuterRadius * starInnerRadiusRatio;

            if (displayOuterRadius > 0) {
                const starVertices = getStarPoints(5, displayOuterRadius, displayInnerRadius);
                const starPathData = d3.line()(starVertices) + "Z";

                itemGroup.append("path")
                    .attr("d", starPathData)
                    .attr("fill", fillStyle.primaryMarkColor)
                    .attr("class", "mark");

                const iconUrl = C_images.field && C_images.field[d[dimensionFieldName]] ? C_images.field[d[dimensionFieldName]] : null;
                if (iconUrl && displayInnerRadius > 5) { // Only show icon if inner radius is reasonably large
                    const innerPentagonVertices = [
                        starVertices[1], starVertices[3], starVertices[5], starVertices[7], starVertices[9]
                    ];
                    const clipId = `clip-pentagon-${dataItemIndex}`;

                    defs.append("clipPath")
                        .attr("id", clipId)
                        .append("polygon")
                        .attr("points", innerPentagonVertices.map(p => p.join(",")).join(" "));

                    const iconSize = displayInnerRadius * 2 * 0.9; // Icon slightly smaller than inner pentagon diameter
                    itemGroup.append("image")
                        .attr("x", -iconSize / 2)
                        .attr("y", -iconSize / 2)
                        .attr("width", iconSize)
                        .attr("height", iconSize)
                        .attr("xlink:href", iconUrl)
                        .attr("preserveAspectRatio", "xMidYMid meet")
                        .attr("clip-path", `url(#${clipId})`)
                        .attr("class", "icon image");
                }
            }
            
            // Dimension Label (above star)
            itemGroup.append("text")
                .attr("x", 0)
                .attr("y", -cellRadiusForStar - (parseFloat(finalLabelFontSize)/2) - 2) // Position above star area
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", finalLabelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .attr("class", "label text")
                .text(d[dimensionFieldName]);
            
            // Value Label (below star)
            const valueTextContent = valueFieldUnit ? `${formatValue(d[valueFieldName])} ${valueFieldUnit}` : formatValue(d[valueFieldName]);
            itemGroup.append("text")
                .attr("x", 0)
                .attr("y", displayOuterRadius + parseFloat(finalAnnotationFontSize) + 2) // Position below star
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", finalAnnotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .attr("class", "value text")
                .text(valueTextContent);
            
            dataItemIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // Icon rendering is integrated into Block 8. No further enhancements here.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}