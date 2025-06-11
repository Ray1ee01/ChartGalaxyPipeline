/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bubble Chart",
  "chart_name": "bubble_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[8, 150], [0, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": [],
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Assuming light theme, or use data.colors_dark if a theme switch is implemented elsewhere
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const y2FieldCol = dataColumns.find(col => col.role === "y2");

    let missingConfigs = [];
    if (!xFieldCol) missingConfigs.push("x field (role 'x') definition in dataColumns");
    if (!yFieldCol) missingConfigs.push("y field (role 'y') definition in dataColumns");
    if (!y2FieldCol) missingConfigs.push("y2 field (role 'y2') definition in dataColumns");
    
    if (missingConfigs.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingConfigs.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const y2FieldName = y2FieldCol.name;

    const xAxisTitleText = yFieldCol.label || yFieldName;
    const yAxisTitleText = y2FieldCol.label || y2FieldName;

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };

    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || defaultTypography.label.font_family,
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || defaultTypography.label.font_size,
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || defaultTypography.label.font_weight,
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || defaultTypography.annotation.font_family,
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || defaultTypography.annotation.font_size,
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || defaultTypography.annotation.font_weight,
        },
        textColor: colorsInput.text_color || defaultColors.text_color,
        axisLineColor: colorsInput.text_color || defaultColors.text_color, // Original used text_color for axis lines
        bubbleBackgroundColor: 'white', // As per original
        bubbleStrokeColor: 'white', // As per original
        chartBackground: colorsInput.background_color || defaultColors.background_color,
    };
    
    function estimateTextMetrics(text, style) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.visibility = 'hidden'; // Ensure it's not visible if appended
        // tempSvg.style.position = 'absolute'; // Ensure it doesn't affect layout if appended
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', style.fontFamily);
        textElement.setAttribute('font-size', style.fontSize);
        textElement.setAttribute('font-weight', style.fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // document.body.appendChild(tempSvg); // Not strictly necessary for getBBox usually
        const bbox = textElement.getBBox();
        // document.body.removeChild(tempSvg); // If appended
        return { width: bbox.width, height: bbox.height };
    }

    function hasNegativeOrZeroValues(data, field) {
        return data.some(d => d[field] <= 0);
    }

    function isDistributionUneven(data, field) {
        if (data.length < 3) return false; // Not enough data to determine unevenness
        const values = data.map(d => d[field]).filter(v => typeof v === 'number' && !isNaN(v));
        if (values.length < 3) return false;
        
        const extent = d3.extent(values);
        const range = extent[1] - extent[0];
        if (range === 0) return false; // All values are the same

        const median = d3.median(values);
        const q1 = d3.quantile(values.sort(d3.ascending), 0.25);
        const q3 = d3.quantile(values.sort(d3.ascending), 0.75);
        const iqr = q3 - q1;
        
        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1])/2) > range * 0.2;
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 25, right: 25, bottom: 60, left: 60 }; // Adjusted bottom/left for axis titles
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const numPoints = chartData.length;
    const baseCircleRadius = numPoints <= 15 ? 15 : Math.max(10, 15 - (numPoints - 15) / 20);
    const radiusFactor = Math.random() * 0.5 + 1; // Preserving original random factor
    const finalIconRadius = baseCircleRadius * radiusFactor;

    // Block 6: Scale Definition & Configuration
    const xValues = chartData.map(d => d[yFieldName]);
    const yValues = chartData.map(d => d[y2FieldName]);

    const xExtent = d3.extent(xValues);
    const yExtent = d3.extent(yValues);

    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartData, yFieldName);
    const xIsUneven = isDistributionUneven(chartData, yFieldName);
    
    const xScale = (!xHasNegativeOrZero && xIsUneven && xExtent[0] > 0) 
        ? d3.scaleLog()
            .domain([Math.max(xExtent[0] * 0.9, 0.01), xExtent[1] * 1.1]) // Ensure domain min is > 0 for log
            .range([0, innerWidth])
        : d3.scaleLinear()
            .domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1])
            .range([0, innerWidth]);
            
    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartData, y2FieldName);
    const yIsUneven = isDistributionUneven(chartData, y2FieldName);
    
    const yScale = (!yHasNegativeOrZero && yIsUneven && yExtent[0] > 0)
        ? d3.scaleLog()
            .domain([Math.max(yExtent[0] * 0.9, 0.01), yExtent[1] * 1.1]) // Ensure domain min is > 0 for log
            .range([innerHeight, 0])
        : d3.scaleLinear()
            .domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1])
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
        .attr("class", "text axis-tick-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.annotationFontFamily) // Tick labels are usually smaller
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
        .attr("class", "text axis-tick-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight);
    
    mainChartGroup.append("text")
        .attr("class", "label axis-title")
        .attr("x", innerWidth)
        .attr("y", innerHeight + chartMargins.bottom / 2 + 10) // Adjusted position
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(xAxisTitleText);
        
    mainChartGroup.append("text")
        .attr("class", "label axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", 0) // Adjusted position
        .attr("y", -chartMargins.left / 2 - 5) // Adjusted position
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(yAxisTitleText);

    // Block 8: Main Data Visualization Rendering
    const pointGroups = mainChartGroup.selectAll(".data-point-group")
        .data(chartData)
        .enter()
        .append("g")
        .attr("class", "mark data-point-group")
        .attr("transform", d => {
            const xPos = xScale(d[yFieldName]);
            const yPos = yScale(d[y2FieldName]);
            // Ensure positions are valid numbers, otherwise place at origin (or handle error)
            return `translate(${isNaN(xPos) ? 0 : xPos}, ${isNaN(yPos) ? 0 : yPos})`;
        });
    
    pointGroups.append("circle")
        .attr("class", "mark bubble-background")
        .attr("r", finalIconRadius)
        .attr("fill", fillStyle.bubbleBackgroundColor)
        .attr("stroke", fillStyle.bubbleStrokeColor)
        .attr("stroke-width", 4);
    
    pointGroups.append("image")
        .attr("class", "image bubble-icon")
        .attr("xlink:href", d => imagesInput.field && imagesInput.field[d[xFieldName]] ? imagesInput.field[d[xFieldName]] : null)
        .attr("width", finalIconRadius * 2)
        .attr("height", finalIconRadius * 2)
        .attr("x", -finalIconRadius)
        .attr("y", -finalIconRadius)
        .each(function(d) { // Hide if image URL is missing
            const url = imagesInput.field && imagesInput.field[d[xFieldName]] ? imagesInput.field[d[xFieldName]] : null;
            if (!url) {
                d3.select(this).remove();
            }
        });

    // Block 9: Optional Enhancements & Post-Processing (Labeling, Tooltip, Interactivity)
    const labelTextStyle = {
        fontFamily: fillStyle.typography.annotationFontFamily,
        fontSize: fillStyle.typography.annotationFontSize,
        fontWeight: fillStyle.typography.annotationFontWeight,
    };

    function getLabelMetrics(text) {
        return estimateTextMetrics(text, labelTextStyle);
    }
    
    function findOptimalLabelPosition(d, currentItemXVal, allDataPoints, occupiedLabelPositions, 
                                      itemXScale, itemYScale, chartW, chartH, 
                                      itemXFieldName, itemYFieldName, itemY2FieldName, itemIconRadius, 
                                      getMetricsFn) {
        const candidateOffsets = [
            { x: itemIconRadius + 5, y: 0, anchor: "start", priority: 1 },  // right
            { x: 0, y: -(itemIconRadius + 5), anchor: "middle", priority: 2 },// top
            { x: -(itemIconRadius + 5), y: 0, anchor: "end", priority: 3 },   // left
            { x: 0, y: itemIconRadius + 5, anchor: "middle", priority: 4 }, // bottom
            { x: itemIconRadius + 3, y: -(itemIconRadius + 3), anchor: "start", priority: 5 }, // top-right
            { x: -(itemIconRadius + 3), y: -(itemIconRadius + 3), anchor: "end", priority: 6 },   // top-left
            { x: -(itemIconRadius + 3), y: itemIconRadius + 3, anchor: "end", priority: 7 },  // bottom-left
            { x: itemIconRadius + 3, y: itemIconRadius + 3, anchor: "start", priority: 8 }   // bottom-right
        ];

        const currentPointX = itemXScale(d[itemYFieldName]);
        const currentPointY = itemYScale(d[itemY2FieldName]);
        if (isNaN(currentPointX) || isNaN(currentPointY)) return candidateOffsets[0]; // Fallback

        const currentLabelText = String(d[itemXFieldName]);
        const currentLabelMetrics = getMetricsFn(currentLabelText);

        for (const pos of candidateOffsets) {
            let labelX, labelY;
            if (pos.anchor === "start") labelX = currentPointX + pos.x;
            else if (pos.anchor === "end") labelX = currentPointX + pos.x - currentLabelMetrics.width;
            else labelX = currentPointX + pos.x - currentLabelMetrics.width / 2;
            labelY = currentPointY + pos.y - currentLabelMetrics.height / 2; // Rough vertical centering for text-anchor middle

            // Adjust Y for text-anchor middle/end/start based on dominant-baseline or dy, simplified here
             if (pos.anchor === "middle" && (pos.priority === 2 || pos.priority === 4)) { // Top or Bottom
                labelY = currentPointY + pos.y + (pos.y < 0 ? -2 : currentLabelMetrics.height * 0.8) ; // Adjust for text baseline
            } else { // Side positions
                labelY = currentPointY + pos.y + currentLabelMetrics.height / 4; // Empiric adjustment
            }


            const currentLabelBBox = {
                x1: labelX,
                y1: labelY - currentLabelMetrics.height, // BBox y is typically top
                x2: labelX + currentLabelMetrics.width,
                y2: labelY
            };
            
            if (pos.anchor === "start") { // right
                currentLabelBBox.x1 = currentPointX + pos.x;
                currentLabelBBox.x2 = currentLabelBBox.x1 + currentLabelMetrics.width;
            } else if (pos.anchor === "end") { // left
                currentLabelBBox.x2 = currentPointX + pos.x;
                currentLabelBBox.x1 = currentLabelBBox.x2 - currentLabelMetrics.width;
            } else { // middle
                currentLabelBBox.x1 = currentPointX + pos.x - currentLabelMetrics.width / 2;
                currentLabelBBox.x2 = currentLabelBBox.x1 + currentLabelMetrics.width;
            }
            // Common Y calculation for bounding box
            if (pos.y < 0 && pos.x === 0) { // top
                 currentLabelBBox.y1 = currentPointY + pos.y - currentLabelMetrics.height;
                 currentLabelBBox.y2 = currentPointY + pos.y;
            } else if (pos.y > 0 && pos.x === 0) { // bottom
                 currentLabelBBox.y1 = currentPointY + pos.y;
                 currentLabelBBox.y2 = currentPointY + pos.y + currentLabelMetrics.height;
            } else { // sides or corners
                 currentLabelBBox.y1 = currentPointY + pos.y - currentLabelMetrics.height / 2;
                 currentLabelBBox.y2 = currentPointY + pos.y + currentLabelMetrics.height / 2;
            }


            // Check chart boundaries
            if (currentLabelBBox.x1 < 0 || currentLabelBBox.x2 > chartW || currentLabelBBox.y1 < 0 || currentLabelBBox.y2 > chartH) {
                continue;
            }

            let hasOverlap = false;
            // Check overlap with other points' icons
            for (const otherPoint of allDataPoints) {
                if (otherPoint[itemXFieldName] === currentItemXVal) continue;
                const otherPointX = itemXScale(otherPoint[itemYFieldName]);
                const otherPointY = itemYScale(otherPoint[itemY2FieldName]);
                if (isNaN(otherPointX) || isNaN(otherPointY)) continue;

                // Simplified collision: label bbox vs other icon bbox
                const otherIconBBox = {
                    x1: otherPointX - itemIconRadius, y1: otherPointY - itemIconRadius,
                    x2: otherPointX + itemIconRadius, y2: otherPointY + itemIconRadius
                };
                if (currentLabelBBox.x1 < otherIconBBox.x2 && currentLabelBBox.x2 > otherIconBBox.x1 &&
                    currentLabelBBox.y1 < otherIconBBox.y2 && currentLabelBBox.y2 > otherIconBBox.y1) {
                    hasOverlap = true;
                    break;
                }
            }
            if (hasOverlap) continue;

            // Check overlap with already placed labels (from occupiedLabelPositions)
            for (const placedLabel of occupiedLabelPositions) {
                 if (currentLabelBBox.x1 < placedLabel.x2 && currentLabelBBox.x2 > placedLabel.x1 &&
                    currentLabelBBox.y1 < placedLabel.y2 && currentLabelBBox.y2 > placedLabel.y1) {
                    hasOverlap = true;
                    break;
                }
            }
            if (hasOverlap) continue;
            
            return { ...pos, bbox: currentLabelBBox }; // Return first non-overlapping position
        }
        return { ...candidateOffsets[0], bbox: null }; // Fallback to first priority if all overlap (bbox might be null or approximate)
    }
    
    let assignedLabelPositions = {}; // Stores { x, y, anchor, priority, bbox } for each xFieldName value
    let iterations = 0;
    const MAX_LABEL_ITERATIONS = 3; // As per original

    // Iterative refinement (simplified from original's complex intent)
    // The original iterative loop was complex and its break condition flawed.
    // This simplified version just runs MAX_LABEL_ITERATIONS.
    // A more robust iterative solution would involve a cost function and simulated annealing or similar.
    // For now, we stick to a few passes of greedy assignment.
    // The "final check" loop from original is more dominant for collision.
    
    // The original iterative loop (`while (iterations < MAX_ITERATIONS)`) was intended to populate `currentPositions`.
    // Then, a separate loop rendered labels using these `currentPositions` AND performed another greedy overlap check.
    // We will combine this: the iterative part is less about global optimization here and more about
    // ensuring `findOptimalLabelPosition` has a somewhat stable set of `occupiedLabelPositions` to check against.
    // The primary anti-collision will be the greedy check during rendering.

    const finalLabelLayouts = []; // Stores { text, x, y, anchor, bbox } for rendered labels

    pointGroups.each(function(d) {
        const dataItem = d;
        const itemXValue = dataItem[xFieldName];
        
        // Find best position considering previously laid out labels in `finalLabelLayouts`
        const bestPosition = findOptimalLabelPosition(dataItem, itemXValue, chartData, finalLabelLayouts.map(l => l.bbox),
                                   xScale, yScale, innerWidth, innerHeight,
                                   xFieldName, yFieldName, y2FieldName, finalIconRadius,
                                   getLabelMetrics);

        if (bestPosition && bestPosition.bbox) { // Only render if a non-overlapping position was found and bbox is valid
            d3.select(this).append("text")
                .attr("class", "label data-label")
                .attr("x", bestPosition.x)
                .attr("y", bestPosition.y)
                .attr("text-anchor", bestPosition.anchor)
                .style("font-family", labelTextStyle.fontFamily)
                .style("font-size", labelTextStyle.fontSize)
                .style("font-weight", labelTextStyle.fontWeight)
                .style("fill", fillStyle.textColor)
                .text(itemXValue)
                .attr("dy", ".35em"); // Vertical alignment tweak

            finalLabelLayouts.push({ 
                text: itemXValue, 
                x: bestPosition.x, 
                y: bestPosition.y, 
                anchor: bestPosition.anchor, 
                bbox: bestPosition.bbox 
            });
        }
    });
    
    // Tooltip (append to body, style externally or with minimal inline styles)
    const tooltip = d3.select("body").append("div")
        .attr("class", "chart-tooltip") // Standardized class name
        .style("opacity", 0)
        .style("position", "absolute")
        .style("padding", "8px")
        .style("background", "rgba(0,0,0,0.75)")
        .style("color", "white")
        .style("border-radius", "4px")
        .style("pointer-events", "none") // Important for mouseout
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize);

    pointGroups
        .on("mouseover", function(event, d) {
            const group = d3.select(this);
            group.select(".bubble-icon") // Image
                .attr("width", finalIconRadius * 2 * 1.1)
                .attr("height", finalIconRadius * 2 * 1.1)
                .attr("x", -finalIconRadius * 1.1)
                .attr("y", -finalIconRadius * 1.1);
                
            group.select(".data-label")
                .style("font-weight", "bold");
                
            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip.html(`<strong>${d[xFieldName]}</strong><br/>${yFieldName}: ${d[yFieldName]}<br/>${y2FieldName}: ${d[y2FieldName]}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            const group = d3.select(this);
            group.select(".bubble-icon")
                .attr("width", finalIconRadius * 2)
                .attr("height", finalIconRadius * 2)
                .attr("x", -finalIconRadius)
                .attr("y", -finalIconRadius);
                
            group.select(".data-label")
                .style("font-weight", labelTextStyle.fontWeight); // Revert to original weight
                
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // Block 10: Cleanup & SVG Node Return
    // Tooltip is appended to body, standard practice is to remove it on chart destruction,
    // but this function only creates. If this function were part of a class or module,
    // a cleanup method would handle tooltip removal.
    
    return svgRoot.node();
}