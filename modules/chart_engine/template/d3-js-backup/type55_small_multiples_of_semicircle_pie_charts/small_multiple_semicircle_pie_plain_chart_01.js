/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Semicircle Pie Charts",
  "chart_name": "small_multiple_semicircle_pie_plain_chart_01",
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

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const rawTypography = data.typography || {};
    const chartTypography = {
        title: { ...defaultTypography.title, ...(rawTypography.title || {}) },
        label: { ...defaultTypography.label, ...(rawTypography.label || {}) },
        annotation: { ...defaultTypography.annotation, ...(rawTypography.annotation || {}) }
    };

    const defaultColors = {
        field: {},
        other: { primary: "#4682B4", secondary: "#ff7f0e" },
        available_colors: [...d3.schemeCategory10],
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };
    const rawColors = data.colors || {}; // Assuming data.colors, not data.colors_dark for this refactor
    const chartColors = {
        field: rawColors.field || defaultColors.field,
        other: { ...defaultColors.other, ...rawColors.other },
        available_colors: rawColors.available_colors || defaultColors.available_colors,
        background_color: rawColors.background_color || defaultColors.background_color,
        text_color: rawColors.text_color || defaultColors.text_color
    };
    
    const images = data.images || {}; // Not used in this chart, but extracted per requirement

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    if (!xField || !yField || !groupField) {
        let missing = [];
        if (!xField) missing.push("x field (role: 'x')");
        if (!yField) missing.push("y field (role: 'y')");
        if (!groupField) missing.push("group field (role: 'group')");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: chartColors.text_color,
        primaryColor: chartColors.other.primary,
        backgroundColor: chartColors.background_color,
        fieldColors: chartColors.field,
        availableColors: chartColors.available_colors,
        typography: {
            labelFontFamily: chartTypography.label.font_family,
            labelFontSize: chartTypography.label.font_size,
            labelFontWeight: chartTypography.label.font_weight,
            annotationFontFamily: chartTypography.annotation.font_family,
            annotationFontSize: chartTypography.annotation.font_size,
            annotationFontWeight: chartTypography.annotation.font_weight,
        }
    };

    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const size = typeof fontSize === 'number' ? `${fontSize}px` : fontSize;
        context.font = `${fontWeight} ${size} ${fontFamily}`;
        const width = context.measureText(text).width;
        return width;
    };

    const getColorBrightness = (hexColor) => {
        if (!hexColor || hexColor.length < 6) return 128; // Default to mid-brightness if invalid
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        return (r * 299 + g * 587 + b * 114) / 1000;
    };

    function renderLegend(svgGroup, legendItems, legendConfig) {
        const { maxWidth, x, y, itemHeight, itemSpacing, rowSpacing, symbolSize, align, shape } = legendConfig;
        
        const itemWidths = legendItems.map(item => {
            const textWidth = estimateTextWidth(item, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            return symbolSize * 2 + textWidth + 5; // symbol + padding + text
        });
        
        const rows = [];
        let currentRow = [], currentRowWidth = 0;
        
        itemWidths.forEach((width, i) => {
            if (currentRow.length === 0 || currentRowWidth + width + itemSpacing <= maxWidth) {
                currentRow.push(i);
                currentRowWidth += width + (currentRow.length > 1 ? itemSpacing : 0);
            } else {
                rows.push(currentRow);
                currentRow = [i];
                currentRowWidth = width;
            }
        });
        if (currentRow.length > 0) rows.push(currentRow);
        
        const totalHeight = rows.length * itemHeight + (rows.length - 1) * rowSpacing;
        const maxRowWidth = Math.max(0, ...rows.map(row => { // Ensure Math.max doesn't get -Infinity
            return row.reduce((sum, i, idx) => sum + itemWidths[i] + (idx > 0 ? itemSpacing : 0), 0);
        }));
        
        rows.forEach((row, rowIndex) => {
            const rowWidth = row.reduce((sum, i, idx) => sum + itemWidths[i] + (idx > 0 ? itemSpacing : 0), 0);
            let rowStartX = align === "center" ? x + (maxWidth - rowWidth) / 2 :
                           align === "right" ? x + maxWidth - rowWidth : x;
            
            let currentX = rowStartX;
            row.forEach(idx => {
                const itemName = legendItems[idx];
                const itemColor = (fillStyle.fieldColors && fillStyle.fieldColors[itemName]) 
                                ? fillStyle.fieldColors[itemName] 
                                : fillStyle.availableColors[idx % fillStyle.availableColors.length];
                
                const legendItemGroup = svgGroup.append("g")
                    .attr("transform", `translate(${currentX}, ${y + rowIndex * (itemHeight + rowSpacing)})`)
                    .attr("class", "other"); // Class for legend item
                
                if (shape === "rect") {
                    legendItemGroup.append("rect")
                        .attr("x", 0).attr("y", itemHeight / 2 - symbolSize / 2)
                        .attr("width", symbolSize).attr("height", symbolSize)
                        .attr("fill", itemColor).attr("class", "mark");
                } else { // Default to circle
                    legendItemGroup.append("circle")
                        .attr("cx", symbolSize / 2).attr("cy", itemHeight / 2)
                        .attr("r", symbolSize / 2).attr("fill", itemColor).attr("class", "mark");
                }
                
                legendItemGroup.append("text")
                    .attr("x", symbolSize * 1.5).attr("y", itemHeight / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("fill", fillStyle.textColor)
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .attr("class", "label")
                    .text(itemName);
                
                currentX += itemWidths[idx] + itemSpacing;
            });
        });
        
        return { width: maxRowWidth, height: totalHeight };
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.backgroundColor); // Optional: set background color

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 30, bottom: 30, left: 30 }; // Legend and titles go in top margin

    const numCharts = d3.group(rawChartData, d => d[groupField]).size;
    let layoutRows, layoutCols;

    if (numCharts === 2) { layoutRows = 1; layoutCols = 2; }
    else if (numCharts <= 4) { layoutRows = 2; layoutCols = 2; }
    else if (numCharts <= 6) { layoutRows = 3; layoutCols = 2; }
    else { layoutRows = 3; layoutCols = 3; } // Covers 7-9 as per original logic and range

    const itemsPerRow = [];
    for (let i = 0; i < layoutRows; i++) {
        const startIndex = i * layoutCols;
        const endIndex = Math.min(startIndex + layoutCols, numCharts);
        const itemsInThisRow = endIndex - startIndex;
        if (itemsInThisRow > 0) itemsPerRow.push(itemsInThisRow);
    }
    
    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const cellWidth = chartAreaWidth / layoutCols;
    const cellHeight = chartAreaHeight / layoutRows;
    const pieRadius = Math.min(cellWidth / 2.4, cellHeight / 1.8) - 15;

    // Block 5: Data Preprocessing & Transformation
    const groupedChartData = Array.from(d3.group(rawChartData, d => d[groupField]), ([key, values]) => ({
        groupName: key,
        values: values,
        totalValue: d3.sum(values, d => d[yField])
    })).sort((a, b) => a.groupName.localeCompare(b.groupName));

    // Block 6: Scale Definition & Configuration
    // Pie and Arc generators are like scales for this chart type
    const pieGenerator = d3.pie()
        .value(d => d[yField])
        .sort(null) // Keep original data order
        .startAngle(-Math.PI / 2)
        .endAngle(Math.PI / 2);

    const arcGenerator = d3.arc()
        .innerRadius(0)
        .outerRadius(pieRadius)
        .padAngle(0.02); // Keep padAngle for slice separation

    const labelArcGenerator = d3.arc()
        .innerRadius(pieRadius * 0.6)
        .outerRadius(pieRadius * 0.6);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const allXValues = [...new Set(rawChartData.map(d => d[xField]))].sort((a,b) => String(a).localeCompare(String(b)));
    
    const legendGroup = svgRoot.append("g").attr("class", "legend");
    const legendConfig = {
        maxWidth: containerWidth - 80, // Max width for legend
        x: 0, // Relative x within legendGroup
        y: 0, // Relative y within legendGroup
        itemHeight: 20,
        itemSpacing: 10, // Reduced spacing
        rowSpacing: 5,   // Reduced spacing
        symbolSize: 10,
        align: "center",
        shape: "rect" // As per original
    };
    const legendSize = renderLegend(legendGroup, allXValues, legendConfig);
    
    // Position legend group: fixed y=50, horizontally centered
    legendGroup.attr("transform", `translate(${(containerWidth - legendSize.width) / 2}, 50)`);


    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let r = 0; r < itemsPerRow.length; r++) {
        const itemsInCurrentRow = itemsPerRow[r];
        const rowOffset = (layoutCols - itemsInCurrentRow) * cellWidth / 2; // For centering rows with fewer items

        for (let c = 0; c < itemsInCurrentRow; c++) {
            if (dataIndex >= numCharts) break;

            const groupData = groupedChartData[dataIndex];
            
            const chartCenterX = chartMargins.left + rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (r + 0.7) * cellHeight; // Adjusted for semi-circle

            const chartGroup = svgRoot.append("g")
                .attr("class", "chart-multiple") // Class for each small multiple
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const dataWithPercentages = groupData.values.map(d => ({
                ...d,
                percentage: groupData.totalValue === 0 ? 0 : (d[yField] / groupData.totalValue) * 100
            }));

            const pieSlices = pieGenerator(dataWithPercentages);

            chartGroup.selectAll("path.mark")
                .data(pieSlices)
                .enter()
                .append("path")
                .attr("class", "mark")
                .attr("fill", (d, i) => {
                    const categoryName = d.data[xField];
                    return (fillStyle.fieldColors && fillStyle.fieldColors[categoryName]) 
                           ? fillStyle.fieldColors[categoryName] 
                           : fillStyle.availableColors[allXValues.indexOf(categoryName) % fillStyle.availableColors.length] || fillStyle.primaryColor;
                })
                .attr("d", arcGenerator);

            chartGroup.selectAll("text.value")
                .data(pieSlices)
                .enter()
                .append("text")
                .attr("class", "value")
                .attr("transform", d => {
                    const arcAngle = d.endAngle - d.startAngle;
                    const percentOfSemiCircle = arcAngle / Math.PI;
                    return percentOfSemiCircle > 0.12 ? `translate(${labelArcGenerator.centroid(d)})` : "translate(-10000, -10000)"; // Hide small labels
                })
                .attr("text-anchor", "middle")
                .attr("dy", ".35em")
                .style("fill", d => {
                    const sliceColor = (fillStyle.fieldColors && fillStyle.fieldColors[d.data[xField]]) 
                                     ? fillStyle.fieldColors[d.data[xField]] 
                                     : fillStyle.availableColors[allXValues.indexOf(d.data[xField]) % fillStyle.availableColors.length] || fillStyle.primaryColor;
                    return getColorBrightness(sliceColor) > 128 ? "#000000" : "#FFFFFF";
                })
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(d => {
                    const arcAngle = d.endAngle - d.startAngle;
                    const percentOfSemiCircle = arcAngle / Math.PI;
                    return percentOfSemiCircle > 0.12 ? `${d.data.percentage.toFixed(1)}%` : '';
                });

            chartGroup.append("text")
                .attr("class", "label")
                .attr("x", 0)
                .attr("y", -pieRadius - 15) // Position above the semi-circle
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(groupData.groupName);

            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}