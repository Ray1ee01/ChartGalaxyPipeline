/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Gauge Charts",
  "chart_name": "small_multiples_gauge_plain_chart_04",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data.data;
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    // const imagesInput = data.images || {}; // Not used in this chart type
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldRole = "x";
    const valueFieldRole = "y";

    const dimensionColumn = dataColumns.find(col => col.role === dimensionFieldRole);
    const valueColumn = dataColumns.find(col => col.role === valueFieldRole);

    const dimensionFieldName = dimensionColumn?.name;
    const valueFieldName = valueColumn?.name;

    if (!dimensionFieldName || !valueFieldName) {
        let missingFields = [];
        if (!dimensionFieldName) missingFields.push(`dimension field (role '${dimensionFieldRole}')`);
        if (!valueFieldName) missingFields.push(`value field (role '${valueFieldRole}')`);
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>Error: ${errorMessage}</div>`);
        }
        return null;
    }

    const valueUnit = (valueColumn?.unit && valueColumn.unit !== "none") ? valueColumn.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colorsInput.text_color || '#0f223b',
        primaryColor: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#1f77b4',
        gaugeStrokeColor: colorsInput.text_color || '#0f223b',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        }
    };

    function estimateTextWidth(text, styleProps) {
        if (!text || String(text).length === 0) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', styleProps.fontFamily);
        textElement.setAttribute('font-size', styleProps.fontSize);
        textElement.setAttribute('font-weight', styleProps.fontWeight);
        textElement.textContent = String(text);
        tempSvg.appendChild(textElement);
        
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            console.warn("Could not measure text width with getBBox for unattached SVG. Using fallback.", e);
            const fontSize = parseFloat(styleProps.fontSize) || 12;
            width = String(text).length * (fontSize * 0.6); 
        }
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-container")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 20, bottom: 40, left: 20 };

    const numCharts = chartDataArray.length;
    if (numCharts === 0) {
        svgRoot.append("text")
            .attr("class", "label")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .text("No data to display.")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor);
        return svgRoot.node();
    }
    
    let rows, cols;
    if (numCharts <= 3) { rows = 1; cols = numCharts; }
    else if (numCharts === 4) { rows = 2; cols = 2; }
    else if (numCharts <= 8) { rows = 2; cols = Math.ceil(numCharts / 2); }
    else if (numCharts <= 12) { rows = 3; cols = Math.ceil(numCharts / 3); }
    else { rows = 4; cols = Math.ceil(numCharts / 4); } // Supports up to 4*cols items

    const itemsPerRow = [];
    for (let i = 0; i < rows; i++) {
        itemsPerRow.push( (i < rows - 1) ? cols : (numCharts - cols * (rows - 1)) );
    }

    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const cellWidth = chartAreaWidth / cols;
    const cellHeight = chartAreaHeight / rows;

    const spacingFactorHorizontal = 0.15;
    const spacingFactorVertical = 0.15;
    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    const radius = Math.max(10, Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10); // Ensure radius is at least 10

    const initialDimensionFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const initialValueFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    
    let maxDimensionWidth = 0;
    let maxValueWidth = 0;

    chartDataArray.forEach(d => {
        maxDimensionWidth = Math.max(maxDimensionWidth, estimateTextWidth(d[dimensionFieldName], {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        }));
        
        const valueLabelForMeasure = String(d[valueFieldName]) + (valueUnit ? " " + valueUnit : "");
        maxValueWidth = Math.max(maxValueWidth, estimateTextWidth(valueLabelForMeasure, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        }));
    });
    
    const maxTextWidthAllowance = radius * 2.4; 
    let dimensionScaleFactor = 1;
    if (maxDimensionWidth > maxTextWidthAllowance && maxTextWidthAllowance > 0) {
        dimensionScaleFactor = maxTextWidthAllowance / (maxDimensionWidth + 3);
    }
    
    let valueScaleFactor = 1;
    if (maxValueWidth > maxTextWidthAllowance && maxTextWidthAllowance > 0) {
        valueScaleFactor = maxTextWidthAllowance / (maxValueWidth + 3);
    }

    const adjustedDimensionFontSize = `${Math.max(8, Math.floor(initialDimensionFontSize * dimensionScaleFactor))}px`;
    const adjustedValueFontSize = `${Math.max(8, Math.floor(initialValueFontSize * valueScaleFactor))}px`;

    // Block 5: Data Preprocessing & Transformation
    const sortedChartData = [...chartDataArray].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const dataMaxNumericValue = sortedChartData.length > 0 ? sortedChartData[0][valueFieldName] : 0;
    const maxAngle = 290 * (Math.PI / 180); 

    // Block 6: Scale Definition & Configuration (Implicit via angle calculation)

    // Block 7: Chart Component Rendering (Axes, Gridlines, Legend - Not applicable)

    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const d = sortedChartData[dataIndex];

            const chartCenterX = chartMargins.left + rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (r + 0.5) * cellHeight;

            const chartGroup = svgRoot.append("g")
                .attr("class", "gauge-multiple")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            chartGroup.append("circle")
                .attr("class", "mark")
                .attr("r", radius)
                .attr("fill", "none")
                .attr("stroke", fillStyle.gaugeStrokeColor)
                .attr("stroke-width", 1.5);

            const tickLength = radius * 0.07;
            const tickPositions = [
                { x1: 0, y1: -radius, x2: 0, y2: -(radius - tickLength) },
                { x1: radius, y1: 0, x2: radius - tickLength, y2: 0 },    
                { x1: 0, y1: radius, x2: 0, y2: radius - tickLength },  
                { x1: -radius, y1: 0, x2: -(radius - tickLength), y2: 0 } 
            ];
            tickPositions.forEach(pos => {
                chartGroup.append("line")
                    .attr("class", "mark")
                    .attr("x1", pos.x1).attr("y1", pos.y1)
                    .attr("x2", pos.x2).attr("y2", pos.y2)
                    .attr("stroke", fillStyle.gaugeStrokeColor)
                    .attr("stroke-width", 1.5);
            });

            const currentNumericValue = d[valueFieldName] || 0;
            const angle = dataMaxNumericValue > 0 ? (currentNumericValue / dataMaxNumericValue) * maxAngle : 0;
            
            const arcGenerator = d3.arc()
                .innerRadius(0)
                .outerRadius(radius * 0.9)
                .startAngle(0) 
                .endAngle(0 - angle); 

            chartGroup.append("path")
                .attr("class", "mark")
                .attr("d", arcGenerator())
                .attr("fill", fillStyle.primaryColor)
                .style("opacity", 0.85);

            const dimensionTextContent = String(d[dimensionFieldName]);
            chartGroup.append("text")
                .attr("class", "label")
                .attr("x", 0)
                .attr("y", -radius - 10) 
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(dimensionTextContent);

            const valueTextContent = String(d[valueFieldName]) + (valueUnit ? ` ${valueUnit}` : "");
            chartGroup.append("text")
                .attr("class", "label")
                .attr("x", 0)
                .attr("y", radius + 15 + parseFloat(adjustedValueFontSize) * 0.5) // Adjusted y for better centering
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", adjustedValueFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(valueTextContent);
            
            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}