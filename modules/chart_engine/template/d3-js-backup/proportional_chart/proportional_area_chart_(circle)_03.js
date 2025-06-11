/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle)",
  "chart_name": "proportional_area_chart_circle_03",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 8]],
  "required_fields_icons": [],
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
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawData = data.data;
    const chartDataArray = rawData.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming data.colors, not data.colors_dark
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = rawData.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xCol = dataColumns.find(c => c.role === "x");
    const yCol = dataColumns.find(c => c.role === "y");
    const groupCol = dataColumns.find(c => c.role === "group");

    const xField = xCol?.name;
    const yField = yCol?.name;
    const groupField = groupCol?.name;

    if (!xField || !yField || !groupField) {
        const missingFields = [];
        if (!xField) missingFields.push("xField (role: 'x')");
        if (!yField) missingFields.push("yField (role: 'y')");
        if (!groupField) missingFields.push("groupField (role: 'group')");
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const yUnit = yCol?.unit === "none" ? "" : yCol?.unit ?? "";
    const chartData = chartDataArray.filter(d => d[yField] != null && +d[yField] > 0);

    if (chartData.length === 0) {
        const errorMessage = "No valid data points to render.";
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding: 20px;'>${errorMessage}</div>`);
        }
        return null;
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            legendTitleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            legendTitleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '14px',
            legendTitleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',

            legendItemFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            legendItemFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            legendItemFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',

            dataLabelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            dataLabelBaseFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '16px', // Base for large labels
            dataLabelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold',

            dataValueFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            dataValueBaseFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '14px', // Base for values
            dataValueFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'bold',
            
            externalLabelFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            externalLabelFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '11px',
            externalLabelFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#0f223b',
        backgroundColor: colors.background_color || '#FFFFFF',
        defaultCategoryColors: d3.schemeCategory10,
        circleStrokeColor: 'rgba(255,255,255,0.7)',
        externalLabelColor: '#333333',
    };

    fillStyle.getColorByCategory = (category, index) => {
        if (colors.field && colors.field[category]) {
            return colors.field[category];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[index % colors.available_colors.length];
        }
        return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
    };
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize); // fontSize should be a string like '12px'
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // No need to append to DOM. getBBox should work on unattached elements for most browsers.
        // If issues, could briefly append to a hidden div, measure, then remove.
        // However, for robustness and to avoid potential browser quirks with unattached SVGs:
        // document.body.appendChild(svg); // Temporarily append
        // const width = textElement.getBBox().width;
        // document.body.removeChild(svg); // Clean up
        // return width;
        // Simpler approach if getBBox on detached works:
        try {
            return textElement.getBBox().width;
        } catch (e) { // Fallback for environments where getBBox might fail on detached elements
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = `${fontWeight || 'normal'} ${fontSize} ${fontFamily || 'Arial'}`;
            return context.measureText(text).width;
        }
    }

    function getColorBrightness(colorStr) {
        const color = d3.rgb(colorStr); // Handles various color string formats
        return (color.r * 0.299 + color.g * 0.587 + color.b * 0.114) / 255;
    }

    function getTextColorForBackground(bgColor) {
        const brightness = getColorBrightness(bgColor);
        // Use fillStyle.textColor as one option, and a contrasting version for the other.
        // For simplicity, using black/white as in original.
        return brightness > 0.6 ? '#000000' : '#FFFFFF';
    }

    function formatValue(value) {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        if (value >= 100) return value.toFixed(0);
        if (value >= 10) return value.toFixed(1);
        return value.toFixed(2);
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 900;
    const containerHeight = variables.height || 700;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.backgroundColor)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 20, bottom: 20, left: 20 }; // Initial top margin
    let innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    let innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const maxTotalCircleArea = innerWidth * innerHeight * 0.35; // 35% of drawable area
    const MIN_RADIUS = 10;
    const MAX_RADIUS = Math.min(innerHeight, innerWidth) * 0.3;

    // Thresholds for text display strategies
    const LARGE_CIRCLE_THRESHOLD_RADIUS = 40;
    const MEDIUM_CIRCLE_THRESHOLD_RADIUS = 25;

    // Block 5: Data Preprocessing & Transformation
    const uniqueGroups = [...new Set(chartData.map(d => d[groupField]))];
    
    const initialRadiusScale = d3.scaleSqrt()
        .domain([d3.min(chartData, d => +d[yField]) || 0, d3.max(chartData, d => +d[yField]) || 1])
        .range([20, 150]);

    let nodesData = chartData.map((d, i) => {
        const radius = initialRadiusScale(+d[yField]);
        return {
            id: d[xField] != null ? String(d[xField]) : `__node_${i}__`,
            label: String(d[xField]),
            value: +d[yField],
            group: d[groupField],
            color: fillStyle.getColorByCategory(d[groupField], uniqueGroups.indexOf(d[groupField])),
            radius: radius,
            area: Math.PI * radius * radius
        };
    }).sort((a, b) => b.radius - a.radius);

    const initialTotalArea = d3.sum(nodesData, d => d.area);
    if (initialTotalArea > maxTotalCircleArea && initialTotalArea > 0) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodesData.forEach(node => {
            node.radius *= areaRatio;
            node.area = Math.PI * node.radius * node.radius;
        });
    }

    nodesData.forEach(node => {
        node.radius = Math.max(MIN_RADIUS, Math.min(node.radius, MAX_RADIUS));
        node.area = Math.PI * node.radius * node.radius;
    });

    // Block 6: Scale Definition & Configuration
    // colorScale is implicitly handled by node.color assignment above.
    // radiusScale is implicitly handled by node.radius assignment and adjustments.

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, 20)`); // Position legend 20px from SVG top

    const legendTitleText = groupCol?.description || "Categories";
    const legendTitle = legendGroup.append("text")
        .attr("class", "text legend-title")
        .attr("x", 0)
        .attr("y", 0) // Adjusted y; items will be below
        .attr("font-family", fillStyle.typography.legendTitleFontFamily)
        .attr("font-size", fillStyle.typography.legendTitleFontSize)
        .attr("font-weight", fillStyle.typography.legendTitleFontWeight)
        .attr("fill", fillStyle.textColor)
        .text(legendTitleText);
    
    const legendTitleBBox = legendTitle.node().getBBox();
    let currentLegendX = 0;
    let currentLegendY = legendTitleBBox.height + 5; // Start items below title
    const legendItemHeight = Math.max(15, parseInt(fillStyle.typography.legendItemFontSize) + 5);
    const legendPadding = { h: 10, v: 5 };
    const legendSymbolSize = 8;

    uniqueGroups.forEach((group, i) => {
        const itemColor = fillStyle.getColorByCategory(group, uniqueGroups.indexOf(group));
        const itemText = String(group);
        
        const textWidth = estimateTextWidth(itemText, fillStyle.typography.legendItemFontFamily, fillStyle.typography.legendItemFontSize, fillStyle.typography.legendItemFontWeight);
        const itemWidth = legendSymbolSize * 2 + 5 + textWidth + legendPadding.h;

        if (currentLegendX + itemWidth > innerWidth && currentLegendX > 0) {
            currentLegendX = 0;
            currentLegendY += legendItemHeight + legendPadding.v;
        }

        const legendItemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, ${currentLegendY})`);

        legendItemGroup.append("circle")
            .attr("class", "mark legend-symbol")
            .attr("cx", legendSymbolSize)
            .attr("cy", -legendSymbolSize / 2 + legendItemHeight / 2 - legendPadding.v/2) // Vertically center symbol with text
            .attr("r", legendSymbolSize)
            .attr("fill", itemColor);

        legendItemGroup.append("text")
            .attr("class", "text legend-label")
            .attr("x", legendSymbolSize * 2 + 5)
            .attr("y", legendItemHeight / 2 - legendPadding.v/2) // Vertically center text
            .attr("dy", "0.35em") // Fine-tune vertical alignment
            .attr("font-family", fillStyle.typography.legendItemFontFamily)
            .attr("font-size", fillStyle.typography.legendItemFontSize)
            .attr("font-weight", fillStyle.typography.legendItemFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(itemText);
        
        currentLegendX += itemWidth;
    });
    
    const legendBBox = legendGroup.node().getBBox();
    const legendHeight = legendBBox.height;
    // Adjust top margin if legend is taller than initial allocation, or recalculate innerHeight
    // For simplicity, we assume legend fits within initial margin or overflows slightly.
    // More robust: chartMargins.top = Math.max(chartMargins.top, 20 + legendHeight + 10);
    // innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    // Calculate protected area based on legend position and height
    // Legend is at absolute Y=20. Its bottom is at 20 + legendHeight.
    // mainChartGroup is at absolute Y=chartMargins.top.
    // So, the Y coordinate in mainChartGroup that corresponds to legend bottom is (20 + legendHeight) - chartMargins.top.
    const legendBottomInMainChartGroupCoords = (20 + legendHeight) - chartMargins.top;
    const TOP_PROTECTED_Y_LIMIT = Math.max(0, legendBottomInMainChartGroupCoords) + 5; // Add 5px padding

    // Block 8: Main Data Visualization Rendering
    const simulation = d3.forceSimulation()
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2 + 10).strength(0.03))
        .force("charge", d3.forceManyBody().strength(-15))
        .force("collide", d3.forceCollide().radius(d => d.radius + 8).strength(0.95))
        .stop();

    if (nodesData.length > 0) {
        nodesData[0].fx = innerWidth * 0.5;
        nodesData[0].fy = innerHeight * 0.5 + 10;
    }
    if (nodesData.length > 1) {
        const angle_step = 2 * Math.PI / (nodesData.length - 1);
        let radius_step = Math.min(innerWidth, innerHeight) * 0.15;
        let current_radius_spiral = radius_step;
        
        for (let i = 1; i < nodesData.length; i++) {
            const angle = i * angle_step;
            let posX = innerWidth / 2 + current_radius_spiral * Math.cos(angle);
            let posY = innerHeight / 2 + current_radius_spiral * Math.sin(angle) + 20;
            
            if (posY - nodesData[i].radius < TOP_PROTECTED_Y_LIMIT) {
                 posY = TOP_PROTECTED_Y_LIMIT + nodesData[i].radius + 10;
            }
            nodesData[i].x = posX;
            nodesData[i].y = posY;
            if (i % 5 === 0) current_radius_spiral += radius_step;
        }
    }

    simulation.nodes(nodesData);

    const MIN_ITERATIONS = 150;
    for (let i = 0; i < MIN_ITERATIONS; ++i) {
        simulation.tick();
        nodesData.forEach(d => {
            if (!d.fx) { // Don't constrain fixed nodes
                d.x = Math.max(d.radius + 5, Math.min(innerWidth - d.radius - 5, d.x));
            }
            // Apply y constraints, respecting fixed y (fy) and protected area
            if (!d.fy) {
                 d.y = Math.max(TOP_PROTECTED_Y_LIMIT + d.radius + 5, Math.min(innerHeight - d.radius - 5, d.y));
            } else { // If fy is set, still ensure it's within bounds
                 d.y = Math.max(TOP_PROTECTED_Y_LIMIT + d.radius + 5, Math.min(innerHeight - d.radius - 5, d.fy));
            }

            // Ensure fixed nodes also respect boundaries
            if (d.fx) d.x = Math.max(d.radius + 5, Math.min(innerWidth - d.radius - 5, d.fx));
            if (d.fy) d.y = Math.max(TOP_PROTECTED_Y_LIMIT + d.radius + 5, Math.min(innerHeight - d.radius - 5, d.fy));
        });
    }
    
    const nodeElementsG = mainChartGroup.selectAll("g.node-element")
        .data(nodesData, d => d.id)
        .join("g")
        .attr("class", "node-element")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    nodeElementsG.append("circle")
        .attr("class", "mark bubble-circle")
        .attr("r", d => d.radius)
        .attr("fill", d => d.color)
        .attr("stroke", fillStyle.circleStrokeColor)
        .attr("stroke-width", d => Math.min(2, d.radius * 0.05));

    function fitTextToWidth(text, maxWidth, fontFamily, baseFontSizeStr, fontWeight, minFontSize = 8) {
        let currentFontSize = parseInt(baseFontSizeStr);
        let fittedText = text;
        
        let textMetricsWidth = estimateTextWidth(fittedText, fontFamily, `${currentFontSize}px`, fontWeight);

        while (textMetricsWidth > maxWidth && currentFontSize > minFontSize) {
            currentFontSize = Math.max(minFontSize, currentFontSize - 1);
            textMetricsWidth = estimateTextWidth(fittedText, fontFamily, `${currentFontSize}px`, fontWeight);
        }
        
        if (textMetricsWidth > maxWidth && currentFontSize === minFontSize) { // Still too wide, truncate
            while (estimateTextWidth(fittedText + "...", fontFamily, `${minFontSize}px`, fontWeight) > maxWidth && fittedText.length > 0) {
                fittedText = fittedText.slice(0, -1);
            }
            fittedText += "...";
        }
        return { text: fittedText, fontSize: `${currentFontSize}px` };
    }

    nodeElementsG.each(function(d) {
        const node = d3.select(this);
        const radius = d.radius;
        const textColor = getTextColorForBackground(d.color);
        const formattedValueText = formatValue(d.value) + yUnit;

        const circleSizeType = radius < MEDIUM_CIRCLE_THRESHOLD_RADIUS ? "small" :
                             radius < LARGE_CIRCLE_THRESHOLD_RADIUS ? "medium" : "large";

        if (circleSizeType === "small") {
            if (radius >= MEDIUM_CIRCLE_THRESHOLD_RADIUS * 0.8) { // Show value if somewhat visible
                const valueFontSize = Math.min(radius / 2, parseInt(fillStyle.typography.dataValueBaseFontSize) * 0.7);
                if (valueFontSize >= 6) { // Min practical size
                    node.append("text")
                        .attr("class", "text value data-value-small")
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .attr("fill", textColor)
                        .style("font-family", fillStyle.typography.dataValueFontFamily)
                        .style("font-size", `${Math.floor(valueFontSize)}px`)
                        .style("font-weight", fillStyle.typography.dataValueFontWeight)
                        .text(formattedValueText);
                }
            }
            // External label for small circles
            mainChartGroup.append("text") // Append to mainChartGroup for absolute positioning relative to circle center
                .attr("class", "text label data-label-external")
                .attr("text-anchor", "middle")
                .attr("x", d.x)
                .attr("y", d.y + d.radius + parseInt(fillStyle.typography.externalLabelFontSize)) // Position below circle
                .attr("fill", fillStyle.externalLabelColor)
                .style("font-family", fillStyle.typography.externalLabelFontFamily)
                .style("font-size", fillStyle.typography.externalLabelFontSize)
                .style("font-weight", fillStyle.typography.externalLabelFontWeight)
                .text(d.label);

        } else if (circleSizeType === "medium") {
            const valueFontSize = Math.min(radius / 2, parseInt(fillStyle.typography.dataValueBaseFontSize) * 0.85);
             if (valueFontSize >= 7) {
                node.append("text")
                    .attr("class", "text value data-value-medium")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", textColor)
                    .style("font-family", fillStyle.typography.dataValueFontFamily)
                    .style("font-size", `${Math.floor(valueFontSize)}px`)
                    .style("font-weight", fillStyle.typography.dataValueFontWeight)
                    .text(formattedValueText);
            }
            // External label for medium circles
            mainChartGroup.append("text")
                .attr("class", "text label data-label-external")
                .attr("text-anchor", "middle")
                .attr("x", d.x)
                .attr("y", d.y + d.radius + parseInt(fillStyle.typography.externalLabelFontSize))
                .attr("fill", fillStyle.externalLabelColor)
                .style("font-family", fillStyle.typography.externalLabelFontFamily)
                .style("font-size", fillStyle.typography.externalLabelFontSize)
                .style("font-weight", fillStyle.typography.externalLabelFontWeight)
                .text(d.label);

        } else { // Large circle
            const maxTextWidth = radius * 1.6; // Max width for label text
            const fittedLabel = fitTextToWidth(d.label, maxTextWidth, 
                fillStyle.typography.dataLabelFontFamily, 
                fillStyle.typography.dataLabelBaseFontSize, 
                fillStyle.typography.dataLabelFontWeight,
                8 // min font size for label
            );

            node.append("text")
                .attr("class", "text label data-label-large")
                .attr("text-anchor", "middle")
                .attr("y", -radius * 0.15) // Position label slightly above center
                .attr("fill", textColor)
                .style("font-family", fillStyle.typography.dataLabelFontFamily)
                .style("font-size", fittedLabel.fontSize)
                .style("font-weight", fillStyle.typography.dataLabelFontWeight)
                .text(fittedLabel.text);

            const valueBaseSize = parseInt(fillStyle.typography.dataValueBaseFontSize);
            const actualValueFontSize = Math.min(parseInt(fittedLabel.fontSize) * 0.9, valueBaseSize, radius * 0.35);
            
            if (actualValueFontSize >= 7) {
                node.append("text")
                    .attr("class", "text value data-value-large")
                    .attr("text-anchor", "middle")
                    .attr("y", radius * 0.25) // Position value slightly below center
                    .attr("fill", textColor)
                    .style("font-family", fillStyle.typography.dataValueFontFamily)
                    .style("font-size", `${Math.floor(actualValueFontSize)}px`)
                    .style("font-weight", fillStyle.typography.dataValueFontWeight)
                    .text(formattedValueText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Gradients, shadows, and complex effects were removed as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}