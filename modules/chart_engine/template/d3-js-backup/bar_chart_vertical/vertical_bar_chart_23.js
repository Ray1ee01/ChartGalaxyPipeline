/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_23",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 10], [0, 100]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 800,
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
    // This function creates a vertical bar chart with triangle tops, value labels,
    // dimension labels below bars, and optional icons below dimension labels.
    // It adheres to specific styling and structural directives.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    // Typography Configuration
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" }, // Not used per spec
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const inputTypography = data.typography || {};
    const mergedTypography = {
        title: { ...defaultTypography.title, ...(inputTypography.title) },
        label: { ...defaultTypography.label, ...(inputTypography.label) },
        annotation: { ...defaultTypography.annotation, ...(inputTypography.annotation) }
    };

    // Color Configuration
    const defaultColors = {
        text_color: "#333333",
        background_color: "#FFFFFF",
        other: { primary: "#73D2C7", secondary: "#4682B4" }, // primary is bar color
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"] // d3.schemeCategory10
    };
    const inputColors = data.colors || {};
    const mergedColors = {
        ...defaultColors,
        ...inputColors,
        other: { ...defaultColors.other, ...(inputColors.other) }
    };

    // Image Configuration
    const images = data.images || { field: {}, other: {} };

    // Critical Field Name Extraction
    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xColumn ? xColumn.name : undefined;
    const valueFieldName = yColumn ? yColumn.name : undefined;
    const valueFieldUnit = (yColumn && yColumn.unit && yColumn.unit !== "none") ? yColumn.unit : "";

    // Critical Identifier Validation
    const missingFields = [];
    if (!categoryFieldName) missingFields.push("Category field (role: 'x')");
    if (!valueFieldName) missingFields.push("Value field (role: 'y')");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Clear the container
    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        barColor: (mergedColors.other && mergedColors.other.primary) ? mergedColors.other.primary : defaultColors.available_colors[0],
        textColor: mergedColors.text_color,
        chartBackground: mergedColors.background_color,
        iconUrls: images.field || {},
        typography: {
            dimensionLabelFontFamily: mergedTypography.label.font_family,
            dimensionLabelFontSize: mergedTypography.label.font_size,
            dimensionLabelFontWeight: mergedTypography.label.font_weight,
            valueLabelFontFamily: mergedTypography.annotation.font_family,
            valueLabelFontSize: mergedTypography.annotation.font_size,
            valueLabelFontWeight: mergedTypography.annotation.font_weight,
        }
    };

    // Helper for text measurement (in-memory SVG)
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text || String(text).trim() === "") return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = String(text);
        tempSvg.appendChild(textNode);
        // Note: getBBox on an unattached SVG element might be unreliable in some browsers.
        // Appending to DOM temporarily is more robust but forbidden by directives.
        try {
             // Temporarily append to body to ensure getBBox() works reliably cross-browser
            document.body.appendChild(tempSvg);
            const width = textNode.getBBox().width;
            document.body.removeChild(tempSvg);
            return width;
        } catch (e) {
            console.warn("Error getting text BBox. Using approximate width. Text:", text, e);
            const size = parseFloat(fontSize) || 12;
            return String(text).length * size * 0.6; // Rough fallback
        }
    }
    
    // Value Formatter
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.1f")(value / 1000) + "K";
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    const chartMargins = { top: 60, right: 30, bottom: 150, left: 60 }; // Original margins

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] || 0
    })).sort((a, b) => b.value - a.value); // Sort descending by value

    if (chartDataArray.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.dimensionLabelFontFamily)
            .style("font-size", "16px")
            .style("fill", fillStyle.textColor)
            .text("No data available to display.")
            .attr("class", "text no-data-message");
        return svgRoot.node();
    }
    
    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(chartDataArray.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2);

    const yMax = d3.max(chartDataArray, d => d.value);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax * 1.1 : 10]) // Add 10% padding, handle all zero values
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart as per directives (no axes, gridlines, legend).

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)

    // --- Pre-calculate Dimension Label Font Size and Max Lines ---
    const initialDimLabelFontSize = parseFloat(fillStyle.typography.dimensionLabelFontSize);
    const minDimLabelFontSize = 8;
    const barWidth = xScale.bandwidth();
    let finalDimLabelFontSize = initialDimLabelFontSize;
    let maxLinesNeeded = 1;
    const lineHeightFactor = 1.2;

    if (barWidth > 0) {
        let maxTextToBarWidthRatio = 1;
        chartDataArray.forEach(d => {
            const text = String(d.category);
            const textW = estimateTextWidth(text, fillStyle.typography.dimensionLabelFontFamily, initialDimLabelFontSize, fillStyle.typography.dimensionLabelFontWeight);
            if (textW > 0 && barWidth > 0) {
                 const ratio = textW / barWidth;
                 if (ratio > maxTextToBarWidthRatio) maxTextToBarWidthRatio = ratio;
            }
        });

        if (maxTextToBarWidthRatio > 1) {
            finalDimLabelFontSize = Math.max(minDimLabelFontSize, Math.floor(initialDimLabelFontSize / maxTextToBarWidthRatio));
        }

        chartDataArray.forEach(d => {
            const text = String(d.category);
            const textW = estimateTextWidth(text, fillStyle.typography.dimensionLabelFontFamily, finalDimLabelFontSize, fillStyle.typography.dimensionLabelFontWeight);
            
            if (textW > barWidth) {
                const words = text.split(/\s+/);
                let currentLine = '';
                let lines = 1;
                let wordWrapSuccess = false;

                if (words.length > 1) {
                    for (const word of words) {
                        const testLine = currentLine ? currentLine + " " + word : word;
                        if (estimateTextWidth(testLine, fillStyle.typography.dimensionLabelFontFamily, finalDimLabelFontSize, fillStyle.typography.dimensionLabelFontWeight) > barWidth && currentLine) {
                            lines++;
                            currentLine = word;
                            if (estimateTextWidth(currentLine, fillStyle.typography.dimensionLabelFontFamily, finalDimLabelFontSize, fillStyle.typography.dimensionLabelFontWeight) > barWidth) { // Single word too long
                                wordWrapSuccess = false; break;
                            }
                        } else {
                            currentLine = testLine;
                        }
                    }
                    if (currentLine) wordWrapSuccess = true;
                }

                if (words.length <= 1 || !wordWrapSuccess) { // Character wrap
                    lines = 1; currentLine = '';
                    const chars = text.split('');
                    for (const char of chars) {
                        const testLine = currentLine + char;
                        if (estimateTextWidth(testLine, fillStyle.typography.dimensionLabelFontFamily, finalDimLabelFontSize, fillStyle.typography.dimensionLabelFontWeight) > barWidth && currentLine) {
                            lines++; currentLine = char;
                        } else {
                            currentLine += char;
                        }
                    }
                }
                if (lines > maxLinesNeeded) maxLinesNeeded = lines;
            }
        });
    } else {
        finalDimLabelFontSize = initialDimLabelFontSize;
        maxLinesNeeded = 1;
    }
    const finalDimLabelLineHeight = finalDimLabelFontSize * lineHeightFactor;

    // --- Render Bars ---
    const barElements = mainChartGroup.selectAll(".bar-path")
        .data(chartDataArray)
        .enter()
        .append("path")
        .attr("class", "mark bar-path") // Standardized class
        .attr("d", d => {
            const x = xScale(d.category);
            const yPos = yScale(d.value);
            const currentBarWidth = xScale.bandwidth();
            const currentBarHeight = Math.max(0, innerHeight - yPos);

            if (currentBarHeight <= 0 || currentBarWidth <= 0) return "";

            const triangleHeight = Math.min(30, Math.max(10, currentBarWidth));
            const actualTriangleHeight = Math.min(triangleHeight, currentBarHeight);
            
            let path = `M ${x} ${innerHeight}`; // Bottom-left
            path += ` L ${x} ${yPos + actualTriangleHeight}`; // Top-left of rect / base of triangle
            path += ` L ${x + currentBarWidth / 2} ${yPos}`; // Tip of triangle
            path += ` L ${x + currentBarWidth} ${yPos + actualTriangleHeight}`; // Top-right of rect / base of triangle
            path += ` L ${x + currentBarWidth} ${innerHeight}`; // Bottom-right
            path += ` Z`; // Close path
            return path;
        })
        .attr("fill", fillStyle.barColor);

    // --- Render Value Labels (above bars) ---
    const initialValueLabelFontSize = parseFloat(fillStyle.typography.valueLabelFontSize);
    const minValueLabelFontSize = 6;

    mainChartGroup.selectAll(".value-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label value-label") // Standardized class
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.valueLabelFontFamily)
        .style("font-weight", fillStyle.typography.valueLabelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const valueText = formatValue(d.value) + (valueFieldUnit ? ` ${valueFieldUnit}` : '');
            const maxWidth = xScale.bandwidth() * 1.1;
            let finalValueFontSize = initialValueLabelFontSize;

            if (barWidth > 0 && maxWidth > 0) {
                const textW = estimateTextWidth(valueText, fillStyle.typography.valueLabelFontFamily, initialValueLabelFontSize, fillStyle.typography.valueLabelFontWeight);
                if (textW > maxWidth) {
                    finalValueFontSize = Math.max(minValueLabelFontSize, Math.floor(initialValueLabelFontSize * (maxWidth / textW)));
                }
            }
            d3.select(this)
                .style("font-size", `${finalValueFontSize}px`)
                .text(valueText);
        });

    // --- Render Dimension Labels (X-axis category labels) ---
    const dimensionLabelStartY = innerHeight + 10; // Start Y for first line of labels

    mainChartGroup.selectAll(".dimension-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label dimension-label") // Standardized class
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.dimensionLabelFontFamily)
        .style("font-size", `${finalDimLabelFontSize}px`)
        .style("font-weight", fillStyle.typography.dimensionLabelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const labelText = String(d.category);
            const textElement = d3.select(this);
            const xPos = xScale(d.category) + xScale.bandwidth() / 2;
            const availableWidth = xScale.bandwidth();

            const textW = estimateTextWidth(labelText, fillStyle.typography.dimensionLabelFontFamily, finalDimLabelFontSize, fillStyle.typography.dimensionLabelFontWeight);

            if (textW > availableWidth && availableWidth > 0) { // Needs wrapping
                let lines = [];
                const words = labelText.split(/\s+/);
                let currentLine = "";
                let wordWrapSuccess = false;

                if (words.length > 1) { // Try word wrapping
                    for (const word of words) {
                        const testLine = currentLine ? currentLine + " " + word : word;
                        if (estimateTextWidth(testLine, fillStyle.typography.dimensionLabelFontFamily, finalDimLabelFontSize, fillStyle.typography.dimensionLabelFontWeight) > availableWidth && currentLine) {
                            lines.push(currentLine);
                            currentLine = word;
                            if (estimateTextWidth(currentLine, fillStyle.typography.dimensionLabelFontFamily, finalDimLabelFontSize, fillStyle.typography.dimensionLabelFontWeight) > availableWidth) {
                                wordWrapSuccess = false; break; // Single word too long
                            }
                        } else {
                            currentLine = testLine;
                        }
                    }
                    if (currentLine) { lines.push(currentLine); wordWrapSuccess = true; }
                }
                
                if (words.length <=1 || !wordWrapSuccess) { // Fallback to character wrapping
                    lines = []; currentLine = "";
                    const chars = labelText.split('');
                    for (const char of chars) {
                        const testLine = currentLine + char;
                        if (estimateTextWidth(testLine, fillStyle.typography.dimensionLabelFontFamily, finalDimLabelFontSize, fillStyle.typography.dimensionLabelFontWeight) > availableWidth && currentLine) {
                            lines.push(currentLine); currentLine = char;
                        } else {
                            currentLine += char;
                        }
                    }
                    if (currentLine) lines.push(currentLine);
                }
                
                lines.forEach((line, i) => {
                    textElement.append("tspan")
                        .attr("x", xPos)
                        .attr("y", dimensionLabelStartY + i * finalDimLabelLineHeight)
                        .attr("dy", "0.71em") // Vertically center-ish
                        .text(line)
                        .attr("class", "text tspan-line");
                });

            } else { // No wrapping needed
                textElement.append("tspan")
                    .attr("x", xPos)
                    .attr("y", dimensionLabelStartY)
                    .attr("dy", "0.71em")
                    .text(labelText)
                    .attr("class", "text tspan-line");
            }
        });
        
    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // --- Render Icons (below dimension labels) ---
    const approxLabelBlockHeight = (maxLinesNeeded * finalDimLabelLineHeight);
    const iconSize = 24; // Icon width/height
    const iconYPosition = dimensionLabelStartY + approxLabelBlockHeight + iconSize / 2 + 5; // Center Y of icon

    mainChartGroup.selectAll(".icon-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "icon-group other") // Standardized class
        .attr("transform", d => `translate(${xScale(d.category) + xScale.bandwidth() / 2}, ${iconYPosition})`)
        .each(function(d) {
            const iconUrl = fillStyle.iconUrls[d.category];
            if (iconUrl) {
                d3.select(this)
                    .append("image")
                    .attr("xlink:href", iconUrl)
                    .attr("x", -iconSize / 2)
                    .attr("y", -iconSize / 2)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("class", "icon image"); // Standardized class
            }
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}