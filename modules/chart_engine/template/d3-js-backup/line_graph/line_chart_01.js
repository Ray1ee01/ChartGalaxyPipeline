/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 300,
  "min_width": 300,
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || data.colors_dark || {}; // Assuming dark theme uses same structure
    const inputImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xColumn ? xColumn.name : undefined;
    const valueFieldName = yColumn ? yColumn.name : undefined;
    const valueFieldUnit = (yColumn && yColumn.unit && yColumn.unit !== "none") ? yColumn.unit : "";

    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: categoryFieldName or valueFieldName could not be derived from dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Critical chart configuration missing (roles 'x' or 'y' not found in data columns). Chart cannot be rendered.</div>");
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (inputTypography.title && inputTypography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (inputTypography.title && inputTypography.title.font_size) || '16px',
            titleFontWeight: (inputTypography.title && inputTypography.title.font_weight) || 'bold',
            labelFontFamily: (inputTypography.label && inputTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (inputTypography.label && inputTypography.label.font_size) || '12px',
            labelFontWeight: (inputTypography.label && inputTypography.label.font_weight) || 'normal',
            annotationFontFamily: (inputTypography.annotation && inputTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (inputTypography.annotation && inputTypography.annotation.font_size) || '10px',
            annotationFontWeight: (inputTypography.annotation && inputTypography.annotation.font_weight) || 'normal', // Prompt default is normal
        },
        barPrimary: (inputColors.other && inputColors.other.primary) || '#1f77b4',
        textColor: inputColors.text_color || '#333333',
        chartBackground: inputColors.background_color || '#FFFFFF',
        iconUrls: inputImages.field || {}
    };

    function estimateTextWidth(text, fontProps) {
        if (!text || !fontProps) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.position = 'absolute'; // Ensure it doesn't affect layout if accidentally visible
        // tempSvg.style.visibility = 'hidden';
        // document.body.appendChild(tempSvg); // Required by some browsers for getBBox to work correctly

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.font_family || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontProps.font_size || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontProps.font_weight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        
        // Per directive, MUST NOT append to DOM. This might limit accuracy or fail in some browsers.
        // If issues arise, appending to a hidden element in DOM is more robust.
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) {
            // console.warn("getBBox failed for in-memory SVG, text width estimation might be inaccurate.", e);
            // Fallback for environments where getBBox on non-DOM elements fails (e.g. jsdom)
            // This is a very rough estimate.
            const fontSizePx = parseFloat(fontProps.font_size || fillStyle.typography.labelFontSize);
            width = text.length * fontSizePx * 0.6; 
        }
        // tempSvg.remove(); // If it was appended
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 30, bottom: 120, left: 60 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure value is numeric
    })).sort((a, b) => b.value - a.value); // Sort descending by value

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(chartDataArray.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2);

    const yMax = d3.max(chartDataArray, d => d.value);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax * 1.1 : 10]) // Add 10% padding, or use 10 if max is 0
        .range([innerHeight, 0]);

    // Pre-calculate X-axis label font size and max lines
    const baseLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const minLabelFontSize = 8;
    const barWidth = xScale.bandwidth();
    let finalXLabelFontSize = baseLabelFontSize;
    let maxLinesNeeded = 1;

    if (barWidth > 0) {
        let maxShrinkRatio = 1;
        chartDataArray.forEach(d => {
            const labelText = String(d.category);
            const textWidth = estimateTextWidth(labelText, { 
                font_family: fillStyle.typography.labelFontFamily, 
                font_size: `${baseLabelFontSize}px`, 
                font_weight: fillStyle.typography.labelFontWeight 
            });
            if (textWidth > barWidth) {
                maxShrinkRatio = Math.max(maxShrinkRatio, textWidth / barWidth);
            }
        });
        if (maxShrinkRatio > 1) {
            finalXLabelFontSize = Math.max(minLabelFontSize, Math.floor(baseLabelFontSize / maxShrinkRatio));
        }

        chartDataArray.forEach(d => {
            const labelText = String(d.category);
            const currentFontProps = { 
                font_family: fillStyle.typography.labelFontFamily, 
                font_size: `${finalXLabelFontSize}px`, 
                font_weight: fillStyle.typography.labelFontWeight 
            };
            const textWidth = estimateTextWidth(labelText, currentFontProps);
            
            if (textWidth > barWidth) {
                let lines = 1;
                const words = labelText.split(/\s+/);
                let currentLine = "";
                if (words.length > 1) { // Try word wrapping
                    let tempLine = "";
                    for (const word of words) {
                        const testLine = tempLine ? tempLine + " " + word : word;
                        if (estimateTextWidth(testLine, currentFontProps) > barWidth && tempLine) {
                            lines++;
                            tempLine = word;
                        } else {
                            tempLine = testLine;
                        }
                    }
                    currentLine = tempLine; // last line
                }
                
                // If word wrapping didn't work well or single long word, try char wrapping
                if (lines === 1 && estimateTextWidth(currentLine || labelText, currentFontProps) > barWidth) { 
                    lines = 0; // reset for char wrapping
                    let tempCharLine = "";
                    for (const char of labelText) {
                        const testCharLine = tempCharLine + char;
                        if (estimateTextWidth(testCharLine, currentFontProps) > barWidth && tempCharLine) {
                            lines++;
                            tempCharLine = char;
                        } else {
                            tempCharLine = testCharLine;
                        }
                    }
                    if (tempCharLine) lines++; // last char line
                }
                maxLinesNeeded = Math.max(maxLinesNeeded, lines || 1);
            }
        });
    }
    
    const xLabelLineHeight = finalXLabelFontSize * 1.2;
    const xLabelBlockStartY = innerHeight + 15; // Start Y pos for first line of X labels
    const xLabelBlockHeight = maxLinesNeeded * xLabelLineHeight;
    
    const iconSize = 24;
    const iconRadius = iconSize / 2;
    const iconGroupYPosition = xLabelBlockStartY + xLabelBlockHeight + iconRadius + 5; // Center of icon
    
    const barBottomEdgeY = iconGroupYPosition + iconRadius + 5; // Y-coord where bar bottoms should align

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No formal axes are rendered in this chart as per original design and simplification.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar-mark")
        .data(chartDataArray)
        .enter()
        .append("rect")
        .attr("class", "mark bar-mark")
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => Math.max(0, barBottomEdgeY - yScale(d.value)))
        .attr("fill", fillStyle.barPrimary);

    // Value labels (annotations)
    const baseAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    const minAnnotationFontSize = 6;

    mainChartGroup.selectAll(".value-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label value-label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const valueText = (typeof d.value === 'number' ? d.value.toFixed(1) : String(d.value)) + valueFieldUnit;
            const maxWidth = xScale.bandwidth() * 1.1;
            let finalValueFontSize = baseAnnotationFontSize;
            const fontProps = {
                font_family: fillStyle.typography.annotationFontFamily,
                font_size: `${baseAnnotationFontSize}px`,
                font_weight: fillStyle.typography.annotationFontWeight
            };

            if (maxWidth > 0) {
                const textWidth = estimateTextWidth(valueText, fontProps);
                if (textWidth > maxWidth && textWidth > 0) { // textWidth > 0 to avoid division by zero
                    finalValueFontSize = Math.max(minAnnotationFontSize, Math.floor(baseAnnotationFontSize * (maxWidth / textWidth)));
                }
            }
            d3.select(this)
                .style("font-size", `${finalValueFontSize}px`)
                .text(valueText);
        });

    // Dimension labels (X-axis labels)
    mainChartGroup.selectAll(".x-axis-label-group")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label x-axis-label")
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", `${finalXLabelFontSize}px`)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const labelText = String(d.category);
            const textElement = d3.select(this);
            const xPos = xScale(d.category) + xScale.bandwidth() / 2;
            const currentFontProps = { 
                font_family: fillStyle.typography.labelFontFamily, 
                font_size: `${finalXLabelFontSize}px`, 
                font_weight: fillStyle.typography.labelFontWeight 
            };

            const textWidth = estimateTextWidth(labelText, currentFontProps);

            if (textWidth > barWidth && barWidth > 0) { // Needs wrapping
                let lines = [];
                const words = labelText.split(/\s+/);
                let currentLine = "";

                if (words.length > 1) { // Try word wrapping
                    for (const word of words) {
                        const testLine = currentLine ? currentLine + " " + word : word;
                        if (estimateTextWidth(testLine, currentFontProps) > barWidth && currentLine) {
                            lines.push(currentLine);
                            currentLine = word;
                        } else {
                            currentLine = testLine;
                        }
                    }
                }
                if (currentLine || (!lines.length && words.length === 1)) { // Push last line or single word
                     if (estimateTextWidth(currentLine || labelText, currentFontProps) > barWidth && (currentLine || labelText).length > 1) { // Single word still too long, needs char wrap
                        if (lines.length > 0) lines.push(currentLine); // push the word that was too long if it was part of multi-word
                        else lines = []; // reset for pure char wrap
                        
                        let charLine = "";
                        const sourceForCharWrap = lines.length > 0 ? lines.pop() : labelText; // char wrap the last problematic word or whole text

                        for (const char of sourceForCharWrap) {
                            const testCharLine = charLine + char;
                            if (estimateTextWidth(testCharLine, currentFontProps) > barWidth && charLine) {
                                lines.push(charLine);
                                charLine = char;
                            } else {
                                charLine = testCharLine;
                            }
                        }
                        if (charLine) lines.push(charLine);

                     } else {
                        lines.push(currentLine || labelText);
                     }
                }


                lines.forEach((line, i) => {
                    textElement.append("tspan")
                        .attr("x", xPos)
                        .attr("y", xLabelBlockStartY + i * xLabelLineHeight)
                        .attr("dy", "0.71em") // Adjust baseline
                        .text(line);
                });

            } else { // No wrapping needed
                textElement.append("tspan")
                   .attr("x", xPos)
                   .attr("y", xLabelBlockStartY)
                   .attr("dy", "0.71em")
                   .text(labelText);
            }
        });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    const iconGroups = mainChartGroup.selectAll(".icon-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "icon icon-group")
        .attr("transform", d => `translate(${xScale(d.category) + xScale.bandwidth() / 2}, ${iconGroupYPosition})`);

    iconGroups.each(function(d) {
        const iconUrl = fillStyle.iconUrls[d.category];
        if (iconUrl) {
            d3.select(this)
                .append("image")
                .attr("class", "image icon-image")
                .attr("xlink:href", iconUrl)
                .attr("x", -iconRadius)
                .attr("y", -iconRadius)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}