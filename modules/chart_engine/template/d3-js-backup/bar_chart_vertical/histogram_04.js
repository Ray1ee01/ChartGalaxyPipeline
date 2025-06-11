/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Bar Chart",
  "chart_name": "histogram_04",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[10, 50], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "secondary", "text_color", "background_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    const images = data.images || {}; // Not used in this chart, but required by spec

    // Clear the containerSelector
    d3.select(containerSelector).html("");

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldDef = dataColumns.find(col => col.role === groupFieldRole);

    const xFieldName = xFieldDef ? xFieldDef.name : undefined;
    const yFieldName = yFieldDef ? yFieldDef.name : undefined;
    const groupFieldName = groupFieldDef ? groupFieldDef.name : undefined;

    const criticalFields = { xFieldName, yFieldName, groupFieldName };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }
    
    if (chartDataInput.length === 0) {
        const errorMessage = `No data provided. Cannot render chart.`;
        // console.warn(errorMessage); // Use warn for non-critical but problematic states
        // d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMessage}</div>`);
        // return null; // Allow empty chart if config is fine but data is empty. Original might draw axes.
        // The original code would proceed and likely error or draw empty axes.
        // For now, let's allow it to proceed to see how D3 handles empty data with scales.
        // If it errors, then add this check back.
    }

    const yFieldUnit = (yFieldDef && yFieldDef.unit !== "none") ? yFieldDef.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const typography = {
        title: { ...defaultTypography.title, ...inputTypography.title },
        label: { ...defaultTypography.label, ...inputTypography.label },
        annotation: { ...defaultTypography.annotation, ...inputTypography.annotation }
    };

    const baseDefaultColors = {
        field: {},
        other: { primary: "#D32F2F", secondary: "#AAAAAA" },
        available_colors: ["#D32F2F", "#AAAAAA", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        background_color: "#F0F0F0",
        text_color: "#333333"
    };

    let rawColors = data.colors_dark || data.colors || baseDefaultColors;
    const colors = {
        field: rawColors.field || baseDefaultColors.field,
        other: { ...baseDefaultColors.other, ...(rawColors.other || {}) },
        available_colors: rawColors.available_colors || baseDefaultColors.available_colors,
        background_color: rawColors.background_color || baseDefaultColors.background_color,
        text_color: rawColors.text_color || baseDefaultColors.text_color
    };

    const fillStyle = {
        typography: {
            titleFontFamily: typography.title.font_family,
            titleFontSize: typography.title.font_size,
            titleFontWeight: typography.title.font_weight,
            labelFontFamily: typography.label.font_family,
            labelFontSize: typography.label.font_size,
            labelFontWeight: typography.label.font_weight,
            annotationFontFamily: typography.annotation.font_family,
            annotationFontSize: typography.annotation.font_size,
            annotationFontWeight: typography.annotation.font_weight,
        },
        textColor: colors.text_color,
        backgroundColor: colors.background_color,
        primaryColor: colors.other.primary,
        secondaryColor: colors.other.secondary,
        categoricalFieldColors: colors.field || {},
        categoricalAvailableColors: colors.available_colors && colors.available_colors.length > 0 ?
                                    colors.available_colors :
                                    [colors.other.primary, colors.other.secondary, "#2ca02c", "#d62728", "#9467bd"]
    };

    function estimateTextWidth(text, fontProps) {
        const detachedSvg = d3.create("svg");
        const textElement = detachedSvg.append("text")
            .style("font-family", fontProps.fontFamily)
            .style("font-size", fontProps.fontSize)
            .style("font-weight", fontProps.fontWeight)
            .text(text);
        const width = textElement.node().getBBox().width;
        detachedSvg.remove();
        return width;
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 40 }; // Original margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataInput.map((d, i) => ({
        time: new Date(d[xFieldName]),
        value: +d[yFieldName],
        group: d[groupFieldName],
        originalIndex: i
    }));

    processedData.sort((a, b) => a.time - b.time);

    const uniqueTimes = Array.from(new Set(processedData.map(d => d.time.getTime())))
        .map(t => new Date(t));
    uniqueTimes.sort((a, b) => a - b);

    const timeOrderMap = new Map();
    uniqueTimes.forEach((time, index) => timeOrderMap.set(time.getTime(), index));
    processedData.forEach(d => d.order = timeOrderMap.get(d.time.getTime()));

    const allGroups = [...new Set(processedData.map(d => d.group))];
    const groupsToUse = allGroups.slice(0, 2);

    const groupColorMap = {};
    groupsToUse.forEach((group, index) => {
        groupColorMap[group] = fillStyle.categoricalFieldColors[group] ||
                               fillStyle.categoricalAvailableColors[index % fillStyle.categoricalAvailableColors.length];
    });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleLinear()
        .domain([0, uniqueTimes.length > 1 ? uniqueTimes.length - 1 : (uniqueTimes.length === 1 ? 1 : 0)]) // Domain [0,1] for single item for centering
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 1]) // Fallback domain max to 1 if no data or all zero
        .range([innerHeight, 0])
        .nice();

    const categorySlotWidth = uniqueTimes.length > 0 ? innerWidth / uniqueTimes.length : innerWidth;
    const barVisualWidthFactor = 0.45;
    const barPaddingFactor = 0.9;
    const singleBarSlotWidth = categorySlotWidth * barVisualWidthFactor;
    const renderedBarWidth = singleBarSlotWidth * barPaddingFactor;

    // Block 7: Chart Component Rendering
    const maxTicks = 8;
    const dataLength = uniqueTimes.length;
    const finalTickIndices = [];

    if (dataLength > 0) {
        let currentTickIndex = 0;
        finalTickIndices.push(currentTickIndex);
        const tickStep = Math.max(1, Math.ceil(dataLength / maxTicks));
        const lastDataIndex = dataLength - 1;
        
        while(currentTickIndex + tickStep <= lastDataIndex) { // Ensure we don't overshoot
            currentTickIndex += tickStep;
            finalTickIndices.push(currentTickIndex);
        }
        if (lastDataIndex > 0 && !finalTickIndices.includes(lastDataIndex) && finalTickIndices[finalTickIndices.length-1] !== lastDataIndex) {
            if (finalTickIndices.length < maxTicks || (lastDataIndex - finalTickIndices[finalTickIndices.length-1]) >= tickStep / 2 ) {
                finalTickIndices.push(lastDataIndex);
            }
        }
        if (dataLength === 1 && finalTickIndices.length === 0) finalTickIndices.push(0);
        if (dataLength > 1 && finalTickIndices.length === 1 && finalTickIndices[0] !== lastDataIndex) finalTickIndices.push(lastDataIndex); // Ensure start and end for 2 points
    }
    
    const xAxisGenerator = d3.axisBottom(xScale)
        .tickValues(dataLength > 0 ? finalTickIndices : [])
        .tickFormat(i => (i >= 0 && i < uniqueTimes.length) ? d3.timeFormat('%Y')(uniqueTimes[i]) : "")
        .tickSize(0)
        .tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxisGenerator);
    xAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("text-anchor", "middle")
        .style("fill", fillStyle.textColor);
    xAxisGroup.select(".domain").remove();

    const yAxisGenerator = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(formatValue)
        .tickSize(0)
        .tickPadding(10); // Increased from original 15 to 10, dx removed

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxisGenerator);
    yAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("text-anchor", "end")
        .style("fill", fillStyle.textColor);
    yAxisGroup.select(".domain").remove();

    if (yFieldUnit) {
        mainChartGroup.append("text")
            .attr("class", "label y-axis-unit")
            .attr("x", 0) 
            .attr("y", -10) 
            .style("text-anchor", "start") // Original was start
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(`(${yFieldUnit})`);
    }

    if (groupsToUse.length > 0 && chartDataInput.length > 0) {
        const legendItemHeight = 20;
        const legendInterItemPadding = 10; // Space between legend items
        const legendRectSize = 15;
        const legendTextRectGap = 5;

        const legendItems = groupsToUse.map(group => ({
            group: group,
            width: legendRectSize + legendTextRectGap + estimateTextWidth(group, {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            })
        }));
        const totalLegendWidth = legendItems.reduce((sum, item) => sum + item.width, 0) + (legendItems.length - 1) * legendInterItemPadding;
        
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${chartMargins.left + (innerWidth - totalLegendWidth) / 2}, ${containerHeight - chartMargins.bottom / 2 - legendItemHeight / 2})`);

        let currentX = 0;
        legendItems.forEach(item => {
            const legendElementGroup = legendGroup.append("g").attr("transform", `translate(${currentX}, 0)`);
            legendElementGroup.append("rect")
                .attr("class", "mark legend-mark")
                .attr("width", legendRectSize).attr("height", legendRectSize)
                .attr("y", (legendItemHeight - legendRectSize) / 2)
                .style("fill", groupColorMap[item.group]);
            legendElementGroup.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendRectSize + legendTextRectGap).attr("y", legendItemHeight / 2)
                .attr("dy", "0.35em")
                .text(item.group)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor).style("text-anchor", "start");
            currentX += item.width + legendInterItemPadding;
        });
    }

    // Block 8: Main Data Visualization Rendering
    if (chartDataInput.length > 0) {
        groupsToUse.forEach((group, groupIndex) => {
            const groupData = processedData.filter(d => d.group === group);
            mainChartGroup.selectAll(`.bar-group-${groupIndex}`)
                .data(groupData, d => d.originalIndex)
                .enter()
                .append("rect")
                .attr("class", `mark bar bar-group-${groupIndex} bar-item-${String(group).replace(/\W/g, '_')}`)
                .attr("x", d => {
                    const groupCenterOffset = (groupIndex - (groupsToUse.length - 1) / 2) * singleBarSlotWidth;
                    const xBase = uniqueTimes.length === 1 ? innerWidth / 2 : xScale(d.order); // Center if only one time point
                    const slotX = xBase + groupCenterOffset - singleBarSlotWidth / 2;
                    return slotX + (singleBarSlotWidth - renderedBarWidth) / 2;
                })
                .attr("y", d => yScale(d.value))
                .attr("width", renderedBarWidth)
                .attr("height", d => Math.max(0, innerHeight - yScale(d.value)))
                .style("fill", groupColorMap[group]);
        });
    }

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}