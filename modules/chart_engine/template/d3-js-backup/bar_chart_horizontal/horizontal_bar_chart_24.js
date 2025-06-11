/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart With Circle",
  "chart_name": "horizontal_bar_chart_24",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
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
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is external to this function)

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const images = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField1 = dataColumns.find(col => col.role === "y")?.name;
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name;

    if (!dimensionField || !valueField1 || !valueField2) {
        const missingFields = [
            !dimensionField ? "x role field" : null,
            !valueField1 ? "y role field" : null,
            !valueField2 ? "y2 role field" : null
        ].filter(Boolean).join(", ");

        console.error(`Critical chart config missing: [${missingFields}]. Cannot render.`);
        d3.select(containerSelector).html(`<div style='color:red;'>Error: Critical chart configuration missing (${missingFields}). Cannot render chart.</div>`);
        return null;
    }

    let valueUnit1 = dataColumns.find(col => col.role === "y")?.unit;
    valueUnit1 = (valueUnit1 === "none" || !valueUnit1) ? "" : valueUnit1;
    let valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit;
    valueUnit2 = (valueUnit2 === "none" || !valueUnit2) ? "" : valueUnit2;

    const columnTitleText1 = dataColumns.find(col => col.role === "y")?.name || "";
    const columnTitleText2 = dataColumns.find(col => col.role === "y2")?.name || "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: rawTypography.title?.font_family || "Arial, sans-serif",
            titleFontSize: rawTypography.title?.font_size || "16px",
            titleFontWeight: rawTypography.title?.font_weight || "bold",
            labelFontFamily: rawTypography.label?.font_family || "Arial, sans-serif",
            labelFontSize: rawTypography.label?.font_size || "12px",
            labelFontWeight: rawTypography.label?.font_weight || "normal",
            annotationFontFamily: rawTypography.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: rawTypography.annotation?.font_size || "10px",
            annotationFontWeight: rawTypography.annotation?.font_weight || "normal",
        },
        textColor: rawColors.text_color || "#0F223B",
        chartBackground: rawColors.background_color || "#FFFFFF",
        primaryColor: rawColors.other?.primary || "#1f77b4",
        secondaryColor: rawColors.other?.secondary || "#ff7f0e",
    };
    fillStyle.barFillColor = fillStyle.primaryColor;
    fillStyle.circleFillColor = fillStyle.secondaryColor;
    fillStyle.circleStrokeColor = "#FFFFFF"; // Default, could be made configurable

    const estimateTextWidth = (text, fontConfig) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontConfig.fontFamily);
        tempText.setAttribute('font-size', fontConfig.fontSize);
        tempText.setAttribute('font-weight', fontConfig.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more robust for getBBox in some environments,
        // but for simplicity and per instructions, direct creation is used.
        // If issues arise, consider appending to document.body temporarily.
        let width = 0;
        try {
             width = tempText.getBBox().width;
        } catch (e) {
            // Fallback or error logging if getBBox fails
            console.warn("Could not measure text width using in-memory SVG for text:", text, e);
        }
        return width;
    };
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 60, // Reduced from 90 as no main title, but column titles need space
        right: 20,
        bottom: 30,
        left: 0 // Initial, will be calculated
    };

    const flagWidth = 30;
    const flagHeight = 30;
    const textPadding = 5;
    const minDimLabelFontSize = 10;
    let defaultDimLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);

    let maxDimLabelWidth = 0;
    chartData.forEach(d => {
        const labelText = String(d[dimensionField]).toUpperCase();
        const width = estimateTextWidth(labelText, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: `${defaultDimLabelFontSize}px`,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        maxDimLabelWidth = Math.max(maxDimLabelWidth, width);
    });
    
    const maxAllowedLabelSpace = containerWidth * 0.20;
    let finalDimLabelFontSize = defaultDimLabelFontSize;
    if (maxDimLabelWidth > maxAllowedLabelSpace) {
        const scaleFactor = maxAllowedLabelSpace / maxDimLabelWidth;
        finalDimLabelFontSize = Math.max(minDimLabelFontSize, defaultDimLabelFontSize * scaleFactor);
        maxDimLabelWidth = 0; // Recalculate with new font size
        chartData.forEach(d => {
            const labelText = String(d[dimensionField]).toUpperCase();
            const width = estimateTextWidth(labelText, {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: `${finalDimLabelFontSize}px`,
                fontWeight: fillStyle.typography.labelFontWeight
            });
            maxDimLabelWidth = Math.max(maxDimLabelWidth, width);
        });
    }

    chartMargins.left = maxDimLabelWidth + textPadding + flagWidth + textPadding + 10; // Icon + padding + label + padding + buffer

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const circleAreaRatio = 0.25;
    const barAreaRatio = 1 - circleAreaRatio;
    const circleAreaWidth = innerWidth * circleAreaRatio;
    const barAreaWidth = innerWidth * barAreaRatio;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => b[valueField1] - a[valueField1]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2;
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueField1]) * 1.05 || 1]) // Ensure domain is not [0,0]
        .range([0, barAreaWidth]);

    const maxValue2 = d3.max(sortedData, d => +d[valueField2]);
    const bandHeight = yScale.bandwidth();
    const minRadius = bandHeight > 0 ? bandHeight * 0.2 : 5; // Ensure minRadius is positive
    const maxRadiusPossible = Math.min(bandHeight > 0 ? bandHeight * 0.9 : 10, circleAreaWidth / 2); // Cap radius
    const maxRadius = Math.max(minRadius, maxRadiusPossible); // Ensure maxRadius >= minRadius

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxValue2 || 1]) // Ensure domain is not [0,0]
        .range([minRadius, maxRadius]);
    
    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    if (columnTitleText1) {
        mainChartGroup.append("text")
            .attr("class", "label column-title")
            .attr("x", circleAreaWidth + barAreaWidth) // Positioned at the end of the bar area
            .attr("y", -10) // Above the chart content
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(columnTitleText1);
    }

    if (columnTitleText2) {
        mainChartGroup.append("text")
            .attr("class", "label column-title")
            .attr("x", circleAreaWidth / 2) // Centered in the circle area
            .attr("y", -10) // Above the chart content
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(columnTitleText2);
    }

    // Block 8: Main Data Visualization Rendering
    sortedData.forEach(d => {
        const dimensionValue = d[dimensionField];
        const barHeight = yScale.bandwidth();
        const yPos = yScale(dimensionValue);

        if (typeof yPos === 'undefined' || barHeight <= 0) { // Skip if category not in scale or barHeight is non-positive
            console.warn(`Skipping rendering for dimension ${dimensionValue} due to invalid yPos or barHeight.`);
            return;
        }
        const centerY = yPos + barHeight / 2;

        // Dimension Label
        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", -(flagWidth + textPadding + 5)) // Relative to mainChartGroup
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${finalDimLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(String(dimensionValue).toUpperCase());

        // Icon
        const iconUrl = images.field && images.field[dimensionValue] ? images.field[dimensionValue] : null;
        if (iconUrl) {
            mainChartGroup.append("image")
                .attr("class", "image dimension-image")
                .attr("x", -(flagWidth + 5)) // Relative to mainChartGroup
                .attr("y", centerY - flagHeight / 2)
                .attr("width", flagWidth)
                .attr("height", flagHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
        }

        // Circle
        const circleX = circleAreaWidth / 2;
        const circleRadius = radiusScale(+d[valueField2]);
        if (circleRadius > 0) { // Only draw if radius is positive
             mainChartGroup.append("circle")
                .attr("class", "mark circle-mark")
                .attr("cx", circleX)
                .attr("cy", centerY)
                .attr("r", circleRadius)
                .attr("fill", fillStyle.circleFillColor)
                .attr("opacity", 0.7) // Keep some opacity for visual style
                .attr("stroke", fillStyle.circleStrokeColor)
                .attr("stroke-width", 1);
        }


        // Circle Value Label
        const formattedValue2 = `${formatValue(+d[valueField2])}${valueUnit2}`;
        const circleLabelFontSize = Math.min(
            parseFloat(fillStyle.typography.annotationFontSize) * 1.4, // Max 140% of base annotation
            Math.max(parseFloat(fillStyle.typography.annotationFontSize) * 0.8, // Min 80% of base annotation
                     Math.min(barHeight * 0.5, circleRadius > 0 ? circleRadius * 0.8 : 0)) // Fit logic
        );
        if (circleRadius > 0 && circleLabelFontSize > 0) {
            mainChartGroup.append("text")
                .attr("class", "value circle-value-label")
                .attr("x", circleX)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${circleLabelFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(formattedValue2);
        }


        // Bar
        const barAreaStartX = circleAreaWidth;
        const barWidthValue = Math.max(0, xScale(+d[valueField1]));
        const barX = barAreaStartX + barAreaWidth - barWidthValue; // Right-aligned bar

        if (barWidthValue > 0) {
            mainChartGroup.append("rect")
                .attr("class", "mark bar-mark")
                .attr("x", barX)
                .attr("y", yPos)
                .attr("width", barWidthValue)
                .attr("height", barHeight)
                .attr("fill", fillStyle.barFillColor)
                .attr("opacity", 0.9); // Keep some opacity
        }


        // Bar Value Label
        const valueLabelText1 = `${formatValue(+d[valueField1])}${valueUnit1}`;
        const barValueLabelFontSize = Math.min(
            parseFloat(fillStyle.typography.annotationFontSize) * 1.6, // Max 160%
            Math.max(parseFloat(fillStyle.typography.annotationFontSize), barHeight * 0.5) // Min base or fit
        );

        if (barWidthValue > 0 && barValueLabelFontSize > 0) {
            const tempFontConfig = {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: `${barValueLabelFontSize}px`,
                fontWeight: fillStyle.typography.annotationFontWeight
            };
            const currentValueLabelWidth = estimateTextWidth(valueLabelText1, tempFontConfig);
            
            let valueLabelXPos, valueLabelAnchor, valueLabelFillColor;
            const internalPadding = 10;
            const externalPadding = 8;

            if (barWidthValue >= currentValueLabelWidth + internalPadding * 2) { // Inside bar
                valueLabelXPos = barX + internalPadding;
                valueLabelAnchor = "start";
                // Determine contrasting color for label inside bar
                const barLuminance = d3.hsl(fillStyle.barFillColor).l;
                valueLabelFillColor = barLuminance > 0.5 ? "#000000" : "#FFFFFF";
            } else { // Outside bar
                valueLabelXPos = barX - externalPadding;
                valueLabelAnchor = "end";
                valueLabelFillColor = fillStyle.textColor;
            }

            mainChartGroup.append("text")
                .attr("class", "value bar-value-label")
                .attr("x", valueLabelXPos)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", valueLabelAnchor)
                .style("font-family", tempFontConfig.fontFamily)
                .style("font-size", tempFontConfig.fontSize)
                .style("font-weight", tempFontConfig.fontWeight)
                .style("fill", valueLabelFillColor)
                .text(valueLabelText1);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactored version beyond basic styling)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}