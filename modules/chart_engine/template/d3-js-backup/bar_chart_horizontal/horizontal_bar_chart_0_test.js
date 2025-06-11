/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart With Circle",
  "chart_name": "horizontal_bar_chart",
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
    // This function renders a horizontal bar chart paired with circles for a secondary metric.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const chartDataArray = data.data.data;
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Assuming light theme, or use data.colors_dark for dark
    const imagesConfig = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField1 = dataColumns.find(col => col.role === "y")?.name;
    const yField2 = dataColumns.find(col => col.role === "y2")?.name;

    const yUnit1 = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y")?.unit || "");
    const yUnit2 = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y2")?.unit || "");

    if (!xField || !yField1 || !yField2) {
        const missingFields = [
            !xField ? "x role field" : null,
            !yField1 ? "y role field" : null,
            !yField2 ? "y2 role field" : null
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyConfig.title?.font_size || '16px',
            titleFontWeight: typographyConfig.title?.font_weight || 'bold',
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        },
        textColor: colorsConfig.text_color || '#0f223b',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        primaryBarColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#1f77b4',
        secondaryCircleColor: (colorsConfig.other && colorsConfig.other.secondary) ? colorsConfig.other.secondary : '#ff7f0e',
        valueLabelInternalColor: '#FFFFFF', // For labels inside bars
        iconPlaceholderFill: '#cccccc',
        images: {
            field: imagesConfig.field || {},
            other: imagesConfig.other || {}
        }
    };

    const estimateTextWidth = (text, fontConfig, dynamicFontSize = null) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.style.fontFamily = fontConfig.fontFamily || fillStyle.typography.labelFontFamily;
        tempText.style.fontSize = dynamicFontSize || fontConfig.fontSize || fillStyle.typography.labelFontSize;
        tempText.style.fontWeight = fontConfig.fontWeight || fillStyle.typography.labelFontWeight;
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is a common way to ensure getBBox works reliably,
        // but per spec, strictly in-memory. If getBBox is unreliable, a temporary append/remove might be needed.
        // For this implementation, we stick to the in-memory requirement.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails in a pure in-memory environment for some reason
            console.warn("getBBox failed for in-memory SVG, text width estimation might be inaccurate.", e);
            return (text ? text.length : 0) * (parseFloat(dynamicFontSize || fontConfig.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
    };
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI, G to B
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value); // Fallback for smaller numbers
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const flagWidth = 30;
    const flagHeight = 30;
    const textPadding = 5;
    const minDimLabelFontSize = 8;
    const defaultDimLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);

    let maxDimLabelWidth = 0;
    chartDataArray.forEach(d => {
        maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateTextWidth(
            String(d[xField] || "").toUpperCase(),
            { fontFamily: fillStyle.typography.labelFontFamily, fontSize: `${defaultDimLabelFontSize}px`, fontWeight: fillStyle.typography.labelFontWeight }
        ));
    });
    
    const maxAllowedLabelSpace = containerWidth * 0.20; // Increased slightly from original
    let finalDimLabelFontSize = defaultDimLabelFontSize;

    if (maxDimLabelWidth > maxAllowedLabelSpace) {
        const scaleFactor = maxAllowedLabelSpace / maxDimLabelWidth;
        finalDimLabelFontSize = Math.max(minDimLabelFontSize, defaultDimLabelFontSize * scaleFactor);
        maxDimLabelWidth = 0; // Recalculate with new font size
        chartDataArray.forEach(d => {
            maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateTextWidth(
                String(d[xField] || "").toUpperCase(),
                { fontFamily: fillStyle.typography.labelFontFamily, fontWeight: fillStyle.typography.labelFontWeight },
                `${finalDimLabelFontSize}px`
            ));
        });
    }
    
    const chartMargins = {
        top: 20, // Reduced as column titles are removed
        right: 20,
        bottom: 20,
        left: maxDimLabelWidth + textPadding + flagWidth + textPadding + 10 // Ensure enough space
    };

    const leftColumnRatio = 0.80; // Adjusted ratio
    const rightColumnRatio = 0.20;
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const barChartWidth = innerWidth * leftColumnRatio;
    const circleChartWidth = innerWidth * rightColumnRatio;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray].sort((a, b) => (+(b[yField1] || 0)) - (+(a[yField1] || 0)));
    const sortedDimensions = sortedData.map(d => d[xField]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2;
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +(d[yField1] || 0)) * 1.05 || 1])
        .range([0, barChartWidth]);

    const maxValueY2 = d3.max(sortedData, d => +(d[yField2] || 0)) || 0;
    const bandWidth = yScale.bandwidth();
    const minRadius = bandWidth > 0 ? bandWidth * 0.2 : 5;
    const maxRadiusPossible = bandWidth > 0 ? bandWidth * 0.5 : 10; // Max radius based on band height
    const maxRadiusAllowed = circleChartWidth > 0 ? circleChartWidth * 0.45 : 10; // Max radius based on available width for circles
    const maxRadius = Math.min(maxRadiusPossible, maxRadiusAllowed);

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxValueY2])
        .range([minRadius, maxRadius || 5]); // Fallback for maxRadius

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend in this chart as per original design and constraints.
    // Defs for gradients, patterns are removed as per V.2.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    sortedData.forEach((dataPoint) => {
        const dimensionValue = dataPoint[xField];
        const barHeight = yScale.bandwidth();
        const yPos = yScale(dimensionValue);

        if (typeof yPos === 'undefined' || barHeight <= 0) { // Skip if category not in scale or bar height is invalid
            console.warn(`Skipping data point due to invalid yPos or barHeight for dimension: ${dimensionValue}`);
            return;
        }
        const centerY = yPos + barHeight / 2;
        
        const itemGroup = mainChartGroup.append("g")
            .attr("class", "chart-item-group")
            .attr("transform", `translate(0, ${yPos})`);

        // --- Dimension Label & Icon ---
        const dimLabelX = -(flagWidth + textPadding + 5);
        const iconX = -(flagWidth + 5);

        itemGroup.append("text")
            .attr("x", dimLabelX)
            .attr("y", barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${finalDimLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(String(dimensionValue || "").toUpperCase())
            .attr("class", "label dimension-label");

        const iconGroup = itemGroup.append("g")
            .attr("transform", `translate(${iconX}, ${barHeight / 2 - flagHeight / 2})`)
            .attr("class", "icon-group");

        const imageKey = String(dimensionValue);
        const imageUrl = fillStyle.images.field[imageKey] || fillStyle.images.other.primary;

        if (imageUrl) {
            iconGroup.append("image")
                .attr("x", 0).attr("y", 0)
                .attr("width", flagWidth).attr("height", flagHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", imageUrl)
                .attr("class", "image dimension-icon");
        } else {
            iconGroup.append("rect")
                .attr("x", 0).attr("y", 0)
                .attr("width", flagWidth).attr("height", flagHeight)
                .attr("fill", fillStyle.iconPlaceholderFill)
                .attr("class", "icon placeholder-icon");
        }

        // --- Bar Element ---
        const barValue = +(dataPoint[yField1] || 0);
        const barWidthValue = Math.max(0, xScale(barValue));

        itemGroup.append("rect")
            .attr("x", 0)
            .attr("y", 0) // y is 0 because we translated the itemGroup
            .attr("width", barWidthValue)
            .attr("height", barHeight)
            .attr("fill", fillStyle.primaryBarColor)
            .attr("class", "mark bar");

        // --- Bar Value Label ---
        const valueLabelText1 = `${formatValue(barValue)}${yUnit1}`;
        const dynamicBarValueLabelFontSize = `${Math.min(18, Math.max(barHeight * 0.5, parseFloat(fillStyle.typography.annotationFontSize)))}px`;
        const currentBarValueLabelWidth = estimateTextWidth(valueLabelText1, 
            { fontFamily: fillStyle.typography.annotationFontFamily, fontWeight: fillStyle.typography.annotationFontWeight }, 
            dynamicBarValueLabelFontSize
        );
        
        let valueLabel1XPos, valueLabel1Anchor, valueLabel1Fill;
        const internalPadding = 8; const externalPadding = 5;

        if (barWidthValue >= currentBarValueLabelWidth + internalPadding * 2) {
            valueLabel1XPos = internalPadding;
            valueLabel1Anchor = "start";
            valueLabel1Fill = fillStyle.valueLabelInternalColor;
        } else {
            valueLabel1XPos = barWidthValue + externalPadding;
            valueLabel1Anchor = "start";
            valueLabel1Fill = fillStyle.textColor;
        }
        itemGroup.append("text")
            .attr("x", valueLabel1XPos)
            .attr("y", barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", valueLabel1Anchor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", dynamicBarValueLabelFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", valueLabel1Fill)
            .text(valueLabelText1)
            .attr("class", "value text bar-value-label");

        // --- Circle Element ---
        const circleValue = +(dataPoint[yField2] || 0);
        const circleRadiusValue = radiusScale(circleValue);

        if (circleRadiusValue >= 0) { // Ensure radius is valid
            itemGroup.append("circle")
                .attr("cx", barChartWidth + circleChartWidth / 2)
                .attr("cy", barHeight / 2) // cy is relative to itemGroup
                .attr("r", circleRadiusValue)
                .attr("fill", fillStyle.secondaryCircleColor)
                .attr("class", "mark circle");

            // --- Circle Value Label ---
            const valueLabelText2 = `${formatValue(circleValue)}${yUnit2}`;
            const dynamicCircleLabelFontSize = `${Math.min(16, Math.max(barHeight * 0.4, parseFloat(fillStyle.typography.annotationFontSize)))}px`;

            itemGroup.append("text")
                .attr("x", barChartWidth + circleChartWidth / 2)
                .attr("y", barHeight / 2) // y is relative to itemGroup
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", dynamicCircleLabelFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor) // Assuming text on circle should be standard text color
                .text(valueLabelText2)
                .attr("class", "value text circle-value-label");
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No additional enhancements like tooltips or complex interactions in this refactor.

    // Block 10: Cleanup & SVG Node Return
    // No temporary DOM elements were added to the main SVG that need removal here.
    // The in-memory SVG for text measurement is self-contained and garbage collected.

    return svgRoot.node();
}