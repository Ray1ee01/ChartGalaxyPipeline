/* REQUIREMENTS_BEGIN
{
  "chart_type": "Scatterplot",
  "chart_name": "scatterplot_01",
  "is_composite": false,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[8, 150], [0, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const y2FieldCol = dataColumns.find(col => col.role === "y2");

    const xFieldName = xFieldCol ? xFieldCol.name : undefined;
    const yFieldName = yFieldCol ? yFieldCol.name : undefined;
    const y2FieldName = y2FieldCol ? y2FieldCol.name : undefined;

    let missingFields = [];
    if (!xFieldName) missingFields.push("x role field");
    if (!yFieldName) missingFields.push("y role field");
    if (!y2FieldName) missingFields.push("y2 role field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = (typographyConfig.title && typographyConfig.title.font_family) || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = (typographyConfig.title && typographyConfig.title.font_size) || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = (typographyConfig.title && typographyConfig.title.font_weight) || defaultTypography.title.font_weight;

    fillStyle.typography.labelFontFamily = (typographyConfig.label && typographyConfig.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (typographyConfig.label && typographyConfig.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (typographyConfig.label && typographyConfig.label.font_weight) || defaultTypography.label.font_weight;
    
    fillStyle.typography.annotationFontFamily = (typographyConfig.annotation && typographyConfig.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (typographyConfig.annotation && typographyConfig.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (typographyConfig.annotation && typographyConfig.annotation.font_weight) || defaultTypography.annotation.font_weight;

    fillStyle.textColor = colorsConfig.text_color || '#0f223b';
    fillStyle.chartBackground = colorsConfig.background_color || '#FFFFFF';
    fillStyle.axisLineColor = colorsConfig.text_color || '#0f223b'; // Often same as text or a bit lighter
    fillStyle.defaultPointColor = (colorsConfig.other && colorsConfig.other.primary) || '#1f77b4';

    function estimateTextMetrics(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox works on elements within an SVG structure, even if not in DOM
        const bbox = tempText.getBBox();
        return { width: bbox.width, height: bbox.height };
    }

    function hasNegativeOrZeroValues(dataArray, field) {
        return dataArray.some(d => d[field] < 1);
    }

    function isDistributionUneven(dataArray, field) {
        if (dataArray.length < 2) return false;
        const values = dataArray.map(d => d[field]).filter(v => typeof v === 'number' && isFinite(v));
        if (values.length < 2) return false;
        
        const extent = d3.extent(values);
        const range = extent[1] - extent[0];
        if (range === 0) return false;

        const median = d3.median(values);
        const q1 = d3.quantile(values.sort(d3.ascending), 0.25);
        const q3 = d3.quantile(values.sort(d3.ascending), 0.75);
        const iqr = q3 - q1;
        
        return iqr > 0 && (range > iqr * 3 || Math.abs(median - (extent[0] + extent[1])/2) > range * 0.2);
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

    const chartMargins = { top: 25, right: 25, bottom: 50, left: 50 };
    if (y2FieldCol && y2FieldCol.name && y2FieldCol.name.length > 0) chartMargins.left += 20; // Extra space for Y axis title
    if (yFieldCol && yFieldCol.name && yFieldCol.name.length > 0) chartMargins.bottom += 20; // Extra space for X axis title


    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const numPoints = chartDataInput.length;
    const circleRadius = numPoints <= 15 ? 15 : Math.max(10, 15 - (numPoints - 15) / 20);

    // Block 6: Scale Definition & Configuration
    const xExtent = d3.extent(chartDataInput, d => d[yFieldName]);
    const yExtent = d3.extent(chartDataInput, d => d[y2FieldName]);

    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartDataInput, yFieldName);
    const xIsUneven = isDistributionUneven(chartDataInput, yFieldName);
    
    const xScale = (!xHasNegativeOrZero && xIsUneven && xExtent[0] > 0) 
        ? d3.scaleLog().clamp(true)
            .domain([Math.max(xExtent[0] * 0.9, 0.01), xExtent[1] * 1.1]) 
            .range([0, innerWidth])
        : d3.scaleLinear()
            .domain(xExtent[0] !== undefined ? [xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1] : [0,1])
            .range([0, innerWidth]);
            
    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartDataInput, y2FieldName);
    const yIsUneven = isDistributionUneven(chartDataInput, y2FieldName);
    
    const yScale = (!yHasNegativeOrZero && yIsUneven && yExtent[0] > 0)
        ? d3.scaleLog().clamp(true)
            .domain([Math.max(yExtent[0] * 0.9, 0.01), yExtent[1] * 1.1])
            .range([innerHeight, 0])
        : d3.scaleLinear()
            .domain(yExtent[0] !== undefined ? [yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1] : [0,1])
            .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxis = d3.axisBottom(xScale)
        .tickSize(0)
        .tickPadding(10);
        
    const yAxis = d3.axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10);
    
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("path")
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1)
        .style("opacity", 0.5);

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);
        
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    yAxisGroup.selectAll("path")
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1)
        .style("opacity", 0.5);

    yAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);
    
    // Axis Titles
    if (yFieldName) {
        mainChartGroup.append("text")
            .attr("class", "label axis-label")
            .attr("x", innerWidth)
            .attr("y", innerHeight + chartMargins.bottom / 2 + 10) // Adjusted y position
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(yFieldName);
    }
        
    if (y2FieldName) {
        mainChartGroup.append("text")
            .attr("class", "label axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", 0) // Adjusted x after rotation
            .attr("y", -chartMargins.left / 2 ) // Adjusted y after rotation
            .attr("dy", "1em") // Shift down slightly
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(y2FieldName);
    }

    // Block 8: Main Data Visualization Rendering
    
    // Helper function to find optimal label position (defined here to close over scales etc.)
    function findOptimalLabelPosition(d, allChartData, currentPositions = {}) {
        const positions = [
            { dx: 20, dy: 4, anchor: "start", priority: 1 },    // right
            { dx: 0, dy: -20, anchor: "middle", priority: 2 },  // top
            { dx: -20, dy: 4, anchor: "end", priority: 3 },     // left
            { dx: 0, dy: 28, anchor: "middle", priority: 4 },   // bottom
            { dx: 20, dy: -20, anchor: "start", priority: 5 },  // top-right
            { dx: -20, dy: -20, anchor: "end", priority: 6 },   // top-left
            { dx: -20, dy: 28, anchor: "end", priority: 7 },    // bottom-left
            { dx: 20, dy: 28, anchor: "start", priority: 8 }    // bottom-right
        ];

        const pointX = xScale(d[yFieldName]);
        const pointY = yScale(d[y2FieldName]);

        if (currentPositions[d[xFieldName]]) {
            return currentPositions[d[xFieldName]];
        }

        const textMetrics = estimateTextMetrics(
            d[xFieldName], 
            fillStyle.typography.annotationFontFamily, 
            fillStyle.typography.annotationFontSize, 
            fillStyle.typography.annotationFontWeight
        );
        const labelWidth = textMetrics.width;
        const labelHeight = textMetrics.height;

        for (const pos of positions) {
            let hasOverlap = false;
            let labelX1, labelY1, labelX2, labelY2;

            // Calculate label bounding box based on anchor
            if (pos.anchor === "start") { // right variants
                labelX1 = pointX + pos.dx;
                labelY1 = pointY + pos.dy - labelHeight / 2; // Vertically center around dy
            } else if (pos.anchor === "middle") { // top, bottom variants
                labelX1 = pointX + pos.dx - labelWidth / 2;
                labelY1 = pointY + pos.dy - (pos.dy < 0 ? labelHeight : 0); // Adjust based on direction
            } else { // end, left variants
                labelX1 = pointX + pos.dx - labelWidth;
                labelY1 = pointY + pos.dy - labelHeight / 2; // Vertically center around dy
            }
            
            // Adjust for specific dy values in original logic
            if (pos.priority === 2) labelY1 = pointY + pos.dy - labelHeight; // top
            if (pos.priority === 4) labelY1 = pointY + pos.dy; // bottom
            if (pos.priority === 5) labelY1 = pointY + pos.dy - labelHeight; // top-right
            if (pos.priority === 6) labelY1 = pointY + pos.dy - labelHeight; // top-left
            if (pos.priority === 7) labelY1 = pointY + pos.dy; // bottom-left
            if (pos.priority === 8) labelY1 = pointY + pos.dy; // bottom-right


            labelX2 = labelX1 + labelWidth;
            labelY2 = labelY1 + labelHeight;
            
            if (labelX1 < 0 || labelX2 > innerWidth || labelY1 < 0 || labelY2 > innerHeight) {
                continue; // Label out of bounds
            }

            for (const p of allChartData) {
                if (p === d) continue;

                const pX = xScale(p[yFieldName]);
                const pY = yScale(p[y2FieldName]);

                // Check overlap with other points
                const dxPoint = (labelX1 + labelX2) / 2 - pX;
                const dyPoint = (labelY1 + labelY2) / 2 - pY;
                const distanceToPointCenter = Math.sqrt(dxPoint*dxPoint + dyPoint*dyPoint);
                if (distanceToPointCenter < circleRadius + Math.max(labelWidth, labelHeight) / 2) { // Simplified check
                    hasOverlap = true;
                    break;
                }

                // Check overlap with other labels
                const pPos = currentPositions[p[xFieldName]];
                if (pPos && pPos.canShow) {
                    const otherMetrics = estimateTextMetrics(
                        p[xFieldName], 
                        fillStyle.typography.annotationFontFamily, 
                        fillStyle.typography.annotationFontSize, 
                        fillStyle.typography.annotationFontWeight
                    );
                    let otherX1, otherY1;
                    // Simplified bounding box for other labels for this check
                    if (pPos.anchor === "start") { otherX1 = pX + pPos.dx; otherY1 = pY + pPos.dy - otherMetrics.height/2; }
                    else if (pPos.anchor === "middle") { otherX1 = pX + pPos.dx - otherMetrics.width/2; otherY1 = pY + pPos.dy - (pPos.dy < 0 ? otherMetrics.height : 0); }
                    else { otherX1 = pX + pPos.dx - otherMetrics.width; otherY1 = pY + pPos.dy - otherMetrics.height/2; }
                    
                    if (pPos.priority === 2) otherY1 = pY + pPos.dy - otherMetrics.height;
                    if (pPos.priority === 4) otherY1 = pY + pPos.dy;
                    if (pPos.priority === 5) otherY1 = pY + pPos.dy - otherMetrics.height;
                    if (pPos.priority === 6) otherY1 = pY + pPos.dy - otherMetrics.height;
                    if (pPos.priority === 7) otherY1 = pY + pPos.dy;
                    if (pPos.priority === 8) otherY1 = pY + pPos.dy;

                    const otherX2 = otherX1 + otherMetrics.width;
                    const otherY2 = otherY1 + otherMetrics.height;

                    if (labelX1 < otherX2 && labelX2 > otherX1 && labelY1 < otherY2 && labelY2 > otherY1) {
                        hasOverlap = true;
                        break;
                    }
                }
            }
            if (hasOverlap) continue;
            return { ...pos, canShow: true };
        }
        return { ...positions[0], canShow: false }; // Default if all overlap
    }

    let labelPositions = {};
    chartDataInput.forEach(d => {
        labelPositions[d[xFieldName]] = findOptimalLabelPosition(d, chartDataInput, labelPositions);
    });

    const pointGroups = mainChartGroup.selectAll(".data-point-group")
        .data(chartDataInput)
        .enter()
        .append("g")
        .attr("class", "mark data-point-group")
        .attr("transform", d => `translate(${xScale(d[yFieldName])}, ${yScale(d[y2FieldName])})`);

    pointGroups.each(function(d) {
        const group = d3.select(this);
        const imageUrl = imagesConfig.field && imagesConfig.field[d[xFieldName]] ? imagesConfig.field[d[xFieldName]] : null;

        if (imageUrl) {
            group.append("image")
                .attr("class", "image mark-image")
                .attr("xlink:href", imageUrl)
                .attr("width", circleRadius * 2)
                .attr("height", circleRadius * 2)
                .attr("x", -circleRadius)
                .attr("y", -circleRadius);
        } else {
            group.append("circle")
                .attr("class", "mark mark-circle-fallback")
                .attr("r", circleRadius)
                .attr("fill", fillStyle.defaultPointColor);
        }
    });
    
    pointGroups.append("text")
        .attr("class", "label data-label")
        .attr("x", d => labelPositions[d[xFieldName]].dx)
        .attr("y", d => labelPositions[d[xFieldName]].dy)
        .attr("text-anchor", d => labelPositions[d[xFieldName]].anchor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .style("opacity", d => labelPositions[d[xFieldName]].canShow ? 1 : 0)
        .text(d => d[xFieldName]);

    // Block 9: Optional Enhancements & Post-Processing
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip") // Assume CSS handles styling
        .style("opacity", 0)
        .style("position", "absolute")
        .style("pointer-events", "none") // Prevent tooltip from interfering with mouse events
        .style("background-color", "white")
        .style("border", "1px solid #ccc")
        .style("padding", "5px")
        .style("border-radius", "3px");

    pointGroups
        .on("mouseover", function(event, d) {
            const currentPoint = d3.select(this);
            currentPoint.select(".mark-image") // Enlarge image if present
                .attr("width", circleRadius * 2 + 6)
                .attr("height", circleRadius * 2 + 6)
                .attr("x", -(circleRadius + 3))
                .attr("y", -(circleRadius + 3));
            currentPoint.select(".mark-circle-fallback") // Enlarge circle if present
                .attr("r", circleRadius + 3);
                
            currentPoint.select(".data-label")
                .style("font-weight", "bold"); // Make label bold
                
            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip.html(`<strong>${d[xFieldName]}</strong><br/>${yFieldName}: ${d[yFieldName]}<br/>${y2FieldName}: ${d[y2FieldName]}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            const currentPoint = d3.select(this);
            currentPoint.select(".mark-image")
                .attr("width", circleRadius * 2)
                .attr("height", circleRadius * 2)
                .attr("x", -circleRadius)
                .attr("y", -circleRadius);
            currentPoint.select(".mark-circle-fallback")
                .attr("r", circleRadius);
                
            currentPoint.select(".data-label")
                .style("font-weight", fillStyle.typography.annotationFontWeight); // Reset label weight
                
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}