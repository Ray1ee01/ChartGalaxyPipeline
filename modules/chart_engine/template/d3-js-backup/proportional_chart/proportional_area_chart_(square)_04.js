/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Square)",
  "chart_name": "proportional_area_chart_square_04",
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

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or dark theme handled by caller
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");

    const xFieldName = xFieldCol ? xFieldCol.name : undefined;
    const yFieldName = yFieldCol ? yFieldCol.name : undefined;

    if (!xFieldName || !yFieldName) {
        console.error("Critical chart config missing: xFieldName or yFieldName. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Critical chart configuration missing (x or y field). Cannot render.</div>");
        return null;
    }

    const yFieldUnit = yFieldCol && yFieldCol.unit && yFieldCol.unit !== "none" ? yFieldCol.unit : "";

    const processedChartData = chartData.filter(d => d[yFieldName] != null && !isNaN(parseFloat(d[yFieldName])) && +d[yFieldName] > 0);

    if (processedChartData.length === 0) {
        d3.select(containerSelector).html("<div style='text-align:center; padding: 20px;'>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: colors.other?.primary || "#1f77b4",
        backgroundColor: colors.background_color || "#FFFFFF",
        textColor: colors.text_color || "#212529", // Default dark text color
        defaultCategoryColors: d3.schemeCategory10,
        typography: {
            valueFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            valueFontSize: (typography.annotation && typography.annotation.font_size) || '12px',
            valueFontWeight: (typography.annotation && typography.annotation.font_weight) || 'bold',
            categoryFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            categoryFontSize: (typography.label && typography.label.font_size) || '11px',
            categoryFontWeight: (typography.label && typography.label.font_weight) || 'normal',
        },
        images: {
            field: images.field || {},
            other: images.other || {}
        },
        colors: {
            field: colors.field || {},
            available: colors.available_colors || d3.schemeCategory10,
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = d3.create("svg").style("position", "absolute").style("visibility", "hidden");
        const tempText = tempSvg.append("text")
            .attr("font-family", fontFamily)
            .attr("font-size", fontSize)
            .attr("font-weight", fontWeight)
            .text(text);
        document.body.appendChild(tempSvg.node()); // Needs to be in DOM for getBBox
        const width = tempText.node().getBBox().width;
        tempSvg.remove();
        return width;
    }
    
    function getColorBrightness(color) {
        if (!color) return 0.5; // Default if color is undefined
        let r, g, b;
        if (color.startsWith('rgba')) {
            const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
            if (match) { [r, g, b] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]; }
            else return 0.5;
        } else if (color.startsWith('rgb')) {
            const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) { [r, g, b] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]; }
            else return 0.5;
        } else if (color.startsWith('#')) {
            let hex = color.substring(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            if (hex.length !== 6) return 0.5;
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else {
            return 0.5; // Unknown format
        }
        return (r * 299 + g * 587 + b * 114) / 1000 / 255;
    }

    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? '#000000' : '#FFFFFF'; // Standard contrasting colors
    }

    function truncateText(text, maxWidth, fontFamily, fontSize, fontWeight) {
        if (!text) return '';
        if (estimateTextWidth(text, fontFamily, fontSize, fontWeight) <= maxWidth) {
            return text;
        }
        let truncated = text;
        const ellipsis = '...';
        const ellipsisWidth = estimateTextWidth(ellipsis, fontFamily, fontSize, fontWeight);
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
        .attr("class", "proportional-area-chart-svg")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Simplified margins
    const TOP_PROTECTED_AREA = variables.topProtectedArea !== undefined ? variables.topProtectedArea : 10; // Small top padding for layout

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom - TOP_PROTECTED_AREA;
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top + TOP_PROTECTED_AREA})`)
        .attr("class", "main-chart-group");

    const fillRatio = variables.fillRatio || 0.65; // Adjusted for potentially tighter packing
    const minSquareSide = variables.minSquareSide || 20;
    const maxSquareSide = variables.maxSquareSide || Math.min(innerHeight / 2, innerWidth / 2, 150);
    const SMALL_RECT_THRESHOLD = variables.smallRectThreshold || 30;


    // Block 5: Data Preprocessing & Transformation
    const yValues = processedChartData.map(d => +d[yFieldName]);
    const minYValue = d3.min(yValues) || 0;
    const maxYValue = d3.max(yValues) || 1; // Avoid division by zero if only one item or all same value

    const totalValue = d3.sum(yValues);
    const maxTotalArea = innerWidth * innerHeight * fillRatio;
    const areaPerUnit = totalValue > 0 ? maxTotalArea / totalValue : maxTotalArea;

    const uniqueCategories = [...new Set(processedChartData.map(d => d[xFieldName]))];
    
    const nodesData = processedChartData.map((d, i) => ({
        id: String(d[xFieldName] != null ? d[xFieldName] : `__${i}__`),
        val: +d[yFieldName],
        color: (fillStyle.colors.field && fillStyle.colors.field[d[xFieldName]]) || 
               (fillStyle.colors.available[(uniqueCategories.indexOf(d[xFieldName])) % fillStyle.colors.available.length]),
        initialArea: +d[yFieldName] * areaPerUnit,
        rawData: d
    })).sort((a, b) => b.val - a.val);

    // Block 6: Scale Definition & Configuration
    const sideScale = d3.scaleSqrt()
        .domain([0, maxYValue]) // Use 0 as min for sqrt scale for area
        .range([minSquareSide, maxSquareSide]);

    const scalingFactor = (maxYValue - minYValue) < (maxYValue * 0.3) && maxYValue > 0 ? 0.8 : 1.0; // Boost smaller differences

    nodesData.forEach(n => {
        let side = sideScale(n.val) * scalingFactor;
        side = Math.max(minSquareSide, Math.min(side, maxSquareSide));
        n.width = side;
        n.height = side;
        n.area = side * side;
        n.isSmallRect = side < SMALL_RECT_THRESHOLD;
    });
    
    const initialTotalActualArea = d3.sum(nodesData, d => d.area);
    if (initialTotalActualArea > maxTotalArea && initialTotalActualArea > 0) {
        const scaleCorrection = Math.sqrt(maxTotalArea / initialTotalActualArea);
        nodesData.forEach(n => {
            n.width *= scaleCorrection;
            n.height *= scaleCorrection;
            n.area = n.width * n.height;
            n.isSmallRect = n.width < SMALL_RECT_THRESHOLD; // Re-check after scaling
        });
    }
    
    nodesData.forEach((d, i) => {
        d.zIndex = nodesData.length - i; // Smaller areas (later in sorted array) get higher zIndex
    });


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type (no axes, gridlines, or legend).

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    function assignInitialPositions() {
        const gridSide = Math.ceil(Math.sqrt(nodesData.length));
        const cellSize = Math.max(
            d3.max(nodesData, d => d.width) || minSquareSide,
            Math.sqrt(innerWidth * innerHeight / (gridSide * gridSide)) || minSquareSide
        );
        
        const centerX = innerWidth / 2;
        const centerY = innerHeight / 2;
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
        
        nodesData.forEach((node, i) => {
            const cell = cells[i % cells.length];
            const jitter = cellSize * 0.1;
            node.x = startX + cell.col * cellSize + cellSize/2 + (Math.random() - 0.5) * jitter;
            node.y = startY + cell.row * cellSize + cellSize/2 + (Math.random() - 0.5) * jitter;
            node.x = Math.max(node.width/2, Math.min(innerWidth - node.width/2, node.x));
            node.y = Math.max(node.height/2, Math.min(innerHeight - node.height/2, node.y));
        });

        if (nodesData.length > 0 && nodesData[0]) { // Largest node slightly towards center
            nodesData[0].fx = innerWidth / 2 + (Math.random() - 0.5) * 10;
            nodesData[0].fy = innerHeight / 2 + (Math.random() - 0.5) * 10;
        }
    }
    assignInitialPositions();

    function rectCollide() {
        let currentNodes = [];
        let strength = 1;
        const padding = 2; // Small padding between squares

        function force(alpha) {
            const quadtree = d3.quadtree()
                .x(d => d.x).y(d => d.y)
                .addAll(currentNodes);

            for (let i = 0; i < currentNodes.length; ++i) {
                const nodeA = currentNodes[i];
                const r = Math.max(nodeA.width, nodeA.height) / 2 + padding;
                const nx1 = nodeA.x - r, ny1 = nodeA.y - r;
                const nx2 = nodeA.x + r, ny2 = nodeA.y + r;

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
                                    
                                    const weightA = nodeB.area / (nodeA.area + nodeB.area + 1e-6); // Add epsilon to avoid div by zero
                                    const weightB = nodeA.area / (nodeA.area + nodeB.area + 1e-6);

                                    if (overlapX < overlapY) { // Resolve X overlap
                                        const sign = dx > 0 ? 1 : -1;
                                        if (!nodeA.fx) nodeA.x += overlapX * weightA * sign * strength * alpha;
                                        if (!nodeB.fx) nodeB.x -= overlapX * weightB * sign * strength * alpha;
                                    } else { // Resolve Y overlap
                                        const sign = dy > 0 ? 1 : -1;
                                        if (!nodeA.fy) nodeA.y += overlapY * weightA * sign * strength * alpha;
                                        if (!nodeB.fy) nodeB.y -= overlapY * weightB * sign * strength * alpha;
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
    
    const simulation = d3.forceSimulation(nodesData)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.02))
        .force("charge", d3.forceManyBody().strength(variables.chargeStrength || -15))
        .force("collide", rectCollide().strength(variables.collideStrength || 0.8))
        .force("x", d3.forceX(innerWidth / 2).strength(0.01))
        .force("y", d3.forceY(innerHeight / 2).strength(0.01))
        .stop();

    const numIterations = variables.simulationIterations || 200;
    for (let i = 0; i < numIterations; ++i) {
        simulation.tick();
        nodesData.forEach(d => {
            if (!d.fx) d.x = Math.max(d.width / 2, Math.min(innerWidth - d.width / 2, d.x));
            if (!d.fy) d.y = Math.max(d.height / 2, Math.min(innerHeight - d.height / 2, d.y));
        });
    }
    if (nodesData.length > 0 && nodesData[0] && nodesData[0].fx) { // Unfix the largest node after initial placement
        delete nodesData[0].fx;
        delete nodesData[0].fy;
    }


    const nodeGroups = mainChartGroup.selectAll("g.node-group")
        .data(nodesData, d => d.id)
        .join("g")
        .attr("class", d => `node-group mark group-${d.id.replace(/\s+/g, '-').toLowerCase()}`)
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .sort((a, b) => a.zIndex - b.zIndex);

    nodeGroups.append("rect")
        .attr("class", "mark square-mark")
        .attr("x", d => -d.width / 2)
        .attr("y", d => -d.height / 2)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("fill", d => d.color);

    // Icons
    nodeGroups.each(function(d) {
        if (d.width > (variables.minIconSizeThreshold || 40)) {
            const iconUrl = fillStyle.images.field[d.id];
            if (iconUrl) {
                const gNode = d3.select(this);
                const iconSize = Math.min(d.width / 2, d.height / 2, variables.maxIconSize || 50);
                const yOffset = -d.height / 4; // Position icon in upper part

                gNode.append("image")
                    .attr("class", "icon mark-icon")
                    .attr("xlink:href", iconUrl)
                    .attr("x", -iconSize / 2)
                    .attr("y", yOffset - iconSize / 2)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        }
    });

    // Text Labels
    const valueFontSizeBase = parseFloat(fillStyle.typography.valueFontSize);
    const categoryFontSizeBase = parseFloat(fillStyle.typography.categoryFontSize);
    const externalLabelFontSize = variables.externalLabelFontSize || 12;
    const externalLabelPadding = 3;
    const canvasPadding = 5; // Padding from mainChartGroup edges for external labels
    const minAcceptableFontSize = 8;
    const minSideForCategoryLabel = 15;
    const fontSizeScaleFactor = 0.35;
    const maxInternalFontSize = 28;
    const catLineHeightFactor = 0.3; // Factor of font size

    nodeGroups.each(function(d) {
        const gNode = d3.select(this);
        const side = d.width;
        const valText = `${d.val}${yFieldUnit}`;
        let catText = d.id.startsWith("__") ? "" : d.id;
        const adaptiveTextColor = getTextColorForBackground(d.color);

        if (d.isSmallRect) { // External labels for small rects
            const combinedText = catText ? `${catText}: ${valText}` : valText;
            let currentFontSize = externalLabelFontSize;
            let finalText = combinedText;
            
            let labelWidth = estimateTextWidth(combinedText, fillStyle.typography.valueFontFamily, `${currentFontSize}px`, fillStyle.typography.valueFontWeight);
            const maxAllowedWidth = innerWidth - 2 * canvasPadding;

            if (labelWidth > maxAllowedWidth || (d.x - labelWidth/2 < canvasPadding) || (d.x + labelWidth/2 > innerWidth - canvasPadding)) {
                currentFontSize = Math.max(minAcceptableFontSize, externalLabelFontSize - 2);
                labelWidth = estimateTextWidth(combinedText, fillStyle.typography.valueFontFamily, `${currentFontSize}px`, fillStyle.typography.valueFontWeight);
                if (labelWidth > maxAllowedWidth || (d.x - labelWidth/2 < canvasPadding) || (d.x + labelWidth/2 > innerWidth - canvasPadding)) {
                    const availableWidth = Math.min(maxAllowedWidth, innerWidth - 2 * canvasPadding - (d.x - Math.min(maxAllowedWidth, innerWidth - 2 * canvasPadding)/2 < 0 ? Math.abs(d.x - Math.min(maxAllowedWidth, innerWidth - 2 * canvasPadding)/2) : 0) );
                    finalText = truncateText(combinedText, availableWidth, fillStyle.typography.valueFontFamily, `${currentFontSize}px`, fillStyle.typography.valueFontWeight);
                }
            }
            
            let yPosition, textBaseline;
            const spaceBelow = innerHeight - (d.y + side / 2);
            const spaceAbove = d.y - side / 2;

            if (spaceBelow >= currentFontSize + externalLabelPadding * 2) {
                yPosition = side / 2 + externalLabelPadding;
                textBaseline = "hanging";
            } else if (spaceAbove >= currentFontSize + externalLabelPadding * 2) {
                yPosition = -side / 2 - externalLabelPadding;
                textBaseline = "text-after-edge";
            } else { // Try to fit inside if no space outside
                yPosition = 0; 
                textBaseline = "middle";
                currentFontSize = Math.min(currentFontSize, side * 0.4);
            }
            
            gNode.append("text")
                .attr("class", "label external-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", textBaseline)
                .attr("y", yPosition)
                .style("font-size", `${currentFontSize}px`)
                .style("font-weight", fillStyle.typography.valueFontWeight)
                .style("font-family", fillStyle.typography.valueFontFamily)
                .style("fill", textBaseline === "middle" ? adaptiveTextColor : fillStyle.textColor) // Use adaptive if inside, else default
                .text(finalText);
            return;
        }

        // Internal labels
        let currentFontSize = Math.max(
            minAcceptableFontSize,
            Math.min(side * fontSizeScaleFactor, (valueFontSizeBase + categoryFontSizeBase) / 2, maxInternalFontSize)
        );
        
        const maxTextWidth = side * 0.90;
        let valueWidth, categoryWidth, categoryLines = 1, categoryLabelHeight = currentFontSize, shouldWrapCategory = false;

        while (currentFontSize >= minAcceptableFontSize) {
            valueWidth = estimateTextWidth(valText, fillStyle.typography.valueFontFamily, `${currentFontSize}px`, fillStyle.typography.valueFontWeight);
            categoryWidth = catText ? estimateTextWidth(catText, fillStyle.typography.categoryFontFamily, `${currentFontSize}px`, fillStyle.typography.categoryFontWeight) : 0;
            
            const valueFits = valueWidth <= maxTextWidth;
            let categoryFits = !catText || categoryWidth <= maxTextWidth;
            shouldWrapCategory = false;

            if (catText && !categoryFits && currentFontSize >= minAcceptableFontSize + 2) { // Try wrapping
                const words = catText.split(/\s+/);
                let lines = [];
                let currentLineArray = [];
                let tempCtxForWrap = { font: `${fillStyle.typography.categoryFontWeight} ${currentFontSize}px ${fillStyle.typography.categoryFontFamily}` }; // Mock context for width check
                
                function getMockWidth(text) { return estimateTextWidth(text, fillStyle.typography.categoryFontFamily, `${currentFontSize}px`, fillStyle.typography.categoryFontWeight); }

                if (words.length <=1 && catText.length > 0) { // Character wrapping for single word
                    let currentSegment = "";
                    for(let char of catText) {
                        if(getMockWidth(currentSegment + char) > maxTextWidth && currentSegment.length > 0) {
                            lines.push(currentSegment);
                            currentSegment = char;
                        } else {
                            currentSegment += char;
                        }
                    }
                    if(currentSegment) lines.push(currentSegment);

                } else { // Word wrapping
                    for (const word of words) {
                        currentLineArray.push(word);
                        if (getMockWidth(currentLineArray.join(" ")) > maxTextWidth) {
                            if (currentLineArray.length > 1) currentLineArray.pop(); // Remove last word
                            else { /* single word is too long, will be truncated later or not fit */ }
                            lines.push(currentLineArray.join(" "));
                            currentLineArray = currentLineArray.length > 1 ? [word] : []; // if single word was popped, start new line with it.
                            if (currentLineArray.length === 0 && line.length > 1) currentLineArray = [word]; // if previous line had more than one word
                            else if (currentLineArray.length === 0 && line.length === 1) { /* single word too long, keep it for next line */ currentLineArray = [word];}


                        }
                    }
                    if (currentLineArray.length > 0) lines.push(currentLineArray.join(" "));
                }


                if (lines.length > 0 && lines.length <=3) { // Max 3 lines for category
                    categoryLines = lines.length;
                    categoryLabelHeight = categoryLines * currentFontSize * (1 + catLineHeightFactor);
                    categoryFits = true;
                    shouldWrapCategory = true;
                } else {
                    categoryFits = false; // Wrapping didn't help or too many lines
                }
            }
            
            const totalTextHeight = (catText && categoryFits ? categoryLabelHeight : 0) + 
                                  (valueFits ? currentFontSize : 0) + 
                                  (catText && categoryFits && valueFits ? currentFontSize * catLineHeightFactor : 0); // Gap

            if (valueFits && categoryFits && totalTextHeight <= side * 0.9) break;
            currentFontSize -= 1;
        }
        
        const finalFontSize = currentFontSize;
        const showValue = finalFontSize >= minAcceptableFontSize && estimateTextWidth(valText, fillStyle.typography.valueFontFamily, `${finalFontSize}px`, fillStyle.typography.valueFontWeight) <= maxTextWidth;
        const showCategory = catText && finalFontSize >= minAcceptableFontSize && side >= minSideForCategoryLabel && 
                             (shouldWrapCategory || estimateTextWidth(catText, fillStyle.typography.categoryFontFamily, `${finalFontSize}px`, fillStyle.typography.categoryFontWeight) <= maxTextWidth);

        let finalValueY = 0, finalCategoryY = 0;
        const isLargeSquareWithIcon = d.width > (variables.minIconSizeThreshold || 40) && fillStyle.images.field[d.id];

        if (showValue && showCategory) {
            const totalHeight = categoryLabelHeight + finalFontSize + finalFontSize * catLineHeightFactor * 0.5; // category + value + small gap
            const startY = isLargeSquareWithIcon ? d.height * 0.15 - totalHeight / 2 : -totalHeight / 2; // Shift down if icon
            finalCategoryY = startY;
            finalValueY = startY + categoryLabelHeight + finalFontSize * catLineHeightFactor * 0.5;
        } else if (showValue) {
            finalValueY = isLargeSquareWithIcon ? d.height * 0.25 : 0;
        } else if (showCategory) {
            finalCategoryY = isLargeSquareWithIcon ? d.height * 0.25 - categoryLabelHeight / 2 : -categoryLabelHeight / 2;
        }

        if (showValue) {
            gNode.append("text")
                .attr("class", "label value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging") // Value usually below category
                .attr("y", finalValueY)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.valueFontWeight)
                .style("font-family", fillStyle.typography.valueFontFamily)
                .style("fill", adaptiveTextColor)
                .text(valText);
        }

        if (showCategory) {
            const catLabel = gNode.append("text")
                .attr("class", "label category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalCategoryY)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.categoryFontWeight)
                .style("font-family", fillStyle.typography.categoryFontFamily)
                .style("fill", adaptiveTextColor);

            if (shouldWrapCategory) {
                const words = catText.split(/\s+/);
                let lineArray = [];
                let currentLineNumber = 0;
                let tspan = catLabel.append("tspan").attr("x", 0).attr("dy", 0);
                
                function getMockWidth(text) { return estimateTextWidth(text, fillStyle.typography.categoryFontFamily, `${finalFontSize}px`, fillStyle.typography.categoryFontWeight); }

                if (words.length <= 1 && catText.length > 0) { // Character wrapping
                    let currentSegment = "";
                    for(let char of catText) {
                        if(getMockWidth(currentSegment + char) > maxTextWidth && currentSegment.length > 0) {
                            tspan.text(currentSegment);
                            currentLineNumber++;
                            currentSegment = char;
                            tspan = catLabel.append("tspan").attr("x", 0).attr("dy", `${1 + catLineHeightFactor}em`).text(currentSegment);
                        } else {
                            currentSegment += char;
                        }
                    }
                    tspan.text(currentSegment);
                } else { // Word wrapping
                    for (const word of words) {
                        lineArray.push(word);
                        if (getMockWidth(lineArray.join(" ")) > maxTextWidth) {
                            if (lineArray.length > 1) lineArray.pop(); // Remove last word
                            tspan.text(lineArray.join(" "));
                            currentLineNumber++;
                            lineArray = lineArray.length > 1 ? [word] : [];
                             if (lineArray.length === 0 && line.length > 1) lineArray = [word];
                             else if (lineArray.length === 0 && line.length === 1) lineArray = [word];

                            tspan = catLabel.append("tspan").attr("x", 0).attr("dy", `${1 + catLineHeightFactor}em`);
                        }
                    }
                    if (lineArray.length > 0) tspan.text(lineArray.join(" "));
                }
                 // Adjust vertical position for multi-line text to center the block
                if (currentLineNumber > 0) {
                    catLabel.attr("y", finalCategoryY - (currentLineNumber * finalFontSize * (1 + catLineHeightFactor)) / 2 + (finalFontSize * (1+catLineHeightFactor))/2);
                }


            } else {
                catLabel.text(catText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Force simulation handles layout; text and icons are part of main rendering.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}