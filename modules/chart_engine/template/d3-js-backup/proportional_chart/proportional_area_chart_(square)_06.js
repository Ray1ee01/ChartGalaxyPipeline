/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Square)",
  "chart_name": "proportional_area_chart_square_06",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawData = data.data;
    const chartData = rawData.data.filter(d => d !== null && typeof d === 'object'); // Basic filter for valid objects
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming dark theme preference if both exist, or just one
    const images = data.images || {};
    const dataColumns = rawData.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(c => c.role === "x");
    const yFieldCol = dataColumns.find(c => c.role === "y");

    const categoryFieldName = xFieldCol?.name;
    const valueFieldName = yFieldCol?.name;
    const valueFieldUnit = yFieldCol?.unit === "none" ? "" : yFieldCol?.unit || "";

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x field (category)");
        if (!valueFieldName) missingFields.push("y field (value)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const processedChartData = chartData.filter(d => d[valueFieldName] != null && +d[valueFieldName] > 0);
    if (!processedChartData.length) {
        d3.select(containerSelector).html("<div style='padding:10px;'>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        categoryColorMap: {},
        iconUrls: {},
    };

    // Typography
    fillStyle.typography.valueFontFamily = (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif';
    fillStyle.typography.valueFontSize = (typography.annotation && typography.annotation.font_size) ? parseFloat(typography.annotation.font_size) : 12;
    fillStyle.typography.valueFontWeight = (typography.annotation && typography.annotation.font_weight) || 'bold';

    fillStyle.typography.categoryFontFamily = (typography.label && typography.label.font_family) || 'Arial, sans-serif';
    fillStyle.typography.categoryFontSize = (typography.label && typography.label.font_size) ? parseFloat(typography.label.font_size) : 11;
    fillStyle.typography.categoryFontWeight = (typography.label && typography.label.font_weight) || 'normal';
    
    fillStyle.typography.externalLabelFontSize = 12; // Fixed size for external labels as per original logic

    // Colors
    fillStyle.textColor = colors.text_color || '#333333'; // Default general text color
    fillStyle.chartBackground = colors.background_color || '#FFFFFF'; // Default background
    fillStyle.primaryAccent = (colors.other && colors.other.primary) || '#007bff';
    fillStyle.defaultCategoryColors = colors.available_colors || d3.schemeTableau10;
    fillStyle.rectStrokeColor = '#FFFFFF'; // Default stroke for rects

    if (colors.field) {
        Object.keys(colors.field).forEach(key => {
            if (dataColumns.some(col => col.name === key && col.role === 'x')) { // Check if the key is the category field name
                 Object.assign(fillStyle.categoryColorMap, colors.field[key]);
            } else if (key === categoryFieldName) { // Direct mapping for the category field
                 Object.assign(fillStyle.categoryColorMap, colors.field[key]);
            } else { // Fallback for older structures where colors.field was the map itself for the primary category
                 Object.assign(fillStyle.categoryColorMap, colors.field);
            }
        });
    }
    
    // Images / Icons
    if (images.field) {
         Object.keys(images.field).forEach(key => {
            if (dataColumns.some(col => col.name === key && col.role === 'x')) {
                 Object.assign(fillStyle.iconUrls, images.field[key]);
            } else if (key === categoryFieldName) {
                 Object.assign(fillStyle.iconUrls, images.field[key]);
            } else {
                 Object.assign(fillStyle.iconUrls, images.field); // Fallback for older structures
            }
        });
    }
    fillStyle.defaultIconUrl = (images.other && images.other.primary) || null;


    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', `${fontSize}px`);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // document.body.appendChild(tempSvg); // Temporarily append to measure accurately
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            console.warn("Failed to measure text width with getBBox:", e);
        }
        // tempSvg.remove();
        return width;
    }

    function getColorBrightness(colorStr) {
        if (!colorStr) return 0.5; // Default for invalid color
        let r, g, b;
        if (colorStr.startsWith('rgba')) {
            const match = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
            if (match) [, r, g, b] = match.map(Number); else return 0.5;
        } else if (colorStr.startsWith('rgb')) {
            const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) [, r, g, b] = match.map(Number); else return 0.5;
        } else if (colorStr.startsWith('#')) {
            let hex = colorStr.substring(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            if (hex.length !== 6) return 0.5;
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else { // Named colors or other formats not directly supported here for brightness calculation
            return 0.5; // Or use a more sophisticated color parser
        }
        return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    }

    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? '#000000' : '#FFFFFF'; // Dark text on light bg, light text on dark bg
    }

    function truncateText(text, maxWidth, fontFamily, fontSize, fontWeight) {
        if (!text) return '';
        if (estimateTextWidth(text, fontFamily, fontSize, fontWeight) <= maxWidth) {
            return text;
        }
        const ellipsis = '...';
        const ellipsisWidth = estimateTextWidth(ellipsis, fontFamily, fontSize, fontWeight);
        let truncated = text;
        while (truncated.length > 0 && estimateTextWidth(truncated + ellipsis, fontFamily, fontSize, fontWeight) > maxWidth) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + ellipsis;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "proportional-area-chart-svg") // Standardized class
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 30, right: 20, bottom: 30, left: 20 }; // Adjusted margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "plot-area other");


    const FILL_RATIO = 0.55; // Square fill ratio of the drawing area
    const MIN_SIDE = 20 * 2; // Min side length for a square (derived from minRadius)
    const MAX_SIDE_ABS = 200; // Absolute max side length
    const MAX_SIDE = Math.min(innerHeight / 2.5, MAX_SIDE_ABS); // Effective max side
    const TOP_PROTECTED_AREA = 10; // Small top protected area
    const SMALL_RECT_THRESHOLD = 35; // Rects smaller than this have external labels

    // Block 5: Data Preprocessing & Transformation
    const valueExtent = d3.extent(processedChartData, d => +d[valueFieldName]);
    const minYValue = valueExtent[0] || 0;
    const maxYValue = valueExtent[1] || 0;

    const maxTotalArea = innerWidth * innerHeight * FILL_RATIO;
    const totalValueSum = d3.sum(processedChartData, d => +d[valueFieldName]);
    const areaPerUnitValue = totalValueSum > 0 ? maxTotalArea / totalValueSum : 0;
    
    const uniqueCategories = [...new Set(processedChartData.map(d => d[categoryFieldName]))];

    const nodesData = processedChartData.map((d, i) => ({
        id: d[categoryFieldName] != null ? String(d[categoryFieldName]) : `__auto_id_${i}__`,
        value: +d[valueFieldName],
        area: +d[valueFieldName] * areaPerUnitValue,
        color: fillStyle.categoryColorMap[d[categoryFieldName]] || fillStyle.defaultCategoryColors[uniqueCategories.indexOf(d[categoryFieldName]) % fillStyle.defaultCategoryColors.length],
        iconUrl: fillStyle.iconUrls[d[categoryFieldName]] || null, // Use specific or no icon
        originalData: d
    })).sort((a, b) => b.value - a.value);

    // Block 6: Scale Definition & Configuration
     const sideScale = d3.scaleSqrt()
        .domain([0, maxYValue]) // Domain from 0 to max value
        .range([MIN_SIDE, MAX_SIDE]); // Range of side lengths

    const dynamicScalingFactor = (maxYValue - minYValue) < (maxYValue * 0.3) && maxYValue > 0 ? 0.7 : 1;

    nodesData.forEach(node => {
        let side = sideScale(node.value) * dynamicScalingFactor;
        side = Math.max(MIN_SIDE, Math.min(side, MAX_SIDE));
        node.width = side;
        node.height = side;
        node.area = side * side; // Update area based on actual side
        node.isSmallRect = side < SMALL_RECT_THRESHOLD;
    });

    const initialTotalNodeArea = d3.sum(nodesData, d => d.area);
    if (initialTotalNodeArea > maxTotalArea && initialTotalNodeArea > 0) {
        const areaScaleFactor = Math.sqrt(maxTotalArea / initialTotalNodeArea);
        nodesData.forEach(node => {
            node.width *= areaScaleFactor;
            node.height *= areaScaleFactor;
            node.area = node.width * node.height;
            node.isSmallRect = node.width < SMALL_RECT_THRESHOLD; // Re-check after scaling
        });
    }
    
    nodesData.forEach((d, i) => {
        d.zIndex = nodesData.length - i; // Smaller areas (later in sorted list) get higher zIndex
    });


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes or legend for this chart type.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    // Force Simulation Setup
    function assignInitialPositions() {
        const numNodes = nodesData.length;
        if (numNodes === 0) return;
        const gridSide = Math.ceil(Math.sqrt(numNodes));
        const maxNodeWidth = d3.max(nodesData, d => d.width) || MIN_SIDE;
        const cellSize = Math.max(maxNodeWidth, Math.sqrt((innerWidth * innerHeight) / (gridSide * gridSide)));
        
        const centerX = innerWidth / 2;
        const centerY = innerHeight / 2;
        const startX = centerX - (cellSize * (gridSide - 1)) / 2;
        const startY = centerY - (cellSize * (gridSide - 1)) / 2;

        let cells = [];
        for (let row = 0; row < gridSide; row++) {
            for (let col = 0; col < gridSide; col++) {
                const distToCenter = Math.sqrt(Math.pow(row - (gridSide - 1) / 2, 2) + Math.pow(col - (gridSide - 1) / 2, 2));
                cells.push({ row, col, distance: distToCenter });
            }
        }
        cells.sort((a, b) => a.distance - b.distance); // Sort cells by distance to center

        nodesData.forEach((node, i) => {
            const cell = cells[i % cells.length]; // Cycle through cells if more nodes than grid spots
            const jitter = cellSize * 0.1;
            node.x = startX + cell.col * cellSize + cellSize / 2 + (Math.random() - 0.5) * jitter;
            node.y = startY + cell.row * cellSize + cellSize / 2 + (Math.random() - 0.5) * jitter;
            node.x = Math.max(node.width / 2, Math.min(innerWidth - node.width / 2, node.x));
            node.y = Math.max(TOP_PROTECTED_AREA + node.height / 2, Math.min(innerHeight - node.height / 2, node.y));
        });

        if (nodesData.length > 0 && nodesData[0]) { // Largest node slightly towards center
            nodesData[0].fx = innerWidth / 2 + (Math.random() - 0.5) * 20;
            nodesData[0].fy = innerHeight / 2 + (Math.random() - 0.5) * 20;
        }
    }
    assignInitialPositions();

    function rectCollide() {
        let currentNodes = [];
        let strength = 1;
        const PADDING = 15; // Increased padding between rects

        function force(alpha) {
            const quadtree = d3.quadtree().x(d => d.x).y(d => d.y).addAll(currentNodes);
            for (let i = 0; i < currentNodes.length; ++i) {
                const nodeA = currentNodes[i];
                const rAW = nodeA.width / 2 + PADDING;
                const rAH = nodeA.height / 2 + PADDING;
                quadtree.visit((quad, x1, y1, x2, y2) => {
                    if (!quad.length) {
                        do {
                            const nodeB = quad.data;
                            if (nodeB && nodeB !== nodeA) {
                                const dx = nodeA.x - nodeB.x;
                                const dy = nodeA.y - nodeB.y;
                                const absDx = Math.abs(dx);
                                const absDy = Math.abs(dy);
                                
                                const rBW = nodeB.width / 2;
                                const rBH = nodeB.height / 2;

                                const overlapX = (rAW + rBW) - absDx;
                                const overlapY = (rAH + rBH) - absDy;

                                if (overlapX > 0 && overlapY > 0) {
                                    const f = strength * alpha * 1.2; // Enhanced repulsion
                                    let fx = (overlapX < overlapY ? overlapX : 0) * (dx > 0 ? 1 : -1) * f;
                                    let fy = (overlapY < overlapX ? overlapY : 0) * (dy > 0 ? 1 : -1) * f;
                                    
                                    // If primarily x-overlap, push more in y, and vice-versa
                                    if (overlapX > overlapY * 1.1) fy *= 1.8; 
                                    else if (overlapY > overlapX * 1.1) fx *= 1.8;

                                    const totalArea = nodeA.area + nodeB.area;
                                    const ratioA = totalArea > 0 ? nodeB.area / totalArea : 0.5;
                                    const ratioB = totalArea > 0 ? nodeA.area / totalArea : 0.5;

                                    if (!nodeA.fx) { nodeA.x += fx * ratioA; nodeA.y += fy * ratioA; }
                                    if (!nodeB.fx) { nodeB.x -= fx * ratioB; nodeB.y -= fy * ratioB; }
                                }
                            }
                        } while (quad = quad.next);
                    }
                    return x1 > nodeA.x + rAW + MAX_SIDE || x2 < nodeA.x - rAW - MAX_SIDE || 
                           y1 > nodeA.y + rAH + MAX_SIDE || y2 < nodeA.y - rAH - MAX_SIDE;
                });
            }
        }
        force.initialize = (_) => { currentNodes = _; };
        force.strength = (_) => { strength = _ == null ? strength : _; return force; };
        return force;
    }
    
    const simulation = d3.forceSimulation(nodesData)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.05))
        .force("charge", d3.forceManyBody().strength(-35)) // Slightly stronger repulsion
        .force("collide", rectCollide().strength(1.2))
        .force("x", d3.forceX(innerWidth / 2).strength(0.02))
        .force("y", d3.forceY(innerHeight / 2).strength(0.02))
        .stop();

    const NUM_ITERATIONS = 400;
    for (let i = 0; i < NUM_ITERATIONS; ++i) {
        simulation.tick();
        nodesData.forEach(d => {
            if (d.fx) d.x = d.fx; // Respect fixed positions
            if (d.fy) d.y = d.fy;

            // Boundary constraints
            d.x = Math.max(d.width / 2 + 1, Math.min(innerWidth - d.width / 2 - 1, d.x));
            d.y = Math.max(TOP_PROTECTED_AREA + d.height / 2 + 1, Math.min(innerHeight - d.height / 2 - 1, d.y));
        });
    }
    if (nodesData.length > 0 && nodesData[0] && nodesData[0].fx !== undefined) { // Unfix the largest node after initial placement
        delete nodesData[0].fx;
        delete nodesData[0].fy;
    }


    const nodeGroups = mainChartGroup.selectAll("g.node-group")
        .data(nodesData, d => d.id)
        .join("g")
        .attr("class", "node-group other") // Group for rect, icon, text
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .sort((a, b) => a.zIndex - b.zIndex);

    nodeGroups.append("rect")
        .attr("class", "mark")
        .attr("x", d => -d.width / 2)
        .attr("y", d => -d.height / 2)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("fill", d => d.color)
        .attr("stroke", fillStyle.rectStrokeColor)
        .attr("stroke-width", 1.5)
        .attr("rx", 3) // Standardized small rounded corners
        .attr("ry", 3);

    // Block 9: Optional Enhancements & Post-Processing
    // Icons
    nodeGroups.each(function(d) {
        if (d.width > 50 && d.iconUrl) {
            const gNode = d3.select(this);
            const iconSize = d.width / 2.2; // Icon size relative to square width
            const yOffset = -d.height / 4 + 5; // Position icon in upper part

            gNode.append("circle")
                .attr("class", "icon-background other")
                .attr("cx", 0)
                .attr("cy", yOffset)
                .attr("r", iconSize / 2)
                .attr("fill", "white")
                .attr("fill-opacity", 0.6)
                .attr("stroke", "#DDDDDD")
                .attr("stroke-width", 1);

            gNode.append("image")
                .attr("class", "icon image")
                .attr("xlink:href", d.iconUrl)
                .attr("x", -iconSize / 2 * 0.8) // Slightly smaller image within circle
                .attr("y", yOffset - iconSize / 2 * 0.8)
                .attr("width", iconSize * 0.8)
                .attr("height", iconSize * 0.8)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });

    // Text Labels
    const MIN_ACCEPTABLE_FONT_SIZE = 8;
    const MIN_SIDE_FOR_CATEGORY_LABEL = 10;
    const FONT_SIZE_SCALE_FACTOR = 0.38;
    const MAX_FONT_SIZE = 28;
    const CAT_LINE_HEIGHT_FACTOR = 0.3; // Multiplier for line height based on font size
    const EXTERNAL_LABEL_PADDING = 5;
    const CANVAS_EDGE_PADDING = 10;

    nodeGroups.each(function(d) {
        const gNode = d3.select(this);
        const side = d.width;
        const valueTextContent = `${d.value}${valueFieldUnit}`;
        let categoryTextContent = d.id.startsWith("__auto_id_") ? "" : d.id;
        const adaptiveTextColor = getTextColorForBackground(d.color);

        if (d.isSmallRect) { // External labels for small rects
            const combinedText = categoryTextContent ? `${categoryTextContent}: ${valueTextContent}` : valueTextContent;
            let currentFontSize = fillStyle.typography.externalLabelFontSize;
            
            let availableWidthForLabel = Math.min(innerWidth * 0.9, // Max 90% of chart width
                                                  innerWidth - 2 * CANVAS_EDGE_PADDING); // Ensure stays within padded area
            if (d.x - availableWidthForLabel/2 < CANVAS_EDGE_PADDING) availableWidthForLabel = (d.x - CANVAS_EDGE_PADDING) * 2;
            if (d.x + availableWidthForLabel/2 > innerWidth - CANVAS_EDGE_PADDING) availableWidthForLabel = (innerWidth - CANVAS_EDGE_PADDING - d.x) * 2;
            availableWidthForLabel = Math.max(availableWidthForLabel, MIN_SIDE * 0.8);


            let finalText = combinedText;
            if (estimateTextWidth(combinedText, fillStyle.typography.valueFontFamily, currentFontSize, fillStyle.typography.valueFontWeight) > availableWidthForLabel) {
                 currentFontSize = Math.max(MIN_ACCEPTABLE_FONT_SIZE, currentFontSize - 2);
                 if (estimateTextWidth(combinedText, fillStyle.typography.valueFontFamily, currentFontSize, fillStyle.typography.valueFontWeight) > availableWidthForLabel) {
                    finalText = truncateText(combinedText, availableWidthForLabel, fillStyle.typography.valueFontFamily, currentFontSize, fillStyle.typography.valueFontWeight);
                 }
            }
            
            let yPosition, textBaseline;
            const spaceBelow = innerHeight - (d.y + side / 2);
            const spaceAbove = d.y - side / 2 - TOP_PROTECTED_AREA;

            if (spaceBelow >= currentFontSize + EXTERNAL_LABEL_PADDING * 2) {
                yPosition = side / 2 + EXTERNAL_LABEL_PADDING;
                textBaseline = "hanging";
            } else if (spaceAbove >= currentFontSize + EXTERNAL_LABEL_PADDING * 2) {
                yPosition = -side / 2 - EXTERNAL_LABEL_PADDING;
                textBaseline = "text-after-edge";
            } else { // Try to fit inside if no space outside, or very small font
                currentFontSize = Math.min(currentFontSize, side * 0.4, MAX_FONT_SIZE);
                yPosition = 0; 
                textBaseline = "middle";
            }

            if (currentFontSize >= MIN_ACCEPTABLE_FONT_SIZE) {
                gNode.append("text")
                    .attr("class", "text label") // Combined label
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", textBaseline)
                    .attr("y", yPosition)
                    .style("font-family", fillStyle.typography.valueFontFamily)
                    .style("font-size", `${currentFontSize}px`)
                    .style("font-weight", fillStyle.typography.valueFontWeight)
                    .style("fill", textBaseline === "middle" ? adaptiveTextColor : fillStyle.textColor)
                    .text(finalText);
            }
            return; // Skip internal labels
        }

        // Internal labels for larger rects
        let currentFontSize = Math.max(
            MIN_ACCEPTABLE_FONT_SIZE,
            Math.min(side * FONT_SIZE_SCALE_FACTOR, (fillStyle.typography.valueFontSize + fillStyle.typography.categoryFontSize) / 2, MAX_FONT_SIZE)
        );
        
        const maxTextWidthInside = side * 0.85;
        let valueWidth, categoryWidth, categoryLines = 1, categoryLabelHeight = currentFontSize, shouldWrapCategory = false;
        const isLargeSquareWithIcon = d.width > 50 && d.iconUrl; // Text position adjusted if icon present

        while (currentFontSize >= MIN_ACCEPTABLE_FONT_SIZE) {
            valueWidth = estimateTextWidth(valueTextContent, fillStyle.typography.valueFontFamily, currentFontSize, fillStyle.typography.valueFontWeight);
            categoryWidth = categoryTextContent ? estimateTextWidth(categoryTextContent, fillStyle.typography.categoryFontFamily, currentFontSize, fillStyle.typography.categoryFontWeight) : 0;
            
            let valueFits = valueWidth <= maxTextWidthInside;
            let categoryFits = !categoryTextContent || categoryWidth <= maxTextWidthInside;
            shouldWrapCategory = false;

            if (categoryTextContent && !categoryFits && currentFontSize >= MIN_ACCEPTABLE_FONT_SIZE + 2) { // Try wrapping if font not too small
                const words = categoryTextContent.split(/\s+/);
                let lines = [];
                let currentLineTest = "";
                if (words.length <=1 && categoryTextContent.length > 5) { // single long word, try char wrapping
                    let tempLine = "";
                    for(let char of categoryTextContent.split('')) {
                        if(estimateTextWidth(tempLine + char, fillStyle.typography.categoryFontFamily, currentFontSize, fillStyle.typography.categoryFontWeight) > maxTextWidthInside && tempLine.length > 0) {
                            lines.push(tempLine); tempLine = char;
                        } else { tempLine += char; }
                    }
                    if(tempLine) lines.push(tempLine);
                } else { // word wrapping
                    let tempLine = [];
                    for(let word of words) {
                        if(estimateTextWidth(tempLine.join(" ") + (tempLine.length > 0 ? " " : "") + word, fillStyle.typography.categoryFontFamily, currentFontSize, fillStyle.typography.categoryFontWeight) > maxTextWidthInside && tempLine.length > 0) {
                            lines.push(tempLine.join(" ")); tempLine = [word];
                        } else { tempLine.push(word); }
                    }
                    if(tempLine.length > 0) lines.push(tempLine.join(" "));
                }

                categoryLines = lines.length;
                categoryLabelHeight = categoryLines * currentFontSize * (1 + CAT_LINE_HEIGHT_FACTOR) - (CAT_LINE_HEIGHT_FACTOR * currentFontSize); // Adjusted height
                
                const totalTextHeight = categoryLabelHeight + (valueTextContent ? currentFontSize + currentFontSize * CAT_LINE_HEIGHT_FACTOR * 0.5 : 0);
                if (categoryLines > 0 && categoryLines <=3 && totalTextHeight < side * 0.8) { // Max 3 lines, check height
                    categoryFits = true;
                    shouldWrapCategory = true;
                } else {
                    categoryFits = false; // Wrapping didn't help or too many lines/too tall
                }
            }
            
            if (valueFits && categoryFits) break;
            currentFontSize -= 1;
        }
        
        const finalFontSize = currentFontSize;
        const showValue = valueWidth <= maxTextWidthInside && finalFontSize >= MIN_ACCEPTABLE_FONT_SIZE;
        const showCategory = categoryTextContent && finalFontSize >= MIN_ACCEPTABLE_FONT_SIZE && (categoryWidth <= maxTextWidthInside || shouldWrapCategory) && side >= MIN_SIDE_FOR_CATEGORY_LABEL;

        let finalValueY = 0, finalCategoryY = 0;
        const textBlockCenterY = isLargeSquareWithIcon ? d.height / 4.5 : 0; // Shift text block down if icon is present

        if (showValue && showCategory) {
            const totalTextHeight = categoryLabelHeight + finalFontSize + (finalFontSize * CAT_LINE_HEIGHT_FACTOR * 0.5); // Cat height + Val height + spacing
            finalCategoryY = textBlockCenterY - totalTextHeight / 2;
            finalValueY = finalCategoryY + categoryLabelHeight + (finalFontSize * CAT_LINE_HEIGHT_FACTOR * 0.5);
        } else if (showValue) {
            finalValueY = textBlockCenterY;
        } else if (showCategory) {
            finalCategoryY = textBlockCenterY - categoryLabelHeight / 2;
        }

        if (showValue) {
            gNode.append("text")
                .attr("class", "text value")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging") // Value usually hangs from its y
                .attr("y", finalValueY)
                .style("font-family", fillStyle.typography.valueFontFamily)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.valueFontWeight)
                .style("fill", adaptiveTextColor)
                .text(valueTextContent);
        }

        if (showCategory) {
            const catLabel = gNode.append("text")
                .attr("class", "text label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging") // Category block hangs from its y
                .attr("y", finalCategoryY)
                .style("font-family", fillStyle.typography.categoryFontFamily)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.categoryFontWeight)
                .style("fill", adaptiveTextColor);

            if (shouldWrapCategory) {
                const words = categoryTextContent.split(/\s+/);
                let line = [];
                let currentLineText = "";
                let tspanYOffset = 0;

                if (words.length <= 1 && categoryTextContent.length > 5) { // single long word, char wrapping
                    let tempLine = "";
                    for(let char of categoryTextContent.split('')) {
                        if(estimateTextWidth(tempLine + char, fillStyle.typography.categoryFontFamily, finalFontSize, fillStyle.typography.categoryFontWeight) > maxTextWidthInside && tempLine.length > 0) {
                            catLabel.append("tspan").attr("x", 0).attr("dy", tspanYOffset).text(tempLine);
                            tspanYOffset = `${1 + CAT_LINE_HEIGHT_FACTOR}em`; tempLine = char;
                        } else { tempLine += char; }
                    }
                    if(tempLine) catLabel.append("tspan").attr("x", 0).attr("dy", tspanYOffset).text(tempLine);
                } else { // word wrapping
                    for (let i = 0; i < words.length; i++) {
                        line.push(words[i]);
                        currentLineText = line.join(" ");
                        if (estimateTextWidth(currentLineText, fillStyle.typography.categoryFontFamily, finalFontSize, fillStyle.typography.categoryFontWeight) > maxTextWidthInside && line.length > 1) {
                            line.pop(); // Remove last word
                            catLabel.append("tspan").attr("x", 0).attr("dy", tspanYOffset).text(line.join(" "));
                            tspanYOffset = `${1 + CAT_LINE_HEIGHT_FACTOR}em`;
                            line = [words[i]]; // Start new line with current word
                        }
                    }
                    if (line.length > 0) {
                        catLabel.append("tspan").attr("x", 0).attr("dy", tspanYOffset).text(line.join(" "));
                    }
                }
            } else {
                catLabel.text(categoryTextContent);
            }
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}