/* REQUIREMENTS_BEGIN
{
  "chart_type": "Treemap",
  "chart_name": "treemap_04",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 20], [0, "inf"], [2, 6]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
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
    const chartConfig = data.variables || {};
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    const typographyConfig = data.typography || {};
    const colorConfig = data.colors || data.colors_dark || {}; // Prefer data.colors, fallback to data.colors_dark
    const imageConfig = data.images || {};

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    const missingFields = [];
    if (!categoryFieldDef) missingFields.push("x role field");
    if (!valueFieldDef) missingFields.push("y role field");
    if (!groupFieldDef) missingFields.push("group role field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const groupFieldName = groupFieldDef.name;
    const valueFieldUnit = valueFieldDef.unit === "none" || !valueFieldDef.unit ? '' : valueFieldDef.unit;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title && typographyConfig.title.font_family ? typographyConfig.title.font_family : 'Arial, sans-serif',
            titleFontSize: typographyConfig.title && typographyConfig.title.font_size ? typographyConfig.title.font_size : '16px',
            titleFontWeight: typographyConfig.title && typographyConfig.title.font_weight ? typographyConfig.title.font_weight : 'bold',
            labelFontFamily: typographyConfig.label && typographyConfig.label.font_family ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: typographyConfig.label && typographyConfig.label.font_size ? typographyConfig.label.font_size : '12px',
            labelFontWeight: typographyConfig.label && typographyConfig.label.font_weight ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: typographyConfig.annotation && typographyConfig.annotation.font_family ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation && typographyConfig.annotation.font_size ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: typographyConfig.annotation && typographyConfig.annotation.font_weight ? typographyConfig.annotation.font_weight : 'normal',
            cellCategoryLabelFontSize: '14px', // Specific for treemap cells
            cellValueLabelFontSize: '14px',   // Specific for treemap cells
            legendLabelFontSize: '12px',
        },
        textColor: colorConfig.text_color || '#333333',
        chartBackground: colorConfig.background_color || '#FFFFFF',
        defaultCategoryColor: '#CCCCCC',
        cellStrokeColor: "none", // Or a subtle color like '#FFFFFF' or '#EEEEEE'
        cellLabelColor: '#FFFFFF',
        cellValueColor: '#000000', // Contrast with typical cell colors
        cellOpacity: 0.85,
        iconSize: 28,
        iconPadding: 4,
    };
    
    // Helper to get color for a group
    const getColor = (groupName, groupIndex, totalGroups) => {
        if (colorConfig.field && colorConfig.field[groupName]) {
            return colorConfig.field[groupName];
        }
        if (colorConfig.available_colors && colorConfig.available_colors.length > 0) {
            return colorConfig.available_colors[groupIndex % colorConfig.available_colors.length];
        }
        return d3.schemeTableau10[groupIndex % d3.schemeTableau10.length];
    };

    // In-memory text measurement utility (not strictly needed here as original uses getComputedTextLength)
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox if not already in DOM.
        // However, for this specific directive, it must not be appended to document DOM.
        // getBBox on an unattached SVG text element can be inconsistent across browsers.
        // A common workaround is to attach to a hidden part of the DOM, measure, then detach.
        // For strict adherence, if getBBox on unattached element is unreliable, this helper might be limited.
        // Given the original uses getComputedTextLength on attached elements, this helper is more illustrative.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails on unattached element
            return text.length * (parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
    }

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
        .style("font-family", fillStyle.typography.labelFontFamily);

    const chartMargins = { top: 10, right: 10, bottom: 50, left: 10 }; // Legend space

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const hierarchyData = { name: "root", children: [] };
    const groupedByGroupField = d3.group(rawChartData, d => d[groupFieldName]);
    
    const uniqueGroups = Array.from(groupedByGroupField.keys());

    groupedByGroupField.forEach((values, group) => {
        const groupedByCategoryField = d3.group(values, d => d[categoryFieldName]);
        const categoryChildren = [];
        groupedByCategoryField.forEach((catValues, category) => {
            const totalValue = d3.sum(catValues, d => d[valueFieldName]);
            if (totalValue > 0) { // Treemap cannot have zero or negative values for sum
                 categoryChildren.push({
                    name: category,
                    group: group,
                    value: totalValue
                });
            }
        });
        if (categoryChildren.length > 0) {
            hierarchyData.children.push({
                name: group,
                children: categoryChildren
            });
        }
    });
    
    if (hierarchyData.children.length === 0) {
        const errorMsg = "No valid data to render treemap (all values might be zero or negative, or no data groups).";
        console.warn(errorMsg);
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "label")
            .style("font-size", "14px")
            .style("fill", fillStyle.textColor)
            .text(errorMsg);
        return svgRoot.node();
    }


    // Block 6: Scale Definition & Configuration
    const treemapLayout = d3.treemap()
        .size([innerWidth, innerHeight])
        .padding(4) // Slightly reduced padding
        .round(true)
        .tile(d3.treemapSquarify.ratio(1.6));

    const rootNode = treemapLayout(d3.hierarchy(hierarchyData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value));

    const valueFormatter = d3.format(",.0f"); // Format for display

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${containerHeight - chartMargins.bottom + 15})`);

    const legendItemMaxWidth = innerWidth / Math.max(1, uniqueGroups.length);
    const legendItemPadding = 25; // Space for rect and some padding

    uniqueGroups.forEach((groupName, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${i * legendItemMaxWidth}, 0)`);

        legendItem.append("rect")
            .attr("class", "mark")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", getColor(groupName, i, uniqueGroups.length))
            .style("opacity", fillStyle.cellOpacity);

        const legendText = legendItem.append("text")
            .attr("class", "label")
            .attr("x", 22)
            .attr("y", 14)
            .style("fill", fillStyle.textColor)
            .style("font-size", fillStyle.typography.legendLabelFontSize)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .text(groupName);
        
        // Truncate legend text if too long
        if (legendText.node().getComputedTextLength() > legendItemMaxWidth - legendItemPadding) {
            let textContent = groupName;
            while (legendText.node().getComputedTextLength() > legendItemMaxWidth - legendItemPadding && textContent.length > 0) {
                textContent = textContent.slice(0, -1);
                legendText.text(textContent + "…");
            }
        }
    });
    
    // Block 8: Main Data Visualization Rendering
    const leafNodes = mainChartGroup.selectAll("g.leaf-node")
        .data(rootNode.leaves())
        .join("g")
        .attr("class", "mark leaf-node")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    leafNodes.append("rect")
        .attr("class", "value") // More specific class for the colored rectangle
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .style("fill", d => getColor(d.data.group, uniqueGroups.indexOf(d.data.group), uniqueGroups.length))
        .style("opacity", fillStyle.cellOpacity)
        .style("stroke", fillStyle.cellStrokeColor) // Use configured stroke
        .style("stroke-width", fillStyle.cellStrokeColor === "none" ? 0 : 1);

    leafNodes.append("title") // Simple tooltip
        .text(d => `${d.data.name} (${d.data.group}): ${valueFormatter(d.value)}${valueFieldUnit}`);

    // Content within each cell (labels, icons)
    const cellContentGroup = leafNodes.append("g")
        .attr("class", "cell-content")
        .attr("transform", `translate(8, 8)`); // Padding within cell

    // Category Label
    cellContentGroup.append("text")
        .attr("class", "label category-label")
        .attr("x", 0)
        .attr("y", parseInt(fillStyle.typography.cellCategoryLabelFontSize)) // Position based on font size
        .style("fill", fillStyle.cellLabelColor)
        .style("font-size", fillStyle.typography.cellCategoryLabelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight) // Use labelFontWeight
        .style("font-family", fillStyle.typography.labelFontFamily)
        .text(d => d.data.name)
        .each(function(d) {
            const cellWidth = d.x1 - d.x0 - 16; // Available width after padding
            const cellHeight = d.y1 - d.y0 - 16; // Available height after padding
            const textElement = d3.select(this);
            let textLength = this.getComputedTextLength();

            if (cellWidth < 30 && cellHeight > 80 && textLength > cellWidth) { // Narrow and tall, attempt rotation
                textElement.attr("transform", `rotate(90)`)
                           .attr("x", parseInt(fillStyle.typography.cellCategoryLabelFontSize)) // New y after rotation
                           .attr("y", -3); // New x after rotation (adjust for alignment)
                textLength = this.getComputedTextLength(); // Re-measure after rotation
                if (textLength > cellHeight - parseInt(fillStyle.typography.cellValueLabelFontSize) - 10) { // Check against height
                    let textContent = d.data.name;
                    while (textElement.node().getComputedTextLength() > cellHeight - parseInt(fillStyle.typography.cellValueLabelFontSize) - 10 && textContent.length > 0) {
                        textContent = textContent.slice(0, -1);
                        textElement.text(textContent + "…");
                    }
                }
            } else if (textLength > cellWidth) { // Standard truncation
                let textContent = d.data.name;
                while (textElement.node().getComputedTextLength() > cellWidth && textContent.length > 0) {
                    textContent = textContent.slice(0, -1);
                    textElement.text(textContent + "…");
                }
            }
            if (cellWidth < 20 || cellHeight < 20) textElement.style("display", "none"); // Hide if cell too small
        });
        
    // Block 9: Optional Enhancements & Post-Processing (Icons and Value Labels)
    // Value Label (depends on category label's orientation and size)
    cellContentGroup.append("text")
        .attr("class", "label value-label")
        .style("fill", fillStyle.cellValueColor)
        .style("font-size", fillStyle.typography.cellValueLabelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .text(d => `${valueFormatter(d.value)}${valueFieldUnit}`)
        .each(function(d) {
            const cellWidth = d.x1 - d.x0 - 16;
            const cellHeight = d.y1 - d.y0 - 16;
            const valueTextElement = d3.select(this);
            const categoryLabelElement = d3.select(this.parentNode).select(".category-label");
            const isCategoryVertical = categoryLabelElement.attr("transform") && categoryLabelElement.attr("transform").includes("rotate(90)");
            
            const yPosCategory = parseInt(categoryLabelElement.attr("y") || 0);
            const categoryLabelHeight = parseInt(fillStyle.typography.cellCategoryLabelFontSize);
            let valueYPosition = yPosCategory + categoryLabelHeight + 4; // Below category label
            let valueXPosition = 0;

            if (isCategoryVertical) {
                valueTextElement.attr("transform", `rotate(90)`)
                                .attr("y", -3); // Align with vertical category label's x
                valueYPosition = (categoryLabelElement.node() ? categoryLabelElement.node().getComputedTextLength() : categoryLabelHeight) + parseInt(fillStyle.typography.cellValueLabelFontSize) + 8;
                valueTextElement.attr("x", valueYPosition);
                
                if (valueTextElement.node().getComputedTextLength() > cellHeight - valueYPosition || cellWidth < 30) {
                    valueTextElement.style("display", "none");
                }

            } else {
                valueTextElement.attr("x", valueXPosition);
                valueTextElement.attr("y", valueYPosition);
                if (valueTextElement.node().getComputedTextLength() > cellWidth || cellHeight < (categoryLabelHeight + parseInt(fillStyle.typography.cellValueLabelFontSize) + 8) ) {
                     valueTextElement.style("display", "none");
                }
            }
             if (cellWidth < 30 || cellHeight < 40) valueTextElement.style("display", "none");
        });

    // Icons (depends on category label's orientation and size)
    cellContentGroup.each(function(d) {
        const group = d3.select(this);
        const categoryName = d.data.name;
        const imageUrl = imageConfig.field && imageConfig.field[categoryName] ? imageConfig.field[categoryName] : null;

        if (!imageUrl) return;

        const cellWidth = d.x1 - d.x0 - 16;
        const cellHeight = d.y1 - d.y0 - 16;
        const categoryLabelElement = group.select(".category-label");
        const isCategoryVertical = categoryLabelElement.attr("transform") && categoryLabelElement.attr("transform").includes("rotate(90)");
        
        const categoryLabelTextLength = categoryLabelElement.node() ? categoryLabelElement.node().getComputedTextLength() : 0;
        const categoryLabelFontSize = parseInt(fillStyle.typography.cellCategoryLabelFontSize);

        let iconX = 0, iconY = 0;
        let showIcon = false;

        if (isCategoryVertical) {
            // Icon below vertical category label
            iconX = categoryLabelFontSize + fillStyle.iconPadding; // New Y after rotation
            iconY = (categoryLabelElement.attr("y") || 0) - fillStyle.iconSize/2 ; // New X after rotation, centered
            if (cellWidth > fillStyle.iconSize + 5 && cellHeight > categoryLabelTextLength + fillStyle.iconSize + 5) {
                showIcon = true;
            }
        } else {
            // Icon to the right of horizontal category label
            iconX = categoryLabelTextLength + fillStyle.iconPadding;
            iconY = (categoryLabelElement.attr("y") || categoryLabelFontSize) - fillStyle.iconSize * 0.8; // Align with text baseline
             if (cellWidth > categoryLabelTextLength + fillStyle.iconSize + 5 && cellHeight > fillStyle.iconSize + 5) {
                showIcon = true;
            }
        }
        
        if (cellWidth < fillStyle.iconSize + 10 || cellHeight < fillStyle.iconSize + 10) showIcon = false;


        if (showIcon) {
            const iconElement = group.append("image")
                .attr("class", "icon")
                .attr("xlink:href", imageUrl)
                .attr("width", fillStyle.iconSize)
                .attr("height", fillStyle.iconSize);

            if (isCategoryVertical) {
                 iconElement.attr("transform", `rotate(90)`)
                           .attr("x", iconX)
                           .attr("y", iconY);
            } else {
                iconElement.attr("x", iconX)
                           .attr("y", iconY);
            }
        }
    });


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}