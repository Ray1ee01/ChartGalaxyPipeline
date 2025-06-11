/* REQUIREMENTS_BEGIN
{
  "chart_type": "Voronoi Treemap",
  "chart_name": "voronoi_treemap_circle_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[5, 40], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "center",
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via data.colors_dark
    const imagesConfig = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !valueColumn) {
        const missing = [];
        if (!categoryColumn) missing.push("role 'x'");
        if (!valueColumn) missing.push("role 'y'");
        const errorMsg = `Critical chart config missing: categoryField (role 'x') or valueField (role 'y') not found in dataColumns. Cannot render. Missing: ${missing.join(', ')}`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        categoryColorMapping: colorsConfig.field || {},
        availableColors: colorsConfig.available_colors || d3.schemeCategory10,
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        textColor: colorsConfig.text_color || '#333333',
        textOnCellColor: '#FFFFFF', // Default for text on colored cells
        defaultCellFillColor: '#CCCCCC'
    };

    fillStyle.typography.labelFontFamily = typographyConfig.label && typographyConfig.label.font_family ? typographyConfig.label.font_family : 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = typographyConfig.label && typographyConfig.label.font_size ? typographyConfig.label.font_size : '12px';
    fillStyle.typography.labelFontWeight = typographyConfig.label && typographyConfig.label.font_weight ? typographyConfig.label.font_weight : 'bold';

    fillStyle.typography.annotationFontFamily = typographyConfig.annotation && typographyConfig.annotation.font_family ? typographyConfig.annotation.font_family : 'Arial, sans-serif';
    fillStyle.typography.annotationFontSize = typographyConfig.annotation && typographyConfig.annotation.font_size ? typographyConfig.annotation.font_size : '10px';
    fillStyle.typography.annotationFontWeight = typographyConfig.annotation && typographyConfig.annotation.font_weight ? typographyConfig.annotation.font_weight : 'normal';
    
    // Helper to estimate text width (not strictly needed if using getBBox on rendered elements, but good for complex layouts)
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No need to append tempSvg to DOM for getBBox to work
        return tempText.getBBox().width;
    }

    const valueFormatter = d3.format(",d");

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 10, right: 10, bottom: 10, left: 10 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const radius = Math.min(innerWidth, innerHeight) / 2;
    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataInput.map(d => ({
        name: d[categoryFieldName],
        weight: +d[valueFieldName] || 0 // Ensure weight is a number
    })).filter(d => d.weight > 0); // Voronoi simulation requires positive weights

    if (processedData.length === 0) {
        const errorMsg = "No valid data points with positive weights available to render the Voronoi treemap.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    
    const clipPolygon = [];
    const numClipPoints = 60; // Smoother circle approximation
    for (let i = 0; i < numClipPoints; i++) {
        const angle = (i / numClipPoints) * 2 * Math.PI;
        clipPolygon.push([
            centerX + radius * Math.cos(angle),
            centerY + radius * Math.sin(angle)
        ]);
    }

    // Block 6: Scale Definition & Configuration
    const uniqueCategories = [...new Set(processedData.map(d => d.name))];
    const colorScale = (categoryName) => {
        if (fillStyle.categoryColorMapping && fillStyle.categoryColorMapping[categoryName]) {
            return fillStyle.categoryColorMapping[categoryName];
        }
        const index = uniqueCategories.indexOf(categoryName);
        return fillStyle.availableColors[index % fillStyle.availableColors.length];
    };

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type (no axes, gridlines, or legend).

    // Block 8: Main Data Visualization Rendering
    if (typeof d3.voronoiMapSimulation !== 'function') {
        const errorMsg = "d3.voronoiMapSimulation is not available. Please include the d3-voronoi-map library.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    const simulation = d3.voronoiMapSimulation(processedData)
        .weight(d => d.weight)
        .clip(clipPolygon)
        .stop();

    let simulationState = simulation.state();
    let iterations = 0;
    const maxIterations = 300; 

    while (!simulationState.ended && iterations < maxIterations) {
        simulation.tick();
        simulationState = simulation.state();
        iterations++;
    }
    
    const voronoiPolygons = simulationState.polygons;

    const cellGroups = mainChartGroup.selectAll("g.voronoi-cell")
        .data(voronoiPolygons)
        .enter()
        .append("g")
        .attr("class", "mark voronoi-cell");

    cellGroups.append("path")
        .attr("class", "mark voronoi-path")
        .attr("d", d => "M" + d.join("L") + "Z")
        .style("fill", d => colorScale(d.site.originalObject.data.originalData.name))
        .style("stroke", "none"); // No stroke for cleaner look, could be fillStyle.cellBorder


    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Text labels (category name and value)
    cellGroups.each(function(d) {
        const cellElement = d3.select(this);
        const polygonData = d; // This is the array of points for the polygon
        const originalItemData = d.site.originalObject.data.originalData;
        const centroid = d3.polygonCentroid(polygonData);
        
        // Calculate approximate cell dimensions for text fitting
        const bounds = d3.polygonBounds(polygonData); // [[minX, minY], [maxX, maxY]]
        const cellWidth = bounds[1][0] - bounds[0][0];
        const cellHeight = bounds[1][1] - bounds[0][1];

        // Add Category Name Label
        const categoryLabel = cellElement.append("text")
            .attr("class", "label category-label")
            .attr("x", centroid[0])
            .attr("y", centroid[1])
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle") // Changed from 'central'
            .style("fill", fillStyle.textOnCellColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(originalItemData.name);
        
        // Basic text fitting for category label (font scaling and two-line tspan)
        fitTextToCell(categoryLabel, cellWidth * 0.9, cellHeight * 0.6, originalItemData.name, centroid[0], true);


        // Add Value Label (conditionally, if space allows after category label)
        const valueLabelYOffset = parseFloat(fillStyle.typography.labelFontSize) * 0.7; // Approximate offset based on category label size
        
        const valueLabel = cellElement.append("text")
            .attr("class", "label value-label")
            .attr("x", centroid[0])
            .attr("y", centroid[1] + valueLabelYOffset) // Position below category label
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("fill", fillStyle.textOnCellColor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .text(valueFormatter(originalItemData.weight));

        // Simpler fitting for value label (font scaling, no tspans)
        fitTextToCell(valueLabel, cellWidth * 0.8, cellHeight * 0.3, valueFormatter(originalItemData.weight), centroid[0], false);

        // Check if labels overlap or exceed cell bounds significantly after attempting to fit category label
        // This is a simplified check. A more robust solution would involve checking bounding boxes of both.
        const categoryBBox = categoryLabel.node().getBBox();
        const valueBBox = valueLabel.node().getBBox();

        if (categoryBBox.y + categoryBBox.height > valueBBox.y || 
            (categoryBBox.height + valueBBox.height > cellHeight * 0.85) ) { // If total height too much
            valueLabel.text(""); // Hide value label if not enough space or overlaps
        }
         if (categoryLabel.text() === "" && valueLabel.text() === "") { // If both became empty
            // Potentially show a tiny mark or initial if cell is extremely small
         }

    });

    function fitTextToCell(textElement, maxWidth, maxHeight, textContent, xPosition, allowTspan) {
        const initialFontSize = parseFloat(textElement.style("font-size"));
        const smallerFontSize = parseFloat(fillStyle.typography.annotationFontSize); // Use annotation as smaller
        const minFontSize = 8; // Absolute minimum font size

        textElement.text(textContent); // Set full text first

        // Attempt 1: Initial font size
        let bbox = textElement.node().getBBox();
        if (bbox.width <= maxWidth && bbox.height <= maxHeight) return;

        // Attempt 2: Smaller font size
        textElement.style("font-size", smallerFontSize + "px");
        bbox = textElement.node().getBBox();
        if (bbox.width <= maxWidth && bbox.height <= maxHeight) return;
        
        // Attempt 3: Try tspan wrapping if allowed (for category labels)
        if (allowTspan) {
            textElement.text(null); // Clear for tspans
            const words = textContent.split(/\s+/);
            let line1 = "";
            let line2 = "";
            
            const tempTspan = textElement.append("tspan").attr("x", xPosition).text("test"); // For line height
            const dy1 = "0em"; // Relative to text y
            const dy2 = tempTspan.node().getBBox().height > 0 ? "1.1em" : "12px"; // Line height
            tempTspan.remove();

            let currentLineText = "";
            for (let i = 0; i < words.length; i++) {
                const testLine = currentLineText + (currentLineText ? " " : "") + words[i];
                textElement.append("tspan").attr("x", xPosition).text(testLine); // temp tspan for measurement
                const testWidth = textElement.node().getBBox().width;
                textElement.select("tspan").remove(); // remove temp tspan

                if (testWidth > maxWidth && i > 0 && currentLineText !== "") { // If current word makes it too long
                    line1 = currentLineText;
                    currentLineText = words[i]; // Start new line
                } else {
                    currentLineText = testLine;
                }
            }
            if (!line1) line1 = currentLineText; // Single line content
            else line2 = currentLineText; // Remainder for line 2

            textElement.append("tspan").attr("x", xPosition).attr("dy", dy1).text(line1);
            if (line2) {
                textElement.append("tspan").attr("x", xPosition).attr("dy", dy2).text(line2);
            }
            
            bbox = textElement.node().getBBox();
            if (bbox.width <= maxWidth && bbox.height <= maxHeight) return;
        }

        // Attempt 4: Truncation (if still too large or tspan not allowed/failed)
        // Revert to single line for simpler truncation logic
        textElement.text(null); 
        textElement.append("tspan").attr("x", xPosition).attr("dy", "0.35em").text(textContent); // dominant-baseline might handle dy better
        
        let currentText = textContent;
        while (currentText.length > 0) {
            bbox = textElement.node().getBBox();
            if (bbox.width <= maxWidth && bbox.height <= maxHeight) break;
            if (currentText.length <= 3 && (bbox.width > maxWidth || bbox.height > maxHeight) ) { // e.g. "A..." is too big
                 currentText = ""; // Hide if even very short text + ellipsis is too big
                 break;
            }
            currentText = currentText.slice(0, -1);
            textElement.select("tspan").text(currentText + (currentText.length > 0 ? "..." : ""));
        }
        if (!currentText) textElement.select("tspan").text(""); // Hide if fully truncated
    }


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}