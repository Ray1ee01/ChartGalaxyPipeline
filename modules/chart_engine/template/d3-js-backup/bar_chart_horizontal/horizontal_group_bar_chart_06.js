/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Group Bar Chart",
  "chart_name": "horizontal_group_bar_chart_06",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": [],
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
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal grouped bar chart.
    // It adheres to specific refactoring guidelines.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data.data;
    const config = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {}; // Though not used in this specific chart
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldRole = "x";
    const valueFieldRole = "y";
    const groupFieldRole = "group";

    const categoryColumn = dataColumns.find(col => col.role === categoryFieldRole);
    const valueColumn = dataColumns.find(col => col.role === valueFieldRole);
    const groupColumn = dataColumns.find(col => col.role === groupFieldRole);

    let criticalMissingConfigs = [];
    if (!categoryColumn) criticalMissingConfigs.push(`column with role '${categoryFieldRole}'`);
    if (!valueColumn) criticalMissingConfigs.push(`column with role '${valueFieldRole}'`);
    if (!groupColumn) criticalMissingConfigs.push(`column with role '${groupFieldRole}'`);

    if (criticalMissingConfigs.length > 0) {
        const errorMsg = `Critical chart config missing: ${criticalMissingConfigs.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("font-family", "sans-serif")
            .html(errorMsg);
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;
    const groupFieldName = groupColumn.name;
    
    if (!categoryFieldName) criticalMissingConfigs.push(`name for column with role '${categoryFieldRole}'`);
    if (!valueFieldName) criticalMissingConfigs.push(`name for column with role '${valueFieldRole}'`);
    if (!groupFieldName) criticalMissingConfigs.push(`name for column with role '${groupFieldRole}'`);

    if (criticalMissingConfigs.length > 0) {
        const errorMsg = `Critical chart config missing: ${criticalMissingConfigs.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("font-family", "sans-serif")
            .html(errorMsg);
        return null;
    }
    
    const categoryUnit = categoryColumn.unit !== "none" ? categoryColumn.unit : "";
    const valueUnit = valueColumn.unit !== "none" ? valueColumn.unit : "";
    // const groupUnit = groupColumn.unit !== "none" ? groupColumn.unit : ""; // Not typically used for group labels

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF', // Not used directly on SVG, but available
        defaultPrimaryColor: (colorsConfig.other && colorsConfig.other.primary) || '#1f77b4',
        groupColors: {}, // To be populated
        // Example for image sourcing if needed:
        // iconPrimary: (imagesConfig.other && imagesConfig.other.primary) || null,
    };

    function estimateTextWidth(text, styleProps) {
        const tempSvg = d3.create("svg");
        const tempText = tempSvg.append("text")
            .style("font-family", styleProps.font_family)
            .style("font-size", styleProps.font_size)
            .style("font-weight", styleProps.font_weight)
            .text(text);
        const width = tempText.node().getBBox().width;
        // tempSvg.remove(); // Not strictly needed as it's detached
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Optional: apply background to SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 60, // Adjusted for legend
        right: 30,
        bottom: 30,
        left: 60
    };

    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    const groupNames = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    // Populate fillStyle.groupColors
    groupNames.forEach((group, i) => {
        if (colorsConfig.field && colorsConfig.field[group]) {
            fillStyle.groupColors[group] = colorsConfig.field[group];
        } else if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            fillStyle.groupColors[group] = colorsConfig.available_colors[i % colorsConfig.available_colors.length];
        } else {
            fillStyle.groupColors[group] = d3.schemeCategory10[i % 10];
        }
    });
    
    let maxCategoryLabelWidth = 0;
    categories.forEach(cat => {
        const formattedCategory = categoryUnit ? `${cat}${categoryUnit}` : `${cat}`;
        const textWidth = estimateTextWidth(formattedCategory, {
            font_family: fillStyle.typography.labelFontFamily,
            font_size: fillStyle.typography.labelFontSize,
            font_weight: fillStyle.typography.labelFontWeight
        });
        maxCategoryLabelWidth = Math.max(maxCategoryLabelWidth, textWidth);
    });

    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const value = parseFloat(d[valueFieldName]);
        if (isNaN(value)) return;
        const formattedValue = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
        const textWidth = estimateTextWidth(formattedValue, {
            font_family: fillStyle.typography.annotationFontFamily,
            font_size: fillStyle.typography.annotationFontSize,
            font_weight: fillStyle.typography.annotationFontWeight
        });
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });
    
    chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + 20); // Add padding
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 20); // Add padding

    const legendItemPadding = 10;
    const legendRectSize = 15;
    const legendRectTextGap = 5;
    let totalLegendWidth = 0;
    const legendItemWidths = groupNames.map(group => {
        const textWidth = estimateTextWidth(group, {
            font_family: fillStyle.typography.labelFontFamily,
            font_size: fillStyle.typography.labelFontSize,
            font_weight: fillStyle.typography.labelFontWeight
        });
        const itemWidth = legendRectSize + legendRectTextGap + textWidth;
        totalLegendWidth += itemWidth;
        return itemWidth;
    });
    totalLegendWidth += Math.max(0, groupNames.length - 1) * legendItemPadding;


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Check dimensions and margins.");
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("font-family", "sans-serif")
            .html("Chart dimensions are too small for the given margins and labels.");
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    // Data is used as is, preserving original order for categories.

    // Block 6: Scale Definition & Configuration
    const categoryScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerHeight])
        .padding(0.1); // Bar group padding

    const valueScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => +d[valueFieldName]) || 0])
        .range([0, innerWidth])
        .nice();
        
    const groupColorScale = d3.scaleOrdinal()
        .domain(groupNames)
        .range(groupNames.map(group => fillStyle.groupColors[group]));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2})`);

    let currentLegendX = 0;
    groupNames.forEach((group, i) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, 0)`);

        itemGroup.append("rect")
            .attr("class", "mark legend-color-sample")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", groupColorScale(group));

        itemGroup.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendRectSize + legendRectTextGap)
            .attr("y", legendRectSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);
        
        currentLegendX += legendItemWidths[i] + legendItemPadding;
    });

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-area")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 8: Main Data Visualization Rendering
    const categoryGroups = mainChartGroup.selectAll(".category-group")
        .data(categories)
        .enter()
        .append("g")
        .attr("class", d => `category-group category-${d.replace(/\s+/g, '-')}`)
        .attr("transform", d => `translate(0, ${categoryScale(d)})`);

    categoryGroups.append("text")
        .attr("class", "label category-label")
        .attr("x", -10) // Position to the left of the bar area
        .attr("y", categoryScale.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => categoryUnit ? `${d}${categoryUnit}` : d);

    const barHeightPerGroup = categoryScale.bandwidth() / groupNames.length;

    categories.forEach(category => {
        const categoryData = chartDataArray.filter(d => d[categoryFieldName] === category);
        const parentGroup = mainChartGroup.select(`.category-${category.replace(/\s+/g, '-')}`);

        groupNames.forEach((group, i) => {
            const dataPoint = categoryData.find(d => d[groupFieldName] === group);
            if (dataPoint) {
                const value = parseFloat(dataPoint[valueFieldName]);
                if (isNaN(value) || value < 0) return; // Skip invalid data

                const barWidth = valueScale(value);
                const barY = i * barHeightPerGroup;

                parentGroup.append("rect")
                    .attr("class", "mark bar")
                    .attr("x", 0)
                    .attr("y", barY)
                    .attr("width", barWidth > 0 ? barWidth : 0) // Ensure non-negative width
                    .attr("height", barHeightPerGroup)
                    .attr("fill", groupColorScale(group))
                    .on("mouseover", function() { d3.select(this).style("opacity", 0.8); })
                    .on("mouseout", function() { d3.select(this).style("opacity", 1); });

                const formattedValue = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
                parentGroup.append("text")
                    .attr("class", "label value-label")
                    .attr("x", (barWidth > 0 ? barWidth : 0) + 5) // Position after the bar
                    .attr("y", barY + barHeightPerGroup / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formattedValue);
            }
        });
    });
    
    // Block 9: Optional Enhancements & Post-Processing
    // Mouseover/out handled directly on bar elements. No other complex enhancements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}