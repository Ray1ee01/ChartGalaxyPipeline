/* REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data; // Renaming for clarity
    const chartDataArray = chartConfig.data && chartConfig.data.data ? chartConfig.data.data : [];
    const variables = chartConfig.variables || {};
    const dataColumns = chartConfig.data && chartConfig.data.columns ? chartConfig.data.columns : [];
    
    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !valueColumn) {
        const missing = [];
        if (!categoryColumn) missing.push("category field (role: 'x')");
        if (!valueColumn) missing.push("value field (role: 'y')");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    const rawTypography = chartConfig.typography || {};
    const rawColors = chartConfig.colors || chartConfig.colors_dark || {}; // Assuming colors_dark is an alternative
    const rawImages = chartConfig.images || {};

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || "Arial, sans-serif",
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || "12px",
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || "normal",
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || "Arial, sans-serif",
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || "10px",
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || "normal",
            legendTitleFontFamily: (rawTypography.title && rawTypography.title.font_family) || "Arial, sans-serif", // Using title for legend title
            legendTitleFontSize: (rawTypography.title && rawTypography.title.font_size) || "14px",
            legendTitleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || "bold",
        },
        textColor: rawColors.text_color || "#333333",
        chartBackground: rawColors.background_color || "#FFFFFF",
        sliceStrokeColor: "#FFFFFF", // Standard white stroke for slices
        defaultSliceColor: (rawColors.other && rawColors.other.primary) || "#1f77b4",
        defaultAvailableColors: rawColors.available_colors || d3.schemeCategory10,
    };

    function parseFontSizeToNumber(fontSizeStr) {
        return parseFloat(fontSizeStr) || 12;
    }
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.visibility = 'hidden'; // Ensure it's not visible if appended
        // tempSvg.style.position = 'absolute'; // Ensure it doesn't affect layout if appended
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // document.body.appendChild(tempSvg); // Not appending to DOM as per spec
        const width = textElement.getBBox().width;
        // document.body.removeChild(tempSvg);
        return width;
    }

    function getColor(categoryValue, index) {
        if (rawColors.field && rawColors.field[categoryValue]) {
            return rawColors.field[categoryValue];
        }
        if (fillStyle.defaultAvailableColors && fillStyle.defaultAvailableColors.length > 0) {
            return fillStyle.defaultAvailableColors[index % fillStyle.defaultAvailableColors.length];
        }
        return fillStyle.defaultSliceColor;
    }

    function getImageUrl(categoryValue) {
        if (rawImages.field && rawImages.field[categoryValue]) {
            return rawImages.field[categoryValue];
        }
        if (rawImages.other && rawImages.other.primary) {
            return rawImages.other.primary; // Fallback to a generic primary icon
        }
        return null;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 40, bottom: 60, left: 40 }; // Increased top/bottom for legend/labels
    
    // Legend properties
    const legendItemHeight = 20;
    const legendIconSize = 16;
    const legendPadding = 5; // Padding between icon, text, and rect
    const legendGroupSpacing = 10; // Horizontal space between legend items
    const legendTitleMarginBottom = 10;

    // Estimate legend height (simplified: assuming single line legend for now)
    let estimatedLegendHeight = 0;
    if (variables.show_legend !== false) { // Assuming legend is shown by default
        estimatedLegendHeight = legendItemHeight + legendTitleMarginBottom + parseFontSizeToNumber(fillStyle.typography.legendTitleFontSize);
        chartMargins.top = Math.max(chartMargins.top, estimatedLegendHeight + 20); // Ensure enough space for legend
    }
    
    const chartRenderWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartRenderHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const radius = Math.min(chartRenderWidth, chartRenderHeight) / 2;
    const donutInnerRadius = radius * 0.5; // Standard donut proportion
    const donutOuterRadius = radius;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${chartMargins.top + chartRenderHeight / 2})`);

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => d[valueFieldName]);
    const processedChartData = chartDataArray.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (d[valueFieldName] / totalValue) * 100 : 0
    }));

    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null); // No sorting, maintain original order

    const pieData = pieGenerator(processedChartData);

    // Block 6: Scale Definition & Configuration
    const arcGenerator = d3.arc()
        .innerRadius(donutInnerRadius)
        .outerRadius(donutOuterRadius)
        .padAngle(0.01); // Small pad angle for visual separation

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    if (variables.show_legend !== false) {
        const legendContainerGroup = svgRoot.append("g")
            .attr("class", "legend other") // Standardized class
            .attr("transform", `translate(${chartMargins.left}, 20)`); // Position legend at top-left margin area

        const legendTitle = legendContainerGroup.append("text")
            .attr("class", "text legend-title")
            .attr("x", 0)
            .attr("y", 0)
            .attr("dy", "0.71em") // Vertically center-ish
            .style("font-family", fillStyle.typography.legendTitleFontFamily)
            .style("font-size", fillStyle.typography.legendTitleFontSize)
            .style("font-weight", fillStyle.typography.legendTitleFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryColumn.label || categoryFieldName); // Use label from dataColumns if available

        const legendTitleHeight = legendTitle.node() ? legendTitle.node().getBBox().height : parseFontSizeToNumber(fillStyle.typography.legendTitleFontSize);
        
        const legendItemsGroup = legendContainerGroup.append("g")
            .attr("transform", `translate(0, ${legendTitleHeight + legendTitleMarginBottom})`);

        let currentX = 0;
        const uniqueCategories = Array.from(new Set(processedChartData.map(d => d[categoryFieldName])));

        uniqueCategories.forEach((category, i) => {
            const itemGroup = legendItemsGroup.append("g")
                .attr("class", "legend-item other")
                .attr("transform", `translate(${currentX}, 0)`);

            const itemColor = getColor(category, i);
            const itemImageUrl = getImageUrl(category);

            let itemContentX = 0;

            if (itemImageUrl) {
                itemGroup.append("image")
                    .attr("class", "icon legend-icon")
                    .attr("xlink:href", itemImageUrl)
                    .attr("x", itemContentX)
                    .attr("y", (legendItemHeight - legendIconSize) / 2)
                    .attr("width", legendIconSize)
                    .attr("height", legendIconSize);
                itemContentX += legendIconSize + legendPadding;
            }

            itemGroup.append("rect")
                .attr("class", "mark legend-swatch")
                .attr("x", itemContentX)
                .attr("y", (legendItemHeight - legendIconSize) / 2) // Align with icon
                .attr("width", legendIconSize)
                .attr("height", legendIconSize)
                .style("fill", itemColor);
            itemContentX += legendIconSize + legendPadding;

            const legendTextElement = itemGroup.append("text")
                .attr("class", "text legend-label")
                .attr("x", itemContentX)
                .attr("y", legendItemHeight / 2)
                .attr("dy", "0.35em") // Vertical alignment
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(category);
            
            const itemWidth = itemContentX + legendTextElement.node().getBBox().width;
            currentX += itemWidth + legendGroupSpacing;
        });
        
        // Center the legend items group if it doesn't exceed chartRenderWidth
        const legendItemsWidth = currentX - legendGroupSpacing; // Total width of all items
        if (legendItemsWidth < chartRenderWidth) {
            const legendGroupXOffset = (chartRenderWidth - legendItemsWidth) / 2;
             // Also adjust legend title to be centered above items
            const legendTitleWidth = legendTitle.node() ? legendTitle.node().getBBox().width : 0;
            legendTitle.attr("x", legendGroupXOffset + (legendItemsWidth - legendTitleWidth) / 2 );

            legendItemsGroup.attr("transform", `translate(${legendGroupXOffset}, ${legendTitleHeight + legendTitleMarginBottom})`);
        }
    }


    // Block 8: Main Data Visualization Rendering
    const sliceGroups = mainChartGroup.selectAll("g.slice-group")
        .data(pieData)
        .join("g")
        .attr("class", "slice-group mark");

    sliceGroups.append("path")
        .attr("class", "mark donut-slice")
        .attr("d", arcGenerator)
        .attr("fill", (d, i) => getColor(d.data[categoryFieldName], i))
        .attr("stroke", fillStyle.sliceStrokeColor)
        .attr("stroke-width", 2);

    // Add data labels (category and percentage)
    sliceGroups.each(function(d, i) {
        if (d.data.percentage < 1) return; // Hide labels for very small slices (e.g. < 1%)

        const group = d3.select(this);
        const centroid = arcGenerator.centroid(d);
        
        // Position labels outside the arc
        const midAngle = (d.startAngle + d.endAngle) / 2;
        const labelRadius = donutOuterRadius + 20; // Distance from center for labels
        const x = Math.sin(midAngle) * labelRadius;
        const y = -Math.cos(midAngle) * labelRadius;

        const textAnchor = (midAngle < Math.PI) ? "start" : "end";
        const labelOffset = (midAngle < Math.PI) ? 5 : -5; // Small offset from the point for better readability

        // Category Label
        group.append("text")
            .attr("class", "text data-label category-label")
            .attr("transform", `translate(${x + labelOffset}, ${y - 7})`) // Position category label slightly above percentage
            .attr("dy", "0.35em")
            .attr("text-anchor", textAnchor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d.data[categoryFieldName]);

        // Percentage Label
        group.append("text")
            .attr("class", "text data-label percentage-label")
            .attr("transform", `translate(${x + labelOffset}, ${y + 7})`) // Position percentage label slightly below category
            .attr("dy", "0.35em")
            .attr("text-anchor", textAnchor)
            .style("font-family", fillStyle.typography.annotationFontFamily) // Use annotation for percentage
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(`${d.data.percentage.toFixed(1)}%`);
        
        // Optional: Leader lines
        group.append("line")
            .attr("class", "other leader-line")
            .attr("x1", centroid[0] * 1.05) // Start slightly outside the slice
            .attr("y1", centroid[1] * 1.05)
            .attr("x2", x + (labelOffset > 0 ? -2 : 2)) // End near the text
            .attr("y2", y)
            .attr("stroke", fillStyle.textColor)
            .attr("stroke-width", 0.5);
    });


    // Block 9: Optional Enhancements & Post-Processing
    // No main titles or subtitles as per requirements.
    // No complex visual effects like shadows, gradients, patterns.
    // Icons are handled in the legend.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}