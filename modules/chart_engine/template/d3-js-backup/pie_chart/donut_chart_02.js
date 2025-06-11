/* REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "detailed",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assumes light theme, or dark theme handled by caller
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x field (category)");
        if (!valueFieldName) missingFields.push("y field (value)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("padding", "10px")
                .html(errorMsg);
        }
        return null;
    }

    let valueUnit = dataColumns.find(col => col.role === "y")?.unit || "";
    if (valueUnit === "none") valueUnit = "";

    const chartDataArray = rawChartData.filter(d => d[valueFieldName] != null && !isNaN(parseFloat(d[valueFieldName])) && parseFloat(d[valueFieldName]) >= 0);

    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points available to render the chart.";
        console.error(errorMsg);
        if (containerSelector) {
             d3.select(containerSelector).append("div")
                .style("color", "orange")
                .style("padding", "10px")
                .html(errorMsg);
        }
        return null;
    }

    const totalY = d3.sum(chartDataArray, d => +d[valueFieldName]);
    if (totalY <= 0) {
        const errorMsg = "Sum of all values must be greater than 0.";
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "orange")
                .style("padding", "10px")
                .html(errorMsg);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        legendTextColor: colors.text_color || '#0F223B',
        defaultSliceColor: '#CCCCCC', // Fallback if no other color found after checking field & available_colors
        chartBackground: colors.background_color || 'transparent', // Default to transparent if not specified
        typography: {
            legendLabelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            legendLabelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            legendLabelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // No need to append tempSvg to DOM for getBBox to work in modern browsers
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            console.warn("Failed to measure text width for: '" + text + "'. Using an estimate.", e);
            width = (text ? text.length : 0) * (parseFloat(fontSize) || 12) * 0.6; // Rough fallback
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
        .attr("class", "donut-chart-container")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { // Outer margins for the whole chart area
        top: variables.margin_top || 20,
        right: variables.margin_right || 20,
        bottom: variables.margin_bottom || 20,
        left: variables.margin_left || 20
    };

    // Legend layout constants
    const legendMarkerRadius = variables.legend_marker_radius || 6;
    const idealIconSizeRatio = 1.1;
    const minIconSize = variables.legend_min_icon_size || 10;
    const legendPaddingIconToValue = variables.legend_padding_icon_value || 8; // Renamed from padding2
    const legendPaddingValueToLabel = variables.legend_padding_value_label || 8; // Renamed from padding3
    const legendPaddingMarkerToIcon = variables.legend_padding_marker_icon || 8; // Renamed from padding1
    const legendVerticalPaddingRatio = 0.4; // For item height calculation
    const legendRightPadding = variables.legend_right_padding || 30; // Space between legend and pie area

    const legendLabelFontSize = parseFloat(fillStyle.typography.legendLabelFontSize);

    // Measure max value and label widths for legend
    let maxValueWidth = 0;
    let maxLabelWidth = 0;
    chartDataArray.forEach(d => {
        const valueText = `${d[valueFieldName]}${valueUnit}`;
        maxValueWidth = Math.max(maxValueWidth, estimateTextWidth(valueText, fillStyle.typography.legendLabelFontFamily, fillStyle.typography.legendLabelFontSize, fillStyle.typography.legendLabelFontWeight));
        const labelText = d[categoryFieldName];
        maxLabelWidth = Math.max(maxLabelWidth, estimateTextWidth(labelText, fillStyle.typography.legendLabelFontFamily, fillStyle.typography.legendLabelFontSize, fillStyle.typography.legendLabelFontWeight));
    });

    // Calculate legend item height and icon size (dynamic adjustment)
    const idealIconSize = Math.max(minIconSize, legendLabelFontSize * idealIconSizeRatio);
    const idealItemHeight = Math.max(legendLabelFontSize, idealIconSize) * (1 + legendVerticalPaddingRatio);
    const absoluteMinItemHeight = Math.max(16, legendLabelFontSize + 4, minIconSize + 4);

    const legendAvailableHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const maxHeightPerItem = legendAvailableHeight / chartDataArray.length;

    let finalLegendItemHeight = Math.max(absoluteMinItemHeight, Math.min(idealItemHeight, maxHeightPerItem));
    let finalIconSize;
    if (finalLegendItemHeight < idealItemHeight && idealItemHeight > 0) { // Added idealItemHeight > 0 to prevent division by zero
        finalIconSize = Math.max(minIconSize, finalLegendItemHeight * (idealIconSize / idealItemHeight));
    } else {
        finalIconSize = idealIconSize;
        finalLegendItemHeight = idealItemHeight; // Use ideal height if space allows
    }
    
    const totalActualLegendHeight = finalLegendItemHeight * chartDataArray.length;
    const legendStartY = chartMargins.top + (legendAvailableHeight - totalActualLegendHeight) / 2; // Vertically center legend block

    const legendContentWidth = (legendMarkerRadius * 2) + legendPaddingMarkerToIcon + finalIconSize + legendPaddingIconToValue + maxValueWidth + legendPaddingValueToLabel + maxLabelWidth;

    // Pie area calculations
    const pieAreaXStart = chartMargins.left + legendContentWidth + legendRightPadding;
    const pieAvailableWidth = containerWidth - pieAreaXStart - chartMargins.right;
    const pieAvailableHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (pieAvailableWidth <= 0 || pieAvailableHeight <= 0) {
        svgRoot.remove();
        const errorMsg = "Not enough space to render the pie chart next to the legend. Please increase width or height, or reduce legend content size.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("padding", "10px")
                .html(errorMsg);
        }
        return null;
    }

    const pieOuterRadius = Math.min(pieAvailableWidth, pieAvailableHeight) / 2;
    const pieInnerRadiusRatio = typeof variables.innerRadiusRatio === 'number' ? variables.innerRadiusRatio : 0.6;
    const pieInnerRadius = pieOuterRadius * pieInnerRadiusRatio;
    
    const pieCenterX = pieAreaXStart + pieAvailableWidth / 2;
    const pieCenterY = chartMargins.top + pieAvailableHeight / 2;

    // Block 5: Data Preprocessing & Transformation
    // Sort data by value descending for legend and consistent pie rendering
    const processedData = [...chartDataArray].sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);

    // Block 6: Scale Definition & Configuration
    const uniqueCategories = Array.from(new Set(processedData.map(d => d[categoryFieldName])));
    const colorScale = d3.scaleOrdinal();
    const rangeColors = uniqueCategories.map((category, i) => {
        if (colors.field && colors.field[category]) {
            return colors.field[category];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[i % colors.available_colors.length];
        }
        // Fallback to d3.schemeCategory10 if specific and available_colors are not sufficient
        return d3.schemeCategory10[i % d3.schemeCategory10.length];
    });
    colorScale.domain(uniqueCategories).range(rangeColors);

    const pieGenerator = d3.pie()
        .value(d => +d[valueFieldName])
        .sort(null) // Use data order (already sorted by value)
        .padAngle(variables.padAngle || 0);

    const arcGenerator = d3.arc()
        .innerRadius(pieInnerRadius)
        .outerRadius(pieOuterRadius)
        .cornerRadius(variables.cornerRadius || 0);

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend detailed-legend")
        .attr("transform", `translate(${chartMargins.left}, ${legendStartY})`);

    processedData.forEach((d, i) => {
        const itemY = i * finalLegendItemHeight;
        const itemCenterY = itemY + finalLegendItemHeight / 2;

        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${itemY})`);

        // 1. Color marker
        legendItem.append("circle")
            .attr("class", "mark legend-marker")
            .attr("cx", legendMarkerRadius)
            .attr("cy", itemCenterY)
            .attr("r", legendMarkerRadius)
            .attr("fill", colorScale(d[categoryFieldName]));

        // 2. Icon
        const iconX = (legendMarkerRadius * 2) + legendPaddingMarkerToIcon;
        const iconUrl = images.field && images.field[d[categoryFieldName]] ? images.field[d[categoryFieldName]] : (images.other && images.other[d[categoryFieldName]] ? images.other[d[categoryFieldName]] : null);
        if (iconUrl) {
            legendItem.append("image")
                .attr("class", "icon legend-icon")
                .attr("x", iconX)
                .attr("y", itemCenterY - finalIconSize / 2)
                .attr("width", finalIconSize)
                .attr("height", finalIconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
        }
        
        // 3. Value text
        const valueX = iconX + finalIconSize + legendPaddingIconToValue + maxValueWidth;
        legendItem.append("text")
            .attr("class", "text legend-value")
            .attr("x", valueX)
            .attr("y", itemCenterY)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.legendLabelFontFamily)
            .style("font-size", fillStyle.typography.legendLabelFontSize)
            .style("font-weight", fillStyle.typography.legendLabelFontWeight)
            .style("fill", fillStyle.legendTextColor)
            .text(`${d[valueFieldName]}${valueUnit}`);

        // 4. Label text
        const labelX = valueX + legendPaddingValueToLabel;
        legendItem.append("text")
            .attr("class", "text legend-label")
            .attr("x", labelX)
            .attr("y", itemCenterY)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.legendLabelFontFamily)
            .style("font-size", fillStyle.typography.legendLabelFontSize)
            .style("font-weight", fillStyle.typography.legendLabelFontWeight)
            .style("fill", fillStyle.legendTextColor)
            .text(d[categoryFieldName]);
    });

    // Block 8: Main Data Visualization Rendering (Donut Slices)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-body donut-chart")
        .attr("transform", `translate(${pieCenterX}, ${pieCenterY})`);

    const sliceElements = mainChartGroup.selectAll(".donut-slice")
        .data(pieGenerator(processedData))
        .join("path")
        .attr("class", "mark donut-slice")
        .attr("d", arcGenerator)
        .attr("fill", d => colorScale(d.data[categoryFieldName]))
        .style("stroke", variables.slice_stroke_color || "none")
        .style("stroke-width", variables.slice_stroke_width || 0);

    // Block 9: Optional Enhancements & Post-Processing
    if (variables.enable_slice_hover_effect !== false) { // Default to true
        sliceElements
            .on("mouseover", function(event, d) {
                d3.select(this)
                  .transition().duration(150)
                  .attr("transform", `scale(${variables.slice_hover_scale || 1.03})`);
            })
            .on("mouseout", function(event, d) {
                d3.select(this)
                  .transition().duration(150)
                  .attr("transform", "scale(1.0)");
            });
    }
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}