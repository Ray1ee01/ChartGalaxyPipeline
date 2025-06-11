/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Group Bar Chart",
  "chart_name": "horizontal_group_bar_chart_05_hand",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["x", "group"],
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
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal grouped bar chart.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    if (!dimensionFieldConfig || !valueFieldConfig || !groupFieldConfig) {
        const missing = [
            !dimensionFieldConfig ? "x role" : null,
            !valueFieldConfig ? "y role" : null,
            !groupFieldConfig ? "group role" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: data columns for roles [${missing}] not found. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionFieldName = dimensionFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    if (!dimensionFieldName || !valueFieldName || !groupFieldName) {
        const missingFields = [
            !dimensionFieldName ? "dimension field name (from x role)" : null,
            !valueFieldName ? "value field name (from y role)" : null,
            !groupFieldName ? "group field name (from group role)" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: field names [${missingFields}] are undefined. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionUnit = dimensionFieldConfig.unit !== "none" ? dimensionFieldConfig.unit : "";
    const valueUnit = valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";
    // const groupUnit = groupFieldConfig.unit !== "none" ? groupFieldConfig.unit : ""; // Not typically used for display

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'normal',
        },
        textColor: rawColors.text_color || '#0f223b',
        chartBackground: rawColors.background_color || '#FFFFFF', // Not used directly on SVG, but good to have
        defaultCategoryColors: d3.schemeCategory10,
        images: {
            field: rawImages.field || {},
            other: rawImages.other || {}
        }
    };

    fillStyle.getColor = (groupValue, index) => {
        if (rawColors.field && rawColors.field[groupFieldName] && rawColors.field[groupFieldName][groupValue]) {
            return rawColors.field[groupFieldName][groupValue];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[index % rawColors.available_colors.length];
        }
        return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
    };
    
    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but per spec, in-memory should not be appended.
        // If issues, this might need to be temporarily appended to the DOM.
        // For this implementation, we assume direct getBBox on un-appended element works.
        let width = 0;
        try {
             width = tempText.getBBox().width;
        } catch (e) {
            // Fallback or error logging if getBBox fails (e.g. in some test environments)
            console.warn("estimateTextWidth getBBox failed, returning 0. Text:", text, e);
            // A more robust fallback might involve a canvas-based measurement.
        }
        return width;
    };

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
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Optional: if chart background is needed

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin_top || 20, // Reduced top margin as no title/legend
        right: variables.margin_right || 30,
        bottom: variables.margin_bottom || 20,
        left: variables.margin_left || 60
    };

    const iconPadding = 5;
    const iconEstimatedWidth = 25; // Initial estimate, will be refined by actual icon size if possible

    let maxDimensionLabelWidth = 0;
    const uniqueDimensions = [...new Set(chartDataArray.map(d => d[dimensionFieldName]))];
    uniqueDimensions.forEach(dim => {
        const labelText = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const textWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        let iconWidth = 0;
        if (fillStyle.images.field && fillStyle.images.field[dimensionFieldName] && fillStyle.images.field[dimensionFieldName][dim]) {
            iconWidth = iconEstimatedWidth; // Use estimate or actual if available
        }
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, textWidth + (iconWidth > 0 ? iconWidth + iconPadding : 0));
    });
    
    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const value = parseFloat(d[valueFieldName]);
        const formattedValue = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
        const textWidth = estimateTextWidth(formattedValue, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });

    chartMargins.left = Math.max(chartMargins.left, maxDimensionLabelWidth + 20); // Add padding
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 10); // Add padding

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated inner chart dimensions are not positive. Check container size and margins.";
        console.error(errorMsg);
         d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    
    // Block 5: Data Preprocessing & Transformation
    const dimensions = uniqueDimensions; // Using the already computed unique dimensions
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    // Data is used in its original order for dimensions.

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.2); // A sensible default padding for groups of bars

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => +d[valueFieldName]) || 0]) // Ensure domain starts at 0 and handles empty/all-zero data
        .range([0, innerWidth]);

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => fillStyle.getColor(group, i)));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend as per requirements.

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const dimensionGroups = mainChartGroup.selectAll(".dimension-group")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "dimension-group other")
        .attr("transform", d => `translate(0, ${yScale(d)})`);

    dimensionGroups.each(function(dimensionName) {
        const groupElement = d3.select(this);
        const dimensionData = chartDataArray.filter(d => d[dimensionFieldName] === dimensionName);
        
        const bandHeight = yScale.bandwidth();
        const groupBarHeight = bandHeight / groups.length;
        const iconSize = Math.min(groupBarHeight * groups.length * 0.8, 30); // Icon size relative to total bar group height

        let currentXOffsetForLabel = 0;
        // Add dimension icon
        const iconUrl = fillStyle.images.field && fillStyle.images.field[dimensionFieldName] && fillStyle.images.field[dimensionFieldName][dimensionName] 
                        ? fillStyle.images.field[dimensionFieldName][dimensionName]
                        : (fillStyle.images.other && fillStyle.images.other[dimensionName] ? fillStyle.images.other[dimensionName] : null);

        if (iconUrl) {
            groupElement.append("image")
                .attr("class", "icon image")
                .attr("xlink:href", iconUrl)
                .attr("x", -iconSize - iconPadding -5) // Position icon to the left of the label
                .attr("y", (bandHeight - iconSize) / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
            currentXOffsetForLabel = -iconSize - iconPadding * 2 - 5;
        } else {
            currentXOffsetForLabel = -iconPadding -5; // Default padding if no icon
        }

        // Add dimension label
        const labelText = dimensionUnit ? `${dimensionName}${dimensionUnit}` : `${dimensionName}`;
        groupElement.append("text")
            .attr("class", "label text")
            .attr("x", currentXOffsetForLabel)
            .attr("y", bandHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(labelText);

        // Add bars for each group
        groupElement.selectAll(".bar")
            .data(groups)
            .enter()
            .append("rect")
            .attr("class", "mark")
            .attr("x", 0)
            .attr("y", (groupName, i) => i * groupBarHeight)
            .attr("width", groupName => {
                const dataPoint = dimensionData.find(d => d[groupFieldName] === groupName);
                return dataPoint ? xScale(parseFloat(dataPoint[valueFieldName])) : 0;
            })
            .attr("height", groupBarHeight)
            .attr("fill", groupName => colorScale(groupName));

        // Add value labels
        groupElement.selectAll(".value-label")
            .data(groups)
            .enter()
            .append("text")
            .attr("class", "value text")
            .attr("x", groupName => {
                const dataPoint = dimensionData.find(d => d[groupFieldName] === groupName);
                return dataPoint ? xScale(parseFloat(dataPoint[valueFieldName])) + 5 : 5; // 5px padding
            })
            .attr("y", (groupName, i) => (i * groupBarHeight) + (groupBarHeight / 2))
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(groupName => {
                const dataPoint = dimensionData.find(d => d[groupFieldName] === groupName);
                if (!dataPoint) return "";
                const value = parseFloat(dataPoint[valueFieldName]);
                return valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
            });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects like shadows, gradients, or roughjs.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}