/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Square)",
  "chart_name": "proportional_area_chart_square_03",
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
    const dataColumns = data.data?.columns || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or use a theme switch if data.colors_dark is present
    const images = data.images || {}; // Not used in this chart type but extracted for consistency

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const valueFieldUnitObj = dataColumns.find(col => col.role === "y");
    const valueFieldUnit = valueFieldUnitObj?.unit === "none" || !valueFieldUnitObj?.unit ? "" : valueFieldUnitObj.unit;

    if (!categoryFieldName || !valueFieldName) {
        const errorMessage = `Critical chart config missing: ${!categoryFieldName ? "x-field " : ""}${!valueFieldName ? "y-field" : ""}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMessage}</div>`);
        return null;
    }

    let chartDataArray = chartDataInput.filter(d => d[valueFieldName] != null && +d[valueFieldName] > 0);

    if (!chartDataArray.length) {
        d3.select(containerSelector).html("<div>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography
    fillStyle.typography.titleFontFamily = typography.title?.font_family || 'Arial, sans-serif';
    fillStyle.typography.titleFontSize = typography.title?.font_size || '16px';
    fillStyle.typography.titleFontWeight = typography.title?.font_weight || 'bold';

    fillStyle.typography.labelFontFamily = typography.label?.font_family || 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = typography.label?.font_size || '11px'; // Base for category
    fillStyle.typography.labelFontWeight = typography.label?.font_weight || 'normal';

    fillStyle.typography.annotationFontFamily = typography.annotation?.font_family || 'Arial, sans-serif';
    fillStyle.typography.annotationFontSize = typography.annotation?.font_size || '12px'; // Base for value
    fillStyle.typography.annotationFontWeight = typography.annotation?.font_weight || 'bold';
    
    fillStyle.textColor = colors.text_color || '#000000'; // Default text color
    fillStyle.contrastingTextColorLight = '#FFFFFF';
    fillStyle.contrastingTextColorDark = '#000000';

    // Colors
    fillStyle.chartBackground = colors.background_color || '#FFFFFF'; // Not directly used for SVG background, but good for consistency
    fillStyle.primaryColor = colors.other?.primary || '#1f77b4'; // Default primary color
    fillStyle.squareStroke = '#FFFFFF'; // Stroke for squares

    const defaultColorPalette = d3.schemeCategory10;
    let colorIndex = 0;
    fillStyle.getCategoryColor = (category) => {
        if (colors.field && colors.field[category]) {
            return colors.field[category];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            // Find if category was already assigned a color from available_colors to maintain consistency
            // This simple version just cycles, a more robust one might map categories to colors.
            const uniqueCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
            const catIndex = uniqueCategories.indexOf(category);
            return colors.available_colors[catIndex % colors.available_colors.length];
        }
        return defaultColorPalette[colorIndex++ % defaultColorPalette.length];
    };
    
    // In-memory text measurement utility
    function estimateTextWidthSVG(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        // Document attachment not strictly required for getBBox by spec, but some browsers might be picky.
        // Sticking to "MUST NOT be appended" from prompt.
        try {
            return textNode.getBBox().width;
        } catch (e) {
            // Fallback to canvas-based measurement if SVG fails (though prompt prefers pure SVG)
            // This is a practical fallback if the pure SVG method is unreliable in target environments.
            console.warn("SVG text measurement failed, falling back to canvas.", e);
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = `${fontWeight || 'normal'} ${fontSize} ${fontFamily || 'Arial, sans-serif'}`;
            return context.measureText(text).width;
        }
    }

    function getColorBrightness(color) {
        if (!color) return 0.5; // Default for undefined color
        if (color.startsWith('rgba')) {
            const rgba = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
            if (rgba) return (parseInt(rgba[1]) * 0.299 + parseInt(rgba[2]) * 0.587 + parseInt(rgba[3]) * 0.114) / 255;
        }
        if (color.startsWith('rgb')) {
            const rgb = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (rgb) return (parseInt(rgb[1]) * 0.299 + parseInt(rgb[2]) * 0.587 + parseInt(rgb[3]) * 0.114) / 255;
        }
        if (color.startsWith('#')) {
            let hex = color.substring(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            if (hex.length === 6) {
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
            }
        }
        return 0.5; // Default for unknown formats
    }

    function getAdaptiveTextColor(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? fillStyle.contrastingTextColorDark : fillStyle.contrastingTextColorLight;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground); // Apply background color to SVG root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Reduced margins as no axes/titles
    const TOP_PROTECTED_AREA = variables.topProtectedArea !== undefined ? variables.topProtectedArea : 10; // Small protection

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const fillRatio = variables.fillRatio || 0.65; // Increased fillRatio for better space usage
    const minElementSide = variables.minElementSide || 10; // Min side for a square (was minRadius*2)
    const maxElementSide = variables.maxElementSide || Math.min(innerHeight / 2, innerWidth / 2, 200);

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const maxTotalArea = innerWidth * innerHeight * fillRatio;
    const totalValue = d3.sum(chartDataArray, d => +d[valueFieldName]);
    const areaPerUnit = totalValue > 0 ? maxTotalArea / totalValue : 0;

    let nodes = chartDataArray.map((d, i) => ({
        id: d[categoryFieldName] != null ? String(d[categoryFieldName]) : `__${i}__`,
        val: +d[valueFieldName],
        area: +d[valueFieldName] * areaPerUnit,
        color: fillStyle.getCategoryColor(d[categoryFieldName]),
        raw: d
    })).sort((a, b) => b.area - a.area);

    nodes.forEach(n => {
        let side = n.area > 0 ? Math.sqrt(n.area) : 0;
        side = Math.max(minElementSide, Math.min(side, maxElementSide));
        n.width = n.height = side;
        n.area = side * side;
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
    
    nodes = nodes.filter(n => n.width >= minElementSide && n.height >= minElementSide); // Filter out too small nodes after scaling

    if (!nodes.length) {
        d3.select(containerSelector).html("<div>No data points large enough to display.</div>");
        return null;
    }


    function assignInitialPositions() {
        const gridSide = Math.ceil(Math.sqrt(nodes.length));
        const cellSize = Math.max(
            d3.max(nodes, d => d.width) || minElementSide,
            Math.sqrt(innerWidth * innerHeight / (gridSide * gridSide))
        );
        
        const centerX = innerWidth / 2;
        const centerY = innerHeight / 2;
        const startX = centerX - (cellSize * (gridSide - 1)) / 2;
        const startY = centerY - (cellSize * (gridSide - 1)) / 2;
        
        function distanceToCenter(row, col) {
            const centerRow = (gridSide - 1) / 2;
            const centerCol = (gridSide - 1) / 2;
            return Math.sqrt(Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2));
        }
        
        let cells = [];
        for (let row = 0; row < gridSide; row++) {
            for (let col = 0; col < gridSide; col++) {
                cells.push({row, col, distance: distanceToCenter(row, col)});
            }
        }
        cells.sort((a, b) => a.distance - b.distance);
        
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const cell = cells[i % cells.length];
            const jitter = cellSize * 0.1;
            node.x = startX + cell.col * cellSize + cellSize/2 + (Math.random() - 0.5) * jitter;
            node.y = startY + cell.row * cellSize + cellSize/2 + (Math.random() - 0.5) * jitter;
            node.x = Math.max(node.width/2, Math.min(innerWidth - node.width/2, node.x));
            node.y = Math.max(TOP_PROTECTED_AREA + node.height/2, Math.min(innerHeight - node.height/2, node.y));
        }
        
        if (nodes.length > 0 && nodes[0]) { // nodes[0] is largest
            nodes[0].x = innerWidth * 0.5 + (Math.random() - 0.5) * 10;
            nodes[0].y = innerHeight * 0.5 + (Math.random() - 0.5) * 10;
        }
    }

    assignInitialPositions();

    function rectCollide() {
        let currentNodes = [];
        let strength = 1;
        const padding = 5; // Simplified padding

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
            return -Math.sqrt(overlapX * overlapY);
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
                                    const repulsionStrength = dist < 0 ? 1.0 : 1 - (dist / repulsionThreshold);
                                    let forceMagnitude = Math.min(Math.abs(dist < 0 ? dist : dist - repulsionThreshold) * strength * alpha * repulsionStrength, 15);
                                    const ratio = nodeA.area / (nodeA.area + nodeB.area || 1);
                                    let forceX = forceMagnitude * (dx / l);
                                    let forceY = forceMagnitude * (dy / l);
                                    
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

    const simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.05))
        .force("charge", d3.forceManyBody().strength(-20))
        .force("collide", rectCollide().strength(1.0))
        .force("x", d3.forceX(innerWidth / 2).strength(0.02))
        .force("y", d3.forceY(innerHeight / 2).strength(0.02))
        .stop();

    const MIN_ITERATIONS = variables.simulationIterations || 300;
    for (let i = 0; i < MIN_ITERATIONS; ++i) {
        const boundaryStrength = 1 - Math.min(1, i / (MIN_ITERATIONS * 0.8));
        simulation.tick();
        nodes.forEach(d => {
            if (!d.fx) {
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

    nodes.forEach((d, i) => { d.zIndex = nodes.length - i; });


    // Block 6: Scale Definition & Configuration
    // Color scale is handled by fillStyle.getCategoryColor

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type as per requirements.

    // Block 8: Main Data Visualization Rendering
    const nodeElements = mainChartGroup.selectAll("g.node-group")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", d => `node-group mark value ${d.id.startsWith("__") ? "anonymous-node" : d.id.replace(/\s+/g, '-')}`)
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .sort((a, b) => a.zIndex - b.zIndex);

    nodeElements.append("rect")
        .attr("class", "square-mark")
        .attr("x", d => -d.width / 2)
        .attr("y", d => -d.height / 2)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("fill", d => d.color)
        .attr("stroke", fillStyle.squareStroke)
        .attr("stroke-width", 1.0);
        // Removed rx, ry, filter, and box-shadow for clean style

    // Text rendering
    const valueFontSizeBase = parseFloat(fillStyle.typography.annotationFontSize);
    const categoryFontSizeBase = parseFloat(fillStyle.typography.labelFontSize);
    const minAcceptableFontSize = 8;
    const minSideForCategoryLabel = 20;
    const fontSizeScaleFactor = 0.38;
    const maxFontSize = 28;
    const catLineHeightFactor = 0.3; // Multiplier for line height relative to font size

    nodeElements.each(function(d) {
        const gNode = d3.select(this);
        const side = d.width;
        const valText = `${d.val}${valueFieldUnit}`;
        let catText = d.id.startsWith("__") ? "" : d.id;
        const maxTextWidth = side * 0.85;
        
        const adaptiveTextColor = getAdaptiveTextColor(d.color);

        let currentFontSize = Math.max(
            minAcceptableFontSize,
            Math.min(side * fontSizeScaleFactor, (valueFontSizeBase + categoryFontSizeBase) / 2, maxFontSize)
        );

        let valueWidth, categoryWidth, categoryLines = 1, categoryLabelHeight = currentFontSize, shouldWrapCategory = false;

        while (currentFontSize >= minAcceptableFontSize) {
            valueWidth = estimateTextWidthSVG(valText, fillStyle.typography.annotationFontFamily, `${currentFontSize}px`, fillStyle.typography.annotationFontWeight);
            categoryWidth = catText ? estimateTextWidthSVG(catText, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) : 0;
            
            const valueFits = valueWidth <= maxTextWidth;
            let categoryFits = !catText || categoryWidth <= maxTextWidth;
            shouldWrapCategory = false;
            categoryLines = 1;
            categoryLabelHeight = currentFontSize;

            if (catText && !categoryFits && currentFontSize >= parseFloat(fillStyle.typography.labelFontSize) * 0.8) { // Allow wrapping if font size is reasonable
                 shouldWrapCategory = true;
                 const words = catText.split(/\s+/);
                 let linesArray = [];
                 let currentLineTest = "";
                 
                 if (words.length <= 1 && catText.length > 0) { // Character wrapping for single word/no spaces
                    let tempLine = "";
                    for (let char of catText.split('')) {
                        if (estimateTextWidthSVG(tempLine + char, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) > maxTextWidth && tempLine.length > 0) {
                            linesArray.push(tempLine);
                            tempLine = char;
                        } else {
                            tempLine += char;
                        }
                    }
                    if (tempLine) linesArray.push(tempLine);
                 } else { // Word wrapping
                    let tempLine = [];
                    for (let word of words) {
                        const testLineContent = tempLine.concat(word).join(" ");
                        if (estimateTextWidthSVG(testLineContent, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) > maxTextWidth && tempLine.length > 0) {
                            linesArray.push(tempLine.join(" "));
                            tempLine = [word];
                        } else {
                            tempLine.push(word);
                        }
                    }
                    if (tempLine.length > 0) linesArray.push(tempLine.join(" "));
                 }

                 if (linesArray.length > 0 && linesArray.every(l => estimateTextWidthSVG(l, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) <= maxTextWidth)) {
                     categoryLines = linesArray.length;
                     categoryLabelHeight = categoryLines * currentFontSize + (categoryLines - 1) * currentFontSize * catLineHeightFactor;
                     if (categoryLabelHeight + currentFontSize * (1 + catLineHeightFactor) <= side * 0.9) { // Check total height
                        categoryFits = true;
                     } else {
                        categoryFits = false; shouldWrapCategory = false; // Too tall even with wrapping
                     }
                 } else {
                     categoryFits = false; shouldWrapCategory = false;
                 }
            }

            if (valueFits && categoryFits) break;
            currentFontSize -= 1;
        }

        const finalFontSize = currentFontSize;
        const showValue = valueWidth <= maxTextWidth && finalFontSize >= minAcceptableFontSize;
        const showCategory = catText && finalFontSize >= minAcceptableFontSize && (categoryWidth <= maxTextWidth || shouldWrapCategory) && side >= minSideForCategoryLabel;

        let finalValueY = 0, finalCategoryY = 0;
        const totalTextHeight = (showCategory ? categoryLabelHeight : 0) + (showValue ? finalFontSize : 0) + (showCategory && showValue ? finalFontSize * catLineHeightFactor * 0.5 : 0);
        
        if (showValue && showCategory) {
            finalCategoryY = -totalTextHeight / 2;
            finalValueY = finalCategoryY + categoryLabelHeight + finalFontSize * catLineHeightFactor * 0.5;
        } else if (showValue) {
            finalValueY = 0; 
        } else if (showCategory) {
            finalCategoryY = -categoryLabelHeight / 2;
        }

        if (showValue) {
            gNode.append("text")
                .attr("class", "value text")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle") // Adjusted for better centering
                .attr("y", finalValueY)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("fill", adaptiveTextColor)
                .text(valText);
        }

        if (showCategory) {
            const catLabel = gNode.append("text")
                .attr("class", "label text")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging") // Use hanging for first line of tspan
                .attr("y", finalCategoryY)
                .style("fill", adaptiveTextColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("font-size", `${finalFontSize}px`);

            if (shouldWrapCategory) {
                const words = catText.split(/\s+/);
                let linesToRender = [];
                
                if (words.length <= 1 && catText.length > 0) {
                    let currentLine = "";
                    for (let char of catText.split('')) {
                        if (estimateTextWidthSVG(currentLine + char, fillStyle.typography.labelFontFamily, `${finalFontSize}px`, fillStyle.typography.labelFontWeight) > maxTextWidth && currentLine.length > 0) {
                            linesToRender.push(currentLine);
                            currentLine = char;
                        } else {
                            currentLine += char;
                        }
                    }
                    if (currentLine) linesToRender.push(currentLine);
                } else {
                    let currentLine = [];
                    for (let word of words) {
                        const testLineContent = currentLine.concat(word).join(" ");
                        if (estimateTextWidthSVG(testLineContent, fillStyle.typography.labelFontFamily, `${finalFontSize}px`, fillStyle.typography.labelFontWeight) > maxTextWidth && currentLine.length > 0) {
                            linesToRender.push(currentLine.join(" "));
                            currentLine = [word];
                        } else {
                            currentLine.push(word);
                        }
                    }
                    if (currentLine.length > 0) linesToRender.push(currentLine.join(" "));
                }

                const actualLineHeight = finalFontSize * (1 + catLineHeightFactor);
                const totalRenderedHeight = linesToRender.length * finalFontSize + (linesToRender.length - 1) * finalFontSize * catLineHeightFactor;
                const startYOffset = finalCategoryY - (totalRenderedHeight / 2) + (finalFontSize / 2); // Adjust start Y for true centering of block

                linesToRender.forEach((lineText, idx) => {
                    catLabel.append("tspan")
                        .attr("x", 0)
                        .attr("dy", idx === 0 ? startYOffset - finalCategoryY : actualLineHeight) // dy for subsequent lines
                        .text(lineText);
                });
                 if (linesToRender.length === 1) { // If only one line after wrap logic, ensure it's centered
                    catLabel.selectAll("tspan").attr("dy", null); // Remove relative dy
                    catLabel.attr("y", finalCategoryY + finalFontSize / 2 - categoryLabelHeight / 2); // Center single line
                    catLabel.attr("dominant-baseline", "middle");
                }


            } else {
                catLabel.text(catText);
                catLabel.attr("dominant-baseline", "middle"); // Center single line text
                catLabel.attr("y", finalCategoryY + finalFontSize / 2 - categoryLabelHeight / 2);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations or icons in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}