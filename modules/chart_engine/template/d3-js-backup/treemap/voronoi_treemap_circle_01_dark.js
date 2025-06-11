/* REQUIREMENTS_BEGIN
{
  "chart_type": "Voronoi Treemap",
  "chart_name": "voronoi_treemap_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 40], [0, "inf"]],
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const config = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors_dark || data.colors || {}; // Prefer dark theme if available
    const imagesInput = data.images || {}; // Not used in this chart, but parsed per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const categoryFieldCol = dataColumns.find(col => col.role === "x");
    const valueFieldCol = dataColumns.find(col => col.role === "y");

    const categoryFieldName = categoryFieldCol?.name;
    const valueFieldName = valueFieldCol?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("Category field (role 'x')");
        if (!valueFieldName) missingFields.push("Value field (role 'y')");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        categoricalColors: {},
        defaultCategoricalColorPalette: d3.schemeCategory10
    };

    fillStyle.textColor = colorsInput.text_color || '#E0E0E0'; // Default for dark themes
    fillStyle.backgroundColor = colorsInput.background_color || '#1A1A1A'; // Default dark background

    // Typography
    fillStyle.typography.labelFontFamily = (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = (typographyInput.label && typographyInput.label.font_size) || '12px';
    fillStyle.typography.labelFontWeight = (typographyInput.label && typographyInput.label.font_weight) || 'normal';
    
    // Specific typography for name (primary) and value (secondary) labels within cells
    fillStyle.typography.nameLabelFontSize = (typographyInput.title && typographyInput.title.font_size) || '14px';
    fillStyle.typography.nameLabelFontWeight = (typographyInput.title && typographyInput.title.font_weight) || 'bold';
    fillStyle.typography.valueLabelFontSize = (typographyInput.label && typographyInput.label.font_size) || '11px';
    fillStyle.typography.valueLabelFontWeight = (typographyInput.label && typographyInput.label.font_weight) || 'normal';


    const uniqueCategoryNames = [...new Set(chartDataArray.map(item => item[categoryFieldName]))];
    if (colorsInput.field && Object.keys(colorsInput.field).length > 0) {
        uniqueCategoryNames.forEach(name => {
            if (colorsInput.field[name]) {
                fillStyle.categoricalColors[name] = colorsInput.field[name];
            }
        });
    } else if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
        uniqueCategoryNames.forEach((name, i) => {
            fillStyle.categoricalColors[name] = colorsInput.available_colors[i % colorsInput.available_colors.length];
        });
    } else {
        uniqueCategoryNames.forEach((name, i) => {
            fillStyle.categoricalColors[name] = fillStyle.defaultCategoricalColorPalette[i % fillStyle.defaultCategoricalColorPalette.length];
        });
    }
    
    // Helper for text width estimation (not strictly needed if using getComputedTextLength on rendered elements)
    // function estimateTextWidth(text, fontFamily, fontSize, fontWeight) { ... } // As per spec, but might not be used if post-render fitting is preferred.

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 600;
    const containerHeight = config.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink") // For potential image use, though not in this chart
        .style("background-color", fillStyle.backgroundColor);

    const chartMargins = { top: 10, right: 10, bottom: 10, left: 10 };

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const radius = Math.min(innerWidth, innerHeight) / 2;
    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;

    const clipPolygonData = [];
    const numClipPoints = 60; // More points for a smoother circle
    for (let i = 0; i < numClipPoints; i++) {
        const angle = (i / numClipPoints) * 2 * Math.PI;
        clipPolygonData.push([
            centerX + radius * Math.cos(angle),
            centerY + radius * Math.sin(angle)
        ]);
    }

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartDataArray.map(d => ({
        name: d[categoryFieldName],
        weight: +d[valueFieldName] || 0 // Ensure weight is a number
    }));

    // Block 6: Scale Definition & Configuration
    const colorScale = (categoryName) => {
        return fillStyle.categoricalColors[categoryName] || fillStyle.defaultCategoricalColorPalette[0]; // Fallback color
    };

    const valueFormatter = d3.format(",.0f"); // Format for value labels

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    if (typeof d3.voronoiMapSimulation !== 'function') {
        const errorMsg = "d3.voronoiMapSimulation is not available. This chart type requires the d3-voronoi-map plugin.";
        console.error(errorMsg);
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "red")
            .text(errorMsg);
        return svgRoot.node();
    }
    
    const simulation = d3.voronoiMapSimulation(processedChartData)
        .weight(d => d.weight)
        .clip(clipPolygonData)
        .stop();

    let simulationState = simulation.state();
    let iterations = 0;
    const maxIterations = 300; // Prevent infinite loops

    while (!simulationState.ended && iterations < maxIterations) {
        simulation.tick();
        simulationState = simulation.state();
        iterations++;
    }

    const voronoiPolygons = simulationState.polygons;

    const cellGroups = mainChartGroup.selectAll("g.cell-group")
        .data(voronoiPolygons)
        .enter()
        .append("g")
        .attr("class", "cell-group");

    cellGroups.append("path")
        .attr("class", "mark voronoi-cell")
        .attr("d", d => "M" + d.join("L") + "Z")
        .attr("fill", d => colorScale(d.site.originalObject.data.name))
        .attr("fill-opacity", 0.85)
        .attr("stroke", fillStyle.backgroundColor) // Cell border same as background or slightly darker/lighter
        .attr("stroke-width", 1);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    
    // Add Name Labels
    cellGroups.append("text")
        .attr("class", "label name-label")
        .attr("x", d => d3.polygonCentroid(d)[0])
        .attr("y", d => d3.polygonCentroid(d)[1])
        .attr("dy", d => { // Adjust dy if value label will also be shown
             return (d.site.originalObject.data.weight > 0 && parseFloat(fillStyle.typography.valueLabelFontSize) > 0) ? "-0.4em" : "0.35em";
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.nameLabelFontSize)
        .style("font-weight", fillStyle.typography.nameLabelFontWeight)
        .attr("fill", fillStyle.textColor)
        .text(d => d.site.originalObject.data.name)
        .each(function(p) { // p is the polygon data
            const textElement = d3.select(this);
            const cellData = p.site.originalObject.data;
            let textString = cellData.name;

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            p.forEach(point => {
                minX = Math.min(minX, point[0]);
                maxX = Math.max(maxX, point[0]);
                minY = Math.min(minY, point[1]);
                maxY = Math.max(maxY, point[1]);
            });
            const cellWidth = maxX - minX;
            const cellHeight = maxY - minY;
            const availableWidth = cellWidth * 0.9;
            const availableHeight = cellHeight * ( (cellData.weight > 0 && parseFloat(fillStyle.typography.valueLabelFontSize) > 0) ? 0.4 : 0.8);


            let currentFontSize = parseFloat(fillStyle.typography.nameLabelFontSize);
            textElement.style('font-size', currentFontSize + 'px');

            while ((textElement.node().getComputedTextLength() > availableWidth || currentFontSize > availableHeight) && currentFontSize > 8) {
                currentFontSize -= 1;
                textElement.style('font-size', currentFontSize + 'px');
            }

            if (textElement.node().getComputedTextLength() > availableWidth || currentFontSize <= 8 && textElement.node().getComputedTextLength() > availableWidth) {
                let truncated = false;
                while (textString.length > 0 && textElement.node().getComputedTextLength() > availableWidth) {
                    textString = textString.slice(0, -1);
                    textElement.text(textString + "…");
                    truncated = true;
                }
                 if (textString.length === 0 || (truncated && textElement.node().getComputedTextLength() > availableWidth)) {
                     textElement.text("");
                 }
            }
             if (currentFontSize <= 8 && currentFontSize > availableHeight) { // If font size is small AND still too tall
                textElement.text("");
            }
        });

    // Add Value Labels
    cellGroups.append("text")
        .attr("class", "label value-label")
        .attr("x", d => d3.polygonCentroid(d)[0])
        .attr("y", d => d3.polygonCentroid(d)[1])
        .attr("dy", "0.9em") // Position below name label
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.valueLabelFontSize)
        .style("font-weight", fillStyle.typography.valueLabelFontWeight)
        .attr("fill", fillStyle.textColor)
        .attr("fill-opacity", 0.8)
        .text(d => {
            if (d.site.originalObject.data.weight > 0 && parseFloat(fillStyle.typography.valueLabelFontSize) > 0) {
                 return valueFormatter(d.site.originalObject.data.weight);
            }
            return "";
        })
        .each(function(p) { // p is the polygon data
            const textElement = d3.select(this);
            if (textElement.text() === "") return;

            const cellData = p.site.originalObject.data;
            let textString = valueFormatter(cellData.weight);

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            p.forEach(point => {
                minX = Math.min(minX, point[0]);
                maxX = Math.max(maxX, point[0]);
                minY = Math.min(minY, point[1]);
                maxY = Math.max(maxY, point[1]);
            });
            const cellWidth = maxX - minX;
            const cellHeight = maxY - minY;
            const availableWidth = cellWidth * 0.9;
            const availableHeight = cellHeight * 0.4; // Assuming value label takes lower part

            let currentFontSize = parseFloat(fillStyle.typography.valueLabelFontSize);
            textElement.style('font-size', currentFontSize + 'px');
            
            while ((textElement.node().getComputedTextLength() > availableWidth || currentFontSize > availableHeight) && currentFontSize > 7) {
                currentFontSize -= 1;
                textElement.style('font-size', currentFontSize + 'px');
            }

            if (textElement.node().getComputedTextLength() > availableWidth || currentFontSize <= 7) {
                textElement.text(""); // Hide if too small or doesn't fit
            }
        });


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}