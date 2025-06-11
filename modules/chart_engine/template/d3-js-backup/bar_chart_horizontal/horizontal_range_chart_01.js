/* REQUIREMENTS_BEGIN
{
  "chart_type": "Range Chart",
  "chart_name": "horizontal_range_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["x", "group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "minimal",
  "gridLineType": "prominent",
  "legend": "normal",
  "dataLabelPosition": "adjacent_element",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, chartConfig) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = chartConfig.data?.data;
    const chartVariables = chartConfig.variables || {};
    const chartTypography = chartConfig.typography || {};
    const chartColors = chartConfig.colors || {}; // Could be colors_dark, adapt if theme switching needed
    const chartImages = chartConfig.images || {}; // Not used in this chart
    const chartDataColumns = chartConfig.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = chartDataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = chartDataColumns.find(col => col.role === "y")?.name;
    const groupFieldName = chartDataColumns.find(col => col.role === "group")?.name;

    if (!categoryFieldName || !valueFieldName || !groupFieldName || !chartDataArray) {
        let missing = [];
        if (!categoryFieldName) missing.push("x role field definition");
        if (!valueFieldName) missing.push("y role field definition");
        if (!groupFieldName) missing.push("group role field definition");
        if (!chartDataArray) missing.push("chart data");
        
        const errorMsg = `Critical chart configuration missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: chartColors.text_color || '#E0E0E0', // Default for darkish backgrounds
        gridLineColor: chartColors.other?.gridLine || 'rgba(255, 255, 255, 0.2)',
        axisTickColor: chartColors.other?.axisTick || '#E0E0E0',
        connectorLineColor: chartColors.other?.connectorLine || '#FFFFFF',
        markerStrokeColor: chartColors.other?.markerStroke || '#FFFFFF',
        defaultMarkerFill: chartColors.other?.primary || '#3399FF',
        chartBackground: chartColors.background_color, // No default, SVG is transparent
        typography: {
            labelFontFamily: chartTypography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: chartTypography.label?.font_size || '12px',
            labelFontWeight: chartTypography.label?.font_weight || 'normal',
            annotationFontFamily: chartTypography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: chartTypography.annotation?.font_size || '10px',
            annotationFontWeight: chartTypography.annotation?.font_weight || 'bold', // Original used bold
        }
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const tempText = document.createElementNS("http://www.w3.org/2000/svg", "text");

        if (fontProps.fontFamily) tempText.setAttribute('font-family', fontProps.fontFamily);
        if (fontProps.fontSize) tempText.setAttribute('font-size', fontProps.fontSize);
        if (fontProps.fontWeight) tempText.setAttribute('font-weight', fontProps.fontWeight);
        
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // As per prompt, not appending tempSvg to the document DOM.
        // Note: getBBox() on non-rendered SVGs can be unreliable in some browsers.
        return tempText.getBBox().width;
    }
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartVariables.width || 800;
    const containerHeight = chartVariables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    if (fillStyle.chartBackground) {
        svgRoot.append("rect")
            .attr("width", containerWidth)
            .attr("height", containerHeight)
            .attr("fill", fillStyle.chartBackground)
            .attr("class", "chart-background-fill");
    }
    
    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for billion
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value); // General format for smaller numbers
    };

    // Block 4: Core Chart Dimensions & Layout Calculation
    const categoryUnit = chartDataColumns.find(col => col.role === "x")?.unit || "";
    // const valueUnit = chartDataColumns.find(col => col.role === "y")?.unit || ""; // Not used in original for value labels

    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    
    let maxCategoryLabelWidth = 0;
    categories.forEach(cat => {
        const formattedCat = categoryUnit && categoryUnit !== "none" ? `${cat}${categoryUnit}` : `${cat}`;
        const width = estimateTextWidth(formattedCat, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (width > maxCategoryLabelWidth) maxCategoryLabelWidth = width;
    });

    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const formattedVal = formatValue(d[valueFieldName]);
        const width = estimateTextWidth(formattedVal, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        });
         // Estimate background rect width: text width + padding
        if (width + 20 > maxValueLabelWidth) maxValueLabelWidth = width + 20; // 20 for padding and marker offset
    });
    
    const chartMargins = {
        top: 50, // For legend
        right: Math.max(20, maxValueLabelWidth + 15), // Space for value labels next to markers
        bottom: 30, // Space for X-axis tick labels
        left: Math.max(20, maxCategoryLabelWidth + 10) // Space for category labels
    };

    const plotWidth = containerWidth - chartMargins.left - chartMargins.right;
    const plotHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    if (groups.length !== 2) {
        console.warn("Range chart expects exactly two groups. Functionality may be affected.");
        // Proceeding, but the visual might not be a typical range/dumbbell plot.
    }

    // Block 6: Scale Definition & Configuration
    const categoryScale = d3.scaleBand()
        .domain(categories)
        .range([0, plotHeight])
        .padding(0.3); // Original used 0.3 or 0.2 based on has_spacing

    const valueExtent = d3.extent(chartDataArray, d => +d[valueFieldName]);
    const domainMin = Math.min(0, valueExtent[0] === undefined ? 0 : valueExtent[0]);
    const domainMax = valueExtent[1] === undefined ? 1 : valueExtent[1]; // Handle empty data case for extent

    const valueScale = d3.scaleLinear()
        .domain([domainMin, domainMax])
        .range([0, plotWidth])
        .nice();

    const groupColorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => {
            if (chartColors.field && chartColors.field[group]) {
                return chartColors.field[group];
            }
            if (chartColors.available_colors && chartColors.available_colors.length > 0) {
                return chartColors.available_colors[i % chartColors.available_colors.length];
            }
            return d3.schemeCategory10[i % d3.schemeCategory10.length];
        }));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "chart-area");

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend");
    
    let legendItemXOffset = 0;
    const legendItemPadding = 10; 
    const legendSwatchRadius = 7.5;

    groups.forEach((group, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${legendItemXOffset}, 0)`);

        legendItem.append("circle")
            .attr("class", "mark legend-swatch")
            .attr("cx", legendSwatchRadius)
            .attr("cy", legendSwatchRadius)
            .attr("r", legendSwatchRadius)
            .attr("fill", groupColorScale(group))
            .attr("stroke", fillStyle.markerStrokeColor)
            .attr("stroke-width", 1.2);

        const legendText = legendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendSwatchRadius * 2 + 5)
            .attr("y", legendSwatchRadius)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);
        
        const textWidth = estimateTextWidth(group, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        legendItemXOffset += legendSwatchRadius * 2 + 5 + textWidth + legendItemPadding;
    });
    
    const totalLegendWidth = Math.max(0, legendItemXOffset - legendItemPadding); // Remove last padding
    legendGroup.attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2 - legendSwatchRadius})`);


    // X-axis Gridlines and Tick Labels
    const xTicks = valueScale.ticks(Math.max(2, Math.floor(plotWidth / 80))); // Responsive number of ticks
    const xAxisGridLinesGroup = mainChartGroup.append("g").attr("class", "grid x-grid");
    
    xAxisGridLinesGroup.selectAll(".grid-line")
        .data(xTicks)
        .enter()
        .append("line")
        .attr("class", "grid-line")
        .attr("x1", d => valueScale(d))
        .attr("y1", 0)
        .attr("x2", d => valueScale(d))
        .attr("y2", plotHeight)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    const xAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis x-axis-labels");
    xAxisLabelsGroup.selectAll(".axis-label.x-axis-label")
        .data(xTicks)
        .enter()
        .append("text")
        .attr("class", "label axis-label x-axis-label")
        .attr("x", d => valueScale(d))
        .attr("y", plotHeight + 20)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.axisTickColor)
        .text(d => formatValue(d));

    // Category Labels (Y-axis)
    const yAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis y-axis-labels");
    categories.forEach(category => {
        const formattedCategory = categoryUnit && categoryUnit !== "none" ? `${category}${categoryUnit}` : `${category}`;
        yAxisLabelsGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", -5)
            .attr("y", categoryScale(category) + categoryScale.bandwidth() / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedCategory);
    });

    // Block 8: Main Data Visualization Rendering
    const dataMarkersGroup = mainChartGroup.append("g").attr("class", "data-markers");
    const rightmostTickX = valueScale(xTicks[xTicks.length - 1]);
    const connectorLineThickness = 4; // As per original visual

    categories.forEach(category => {
        const categoryDataPoints = chartDataArray.filter(d => d[categoryFieldName] === category);
        
        if (categoryDataPoints.length > 0) {
            const pointsForCategory = groups.map(group => {
                const dataPoint = categoryDataPoints.find(d => d[groupFieldName] === group);
                if (dataPoint) {
                    return {
                        group: group,
                        value: parseFloat(dataPoint[valueFieldName]),
                        x: valueScale(parseFloat(dataPoint[valueFieldName])),
                        y: categoryScale(category) + categoryScale.bandwidth() / 2
                    };
                }
                return null;
            }).filter(d => d !== null && !isNaN(d.x) && !isNaN(d.y));

            if (pointsForCategory.length > 0) {
                // Sort points by value to find min/max for connector line
                pointsForCategory.sort((a, b) => a.value - b.value);
                const minValPoint = pointsForCategory[0];
                const maxValPoint = pointsForCategory[pointsForCategory.length - 1];

                // Draw connector line (original used a rect from lowest value to rightmost tick)
                // This interpretation: line between the two points of the range.
                if (pointsForCategory.length === 2) { // Typical for range/dumbbell
                     dataMarkersGroup.append("line")
                        .attr("class", "mark connector-line")
                        .attr("x1", minValPoint.x)
                        .attr("y1", minValPoint.y)
                        .attr("x2", maxValPoint.x)
                        .attr("y2", maxValPoint.y)
                        .attr("stroke", fillStyle.connectorLineColor)
                        .attr("stroke-width", connectorLineThickness / 2); // Line is thinner than rect height
                } else if (pointsForCategory.length === 1) { // If only one point, original logic was to draw to rightmost tick
                     dataMarkersGroup.append("rect")
                        .attr("class", "mark connector-line")
                        .attr("x", minValPoint.x)
                        .attr("y", minValPoint.y - connectorLineThickness / 2)
                        .attr("width", Math.max(0, rightmostTickX - minValPoint.x))
                        .attr("height", connectorLineThickness)
                        .attr("fill", fillStyle.connectorLineColor);
                }


                pointsForCategory.forEach(point => {
                    dataMarkersGroup.append("circle")
                        .attr("class", "mark data-point")
                        .attr("cx", point.x)
                        .attr("cy", point.y)
                        .attr("r", 8) // Original marker radius
                        .attr("fill", groupColorScale(point.group))
                        .attr("stroke", fillStyle.markerStrokeColor)
                        .attr("stroke-width", 2);

                    const formattedValue = formatValue(point.value);
                    const textMetrics = {
                        fontFamily: fillStyle.typography.annotationFontFamily,
                        fontSize: fillStyle.typography.annotationFontSize,
                        fontWeight: fillStyle.typography.annotationFontWeight
                    };
                    const valueTextWidth = estimateTextWidth(formattedValue, textMetrics);
                    
                    const labelPadding = { x: 8, y: 4 };
                    const labelRectWidth = valueTextWidth + labelPadding.x * 2;
                    // Estimate height based on font size (approx)
                    const approxTextHeight = parseFloat(textMetrics.fontSize);
                    const labelRectHeight = approxTextHeight + labelPadding.y * 2;
                    
                    const labelGroup = dataMarkersGroup.append("g")
                        .attr("class", "data-value-label-group")
                        .attr("transform", `translate(${point.x + 12}, ${point.y})`); // Offset from circle

                    labelGroup.append("rect")
                        .attr("class", "mark data-label-background")
                        .attr("x", 0)
                        .attr("y", -labelRectHeight / 2)
                        .attr("width", labelRectWidth)
                        .attr("height", labelRectHeight)
                        .attr("rx", 6)
                        .attr("ry", 6)
                        .attr("fill", groupColorScale(point.group))
                        .attr("stroke", fillStyle.markerStrokeColor)
                        .attr("stroke-width", 1);

                    labelGroup.append("text")
                        .attr("class", "label data-label")
                        .attr("x", labelRectWidth / 2)
                        .attr("y", 0)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "middle")
                        .style("font-family", textMetrics.fontFamily)
                        .style("font-size", textMetrics.fontSize)
                        .style("font-weight", textMetrics.fontWeight)
                        .style("fill", fillStyle.textColor) // Assuming text color contrasts with marker fill
                        .text(formattedValue);
                });
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Removed: shadow, gradient, rounded corners (for bars), spacing toggles, styled backgrounds.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}