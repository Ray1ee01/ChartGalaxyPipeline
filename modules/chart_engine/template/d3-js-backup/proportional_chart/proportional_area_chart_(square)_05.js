/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Square)",
  "chart_name": "proportional_area_chart_square_05",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 6]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
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
    d3.select(containerSelector).html(""); // Clear the container

    const chartDataInput = data.data?.data || [];
    const config = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || (data.colors_dark || {});
    const imagesConfig = data.images || {};
    const dataColumns = data.data?.columns || [];

    const xFieldName = dataColumns.find(col => col.role === "x")?.name;
    const yFieldName = dataColumns.find(col => col.role === "y")?.name;
    const groupFieldName = dataColumns.find(col => col.role === "group")?.name;
    const yFieldUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y")?.unit || "");

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x field" : null,
            !yFieldName ? "y field" : null,
            !groupFieldName ? "group field" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const chartData = chartDataInput.filter(d => d[yFieldName] != null && !isNaN(parseFloat(d[yFieldName])) && parseFloat(d[yFieldName]) > 0);

    if (chartData.length === 0) {
        const errorMsg = "No valid data points to render the chart.";
        console.warn(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography Tokens
    fillStyle.typography.titleFontFamily = typographyConfig.title?.font_family || 'Arial, sans-serif';
    fillStyle.typography.titleFontSize = typographyConfig.title?.font_size || '16px';
    fillStyle.typography.titleFontWeight = typographyConfig.title?.font_weight || 'bold';

    fillStyle.typography.labelFontFamily = typographyConfig.label?.font_family || 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = typographyConfig.label?.font_size || '12px';
    fillStyle.typography.labelFontWeight = typographyConfig.label?.font_weight || 'normal';

    fillStyle.typography.annotationFontFamily = typographyConfig.annotation?.font_family || 'Arial, sans-serif';
    fillStyle.typography.annotationFontSize = typographyConfig.annotation?.font_size || '11px'; // Base size
    fillStyle.typography.annotationFontWeight = typographyConfig.annotation?.font_weight || 'normal';


    // Color Tokens
    fillStyle.colors.textColor = colorsConfig.text_color || '#333333';
    fillStyle.colors.backgroundColor = colorsConfig.background_color || '#FFFFFF';
    fillStyle.colors.primary = colorsConfig.other?.primary || d3.schemeCategory10[0];
    const defaultCategoricalColors = d3.schemeTableau10;

    function measureTextSVG(text, style = {}) {
        if (!text) return 0;
        const { fontFamily = 'Arial, sans-serif', fontSize = '12px', fontWeight = 'normal' } = style;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        tempSvg.appendChild(textEl);
        // Note: getBBox on an in-memory, non-rendered SVG element can be unreliable in some environments.
        // For maximum robustness, it would be appended to the DOM, measured, then removed.
        // However, adhering to "MUST NOT be appended to the document DOM".
        try {
            return textEl.getBBox().width;
        } catch (e) {
            // Fallback using canvas if getBBox fails
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
            return context.measureText(text).width;
        }
    }
    
    function getCanvasTextWidth(text, fontStyleString) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = fontStyleString;
        return context.measureText(text).width;
    }


    function getColorBrightness(colorStr) {
        if (!colorStr) return 0.5; // Default for unknown
        let r, g, b;
        if (colorStr.startsWith('#')) {
            let hex = colorStr.slice(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            if (hex.length !== 6) return 0.5;
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else if (colorStr.startsWith('rgb')) {
            const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (!match) return 0.5;
            [ , r, g, b] = match.map(Number);
        } else {
            return 0.5; // Unknown format
        }
        return (r * 299 + g * 587 + b * 114) / 1000 / 255; // Luma formula, scaled 0-1
    }

    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? '#000000' : '#FFFFFF';
    }

    function truncateText(text, maxWidth, style) {
        if (!text) return '';
        if (measureTextSVG(text, style) <= maxWidth) {
            return text;
        }
        let truncated = text;
        const ellipsis = '...';
        const ellipsisWidth = measureTextSVG(ellipsis, style);
        while (truncated.length > 0 && measureTextSVG(truncated + ellipsis, style) > maxWidth) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + ellipsis;
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("class", "chart-svg-root other")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.colors.backgroundColor);

    const chartMargins = { top: 50, right: 20, bottom: 20, left: 20 }; // Adjusted top margin for legend

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const plotWidth = containerWidth - chartMargins.left - chartMargins.right;
    const plotHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const FILL_RATIO = 0.50;
    const MIN_RADIUS = 20; // Corresponds to min side length of 40
    const MAX_SIDE_LENGTH_CONFIG = 200;
    const SMALL_RECT_THRESHOLD = 30; // Side length below which labels are external

    // Block 5: Data Preprocessing & Transformation
    const yValues = chartData.map(d => +d[yFieldName]);
    const minYValue = d3.min(yValues) || 0;
    const maxYValue = d3.max(yValues) || 0;
    const totalYValue = d3.sum(yValues);

    const maxTotalAreaAllowed = plotWidth * plotHeight * FILL_RATIO;
    const areaPerUnitValue = totalYValue > 0 ? maxTotalAreaAllowed / totalYValue : 0;

    const uniqueGroupNames = [...new Set(chartData.map(d => d[groupFieldName]))].sort();

    let nodes = chartData.map((d, i) => ({
        id: String(d[xFieldName] != null ? d[xFieldName] : `__auto_id_${i}__`),
        val: +d[yFieldName],
        group: d[groupFieldName],
        raw: d,
        // Placeholder for layout properties
        x: plotWidth / 2, 
        y: plotHeight / 2,
        width: 0,
        height: 0,
        area: 0,
        color: '',
        isSmallRect: false
    })).sort((a, b) => b.val - a.val); // Sort descending by value for z-index and initial placement

    // Block 6: Scale Definition & Configuration
    const colorScale = d3.scaleOrdinal()
        .domain(uniqueGroupNames)
        .range(uniqueGroupNames.map((group, i) =>
            (colorsConfig.field && colorsConfig.field[group]) ||
            (colorsConfig.available_colors && colorsConfig.available_colors[i % colorsConfig.available_colors.length]) ||
            defaultCategoricalColors[i % defaultCategoricalColors.length]
        ));

    const minSideLength = MIN_RADIUS * 2;
    const maxSideLength = Math.min(plotHeight / 3, MAX_SIDE_LENGTH_CONFIG);

    const sideScale = d3.scaleSqrt()
        .domain([0, maxYValue]) // Use 0 as min domain for sqrt scale for area proportionality
        .range([minSideLength, maxSideLength]);

    const yValueSpreadFactor = (maxYValue > 0 && (maxYValue - minYValue) < (maxYValue * 0.3)) ? 0.7 : 1.0;

    nodes.forEach(n => {
        let side = sideScale(n.val) * yValueSpreadFactor;
        side = Math.max(minSideLength, Math.min(side, maxSideLength));
        n.width = side;
        n.height = side;
        n.area = side * side; // Area based on actual side length
        n.isSmallRect = side < SMALL_RECT_THRESHOLD;
        n.color = colorScale(n.group);
    });
    
    const currentTotalArea = d3.sum(nodes, d => d.area);
    if (currentTotalArea > maxTotalAreaAllowed && currentTotalArea > 0) {
        const scaleFactor = Math.sqrt(maxTotalAreaAllowed / currentTotalArea);
        nodes.forEach(n => {
            n.width *= scaleFactor;
            n.height *= scaleFactor;
            n.area = n.width * n.height;
            n.isSmallRect = n.width < SMALL_RECT_THRESHOLD; // Re-evaluate based on new size
        });
    }
    
    nodes.forEach((d, i) => { d.zIndex = nodes.length - i; });


    // Block 7: Chart Component Rendering (Legend)
    if (uniqueGroupNames.length > 0) {
        const legendFontSize = parseFloat(fillStyle.typography.labelFontSize);
        const legendSquareSize = Math.max(10, legendFontSize * 0.8);
        const legendItemPadding = 5;
        const legendColumnPadding = 15;
        const legendTopMargin = 10; // From top of SVG, not mainChartGroup

        const legendGroupContainer = svgRoot.append("g")
            .attr("class", "legend-group other")
            .attr("transform", `translate(${chartMargins.left}, ${legendTopMargin})`);

        let currentX = 0;
        const legendTitleText = groupFieldName ? `${groupFieldName}:` : "Legend:";
        
        const legendTitle = legendGroupContainer.append("text")
            .attr("class", "legend-title label text")
            .attr("x", 0)
            .attr("y", legendSquareSize / 2)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", легендFontSize + 'px') // Use labelFontSize for consistency
            .style("font-weight", "bold") // Make title bold
            .style("fill", fillStyle.colors.textColor)
            .text(legendTitleText);

        currentX += measureTextSVG(legendTitleText, { fontFamily: fillStyle.typography.labelFontFamily, fontSize: legendFontSize + 'px', fontWeight: "bold" }) + legendColumnPadding;

        uniqueGroupNames.forEach(groupName => {
            const legendItem = legendGroupContainer.append("g")
                .attr("class", "legend-item other")
                .attr("transform", `translate(${currentX}, 0)`);

            legendItem.append("rect")
                .attr("class", "legend-mark mark")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", legendSquareSize)
                .attr("height", legendSquareSize)
                .attr("fill", colorScale(groupName))
                .attr("rx", legendSquareSize * 0.1) 
                .attr("ry", legendSquareSize * 0.1);

            const textElement = legendItem.append("text")
                .attr("class", "legend-label label text")
                .attr("x", legendSquareSize + legendItemPadding)
                .attr("y", legendSquareSize / 2)
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", legendFontSize + 'px')
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(groupName);
            
            let itemWidth = legendSquareSize + legendItemPadding;
            try {
                 itemWidth += textElement.node().getBBox().width;
            } catch(e) {
                 itemWidth += measureTextSVG(groupName, { fontFamily: fillStyle.typography.labelFontFamily, fontSize: legendFontSize + 'px', fontWeight: fillStyle.typography.labelFontWeight });
            }
            currentX += itemWidth + legendColumnPadding;
        });
    }


    // Block 8: Main Data Visualization Rendering (Squares via Force Layout)
    function assignInitialPositions() {
        const gridSide = Math.ceil(Math.sqrt(nodes.length));
        const cellSize = Math.max(
            d3.max(nodes, d => d.width) || minSideLength,
            Math.sqrt(plotWidth * plotHeight / (gridSide * gridSide)) || minSideLength
        );
        
        const centerX = plotWidth / 2;
        const centerY = plotHeight / 2;
        const startX = centerX - (cellSize * (gridSide - 1)) / 2;
        const startY = centerY - (cellSize * (gridSide - 1)) / 2;

        let cells = [];
        for (let row = 0; row < gridSide; row++) {
            for (let col = 0; col < gridSide; col++) {
                const distToCenter = Math.sqrt(Math.pow(row - (gridSide - 1) / 2, 2) + Math.pow(col - (gridSide - 1) / 2, 2));
                cells.push({row, col, distance: distToCenter});
            }
        }
        cells.sort((a, b) => a.distance - b.distance); // Place larger items (earlier in sorted `nodes`) towards center

        nodes.forEach((node, i) => {
            const cell = cells[i % cells.length]; // Reuse cells if more nodes than grid spots
            if (cell) {
                const jitter = cellSize * 0.1;
                node.x = startX + cell.col * cellSize + cellSize / 2 + (Math.random() - 0.5) * jitter;
                node.y = startY + cell.row * cellSize + cellSize / 2 + (Math.random() - 0.5) * jitter;
            } // else keep default plotWidth/2, plotHeight/2
            node.x = Math.max(node.width / 2, Math.min(plotWidth - node.width / 2, node.x));
            node.y = Math.max(node.height / 2, Math.min(plotHeight - node.height / 2, node.y));
        });

        if (nodes.length > 0 && nodes[0]) { // Largest node slightly randomized around center
            nodes[0].x = plotWidth * 0.5 + (Math.random() - 0.5) * 10;
            nodes[0].y = plotHeight * 0.5 + (Math.random() - 0.5) * 10;
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
                const r = Math.max(nodeA.width, nodeA.height) / 2 + PADDING;
                quadtree.visit((quad, x1, y1, x2, y2) => {
                    if (!quad.length) {
                        do {
                            if (quad.data !== nodeA) {
                                const nodeB = quad.data;
                                const dx = nodeA.x - nodeB.x;
                                const dy = nodeA.y - nodeB.y;
                                const absDx = Math.abs(dx);
                                const absDy = Math.abs(dy);
                                
                                const combinedHalfWidths = (nodeA.width + nodeB.width) / 2 + PADDING;
                                const combinedHalfHeights = (nodeA.height + nodeB.height) / 2 + PADDING;

                                if (absDx < combinedHalfWidths && absDy < combinedHalfHeights) {
                                    const overlapX = combinedHalfWidths - absDx;
                                    const overlapY = combinedHalfHeights - absDy;
                                    
                                    let moveX = 0, moveY = 0;

                                    if (overlapX < overlapY) { // Resolve X overlap first
                                        moveX = (dx > 0 ? 1 : -1) * overlapX * strength * alpha;
                                    } else { // Resolve Y overlap first
                                        moveY = (dy > 0 ? 1 : -1) * overlapY * strength * alpha;
                                    }
                                    
                                    const totalArea = nodeA.area + nodeB.area;
                                    const weightA = totalArea > 0 ? nodeB.area / totalArea : 0.5;
                                    const weightB = totalArea > 0 ? nodeA.area / totalArea : 0.5;

                                    if (!nodeA.fx) { nodeA.x += moveX * weightA; nodeA.y += moveY * weightA; }
                                    if (!nodeB.fx) { nodeB.x -= moveX * weightB; nodeB.y -= moveY * weightB; }
                                }
                            }
                        } while (quad = quad.next);
                    }
                    return x1 > nodeA.x + r || x2 < nodeA.x - r || y1 > nodeA.y + r || y2 < nodeA.y - r;
                });
            }
        }
        force.initialize = (_) => { currentNodes = _; };
        force.strength = (_) => { strength = _ == null ? strength : _; return force; };
        return force;
    }

    const simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(plotWidth / 2, plotHeight / 2).strength(0.05))
        .force("charge", d3.forceManyBody().strength(-30))
        .force("collide", rectCollide().strength(1.2))
        .force("x", d3.forceX(plotWidth / 2).strength(0.02))
        .force("y", d3.forceY(plotHeight / 2).strength(0.02))
        .stop();

    const NUM_ITERATIONS = Math.max(300, Math.min(500, nodes.length * 15)); // Scale iterations with node count
    for (let i = 0; i < NUM_ITERATIONS; ++i) {
        simulation.tick();
        nodes.forEach(d => { // Boundary constraints
            if (!d.fx) {
                d.x = Math.max(d.width / 2, Math.min(plotWidth - d.width / 2, d.x));
            }
            if (!d.fy) {
                 d.y = Math.max(d.height / 2, Math.min(plotHeight - d.height / 2, d.y));
            }
        });
    }
    
    const squareGroups = mainChartGroup.selectAll("g.square-group")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", d => `square-group mark group-${d.group.toString().replace(/\s+/g, '-').toLowerCase()}`)
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .sort((a, b) => a.zIndex - b.zIndex);

    squareGroups.append("rect")
        .attr("class", "square-mark mark")
        .attr("x", d => -d.width / 2)
        .attr("y", d => -d.height / 2)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("fill", d => d.color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.0)
        .attr("rx", d => d.width * 0.05) // Consistent small rounded corners
        .attr("ry", d => d.height * 0.05);

    // Block 9: Optional Enhancements & Post-Processing (Icons, Labels)
    squareGroups.each(function(d) {
        const groupElement = d3.select(this);
        const side = d.width; // Square side

        // Icons
        if (side > 50) { // Only for larger squares
            const iconUrl = imagesConfig.field && imagesConfig.field[d.id];
            if (iconUrl) {
                const iconSize = side / 2;
                const yOffset = -d.height / 4 + 5; // Icon above center

                groupElement.append("circle")
                    .attr("class", "icon-background other")
                    .attr("cx", 0)
                    .attr("cy", yOffset)
                    .attr("r", iconSize / 2)
                    .attr("fill", "white")
                    .attr("fill-opacity", 0.5)
                    .attr("stroke", "#eee")
                    .attr("stroke-width", 1);

                groupElement.append("image")
                    .attr("class", "icon image")
                    .attr("xlink:href", iconUrl) // xlink:href for wider compatibility
                    .attr("x", -iconSize * 0.8 / 2)
                    .attr("y", yOffset - iconSize * 0.8 / 2)
                    .attr("width", iconSize * 0.8)
                    .attr("height", iconSize * 0.8)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        }

        // Text Labels
        const valText = `${d.val}${yFieldUnit}`;
        const catText = d.id.startsWith("__auto_id_") ? "" : d.id;
        const internalTextColor = getTextColorForBackground(d.color);
        const externalTextColor = fillStyle.colors.textColor;
        
        const baseAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
        const baseLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);

        if (d.isSmallRect) { // External labels for small rects
            const combinedText = catText ? `${catText}: ${valText}` : valText;
            const externalLabelSize = 10; // Fixed small size for external
            const externalLabelPadding = 3;
            const maxExternalWidth = plotWidth * 0.9; // Avoid going off screen

            let finalExtText = combinedText;
            if (measureTextSVG(combinedText, { fontFamily: fillStyle.typography.annotationFontFamily, fontSize: externalLabelSize + 'px', fontWeight: fillStyle.typography.annotationFontWeight }) > maxExternalWidth) {
                finalExtText = truncateText(combinedText, maxExternalWidth, { fontFamily: fillStyle.typography.annotationFontFamily, fontSize: externalLabelSize + 'px', fontWeight: fillStyle.typography.annotationFontWeight });
            }
            
            // Position external label below the square, if space allows, otherwise above
            let yPosition = side / 2 + externalLabelPadding;
            let dominantBaseline = "hanging";
            if (d.y + side / 2 + externalLabelPadding + externalLabelSize > plotHeight) { // Not enough space below
                 yPosition = -side / 2 - externalLabelPadding;
                 dominantBaseline = "auto"; // text-after-edge equivalent
            }

            groupElement.append("text")
                .attr("class", "external-label label text")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", dominantBaseline)
                .attr("y", yPosition)
                .style("font-size", `${externalLabelSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("fill", externalTextColor)
                .text(finalExtText);

        } else { // Internal labels for larger rects
            const maxTextWidth = side * 0.85;
            const MIN_FONT_SIZE = 8;
            const CAT_LINE_HEIGHT_FACTOR = 0.3; // Relative to font size

            let currentFontSize = Math.max(
                MIN_FONT_SIZE,
                Math.min(side * 0.3, (baseAnnotationFontSize + baseLabelFontSize) / 2, 28)
            );

            let valueWidth, categoryWidth, categoryLines = 1, categoryLabelHeight = currentFontSize;
            let valueFits = false, categoryFits = false, canWrapCategory = false;

            while (currentFontSize >= MIN_FONT_SIZE) {
                const valueStyle = { fontFamily: fillStyle.typography.annotationFontFamily, fontSize: currentFontSize + 'px', fontWeight: fillStyle.typography.annotationFontWeight };
                const categoryStyle = { fontFamily: fillStyle.typography.labelFontFamily, fontSize: currentFontSize + 'px', fontWeight: fillStyle.typography.labelFontWeight };
                
                valueWidth = measureTextSVG(valText, valueStyle);
                valueFits = valueWidth <= maxTextWidth;

                if (catText) {
                    categoryWidth = measureTextSVG(catText, categoryStyle);
                    categoryFits = categoryWidth <= maxTextWidth;
                    canWrapCategory = false;

                    if (!categoryFits && currentFontSize >= 10) { // Try wrapping category
                        const words = catText.split(/\s+/);
                        let lines = [];
                        let currentLine = "";
                        let fitsWithWrapping = true;
                        
                        const processWord = (word) => {
                            const testLine = currentLine ? currentLine + " " + word : word;
                            if (measureTextSVG(testLine, categoryStyle) <= maxTextWidth) {
                                currentLine = testLine;
                            } else {
                                if (currentLine) lines.push(currentLine);
                                currentLine = word;
                                if (measureTextSVG(currentLine, categoryStyle) > maxTextWidth) { // Single word too long
                                    fitsWithWrapping = false;
                                }
                            }
                        };
                        
                        if (words.length === 1 && measureTextSVG(words[0], categoryStyle) > maxTextWidth) { // Single word, try char wrapping
                             let tempLine = "";
                             for (const char of catText) {
                                 if (measureTextSVG(tempLine + char, categoryStyle) <= maxTextWidth) {
                                     tempLine += char;
                                 } else {
                                     if (tempLine) lines.push(tempLine);
                                     tempLine = char;
                                     if (measureTextSVG(tempLine, categoryStyle) > maxTextWidth) { fitsWithWrapping = false; break; }
                                 }
                             }
                             if (tempLine && fitsWithWrapping) lines.push(tempLine);

                        } else { // Word wrapping
                            words.forEach(processWord);
                            if (currentLine && fitsWithWrapping) lines.push(currentLine);
                        }


                        if (fitsWithWrapping && lines.length > 0) {
                            categoryLines = lines.length;
                            categoryLabelHeight = categoryLines * currentFontSize + (categoryLines - 1) * currentFontSize * CAT_LINE_HEIGHT_FACTOR;
                            if (categoryLabelHeight + currentFontSize * (valText ? 1.2 : 0) < side * 0.8) { // Check total height
                                categoryFits = true;
                                canWrapCategory = true;
                            } else {
                                categoryFits = false; // Wrapping makes it too tall
                            }
                        } else {
                             categoryFits = false; // Cannot fit even with wrapping
                        }
                    }
                } else {
                    categoryFits = true; // No category text
                }

                if (valueFits && categoryFits) break;
                currentFontSize -= 1;
            }
            
            const finalFontSize = currentFontSize;
            const showValue = valueFits && finalFontSize >= MIN_FONT_SIZE;
            const showCategory = catText && categoryFits && finalFontSize >= MIN_FONT_SIZE && side >= 10;

            let yCat = 0, yVal = 0;
            const hasIcon = side > 50 && imagesConfig.field && imagesConfig.field[d.id];
            const textBlockTopOffset = hasIcon ? (d.height / 8) : 0; // Push text block down if icon is present

            if (showCategory && showValue) {
                const totalTextHeight = categoryLabelHeight + finalFontSize * 1.2; // Approx height for cat + val
                yCat = textBlockTopOffset - totalTextHeight / 2 + categoryLabelHeight / 2;
                yVal = textBlockTopOffset - totalTextHeight / 2 + categoryLabelHeight + finalFontSize * 0.6;
            } else if (showCategory) {
                yCat = textBlockTopOffset;
            } else if (showValue) {
                yVal = textBlockTopOffset;
            }

            if (showCategory) {
                const catLabel = groupElement.append("text")
                    .attr("class", "category-label label text")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle") // Adjusted for multi-line
                    .style("font-size", `${finalFontSize}px`)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("fill", internalTextColor)
                    .style("pointer-events", "none");

                if (canWrapCategory) {
                    const words = catText.split(/\s+/);
                    let currentLine = "";
                    let tSpans = [];
                    
                    const addTSpan = (text) => { tSpans.push(text); };

                    const categoryStyle = { fontFamily: fillStyle.typography.labelFontFamily, fontSize: finalFontSize + 'px', fontWeight: fillStyle.typography.labelFontWeight };

                    if (words.length === 1 && measureTextSVG(words[0], categoryStyle) > maxTextWidth) { // Single word, char wrapping
                         let tempLine = "";
                         for (const char of catText) {
                             if (measureTextSVG(tempLine + char, categoryStyle) <= maxTextWidth) {
                                 tempLine += char;
                             } else {
                                 if (tempLine) addTSpan(tempLine);
                                 tempLine = char;
                             }
                         }
                         if (tempLine) addTSpan(tempLine);
                    } else { // Word wrapping
                        words.forEach(word => {
                            const testLine = currentLine ? currentLine + " " + word : word;
                            if (measureTextSVG(testLine, categoryStyle) <= maxTextWidth) {
                                currentLine = testLine;
                            } else {
                                if (currentLine) addTSpan(currentLine);
                                currentLine = word;
                            }
                        });
                        if (currentLine) addTSpan(currentLine);
                    }
                    
                    const tspanLineHeight = finalFontSize * (1 + CAT_LINE_HEIGHT_FACTOR);
                    const startYOffset = yCat - (tSpans.length - 1) * tspanLineHeight / 2;

                    tSpans.forEach((lineText, idx) => {
                        catLabel.append("tspan")
                            .attr("x", 0)
                            .attr("dy", idx === 0 ? startYOffset : tspanLineHeight)
                            .text(lineText);
                    });

                } else {
                    catLabel.attr("y", yCat).text(catText);
                }
            }

            if (showValue) {
                groupElement.append("text")
                    .attr("class", "value-label value text")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("y", yVal)
                    .style("font-size", `${finalFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("fill", internalTextColor)
                    .style("pointer-events", "none")
                    .text(valText);
            }
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}