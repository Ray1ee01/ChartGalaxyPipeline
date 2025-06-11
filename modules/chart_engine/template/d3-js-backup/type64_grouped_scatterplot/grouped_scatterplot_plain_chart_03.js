/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Scatter Plot",
  "chart_name": "grouped_scatterplot_01",
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
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {};
    const imagesConfig = data.images || {}; // Not used, but extracted per convention
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html("");

    const getFieldByRole = (role) => {
        const column = dataColumns.find(col => col.role === role);
        return column ? column.name : undefined;
    };

    const xFieldName = getFieldByRole("x"); // Categorical, for point labels
    const yFieldName = getFieldByRole("y"); // Numerical, for X-axis values
    const y2FieldName = getFieldByRole("y2"); // Numerical, for Y-axis values
    const groupFieldName = getFieldByRole("group"); // Categorical, for grouping/coloring

    const criticalFields = { xFieldName, yFieldName, y2FieldName, groupFieldName };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null;
    }
    
    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [yFieldName]: parseFloat(d[yFieldName]),
        [y2FieldName]: parseFloat(d[y2FieldName]),
    })).filter(d => 
        d[xFieldName] != null &&
        d[yFieldName] != null && !isNaN(d[yFieldName]) &&
        d[y2FieldName] != null && !isNaN(d[y2FieldName]) &&
        d[groupFieldName] != null
    );

    if (chartDataArray.length === 0) {
        const errorMessage = "No valid data points to render after filtering for required fields and numeric conversion.";
        console.warn(errorMessage); // Use warn as it's a data issue, not a config one
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null; // Or an empty chart, but null is fine for no data.
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) || '16px',
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) || 'bold',
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
        },
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        textColor: colorsConfig.text_color || '#0f223b',
        axisLineColor: colorsConfig.text_color || '#333333', // Default slightly lighter for axis lines
        primaryAccent: (colorsConfig.other && colorsConfig.other.primary) || '#1f77b4',
        groupColorsMap: {},
        defaultCategoryColors: d3.schemeCategory10,
    };

    const uniqueGroupNames = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort(); // Sort for consistent legend order
    uniqueGroupNames.forEach((groupName, index) => {
        if (colorsConfig.field && colorsConfig.field[groupName]) {
            fillStyle.groupColorsMap[groupName] = colorsConfig.field[groupName];
        } else if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            fillStyle.groupColorsMap[groupName] = colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        } else {
            fillStyle.groupColorsMap[groupName] = fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
        }
    });
    
    const estimateTextMetrics = (text, fontFamily, fontSize, fontWeight = "normal") => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        try {
            const bbox = textNode.getBBox();
            return { width: bbox.width, height: bbox.height };
        } catch (e) {
            const numChars = String(text).length || 1;
            const size = parseFloat(fontSize) || 10;
            return { width: numChars * size * 0.6, height: size }; // Basic fallback
        }
    };

    const createTrianglePath = (size) => {
        const height = size * Math.sqrt(3) / 2;
        return `M 0,${-height / 2} L ${size / 2},${height / 2} L ${-size / 2},${height / 2} Z`;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 750;

    const svgRoot = d3.select(containerSelector).append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    let numPoints = chartDataArray.length;
    let triangleSize = numPoints <= 10 ? 18 - numPoints * 0.7 : 12 - (numPoints - 10) * 0.4;
    triangleSize = Math.max(3, Math.min(18, triangleSize)) * 1.414;

    const initialChartMargins = { top: 20, right: 30, bottom: 60, left: 70 };

    let legendHeight = 0;
    const legendItemPaddingVertical = 5;
    const legendTextSize = parseFloat(fillStyle.typography.labelFontSize);

    if (uniqueGroupNames.length > 0) {
        const legendItemLineHeight = legendTextSize + legendItemPaddingVertical * 2;
        const legendMaxWidth = containerWidth - initialChartMargins.left - initialChartMargins.right;
        const legendItemSpacingHorizontal = 15;
        
        let currentLineWidth = 0;
        let legendLinesCount = 1;
        uniqueGroupNames.forEach(name => {
            const textMetrics = estimateTextMetrics(name, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            const itemWidth = triangleSize + 4 + textMetrics.width;
            if (currentLineWidth + itemWidth + (currentLineWidth > 0 ? legendItemSpacingHorizontal : 0) > legendMaxWidth && currentLineWidth > 0) {
                legendLinesCount++;
                currentLineWidth = itemWidth;
            } else {
                currentLineWidth += itemWidth + (currentLineWidth > 0 ? legendItemSpacingHorizontal : 0);
            }
        });
        legendHeight = legendLinesCount * legendItemLineHeight;
    }
    
    const chartMargins = {
        ...initialChartMargins,
        top: Math.max(initialChartMargins.top, legendHeight + (legendHeight > 0 ? 10 : 0) ) 
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMessage = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Check container size and margins.";
        console.error(errorMessage);
        svgRoot.append("text").attr("x", 10).attr("y", 20).text(errorMessage).style("fill", "red").attr("font-family", "sans-serif");
        return svgRoot.node();
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation (for scales)
    const hasNegativeOrZeroValues = (data, field) => data.some(d => d[field] <= 0);
    const isDistributionUneven = (data, field) => {
        const values = data.map(d => d[field]).sort(d3.ascending);
        if (values.length < 4) return false; // Need enough points for quartiles
        const extent = [values[0], values[values.length - 1]];
        const range = extent[1] - extent[0];
        if (range === 0) return false;
        const median = d3.median(values);
        const q1 = d3.quantile(values, 0.25);
        const q3 = d3.quantile(values, 0.75);
        const iqr = q3 - q1;
        if (iqr === 0) return range > 0; // If IQR is 0 but range is not, it's uneven
        return range / iqr > 3 || Math.abs(median - (extent[0] + extent[1]) / 2) / range > 0.2;
    };

    // Block 6: Scale Definition & Configuration
    let xExtent = d3.extent(chartDataArray, d => d[yFieldName]);
    let yExtent = d3.extent(chartDataArray, d => d[y2FieldName]);

    // Handle cases where all data points are the same
    if (xExtent[0] === xExtent[1]) { xExtent = [xExtent[0] * 0.9 -1, xExtent[1] * 1.1 + 1]; }
    if (yExtent[0] === yExtent[1]) { yExtent = [yExtent[0] * 0.9 -1, yExtent[1] * 1.1 + 1]; }


    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartDataArray, yFieldName);
    const xIsUneven = isDistributionUneven(chartDataArray, yFieldName);
    const xScale = (!xHasNegativeOrZero && xIsUneven && xExtent[0] > 0)
        ? d3.scaleLog().domain([Math.max(xExtent[0] * 0.9, 0.01), xExtent[1] * 1.1]).range([0, innerWidth]).clamp(true)
        : d3.scaleLinear().domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1]).range([0, innerWidth]);

    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartDataArray, y2FieldName);
    const yIsUneven = isDistributionUneven(chartDataArray, y2FieldName);
    const yScale = (!yHasNegativeOrZero && yIsUneven && yExtent[0] > 0)
        ? d3.scaleLog().domain([Math.max(yExtent[0] * 0.9, 0.01), yExtent[1] * 1.1]).range([innerHeight, 0]).clamp(true)
        : d3.scaleLinear().domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1]).range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxis = d3.axisBottom(xScale).tickSizeOuter(0).tickPadding(10);
    const yAxis = d3.axisLeft(yScale).tickSizeOuter(0).tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);
    xAxisGroup.select(".domain").style("stroke", fillStyle.axisLineColor).style("opacity", 0.8);
    xAxisGroup.selectAll(".tick line").remove(); // No tick lines, only domain path
    xAxisGroup.selectAll(".tick text")
        .attr("class", "value")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);
    yAxisGroup.select(".domain").style("stroke", fillStyle.axisLineColor).style("opacity", 0.8);
    yAxisGroup.selectAll(".tick line").remove(); // No tick lines
    yAxisGroup.selectAll(".tick text")
        .attr("class", "value")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);
    
    const getUnit = (fieldName) => {
        const col = dataColumns.find(c => c.name === fieldName);
        return col && col.unit ? ` (${col.unit})` : "";
    };

    mainChartGroup.append("text")
        .attr("class", "text axis-title x-axis-title")
        .attr("text-anchor", "middle")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + chartMargins.bottom - parseFloat(fillStyle.typography.labelFontSize) * 0.8)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(yFieldName + getUnit(yFieldName));

    mainChartGroup.append("text")
        .attr("class", "text axis-title y-axis-title")
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .attr("x", -innerHeight / 2)
        .attr("y", -chartMargins.left + parseFloat(fillStyle.typography.labelFontSize) + 5)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(y2FieldName + getUnit(y2FieldName));

    if (uniqueGroupNames.length > 0 && legendHeight > 0) {
        const legendContainer = svgRoot.append("g")
            .attr("class", "other legend")
            .attr("transform", `translate(${chartMargins.left}, ${(chartMargins.top - legendHeight) /2 + legendItemPaddingVertical})`); // Position in allocated top margin

        const legendItemLineHeight = legendTextSize + legendItemPaddingVertical * 2;
        const legendMaxWidth = innerWidth;
        const legendItemSpacingHorizontal = 15;
        
        let currentLineItems = [];
        let currentLineWidth = 0;
        let currentLineY = 0;

        const renderLegendLine = () => {
            if (currentLineItems.length === 0) return;
            const totalLineWidthForThisLine = currentLineItems.reduce((sum, item) => sum + item.width, 0) + Math.max(0, currentLineItems.length - 1) * legendItemSpacingHorizontal;
            let itemStartX = (legendMaxWidth - totalLineWidthForThisLine) / 2;
            if (itemStartX < 0) itemStartX = 0; 

            currentLineItems.forEach(item => {
                const itemGroup = legendContainer.append("g")
                    .attr("class", "other legend-item")
                    .attr("transform", `translate(${itemStartX}, ${currentLineY})`);
                
                itemGroup.append("path")
                    .attr("class", "mark legend-mark")
                    .attr("d", createTrianglePath(triangleSize * 0.6)) // Smaller symbol for legend
                    .attr("transform", `translate(${(triangleSize * 0.6) / 2}, ${legendTextSize / 2})`)
                    .attr("fill", fillStyle.groupColorsMap[item.name] || fillStyle.primaryAccent)
                    .style("opacity", 0.75);

                itemGroup.append("text")
                    .attr("class", "label legend-label")
                    .attr("x", triangleSize * 0.6 + 4)
                    .attr("y", legendTextSize / 2)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(item.name);
                itemStartX += item.width + legendItemSpacingHorizontal;
            });
            currentLineItems = [];
            currentLineWidth = 0;
            currentLineY += legendItemLineHeight;
        };
        
        uniqueGroupNames.forEach((name) => {
            const textMetrics = estimateTextMetrics(name, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            const itemWidth = (triangleSize * 0.6) + 4 + textMetrics.width; // Use smaller symbol size for width calc

            if (currentLineWidth + itemWidth + (currentLineItems.length > 0 ? legendItemSpacingHorizontal : 0) > legendMaxWidth && currentLineItems.length > 0) {
                renderLegendLine();
            }
            currentLineItems.push({ name, width: itemWidth });
            currentLineWidth += itemWidth + (currentLineItems.length > 0 ? legendItemSpacingHorizontal : 0);
        });
        renderLegendLine();
    }

    // Block 8: Main Data Visualization Rendering
    const pointsGroup = mainChartGroup.append("g").attr("class", "points-group");
    
    const pointElements = pointsGroup.selectAll(".data-point-item") // Changed class for clarity
        .data(chartDataArray)
        .enter().append("g")
        .attr("class", "mark data-point-item") 
        .attr("transform", d => {
            const xVal = xScale(d[yFieldName]);
            const yVal = yScale(d[y2FieldName]);
            const clampedX = isNaN(xVal) ? innerWidth / 2 : Math.max(0, Math.min(innerWidth, xVal)); // Fallback for NaN
            const clampedY = isNaN(yVal) ? innerHeight / 2 : Math.max(0, Math.min(innerHeight, yVal));
            return `translate(${clampedX}, ${clampedY})`;
        });

    pointElements.append("path")
        .attr("class", "mark point-shape")
        .attr("d", createTrianglePath(triangleSize))
        .attr("fill", d => fillStyle.groupColorsMap[d[groupFieldName]] || fillStyle.primaryAccent)
        .style("opacity", 0.75);

    // Block 9: Optional Enhancements & Post-Processing
    const findOptimalPosition = (d, allChartPoints, currentLabelPositionsMap) => {
        const labelText = String(d[xFieldName]);
        const textMetrics = estimateTextMetrics(labelText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        const labelWidth = textMetrics.width;
        const labelHeight = textMetrics.height;
        const pointRadius = triangleSize / 1.5; // Effective radius for collision

        const positions = [ 
            { dx: pointRadius + 2, dy: 0, anchor: "start", priority: 1 },
            { dx: 0, dy: -pointRadius - 2 - labelHeight, anchor: "middle", priority: 2 }, // dy is top of label
            { dx: -pointRadius - 2 - labelWidth, dy: 0, anchor: "end", priority: 3 }, // dx is left of label
            { dx: 0, dy: pointRadius + 2, anchor: "middle", priority: 4 }, // dy is top of label
        ];

        const currentPointX = xScale(d[yFieldName]);
        const currentPointY = yScale(d[y2FieldName]);
        if (isNaN(currentPointX) || isNaN(currentPointY)) return { ...positions[0], canShow: false };

        for (const pos of positions.sort((a,b) => a.priority - b.priority)) {
            let labelX = currentPointX + pos.dx; // Default for anchor start/middle
            let labelY = currentPointY + pos.dy; // Default for dy being top of label

            if (pos.anchor === "start") { labelY = currentPointY + pos.dy - labelHeight / 2; }
            else if (pos.anchor === "middle") { labelX = currentPointX + pos.dx - labelWidth / 2; }
            else { labelX = currentPointX + pos.dx; } // dx is already adjusted for labelWidth

            const labelX2 = labelX + labelWidth;
            const labelY2 = labelY + labelHeight;

            if (labelX < 0 || labelX2 > innerWidth || labelY < 0 || labelY2 > innerHeight) continue;

            let hasOverlap = false;
            for (const otherPoint of allChartPoints) {
                if (otherPoint === d) continue;
                const otherPointX = xScale(otherPoint[yFieldName]);
                const otherPointY = yScale(otherPoint[y2FieldName]);
                if (isNaN(otherPointX) || isNaN(otherPointY)) continue;

                if (labelX < otherPointX + pointRadius && labelX2 > otherPointX - pointRadius &&
                    labelY < otherPointY + pointRadius && labelY2 > otherPointY - pointRadius) {
                    hasOverlap = true; break;
                }
            }
            if (hasOverlap) continue;

            for (const key in currentLabelPositionsMap) {
                const placedInfo = currentLabelPositionsMap[key];
                if (placedInfo.item === d || !placedInfo.canShow) continue;
                
                const otherMetrics = estimateTextMetrics(String(placedInfo.item[xFieldName]), fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
                let otherPlacedX = xScale(placedInfo.item[yFieldName]) + placedInfo.finalDx;
                let otherPlacedY = yScale(placedInfo.item[y2FieldName]) + placedInfo.finalDy;

                if (placedInfo.anchor === "start") { otherPlacedY = yScale(placedInfo.item[y2FieldName]) + placedInfo.finalDy - otherMetrics.height / 2; }
                else if (placedInfo.anchor === "middle") { otherPlacedX = xScale(placedInfo.item[yFieldName]) + placedInfo.finalDx - otherMetrics.width / 2; }
                
                const otherPlacedX2 = otherPlacedX + otherMetrics.width;
                const otherPlacedY2 = otherPlacedY + otherMetrics.height;

                if (labelX < otherPlacedX2 && labelX2 > otherPlacedX &&
                    labelY < otherPlacedY2 && labelY2 > otherPlacedY) {
                    hasOverlap = true; break;
                }
            }
            if (!hasOverlap) return { anchor: pos.anchor, finalDx: pos.dx, finalDy: pos.dy, canShow: true };
        }
        return { ...positions[0], finalDx: positions[0].dx, finalDy: positions[0].dy, canShow: false };
    };

    const labelPositionsMap = {};
    chartDataArray.forEach((d, i) => {
        const pointKey = `${d[xFieldName]}_${i}`; // Ensure unique key using index
        labelPositionsMap[pointKey] = {
            ...findOptimalPosition(d, chartDataArray, labelPositionsMap),
            item: d
        };
    });
    
    pointElements.append("text")
        .attr("class", "label data-label")
        .attr("x", (d, i) => { const pk = `${d[xFieldName]}_${i}`; return labelPositionsMap[pk].finalDx; })
        .attr("y", (d, i) => { const pk = `${d[xFieldName]}_${i}`; return labelPositionsMap[pk].finalDy; })
        .attr("text-anchor", (d, i) => { const pk = `${d[xFieldName]}_${i}`; return labelPositionsMap[pk].anchor; })
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .style("opacity", (d, i) => { const pk = `${d[xFieldName]}_${i}`; return labelPositionsMap[pk].canShow ? 1 : 0; })
        .text(d => d[xFieldName]);

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}