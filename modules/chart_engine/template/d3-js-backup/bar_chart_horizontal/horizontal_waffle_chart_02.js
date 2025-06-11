/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Waffle Chart",
  "chart_name": "horizontal_waffle_chart_02",
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
    // This function renders a Horizontal Waffle Chart.
    // It displays data as a grid of squares, where each square (or a fraction of it)
    // represents a certain value, and categories are distinguished by color.
    // A legend is provided to map colors to categories and their total values.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const config = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors_dark || {}; // Using colors_dark as per original, can be data.colors
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldColumn = dataColumns.find(col => col.role === "x");
    const yFieldColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xFieldColumn?.name;
    const valueFieldName = yFieldColumn?.name;
    const valueFieldUnit = yFieldColumn?.unit === "none" ? "" : (yFieldColumn?.unit || "");

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; font-size: 14px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            // title and annotation not used directly by this chart's main elements, but defined for completeness
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) || '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || 'bold',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
        },
        textColor: rawColors.text_color || '#0f223b',
        backgroundColor: rawColors.background_color || '#FFFFFF', // Or a dark default if colors_dark implies it
        primaryColor: (rawColors.other && rawColors.other.primary) || '#1f77b4',
        defaultCategoryColors: rawColors.available_colors || d3.schemeCategory10,
        getColor: (category, index) => {
            if (rawColors.field && rawColors.field[category]) {
                return rawColors.field[category];
            }
            return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
        }
    };

    const estimateTextWidth = (text, fontProps) => {
        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textNode.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textNode.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textNode.textContent = text;
        svgNode.appendChild(textNode);
        // Note: Appending to body and then removing is more reliable for getBBox, but trying without first.
        // If issues, uncomment below:
        // document.body.appendChild(svgNode);
        const width = textNode.getBBox().width;
        // if (svgNode.parentNode === document.body) document.body.removeChild(svgNode);
        return width;
    };

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for billion
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value); // Keep general for smaller numbers
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 30, bottom: 40, left: 30 };
    const legendSquareSize = 15;
    const legendRowHeight = legendSquareSize * 2.5; // Adjusted for tighter packing
    const legendItemSpacing = 15; // Horizontal spacing between legend items
    const legendPaddingBottom = 20; // Space between legend and waffle chart

    const legendAvailableWidth = containerWidth - chartMargins.left - chartMargins.right;
    
    const legendItemMinWidths = chartData.map(d => {
        const category = d[categoryFieldName];
        const value = d[valueFieldName];
        const categoryTextWidth = estimateTextWidth(category, { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight 
        });
        const valueText = `${formatValue(value)} ${valueFieldUnit}`;
        const valueTextWidth = estimateTextWidth(valueText, { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: 'bold' // Value text is often bold in legends
        });
        return legendSquareSize + 6 + Math.max(categoryTextWidth, valueTextWidth) + 5; // square + padding + text + padding
    });

    let legendCurrentX = 0;
    let legendRowCount = 1;
    for (let i = 0; i < legendItemMinWidths.length; i++) {
        if (legendCurrentX + legendItemMinWidths[i] <= legendAvailableWidth) {
            legendCurrentX += legendItemMinWidths[i] + legendItemSpacing;
        } else {
            legendRowCount++;
            legendCurrentX = legendItemMinWidths[i] + legendItemSpacing;
        }
    }
    const actualLegendHeight = legendRowCount * legendRowHeight;

    const waffleAreaX = chartMargins.left;
    const waffleAreaY = chartMargins.top + actualLegendHeight + legendPaddingBottom;
    const waffleAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const waffleAreaHeight = containerHeight - waffleAreaY - chartMargins.bottom;

    // Waffle grid calculations
    const totalValue = chartData.reduce((sum, d) => sum + (+d[valueFieldName] || 0), 0);
    let valuePerSquare = 1;
    let totalSquares = Math.max(1, Math.round(totalValue)); // Ensure at least 1 square if totalValue > 0

    if (totalValue === 0) { // Handle empty or zero-total data
        totalSquares = 0; // Or a small number like 100 if you want to show an empty grid
    } else if (totalValue > 1000) {
        valuePerSquare = totalValue / 800; // Target 800 squares
        totalSquares = Math.ceil(totalValue / valuePerSquare);
    } else if (totalValue < 300 && totalValue > 0) {
        valuePerSquare = totalValue / 300; // Target 300 squares
        totalSquares = 300;
    }
    totalSquares = Math.max(1, totalSquares); // Ensure at least one square if there's data

    const canvasRatio = waffleAreaWidth > 0 && waffleAreaHeight > 0 ? waffleAreaWidth / waffleAreaHeight : 1;
    const sqrtSquares = Math.sqrt(totalSquares);
    
    let numCols = Math.round(sqrtSquares * Math.sqrt(canvasRatio));
    let numRows = Math.round(sqrtSquares / Math.sqrt(canvasRatio));

    numCols = Math.max(1, numCols); // Ensure at least 1 column
    numRows = Math.max(1, numRows); // Ensure at least 1 row

    while (numRows * numCols < totalSquares) {
        if ((numCols + 1) / numRows < numRows / (numCols + 1) * canvasRatio) { // Heuristic to improve aspect ratio fit
             numCols++;
        } else {
             numRows++;
        }
    }
    // Final check to ensure rows/cols are not zero if totalSquares > 0
    if (totalSquares > 0) {
        if (numCols === 0) numCols = 1;
        if (numRows === 0) numRows = Math.ceil(totalSquares / numCols);
        if (numRows === 0) numRows = 1; // Should not happen if numCols is also 1
    } else {
        numCols = 10; // Default grid for empty state
        numRows = 5;
    }


    const waffleCellWidth = waffleAreaWidth / numCols;
    const waffleCellHeight = waffleAreaHeight / numRows;
    const waffleCellSize = Math.min(waffleCellWidth, waffleCellHeight);

    const squareSize = waffleCellSize * 0.85;
    const squareSpacing = waffleCellSize * 0.15; // This is the gap around the square, effectively part of cell

    const actualWaffleGridWidth = numCols * waffleCellSize;
    const actualWaffleGridHeight = numRows * waffleCellSize;

    const waffleGridCenteringOffsetX = (waffleAreaWidth - actualWaffleGridWidth) / 2;
    const waffleGridCenteringOffsetY = (waffleAreaHeight - actualWaffleGridHeight) / 2;

    // Block 5: Data Preprocessing & Transformation
    const categorySquaresData = [];
    let cumulativeSquareCount = 0;
    chartData.forEach((d, i) => {
        const category = d[categoryFieldName];
        const value = +d[valueFieldName] || 0;
        const numSquaresForCategory = totalValue > 0 ? Math.round(value / valuePerSquare) : 0;
        
        categorySquaresData.push({
            category: category,
            value: value,
            squares: numSquaresForCategory,
            startSquare: cumulativeSquareCount,
            color: fillStyle.getColor(category, i)
        });
        cumulativeSquareCount += numSquaresForCategory;
    });
    
    // Adjust square counts if rounding caused total to mismatch totalSquares
    const calculatedTotalSquares = categorySquaresData.reduce((sum, cat) => sum + cat.squares, 0);
    if (calculatedTotalSquares !== totalSquares && totalSquares > 0 && calculatedTotalSquares > 0) {
        // Basic proportional adjustment (can be more sophisticated)
        const adjustmentFactor = totalSquares / calculatedTotalSquares;
        cumulativeSquareCount = 0;
        categorySquaresData.forEach(cat => {
            cat.squares = Math.round(cat.squares * adjustmentFactor);
            cat.startSquare = cumulativeSquareCount; // Recalculate startSquare
            cumulativeSquareCount += cat.squares;
        });
        // Ensure the very last category fills up to totalSquares due to rounding
        if (categorySquaresData.length > 0) {
             const finalDiff = totalSquares - cumulativeSquareCount;
             categorySquaresData[categorySquaresData.length-1].squares += finalDiff;
        }
    }


    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales are used for axes in a waffle chart.
    // Layout is determined by calculations in Block 4.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    legendCurrentX = 0;
    let currentLegendRow = 0;
    chartData.forEach((d, i) => {
        const category = d[categoryFieldName];
        const value = d[valueFieldName];
        const itemWidth = legendItemMinWidths[i];

        if (legendCurrentX + itemWidth > legendAvailableWidth && legendCurrentX > 0) { // legendCurrentX > 0 ensures first item isn't wrapped
            currentLegendRow++;
            legendCurrentX = 0;
        }

        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${legendCurrentX}, ${currentLegendRow * legendRowHeight})`);

        legendItem.append("rect")
            .attr("class", "mark")
            .attr("width", legendSquareSize)
            .attr("height", legendSquareSize)
            .attr("fill", fillStyle.getColor(category, i))
            .attr("rx", 0) // No rounded corners
            .attr("ry", 0);

        legendItem.append("text")
            .attr("class", "label category-label")
            .attr("x", legendSquareSize + 6)
            .attr("y", legendSquareSize / 2)
            .attr("dy", "0.32em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(category);

        legendItem.append("text")
            .attr("class", "label value-label")
            .attr("x", legendSquareSize + 6)
            .attr("y", legendSquareSize * 1.5) // Position value below category
            .attr("dy", "0.32em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold") // Values often bold
            .style("fill", fillStyle.textColor)
            .text(`${formatValue(value)} ${valueFieldUnit}`);
        
        legendCurrentX += itemWidth + legendItemSpacing;
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const waffleChartGroup = svgRoot.append("g")
        .attr("class", "waffle-grid")
        .attr("transform", `translate(${waffleAreaX + waffleGridCenteringOffsetX}, ${waffleAreaY + waffleGridCenteringOffsetY})`);

    let currentSquareIndex = 0;
    if (totalSquares > 0 && waffleAreaWidth > 0 && waffleAreaHeight > 0) { // Only draw if space and data
        categorySquaresData.forEach(cat => {
            for (let i = 0; i < cat.squares; i++) {
                if (currentSquareIndex >= numRows * numCols) break; // Safety break

                const r = Math.floor(currentSquareIndex / numCols);
                const c = currentSquareIndex % numCols;

                waffleChartGroup.append("rect")
                    .attr("class", "mark waffle-square")
                    .attr("x", c * waffleCellSize + squareSpacing / 2)
                    .attr("y", r * waffleCellSize + squareSpacing / 2)
                    .attr("width", squareSize)
                    .attr("height", squareSize)
                    .attr("fill", cat.color)
                    .attr("stroke", "none") // No stroke
                    .attr("rx", 0) // No rounded corners
                    .attr("ry", 0);
                
                currentSquareIndex++;
            }
        });
    } else if (waffleAreaWidth <=0 || waffleAreaHeight <=0) {
        waffleChartGroup.append("text")
            .attr("class", "label error-label")
            .attr("x", waffleAreaWidth / 2 || 0) // waffleAreaWidth could be negative
            .attr("y", waffleAreaHeight / 2 || 20)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", "10px")
            .style("fill", fillStyle.textColor)
            .text("Not enough space to render chart.");
    }


    // Block 9: Optional Enhancements & Post-Processing
    // No shadows, gradients, or complex patterns as per directives.
    // No rounded corners or strokes for squares.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}