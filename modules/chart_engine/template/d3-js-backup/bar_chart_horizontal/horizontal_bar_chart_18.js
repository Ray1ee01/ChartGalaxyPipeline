/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is external)

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");

    if (!categoryFieldConfig || !valueFieldConfig) {
        const missing = [];
        if (!categoryFieldConfig) missing.push("x-role field definition");
        if (!valueFieldConfig) missing.push("y-role field definition");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = categoryFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;
    
    if (!categoryFieldName || !valueFieldName) {
        const missing = [];
        if (!categoryFieldName) missing.push("x-role field name");
        if (!valueFieldName) missing.push("y-role field name");
        const errorMsg = `Critical chart config missing: field name(s) for ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldUnit = categoryFieldConfig.unit && categoryFieldConfig.unit !== "none" ? categoryFieldConfig.unit : "";
    const valueFieldUnit = valueFieldConfig.unit && valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            categoryLabel: {
                font_family: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
                font_weight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            },
            valueLabel: {
                font_family: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
                font_weight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
            }
        },
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        primaryAccent: (colorsConfig.other && colorsConfig.other.primary) || '#0099ff',
        getBarColor: (categoryValue, index) => {
            if (colorsConfig.field && colorsConfig.field[categoryValue]) {
                return colorsConfig.field[categoryValue];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
            }
            return fillStyle.primaryAccent;
        }
    };
    
    const tempMeasureSVG = d3.select(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
        .attr('width', 0).attr('height', 0).style('visibility', 'hidden').style('position', 'absolute');

    function robustEstimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempText = tempMeasureSVG.append("text")
            .style("font-family", fontFamily)
            .style("font-size", fontSize)
            .style("font-weight", fontWeight)
            .text(text);
        let width = 0;
        try {
            width = tempText.node().getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on detached elements
            width = text.length * (parseFloat(fontSize) * 0.6); 
        }
        tempText.remove();
        return width;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format(".2s")(value).replace('G', 'B');
        } else if (Math.abs(value) >= 1000000) {
            return d3.format(".2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format(".2s")(value);
        }
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: chartConfig.margin_top || 90,
        right: chartConfig.margin_right || 40,
        bottom: chartConfig.margin_bottom || 60,
        left: chartConfig.margin_left || 30
    };
    
    let maxValueWidth = 0;
    if (chartDataArray.length > 0) {
        const estimateFontSize = (typographyConfig.annotation && typographyConfig.annotation.font_size) || '12px';
        chartDataArray.forEach(d => {
            const formattedVal = formatValue(d[valueFieldName]) + valueFieldUnit;
            const textWidth = robustEstimateTextWidth(formattedVal, fillStyle.typography.valueLabel.font_family, estimateFontSize, fillStyle.typography.valueLabel.font_weight);
            maxValueWidth = Math.max(maxValueWidth, textWidth);
        });
    }
    chartMargins.right = Math.max(chartMargins.right, maxValueWidth + 15);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated inner chart dimensions are not positive. Adjust margins or container size.";
        console.error(errorMsg);
        svgRoot.append("text").attr("x", 10).attr("y", 20).text(errorMsg).attr("fill", "red").attr("class", "text error-message");
        return svgRoot.node();
    }
    
    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const sortedCategories = sortedData.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const Y_SCALE_PADDING = 0.55; 
    const yScale = d3.scaleBand()
        .domain(sortedCategories)
        .range([0, innerHeight])
        .padding(Y_SCALE_PADDING);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueFieldName]) * 1.1 || 10])
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "chart-area");

    // Block 8: Main Data Visualization Rendering
    const barHeight = yScale.bandwidth();
    
    if (barHeight <= 0 && sortedCategories.length > 0) { 
        const errorMsg = "Bar height is zero or negative. Too many categories for the given height and padding.";
        console.error(errorMsg);
        mainChartGroup.append("text").attr("x", 0).attr("y", innerHeight / 2).text(errorMsg).attr("fill", "red").attr("class", "text error-message");
        return svgRoot.node();
    }

    const iconHeight = Math.max(8, Math.min(barHeight * 0.8, 30));
    const iconWidth = iconHeight; 
    const categoryLabelFontSize = `${Math.max(8, Math.min(iconHeight * 0.9, parseFloat(typographyConfig.label?.font_size || "16")))}px`;
    const valueLabelFontSize = `${Math.max(8, Math.min(barHeight * 0.6, parseFloat(typographyConfig.annotation?.font_size || "16")))}px`;

    sortedData.forEach((d, i) => {
        const category = d[categoryFieldName];
        const value = +d[valueFieldName];
        const barY = yScale(category);

        if (barY === undefined) { // Should not happen if sortedCategories is derived from sortedData
            console.warn(`Category ${category} not found in yScale. Skipping.`);
            return;
        }

        const barElementGroup = mainChartGroup.append("g")
            .attr("class", "bar-element-group")
            .attr("transform", `translate(0, ${barY})`);

        const labelIconGroupYOffset = - (iconHeight * 0.2 + 2);
        const labelIconGroup = mainChartGroup.append("g")
            .attr("class", "label-icon-group")
            .attr("transform", `translate(0, ${barY + labelIconGroupYOffset})`);

        let currentXOffsetForLabel = 0;
        const iconPadding = 5;

        const iconUrl = imagesConfig.field && imagesConfig.field[category] ? imagesConfig.field[category] : null;
        if (iconUrl) {
            labelIconGroup.append("image")
                .attr("xlink:href", iconUrl)
                .attr("x", currentXOffsetForLabel)
                .attr("y", -iconHeight) 
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("class", "icon image");
            currentXOffsetForLabel += iconWidth + iconPadding;
        }

        const categoryLabelText = categoryFieldUnit ? `${category}${categoryFieldUnit}` : `${category}`;
        labelIconGroup.append("text")
            .attr("x", currentXOffsetForLabel)
            .attr("y", -iconHeight / 2) 
            .attr("dy", "0.35em") 
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.categoryLabel.font_family)
            .style("font-size", categoryLabelFontSize)
            .style("font-weight", fillStyle.typography.categoryLabel.font_weight)
            .style("fill", fillStyle.textColor)
            .text(categoryLabelText)
            .attr("class", "label category-label text");

        const calculatedBarWidth = xScale(value);
        barElementGroup.append("rect")
            .attr("x", 0)
            .attr("y", 0) 
            .attr("width", calculatedBarWidth > 0 ? calculatedBarWidth : 0)
            .attr("height", barHeight)
            .attr("fill", fillStyle.getBarColor(category, i))
            .attr("class", "mark bar");

        const valueLabelText = formatValue(value) + valueFieldUnit;
        barElementGroup.append("text")
            .attr("x", (calculatedBarWidth > 0 ? calculatedBarWidth : 0) + 5) 
            .attr("y", barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.valueLabel.font_family)
            .style("font-size", valueLabelFontSize)
            .style("font-weight", fillStyle.typography.valueLabel.font_weight)
            .style("fill", fillStyle.textColor)
            .text(valueLabelText)
            .attr("class", "value data-label text");
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements.

    // Block 10: Cleanup & SVG Node Return
    tempMeasureSVG.remove(); 
    return svgRoot.node();
}