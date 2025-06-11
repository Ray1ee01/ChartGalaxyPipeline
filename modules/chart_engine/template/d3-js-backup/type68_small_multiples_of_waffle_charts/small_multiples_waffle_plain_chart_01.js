/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Waffle Charts",
  "chart_name": "small_multiples_waffle_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
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
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Could also be data.colors_dark
    const imagesInput = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldColumn = dataColumns.find(col => col.role === "x");
    const yFieldColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xFieldColumn ? xFieldColumn.name : undefined;
    const valueFieldName = yFieldColumn ? yFieldColumn.name : undefined;
    const valueFieldUnit = yFieldColumn && yFieldColumn.unit !== "none" ? (yFieldColumn.unit || "") : "";

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field (category)");
        if (!valueFieldName) missingFields.push("y role field (value)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            categoryTitle: {
                font_family: (typographyInput.label && typographyInput.label.font_family) || "Arial, sans-serif",
                font_size: (typographyInput.label && typographyInput.label.font_size) || "14px",
                font_weight: (typographyInput.label && typographyInput.label.font_weight) || "bold",
            },
            valueText: {
                font_family: (typographyInput.annotation && typographyInput.annotation.font_family) || "Arial, sans-serif",
                font_size: (typographyInput.annotation && typographyInput.annotation.font_size) || "12px",
                font_weight: (typographyInput.annotation && typographyInput.annotation.font_weight) || "normal",
            }
        },
        textColor: colorsInput.text_color || "#333333",
        waffleCellBackground: "#E0E0E0", // Default subtle background for empty cells
        defaultCategoryColors: colorsInput.available_colors || [
            "#4269d0", "#efb118", "#ff725c", "#6cc5b0", "#ff8ab7", "#97bbf5"
        ],
        chartBackground: colorsInput.background_color || "#FFFFFF", // Not directly used on SVG, but available
        primaryColor: (colorsInput.other && colorsInput.other.primary) || "#4682B4"
    };

    // Helper to estimate text width (not strictly used for layout in this chart, but required by III.2)
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.style.fontFamily = fontProps.font_family;
        textElement.style.fontSize = fontProps.font_size;
        textElement.style.fontWeight = fontProps.font_weight;
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // document.body.appendChild(tempSvg); // Temporarily append to measure accurately
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth: getBBox failed for off-DOM element. This might happen in some environments.");
            const avgCharWidth = parseFloat(fontProps.font_size) * 0.6; // Rough fallback
            width = text.length * avgCharWidth;
        }
        // tempSvg.remove(); // Clean up
        return width;
    }
    
    // Helper for formatting numerical values
    const formatValue = (value) => {
        if (value === null || value === undefined || isNaN(value)) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI prefix
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value); // General format for smaller numbers
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
        .style("background-color", fillStyle.chartBackground); // Apply background color to SVG itself

    const chartMargins = { top: 30, right: 30, bottom: 30, left: 30 };

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const waffleGridSize = 10; // Each waffle is 10x10 cells
    const totalCellsPerWaffle = waffleGridSize * waffleGridSize;

    const numCategories = chartDataArray.length;
    if (numCategories === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "label")
            .style("font-family", fillStyle.typography.categoryTitle.font_family)
            .style("font-size", fillStyle.typography.categoryTitle.font_size)
            .style("fill", fillStyle.textColor)
            .text("No data to display.");
        return svgRoot.node();
    }
    
    const waffleHeaderAreaHeight = 60; // Space above each waffle for title and value
    const waffleChartSpacing = 40; // Spacing between waffle charts

    const gridsPerRow = Math.min(3, numCategories); // Max 3 waffles per row
    const numRows = Math.ceil(numCategories / gridsPerRow);

    // Calculate width for each waffle chart (cell area)
    const singleWaffleCellAreaWidth = (innerWidth - (gridsPerRow - 1) * waffleChartSpacing) / gridsPerRow;
    // Calculate height for each waffle chart (cell area)
    // To keep waffles square, cell area height = cell area width
    // Total height required for one row of waffles including header: singleWaffleCellAreaWidth + waffleHeaderAreaHeight
    // Total height required for all rows: numRows * (singleWaffleCellAreaWidth + waffleHeaderAreaHeight) + (numRows - 1) * waffleChartSpacing
    // This must fit innerHeight. If not, chart may be clipped or scaled down.
    // For this refactor, we assume containerHeight is sufficient.
    const singleWaffleCellAreaHeight = singleWaffleCellAreaWidth; 

    const waffleCellSize = (singleWaffleCellAreaWidth / waffleGridSize) * 0.85; // Cell size with some padding
    const waffleCellMargin = (singleWaffleCellAreaWidth / waffleGridSize) * 0.15 / (waffleGridSize + 1) ; // Distribute margin

    // Block 5: Data Preprocessing & Transformation
    const totalSumOfValues = chartDataArray.reduce((sum, d) => sum + (Number(d[valueFieldName]) || 0), 0);

    const processedChartData = chartDataArray.map((d, i) => {
        const category = d[categoryFieldName];
        const value = Number(d[valueFieldName]) || 0;
        const percentage = totalSumOfValues > 0 ? (value / totalSumOfValues) * 100 : 0;
        const filledCells = Math.round((percentage / 100) * totalCellsPerWaffle);
        
        let color;
        if (colorsInput.field && colorsInput.field[category]) {
            color = colorsInput.field[category];
        } else {
            color = fillStyle.defaultCategoryColors[i % fillStyle.defaultCategoryColors.length];
        }
        
        return {
            category: String(category),
            value: value,
            percentage: percentage,
            filledCells: filledCells,
            color: color
        };
    });

    // Block 6: Scale Definition & Configuration
    // No complex scales needed for waffle charts. Color mapping is handled in Block 5.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No separate axes, gridlines, or legend for this chart type. Category info is part of each small multiple.

    // Block 8: Main Data Visualization Rendering
    processedChartData.forEach((waffleData, index) => {
        const rowIndex = Math.floor(index / gridsPerRow);
        const colIndex = index % gridsPerRow;

        const waffleGroupX = colIndex * (singleWaffleCellAreaWidth + waffleChartSpacing);
        // Y position accounts for previous rows' heights (cell area + header) and spacing
        const waffleGroupY = rowIndex * (singleWaffleCellAreaHeight + waffleHeaderAreaHeight + waffleChartSpacing);

        const waffleGroup = mainChartGroup.append("g")
            .attr("class", "mark waffle-multiple")
            .attr("transform", `translate(${waffleGroupX}, ${waffleGroupY})`);

        // Render Category Title
        waffleGroup.append("text")
            .attr("class", "label category-title")
            .attr("x", singleWaffleCellAreaWidth / 2)
            .attr("y", -waffleHeaderAreaHeight + 20) // Positioned within the header area
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .style("font-family", fillStyle.typography.categoryTitle.font_family)
            .style("font-size", fillStyle.typography.categoryTitle.font_size)
            .style("font-weight", fillStyle.typography.categoryTitle.font_weight)
            .style("fill", fillStyle.textColor)
            .text(`${waffleData.category} (${waffleData.percentage.toFixed(0)}%)`);

        // Render Category Value
        waffleGroup.append("text")
            .attr("class", "label category-value")
            .attr("x", singleWaffleCellAreaWidth / 2)
            .attr("y", -waffleHeaderAreaHeight + 20 + parseFloat(fillStyle.typography.categoryTitle.font_size) + 5) // Below title
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .style("font-family", fillStyle.typography.valueText.font_family)
            .style("font-size", fillStyle.typography.valueText.font_size)
            .style("font-weight", fillStyle.typography.valueText.font_weight)
            .style("fill", fillStyle.textColor)
            .text(`${formatValue(waffleData.value)} ${valueFieldUnit}`);

        const cellGridGroup = waffleGroup.append("g")
            .attr("class", "waffle-cell-grid");
            // Transform to start cells below the header area (0,0 of waffleGroup is top-left of header)
            // No, (0,0) of waffleGroup is where cell grid starts, titles are negative Y.
            // The Y translation for waffleGroup already accounts for header.

        // Render Waffle Cells (Background and Filled)
        for (let r = 0; r < waffleGridSize; r++) {
            for (let c = 0; c < waffleGridSize; c++) {
                const cellIndex = r * waffleGridSize + c; // Read cells left-to-right, top-to-bottom
                const cellX = c * (waffleCellSize + waffleCellMargin) + waffleCellMargin / 2;
                const cellY = r * (waffleCellSize + waffleCellMargin) + waffleCellMargin / 2;

                // Background cell (always rendered)
                cellGridGroup.append("rect")
                    .attr("class", "mark waffle-cell-background")
                    .attr("x", cellX)
                    .attr("y", cellY)
                    .attr("width", waffleCellSize)
                    .attr("height", waffleCellSize)
                    .style("fill", fillStyle.waffleCellBackground)
                    .style("stroke", "none");

                // Filled cell (if applicable)
                if (cellIndex < waffleData.filledCells) {
                    cellGridGroup.append("rect")
                        .attr("class", "mark value waffle-cell-filled")
                        .attr("x", cellX)
                        .attr("y", cellY)
                        .attr("width", waffleCellSize)
                        .attr("height", waffleCellSize)
                        .style("fill", waffleData.color)
                        .style("stroke", "none");
                }
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No shadows, rounded corners, or other complex effects as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}