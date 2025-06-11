/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle)",
  "chart_name": "proportional_area_chart_circle_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
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
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    d3.select(containerSelector).html(""); // Clear the container

    const rawData = data.data || {};
    let chartDataArray = rawData.data || [];
    const dataColumns = rawData.columns || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming light/dark theme parity for this refactor
    const images = data.images || {};

    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;
    const valueFieldUnit = (dataColumns.find(col => col.role === "y") || {}).unit;
    const yUnit = valueFieldUnit === "none" || !valueFieldUnit ? "" : valueFieldUnit;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [
            !categoryFieldName ? "x role field" : null,
            !valueFieldName ? "y role field" : null,
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    chartDataArray = chartDataArray.filter(d => d[valueFieldName] != null && +d[valueFieldName] > 0);

    if (!chartDataArray.length) {
        d3.select(containerSelector).html("<div>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        text: {},
        typography: {},
        circle: { category: {} }
    };

    // Typography
    fillStyle.typography.valueLabelFontFamily = (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif';
    fillStyle.typography.valueLabelFontSizeBase = parseFloat((typography.annotation && typography.annotation.font_size) || '12px');
    fillStyle.typography.valueLabelFontWeight = (typography.annotation && typography.annotation.font_weight) || 'bold';

    fillStyle.typography.categoryLabelFontFamily = (typography.label && typography.label.font_family) || 'Arial, sans-serif';
    fillStyle.typography.categoryLabelFontSizeBase = parseFloat((typography.label && typography.label.font_size) || '11px');
    fillStyle.typography.categoryLabelFontWeight = (typography.label && typography.label.font_weight) || 'normal';
    
    // Colors
    fillStyle.text.primary = colors.text_color || '#000000';
    fillStyle.chartBackground = colors.background_color || '#FFFFFF'; // Defined but not necessarily applied if "background:no"

    const uniqueCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    const defaultColorPalette = d3.schemeCategory10;

    uniqueCategories.forEach((cat, i) => {
        if (colors.field && colors.field[cat]) {
            fillStyle.circle.category[cat] = colors.field[cat];
        } else if (colors.available_colors && colors.available_colors.length > 0) {
            fillStyle.circle.category[cat] = colors.available_colors[i % colors.available_colors.length];
        } else {
            fillStyle.circle.category[cat] = defaultColorPalette[i % defaultColorPalette.length];
        }
    });
    fillStyle.circle.default = (colors.other && colors.other.primary) || defaultColorPalette[0];

    // Images (URLs)
    fillStyle.icons = {};
    uniqueCategories.forEach(cat => {
        if (images.field && images.field[cat]) {
            fillStyle.icons[cat] = images.field[cat];
        }
    });
    fillStyle.icons.default = (images.other && images.other.primary) || null;


    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // Position off-screen
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.left = '-9999px';
        tempSvg.style.top = '-9999px';

        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize); // fontSize should be a string like '12px'
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        
        tempSvg.appendChild(tempText);
        document.body.appendChild(tempSvg); // Append to DOM for getBBox to work reliably
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg); // Clean up
        return width;
    }

    function getChordLength(radius, distanceFromCenterY) {
        return 2 * Math.sqrt(Math.max(0, radius * radius - distanceFromCenterY * distanceFromCenterY));
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .attr("class", "chart-svg-root");
        // No viewBox, no preserveAspectRatio, no % widths/heights

    const chartMargins = { top: 90, right: 20, bottom: 60, left: 20 }; // Original margins

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const maxTotalCircleArea = innerWidth * innerHeight * 0.5;
    const minRadius = 5;
    const maxRadius = innerHeight / 3;
    const TOP_PROTECTED_AREA = 30; // Original value, provides some top clearance in force layout

    // Block 5: Data Preprocessing & Transformation
    const initialRadiusScale = d3.scaleSqrt()
        .domain([0, d3.max(chartDataArray, d => +d[valueFieldName])])
        .range([minRadius, maxRadius * 0.8]); // *0.8 to leave room for adjustment

    let nodes = chartDataArray.map((d, i) => {
        const value = +d[valueFieldName];
        const category = d[categoryFieldName];
        const radius = initialRadiusScale(value);
        return {
            id: category != null ? String(category) : `__node_${i}__`, // Ensure ID is string
            value: value,
            radius: radius,
            area: Math.PI * radius * radius,
            color: fillStyle.circle.category[category] || fillStyle.circle.default,
            iconUrl: fillStyle.icons[category] || null,
            categoryName: category,
            rawDataPoint: d
        };
    }).sort((a, b) => b.radius - a.radius);

    const initialTotalArea = d3.sum(nodes, d => d.area);
    if (initialTotalArea > maxTotalCircleArea && initialTotalArea > 0) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodes.forEach(node => {
            node.radius *= areaRatio;
            node.area = Math.PI * node.radius * node.radius;
        });
    }
    
    // Ensure radii are not smaller than minRadius after scaling
    nodes.forEach(node => {
        node.radius = Math.max(node.radius, minRadius);
        node.area = Math.PI * node.radius * node.radius;
    });


    // Block 6: Scale Definition & Configuration
    // `initialRadiusScale` already defined and used. `colorScale` effectively handled by `fillStyle`.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart.

    // Block 8: Main Data Visualization Rendering
    const simulation = d3.forceSimulation()
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.05))
        .force("charge", d3.forceManyBody().strength(-10))
        .force("collide", d3.forceCollide().radius(d => d.radius - 2).strength(0.9)) // Slightly less overlap than original
        .stop();

    if (nodes.length > 0) {
        nodes[0].fx = innerWidth / 2;
        nodes[0].fy = innerHeight / 2;
    }
    if (nodes.length > 1) {
        const angleStep = 2 * Math.PI / (nodes.length - 1);
        let radiusStep = Math.min(innerWidth, innerHeight) * 0.15;
        let currentSpiralRadius = radiusStep;
        for (let i = 1; i < nodes.length; i++) {
            const angle = i * angleStep;
            nodes[i].x = innerWidth / 2 + currentSpiralRadius * Math.cos(angle);
            nodes[i].y = innerHeight / 2 + currentSpiralRadius * Math.sin(angle);
            if (i % 5 === 0) currentSpiralRadius += radiusStep;
        }
    }

    simulation.nodes(nodes);
    const numIterations = 200;
    for (let i = 0; i < numIterations; ++i) {
        simulation.tick();
        nodes.forEach(d => {
            if (!d.fx) { // If node is not fixed
                d.x = Math.max(d.radius, Math.min(innerWidth - d.radius, d.x));
                d.y = Math.max(TOP_PROTECTED_AREA + d.radius, Math.min(innerHeight - d.radius, d.y));
            }
        });
    }

    const nodeGroups = mainChartGroup.selectAll("g.node-group")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", "node-group") // Changed class from "node" to "node-group" for clarity
        .attr("transform", d => `translate(${d.x},${d.y})`);

    nodeGroups.append("circle")
        .attr("class", "mark")
        .attr("r", d => d.radius)
        .attr("fill", d => d.color)
        .attr("stroke", "none");

    // Text and icon parameters (original logic adapted)
    const iconSizeRatio = 0.6;
    const minIconSize = 16;
    const maxIconSize = 120;
    const fontSizeScaleFactor = 0.35;
    const minFontSize = 8;
    const maxFontSize = 22;
    const minRadiusForTextDisplay = 10;
    const categoryLabelLineHeightFactor = 0.3; // Original: catLineHeight

    nodeGroups.each(function(dNode) {
        const groupElement = d3.select(this);
        const currentRadius = dNode.radius;

        if (currentRadius < minRadiusForTextDisplay) {
            if (dNode.iconUrl) {
                const iconSize = Math.min(currentRadius * 1.5, minIconSize * 1.2);
                groupElement.append("image")
                    .attr("class", "icon")
                    .attr("xlink:href", dNode.iconUrl)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("x", -iconSize / 2)
                    .attr("y", -iconSize / 2)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
            return;
        }

        const valueTextContent = `${dNode.value}${yUnit}`;
        let categoryTextContent = dNode.id.startsWith("__node_") ? "" : dNode.categoryName; // Use categoryName for actual text

        const topPaddingForIcon = currentRadius * 0.2;
        const idealIconSize = Math.min(currentRadius, maxIconSize);
        
        const iconTopY = -currentRadius + topPaddingForIcon;
        const iconMaxWidthAtItsY = getChordLength(currentRadius, Math.abs(iconTopY + idealIconSize / 2));
        const actualIconSize = Math.min(idealIconSize, iconMaxWidthAtItsY);

        const iconBottomY = iconTopY + actualIconSize;
        const textAreaStartY = iconBottomY + currentRadius * 0.05;
        const textAreaEndY = currentRadius * 0.9;
        const textAreaHeight = Math.max(0, textAreaEndY - textAreaStartY);

        const idealCombinedFontSize = Math.max(
            minFontSize,
            Math.min(
                currentRadius * fontSizeScaleFactor,
                (fillStyle.typography.valueLabelFontSizeBase + fillStyle.typography.categoryLabelFontSizeBase) / 2,
                maxFontSize,
                textAreaHeight / (categoryTextContent ? 3 : 1.5) 
            )
        );
        
        let currentFontSize = idealCombinedFontSize;
        const textSpacingFactor = 0.3; // Spacing relative to font size

        // Calculate widths and potentially reduce font size
        let valueTextWidth = estimateTextWidth(valueTextContent, fillStyle.typography.valueLabelFontFamily, `${currentFontSize}px`, fillStyle.typography.valueLabelFontWeight);
        let categoryTextWidth = categoryTextContent ? estimateTextWidth(categoryTextContent, fillStyle.typography.categoryLabelFontFamily, `${currentFontSize}px`, fillStyle.typography.categoryLabelFontWeight) : 0;
        
        const categoryTextY = categoryTextContent ? textAreaStartY : 0; // Tentative Y
        const categoryMaxWidthAtItsY = categoryTextContent ? getChordLength(currentRadius, Math.abs(categoryTextY + currentFontSize / 2)) * 0.85 : 0;

        const valueTextTentativeY = categoryTextContent ? 
            (categoryTextY + currentFontSize + (currentFontSize * textSpacingFactor)) : 
            (textAreaStartY + textAreaHeight * 0.5 - currentFontSize / 2);
        const valueMaxWidthAtItsY = getChordLength(currentRadius, Math.abs(valueTextTentativeY + currentFontSize / 2)) * 0.85;

        const valueRatio = valueTextWidth / valueMaxWidthAtItsY;
        const categoryRatio = categoryTextContent ? categoryTextWidth / categoryMaxWidthAtItsY : 0;
        const maxOverflowRatio = Math.max(1, valueRatio, categoryRatio);

        if (maxOverflowRatio > 1) {
            currentFontSize = Math.max(minFontSize, currentFontSize / maxOverflowRatio);
            // Recalculate widths with new font size
            valueTextWidth = estimateTextWidth(valueTextContent, fillStyle.typography.valueLabelFontFamily, `${currentFontSize}px`, fillStyle.typography.valueLabelFontWeight);
            categoryTextWidth = categoryTextContent ? estimateTextWidth(categoryTextContent, fillStyle.typography.categoryLabelFontFamily, `${currentFontSize}px`, fillStyle.typography.categoryLabelFontWeight) : 0;
        }
        
        let categoryLines = 1;
        let categoryLabelHeight = currentFontSize;
        let shouldWrapCategory = false;
        const finalCategoryMaxWidth = categoryTextContent ? getChordLength(currentRadius, Math.abs(categoryTextY + (categoryLines * currentFontSize * (1 + categoryLabelLineHeightFactor) - currentFontSize) / 2)) * 0.85 : 0;


        if (categoryTextContent && categoryTextWidth > finalCategoryMaxWidth) {
            shouldWrapCategory = true; // Assume wrapping is needed
            const words = categoryTextContent.split(/\s+/);
            let linesArray = [];
            
            if (words.length <= 1) { // Character-based wrapping
                const chars = categoryTextContent.split('');
                let currentLine = '';
                for (let k = 0; k < chars.length; k++) {
                    const testLine = currentLine + chars[k];
                    if (estimateTextWidth(testLine, fillStyle.typography.categoryLabelFontFamily, `${currentFontSize}px`, fillStyle.typography.categoryLabelFontWeight) <= finalCategoryMaxWidth || currentLine.length === 0) {
                        currentLine += chars[k];
                    } else {
                        linesArray.push(currentLine);
                        currentLine = chars[k];
                    }
                }
                linesArray.push(currentLine);
            } else { // Word-based wrapping
                let line = [];
                let word;
                while ((word = words.shift())) {
                    line.push(word);
                    const testLine = line.join(" ");
                    if (estimateTextWidth(testLine, fillStyle.typography.categoryLabelFontFamily, `${currentFontSize}px`, fillStyle.typography.categoryLabelFontWeight) > finalCategoryMaxWidth && line.length > 1) {
                        line.pop();
                        linesArray.push(line.join(" "));
                        line = [word];
                    }
                }
                linesArray.push(line.join(" "));
            }
            categoryLines = Math.max(1, linesArray.length);
            categoryLabelHeight = categoryLines * currentFontSize * (1 + categoryLabelLineHeightFactor) - (currentFontSize * categoryLabelLineHeightFactor); // More precise height
        }
        
        const finalCategoryTextY = categoryTextContent ? textAreaStartY : 0;
        const finalValueTextY = categoryTextContent ?
            (finalCategoryTextY + categoryLabelHeight + (currentFontSize * textSpacingFactor)) :
            (textAreaStartY + textAreaHeight / 2 - currentFontSize / 2); // Center vertically if no category

        // Render Icon
        if (dNode.iconUrl) {
            groupElement.append("image")
                .attr("class", "icon")
                .attr("xlink:href", dNode.iconUrl)
                .attr("width", actualIconSize)
                .attr("height", actualIconSize)
                .attr("x", -actualIconSize / 2)
                .attr("y", iconTopY)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

        // Render Category Label
        if (categoryTextContent) {
            const categoryLabelElement = groupElement.append("text")
                .attr("class", "label category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging") // Aligns top of text to y
                .attr("y", finalCategoryTextY)
                .style("fill", fillStyle.text.primary)
                .style("font-family", fillStyle.typography.categoryLabelFontFamily)
                .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
                .style("font-size", `${currentFontSize}px`)
                .style("pointer-events", "none");

            if (shouldWrapCategory) {
                // Re-run wrapping logic to generate tspans
                const words = categoryTextContent.split(/\s+/);
                let line = [];
                let tspan = categoryLabelElement.append("tspan").attr("x", 0).attr("dy", 0);
                
                if (words.length <= 1) { // Character-based
                    const chars = categoryTextContent.split('');
                    let currentLine = '';
                    for (let k = 0; k < chars.length; k++) {
                        const testLine = currentLine + chars[k];
                        if (estimateTextWidth(testLine, fillStyle.typography.categoryLabelFontFamily, `${currentFontSize}px`, fillStyle.typography.categoryLabelFontWeight) <= finalCategoryMaxWidth || currentLine.length === 0) {
                            currentLine += chars[k];
                        } else {
                            tspan.text(currentLine);
                            currentLine = chars[k];
                            tspan = categoryLabelElement.append("tspan")
                                .attr("x", 0)
                                .attr("dy", `${1 + categoryLabelLineHeightFactor}em`)
                                .text(currentLine);
                        }
                    }
                    tspan.text(currentLine);
                } else { // Word-based
                    let word;
                    while ((word = words.shift())) {
                        line.push(word);
                        const testLine = line.join(" ");
                        if (estimateTextWidth(testLine, fillStyle.typography.categoryLabelFontFamily, `${currentFontSize}px`, fillStyle.typography.categoryLabelFontWeight) > finalCategoryMaxWidth && line.length > 1) {
                            line.pop();
                            tspan.text(line.join(" "));
                            line = [word];
                            tspan = categoryLabelElement.append("tspan")
                                .attr("x", 0)
                                .attr("dy", `${1 + categoryLabelLineHeightFactor}em`)
                                .text(word);
                        } else {
                            tspan.text(line.join(" "));
                        }
                    }
                }
            } else {
                categoryLabelElement.text(categoryTextContent);
            }
        }

        // Render Value Label
        groupElement.append("text")
            .attr("class", "label value-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging") // Aligns top of text to y
            .attr("y", finalValueTextY)
            .style("font-size", `${currentFontSize}px`)
            .style("font-weight", fillStyle.typography.valueLabelFontWeight)
            .style("font-family", fillStyle.typography.valueLabelFontFamily)
            .style("fill", fillStyle.text.primary)
            .style("pointer-events", "none")
            .text(valueTextContent);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Removed svg2roughjs and hand-drawn effects.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}