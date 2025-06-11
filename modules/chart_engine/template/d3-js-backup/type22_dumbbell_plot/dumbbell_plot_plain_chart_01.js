/* REQUIREMENTS_BEGIN
{
  "chart_type": "Dumbbell Plot",
  "chart_name": "dumbbell_plot_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["x"],
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
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Could also check data.colors_dark if a theme mechanism was in place
    const images = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldDef = dataColumns.find(col => col.role === "x");
    const yFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    if (!xFieldDef || !yFieldDef || !groupFieldDef) {
        const missing = [
            !xFieldDef ? "x role" : null,
            !yFieldDef ? "y role" : null,
            !groupFieldDef ? "group role" : null,
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: column definitions for ${missing}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionField = xFieldDef.name;
    const valueField = yFieldDef.name;
    const groupField = groupFieldDef.name;

    const dimensionUnit = xFieldDef.unit !== "none" ? xFieldDef.unit : "";
    const valueUnit = yFieldDef.unit !== "none" ? yFieldDef.unit : "";
    // const groupUnit = groupFieldDef.unit !== "none" ? groupFieldDef.unit : ""; // Not used

    if (chartData.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#0f223b',
        gridLineColor: colors.other && colors.other.grid_line ? colors.other.grid_line : '#e0e0e0',
        axisLineColor: colors.other && colors.other.axis_line ? colors.other.axis_line : '#333333', // Not explicitly used for lines, but for label color
        primaryAccent: colors.other && colors.other.primary ? colors.other.primary : '#1f77b4',
        dumbbellLineColor: colors.other && colors.other.dumbbell_line ? colors.other.dumbbell_line : '#cccccc',
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) || '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) || 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        d3.select(tempTextNode)
            .style('font-family', fontFamily)
            .style('font-size', fontSize)
            .style('font-weight', fontWeight)
            .text(text);
        tempSvgNode.appendChild(tempTextNode);
        // Document.body.appendChild(tempSvgNode); // Temporarily append to getBBox, then remove
        const width = tempTextNode.getBBox().width;
        // Document.body.removeChild(tempSvgNode);
        return width;
    }
    
    function formatValue(value) {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI prefix
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format(",.0f")(value); // Default for smaller numbers, with comma
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

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 60, // Space for legend
        right: 20,
        bottom: 40, // Space for X-axis tick labels
        left: 100
    };

    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];

    if (groups.length !== 2) {
        const errorMsg = `Dumbbell plot requires exactly 2 groups. Found ${groups.length}: ${groups.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    
    let maxDimLabelWidth = 0;
    dimensions.forEach(dim => {
        const labelText = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight));
    });
    chartMargins.left = Math.max(chartMargins.left, maxDimLabelWidth + 15);

    let maxValueLabelWidth = 0;
    chartData.forEach(d => {
        const valText = valueUnit ? `${formatValue(d[valueField])}${valueUnit}` : formatValue(d[valueField]);
        // Estimate based on annotation font, plus padding for the rect background
        maxValueLabelWidth = Math.max(maxValueLabelWidth, estimateTextWidth(valText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight) + 40); // 40 for circle, spacing, rect padding
    });
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 15);
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions are too small. Increase container size or reduce margins/paddings.";
        console.error(errorMsg, {innerWidth, innerHeight});
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    // Data is largely used as-is, grouped by dimension in the rendering block.
    // Pre-calculating min/max values for scales:
    const valueExtent = d3.extent(chartData, d => +d[valueField]);
    const minValue = valueExtent[0];
    const maxValue = valueExtent[1];


    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.3); // Fixed padding

    const xScale = d3.scaleLinear()
        .domain([Math.min(minValue, 0) * 1.1, maxValue * 1.1]) // Adjusted padding slightly
        .range([0, innerWidth])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(
            groups.map((group, i) => {
                if (colors.field && colors.field[groupField] && colors.field[groupField][group]) {
                    return colors.field[groupField][group];
                }
                if (colors.available_colors && colors.available_colors.length > 0) {
                    return colors.available_colors[i % colors.available_colors.length];
                }
                // Fallback to a simple 2-color scheme for dumbbell
                return i % 2 === 0 ? '#1f77b4' : '#ff7f0e';
            })
        );

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - 10})`); // Position above chart

    let currentLegendX = 0;
    const legendItemPadding = 20;
    const legendCircleRadius = 6;

    groups.forEach((group, i) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, 0)`);

        itemGroup.append("circle")
            .attr("class", "mark legend-mark")
            .attr("cx", legendCircleRadius)
            .attr("cy", 0)
            .attr("r", legendCircleRadius)
            .attr("fill", colorScale(group));

        const legendText = itemGroup.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendCircleRadius * 2 + 5)
            .attr("y", 0)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);
        
        currentLegendX += legendCircleRadius * 2 + 5 + legendText.node().getBBox().width + legendItemPadding;
    });
    // Center the legend
    const legendWidth = currentLegendX - legendItemPadding;
    legendGroup.attr("transform", `translate(${(containerWidth - legendWidth) / 2}, ${chartMargins.top / 2 - 10})`);


    // Gridlines (Vertical)
    const xTicks = xScale.ticks(Math.max(2, Math.min(10, Math.floor(innerWidth / 80)))); // Dynamic number of ticks
    mainChartGroup.append("g")
        .attr("class", "grid-lines")
        .selectAll(".grid-line")
        .data(xTicks)
        .enter()
        .append("line")
        .attr("class", "grid-line vertical")
        .attr("x1", d => xScale(d))
        .attr("y1", 0)
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2");

    // X-Axis Tick Labels (at the bottom)
    mainChartGroup.append("g")
        .attr("class", "axis x-axis-labels")
        .attr("transform", `translate(0, ${innerHeight})`)
        .selectAll(".x-axis-label")
        .data(xTicks)
        .enter()
        .append("text")
        .attr("class", "label x-axis-label")
        .attr("x", d => xScale(d))
        .attr("y", 20) // Padding below grid
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => formatValue(d));
    
    const rightmostTickX = xScale(xTicks[xTicks.length - 1]);

    // Block 8: Main Data Visualization Rendering
    dimensions.forEach(dim => {
        const dimensionDataPoints = chartData.filter(d => d[dimensionField] === dim);
        const yPos = yScale(dim) + yScale.bandwidth() / 2;

        // Dimension Label (Y-axis category label)
        mainChartGroup.append("text")
            .attr("class", "label y-axis-label")
            .attr("x", -10) // Padding from the chart area
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(dimensionUnit ? `${dim}${dimensionUnit}` : dim);

        const points = groups.map(grp => {
            const dp = dimensionDataPoints.find(d => d[groupField] === grp);
            return dp ? { group: grp, value: +dp[valueField], x: xScale(+dp[valueField]), y: yPos } : null;
        }).filter(p => p !== null);

        if (points.length === 2) {
            const [p1, p2] = points.sort((a, b) => a.value - b.value); // Sort by value to draw line correctly

            // Dumbbell Line (connecting the two points)
            mainChartGroup.append("line")
                .attr("class", "mark dumbbell-line")
                .attr("x1", p1.x)
                .attr("y1", p1.y)
                .attr("x2", p2.x)
                .attr("y2", p2.y)
                .attr("stroke", fillStyle.dumbbellLineColor)
                .attr("stroke-width", 2);
            
            // Optional: Line from lowest point to rightmost tick (as in original)
            // This was a thick rect in original, now a line for consistency
            mainChartGroup.append("line")
                .attr("class", "mark dumbbell-extension-line")
                .attr("x1", p1.x) // From the point with the lower value
                .attr("y1", p1.y)
                .attr("x2", rightmostTickX) // To the last grid line
                .attr("y2", p1.y)
                .attr("stroke", fillStyle.dumbbellLineColor) // Same color as dumbbell line or a lighter one
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3");


            points.forEach(point => {
                // Dumbbell Point (Circle)
                mainChartGroup.append("circle")
                    .attr("class", "mark dumbbell-point")
                    .attr("cx", point.x)
                    .attr("cy", point.y)
                    .attr("r", 6) // Fixed radius
                    .attr("fill", colorScale(point.group))
                    .attr("stroke", fillStyle.chartBackground) // Stroke with background for "cutout" effect
                    .attr("stroke-width", 1.5);

                // Value Label
                const formattedVal = valueUnit ? `${formatValue(point.value)}${valueUnit}` : formatValue(point.value);
                const labelFontSizePx = parseFloat(fillStyle.typography.annotationFontSize);
                const dynamicFontSize = Math.min(16, Math.max(yScale.bandwidth() * 0.3, labelFontSizePx));
                
                const textNodeForMeasure = mainChartGroup.append("text") // Temporary for measurement
                    .attr("class", "label value-label-text")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${dynamicFontSize}px`)
                    .style("font-weight", "bold") // Make it bold as in original
                    .text(formattedVal)
                    .attr("visibility", "hidden");

                const textBBox = textNodeForMeasure.node().getBBox();
                textNodeForMeasure.remove();

                const labelPadding = { x: 6, y: 3 };
                const labelRectWidth = textBBox.width + labelPadding.x * 2;
                const labelRectHeight = textBBox.height + labelPadding.y * 2;
                const labelOffsetX = 10; // Distance from circle edge

                mainChartGroup.append("rect")
                    .attr("class", "value-label-background")
                    .attr("x", point.x + labelOffsetX)
                    .attr("y", point.y - labelRectHeight / 2)
                    .attr("width", labelRectWidth)
                    .attr("height", labelRectHeight)
                    .attr("rx", 3)
                    .attr("ry", 3)
                    .attr("fill", colorScale(point.group))
                    .attr("stroke", fillStyle.chartBackground)
                    .attr("stroke-width", 0.5);
                
                mainChartGroup.append("text")
                    .attr("class", "label value-label-text")
                    .attr("x", point.x + labelOffsetX + labelPadding.x)
                    .attr("y", point.y)
                    .attr("dy", "0.35em") // Vertical centering
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${dynamicFontSize}px`)
                    .style("font-weight", "bold")
                    .style("fill", "#FFFFFF") // Assuming group colors are dark enough for white text
                    .text(formattedVal);
            });
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (No further enhancements in this refactoring)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}