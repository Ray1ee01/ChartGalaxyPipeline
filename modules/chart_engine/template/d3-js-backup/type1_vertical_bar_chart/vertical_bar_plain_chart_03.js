/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_plain_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [["3", "10"], ["0", "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "background_color", "text_color"],
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawVariables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const rawDataColumns = data.data && data.data.columns ? data.data.columns : [];
    const chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = rawDataColumns.find(col => col.role === "x");
    const yColumn = rawDataColumns.find(col => col.role === "y");

    const categoryFieldName = xColumn ? xColumn.name : undefined;
    const valueFieldName = yColumn ? yColumn.name : undefined;
    
    if (!categoryFieldName || !valueFieldName) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push("category field (role 'x')");
        if (!valueFieldName) missingFields.push("value field (role 'y')");
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(' and ')} could not be derived from data.data.columns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: ${errorMessage}</div>`);
        }
        return null;
    }

    const xUnit = (xColumn && xColumn.unit && xColumn.unit !== "none") ? xColumn.unit : "";
    const yUnit = (yColumn && yColumn.unit && yColumn.unit !== "none") ? yColumn.unit : "";

    const DEFAULTS = {
        typography: {
            label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
            annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
        },
        colors: {
            textColor: "#212121",
            primaryBarColor: "#007bff",
            chartBackgroundColor: "#FFFFFF"
        },
        variables: {
            width: 800,
            height: 600
        },
        xScalePadding: 0.2,
        iconSize: 24,
        minLabelFontSize: 8, // Minimum font size for dimension labels
        minAnnotationFontSize: 6 // Minimum font size for value labels
    };

    const typography = {
        label: { ...DEFAULTS.typography.label, ...(rawTypography.label || {}) },
        annotation: { ...DEFAULTS.typography.annotation, ...(rawTypography.annotation || {}) }
    };

    const colors = {
        textColor: rawColors.text_color || DEFAULTS.colors.textColor,
        primaryBarColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : DEFAULTS.colors.primaryBarColor,
        chartBackgroundColor: rawColors.background_color || DEFAULTS.colors.chartBackgroundColor
    };
    
    const images = {
        field: rawImages.field || {},
        other: rawImages.other || {}
    };

    const chartConfig = {
        width: rawVariables.width || DEFAULTS.variables.width,
        height: rawVariables.height || DEFAULTS.variables.height,
        xScalePadding: DEFAULTS.xScalePadding, 
        iconSize: DEFAULTS.iconSize
    };

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        barPrimaryColor: colors.primaryBarColor,
        textColor: colors.textColor,
        chartBackground: colors.chartBackgroundColor,
        typography: {
            labelFontFamily: typography.label.font_family,
            labelFontSize: typography.label.font_size,
            labelFontWeight: typography.label.font_weight,
            annotationFontFamily: typography.annotation.font_family,
            annotationFontSize: typography.annotation.font_size,
            annotationFontWeight: typography.annotation.font_weight,
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text || String(text).length === 0) return 0;
        const tempSvgForEstimation = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNodeForEstimation = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNodeForEstimation.setAttribute('font-family', fontFamily);
        textNodeForEstimation.setAttribute('font-size', fontSize);
        textNodeForEstimation.setAttribute('font-weight', fontWeight);
        textNodeForEstimation.textContent = String(text);
        tempSvgForEstimation.appendChild(textNodeForEstimation);
        
        let width = 0;
        try {
            // Note: getBBox on an unattached SVG element might be unreliable in some edge cases/browsers.
            // However, it's a directive to not append to DOM.
            width = textNodeForEstimation.getBBox().width;
        } catch (e) {
            // Fallback: crude estimation
            const avgCharWidth = parseFloat(fontSize) * 0.6; // Very rough approximation
            width = String(text).length * avgCharWidth;
        }
        return width;
    }
    
    const formatValue = (value) => { // Preserving original formatting logic
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", chartConfig.width)
        .attr("height", chartConfig.height)
        .attr("class", "other chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 150, left: 60 };
    
    const containerWidth = chartConfig.width;
    const containerHeight = chartConfig.height;

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataArray.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName]
    })).sort((a, b) => b.value - a.value);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(chartConfig.xScalePadding);

    const yMaxValue = d3.max(processedData, d => d.value) || 0;
    const yScale = d3.scaleLinear()
        .domain([0, yMaxValue > 0 ? yMaxValue * 1.1 : 10])
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (No explicit Axes, Gridlines, Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Pre-calculate dimension label font sizes and line requirements
    const defaultDimLabelFontSizeNumeric = parseFloat(fillStyle.typography.labelFontSize);
    const currentBarWidth = xScale.bandwidth();
    let finalDimLabelFontSizeNumeric = defaultDimLabelFontSizeNumeric;
    let maxLinesNeededForDimLabels = 1;
    const dimLabelLineHeightFactor = 1.2;

    if (currentBarWidth > 0 && processedData.length > 0) {
        let maxTextToBarWidthRatio = 1;
        processedData.forEach(d => {
            const labelText = String(d.category);
            const textWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, `${defaultDimLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight);
            const ratio = textWidth / currentBarWidth;
            if (ratio > maxTextToBarWidthRatio) maxTextToBarWidthRatio = ratio;
        });

        if (maxTextToBarWidthRatio > 1) {
            finalDimLabelFontSizeNumeric = Math.max(DEFAULTS.minLabelFontSize, Math.floor(defaultDimLabelFontSizeNumeric / maxTextToBarWidthRatio));
        }

        processedData.forEach(d => {
            const labelText = String(d.category);
            const textWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, `${finalDimLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight);
            if (textWidth > currentBarWidth) { // Needs wrapping
                let lines = 1; // Default to 1 line
                const words = labelText.split(/\s+/);
                let currentLine = '';
                let wordWrapSuccess = false;
                if (words.length > 1) { // Try word wrapping
                    lines = 0; // Reset lines for counting
                    for (const word of words) {
                        const testLine = currentLine ? currentLine + " " + word : word;
                        if (estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, `${finalDimLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight) > currentBarWidth && currentLine !== '') {
                            lines++;
                            currentLine = word;
                        } else {
                            currentLine = testLine;
                        }
                        // Check if single word itself is too long
                        if (estimateTextWidth(word, fillStyle.typography.labelFontFamily, `${finalDimLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight) > currentBarWidth && testLine === word) {
                             wordWrapSuccess = false; break; // Fail word wrap, fall to char wrap
                        }
                    }
                    if (currentLine !== '') lines++; // Add last line
                    if (lines > 0) wordWrapSuccess = true; // If any lines were formed
                }

                if (words.length <= 1 || !wordWrapSuccess) { // Try character wrapping
                    lines = 1; currentLine = '';
                    const chars = labelText.split('');
                    for (const char of chars) {
                        const testLine = currentLine + char;
                        if (estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, `${finalDimLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight) > currentBarWidth && currentLine !== '') {
                            lines++;
                            currentLine = char;
                        } else {
                            currentLine = testLine;
                        }
                         if (estimateTextWidth(char, fillStyle.typography.labelFontFamily, `${finalDimLabelFontSizeNumeric}px`, fillStyle.typography.labelFontWeight) > currentBarWidth && currentLine === char) {
                            // A single character is wider than the bar width. This is an extreme edge case.
                            // The line count might be underestimated if not handled, but typically means font is too large or bar too small.
                        }
                    }
                }
                if (lines > maxLinesNeededForDimLabels) maxLinesNeededForDimLabels = lines;
            }
        });
    }
    
    const finalDimLabelFontSizeString = `${finalDimLabelFontSizeNumeric}px`;
    const dimLabelLineHeight = finalDimLabelFontSizeNumeric * dimLabelLineHeightFactor;

    // Block 8: Main Data Visualization Rendering
    const barElements = mainChartGroup.selectAll(".mark.bar")
        .data(processedData)
        .enter()
        .append("path")
        .attr("class", "mark bar")
        .attr("d", d => {
            const x = xScale(d.category);
            const yPos = yScale(d.value);
            const barWidth = xScale.bandwidth();
            const barTotalHeight = Math.max(0, innerHeight - yPos);

            if (barTotalHeight <= 0 || barWidth <= 0) return "";
            const triangleHeight = Math.min(30, Math.max(10, barWidth));
            const actualTriangleHeight = Math.min(triangleHeight, barTotalHeight);

            let path = `M ${x} ${innerHeight}`;
            path += ` L ${x} ${yPos + actualTriangleHeight}`;
            path += ` L ${x + barWidth / 2} ${yPos}`;
            path += ` L ${x + barWidth} ${yPos + actualTriangleHeight}`;
            path += ` L ${x + barWidth} ${innerHeight}`;
            path += ` Z`;
            return path;
        })
        .attr("fill", fillStyle.barPrimaryColor);

    const defaultAnnotationFontSizeNumeric = parseFloat(fillStyle.typography.annotationFontSize);
    mainChartGroup.selectAll(".text.value-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "text value-label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const valueText = formatValue(d.value) + (yUnit ? ` ${yUnit}` : '');
            const maxWidth = xScale.bandwidth() * 1.1;
            let finalValueFontSizeNumeric = defaultAnnotationFontSizeNumeric;
            if (maxWidth > 0) {
                const textWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, `${defaultAnnotationFontSizeNumeric}px`, fillStyle.typography.annotationFontWeight);
                if (textWidth > maxWidth) {
                    finalValueFontSizeNumeric = Math.max(DEFAULTS.minAnnotationFontSize, Math.floor(defaultAnnotationFontSizeNumeric * (maxWidth / textWidth)));
                }
            }
            d3.select(this).style("font-size", `${finalValueFontSizeNumeric}px`).text(valueText);
        });

    const dimLabelStartY = innerHeight + 10;
    mainChartGroup.selectAll(".text.dimension-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "text dimension-label")
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", finalDimLabelFontSizeString)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const labelText = String(d.category) + (xUnit ? ` ${xUnit}` : ''); // Display xUnit if present
            const textElement = d3.select(this);
            const xPos = xScale(d.category) + xScale.bandwidth() / 2;
            const availableWidth = xScale.bandwidth();

            if (estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, finalDimLabelFontSizeString, fillStyle.typography.labelFontWeight) > availableWidth && availableWidth > 0) {
                let lines = []; const words = labelText.split(/\s+/); let currentLine = ''; let wordWrapSuccess = false;
                if (words.length > 1) {
                    for (const word of words) {
                        const testLine = currentLine ? currentLine + " " + word : word;
                        if (estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, finalDimLabelFontSizeString, fillStyle.typography.labelFontWeight) > availableWidth && currentLine !== '') {
                            lines.push(currentLine); currentLine = word;
                        } else { currentLine = testLine; }
                        if (estimateTextWidth(word, fillStyle.typography.labelFontFamily, finalDimLabelFontSizeString, fillStyle.typography.labelFontWeight) > availableWidth && testLine === word) {
                             wordWrapSuccess = false; break;
                        }
                    }
                    if (currentLine !== '') lines.push(currentLine);
                    if (lines.length > 0 && !(words.length > 1 && !wordWrapSuccess && estimateTextWidth(words[0], fillStyle.typography.labelFontFamily, finalDimLabelFontSizeString, fillStyle.typography.labelFontWeight) > availableWidth)) wordWrapSuccess = true;
                }
                if (words.length <= 1 || !wordWrapSuccess) {
                    lines = []; currentLine = ''; const chars = labelText.split('');
                    for (const char of chars) {
                        const testLine = currentLine + char;
                        if (estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, finalDimLabelFontSizeString, fillStyle.typography.labelFontWeight) > availableWidth && currentLine !== '') {
                            lines.push(currentLine); currentLine = char;
                        } else { currentLine = testLine; }
                    }
                    if (currentLine !== '') lines.push(currentLine);
                }
                lines.forEach((line, i) => {
                    textElement.append("tspan").attr("class", "text tspan-line").attr("x", xPos).attr("y", dimLabelStartY + i * dimLabelLineHeight).attr("dy", "0.71em").text(line);
                });
            } else {
                textElement.append("tspan").attr("class", "text tspan-line").attr("x", xPos).attr("y", dimLabelStartY).attr("dy", "0.71em").text(labelText);
            }
        });

    // Block 9: Optional Enhancements & Post-Processing
    const dimLabelBottomApprox = dimLabelStartY + (maxLinesNeededForDimLabels - 1) * dimLabelLineHeight + finalDimLabelFontSizeNumeric * 0.71;
    const iconCenterY = dimLabelBottomApprox + (chartConfig.iconSize / 2) + 5;

    mainChartGroup.selectAll(".icon.icon-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "icon icon-group")
        .attr("transform", d => `translate(${xScale(d.category) + xScale.bandwidth() / 2}, ${iconCenterY})`)
        .each(function(d) {
            const iconUrl = images.field[d.category];
            if (iconUrl) {
                d3.select(this).append("image")
                    .attr("class", "image icon-image")
                    .attr("xlink:href", iconUrl)
                    .attr("x", -chartConfig.iconSize / 2).attr("y", -chartConfig.iconSize / 2)
                    .attr("width", chartConfig.iconSize).attr("height", chartConfig.iconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        });
    
    barElements
        .on("mouseover", function() { d3.select(this).style("opacity", 0.8); })
        .on("mouseout", function() { d3.select(this).style("opacity", 1); });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}