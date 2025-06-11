/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart With Shapes",
  "chart_name": "vertical_bar_chart_13",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 12], [0, "inf"], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary", "shape_default"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a vertical bar chart combined with shapes in a central band.
    // Bars represent 'y' values (positive and negative), shapes represent 'y2' values.
    // Category labels ('x' values) are displayed in the central band.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data.data;
    const variables = data.variables || {};
    const dataColumns = data.data.columns || [];

    // Typography configuration
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const inputTypography = data.typography || {};
    const typography = {
        title: { ...defaultTypography.title, ...inputTypography.title },
        label: { ...defaultTypography.label, ...inputTypography.label },
        annotation: { ...defaultTypography.annotation, ...inputTypography.annotation }
    };

    // Color configuration
    const defaultColors = {
        other: { primary: "#1f77b4", secondary: "#ff7f0e" }, // Default primary: blue, secondary: orange
        available_colors: ["#2ca02c"], // Default shape color: green
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };
    const inputColors = data.colors || {};
    const colors = {
        field: inputColors.field || {}, // Not used in this chart, but parsed
        other: { ...defaultColors.other, ...inputColors.other },
        available_colors: (inputColors.available_colors && inputColors.available_colors.length > 0) ? inputColors.available_colors : defaultColors.available_colors,
        background_color: inputColors.background_color || defaultColors.background_color,
        text_color: inputColors.text_color || defaultColors.text_color
    };

    const images = data.images || {}; // Parsed but not used in this chart

    // Field name and unit extraction
    const dimensionFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const valueFieldName2 = dataColumns.find(col => col.role === "y2")?.name;

    // Critical Identifier Validation
    if (!dimensionFieldName || !valueFieldName || !valueFieldName2) {
        let missingFields = [];
        if (!dimensionFieldName) missingFields.push("x role");
        if (!valueFieldName) missingFields.push("y role");
        if (!valueFieldName2) missingFields.push("y2 role");
        
        const errorMsg = `Critical chart config missing: Field name(s) for ${missingFields.join(', ')} not found in dataColumns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            const userErrorMsg = `Error: Critical chart configuration is missing. Required field names for data mapping (roles: x, y, y2) were not found in 'data.columns'. Please ensure 'data.columns' correctly defines objects with 'name' and 'role' properties for these roles.`;
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${userErrorMsg}</div>`);
        }
        return null;
    }

    let valueUnit = dataColumns.find(col => col.role === "y")?.unit;
    valueUnit = (valueUnit === "none" || !valueUnit) ? "" : valueUnit;
    let valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit;
    valueUnit2 = (valueUnit2 === "none" || !valueUnit2) ? "" : valueUnit2;
    
    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typography.title.font_family,
            titleFontSize: typography.title.font_size,
            titleFontWeight: typography.title.font_weight,
            labelFontFamily: typography.label.font_family,
            labelFontSize: typography.label.font_size,
            labelFontWeight: typography.label.font_weight,
            annotationFontFamily: typography.annotation.font_family,
            annotationFontSize: typography.annotation.font_size,
            annotationFontWeight: typography.annotation.font_weight,
        },
        textColor: colors.text_color,
        chartBackground: colors.background_color,
        positiveBarColor: colors.other.primary,
        negativeBarColor: colors.other.secondary,
        shapeDefaultColor: colors.available_colors[0], // Takes the first available color
        barLabelColor: '#FFFFFF', // White for labels on bars
        legendTextColor: colors.text_color,
    };

    function estimateTextWidth(text, fontSize, fontWeight, fontFamily) {
        if (!text) return 0;
        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // Position off-screen to avoid scrollbars if it briefly flashes (though it shouldn't be in DOM)
        svgNode.style.position = 'absolute';
        svgNode.style.top = '-9999px';
        svgNode.style.left = '-9999px';

        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', typeof fontSize === 'number' ? `${fontSize}px` : fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        svgNode.appendChild(textNode);
        
        // Appending to body temporarily to ensure getBBox works reliably, then removing.
        // This is a common pattern if getBBox is unreliable off-DOM.
        // The prompt says "MUST NOT be appended to the document DOM".
        // Let's try without appending first. If getBBox returns 0 or errors, this is the limitation.
        // For robust measurement, temporary append/remove is often needed.
        // Given the constraint, we rely on browser's ability to measure off-DOM.
        
        let width = 0;
        try {
            // For getBBox to work on a text element not in the DOM, it's implementation-dependent.
            // Some browsers might require the parent SVG to have explicit dimensions or be in the DOM.
            // We set styles directly on the text element.
            textNode.style.fontFamily = fontFamily;
            textNode.style.fontSize = typeof fontSize === 'number' ? `${fontSize}px` : fontSize;
            textNode.style.fontWeight = fontWeight;
            width = textNode.getBBox().width;
        } catch (e) {
            console.warn("Failed to measure text width using SVG getBBox off-DOM. Falling back to rough estimate.", e);
            const numFontSize = parseFloat(typeof fontSize === 'number' ? fontSize : fontSize.replace('px',''));
            width = text.length * numFontSize * 0.6; // Rough fallback
        }
        return width;
    }
    
    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    function wrapText(textElement, text, maxWidth, x, y, fontSize, fontWeight, fontFamily) {
        textElement.each(function() {
            const element = d3.select(this);
            element.text(null); // Clear existing content

            const words = String(text).split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const lineHeight = 1.1; // ems
            let tspan = element.append("tspan").attr("x", x).attr("dy", "0em");
            const fontSizeStr = typeof fontSize === 'number' ? `${fontSize}px` : fontSize;

            if (estimateTextWidth(text, fontSizeStr, fontWeight, fontFamily) <= maxWidth) {
                tspan.text(text);
                return;
            }
            
            let linesRendered = 0;
            while ((word = words.pop()) && linesRendered < 2) { // Limit to 2 lines
                line.push(word);
                tspan.text(line.join(" "));
                if (estimateTextWidth(line.join(" "), fontSizeStr, fontWeight, fontFamily) > maxWidth && line.length > 1) {
                    line.pop(); // remove word that broke limit
                    tspan.text(line.join(" "));
                    if (linesRendered < 1) { // Only create a new line if it's the first break
                        line = [word];
                        tspan = element.append("tspan").attr("x", x).attr("dy", `${lineHeight}em`).text(word);
                        linesRendered++;
                    } else { // Second line, potentially truncated
                        // If the first word of the second line already exceeds, it will be truncated by SVG.
                        // Or, we can add ellipsis logic here. For now, just set text.
                        break; 
                    }
                }
            }
            // If loop finished and linesRendered is 0 (meaning first line didn't exceed), but total text did (handled by initial check)
            // This part handles if the loop finishes because words ran out or line limit reached.
            // If words remain and we are on the second line, append them if they fit, or truncate.
            if (linesRendered === 1 && words.length > 0) {
                let remainingText = line.concat(words.reverse()).join(" ");
                tspan.text(remainingText); // Set the current tspan (second line)
                while (estimateTextWidth(tspan.text(), fontSizeStr, fontWeight, fontFamily) > maxWidth && tspan.text().length > 0) {
                    remainingText = remainingText.slice(0, -1);
                    tspan.text(remainingText + "…");
                    if (remainingText.length === 0) break;
                }
            }
        });
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 50, bottom: 30, left: 50 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centralBandHeight = innerHeight * 0.20;
    const barAreaHeight = innerHeight - centralBandHeight;

    const maxPositiveY = d3.max(chartDataArray, d => Math.max(0, +d[valueFieldName])) || 0;
    const maxNegativeY = Math.abs(d3.min(chartDataArray, d => Math.min(0, +d[valueFieldName])) || 0);
    const totalMagnitudeRange = maxPositiveY + maxNegativeY;

    let topBarAreaHeight = totalMagnitudeRange > 0 ? barAreaHeight * (maxPositiveY / totalMagnitudeRange) : barAreaHeight / 2;
    let bottomBarAreaHeight = totalMagnitudeRange > 0 ? barAreaHeight * (maxNegativeY / totalMagnitudeRange) : barAreaHeight / 2;
    if (totalMagnitudeRange === 0) { // Ensure full height is used if only zero values
        topBarAreaHeight = barAreaHeight / 2;
        bottomBarAreaHeight = barAreaHeight / 2;
    }


    const centralBandTopY = chartMargins.top + topBarAreaHeight;
    const centralBandBottomY = centralBandTopY + centralBandHeight;

    const labelMargin = 3;
    const baseFontSizeLabel = parseFloat(fillStyle.typography.labelFontSize);
    const baseFontSizeAnnotation = parseFloat(fillStyle.typography.annotationFontSize);
    const minFontSize = 8;

    const dimensionLabelY = centralBandTopY + centralBandHeight * 0.35;
    const shapeY = centralBandTopY + centralBandHeight * 0.75;

    // Block 5: Data Preprocessing & Transformation
    chartDataArray.forEach(d => {
        d[valueFieldName] = +d[valueFieldName];
        d[valueFieldName2] = +d[valueFieldName2];
    });

    chartDataArray.sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const dimensions = chartDataArray.map(d => d[dimensionFieldName]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerWidth])
        .padding(0.2);

    const yScalePositive = d3.scaleLinear()
        .domain([0, maxPositiveY === 0 ? 1 : maxPositiveY])
        .range([centralBandTopY, chartMargins.top]);

    const yScaleNegative = d3.scaleLinear()
        .domain([0, maxNegativeY === 0 ? 1 : maxNegativeY])
        .range([centralBandBottomY, containerHeight - chartMargins.bottom]);

    const maxValue2 = d3.max(chartDataArray, d => d[valueFieldName2]) || 0;
    const minSideLength = 3;
    
    const maxSideLengthFromBarWidth = xScale.bandwidth() * 0.9;
    const actualShapeAreaTopY = dimensionLabelY + baseFontSizeLabel + labelMargin;
    const shapeAreaHeight = centralBandBottomY - actualShapeAreaTopY;
    const maxSideLengthAvailableBasedOnHeight = Math.max(0, shapeAreaHeight * 0.9);
    const maxSideLengthAvailable = Math.min(maxSideLengthAvailableBasedOnHeight, maxSideLengthFromBarWidth);
    const maxSideLength = Math.max(minSideLength, maxSideLengthAvailable);

    const sideLengthScale = d3.scaleSqrt()
        .domain([0, maxValue2 === 0 ? 1 : maxValue2]) // Avoid domain [0,0]
        .range([minSideLength, maxSideLength]);

    // Font size adaptation
    let minDimensionLabelRatio = 1.0;
    let minShapeLabelRatio = 1.0;
    let minBarLabelRatio = 1.0;

    const maxDimensionLabelWidth = xScale.bandwidth() * 0.90;
    const maxShapeLabelWidth = xScale.bandwidth() * 1.03;
    const maxBarLabelWidth = xScale.bandwidth();

    chartDataArray.forEach(d => {
        const dimensionText = String(d[dimensionFieldName]);
        let currentWidth = estimateTextWidth(dimensionText, `${baseFontSizeLabel}px`, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        if (currentWidth > maxDimensionLabelWidth) {
            minDimensionLabelRatio = Math.min(minDimensionLabelRatio, maxDimensionLabelWidth / currentWidth);
        }

        const shapeText = formatValue(d[valueFieldName2]) + valueUnit2;
        currentWidth = estimateTextWidth(shapeText, `${baseFontSizeLabel}px`, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        if (currentWidth > maxShapeLabelWidth) {
            minShapeLabelRatio = Math.min(minShapeLabelRatio, maxShapeLabelWidth / currentWidth);
        }

        const barValue = d[valueFieldName];
        const barText = (barValue > 0 ? "+" : "") + formatValue(barValue) + valueUnit;
        currentWidth = estimateTextWidth(barText, `${baseFontSizeAnnotation}px`, fillStyle.typography.annotationFontWeight, fillStyle.typography.annotationFontFamily);
        if (currentWidth > maxBarLabelWidth) {
            minBarLabelRatio = Math.min(minBarLabelRatio, maxBarLabelWidth / currentWidth);
        }
    });

    const finalDimensionFontSize = Math.max(minFontSize, baseFontSizeLabel * minDimensionLabelRatio);
    const finalShapeFontSize = Math.max(minFontSize, baseFontSizeLabel * minShapeLabelRatio);
    const finalBarFontSize = Math.max(minFontSize, baseFontSizeAnnotation * minBarLabelRatio);

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-area")
        .attr("transform", `translate(${chartMargins.left}, 0)`); // Y translation handled by scales

    // Block 7: Chart Component Rendering (Legend)
    const legendY = chartMargins.top / 2.5; // Position legend higher
    const legendSquareSize = 12;
    const legendPadding = 15;
    const legendItemPadding = 5;

    const yName = valueFieldName;
    const y2Name = valueFieldName2;
    
    const legendAnnotationFontSizeStr = `${parseFloat(fillStyle.typography.annotationFontSize)}px`;
    const yNameWidth = estimateTextWidth(yName, legendAnnotationFontSizeStr, fillStyle.typography.annotationFontWeight, fillStyle.typography.annotationFontFamily);
    const y2NameWidth = estimateTextWidth(y2Name, legendAnnotationFontSizeStr, fillStyle.typography.annotationFontWeight, fillStyle.typography.annotationFontFamily);

    const totalLegendWidth = (legendSquareSize + legendItemPadding) * 3 + // 3 squares
                           yNameWidth + legendPadding + y2NameWidth;

    const legendStartX = chartMargins.left + (innerWidth - totalLegendWidth) / 2;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendStartX}, ${legendY})`);

    let currentX = 0;

    // Positive value legend item
    legendGroup.append("rect")
        .attr("class", "legend-mark")
        .attr("x", currentX)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.positiveBarColor);
    currentX += legendSquareSize + legendItemPadding;

    // Negative value legend item
    legendGroup.append("rect")
        .attr("class", "legend-mark")
        .attr("x", currentX)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.negativeBarColor);
    currentX += legendSquareSize + legendItemPadding;

    legendGroup.append("text")
        .attr("class", "label legend-label")
        .attr("x", currentX)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", legendAnnotationFontSizeStr)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.legendTextColor)
        .text(yName);
    currentX += yNameWidth + legendPadding;

    // Shape legend item
    legendGroup.append("rect")
        .attr("class", "legend-mark")
        .attr("x", currentX)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.shapeDefaultColor);
    currentX += legendSquareSize + legendItemPadding;

    legendGroup.append("text")
        .attr("class", "label legend-label")
        .attr("x", currentX)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", legendAnnotationFontSizeStr)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.legendTextColor)
        .text(y2Name);

    // Block 8: Main Data Visualization Rendering
    chartDataArray.forEach((d) => {
        const xPos = xScale(d[dimensionFieldName]);
        const barWidth = xScale.bandwidth();
        const centerX = xPos + barWidth / 2;

        // Bars (yValue)
        const yValue = d[valueFieldName];
        let barHeight = 0, barYPos = 0, barFillColor;

        if (yValue > 0) {
            barYPos = yScalePositive(yValue);
            barHeight = centralBandTopY - barYPos;
            barFillColor = fillStyle.positiveBarColor;
        } else if (yValue < 0) {
            barYPos = centralBandBottomY;
            const scaledY = yScaleNegative(Math.abs(yValue));
            barHeight = scaledY - barYPos;
            barFillColor = fillStyle.negativeBarColor;
        } else { // yValue === 0
            barYPos = centralBandTopY; // Or centralBandBottomY, doesn't matter for height 0
            barHeight = 0;
            barFillColor = "none";
        }
        barHeight = Math.max(0, barHeight); // Ensure non-negative height

        if (barHeight > 0) {
            mainChartGroup.append("rect")
                .attr("class", "mark bar")
                .attr("x", xPos)
                .attr("y", barYPos)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", barFillColor);

            // Bar value labels
            const barLabelText = (yValue > 0 ? "+" : "") + formatValue(yValue) + valueUnit;
            // Position label inside the bar, near the end that's away from the center band
            let barLabelY;
            if (yValue > 0) {
                barLabelY = barYPos + finalBarFontSize * 0.8 + labelMargin; // Near top of positive bar
            } else {
                barLabelY = barYPos + barHeight - finalBarFontSize * 0.2 - labelMargin; // Near bottom of negative bar
            }
            
            mainChartGroup.append("text")
                .attr("class", "label value bar-value-label")
                .attr("x", centerX)
                .attr("y", barLabelY)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${finalBarFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.barLabelColor)
                .text(barLabelText);
        }

        // Shapes (y2Value) - Squares
        const squareSideLength = sideLengthScale(d[valueFieldName2]);
        if (squareSideLength >= minSideLength) { // Only draw if side length is meaningful
             mainChartGroup.append("rect")
                .attr("class", "mark shape")
                .attr("x", centerX - squareSideLength / 2)
                .attr("y", shapeY - squareSideLength / 2)
                .attr("width", squareSideLength)
                .attr("height", squareSideLength)
                .attr("fill", fillStyle.shapeDefaultColor)
                .attr("opacity", 0.9); // Slight opacity for shapes

            // Shape value labels
            const shapeLabelText = formatValue(d[valueFieldName2]) + valueUnit2;
            const shapeLabelWidth = estimateTextWidth(shapeLabelText, `${finalShapeFontSize}px`, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
            
            let shapeLabelColor, shapeLabelActualY, shapeLabelDy;
            const isShapeBigEnoughForInsideLabel = shapeLabelWidth < (squareSideLength * 0.9) && squareSideLength > finalShapeFontSize * 1.2;

            if (isShapeBigEnoughForInsideLabel) {
                shapeLabelColor = fillStyle.barLabelColor; // White for inside
                shapeLabelActualY = shapeY;
                shapeLabelDy = "0.35em"; // Vertically center
            } else {
                shapeLabelColor = fillStyle.textColor; // Default text color for outside
                shapeLabelActualY = shapeY + squareSideLength / 2 + (finalShapeFontSize * 0.6) + labelMargin;
                shapeLabelDy = "0em";
            }

            mainChartGroup.append("text")
                .attr("class", "label value shape-value-label")
                .attr("x", centerX)
                .attr("y", shapeLabelActualY)
                .attr("dy", shapeLabelDy)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${finalShapeFontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", shapeLabelColor)
                .text(shapeLabelText);
        }
       

        // Dimension labels (xValue)
        mainChartGroup.append("text")
            .attr("class", "label category-label")
            // x, y are passed to wrapText
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${finalDimensionFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("text-anchor", "middle")
            .call(wrapText, String(d[dimensionFieldName]), maxDimensionLabelWidth, centerX, dimensionLabelY, finalDimensionFontSize, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No further enhancements in this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}