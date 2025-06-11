/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart With Circle",
  "chart_name": "vertical_bar_chart_12",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["none"],
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const y2Field = dataColumns.find(col => col.role === "y2")?.name;

    const criticalFields = { xField, yField, y2Field };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: Roles for ${missingFields.join(', ')} not found in dataColumns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const yFieldDef = dataColumns.find(col => col.role === "y");
    const yUnit = (yFieldDef?.unit === "none" || !yFieldDef?.unit) ? "" : yFieldDef.unit;
    const y2FieldDef = dataColumns.find(col => col.role === "y2");
    const y2Unit = (y2FieldDef?.unit === "none" || !y2FieldDef?.unit) ? "" : y2FieldDef.unit;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: rawTypography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: rawTypography.title?.font_size || '28px',
            titleFontWeight: rawTypography.title?.font_weight || '700',
            labelFontFamily: rawTypography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: rawTypography.label?.font_size || '16px',
            labelFontWeight: rawTypography.label?.font_weight || '500',
            annotationFontFamily: rawTypography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: rawTypography.annotation?.font_size || '12px',
            annotationFontWeight: rawTypography.annotation?.font_weight || '400',
        },
        textColor: rawColors.text_color || '#000000',
        chartBackground: rawColors.background_color || '#FFFFFF',
        primaryColor: rawColors.other?.primary || '#008080',
        secondaryColor: rawColors.other?.secondary || '#FF0000', // Not directly used for elements, but good to have
        defaultCategoricalColor: '#888888',
    };

    const defaultCategoricalColors = d3.schemeCategory10;
    fillStyle.getCategoricalColor = (key, index) => {
        if (rawColors.field && rawColors.field[key]) {
            return rawColors.field[key];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[index % rawColors.available_colors.length];
        }
        return defaultCategoricalColors[index % defaultCategoricalColors.length];
    };

    fillStyle.getImageUrl = (key) => {
        if (rawImages.field && rawImages.field[key]) {
            return rawImages.field[key];
        }
        if (rawImages.other && rawImages.other[key]) { // e.g. rawImages.other.defaultIcon
            return rawImages.other[key];
        }
        return null;
    };
    
    function estimateTextWidth(text, fontSize, fontWeight, fontFamily) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize); // fontSize should be like "12px"
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // No DOM attachment needed for getBBox in modern browsers
        try {
            return textElement.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth: getBBox failed, using approximation.", e);
            return (String(text).length * parseFloat(fontSize) * 0.6); // Fallback
        }
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (Math.abs(value) >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (Math.abs(value) >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    function wrapText(textSelection, textContent, maxWidth, x, y, fontSize, fontWeight, fontFamily) {
        textSelection.each(function() {
            const d3Text = d3.select(this);
            d3Text.text(null); // Clear existing content

            const words = String(textContent).split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const lineHeight = 1.1; // ems
            let tspan = d3Text.append("tspan").attr("x", x).attr("y", y).attr("dy", `0em`);

            if (estimateTextWidth(textContent, fontSize, fontWeight, fontFamily) <= maxWidth) {
                tspan.text(textContent);
                return;
            }
            
            let linesRendered = 0;
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (estimateTextWidth(line.join(" "), fontSize, fontWeight, fontFamily) > maxWidth && line.length > 1) {
                    line.pop();
                    tspan.text(line.join(" "));
                    if (linesRendered >= 1) { // Max 2 lines for simplicity
                        tspan.text(tspan.text() + "..."); // Add ellipsis if truncated
                        break;
                    }
                    line = [word];
                    tspan = d3Text.append("tspan").attr("x", x).attr("y", y).attr("dy", `${++lineNumber * lineHeight}em`).text(word);
                    linesRendered++;
                }
            }
            if (words.length > 0 && linesRendered < 1) { // If first line was already too long and got truncated
                 // Handled by the loop logic, if it breaks, it might have added ellipsis
            } else if (words.length > 0 && estimateTextWidth(line.join(" "), fontSize, fontWeight, fontFamily) > maxWidth) {
                 // If the last line is still too long, truncate it
                 let currentText = line.join(" ");
                 while(estimateTextWidth(currentText + "...", fontSize, fontWeight, fontFamily) > maxWidth && currentText.length > 0) {
                    currentText = currentText.slice(0, -1);
                 }
                 tspan.text(currentText + "...");
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
        .attr("class", "chart-svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 50, bottom: 30, left: 50 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centralBandHeight = innerHeight * 0.20;
    const barAreaHeight = innerHeight - centralBandHeight;

    const maxPositiveY = d3.max(chartDataInput, d => Math.max(0, +d[yField])) || 0;
    const maxNegativeY = Math.abs(d3.min(chartDataInput, d => Math.min(0, +d[yField])) || 0);
    const totalMagnitudeRange = maxPositiveY + maxNegativeY;

    let topBarAreaHeight = totalMagnitudeRange > 0 ? barAreaHeight * (maxPositiveY / totalMagnitudeRange) : barAreaHeight / 2;
    let bottomBarAreaHeight = totalMagnitudeRange > 0 ? barAreaHeight * (maxNegativeY / totalMagnitudeRange) : barAreaHeight / 2;
    if (totalMagnitudeRange === 0) { // Ensure full height is used if all values are zero
        topBarAreaHeight = barAreaHeight / 2;
        bottomBarAreaHeight = barAreaHeight / 2;
    }


    const centralBandTopY = chartMargins.top + topBarAreaHeight;
    const centralBandBottomY = centralBandTopY + centralBandHeight;

    const iconSize = 20;
    const iconMargin = 3;
    const labelMargin = 3; // Used for vertical spacing around labels

    const baseFontSizeLabelNum = parseFloat(fillStyle.typography.labelFontSize);
    const baseFontSizeAnnotationNum = parseFloat(fillStyle.typography.annotationFontSize);
    const minFontSizeNum = 8;

    const dimensionLabelY = centralBandTopY + centralBandHeight * 0.30;
    const circleY = centralBandTopY + centralBandHeight * 0.70;

    // Block 5: Data Preprocessing & Transformation
    const chartData = chartDataInput.map(d => ({
        ...d,
        [yField]: +d[yField],
        [y2Field]: +d[y2Field]
    }));

    chartData.sort((a, b) => b[yField] - a[yField]);
    const dimensions = chartData.map(d => d[xField]);

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

    const maxValue2 = d3.max(chartData, d => d[y2Field]) || 0;
    const minRadius = 2;
    
    const maxRadiusFromBarWidth = xScale.bandwidth() / 2 * 0.9;
    const actualCircleAreaTopY = dimensionLabelY + baseFontSizeLabelNum + labelMargin;
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

    chartData.forEach(d => {
        const dimensionText = String(d[xField]);
        let currentWidth = estimateTextWidth(dimensionText, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        if (currentWidth > maxDimensionLabelWidth) {
            minDimensionLabelRatio = Math.min(minDimensionLabelRatio, maxDimensionLabelWidth / currentWidth);
        }

        const circleText = formatValue(d[y2Field]) + y2Unit;
        currentWidth = estimateTextWidth(circleText, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        if (currentWidth > maxCircleLabelWidth) {
            minCircleLabelRatio = Math.min(minCircleLabelRatio, maxCircleLabelWidth / currentWidth);
        }

        const barValue = d[yField];
        const barText = (barValue > 0 ? "+" : "") + formatValue(barValue) + yUnit;
        currentWidth = estimateTextWidth(barText, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight, fillStyle.typography.annotationFontFamily);
        if (currentWidth > maxBarLabelWidth) {
            minBarLabelRatio = Math.min(minBarLabelRatio, maxBarLabelWidth / currentWidth);
        }
    });

    const finalDimensionFontSizeNum = Math.max(minFontSizeNum, baseFontSizeLabelNum * minDimensionLabelRatio);
    const finalCircleFontSizeNum = Math.max(minFontSizeNum, baseFontSizeLabelNum * minCircleLabelRatio);
    const finalBarFontSizeNum = Math.max(minFontSizeNum, baseFontSizeAnnotationNum * minBarLabelRatio);

    const finalDimensionFontSize = `${finalDimensionFontSizeNum}px`;
    const finalCircleFontSize = `${finalCircleFontSizeNum}px`;
    const finalBarFontSize = `${finalBarFontSizeNum}px`;

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, 0)`);

    const legendY = chartMargins.top / 2;
    const legendSquareSize = 12;
    const legendCircleRadius = 6;
    const legendPadding = 15;
    const legendItemPadding = 5;

    const yNameForLegend = dataColumns.find(col => col.role === "y")?.title || yField;
    const y2NameForLegend = dataColumns.find(col => col.role === "y2")?.title || y2Field;
    
    const firstDimensionName = chartData.length > 0 ? chartData[0][xField] : "default";
    const legendSymbolColor = fillStyle.getCategoricalColor(firstDimensionName, 0);

    const legendFontSizeNum = parseFloat(fillStyle.typography.annotationFontSize);
    
    const yNameWidth = estimateTextWidth(yNameForLegend, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight, fillStyle.typography.annotationFontFamily);
    const y2NameWidth = estimateTextWidth(y2NameForLegend, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight, fillStyle.typography.annotationFontFamily);

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
        .attr("class", "legend-symbol mark")
        .attr("x", currentXLegend)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", legendSymbolColor);
    currentXLegend += legendSquareSize + legendItemPadding;

    legendGroup.append("text")
        .attr("class", "legend-label label")
        .attr("x", currentXLegend)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(yNameForLegend);
    currentXLegend += yNameWidth + legendPadding;

    legendGroup.append("circle")
        .attr("class", "legend-symbol mark")
        .attr("cx", currentXLegend + legendCircleRadius)
        .attr("cy", 0)
        .attr("r", legendCircleRadius)
        .attr("fill", legendSymbolColor);
    currentXLegend += (legendCircleRadius * 2) + legendItemPadding;

    legendGroup.append("text")
        .attr("class", "legend-label label")
        .attr("x", currentXLegend)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(y2NameForLegend);

    // Block 8: Main Data Visualization Rendering
    chartData.forEach((d, i) => {
        const xPos = xScale(d[xField]);
        const barWidth = xScale.bandwidth();
        const centerX = xPos + barWidth / 2;
        const itemColor = fillStyle.getCategoricalColor(d[xField], i);

        // Bars
        const yValue = d[yField];
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
                .attr("fill", itemColor)
                .attr("rx", 5)
                .attr("ry", 5);

            // Bar value labels
            const barLabelText = (yValue > 0 ? "+" : "") + formatValue(yValue) + yUnit;
            const barLabelY = (yValue >= 0) ? barY - 5 : barY + barHeight + (finalBarFontSizeNum * 0.8);
            
            mainChartGroup.append("text")
                .attr("class", "label value-label bar-value-label")
                .attr("x", centerX)
                .attr("y", barLabelY)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", finalBarFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(barLabelText);

            // Icons for bars
            const iconUrl = fillStyle.getImageUrl(d[xField]);
            if (iconUrl) {
                const iconTargetY = barLabelY - (finalBarFontSizeNum * (yValue >= 0 ? 0.7 : 0.1)); // Adjust based on label position
                const iconActualY = iconTargetY - iconMargin - iconSize;
                 mainChartGroup.append("image")
                    .attr("class", "icon data-icon bar-icon")
                    .attr("x", centerX - iconSize / 2)
                    .attr("y", iconActualY)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("xlink:href", iconUrl)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        }

        // Circles
        const circleRadiusValue = radiusScale(d[y2Field]);
        mainChartGroup.append("circle")
            .attr("class", "mark circle")
            .attr("cx", centerX)
            .attr("cy", circleY)
            .attr("r", circleRadiusValue)
            .attr("fill", itemColor);
            // .attr("opacity", 0.8); // Removed per V.2

        // Circle value labels
        const circleLabelText = formatValue(d[y2Field]) + y2Unit;
        const circleTextWidth = estimateTextWidth(circleLabelText, finalCircleFontSize, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        
        const isCircleBigEnoughForInternalLabel = circleTextWidth < (circleRadiusValue * 1.6); // Heuristic
        let circleLabelColor, circleLabelActualY, circleLabelDy;

        if (isCircleBigEnoughForInternalLabel && circleRadiusValue > finalCircleFontSizeNum / 2) {
            circleLabelColor = "#ffffff"; // White text for inside dark circle
            circleLabelActualY = circleY;
            circleLabelDy = "0.35em"; // Vertically center
        } else {
            circleLabelColor = fillStyle.textColor;
            circleLabelActualY = circleY + circleRadiusValue + (finalCircleFontSizeNum * 0.6) + labelMargin;
            circleLabelDy = "0em";
        }
        
        mainChartGroup.append("text")
            .attr("class", "label value-label circle-value-label")
            .attr("x", centerX)
            .attr("y", circleLabelActualY)
            .attr("dy", circleLabelDy)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", finalCircleFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", circleLabelColor)
            .text(circleLabelText);

        // Dimension labels (x-axis category labels)
        mainChartGroup.append("text")
            .attr("class", "label dimension-label x-axis-label")
            .attr("x", centerX)
            .attr("y", dimensionLabelY)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", finalDimensionFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .call(wrapText, String(d[xField]), maxDimensionLabelWidth, centerX, dimensionLabelY, finalDimensionFontSize, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this chart beyond main rendering.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}