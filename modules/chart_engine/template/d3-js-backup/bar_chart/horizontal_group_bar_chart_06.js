/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_group_bar_chart_06",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["x", "group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": [],
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
  "legend": "normal",
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
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming colors_dark is an alternative
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const criticalFields = {};
    if (dimensionFieldConfig) criticalFields.dimensionFieldName = dimensionFieldConfig.name;
    if (valueFieldConfig) criticalFields.valueFieldName = valueFieldConfig.name;
    if (groupFieldConfig) criticalFields.groupFieldName = groupFieldConfig.name;

    const missingFields = Object.entries(criticalFields)
        .filter(([key, value]) => value === undefined)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    const { dimensionFieldName, valueFieldName, groupFieldName } = criticalFields;

    const dimensionUnit = dimensionFieldConfig.unit !== "none" ? dimensionFieldConfig.unit : "";
    const valueUnit = valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";
    // const groupUnit = groupFieldConfig.unit !== "none" ? groupFieldConfig.unit : ""; // Not typically used for labels

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
        chartBackground: colors.background_color || '#FFFFFF',
        defaultBarColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4',
        // Categorical colors will be handled by d3.scaleOrdinal with fallbacks
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox across browsers
        // but the spec says "MUST NOT be appended to the document DOM".
        // For robust headless measurement, a canvas-based approach or a properly configured JSDOM is better.
        // This getBBox on an unattached SVG element might be 0 or inaccurate in some environments.
        // Assuming it works sufficiently for this context.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements fails (e.g. JSDOM without layout)
            return text.length * (parseFloat(fontSize) / 2); // Rough estimate
        }
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI prefix
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value); // General format for smaller numbers
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 60, // Reduced top margin as no main title
        right: 30,
        bottom: 40,
        left: 60
    };

    const dimensions = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];

    let maxDimensionLabelWidth = 0;
    dimensions.forEach(dim => {
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const width = estimateTextWidth(formattedDim, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (width > maxDimensionLabelWidth) maxDimensionLabelWidth = width;
    });

    let maxValueLabelWidth = 0;
    chartData.forEach(d => {
        const value = parseFloat(d[valueFieldName]);
        if (isNaN(value)) return;
        const formattedVal = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
        const width = estimateTextWidth(formattedVal, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        if (width > maxValueLabelWidth) maxValueLabelWidth = width;
    });
    
    chartMargins.left = Math.max(chartMargins.left, maxDimensionLabelWidth + 15); // Add padding
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 10); // Add padding

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Cannot render chart.");
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("fill", "red")
            .text("Chart dimensions too small.");
        return svgRoot.node();
    }

    // Block 5: Data Preprocessing & Transformation
    // Data is used as is, no major transformation beyond extracting unique dimensions/groups.

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.2); // Adjusted padding

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => parseFloat(d[valueFieldName])) || 0])
        .range([0, innerWidth])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(
            groups.map((group, i) => {
                if (colors.field && colors.field[group]) {
                    return colors.field[group];
                }
                if (colors.available_colors && colors.available_colors.length > 0) {
                    return colors.available_colors[i % colors.available_colors.length];
                }
                return d3.schemeCategory10[i % 10]; // Fallback to D3 scheme
            })
        );

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - 10})`); // Position above chart area

    let legendXOffset = 0;
    const legendItemPadding = 10;
    const legendRectSize = 15;

    groups.forEach((group, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${legendXOffset}, 0)`);

        legendItem.append("rect")
            .attr("class", "mark legend-color-sample")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", colorScale(group));

        const legendText = legendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendRectSize + 5)
            .attr("y", legendRectSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);
        
        const textWidth = estimateTextWidth(group, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        legendXOffset += legendRectSize + 5 + textWidth + legendItemPadding;
    });
    
    // Center the legend if space allows, otherwise it just flows
    const totalLegendWidth = legendXOffset - legendItemPadding; // remove last padding
    if (totalLegendWidth < innerWidth) {
        legendGroup.attr("transform", `translate(${chartMargins.left + (innerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2 - 10})`);
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const dimensionGroups = mainChartGroup.selectAll(".dimension-group")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "dimension-group")
        .attr("transform", d => `translate(0, ${yScale(d)})`);

    dimensionGroups.append("text")
        .attr("class", "label dimension-label")
        .attr("x", -10)
        .attr("y", yScale.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => dimensionUnit ? `${d}${dimensionUnit}` : d);

    const groupBarHeight = yScale.bandwidth() / groups.length;

    dimensions.forEach(dimension => {
        const dimensionData = chartData.filter(d => d[dimensionFieldName] === dimension);
        const currentDimensionGroup = dimensionGroups.filter(d => d === dimension);

        currentDimensionGroup.selectAll(".bar")
            .data(groups)
            .enter()
            .append("rect")
            .attr("class", d => `mark bar group-${d.replace(/\s+/g, '-')}`)
            .attr("y", (group, i) => i * groupBarHeight)
            .attr("height", Math.max(0, groupBarHeight - 1)) // Small gap between grouped bars
            .attr("x", 0)
            .attr("width", group => {
                const dataPoint = dimensionData.find(dp => dp[groupFieldName] === group);
                const value = dataPoint ? parseFloat(dataPoint[valueFieldName]) : 0;
                return xScale(Math.max(0, value)); // Ensure width is not negative
            })
            .attr("fill", group => colorScale(group));

        currentDimensionGroup.selectAll(".value-label")
            .data(groups)
            .enter()
            .append("text")
            .attr("class", "label value-label")
            .attr("y", (group, i) => (i * groupBarHeight) + (groupBarHeight / 2))
            .attr("x", group => {
                const dataPoint = dimensionData.find(dp => dp[groupFieldName] === group);
                const value = dataPoint ? parseFloat(dataPoint[valueFieldName]) : 0;
                return xScale(Math.max(0, value)) + 5; // Position after bar
            })
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group => {
                const dataPoint = dimensionData.find(dp => dp[groupFieldName] === group);
                const value = dataPoint ? parseFloat(dataPoint[valueFieldName]) : NaN;
                if (isNaN(value)) return "";
                return valueUnit ? `${formatValue(value)}${valueUnit}` : formatValue(value);
            });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}