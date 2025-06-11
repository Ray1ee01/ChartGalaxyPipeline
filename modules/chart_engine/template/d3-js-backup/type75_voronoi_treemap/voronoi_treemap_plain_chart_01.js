/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Voronoi Treemap",
    "chart_name": "voronoi_treemap_plain_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "hierarchy": [],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[5, 40], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
    "min_height": 400,
    "min_width": 600,
    "background": "light",
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawData = data; // Renaming for clarity, original data object
    const chartData = rawData.data && rawData.data.data ? rawData.data.data : [];
    const variables = rawData.variables || {};
    const typography = rawData.typography || {};
    const colors = rawData.colors || {}; // Assuming light theme, adjust if dark theme logic needed
    const images = rawData.images || {}; // Not used in this chart, but good practice
    const dataColumns = rawData.data && rawData.data.columns ? rawData.data.columns : [];

    const categoryColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    if (!categoryColumn || !categoryColumn.name || !valueColumn || !valueColumn.name) {
        console.error("Critical chart config missing: categoryField (role 'x') or valueField (role 'y') name not found in dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style=\'color:red; text-align:center; padding: 20px;\'>Error: Critical chart configuration missing. Category or value field not defined.</div>");
        }
        return null;
    }
    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;
    
    d3.select(containerSelector).html(""); // Clear the container

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '16px', // Default for primary labels in cells
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold',
            smallLabelFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px', // For shrunk/wrapped labels
            valueLabelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '14px', // For value labels
            smallValueLabelFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '8px',
        },
        chartBackground: colors.background_color || '#FFFFFF', // Not directly used for SVG background, but available
        textColor: colors.text_color || '#FFFFFF', // Default for text inside cells
        cellFillOpacity: 0.8,
        cellStrokeColor: 'none',
        valueLabelOpacity: 0.7,
        defaultCategoryColor: '#ccc' // Fallback color
    };

    // Helper for color scale (moved to Block 6 for direct use with data)
    // Helper for text wrapping (will be integrated into text rendering logic)

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        // Removed viewBox and responsive styles
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    const valueFormatter = d3.format(",d");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.margin_top || 10, 
        right: variables.margin_right || 10, 
        bottom: variables.margin_bottom || 10, 
        left: variables.margin_left || 10 
    };
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const radius = Math.min(innerWidth, innerHeight) / 2;
    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;
    
    const clipPolygon = [];
    const numPoints = 50; // For approximating circle
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        clipPolygon.push([
            centerX + radius * Math.cos(angle),
            centerY + radius * Math.sin(angle)
        ]);
    }

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartData.map(d => ({
        name: d[categoryFieldName],
        weight: d[valueFieldName]
    }));
    
    // Block 6: Scale Definition & Configuration
    const colorScale = (categoryName) => {
        if (colors.field && colors.field[categoryName]) {
            return colors.field[categoryName];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            // Create a consistent mapping from category name to an index
            const uniqueCategories = [...new Set(processedData.map(d => d.name))].sort();
            const index = uniqueCategories.indexOf(categoryName);
            return colors.available_colors[index % colors.available_colors.length];
        }
        // Fallback to a default scheme if no specific colors are provided
        const uniqueCategories = [...new Set(processedData.map(d => d.name))].sort();
        const index = uniqueCategories.indexOf(categoryName);
        return d3.schemeTableau10[index % 10];
    };
    
    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for Voronoi Treemap (no axes, legend by default from spec)

    // Block 8: Main Data Visualization Rendering
    const simulation = d3.voronoiMapSimulation(processedData)
        .weight(d => d.weight)
        .clip(clipPolygon)
        .stop(); // Stop to control ticking manually
    
    let state = simulation.state();
    let iterations = 0;
    const maxIterations = variables.max_iterations || 300; 
    
    while (!state.ended && iterations < maxIterations) {
        simulation.tick();
        state = simulation.state();
        iterations++;
    }
    
    const finalPolygons = state.polygons;
    
    const cellGroups = mainChartGroup.selectAll("g.cell-group")
        .data(finalPolygons)
        .enter()
        .append("g")
        .attr("class", "voronoi-cell-group");
    
    cellGroups.append("path")
        .attr("class", "voronoi-cell-path")
        .attr("d", d => "M" + d.join("L") + "Z")
        .attr("fill", d => {
            const originalName = d.site.originalObject.data.originalData.name;
            return colorScale(originalName);
        })
        .attr("fill-opacity", fillStyle.cellFillOpacity)
        .attr("stroke", fillStyle.cellStrokeColor);
    
    // Category Labels
    cellGroups.each(function(polygonData) {
        const cellGroup = d3.select(this);
        const centroid = d3.polygonCentroid(polygonData);
        const originalName = polygonData.site.originalObject.data.originalData.name;

        // Calculate bounding box of the polygon
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        polygonData.forEach(point => {
            minX = Math.min(minX, point[0]);
            minY = Math.min(minY, point[1]);
            maxX = Math.max(maxX, point[0]);
            maxY = Math.max(maxY, point[1]);
        });
        const polygonWidth = maxX - minX;
        const polygonHeight = maxY - minY;

        const categoryLabel = cellGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", centroid[0])
            .attr("y", centroid[1])
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .text(originalName);

        // Text fitting for category label
        const initialTextWidth = categoryLabel.node().getComputedTextLength();
        let currentFontSize = parseFloat(fillStyle.typography.labelFontSize);

        if (initialTextWidth > polygonWidth * 0.8 || polygonHeight < 30) { // Condition to shrink/wrap
            currentFontSize = parseFloat(fillStyle.typography.smallLabelFontSize);
            categoryLabel.attr("font-size", currentFontSize + "px");

            // Attempt basic word wrapping if text still too wide
            if (categoryLabel.node().getComputedTextLength() > polygonWidth * 0.8 && originalName.length > 10) {
                categoryLabel.text(""); // Clear existing text

                const words = originalName.split(/\\s+|(?=[A-Z][a-z])|(?=[^\\w\\s])|(?<=\\W)(?=\\w)/g); // Split by space or camelCase or before punctuation
                let line1 = "";
                let line2 = "";
                
                if (words.length > 1) {
                    let tempLine = "";
                    for (let k = 0; k < words.length; k++) {
                        categoryLabel.text(tempLine + words[k]);
                        if (categoryLabel.node().getComputedTextLength() > polygonWidth * 0.9 && tempLine !== "") {
                           line1 = tempLine.trim();
                           line2 = words.slice(k).join(" ");
                           break;
                        }
                        tempLine += words[k] + (words[k].match(/\\W$/) ? "" : " "); // Add space if not ending with punctuation
                        if (k === words.length -1) line1 = tempLine.trim();
                    }
                } else { // single very long word, try to split in middle
                     const midPoint = Math.floor(originalName.length / 2);
                     line1 = originalName.substring(0, midPoint);
                     line2 = originalName.substring(midPoint);
                }


                if (line2) { // If wrapping occurred
                    categoryLabel.append("tspan")
                        .attr("x", centroid[0])
                        .attr("dy", "-0.5em") // Adjust line 1 up
                        .text(line1);
                    categoryLabel.append("tspan")
                        .attr("class", "label category-label wrapped")
                        .attr("x", centroid[0])
                        .attr("dy", "1em") // Line 2 down
                        .text(line2);
                } else {
                     categoryLabel.text(line1 || originalName); // If no good wrap, use line1 or original if line1 is empty
                }
            }
        }
    });
    
    // Value Labels
    cellGroups.append("text")
        .attr("class", "value data-value-label")
        .attr("x", d => d3.polygonCentroid(d)[0])
        .attr("y", d => {
            const originalName = d.site.originalObject.data.originalData.name;
            // Check if the category label for this cell has tspans (i.e., was wrapped)
            const cellGroupNode = d3.select(this.parentNode).select(".category-label"); // this refers to the text element, parentNode is the g
            const hasTspans = cellGroupNode.selectAll("tspan").size() > 0;
            const offset = hasTspans ? 25 : 15; // Larger offset if category label is wrapped (taller)
            return d3.polygonCentroid(d)[1] + offset;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .attr("fill-opacity", fillStyle.valueLabelOpacity)
        .attr("font-family", fillStyle.typography.labelFontFamily) // Assuming same family as labels
        .attr("font-size", fillStyle.typography.valueLabelFontSize)
        .text(d => valueFormatter(d.site.originalObject.data.originalData.weight))
        .each(function(polygonData) { // `this` is the text element
            // Calculate bounding box of the polygon
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            polygonData.forEach(point => {
                minX = Math.min(minX, point[0]);
                minY = Math.min(minY, point[1]);
                maxX = Math.max(maxX, point[0]);
                maxY = Math.max(maxY, point[1]);
            });
            const polygonWidth = maxX - minX;
            const polygonHeight = maxY - minY; // height of the polygon cell

            // Check if text fits
            const textWidth = this.getComputedTextLength();
            if (textWidth > polygonWidth * 0.8 || polygonHeight < 40) { // If cell is small or text too wide
                 d3.select(this)
                    .attr("font-size", fillStyle.typography.smallValueLabelFontSize)
                    .attr("fill-opacity", 0.9); // Make more opaque if smaller
            }
        });

    // Block 9: Optional Enhancements & Post-Processing
    // Text fitting and wrapping is handled within Block 8 as it\'s integral to element rendering.
    // No other explicit enhancements like annotations or complex interactions in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
} 