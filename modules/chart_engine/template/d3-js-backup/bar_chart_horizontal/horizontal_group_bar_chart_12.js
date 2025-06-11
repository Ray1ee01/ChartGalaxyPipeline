/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_group_bar_chart_12",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 6]],
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
    const chartConfig = data;
    const chartData = chartConfig.data?.data;
    const variables = chartConfig.variables || {};
    const inputTypography = chartConfig.typography || {};
    const inputColors = chartConfig.colors || {}; // or chartConfig.colors_dark for dark themes
    const inputImages = chartConfig.images || {};
    const dataColumns = chartConfig.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const dimensionField = xFieldConfig?.name;
    const valueField = yFieldConfig?.name;
    const groupField = groupFieldConfig?.name;

    const missingFields = [];
    if (!dimensionField) missingFields.push("x role (dimensionField)");
    if (!valueField) missingFields.push("y role (valueField)");
    if (!groupField) missingFields.push("group role (groupField)");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    if (!chartData || chartData.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionUnit = xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    const valueUnit = yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";
    // const groupUnit = groupFieldConfig.unit !== "none" ? groupFieldConfig.unit : ""; // Not typically used for display

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: inputTypography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: inputTypography.title?.font_size || '16px',
            titleFontWeight: inputTypography.title?.font_weight || 'bold',
            labelFontFamily: inputTypography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: inputTypography.label?.font_size || '12px',
            labelFontWeight: inputTypography.label?.font_weight || 'normal',
            annotationFontFamily: inputTypography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: inputTypography.annotation?.font_size || '10px',
            annotationFontWeight: inputTypography.annotation?.font_weight || 'normal',
        },
        textColor: inputColors.text_color || '#333333',
        chartBackground: inputColors.background_color || '#FFFFFF',
        defaultBarColor: inputColors.other?.primary || '#1f77b4',
        getCategoryColor: (category, index, totalCategories) => {
            if (inputColors.field && inputColors.field[category]) {
                return inputColors.field[category];
            }
            if (inputColors.available_colors && inputColors.available_colors.length > 0) {
                return inputColors.available_colors[index % inputColors.available_colors.length];
            }
            return d3.schemeCategory10[index % Math.min(totalCategories, d3.schemeCategory10.length)];
        },
        getImageUrl: (key) => {
            if (inputImages.field && inputImages.field[key]) {
                return inputImages.field[key];
            }
            if (inputImages.other && inputImages.other[key]) {
                return inputImages.other[key];
            }
            return null;
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: getBBox on an in-memory, unattached SVG element might not be perfectly accurate in all browsers.
        // This adheres to the "MUST NOT be appended to the document DOM" constraint.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-rendered elements
            const avgCharWidth = parseFloat(fontSize) * 0.6; // Rough estimation
            return text.length * avgCharWidth;
        }
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for billion
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];

    let maxDimensionLabelWidth = 0;
    dimensions.forEach(dim => {
        const width = estimateTextWidth(dim, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (width > maxDimensionLabelWidth) {
            maxDimensionLabelWidth = width;
        }
    });
    
    const iconSizeBase = parseFloat(fillStyle.typography.labelFontSize) * 1.5; // Relative to label font size
    const iconWidth = iconSizeBase;
    const iconHeight = iconSizeBase;
    const iconRightPadding = iconWidth * 0.4;
    const labelIconGap = 5; // Gap between icon and label text

    const chartMargins = {
        top: 20, // Reduced as no main title
        right: 80, // For value labels
        bottom: 80, // For legend
        left: 20 // Initial left margin
    };
    
    // Adjust left margin for dimension labels and icons
    chartMargins.left = Math.max(chartMargins.left, maxDimensionLabelWidth + labelIconGap + iconWidth + iconRightPadding + 20);


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const groupHeight = innerHeight / groups.length;
    const barHeightPerDimension = groupHeight / dimensions.length;
    const actualBarHeight = barHeightPerDimension * 0.75;


    // Block 5: Data Preprocessing & Transformation
    // Data is mostly ready. Values will be cast to numbers during scale usage.

    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartData, d => +d[valueField]);
    const xScale = d3.scaleLinear()
        .domain([0, Math.max(1, maxValue * 1.1)]) // Ensure domain starts at 0 and has some padding; max(1,...) for case where maxValue is 0 or negative
        .range([0, innerWidth])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend");
    
    const legendItemHeight = 20;
    const legendColorBoxSize = 12;
    const legendPadding = 5;
    const legendTextMaxWidth = 100; // Max width for legend text before potential truncation

    let totalLegendWidth = 0;
    const legendItems = groups.map((group, i) => {
        const textWidth = estimateTextWidth(group, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        const itemWidth = legendColorBoxSize + legendPadding + Math.min(textWidth, legendTextMaxWidth) + legendPadding * 2;
        totalLegendWidth += itemWidth;
        return { group, index: i, width: itemWidth, textWidth };
    });
    
    const legendSpacing = 10; // Spacing between legend items
    totalLegendWidth += (groups.length -1) * legendSpacing;

    const legendStartX = (containerWidth - totalLegendWidth) / 2;
    const legendStartY = containerHeight - chartMargins.bottom / 2 - legendItemHeight / 2; // Center in bottom margin

    let currentXOffset = legendStartX;
    legendItems.forEach(item => {
        const groupItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentXOffset}, ${legendStartY})`);

        groupItem.append("rect")
            .attr("class", "mark")
            .attr("x", 0)
            .attr("y", (legendItemHeight - legendColorBoxSize) / 2)
            .attr("width", legendColorBoxSize)
            .attr("height", legendColorBoxSize)
            .style("fill", fillStyle.getCategoryColor(item.group, item.index, groups.length));

        groupItem.append("text")
            .attr("class", "label")
            .attr("x", legendColorBoxSize + legendPadding)
            .attr("y", legendItemHeight / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(item.group.length * parseFloat(fillStyle.typography.annotationFontSize) * 0.6 > legendTextMaxWidth ? item.group.substring(0, Math.floor(legendTextMaxWidth / (parseFloat(fillStyle.typography.annotationFontSize) * 0.6))) + "..." : item.group);
        
        currentXOffset += item.width + legendSpacing;
    });


    // Block 8: Main Data Visualization Rendering
    groups.forEach((group, groupIndex) => {
        const groupData = chartData.filter(d => d[groupField] === group);
        const groupYOffset = groupIndex * groupHeight;
        const groupColor = fillStyle.getCategoryColor(group, groupIndex, groups.length);

        dimensions.forEach((dimension, dimIndex) => {
            const dataPoint = groupData.find(d => d[dimensionField] === dimension);
            if (dataPoint) {
                const barY = groupYOffset + dimIndex * barHeightPerDimension + (barHeightPerDimension - actualBarHeight) / 2;
                const barWidth = xScale(Math.max(0, +dataPoint[valueField])); // Ensure width is not negative

                // Dimension Label and Icon Group
                const labelGroup = mainChartGroup.append("g")
                    .attr("class", "dimension-label-group")
                    .attr("transform", `translate(0, ${barY + actualBarHeight / 2})`);

                const iconUrl = fillStyle.getImageUrl(dimension);
                let currentLabelX = -labelIconGap; // Start from right edge of icon area

                if (iconUrl) {
                    labelGroup.append("image")
                        .attr("class", "icon")
                        .attr("x", -(iconWidth + labelIconGap))
                        .attr("y", -iconHeight / 2)
                        .attr("width", iconWidth)
                        .attr("height", iconHeight)
                        .attr("preserveAspectRatio", "xMidYMid meet")
                        .attr("xlink:href", iconUrl);
                    currentLabelX = -(iconWidth + labelIconGap + maxDimensionLabelWidth); // Position text to the left of icon
                } else {
                     currentLabelX = -(labelIconGap + maxDimensionLabelWidth); // Position text assuming no icon
                }
                
                labelGroup.append("text")
                    .attr("class", "label dimension-label")
                    .attr("x", -labelIconGap) // Position text to the right of where icon would end
                    .attr("y", 0)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(dimension + (dimensionUnit ? ` (${dimensionUnit})` : ''));


                // Bar
                mainChartGroup.append("rect")
                    .attr("class", `mark bar group-${groupIndex} dim-${dimIndex}`)
                    .attr("x", 0)
                    .attr("y", barY)
                    .attr("width", barWidth > 0 ? barWidth : 0) // Handle zero/negative values gracefully
                    .attr("height", actualBarHeight)
                    .style("fill", groupColor)
                    .on("mouseover", function() {
                        d3.select(this).style("opacity", 0.8);
                    })
                    .on("mouseout", function() {
                        d3.select(this).style("opacity", 1);
                    });

                // Value Label
                const valueText = formatValue(+dataPoint[valueField]) + (valueUnit ? `${valueUnit}` : '');
                mainChartGroup.append("text")
                    .attr("class", "value value-label")
                    .attr("x", (barWidth > 0 ? barWidth : 0) + 5) // Position after bar
                    .attr("y", barY + actualBarHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(valueText);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., tooltips, advanced interactions - kept simple here)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}