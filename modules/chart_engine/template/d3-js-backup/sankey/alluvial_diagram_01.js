/* REQUIREMENTS_BEGIN
{
  "chart_type": "Alluvial Diagram",
  "chart_name": "alluvial_diagram_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["x", "group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 10], [0, "inf"], [2, 10]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x", "group"],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
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
    const colors = data.colors || {}; // or data.colors_dark for dark themes, assuming light theme for now
    const images = data.images || {}; // Not used in this chart type
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const sourceFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const targetFieldConfig = dataColumns.find(col => col.role === "group");

    let missingFields = [];
    if (!sourceFieldConfig) missingFields.push("x (source)");
    if (!valueFieldConfig) missingFields.push("y (value)");
    if (!targetFieldConfig) missingFields.push("group (target)");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: Role(s) ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const sourceFieldName = sourceFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;
    const targetFieldName = targetFieldConfig.name;
    const sourceFieldLabel = sourceFieldConfig.label || sourceFieldName;
    const targetFieldLabel = targetFieldConfig.label || targetFieldName;


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '14px', // Adjusted from 14px in original
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold', // Adjusted from bold in original
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#333333',
        chartBackground: colors.background_color || '#FFFFFF',
        defaultSourceNodeColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4',
        defaultTargetNodeColor: (colors.other && colors.other.secondary) ? colors.other.secondary : '#ff7f0e',
        defaultLinkColor: (colors.other && colors.other.tertiary) ? colors.other.tertiary : '#cccccc', // Added a tertiary for links or use a fixed grey
    };
    
    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textEl.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textEl.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // document.body.appendChild(svg); // Temporarily append to measure, then remove
        const width = textEl.getBBox().width;
        // svg.remove();
        return width;
    };
    
    const getNodeColor = (nodeName, nodeType, colorIndex) => {
        const fieldKey = nodeType === 'source' ? sourceFieldName : targetFieldName;
        if (colors.field && colors.field[fieldKey] && colors.field[fieldKey][nodeName]) {
            return colors.field[fieldKey][nodeName];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[colorIndex % colors.available_colors.length];
        }
        return nodeType === 'source' ? fillStyle.defaultSourceNodeColor : fillStyle.defaultTargetNodeColor;
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 150, bottom: 50, left: 150 }; // Adjusted margins
    
    // Adjust margins based on potential label lengths for source/target titles
    const sourceTitleWidth = estimateTextWidth(sourceFieldLabel, { fontFamily: fillStyle.typography.titleFontFamily, fontSize: fillStyle.typography.titleFontSize, fontWeight: fillStyle.typography.titleFontWeight });
    const targetTitleWidth = estimateTextWidth(targetFieldLabel, { fontFamily: fillStyle.typography.titleFontFamily, fontSize: fillStyle.typography.titleFontSize, fontWeight: fillStyle.typography.titleFontWeight });

    // Estimate max label widths for nodes (this is a simplification)
    let maxSourceLabelWidth = 0;
    let maxTargetLabelWidth = 0;

    const tempSourceCategories = [...new Set(chartData.map(d => d[sourceFieldName]))];
    const tempTargetCategories = [...new Set(chartData.map(d => d[targetFieldName]))];

    tempSourceCategories.forEach(cat => {
        maxSourceLabelWidth = Math.max(maxSourceLabelWidth, estimateTextWidth(`${cat} (0000)`, { fontFamily: fillStyle.typography.labelFontFamily, fontSize: fillStyle.typography.labelFontSize, fontWeight: fillStyle.typography.labelFontWeight }));
    });
    tempTargetCategories.forEach(cat => {
        maxTargetLabelWidth = Math.max(maxTargetLabelWidth, estimateTextWidth(`${cat} (0000)`, { fontFamily: fillStyle.typography.labelFontFamily, fontSize: fillStyle.typography.labelFontSize, fontWeight: fillStyle.typography.labelFontWeight }));
    });
    
    chartMargins.left = Math.max(chartMargins.left, maxSourceLabelWidth + 10, sourceTitleWidth / 2 + 10); // +10 for padding
    chartMargins.right = Math.max(chartMargins.right, maxTargetLabelWidth + 10, targetTitleWidth / 2 + 10); // +10 for padding


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Check container size and margins.";
        console.error(errorMsg);
        svgRoot.html(`<text x="10" y="20" fill="red" style="font-family: sans-serif;">${errorMsg}</text>`);
        return svgRoot.node();
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const sourceTotals = {};
    const targetTotals = {};

    chartData.forEach(d => {
        const val = parseFloat(d[valueFieldName]);
        if (isNaN(val) || val < 0) return; // Skip invalid values
        sourceTotals[d[sourceFieldName]] = (sourceTotals[d[sourceFieldName]] || 0) + val;
        targetTotals[d[targetFieldName]] = (targetTotals[d[targetFieldName]] || 0) + val;
    });

    const sourceCategories = [...new Set(chartData.map(d => d[sourceFieldName]))];
    const targetCategories = [...new Set(chartData.map(d => d[targetFieldName]))];

    const sankeyNodesInput = [];
    const sankeyLinksInput = [];

    sourceCategories.forEach((category, i) => {
        if (sourceTotals[category] > 0) { // Only add nodes with positive flow
            sankeyNodesInput.push({
                id: category, // Original name as ID for source
                name: category,
                type: "source",
                value: sourceTotals[category]
            });
        }
    });

    targetCategories.forEach((category, i) => {
         if (targetTotals[category] > 0) { // Only add nodes with positive flow
            sankeyNodesInput.push({
                id: `target_node_${category}`, // Prefix to ensure unique ID from source nodes
                name: category,
                type: "target",
                value: targetTotals[category]
            });
        }
    });
    
    chartData.forEach(d => {
        const val = parseFloat(d[valueFieldName]);
        if (isNaN(val) || val <= 0) return; // Skip zero/negative/invalid values for links
        
        // Ensure source and target nodes exist (were not filtered out due to zero total)
        const sourceNodeExists = sankeyNodesInput.some(n => n.id === d[sourceFieldName]);
        const targetNodeExists = sankeyNodesInput.some(n => n.id === `target_node_${d[targetFieldName]}`);

        if (sourceNodeExists && targetNodeExists) {
            sankeyLinksInput.push({
                source: d[sourceFieldName],
                target: `target_node_${d[targetFieldName]}`,
                value: val
            });
        }
    });

    if (sankeyNodesInput.length === 0 || sankeyLinksInput.length === 0) {
        const errorMsg = "No valid data available to render Sankey nodes or links after processing.";
        console.warn(errorMsg); // Warn instead of error, render empty chart
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .text("No data to display.");
        return svgRoot.node();
    }

    // Block 6: Scale Definition & Configuration
    // Color scales are handled by getNodeColor helper. No explicit D3 scales here for colors.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Column Titles (Source/Target Labels)
    svgRoot.append("text")
        .attr("class", "label source-column-title")
        .attr("x", chartMargins.left) // Positioned relative to the start of the source nodes column
        .attr("y", chartMargins.top / 2)
        .attr("text-anchor", "start") // Aligned with the start of the column
        .style("font-family", fillStyle.typography.titleFontFamily)
        .style("font-size", fillStyle.typography.titleFontSize)
        .style("font-weight", fillStyle.typography.titleFontWeight)
        .attr("fill", fillStyle.textColor)
        .text(sourceFieldLabel);

    svgRoot.append("text")
        .attr("class", "label target-column-title")
        .attr("x", containerWidth - chartMargins.right) // Positioned relative to the start of the target nodes column
        .attr("y", chartMargins.top / 2)
        .attr("text-anchor", "end") // Aligned with the end of the column
        .style("font-family", fillStyle.typography.titleFontFamily)
        .style("font-size", fillStyle.typography.titleFontSize)
        .style("font-weight", fillStyle.typography.titleFontWeight)
        .attr("fill", fillStyle.textColor)
        .text(targetFieldLabel);

    // Block 8: Main Data Visualization Rendering
    const sankeyGenerator = d3.sankey()
        .nodeId(d => d.id)
        .nodeWidth(variables.sankeyNodeWidth || 20) // Configurable node width
        .nodePadding(variables.sankeyNodePadding || 10) // Configurable node padding
        .extent([[0, 0], [innerWidth, innerHeight]])
        .nodeSort((a, b) => {
            if (a.type === b.type) { // Sort only nodes within the same column (source or target)
                return b.value - a.value; // Descending by value
            }
            return null; // Maintain D3's default cross-column ordering
        });

    const { nodes: sankeyLayoutNodes, links: sankeyLayoutLinks } = sankeyGenerator({
        nodes: sankeyNodesInput.map(d => Object.assign({}, d)), // Use copies for layout
        links: sankeyLinksInput.map(d => Object.assign({}, d))
    });

    // Assign colorIndex based on sorted position for consistent coloring with available_colors
    const sourceNodesSorted = sankeyLayoutNodes.filter(d => d.type === "source").sort((a, b) => a.y0 - b.y0);
    sourceNodesSorted.forEach((node, i) => node.colorIndex = i);
    
    const targetNodesSorted = sankeyLayoutNodes.filter(d => d.type === "target").sort((a, b) => a.y0 - b.y0);
    targetNodesSorted.forEach((node, i) => node.colorIndex = i);


    const linkPathGenerator = d3.sankeyLinkHorizontal();

    mainChartGroup.append("g")
        .attr("class", "links-group")
        .selectAll("path.mark")
        .data(sankeyLayoutLinks)
        .enter()
        .append("path")
        .attr("class", "mark link")
        .attr("d", linkPathGenerator)
        .attr("stroke", fillStyle.defaultLinkColor)
        .attr("stroke-opacity", 0.5) // Original had 0.7, using 0.5 for cleaner look
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("fill", "none");

    const nodeGroups = mainChartGroup.append("g")
        .attr("class", "nodes-group")
        .selectAll("g.node")
        .data(sankeyLayoutNodes)
        .enter()
        .append("g")
        .attr("class", d => `node node-${d.type} mark`) // Added mark class
        .attr("transform", d => `translate(${d.x0}, ${d.y0})`);

    nodeGroups.append("rect")
        .attr("class", "node-rect mark") // Added mark class
        .attr("height", d => Math.max(1, d.y1 - d.y0)) // Ensure positive height
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => getNodeColor(d.name, d.type, d.colorIndex));

    nodeGroups.append("text")
        .attr("class", "label node-label")
        .attr("x", d => d.type === "source" ? -8 : (d.x1 - d.x0) + 8)
        .attr("y", d => (d.y1 - d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.type === "source" ? "end" : "start")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .attr("fill", fillStyle.textColor)
        .text(d => {
            const valueFormatted = d3.format(",.0f")(d.value); // Format value
            return `${d.name} (${valueFormatted})`;
        });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements like tooltips or annotations in this refactoring pass.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}