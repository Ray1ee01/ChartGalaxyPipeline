/* REQUIREMENTS_BEGIN
{
  "chart_type": "Voronoi Treemap",
  "chart_name": "voronoi_treemap_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 40], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
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
    // (The /* REQUIREMENTS_BEGIN... */ block is external to the function)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Could be data.colors_dark for dark themes, assuming data.colors is primary
    const images = data.images || {}; // Not used in this chart, but extracted for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    if (!categoryColumn || !categoryColumn.name) {
        console.error("Critical chart config missing: Category field (role 'x') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Category field (role 'x') configuration is missing.</div>");
        return null;
    }
    if (!valueColumn || !valueColumn.name) {
        console.error("Critical chart config missing: Value field (role 'y') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Value field (role 'y') configuration is missing.</div>");
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: {} // For consistency, though not used here
    };

    // Typography
    fillStyle.typography.categoryLabelFontFamily = (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif';
    fillStyle.typography.categoryLabelFontSize = (typography.label && typography.label.font_size) ? typography.label.font_size : '16px';
    fillStyle.typography.categoryLabelFontWeight = (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold';

    fillStyle.typography.valueLabelFontFamily = (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif';
    fillStyle.typography.valueLabelFontSize = (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '14px';
    fillStyle.typography.valueLabelFontWeight = (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal';
    
    // Colors
    fillStyle.chartBackground = colors.background_color || '#FFFFFF'; // Default to white if not provided
    fillStyle.defaultTextColor = colors.text_color || '#0f223b'; // General text color

    fillStyle.cellFillOpacity = 0.8;
    fillStyle.cellStroke = 'none';
    fillStyle.labelTextFill = '#FFFFFF'; // Labels inside cells are white for contrast
    fillStyle.labelValueOpacity = 0.7;
    fillStyle.labelBackgroundFill = 'rgba(0,0,0,0.3)';
    fillStyle.labelBackgroundRx = 3;
    fillStyle.defaultCellColor = '#CCCCCC';

    const uniqueCategories = [...new Set(chartDataInput.map(d => d[categoryFieldName]))];
    const categoryColorMap = {};
    uniqueCategories.forEach((cat, i) => {
        if (colors.field && colors.field[cat]) {
            categoryColorMap[cat] = colors.field[cat];
        } else if (colors.available_colors && colors.available_colors.length > 0) {
            categoryColorMap[cat] = colors.available_colors[i % colors.available_colors.length];
        } else {
            categoryColorMap[cat] = d3.schemeCategory10[i % d3.schemeCategory10.length];
        }
    });

    fillStyle.getCellColor = (category) => categoryColorMap[category] || fillStyle.defaultCellColor;
    
    // In-memory text measurement utility (not strictly needed for this chart's label fitting, but good practice)
    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontProps.fontFamily);
        textNode.setAttribute('font-size', fontProps.fontSize);
        textNode.setAttribute('font-weight', fontProps.fontWeight);
        textNode.textContent = text;
        svg.appendChild(textNode);
        // Note: Appending to body and then removing is more reliable for getBBox if not using canvas.
        // However, for this specific directive, it must not be appended to DOM.
        // getComputedTextLength() on an unattached element might be less reliable or return 0.
        // For this chart, text fitting happens on attached elements, so this helper is more for general use.
        // A common workaround is to temporarily append, measure, and remove, but the directive forbids DOM append.
        // For this specific chart, we use getComputedTextLength on already rendered elements.
        try {
            return textNode.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails on unattached element
            return text.length * (parseInt(fontProps.fontSize, 10) * 0.6); // Rough estimate
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const numberFormatter = d3.format(",d");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 10, right: 10, bottom: 10, left: 10 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataInput.map(d => ({
        name: d[categoryFieldName],
        weight: +d[valueFieldName] || 0 // Ensure weight is a number
    })).filter(d => d.weight > 0); // Voronoi simulation requires positive weights

    if (processedData.length === 0) {
        console.warn("No valid data with positive weights to render for Voronoi Treemap.");
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.categoryLabelFontFamily)
            .attr("font-size", fillStyle.typography.categoryLabelFontSize)
            .attr("fill", fillStyle.defaultTextColor)
            .text("No data to display.");
        return svgRoot.node();
    }
    
    const clipPolygon = [
        [0, 0],
        [0, innerHeight],
        [innerWidth, innerHeight],
        [innerWidth, 0]
    ];

    // Check for d3.voronoiMapSimulation availability
    if (typeof d3.voronoiMapSimulation !== 'function') {
        console.error("d3.voronoiMapSimulation is not available. Please include the d3-voronoi-map-tween library.");
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "red")
            .text("Error: Voronoi library not found.");
        return svgRoot.node();
    }
    
    const voronoiSimulation = d3.voronoiMapSimulation(processedData)
        .weight(d => d.weight)
        .clip(clipPolygon)
        .stop();

    let simulationState = voronoiSimulation.state();
    while (simulationState && !simulationState.ended) {
        voronoiSimulation.tick();
        simulationState = voronoiSimulation.state();
    }
    
    const voronoiPolygons = simulationState ? simulationState.polygons : [];

    // Block 6: Scale Definition & Configuration
    // Color scale is handled by fillStyle.getCellColor

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type (no axes, gridlines, legend)

    // Block 8: Main Data Visualization Rendering
    const cellGroups = mainChartGroup.selectAll("g.mark-cell")
        .data(voronoiPolygons)
        .enter()
        .append("g")
        .attr("class", "mark mark-cell");

    cellGroups.append("path")
        .attr("class", "mark-path")
        .attr("d", d => "M" + d.join("L") + "Z")
        .attr("fill", d => fillStyle.getCellColor(d.site.originalObject.data.originalData.name))
        .attr("fill-opacity", fillStyle.cellFillOpacity)
        .attr("stroke", fillStyle.cellStroke);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    
    // Category Labels
    cellGroups.append("text")
        .attr("class", "label category-label")
        .attr("x", d => d3.polygonCentroid(d)[0])
        .attr("y", d => d3.polygonCentroid(d)[1])
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.labelTextFill)
        .attr("font-family", fillStyle.typography.categoryLabelFontFamily)
        .attr("font-size", fillStyle.typography.categoryLabelFontSize)
        .attr("font-weight", fillStyle.typography.categoryLabelFontWeight)
        .text(d => d.site.originalObject.data.originalData.name)
        .each(function(d) {
            const textElement = d3.select(this);
            const polygonPoints = d; // d is the array of points for the polygon
            
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            polygonPoints.forEach(point => {
                minX = Math.min(minX, point[0]);
                minY = Math.min(minY, point[1]);
                maxX = Math.max(maxX, point[0]);
                maxY = Math.max(maxY, point[1]);
            });
            
            const polygonBBoxWidth = maxX - minX;
            const polygonBBoxHeight = maxY - minY;
            const textWidth = this.getComputedTextLength();

            // Check if text needs background or is too small
            if (textWidth > polygonBBoxWidth * 0.9 || polygonBBoxHeight < (parseFloat(fillStyle.typography.categoryLabelFontSize) * 1.5)) {
                // If text is too wide for the cell's bounding box, or cell is too short
                // Add a background rectangle for better readability
                const parentGroup = d3.select(this.parentNode);
                const centroid = d3.polygonCentroid(polygonPoints);
                const padding = 4;
                const textHeightApproximation = parseFloat(fillStyle.typography.categoryLabelFontSize);


                parentGroup.insert("rect", ":first-child") // Insert rect before the text
                    .attr("class", "label-background")
                    .attr("x", centroid[0] - textWidth / 2 - padding)
                    .attr("y", centroid[1] - textHeightApproximation / 2 - padding)
                    .attr("width", textWidth + padding * 2)
                    .attr("height", textHeightApproximation + padding * 2)
                    .attr("fill", fillStyle.labelBackgroundFill)
                    .attr("rx", fillStyle.labelBackgroundRx);
            }
            if (polygonBBoxWidth < textWidth * 0.5 || polygonBBoxHeight < parseFloat(fillStyle.typography.categoryLabelFontSize)) {
                 // If cell is extremely small, hide the text
                textElement.style("display", "none");
            }
        });

    // Value Labels
    cellGroups.append("text")
        .attr("class", "label value-label")
        .attr("x", d => d3.polygonCentroid(d)[0])
        .attr("y", d => d3.polygonCentroid(d)[1] + parseFloat(fillStyle.typography.categoryLabelFontSize) * 0.8) // Position below category label
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.labelTextFill)
        .attr("fill-opacity", fillStyle.labelValueOpacity)
        .attr("font-family", fillStyle.typography.valueLabelFontFamily)
        .attr("font-size", fillStyle.typography.valueLabelFontSize)
        .attr("font-weight", fillStyle.typography.valueLabelFontWeight)
        .text(d => numberFormatter(d.site.originalObject.data.originalData.weight))
        .each(function(d) {
            const textElement = d3.select(this);
            const polygonPoints = d;
            
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            polygonPoints.forEach(point => {
                minX = Math.min(minX, point[0]);
                minY = Math.min(minY, point[1]);
                maxX = Math.max(maxX, point[0]);
                maxY = Math.max(maxY, point[1]);
            });
            
            const polygonBBoxWidth = maxX - minX;
            const polygonBBoxHeight = maxY - minY;
            const textWidth = this.getComputedTextLength();
            const combinedTextHeight = parseFloat(fillStyle.typography.categoryLabelFontSize) + parseFloat(fillStyle.typography.valueLabelFontSize);

            if (textWidth > polygonBBoxWidth * 0.9 || polygonBBoxHeight < combinedTextHeight * 1.2) {
                textElement.style("display", "none");
            }
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}