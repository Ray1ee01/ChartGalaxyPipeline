/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart",
  "chart_name": "proportional_area_plain_chart_03",
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assumes light theme, or dark theme passed as data.colors
    const images = data.images || {}; // Not used in this chart, but extracted for consistency

    const categoryColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = categoryColumn ? categoryColumn.name : undefined;
    const valueFieldName = valueColumn ? valueColumn.name : undefined;
    const valueFieldUnit = (valueColumn && valueColumn.unit && valueColumn.unit !== "none") ? valueColumn.unit : "";

    if (!categoryFieldName || !valueFieldName) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field (category)");
        if (!valueFieldName) missingFields.push("y role field (value)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html(""); // Clear the container

    const filteredData = chartDataInput.filter(d => d[valueFieldName] != null && !isNaN(parseFloat(d[valueFieldName])) && +d[valueFieldName] > 0);

    if (!filteredData.length) {
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:grey; padding:10px;'>No valid data to display.</div>");
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '12px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '11px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
        },
        textColor: colors.text_color || '#000000',
        chartBackground: colors.background_color || '#FFFFFF',
        markStroke: colors.other?.mark_stroke || '#FFFFFF',
        markStrokeWidth: typeof variables.mark_stroke_width === 'number' ? variables.mark_stroke_width : 1,
        getCategoryColor: (categoryName, index) => {
            if (colors.field && colors.field[categoryFieldName] && colors.field[categoryFieldName][categoryName]) {
                return colors.field[categoryFieldName][categoryName];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return d3.schemeTableau10[index % d3.schemeTableau10.length];
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox is expected to work on unattached SVG elements with explicit attributes.
        return tempText.getBBox().width;
    }
    
    function getColorBrightness(colorStr) {
        if (!colorStr) return 0.5; // Default for unknown
        let r, g, b;
        const color = d3.color(colorStr);
        if (color) {
            r = color.r;
            g = color.g;
            b = color.b;
            return (r * 299 + g * 587 + b * 114) / 1000 / 255;
        }
        return 0.5; // Fallback
    }

    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? '#000000' : '#FFFFFF'; // Dark text on light, light text on dark
    }

    // Force layout helper: Initial position assignment
    function assignInitialPositions(nodesDataArray, width, height, topProtectedArea, maxNodeSize) {
        const gridSide = Math.ceil(Math.sqrt(nodesDataArray.length));
        const cellSize = Math.max(maxNodeSize, Math.sqrt(width * height / (gridSide * gridSide)));
        
        const centerX = width / 2;
        const centerY = height / 2;
        const startX = centerX - (cellSize * (gridSide - 1)) / 2;
        const startY = centerY - (cellSize * (gridSide - 1)) / 2;

        let cells = [];
        for (let row = 0; row < gridSide; row++) {
            for (let col = 0; col < gridSide; col++) {
                const distToCenter = Math.sqrt(Math.pow(row - (gridSide - 1) / 2, 2) + Math.pow(col - (gridSide - 1) / 2, 2));
                cells.push({row, col, distance: distToCenter});
            }
        }
        cells.sort((a, b) => a.distance - b.distance); // Sort cells by distance to center

        nodesDataArray.forEach((node, i) => {
            const cell = cells[i % cells.length]; // Cycle through cells if more nodes than cells
            const jitter = cellSize * 0.1;
            node.x = startX + cell.col * cellSize + cellSize / 2 + (Math.random() - 0.5) * jitter;
            node.y = startY + cell.row * cellSize + cellSize / 2 + (Math.random() - 0.5) * jitter;
            
            node.x = Math.max(node.width / 2, Math.min(width - node.width / 2, node.x));
            node.y = Math.max(topProtectedArea + node.height / 2, Math.min(height - node.height / 2, node.y));
        });

        if (nodesDataArray.length > 0) { // Largest node (first in sorted array) slightly towards center
            nodesDataArray[0].x = width * 0.5 + (Math.random() - 0.5) * 10;
            nodesDataArray[0].y = height * 0.5 + (Math.random() - 0.5) * 10;
        }
    }

    // Force layout helper: Custom rectangle collision
    function rectCollide() {
        let nodes = [];
        let strength = 1;
        const padding = 5; // Extra safety padding

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
            return -Math.sqrt(overlapX * overlapY); // Negative for overlap
        }

        function force(alpha) {
            const quadtree = d3.quadtree().x(d => d.x).y(d => d.y).addAll(nodes);
            for (let i = 0; i < nodes.length; i++) {
                const nodeA = nodes[i];
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
                                        15 
                                    );
                                    
                                    const ratio = nodeA.area / (nodeA.area + nodeB.area);
                                    let forceX = forceMagnitude * (dx / l);
                                    let forceY = forceMagnitude * (dy / l);

                                    const overlapXVal = (nodeA.width + nodeB.width) / 2 - Math.abs(dx);
                                    const overlapYVal = (nodeA.height + nodeB.height) / 2 - Math.abs(dy);

                                    if (overlapXVal > overlapYVal && Math.abs(dy) > 0.1) forceY *= 1.8;
                                    else if (overlapYVal > overlapXVal && Math.abs(dx) > 0.1) forceX *= 1.8;
                                    
                                    if (!nodeA.fx) {
                                        nodeA.x -= forceX * (1 - ratio) * 0.95;
                                        nodeA.y -= forceY * (1 - ratio) * 0.95;
                                    }
                                    if (!nodeB.fx) {
                                        nodeB.x += forceX * ratio * 0.95;
                                        nodeB.y += forceY * ratio * 0.95;
                                    }
                                }
                            }
                        } while (quad = quad.next);
                    }
                    const nodeRadius = Math.max(nodeA.width, nodeA.height) / 2 + padding;
                    return x1 > nodeA.x + nodeRadius || x2 < nodeA.x - nodeRadius || 
                           y1 > nodeA.y + nodeRadius || y2 < nodeA.y - nodeRadius;
                });
            }
        }
        force.initialize = _ => { nodes = _; };
        force.strength = _ => { strength = _ ?? strength; return force; };
        return force;
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Simplified margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-group");

    const fillRatio = variables.fillRatio || 0.65; // Increased fillRatio for potentially denser packing
    const minElementSide = variables.minElementSide || 10; // Min side length for a square
    const maxElementSide = variables.maxElementSide || Math.min(innerHeight / 2, innerWidth / 2, 200);
    const TOP_PROTECTED_AREA = variables.topProtectedArea || 10; // Small protected area at the top of innerHeight

    const maxTotalArea = innerWidth * innerHeight * fillRatio;
    const totalValue = d3.sum(filteredData, d => +d[valueFieldName]);
    const areaPerUnit = totalValue > 0 ? maxTotalArea / totalValue : maxTotalArea;


    // Block 5: Data Preprocessing & Transformation
    const uniqueCategories = [...new Set(filteredData.map(d => d[categoryFieldName]))];
    
    let nodesDataArray = filteredData.map((d, i) => {
        const value = +d[valueFieldName];
        const category = d[categoryFieldName];
        const area = value * areaPerUnit;
        const categoryIndex = uniqueCategories.indexOf(category);

        return {
            id: String(category != null ? category : `__node_${i}`),
            value: value,
            area: area,
            color: fillStyle.getCategoryColor(category, categoryIndex),
            originalData: d
        };
    }).sort((a, b) => b.area - a.area);

    nodesDataArray.forEach(n => {
        let side = Math.sqrt(n.area);
        side = Math.max(minElementSide, Math.min(side, maxElementSide));
        n.width = side;
        n.height = side;
        n.area = side * side; // Update area based on constrained side
    });

    const initialTotalArea = d3.sum(nodesDataArray, d => d.area);
    if (initialTotalArea > maxTotalArea && initialTotalArea > 0) {
        const scaleFactor = Math.sqrt(maxTotalArea / initialTotalArea);
        nodesDataArray.forEach(n => {
            n.width *= scaleFactor;
            n.height *= scaleFactor;
            n.area = n.width * n.height;
        });
    }
    
    nodesDataArray.forEach((d, i) => { // zIndex for drawing order (smaller on top)
        d.zIndex = nodesDataArray.length - 1 - i; 
    });

    const maxNodeSizeForInitialLayout = d3.max(nodesDataArray, d => Math.max(d.width, d.height)) || minElementSide;
    assignInitialPositions(nodesDataArray, innerWidth, innerHeight, TOP_PROTECTED_AREA, maxNodeSizeForInitialLayout);


    // Block 6: Scale Definition & Configuration (Force Simulation)
    const simulation = d3.forceSimulation(nodesDataArray)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.05))
        .force("charge", d3.forceManyBody().strength(variables.chargeStrength || -30))
        .force("collide", rectCollide().strength(variables.collideStrength || 1.0))
        .force("x", d3.forceX(innerWidth / 2).strength(variables.forceXStrength || 0.02))
        .force("y", d3.forceY(innerHeight / 2).strength(variables.forceYStrength || 0.02))
        .stop();

    const NUM_ITERATIONS = variables.simulationIterations || 300;
    for (let i = 0; i < NUM_ITERATIONS; ++i) {
        simulation.tick();
        // Boundary constraints
        nodesDataArray.forEach(d => {
            if (!d.fx) { // If node is not fixed
                const boundaryForceFactor = 1 - Math.min(1, i / (NUM_ITERATIONS * 0.8)); // Stronger early on
                const boundaryPadding = 5; // How close to edge before force applies

                if (d.x - d.width / 2 < boundaryPadding) d.x += (boundaryPadding - (d.x - d.width / 2)) * 0.1 * boundaryForceFactor;
                if (d.x + d.width / 2 > innerWidth - boundaryPadding) d.x -= ( (d.x + d.width / 2) - (innerWidth - boundaryPadding) ) * 0.1 * boundaryForceFactor;
                if (d.y - d.height / 2 < TOP_PROTECTED_AREA + boundaryPadding) d.y += ( (TOP_PROTECTED_AREA + boundaryPadding) - (d.y - d.height/2) ) * 0.1 * boundaryForceFactor;
                if (d.y + d.height / 2 > innerHeight - boundaryPadding) d.y -= ( (d.y + d.height / 2) - (innerHeight - boundaryPadding) ) * 0.1 * boundaryForceFactor;

                d.x = Math.max(d.width / 2, Math.min(innerWidth - d.width / 2, d.x));
                d.y = Math.max(TOP_PROTECTED_AREA + d.height / 2, Math.min(innerHeight - d.height / 2, d.y));
            }
        });
    }

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type as per requirements.

    // Block 8: Main Data Visualization Rendering
    const nodeElementsSelection = mainChartGroup.selectAll("g.mark-group")
        .data(nodesDataArray, d => d.id)
        .join("g")
        .attr("class", "mark-group")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .sort((a, b) => a.zIndex - b.zIndex); // Draw smaller (higher zIndex) items on top

    nodeElementsSelection.append("rect")
        .attr("class", "mark")
        .attr("x", d => -d.width / 2)
        .attr("y", d => -d.height / 2)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("fill", d => d.color)
        .attr("stroke", fillStyle.markStroke)
        .attr("stroke-width", fillStyle.markStrokeWidth);

    // Text rendering
    const minAcceptableFontSize = variables.minLabelFontSize || 8;
    const minSideForCategoryLabel = variables.minSideForCategoryLabel || 20;
    const fontSizeToSideScaleFactor = variables.fontSizeToSideScaleFactor || 0.38;
    const maxLabelFontSize = variables.maxLabelFontSize || 28;
    const categoryLineHeightFactor = variables.categoryLineHeightFactor || 0.3; // multiplier for 'em'

    nodeElementsSelection.each(function(dNode) {
        const groupElement = d3.select(this);
        const side = dNode.width; // Square side
        const valueTextContent = `${dNode.value}${valueFieldUnit}`;
        const categoryTextContent = dNode.id.startsWith("__node_") ? "" : dNode.id;
        const maxTextWidthAllowed = side * 0.9; // Max width for text inside square

        const adaptiveTextColor = getTextColorForBackground(dNode.color);

        let currentFontSizePx = Math.max(
            minAcceptableFontSize,
            Math.min(
                side * fontSizeToSideScaleFactor,
                (parseFloat(fillStyle.typography.annotationFontSize) + parseFloat(fillStyle.typography.labelFontSize)) / 2,
                maxLabelFontSize
            )
        );

        let valueTextWidth, categoryTextWidth, categoryLines = 1, categoryLabelHeight = currentFontSizePx;
        let canWrapCategory = true;

        while (currentFontSizePx >= minAcceptableFontSize) {
            valueTextWidth = estimateTextWidth(valueTextContent, fillStyle.typography.annotationFontFamily, `${currentFontSizePx}px`, fillStyle.typography.annotationFontWeight);
            categoryTextWidth = categoryTextContent ? estimateTextWidth(categoryTextContent, fillStyle.typography.labelFontFamily, `${currentFontSizePx}px`, fillStyle.typography.labelFontWeight) : 0;
            
            let valueFits = valueTextWidth <= maxTextWidthAllowed;
            let categoryFits = !categoryTextContent || categoryTextWidth <= maxTextWidthAllowed;
            
            canWrapCategory = false; // Reset
            if (categoryTextContent && !categoryFits && currentFontSizePx >= (variables.minWrapFontSize || 10)) {
                // Try wrapping category text
                const words = categoryTextContent.split(/\s+/);
                let lines = [];
                let currentLine = "";
                let tempMaxLineWidth = 0;

                const processToken = (token, isWordEnd) => {
                    const testLine = currentLine ? currentLine + (isWordEnd ? " " : "") + token : token;
                    const testLineWidth = estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, `${currentFontSizePx}px`, fillStyle.typography.labelFontWeight);
                    if (testLineWidth <= maxTextWidthAllowed) {
                        currentLine = testLine;
                    } else {
                        if (currentLine) lines.push(currentLine);
                        currentLine = token;
                    }
                    if (currentLine) tempMaxLineWidth = Math.max(tempMaxLineWidth, estimateTextWidth(currentLine, fillStyle.typography.labelFontFamily, `${currentFontSizePx}px`, fillStyle.typography.labelFontWeight));
                };
                
                if (words.length === 1 && words[0].length > 0) { // Single long word, try char wrapping
                    const chars = words[0].split('');
                    chars.forEach(char => processToken(char, false));
                } else {
                    words.forEach(word => processToken(word, true));
                }
                if (currentLine) lines.push(currentLine);

                if (lines.length > 0 && tempMaxLineWidth <= maxTextWidthAllowed) {
                    const totalHeightForWrapped = lines.length * currentFontSizePx + (lines.length - 1) * currentFontSizePx * categoryLineHeightFactor;
                    if (totalHeightForWrapped <= side * 0.9) { // Check height constraint
                       categoryLines = lines.length;
                       categoryLabelHeight = totalHeightForWrapped;
                       categoryFits = true;
                       canWrapCategory = true;
                    }
                }
            }

            if (valueFits && categoryFits) break;
            currentFontSizePx -= 1;
        }
        
        const finalFontSize = currentFontSizePx;
        const showValueLabel = valueTextWidth <= maxTextWidthAllowed && finalFontSize >= minAcceptableFontSize;
        const showCategoryLabel = categoryTextContent && finalFontSize >= minAcceptableFontSize && side >= minSideForCategoryLabel && (categoryTextWidth <= maxTextWidthAllowed || canWrapCategory);

        let finalValueY = 0, finalCategoryY = 0;
        const totalTextHeight = (showCategoryLabel ? categoryLabelHeight : 0) + (showValueLabel ? finalFontSize : 0) + (showCategoryLabel && showValueLabel ? finalFontSize * categoryLineHeightFactor : 0);
        
        if (showValueLabel && showCategoryLabel) {
            finalCategoryY = -totalTextHeight / 2;
            finalValueY = finalCategoryY + categoryLabelHeight + finalFontSize * categoryLineHeightFactor;
        } else if (showValueLabel) {
            finalValueY = -finalFontSize / 2; // Center vertically
        } else if (showCategoryLabel) {
            finalCategoryY = -categoryLabelHeight / 2; // Center vertically
        }

        if (showValueLabel) {
            groupElement.append("text")
                .attr("class", "label value")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "alphabetic") // Use alphabetic for more consistent vertical centering with y
                .attr("y", finalValueY + finalFontSize * 0.8 / 2) // Adjust y for alphabetic baseline
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", adaptiveTextColor)
                .text(valueTextContent);
        }

        if (showCategoryLabel) {
            const categoryLabelElement = groupElement.append("text")
                .attr("class", "label category")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging") 
                .attr("y", finalCategoryY)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", adaptiveTextColor);

            if (canWrapCategory) {
                const words = categoryTextContent.split(/\s+/);
                let currentLine = "";
                let lineNumber = 0;
                
                const appendTspan = (text) => {
                    categoryLabelElement.append("tspan")
                        .attr("x", 0)
                        .attr("dy", lineNumber === 0 ? 0 : `${1 + categoryLineHeightFactor}em`)
                        .text(text);
                    lineNumber++;
                };

                const processTokenForTspan = (token, isWordEnd) => {
                    const testLine = currentLine ? currentLine + (isWordEnd ? " " : "") + token : token;
                    if (estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, `${finalFontSize}px`, fillStyle.typography.labelFontWeight) <= maxTextWidthAllowed) {
                        currentLine = testLine;
                    } else {
                        if (currentLine) appendTspan(currentLine);
                        currentLine = token;
                    }
                };

                if (words.length === 1 && words[0].length > 0) { // Single long word, char wrapping
                    const chars = words[0].split('');
                    chars.forEach(char => processTokenForTspan(char, false));
                } else {
                    words.forEach(word => processTokenForTspan(word, true));
                }
                if (currentLine) appendTspan(currentLine);

            } else {
                categoryLabelElement.text(categoryTextContent);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}