/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle)",
  "chart_name": "proportional_area_chart_circle_10",
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

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
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
    const rawChartData = data.data?.data || [];
    const dataColumns = data.data?.columns || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming data.colors, not data.colors_dark for now
    const images = data.images || {};

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    const criticalFieldsCheck = {};
    if (!xFieldCol || !xFieldCol.name) criticalFieldsCheck.xFieldName = "x role column or name";
    if (!yFieldCol || !yFieldCol.name) criticalFieldsCheck.yFieldName = "y role column or name";
    if (!groupFieldCol || !groupFieldCol.name) criticalFieldsCheck.groupFieldName = "group role column or name";

    if (Object.keys(criticalFieldsCheck).length > 0) {
        const missing = Object.entries(criticalFieldsCheck).map(([key, desc]) => `${desc}`).join(", ");
        const errorMsg = `Critical chart config missing: ${missing}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const groupFieldName = groupFieldCol.name;
    const yFieldUnit = yFieldCol.unit === "none" ? "" : (yFieldCol.unit || "");

    const chartDataArray = rawChartData.filter(d => d[yFieldName] != null && +d[yFieldName] > 0);

    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points to render.";
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif; padding: 10px;'>Warning: ${errorMsg}</div>`);
        }
        return null; // Or render an empty state
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typography.label?.font_size || '12px',
            labelFontWeight: typography.label?.font_weight || 'normal',
            annotationFontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typography.annotation?.font_size || '10px', // Base, will be adjusted
            annotationFontWeight: typography.annotation?.font_weight || 'normal',
        },
        textColor: colors.text_color || '#0f223b',
        backgroundColor: colors.background_color || '#FFFFFF', // Not used for SVG bg, but good to have
        primaryColor: colors.other?.primary || '#1e3cff',
        defaultCategoryColors: colors.available_colors || d3.schemeCategory10,
        getCategoryColor: (groupName, index) => {
            const fieldColors = colors.field || {};
            return fieldColors[groupName] || fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
        },
        getImageUrl: (itemName) => {
            const fieldImages = images.field || {};
            return fieldImages[itemName] || null;
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
        // Appending to body and removing can be more robust for getBBox, but often not needed.
        // document.body.appendChild(tempSvg); 
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth failed, using fallback:", e);
            const size = parseFloat(fontSize) || 12; // Ensure fontSize is parsed
            width = text.length * (size * 0.6); // Simple fallback
        }
        // if (tempSvg.parentNode === document.body) document.body.removeChild(tempSvg);
        return width;
    }

    function getColorBrightness(color) {
        if (!color || typeof color !== 'string' || !color.startsWith('#')) return 0.5;
        const hex = color.slice(1);
        const r = parseInt(hex.length === 3 ? hex.slice(0, 1).repeat(2) : hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.length === 3 ? hex.slice(1, 2).repeat(2) : hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.length === 3 ? hex.slice(2, 3).repeat(2) : hex.slice(4, 6), 16) / 255;
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    function getTextColorForBackground(bgColor) {
        return getColorBrightness(bgColor) > 0.6 ? '#000000' : '#FFFFFF';
    }

    function formatValueWithUnit(value, unit) {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + "M" + unit;
        } else if (value >= 1000) {
            return (value / 1000).toFixed(1) + "k" + unit;
        } else {
            return value.toString() + unit;
        }
    }

    function fitTextToWidth(text, maxWidth, fontFamily, fontSize, fontWeight) {
        if (!text) return "";
        const textWidth = estimateTextWidth(text, fontFamily, fontSize, fontWeight);
        if (textWidth <= maxWidth) return text;

        const ellipsis = "...";
        const ellipsisWidth = estimateTextWidth(ellipsis, fontFamily, fontSize, fontWeight);
        if (maxWidth <= ellipsisWidth) return ""; // Not enough space even for ellipsis

        let truncatedText = text;
        while (truncatedText.length > 0) {
            truncatedText = truncatedText.slice(0, -1);
            if (estimateTextWidth(truncatedText, fontFamily, fontSize, fontWeight) <= maxWidth - ellipsisWidth) {
                break;
            }
        }
        return truncatedText + ellipsis;
    }

    function getIconSizeForRadius(radius) {
        if (radius < 20) return 0;
        if (radius < 30) return 16;
        if (radius < 40) return 24;
        if (radius < 60) return 32;
        return 40;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 900;
    const containerHeight = variables.height || 700;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const uniqueGroups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    const legendItemHeight = 24; // Includes padding between rows
    const legendItemBaseHorizontalPadding = 8 + 16 + 6 + 10; // L-pad + rect + R-pad-rect + L-pad-text + R-pad-text
    const legendItemSpacing = 10;

    const legendItemWidths = uniqueGroups.map(group => {
        const textWidth = estimateTextWidth(
            group,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontSize,
            fillStyle.typography.labelFontWeight
        );
        return legendItemBaseHorizontalPadding + textWidth;
    });
    
    let legendRowCount = 1;
    let currentLegendRowWidth = 0;
    const legendMaxRowWidth = containerWidth - (variables.legend?.padding?.left || 20) - (variables.legend?.padding?.right || 20);


    legendItemWidths.forEach(itemWidth => {
        if (currentLegendRowWidth + itemWidth + (currentLegendRowWidth > 0 ? legendItemSpacing : 0) > legendMaxRowWidth) {
            legendRowCount++;
            currentLegendRowWidth = itemWidth;
        } else {
            currentLegendRowWidth += itemWidth + (currentLegendRowWidth > 0 ? legendItemSpacing : 0);
        }
    });
    
    const legendHeight = legendRowCount * legendItemHeight;
    const additionalTopMarginForLegend = legendHeight + (variables.legend?.padding?.bottom || 10); // Space for legend + padding below it

    const chartMargins = {
        top: (variables.margin?.top || 20) + additionalTopMarginForLegend,
        right: variables.margin?.right || 20,
        bottom: variables.margin?.bottom || 20,
        left: variables.margin?.left || 20,
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <=0 || innerHeight <=0) {
        const errorMsg = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Adjust container size or margins.";
        console.error(errorMsg);
         d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: ${errorMsg}</div>`);
        return null;
    }

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group other");

    const maxTotalCircleArea = innerWidth * innerHeight * 0.35; // Heuristic for packing density
    const centralCircleRadius = Math.min(innerWidth, innerHeight) * 0.25;

    // Block 5: Data Preprocessing & Transformation
    const radiusScaleDomainMax = d3.max(chartDataArray, d => +d[yFieldName]);
    const radiusScale = d3.scaleSqrt()
        .domain([0, radiusScaleDomainMax > 0 ? radiusScaleDomainMax : 1]) // Ensure domain max is positive
        .range([5, 100]); // Initial range, might be adjusted

    let nodeData = chartDataArray.map((d, i) => {
        const radius = radiusScale(+d[yFieldName]);
        return {
            id: d[xFieldName] != null ? String(d[xFieldName]) : `__node_${i}__`,
            label: d[xFieldName],
            value: +d[yFieldName],
            group: d[groupFieldName],
            color: fillStyle.getCategoryColor(d[groupFieldName], uniqueGroups.indexOf(d[groupFieldName])),
            radius: Math.max(1, radius), // Ensure radius is at least 1
            area: Math.PI * Math.max(1, radius) * Math.max(1, radius),
            iconUrl: fillStyle.getImageUrl(d[xFieldName])
        };
    }).sort((a, b) => b.radius - a.radius);

    const initialTotalArea = d3.sum(nodeData, d => d.area);
    if (initialTotalArea > maxTotalCircleArea && initialTotalArea > 0) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodeData.forEach(node => {
            node.radius *= areaRatio;
            node.area = Math.PI * node.radius * node.radius;
        });
    }

    const MIN_RADIUS = variables.minBubbleRadius || 15;
    const MAX_RADIUS = Math.min(innerHeight, innerWidth) * (variables.maxBubbleProportion || 0.25);
    nodeData.forEach(node => {
        node.radius = Math.max(MIN_RADIUS, Math.min(node.radius, MAX_RADIUS));
        node.area = Math.PI * node.radius * node.radius;
    });

    // Block 6: Scale Definition & Configuration
    // colorScale is implicitly handled by fillStyle.getCategoryColor
    // radiusScale is already defined and used

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend group")
        .attr("transform", `translate(${chartMargins.left}, ${variables.legend?.padding?.top || 20})`);

    let currentX = 0;
    let currentY = 0;
    uniqueGroups.forEach((group, i) => {
        const itemWidth = legendItemWidths[i];
        if (currentX + itemWidth > legendMaxRowWidth && currentX > 0) {
            currentX = 0;
            currentY += legendItemHeight;
        }

        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item other")
            .attr("transform", `translate(${currentX}, ${currentY})`);

        legendItem.append("rect")
            .attr("class", "mark visual-element")
            .attr("width", 16)
            .attr("height", 16)
            .attr("fill", fillStyle.getCategoryColor(group, i));

        legendItem.append("text")
            .attr("class", "label")
            .attr("x", 16 + 6) // rect width + spacing
            .attr("y", 16 / 2) // middle of rect
            .attr("dominant-baseline", "central")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);
        
        currentX += itemWidth + legendItemSpacing;
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const simulation = d3.forceSimulation(nodeData)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2 + 10).strength(0.05))
        .force("charge", d3.forceManyBody().strength(d => -d.radius * 0.8))
        .force("collide", d3.forceCollide().radius(d => d.radius + 7.5).strength(0.9).iterations(2))
        .stop(); // Stop for manual ticking

    // Custom group-collide force (simplified from original, ensure it works as intended)
    simulation.force("group-collide", (alpha) => {
        const quadtree = d3.quadtree()
            .x(d => d.x).y(d => d.y)
            .addAll(nodeData);
        for (const node of nodeData) {
            const r = node.radius;
            const nx1 = node.x - r, nx2 = node.x + r;
            const ny1 = node.y - r, ny2 = node.y + r;
            quadtree.visit((quad, x1, y1, x2, y2) => {
                if (quad.length) return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1; // no intersection
                let otherNode = quad.data;
                if (otherNode && otherNode !== node && node.group !== otherNode.group) {
                    let x = node.x - otherNode.x;
                    let y = node.y - otherNode.y;
                    let l = Math.sqrt(x * x + y * y);
                    const combinedRadius = node.radius + otherNode.radius + 15; // Extra spacing for different groups
                    if (l < combinedRadius) {
                        l = (l - combinedRadius) / l * alpha * 0.1; // Adjusted strength
                        node.vx -= x * l;
                        node.vy -= y * l;
                        otherNode.vx += x * l;
                        otherNode.vy += y * l;
                    }
                }
            });
        }
    });
    
    // Group clustering forces
    if (uniqueGroups.length > 0) {
        const angleStep = (2 * Math.PI) / uniqueGroups.length;
        uniqueGroups.forEach((group, i) => {
            const angle = i * angleStep;
            const distance = centralCircleRadius * 0.8;
            const targetX = innerWidth / 2 + distance * Math.cos(angle);
            const targetY = innerHeight / 2 + distance * Math.sin(angle);
            simulation.force(`cluster-${group}`, (alpha) => {
                nodeData.forEach(node => {
                    if (node.group === group) {
                        node.vx += (targetX - node.x) * 0.2 * alpha;
                        node.vy += (targetY - node.y) * 0.2 * alpha;
                    }
                });
            });
        });
    }

    // Initial positions and fixing larger nodes
    if (nodeData.length > 0) {
        const groupCounts = {};
        uniqueGroups.forEach(group => {
            groupCounts[group] = nodeData.filter(d => d.group === group).length;
        });

        nodeData.forEach((node) => {
            const groupIndex = uniqueGroups.indexOf(node.group);
            const nodesInGroup = groupCounts[node.group];
            const angle = (2 * Math.PI) / uniqueGroups.length * groupIndex;
            
            const groupNodes = nodeData.filter(d => d.group === node.group); // Already sorted by radius
            const inGroupIndex = groupNodes.findIndex(n => n.id === node.id);
            const inGroupAngle = angle + (Math.PI / (nodesInGroup + 1)) * (inGroupIndex + 1) * 0.5;
            
            const distance = centralCircleRadius + node.radius * 1.5;
            
            node.x = innerWidth / 2 + distance * Math.cos(inGroupAngle);
            node.y = innerHeight / 2 + distance * Math.sin(inGroupAngle);
            
            if (inGroupIndex < Math.max(1, nodesInGroup / 3)) { // Fix some larger nodes
                node.fx = node.x;
                node.fy = node.y;
            }
        });
    }
    
    const MIN_ITERATIONS = 200;
    for (let i = 0; i < MIN_ITERATIONS; ++i) {
        simulation.tick();
        nodeData.forEach(d => {
            if (!d.fx) { // Boundary constraints for non-fixed nodes
                d.x = Math.max(d.radius + 5, Math.min(innerWidth - d.radius - 5, d.x));
                d.y = Math.max(d.radius + 5, Math.min(innerHeight - d.radius - 5, d.y));
            }
        });
    }

    const bubbleGroups = mainChartGroup.selectAll(".bubble-group")
        .data(nodeData, d => d.id)
        .enter()
        .append("g")
        .attr("class", "mark group bubble-group")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    bubbleGroups.append("circle")
        .attr("class", "mark visual-element bubble-circle")
        .attr("r", d => d.radius)
        .attr("fill", d => d.color)
        .attr("stroke", "#fff") // Hardcoded, consider making configurable if needed
        .attr("stroke-width", 1.5);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    bubbleGroups.each(function(d) {
        const group = d3.select(this);
        const textColor = getTextColorForBackground(d.color);
        
        if (d.iconUrl && d.radius >= MIN_RADIUS) { // Check radius for icon visibility
            const iconSize = getIconSizeForRadius(d.radius);
            if (iconSize > 0) {
                group.append("image")
                    .attr("class", "icon bubble-icon")
                    .attr("xlink:href", d.iconUrl)
                    .attr("x", -iconSize / 2)
                    .attr("y", -iconSize / 2) // Default center, adjust if text is present
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        }
        
        let textYOffset = 0;

        if (d.radius >= (variables.minRadiusForValueLabel || 25)) {
            const fontSizeValue = Math.max(parseFloat(fillStyle.typography.annotationFontSize) * 0.8, Math.min(d.radius / 5, parseFloat(fillStyle.typography.annotationFontSize) * 1.6));
            const yPosValue = d.iconUrl && getIconSizeForRadius(d.radius) > 0 ? d.radius * 0.35 - fontSizeValue * 0.5 : 0; // Adjust if icon present
            textYOffset = yPosValue + fontSizeValue * 0.5; // For next label

            group.append("text")
                .attr("class", "label value bubble-value-label")
                .attr("text-anchor", "middle")
                .attr("y", yPosValue)
                .attr("fill", textColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${fontSizeValue}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight) // Could be bold
                .text(formatValueWithUnit(d.value, yFieldUnit));
        }
        
        if (d.radius >= (variables.minRadiusForCategoryLabel || 35) && d.label) {
            const fontSizeCategory = Math.max(parseFloat(fillStyle.typography.annotationFontSize) * 0.7, Math.min(d.radius / 6, parseFloat(fillStyle.typography.annotationFontSize) * 1.4));
            const maxWidthCategory = d.radius * 1.5; // Max width for text inside circle
            const truncatedText = fitTextToWidth(String(d.label), maxWidthCategory, fillStyle.typography.annotationFontFamily, `${fontSizeCategory}px`, fillStyle.typography.annotationFontWeight);
            
            let yPosCategory = textYOffset + fontSizeCategory * 0.7; // Position below value label
            if (textYOffset === 0) { // No value label, position based on icon or center
                 yPosCategory = d.iconUrl && getIconSizeForRadius(d.radius) > 0 ? d.radius * 0.35 + fontSizeCategory * 0.5 : fontSizeCategory * 0.5;
            }


            group.append("text")
                .attr("class", "label category bubble-category-label")
                .attr("text-anchor", "middle")
                .attr("y", yPosCategory)
                .attr("fill", textColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${fontSizeCategory}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(truncatedText);
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}