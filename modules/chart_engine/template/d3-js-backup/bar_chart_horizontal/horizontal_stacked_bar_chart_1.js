/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 10]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "background_color", "text_color"],
  "min_height": 300,
  "min_width": 500,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via data.colors_dark
    const images = data.images || {}; // Images not used in this refactored version based on original
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldConfig = dataColumns.find(col => col.role === xFieldRole);
    const yFieldConfig = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldConfig = dataColumns.find(col => col.role === groupFieldRole);

    const categoryFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const valueFieldName = yFieldConfig ? yFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    const yFieldUnit = (yFieldConfig && yFieldConfig.unit !== "none" && yFieldConfig.unit) ? yFieldConfig.unit : "";

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push(`field with role '${xFieldRole}'`);
        if (!valueFieldName) missingFields.push(`field with role '${yFieldRole}'`);
        if (!groupFieldName) missingFields.push(`field with role '${groupFieldRole}'`);
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

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
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF', // Not directly used to draw SVG background, but available
        primaryAccent: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#1f77b4',
        defaultBarColor: '#cccccc',
        dataLabelColor: '#ffffff', // Color for labels inside bars
    };

    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // No need to set width/height on the temporary SVG
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // The SVG does not need to be in the DOM to use getBBox
        const width = textElement.getBBox().width;
        // No need to remove child or svg if it was never added to DOM
        return width;
    };
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~s")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground); // Apply background color to SVG root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 30, right: 50, bottom: 50, left: variables.left_margin || 150 }; // Increased right margin for total labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartData.map(d => d[groupFieldName]))).sort(); // Sort for consistent color mapping

    const processedData = Array.from(d3.group(chartData, d => d[categoryFieldName]), ([key, values]) => {
        const obj = { [categoryFieldName]: key };
        groups.forEach(group => {
            obj[group] = d3.sum(values.filter(d => d[groupFieldName] === group), d => +d[valueFieldName]);
        });
        obj.total = d3.sum(values, d => +d[valueFieldName]);
        return obj;
    });

    const stack = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone) // Maintain original group order for stacking
        .offset(d3.stackOffsetNone);

    const stackedData = stack(processedData);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d[categoryFieldName]))
        .range([innerHeight, 0])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) || 1]) // Ensure domain is at least [0,1]
        .range([0, innerWidth])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(
            (rawColors.field && Object.keys(rawColors.field).length >= groups.length) ? 
            groups.map(g => rawColors.field[g] || fillStyle.defaultBarColor) : 
            (rawColors.available_colors && rawColors.available_colors.length > 0) ? 
            rawColors.available_colors : 
            d3.schemeCategory10
        );

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10).tickFormat(d => formatValue(d) + yFieldUnit));
    
    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickSize(0).tickPadding(10));
        
    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);
    
    // No legend as per simplification directives.

    // Block 8: Main Data Visualization Rendering
    const barLayers = mainChartGroup.selectAll(".bar-layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `bar-layer mark group-${String(d.key).replace(/\s+/g, '-')}`) // Add class for group
        .style("fill", d => colorScale(d.key));

    barLayers.selectAll("rect")
        .data(d => d.map(item => ({ ...item, key: d.key }))) // Pass key for access in text
        .enter().append("rect")
        .attr("class", "mark bar-segment")
        .attr("y", d => yScale(d.data[categoryFieldName]))
        .attr("x", d => xScale(d[0]))
        .attr("width", d => Math.max(0, xScale(d[1]) - xScale(d[0]))) // Ensure non-negative width
        .attr("height", yScale.bandwidth());

    // Data labels inside bars
    barLayers.selectAll(".segment-label")
        .data(d => d.map(item => ({ ...item, key: d.key })))
        .enter().append("text")
        .attr("class", "label segment-label")
        .attr("y", d => yScale(d.data[categoryFieldName]) + yScale.bandwidth() / 2)
        .attr("x", d => {
            const barWidth = xScale(d[1]) - xScale(d[0]);
            return xScale(d[0]) + barWidth / 2;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", fillStyle.dataLabelColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => {
            const value = d[1] - d[0];
            if (value === 0) return "";
            const barWidth = xScale(d[1]) - xScale(d[0]);
            const formattedText = formatValue(value); // No unit for segment labels to save space
            const textWidth = estimateTextWidth(formattedText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
            return (barWidth > textWidth + 4) ? formattedText : ''; // Add padding check
        });

    // Total labels outside bars
    mainChartGroup.selectAll(".total-label")
        .data(processedData)
        .enter().append("text")
        .attr("class", "label total-label")
        .attr("y", d => yScale(d[categoryFieldName]) + yScale.bandwidth() / 2)
        .attr("x", d => xScale(d.total) + 5) // Position to the right of the bar
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => (d.total > 0 ? formatValue(d.total) + yFieldUnit : ""));


    // Block 9: Optional Enhancements & Post-Processing
    // Removed shadows, strokes, gradients, patterns as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}