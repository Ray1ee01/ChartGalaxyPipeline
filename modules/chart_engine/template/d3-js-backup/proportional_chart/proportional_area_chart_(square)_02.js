/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Square)",
  "chart_name": "proportional_area_chart_square_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
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
    d3.select(containerSelector).html(""); // Clear the container

    const chartDataRaw = data.data && data.data.data ? data.data.data : [];
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    // const images = data.images || {}; // Not used in this chart

    const xField = dataColumns.find(c => c.role === "x")?.name;
    const yField = dataColumns.find(c => c.role === "y")?.name;
    const yUnitConfig = dataColumns.find(c => c.role === "y")?.unit;
    const yFieldUnit = yUnitConfig === "none" || !yUnitConfig ? "" : yUnitConfig;

    if (!xField || !yField) {
        const missingFields = [];
        if (!xField) missingFields.push("xField (role: 'x')");
        if (!yField) missingFields.push("yField (role: 'y')");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMsg);
        return null;
    }

    const chartData = chartDataRaw.filter(d => d[yField] != null && +d[yField] > 0);

    if (!chartData.length) {
        d3.select(containerSelector).append("div")
            .style("padding", "10px")
            .html("No valid data to display after filtering.");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#212529', // Default dark text
        defaultSquareColor: (colors.other && colors.other.primary) || '#1f77b4',
        typography: {
            valueFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            valueFontSize: (typography.annotation && typography.annotation.font_size) ? parseFloat(typography.annotation.font_size) : 10,
            valueFontWeight: (typography.annotation && typography.annotation.font_weight) || 'bold',
            categoryFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            categoryFontSize: (typography.label && typography.label.font_size) ? parseFloat(typography.label.font_size) : 11,
            categoryFontWeight: (typography.label && typography.label.font_weight) || 'normal',
        }
    };

    const uniqueCategories = [...new Set(chartData.map(d => d[xField]))];
    const d3Colors = d3.schemeCategory10; // Fallback color scheme

    fillStyle.getSquareColor = (category) => {
        if (colors.field && colors.field[category]) {
            return colors.field[category];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            const index = uniqueCategories.indexOf(category);
            return colors.available_colors[index % colors.available_colors.length];
        }
        const index = uniqueCategories.indexOf(category);
        return d3Colors[index % d3Colors.length];
    };
    
    let _textMeasurementSVG;
    function estimateTextWidthSVG(text, fontFamily, fontSize, fontWeight) {
        if (!_textMeasurementSVG) {
            _textMeasurementSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            _textMeasurementSVG.style.position = 'absolute';
            _textMeasurementSVG.style.visibility = 'hidden';
            _textMeasurementSVG.style.width = 'auto';
            _textMeasurementSVG.style.height = 'auto';
            // No need to append to DOM for getBBox on text if SVG is properly configured.
            // However, some browsers might require it to be in the DOM for accurate measurement.
            // For safety and broader compatibility, a temporary append/remove could be used,
            // but the prompt implies an in-memory structure.
        }
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize + 'px');
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        _textMeasurementSVG.appendChild(textElement);
        // Appending to body and then removing for getBBox to work reliably if not already in DOM.
        // document.body.appendChild(_textMeasurementSVG); 
        const width = textElement.getBBox().width;
        // document.body.removeChild(_textMeasurementSVG);
        _textMeasurementSVG.removeChild(textElement); // Clean up
        return width;
    }


    function getColorBrightness(colorStr) {
        let r, g, b;
        if (colorStr.startsWith('#')) {
            let hex = colorStr.substring(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else if (colorStr.startsWith('rgb')) {
            const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (!match) return 0.5; // Default if parsing fails
            r = parseInt(match[1]);
            g = parseInt(match[2]);
            b = parseInt(match[3]);
        } else {
            return 0.5; // Unknown format, default to mid-brightness
        }
        return (r * 299 + g * 587 + b * 114) / 1000 / 255; // Perceived brightness
    }

    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? '#000000' : '#FFFFFF'; // Dark text on light, light text on dark
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Simplified margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const fillRatio = 0.65; // Adjusted fill ratio for potentially better packing
    const TOP_PROTECTED_AREA = 0; // No explicit top protected area unless titles were present
    const minSideAbsolute = 10; // Absolute minimum side length for a square in pixels
    const maxSideAbsolute = Math.min(innerHeight / 2, innerWidth / 2, 200); // Absolute max side length

    // Block 5: Data Preprocessing & Transformation
    const maxTotalArea = innerWidth * innerHeight * fillRatio;
    const totalValue = d3.sum(chartData, d => +d[yField]);
    const areaPerUnit = totalValue > 0 ? maxTotalArea / totalValue : 0;

    let nodes = chartData.map((d, i) => ({
        id: d[xField] != null ? String(d[xField]) : `__${i}__`,
        val: +d[yField],
        area: +d[yField] * areaPerUnit,
        color: fillStyle.getSquareColor(String(d[xField])),
        raw: d
    })).sort((a, b) => b.area - a.area);

    nodes.forEach(n => {
        let side = Math.sqrt(n.area);
        side = Math.max(minSideAbsolute, Math.min(side, maxSideAbsolute));
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
    
    // Filter out nodes that became too small after scaling
    nodes = nodes.filter(n => n.width >= minSideAbsolute && n.height >= minSideAbsolute);
    if (!nodes.length) {
        d3.select(containerSelector).html(""); // Clear again
        d3.select(containerSelector).append("div")
            .style("padding", "10px")
            .html("No data points are large enough to display after scaling.");
        return null;
    }


    function assignInitialPositionsForceLayout() {
        const gridSide = Math.ceil(Math.sqrt(nodes.length));
        const cellSize = Math.max(
            d3.max(nodes, d => d.width) || minSideAbsolute,
            Math.sqrt(innerWidth * innerHeight / (gridSide * gridSide))
        );
        
        const centerX = innerWidth / 2;
        const centerY = innerHeight / 2;
        const startX = centerX - (cellSize * (gridSide - 1)) / 2;
        const startY = centerY - (cellSize * (gridSide - 1)) / 2;

        let cells = [];
        for (let row = 0; row < gridSide; row++) {
            for (let col = 0; col < gridSide; col++) {
                cells.push({row, col, distance: Math.sqrt(Math.pow(row - (gridSide-1)/2, 2) + Math.pow(col - (gridSide-1)/2, 2))});
            }
        }
        cells.sort((a, b) => a.distance - b.distance);
        
        nodes.forEach((node, i) => {
            const cell = cells[i % cells.length];
            const jitter = cellSize * 0.1;
            node.x = startX + cell.col * cellSize + cellSize/2 + (Math.random() - 0.5) * jitter;
            node.y = startY + cell.row * cellSize + cellSize/2 + (Math.random() - 0.5) * jitter;
            node.x = Math.max(node.width/2, Math.min(innerWidth - node.width/2, node.x));
            node.y = Math.max(TOP_PROTECTED_AREA + node.height/2, Math.min(innerHeight - node.height/2, node.y));
        });

        if (nodes.length > 0 && nodes[0]) { // Largest node slightly towards center
            nodes[0].x = innerWidth * 0.5 + (Math.random() - 0.5) * 10;
            nodes[0].y = innerHeight * 0.5 + (Math.random() - 0.5) * 10;
        }
    }
    assignInitialPositionsForceLayout();

    function rectCollideForce() {
        let currentNodes = [];
        let strength = 1;
        const padding = 2; // Minimal padding between squares

        function force(alpha) {
            const quadtree = d3.quadtree()
                .x(d => d.x).y(d => d.y)
                .addAll(currentNodes);

            for (let i = 0; i < currentNodes.length; ++i) {
                const nodeA = currentNodes[i];
                const r = Math.max(nodeA.width, nodeA.height) / 2 + padding;
                const nx1 = nodeA.x - r;
                const nx2 = nodeA.x + r;
                const ny1 = nodeA.y - r;
                const ny2 = nodeA.y + r;

                quadtree.visit((quad, x1, y1, x2, y2) => {
                    if (!quad.length) {
                        do {
                            const nodeB = quad.data;
                            if (nodeB && nodeB !== nodeA) {
                                let dx = nodeA.x - nodeB.x;
                                let dy = nodeA.y - nodeB.y;
                                const combinedHalfWidths = (nodeA.width + nodeB.width) / 2 + padding;
                                const combinedHalfHeights = (nodeA.height + nodeB.height) / 2 + padding;
                                
                                if (Math.abs(dx) < combinedHalfWidths && Math.abs(dy) < combinedHalfHeights) {
                                    const overlapX = combinedHalfWidths - Math.abs(dx);
                                    const overlapY = combinedHalfHeights - Math.abs(dy);
                                    
                                    const l = Math.sqrt(dx * dx + dy * dy) || 1; // distance
                                    const k = strength * alpha;

                                    // Resolve collision based on smaller overlap
                                    if (overlapX < overlapY) {
                                        const push = overlapX * (dx > 0 ? 1 : -1) / l * k;
                                        nodeA.vx += push; 
                                        nodeB.vx -= push;
                                    } else {
                                        const push = overlapY * (dy > 0 ? 1 : -1) / l * k;
                                        nodeA.vy += push;
                                        nodeB.vy -= push;
                                    }
                                }
                            }
                        } while (quad = quad.next);
                    }
                    return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
                });
            }
        }
        force.initialize = (_) => { currentNodes = _; };
        force.strength = (_) => { strength = _ == null ? strength : _; return force; };
        return force;
    }
    
    const simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.03))
        .force("charge", d3.forceManyBody().strength(-15))
        .force("collide", rectCollideForce().strength(0.8))
        .force("x", d3.forceX(innerWidth / 2).strength(0.02))
        .force("y", d3.forceY(innerHeight / 2).strength(0.02))
        .stop();

    const numIterations = Math.max(150, Math.min(300, nodes.length * 10)); // Adaptive iterations
    for (let i = 0; i < numIterations; ++i) {
        simulation.tick();
        nodes.forEach(d => {
            if (!d.fx) { // Boundary enforcement
                d.x = Math.max(d.width / 2, Math.min(innerWidth - d.width / 2, d.x));
                d.y = Math.max(TOP_PROTECTED_AREA + d.height / 2, Math.min(innerHeight - d.height / 2, d.y));
            }
        });
    }
    
    nodes.forEach((d, i) => { d.zIndex = nodes.length - i; }); // Smaller area (later in sorted list) on top

    // Block 6: Scale Definition & Configuration
    // Color scale logic is embedded in fillStyle.getSquareColor

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type.

    // Block 8: Main Data Visualization Rendering
    const nodeGroups = mainChartGroup.selectAll("g.node-group")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", d => `mark-group node-group node-${d.id.replace(/\s+/g, '-')}`)
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .sort((a, b) => a.zIndex - b.zIndex);

    nodeGroups.append("rect")
        .attr("class", "mark square")
        .attr("x", d => -d.width / 2)
        .attr("y", d => -d.height / 2)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("fill", d => d.color)
        .attr("stroke", "#FFFFFF") // Simple white stroke for separation
        .attr("stroke-width", 1)
        .attr("rx", 1) // Minimal rounding
        .attr("ry", 1);

    // Text rendering
    const minAcceptableFontSize = 8;
    const catLineHeightFactor = 0.3; // Factor of font size for line height adjustment
    const textPaddingFactor = 0.85; // Max text width as factor of square side

    nodeGroups.each(function(d) {
        const group = d3.select(this);
        const side = d.width;
        const valueTextContent = `${d.val}${yFieldUnit}`;
        let categoryTextContent = d.id.startsWith("__") ? "" : d.id;
        
        const adaptiveTextColor = getTextColorForBackground(d.color);
        const maxTextWidthAllowed = side * textPaddingFactor;

        // Initial font size estimation
        let currentFontSize = Math.max(
            minAcceptableFontSize,
            Math.min(
                side * 0.3, // Heuristic: font size up to 30% of side
                (fillStyle.typography.valueFontSize + fillStyle.typography.categoryFontSize) / 2, // Average of configured
                24 // Absolute max font size
            )
        );

        let valueWidth, categoryWidth, categoryLines = 1, categoryLabelHeight = currentFontSize;
        let shouldWrapCategory = false;

        // Iteratively adjust font size
        while (currentFontSize >= minAcceptableFontSize) {
            valueWidth = estimateTextWidthSVG(valueTextContent, fillStyle.typography.valueFontFamily, currentFontSize, fillStyle.typography.valueFontWeight);
            categoryWidth = categoryTextContent ? estimateTextWidthSVG(categoryTextContent, fillStyle.typography.categoryFontFamily, currentFontSize, fillStyle.typography.categoryFontWeight) : 0;
            
            let valueFits = valueWidth <= maxTextWidthAllowed;
            let categoryFits = !categoryTextContent || categoryWidth <= maxTextWidthAllowed;
            shouldWrapCategory = false;

            if (categoryTextContent && !categoryFits && currentFontSize >= minAcceptableFontSize + 2) { // Try wrapping if font size allows
                shouldWrapCategory = true;
                const words = categoryTextContent.split(/\s+/);
                let lines = [];
                let currentLineArray = [];
                
                if (words.length <=1 && categoryTextContent.length > 5) { // single long word, try char wrapping
                    let currentSegment = "";
                    for (const char of categoryTextContent) {
                        if (estimateTextWidthSVG(currentSegment + char, fillStyle.typography.categoryFontFamily, currentFontSize, fillStyle.typography.categoryFontWeight) > maxTextWidthAllowed && currentSegment) {
                            lines.push(currentSegment);
                            currentSegment = char;
                        } else {
                            currentSegment += char;
                        }
                    }
                    if (currentSegment) lines.push(currentSegment);

                } else { // word wrapping
                    for (const word of words) {
                        currentLineArray.push(word);
                        if (estimateTextWidthSVG(currentLineArray.join(" "), fillStyle.typography.categoryFontFamily, currentFontSize, fillStyle.typography.categoryFontWeight) > maxTextWidthAllowed && currentLineArray.length > 1) {
                            currentLineArray.pop();
                            lines.push(currentLineArray.join(" "));
                            currentLineArray = [word];
                        }
                    }
                    if (currentLineArray.length > 0) lines.push(currentLineArray.join(" "));
                }
                
                categoryLines = lines.length;
                categoryLabelHeight = categoryLines * currentFontSize * (1 + catLineHeightFactor);
                
                // Check if wrapped category is too tall or individual lines are too wide
                const maxLineWrappedWidth = d3.max(lines, l => estimateTextWidthSVG(l, fillStyle.typography.categoryFontFamily, currentFontSize, fillStyle.typography.categoryFontWeight)) || 0;

                if (categoryLabelHeight > side * textPaddingFactor || maxLineWrappedWidth > maxTextWidthAllowed) {
                    categoryFits = false; // Wrapping didn't solve it or made it too tall/wide
                    shouldWrapCategory = false; 
                } else {
                    categoryFits = true;
                }
            }

            if (valueFits && categoryFits) break;
            currentFontSize -= 1;
        }
        
        const finalFontSize = currentFontSize;
        const showValue = valueWidth <= maxTextWidthAllowed && finalFontSize >= minAcceptableFontSize;
        const showCategory = categoryTextContent && finalFontSize >= minAcceptableFontSize && (categoryWidth <= maxTextWidthAllowed || shouldWrapCategory) && side >= minSideAbsolute * 1.5;


        let finalValueY = 0;
        let finalCategoryY = 0;
        const totalTextHeight = (showCategory ? categoryLabelHeight : 0) + (showValue ? finalFontSize : 0) + (showCategory && showValue ? finalFontSize * catLineHeightFactor * 0.5 : 0);

        if (showValue && showCategory) {
            finalCategoryY = -totalTextHeight / 2;
            finalValueY = finalCategoryY + categoryLabelHeight + (finalFontSize * catLineHeightFactor * 0.5);
        } else if (showValue) {
            finalValueY = -finalFontSize / 2 + finalFontSize * 0.3; // Adjust for dominant-baseline: hanging
        } else if (showCategory) {
            finalCategoryY = -categoryLabelHeight / 2;
        }


        if (showCategory) {
            const categoryLabel = group.append("text")
                .attr("class", "label category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging") 
                .attr("y", finalCategoryY)
                .style("font-family", fillStyle.typography.categoryFontFamily)
                .style("font-weight", fillStyle.typography.categoryFontWeight)
                .style("font-size", `${finalFontSize}px`)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none");

            if (shouldWrapCategory) {
                const words = categoryTextContent.split(/\s+/);
                let currentLineArray = [];
                let tspanYOffset = 0;

                if (words.length <=1 && categoryTextContent.length > 5) { // char wrapping
                    let currentSegment = "";
                     for (const char of categoryTextContent) {
                        if (estimateTextWidthSVG(currentSegment + char, fillStyle.typography.categoryFontFamily, finalFontSize, fillStyle.typography.categoryFontWeight) > maxTextWidthAllowed && currentSegment) {
                            categoryLabel.append("tspan").attr("x", 0).attr("dy", tspanYOffset === 0 ? 0 : `${finalFontSize * (1 + catLineHeightFactor)}px`).text(currentSegment);
                            tspanYOffset++;
                            currentSegment = char;
                        } else {
                            currentSegment += char;
                        }
                    }
                    if (currentSegment) categoryLabel.append("tspan").attr("x", 0).attr("dy", tspanYOffset === 0 ? 0 : `${finalFontSize * (1 + catLineHeightFactor)}px`).text(currentSegment);

                } else { // word wrapping
                    for (const word of words) {
                        currentLineArray.push(word);
                        if (estimateTextWidthSVG(currentLineArray.join(" "), fillStyle.typography.categoryFontFamily, finalFontSize, fillStyle.typography.categoryFontWeight) > maxTextWidthAllowed && currentLineArray.length > 1) {
                            currentLineArray.pop();
                            categoryLabel.append("tspan").attr("x", 0).attr("dy", tspanYOffset === 0 ? 0 : `${finalFontSize * (1 + catLineHeightFactor)}px`).text(currentLineArray.join(" "));
                            tspanYOffset++;
                            currentLineArray = [word];
                        }
                    }
                    if (currentLineArray.length > 0) {
                        categoryLabel.append("tspan").attr("x", 0).attr("dy", tspanYOffset === 0 ? 0 : `${finalFontSize * (1 + catLineHeightFactor)}px`).text(currentLineArray.join(" "));
                    }
                }
            } else {
                categoryLabel.text(categoryTextContent);
            }
        }
        
        if (showValue) {
            group.append("text")
                .attr("class", "label value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalValueY)
                .style("font-family", fillStyle.typography.valueFontFamily)
                .style("font-weight", fillStyle.typography.valueFontWeight)
                .style("font-size", `${finalFontSize}px`)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none")
                .text(valueTextContent);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No further enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    if (_textMeasurementSVG && _textMeasurementSVG.parentNode) { // Should not happen with current logic
        _textMeasurementSVG.parentNode.removeChild(_textMeasurementSVG);
    }
    _textMeasurementSVG = null; // Release memory

    return svgRoot.node();
}