/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_group_bar_chart_04",
  "is_composite": false,
  "required_fields": ["x", "y", "group", "group2"],
  "hierarchy": ["group", "group2"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5], [2, 5]],
  "required_fields_icons": ["x", "group2"],
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
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END
*/
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    const primaryGroupFieldDef = dataColumns.find(col => col.role === "group");
    const secondaryGroupFieldDef = dataColumns.find(col => col.role === "group2");

    const criticalFieldNames = {};
    if (dimensionFieldDef) criticalFieldNames.dimensionFieldName = dimensionFieldDef.name; else criticalFieldNames.dimensionFieldName = undefined;
    if (valueFieldDef) criticalFieldNames.valueFieldName = valueFieldDef.name; else criticalFieldNames.valueFieldName = undefined;
    if (primaryGroupFieldDef) criticalFieldNames.primaryGroupFieldName = primaryGroupFieldDef.name; else criticalFieldNames.primaryGroupFieldName = undefined;
    if (secondaryGroupFieldDef) criticalFieldNames.secondaryGroupFieldName = secondaryGroupFieldDef.name; else criticalFieldNames.secondaryGroupFieldName = undefined;
    
    const missingFieldKeys = Object.keys(criticalFieldNames).filter(key => !criticalFieldNames[key]);
    if (missingFieldKeys.length > 0) {
        const errorMessage = `Critical chart config missing for roles: ${missingFieldKeys.map(k => k.replace("FieldName","")).join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }
    const { dimensionFieldName, valueFieldName, primaryGroupFieldName, secondaryGroupFieldName } = criticalFieldNames;

    const valueFieldUnit = valueFieldDef.unit && valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            // titleFontFamily, titleFontSize, titleFontWeight are not used as titles are disallowed.
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        defaultBarColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#3ca951',
        getBarColor: (groupName, index) => {
            if (colorsConfig.field && colorsConfig.field[groupName]) {
                return colorsConfig.field[groupName];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
            }
            return fillStyle.defaultBarColor;
        },
        groupHighlightBackgroundOpacity: variables.groupHighlightBackgroundOpacity !== undefined ? variables.groupHighlightBackgroundOpacity : 0.1,
        baselineColor: variables.baselineColor || '#cccccc',
    };
    
    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        const num = Number(value);
        if (isNaN(num)) return String(value); // Return as string if not a number after conversion

        if (Math.abs(num) >= 1000000000) {
            return d3.format("~g")(num / 1000000000) + "B";
        } else if (Math.abs(num) >= 1000000) {
            return d3.format("~g")(num / 1000000) + "M";
        } else if (Math.abs(num) >= 1000) {
            return d3.format("~g")(num / 1000) + "K";
        }
        return d3.format("~g")(num);
    };

    // Icon dimensions
    const iconWidth = variables.iconWidth || 20;
    const iconHeight = variables.iconHeight || 15;
    const iconPadding = variables.iconPadding || 5;
    const numIconsPerRow = 2; 
    const totalLeftIconsWidth = (iconWidth + iconPadding) * numIconsPerRow - iconPadding; // Total width for icons to the left

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.marginTop || 20,
        right: variables.marginRight || 60, 
        bottom: variables.marginBottom || 30,
        left: variables.marginLeft || Math.max(40, totalLeftIconsWidth + 10) // Accommodate icons + padding to baseline
    };
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Check container dimensions and margins.");
        svgRoot.append("text").attr("x", containerWidth/2).attr("y", containerHeight/2).attr("text-anchor","middle").text("Error: Invalid dimensions.");
        return svgRoot.node();
    }
    
    // Block 5: Data Preprocessing & Transformation
    const uniquePrimaryGroups = [...new Set(chartDataArray.map(d => d[primaryGroupFieldName]))];

    const groupedData = {};
    uniquePrimaryGroups.forEach(group => {
        const groupItems = chartDataArray.filter(d => d[primaryGroupFieldName] === group);
        const sortedItems = [...groupItems].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
        groupedData[group] = sortedItems;
    });
    
    let totalBars = 0;
    uniquePrimaryGroups.forEach(group => {
        totalBars += groupedData[group].length;
    });

    if (totalBars === 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "text no-data")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No data available to display.");
        return svgRoot.node();
    }

    const groupPaddingRatio = variables.groupPaddingRatio !== undefined ? variables.groupPaddingRatio : 0.15;
    const barPaddingRatio = variables.barPaddingRatio !== undefined ? variables.barPaddingRatio : 0.2;

    const numDistinctGroups = uniquePrimaryGroups.length;
    let totalAllocatedGroupPaddingHeight = 0;
    let individualGroupPadding = 0;

    if (numDistinctGroups > 1) {
        totalAllocatedGroupPaddingHeight = innerHeight * groupPaddingRatio;
        individualGroupPadding = totalAllocatedGroupPaddingHeight / (numDistinctGroups - 1);
    }
    
    const availableHeightForBarsAndInternalPaddings = innerHeight - totalAllocatedGroupPaddingHeight;
    
    const barHeight = availableHeightForBarsAndInternalPaddings / (totalBars * (1 + barPaddingRatio));
    const barInternalPadding = barHeight * barPaddingRatio;

    const groupHeights = {};
    const groupOffsets = {};
    let currentOffsetY = chartMargins.top;

    uniquePrimaryGroups.forEach(group => {
        const itemCount = groupedData[group].length;
        const currentGroupHeight = itemCount * barHeight + (itemCount > 0 ? (itemCount - 1) * barInternalPadding : 0);
        groupHeights[group] = currentGroupHeight;
        groupOffsets[group] = currentOffsetY;
        currentOffsetY += currentGroupHeight + individualGroupPadding;
    });

    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, maxValue !== undefined && maxValue > 0 ? maxValue * 1.05 : 1])
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, 0)`)
        .attr("class", "main-chart-group");

    mainChartGroup.append("line")
        .attr("class", "line baseline")
        .attr("x1", 0)
        .attr("y1", chartMargins.top)
        .attr("x2", 0)
        .attr("y2", chartMargins.top + innerHeight)
        .attr("stroke", fillStyle.baselineColor)
        .attr("stroke-width", 2);

    // Block 8: Main Data Visualization Rendering
    uniquePrimaryGroups.forEach((pGroup, pGroupIndex) => {
        const currentGroupData = groupedData[pGroup];
        const currentGroupOffset = groupOffsets[pGroup];
        const currentGroupHeight = groupHeights[pGroup];
        const groupBarColor = fillStyle.getBarColor(pGroup, pGroupIndex);

        if (currentGroupData.length > 0 && currentGroupHeight > 0) {
            mainChartGroup.append("rect")
                .attr("class", "background group-background")
                .attr("x", 0)
                .attr("y", currentGroupOffset)
                .attr("width", innerWidth + chartMargins.right)
                .attr("height", currentGroupHeight)
                .attr("fill", d3.color(groupBarColor).copy({opacity: fillStyle.groupHighlightBackgroundOpacity}));

            const lastItemYInGroup = currentGroupOffset + (currentGroupData.length - 1) * (barHeight + barInternalPadding) + barHeight / 2;
            mainChartGroup.append("text")
                .attr("class", "text group-label primary-group-label")
                .attr("x", innerWidth + chartMargins.right - 10)
                .attr("y", lastItemYInGroup)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(pGroup);
        }

        currentGroupData.forEach((d) => {
            const itemValue = +d[valueFieldName];
            // Calculate y position for the current bar
            // This needs to be relative to the start of the group, using barHeight and barInternalPadding
            // The index 'i' is needed here. Let's get it from forEach.
        });


        currentGroupData.forEach((d, i) => { // Added index 'i'
            const yPos = currentGroupOffset + i * (barHeight + barInternalPadding);
            const barWidthValue = xScale(Math.max(0, +d[valueFieldName]));

            mainChartGroup.append("rect")
                .attr("class", "mark bar")
                .attr("x", 0)
                .attr("y", yPos)
                .attr("width", barWidthValue)
                .attr("height", barHeight)
                .attr("fill", groupBarColor);

            let currentIconX = -totalLeftIconsWidth - (iconPadding); // Start icons further left, adjust for overall width calc

            const dimensionValue = d[dimensionFieldName];
            const dimensionIconUrl = imagesConfig.field && imagesConfig.field[dimensionValue] ? imagesConfig.field[dimensionValue] : null;
            if (dimensionIconUrl) {
                mainChartGroup.append("image")
                    .attr("class", "image icon dimension-icon")
                    .attr("x", currentIconX)
                    .attr("y", yPos + (barHeight - iconHeight) / 2)
                    .attr("width", iconWidth)
                    .attr("height", iconHeight)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", dimensionIconUrl);
            }
            currentIconX += iconWidth + iconPadding;

            const secondaryGroupValue = d[secondaryGroupFieldName];
            const secondaryGroupIconUrl = imagesConfig.field && imagesConfig.field[secondaryGroupValue] ? imagesConfig.field[secondaryGroupValue] : null;
            if (secondaryGroupIconUrl) {
                mainChartGroup.append("image")
                    .attr("class", "image icon secondary-group-icon")
                    .attr("x", currentIconX)
                    .attr("y", yPos + (barHeight - iconHeight) / 2)
                    .attr("width", iconWidth)
                    .attr("height", iconHeight)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", secondaryGroupIconUrl);
            }
            
            const formattedVal = formatValue(d[valueFieldName]);
            const valueLabelText = valueFieldUnit ? `${formattedVal}${valueFieldUnit}` : formattedVal;
            
            mainChartGroup.append("text")
                .attr("class", "text value-label")
                .attr("x", barWidthValue + 5)
                .attr("y", yPos + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(valueLabelText);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (No interactive elements or complex annotations in this refactored version)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}