/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Rose Charts",
  "chart_name": "small_multiple_rose_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 9]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    // Typography defaults and parsing
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const typographyInput = data.typography || {};
    const typography = {
        title: { ...defaultTypography.title, ...(typographyInput.title || {}) },
        label: { ...defaultTypography.label, ...(typographyInput.label || {}) },
        annotation: { ...defaultTypography.annotation, ...(typographyInput.annotation || {}) }
    };

    // Colors defaults and parsing
    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: [...d3.schemeCategory10],
        background_color: "#FFFFFF", // Not used directly on SVG, but available
        text_color: "#333333"
    };
    const colorsInput = data.colors || {}; // Assuming data.colors, not data.colors_dark for this refactor
    const colors = {
        field: { ...defaultColors.field, ...(colorsInput.field || {}) },
        other: { ...defaultColors.other, ...(colorsInput.other || {}) },
        available_colors: colorsInput.available_colors || defaultColors.available_colors,
        background_color: colorsInput.background_color || defaultColors.background_color,
        text_color: colorsInput.text_color || defaultColors.text_color
    };
    
    // Images defaults and parsing (not used in this chart, but good practice)
    // const imagesInput = data.images || {};
    // const images = {
    //     field: imagesInput.field || {},
    //     other: imagesInput.other || {}
    // };

    // Clear the container
    d3.select(containerSelector).html("");

    // Extract field names from dataColumns
    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    // Critical Identifier Validation
    if (!xField || !yField || !groupField) {
        let missingFields = [];
        if (!xField) missingFields.push("x field (role: 'x')");
        if (!yField) missingFields.push("y field (role: 'y')");
        if (!groupField) missingFields.push("group field (role: 'group')");
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }
    if (chartData.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>Warning: ${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};

    fillStyle.typography = {
        title: { 
            fontFamily: typography.title.font_family, 
            fontSize: typography.title.font_size, 
            fontWeight: typography.title.font_weight 
        },
        label: { 
            fontFamily: typography.label.font_family, 
            fontSize: typography.label.font_size, 
            fontWeight: typography.label.font_weight 
        },
        annotation: { 
            fontFamily: typography.annotation.font_family, 
            fontSize: typography.annotation.font_size, 
            fontWeight: typography.annotation.font_weight 
        }
    };

    fillStyle.textColor = colors.text_color;
    fillStyle.primaryColor = colors.other.primary;
    
    const categoryColorCache = {};
    let categoryColorIndex = 0;
    fillStyle.getCategoryColor = (categoryValue) => {
        if (colors.field && colors.field[categoryValue]) {
            return colors.field[categoryValue];
        }
        if (categoryColorCache[categoryValue]) {
            return categoryColorCache[categoryValue];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            const color = colors.available_colors[categoryColorIndex % colors.available_colors.length];
            categoryColorCache[categoryValue] = color;
            categoryColorIndex++;
            return color;
        }
        return fillStyle.primaryColor; // Fallback if no specific or available colors
    };

    const estimateTextWidth = (text, fontProps) => {
        if (!text || typeof text !== 'string') return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox should work on in-memory elements
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            const fontSizePx = parseFloat(fontProps.fontSize);
            width = text.length * fontSizePx * 0.6; // Rough estimate
        }
        return width;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("class", "chart-root"); // Added class for root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 30, bottom: 30, left: 30 }; // Keep original margins
    const legendConfig = {
        itemSpacing: 20,
        rowSpacing: 15,
        iconSize: 12,
        iconTextSpacing: 6,
        maxWidth: containerWidth - 100, // Max width for legend block
        topPadding: 15 // Padding from top of SVG to start of legend
    };

    // Small multiples layout calculation
    const numCharts = [...new Set(chartData.map(d => d[groupField]))].length;
    let rowsLayout, colsLayout;
    if (numCharts === 0) { // Should be caught by chartData.length === 0 earlier
        rowsLayout = 1; colsLayout = 1;
    } else if (numCharts === 1) {
        rowsLayout = 1; colsLayout = 1;
    } else if (numCharts === 2) {
        rowsLayout = 1; colsLayout = 2;
    } else if (numCharts <= 4) {
        rowsLayout = 2; colsLayout = 2;
    } else if (numCharts <= 6) {
        // Prioritize more rows if height allows, or more columns if width is ample.
        // Original was 3 rows, 2 cols. Let's stick to that for consistency.
        rowsLayout = Math.ceil(numCharts / 2); // Max 2 cols
        colsLayout = 2;
        if (rowsLayout * colsLayout < numCharts) rowsLayout++; // ensure enough cells
         if (numCharts > 4 && numCharts <=6) { // Original logic for 3x2 or 2x3
            rowsLayout = (containerHeight > containerWidth && numCharts > 3) ? 3 : 2;
            colsLayout = Math.ceil(numCharts / rowsLayout);
            if (numCharts <= 6 && numCharts > 4) { // specific case for 5 or 6 items
                 rowsLayout = Math.ceil(numCharts / 2); // Max 2 columns
                 colsLayout = 2;
            } else { // default for <=4
                 rowsLayout = Math.ceil(numCharts / 2);
                 colsLayout = Math.min(numCharts, 2);
            }
         } else { // for numCharts > 6, original was 3x3
            rowsLayout = Math.ceil(numCharts / 3);
            colsLayout = 3;
         }
    } else { // numCharts > 6 (e.g. 7, 8, 9 from constraints)
        rowsLayout = 3; 
        colsLayout = 3;
    }
    // Ensure colsLayout is at least 1 if numCharts > 0
    if (numCharts > 0 && colsLayout === 0) colsLayout = 1;


    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const cellWidth = numCharts > 0 ? chartAreaWidth / colsLayout : chartAreaWidth;
    const cellHeight = numCharts > 0 ? chartAreaHeight / rowsLayout : chartAreaHeight;

    const maxRadiusForRose = Math.min(cellWidth / 2.5, cellHeight / 2.5) - 20; // Space for title
    const innerRadiusForRose = maxRadiusForRose * 0.15;


    // Block 5: Data Preprocessing & Transformation
    const groupedData = d3.group(chartData, d => d[groupField]);
    const groupedDataArray = Array.from(groupedData, ([key, values]) => ({
        group: key,
        values: values,
        totalValue: d3.sum(values, d => d[yField])
    })).sort((a, b) => String(a.group).localeCompare(String(b.group)));

    const legendCategories = [...new Set(chartData.map(d => d[xField]))].sort((a,b) => String(a).localeCompare(String(b)));


    // Block 6: Scale Definition & Configuration
    const pieGenerator = d3.pie()
        .value(d => d[yField])
        .sort(null) // Preserve original data order for slices
        .padAngle(0.02);

    // Arc generator will be defined per small multiple due to dynamic outerRadius based on max value in that multiple

    // Block 7: Chart Component Rendering (Legend)
    const legendContainerGroup = svgRoot.append("g")
        .attr("class", "legend-group other"); // Standardized class

    const legendItemsData = legendCategories.map(category => ({
        label: category,
        color: fillStyle.getCategoryColor(category),
        width: legendConfig.iconSize + legendConfig.iconTextSpacing + estimateTextWidth(category, fillStyle.typography.label)
    }));
    
    const legendRows = [];
    let currentLegendRow = [], currentLegendRowWidth = 0;
    legendItemsData.forEach(item => {
        const itemTotalWidth = item.width + (currentLegendRow.length > 0 ? legendConfig.itemSpacing : 0);
        if (currentLegendRow.length === 0 || (currentLegendRowWidth + itemTotalWidth) <= legendConfig.maxWidth) {
            currentLegendRow.push(item);
            currentLegendRowWidth += itemTotalWidth;
        } else {
            legendRows.push({ items: currentLegendRow, width: currentLegendRowWidth - legendConfig.itemSpacing }); // Adjust width
            currentLegendRow = [item];
            currentLegendRowWidth = item.width;
        }
    });
    if (currentLegendRow.length > 0) {
        legendRows.push({ items: currentLegendRow, width: currentLegendRowWidth });
    }

    const legendTotalHeight = legendRows.length * (parseFloat(fillStyle.typography.label.fontSize) + legendConfig.rowSpacing) - (legendRows.length > 0 ? legendConfig.rowSpacing : 0);
    let legendStartY = legendConfig.topPadding;
    // Optional: Adjust chartMargins.top if legend is very tall, or center legend block if space allows.
    // For now, simple top placement.

    legendRows.forEach((row, rowIndex) => {
        const rowStartX = (containerWidth - row.width) / 2; // Center each row
        let currentX = rowStartX;
        const rowY = legendStartY + rowIndex * (parseFloat(fillStyle.typography.label.fontSize) + legendConfig.rowSpacing);

        row.items.forEach(item => {
            const itemGroup = legendContainerGroup.append("g")
                .attr("class", "legend-item other") // Standardized class
                .attr("transform", `translate(${currentX}, ${rowY})`);

            itemGroup.append("circle")
                .attr("cx", legendConfig.iconSize / 2)
                .attr("cy", parseFloat(fillStyle.typography.label.fontSize) / 2 - legendConfig.iconSize / 4) // Align better with text
                .attr("r", legendConfig.iconSize / 2)
                .attr("fill", item.color)
                .attr("class", "mark legend-mark");

            itemGroup.append("text")
                .attr("x", legendConfig.iconSize + legendConfig.iconTextSpacing)
                .attr("y", parseFloat(fillStyle.typography.label.fontSize) / 2)
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.label.fontFamily)
                .style("font-size", fillStyle.typography.label.fontSize)
                .style("font-weight", fillStyle.typography.label.fontWeight)
                .attr("class", "label legend-label")
                .text(item.label);
            
            currentX += item.width + legendConfig.itemSpacing;
        });
    });
    // Adjust chartMargins.top based on calculated legend height
    if (legendRows.length > 0) {
        chartMargins.top = legendStartY + legendTotalHeight + 15; // Add some padding below legend
    } else {
        chartMargins.top = 30; // Default if no legend
    }
    // Re-calculate chartAreaHeight and cellHeight if margins changed
    const finalChartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const finalCellHeight = numCharts > 0 ? finalChartAreaHeight / rowsLayout : finalChartAreaHeight;
    const finalMaxRadiusForRose = Math.min(cellWidth / 2.5, finalCellHeight / 2.5) - 20;
    const finalInnerRadiusForRose = finalMaxRadiusForRose * 0.15;


    // Block 8: Main Data Visualization Rendering (Small Multiples of Rose Charts)
    let dataIndex = 0;
    for (let r = 0; r < rowsLayout; r++) {
        const itemsInThisRow = (r < rowsLayout -1) ? colsLayout : (numCharts - (rowsLayout -1) * colsLayout);
        if (itemsInThisRow <= 0 && numCharts > 0) continue; // Skip if this row calculation leads to no items (e.g. for last row)
        
        // Adjust itemsInThisRow for the actual number of charts remaining for this row
        let actualItemsInThisRow = 0;
        for(let c_check = 0; c_check < colsLayout; c_check++){
            if(dataIndex + c_check < numCharts) actualItemsInThisRow++;
        }
        if (actualItemsInThisRow === 0 && numCharts > 0) continue;


        const rowOffset = (colsLayout - actualItemsInThisRow) * cellWidth / 2; // Center charts in the row if fewer than colsLayout

        for (let c = 0; c < actualItemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;

            const currentGroupData = groupedDataArray[dataIndex];
            
            const chartCenterX = chartMargins.left + rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (r + 0.5) * finalCellHeight;

            const smallMultipleGroup = svgRoot.append("g")
                .attr("class", "small-multiple-group other") // Standardized class
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const maxGroupValue = d3.max(currentGroupData.values, d => d[yField]);
            
            const currentArcGenerator = d3.arc()
                .innerRadius(finalInnerRadiusForRose)
                .outerRadius(d_arc => {
                    if (!d_arc.data || typeof d_arc.data[yField] !== 'number' || maxGroupValue === 0) {
                        return finalInnerRadiusForRose; // Avoid errors with bad data
                    }
                    const value = d_arc.data[yField];
                    const ratio = value / maxGroupValue;
                    return finalInnerRadiusForRose + (finalMaxRadiusForRose - finalInnerRadiusForRose) * ratio;
                });

            const pieDataForGroup = pieGenerator(currentGroupData.values.map(d => ({
                ...d,
                percentage: currentGroupData.totalValue > 0 ? (d[yField] / currentGroupData.totalValue) * 100 : 0
            })));

            smallMultipleGroup.selectAll("path.mark-segment")
                .data(pieDataForGroup)
                .enter().append("path")
                .attr("class", "mark mark-segment") // Standardized class
                .attr("fill", d_path => fillStyle.getCategoryColor(d_path.data[xField]))
                .attr("d", currentArcGenerator);

            // Add value labels (percentages)
            smallMultipleGroup.selectAll("text.value-label")
                .data(pieDataForGroup)
                .enter().append("text")
                .attr("class", "value value-label") // Standardized class
                .attr("transform", d_label => {
                    const [centroidX, centroidY] = currentArcGenerator.centroid(d_label);
                    const angle = (d_label.startAngle + d_label.endAngle) / 2 - Math.PI / 2;
                    const effectiveOuterRadius = currentArcGenerator.outerRadius()(d_label); // Get the calculated outer radius for this slice
                    const labelRadius = effectiveOuterRadius + 14; // Position outside the segment
                    
                    const x = Math.cos(angle) * labelRadius;
                    const y = Math.sin(angle) * labelRadius;
                    return `translate(${x}, ${y})`;
                })
                .attr("text-anchor", "middle")
                .attr("dy", ".35em")
                .style("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.annotation.fontFamily)
                .style("font-size", fillStyle.typography.annotation.fontSize)
                .style("font-weight", fillStyle.typography.annotation.fontWeight)
                .text(d_text => d_text.data.percentage >= 8 ? `${d_text.data.percentage.toFixed(1)}%` : '');

            // Add group title for the small multiple
            smallMultipleGroup.append("text")
                .attr("class", "label group-title-label") // Standardized class
                .attr("x", 0)
                .attr("y", -finalMaxRadiusForRose - 10) // Position above the rose
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.label.fontFamily)
                .style("font-size", fillStyle.typography.label.fontSize)
                .style("font-weight", fillStyle.typography.label.fontWeight)
                .style("fill", fillStyle.textColor)
                .text(currentGroupData.group);

            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}