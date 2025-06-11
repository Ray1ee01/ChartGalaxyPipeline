/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Square)",
  "chart_name": "proportional_area_chart_square_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const dataColumns = data.data?.columns || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const images = data.images || {}; // Though not used in this chart type

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);

    const categoryFieldName = xFieldDef?.name;
    const valueFieldName = yFieldDef?.name;
    const valueFieldUnit = yFieldDef?.unit === "none" ? "" : yFieldDef?.unit ?? "";

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push(`role '${xFieldRole}'`);
        if (!valueFieldName) missingFields.push(`role '${yFieldRole}'`);
        const errorMsg = `Critical chart config missing: Field names for ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const chartDataArray = chartData.filter(d => d[valueFieldName] != null && +d[valueFieldName] > 0);

    if (!chartDataArray.length) {
        d3.select(containerSelector).html("<div style='padding:10px;'>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typography.title?.font_size || '16px',
            titleFontWeight: typography.title?.font_weight || 'bold',
            labelFontFamily: typography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typography.label?.font_size || '11px', // Base for category
            labelFontWeight: typography.label?.font_weight || 'normal',
            annotationFontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typography.annotation?.font_size || '12px', // Base for value
            annotationFontWeight: typography.annotation?.font_weight || 'bold',
        },
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#000000', // Default general text color
        getCategoryColor: (categoryName, index) => {
            if (colors.field && colors.field[categoryName]) {
                return colors.field[categoryName];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return d3.schemeTableau10[index % 10]; // Fallback
        },
        // Tooltip specific styles (can be extended)
        tooltipBackground: 'rgba(0, 0, 0, 0.75)',
        tooltipTextColor: '#FFFFFF',
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Appending to body temporarily to ensure getBBox works reliably in all browsers, then remove.
        // This is a common pattern, though the prompt says "MUST NOT be appended to the document DOM".
        // Let's try without appending first. If getBBox returns 0, this might be an issue.
        // For robustness, some libraries do append and remove.
        // However, strict adherence to "MUST NOT append" means we rely on getBBox on non-rendered SVG.
        // document.body.appendChild(tempSvg); // Avoid if strictly following prompt
        const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg); // Avoid if strictly following prompt
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
            return 0.5; // Default for unknown color formats
        }
        return (r * 299 + g * 587 + b * 114) / 1000 / 255; // Perceived brightness
    }

    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? (colors.text_color_on_light_bg || '#000000') : (colors.text_color_on_dark_bg ||'#FFFFFF');
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Simplified margins
    const TOP_PROTECTED_AREA = 5; // Minimal protection, can be part of top margin

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const fillRatio = 0.65; // Square packing can be denser
    const minSideLength = 10; // Minimum side length for a square
    const maxSideLength = Math.min(innerHeight / 2, innerWidth / 2, 200); // Max side length

    // Block 5: Data Preprocessing & Transformation
    const maxTotalArea = innerWidth * innerHeight * fillRatio;
    const totalValue = d3.sum(chartDataArray, d => +d[valueFieldName]);
    const areaPerUnit = totalValue > 0 ? maxTotalArea / totalValue : 0;

    let nodesData = chartDataArray.map((d, i) => {
        const value = +d[valueFieldName];
        const area = value * areaPerUnit;
        let side = Math.sqrt(area);
        side = Math.max(minSideLength, Math.min(side, maxSideLength));
        
        return {
            id: String(d[categoryFieldName]) != null ? String(d[categoryFieldName]) : `__${i}__`,
            value: value,
            area: side * side, // Recalculate area based on constrained side
            width: side,
            height: side,
            color: fillStyle.getCategoryColor(String(d[categoryFieldName]), i),
            originalData: d
        };
    }).sort((a, b) => b.area - a.area); // Sort by area descending

    const initialTotalArea = d3.sum(nodesData, d => d.area);
    if (initialTotalArea > maxTotalArea && initialTotalArea > 0) {
        const scaleFactor = Math.sqrt(maxTotalArea / initialTotalArea);
        nodesData.forEach(n => {
            n.width *= scaleFactor;
            n.height *= scaleFactor;
            n.area = n.width * n.height;
        });
    }
    
    nodesData.forEach((d, i) => {
        d.zIndex = nodesData.length - i; // Smaller area (later in sorted list) on top
    });

    // Force Simulation Setup
    function assignInitialPositions() {
        const gridSide = Math.ceil(Math.sqrt(nodesData.length));
        const cellSize = Math.max(
            d3.max(nodesData, d => d.width) || minSideLength,
            Math.sqrt(innerWidth * innerHeight / (gridSide * gridSide)) || minSideLength
        );
        const centerX = innerWidth / 2;
        const centerY = innerHeight / 2;
        const startX = centerX - (cellSize * (gridSide - 1)) / 2;
        const startY = centerY - (cellSize * (gridSide - 1)) / 2;

        let cells = [];
        for (let row = 0; row < gridSide; row++) {
            for (let col = 0; col < gridSide; col++) {
                cells.push({ row, col, distance: Math.sqrt(Math.pow(row - (gridSide - 1) / 2, 2) + Math.pow(col - (gridSide - 1) / 2, 2)) });
            }
        }
        cells.sort((a, b) => a.distance - b.distance);

        nodesData.forEach((node, i) => {
            const cell = cells[i % cells.length];
            if (cell) {
                const jitter = cellSize * 0.1;
                node.x = startX + cell.col * cellSize + cellSize / 2 + (Math.random() - 0.5) * jitter;
                node.y = startY + cell.row * cellSize + cellSize / 2 + (Math.random() - 0.5) * jitter;
            } else { // Fallback if cells run out (should not happen with proper gridSide)
                node.x = innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.1;
                node.y = innerHeight / 2 + (Math.random() - 0.5) * innerHeight * 0.1;
            }
            node.x = Math.max(node.width / 2, Math.min(innerWidth - node.width / 2, node.x));
            node.y = Math.max(TOP_PROTECTED_AREA + node.height / 2, Math.min(innerHeight - node.height / 2, node.y));
        });
        if (nodesData.length > 0 && nodesData[0]) { // Largest node slightly towards center
             nodesData[0].x = innerWidth * 0.5 + (Math.random() - 0.5) * 10;
             nodesData[0].y = innerHeight * 0.5 + (Math.random() - 0.5) * 10;
        }
    }
    assignInitialPositions();

    function rectCollide() {
        let currentNodes = [];
        let strength = 1;
        const padding = 2; // Minimal padding between squares

        function force(alpha) {
            const quadtree = d3.quadtree().x(d => d.x).y(d => d.y).addAll(currentNodes);
            for (let i = 0; i < currentNodes.length; ++i) {
                const nodeA = currentNodes[i];
                const r = Math.max(nodeA.width, nodeA.height) / 2 + padding;
                quadtree.visit((quad, x1, y1, x2, y2) => {
                    if (!quad.length) {
                        do {
                            if (quad.data !== nodeA) {
                                const nodeB = quad.data;
                                const dx = nodeA.x - nodeB.x;
                                const dy = nodeA.y - nodeB.y;
                                const absDx = Math.abs(dx);
                                const absDy = Math.abs(dy);
                                
                                const combinedHalfWidths = (nodeA.width + nodeB.width) / 2 + padding;
                                const combinedHalfHeights = (nodeA.height + nodeB.height) / 2 + padding;

                                if (absDx < combinedHalfWidths && absDy < combinedHalfHeights) {
                                    // Collision
                                    const overlapX = combinedHalfWidths - absDx;
                                    const overlapY = combinedHalfHeights - absDy;
                                    
                                    let moveX = 0;
                                    let moveY = 0;

                                    if (overlapX < overlapY) {
                                        moveX = (dx > 0 ? 1 : -1) * overlapX * strength * alpha;
                                    } else {
                                        moveY = (dy > 0 ? 1 : -1) * overlapY * strength * alpha;
                                    }
                                    
                                    const massRatioA = nodeB.area / (nodeA.area + nodeB.area);
                                    const massRatioB = nodeA.area / (nodeA.area + nodeB.area);

                                    if (!nodeA.fx) { nodeA.x += moveX * massRatioA; nodeA.y += moveY * massRatioA; }
                                    if (!nodeB.fx) { nodeB.x -= moveX * massRatioB; nodeB.y -= moveY * massRatioB; }
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

    const simulation = d3.forceSimulation(nodesData)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.02))
        .force("charge", d3.forceManyBody().strength(-15))
        .force("collide", rectCollide().strength(0.8))
        .force("x", d3.forceX(innerWidth / 2).strength(0.01))
        .force("y", d3.forceY(innerHeight / 2).strength(0.01))
        .stop();

    const numIterations = 250; // Reduced iterations for faster rendering, adjust if layout is poor
    for (let i = 0; i < numIterations; ++i) {
        simulation.tick();
        nodesData.forEach(d => {
            if (!d.fx) {
                d.x = Math.max(d.width / 2 + 1, Math.min(innerWidth - d.width / 2 - 1, d.x));
                d.y = Math.max(TOP_PROTECTED_AREA + d.height / 2 + 1, Math.min(innerHeight - d.height / 2 - 1, d.y));
            }
        });
    }

    // Block 6: Scale Definition & Configuration
    // Color scale is implicitly handled by node.color property set during nodeData creation.

    // Block 7: Chart Component Rendering (No Axes, Gridlines, Legend for this chart type)
    // No main titles/subtitles as per V.1

    // Block 8: Main Data Visualization Rendering
    const nodeGroups = mainChartGroup.selectAll("g.node-group")
        .data(nodesData, d => d.id)
        .join("g")
        .attr("class", d => `node-group mark ${d.id.replace(/\s+/g, '-')}`) // Add class for item
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .sort((a, b) => a.zIndex - b.zIndex) // Render smaller squares on top
        .style("cursor", "pointer");

    nodeGroups.append("rect")
        .attr("class", "square-mark")
        .attr("x", d => -d.width / 2)
        .attr("y", d => -d.height / 2)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("fill", d => d.color)
        .attr("stroke", d => getColorBrightness(d.color) > 0.8 ? "#cccccc" : "#FFFFFF") // Subtle border
        .attr("stroke-width", 0.5);

    // Text Rendering Logic
    const minAllowedFontSize = 8;
    const textPadding = 0.1; // 10% padding inside square for text
    const categoryLabelLineHeightFactor = 1.2;

    nodeGroups.each(function(d) {
        const group = d3.select(this);
        const squareWidth = d.width;
        const squareHeight = d.height;
        const maxTextWidth = squareWidth * (1 - 2 * textPadding);
        
        const valueTextContent = `${d.value}${valueFieldUnit}`;
        const categoryTextContent = d.id.startsWith("__") ? "" : d.id;
        
        const adaptiveTextColor = getTextColorForBackground(d.color);

        let currentFontSize = Math.min(
            parseFloat(fillStyle.typography.annotationFontSize), // Start with annotation font size
            squareHeight * 0.3, // Max 30% of height
            maxSideLength * 0.3 // Global max based on maxSide
        );
        currentFontSize = Math.max(currentFontSize, minAllowedFontSize);

        let valueFits = false;
        let categoryFits = false;
        let categoryLines = [];

        while (currentFontSize >= minAllowedFontSize) {
            const valueEstWidth = estimateTextWidth(valueTextContent, fillStyle.typography.annotationFontFamily, `${currentFontSize}px`, fillStyle.typography.annotationFontWeight);
            valueFits = valueEstWidth <= maxTextWidth;

            if (categoryTextContent) {
                // Try to fit category label
                const words = categoryTextContent.split(/\s+/);
                let currentLine = "";
                categoryLines = [];
                for (const word of words) {
                    const testLine = currentLine ? `${currentLine} ${word}` : word;
                    const testWidth = estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                    if (testWidth <= maxTextWidth) {
                        currentLine = testLine;
                    } else {
                        if (currentLine) categoryLines.push(currentLine);
                        currentLine = word;
                        // Check if single word itself is too long
                        if (estimateTextWidth(word, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) > maxTextWidth) {
                             // Word too long, try to break it (simple truncation for now)
                             let truncatedWord = word;
                             while(estimateTextWidth(truncatedWord + "...", fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) > maxTextWidth && truncatedWord.length > 1) {
                                 truncatedWord = truncatedWord.slice(0, -1);
                             }
                             if (truncatedWord.length > 0) currentLine = truncatedWord + "..."; else currentLine = ""; // give up if too small
                             break; // exit word loop
                        }
                    }
                }
                if (currentLine) categoryLines.push(currentLine);
                
                const categoryTotalHeight = categoryLines.length * currentFontSize * categoryLabelLineHeightFactor;
                const valueHeight = currentFontSize;
                const totalTextHeight = categoryTotalHeight + valueHeight + (categoryLines.length > 0 ? currentFontSize * 0.2 : 0); // Small gap
                
                categoryFits = categoryLines.every(line => estimateTextWidth(line, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) <= maxTextWidth) &&
                               totalTextHeight <= squareHeight * (1 - 2 * textPadding);

            } else {
                categoryFits = true; // No category text to fit
            }

            if (valueFits && categoryFits) break;
            currentFontSize -= 1;
        }
        
        const finalFontSize = currentFontSize;

        if (finalFontSize >= minAllowedFontSize) {
            let categoryTextYOffset = 0;
            let valueTextYOffset = 0;
            const numCatLines = categoryLines.length;

            if (categoryTextContent && numCatLines > 0 && categoryFits) {
                const categoryBlockHeight = numCatLines * finalFontSize * categoryLabelLineHeightFactor - (finalFontSize * (categoryLabelLineHeightFactor - 1)); // Tighter packing
                const valueBlockHeight = finalFontSize;
                const totalBlockHeight = categoryBlockHeight + valueBlockHeight + (numCatLines > 0 ? finalFontSize * 0.2 : 0);
                
                categoryTextYOffset = -totalBlockHeight / 2;
                valueTextYOffset = categoryTextYOffset + categoryBlockHeight + (numCatLines > 0 ? finalFontSize * 0.2 : 0);

                const categoryLabel = group.append("text")
                    .attr("class", "label category-label")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .attr("y", categoryTextYOffset)
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", `${finalFontSize}px`)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", adaptiveTextColor)
                    .style("pointer-events", "none");

                categoryLines.forEach((line, i) => {
                    categoryLabel.append("tspan")
                        .attr("x", 0)
                        .attr("dy", i === 0 ? 0 : `${finalFontSize * categoryLabelLineHeightFactor}px`)
                        .text(line);
                });
            } else { // Only value text or category didn't fit
                valueTextYOffset = 0; // Center value text vertically
            }

            if (valueFits) {
                 group.append("text")
                    .attr("class", "label value-label")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", categoryTextContent && numCatLines > 0 && categoryFits ? "hanging" : "middle")
                    .attr("y", valueTextYOffset)
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${finalFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", adaptiveTextColor)
                    .style("pointer-events", "none")
                    .text(valueTextContent);
            }
        }
    });
    
    // Initial fade-in animation for squares
    nodeGroups.style("opacity", 0)
        .transition()
        .duration(700)
        .delay((d, i) => i * 30)
        .style("opacity", 1);

    // Block 9: Optional Enhancements & Post-Processing
    const tooltip = mainChartGroup.append("g")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("pointer-events", "none");

    tooltip.append("rect")
        .attr("class", "tooltip-background")
        .attr("rx", 3)
        .attr("ry", 3)
        .style("fill", fillStyle.tooltipBackground);

    tooltip.append("text")
        .attr("class", "tooltip-text label")
        .style("fill", fillStyle.tooltipTextColor)
        .style("font-size", "12px") // Hardcoded for simplicity, or use typography.annotation
        .style("font-family", fillStyle.typography.annotationFontFamily);

    nodeGroups
        .on("mouseover", function(event, d) {
            const hoveredNode = d3.select(this);
            hoveredNode.raise(); // Bring to front
            hoveredNode.select(".square-mark")
                .transition().duration(150)
                .attr("transform", "scale(1.05)")
                .style("stroke-width", 1.5);

            const tooltipTextContent = `${d.id}: ${d.value}${valueFieldUnit}`;
            tooltip.select("text").text(tooltipTextContent);
            
            const textBBox = tooltip.select("text").node().getBBox();
            const tooltipPadding = { x: 8, y: 5 };
            tooltip.select("rect")
                .attr("x", textBBox.x - tooltipPadding.x)
                .attr("y", textBBox.y - tooltipPadding.y)
                .attr("width", textBBox.width + 2 * tooltipPadding.x)
                .attr("height", textBBox.height + 2 * tooltipPadding.y);

            // Position tooltip (adjust as needed, e.g., based on mouse or element position)
            // Simple positioning above the element's original center
            let ttX = d.x;
            let ttY = d.y - d.height / 2 - (textBBox.height + 2 * tooltipPadding.y) - 5;

            // Boundary checks for tooltip
            if (ttX - (textBBox.width/2 + tooltipPadding.x) < -chartMargins.left) ttX = -chartMargins.left + (textBBox.width/2 + tooltipPadding.x);
            if (ttX + (textBBox.width/2 + tooltipPadding.x) > innerWidth + chartMargins.right) ttX = innerWidth + chartMargins.right - (textBBox.width/2 + tooltipPadding.x);
            if (ttY - (textBBox.height + 2 * tooltipPadding.y) < -chartMargins.top) ttY = d.y + d.height / 2 + 5;


            tooltip.attr("transform", `translate(${ttX}, ${ttY})`)
                .transition().duration(150)
                .style("opacity", 1);
        })
        .on("mouseout", function(event, d) {
            const hoveredNode = d3.select(this);
            hoveredNode.select(".square-mark")
                .transition().duration(150)
                .attr("transform", "scale(1)")
                .style("stroke-width", 0.5);
            
            // Re-sort to maintain zIndex order if needed, though .raise() is temporary
            // nodeGroups.sort((a, b) => a.zIndex - b.zIndex);


            tooltip.transition().duration(150)
                .style("opacity", 0);
        })
        .on("click", function(event, d) {
            console.log(`Square clicked: ID=${d.id}, Value=${d.value}`);
            // Simple click animation
            const clickedNode = d3.select(this).select(".square-mark");
            clickedNode.transition().duration(100).attr("transform", "scale(0.95)")
                .transition().duration(100).attr("transform", "scale(1.02)")
                .transition().duration(100).attr("transform", "scale(1)");
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}