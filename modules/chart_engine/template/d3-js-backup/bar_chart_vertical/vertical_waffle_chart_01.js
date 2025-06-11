/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Waffle Chart",
  "chart_name": "vertical_waffle_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[1, 20], [0, "inf"]],
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // Could be data.colors_dark if a theme mechanism was in place
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

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
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    // Filter out data points with missing critical fields or non-numeric y-values
    const chartDataArray = chartDataInput.filter(d =>
        d[categoryFieldName] != null &&
        d[valueFieldName] != null &&
        !isNaN(parseFloat(d[valueFieldName]))
    ).map(d => ({
        ...d,
        [valueFieldName]: parseFloat(d[valueFieldName])
    }));


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: rawTypography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: rawTypography.title?.font_size || '16px',
            titleFontWeight: rawTypography.title?.font_weight || 'bold',
            labelFontFamily: rawTypography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: rawTypography.label?.font_size || '12px',
            labelFontWeight: rawTypography.label?.font_weight || 'normal',
            annotationFontFamily: rawTypography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: rawTypography.annotation?.font_size || '10px',
            annotationFontWeight: rawTypography.annotation?.font_weight || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF',
        defaultSquareColor: rawColors.other?.primary || '#4682B4',
        categoryColorStore: {} // To store assigned colors for consistency
    };

    const defaultCategoricalColors = rawColors.available_colors || d3.schemeCategory10;
    let colorIndex = 0;

    function getCategoryColor(category) {
        if (fillStyle.categoryColorStore[category]) {
            return fillStyle.categoryColorStore[category];
        }
        let color;
        if (rawColors.field && rawColors.field[category]) {
            color = rawColors.field[category];
        } else {
            color = defaultCategoricalColors[colorIndex % defaultCategoricalColors.length];
            colorIndex++;
        }
        fillStyle.categoryColorStore[category] = color;
        return color;
    }
    
    function estimateTextWidth(text, styleProps) {
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', styleProps.font_family || fillStyle.typography.labelFontFamily);
        textNode.setAttribute('font-size', styleProps.font_size || fillStyle.typography.labelFontSize);
        textNode.setAttribute('font-weight', styleProps.font_weight || fillStyle.typography.labelFontWeight);
        textNode.textContent = text;
        
        // For getBBox to work, the element needs to be in the DOM or an SVG context.
        // Create a temporary, detached SVG for measurement.
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvgNode.appendChild(textNode);
        // No need to append tempSvgNode to document body
        const width = textNode.getBBox().width;
        return width;
    }

    const formatValue = (value) => {
        if (value == null || isNaN(value)) return "N/A";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More robust large number formatting
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format(",.0f")(value); // Default for smaller numbers, includes comma
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root");

    const chartMargins = { top: 20, right: 30, bottom: 20, left: 30 };
    const legendToWafflePadding = 15;


    // Block 4: Core Chart Dimensions & Layout Calculation (Legend part 1)
    const legendSquareSize = 15;
    const legendRowHeight = legendSquareSize * 2.5; // Category + Value text lines
    const legendItemHorizontalPadding = 8;
    const legendItemVerticalPadding = 5; // Space between legend square and text lines

    const legendItemMinWidths = chartDataArray.map(d => {
        const categoryText = d[categoryFieldName];
        const valueText = `${formatValue(d[valueFieldName])} ${valueFieldUnit}`.trim();
        
        const categoryWidth = estimateTextWidth(categoryText, {
            font_family: fillStyle.typography.labelFontFamily,
            font_size: fillStyle.typography.labelFontSize,
            font_weight: fillStyle.typography.labelFontWeight
        });
        const valueWidth = estimateTextWidth(valueText, {
            font_family: fillStyle.typography.labelFontFamily,
            font_size: fillStyle.typography.labelFontSize,
            font_weight: 'bold' // Value text is often bolded in legends
        });
        return legendSquareSize + legendItemHorizontalPadding + Math.max(categoryWidth, valueWidth) + legendItemHorizontalPadding;
    });

    let legendCurrentX = 0;
    let legendRowCount = 1;
    const legendAvailableWidth = containerWidth - chartMargins.left - chartMargins.right;
    const legendItemSpacing = 15;

    legendItemMinWidths.forEach(itemWidth => {
        if (legendCurrentX + itemWidth > legendAvailableWidth && legendCurrentX > 0) {
            legendRowCount++;
            legendCurrentX = 0;
        }
        legendCurrentX += itemWidth + legendItemSpacing;
    });
    const actualLegendHeight = legendRowCount * legendRowHeight + (legendRowCount > 0 ? chartMargins.top : 0);


    // Waffle area calculations
    const waffleAreaTop = (legendRowCount > 0 ? actualLegendHeight : chartMargins.top) + (legendRowCount > 0 ? legendToWafflePadding : 0);
    const waffleAreaLeft = chartMargins.left;
    const waffleAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const waffleAreaHeight = containerHeight - waffleAreaTop - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const totalValue = chartDataArray.reduce((sum, d) => sum + (d[valueFieldName] || 0), 0);
    
    let valuePerSquare = 1;
    let totalSquares = Math.ceil(totalValue / valuePerSquare);

    if (totalValue > 0) {
        if (totalValue > 1000) {
            valuePerSquare = Math.ceil(totalValue / 800); // Target ~800 squares
            totalSquares = Math.ceil(totalValue / valuePerSquare);
        } else if (totalValue < 300) {
            valuePerSquare = totalValue / 300; // Target 300 squares
            totalSquares = 300;
        }
    } else {
        totalSquares = 0;
    }
    if (totalValue > 0 && valuePerSquare <= 0) valuePerSquare = Number.MIN_VALUE; // Avoid division by zero if totalValue is tiny

    const categorySquaresData = [];
    let cumulativeSquares = 0;
    if (totalValue > 0) {
        chartDataArray.forEach(d => {
            const category = d[categoryFieldName];
            const value = d[valueFieldName];
            const numSquaresForCategory = Math.round(value / valuePerSquare);
            
            categorySquaresData.push({
                category: category,
                value: value,
                squares: numSquaresForCategory,
                startSquare: cumulativeSquares,
                color: getCategoryColor(category)
            });
            cumulativeSquares += numSquaresForCategory;
        });
    }
    // Adjust totalSquares to match sum of rounded squares for categories if different
    totalSquares = cumulativeSquares;


    // Block 6: Scale Definition & Configuration (Waffle Grid Layout)
    let numCols = 1, numRows = 1;
    let squareSizeWithPadding = 10; // Default if no squares
    let squareRenderSize = 8;
    let squareRenderSpacing = 2;

    if (totalSquares > 0 && waffleAreaWidth > 0 && waffleAreaHeight > 0) {
        const canvasRatio = waffleAreaWidth / waffleAreaHeight;
        const sqrtSquares = Math.sqrt(totalSquares);
        numCols = Math.round(sqrtSquares * Math.sqrt(canvasRatio));
        numRows = Math.round(sqrtSquares / Math.sqrt(canvasRatio));

        // Ensure numCols and numRows are at least 1
        numCols = Math.max(1, numCols);
        numRows = Math.max(1, numRows);

        while (numRows * numCols < totalSquares) {
            if ((numCols + 1) / numRows < numRows / (numCols + 1) * canvasRatio) { // Heuristic to decide whether to increment row or col
                 numCols++;
            } else {
                numRows++;
            }
        }
        // Recalculate to ensure product is at least totalSquares
        if (numRows * numCols < totalSquares) { // If still less, increment the one that makes aspect ratio closer
             if (waffleAreaWidth / numCols > waffleAreaHeight / numRows) numCols = Math.ceil(totalSquares / numRows);
             else numRows = Math.ceil(totalSquares / numCols);
        }
        numCols = Math.max(1, numCols);
        numRows = Math.max(1, numRows);


        const maxSquareWidth = waffleAreaWidth / numCols;
        const maxSquareHeight = waffleAreaHeight / numRows;
        squareSizeWithPadding = Math.min(maxSquareWidth, maxSquareHeight);
        
        squareRenderSize = squareSizeWithPadding * 0.85;
        squareRenderSpacing = squareSizeWithPadding * 0.15;
    }

    const actualWaffleGridWidth = numCols * squareSizeWithPadding;
    const actualWaffleGridHeight = numRows * squareSizeWithPadding;

    const waffleOffsetX = (waffleAreaWidth - actualWaffleGridWidth) / 2;
    const waffleOffsetY = (waffleAreaHeight - actualWaffleGridHeight) / 2;


    // Block 7: Chart Component Rendering (Legend part 2)
    if (legendRowCount > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

        let currentX = 0;
        let currentRow = 0;

        chartDataArray.forEach((d, i) => {
            const itemWidth = legendItemMinWidths[i];
            if (currentX + itemWidth > legendAvailableWidth && currentX > 0) {
                currentRow++;
                currentX = 0;
            }

            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${currentRow * legendRowHeight})`);

            legendItem.append("rect")
                .attr("class", "mark legend-mark")
                .attr("width", legendSquareSize)
                .attr("height", legendSquareSize)
                .attr("fill", getCategoryColor(d[categoryFieldName]));

            legendItem.append("text")
                .attr("class", "label legend-category-label")
                .attr("x", legendSquareSize + legendItemHorizontalPadding)
                .attr("y", legendSquareSize / 2 - legendItemVerticalPadding / 2) // Position for first line
                .attr("dy", "0.32em")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(d[categoryFieldName]);
            
            legendItem.append("text")
                .attr("class", "label legend-value-label")
                .attr("x", legendSquareSize + legendItemHorizontalPadding)
                .attr("y", legendSquareSize * 1.5 - legendItemVerticalPadding / 2) // Position for second line
                .attr("dy", "0.32em")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", "bold")
                .style("fill", fillStyle.textColor)
                .text(`${formatValue(d[valueFieldName])} ${valueFieldUnit}`.trim());

            currentX += itemWidth + legendItemSpacing;
        });
    }

    // Block 8: Main Data Visualization Rendering (Waffle Squares)
    if (totalSquares > 0) {
        const waffleChartGroup = svgRoot.append("g")
            .attr("class", "waffle-chart")
            .attr("transform", `translate(${waffleAreaLeft + waffleOffsetX}, ${waffleAreaTop + waffleOffsetY})`);

        let currentSquareIndex = 0;
        categorySquaresData.forEach(catData => {
            for (let i = 0; i < catData.squares; i++) {
                if (currentSquareIndex >= numRows * numCols) break; // Safety break

                const col = Math.floor(currentSquareIndex / numRows);
                const row = currentSquareIndex % numRows;

                waffleChartGroup.append("rect")
                    .attr("class", "mark waffle-square")
                    .attr("x", col * squareSizeWithPadding + squareRenderSpacing / 2)
                    .attr("y", row * squareSizeWithPadding + squareRenderSpacing / 2)
                    .attr("width", squareRenderSize)
                    .attr("height", squareRenderSize)
                    .attr("fill", catData.color)
                    .attr("data-category", catData.category); // For potential interactivity

                currentSquareIndex++;
            }
        });
    }


    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable for this simplified chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}