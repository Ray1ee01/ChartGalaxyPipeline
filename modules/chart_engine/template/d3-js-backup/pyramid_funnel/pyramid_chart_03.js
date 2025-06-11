/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pyramid Chart",
  "chart_name": "pyramid_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 10], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "ascending",
  "iconographyUsage": "categorical_markers_overlay_edge"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data;
    const chartDataArray = chartConfig.data && chartConfig.data.data ? chartConfig.data.data : [];
    const variables = chartConfig.variables || {};
    const typographyConfig = chartConfig.typography || {};
    const colorsConfig = chartConfig.colors || {};
    const imagesConfig = chartConfig.images || {};
    const dataColumns = chartConfig.data && chartConfig.data.columns ? chartConfig.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !categoryColumn.name || !valueColumn || !valueColumn.name) {
        const missing = [];
        if (!categoryColumn || !categoryColumn.name) missing.push("category field (role 'x')");
        if (!valueColumn || !valueColumn.name) missing.push("value field (role 'y')");
        
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        segmentColors: [], // Will be populated later if needed for specific logic
        categoryIcons: {} // Will be populated later
    };

    fillStyle.typography.titleFontFamily = typographyConfig.title && typographyConfig.title.font_family ? typographyConfig.title.font_family : 'Arial, sans-serif';
    fillStyle.typography.titleFontSize = typographyConfig.title && typographyConfig.title.font_size ? typographyConfig.title.font_size : '16px';
    fillStyle.typography.titleFontWeight = typographyConfig.title && typographyConfig.title.font_weight ? typographyConfig.title.font_weight : 'bold';

    fillStyle.typography.labelFontFamily = typographyConfig.label && typographyConfig.label.font_family ? typographyConfig.label.font_family : 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = typographyConfig.label && typographyConfig.label.font_size ? typographyConfig.label.font_size : '12px';
    fillStyle.typography.labelFontWeight = typographyConfig.label && typographyConfig.label.font_weight ? typographyConfig.label.font_weight : 'normal';
    
    // Note: line_spacing is not in the spec, using a default for legend layout.
    // const labelLineSpacing = parseFloat(typographyConfig.label?.line_spacing || '6'); // Original approach
    const legendInterLineVerticalPadding = 6; // Default value

    fillStyle.typography.annotationFontFamily = typographyConfig.annotation && typographyConfig.annotation.font_family ? typographyConfig.annotation.font_family : 'Arial, sans-serif';
    fillStyle.typography.annotationFontSize = typographyConfig.annotation && typographyConfig.annotation.font_size ? typographyConfig.annotation.font_size : '10px';
    fillStyle.typography.annotationFontWeight = typographyConfig.annotation && typographyConfig.annotation.font_weight ? typographyConfig.annotation.font_weight : 'normal';
    
    fillStyle.textColor = colorsConfig.text_color || '#333333';
    fillStyle.chartBackground = colorsConfig.background_color || '#FFFFFF'; // Defined but not used to fill SVG background per "background: no"

    fillStyle.getSegmentColor = (categoryName, index) => {
        if (colorsConfig.field && colorsConfig.field[categoryName]) {
            return colorsConfig.field[categoryName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        return d3.schemeCategory10[index % 10];
    };

    fillStyle.getLegendIconUrl = categoryName => {
        return imagesConfig.field && imagesConfig.field[categoryName] ? imagesConfig.field[categoryName] : null;
    };
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.position = 'absolute'; // Ensure it's not affecting layout if it were in DOM
        // tempSvg.style.visibility = 'hidden';
        // document.body.appendChild(tempSvg); // Not strictly needed for getBBox with direct attributes

        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        
        const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg); // Cleanup if appended
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "pyramid-chart-svg")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 120, bottom: 40, left: 60 };
    const initialInnerWidth = containerWidth - chartMargins.left - chartMargins.right;
    // const initialInnerHeight = containerHeight - chartMargins.top - chartMargins.bottom; // Not directly used like this

    // Legend layout constants
    const legendColorRectWidth = 12;
    const legendColorRectHeight = 12;
    const legendIconNominalSize = 16; // Default icon size
    const legendPaddingRectIcon = 4;
    const legendPaddingIconText = 4;
    const legendInterItemHorizontalSpacing = 10;
    const paddingBelowLegendToChart = 20;
    const minSvgGlobalTopPadding = 15;

    let legendBlockHeight = 0;
    const legendLines = [];
    let legendItemMaxHeight = 0;

    const uniqueCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];

    if (uniqueCategories.length > 0 && chartDataArray.length > 0) {
        legendItemMaxHeight = Math.max(
            legendColorRectHeight, 
            legendIconNominalSize, 
            parseFloat(fillStyle.typography.labelFontSize) // Ensure this is a number for Math.max
        );

        const legendItemsData = uniqueCategories.map((catName, index) => {
            const text = String(catName);
            // Find original index for consistent color if data isn't pre-sorted for legend creation
            const originalIndex = chartDataArray.findIndex(d => d[categoryFieldName] === catName);
            const color = fillStyle.getSegmentColor(catName, originalIndex);
            const iconUrl = fillStyle.getLegendIconUrl(catName);
            const textWidth = estimateTextWidth(
                text, 
                fillStyle.typography.labelFontFamily, 
                fillStyle.typography.labelFontSize, 
                fillStyle.typography.labelFontWeight
            );
            
            let itemVisualWidth = legendColorRectWidth;
            if (iconUrl) {
                itemVisualWidth += legendPaddingRectIcon + legendIconNominalSize + legendPaddingIconText;
            } else {
                itemVisualWidth += legendPaddingRectIcon; 
            }
            itemVisualWidth += textWidth;
            return { text, color, iconUrl, textWidth, visualWidth: itemVisualWidth, categoryName: catName };
        });

        let currentLineItems = [];
        let currentLineVisualWidth = 0;
        const availableWidthForLegendWrapping = initialInnerWidth;

        legendItemsData.forEach(item => {
            let widthIfAdded = item.visualWidth;
            if (currentLineItems.length > 0) {
                widthIfAdded += legendInterItemHorizontalSpacing;
            }
            if (currentLineItems.length > 0 && (currentLineVisualWidth + widthIfAdded) > availableWidthForLegendWrapping) {
                legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
                currentLineItems = [item];
                currentLineVisualWidth = item.visualWidth;
            } else {
                if (currentLineItems.length > 0) {
                    currentLineVisualWidth += legendInterItemHorizontalSpacing;
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
                                Math.max(0, legendLines.length - 1) * legendInterLineVerticalPadding;
        }
    }

    let effectiveMarginTop = chartMargins.top;
    let legendStartY = minSvgGlobalTopPadding;

    if (legendBlockHeight > 0) {
        legendStartY = Math.max(minSvgGlobalTopPadding, chartMargins.top);
        effectiveMarginTop = legendStartY + legendBlockHeight + paddingBelowLegendToChart;
    } else {
        effectiveMarginTop = Math.max(chartMargins.top, minSvgGlobalTopPadding);
    }
    
    const pyramidPlotHeight = containerHeight - effectiveMarginTop - chartMargins.bottom;
    const pyramidPlotWidth = initialInnerWidth;


    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray].sort((a, b) => a[valueFieldName] - b[valueFieldName]);
    
    const totalValue = d3.sum(sortedData, d => d[valueFieldName]);
    
    if (totalValue === 0 && sortedData.length > 0) {
        // Handle case where all values are zero to prevent division by zero
        // Assign equal percentage if total is 0 but items exist.
        sortedData.forEach(d => {
            d.percent = 100 / sortedData.length; 
        });
    } else if (totalValue > 0) {
        sortedData.forEach(d => {
            d.percent = (d[valueFieldName] / totalValue) * 100;
        });
    } else { // No data or negative sum (which shouldn't happen with positive values)
         sortedData.forEach(d => {
            d.percent = 0;
        });
    }
    
    // Calculate pyramid segment geometry
    const maxPyramidWidthAtBase = pyramidPlotWidth * 0.6; // Pyramid base width
    const pyramidActualHeight = pyramidPlotHeight * 0.8; // Pyramid actual height, leaving some vertical padding

    const pyramidSections = [];
    if (totalValue > 0) { // Only calculate sections if there's valid data
        const totalPyramidArea = maxPyramidWidthAtBase * pyramidActualHeight / 2; // Area of the equivalent triangle
        let currentCumulativeHeight = 0; // This is height from the tip of the pyramid (top)
        
        sortedData.forEach((d) => {
            const sectionAreaProportion = d.percent / 100;
            const sectionTargetArea = totalPyramidArea * sectionAreaProportion;
            
            // Pyramid geometry: width at height h from tip is w = (h / H_total) * W_base
            // Area of a trapezoidal segment: A = (w_bottom + w_top) * h_segment / 2
            // w_bottom = (currentCumulativeHeight / pyramidActualHeight) * maxPyramidWidthAtBase
            // w_top = ((currentCumulativeHeight + h_segment) / pyramidActualHeight) * maxPyramidWidthAtBase
            // Substitute into area equation:
            // sectionTargetArea = ( (currentCumulativeHeight/H)*W_base + ((currentCumulativeHeight+h_segment)/H)*W_base ) * h_segment / 2
            // sectionTargetArea = ( (2*currentCumulativeHeight + h_segment)/H * W_base ) * h_segment / 2
            // 2 * sectionTargetArea * H / W_base = (2*currentCumulativeHeight + h_segment) * h_segment
            // (W_base/H) * h_segment^2 + (2*currentCumulativeHeight*W_base/H) * h_segment - 2*sectionTargetArea = 0
            // This is a quadratic equation Ah^2 + Bh + C = 0 for h_segment
            // A = W_base / H
            // B = 2 * currentCumulativeHeight * W_base / H
            // C = -2 * sectionTargetArea
            
            const const_W_div_H = maxPyramidWidthAtBase / pyramidActualHeight;
            
            const quad_A = const_W_div_H;
            const quad_B = 2 * currentCumulativeHeight * const_W_div_H;
            const quad_C = -2 * sectionTargetArea;
            
            let h_segment;
            if (quad_A === 0) { // Should not happen if W_base and H are positive
                h_segment = (quad_B !== 0) ? -quad_C / quad_B : 0;
            } else {
                const discriminant = quad_B * quad_B - 4 * quad_A * quad_C;
                if (discriminant < 0) { // Should not happen with positive areas
                    h_segment = 0; 
                } else {
                    h_segment = (-quad_B + Math.sqrt(discriminant)) / (2 * quad_A);
                }
            }
            h_segment = Math.max(0, h_segment); // Ensure non-negative height

            const segmentBottomWidth = (currentCumulativeHeight / pyramidActualHeight) * maxPyramidWidthAtBase;
            const segmentTopWidth = ((currentCumulativeHeight + h_segment) / pyramidActualHeight) * maxPyramidWidthAtBase;
            
            pyramidSections.push({
                data: d,
                // Y coordinates are from the top (tip) of the pyramid structure
                y_start_from_tip: currentCumulativeHeight, 
                y_end_from_tip: currentCumulativeHeight + h_segment,
                bottomWidthAtSegment: segmentBottomWidth, // This is the width at y_start_from_tip
                topWidthAtSegment: segmentTopWidth,       // This is the width at y_end_from_tip
            });
            
            currentCumulativeHeight += h_segment;
        });
    }
    
    // Vertical offset to center the pyramid within its allocated space
    const pyramidVerticalCenteringOffset = (pyramidPlotHeight - pyramidActualHeight) / 2;

    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales are used for the pyramid itself; geometry is calculated directly.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    if (legendBlockHeight > 0 && legendLines.length > 0) {
        const legendContainerGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(0, ${legendStartY})`);

        let currentLineBaseY = 0;

        legendLines.forEach((line) => {
            const lineRenderStartX = chartMargins.left + (pyramidPlotWidth - line.totalVisualWidth) / 2; // Center legend in plot area
            const lineCenterY = currentLineBaseY + legendItemMaxHeight / 2;
            let currentItemDrawX = lineRenderStartX;
            
            line.items.forEach((item, itemIndex) => {
                // Legend color swatch
                legendContainerGroup.append("rect")
                    .attr("class", "mark legend-swatch")
                    .attr("x", currentItemDrawX)
                    .attr("y", currentLineBaseY + (legendItemMaxHeight - legendColorRectHeight) / 2)
                    .attr("width", legendColorRectWidth)
                    .attr("height", legendColorRectHeight)
                    // .attr("rx", 3).attr("ry", 3) // Removed rounded corners per "clean" style
                    .attr("fill", item.color);
                currentItemDrawX += legendColorRectWidth;

                // Legend icon
                if (item.iconUrl) {
                    currentItemDrawX += legendPaddingRectIcon;
                    legendContainerGroup.append("image")
                        .attr("class", "icon image legend-icon")
                        .attr("xlink:href", item.iconUrl)
                        .attr("x", currentItemDrawX)
                        .attr("y", currentLineBaseY + (legendItemMaxHeight - legendIconNominalSize) / 2)
                        .attr("width", legendIconNominalSize)
                        .attr("height", legendIconNominalSize)
                        .attr("preserveAspectRatio", "xMidYMid meet");
                    currentItemDrawX += legendIconNominalSize + legendPaddingIconText;
                } else {
                    currentItemDrawX += legendPaddingRectIcon; // Space even if no icon
                }

                // Legend text
                legendContainerGroup.append("text")
                    .attr("class", "label text legend-text")
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
                     currentItemDrawX += legendInterItemHorizontalSpacing;
                }
            });
            currentLineBaseY += legendItemMaxHeight + legendInterLineVerticalPadding;
        });
    }
    
    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${effectiveMarginTop})`);

    pyramidSections.forEach((section, i) => {
        const d = section.data;
        const color = fillStyle.getSegmentColor(d[categoryFieldName], sortedData.findIndex(sd => sd[categoryFieldName] === d[categoryFieldName]));
        
        // Points for the trapezoid segment. Y is from top of pyramid structure, add centering offset.
        // Order: top-left, top-right, bottom-right, bottom-left (for standard polygon winding)
        const points = [
            [pyramidPlotWidth / 2 - section.topWidthAtSegment / 2, section.y_end_from_tip + pyramidVerticalCenteringOffset], // Top-left of segment (pyramid tip is y=0)
            [pyramidPlotWidth / 2 + section.topWidthAtSegment / 2, section.y_end_from_tip + pyramidVerticalCenteringOffset], // Top-right
            [pyramidPlotWidth / 2 + section.bottomWidthAtSegment / 2, section.y_start_from_tip + pyramidVerticalCenteringOffset], // Bottom-right
            [pyramidPlotWidth / 2 - section.bottomWidthAtSegment / 2, section.y_start_from_tip + pyramidVerticalCenteringOffset]  // Bottom-left
        ];
        
        mainChartGroup.append("polygon")
            .attr("class", "mark pyramid-segment")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", color);
        
        // Data labels (percentages)
        const segmentMidY = (section.y_start_from_tip + section.y_end_from_tip) / 2 + pyramidVerticalCenteringOffset;
        const segmentMidMaxWidth = Math.max(section.bottomWidthAtSegment, section.topWidthAtSegment);
        const labelX = pyramidPlotWidth / 2 + segmentMidMaxWidth / 2 + 10; // Position to the right
        
        mainChartGroup.append("text")
            .attr("class", "label text data-label")
            .attr("x", labelX)
            .attr("y", segmentMidY)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(`${Math.round(d.percent)}%`);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // None for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}