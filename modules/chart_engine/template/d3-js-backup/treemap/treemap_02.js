/* REQUIREMENTS_BEGIN
{
  "chart_type": "Treemap",
  "chart_name": "treemap_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
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
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !categoryColumn.name || !valueColumn || !valueColumn.name) {
        console.error("Critical chart config missing: Category (x) or Value (y) field name not found in dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Critical chart configuration missing (category or value field).</div>");
        }
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;
    const valueFieldUnit = valueColumn.unit === "none" || !valueColumn.unit ? '' : ` ${valueColumn.unit}`; // Add space if unit exists

    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            categoryLabelFontFamily: (typographyInput.title && typographyInput.title.font_family) ? typographyInput.title.font_family : 'Arial, sans-serif',
            categoryLabelFontSize: (typographyInput.title && typographyInput.title.font_size) ? typographyInput.title.font_size : '20px',
            categoryLabelFontWeight: (typographyInput.title && typographyInput.title.font_weight) ? typographyInput.title.font_weight : 'bold',
            
            valueLabelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            valueLabelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '16px',
            valueLabelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        categoryLabelColor: '#FFFFFF', // Default for category labels on potentially dark cells
        valueLabelColor: '#000000',    // Default for value labels, often on dark cells
        svgBackgroundColor: colorsInput.background_color || '#FFFFFF',
        cellFillOpacity: 0.8, 
        defaultCellColor: '#CCCCCC',
    };
    
    fillStyle.getCellColor = (categoryName, index) => {
        if (colorsInput.field && colorsInput.field[categoryName]) {
            return colorsInput.field[categoryName];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[index % colorsInput.available_colors.length];
        }
        // Fallback to d3.schemeCategory10 if specific colors or available_colors are not provided
        return d3.schemeCategory10[index % d3.schemeCategory10.length];
    };

    fillStyle.getIconUrl = (categoryName) => {
        if (imagesInput.field && imagesInput.field[categoryName]) {
            return imagesInput.field[categoryName];
        }
        return null;
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = d3.create("svg");
        const tempText = tempSvg.append("text")
            .attr("font-family", fontProps.fontFamily)
            .attr("font-size", fontProps.fontSize)
            .attr("font-weight", fontProps.fontWeight)
            .text(text);
        const width = tempText.node().getBBox().width;
        tempSvg.remove();
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root treemap-chart")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.svgBackgroundColor);

    const chartMargins = { top: 10, right: 10, bottom: 10, left: 10 };

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const valueFormatter = d3.format(",d");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const hierarchyData = { name: "root", children: [] };
    const groupedData = d3.group(chartDataInput, d => d[categoryFieldName]);

    let categoryIndex = 0;
    groupedData.forEach((values, category) => {
        const totalValue = d3.sum(values, d => parseFloat(d[valueFieldName]) || 0);
        if (totalValue > 0) {
             hierarchyData.children.push({
                name: category,
                value: totalValue,
                originalIndex: categoryIndex++ 
            });
        }
    });
    
    if (hierarchyData.children.length === 0) {
        mainChartGroup.append("text")
            .attr("class", "label no-data-label")
            .attr("x", chartWidth / 2)
            .attr("y", chartHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.valueLabelFontFamily)
            .attr("font-size", fillStyle.typography.valueLabelFontSize)
            .attr("fill", fillStyle.textColor)
            .text("No data available.");
        return svgRoot.node();
    }

    const rootNode = d3.hierarchy(hierarchyData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);

    d3.treemap()
        .size([chartWidth, chartHeight])
        .padding(8) 
        .round(true)
        (rootNode);

    // Block 6: Scale Definition & Configuration
    // Color scale is handled by fillStyle.getCellColor

    // Block 7: Chart Component Rendering
    // Not applicable for Treemap.

    // Block 8: Main Data Visualization Rendering
    const cellInnerPadding = 12; 
    const iconSize = 32;
    const textIconSpacing = 14; // Original spacing between text and icon

    const leafCells = mainChartGroup.selectAll("g.leaf-cell")
        .data(rootNode.leaves())
        .join("g")
        .attr("class", "mark leaf-cell")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    leafCells.append("rect")
        .attr("class", "value treemap-rect")
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("fill", d => fillStyle.getCellColor(d.data.name, d.data.originalIndex))
        .attr("fill-opacity", fillStyle.cellFillOpacity)
        .attr("stroke", "none");

    leafCells.append("title")
        .text(d => `${d.data.name}: ${valueFormatter(d.value)}${valueFieldUnit}`);

    // Block 9: Optional Enhancements & Post-Processing
    const labelGroups = leafCells.append("g")
        .attr("class", "label-group")
        .attr("transform", `translate(${cellInnerPadding}, ${cellInnerPadding})`);

    labelGroups.each(function(d) {
        const group = d3.select(this);
        const cellWidth = d.x1 - d.x0;
        const cellHeight = d.y1 - d.y0;
        const categoryName = d.data.name;
        const iconUrl = fillStyle.getIconUrl(categoryName);

        const categoryLabelY = 18; // Original relative Y for category label
        const iconY = -6;          // Original relative Y for icon
        const valueLabelY = 42;    // Original relative Y for value label

        // Add Category Label
        const categoryLabel = group.append("text")
            .attr("class", "label category-label")
            .attr("x", 0)
            .attr("y", categoryLabelY)
            .attr("fill", fillStyle.categoryLabelColor)
            .attr("font-family", fillStyle.typography.categoryLabelFontFamily)
            .attr("font-size", fillStyle.typography.categoryLabelFontSize)
            .attr("font-weight", fillStyle.typography.categoryLabelFontWeight)
            .text(categoryName);

        let categoryTextActualWidth = categoryLabel.node().getComputedTextLength();
        
        let maxCategoryTextWidth = cellWidth - 2 * cellInnerPadding;
        if (iconUrl) {
            maxCategoryTextWidth -= (iconSize + textIconSpacing);
        }
        
        if (categoryTextActualWidth > maxCategoryTextWidth) {
            let textContent = categoryName;
            while (categoryLabel.node().getComputedTextLength() > maxCategoryTextWidth && textContent.length > 1) {
                textContent = textContent.slice(0, -1);
                categoryLabel.text(textContent + "…");
            }
            categoryTextActualWidth = categoryLabel.node().getComputedTextLength();
        }
        
        if (cellHeight < categoryLabelY + 5 + cellInnerPadding) { // 5 for descender space
             categoryLabel.style("display", "none");
        }

        // Add Icon
        if (iconUrl && categoryLabel.style("display") !== "none") {
            const iconElement = group.append("image")
                .attr("class", "icon category-icon")
                .attr("x", categoryTextActualWidth + textIconSpacing)
                .attr("y", iconY)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", iconUrl);
            
            const iconRightEdge = parseFloat(iconElement.attr("x")) + iconSize;
            if (iconRightEdge > cellWidth - cellInnerPadding) {
                iconElement.style("display", "none");
            }
        }
        
        // Add Value Label
        const valueLabel = group.append("text")
            .attr("class", "label value-label")
            .attr("x", 0)
            .attr("y", valueLabelY)
            .attr("fill", fillStyle.valueLabelColor)
            .attr("font-family", fillStyle.typography.valueLabelFontFamily)
            .attr("font-size", fillStyle.typography.valueLabelFontSize)
            .attr("font-weight", fillStyle.typography.valueLabelFontWeight)
            .text(`${valueFormatter(d.value)}${valueFieldUnit}`);

        const valueTextWidth = valueLabel.node().getComputedTextLength();
        const minHeightForLabels = valueLabelY + 5; // Approx height needed for value label line

        if (valueTextWidth > (cellWidth - 2 * cellInnerPadding) || cellHeight < minHeightForLabels + cellInnerPadding) {
            valueLabel.style("display", "none");
        }
        
        if (valueLabel.style("display") === "none" && cellHeight < 70) { // Original threshold
             if (categoryLabel.style("display") !== "none") categoryLabel.style("display", "none");
             group.selectAll(".category-icon").style("display", "none");
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}