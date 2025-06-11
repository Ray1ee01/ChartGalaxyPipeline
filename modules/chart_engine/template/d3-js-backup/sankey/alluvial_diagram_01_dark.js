/* REQUIREMENTS_BEGIN
{
  "chart_type": "Alluvial Diagram",
  "chart_name": "alluvial_diagram_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 10], [0, "inf"], [2, 10]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 600,
  "background": "configurable",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "none",
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
    const D3colors = data.colors || data.colors_dark || {}; // Use data.colors for light, data.colors_dark for dark themes
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const sourceFieldRole = "x";
    const valueFieldRole = "y";
    const targetFieldRole = "group";

    const sourceColumn = dataColumns.find(col => col.role === sourceFieldRole);
    const valueColumn = dataColumns.find(col => col.role === valueFieldRole);
    const targetColumn = dataColumns.find(col => col.role === targetFieldRole);

    if (!sourceColumn || !valueColumn || !targetColumn) {
        const missing = [];
        if (!sourceColumn) missing.push(`role: ${sourceFieldRole}`);
        if (!valueColumn) missing.push(`role: ${valueFieldRole}`);
        if (!targetColumn) missing.push(`role: ${targetFieldRole}`);
        const errorMessage = `Critical chart config missing: dataColumns for roles [${missing.join(', ')}]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null;
    }

    const sourceFieldName = sourceColumn.name;
    const valueFieldName = valueColumn.name;
    const targetFieldName = targetColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    // Typography
    fillStyle.typography.defaultFontFamily = 'Arial, sans-serif';
    fillStyle.typography.titleFontSize = (typography.title && typography.title.font_size) ? typography.title.font_size : '16px';
    fillStyle.typography.titleFontWeight = (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold';
    fillStyle.typography.titleFontFamily = (typography.title && typography.title.font_family) ? typography.title.font_family : fillStyle.typography.defaultFontFamily;

    fillStyle.typography.labelFontSize = (typography.label && typography.label.font_size) ? typography.label.font_size : '14px'; // Adjusted default for visual preservation
    fillStyle.typography.labelFontWeight = (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold'; // Adjusted default
    fillStyle.typography.labelFontFamily = (typography.label && typography.label.font_family) ? typography.label.font_family : fillStyle.typography.defaultFontFamily;

    // Colors
    fillStyle.textColor = D3colors.text_color || '#212529'; // Default dark text
    fillStyle.chartBackground = D3colors.background_color || '#FFFFFF'; // Default light background
    fillStyle.primaryColor = (D3colors.other && D3colors.other.primary) ? D3colors.other.primary : '#4682B4'; // SteelBlue
    fillStyle.secondaryColor = (D3colors.other && D3colors.other.secondary) ? D3colors.other.secondary : '#FF7F50'; // Coral
    fillStyle.linkOpacity = 0.7;


    // Helper: In-memory text measurement (not strictly used by Sankey label placement but good practice to include)
    function estimateTextWidth(text, fontProps) {
        const defaultFont = "12px sans-serif";
        const font = fontProps ? `${fontProps.font_weight || 'normal'} ${fontProps.font_size || '12px'} ${fontProps.font_family || 'sans-serif'}` : defaultFont;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font', font); // Note: 'font' shorthand might not be fully supported by getBBox in all SVG impls.
        tempText.style.fontSize = fontProps.font_size;
        tempText.style.fontFamily = fontProps.font_family;
        tempText.style.fontWeight = fontProps.font_weight;
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // document.body.appendChild(tempSvg); // Temporarily append to measure, then remove - NO, DO NOT APPEND TO DOM
        const width = tempText.getBBox().width;
        // tempSvg.remove(); // Or parentNode.removeChild(tempSvg)
        return width;
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 150, bottom: 20, left: 150 }; // Simplified margins as titles are removed
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const sankeyNodesData = [];
    const sankeyLinksData = [];
    const uniqueNodes = new Map();

    function addNode(id, name, type) {
        if (!uniqueNodes.has(id)) {
            uniqueNodes.set(id, { id, name, type });
        }
    }

    chartData.forEach(d => {
        const sourceVal = d[sourceFieldName];
        const targetVal = d[targetFieldName];
        const value = +d[valueFieldName];

        if (value > 0) { // Only include links with positive value
            const sourceNodeId = `source_${sourceVal}`;
            const targetNodeId = `target_${targetVal}`;

            addNode(sourceNodeId, sourceVal, "source");
            addNode(targetNodeId, targetVal, "target");

            sankeyLinksData.push({
                source: sourceNodeId,
                target: targetNodeId,
                value: value,
                originalSource: sourceVal, // Keep original names for potential tooltips or debugging
                originalTarget: targetVal
            });
        }
    });
    
    sankeyNodesData.push(...uniqueNodes.values());


    // Block 6: Scale Definition & Configuration
    const sankeyGenerator = d3.sankey()
        .nodeId(d => d.id)
        .nodeWidth(20) // Standard Sankey node width
        .nodePadding(10) // Padding between nodes in the same column
        .extent([[0, 0], [innerWidth, innerHeight]])
        .nodeSort((a, b) => { // Sort nodes within each column by value, descending
            if (a.depth === b.depth) { // Only sort if in the same column (depth check is more robust for multi-level)
                 return b.value - a.value;
            }
            return a.depth - b.depth; // Maintain column order
        });

    const { nodes: sankeyLayoutNodes, links: sankeyLayoutLinks } = sankeyGenerator({
        nodes: sankeyNodesData.map(d => Object.assign({}, d)), // Use copies as Sankey mutates
        links: sankeyLinksData.map(d => Object.assign({}, d))
    });

    const linkPathGenerator = d3.sankeyLinkHorizontal();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this Alluvial chart. Column titles removed as per spec.

    // Block 8: Main Data Visualization Rendering
    // Render links
    const linkElements = mainChartGroup.append("g")
        .attr("class", "links-group")
        .attr("fill", "none")
        .attr("stroke-opacity", fillStyle.linkOpacity)
        .selectAll("path")
        .data(sankeyLayoutLinks)
        .enter()
        .append("path")
        .attr("class", "mark link")
        .attr("d", linkPathGenerator)
        .attr("stroke", d => d.source.type === 'source' ? fillStyle.primaryColor : fillStyle.secondaryColor) // Color link by source node
        .attr("stroke-width", d => Math.max(1, d.width));

    // Render nodes
    const nodeElementsGroup = mainChartGroup.append("g")
        .attr("class", "nodes-group")
        .selectAll("g")
        .data(sankeyLayoutNodes)
        .enter()
        .append("g")
        .attr("class", "mark node-group");

    nodeElementsGroup.append("rect")
        .attr("class", "mark node")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => Math.max(1, d.y1 - d.y0)) // Ensure height is at least 1
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => d.type === "source" ? fillStyle.primaryColor : fillStyle.secondaryColor);

    // Render node labels
    nodeElementsGroup.append("text")
        .attr("class", "label node-label")
        .attr("x", d => d.type === "source" ? d.x0 - 6 : d.x1 + 6)
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.type === "source" ? "end" : "start")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .attr("fill", fillStyle.textColor)
        .text(d => `${d.name} (${d3.format(",.0f")(d.value)})`); // Format value, .0f for integer

    // Block 9: Optional Enhancements & Post-Processing
    // No gradients or other complex effects as per requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}