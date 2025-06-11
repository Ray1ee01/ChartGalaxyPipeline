/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Bar Chart",
  "chart_name": "vertical_grouped_bar_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
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
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || {};
    const inputImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const groupColumn = dataColumns.find(col => col.role === "group");

    const xField = xColumn ? xColumn.name : undefined;
    const yField = yColumn ? yColumn.name : undefined;
    const groupField = groupColumn ? groupColumn.name : undefined;

    if (!xField || !yField || !groupField) {
        const missingFields = [];
        if (!xField) missingFields.push("xField (role:x)");
        if (!yField) missingFields.push("yField (role:y)");
        if (!groupField) missingFields.push("groupField (role:group)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xUnit = xColumn && xColumn.unit !== "none" ? (xColumn.unit || "") : "";
    const yUnit = yColumn && yColumn.unit !== "none" ? (yColumn.unit || "") : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: {},
    };

    fillStyle.typography.titleFontFamily = inputTypography.title && inputTypography.title.font_family ? inputTypography.title.font_family : 'Arial, sans-serif';
    fillStyle.typography.titleFontSize = inputTypography.title && inputTypography.title.font_size ? inputTypography.title.font_size : '16px';
    fillStyle.typography.titleFontWeight = inputTypography.title && inputTypography.title.font_weight ? inputTypography.title.font_weight : 'bold';

    fillStyle.typography.labelFontFamily = inputTypography.label && inputTypography.label.font_family ? inputTypography.label.font_family : 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = inputTypography.label && inputTypography.label.font_size ? inputTypography.label.font_size : '12px';
    fillStyle.typography.labelFontWeight = inputTypography.label && inputTypography.label.font_weight ? inputTypography.label.font_weight : 'normal';
    
    // Annotation font style (though not explicitly used in original for chart elements, define for completeness)
    fillStyle.typography.annotationFontFamily = inputTypography.annotation && inputTypography.annotation.font_family ? inputTypography.annotation.font_family : 'Arial, sans-serif';
    fillStyle.typography.annotationFontSize = inputTypography.annotation && inputTypography.annotation.font_size ? inputTypography.annotation.font_size : '10px';
    fillStyle.typography.annotationFontWeight = inputTypography.annotation && inputTypography.annotation.font_weight ? inputTypography.annotation.font_weight : 'normal';


    fillStyle.textColor = inputColors.text_color || '#333333';
    fillStyle.chartBackground = inputColors.background_color || '#FFFFFF'; // Not used directly if background="no"

    // Group colors will be resolved later when group names are known.
    // Store available colors and field-specific colors if provided.
    fillStyle.colorFieldMappings = inputColors.field || {};
    fillStyle.availableColors = inputColors.available_colors || ['#4269d0', '#ff725c', '#2ca02c', '#d62728', '#9467bd']; // Default categorical
    fillStyle.primaryColor = inputColors.other && inputColors.other.primary ? inputColors.other.primary : '#4682B4';

    fillStyle.images.fieldMappings = inputImages.field || {};
    fillStyle.images.otherPrimary = inputImages.other && inputImages.other.primary ? inputImages.other.primary : null;


    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = d3.create("svg"); // In-memory SVG
        const tempText = tempSvg.append("text")
            .style("font-family", fontFamily)
            .style("font-size", fontSize)
            .style("font-weight", fontWeight)
            .text(text);
        const width = tempText.node().getBBox().width;
        tempSvg.remove(); // Clean up the in-memory element
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    function wrapText(textElement, textContent, maxWidth, lineHeightEm) {
        textElement.text(null); // Clear existing content

        const words = textContent.split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const x = textElement.attr("x"); // Keep original x
        const initialY = parseFloat(textElement.attr("y")); // Keep original y for single line reference
        
        let tspansContent = [];

        if (words.length === 1 && words[0] === textContent) { // Single word or no spaces
            const chars = textContent.split('');
            let currentLine = '';
            for (let i = 0; i < chars.length; i++) {
                const testLine = currentLine + chars[i];
                if (estimateTextWidth(testLine, textElement.style("font-family"), textElement.style("font-size"), textElement.style("font-weight")) > maxWidth && currentLine.length > 0) {
                    tspansContent.push(currentLine);
                    currentLine = chars[i];
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) tspansContent.push(currentLine);
        } else { // Multiple words
            let currentLineWords = [];
            while (word = words.pop()) {
                currentLineWords.push(word);
                if (estimateTextWidth(currentLineWords.join(" "), textElement.style("font-family"), textElement.style("font-size"), textElement.style("font-weight")) > maxWidth) {
                    if (currentLineWords.length > 1) {
                        currentLineWords.pop(); // Remove last word
                        tspansContent.push(currentLineWords.join(" "));
                        currentLineWords = [word]; // Start new line with the popped word
                    } else { // Single word is too long
                        tspansContent.push(currentLineWords.join(" "));
                        currentLineWords = [];
                    }
                }
            }
            if (currentLineWords.length > 0) tspansContent.push(currentLineWords.join(" "));
        }
        
        const totalLines = tspansContent.length;
        const yAdjust = initialY - (lineHeightEm * (totalLines - 1) / 2) * parseFloat(textElement.style("font-size"));

        tspansContent.forEach((lineText, i) => {
            textElement.append("tspan")
                .attr("x", x)
                .attr("y", yAdjust) // Use adjusted y for vertical centering
                .attr("dy", `${i * lineHeightEm}em`)
                .text(lineText);
        });
         // Return total height for measurement if needed, though getBBox on parent text is better
        return totalLines * lineHeightEm * parseFloat(textElement.style("font-size"));
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Apply background to SVG root

    // No defs for shadows or gradients needed per simplification rules.

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 100, right: 30, bottom: 80, left: 30 };
    // Adjust bottom margin if icons are present and potentially tall
    // This dynamic adjustment is complex; for now, use fixed margin and rely on text wrapping/scaling.

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartData;

    const xValues = [...new Set(chartDataArray.map(d => d[xField]))];
    const groupValues = [...new Set(chartDataArray.map(d => d[groupField]))];

    if (groupValues.length !== 2) {
        console.warn(`This chart expects exactly 2 groups, but found ${groupValues.length}. Using first two or available.`);
        // Ensure groupValues has two, even if by taking first two or duplicating if only one.
        // For this refactor, assume valid data (2 groups) as per requirements_range.
    }
    const leftBarGroup = groupValues[0];
    const rightBarGroup = groupValues[1];

    // Resolve group colors
    fillStyle.leftBarColor = (fillStyle.colorFieldMappings && fillStyle.colorFieldMappings[leftBarGroup]) || 
                             (fillStyle.availableColors[0]) || 
                             fillStyle.primaryColor;
    fillStyle.rightBarColor = (fillStyle.colorFieldMappings && fillStyle.colorFieldMappings[rightBarGroup]) || 
                              (fillStyle.availableColors[1]) || 
                              fillStyle.primaryColor;


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.2); // Space between x-categories

    // Calculate bar width based on original logic:
    // Two bars per x-category, with a specific padding logic.
    // Original: groupScale.domain([0,1]).padding(0.2) -> barWidth = (xScale.bandwidth()/2) * 0.8
    const barWidthPerGroup = (xScale.bandwidth() / 2) * 0.8; // Each bar is 40% of xScale.bandwidth()
    const gapBetweenBarsInGroup = xScale.bandwidth() * 0.1; // Explicit 10% gap

    const dataMax = d3.max(chartDataArray, d => +d[yField]) || 100;
    const yScale = d3.scaleLinear()
        .domain([0, dataMax])
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    mainChartGroup.append("line")
        .attr("class", "axis x-axis-line")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.textColor)
        .attr("stroke-width", 2);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    const labelMaxWidth = xScale.bandwidth() * 1.3; // Max width for an x-axis label
    const longestXLabel = xValues.reduce((a, b) => String(a).length > String(b).length ? String(a) : String(b), "");
    
    let baseLabelFontSize = parseInt(fillStyle.typography.labelFontSize);
    if (longestXLabel) { // Ensure there's a label to measure
        const estimatedLongestWidth = estimateTextWidth(longestXLabel, fillStyle.typography.labelFontFamily, `${baseLabelFontSize}px`, fillStyle.typography.labelFontWeight);
        if (estimatedLongestWidth > labelMaxWidth) {
            baseLabelFontSize = Math.max(8, Math.floor(baseLabelFontSize * (labelMaxWidth / estimatedLongestWidth)));
        }
    }
    const uniformXLabelFontSize = `${baseLabelFontSize}px`;

    xAxisGroup.selectAll(".x-label")
        .data(xValues)
        .enter()
        .append("text")
        .attr("class", "label x-label")
        .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
        .attr("y", 20) // Initial y before potential wrapping
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", uniformXLabelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d)
        .each(function(d) {
            const textNode = d3.select(this);
            // Check if wrapping is needed even with adjusted uniform font size
            if (estimateTextWidth(String(d), fillStyle.typography.labelFontFamily, uniformXLabelFontSize, fillStyle.typography.labelFontWeight) > labelMaxWidth) {
                 wrapText(textNode, String(d), labelMaxWidth, 1.1); // 1.1em line height
            }
        });

    // Legend
    const legendData = [
        { key: leftBarGroup, color: fillStyle.leftBarColor },
        { key: rightBarGroup, color: fillStyle.rightBarColor }
    ];

    const legendItemHeight = 15;
    const legendItemGap = 10; // Gap between color swatch and text
    const legendInterItemSpacing = 20; // Gap between legend items

    let legendTotalWidth = 0;
    const legendItemWidths = legendData.map(item => {
        const textWidth = estimateTextWidth(item.key, fillStyle.typography.labelFontFamily, "12px", fillStyle.typography.labelFontWeight);
        const itemWidth = legendItemHeight + legendItemGap + textWidth;
        legendTotalWidth += itemWidth;
        return itemWidth;
    });
    legendTotalWidth += (legendData.length - 1) * legendInterItemSpacing;

    const legendGroup = svgRoot.append("g") // Append to svgRoot, not mainChartGroup
        .attr("class", "legend")
        .attr("transform", `translate(${(containerWidth - legendTotalWidth) / 2}, 30)`); // Position relative to containerWidth

    let currentLegendX = 0;
    legendData.forEach((item, i) => {
        const singleLegendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, 0)`);

        singleLegendItem.append("rect")
            .attr("class", "mark legend-color-swatch")
            .attr("width", legendItemHeight)
            .attr("height", legendItemHeight)
            .attr("fill", item.color);

        singleLegendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendItemHeight + legendItemGap)
            .attr("y", legendItemHeight / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", "12px") // Fixed size for legend text as per original
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(item.key);
        
        currentLegendX += legendItemWidths[i] + legendInterItemSpacing;
    });
    
    // Calculate position for icons (Block 9 will render them)
    let maxLabelBottomYInChartSpace = chartMargins.top + innerHeight + 20; // Default Y for icons
    const xLabelNodes = xAxisGroup.selectAll(".x-label").nodes();
    if (xLabelNodes.length > 0) {
        let maxLabelRelativeBottomY = 0;
        xLabelNodes.forEach(node => {
            const bbox = node.getBBox();
            maxLabelRelativeBottomY = Math.max(maxLabelRelativeBottomY, bbox.y + bbox.height);
        });
        maxLabelBottomYInChartSpace = chartMargins.top + innerHeight + maxLabelRelativeBottomY;
    }
    const iconYPosition = maxLabelBottomYInChartSpace + 5; // Y position for top of icons in svgRoot coordinates


    // Block 8: Main Data Visualization Rendering
    xValues.forEach(xValue => {
        const xCategoryData = chartDataArray.filter(d => d[xField] === xValue);
        const leftDataPoint = xCategoryData.find(d => d[groupField] === leftBarGroup);
        const rightDataPoint = xCategoryData.find(d => d[groupField] === rightBarGroup);

        const xPosForXCategory = xScale(xValue);
        
        // Left Bar
        if (leftDataPoint) {
            const yValue = +leftDataPoint[yField];
            if (yValue > 0) { // Only render if value is positive
                const barHeight = innerHeight - yScale(yValue);
                const barY = yScale(yValue);
                const triangleHeight = Math.min(30, Math.max(10, barWidthPerGroup));
                const actualTriangleHeight = Math.min(triangleHeight, barHeight);

                const barPath = `M ${xPosForXCategory} ${innerHeight} ` + // Bottom-left
                              `L ${xPosForXCategory} ${barY + actualTriangleHeight} ` + // Top-left of rect part
                              `L ${xPosForXCategory + barWidthPerGroup / 2} ${barY} ` + // Triangle peak
                              `L ${xPosForXCategory + barWidthPerGroup} ${barY + actualTriangleHeight} ` + // Top-right of rect part
                              `L ${xPosForXCategory + barWidthPerGroup} ${innerHeight} Z`; // Bottom-right and close

                mainChartGroup.append("path")
                    .attr("class", "mark bar left-bar")
                    .attr("d", barPath)
                    .attr("fill", fillStyle.leftBarColor);

                // Bar Label
                const labelText = formatValue(yValue) + (yUnit ? ` ${yUnit}` : '');
                let barLabelFontSizePx = parseInt(fillStyle.typography.labelFontSize);
                const maxLabelWidth = barWidthPerGroup * 1.1;
                let estimatedWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, `${barLabelFontSizePx}px`, "bold");
                
                if (estimatedWidth > maxLabelWidth) {
                    barLabelFontSizePx = Math.max(4, Math.floor(barLabelFontSizePx * (maxLabelWidth / estimatedWidth)));
                }

                mainChartGroup.append("text")
                    .attr("class", "label data-label")
                    .attr("x", xPosForXCategory + barWidthPerGroup / 2)
                    .attr("y", barY - 5)
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", `${barLabelFontSizePx}px`)
                    .style("font-weight", "bold") // As per original
                    .style("fill", fillStyle.textColor)
                    .text(labelText);
            }
        }

        // Right Bar
        if (rightDataPoint) {
            const yValue = +rightDataPoint[yField];
            if (yValue > 0) {
                const barX = xPosForXCategory + barWidthPerGroup + gapBetweenBarsInGroup;
                const barHeight = innerHeight - yScale(yValue);
                const barY = yScale(yValue);
                const triangleHeight = Math.min(30, Math.max(10, barWidthPerGroup));
                const actualTriangleHeight = Math.min(triangleHeight, barHeight);

                const barPath = `M ${barX} ${innerHeight} ` +
                              `L ${barX} ${barY + actualTriangleHeight} ` +
                              `L ${barX + barWidthPerGroup / 2} ${barY} ` +
                              `L ${barX + barWidthPerGroup} ${barY + actualTriangleHeight} ` +
                              `L ${barX + barWidthPerGroup} ${innerHeight} Z`;

                mainChartGroup.append("path")
                    .attr("class", "mark bar right-bar")
                    .attr("d", barPath)
                    .attr("fill", fillStyle.rightBarColor);
                
                // Bar Label
                const labelText = formatValue(yValue) + (yUnit ? ` ${yUnit}` : '');
                let barLabelFontSizePx = parseInt(fillStyle.typography.labelFontSize);
                const maxLabelWidth = barWidthPerGroup * 1.1;
                let estimatedWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, `${barLabelFontSizePx}px`, "bold");

                if (estimatedWidth > maxLabelWidth) {
                    barLabelFontSizePx = Math.max(4, Math.floor(barLabelFontSizePx * (maxLabelWidth / estimatedWidth)));
                }

                mainChartGroup.append("text")
                    .attr("class", "label data-label")
                    .attr("x", barX + barWidthPerGroup / 2)
                    .attr("y", barY - 5)
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", `${barLabelFontSizePx}px`)
                    .style("font-weight", "bold")
                    .style("fill", fillStyle.textColor)
                    .text(labelText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    const iconSize = Math.min(xScale.bandwidth() * 0.3, 30); // Icon size relative to x-category width, max 30px
    
    xValues.forEach(xValue => {
        const iconUrl = fillStyle.images.fieldMappings[xValue] || null;
        if (iconUrl) {
            // Icons are appended to svgRoot, so use absolute coordinates
            const iconX = chartMargins.left + xScale(xValue) + xScale.bandwidth() / 2 - iconSize / 2;
            svgRoot.append("image") // Append to svgRoot, not mainChartGroup or xAxisGroup
                .attr("class", "icon category-icon")
                .attr("x", iconX)
                .attr("y", iconYPosition) // Calculated based on label bottom
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}