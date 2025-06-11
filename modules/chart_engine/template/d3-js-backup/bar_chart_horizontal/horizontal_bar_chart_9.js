/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
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
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const config = data;
    const chartDataArrayInput = config.data && config.data.data ? config.data.data : [];
    const variables = config.variables || {};
    const dataColumns = config.data && config.data.columns ? config.data.columns : [];

    // Clear the containerSelector
    d3.select(containerSelector).html("");

    const categoryFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");

    if (!categoryFieldConfig || !valueFieldConfig) {
        const missing = [];
        if (!categoryFieldConfig) missing.push("role: 'x'");
        if (!valueFieldConfig) missing.push("role: 'y'");
        const errorMsg = `Critical chart config missing: data.columns definitions for ${missing.join(' and ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = categoryFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;
    // const categoryFieldUnit = categoryFieldConfig.unit !== "none" ? categoryFieldConfig.unit : ""; // Not used in this chart type
    const valueFieldUnit = valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";


    // Block 2: Style Configuration & Helper Definitions
    const typographyConfig = config.typography || {};
    const defaultTypographyStyles = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const colorsConfig = config.colors || {};
    const defaultColorStyles = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#e6f0fa" }, // secondary is for extension bar
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        background_color: "#FFFFFF", // Not used for chart SVG background, but good to have
        text_color: "#0f223b"
    };
    
    const imagesConfig = config.images || {}; // Not used in this chart, but parsed as per spec

    const fillStyle = {
        textColor: colorsConfig.text_color || defaultColorStyles.text_color,
        barExtensionBackground: (colorsConfig.other && colorsConfig.other.secondary) || defaultColorStyles.other.secondary,
        typography: {
            categoryLabelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || defaultTypographyStyles.label.font_family,
            categoryLabelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || defaultTypographyStyles.label.font_size,
            categoryLabelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || defaultTypographyStyles.label.font_weight,
            valueLabelFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || defaultTypographyStyles.annotation.font_family,
            valueLabelFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || defaultTypographyStyles.annotation.font_size,
            valueLabelFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || defaultTypographyStyles.annotation.font_weight,
        },
        getBarColor: (categoryName, index) => {
            const fieldColors = colorsConfig.field || defaultColorStyles.field;
            if (fieldColors && fieldColors[categoryName]) {
                return fieldColors[categoryName];
            }
            const availableColors = colorsConfig.available_colors || defaultColorStyles.available_colors;
            if (availableColors && availableColors.length > 0) {
                return availableColors[index % availableColors.length];
            }
            return (colorsConfig.other && colorsConfig.other.primary) || defaultColorStyles.other.primary;
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox should work on in-memory elements in modern browsers
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // console.warn("Failed to estimate text width with in-memory SVG:", e);
            return text.length * (parseInt(fontSize) / 2); // Fallback crude estimation
        }
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    function wrapText(text, maxWidth, fontFamily, fontSize, fontWeight) {
        const textWidth = estimateTextWidth(text, fontFamily, fontSize, fontWeight);
        if (textWidth <= maxWidth) return [text];

        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = words[0] || "";
        
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            if (estimateTextWidth(currentLine + " " + word, fontFamily, fontSize, fontWeight) <= maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);

        if (lines.length === 1 && estimateTextWidth(lines[0], fontFamily, fontSize, fontWeight) > maxWidth) { // Single long word or CJK
            const chars = text.split('');
            lines.length = 0;
            currentLine = "";
            for (const char of chars) {
                if (estimateTextWidth(currentLine + char, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine += char;
                } else {
                    lines.push(currentLine);
                    currentLine = char;
                }
            }
            if (currentLine) lines.push(currentLine);
        }
        return lines.filter(line => line.trim() !== "");
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const baseContainerHeight = variables.height || 600;
    // Dynamic height adjustment based on number of categories is handled in Block 4

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("class", "chart-root-svg")
        // `containerHeight` will be set in Block 4 after data processing
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 60, bottom: 20, left: 120 }; // Initial left margin

    // Calculate max category label width and adjust left margin
    let maxCategoryLabelWidth = 0;
    chartDataArrayInput.forEach(d => {
        const labelText = String(d[categoryFieldName] || "");
        const width = estimateTextWidth(labelText, fillStyle.typography.categoryLabelFontFamily, fillStyle.typography.categoryLabelFontSize, fillStyle.typography.categoryLabelFontWeight);
        if (width > maxCategoryLabelWidth) maxCategoryLabelWidth = width;
    });
    maxCategoryLabelWidth = Math.min(maxCategoryLabelWidth, 200); // Limit max width
    chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + 10 + 5); // +10 for spacing from bar, +5 for text anchor adjustment if any

    // Dynamic height adjustment
    const numCategories = chartDataArrayInput.length;
    const containerHeight = numCategories > 15 
        ? baseContainerHeight * (1 + (numCategories - 15) * 0.03) 
        : baseContainerHeight;

    svgRoot.attr("width", containerWidth).attr("height", containerHeight);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    let chartDataArray = JSON.parse(JSON.stringify(chartDataArrayInput)); // Deep copy for sorting
    chartDataArray.sort((a, b) => (b[valueFieldName] || 0) - (a[valueFieldName] || 0)); // Sort descending by value
    
    const categoryOrder = chartDataArray.map(d => String(d[categoryFieldName]));

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2;
    const yScale = d3.scaleBand()
        .domain(categoryOrder)
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        .domain([0, 100]) // Assuming values are percentages (0-100)
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes or gridlines for this chart type as per original and simplification.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    chartDataArray.forEach((d, i) => {
        const categoryName = String(d[categoryFieldName]);
        const value = +d[valueFieldName] || 0;
        const barY = yScale(categoryName);
        
        if (barY === undefined) { // Should not happen if categoryOrder is correct
            console.warn(`Category "${categoryName}" not found in yScale domain. Skipping.`);
            return;
        }

        const barHeight = yScale.bandwidth();
        const barWidth = xScale(Math.max(0, Math.min(value, 100))); // Clamp value to 0-100
        const barColor = fillStyle.getBarColor(categoryName, i);

        const barGroup = mainChartGroup.append("g")
            .attr("class", "mark bar-group")
            .attr("transform", `translate(0, ${barY})`);

        // Background extension bar (100%)
        barGroup.append("rect")
            .attr("class", "mark background-bar")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", innerWidth)
            .attr("height", barHeight)
            .attr("fill", fillStyle.barExtensionBackground);

        // Data bar
        barGroup.append("rect")
            .attr("class", "mark data-bar")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", barWidth)
            .attr("height", barHeight)
            .attr("fill", barColor);

        // Category Label
        const wrappedCategoryText = wrapText(
            categoryName,
            maxCategoryLabelWidth,
            fillStyle.typography.categoryLabelFontFamily,
            fillStyle.typography.categoryLabelFontSize,
            fillStyle.typography.categoryLabelFontWeight
        );
        const categoryLineHeight = parseInt(fillStyle.typography.categoryLabelFontSize) * 1.2;
        const categoryTotalTextHeight = wrappedCategoryText.length * categoryLineHeight;
        
        const categoryLabelGroup = barGroup.append("g")
            .attr("class", "label category-label-group")
            .attr("transform", `translate(${-10}, ${barHeight / 2 - categoryTotalTextHeight / 2})`); // -10 for spacing from bar edge

        wrappedCategoryText.forEach((line, lineIndex) => {
            categoryLabelGroup.append("text")
                .attr("class", "label category-label-line")
                .attr("x", 0)
                .attr("y", lineIndex * categoryLineHeight)
                .attr("dy", "0.35em") // Small adjustment for better vertical centering of first line
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.categoryLabelFontFamily)
                .style("font-size", fillStyle.typography.categoryLabelFontSize)
                .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(line);
        });
        
        // Value Label
        const formattedValueText = valueFieldUnit ? `${formatValue(value)}${valueFieldUnit}` : formatValue(value);
        const valueLabelWidth = estimateTextWidth(
            formattedValueText,
            fillStyle.typography.valueLabelFontFamily,
            fillStyle.typography.valueLabelFontSize,
            fillStyle.typography.valueLabelFontWeight
        );

        const labelFitsInside = valueLabelWidth + 10 < barWidth; // +10 for padding

        if (labelFitsInside) {
            barGroup.append("text")
                .attr("class", "value data-value-label inside")
                .attr("x", barWidth - 5) // 5px padding from end of bar
                .attr("y", barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.valueLabelFontFamily)
                .style("font-size", fillStyle.typography.valueLabelFontSize)
                .style("font-weight", fillStyle.typography.valueLabelFontWeight)
                .style("fill", "#FFFFFF") // White text for inside
                .text(formattedValueText);
        } else {
            barGroup.append("text")
                .attr("class", "value data-value-label outside")
                .attr("x", barWidth + 5) // 5px padding from end of bar
                .attr("y", barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.valueLabelFontFamily)
                .style("font-size", fillStyle.typography.valueLabelFontSize)
                .style("font-weight", fillStyle.typography.valueLabelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(formattedValueText);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Removed shadows, gradients, rounded corners, strokes as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}