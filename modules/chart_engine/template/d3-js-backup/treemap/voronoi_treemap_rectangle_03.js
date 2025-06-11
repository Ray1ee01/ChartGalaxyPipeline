/* REQUIREMENTS_BEGIN
{
  "chart_type": "Voronoi Treemap",
  "chart_name": "voronoi_treemap_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 40], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_edge"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    if (!categoryColumn || !categoryColumn.name || !valueColumn || !valueColumn.name) {
        const missingFields = [];
        if (!categoryColumn || !categoryColumn.name) missingFields.push("x role column");
        if (!valueColumn || !valueColumn.name) missingFields.push("y role column");
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        }
        return null;
    }
    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColors: {
            primary: colorsConfig.text_color || "#0f223b",
            legend: colorsConfig.text_color || typographyConfig.label?.font_color || "#333333", // Retain original fallback for legend
            cellLabel: colorsConfig.other?.cell_label_color || "#FFFFFF",
        },
        backgroundColors: {
            svg: colorsConfig.background_color || "#FFFFFF",
        },
        opacity: {
            cellFill: 0.8,
            legendSwatch: 0.85,
        },
        stroke: {
            cell: "none",
        },
        typography: {
            // Defaulting to "label" for general text if not specified, then hardcoded.
            fontFamily: typographyConfig.label?.font_family || "Arial, sans-serif",
            
            legendFontSize: typographyConfig.label?.font_size || "12px",
            legendFontWeight: typographyConfig.label?.font_weight || "normal",
            legendFontFamily: typographyConfig.label?.font_family || "Arial, sans-serif",

            cellLabelFontSize: typographyConfig.label?.font_size || "16px", // Original used 16px
            cellLabelFontWeight: typographyConfig.label?.font_weight || "bold", // Original used bold
            cellLabelFontFamily: typographyConfig.label?.font_family || "Arial, sans-serif",
        }
    };
    
    // Legend layout parameters from variables with defaults
    const legendSettings = {
        iconSize: variables.legendIconSize || 16,
        lineSpacing: variables.legendLineSpacing || 6,
        interItemSpacing: variables.legendInterItemSpacing || 10,
        colorRectWidth: variables.legendColorRectWidth || 12,
        colorRectHeight: variables.legendColorRectHeight || 12,
        paddingRectIcon: variables.legendPaddingRectIcon || 4,
        paddingIconText: variables.legendPaddingIconText || 4,
        paddingBelowLegendToChart: variables.paddingBelowLegendToChart || 15,
        minSvgGlobalTopPadding: variables.minSvgGlobalTopPadding || 10,
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text || text.length === 0) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        // No DOM append needed for getBBox if element is created with correct namespace
        try {
            return textNode.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails (e.g. in some test environments without full SVG support)
            return text.length * (parseFloat(fontSize) / 2); // Rough estimate
        }
    }
    
    const uniqueCategoriesForColor = [...new Set(chartDataInput.map(d => d[categoryFieldName]))];
    const getColor = (categoryName) => {
        if (colorsConfig.field && colorsConfig.field[categoryName]) {
            return colorsConfig.field[categoryName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            const index = uniqueCategoriesForColor.indexOf(categoryName);
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        const defaultScheme = d3.schemeTableau10;
        const index = uniqueCategoriesForColor.indexOf(categoryName);
        return defaultScheme[index % defaultScheme.length];
    };

    const getImageUrl = (categoryName) => {
        if (imagesConfig.field && imagesConfig.field[categoryName]) {
            return imagesConfig.field[categoryName];
        }
        // No fallback to images.other.primary for categorical icons unless specified
        return null;
    };
    
    const valueFormatter = d3.format(",d");

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColors.svg)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin?.top ?? 10,
        right: variables.margin?.right ?? 10,
        bottom: variables.margin?.bottom ?? 10,
        left: variables.margin?.left ?? 10,
    };

    const tempInnerWidth = containerWidth - chartMargins.left - chartMargins.right; // Used for legend wrapping calculation

    let legendBlockHeight = 0;
    const legendLines = [];
    let legendItemMaxHeight = 0;

    const uniqueCategoriesForLegend = [...new Set(chartDataInput.map(d => d[categoryFieldName]))];

    if (uniqueCategoriesForLegend.length > 0) {
        legendItemMaxHeight = Math.max(
            legendSettings.colorRectHeight, 
            legendSettings.iconSize, 
            parseFloat(fillStyle.typography.legendFontSize)
        );

        const legendItemsData = uniqueCategoriesForLegend.map(catName => {
            const text = String(catName);
            const color = getColor(catName);
            const iconUrl = getImageUrl(catName);
            const textWidth = estimateTextWidth(
                text, 
                fillStyle.typography.legendFontFamily, 
                fillStyle.typography.legendFontSize, 
                fillStyle.typography.legendFontWeight
            );
            
            let itemVisualWidth = legendSettings.colorRectWidth;
            if (iconUrl) {
                itemVisualWidth += legendSettings.paddingRectIcon + legendSettings.iconSize + legendSettings.paddingIconText;
            } else {
                itemVisualWidth += legendSettings.paddingRectIcon; // Space even if no icon, for alignment with text
            }
            itemVisualWidth += textWidth;

            return { text, color, iconUrl, textWidth, visualWidth: itemVisualWidth };
        });

        let currentLineItems = [];
        let currentLineVisualWidth = 0;
        
        legendItemsData.forEach(item => {
            let widthIfAdded = item.visualWidth;
            if (currentLineItems.length > 0) {
                widthIfAdded += legendSettings.interItemSpacing;
            }

            if (currentLineItems.length > 0 && (currentLineVisualWidth + widthIfAdded) > tempInnerWidth) {
                legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
                currentLineItems = [item];
                currentLineVisualWidth = item.visualWidth;
            } else {
                if (currentLineItems.length > 0) {
                    currentLineVisualWidth += legendSettings.interItemSpacing;
                }
                currentLineItems.push(item);
                currentLineVisualWidth += item.visualWidth;
            }
        });
        if (currentLineItems.length > 0) {
            legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
        }

        if (legendLines.length > 0) {
            legendBlockHeight = legendLines.length * legendItemMaxHeight + 
                                Math.max(0, legendLines.length - 1) * legendSettings.lineSpacing;
        }
    }
    
    const legendStartY = legendSettings.minSvgGlobalTopPadding;
    const effectiveMarginTop = legendBlockHeight > 0 
        ? legendStartY + legendBlockHeight + legendSettings.paddingBelowLegendToChart
        : Math.max(chartMargins.top, legendSettings.minSvgGlobalTopPadding);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - effectiveMarginTop - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const message = "Calculated chart dimensions (width/height) are not positive. Adjust container size or margins.";
        console.error(message);
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("fill", "red")
            .text(message);
        return svgRoot.node();
    }

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({
        name: d[categoryFieldName],
        weight: +d[valueFieldName] || 0 // Ensure weight is a number
    }));

    // Block 6: Scale Definition & Configuration
    // No explicit scales like x/y scales for Voronoi; layout is by simulation. Color scale is `getColor`.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    if (legendBlockHeight > 0 && legendLines.length > 0) {
        const legendContainerGroup = svgRoot.append("g")
            .attr("class", "legend-container")
            .attr("transform", `translate(0, ${legendStartY})`);

        let currentLineBaseY = 0;
        
        legendLines.forEach((line) => {
            const lineRenderStartX = chartMargins.left + (innerWidth - line.totalVisualWidth) / 2;
            const lineCenterY = currentLineBaseY + legendItemMaxHeight / 2;
            let currentItemDrawX = lineRenderStartX;
            
            line.items.forEach((item, itemIndex) => {
                const itemGroup = legendContainerGroup.append("g").attr("class", "legend-item");

                itemGroup.append("rect")
                    .attr("class", "mark legend-color-swatch")
                    .attr("x", currentItemDrawX)
                    .attr("y", currentLineBaseY + (legendItemMaxHeight - legendSettings.colorRectHeight) / 2)
                    .attr("width", legendSettings.colorRectWidth)
                    .attr("height", legendSettings.colorRectHeight)
                    .attr("fill", item.color)
                    .attr("fill-opacity", fillStyle.opacity.legendSwatch);
                currentItemDrawX += legendSettings.colorRectWidth;

                if (item.iconUrl) {
                    currentItemDrawX += legendSettings.paddingRectIcon;
                    itemGroup.append("image")
                        .attr("class", "icon legend-icon")
                        .attr("xlink:href", item.iconUrl)
                        .attr("x", currentItemDrawX)
                        .attr("y", currentLineBaseY + (legendItemMaxHeight - legendSettings.iconSize) / 2)
                        .attr("width", legendSettings.iconSize)
                        .attr("height", legendSettings.iconSize)
                        .attr("preserveAspectRatio", "xMidYMid meet");
                    currentItemDrawX += legendSettings.iconSize;
                    currentItemDrawX += legendSettings.paddingIconText;
                } else {
                    currentItemDrawX += legendSettings.paddingRectIcon; 
                }
                
                itemGroup.append("text")
                    .attr("class", "label legend-text")
                    .attr("x", currentItemDrawX)
                    .attr("y", lineCenterY)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.legendFontFamily)
                    .style("font-size", fillStyle.typography.legendFontSize)
                    .style("font-weight", fillStyle.typography.legendFontWeight)
                    .style("fill", fillStyle.textColors.legend)
                    .text(item.text);
                
                currentItemDrawX += item.textWidth; 
                
                if (itemIndex < line.items.length - 1) {
                     currentItemDrawX += legendSettings.interItemSpacing;
                }
            });
            currentLineBaseY += legendItemMaxHeight + legendSettings.lineSpacing;
        });
    }

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${effectiveMarginTop})`);

    const clipPathPolygon = [
        [0, 0],
        [0, innerHeight],
        [innerWidth, innerHeight],
        [innerWidth, 0]
    ];
    
    // Check for d3.voronoiMapSimulation availability
    if (typeof d3.voronoiMapSimulation !== 'function') {
        const errorMsg = "d3.voronoiMapSimulation is not available. Please include the d3-voronoi-map library.";
        console.error(errorMsg);
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("fill", "red")
            .text(errorMsg);
        return svgRoot.node();
    }

    const simulation = d3.voronoiMapSimulation(chartDataArray)
        .weight(d => d.weight)
        .clip(clipPathPolygon)
        .stop(); // Stop for manual iteration
    
    let simulationState = simulation.state();
    while (simulationState && !simulationState.ended) {
        simulation.tick();
        simulationState = simulation.state();
    }
    
    const polygons = simulationState ? simulationState.polygons : [];
    
    const cellGroups = mainChartGroup.selectAll(".voronoi-cell-group")
        .data(polygons)
        .enter()
        .append("g")
        .attr("class", "mark voronoi-cell-group");
    
    cellGroups.append("path")
        .attr("class", "mark voronoi-cell-path")
        .attr("d", d => "M" + d.join("L") + "Z")
        .attr("fill", d => getColor(d.site.originalObject.data.name))
        .attr("fill-opacity", fillStyle.opacity.cellFill)
        .attr("stroke", fillStyle.stroke.cell);
    
    cellGroups.append("text")
        .attr("class", "label data-value")
        .attr("x", d => d3.polygonCentroid(d)[0])
        .attr("y", d => d3.polygonCentroid(d)[1])
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", fillStyle.textColors.cellLabel)
        .style("font-size", fillStyle.typography.cellLabelFontSize)
        .style("font-weight", fillStyle.typography.cellLabelFontWeight)
        .style("font-family", fillStyle.typography.cellLabelFontFamily)
        .text(d => valueFormatter(d.site.originalObject.data.weight))
        .each(function(d) { // `this` refers to the text element
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            d.forEach(point => { // d here is the polygon (array of points)
                minX = Math.min(minX, point[0]);
                minY = Math.min(minY, point[1]);
                maxX = Math.max(maxX, point[0]);
                maxY = Math.max(maxY, point[1]);
            });
            
            const polygonWidth = maxX - minX;
            const polygonHeight = maxY - minY;
            
            const textWidth = this.getComputedTextLength ? this.getComputedTextLength() : estimateTextWidth(this.textContent, fillStyle.typography.cellLabelFontFamily, fillStyle.typography.cellLabelFontSize, fillStyle.typography.cellLabelFontWeight);
            const textHeight = parseFloat(fillStyle.typography.cellLabelFontSize);

            // Hide if text is too large for the cell (0.9 and 0.8 are safety margins)
            if (textWidth > polygonWidth * 0.9 || textHeight > polygonHeight * 0.8) {
                d3.select(this).style("display", "none");
            }
        });

    // Block 9: Optional Enhancements & Post-Processing
    // No additional enhancements specified beyond core rendering.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}