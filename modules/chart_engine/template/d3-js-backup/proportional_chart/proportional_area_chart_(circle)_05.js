/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle)",
  "chart_name": "proportional_area_chart_circle_05",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 8]],
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
  "valueSortDirection": "descending",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawData = data.data || {};
    const chartDataArray = rawData.data || [];
    const dataColumns = rawData.columns || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed in data.colors_dark
    const images = data.images || {};

    d3.select(containerSelector).html(""); // Clear the container

    const xCol = dataColumns.find(c => c.role === "x");
    const yCol = dataColumns.find(c => c.role === "y");
    const groupCol = dataColumns.find(c => c.role === "group");

    const xField = xCol?.name;
    const yField = yCol?.name;
    const groupField = groupCol?.name;
    
    const criticalFields = { xField, yField, groupField };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMessage}</div>`);
        }
        return null;
    }
    
    const yUnit = yCol?.unit === "none" ? "" : yCol?.unit ?? "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
            valueFontWeightBold: 'bold', // For values inside circles
        },
        textColor: colors.text_color || '#333333',
        textOnColoredSurfaceColor: '#FFFFFF', // For text on dark/colored backgrounds (circles)
        legendBackgroundColor: colors.legend_background_color || 'rgba(255, 255, 255, 0.85)',
        legendBorderColor: colors.legend_border_color || '#DDDDDD',
        defaultCategoricalColors: d3.schemeCategory10,
        primaryColor: (colors.other && colors.other.primary) || d3.schemeCategory10[0],
        chartBackgroundColor: colors.background_color || 'transparent', // SVG background
    };

    fillStyle.getColor = (groupValue, index) => {
        if (colors.field && colors.field[groupValue]) {
            return colors.field[groupValue];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[index % colors.available_colors.length];
        }
        return fillStyle.defaultCategoricalColors[index % fillStyle.defaultCategoricalColors.length];
    };
    
    fillStyle.getImageUrl = (fieldValue) => {
        if (images.field && images.field[fieldValue]) {
            return images.field[fieldValue];
        }
        if (images.other && images.other.primary) { // Fallback to a generic primary image if defined
            // return images.other.primary; // This was not in original logic, stick to field specific
        }
        return null;
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // No need to append to DOM for getBBox if it's a simple text element in a fresh SVG.
        // However, for full reliability, especially with complex CSS, appending might be needed.
        // Sticking to no-DOM append as per directive.
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM
            const numFontSize = parseFloat(fontSize) || 12;
            width = text.length * numFontSize * 0.6; // Rough estimate
        }
        return width;
    }

    function formatValue(value) {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M${yUnit}`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K${yUnit}`;
        if (value >= 100) return value.toFixed(0) + yUnit;
        if (value >= 10) return value.toFixed(1) + yUnit;
        return value.toFixed(2) + yUnit;
    }

    function getCircleSizeCategory(radius, mediumThreshold, largeThreshold) {
        if (radius < mediumThreshold) return "small";
        if (radius < largeThreshold) return "medium";
        return "large";
    }

    function fitTextToWidth(text, maxWidth, fontFamily, baseFontSizeStr, fontWeight) {
        const baseFontSize = parseFloat(baseFontSizeStr);
        let currentFontSize = baseFontSize;
        let currentText = text;
        const minFontSize = 8; // px

        let textWidth = estimateTextWidth(currentText, fontFamily, `${currentFontSize}px`, fontWeight);

        if (textWidth <= maxWidth) return { text: currentText, fontSize: `${currentFontSize}px` };

        // Try reducing font size
        const scaleFactor = maxWidth / textWidth;
        currentFontSize = Math.max(minFontSize, Math.floor(baseFontSize * scaleFactor));
        
        textWidth = estimateTextWidth(currentText, fontFamily, `${currentFontSize}px`, fontWeight);

        if (textWidth <= maxWidth) return { text: currentText, fontSize: `${currentFontSize}px` };
        
        // If still too wide (at minFontSize), truncate
        if (currentFontSize <= minFontSize) {
            while (estimateTextWidth(currentText + "...", fontFamily, `${minFontSize}px`, fontWeight) > maxWidth && currentText.length > 0) {
                currentText = currentText.slice(0, -1);
            }
            return { text: currentText + "...", fontSize: `${minFontSize}px` };
        }
        return { text: currentText, fontSize: `${currentFontSize}px` }; // Should have fit by font scaling
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 900;
    const containerHeight = variables.height || 700;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "proportional-area-chart-svg")
        .style("background-color", fillStyle.chartBackgroundColor)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendItemHeight = 24; // px, used for text and circle
    const legendPadding = 10; // px
    const legendTopOffset = 20; // px, space from SVG top to legend top

    const filteredData = chartDataArray.filter(d => d[yField] != null && +d[yField] > 0);
    const uniqueGroups = [...new Set(filteredData.map(d => d[groupField]))].sort();
    
    // Calculate legend layout to determine top margin
    let legendRowCount = 1;
    let legendActualHeight = legendItemHeight + 2 * legendPadding; // Min height for one row

    if (uniqueGroups.length > 0) {
        const tempLegendGroup = svgRoot.append("g").attr("class", "temp-legend-measure"); // Temporary for measurement
        const legendItemWidths = uniqueGroups.map(group => {
            const textEl = tempLegendGroup.append("text")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .text(group);
            const textWidth = textEl.node().getComputedTextLength();
            textEl.remove();
            return (6 * 2) + 8 + textWidth; // circleDiameter + textPadding + textWidth
        });
        tempLegendGroup.remove();

        const maxLegendWidth = containerWidth - 80; // Available width for legend items
        const legendItemHorizontalPadding = 20;
        let currentLegendRowWidth = 0;
        legendRowCount = 1;
        legendItemWidths.forEach(itemWidth => {
            if (currentLegendRowWidth + itemWidth + legendItemHorizontalPadding > maxLegendWidth && currentLegendRowWidth > 0) {
                legendRowCount++;
                currentLegendRowWidth = itemWidth + legendItemHorizontalPadding;
            } else {
                currentLegendRowWidth += itemWidth + legendItemHorizontalPadding;
            }
        });
        legendActualHeight = legendRowCount * legendItemHeight + (legendPadding * 2) + (legendRowCount > 1 ? (legendRowCount -1) * (legendItemHeight * 0.25) : 0) ; // Added small gap between rows
    }
    
    const chartMargins = {
        top: legendTopOffset + legendActualHeight + 20, // Space for legend + padding
        right: 20,
        bottom: 20,
        left: 20
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const maxTotalCircleArea = innerWidth * innerHeight * 0.35; // As per original
    const MIN_RADIUS = 15;
    const MAX_RADIUS = Math.min(innerHeight, innerWidth) * 0.25;
    
    // Thresholds for circle size categories (used for text display logic)
    const MEDIUM_CIRCLE_THRESHOLD = 25; // Radius in px
    const LARGE_CIRCLE_THRESHOLD = 40;  // Radius in px

    let nodes = filteredData.map((d, i) => {
        return {
            id: String(d[xField] != null ? d[xField] : `__node_${i}__`),
            label: String(d[xField]),
            value: +d[yField],
            group: String(d[groupField]),
            originalIndex: i // Keep original index for stable color assignment
        };
    });

    // Block 6: Scale Definition & Configuration
    const valueExtent = d3.extent(nodes, d => d.value);
    const radiusScale = d3.scaleSqrt()
        .domain(valueExtent[0] > 0 ? valueExtent : [1,1]) // Ensure domain is positive
        .range([25, 100]); // Initial range, will be adjusted

    nodes.forEach(node => {
        node.radius = radiusScale(node.value);
        node.area = Math.PI * node.radius * node.radius;
        node.color = fillStyle.getColor(node.group, uniqueGroups.indexOf(node.group));
    });
    
    nodes.sort((a, b) => b.radius - a.radius); // Sort by radius for initial fixed positioning

    const initialTotalArea = d3.sum(nodes, d => d.area);
    if (initialTotalArea > maxTotalCircleArea && initialTotalArea > 0) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodes.forEach(node => {
            node.radius *= areaRatio;
            node.area = Math.PI * node.radius * node.radius;
        });
    }

    nodes.forEach(node => {
        node.radius = Math.max(MIN_RADIUS, Math.min(node.radius, MAX_RADIUS));
        node.area = Math.PI * node.radius * node.radius; // Update area after clamping
    });

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    if (uniqueGroups.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${chartMargins.left}, ${legendTopOffset})`);

        const legendCircleRadius = 6;
        const legendTextPadding = 8;
        const legendItemHorizontalPadding = 20; // Between items
        const legendItemVerticalPadding = legendItemHeight * 0.25; // Between rows

        const legendItemData = uniqueGroups.map(group => {
            const textWidth = estimateTextWidth(group, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            return {
                group: group,
                width: (legendCircleRadius * 2) + legendTextPadding + textWidth
            };
        });

        const legendRows = [];
        let currentLegendRow = [];
        let currentLegendRowWidth = 0;
        const maxLegendDisplayWidth = innerWidth; // Max width for items in a row

        legendItemData.forEach(item => {
            if (currentLegendRowWidth + item.width + (currentLegendRow.length > 0 ? legendItemHorizontalPadding : 0) > maxLegendDisplayWidth && currentLegendRow.length > 0) {
                legendRows.push(currentLegendRow);
                currentLegendRow = [item];
                currentLegendRowWidth = item.width;
            } else {
                currentLegendRowWidth += item.width + (currentLegendRow.length > 0 ? legendItemHorizontalPadding : 0);
                currentLegendRow.push(item);
            }
        });
        if (currentLegendRow.length > 0) legendRows.push(currentLegendRow);
        
        const finalLegendHeight = legendRows.length * legendItemHeight + (legendRows.length - 1) * legendItemVerticalPadding + 2 * legendPadding;
        const legendBackgroundWidth = Math.max(...legendRows.map(row => row.reduce((sum, item, idx) => sum + item.width + (idx > 0 ? legendItemHorizontalPadding : 0), 0))) + 2 * legendPadding;
        
        legendGroup.append("rect")
            .attr("class", "legend-background")
            .attr("x", (innerWidth - legendBackgroundWidth) / 2) // Center background
            .attr("y", 0)
            .attr("width", legendBackgroundWidth)
            .attr("height", finalLegendHeight)
            .attr("rx", 8)
            .attr("ry", 8)
            .style("fill", fillStyle.legendBackgroundColor)
            .style("stroke", fillStyle.legendBorderColor)
            .style("stroke-width", 1.5);

        let yOffset = legendPadding + (legendItemHeight / 2);
        legendRows.forEach(rowItems => {
            const totalRowWidth = rowItems.reduce((sum, item, idx) => sum + item.width + (idx > 0 ? legendItemHorizontalPadding : 0), 0);
            let xOffset = (innerWidth - totalRowWidth) / 2; // Center row content

            rowItems.forEach(item => {
                const legendItemG = legendGroup.append("g")
                    .attr("class", "legend-item")
                    .attr("transform", `translate(${xOffset}, ${yOffset})`);
                
                legendItemG.append("circle")
                    .attr("class", "legend-mark")
                    .attr("cx", legendCircleRadius)
                    .attr("cy", 0) 
                    .attr("r", legendCircleRadius)
                    .style("fill", fillStyle.getColor(item.group, uniqueGroups.indexOf(item.group)));

                legendItemG.append("text")
                    .attr("class", "legend-label label")
                    .attr("x", legendCircleRadius * 2 + legendTextPadding)
                    .attr("y", 0)
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .style("dominant-baseline", "middle")
                    .text(item.group);
                
                xOffset += item.width + legendItemHorizontalPadding;
            });
            yOffset += legendItemHeight + legendItemVerticalPadding;
        });
    }

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    if (nodes.length === 0) { // No data to render circles
        mainChartGroup.append("text")
            .attr("class", "label no-data-message")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No data available to display circles.");
        return svgRoot.node();
    }
    
    const simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.05))
        .force("charge", d3.forceManyBody().strength(d => -d.radius * 0.8))
        .force("collide", d3.forceCollide().radius(d => d.radius + 7.5).strength(0.9).iterations(2))
        .stop();

    // Custom clustering force (simplified from original, direct application)
    uniqueGroups.forEach(group => {
        const clusterStrength = 0.35; // As per original
        const groupNodes = nodes.filter(n => n.group === group);
        if (groupNodes.length === 0) return;

        // Calculate a target for the cluster (can be dynamic or fixed)
        // For simplicity, using a slightly offset center based on group index
        const groupIndex = uniqueGroups.indexOf(group);
        const angle = (groupIndex / uniqueGroups.length) * 2 * Math.PI;
        const clusterTargetX = innerWidth / 2 + (innerWidth / 5) * Math.cos(angle) * (uniqueGroups.length > 1 ? 1:0) ; // Spread groups if more than one
        const clusterTargetY = innerHeight / 2 + (innerHeight / 5) * Math.sin(angle) * (uniqueGroups.length > 1 ? 1:0) ;

        simulation.force(`cluster-${group}`, (alpha) => {
            groupNodes.forEach(node => {
                node.vx += (clusterTargetX - node.x) * clusterStrength * alpha;
                node.vy += (clusterTargetY - node.y) * clusterStrength * alpha;
            });
        });
    });
    
    if (nodes.length > 0 && nodes[0]) { // nodes[0] is largest
        nodes[0].fx = innerWidth / 2;
        nodes[0].fy = innerHeight / 2;
    }

    // Initial positioning for other nodes (simplified from original complex logic)
    if (nodes.length > 1) {
        const angleStep = (2 * Math.PI) / (nodes.length -1);
        nodes.forEach((node, i) => {
            if (node.fx) return; // Skip fixed node
            const angle = i * angleStep;
            // Distribute around the center, further out for smaller nodes initially
            const initialDist = Math.min(innerWidth, innerHeight) / 4  * (1 + Math.random()*0.2);
            node.x = (innerWidth / 2) + Math.cos(angle) * initialDist * (1 - node.radius/MAX_RADIUS);
            node.y = (innerHeight / 2) + Math.sin(angle) * initialDist * (1 - node.radius/MAX_RADIUS);
        });
    }


    const MIN_ITERATIONS = 350;
    for (let i = 0; i < MIN_ITERATIONS; ++i) {
        simulation.tick();

        // Custom inter-group and intra-group collision/spacing adjustment from original
        for (let k = 0; k < nodes.length; k++) {
            const nodeA = nodes[k];
            for (let l = k + 1; l < nodes.length; l++) {
                const nodeB = nodes[l];
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                if (distance === 0) distance = 0.001; // prevent division by zero

                let minDistance;
                let forceStrength;

                if (nodeA.group !== nodeB.group) { // Different groups
                    const extraPadding = (nodeA.radius + nodeB.radius) * 0.15;
                    minDistance = nodeA.radius + nodeB.radius + Math.max(extraPadding, 15);
                    forceStrength = 0.5; // Stronger repulsion for different groups
                } else { // Same group
                    minDistance = nodeA.radius + nodeB.radius;
                    forceStrength = 0.1; // Weaker repulsion within same group (cluster force handles attraction)
                }

                if (distance < minDistance) {
                    const moveRatio = (minDistance - distance) / distance * forceStrength * simulation.alpha();
                    const moveX = dx * moveRatio;
                    const moveY = dy * moveRatio;

                    if (!nodeA.fx) { nodeA.x -= moveX; nodeA.y -= moveY; }
                    if (!nodeB.fx) { nodeB.x += moveX; nodeB.y += moveY; }
                }
            }
        }
        
        // Boundary constraints
        nodes.forEach(d => {
            if (!d.fx) {
                d.x = Math.max(d.radius + 5, Math.min(innerWidth - d.radius - 5, d.x));
            }
            if (!d.fy) {
                d.y = Math.max(d.radius + 5, Math.min(innerHeight - d.radius - 5, d.y));
            }
        });
    }
    
    const nodeElementsG = mainChartGroup.selectAll("g.node-element")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", d => `node-element mark group-${d.group.replace(/\s+/g, '-').toLowerCase()}`)
        .attr("transform", d => `translate(${d.x},${d.y})`);

    nodeElementsG.append("circle")
        .attr("class", "mark circle-mark")
        .attr("r", d => d.radius)
        .style("fill", d => d.color);
        // No stroke, no shadow filter as per requirements

    nodeElementsG.each(function(d, i) {
        const nodeG = d3.select(this);
        const radius = d.radius;
        const circleSizeCat = getCircleSizeCategory(radius, MEDIUM_CIRCLE_THRESHOLD, LARGE_CIRCLE_THRESHOLD);
        const isTop5WithImage = i < 5 && fillStyle.getImageUrl(d.label); // Check if image exists

        const valueText = formatValue(d.value);
        
        if (circleSizeCat === "small") {
            if (radius >= MEDIUM_CIRCLE_THRESHOLD * 0.7) { // Only if large enough small circle
                nodeG.append("text")
                    .attr("class", "value text data-value-internal")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", Math.min(radius / 1.8, parseFloat(fillStyle.typography.annotationFontSize)) + "px")
                    .style("font-weight", fillStyle.typography.valueFontWeightBold)
                    .style("fill", fillStyle.textOnColoredSurfaceColor)
                    .text(valueText);
            }
            // External label for small circles
            mainChartGroup.append("text") // Append to mainChartGroup to avoid transform issues with nodeG
                .attr("class", "label text data-label-external")
                .attr("x", d.x)
                .attr("y", d.y + radius + parseFloat(fillStyle.typography.annotationFontSize) * 0.8) // Position below circle
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", (parseFloat(fillStyle.typography.annotationFontSize) * 0.8) + "px") // Smaller
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(d.label);

        } else if (circleSizeCat === "medium") {
            nodeG.append("text")
                .attr("class", "value text data-value-internal")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", Math.min(radius / 2, parseFloat(fillStyle.typography.annotationFontSize) * 1.2) + "px")
                .style("font-weight", fillStyle.typography.valueFontWeightBold)
                .style("fill", fillStyle.textOnColoredSurfaceColor)
                .text(valueText);
            
            mainChartGroup.append("text")
                .attr("class", "label text data-label-external")
                .attr("x", d.x)
                .attr("y", d.y + radius + parseFloat(fillStyle.typography.annotationFontSize))
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", (parseFloat(fillStyle.typography.annotationFontSize) * 0.9) + "px")
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(d.label);

        } else { // Large circles
            const baseFontSizeForLarge = Math.min(radius / 3, parseFloat(fillStyle.typography.labelFontSize) * 1.2) + "px";
            const maxTextWidth = radius * 1.6;

            if (isTop5WithImage) {
                const imageUrl = fillStyle.getImageUrl(d.label);
                const iconSize = radius * 0.7;
                nodeG.append("image")
                    .attr("class", "icon image data-icon-internal")
                    .attr("x", -iconSize / 2)
                    .attr("y", -iconSize / 2 - radius * 0.05) // Shift icon slightly up to make space
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", imageUrl);

                const labelFit = fitTextToWidth(d.label, maxTextWidth, fillStyle.typography.labelFontFamily, baseFontSizeForLarge, fillStyle.typography.labelFontWeight);
                nodeG.append("text") // Label above icon
                    .attr("class", "label text data-label-internal")
                    .attr("text-anchor", "middle")
                    .attr("y", -radius * 0.5) // Adjusted for icon
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", labelFit.fontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textOnColoredSurfaceColor)
                    .text(labelFit.text);

                nodeG.append("text") // Value below icon
                    .attr("class", "value text data-value-internal")
                    .attr("text-anchor", "middle")
                    .attr("y", radius * 0.55) // Adjusted for icon
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", Math.min(parseFloat(labelFit.fontSize) * 0.8, parseFloat(fillStyle.typography.annotationFontSize) * 1.5) + "px")
                    .style("font-weight", fillStyle.typography.valueFontWeightBold)
                    .style("fill", fillStyle.textOnColoredSurfaceColor)
                    .text(valueText);
            } else { // Large circle, no image or not top 5
                const labelFit = fitTextToWidth(d.label, maxTextWidth, fillStyle.typography.labelFontFamily, baseFontSizeForLarge, fillStyle.typography.labelFontWeight);
                nodeG.append("text")
                    .attr("class", "label text data-label-internal")
                    .attr("text-anchor", "middle")
                    .attr("y", -radius * 0.20) // Label higher
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", labelFit.fontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textOnColoredSurfaceColor)
                    .text(labelFit.text);

                nodeG.append("text")
                    .attr("class", "value text data-value-internal")
                    .attr("text-anchor", "middle")
                    .attr("y", radius * 0.30) // Value lower
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", Math.min(parseFloat(labelFit.fontSize) * 0.9, parseFloat(fillStyle.typography.annotationFontSize) * 1.8) + "px")
                    .style("font-weight", fillStyle.typography.valueFontWeightBold)
                    .style("fill", fillStyle.textOnColoredSurfaceColor)
                    .text(valueText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (No specific items like tooltips or advanced interactivity in this refactoring pass beyond core rendering)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}