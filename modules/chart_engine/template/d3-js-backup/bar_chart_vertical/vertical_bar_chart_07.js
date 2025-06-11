/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_07",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 12], [0, "inf"]],
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
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Could be data.colors_dark if logic for themes was present
    const imagesData = data.images || { field: {}, other: {} };
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xColumn ? xColumn.name : undefined;
    const valueFieldName = yColumn ? yColumn.name : undefined;
    
    const categoryFieldUnit = (xColumn && xColumn.unit && xColumn.unit !== "none") ? xColumn.unit : ""; // Though not typically used for category
    const valueFieldUnit = (yColumn && yColumn.unit && yColumn.unit !== "none") ? yColumn.unit : "";


    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: categoryFieldName or valueFieldName could not be determined from dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; text-align:center; font-family: sans-serif;'>Error: Critical chart configuration missing (category or value field). Chart cannot be rendered.</div>");
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
        labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
        labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
        
        annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
        annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '12px',
        annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'bold', // Original had bold

        barColor: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#73D2C7',
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF' // Not directly used for SVG background, but good for consistency
    };

    // Helper for text measurement using an in-memory SVG
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize); // fontSize should be a string e.g., "12px"
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        // Must be in DOM to getBBox in some browsers, but prompt says MUST NOT.
        // Modern browsers often allow getBBox on off-DOM SVG elements.
        return textNode.getBBox().width;
    }
    
    // Numeric value formatting helper
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const chartMargins = { top: 60, right: 30, bottom: 150, left: 60 };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Optional: set background if needed

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 4: Core Chart Dimensions & Layout Calculation
    // Most dimension calculations are integrated with scale definitions or data preprocessing.

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure value is numeric
    })).sort((a, b) => b.value - a.value); // Sort by value descending

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(chartDataArray.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2); // Fixed padding

    const yMaxValue = d3.max(chartDataArray, d => d.value);
    const yScale = d3.scaleLinear()
        .domain([0, yMaxValue > 0 ? yMaxValue * 1.1 : 1]) // Add 10% headroom, handle all-zero data
        .range([innerHeight, 0]);

    // Pre-calculate label font size and max lines for category labels
    const defaultCategoryLabelFontSizePx = parseFloat(fillStyle.labelFontSize); // e.g., 12
    const minCategoryLabelFontSizePx = 10;
    const currentBarWidth = xScale.bandwidth();
    let finalCategoryLabelFontSizePx = defaultCategoryLabelFontSizePx;
    let maxLinesNeeded = 1;
    const categoryLabelLineHeightFactor = 1.2;

    if (currentBarWidth > 0) {
        let maxRatio = 1;
        chartDataArray.forEach(d => {
            const labelText = String(d.category);
            const textWidth = estimateTextWidth(labelText, fillStyle.labelFontFamily, `${defaultCategoryLabelFontSizePx}px`, fillStyle.labelFontWeight);
            const ratio = textWidth / currentBarWidth;
            if (ratio > maxRatio) maxRatio = ratio;
        });

        if (maxRatio > 1) {
            finalCategoryLabelFontSizePx = Math.max(minCategoryLabelFontSizePx, Math.floor(defaultCategoryLabelFontSizePx / maxRatio));
        }

        chartDataArray.forEach(d => {
            const labelText = String(d.category);
            const textWidth = estimateTextWidth(labelText, fillStyle.labelFontFamily, `${finalCategoryLabelFontSizePx}px`, fillStyle.labelFontWeight);
            if (textWidth > currentBarWidth) {
                const words = labelText.split(/\s+/);
                let currentLine = '';
                let lines = 1;
                let simulationSuccess = false;
                if (words.length > 1) {
                    for (let i = 0; i < words.length; i++) {
                        const testLine = currentLine ? currentLine + " " + words[i] : words[i];
                        if (estimateTextWidth(testLine, fillStyle.labelFontFamily, `${finalCategoryLabelFontSizePx}px`, fillStyle.labelFontWeight) > currentBarWidth && currentLine !== '') {
                            lines++;
                            currentLine = words[i];
                            if (estimateTextWidth(currentLine, fillStyle.labelFontFamily, `${finalCategoryLabelFontSizePx}px`, fillStyle.labelFontWeight) > currentBarWidth) {
                                simulationSuccess = false; break;
                            }
                        } else { currentLine = testLine; }
                    }
                    if (currentLine !== '') simulationSuccess = true;
                }
                if (words.length <= 1 || !simulationSuccess) {
                    lines = 1; currentLine = '';
                    const chars = labelText.split('');
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        if (estimateTextWidth(testLine, fillStyle.labelFontFamily, `${finalCategoryLabelFontSizePx}px`, fillStyle.labelFontWeight) > currentBarWidth && currentLine !== '') {
                            lines++; currentLine = chars[i];
                        } else { currentLine += chars[i]; }
                    }
                }
                if (lines > maxLinesNeeded) maxLinesNeeded = lines;
            }
        });
    } else {
        finalCategoryLabelFontSizePx = defaultCategoryLabelFontSizePx;
        maxLinesNeeded = 1;
    }
    
    const categoryLabelStartY = innerHeight + 10; // Start Y pos for category labels (below bars)
    const categoryLabelLineHeight = finalCategoryLabelFontSizePx * categoryLabelLineHeightFactor;
    const categoryLabelBlockHeight = (maxLinesNeeded -1) * categoryLabelLineHeight + finalCategoryLabelFontSizePx; // Approx height of label block
    const iconRadius = 12; // Half of icon size (24px)
    const iconYPosition = categoryLabelStartY + categoryLabelBlockHeight + iconRadius + 5; // Position icon center below labels

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart (no axes, gridlines, legend).

    // Block 8: Main Data Visualization Rendering
    // Render bars
    mainChartGroup.selectAll(".bar-mark")
        .data(chartDataArray)
        .enter()
        .append("rect")
        .attr("class", "mark bar-mark")
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => Math.max(0, innerHeight - yScale(d.value)))
        .attr("fill", fillStyle.barColor)
        .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
        .on("mouseout", function() { d3.select(this).attr("opacity", 1); });

    // Render value labels (above bars)
    const defaultAnnotationFontSizePx = parseFloat(fillStyle.annotationFontSize);
    const minAnnotationFontSizePx = 6;

    mainChartGroup.selectAll(".value-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label value-label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.annotationFontFamily)
        .style("font-weight", fillStyle.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const valueText = formatValue(d.value) + (valueFieldUnit ? ` ${valueFieldUnit}` : '');
            const maxWidth = xScale.bandwidth() * 1.1;
            let finalValueFontSizePx = defaultAnnotationFontSizePx;

            if (maxWidth > 0) {
                const textWidth = estimateTextWidth(valueText, fillStyle.annotationFontFamily, `${defaultAnnotationFontSizePx}px`, fillStyle.annotationFontWeight);
                if (textWidth > maxWidth) {
                    finalValueFontSizePx = Math.max(minAnnotationFontSizePx, Math.floor(defaultAnnotationFontSizePx * (maxWidth / textWidth)));
                }
            }
            d3.select(this)
                .style("font-size", `${finalValueFontSizePx}px`)
                .text(valueText);
        });

    // Render category labels (below bars, with wrapping)
    mainChartGroup.selectAll(".category-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label category-label")
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.labelFontFamily)
        .style("font-size", `${finalCategoryLabelFontSizePx}px`)
        .style("font-weight", fillStyle.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const labelText = String(d.category);
            const textElement = d3.select(this);
            const xPos = xScale(d.category) + xScale.bandwidth() / 2;
            const availableWidth = xScale.bandwidth();
            const textWidth = estimateTextWidth(labelText, fillStyle.labelFontFamily, `${finalCategoryLabelFontSizePx}px`, fillStyle.labelFontWeight);

            if (textWidth > availableWidth && availableWidth > 0) {
                let lines = [];
                let currentLine = '';
                const words = labelText.split(/\s+/);
                let simulationSuccess = false;

                if (words.length > 1) {
                    for (let i = 0; i < words.length; i++) {
                        const testLine = currentLine ? currentLine + " " + words[i] : words[i];
                        if (estimateTextWidth(testLine, fillStyle.labelFontFamily, `${finalCategoryLabelFontSizePx}px`, fillStyle.labelFontWeight) > availableWidth && currentLine !== '') {
                            lines.push(currentLine);
                            currentLine = words[i];
                            if (estimateTextWidth(currentLine, fillStyle.labelFontFamily, `${finalCategoryLabelFontSizePx}px`, fillStyle.labelFontWeight) > availableWidth) {
                                simulationSuccess = false; break;
                            }
                        } else { currentLine = testLine; }
                    }
                    if (currentLine !== '') { lines.push(currentLine); simulationSuccess = true; }
                }

                if (words.length <= 1 || !simulationSuccess) {
                    lines = []; currentLine = '';
                    const chars = labelText.split('');
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        if (estimateTextWidth(testLine, fillStyle.labelFontFamily, `${finalCategoryLabelFontSizePx}px`, fillStyle.labelFontWeight) > availableWidth && currentLine !== '') {
                            lines.push(currentLine); currentLine = chars[i];
                        } else { currentLine += chars[i]; }
                    }
                    if (currentLine !== '') lines.push(currentLine);
                }
                
                lines.forEach((line, i) => {
                    textElement.append("tspan")
                        .attr("x", xPos)
                        .attr("y", categoryLabelStartY + i * categoryLabelLineHeight)
                        .attr("dy", "0.71em") // Baseline adjustment
                        .text(line);
                });
            } else {
                textElement.append("tspan")
                   .attr("x", xPos)
                   .attr("y", categoryLabelStartY)
                   .attr("dy", "0.71em")
                   .text(labelText);
            }
        });

    // Block 9: Optional Enhancements & Post-Processing
    // Render icons (below category labels)
    mainChartGroup.selectAll(".icon-image-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "icon image-group") // Standardized class
        .attr("transform", d => `translate(${xScale(d.category) + xScale.bandwidth() / 2}, ${iconYPosition})`)
        .each(function(d) {
            const iconUrl = imagesData.field && imagesData.field[d.category] ? imagesData.field[d.category] : null;
            if (iconUrl) {
                d3.select(this)
                    .append("image")
                    .attr("xlink:href", iconUrl)
                    .attr("x", -iconRadius) // Center the icon (iconRadius is half width/height)
                    .attr("y", -iconRadius) // Center the icon
                    .attr("width", iconRadius * 2)
                    .attr("height", iconRadius * 2)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("class", "image item-icon"); // Standardized class
            }
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}