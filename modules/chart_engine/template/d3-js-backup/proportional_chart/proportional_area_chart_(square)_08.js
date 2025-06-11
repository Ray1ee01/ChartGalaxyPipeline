/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Square)",
  "chart_name": "proportional_area_chart_square_08",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["none"],
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
REQUIREMENTS_END
*/
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {}; // Used for width/height, not for minor style tweaks
    const typography = data.typography || {};
    const colors = data.colors || {}; // Or data.colors_dark if theme logic were here
    const images = data.images || {}; // Extracted per spec, though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    
    let valueUnit = dataColumns.find(col => col.role === "y")?.unit;
    if (valueUnit === "none" || valueUnit === undefined) {
        valueUnit = "";
    }

    if (!dimensionField || !valueField) {
        const missingFields = [];
        if (!dimensionField) missingFields.push("x role field (dimension)");
        if (!valueField) missingFields.push("y role field (value)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#0f223b',
        primaryShapeColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4',
        valueLabelInsideColor: '#FFFFFF',
        chartBackground: colors.background_color || '#FFFFFF', 
    };
    fillStyle.valueLabelOutsideColor = fillStyle.textColor;


    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.left = '-9999px';
        tempSvg.style.top = '-9999px';
        tempSvg.style.width = 'auto';
        tempSvg.style.height = 'auto';

        const textNode = document.createElementNS(svgNS, 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        
        tempSvg.appendChild(textNode);
        document.body.appendChild(tempSvg);
        
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            console.warn("Could not measure text width for: '" + text + "'", e);
        }
        
        document.body.removeChild(tempSvg);
        return width;
    }

    const formatValue = (value) => {
        if (value == null || isNaN(value)) return "";
        if (value === 0) return "0";

        if (Math.abs(value) >= 1000000000) {
            return d3.format(".2s")(value).replace('G', 'B');
        } else if (Math.abs(value) >= 1000000) {
            return d3.format(".2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format(".2s")(value);
        }
        return d3.format("~g")(value);
    };
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 350;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root-svg")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 20, bottom: 40, left: 20 }; 

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = chartData
        .filter(d => d[valueField] != null && typeof d[valueField] === 'number' && d[valueField] > 0)
        .sort((a, b) => b[valueField] - a[valueField]);

    if (sortedData.length === 0) {
        svgRoot.append("text")
            .attr("class", "label no-data-label")
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
    
    const maxValue = sortedData[0][valueField]; // Already filtered for >0 and sorted

    // Block 6: Scale Definition & Configuration (Implicit in layout and area calculation)
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
    const spacingFactorVertical = 0.20;   

    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    const itemRadius = Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10; 
    const maxPossibleSide = Math.max(0, itemRadius * 2); // Ensure non-negative

    const maxAllowedTextWidthForLabels = innerCellWidth * 0.95;

    let maxDimensionTextWidth = 0;
    const initialDimFontSize = parseFloat(fillStyle.typography.labelFontSize);
    sortedData.forEach(d => {
        maxDimensionTextWidth = Math.max(maxDimensionTextWidth, estimateTextWidth(
            d[dimensionField], 
            fillStyle.typography.labelFontFamily, 
            initialDimFontSize + 'px', 
            fillStyle.typography.labelFontWeight
        ));
    });
    
    let dimensionFontScale = 1;
    if (maxDimensionTextWidth > maxAllowedTextWidthForLabels && maxAllowedTextWidthForLabels > 0) {
        dimensionFontScale = maxAllowedTextWidthForLabels / maxDimensionTextWidth;
    }
    const adjustedDimensionFontSize = Math.max(8, Math.floor(initialDimFontSize * dimensionFontScale)) + 'px';

    let maxValueTextWidth = 0;
    const initialValFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    sortedData.forEach(d => {
        const text = valueUnit ? `${formatValue(d[valueField])} ${valueUnit}` : formatValue(d[valueField]);
        maxValueTextWidth = Math.max(maxValueTextWidth, estimateTextWidth(
            text, 
            fillStyle.typography.annotationFontFamily, 
            initialValFontSize + 'px', 
            fillStyle.typography.annotationFontWeight
        ));
    });

    let valueFontScale = 1;
    if (maxValueTextWidth > maxAllowedTextWidthForLabels && maxAllowedTextWidthForLabels > 0) {
        valueFontScale = maxAllowedTextWidthForLabels / maxValueTextWidth;
    }
    const adjustedValueFontSize = Math.max(7, Math.floor(initialValFontSize * valueFontScale)) + 'px';

    // Block 7: Chart Component Rendering (No Axes, Gridlines, Legend for this chart type)

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other") // "other" for group as per VII
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2; 

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const d = sortedData[dataIndex];

            const cellCenterX = rowOffset + (c + 0.5) * cellWidth;
            const cellCenterY = (r + 0.5) * cellHeight;

            const chartItemGroup = mainChartGroup.append("g")
                .attr("class", "other chart-item-group") 
                .attr("transform", `translate(${cellCenterX}, ${cellCenterY})`);

            const proportionalSide = maxValue > 0 ? maxPossibleSide * Math.sqrt(d[valueField] / maxValue) : 0;
            
            let displaySide = proportionalSide;
            if (proportionalSide > 0 && proportionalSide < 10) { 
                displaySide = 10;
            }
            if (displaySide <= 0) { 
                dataIndex++;
                continue;
            }

            chartItemGroup.append("rect")
                .attr("class", "mark square-mark")
                .attr("x", -displaySide / 2)
                .attr("y", -displaySide / 2) 
                .attr("width", displaySide)
                .attr("height", displaySide)
                .attr("fill", fillStyle.primaryShapeColor)
                .style("opacity", 0.9);

            chartItemGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -itemRadius - 10) 
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "alphabetic") // Or "text-bottom" then adjust dy
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(d[dimensionField]);

            const valueTextContent = valueUnit ? `${formatValue(d[valueField])} ${valueUnit}` : formatValue(d[valueField]);
            
            // Estimate width with potentially adjusted font size for placement decision
            const valueLabelWidthForPlacement = estimateTextWidth(
                valueTextContent,
                fillStyle.typography.annotationFontFamily,
                adjustedValueFontSize, // Use the already scaled font size
                fillStyle.typography.annotationFontWeight
            );
            const valueLabelHeightForPlacement = parseFloat(adjustedValueFontSize);


            const canFitInside = displaySide >= 15 && 
                                 valueLabelWidthForPlacement < displaySide * 0.85 && 
                                 valueLabelHeightForPlacement < displaySide * 0.85;

            const valueLabelElement = chartItemGroup.append("text")
                .attr("class", "label value-label")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", adjustedValueFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(valueTextContent);

            if (canFitInside) {
                valueLabelElement
                    .attr("x", 0)
                    .attr("y", 0) 
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "central") 
                    .style("fill", fillStyle.valueLabelInsideColor);
            } else {
                valueLabelElement
                    .attr("x", 0)
                    .attr("y", (displaySide / 2) + 3) 
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging") 
                    .style("fill", fillStyle.valueLabelOutsideColor);
            }
            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects, shadows, gradients, or patterns.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}