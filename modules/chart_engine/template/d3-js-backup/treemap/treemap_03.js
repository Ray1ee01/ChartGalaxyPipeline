/* REQUIREMENTS_BEGIN
{
  "chart_type": "Treemap",
  "chart_name": "treemap_03",
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataTypography = data.typography || {};
    const dataColors = data.colors || {};
    const dataImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!categoryFieldDef || !valueFieldDef) {
        console.error("Critical chart config missing: Category (role 'x') or Value (role 'y') field definition not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing. Category or Value field not defined.</div>");
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: Category field name or Value field name is undefined. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing. Category or Value field name is undefined.</div>");
        return null;
    }
    
    const valueFieldUnit = valueFieldDef.unit && valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};

    const defaultTypographyStyles = {
        label: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        annotation: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "bold" }
    };

    fillStyle.typography = {
        labelFontFamily: (dataTypography.label && dataTypography.label.font_family) || defaultTypographyStyles.label.font_family,
        labelFontSize: (dataTypography.label && dataTypography.label.font_size) || defaultTypographyStyles.label.font_size,
        labelFontWeight: (dataTypography.label && dataTypography.label.font_weight) || defaultTypographyStyles.label.font_weight,
        
        annotationFontFamily: (dataTypography.annotation && dataTypography.annotation.font_family) || defaultTypographyStyles.annotation.font_family,
        annotationFontSize: (dataTypography.annotation && dataTypography.annotation.font_size) || defaultTypographyStyles.annotation.font_size,
        annotationFontWeight: (dataTypography.annotation && dataTypography.annotation.font_weight) || defaultTypographyStyles.annotation.font_weight,
    };

    const defaultColors = {
        textColor: '#333333', // General text color
        background: '#FFFFFF',
        defaultPalette: d3.schemeCategory10,
        cellText: '#FFFFFF' // Default for text inside treemap cells
    };

    fillStyle.textColor = dataColors.text_color || defaultColors.textColor; // Not directly used for cell labels, but good to have
    fillStyle.chartBackground = dataColors.background_color || defaultColors.background;
    fillStyle.cellTextColor = (dataColors.other && dataColors.other.cell_text_color) || defaultColors.cellText;

    fillStyle.getCellColor = (categoryName, categoryIndex) => {
        if (dataColors.field && dataColors.field[categoryName]) {
            return dataColors.field[categoryName];
        }
        const palette = (dataColors.available_colors && dataColors.available_colors.length > 0) ? dataColors.available_colors : defaultColors.defaultPalette;
        return palette[categoryIndex % palette.length];
    };

    fillStyle.getIconUrl = (categoryName) => {
        if (dataImages.field && dataImages.field[categoryName]) {
            return dataImages.field[categoryName];
        }
        return null;
    };

    function estimateTextWidth(text, fontProps = {}) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        
        textElement.setAttribute('font-family', fontProps.font_family || defaultTypographyStyles.label.font_family);
        textElement.setAttribute('font-size', fontProps.font_size || defaultTypographyStyles.label.font_size);
        textElement.setAttribute('font-weight', fontProps.font_weight || defaultTypographyStyles.label.font_weight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        
        // Note: getBBox on unappended SVG elements can be unreliable in some older environments.
        // For modern browsers, this should generally work.
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth: getBBox failed for unappended SVG. Error:", e);
        }
        return width;
    }

    const TREEMAP_PADDING = 5;
    const CATEGORY_LABEL_GROUP_PADDING = 12;
    const CATEGORY_LABEL_Y_OFFSET = 18;
    const VALUE_LABEL_Y_OFFSET_FROM_BOTTOM = 15;
    const ICON_SIZE = variables.treemap_icon_size || 48;
    const MIN_CELL_HEIGHT_FOR_VALUE_LABEL = 50; // Adjusted from original 70, to allow more labels
    const VALUE_LABEL_HORIZONTAL_PADDING = 20;

    const valueFormatter = d3.format(",d");

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
    const chartMargins = { top: 10, right: 10, bottom: 10, left: 10 }; // As per original
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const rootHierarchyData = {
        name: "root",
        children: []
    };

    const groupedData = d3.group(chartDataArray, d => d[categoryFieldName]);
    const uniqueCategories = Array.from(groupedData.keys());

    uniqueCategories.forEach(category => {
        const values = groupedData.get(category);
        const totalValue = d3.sum(values, d => d[valueFieldName]);
        if (totalValue > 0) { // Treemap typically doesn't show zero-value items
             rootHierarchyData.children.push({
                name: category,
                value: totalValue,
                originalIndex: uniqueCategories.indexOf(category) // For stable color assignment
            });
        }
    });
    
    if (rootHierarchyData.children.length === 0) {
        console.warn("No valid data to render treemap after processing.");
        d3.select(containerSelector).html("<div style='color:orange;'>No data to display in Treemap.</div>");
        return null;
    }

    const hierarchy = d3.hierarchy(rootHierarchyData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value); // Sort descending by value

    // Block 6: Scale Definition & Configuration
    // Color scale is handled by fillStyle.getCellColor

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for Treemap.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const treemapLayout = d3.treemap()
        .size([innerWidth, innerHeight])
        .padding(TREEMAP_PADDING)
        .round(true);

    const rootNodes = treemapLayout(hierarchy);
    
    const leafCells = mainChartGroup.selectAll("g.mark")
        .data(rootNodes.leaves())
        .join("g")
        .attr("class", "mark treemap-cell")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    leafCells.append("rect")
        .attr("class", "value treemap-rect")
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("fill", d => fillStyle.getCellColor(d.data.name, d.data.originalIndex))
        .attr("stroke", "none"); // As per original

    leafCells.append("title") // Simple tooltip
        .text(d => `${d.data.name}: ${valueFormatter(d.value)}${valueFieldUnit}`);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    
    // Category Labels (top-left of cell)
    const categoryLabelGroup = leafCells.append("g")
        .attr("class", "label-group category-label-group")
        .attr("transform", `translate(${CATEGORY_LABEL_GROUP_PADDING}, ${CATEGORY_LABEL_GROUP_PADDING})`);

    categoryLabelGroup.append("text")
        .attr("class", "label category-label")
        .attr("x", 0)
        .attr("y", CATEGORY_LABEL_Y_OFFSET)
        .attr("fill", fillStyle.cellTextColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d.data.name)
        .each(function(d) {
            const textElement = d3.select(this);
            const cellWidth = d.x1 - d.x0;
            const maxTextWidth = cellWidth - (2 * CATEGORY_LABEL_GROUP_PADDING); // Available width within the padded group
            
            const fontProps = {
                font_family: fillStyle.typography.labelFontFamily,
                font_size: fillStyle.typography.labelFontSize,
                font_weight: fillStyle.typography.labelFontWeight
            };

            let currentText = d.data.name;
            if (estimateTextWidth(currentText, fontProps) > maxTextWidth) {
                while (currentText.length > 0 && estimateTextWidth(currentText + "...", fontProps) > maxTextWidth) {
                    currentText = currentText.slice(0, -1);
                }
                textElement.text(currentText + "...");
            }
        });

    // Icons (centered in cell)
    leafCells.each(function(d) {
        const cellGroup = d3.select(this);
        const categoryName = d.data.name;
        const iconUrl = fillStyle.getIconUrl(categoryName);

        if (iconUrl) {
            const cellWidth = d.x1 - d.x0;
            const cellHeight = d.y1 - d.y0;
            
            // Render icon only if cell is large enough
            if (cellWidth > ICON_SIZE && cellHeight > ICON_SIZE) {
                 cellGroup.append("image")
                    .attr("class", "icon treemap-icon")
                    .attr("x", (cellWidth - ICON_SIZE) / 2)
                    .attr("y", (cellHeight - ICON_SIZE) / 2)
                    .attr("width", ICON_SIZE)
                    .attr("height", ICON_SIZE)
                    .attr("xlink:href", iconUrl);
            }
        }
    });
    
    // Value Labels (bottom-center of cell)
    leafCells.append("text")
        .attr("class", "label value-label")
        .attr("x", d => (d.x1 - d.x0) / 2)
        .attr("y", d => (d.y1 - d.y0) - VALUE_LABEL_Y_OFFSET_FROM_BOTTOM)
        .attr("text-anchor", "middle")
        .attr("fill", fillStyle.cellTextColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => `${valueFormatter(d.value)}${valueFieldUnit}`)
        .each(function(d) {
            const textElement = d3.select(this);
            const cellWidth = d.x1 - d.x0;
            const cellHeight = d.y1 - d.y0;

            const fontProps = {
                font_family: fillStyle.typography.annotationFontFamily,
                font_size: fillStyle.typography.annotationFontSize,
                font_weight: fillStyle.typography.annotationFontWeight
            };
            const textWidth = estimateTextWidth(textElement.text(), fontProps);

            if (textWidth > cellWidth - VALUE_LABEL_HORIZONTAL_PADDING || cellHeight < MIN_CELL_HEIGHT_FOR_VALUE_LABEL) {
                textElement.style("display", "none");
            }
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}