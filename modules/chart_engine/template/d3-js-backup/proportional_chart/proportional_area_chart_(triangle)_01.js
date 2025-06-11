/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Triangle)",
  "chart_name": "proportional_area_chart_triangle_01",
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
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data?.data || [];
    const dataColumns = data.data?.columns || [];
    const configVariables = data.variables || {};
    const configTypography = data.typography || {};
    const configColors = data.colors || {}; // Assuming light theme, or use a theme selector if data.colors_dark exists
    const configImages = data.images || {}; // Not used in this chart, but good practice

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const yUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y")?.unit || "");

    d3.select(containerSelector).html(""); // Clear container upfront

    if (!xField || !yField) {
        const errorMessage = "Critical chart config missing: Required field roles 'x' or 'y' not found in dataColumns. Cannot render.";
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("padding", "10px")
                .html(errorMessage);
        }
        return null;
    }

    const filteredData = chartDataArray.filter(d => d[yField] != null && !isNaN(parseFloat(d[yField])) && +d[yField] > 0);

    if (!filteredData.length) {
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "#888")
                .style("padding", "10px")
                .html("No valid data to display after filtering.");
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {},
        images: {} // For consistency, though not used
    };

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.labelFontFamily = configTypography.label?.font_family || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = configTypography.label?.font_size || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = configTypography.label?.font_weight || defaultTypography.label.font_weight;

    fillStyle.typography.annotationFontFamily = configTypography.annotation?.font_family || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = configTypography.annotation?.font_size || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = configTypography.annotation?.font_weight || defaultTypography.annotation.font_weight;

    // Color defaults
    const defaultColors = {
        text_color: "#000000",
        background_color: "#FFFFFF",
        primary: "#1f77b4",
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"]
    };

    fillStyle.colors.textColor = configColors.text_color || defaultColors.text_color;
    fillStyle.colors.backgroundColor = configColors.background_color || defaultColors.background_color;
    fillStyle.colors.primary = configColors.other?.primary || defaultColors.primary;
    fillStyle.colors.availableColors = (configColors.available_colors && configColors.available_colors.length > 0)
        ? configColors.available_colors
        : defaultColors.available_colors;

    fillStyle.colors.getCategoryColor = (categoryName, index) => {
        if (configColors.field && configColors.field[categoryName]) {
            return configColors.field[categoryName];
        }
        return fillStyle.colors.availableColors[index % fillStyle.colors.availableColors.length];
    };
    
    fillStyle.triangleStrokeColor = '#ffffff'; // Standard stroke for triangles

    function estimateTextWidthSVG(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // No need to append tempSvg to DOM for getBBox to work on its children in modern browsers
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment (e.g. JSDOM older versions)
            // or if font not available.
            const avgCharWidth = parseFloat(fontSize) * 0.6; // Rough estimate
            width = text.length * avgCharWidth;
        }
        return width;
    }
    
    function getColorBrightness(colorStr) {
        if (!colorStr) return 0.5; // Default for unknown
        let r, g, b;
        if (colorStr.startsWith('#')) {
            let hex = colorStr.substring(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else if (colorStr.startsWith('rgb')) {
            const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (!match) return 0.5;
            r = parseInt(match[1]);
            g = parseInt(match[2]);
            b = parseInt(match[3]);
        } else { // Unknown format, assume medium brightness
            return 0.5;
        }
        return (r * 299 + g * 587 + b * 114) / 1000 / 255; // Luma formula scaled to 0-1
    }

    function getAdaptiveTextColor(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? '#000000' : '#ffffff'; // Dark text on light, light text on dark
    }

    function getTriangleWidthAtHeight(side, totalTriangleHeight, distanceFromTop) {
        if (distanceFromTop < 0 || distanceFromTop > totalTriangleHeight) return 0;
        const baseWidth = side;
        const widthRatio = distanceFromTop / totalTriangleHeight;
        return baseWidth * widthRatio;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = configVariables.width || 600;
    const containerHeight = configVariables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("class", "chart-svg-root")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .style("background-color", fillStyle.colors.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    // Layout constants for packing algorithm
    const fillRatio = 0.80;
    const angleStep = Math.PI / 24;
    const distPadding = 0.3;
    const overlapMax = 0.12;
    const maxDropTries = 2;
    const firstPositions = ["topleft", "center"];
    const candidateSort = "topleft"; // 'topleft', 'center', or 'random'

    const minRadius = 5;
    const maxRadius = Math.min(innerWidth, innerHeight) / 3; // Relative to smaller dimension of drawing area

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(filteredData, d => +d[yField]);
    const totalAreaTarget = innerWidth * innerHeight * fillRatio;
    const areaPerUnit = totalValue > 0 ? totalAreaTarget / totalValue : 0;

    let nodesData = filteredData.map((d, i) => ({
        id: d[xField] != null ? String(d[xField]) : `__${i}__`,
        val: +d[yField],
        area: +d[yField] * areaPerUnit,
        color: fillStyle.colors.getCategoryColor(String(d[xField]), i),
        raw: d
    })).sort((a, b) => b.area - a.area);

    nodesData.forEach(n => {
        let calculatedRadius = Math.sqrt(n.area / Math.PI);
        n.r = Math.max(minRadius, Math.min(calculatedRadius, maxRadius));
        n.area = Math.PI * n.r * n.r; // Update area based on clamped radius
    });
    
    // --- Packing Algorithm Helpers ---
    function interArea(a, b) {
        const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        if (d >= a.r + b.r) return 0;
        if (d <= Math.abs(a.r - b.r)) return Math.PI * Math.min(a.r, b.r) ** 2;
        const α = Math.acos((a.r * a.r + d * d - b.r * b.r) / (2 * a.r * d));
        const β = Math.acos((b.r * b.r + d * d - a.r * a.r) / (2 * b.r * d));
        return a.r * a.r * α + b.r * b.r * β - d * a.r * Math.sin(α);
    }
    const okPair = (a, b) => {
        const ia = interArea(a, b);
        return ia / a.area <= overlapMax && ia / b.area <= overlapMax;
    };
    const okAll = (n, placed) => placed.every(p => okPair(n, p));

    function genCandidates(node, placed) {
        const list = [];
        if (!placed.length) {
            if (firstPositions.includes("topleft")) list.push({ x: node.r, y: node.r });
            if (firstPositions.includes("center")) list.push({ x: innerWidth / 2, y: innerHeight / 2 });
            return list;
        }
        placed.forEach(p => {
            const dist = p.r + node.r + distPadding;
            for (let θ = 0; θ < 2 * Math.PI; θ += angleStep) {
                const x = p.x + dist * Math.cos(θ), y = p.y + dist * Math.sin(θ);
                if (x - node.r < 0 || x + node.r > innerWidth || y - node.r < 0 || y + node.r > innerHeight) continue;
                list.push({ x, y });
            }
        });
        const uniq = new Map();
        list.forEach(p => uniq.set(p.x.toFixed(2) + "," + p.y.toFixed(2), p));
        const arr = [...uniq.values()];
        if (candidateSort === "center") {
            arr.sort((a, b) => (a.y - innerHeight / 2) ** 2 + (a.x - innerWidth / 2) ** 2 - ((b.y - innerHeight / 2) ** 2 + (b.x - innerWidth / 2) ** 2));
        } else if (candidateSort === "random") {
            d3.shuffle(arr);
        } else {
            arr.sort((a, b) => a.y - b.y || a.x - b.x);
        }
        return arr;
    }

    function dfs(idx, currentPlaced, allNodes) {
        if (idx === allNodes.length) return true;
        const node = allNodes[idx];
        for (const c of genCandidates(node, currentPlaced)) {
            node.x = c.x; node.y = c.y;
            if (okAll(node, currentPlaced)) {
                currentPlaced.push(node);
                if (dfs(idx + 1, currentPlaced, allNodes)) return true;
                currentPlaced.pop();
            }
        }
        return false;
    }

    let placedNodes = [];
    let success = false;
    let currentNodesToPlace = [...nodesData]; // Operate on a copy for retries

    for (let attempt = 0; attempt <= maxDropTries; attempt++) {
        placedNodes = [];
        if (dfs(0, placedNodes, currentNodesToPlace)) {
            success = true;
            break;
        }
        if (attempt < maxDropTries && currentNodesToPlace.length > 0) {
            currentNodesToPlace.pop(); // Drop the smallest remaining node (already sorted)
        } else if (attempt === maxDropTries) { // Last attempt failed
             currentNodesToPlace = []; // Ensure placedNodes is empty if all attempts fail
        }
    }
    
    if (!success) placedNodes = []; // Ensure placedNodes is empty if DFS ultimately fails

    placedNodes.forEach((d, i) => {
        d.zIndex = placedNodes.length - i; // Smaller area (later in sorted list) on top
    });


    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales (e.g., x, y axes scales) are used in this chart type.
    // The sizing is based on areaPerUnit.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering
    const nodeGroups = mainChartGroup.selectAll("g.node-group")
        .data(placedNodes, d => d.id)
        .join("g")
        .attr("class", "node-group mark")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .sort((a, b) => a.zIndex - b.zIndex); // Render smaller (higher zIndex) nodes on top

    nodeGroups.each(function(dNode) {
        const groupElement = d3.select(this);
        const side = 2 * dNode.r; // Triangle side from equivalent circle diameter
        const triangleHeight = side * Math.sqrt(3) / 2;
        
        const points = [
            [0, -triangleHeight * 2/3],
            [-side/2, triangleHeight * 1/3],
            [side/2, triangleHeight * 1/3]
        ];
        
        groupElement.append("path")
            .attr("class", "mark triangle-path")
            .attr("d", d3.line()(points))
            .attr("fill", dNode.color)
            .attr("stroke", fillStyle.triangleStrokeColor)
            .attr("stroke-width", 1.0);

        // Text rendering logic
        const valText = `${dNode.val}${yUnit}`;
        let catText = dNode.id.startsWith("__") ? "" : dNode.id;
        const adaptiveTextColor = getAdaptiveTextColor(dNode.color);

        const baseAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
        const baseLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);

        const minAcceptableFontSize = 8;
        const minSideForCategoryLabel = 20; // Min triangle side to attempt category label
        const fontSizeScaleFactor = 0.28; 
        const maxFontSize = 24;
        const catLineHeightFactor = 0.3; // Multiplier for line height relative to font size

        let currentFontSize = Math.max(
            minAcceptableFontSize,
            Math.min(
                side * fontSizeScaleFactor,
                (baseAnnotationFontSize + baseLabelFontSize) / 2, // Avg of configured sizes
                maxFontSize
            )
        );

        let valueWidth = 0, categoryWidth = 0;
        let shouldWrapCategory = false;
        let categoryLines = 1;
        let categoryLineHeightPx = currentFontSize * (1 + catLineHeightFactor);
        let categoryLabelVisualHeight = currentFontSize;
        let valueFits = false, categoryFits = false;
        
        // Initial Y positions (relative to triangle center [0,0])
        let finalCategoryY = -triangleHeight / 6; 
        let finalValueY = triangleHeight / 6;

        while (currentFontSize >= minAcceptableFontSize) {
            valueWidth = estimateTextWidthSVG(valText, fillStyle.typography.annotationFontFamily, currentFontSize + "px", fillStyle.typography.annotationFontWeight);
            categoryWidth = catText ? estimateTextWidthSVG(catText, fillStyle.typography.labelFontFamily, currentFontSize + "px", fillStyle.typography.labelFontWeight) : 0;
            
            categoryLineHeightPx = currentFontSize * (1 + catLineHeightFactor);
            categoryLabelVisualHeight = currentFontSize;
            categoryLines = 1;
            shouldWrapCategory = false;

            const categoryYDistanceFromTop = triangleHeight * 2/3 + finalCategoryY; // Approx.
            const valueYDistanceFromTop = triangleHeight * 2/3 + finalValueY; // Approx.
            
            let availableWidthForValue = getTriangleWidthAtHeight(side, triangleHeight, valueYDistanceFromTop) * 0.8;
            let availableWidthForCategory = catText ? getTriangleWidthAtHeight(side, triangleHeight, categoryYDistanceFromTop) * 0.8 : 0;
            
            valueFits = valueWidth <= availableWidthForValue;
            categoryFits = !catText || categoryWidth <= availableWidthForCategory;
            
            if (catText && !categoryFits && currentFontSize >= parseFloat(fillStyle.typography.labelFontSize) * 0.8) { // Allow wrapping if font not too small
                const words = catText.split(/\s+/);
                let lines = [];
                let currentLineContent = [];
                let fitsWithWrapping = true;
                let currentLineYForWidthCheck = finalCategoryY;

                const processLine = (isCharWrapping) => {
                    const items = isCharWrapping ? catText.split('') : words;
                    let currentLineText = "";
                    items.forEach((item, idx) => {
                        const testText = currentLineText + (isCharWrapping ? "" : (currentLineText ? " " : "")) + item;
                        const itemYDistFromTop = triangleHeight * 2/3 + currentLineYForWidthCheck;
                        const lineWidthAvail = getTriangleWidthAtHeight(side, triangleHeight, itemYDistFromTop) * 0.8;

                        if (estimateTextWidthSVG(testText, fillStyle.typography.labelFontFamily, currentFontSize + "px", fillStyle.typography.labelFontWeight) <= lineWidthAvail || currentLineText === "") {
                            currentLineText = testText;
                        } else {
                            lines.push(currentLineText);
                            currentLineYForWidthCheck += categoryLineHeightPx;
                            currentLineText = item;
                            if (lines.length >= 4 || currentLineYForWidthCheck + currentFontSize > triangleHeight / 2) { // Limit lines and height
                                fitsWithWrapping = false; return; // Exit forEach early if possible
                            }
                        }
                    });
                    if (fitsWithWrapping && currentLineText) lines.push(currentLineText);
                };
                
                if (words.length <= 1 && catText.length > 5) { // Few words or single long word, try char wrapping
                     processLine(true);
                } else if (words.length > 1) { // Word wrapping
                     processLine(false);
                }


                 if (fitsWithWrapping && lines.length > 0 && lines.length <=4) {
                     categoryLines = lines.length;
                     categoryLabelVisualHeight = categoryLines * currentFontSize + (categoryLines - 1) * (categoryLineHeightPx - currentFontSize);
                     categoryFits = true;
                     shouldWrapCategory = true;
                     catText = lines.join("\n"); // Store wrapped text for tspan rendering
                 } else {
                     categoryFits = false; // Original check was !categoryFits, so if wrapping fails, it's still false.
                     shouldWrapCategory = false;
                     catText = dNode.id.startsWith("__") ? "" : dNode.id; // Reset catText
                 }
             }
             
            if (valueFits && categoryFits) break;
            currentFontSize -= 1;
        }
         
        const finalFontSize = currentFontSize;
        const showValue = valueFits && finalFontSize >= minAcceptableFontSize;
        const showCategory = categoryFits && finalFontSize >= minAcceptableFontSize && side >= minSideForCategoryLabel && catText;
         
        if (showValue && showCategory) {
            const totalTextHeight = categoryLabelVisualHeight + (finalFontSize * 0.2) + finalFontSize; // catHeight + spacing + valHeight
            const blockCenterY = triangleHeight * 0.1; // Slightly below geometric center
            
            let categoryYOffset = 0;
            if (shouldWrapCategory && categoryLines > 1) {
                 categoryYOffset = -(categoryLines - 1) * finalFontSize * 0.7; // Adjust for multi-line
                 categoryYOffset -= finalFontSize * 0.4; 
            }
            finalCategoryY = blockCenterY - totalTextHeight / 2 + categoryYOffset - (finalFontSize * 0.3); 
            finalValueY = finalCategoryY + categoryLabelVisualHeight + (finalFontSize * 0.2) + (finalFontSize * 0.3);
        } else if (showValue) {
            finalValueY = triangleHeight * 0.1 - finalFontSize / 2 + (finalFontSize * 0.3);
        } else if (showCategory) {
            finalCategoryY = triangleHeight * 0.1 - categoryLabelVisualHeight / 2 - (finalFontSize * 0.3);
            if (shouldWrapCategory && categoryLines > 1) {
                 finalCategoryY -= (categoryLines - 1) * finalFontSize * 0.7;
                 finalCategoryY -= finalFontSize * 0.4;
            }
        }
         
        if (showValue) {
            groupElement.append("text")
                .attr("class", "label value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalValueY)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none")
                .text(valText);
        }

        if (showCategory) {
            const categoryLabelElement = groupElement.append("text")
                .attr("class", "label category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalCategoryY)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none");

            if (shouldWrapCategory) {
                const lines = catText.split("\n");
                lines.forEach((line, i) => {
                    categoryLabelElement.append("tspan")
                        .attr("class", "text category-line")
                        .attr("x", 0)
                        .attr("dy", i === 0 ? 0 : `${1 + catLineHeightFactor}em`)
                        .text(line);
                });
            } else {
                categoryLabelElement.text(catText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No interactive elements, complex annotations, or icons in this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}