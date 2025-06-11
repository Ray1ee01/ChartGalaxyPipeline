/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Scatterplot",
  "chart_name": "grouped_scatterplot_plain_chart_01",
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
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme preference if both exist and colors_dark is chosen
    const rawImages = data.images || {}; // Not used in this chart but parsed for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const pointIdentifierField = (dataColumns.find(col => col.role === "x") || {}).name;
    const xAxisValueField = (dataColumns.find(col => col.role === "y") || {}).name;
    const yAxisValueField = (dataColumns.find(col => col.role === "y2") || {}).name;
    const groupField = (dataColumns.find(col => col.role === "group") || {}).name;

    const criticalFields = {
        pointIdentifierField,
        xAxisValueField,
        yAxisValueField,
        groupField
    };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: Roles for ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMessage);
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
        backgroundColor: rawColors.background_color || '#FFFFFF',
        defaultMarkColor: '#1f77b4', // A generic default
        axisLineColor: rawColors.text_color || '#333333', // For axis lines
    };

    const getColor = (groupValue, groupIndex, totalGroups) => {
        if (rawColors.field && rawColors.field[groupValue]) {
            return rawColors.field[groupValue];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[groupIndex % rawColors.available_colors.length];
        }
        return d3.schemeCategory10[groupIndex % 10]; // Fallback to d3 scheme
    };
    
    const estimateTextDimensions = (text, fontFamily, fontSize, fontWeight = "normal") => {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svgEl = document.createElementNS(svgNS, 'svg');
        const textEl = document.createElementNS(svgNS, 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        svgEl.appendChild(textEl);
        // Do not append svgEl to document.body as per requirements
        const bbox = textEl.getBBox();
        return { width: bbox.width, height: bbox.height };
    };

    const hasNegativeOrZeroValues = (data, field) => data.some(d => d[field] <= 0);
    const isDistributionUneven = (data, field) => {
        const values = data.map(d => d[field]).filter(v => typeof v === 'number' && isFinite(v));
        if (values.length < 2) return false;
        const extent = d3.extent(values);
        const range = extent[1] - extent[0];
        if (range === 0) return false;
        const median = d3.median(values);
        const q1 = d3.quantile(values.sort(d3.ascending), 0.25);
        const q3 = d3.quantile(values.sort(d3.ascending), 0.75);
        const iqr = q3 - q1;
        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1]) / 2) > range * 0.2;
    };

    // findOptimalPosition helper - complex logic, placed in Block 2
    // Note: This function's collision box calculations are based on the original's specific logic.
    const findOptimalPosition = (d, allPoints, currentPositions = {}, scales, layout, styles, pointRadiusVal) => {
        const { xScale, yScale } = scales;
        const { chartWidth, chartHeight } = layout;
        const { fontFamily, fontSize, fontWeight } = styles.annotation;
        const idField = styles.pointIdentifierField;
        const xValField = styles.xAxisValueField;
        const yValField = styles.yAxisValueField;

        const positions = [ // {offsetX, offsetY, anchor, priority}
            { x: 15, y: 3, anchor: "start", priority: 1 },
            { x: 0, y: -15, anchor: "middle", priority: 2 },
            { x: -15, y: 3, anchor: "end", priority: 3 },
            { x: 0, y: 20, anchor: "middle", priority: 4 },
            { x: 15, y: -15, anchor: "start", priority: 5 },
            { x: -15, y: -15, anchor: "end", priority: 6 },
            { x: -15, y: 20, anchor: "end", priority: 7 },
            { x: 15, y: 20, anchor: "start", priority: 8 }
        ];

        const pointX = xScale(d[xValField]);
        const pointY = yScale(d[yValField]);

        if (currentPositions[d[idField]]) return currentPositions[d[idField]];

        const { width: labelWidth, height: labelHeight } = estimateTextDimensions(d[idField], fontFamily, fontSize, fontWeight);

        for (const pos of positions) {
            let hasOverlap = false;
            let labelBoxX1, labelBoxY1, labelBoxX2, labelBoxY2;

            // Calculate label bounding box in absolute chart coordinates based on original logic
            if (pos.priority === 1) { labelBoxX1 = pointX + 15; labelBoxY1 = pointY - labelHeight / 2; }
            else if (pos.priority === 2) { labelBoxX1 = pointX - labelWidth / 2; labelBoxY1 = pointY - 15 - labelHeight; }
            else if (pos.priority === 3) { labelBoxX1 = pointX - 15 - labelWidth; labelBoxY1 = pointY - labelHeight / 2; }
            else if (pos.priority === 4) { labelBoxX1 = pointX - labelWidth / 2; labelBoxY1 = pointY + 15; }
            else if (pos.priority === 5) { labelBoxX1 = pointX + 12; labelBoxY1 = pointY - 12 - labelHeight; }
            else if (pos.priority === 6) { labelBoxX1 = pointX - 12 - labelWidth; labelBoxY1 = pointY - 12 - labelHeight; }
            else if (pos.priority === 7) { labelBoxX1 = pointX - 12 - labelWidth; labelBoxY1 = pointY + 12; }
            else { labelBoxX1 = pointX + 12; labelBoxY1 = pointY + 12; } // priority 8

            labelBoxX2 = labelBoxX1 + labelWidth;
            labelBoxY2 = labelBoxY1 + labelHeight;

            if (labelBoxX1 < 0 || labelBoxX2 > chartWidth || labelBoxY1 < 0 || labelBoxY2 > chartHeight) continue; // Check boundary overflow

            // Check overlap with other points
            for (const p of allPoints) {
                if (p === d) continue;
                const pX = xScale(p[xValField]), pY = yScale(p[yValField]);
                const dx = (labelBoxX1 + labelBoxX2) / 2 - pX;
                const dy = (labelBoxY1 + labelBoxY2) / 2 - pY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < pointRadiusVal + Math.sqrt(labelWidth * labelWidth + labelHeight * labelHeight) / 2 * 0.8) { // 0.8 fudge factor
                    hasOverlap = true; break;
                }
            }
            if (hasOverlap) continue;

            // Check overlap with other labels already positioned
            for (const p of allPoints) {
                if (p === d) continue;
                const pExistingPos = currentPositions[p[idField]];
                if (pExistingPos && pExistingPos.canShow) {
                    const { width: otherLabelWidth, height: otherLabelHeight } = estimateTextDimensions(p[idField], fontFamily, fontSize, fontWeight);
                    const pX = xScale(p[xValField]), pY = yScale(p[yValField]);
                    
                    let otherBoxX1, otherBoxY1;
                    // This recalculates the bounding box for the other label based on its chosen pos, similar to above
                    // This is a simplified version; ideally, it would use the exact same logic as above for pExistingPos.priority
                    if (pExistingPos.anchor === "start") { otherBoxX1 = pX + pExistingPos.x; }
                    else if (pExistingPos.anchor === "middle") { otherBoxX1 = pX + pExistingPos.x - otherLabelWidth / 2; }
                    else { otherBoxX1 = pX + pExistingPos.x - otherLabelWidth; } // end

                    // Simplified Y calculation for other label's bounding box
                    // This assumes pExistingPos.y is an offset for the text element's y attribute (baseline)
                    // and the box is roughly centered around that baseline + half height up/down.
                    // This part of collision is complex and highly dependent on how text elements are rendered.
                    // The original code's collision for other labels was:
                    // if (pPos.anchor === "start") { otherX1 = pX + pPos.x; otherY1 = pY + pPos.y - otherBBox.height/2; }
                    // else if (pPos.anchor === "middle") { otherX1 = pX + pPos.x - otherBBox.width/2; otherY1 = pY + pPos.y; } // y was baseline
                    // else { otherX1 = pX + pPos.x - otherBBox.width; otherY1 = pY + pPos.y - otherBBox.height/2; }
                    // The original logic for otherY1 for 'middle' anchor seems to be y-coordinate of text, not top of bbox.
                    // For simplicity and to avoid deep diving into potentially flawed original bbox math for *other* labels:
                    // We use the text attributes (pX + pExistingPos.x, pY + pExistingPos.y) and dimensions.
                    let otherTextDrawX = pX + pExistingPos.x;
                    let otherTextDrawY = pY + pExistingPos.y; // Assuming this is baseline y

                    if (pExistingPos.anchor === "start") otherBoxX1 = otherTextDrawX;
                    else if (pExistingPos.anchor === "middle") otherBoxX1 = otherTextDrawX - otherLabelWidth / 2;
                    else otherBoxX1 = otherTextDrawX - otherLabelWidth;
                    
                    // Assuming 'alphabetic' baseline, approx. 3/4 height above, 1/4 below
                    otherBoxY1 = otherTextDrawY - otherLabelHeight * 0.75; 
                    
                    const otherBoxX2 = otherBoxX1 + otherLabelWidth;
                    const otherBoxY2 = otherBoxY1 + otherLabelHeight;

                    if (labelBoxX1 < otherBoxX2 && labelBoxX2 > otherBoxX1 && labelBoxY1 < otherBoxY2 && labelBoxY2 > otherBoxY1) {
                        hasOverlap = true; break;
                    }
                }
            }
            if (!hasOverlap) return { ...pos, canShow: true }; // pos contains {x, y, anchor} which are offsets
        }
        return { ...positions[0], canShow: false }; // Default to first position, but hidden
    };
    
    const calculateLegendLayout = (groups, styles, maxWidth, itemCircleRadius) => {
        const legendFontSize = parseFloat(styles.typography.labelFontSize) || 12;
        const legendFontFamily = styles.typography.labelFontFamily;
        const legendFontWeight = styles.typography.labelFontWeight;
        const legendSpacing = 15; // Horizontal spacing between items
        const itemHeight = legendFontSize + 5; // Vertical spacing for lines

        let lines = [];
        let currentLine = [];
        let currentWidth = 0;

        groups.forEach(name => {
            const { width: textW } = estimateTextDimensions(name, legendFontFamily, `${legendFontSize}px`, legendFontWeight);
            const itemW = itemCircleRadius * 2 + 4 + textW; // circle + padding + text

            if (currentWidth + itemW + (currentLine.length > 0 ? legendSpacing : 0) > maxWidth && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = [];
                currentWidth = 0;
            }
            currentLine.push({ name, width: itemW });
            currentWidth += itemW + (currentLine.length > 0 ? legendSpacing : 0);
        });
        if (currentLine.length > 0) lines.push(currentLine);
        
        const legendHeight = lines.length * itemHeight + (lines.length > 0 ? 10 : 0); // +10 for padding below legend
        return { lines, legendHeight, itemHeight };
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector).append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const uniqueGroupNames = [...new Set(rawChartData.map(d => d[groupField]))];
    const tempCircleRadiusForLegend = 5; // A fixed small radius for legend items
    const legendLayout = calculateLegendLayout(uniqueGroupNames, fillStyle, containerWidth * 0.8, tempCircleRadiusForLegend);

    const chartMargins = {
        top: legendLayout.legendHeight + 25, // Include legend height + padding
        right: 25,
        bottom: 50, // For x-axis title and labels
        left: 60   // For y-axis title and labels
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    // (Data is already in `rawChartData`. No major transformations needed here for this chart type)
    const chartDataArray = rawChartData.filter(d => 
        typeof d[xAxisValueField] === 'number' && isFinite(d[xAxisValueField]) &&
        typeof d[yAxisValueField] === 'number' && isFinite(d[yAxisValueField])
    );
    if (chartDataArray.length === 0) {
        mainChartGroup.append("text").attr("class", "text")
            .attr("x", innerWidth / 2).attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No valid data to display.");
        return svgRoot.node();
    }


    // Block 6: Scale Definition & Configuration
    const xExtent = d3.extent(chartDataArray, d => d[xAxisValueField]);
    const yExtent = d3.extent(chartDataArray, d => d[yAxisValueField]);

    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartDataArray, xAxisValueField);
    const xIsUneven = isDistributionUneven(chartDataArray, xAxisValueField);
    const xScale = (!xHasNegativeOrZero && xIsUneven)
        ? d3.scaleLog().domain([Math.max(xExtent[0] * 0.9, 0.01), xExtent[1] * 1.1]).range([0, innerWidth]).nice()
        : d3.scaleLinear().domain([xExtent[0] === xExtent[1] ? xExtent[0] - 1 : xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[0] === xExtent[1] ? xExtent[1] + 1 : xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1]).range([0, innerWidth]).nice();

    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartDataArray, yAxisValueField);
    const yIsUneven = isDistributionUneven(chartDataArray, yAxisValueField);
    const yScale = (!yHasNegativeOrZero && yIsUneven)
        ? d3.scaleLog().domain([Math.max(yExtent[0] * 0.9, 0.01), yExtent[1] * 1.1]).range([innerHeight, 0]).nice()
        : d3.scaleLinear().domain([yExtent[0] === yExtent[1] ? yExtent[0] - 1 : yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[0] === yExtent[1] ? yExtent[1] + 1 : yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1]).range([innerHeight, 0]).nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    const yAxis = d3.axisLeft(yScale).tickSize(0).tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);
    xAxisGroup.selectAll("path")
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1)
        .style("opacity", 0.5);
    xAxisGroup.selectAll("text")
        .attr("class", "label value") // "label" for typography, "value" for role
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);
    yAxisGroup.selectAll("path")
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1)
        .style("opacity", 0.5);
    yAxisGroup.selectAll("text")
        .attr("class", "label value")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // Axis Titles
    const xAxisTitleText = (dataColumns.find(col => col.role === "y") || {}).title || xAxisValueField;
    mainChartGroup.append("text")
        .attr("class", "text label axis-title")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + chartMargins.bottom - 10)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(xAxisTitleText);

    const yAxisTitleText = (dataColumns.find(col => col.role === "y2") || {}).title || yAxisValueField;
    mainChartGroup.append("text")
        .attr("class", "text label axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -chartMargins.left + 15)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(yAxisTitleText);

    // Render Legend (at the top of SVG)
    const legendGroup = svgRoot.append("g")
        .attr("class", "other legend")
        .attr("transform", `translate(0, 15)`); // 15px padding from SVG top

    legendLayout.lines.forEach((line, lineIdx) => {
        const lineWidth = line.reduce((sum, item, idx) => sum + item.width + (idx > 0 ? 15 : 0), 0); // 15 is legendSpacing
        const startX = chartMargins.left + (innerWidth - lineWidth) / 2; // Centered within chart area
        const lineY = lineIdx * legendLayout.itemHeight;

        let currentX = startX;
        line.forEach((item, itemIdx) => {
            const groupItem = legendGroup.append("g")
                .attr("class", "other legend-item")
                .attr("transform", `translate(${currentX}, ${lineY})`);
            
            groupItem.append("circle")
                .attr("class", "mark legend-mark")
                .attr("cx", tempCircleRadiusForLegend)
                .attr("cy", legendLayout.itemHeight / 2 - tempCircleRadiusForLegend / 2 - 1) // Vertically center circle
                .attr("r", tempCircleRadiusForLegend)
                .style("fill", getColor(item.name, uniqueGroupNames.indexOf(item.name), uniqueGroupNames.length))
                .style("opacity", 0.75);

            groupItem.append("text")
                .attr("class", "label legend-label")
                .attr("x", tempCircleRadiusForLegend * 2 + 4)
                .attr("y", legendLayout.itemHeight / 2) // Vertically center text
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(item.name);
            
            currentX += item.width + 15; // 15 is legendSpacing
        });
    });


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const numPoints = chartDataArray.length;
    let pointRadius = numPoints <= 10 ? 18 - numPoints * 0.7 : 12 - (numPoints - 10) * 0.4;
    pointRadius = Math.max(1.5, Math.min(18, pointRadius));

    const pointGroups = mainChartGroup.selectAll(".data-point-group")
        .data(chartDataArray)
        .enter().append("g")
        .attr("class", "mark data-point-group")
        .attr("transform", d => `translate(${xScale(d[xAxisValueField])}, ${yScale(d[yAxisValueField])})`);

    pointGroups.append("circle")
        .attr("class", "mark data-point-circle")
        .attr("r", pointRadius)
        .style("fill", (d, i) => getColor(d[groupField], uniqueGroupNames.indexOf(d[groupField]), uniqueGroupNames.length))
        .style("opacity", 0.75);

    // Calculate optimal label positions
    let labelPositions = {};
    const findOptimalPosArgs = {
        scales: { xScale, yScale },
        layout: { chartWidth: innerWidth, chartHeight: innerHeight },
        styles: {
            annotation: {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: fillStyle.typography.annotationFontSize,
                fontWeight: fillStyle.typography.annotationFontWeight,
            },
            pointIdentifierField: pointIdentifierField,
            xAxisValueField: xAxisValueField,
            yAxisValueField: yAxisValueField,
        },
        pointRadiusVal: pointRadius
    };

    chartDataArray.forEach(d => {
        labelPositions[d[pointIdentifierField]] = findOptimalPosition(d, chartDataArray, labelPositions, findOptimalPosArgs.scales, findOptimalPosArgs.layout, findOptimalPosArgs.styles, findOptimalPosArgs.pointRadiusVal);
    });
    
    pointGroups.append("text")
        .attr("class", "label data-label")
        .attr("x", d => labelPositions[d[pointIdentifierField]].x)
        .attr("y", d => labelPositions[d[pointIdentifierField]].y)
        .attr("text-anchor", d => labelPositions[d[pointIdentifierField]].anchor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .style("opacity", d => labelPositions[d[pointIdentifierField]].canShow ? 1 : 0)
        .text(d => d[pointIdentifierField]);

    // Block 9: Optional Enhancements & Post-Processing
    // (Label optimization is handled in Block 8)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}