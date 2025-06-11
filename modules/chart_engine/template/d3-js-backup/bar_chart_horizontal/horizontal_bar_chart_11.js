/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_11",
  "is_composite": true,
  "required_fields": ["x", "y", "y2", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [0, "inf"], [2, 6]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name;

    const criticalFields = { dimensionField, valueField, groupField, valueField2 };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const dimensionUnit = (dataColumns.find(col => col.role === "x")?.unit === "none" ? "" : dataColumns.find(col => col.role === "x")?.unit) || "";
    const valueUnit = (dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : dataColumns.find(col => col.role === "y")?.unit) || "";
    const valueUnit2 = (dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : dataColumns.find(col => col.role === "y2")?.unit) || "";
    const valueField2Name = dataColumns.find(col => col.role === "y2")?.display_name || valueField2;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            dimensionLabelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            dimensionLabelFontSize: (typography.label && typography.label.font_size) || '12px',
            dimensionLabelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            groupLabelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            // groupLabelFontSize derived dynamically, base from dimensionLabelFontSize
            groupLabelFontWeight: (typography.label && typography.label.font_weight) || 'normal', // typically lighter or normal
            valueLabelFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            // valueLabelFontSize derived dynamically from bar height
            valueLabelFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
            columnTitleFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            columnTitleFontSize: (typography.label && typography.label.font_size) || '12px',
            columnTitleFontWeight: (typography.label && typography.label.font_weight) || 'bold',
        },
        barColor: (colors.other && colors.other.primary) || '#1f77b4',
        textColor: colors.text_color || '#333333',
        valueLabelColorInsideBar: '#FFFFFF',
        iconBackgroundFill: 'rgba(255, 255, 255, 0.7)', // Semi-transparent white for icon backdrop
        chartBackground: colors.background_color || 'transparent', // Default to transparent
    };

    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.style.fontFamily = fontProps.fontFamily || 'Arial, sans-serif';
        textElement.style.fontSize = fontProps.fontSize || '12px';
        textElement.style.fontWeight = fontProps.fontWeight || 'normal';
        textElement.textContent = text;
        svg.appendChild(textElement);
        // No need to append to DOM for getBBox to work on textElement
        const width = textElement.getBBox().width;
        return width;
    }

    const formatValue = (value) => {
        if (value == null || isNaN(value)) return "N/A";
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // Billions
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value).replace('M', 'M'); // Millions
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value).replace('k', 'K'); // Thousands
        return d3.format("~g")(value); // Others
    };
    
    const iconPadding = 5; // Padding around icons
    const minLabelFontSize = 8; // Minimum font size for dynamic dimension/group labels
    const verticalPaddingBetweenDimensionAndGroupLabels = 2;


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
    const chartMargins = {
        top: 30, // Space for potential column title (valueField2Name)
        right: 20, // Initial right margin
        bottom: 20,
        left: 20   // Initial left margin, will be adjusted
    };

    // Pre-calculate maximum label widths to adjust margins
    let maxDimensionLabelWidth = 0;
    const uniqueDimensions = [...new Set(chartData.map(d => d[dimensionField]))];

    uniqueDimensions.forEach(dim => {
        const dataPoint = chartData.find(d => d[dimensionField] === dim);
        const groupName = dataPoint ? dataPoint[groupField] : "";
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;

        const dimWidth = estimateTextWidth(formattedDim, {
            fontFamily: fillStyle.typography.dimensionLabelFontFamily,
            fontSize: fillStyle.typography.dimensionLabelFontSize,
            fontWeight: fillStyle.typography.dimensionLabelFontWeight
        });
        const groupWidth = estimateTextWidth(groupName, {
            fontFamily: fillStyle.typography.groupLabelFontFamily,
            fontSize: `${parseInt(fillStyle.typography.dimensionLabelFontSize) * 0.8}px`, // Approximate group label size
            fontWeight: fillStyle.typography.groupLabelFontWeight
        });
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, dimWidth, groupWidth);
    });
    
    // Approximate icon width (assuming square icons, related to eventual bar height)
    // This is a bit of a chicken-and-egg, so we use a typical proportion or a fixed guess.
    // Let's assume icons will be roughly 20-30px.
    const estimatedIconWidth = variables.iconWidth || 24; // Make it configurable or estimate better
    chartMargins.left = Math.max(chartMargins.left, maxDimensionLabelWidth + estimatedIconWidth + iconPadding * 2);

    let maxValue2Width = 0;
    chartData.forEach(d => {
        const formattedVal2 = valueUnit2 ? `${formatValue(d[valueField2])}${valueUnit2}` : `${formatValue(d[valueField2])}`;
        const val2Width = estimateTextWidth(formattedVal2, {
            fontFamily: fillStyle.typography.valueLabelFontFamily,
            fontSize: fillStyle.typography.dimensionLabelFontSize, // Use a reference size, actual size is dynamic
            fontWeight: fillStyle.typography.valueLabelFontWeight
        });
        maxValue2Width = Math.max(maxValue2Width, val2Width);
    });
    const valueField2TitleWidth = estimateTextWidth(valueField2Name, {
        fontFamily: fillStyle.typography.columnTitleFontFamily,
        fontSize: fillStyle.typography.columnTitleFontSize,
        fontWeight: fillStyle.typography.columnTitleFontWeight
    });
    maxValue2Width = Math.max(maxValue2Width, valueField2TitleWidth);
    chartMargins.right = Math.max(chartMargins.right, maxValue2Width + 20); // 20px padding from edge

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const sortedChartData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensionNames = sortedChartData.map(d => d[dimensionField]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensionNames)
        .range([0, innerHeight])
        .padding(variables.barPaddingFactor !== undefined ? variables.barPaddingFactor : 0.25);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedChartData, d => +d[valueField]) * 1.05 || 10]) // Add 5% margin, or 10 if max is 0
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Render Y2 column title
    if (valueField2Name && sortedDimensionNames.length > 0) {
        mainChartGroup.append("text")
            .attr("class", "label column-title y2-column-title")
            .attr("x", innerWidth + chartMargins.right - 10) // Positioned at the far right
            .attr("y", yScale(sortedDimensionNames[0]) - 10) // Above the first bar
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.columnTitleFontFamily)
            .style("font-size", fillStyle.typography.columnTitleFontSize)
            .style("font-weight", fillStyle.typography.columnTitleFontWeight)
            .style("fill", fillStyle.textColor)
            .text(valueField2Name);
    }
    
    // Icon backdrop (semi-transparent rectangle)
    // Calculate based on actual barHeight later if possible, or use estimatedIconWidth
    const barHeight = yScale.bandwidth();
    const actualIconSize = barHeight; // Icons scale with bar height

    if (images.field && Object.keys(images.field).length > 0 && sortedDimensionNames.length > 0) {
         mainChartGroup.append("rect")
            .attr("class", "other icon-background")
            .attr("x", -(actualIconSize + iconPadding) - iconPadding / 2)
            .attr("y", -iconPadding / 2)
            .attr("width", actualIconSize + iconPadding)
            .attr("height", innerHeight + iconPadding)
            .attr("fill", fillStyle.iconBackgroundFill);
    }


    // Block 8: Main Data Visualization Rendering
    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(sortedChartData)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(0, ${yScale(d[dimensionField])})`);

    barGroups.append("rect")
        .attr("class", "mark bar")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", d => xScale(+d[valueField]))
        .attr("height", barHeight)
        .attr("fill", fillStyle.barColor)
        .on("mouseover", function() { d3.select(this).style("opacity", 0.8); })
        .on("mouseout", function() { d3.select(this).style("opacity", 1); });

    // Render Icons, Dimension Labels, and Group Labels
    barGroups.each(function(d, i) {
        const groupElement = d3.select(this);
        const dimensionName = d[dimensionField];
        const groupName = d[groupField];
        const iconUrl = (images.field && images.field[groupName]) || (images.other && images.other[groupName]);

        const currentActualIconSize = barHeight; // Icon size matches bar height
        const iconXPosition = -(currentActualIconSize + iconPadding);
        const labelXPosition = iconXPosition - iconPadding;

        if (iconUrl) {
            groupElement.append("image")
                .attr("class", "image group-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", iconXPosition)
                .attr("y", 0)
                .attr("width", currentActualIconSize)
                .attr("height", currentActualIconSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

        // Dynamic font sizing for dimension and group labels
        let dimFontSize = parseInt(fillStyle.typography.dimensionLabelFontSize);
        let grpFontSize = Math.max(minLabelFontSize, Math.round(dimFontSize * 0.8));

        while (
            (dimFontSize + grpFontSize + verticalPaddingBetweenDimensionAndGroupLabels > barHeight) &&
            dimFontSize > minLabelFontSize
        ) {
            dimFontSize--;
            grpFontSize = Math.max(minLabelFontSize, Math.round(dimFontSize * 0.8));
        }
        if (dimFontSize === minLabelFontSize) {
            while (
                (dimFontSize + grpFontSize + verticalPaddingBetweenDimensionAndGroupLabels > barHeight) &&
                grpFontSize > minLabelFontSize
            ) {
                grpFontSize--;
            }
        }
        
        const totalTextHeight = dimFontSize + grpFontSize + (groupName ? verticalPaddingBetweenDimensionAndGroupLabels : 0);
        const labelsTopY = (barHeight - totalTextHeight) / 2;
        
        const dimensionLabelY = labelsTopY + dimFontSize / 2;
        const groupLabelY = labelsTopY + dimFontSize + (groupName ? verticalPaddingBetweenDimensionAndGroupLabels : 0) + grpFontSize / 2;

        const formattedDimText = dimensionUnit ? `${dimensionName}${dimensionUnit}` : `${dimensionName}`;
        groupElement.append("text")
            .attr("class", "label dimension-label")
            .attr("x", labelXPosition)
            .attr("y", dimensionLabelY)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.dimensionLabelFontFamily)
            .style("font-size", `${dimFontSize}px`)
            .style("font-weight", fillStyle.typography.dimensionLabelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedDimText);

        if (groupName) {
            groupElement.append("text")
                .attr("class", "label group-label")
                .attr("x", labelXPosition)
                .attr("y", groupLabelY)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.groupLabelFontFamily)
                .style("font-size", `${grpFontSize}px`)
                .style("font-weight", fillStyle.typography.groupLabelFontWeight)
                .style("fill", fillStyle.textColor)
                .style("opacity", 0.85)
                .text(groupName);
        }

        // Value labels for primary value (yField)
        const primaryValueText = valueUnit ? `${formatValue(d[valueField])}${valueUnit}` : `${formatValue(d[valueField])}`;
        const dynamicValueFontSize = Math.max(minLabelFontSize, barHeight * 0.5); // Ensure minimum size
        
        const primaryValueTextWidth = estimateTextWidth(primaryValueText, {
            fontFamily: fillStyle.typography.valueLabelFontFamily,
            fontSize: `${dynamicValueFontSize}px`,
            fontWeight: fillStyle.typography.valueLabelFontWeight
        });

        const textFitsInsideBar = xScale(+d[valueField]) > primaryValueTextWidth + 10; // 10px padding

        groupElement.append("text")
            .attr("class", "label value-label primary-value-label")
            .attr("x", textFitsInsideBar ? xScale(+d[valueField]) - 5 : xScale(+d[valueField]) + 5)
            .attr("y", barHeight / 2)
            .attr("text-anchor", textFitsInsideBar ? "end" : "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.valueLabelFontFamily)
            .style("font-size", `${dynamicValueFontSize}px`)
            .style("font-weight", fillStyle.typography.valueLabelFontWeight)
            .style("fill", textFitsInsideBar ? fillStyle.valueLabelColorInsideBar : fillStyle.textColor)
            .text(primaryValueText);

        // Value labels for secondary value (y2Field)
        const secondaryValueText = valueUnit2 ? `${formatValue(d[valueField2])}${valueUnit2}` : `${formatValue(d[valueField2])}`;
        groupElement.append("text")
            .attr("class", "label value-label secondary-value-label")
            .attr("x", innerWidth + chartMargins.right - 10) // Positioned at the far right
            .attr("y", barHeight / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.valueLabelFontFamily)
            .style("font-size", `${dynamicValueFontSize}px`) // Use same dynamic size as primary for consistency
            .style("font-weight", fillStyle.typography.valueLabelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(secondaryValueText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (Mouseover interactions are already added to bars)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}