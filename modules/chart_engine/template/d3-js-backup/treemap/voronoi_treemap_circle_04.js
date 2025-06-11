/* REQUIREMENTS_BEGIN
{
  "chart_type": "Voronoi Treemap",
  "chart_name": "voronoi_treemap_circle_04",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[5, 40], [0, "inf"]],
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
  "legend": "detailed",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!categoryFieldDef || !categoryFieldDef.name) {
        console.error("Critical chart config missing: Category field (role 'x') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Category field configuration is missing.</div>");
        return null;
    }
    if (!valueFieldDef || !valueFieldDef.name) {
        console.error("Critical chart config missing: Value field (role 'y') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Value field configuration is missing.</div>");
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    if (!chartData || chartData.length === 0) {
        console.warn("Chart data is empty or not provided.");
        d3.select(containerSelector).html("<div style='color:grey; padding:10px;'>No data to display.</div>");
        return null;
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#0f223b',

        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            
            valueFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif', // Using label styles for cell values
            valueFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px', 
            valueFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
        },

        defaultCellColor: '#CCCCCC',
        cellFillOpacity: 0.8,
        cellStrokeColor: 'none',
        valueLabelColor: '#FFFFFF',

        legend: {
            itemColorRectWidth: 12,
            itemColorRectHeight: 12,
            iconWidth: 16,
            iconHeight: 16,
            paddingRectIcon: 4,
            paddingIconText: 4,
            interItemSpacing: 10,
            interLineVerticalPadding: 6,
        },
        
        getCategoryColor: (categoryName, uniqueCategoriesMasterList) => {
            if (colors.field && colors.field[categoryName]) {
                return colors.field[categoryName];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                const index = uniqueCategoriesMasterList.indexOf(categoryName);
                if (index === -1) return fillStyle.defaultCellColor; // Should not happen if uniqueCategoriesMasterList is correct
                return colors.available_colors[index % colors.available_colors.length];
            }
            const index = uniqueCategoriesMasterList.indexOf(categoryName);
            if (index === -1) return fillStyle.defaultCellColor;
            return d3.schemeCategory10[index % d3.schemeCategory10.length];
        },

        getCategoryImageURL: (categoryName) => {
            if (images.field && images.field[categoryName]) {
                return images.field[categoryName];
            }
            return null;
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvgForTextMeasurement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextNode.setAttribute('font-family', fontFamily);
        tempTextNode.setAttribute('font-size', fontSize); // fontSize must be string with unit e.g. '12px'
        tempTextNode.setAttribute('font-weight', fontWeight);
        tempTextNode.textContent = text;
        tempSvgForTextMeasurement.appendChild(tempTextNode);
        
        let width = 0;
        try {
            // getBBox works on in-memory SVG elements in modern browsers
            width = tempTextNode.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth: getBBox failed. Using fallback estimation.", e);
            const avgCharWidth = parseFloat(fontSize) * 0.6; // Simple fallback
            width = text.length * avgCharWidth;
        }
        return width;
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
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = {
        top: variables.margin?.top ?? 20,
        right: variables.margin?.right ?? 10,
        bottom: variables.margin?.bottom ?? 10,
        left: variables.margin?.left ?? 10
    };
    
    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendPaddingBelowToChart = 15;
    const minSvgGlobalTopPadding = chartMargins.top;

    const uniqueCategories = [...new Set(chartData.map(d => d[categoryFieldName]))];
    
    let legendBlockHeight = 0;
    const legendLines = [];
    let legendItemMaxHeight = 0;

    const legendLayoutWidth = containerWidth - chartMargins.left - chartMargins.right;

    if (uniqueCategories.length > 0) {
        legendItemMaxHeight = Math.max(
            fillStyle.legend.itemColorRectHeight, 
            fillStyle.legend.iconHeight, 
            parseFloat(fillStyle.typography.labelFontSize) // Ensure font size is numeric for Math.max
        );

        const legendItemsData = uniqueCategories.map(catName => {
            const text = String(catName);
            const color = fillStyle.getCategoryColor(catName, uniqueCategories);
            const iconUrl = fillStyle.getCategoryImageURL(catName);
            const textWidth = estimateTextWidth(text, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            
            let itemVisualWidth = fillStyle.legend.itemColorRectWidth;
            itemVisualWidth += fillStyle.legend.paddingRectIcon; // Padding after rect, before icon or text
            if (iconUrl) {
                itemVisualWidth += fillStyle.legend.iconWidth + fillStyle.legend.paddingIconText; // Icon and its padding before text
            }
            itemVisualWidth += textWidth;
            return { text, color, iconUrl, textWidth, visualWidth: itemVisualWidth };
        });

        let currentLineItems = [];
        let currentLineVisualWidth = 0;

        legendItemsData.forEach(item => {
            let widthIfAdded = item.visualWidth;
            if (currentLineItems.length > 0) {
                widthIfAdded += fillStyle.legend.interItemSpacing;
            }

            if (currentLineItems.length > 0 && (currentLineVisualWidth + widthIfAdded) > legendLayoutWidth) {
                legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
                currentLineItems = [item];
                currentLineVisualWidth = item.visualWidth;
            } else {
                if (currentLineItems.length > 0) {
                    currentLineVisualWidth += fillStyle.legend.interItemSpacing;
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
                                Math.max(0, legendLines.length - 1) * fillStyle.legend.interLineVerticalPadding;
        }
    }

    let effectiveMarginTop = minSvgGlobalTopPadding;
    if (legendBlockHeight > 0) {
        effectiveMarginTop = minSvgGlobalTopPadding + legendBlockHeight + legendPaddingBelowToChart;
    }
    
    const mainChartContentWidth = containerWidth - chartMargins.left - chartMargins.right;
    const mainChartContentHeight = containerHeight - effectiveMarginTop - chartMargins.bottom;

    if (mainChartContentWidth <= 0 || mainChartContentHeight <= 0) {
        console.error("Chart dimensions are not positive after calculating margins and legend. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Chart area has zero or negative size. Adjust dimensions or margins.</div>");
        return null;
    }

    const radius = Math.min(mainChartContentWidth, mainChartContentHeight) / 2;
    const clipCenterX = mainChartContentWidth / 2;
    const clipCenterY = mainChartContentHeight / 2;

    // Block 5: Data Preprocessing & Transformation
    const processedDataForVoronoi = chartData.map(d => ({
        name: d[categoryFieldName],
        weight: +d[valueFieldName] || 0 
    }));

    const clipPolygon = [];
    const numClipPoints = 60; 
    for (let i = 0; i < numClipPoints; i++) {
        const angle = (i / numClipPoints) * 2 * Math.PI;
        clipPolygon.push([
            clipCenterX + radius * Math.cos(angle),
            clipCenterY + radius * Math.sin(angle)
        ]);
    }

    // Block 6: Scale Definition & Configuration
    // Color scale is fillStyle.getCategoryColor. No other explicit scales.

    // Block 7: Chart Component Rendering (Legend)
    const legendStartY = minSvgGlobalTopPadding;
    if (legendBlockHeight > 0 && legendLines.length > 0) {
        const legendContainerGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(0, ${legendStartY})`);
        
        let currentLineBaseY = 0;

        legendLines.forEach((line) => {
            const lineRenderStartX = chartMargins.left + (legendLayoutWidth - line.totalVisualWidth) / 2;
            const lineCenterY = currentLineBaseY + legendItemMaxHeight / 2; // Vertical center for items in this line
            let currentItemDrawX = lineRenderStartX;

            line.items.forEach((item, itemIndex) => {
                legendContainerGroup.append("rect")
                    .attr("class", "legend-item color-swatch mark") // Added 'mark'
                    .attr("x", currentItemDrawX)
                    .attr("y", currentLineBaseY + (legendItemMaxHeight - fillStyle.legend.itemColorRectHeight) / 2)
                    .attr("width", fillStyle.legend.itemColorRectWidth)
                    .attr("height", fillStyle.legend.itemColorRectHeight)
                    .attr("fill", item.color)
                    .attr("fill-opacity", fillStyle.cellFillOpacity);
                currentItemDrawX += fillStyle.legend.itemColorRectWidth;
                currentItemDrawX += fillStyle.legend.paddingRectIcon; // Padding after rect

                if (item.iconUrl) {
                    legendContainerGroup.append("image")
                        .attr("class", "legend-item icon image")
                        .attr("xlink:href", item.iconUrl)
                        .attr("x", currentItemDrawX)
                        .attr("y", currentLineBaseY + (legendItemMaxHeight - fillStyle.legend.iconHeight) / 2)
                        .attr("width", fillStyle.legend.iconWidth)
                        .attr("height", fillStyle.legend.iconHeight)
                        .attr("preserveAspectRatio", "xMidYMid meet");
                    currentItemDrawX += fillStyle.legend.iconWidth;
                    currentItemDrawX += fillStyle.legend.paddingIconText; // Padding after icon
                }
                
                legendContainerGroup.append("text")
                    .attr("class", "legend-item label text")
                    .attr("x", currentItemDrawX)
                    .attr("y", lineCenterY)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(item.text);
                currentItemDrawX += item.textWidth; 
                
                if (itemIndex < line.items.length - 1) {
                     currentItemDrawX += fillStyle.legend.interItemSpacing;
                }
            });
            currentLineBaseY += legendItemMaxHeight + fillStyle.legend.interLineVerticalPadding;
        });
    }
    
    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-area")
        .attr("transform", `translate(${chartMargins.left}, ${effectiveMarginTop})`);

    if (typeof d3.voronoiMapSimulation !== 'function') {
        console.error("d3.voronoiMapSimulation is not available. Please include the d3-voronoi-map library.");
        mainChartGroup.append("text").text("Error: Voronoi library not loaded.")
            .attr("x", 10).attr("y", 20).attr("fill", "red")
            .style("font-family", "Arial, sans-serif").style("font-size", "12px");
        return svgRoot.node();
    }
    
    const voronoiSimulation = d3.voronoiMapSimulation(processedDataForVoronoi)
        .weight(d => d.weight)
        .clip(clipPolygon)
        .stop();

    let simulationState = voronoiSimulation.state();
    let iterations = 0;
    const maxIterations = variables.voronoi_max_iterations || 300; 
    
    while (!simulationState.ended && iterations < maxIterations) {
        voronoiSimulation.tick();
        simulationState = voronoiSimulation.state();
        iterations++;
    }
    
    const finalPolygons = simulationState.polygons;

    const cellGroups = mainChartGroup.selectAll("g.cell-group")
        .data(finalPolygons)
        .enter()
        .append("g")
        .attr("class", "mark-group"); 

    cellGroups.append("path")
        .attr("class", "mark") 
        .attr("d", d => "M" + d.join("L") + "Z")
        .attr("fill", d => fillStyle.getCategoryColor(d.site.originalObject.data.name, uniqueCategories))
        .attr("fill-opacity", fillStyle.cellFillOpacity)
        .attr("stroke", fillStyle.cellStrokeColor)
        .attr("stroke-width", fillStyle.cellStrokeColor === "none" ? 0 : 1);

    // Block 9: Optional Enhancements & Post-Processing (Value Labels)
    const dataFormatter = d3.format(",d");
    const VALUE_LABEL_MAX_WIDTH_RATIO = 0.9;  // Max width of label relative to polygon width
    const VALUE_LABEL_MAX_HEIGHT_RATIO = 0.7; // Max height of label relative to polygon height
    const VALUE_LABEL_MIN_FONT_SIZE_PX = 8;   // Min font size for labels

    cellGroups.append("text")
        .attr("class", "label value-label text") 
        .attr("x", d => d3.polygonCentroid(d)[0])
        .attr("y", d => d3.polygonCentroid(d)[1])
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", fillStyle.valueLabelColor)
        .style("font-family", fillStyle.typography.valueFontFamily)
        .style("font-size", fillStyle.typography.valueFontSize)
        .style("font-weight", fillStyle.typography.valueFontWeight)
        .text(d => dataFormatter(d.site.originalObject.data.weight))
        .each(function(polygonData) { // 'polygonData' is the polygon vertex array
            const textElement = d3.select(this);
            let currentFontSize = parseFloat(textElement.style("font-size"));
            
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            polygonData.forEach(point => {
                minX = Math.min(minX, point[0]);
                minY = Math.min(minY, point[1]);
                maxX = Math.max(maxX, point[0]);
                maxY = Math.max(maxY, point[1]);
            });
            const polygonWidth = maxX - minX;
            const polygonHeight = maxY - minY;

            while (currentFontSize >= VALUE_LABEL_MIN_FONT_SIZE_PX) {
                const textBBox = this.getBBox();
                const textWidth = textBBox.width;
                const textHeight = textBBox.height; // Using BBox height is more accurate

                if (textWidth < polygonWidth * VALUE_LABEL_MAX_WIDTH_RATIO && textHeight < polygonHeight * VALUE_LABEL_MAX_HEIGHT_RATIO) {
                    break; 
                }
                currentFontSize -= 1; 
                textElement.style("font-size", currentFontSize + "px");
                if (currentFontSize < VALUE_LABEL_MIN_FONT_SIZE_PX) break;
            }

            const finalTextBBox = this.getBBox();
            if (finalTextBBox.width > polygonWidth * VALUE_LABEL_MAX_WIDTH_RATIO || finalTextBBox.height > polygonHeight * VALUE_LABEL_MAX_HEIGHT_RATIO) {
                textElement.style("display", "none");
            }
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}