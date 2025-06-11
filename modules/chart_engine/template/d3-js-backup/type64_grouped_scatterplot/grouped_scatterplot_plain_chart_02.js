/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Scatterplot",
  "chart_name": "grouped_scatterplot_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y", "y2", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[8, 150], [0, "inf"], [0, "inf"], [2, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 750,
  "min_width": 750,
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
REQUIREMENTS_END
*/
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {};
    const images = data.images || {}; // Not used, but parsed per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html("");

    const labelFieldDef = dataColumns.find(col => col.role === "x");
    const xAxisValueFieldDef = dataColumns.find(col => col.role === "y");
    const yAxisValueFieldDef = dataColumns.find(col => col.role === "y2");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    const labelFieldName = labelFieldDef ? labelFieldDef.name : undefined;
    const xAxisValueFieldName = xAxisValueFieldDef ? xAxisValueFieldDef.name : undefined;
    const yAxisValueFieldName = yAxisValueFieldDef ? yAxisValueFieldDef.name : undefined;
    const groupFieldName = groupFieldDef ? groupFieldDef.name : undefined;
    
    const criticalFields = {
        labelFieldName,
        xAxisValueFieldName,
        yAxisValueFieldName,
        groupFieldName
    };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Required roles: x (for labels), y (for x-axis values), y2 (for y-axis values), group. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        return null;
    }
    
    const chartData = rawChartData.map(d => {
        // Ensure numeric fields are numbers, keep others as is initially
        const xVal = parseFloat(d[xAxisValueFieldName]);
        const yVal = parseFloat(d[yAxisValueFieldName]);
        return {
            ...d,
            [xAxisValueFieldName]: isNaN(xVal) ? null : xVal,
            [yAxisValueFieldName]: isNaN(yVal) ? null : yVal,
        };
    }).filter(d => 
        d[xAxisValueFieldName] != null &&
        d[yAxisValueFieldName] != null &&
        d[labelFieldName] != null && // Label can be any type
        d[groupFieldName] != null  // Group can be any type
    );

    if (chartData.length === 0) {
        const errorMessage = "No valid data points to render after filtering for required fields and numeric conversion.";
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMessage}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'normal',
        },
        textColor: rawColors.text_color || '#0f223b',
        axisLineColor: rawColors.text_color || '#0f223b',
        primaryColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#1f77b4',
        backgroundColor: rawColors.background_color || '#FFFFFF',
        defaultCategoryColors: rawColors.available_colors || d3.schemeCategory10,
        markOpacity: 0.75,
        axisLineOpacity: 0.5,
    };
    
    const uniqueGroupValues = [...new Set(chartData.map(d => d[groupFieldName]))];
    const internalColorScale = d3.scaleOrdinal(fillStyle.defaultCategoryColors).domain(uniqueGroupValues);
    fillStyle.getCategoryColor = (category) => {
        return (rawColors.field && rawColors.field[category]) ? rawColors.field[category] : internalColorScale(category);
    };

    const estimateTextBBox = (text, fontFamily, fontSize, fontWeight = "normal") => {
        const tempSvg = d3.create('svg'); // Creates an SVG element in memory, not attached to DOM
        const textNode = tempSvg.append('text')
            .attr('font-family', fontFamily)
            .attr('font-size', fontSize)
            .attr('font-weight', fontWeight)
            .text(text);
        const bbox = textNode.node().getBBox();
        // tempSvg.remove(); // Not strictly necessary as it's not in DOM
        return { width: bbox.width, height: bbox.height, x: bbox.x, y: bbox.y };
    };
    
    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight = "normal") => {
        return estimateTextBBox(text, fontFamily, fontSize, fontWeight).width;
    };

    const findOptimalLabelPosition = (d_point, allChartDataPoints, currentLabelPositions,
                                   xScaleFunc, yScaleFunc, xValueAccessor, yValueAccessor, labelTextAccessor,
                                   chartPlotWidth, chartPlotHeight, pointMarkRadius, // Using markRadius now
                                   labelStyle, estimateBBoxFunc) => {
        // Positions: dx, dy are offsets from point center to label center. anchor is text-anchor.
        const labelText = String(d_point[labelTextAccessor]); // Ensure text is string
        const textBBox = estimateBBoxFunc(labelText, labelStyle.fontFamily, labelStyle.fontSize, labelStyle.fontWeight);
        const labelWidth = textBBox.width;
        const labelHeight = textBBox.height;

        const positions = [ // dx, dy for label center relative to point center
            { dx: pointMarkRadius + labelWidth / 2 + 5, dy: 0, anchor: "start", priority: 1 },  // Right
            { dx: 0, dy: -(pointMarkRadius + labelHeight / 2 + 5), anchor: "middle", priority: 2 }, // Top
            { dx: -(pointMarkRadius + labelWidth / 2 + 5), dy: 0, anchor: "end", priority: 3 },   // Left
            { dx: 0, dy: pointMarkRadius + labelHeight / 2 + 5, anchor: "middle", priority: 4 },  // Bottom
            // Diagonals (gap of ~5px from corner of mark to corner of label)
            { dx: pointMarkRadius * 0.707 + labelWidth / 2 + 5, dy: -(pointMarkRadius * 0.707 + labelHeight / 2 + 5), anchor: "start", priority: 5 },
            { dx: -(pointMarkRadius * 0.707 + labelWidth / 2 + 5), dy: -(pointMarkRadius * 0.707 + labelHeight / 2 + 5), anchor: "end", priority: 6 },
            { dx: -(pointMarkRadius * 0.707 + labelWidth / 2 + 5), dy: pointMarkRadius * 0.707 + labelHeight / 2 + 5, anchor: "end", priority: 7 },
            { dx: pointMarkRadius * 0.707 + labelWidth / 2 + 5, dy: pointMarkRadius * 0.707 + labelHeight / 2 + 5, anchor: "start", priority: 8 }
        ];

        const pointX = xScaleFunc(d_point[xValueAccessor]);
        const pointY = yScaleFunc(d_point[yValueAccessor]);

        if (currentLabelPositions[labelText]) return currentLabelPositions[labelText]; // Already optimally placed

        for (const pos of positions) {
            const textElementX = pointX + pos.dx; // x attribute for text
            const textElementY = pointY + pos.dy; // y attribute for text (center with dominant-baseline="middle")

            // Calculate label bounding box (top-left coordinates and dimensions)
            let currentLabelVisualX; // Top-left X of the label's bounding box
            if (pos.anchor === "start") {
                currentLabelVisualX = textElementX;
            } else if (pos.anchor === "middle") {
                currentLabelVisualX = textElementX - labelWidth / 2;
            } else { // end
                currentLabelVisualX = textElementX - labelWidth;
            }
            const currentLabelVisualY = textElementY - labelHeight / 2; // Top-left Y
            const currentLabelVisualX2 = currentLabelVisualX + labelWidth;
            const currentLabelVisualY2 = currentLabelVisualY + labelHeight;

            // Check boundary collision
            if (currentLabelVisualX < 0 || currentLabelVisualX2 > chartPlotWidth || currentLabelVisualY < 0 || currentLabelVisualY2 > chartPlotHeight) {
                continue;
            }

            let hasOverlap = false;
            for (const p_other of allChartDataPoints) {
                const otherPointX = xScaleFunc(p_other[xValueAccessor]);
                const otherPointY = yScaleFunc(p_other[yValueAccessor]);

                // Check overlap with other points' marks (bounding box collision)
                if (p_other !== d_point) { // Don't check collision with its own mark if label is outside
                    if (currentLabelVisualX < otherPointX + pointMarkRadius && currentLabelVisualX2 > otherPointX - pointMarkRadius &&
                        currentLabelVisualY < otherPointY + pointMarkRadius && currentLabelVisualY2 > otherPointY - pointMarkRadius) {
                        hasOverlap = true; break;
                    }
                }

                // Check overlap with other already placed labels
                const otherLabelText = String(p_other[labelTextAccessor]);
                const pOtherPos = currentLabelPositions[otherLabelText];
                if (pOtherPos && p_other !== d_point) {
                    const otherTextBBox = estimateBBoxFunc(otherLabelText, labelStyle.fontFamily, labelStyle.fontSize, labelStyle.fontWeight);
                    const otherLabelWidth = otherTextBBox.width;
                    const otherLabelHeight = otherTextBBox.height;
                    
                    const otherTextElementX = otherPointX + pOtherPos.dx;
                    const otherTextElementY = otherPointY + pOtherPos.dy;
                    let otherLabelVisualX;
                    if (pOtherPos.anchor === "start") { otherLabelVisualX = otherTextElementX; }
                    else if (pOtherPos.anchor === "middle") { otherLabelVisualX = otherTextElementX - otherLabelWidth / 2; }
                    else { otherLabelVisualX = otherTextElementX - otherLabelWidth; }
                    const otherLabelVisualY = otherTextElementY - otherLabelHeight / 2;
                    const otherLabelVisualX2 = otherLabelVisualX + otherLabelWidth;
                    const otherLabelVisualY2 = otherLabelVisualY + otherLabelHeight;

                    if (currentLabelVisualX < otherLabelVisualX2 && currentLabelVisualX2 > otherLabelVisualX && currentLabelVisualY < otherLabelVisualY2 && currentLabelVisualY2 > otherLabelVisualY) {
                        hasOverlap = true; break;
                    }
                }
            }
            if (!hasOverlap) return { dx: pos.dx, dy: pos.dy, anchor: pos.anchor, canShow: true };
        }
        return { ...positions[0], canShow: false }; // Default to first position, hidden
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 750;

    const svgRoot = d3.select(containerSelector).append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const numPoints = chartData.length;
    let baseSquareSize = numPoints <= 10 ? 18 - numPoints * 0.7 : 12 - (numPoints - 10) * 0.4;
    baseSquareSize = Math.max(3, Math.min(18, baseSquareSize));
    const pointMarkSide = baseSquareSize * 1.414;
    const legendMarkSide = baseSquareSize;

    const legendGroups = [...new Set(chartData.map(d => d[groupFieldName]))];
    const legendFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const legendItemHeight = legendFontSize + 10; // Vertical space per legend line
    const legendPadding = 15; 
    const legendElementSpacing = 15;
    
    let legendTotalHeight = 0;
    let legendLayout = []; // To store {items, width} for each line, used later in Block 7

    if (legendGroups.length > 0) {
        let currentLineItems = [];
        let currentLineWidth = 0;
        // Max width for legend content area, allowing for chart margins
        const maxLegendContentWidth = containerWidth - (variables.marginLeft || 60) - (variables.marginRight || 25); 

        legendGroups.forEach(groupName => {
            const textWidth = estimateTextWidth(String(groupName), fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            const itemWidth = legendMarkSide + 4 + textWidth;

            if (currentLineWidth + itemWidth + (currentLineItems.length > 0 ? legendElementSpacing : 0) > maxLegendContentWidth && currentLineItems.length > 0) {
                legendLayout.push({ items: currentLineItems, lineWidth: currentLineWidth });
                currentLineItems = [];
                currentLineWidth = 0;
            }
            currentLineItems.push({ name: String(groupName), width: itemWidth });
            currentLineWidth += itemWidth + (currentLineItems.length > 0 ? legendElementSpacing : 0);
        });
        if (currentLineItems.length > 0) {
            legendLayout.push({ items: currentLineItems, lineWidth: currentLineWidth });
        }
        legendTotalHeight = legendLayout.length * legendItemHeight + legendPadding; // Only top padding, bottom space is part of margin.top
    }
    
    const chartMargins = {
        top: (legendTotalHeight > 0 ? legendTotalHeight : 0) + (variables.marginTop || 25),
        right: variables.marginRight || 25,
        bottom: variables.marginBottom || 60, // Increased for axis title
        left: variables.marginLeft || 70  // Increased for axis title
    };

    const chartInnerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartInnerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (chartInnerWidth <= 0 || chartInnerHeight <= 0) {
        console.error("Calculated chart dimensions are not positive. Check input width/height and margins.");
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Chart dimensions are too small.</div>");
        return null;
    }

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other"); // Class 'other' for group

    // Block 5: Data Preprocessing & Transformation
    const hasNegativeOrZeroValues = (dataArray, field) => dataArray.some(d => d[field] <= 0);
    const isDistributionUneven = (dataArray, field) => {
        const values = dataArray.map(d => d[field]).sort(d3.ascending);
        if (values.length < 4) return false; 
        const extent = d3.extent(values);
        const range = extent[1] - extent[0];
        if (range === 0) return false;
        const median = d3.median(values);
        const q1 = d3.quantile(values, 0.25);
        const q3 = d3.quantile(values, 0.75);
        const iqr = q3 - q1;
        if (iqr === 0 && range > 0) return true; // Highly skewed if IQR is 0 but range is not
        if (iqr === 0 && range === 0) return false; // All same values
        return range / iqr > 3 || Math.abs(median - (extent[0] + extent[1]) / 2) / range > 0.2;
    };

    // Block 6: Scale Definition & Configuration
    const xExtent = d3.extent(chartData, d => d[xAxisValueFieldName]);
    const yExtent = d3.extent(chartData, d => d[yAxisValueFieldName]);

    const xPadding = xExtent[0] === xExtent[1] ? 1 : (xExtent[1] - xExtent[0]) * 0.1;
    const yPadding = yExtent[0] === yExtent[1] ? 1 : (yExtent[1] - yExtent[0]) * 0.1;

    const xDomain = [xExtent[0] - xPadding, xExtent[1] + xPadding];
    const yDomain = [yExtent[0] - yPadding, yExtent[1] + yPadding];

    const xCanLog = !hasNegativeOrZeroValues(chartData, xAxisValueFieldName) && isDistributionUneven(chartData, xAxisValueFieldName) && xDomain[0] > 0;
    const xScale = xCanLog
        ? d3.scaleLog().domain([Math.max(xDomain[0], 0.1), xDomain[1]]).range([0, chartInnerWidth]).nice()
        : d3.scaleLinear().domain(xDomain).range([0, chartInnerWidth]).nice();
            
    const yCanLog = !hasNegativeOrZeroValues(chartData, yAxisValueFieldName) && isDistributionUneven(chartData, yAxisValueFieldName) && yDomain[0] > 0;
    const yScale = yCanLog
        ? d3.scaleLog().domain([Math.max(yDomain[0], 0.1), yDomain[1]]).range([chartInnerHeight, 0]).nice()
        : d3.scaleLinear().domain(yDomain).range([chartInnerHeight, 0]).nice();
    
    // Block 7: Chart Component Rendering (Axes, Legend)
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${chartInnerHeight})`)
        .call(xAxis);
    xAxisGroup.select(".domain").style("stroke", fillStyle.axisLineColor).style("opacity", fillStyle.axisLineOpacity);
    xAxisGroup.selectAll("text")
        .attr("class", "label value")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);

    const yAxis = d3.axisLeft(yScale).tickSize(0).tickPadding(10);
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);
    yAxisGroup.select(".domain").style("stroke", fillStyle.axisLineColor).style("opacity", fillStyle.axisLineOpacity);
    yAxisGroup.selectAll("text")
        .attr("class", "label value")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);

    const xAxisTitleText = (xAxisValueFieldDef && xAxisValueFieldDef.title) || xAxisValueFieldName;
    mainChartGroup.append("text")
        .attr("class", "label axis-title x-axis-title text")
        .attr("x", chartInnerWidth / 2)
        .attr("y", chartInnerHeight + chartMargins.bottom * 0.65) 
        .attr("text-anchor", "middle")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(xAxisTitleText);

    const yAxisTitleText = (yAxisValueFieldDef && yAxisValueFieldDef.title) || yAxisValueFieldName;
    mainChartGroup.append("text")
        .attr("class", "label axis-title y-axis-title text")
        .attr("transform", "rotate(-90)")
        .attr("x", -chartInnerHeight / 2)
        .attr("y", -chartMargins.left * 0.70) 
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(yAxisTitleText);

    if (legendLayout.length > 0) {
        const legendContainerGroup = svgRoot.append("g")
            .attr("class", "legend-group other")
            .attr("transform", `translate(0, ${legendPadding})`);

        legendLayout.forEach((line, lineIndex) => {
            const lineY = lineIndex * legendItemHeight + legendItemHeight / 2; // Center items vertically in their line slot
            const lineStartX = chartMargins.left + (chartInnerWidth - line.lineWidth) / 2;
            let currentX = lineStartX;

            line.items.forEach(item => {
                const legendItemGroup = legendContainerGroup.append("g")
                    .attr("class", "legend-item other")
                    .attr("transform", `translate(${currentX}, ${lineY})`);
                
                legendItemGroup.append("rect")
                    .attr("class", "mark legend-mark")
                    .attr("x", 0)
                    .attr("y", -legendMarkSide / 2)
                    .attr("width", legendMarkSide)
                    .attr("height", legendMarkSide)
                    .style("fill", fillStyle.getCategoryColor(item.name))
                    .style("opacity", fillStyle.markOpacity);

                legendItemGroup.append("text")
                    .attr("class", "label legend-label text")
                    .attr("x", legendMarkSide + 4)
                    .attr("y", 0)
                    .attr("dominant-baseline", "middle")
                    .style("fill", fillStyle.textColor)
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .text(item.name);
                currentX += item.width + legendElementSpacing;
            });
        });
    }

    // Block 8: Main Data Visualization Rendering
    const dataPointGroups = mainChartGroup.selectAll(".data-point-group")
        .data(chartData)
        .enter()
        .append("g")
        .attr("class", "mark data-point-group")
        .attr("transform", d => {
            const xPos = xScale(d[xAxisValueFieldName]);
            const yPos = yScale(d[yAxisValueFieldName]);
            // Ensure positions are finite, fallback to prevent errors if scales produce non-finite values
            return `translate(${isFinite(xPos) ? xPos : -1000}, ${isFinite(yPos) ? yPos : -1000})`;
        });

    dataPointGroups.append("rect")
        .attr("class", "mark data-point-rect")
        .attr("x", -pointMarkSide / 2)
        .attr("y", -pointMarkSide / 2)
        .attr("width", pointMarkSide)
        .attr("height", pointMarkSide)
        .style("fill", d => fillStyle.getCategoryColor(d[groupFieldName]))
        .style("opacity", fillStyle.markOpacity);

    // Block 9: Optional Enhancements & Post-Processing (Data Labels)
    const labelPositions = {};
    const annotationLabelStyle = {
        fontFamily: fillStyle.typography.annotationFontFamily,
        fontSize: fillStyle.typography.annotationFontSize,
        fontWeight: fillStyle.typography.annotationFontWeight,
    };
    
    chartData.forEach(d => {
        const labelKey = String(d[labelFieldName]); // Ensure key is string
        if (!isFinite(xScale(d[xAxisValueFieldName])) || !isFinite(yScale(d[yAxisValueFieldName]))) {
            labelPositions[labelKey] = { dx:0, dy:0, anchor: "middle", canShow: false}; // Cannot place label for invalid point
            return;
        }
        labelPositions[labelKey] = findOptimalLabelPosition(
            d, chartData, labelPositions,
            xScale, yScale, xAxisValueFieldName, yAxisValueFieldName, labelFieldName,
            chartInnerWidth, chartInnerHeight, pointMarkSide / 2, // Pass mark radius
            annotationLabelStyle, estimateTextBBox
        );
    });

    dataPointGroups.append("text")
        .attr("class", "label data-label annotation text")
        .filter(d => { // Only attempt to render if point was valid for scale
             const labelKey = String(d[labelFieldName]);
             return labelPositions[labelKey] && labelPositions[labelKey].canShow && isFinite(xScale(d[xAxisValueFieldName])) && isFinite(yScale(d[yAxisValueFieldName]));
        })
        .attr("x", d => labelPositions[String(d[labelFieldName])].dx)
        .attr("y", d => labelPositions[String(d[labelFieldName])].dy)
        .attr("text-anchor", d => labelPositions[String(d[labelFieldName])].anchor)
        .attr("dominant-baseline", "middle")
        .style("font-family", annotationLabelStyle.fontFamily)
        .style("font-size", annotationLabelStyle.fontSize)
        .style("font-weight", annotationLabelStyle.fontWeight)
        .style("fill", fillStyle.textColor)
        // .style("opacity", d => labelPositions[String(d[labelFieldName])].canShow ? 1 : 0) // Filtered above
        .text(d => String(d[labelFieldName]));

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}