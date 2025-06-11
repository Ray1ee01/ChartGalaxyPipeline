/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_01",
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
  "xAxis": "minimal",
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Could be data.colors_dark for dark themes, adapt if necessary
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xColumn ? xColumn.name : undefined;
    const valueFieldName = yColumn ? yColumn.name : undefined;
    const categoryFieldUnit = xColumn && xColumn.unit && xColumn.unit !== "none" ? xColumn.unit : "";
    const valueFieldUnit = yColumn && yColumn.unit && yColumn.unit !== "none" ? yColumn.unit : "";

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) || '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) || 'bold',
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        textOnBarColor: '#FFFFFF', // Specific for labels on dark bars, as per original's white text
        barColor: (colorsInput.other && colorsInput.other.primary) || '#73D2C7',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        iconBorderColor: (colorsInput.other && colorsInput.other.secondary) || '#2D3748',
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.position = 'absolute'; // Ensure it's laid out, even if not visible
        // tempSvg.style.visibility = 'hidden';
        // tempSvg.style.width = '0px'; // Minimize impact if it were to render
        // tempSvg.style.height = '0px';

        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // document.body.appendChild(tempSvg); // Temporarily append for reliable getBBox
        try {
            const width = tempText.getBBox().width;
            // document.body.removeChild(tempSvg); // Clean up
            return width;
        } catch (e) {
            // console.warn("estimateTextWidth failed using getBBox on in-memory SVG. Error:", e);
            // document.body.removeChild(tempSvg); // Clean up if error occurred after append
            // Fallback: crude estimation
            const numChars = text.length;
            const approxCharWidth = parseFloat(fontSize) * 0.6; // Rough estimate based on font size
            return numChars * approxCharWidth;
        }
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 150, left: 60 }; // Original margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure value is numeric
    })).sort((a, b) => b.value - a.value);


    const initialLabelFontSizeNumeric = parseFloat(fillStyle.typography.labelFontSize);
    const minLabelFontSizeNumeric = 8; // Minimum font size for category labels
    const currentBarWidth = innerWidth / chartDataArray.length * (1 - 0.2); // Approx bar width with 0.2 padding
    
    let finalLabelFontSizeNumeric = initialLabelFontSizeNumeric;
    let maxLinesNeeded = 1;
    const lineHeightFactor = 1.2;

    if (currentBarWidth > 0 && chartDataArray.length > 0) {
        let maxRatio = 1;
        chartDataArray.forEach(d => {
            const labelText = String(d.category);
            const textWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, `${initialLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight);
            const ratio = textWidth / currentBarWidth;
            if (ratio > maxRatio) {
                maxRatio = ratio;
            }
        });

        if (maxRatio > 1) {
            finalLabelFontSizeNumeric = Math.max(minLabelFontSizeNumeric, Math.floor(initialLabelFontSizeNumeric / maxRatio));
        }

        chartDataArray.forEach(d => {
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
                        const testWidthCurrent = estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, `${finalLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight);
                        if (testWidthCurrent > currentBarWidth && currentLine !== '') {
                            lines++;
                            currentLine = words[i];
                            if (estimateTextWidth(currentLine, fillStyle.typography.labelFontFamily, `${finalLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight) > currentBarWidth) {
                                simulationSuccess = false; break;
                            }
                        } else {
                            currentLine = testLine;
                        }
                    }
                    if (currentLine !== '') simulationSuccess = true;
                }

                if (words.length <= 1 || !simulationSuccess) {
                    lines = 1;
                    const chars = labelText.split('');
                    currentLine = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        if (estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, `${finalLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight) > currentBarWidth && currentLine !== '') {
                            lines++;
                            currentLine = chars[i];
                        } else {
                            currentLine += chars[i]; // Bug fix: was currentLine = chars[i]
                        }
                    }
                }
                if (lines > maxLinesNeeded) maxLinesNeeded = lines;
            }
        });
    } else {
        finalLabelFontSizeNumeric = initialLabelFontSizeNumeric;
        maxLinesNeeded = 1;
    }
    
    const labelLineHeight = finalLabelFontSizeNumeric * lineHeightFactor;
    const labelStartY = innerHeight + 10;
    const labelBottomApprox = labelStartY + (maxLinesNeeded -1) * labelLineHeight + finalLabelFontSizeNumeric * 0.71; // Approx baseline of last line
    const iconRadius = 15;
    const iconYPosition = labelBottomApprox + iconRadius + 5;
    const iconBottomY = iconYPosition + iconRadius;
    const barExtensionBuffer = 5;
    const barBottomY = iconBottomY + barExtensionBuffer;

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(chartDataArray.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2);

    const yMax = d3.max(chartDataArray, d => d.value);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax * 1.1 : 1]) // Add 10% padding, handle all zero values
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Category Labels (Dimension Labels)
    mainChartGroup.selectAll(".category-label-group")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label category") // Standardized class
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", `${finalLabelFontSizeNumeric}px`)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textOnBarColor) // Text on bar color
        .each(function(d) {
            const labelText = String(d.category);
            const textElement = d3.select(this);
            const xPos = xScale(d.category) + xScale.bandwidth() / 2;
            const availableWidth = xScale.bandwidth();
            const textWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, `${finalLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight);

            if (textWidth > availableWidth && availableWidth > 0) {
                let lines = [];
                let currentLine = '';
                const words = labelText.split(/\s+/);
                let simulationSuccess = false;

                if (words.length > 1) {
                    for (let i = 0; i < words.length; i++) {
                        const testLine = currentLine ? currentLine + " " + words[i] : words[i];
                        if (estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, `${finalLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight) > availableWidth && currentLine !== '') {
                            lines.push(currentLine);
                            currentLine = words[i];
                            if (estimateTextWidth(currentLine, fillStyle.typography.labelFontFamily, `${finalLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight) > availableWidth) {
                                simulationSuccess = false; break;
                            }
                        } else { currentLine = testLine; }
                    }
                    if (currentLine !== '') { lines.push(currentLine); simulationSuccess = true; }
                }
                
                if (words.length <=1 || !simulationSuccess) {
                    lines = []; currentLine = '';
                    const chars = labelText.split('');
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        if (estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, `${finalLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight) > availableWidth && currentLine !== '') {
                            lines.push(currentLine); currentLine = chars[i];
                        } else { currentLine += chars[i]; } // Bug fix: was currentLine = chars[i]
                    }
                    if (currentLine !== '') lines.push(currentLine);
                }
                
                lines.forEach((line, i) => {
                    textElement.append("tspan")
                        .attr("x", xPos)
                        .attr("y", labelStartY + i * labelLineHeight)
                        .attr("dy", "0.71em") // Original dy
                        .text(line);
                });
            } else {
                textElement.append("tspan")
                   .attr("x", xPos)
                   .attr("y", labelStartY)
                   .attr("dy", "0.71em") // Original dy
                   .text(labelText);
            }
        });

    // Icons
    mainChartGroup.selectAll(".icon-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "icon category-icon") // Standardized class
        .attr("transform", d => `translate(${xScale(d.category) + xScale.bandwidth() / 2}, ${iconYPosition})`)
        .each(function(d) {
            const iconGroup = d3.select(this);
            iconGroup.append("circle")
                .attr("r", iconRadius)
                .attr("fill", "none")
                .attr("stroke", fillStyle.iconBorderColor)
                .attr("stroke-width", 0.5) // Thinner stroke than original for subtlety
                .attr("class", "icon-border"); // More specific class if needed

            const imageUrl = imagesInput.field && imagesInput.field[d.category] ? imagesInput.field[d.category] : (imagesInput.other && imagesInput.other.primary ? imagesInput.other.primary : null);
            if (imageUrl) {
                iconGroup.append("image")
                    .attr("xlink:href", imageUrl)
                    .attr("x", -iconRadius * 0.8) // Adjust for image size within circle
                    .attr("y", -iconRadius * 0.8)
                    .attr("width", iconRadius * 1.6)
                    .attr("height", iconRadius * 1.6)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("class", "image"); // Standardized class
            }
        });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar-element")
        .data(chartDataArray)
        .enter()
        .append("rect")
        .attr("class", "mark bar") // Standardized class
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => Math.max(0, barBottomY - yScale(d.value))) // Extend to cover labels/icons
        .attr("fill", fillStyle.barColor);

    // Value Labels
    const initialAnnotationFontSizeNumeric = parseFloat(fillStyle.typography.annotationFontSize);
    const minAnnotationFontSizeNumeric = 6;

    mainChartGroup.selectAll(".value-label-group")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label value") // Standardized class
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5) // Position above bar
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const valueText = formatValue(d.value) + (valueFieldUnit ? ` ${valueFieldUnit}` : "");
            const maxWidth = xScale.bandwidth() * 1.1;
            let finalValueFontSizeNumeric = initialAnnotationFontSizeNumeric;

            if (maxWidth > 0) {
                const textWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, `${initialAnnotationFontSizeNumeric}px`, fillStyle.typography.annotationFontWeight);
                if (textWidth > maxWidth) {
                    finalValueFontSizeNumeric = Math.max(minAnnotationFontSizeNumeric, Math.floor(initialAnnotationFontSizeNumeric * (maxWidth / textWidth)));
                }
            }
            d3.select(this)
                .style("font-size", `${finalValueFontSizeNumeric}px`)
                .text(valueText);
        });

    // Block 9: Optional Enhancements & Post-Processing
    barElements
        .on("mouseover", function() {
            d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
        });
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}