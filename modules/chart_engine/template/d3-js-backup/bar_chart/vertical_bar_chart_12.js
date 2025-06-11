/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart with Proportional Circles",
  "chart_name": "vertical_bar_proportional_circle_area_chart_01",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 30], ["-inf", "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || {};
    const inputImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name;

    const missingFields = [];
    if (!dimensionField) missingFields.push("x role field");
    if (!valueField) missingFields.push("y role field");
    if (!valueField2) missingFields.push("y2 role field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    let valueUnit = dataColumns.find(col => col.role === "y" && col.name === valueField)?.unit || "";
    if (valueUnit === "none") valueUnit = "";
    let valueUnit2 = dataColumns.find(col => col.role === "y2" && col.name === valueField2)?.unit || "";
    if (valueUnit2 === "none") valueUnit2 = "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography = {
        labelFontFamily: (inputTypography.label && inputTypography.label.font_family) || defaultTypography.label.font_family,
        labelFontSize: (inputTypography.label && inputTypography.label.font_size) || defaultTypography.label.font_size,
        labelFontWeight: (inputTypography.label && inputTypography.label.font_weight) || defaultTypography.label.font_weight,
        annotationFontFamily: (inputTypography.annotation && inputTypography.annotation.font_family) || defaultTypography.annotation.font_family,
        annotationFontSize: (inputTypography.annotation && inputTypography.annotation.font_size) || defaultTypography.annotation.font_size,
        annotationFontWeight: (inputTypography.annotation && inputTypography.annotation.font_weight) || defaultTypography.annotation.font_weight,
    };

    const defaultColors = {
        text_color: "#212529",
        background_color: "#FFFFFF",
        other: { primary: "#007bff", secondary: "#6c757d" },
        available_colors: d3.schemeCategory10
    };

    fillStyle.textColor = inputColors.text_color || defaultColors.text_color;
    fillStyle.backgroundColor = inputColors.background_color || defaultColors.background_color;
    
    const categoryColors = inputColors.field || {};
    const availableColors = inputColors.available_colors || defaultColors.available_colors;
    const primaryColor = (inputColors.other && inputColors.other.primary) || defaultColors.other.primary;

    fillStyle.getCategoryColor = (categoryName, index) => {
        if (categoryColors[categoryName]) {
            return categoryColors[categoryName];
        }
        if (availableColors && availableColors.length > 0) {
            return availableColors[index % availableColors.length];
        }
        return primaryColor;
    };

    const categoryImages = inputImages.field || {};
    const otherImages = inputImages.other || {};
    fillStyle.getIconUrl = (categoryName) => {
        return categoryImages[categoryName] || otherImages.primary || null;
    };
    
    function estimateTextWidth(text, fontSize, fontWeight, fontFamily) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document append/remove is not strictly necessary for getBBox if styles are applied directly,
        // but some browsers might be more consistent if it's briefly in DOM.
        // For this implementation, we avoid DOM append.
        // document.body.appendChild(tempSvg); // Not appending to DOM
        const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg); // Not appending to DOM
        return width;
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value).replace('M', 'M');
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value).replace('k', 'K');
        return d3.format("~.1f")(value); // Keep one decimal for smaller numbers
    };

    function wrapText(textSelection, text, maxWidth, x, y, fontSize, fontWeight, fontFamily) {
        textSelection.each(function() {
            const element = d3.select(this);
            element.text(null); // Clear existing content

            let words = text.split(/\s+/).reverse(),
                word,
                line = [],
                lineNumber = 0,
                lineHeight = 1.1, // ems
                tspan = element.append("tspan").attr("x", x).attr("y", y),
                currentLineText = "";

            if (estimateTextWidth(text, fontSize, fontWeight, fontFamily) <= maxWidth) {
                tspan.text(text);
                return;
            }
            
            let lines = [];
            let currentLineArray = [];
            while (word = words.pop()) {
                currentLineArray.push(word);
                currentLineText = currentLineArray.join(" ");
                if (estimateTextWidth(currentLineText, fontSize, fontWeight, fontFamily) > maxWidth && currentLineArray.length > 1) {
                    currentLineArray.pop(); // remove the word that broke the limit
                    lines.push(currentLineArray.join(" ")); // Add the previous line
                    currentLineArray = [word]; // Start new line with the current word
                    if (lines.length >= 1) { // Limit to 2 lines for this specific chart's behavior
                        currentLineArray = [word].concat(words.reverse()); // Put remaining words on the second line
                        words = []; // Stop processing further words
                        break;
                    }
                }
            }
            lines.push(currentLineArray.join(" "));

            lines.slice(0, 2).forEach((lineText, i) => { // Render max 2 lines
                element.append("tspan")
                    .attr("x", x)
                    .attr("y", y)
                    .attr("dy", `${i * lineHeight}em`)
                    .text(lineText);
            });
        });
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 50, bottom: 30, left: 50 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centralBandHeight = innerHeight * 0.20;
    const barAreaHeight = innerHeight - centralBandHeight;

    const baseFontSizeLabel = parseFloat(fillStyle.typography.labelFontSize);
    const baseFontSizeAnnotation = parseFloat(fillStyle.typography.annotationFontSize);
    const minFontSize = 8;

    const iconSize = 20;
    const iconMargin = 3;
    const labelMargin = 3;
    // const circlePadding = 5; // Not explicitly used in original logic after refactor target

    // Block 5: Data Preprocessing & Transformation
    let chartDataArray = rawChartData.map(d => ({
        ...d,
        [valueField]: +d[valueField],
        [valueField2]: +d[valueField2]
    }));

    chartDataArray.sort((a, b) => b[valueField] - a[valueField]);
    const dimensions = chartDataArray.map(d => d[dimensionField]);

    const maxPositiveY = d3.max(chartDataArray, d => Math.max(0, d[valueField])) || 0;
    const maxNegativeY = Math.abs(d3.min(chartDataArray, d => Math.min(0, d[valueField])) || 0);
    const totalMagnitudeRange = maxPositiveY + maxNegativeY;

    let topBarAreaHeight;
    let bottomBarAreaHeight;
    if (totalMagnitudeRange > 0) {
        topBarAreaHeight = barAreaHeight * (maxPositiveY / totalMagnitudeRange);
        bottomBarAreaHeight = barAreaHeight * (maxNegativeY / totalMagnitudeRange);
    } else {
        topBarAreaHeight = barAreaHeight / 2;
        bottomBarAreaHeight = barAreaHeight / 2;
    }

    const centralBandTopY = chartMargins.top + topBarAreaHeight;
    const centralBandBottomY = centralBandTopY + centralBandHeight;
    
    const dimensionLabelY = centralBandTopY + centralBandHeight * 0.30;
    const circleY = centralBandTopY + centralBandHeight * 0.70;

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

    const maxValue2 = d3.max(chartDataArray, d => d[valueField2]) || 0;
    const minRadius = 2;
    
    const maxRadiusFromBarWidth = xScale.bandwidth() / 2 * 0.9;
    const actualCircleAreaTopY = dimensionLabelY + baseFontSizeLabel + labelMargin;
    const circleAreaHeightForRadius = centralBandBottomY - actualCircleAreaTopY;
    const maxCircleRadiusAvailableBasedOnHeight = Math.max(0, (circleAreaHeightForRadius * 0.9) / 2);
    const maxCircleRadiusAvailable = Math.min(maxCircleRadiusAvailableBasedOnHeight, maxRadiusFromBarWidth);
    const maxRadius = Math.max(minRadius, maxCircleRadiusAvailable);

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxValue2])
        .range([minRadius, maxRadius]);

    // Font size calculation loop
    let minDimensionLabelRatio = 1.0;
    let minCircleLabelRatio = 1.0;
    let minBarLabelRatio = 1.0;

    const maxDimensionLabelWidth = xScale.bandwidth() * 0.98;
    const maxCircleLabelWidth = xScale.bandwidth() * 1.03;
    const maxBarLabelWidth = xScale.bandwidth();

    chartDataArray.forEach(d => {
        const dimensionText = String(d[dimensionField]);
        let currentWidth = estimateTextWidth(dimensionText, baseFontSizeLabel, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        if (currentWidth > maxDimensionLabelWidth) {
            minDimensionLabelRatio = Math.min(minDimensionLabelRatio, maxDimensionLabelWidth / currentWidth);
        }

        const circleText = formatValue(d[valueField2]) + valueUnit2;
        currentWidth = estimateTextWidth(circleText, baseFontSizeLabel, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        if (currentWidth > maxCircleLabelWidth) {
            minCircleLabelRatio = Math.min(minCircleLabelRatio, maxCircleLabelWidth / currentWidth);
        }

        const barVal = d[valueField];
        const barText = (barVal > 0 ? "+" : "") + formatValue(barVal) + valueUnit;
        currentWidth = estimateTextWidth(barText, baseFontSizeAnnotation, fillStyle.typography.annotationFontWeight, fillStyle.typography.annotationFontFamily);
        if (currentWidth > maxBarLabelWidth) {
            minBarLabelRatio = Math.min(minBarLabelRatio, maxBarLabelWidth / currentWidth);
        }
    });

    const finalDimensionFontSize = Math.max(minFontSize, baseFontSizeLabel * minDimensionLabelRatio);
    const finalCircleFontSize = Math.max(minFontSize, baseFontSizeLabel * minCircleLabelRatio);
    const finalBarFontSize = Math.max(minFontSize, baseFontSizeAnnotation * minBarLabelRatio);

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, 0)`);

    // Block 7: Chart Component Rendering (Legend)
    const legendY = chartMargins.top / 2.5; // Adjusted Y position
    const legendSquareSize = 12;
    const legendCircleRadius = 6;
    const legendPadding = 15;
    const legendItemPadding = 5;

    const yName = valueField;
    const y2Name = valueField2;
    
    const firstDimensionName = chartDataArray.length > 0 ? chartDataArray[0][dimensionField] : "series1";
    const legendSymbolColor = fillStyle.getCategoryColor(firstDimensionName, 0);

    const legendFontFamily = fillStyle.typography.annotationFontFamily;
    const legendFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    const legendFontWeight = fillStyle.typography.annotationFontWeight;

    const yNameWidth = estimateTextWidth(yName, legendFontSize, legendFontWeight, legendFontFamily);
    const y2NameWidth = estimateTextWidth(y2Name, legendFontSize, legendFontWeight, legendFontFamily);

    const totalLegendWidth = legendSquareSize + legendItemPadding +
                           yNameWidth + legendPadding +
                           (legendCircleRadius * 2) + legendItemPadding +
                           y2NameWidth;

    const legendStartX = chartMargins.left + (innerWidth - totalLegendWidth) / 2;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend chart-legend")
        .attr("transform", `translate(${legendStartX}, ${legendY})`);

    let currentXLegend = 0;

    legendGroup.append("rect")
        .attr("class", "legend-item legend-symbol legend-symbol-bar")
        .attr("x", currentXLegend)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", legendSymbolColor);
    currentXLegend += legendSquareSize + legendItemPadding;

    legendGroup.append("text")
        .attr("class", "legend-item legend-label legend-label-bar")
        .attr("x", currentXLegend)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFontFamily)
        .style("font-size", `${legendFontSize}px`)
        .style("font-weight", legendFontWeight)
        .style("fill", fillStyle.textColor)
        .text(yName);
    currentXLegend += yNameWidth + legendPadding;

    legendGroup.append("circle")
        .attr("class", "legend-item legend-symbol legend-symbol-circle")
        .attr("cx", currentXLegend + legendCircleRadius)
        .attr("cy", 0)
        .attr("r", legendCircleRadius)
        .attr("fill", legendSymbolColor);
    currentXLegend += (legendCircleRadius * 2) + legendItemPadding;

    legendGroup.append("text")
        .attr("class", "legend-item legend-label legend-label-circle")
        .attr("x", currentXLegend)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFontFamily)
        .style("font-size", `${legendFontSize}px`)
        .style("font-weight", legendFontWeight)
        .style("fill", fillStyle.textColor)
        .text(y2Name);

    // Block 8: Main Data Visualization Rendering
    chartDataArray.forEach((d, i) => {
        const categoryName = d[dimensionField];
        const itemColor = fillStyle.getCategoryColor(categoryName, i);
        const itemIconUrl = fillStyle.getIconUrl(categoryName);

        const xPos = xScale(categoryName);
        const barWidth = xScale.bandwidth();
        const centerX = xPos + barWidth / 2;
        
        const yValue = d[valueField];
        let barHeight, barY;

        if (yValue > 0) {
            barY = yScalePositive(yValue);
            barHeight = centralBandTopY - barY;
        } else if (yValue < 0) {
            barY = centralBandBottomY;
            const scaledY = yScaleNegative(Math.abs(yValue));
            barHeight = scaledY - barY;
        } else {
            barHeight = 0;
            barY = centralBandTopY;
        }
        if (barHeight < 0) barHeight = 0;

        if (barHeight > 0) {
            mainChartGroup.append("rect")
                .attr("class", `mark bar category-${String(categoryName).replace(/\s+/g, '-').toLowerCase()}`)
                .attr("x", xPos)
                .attr("y", barY)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", itemColor);
                // Removed rx, ry for simplicity as per directives

            const barLabelText = (yValue > 0 ? "+" : "") + formatValue(yValue) + valueUnit;
            const barLabelY = (yValue >= 0) ? barY - 5 : barY + barHeight + (finalBarFontSize * 0.8);

            mainChartGroup.append("text")
                .attr("class", "label value-label bar-value-label")
                .attr("x", centerX)
                .attr("y", barLabelY)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${finalBarFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(barLabelText);
            
            if (itemIconUrl) {
                const iconTargetY = barLabelY - (finalBarFontSize * (yValue >= 0 ? 0.7 : 0.1)); // Adjusted from original
                const iconYPos = iconTargetY - iconSize; // iconMargin is implicitly handled by targetY adjustment

                mainChartGroup.append("image")
                    .attr("class", `image icon category-icon category-${String(categoryName).replace(/\s+/g, '-').toLowerCase()}`)
                    .attr("x", centerX - iconSize / 2)
                    .attr("y", iconYPos)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("xlink:href", itemIconUrl)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        }

        const circleRadiusValue = radiusScale(d[valueField2]);
        mainChartGroup.append("circle")
            .attr("class", `mark circle category-${String(categoryName).replace(/\s+/g, '-').toLowerCase()}`)
            .attr("cx", centerX)
            .attr("cy", circleY)
            .attr("r", circleRadiusValue)
            .attr("fill", itemColor)
            .attr("opacity", 0.8);

        const circleLabelText = formatValue(d[valueField2]) + valueUnit2;
        const estCircleTextWidth = estimateTextWidth(circleLabelText, finalCircleFontSize, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        const isCircleBigEnough = estCircleTextWidth < (circleRadiusValue * 1.6); // Heuristic from original
        
        let circleLabelColor, circleLabelActualY, circleLabelDy;
        if (isCircleBigEnough && circleRadiusValue > minFontSize / 2) {
            circleLabelColor = "#FFFFFF"; // Contrast color for inside label
            circleLabelActualY = circleY;
            circleLabelDy = "0.35em"; // Vertical centering
        } else {
            circleLabelColor = fillStyle.textColor;
            circleLabelActualY = circleY + circleRadiusValue + (finalCircleFontSize * 0.6) + labelMargin;
            circleLabelDy = "0em";
        }

        mainChartGroup.append("text")
            .attr("class", "label value-label circle-value-label")
            .attr("x", centerX)
            .attr("y", circleLabelActualY)
            .attr("dy", circleLabelDy)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${finalCircleFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", circleLabelColor)
            .text(circleLabelText);

        mainChartGroup.append("text")
            .attr("class", `label dimension-label category-label category-${String(categoryName).replace(/\s+/g, '-').toLowerCase()}`)
            // x and y are set by wrapText
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${finalDimensionFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .call(wrapText, String(d[dimensionField]), maxDimensionLabelWidth, centerX, dimensionLabelY, finalDimensionFontSize, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // None for this chart after simplification.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}