/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Circular Bar Chart",
  "chart_name": "grouped_circular_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a grouped circular bar chart.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Prioritize data.colors, fallback to data.colors_dark
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const categoryFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const valueFieldName = yFieldConfig ? yFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push("x field (category)");
        if (!valueFieldName) missingFields.push("y field (value)");
        if (!groupFieldName) missingFields.push("group field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        },
        textColor: colorsInput.text_color || '#0f223b',
        chartBackground: colorsInput.background_color || '#FFFFFF', // Not directly used on SVG, but available
        primaryAccent: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#1f77b4',
        defaultCategoryColor: '#CCCCCC',
        groupColors: {},
        iconUrls: {}
    };

    const groupValues = [...new Set(rawChartData.map(d => d[groupFieldName]))].sort(); // Sort for consistent legend order
    const defaultColorPalette = d3.schemeCategory10;

    groupValues.forEach((group, i) => {
        if (colorsInput.field && colorsInput.field[group]) {
            fillStyle.groupColors[group] = colorsInput.field[group];
        } else if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            fillStyle.groupColors[group] = colorsInput.available_colors[i % colorsInput.available_colors.length];
        } else {
            fillStyle.groupColors[group] = defaultColorPalette[i % defaultColorPalette.length];
        }

        if (imagesInput.field && imagesInput.field[group]) {
            fillStyle.iconUrls[group] = imagesInput.field[group];
        }
    });
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM append for this utility.
        // If getBBox is not accurate, a temporary append/remove might be needed in a real-world scenario.
        // For this exercise, we assume getBBox on an unattached element is sufficient or that minor inaccuracies are acceptable.
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) {
            // Fallback or error handling if getBBox fails (e.g. in a very restricted environment)
            console.warn("estimateTextWidth failed, using fallback width.", e);
            width = text.length * (parseInt(fontSize) / 1.8); // Rough estimate
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
        .attr("class", "chart-svg-root");
        // No viewBox as per requirements

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 150, bottom: 20, left: 20 }; // Increased right margin for legend
    
    // Adjust margins if legend is very wide
    let maxLegendItemWidth = 0;
    groupValues.forEach(group => {
        const textWidth = estimateTextWidth(group, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        const iconWidth = fillStyle.iconUrls[group] ? 20 + 5 : 0; // icon size + padding
        maxLegendItemWidth = Math.max(maxLegendItemWidth, iconWidth + textWidth + 20); // 20 for rect and padding
    });
    chartMargins.right = Math.max(chartMargins.right, maxLegendItemWidth + 20); // Ensure space for legend + padding


    const chartInnerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartInnerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = chartMargins.left + chartInnerWidth / 2;
    const centerY = chartMargins.top + chartInnerHeight / 2;
    
    const outerRadius = Math.min(chartInnerWidth, chartInnerHeight) / 2 * 0.95; // Main radius for chart
    const innerRadiusForBars = outerRadius * 0.25; // Radius of the central hole

    // Block 5: Data Preprocessing & Transformation
    const chartData = rawChartData.map(d => ({
        category: d[categoryFieldName],
        group: d[groupFieldName],
        value: +d[valueFieldName] || 0
    }));

    const categories = [...new Set(chartData.map(d => d.category))];
    // No sorting of categories as per valueSortDirection: "none"

    const maxDataValue = d3.max(chartData, d => d.value) || 1; // Ensure maxDataValue is at least 1 to prevent scale issues

    // Block 6: Scale Definition & Configuration
    const categoryScale = d3.scaleBand()
        .domain(categories)
        .range([0, 2 * Math.PI])
        .paddingInner(0.1); // Padding between category groups

    const groupScale = d3.scaleBand()
        .domain(groupValues)
        .range([0, categoryScale.bandwidth()]) // Will be set dynamically per category
        .padding(0.05); // Padding between bars of different groups within a category

    const valueScale = d3.scaleLinear() // Or d3.scaleSqrt() for area perception
        .domain([0, maxDataValue])
        .range([innerRadiusForBars, outerRadius]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group");

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${containerWidth - chartMargins.right + 20}, ${chartMargins.top})`);

    const legendItemHeight = 25;
    const legendIconSize = 15;

    groupValues.forEach((group, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${i * legendItemHeight})`);

        legendItem.append("rect")
            .attr("class", "mark legend-color-sample")
            .attr("width", legendIconSize)
            .attr("height", legendIconSize)
            .style("fill", fillStyle.groupColors[group] || fillStyle.defaultCategoryColor);

        let textXPosition = legendIconSize + 5;
        if (fillStyle.iconUrls[group]) {
            legendItem.append("image")
                .attr("class", "icon legend-icon")
                .attr("xlink:href", fillStyle.iconUrls[group])
                .attr("x", textXPosition)
                .attr("y", 0)
                .attr("width", legendIconSize)
                .attr("height", legendIconSize);
            textXPosition += legendIconSize + 5;
        }
        
        legendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", textXPosition)
            .attr("y", legendIconSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);
    });


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const categoryGroups = mainChartGroup.selectAll(".category-group")
        .data(categories)
        .enter()
        .append("g")
        .attr("class", d => `category-group category-${String(d).replace(/\s+/g, '-')}`) // Sanitize class name
        .attr("transform", d => `rotate(${(categoryScale(d) + categoryScale.bandwidth() / 2) * 180 / Math.PI - 90})`); // Rotate so middle of band points up

    // Update groupScale range for each category (it's the same for all in this design)
    groupScale.range([ -categoryScale.bandwidth() / 2, categoryScale.bandwidth() / 2 ]);

    const arcGenerator = d3.arc()
        .innerRadius(d => valueScale(0)) // Or valueScale(d.previousValue) for stacked
        .outerRadius(d => valueScale(d.value))
        .startAngle(d => groupScale(d.group))
        .endAngle(d => groupScale(d.group) + groupScale.bandwidth())
        .padAngle(0.01); // Small padding between arcs of the same category but different groups

    categoryGroups.selectAll(".mark.bar")
        .data(categoryName => chartData.filter(d => d.category === categoryName))
        .enter()
        .append("path")
        .attr("class", d => `mark bar group-${String(d.group).replace(/\s+/g, '-')}`) // Sanitize class name
        .attr("d", arcGenerator)
        .style("fill", d => fillStyle.groupColors[d.group] || fillStyle.defaultCategoryColor);
        // No data labels on bars as per dataLabelPosition: "none"

    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements, shadows, gradients, etc.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}