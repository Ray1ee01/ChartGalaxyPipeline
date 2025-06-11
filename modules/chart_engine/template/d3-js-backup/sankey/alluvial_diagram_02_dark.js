/* REQUIREMENTS_BEGIN
{
  "chart_type": "Alluvial Diagram",
  "chart_name": "alluvial_diagram_02_dark",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 10], [0, "inf"], [2, 2]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 600,
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors_dark || {}; // Assuming dark theme as per original
    const rawImages = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldRole = "x";
    const valueFieldRole = "y";
    const timeFieldRole = "group";

    const categoryColumn = dataColumns.find(col => col.role === categoryFieldRole);
    const valueColumn = dataColumns.find(col => col.role === valueFieldRole);
    const timeColumn = dataColumns.find(col => col.role === timeFieldRole);

    if (!categoryColumn || !valueColumn || !timeColumn) {
        let missing = [];
        if (!categoryColumn) missing.push(`role '${categoryFieldRole}'`);
        if (!valueColumn) missing.push(`role '${valueFieldRole}'`);
        if (!timeColumn) missing.push(`role '${timeFieldRole}'`);
        const errorMsg = `Critical chart config missing: dataColumns for ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;
    const timeFieldName = timeColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            title: { // For time point labels
                fontFamily: (rawTypography.title && rawTypography.title.font_family) ? rawTypography.title.font_family : 'Arial, sans-serif',
                fontSize: (rawTypography.title && rawTypography.title.font_size) ? rawTypography.title.font_size : '16px',
                fontWeight: (rawTypography.title && rawTypography.title.font_weight) ? rawTypography.title.font_weight : 'bold',
            },
            label: { // For category labels
                fontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
                fontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '14px',
                fontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'bold',
            },
            annotation: { // For value labels on links
                fontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
                fontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '12px',
                fontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'bold',
            }
        },
        textColor: rawColors.text_color || "#E0E0E0",
        backgroundColor: rawColors.background_color || "#121212",
        nodeStrokeColor: rawColors.other && rawColors.other.stroke ? rawColors.other.stroke : "#FFFFFF", // Example, can be more specific
        defaultCategoryColors: rawColors.available_colors || ["#e74c3c", "#f39c12", "#f1c40f", "#2ecc71", "#3498db", "#9b59b6", "#1abc9c", "#95a5a6", "#e67e22", "#34495e"],
        iconBackgroundColor: rawColors.other && rawColors.other.icon_background ? rawColors.other.icon_background : "#FFFFFF",
        iconStrokeColor: rawColors.other && rawColors.other.icon_stroke ? rawColors.other.icon_stroke : "#EEEEEE",
    };

    fillStyle.getCategoryColor = (categoryValue, index) => {
        const colorFieldMap = rawColors.field || {};
        if (colorFieldMap[categoryValue]) {
            return colorFieldMap[categoryValue];
        }
        return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
    };

    fillStyle.getCategoryIconUrl = (categoryValue) => {
        const iconFieldMap = rawImages.field || {};
        return iconFieldMap[categoryValue] || null;
    };
    
    // In-memory text measurement utility (not used in this specific chart, but good practice)
    // function estimateTextWidth(text, fontFamily, fontSize, fontWeight) { ... } // As per Section III.2

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 150, bottom: 40, left: 150 }; // Accommodate labels/icons
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const nodeWidth = 20;
    const nodePadding = 10;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const timePoints = [...new Set(chartData.map(d => d[timeFieldName]))].sort();
    if (timePoints.length !== 2) {
        const errorMsg = "This chart requires exactly two time points from the 'group' field. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    const categories = [...new Set(chartData.map(d => d[categoryFieldName]))];

    const valuesByTimeAndCategory = {};
    timePoints.forEach(time => {
        valuesByTimeAndCategory[time] = {};
        categories.forEach(category => {
            const filteredData = chartData.filter(d => d[timeFieldName] === time && d[categoryFieldName] === category);
            const total = d3.sum(filteredData, d => +d[valueFieldName]);
            valuesByTimeAndCategory[time][category] = total;
        });
    });

    const sortedCategoriesByTime = {};
    timePoints.forEach(time => {
        sortedCategoriesByTime[time] = categories
            .filter(cat => valuesByTimeAndCategory[time][cat] > 0)
            .sort((a, b) => valuesByTimeAndCategory[time][b] - valuesByTimeAndCategory[time][a]);
    });

    const nodesData = [];
    sortedCategoriesByTime[timePoints[0]].forEach((category, i) => {
        nodesData.push({
            id: `${timePoints[0]}_${category}`,
            name: category,
            time: timePoints[0],
            value: valuesByTimeAndCategory[timePoints[0]][category],
            color: fillStyle.getCategoryColor(category, i),
            iconUrl: fillStyle.getCategoryIconUrl(category),
            xPos: 0, // 0 for left, 1 for right
            order: i
        });
    });

    sortedCategoriesByTime[timePoints[1]].forEach((category, i) => {
        const originalIndex = sortedCategoriesByTime[timePoints[0]].indexOf(category);
        const colorIndex = originalIndex !== -1 ? originalIndex : i + sortedCategoriesByTime[timePoints[0]].length; // Ensure unique color if new
        nodesData.push({
            id: `${timePoints[1]}_${category}`,
            name: category,
            time: timePoints[1],
            value: valuesByTimeAndCategory[timePoints[1]][category],
            color: fillStyle.getCategoryColor(category, colorIndex),
            iconUrl: fillStyle.getCategoryIconUrl(category),
            xPos: 1,
            order: i
        });
    });
    
    const linksData = [];
    sortedCategoriesByTime[timePoints[0]].forEach(category => {
        if (sortedCategoriesByTime[timePoints[1]].includes(category)) {
            const sourceNode = nodesData.find(n => n.id === `${timePoints[0]}_${category}`);
            linksData.push({
                sourceId: `${timePoints[0]}_${category}`,
                targetId: `${timePoints[1]}_${category}`,
                value: valuesByTimeAndCategory[timePoints[0]][category],
                targetValue: valuesByTimeAndCategory[timePoints[1]][category],
                color: sourceNode.color // Use source node's color for the link
            });
        }
    });

    // Calculate vertical layout for nodes
    timePoints.forEach((time, timeIndex) => {
        const timeNodes = nodesData.filter(n => n.time === time);
        const totalValueForTime = d3.sum(timeNodes, d => d.value);
        
        let currentY = 0;
        timeNodes.forEach(node => {
            const nodeHeight = (node.value / totalValueForTime) * (innerHeight - (timeNodes.length - 1) * nodePadding);
            node.x0 = timeIndex * (innerWidth - nodeWidth);
            node.x1 = node.x0 + nodeWidth;
            node.y0 = currentY;
            node.y1 = currentY + nodeHeight;
            currentY = node.y1 + nodePadding;
        });
    });

    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales for X/Y position; calculated directly. Color mapping handled by fillStyle.getCategoryColor.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    mainChartGroup.append("text")
        .attr("class", "label time-label")
        .attr("x", 0)
        .attr("y", -15)
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.title.fontFamily)
        .style("font-size", fillStyle.typography.title.fontSize)
        .style("font-weight", fillStyle.typography.title.fontWeight)
        .attr("fill", fillStyle.textColor)
        .text(timePoints[0]);

    mainChartGroup.append("text")
        .attr("class", "label time-label")
        .attr("x", innerWidth)
        .attr("y", -15)
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.title.fontFamily)
        .style("font-size", fillStyle.typography.title.fontSize)
        .style("font-weight", fillStyle.typography.title.fontWeight)
        .attr("fill", fillStyle.textColor)
        .text(timePoints[1]);

    // Block 8: Main Data Visualization Rendering
    // Render links
    mainChartGroup.append("g")
        .attr("class", "links-group")
        .selectAll("path.link")
        .data(linksData)
        .enter()
        .append("path")
        .attr("class", "mark link")
        .attr("d", d => {
            const sourceNode = nodesData.find(n => n.id === d.sourceId);
            const targetNode = nodesData.find(n => n.id === d.targetId);
            
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
        .attr("fill", d => d.color)
        .attr("opacity", 0.7) // Maintain some transparency for flows
        .attr("stroke", "none");

    // Render nodes (rectangles)
    mainChartGroup.append("g")
        .attr("class", "nodes-group")
        .selectAll("rect.node")
        .data(nodesData)
        .enter()
        .append("rect")
        .attr("class", "mark node")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => Math.max(0, d.y1 - d.y0)) // Ensure non-negative height
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => d.color)
        .attr("stroke", fillStyle.nodeStrokeColor)
        .attr("stroke-width", 0.5);

    // Block 9: Optional Enhancements & Post-Processing (Labels, Icons)
    // Add value labels on links
    linksData.forEach(link => {
        const sourceNode = nodesData.find(n => n.id === link.sourceId);
        const targetNode = nodesData.find(n => n.id === link.targetId);

        const sourceLabelX = sourceNode.x1 + 5;
        const targetLabelX = targetNode.x0 - 5;
        
        // Simplified Y position for labels, can be refined
        const sourceLabelY = (sourceNode.y0 + sourceNode.y1) / 2;
        const targetLabelY = (targetNode.y0 + targetNode.y1) / 2;

        mainChartGroup.append("text")
            .attr("class", "label value-label source-value")
            .attr("x", sourceLabelX)
            .attr("y", sourceLabelY)
            .attr("text-anchor", "start")
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.annotation.fontFamily)
            .style("font-size", fillStyle.typography.annotation.fontSize)
            .style("font-weight", fillStyle.typography.annotation.fontWeight)
            .attr("fill", fillStyle.textColor)
            .text(`$${link.value.toFixed(1)}B`);

        mainChartGroup.append("text")
            .attr("class", "label value-label target-value")
            .attr("x", targetLabelX)
            .attr("y", targetLabelY)
            .attr("text-anchor", "end")
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.annotation.fontFamily)
            .style("font-size", fillStyle.typography.annotation.fontSize)
            .style("font-weight", fillStyle.typography.annotation.fontWeight)
            .attr("fill", fillStyle.textColor)
            .text(`$${link.targetValue.toFixed(1)}B`);
    });
    
    // Add category labels and icons
    nodesData.forEach(node => {
        const nodeHeight = Math.max(0, node.y1 - node.y0);
        const iconSize = Math.max(16, Math.min(32, nodeHeight * 0.8, 40)); // Adjusted icon size constraints
        const iconRadius = iconSize / 2;

        if (node.time === timePoints[0]) { // Left side: category labels
            const labelX = node.x0 - 10;
            mainChartGroup.append("text")
                .attr("class", "label category-label")
                .attr("x", labelX)
                .attr("y", (node.y0 + node.y1) / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.label.fontFamily)
                .style("font-size", fillStyle.typography.label.fontSize)
                .style("font-weight", fillStyle.typography.label.fontWeight)
                .attr("fill", fillStyle.textColor)
                .text(node.name);
        } else { // Right side: icons
            const iconCenterX = node.x1 + iconRadius + 10; // Position icon to the right of node
            const iconCenterY = (node.y0 + node.y1) / 2;

            mainChartGroup.append("circle")
                .attr("class", "mark icon-background")
                .attr("cx", iconCenterX)
                .attr("cy", iconCenterY)
                .attr("r", iconRadius + 2)
                .attr("fill", fillStyle.iconBackgroundColor)
                .attr("stroke", fillStyle.iconStrokeColor)
                .attr("stroke-width", 1);

            if (node.iconUrl) {
                mainChartGroup.append("image")
                    .attr("class", "image category-image")
                    .attr("x", iconCenterX - iconRadius)
                    .attr("y", iconCenterY - iconRadius)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("href", node.iconUrl);
            } else { // Fallback: colored circle
                mainChartGroup.append("circle")
                    .attr("class", "icon category-icon-fallback")
                    .attr("cx", iconCenterX)
                    .attr("cy", iconCenterY)
                    .attr("r", iconRadius)
                    .attr("fill", node.color)
                    .attr("stroke", "none");
            }
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}