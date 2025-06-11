/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Hexagon)",
  "chart_name": "proportional_area_chart_hexagon_02",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldRole = "x";
    const valueFieldRole = "y";

    const dimensionColumn = dataColumns.find(col => col.role === dimensionFieldRole);
    const valueColumn = dataColumns.find(col => col.role === valueFieldRole);

    const dimensionFieldName = dimensionColumn ? dimensionColumn.name : undefined;
    const valueFieldName = valueColumn ? valueColumn.name : undefined;
    
    let valueUnitName = "";
    if (valueColumn && valueColumn.unit && valueColumn.unit !== "none") {
        valueUnitName = valueColumn.unit;
    }

    if (!dimensionFieldName || !valueFieldName) {
        let missingFields = [];
        if (!dimensionFieldName) missingFields.push(`role '${dimensionFieldRole}' (name)`);
        if (!valueFieldName) missingFields.push(`role '${valueFieldRole}' (name)`);
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypographyStyles = {
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const defaultColorStyles = {
        primary: "#1f77b4",
        text: "#333333",
        background: "#FFFFFF"
    };

    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || defaultTypographyStyles.label.font_family,
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || defaultTypographyStyles.label.font_size,
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || defaultTypographyStyles.label.font_weight,
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || defaultTypographyStyles.annotation.font_family,
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || defaultTypographyStyles.annotation.font_size,
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || defaultTypographyStyles.annotation.font_weight,
        },
        primaryColor: (rawColors.other && rawColors.other.primary) || defaultColorStyles.primary,
        textColor: rawColors.text_color || defaultColorStyles.text,
        backgroundColor: rawColors.background_color || defaultColorStyles.background
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            console.warn("Could not estimate text width using in-memory SVG. Using fallback.", e);
            width = String(text).length * (parseFloat(fontSize) * 0.6); // Rough estimate
        }
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    const hexagonPathGenerator = (radius) => {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = ((i * 60) + 30) * Math.PI / 180; // Start at 30 deg for flat top
            const x = radius * Math.sin(angle);
            const y = -radius * Math.cos(angle);
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
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.margin_top || 100, 
        right: variables.margin_right || 30, 
        bottom: variables.margin_bottom || 80, 
        left: variables.margin_left || 30 
    };
    
    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartData
        .filter(d => d[valueFieldName] != null && typeof d[valueFieldName] === 'number' && d[valueFieldName] > 0)
        .sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    const maxValue = processedChartData.length > 0 ? processedChartData[0][valueFieldName] : 0;
    const numCharts = processedChartData.length;

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
    
    const cellWidth = chartAreaWidth / cols;
    const cellHeight = chartAreaHeight / rows;
    
    const spacingFactorHorizontal = 0.15;
    const spacingFactorVertical = 0.15;
    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    const maxCellRadius = Math.max(10, Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10);

    // Block 6: Scale Definition & Configuration (Font size adjustment)
    let maxDimensionTextWidth = 0;
    let maxValueTextWidth = 0;

    processedChartData.forEach(d => {
        maxDimensionTextWidth = Math.max(maxDimensionTextWidth, estimateTextWidth(d[dimensionFieldName], fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight));
        const valueText = valueUnitName ? `${formatValue(d[valueFieldName])} ${valueUnitName}` : formatValue(d[valueFieldName]);
        maxValueTextWidth = Math.max(maxValueTextWidth, estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight));
    });
    
    const textLayoutWidth = maxCellRadius * 2.8; 
    
    const baseDimensionFontSize = parseFloat(fillStyle.typography.labelFontSize);
    let dimensionScaleFactor = 1;
    if (maxDimensionTextWidth > textLayoutWidth && textLayoutWidth > 0) {
        dimensionScaleFactor = textLayoutWidth / (maxDimensionTextWidth + 3);
    }
    const adjustedDimensionFontSize = `${Math.max(8, Math.floor(baseDimensionFontSize * dimensionScaleFactor))}px`;

    const baseValueFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    let valueScaleFactor = 1;
    if (maxValueTextWidth > textLayoutWidth && textLayoutWidth > 0) {
        valueScaleFactor = textLayoutWidth / (maxValueTextWidth + 3);
    }
    const adjustedValueFontSize = `${Math.max(7, Math.floor(baseValueFontSize * valueScaleFactor))}px`;

    // Block 7: Chart Component Rendering (Not applicable)

    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const d = processedChartData[dataIndex];
            
            const chartCenterX = chartMargins.left + rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (r + 0.5) * cellHeight;
            
            const chartGroup = svgRoot.append("g")
                .attr("class", "mark-group")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);
            
            const proportionalRadius = maxValue > 0 ? maxCellRadius * Math.sqrt(d[valueFieldName] / maxValue) : 0;
            let displayRadius = proportionalRadius;
            if (proportionalRadius > 0 && proportionalRadius < 10) {
                displayRadius = 10;
            }
            displayRadius = Math.max(0, displayRadius); // Ensure non-negative

            if (displayRadius > 0) {
                const iconUrl = rawImages.field && rawImages.field[d[dimensionFieldName]] ? rawImages.field[d[dimensionFieldName]] : null;
                const clipId = `clip-hex-${dataIndex}`;

                defs.append("clipPath")
                    .attr("id", clipId)
                    .append("path")
                    .attr("d", hexagonPathGenerator(displayRadius));
                
                if (iconUrl) {
                    chartGroup.append("path") // Background for icon, e.g., if icon is transparent
                        .attr("d", hexagonPathGenerator(displayRadius))
                        .attr("class", "mark hexagon-background")
                        .attr("fill", "white"); 

                    const imageSize = displayRadius * 2.3; 
                    chartGroup.append("image")
                        .attr("class", "image hexagon-image")
                        .attr("x", -imageSize / 2)
                        .attr("y", -imageSize / 2)
                        .attr("width", imageSize)
                        .attr("height", imageSize)
                        .attr("xlink:href", iconUrl)
                        .attr("preserveAspectRatio", "xMidYMid slice")
                        .attr("clip-path", `url(#${clipId})`);
                } else {
                    chartGroup.append("path")
                        .attr("d", hexagonPathGenerator(displayRadius))
                        .attr("class", "mark hexagon")
                        .attr("fill", fillStyle.primaryColor);
                }
            }
            
            chartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -maxCellRadius - 10) 
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(d[dimensionFieldName]);
            
            const valueTextContent = valueUnitName ? `${formatValue(d[valueFieldName])} ${valueUnitName}` : formatValue(d[valueFieldName]);
            chartGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", 0)
                .attr("y", (displayRadius > 0 ? displayRadius : 0) + 8) // Position below hexagon, or at base if no hexagon
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
    // None

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}