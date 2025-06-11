/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Group Bar Chart",
  "chart_name": "horizontal_group_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group", "x"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 10]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
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
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Could be data.colors_dark for dark themes, adapt if necessary
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    let missingFields = [];
    if (!dimensionFieldConfig) missingFields.push("x role");
    if (!valueFieldConfig) missingFields.push("y role");
    if (!groupFieldConfig) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')} in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionFieldName = dimensionFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    if (!chartDataArray || chartDataArray.length === 0) {
        const errorMsg = "Chart data is empty. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        colors: {
            textColor: colorsConfig.text_color || '#333333',
            chartBackground: colorsConfig.background_color || '#FFFFFF',
            defaultBarColor: '#A9A9A9', // Default if no specific color found
            getBarColor: (group) => {
                if (colorsConfig.field && colorsConfig.field[group]) {
                    return colorsConfig.field[group];
                }
                if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                    // Find index of group to maintain consistent coloring
                    const uniqueGroups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
                    const groupIndex = uniqueGroups.indexOf(group);
                    return colorsConfig.available_colors[groupIndex % colorsConfig.available_colors.length];
                }
                return fillStyle.colors.defaultBarColor;
            }
        },
        images: {
            getIconUrl: (dimensionValue) => {
                if (imagesConfig.field && imagesConfig.field[dimensionValue]) {
                    return imagesConfig.field[dimensionValue];
                }
                return null;
            }
        }
    };

    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but per spec, keep it in-memory if possible. If issues, this is a place to check.
        // document.body.appendChild(svg); // Temporary append for measurement
        const width = textElement.getBBox().width;
        // document.body.removeChild(svg); // Clean up
        return width;
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    const valueFieldUnit = valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.colors.chartBackground);

    const chartMargins = {
        top: 20, // Reduced top margin as titles are removed
        right: 80, // For value labels
        bottom: 30,
        left: 150 // Initial, will be adjusted
    };

    // Block 4: Core Chart Dimensions & Layout Calculation
    const uniqueDimensions = [...new Set(chartDataArray.map(d => d[dimensionFieldName]))];
    const uniqueGroups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    let maxDimensionLabelWidth = 0;
    uniqueDimensions.forEach(dim => {
        const width = estimateTextWidth(dim, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (width > maxDimensionLabelWidth) maxDimensionLabelWidth = width;
    });

    let maxGroupLabelWidth = 0;
    uniqueGroups.forEach(group => {
        const width = estimateTextWidth(group, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, 'bold'); // Group labels are bold
        if (width > maxGroupLabelWidth) maxGroupLabelWidth = width;
    });
    
    const tempIconSizeForMargin = (containerHeight / uniqueGroups.length / uniqueDimensions.length) * 0.75 * 0.9; // Approximate icon size
    const iconPaddingForMargin = tempIconSizeForMargin * 1.4; // icon + padding

    chartMargins.left = Math.max(chartMargins.left, Math.max(maxDimensionLabelWidth, maxGroupLabelWidth) + iconPaddingForMargin + 25); // 20 for icon, 5 for spacing

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const groupHeight = innerHeight / uniqueGroups.length;
    const groupPadding = groupHeight * 0.06; // Reduced padding slightly

    const barHeight = (groupHeight - groupPadding) / uniqueDimensions.length;
    const actualBarHeight = barHeight * 0.75;

    const iconSize = actualBarHeight * 0.9;
    const iconRightPadding = iconSize * 0.4;

    // Block 5: Data Preprocessing & Transformation
    // Data is already in chartDataArray. Grouping will be done during rendering.

    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue * 1.1 : 1]) // Handle case where maxValue is 0
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");
    // No axes or gridlines to render per requirements.

    // Block 8: Main Data Visualization Rendering
    uniqueGroups.forEach((group, groupIndex) => {
        const groupStartY = groupIndex * groupHeight;
        const groupLabelY = groupStartY - parseFloat(fillStyle.typography.labelFontSize) / 2 - 5; // Position above the first bar of the group

        // Group Label
        mainChartGroup.append("text")
            .attr("class", "label group-label")
            .attr("x", -(iconSize + iconRightPadding + 5)) // Align with dimension labels
            .attr("y", groupLabelY < 0 ? groupStartY + actualBarHeight / 2 : groupLabelY) // Adjust if too high
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold")
            .style("fill", fillStyle.colors.textColor)
            .text(group);

        const groupData = chartDataArray.filter(d => d[groupFieldName] === group);

        uniqueDimensions.forEach((dimension, dimIndex) => {
            const dataPoint = groupData.find(d => d[dimensionFieldName] === dimension);

            if (dataPoint) {
                const barY = groupStartY + (dimIndex * barHeight) + (groupPadding / 2); // Add half of groupPadding for top margin within group
                const value = +dataPoint[valueFieldName];
                const barWidth = value > 0 ? xScale(value) : 0;

                const itemGroup = mainChartGroup.append("g")
                    .attr("class", "mark item-group")
                    .attr("transform", `translate(0, ${barY + actualBarHeight / 2})`);

                // Icon
                const iconUrl = fillStyle.images.getIconUrl(dimension);
                if (iconUrl) {
                    itemGroup.append("image")
                        .attr("class", "icon dimension-icon")
                        .attr("x", -iconSize - iconRightPadding)
                        .attr("y", -iconSize / 2)
                        .attr("width", iconSize)
                        .attr("height", iconSize)
                        .attr("preserveAspectRatio", "xMidYMid meet")
                        .attr("xlink:href", iconUrl);
                }

                // Dimension Label
                itemGroup.append("text")
                    .attr("class", "label dimension-label")
                    .attr("x", -(iconSize + iconRightPadding + 5)) // 5px padding from icon or effective icon area
                    .attr("y", 0)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", `${Math.min(barHeight * 0.9, parseFloat(fillStyle.typography.labelFontSize))}px`)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.colors.textColor)
                    .text(dimension);

                // Bar
                mainChartGroup.append("rect")
                    .attr("class", "mark bar")
                    .attr("x", 0)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", actualBarHeight)
                    .attr("fill", fillStyle.colors.getBarColor(group))
                    .on("mouseover", function() { d3.select(this).style("opacity", 0.8); })
                    .on("mouseout", function() { d3.select(this).style("opacity", 1); });

                // Value Label
                const formattedValue = valueFieldUnit ? `${formatValue(value)}${valueFieldUnit}` : formatValue(value);
                const valueLabelFontSize = `${Math.min(actualBarHeight * 0.55, parseFloat(fillStyle.typography.annotationFontSize))}px`;
                
                mainChartGroup.append("text")
                    .attr("class", "label value-label")
                    .attr("x", barWidth + 8) // 8px padding from bar end
                    .attr("y", barY + actualBarHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("fill", fillStyle.colors.textColor)
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", valueLabelFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .text(formattedValue);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Mouseover/mouseout handled directly on bars. No other complex enhancements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}