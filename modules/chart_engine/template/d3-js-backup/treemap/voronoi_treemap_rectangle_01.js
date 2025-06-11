/* REQUIREMENTS_BEGIN
{
  "chart_type": "Voronoi Treemap",
  "chart_name": "voronoi_treemap_rectangle_01",
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



// Assuming d3.voronoiMapSimulation is available in the environment
// e.g. from <script src="https://cdn.jsdelivr.net/npm/d3-voronoi-map-tween@2.0.1/build/d3-voronoi-map-tween.min.js"></script>
// or import { voronoiMapSimulation } from "d3-voronoi-map-tween";

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Or data.colors_dark, assuming light theme for now
    // const imagesInput = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!categoryFieldDef || !valueFieldDef) {
        const missing = [];
        if (!categoryFieldDef) missing.push("role 'x'");
        if (!valueFieldDef) missing.push("role 'y'");
        const errorMsg = `Critical chart config missing: data columns for ${missing.join(' and ')} not found. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    if (!categoryFieldName || !valueFieldName) {
        const missing = [];
        if (!categoryFieldName) missing.push("name for role 'x'");
        if (!valueFieldName) missing.push("name for role 'y'");
        const errorMsg = `Critical chart config missing: field names for ${missing.join(' and ')} are undefined. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};
    
    const defaultTypography = {
        label: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" }, // For category labels
        annotation: { font_family: "Arial, sans-serif", font_size: "14px", font_weight: "normal" } // For value labels
    };

    fillStyle.typography = {
        label: { // Category labels
            font_family: (typographyInput.label && typographyInput.label.font_family) || defaultTypography.label.font_family,
            font_size: (typographyInput.label && typographyInput.label.font_size) || defaultTypography.label.font_size,
            font_weight: (typographyInput.label && typographyInput.label.font_weight) || defaultTypography.label.font_weight,
        },
        annotation: { // Value labels
            font_family: (typographyInput.annotation && typographyInput.annotation.font_family) || defaultTypography.annotation.font_family,
            font_size: (typographyInput.annotation && typographyInput.annotation.font_size) || defaultTypography.annotation.font_size,
            font_weight: (typographyInput.annotation && typographyInput.annotation.font_weight) || defaultTypography.annotation.font_weight,
        }
    };
    
    fillStyle.defaultTextColor = '#0f223b';
    fillStyle.textColor = colorsInput.text_color || fillStyle.defaultTextColor;
    fillStyle.cellLabelColor = '#FFFFFF'; // Default for labels on colored cells
    fillStyle.cellLabelTextBackground = 'rgba(0,0,0,0.3)'; // Background for crowded labels

    const defaultCategoryColors = d3.schemeTableau10;
    // Memoize unique categories for consistent color mapping if colors.field is not exhaustive
    const uniqueCategoriesPresent = [...new Set(chartData.map(d => d[categoryFieldName]))];

    fillStyle.getCategoryColor = (categoryName) => {
        if (colorsInput.field && colorsInput.field[categoryName]) {
            return colorsInput.field[categoryName];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            const categoryIndex = uniqueCategoriesPresent.indexOf(categoryName);
            return colorsInput.available_colors[Math.max(0, categoryIndex) % colorsInput.available_colors.length];
        }
        const categoryIndex = uniqueCategoriesPresent.indexOf(categoryName);
        return defaultCategoryColors[Math.max(0, categoryIndex) % defaultCategoryColors.length];
    };

    function estimateTextWidth(text, fontSize, fontFamily, fontWeight) {
        if (text === null || typeof text === 'undefined' || String(text).length === 0) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = String(text);
        tempSvg.appendChild(textElement);
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            console.warn("getBBox failed for text measurement:", e);
            width = String(text).length * (parseFloat(fontSize) * 0.6); // Fallback
        }
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg");

    const valueFormatter = d3.format(",d");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 10, right: 10, bottom: 10, left: 10 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const clipPolygon = [
        [0, 0],
        [0, innerHeight],
        [innerWidth, innerHeight],
        [innerWidth, 0]
    ];

    // Block 5: Data Preprocessing & Transformation
    if (chartData.length === 0) {
        mainChartGroup.append("text").attr("class", "label no-data-label")
            .attr("x", innerWidth / 2).attr("y", innerHeight / 2)
            .attr("text-anchor", "middle").attr("fill", fillStyle.textColor)
            .style("font-size", "14px").style("font-family", fillStyle.typography.label.font_family)
            .text("No data available to display.");
        return svgRoot.node();
    }
    
    const processedData = chartData.map(d => ({
        name: d[categoryFieldName],
        weight: +d[valueFieldName] || 0
    })).filter(d => d.weight > 0); // Voronoi simulation typically requires positive weights

    if (processedData.length === 0) {
         mainChartGroup.append("text").attr("class", "label no-data-label")
            .attr("x", innerWidth / 2).attr("y", innerHeight / 2)
            .attr("text-anchor", "middle").attr("fill", fillStyle.textColor)
            .style("font-size", "14px").style("font-family", fillStyle.typography.label.font_family)
            .text("No valid data (with positive weights) to display.");
        return svgRoot.node();
    }

    // Block 6: Scale Definition & Configuration
    // Color scale is effectively fillStyle.getCategoryColor.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering
    if (typeof d3.voronoiMapSimulation !== 'function') {
        const errorMsg = "d3.voronoiMapSimulation is not available. Please include the d3-voronoi-map-tween library. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }
    
    const simulation = d3.voronoiMapSimulation(processedData)
        .weight(d => d.weight)
        .clip(clipPolygon)
        .stop(); // Stop immediately to run synchronously

    let simulationState = simulation.state();
    while (simulationState && !simulationState.ended) {
        simulation.tick();
        simulationState = simulation.state();
    }
    
    if (!simulationState || !simulationState.polygons || simulationState.polygons.length === 0) {
        const errorMsg = "Voronoi simulation failed to produce polygons. Cannot render.";
        console.error(errorMsg);
        mainChartGroup.append("text").attr("class", "label error-label")
            .attr("x", innerWidth / 2).attr("y", innerHeight / 2)
            .attr("text-anchor", "middle").attr("fill", fillStyle.textColor)
            .style("font-size", "14px").style("font-family", fillStyle.typography.label.font_family)
            .text(errorMsg);
        return svgRoot.node();
    }

    const polygons = simulationState.polygons;

    const cellGroups = mainChartGroup.selectAll("g.cell-group")
        .data(polygons)
        .enter()
        .append("g")
        .attr("class", "mark cell-group");

    cellGroups.append("path")
        .attr("class", "mark cell-path")
        .attr("d", d => "M" + d.join("L") + "Z")
        .attr("fill", d => fillStyle.getCategoryColor(d.site.originalObject.data.originalData.name))
        .attr("stroke", "none");

    // Block 9: Optional Enhancements & Post-Processing (Labels)
    cellGroups.each(function(polygonData) {
        const cellGroup = d3.select(this);
        const originalItemData = polygonData.site.originalObject.data.originalData;
        const centroid = d3.polygonCentroid(polygonData);

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        polygonData.forEach(point => {
            minX = Math.min(minX, point[0]);
            minY = Math.min(minY, point[1]);
            maxX = Math.max(maxX, point[0]);
            maxY = Math.max(maxY, point[1]);
        });
        const polygonWidth = maxX - minX;
        const polygonHeight = maxY - minY;

        // Category Label
        const categoryText = String(originalItemData.name);
        const categoryStyle = fillStyle.typography.label;
        const categoryFontSize = parseFloat(categoryStyle.font_size);
        const estimatedCategoryWidth = estimateTextWidth(categoryText, categoryStyle.font_size, categoryStyle.font_family, categoryStyle.font_weight);

        if (estimatedCategoryWidth > 0 && polygonWidth > 5 && polygonHeight > categoryFontSize * 0.5) { // Basic check
            // Condition for background: text too wide OR cell too short (original: height < 30px)
            if (estimatedCategoryWidth > polygonWidth * 0.8 || polygonHeight < categoryFontSize * 1.8) { 
                const padding = 4;
                const textHeightApprox = categoryFontSize * 1.2; // Approximate height of text itself
                cellGroup.append("rect")
                    .attr("class", "other text-background")
                    .attr("x", centroid[0] - estimatedCategoryWidth / 2 - padding)
                    .attr("y", centroid[1] - textHeightApprox / 2 - padding)
                    .attr("width", estimatedCategoryWidth + padding * 2)
                    .attr("height", textHeightApprox + padding * 2)
                    .attr("fill", fillStyle.cellLabelTextBackground)
                    .attr("rx", 3);
            }

            cellGroup.append("text")
                .attr("class", "label category-label")
                .attr("x", centroid[0])
                .attr("y", centroid[1])
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.cellLabelColor)
                .style("font-family", categoryStyle.font_family)
                .style("font-size", categoryStyle.font_size)
                .style("font-weight", categoryStyle.font_weight)
                .text(categoryText);
        }
        
        // Value Label
        const valueText = valueFormatter(originalItemData.weight);
        const valueStyle = fillStyle.typography.annotation;
        const valueFontSize = parseFloat(valueStyle.font_size);
        const estimatedValueWidth = estimateTextWidth(valueText, valueStyle.font_size, valueStyle.font_family, valueStyle.font_weight);
        
        // Condition for hiding: text too wide OR cell too short (original: height < 40px)
        // Also ensure there's enough space below category label
        const showValueLabel = !(estimatedValueWidth > polygonWidth * 0.8 || polygonHeight < valueFontSize * 2.8);

        if (estimatedValueWidth > 0 && showValueLabel && polygonWidth > 5 && polygonHeight > (categoryFontSize + valueFontSize)) {
             cellGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", centroid[0])
                .attr("y", centroid[1] + categoryFontSize * 0.9) // Positioned below category label's center
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle") 
                .attr("fill", fillStyle.cellLabelColor)
                .style("font-family", valueStyle.font_family)
                .style("font-size", valueStyle.font_size)
                .style("font-weight", valueStyle.font_weight)
                .text(valueText);
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}