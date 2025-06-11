/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_17",
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
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "ascending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data?.data || [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const groupFieldName = dataColumns.find(col => col.role === "group")?.name;

    let missingFields = [];
    if (!dimensionFieldName) missingFields.push("x role field");
    if (!valueFieldName) missingFields.push("y role field");
    if (!groupFieldName) missingFields.push("group role field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    if (chartDataArray.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }


    const dimensionUnit = dataColumns.find(col => col.role === "x")?.unit !== "none" ? dataColumns.find(col => col.role === "x").unit : "";
    const valueUnit = dataColumns.find(col => col.role === "y")?.unit !== "none" ? dataColumns.find(col => col.role === "y").unit : "";
    const groupUnit = dataColumns.find(col => col.role === "group")?.unit !== "none" ? dataColumns.find(col => col.role === "group").unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: rawTypography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: rawTypography.title?.font_size || '16px',
            titleFontWeight: rawTypography.title?.font_weight || 'bold',
            labelFontFamily: rawTypography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: rawTypography.label?.font_size || '12px',
            labelFontWeight: rawTypography.label?.font_weight || 'normal',
            annotationFontFamily: rawTypography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: rawTypography.annotation?.font_size || '10px',
            annotationFontWeight: rawTypography.annotation?.font_weight || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        textOnBarColor: rawColors.other?.text_on_primary || '#FFFFFF',
        chartBackground: rawColors.background_color || '#FFFFFF',
        defaultPrimaryColor: rawColors.other?.primary || '#4682B4',
        defaultAvailableColors: d3.schemeCategory10,
    };

    const uniqueGroupValues = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    fillStyle.getBarColor = (groupValue) => {
        if (rawColors.field && rawColors.field[groupValue]) {
            return rawColors.field[groupValue];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            const groupIndex = uniqueGroupValues.indexOf(groupValue);
            return rawColors.available_colors[groupIndex % rawColors.available_colors.length];
        }
        const groupIndex = uniqueGroupValues.indexOf(groupValue);
        if (groupIndex !== -1) {
            return fillStyle.defaultAvailableColors[groupIndex % fillStyle.defaultAvailableColors.length];
        }
        return fillStyle.defaultPrimaryColor;
    };

    fillStyle.getIconUrl = (groupValue) => {
        if (rawImages.field && rawImages.field[groupValue]) {
            return rawImages.field[groupValue];
        }
        if (rawImages.other && rawImages.other.primary && uniqueGroupValues.length === 1 && uniqueGroupValues[0] === groupValue) {
             // Use primary 'other' image if only one group and it matches, or as a general fallback if desired
            return rawImages.other.primary;
        }
        return null;
    };
    
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontProps.fontFamily);
        tempTextElement.setAttribute('font-size', fontProps.fontSize);
        tempTextElement.setAttribute('font-weight', fontProps.fontWeight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        return tempTextElement.getBBox().width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 20, // Reduced top margin as no title
        right: 20, // Initial right margin, will be adjusted
        bottom: 70, // For legend
        left: 20,  // Fixed left padding
    };
    const textPadding = 10;

    // Calculate max value label width to adjust right margin
    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const formattedValue = valueUnit ? `${formatValue(d[valueFieldName])}${valueUnit}` : `${formatValue(d[valueFieldName])}`;
        const labelWidth = estimateTextWidth(formattedValue, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize, // Use base annotation size for estimation
            fontWeight: fillStyle.typography.annotationFontWeight,
        });
        maxValueLabelWidth = Math.max(maxValueLabelWidth, labelWidth);
    });
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + textPadding * 2); // Ensure space for value label if outside

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    // Block 5: Data Preprocessing & Transformation
    const dimensions = [...new Set(chartDataArray.map(d => d[dimensionFieldName]))];
    const sortedData = [...chartDataArray].sort((a, b) => a[valueFieldName] - b[valueFieldName]);
    const sortedDimensions = sortedData.map(d => d[dimensionFieldName]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.15; // Fixed bar padding
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => +d[valueFieldName]) * 1.05]) // Add 5% headroom
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendRectSize = 16;
    const legendSpacing = 8;
    const legendTextSize = parseFloat(fillStyle.typography.annotationFontSize);
    const legendItemPaddingHorizontal = 15; // Padding around each legend item

    let legendItemWidths = [];
    let totalLegendWidth = 0;

    uniqueGroupValues.forEach(group => {
        const groupLabelText = groupUnit ? `${group}${groupUnit}` : `${group}`;
        const textWidth = estimateTextWidth(groupLabelText, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: `${legendTextSize}px`,
            fontWeight: fillStyle.typography.annotationFontWeight,
        });
        const itemWidth = legendRectSize + legendSpacing + textWidth + legendItemPaddingHorizontal;
        legendItemWidths.push(itemWidth);
        totalLegendWidth += itemWidth;
    });
    
    totalLegendWidth -= legendItemPaddingHorizontal; // Remove last item's trailing padding for total width calculation

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${containerHeight - chartMargins.bottom / 2 - legendRectSize / 2})`);

    let currentLegendXOffset = 0;
    uniqueGroupValues.forEach((group, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendXOffset}, 0)`);

        legendItem.append("rect")
            .attr("class", "mark legend-color-sample")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", fillStyle.getBarColor(group));

        const groupLabelText = groupUnit ? `${group}${groupUnit}` : `${group}`;
        legendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendRectSize + legendSpacing)
            .attr("y", legendRectSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${legendTextSize}px`)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(groupLabelText);
        
        currentLegendXOffset += legendItemWidths[i];
    });

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    sortedDimensions.forEach((dimension) => {
        const dataPoint = chartDataArray.find(d => d[dimensionFieldName] === dimension);
        if (!dataPoint) return;

        const currentBarHeight = yScale.bandwidth();
        const currentBarWidth = xScale(+dataPoint[valueFieldName]);
        const barY = yScale(dimension);

        // Dynamic text size based on bar height
        const dynamicTextSize = Math.min(20, Math.max(currentBarHeight * 0.45, parseFloat(fillStyle.typography.annotationFontSize)));
        const dynamicIconSize = Math.min(currentBarHeight * 0.7, 30);

        mainChartGroup.append("rect")
            .attr("class", "mark bar")
            .attr("x", 0)
            .attr("y", barY)
            .attr("width", currentBarWidth)
            .attr("height", currentBarHeight)
            .attr("fill", fillStyle.getBarColor(dataPoint[groupFieldName]));

        const groupIconUrl = fillStyle.getIconUrl(dataPoint[groupFieldName]);
        
        const dimensionLabelText = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        const valueLabelText = valueUnit ? `${formatValue(dataPoint[valueFieldName])}${valueUnit}` : `${formatValue(dataPoint[valueFieldName])}`;

        const currentDimLabelWidth = estimateTextWidth(dimensionLabelText, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: `${dynamicTextSize}px`,
            fontWeight: fillStyle.typography.labelFontWeight,
        });
        const currentValueLabelWidth = estimateTextWidth(valueLabelText, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: `${dynamicTextSize}px`,
            fontWeight: fillStyle.typography.annotationFontWeight,
        });

        const iconSpace = groupIconUrl ? dynamicIconSize + textPadding : 0;
        const dimLabelSpace = currentDimLabelWidth + textPadding;
        const totalInternalSpaceRequired = iconSpace + dimLabelSpace;

        let iconX, dimLabelX, valueLabelX;
        let dimLabelAnchor, valueLabelAnchor;
        let dimLabelColor, valueLabelColor;
        const centerY = barY + currentBarHeight / 2;

        if (currentBarWidth < iconSpace + textPadding) { // Bar too narrow for icon
            iconX = currentBarWidth + textPadding;
            dimLabelX = iconX + (groupIconUrl ? dynamicIconSize + textPadding : 0);
            valueLabelX = dimLabelX + currentDimLabelWidth + textPadding;
            dimLabelAnchor = "start"; valueLabelAnchor = "start";
            dimLabelColor = fillStyle.textColor; valueLabelColor = fillStyle.textColor;
        } else if (currentBarWidth < totalInternalSpaceRequired) { // Bar can fit icon, but not dimension label
            iconX = textPadding;
            dimLabelX = currentBarWidth + textPadding;
            valueLabelX = dimLabelX + currentDimLabelWidth + textPadding;
            dimLabelAnchor = "start"; valueLabelAnchor = "start";
            dimLabelColor = fillStyle.textColor; valueLabelColor = fillStyle.textColor;
        } else { // Bar can fit icon and dimension label
            iconX = textPadding;
            dimLabelX = iconX + (groupIconUrl ? dynamicIconSize + textPadding : 0);
            dimLabelAnchor = "start";
            dimLabelColor = fillStyle.textOnBarColor;

            if (currentBarWidth > totalInternalSpaceRequired + currentValueLabelWidth + textPadding * 2) { // Value label also fits inside
                valueLabelX = currentBarWidth - textPadding;
                valueLabelAnchor = "end";
                valueLabelColor = fillStyle.textOnBarColor;
            } else { // Value label outside
                valueLabelX = currentBarWidth + textPadding;
                valueLabelAnchor = "start";
                valueLabelColor = fillStyle.textColor;
            }
        }

        if (groupIconUrl) {
            mainChartGroup.append("image")
                .attr("class", "image group-icon")
                .attr("x", iconX)
                .attr("y", centerY - dynamicIconSize / 2)
                .attr("width", dynamicIconSize)
                .attr("height", dynamicIconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", groupIconUrl);
        }

        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", dimLabelX)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", dimLabelAnchor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${dynamicTextSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", dimLabelColor)
            .text(dimensionLabelText);

        mainChartGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", valueLabelX)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", valueLabelAnchor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${dynamicTextSize}px`)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", valueLabelColor)
            .text(valueLabelText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // All complex visual effects (shadows, gradients, rounded corners) removed as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}