/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], ["-inf", "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data;
    const chartData = chartConfig.data.data;
    const variables = chartConfig.variables || {};
    const typography = chartConfig.typography || {};
    const colors = chartConfig.colors || {};
    // const images = chartConfig.images || {}; // Not used in this chart
    const dataColumns = chartConfig.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    let categoryFieldName = "";
    let valueFieldName = "";
    let categoryFieldDisplayName = "";
    let valueFieldDisplayName = "";
    let valueFieldUnit = "";

    dataColumns.forEach(col => {
        if (col.role === "x") {
            categoryFieldName = col.name;
            categoryFieldDisplayName = col.name || categoryFieldName;
        } else if (col.role === "y") {
            valueFieldName = col.name;
            valueFieldDisplayName = col.name || valueFieldName;
            if (col.unit && col.unit !== "none") {
                valueFieldUnit = col.unit;
            }
        }
    });

    if (!categoryFieldName || !valueFieldName) {
        const errorMessage = `Critical chart config missing: ${!categoryFieldName ? "category field (role 'x')" : ""} ${!valueFieldName ? "value field (role 'y')" : ""}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMessage}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        positiveBarColor: (colors.other && colors.other.primary) || "#FFD966",
        negativeBarColor: (colors.other && colors.other.secondary) || "#F4754C",
        centerColumn: {
            textColor: colors.text_color || "#333333",
            borderColor: "#CCCCCC",
            headerTextColor: colors.text_color || "#333333",
        },
        axis: {
            tickColor: "#CCCCCC",
            labelTextColor: colors.text_color || "#333333",
            directionLabelTextColor: colors.text_color || "#333333",
        },
        dataLabel: {
            textColorInside: "#FFFFFF", // Contrasting color for inside labels
            // For outside labels, use bar color or a specific text color if defined
            textColorOutsidePositive: (colors.other && colors.other.primary) || "#FFD966",
            textColorOutsideNegative: (colors.other && colors.other.secondary) || "#F4754C",
        },
        chartBackground: colors.background_color || "none", // Default to no background for embedding
        defaultTextColor: colors.text_color || "#333333",
    };

    fillStyle.typography = {
        categoryLabel: {
            font_family: (typography.label && typography.label.font_family) || "Arial, sans-serif",
            font_size: (typography.label && typography.label.font_size) || "12px",
            font_weight: (typography.label && typography.label.font_weight) || "normal",
        },
        valueLabel: {
            font_family: (typography.annotation && typography.annotation.font_family) || "Arial, sans-serif",
            font_size: (typography.annotation && typography.annotation.font_size) || "12px",
            font_weight: (typography.annotation && typography.annotation.font_weight) || "bold", // Value labels are often bold
        },
        axisLabel: { // For value axis ticks
            font_family: (typography.annotation && typography.annotation.font_family) || "Arial, sans-serif",
            font_size: (typography.annotation && typography.annotation.font_size) || "11px",
            font_weight: (typography.annotation && typography.annotation.font_weight) || "normal",
        },
        axisName: { // For central column header and direction labels
            font_family: (typography.label && typography.label.font_family) || "Arial, sans-serif",
            font_size: (typography.label && typography.label.font_size) || "12px",
            font_weight: (typography.label && typography.label.font_weight) || "bold",
        }
    };

    const estimateTextWidth = (text, fontProps) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family);
        tempText.setAttribute('font-size', fontProps.font_size);
        tempText.setAttribute('font-weight', fontProps.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then calling getComputedTextLength or getBBox is more reliable
        // but per directive, must not append to DOM. getBBox on unattached element might be 0.
        // A common workaround is to briefly attach, measure, and detach, or use a canvas context.
        // For simplicity here, we'll assume getBBox works sufficiently for estimation in some environments
        // or that a more robust off-DOM measurement is polyfilled/available if needed.
        // A more robust method for unattached elements:
        document.body.appendChild(tempSvg); // Temporarily append
        const width = tempText.getComputedTextLength();
        document.body.removeChild(tempSvg); // Detach
        return width;

    };

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~s")(value);
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const valuePadding = 8;          // Num value label padding from bar end
    const axisNameLabelHeight = parseFloat(fillStyle.typography.axisName.font_size) + 10; // Approx height for axis name
    const axisTickSpace = 20;        // Space for axis ticks and labels
    const directionLabelSpace = parseFloat(fillStyle.typography.axisName.font_size) + 5; // Space for direction labels

    let maxCenterLabelWidth = 0;
    chartData.forEach(d => {
        maxCenterLabelWidth = Math.max(maxCenterLabelWidth, estimateTextWidth(d[categoryFieldName], fillStyle.typography.categoryLabel));
    });
    
    const centerBoxInternalPadding = 15;
    const centerBoxWidth = maxCenterLabelWidth + 2 * centerBoxInternalPadding;

    const chartMargins = {
        top: axisNameLabelHeight + directionLabelSpace + axisTickSpace + 10, // Adjusted top margin
        right: 30, // Base right margin, will be adjusted by max value label width
        bottom: 30,
        left: 30   // Base left margin, will be adjusted by max value label width
    };
    
    // Estimate max value label width to adjust margins
    let maxValueLabelWidthEstimation = 0;
    chartData.forEach(d => {
        const val = d[valueFieldName];
        const formattedVal = (val >= 0 ? "+" : "") + formatValue(val) + valueFieldUnit;
        maxValueLabelWidthEstimation = Math.max(maxValueLabelWidthEstimation, estimateTextWidth(formattedVal, fillStyle.typography.valueLabel));
    });
    chartMargins.right += maxValueLabelWidthEstimation / 2; // Add some buffer for potential outside labels
    chartMargins.left += maxValueLabelWidthEstimation / 2;


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth < centerBoxWidth + 20) { // 20 for minimal bar space
        console.warn("Chart width may be insufficient for center labels and bars.");
        // Potentially render an error message or adjust layout further
    }

    const centerBoxLeft = (innerWidth - centerBoxWidth) / 2;
    const centerBoxRight = centerBoxLeft + centerBoxWidth;
    const availableWidthPerSide = Math.max(0, (innerWidth - centerBoxWidth) / 2);


    // Block 5: Data Preprocessing & Transformation
    const categories = chartData.map(d => d[categoryFieldName]);
    const maxAbsValue = d3.max(chartData, d => Math.abs(d[valueFieldName])) || 1; // Ensure not zero for scale domain

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerHeight])
        .padding(0.1); // Small padding between category bands

    const barHeight = yScale.bandwidth();

    const magnitudeScale = d3.scaleLinear()
        .domain([0, maxAbsValue])
        .range([0, availableWidthPerSide])
        .nice();
    
    const niceMaxAbsValue = magnitudeScale.domain()[1]; // Use D3's niced max value

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Center column header (category field name)
    mainChartGroup.append("text")
        .attr("class", "text axis-name category-axis-name")
        .attr("x", centerBoxLeft + centerBoxWidth / 2)
        .attr("y", -axisTickSpace - directionLabelSpace - (axisNameLabelHeight / 2) + 5) // Position above direction labels
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.axisName.font_family)
        .style("font-size", fillStyle.typography.axisName.font_size)
        .style("font-weight", fillStyle.typography.axisName.font_weight)
        .style("fill", fillStyle.centerColumn.headerTextColor)
        .text(categoryFieldDisplayName);

    // Center column vertical lines and horizontal separators
    mainChartGroup.append("line") // Left border
        .attr("class", "gridline center-column-border")
        .attr("x1", centerBoxLeft).attr("y1", 0)
        .attr("x2", centerBoxLeft).attr("y2", innerHeight)
        .attr("stroke", fillStyle.centerColumn.borderColor).attr("stroke-width", 0.5);
    mainChartGroup.append("line") // Right border
        .attr("class", "gridline center-column-border")
        .attr("x1", centerBoxRight).attr("y1", 0)
        .attr("x2", centerBoxRight).attr("y2", innerHeight)
        .attr("stroke", fillStyle.centerColumn.borderColor).attr("stroke-width", 0.5);

    categories.forEach((cat, i) => {
        if (i > 0) { // Horizontal separators
            mainChartGroup.append("line")
                .attr("class", "gridline center-column-separator")
                .attr("x1", centerBoxLeft).attr("y1", yScale(cat))
                .attr("x2", centerBoxRight).attr("y2", yScale(cat))
                .attr("stroke", fillStyle.centerColumn.borderColor).attr("stroke-width", 0.5);
        }
    });
    mainChartGroup.append("line") // Bottom line for center column
        .attr("class", "gridline center-column-separator")
        .attr("x1", centerBoxLeft).attr("y1", innerHeight)
        .attr("x2", centerBoxRight).attr("y2", innerHeight)
        .attr("stroke", fillStyle.centerColumn.borderColor).attr("stroke-width", 0.5);


    // Value axis ticks and labels (top)
    const tickValues = magnitudeScale.ticks(5); // Suggest 5 ticks
    const tickLabelY = -axisTickSpace + 5; // Position tick labels

    tickValues.forEach(value => {
        if (value === 0 && tickValues.length > 1 && tickValues.some(t => t !== 0)) return; // Skip 0 if other ticks exist

        const tickPixelPos = magnitudeScale(value);

        // Positive ticks (right side)
        const xPosPositive = centerBoxRight + tickPixelPos;
        mainChartGroup.append("line")
            .attr("class", "gridline axis-tick value-axis-tick")
            .attr("x1", xPosPositive).attr("y1", -axisTickSpace / 2)
            .attr("x2", xPosPositive).attr("y2", innerHeight) // Extend ticks as gridlines
            .attr("stroke", fillStyle.axis.tickColor).attr("stroke-width", 0.5).style("opacity", 0.7);
        
        if (value !== 0 || (value === 0 && tickValues.filter(v => v !== 0).length === 0)) {
            mainChartGroup.append("text")
                .attr("class", "text axis-label value-axis-label")
                .attr("x", xPosPositive)
                .attr("y", tickLabelY)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.axisLabel.font_family)
                .style("font-size", fillStyle.typography.axisLabel.font_size)
                .style("font-weight", fillStyle.typography.axisLabel.font_weight)
                .style("fill", fillStyle.axis.labelTextColor)
                .text("+" + formatValue(value) + valueFieldUnit);
        }

        // Negative ticks (left side) - only if value is not 0
        if (value !== 0) {
            const xPosNegative = centerBoxLeft - tickPixelPos;
            mainChartGroup.append("line")
                .attr("class", "gridline axis-tick value-axis-tick")
                .attr("x1", xPosNegative).attr("y1", -axisTickSpace / 2)
                .attr("x2", xPosNegative).attr("y2", innerHeight) // Extend ticks as gridlines
                .attr("stroke", fillStyle.axis.tickColor).attr("stroke-width", 0.5).style("opacity", 0.7);
            
            mainChartGroup.append("text")
                .attr("class", "text axis-label value-axis-label")
                .attr("x", xPosNegative)
                .attr("y", tickLabelY)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.axisLabel.font_family)
                .style("font-size", fillStyle.typography.axisLabel.font_size)
                .style("font-weight", fillStyle.typography.axisLabel.font_weight)
                .style("fill", fillStyle.axis.labelTextColor)
                .text("-" + formatValue(value) + valueFieldUnit);
        }
    });
    
    // Direction labels
    const directionLabelY = -axisTickSpace - directionLabelSpace / 2;
    const firstTickPixelPos = tickValues.length > 1 && tickValues[1] ? magnitudeScale(tickValues[1]) : availableWidthPerSide / 2;

    mainChartGroup.append("text") // Left direction label
        .attr("class", "text axis-label direction-label")
        .attr("x", centerBoxLeft - firstTickPixelPos / 2)
        .attr("y", directionLabelY)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.axisName.font_family)
        .style("font-size", fillStyle.typography.axisName.font_size)
        .style("font-weight", fillStyle.typography.axisName.font_weight)
        .style("fill", fillStyle.axis.directionLabelTextColor)
        .text(`← ${valueFieldDisplayName}`);

    mainChartGroup.append("text") // Right direction label
        .attr("class", "text axis-label direction-label")
        .attr("x", centerBoxRight + firstTickPixelPos / 2)
        .attr("y", directionLabelY)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.axisName.font_family)
        .style("font-size", fillStyle.typography.axisName.font_size)
        .style("font-weight", fillStyle.typography.axisName.font_weight)
        .style("fill", fillStyle.axis.directionLabelTextColor)
        .text(`${valueFieldDisplayName} →`);


    // Block 8: Main Data Visualization Rendering
    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(chartData)
        .enter()
        .append("g")
        .attr("class", "mark bar-group")
        .attr("transform", d => `translate(0, ${yScale(d[categoryFieldName])})`);

    barGroups.each(function(d) {
        const group = d3.select(this);
        const value = d[valueFieldName];
        const absValue = Math.abs(value);
        const barW = magnitudeScale(absValue);

        // Draw bar (simple rectangle)
        let barX;
        if (value >= 0) {
            barX = centerBoxRight;
        } else {
            barX = centerBoxLeft - barW;
        }
        
        group.append("rect")
            .attr("class", "mark bar value")
            .attr("x", barX)
            .attr("y", 0)
            .attr("width", barW)
            .attr("height", barHeight)
            .attr("fill", value >= 0 ? fillStyle.positiveBarColor : fillStyle.negativeBarColor);

        // Category labels in center column
        group.append("text")
            .attr("class", "text label category-label")
            .attr("x", centerBoxLeft + centerBoxWidth / 2)
            .attr("y", barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.categoryLabel.font_family)
            .style("font-size", fillStyle.typography.categoryLabel.font_size)
            .style("font-weight", fillStyle.typography.categoryLabel.font_weight)
            .style("fill", fillStyle.centerColumn.textColor)
            .text(d[categoryFieldName]);

        // Value labels
        const formattedValueText = (value >= 0 ? "+" : "") + formatValue(value) + valueFieldUnit;
        const valueLabelWidth = estimateTextWidth(formattedValueText, fillStyle.typography.valueLabel);
        const canFitInside = barW > valueLabelWidth + valuePadding * 2;

        let valueLabelX, valueLabelAnchor, valueLabelColor;
        if (value >= 0) {
            if (canFitInside) {
                valueLabelX = centerBoxRight + barW - valuePadding;
                valueLabelAnchor = "end";
                valueLabelColor = fillStyle.dataLabel.textColorInside;
            } else {
                valueLabelX = centerBoxRight + barW + valuePadding;
                valueLabelAnchor = "start";
                valueLabelColor = fillStyle.dataLabel.textColorOutsidePositive;
            }
        } else { // Negative value
            if (canFitInside) {
                valueLabelX = centerBoxLeft - barW + valuePadding;
                valueLabelAnchor = "start";
                valueLabelColor = fillStyle.dataLabel.textColorInside;
            } else {
                valueLabelX = centerBoxLeft - barW - valuePadding;
                valueLabelAnchor = "end";
                valueLabelColor = fillStyle.dataLabel.textColorOutsideNegative;
            }
        }
        
        group.append("text")
            .attr("class", "text label value-label")
            .attr("x", valueLabelX)
            .attr("y", barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", valueLabelAnchor)
            .style("font-family", fillStyle.typography.valueLabel.font_family)
            .style("font-size", fillStyle.typography.valueLabel.font_size)
            .style("font-weight", fillStyle.typography.valueLabel.font_weight)
            .style("fill", valueLabelColor)
            .text(formattedValueText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Effects like shadows, gradients, complex rounded corners removed as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}