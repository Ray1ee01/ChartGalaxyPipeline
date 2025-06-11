/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Waffle Chart",
  "chart_name": "horizontal_waffle_chart_01",
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
REQUIREMENTS_END
*/
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is now external to the function)
    // This block is intentionally empty as per instructions.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {}; // Though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xColumn ? xColumn.name : (chartDataInput.length > 0 ? Object.keys(chartDataInput[0])[0] : undefined);
    const valueFieldName = yColumn ? yColumn.name : (chartDataInput.length > 0 ? Object.keys(chartDataInput[0])[1] : undefined);
    const valueFieldUnit = yColumn && yColumn.unit !== "none" ? (yColumn.unit || "") : "";

    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: Required field roles 'x' or 'y' not found in data.columns or could not be inferred. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Critical chart config missing: Required field roles 'x' or 'y' not found in data.columns. Cannot render.</div>");
        }
        return null;
    }
    
    if (chartDataInput.length === 0) {
        console.warn("Chart data is empty. Rendering an empty chart area.");
        // Optionally, render a message in the container
        // d3.select(containerSelector).html("<div style='padding:10px;'>No data to display.</div>");
        // return null; // Or proceed to render an empty chart structure
    }


    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colorsConfig.text_color || '#333333',
        backgroundColor: colorsConfig.background_color || '#FFFFFF',
        primaryColor: colorsConfig.other && colorsConfig.other.primary ? colorsConfig.other.primary : '#4682B4',
        defaultCategoryColors: colorsConfig.available_colors || d3.schemeCategory10,
        typography: {
            title: {
                font_family: typographyConfig.title && typographyConfig.title.font_family ? typographyConfig.title.font_family : 'Arial, sans-serif',
                font_size: typographyConfig.title && typographyConfig.title.font_size ? typographyConfig.title.font_size : '16px',
                font_weight: typographyConfig.title && typographyConfig.title.font_weight ? typographyConfig.title.font_weight : 'bold',
            },
            label: {
                font_family: typographyConfig.label && typographyConfig.label.font_family ? typographyConfig.label.font_family : 'Arial, sans-serif',
                font_size: typographyConfig.label && typographyConfig.label.font_size ? typographyConfig.label.font_size : '12px',
                font_weight: typographyConfig.label && typographyConfig.label.font_weight ? typographyConfig.label.font_weight : 'normal',
            },
            annotation: { // Though not used, define for completeness
                font_family: typographyConfig.annotation && typographyConfig.annotation.font_family ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
                font_size: typographyConfig.annotation && typographyConfig.annotation.font_size ? typographyConfig.annotation.font_size : '10px',
                font_weight: typographyConfig.annotation && typographyConfig.annotation.font_weight ? typographyConfig.annotation.font_weight : 'normal',
            }
        }
    };

    function estimateTextWidth(text, fontProps) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttribute('font-family', fontProps.font_family);
        tempText.setAttribute('font-size', fontProps.font_size);
        tempText.setAttribute('font-weight', fontProps.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox should work on an unattached element if it's properly constructed.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback or error handling if getBBox fails without DOM attachment in some environments
            console.warn("getBBox failed for off-DOM text measurement, width estimation might be inaccurate.", e);
            return text ? text.length * (parseInt(fontProps.font_size) / 1.8) : 0; // Rough fallback
        }
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI prefix
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };
    
    // Filter out data items with non-numeric or invalid y-values early
    const chartDataArray = chartDataInput.filter(d => typeof d[valueFieldName] === 'number' && !isNaN(d[valueFieldName]) && d[valueFieldName] >= 0)
                                       .map(d => ({ ...d, [valueFieldName]: +d[valueFieldName] }));

    if (chartDataArray.length === 0 && chartDataInput.length > 0) {
        console.warn("All data points were filtered out due to invalid y-values. Rendering an empty chart area.");
        // d3.select(containerSelector).html("<div style='padding:10px;'>Invalid data for y-values.</div>");
        // return null;
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
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-root-svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 30, bottom: 40, left: 30 }; // Initial outer padding

    const legendSquareSize = 15;
    const legendRowHeight = legendSquareSize * 2.5; // Adjusted for potentially two lines of text
    const legendItemSpacingHorizontal = 15;
    const legendItemVerticalPadding = 5; // Padding within the legend item for text

    const legendAvailableWidth = containerWidth - chartMargins.left - chartMargins.right;
    let currentLegendX = 0;
    let legendRowCount = 1;
    
    const legendItemsData = chartDataArray.map(d => {
        const categoryText = String(d[categoryFieldName]);
        const valueText = `${formatValue(d[valueFieldName])} ${valueFieldUnit}`;
        
        const categoryWidth = estimateTextWidth(categoryText, fillStyle.typography.label);
        const valueWidth = estimateTextWidth(valueText, { ...fillStyle.typography.label, font_weight: 'bold' });
        
        const textBlockWidth = Math.max(categoryWidth, valueWidth);
        const itemWidth = legendSquareSize + 6 + textBlockWidth + legendItemSpacingHorizontal;
        return { categoryText, valueText, itemWidth };
    });

    legendItemsData.forEach(item => {
        if (currentLegendX + item.itemWidth > legendAvailableWidth && currentLegendX > 0) {
            legendRowCount++;
            currentLegendX = 0;
        }
        currentLegendX += item.itemWidth;
    });
    
    const actualLegendHeight = legendRowCount * legendRowHeight + (legendRowCount > 0 ? chartMargins.top : 0) ; // Add top margin only if legend exists

    const waffleAreaTopMargin = (chartDataArray.length > 0 ? actualLegendHeight : chartMargins.top) + (chartDataArray.length > 0 ? 10 : 0); // 10px spacing if legend exists
    const waffleInnerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const waffleInnerHeight = containerHeight - waffleAreaTopMargin - chartMargins.bottom;

    const totalValue = chartDataArray.reduce((sum, d) => sum + d[valueFieldName], 0);
    let valuePerSquare = 1;
    let totalSquares = Math.max(1, Math.round(totalValue)); // Ensure at least 1 square if totalValue > 0

    if (totalValue === 0 && chartDataArray.length > 0) { // Handle case where all values are 0
        totalSquares = chartDataArray.length; // One square per category if all values are 0
        valuePerSquare = 0; // Special handling for this case
    } else if (totalValue > 0) {
        if (totalValue > 1000) {
            valuePerSquare = Math.ceil(totalValue / 800);
            totalSquares = Math.ceil(totalValue / valuePerSquare);
        } else if (totalValue < 100 && totalValue > 0) { // Avoid too few squares if total value is small
            valuePerSquare = totalValue / 100;
            totalSquares = 100;
        } else if (totalValue === 0) { // If totalValue is 0 but data exists (e.g. all items are 0)
             totalSquares = chartDataArray.length > 0 ? chartDataArray.length : 1; // One square per item or 1 if no items
             valuePerSquare = 1; // Avoid division by zero, effectively 0 squares per item with value 0
        }
    } else { // No data or total value is 0
        totalSquares = 1; // Default to 1 square to avoid division by zero in layout
        valuePerSquare = 1;
    }
    totalSquares = Math.max(1, totalSquares); // Ensure totalSquares is at least 1

    let numCols, numRows;
    if (waffleInnerWidth <=0 || waffleInnerHeight <=0 || totalSquares === 0) {
        numCols = 1;
        numRows = 1;
    } else {
        const canvasRatio = waffleInnerWidth / waffleInnerHeight;
        const sqrtSquares = Math.sqrt(totalSquares);
        numRows = Math.round(sqrtSquares / Math.sqrt(canvasRatio));
        numCols = Math.round(sqrtSquares * Math.sqrt(canvasRatio));
        
        numRows = Math.max(1, numRows);
        numCols = Math.max(1, numCols);

        while (numRows * numCols < totalSquares) {
            if ((numCols / numRows) < canvasRatio) {
                numCols++;
            } else {
                numRows++;
            }
        }
    }
    
    const squareCellWidth = waffleInnerWidth > 0 && numCols > 0 ? waffleInnerWidth / numCols : 10;
    const squareCellHeight = waffleInnerHeight > 0 && numRows > 0 ? waffleInnerHeight / numRows : 10;
    const maxSquareSize = Math.max(1, Math.min(squareCellWidth, squareCellHeight));

    const squareSize = Math.max(1, maxSquareSize * 0.85);
    const squareSpacing = maxSquareSize * 0.15;

    const actualWaffleWidth = numCols * maxSquareSize;
    const actualWaffleHeight = numRows * maxSquareSize;

    const waffleOffsetX = (waffleInnerWidth - actualWaffleWidth) / 2;
    const waffleOffsetY = (waffleInnerHeight - actualWaffleHeight) / 2;

    // Block 5: Data Preprocessing & Transformation
    const categoryDataForSquares = [];
    let currentSquareCount = 0;
    const assignedColors = {};

    chartDataArray.forEach((d, i) => {
        const category = String(d[categoryFieldName]);
        const value = d[valueFieldName];
        let numSquaresForItem;

        if (totalValue === 0 && chartDataArray.length > 0) {
            numSquaresForItem = 1; // One square per category if all values are 0
        } else if (valuePerSquare === 0) { // Should not happen if totalValue > 0
            numSquaresForItem = 0;
        }
        else {
            numSquaresForItem = value > 0 ? Math.max(1, Math.round(value / valuePerSquare)) : 0;
            if (value > 0 && value < valuePerSquare) numSquaresForItem = 1; // Ensure small positive values get at least one square
        }


        let color;
        if (colorsConfig.field && colorsConfig.field[category]) {
            color = colorsConfig.field[category];
        } else {
            color = fillStyle.defaultCategoryColors[i % fillStyle.defaultCategoryColors.length];
        }
        assignedColors[category] = color;

        categoryDataForSquares.push({
            category: category,
            value: value,
            numSquares: numSquaresForItem,
            startSquare: currentSquareCount,
            color: color
        });
        currentSquareCount += numSquaresForItem;
    });
    
    // Adjust totalSquares if sum of rounded squares differs
    totalSquares = categoryDataForSquares.reduce((sum, cat) => sum + cat.numSquares, 0);
    // Re-calculate numRows/numCols if totalSquares changed significantly (optional, can lead to instability)
    // For simplicity, we'll proceed with initial numRows/numCols, squares might not fill grid perfectly or overflow.

    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales used for waffle layout, color mapping handled in Block 5.

    // Block 7: Chart Component Rendering (Legend)
    if (chartDataArray.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

        currentLegendX = 0;
        let currentLegendRow = 0;

        chartDataArray.forEach((d, i) => {
            const category = String(d[categoryFieldName]);
            const value = d[valueFieldName];
            const legendItemMeta = legendItemsData[i]; // Get pre-calculated widths

            if (currentLegendX + legendItemMeta.itemWidth > legendAvailableWidth && currentLegendX > 0) {
                currentLegendRow++;
                currentLegendX = 0;
            }

            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentLegendX}, ${currentLegendRow * legendRowHeight})`);

            legendItem.append("rect")
                .attr("class", "mark legend-swatch")
                .attr("width", legendSquareSize)
                .attr("height", legendSquareSize)
                .attr("fill", assignedColors[category]);

            legendItem.append("text")
                .attr("class", "label legend-category-text")
                .attr("x", legendSquareSize + 6)
                .attr("y", legendItemVerticalPadding + legendSquareSize / 2 - (legendSquareSize * 0.3)) // Adjust for two lines
                .attr("dy", "0.32em")
                .style("font-family", fillStyle.typography.label.font_family)
                .style("font-size", fillStyle.typography.label.font_size)
                .style("font-weight", fillStyle.typography.label.font_weight)
                .style("fill", fillStyle.textColor)
                .text(legendItemMeta.categoryText);
            
            legendItem.append("text")
                .attr("class", "value legend-value-text")
                .attr("x", legendSquareSize + 6)
                .attr("y", legendItemVerticalPadding + legendSquareSize / 2 + (legendSquareSize * 0.5)) // Adjust for two lines
                .attr("dy", "0.32em")
                .style("font-family", fillStyle.typography.label.font_family)
                .style("font-size", fillStyle.typography.label.font_size)
                .style("font-weight", "bold") // Value text often bold
                .style("fill", fillStyle.textColor)
                .text(legendItemMeta.valueText);

            currentLegendX += legendItemMeta.itemWidth;
        });
    }

    // Block 8: Main Data Visualization Rendering (Waffle Squares)
    if (waffleInnerWidth > 0 && waffleInnerHeight > 0 && totalSquares > 0) {
        const waffleGroup = svgRoot.append("g")
            .attr("class", "waffle-chart-group")
            .attr("transform", `translate(${chartMargins.left + waffleOffsetX}, ${waffleAreaTopMargin + waffleOffsetY})`);

        let drawnSquareIndex = 0;
        categoryDataForSquares.forEach(cat => {
            for (let i = 0; i < cat.numSquares; i++) {
                if (drawnSquareIndex >= numRows * numCols) break; // Prevent overflow if calculations differ

                const r = Math.floor(drawnSquareIndex / numCols);
                const c = drawnSquareIndex % numCols;

                waffleGroup.append("rect")
                    .attr("class", "mark waffle-square")
                    .attr("x", c * maxSquareSize + squareSpacing / 2)
                    .attr("y", r * maxSquareSize + squareSpacing / 2)
                    .attr("width", squareSize)
                    .attr("height", squareSize)
                    .attr("fill", cat.color)
                    .attr("rx", 0) // No rounded corners
                    .attr("ry", 0)
                    .attr("stroke", "none"); // No stroke
                
                drawnSquareIndex++;
            }
        });
    } else if (chartDataArray.length > 0) {
        // If waffle area is too small, display a message
        svgRoot.append("text")
            .attr("class", "label error-message")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", fillStyle.typography.label.font_size)
            .style("fill", fillStyle.textColor)
            .text("Chart area too small to render waffle squares.");
    }


    // Block 9: Optional Enhancements & Post-Processing
    // No complex visual effects like shadows, gradients, or patterns are applied as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}