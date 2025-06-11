/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart With Circle",
  "chart_name": "horizontal_bar_chart_25",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["x"],
  "required_fields_type": [
    ["categorical"],
    ["numerical"],
    ["numerical"]
  ],
  "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
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
    // This function renders a horizontal bar chart combined with proportional circles.
    // Bars represent one metric, circles represent another, both categorized by a dimension.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data;
    const chartData = chartConfig.data?.data;
    const variables = chartConfig.variables || {};
    const typography = chartConfig.typography || {};
    const colors = chartConfig.colors || {};
    const images = chartConfig.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = chartConfig.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField1 = dataColumns.find(col => col.role === "y")?.name; // For bars
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name; // For circles

    if (!dimensionField || !valueField1 || !valueField2) {
        const missingFields = [
            !dimensionField ? "dimension (role 'x')" : null,
            !valueField1 ? "value (role 'y')" : null,
            !valueField2 ? "value (role 'y2')" : null
        ].filter(Boolean).join(", ");

        console.error(`Critical chart config missing: field name(s) for ${missingFields}. Cannot render.`);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>Error: Critical chart configuration missing for field(s): ${missingFields}. Chart cannot be rendered.</div>`);
        }
        return null;
    }
    
    if (!chartData || chartData.length === 0) {
        console.error("Chart data is missing or empty. Cannot render.");
         if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Chart data is missing or empty. Chart cannot be rendered.</div>");
        }
        return null;
    }

    const unit1Definition = dataColumns.find(col => col.role === "y")?.unit;
    const valueUnit1 = (unit1Definition && unit1Definition !== "none") ? unit1Definition : "";
    const unit2Definition = dataColumns.find(col => col.role === "y2")?.unit;
    const valueUnit2 = (unit2Definition && unit2Definition !== "none") ? unit2Definition : "";

    const columnTitle1Text = dataColumns.find(col => col.role === "y")?.name;
    const columnTitle2Text = dataColumns.find(col => col.role === "y2")?.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '28px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : '700',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '16px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : '500',
            descriptionFontFamily: (typography.description && typography.description.font_family) ? typography.description.font_family : 'Arial, sans-serif',
            descriptionFontSize: (typography.description && typography.description.font_size) ? typography.description.font_size : '16px',
            descriptionFontWeight: (typography.description && typography.description.font_weight) ? typography.description.font_weight : '500',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '12px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : '400',
        },
        textColor: colors.text_color || '#FFFFFF',
        chartBackground: colors.background_color || '#0A3B39', // Not directly applied to SVG, but available
        primaryFallbackColor: (colors.other && colors.other.primary) ? colors.other.primary : '#83C341',
        secondaryFallbackColor: (colors.other && colors.other.secondary) ? colors.other.secondary : '#FFA500',
        barStrokeColor: '#FFFFFF', // Assuming dark theme from original defaults
        circleStrokeColor: '#FFFFFF', // Assuming dark theme
    };
    
    function getCategorySpecificColor(categoryName, fallbackColor) {
        if (colors.field && colors.field[categoryName]) {
            return colors.field[categoryName];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            // Simple hash function to pick a color pseudo-randomly but consistently
            let hash = 0;
            for (let i = 0; i < categoryName.length; i++) {
                hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
            }
            return colors.available_colors[Math.abs(hash) % colors.available_colors.length];
        }
        return fallbackColor;
    }


    const estimateTextWidth = (text, fontConfig) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontConfig.fontFamily);
        tempText.setAttribute('font-size', fontConfig.fontSize);
        tempText.setAttribute('font-weight', fontConfig.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: getBBox needs the SVG to be in the DOM in some browsers, or have intrinsic size.
        // For robust headless measurement, it's safer if it's briefly in DOM, or use Canvas.
        // However, per spec, "MUST NOT be appended to the document DOM".
        // This might be less accurate without DOM attachment for some complex fonts/scenarios.
        // A common workaround is to append to a hidden div, measure, then remove.
        // But strictly adhering to "MUST NOT append", we rely on direct getBBox on unattached element.
        let width = 0;
        try {
             width = tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached SVG fails.
            // This is a rough estimate.
            width = text.length * (parseFloat(fontConfig.fontSize) * 0.6);
            console.warn("BBox calculation failed for unattached SVG text, using rough estimate.", e);
        }
        return width;
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // Use .2s for significant digits
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Apply background to SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 60, // Increased for column titles
        right: 20,
        bottom: 30,
        left: 10 // Initial, will be adjusted
    };

    const dimLabelPadding = 10;
    const minFontSize = 10;
    const gapBetweenCircleAndBar = 15;

    let maxDimLabelWidth = 0;
    const tempSortedDataForLabelCalc = [...chartData].sort((a, b) => b[valueField1] - a[valueField1]);
    const tempSortedDimensionsForLabelCalc = tempSortedDataForLabelCalc.map(d => d[dimensionField]);
    
    let finalDimLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);

    tempSortedDimensionsForLabelCalc.forEach(dimension => {
        const labelText = String(dimension).toUpperCase();
        maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateTextWidth(labelText, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: `${finalDimLabelFontSize}px`,
            fontWeight: fillStyle.typography.labelFontWeight
        }));
    });
    
    const maxAllowedLabelSpace = containerWidth * 0.20;
    if (maxDimLabelWidth > maxAllowedLabelSpace) {
        const scaleFactor = maxAllowedLabelSpace / maxDimLabelWidth;
        finalDimLabelFontSize = Math.max(minFontSize, finalDimLabelFontSize * scaleFactor);
        maxDimLabelWidth = 0; // Recalculate with new font size
        tempSortedDimensionsForLabelCalc.forEach(dimension => {
            const labelText = String(dimension).toUpperCase();
            maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateTextWidth(labelText, {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: `${finalDimLabelFontSize}px`,
                fontWeight: fillStyle.typography.labelFontWeight
            }));
        });
    }
    
    chartMargins.left = maxDimLabelWidth + dimLabelPadding + 10; // Add buffer

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const circleAreaRatio = 0.25;
    const circleAreaWidth = innerWidth * circleAreaRatio;
    let barAreaWidth = innerWidth - circleAreaWidth - gapBetweenCircleAndBar;
    const minBarWidthForLayout = 10;
    if (barAreaWidth < minBarWidthForLayout) barAreaWidth = minBarWidthForLayout;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const sortedChartData = [...chartData].sort((a, b) => b[valueField1] - a[valueField1]);
    const sortedDimensions = sortedChartData.map(d => d[dimensionField]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2;
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedChartData, d => +d[valueField1]) * 1.05 || 1]) // Ensure domain is at least 1 to avoid issues with all zero data
        .range([0, barAreaWidth]);

    const maxValue2 = d3.max(sortedChartData, d => +d[valueField2]);
    const minRadius = yScale.bandwidth() * 0.3;
    const maxRadius = Math.min(yScale.bandwidth() * 0.45, circleAreaWidth / 2 - 5);
    const radiusScale = d3.scaleSqrt()
        .domain([0, maxValue2 || 1]) // Ensure domain is at least 1
        .range([Math.max(1, minRadius), Math.max(2,maxRadius)]); // Ensure radius is at least 1 or 2

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Column Titles (acting as section labels)
    if (columnTitle1Text) {
        mainChartGroup.append("text")
            .attr("class", "label column-title")
            .attr("x", circleAreaWidth + gapBetweenCircleAndBar + barAreaWidth) // Right end of bar area
            .attr("y", -15) // Above the chart content
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.descriptionFontFamily)
            .style("font-size", fillStyle.typography.descriptionFontSize)
            .style("font-weight", fillStyle.typography.descriptionFontWeight)
            .style("fill", fillStyle.textColor)
            .text(columnTitle1Text);
    }

    if (columnTitle2Text) {
        mainChartGroup.append("text")
            .attr("class", "label column-title")
            .attr("x", circleAreaWidth / 2) // Center of circle area
            .attr("y", -15) // Above the chart content
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.descriptionFontFamily)
            .style("font-size", fillStyle.typography.descriptionFontSize)
            .style("font-weight", fillStyle.typography.descriptionFontWeight)
            .style("fill", fillStyle.textColor)
            .text(columnTitle2Text);
    }

    // Block 8: Main Data Visualization Rendering
    const itemGroups = mainChartGroup.selectAll(".item-group")
        .data(sortedChartData)
        .enter()
        .append("g")
        .attr("class", d => `item-group item-${String(d[dimensionField]).replace(/\s+/g, '-')}`)
        .attr("transform", d => `translate(0, ${yScale(d[dimensionField])})`);

    itemGroups.each(function(d, i) {
        const group = d3.select(this);
        const dimensionValue = d[dimensionField];
        const value1 = +d[valueField1];
        const value2 = +d[valueField2];

        const barHeight = yScale.bandwidth();
        const centerY = barHeight / 2;

        const dimensionLabelX = -dimLabelPadding;
        const circleX = circleAreaWidth / 2;
        const barAreaStartX = circleAreaWidth + gapBetweenCircleAndBar;
        
        const barWidthValue = Math.max(0, xScale(value1));
        // Bars are right-aligned within their area in the original logic (grow from right to left)
        // To make them grow from left to right (more conventional for positive values):
        const barX = barAreaStartX; // Start at the beginning of bar area
        // const barX = barAreaStartX + barAreaWidth - barWidthValue; // Original: right-aligned bar
        
        const valueLabelXPos = barX + barWidthValue + 5; // Label to the right of the bar
        // const valueLabelXPos = barX - valueLabelExternalPadding; // Original: label to the left of the bar

        // 1. Dimension Labels
        group.append("text")
            .attr("class", "label dimension-label")
            .attr("x", dimensionLabelX)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${finalDimLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(String(dimensionValue).toUpperCase());

        // 2. Circles
        const circleRadius = radiusScale(value2);
        const circleFillColor = getCategorySpecificColor(dimensionValue, fillStyle.secondaryFallbackColor);
        
        group.append("circle")
            .attr("class", "mark circle-mark")
            .attr("cx", circleX)
            .attr("cy", centerY)
            .attr("r", Math.max(0, circleRadius)) // Ensure radius is not negative
            .attr("fill", circleFillColor)
            .attr("opacity", 0.6)
            .attr("stroke", fillStyle.circleStrokeColor)
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 0.5);

        // 3. Circle Value Labels
        const formattedValue2 = `${formatValue(value2)}${valueUnit2}`;
        const circleLabelFontSize = Math.min(parseFloat(fillStyle.typography.annotationFontSize), Math.max(10, Math.min(barHeight * 0.4, circleRadius * 0.8)));
        group.append("text")
            .attr("class", "label value circle-value-label")
            .attr("x", circleX)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${circleLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedValue2);

        // 4. Bars
        const barFillColor = getCategorySpecificColor(dimensionValue, fillStyle.primaryFallbackColor);
        group.append("rect")
            .attr("class", "mark bar-mark")
            .attr("x", barX)
            .attr("y", 0) // y is relative to the group, which is already translated
            .attr("width", barWidthValue)
            .attr("height", barHeight)
            .attr("fill", barFillColor)
            .attr("rx", barHeight * 0.5) // Preserve rounded ends
            .attr("ry", barHeight * 0.5) // Preserve rounded ends
            .attr("opacity", 0.9)
            .style("stroke", fillStyle.barStrokeColor)
            .style("stroke-width", 1);

        // 5. Bar Value Labels
        // Original places label to the left of the bar.
        // To preserve this, if barX is barAreaStartX (grows LTR), label needs to be at barX + barWidthValue + padding
        // If barX is barAreaStartX + barAreaWidth - barWidthValue (grows RTL), label needs to be at barX - padding
        // The original code had bars growing RTL (barX = barAreaStartX + barAreaWidth - barWidthValue)
        // and labels to their left (valueLabelXPos = barX - valueLabelExternalPadding).
        // Let's stick to the original visual placement for labels relative to bars.
        const originalBarX = barAreaStartX + barAreaWidth - barWidthValue; // Bar grows RTL
        const originalValueLabelXPos = originalBarX - 3; // Label to the left of bar

        // Re-apply original bar X for correct label positioning relative to it
        // (even if bars themselves are drawn LTR for convention, labels should match original intent)
        // For this refactor, I've set bars to grow LTR (barX = barAreaStartX).
        // So, to place labels to the *right* of LTR bars:
        // const valueLabelXPosForLTRBar = barX + barWidthValue + 5; // text-anchor: start
        // To place labels to the *left* of LTR bars (inside or outside):
        const valueLabelXPosForLTRBar = barX - 5; // text-anchor: end (if outside left)
                                                  // or barX + 5, text-anchor: start (if inside left)
        // The original was outside-left of an RTL bar.
        // For an LTR bar, an equivalent might be outside-right.
        // Let's use outside-right for LTR bars.
        const finalValueLabelXPos = barX + barWidthValue + 5;
        const finalTextAnchor = "start";

        const valueLabelText = `${formatValue(value1)}${valueUnit1}`;
        const valueLabelFontSize = Math.min(parseFloat(fillStyle.typography.annotationFontSize), Math.max(barHeight * 0.5, 12));
        group.append("text")
            .attr("class", "label value bar-value-label")
            .attr("x", finalValueLabelXPos)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", finalTextAnchor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${valueLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(valueLabelText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this chart beyond core rendering.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}