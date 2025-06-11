/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Waffle Chart",
  "chart_name": "vertical_waffle_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "dark",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Prefer data.colors, fallback to data.colors_dark
    const imagesInput = data.images || {}; // Not used in this chart, but good practice
    const dataColumns = data.data?.columns || [];
    let chartDataArray = data.data?.data || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xColumn?.name;
    const valueFieldName = yColumn?.name;
    let valueUnit = (yColumn?.unit && yColumn.unit.toLowerCase() !== "none") ? yColumn.unit : "";


    if (!categoryFieldName || !valueFieldName) {
        const errorMessage = `Critical chart config missing: ${!categoryFieldName ? "x-field (category)" : ""} ${!valueFieldName ? "y-field (value)" : ""}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        return null;
    }
    
    if (!chartDataArray || chartDataArray.length === 0) {
        d3.select(containerSelector).html("<div style='color:grey; text-align:center; padding:20px;'>No data available to render the chart.</div>");
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            categoryTitle: {
                font_family: typographyInput.title?.font_family || "Arial, sans-serif",
                font_size: typographyInput.title?.font_size || "16px",
                font_weight: typographyInput.title?.font_weight || "bold",
            },
            valueLabel: { // For the label in the center of the waffle
                font_family: typographyInput.label?.font_family || "Arial, sans-serif",
                // font_size is dynamic, set later
                font_weight: typographyInput.label?.font_weight || "bold",
            }
        },
        textColor: colorsInput.text_color || "#E0E0E0", // Default for dark background
        categoryTitleColor: colorsInput.other?.primary || colorsInput.text_color || "#4682B4",
        primaryCellColor: colorsInput.other?.primary || "#4682B4",
        backgroundCellColor: "#CCCCCC", // As per original, light gray for empty cells
        valueLabelColor: "#FFFFFF", // White text on colored cells
        chartBackground: colorsInput.background_color || "transparent", // Default to transparent
    };

    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        svg.style.width = 'auto';
        svg.style.height = 'auto';
        // No need to append to DOM for getBBox if text element is created correctly with namespace

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        if (fontProps) {
            if (fontProps.font_family) textElement.style.fontFamily = fontProps.font_family;
            if (fontProps.font_size) textElement.style.fontSize = fontProps.font_size;
            if (fontProps.font_weight) textElement.style.fontWeight = fontProps.font_weight;
        }
        svg.appendChild(textElement);
        // Temporarily append to body to ensure getBBox works reliably in all browsers/contexts
        document.body.appendChild(svg);
        const width = textElement.getBBox().width;
        document.body.removeChild(svg);
        return width;
    }
    
    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for Billion
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value);
    };


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
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 30, right: 30, bottom: 40, left: 30 };
    const categoryTitleAreaHeight = 50; // Increased space for category title + percentage

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const waffleGridSize = 10; // Each waffle is 10x10 cells
    const totalCellsPerWaffle = waffleGridSize * waffleGridSize;

    const numCategories = chartDataArray.length;
    const waffleGridMargin = 40; // Margin between waffle grids

    const gridsPerRow = Math.min(3, numCategories); // Max 3 grids per row
    const numRowsForGrids = Math.ceil(numCategories / gridsPerRow);

    // Calculate available width/height for the grid area itself
    const totalGridWidth = (innerWidth - (gridsPerRow - 1) * waffleGridMargin) / gridsPerRow;
    // Total height available for one row of grids (grid + title)
    const totalGridHeightWithTitle = (innerHeight - (numRowsForGrids - 1) * waffleGridMargin) / numRowsForGrids;
    
    const singleWaffleGridActualHeight = totalGridHeightWithTitle - categoryTitleAreaHeight;
    // Waffle grids are square, so width is the minimum of calculated width and actual height
    const singleWaffleGridDimension = Math.max(50, Math.min(totalGridWidth, singleWaffleGridActualHeight));


    const waffleCellSize = (singleWaffleGridDimension / waffleGridSize) * 0.9; // 90% for cell, 10% for margin
    const waffleCellMargin = (singleWaffleGridDimension / waffleGridSize) * 0.1;


    // Block 5: Data Preprocessing & Transformation
    const totalValueOverall = chartDataArray.reduce((sum, d) => sum + (Number(d[valueFieldName]) || 0), 0);

    const processedData = chartDataArray.map(d => {
        const category = d[categoryFieldName];
        const value = Number(d[valueFieldName]) || 0;
        const percentage = totalValueOverall > 0 ? (value / totalValueOverall) * 100 : 0;
        const filledCells = Math.round((percentage / 100) * totalCellsPerWaffle);

        return {
            category: String(category),
            value: value,
            percentage: percentage,
            filledCells: filledCells,
        };
    });

    // Block 6: Scale Definition & Configuration
    // No traditional D3 scales are used for this chart type.
    // Cell positions are calculated directly.

    // Block 7: Chart Component Rendering (Category Titles)
    // Main chart group for margins
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    processedData.forEach((item, index) => {
        const rowIndex = Math.floor(index / gridsPerRow);
        const colIndex = index % gridsPerRow;

        const waffleGridX = colIndex * (singleWaffleGridDimension + waffleGridMargin);
        // Y position accounts for previous rows of grids and their titles
        const waffleGridY = rowIndex * (singleWaffleGridDimension + categoryTitleAreaHeight + waffleGridMargin);

        const waffleGroup = mainChartGroup.append("g")
            .attr("class", `waffle-grid-group other category-${index}`)
            .attr("transform", `translate(${waffleGridX}, ${waffleGridY})`);

        // Category Title and Percentage
        waffleGroup.append("text")
            .attr("class", "label category-title")
            .attr("x", singleWaffleGridDimension / 2)
            .attr("y", -categoryTitleAreaHeight / 2 + 5) // Adjusted for better centering in allocated space
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.categoryTitle.font_family)
            .style("font-size", fillStyle.typography.categoryTitle.font_size)
            .style("font-weight", fillStyle.typography.categoryTitle.font_weight)
            .style("fill", fillStyle.categoryTitleColor)
            .text(`${item.category} (${item.percentage.toFixed(0)}%)`);

        // Block 8: Main Data Visualization Rendering (Waffle Cells)
        // Background Cells
        for (let r = 0; r < waffleGridSize; r++) {
            for (let c = 0; c < waffleGridSize; c++) {
                waffleGroup.append("rect")
                    .attr("class", "mark background-cell")
                    .attr("x", c * (waffleCellSize + waffleCellMargin))
                    .attr("y", r * (waffleCellSize + waffleCellMargin))
                    .attr("width", waffleCellSize)
                    .attr("height", waffleCellSize)
                    .attr("fill", fillStyle.backgroundCellColor)
                    .attr("opacity", 0.25);
            }
        }

        // Filled Cells (from bottom-left, filling upwards column by column, or row by row)
        // Original fills row by row from top-left. Let's maintain that.
        for (let cellIdx = 0; cellIdx < item.filledCells; cellIdx++) {
            const r = Math.floor(cellIdx / waffleGridSize);
            const c = cellIdx % waffleGridSize;

            waffleGroup.append("rect")
                .attr("class", "mark value-cell")
                .attr("x", c * (waffleCellSize + waffleCellMargin))
                .attr("y", r * (waffleCellSize + waffleCellMargin))
                .attr("width", waffleCellSize)
                .attr("height", waffleCellSize)
                .attr("fill", fillStyle.primaryCellColor);
        }

        // Block 9: Optional Enhancements & Post-Processing (Value Labels)
        const valueLabelFontSize = Math.min(singleWaffleGridDimension / 5, 24); // Dynamic font size
        waffleGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", singleWaffleGridDimension / 2)
            .attr("y", singleWaffleGridDimension / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.valueLabel.font_family)
            .style("font-size", `${valueLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.valueLabel.font_weight)
            .style("fill", fillStyle.valueLabelColor)
            .text(`${formatValue(item.value)}${valueUnit}`);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}