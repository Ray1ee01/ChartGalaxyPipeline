/* REQUIREMENTS_BEGIN
{
  "chart_type": "Waffle Chart",
  "chart_name": "waffle_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[1, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 300,
  "min_width": 300,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
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
    const chartConfig = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {}; // Though not used in this specific chart type
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    if (!categoryColumn || !valueColumn) {
        console.error("Critical chart config missing: Category (x) or Value (y) field definition not found in data.data.columns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration missing. Category (x) or Value (y) field definition not found.</div>");
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;
    const valueUnit = valueColumn.unit === "none" ? "" : (valueColumn.unit || "");

    // Filter out data points with missing or invalid critical fields
    chartDataArray = chartDataArray.filter(d =>
        d[categoryFieldName] !== undefined && d[categoryFieldName] !== null &&
        d[valueFieldName] !== undefined && d[valueFieldName] !== null && !isNaN(parseFloat(d[valueFieldName]))
    );
    
    if (chartDataArray.length === 0) {
        console.error("No valid data available after filtering. Cannot render chart.");
        d3.select(containerSelector).html("<div style='color:orange; text-align:center; padding:20px;'>No valid data to display.</div>");
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colorsInput.text_color || "#333333",
        chartBackground: colorsInput.background_color || "#FFFFFF", // Default to white if not provided
        defaultSquareStroke: "#E0E0E0", // A light stroke for squares
        categoryColors: {},
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            get labelBoldFontWeight() { return (typographyInput.label && typographyInput.label.font_weight === 'bold') ? 'bolder' : 'bold'; } // Ensure bold is bolder than normal
        }
    };

    const defaultCategoricalColors = colorsInput.available_colors || d3.schemeCategory10;
    chartDataArray.forEach((d, i) => {
        const category = d[categoryFieldName];
        if (colorsInput.field && colorsInput.field[category]) {
            fillStyle.categoryColors[category] = colorsInput.field[category];
        } else {
            fillStyle.categoryColors[category] = defaultCategoricalColors[i % defaultCategoricalColors.length];
        }
    });
    
    const primaryColor = (colorsInput.other && colorsInput.other.primary) || defaultCategoricalColors[0];


    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.position = 'absolute';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document append/remove is not strictly necessary for getBBox if styles are applied directly,
        // but some browsers might be more consistent if it's briefly in a document context.
        // However, for strict adherence to "MUST NOT be appended to the document DOM", we avoid it.
        // For getBBox to work without DOM attachment, SVG needs to be in a proper namespace and constructed carefully.
        // A more robust way without appending to DOM:
        document.body.appendChild(tempSvg); // Briefly append to calculate
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    }
    
    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI prefix
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format(",")(value); // Default to comma-separated for smaller numbers
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(chartConfig.width) || 800;
    const containerHeight = parseFloat(chartConfig.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "waffle-chart-svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");


    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendSquareSize = 15;
    const legendRowHeight = legendSquareSize * 2.5; // Adjusted for potentially two lines of text
    const legendItemSpacingHorizontal = 15;
    const legendItemPaddingRight = 5; // Space after text before next item starts

    const legendItemMinWidths = chartDataArray.map(d => {
        const category = d[categoryFieldName];
        const value = parseFloat(d[valueFieldName]);
        const categoryWidth = estimateTextWidth(category, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        const valueText = `${formatValue(value)} ${valueUnit}`.trim();
        const valueWidth = estimateTextWidth(valueText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelBoldFontWeight);
        return legendSquareSize + 6 + Math.max(categoryWidth, valueWidth) + legendItemPaddingRight;
    });

    const chartMargins = {
        top: 20, // Initial top margin for legend
        right: 30,
        bottom: 30,
        left: 30
    };
    
    const availableLegendWidth = containerWidth - chartMargins.left - chartMargins.right;
    let legendCurrentX = 0;
    let legendRowCount = 1;
    legendItemMinWidths.forEach(itemWidth => {
        if (legendCurrentX + itemWidth > availableLegendWidth && legendCurrentX > 0) { // legendCurrentX > 0 ensures first item always fits if possible
            legendRowCount++;
            legendCurrentX = 0;
        }
        legendCurrentX += itemWidth + legendItemSpacingHorizontal;
    });
    
    const calculatedLegendHeight = legendRowCount * legendRowHeight;
    chartMargins.top += calculatedLegendHeight + (legendRowCount > 0 ? 10 : 0); // Add space below legend

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const totalValue = chartDataArray.reduce((sum, d) => sum + (parseFloat(d[valueFieldName]) || 0), 0);

    if (totalValue <= 0) {
         console.warn("Total value is zero or negative. Waffle chart will be empty.");
         d3.select(containerSelector).html("<div style='color:orange; text-align:center; padding:20px;'>Total data value is zero or less. Nothing to display.</div>");
         return null;
    }

    let valuePerSquare = 1;
    let totalSquares = Math.ceil(totalValue); // Default to 1 square per unit value

    if (totalValue > 800) { // Aim for around 800 squares if total value is large
        valuePerSquare = Math.ceil(totalValue / 800);
        totalSquares = Math.ceil(totalValue / valuePerSquare);
    } else if (totalValue < 100 && totalValue > 0) { // Aim for around 100 squares if total value is small but positive
        valuePerSquare = totalValue / 100; // valuePerSquare can be < 1
        totalSquares = 100;
    } else if (totalValue > 0) { // For values between 100 and 800, use 1 square per unit if possible, or adjust
        totalSquares = Math.ceil(totalValue / valuePerSquare);
    }
    totalSquares = Math.max(1, totalSquares); // Ensure at least one square if totalValue > 0


    const canvasRatio = innerWidth / innerHeight;
    const sqrtSquares = Math.sqrt(totalSquares);
    let numCols = Math.round(sqrtSquares * Math.sqrt(canvasRatio));
    let numRows = Math.round(sqrtSquares / Math.sqrt(canvasRatio));

    numCols = Math.max(1, numCols);
    numRows = Math.max(1, numRows);

    while (numRows * numCols < totalSquares) {
        if ((numCols + 1) / numRows < numRows / numCols * canvasRatio * 1.2) { // Try to maintain aspect ratio
             numCols++;
        } else {
             numRows++;
        }
    }
     // Ensure numRows * numCols is not excessively larger than totalSquares
    if (numRows * numCols > totalSquares * 1.5 && totalSquares > 10) { // Heuristic to reduce oversized grid
        if (numCols > numRows && numCols > 1) numCols--;
        else if (numRows > 1) numRows--;
    }


    const maxSquareCellWidth = innerWidth / numCols;
    const maxSquareCellHeight = innerHeight / numRows;
    const squareCellSize = Math.min(maxSquareCellWidth, maxSquareCellHeight);

    const squareSpacing = Math.max(1, squareCellSize * 0.15); // Ensure spacing is at least 1px
    const squareSize = Math.max(1, squareCellSize - squareSpacing); // Ensure square size is at least 1px

    const actualChartWidth = numCols * squareCellSize - squareSpacing; // Total width occupied by squares and their internal spacing
    const actualChartHeight = numRows * squareCellSize - squareSpacing; // Total height

    const chartOffsetX = (innerWidth - actualChartWidth) / 2;
    const chartOffsetY = (innerHeight - actualChartHeight) / 2;

    const processedCategoryData = [];
    let currentSquareCount = 0;
    chartDataArray.forEach(d => {
        const category = d[categoryFieldName];
        const value = parseFloat(d[valueFieldName]);
        if (value <= 0) return; // Skip categories with no value

        const numSquaresForCategory = Math.round(value / valuePerSquare);
        if (numSquaresForCategory === 0 && value > 0) { // Ensure at least one square for tiny positive values if it's the only way to show them
             // This case is tricky. If valuePerSquare is large, small values might round to 0.
             // For simplicity, we stick to the rounding. If more precision is needed for small items, totalSquares logic might need adjustment.
        }

        processedCategoryData.push({
            category: category,
            value: value,
            numSquares: numSquaresForCategory,
            startSquare: currentSquareCount,
            color: fillStyle.categoryColors[category] || primaryColor
        });
        currentSquareCount += numSquaresForCategory;
    });
    
    // Adjust totalSquares to match sum of numSquaresForCategory due to rounding
    totalSquares = processedCategoryData.reduce((acc, cat) => acc + cat.numSquares, 0);
    if (totalSquares === 0 && chartDataArray.some(d => parseFloat(d[valueFieldName]) > 0)) {
        // This can happen if all values are too small relative to valuePerSquare
        // Give at least one square to the largest small category if totalSquares became 0
        if (processedCategoryData.length > 0) {
            let maxSmallVal = 0;
            let maxSmallCatIdx = -1;
            processedCategoryData.forEach((cat, idx) => {
                if (cat.value > maxSmallVal) {
                    maxSmallVal = cat.value;
                    maxSmallCatIdx = idx;
                }
            });
            if (maxSmallCatIdx !== -1) {
                processedCategoryData[maxSmallCatIdx].numSquares = 1;
                totalSquares = 1;
            }
        }
    }
    if (totalSquares === 0) {
        d3.select(containerSelector).html("<div style='color:orange; text-align:center; padding:20px;'>Calculated squares are zero. Nothing to display.</div>");
        return null;
    }


    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales needed for axes in a waffle chart. Color mapping is handled.

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend-group")
        .attr("transform", `translate(${chartMargins.left}, 20)`); // 20 is top padding for legend

    let currentLegendX = 0;
    let currentLegendY = 0;
    processedCategoryData.forEach((d, i) => {
        const itemWidth = legendItemMinWidths[chartDataArray.findIndex(cd => cd[categoryFieldName] === d.category)]; // Find original index for width
        
        if (currentLegendX + itemWidth > availableLegendWidth && currentLegendX > 0) {
            currentLegendX = 0;
            currentLegendY += legendRowHeight;
        }

        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, ${currentLegendY})`);

        legendItem.append("rect")
            .attr("class", "mark")
            .attr("width", legendSquareSize)
            .attr("height", legendSquareSize)
            .attr("fill", d.color);

        legendItem.append("text")
            .attr("class", "label category-label")
            .attr("x", legendSquareSize + 6)
            .attr("y", legendSquareSize / 2)
            .attr("dy", "0.32em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d.category);

        const valueText = `${formatValue(d.value)} ${valueUnit}`.trim();
        legendItem.append("text")
            .attr("class", "label value-label")
            .attr("x", legendSquareSize + 6)
            .attr("y", legendSquareSize * 1.5) // Position value below category
            .attr("dy", "0.32em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelBoldFontWeight)
            .style("fill", fillStyle.textColor)
            .text(valueText);
        
        currentLegendX += itemWidth + legendItemSpacingHorizontal;
    });

    // Block 8: Main Data Visualization Rendering (Waffle Squares)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-group")
        .attr("transform", `translate(${chartMargins.left + chartOffsetX}, ${chartMargins.top + chartOffsetY})`);

    let squareRenderIndex = 0;
    processedCategoryData.forEach(catData => {
        for (let i = 0; i < catData.numSquares; i++) {
            if (squareRenderIndex >= numRows * numCols) break; // Should not happen if totalSquares <= numRows * numCols

            const col = Math.floor(squareRenderIndex / numRows);
            const row = squareRenderIndex % numRows;

            mainChartGroup.append("rect")
                .attr("class", "mark waffle-square")
                .attr("x", col * squareCellSize)
                .attr("y", row * squareCellSize)
                .attr("width", squareSize)
                .attr("height", squareSize)
                .attr("fill", catData.color)
                .attr("stroke", fillStyle.defaultSquareStroke)
                .attr("stroke-width", 0.5);
            
            squareRenderIndex++;
        }
    });
    
    if (squareRenderIndex === 0 && totalValue > 0) {
        // Fallback if no squares were rendered despite positive total value (e.g. all categories rounded to 0 squares)
        mainChartGroup.append("text")
            .attr("class", "label error-label")
            .attr("x", actualChartWidth / 2)
            .attr("y", actualChartHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", "14px")
            .style("fill", fillStyle.textColor)
            .text("Data values too small to represent as squares with current settings.");
    }


    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects like shadows or gradients are applied. Standardized styling is used.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}