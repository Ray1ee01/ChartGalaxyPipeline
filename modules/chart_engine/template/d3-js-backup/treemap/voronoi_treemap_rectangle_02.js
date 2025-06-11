/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Voronoi Treemap",
  "chart_name": "voronoi_treemap_rectangle_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
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
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END
*/
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a Voronoi Treemap.
    // Assumes d3.js (v5+ for d3.polygonCentroid, etc.) and d3.voronoiMapSimulation 
    // (from d3-voronoi-map plugin, e.g., https://github.com/Kcnarf/d3-voronoi-map) are available globally.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; 
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    if (!categoryColumn || !categoryColumn.name) {
        console.error("Critical chart config missing: Category field (role 'x') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: Category field configuration is missing.</div>");
        return null;
    }
    if (!valueColumn || !valueColumn.name) {
        console.error("Critical chart config missing: Value field (role 'y') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: Value field configuration is missing.</div>");
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: {}, // Not used directly in fillStyle, but images object is used.
        colors: {}
    };

    // Typography defaults
    const defaultFontFamily = "Arial, sans-serif";
    const defaultFontSize = "12px";
    const defaultFontWeight = "normal";

    // Typography for general labels (if any, not directly used here but good for structure)
    fillStyle.typography.labelFontFamily = (typography.label && typography.label.font_family) || defaultFontFamily;
    fillStyle.typography.labelFontSize = (typography.label && typography.label.font_size) || defaultFontSize;
    fillStyle.typography.labelFontWeight = (typography.label && typography.label.font_weight) || defaultFontWeight;
    
    // Typography for cell category text
    fillStyle.typography.cellCategoryFontFamily = (typography.label && typography.label.font_family) || defaultFontFamily;
    fillStyle.typography.cellCategoryFontSize = '16px'; // Chart-specific default, override for 'label'
    fillStyle.typography.cellCategoryFontWeight = 'bold';   // Chart-specific default, override for 'label'

    // Typography for cell value text
    fillStyle.typography.cellValueFontFamily = (typography.label && typography.label.font_family) || defaultFontFamily;
    fillStyle.typography.cellValueFontSize = '14px';   // Chart-specific default, override for 'label'
    fillStyle.typography.cellValueFontWeight = (typography.label && typography.label.font_weight) || defaultFontWeight; // Use label's weight

    // Colors
    fillStyle.colors.textColor = colors.text_color || "#0f223b"; // General text color
    fillStyle.colors.cellLabelColor = colors.text_color_on_cell || colors.text_color || "#FFFFFF"; // Specific for text on cells
    fillStyle.colors.chartBackground = colors.background_color || "#FFFFFF";
    // Default stroke for cells if not derived from fill:
    // fillStyle.colors.defaultCellStroke = (colors.other && colors.other.stroke_color) || "#CCCCCC";


    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // No need to style tempSvg itself if not appending to DOM.
        
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        
        tempSvg.appendChild(textElement); 
        // Appending to body and removing is most reliable for getBBox, but forbidden by prompt.
        // getBBox on un-rendered element might be inconsistent.
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth using getBBox failed (element might need to be in DOM for accurate measurement):", e);
            // Basic fallback: average char width * length
            width = text.length * (parseFloat(fontSize) * 0.6); 
        }
        return width;
    }
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800; // Default width if not provided
    const containerHeight = variables.height || 600; // Default height if not provided

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.colors.chartBackground)
        .attr("class", "chart-svg"); // Added class to root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 10, right: 10, bottom: 10, left: 10 }; // Minimal margins for treemap
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other"); // Added 'other' class

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataInput.map(d => ({
        name: d[categoryFieldName],
        weight: +d[valueFieldName] || 0 
    })).filter(d => d.weight > 0); // Voronoi treemaps require positive weights

    if (processedData.length === 0) {
        console.warn("No valid data points with positive weight to render after processing.");
        d3.select(containerSelector).html("<div style='color:orange; font-family: sans-serif;'>No data to display (requires items with positive values).</div>");
        return null;
    }
    
    // Block 6: Scale Definition & Configuration
    const uniqueCategoriesForColor = [...new Set(processedData.map(d => d.name))];
    const colorScale = (categoryName) => {
        if (colors.field && colors.field[categoryName]) {
            return colors.field[categoryName];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            const index = uniqueCategoriesForColor.indexOf(categoryName);
            return colors.available_colors[index % colors.available_colors.length];
        }
        // Fallback to d3.schemeCategory10 if no colors provided
        const index = uniqueCategoriesForColor.indexOf(categoryName);
        return d3.schemeCategory10[index % d3.schemeCategory10.length];
    };

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering
    if (typeof d3.voronoiMapSimulation !== 'function') {
        console.error("d3.voronoiMapSimulation is not available. Please include the d3-voronoi-map plugin.");
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: Chart library (d3-voronoi-map) not loaded.</div>");
        return null;
    }

    const clipPolygon = [ // Defines the rectangular boundary for the Voronoi cells
        [0, 0],
        [0, chartHeight],
        [chartWidth, chartHeight],
        [chartWidth, 0]
    ];

    const simulation = d3.voronoiMapSimulation(processedData)
        .weight(d => d.weight)
        .clip(clipPolygon)
        .stop(); // Stop simulation for synchronous run

    // Run simulation ticks until it ends
    let simulationState = simulation.state();
    while (simulationState && !simulationState.ended) {
        simulation.tick();
        simulationState = simulation.state();
    }
    
    if (!simulationState || !simulationState.polygons || simulationState.polygons.length === 0) {
        console.error("Voronoi simulation did not produce polygons or produced empty polygons.");
        // This can happen if data is problematic (e.g., too few points, extreme weight differences)
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: Could not generate Voronoi polygons. Check data.</div>");
        return null;
    }
    const polygons = simulationState.polygons;

    const cellsGroup = mainChartGroup.selectAll("g.cell")
        .data(polygons)
        .enter()
        .append("g")
        .attr("class", d => `cell mark ${String(d.site.originalObject.data.name).replace(/\s+/g, '-').toLowerCase()}`); // Class per category

    cellsGroup.append("path")
        .attr("d", d => "M" + d.join("L") + "Z") // d is the array of points for the polygon
        .attr("fill", d => colorScale(d.site.originalObject.data.name))
        .attr("stroke", d => {
            const cellColor = colorScale(d.site.originalObject.data.name);
            // Make stroke slightly darker than fill for better definition
            return d3.color(cellColor) ? d3.color(cellColor).darker(0.7) : fillStyle.colors.defaultCellStroke || "#000000";
        })
        .attr("stroke-width", 1.5);

    const valueFormatter = d3.format(",.0f"); // Format for integer display

    // Block 9: Optional Enhancements & Post-Processing
    cellsGroup.each(function(polygonData) { // polygonData is each item from 'polygons'
        const cellElement = d3.select(this);
        const points = polygonData; // The array of [x,y] points defining the polygon
        const originalItem = polygonData.site.originalObject.data; // Access {name: ..., weight: ...}
        const categoryName = originalItem.name;
        const value = originalItem.weight;

        // Calculate polygon bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach(point => {
            minX = Math.min(minX, point[0]);
            minY = Math.min(minY, point[1]);
            maxX = Math.max(maxX, point[0]);
            maxY = Math.max(maxY, point[1]);
        });
        const polygonBBoxWidth = maxX - minX;
        const polygonBBoxHeight = maxY - minY;
        
        const centroid = d3.polygonCentroid(points);
        if (isNaN(centroid[0]) || isNaN(centroid[1])) return; // Skip if centroid is invalid

        const iconSize = 32;
        const imageUrl = images.field && images.field[categoryName] ? images.field[categoryName] : null;

        // Try to place icon if available and space permits
        if (imageUrl && polygonBBoxWidth >= iconSize && polygonBBoxHeight >= iconSize + 40) { // Min height for icon + some text
            cellElement.append("image")
                .attr("xlink:href", imageUrl)
                .attr("x", centroid[0] - iconSize / 2)
                .attr("y", centroid[1] - 15 - iconSize / 2) // Icon centered at (centroidX, centroidY - 15)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("class", "icon image");
        }
        
        // Add Category Text Label
        const categoryTextY = centroid[1] + 20; // Position below centroid, as in original
        const categoryTextElement = cellElement.append("text")
            .attr("class", "label category-label text")
            .attr("x", centroid[0])
            .attr("y", categoryTextY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.cellCategoryFontFamily)
            .attr("font-size", fillStyle.typography.cellCategoryFontSize)
            .attr("font-weight", fillStyle.typography.cellCategoryFontWeight)
            .attr("fill", fillStyle.colors.cellLabelColor)
            .text(categoryName);
        
        const textWidthCategory = estimateTextWidth(categoryName, 
            fillStyle.typography.cellCategoryFontFamily, 
            fillStyle.typography.cellCategoryFontSize, 
            fillStyle.typography.cellCategoryFontWeight
        );

        // Hide category text if too wide or cell too short
        if (textWidthCategory > polygonBBoxWidth * 0.9 || polygonBBoxHeight < 30) {
            categoryTextElement.style("display", "none");
        }

        // Add Value Text Label
        const valueTextY = centroid[1] + 35; // Position further below centroid
        const valueTextElement = cellElement.append("text")
            .attr("class", "value value-label text")
            .attr("x", centroid[0])
            .attr("y", valueTextY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.cellValueFontFamily)
            .attr("font-size", fillStyle.typography.cellValueFontSize)
            .attr("font-weight", fillStyle.typography.cellValueFontWeight)
            .attr("fill", fillStyle.colors.cellLabelColor) // Use same color, maybe with opacity
            .attr("fill-opacity", 0.85) // Make slightly less prominent
            .text(valueFormatter(value));

        const textWidthValue = estimateTextWidth(valueFormatter(value),
            fillStyle.typography.cellValueFontFamily,
            fillStyle.typography.cellValueFontSize,
            fillStyle.typography.cellValueFontWeight
        );
        
        // Hide value text if too wide, cell too short, or category text is hidden
        if (textWidthValue > polygonBBoxWidth * 0.9 || polygonBBoxHeight < 40 || categoryTextElement.style("display") === "none") {
            valueTextElement.style("display", "none");
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}