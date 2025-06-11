/* REQUIREMENTS_BEGIN
{
  "chart_type": "Diverging Bar Chart",
  "chart_name": "diverging_bar_plain_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group", "x"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const dimensionFieldName = dimensionFieldConfig?.name;
    const valueFieldName = valueFieldConfig?.name;
    const groupFieldName = groupFieldConfig?.name;

    let criticalError = false;
    let missingFields = [];
    if (!dimensionFieldName) missingFields.push("x role field");
    if (!valueFieldName) missingFields.push("y role field");
    if (!groupFieldName) missingFields.push("group role field");

    if (missingFields.length > 0) {
        criticalError = true;
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    const dimensionUnit = dimensionFieldConfig.unit !== "none" ? dimensionFieldConfig.unit : "";
    const valueUnit = valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";
    const groupUnit = groupFieldConfig.unit !== "none" ? groupFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            groupLabelFontFamily: typographyInput.label?.font_family || "Arial, sans-serif",
            groupLabelFontSize: typographyInput.label?.font_size || "12px",
            groupLabelFontWeight: typographyInput.label?.font_weight || "normal",
            dimensionLabelFontFamily: typographyInput.label?.font_family || "Arial, sans-serif",
            dimensionLabelFontSize: typographyInput.label?.font_size || "12px",
            dimensionLabelFontWeight: typographyInput.label?.font_weight || "normal",
            valueLabelFontFamily: typographyInput.annotation?.font_family || "Arial, sans-serif",
            valueLabelFontSize: typographyInput.annotation?.font_size || "10px",
            valueLabelFontWeight: typographyInput.annotation?.font_weight || "normal",
        },
        textColor: colorsInput.text_color || "#333333",
        chartBackground: colorsInput.background_color || "#FFFFFF",
        groupColors: {},
        defaultGroupColor: (colorsInput.other?.primary) || (colorsInput.available_colors ? colorsInput.available_colors[0] : "#1f77b4"),
        iconUrls: imagesInput.field || {},
        defaultIconUrl: imagesInput.other?.primary || null
    };

    const uniqueGroupNames = [...new Set(chartData.map(d => d[groupFieldName]))];
    uniqueGroupNames.forEach((groupName, i) => {
        if (colorsInput.field && colorsInput.field[groupName]) {
            fillStyle.groupColors[groupName] = colorsInput.field[groupName];
        } else if (colorsInput.available_colors && colorsInput.available_colors.length > i) {
            fillStyle.groupColors[groupName] = colorsInput.available_colors[i];
        } else {
            fillStyle.groupColors[groupName] = d3.schemeCategory10[i % d3.schemeCategory10.length];
        }
    });
    
    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('style', `font-family: ${fontFamily}; font-size: ${fontSize}; font-weight: ${fontWeight};`);
        textNode.textContent = text;
        svg.appendChild(textNode);
        // Note: Appending to body and then removing is more reliable for getBBox, but trying without first.
        // If issues, uncomment: document.body.appendChild(svg);
        const width = textNode.getBBox().width;
        // if (svg.parentNode === document.body) document.body.removeChild(svg);
        return width;
    };

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 80, bottom: 40, left: 80 }; // Adjusted margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const iconWidth = 20;
    const iconHeight = 15;
    const iconPadding = 5;
    const showDimensionIcons = variables.show_dimension_icons !== undefined ? variables.show_dimension_icons : true; // Default to true if icons might be available

    const allDimensionNames = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    let maxLabelWidth = 0;
    allDimensionNames.forEach(dimName => {
        const formattedDimName = dimensionUnit ? `${dimName}${dimensionUnit}` : `${dimName}`;
        let currentLabelWidth = estimateTextWidth(
            formattedDimName,
            fillStyle.typography.dimensionLabelFontFamily,
            fillStyle.typography.dimensionLabelFontSize,
            fillStyle.typography.dimensionLabelFontWeight
        );
        if (showDimensionIcons && (fillStyle.iconUrls[dimName] || fillStyle.defaultIconUrl)) {
            currentLabelWidth += iconWidth + iconPadding;
        }
        maxLabelWidth = Math.max(maxLabelWidth, currentLabelWidth);
    });
    const dimensionLabelWidth = Math.max(maxLabelWidth + 10, 80); // Add padding, min width 80

    // Block 5: Data Preprocessing & Transformation
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];
    if (groups.length < 2) {
        const errorMsg = "Diverging bar chart requires at least two groups. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }
    const leftGroupName = groups[0];
    const rightGroupName = groups[1];

    // Order dimensions as they appear in the data
    const dimensions = allDimensionNames;

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.3); // Fixed padding

    const maxLeftValue = d3.max(chartData.filter(d => d[groupFieldName] === leftGroupName), d => Math.abs(d[valueFieldName])) || 0;
    const maxRightValue = d3.max(chartData.filter(d => d[groupFieldName] === rightGroupName), d => Math.abs(d[valueFieldName])) || 0;
    
    const barAreaWidth = (innerWidth - dimensionLabelWidth) / 2;

    const leftXScale = d3.scaleLinear()
        .domain([0, maxLeftValue])
        .range([barAreaWidth, 0]); // Bar grows from center to left

    const rightXScale = d3.scaleLinear()
        .domain([0, maxRightValue])
        .range([0, barAreaWidth]); // Bar grows from center to right

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    // Group Labels
    const formattedLeftGroup = groupUnit ? `${leftGroupName}${groupUnit}` : `${leftGroupName}`;
    mainChartGroup.append("text")
        .attr("class", "text group-label left-group-label")
        .attr("x", barAreaWidth / 2)
        .attr("y", -15) // Position above the chart area
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.groupLabelFontFamily)
        .style("font-size", fillStyle.typography.groupLabelFontSize)
        .style("font-weight", fillStyle.typography.groupLabelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedLeftGroup);

    const formattedRightGroup = groupUnit ? `${rightGroupName}${groupUnit}` : `${rightGroupName}`;
    mainChartGroup.append("text")
        .attr("class", "text group-label right-group-label")
        .attr("x", barAreaWidth + dimensionLabelWidth + barAreaWidth / 2)
        .attr("y", -15) // Position above the chart area
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.groupLabelFontFamily)
        .style("font-size", fillStyle.typography.groupLabelFontSize)
        .style("font-weight", fillStyle.typography.groupLabelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedRightGroup);

    // Dimension Labels (Central)
    const dimensionLabelsGroup = mainChartGroup.append("g")
        .attr("class", "dimension-labels-group")
        .attr("transform", `translate(${barAreaWidth}, 0)`);

    dimensions.forEach(dimName => {
        const yPos = yScale(dimName) + yScale.bandwidth() / 2;
        const formattedDimName = dimensionUnit ? `${dimName}${dimensionUnit}` : `${dimName}`;
        const iconUrl = fillStyle.iconUrls[dimName] || (variables.use_default_icon_for_dimensions ? fillStyle.defaultIconUrl : null);
        
        let textX = dimensionLabelWidth / 2;
        let textAnchor = "middle";

        if (showDimensionIcons && iconUrl) {
            dimensionLabelsGroup.append("image")
                .attr("class", "icon dimension-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", (dimensionLabelWidth / 2) - (estimateTextWidth(formattedDimName, fillStyle.typography.dimensionLabelFontFamily, fillStyle.typography.dimensionLabelFontSize, fillStyle.typography.dimensionLabelFontWeight) / 2) - iconWidth - iconPadding)
                .attr("y", yPos - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight);
            
            textX = (dimensionLabelWidth / 2) - (estimateTextWidth(formattedDimName, fillStyle.typography.dimensionLabelFontFamily, fillStyle.typography.dimensionLabelFontSize, fillStyle.typography.dimensionLabelFontWeight) / 2) + iconPadding;
            textAnchor = "start";
        }
        
        dimensionLabelsGroup.append("text")
            .attr("class", "text dimension-label")
            .attr("x", textX)
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", textAnchor)
            .style("font-family", fillStyle.typography.dimensionLabelFontFamily)
            .style("font-size", fillStyle.typography.dimensionLabelFontSize)
            .style("font-weight", fillStyle.typography.dimensionLabelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedDimName);
    });

    // Block 8: Main Data Visualization Rendering
    const barSlope = 5; // For trapezoid shape

    // Left Bars
    dimensions.forEach(dimName => {
        const dataPoint = chartData.find(d => d[dimensionFieldName] === dimName && d[groupFieldName] === leftGroupName);
        if (dataPoint) {
            const value = Math.abs(dataPoint[valueFieldName]);
            const barPathWidth = barAreaWidth - leftXScale(value); // Corrected: this is the actual width of the bar on the scale
            const xStart = leftXScale(value); // This is the leftmost point of the bar
            const yPos = yScale(dimName);
            const barHeight = yScale.bandwidth();

            const pathDataLeft = [
                `M ${xStart} ${yPos}`,
                `L ${xStart + barPathWidth} ${yPos}`,
                `L ${xStart + barPathWidth} ${yPos + barHeight}`,
                `L ${xStart - barSlope} ${yPos + barHeight}`,
                "Z"
            ].join(" ");

            mainChartGroup.append("path")
                .attr("class", "mark bar left-bar")
                .attr("d", pathDataLeft)
                .attr("fill", fillStyle.groupColors[leftGroupName] || fillStyle.defaultGroupColor);

            const formattedVal = formatValue(dataPoint[valueFieldName]) + valueUnit;
            mainChartGroup.append("text")
                .attr("class", "label value-label left-value-label")
                .attr("x", xStart - barSlope - 5) // Position outside, to the left
                .attr("y", yPos + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.valueLabelFontFamily)
                .style("font-size", fillStyle.typography.valueLabelFontSize)
                .style("font-weight", fillStyle.typography.valueLabelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(formattedVal);
        }
    });

    // Right Bars
    dimensions.forEach(dimName => {
        const dataPoint = chartData.find(d => d[dimensionFieldName] === dimName && d[groupFieldName] === rightGroupName);
        if (dataPoint) {
            const value = Math.abs(dataPoint[valueFieldName]);
            const barPathWidth = rightXScale(value);
            const xStart = barAreaWidth + dimensionLabelWidth; // Start of right bar area
            const yPos = yScale(dimName);
            const barHeight = yScale.bandwidth();

            const pathDataRight = [
                `M ${xStart} ${yPos}`,
                `L ${xStart + barPathWidth} ${yPos}`,
                `L ${xStart + barPathWidth + barSlope} ${yPos + barHeight}`,
                `L ${xStart} ${yPos + barHeight}`,
                "Z"
            ].join(" ");

            mainChartGroup.append("path")
                .attr("class", "mark bar right-bar")
                .attr("d", pathDataRight)
                .attr("fill", fillStyle.groupColors[rightGroupName] || fillStyle.defaultGroupColor);

            const formattedVal = formatValue(dataPoint[valueFieldName]) + valueUnit;
            mainChartGroup.append("text")
                .attr("class", "label value-label right-value-label")
                .attr("x", xStart + barPathWidth + barSlope + 5) // Position outside, to the right
                .attr("y", yPos + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.valueLabelFontFamily)
                .style("font-size", fillStyle.typography.valueLabelFontSize)
                .style("font-weight", fillStyle.typography.valueLabelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(formattedVal);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - mouseover effects removed for simplification)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}