/* REQUIREMENTS_BEGIN
{
  "chart_type": "Treemap",
  "chart_name": "treemap_01",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !categoryColumn.name) {
        console.error("Critical chart config missing: Category field (role 'x') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (Category field name).</div>");
        return null;
    }
    if (!valueColumn || !valueColumn.name) {
        console.error("Critical chart config missing: Value field (role 'y') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (Value field name).</div>");
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;
    const valueUnit = valueColumn.unit === "none" || !valueColumn.unit ? '' : valueColumn.unit;

    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            categoryLabel: {
                font_family: typographyConfig.title?.font_family || 'Arial, sans-serif',
                font_size: typographyConfig.title?.font_size || '20px',
                font_weight: typographyConfig.title?.font_weight || 'bold',
            },
            valueLabel: {
                font_family: typographyConfig.label?.font_family || 'Arial, sans-serif',
                font_size: typographyConfig.label?.font_size || '16px',
                font_weight: typographyConfig.label?.font_weight || 'normal',
            },
            annotation: { // General annotation, not used directly here but good to have
                font_family: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
                font_size: typographyConfig.annotation?.font_size || '10px',
                font_weight: typographyConfig.annotation?.font_weight || 'normal',
            }
        },
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        textColor: colorsConfig.text_color || '#212529', // General text color
        cellBorderColor: colorsConfig.other?.cellBorder || 'none', // e.g. #FFFFFF for white borders
        cellOpacity: 0.9,
        categoryLabelColor: colorsConfig.other?.categoryLabelColor || '#FFFFFF',
        valueLabelColor: colorsConfig.other?.valueLabelColor || '#000000',
        iconBackgroundColor: colorsConfig.other?.iconBackground || '#FFFFFF',
        iconBackgroundOpacity: 0.75,
        defaultCellColors: d3.schemeTableau10 // Fallback if no specific colors provided
    };
    
    fillStyle.getCellColor = (categoryName, index) => {
        if (colorsConfig.field && colorsConfig.field[categoryName]) {
            return colorsConfig.field[categoryName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        return fillStyle.defaultCellColors[index % fillStyle.defaultCellColors.length];
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family);
        tempText.setAttribute('font-size', fontProps.font_size);
        tempText.setAttribute('font-weight', fontProps.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document body append/remove is not strictly necessary for getBBox if SVG is fully defined,
        // but some browsers might need it for getComputedTextLength if styles are inherited.
        // For getBBox, it's usually fine without appending.
        // document.body.appendChild(tempSvg); 
        const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg);
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    const formatNumber = d3.format(",d");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 10, right: 10, bottom: 10, left: 10 }; // Default margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groupedData = d3.group(chartDataInput, d => d[categoryFieldName]);
    const hierarchyData = {
        name: "root",
        children: Array.from(groupedData, ([category, values]) => ({
            name: category,
            value: d3.sum(values, d => d[valueFieldName])
        }))
    };

    // Block 6: Scale Definition & Configuration
    const treemapLayout = d3.treemap()
        .size([innerWidth, innerHeight])
        .padding(variables.treemap_padding !== undefined ? variables.treemap_padding : 12) // Configurable padding
        .round(true);

    const rootNode = treemapLayout(d3.hierarchy(hierarchyData)
        .sum(d => d.value)
        .sort((a, b) => (b.value || 0) - (a.value || 0))); // Sort descending

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for treemap.

    // Block 8: Main Data Visualization Rendering
    const leafGroups = mainChartGroup.selectAll("g.leaf-group")
        .data(rootNode.leaves())
        .join("g")
        .attr("class", "leaf-group")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    leafGroups.append("rect")
        .attr("class", "mark treemap-cell")
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("rx", variables.cell_corner_radius !== undefined ? variables.cell_corner_radius : 3) // Configurable corner radius
        .attr("ry", variables.cell_corner_radius !== undefined ? variables.cell_corner_radius : 3)
        .attr("fill", (d, i) => fillStyle.getCellColor(d.data.name, i))
        .attr("fill-opacity", fillStyle.cellOpacity)
        .attr("stroke", fillStyle.cellBorderColor)
        .attr("stroke-width", fillStyle.cellBorderColor === 'none' ? 0 : 1);
    
    leafGroups.append("title") // Basic tooltip
        .text(d => `${d.data.name}: ${formatNumber(d.value || 0)}`);

    const labelPadding = { x: 12, y: 12 }; // Internal padding for text and icon within cell

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    leafGroups.each(function(d) {
        const group = d3.select(this);
        const cellWidth = d.x1 - d.x0;
        const cellHeight = d.y1 - d.y0;
        const categoryName = d.data.name;

        // Category Label
        const categoryLabel = group.append("text")
            .attr("class", "label category-label")
            .attr("x", labelPadding.x)
            .attr("y", labelPadding.y + parseFloat(fillStyle.typography.categoryLabel.font_size) * 0.8) // Adjust y for better baseline
            .attr("fill", fillStyle.categoryLabelColor)
            .style("font-family", fillStyle.typography.categoryLabel.font_family)
            .style("font-size", fillStyle.typography.categoryLabel.font_size)
            .style("font-weight", fillStyle.typography.categoryLabel.font_weight)
            .text(categoryName);

        let categoryTextWidth = 0;
        try {
            categoryTextWidth = categoryLabel.node().getComputedTextLength();
        } catch (e) {
            categoryTextWidth = estimateTextWidth(categoryName, fillStyle.typography.categoryLabel);
        }
        
        const iconSize = 32;
        const iconPadding = 10;
        let hasIcon = false;
        const iconUrl = imagesConfig.field && imagesConfig.field[categoryName] ? imagesConfig.field[categoryName] : null;

        if (iconUrl) {
            hasIcon = true;
        }
        
        // Truncate category label if necessary (considering icon space)
        const availableWidthForCategoryLabel = cellWidth - (2 * labelPadding.x) - (hasIcon ? (iconSize + iconPadding) : 0);
        if (categoryTextWidth > availableWidthForCategoryLabel) {
            let textContent = categoryName;
            while (estimateTextWidth(textContent + "...", fillStyle.typography.categoryLabel) > availableWidthForCategoryLabel && textContent.length > 0) {
                textContent = textContent.slice(0, -1);
            }
            categoryLabel.text(textContent + "...");
            try {
                categoryTextWidth = categoryLabel.node().getComputedTextLength();
            } catch(e) {
                categoryTextWidth = estimateTextWidth(textContent + "...", fillStyle.typography.categoryLabel);
            }
        }
        if (cellHeight < parseFloat(fillStyle.typography.categoryLabel.font_size) + 2 * labelPadding.y) {
             categoryLabel.style("display", "none"); // Hide if cell too short
        }


        // Icon (if available and space permits)
        if (iconUrl && cellHeight > iconSize + labelPadding.y && cellWidth > categoryTextWidth + iconSize + iconPadding + labelPadding.x) {
            const iconX = labelPadding.x + categoryTextWidth + iconPadding;
            const iconY = labelPadding.y + parseFloat(fillStyle.typography.categoryLabel.font_size) / 2 - iconSize / 2; // Vertically align with category label center

            if (variables.show_icon_background_circle !== false) { // Default to true
                 group.append("circle")
                    .attr("class", "icon-background")
                    .attr("cx", iconX + iconSize / 2)
                    .attr("cy", iconY + iconSize / 2)
                    .attr("r", iconSize / 2 + 5)
                    .attr("fill", fillStyle.iconBackgroundColor)
                    .attr("fill-opacity", fillStyle.iconBackgroundOpacity)
                    .attr("stroke", "none");
            }

            group.append("image")
                .attr("class", "icon category-icon")
                .attr("x", iconX)
                .attr("y", iconY)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", iconUrl);
        }


        // Value Label
        const valueLabelY = labelPadding.y + parseFloat(fillStyle.typography.categoryLabel.font_size) + 10; // Below category label
        const valueLabelText = `${formatNumber(d.value || 0)}${valueUnit}`;
        
        const valueLabel = group.append("text")
            .attr("class", "label value-label")
            .attr("x", labelPadding.x)
            .attr("y", valueLabelY + parseFloat(fillStyle.typography.valueLabel.font_size) * 0.8)
            .attr("fill", fillStyle.valueLabelColor)
            .style("font-family", fillStyle.typography.valueLabel.font_family)
            .style("font-size", fillStyle.typography.valueLabel.font_size)
            .style("font-weight", fillStyle.typography.valueLabel.font_weight)
            .text(valueLabelText);

        const valueTextWidth = estimateTextWidth(valueLabelText, fillStyle.typography.valueLabel);
        const availableWidthForValueLabel = cellWidth - (2 * labelPadding.x);

        if (valueTextWidth > availableWidthForValueLabel || cellHeight < valueLabelY + parseFloat(fillStyle.typography.valueLabel.font_size) + labelPadding.y) {
            valueLabel.style("display", "none"); // Hide if too long or cell too short
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}