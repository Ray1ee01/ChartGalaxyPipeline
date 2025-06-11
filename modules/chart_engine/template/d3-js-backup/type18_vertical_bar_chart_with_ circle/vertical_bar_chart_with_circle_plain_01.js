/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart With Circle",
  "chart_name": "vertical_bar_chart_with_circle_plain_01",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 12], ["-inf", "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary", "secondary"],
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || {};
    const inputImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const valueField2Config = dataColumns.find(col => col.role === "y2");

    const dimensionFieldName = dimensionFieldConfig?.name;
    const valueFieldName = valueFieldConfig?.name;
    const valueField2Name = valueField2Config?.name;

    if (!dimensionFieldName || !valueFieldName || !valueField2Name) {
        let missingFields = [];
        if (!dimensionFieldName) missingFields.push("field with role 'x'");
        if (!valueFieldName) missingFields.push("field with role 'y'");
        if (!valueField2Name) missingFields.push("field with role 'y2'");
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        return null;
    }

    let valueUnit = (valueFieldConfig?.unit === "none" ? "" : valueFieldConfig?.unit) || "";
    let valueUnit2 = (valueField2Config?.unit === "none" ? "" : valueField2Config?.unit) || "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            label: {
                fontFamily: (inputTypography.label && inputTypography.label.font_family) ? inputTypography.label.font_family : 'Arial, sans-serif',
                fontSize: (inputTypography.label && inputTypography.label.font_size) ? inputTypography.label.font_size : '16px',
                fontWeight: (inputTypography.label && inputTypography.label.font_weight) ? inputTypography.label.font_weight : '500',
            },
            annotation: { // For bar values, legend
                fontFamily: (inputTypography.annotation && inputTypography.annotation.font_family) ? inputTypography.annotation.font_family : 'Arial, sans-serif',
                fontSize: (inputTypography.annotation && inputTypography.annotation.font_size) ? inputTypography.annotation.font_size : '12px',
                fontWeight: (inputTypography.annotation && inputTypography.annotation.font_weight) ? inputTypography.annotation.font_weight : '400',
            }
        },
        colors: {
            textColor: inputColors.text_color || '#0F223B',
            backgroundColor: inputColors.background_color || '#FFFFFF',
            primaryAccent: (inputColors.other && inputColors.other.primary) ? inputColors.other.primary : '#008080', // Teal default
            secondaryAccent: (inputColors.other && inputColors.other.secondary) ? inputColors.other.secondary : '#FF0000', // Red default
            defaultCategoryColor: '#CCCCCC',
            getCategoryColor: (categoryValue, index) => {
                if (inputColors.field && inputColors.field[categoryValue]) {
                    return inputColors.field[categoryValue];
                }
                if (inputColors.available_colors && inputColors.available_colors.length > 0) {
                    return inputColors.available_colors[index % inputColors.available_colors.length];
                }
                return fillStyle.colors.defaultCategoryColor;
            },
            circleLabelInsideColor: '#FFFFFF',
        },
        images: {
            getImageUrl: (categoryValue) => {
                if (inputImages.field && inputImages.field[categoryValue]) {
                    return inputImages.field[categoryValue];
                }
                return null;
            }
        },
        circleOpacity: 0.8,
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttributeNS(null, 'font-family', fontFamily);
        tempText.setAttributeNS(null, 'font-size', fontSize);
        tempText.setAttributeNS(null, 'font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might not work on unattached elements
            const numFontSize = parseFloat(fontSize) || 10;
            width = text.length * numFontSize * 0.6; 
        }
        return width;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };
    
    function wrapText(textElement, text, maxWidth, x, y, style) {
        textElement.each(function() {
            const element = d3.select(this);
            element.selectAll("tspan").remove(); // Clear previous tspans

            let words = String(text).split(/\s+/).reverse(),
                word,
                line = [],
                lineNumber = 0,
                lineHeight = 1.1, // ems
                tspan = element.append("tspan").attr("x", x).attr("y", y),
                dy = 0;

            if (estimateTextWidth(text, style.fontFamily, style.fontSize, style.fontWeight) <= maxWidth) {
                tspan.text(text);
                return;
            }

            let lines = [];
            let currentLineStr = "";
            while (word = words.pop()) {
                line.push(word);
                currentLineStr = line.join(" ");
                if (estimateTextWidth(currentLineStr, style.fontFamily, style.fontSize, style.fontWeight) > maxWidth && line.length > 1) {
                    line.pop();
                    lines.push(line.join(" "));
                    line = [word];
                    if (lines.length >= 1) { // Limit to 2 lines for simplicity
                        line = [word].concat(words.reverse());
                        break;
                    }
                }
            }
            lines.push(line.join(" "));

            lines.slice(0, 2).forEach((lineText, i) => { // Max 2 lines
                if (i > 0) dy = lineHeight;
                element.append("tspan")
                    .attr("x", x)
                    .attr("y", y)
                    .attr("dy", `${dy}em`)
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
        .style("background-color", fillStyle.colors.backgroundColor)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 50, bottom: 30, left: 50 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centralBandHeight = innerHeight * 0.20;
    const barAreaHeight = innerHeight - centralBandHeight;

    const maxPositiveY = d3.max(rawChartData, d => Math.max(0, +d[valueFieldName])) || 0;
    const maxNegativeY = Math.abs(d3.min(rawChartData, d => Math.min(0, +d[valueFieldName])) || 0);
    const totalMagnitudeRange = maxPositiveY + maxNegativeY;

    let topBarAreaHeight = totalMagnitudeRange > 0 ? barAreaHeight * (maxPositiveY / totalMagnitudeRange) : barAreaHeight / 2;
    let bottomBarAreaHeight = totalMagnitudeRange > 0 ? barAreaHeight * (maxNegativeY / totalMagnitudeRange) : barAreaHeight / 2;
    if (totalMagnitudeRange === 0) { // Ensure full height is used if all values are 0
        topBarAreaHeight = barAreaHeight / 2;
        bottomBarAreaHeight = barAreaHeight / 2;
    }


    const centralBandTopY = chartMargins.top + topBarAreaHeight;
    const centralBandBottomY = centralBandTopY + centralBandHeight;

    const iconSize = 20;
    const iconMargin = 3;
    const labelMargin = 3;

    const baseFontSizeLabel = parseFloat(fillStyle.typography.label.fontSize);
    const baseFontSizeAnnotation = parseFloat(fillStyle.typography.annotation.fontSize);
    const minFontSize = 8;

    const dimensionLabelY = centralBandTopY + centralBandHeight * 0.30;
    const circleY = centralBandTopY + centralBandHeight * 0.70;

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [valueFieldName]: +d[valueFieldName],
        [valueField2Name]: +d[valueField2Name]
    }));

    chartDataArray.sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const dimensions = chartDataArray.map(d => d[dimensionFieldName]);

    let firstDimensionColor = fillStyle.colors.defaultCategoryColor;
    if (chartDataArray.length > 0) {
        firstDimensionColor = fillStyle.colors.getCategoryColor(chartDataArray[0][dimensionFieldName], 0);
    }
    
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

    const maxValue2 = d3.max(chartDataArray, d => d[valueField2Name]) || 0;
    const minRadius = 2;

    const maxRadiusFromBarWidth = xScale.bandwidth() / 2 * 0.9;
    const actualCircleAreaTopY = dimensionLabelY + baseFontSizeLabel + labelMargin;
    const circleAreaHeight = centralBandBottomY - actualCircleAreaTopY;
    const maxCircleRadiusAvailableBasedOnHeight = Math.max(0, (circleAreaHeight * 0.9) / 2);
    const maxCircleRadiusAvailable = Math.min(maxCircleRadiusAvailableBasedOnHeight, maxRadiusFromBarWidth);
    const maxRadius = Math.max(minRadius, maxCircleRadiusAvailable);

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxValue2])
        .range([minRadius, maxRadius]);

    let minDimensionLabelRatio = 1.0;
    let minCircleLabelRatio = 1.0;
    let minBarLabelRatio = 1.0;

    const maxDimensionLabelWidth = xScale.bandwidth() * 0.98;
    const maxCircleLabelWidth = xScale.bandwidth() * 1.03;
    const maxBarLabelWidth = xScale.bandwidth();

    chartDataArray.forEach(d => {
        const dimensionText = String(d[dimensionFieldName]);
        let currentWidth = estimateTextWidth(dimensionText, fillStyle.typography.label.fontFamily, baseFontSizeLabel + 'px', fillStyle.typography.label.fontWeight);
        if (currentWidth > maxDimensionLabelWidth) {
            minDimensionLabelRatio = Math.min(minDimensionLabelRatio, maxDimensionLabelWidth / currentWidth);
        }

        const circleText = formatValue(d[valueField2Name]) + valueUnit2;
        currentWidth = estimateTextWidth(circleText, fillStyle.typography.label.fontFamily, baseFontSizeLabel + 'px', fillStyle.typography.label.fontWeight);
        if (currentWidth > maxCircleLabelWidth) {
            minCircleLabelRatio = Math.min(minCircleLabelRatio, maxCircleLabelWidth / currentWidth);
        }

        const barValue = d[valueFieldName];
        const barText = (barValue > 0 ? "+" : "") + formatValue(barValue) + valueUnit;
        currentWidth = estimateTextWidth(barText, fillStyle.typography.annotation.fontFamily, baseFontSizeAnnotation + 'px', fillStyle.typography.annotation.fontWeight);
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

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendY = chartMargins.top / 2;
    const legendSquareSize = 12;
    const legendCircleRadius = 6;
    const legendPadding = 15;
    const legendItemPadding = 5;

    const legendSymbolColor = firstDimensionColor;
    const legendFont = fillStyle.typography.annotation;

    const yNameText = valueFieldConfig?.title || valueFieldName;
    const y2NameText = valueField2Config?.title || valueField2Name;

    const yNameWidth = estimateTextWidth(yNameText, legendFont.fontFamily, legendFont.fontSize, legendFont.fontWeight);
    const y2NameWidth = estimateTextWidth(y2NameText, legendFont.fontFamily, legendFont.fontSize, legendFont.fontWeight);

    const totalLegendWidth = legendSquareSize + legendItemPadding +
                           yNameWidth + legendPadding +
                           (legendCircleRadius * 2) + legendItemPadding +
                           y2NameWidth;

    const legendStartX = chartMargins.left + (innerWidth - totalLegendWidth) / 2;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendStartX}, ${legendY})`);

    let currentXLegend = 0;

    legendGroup.append("rect")
        .attr("class", "mark legend-mark legend-square")
        .attr("x", currentXLegend)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", legendSymbolColor);
    currentXLegend += legendSquareSize + legendItemPadding;

    legendGroup.append("text")
        .attr("class", "text legend-label")
        .attr("x", currentXLegend)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFont.fontFamily)
        .style("font-size", legendFont.fontSize)
        .style("font-weight", legendFont.fontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(yNameText);
    currentXLegend += yNameWidth + legendPadding;

    legendGroup.append("circle")
        .attr("class", "mark legend-mark legend-circle")
        .attr("cx", currentXLegend + legendCircleRadius)
        .attr("cy", 0)
        .attr("r", legendCircleRadius)
        .attr("fill", legendSymbolColor);
    currentXLegend += (legendCircleRadius * 2) + legendItemPadding;

    legendGroup.append("text")
        .attr("class", "text legend-label")
        .attr("x", currentXLegend)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFont.fontFamily)
        .style("font-size", legendFont.fontSize)
        .style("font-weight", legendFont.fontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(y2NameText);

    // Block 8: Main Data Visualization Rendering
    chartDataArray.forEach((d, i) => {
        const xPos = xScale(d[dimensionFieldName]);
        const barWidth = xScale.bandwidth();
        const centerX = xPos + barWidth / 2;
        const categoryColor = fillStyle.colors.getCategoryColor(d[dimensionFieldName], i);

        // Bars (yValue)
        const yValue = d[valueFieldName];
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
        barHeight = Math.max(0, barHeight); // Ensure non-negative height

        if (barHeight > 0) {
            mainChartGroup.append("rect")
                .attr("class", "mark bar")
                .attr("x", xPos)
                .attr("y", barY)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", categoryColor);

            // Bar value label
            const barLabelText = (yValue > 0 ? "+" : "") + formatValue(yValue) + valueUnit;
            const barLabelY = (yValue >= 0) ? barY - 5 : barY + barHeight + (finalBarFontSize * 0.8);
            
            mainChartGroup.append("text")
                .attr("class", "label value-label bar-value-label")
                .attr("x", centerX)
                .attr("y", barLabelY)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotation.fontFamily)
                .style("font-size", `${finalBarFontSize}px`)
                .style("font-weight", fillStyle.typography.annotation.fontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(barLabelText);

            // Icon for bar
            const iconUrl = fillStyle.images.getImageUrl(d[dimensionFieldName]);
            if (iconUrl) {
                const iconTargetY = barLabelY - (finalBarFontSize * (yValue >= 0 ? 0.7 : 0.1)); // Adjust based on label position
                const iconActualY = iconTargetY - iconMargin - iconSize; // Icon above the label text
                mainChartGroup.append("image")
                    .attr("class", "icon bar-icon")
                    .attr("x", centerX - iconSize / 2)
                    .attr("y", iconActualY)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("xlink:href", iconUrl)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        }

        // Circles (y2Value)
        const circleRadius = radiusScale(d[valueField2Name]);
        mainChartGroup.append("circle")
            .attr("class", "mark circle")
            .attr("cx", centerX)
            .attr("cy", circleY)
            .attr("r", circleRadius)
            .attr("fill", categoryColor)
            .attr("opacity", fillStyle.circleOpacity);

        // Circle value label
        const circleLabelText = formatValue(d[valueField2Name]) + valueUnit2;
        const circleLabelTextWidth = estimateTextWidth(circleLabelText, fillStyle.typography.label.fontFamily, `${finalCircleFontSize}px`, fillStyle.typography.label.fontWeight);
        
        const isCircleBigEnoughForText = circleLabelTextWidth < (circleRadius * 1.6); // Heuristic
        let circleValLabelColor, circleValLabelActualY, circleValLabelDy;

        if (isCircleBigEnoughForText && circleRadius > minFontSize / 2) {
            circleValLabelColor = fillStyle.colors.circleLabelInsideColor;
            circleValLabelActualY = circleY;
            circleValLabelDy = "0.35em"; // Vertically center
        } else {
            circleValLabelColor = fillStyle.colors.textColor;
            circleValLabelActualY = circleY + circleRadius + (finalCircleFontSize * 0.6) + labelMargin;
            circleValLabelDy = "0em";
        }

        mainChartGroup.append("text")
            .attr("class", "label value-label circle-value-label")
            .attr("x", centerX)
            .attr("y", circleValLabelActualY)
            .attr("dy", circleValLabelDy)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.label.fontFamily)
            .style("font-size", `${finalCircleFontSize}px`)
            .style("font-weight", fillStyle.typography.label.fontWeight)
            .style("fill", circleValLabelColor)
            .text(circleLabelText);

        // Dimension label (xValue)
        const dimensionTextStyle = {
            fontFamily: fillStyle.typography.label.fontFamily,
            fontSize: `${finalDimensionFontSize}px`,
            fontWeight: fillStyle.typography.label.fontWeight
        };
        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            // x, y are set by wrapText
            .attr("text-anchor", "middle")
            .style("font-family", dimensionTextStyle.fontFamily)
            .style("font-size", dimensionTextStyle.fontSize)
            .style("font-weight", dimensionTextStyle.fontWeight)
            .style("fill", fillStyle.colors.textColor)
            .call(wrapText, String(d[dimensionFieldName]), maxDimensionLabelWidth, centerX, dimensionLabelY, dimensionTextStyle);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}