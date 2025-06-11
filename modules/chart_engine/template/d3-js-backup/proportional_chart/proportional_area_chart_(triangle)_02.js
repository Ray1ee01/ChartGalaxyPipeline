/* REQUIREMENTS_BEGIN
{
  "chart_type": "Packed Triangle Chart",
  "chart_name": "proportional_area_chart_triangle_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
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
    const chartRawData = data.data?.data || [];
    const dataColumns = data.data?.columns || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or data.colors_dark for dark
    const images = data.images || {};

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldDef = dataColumns.find(col => col.role === "x");
    const yFieldDef = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xFieldDef?.name;
    const valueFieldName = yFieldDef?.name;
    const valueFieldUnit = yFieldDef && yFieldDef.unit !== "none" ? yFieldDef.unit || "" : "";

    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: categoryFieldName or valueFieldName. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Critical chart configuration missing: Required field roles (x, y) not found in data columns.</div>");
        return null;
    }

    const chartDataArray = chartRawData.filter(d => d[valueFieldName] != null && +d[valueFieldName] > 0);

    if (!chartDataArray.length) {
        d3.select(containerSelector).html("<div style='font-family: sans-serif;'>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        colors: {},
        images: {},
        typography: {}
    };

    // Typography
    fillStyle.typography.value = {
        fontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
        fontSize: parseFloat(typography.annotation?.font_size || '12px'),
        fontWeight: typography.annotation?.font_weight || 'bold'
    };
    fillStyle.typography.category = {
        fontFamily: typography.label?.font_family || 'Arial, sans-serif',
        fontSize: parseFloat(typography.label?.font_size || '11px'),
        fontWeight: typography.label?.font_weight || 'normal'
    };
    
    // Colors
    fillStyle.colors.defaultText = colors.text_color || '#FFFFFF'; // Default for internal labels if not adaptive
    fillStyle.colors.externalLabelText = '#000000'; // External labels always black on light background
    fillStyle.colors.itemStroke = '#FFFFFF';
    fillStyle.colors.connectorLine = '#666666';
    fillStyle.colors.externalLabelBackground = 'rgba(255, 255, 255, 0.8)';
    fillStyle.colors.externalLabelStroke = '#CCCCCC';
    fillStyle.colors.internalLabelBackground = 'rgba(255, 255, 255, 0.7)'; // For optional backgrounds on internal labels

    fillStyle.colors.getItemColor = (itemCategory, index) => {
        if (colors.field && colors.field[itemCategory]) {
            return colors.field[itemCategory];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[index % colors.available_colors.length];
        }
        return d3.schemeTableau10[index % 10]; // Default categorical scheme
    };
    
    function getColorBrightness(colorStr) {
        if (!colorStr) return 0.5; // Default for invalid color
        let r, g, b;
        if (colorStr.startsWith('rgba')) {
            const match = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
            if (!match) return 0.5;
            [r, g, b] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
        } else if (colorStr.startsWith('rgb')) {
            const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (!match) return 0.5;
            [r, g, b] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
        } else if (colorStr.startsWith('#')) {
            let hex = colorStr.substring(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            if (hex.length !== 6) return 0.5;
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else {
            return 0.5; // Unknown format
        }
        return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    }

    fillStyle.colors.getAdaptiveTextColor = (backgroundColor) => {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? '#000000' : '#FFFFFF';
    };

    // Images
    fillStyle.images.getIconUrl = (itemCategory) => {
        if (images.field && images.field[itemCategory]) {
            return images.field[itemCategory];
        }
        if (images.other && images.other.primary) { // Fallback to a generic primary icon if specified
            return images.other.primary;
        }
        return null;
    };
    
    // Text measurement utility
    function estimateTextWidth(text, fontFamily, fontSizeStr, fontWeight) {
        if (!text || !fontFamily || !fontSizeStr) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // Position off-screen to avoid brief flicker if appended, though not appending here.
        // tempSvg.style.position = 'absolute'; tempSvg.style.visibility = 'hidden'; tempSvg.style.left = '-9999px';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSizeStr);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Appending to body temporarily for getBBox is more reliable but against constraints.
        // document.body.appendChild(tempSvg); 
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            // console.warn("estimateTextWidth failed using unattached SVG for text:", text, e);
            // Fallback: crude estimation if getBBox fails without DOM attachment
            const fontSizeNum = parseFloat(fontSizeStr);
            width = text.length * fontSizeNum * 0.6; // Very rough fallback
        }
        // document.body.removeChild(tempSvg);
        return width;
    }

    // Triangle geometry helper
    function getTriangleWidthAtHeight(side, totalHeight, distanceFromTop) {
        if (distanceFromTop < 0 || distanceFromTop > totalHeight) return 0;
        const baseWidth = side;
        const widthRatio = distanceFromTop / totalHeight;
        return baseWidth * widthRatio;
    }

    // Category label rendering helper (adapted from original)
    const categoryLabelLineHeightRatio = 0.3; // Original catLineHeight
    function renderMultiLineCategoryLabel(
        textGroup, textContent, initialY, shouldWrap,
        triangleSide, triangleTotalHeight,
        fontFamily, fontWeight, fontSizeNum, textColor
    ) {
        const textElement = textGroup.append("text")
            .attr("class", "label category-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("y", initialY)
            .style("fill", textColor)
            .style("font-family", fontFamily)
            .style("font-weight", fontWeight)
            .style("font-size", `${fontSizeNum}px`)
            .style("pointer-events", "none");

        if (shouldWrap && textContent) {
            const words = textContent.split(/\s+/);
            let lineNumber = 0;
            let tspan = textElement.append("tspan").attr("x", 0).attr("dy", 0);
            const fontSizeStr = `${fontSizeNum}px`;

            if (words.length <= 1 && textContent.length > 1) { // Single word or no spaces, try char wrapping
                const chars = textContent.split('');
                let currentLine = '';
                for (let i = 0; i < chars.length; i++) {
                    const testLine = currentLine + chars[i];
                    const lineY = initialY + lineNumber * (fontSizeNum * (1 + categoryLabelLineHeightRatio));
                    const distFromTop = triangleTotalHeight * 2/3 + lineY; // Assuming centroid origin for triangle
                    const availableWidth = getTriangleWidthAtHeight(triangleSide, triangleTotalHeight, distFromTop) * 0.9;
                    
                    if (estimateTextWidth(testLine, fontFamily, fontSizeStr, fontWeight) <= availableWidth || currentLine === '') {
                        currentLine += chars[i];
                    } else {
                        tspan.text(currentLine);
                        lineNumber++;
                        currentLine = chars[i];
                        tspan = textElement.append("tspan").attr("x", 0).attr("dy", `${1 + categoryLabelLineHeightRatio}em`);
                    }
                }
                if (currentLine) tspan.text(currentLine);
            } else { // Word wrapping
                let line = [];
                for (const word of words) {
                    const testLine = [...line, word].join(' ');
                    const lineY = initialY + lineNumber * (fontSizeNum * (1 + categoryLabelLineHeightRatio));
                    const distFromTop = triangleTotalHeight * 2/3 + lineY;
                    const availableWidth = getTriangleWidthAtHeight(triangleSide, triangleTotalHeight, distFromTop) * 0.9;

                    if (estimateTextWidth(testLine, fontFamily, fontSizeStr, fontWeight) <= availableWidth || line.length === 0) {
                        line.push(word);
                        tspan.text(line.join(' '));
                    } else {
                        lineNumber++;
                        line = [word];
                        tspan = textElement.append("tspan").attr("x", 0).attr("dy", `${1 + categoryLabelLineHeightRatio}em`).text(word);
                    }
                }
            }
        } else {
            textElement.text(textContent);
        }
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("class", "chart-svg proportional-area-chart-triangle")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Adjusted margins, original was quite large

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Force simulation parameters
    const forceSimulationSteps = 300;
    const forceCollideStrength = 0.8;
    const forceCenterStrength = 0.1;
    const forceCollideRadiusPadding = 8;

    // Radius and size limits
    const minRadius = 25; // Half side-length for smallest triangle
    const maxRadius = Math.min(innerWidth, innerHeight) / 4; // Adjusted maxRadius based on drawing area
    const minSideForInnerLabel = 70; // Triangle side length threshold for internal labels

    // Icon parameters
    const iconSizeRatio = 0.35;
    const minIconSize = 24; // Adjusted from 32
    const maxIconSize = 50; // Adjusted from 60

    // Text parameters
    const minAcceptableFontSize = 8;
    const fontSizeScaleFactor = 0.2;
    const maxFontSize = 16;
    // const minCatFontSize = 10; // For category label wrapping logic, handled by minAcceptableFontSize
    const needsWrapping = true; // Always allow wrapping if needed

    // Block 5: Data Preprocessing & Transformation
    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]);
    const minValue = d3.min(chartDataArray, d => +d[valueFieldName]);
    
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([minRadius, maxRadius]);

    const nodesData = chartDataArray.map((d, i) => ({
        id: d[categoryFieldName] != null ? String(d[categoryFieldName]) : `__${i}__`,
        val: +d[valueFieldName],
        r: radiusScale(+d[valueFieldName]), // r is half-side length
        color: fillStyle.colors.getItemColor(String(d[categoryFieldName]), i),
        icon: fillStyle.images.getIconUrl(String(d[categoryFieldName])),
        raw: d,
        x: innerWidth * Math.random(),
        y: innerHeight * Math.random()
    })).sort((a, b) => b.r - a.r); // Sort by radius (desc) for z-index effect and simulation stability

    nodesData.forEach((d, i) => {
        d.zIndex = nodesData.length - i; // Smaller r (later in sorted list) = higher zIndex
    });

    const simulation = d3.forceSimulation(nodesData)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(forceCenterStrength))
        .force("collide", d3.forceCollide(d => {
            const baseRadius = d.r + forceCollideRadiusPadding; // d.r is half side-length
            // If side (2*d.r) < minSideForInnerLabel, it will likely use external labels, needs more collision space
            return (2 * d.r < minSideForInnerLabel) ? baseRadius * 1.8 : baseRadius * 1.1; // Adjusted multipliers
        }).strength(forceCollideStrength))
        .force("x", d3.forceX(innerWidth / 2).strength(0.05))
        .force("y", d3.forceY(innerHeight / 2).strength(0.05))
        .stop();

    for (let i = 0; i < forceSimulationSteps; ++i) {
        simulation.tick();
    }

    nodesData.forEach(d => {
        const side = 2 * d.r;
        // Margin padding to keep elements (especially with external labels) within bounds
        const boundaryPadding = (side < minSideForInnerLabel) ? d.r * 1.5 : d.r; // d.r is half-side
        d.x = Math.max(boundaryPadding, Math.min(innerWidth - boundaryPadding, d.x));
        d.y = Math.max(boundaryPadding, Math.min(innerHeight - boundaryPadding, d.y));
    });

    // Block 6: Scale Definition & Configuration
    // radiusScale is defined in Block 5. No other primary scales for this chart type.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering
    const nodeGroups = mainChartGroup.selectAll("g.node")
        .data(nodesData, d => d.id)
        .join("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .sort((a, b) => a.zIndex - b.zIndex); // Draw smaller items (higher zIndex) on top

    nodeGroups.each(function(dNodeData) {
        const groupElement = d3.select(this);
        const side = 2 * dNodeData.r; // Triangle side length
        const triangleHeight = side * Math.sqrt(3) / 2;
        const valueText = `${dNodeData.val}${valueFieldUnit}`;
        let categoryText = dNodeData.id.startsWith("__") ? "" : dNodeData.id;
        if (!categoryText && variables.showFallbackId !== false) categoryText = dNodeData.id; // Show ID if category is empty

        const hasIcon = dNodeData.icon != null;
        const adaptiveTextColor = fillStyle.colors.getAdaptiveTextColor(dNodeData.color);

        // Render triangle
        groupElement.append("path")
            .attr("class", "mark triangle-path")
            .attr("d", d3.line()([
                [0, -triangleHeight * 2/3],       // Top vertex
                [-side/2, triangleHeight * 1/3],  // Bottom-left vertex
                [side/2, triangleHeight * 1/3]    // Bottom-right vertex
            ]))
            .attr("fill", dNodeData.color)
            .attr("stroke", fillStyle.colors.itemStroke)
            .attr("stroke-width", 1.0);

        const useExternalLabel = side < minSideForInnerLabel;

        if (useExternalLabel) {
            // External labels
            if (hasIcon && side >= 20) { // Small icon inside if space permits
                const smallIconSize = Math.max(minIconSize * 0.75, Math.min(side * 0.6, minIconSize));
                groupElement.append("image")
                    .attr("class", "icon item-icon")
                    .attr("xlink:href", dNodeData.icon)
                    .attr("width", smallIconSize)
                    .attr("height", smallIconSize)
                    .attr("x", -smallIconSize / 2)
                    .attr("y", -smallIconSize / 2) // Centered roughly
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }

            const externalLabelFontSize = Math.min(fillStyle.typography.category.fontSize, Math.max(minAcceptableFontSize, side / 6));
            const labelYOffset = triangleHeight * 1/3 + 8; // Below triangle base

            groupElement.append("line")
                .attr("class", "other connector-line")
                .attr("x1", 0)
                .attr("y1", triangleHeight * 1/3) // From triangle centroid's projection on base
                .attr("x2", 0)
                .attr("y2", labelYOffset - 2)
                .attr("stroke", fillStyle.colors.connectorLine)
                .attr("stroke-width", 0.8);
            
            const catWidth = categoryText ? estimateTextWidth(categoryText, fillStyle.typography.category.fontFamily, `${externalLabelFontSize}px`, fillStyle.typography.category.fontWeight) : 0;
            const valWidth = estimateTextWidth(valueText, fillStyle.typography.value.fontFamily, `${externalLabelFontSize}px`, fillStyle.typography.value.fontWeight);
            const maxWidthForLabel = Math.max(catWidth, valWidth);
            const totalLabelHeight = (categoryText ? externalLabelFontSize : 0) + externalLabelFontSize + (categoryText ? 6 : 4); // Two lines + padding

            groupElement.append("rect")
                .attr("class", "other external-label-background")
                .attr("x", -maxWidthForLabel / 2 - 5)
                .attr("y", labelYOffset - 2)
                .attr("width", maxWidthForLabel + 10)
                .attr("height", totalLabelHeight)
                .attr("rx", 3)
                .attr("ry", 3)
                .attr("fill", fillStyle.colors.externalLabelBackground)
                .attr("stroke", fillStyle.colors.externalLabelStroke)
                .attr("stroke-width", 0.5);

            let currentTextY = labelYOffset;
            if (categoryText) {
                groupElement.append("text")
                    .attr("class", "label category-label external-category-label")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .attr("y", currentTextY)
                    .style("font-family", fillStyle.typography.category.fontFamily)
                    .style("font-weight", fillStyle.typography.category.fontWeight)
                    .style("font-size", `${externalLabelFontSize}px`)
                    .style("fill", fillStyle.colors.externalLabelText)
                    .text(categoryText);
                currentTextY += externalLabelFontSize + 2;
            }

            groupElement.append("text")
                .attr("class", "value value-label external-value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", currentTextY)
                .style("font-family", fillStyle.typography.value.fontFamily)
                .style("font-weight", fillStyle.typography.value.fontWeight)
                .style("font-size", `${externalLabelFontSize}px`)
                .style("fill", fillStyle.colors.externalLabelText)
                .text(valueText);

        } else { // Internal labels
            // Simplified internal layout from original's complex logic
            // Try to fit icon, then category, then value, vertically centered.
            
            let currentY = -triangleHeight * 0.45; // Start near top of triangle's vertical center third
            const paddingBetweenElements = triangleHeight * 0.05;
            
            let effectiveIconSize = 0;
            if (hasIcon) {
                effectiveIconSize = Math.max(minIconSize, Math.min(maxIconSize, side * iconSizeRatio));
                const iconYPos = currentY;
                const iconAvailableWidth = getTriangleWidthAtHeight(side, triangleHeight, (triangleHeight*2/3) + iconYPos + effectiveIconSize/2) * 0.8;
                if (effectiveIconSize > iconAvailableWidth) effectiveIconSize = Math.max(minIconSize, iconAvailableWidth);

                if (effectiveIconSize >= minIconSize) {
                     groupElement.append("image")
                        .attr("class", "icon item-icon")
                        .attr("xlink:href", dNodeData.icon)
                        .attr("width", effectiveIconSize)
                        .attr("height", effectiveIconSize)
                        .attr("x", -effectiveIconSize / 2)
                        .attr("y", iconYPos)
                        .attr("preserveAspectRatio", "xMidYMid meet");
                    currentY += effectiveIconSize + paddingBetweenElements;
                } else {
                    effectiveIconSize = 0; // Icon too small to show
                }
            }

            // Determine font size for internal labels
            let internalFontSize = Math.min(
                maxFontSize, 
                fillStyle.typography.category.fontSize, // Base on category font size
                Math.max(minAcceptableFontSize, side * fontSizeScaleFactor)
            );
            
            // Category Label
            if (categoryText) {
                const catYPos = currentY;
                const catAvailableWidth = getTriangleWidthAtHeight(side, triangleHeight, (triangleHeight*2/3) + catYPos + internalFontSize/2) * 0.85;
                let catActualWidth = estimateTextWidth(categoryText, fillStyle.typography.category.fontFamily, `${internalFontSize}px`, fillStyle.typography.category.fontWeight);
                
                let canShowCategory = catActualWidth <= catAvailableWidth;
                let categoryLines = 1;
                let catLabelHeight = internalFontSize;

                if (!canShowCategory && needsWrapping && internalFontSize >= minAcceptableFontSize * 1.1) { // Try wrapping
                    // Simplified wrap check: assume 2 lines max, check if half width fits
                    // This is a simplification of the original complex wrapping logic for brevity
                    const halfWidth = estimateTextWidth(categoryText.substring(0, Math.ceil(categoryText.length / 2)) + "...", fillStyle.typography.category.fontFamily, `${internalFontSize}px`, fillStyle.typography.category.fontWeight);
                    if (halfWidth <= catAvailableWidth) {
                        canShowCategory = true;
                        categoryLines = 2; // Max 2 lines for internal
                        catLabelHeight = internalFontSize * (1 + categoryLabelLineHeightRatio) * 2 - (internalFontSize * categoryLabelLineHeightRatio);
                    }
                }
                
                if (canShowCategory) {
                     renderMultiLineCategoryLabel(groupElement, categoryText, catYPos, categoryLines > 1,
                        side, triangleHeight,
                        fillStyle.typography.category.fontFamily, fillStyle.typography.category.fontWeight,
                        internalFontSize, adaptiveTextColor);
                    currentY += catLabelHeight + paddingBetweenElements;
                }
            }

            // Value Label
            const valYPos = currentY;
            const valAvailableWidth = getTriangleWidthAtHeight(side, triangleHeight, (triangleHeight*2/3) + valYPos + internalFontSize/2) * 0.9;
            let valActualWidth = estimateTextWidth(valueText, fillStyle.typography.value.fontFamily, `${internalFontSize}px`, fillStyle.typography.value.fontWeight);

            if (valActualWidth > valAvailableWidth) { // Shrink font if too wide
                const ratio = valAvailableWidth / valActualWidth;
                internalFontSize = Math.max(minAcceptableFontSize, internalFontSize * ratio * 0.95); // Apply ratio and a bit more reduction
                valActualWidth = estimateTextWidth(valueText, fillStyle.typography.value.fontFamily, `${internalFontSize}px`, fillStyle.typography.value.fontWeight);
            }
            
            if (valActualWidth <= valAvailableWidth && internalFontSize >= minAcceptableFontSize) {
                 // Optional: Add background for readability if contrast is low or text is cramped
                if (valActualWidth > valAvailableWidth * 0.8) { 
                    groupElement.append("rect")
                        .attr("class", "other internal-label-background")
                        .attr("x", -valActualWidth / 2 - 2)
                        .attr("y", valYPos - 1)
                        .attr("width", valActualWidth + 4)
                        .attr("height", internalFontSize + 2)
                        .attr("rx", 2).attr("ry", 2)
                        .attr("fill", fillStyle.colors.internalLabelBackground)
                        .style("opacity", 0.7);
                }
                groupElement.append("text")
                    .attr("class", "value value-label internal-value-label")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .attr("y", valYPos)
                    .style("font-family", fillStyle.typography.value.fontFamily)
                    .style("font-weight", fillStyle.typography.value.fontWeight)
                    .style("font-size", `${internalFontSize}px`)
                    .style("fill", adaptiveTextColor)
                    .text(valueText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this refactoring beyond core rendering.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}