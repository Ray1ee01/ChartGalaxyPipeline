/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Gauge Chart",
  "chart_name": "multiple_gauge_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 10], [0, "inf"]],
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
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || (data.colors_dark || {});
    const images = data.images || {}; // Not used, but adhere to structure
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    const dimensionFieldName = dimensionColumn?.name;
    const valueFieldName = valueColumn?.name;

    if (!dimensionFieldName || !valueFieldName) {
        let missingFields = [];
        if (!dimensionFieldName) missingFields.push("'x' role (dimension)");
        if (!valueFieldName) missingFields.push("'y' role (value)");
        const errorMessage = `Critical chart config missing: Required field name(s) for ${missingFields.join(' and ')} not found in dataColumns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>Error: ${errorMessage}</div>`);
        }
        return null;
    }

    if (!chartDataArray || chartDataArray.length === 0) {
        const warningMessage = "No data provided to render the chart.";
        console.warn(warningMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>Warning: ${warningMessage}</div>`);
        }
        return null; 
    }
    
    const dimensionUnit = dimensionColumn && dimensionColumn.unit && dimensionColumn.unit !== "none" ? dimensionColumn.unit : "";
    const valueUnit = valueColumn && valueColumn.unit && valueColumn.unit !== "none" ? valueColumn.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colors.text_color || '#333333',
        primaryGaugeColor: colors.other && colors.other.primary ? colors.other.primary : '#FF4136',
        dialColor: colors.text_color || '#333333',
        backgroundColor: colors.background_color || 'transparent', // Default to transparent
        typography: {
            dimensionLabelFontFamily: typography.label && typography.label.font_family ? typography.label.font_family : 'Arial, sans-serif',
            dimensionLabelFontSize: typography.label && typography.label.font_size ? typography.label.font_size : '14px',
            dimensionLabelFontWeight: typography.label && typography.label.font_weight ? typography.label.font_weight : 'normal',
            valueLabelFontFamily: typography.annotation && typography.annotation.font_family ? typography.annotation.font_family : 'Arial, sans-serif',
            valueLabelFontSize: typography.annotation && typography.annotation.font_size ? typography.annotation.font_size : '12px',
            valueLabelFontWeight: typography.annotation && typography.annotation.font_weight ? typography.annotation.font_weight : 'normal',
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
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
            console.warn(`Could not estimate text width using in-memory SVG for text: "${text}". Error: ${e.message}. Using fallback.`);
            width = text.length * (parseFloat(fontSize) * 0.6); // Fallback: rough estimate
        }
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 350;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root-svg")
        .style("background-color", fillStyle.backgroundColor)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { // Preserving original margins to maintain visual output consistency
        top: 100,
        right: 30,
        bottom: 80,
        left: 30
    };

    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const numCharts = chartDataArray.length;
    let rows, cols;

    // Determine grid layout (rows and columns)
    if (numCharts <= 0) { // Should have been caught by early exit, but defensive
        return svgRoot.node(); // Render empty SVG if somehow passed
    } else if (numCharts <= 3) { rows = 1; cols = numCharts; } 
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
    
    let maxDimensionWidth = 0;
    let maxValueWidth = 0;

    chartDataArray.forEach(d => {
        const dimText = String(d[dimensionFieldName] === null || d[dimensionFieldName] === undefined ? "" : d[dimensionFieldName]);
        const valText = valueUnit ? `${d[valueFieldName]} ${valueUnit}` : String(d[valueFieldName] === null || d[valueFieldName] === undefined ? "" : d[valueFieldName]);

        maxDimensionWidth = Math.max(maxDimensionWidth, estimateTextWidth(
            dimText, 
            fillStyle.typography.dimensionLabelFontFamily, 
            fillStyle.typography.dimensionLabelFontSize, 
            fillStyle.typography.dimensionLabelFontWeight
        ));
        maxValueWidth = Math.max(maxValueWidth, estimateTextWidth(
            valText, 
            fillStyle.typography.valueLabelFontFamily, 
            fillStyle.typography.valueLabelFontSize, 
            fillStyle.typography.valueLabelFontWeight
        ));
    });
    
    const spacingFactorHorizontal = 0.15; // Original factor
    const spacingFactorVertical = 0.15;   // Original factor

    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    const radius = Math.max(5, Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10); // Ensure radius is positive

    const maxChartAreaWidthForText = radius * 2.4; 
    let dimensionScaleFactor = 1;
    if (maxDimensionWidth > maxChartAreaWidthForText && maxChartAreaWidthForText > 0) {
        dimensionScaleFactor = maxChartAreaWidthForText / (maxDimensionWidth + 3);
    }
    
    let valueScaleFactor = 1;
    if (maxValueWidth > maxChartAreaWidthForText && maxChartAreaWidthForText > 0) {
        valueScaleFactor = maxChartAreaWidthForText / (maxValueWidth + 3);
    }

    const baseDimensionFontSize = parseFloat(fillStyle.typography.dimensionLabelFontSize);
    const baseValueFontSize = parseFloat(fillStyle.typography.valueLabelFontSize);

    // Ensure minimum font size (e.g., 6px) to prevent overly small text
    const adjustedDimensionFontSize = `${Math.max(6, Math.floor(baseDimensionFontSize * dimensionScaleFactor))}px`;
    const adjustedValueFontSize = `${Math.max(6, Math.floor(baseValueFontSize * valueScaleFactor))}px`;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray].sort((a, b) => (b[valueFieldName] || 0) - (a[valueFieldName] || 0));
    
    const maxValueAll = sortedData.length > 0 ? (sortedData[0][valueFieldName] || 0) : 0;
    const maxAngle = 290 * (Math.PI / 180); // ~80% of a circle, in radians

    // Block 6: Scale Definition & Configuration
    // Implicit scales via angle calculations.

    // Block 7: Chart Component Rendering (Gauge Dial - rendered per gauge in Block 8)
    // No global components like axes or legends here.

    // Block 8: Main Data Visualization Rendering (Gauges and Labels)
    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2; 

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const d = sortedData[dataIndex];

            const chartCenterX = chartMargins.left + rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (r + 0.5) * cellHeight;

            const gaugeGroup = svgRoot.append("g")
                .attr("class", "mark gauge-group")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            // Render Gauge Dial
            gaugeGroup.append("circle")
                .attr("class", "other gauge-dial-outline")
                .attr("r", radius)
                .attr("fill", "none")
                .attr("stroke", fillStyle.dialColor)
                .attr("stroke-width", 1.5);

            const tickLength = radius * 0.07;
            const tickPositions = [
                { x1: 0, y1: -radius, x2: 0, y2: -(radius - tickLength) }, // Top
                { x1: radius, y1: 0, x2: radius - tickLength, y2: 0 },     // Right
                { x1: 0, y1: radius, x2: 0, y2: radius - tickLength },   // Bottom
                { x1: -radius, y1: 0, x2: -(radius - tickLength), y2: 0 }  // Left
            ];
            tickPositions.forEach(pos => {
                gaugeGroup.append("line")
                    .attr("class", "other gauge-dial-tick")
                    .attr("x1", pos.x1).attr("y1", pos.y1)
                    .attr("x2", pos.x2).attr("y2", pos.y2)
                    .attr("stroke", fillStyle.dialColor)
                    .attr("stroke-width", 1.5);
            });

            // Render Gauge Arc
            const currentValue = d[valueFieldName] || 0;
            const percent = maxValueAll > 0 ? currentValue / maxValueAll : 0;
            const angle = percent * maxAngle;

            const arcGenerator = d3.arc()
                .innerRadius(0)
                .outerRadius(radius * 0.9) 
                .startAngle(0) // Original: Starts at 3 o'clock
                .endAngle(0 - angle); // Original: Sweeps counter-clockwise

            gaugeGroup.append("path")
                .attr("class", "mark gauge-arc")
                .attr("d", arcGenerator())
                .attr("fill", fillStyle.primaryGaugeColor)
                .style("opacity", 0.85); // Original opacity

            // Render Labels
            const dimensionText = String(d[dimensionFieldName] === null || d[dimensionFieldName] === undefined ? "" : d[dimensionFieldName]);
            gaugeGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -radius - 10) 
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.dimensionLabelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.dimensionLabelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(dimensionText);
            
            const valueText = valueUnit ? `${currentValue} ${valueUnit}` : String(currentValue);
            gaugeGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", 0)
                .attr("y", radius + 15) // Original positioning
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.valueLabelFontFamily)
                .style("font-size", adjustedValueFontSize)
                .style("font-weight", fillStyle.typography.valueLabelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(valueText);

            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // Removed svg2roughjs, shadow, and stroke effects.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}