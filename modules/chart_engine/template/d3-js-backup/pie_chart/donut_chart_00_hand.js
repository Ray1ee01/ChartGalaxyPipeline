/* REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
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
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    d3.select(containerSelector).html(""); // Clear the container

    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {}; // Though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    if (!xColumn || !xColumn.name) {
        console.error("Critical chart config missing: X-axis field name (role 'x'). Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: X-axis field configuration is missing.</div>");
        return null;
    }
    if (!yColumn || !yColumn.name) {
        console.error("Critical chart config missing: Y-axis field name (role 'y'). Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Y-axis field configuration is missing.</div>");
        return null;
    }

    const xField = xColumn.name;
    const yField = yColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) ? typographyConfig.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) ? typographyConfig.title.font_size : '16px',
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) ? typographyConfig.title.font_weight : 'bold',
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF', // Not used for SVG background, but available
        primaryAccent: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#4682B4',
        arcColor: (category, index) => {
            if (colorsConfig.field && colorsConfig.field[category]) {
                return colorsConfig.field[category];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
            }
            return d3.schemeCategory10[index % 10];
        },
        dataLabelColor: '#FFFFFF', // Color for labels inside arcs, ensuring contrast
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        svg.appendChild(textNode);
        // Note: Appending to body and then getting BBox is more reliable, but restricted.
        // This in-memory approach might be less accurate for complex fonts or kerning.
        // For this specific constraint, we avoid DOM append.
        try {
            return textNode.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails (e.g. in a very restricted environment or for empty text)
            return text ? text.length * (parseInt(fontSize) / 2) : 0;
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground); // Optional: if SVG itself needs a background

    const chartMargins = { top: 60, right: 40, bottom: 40, left: 40 }; // Increased top margin for legend

    // Block 4: Core Chart Dimensions & Layout Calculation
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    
    // Radius calculation considers space for legend at the top
    const effectiveChartHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const effectiveChartWidth = containerWidth - chartMargins.left - chartMargins.right;
    
    const radius = Math.min(effectiveChartWidth, effectiveChartHeight) / 2;
    const innerRadiusRatio = typeof variables.donut_hole_ratio === 'number' && variables.donut_hole_ratio >= 0 && variables.donut_hole_ratio < 1 ? variables.donut_hole_ratio : 0.6;
    const arcInnerRadius = radius * innerRadiusRatio;
    const arcOuterRadius = radius;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartData, d => d[yField]);
    const chartDataWithPercentages = chartData.map(d => ({
        ...d,
        percentage: totalValue === 0 ? 0 : (d[yField] / totalValue) * 100
    }));

    const pieGenerator = d3.pie()
        .value(d => d[yField])
        .sort(null); // Maintain data order

    const arcGenerator = d3.arc()
        .innerRadius(arcInnerRadius)
        .outerRadius(arcOuterRadius)
        .padAngle(variables.pad_angle === undefined ? 0.02 : variables.pad_angle); // Default padAngle, can be configured

    // Block 6: Scale Definition & Configuration
    // Color scale is implicitly handled by fillStyle.arcColor

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2})`); // Position legend

    const legendCategories = [...new Set(chartData.map(d => d[xField]))];
    let legendCurrentX = 0;
    const legendItemHeight = 20;
    const legendRectSize = 12;
    const legendSpacing = 8;
    const legendPaddingBetweenItems = 15;

    // Optional: Legend Title (using xField name)
    if (variables.show_legend_title !== false && xField) { // Default to true
        const legendTitleText = xColumn.label || xField; // Use label from dataColumns if available
        const titleElement = legendGroup.append("text")
            .attr("x", legendCurrentX)
            .attr("y", 0) // Vertically centered with items
            .attr("class", "text legend-title")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight) // Use title weight for legend title
            .style("fill", fillStyle.textColor)
            .text(legendTitleText + ":");
        legendCurrentX += estimateTextWidth(legendTitleText + ":", fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.titleFontWeight) + legendPaddingBetweenItems;
    }
    
    legendCategories.forEach((category, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${legendCurrentX}, 0)`);

        legendItem.append("rect")
            .attr("x", 0)
            .attr("y", -(legendRectSize / 2))
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("class", "mark legend-mark")
            .style("fill", fillStyle.arcColor(category, legendCategories.indexOf(category))); // Ensure consistent color mapping

        const itemText = String(category); // Ensure category is a string for text display
        const textElement = legendItem.append("text")
            .attr("x", legendRectSize + legendSpacing)
            .attr("y", 0)
            .attr("class", "text legend-text")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(itemText);
        
        const itemWidth = legendRectSize + legendSpacing + estimateTextWidth(itemText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        legendCurrentX += itemWidth + legendPaddingBetweenItems;
    });

    // Center the legend if its total width is known
    const legendTotalWidth = legendCurrentX - legendPaddingBetweenItems; // Remove last padding
    if (legendTotalWidth < (containerWidth - chartMargins.left - chartMargins.right)) {
        legendGroup.attr("transform", `translate(${(containerWidth - legendTotalWidth) / 2}, ${chartMargins.top / 2})`);
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const arcs = mainChartGroup.selectAll("path.arc-path")
        .data(pieGenerator(chartDataWithPercentages))
        .enter()
        .append("path")
        .attr("class", "mark arc-path")
        .attr("d", arcGenerator)
        .style("fill", (d, i) => fillStyle.arcColor(d.data[xField], legendCategories.indexOf(d.data[xField])));

    // Data labels (percentage and value)
    const dataLabelThreshold = typeof variables.data_label_threshold_percentage === 'number' ? variables.data_label_threshold_percentage : 3; // Show labels for segments >= 3%

    const labelArcGenerator = d3.arc()
        .innerRadius((arcInnerRadius + arcOuterRadius) / 2 * (variables.label_radius_factor_inner || 0.85)) // Position labels within the arc
        .outerRadius((arcInnerRadius + arcOuterRadius) / 2 * (variables.label_radius_factor_outer || 0.85));


    const dataLabelsGroup = mainChartGroup.selectAll("g.data-label-group")
        .data(pieGenerator(chartDataWithPercentages))
        .enter()
        .append("g")
        .attr("class", "label data-label-group")
        .attr("transform", d => `translate(${labelArcGenerator.centroid(d)})`)
        .style("display", d => d.data.percentage >= dataLabelThreshold ? null : "none");

    // Percentage Text
    dataLabelsGroup.append("text")
        .attr("class", "text data-label percentage-label")
        .attr("text-anchor", "middle")
        .attr("dy", variables.percentage_label_dy === undefined ? "-0.4em" : variables.percentage_label_dy)
        .style("fill", fillStyle.dataLabelColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight) // Use configured label weight
        .text(d => `${d.data.percentage.toFixed(1)}%`);

    // Value Text (optional, based on variable)
    if (variables.show_value_labels !== false) { // Default to true
        dataLabelsGroup.append("text")
            .attr("class", "text data-label value-label")
            .attr("text-anchor", "middle")
            .attr("dy", variables.value_label_dy === undefined ? "0.9em" : variables.value_label_dy)
            .style("fill", fillStyle.dataLabelColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize) // Use smaller size for value or same
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(d => d.data[yField]);
    }

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects like shadows, gradients, or hand-drawn styles.
    // No main title/subtitle in the chart center.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}