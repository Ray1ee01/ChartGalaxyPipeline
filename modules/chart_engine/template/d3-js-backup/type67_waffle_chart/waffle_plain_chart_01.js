/* REQUIREMENTS_BEGIN
{
  "chart_type": "Waffle Chart",
  "chart_name": "waffle_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = categoryColumn ? categoryColumn.name : undefined;
    const valueFieldName = valueColumn ? valueColumn.name : undefined;
    const valueFieldUnit = valueColumn && valueColumn.unit !== "none" ? (valueColumn.unit || "") : "";

    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: Category (x) or Value (y) field name not found in dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: Critical chart configuration missing. Category or Value field not defined.</div>");
        }
        return null;
    }

    if (!Array.isArray(chartDataInput) || chartDataInput.length === 0) {
        console.error("Chart data is empty or not an array. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: Chart data is empty or invalid.</div>");
        }
        return null;
    }
    
    // Filter out data points with missing or invalid critical fields
    const chartDataArray = chartDataInput.filter(d => 
        d[categoryFieldName] !== undefined && d[categoryFieldName] !== null &&
        d[valueFieldName] !== undefined && d[valueFieldName] !== null && !isNaN(parseFloat(d[valueFieldName])) && parseFloat(d[valueFieldName]) >= 0
    );

    if (chartDataArray.length === 0) {
        console.error("No valid data points remaining after filtering. Cannot render.");
         if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: No valid data to display.</div>");
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            label: {
                font_family: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
                font_size: (typography.label && typography.label.font_size) || '12px',
                font_weight: (typography.label && typography.label.font_weight) || 'normal',
            },
            annotation: { // Though not used explicitly, define for completeness
                font_family: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
                font_size: (typography.annotation && typography.annotation.font_size) || '10px',
                font_weight: (typography.annotation && typography.annotation.font_weight) || 'normal',
            }
        },
        textColor: colors.text_color || '#333333',
        chartBackground: colors.background_color || '#FFFFFF', // For reference, not used to fill SVG bg
    };

    const defaultCategoricalColors = d3.schemeCategory10;
    const categoryColorMap = {};
    let colorAssignIndex = 0;

    function assignAndGetCategoryColor(category) {
        if (colors.field && colors.field[category]) {
            return colors.field[category];
        }
        if (categoryColorMap[category]) {
            return categoryColorMap[category];
        }
        const colorSource = (colors.available_colors && colors.available_colors.length > 0) ? colors.available_colors : defaultCategoricalColors;
        const assignedColor = colorSource[colorAssignIndex % colorSource.length];
        categoryColorMap[category] = assignedColor;
        colorAssignIndex++;
        return assignedColor;
    }

    function estimateTextWidth(text, style) {
        const { font_family, font_size, font_weight } = style;
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextNode.setAttribute('font-family', font_family);
        tempTextNode.setAttribute('font-size', font_size);
        tempTextNode.setAttribute('font-weight', font_weight);
        tempTextNode.textContent = text;
        tempSvgNode.appendChild(tempTextNode);
        // getBBox on an unattached element is per spec.
        let width = 0;
         try {
            width = tempTextNode.getBBox().width;
        } catch (e) {
            const avgCharWidth = parseFloat(font_size) * 0.6; // Fallback
            width = text.length * avgCharWidth;
            console.warn("SVG getBBox failed for text measurement, using approximate width.", e);
        }
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for Billion
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value); // For smaller numbers, avoid trailing zeros if possible
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root");
    
    // Set background color for the SVG if specified and different from white
    // This is an interpretation: if background_color is provided, use it for the SVG itself.
    if (fillStyle.chartBackground && fillStyle.chartBackground.toLowerCase() !== '#ffffff') {
        svgRoot.style("background-color", fillStyle.chartBackground);
    }


    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 30, bottom: 30, left: 30 };
    const legendSquareSize = 15;
    const legendRowHeight = legendSquareSize * 2.5; // Adjusted for tighter packing
    const legendItemSpacing = 10;
    const legendTextOffsetY = legendSquareSize / 2; 
    const legendValueOffsetY = legendSquareSize * 1.5;


    const legendItemMinWidths = chartDataArray.map(d => {
        const category = d[categoryFieldName];
        const value = +d[valueFieldName];
        const textStyle = fillStyle.typography.label;
        const categoryWidth = estimateTextWidth(category, textStyle);
        const valueText = `${formatValue(value)}${valueFieldUnit ? ' ' + valueFieldUnit : ''}`;
        const valueWidth = estimateTextWidth(valueText, { ...textStyle, font_weight: 'bold' });
        return legendSquareSize + 6 + Math.max(categoryWidth, valueWidth) + 5; // square + padding + max_text + padding
    });

    const availableLegendWidth = containerWidth - chartMargins.left - chartMargins.right;
    let legendCurrentWidth = 0;
    let legendRowCount = 1;
    for (let i = 0; i < legendItemMinWidths.length; i++) {
        if (legendCurrentWidth + legendItemMinWidths[i] + (legendCurrentWidth > 0 ? legendItemSpacing : 0) <= availableLegendWidth) {
            legendCurrentWidth += legendItemMinWidths[i] + (legendCurrentWidth > 0 ? legendItemSpacing : 0);
        } else {
            legendRowCount++;
            legendCurrentWidth = legendItemMinWidths[i];
        }
    }
    const actualLegendHeight = legendRowCount * legendRowHeight + (legendRowCount > 0 ? chartMargins.top : 0); // Add top margin only if legend exists

    const waffleChartAreaTop = chartMargins.top + (chartDataArray.length > 0 ? actualLegendHeight : 0); // Legend height if data exists
    const waffleChartAreaLeft = chartMargins.left;
    
    const waffleInnerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const waffleInnerHeight = containerHeight - waffleChartAreaTop - chartMargins.bottom;

    if (waffleInnerHeight <= 0 || waffleInnerWidth <= 0) {
        console.error("Not enough space to render the waffle chart after accounting for legend and margins.");
         if (containerSelector) {
            d3.select(containerSelector).append("div").style("color","red").style("font-family","sans-serif")
              .text("Error: Not enough space for the chart. Increase dimensions or reduce content.");
        }
        return null; // Or svgRoot.node() if a partial render is acceptable
    }

    // Block 5: Data Preprocessing & Transformation
    const totalValue = chartDataArray.reduce((sum, d) => sum + (+d[valueFieldName] || 0), 0);

    let valuePerSquare = 1;
    let totalSquares = 0;

    if (totalValue > 0) {
        totalSquares = totalValue; // Default: 1 square = 1 unit of value
        if (totalValue > 1000) { // Aim for around 800 squares if total value is large
            valuePerSquare = Math.ceil(totalValue / 800);
            totalSquares = Math.ceil(totalValue / valuePerSquare);
        } else if (totalValue < 300) { // Aim for around 300 squares if total value is small
            valuePerSquare = totalValue / 300;
            totalSquares = 300;
        }
    } else { // totalValue is 0 or less (filtered to be >=0, so effectively 0)
        valuePerSquare = 1;
        totalSquares = 0;
    }
    totalSquares = Math.max(0, Math.round(totalSquares)); // Ensure non-negative integer

    const categorySquaresData = [];
    let cumulativeSquareCount = 0;
    chartDataArray.forEach(d => {
        const category = d[categoryFieldName];
        const value = +d[valueFieldName];
        const numSquares = totalValue > 0 ? Math.round(value / valuePerSquare) : 0;
        
        categorySquaresData.push({
            category: category,
            value: value,
            squares: numSquares,
            startSquare: cumulativeSquareCount,
            color: assignAndGetCategoryColor(category)
        });
        cumulativeSquareCount += numSquares;
    });
    
    // Adjust totalSquares to match sum of rounded squares for categories
    totalSquares = cumulativeSquareCount;


    let numCols = 0;
    let numRows = 0;
    let squareSizeWithSpacing = 0;
    let squareRenderSize = 0;
    let squareSpacing = 0;
    let waffleGridWidth = 0;
    let waffleGridHeight = 0;
    let waffleOffsetX = 0;
    let waffleOffsetY = 0;

    if (totalSquares > 0) {
        const canvasRatio = waffleInnerWidth / waffleInnerHeight;
        const sqrtSquares = Math.sqrt(totalSquares);
        numRows = Math.round(sqrtSquares / Math.sqrt(canvasRatio));
        numCols = Math.round(sqrtSquares * Math.sqrt(canvasRatio));

        if (numRows === 0) numRows = 1; // Ensure at least one row if there are squares
        if (numCols === 0) numCols = 1; // Ensure at least one col

        while (numRows * numCols < totalSquares) {
            if ((numCols + 1) / numRows < numRows / numCols * canvasRatio * canvasRatio) { // Heuristic to expand closer to canvas ratio
                 numCols++;
            } else {
                numRows++;
            }
        }
        
        const maxSquareWidth = waffleInnerWidth / numCols;
        const maxSquareHeight = waffleInnerHeight / numRows;
        squareSizeWithSpacing = Math.min(maxSquareWidth, maxSquareHeight);
        
        squareRenderSize = squareSizeWithSpacing * 0.85;
        squareSpacing = squareSizeWithSpacing * 0.15;

        waffleGridWidth = numCols * squareSizeWithSpacing;
        waffleGridHeight = numRows * squareSizeWithSpacing;

        waffleOffsetX = (waffleInnerWidth - waffleGridWidth) / 2;
        waffleOffsetY = (waffleInnerHeight - waffleGridHeight) / 2;
    }


    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales for waffle grid positioning. Color mapping is handled by assignAndGetCategoryColor.

    // Block 7: Chart Component Rendering (Legend)
    if (chartDataArray.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

        let currentX = 0;
        let currentRow = 0;
        chartDataArray.forEach((d, i) => {
            const category = d[categoryFieldName];
            const value = +d[valueFieldName];
            const itemWidth = legendItemMinWidths[i];
            const itemColor = categorySquaresData.find(cs => cs.category === category).color;

            if (currentX + itemWidth > availableLegendWidth && currentX > 0) {
                currentRow++;
                currentX = 0;
            }

            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${currentRow * legendRowHeight})`);

            legendItem.append("rect")
                .attr("class", "mark")
                .attr("width", legendSquareSize)
                .attr("height", legendSquareSize)
                .attr("fill", itemColor);

            legendItem.append("text")
                .attr("class", "label category-label")
                .attr("x", legendSquareSize + 6)
                .attr("y", legendTextOffsetY)
                .attr("dy", "0.32em")
                .style("font-family", fillStyle.typography.label.font_family)
                .style("font-size", fillStyle.typography.label.font_size)
                .style("font-weight", fillStyle.typography.label.font_weight)
                .style("fill", fillStyle.textColor)
                .text(category);

            legendItem.append("text")
                .attr("class", "label value-label")
                .attr("x", legendSquareSize + 6)
                .attr("y", legendValueOffsetY)
                .attr("dy", "0.32em")
                .style("font-family", fillStyle.typography.label.font_family)
                .style("font-size", fillStyle.typography.label.font_size)
                .style("font-weight", "bold") // Value is typically bold
                .style("fill", fillStyle.textColor)
                .text(`${formatValue(value)}${valueFieldUnit ? ' ' + valueFieldUnit : ''}`);
            
            currentX += itemWidth + legendItemSpacing;
        });
    }

    // Block 8: Main Data Visualization Rendering (Waffle Squares)
    if (totalSquares > 0) {
        const waffleGroup = svgRoot.append("g")
            .attr("class", "waffle-grid")
            .attr("transform", `translate(${waffleChartAreaLeft + waffleOffsetX}, ${waffleChartAreaTop + waffleOffsetY})`);

        let currentSquareIndex = 0;
        categorySquaresData.forEach(catData => {
            for (let i = 0; i < catData.squares; i++) {
                if (currentSquareIndex >= numRows * numCols) break; // Safety break

                const r = Math.floor(currentSquareIndex / numCols);
                const c = currentSquareIndex % numCols;

                waffleGroup.append("rect")
                    .attr("class", "mark waffle-square")
                    .attr("x", c * squareSizeWithSpacing + squareSpacing / 2)
                    .attr("y", r * squareSizeWithSpacing + squareSpacing / 2)
                    .attr("width", squareRenderSize)
                    .attr("height", squareRenderSize)
                    .attr("fill", catData.color)
                    .attr("data-category", catData.category); // For potential interaction

                currentSquareIndex++;
            }
        });
    } else if (chartDataArray.length > 0) { // Data exists but total value is zero
         svgRoot.append("text")
            .attr("class", "label no-data-message")
            .attr("x", containerWidth / 2)
            .attr("y", waffleChartAreaTop + waffleInnerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", fillStyle.typography.label.font_size)
            .style("fill", fillStyle.textColor)
            .text("Total value is zero, no squares to display.");
    }


    // Block 9: Optional Enhancements & Post-Processing
    // No enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}