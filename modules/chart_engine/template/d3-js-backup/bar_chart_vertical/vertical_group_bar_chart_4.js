/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Bar Chart",
  "chart_name": "vertical_grouped_bar_chart",
  "is_composite": false,
  "required_fields": ["x", "y", "group", "group2"],
  "hierarchy": ["group", "group2"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"], ["categorical"]],
  "required_fields_range": [[2, 8], [0, "inf"], [2, 2], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "detailed",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container early

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const group1Column = dataColumns.find(col => col.role === "group");
    const group2Column = dataColumns.find(col => col.role === "group2");

    const xField = xColumn ? xColumn.name : undefined;
    const yField = yColumn ? yColumn.name : undefined;
    const group1Field = group1Column ? group1Column.name : undefined;
    const group2Field = group2Column ? group2Column.name : undefined;
    const yUnit = yColumn && yColumn.unit && yColumn.unit !== "none" ? yColumn.unit : "";

    const criticalFields = { xField, yField, group1Field, group2Field };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) ? rawTypography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) ? rawTypography.title.font_size : '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) ? rawTypography.title.font_weight : 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF', // Not used directly on SVG, but available
        primaryColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#4682B4',
        defaultCategoryColors: rawColors.available_colors || d3.schemeCategory10,
        fieldColors: rawColors.field || {}
    };
    
    // Helper to estimate text width without rendering to DOM
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but trying to adhere to "MUST NOT be appended to the document DOM".
        // This might be less accurate for some browsers/setups if not in DOM.
        // For robustness, one might briefly append, measure, and remove.
        // However, direct getBBox on unattached element often works.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails on unattached element
            return text.length * (parseInt(fontSize, 10) * 0.6); // Rough estimate
        }
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    function lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16),
            amt = Math.round(2.55 * percent),
            R = (num >> 16) + amt,
            G = (num >> 8 & 0x00FF) + amt,
            B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)).toString(16).slice(1);
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Optional: apply background to SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 100, right: 30, bottom: 60, left: 100 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const xValues = [...new Set(chartDataArray.map(d => d[xField]))];
    const group1Values = [...new Set(chartDataArray.map(d => d[group1Field]))];
    const group2Values = [...new Set(chartDataArray.map(d => d[group2Field]))];

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.2);

    const dataMax = d3.max(chartDataArray, d => +d[yField]) || 100;
    let yMax;
    if (dataMax <= 10) yMax = 10;
    else if (dataMax <= 20) yMax = 20;
    else if (dataMax <= 50) yMax = 50;
    else if (dataMax <= 100) yMax = 100;
    else yMax = Math.ceil(dataMax / 100) * 100;

    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerHeight, 0]);

    const totalInnerGroups = group1Values.length * group2Values.length;
    const groupScale = d3.scaleBand()
        .domain(d3.range(totalInnerGroups))
        .range([0, xScale.bandwidth()])
        .padding(0.05); // Fixed padding, removed variables.has_spacing

    const colorMap = {};
    group1Values.forEach((g1Value, g1Idx) => {
        const baseColor = fillStyle.fieldColors[g1Value] || fillStyle.defaultCategoryColors[g1Idx % fillStyle.defaultCategoryColors.length];
        group2Values.forEach((g2Value, g2Idx) => {
            let colorVariant;
            if (group2Values.length === 1) {
                colorVariant = baseColor;
            } else if (group2Values.length === 2) {
                colorVariant = (g2Idx === 0) ? lightenColor(baseColor, 30) : baseColor;
            } else {
                const step = 60 / (group2Values.length - 1);
                colorVariant = lightenColor(baseColor, 40 - (g2Idx * step));
            }
            colorMap[`${g1Value} ${g2Value}`] = colorVariant;
        });
    });

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0));
    
    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll(".tick text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize) // Using fixed size
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend");

    const legendItems = [];
    group2Values.forEach(g2Value => {
        group1Values.forEach(g1Value => {
            legendItems.push({
                group2: g2Value,
                group1: g1Value,
                color: colorMap[`${g1Value} ${g2Value}`]
            });
        });
    });
    
    const legendLabelFontSize = parseInt(fillStyle.typography.labelFontSize) > 12 ? '12px' : fillStyle.typography.labelFontSize; // Cap legend item font size
    const legendTitleFontSize = parseInt(fillStyle.typography.labelFontSize) > 14 ? '14px' : fillStyle.typography.labelFontSize; // Cap legend title font size

    const firstGroup2Width = estimateTextWidth(group2Values[0], fillStyle.typography.labelFontFamily, legendTitleFontSize, "bold");
    const secondGroup2Width = estimateTextWidth(group2Values[1], fillStyle.typography.labelFontFamily, legendTitleFontSize, "bold");

    const group1Widths = {};
    group1Values.forEach(g1Value => {
        group1Widths[g1Value] = estimateTextWidth(g1Value, fillStyle.typography.labelFontFamily, legendLabelFontSize, fillStyle.typography.labelFontWeight);
    });
    const maxGroup1Width = Math.max(0, ...Object.values(group1Widths));

    const legendPadding = 8;
    const legendRectSize = 15;
    const spaceBetweenRectAndText = 5;
    const spaceBetweenMajorGroups = 30; // Space between the two main legend blocks
    const legendItemHeight = Math.max(20, legendRectSize + 5) ; // Ensure enough height

    const singleLegendBlockWidth = legendRectSize + spaceBetweenRectAndText + maxGroup1Width + legendPadding;
    const legendTotalWidth = firstGroup2Width + legendPadding +
                             singleLegendBlockWidth + spaceBetweenMajorGroups +
                             singleLegendBlockWidth + legendPadding + secondGroup2Width;
    
    // Position legend at the top, attempting to center it or align right if too wide
    let legendXPosition = (containerWidth - legendTotalWidth) / 2;
    if (legendXPosition < chartMargins.left) legendXPosition = chartMargins.left; // Prevent overlap with left margin area
    if (legendXPosition + legendTotalWidth > containerWidth - chartMargins.right) legendXPosition = containerWidth - chartMargins.right - legendTotalWidth; // Prevent overlap with right margin
    if (legendXPosition < 0) legendXPosition = legendPadding; // Ensure it's not off-screen left

    legendGroup.attr("transform", `translate(${legendXPosition}, ${chartMargins.top / 2 - legendItemHeight})`); // Adjust Y to be above chart

    let currentX = 0;

    legendGroup.append("text") // First group2 label (e.g., Male)
        .attr("class", "label legend-title")
        .attr("x", currentX)
        .attr("y", legendItemHeight * group1Values.length / 2 + legendRectSize / 2) // Vertically center with items
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", legendTitleFontSize)
        .style("font-weight", "bold")
        .style("fill", fillStyle.textColor)
        .text(group2Values[0]);
    currentX += firstGroup2Width + legendPadding;

    group1Values.forEach((g1Value, g1Index) => { // Items for first group2
        const item = legendItems.find(it => it.group2 === group2Values[0] && it.group1 === g1Value);
        if (!item) return;

        legendGroup.append("text")
            .attr("class", "label legend-item-label")
            .attr("x", currentX + maxGroup1Width)
            .attr("y", legendItemHeight * g1Index + legendRectSize / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", legendLabelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(item.group1);

        legendGroup.append("rect")
            .attr("class", "mark legend-item-colorbox")
            .attr("x", currentX + maxGroup1Width + spaceBetweenRectAndText)
            .attr("y", legendItemHeight * g1Index)
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .style("fill", item.color);
    });
    currentX += singleLegendBlockWidth + spaceBetweenMajorGroups;
    
    group1Values.forEach((g1Value, g1Index) => { // Items for second group2
        const item = legendItems.find(it => it.group2 === group2Values[1] && it.group1 === g1Value);
        if (!item) return;

        legendGroup.append("rect")
            .attr("class", "mark legend-item-colorbox")
            .attr("x", currentX)
            .attr("y", legendItemHeight * g1Index)
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .style("fill", item.color);

        legendGroup.append("text")
            .attr("class", "label legend-item-label")
            .attr("x", currentX + legendRectSize + spaceBetweenRectAndText)
            .attr("y", legendItemHeight * g1Index + legendRectSize / 2)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", legendLabelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(item.group1);
    });
    currentX += singleLegendBlockWidth + legendPadding;

    legendGroup.append("text") // Second group2 label (e.g., Female)
        .attr("class", "label legend-title")
        .attr("x", currentX)
        .attr("y", legendItemHeight * group1Values.length / 2 + legendRectSize / 2) // Vertically center
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", legendTitleFontSize)
        .style("font-weight", "bold")
        .style("fill", fillStyle.textColor)
        .text(group2Values[1]);


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const labelData = {};

    xValues.forEach(xVal => {
        const xData = chartDataArray.filter(d => d[xField] === xVal);
        labelData[xVal] = {};
        group1Values.forEach(g1Val => { labelData[xVal][g1Val] = []; });

        let groupIndex = 0;
        group1Values.forEach(g1Val => {
            group2Values.forEach(g2Val => {
                const dataPoint = xData.find(d => d[group1Field] === g1Val && d[group2Field] === g2Val);
                if (dataPoint) {
                    const barX = xScale(xVal) + groupScale(groupIndex);
                    const barY = yScale(+dataPoint[yField]);
                    const barWidth = groupScale.bandwidth();
                    const barHeight = innerHeight - barY;

                    mainChartGroup.append("rect")
                        .attr("class", "mark bar")
                        .attr("x", barX)
                        .attr("y", barY)
                        .attr("width", barWidth)
                        .attr("height", Math.max(0, barHeight)) // Ensure non-negative height
                        .style("fill", colorMap[`${g1Val} ${g2Val}`]);
                    
                    labelData[xVal][g1Val].push({
                        value: +dataPoint[yField],
                        barX: barX,
                        barWidth: barWidth,
                        barY: barY,
                        g2Value: g2Val // Store g2Value to map color correctly for labels
                    });
                }
                groupIndex++;
            });
        });
    });
    
    // Data Labels
    Object.keys(labelData).forEach(xVal => {
        Object.keys(labelData[xVal]).forEach(g1Val => {
            const bars = labelData[xVal][g1Val];
            if (bars.length !== 2) return; // Expecting two bars per g1Val (due to group2 having 2 values)

            // Sort bars by g2Value to ensure consistent order (e.g. group2Values[0] then group2Values[1])
            bars.sort((a, b) => group2Values.indexOf(a.g2Value) - group2Values.indexOf(b.g2Value));
            
            const bar1Data = bars[0];
            const bar2Data = bars[1];

            const minY = Math.min(bar1Data.barY, bar2Data.barY);
            const textCenterX = bar1Data.barX + bar1Data.barWidth + (bar2Data.barX - (bar1Data.barX + bar1Data.barWidth)) / 2;
            
            const labelWidth = (bar1Data.barWidth + bar2Data.barWidth) * 0.9;
            const labelHeight = Math.max(12, (bar1Data.barWidth + bar2Data.barWidth) * 0.4); // Ensure min height
            const labelPadding = 5;
            const labelFontSize = Math.max(8, labelHeight * 0.6) + 'px'; // Dynamic but capped

            // Label for bar2Data (second in group2Values, typically darker color)
            mainChartGroup.append("rect")
                .attr("class", "label-background")
                .attr("x", bar1Data.barX)
                .attr("y", minY - labelHeight - 5)
                .attr("width", labelWidth)
                .attr("height", labelHeight)
                .style("fill", colorMap[`${g1Val} ${bar2Data.g2Value}`]);

            mainChartGroup.append("text")
                .attr("class", "value label")
                .attr("x", textCenterX)
                .attr("y", minY - 5 - labelHeight / 2)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", "#FFFFFF") // Assuming white text contrasts well
                .text(formatValue(bar2Data.value) + (yUnit ? ` ${yUnit}` : ''));

            // Label for bar1Data (first in group2Values, typically lighter color)
            mainChartGroup.append("rect")
                .attr("class", "label-background")
                .attr("x", bar1Data.barX)
                .attr("y", minY - labelHeight - 5 - labelPadding - labelHeight)
                .attr("width", labelWidth)
                .attr("height", labelHeight)
                .style("fill", colorMap[`${g1Val} ${bar1Data.g2Value}`]);

            mainChartGroup.append("text")
                .attr("class", "value label")
                .attr("x", textCenterX)
                .attr("y", minY - 5 - labelHeight - labelPadding - labelHeight / 2)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", "#FFFFFF")
                .text(formatValue(bar1Data.value) + (yUnit ? ` ${yUnit}` : ''));
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - None in this refactor)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}