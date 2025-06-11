/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_07",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
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
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assumes light theme, or dark theme handled by caller
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    if (!xColumn || !xColumn.name || !yColumn || !yColumn.name) {
        const missing = [];
        if (!xColumn || !xColumn.name) missing.push("x field");
        if (!yColumn || !yColumn.name) missing.push("y field");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = xColumn.name;
    const valueFieldName = yColumn.name;
    const yUnit = (yColumn.unit && yColumn.unit !== "none") ? yColumn.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',

            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal', // Original used bold, but spec implies normal as default
        },
        barPrimaryColor: (colors.other && colors.other.primary) ? colors.other.primary : '#73D2C7',
        textColor: colors.text_color || '#333333',
        axisLineColor: '#e0e0e0', // For the horizontal separator line
        chartBackground: colors.background_color || '#FFFFFF' // Not directly used on SVG, but good for context
    };

    function estimateTextWidth(text, fontFamily, fontSizeString, fontWeight) {
        if (!text || text.length === 0) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSizeString);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // document.body.appendChild(tempSvg); // Temporarily append to measure accurately
        let width = 0;
        try {
             width = tempText.getBBox().width;
        } catch (e) {
            console.warn("Failed to measure text width with getBBox for text:", text, e);
            // Fallback for environments where getBBox might fail without DOM.
            const fontSizeNumeric = parseFloat(fontSizeString) || 12;
            width = text.length * fontSizeNumeric * 0.6; // Very rough fallback
        }
        // tempSvg.remove();
        return width;
    }
    
    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~.1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.1f")(value / 1000) + "K";
        return d3.format("~g")(value);
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
        .style("background-color", fillStyle.chartBackground); // Optional: set background color

    const chartMargins = { top: 60, right: 30, bottom: 150, left: 60 };

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataArray.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure value is numeric
    })).sort((a, b) => b.value - a.value); // Sort descending by value

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2);

    const yMaxValue = d3.max(processedData, d => d.value);
    const yScale = d3.scaleLinear()
        .domain([0, yMaxValue > 0 ? yMaxValue * 1.1 : 10]) // Add 10% padding, or use 10 if max is 0
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Horizontal line separating plot area from dimension labels/icons
    // Original: innerHeight + 20. Dimension labels start at innerHeight + 10.
    // This means line is 10px below start of labels. Preserving this relative layout.
    const dimensionLabelTextStartY = innerHeight + 10; // Y for the <text> element of dimension labels
    const horizontalLineY = dimensionLabelTextStartY + 10; // Line 10px below the text element's y

    mainChartGroup.append("line")
        .attr("class", "other horizontal-separator")
        .attr("x1", 0)
        .attr("y1", horizontalLineY)
        .attr("x2", innerWidth)
        .attr("y2", horizontalLineY)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Block 8: Main Data Visualization Rendering
    const barElements = mainChartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar")
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => Math.max(0, innerHeight - yScale(d.value)))
        .attr("fill", fillStyle.barPrimaryColor);

    // Block 9: Optional Enhancements & Post-Processing

    // Value Labels (above bars)
    const defaultAnnotationFontSizeNumeric = parseFloat(fillStyle.typography.annotationFontSize);
    const minAnnotationFontSizeNumeric = 6;

    mainChartGroup.selectAll(".value-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label value-label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-weight", fillStyle.typography.annotationFontWeight) // Original used bold, this uses configured
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const valueText = formatValue(d.value) + (yUnit || "");
            const maxWidth = xScale.bandwidth() * 1.1;
            let finalValueFontSizeNumeric = defaultAnnotationFontSizeNumeric;

            if (maxWidth > 0) {
                const textWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, `${defaultAnnotationFontSizeNumeric}px`, fillStyle.typography.annotationFontWeight);
                if (textWidth > maxWidth) {
                    finalValueFontSizeNumeric = Math.max(minAnnotationFontSizeNumeric, Math.floor(defaultAnnotationFontSizeNumeric * (maxWidth / textWidth)));
                }
            }
            d3.select(this)
                .style("font-size", `${finalValueFontSizeNumeric}px`)
                .text(valueText);
        });

    // Dimension Labels (X-axis category labels) & Icons
    const defaultLabelFontSizeNumeric = parseFloat(fillStyle.typography.labelFontSize);
    const minLabelFontSizeNumeric = 10;
    const currentBarWidth = xScale.bandwidth();
    let finalLabelFontSizeNumeric = defaultLabelFontSizeNumeric;
    let maxLinesNeeded = 1;
    const lineHeightFactor = 1.2;

    if (currentBarWidth > 0) {
        let maxRatio = 1;
        processedData.forEach(d => {
            const labelText = String(d.category);
            const textWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, `${defaultLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight);
            const ratio = textWidth / currentBarWidth;
            if (ratio > maxRatio) maxRatio = ratio;
        });
        if (maxRatio > 1) {
            finalLabelFontSizeNumeric = Math.max(minLabelFontSizeNumeric, Math.floor(defaultLabelFontSizeNumeric / maxRatio));
        }

        processedData.forEach(d => {
            const labelText = String(d.category);
            const textWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, `${finalLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight);
            if (textWidth > currentBarWidth) {
                const words = labelText.split(/\s+/);
                let currentLine = '';
                let lines = 1;
                let simulationSuccess = false;
                if (words.length > 1) {
                    for (let i = 0; i < words.length; i++) {
                        const testLine = currentLine ? currentLine + " " + words[i] : words[i];
                        if (estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, `${finalLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight) > currentBarWidth && currentLine !== '') {
                            lines++; currentLine = words[i];
                            if (estimateTextWidth(currentLine, fillStyle.typography.labelFontFamily, `${finalLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight) > currentBarWidth) { simulationSuccess = false; break; }
                        } else { currentLine = testLine; }
                    }
                    if (currentLine !== '') simulationSuccess = true;
                }
                if (words.length <= 1 || !simulationSuccess) {
                    lines = 1; const chars = labelText.split(''); currentLine = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        if (estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, `${finalLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight) > currentBarWidth && currentLine !== '') {
                            lines++; currentLine = chars[i];
                        } else { currentLine += chars[i]; }
                    }
                }
                if (lines > maxLinesNeeded) maxLinesNeeded = lines;
            }
        });
    } else {
        finalLabelFontSizeNumeric = defaultLabelFontSizeNumeric;
        maxLinesNeeded = 1;
    }
    
    const finalLabelFontSizeString = `${finalLabelFontSizeNumeric}px`;
    const dimensionLabelLineHeight = finalLabelFontSizeNumeric * lineHeightFactor;

    mainChartGroup.selectAll(".dimension-label-group")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label dimension-label")
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", finalLabelFontSizeString)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor) // Using standard text color
        .each(function(d) {
            const labelText = String(d.category);
            const textElement = d3.select(this);
            const xPos = xScale(d.category) + xScale.bandwidth() / 2;
            const availableWidth = xScale.bandwidth();
            const textWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, finalLabelFontSizeString, fillStyle.typography.labelFontWeight);

            if (textWidth > availableWidth && availableWidth > 0) {
                let lines = []; let currentLine = ''; let simulationSuccess = false;
                const words = labelText.split(/\s+/);
                if (words.length > 1) {
                    for (let i = 0; i < words.length; i++) {
                        const testLine = currentLine ? currentLine + " " + words[i] : words[i];
                        if (estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, finalLabelFontSizeString, fillStyle.typography.labelFontWeight) > availableWidth && currentLine !== '') {
                            lines.push(currentLine); currentLine = words[i];
                            if (estimateTextWidth(currentLine, fillStyle.typography.labelFontFamily, finalLabelFontSizeString, fillStyle.typography.labelFontWeight) > availableWidth) { simulationSuccess = false; break; }
                        } else { currentLine = testLine; }
                    }
                    if (currentLine !== '') { lines.push(currentLine); simulationSuccess = true; }
                }
                if (words.length <= 1 || !simulationSuccess) {
                    lines = []; const chars = labelText.split(''); currentLine = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        if (estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, finalLabelFontSizeString, fillStyle.typography.labelFontWeight) > availableWidth && currentLine !== '') {
                            lines.push(currentLine); currentLine = chars[i];
                        } else { currentLine += chars[i]; }
                    }
                    lines.push(currentLine);
                }
                lines.forEach((line, i) => {
                    textElement.append("tspan")
                        .attr("x", xPos)
                        .attr("y", dimensionLabelTextStartY + i * dimensionLabelLineHeight) // Use the pre-calculated Y start
                        .attr("dy", "0.71em") // Baseline adjustment
                        .text(line);
                });
            } else {
                textElement.append("tspan")
                   .attr("x", xPos)
                   .attr("y", dimensionLabelTextStartY) // Use the pre-calculated Y start
                   .attr("dy", "0.71em") // Baseline adjustment
                   .text(labelText);
            }
        });

    // Icons
    const iconRadius = 15; // Half of icon size (24px image, 15px effective radius for spacing)
    const labelBottomApprox = dimensionLabelTextStartY + (maxLinesNeeded -1) * dimensionLabelLineHeight + finalLabelFontSizeNumeric * 0.71; // Approx baseline of last line
    const iconYPosition = labelBottomApprox + iconRadius + 5; // Center of icon

    mainChartGroup.selectAll(".icon-image-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "icon image-icon-group")
        .attr("transform", d => `translate(${xScale(d.category) + xScale.bandwidth() / 2}, ${iconYPosition})`)
        .each(function(d) {
            const imageUrl = images.field && images.field[d.category] ? images.field[d.category] : null;
            if (imageUrl) {
                d3.select(this)
                    .append("image")
                    .attr("class", "icon image-icon")
                    .attr("xlink:href", imageUrl)
                    .attr("x", -12) // Centering 24px image
                    .attr("y", -12) // Centering 24px image
                    .attr("width", 24)
                    .attr("height", 24)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}