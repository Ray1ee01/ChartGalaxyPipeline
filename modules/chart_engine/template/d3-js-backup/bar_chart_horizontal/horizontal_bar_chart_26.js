/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Composite Bar and Shape Chart",
  "chart_name": "horizontal_bar_proportional_shape_01",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is external)

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Could be data.colors_dark for dark themes, assuming data.colors for now
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldRole = "x";
    const valueField1Role = "y";
    const valueField2Role = "y2";

    const dimensionFieldDef = dataColumns.find(col => col.role === dimensionFieldRole);
    const valueField1Def = dataColumns.find(col => col.role === valueField1Role);
    const valueField2Def = dataColumns.find(col => col.role === valueField2Role);

    const dimensionFieldName = dimensionFieldDef?.name;
    const valueField1Name = valueField1Def?.name;
    const valueField2Name = valueField2Def?.name;

    const criticalFields = {
        dimensionFieldName,
        valueField1Name,
        valueField2Name
    };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const valueUnit1 = valueField1Def?.unit === "none" ? "" : (valueField1Def?.unit || "");
    const valueUnit2 = valueField2Def?.unit === "none" ? "" : (valueField2Def?.unit || "");
    const columnTitle1 = valueField1Def?.name || "Value 1";
    const columnTitle2 = valueField2Def?.name || "Value 2";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyInput.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyInput.title?.font_size || '16px',
            titleFontWeight: typographyInput.title?.font_weight || 'bold',
            labelFontFamily: typographyInput.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyInput.label?.font_size || '12px',
            labelFontWeight: typographyInput.label?.font_weight || 'normal',
            annotationFontFamily: typographyInput.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyInput.annotation?.font_size || '10px',
            annotationFontWeight: typographyInput.annotation?.font_weight || 'normal',
        },
        textColor: colorsInput.text_color || '#0f223b',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        squareStrokeColor: '#FFFFFF', // Example, could be configurable
        valueLabelColorInternal: '#FFFFFF', // For labels inside dark elements
        getBarColor: (category, index, defaultColor = '#4682B4') => {
            if (colorsInput.field && colorsInput.field[category]) return colorsInput.field[category];
            if (colorsInput.other && colorsInput.other.primary) return colorsInput.other.primary;
            if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                return colorsInput.available_colors[index % colorsInput.available_colors.length];
            }
            return defaultColor;
        },
        getSquareColor: (category, index, defaultColor = '#A0A0A0') => {
            if (colorsInput.field && colorsInput.field[category]) return colorsInput.field[category];
            if (colorsInput.other && colorsInput.other.secondary) return colorsInput.other.secondary;
            if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                // Try to pick a different color if multiple available
                const offsetIndex = colorsInput.available_colors.length > 1 ? (index + 1) % colorsInput.available_colors.length : index % colorsInput.available_colors.length;
                return colorsInput.available_colors[offsetIndex];
            }
            return defaultColor;
        },
        getImageUrl: (category) => {
            if (imagesInput.field && imagesInput.field[category]) return imagesInput.field[category];
            // if (imagesInput.other && imagesInput.other.primary) return imagesInput.other.primary; // Example for a generic icon
            return null;
        }
    };

    const estimateTextWidth = (text, fontConfig) => {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvgNode.style.visibility = 'hidden';
        tempSvgNode.style.position = 'absolute'; // Avoid affecting layout
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontConfig.fontFamily);
        tempTextElement.setAttribute('font-size', fontConfig.fontSize);
        tempTextElement.setAttribute('font-weight', fontConfig.fontWeight);
        tempTextElement.textContent = text;
        tempSvgNode.appendChild(tempTextElement);
        document.body.appendChild(tempSvgNode); // Needs to be in DOM for getBBox
        const width = tempTextElement.getBBox().width;
        document.body.removeChild(tempSvgNode);
        return width;
    };
    
    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~s")(value);
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = { top: 60, right: 20, bottom: 30, left: 0 }; // Initial left, will be adjusted

    // Block 4: Core Chart Dimensions & Layout Calculation
    const flagWidth = 30;
    const flagHeight = 30;
    const textPadding = 8;
    const minDimLabelFontSize = 10; // px

    let maxDimLabelWidth = 0;
    let defaultLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);

    chartData.forEach(d => {
        const labelText = String(d[dimensionFieldName]).toUpperCase();
        const width = estimateTextWidth(labelText, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: defaultLabelFontSize + 'px',
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (width > maxDimLabelWidth) maxDimLabelWidth = width;
    });
    
    const maxAllowedLabelSpace = containerWidth * 0.25;
    let finalDimLabelFontSize = defaultLabelFontSize;

    if (maxDimLabelWidth > maxAllowedLabelSpace) {
        const scaleFactor = maxAllowedLabelSpace / maxDimLabelWidth;
        finalDimLabelFontSize = Math.max(minDimLabelFontSize, defaultLabelFontSize * scaleFactor);
        
        maxDimLabelWidth = 0; // Recalculate with new font size
        chartData.forEach(d => {
            const labelText = String(d[dimensionFieldName]).toUpperCase();
            const width = estimateTextWidth(labelText, {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: finalDimLabelFontSize + 'px',
                fontWeight: fillStyle.typography.labelFontWeight
            });
            if (width > maxDimLabelWidth) maxDimLabelWidth = width;
        });
    }
    
    chartMargins.left = maxDimLabelWidth + textPadding + flagWidth + textPadding + 10;

    let innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    let innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth < 100 || innerHeight < 50) { // Basic check for drawable area
        console.error("Not enough space to draw the chart with current margins and dimensions.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Not enough space to draw.</div>");
        return null;
    }

    const circleAreaRatio = 0.25;
    const barAreaRatio = 1 - circleAreaRatio;
    const circleAreaWidth = innerWidth * circleAreaRatio;
    const barAreaWidth = innerWidth * barAreaRatio;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => b[valueField1Name] - a[valueField1Name]);
    const sortedDimensions = sortedData.map(d => d[dimensionFieldName]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.25;
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    const maxVal1 = d3.max(sortedData, d => +d[valueField1Name]);
    const xScale = d3.scaleLinear()
        .domain([0, maxVal1 > 0 ? maxVal1 * 1.05 : 1]) // Add 5% padding, handle all zero/negative case
        .range([0, barAreaWidth]);

    const maxVal2 = d3.max(sortedData, d => +d[valueField2Name]);
    const minSide = yScale.bandwidth() * 0.1;
    const maxSide = Math.min(yScale.bandwidth() * 0.9, circleAreaWidth * 0.8);
    
    const sideScale = d3.scaleSqrt()
        .domain([0, maxVal2 > 0 ? maxVal2 : 1]) // Handle all zero/negative case
        .range([minSide, maxSide]);

    // Block 7: Chart Component Rendering (Column Titles)
    svgRoot.append("text")
        .attr("class", "text label column-title")
        .attr("x", chartMargins.left + circleAreaWidth + barAreaWidth)
        .attr("y", chartMargins.top - 15)
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(columnTitle1);

    svgRoot.append("text")
        .attr("class", "text label column-title")
        .attr("x", chartMargins.left + circleAreaWidth / 2)
        .attr("y", chartMargins.top - 15)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(columnTitle2);

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    sortedData.forEach((d, i) => {
        const dimensionValue = d[dimensionFieldName];
        const value1 = +d[valueField1Name];
        const value2 = +d[valueField2Name];

        const barHeight = yScale.bandwidth();
        const yPos = yScale(dimensionValue);
        if (yPos === undefined) { // Skip if dimension not in scale (e.g. data inconsistency)
            console.warn(`Dimension ${dimensionValue} not found in yScale domain.`);
            return;
        }
        const centerY = yPos + barHeight / 2;

        // Layout positions relative to mainChartGroup
        const labelX = -(flagWidth + textPadding + 5);
        const iconX = -(flagWidth + 5);
        const squareAreaCenterX = circleAreaWidth / 2;
        const barAreaStartX = circleAreaWidth;
        
        const barWidthActual = value1 > 0 ? xScale(value1) : 0;
        const barX = barAreaStartX + barAreaWidth - barWidthActual; // Bar right aligned

        // Dimension Label
        mainChartGroup.append("text")
            .attr("class", "label text")
            .attr("x", labelX)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${finalDimLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(String(dimensionValue).toUpperCase());

        // Icon
        const imageUrl = fillStyle.getImageUrl(dimensionValue);
        if (imageUrl) {
            mainChartGroup.append("image")
                .attr("class", "icon image")
                .attr("x", iconX)
                .attr("y", centerY - flagHeight / 2)
                .attr("width", flagWidth)
                .attr("height", flagHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", imageUrl);
        }

        // Square (for valueField2)
        const squareSide = value2 > 0 ? sideScale(value2) : 0;
        const currentSquareColor = fillStyle.getSquareColor(dimensionValue, i);
        if (squareSide > 0) {
            mainChartGroup.append("rect")
                .attr("class", "mark")
                .attr("x", squareAreaCenterX - squareSide / 2)
                .attr("y", centerY - squareSide / 2)
                .attr("width", squareSide)
                .attr("height", squareSide)
                .style("fill", currentSquareColor)
                .style("stroke", fillStyle.squareStrokeColor)
                .style("stroke-width", 1);
        }

        // Square Value Label
        if (value2 > 0 && squareSide > 0) { // Only show label if there's a square
            const formattedValue2 = `${formatValue(value2)}${valueUnit2}`;
            const labelPositionThreshold = barHeight * 0.4; // Heuristic
            let squareLabelFill, squareLabelX, squareLabelY, squareLabelAnchor, squareLabelDy;

            if (squareSide >= labelPositionThreshold && squareSide > estimateTextWidth(formattedValue2, {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: fillStyle.typography.annotationFontSize,
                fontWeight: fillStyle.typography.annotationFontWeight
            }) * 0.8) { // Check if text fits
                squareLabelFill = fillStyle.valueLabelColorInternal;
                squareLabelX = squareAreaCenterX;
                squareLabelY = centerY;
                squareLabelAnchor = "middle";
                squareLabelDy = "0.35em";
            } else {
                squareLabelFill = fillStyle.textColor; // Use general text color if outside or small
                squareLabelX = squareAreaCenterX;
                squareLabelY = centerY - squareSide / 2 - 5; // Above square
                squareLabelAnchor = "middle";
                squareLabelDy = "0em";
            }
            mainChartGroup.append("text")
                .attr("class", "value text")
                .attr("x", squareLabelX)
                .attr("y", squareLabelY)
                .attr("dy", squareLabelDy)
                .attr("text-anchor", squareLabelAnchor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", squareLabelFill)
                .text(formattedValue2);
        }

        // Bar (for valueField1)
        const currentBarColor = fillStyle.getBarColor(dimensionValue, i);
        if (barWidthActual > 0) {
            mainChartGroup.append("rect")
                .attr("class", "mark")
                .attr("x", barX)
                .attr("y", yPos)
                .attr("width", barWidthActual)
                .attr("height", barHeight)
                .style("fill", currentBarColor)
                .attr("rx", barHeight / 8) // Kept for bar styling
                .attr("ry", barHeight / 8);
        }

        // Bar Value Label
        if (value1 > 0 && barWidthActual > 0) { // Only show label if there's a bar
            const formattedValue1 = `${formatValue(value1)}${valueUnit1}`;
            const valueLabelWidth = estimateTextWidth(formattedValue1, {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: fillStyle.typography.annotationFontSize,
                fontWeight: fillStyle.typography.annotationFontWeight
            });
            
            let valueLabelXPos, valueLabelAnchor, valueLabelFill;
            const internalPadding = 10;
            const externalPadding = 5;

            if (barWidthActual >= valueLabelWidth + internalPadding) {
                valueLabelXPos = barX + internalPadding / 2;
                valueLabelAnchor = "start";
                valueLabelFill = fillStyle.valueLabelColorInternal;
            } else {
                valueLabelXPos = barX - externalPadding;
                valueLabelAnchor = "end";
                valueLabelFill = fillStyle.textColor;
            }
            mainChartGroup.append("text")
                .attr("class", "value text")
                .attr("x", valueLabelXPos)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", valueLabelAnchor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", valueLabelFill)
                .text(formattedValue1);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactoring, complex effects removed)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}