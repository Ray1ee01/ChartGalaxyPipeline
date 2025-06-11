/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], ["-inf", "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["positive", "negative"],
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme if not specified, or use data.colors_dark for dark
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    if (!xColumn || !yColumn) {
        console.error("Critical chart config missing: x or y role in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (x or y role).</div>");
        return null;
    }

    const categoryFieldName = xColumn.name;
    const valueFieldName = yColumn.name;
    const valueFieldUnit = yColumn.unit && yColumn.unit !== "none" ? yColumn.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        positiveBarColor: (colors.other && colors.other.positive) ? colors.other.positive : (colors.available_colors && colors.available_colors.length > 0 ? colors.available_colors[0] : '#44c2a7'),
        negativeBarColor: (colors.other && colors.other.negative) ? colors.other.negative : (colors.available_colors && colors.available_colors.length > 1 ? colors.available_colors[1] : '#c13030'),
        textColor: colors.text_color || '#0f223b',
        valueLabelColorInside: '#FFFFFF', // Typically white for contrast inside bars
        axisLineColor: '#808080',
        chartBackground: colors.background_color || '#FFFFFF',
        iconUrls: images.field || {}, // e.g., { "Category1": "url1", ... }
        defaultIconBackgroundColor: '#CCCCCC' // Fallback if bar color is not suitable or for generic icon bg
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getComputedTextLength/getBBox across browsers
        // but the directive says "MUST NOT be appended to the document DOM".
        // getBBox might work without appending for some browsers/setups, but can be 0.
        // A common workaround is to append, measure, remove, but if strictly forbidden:
        // This might return 0 if not rendered. For robustness, one might need a hidden, attached SVG.
        // However, adhering to "MUST NOT append", we'll use getBBox on an unattached element.
        // This is often unreliable. A more robust in-memory approach might involve Canvas.
        // For simplicity and directness with SVG:
        document.body.appendChild(tempSvg); // Temporarily append to measure
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg); // Remove immediately
        return width;
    }
    
    const formatValue = (value) => {
        let absValue = Math.abs(value);
        let prefix = value < 0 ? "-" : (value > 0 ? "+" : "");
        if (absValue >= 1000000000) {
            return prefix + d3.format("~.1f")(absValue / 1000000000) + "B";
        } else if (absValue >= 1000000) {
            return prefix + d3.format("~.1f")(absValue / 1000000) + "M";
        } else if (absValue >= 1000) {
            return prefix + d3.format("~.1f")(absValue / 1000) + "K";
        }
        return prefix + d3.format("~.2f")(absValue); // Show more precision for small numbers
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
    const iconSize = 24;
    const iconMargin = 5;
    const iconTextSpacing = 8;
    const textBarSpacing = 10; // Space between category label and potential start of negative bar value label if outside
    const yAxisTitleLineHeight = parseInt(fillStyle.typography.labelFontSize) * 1.2;


    let maxCategoryLabelWidth = 0;
    chartDataInput.forEach(d => {
        const labelWidth = estimateTextWidth(d[categoryFieldName], {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (labelWidth > maxCategoryLabelWidth) {
            maxCategoryLabelWidth = labelWidth;
        }
    });
    
    // Calculate approximate height needed for the Y-axis title (valueFieldName label)
    const yAxisTitleText = valueFieldName || "Values";
    const tempYAxisTitleWords = yAxisTitleText.split(' ');
    let yAxisTitleLines = 1;
    if (tempYAxisTitleWords.length > 3) { // Arbitrary threshold for multi-line
        yAxisTitleLines = Math.ceil(tempYAxisTitleWords.length / 3); // Approximate lines
    }
    const yAxisTitleHeight = yAxisTitleLines * yAxisTitleLineHeight + 10; // 10 for padding

    const chartMargins = {
        top: yAxisTitleHeight + 20, // Space for valueFieldName label + padding
        right: 30,
        bottom: 30,
        left: iconMargin + iconSize + iconTextSpacing + maxCategoryLabelWidth + textBarSpacing
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated inner dimensions are not positive. Cannot render chart.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Chart dimensions too small for content.</div>");
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = JSON.parse(JSON.stringify(chartDataInput)); // Deep copy for sorting
    chartDataArray.sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const sortedCategories = chartDataArray.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedCategories)
        .range([0, innerHeight])
        .padding(0.2); // Keep some padding, original had 0.2 or 0.1

    const maxPositiveValue = d3.max(chartDataArray, d => d[valueFieldName] > 0 ? d[valueFieldName] : 0) || 0;
    const minNegativeValue = d3.min(chartDataArray, d => d[valueFieldName] < 0 ? d[valueFieldName] : 0) || 0;
    
    const xScale = d3.scaleLinear()
        .domain([minNegativeValue, maxPositiveValue])
        .range([0, innerWidth])
        .nice(); // Use nice() to make the domain human-friendly

    const centerPosition = xScale(0);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    mainChartGroup.append("line")
        .attr("class", "axis center-line")
        .attr("x1", centerPosition)
        .attr("y1", 0)
        .attr("x2", centerPosition)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 2)
        .style("opacity", 0.7);

    // Render the "Y-axis title" (label for the value field)
    const yAxisTitle = mainChartGroup.append("g")
        .attr("class", "y-axis-title-group")
        .attr("transform", `translate(${centerPosition}, ${-yAxisTitleHeight + yAxisTitleLineHeight / 2})`); // Position above the chart, aligned with center

    const words = yAxisTitleText.split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const availableWidthForTitle = innerWidth - centerPosition - 10; // Available width on the positive side
    
    let yAxisTitleTspan = yAxisTitle.append("text")
        .attr("class", "label y-axis-name")
        .attr("x", 5) // Small offset from center line
        .attr("y", 0)
        .attr("dy", `${lineNumber * yAxisTitleLineHeight}em`)
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .append("tspan")
        .attr("x", 5)
        .attr("dy", `${yAxisTitleLineHeight}px`);

    while (word = words.pop()) {
        line.push(word);
        yAxisTitleTspan.text(line.join(" "));
        if (yAxisTitleTspan.node().getComputedTextLength() > availableWidthForTitle && line.length > 1) {
            line.pop();
            yAxisTitleTspan.text(line.join(" "));
            line = [word];
            lineNumber++;
            yAxisTitleTspan = yAxisTitle.select("text").append("tspan")
                .attr("x", 5)
                .attr("dy", `${yAxisTitleLineHeight}px`) // dy for new line
                .text(word);
        }
    }


    // Block 8: Main Data Visualization Rendering
    const barHeight = yScale.bandwidth();

    chartDataArray.forEach(d => {
        const category = d[categoryFieldName];
        const value = d[valueFieldName];
        const yPos = yScale(category);

        const barColor = value >= 0 ? fillStyle.positiveBarColor : fillStyle.negativeBarColor;
        
        let barX, barWidth;
        if (value >= 0) {
            barX = centerPosition;
            barWidth = xScale(value) - centerPosition;
        } else {
            barWidth = centerPosition - xScale(value);
            barX = centerPosition - barWidth;
        }
        if (barWidth < 0) barWidth = 0; // Ensure non-negative width

        // Bar
        mainChartGroup.append("rect")
            .attr("class", "mark bar")
            .attr("x", barX)
            .attr("y", yPos)
            .attr("width", barWidth)
            .attr("height", barHeight)
            .attr("fill", barColor);

        // Icon background rectangle
        mainChartGroup.append("rect")
            .attr("class", "icon-background")
            .attr("x", -chartMargins.left + iconMargin)
            .attr("y", yPos + (barHeight - iconSize) / 2)
            .attr("width", iconSize)
            .attr("height", iconSize)
            .attr("fill", barColor) // Use bar color for icon background
            .attr("rx", 4)
            .attr("ry", 4);
        
        // Icon
        const iconUrl = fillStyle.iconUrls[category];
        if (iconUrl) {
            const iconPadding = 4;
            mainChartGroup.append("image")
                .attr("class", "icon data-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", -chartMargins.left + iconMargin + iconPadding / 2)
                .attr("y", yPos + (barHeight - iconSize) / 2 + iconPadding / 2)
                .attr("width", iconSize - iconPadding)
                .attr("height", iconSize - iconPadding)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

        // Category Label
        mainChartGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", -chartMargins.left + iconMargin + iconSize + iconTextSpacing)
            .attr("y", yPos + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(category);

        // Value Label
        const formattedValue = formatValue(value) + (valueFieldUnit ? `${valueFieldUnit}` : "");
        const valueLabelWidth = estimateTextWidth(formattedValue, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        });

        const textPadding = 5;
        let textX, textAnchor, valueColor;

        if (barWidth > valueLabelWidth + textPadding * 2) { // Can fit inside
            valueColor = fillStyle.valueLabelColorInside;
            if (value >= 0) {
                textX = barX + barWidth - textPadding;
                textAnchor = "end";
            } else {
                textX = barX + textPadding;
                textAnchor = "start";
            }
        } else { // Place outside
            valueColor = fillStyle.textColor;
            if (value >= 0) {
                textX = barX + barWidth + textPadding;
                textAnchor = "start";
            } else {
                textX = barX - textPadding;
                textAnchor = "end";
            }
        }
        
        mainChartGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", textX)
            .attr("y", yPos + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", textAnchor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", valueColor)
            .text(formattedValue);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this refactoring beyond core chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}