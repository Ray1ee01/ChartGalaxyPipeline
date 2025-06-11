/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_group_bar_chart_11",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal grouped bar chart.

    // Block 1: Configuration Parsing & Validation
    const rawData = data;
    const chartDataArray = rawData.data.data;
    const config = rawData.variables || {};
    const typographyInput = rawData.typography || {};
    const colorsInput = rawData.colors || {};
    const imagesInput = rawData.images || {};
    const dataColumns = rawData.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    let missingFields = [];
    if (!xFieldConfig) missingFields.push("x role field");
    if (!yFieldConfig) missingFields.push("y role field");
    if (!groupFieldConfig) missingFields.push("group role field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    const xFieldUnit = xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    const yFieldUnit = yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        groupColors: {} // To be populated after groupCategories are known
    };

    // Typography
    fillStyle.typography.defaultFontFamily = "Arial, sans-serif";
    fillStyle.typography.titleFontFamily = (typographyInput.title && typographyInput.title.font_family) || fillStyle.typography.defaultFontFamily;
    fillStyle.typography.titleFontSize = (typographyInput.title && typographyInput.title.font_size) || "16px";
    fillStyle.typography.titleFontWeight = (typographyInput.title && typographyInput.title.font_weight) || "bold";

    fillStyle.typography.labelFontFamily = (typographyInput.label && typographyInput.label.font_family) || fillStyle.typography.defaultFontFamily;
    fillStyle.typography.labelFontSize = (typographyInput.label && typographyInput.label.font_size) || "12px";
    fillStyle.typography.labelFontWeight = (typographyInput.label && typographyInput.label.font_weight) || "normal";

    fillStyle.typography.annotationFontFamily = (typographyInput.annotation && typographyInput.annotation.font_family) || fillStyle.typography.defaultFontFamily;
    fillStyle.typography.annotationFontSize = (typographyInput.annotation && typographyInput.annotation.font_size) || "10px";
    fillStyle.typography.annotationFontWeight = (typographyInput.annotation && typographyInput.annotation.font_weight) || "normal";
    
    // Colors
    fillStyle.textColor = colorsInput.text_color || "#333333";
    fillStyle.chartBackground = colorsInput.background_color || "#FFFFFF"; // Not used directly on SVG, but available
    fillStyle.primaryColor = (colorsInput.other && colorsInput.other.primary) || "#007bff"; // Default primary

    // Helper: Text Measurement (In-Memory)
    function estimateTextWidth(text, styleProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', styleProps.fontFamily);
        tempTextElement.setAttribute('font-size', styleProps.fontSize);
        tempTextElement.setAttribute('font-weight', styleProps.fontWeight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // No DOM append needed for getBBox in modern browsers for SVG
        return tempTextElement.getBBox().width;
    }

    // Helper: Value Formatter
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    // Helper: Get Group Color
    // This needs groupCategories, which is determined in Block 5.
    // For now, define it, and it will be used with groupCategories later.
    // Or, populate fillStyle.groupColors in Block 5.
    // Let's make it a function that can be called when groups are known.
    function getGroupColor(groupName, groupIndex, groupCategoriesList) {
        if (colorsInput.field && colorsInput.field[groupName]) {
            return colorsInput.field[groupName];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[groupIndex % colorsInput.available_colors.length];
        }
        const defaultScheme = d3.schemeCategory10;
        return defaultScheme[groupIndex % defaultScheme.length];
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
        // No viewBox, fixed dimensions as per spec.

    // Block 5: Data Preprocessing & Transformation (Part 1: Get unique groups for color mapping)
    // Moved this part earlier to allow fillStyle.groupColors to be populated.
    const xCategories = [...new Set(chartDataArray.map(d => d[xFieldName]))];
    const groupCategories = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    groupCategories.forEach((group, i) => {
        fillStyle.groupColors[group] = getGroupColor(group, i, groupCategories);
    });

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 20, // Initial top margin, will be adjusted for legend
        right: 60,
        bottom: 30,
        left: 40  // Initial left margin, will be adjusted for labels/icons
    };

    const iconWidth = 20;
    const iconHeight = 15;
    const iconPadding = 5;

    // Calculate max value label width
    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const formattedVal = yFieldUnit ? `${formatValue(d[yFieldName])}${yFieldUnit}` : `${formatValue(d[yFieldName])}`;
        const textWidth = estimateTextWidth(formattedVal, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        });
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 10); // Ensure space for value labels + padding

    // Calculate max dimension label width
    let maxDimensionLabelWidth = 0;
    xCategories.forEach(dim => {
        const formattedDim = xFieldUnit ? `${dim}${xFieldUnit}` : `${dim}`;
        const textWidth = estimateTextWidth(formattedDim, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, textWidth);
    });
    chartMargins.left = maxDimensionLabelWidth + iconPadding + iconWidth + iconPadding + 10; // dim_label + pad + icon + pad + base_pad

    // Legend layout calculations
    const legendConfig = {
        swatchSize: 15,
        swatchPadding: 5, // Padding between swatch and text
        itemSpacing: 15,  // Horizontal spacing between legend items
        topPadding: 20,   // Padding from SVG top to legend
        bottomPadding: 20 // Padding from legend to chart content
    };

    let totalLegendWidth = 0;
    const legendItemWidths = [];
    groupCategories.forEach(group => {
        const textWidth = estimateTextWidth(group, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        const itemWidth = legendConfig.swatchSize + legendConfig.swatchPadding + textWidth;
        legendItemWidths.push(itemWidth);
        totalLegendWidth += itemWidth;
    });
    if (groupCategories.length > 1) {
        totalLegendWidth += (groupCategories.length - 1) * legendConfig.itemSpacing;
    }
    
    const legendTextHeight = parseFloat(fillStyle.typography.labelFontSize);
    const actualLegendItemHeight = Math.max(legendConfig.swatchSize, legendTextHeight);
    chartMargins.top = legendConfig.topPadding + actualLegendItemHeight + legendConfig.bottomPadding;

    // Inner dimensions
    let innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    let innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Check dimensions and margins.");
        d3.select(containerSelector).html("<div style='color:red;'>Chart dimensions too small for content.</div>");
        return null;
    }
    
    // Block 5: Data Preprocessing & Transformation (Continued)
    const groupedData = {};
    groupCategories.forEach(group => {
        const groupItems = chartDataArray.filter(d => d[groupFieldName] === group);
        groupedData[group] = [...groupItems].sort((a, b) => b[yFieldName] - a[yFieldName]);
    });

    let totalBars = 0;
    groupCategories.forEach(group => {
        totalBars += groupedData[group].length;
    });

    const numGroups = groupCategories.length;
    const groupPaddingRatio = 0.15;
    const groupPadding = innerHeight * groupPaddingRatio / (numGroups > 1 ? numGroups : 1); // Avoid division by zero if numGroups is 1, though it should be >=2
    const totalGroupPadding = numGroups > 1 ? groupPadding * (numGroups - 1) : 0;
    
    const availableHeightForBars = innerHeight - totalGroupPadding;
    
    const barPaddingRatio = 0.15; // Padding between bars within a group
    const idealBarUnitHeight = totalBars > 0 ? availableHeightForBars / totalBars : 0;
    const barHeight = idealBarUnitHeight * (1 - barPaddingRatio);
    const barPadding = idealBarUnitHeight * barPaddingRatio;

    const groupHeights = {};
    const groupOffsets = {};
    let currentOffsetY = 0; // Relative to mainChartGroup's top
    groupCategories.forEach((group, index) => {
        const itemCount = groupedData[group].length;
        const groupOwnHeight = itemCount * barHeight + (itemCount > 0 ? (itemCount - 1) * barPadding : 0);
        groupHeights[group] = groupOwnHeight;
        groupOffsets[group] = currentOffsetY;
        currentOffsetY += groupOwnHeight + (index < numGroups - 1 ? groupPadding : 0);
    });


    // Block 6: Scale Definition & Configuration
    const maxDataValue = d3.max(chartDataArray, d => +d[yFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, maxDataValue > 0 ? maxDataValue * 1.05 : 1]) // Add 5% margin, handle all zero data
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (Legend)
    const legendYPosition = legendConfig.topPadding + actualLegendItemHeight / 2;
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${legendYPosition})`);

    let currentLegendXOffset = 0;
    groupCategories.forEach((group, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendXOffset}, 0)`);

        legendItem.append("rect")
            .attr("class", "mark")
            .attr("width", legendConfig.swatchSize)
            .attr("height", legendConfig.swatchSize)
            .attr("y", -legendConfig.swatchSize / 2) // Center swatch vertically
            .style("fill", fillStyle.groupColors[group]);

        legendItem.append("text")
            .attr("class", "label")
            .attr("x", legendConfig.swatchSize + legendConfig.swatchPadding)
            .attr("y", 0) // Vertically centered by dy
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);
        
        currentLegendXOffset += legendItemWidths[i] + legendConfig.itemSpacing;
    });
    
    // Main chart group
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 8: Main Data Visualization Rendering
    groupCategories.forEach(group => {
        const groupDataItems = groupedData[group];
        const currentGroupOffset = groupOffsets[group];
        const groupColor = fillStyle.groupColors[group];

        groupDataItems.forEach((d, i) => {
            const barYPos = currentGroupOffset + i * (barHeight + barPadding);
            const barActualWidth = xScale(+d[yFieldName]);

            // Bar
            mainChartGroup.append("rect")
                .attr("class", "mark bar")
                .attr("x", 0)
                .attr("y", barYPos)
                .attr("width", barActualWidth > 0 ? barActualWidth : 0) // Ensure non-negative width
                .attr("height", barHeight > 0 ? barHeight : 0) // Ensure non-negative height
                .style("fill", groupColor)
                // Removed rx, ry for rounded corners, and gradient fill as per spec V.2
                .on("mouseover", function() { d3.select(this).style("opacity", 0.8); })
                .on("mouseout", function() { d3.select(this).style("opacity", 1); });

            // Dimension Label (Text part)
            const dimensionValue = d[xFieldName];
            const formattedDimension = xFieldUnit ? `${dimensionValue}${xFieldUnit}` : `${dimensionValue}`;
            const labelX = -iconWidth - iconPadding - iconPadding; // Position to the left of icon space
            const labelY = barYPos + barHeight / 2;

            mainChartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", labelX)
                .attr("y", labelY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(formattedDimension);

            // Value Label
            const formattedValue = yFieldUnit ? `${formatValue(d[yFieldName])}${yFieldUnit}` : `${formatValue(d[yFieldName])}`;
            const valueLabelX = (barActualWidth > 0 ? barActualWidth : 0) + 5; // Position outside bar
            
            mainChartGroup.append("text")
                .attr("class", "value data-value-label")
                .attr("x", valueLabelX)
                .attr("y", barYPos + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize) // Use configured size
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(formattedValue);

            // Block 9: Optional Enhancements & Post-Processing (Icons)
            // Dimension Icon
            const iconX = -iconWidth - iconPadding;
            const iconY = barYPos + (barHeight - iconHeight) / 2;
            const iconUrl = imagesInput.field && imagesInput.field[dimensionValue] ? imagesInput.field[dimensionValue] : null;
            
            if (iconUrl) {
                mainChartGroup.append("image")
                    .attr("class", "icon dimension-icon")
                    .attr("x", iconX)
                    .attr("y", iconY)
                    .attr("width", iconWidth)
                    .attr("height", iconHeight)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", iconUrl);
            }
        });
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}