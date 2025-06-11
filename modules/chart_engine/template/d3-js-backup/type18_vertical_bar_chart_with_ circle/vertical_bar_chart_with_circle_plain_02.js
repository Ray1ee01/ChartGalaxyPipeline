/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart With Circle",
  "chart_name": "vertical_bar_chart_with_circle_plain_02",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["x"],
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
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is external to the function)

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || {};
    const inputImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const valueField2Config = dataColumns.find(col => col.role === "y2");

    const dimensionFieldName = dimensionFieldConfig?.name;
    const valueFieldName = valueFieldConfig?.name;
    const valueField2Name = valueField2Config?.name;

    if (!dimensionFieldName || !valueFieldName || !valueField2Name) {
        const missingFields = [];
        if (!dimensionFieldName) missingFields.push("x role (dimension)");
        if (!valueFieldName) missingFields.push("y role (primary value)");
        if (!valueField2Name) missingFields.push("y2 role (secondary value)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    const valueUnit = valueFieldConfig?.unit === "none" ? "" : (valueFieldConfig?.unit || "");
    const valueUnit2 = valueField2Config?.unit === "none" ? "" : (valueField2Config?.unit || "");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: inputTypography.title?.font_family || "Arial, sans-serif",
            titleFontSize: inputTypography.title?.font_size || "28px",
            titleFontWeight: inputTypography.title?.font_weight || "700",
            labelFontFamily: inputTypography.label?.font_family || "Arial, sans-serif",
            labelFontSize: inputTypography.label?.font_size || "16px",
            labelFontWeight: inputTypography.label?.font_weight || "500",
            annotationFontFamily: inputTypography.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: inputTypography.annotation?.font_size || "12px",
            annotationFontWeight: inputTypography.annotation?.font_weight || "400",
        },
        textColor: inputColors.text_color || "#000000",
        barPositiveColor: inputColors.other?.primary || "#008080",
        barNegativeColor: inputColors.other?.secondary || "#FF0000",
        circleColor: inputColors.available_colors && inputColors.available_colors.length > 0 ? inputColors.available_colors[0] : "#FFBF00",
        legendTextColor: inputColors.text_color || "#000000",
        chartBackground: inputColors.background_color || "transparent", // Though background="no"
    };

    const estimateTextWidth = (text, fontSize, fontWeight, fontFamily) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox if not already in DOM.
        // However, for simple estimation without complex styles, direct getBBox might work.
        // For robustness, a hidden live SVG element is better, but prompt specifies in-memory.
        // Let's assume this simplified in-memory approach is sufficient for the context.
        // If not, one would append tempSvg to document.body, measure, then remove.
        // For this exercise, we'll try without appending to body.
        try {
            return tempText.getBBox().width;
        } catch (e) { // Fallback if getBBox fails on non-rendered element
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
            return context.measureText(text).width;
        }
    };
    
    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (Math.abs(value) >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (Math.abs(value) >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    function wrapText(textElement, text, maxWidth, x, y, fontSize, fontWeight, fontFamily, verticalAlignment = 'middle') {
        textElement.each(function() {
            const element = d3.select(this);
            const words = String(text).split(/\s+/).reverse();
            const lineHeight = 1.3; // ems
            
            element.text(null); // Clear previous content
            let tspans = [];
            let currentLineWords = [];
            let word;

            if (words.length > 1 || text.includes(' ')) {
                while (word = words.pop()) {
                    currentLineWords.push(word);
                    if (estimateTextWidth(currentLineWords.join(" "), `${fontSize}px`, fontWeight, fontFamily) > maxWidth && currentLineWords.length > 1) {
                        currentLineWords.pop(); // remove last word
                        tspans.push(currentLineWords.join(" "));
                        currentLineWords = [word]; // new line starts with this word
                    }
                }
                if (currentLineWords.length > 0) {
                    tspans.push(currentLineWords.join(" "));
                }
            } else { // Single word or no spaces, try character wrapping
                let currentSegment = '';
                for (let char of text.split('')) {
                    const nextSegment = currentSegment + char;
                    if (estimateTextWidth(nextSegment, `${fontSize}px`, fontWeight, fontFamily) > maxWidth && currentSegment.length > 0) {
                        tspans.push(currentSegment);
                        currentSegment = char;
                    } else {
                        currentSegment = nextSegment;
                    }
                }
                if (currentSegment.length > 0) {
                    tspans.push(currentSegment);
                }
            }
            
            if (tspans.length === 0 && text.length > 0) { // If text was too short to wrap but still exists
                tspans.push(text);
            }

            const numLines = tspans.length;
            let startDy;
            if (verticalAlignment === 'middle') {
                startDy = -((numLines - 1) * lineHeight / 2);
            } else if (verticalAlignment === 'bottom') {
                startDy = -(numLines * lineHeight - lineHeight);
            } else { // top alignment
                startDy = 0; 
            }

            tspans.forEach((lineText, i) => {
                element.append("tspan")
                    .attr("x", x)
                    .attr("dy", (i === 0 ? startDy : lineHeight) + "em")
                    .text(lineText);
            });
            element.attr("data-lines", numLines);
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
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 50, bottom: 60, left: 50 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const centralBandHeight = innerHeight * 0.20;
    const barAreaHeight = innerHeight - centralBandHeight;

    const chartData = rawChartData.map(d => ({
        ...d,
        [valueFieldName]: +d[valueFieldName],
        [valueField2Name]: +d[valueField2Name]
    }));
    
    const maxPositiveY = d3.max(chartData, d => Math.max(0, d[valueFieldName])) || 0;
    const maxNegativeY = Math.abs(d3.min(chartData, d => Math.min(0, d[valueFieldName])) || 0);
    const totalMagnitudeRange = maxPositiveY + maxNegativeY;

    const topBarAreaHeight = totalMagnitudeRange > 0 ? barAreaHeight * (maxPositiveY / totalMagnitudeRange) : barAreaHeight / 2;
    const bottomBarAreaHeight = barAreaHeight - topBarAreaHeight;

    const centralBandTopY = chartMargins.top + topBarAreaHeight;
    const centralBandBottomY = centralBandTopY + centralBandHeight;

    const iconSize = 20;
    const baseFontSizeDimLabel = parseFloat(fillStyle.typography.labelFontSize);
    const baseFontSizeAnnotation = parseFloat(fillStyle.typography.annotationFontSize);
    const minDynamicFontSize = 8;

    const iconY = centralBandTopY + 5 + iconSize / 2;
    const dimensionLabelYInitial = iconY + iconSize / 2 + 3 + baseFontSizeDimLabel / 2; // Initial Y for dimension label before height adjustment

    // Block 5: Data Preprocessing & Transformation
    chartData.sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const dimensionValues = chartData.map(d => d[dimensionFieldName]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(dimensionValues)
        .range([0, innerWidth])
        .padding(0.2);

    const yScalePositive = d3.scaleLinear()
        .domain([0, maxPositiveY > 0 ? maxPositiveY : 1]) // Avoid domain [0,0]
        .range([centralBandTopY, centralBandTopY - topBarAreaHeight]);

    const yScaleNegative = d3.scaleLinear()
        .domain([0, maxNegativeY > 0 ? maxNegativeY : 1]) // Avoid domain [0,0]
        .range([centralBandBottomY, centralBandBottomY + bottomBarAreaHeight]);

    const maxRadiusValue = d3.max(chartData, d => d[valueField2Name]) || 0;
    
    // Calculate maxCircleRadiusAvailable after xScale is defined
    const circleAreaHeightProvisional = centralBandBottomY - (dimensionLabelYInitial + baseFontSizeDimLabel / 2 + 3) - 5; // Provisional
    const maxCircleRadiusAvailable = Math.min(
        (circleAreaHeightProvisional * 0.9) / 2, 
        (xScale.bandwidth() * 0.8) / 2, // Circle should not exceed bar width significantly
        innerWidth / (2 * chartData.length) // Ensure circles don't overlap too much if many
    );

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxRadiusValue > 0 ? maxRadiusValue : 1]) // Avoid domain [0,0]
        .range([Math.min(2, maxCircleRadiusAvailable), Math.max(2, maxCircleRadiusAvailable)]);


    // Dynamic font size calculation (needs to be after scales for bandwidth)
    let minDimensionLabelRatio = 1.0, minCircleLabelRatio = 1.0, minBarLabelRatio = 1.0;
    const maxDimensionLabelWidth = xScale.bandwidth() * 0.95;
    const maxCircleLabelWidth = xScale.bandwidth() * 1.03; // Can be slightly wider for circle labels
    const maxBarLabelWidth = xScale.bandwidth();

    chartData.forEach(d => {
        let currentWidth = estimateTextWidth(String(d[dimensionFieldName]), `${baseFontSizeDimLabel}px`, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        if (currentWidth > maxDimensionLabelWidth) minDimensionLabelRatio = Math.min(minDimensionLabelRatio, maxDimensionLabelWidth / currentWidth);

        currentWidth = estimateTextWidth(formatValue(d[valueField2Name]) + (valueUnit2 ? ` ${valueUnit2}` : ''), `${baseFontSizeDimLabel}px`, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        if (currentWidth > maxCircleLabelWidth) minCircleLabelRatio = Math.min(minCircleLabelRatio, maxCircleLabelWidth / currentWidth);

        currentWidth = estimateTextWidth((d[valueFieldName] >= 0 ? "+" : "") + formatValue(d[valueFieldName]) + (valueUnit ? ` ${valueUnit}` : ''), `${baseFontSizeAnnotation}px`, fillStyle.typography.annotationFontWeight, fillStyle.typography.annotationFontFamily);
        if (currentWidth > maxBarLabelWidth) minBarLabelRatio = Math.min(minBarLabelRatio, maxBarLabelWidth / currentWidth);
    });

    const finalDimensionFontSize = Math.max(minDynamicFontSize, baseFontSizeDimLabel * minDimensionLabelRatio);
    const finalCircleFontSize = Math.max(minDynamicFontSize, baseFontSizeDimLabel * minCircleLabelRatio);
    const finalBarFontSize = Math.max(minDynamicFontSize, baseFontSizeAnnotation * minBarLabelRatio);
    
    // Recalculate dimension label Y and circle Y based on actual wrapped label height
    let maxDimLabelRenderedHeight = 0;
    const tempG = svgRoot.append("g").style("visibility", "hidden"); // For measurement
    chartData.forEach(d => {
        const tempText = tempG.append("text")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${finalDimensionFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight);
        
        wrapText(tempText, d[dimensionFieldName], maxDimensionLabelWidth, 0, 0, finalDimensionFontSize, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily, 'top');
        const bbox = tempText.node().getBBox();
        maxDimLabelRenderedHeight = Math.max(maxDimLabelRenderedHeight, bbox.height);
    });
    tempG.remove();

    const dimensionLabelActualY = iconY + iconSize / 2 + 3 + (maxDimLabelRenderedHeight > 0 ? 0 : finalDimensionFontSize / 2) ; // If no height, use font size
    const circleCenterY = dimensionLabelActualY + maxDimLabelRenderedHeight + 5 + radiusScale(maxRadiusValue); // Center of circle area
    
    // Main chart group for margins
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, 0)`)
        .attr("class", "main-chart-group");

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendY = chartMargins.top / 2; // Position legend in top margin
    const legendData = [
        { type: 'rect', color: fillStyle.barPositiveColor, label: `${valueFieldName} (Positive)` },
        { type: 'rect', color: fillStyle.barNegativeColor, label: `${valueFieldName} (Negative)` },
        { type: 'circle', color: fillStyle.circleColor, label: valueField2Name }
    ];

    const legendItemGroup = mainChartGroup.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(0, ${legendY - 20})`); // Adjusted Y

    let legendCurrentX = 0;
    const legendPadding = 15;
    const legendItemHeight = 12;

    legendData.forEach((item, i) => {
        const group = legendItemGroup.append("g").attr("transform", `translate(${legendCurrentX}, 0)`);
        
        if (item.type === 'rect') {
            group.append("rect")
                .attr("class", "mark legend-mark")
                .attr("x", 0)
                .attr("y", -legendItemHeight / 2)
                .attr("width", legendItemHeight)
                .attr("height", legendItemHeight)
                .style("fill", item.color);
        } else if (item.type === 'circle') {
            group.append("circle")
                .attr("class", "mark legend-mark")
                .attr("cx", legendItemHeight / 2)
                .attr("cy", 0)
                .attr("r", legendItemHeight / 2)
                .style("fill", item.color);
        }

        const legendText = group.append("text")
            .attr("class", "text legend-text")
            .attr("x", legendItemHeight + 5)
            .attr("y", 0)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.legendTextColor)
            .text(item.label);
        
        const itemWidth = legendItemHeight + 5 + legendText.node().getBBox().width;
        legendCurrentX += itemWidth + legendPadding;
    });
    // Center legend
    legendItemGroup.attr("transform", `translate(${(innerWidth - legendCurrentX + legendPadding) / 2}, ${legendY -10})`);


    // Block 8: Main Data Visualization Rendering
    const bandWidth = xScale.bandwidth();

    chartData.forEach((d, i) => {
        const xPos = xScale(d[dimensionFieldName]);
        const centerX = xPos + bandWidth / 2;
        const yVal = d[valueFieldName];

        // Bars
        if (yVal !== 0) {
            let barY, barHeight, barColor;
            if (yVal > 0) {
                barY = yScalePositive(yVal);
                barHeight = centralBandTopY - barY;
                barColor = fillStyle.barPositiveColor;
            } else {
                barY = centralBandBottomY;
                barHeight = yScaleNegative(Math.abs(yVal)) - barY;
                barColor = fillStyle.barNegativeColor;
            }

            if (barHeight > 0.1) { // Only draw if height is somewhat visible
                mainChartGroup.append("rect")
                    .attr("class", "mark bar-mark")
                    .attr("x", xPos)
                    .attr("y", barY)
                    .attr("width", bandWidth)
                    .attr("height", barHeight)
                    .attr("rx", bandWidth / 3) // Rounded ends
                    .attr("ry", bandWidth / 3) // Rounded ends
                    .style("fill", barColor);

                // Bar Value Labels
                const barLabelText = (yVal > 0 ? "+" : "") + formatValue(yVal) + (valueUnit ? ` ${valueUnit}` : '');
                const barLabelY = yVal > 0 ? barY - 5 : barY + barHeight + finalBarFontSize + 2;
                mainChartGroup.append("text")
                    .attr("class", "value bar-value-label")
                    .attr("x", centerX)
                    .attr("y", barLabelY)
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${finalBarFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(barLabelText);
            }
        }

        // Dimension Labels (in central band)
        const dimLabelElement = mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", centerX)
            .attr("y", dimensionLabelActualY) // Use calculated Y
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${finalDimensionFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor);
        wrapText(dimLabelElement, d[dimensionFieldName], maxDimensionLabelWidth, centerX, dimensionLabelActualY, finalDimensionFontSize, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily, 'top');

        // Circles (below dimension labels)
        const circleRadius = radiusScale(d[valueField2Name]);
        mainChartGroup.append("circle")
            .attr("class", "mark circle-mark")
            .attr("cx", centerX)
            .attr("cy", circleCenterY)
            .attr("r", Math.max(0, circleRadius)) // Ensure radius is not negative
            .style("fill", fillStyle.circleColor)
            .style("opacity", 0.8);

        // Circle Value Labels
        const circleLabelText = formatValue(d[valueField2Name]) + (valueUnit2 ? ` ${valueUnit2}` : '');
        mainChartGroup.append("text")
            .attr("class", "value circle-value-label")
            .attr("x", centerX)
            .attr("y", circleCenterY)
            .attr("dy", "0.35em") // Vertically center
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily) // Using label font for circle as per original logic
            .style("font-size", `${finalCircleFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(circleLabelText);

        // Icons (above dimension labels)
        const iconUrl = inputImages.field && inputImages.field[d[dimensionFieldName]] 
                        ? inputImages.field[d[dimensionFieldName]] 
                        : (inputImages.other?.primary || null);
        if (iconUrl) {
            mainChartGroup.append("image")
                .attr("class", "image icon-image")
                .attr("x", centerX - iconSize / 2)
                .attr("y", iconY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", iconUrl)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (Not much in this chart beyond main rendering)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}