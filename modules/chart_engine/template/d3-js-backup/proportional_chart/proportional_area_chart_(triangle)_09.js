/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Triangle)",
  "chart_name": "proportional_area_chart_triangle_09",
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
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!dimensionFieldName || !valueFieldName) {
        let missingFields = [];
        if (!dimensionFieldName) missingFields.push("field with role 'x'");
        if (!valueFieldName) missingFields.push("field with role 'y'");
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        return null;
    }

    const valueFieldDefinition = dataColumns.find(col => col.role === "y");
    const valueUnit = (valueFieldDefinition?.unit && valueFieldDefinition.unit !== "none") ? valueFieldDefinition.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyInput.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyInput.label?.font_size || "12px",
            labelFontWeight: typographyInput.label?.font_weight || "normal",
            annotationFontFamily: typographyInput.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyInput.annotation?.font_size || "10px",
            annotationFontWeight: typographyInput.annotation?.font_weight || "normal",
        },
        textColor: colorsInput.text_color || "#0f223b",
        primaryColor: colorsInput.other?.primary || "#1f77b4",
        chartBackground: colorsInput.background_color || "#FFFFFF", // Not used for SVG bg, but good for consistency
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail for non-attached SVGs
            width = text.length * (parseFloat(fontProps.fontSize) || 10) * 0.6;
        }
        return width;
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
            [0, -height * 2 / 3],
            [sideLength / 2, height * 1 / 3],
            [-sideLength / 2, height * 1 / 3]
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
        .style("background-color", fillStyle.chartBackground); // Optional: set background if desired

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 100, right: 30, bottom: 80, left: 30 }; // Adjusted based on original
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput
        .filter(d => d[valueFieldName] > 0)
        .sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    const maxValue = chartDataArray.length > 0 ? chartDataArray[0][valueFieldName] : 0;
    const numCharts = chartDataArray.length;

    if (numCharts === 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
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
    const spacingFactorVertical = 0.15;
    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    const radius = Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10;

    // Block 6: Scale Definition & Configuration (Text scaling)
    let maxDimensionTextWidth = 0;
    let maxValueTextWidth = 0;

    chartDataArray.forEach(d => {
        maxDimensionTextWidth = Math.max(maxDimensionTextWidth, estimateTextWidth(d[dimensionFieldName], {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        }));
        const valueTextContent = valueUnit ? `${formatValue(d[valueFieldName])} ${valueUnit}` : formatValue(d[valueFieldName]);
        maxValueTextWidth = Math.max(maxValueTextWidth, estimateTextWidth(valueTextContent, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        }));
    });

    const maxChartAreaWidthForText = radius * 2.8; 
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

    // Block 7: Chart Component Rendering (No axes, gridlines, legend for this chart)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let row = 0; row < rows; row++) {
        const itemsInThisRow = itemsPerRow[row];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;
        for (let colIdx = 0; colIdx < itemsInThisRow; colIdx++) {
            if (dataIndex >= numCharts) break;
            const d = chartDataArray[dataIndex];
            
            const chartCenterX = chartMargins.left + rowOffset + (colIdx + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (row + 0.5) * cellHeight;
            
            const chartItemGroup = svgRoot.append("g")
                .attr("class", "mark")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);
            
            const maxPossibleSide = radius * 2;
            const proportionalSide = maxValue > 0 ? maxPossibleSide * Math.sqrt(d[valueFieldName] / maxValue) : 0;
            
            let displaySide = proportionalSide;
            if (proportionalSide > 0 && proportionalSide < 12) { // Minimum visual size
                displaySide = 12;
            }

            if (displaySide > 0) {
                const iconUrl = imagesInput.field?.[d[dimensionFieldName]];
                
                const triangleHeightGeom = displaySide * Math.sqrt(3) / 2; 
                const inCircleRadius = displaySide * Math.sqrt(3) / 6;
                
                if (iconUrl) {
                    const clipId = `clip-triangle-icon-${dataIndex}`;
                    defs.append("clipPath")
                        .attr("id", clipId)
                        .append("circle")
                        .attr("cx", 0)
                        .attr("cy", 0) // Centroid of trianglePath is at 0,0
                        .attr("r", inCircleRadius);
                    
                    // Background triangle for icon
                    chartItemGroup.append("path")
                        .attr("d", trianglePath(displaySide))
                        .attr("fill", "white") // Standard background for icon container
                        .attr("class", "mark background-shape");

                    const iconBoxSize = inCircleRadius * 2.5; // Ensure icon covers the circle
                    chartItemGroup.append("image")
                        .attr("class", "icon")
                        .attr("x", -iconBoxSize / 2)
                        .attr("y", -iconBoxSize / 2)
                        .attr("width", iconBoxSize)
                        .attr("height", iconBoxSize)
                        .attr("xlink:href", iconUrl)
                        .attr("preserveAspectRatio", "xMidYMid slice")
                        .attr("clip-path", `url(#${clipId})`);
                } else {
                    chartItemGroup.append("path")
                        .attr("d", trianglePath(displaySide))
                        .attr("fill", fillStyle.primaryColor)
                        .style("opacity", 0.85)
                        .attr("class", "mark shape");
                }
            }
            
            // Block 9: Optional Enhancements & Post-Processing (Labels)
            chartItemGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -radius - 10) // Position above the shape's max bounding box in cell
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(d[dimensionFieldName]);
            
            const currentTriangleHeight = displaySide * Math.sqrt(3) / 2;
            const valueTextContent = valueUnit ? `${formatValue(d[valueFieldName])} ${valueUnit}` : formatValue(d[valueFieldName]);
            
            chartItemGroup.append("text")
                .attr("class", "value data-value-label")
                .attr("x", 0)
                .attr("y", currentTriangleHeight * 1/3 + 5) // Position below triangle base
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
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}