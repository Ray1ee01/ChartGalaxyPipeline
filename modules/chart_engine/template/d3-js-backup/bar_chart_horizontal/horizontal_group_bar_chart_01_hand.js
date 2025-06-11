/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_group_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
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
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; 
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    let missingFields = [];
    if (!dimensionFieldDef) missingFields.push("x role");
    if (!valueFieldDef) missingFields.push("y role");
    if (!groupFieldDef) missingFields.push("group role");
    
    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: Column roles [${missingFields.join(", ")}] not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionFieldName = dimensionFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const groupFieldName = groupFieldDef.name;
    const valueFieldUnit = (valueFieldDef.unit && valueFieldDef.unit !== "none") ? valueFieldDef.unit : "";


    if (!dimensionFieldName || !valueFieldName || !groupFieldName) {
        const errorMsg = `Critical chart config missing: Field names for roles x, y, or group are undefined. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            groupLabelFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            groupLabelFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            groupLabelFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            
            dimensionLabelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            dimensionLabelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            dimensionLabelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',

            valueLabelFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            valueLabelFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            valueLabelFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#0f223b',
        chartBackground: colors.background_color || '#FFFFFF',
        defaultBarColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4',
        defaultCategoryColors: d3.schemeCategory10,
    };

    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.visibility = 'hidden'; // Not strictly needed for non-DOM element
        // tempSvg.style.position = 'absolute'; // Not strictly needed for non-DOM element
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No DOM append for measurement per spec.
        let width = 0;
        try {
             width = tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on non-DOM element fails
            width = text.length * (parseFloat(fontProps.fontSize) * 0.6); // Rough estimate
        }
        return width;
    };
    
    const formatValue = (value) => {
        if (value === null || typeof value === 'undefined') return "";
        if (value >= 1000000000) return d3.format("~.1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.1f")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];
    const dimensions = [...new Set(chartData.map(d => d[dimensionFieldName]))];

    const getGroupColor = (groupName) => {
        if (colors.field && colors.field[groupName]) {
            return colors.field[groupName];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            const groupIndex = groups.indexOf(groupName);
            return colors.available_colors[groupIndex % colors.available_colors.length];
        }
        const groupIndex = groups.indexOf(groupName);
        return fillStyle.defaultCategoryColors[groupIndex % fillStyle.defaultCategoryColors.length] || fillStyle.defaultBarColor;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-container")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = { top: 20, right: 80, bottom: 20, left: 20 }; 

    const groupLabelStyleProps = { 
        fontFamily: fillStyle.typography.groupLabelFontFamily, 
        fontSize: fillStyle.typography.groupLabelFontSize,
        fontWeight: fillStyle.typography.groupLabelFontWeight
    };
    const dimensionLabelStyleProps = {
        fontFamily: fillStyle.typography.dimensionLabelFontFamily,
        fontSize: fillStyle.typography.dimensionLabelFontSize,
        fontWeight: fillStyle.typography.dimensionLabelFontWeight
    };

    const iconSize = parseFloat(dimensionLabelStyleProps.fontSize) * 1.5;
    const iconPadding = 5; 
    const labelOffsetFromBarStart = 10; 

    let maxDimensionLabelWidth = 0;
    dimensions.forEach(dim => {
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, estimateTextWidth(dim, dimensionLabelStyleProps));
    });

    let maxGroupLabelWidth = 0;
    groups.forEach(grp => {
        maxGroupLabelWidth = Math.max(maxGroupLabelWidth, estimateTextWidth(grp, groupLabelStyleProps));
    });
    
    const hasAnyIcons = images.field && Object.keys(images.field).length > 0 && dimensions.some(dim => images.field[dim]);

    const leftSpaceForDimensionLabels = maxDimensionLabelWidth + (hasAnyIcons ? (iconSize + iconPadding) : 0) + labelOffsetFromBarStart;
    const leftSpaceForGroupLabels = maxGroupLabelWidth + labelOffsetFromBarStart; 
    
    chartMargins.left = Math.max(chartMargins.left, leftSpaceForDimensionLabels, leftSpaceForGroupLabels);
    
    const groupLabelFontSizePx = parseFloat(fillStyle.typography.groupLabelFontSize);
    chartMargins.top = Math.max(chartMargins.top, groupLabelFontSizePx / 2 + 10); // Extra 5px from original + 5 for breathing room

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const groupHeight = innerHeight / Math.max(1, groups.length); // Avoid division by zero
    const groupPaddingBetweenGroups = groupHeight * 0.25; 

    const dimensionSlotHeight = (groupHeight - groupPaddingBetweenGroups) / Math.max(1, dimensions.length);
    const barPaddingInDimensionSlot = dimensionSlotHeight * 0.2; 
    const actualBarHeight = Math.max(1, dimensionSlotHeight - barPaddingInDimensionSlot); // Ensure positive height
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "other chart-area");

    // Block 5: Data Preprocessing & Transformation
    // Data is suitable for direct use.

    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartData, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue * 1.1 : 10]) 
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering
    // No axes, gridlines, or separate legend.

    // Block 8: Main Data Visualization Rendering
    groups.forEach((group, groupIndex) => {
        const groupElement = mainChartGroup.append("g")
            .attr("class", `other group-container group-${group.toString().replace(/\s+/g, '-')}`)
            .attr("transform", `translate(0, ${groupIndex * groupHeight})`);

        const groupLabelYPos = (groupPaddingBetweenGroups / 2) - (groupLabelFontSizePx / 2) - 5;

        groupElement.append("text")
            .attr("class", "label group-label")
            .attr("x", -labelOffsetFromBarStart)
            .attr("y", groupLabelYPos) 
            .attr("dy", "0.35em") 
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.groupLabelFontFamily)
            .style("font-size", fillStyle.typography.groupLabelFontSize)
            .style("font-weight", fillStyle.typography.groupLabelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);

        const groupData = chartData.filter(d => d[groupFieldName] === group);

        dimensions.forEach((dimension, dimIndex) => {
            const dataPoint = groupData.find(d => d[dimensionFieldName] === dimension);
            if (!dataPoint) return;

            const barY = groupPaddingBetweenGroups / 2 + dimIndex * dimensionSlotHeight + barPaddingInDimensionSlot / 2;
            const barWidthValue = +dataPoint[valueFieldName];
            const barWidth = xScale(barWidthValue > 0 ? barWidthValue : 0); // Ensure non-negative input to scale

            const dimensionLabelGroup = groupElement.append("g")
                .attr("class", "other dimension-item-container")
                .attr("transform", `translate(0, ${barY + actualBarHeight / 2})`);

            const iconUrl = images.field && images.field[dimension] ? images.field[dimension] : null;
            const dimensionLabelTextX = -labelOffsetFromBarStart;

            if (iconUrl && hasAnyIcons) {
                const iconLeftEdge = dimensionLabelTextX - maxDimensionLabelWidth - iconPadding - iconSize;
                dimensionLabelGroup.append("image")
                    .attr("class", "image icon dimension-icon")
                    .attr("xlink:href", iconUrl)
                    .attr("x", iconLeftEdge)
                    .attr("y", -iconSize / 2)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
            
            dimensionLabelGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", dimensionLabelTextX) 
                .attr("y", 0)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.dimensionLabelFontFamily)
                .style("font-size", fillStyle.typography.dimensionLabelFontSize)
                .style("font-weight", fillStyle.typography.dimensionLabelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(dimension);

            groupElement.append("rect")
                .attr("class", "mark bar")
                .attr("x", 0)
                .attr("y", barY)
                .attr("width", Math.max(0, barWidth)) 
                .attr("height", actualBarHeight)
                .attr("fill", getGroupColor(group))
                .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
                .on("mouseout", function() { d3.select(this).attr("opacity", 1); });

            const valueText = formatValue(barWidthValue) + valueFieldUnit;
            groupElement.append("text")
                .attr("class", "value data-label")
                .attr("x", Math.max(0, barWidth) + 5) 
                .attr("y", barY + actualBarHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.valueLabelFontFamily)
                .style("font-size", fillStyle.typography.valueLabelFontSize)
                .style("font-weight", fillStyle.typography.valueLabelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(valueText);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Mouseover effects are included in Block 8.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}