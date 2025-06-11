/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Dot Chart",
  "chart_name": "grouped_dot_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": ["x"],
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
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Prioritize data.colors, fallback to data.colors_dark
    const images = data.images || { field: {}, other: {} };
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === "x"); // Y-axis category field in this chart context
    const yFieldCol = dataColumns.find(col => col.role === "y"); // X-axis numerical value field
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    const dimensionField = xFieldCol ? xFieldCol.name : undefined;
    const valueField = yFieldCol ? yFieldCol.name : undefined;
    const groupField = groupFieldCol ? groupFieldCol.name : undefined;

    if (!dimensionField || !valueField || !groupField) {
        let missingFields = [];
        if (!dimensionField) missingFields.push("x role (dimensionField)");
        if (!valueField) missingFields.push("y role (valueField)");
        if (!groupField) missingFields.push("group role (groupField)");
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        axisTextColor: rawColors.text_color || '#333333',
        legendTextColor: rawColors.text_color || '#333333',
        gridLineColor: (rawColors.other && rawColors.other.grid) || '#AAAAAA', // Assuming 'grid' might be in 'other'
        defaultCategoryColor: (rawColors.other && rawColors.other.primary) || '#CCCCCC',
        chartBackground: rawColors.background_color || '#FFFFFF', // Not used to fill SVG, but available
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.position = 'absolute'; // Avoid layout shifts if it were appended
        // tempSvg.style.visibility = 'hidden';
        // tempSvg.style.width = '0px';
        // tempSvg.style.height = '0px';

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // As per prompt, MUST NOT append to DOM. This might lead to inaccuracies.
        // document.body.appendChild(tempSvg); 
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on unattached elements
            const approxCharWidth = parseFloat(fontSize) * 0.6; // Very rough estimate
            width = text.length * approxCharWidth;
        }
        // document.body.removeChild(tempSvg);
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
            }
        }
        if (currentLine) lines.push(currentLine);
        // Handle case where a single character is wider than maxWidth (though rare with typical text)
        return lines.map(line => estimateTextWidth(line, fontFamily, fontSize, fontWeight) > maxWidth ? line.substring(0,1) : line).filter(l => l);
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
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root") // Added a class for the root
        .attr("xmlns", "http://www.w3.org/2000/svg");
        // No viewBox, width/height are absolute.

    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = { top: 75, right: 20, bottom: 70, left: 20 }; // Initial margins

    const tempMaxValue = d3.max(chartData, d => +d[valueField]) || 0;
    const tempXScaleForTicks = d3.scaleLinear().domain([0, tempMaxValue]).nice();
    const xAxisTicks = tempXScaleForTicks.ticks(5);

    let maxXAxisLabelHeight = 0;
    if (xAxisTicks.length > 0) {
        maxXAxisLabelHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.2;
    }
    chartMargins.bottom = Math.max(chartMargins.bottom, maxXAxisLabelHeight + 15 + parseFloat(fillStyle.typography.labelFontSize) * 1.5); // +15 for padding, + label height for title

    let maxXAxisTickLabelWidth = 0;
    if (xAxisTicks.length > 0) {
        xAxisTicks.forEach(tick => {
            const formattedTickText = formatLargeNumber(tick);
            const textWidth = estimateTextWidth(formattedTickText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            maxXAxisTickLabelWidth = Math.max(maxXAxisTickLabelWidth, textWidth);
        });
    }
    chartMargins.right = Math.max(chartMargins.right, (maxXAxisTickLabelWidth / 2) + 10);

    const uniqueDimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const iconPadding = 5;
    const estIconSize = (containerHeight / Math.max(15, uniqueDimensions.length)) * 0.4; // Estimate icon size based on available height and number of items
    
    let maxYAxisLabelWidth = 0;
    const yLabelsInfo = {};
    const maxYAxisLabelSpace = containerWidth * 0.25;
    const minFontSize = 8;
    const baseFontSize = parseFloat(fillStyle.typography.labelFontSize);

    uniqueDimensions.forEach(dim => {
        const iconUrl = images.field && images.field[dim] ? images.field[dim] : null;
        const iconSpace = iconUrl ? estIconSize + iconPadding : 0;
        
        let labelWidth = estimateTextWidth(dim, fillStyle.typography.labelFontFamily, `${baseFontSize}px`, fillStyle.typography.labelFontWeight);
        let currentFontSize = baseFontSize;
        let lines = [dim];
        let needsWrap = false;

        if (labelWidth > (maxYAxisLabelSpace - iconSpace)) {
            const scaleFactor = Math.max(0.7, (maxYAxisLabelSpace - iconSpace) / labelWidth);
            const adjustedFontSize = Math.max(minFontSize, baseFontSize * scaleFactor);
            currentFontSize = adjustedFontSize;

            if (adjustedFontSize < baseFontSize * 0.85 && dim.includes(" ")) { // Prefer wrapping if significant shrink and spaces exist
                needsWrap = true;
                lines = wrapText(dim, maxYAxisLabelSpace - iconSpace, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                let maxLineWidth = 0;
                lines.forEach(line => maxLineWidth = Math.max(maxLineWidth, estimateTextWidth(line, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight)));
                labelWidth = maxLineWidth;
            } else { // Just shrink or if no spaces / wrapText didn't help much
                 labelWidth = estimateTextWidth(dim, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                 if (labelWidth > maxYAxisLabelSpace - iconSpace) { // If still too wide, attempt character break
                    needsWrap = true; // Potentially multi-line from breakLongWord
                    lines = breakLongWord(dim, maxYAxisLabelSpace - iconSpace, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                    let maxLineWidth = 0;
                    lines.forEach(line => maxLineWidth = Math.max(maxLineWidth, estimateTextWidth(line, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight)));
                    labelWidth = maxLineWidth;
                 } else {
                    lines = [dim]; // Single line after shrinking
                 }
            }
        }
        
        yLabelsInfo[dim] = { fontSize: currentFontSize, lines: lines, needsWrap: needsWrap || lines.length > 1, iconUrl: iconUrl };
        maxYAxisLabelWidth = Math.max(maxYAxisLabelWidth, iconSpace + labelWidth);
    });
    chartMargins.left = Math.max(chartMargins.left, maxYAxisLabelWidth + 20) - 30; // Original -30 adjustment kept

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMessage = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Cannot render.";
        console.error(errorMessage, {innerWidth, innerHeight, chartMargins, containerWidth, containerHeight});
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage} Review container size and margins.</div>`);
        return null;
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group"); // Added class


    // Block 5: Data Preprocessing & Transformation
    const groups = [...new Set(chartData.map(d => d[groupField]))];

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(uniqueDimensions)
        .range([0, innerHeight])
        .padding(0.1);

    const xScale = d3.scaleLinear()
        .domain(tempXScaleForTicks.domain())
        .range([0, innerWidth]);

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => 
            (rawColors.field && rawColors.field[group]) || 
            (rawColors.available_colors ? rawColors.available_colors[i % rawColors.available_colors.length] : d3.schemeCategory10[i % d3.schemeCategory10.length])
        ).map(color => color || fillStyle.defaultCategoryColor));


    const pointRadius = Math.max(3, Math.min(yScale.bandwidth() * 0.25, 10));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .ticks(5)
            .tickFormat(d => formatLargeNumber(d))
            .tickSizeOuter(0))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").remove())
        .call(g => g.selectAll(".tick text")
            .attr("class", "text")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.axisTextColor));

    mainChartGroup.append("text")
        .attr("class", "label x-axis-title")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + chartMargins.bottom / 2 + parseFloat(fillStyle.typography.labelFontSize) * 0.5) // Adjusted y position
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", "bold") // Titles often bold
        .style("fill", fillStyle.axisTextColor)
        .text(yFieldCol.label || valueField);

    const gridGroup = mainChartGroup.append("g").attr("class", "grid");
    const yTopGrid = uniqueDimensions.length > 0 ? yScale(uniqueDimensions[0]) + yScale.bandwidth() / 2 : 0;
    const yBottomGrid = uniqueDimensions.length > 0 ? yScale(uniqueDimensions[uniqueDimensions.length - 1]) + yScale.bandwidth() / 2 : innerHeight;

    gridGroup.append("g")
        .attr("class", "vertical-grid")
        .selectAll("line")
        .data(xScale.ticks(5))
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", yTopGrid - 5)
        .attr("y2", yBottomGrid + 5)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-opacity", 0.7);

    gridGroup.append("g")
        .attr("class", "horizontal-grid")
        .selectAll("line")
        .data(uniqueDimensions)
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("y2", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-opacity", 0.7);

    const yAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis y-axis");
    uniqueDimensions.forEach(dim => {
        const yPos = yScale(dim) + yScale.bandwidth() / 2;
        const labelInfo = yLabelsInfo[dim];
        const lineHeight = parseFloat(labelInfo.fontSize) * 1.2;
        const totalTextHeight = lineHeight * labelInfo.lines.length;
        
        let currentX = -5; // Start position for text (right aligned)
        if (labelInfo.iconUrl) {
            yAxisLabelsGroup.append("image")
                .attr("class", "icon y-axis-icon")
                .attr("xlink:href", labelInfo.iconUrl)
                .attr("x", -(estIconSize + iconPadding + maxYAxisLabelWidth - (estIconSize + iconPadding))) // Position icon to the left
                .attr("y", yPos - estIconSize / 2)
                .attr("width", estIconSize)
                .attr("height", estIconSize);
            currentX = -(estIconSize + iconPadding + 5); // Adjust text position if icon present
        }
        
        const labelTextGroup = yAxisLabelsGroup.append("g").attr("class", "label-group");
        const startY = yPos - (totalTextHeight / 2) + (lineHeight / 2) - (lineHeight * 0.15); // Adjusted for better middle align

        labelInfo.lines.forEach((line, i) => {
            labelTextGroup.append("text")
                .attr("class", "label y-axis-label-line")
                .attr("x", currentX)
                .attr("y", startY + (i * lineHeight))
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${labelInfo.fontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.axisTextColor)
                .text(line);
        });
    });

    // Legend
    const legendFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const legendFontWeight = fillStyle.typography.labelFontWeight;
    const legendFontFamily = fillStyle.typography.labelFontFamily;
    const legendItemPadding = 5;
    const legendColumnPadding = 15;
    const legendRowPadding = 10;
    const legendMarkRadius = pointRadius * 1.2;

    if (groups.length > 0) {
        const legendTitleText = groupFieldCol.label || groupField;
        let legendItems = groups.map(g => ({
            group: g,
            textWidth: estimateTextWidth(g, legendFontFamily, `${legendFontSize}px`, legendFontWeight),
            itemWidth: (legendMarkRadius * 2) + legendItemPadding + estimateTextWidth(g, legendFontFamily, `${legendFontSize}px`, legendFontWeight)
        }));

        let totalLegendWidth = legendItems.reduce((sum, item) => sum + item.itemWidth, 0) + (legendItems.length - 1) * legendColumnPadding;
        const maxLegendWidth = innerWidth * 0.9;
        let numRows = 1;
        if (totalLegendWidth > maxLegendWidth) {
            numRows = Math.ceil(totalLegendWidth / maxLegendWidth);
            // Simple row distribution, could be smarter
        }
        
        const itemsPerRow = Math.ceil(legendItems.length / numRows);
        const legendRowsData = [];
        for (let i = 0; i < numRows; i++) {
            legendRowsData.push(legendItems.slice(i * itemsPerRow, (i + 1) * itemsPerRow));
        }

        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(0, ${chartMargins.top / 2})`); // Position legend in top margin

        // Legend Title (left aligned with Y-axis labels)
        const legendTitleX = chartMargins.left - 10; // Align with Y-axis labels
        const legendTitleY = 0; // Vertically center with first row of legend (approx)
        
        legendGroup.append("text")
            .attr("class", "label legend-title")
            .attr("x", legendTitleX)
            .attr("y", legendTitleY + legendMarkRadius) // Align with middle of first row marks
            .attr("text-anchor", "end")
            .style("font-family", legendFontFamily)
            .style("font-size", `${legendFontSize}px`)
            .style("font-weight", "bold")
            .style("fill", fillStyle.legendTextColor)
            .text(legendTitleText);

        let currentY = 0;
        legendRowsData.forEach((rowItems, rowIndex) => {
            const rowWidth = rowItems.reduce((sum, item) => sum + item.itemWidth, 0) + (rowItems.length - 1) * legendColumnPadding;
            let currentX = chartMargins.left + (innerWidth - rowWidth) / 2; // Center row
            
            const rowGroup = legendGroup.append("g")
                .attr("transform", `translate(${currentX}, ${currentY})`);

            rowItems.forEach(item => {
                const itemGroup = rowGroup.append("g").attr("transform", `translate(0, 0)`);
                itemGroup.append("circle")
                    .attr("class", "mark legend-mark")
                    .attr("cx", legendMarkRadius)
                    .attr("cy", legendMarkRadius)
                    .attr("r", legendMarkRadius)
                    .attr("fill", colorScale(item.group));
                
                itemGroup.append("text")
                    .attr("class", "text legend-text")
                    .attr("x", legendMarkRadius * 2 + legendItemPadding)
                    .attr("y", legendMarkRadius)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "start")
                    .style("font-family", legendFontFamily)
                    .style("font-size", `${legendFontSize}px`)
                    .style("font-weight", legendFontWeight)
                    .style("fill", fillStyle.legendTextColor)
                    .text(item.group);
                
                currentX += item.itemWidth + legendColumnPadding;
                // For actual positioning in SVG, translate the itemGroup instead of incrementing currentX here for items in the same row
                itemGroup.attr("transform", `translate(${currentX - (chartMargins.left + (innerWidth - rowWidth) / 2) - (item.itemWidth + legendColumnPadding)}, 0)`);
            });
            currentY += legendMarkRadius * 2 + legendRowPadding;
        });
    }


    // Block 8: Main Data Visualization Rendering
    mainChartGroup.append("g")
        .attr("class", "data-points-group")
        .selectAll("circle")
        .data(chartData)
        .enter()
        .append("circle")
        .attr("class", "mark data-point")
        .attr("cx", d => xScale(+d[valueField]))
        .attr("cy", d => yScale(d[dimensionField]) + yScale.bandwidth() / 2)
        .attr("r", pointRadius)
        .attr("fill", d => colorScale(d[groupField]));

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable for this chart's current requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}