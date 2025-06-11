/* REQUIREMENTS_BEGIN
{
  "chart_type": "Treemap",
  "chart_name": "treemap_clean",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[1, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 300,
  "min_width": 400,
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || (data.colors_dark || {}); // Assuming colors_dark is an alternative theme
    const images = data.images || {}; // Though not used in this treemap, parse as per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !categoryColumn.name) {
        console.error("Critical chart config missing: Category field (role 'x') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Category field configuration is missing.</div>");
        return null;
    }
    if (!valueColumn || !valueColumn.name) {
        console.error("Critical chart config missing: Value field (role 'y') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Value field configuration is missing.</div>");
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;
    const valueFieldUnit = valueColumn.unit === "none" || !valueColumn.unit ? '' : valueColumn.unit;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#0f223b',
        chartBackground: colors.background_color || '#FFFFFF',
        defaultCellStroke: '#FFFFFF', // Stroke for treemap cells
        cellBorderRadius: variables.cellBorderRadius !== undefined ? variables.cellBorderRadius : 2,
        cellTextPadding: variables.cellTextPadding !== undefined ? variables.cellTextPadding : 5,
    };

    const defaultColorScale = d3.scaleOrdinal(d3.schemeCategory10);
    fillStyle.getCellColor = (categoryName, index) => {
        if (colors.field && colors.field[categoryName]) {
            return colors.field[categoryName];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[index % colors.available_colors.length];
        }
        return defaultColorScale(categoryName);
    };
    
    function estimateTextWidth(text, fontProps) {
        if (!text || typeof text !== 'string') return 0;
        const { fontFamily, fontSize, fontWeight } = fontProps;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.visibility = 'hidden'; // Keep it off-screen if appended
        // tempSvg.style.position = 'absolute';
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        // document.body.appendChild(tempSvg); // Avoid appending to DOM as per spec
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            // Fallback or warning
            // console.warn("BBox calculation failed for detached SVG text node.", e);
            // Crude fallback: character count * average char width (e.g., fontSize * 0.6)
            width = text.length * (parseFloat(fontSize) * 0.6);
        }
        // tempSvg.remove(); // if appended
        return width;
    }

    function truncateText(textElement, textContent, maxWidth, fontProps) {
        textElement.text(textContent);
        let currentWidth = estimateTextWidth(textContent, fontProps);
        
        if (currentWidth <= maxWidth) {
            return textContent;
        }

        const ellipsis = "...";
        const ellipsisWidth = estimateTextWidth(ellipsis, fontProps);
        
        let truncated = textContent;
        while (truncated.length > 0) {
            truncated = truncated.slice(0, -1);
            const tempText = truncated + ellipsis;
            currentWidth = estimateTextWidth(tempText, fontProps);
            if (currentWidth <= maxWidth) {
                textElement.text(tempText);
                return tempText;
            }
        }
        
        // If even "..." is too long, or text becomes empty
        if (ellipsisWidth <= maxWidth && truncated.length === 0) {
             textElement.text(ellipsis);
             return ellipsis;
        }

        textElement.text(""); // Hide if cannot fit anything
        return "";
    }

    const valueFormatter = d3.format(",.0f"); // Format for numerical values

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    const chartMargins = { 
        top: variables.marginTop || 10, 
        right: variables.marginRight || 10, 
        bottom: variables.marginBottom || 10, 
        left: variables.marginLeft || 10 
    };
    
    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const hierarchyData = { name: "root", children: [] };
    const groupedData = d3.group(chartDataInput, d => d[categoryFieldName]);
    
    let categoryIndex = 0;
    groupedData.forEach((values, category) => {
        const totalValue = d3.sum(values, d => parseFloat(d[valueFieldName]));
        if (totalValue > 0) { // Treemap usually only shows positive values
            hierarchyData.children.push({
                name: category,
                value: totalValue,
                originalIndex: categoryIndex++ // For consistent color mapping if needed
            });
        }
    });

    const rootNode = d3.hierarchy(hierarchyData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value); // Sort descending by value

    // Block 6: Scale Definition & Configuration
    const treemapLayout = d3.treemap()
        .size([innerWidth, innerHeight])
        .padding(variables.cellPadding !== undefined ? variables.cellPadding : 3)
        .round(true);

    treemapLayout(rootNode);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this treemap.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const leaves = rootNode.leaves();

    const cellGroups = mainChartGroup.selectAll("g.treemap-cell")
        .data(leaves)
        .join("g")
        .attr("class", d => `mark treemap-cell treemap-cell-${d.data.name.replace(/\s+/g, '-').toLowerCase()}`)
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    cellGroups.append("rect")
        .attr("class", "value treemap-rect")
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("rx", fillStyle.cellBorderRadius)
        .attr("ry", fillStyle.cellBorderRadius)
        .attr("fill", d => fillStyle.getCellColor(d.data.name, d.data.originalIndex))
        .attr("stroke", fillStyle.defaultCellStroke)
        .attr("stroke-width", 1);

    // Add tooltips (native browser ones)
    cellGroups.append("title")
        .text(d => `${d.data.name}: ${valueFormatter(d.value)}${valueFieldUnit}`);

    // Add labels (category name and value)
    const labelFontSizePx = parseFloat(fillStyle.typography.labelFontSize);
    const annotationFontSizePx = parseFloat(fillStyle.typography.annotationFontSize);

    cellGroups.each(function(d) {
        const cellGroup = d3.select(this);
        const cellWidth = d.x1 - d.x0;
        const cellHeight = d.y1 - d.y0;
        const availableTextWidth = cellWidth - 2 * fillStyle.cellTextPadding;
        
        // Category Label
        if (cellHeight > labelFontSizePx + 2 * fillStyle.cellTextPadding && availableTextWidth > labelFontSizePx) { // Basic check if space for text
            const categoryTextElement = cellGroup.append("text")
                .attr("class", "label category-name-label")
                .attr("x", fillStyle.cellTextPadding)
                .attr("y", fillStyle.cellTextPadding + labelFontSizePx * 0.8) // Adjusted for baseline
                .attr("font-family", fillStyle.typography.labelFontFamily)
                .attr("font-size", fillStyle.typography.labelFontSize)
                .attr("font-weight", fillStyle.typography.labelFontWeight)
                .attr("fill", fillStyle.textColor)
                .attr("text-anchor", "start");

            truncateText(categoryTextElement, d.data.name, availableTextWidth, 
                { fontFamily: fillStyle.typography.labelFontFamily, fontSize: fillStyle.typography.labelFontSize, fontWeight: fillStyle.typography.labelFontWeight });
        }

        // Value Label
        const valueLabelYPosition = fillStyle.cellTextPadding + labelFontSizePx + annotationFontSizePx * 0.8 + (labelFontSizePx > 0 ? 2 : 0) ; // Add small gap
        if (cellHeight > valueLabelYPosition + fillStyle.cellTextPadding && availableTextWidth > annotationFontSizePx) { // Basic check
            const valueTextElement = cellGroup.append("text")
                .attr("class", "text value-label")
                .attr("x", fillStyle.cellTextPadding)
                .attr("y", valueLabelYPosition)
                .attr("font-family", fillStyle.typography.annotationFontFamily)
                .attr("font-size", fillStyle.typography.annotationFontSize)
                .attr("font-weight", fillStyle.typography.annotationFontWeight)
                .attr("fill", fillStyle.textColor)
                .attr("text-anchor", "start");
            
            const valueString = `${valueFormatter(d.value)}${valueFieldUnit}`;
            truncateText(valueTextElement, valueString, availableTextWidth,
                { fontFamily: fillStyle.typography.annotationFontFamily, fontSize: fillStyle.typography.annotationFontSize, fontWeight: fillStyle.typography.annotationFontWeight });
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements like svg2roughjs.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}