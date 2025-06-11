/* REQUIREMENTS_BEGIN
{
  "chart_type": "Treemap",
  "chart_name": "treemap_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
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
    const colors = data.colors || data.colors_dark || {}; // Prefer data.colors, fallback to data.colors_dark
    const images = data.images || {}; // Not used in this treemap, but parsed for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !categoryColumn.name) {
        console.error("Critical chart config missing: Category field (role 'x') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (Category field name).</div>");
        return null;
    }
    if (!valueColumn || !valueColumn.name) {
        console.error("Critical chart config missing: Value field (role 'y') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (Value field name).</div>");
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold', // Default bold for category names
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#FFFFFF', // Default white text, assuming dark cells or user configured for contrast
        cellStrokeColor: (colors.other && colors.other.stroke) ? colors.other.stroke : '#FFFFFF',
        chartBackground: colors.background_color || 'transparent', // Default transparent background
    };

    // In-memory text measurement utility
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontProps.font_family || 'sans-serif');
        textNode.setAttribute('font-size', fontProps.font_size || '10px');
        textNode.setAttribute('font-weight', fontProps.font_weight || 'normal');
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        // Note: getBBox on an element not in the live DOM can be unreliable.
        // This is per directive "MUST NOT be appended to the document DOM".
        try {
            return textNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-DOM elements
            return (text || "").length * (parseInt(fontProps.font_size || "10px", 10) * 0.6); // Rough approximation
        }
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

    const chartMargins = { top: 10, right: 10, bottom: 10, left: 10 }; // Standard margins for treemap padding

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const hierarchyData = {
        name: "root",
        children: []
    };

    const groupedData = d3.group(chartData, d => d[categoryFieldName]);
    
    groupedData.forEach((values, category) => {
        const totalValue = d3.sum(values, d => d[valueFieldName]);
        if (totalValue > 0) { // Treemap typically doesn't show zero-value items
            hierarchyData.children.push({
                name: category,
                value: totalValue
            });
        }
    });

    if (!hierarchyData.children || hierarchyData.children.length === 0) {
        console.warn("No valid data to display in treemap after processing.");
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .text("No data available for treemap.");
        return svgRoot.node();
    }
    
    const hierarchyRoot = d3.hierarchy(hierarchyData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value); // Sort descending by value

    // Block 6: Scale Definition & Configuration
    const colorScale = (categoryName) => {
        if (colors.field && colors.field[categoryName]) {
            return colors.field[categoryName];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            // Consistent color mapping for categories
            const categoryIndex = hierarchyData.children.findIndex(item => item.name === categoryName);
            return colors.available_colors[categoryIndex % colors.available_colors.length];
        }
        // Fallback to d3.schemeCategory10 if no colors provided
        const categoryIndex = hierarchyData.children.findIndex(item => item.name === categoryName);
        return d3.schemeTableau10[categoryIndex % d3.schemeTableau10.length];
    };

    const treemapLayout = d3.treemap()
        .size([innerWidth, innerHeight])
        .padding(3) // Padding between cells
        .round(true);

    const rootNode = treemapLayout(hierarchyRoot);
    
    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this treemap visualization.

    // Block 8: Main Data Visualization Rendering
    const leafNodes = mainChartGroup.selectAll("g.leaf-node")
        .data(rootNode.leaves())
        .join("g")
        .attr("class", "mark leaf-node")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    leafNodes.append("rect")
        .attr("class", "value treemap-cell")
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("fill", d => colorScale(d.data.name))
        .attr("stroke", fillStyle.cellStrokeColor);

    // Tooltip (simple, non-visual)
    const formatValue = d3.format(",d");
    leafNodes.append("title")
        .text(d => `${d.data.name}: ${formatValue(d.value)}`);

    // Category name labels
    leafNodes.append("text")
        .attr("class", "label category-name")
        .attr("x", 4) // Padding from left
        .attr("y", parseInt(fillStyle.typography.labelFontSize, 10) * 0.8 + 4) // Adjust y based on font size, plus padding
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d.data.name)
        .each(function(d) {
            const textElement = d3.select(this);
            const rectWidth = d.x1 - d.x0;
            const rectHeight = d.y1 - d.y0;
            let textContent = d.data.name;

            // Hide if cell too small for label font size
            if (rectHeight < (parseInt(fillStyle.typography.labelFontSize, 10) + 8)) { // 8px for padding top/bottom
                 textElement.style("display", "none");
                 return;
            }

            // Truncate if text width exceeds cell width (minus padding)
            let textNodeWidth = this.getBBox().width;
            while (textNodeWidth > rectWidth - 8 && textContent.length > 1) { // 8px for padding left/right
                textContent = textContent.slice(0, -1);
                textElement.text(textContent + "…");
                textNodeWidth = this.getBBox().width;
            }
            if (textContent.length <= 1 && textNodeWidth > rectWidth - 8) { // If even one char + ellipsis is too long
                 textElement.style("display", "none");
            }
        });

    // Value labels
    leafNodes.append("text")
        .attr("class", "text value-label")
        .attr("x", 4) // Padding from left
        .attr("y", parseInt(fillStyle.typography.labelFontSize, 10) * 0.8 + 4 + parseInt(fillStyle.typography.annotationFontSize, 10) * 1.2) // Position below category name
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => formatValue(d.value))
        .each(function(d) {
            const textElement = d3.select(this);
            const rectWidth = d.x1 - d.x0;
            const rectHeight = d.y1 - d.y0;
            const labelHeight = parseInt(fillStyle.typography.labelFontSize, 10);
            const valueHeight = parseInt(fillStyle.typography.annotationFontSize, 10);

            // Hide if cell too small for both labels or text width exceeds cell width
            if (rectHeight < (labelHeight + valueHeight + 12) || this.getBBox().width > rectWidth - 8) { // 12px for paddings
                textElement.style("display", "none");
            }
        });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations or interactive elements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}