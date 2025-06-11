/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_plain_chart_07",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 20], [0, "inf"], [2, 6]],
  "required_fields_icons": [],
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
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // Could also be data.colors_dark
    const images = data.images || {}; // Not used in this chart but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const dimensionFieldName = dimensionFieldConfig ? dimensionFieldConfig.name : undefined;
    const valueFieldName = valueFieldConfig ? valueFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    const missingFields = [];
    if (!dimensionFieldName) missingFields.push("x role (dimension)");
    if (!valueFieldName) missingFields.push("y role (value)");
    if (!groupFieldName) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionUnit = dimensionFieldConfig.unit && dimensionFieldConfig.unit !== "none" ? dimensionFieldConfig.unit : "";
    const valueUnit = valueFieldConfig.unit && valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";
    // const groupUnit = groupFieldConfig.unit && groupFieldConfig.unit !== "none" ? groupFieldConfig.unit : ""; // Not typically used for display

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) || '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
        },
        textColor: rawColors.text_color || '#0f223b',
        chartBackground: rawColors.background_color || '#FFFFFF',
        primaryColor: (rawColors.other && rawColors.other.primary) || '#1f77b4',
        defaultCategoricalColors: d3.schemeCategory10,
        rankCircleColor: rawColors.text_color || '#0f223b', // Default to text color for circle
        rankTextColor: rawColors.background_color || '#FFFFFF', // Default to background for text in circle
    };

    fillStyle.getCategoryColor = (groupValue, index) => {
        if (rawColors.field && rawColors.field[groupValue]) {
            return rawColors.field[groupValue];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[index % rawColors.available_colors.length];
        }
        return fillStyle.defaultCategoricalColors[index % fillStyle.defaultCategoricalColors.length];
    };
    
    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document.body.appendChild(tempSvg); // Not appended to DOM
        const width = tempText.getBBox().width;
        // Document.body.removeChild(tempSvg); // Not appended, so no removal needed
        return width;
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value).replace('G', 'B'); // More standard SI prefix
        if (value >= 1000000) return d3.format("~s")(value);
        if (value >= 1000) return d3.format("~s")(value);
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
        .attr("xmlns", "http://www.w3.org/2000/svg");

    // No defs needed for shadows or gradients

    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = {
        top: 20, // Base top margin
        right: 60,
        bottom: 30,
        left: 80
    };
    const circlePadding = 10; // Padding between circle and dimension label text

    // Calculate legend height first if legend is present, to adjust top margin
    const uniqueGroups = [...new Set(chartData.map(d => d[groupFieldName]))];
    let legendHeight = 0;
    const legendItemHeight = 20;
    const legendItemMargin = 10;
    const legendRowSpacing = 5;
    const legendPaddingFromTop = 10; // Padding for legend from SVG top
    const legendPaddingBelow = 15; // Padding between legend and chart content

    if (uniqueGroups.length > 1) {
        const maxLegendWidth = containerWidth * 0.8; // Max width for legend block
        let currentX = 0;
        let currentRow = 0;
        uniqueGroups.forEach((group, i) => {
            const text = groupUnit ? `${group}${groupUnit}` : group;
            const itemTextWidth = estimateTextWidth(text, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
            const itemTotalWidth = itemTextWidth + legendItemMargin * 2; // Rectangle padding

            if (currentX > 0 && currentX + itemTotalWidth + legendItemMargin > maxLegendWidth) {
                currentX = 0;
                currentRow++;
            }
            currentX += itemTotalWidth + (currentX > 0 ? legendItemMargin : 0) ;
        });
        legendHeight = (currentRow + 1) * (legendItemHeight + legendRowSpacing) - legendRowSpacing;
        chartMargins.top = legendPaddingFromTop + legendHeight + legendPaddingBelow;
    }


    // Calculate max label widths to adjust left/right margins
    // Dimension labels (left side)
    let maxDimLabelWidth = 0;
    const tempDimensions = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    // Estimate circle radius based on a typical number of items, this is tricky without yScale first
    // Let's use a fixed assumed circle radius for margin calculation, or calculate yScale early.
    // For simplicity in this block, let's assume a fixed contribution from circle part for margin calc.
    const estimatedCirclePartWidth = (parseFloat(fillStyle.typography.labelFontSize) * 1.5) + circlePadding; // Approx (radius*2) + padding

    tempDimensions.forEach(dim => {
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const textWidth = estimateTextWidth(formattedDim, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        maxDimLabelWidth = Math.max(maxDimLabelWidth, textWidth);
    });
    chartMargins.left = Math.max(chartMargins.left, maxDimLabelWidth + estimatedCirclePartWidth + 20); // Add some buffer

    // Value labels (right side)
    let maxValueLabelWidth = 0;
    chartData.forEach(d => {
        const val = +d[valueFieldName];
        if (isNaN(val)) return;
        const formattedVal = valueUnit ? `${formatValue(val)}${valueUnit}` : `${formatValue(val)}`;
        const textWidth = estimateTextWidth(formattedVal, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 10); // Add some buffer

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Cannot render chart.");
         d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Chart dimensions are too small for content.</div>");
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);
    const sortedDimensionNames = sortedData.map(d => d[dimensionFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensionNames)
        .range([0, innerHeight])
        .padding(0.2); // Fixed padding

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueFieldName]) * 1.05 || 10]) // Ensure domain is at least 0-10
        .range([0, innerWidth]);

    const barHeight = yScale.bandwidth();
    const circleRadius = barHeight / 2.2; // Slightly smaller than half bar height for visual appeal

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    if (uniqueGroups.length > 1) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${chartMargins.left}, ${legendPaddingFromTop})`);

        let currentX = 0;
        let currentY = 0;
        const maxLegendWidth = containerWidth - chartMargins.left - chartMargins.right; // Use available inner width for legend if placed above chart. Or fixed as before.
                                                                                        // Let's use a more generous width for legend if it's at top.
                                                                                        // containerWidth * 0.8 was used for height calc, let's use it for rendering too.
        const legendEffectiveMaxWidth = Math.min(maxLegendWidth, containerWidth - chartMargins.left - chartMargins.right);


        uniqueGroups.forEach((group, i) => {
            const groupColor = fillStyle.getCategoryColor(group, uniqueGroups.indexOf(group));
            const legendText = groupUnit ? `${group}${groupUnit}` : group;
            
            const itemTextWidth = estimateTextWidth(legendText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
            const itemRectWidth = itemTextWidth + legendItemMargin; // Rectangle width based on text
            const itemTotalWidth = itemRectWidth + legendItemMargin; // Total space for item including margin to next

            if (currentX > 0 && currentX + itemTotalWidth > legendEffectiveMaxWidth) {
                currentX = 0;
                currentY += legendItemHeight + legendRowSpacing;
            }

            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${currentY})`);

            legendItem.append("rect")
                .attr("class", "mark")
                .attr("width", itemRectWidth)
                .attr("height", legendItemHeight)
                .attr("fill", groupColor);

            legendItem.append("text")
                .attr("class", "text label")
                .attr("x", itemRectWidth / 2)
                .attr("y", legendItemHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.rankTextColor) // Using rankTextColor for contrast, assuming bar colors are dark
                .text(legendText);
            
            currentX += itemTotalWidth;
        });
    }

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    sortedData.forEach((d, i) => {
        const dimensionValue = d[dimensionFieldName];
        const numericValue = +d[valueFieldName];
        const groupValue = d[groupFieldName];

        if (isNaN(numericValue) || yScale(dimensionValue) === undefined) {
            console.warn(`Skipping data point due to invalid value or dimension: ${JSON.stringify(d)}`);
            return;
        }

        const barY = yScale(dimensionValue);
        const barVisualWidth = xScale(numericValue);
        const barColor = fillStyle.getCategoryColor(groupValue, uniqueGroups.indexOf(groupValue));

        const rankCircleX = -circleRadius - circlePadding; // Center of the circle

        // Bar
        mainChartGroup.append("rect")
            .attr("class", "mark bar")
            .attr("x", rankCircleX) // Bar starts from circle center
            .attr("y", barY)
            .attr("width", barVisualWidth + circleRadius + circlePadding) // Extends from circle center to value
            .attr("height", barHeight)
            .attr("fill", barColor);

        // Rank Circle
        mainChartGroup.append("circle")
            .attr("class", "mark rank-circle")
            .attr("cx", rankCircleX)
            .attr("cy", barY + barHeight / 2)
            .attr("r", circleRadius)
            .attr("fill", fillStyle.rankCircleColor);

        // Rank Text
        mainChartGroup.append("text")
            .attr("class", "text value rank-text")
            .attr("x", rankCircleX)
            .attr("y", barY + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize) // Using label font for rank
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.rankTextColor)
            .text(i + 1);

        // Dimension Label
        const formattedDim = dimensionUnit ? `${dimensionValue}${dimensionUnit}` : `${dimensionValue}`;
        mainChartGroup.append("text")
            .attr("class", "text label dimension-label")
            .attr("x", rankCircleX - circleRadius - circlePadding / 2) // Left of circle
            .attr("y", barY + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedDim);

        // Value Label
        const formattedVal = valueUnit ? `${formatValue(numericValue)}${valueUnit}` : `${formatValue(numericValue)}`;
        mainChartGroup.append("text")
            .attr("class", "text value data-label")
            .attr("x", rankCircleX + barVisualWidth + circleRadius + circlePadding + 5) // Right of bar end
            .attr("y", barY + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", barColor) // Use bar color for value label
            .text(formattedVal);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}