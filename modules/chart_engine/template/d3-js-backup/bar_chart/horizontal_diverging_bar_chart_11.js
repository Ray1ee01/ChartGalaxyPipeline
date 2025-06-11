/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_11",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
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
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    if (!dimensionFieldConfig || !valueFieldConfig || !groupFieldConfig) {
        const missing = [];
        if (!dimensionFieldConfig) missing.push("x role");
        if (!valueFieldConfig) missing.push("y role");
        if (!groupFieldConfig) missing.push("group role");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')} in dataColumns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; font-size: 12px;'>${errorMsg}</div>`);
        return null;
    }

    const dimensionFieldName = dimensionFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    let dimensionUnit = dimensionFieldConfig.unit !== "none" ? dimensionFieldConfig.unit : "";
    let valueUnit = valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";
    let groupUnit = groupFieldConfig.unit !== "none" ? groupFieldConfig.unit : "";

    const allDimensions = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];

    if (groups.length < 2) {
        const errorMsg = "Chart requires at least two groups for comparison. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; font-size: 12px;'>${errorMsg}</div>`);
        return null;
    }
    
    const leftGroup = groups[0];
    const rightGroup = groups[1];

    const isDataComplete = allDimensions.every(dimension => {
        const hasLeftData = chartData.some(d => d[dimensionFieldName] === dimension && d[groupFieldName] === leftGroup);
        const hasRightData = chartData.some(d => d[dimensionFieldName] === dimension && d[groupFieldName] === rightGroup);
        return hasLeftData && hasRightData;
    });

    if (!isDataComplete) {
        const errorMsg = "Data is incomplete: not all categories have data for both comparison groups. Cannot render.";
        console.error(errorMsg);
        // Typography might not be fully set up here, so use sensible defaults for error.
        const errorFontFamily = (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif';
        const errorFontSize = (typography.label && typography.label.font_size) ? typography.label.font_size : '12px';
        d3.select(containerSelector)
            .html("")
            .append("div")
            .style("color", "orange")
            .style("text-align", "center")
            .style("padding", "20px")
            .style("font-family", errorFontFamily)
            .style("font-size", errorFontSize)
            .html("Data is incomplete: not all categories have data for both comparison groups. Cannot render.");
        return null;
    }
    
    const dimensions = [...allDimensions]; // Use original order

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
        textColor: colors.text_color || '#333333',
        chartBackground: colors.background_color || '#FFFFFF', // Not directly used on SVG, but good practice
        groupColors: {}, // To be populated by colorScale
        defaultBarColor: '#CCCCCC'
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but trying to adhere to "MUST NOT be appended to the document DOM".
        // If this causes issues, a temporary append/remove might be needed.
        // For many browsers, getBBox works on unattached elements.
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) {
            // Fallback or error handling if getBBox fails on unattached element
            console.warn("getBBox on unattached element failed, text width estimation might be inaccurate.", e);
            width = text.length * (parseFloat(fontSize) / 2); // Rough fallback
        }
        return width;
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // G for Giga, B for Billion
        if (value >= 1000000) return d3.format("~.2s")(value).replace('M', 'M'); // M for Mega/Million
        if (value >= 1000) return d3.format("~.2s")(value).replace('k', 'K'); // k for kilo, K for Thousand
        return d3.format("~g")(value);
    }
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .style("background-color", fillStyle.chartBackground); // Apply background to SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 40, left: 30 }; // Adjusted top margin for group labels

    let maxDimLabelWidth = 0;
    dimensions.forEach(dim => {
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const width = estimateTextWidth(formattedDim, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (width > maxDimLabelWidth) maxDimLabelWidth = width;
    });
    const dimensionLabelWidth = Math.max(maxDimLabelWidth + 20, 80); // Add padding, min width 80

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    // (Most relevant data like `dimensions`, `leftGroup`, `rightGroup` already prepared in Block 1)

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.3);

    const maxValue = d3.max(chartData, d => +d[valueFieldName]);

    const leftXScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([innerWidth / 2 - dimensionLabelWidth / 2, 0]);

    const rightXScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, innerWidth / 2 - dimensionLabelWidth / 2]);
    
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => {
            if (colors.field && colors.field[group]) {
                return colors.field[group];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[i % colors.available_colors.length];
            }
            return d3.schemeCategory10[i % 10]; // Fallback to D3 scheme
        }));

    groups.forEach(group => {
        fillStyle.groupColors[group] = colorScale(group);
    });

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const formattedLeftGroup = groupUnit ? `${leftGroup}${groupUnit}` : `${leftGroup}`;
    mainChartGroup.append("text")
        .attr("class", "label group-label")
        .attr("x", innerWidth / 4 - dimensionLabelWidth / 4)
        .attr("y", -15) // Position above the bars, within top margin
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedLeftGroup);

    const formattedRightGroup = groupUnit ? `${rightGroup}${groupUnit}` : `${rightGroup}`;
    mainChartGroup.append("text")
        .attr("class", "label group-label")
        .attr("x", innerWidth * 3 / 4 + dimensionLabelWidth / 4)
        .attr("y", -15) // Position above the bars, within top margin
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedRightGroup);

    dimensions.forEach(dimension => {
        const yPos = yScale(dimension) + yScale.bandwidth() / 2;
        const formattedDimension = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", innerWidth / 2)
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(formattedDimension);
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.append("g").attr("class", "bars-group");

    dimensions.forEach(dimension => {
        const yPosBand = yScale(dimension);
        const barHeight = yScale.bandwidth();

        // Left bars
        const leftDataPoint = chartData.find(d => d[dimensionFieldName] === dimension && d[groupFieldName] === leftGroup);
        if (leftDataPoint) {
            const value = +leftDataPoint[valueFieldName];
            const barX = leftXScale(value);
            const barW = (innerWidth / 2 - dimensionLabelWidth / 2) - barX;

            if (barW > 0) { // Only draw if width is positive
                barElements.append("rect")
                    .attr("class", "mark bar left-bar")
                    .attr("x", barX)
                    .attr("y", yPosBand)
                    .attr("width", barW)
                    .attr("height", barHeight)
                    .attr("fill", fillStyle.groupColors[leftGroup] || fillStyle.defaultBarColor);

                const formattedVal = valueUnit ? `${formatValue(value)}${valueUnit}` : formatValue(value);
                barElements.append("text")
                    .attr("class", "value data-label")
                    .attr("x", barX - 5) // Position to the left of the bar
                    .attr("y", yPosBand + barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end")
                    .style("fill", fillStyle.textColor)
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .text(formattedVal);
            }
        }

        // Right bars
        const rightDataPoint = chartData.find(d => d[dimensionFieldName] === dimension && d[groupFieldName] === rightGroup);
        if (rightDataPoint) {
            const value = +rightDataPoint[valueFieldName];
            const barX = innerWidth / 2 + dimensionLabelWidth / 2;
            const barW = rightXScale(value);
            
            if (barW > 0) { // Only draw if width is positive
                barElements.append("rect")
                    .attr("class", "mark bar right-bar")
                    .attr("x", barX)
                    .attr("y", yPosBand)
                    .attr("width", barW)
                    .attr("height", barHeight)
                    .attr("fill", fillStyle.groupColors[rightGroup] || fillStyle.defaultBarColor);

                const formattedVal = valueUnit ? `${formatValue(value)}${valueUnit}` : formatValue(value);
                barElements.append("text")
                    .attr("class", "value data-label")
                    .attr("x", barX + barW + 5) // Position to the right of the bar
                    .attr("y", yPosBand + barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("fill", fillStyle.textColor)
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .text(formattedVal);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - hover effects removed for simplification)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}