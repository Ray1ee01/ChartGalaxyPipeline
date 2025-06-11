/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_group_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 8], [0, "inf"], [2, 6]],
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
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END
*/
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const sourceTypography = data.typography || {};
    const sourceColors = data.colors || {};
    // const sourceImages = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x"; // Dimension
    const yFieldRole = "y"; // Value
    const groupFieldRole = "group"; // Group

    const xCol = dataColumns.find(col => col.role === xFieldRole);
    const yCol = dataColumns.find(col => col.role === yFieldRole);
    const groupCol = dataColumns.find(col => col.role === groupFieldRole);

    const missingFields = [];
    if (!xCol) missingFields.push(`Column with role '${xFieldRole}'`);
    if (!yCol) missingFields.push(`Column with role '${yFieldRole}'`);
    if (!groupCol) missingFields.push(`Column with role '${groupFieldRole}'`);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>Error: ${errorMessage}</div>`);
        return null;
    }

    const dimensionField = xCol.name;
    const valueField = yCol.name;
    const groupField = groupCol.name;

    const valueUnit = (yCol.unit && yCol.unit !== "none") ? yCol.unit : "";
    // dimensionUnit and groupUnit not actively used in this chart's rendering logic beyond potential data understanding.

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};
    const defaultCategoricalColors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

    fillStyle.typography = {
        label: {
            fontFamily: (sourceTypography.label && sourceTypography.label.font_family) ? sourceTypography.label.font_family : 'Arial, sans-serif',
            fontSize: (sourceTypography.label && sourceTypography.label.font_size) ? sourceTypography.label.font_size : '12px',
            fontWeight: (sourceTypography.label && sourceTypography.label.font_weight) ? sourceTypography.label.font_weight : 'normal',
        },
        annotation: { // For value labels
            fontFamily: (sourceTypography.annotation && sourceTypography.annotation.font_family) ? sourceTypography.annotation.font_family : 'Arial, sans-serif',
            fontSize: (sourceTypography.annotation && sourceTypography.annotation.font_size) ? sourceTypography.annotation.font_size : '10px',
            fontWeight: (sourceTypography.annotation && sourceTypography.annotation.font_weight) ? sourceTypography.annotation.font_weight : 'normal',
        }
    };

    fillStyle.textColor = sourceColors.text_color || '#333333';
    fillStyle.chartBackground = sourceColors.background_color || '#FFFFFF'; // Not directly used on SVG, but good to have
    fillStyle.primaryColor = (sourceColors.other && sourceColors.other.primary) ? sourceColors.other.primary : defaultCategoricalColors[0];
    
    fillStyle.groupLabelBackgroundColor = '#FFFFFF'; // Default for group label background
    fillStyle.groupLabelTextColor = '#000000';       // Default for group label text

    fillStyle.groupColorMappings = {}; // To be populated after groups are known

    function initializeGroupColors(uniqueGroupNames) {
        const groupColorMap = sourceColors.field || {};
        const availableColorsList = (sourceColors.available_colors && sourceColors.available_colors.length > 0) 
            ? sourceColors.available_colors 
            : defaultCategoricalColors;
        
        uniqueGroupNames.forEach((name, index) => {
            if (groupColorMap[name]) {
                fillStyle.groupColorMappings[name] = groupColorMap[name];
            } else {
                fillStyle.groupColorMappings[name] = availableColorsList[index % availableColorsList.length];
            }
        });
    }
    
    function getBarColor(groupName) {
        return fillStyle.groupColorMappings[groupName] || fillStyle.primaryColor;
    }

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight = 'normal') {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // No DOM attachment needed for getBBox on SVGTextElement with explicit attributes
        return textElement.getBBox().width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~s")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg");
        // No viewBox, width="100%", or height="auto"

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 20, // Reduced top margin as no main title
        right: 80, // Space for value labels
        bottom: 30,
        left: 150 // Initial, will be adjusted
    };

    // Data-dependent margin calculation (left margin for labels)
    const uniqueDimensionNames = [...new Set(chartData.map(d => d[dimensionField]))];
    const uniqueGroupNames = [...new Set(chartData.map(d => d[groupField]))];

    let maxDimensionLabelWidth = 0;
    uniqueDimensionNames.forEach(name => {
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, estimateTextWidth(
            name, 
            fillStyle.typography.label.fontFamily, 
            fillStyle.typography.label.fontSize,
            fillStyle.typography.label.fontWeight
        ));
    });
    
    // Group labels are positioned differently, but their width might influence overall chart placement if extremely long.
    // For this layout, dimension labels are the primary driver for margin.left.
    chartMargins.left = Math.max(chartMargins.left, maxDimensionLabelWidth + 25); // 20 for label itself, 5 for padding from bar

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Vertical space allocation
    const dimensionsPerGroup = {};
    let totalDimensionsInChart = 0;
    uniqueGroupNames.forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        const groupDimensions = [...new Set(groupData.map(d => d[dimensionField]))];
        dimensionsPerGroup[group] = groupDimensions.length;
        totalDimensionsInChart += groupDimensions.length;
    });

    const groupTitleHeight = 25; // Space for each group's label
    const groupMargin = 20;      // Space between groups
    
    const totalGroupMarginsHeight = (uniqueGroupNames.length - 1) * groupMargin;
    const totalGroupTitlesHeight = uniqueGroupNames.length * groupTitleHeight;
    
    const availableBarSpace = innerHeight - totalGroupMarginsHeight - totalGroupTitlesHeight;
    const idealBarHeight = totalDimensionsInChart > 0 ? availableBarSpace / totalDimensionsInChart : 20; // Avoid division by zero
    const barPadding = idealBarHeight * 0.2; // Padding between bars within a group

    const groupPositions = {};
    let currentYOffset = 0;
    uniqueGroupNames.forEach(group => {
        const numDimensionsInGroup = dimensionsPerGroup[group];
        const totalBarSpacingInGroup = (numDimensionsInGroup > 0 ? numDimensionsInGroup -1 : 0) * barPadding;
        const totalBarsHeightInGroup = numDimensionsInGroup * idealBarHeight;
        const groupHeight = groupTitleHeight + totalBarsHeightInGroup + totalBarSpacingInGroup;

        groupPositions[group] = {
            startY: currentYOffset,
            height: groupHeight,
            barHeight: idealBarHeight,
            barPadding: barPadding,
            titleHeight: groupTitleHeight
        };
        currentYOffset += groupHeight + groupMargin;
    });
    
    // Block 5: Data Preprocessing & Transformation
    // `uniqueDimensionNames` and `uniqueGroupNames` already extracted in Block 4.
    // `dimensionsPerGroup` and `totalDimensionsInChart` also calculated.
    initializeGroupColors(uniqueGroupNames); // Initialize color mappings now that groups are known

    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartData, d => +d[valueField]) || 0;
    const xScale = d3.scaleLinear()
        .domain([0, maxValue * 1.1]) // Add 10% padding to max value
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-area")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    uniqueGroupNames.forEach((groupName) => {
        const groupPos = groupPositions[groupName];
        const groupLabelY = groupPos.startY + groupPos.titleHeight / 2;
        
        const groupLabelGroup = mainChartGroup.append("g")
            .attr("class", "group-label-container")
            .attr("transform", `translate(0, ${groupLabelY})`);

        const groupLabelTextWidth = estimateTextWidth(
            groupName, 
            fillStyle.typography.label.fontFamily, 
            fillStyle.typography.label.fontSize, 
            fillStyle.typography.label.fontWeight
        );
        // Estimate height based on font size (approximate)
        const groupLabelTextHeight = parseFloat(fillStyle.typography.label.fontSize); 
        const rectPadding = { x: 4, y: 2 };

        groupLabelGroup.append("rect")
            .attr("class", "other group-label-background")
            .attr("x", -chartMargins.left + 1) // Align with very left edge of chart area
            .attr("y", -groupLabelTextHeight / 2 - rectPadding.y)
            .attr("width", groupLabelTextWidth + rectPadding.x * 2 + 5)
            .attr("height", groupLabelTextHeight + rectPadding.y * 2)
            .attr("fill", fillStyle.groupLabelBackgroundColor);
        
        groupLabelGroup.append("text")
            .attr("class", "label group-label-text")
            .attr("x", -chartMargins.left + 1 + rectPadding.x) // Indent text within background
            .attr("y", 0)
            .attr("dy", "0.35em") // Vertical centering
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.label.fontFamily)
            .style("font-size", fillStyle.typography.label.fontSize)
            .style("font-weight", fillStyle.typography.label.fontWeight)
            .style("fill", fillStyle.groupLabelTextColor)
            .text(groupName);
    });

    // Block 8: Main Data Visualization Rendering
    uniqueGroupNames.forEach((groupName) => {
        const groupPos = groupPositions[groupName];
        const groupData = chartData.filter(d => d[groupField] === groupName);
        const groupDimensions = [...new Set(groupData.map(d => d[dimensionField]))]; // Maintain order if any

        groupDimensions.forEach((dimensionName, dimIndex) => {
            const dataPoint = groupData.find(d => d[dimensionField] === dimensionName);
            if (!dataPoint) return;

            const barY = groupPos.startY + groupPos.titleHeight + dimIndex * (groupPos.barHeight + groupPos.barPadding);
            const barWidth = xScale(+dataPoint[valueField]);
            const barColor = getBarColor(groupName);

            // Dimension Label
            mainChartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", -5) // Position to the left of bar start
                .attr("y", barY + groupPos.barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.label.fontFamily)
                .style("font-size", fillStyle.typography.label.fontSize)
                .style("font-weight", fillStyle.typography.label.fontWeight)
                .style("fill", fillStyle.textColor)
                .text(dimensionName);

            // Bar
            mainChartGroup.append("rect")
                .attr("class", "mark bar")
                .attr("x", 0)
                .attr("y", barY)
                .attr("width", Math.max(0, barWidth)) // Ensure width is not negative
                .attr("height", groupPos.barHeight)
                .attr("fill", barColor);

            // Value Label
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            mainChartGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", Math.max(0, barWidth) + 5) // Position to the right of bar end
                .attr("y", barY + groupPos.barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.annotation.fontFamily)
                .style("font-size", fillStyle.typography.annotation.fontSize)
                .style("font-weight", fillStyle.typography.annotation.fontWeight)
                .style("fill", barColor) // Using bar color for value label text
                .text(formattedValue);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like complex interactions, annotations beyond value labels, or icons in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}