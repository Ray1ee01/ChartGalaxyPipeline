/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Gauge Chart",
  "chart_name": "multiple_gauge_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data.data;
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    // const imagesConfig = data.images || {}; // Not used in this chart
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldRole = "x";
    const valueFieldRole = "y";

    const dimensionColumn = dataColumns.find(col => col.role === dimensionFieldRole);
    const valueColumn = dataColumns.find(col => col.role === valueFieldRole);

    if (!dimensionColumn || !valueColumn) {
        const missingRoles = [];
        if (!dimensionColumn) missingRoles.push(dimensionFieldRole);
        if (!valueColumn) missingRoles.push(valueFieldRole);
        const errorMessage = `Critical chart config missing: Roles '${missingRoles.join("', '")}' not found in dataColumns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const dimensionFieldName = dimensionColumn.name;
    const valueFieldName = valueColumn.name;

    if (!chartDataInput || chartDataInput.some(d => typeof d[dimensionFieldName] === 'undefined' || typeof d[valueFieldName] === 'undefined')) {
        const errorMessage = `Critical chart data missing: Field '${dimensionFieldName}' or '${valueFieldName}' not found in some data objects. Cannot render.`;
        console.error(errorMessage);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        }
        return null;
    }
    
    const dimensionUnit = (dimensionColumn.unit && dimensionColumn.unit !== "none") ? dimensionColumn.unit : "";
    const valueUnit = (valueColumn.unit && valueColumn.unit !== "none") ? ` ${valueColumn.unit}` : "";


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            dimensionLabel: {
                font_family: (typographyConfig.label && typographyConfig.label.font_family) || "Arial, sans-serif",
                font_size: (typographyConfig.label && typographyConfig.label.font_size) || "12px",
                font_weight: (typographyConfig.label && typographyConfig.label.font_weight) || "normal",
            },
            valueLabel: {
                font_family: (typographyConfig.annotation && typographyConfig.annotation.font_family) || "Arial, sans-serif",
                font_size: (typographyConfig.annotation && typographyConfig.annotation.font_size) || "10px",
                font_weight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || "normal",
            }
        },
        primaryColor: (colorsConfig.other && colorsConfig.other.primary) || "#FF4136",
        textColor: colorsConfig.text_color || "#333333",
        gaugeDialColor: colorsConfig.text_color || "#333333",
        chartBackground: colorsConfig.background_color || "transparent", // Though not explicitly used for SVG background
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.font_family);
        textElement.setAttribute('font-size', fontProps.font_size);
        textElement.setAttribute('font-weight', fontProps.font_weight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // Note: Not appending to DOM as per requirements. getBBox on in-memory elements is generally supported.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            const fontSize = parseFloat(fontProps.font_size) || 12;
            return text.length * fontSize * 0.6; // Crude fallback
        }
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
        .style("background-color", fillStyle.chartBackground); // Apply background color if specified

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin_top || 60, // Adjusted for typical label height
        right: variables.margin_right || 30,
        bottom: variables.margin_bottom || 60, // Adjusted for typical label height
        left: variables.margin_left || 30
    };
    
    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const numCharts = chartDataInput.length;
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
    
    // Radius calculation accounts for labels above/below, hence the 2.2 factor and padding
    const gaugeRadius = Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10;


    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = [...chartDataInput].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const maxValue = chartDataArray.length > 0 ? chartDataArray[0][valueFieldName] : 0;
    const maxAngle = 290 * (Math.PI / 180); // Approx 80% of a circle, in radians

    // Font size adjustment based on available space
    let maxDimensionWidth = 0;
    let maxValueWidth = 0;

    chartDataArray.forEach(d => {
        maxDimensionWidth = Math.max(maxDimensionWidth, estimateTextWidth(d[dimensionFieldName], fillStyle.typography.dimensionLabel));
        maxValueWidth = Math.max(maxValueWidth, estimateTextWidth(d[valueFieldName] + valueUnit, fillStyle.typography.valueLabel));
    });
    
    const maxChartAreaWidthForText = gaugeRadius * 2.4; // Max width available for text labels under/over gauge
    let dimensionScaleFactor = 1;
    if (maxDimensionWidth > maxChartAreaWidthForText) {
        dimensionScaleFactor = maxChartAreaWidthForText / (maxDimensionWidth + 3); // +3 for a little padding
    }
    let valueScaleFactor = 1;
    if (maxValueWidth > maxChartAreaWidthForText) {
        valueScaleFactor = maxChartAreaWidthForText / (maxValueWidth + 3);
    }

    const adjustedDimensionFontSize = `${Math.floor(parseFloat(fillStyle.typography.dimensionLabel.font_size) * dimensionScaleFactor)}px`;
    const adjustedValueFontSize = `${Math.floor(parseFloat(fillStyle.typography.valueLabel.font_size) * valueScaleFactor)}px`;


    // Block 6: Scale Definition & Configuration
    // Scales are implicit in angle calculation and layout. No explicit D3 scale objects for axes.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No global axes or legend for this chart type. Ticks are part of each gauge.

    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2; // Center rows with fewer items

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const d = chartDataArray[dataIndex];

            const chartCenterX = chartMargins.left + rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (r + 0.5) * cellHeight;

            const gaugeGroup = svgRoot.append("g")
                .attr("class", "mark gauge-group")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            // Gauge Dial
            gaugeGroup.append("circle")
                .attr("class", "mark gauge-dial")
                .attr("r", gaugeRadius)
                .attr("fill", "none")
                .attr("stroke", fillStyle.gaugeDialColor)
                .attr("stroke-width", 1.5);

            // Tick Marks
            const tickLength = gaugeRadius * 0.07;
            const tickPositions = [
                { x1: 0, y1: -gaugeRadius, x2: 0, y2: -(gaugeRadius - tickLength) }, // Top
                { x1: gaugeRadius, y1: 0, x2: gaugeRadius - tickLength, y2: 0 },     // Right
                { x1: 0, y1: gaugeRadius, x2: 0, y2: gaugeRadius - tickLength },   // Bottom
                { x1: -gaugeRadius, y1: 0, x2: -(gaugeRadius - tickLength), y2: 0 }  // Left
            ];
            tickPositions.forEach(pos => {
                gaugeGroup.append("line")
                    .attr("class", "mark gauge-tick")
                    .attr("x1", pos.x1).attr("y1", pos.y1)
                    .attr("x2", pos.x2).attr("y2", pos.y2)
                    .attr("stroke", fillStyle.gaugeDialColor)
                    .attr("stroke-width", 1.5);
            });

            // Gauge Arc (Value)
            const valueRatio = maxValue === 0 ? 0 : d[valueFieldName] / maxValue;
            const angle = valueRatio * maxAngle;

            const arcGenerator = d3.arc()
                .innerRadius(0)
                .outerRadius(gaugeRadius * 0.9) // Slightly smaller than dial
                .startAngle(0) // Starts at 3 o'clock
                .endAngle(0 - angle); // Sweeps counter-clockwise

            gaugeGroup.append("path")
                .attr("class", "value gauge-arc")
                .attr("d", arcGenerator())
                .attr("fill", fillStyle.primaryColor)
                .style("opacity", 0.85);

            // Dimension Label (Above Gauge)
            gaugeGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -gaugeRadius - 10) // Position above the dial
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.dimensionLabel.font_family)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.dimensionLabel.font_weight)
                .style("fill", fillStyle.textColor)
                .text(d[dimensionFieldName] + (dimensionUnit ? ` (${dimensionUnit})` : ''));

            // Value Label (Below Gauge)
            gaugeGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", 0)
                .attr("y", gaugeRadius + parseFloat(adjustedValueFontSize) + 5) // Position below dial, adjust by font size
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.valueLabel.font_family)
                .style("font-size", adjustedValueFontSize)
                .style("font-weight", fillStyle.typography.valueLabel.font_weight)
                .style("fill", fillStyle.textColor)
                .text(d[valueFieldName] + valueUnit);
            
            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}