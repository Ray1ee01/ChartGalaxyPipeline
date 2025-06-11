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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data?.columns || [];
    let chartDataArray = data.data?.data || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const valueFieldUnitObj = dataColumns.find(col => col.role === "y");
    const valueFieldUnit = valueFieldUnitObj?.unit === "none" ? "" : (valueFieldUnitObj?.unit || "");


    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("category field (role 'x')");
        if (!valueFieldName) missingFields.push("value field (role 'y')");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        return null;
    }
    
    chartDataArray = chartDataArray.filter(d => 
        d[categoryFieldName] != null && 
        d[valueFieldName] != null && 
        !isNaN(parseFloat(d[valueFieldName]))
    );

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            categoryLabel: { // Using 'title' token for larger category labels in treemap cells
                font_family: typographyConfig.title?.font_family || "Arial, sans-serif",
                font_size: typographyConfig.title?.font_size || "16px",
                font_weight: typographyConfig.title?.font_weight || "bold",
            },
            valueLabel: { // Using 'label' token for value labels in treemap cells
                font_family: typographyConfig.label?.font_family || "Arial, sans-serif",
                font_size: typographyConfig.label?.font_size || "12px",
                font_weight: typographyConfig.label?.font_weight || "normal",
            }
        },
        textColor: colorsConfig.text_color || '#FFFFFF', // Default white for text inside cells
        chartBackground: colorsConfig.background_color || '#FFFFFF', // Default white background
        defaultCellColor: colorsConfig.other?.primary || '#1f77b4',
        availableColors: colorsConfig.available_colors || d3.schemeCategory10
    };

    fillStyle.getCellColor = (categoryName, index) => {
        if (colorsConfig.field && colorsConfig.field[categoryName]) {
            return colorsConfig.field[categoryName];
        }
        return fillStyle.availableColors[index % fillStyle.availableColors.length];
    };
    
    fillStyle.getIconUrl = (categoryName) => {
        if (imagesConfig.field && imagesConfig.field[categoryName]) {
            return imagesConfig.field[categoryName];
        }
        return null; 
    };

    const estimateTextWidth = (text, fontProps) => {
        if (!text || text.length === 0) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // No need to style tempSvg itself, only the text element
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family);
        tempText.setAttribute('font-size', fontProps.font_size);
        tempText.setAttribute('font-weight', fontProps.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText); 
        // Appending to body is not strictly required for getBBox on text if font properties are directly set.
        // For maximum compatibility or if using getComputedTextLength, append/remove from DOM.
        // document.body.appendChild(tempSvg);
        const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg);
        return width;
    };
    
    const dataValueFormatter = d3.format(",.0f");

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: chartConfig.margin?.top ?? 10,
        right: chartConfig.margin?.right ?? 10,
        bottom: chartConfig.margin?.bottom ?? 10,
        left: chartConfig.margin?.left ?? 10,
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const hierarchyData = { name: "root", children: [] };
    const groupedData = d3.group(chartDataArray, d => d[categoryFieldName]);
    
    let categoryIndex = 0;
    groupedData.forEach((values, category) => {
        const totalValue = d3.sum(values, d => parseFloat(d[valueFieldName]));
        if (totalValue > 0) {
            hierarchyData.children.push({
                name: category,
                value: totalValue,
                originalIndex: categoryIndex++
            });
        }
    });
    
    if (hierarchyData.children.length === 0) {
        const errorMsg = "No valid data to display after processing.";
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("fill", fillStyle.textColor === '#FFFFFF' && fillStyle.chartBackground === '#FFFFFF' ? '#000000' : fillStyle.textColor) // Ensure visibility if text and bg are both white
            .style("font-family", fillStyle.typography.valueLabel.font_family)
            .style("font-size", "14px")
            .text(errorMsg);
        return svgRoot.node();
    }

    // Block 6: Scale Definition & Configuration
    const treemapLayout = d3.treemap()
        .size([innerWidth, innerHeight])
        .padding(chartConfig.treemapCellPadding ?? 8) // Reduced default padding
        .round(true);

    const rootNode = treemapLayout(d3.hierarchy(hierarchyData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value));

    // Block 7: Chart Component Rendering (Not applicable for this Treemap)
    // No axes, gridlines, or legend are rendered.

    // Block 8: Main Data Visualization Rendering
    const leafCells = mainChartGroup.selectAll("g.leaf-cell")
        .data(rootNode.leaves())
        .join("g")
        .attr("class", "mark treemap-cell leaf-cell")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    leafCells.append("rect")
        .attr("class", "mark treemap-rect")
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("rx", chartConfig.treemapCellBorderRadius ?? 3)
        .attr("ry", chartConfig.treemapCellBorderRadius ?? 3)
        .attr("fill", d => fillStyle.getCellColor(d.data.name, d.data.originalIndex))
        .attr("fill-opacity", 1.0);

    leafCells.append("title") // Simple tooltip
        .text(d => `${d.data.name}: ${dataValueFormatter(d.value)}${valueFieldUnit}`);

    // Block 9: Optional Enhancements & Post-Processing (Labels, Icons)
    const cellPadding = chartConfig.treemapCellInternalPadding ?? { x: 6, y: 6 };
    const iconSize = chartConfig.iconSize ?? 20;
    const iconTextGap = chartConfig.iconTextGap ?? 5;

    leafCells.each(function(dNode) {
        const cellGroup = d3.select(this);
        const cellWidth = dNode.x1 - dNode.x0;
        const cellHeight = dNode.y1 - dNode.y0;
        const categoryName = dNode.data.name;

        const categoryLabelFontProps = fillStyle.typography.categoryLabel;
        const categoryLabelFontSize = parseFloat(categoryLabelFontProps.font_size);
        const categoryLabelYPos = cellPadding.y + categoryLabelFontSize * 0.85; // Adjusted for better perceived vertical centering

        let availableWidthForCategoryLabel = cellWidth - 2 * cellPadding.x;
        const iconUrl = fillStyle.getIconUrl(categoryName);
        if (iconUrl) {
            availableWidthForCategoryLabel -= (iconSize + iconTextGap);
        }
        
        let categoryLabelText = categoryName;
        if (estimateTextWidth(categoryLabelText, categoryLabelFontProps) > availableWidthForCategoryLabel) {
            let tempText = categoryName;
            while (tempText.length > 0) {
                tempText = tempText.slice(0, -1);
                if (estimateTextWidth(tempText + "...", categoryLabelFontProps) <= availableWidthForCategoryLabel) {
                    categoryLabelText = tempText + "...";
                    break;
                }
            }
            if (tempText.length === 0) { // Even "..." or one char + "..." is too long
                 if (estimateTextWidth("...", categoryLabelFontProps) <= availableWidthForCategoryLabel) categoryLabelText = "...";
                 else categoryLabelText = "";
            }
        }

        if (categoryLabelText && cellHeight > categoryLabelYPos + cellPadding.y && availableWidthForCategoryLabel > 10) {
            const textEl = cellGroup.append("text")
                .attr("class", "label category-label")
                .attr("x", cellPadding.x)
                .attr("y", categoryLabelYPos)
                .attr("fill", fillStyle.textColor)
                .attr("font-family", categoryLabelFontProps.font_family)
                .attr("font-size", categoryLabelFontProps.font_size)
                .attr("font-weight", categoryLabelFontProps.font_weight)
                .text(categoryLabelText);

            if (iconUrl) {
                const actualTextWidth = estimateTextWidth(categoryLabelText, categoryLabelFontProps);
                const iconX = cellPadding.x + actualTextWidth + iconTextGap;
                const iconY = categoryLabelYPos - iconSize * 0.8; // Align icon top with text cap height approx.

                if (iconX + iconSize <= cellWidth - cellPadding.x) {
                    cellGroup.append("image")
                        .attr("class", "icon category-icon")
                        .attr("x", iconX)
                        .attr("y", iconY)
                        .attr("width", iconSize)
                        .attr("height", iconSize)
                        .attr("xlink:href", iconUrl);
                }
            }
        }

        const valueLabelFontProps = fillStyle.typography.valueLabel;
        const valueLabelFontSize = parseFloat(valueLabelFontProps.font_size);
        const valueLabelYPos = categoryLabelYPos + valueLabelFontSize + (cellPadding.y > 0 ? cellPadding.y : 5);
        
        const valueLabelText = `${dataValueFormatter(dNode.value)}${valueFieldUnit}`;
        const estimatedValWidth = estimateTextWidth(valueLabelText, valueLabelFontProps);

        if (cellHeight > valueLabelYPos + cellPadding.y && cellWidth > estimatedValWidth + 2 * cellPadding.x) {
            cellGroup.append("text")
                .attr("class", "value data-label")
                .attr("x", cellPadding.x)
                .attr("y", valueLabelYPos)
                .attr("fill", fillStyle.textColor)
                .attr("font-family", valueLabelFontProps.font_family)
                .attr("font-size", valueLabelFontProps.font_size)
                .attr("font-weight", valueLabelFontProps.font_weight)
                .text(valueLabelText);
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}