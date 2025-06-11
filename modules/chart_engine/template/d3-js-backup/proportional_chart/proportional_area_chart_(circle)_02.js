/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle)",
  "chart_name": "proportional_area_chart_circle_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": "none",
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
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
  "valueSortDirection": "descending",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colorSettings = (data.theme === 'dark' && data.colors_dark) ? data.colors_dark : (data.colors || {});
    const images = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container immediately

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const valueUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y")?.unit || "");

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x field (category)");
        if (!valueFieldName) missingFields.push("y field (value)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        circleStroke: '#FFFFFF',
        circleStrokeWidth: 1.0,
        defaultCategoryColor: '#CCCCCC',
        defaultAvailableColors: d3.schemeTableau10, // Default color scheme
        adaptiveTextColorLight: '#FFFFFF',
        adaptiveTextColorDark: '#000000',
    };

    const defaultFontSettings = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.categoryFontFamily = (typography.label && typography.label.font_family) ? typography.label.font_family : defaultFontSettings.label.font_family;
    fillStyle.typography.categoryFontSize = (typography.label && typography.label.font_size) ? typography.label.font_size : defaultFontSettings.label.font_size;
    fillStyle.typography.categoryFontWeight = (typography.label && typography.label.font_weight) ? typography.label.font_weight : defaultFontSettings.label.font_weight;

    fillStyle.typography.valueFontFamily = (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : defaultFontSettings.annotation.font_family;
    fillStyle.typography.valueFontSize = (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : defaultFontSettings.annotation.font_size;
    fillStyle.typography.valueFontWeight = (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : defaultFontSettings.annotation.font_weight;
    
    fillStyle.textColor = colorSettings.text_color || fillStyle.adaptiveTextColorDark; // General text color
    fillStyle.chartBackground = colorSettings.background_color || '#FFFFFF'; // Not used for SVG bg, but standard token

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize); // e.g., "12px"
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        tempSvg.appendChild(textEl);
        // No need to append to DOM for getBBox if it's a simple text element
        try {
            return textEl.getBBox().width;
        } catch (e) {
            // Fallback or error handling if getBBox fails (e.g., in a very restricted environment)
            return text.length * (parseFloat(fontSize) || 12) * 0.6; // Rough estimate
        }
    }

    function getColorBrightness(colorStr) {
        if (!colorStr) return 0.5; // Default for invalid color
        let r, g, b;
        if (colorStr.startsWith('rgba')) {
            const match = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
            if (match) { [, r, g, b] = match.map(Number); } else { return 0.5; }
        } else if (colorStr.startsWith('rgb')) {
            const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) { [, r, g, b] = match.map(Number); } else { return 0.5; }
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

    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? fillStyle.adaptiveTextColorDark : fillStyle.adaptiveTextColorLight;
    }

    function getChordLength(radius, distanceFromCenter) {
        return 2 * Math.sqrt(Math.max(0, radius * radius - distanceFromCenter * distanceFromCenter));
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg proportional-area-chart-container")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: variables.margin_top ?? 90, right: variables.margin_right ?? 20, bottom: variables.margin_bottom ?? 60, left: variables.margin_left ?? 20 };
    const plotWidth = containerWidth - chartMargins.left - chartMargins.right;
    const plotHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const maxTotalCircleArea = plotWidth * plotHeight * (variables.max_area_ratio ?? 0.5);
    const minRadius = variables.min_radius ?? 5;
    const maxRadius = Math.min(plotHeight / 2, plotWidth / 2, variables.max_radius ?? plotHeight / 3); // Ensure maxRadius fits
    const TOP_PROTECTED_AREA = variables.top_protected_area ?? 30; // Space at the top of the plot area

    // Block 5: Data Preprocessing & Transformation
    let chartData = chartDataInput.filter(d =>
        d[valueFieldName] !== null &&
        d[valueFieldName] !== undefined &&
        !isNaN(parseFloat(d[valueFieldName])) &&
        +d[valueFieldName] > 0
    );

    if (chartData.length === 0) {
        mainGroup.append("text")
            .attr("x", plotWidth / 2)
            .attr("y", plotHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "label no-data-label")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .text("No valid data to display.");
        return svgRoot.node();
    }
    
    // Block 6: Scale Definition & Configuration
    const uniqueCategories = [...new Set(chartData.map(d => d[categoryFieldName]))];
    const colorScale = d3.scaleOrdinal().domain(uniqueCategories);
    const colorRange = uniqueCategories.map((cat, i) => {
        if (colorSettings.field && colorSettings.field[cat]) {
            return colorSettings.field[cat];
        }
        if (colorSettings.available_colors && colorSettings.available_colors.length > 0) {
            return colorSettings.available_colors[i % colorSettings.available_colors.length];
        }
        return fillStyle.defaultAvailableColors[i % fillStyle.defaultAvailableColors.length];
    });
    colorScale.range(colorRange);

    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(chartData, d => +d[valueFieldName])])
        .range([minRadius, maxRadius * 0.8]); // 0.8 factor to prevent largest circle from being too dominant initially

    let nodesData = chartData.map((d, i) => {
        const value = +d[valueFieldName];
        const radius = Math.max(minRadius, radiusScale(value)); // Ensure minRadius
        return {
            id: d[categoryFieldName] != null ? String(d[categoryFieldName]) : `__${i}__`, // Use generated ID if category is null
            value: value,
            radius: radius,
            area: Math.PI * radius * radius,
            color: colorScale(d[categoryFieldName]),
            iconUrl: (images.field && images.field[d[categoryFieldName]]) || (images.other && images.other[d[categoryFieldName]]) || null,
            originalDataItem: d
        };
    }).sort((a, b) => b.radius - a.radius); // Sort by radius, largest first

    const initialTotalArea = d3.sum(nodesData, d => d.area);
    if (initialTotalArea > maxTotalCircleArea && initialTotalArea > 0) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodesData.forEach(node => {
            node.radius = Math.max(minRadius, node.radius * areaRatio); // Ensure minRadius after scaling
            node.area = Math.PI * node.radius * node.radius;
        });
        // console.log(`Scaled down total circle area. Scale factor: ${areaRatio.toFixed(2)}`);
    }
    
    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering
    const forceSimulation = d3.forceSimulation()
        .force("center", d3.forceCenter(plotWidth / 2, plotHeight / 2).strength(0.05))
        .force("charge", d3.forceManyBody().strength(variables.charge_strength ?? -10))
        .force("collide", d3.forceCollide().radius(d => d.radius + (variables.collision_padding ?? 2)).strength(variables.collision_strength ?? 0.9)) // Add padding to radius for collision
        .stop();

    if (nodesData.length > 0) {
        nodesData[0].fx = plotWidth / 2;
        nodesData[0].fy = plotHeight / 2; // Fix the largest circle in the center
    }
    if (nodesData.length > 1) {
        const angleStep = 2 * Math.PI / (nodesData.length -1); // For remaining nodes
        let spiralRadiusStep = Math.min(plotWidth, plotHeight) * 0.1;
        let currentSpiralRadius = spiralRadiusStep;
        for (let i = 1; i < nodesData.length; i++) {
            const angle = (i-1) * angleStep; // Start angle from 0 for second element
            nodesData[i].x = plotWidth / 2 + currentSpiralRadius * Math.cos(angle);
            nodesData[i].y = plotHeight / 2 + currentSpiralRadius * Math.sin(angle);
            if (i % 5 === 0) { // Expand spiral every 5 nodes
                currentSpiralRadius += spiralRadiusStep;
            }
        }
    }


    forceSimulation.nodes(nodesData);
    const numIterations = variables.simulation_iterations ?? 200;
    for (let i = 0; i < numIterations; ++i) {
        forceSimulation.tick();
        nodesData.forEach(d => {
            if (!d.fx) { // If node is not fixed
                d.x = Math.max(d.radius, Math.min(plotWidth - d.radius, d.x));
            }
            if (!d.fy) { // If node is not fixed
                 // Ensure y is within plot, respecting TOP_PROTECTED_AREA for non-fixed nodes
                d.y = Math.max(TOP_PROTECTED_AREA + d.radius, Math.min(plotHeight - d.radius, d.y));
            }
             // Special handling for the fixed central node if it's too large for TOP_PROTECTED_AREA
            if (d.fx && d.fy && d.fy - d.radius < TOP_PROTECTED_AREA) {
                d.fy = TOP_PROTECTED_AREA + d.radius;
            }
        });
    }
    
    const nodeElements = mainGroup.selectAll("g.node-group")
        .data(nodesData, d => d.id)
        .join("g")
        .attr("class", "mark node-group")
        .attr("transform", d => `translate(${d.x.toFixed(2)},${d.y.toFixed(2)})`);

    nodeElements.append("circle")
        .attr("class", "mark circle-mark")
        .attr("r", d => d.radius)
        .attr("fill", d => d.color)
        .attr("stroke", fillStyle.circleStroke)
        .attr("stroke-width", fillStyle.circleStrokeWidth);

    // Block 9: Optional Enhancements & Post-Processing (Annotations, Icons)
    const valueFontSizeBase = parseFloat(fillStyle.typography.valueFontSize);
    const categoryFontSizeBase = parseFloat(fillStyle.typography.categoryFontSize);

    const iconSizeRatio = variables.icon_size_ratio ?? 0.6;
    const minIconSize = variables.min_icon_size ?? 16;
    const maxIconSize = variables.max_icon_size ?? 120;
    
    const fontSizeScaleFactor = variables.font_size_scale_factor ?? 0.35;
    const minDynamicFontSize = variables.min_dynamic_font_size ?? 8;
    const maxDynamicFontSize = variables.max_dynamic_font_size ?? 22;
    
    const minRadiusForText = variables.min_radius_for_text ?? 10;
    const categoryLabelLineHeightFactor = variables.category_label_line_height_factor ?? 0.3; // Multiplier for 'em'

    nodeElements.each(function(dNode) {
        const groupElement = d3.select(this);
        const currentRadius = dNode.radius;
        
        if (currentRadius < minRadiusForText && dNode.iconUrl) { // Very small circle, only icon if available
            const iconSize = Math.min(currentRadius * 1.5, minIconSize * 1.2);
            if (iconSize > 0) {
                 groupElement.append("image")
                    .attr("class", "icon image-icon")
                    .attr("xlink:href", dNode.iconUrl)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("x", -iconSize / 2)
                    .attr("y", -iconSize / 2)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
            return;
        }
        if (currentRadius < minDynamicFontSize) return; // Too small for any text/icon

        const valueText = `${dNode.value}${valueUnit}`;
        const categoryText = dNode.id.startsWith("__") ? "" : dNode.id;
        const adaptiveTextColor = getTextColorForBackground(dNode.color);

        const topPaddingForIcon = currentRadius * 0.1;
        const idealIconSize = Math.min(currentRadius * iconSizeRatio * 2, maxIconSize); // Icon size relative to radius
        
        const iconTopY = -currentRadius + topPaddingForIcon;
        const iconMaxWidthAtY = getChordLength(currentRadius, Math.abs(iconTopY + idealIconSize / 2));
        const finalIconSize = dNode.iconUrl ? Math.max(minIconSize, Math.min(idealIconSize, iconMaxWidthAtY)) : 0;

        const textAreaStartY = (dNode.iconUrl && finalIconSize > 0) ? (iconTopY + finalIconSize + currentRadius * 0.05) : -currentRadius * 0.7;
        const textAreaEndY = currentRadius * 0.8;
        const textAreaHeight = Math.max(0, textAreaEndY - textAreaStartY);

        let dynamicFontSize = Math.max(
            minDynamicFontSize,
            Math.min(
                currentRadius * fontSizeScaleFactor,
                (valueFontSizeBase + categoryFontSizeBase) / 2, // Average of configured base sizes
                maxDynamicFontSize,
                textAreaHeight / (categoryText ? (dNode.iconUrl && finalIconSize > 0 ? 2.5 : 3) : 1.5) // Available height constraint
            )
        );
        if (isNaN(dynamicFontSize) || dynamicFontSize <=0) dynamicFontSize = minDynamicFontSize;


        // Adjust font size if text overflows (simplified check)
        const valTextWidth = estimateTextWidth(valueText, fillStyle.typography.valueFontFamily, `${dynamicFontSize}px`, fillStyle.typography.valueFontWeight);
        const catTextWidth = estimateTextWidth(categoryText, fillStyle.typography.categoryFontFamily, `${dynamicFontSize}px`, fillStyle.typography.categoryFontWeight);
        
        const maxValTextY = categoryText ? (textAreaStartY + textAreaHeight * 0.7) : (textAreaStartY + textAreaHeight * 0.5);
        const maxCatTextY = textAreaStartY + textAreaHeight * 0.3;

        const valMaxWidth = getChordLength(currentRadius, Math.abs(maxValTextY)) * 0.9;
        const catMaxWidth = categoryText ? getChordLength(currentRadius, Math.abs(maxCatTextY)) * 0.9 : 0;

        if (valTextWidth > valMaxWidth || (categoryText && catTextWidth > catMaxWidth)) {
            const valRatio = valTextWidth > 0 ? valMaxWidth / valTextWidth : 1;
            const catRatio = (categoryText && catTextWidth > 0) ? catMaxWidth / catTextWidth : 1;
            dynamicFontSize = Math.max(minDynamicFontSize, dynamicFontSize * Math.min(valRatio, catRatio));
        }
        if (isNaN(dynamicFontSize) || dynamicFontSize <=0) dynamicFontSize = minDynamicFontSize;


        // Render Icon
        if (dNode.iconUrl && finalIconSize > minIconSize / 2 && finalIconSize < currentRadius * 2) { // Ensure icon is reasonably sized
            groupElement.append("image")
                .attr("class", "icon image-icon")
                .attr("xlink:href", dNode.iconUrl)
                .attr("width", finalIconSize)
                .attr("height", finalIconSize)
                .attr("x", -finalIconSize / 2)
                .attr("y", iconTopY)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

        // Render Category Text
        let categoryLabelActualHeight = 0;
        if (categoryText && dynamicFontSize >= minDynamicFontSize) {
            const categoryLabelY = textAreaStartY;
            const catLabelElement = groupElement.append("text")
                .attr("class", "label category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging") // Align top of text to Y
                .attr("y", categoryLabelY)
                .style("fill", adaptiveTextColor)
                .style("font-family", fillStyle.typography.categoryFontFamily)
                .style("font-weight", fillStyle.typography.categoryFontWeight)
                .style("font-size", `${dynamicFontSize}px`)
                .style("pointer-events", "none");

            // Text wrapping for category
            const words = categoryText.split(/\s+/);
            let currentLineText = "";
            let lines = [];
            const effectiveCatMaxWidth = getChordLength(currentRadius, Math.abs(categoryLabelY + dynamicFontSize / 2)) * 0.9; // Max width at this Y

            if (words.length === 1 && estimateTextWidth(words[0], fillStyle.typography.categoryFontFamily, `${dynamicFontSize}px`, fillStyle.typography.categoryFontWeight) > effectiveCatMaxWidth) {
                // Single word, too long, attempt character wrapping
                const chars = categoryText.split('');
                let charLine = '';
                for (const char of chars) {
                    if (estimateTextWidth(charLine + char, fillStyle.typography.categoryFontFamily, `${dynamicFontSize}px`, fillStyle.typography.categoryFontWeight) > effectiveCatMaxWidth && charLine) {
                        lines.push(charLine);
                        charLine = char;
                    } else {
                        charLine += char;
                    }
                }
                if (charLine) lines.push(charLine);
            } else { // Word wrapping
                 for (const word of words) {
                    if (estimateTextWidth(currentLineText + (currentLineText ? " " : "") + word, fillStyle.typography.categoryFontFamily, `${dynamicFontSize}px`, fillStyle.typography.categoryFontWeight) > effectiveCatMaxWidth && currentLineText) {
                        lines.push(currentLineText);
                        currentLineText = word;
                    } else {
                        currentLineText += (currentLineText ? " " : "") + word;
                    }
                }
                if (currentLineText) lines.push(currentLineText);
            }
            
            if (lines.length > 3) lines = lines.slice(0,3); // Limit to 3 lines max

            lines.forEach((line, i) => {
                catLabelElement.append("tspan")
                    .attr("x", 0)
                    .attr("dy", i === 0 ? 0 : `${1 + categoryLabelLineHeightFactor}em`)
                    .text(line);
            });
            categoryLabelActualHeight = lines.length * dynamicFontSize * (1 + categoryLabelLineHeightFactor) - (dynamicFontSize * categoryLabelLineHeightFactor); // Approximate height
        }
        
        // Render Value Text
        if (dynamicFontSize >= minDynamicFontSize) {
            const valueLabelY = categoryText && categoryLabelActualHeight > 0 ? 
                                (textAreaStartY + categoryLabelActualHeight + dynamicFontSize * 0.2) : // Below category
                                (textAreaStartY + (textAreaHeight - dynamicFontSize) / 2) ; // Centered if no category or category not rendered

            if (valueLabelY + dynamicFontSize < textAreaEndY) { // Check if value text fits vertically
                 groupElement.append("text")
                    .attr("class", "label value-label")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .attr("y", valueLabelY)
                    .style("fill", adaptiveTextColor)
                    .style("font-family", fillStyle.typography.valueFontFamily)
                    .style("font-weight", fillStyle.typography.valueFontWeight)
                    .style("font-size", `${dynamicFontSize}px`)
                    .style("pointer-events", "none")
                    .text(valueText);
            }
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}