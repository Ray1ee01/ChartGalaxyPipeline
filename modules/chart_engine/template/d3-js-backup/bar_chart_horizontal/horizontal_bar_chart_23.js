/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart with Proportional Circles",
  "chart_name": "horizontal_bar_proportional_circle_01",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const chartData = data.data && data.data.data ? data.data.data : [];
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // Assuming light theme, or use data.colors_dark if specified
    const rawImages = data.images || {};

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldRole = "x";
    const valueField1Role = "y";
    const valueField2Role = "y2";

    const getField = (role) => dataColumns.find(col => col.role === role);

    const dimensionFieldDef = getField(dimensionFieldRole);
    const valueField1Def = getField(valueField1Role);
    const valueField2Def = getField(valueField2Role);

    const dimensionFieldName = dimensionFieldDef?.name;
    const valueField1Name = valueField1Def?.name;
    const valueField2Name = valueField2Def?.name;

    if (!dimensionFieldName || !valueField1Name || !valueField2Name) {
        let missingFields = [];
        if (!dimensionFieldName) missingFields.push(`field with role '${dimensionFieldRole}'`);
        if (!valueField1Name) missingFields.push(`field with role '${valueField1Role}'`);
        if (!valueField2Name) missingFields.push(`field with role '${valueField2Role}'`);
        
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("font-family", "sans-serif")
                .style("padding", "10px")
                .html(`Configuration Error: ${errorMsg}`);
        }
        return null;
    }

    const valueUnit1 = valueField1Def?.unit && valueField1Def.unit !== "none" ? valueField1Def.unit : "";
    const valueUnit2 = valueField2Def?.unit && valueField2Def.unit !== "none" ? valueField2Def.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: {
            field: rawImages.field || {},
            other: rawImages.other || {}
        }
    };

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.labelFontFamily = (rawTypography.label && rawTypography.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (rawTypography.label && rawTypography.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (rawTypography.label && rawTypography.label.font_weight) || defaultTypography.label.font_weight;

    fillStyle.typography.annotationFontFamily = (rawTypography.annotation && rawTypography.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (rawTypography.annotation && rawTypography.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (rawTypography.annotation && rawTypography.annotation.font_weight) || defaultTypography.annotation.font_weight;
    
    // Color defaults
    fillStyle.textColor = rawColors.text_color || '#333333';
    fillStyle.backgroundColor = rawColors.background_color || '#FFFFFF';
    fillStyle.barColor = (rawColors.other && rawColors.other.primary) || '#1f77b4';
    fillStyle.circleColor = (rawColors.other && rawColors.other.secondary) || '#ff7f0e';
    fillStyle.iconPlaceholderFill = d3.color(fillStyle.barColor).brighter(0.8).toString();


    const estimateTextWidth = (text, fontProps) => {
        if (!text || String(text).length === 0) return 0;
        try {
            const svgNS = 'http://www.w3.org/2000/svg';
            const tempSvg = document.createElementNS(svgNS, 'svg');
            const tempText = document.createElementNS(svgNS, 'text');
            if (fontProps.font_family) tempText.setAttribute('font-family', fontProps.font_family);
            if (fontProps.font_size) tempText.setAttribute('font-size', fontProps.font_size);
            if (fontProps.font_weight) tempText.setAttribute('font-weight', fontProps.font_weight);
            tempText.textContent = String(text);
            tempSvg.appendChild(tempText);
            const width = tempText.getBBox().width;
            return width;
        } catch (e) {
            console.warn(`Failed to use getBBox for text width estimation: "${text}". Error: ${e.message}. Using fallback.`);
            const fontSize = parseFloat(fontProps.font_size) || 12;
            return String(text).length * fontSize * 0.6; // Crude fallback
        }
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .style("background-color", fillStyle.backgroundColor)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 0 }; // Initial left, will be updated

    const flagWidth = 30;
    const flagHeight = 30;
    const textPadding = 5;
    const minFontSize = 8;
    
    let maxDimLabelWidth = 0;
    let finalDimLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const tempLabelFontProps = {
        font_family: fillStyle.typography.labelFontFamily,
        font_size: `${finalDimLabelFontSize}px`,
        font_weight: fillStyle.typography.labelFontWeight
    };

    chartData.forEach(d => {
        const labelText = String(d[dimensionFieldName] || "").toUpperCase();
        maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateTextWidth(labelText, tempLabelFontProps));
    });
    
    const maxAllowedLabelSpace = containerWidth * 0.20; // Allow labels up to 20% of width
    if (maxDimLabelWidth > maxAllowedLabelSpace) {
        const scaleFactor = maxAllowedLabelSpace / maxDimLabelWidth;
        finalDimLabelFontSize = Math.max(minFontSize, finalDimLabelFontSize * scaleFactor);
        
        tempLabelFontProps.font_size = `${finalDimLabelFontSize}px`;
        maxDimLabelWidth = 0; // Recalculate with new font size
        chartData.forEach(d => {
            const labelText = String(d[dimensionFieldName] || "").toUpperCase();
            maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateTextWidth(labelText, tempLabelFontProps));
        });
    }
    
    chartMargins.left = maxDimLabelWidth + textPadding + flagWidth + textPadding + 10; // Extra 10px buffer

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const leftColumnRatio = 0.80; // Bar chart part
    const rightColumnRatio = 0.20; // Circle chart part
    const barChartWidth = innerWidth * leftColumnRatio;
    const circleChartWidth = innerWidth * rightColumnRatio;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => {
        const valA = +a[valueField1Name] || 0;
        const valB = +b[valueField1Name] || 0;
        return valB - valA;
    });
    const sortedDimensions = sortedData.map(d => d[dimensionFieldName]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.25;
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    const maxVal1 = d3.max(sortedData, d => +d[valueField1Name]);
    const xScale = d3.scaleLinear()
        .domain([0, maxVal1 > 0 ? maxVal1 * 1.05 : 1]) // Add 5% padding, ensure domain is not [0,0]
        .range([0, barChartWidth]);

    const maxVal2 = d3.max(sortedData, d => +d[valueField2Name]);
    const bandHeight = yScale.bandwidth();
    const minRadius = Math.max(2, bandHeight * 0.1); 
    const maxRadius = Math.min(bandHeight * 0.45, circleChartWidth * 0.45); 

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxVal2 > 0 ? maxVal2 : 1]) // Ensure domain is not [0,0]
        .range([minRadius, maxRadius]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart (no axes, gridlines, legend, or main titles/subtitles).

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-area")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    sortedData.forEach(d => {
        const dimensionValue = d[dimensionFieldName];
        const value1 = +d[valueField1Name] || 0;
        const value2 = +d[valueField2Name] || 0;

        const yPos = yScale(dimensionValue);
        if (typeof yPos === 'undefined') { // Skip if dimension not in scale (e.g. bad data)
            console.warn(`Dimension "${dimensionValue}" not found in yScale domain. Skipping.`);
            return;
        }

        const currentBarHeight = yScale.bandwidth();
        const centerY = yPos + currentBarHeight / 2;
        
        const barWidthActual = Math.max(0, xScale(value1));

        // 1. Dimension Label (Text)
        const labelX = -(flagWidth + textPadding);
        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", labelX)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${finalDimLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(String(dimensionValue).toUpperCase());

        // 2. Icon/Image
        const iconX = -(flagWidth); // Position icon to the right of the label text
        const iconGroup = mainChartGroup.append("g")
            .attr("class", "icon-group")
            .attr("transform", `translate(${iconX - flagWidth - textPadding}, ${centerY - flagHeight / 2})`); // Shift left for icon

        const imageUrl = fillStyle.images.field[dimensionValue] || (fillStyle.images.other && fillStyle.images.other.primary);
        if (imageUrl) {
            iconGroup.append("image")
                .attr("class", "image dimension-icon")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", flagWidth)
                .attr("height", flagHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", imageUrl);
        } else {
            iconGroup.append("rect")
                .attr("class", "icon dimension-icon-placeholder")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", flagWidth)
                .attr("height", flagHeight)
                .attr("fill", fillStyle.iconPlaceholderFill);
        }

        // 3. Bar
        mainChartGroup.append("rect")
            .attr("class", "mark bar")
            .attr("x", 0)
            .attr("y", yPos)
            .attr("width", barWidthActual)
            .attr("height", currentBarHeight)
            .attr("fill", fillStyle.barColor);

        // 4. Bar Value Label
        const valueLabelText1 = `${formatValue(value1)}${valueUnit1}`;
        const annotationBaseFontSize = parseFloat(fillStyle.typography.annotationFontSize);
        const barValueLabelFontSize = Math.min(annotationBaseFontSize * 1.5, Math.max(currentBarHeight * 0.5, annotationBaseFontSize * 0.8));
        
        const valueLabelFontProps = {
            font_family: fillStyle.typography.annotationFontFamily,
            font_size: `${barValueLabelFontSize}px`,
            font_weight: fillStyle.typography.annotationFontWeight
        };
        const valueLabel1Width = estimateTextWidth(valueLabelText1, valueLabelFontProps);
        
        let valueLabel1XPos, valueLabel1Anchor, valueLabel1Fill;
        const internalPadding = 5;
        const externalPadding = 5;

        if (barWidthActual >= valueLabel1Width + internalPadding * 2) { // Enough space inside (left aligned)
            valueLabel1XPos = internalPadding;
            valueLabel1Anchor = "start";
            valueLabel1Fill = d3.color(fillStyle.barColor).l > 0.5 ? '#333333' : '#FFFFFF'; // Contrast
        } else { // Outside right
            valueLabel1XPos = barWidthActual + externalPadding;
            valueLabel1Anchor = "start";
            valueLabel1Fill = fillStyle.textColor;
        }

        mainChartGroup.append("text")
            .attr("class", "label value-label bar-value-label")
            .attr("x", valueLabel1XPos)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", valueLabel1Anchor)
            .style("font-family", valueLabelFontProps.font_family)
            .style("font-size", valueLabelFontProps.font_size)
            .style("font-weight", valueLabelFontProps.font_weight)
            .style("fill", valueLabel1Fill)
            .text(valueLabelText1);

        // 5. Circle
        const circleRadiusActual = radiusScale(value2);
        const circleX = barChartWidth + (circleChartWidth / 2);
        mainChartGroup.append("circle")
            .attr("class", "mark circle")
            .attr("cx", circleX)
            .attr("cy", centerY)
            .attr("r", circleRadiusActual > 0 ? circleRadiusActual : 0) // Ensure non-negative radius
            .attr("fill", fillStyle.circleColor)
            .attr("opacity", 0.7);

        // 6. Circle Value Label
        if (circleRadiusActual > minRadius * 1.2) { // Only show label if circle is large enough
            const valueLabelText2 = `${formatValue(value2)}${valueUnit2}`;
            const circleValueLabelFontSize = Math.min(annotationBaseFontSize * 1.2, Math.max(circleRadiusActual * 0.4, annotationBaseFontSize * 0.7));
            const circleLabelFontProps = {
                font_family: fillStyle.typography.annotationFontFamily,
                font_size: `${circleValueLabelFontSize}px`,
                font_weight: fillStyle.typography.annotationFontWeight
            };
            const valueLabel2Width = estimateTextWidth(valueLabelText2, circleLabelFontProps);

            if (valueLabel2Width < circleRadiusActual * 2 * 0.9) { // Check if text fits
                 mainChartGroup.append("text")
                    .attr("class", "label value-label circle-value-label")
                    .attr("x", circleX)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .style("font-family", circleLabelFontProps.font_family)
                    .style("font-size", circleLabelFontProps.font_size)
                    .style("font-weight", circleLabelFontProps.font_weight)
                    .style("fill", d3.color(fillStyle.circleColor).l > 0.5 ? '#333333' : '#FFFFFF') // Contrast
                    .text(valueLabelText2);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects like gradients or shadows are applied per directives.

    // Block 10: Cleanup & SVG Node Return
    // Temporary elements for text measurement are created in memory and not appended to DOM, so no specific cleanup needed here.
    return svgRoot.node();
}