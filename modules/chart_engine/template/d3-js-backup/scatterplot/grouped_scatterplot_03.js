/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Scatterplot",
  "chart_name": "grouped_scatterplot_03",
  "is_composite": false,
  "required_fields": ["label", "x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[8, 150], [0, "inf"], [0, "inf"], [2, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Assuming light theme, or use a theme detector if provided
    const imagesConfig = data.images || {}; // Not used in this chart, but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const pointLabelFieldColumn = dataColumns.find(col => col.role === 'label');
    const xValueFieldColumn = dataColumns.find(col => col.role === 'x');
    const yValueFieldColumn = dataColumns.find(col => col.role === 'y');
    const groupFieldColumn = dataColumns.find(col => col.role === 'group');

    const pointLabelFieldName = pointLabelFieldColumn ? pointLabelFieldColumn.name : undefined;
    const xValueFieldName = xValueFieldColumn ? xValueFieldColumn.name : undefined;
    const yValueFieldName = yValueFieldColumn ? yValueFieldColumn.name : undefined;
    const groupFieldName = groupFieldColumn ? groupFieldColumn.name : undefined;

    const pointLabelFieldLabel = pointLabelFieldColumn && pointLabelFieldColumn.label ? pointLabelFieldColumn.label : pointLabelFieldName;
    const xValueFieldLabel = xValueFieldColumn && xValueFieldColumn.label ? xValueFieldColumn.label : xValueFieldName;
    const yValueFieldLabel = yValueFieldColumn && yValueFieldColumn.label ? yValueFieldColumn.label : yValueFieldName;
    const groupFieldLabel = groupFieldColumn && groupFieldColumn.label ? groupFieldColumn.label : groupFieldName;


    if (!pointLabelFieldName || !xValueFieldName || !yValueFieldName || !groupFieldName) {
        const missingFields = [
            !pointLabelFieldName ? "point label field (role: label)" : null,
            !xValueFieldName ? "x-value field (role: x)" : null,
            !yValueFieldName ? "y-value field (role: y)" : null,
            !groupFieldName ? "group field (role: group)" : null
        ].filter(Boolean).join(", ");

        console.error(`Critical chart config missing: [${missingFields}]. Cannot render.`);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: Critical chart configuration missing: ${missingFields}. Cannot render chart.</div>`);
        return null;
    }

    // Filter out data points with missing critical values early
    const chartDataArray = rawChartData.filter(d =>
        d[pointLabelFieldName] !== undefined && d[pointLabelFieldName] !== null &&
        d[xValueFieldName] !== undefined && d[xValueFieldName] !== null && !isNaN(parseFloat(d[xValueFieldName])) &&
        d[yValueFieldName] !== undefined && d[yValueFieldName] !== null && !isNaN(parseFloat(d[yValueFieldName])) &&
        d[groupFieldName] !== undefined && d[groupFieldName] !== null
    ).map(d => ({ // Ensure numeric types for scale domains
        ...d,
        [xValueFieldName]: parseFloat(d[xValueFieldName]),
        [yValueFieldName]: parseFloat(d[yValueFieldName]),
    }));

    if (chartDataArray.length === 0) {
        console.error("No valid data points available after filtering. Cannot render chart.");
        d3.select(containerSelector).html("<div style='color:orange; font-family: sans-serif;'>Warning: No valid data to display.</div>");
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title && typographyConfig.title.font_family ? typographyConfig.title.font_family : 'Arial, sans-serif',
            titleFontSize: typographyConfig.title && typographyConfig.title.font_size ? typographyConfig.title.font_size : '16px',
            titleFontWeight: typographyConfig.title && typographyConfig.title.font_weight ? typographyConfig.title.font_weight : 'bold',
            labelFontFamily: typographyConfig.label && typographyConfig.label.font_family ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: typographyConfig.label && typographyConfig.label.font_size ? typographyConfig.label.font_size : '12px',
            labelFontWeight: typographyConfig.label && typographyConfig.label.font_weight ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: typographyConfig.annotation && typographyConfig.annotation.font_family ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation && typographyConfig.annotation.font_size ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: typographyConfig.annotation && typographyConfig.annotation.font_weight ? typographyConfig.annotation.font_weight : 'normal',
            dataLabelFontSize: typographyConfig.label && typographyConfig.label.font_size ? typographyConfig.label.font_size : '10px', // Specific for data labels on points
        },
        textColor: colorsConfig.text_color || '#333333',
        axisLineColor: colorsConfig.text_color || '#888888', // Or a specific color like colors.other.axis
        backgroundColor: colorsConfig.background_color || '#FFFFFF',
        defaultPointOpacity: 0.75,
        highlightedPointOpacity: 1,
        getPointColor: (groupValue) => {
            if (colorsConfig.field && colorsConfig.field[groupFieldName] && colorsConfig.field[groupFieldName][groupValue]) {
                return colorsConfig.field[groupFieldName][groupValue];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                // Create a consistent mapping from groupValue to available_colors
                const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort();
                const groupIndex = groups.indexOf(groupValue);
                return colorsConfig.available_colors[groupIndex % colorsConfig.available_colors.length];
            }
            // Fallback to d3.schemeCategory10 if nothing else is available
            const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort();
            const groupIndex = groups.indexOf(groupValue);
            return d3.schemeCategory10[groupIndex % d3.schemeCategory10.length];
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM.
        // For robustness in headless environments or if getBBox on unattached SVG is problematic:
        // document.body.appendChild(tempSvg);
        const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg);
        return width;
    }

    function hasNegativeOrZeroValues(data, field) {
        return data.some(d => d[field] <= 0);
    }

    function isDistributionUneven(data, field) {
        const values = data.map(d => d[field]).sort(d3.ascending);
        if (values.length < 4) return false; // Not enough data for robust quartile calculation
        const extent = d3.extent(values);
        const range = extent[1] - extent[0];
        if (range === 0) return false; // All values are the same
        const median = d3.median(values);
        const q1 = d3.quantile(values, 0.25);
        const q3 = d3.quantile(values, 0.75);
        const iqr = q3 - q1;
        if (iqr === 0 && range > 0) return true; // Indicates sparse, possibly uneven data
        if (iqr === 0 && range === 0) return false;

        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1]) / 2) > range * 0.2;
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 750;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 70, right: 50, bottom: 60, left: 70 }; // Increased top for legend, right for labels
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const numPoints = chartDataArray.length;
    const circleRadius = numPoints <= 15 ? 10 : Math.max(5, 10 - (numPoints - 15) / 20); // Adjusted for potentially more points

    // findOptimalPosition helper (refactored)
    function findOptimalPosition(d, allPoints, currentPositions = {}, xScaleFunc, yScaleFunc, pointRadius) {
        const positions = [
            { x: pointRadius + 5, y: 0, anchor: "start", priority: 1 },  // right
            { x: 0, y: -(pointRadius + 5), anchor: "middle", priority: 2 },// top
            { x: -(pointRadius + 5), y: 0, anchor: "end", priority: 3 },   // left
            { x: 0, y: pointRadius + 12, anchor: "middle", priority: 4 }, // bottom (12 for asc/desc)
            { x: pointRadius + 5, y: -(pointRadius + 5), anchor: "start", priority: 5 }, // top-right
            { x: -(pointRadius + 5), y: -(pointRadius + 5), anchor: "end", priority: 6 }, // top-left
            { x: -(pointRadius + 5), y: pointRadius + 5, anchor: "end", priority: 7 }, // bottom-left
            { x: pointRadius + 5, y: pointRadius + 5, anchor: "start", priority: 8 }  // bottom-right
        ];

        const pointX = xScaleFunc(d[xValueFieldName]);
        const pointY = yScaleFunc(d[yValueFieldName]);

        if (currentPositions[d[pointLabelFieldName]]) {
            return currentPositions[d[pointLabelFieldName]];
        }

        const textContent = d[pointLabelFieldName] || "";
        const labelWidth = estimateTextWidth(textContent, fillStyle.typography.labelFontFamily, fillStyle.typography.dataLabelFontSize, fillStyle.typography.labelFontWeight);
        const labelHeight = parseFloat(fillStyle.typography.dataLabelFontSize); // Approx height

        for (const pos of positions) {
            let hasOverlap = false;
            let labelX1, labelY1, labelX2, labelY2;

            if (pos.anchor === "start") {
                labelX1 = pointX + pos.x;
                labelY1 = pointY + pos.y - labelHeight / 2;
            } else if (pos.anchor === "middle") {
                labelX1 = pointX + pos.x - labelWidth / 2;
                labelY1 = pointY + pos.y - (pos.y < 0 ? labelHeight : -labelHeight*0.2) ; // Adjust for anchor middle baseline
            } else { // end
                labelX1 = pointX + pos.x - labelWidth;
                labelY1 = pointY + pos.y - labelHeight / 2;
            }
            labelX2 = labelX1 + labelWidth;
            labelY2 = labelY1 + labelHeight;

            if (labelX1 < 0 || labelX2 > innerWidth || labelY1 < 0 || labelY2 > innerHeight) {
                continue;
            }

            for (const p of allPoints) {
                if (p === d) continue;
                const pX = xScaleFunc(p[xValueFieldName]);
                const pY = yScaleFunc(p[yValueFieldName]);

                // Check overlap with other points
                const dxPt = (labelX1 + labelX2) / 2 - pX;
                const dyPt = (labelY1 + labelY2) / 2 - pY;
                const distPt = Math.sqrt(dxPt * dxPt + dyPt * dyPt);
                if (distPt < pointRadius + Math.max(labelWidth, labelHeight) / 2) { // Simplified check
                    hasOverlap = true;
                    break;
                }

                // Check overlap with other labels
                const pPos = currentPositions[p[pointLabelFieldName]];
                if (pPos && pPos.canShow) {
                    const otherTextContent = p[pointLabelFieldName] || "";
                    const otherLabelWidth = estimateTextWidth(otherTextContent, fillStyle.typography.labelFontFamily, fillStyle.typography.dataLabelFontSize, fillStyle.typography.labelFontWeight);
                    const otherLabelHeight = parseFloat(fillStyle.typography.dataLabelFontSize);
                    
                    let otherX1, otherY1;
                    if (pPos.anchor === "start") {
                        otherX1 = pX + pPos.x;
                        otherY1 = pY + pPos.y - otherLabelHeight / 2;
                    } else if (pPos.anchor === "middle") {
                        otherX1 = pX + pPos.x - otherLabelWidth / 2;
                        otherY1 = pY + pPos.y - (pPos.y < 0 ? otherLabelHeight : -otherLabelHeight*0.2);
                    } else { // end
                        otherX1 = pX + pPos.x - otherLabelWidth;
                        otherY1 = pY + pPos.y - otherLabelHeight / 2;
                    }
                    const otherX2 = otherX1 + otherLabelWidth;
                    const otherY2 = otherY1 + otherLabelHeight;

                    if (labelX1 < otherX2 && labelX2 > otherX1 && labelY1 < otherY2 && labelY2 > otherY1) {
                        hasOverlap = true;
                        break;
                    }
                }
            }
            if (!hasOverlap) return { ...pos, canShow: true };
        }
        return { ...positions[0], canShow: false }; // Default to first position, hidden
    }

    // Block 5: Data Preprocessing & Transformation
    // Data already filtered and types converted in Block 1.

    // Block 6: Scale Definition & Configuration
    const xExtent = d3.extent(chartDataArray, d => d[xValueFieldName]);
    const yExtent = d3.extent(chartDataArray, d => d[yValueFieldName]);

    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartDataArray, xValueFieldName);
    const xIsUneven = isDistributionUneven(chartDataArray, xValueFieldName);
    const xScale = (!xHasNegativeOrZero && xIsUneven)
        ? d3.scaleLog()
            .domain([Math.max(xExtent[0] * 0.9, 0.01), xExtent[1] * 1.1]) // Ensure domain > 0 for log
            .range([0, innerWidth])
        : d3.scaleLinear()
            .domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1])
            .range([0, innerWidth]);

    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartDataArray, yValueFieldName);
    const yIsUneven = isDistributionUneven(chartDataArray, yValueFieldName);
    const yScale = (!yHasNegativeOrZero && yIsUneven)
        ? d3.scaleLog()
            .domain([Math.max(yExtent[0] * 0.9, 0.01), yExtent[1] * 1.1]) // Ensure domain > 0 for log
            .range([innerHeight, 0])
        : d3.scaleLinear()
            .domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1])
            .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    const yAxis = d3.axisLeft(yScale).tickSize(0).tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);
    xAxisGroup.selectAll("path")
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1)
        .style("opacity", 0.7);
    xAxisGroup.selectAll("text")
        .attr("class", "label axis-tick-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);
    yAxisGroup.selectAll("path")
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1)
        .style("opacity", 0.7);
    yAxisGroup.selectAll("text")
        .attr("class", "label axis-tick-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);

    if (xValueFieldLabel) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title x-axis-title")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight + chartMargins.bottom / 2 + 10)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(xValueFieldLabel);
    }

    if (yValueFieldLabel) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title y-axis-title")
            .attr("transform", "rotate(-90)")
            .attr("x", -innerHeight / 2)
            .attr("y", -chartMargins.left / 2 - 10)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(yValueFieldLabel);
    }

    // Legend
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort();
    if (groups.length > 0) {
        const legendContainer = svgRoot.append("g")
            .attr("class", "legend chart-legend")
            .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - 10})`); // Position above chart

        const initialLegendFontSize = parseFloat(fillStyle.typography.labelFontSize);
        const legendFontWeight = fillStyle.typography.labelFontWeight;
        const legendFontFamily = fillStyle.typography.labelFontFamily;
        const legendItemPadding = 5;
        const legendColumnPadding = 15;
        const legendMinimumFontSize = 9;
        const legendRowPadding = 5;
        const legendMarkRadius = Math.min(circleRadius, 6); // Smaller marks for legend

        let legendItems = groups.map(group => {
            const textWidth = estimateTextWidth(group, legendFontFamily, `${initialLegendFontSize}px`, legendFontWeight);
            return {
                group: group,
                textWidth: textWidth,
                itemWidth: (legendMarkRadius * 2) + legendItemPadding + textWidth
            };
        });

        let totalLegendWidth = legendItems.reduce((sum, item) => sum + item.itemWidth, 0) + (legendItems.length - 1) * legendColumnPadding;
        
        const maxAllowedLegendWidth = innerWidth * 0.95;
        let currentFontSize = initialLegendFontSize;

        if (totalLegendWidth > maxAllowedLegendWidth) {
            const scaleFactor = maxAllowedLegendWidth / totalLegendWidth;
            currentFontSize = Math.max(legendMinimumFontSize, initialLegendFontSize * scaleFactor * 0.9); // *0.9 for buffer
            
            legendItems = groups.map(group => {
                const textWidth = estimateTextWidth(group, legendFontFamily, `${currentFontSize}px`, legendFontWeight);
                return {
                    group: group,
                    textWidth: textWidth,
                    itemWidth: (legendMarkRadius * 2) + legendItemPadding + textWidth
                };
            });
            totalLegendWidth = legendItems.reduce((sum, item) => sum + item.itemWidth, 0) + (legendItems.length - 1) * legendColumnPadding;
        }
        
        // Simple single-row, centered legend for now. Multi-row can be complex.
        const legendStartX = (innerWidth - totalLegendWidth) / 2;
        let currentX = legendStartX;

        if (groupFieldLabel) {
             legendContainer.append("text")
                .attr("class", "label legend-title")
                .attr("x", innerWidth / 2)
                .attr("y", -15) // Position above legend items
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.titleFontFamily) // Use title font for legend title
                .style("font-size", `${Math.min(parseFloat(fillStyle.typography.titleFontSize), currentFontSize + 2)}px`)
                .style("font-weight", fillStyle.typography.titleFontWeight)
                .style("fill", fillStyle.textColor)
                .text(groupFieldLabel);
        }

        legendItems.forEach(item => {
            const legendItemG = legendContainer.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, 0)`);

            legendItemG.append("circle")
                .attr("class", "mark legend-mark")
                .attr("cx", legendMarkRadius)
                .attr("cy", 0) // Align with text baseline
                .attr("r", legendMarkRadius)
                .style("fill", fillStyle.getPointColor(item.group))
                .style("opacity", fillStyle.defaultPointOpacity);

            legendItemG.append("text")
                .attr("class", "label legend-label")
                .attr("x", (legendMarkRadius * 2) + legendItemPadding)
                .attr("y", 0) // Align with text baseline
                .attr("dominant-baseline", "middle")
                .style("font-family", legendFontFamily)
                .style("font-size", `${currentFontSize}px`)
                .style("font-weight", legendFontWeight)
                .style("fill", fillStyle.textColor)
                .text(item.group);
            
            currentX += item.itemWidth + legendColumnPadding;
        });
    }


    // Block 8: Main Data Visualization Rendering
    const pointLabelPositions = {};
    chartDataArray.forEach(d => {
        pointLabelPositions[d[pointLabelFieldName]] = findOptimalPosition(d, chartDataArray, pointLabelPositions, xScale, yScale, circleRadius);
    });

    const dataPointsGroup = mainChartGroup.append("g").attr("class", "data-points-group");

    const pointGroups = dataPointsGroup.selectAll(".data-point-group")
        .data(chartDataArray, d => d[pointLabelFieldName]) // Use a key for object constancy
        .enter()
        .append("g")
        .attr("class", "mark data-point-group")
        .attr("transform", d => `translate(${xScale(d[xValueFieldName])}, ${yScale(d[yValueFieldName])})`);

    pointGroups.append("circle")
        .attr("class", "mark point-circle")
        .attr("r", circleRadius)
        .style("fill", d => fillStyle.getPointColor(d[groupFieldName]))
        .style("opacity", fillStyle.defaultPointOpacity);

    pointGroups.append("text")
        .attr("class", "label data-label")
        .attr("x", d => pointLabelPositions[d[pointLabelFieldName]].x)
        .attr("y", d => pointLabelPositions[d[pointLabelFieldName]].y)
        .attr("text-anchor", d => pointLabelPositions[d[pointLabelFieldName]].anchor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.dataLabelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("opacity", d => pointLabelPositions[d[pointLabelFieldName]].canShow ? 1 : 0)
        .text(d => d[pointLabelFieldName]);

    // Block 9: Optional Enhancements & Post-Processing
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip chart-tooltip") // Standardized class
        .style("opacity", 0)
        .style("position", "absolute")
        .style("padding", "8px")
        .style("background-color", "rgba(0,0,0,0.75)")
        .style("color", "white")
        .style("border-radius", "4px")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("pointer-events", "none"); // Prevent tooltip from interfering with mouse events

    pointGroups
        .on("mouseover", function(event, d) {
            d3.select(this).select(".point-circle")
                .transition().duration(100)
                .attr("r", circleRadius * 1.5)
                .style("opacity", fillStyle.highlightedPointOpacity);
            
            d3.select(this).select(".data-label")
                .style("font-weight", "bold")
                .style("opacity", 1); // Ensure label is visible on hover

            tooltip.transition().duration(100).style("opacity", 0.9);
            tooltip.html(
                `<strong>${d[pointLabelFieldName]}</strong><br/>` +
                `${xValueFieldLabel || xValueFieldName}: ${d[xValueFieldName]}<br/>` +
                `${yValueFieldLabel || yValueFieldName}: ${d[yValueFieldName]}` +
                (groupFieldLabel ? `<br/>${groupFieldLabel}: ${d[groupFieldName]}` : "")
            )
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).select(".point-circle")
                .transition().duration(100)
                .attr("r", circleRadius)
                .style("opacity", fillStyle.defaultPointOpacity);
            
            const d = d3.select(this).datum(); // Get datum for this element
            d3.select(this).select(".data-label")
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("opacity", pointLabelPositions[d[pointLabelFieldName]].canShow ? 1 : 0); // Restore original opacity

            tooltip.transition().duration(300).style("opacity", 0);
        });

    // Block 10: Cleanup & SVG Node Return
    // Tooltip is on body, will persist. For single page apps, manage its lifecycle.
    return svgRoot.node();
}