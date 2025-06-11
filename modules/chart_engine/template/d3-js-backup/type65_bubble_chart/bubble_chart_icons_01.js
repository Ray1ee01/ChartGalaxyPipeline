/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bubble Chart",
  "chart_name": "bubble_chart_icons_01",
  "is_composite": false,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 750,
  "min_width": 750,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartRawData = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or use data.colors_dark if logic for theme exists
    const images = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldInfo = dataColumns.find(col => col.role === "x");
    const valueXFieldInfo = dataColumns.find(col => col.role === "y");
    const valueYFieldInfo = dataColumns.find(col => col.role === "y2");

    const categoryFieldName = categoryFieldInfo?.name;
    const valueXFieldName = valueXFieldInfo?.name;
    const valueYFieldName = valueYFieldInfo?.name;

    if (!categoryFieldName || !valueXFieldName || !valueYFieldName) {
        const missing = [
            !categoryFieldName ? "x role field" : null,
            !valueXFieldName ? "y role field" : null,
            !valueYFieldName ? "y2 role field" : null
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: [${missing}]. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        return null;
    }
    
    const chartData = chartRawData.filter(d => 
        d[categoryFieldName] !== undefined && d[categoryFieldName] !== null &&
        typeof d[valueXFieldName] === 'number' && isFinite(d[valueXFieldName]) &&
        typeof d[valueYFieldName] === 'number' && isFinite(d[valueYFieldName])
    );


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colors.text_color || '#0f223b',
        backgroundColor: colors.background_color || '#FFFFFF',
        axisLineColor: colors.text_color || '#0f223b', // Defaulting to text_color as in original
        iconCircleBackgroundColor: '#FFFFFF', // Specific design choice for icon visibility
        iconCircleStrokeColor: '#FFFFFF',   // Specific design choice
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) || '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) || 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
        }
    };
    
    const annotationFontSizeNumber = parseFloat(fillStyle.typography.annotationFontSize);

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        let width = 0;
        try {
            // This may return 0 or inaccurate results in some environments if SVG not in DOM.
            // However, it's what the prompt implies by "in-memory SVG structure".
            width = tempText.getBBox().width;
        } catch (e) {
            console.warn("getBBox on detached SVG element failed, using approximate text width. Error: " + e.message);
            const fontSizePx = parseFloat(fontProps.fontSize) || 10;
            width = text.length * fontSizePx * 0.6; // Fallback heuristic
        }
        return width;
    }
    
    function getActualTextBoundingBox(text, x, y, anchor, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('x', '0'); // Position within its own SVG via transform later if needed
        tempText.setAttribute('y', '0'); 
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.setAttribute('text-anchor', anchor);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        
        let bbox = { x: 0, y: 0, width: 0, height: 0 };
        try {
            bbox = tempText.getBBox();
        } catch (e) {
            console.warn("getBBox on detached SVG element failed during bounding box calculation. Error: " + e.message);
            // Fallback if getBBox fails
            const estimatedWidth = estimateTextWidth(text, fontProps);
            const fontSizePx = parseFloat(fontProps.fontSize) || 10;
            bbox.width = estimatedWidth;
            bbox.height = fontSizePx; 
            // Approximate bbox.x, bbox.y based on anchor
            if (anchor === 'middle') bbox.x = -estimatedWidth / 2;
            else if (anchor === 'end') bbox.x = -estimatedWidth;
            else bbox.x = 0;
            bbox.y = -fontSizePx * 0.8; // Approximate y based on typical baseline
        }

        // Adjust bbox coordinates to be relative to the given (x,y) anchor point
        return {
            x1: x + bbox.x,
            y1: y + bbox.y,
            x2: x + bbox.x + bbox.width,
            y2: y + bbox.y + bbox.height,
            width: bbox.width,
            height: bbox.height
        };
    }


    function hasNegativeOrZeroValues(data, field) {
        return data.some(d => d[field] <= 0);
    }

    function isDistributionUneven(data, field) {
        if (data.length < 3) return false; // Not enough data to determine unevenness
        const values = data.map(d => d[field]).filter(v => v > 0); // Log scale only for positive values
        if (values.length < 3) return false;
        
        const sortedValues = values.sort(d3.ascending);
        const extent = [sortedValues[0], sortedValues[sortedValues.length - 1]];
        if (extent[0] <=0) return false; // Should not happen if filtered
        const range = extent[1] - extent[0];
        if (range === 0) return false; // All values are the same

        const median = d3.median(sortedValues);
        const q1 = d3.quantile(sortedValues, 0.25);
        const q3 = d3.quantile(sortedValues, 0.75);
        const iqr = q3 - q1;

        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1]) / 2) > range * 0.2;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 750;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .attr("class", "chart-svg bubble-chart")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 25, right: 25, bottom: 60, left: 60 }; // Increased bottom/left for axis titles
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    // (Data filtering already done in Block 1)
    // Scale type determination helpers (hasNegativeOrZeroValues, isDistributionUneven) are in Block 2.

    // Block 6: Scale Definition & Configuration
    const xExtent = d3.extent(chartData, d => d[valueXFieldName]);
    const yExtent = d3.extent(chartData, d => d[valueYFieldName]);

    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartData, valueXFieldName);
    const xIsUneven = isDistributionUneven(chartData, valueXFieldName);
    
    const xScale = (!xHasNegativeOrZero && xIsUneven && xExtent[0] > 0)
        ? d3.scaleLog().domain([Math.max(xExtent[0] * 0.9, 0.01), xExtent[1] * 1.1]).range([0, innerWidth]).clamp(true)
        : d3.scaleLinear().domain([xExtent[0] > 0 ? xExtent[0] * 0.9 : xExtent[0] * 1.1, xExtent[1] > 0 ? xExtent[1] * 1.1 : xExtent[1] * 0.9]).range([0, innerWidth]).clamp(true);
    if (xExtent[0] === xExtent[1]) xScale.domain([xExtent[0] * 0.9, xExtent[1] * 1.1]); // Handle single value case


    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartData, valueYFieldName);
    const yIsUneven = isDistributionUneven(chartData, valueYFieldName);

    const yScale = (!yHasNegativeOrZero && yIsUneven && yExtent[0] > 0)
        ? d3.scaleLog().domain([Math.max(yExtent[0] * 0.9, 0.01), yExtent[1] * 1.1]).range([innerHeight, 0]).clamp(true)
        : d3.scaleLinear().domain([yExtent[0] > 0 ? yExtent[0] * 0.9 : yExtent[0] * 1.1, yExtent[1] > 0 ? yExtent[1] * 1.1 : yExtent[1] * 0.9]).range([innerHeight, 0]).clamp(true);
    if (yExtent[0] === yExtent[1]) yScale.domain([yExtent[0] * 0.9, yExtent[1] * 1.1]);


    const numPoints = chartData.length;
    const baseRadius = numPoints <= 15 ? 15 : Math.max(10, 15 - (numPoints - 15) / 20);
    const minRadius = baseRadius * 0.5;
    const maxRadius = baseRadius * 1.5;
    
    const radiusValueExtent = d3.extent(chartData, d => d[valueYFieldName]); // Original used y2Field (valueYFieldName) for radius.

    const radiusValueHasNegativeOrZero = hasNegativeOrZeroValues(chartData, valueYFieldName);
    const radiusValueIsUneven = isDistributionUneven(chartData, valueYFieldName);

    let radiusScale;
    if (!radiusValueHasNegativeOrZero && radiusValueIsUneven && radiusValueExtent[0] > 0) {
        const areaScale = d3.scaleLog()
            .domain([Math.max(radiusValueExtent[0], 0.01), radiusValueExtent[1]])
            .range([minRadius * minRadius, maxRadius * maxRadius]);
        radiusScale = d => Math.sqrt(areaScale(d[valueYFieldName]));
    } else {
        const areaScale = d3.scaleLinear()
            .domain(radiusValueExtent[0] === radiusValueExtent[1] ? [radiusValueExtent[0] * 0.9, radiusValueExtent[1] * 1.1] : radiusValueExtent)
            .range([minRadius * minRadius, maxRadius * maxRadius]);
        radiusScale = d => Math.sqrt(Math.max(0, areaScale(d[valueYFieldName]))); // Ensure non-negative for sqrt
    }


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
        .attr("class", "value axis-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    yAxisGroup.selectAll("path")
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1)
        .style("opacity", 0.5);
    yAxisGroup.selectAll("text")
        .attr("class", "value axis-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight);

    mainChartGroup.append("text")
        .attr("class", "text axis-title x-axis-title")
        .attr("x", innerWidth)
        .attr("y", innerHeight + chartMargins.bottom / 2 + 10) // Adjusted y position
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(valueXFieldInfo.label || valueXFieldName);
        
    mainChartGroup.append("text")
        .attr("class", "text axis-title y-axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", 0) // Adjusted x for rotation
        .attr("y", -chartMargins.left / 2 - 5) // Adjusted y for rotation
        .attr("dy", "1em") // Align better
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(valueYFieldInfo.label || valueYFieldName);

    // Block 8: Main Data Visualization Rendering
    const pointsGroup = mainChartGroup.append("g").attr("class", "points-group");
    
    const pointElements = pointsGroup.selectAll(".data-point-group")
        .data(chartData)
        .enter()
        .append("g")
        .attr("class", "mark data-point-group")
        .attr("transform", d => {
            const xPos = xScale(d[valueXFieldName]);
            const yPos = yScale(d[valueYFieldName]);
            return `translate(${isFinite(xPos) ? xPos : -1000}, ${isFinite(yPos) ? yPos : -1000})`; // Move invalid points off-screen
        });

    pointElements.append("circle")
        .attr("class", "image-background") // More specific class
        .attr("r", d => radiusScale(d))
        .attr("fill", fillStyle.iconCircleBackgroundColor)
        .attr("stroke", fillStyle.iconCircleStrokeColor)
        .attr("stroke-width", 2); // Reduced stroke width for cleaner look

    pointElements.each(function(d) {
        const r = radiusScale(d);
        const imageUrl = images.field && images.field[d[categoryFieldName]];
        if (imageUrl && r > 0) {
            d3.select(this).append("image")
                .attr("class", "image data-icon")
                .attr("xlink:href", imageUrl)
                .attr("width", r * 2)
                .attr("height", r * 2)
                .attr("x", -r)
                .attr("y", -r);
        }
    });
    
    // Block 9: Optional Enhancements & Post-Processing (Labels)
    function findOptimalLabelPosition(currentDatum, currentPointX, currentPointY, currentIconRadius, labelText, textStyle, chartW, chartH, existingLabelBounds, allPointsInfo) {
        const candidatePositions = [ // dx, dy, anchor, priority
            { dx: currentIconRadius + 5, dy: 0, anchor: "start", priority: 1 }, // Right
            { dx: 0, dy: -(currentIconRadius + 5), anchor: "middle", priority: 2 }, // Top
            { dx: -(currentIconRadius + 5), dy: 0, anchor: "end", priority: 3 }, // Left
            { dx: 0, dy: currentIconRadius + 5 + annotationFontSizeNumber, anchor: "middle", priority: 4 }, // Bottom
            { dx: currentIconRadius + 5, dy: -(currentIconRadius + 5), anchor: "start", priority: 5 }, // Top-Right
            { dx: -(currentIconRadius + 5), dy: -(currentIconRadius + 5), anchor: "end", priority: 6 }, // Top-Left
            { dx: -(currentIconRadius + 5), dy: currentIconRadius + 5 + annotationFontSizeNumber, anchor: "end", priority: 7 }, // Bottom-Left
            { dx: currentIconRadius + 5, dy: currentIconRadius + 5 + annotationFontSizeNumber, anchor: "start", priority: 8 } // Bottom-Right
        ];

        for (const pos of candidatePositions.sort((a,b) => a.priority - b.priority)) {
            const labelX = currentPointX + pos.dx;
            const labelY = currentPointY + pos.dy;
            
            const labelBounds = getActualTextBoundingBox(labelText, labelX, labelY, pos.anchor, textStyle);

            // Check chart boundaries
            if (labelBounds.x1 < 0 || labelBounds.x2 > chartW || labelBounds.y1 < 0 || labelBounds.y2 > chartH) {
                continue;
            }

            let hasOverlap = false;
            // Check against other placed labels
            for (const otherBounds of existingLabelBounds) {
                if (labelBounds.x1 < otherBounds.x2 && labelBounds.x2 > otherBounds.x1 &&
                    labelBounds.y1 < otherBounds.y2 && labelBounds.y2 > otherBounds.y1) {
                    hasOverlap = true;
                    break;
                }
            }
            if (hasOverlap) continue;

            // Check against other data points (icons)
            for (const pInfo of allPointsInfo) {
                // Skip self - though currentPointX/Y is for currentDatum, pInfo might be the same if not filtered
                if (pInfo.x === currentPointX && pInfo.y === currentPointY) continue; 

                // Simple bounding box for other icon
                const otherIconBounds = {
                    x1: pInfo.x - pInfo.radius, y1: pInfo.y - pInfo.radius,
                    x2: pInfo.x + pInfo.radius, y2: pInfo.y + pInfo.radius
                };
                if (labelBounds.x1 < otherIconBounds.x2 && labelBounds.x2 > otherIconBounds.x1 &&
                    labelBounds.y1 < otherIconBounds.y2 && labelBounds.y2 > otherIconBounds.y1) {
                    hasOverlap = true;
                    break;
                }
            }
            if (hasOverlap) continue;
            
            return { dx: pos.dx, dy: pos.dy, anchor: pos.anchor, bounds: labelBounds }; // Return successful position
        }
        return null; // No suitable position found
    }

    const placedLabelDetails = [];
    const allPointsInfoForLabels = chartData.map(d => ({
        x: xScale(d[valueXFieldName]),
        y: yScale(d[valueYFieldName]),
        radius: radiusScale(d),
        id: d[categoryFieldName] // For debugging or more complex skip logic
    })).filter(p => isFinite(p.x) && isFinite(p.y));


    // Create labels in a separate group on top
    const labelsGroup = mainChartGroup.append("g").attr("class", "labels-group");

    chartData.forEach(d => {
        const pointX = xScale(d[valueXFieldName]);
        const pointY = yScale(d[valueYFieldName]);
        if (!isFinite(pointX) || !isFinite(pointY)) return; // Skip if point is off-scale

        const iconRadius = radiusScale(d);
        const labelText = String(d[categoryFieldName]); // Ensure string
        
        const textStyleProps = {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        };

        const optimalPosition = findOptimalLabelPosition(
            d, pointX, pointY, iconRadius, labelText, textStyleProps,
            innerWidth, innerHeight,
            placedLabelDetails.map(l => l.bounds),
            allPointsInfoForLabels 
        );

        if (optimalPosition) {
            labelsGroup.append("text")
                .attr("class", "label data-label")
                .attr("x", pointX + optimalPosition.dx)
                .attr("y", pointY + optimalPosition.dy)
                .attr("text-anchor", optimalPosition.anchor)
                .style("font-family", textStyleProps.fontFamily)
                .style("font-size", textStyleProps.fontSize)
                .style("font-weight", textStyleProps.fontWeight)
                .style("fill", fillStyle.textColor)
                .text(labelText);
            
            placedLabelDetails.push({ bounds: optimalPosition.bounds });
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}