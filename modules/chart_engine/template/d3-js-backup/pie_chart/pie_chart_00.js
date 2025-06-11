/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pie Chart",
  "chart_name": "pie_chart_01",
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
    // This function renders a pie chart based on the provided data and configuration.
    // It adheres to specific styling and structural directives.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming colors_dark is an alternative
    const images = data.images || {}; // Though not used in this pie chart
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("category field (role: 'x')");
        if (!valueFieldName) missingFields.push("value field (role: 'y')");
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMessage}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#333333',
        chartBackground: colors.background_color || '#FFFFFF', // Not directly used on SVG background, but available
        primaryColor: (colors.other && colors.other.primary) ? colors.other.primary : '#4682B4',
        defaultCategoryColors: d3.schemeCategory10,
    };

    fillStyle.getCategoryColor = (category, index) => {
        if (colors.field && colors.field[category]) {
            return colors.field[category];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[index % colors.available_colors.length];
        }
        return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
    };
    
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but adhering to "MUST NOT be appended to the document DOM".
        // For simple cases, this might work, but getBBox on non-rendered elements can be tricky.
        // A common workaround is to append to an off-screen part of the main SVG if available,
        // or accept potential inaccuracies if strict non-DOM-append is required.
        // For this refactor, we'll assume this simplified version is acceptable.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails (e.g. in a pure Node environment or if text is empty)
            return text.length * (parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
    }

    function getColorBrightness(hexColor) {
        if (!hexColor || hexColor.length < 4) return 128; // Default to a mid-brightness
        hexColor = hexColor.startsWith('#') ? hexColor : `#${hexColor}`;
        if (hexColor.length === 4) { // Handle shorthand hex
            hexColor = `#${hexColor[1]}${hexColor[1]}${hexColor[2]}${hexColor[2]}${hexColor[3]}${hexColor[3]}`;
        }
        if (hexColor.length !== 7) return 128;

        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        return (r * 299 + g * 587 + b * 114) / 1000;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground === '#FFFFFF' ? 'none' : fillStyle.chartBackground); // Only set if not default white

    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendHeightEstimate = 60; // Estimated space for legend
    const chartMargins = { 
        top: variables.margin_top || 20 + (variables.show_legend !== false ? legendHeightEstimate : 0), 
        right: variables.margin_right || 40, 
        bottom: variables.margin_bottom || 40, 
        left: variables.margin_left || 40 
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const radius = Math.min(innerWidth, innerHeight) / 2;
    const pieCenterX = innerWidth / 2;
    const pieCenterY = innerHeight / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left + pieCenterX}, ${chartMargins.top + pieCenterY})`);

    // Block 5: Data Preprocessing & Transformation
    if (chartData.length === 0) {
        mainChartGroup.append("text")
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .text("No data available to display.");
        return svgRoot.node();
    }
    
    const totalValue = d3.sum(chartData, d => d[valueFieldName]);
    const processedData = chartData.map(d => ({
        ...d,
        percentage: totalValue === 0 ? 0 : (d[valueFieldName] / totalValue) * 100
    })).filter(d => d[valueFieldName] > 0); // Filter out zero-value slices for cleaner pie

    if (processedData.length === 0 && chartData.length > 0) { // All values were zero or negative
         mainChartGroup.append("text")
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .text("All data values are zero or invalid.");
        return svgRoot.node();
    }


    // Block 6: Scale Definition & Configuration
    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null); // Preserve original data order

    const arcGenerator = d3.arc()
        .innerRadius(variables.inner_radius_ratio ? radius * variables.inner_radius_ratio : 0) // Support for donut chart via variable
        .outerRadius(radius);

    const labelArcGenerator = d3.arc()
        .innerRadius(radius * (variables.label_radius_ratio || 0.7))
        .outerRadius(radius * (variables.label_radius_ratio || 0.7));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    if (variables.show_legend !== false) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${chartMargins.left}, ${20})`); // Position legend at the top

        const legendItemHeight = 20;
        const legendSwatchSize = 10;
        const legendSpacing = 5;
        let currentX = 0;
        let currentY = 0;
        const legendMaxWidth = innerWidth;

        const uniqueCategories = Array.from(new Set(processedData.map(d => d[categoryFieldName])));

        uniqueCategories.forEach((category, i) => {
            const itemColor = fillStyle.getCategoryColor(category, i);
            const textWidth = estimateTextWidth(category, { 
                fontFamily: fillStyle.typography.labelFontFamily, 
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            });
            const itemWidth = legendSwatchSize + legendSpacing + textWidth;

            if (currentX + itemWidth > legendMaxWidth && currentX > 0) { // Wrap legend items
                currentX = 0;
                currentY += legendItemHeight;
            }

            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${currentY})`);

            legendItem.append("rect")
                .attr("class", "mark legend-swatch")
                .attr("width", legendSwatchSize)
                .attr("height", legendSwatchSize)
                .attr("fill", itemColor);

            legendItem.append("text")
                .attr("class", "label legend-text")
                .attr("x", legendSwatchSize + legendSpacing)
                .attr("y", legendSwatchSize / 2)
                .attr("dy", "0.35em") // Vertical alignment
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .attr("fill", fillStyle.textColor)
                .text(category);
            
            currentX += itemWidth + legendSpacing * 2; // Add padding for next item
        });
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const pieData = pieGenerator(processedData);

    const sliceGroups = mainChartGroup.selectAll(".slice-group")
        .data(pieData)
        .enter()
        .append("g")
        .attr("class", "mark slice-group");

    sliceGroups.append("path")
        .attr("class", "mark slice-path")
        .attr("d", arcGenerator)
        .attr("fill", (d, i) => fillStyle.getCategoryColor(d.data[categoryFieldName], i)) // Use index for consistent color mapping if names repeat or for default scheme
        .attr("stroke", variables.slice_stroke_color || fillStyle.chartBackground) // Optional stroke for separation
        .style("stroke-width", variables.slice_stroke_width !== undefined ? variables.slice_stroke_width : "1px"); // Default stroke width

    // Add data labels on slices
    if (variables.show_data_labels !== false) {
        sliceGroups.append("text")
            .attr("class", "label data-label")
            .attr("transform", d => `translate(${labelArcGenerator.centroid(d)})`)
            .attr("text-anchor", "middle")
            .attr("dy", ".35em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", d => {
                const sliceColor = fillStyle.getCategoryColor(d.data[categoryFieldName], pieData.indexOf(d));
                return getColorBrightness(sliceColor) > 128 ? '#000000' : '#FFFFFF'; // Contrast color
            })
            .text(d => {
                const percentageDisplayThreshold = variables.label_percentage_threshold !== undefined ? variables.label_percentage_threshold : 2;
                return d.data.percentage >= percentageDisplayThreshold ? `${d.data.percentage.toFixed(1)}%` : '';
            });
    }

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements)
    // No additional enhancements in this refactored version beyond basic labels and legend.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}