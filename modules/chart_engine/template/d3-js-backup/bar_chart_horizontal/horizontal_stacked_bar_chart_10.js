/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_chart",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 8], [0, "inf"], [2, 4]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "secondary", "background_color", "text_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal stacked bar chart.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || (data.colors_dark || {});
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const yFieldName = (dataColumns.find(col => col.role === "y") || {}).name;
    const groupFieldName = (dataColumns.find(col => col.role === "group") || {}).name;

    const criticalFields = { xFieldName, yFieldName, groupFieldName };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null;
    }

    const xFieldUnit = (dataColumns.find(col => col.role === "x" && col.unit !== "none") || {}).unit || "";
    const yFieldUnit = (dataColumns.find(col => col.role === "y" && col.unit !== "none") || {}).unit || "";

    // Block 2: Style Configuration & Helper Definitions
    const DEFAULT_TYPOGRAPHY = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const DEFAULT_COLORS = {
        text_color: "#333333",
        primary: "#1f77b4",
        secondary: "#ff7f0e",
        background_color: "#FFFFFF",
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"]
    };

    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) || DEFAULT_TYPOGRAPHY.title.font_family,
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) || DEFAULT_TYPOGRAPHY.title.font_size,
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || DEFAULT_TYPOGRAPHY.title.font_weight,
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || DEFAULT_TYPOGRAPHY.label.font_family,
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || DEFAULT_TYPOGRAPHY.label.font_size,
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || DEFAULT_TYPOGRAPHY.label.font_weight,
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || DEFAULT_TYPOGRAPHY.annotation.font_family,
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || DEFAULT_TYPOGRAPHY.annotation.font_size,
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || DEFAULT_TYPOGRAPHY.annotation.font_weight,
        },
        textColor: rawColors.text_color || DEFAULT_COLORS.text_color,
        chartBackground: rawColors.background_color || DEFAULT_COLORS.background_color,
        primaryColor: (rawColors.other && rawColors.other.primary) || DEFAULT_COLORS.primary,
        secondaryColor: (rawColors.other && rawColors.other.secondary) || DEFAULT_COLORS.secondary,
        defaultCategoryColors: rawColors.available_colors || DEFAULT_COLORS.available_colors,
        labelBackgroundColor: "#FFFFFF", // Solid white for label backgrounds
        labelTextColor: "#000000", // Black text for labels on white background
    };
    
    fillStyle.getCategoryColor = (groupValue, index) => {
        if (rawColors.field && rawColors.field[groupValue]) {
            return rawColors.field[groupValue];
        }
        return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
    };

    fillStyle.getImageUrl = (fieldValue) => {
        if (images.field && images.field[fieldValue]) {
            return images.field[fieldValue];
        }
        if (images.other && images.other.primary && Object.keys(images.field || {}).length === 0) { // Fallback to primary if field specific not found
             return images.other.primary;
        }
        return null;
    };
    
    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox, but against spec.
        // For in-memory, this might be less accurate or require more setup.
        // A common robust way:
        // document.body.appendChild(tempSvg);
        // const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg);
        // return width;
        // Simplified version for this context, assuming basic SVG text rendering:
        try {
            return tempText.getComputedTextLength ? tempText.getComputedTextLength() : text.length * (parseInt(fontProps.fontSize) || 12) * 0.6;
        } catch (e) { // Fallback for environments where getComputedTextLength might not be available without DOM
            return text.length * (parseInt(fontProps.fontSize) || 12) * 0.6; // Rough estimate
        }
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (value >= 1000000) return d3.format("~.2s")(value).replace('M', 'M');
        if (value >= 1000) return d3.format("~.2s")(value).replace('k', 'K');
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
    const chartMargins = { top: 50, right: 100, bottom: 50, left: 80 };
    if (variables.hide_x_labels) chartMargins.top = 20; // Adjust if x-labels (period labels) are hidden

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartData.map(d => d[groupFieldName]))).sort(); // Sort for consistent color mapping

    const groupedData = d3.group(chartData, d => d[xFieldName]);
    const processedData = Array.from(groupedData, ([key, values]) => {
        const obj = { [xFieldName]: key };
        groups.forEach(group => {
            obj[group] = d3.sum(values.filter(d => d[groupFieldName] === group), d => +d[yFieldName]);
        });
        obj.total = d3.sum(values, d => +d[yFieldName]);
        return obj;
    });
    // Sort processedData by xFieldName if it's sortable (e.g. years, months)
    // This example assumes xFieldName values are already in a meaningful order or are categorical.

    const stack = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone) // Keep original group order
        .offset(d3.stackOffsetNone);

    const stackedData = stack(processedData);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d[xFieldName]))
        .range([innerHeight, 0])
        .padding(0.4);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) * 1.05 || 10]) // Ensure domain is at least 0-10
        .range([0, innerWidth])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => fillStyle.getCategoryColor(group, i)));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(5).tickSize(0).tickPadding(10).tickFormat(d => formatValue(d) + yFieldUnit))
        .call(g => g.select(".domain").remove())
        .selectAll("text")
        .attr("class", "label axis-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickSize(0).tickPadding(10))
        .call(g => g.select(".domain").remove())
        .selectAll(".tick text").remove(); // Remove default Y-axis text, custom labels will be added

    // Custom Y-axis labels (period labels above bars)
    if (!variables.hide_x_labels) { // Example of using a variable if needed
        mainChartGroup.selectAll(".custom-y-label")
            .data(processedData)
            .enter()
            .append("text")
            .attr("class", "label category-label custom-y-label")
            .attr("x", 0)
            .attr("y", d => yScale(d[xFieldName]) - 8)
            .attr("text-anchor", "start")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(d => d[xFieldName] + (xFieldUnit ? ` (${xFieldUnit})` : ''));
    }

    // Block 8: Main Data Visualization Rendering
    const barLayers = mainChartGroup.selectAll(".bar-layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `bar-layer mark group-${d.key.toString().replace(/\s+/g, '-')}`)
        .style("fill", d => colorScale(d.key));

    barLayers.selectAll(".bar-segment")
        .data(d => d.map(s => ({ ...s, key: d.key }))) // Add key to segment data for access
        .enter().append("rect")
        .attr("class", "mark bar bar-segment")
        .attr("y", d => yScale(d.data[xFieldName]))
        .attr("x", d => xScale(d[0]))
        .attr("width", d => Math.max(0, xScale(d[1]) - xScale(d[0]))) // Ensure width is not negative
        .attr("height", yScale.bandwidth());

    // Data labels (group and value)
    barLayers.selectAll(".data-label-group")
        .data(d => d.map(s => ({ ...s, key: d.key })))
        .enter()
        .each(function(d) { // Use 'each' to handle conditional rendering of labels
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            const segmentValue = d[1] - d[0];
            const barSegmentGroup = d3.select(this);

            if (segmentValue > 0 && segmentWidth > 5) { // Only render labels if segment has value and some width
                const labelYPosition = yScale(d.data[xFieldName]) + yScale.bandwidth() / 2;
                const labelXPosition = xScale(d[0]) + 5;
                
                const textPropsGroup = { 
                    fontFamily: fillStyle.typography.annotationFontFamily, 
                    fontSize: fillStyle.typography.annotationFontSize,
                    fontWeight: fillStyle.typography.annotationFontWeight
                };
                const groupLabelText = d.key;
                const groupLabelWidth = estimateTextWidth(groupLabelText, textPropsGroup);

                const textPropsValue = { 
                    fontFamily: fillStyle.typography.annotationFontFamily, 
                    fontSize: fillStyle.typography.annotationFontSize,
                    fontWeight: fillStyle.typography.annotationFontWeight
                };
                const valueLabelText = formatValue(segmentValue) + (yFieldUnit ? yFieldUnit : '');
                const valueLabelWidth = estimateTextWidth(valueLabelText, textPropsValue);


                // Position group label and value label to avoid overlap if possible
                // Simple strategy: group label top, value label bottom, or side-by-side if space
                const availableSpaceForTwoLines = yScale.bandwidth() > (parseFloat(textPropsGroup.fontSize) + parseFloat(textPropsValue.fontSize) + 4);
                const availableSpaceForOneLine = segmentWidth > (groupLabelWidth + valueLabelWidth + 15);


                if (availableSpaceForTwoLines && segmentWidth > Math.max(groupLabelWidth, valueLabelWidth) + 10) {
                     // Group Label (top part of segment)
                    barSegmentGroup.append("text")
                        .attr("class", "label data-label group-data-label")
                        .attr("x", labelXPosition)
                        .attr("y", yScale(d.data[xFieldName]) + yScale.bandwidth() * 0.30)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "start")
                        .style("fill", fillStyle.labelTextColor)
                        .style("font-family", textPropsGroup.fontFamily)
                        .style("font-size", textPropsGroup.fontSize)
                        .style("font-weight", textPropsGroup.fontWeight)
                        .text(groupLabelText);

                    // Value Label (bottom part of segment)
                    barSegmentGroup.append("text")
                        .attr("class", "label data-label value-data-label")
                        .attr("x", labelXPosition)
                        .attr("y", yScale(d.data[xFieldName]) + yScale.bandwidth() * 0.70)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "start")
                        .style("fill", fillStyle.labelTextColor)
                        .style("font-family", textPropsValue.fontFamily)
                        .style("font-size", textPropsValue.fontSize)
                        .style("font-weight", textPropsValue.fontWeight)
                        .text(valueLabelText);
                } else if (availableSpaceForOneLine) {
                    // Side by side: Group - Value
                    barSegmentGroup.append("text")
                        .attr("class", "label data-label group-data-label")
                        .attr("x", labelXPosition)
                        .attr("y", labelYPosition)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "start")
                        .style("fill", fillStyle.labelTextColor)
                        .style("font-family", textPropsGroup.fontFamily)
                        .style("font-size", textPropsGroup.fontSize)
                        .style("font-weight", textPropsGroup.fontWeight)
                        .text(groupLabelText + ":");
                    
                    barSegmentGroup.append("text")
                        .attr("class", "label data-label value-data-label")
                        .attr("x", labelXPosition + groupLabelWidth + 5)
                        .attr("y", labelYPosition)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "start")
                        .style("fill", fillStyle.labelTextColor)
                        .style("font-family", textPropsValue.fontFamily)
                        .style("font-size", textPropsValue.fontSize)
                        .style("font-weight", textPropsValue.fontWeight)
                        .text(valueLabelText);

                } else if (segmentWidth > valueLabelWidth + 10) { // Only value if not enough space for group
                     barSegmentGroup.append("text")
                        .attr("class", "label data-label value-data-label")
                        .attr("x", labelXPosition)
                        .attr("y", labelYPosition)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "start")
                        .style("fill", fillStyle.labelTextColor)
                        .style("font-family", textPropsValue.fontFamily)
                        .style("font-size", textPropsValue.fontSize)
                        .style("font-weight", textPropsValue.fontWeight)
                        .text(valueLabelText);
                }
                // If none of the above, labels are omitted due to space constraints.
            }
        });


    // Block 9: Optional Enhancements & Post-Processing
    const iconSize = Math.min(yScale.bandwidth() * 0.8, 40); // Cap icon size
    if (images && (images.field || images.other)) {
        mainChartGroup.selectAll(".category-icon")
            .data(processedData)
            .enter()
            .append("image")
            .attr("class", "icon category-icon")
            .attr("x", innerWidth + 10)
            .attr("y", d => yScale(d[xFieldName]) + (yScale.bandwidth() - iconSize) / 2)
            .attr("width", iconSize)
            .attr("height", iconSize)
            .attr("xlink:href", d => fillStyle.getImageUrl(d[xFieldName]))
            .each(function(d) { // Remove image if href is null/empty
                if (!d3.select(this).attr("xlink:href")) {
                    d3.select(this).remove();
                }
            });
    }
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}