/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Group Bar Chart",
  "chart_name": "horizontal_group_bar_chart_icons_01",
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

  "elementAlignment": "none",
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const chartData = data.data.data || [];
    const dataColumns = data.data.columns || [];
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Assuming light theme, or adapt if dark theme is primary
    const imagesInput = data.images || {};

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getField = (role) => dataColumns.find(col => col.role === role);

    const xFieldDef = getField(xFieldRole);
    const yFieldDef = getField(yFieldRole);
    const groupFieldDef = getField(groupFieldRole);

    const xFieldName = xFieldDef?.name;
    const yFieldName = yFieldDef?.name;
    const groupFieldName = groupFieldDef?.name;

    const xFieldUnit = xFieldDef?.unit !== "none" ? xFieldDef?.unit : "";
    const yFieldUnit = yFieldDef?.unit !== "none" ? yFieldDef?.unit : "";
    // const groupFieldUnit = groupFieldDef?.unit !== "none" ? groupFieldDef?.unit : ""; // Not typically used for group labels

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push(`field with role '${xFieldRole}'`);
        if (!yFieldName) missingFields.push(`field with role '${yFieldRole}'`);
        if (!groupFieldName) missingFields.push(`field with role '${groupFieldRole}'`);
        
        const errorMessage = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyInput.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyInput.label?.font_size || '12px',
            labelFontWeight: typographyInput.label?.font_weight || 'normal',
            annotationFontFamily: typographyInput.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyInput.annotation?.font_size || '10px',
            annotationFontWeight: typographyInput.annotation?.font_weight || 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF', // Used for SVG background
        defaultGroupColors: colorsInput.available_colors || d3.schemeCategory10,
        groupColorMap: colorsInput.field || {},
        getImageUrl: (key) => {
            if (imagesInput.field && imagesInput.field[key]) {
                return imagesInput.field[key];
            }
            if (imagesInput.other && imagesInput.other[key]) { // For generic icons if needed
                return imagesInput.other[key];
            }
            return null;
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // No DOM append needed for getBBox on text in modern browsers
        return textElement.getBBox().width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const initialChartMargins = { top: 50, right: 30, bottom: 30, left: 60 }; // Adjusted bottom, legend needs top space

    // Pre-calculate dimensions and groups for scale domains and label width estimation
    const dimensions = [...new Set(chartData.map(d => d[xFieldName]))];
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];
    
    // Temporary yScale to get bandwidth for accurate icon size in label measurement
    const tempInnerHeight = containerHeight - initialChartMargins.top - initialChartMargins.bottom;
    const tempYScale = d3.scaleBand().domain(dimensions).range([0, tempInnerHeight]).padding(0.1);
    const tempBarBandwidth = tempYScale.bandwidth();
    const iconHeightForMeasurement = tempBarBandwidth > 0 ? tempBarBandwidth * 0.8 : 20; // Use 20px if bandwidth is 0 (e.g. no data)
    const iconWidthForMeasurement = iconHeightForMeasurement * 1.33;
    const iconPadding = 5;

    let maxDimensionLabelWidth = 0;
    dimensions.forEach(dim => {
        const labelText = xFieldUnit ? `${dim}${xFieldUnit}` : `${dim}`;
        let textWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        let iconSpace = 0;
        if (fillStyle.getImageUrl(dim)) {
            iconSpace = iconWidthForMeasurement + iconPadding;
        }
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, iconSpace + textWidth);
    });
    
    let maxValueLabelWidth = 0;
    chartData.forEach(d => {
        const valueText = yFieldUnit ? `${formatValue(+d[yFieldName])}${yFieldUnit}` : `${formatValue(+d[yFieldName])}`;
        const textWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });

    const chartMargins = { ...initialChartMargins };
    chartMargins.left = Math.max(initialChartMargins.left, maxDimensionLabelWidth + 20); // Add some padding
    chartMargins.right = Math.max(initialChartMargins.right, maxValueLabelWidth + 10); // Add some padding

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const message = "Calculated chart area is too small. Adjust dimensions or margins.";
        console.error(message);
        svgRoot.append("text").text(message).attr("x", 10).attr("y", 20).attr("fill", "red");
        return svgRoot.node();
    }
    
    // Block 5: Data Preprocessing & Transformation
    // `dimensions` and `groups` already extracted in Block 4 for measurement.
    // No further major transformation needed for this chart type.

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.1); // Fixed padding, removed variables.has_spacing

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[yFieldName]) || 0]) // Ensure domain starts at 0, handle empty data
        .range([0, innerWidth]);

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => fillStyle.groupColorMap[group] || fillStyle.defaultGroupColors[i % fillStyle.defaultGroupColors.length]));

    // Block 7: Chart Component Rendering (Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "chart-area");

    if (groups.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(0, ${chartMargins.top / 2})`); // Positioned in top margin

        const legendItemPadding = 10;
        const legendRectSize = 15;
        let legendItemsWidths = [];
        let currentLegendX = 0;

        groups.forEach((group, i) => {
            const itemGroup = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentLegendX}, 0)`);

            itemGroup.append("rect")
                .attr("width", legendRectSize)
                .attr("height", legendRectSize)
                .attr("fill", colorScale(group))
                .attr("class", "mark");

            const legendText = itemGroup.append("text")
                .attr("x", legendRectSize + 5)
                .attr("y", legendRectSize / 2)
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(group)
                .attr("class", "label");
            
            const itemWidth = legendRectSize + 5 + legendText.node().getBBox().width + legendItemPadding;
            legendItemsWidths.push(itemWidth);
            currentLegendX += itemWidth;
        });
        
        const totalLegendWidth = d3.sum(legendItemsWidths) - legendItemPadding; // Remove last padding
        legendGroup.attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2 - legendRectSize / 2})`);
    }
    
    // Block 8: Main Data Visualization Rendering (Bars & Value Labels)
    // Block 9: Optional Enhancements & Post-Processing (Dimension Labels & Icons)
    // These are combined per dimension for clarity as in original.

    const dimensionElements = mainChartGroup.selectAll(".dimension-group")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "dimension-group")
        .attr("transform", d => `translate(0, ${yScale(d)})`);

    dimensionElements.each(function(dimension) {
        const dimensionGroup = d3.select(this);
        const dimensionData = chartData.filter(d => d[xFieldName] === dimension);
        const barBandwidth = yScale.bandwidth();
        const groupBarHeight = barBandwidth / groups.length;

        // Render dimension label and icon (Block 9 part)
        const labelY = barBandwidth / 2;
        let currentXOffsetForLabel = 0; // Start from right to left for label elements

        const dimensionLabelText = xFieldUnit ? `${dimension}${xFieldUnit}` : `${dimension}`;
        const dimLabel = dimensionGroup.append("text")
            .attr("y", labelY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(dimensionLabelText)
            .attr("class", "label x-axis-label");
        
        currentXOffsetForLabel -= (dimLabel.node().getBBox().width + 5); // Add padding
        dimLabel.attr("x", currentXOffsetForLabel);


        const iconUrl = fillStyle.getImageUrl(dimension);
        if (iconUrl) {
            const iconHeight = barBandwidth * 0.8;
            const iconWidth = iconHeight * 1.33;
            currentXOffsetForLabel -= (iconPadding + iconWidth);

            dimensionGroup.append("image")
                .attr("x", currentXOffsetForLabel)
                .attr("y", labelY - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl)
                .attr("class", "icon dimension-icon");
        }


        // Render bars and value labels (Block 8 part)
        groups.forEach((group, groupIndex) => {
            const dataPoint = dimensionData.find(d => d[groupFieldName] === group);
            if (dataPoint) {
                const value = +dataPoint[yFieldName];
                if (isNaN(value)) return; // Skip if value is not a number

                const barWidthValue = xScale(value);
                const barY = groupIndex * groupBarHeight;

                dimensionGroup.append("rect")
                    .attr("x", 0)
                    .attr("y", barY)
                    .attr("width", barWidthValue)
                    .attr("height", groupBarHeight)
                    .attr("fill", colorScale(group))
                    .attr("class", "mark bar")
                    .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
                    .on("mouseout", function() { d3.select(this).attr("opacity", 1); });

                const formattedValueText = yFieldUnit ? `${formatValue(value)}${yFieldUnit}` : `${formatValue(value)}`;
                const valueLabelFontSize = Math.max(groupBarHeight * 0.5, parseFloat(fillStyle.typography.annotationFontSize));

                dimensionGroup.append("text")
                    .attr("x", barWidthValue + 5) // Position to the right of the bar
                    .attr("y", barY + groupBarHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${valueLabelFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formattedValueText)
                    .attr("class", "value label");
            }
        });
    });
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}