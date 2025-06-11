/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_chart_9",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 8], [0, "inf"], [2, 4]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["text_color", "background_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "dark",

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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const inputTypography = data.typography || {};
    const typography = {
        title: { ...defaultTypography.title, ...(inputTypography.title || {}) },
        label: { ...defaultTypography.label, ...(inputTypography.label || {}) },
        annotation: { ...defaultTypography.annotation, ...(inputTypography.annotation || {}) }
    };

    // Color defaults (dark theme oriented, as per original metadata "background": "dark")
    const defaultColors = {
        field: {},
        other: { primary: "#BB86FC", secondary: "#03DAC6" }, // Material Design dark theme accents
        available_colors: [...d3.schemeCategory10],
        background_color: "#121212",
        text_color: "#E0E0E0"
    };
    // Prioritize colors_dark if available, then colors, then defaults
    const rawColors = data.colors_dark || data.colors || {};
    const colors = {
        field: rawColors.field || defaultColors.field,
        other: { ...defaultColors.other, ...(rawColors.other || {}) },
        available_colors: rawColors.available_colors || defaultColors.available_colors,
        background_color: rawColors.background_color || defaultColors.background_color,
        text_color: rawColors.text_color || defaultColors.text_color
    };
    
    const images = data.images || { field: {}, other: {} };

    // Critical field name extraction
    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const yFieldName = yFieldConfig ? yFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    const yFieldUnit = (yFieldConfig && yFieldConfig.unit !== "none") ? yFieldConfig.unit : "";

    // Critical Identifier Validation
    const missingFields = [];
    if (!xFieldName) missingFields.push("x field (role: 'x')");
    if (!yFieldName) missingFields.push("y field (role: 'y')");
    if (!groupFieldName) missingFields.push("group field (role: 'group')");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    // Clear the container
    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
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
        chartBackground: colors.background_color,
        primaryAccent: colors.other.primary,
        // Group colors will be resolved in the color scale setup
    };

    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.font_family || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontProps.font_size || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontProps.font_weight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Document append/remove is not strictly necessary for getBBox if styles are applied directly,
        // but some browsers might be more consistent if it's briefly in DOM.
        // However, per spec, "MUST NOT be appended to the document DOM".
        // For robustness without DOM append:
        // document.body.appendChild(svg); // Temporarily append to measure
        // const width = textElement.getBBox().width;
        // document.body.removeChild(svg); // Clean up
        // return width;
        // Simpler approach if direct styling and no DOM append works (often does):
        return textElement.getBBox().width;
    }
    
    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for billion
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const chartMargins = { top: 50, right: 100, bottom: 50, left: 50 };
    if (images.field && Object.keys(images.field).length > 0) {
        // Potentially adjust right margin if icons are present and need more space
        // For now, using fixed margin.
    }


    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [yFieldName]: +d[yFieldName] // Ensure yField is numeric
    }));

    const xCategories = Array.from(new Set(chartDataArray.map(d => d[xFieldName]))).sort(); // Sort for consistent order
    const groupCategories = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort();

    const processedData = Array.from(d3.group(chartDataArray, d => d[xFieldName]), ([key, values]) => {
        const obj = { [xFieldName]: key };
        let total = 0;
        groupCategories.forEach(group => {
            const sumVal = d3.sum(values.filter(d => d[groupFieldName] === group), d => d[yFieldName]);
            obj[group] = sumVal;
            total += sumVal;
        });
        obj.total = total;
        return obj;
    });
     // Sort processedData by xCategories to match yScale domain
    processedData.sort((a, b) => xCategories.indexOf(a[xFieldName]) - xCategories.indexOf(b[xFieldName]));


    const stackGenerator = d3.stack()
        .keys(groupCategories)
        .order(d3.stackOrderNone) // Maintain original group order
        .offset(d3.stackOffsetNone);

    const stackedData = stackGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(xCategories) // Use sorted categories for Y-axis (categories)
        .range([innerHeight, 0])
        .padding(0.4);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) * 1.1 || 10]) // Ensure domain is at least 0-10
        .range([0, innerWidth])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groupCategories)
        .range(groupCategories.map((group, i) => 
            colors.field[group] || 
            (colors.available_colors && colors.available_colors.length > 0 ? colors.available_colors[i % colors.available_colors.length] : d3.schemeCategory10[i % 10])
        ));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10).tickFormat(formatValue));
    
    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll("text")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize);
    // Original code removed X-axis text: .remove(). This version keeps them. If removal is strict, add .remove()

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickSize(0).tickPadding(10));
        
    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll(".tick text").remove(); // Remove default Y-axis text labels

    // Add custom X-category labels (acting as Y-axis labels in horizontal chart)
    processedData.forEach(d => {
        mainChartGroup.append("text")
            .attr("class", "label y-axis-category-label")
            .attr("x", 0) 
            .attr("y", yScale(d[xFieldName]) - 10) // Position above where the bar will be
            .attr("dy", "-0.3em") // Adjust vertical alignment slightly
            .style("text-anchor", "start")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .text(d[xFieldName]);
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barLayers = mainChartGroup.selectAll(".bar-layer-group")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `bar-layer-group mark group-${d.key.toString().replace(/\s+/g, '-')}`)
        .style("fill", d => colorScale(d.key));

    barLayers.selectAll("rect")
        .data(d => d.map(item => ({ ...item, key: d.key }))) // Add key to individual segment data
        .enter().append("rect")
        .attr("class", "mark bar-segment")
        .attr("y", d => yScale(d.data[xFieldName]))
        .attr("x", d => xScale(d[0]))
        .attr("width", d => {
            const w = xScale(d[1]) - xScale(d[0]);
            return Math.max(0, w); // Ensure width is not negative
        })
        .attr("height", yScale.bandwidth());

    const MIN_WIDTH_FOR_TEXT_LABEL = 30; // Minimum width of a bar segment to show text

    // Add group labels inside bars
    barLayers.selectAll(".label.group-label-in-bar")
        .data(d => d.map(item => ({ ...item, key: d.key })))
        .enter().append("text")
        .attr("class", "label group-label-in-bar")
        .attr("y", d => yScale(d.data[xFieldName]) + yScale.bandwidth() / 2) // Vertically centered
        .attr("x", d => xScale(d[0]) + 5) // Indent slightly from left edge of segment
        .attr("dy", "-0.1em") // Adjust for multi-line, position first line
        .style("text-anchor", "start")
        .style("dominant-baseline", "middle")
        .style("fill", fillStyle.textColor) // Assuming textColor is contrasting enough
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("pointer-events", "none")
        .text(d => {
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            if (segmentWidth < MIN_WIDTH_FOR_TEXT_LABEL) return "";
            // Estimate text width
            const textW = estimateTextWidth(d.key, { font_family: fillStyle.typography.annotationFontFamily, font_size: fillStyle.typography.annotationFontSize });
            return (segmentWidth > textW + 10) ? d.key : ""; // Show if fits with padding
        });

    // Add value labels inside bars
    barLayers.selectAll(".label.value-label-in-bar")
        .data(d => d.map(item => ({ ...item, key: d.key })))
        .enter().append("text")
        .attr("class", "label value-label-in-bar")
        .attr("y", d => yScale(d.data[xFieldName]) + yScale.bandwidth() / 2) // Vertically centered
        .attr("x", d => xScale(d[0]) + 5) // Indent slightly
        .attr("dy", "0.9em") // Adjust for multi-line, position second line
        .style("text-anchor", "start")
        .style("dominant-baseline", "middle")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("pointer-events", "none")
        .text(d => {
            const value = d[1] - d[0];
            if (value <= 0) return "";
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            if (segmentWidth < MIN_WIDTH_FOR_TEXT_LABEL) return "";
            
            const formattedValue = formatValue(value) + (yFieldUnit || "");
            // Estimate text width
            const textW = estimateTextWidth(formattedValue, { font_family: fillStyle.typography.annotationFontFamily, font_size: fillStyle.typography.annotationFontSize });
            return (segmentWidth > textW + 10) ? formattedValue : ""; // Show if fits with padding
        });


    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    if (images.field && Object.keys(images.field).length > 0) {
        const iconSize = Math.min(yScale.bandwidth() * 0.7, 30); // Cap icon size
        mainChartGroup.selectAll(".icon.category-icon")
            .data(processedData)
            .enter()
            .append("image")
            .attr("class", "icon category-icon")
            .attr("x", innerWidth + 10) // Position to the right of the chart area
            .attr("y", d => yScale(d[xFieldName]) + (yScale.bandwidth() - iconSize) / 2)
            .attr("width", iconSize)
            .attr("height", iconSize)
            .attr("xlink:href", d => images.field[d[xFieldName]]);
    }
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}