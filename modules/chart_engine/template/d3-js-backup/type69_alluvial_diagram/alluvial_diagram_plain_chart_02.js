/* REQUIREMENTS_BEGIN
{
  "chart_type": "Alluvial Diagram",
  "chart_name": "alluvial_diagram_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group", "x"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 10], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or data.colors_dark for dark
    const images = data.images || {}; // Parsed, but not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const timeFieldCol = dataColumns.find(col => col.role === "group"); // 'group' role for time

    const missingFields = [];
    if (!xFieldCol || !xFieldCol.name) missingFields.push("x field (category)");
    if (!yFieldCol || !yFieldCol.name) missingFields.push("y field (value)");
    if (!timeFieldCol || !timeFieldCol.name) missingFields.push("group field (time)");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const timeFieldName = timeFieldCol.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};

    // Typography defaults and parsing
    const defaultTypographySettings = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    // Chart-specific typography preferences if not fully specified by user
    const chartSpecificDefaults = {
        label: { font_family: "Arial, sans-serif", font_size: "14px", font_weight: "bold" }, // For category labels
        annotation: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "bold" } // For value labels
    };

    fillStyle.typography = {
        titleFontFamily: (typography.title && typography.title.font_family) || defaultTypographySettings.title.font_family,
        titleFontSize: (typography.title && typography.title.font_size) || defaultTypographySettings.title.font_size,
        titleFontWeight: (typography.title && typography.title.font_weight) || defaultTypographySettings.title.font_weight,

        labelFontFamily: (typography.label && typography.label.font_family) || chartSpecificDefaults.label.font_family,
        labelFontSize: (typography.label && typography.label.font_size) || chartSpecificDefaults.label.font_size,
        labelFontWeight: (typography.label && typography.label.font_weight) || chartSpecificDefaults.label.font_weight,

        annotationFontFamily: (typography.annotation && typography.annotation.font_family) || chartSpecificDefaults.annotation.font_family,
        annotationFontSize: (typography.annotation && typography.annotation.font_size) || chartSpecificDefaults.annotation.font_size,
        annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || chartSpecificDefaults.annotation.font_weight,
    };

    // Color defaults and parsing
    fillStyle.textColor = colors.text_color || '#0f223b';
    fillStyle.chartBackground = colors.background_color || '#FFFFFF';
    const defaultPrimaryColor = '#007bff';
    const defaultAvailableColors = d3.schemeCategory10;
    
    fillStyle.linkFillOpacity = 0.7;
    fillStyle.nodeStrokeColor = '#FFFFFF';
    fillStyle.nodeStrokeWidth = 0.5;
    fillStyle.valueLabelColor = '#FFFFFF'; // For labels on links/nodes, ensuring contrast

    // Helper for text measurement (not strictly used for layout in this chart, but required)
    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-weight', fontWeight);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-family', fontFamily);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No DOM append/remove needed for getBBox on text if attributes are set
        return tempText.getBBox().width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 50, bottom: 40, left: 150 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const nodeWidth = 20; // Width of the rectangles representing nodes
    const nodePadding = 10; // Vertical padding between nodes
    const minHeightToShowLabel = 18; // Minimum height for a link/node to show its value label

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const timePoints = [...new Set(chartData.map(d => d[timeFieldName]))].sort();
    if (timePoints.length !== 2) {
        const errorMsg = "Alluvial chart requires exactly two time points. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const categories = [...new Set(chartData.map(d => d[xFieldName]))];
    const valuesByTimeAndCategory = {};
    timePoints.forEach(time => {
        valuesByTimeAndCategory[time] = {};
        categories.forEach(category => {
            const filteredData = chartData.filter(d => d[timeFieldName] === time && d[xFieldName] === category);
            valuesByTimeAndCategory[time][category] = d3.sum(filteredData, d => +d[yFieldName]);
        });
    });

    const validCategories = categories.filter(category =>
        valuesByTimeAndCategory[timePoints[0]][category] > 0 &&
        valuesByTimeAndCategory[timePoints[1]][category] > 0
    );

    if (validCategories.length === 0) {
        const errorMsg = "No categories found with data at both time points. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    
    const categoryToColorMap = {};
    validCategories.forEach((category, index) => {
        if (colors.field && colors.field[category]) {
            categoryToColorMap[category] = colors.field[category];
        } else if (colors.available_colors && colors.available_colors.length > 0) {
            categoryToColorMap[category] = colors.available_colors[index % colors.available_colors.length];
        } else {
            categoryToColorMap[category] = defaultAvailableColors[index % defaultAvailableColors.length];
        }
    });
    const finalFallbackColor = (colors.other && colors.other.primary) || defaultPrimaryColor;
    const accessCategoryColor = (category) => categoryToColorMap[category] || finalFallbackColor;


    const sortedCategoriesByTime = {};
    timePoints.forEach(time => {
        sortedCategoriesByTime[time] = validCategories
            .filter(cat => valuesByTimeAndCategory[time][cat] > 0) // Ensure category still valid for this time point
            .sort((a, b) => valuesByTimeAndCategory[time][b] - valuesByTimeAndCategory[time][a]); // Descending sort
    });

    const nodesData = [];
    timePoints.forEach((time, timeIndex) => {
        sortedCategoriesByTime[time].forEach((category, i) => {
            nodesData.push({
                id: `${time}_${category}`, name: category, time: time,
                value: valuesByTimeAndCategory[time][category],
                color: accessCategoryColor(category),
                xPos: timeIndex, // 0 for first time point, 1 for second
                order: i
            });
        });
    });

    const linksData = [];
    // Iterate over categories in the first time point that are also in the second
    sortedCategoriesByTime[timePoints[0]].forEach(category => {
        if (sortedCategoriesByTime[timePoints[1]].includes(category)) {
            linksData.push({
                sourceId: `${timePoints[0]}_${category}`,
                targetId: `${timePoints[1]}_${category}`,
                value: valuesByTimeAndCategory[timePoints[0]][category], // Value at source
                targetValue: valuesByTimeAndCategory[timePoints[1]][category], // Value at target
                color: accessCategoryColor(category),
                categoryName: category
            });
        }
    });
    
    // Calculate vertical layout (y0, y1 for nodes)
    timePoints.forEach((time, timeIndex) => {
        const currentTimeNodes = nodesData.filter(n => n.time === time);
        const totalValueForTime = d3.sum(currentTimeNodes, d => d.value);
        let currentY = 0;
        
        currentTimeNodes.forEach(node => {
            const nodeHeight = (node.value / totalValueForTime) * (innerHeight - (currentTimeNodes.length - 1) * nodePadding);
            node.x0 = timeIndex * (innerWidth - nodeWidth);
            node.x1 = node.x0 + nodeWidth;
            node.y0 = currentY;
            node.y1 = currentY + Math.max(0, nodeHeight); // Ensure non-negative height
            currentY = node.y1 + nodePadding;
        });
    });

    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales (e.g., linear, band) are used. Layout is calculated manually.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    timePoints.forEach((time, i) => {
        mainChartGroup.append("text")
            .attr("class", "label time-label")
            .attr("x", i === 0 ? 0 : innerWidth)
            .attr("y", -15) // Position above the chart area
            .attr("text-anchor", i === 0 ? "start" : "end")
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", fillStyle.typography.titleFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(time);
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    // Render links (flows)
    const linksGroup = mainChartGroup.append("g")
        .attr("class", "other links-group");

    linksGroup.selectAll("path.link-flow")
        .data(linksData)
        .enter().append("path")
        .attr("class", "mark link-flow")
        .attr("d", d => {
            const sourceNode = nodesData.find(n => n.id === d.sourceId);
            const targetNode = nodesData.find(n => n.id === d.targetId);
            if (!sourceNode || !targetNode) return ""; // Should not happen with valid data

            const path = d3.path();
            const controlPointXOffset = (targetNode.x0 - sourceNode.x1) / 3;

            path.moveTo(sourceNode.x1, sourceNode.y0);
            path.bezierCurveTo(sourceNode.x1 + controlPointXOffset, sourceNode.y0, 
                              targetNode.x0 - controlPointXOffset, targetNode.y0, 
                              targetNode.x0, targetNode.y0);
            path.lineTo(targetNode.x0, targetNode.y1);
            path.bezierCurveTo(targetNode.x0 - controlPointXOffset, targetNode.y1, 
                              sourceNode.x1 + controlPointXOffset, sourceNode.y1, 
                              sourceNode.x1, sourceNode.y1);
            path.closePath();
            return path.toString();
        })
        .attr("fill", d => d.color)
        .attr("fill-opacity", fillStyle.linkFillOpacity)
        .attr("stroke", "none");

    // Render nodes (rectangles)
    const nodesGroup = mainChartGroup.append("g")
        .attr("class", "other nodes-group");

    nodesGroup.selectAll("rect.node-rect")
        .data(nodesData)
        .enter().append("rect")
        .attr("class", "mark node-rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => Math.max(0, d.y1 - d.y0)) // Ensure non-negative height
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => d.color)
        .attr("stroke", fillStyle.nodeStrokeColor)
        .attr("stroke-width", fillStyle.nodeStrokeWidth);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Render value labels on links
    const valueLabelsGroup = mainChartGroup.append("g")
        .attr("class", "other value-labels-group");
        
    linksData.forEach(link => {
        const sourceNode = nodesData.find(n => n.id === link.sourceId);
        const targetNode = nodesData.find(n => n.id === link.targetId);
        if (!sourceNode || !targetNode) return;

        const sourceHeight = sourceNode.y1 - sourceNode.y0;
        const targetHeight = targetNode.y1 - targetNode.y0;

        // Source (left) value label
        if (sourceHeight >= minHeightToShowLabel) {
            valueLabelsGroup.append("text")
                .attr("class", "value data-value-label source-value")
                .attr("x", sourceNode.x1 + 5)
                .attr("y", (sourceNode.y0 + sourceNode.y1) / 2)
                .attr("text-anchor", "start")
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .attr("fill", fillStyle.valueLabelColor)
                .text(`$${link.value.toFixed(1)}B`); // Preserving original format
        }

        // Target (right) value label
        if (targetHeight >= minHeightToShowLabel) {
            valueLabelsGroup.append("text")
                .attr("class", "value data-value-label target-value")
                .attr("x", targetNode.x0 - 5)
                .attr("y", (targetNode.y0 + targetNode.y1) / 2)
                .attr("text-anchor", "end")
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .attr("fill", fillStyle.valueLabelColor)
                .text(`$${link.targetValue.toFixed(1)}B`); // Preserving original format
        }
    });

    // Render category labels (only for the first time point, on the left)
    const categoryLabelsGroup = mainChartGroup.append("g")
        .attr("class", "other category-labels-group");

    nodesData.filter(node => node.xPos === 0).forEach(node => { // xPos === 0 means first time point
        if (node.y1 - node.y0 > 0) { // Only show label if node has positive height
             categoryLabelsGroup.append("text")
                .attr("class", "label category-label")
                .attr("x", node.x0 - 10) // Position to the left of the node
                .attr("y", (node.y0 + node.y1) / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .attr("fill", fillStyle.textColor)
                .text(node.name);
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}