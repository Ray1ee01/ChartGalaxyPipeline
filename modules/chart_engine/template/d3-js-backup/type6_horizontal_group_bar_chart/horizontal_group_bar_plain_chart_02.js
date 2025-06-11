/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Horizontal Bar Chart",
  "chart_name": "grouped_horizontal_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Allow data.colors_dark as a source
    const imagesInput = data.images || {}; // Extract images config, though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xCol = dataColumns.find(col => col.role === "x");
    const yCol = dataColumns.find(col => col.role === "y");
    const groupCol = dataColumns.find(col => col.role === "group");

    const xFieldName = xCol?.name;
    const yFieldName = yCol?.name;
    const groupFieldName = groupCol?.name;

    const xFieldUnit = xCol?.unit && xCol.unit !== "none" ? xCol.unit : "";
    const yFieldUnit = yCol?.unit && yCol.unit !== "none" ? yCol.unit : "";
    // const groupFieldUnit = groupCol?.unit && groupCol.unit !== "none" ? groupCol.unit : ""; // Group unit not typically displayed

    const criticalFields = { xFieldName, yFieldName, groupFieldName };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')} from data.data.columns. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMessage);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyInput.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyInput.label?.font_size || "12px",
            labelFontWeight: typographyInput.label?.font_weight || "normal",
            annotationFontFamily: typographyInput.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyInput.annotation?.font_size || "10px",
            annotationFontWeight: typographyInput.annotation?.font_weight || "normal",
        },
        textColor: colorsInput.text_color || "#333333",
        chartBackground: colorsInput.background_color || "#FFFFFF", // Not used directly on SVG, but available
        defaultCategoricalColors: d3.schemeCategory10,
    };

    fillStyle.getColor = (groupValue, index) => {
        if (colorsInput.field && colorsInput.field[groupFieldName] && colorsInput.field[groupFieldName][groupValue]) {
            return colorsInput.field[groupFieldName][groupValue];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[index % colorsInput.available_colors.length];
        }
        return fillStyle.defaultCategoricalColors[index % fillStyle.defaultCategoricalColors.length];
    };
    
    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox, but trying without first.
        // If issues, uncomment below:
        // document.body.appendChild(tempSvg);
        const width = tempText.getBBox().width;
        // if (tempSvg.parentNode === document.body) document.body.removeChild(tempSvg);
        return width;
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.1f")(value / 1000) + "K";
        return d3.format("~g")(value);
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
        .style("background-color", fillStyle.chartBackground); // Optional: apply background color

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 60, // Increased for legend
        right: 30,
        bottom: 40,
        left: 60
    };

    const dimensions = [...new Set(chartDataInput.map(d => d[xFieldName]))];
    const groups = [...new Set(chartDataInput.map(d => d[groupFieldName]))];

    let maxDimensionLabelWidth = 0;
    dimensions.forEach(dim => {
        const labelText = `${dim}${xFieldUnit}`;
        const width = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (width > maxDimensionLabelWidth) maxDimensionLabelWidth = width;
    });
    chartMargins.left = Math.max(chartMargins.left, maxDimensionLabelWidth + 15);

    let maxValueLabelWidth = 0;
    chartDataInput.forEach(d => {
        const valueText = `${formatValue(d[yFieldName])}${yFieldUnit}`;
        const width = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        if (width > maxValueLabelWidth) maxValueLabelWidth = width;
    });
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 10);
    
    const legendItemPadding = 10;
    const legendRectSize = 15;
    const legendRectTextGap = 5;
    let totalLegendWidth = 0;
    const legendItemWidths = groups.map(group => {
        const textWidth = estimateTextWidth(group, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        const itemWidth = legendRectSize + legendRectTextGap + textWidth;
        return itemWidth;
    });
    totalLegendWidth = legendItemWidths.reduce((sum, width) => sum + width, 0) + Math.max(0, groups.length - 1) * legendItemPadding;
    
    // Adjust top margin if legend is too wide and needs more space or wrapping (not implemented: wrapping)
    if (totalLegendWidth > containerWidth - chartMargins.left - chartMargins.right) {
        // Simple adjustment, could be more sophisticated
        chartMargins.top = Math.max(chartMargins.top, 80); 
    }


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Cannot render chart.");
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .html("Chart dimensions are too small for the given data or margins.");
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    // Data already in chartDataInput, dimensions, and groups.
    // Max value for scale domain calculation is done in Block 6.

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.2); // Fixed padding

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataInput, d => +d[yFieldName]) || 0])
        .range([0, innerWidth])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => fillStyle.getColor(group, i)));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Render Y-axis category labels
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    dimensions.forEach(dim => {
        yAxisGroup.append("text")
            .attr("class", "label axis-label y-axis-label")
            .attr("x", -10)
            .attr("y", yScale(dim) + yScale.bandwidth() / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(`${dim}${xFieldUnit}`);
    });
    
    // Render Legend
    if (groups.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend-group other")
            .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2})`);

        let currentX = 0;
        groups.forEach((group, i) => {
            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, 0)`);

            legendItem.append("rect")
                .attr("class", "mark legend-mark")
                .attr("width", legendRectSize)
                .attr("height", legendRectSize)
                .attr("fill", colorScale(group));

            legendItem.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendRectSize + legendRectTextGap)
                .attr("y", legendRectSize / 2)
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(group);
            
            currentX += legendItemWidths[i] + legendItemPadding;
        });
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const dimensionGroups = mainChartGroup.selectAll(".dimension-group")
        .data(dimensions)
        .join("g")
        .attr("class", "dimension-group")
        .attr("transform", d => `translate(0, ${yScale(d)})`);

    dimensionGroups.each(function(dimension) {
        const dimensionData = chartDataInput.filter(item => item[xFieldName] === dimension);
        const groupBarHeight = yScale.bandwidth() / groups.length;

        d3.select(this).selectAll(".bar-mark")
            .data(groups)
            .join("rect")
            .attr("class", "mark bar-mark")
            .attr("x", 0)
            .attr("y", (group, i) => i * groupBarHeight)
            .attr("width", group => {
                const dataPoint = dimensionData.find(d => d[groupFieldName] === group);
                return dataPoint ? xScale(Math.max(0, +dataPoint[yFieldName])) : 0;
            })
            .attr("height", groupBarHeight)
            .attr("fill", group => colorScale(group))
            .on("mouseover", function() {
                d3.select(this).attr("opacity", 0.8);
            })
            .on("mouseout", function() {
                d3.select(this).attr("opacity", 1);
            });

        d3.select(this).selectAll(".data-value-label")
            .data(groups)
            .join("text")
            .attr("class", "value data-value-label")
            .attr("x", group => {
                const dataPoint = dimensionData.find(d => d[groupFieldName] === group);
                return dataPoint ? xScale(Math.max(0, +dataPoint[yFieldName])) + 5 : 5;
            })
            .attr("y", (group, i) => (i * groupBarHeight) + groupBarHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group => {
                const dataPoint = dimensionData.find(d => d[groupFieldName] === group);
                return dataPoint ? `${formatValue(+dataPoint[yFieldName])}${yFieldUnit}` : "";
            });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Hover effects are included in Block 8. No other enhancements here.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}