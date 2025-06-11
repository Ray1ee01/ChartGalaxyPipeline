/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Square)",
  "chart_name": "proportional_area_chart_square_07",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || (data.colors_dark || {}); // Assuming dark theme if colors is missing
    const images = data.images || {}; // Not used in this chart, but extracted for consistency
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xFieldConfig?.name;
    const valueFieldName = yFieldConfig?.name;
    const valueFieldUnit = yFieldConfig?.unit === "none" ? "" : (yFieldConfig?.unit || "");

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    const chartDataArray = chartDataInput.filter(d => d[valueFieldName] != null && +d[valueFieldName] > 0);

    if (!chartDataArray.length) {
        d3.select(containerSelector).html("<div>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            valueLabelFontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
            valueLabelFontSize: parseFloat(typography.annotation?.font_size || '10px'),
            valueLabelFontWeight: typography.annotation?.font_weight || 'bold',
            categoryLabelFontFamily: typography.label?.font_family || 'Arial, sans-serif',
            categoryLabelFontSize: parseFloat(typography.label?.font_size || '10px'),
            categoryLabelFontWeight: typography.label?.font_weight || 'normal',
        },
        chartBackground: colors.background_color || '#FFFFFF', // Not directly used on SVG, but for consistency
        defaultTextColor: colors.text_color || '#000000',
        rectStrokeColor: '#FFFFFF', // Default white stroke for squares
        // Colors for squares will be handled by colorScale using colors.field or colors.available_colors
    };

    // In-memory text measurement utility (using canvas for potential performance)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial, sans-serif'}`;
        return ctx.measureText(text).width;
    }
    
    function getColorBrightness(colorStr) {
        if (!colorStr) return 0.5; // Default if color is undefined
        let r, g, b;
        if (colorStr.startsWith('rgba')) {
            const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
            if (match) [ , r, g, b] = match.map(Number);
        } else if (colorStr.startsWith('rgb')) {
            const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) [ , r, g, b] = match.map(Number);
        } else if (colorStr.startsWith('#')) {
            let hex = colorStr.slice(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            if (hex.length === 6) {
                r = parseInt(hex.substring(0, 2), 16);
                g = parseInt(hex.substring(2, 4), 16);
                b = parseInt(hex.substring(4, 6), 16);
            }
        }
        if (r === undefined) return 0.5; // Fallback if parsing failed
        return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    }

    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? '#000000' : '#FFFFFF'; // Dark text on light, light text on dark
    }

    // Force layout helper: Initial position assignment
    function assignInitialPositions(nodes, layoutWidth, layoutHeight, topProtectedArea) {
        const gridSide = Math.ceil(Math.sqrt(nodes.length));
        const maxNodeDim = d3.max(nodes, d => Math.max(d.width, d.height)) || 10; // Ensure non-zero
        const cellSize = Math.max(maxNodeDim, Math.sqrt(layoutWidth * layoutHeight / (gridSide * gridSide)));
        
        const centerX = layoutWidth / 2;
        const centerY = layoutHeight / 2;
        const startX = centerX - (cellSize * (gridSide - 1)) / 2;
        const startY = centerY - (cellSize * (gridSide - 1)) / 2;
        
        let cells = [];
        for (let row = 0; row < gridSide; row++) {
            for (let col = 0; col < gridSide; col++) {
                const distToCenter = Math.sqrt(Math.pow(row - (gridSide - 1) / 2, 2) + Math.pow(col - (gridSide - 1) / 2, 2));
                cells.push({row, col, distance: distToCenter});
            }
        }
        cells.sort((a, b) => a.distance - b.distance);
        
        nodes.forEach((node, i) => {
            const cell = cells[i % cells.length]; // Reuse cells if more nodes than grid spots
            const jitter = cellSize * 0.1;
            node.x = startX + cell.col * cellSize + cellSize/2 + (Math.random() - 0.5) * jitter;
            node.y = startY + cell.row * cellSize + cellSize/2 + (Math.random() - 0.5) * jitter;
            
            node.x = Math.max(node.width/2, Math.min(layoutWidth - node.width/2, node.x));
            node.y = Math.max(topProtectedArea + node.height/2, Math.min(layoutHeight - node.height/2, node.y));
        });

        if (nodes.length > 0 && nodes[0]) { // Loosely fix the largest node near center
            nodes[0].x = layoutWidth * 0.5 + (Math.random() - 0.5) * 10;
            nodes[0].y = layoutHeight * 0.5 + (Math.random() - 0.5) * 10;
        }
    }

    // Force layout helper: Custom rectangle collision
    function rectCollide() {
        let currentNodes = [];
        let strength = 1;
        const padding = 5; // Extra safety margin

        function distance(nodeA, nodeB) {
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const overlapX = (nodeA.width + nodeB.width) / 2 - Math.abs(dx);
            const overlapY = (nodeA.height + nodeB.height) / 2 - Math.abs(dy);

            if (overlapX <= 0 || overlapY <= 0) {
                const edgeDistX = overlapX <= 0 ? -overlapX : 0;
                const edgeDistY = overlapY <= 0 ? -overlapY : 0;
                return Math.sqrt(edgeDistX * edgeDistX + edgeDistY * edgeDistY);
            }
            return -Math.sqrt(Math.abs(overlapX * overlapY)); // Negative overlap metric
        }

        function force(alpha) {
            const quadtree = d3.quadtree().x(d => d.x).y(d => d.y).addAll(currentNodes);
            for (let i = 0; i < currentNodes.length; i++) {
                const nodeA = currentNodes[i];
                const searchRadius = Math.max(nodeA.width, nodeA.height) * 1.5 + padding;
                quadtree.visit((quad, x1, y1, x2, y2) => {
                    if (!quad.length) {
                        do {
                            if (quad.data !== nodeA) {
                                const nodeB = quad.data;
                                const dist = distance(nodeA, nodeB);
                                const repulsionThreshold = padding;

                                if (dist < repulsionThreshold) {
                                    const dx = nodeB.x - nodeA.x;
                                    const dy = nodeB.y - nodeA.y;
                                    const l = Math.sqrt(dx * dx + dy * dy) || 1;
                                    
                                    const repulsionStrengthFactor = dist < 0 ? 1.0 : 1 - (dist / repulsionThreshold);
                                    let forceMagnitude = Math.min(
                                        Math.abs(dist < 0 ? dist : dist - repulsionThreshold) * strength * alpha * repulsionStrengthFactor,
                                        15 // Max repulsion force
                                    );
                                    
                                    const ratio = nodeA.area / (nodeA.area + nodeB.area || 1);
                                    let forceX = forceMagnitude * (dx / l);
                                    let forceY = forceMagnitude * (dy / l);

                                    const overlapXVal = (nodeA.width + nodeB.width) / 2 - Math.abs(dx);
                                    const overlapYVal = (nodeA.height + nodeB.height) / 2 - Math.abs(dy);

                                    if (overlapXVal > overlapYVal && Math.abs(dy) > 0.1) forceY *= 1.8;
                                    else if (overlapYVal > overlapXVal && Math.abs(dx) > 0.1) forceX *= 1.8;
                                    
                                    if (!nodeA.fx) { nodeA.x -= forceX * (1 - ratio) * 0.95; nodeA.y -= forceY * (1 - ratio) * 0.95; }
                                    if (!nodeB.fx) { nodeB.x += forceX * ratio * 0.95; nodeB.y += forceY * ratio * 0.95; }
                                }
                            }
                        } while (quad = quad.next);
                    }
                    const nodeRadius = Math.max(nodeA.width, nodeA.height) / 2 + padding;
                    return x1 > nodeA.x + nodeRadius || x2 < nodeA.x - nodeRadius || y1 > nodeA.y + nodeRadius || y2 < nodeA.y - nodeRadius;
                });
            }
        }
        force.initialize = (_) => { currentNodes = _; };
        force.strength = (_) => { strength = _ ?? strength; return force; };
        return force;
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "proportional-area-chart-svg")
        .attr("xmlns", "http://www.w3.org/2000/svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: variables.margin_top || 20, right: variables.margin_right || 20, bottom: variables.margin_bottom || 20, left: variables.margin_left || 20 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const fillRatio = 0.50; // Squares occupy 50% of drawing area
    const TOP_PROTECTED_AREA = variables.top_protected_area || 0; // Minimal top protected area if any title was there

    const maxTotalArea = innerWidth * innerHeight * fillRatio;
    
    // Force simulation parameters
    const MIN_ITERATIONS = variables.force_layout_iterations || 350;

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => +d[valueFieldName]);
    const areaPerUnit = totalValue > 0 ? maxTotalArea / totalValue : 0;

    let nodes = chartDataArray.map((d, i) => ({
        id: d[categoryFieldName] != null ? String(d[categoryFieldName]) : `__${i}__`,
        val: +d[valueFieldName],
        area: +d[valueFieldName] * areaPerUnit,
        raw: d
    })).sort((a, b) => b.area - a.area); // Largest first for drawing order (drawn first = bottom)

    const minRadius = variables.min_radius_for_side_calc || 5; // Used to derive minSide
    const maxSide = variables.max_square_side || 200;
    const minSide = minRadius * 2;

    nodes.forEach(n => {
        let side = Math.sqrt(n.area);
        side = Math.max(minSide, Math.min(side, maxSide));
        n.width = n.height = side;
        n.area = side * side; // Update area based on constrained side
    });

    const initialTotalArea = d3.sum(nodes, d => d.area);
    if (initialTotalArea > maxTotalArea && initialTotalArea > 0) {
        const scaleFactor = Math.sqrt(maxTotalArea / initialTotalArea);
        nodes.forEach(n => {
            n.width *= scaleFactor;
            n.height *= scaleFactor;
            n.area = n.width * n.height;
        });
    }
    
    // Assign initial positions for force layout
    assignInitialPositions(nodes, innerWidth, innerHeight, TOP_PROTECTED_AREA);

    // Create and run force simulation
    const simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.05))
        .force("charge", d3.forceManyBody().strength(-20))
        .force("collide", rectCollide().strength(1.0))
        .force("x", d3.forceX(innerWidth / 2).strength(0.02))
        .force("y", d3.forceY(innerHeight / 2).strength(0.02))
        .stop();

    for (let i = 0; i < MIN_ITERATIONS; ++i) {
        simulation.tick();
        const boundaryStrength = 1 - Math.min(1, i / (MIN_ITERATIONS * 0.8));
        nodes.forEach(d => {
            if (!d.fx) { // If node is not fixed
                const maxBoundaryForce = 2 * boundaryStrength;
                if (d.x - d.width/2 < 20) d.x += maxBoundaryForce * (1 - (d.x - d.width/2)/20);
                if (innerWidth - d.x - d.width/2 < 20) d.x -= maxBoundaryForce * (1 - (innerWidth - d.x - d.width/2)/20);
                if (d.y - d.height/2 - TOP_PROTECTED_AREA < 20) d.y += maxBoundaryForce * (1 - (d.y - d.height/2 - TOP_PROTECTED_AREA)/20);
                if (innerHeight - d.y - d.height/2 < 20) d.y -= maxBoundaryForce * (1 - (innerHeight - d.y - d.height/2)/20);

                d.x = Math.max(d.width/2 + 1, Math.min(innerWidth - d.width/2 - 1, d.x));
                d.y = Math.max(TOP_PROTECTED_AREA + d.height/2 + 1, Math.min(innerHeight - d.height/2 - 1, d.y));
            }
        });
    }

    // Block 6: Scale Definition & Configuration
    const uniqueCategories = [...new Set(nodes.map(d => d.id))];
    const colorScale = d3.scaleOrdinal()
        .domain(uniqueCategories)
        .range(uniqueCategories.map((cat, i) => {
            if (colors.field && colors.field[cat]) {
                return colors.field[cat];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[i % colors.available_colors.length];
            }
            return d3.schemeCategory10[i % 10]; // Fallback to d3.schemeCategory10
        }));
    
    nodes.forEach(n => {
        n.color = colorScale(n.id);
    });


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type as per original and simplification.

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    // Nodes are already sorted largest first. D3 appends in order, so largest are at the bottom, smallest on top.
    const rectGroups = mainChartGroup.selectAll("g.node-group")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", d => `node-group mark value ${d.id.startsWith("__") ? "anonymous-node" : d.id.replace(/\s+/g, '-').toLowerCase()}`)
        .attr("transform", d => `translate(${d.x},${d.y})`);

    rectGroups.append("rect")
        .attr("class", "shape-rect mark")
        .attr("x", d => -d.width / 2)
        .attr("y", d => -d.height / 2)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("fill", d => d.color)
        .attr("stroke", fillStyle.rectStrokeColor)
        .attr("stroke-width", 2.0); // Fixed stroke width

    // Text rendering logic
    const minAcceptableFontSize = 8;
    const minSideForCategoryLabel = 10;
    const fontSizeScaleFactor = 0.38;
    const maxFontSize = 28;
    const catLineHeightFactor = 0.3; // Multiplier for line height relative to font size

    rectGroups.each(function(d) {
        const group = d3.select(this);
        const side = d.width;
        const valueTextContent = `${d.val}${valueFieldUnit}`;
        let categoryTextContent = d.id.startsWith("__") ? "" : d.id;
        const maxTextWidth = side * 0.85;
        
        const adaptiveTextColor = getTextColorForBackground(d.color);

        let currentFontSize = Math.max(
            minAcceptableFontSize,
            Math.min(
                side * fontSizeScaleFactor,
                (fillStyle.typography.valueLabelFontSize + fillStyle.typography.categoryLabelFontSize) / 2,
                maxFontSize
            )
        );

        let valueWidth, categoryWidth, categoryLines = 1, categoryLabelHeight = currentFontSize, shouldWrapCategory = false;

        while (currentFontSize > minAcceptableFontSize) {
            valueWidth = estimateTextWidth(valueTextContent, fillStyle.typography.valueLabelFontFamily, currentFontSize, fillStyle.typography.valueLabelFontWeight);
            categoryWidth = categoryTextContent ? estimateTextWidth(categoryTextContent, fillStyle.typography.categoryLabelFontFamily, currentFontSize, fillStyle.typography.categoryLabelFontWeight) : 0;
            
            const valueFits = valueWidth <= maxTextWidth;
            let categoryFits = !categoryTextContent || categoryWidth <= maxTextWidth;
            shouldWrapCategory = false;

            if (categoryTextContent && !categoryFits && currentFontSize >= fillStyle.typography.categoryLabelFontSize * 0.8) { // Allow wrapping if font size is reasonable
                 shouldWrapCategory = true;
                 const words = categoryTextContent.split(/\s+/);
                 let lines = [];
                 let currentLineArray = [];
                 let fitsWithWrapping = true;

                 if (words.length <=1 && categoryTextContent.length > 0) { // Try char wrapping for single very long word
                    const chars = categoryTextContent.split('');
                    let currentLine = '';
                    for (let k = 0; k < chars.length; k++) {
                        const testLine = currentLine + chars[k];
                        if (estimateTextWidth(testLine, fillStyle.typography.categoryLabelFontFamily, currentFontSize, fillStyle.typography.categoryLabelFontWeight) <= maxTextWidth || currentLine.length === 0) {
                            currentLine += chars[k];
                        } else {
                            if ((lines.length + 1) * currentFontSize * (1 + catLineHeightFactor) > side * 0.85) { fitsWithWrapping = false; break; }
                            lines.push(currentLine);
                            currentLine = chars[k];
                        }
                    }
                    if (fitsWithWrapping) lines.push(currentLine);
                 } else { // Word wrapping
                    for (const word of words) {
                        currentLineArray.push(word);
                        const testLine = currentLineArray.join(" ");
                        if (estimateTextWidth(testLine, fillStyle.typography.categoryLabelFontFamily, currentFontSize, fillStyle.typography.categoryLabelFontWeight) > maxTextWidth && currentLineArray.length > 1) {
                            currentLineArray.pop();
                            if ((lines.length + 1) * currentFontSize * (1 + catLineHeightFactor) > side * 0.85) { fitsWithWrapping = false; break; }
                            lines.push(currentLineArray.join(" "));
                            currentLineArray = [word];
                        }
                    }
                    if (fitsWithWrapping && currentLineArray.length > 0) lines.push(currentLineArray.join(" "));
                 }
                
                 if(fitsWithWrapping && lines.length > 0){ 
                     categoryLines = lines.length;
                     categoryLabelHeight = categoryLines * currentFontSize + (categoryLines - 1) * currentFontSize * catLineHeightFactor;
                     categoryFits = true;
                 } else {
                     categoryFits = false;
                     shouldWrapCategory = false;
                 }
            }

            if (valueFits && categoryFits) break;
            currentFontSize -= 1;
        }

        const finalFontSize = currentFontSize;
        const showValue = valueWidth <= maxTextWidth && finalFontSize >= minAcceptableFontSize;
        const showCategory = categoryTextContent && finalFontSize >= minAcceptableFontSize && (categoryWidth <= maxTextWidth || shouldWrapCategory) && side >= minSideForCategoryLabel;

        let finalValueY = 0, finalCategoryY = 0;
        if (showValue && showCategory) {
            const totalTextHeight = categoryLabelHeight + finalFontSize + (finalFontSize * catLineHeightFactor * 0.5); // cat height + val height + small gap
            const startY = -totalTextHeight / 2;
            finalCategoryY = startY;
            finalValueY = startY + categoryLabelHeight + (finalFontSize * catLineHeightFactor * 0.5);
        } else if (showValue) {
            finalValueY = 0; // Centered
        } else if (showCategory) {
            finalCategoryY = -categoryLabelHeight / 2; // Centered
        }

        if (showValue) {
            group.append("text")
                .attr("class", "value-label label text")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging") 
                .attr("y", finalValueY)
                .style("font-family", fillStyle.typography.valueLabelFontFamily)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.valueLabelFontWeight)
                .style("fill", adaptiveTextColor)
                .text(valueTextContent);
        }

        if (showCategory) {
            const categoryLabelElement = group.append("text")
                .attr("class", "category-label label text")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalCategoryY)
                .style("font-family", fillStyle.typography.categoryLabelFontFamily)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
                .style("fill", adaptiveTextColor);

            if (shouldWrapCategory) {
                const words = categoryTextContent.split(/\s+/);
                let currentLineArray = [];
                let lineNumber = 0;
                
                const processLine = (lineText, isFirst) => {
                    categoryLabelElement.append("tspan")
                        .attr("x", 0)
                        .attr("dy", isFirst ? 0 : `${1 + catLineHeightFactor}em`)
                        .text(lineText);
                };

                if (words.length <= 1 && categoryTextContent.length > 0) { // Char wrapping
                    const chars = categoryTextContent.split('');
                    let currentLine = '';
                    for (let k = 0; k < chars.length; k++) {
                        const testLine = currentLine + chars[k];
                        if (estimateTextWidth(testLine, fillStyle.typography.categoryLabelFontFamily, finalFontSize, fillStyle.typography.categoryLabelFontWeight) <= maxTextWidth || currentLine.length === 0) {
                            currentLine += chars[k];
                        } else {
                            processLine(currentLine, lineNumber === 0);
                            lineNumber++;
                            currentLine = chars[k];
                        }
                    }
                    if (currentLine) processLine(currentLine, lineNumber === 0);

                } else { // Word wrapping
                    for (const word of words) {
                        currentLineArray.push(word);
                        const testLine = currentLineArray.join(" ");
                        if (estimateTextWidth(testLine, fillStyle.typography.categoryLabelFontFamily, finalFontSize, fillStyle.typography.categoryLabelFontWeight) > maxTextWidth && currentLineArray.length > 1) {
                            currentLineArray.pop();
                            processLine(currentLineArray.join(" "), lineNumber === 0);
                            lineNumber++;
                            currentLineArray = [word];
                        }
                    }
                    if (currentLineArray.length > 0) processLine(currentLineArray.join(" "), lineNumber === 0);
                }
            } else {
                categoryLabelElement.text(categoryTextContent);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Removed gradients, shadows, highlights as per requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}