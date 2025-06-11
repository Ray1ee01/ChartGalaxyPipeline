/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Bar Chart",
  "chart_name": "grouped_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 7], [0, "inf"], [3, 5]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "background"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Or data.colors_dark if theme logic was present
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldCol ? xFieldCol.name : undefined;
    const yFieldName = yFieldCol ? yFieldCol.name : undefined;
    const groupFieldName = groupFieldCol ? groupFieldCol.name : undefined;

    let criticalMissingFields = [];
    if (!xFieldName) criticalMissingFields.push("xFieldName (role 'x')");
    if (!yFieldName) criticalMissingFields.push("yFieldName (role 'y')");
    if (!groupFieldName) criticalMissingFields.push("groupFieldName (role 'group')");

    if (criticalMissingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${criticalMissingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    let yAxisTickSuffix = "";
    if (yFieldCol && yFieldCol.unit && yFieldCol.unit !== "none") {
        yAxisTickSuffix = " " + yFieldCol.unit;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colors.text_color || '#333333',
        backgroundColor: colors.background_color || '#FFFFFF', // Not used for SVG background directly
        primaryColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4',
        axisLineColor: colors.text_color || '#333333', // Default to text color
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        }
    };

    fillStyle.getBarColor = (groupName, index) => {
        if (colors.field && colors.field[groupName]) {
            return colors.field[groupName];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[index % colors.available_colors.length];
        }
        const defaultCategoricalColors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];
        return defaultCategoricalColors[index % defaultCategoricalColors.length];
    };
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute'; // Ensure it's not visible and doesn't affect layout
        tempSvg.style.visibility = 'hidden';
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        tempSvg.appendChild(textEl);
        // No need to append to DOM for getBBox if it's an SVG element itself
        // However, some browsers might need it for full style computation.
        // For robustness if issues arise:
        // document.body.appendChild(tempSvg);
        const width = textEl.getBBox().width;
        // if (tempSvg.parentNode === document.body) document.body.removeChild(tempSvg);
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor); // Optional: if chart needs explicit background

    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendItemHeight = 20;
    const legendTopPadding = 15;
    const legendBottomPadding = 15;
    const calculatedLegendHeight = (chartDataArray.length > 0 && Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).length > 0) ? legendItemHeight + legendTopPadding + legendBottomPadding : 0;

    const chartMargins = {
        top: calculatedLegendHeight + 20, // Space for legend + some padding
        right: 30,
        bottom: 70, // Increased for potentially rotated/scaled labels + icons
        left: 60    // Increased for y-axis labels
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const groupNames = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort(); // Sort for consistent legend order
    const categories = Array.from(new Set(chartDataArray.map(d => d[xFieldName])));

    const processedData = categories.map(category => {
        const categoryData = { category: category, groups: {}, iconUrl: null };
        if (images.field && images.field[category]) {
            categoryData.iconUrl = images.field[category];
        } else if (images.other && images.other.primary && dataColumns.find(col => col.role === "x" && col.name === xFieldName)?.use_other_icon_if_missing) {
            // This is an extension: use primary other icon if specific one is missing and column def allows
            // categoryData.iconUrl = images.other.primary; 
        }
        
        groupNames.forEach(group => {
            categoryData.groups[group] = 0; // Initialize
        });

        chartDataArray.filter(d => d[xFieldName] === category).forEach(d => {
            categoryData.groups[d[groupFieldName]] = +d[yFieldName];
        });
        return categoryData;
    });
    
    if (chartDataArray.length === 0) {
        mainChartGroup.append("text")
            .attr("class", "label no-data-label")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", "16px") // Larger for no data message
            .style("fill", fillStyle.textColor)
            .text("No data available to display.");
        return svgRoot.node();
    }


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerWidth])
        .padding(0.2);

    const groupScale = d3.scaleBand()
        .domain(groupNames)
        .range([0, xScale.bandwidth()])
        .padding(0.05);

    const maxYValue = d3.max(chartDataArray, d => +d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([0, maxYValue > 0 ? maxYValue : 1]) // Ensure domain is not [0,0]
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // X-Axis
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    let minXLabelRatio = 1.0;
    const xTickBandwidth = xScale.bandwidth();
    categories.forEach(cat => {
        const labelText = String(cat);
        const estimatedWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (estimatedWidth > xTickBandwidth * 0.9) { // Use 90% of bandwidth as budget
            minXLabelRatio = Math.min(minXLabelRatio, (xTickBandwidth * 0.9) / estimatedWidth);
        }
    });
    const finalXLabelFontSize = minXLabelRatio < 0.95 ? 
                                `${Math.max(parseFloat(fillStyle.typography.labelFontSize) * minXLabelRatio, 8)}px` : // Min font size 8px
                                fillStyle.typography.labelFontSize;


    xAxisGroup.selectAll("text")
        .attr("class", "label x-axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", finalXLabelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "middle");
        // Add rotation if still too wide even after scaling (optional enhancement)
        // .each(function(d) {
        //     const self = d3.select(this);
        //     const estimatedWidth = estimateTextWidth(self.text(), fillStyle.typography.labelFontFamily, finalXLabelFontSize, fillStyle.typography.labelFontWeight);
        //     if (estimatedWidth > xTickBandwidth) {
        //         self.attr("transform", "rotate(-45)")
        //             .style("text-anchor", "end")
        //             .attr("dx", "-0.8em")
        //             .attr("dy", "0.15em");
        //     }
        // });


    // Y-Axis
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => formatValue(d) + yAxisTickSuffix)
        .tickSize(0)
        .tickPadding(10);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);
        
    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll("text")
        .attr("class", "label y-axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // Legend
    if (groupNames.length > 0) {
        const legendContainerGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${chartMargins.left}, ${legendTopPadding})`);

        let currentX = 0;
        const legendRectSize = 12;
        const legendSpacing = 5; // Space between rect and text
        const legendItemPadding = 15; // Space between legend items

        groupNames.forEach((groupName, i) => {
            const legendItem = legendContainerGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, 0)`);

            legendItem.append("rect")
                .attr("x", 0)
                .attr("y", (legendItemHeight - legendRectSize) / 2 - legendTopPadding/2) // Vertically center rect
                .attr("width", legendRectSize)
                .attr("height", legendRectSize)
                .attr("class", "mark legend-mark")
                .style("fill", fillStyle.getBarColor(groupName, i));

            const legendText = legendItem.append("text")
                .attr("x", legendRectSize + legendSpacing)
                .attr("y", legendItemHeight / 2 - legendTopPadding/2) // Vertically center text
                .attr("dy", "0.35em") // Baseline adjustment
                .attr("class", "label legend-label")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(groupName);
            
            const textWidth = estimateTextWidth(groupName, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            currentX += legendRectSize + legendSpacing + textWidth + legendItemPadding;
        });
    }


    // Block 8: Main Data Visualization Rendering
    const barCategoryGroups = mainChartGroup.selectAll(".bar-category-group")
        .data(processedData)
        .enter().append("g")
        .attr("class", "mark bar-category-group")
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    barCategoryGroups.each(function(categoryData, i_category) {
        const categoryGroup = d3.select(this);
        groupNames.forEach((groupName, i_group) => {
            const barValue = categoryData.groups[groupName] || 0;
            const barHeight = innerHeight - yScale(barValue);

            categoryGroup.append("rect")
                .attr("class", "mark bar")
                .attr("x", groupScale(groupName))
                .attr("y", yScale(barValue))
                .attr("width", groupScale.bandwidth())
                .attr("height", barHeight > 0 ? barHeight : 0) // Ensure non-negative height
                .style("fill", fillStyle.getBarColor(groupName, i_group));

            // Data Labels on Bars
            if (barValue > 0) { // Only show label if value > 0
                const labelText = formatValue(barValue);
                const labelFontSizePx = parseFloat(fillStyle.typography.labelFontSize);
                const isInside = barHeight > (labelFontSizePx + 10); // Check if bar is tall enough for inside label

                const labelX = groupScale(groupName) + groupScale.bandwidth() / 2;
                const labelY = isInside ? yScale(barValue) + labelFontSizePx * 0.75 + 5 : yScale(barValue) - 5;
                
                categoryGroup.append("text")
                    .attr("class", "label data-label")
                    .attr("x", labelX)
                    .attr("y", labelY)
                    .attr("text-anchor", "middle")
                    .attr("transform", isInside ? `rotate(-90, ${labelX}, ${labelY - labelFontSizePx * 0.25})` : null) // Adjust rotation point for better centering
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", isInside ? "#FFFFFF" : fillStyle.textColor)
                    .text(labelText);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons)
    // X-Axis Icons
    xAxisGroup.selectAll(".tick")
        .each(function(categoryValue) {
            const tickG = d3.select(this);
            const dataItem = processedData.find(item => item.category === categoryValue);
            const iconUrl = dataItem ? dataItem.iconUrl : null;

            if (iconUrl) {
                tickG.append("image")
                    .attr("class", "icon x-axis-icon")
                    .attr("xlink:href", iconUrl)
                    .attr("x", - (xScale.bandwidth() / 2) + (xScale.bandwidth() / 2 - 16 / 2) ) // Center icon within band, then shift left
                    .attr("y", parseFloat(finalXLabelFontSize) + 5) // Position below scaled label text
                    .attr("width", 16)
                    .attr("height", 16);
                
                // Adjust text label position if icon is present to avoid overlap
                tickG.select("text.x-axis-label")
                    .attr("dy", "-0.5em"); // Shift text up a bit
            }
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}