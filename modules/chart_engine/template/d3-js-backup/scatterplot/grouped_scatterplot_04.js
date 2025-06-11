/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Scatterplot",
  "chart_name": "grouped_scatterplot_04",
  "is_composite": false,
  "required_fields": ["x", "y", "y2", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[8, 150], [0, "inf"], [0, "inf"], [2, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or use a theme detector if data.colors_dark is relevant
    const images = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const labelCol = dataColumns.find(col => col.role === "x");
    const xValueCol = dataColumns.find(col => col.role === "y");
    const yValueCol = dataColumns.find(col => col.role === "y2");
    const groupCol = dataColumns.find(col => col.role === "group");

    if (!labelCol || !xValueCol || !yValueCol || !groupCol) {
        const missing = [
            !labelCol ? '"x" role column' : null,
            !xValueCol ? '"y" role column' : null,
            !yValueCol ? '"y2" role column' : null,
            !groupCol ? '"group" role column' : null
        ].filter(Boolean).join(', ');
        const errorMsg = `Critical chart config missing: ${missing}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const labelField = labelCol.name;
    const xValueField = xValueCol.name;
    const yValueField = yValueCol.name;
    const groupField = groupCol.name;
    
    const xValueTitle = xValueCol.title || xValueField;
    const yValueTitle = yValueCol.title || yValueField;


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
        },
        textColor: colors.text_color || '#0F223B',
        chartBackground: colors.background_color || '#FFFFFF',
        axisLineColor: colors.other && colors.other.axis_line ? colors.other.axis_line : 'rgba(0, 0, 0, 0.5)', // Default to semi-transparent black
        gridLineColor: colors.other && colors.other.grid_line ? colors.other.grid_line : 'rgba(200, 200, 200, 0.5)', // Default to semi-transparent gray
        tooltipBackground: colors.other && colors.other.tooltip_background ? colors.other.tooltip_background : 'rgba(255, 255, 255, 0.95)',
        tooltipTextColor: colors.other && colors.other.tooltip_text ? colors.other.tooltip_text : '#0F223B',
        legendBackground: colors.other && colors.other.legend_background ? colors.other.legend_background : 'rgba(255, 255, 255, 0.8)',
        legendBorderColor: colors.other && colors.other.legend_border ? colors.other.legend_border : '#DDDDDD',
    };

    const defaultCategoricalColors = colors.available_colors || d3.schemeCategory10;
    const uniqueGroups = [...new Set(chartData.map(d => d[groupField]))];
    
    fillStyle.getPointColor = (groupValue) => {
        if (colors.field && colors.field[groupField] && colors.field[groupField][groupValue]) {
            return colors.field[groupField][groupValue];
        }
        if (colors.field && colors.field[groupValue]) { // Fallback if groupField mapping is not nested
             return colors.field[groupValue];
        }
        const groupIndex = uniqueGroups.indexOf(groupValue);
        return defaultCategoricalColors[groupIndex % defaultCategoricalColors.length];
    };

    function estimateTextDimensions(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // Appending to body, measuring, and removing is the most reliable way for getBBox.
        // However, strictly adhering to "MUST NOT be appended to the document DOM".
        // This might result in 0,0,0,0 bbox in some environments if the SVG isn't rendered.
        const bbox = textElement.getBBox();
        return { width: bbox.width, height: bbox.height };
    }

    function formatAxisValue(value) {
        if (value > 0 && value < 1) {
            if (value < 0.01) return value.toFixed(3);
            if (value < 0.1) return value.toFixed(2);
            return value.toFixed(1);
        }
        if (Math.abs(value) >= 1000) {
            return d3.format("~s")(value);
        }
        const absValue = Math.abs(value);
        if (absValue === 0) return "0";
        if (absValue >= 100) return value.toFixed(0);
        if (absValue >= 10) return value.toFixed(1);
        return value.toFixed(2);
    }

    function hasNegativeOrZeroValues(data, field) {
        return data.some(d => d[field] <= 0);
    }

    function isDistributionUneven(data, field) {
        const values = data.map(d => d[field]).filter(v => v !== null && v !== undefined && !isNaN(v));
        if (values.length < 2) return false;
        const extent = d3.extent(values);
        const range = extent[1] - extent[0];
        if (range === 0) return false;
        const median = d3.median(values);
        const q1 = d3.quantile(values.sort(d3.ascending), 0.25);
        const q3 = d3.quantile(values.sort(d3.ascending), 0.75);
        const iqr = q3 - q1;
        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1]) / 2) > range * 0.2;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 25, bottom: 60, left: 70 }; // Adjusted left for potentially wider y-axis labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    // (uniqueGroups already calculated in Block 2 for color scale)

    // Block 6: Scale Definition & Configuration
    const xExtent = d3.extent(chartData, d => d[xValueField]);
    const yExtent = d3.extent(chartData, d => d[yValueField]);

    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartData, xValueField);
    const xIsUneven = isDistributionUneven(chartData, xValueField);
    const xScale = (!xHasNegativeOrZero && xIsUneven && xExtent[0] > 0)
        ? d3.scaleLog().domain([Math.max(xExtent[0] * 0.9, 0.01), xExtent[1] * 1.1]).range([0, innerWidth]).clamp(true)
        : d3.scaleLinear().domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1]).range([0, innerWidth]);

    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartData, yValueField);
    const yIsUneven = isDistributionUneven(chartData, yValueField);
    const yScale = (!yHasNegativeOrZero && yIsUneven && yExtent[0] > 0)
        ? d3.scaleLog().domain([Math.max(yExtent[0] * 0.9, 0.01), yExtent[1] * 1.1]).range([innerHeight, 0]).clamp(true)
        : d3.scaleLinear().domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1]).range([innerHeight, 0]);
    
    if (xScale.domain()[0] === xScale.domain()[1]) xScale.domain([xScale.domain()[0] * 0.9 || -1, xScale.domain()[1] * 1.1 || 1]);
    if (yScale.domain()[0] === yScale.domain()[1]) yScale.domain([yScale.domain()[0] * 0.9 || -1, yScale.domain()[1] * 1.1 || 1]);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Gridlines
    const xGridCount = 8;
    const yGridCount = 6;

    function generateGridPositions(scale, count) {
        const scaleDomain = scale.domain();
        const min = scaleDomain[0];
        const max = scaleDomain[1];
        const isLog = typeof scale.base === 'function'; // Check if it's a log scale

        if (isLog) {
            const logMin = Math.log(Math.max(min, 0.001)) / Math.log(scale.base()); // Avoid log(0) or log(negative)
            const logMax = Math.log(Math.max(max, 0.001)) / Math.log(scale.base());
            if (logMin === Infinity || logMin === -Infinity || logMax === Infinity || logMax === -Infinity || isNaN(logMin) || isNaN(logMax)) {
                 return scale.ticks(count); // Fallback for problematic log domains
            }
            const step = (logMax - logMin) / (count > 1 ? count - 1 : 1);
            return Array.from({ length: count }, (_, i) => Math.pow(scale.base(), logMin + step * i));
        } else {
            const step = (max - min) / (count > 1 ? count - 1 : 1);
            return Array.from({ length: count }, (_, i) => min + step * i);
        }
    }
    
    const xGridPositions = generateGridPositions(xScale, xGridCount);
    const yGridPositions = generateGridPositions(yScale, yGridCount);

    mainChartGroup.append("g")
        .attr("class", "grid x-grid")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat("").tickValues(xGridPositions))
        .selectAll("line")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-width", 1.0);
    mainChartGroup.selectAll(".x-grid path").style("stroke", "none");

    mainChartGroup.append("g")
        .attr("class", "grid y-grid")
        .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat("").tickValues(yGridPositions))
        .selectAll("line")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-width", 1.0);
    mainChartGroup.selectAll(".y-grid path").style("stroke", "none");
    mainChartGroup.selectAll(".grid").lower();


    // Axes
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10).tickFormat(formatAxisValue);
    const yAxis = d3.axisLeft(yScale).tickSize(0).tickPadding(10).tickFormat(formatAxisValue);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);
    xAxisGroup.selectAll("path")
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1);
    xAxisGroup.selectAll("text")
        .attr("class", "label axis-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);
    yAxisGroup.selectAll("path")
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1);
    yAxisGroup.selectAll("text")
        .attr("class", "label axis-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);

    // Axis Titles
    if (xValueTitle) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title x-axis-title")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight + chartMargins.bottom - 15)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold") // Axis titles often bold
            .style("fill", fillStyle.textColor)
            .text(xValueTitle);
    }

    if (yValueTitle) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title y-axis-title")
            .attr("transform", "rotate(-90)")
            .attr("x", -innerHeight / 2)
            .attr("y", -chartMargins.left + 20)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold")
            .style("fill", fillStyle.textColor)
            .text(yValueTitle);
    }

    // Legend
    if (uniqueGroups.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend chart-legend");
        
        const legendSquareSize = 10;
        const legendItemPadding = 5;
        const legendColumnPadding = 15;
        const legendTopPadding = 10; // Padding above legend items if title is present

        let legendItemsTotalWidth = 0;
        const legendItemWidths = uniqueGroups.map(group => {
            const textDimensions = estimateTextDimensions(group, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            const itemWidth = legendSquareSize + legendItemPadding + textDimensions.width;
            legendItemsTotalWidth += itemWidth + legendColumnPadding;
            return itemWidth;
        });
        legendItemsTotalWidth -= legendColumnPadding; // Remove last padding

        const legendTitleText = groupCol.title || groupField;
        const legendTitleDimensions = estimateTextDimensions(legendTitleText + ": ", fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, "bold");
        const totalLegendWidthWithTitle = legendTitleDimensions.width + legendItemsTotalWidth + 10; // 10 for spacing after title

        let legendStartX = (containerWidth - totalLegendWidthWithTitle) / 2;
        if (legendStartX < chartMargins.left) legendStartX = chartMargins.left;
        const legendY = chartMargins.top / 2;


        const legendTitle = legendGroup.append("text")
            .attr("class", "label legend-title")
            .attr("x", legendStartX)
            .attr("y", legendY)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize) // Use labelFontSize
            .style("font-weight", "bold")
            .style("fill", fillStyle.textColor)
            .text(legendTitleText + ": ");
        
        legendStartX += legendTitleDimensions.width + 10;

        const legendItemsGroup = legendGroup.append("g")
            .attr("transform", `translate(${legendStartX}, ${legendY})`);
        
        let currentX = 0;
        uniqueGroups.forEach((group, i) => {
            const legendItem = legendItemsGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, 0)`);

            legendItem.append("rect")
                .attr("class", "mark legend-mark")
                .attr("x", 0)
                .attr("y", -legendSquareSize / 2)
                .attr("width", legendSquareSize)
                .attr("height", legendSquareSize)
                .attr("rx", 0) // No rounded corners
                .attr("ry", 0)
                .style("fill", fillStyle.getPointColor(group))
                .style("opacity", 0.8);

            legendItem.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendSquareSize + legendItemPadding)
                .attr("y", 0)
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(group);
            
            currentX += legendItemWidths[i] + legendColumnPadding;
        });
    }


    // Block 8: Main Data Visualization Rendering
    const squareSize = 16;

    function findOptimalPosition(d, allPoints, currentPositions = {}) {
        const positions = [
            { x: 20, y: 4, anchor: "start", priority: 1 }, // right
            { x: 0, y: -20, anchor: "middle", priority: 2 }, // top
            { x: -20, y: 4, anchor: "end", priority: 3 }, // left
            { x: 0, y: 28, anchor: "middle", priority: 4 }, // bottom
            { x: 15, y: -15, anchor: "start", priority: 5 }, // top-right (adjusted from original)
            { x: -15, y: -15, anchor: "end", priority: 6 }, // top-left (adjusted)
            { x: -15, y: 20, anchor: "end", priority: 7 }, // bottom-left (adjusted)
            { x: 15, y: 20, anchor: "start", priority: 8 }  // bottom-right (adjusted)
        ];

        const pointX = xScale(d[xValueField]);
        const pointY = yScale(d[yValueField]);

        if (currentPositions[d[labelField]]) {
            return currentPositions[d[labelField]];
        }

        const textDimensions = estimateTextDimensions(d[labelField], fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        const labelWidth = textDimensions.width;
        const labelHeight = textDimensions.height;

        for (const pos of positions) {
            let hasOverlap = false;
            let labelX1, labelY1, labelX2, labelY2;

            if (pos.anchor === "start") { // right, top-right, bottom-right
                labelX1 = pointX + pos.x;
                labelY1 = pointY + pos.y - labelHeight / 2; // Vertically center roughly
            } else if (pos.anchor === "middle") { // top, bottom
                labelX1 = pointX + pos.x - labelWidth / 2;
                labelY1 = pointY + pos.y - (pos.y < 0 ? labelHeight : 0); // Adjust based on top/bottom
            } else { // end (left, top-left, bottom-left)
                labelX1 = pointX + pos.x - labelWidth;
                labelY1 = pointY + pos.y - labelHeight / 2; // Vertically center roughly
            }
            
            // Adjust y for pure top/bottom to better clear the point
            if (pos.anchor === "middle" && pos.x === 0) { // Pure top or bottom
                 if (pos.y < 0) labelY1 = pointY + pos.y - labelHeight - 2; // top, move fully above
                 else labelY1 = pointY + pos.y + 2; // bottom, move fully below
            }


            labelX2 = labelX1 + labelWidth;
            labelY2 = labelY1 + labelHeight;

            if (labelX1 < 0 || labelX2 > innerWidth || labelY1 < 0 || labelY2 > innerHeight) {
                continue;
            }

            for (const p of allPoints) {
                if (p === d) continue;

                const pX = xScale(p[xValueField]);
                const pY = yScale(p[yValueField]);
                const pRadius = squareSize / 2 + 5; // Collision radius for points

                // Check overlap with other points
                if (labelX1 < pX + pRadius && labelX2 > pX - pRadius &&
                    labelY1 < pY + pRadius && labelY2 > pY - pRadius) {
                    hasOverlap = true;
                    break;
                }
                
                // Check overlap with other labels
                const pPosData = currentPositions[p[labelField]];
                if (pPosData && pPosData.canShow) {
                    const otherTextDimensions = estimateTextDimensions(p[labelField], fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
                    let otherX1, otherY1;
                    if (pPosData.anchor === "start") {
                        otherX1 = pX + pPosData.x;
                        otherY1 = pY + pPosData.y - otherTextDimensions.height / 2;
                    } else if (pPosData.anchor === "middle") {
                        otherX1 = pX + pPosData.x - otherTextDimensions.width / 2;
                        otherY1 = pY + pPosData.y - (pPosData.y < 0 ? otherTextDimensions.height : 0);
                    } else {
                        otherX1 = pX + pPosData.x - otherTextDimensions.width;
                        otherY1 = pY + pPosData.y - otherTextDimensions.height / 2;
                    }
                     if (pPosData.anchor === "middle" && pPosData.x === 0) {
                         if (pPosData.y < 0) otherY1 = pY + pPosData.y - otherTextDimensions.height - 2;
                         else otherY1 = pY + pPosData.y + 2;
                     }


                    if (labelX1 < otherX1 + otherTextDimensions.width && labelX2 > otherX1 &&
                        labelY1 < otherY1 + otherTextDimensions.height && labelY2 > otherY1) {
                        hasOverlap = true;
                        break;
                    }
                }
            }
            if (!hasOverlap) return { ...pos, canShow: true };
        }
        return { ...positions[0], canShow: false }; // Default to first position, hidden
    }
    
    const pointGroups = mainChartGroup.selectAll(".data-point-group")
        .data(chartData)
        .enter()
        .append("g")
        .attr("class", "mark data-point-group")
        .attr("transform", d => `translate(${xScale(d[xValueField])}, ${yScale(d[yValueField])})`);

    pointGroups.append("rect")
        .attr("class", "mark data-point-mark")
        .attr("width", squareSize)
        .attr("height", squareSize)
        .attr("x", -squareSize / 2)
        .attr("y", -squareSize / 2)
        .attr("rx", 0) // No rounded corners
        .attr("ry", 0) // No rounded corners
        .style("fill", d => fillStyle.getPointColor(d[groupField]))
        .style("opacity", 0.8);

    let labelPositions = {};
    chartData.forEach(d => {
        labelPositions[d[labelField]] = findOptimalPosition(d, chartData, labelPositions);
    });

    pointGroups.append("text")
        .attr("class", "label data-label")
        .attr("x", d => labelPositions[d[labelField]].x)
        .attr("y", d => labelPositions[d[labelField]].y)
        .attr("text-anchor", d => labelPositions[d[labelField]].anchor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .style("opacity", d => labelPositions[d[labelField]].canShow ? 1 : 0)
        .text(d => d[labelField]);

    // Block 9: Optional Enhancements & Post-Processing
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip") // Standardized class
        .style("opacity", 0)
        .style("position", "absolute")
        .style("padding", "8px")
        .style("background-color", fillStyle.tooltipBackground)
        .style("color", fillStyle.tooltipTextColor)
        .style("border", `1px solid ${fillStyle.legendBorderColor}`) // Use a common border color
        .style("border-radius", "4px")
        .style("pointer-events", "none") // Important for mouse events
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize);

    pointGroups
        .on("mouseover", function(event, d) {
            d3.select(this).select(".data-point-mark")
                .transition().duration(100)
                .attr("width", squareSize * 1.2)
                .attr("height", squareSize * 1.2)
                .attr("x", -squareSize * 1.2 / 2)
                .attr("y", -squareSize * 1.2 / 2);
            
            d3.select(this).select(".data-label") // If label is shown, make it bold
                .style("font-weight", "bold");

            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip.html(
                `<strong>${d[labelField]}</strong><br/>` +
                `${xValueTitle || xValueField}: ${formatAxisValue(d[xValueField])}<br/>` +
                `${yValueTitle || yValueField}: ${formatAxisValue(d[yValueField])}`
            )
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).select(".data-point-mark")
                .transition().duration(100)
                .attr("width", squareSize)
                .attr("height", squareSize)
                .attr("x", -squareSize / 2)
                .attr("y", -squareSize / 2);

            d3.select(this).select(".data-label")
                .style("font-weight", fillStyle.typography.annotationFontWeight); // Reset to original weight

            tooltip.transition().duration(500).style("opacity", 0);
        });
    
    // Block 10: Cleanup & SVG Node Return
    // Tooltip is appended to body, will persist unless explicitly removed elsewhere.
    // No other specific cleanup needed for this chart structure.
    return svgRoot.node();
}