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
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data.data;
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // or data.colors_dark for dark themes, assuming light for now
    const imagesConfig = data.images || {}; // Not used in this chart, but parsed as per spec
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const sourceFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const targetFieldConfig = dataColumns.find(col => col.role === "group");

    if (!sourceFieldConfig || !valueFieldConfig || !targetFieldConfig) {
        let missing = [];
        if (!sourceFieldConfig) missing.push("x role");
        if (!valueFieldConfig) missing.push("y role");
        if (!targetFieldConfig) missing.push("group role");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')} in dataColumns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
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
            titleFontFamily: typographyConfig.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyConfig.title?.font_size || '16px',
            titleFontWeight: typographyConfig.title?.font_weight || 'bold',
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '14px', // Adjusted from 12px for node labels
            labelFontWeight: typographyConfig.label?.font_weight || 'bold', // Adjusted for node labels
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        },
        textColor: colorsConfig.text_color || '#0f223b',
        primaryBaseColor: colorsConfig.other?.primary || "#902d1f",
        secondaryBaseColor: colorsConfig.other?.secondary || "#2f6ae4",
        linkColorOpacity: 0.7, // Default link opacity
        nodeWidth: 20,
        nodePadding: 10,
    };
    
    // Helper to create a color scale (used as fallback)
    const createColorScale = (baseColor, count) => {
        const lightColor = d3.color(baseColor).brighter(0.5).toString();
        const darkColor = d3.color(baseColor).darker(0.5).toString();
        return d3.scaleLinear().domain([0, Math.max(0, count - 1)]).range([lightColor, darkColor]).interpolate(d3.interpolateHcl);
    };

    // In-memory text measurement utility
    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-weight', fontWeight || fillStyle.typography.labelFontWeight);
        textNode.setAttribute('font-size', fontSize || fillStyle.typography.labelFontSize);
        textNode.setAttribute('font-family', fontFamily || fillStyle.typography.labelFontFamily);
        textNode.textContent = text;
        svgNode.appendChild(textNode);
        // Note: getBBox on an unattached SVG element might be unreliable in some browsers.
        // The prompt mandates it not be attached to the DOM.
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements is problematic.
            const avgCharWidth = parseFloat(fontSize || fillStyle.typography.labelFontSize) * 0.6; // Rough estimate
            width = (text || "").length * avgCharWidth;
        }
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
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 150, bottom: 60, left: 150 }; // Adjusted margins
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated chart dimensions (innerWidth or innerHeight) are not positive. Cannot render.");
        svgRoot.append("text").text("Chart dimensions too small.").attr("x", 10).attr("y", 20).attr("fill", "red");
        return svgRoot.node();
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const sourceTotals = {};
    const targetTotals = {};
    chartDataInput.forEach(d => {
        const value = +d[valueFieldName];
        if (isNaN(value) || value < 0) return; // Skip invalid values
        sourceTotals[d[sourceFieldName]] = (sourceTotals[d[sourceFieldName]] || 0) + value;
        targetTotals[d[targetFieldName]] = (targetTotals[d[targetFieldName]] || 0) + value;
    });

    const sourceCategories = [...new Set(chartDataInput.map(d => d[sourceFieldName]))];
    const targetCategories = [...new Set(chartDataInput.map(d => d[targetFieldName]))];

    const sourceCategoryMap = new Map(sourceCategories.map((cat, i) => [cat, i]));
    const targetCategoryMap = new Map(targetCategories.map((cat, i) => [cat, i]));

    const nodesData = [
        ...sourceCategories.map((category, i) => ({
            id: category, name: category, type: "source", 
            originalCategoryIndex: i, value: sourceTotals[category] || 0
        })),
        ...targetCategories.map((category, i) => ({
            id: `target_${category}`, name: category, type: "target", 
            originalCategoryIndex: i, value: targetTotals[category] || 0
        }))
    ];

    const linksData = chartDataInput.map(d => ({
        source: d[sourceFieldName], 
        target: `target_${d[targetFieldName]}`, 
        value: +d[valueFieldName]
    })).filter(d => !isNaN(d.value) && d.value > 0);


    // Block 6: Scale Definition & Configuration
    const sourceNodeColorScale = createColorScale(fillStyle.primaryBaseColor, sourceCategories.length);
    const targetNodeColorScale = createColorScale(fillStyle.secondaryBaseColor, targetCategories.length);

    function getNodeFillColor(node) {
        if (colorsConfig.field && colorsConfig.field[node.name]) {
            return colorsConfig.field[node.name];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[node.originalCategoryIndex % colorsConfig.available_colors.length];
        }
        // Fallback to y-sorted index and pre-defined scales
        if (node.type === "source") {
            return sourceNodeColorScale(node.colorIndex);
        } else {
            return targetNodeColorScale(node.colorIndex);
        }
    }

    const sankeyLayout = d3.sankey()
        .nodeId(d => d.id)
        .nodeWidth(fillStyle.nodeWidth)
        .nodePadding(fillStyle.nodePadding)
        .extent([[0, 0], [innerWidth, innerHeight]])
        .nodeSort((a, b) => { // Sort nodes by value descending within each column
            if (a.value !== undefined && b.value !== undefined) {
                 if ((a.type === "source" && b.type === "source") || (a.type === "target" && b.type === "target")) {
                    return b.value - a.value;
                }
            }
            return 0; // Default sort if types differ or values are undefined
        });

    const { nodes: sankeyNodes, links: sankeyLinks } = sankeyLayout({
        nodes: nodesData.map(d => Object.assign({}, d)), // Use copies for layout
        links: linksData.map(d => Object.assign({}, d))
    });

    // Update node color indices based on y-position for smooth fallback color transitions
    const updateAndAssignColorIndex = (nodeType) => {
        const typeNodes = sankeyNodes.filter(d => d.type === nodeType);
        typeNodes.sort((a, b) => a.y0 - b.y0) // Sort by y-position
                 .forEach((node, i) => { node.colorIndex = i; }); // Assign colorIndex
    };
    updateAndAssignColorIndex("source");
    updateAndAssignColorIndex("target");

    // Assign final colors to nodes
    sankeyNodes.forEach(node => {
        node.color = getNodeFillColor(node);
    });
    
    // Assign colors to links based on source node
    sankeyLinks.forEach(link => {
        link.color = link.source.color;
    });


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Column Headers (Source and Target)
    mainChartGroup.append("text")
        .attr("class", "text label column-header")
        .attr("x", 0) 
        .attr("y", -chartMargins.top / 2 + 10) // Position above the chart
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(sourceFieldLabel);

    mainChartGroup.append("text")
        .attr("class", "text label column-header")
        .attr("x", innerWidth)
        .attr("y", -chartMargins.top / 2 + 10) // Position above the chart
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(targetFieldLabel);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    // Render Links
    mainChartGroup.append("g")
        .attr("class", "links-group other")
        .selectAll("path.mark")
        .data(sankeyLinks)
        .enter().append("path")
        .attr("class", "mark link")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => d.color)
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("fill", "none")
        .attr("stroke-opacity", fillStyle.linkColorOpacity);

    // Render Nodes
    const nodeGroups = mainChartGroup.append("g")
        .attr("class", "nodes-group other")
        .selectAll("g.node")
        .data(sankeyNodes)
        .enter().append("g")
        .attr("class", "node other"); // Group for rect and text

    nodeGroups.append("rect")
        .attr("class", "mark node-rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => d.color);

    // Render Node Labels
    nodeGroups.append("text")
        .attr("class", "label node-label")
        .attr("x", d => d.type === "source" ? d.x0 - 6 : d.x1 + 6)
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.type === "source" ? "end" : "start")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => `${d.name} (${d3.format(",.0f")(d.value)})`) // Format value
        .attr("fill", d => {
            const baseColor = d3.color(d.color);
            // Ensure sufficient contrast or use a standard text color
            return baseColor && baseColor.l > 0.5 ? baseColor.darker(1.5).toString() : fillStyle.textColor;
        });
        
    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}