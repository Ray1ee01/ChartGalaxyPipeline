/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Waffle Chart",
  "chart_name": "vertical_waffle_chart_04",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Or data.colors_dark if a theme mechanism were in place
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xColumn?.name;
    const valueFieldName = yColumn?.name;
    const valueFieldUnit = yColumn?.unit === "none" ? "" : (yColumn?.unit || "");

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Filter out data points with missing critical fields or non-numeric y-values
    const chartDataArray = chartDataInput.filter(d =>
        d[categoryFieldName] !== undefined &&
        d[valueFieldName] !== undefined &&
        !isNaN(parseFloat(d[valueFieldName]))
    ).map(d => ({
        ...d,
        [valueFieldName]: parseFloat(d[valueFieldName])
    }));
    
    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points to render after filtering.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyInput.title?.font_family || "Arial, sans-serif",
            titleFontSize: typographyInput.title?.font_size || "16px",
            titleFontWeight: typographyInput.title?.font_weight || "bold",
            labelFontFamily: typographyInput.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyInput.label?.font_size || "12px",
            labelFontWeight: typographyInput.label?.font_weight || "normal",
            annotationFontFamily: typographyInput.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyInput.annotation?.font_size || "10px",
            annotationFontWeight: typographyInput.annotation?.font_weight || "normal",
        },
        textColor: colorsInput.text_color || "#333333",
        primaryColor: colorsInput.other?.primary || "#4682B4",
        defaultCategoryColors: colorsInput.available_colors || [
            "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
            "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"
        ],
        waffleCellBackground: "#E0E0E0", // Solid light gray for empty cells
        chartBackground: colorsInput.background_color || "transparent", // Default to transparent
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.font_family);
        textElement.setAttribute('font-size', fontProps.font_size);
        textElement.setAttribute('font-weight', fontProps.font_weight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // getBBox should work on elements not appended to the live DOM.
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            width = (text?.length || 0) * (parseInt(fontProps.font_size) || 12) * 0.6; // Rough estimate
        }
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

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
    const chartMargins = { top: 30, right: 30, bottom: 30, left: 30 };
    // titleAndIconHeight is the space reserved above each waffle grid for its title, value, and icon.
    const titleAndIconHeight = 80; // Reduced from 100, original icon was -20 from -titleHeight/2
    const iconSize = 32; // Reduced from 40 for a tighter layout

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const waffleGridSize = 10; // Each waffle is 10x10 cells
    const totalCellsPerWaffle = waffleGridSize * waffleGridSize;

    const numCategories = chartDataArray.length;
    const waffleGridMargin = 40;
    const gridsPerRow = Math.min(3, numCategories > 0 ? numCategories : 1); // Avoid division by zero if numCategories is 0
    
    const singleWafflePlotWidth = (innerWidth - (gridsPerRow - 1) * waffleGridMargin) / gridsPerRow;
    const singleWafflePlotHeight = singleWafflePlotWidth; // Keep waffle cells square-ish

    // Cell size calculation based on the waffle grid area (not the whole plot height which includes title area)
    const waffleCellSize = (singleWafflePlotWidth / waffleGridSize) * 0.85; // Smaller cells for more padding
    const waffleCellPadding = (singleWafflePlotWidth / waffleGridSize) * 0.15;


    // Block 5: Data Preprocessing & Transformation
    const totalValueSum = chartDataArray.reduce((sum, d) => sum + d[valueFieldName], 0);

    const categoryInfoArray = chartDataArray.map((d, i) => {
        const category = d[categoryFieldName];
        const value = d[valueFieldName];
        const percentage = totalValueSum > 0 ? (value / totalValueSum) * 100 : 0;
        const filledCells = Math.round((percentage / 100) * totalCellsPerWaffle);
        
        const color = (colorsInput.field && colorsInput.field[category])
            ? colorsInput.field[category]
            : fillStyle.defaultCategoryColors[i % fillStyle.defaultCategoryColors.length];
        
        const iconUrl = (imagesInput.field && imagesInput.field[category])
            ? imagesInput.field[category]
            : null;

        return {
            category: String(category),
            value: value,
            percentage: percentage,
            filledCells: filledCells,
            color: color,
            iconUrl: iconUrl
        };
    });

    // Block 6: Scale Definition & Configuration
    // No complex scales needed for this waffle chart.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No main titles, axes, or legends as per directives. Category titles are part of waffle grid.

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 8: Main Data Visualization Rendering
    categoryInfoArray.forEach((info, index) => {
        const rowIndex = Math.floor(index / gridsPerRow);
        const colIndex = index % gridsPerRow;

        const waffleGridX = colIndex * (singleWafflePlotWidth + waffleGridMargin);
        // The Y position accounts for the space needed for titles/icons (titleAndIconHeight)
        // and the actual waffle grid height (singleWafflePlotHeight)
        const waffleGridY = rowIndex * (singleWafflePlotHeight + titleAndIconHeight + waffleGridMargin);

        const waffleGroup = mainChartGroup.append("g")
            .attr("class", "waffle-category-group")
            .attr("transform", `translate(${waffleGridX}, ${waffleGridY})`);

        const textGroup = waffleGroup.append("g").attr("class", "text-group");
        const iconYPosition = 15; // Relative to top of textGroup
        const percentageYPosition = iconYPosition;
        const categoryNameYPosition = titleAndIconHeight - 35; // Positioned towards bottom of title area
        const valueYPosition = titleAndIconHeight - 15;    // Positioned below category name

        if (info.iconUrl) {
            textGroup.append("circle")
                .attr("class", "icon-background")
                .attr("cx", singleWafflePlotWidth / 2 - (iconSize + 5)) // Position icon to the left of center
                .attr("cy", iconYPosition)
                .attr("r", iconSize / 2 + 3) // Small padding
                .style("fill", info.color);

            textGroup.append("image")
                .attr("class", "icon")
                .attr("x", singleWafflePlotWidth / 2 - (iconSize + 5) - iconSize / 2)
                .attr("y", iconYPosition - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", info.iconUrl)
                .attr("preserveAspectRatio", "xMidYMid meet");

            textGroup.append("text")
                .attr("class", "label percentage-label")
                .attr("x", singleWafflePlotWidth / 2 + 5) // Position percentage to the right of center
                .attr("y", percentageYPosition)
                .attr("text-anchor", "start")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.titleFontFamily)
                .style("font-size", fillStyle.typography.titleFontSize)
                .style("font-weight", fillStyle.typography.titleFontWeight)
                .style("fill", info.color)
                .text(`${info.percentage.toFixed(0)}%`);
        } else {
             // If no icon, center the percentage text
            textGroup.append("text")
                .attr("class", "label percentage-label")
                .attr("x", singleWafflePlotWidth / 2)
                .attr("y", percentageYPosition + iconSize / 4) // Adjust Y if no icon
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.titleFontFamily)
                .style("font-size", fillStyle.typography.titleFontSize)
                .style("font-weight", fillStyle.typography.titleFontWeight)
                .style("fill", info.color)
                .text(`${info.percentage.toFixed(0)}%`);
        }


        textGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", singleWafflePlotWidth / 2)
            .attr("y", categoryNameYPosition)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(info.category);

        textGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", singleWafflePlotWidth / 2)
            .attr("y", valueYPosition)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(`${formatValue(info.value)}${valueFieldUnit ? ' ' + valueFieldUnit : ''}`);

        // Waffle cells are rendered below the title/icon area
        const cellsGroup = waffleGroup.append("g")
            .attr("class", "waffle-cells-group")
            .attr("transform", `translate(0, ${titleAndIconHeight})`);

        for (let r = 0; r < waffleGridSize; r++) {
            for (let c = 0; c < waffleGridSize; c++) {
                cellsGroup.append("rect")
                    .attr("class", "mark waffle-cell background-cell")
                    .attr("x", c * (waffleCellSize + waffleCellPadding))
                    .attr("y", r * (waffleCellSize + waffleCellPadding))
                    .attr("width", waffleCellSize)
                    .attr("height", waffleCellSize)
                    .style("fill", fillStyle.waffleCellBackground);
            }
        }
        
        for (let cellIdx = 0; cellIdx < info.filledCells; cellIdx++) {
            // Fill from bottom-left, row by row
            const r = waffleGridSize - 1 - Math.floor(cellIdx / waffleGridSize);
            const c = cellIdx % waffleGridSize;
            
            cellsGroup.append("rect")
                .attr("class", "mark waffle-cell filled-cell")
                .attr("x", c * (waffleCellSize + waffleCellPadding))
                .attr("y", r * (waffleCellSize + waffleCellPadding))
                .attr("width", waffleCellSize)
                .attr("height", waffleCellSize)
                .style("fill", info.color);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex visual effects (shadows, gradients, rounded corners) as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}