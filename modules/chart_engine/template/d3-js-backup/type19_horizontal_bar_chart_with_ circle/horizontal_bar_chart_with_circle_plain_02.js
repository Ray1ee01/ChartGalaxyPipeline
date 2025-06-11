/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Composite Bar and Proportional Circle Chart",
  "chart_name": "horizontal_composite_bar_circle_01",
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

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
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
    const chartConfig = data; // Renamed for clarity
    const chartData = chartConfig.data && Array.isArray(chartConfig.data.data) ? chartConfig.data.data : [];
    const variables = chartConfig.variables || {};
    const rawTypography = chartConfig.typography || {};
    const rawColors = chartConfig.colors || chartConfig.colors_dark || {}; // Allow for dark theme colors
    const images = chartConfig.images || { field: {}, other: {} };
    const dataColumns = chartConfig.data && Array.isArray(chartConfig.data.columns) ? chartConfig.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField1 = dataColumns.find(col => col.role === "y")?.name;
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name;

    const missingFields = [];
    if (!dimensionField) missingFields.push("x role (dimensionField)");
    if (!valueField1) missingFields.push("y role (valueField1)");
    if (!valueField2) missingFields.push("y2 role (valueField2)");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const valueUnit1 = (dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : dataColumns.find(col => col.role === "y")?.unit) || "";
    const valueUnit2 = (dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : dataColumns.find(col => col.role === "y2")?.unit) || "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            // Annotation and Title typography are not used as per directives
        },
        textColor: rawColors.text_color || '#0f223b',
        primaryBarColor: (rawColors.other && rawColors.other.primary) || '#1f77b4',
        secondaryCircleColor: (rawColors.other && rawColors.other.secondary) || '#ff7f0e',
        chartBackground: rawColors.background_color || '#FFFFFF', // Not directly applied to SVG background by default, but available
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        tempTextElement.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        tempTextElement.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // Note: Appending to body and then removing is more reliable for getBBox/getComputedTextLength
        // but strictly adhering to "MUST NOT be appended to the document DOM".
        // For simple cases, this might work, or a more robust off-screen measurement might be needed.
        // Using getComputedTextLength if available, otherwise approximate with getBBox.
        // For this refactor, we'll assume getBBox on an unattached element is sufficient if styled.
        document.body.appendChild(tempSvg); // Temporarily append to measure
        const width = tempTextElement.getComputedTextLength ? tempTextElement.getComputedTextLength() : tempTextElement.getBBox().width;
        document.body.removeChild(tempSvg); // Remove after measuring
        return width;
    }
    
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
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground); // Apply background color to SVG

    // Block 4: Core Chart Dimensions & Layout Calculation
    const iconWidth = 24;
    const iconHeight = 24;
    const iconMargin = 10; // Margin to the right of the icon
    const textIconGap = 5;  // Gap between dimension text and icon (icon is to the right of text)
    const valueLabelGap = 5; // Gap between bar and its value label
    const barPadding = 0.25; // Fixed bar padding

    const maxDimLabelWidth = d3.max(chartData, d => estimateTextWidth(String(d[dimensionField]).toUpperCase(), {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    })) || 0;

    const maxValue1TextWidth = d3.max(chartData, d => estimateTextWidth(formatValue(+d[valueField1]) + valueUnit1, {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    })) || 0;
    
    // maxValue2TextWidth is not directly used for layout spacing calculation as it's centered in circle

    const chartMargins = {
        top: 20,
        right: 20, 
        bottom: 30,
        left: maxDimLabelWidth + textIconGap + iconWidth + iconMargin + 20 // Space for label, gap, icon, icon_margin, padding
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Check container dimensions and margins.");
        svgRoot.append("text").text("Error: Not enough space to render chart.").attr("x", 10).attr("y", 20).attr("fill", "red");
        return svgRoot.node();
    }
    
    // Proportions for bar and circle areas within innerWidth
    const barAreaRatio = 0.75; 
    const circleAreaRatio = 0.25;

    const barDrawingMaxWidth = innerWidth * barAreaRatio - maxValue1TextWidth - valueLabelGap;
    const circleAreaWidth = innerWidth * circleAreaRatio;
    
    // Block 5: Data Preprocessing & Transformation
    const sortedChartData = [...chartData].sort((a, b) => +b[valueField1] - +a[valueField1]);
    const sortedDimensionNames = sortedChartData.map(d => d[dimensionField]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensionNames)
        .range([0, innerHeight])
        .padding(barPadding);

    const barHeight = yScale.bandwidth();
    if (barHeight <= 0) {
         console.error("Calculated barHeight is not positive. Check innerHeight and data length.");
         svgRoot.append("text").text("Error: Not enough vertical space for bars.").attr("x", 10).attr("y", 20).attr("fill", "red");
         return svgRoot.node();
    }

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedChartData, d => +d[valueField1]) || 1]) // Ensure domain is at least [0,1]
        .range([0, Math.max(0, barDrawingMaxWidth)]); // Ensure range is not negative

    const maxVal2 = d3.max(sortedChartData, d => +d[valueField2]) || 0;
    const minCircleRadius = Math.max(2, barHeight * 0.1); // Ensure a minimum visible radius
    const maxCircleRadiusPossible = Math.min(barHeight * 0.5, circleAreaWidth * 0.4); // Max radius based on available space

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxVal2])
        .range([minCircleRadius, Math.max(minCircleRadius, maxCircleRadiusPossible)]); // Ensure maxRadius >= minRadius

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend as per directives.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    sortedChartData.forEach(d => {
        const dimensionValue = d[dimensionField];
        const barValue = +d[valueField1];
        const circleValue = +d[valueField2];

        const yPos = yScale(dimensionValue);
        if (yPos === undefined) { // Should not happen with sortedDimensionNames domain
            console.warn(`Could not find yPosition for dimension: ${dimensionValue}`);
            return;
        }
        const centerY = yPos + barHeight / 2;
        const currentBarWidth = xScale(barValue);

        // 1. Dimension Label (Text)
        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", -textIconGap - iconWidth - iconMargin) // Position to the left of icon
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(String(dimensionValue).toUpperCase());

        // 2. Icon (Image)
        const iconUrl = images.field && images.field[dimensionValue] ? images.field[dimensionValue] : null;
        if (iconUrl) {
            mainChartGroup.append("image")
                .attr("class", "icon dimension-icon")
                .attr("x", -iconWidth - iconMargin) // Position to the left of the bar start
                .attr("y", centerY - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
        }
        
        // 3. Bar (Rect)
        mainChartGroup.append("rect")
            .attr("class", "mark bar-mark")
            .attr("x", 0)
            .attr("y", yPos)
            .attr("width", Math.max(0, currentBarWidth)) // Ensure non-negative width
            .attr("height", barHeight)
            .attr("fill", fillStyle.primaryBarColor);

        // 4. Bar Value Label (Text)
        mainChartGroup.append("text")
            .attr("class", "value bar-value-label")
            .attr("x", currentBarWidth + valueLabelGap)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formatValue(barValue) + valueUnit1);

        // 5. Circle (Circle)
        const circleXPos = barDrawingMaxWidth + maxValue1TextWidth + valueLabelGap + (circleAreaWidth / 2);
        const circleRadius = radiusScale(circleValue);

        mainChartGroup.append("circle")
            .attr("class", "mark circle-mark")
            .attr("cx", circleXPos)
            .attr("cy", centerY)
            .attr("r", Math.max(0, circleRadius)) // Ensure non-negative radius
            .attr("fill", fillStyle.secondaryCircleColor);

        // 6. Circle Value Label (Text)
        mainChartGroup.append("text")
            .attr("class", "value circle-value-label")
            .attr("x", circleXPos)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formatValue(circleValue) + valueUnit2);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // None for this refactor.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}