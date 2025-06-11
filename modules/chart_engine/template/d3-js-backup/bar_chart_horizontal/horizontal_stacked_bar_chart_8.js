/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_chart_8",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 8], [0, "inf"], [2, 4]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "secondary", "background"],
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x", yFieldRole = "y", groupFieldRole = "group";
    const xFieldCol = dataColumns.find(col => col.role === xFieldRole);
    const yFieldCol = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldCol = dataColumns.find(col => col.role === groupFieldRole);

    let criticalMissingFields = [];
    if (!xFieldCol) criticalMissingFields.push(`role '${xFieldRole}'`);
    if (!yFieldCol) criticalMissingFields.push(`role '${yFieldRole}'`);
    if (!groupFieldCol) criticalMissingFields.push(`role '${groupFieldRole}'`);

    if (criticalMissingFields.length > 0) {
        const errorMsg = `Critical chart configuration missing: Column(s) with ${criticalMissingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div").style("color", "red").html(`Error: ${errorMsg}`);
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const groupFieldName = groupFieldCol.name;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        let undefinedFieldNames = [];
        if (!xFieldName) undefinedFieldNames.push("x field name (from role 'x')");
        if (!yFieldName) undefinedFieldNames.push("y field name (from role 'y')");
        if (!groupFieldName) undefinedFieldNames.push("group field name (from role 'group')");
        const errorMsg = `Critical chart configuration missing: Field name(s) [${undefinedFieldNames.join(', ')}] are undefined after role mapping. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div").style("color", "red").html(`Error: ${errorMsg}`);
        return null;
    }

    const yFieldUnit = (yFieldCol.unit && yFieldCol.unit !== "none") ? yFieldCol.unit : "";

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
        chartBackground: rawColors.background_color || '#FFFFFF',
        textColor: rawColors.text_color || '#333333',
        dataLabelColor: '#FFFFFF', // Default for labels inside bars
        axisLineColor: '#D3D3D3', // Default, though axes are minimal
    };

    const defaultCategoricalColors = d3.schemeCategory10;
    fillStyle.getBarSegmentColor = (groupName, index) => {
        if (rawColors.field && rawColors.field[groupName]) {
            return rawColors.field[groupName];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[index % rawColors.available_colors.length];
        }
        return defaultCategoricalColors[index % defaultCategoricalColors.length];
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight = 'normal') => {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            // console.warn("getBBox on in-memory SVG failed for estimateTextWidth.", e);
        }
        return width;
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
    const chartMargins = { top: 50, right: 100, bottom: 50, left: 50 };
    if (images && images.field && Object.keys(images.field).length > 0) {
        // Increase right margin if icons are present
        // Estimate based on typical icon size, could be more dynamic
        chartMargins.right = Math.max(chartMargins.right, (variables.icon_size || 40) + 20);
    }


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const uniqueGroupNames = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort(); // Sort for consistent color mapping

    const groupedData = d3.group(chartDataArray, d => d[xFieldName]);
    const processedData = Array.from(groupedData, ([key, values]) => {
        const obj = { [xFieldName]: key };
        uniqueGroupNames.forEach(group => {
            obj[group] = d3.sum(values.filter(d => d[groupFieldName] === group), d => +d[yFieldName]);
        });
        obj.total = d3.sum(values, d => +d[yFieldName]);
        return obj;
    });

    const stackGenerator = d3.stack()
        .keys(uniqueGroupNames)
        .order(d3.stackOrderNone) // Keep original group order for stacking
        .offset(d3.stackOffsetNone);

    const stackedData = stackGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d[xFieldName]))
        .range([innerHeight, 0])
        .padding(0.4);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) * 1.05]) // 5% padding for total
        .range([0, innerWidth])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(uniqueGroupNames)
        .range(uniqueGroupNames.map((group, i) => fillStyle.getBarSegmentColor(group, i)));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10).tickFormat(formatValue));
    
    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll("text")
        .attr("class", "label axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);


    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickSize(0).tickPadding(10));
    
    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll(".tick text").remove(); // Remove default Y tick labels, custom ones will be added

    // Custom Y-axis category labels (placed above bars)
    processedData.forEach(d => {
        mainChartGroup.append("text")
            .attr("class", "label y-axis-category-label")
            .attr("x", 0)
            .attr("y", yScale(d[xFieldName]) - 10)
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d[xFieldName]);
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barLayers = mainChartGroup.selectAll(".bar-layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `layer mark layer-${d.key.replace(/\s+/g, '-').toLowerCase()}`) // Add class for group key
        .style("fill", d => colorScale(d.key));

    barLayers.selectAll(".bar-segment")
        .data(d => d.map(item => ({ ...item, key: d.key }))) // Add key to each segment data
        .enter().append("rect")
        .attr("class", "mark bar-segment")
        .attr("y", d => yScale(d.data[xFieldName]))
        .attr("x", d => xScale(d[0]))
        .attr("width", d => Math.max(0, xScale(d[1]) - xScale(d[0]))) // Ensure width is not negative
        .attr("height", yScale.bandwidth());

    // Data labels: Group Name
    barLayers.selectAll(".label-group-name")
        .data(d => d.map(item => ({ ...item, key: d.key })))
        .enter().append("text")
        .attr("class", "label data-label group-name-label")
        .attr("y", d => yScale(d.data[xFieldName]) + yScale.bandwidth() * 0.35)
        .attr("x", d => xScale(d[0]) + 5)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.dataLabelColor)
        .text(d => {
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            const textToShow = d.key; // Group name
            // Basic check for text fitting, could use estimateTextWidth if more precision needed
            if (segmentWidth < estimateTextWidth(textToShow, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight) + 10) return ""; 
            return textToShow;
        });

    // Data labels: Value
    barLayers.selectAll(".label-value")
        .data(d => d.map(item => ({ ...item, key: d.key })))
        .enter().append("text")
        .attr("class", "label data-label value-label")
        .attr("y", d => yScale(d.data[xFieldName]) + yScale.bandwidth() * 0.70)
        .attr("x", d => xScale(d[0]) + 5)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.dataLabelColor)
        .text(d => {
            const value = d[1] - d[0];
            if (value <= 0) return "";
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            const textToShow = formatValue(value) + (yFieldUnit ? " " + yFieldUnit : "");
            if (segmentWidth < estimateTextWidth(textToShow, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight) + 10) return "";
            return textToShow;
        });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    const iconSize = yScale.bandwidth() * 0.7;
    if (images && images.field) {
        mainChartGroup.selectAll(".icon-image")
            .data(processedData.filter(d => images.field && images.field[d[xFieldName]]))
            .enter()
            .append("image")
            .attr("class", "icon image icon-image")
            .attr("x", innerWidth + 10)
            .attr("y", d => yScale(d[xFieldName]) + (yScale.bandwidth() - iconSize) / 2)
            .attr("width", iconSize)
            .attr("height", iconSize)
            .attr("xlink:href", d => images.field[d[xFieldName]]);
    }
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}