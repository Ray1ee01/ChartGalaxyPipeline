/* REQUIREMENTS_BEGIN
{
  "chart_type": "Alluvial Diagram",
  "chart_name": "alluvial_diagram_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["temporal"]],
  "required_fields_range": [[2, 10], [0, "inf"], [2, 2]],
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
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldColumn = dataColumns.find(col => col.role === "x");
    const yFieldColumn = dataColumns.find(col => col.role === "y");
    const timeFieldColumn = dataColumns.find(col => col.role === "group");

    const criticalFields = {};
    if (xFieldColumn) criticalFields.xField = xFieldColumn.name;
    if (yFieldColumn) criticalFields.yField = yFieldColumn.name;
    if (timeFieldColumn) criticalFields.timeField = timeFieldColumn.name;

    const missingFields = ["xField", "yField", "timeField"].filter(f => !criticalFields[f]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMessage}</div>`);
        }
        return null;
    }
    const { xField, yField, timeField } = criticalFields;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            timeLabelFontFamily: (typographyConfig.title && typographyConfig.title.font_family) || 'Arial, sans-serif',
            timeLabelFontSize: (typographyConfig.title && typographyConfig.title.font_size) || '16px',
            timeLabelFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) || 'bold',

            categoryLabelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            categoryLabelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '14px',
            categoryLabelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'bold',

            flowValueLabelFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            flowValueLabelFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '12px',
            flowValueLabelFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'bold',
        },
        textColor: colorsConfig.text_color || '#0f223b',
        nodeStrokeColor: '#FFFFFF',
        nodeStrokeWidth: 0.5,
        iconBackgroundColor: '#FFFFFF',
        iconBackgroundStrokeColor: '#EEEEEE',
        iconBackgroundStrokeWidth: 1,
        flowValueLabelColor: '#FFFFFF', // Typically white for contrast on colored flows
    };

    fillStyle.timeLabelColor = fillStyle.textColor;
    fillStyle.categoryLabelColor = fillStyle.textColor;
    
    const defaultCategoricalColors = d3.schemeCategory10;

    fillStyle.getNodeColor = (categoryName, categoryIndex) => {
        if (colorsConfig.field && colorsConfig.field[categoryName]) {
            return colorsConfig.field[categoryName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[categoryIndex % colorsConfig.available_colors.length];
        }
        return defaultCategoricalColors[categoryIndex % defaultCategoricalColors.length];
    };
    // Link color will be same as source node color for simplicity in this alluvial
    fillStyle.getLinkColor = fillStyle.getNodeColor;

    fillStyle.getIconUrl = (categoryName) => {
        if (imagesConfig.field && imagesConfig.field[categoryName]) {
            return imagesConfig.field[categoryName];
        }
        return null;
    };
    
    // In-memory text measurement utility (not actively used in this chart's layout logic)
    /*
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: For accurate measurement, the SVG would need to be temporarily in the DOM
        // or have styles applied that match the final rendering environment.
        // This is a simplified version.
        // For headless environments or more accuracy:
        // document.body.appendChild(svg); // Temporarily append
        // const width = textElement.getBBox().width;
        // document.body.removeChild(svg); // Clean up
        // return width;
        // Simplified non-DOM version (less accurate, depends on browser):
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback, e.g., estimate based on character count
            return text.length * (parseInt(fontSize, 10) * 0.6);
        }
    }
    */

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "alluvial-chart-container");

    const chartMargins = { top: 40, right: 150, bottom: 40, left: 150 };

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const nodeVisualWidth = 20; // Width of the rectangles representing nodes
    const nodePadding = 10;   // Vertical padding between nodes in the same column

    // Block 5: Data Preprocessing & Transformation
    const timePoints = [...new Set(rawChartData.map(d => d[timeField]))].sort();
    if (timePoints.length !== 2) {
        const errorMessage = "Alluvial chart requires exactly two time points.";
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMessage}</div>`);
        return null;
    }

    const categories = [...new Set(rawChartData.map(d => d[xField]))];

    const valuesByTimeAndCategory = {};
    timePoints.forEach(tp => {
        valuesByTimeAndCategory[tp] = {};
        categories.forEach(cat => {
            const filteredData = rawChartData.filter(d => d[timeField] === tp && d[xField] === cat);
            valuesByTimeAndCategory[tp][cat] = d3.sum(filteredData, d => +d[yField]);
        });
    });

    const sortedCategoriesByTime = {};
    timePoints.forEach(tp => {
        sortedCategoriesByTime[tp] = categories
            .filter(cat => valuesByTimeAndCategory[tp][cat] > 0)
            .sort((a, b) => valuesByTimeAndCategory[tp][b] - valuesByTimeAndCategory[tp][a]);
    });

    const nodesData = [];
    // Left nodes (first time point)
    sortedCategoriesByTime[timePoints[0]].forEach((category, i) => {
        nodesData.push({
            id: `${timePoints[0]}_${category}`,
            name: category,
            timePoint: timePoints[0],
            value: valuesByTimeAndCategory[timePoints[0]][category],
            color: fillStyle.getNodeColor(category, i),
            iconUrl: fillStyle.getIconUrl(category),
            isLeftColumn: true,
            sortOrder: i 
        });
    });

    // Right nodes (second time point)
    sortedCategoriesByTime[timePoints[1]].forEach((category, i) => {
        const leftColumnIndex = sortedCategoriesByTime[timePoints[0]].indexOf(category);
        const colorIndex = leftColumnIndex !== -1 ? leftColumnIndex : i + sortedCategoriesByTime[timePoints[0]].length; // Ensure unique color index if new

        nodesData.push({
            id: `${timePoints[1]}_${category}`,
            name: category,
            timePoint: timePoints[1],
            value: valuesByTimeAndCategory[timePoints[1]][category],
            color: fillStyle.getNodeColor(category, colorIndex),
            iconUrl: fillStyle.getIconUrl(category),
            isLeftColumn: false,
            sortOrder: i
        });
    });
    
    // Calculate y-positions for nodes
    timePoints.forEach((tp, timeIndex) => {
        const currentColumnNodes = nodesData.filter(n => n.timePoint === tp);
        const totalValueInColumn = d3.sum(currentColumnNodes, d => d.value);
        if (totalValueInColumn === 0) return; // Avoid division by zero if a column has no value

        const totalPaddingInColumn = (currentColumnNodes.length - 1) * nodePadding;
        const availableHeightForNodes = innerHeight - totalPaddingInColumn;
        
        let currentY = 0;
        currentColumnNodes.forEach(node => {
            const nodeHeight = (node.value / totalValueInColumn) * availableHeightForNodes;
            node.x0 = timeIndex * (innerWidth - nodeVisualWidth);
            node.x1 = node.x0 + nodeVisualWidth;
            node.y0 = currentY;
            node.y1 = currentY + nodeHeight;
            currentY += nodeHeight + nodePadding;
        });
    });

    const linksData = [];
    sortedCategoriesByTime[timePoints[0]].forEach(category => {
        const sourceNode = nodesData.find(n => n.timePoint === timePoints[0] && n.name === category);
        const targetNode = nodesData.find(n => n.timePoint === timePoints[1] && n.name === category);

        if (sourceNode && targetNode && sourceNode.value > 0) { // Only create link if source has value and target exists
            linksData.push({
                sourceNodeId: sourceNode.id,
                targetNodeId: targetNode.id,
                value: sourceNode.value, // Flow value is based on source node's value for this category
                targetValue: targetNode.value, // Value at the target node for this category
                color: sourceNode.color // Link takes color of source node
            });
        }
    });

    // Block 6: Scale Definition & Configuration
    // Scales are implicitly handled by manual layout calculations in Block 5.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    mainChartGroup.append("text")
        .attr("class", "label time-label")
        .attr("x", 0)
        .attr("y", -15)
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.timeLabelFontFamily)
        .style("font-size", fillStyle.typography.timeLabelFontSize)
        .style("font-weight", fillStyle.typography.timeLabelFontWeight)
        .style("fill", fillStyle.timeLabelColor)
        .text(timePoints[0]);

    mainChartGroup.append("text")
        .attr("class", "label time-label")
        .attr("x", innerWidth)
        .attr("y", -15)
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.timeLabelFontFamily)
        .style("font-size", fillStyle.typography.timeLabelFontSize)
        .style("font-weight", fillStyle.typography.timeLabelFontWeight)
        .style("fill", fillStyle.timeLabelColor)
        .text(timePoints[1]);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    // Render links (flows)
    mainChartGroup.append("g")
        .attr("class", "links-group")
        .selectAll("path.link-path")
        .data(linksData)
        .enter()
        .append("path")
        .attr("class", "mark link-path")
        .attr("d", d => {
            const sourceNode = nodesData.find(n => n.id === d.sourceNodeId);
            const targetNode = nodesData.find(n => n.id === d.targetNodeId);
            if (!sourceNode || !targetNode) return "";

            const path = d3.path();
            path.moveTo(sourceNode.x1, sourceNode.y0);
            path.bezierCurveTo(
                sourceNode.x1 + (targetNode.x0 - sourceNode.x1) / 2, sourceNode.y0,
                targetNode.x0 - (targetNode.x0 - sourceNode.x1) / 2, targetNode.y0,
                targetNode.x0, targetNode.y0
            );
            path.lineTo(targetNode.x0, targetNode.y1);
            path.bezierCurveTo(
                targetNode.x0 - (targetNode.x0 - sourceNode.x1) / 2, targetNode.y1,
                sourceNode.x1 + (targetNode.x0 - sourceNode.x1) / 2, sourceNode.y1,
                sourceNode.x1, sourceNode.y1
            );
            path.closePath();
            return path.toString();
        })
        .style("fill", d => d.color)
        .style("stroke", "none");
        // .style("opacity", 0.7); // Optional: if flows need to be slightly transparent

    // Render nodes (rectangles)
    mainChartGroup.append("g")
        .attr("class", "nodes-group")
        .selectAll("rect.node-rect")
        .data(nodesData)
        .enter()
        .append("rect")
        .attr("class", "mark node-rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => Math.max(0, d.y1 - d.y0)) // Ensure height is not negative
        .style("fill", d => d.color)
        .style("stroke", fillStyle.nodeStrokeColor)
        .style("stroke-width", fillStyle.nodeStrokeWidth);

    // Render flow value labels
    const flowLabelsGroup = mainChartGroup.append("g").attr("class", "flow-labels-group");
    linksData.forEach(link => {
        const sourceNode = nodesData.find(n => n.id === link.sourceNodeId);
        const targetNode = nodesData.find(n => n.id === link.targetNodeId);
        if (!sourceNode || !targetNode || (sourceNode.y1 - sourceNode.y0 < 10) ) return; // Don't label very thin flows

        const sourceLabelX = sourceNode.x1 + 5;
        const targetLabelX = targetNode.x0 - 5;

        // Simplified Y positioning for labels on flows
        const sourceLabelY = sourceNode.y0 + (sourceNode.y1 - sourceNode.y0) * 0.5;
        const targetLabelY = targetNode.y0 + (targetNode.y1 - targetNode.y0) * 0.5;


        // Source value label (Time point 1)
        flowLabelsGroup.append("text")
            .attr("class", "label value flow-value-label source-value")
            .attr("x", sourceLabelX)
            .attr("y", sourceLabelY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.flowValueLabelFontFamily)
            .style("font-size", fillStyle.typography.flowValueLabelFontSize)
            .style("font-weight", fillStyle.typography.flowValueLabelFontWeight)
            .style("fill", fillStyle.flowValueLabelColor)
            .text(`$${link.value.toFixed(1)}B`);

        // Target value label (Time point 2)
        flowLabelsGroup.append("text")
            .attr("class", "label value flow-value-label target-value")
            .attr("x", targetLabelX)
            .attr("y", targetLabelY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.flowValueLabelFontFamily)
            .style("font-size", fillStyle.typography.flowValueLabelFontSize)
            .style("font-weight", fillStyle.typography.flowValueLabelFontWeight)
            .style("fill", fillStyle.flowValueLabelColor)
            .text(`$${link.targetValue.toFixed(1)}B`);
    });
    
    // Render category labels and icons
    const categoryEnhancementsGroup = mainChartGroup.append("g").attr("class", "category-enhancements-group");
    nodesData.forEach(node => {
        const nodeHeight = Math.max(0, node.y1 - node.y0);
        if (nodeHeight < 5) return; // Skip for very small nodes

        if (node.isLeftColumn) { // Left side: Category labels
            categoryEnhancementsGroup.append("text")
                .attr("class", "label category-label")
                .attr("x", node.x0 - 10)
                .attr("y", node.y0 + nodeHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.categoryLabelFontFamily)
                .style("font-size", fillStyle.typography.categoryLabelFontSize)
                .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
                .style("fill", fillStyle.categoryLabelColor)
                .text(node.name);
        } else { // Right side: Icons
            const iconSize = Math.max(16, Math.min(32, nodeHeight * 0.8, innerWidth * 0.05)); // Adjusted icon size logic
            const iconRadius = iconSize / 2;
            const iconCenterX = node.x1 + iconRadius + 10; // Position icon to the right of the node
            const iconCenterY = node.y0 + nodeHeight / 2;

            categoryEnhancementsGroup.append("circle")
                .attr("class", "other icon-background")
                .attr("cx", iconCenterX)
                .attr("cy", iconCenterY)
                .attr("r", iconRadius + 2)
                .style("fill", fillStyle.iconBackgroundColor)
                .style("stroke", fillStyle.iconBackgroundStrokeColor)
                .style("stroke-width", fillStyle.iconBackgroundStrokeWidth);

            if (node.iconUrl) {
                categoryEnhancementsGroup.append("image")
                    .attr("class", "icon image category-icon")
                    .attr("x", iconCenterX - iconRadius)
                    .attr("y", iconCenterY - iconRadius)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("href", node.iconUrl);
            } else {
                categoryEnhancementsGroup.append("circle")
                    .attr("class", "icon mark category-icon-fallback")
                    .attr("cx", iconCenterX)
                    .attr("cy", iconCenterY)
                    .attr("r", iconRadius)
                    .style("fill", node.color);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Tooltips, complex interactions - not implemented here for simplicity)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}