/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Voronoi Treemap",
  "chart_name": "voronoi_treemap_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 40], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 300,
  "min_width": 300,
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
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external.
    // This chart relies on the d3-voronoi-map library (d3.voronoiMapSimulation).
    // Ensure this library is loaded before using this function (e.g., by including https://cdn.jsdelivr.net/npm/d3-voronoi-map@2.1.0/dist/d3-voronoi-map.min.js).

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or use data.colors_dark if a theme mechanism is in place
    const images = data.images || {}; // Not used in this chart, but extracted for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    if (!categoryColumn || !categoryColumn.name) {
        console.error("Critical chart config missing: Category field (role 'x') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Category field configuration is missing. Chart cannot be rendered.</div>");
        return null;
    }
    if (!valueColumn || !valueColumn.name) {
        console.error("Critical chart config missing: Value field (role 'y') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Value field configuration is missing. Chart cannot be rendered.</div>");
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: {} // For consistency, though not used here
    };

    // Typography defaults
    const defaultTypographyStyles = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" }, // Not used for chart title
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.cellCategoryNameFontFamily = (typography.label && typography.label.font_family) ? typography.label.font_family : defaultTypographyStyles.label.font_family;
    fillStyle.typography.cellCategoryNameFontSize = (typography.label && typography.label.font_size) ? typography.label.font_size : '14px';
    fillStyle.typography.cellCategoryNameFontWeight = (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold';
    fillStyle.typography.cellCategoryNameMinFontSize = '9px'; 

    fillStyle.typography.cellValueFontFamily = (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : defaultTypographyStyles.annotation.font_family;
    fillStyle.typography.cellValueFontSize = (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px';
    fillStyle.typography.cellValueFontWeight = (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal';
    fillStyle.typography.cellValueMinFontSize = '8px';

    // Color defaults
    fillStyle.textColor = colors.text_color || '#333333'; 
    fillStyle.cellTextPrimaryColor = colors.cell_text_primary_color || '#FFFFFF'; 
    fillStyle.cellTextSecondaryColor = colors.cell_text_secondary_color || '#FFFFFF'; 
    
    fillStyle.chartBackground = colors.background_color || '#FFFFFF';
    fillStyle.defaultCellColor = '#CCCCCC';
    fillStyle.cellFillOpacity = variables.cell_fill_opacity !== undefined ? variables.cell_fill_opacity : 0.9;
    fillStyle.cellValueTextOpacity = variables.cell_value_text_opacity !== undefined ? variables.cell_value_text_opacity : 0.8;

    // In-memory text measurement utility (as per directive, though not directly used for fitting here)
    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Not appending to DOM as per directive. This might lead to inaccuracies in some browsers.
        return tempText.getBBox().width;
    }
    
    const defaultCategoricalColors = d3.schemeCategory10;

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = { top: 10, right: 10, bottom: 10, left: 10 };

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other main-chart-group") // Standardized class
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const radius = Math.min(innerWidth, innerHeight) / 2;
    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;

    const numClipPoints = 60; 
    const clipPolygon = [];
    for (let i = 0; i < numClipPoints; i++) {
        const angle = (i / numClipPoints) * 2 * Math.PI;
        clipPolygon.push([
            centerX + radius * Math.cos(angle),
            centerY + radius * Math.sin(angle)
        ]);
    }

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataArray.map(d => ({
        name: d[categoryFieldName],
        weight: +d[valueFieldName] || 0 
    })).filter(d => d.weight > 0); 

    if (processedData.length === 0) {
        console.warn("No valid data points with positive weight to render for Voronoi Treemap.");
        svgRoot.append("text")
            .attr("class", "text message")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.cellCategoryNameFontFamily)
            .attr("font-size", fillStyle.typography.cellCategoryNameFontSize)
            .attr("fill", fillStyle.textColor)
            .text("No data to display.");
        return svgRoot.node();
    }
    
    // Block 6: Scale Definition & Configuration
    const uniqueCategories = [...new Set(processedData.map(d => d.name))];
    const colorScale = (categoryName) => {
        if (colors.field && colors.field[categoryName]) {
            return colors.field[categoryName];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            const index = uniqueCategories.indexOf(categoryName);
            return colors.available_colors[index % colors.available_colors.length];
        }
        const index = uniqueCategories.indexOf(categoryName);
        return defaultCategoricalColors[index % defaultCategoricalColors.length];
    };

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    if (typeof d3.voronoiMapSimulation !== 'function') {
        console.error("d3.voronoiMapSimulation is not available. Please include the d3-voronoi-map library.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Voronoi library (d3.voronoiMapSimulation) missing. Chart cannot be rendered.</div>");
        return null;
    }

    const simulation = d3.voronoiMapSimulation(processedData)
        .weight(d => d.weight)
        .clip(clipPolygon)
        .stop();

    let state = simulation.state();
    let iterations = 0;
    const maxIterations = variables.max_iterations || 300; 

    while (!state.ended && iterations < maxIterations) {
        simulation.tick();
        state = simulation.state();
        iterations++;
    }
    
    const finalPolygons = state.polygons;

    const cellGroups = mainChartGroup.selectAll("g.cell")
        .data(finalPolygons)
        .enter()
        .append("g")
        .attr("class", "mark cell"); 

    cellGroups.append("path")
        .attr("d", d => "M" + d.join("L") + "Z")
        .attr("fill", d => colorScale(d.site.originalObject.data.name))
        .attr("fill-opacity", fillStyle.cellFillOpacity)
        .attr("stroke", "none");

    // Add category name labels
    cellGroups.append("text")
        .attr("class", "label category-name") 
        .attr("x", d => d3.polygonCentroid(d)[0])
        .attr("y", d => d3.polygonCentroid(d)[1])
        .attr("dy", "-0.2em") 
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-family", fillStyle.typography.cellCategoryNameFontFamily)
        .attr("font-size", fillStyle.typography.cellCategoryNameFontSize)
        .attr("font-weight", fillStyle.typography.cellCategoryNameFontWeight)
        .attr("fill", fillStyle.cellTextPrimaryColor)
        .text(d => d.site.originalObject.data.name)
        .each(function(dPolygon) { // Renamed 'd' to 'dPolygon' to avoid conflict with parent scope 'd' if any
            const textElement = d3.select(this);
            let currentFontSize = parseFloat(textElement.attr("font-size"));
            const minFontSize = parseFloat(fillStyle.typography.cellCategoryNameMinFontSize);
            
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            dPolygon.forEach(point => {
                minX = Math.min(minX, point[0]);
                minY = Math.min(minY, point[1]);
                maxX = Math.max(maxX, point[0]);
                maxY = Math.max(maxY, point[1]);
            });
            const cellWidth = maxX - minX;
            const cellHeight = maxY - minY;

            while (this.getComputedTextLength() > cellWidth * 0.85 && currentFontSize > minFontSize) {
                currentFontSize -= 1;
                textElement.attr("font-size", currentFontSize + "px");
            }
            if (this.getComputedTextLength() > cellWidth * 0.85 || cellHeight < currentFontSize * 1.2) {
                 if (currentFontSize <= minFontSize && this.getComputedTextLength() > cellWidth * 0.9) { 
                    textElement.text(""); 
                 } else if (currentFontSize > minFontSize) {
                    textElement.attr("font-size", minFontSize + "px");
                    if (this.getComputedTextLength() > cellWidth * 0.9) textElement.text("");
                 }
            }
            if (cellWidth < 20 || cellHeight < 15) { // Hide if cell is extremely small
                 textElement.text("");
            }
        });

    // Add value labels
    const valueFormatter = d3.format(variables.value_format || ",.0f"); 
    cellGroups.append("text")
        .attr("class", "value cell-value") 
        .attr("x", d => d3.polygonCentroid(d)[0])
        .attr("y", d => d3.polygonCentroid(d)[1])
        .attr("dy", "0.9em") 
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-family", fillStyle.typography.cellValueFontFamily)
        .attr("font-size", fillStyle.typography.cellValueFontSize)
        .attr("font-weight", fillStyle.typography.cellValueFontWeight)
        .attr("fill", fillStyle.cellTextSecondaryColor)
        .attr("fill-opacity", fillStyle.cellValueTextOpacity)
        .text(d => valueFormatter(d.site.originalObject.data.weight))
        .each(function(dPolygon) {
            const textElement = d3.select(this);
            // Only render value if category name is also rendered (not empty)
            const categoryTextElement = d3.select(this.parentNode).select(".category-name");
            if (categoryTextElement.text() === "") {
                textElement.text("");
                return;
            }

            let currentFontSize = parseFloat(textElement.attr("font-size"));
            const minFontSize = parseFloat(fillStyle.typography.cellValueMinFontSize);

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            dPolygon.forEach(point => {
                minX = Math.min(minX, point[0]);
                minY = Math.min(minY, point[1]);
                maxX = Math.max(maxX, point[0]);
                maxY = Math.max(maxY, point[1]);
            });
            const cellWidth = maxX - minX;
            const cellHeight = maxY - minY;
            // Consider space taken by category label for height check
            const categoryLabelApproxHeight = parseFloat(fillStyle.typography.cellCategoryNameFontSize);


            while (this.getComputedTextLength() > cellWidth * 0.85 && currentFontSize > minFontSize) {
                currentFontSize -= 1;
                textElement.attr("font-size", currentFontSize + "px");
            }
            if (this.getComputedTextLength() > cellWidth * 0.85 || cellHeight < (currentFontSize * 1.2 + categoryLabelApproxHeight * 0.8)) {
                 if (currentFontSize <= minFontSize && this.getComputedTextLength() > cellWidth * 0.9) {
                    textElement.text("");
                 } else if (currentFontSize > minFontSize) {
                    textElement.attr("font-size", minFontSize + "px");
                    if (this.getComputedTextLength() > cellWidth * 0.9) textElement.text("");
                 }
            }
            if (cellWidth < 20 || cellHeight < 25) { 
                 textElement.text("");
            }
        });

    // Block 9: Optional Enhancements & Post-Processing
    // Text fitting is handled in Block 8.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}