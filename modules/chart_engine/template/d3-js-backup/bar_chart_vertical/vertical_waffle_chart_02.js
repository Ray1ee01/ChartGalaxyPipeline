/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multi-Waffle Chart",
  "chart_name": "multi_waffle_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[1, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 250,
  "min_width": 250,
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
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const dataTypography = data.typography || {};
    const dataColors = data.colors || {};
    // const dataImages = data.images || {}; // Not used in this chart
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";

    const xColumn = dataColumns.find(col => col.role === xFieldRole);
    const yColumn = dataColumns.find(col => col.role === yFieldRole);

    const categoryFieldName = xColumn?.name;
    const valueFieldName = yColumn?.name;
    const valueFieldUnit = yColumn?.unit === "none" ? "" : (yColumn?.unit || "");

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push(`field with role '${xFieldRole}'`);
        if (!valueFieldName) missingFields.push(`field with role '${yFieldRole}'`);
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {},
    };

    // Typography configuration
    const defaultTypographySettings = {
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "bold" }, // For category name
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" } // For category value/percentage
    };

    fillStyle.typography.categoryName = {
        fontFamily: (dataTypography.label && dataTypography.label.font_family) || defaultTypographySettings.label.font_family,
        fontSize: (dataTypography.label && dataTypography.label.font_size) || defaultTypographySettings.label.font_size,
        fontWeight: (dataTypography.label && dataTypography.label.font_weight) || defaultTypographySettings.label.font_weight,
    };
    fillStyle.typography.categoryValue = {
        fontFamily: (dataTypography.annotation && dataTypography.annotation.font_family) || defaultTypographySettings.annotation.font_family,
        fontSize: (dataTypography.annotation && dataTypography.annotation.font_size) || defaultTypographySettings.annotation.font_size,
        fontWeight: (dataTypography.annotation && dataTypography.annotation.font_weight) || defaultTypographySettings.annotation.font_weight,
    };
    
    // Color configuration
    const defaultColorPalette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"];
    fillStyle.colors.textColor = dataColors.text_color || "#333333";
    fillStyle.colors.defaultCellColor = "#E0E0E0"; // Default for empty waffle cells
    fillStyle.colors.chartBackground = dataColors.background_color || "#FFFFFF"; // Available, but not applied to SVG root

    fillStyle.colors.getCategoryColor = (category, index) => {
        if (dataColors.field && dataColors.field[category]) {
            return dataColors.field[category];
        }
        if (dataColors.available_colors && dataColors.available_colors.length > 0) {
            return dataColors.available_colors[index % dataColors.available_colors.length];
        }
        return defaultColorPalette[index % defaultColorPalette.length];
    };

    // Helper for number formatting
    const formatValue = (value) => {
        if (value === null || value === undefined || isNaN(value)) return "N/A";
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for billion
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value); // Use ~g for smaller numbers or if no suffix needed
    };
    
    // Helper for text width estimation (in-memory) - Not strictly needed for this chart's layout, but good practice
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text || typeof text !== 'string' || text.trim() === "") return 0;
        try {
            const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            const tempText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            tempText.setAttribute("font-family", fontFamily);
            tempText.setAttribute("font-size", fontSize);
            tempText.setAttribute("font-weight", fontWeight);
            tempText.textContent = text;
            tempSvg.appendChild(tempText);
            return tempText.getBBox().width;
        } catch (e) {
            const size = parseFloat(fontSize);
            if (isNaN(size)) return text.length * 8; 
            return text.length * size * 0.6;
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.colors.chartBackground); // Optional: apply background color to SVG

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 30, right: 30, bottom: 40, left: 30 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const waffleGridSize = 10; // Each waffle is 10x10 cells
    const totalCellsPerWaffle = waffleGridSize * waffleGridSize;
    
    const waffleLabelAreaHeight = (parseFloat(fillStyle.typography.categoryName.fontSize) || 12) + 
                                  (parseFloat(fillStyle.typography.categoryValue.fontSize) || 10) + 20; // Height for text above each waffle
    const waffleGridMargin = 40; // Margin between individual waffle charts

    // Block 5: Data Preprocessing & Transformation
    const chartDataProcessed = chartDataInput.map((d, i) => {
        const category = d[categoryFieldName];
        const value = +d[valueFieldName] || 0;
        return { category, value, originalIndex: i };
    });

    const totalValueSum = chartDataProcessed.reduce((sum, d) => sum + d.value, 0);

    const categoryInfo = chartDataProcessed.map(d => {
        const percentage = totalValueSum > 0 ? (d.value / totalValueSum) * 100 : 0;
        const filledCells = Math.round((percentage / 100) * totalCellsPerWaffle);
        return {
            category: d.category,
            value: d.value,
            percentage: percentage,
            filledCells: filledCells,
            color: fillStyle.colors.getCategoryColor(d.category, d.originalIndex)
        };
    });

    if (categoryInfo.length === 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "text label")
            .style("font-family", fillStyle.typography.categoryName.fontFamily)
            .style("font-size", "16px") // A bit larger for "no data" message
            .style("fill", fillStyle.colors.textColor)
            .text("No data available to display.");
        return svgRoot.node();
    }
    
    const numCategories = categoryInfo.length;
    const wafflesPerRow = Math.min(3, numCategories); // Max 3 waffles per row
    const numWaffleRows = Math.ceil(numCategories / wafflesPerRow);

    const effectiveChartWidth = innerWidth; // Width available for all waffles in a row
    const singleWafflePlotWidth = (effectiveChartWidth - (wafflesPerRow - 1) * waffleGridMargin) / wafflesPerRow;
    const singleWafflePlotHeight = singleWafflePlotWidth; // Keep waffle cells area square

    const waffleCellSize = (singleWafflePlotWidth / waffleGridSize) * 0.9; // 90% for cell, 10% for margin
    const waffleCellMargin = (singleWafflePlotWidth / waffleGridSize) * 0.1;

    // Block 6: Scale Definition & Configuration
    // Not applicable for traditional scales (xScale, yScale) in this waffle chart.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Axes and Legend are not part of this specific waffle chart design.
    // Gridlines are implicitly the waffle cells themselves.

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    categoryInfo.forEach((catInfo, index) => {
        const waffleRowIndex = Math.floor(index / wafflesPerRow);
        const waffleColIndex = index % wafflesPerRow;

        const waffleGroupX = waffleColIndex * (singleWafflePlotWidth + waffleGridMargin);
        const waffleGroupY = waffleRowIndex * (singleWafflePlotHeight + waffleLabelAreaHeight + waffleGridMargin);

        const waffleGroup = mainChartGroup.append("g")
            .attr("class", "waffle-group mark")
            .attr("transform", `translate(${waffleGroupX}, ${waffleGroupY})`);

        // Category Name and Percentage Text
        waffleGroup.append("text")
            .attr("x", singleWafflePlotWidth / 2)
            .attr("y", 0) // Positioned at the top of the label area
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("class", "text label category-title")
            .style("font-family", fillStyle.typography.categoryName.fontFamily)
            .style("font-size", fillStyle.typography.categoryName.fontSize)
            .style("font-weight", fillStyle.typography.categoryName.fontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(`${catInfo.category} (${catInfo.percentage.toFixed(0)}%)`);

        // Category Value Text
        waffleGroup.append("text")
            .attr("x", singleWafflePlotWidth / 2)
            .attr("y", parseFloat(fillStyle.typography.categoryName.fontSize) + 5) // Below category name
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("class", "text label category-value")
            .style("font-family", fillStyle.typography.categoryValue.fontFamily)
            .style("font-size", fillStyle.typography.categoryValue.fontSize)
            .style("font-weight", fillStyle.typography.categoryValue.fontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(`${formatValue(catInfo.value)} ${valueFieldUnit}`);

        const waffleCellsGroup = waffleGroup.append("g")
            .attr("transform", `translate(0, ${waffleLabelAreaHeight})`); // Position cells below labels

        // Render background cells
        for (let r = 0; r < waffleGridSize; r++) {
            for (let c = 0; c < waffleGridSize; c++) {
                waffleCellsGroup.append("rect")
                    .attr("x", c * (waffleCellSize + waffleCellMargin))
                    .attr("y", r * (waffleCellSize + waffleCellMargin))
                    .attr("width", waffleCellSize)
                    .attr("height", waffleCellSize)
                    .attr("fill", fillStyle.colors.defaultCellColor)
                    .attr("rx", 0) // No rounded corners
                    .attr("ry", 0)
                    .attr("class", "mark waffle-cell background-cell");
            }
        }
        
        // Render filled cells (top-down, left-to-right)
        for (let i = 0; i < catInfo.filledCells; i++) {
            const r = Math.floor(i / waffleGridSize);
            const c = i % waffleGridSize;
            
            waffleCellsGroup.append("rect")
                .attr("x", c * (waffleCellSize + waffleCellMargin))
                .attr("y", r * (waffleCellSize + waffleCellMargin))
                .attr("width", waffleCellSize)
                .attr("height", waffleCellSize)
                .attr("fill", catInfo.color)
                .attr("rx", 0) // No rounded corners
                .attr("ry", 0)
                .attr("class", "mark value waffle-cell filled-cell");
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations or interactive elements in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}