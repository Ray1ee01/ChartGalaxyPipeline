/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Dot Chart",
  "chart_name": "grouped_dot_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": ["group"],
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
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xCol = dataColumns.find(col => col.role === "x");
    const yCol = dataColumns.find(col => col.role === "y");
    const groupCol = dataColumns.find(col => col.role === "group");

    let missingFields = [];
    if (!xCol) missingFields.push("x role");
    if (!yCol) missingFields.push("y role");
    if (!groupCol) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: Column(s) with ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionField = xCol.name; // Y-axis category field in original logic
    const valueField = yCol.name;     // X-axis numerical field in original logic
    const groupField = groupCol.name;   // Grouping field

    if (!dimensionField || !valueField || !groupField) {
        const errorMsg = `Critical chart config missing: Field names for roles x, y, or group are undefined. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) || '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF', // Not used directly on SVG, but available
        gridLineColor: rawColors.other && rawColors.other.grid || '#e0e0e0',
        axisLineColor: rawColors.other && rawColors.other.axis || '#888888', // For potential future use
        defaultPlotMarkerColor: '#cccccc',
        primaryAccent: (rawColors.other && rawColors.other.primary) || '#1f77b4',
    };

    const _tempSvgForTextMeasurement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // _tempSvgForTextMeasurement.style.visibility = 'hidden'; // Not strictly needed if not appended
    // _tempSvgForTextMeasurement.style.position = 'absolute'; // Not strictly needed if not appended

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        _tempSvgForTextMeasurement.appendChild(textEl);
        // No need to append _tempSvgForTextMeasurement to DOM
        const width = textEl.getBBox().width;
        _tempSvgForTextMeasurement.removeChild(textEl); // Clean up
        return width;
    }
    
    function formatLargeNumber(value) {
        if (value === null || value === undefined || isNaN(value)) return '0';
        const sign = value < 0 ? '-' : '';
        const absValue = Math.abs(value);
        if (absValue >= 1e9) return sign + (absValue / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
        if (absValue >= 1e6) return sign + (absValue / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (absValue >= 1e3) return sign + (absValue / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
        if (absValue < 1 && absValue > 0) return sign + absValue.toFixed(Math.min(3, (absValue.toString().split('.')[1] || '').length)).replace(/\.?0+$/, '');
        return sign + absValue.toString();
    }

    function wrapTextHelper(text, maxWidth, fontFamily, fontSize, fontWeight) {
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

    function breakLongWordHelper(word, maxWidth, fontFamily, fontSize, fontWeight) {
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
                // This might need adjustment if a single char can exceed maxWidth significantly
                if (estimateTextWidth(currentLine, fontFamily, fontSize, fontWeight) > maxWidth && currentLine.length > 0) {
                    lines.push(currentLine); // Push the char that was too wide
                    currentLine = ''; // Reset
                }
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
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
        .style("background-color", fillStyle.chartBackground);


    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = { top: 75, right: 30, bottom: 50, left: 30 }; // Initial margins

    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];

    // Calculate Y-axis label space (margin.left)
    const yAxisLabelPadding = 10;
    const yAxisIconSize = parseFloat(fillStyle.typography.labelFontSize) * 1.2;
    const yAxisIconPadding = 5;
    let maxYAxisLabelWidth = 0;
    const maxYAxisLabelAllowedSpace = containerWidth * 0.25; // Max 25% of width for Y labels
    const yLabelsInfo = {};

    dimensions.forEach(dim => {
        const hasIcon = rawImages.field && rawImages.field[dim];
        const iconSpace = hasIcon ? yAxisIconSize + yAxisIconPadding : 0;
        let currentFontSize = parseFloat(fillStyle.typography.labelFontSize);
        let labelText = dim.toString();
        let lines = [labelText];
        let textBlockWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);

        if (textBlockWidth > (maxYAxisLabelAllowedSpace - iconSpace)) {
            // Try to scale down font
            const scaleFactor = Math.max(0.7, (maxYAxisLabelAllowedSpace - iconSpace) / textBlockWidth);
            const adjustedFontSize = Math.max(parseFloat(fillStyle.typography.annotationFontSize), currentFontSize * scaleFactor); // Min is annotation size
            
            if (adjustedFontSize < currentFontSize * 0.85) { // If significant reduction or needs wrapping
                currentFontSize = adjustedFontSize;
                // Try wrapping with new font size
                lines = wrapTextHelper(labelText, maxYAxisLabelAllowedSpace - iconSpace, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                if (lines.length === 1 && estimateTextWidth(lines[0], fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) > maxYAxisLabelAllowedSpace - iconSpace) {
                    lines = breakLongWordHelper(lines[0], maxYAxisLabelAllowedSpace - iconSpace, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                }
            } else {
                 // Just scaling was enough, or it fits
                 currentFontSize = adjustedFontSize;
                 lines = [labelText]; // Re-evaluate with potentially scaled font
            }
        }
        
        let maxLineWidthForDim = 0;
        lines.forEach(line => {
            maxLineWidthForDim = Math.max(maxLineWidthForDim, estimateTextWidth(line, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight));
        });

        yLabelsInfo[dim] = { fontSize: currentFontSize, lines: lines };
        maxYAxisLabelWidth = Math.max(maxYAxisLabelWidth, maxLineWidthForDim + iconSpace);
    });
    chartMargins.left = Math.max(chartMargins.left, maxYAxisLabelWidth + yAxisLabelPadding);

    // Calculate X-axis label space (margin.bottom)
    const xAxisLabelHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.2; // For tick labels
    const xAxisTitleHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.5; // For axis title
    chartMargins.bottom = Math.max(chartMargins.bottom, xAxisLabelHeight + xAxisTitleHeight + 10);

    // Calculate legend space (margin.top)
    const legendItemHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.5;
    const legendIconSize = parseFloat(fillStyle.typography.labelFontSize) * 1.2;
    const legendTitleHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.5; // Assuming same size as item for simplicity
    // Simplified: Assume max 2 rows for legend + title
    chartMargins.top = Math.max(chartMargins.top, legendTitleHeight + (groups.length > 0 ? (legendItemHeight * 2 + 10) : 0) + 15);


    let innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    let innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Adjust margin.right for last X-axis tick label
    if (innerWidth > 0 && chartData.length > 0) {
        const tempMaxValue = d3.max(chartData, d => +d[valueField]) || 0;
        const tempXScaleForTicks = d3.scaleLinear().domain([0, tempMaxValue]).range([0, innerWidth]).nice();
        const lastTickValue = tempXScaleForTicks.ticks(5).pop();
        if (lastTickValue !== undefined) {
            const lastTickText = formatLargeNumber(lastTickValue);
            const lastTickWidth = estimateTextWidth(lastTickText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            chartMargins.right = Math.max(chartMargins.right, lastTickWidth / 2 + 5);
            innerWidth = containerWidth - chartMargins.left - chartMargins.right; // Recalculate
        }
    }
    
    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Cannot render. Check container size and margins.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    // `dimensions` and `groups` already extracted in Block 4.
    // `chartData` is already the array of data points.

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.2);

    const maxValue = d3.max(chartData, d => +d[valueField]) || 0;
    const xScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, innerWidth])
        .nice();

    const groupColorScale = (groupValue) => {
        if (rawColors.field && rawColors.field[groupValue]) {
            return rawColors.field[groupValue];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            const index = groups.indexOf(groupValue);
            return rawColors.available_colors[index % rawColors.available_colors.length];
        }
        const index = groups.indexOf(groupValue);
        return d3.schemeCategory10[index % 10];
    };
    
    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)

    // X-axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    xAxisGroup.call(d3.axisBottom(xScale)
        .ticks(Math.max(2, Math.min(5, Math.floor(innerWidth / 80)))) // Responsive ticks
        .tickFormat(d => formatLargeNumber(d))
        .tickSizeOuter(0))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").remove())
        .call(g => g.selectAll(".tick text")
            .attr("class", "label")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor));

    mainChartGroup.append("text")
        .attr("class", "axis-title x-axis-title label")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + chartMargins.bottom - (parseFloat(fillStyle.typography.labelFontSize)/2)) // Adjusted y
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", "bold") // Axis titles are often bold
        .style("fill", fillStyle.textColor)
        .text(valueField);

    // Y-axis Labels (custom)
    const yAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis custom-y-axis-labels");

    dimensions.forEach(dim => {
        const yPos = yScale(dim) + yScale.bandwidth() / 2;
        const labelInfo = yLabelsInfo[dim];
        const iconUrl = rawImages.field && rawImages.field[dim];
        
        let currentX = -yAxisLabelPadding; // Start from padding edge, anchor end

        if (iconUrl) {
            yAxisLabelsGroup.append("image")
                .attr("class", "icon y-axis-label-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", currentX - (labelInfo.lines.reduce((max, l) => Math.max(max, estimateTextWidth(l, fillStyle.typography.labelFontFamily, `${labelInfo.fontSize}px`, fillStyle.typography.labelFontWeight)), 0)) - yAxisIconSize - yAxisIconPadding)
                .attr("y", yPos - yAxisIconSize / 2)
                .attr("width", yAxisIconSize)
                .attr("height", yAxisIconSize);
        }
        
        const textBlock = yAxisLabelsGroup.append("text")
            .attr("class", "label y-axis-label-text")
            .attr("x", currentX)
            .attr("y", yPos)
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${labelInfo.fontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor);

        if (labelInfo.lines.length > 1) {
            const lineHeight = labelInfo.fontSize * 1.2;
            const totalTextHeight = lineHeight * labelInfo.lines.length;
            const startYOffset = -(totalTextHeight / 2) + (lineHeight / 2); // Center block
            labelInfo.lines.forEach((line, i) => {
                textBlock.append("tspan")
                    .attr("x", currentX)
                    .attr("dy", (i === 0 ? startYOffset : lineHeight)) // dy for subsequent lines
                    .text(line);
            });
        } else {
            textBlock.attr("dy", "0.35em") // Vertical center single line
                     .text(labelInfo.lines[0]);
        }
    });

    // Gridlines
    const gridGroup = mainChartGroup.append("g").attr("class", "grid");

    // Vertical gridlines
    gridGroup.selectAll("line.vertical-gridline")
        .data(xScale.ticks(Math.max(2, Math.min(5, Math.floor(innerWidth / 80)))))
        .enter().append("line")
        .attr("class", "gridline vertical-gridline")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-dasharray", "2,2");

    // Horizontal gridlines
    gridGroup.selectAll("line.horizontal-gridline")
        .data(dimensions)
        .enter().append("line")
        .attr("class", "gridline horizontal-gridline")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("y2", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-dasharray", "2,2");

    // Legend
    if (groups.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend chart-legend");
        
        const legendTitleText = groupField;
        const legendTitleWidth = estimateTextWidth(legendTitleText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, "bold");

        const legendItems = groups.map(g => {
            const textWidth = estimateTextWidth(g, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            return {
                group: g,
                iconUrl: rawImages.field && rawImages.field[g],
                color: groupColorScale(g),
                width: legendIconSize + 5 + textWidth // icon + padding + text
            };
        });

        const legendPadding = 10;
        const maxLegendWidthPerRow = innerWidth - legendPadding * 2;
        let legendRows = [[]];
        let currentRowWidth = 0;

        legendItems.forEach(item => {
            if (currentRowWidth + item.width + (legendRows[legendRows.length -1].length > 0 ? legendPadding : 0) > maxLegendWidthPerRow && legendRows[legendRows.length -1].length > 0) {
                legendRows.push([]);
                currentRowWidth = 0;
            }
            legendRows[legendRows.length - 1].push(item);
            currentRowWidth += item.width + (legendRows[legendRows.length -1].length > 1 ? legendPadding : 0);
        });
        
        if (legendRows.length > 2) { // Max 2 rows, truncate if more
            legendRows = legendRows.slice(0,2);
            // Potentially add "..." if truncated, but keeping it simple for now
        }

        const legendRowHeight = legendIconSize * 1.5;
        const legendTotalHeight = legendRows.length * legendRowHeight + (legendRows.length - 1) * (legendPadding / 2) + legendTitleHeight;
        const legendYStart = (chartMargins.top - legendTotalHeight) / 2; // Center in top margin

        legendGroup.attr("transform", `translate(${chartMargins.left}, ${legendYStart})`);

        legendGroup.append("text")
            .attr("class", "legend-title label")
            .attr("x", 0) 
            .attr("y", 0)
            .attr("dy", "0.35em") // Vertically center title text
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold")
            .style("fill", fillStyle.textColor)
            .text(legendTitleText);

        let currentYOffset = legendTitleHeight;

        legendRows.forEach((row, rowIndex) => {
            const totalRowWidth = row.reduce((sum, item) => sum + item.width, 0) + (row.length - 1) * legendPadding;
            let currentXOffset = (innerWidth - totalRowWidth) / 2; // Center row
            if (rowIndex === 0) currentXOffset = Math.max(currentXOffset, legendTitleWidth + legendPadding); // Ensure title doesn't overlap first item

            const rowGroup = legendGroup.append("g")
                .attr("transform", `translate(0, ${currentYOffset + rowIndex * (legendRowHeight + legendPadding / 2)})`);

            row.forEach(item => {
                const itemGroup = rowGroup.append("g")
                    .attr("transform", `translate(${currentXOffset}, 0)`);

                if (item.iconUrl) {
                    itemGroup.append("image")
                        .attr("class", "mark image legend-item-icon")
                        .attr("xlink:href", item.iconUrl)
                        .attr("x", 0)
                        .attr("y", (legendRowHeight - legendIconSize) / 2 - legendIconSize/2) // Center icon vertically
                        .attr("width", legendIconSize)
                        .attr("height", legendIconSize);
                } else {
                    itemGroup.append("circle")
                        .attr("class", "mark value legend-item-marker")
                        .attr("cx", legendIconSize / 2)
                        .attr("cy", (legendRowHeight - legendIconSize) / 2) // Center icon vertically
                        .attr("r", legendIconSize / 2)
                        .style("fill", item.color);
                }

                itemGroup.append("text")
                    .attr("class", "label legend-item-text")
                    .attr("x", legendIconSize + 5)
                    .attr("y", legendRowHeight / 2) // Center text vertically in row
                    .attr("dy", "0.35em")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(item.group);
                
                currentXOffset += item.width + legendPadding;
            });
        });
    }

    // Block 8: Main Data Visualization Rendering
    const plotMarkerSize = Math.min(yScale.bandwidth() * 0.7, Math.max(16, parseFloat(fillStyle.typography.labelFontSize) * 1.5 )); // Responsive but with min/max

    const dataPointsGroup = mainChartGroup.append("g")
        .attr("class", "data-points");

    dataPointsGroup.selectAll("g.datapoint")
        .data(chartData)
        .enter()
        .append("g")
        .attr("class", d => `datapoint mark group-${d[groupField].toString().replace(/\s+/g, '-').toLowerCase()}`)
        .attr("transform", d => `translate(${xScale(+d[valueField])}, ${yScale(d[dimensionField]) + yScale.bandwidth() / 2})`)
        .each(function(d) {
            const pointGroup = d3.select(this);
            const groupValue = d[groupField];
            const iconUrl = rawImages.field && rawImages.field[groupValue];

            if (iconUrl) {
                pointGroup.append("image")
                    .attr("class", "image data-icon")
                    .attr("xlink:href", iconUrl)
                    .attr("x", -plotMarkerSize / 2)
                    .attr("y", -plotMarkerSize / 2)
                    .attr("width", plotMarkerSize)
                    .attr("height", plotMarkerSize);
            } else {
                pointGroup.append("circle")
                    .attr("class", "value data-marker")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", plotMarkerSize / 2)
                    .style("fill", groupColorScale(groupValue));
            }
        });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects, gradients, shadows as per requirements.

    // Block 10: Cleanup & SVG Node Return
    // Cleanup of _tempSvgForTextMeasurement is done within estimateTextWidth
    return svgRoot.node();
}