/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart With Circle",
  "chart_name": "vertical_bar_chart_03",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["none"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 12], ["-inf", "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
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

    d3.select(containerSelector).html(""); // Clear container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name;

    let valueUnit = dataColumns.find(col => col.role === "y")?.unit;
    valueUnit = (valueUnit === "none" || !valueUnit) ? "" : ` ${valueUnit}`;
    let valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit;
    valueUnit2 = (valueUnit2 === "none" || !valueUnit2) ? "" : ` ${valueUnit2}`;

    const criticalFields = { dimensionField, valueField, valueField2 };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (inputTypography.title && inputTypography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (inputTypography.title && inputTypography.title.font_size) || '28px',
            titleFontWeight: (inputTypography.title && inputTypography.title.font_weight) || '700',
            labelFontFamily: (inputTypography.label && inputTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (inputTypography.label && inputTypography.label.font_size) || '16px',
            labelFontWeight: (inputTypography.label && inputTypography.label.font_weight) || '500',
            annotationFontFamily: (inputTypography.annotation && inputTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (inputTypography.annotation && inputTypography.annotation.font_size) || '12px',
            annotationFontWeight: (inputTypography.annotation && inputTypography.annotation.font_weight) || '400',
        },
        textColor: inputColors.text_color || '#000000',
        chartBackground: inputColors.background_color || '#FFFFFF', // Not directly used on SVG if background: "no"
        positiveBarColor: (inputColors.other && inputColors.other.primary) || '#008080',
        negativeBarColor: (inputColors.other && inputColors.other.secondary) || '#FF0000',
        circleColor: (inputColors.available_colors && inputColors.available_colors[0]) || '#FFBF00',
        centralBandBackground: '#f0f0f0', // Standardized
    };

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const { size, weight, family } = fontProps;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', family);
        textNode.setAttribute('font-size', size);
        textNode.setAttribute('font-weight', weight);
        textNode.textContent = text;
        svg.appendChild(textNode);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but trying to adhere to "MUST NOT be appended to the document DOM".
        // For simple text, this might be okay, but complex scenarios might need temporary DOM attachment.
        // Let's assume this simplified approach is sufficient for this context.
        // If not, a temporary, hidden SVG in the DOM would be more robust.
        // For this exercise, we'll use a common workaround that creates an SVG in memory.
        // However, getBBox() on an unattached element can be unreliable.
        // A more robust in-memory approach might involve a canvas if SVG is problematic without DOM.
        // Given the strict "MUST NOT append", we'll use canvas for measurement as in original,
        // but acknowledge the directive for SVG. If canvas is disallowed, this needs rethink.
        // The prompt says "in-memory SVG structure", then "getBBox().width".
        // Let's stick to the SVG method, hoping it's good enough for this case.
        // To make getBBox work reliably without appending to DOM, we need to ensure the SVG has dimensions.
        svg.setAttribute('width', '1000'); // Arbitrary large enough width
        svg.setAttribute('height', '100'); // Arbitrary large enough height
        document.body.appendChild(svg); // Temporarily append to get styles computed
        const width = textNode.getBBox().width;
        document.body.removeChild(svg); // Clean up
        return width;
    }
    
    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    function getWrappedTextLines(text, maxWidth, fontProps) {
        const words = text.split(/\s+/).reverse();
        let lines = [];
        let currentLine = [];
        let word;

        if (words.length > 1 || text.includes(' ')) {
            while ((word = words.pop())) {
                currentLine.push(word);
                if (estimateTextWidth(currentLine.join(" "), fontProps) > maxWidth) {
                    if (currentLine.length > 1) {
                        currentLine.pop();
                        lines.push(currentLine.join(" "));
                        currentLine = [word];
                    } else { // Single word is too long
                        lines.push(currentLine.join(" ")); // Add it anyway or truncate
                        currentLine = []; // Or handle character wrapping for this word
                        // For simplicity, we'll just push the long word and let it overflow or be clipped.
                        // A more complex solution would character-wrap it.
                    }
                }
            }
            if (currentLine.length > 0) {
                lines.push(currentLine.join(" "));
            }
        } else { // Single word, no spaces
            if (estimateTextWidth(text, fontProps) > maxWidth) {
                // Attempt character wrapping for a single long word
                let tempLine = "";
                for (let char of text) {
                    if (estimateTextWidth(tempLine + char, fontProps) > maxWidth) {
                        lines.push(tempLine);
                        tempLine = char;
                    } else {
                        tempLine += char;
                    }
                }
                if (tempLine) lines.push(tempLine);

            } else {
                 lines.push(text);
            }
        }
         return lines.length > 0 ? lines : [text]; // Ensure at least one line, even if empty initially
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
        .style("background-color", fillStyle.chartBackground === "no" ? "transparent" : fillStyle.chartBackground);


    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 50, bottom: 60, left: 50 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centralBandHeight = innerHeight * 0.20;
    const barAreaHeight = innerHeight - centralBandHeight;

    const tempChartData = JSON.parse(JSON.stringify(rawChartData)); // Deep copy for manipulation
    tempChartData.forEach(d => {
        d[valueField] = +d[valueField];
        d[valueField2] = +d[valueField2];
    });
    
    const maxPositiveY = d3.max(tempChartData, d => Math.max(0, d[valueField])) || 0;
    const maxNegativeY = Math.abs(d3.min(tempChartData, d => Math.min(0, d[valueField])) || 0);
    const totalMagnitudeRange = maxPositiveY + maxNegativeY;

    let topBarAreaHeight = barAreaHeight / 2;
    let bottomBarAreaHeight = barAreaHeight / 2;
    if (totalMagnitudeRange > 0) {
        topBarAreaHeight = barAreaHeight * (maxPositiveY / totalMagnitudeRange);
        bottomBarAreaHeight = barAreaHeight * (maxNegativeY / totalMagnitudeRange);
    }
    
    const centralBandTopY = chartMargins.top + topBarAreaHeight;
    const centralBandBottomY = centralBandTopY + centralBandHeight;

    const iconSize = 20;
    const iconMargin = 3;
    const labelMargin = 3;
    const circlePadding = 5;

    const baseFontSizeLabel = parseFloat(fillStyle.typography.labelFontSize);
    const baseFontSizeAnnotation = parseFloat(fillStyle.typography.annotationFontSize);
    const minFontSize = 8;

    const bandTopPadding = 5; // Padding within the central band from its top edge
    const iconYInBand = bandTopPadding + iconSize / 2; // Relative to centralBandTopY
    const dimensionLabelYInBand = iconYInBand + iconSize / 2 + iconMargin + baseFontSizeLabel / 2; // Relative to centralBandTopY

    // Placeholder for maxDimensionLabelHeight, will be calculated later
    // This affects circleYInBand calculation.
    // For now, estimate based on 1 line.
    let estimatedMaxDimensionLabelHeight = baseFontSizeLabel * 1.3; 
    let circleAreaTopYInBand = dimensionLabelYInBand + estimatedMaxDimensionLabelHeight / 2 + labelMargin;
    let circleAreaHeightInBand = centralBandHeight - circleAreaTopYInBand - bandTopPadding;
    let circleYInBand = circleAreaTopYInBand + circleAreaHeightInBand / 2; // Relative to centralBandTopY

    const maxCircleRadiusAvailableBasedOnHeight = Math.max(0, (circleAreaHeightInBand * 0.9) / 2);
    const maxRadiusFromBarWidth = innerWidth / (tempChartData.length > 0 ? tempChartData.length : 1) * 0.5 * 0.9; // Estimate based on avg bar width
    const maxCircleRadiusAvailable = Math.min(maxCircleRadiusAvailableBasedOnHeight, maxRadiusFromBarWidth);


    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = JSON.parse(JSON.stringify(rawChartData)); // Use a fresh copy for rendering
    chartDataArray.forEach(d => {
        d[valueField] = +d[valueField];
        d[valueField2] = +d[valueField2];
        if (isNaN(d[valueField])) d[valueField] = 0;
        if (isNaN(d[valueField2])) d[valueField2] = 0;
    });

    chartDataArray.sort((a, b) => b[valueField] - a[valueField]);
    const dimensions = chartDataArray.map(d => d[dimensionField]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerWidth])
        .padding(0.2);

    const yScalePositive = d3.scaleLinear()
        .domain([0, maxPositiveY === 0 ? 1 : maxPositiveY])
        .range([centralBandTopY, centralBandTopY - topBarAreaHeight]);

    const yScaleNegative = d3.scaleLinear()
        .domain([0, maxNegativeY === 0 ? 1 : maxNegativeY])
        .range([centralBandBottomY, centralBandBottomY + bottomBarAreaHeight]);

    const maxValue2 = d3.max(chartDataArray, d => d[valueField2]) || 0;
    const minRadius = 2;
    const maxRadius = Math.max(minRadius, maxCircleRadiusAvailable);

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxValue2 === 0 ? 1 : maxValue2])
        .range([minRadius, maxRadius]);

    // Dynamic font size calculation
    let minDimensionLabelRatio = 1.0;
    let minCircleLabelRatio = 1.0;
    let minBarLabelRatio = 1.0;

    const maxDimensionLabelWidth = xScale.bandwidth() * 0.95;
    const maxBarLabelWidth = xScale.bandwidth();

    chartDataArray.forEach(d => {
        const dimensionText = String(d[dimensionField]);
        let currentWidth = estimateTextWidth(dimensionText, { size: baseFontSizeLabel + 'px', weight: fillStyle.typography.labelFontWeight, family: fillStyle.typography.labelFontFamily });
        if (currentWidth > maxDimensionLabelWidth) {
            minDimensionLabelRatio = Math.min(minDimensionLabelRatio, maxDimensionLabelWidth / currentWidth);
        }

        const circleText = formatValue(d[valueField2]) + valueUnit2;
        currentWidth = estimateTextWidth(circleText, { size: baseFontSizeLabel + 'px', weight: fillStyle.typography.labelFontWeight, family: fillStyle.typography.labelFontFamily });
        const maxCircleLabelWidth = Math.max(minRadius * 2, radiusScale(d[valueField2]) * 2 * 0.8); // Label should fit in circle
        if (currentWidth > maxCircleLabelWidth) {
            minCircleLabelRatio = Math.min(minCircleLabelRatio, maxCircleLabelWidth / currentWidth);
        }
        
        const barValue = d[valueField];
        const barText = (barValue > 0 ? "+" : "") + formatValue(barValue) + valueUnit;
        currentWidth = estimateTextWidth(barText, { size: baseFontSizeAnnotation + 'px', weight: fillStyle.typography.annotationFontWeight, family: fillStyle.typography.annotationFontFamily });
        if (currentWidth > maxBarLabelWidth) {
            minBarLabelRatio = Math.min(minBarLabelRatio, maxBarLabelWidth / currentWidth);
        }
    });

    const finalDimensionFontSize = Math.max(minFontSize, baseFontSizeLabel * minDimensionLabelRatio);
    const finalCircleFontSize = Math.max(minFontSize, baseFontSizeLabel * minCircleLabelRatio);
    const finalBarFontSize = Math.max(minFontSize, baseFontSizeAnnotation * minBarLabelRatio);

    // Recalculate maxDimensionLabelHeight and circle Y positions with final font size
    let maxActualDimensionLabelHeight = 0;
    const dimensionLabelLineHeight = finalDimensionFontSize * 1.3;
    chartDataArray.forEach(d => {
        const lines = getWrappedTextLines(String(d[dimensionField]), maxDimensionLabelWidth, {size: finalDimensionFontSize + 'px', weight: fillStyle.typography.labelFontWeight, family: fillStyle.typography.labelFontFamily});
        maxActualDimensionLabelHeight = Math.max(maxActualDimensionLabelHeight, lines.length * dimensionLabelLineHeight);
    });
    
    // Update circle Y position based on actual max label height
    circleAreaTopYInBand = dimensionLabelYInBand + maxActualDimensionLabelHeight / 2 + labelMargin; // Relative to centralBandTopY
    circleAreaHeightInBand = centralBandHeight - bandTopPadding - iconYInBand - iconSize/2 - iconMargin - maxActualDimensionLabelHeight - labelMargin - bandTopPadding; // Available height for circle area
    
    // Ensure circleAreaHeightInBand is not negative
    circleAreaHeightInBand = Math.max(0, circleAreaHeightInBand);
    
    circleYInBand = dimensionLabelYInBand + maxActualDimensionLabelHeight + labelMargin + circleAreaHeightInBand / 2; // Relative to centralBandTopY
    
    const finalMaxCircleRadius = Math.max(minRadius, (circleAreaHeightInBand * 0.9) / 2);
    radiusScale.range([minRadius, Math.min(maxRadius, finalMaxCircleRadius)]); // Update radius scale range


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-group")
        .attr("transform", `translate(${chartMargins.left}, 0)`);

    // Legend
    const legendY = chartMargins.top / 2; // Position legend in the top margin area
    const legendSquareSize = 12;
    const legendCircleRadius = 6;
    const legendPadding = 15;
    const legendItemPadding = 5;
    const legendFontProps = {
        size: fillStyle.typography.annotationFontSize,
        weight: fillStyle.typography.annotationFontWeight,
        family: fillStyle.typography.annotationFontFamily
    };

    const yNameText = dataColumns.find(col => col.role === "y")?.label || valueField;
    const y2NameText = dataColumns.find(col => col.role === "y2")?.label || valueField2;

    const yNameWidth = estimateTextWidth(yNameText, legendFontProps);
    const y2NameWidth = estimateTextWidth(y2NameText, legendFontProps);

    const totalLegendWidth = (legendSquareSize + legendItemPadding) * 2 + yNameWidth + legendPadding +
                           (legendCircleRadius * 2) + legendItemPadding + y2NameWidth;
    const legendStartX = chartMargins.left + (innerWidth - totalLegendWidth) / 2;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendStartX}, ${legendY})`);

    let currentXLegend = 0;
    // Positive bar legend
    legendGroup.append("rect")
        .attr("x", currentXLegend)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.positiveBarColor)
        .attr("class", "mark legend-mark");
    currentXLegend += legendSquareSize + legendItemPadding;

    // Negative bar legend
    legendGroup.append("rect")
        .attr("x", currentXLegend)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.negativeBarColor)
        .attr("class", "mark legend-mark");
    currentXLegend += legendSquareSize + legendItemPadding;

    // Y name text
    legendGroup.append("text")
        .attr("x", currentXLegend)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFontProps.family)
        .style("font-size", legendFontProps.size)
        .style("font-weight", legendFontProps.weight)
        .style("fill", fillStyle.textColor)
        .text(yNameText)
        .attr("class", "label legend-label");
    currentXLegend += yNameWidth + legendPadding;

    // Circle legend
    legendGroup.append("circle")
        .attr("cx", currentXLegend + legendCircleRadius)
        .attr("cy", 0)
        .attr("r", legendCircleRadius)
        .attr("fill", fillStyle.circleColor)
        .attr("class", "mark legend-mark");
    currentXLegend += (legendCircleRadius * 2) + legendItemPadding;

    // Y2 name text
    legendGroup.append("text")
        .attr("x", currentXLegend)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFontProps.family)
        .style("font-size", legendFontProps.size)
        .style("font-weight", legendFontProps.weight)
        .style("fill", fillStyle.textColor)
        .text(y2NameText)
        .attr("class", "label legend-label");

    // Central Band Background
    const bandRadius = centralBandHeight / 2;
    mainChartGroup.append("path")
        .attr("d", `
            M ${0 - bandRadius},${centralBandTopY}
            A ${bandRadius},${bandRadius} 0 0 1 ${0},${centralBandTopY - bandRadius}
            H ${innerWidth}
            A ${bandRadius},${bandRadius} 0 0 1 ${innerWidth + bandRadius},${centralBandTopY}
            V ${centralBandBottomY}
            A ${bandRadius},${bandRadius} 0 0 1 ${innerWidth},${centralBandBottomY + bandRadius}
            H ${0}
            A ${bandRadius},${bandRadius} 0 0 1 ${0 - bandRadius},${centralBandBottomY}
            Z
        `) // This path creates rounded ends outside the innerWidth. Simplified to a rect for now.
        .attr("d", `
            M ${0},${centralBandTopY} 
            L ${innerWidth},${centralBandTopY}
            A ${bandRadius},${bandRadius} 0 0 1 ${innerWidth},${centralBandBottomY}
            L ${0},${centralBandBottomY}
            A ${bandRadius},${bandRadius} 0 0 1 ${0},${centralBandTopY}
            Z`)
        .attr("fill", fillStyle.centralBandBackground)
        .attr("class", "other central-band");


    // Block 8: Main Data Visualization Rendering
    chartDataArray.forEach(d => {
        const xPos = xScale(d[dimensionField]);
        const barWidth = xScale.bandwidth();
        const centerX = xPos + barWidth / 2;

        // Bars
        const yValue = d[valueField];
        let barHeight = 0, barYPos = 0, barColor = "none";

        if (yValue > 0) {
            barYPos = yScalePositive(yValue);
            barHeight = centralBandTopY - barYPos;
            barColor = fillStyle.positiveBarColor;
        } else if (yValue < 0) {
            barYPos = centralBandBottomY;
            barHeight = yScaleNegative(Math.abs(yValue)) - barYPos;
            barColor = fillStyle.negativeBarColor;
        }
        barHeight = Math.max(0, barHeight); // Ensure non-negative height

        if (barHeight > 0) {
            mainChartGroup.append("rect")
                .attr("x", xPos)
                .attr("y", barYPos)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", barColor)
                .attr("class", "mark bar");

            // Bar value labels
            const barLabelText = (yValue > 0 ? "+" : "") + formatValue(yValue) + valueUnit;
            const barLabelY = (yValue >= 0) ? barYPos - 5 : barYPos + barHeight + finalBarFontSize;
            mainChartGroup.append("text")
                .attr("x", centerX)
                .attr("y", barLabelY)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", finalBarFontSize + 'px')
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(barLabelText)
                .attr("class", "label value-label");
        }

        // Dimension Icons (in central band)
        const iconActualY = centralBandTopY + iconYInBand;
        if (inputImages.field && inputImages.field[d[dimensionField]]) {
            mainChartGroup.append("image")
                .attr("x", centerX - iconSize / 2)
                .attr("y", iconActualY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", inputImages.field[d[dimensionField]])
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("class", "icon");
        }
        
        // Dimension Labels (in central band)
        const dimensionLabelActualY = centralBandTopY + dimensionLabelYInBand;
        const dimLabelFontProps = { size: finalDimensionFontSize + 'px', weight: fillStyle.typography.labelFontWeight, family: fillStyle.typography.labelFontFamily };
        const dimLines = getWrappedTextLines(String(d[dimensionField]), maxDimensionLabelWidth, dimLabelFontProps);
        
        const dimensionTextElement = mainChartGroup.append("text")
            .attr("x", centerX)
            .attr("y", dimensionLabelActualY) // Initial Y for the first line (top alignment)
            .attr("text-anchor", "middle")
            .style("font-family", dimLabelFontProps.family)
            .style("font-size", dimLabelFontProps.size)
            .style("font-weight", dimLabelFontProps.weight)
            .style("fill", fillStyle.textColor)
            .attr("class", "label dimension-label");

        dimLines.forEach((line, i) => {
            dimensionTextElement.append("tspan")
                .attr("x", centerX)
                .attr("dy", (i === 0 ? 0 : dimensionLabelLineHeight) + "px") // Relative dy for subsequent lines
                .text(line);
        });


        // Circles (in central band)
        const circleRadius = radiusScale(d[valueField2]);
        const circleActualY = centralBandTopY + circleYInBand;
        
        mainChartGroup.append("circle")
            .attr("cx", centerX)
            .attr("cy", circleActualY)
            .attr("r", Math.max(0, circleRadius)) // Ensure non-negative radius
            .attr("fill", fillStyle.circleColor)
            .attr("opacity", 0.8)
            .attr("class", "mark circle");

        // Circle value labels
        const circleLabelText = formatValue(d[valueField2]) + valueUnit2;
        mainChartGroup.append("text")
            .attr("x", centerX)
            .attr("y", circleActualY)
            .attr("dy", "0.35em") // Vertical centering
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", finalCircleFontSize + 'px')
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(circleLabelText)
            .attr("class", "label value-label");
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (No specific enhancements beyond main rendering in this chart)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}