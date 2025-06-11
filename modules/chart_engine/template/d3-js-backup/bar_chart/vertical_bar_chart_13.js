/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart with Proportional Shapes",
  "chart_name": "vertical_bar_chart_with_shapes_01",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 30], ["-inf", "inf"], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary", "shape_default"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {}; // Though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const value2FieldName = dataColumns.find(col => col.role === "y2")?.name;

    if (!categoryFieldName || !valueFieldName || !value2FieldName) {
        const missingFields = [
            !categoryFieldName ? "x role field" : null,
            !valueFieldName ? "y role field" : null,
            !value2FieldName ? "y2 role field" : null
        ].filter(Boolean).join(", ");

        console.error(`Critical chart config missing: [${missingFields}]. Cannot render.`);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: Critical chart configuration missing (${missingFields}). Cannot render chart.</div>`);
        return null;
    }

    let valueUnit = dataColumns.find(col => col.role === "y")?.unit;
    valueUnit = (valueUnit === "none" || !valueUnit) ? "" : valueUnit;
    let value2Unit = dataColumns.find(col => col.role === "y2")?.unit;
    value2Unit = (value2Unit === "none" || !value2Unit) ? "" : value2Unit;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        positiveBarColor: (colorsConfig.other && colorsConfig.other.primary) || "#008080",
        negativeBarColor: (colorsConfig.other && colorsConfig.other.secondary) || "#FF0000",
        shapeFillColor: (colorsConfig.available_colors && colorsConfig.available_colors[0]) || "#FFBF00",
        textColor: colorsConfig.text_color || "#000000",
        barLabelColor: "#FFFFFF", // Typically white for contrast on bars
        chartBackground: colorsConfig.background_color || "#FFFFFF", // Not used for SVG background, but good practice
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || "Arial, sans-serif",
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || "16px",
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || "500",
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || "Arial, sans-serif",
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || "12px",
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || "400",
        }
    };

    function estimateTextWidth(text, fontSize, fontWeight, fontFamily) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but for estimation without DOM append, this is a common approach.
        // For higher accuracy, a hidden live SVG element is better.
        // However, the prompt specified "MUST NOT be appended to the document DOM".
        // A canvas-based measurement is often more reliable if DOM append is forbidden.
        // Given the original used canvas, let's stick to a similar principle if SVG getBBox is unreliable without DOM.
        // For simplicity and adhering to "in-memory SVG", we'll use getBBox, acknowledging potential inaccuracies.
        // A more robust in-memory SVG approach would involve setting it up with dimensions.
        // Let's use a canvas-based one as it was in the original and is generally reliable.
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        return context.measureText(text).width;
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        }
        return d3.format("~g")(value);
    };

    function wrapText(textSelection, textContent, maxWidth, xPos, yPos, fontSize, fontWeight, fontFamily) {
        textSelection.each(function() {
            const textElement = d3.select(this);
            textElement.text(null); // Clear existing content

            const words = String(textContent).split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const lineHeight = 1.1; // ems
            let tspan = textElement.append("tspan").attr("x", xPos).attr("dy", "0em");

            if (estimateTextWidth(textContent, fontSize, fontWeight, fontFamily) <= maxWidth) {
                tspan.text(textContent);
                return;
            }
            
            let linesRendered = 0;
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (estimateTextWidth(line.join(" "), fontSize, fontWeight, fontFamily) > maxWidth && line.length > 1) {
                    line.pop(); // remove word that broke limit
                    tspan.text(line.join(" "));
                    if (linesRendered >= 1) { // Max 2 lines for simplicity
                        tspan.text(tspan.text() + "..."); // Add ellipsis if truncated
                        break;
                    }
                    line = [word];
                    tspan = textElement.append("tspan").attr("x", xPos).attr("dy", lineHeight + "em");
                    tspan.text(word);
                    linesRendered++;
                }
            }
        });
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Apply background to SVG itself

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group");

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
    if (totalMagnitudeRange === 0) { // Ensure full height is used if all values are 0
        topBarAreaHeight = barAreaHeight / 2;
        bottomBarAreaHeight = barAreaHeight / 2;
    }


    const centralBandTopY = chartMargins.top + topBarAreaHeight;
    const centralBandBottomY = centralBandTopY + centralBandHeight;
    mainChartGroup.attr("transform", `translate(${chartMargins.left}, 0)`);

    const labelMargin = 3;
    const baseFontSizeLabel = parseFloat(fillStyle.typography.labelFontSize);
    const baseFontSizeAnnotation = parseFloat(fillStyle.typography.annotationFontSize);
    const minFontSize = 8;

    const dimensionLabelY = centralBandTopY + centralBandHeight * 0.35;
    const shapeVisualCenterY = centralBandTopY + centralBandHeight * 0.75;


    // Block 5: Data Preprocessing & Transformation
    chartDataArray.forEach(d => {
        d[valueFieldName] = +d[valueFieldName];
        d[value2FieldName] = +d[value2FieldName];
    });

    chartDataArray.sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const categories = chartDataArray.map(d => d[categoryFieldName]);

    // Dynamic font size calculation (needs scales first, or use base font size for estimation)
    // This part is tricky because scales depend on dimensions, and font sizes affect dimensions.
    // For now, we'll calculate scales first, then refine font sizes.
    // The original code did font size calculation before scales, which is fine if using base font sizes for estimation.

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerWidth])
        .padding(0.2);

    const yScalePositive = d3.scaleLinear()
        .domain([0, maxPositiveY === 0 ? 1 : maxPositiveY])
        .range([centralBandTopY, chartMargins.top]);

    const yScaleNegative = d3.scaleLinear()
        .domain([0, maxNegativeY === 0 ? 1 : maxNegativeY])
        .range([centralBandBottomY, containerHeight - chartMargins.bottom]);

    const maxValue2 = d3.max(chartDataArray, d => d[value2FieldName]) || 0;
    const minSideLength = 3;
    
    const maxSideLengthFromBarWidth = xScale.bandwidth() * 0.9;
    const shapeAreaTopForCalc = dimensionLabelY + baseFontSizeLabel + labelMargin;
    const shapeAreaHeightAvailable = centralBandBottomY - shapeAreaTopForCalc;
    const maxSideLengthFromHeight = Math.max(0, shapeAreaHeightAvailable * 0.9);
    const maxAllowedSideLength = Math.min(maxSideLengthFromHeight, maxSideLengthFromBarWidth);
    const finalMaxSideLength = Math.max(minSideLength, maxAllowedSideLength);

    const sideLengthScale = d3.scaleSqrt()
        .domain([0, maxValue2])
        .range([minSideLength, finalMaxSideLength]);

    // Refined Font Size Calculation (after scales are available)
    let minDimensionLabelRatio = 1.0;
    let minShapeLabelRatio = 1.0;
    let minBarLabelRatio = 1.0;

    const maxDimensionLabelWidth = xScale.bandwidth() * 0.90;
    const maxShapeLabelWidth = xScale.bandwidth() * 1.03; // Can be slightly wider if outside
    const maxBarLabelWidth = xScale.bandwidth();

    chartDataArray.forEach(d => {
        const dimensionText = String(d[categoryFieldName]);
        let currentWidth = estimateTextWidth(dimensionText, baseFontSizeLabel, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        if (currentWidth > maxDimensionLabelWidth) {
            minDimensionLabelRatio = Math.min(minDimensionLabelRatio, maxDimensionLabelWidth / currentWidth);
        }

        const shapeText = formatValue(d[value2FieldName]) + value2Unit;
        currentWidth = estimateTextWidth(shapeText, baseFontSizeLabel, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        if (currentWidth > maxShapeLabelWidth) {
            minShapeLabelRatio = Math.min(minShapeLabelRatio, maxShapeLabelWidth / currentWidth);
        }

        const barValue = d[valueFieldName];
        const barText = (barValue >= 0 ? "+" : "") + formatValue(barValue) + valueUnit;
        currentWidth = estimateTextWidth(barText, baseFontSizeAnnotation, fillStyle.typography.annotationFontWeight, fillStyle.typography.annotationFontFamily);
        if (currentWidth > maxBarLabelWidth) {
            minBarLabelRatio = Math.min(minBarLabelRatio, maxBarLabelWidth / currentWidth);
        }
    });

    const finalDimensionFontSize = Math.max(minFontSize, baseFontSizeLabel * minDimensionLabelRatio);
    const finalShapeFontSize = Math.max(minFontSize, baseFontSizeLabel * minShapeLabelRatio);
    const finalBarFontSize = Math.max(minFontSize, baseFontSizeAnnotation * minBarLabelRatio);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendY = chartMargins.top / 2.5; // Adjusted for potentially smaller top margin
    const legendSquareSize = 12;
    const legendPadding = 15;
    const legendItemPadding = 5;

    const yNameForLegend = dataColumns.find(col => col.role === "y")?.label || valueFieldName;
    const y2NameForLegend = dataColumns.find(col => col.role === "y2")?.label || value2FieldName;
    
    const legendAnnotationFontFamily = fillStyle.typography.annotationFontFamily;
    const legendAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    const legendAnnotationFontWeight = fillStyle.typography.annotationFontWeight;

    const yNameWidth = estimateTextWidth(yNameForLegend, legendAnnotationFontSize, legendAnnotationFontWeight, legendAnnotationFontFamily);
    const y2NameWidth = estimateTextWidth(y2NameForLegend, legendAnnotationFontSize, legendAnnotationFontWeight, legendAnnotationFontFamily);

    const totalLegendWidth = (legendSquareSize + legendItemPadding) * 3 + // 3 squares
                           yNameWidth + legendPadding + y2NameWidth;

    const legendStartX = chartMargins.left + (innerWidth - totalLegendWidth) / 2;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendStartX}, ${legendY})`);

    let currentXLegend = 0;

    // Positive value legend item
    legendGroup.append("rect")
        .attr("class", "legend-mark")
        .attr("x", currentXLegend)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.positiveBarColor);
    currentXLegend += legendSquareSize + legendItemPadding;

    // Negative value legend item (shares text with positive)
    legendGroup.append("rect")
        .attr("class", "legend-mark")
        .attr("x", currentXLegend)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.negativeBarColor);
    currentXLegend += legendSquareSize + legendItemPadding;
    
    legendGroup.append("text")
        .attr("class", "legend-label label")
        .attr("x", currentXLegend)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendAnnotationFontFamily)
        .style("font-size", `${legendAnnotationFontSize}px`)
        .style("font-weight", legendAnnotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(yNameForLegend);
    currentXLegend += yNameWidth + legendPadding;

    // Shape legend item
    legendGroup.append("rect")
        .attr("class", "legend-mark")
        .attr("x", currentXLegend)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.shapeFillColor);
    currentXLegend += legendSquareSize + legendItemPadding;

    legendGroup.append("text")
        .attr("class", "legend-label label")
        .attr("x", currentXLegend)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendAnnotationFontFamily)
        .style("font-size", `${legendAnnotationFontSize}px`)
        .style("font-weight", legendAnnotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(y2NameForLegend);

    // Block 8: Main Data Visualization Rendering
    chartDataArray.forEach((d) => {
        const xPos = xScale(d[categoryFieldName]);
        const barWidth = xScale.bandwidth();
        const centerX = xPos + barWidth / 2;
        const yValue = d[valueFieldName];

        let barHeight, barYPos, barFillColor;
        const cornerRadius = barWidth / 2; // For rounded tops/bottoms

        if (yValue > 0) {
            barYPos = yScalePositive(yValue);
            barHeight = centralBandTopY - barYPos;
            barFillColor = fillStyle.positiveBarColor;
        } else if (yValue < 0) {
            barYPos = centralBandBottomY;
            const scaledY = yScaleNegative(Math.abs(yValue));
            barHeight = scaledY - barYPos;
            barFillColor = fillStyle.negativeBarColor;
        } else {
            barHeight = 0;
            barYPos = centralBandTopY; // or centralBandBottomY, doesn't matter for 0 height
            barFillColor = "none";
        }

        if (barHeight < 0) barHeight = 0; // Should not happen with correct scales

        if (barHeight > 0) {
            let pathData;
            if (yValue > 0) {
                pathData = `
                    M ${xPos},${centralBandTopY}
                    L ${xPos},${barYPos + cornerRadius}
                    A ${cornerRadius},${cornerRadius} 0 0 1 ${xPos + cornerRadius},${barYPos}
                    L ${xPos + barWidth - cornerRadius},${barYPos}
                    A ${cornerRadius},${cornerRadius} 0 0 1 ${xPos + barWidth},${barYPos + cornerRadius}
                    L ${xPos + barWidth},${centralBandTopY}
                    Z
                `;
            } else { // yValue < 0
                const bottomEdgeY = barYPos + barHeight; // This is `scaledY` from original
                 pathData = `
                    M ${xPos},${barYPos}
                    L ${xPos},${bottomEdgeY - cornerRadius}
                    A ${cornerRadius},${cornerRadius} 0 0 0 ${xPos + cornerRadius},${bottomEdgeY}
                    L ${xPos + barWidth - cornerRadius},${bottomEdgeY}
                    A ${cornerRadius},${cornerRadius} 0 0 0 ${xPos + barWidth},${bottomEdgeY - cornerRadius}
                    L ${xPos + barWidth},${barYPos}
                    Z
                `;
            }
            mainChartGroup.append("path")
                .attr("class", "mark bar")
                .attr("d", pathData)
                .attr("fill", barFillColor);

            // Bar value labels
            const barLabelText = (yValue >= 0 ? "+" : "") + formatValue(yValue) + valueUnit;
            const barLabelY = (yValue >= 0) ? barYPos + finalBarFontSize * 0.8 + 3 : barYPos + barHeight - finalBarFontSize * 0.2 - 3;
            
            mainChartGroup.append("text")
                .attr("class", "label value-label bar-value-label")
                .attr("x", centerX)
                .attr("y", barLabelY)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${finalBarFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.barLabelColor)
                .text(barLabelText);
        }

        // Shapes (Squares)
        const shapeValue = d[value2FieldName];
        const sideLength = sideLengthScale(shapeValue);

        mainChartGroup.append("rect")
            .attr("class", "mark shape")
            .attr("x", centerX - sideLength / 2)
            .attr("y", shapeVisualCenterY - sideLength / 2)
            .attr("width", sideLength)
            .attr("height", sideLength)
            .attr("fill", fillStyle.shapeFillColor)
            .attr("opacity", 0.9);

        // Shape value labels
        const shapeLabelText = formatValue(shapeValue) + value2Unit;
        const shapeLabelTextWidth = estimateTextWidth(shapeLabelText, finalShapeFontSize, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        
        let shapeLabelColor, shapeLabelActualY, shapeLabelDy;
        const isShapeBigEnoughForInternalLabel = shapeLabelTextWidth < (sideLength * 0.9) && sideLength > finalShapeFontSize * 1.2;

        if (isShapeBigEnoughForInternalLabel) {
            shapeLabelColor = fillStyle.barLabelColor; // White for contrast
            shapeLabelActualY = shapeVisualCenterY;
            shapeLabelDy = "0.35em"; // Vertically center
        } else {
            shapeLabelColor = fillStyle.textColor;
            shapeLabelActualY = shapeVisualCenterY + sideLength / 2 + finalShapeFontSize * 0.7 + labelMargin;
            shapeLabelDy = "0em";
        }
        
        mainChartGroup.append("text")
            .attr("class", "label value-label shape-value-label")
            .attr("x", centerX)
            .attr("y", shapeLabelActualY)
            .attr("dy", shapeLabelDy)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${finalShapeFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", shapeLabelColor)
            .text(shapeLabelText);

        // Dimension labels
        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", centerX)
            .attr("y", dimensionLabelY)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${finalDimensionFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .call(wrapText, d[categoryFieldName], maxDimensionLabelWidth, centerX, dimensionLabelY, finalDimensionFontSize, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex visual effects like gradients or shadows. Rounded bars are kept as per original visual.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}