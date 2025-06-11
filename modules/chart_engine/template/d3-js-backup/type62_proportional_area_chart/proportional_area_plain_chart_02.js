/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart",
  "chart_name": "proportional_area_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
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
    const chartRawData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || (data.colors_dark || {});
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const xFieldName = xColumn ? xColumn.name : undefined;
    const yFieldName = yColumn ? yColumn.name : undefined;
    const yFieldUnit = yColumn && yColumn.unit !== "none" ? (yColumn.unit || "") : "";

    if (!xFieldName || !yFieldName) {
        console.error("Critical chart config missing: xFieldName or yFieldName derived from dataColumns is undefined. Roles 'x' and 'y' must be present in data.data.columns.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Critical chart configuration missing: Required field roles (x, y) not found in data.data.columns. Cannot render.</div>");
        }
        return null;
    }

    d3.select(containerSelector).html("");

    const chartDataArray = chartRawData.filter(d =>
        d[yFieldName] !== null &&
        d[yFieldName] !== undefined &&
        !isNaN(parseFloat(d[yFieldName])) &&
        +d[yFieldName] > 0
    );

    if (!chartDataArray.length) {
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='padding:10px;'>No valid data to render after filtering.</div>");
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        markStrokeColor: '#FFFFFF', // Default stroke for marks
        markStrokeWidth: 1.0,       // Default stroke width for marks
        defaultMarkColor: '#CCCCCC' // Default color for marks if no other color is found
    };

    fillStyle.backgroundColor = colors.background_color || '#FFFFFF';
    fillStyle.textColor = colors.text_color || '#333333'; // Default text color

    // Typography for Category Labels (from 'label' in input typography)
    fillStyle.typography.categoryFontFamily = (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif';
    fillStyle.typography.categoryFontSize = (typography.label && typography.label.font_size) ? typography.label.font_size : '12px';
    fillStyle.typography.categoryFontWeight = (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal';

    // Typography for Value Labels (from 'annotation' in input typography)
    fillStyle.typography.valueFontFamily = (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif';
    fillStyle.typography.valueFontSize = (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px';
    fillStyle.typography.valueFontWeight = (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal';

    // In-memory text measurement utility
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox on an unattached element can be tricky, but prompt mandates no DOM attachment.
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            // Fallback for safety, though ideally getBBox works.
            const avgCharWidth = parseFloat(fontSize) * 0.6; // Rough estimate
            width = text.length * avgCharWidth;
        }
        return width;
    }
    
    // Color brightness and adaptive text color helpers
    function getColorBrightness(color) {
        if (!color) return 0.5; // Default if color is undefined
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

    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? '#000000' : '#FFFFFF'; // Prioritize black/white contrast
    }

    // Triangle geometry helper
    function getTriangleWidthAtHeight(side, totalHeight, distanceFromTop) {
        if (distanceFromTop < 0 || distanceFromTop > totalHeight) return 0;
        const baseWidth = side;
        const widthRatio = distanceFromTop / totalHeight;
        return baseWidth * widthRatio;
    }

    // Packing algorithm helpers
    const fillRatio = variables.fillRatio !== undefined ? variables.fillRatio : 0.80;
    const angleStep = variables.angleStep !== undefined ? variables.angleStep : Math.PI / 24;
    const distPadding = variables.distPadding !== undefined ? variables.distPadding : 0.3;
    const overlapMax = variables.overlapMax !== undefined ? variables.overlapMax : 0.12;
    
    function interArea(a, b) {
        const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        if (d >= a.r + b.r) return 0;
        if (d <= Math.abs(a.r - b.r)) return Math.PI * Math.min(a.r, b.r) ** 2;
        const alpha = Math.acos((a.r * a.r + d * d - b.r * b.r) / (2 * a.r * d));
        const beta = Math.acos((b.r * b.r + d * d - a.r * a.r) / (2 * b.r * d));
        return a.r * a.r * alpha + b.r * b.r * beta - d * a.r * Math.sin(alpha);
    }
    const okPair = (a, b) => {
        const ia = interArea(a, b);
        return ia / a.area <= overlapMax && ia / b.area <= overlapMax;
    };
    const okAll = (newNode, placedNodes) => placedNodes.every(p => okPair(newNode, p));

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.backgroundColor);

    const chartMargins = {
        top: variables.margin_top !== undefined ? variables.margin_top : 90,
        right: variables.margin_right !== undefined ? variables.margin_right : 20,
        bottom: variables.margin_bottom !== undefined ? variables.margin_bottom : 60,
        left: variables.margin_left !== undefined ? variables.margin_left : 20,
    };

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const minRadius = variables.minRadius !== undefined ? variables.minRadius : 5;
    const maxRadius = variables.maxRadius !== undefined ? variables.maxRadius : innerHeight / 3;
    
    const maxDropTries = variables.maxDropTries !== undefined ? variables.maxDropTries : 2;
    const firstPositions = variables.firstPositions || ["topleft", "center"];
    const candidateSort = variables.candidateSort || "topleft";

    function genCandidates(node, placedNodes, currentInnerWidth, currentInnerHeight) {
        const list = [];
        if (!placedNodes.length) {
            if (firstPositions.includes("topleft")) list.push({ x: node.r, y: node.r });
            if (firstPositions.includes("center")) list.push({ x: currentInnerWidth / 2, y: currentInnerHeight / 2 });
            return list;
        }
        placedNodes.forEach(p => {
            const dist = p.r + node.r + distPadding;
            for (let theta = 0; theta < 2 * Math.PI; theta += angleStep) {
                const x = p.x + dist * Math.cos(theta);
                const y = p.y + dist * Math.sin(theta);
                if (x - node.r < 0 || x + node.r > currentInnerWidth || y - node.r < 0 || y + node.r > currentInnerHeight) continue;
                list.push({ x, y });
            }
        });
        const uniq = new Map();
        list.forEach(p => uniq.set(p.x.toFixed(2) + "," + p.y.toFixed(2), p));
        const arr = [...uniq.values()];
        if (candidateSort === "center") {
            arr.sort((a, b) => (a.y - currentInnerHeight / 2) ** 2 + (a.x - currentInnerWidth / 2) ** 2 - ((b.y - currentInnerHeight / 2) ** 2 + (b.x - currentInnerWidth / 2) ** 2));
        } else if (candidateSort === "random") {
            d3.shuffle(arr);
        } else { // topleft
            arr.sort((a, b) => a.y - b.y || a.x - b.x);
        }
        return arr;
    }
    
    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => +d[yFieldName]);
    const totalArea = innerWidth * innerHeight * fillRatio;
    const areaPerUnit = totalArea / totalValue;

    const defaultCategoricalColors = d3.schemeCategory10;
    const uniqueXCategories = [...new Set(chartDataArray.map(item => item[xFieldName]))];
    const categoryColorMap = {};
    uniqueXCategories.forEach((category, index) => {
        if (colors.field && colors.field[category]) {
            categoryColorMap[category] = colors.field[category];
        } else if (colors.available_colors && colors.available_colors.length > 0) {
            categoryColorMap[category] = colors.available_colors[index % colors.available_colors.length];
        } else {
            categoryColorMap[category] = defaultCategoricalColors[index % defaultCategoricalColors.length];
        }
    });

    let nodes = chartDataArray.map((d, i) => ({
        id: d[xFieldName] != null ? String(d[xFieldName]) : `__${i}__`,
        val: +d[yFieldName],
        area: +d[yFieldName] * areaPerUnit,
        color: categoryColorMap[d[xFieldName]] || fillStyle.defaultMarkColor,
        raw: d
    })).sort((a, b) => b.area - a.area);

    nodes.forEach(n => {
        let calculatedRadius = Math.sqrt(n.area / Math.PI);
        n.r = Math.max(minRadius, Math.min(calculatedRadius, maxRadius));
        n.area = Math.PI * n.r * n.r;
    });

    // Block 6: Scale Definition & Configuration
    // Scales are implicitly handled by area/radius calculations. No explicit D3 scales for axes.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering
    function dfs(idx, currentPlacedNodes, nodesToPlace) {
        if (idx === nodesToPlace.length) return true;
        const node = nodesToPlace[idx];
        for (const c of genCandidates(node, currentPlacedNodes, innerWidth, innerHeight)) {
            node.x = c.x; node.y = c.y;
            if (okAll(node, currentPlacedNodes)) {
                currentPlacedNodes.push(node);
                if (dfs(idx + 1, currentPlacedNodes, nodesToPlace)) return true;
                currentPlacedNodes.pop();
            }
        }
        return false;
    }

    let placedNodes = [];
    let packingSuccess = dfs(0, placedNodes, nodes);
    let droppedCount = 0;
    while (!packingSuccess && droppedCount < maxDropTries && nodes.length > 0) {
        nodes.pop(); // Drop the smallest remaining node
        droppedCount++;
        placedNodes = [];
        packingSuccess = dfs(0, placedNodes, nodes);
    }
    if (!packingSuccess) placedNodes = []; // Final attempt failed

    // Add zIndex for consistent rendering order if needed (smallest area at bottom, largest on top)
    placedNodes.forEach((d, i) => {
        d.zIndex = placedNodes.length - i; // Largest area gets largest zIndex
    });

    const nodeElements = mainChartGroup.selectAll("g.mark-group")
        .data(placedNodes, d => d.id)
        .join("g")
        .attr("class", "mark-group")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .sort((a, b) => a.zIndex - b.zIndex); // Render smaller zIndex (smaller area) first

    nodeElements.each(function(dNode) {
        const groupElement = d3.select(this);
        const side = 2 * dNode.r;
        const triangleHeight = side * Math.sqrt(3) / 2;
        
        const points = [
            [0, -triangleHeight * 2/3],
            [-side/2, triangleHeight * 1/3],
            [side/2, triangleHeight * 1/3]
        ];
        
        groupElement.append("path")
            .attr("class", "mark")
            .attr("d", d3.line()(points) + "Z") // Close the path
            .attr("fill", dNode.color)
            .attr("stroke", fillStyle.markStrokeColor)
            .attr("stroke-width", fillStyle.markStrokeWidth);

        // Text rendering logic
        const valText = `${dNode.val}${yFieldUnit}`;
        let catText = dNode.id.startsWith("__") ? "" : dNode.id;
        
        const adaptiveTextColor = getTextColorForBackground(dNode.color);

        const baseValueFontSize = parseFloat(fillStyle.typography.valueFontSize);
        const baseCategoryFontSize = parseFloat(fillStyle.typography.categoryFontSize);

        let currentFontSize = Math.max(
            8, // minAcceptableFontSize
            Math.min(
                side * 0.28, // fontSizeScaleFactor
                (baseValueFontSize + baseCategoryFontSize) / 2,
                24 // maxFontSize
            )
        );

        const minAcceptableFontSize = 8;
        const minSideForCategoryLabel = 20;
        const catLineHeightRatio = 0.3; // category label line height ratio
        const needsWrapping = true;
        const minCatFontSizeForWrapping = 10;

        let valueWidth = 0, categoryWidth = 0;
        let shouldWrapCategory = false;
        let categoryLines = 1;
        let categoryLineHeightPx = currentFontSize * (1 + catLineHeightRatio);
        let categoryLabelHeight = currentFontSize;
        let valueFits = false, categoryFits = false;
        
        let finalCategoryY = -triangleHeight / 6; // Initial estimate
        let finalValueY = triangleHeight / 6;     // Initial estimate

        while (currentFontSize >= minAcceptableFontSize) {
            valueWidth = estimateTextWidth(valText, fillStyle.typography.valueFontFamily, currentFontSize + "px", fillStyle.typography.valueFontWeight);
            categoryWidth = catText ? estimateTextWidth(catText, fillStyle.typography.categoryFontFamily, currentFontSize + "px", fillStyle.typography.categoryFontWeight) : 0;
            categoryLineHeightPx = currentFontSize * (1 + catLineHeightRatio);
            categoryLabelHeight = currentFontSize;
            categoryLines = 1;
            shouldWrapCategory = false;

            const categoryYDistanceFromTop = triangleHeight * 2/3 + finalCategoryY;
            const valueYDistanceFromTop = triangleHeight * 2/3 + finalValueY;
            
            let availableWidthForValue = getTriangleWidthAtHeight(side, triangleHeight, valueYDistanceFromTop) * 0.8;
            let availableWidthForCategory = catText ? getTriangleWidthAtHeight(side, triangleHeight, categoryYDistanceFromTop) * 0.8 : 0;
            
            valueFits = valueWidth <= availableWidthForValue;
            categoryFits = !catText || categoryWidth <= availableWidthForCategory;
            
            if (catText && !categoryFits && needsWrapping && currentFontSize >= minCatFontSizeForWrapping) {
                const words = catText.split(/\s+/);
                let linesArray = [];
                let currentLine = [];
                let fitsWithWrappingCheck = true;
                let tempCurrentLineY = finalCategoryY;

                const processLine = (textArray, isCharMode) => {
                    let currentLineText = "";
                    for (let k = 0; k < textArray.length; k++) {
                        const testSegment = isCharMode ? textArray[k] : (currentLine.length > 0 ? " " : "") + textArray[k];
                        const testLineContent = currentLineText + testSegment;
                        const tempCurrentLineYDistanceFromTop = triangleHeight * 2/3 + tempCurrentLineY;
                        const lineWidthAvailable = getTriangleWidthAtHeight(side, triangleHeight, tempCurrentLineYDistanceFromTop) * 0.8;

                        if (estimateTextWidth(testLineContent, fillStyle.typography.categoryFontFamily, currentFontSize + "px", fillStyle.typography.categoryFontWeight) <= lineWidthAvailable || currentLineText.length === 0) {
                            currentLineText += testSegment;
                            if (!isCharMode) currentLine.push(textArray[k]);
                        } else {
                            linesArray.push(currentLineText);
                            tempCurrentLineY += categoryLineHeightPx;
                            currentLineText = isCharMode ? textArray[k] : textArray[k];
                            if (!isCharMode) currentLine = [textArray[k]];
                            if (linesArray.length >= 5 || tempCurrentLineY + currentFontSize > triangleHeight / 2) {
                                fitsWithWrappingCheck = false; break;
                            }
                        }
                    }
                    if (fitsWithWrappingCheck && currentLineText) linesArray.push(currentLineText);
                };
                
                if (words.length <= 1) { // Character wrapping
                    processLine(catText.split(''), true);
                } else { // Word wrapping
                    let wordBuffer = [];
                    for(let k=0; k < words.length; k++){
                        wordBuffer.push(words[k]);
                        const testLineText = wordBuffer.join(" ");
                        const tempCurrentLineYDistanceFromTop = triangleHeight * 2/3 + tempCurrentLineY;
                        const lineWidthAvailable = getTriangleWidthAtHeight(side, triangleHeight, tempCurrentLineYDistanceFromTop) * 0.8;

                        if (estimateTextWidth(testLineText, fillStyle.typography.categoryFontFamily, currentFontSize + "px", fillStyle.typography.categoryFontWeight) > lineWidthAvailable && wordBuffer.length > 1) {
                            wordBuffer.pop();
                            linesArray.push(wordBuffer.join(" "));
                            tempCurrentLineY += categoryLineHeightPx;
                            wordBuffer = [words[k]];
                            if (linesArray.length >= 5 || tempCurrentLineY + currentFontSize > triangleHeight / 2) {
                                fitsWithWrappingCheck = false; break;
                            }
                        }
                    }
                    if (fitsWithWrappingCheck && wordBuffer.length > 0) linesArray.push(wordBuffer.join(" "));
                }

                 if (fitsWithWrappingCheck && linesArray.length > 0) {
                     categoryLines = linesArray.length;
                     categoryLabelHeight = categoryLines * currentFontSize + (categoryLines - 1) * (categoryLineHeightPx - currentFontSize);
                     categoryFits = true;
                     shouldWrapCategory = true;
                 } else {
                     categoryFits = false;
                     shouldWrapCategory = false;
                 }
             }
             
            if (valueFits && categoryFits) break;
            currentFontSize -= 1;
        }
         
        const finalFontSize = currentFontSize;
        const showValue = valueFits && finalFontSize >= minAcceptableFontSize;
        const showCategory = categoryFits && finalFontSize >= minAcceptableFontSize && side >= minSideForCategoryLabel && catText.length > 0;
         
        const labelSpacing = finalFontSize * 0.2;
        if (showValue && showCategory) {
            const totalHeightOfLabels = categoryLabelHeight + labelSpacing + finalFontSize;
            const blockCenterY = triangleHeight * 0.1; // Slightly below geometric center
            let categoryYOffset = (shouldWrapCategory && categoryLines > 1) ? -(categoryLines - 1) * finalFontSize * 0.8 - finalFontSize * 0.5 : 0;
            finalCategoryY = blockCenterY - totalHeightOfLabels / 2 + categoryYOffset - (finalFontSize * 0.3); // Adjusted offset
            finalValueY = finalCategoryY + categoryLabelHeight + labelSpacing + (finalFontSize * 0.3); // Adjusted offset
        } else if (showValue) {
            finalValueY = triangleHeight * 0.1 - finalFontSize / 2 + (finalFontSize * 0.3);
        } else if (showCategory) {
            let categoryYOffset = (shouldWrapCategory && categoryLines > 1) ? -(categoryLines - 1) * finalFontSize * 0.8 - finalFontSize * 0.5 : 0;
            finalCategoryY = triangleHeight * 0.1 - categoryLabelHeight / 2 + categoryYOffset - (finalFontSize * 0.3);
        }
         
        if (showValue) {
            groupElement.append("text")
                .attr("class", "label value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalValueY)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.valueFontWeight)
                .style("font-family", fillStyle.typography.valueFontFamily)
                .style("fill", adaptiveTextColor)
                .text(valText);
        }

        if (showCategory) {
            const categoryLabelElement = groupElement.append("text")
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
                let tspanLineNumber = 0;
                let tspan = categoryLabelElement.append("tspan").attr("x", 0).attr("dy", 0);
                
                const appendToTSpan = (textArray, isCharMode) => {
                    let currentLineText = "";
                    for (let k = 0; k < textArray.length; k++) {
                        const testSegment = isCharMode ? textArray[k] : (currentLineText.length > 0 ? " " : "") + textArray[k];
                        const tempLineContent = currentLineText + testSegment;
                        const currentLineYForWidthCalc = finalCategoryY + tspanLineNumber * categoryLineHeightPx;
                        const currentLineYDistanceFromTop = triangleHeight * 2/3 + currentLineYForWidthCalc;
                        const lineWidthAvailable = getTriangleWidthAtHeight(side, triangleHeight, currentLineYDistanceFromTop) * 0.8;

                        if (estimateTextWidth(tempLineContent, fillStyle.typography.categoryFontFamily, finalFontSize + "px", fillStyle.typography.categoryFontWeight) <= lineWidthAvailable || currentLineText.length === 0) {
                            currentLineText += testSegment;
                        } else {
                            tspan.text(currentLineText);
                            tspanLineNumber++;
                            currentLineText = isCharMode ? textArray[k] : textArray[k];
                            tspan = categoryLabelElement.append("tspan").attr("x", 0).attr("dy", `${1 + catLineHeightRatio}em`);
                        }
                    }
                    if (currentLineText) tspan.text(currentLineText);
                };

                if (words.length <= 1) { // Character wrapping
                    appendToTSpan(catText.split(''), true);
                } else { // Word wrapping
                    let wordBuffer = [];
                    for(let k=0; k < words.length; k++){
                        wordBuffer.push(words[k]);
                        const testLineText = wordBuffer.join(" ");
                        const currentLineYForWidthCalc = finalCategoryY + tspanLineNumber * categoryLineHeightPx;
                        const currentLineYDistanceFromTop = triangleHeight * 2/3 + currentLineYForWidthCalc;
                        const lineWidthAvailable = getTriangleWidthAtHeight(side, triangleHeight, currentLineYDistanceFromTop) * 0.8;

                        if (estimateTextWidth(testLineText, fillStyle.typography.categoryFontFamily, finalFontSize + "px", fillStyle.typography.categoryFontWeight) > lineWidthAvailable && wordBuffer.length > 1) {
                            wordBuffer.pop();
                            tspan.text(wordBuffer.join(" "));
                            tspanLineNumber++;
                            wordBuffer = [words[k]];
                            tspan = categoryLabelElement.append("tspan").attr("x", 0).attr("dy", `${1 + catLineHeightRatio}em`);
                        }
                    }
                    if (wordBuffer.length > 0) tspan.text(wordBuffer.join(" "));
                }
            } else {
                categoryLabelElement.text(catText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements like annotations or interactivity defined for this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}