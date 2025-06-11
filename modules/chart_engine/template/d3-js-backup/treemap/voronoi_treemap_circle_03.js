/* REQUIREMENTS_BEGIN
{
  "chart_type": "Voronoi Treemap",
  "chart_name": "voronoi_treemap_03",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const config = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    if (!categoryColumn || !valueColumn) {
        const missingRoles = [];
        if (!categoryColumn) missingRoles.push("'x' role");
        if (!valueColumn) missingRoles.push("'y' role");
        const errorMsg = `Critical chart config missing: ${missingRoles.join(" and ")} columns not found. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>Error: ${errorMsg}</div>`);
        return null;
    }
    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingNames = [];
        if (!categoryFieldName) missingNames.push("category field name (from 'x' role)");
        if (!valueFieldName) missingNames.push("value field name (from 'y' role)");
        const errorMsg = `Critical chart config missing: ${missingNames.join(" and ")} is undefined. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>Error: ${errorMsg}</div>`);
        return null;
    }
    
    if (!chartDataArray || chartDataArray.length === 0) {
        const errorMsg = "Chart data is missing or empty. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>Error: ${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    fillStyle.typography.labelFontFamily = (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = (typography.label && typography.label.font_size) ? typography.label.font_size : '14px';
    fillStyle.typography.labelFontWeight = (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold';

    fillStyle.typography.annotationFontFamily = (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif';
    fillStyle.typography.annotationFontSize = (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '12px';
    fillStyle.typography.annotationFontWeight = (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal';
    
    fillStyle.chartBackground = colors.background_color || '#FFFFFF';
    fillStyle.textOnCellColor = colors.text_on_filled_element_color || '#FFFFFF'; // Specific for text on colored cells
    
    const defaultCellColors = d3.schemeCategory10;
    
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // Hide the temporary SVG, position off-screen. Visibility hidden is better than display none for getBBox.
        tempSvg.style.position = 'absolute';
        tempSvg.style.left = '-9999px';
        tempSvg.style.top = '-9999px';
        tempSvg.style.visibility = 'hidden';

        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontProps.fontFamily);
        textEl.setAttribute('font-size', fontProps.fontSize);
        textEl.setAttribute('font-weight', fontProps.fontWeight);
        textEl.textContent = text;
        tempSvg.appendChild(textEl);
        document.body.appendChild(tempSvg); // Temporarily append to DOM for getBBox to work reliably
        let width = 0;
        try {
            width = textEl.getBBox().width;
        } catch (e) {
            console.warn("Failed to getBBox for text width estimation.", e);
            width = text.length * (parseInt(fontProps.fontSize) || 10) * 0.6; // Fallback
        }
        document.body.removeChild(tempSvg); // Clean up
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = { top: 10, right: 10, bottom: 10, left: 10 };

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const radius = Math.min(innerWidth, innerHeight) / 2;
    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataArray.map(d => ({
        name: d[categoryFieldName],
        weight: +d[valueFieldName] || 0 // Allow 0 weight, filter later if needed by simulation
    })).filter(d => typeof d.name !== 'undefined' && d.weight > 0); // Voronoi simulation needs positive weights and defined names

    if (processedData.length === 0) {
        const errorMsg = "No valid data points after processing (all weights might be zero/negative or names undefined). Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>Error: ${errorMsg}</div>`);
        return null;
    }
    
    const numClipPoints = 60;
    const clipPathPolygon = [];
    for (let i = 0; i < numClipPoints; i++) {
        const angle = (i / numClipPoints) * 2 * Math.PI;
        clipPathPolygon.push([
            centerX + radius * Math.cos(angle),
            centerY + radius * Math.sin(angle)
        ]);
    }

    // Block 6: Scale Definition & Configuration
    const uniqueCategories = [...new Set(processedData.map(d => d.name))];
    const colorScaleFunction = (categoryName) => {
        if (colors.field && colors.field[categoryName]) {
            return colors.field[categoryName];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            const index = uniqueCategories.indexOf(categoryName);
            return colors.available_colors[index % colors.available_colors.length];
        }
        const index = uniqueCategories.indexOf(categoryName);
        return defaultCellColors[index % defaultCellColors.length];
    };

    // Block 7: Chart Component Rendering
    // Not applicable.

    // Block 8: Main Data Visualization Rendering
    if (typeof d3.voronoiMapSimulation !== 'function') {
        const errorMsg = "d3.voronoiMapSimulation is not available. Please include the d3-voronoi-map library. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>Error: ${errorMsg}</div>`);
        return null;
    }

    const simulation = d3.voronoiMapSimulation(processedData)
        .weight(d => d.weight)
        .clip(clipPathPolygon)
        .stop();

    let simulationState = simulation.state();
    let iterations = 0;
    const maxIterations = 300; 
    while (!simulationState.ended && iterations < maxIterations) {
        simulation.tick();
        simulationState = simulation.state();
        iterations++;
    }
    const finalPolygons = simulationState.polygons;

    const cellElements = mainChartGroup.selectAll("g.cell-group")
        .data(finalPolygons)
        .enter()
        .append("g")
        .attr("class", "mark cell-group");

    cellElements.append("path")
        .attr("class", "mark cell-path")
        .attr("d", d => "M" + d.join("L") + "Z")
        .style("fill", d => colorScaleFunction(d.site.originalObject.data.name))
        .style("stroke", "none"); 

    const valueFormatter = d3.format(",.0f");

    // Block 9: Optional Enhancements & Post-Processing
    cellElements.each(function(polygonData) {
        const group = d3.select(this);
        const cellData = polygonData.site.originalObject.data;
        const cellName = cellData.name;
        const cellValue = cellData.weight;
        
        const centroid = d3.polygonCentroid(polygonData);
        if (isNaN(centroid[0]) || isNaN(centroid[1])) return; // Skip if centroid is invalid

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        polygonData.forEach(point => {
            minX = Math.min(minX, point[0]);
            minY = Math.min(minY, point[1]);
            maxX = Math.max(maxX, point[0]);
            maxY = Math.max(maxY, point[1]);
        });
        const polyWidth = maxX - minX;
        const polyHeight = maxY - minY;

        const nameLabel = group.append("text")
            .attr("class", "label text category-label")
            .attr("x", centroid[0])
            .attr("y", centroid[1])
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textOnCellColor)
            .text(cellName);
        
        let currentNameFontSize = parseInt(fillStyle.typography.labelFontSize);
        nameLabel.style("font-size", `${currentNameFontSize}px`);
        
        let nameTextWidth = nameLabel.node().getComputedTextLength();
        const maxTextWidthRatio = 0.9; // Max width ratio for text within polygon

        while (nameTextWidth > polyWidth * maxTextWidthRatio && currentNameFontSize > 8) {
            currentNameFontSize -= 1;
            nameLabel.style("font-size", `${currentNameFontSize}px`);
            nameTextWidth = nameLabel.node().getComputedTextLength();
        }
        
        let nameLabelLines = 1;
        const minFontSizeForWrap = Math.max(8, parseInt(fillStyle.typography.labelFontSize) * 0.6);
        const minCellNameLengthForWrap = 5;

        if (nameTextWidth > polyWidth * maxTextWidthRatio && currentNameFontSize <= minFontSizeForWrap && cellName.length >= minCellNameLengthForWrap && polyHeight > currentNameFontSize * 2.2) {
            nameLabel.text(""); 
            let tspanLineHeight = currentNameFontSize * 1.1; 
            const midPoint = Math.ceil(cellName.length / 2); // Simple split
            let firstLine = cellName.substring(0, midPoint);
            let secondLine = cellName.substring(midPoint);

            nameLabelLines = 2;
            const initialDy = -( (nameLabelLines - 1) * tspanLineHeight ) / 2;
            
            nameLabel.append("tspan")
                .attr("x", centroid[0])
                .attr("dy", `${initialDy}px`)
                .text(firstLine);
            nameLabel.append("tspan")
                .attr("x", centroid[0])
                .attr("dy", `${tspanLineHeight}px`)
                .text(secondLine);
        }
        
        const nameLabelBBox = nameLabel.node().getBBox();
        if (nameLabelBBox.width > polyWidth * maxTextWidthRatio || nameLabelBBox.height > polyHeight * 0.8) {
            nameLabel.style("display", "none"); // Hide if still too large or cell too small
        }

        const valueLabelYOffset = nameLabelBBox.height / (nameLabelLines === 1 ? 1.5 : 2) + (currentNameFontSize * 0.3);

        const valueLabel = group.append("text")
            .attr("class", "value text data-value-label")
            .attr("x", centroid[0])
            .attr("y", centroid[1] + valueLabelYOffset)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textOnCellColor)
            .style("fill-opacity", 0.85)
            .text(valueFormatter(cellValue));

        let currentValueFontSize = parseInt(fillStyle.typography.annotationFontSize);
        valueLabel.style("font-size", `${currentValueFontSize}px`);
        let valueTextWidth = valueLabel.node().getComputedTextLength();

        while (valueTextWidth > polyWidth * maxTextWidthRatio && currentValueFontSize > 7) {
            currentValueFontSize -= 1;
            valueLabel.style("font-size", `${currentValueFontSize}px`);
            valueTextWidth = valueLabel.node().getComputedTextLength();
        }
        
        const valueLabelBBox = valueLabel.node().getBBox();
        if (valueLabelBBox.width > polyWidth * maxTextWidthRatio || valueLabelBBox.height > polyHeight * 0.4 || (nameLabelBBox.height + valueLabelBBox.height) > polyHeight * 0.9) {
            valueLabel.style("display", "none");
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}