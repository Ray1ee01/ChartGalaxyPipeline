/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Bar Chart",
  "chart_name": "vertical_group_bar_chart_11",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data?.data || [];
    const configVariables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const configDataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldCol = configDataColumns.find(col => col.role === "x");
    const yFieldCol = configDataColumns.find(col => col.role === "y");
    const groupFieldCol = configDataColumns.find(col => col.role === "group");

    const xFieldName = xFieldCol?.name;
    const yFieldName = yFieldCol?.name;
    const groupFieldName = groupFieldCol?.name;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push("x-role field name");
        if (!yFieldName) missingFields.push("y-role field name");
        if (!groupFieldName) missingFields.push("group-role field name");
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldUnit = xFieldCol?.unit === "none" ? "" : (xFieldCol?.unit || "");
    const yFieldUnit = yFieldCol?.unit === "none" ? "" : (yFieldCol?.unit || "");

    // Block 2: Style Configuration & Helper Definitions
    const DEFAULT_TYPOGRAPHY = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const DEFAULT_COLORS = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: d3.schemeCategory10.slice(), // Use a copy
        background_color: "#FFFFFF",
        text_color: "#333333"
    };

    const fillStyle = {
        typography: {
            label: {},
            annotation: {}
        },
        colors: {},
        images: {}
    };

    // Typography tokens
    fillStyle.typography.label.font_family = (rawTypography.label && rawTypography.label.font_family) || DEFAULT_TYPOGRAPHY.label.font_family;
    fillStyle.typography.label.font_size = (rawTypography.label && rawTypography.label.font_size) || DEFAULT_TYPOGRAPHY.label.font_size;
    fillStyle.typography.label.font_weight = (rawTypography.label && rawTypography.label.font_weight) || DEFAULT_TYPOGRAPHY.label.font_weight;
    
    fillStyle.typography.annotation.font_family = (rawTypography.annotation && rawTypography.annotation.font_family) || DEFAULT_TYPOGRAPHY.annotation.font_family;
    fillStyle.typography.annotation.font_size = (rawTypography.annotation && rawTypography.annotation.font_size) || DEFAULT_TYPOGRAPHY.annotation.font_size;
    fillStyle.typography.annotation.font_weight = (rawTypography.annotation && rawTypography.annotation.font_weight) || DEFAULT_TYPOGRAPHY.annotation.font_weight;

    // Color tokens
    fillStyle.colors.textColor = rawColors.text_color || DEFAULT_COLORS.text_color;
    fillStyle.colors.chartBackground = rawColors.background_color || DEFAULT_COLORS.background_color; // Not used for SVG background per spec

    fillStyle.colors.getGroupColor = (groupValue, groupIndex) => {
        const groupColorConfig = (rawColors.field && rawColors.field[groupFieldName]) || rawColors.field || {};
        if (groupColorConfig[groupValue]) {
            return groupColorConfig[groupValue];
        }
        const available = rawColors.available_colors || DEFAULT_COLORS.available_colors;
        return available[groupIndex % available.length];
    };
    
    // Image tokens
    fillStyle.images.getXCategoryIcon = (xCategoryValue) => {
        const iconConfigForXField = (rawImages.field && rawImages.field[xFieldName]) || {};
        if (iconConfigForXField[xCategoryValue]) {
            return iconConfigForXField[xCategoryValue];
        }
        // Fallback to check if xCategoryValue is a direct key in rawImages.field
        if (rawImages.field && rawImages.field[xCategoryValue]) {
            return rawImages.field[xCategoryValue];
        }
        return null;
    };
    
    const MIN_FONT_SIZE = 8; // Minimum font size for dynamic adjustments

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontProps.font_family || fillStyle.typography.label.font_family);
        tempTextElement.setAttribute('font-size', fontProps.font_size || fillStyle.typography.label.font_size);
        tempTextElement.setAttribute('font-weight', fontProps.font_weight || fillStyle.typography.label.font_weight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        try {
            // This might be 0 or inaccurate if the SVG is not in the DOM.
            // For more robust measurement, canvas measureText or temporary DOM append/remove would be needed,
            // but directives restrict DOM append for this helper.
            return tempTextElement.getBBox().width;
        } catch (e) {
            // Basic fallback for environments where getBBox on unattached elements fails (e.g., JSDOM)
            const fontSize = parseFloat(fontProps.font_size || fillStyle.typography.label.font_size);
            const avgCharWidthFactor = 0.6; // Very rough estimate
            return (text || '').length * fontSize * avgCharWidthFactor;
        }
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~.2s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.2s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.2s")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    function wrapText(textSelection, textString, maxWidth, lineHeightFactor, baseFontProps) {
        textSelection.each(function() {
            const textNode = d3.select(this);
            textNode.text(null); // Clear existing text

            const words = textString.split(/\s+/).reverse();
            let word;
            let line = [];
            let tspanY = parseFloat(textNode.attr("y")) || 0; // Use existing y or 0
            let tspanX = parseFloat(textNode.attr("x")) || 0;
            
            let currentLineText = "";
            let lines = [];
            let currentFontProps = { ...baseFontProps }; // Make a copy to potentially modify size

            if (words.length === 1 && words[0] === "") { // Handle empty string
                 textNode.append("tspan").attr("x", tspanX).attr("y", tspanY).text("");
                 textNode.attr("data-lines", 1);
                 return;
            }
            
            // Attempt with words
            let candidateWords = [...words];
            let tempLine = [];
            let wordProcessingDone = false;

            while (word = candidateWords.pop()) {
                tempLine.push(word);
                currentLineText = tempLine.join(" ");
                if (estimateTextWidth(currentLineText, currentFontProps) > maxWidth && tempLine.length > 1) {
                    tempLine.pop(); // remove current word
                    lines.push(tempLine.join(" "));
                    tempLine = [word]; // new line starts with current word
                }
            }
            if (tempLine.length > 0) {
                lines.push(tempLine.join(" "));
            }
            
            // If word-based wrapping resulted in a single line that's too long, or no words (single long token)
            // then try character-based wrapping for that (or each) oversized line.
            let finalLines = [];
            if (lines.length === 0 && words.length > 0 && words[0].length > 0) { // Single very long word
                 lines.push(words[0]);
            }


            for (const l of lines) {
                if (estimateTextWidth(l, currentFontProps) <= maxWidth) {
                    finalLines.push(l);
                } else { // Character wrapping for this line
                    let chars = l.split('');
                    let charLine = "";
                    for (let k=0; k < chars.length; k++) {
                        charLine += chars[k];
                        if (estimateTextWidth(charLine, currentFontProps) > maxWidth && charLine.length > 1) {
                            finalLines.push(charLine.slice(0, -1));
                            charLine = chars[k];
                        }
                    }
                    if (charLine) finalLines.push(charLine);
                }
            }
            lines = finalLines;
            
            const numLines = lines.length || 1;
            textNode.attr("data-lines", numLines);

            // Adjust y for vertical centering if multiple lines
            const initialY = parseFloat(textNode.attr("data-initial-y") || tspanY); // Use a stored initial Y if available
            const fontSize = parseFloat(currentFontProps.font_size);
            const adjustedY = initialY - ( (numLines - 1) * fontSize * lineHeightFactor / 2) ;

            lines.forEach((lineText, i) => {
                textNode.append("tspan")
                    .attr("x", tspanX)
                    .attr("y", adjustedY)
                    .attr("dy", `${i * lineHeightFactor}em`)
                    .text(lineText);
            });
             if (lines.length === 0 && textString) { // If no lines were generated but there was text (e.g. fits)
                textNode.append("tspan").attr("x", tspanX).attr("y", adjustedY).text(textString);
            }
        });
    }
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(configVariables.width) || 800;
    const containerHeight = parseFloat(configVariables.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
        // No viewBox, no responsive width/height attributes

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 100, left: 30 }; // Adjusted top for legend, bottom for labels/icons
    
    const plotWidth = containerWidth - chartMargins.left - chartMargins.right;
    const plotHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const xValues = [...new Set(chartDataArray.map(d => d[xFieldName]))];
    const groupValues = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    if (groupValues.length !== 2) {
        console.warn(`This chart expects exactly 2 groups for field '${groupFieldName}', but found ${groupValues.length}. Visuals might be affected.`);
        // Proceeding with first two groups if more, or one if less.
    }
    const leftBarGroup = groupValues[0];
    const rightBarGroup = groupValues[1]; // Might be undefined if only one group

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, plotWidth])
        .padding(0.2); // Padding between x-categories

    const dataMax = d3.max(chartDataArray, d => +d[yFieldName]) || 100;
    const yScale = d3.scaleLinear()
        .domain([0, dataMax])
        .range([plotHeight, 0]);

    // Bar width and positioning logic (derived from original)
    const barWidthWithinCategory = xScale.bandwidth() * 0.4; // Each bar takes 40% of the category's band width
    const gapBetweenBarsInCategory = xScale.bandwidth() * 0.1; // 10% gap

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${plotHeight})`);

    // X-axis labels
    const xLabelBaseFontSize = parseFloat(fillStyle.typography.label.font_size);
    const xLabelFontProps = {
        font_family: fillStyle.typography.label.font_family,
        font_weight: fillStyle.typography.label.font_weight,
        font_size: `${xLabelBaseFontSize}px`
    };
    const xLabelMaxWidth = xScale.bandwidth(); // Max width for an x-label
    const xLabelLineHeightFactor = 1.1;
    
    // Determine uniform font size for X-axis labels (simplified, not dynamically shrinking like original's calculateFontSize)
    // We will rely on wrapText to handle overflow.
    // If more sophisticated dynamic sizing is needed, it would involve iterative measurement.
    const uniformXLabelFontSize = xLabelBaseFontSize; // Keep it simple, use configured size
    xLabelFontProps.font_size = `${uniformXLabelFontSize}px`;

    xAxisGroup.selectAll(".x-axis-label")
        .data(xValues)
        .enter()
        .append("text")
        .attr("class", "label x-axis-label")
        .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
        .attr("y", 20) // Initial Y offset from axis line
        .attr("data-initial-y", 20) // Store for wrapText centering
        .attr("text-anchor", "middle")
        .style("font-family", xLabelFontProps.font_family)
        .style("font-size", xLabelFontProps.font_size)
        .style("font-weight", xLabelFontProps.font_weight)
        .style("fill", fillStyle.colors.textColor)
        .text(d => d) // Initial text, wrapText will process
        .each(function(d) {
            wrapText(d3.select(this), String(d), xLabelMaxWidth, xLabelLineHeightFactor, xLabelFontProps);
        });

    // Legend
    const legendData = [];
    if (leftBarGroup !== undefined) legendData.push({ key: leftBarGroup, color: fillStyle.colors.getGroupColor(leftBarGroup, groupValues.indexOf(leftBarGroup)) });
    if (rightBarGroup !== undefined && rightBarGroup !== leftBarGroup) legendData.push({ key: rightBarGroup, color: fillStyle.colors.getGroupColor(rightBarGroup, groupValues.indexOf(rightBarGroup)) });

    const legendItemHeight = 15;
    const legendSpacing = 10;
    const legendRectSize = 15;
    let totalLegendWidth = 0;
    const legendItemWidths = legendData.map(item => {
        const textWidth = estimateTextWidth(item.key, {
            font_family: fillStyle.typography.label.font_family,
            font_size: "12px", // Fixed legend font size as per original
            font_weight: fillStyle.typography.label.font_weight
        });
        return legendRectSize + 5 + textWidth; // rect + padding + text
    });
    totalLegendWidth = legendItemWidths.reduce((sum, w) => sum + w, 0) + Math.max(0, legendData.length - 1) * legendSpacing;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2 - legendItemHeight / 2})`); // Centered in top margin

    let currentLegendX = 0;
    legendData.forEach((item, i) => {
        const legendItemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, 0)`);

        legendItemGroup.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", item.color);

        legendItemGroup.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendRectSize + 5)
            .attr("y", legendRectSize / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", "12px") // Fixed legend font size
            .style("font-weight", fillStyle.typography.label.font_weight)
            .style("fill", fillStyle.colors.textColor)
            .text(item.key);
        
        currentLegendX += legendItemWidths[i] + legendSpacing;
    });

    // Block 8: Main Data Visualization Rendering
    xValues.forEach(xCat => {
        const categoryData = chartDataArray.filter(d => d[xFieldName] === xCat);
        const leftDataPoint = categoryData.find(d => d[groupFieldName] === leftBarGroup);
        const rightDataPoint = categoryData.find(d => d[groupFieldName] === rightBarGroup);

        const barBaseX = xScale(xCat);
        const leftBarActualX = barBaseX; // Left bar starts at the beginning of the band
        const rightBarActualX = barBaseX + barWidthWithinCategory + gapBetweenBarsInCategory;

        // Render Left Bar
        if (leftDataPoint) {
            const yValue = +leftDataPoint[yFieldName];
            const barHeight = plotHeight - yScale(yValue);
            const barY = yScale(yValue);

            mainChartGroup.append("rect")
                .attr("class", "mark bar left-bar")
                .attr("x", leftBarActualX)
                .attr("y", barY)
                .attr("width", barWidthWithinCategory)
                .attr("height", Math.max(0, barHeight)) // Ensure non-negative height
                .attr("fill", fillStyle.colors.getGroupColor(leftBarGroup, groupValues.indexOf(leftBarGroup)))
                .attr("rx", barWidthWithinCategory / 2) // Pill shape
                .attr("ry", barWidthWithinCategory / 2);

            const valueText = formatValue(yValue) + (yFieldUnit ? ` ${yFieldUnit}` : '');
            let valueLabelFontSize = parseFloat(fillStyle.typography.label.font_size);
            const valueLabelFontProps = {
                font_family: fillStyle.typography.label.font_family,
                font_weight: "bold", // Value labels are bold
                font_size: `${valueLabelFontSize}px`
            };
            const textWidth = estimateTextWidth(valueText, valueLabelFontProps);
            if (textWidth > barWidthWithinCategory * 1.1) { // Allow slight overflow
                valueLabelFontSize *= (barWidthWithinCategory * 1.1 / textWidth);
                valueLabelFontSize = Math.max(MIN_FONT_SIZE, valueLabelFontSize);
                valueLabelFontProps.font_size = `${valueLabelFontSize}px`;
            }
            mainChartGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", leftBarActualX + barWidthWithinCategory / 2)
                .attr("y", barY - 5) // Position above bar
                .attr("text-anchor", "middle")
                .style("font-family", valueLabelFontProps.font_family)
                .style("font-size", valueLabelFontProps.font_size)
                .style("font-weight", valueLabelFontProps.font_weight)
                .style("fill", fillStyle.colors.textColor)
                .text(valueText);
        }

        // Render Right Bar
        if (rightDataPoint && rightBarGroup !== undefined) {
            const yValue = +rightDataPoint[yFieldName];
            const barHeight = plotHeight - yScale(yValue);
            const barY = yScale(yValue);

            mainChartGroup.append("rect")
                .attr("class", "mark bar right-bar")
                .attr("x", rightBarActualX)
                .attr("y", barY)
                .attr("width", barWidthWithinCategory)
                .attr("height", Math.max(0, barHeight))
                .attr("fill", fillStyle.colors.getGroupColor(rightBarGroup, groupValues.indexOf(rightBarGroup)))
                .attr("rx", barWidthWithinCategory / 2) // Pill shape
                .attr("ry", barWidthWithinCategory / 2);

            const valueText = formatValue(yValue) + (yFieldUnit ? ` ${yFieldUnit}` : '');
            let valueLabelFontSize = parseFloat(fillStyle.typography.label.font_size);
             const valueLabelFontProps = {
                font_family: fillStyle.typography.label.font_family,
                font_weight: "bold",
                font_size: `${valueLabelFontSize}px`
            };
            const textWidth = estimateTextWidth(valueText, valueLabelFontProps);
             if (textWidth > barWidthWithinCategory * 1.1) {
                valueLabelFontSize *= (barWidthWithinCategory * 1.1 / textWidth);
                valueLabelFontSize = Math.max(MIN_FONT_SIZE, valueLabelFontSize);
                valueLabelFontProps.font_size = `${valueLabelFontSize}px`;
            }
            mainChartGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", rightBarActualX + barWidthWithinCategory / 2)
                .attr("y", barY - 5)
                .attr("text-anchor", "middle")
                .style("font-family", valueLabelFontProps.font_family)
                .style("font-size", valueLabelFontProps.font_size)
                .style("font-weight", valueLabelFontProps.font_weight)
                .style("fill", fillStyle.colors.textColor)
                .text(valueText);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons)
    const ICON_SIZE = 30;
    let maxLabelBlockHeight = 0;
    xAxisGroup.selectAll(".x-axis-label").each(function() {
        const numLines = parseInt(d3.select(this).attr("data-lines")) || 1;
        const fontSize = parseFloat(d3.select(this).style("font-size"));
        maxLabelBlockHeight = Math.max(maxLabelBlockHeight, numLines * fontSize * xLabelLineHeightFactor);
    });
    
    const iconYOffsetFromAxis = (parseFloat(xAxisGroup.selectAll(".x-axis-label").attr("y") || 20)) + maxLabelBlockHeight + 5; // y of label + height + padding
    const iconCenterY = iconYOffsetFromAxis + ICON_SIZE / 2;

    xValues.forEach(xCat => {
        const iconUrl = fillStyle.images.getXCategoryIcon(xCat);
        if (iconUrl) {
            xAxisGroup.append("image") // Append to xAxisGroup for correct coordinate system relative to labels
                .attr("class", "icon x-category-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", xScale(xCat) + xScale.bandwidth() / 2 - ICON_SIZE / 2)
                .attr("y", iconCenterY - ICON_SIZE / 2)
                .attr("width", ICON_SIZE)
                .attr("height", ICON_SIZE)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });
    
    // Adjust bottom margin if icons make content overflow
    const requiredBottomSpace = iconCenterY + ICON_SIZE / 2;
    if (chartMargins.bottom < requiredBottomSpace) {
        // This is a bit late for margin adjustment, ideally calculated earlier.
        // For now, it means icons might be clipped if initial margin is too small.
        // console.warn("Bottom margin might be too small for X-axis labels and icons.");
    }


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}