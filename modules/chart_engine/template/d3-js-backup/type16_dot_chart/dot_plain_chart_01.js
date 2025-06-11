/* REQUIREMENTS_BEGIN
{
  "chart_type": "Dot Chart",
  "chart_name": "dot_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "prominent",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Could be data.colors_dark for dark themes, assuming light for now
    const images = data.images || {}; // Extracted, but not used in this simplified chart
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name; // Y-axis in original logic
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;    // X-axis in original logic
    const groupFieldName = (dataColumns.find(col => col.role === "group") || {}).name;

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        const missingFields = [
            !categoryFieldName ? "x (category)" : null,
            !valueFieldName ? "y (value)" : null,
            !groupFieldName ? "group" : null
        ].filter(Boolean).join(", ");

        console.error(`Critical chart config missing: Field roles for ${missingFields} not found in dataColumns. Cannot render.`);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: Critical chart configuration missing for fields: ${missingFields}. Chart cannot be rendered.</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colors.text_color || '#333333',
        gridLineColor: (colors.other && colors.other.gridLine) || '#AAAAAA',
        axisLineColor: (colors.other && colors.other.axisLine) || '#333333', // Not used for domain line, but for ticks if any
        chartBackground: colors.background_color || '#FFFFFF', // Not directly used on SVG, but good to have
        defaultPointColor: (colors.other && colors.other.primary) || '#1f77b4',
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
        }
    };
    
    // In-memory text measurement utility
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // Position off-screen to be absolutely sure it's not visible, though not strictly necessary for unattached SVG
        svg.style.position = 'absolute';
        svg.style.left = '-9999px';
        svg.style.top = '-9999px';

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // No need to append svg to document body
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on unattached elements (e.g. JSDOM older versions)
            const size = parseFloat(fontSize) || 12;
            width = text.length * (size * 0.6); // Rough estimate
        }
        return width;
    }

    function wrapText(text, maxWidth, fontFamily, fontSize, fontWeight) {
        if (!text) return [];
        const words = text.toString().split(/\s+/).filter(d => d.length > 0);
        if (words.length === 0) return [];
        
        const lines = [];
        let currentLine = words[0];
        
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = estimateTextWidth(currentLine + " " + word, fontFamily, fontSize, fontWeight);
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }
    
    function breakLongWord(word, maxWidth, fontFamily, fontSize, fontWeight) {
        if (!word) return [];
        const characters = word.split('');
        const lines = [];
        let currentLine = '';
        
        for (let char of characters) {
            const testLine = currentLine + char;
            const width = estimateTextWidth(testLine, fontFamily, fontSize, fontWeight);
            if (width < maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = char; 
                // If single char itself is too wide, it will be pushed in the next iteration or at the end
                if (estimateTextWidth(currentLine, fontFamily, fontSize, fontWeight) > maxWidth) {
                    lines.push(currentLine); // Push the char that's too wide
                    currentLine = ''; // Reset for next char
                }
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
    }

    function formatLargeNumber(value) {
        if (value === null || value === undefined || isNaN(value)) return '0';
        const sign = value < 0 ? '-' : '';
        const absValue = Math.abs(value);
        if (absValue >= 1e9) return sign + (absValue / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
        if (absValue >= 1e6) return sign + (absValue / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (absValue >= 1e3) return sign + (absValue / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
        if (absValue < 1 && absValue > 0) return sign + absValue.toFixed(3).replace(/\.?0+$/, '');
        return sign + absValue.toString();
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Optional: set background on SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = { top: 75, right: 20, bottom: 50, left: 20 }; // Initial margins

    const tempXScaleForTicks = d3.scaleLinear().domain([0, d3.max(chartDataArray, d => +d[valueFieldName]) || 0]).nice();
    const xAxisTicks = tempXScaleForTicks.ticks(5);
    
    let maxXAxisLabelHeight = 0;
    if (xAxisTicks.length > 0) {
        maxXAxisLabelHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.2; // Approx height
    }
    chartMargins.bottom = Math.max(chartMargins.bottom, maxXAxisLabelHeight + 15); // 15 for padding

    let maxXAxisLabelWidth = 0;
    if (xAxisTicks.length > 0) {
        xAxisTicks.forEach(tick => {
            const textWidth = estimateTextWidth(
                formatLargeNumber(tick), 
                fillStyle.typography.labelFontFamily, 
                fillStyle.typography.labelFontSize, 
                fillStyle.typography.labelFontWeight
            );
            maxXAxisLabelWidth = Math.max(maxXAxisLabelWidth, textWidth);
        });
    }
    chartMargins.right = Math.max(chartMargins.right, (maxXAxisLabelWidth / 2) + 10);

    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    let maxYAxisLabelWidth = 0;
    const yAxisLabelPadding = 10; // Space between label and axis line (or chart edge)
    const maxYAxisLabelAllowedSpace = containerWidth * 0.25; // Max 25% of chart width for Y labels
    const yLabelsInfo = {};

    categories.forEach(cat => {
        const baseFontSize = parseFloat(fillStyle.typography.labelFontSize);
        const minFontSize = 8;
        let currentFontSize = baseFontSize;
        let lines = [cat.toString()];
        let needsWrap = false;

        let labelWidth = estimateTextWidth(cat.toString(), fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);

        if (labelWidth > maxYAxisLabelAllowedSpace) {
            // Try reducing font size
            const scaleFactor = Math.max(0.7, maxYAxisLabelAllowedSpace / labelWidth);
            currentFontSize = Math.max(minFontSize, baseFontSize * scaleFactor);
            labelWidth = estimateTextWidth(cat.toString(), fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);

            if (labelWidth > maxYAxisLabelAllowedSpace) { // Still too wide, try wrapping
                needsWrap = true;
                lines = wrapText(cat.toString(), maxYAxisLabelAllowedSpace, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                if (lines.length === 1 && estimateTextWidth(lines[0], fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) > maxYAxisLabelAllowedSpace) {
                    lines = breakLongWord(lines[0], maxYAxisLabelAllowedSpace, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                }
                
                labelWidth = 0; // Recalculate based on wrapped lines
                lines.forEach(line => {
                    labelWidth = Math.max(labelWidth, estimateTextWidth(line, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight));
                });
            }
        }
        
        yLabelsInfo[cat] = { fontSize: currentFontSize, lines: lines, needsWrap: needsWrap };
        maxYAxisLabelWidth = Math.max(maxYAxisLabelWidth, labelWidth);
    });
    chartMargins.left = Math.max(chartMargins.left, maxYAxisLabelWidth + yAxisLabelPadding);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    // `categories` already extracted in Block 4
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerHeight])
        .padding(0.1);

    const xScale = d3.scaleLinear()
        .domain(tempXScaleForTicks.domain()) // Use the 'niced' domain
        .range([0, innerWidth]);

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => 
            (colors.field && colors.field[group]) || 
            (colors.available_colors && colors.available_colors[i % colors.available_colors.length]) || 
            d3.schemeCategory10[i % 10]
        ));
    
    const pointRadius = Math.max(3, Math.min(yScale.bandwidth() * 0.25, 10));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // X-axis (minimal: labels only)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .ticks(5)
            .tickFormat(d => formatLargeNumber(d))
            .tickSizeOuter(0)
            .tickSizeInner(0) // No inner tick lines
        );
    xAxisGroup.select(".domain").remove(); // Remove axis line
    xAxisGroup.selectAll(".tick line").remove(); // Ensure no tick lines
    xAxisGroup.selectAll(".tick text")
        .attr("class", "text label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // Vertical Gridlines
    mainChartGroup.append("g")
        .attr("class", "grid vertical-grid")
        .selectAll("line")
        .data(xScale.ticks(5))
        .enter().append("line")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-opacity", 0.7);

    // Horizontal Gridlines
    mainChartGroup.append("g")
        .attr("class", "grid horizontal-grid")
        .selectAll("line")
        .data(categories)
        .enter().append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("y2", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-opacity", 0.7);

    // Y-axis Labels (custom rendering)
    const yAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis-labels");

    categories.forEach(cat => {
        const yPos = yScale(cat) + yScale.bandwidth() / 2;
        const labelInfo = yLabelsInfo[cat];
        const lineHeight = parseFloat(labelInfo.fontSize) * 1.2;
        const totalTextHeight = lineHeight * labelInfo.lines.length;
        
        const labelX = -yAxisLabelPadding; // Position to the left of the chart area

        if (labelInfo.lines.length > 1) {
            const textGroup = yAxisLabelsGroup.append("g").attr("class", "label-group");
            const startY = yPos - (totalTextHeight / 2) + (lineHeight / 2); // Center multiline text vertically
            labelInfo.lines.forEach((line, i) => {
                textGroup.append("text")
                    .attr("class", "text label")
                    .attr("x", labelX)
                    .attr("y", startY + (i * lineHeight))
                    .attr("text-anchor", "end")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", `${labelInfo.fontSize}px`)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(line);
            });
        } else {
            yAxisLabelsGroup.append("text")
                .attr("class", "text label")
                .attr("x", labelX)
                .attr("y", yPos)
                .attr("dy", "0.35em") // Vertical centering adjustment
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${labelInfo.fontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(cat);
        }
    });

    // Legend
    if (groups.length > 0) {
        const legendInitialFontSize = parseFloat(fillStyle.typography.labelFontSize);
        const legendFontFamily = fillStyle.typography.labelFontFamily;
        const legendFontWeight = fillStyle.typography.labelFontWeight;
        const legendItemPadding = 5;
        const legendColumnPadding = 15;
        const legendRowPadding = 10;
        const legendMinFontSize = 9;
        const legendMarkRadiusBase = pointRadius * 1.2; // Slightly larger than data points

        const legendTitleText = groupFieldName; // Use group field name as title
        const legendTitleFontSize = legendInitialFontSize;
        const legendTitleFontWeight = "bold";

        let legendItemsData = [];
        let totalLegendWidthUnscaled = 0;
        groups.forEach(g => {
            const textWidth = estimateTextWidth(g, legendFontFamily, `${legendInitialFontSize}px`, legendFontWeight);
            const itemWidth = (legendMarkRadiusBase * 2) + legendItemPadding + textWidth;
            legendItemsData.push({ group: g, textWidth: textWidth, itemWidth: itemWidth });
            totalLegendWidthUnscaled += itemWidth + legendColumnPadding;
        });
        totalLegendWidthUnscaled -= legendColumnPadding; // Remove last padding

        let legendLayout = {
            rows: 1,
            itemsPerRow: [],
            rowWidths: [],
            fontSize: legendInitialFontSize,
            markRadius: legendMarkRadiusBase
        };

        const maxAllowedLegendWidth = innerWidth * 0.9; // Max width for legend items area

        if (totalLegendWidthUnscaled > maxAllowedLegendWidth) {
            // Try multi-row or scaling
            let scaleFactor = 1;
            if (totalLegendWidthUnscaled / 2 > maxAllowedLegendWidth) { // If even 2 rows are too wide with original font
                scaleFactor = maxAllowedLegendWidth / (totalLegendWidthUnscaled / 2); // Rough estimate for 2 rows
            }
            
            let newFontSize = Math.max(legendMinFontSize, legendInitialFontSize * scaleFactor);
            if (newFontSize < legendInitialFontSize * 0.85 && legendInitialFontSize > legendMinFontSize + 1) { // Significant reduction
                 legendLayout.fontSize = newFontSize;
                 legendLayout.markRadius = Math.max(legendMarkRadiusBase * 0.7, legendMarkRadiusBase * (newFontSize / legendInitialFontSize));
            } else { // Not much reduction, or already small, prefer multi-row
                 newFontSize = legendInitialFontSize; // Keep original size
            }


            // Recalculate item widths with potentially new font size
            let currentTotalWidth = 0;
            legendItemsData = groups.map(g => {
                const textWidth = estimateTextWidth(g, legendFontFamily, `${legendLayout.fontSize}px`, legendFontWeight);
                const itemWidth = (legendLayout.markRadius * 2) + legendItemPadding + textWidth;
                currentTotalWidth += itemWidth + legendColumnPadding;
                return { group: g, textWidth: textWidth, itemWidth: itemWidth };
            });
            currentTotalWidth -= legendColumnPadding;

            // Determine rows
            if (currentTotalWidth > maxAllowedLegendWidth) {
                legendLayout.rows = Math.ceil(currentTotalWidth / maxAllowedLegendWidth);
                legendLayout.rows = Math.min(legendLayout.rows, 2); // Max 2 rows for simplicity
            }
        }
        
        // Distribute items into rows
        const itemsPerLogicalRow = Math.ceil(legendItemsData.length / legendLayout.rows);
        for (let i = 0; i < legendLayout.rows; i++) {
            const rowItems = legendItemsData.slice(i * itemsPerLogicalRow, (i + 1) * itemsPerLogicalRow);
            legendLayout.itemsPerRow.push(rowItems);
            let currentWidth = 0;
            rowItems.forEach(item => currentWidth += item.itemWidth + legendColumnPadding);
            legendLayout.rowWidths.push(currentWidth - legendColumnPadding);
        }
        
        const legendRowHeight = legendLayout.fontSize * 1.5;
        const totalLegendHeight = (legendLayout.rows * legendRowHeight) + ((legendLayout.rows - 1) * legendRowPadding);
        const legendTitleHeight = legendTitleText ? (legendTitleFontSize * 1.2 + 5) : 0; // 5 for padding below title
        const legendStartY = (chartMargins.top - legendTitleHeight - totalLegendHeight) / 2; // Center in remaining top margin

        const legendContainerGroup = svgRoot.append("g")
            .attr("class", "legend chart-legend")
            .attr("transform", `translate(${chartMargins.left}, ${legendStartY})`);

        let currentLegendY = 0;
        if (legendTitleText) {
            legendContainerGroup.append("text")
                .attr("class", "text legend-title")
                .attr("x", 0) // Align with start of legend items area
                .attr("y", currentLegendY)
                .attr("dy", "0.em") // Align to top
                .attr("text-anchor", "start")
                .style("font-family", legendFontFamily)
                .style("font-size", `${legendTitleFontSize}px`)
                .style("font-weight", legendTitleFontWeight)
                .style("fill", fillStyle.textColor)
                .text(legendTitleText);
            currentLegendY += legendTitleHeight;
        }

        legendLayout.itemsPerRow.forEach((rowItems, rowIndex) => {
            const rowWidth = legendLayout.rowWidths[rowIndex];
            const rowStartX = (innerWidth - rowWidth) / 2; // Center the row
            
            const rowGroup = legendContainerGroup.append("g")
                .attr("class", `legend-row legend-row-${rowIndex}`)
                .attr("transform", `translate(${rowStartX}, ${currentLegendY})`);

            let currentX = 0;
            rowItems.forEach(item => {
                const legendItemGroup = rowGroup.append("g")
                    .attr("class", "legend-item")
                    .attr("transform", `translate(${currentX}, 0)`);

                legendItemGroup.append("circle")
                    .attr("class", "mark legend-mark")
                    .attr("cx", legendLayout.markRadius)
                    .attr("cy", legendRowHeight / 2 - legendLayout.markRadius / 2 ) // Vertically center mark in row height
                    .attr("r", legendLayout.markRadius)
                    .attr("fill", colorScale(item.group));

                legendItemGroup.append("text")
                    .attr("class", "text legend-label")
                    .attr("x", (legendLayout.markRadius * 2) + legendItemPadding)
                    .attr("y", legendRowHeight / 2) // Vertically center text in row height
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "start")
                    .style("font-family", legendFontFamily)
                    .style("font-size", `${legendLayout.fontSize}px`)
                    .style("font-weight", legendFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(item.group);
                
                currentX += item.itemWidth + legendColumnPadding;
            });
            currentLegendY += legendRowHeight + legendRowPadding;
        });
    }


    // Block 8: Main Data Visualization Rendering
    mainChartGroup.append("g")
        .attr("class", "mark data-points") // Changed from scatter-points for consistency
        .selectAll("circle")
        .data(chartDataArray)
        .enter()
        .append("circle")
        .attr("class", "mark data-point") // Individual point class
        .attr("cx", d => xScale(+d[valueFieldName]))
        .attr("cy", d => yScale(d[categoryFieldName]) + yScale.bandwidth() / 2)
        .attr("r", pointRadius)
        .attr("fill", d => colorScale(d[groupFieldName]));

    // Block 9: Optional Enhancements & Post-Processing
    // No main titles or subtitles. X-axis title removed as per interpretation of directive.
    // No complex visual effects, gradients, patterns, shadows.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}