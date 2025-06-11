/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 300,
  "min_width": 300,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const typographyData = data.typography || {};
    const typography = {
        title: { ...defaultTypography.title, ...(typographyData.title || {}) },
        label: { ...defaultTypography.label, ...(typographyData.label || {}) },
        annotation: { ...defaultTypography.annotation, ...(typographyData.annotation || {}) }
    };

    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };
    const colors = { ...defaultColors, ...(data.colors || {}) };
    colors.other = { ...defaultColors.other, ...(colors.other || {}) };
    
    const images = data.images || {}; // Not used in this chart, but extracted per spec

    // Determine critical field names
    const categoryFieldSpec = dataColumns.find(col => col.role === "x");
    const valueFieldSpec = dataColumns.find(col => col.role === "y");

    const categoryFieldName = categoryFieldSpec ? categoryFieldSpec.name : undefined;
    const valueFieldName = valueFieldSpec ? valueFieldSpec.name : undefined;
    
    let categoryFieldUnit = categoryFieldSpec && categoryFieldSpec.unit !== "none" ? categoryFieldSpec.unit : "";
    let valueFieldUnit = valueFieldSpec && valueFieldSpec.unit !== "none" ? valueFieldSpec.unit : "";

    // Critical Identifier Validation
    const missingFields = [];
    if (!categoryFieldName) missingFields.push("category field (role 'x')");
    if (!valueFieldName) missingFields.push("value field (role 'y')");

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
        barColor: (colors.other && colors.other.primary) ? colors.other.primary : defaultColors.other.primary,
        textColor: colors.text_color || defaultColors.text_color,
        axisLineColor: colors.text_color || defaultColors.text_color, // Assuming axis lines use text_color
        chartBackground: colors.background_color || defaultColors.background_color,
        typography: {
            labelFontFamily: typography.label.font_family,
            labelFontSize: typography.label.font_size,
            labelFontWeight: typography.label.font_weight,
            annotationFontFamily: typography.annotation.font_family, // Example if needed elsewhere
            annotationFontSize: typography.annotation.font_size,
            annotationFontWeight: typography.annotation.font_weight
        }
    };

    // Helper: In-memory text measurement (not strictly used for layout in this simple chart, but defined per spec)
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.font_size || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.font_weight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Not appending to DOM for measurement
        return tempText.getBBox().width;
    }

    // Helper: Value formatting
    const formatValue = (value) => {
        let formattedValue;
        if (value >= 1000000000) {
            formattedValue = d3.format("~.2s")(value).replace('G', 'B'); // More standard SI, B for Billion
        } else if (value >= 1000000) {
            formattedValue = d3.format("~.2s")(value); // M for Million
        } else if (value >= 1000) {
            formattedValue = d3.format("~.2s")(value); // k for Kilo
        } else {
            formattedValue = d3.format("~g")(value); // General format for smaller numbers
        }
        return formattedValue + (valueFieldUnit ? ` ${valueFieldUnit}` : '');
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
    const chartMargins = {
        top: variables.margin_top || 50,
        right: variables.margin_right || 30,
        bottom: variables.margin_bottom || 50, // Reduced from original 80 for potentially tighter layout
        left: variables.margin_left || 100      // Increased from original 40 to accommodate longer Y-axis labels
    };
    
    // Adjust left margin based on estimated max category label width if desired (example, not fully implemented here)
    // let maxCategoryLabelWidth = 0;
    // if (chartData.length > 0) {
    //     chartData.forEach(d => {
    //         const labelWidth = estimateTextWidth(d[categoryFieldName], typography.label);
    //         if (labelWidth > maxCategoryLabelWidth) maxCategoryLabelWidth = labelWidth;
    //     });
    //     chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + 10); // Add padding
    // }


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartData.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure value is numeric
    })).sort((a, b) => b.value - a.value); // Sort by value descending

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerHeight])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 0]) // Handle empty data for max
        .range([0, innerWidth])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // X-axis (Value Axis)
    const xAxis = d3.axisBottom(xScale)
        .ticks(Math.max(2, Math.min(Math.floor(innerWidth / 80), 7))) // Dynamic ticks based on width
        .tickFormat(d => formatValue(d).replace(` ${valueFieldUnit}`, '')) // Remove unit for axis to avoid clutter, keep for labels
        .tickSizeOuter(0);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    xAxisGroup.selectAll("line")
        .style("stroke", fillStyle.axisLineColor);
    xAxisGroup.select(".domain")
        .style("stroke", fillStyle.axisLineColor);


    // Y-axis (Category Axis)
    const yAxis = d3.axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);
    
    yAxisGroup.select(".domain").remove(); // Remove Y-axis domain line for cleaner look

    yAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(function(d) { // Truncate long labels if necessary
            const self = d3.select(this);
            let text = d;
            const maxWidth = chartMargins.left - 15; // Available space for Y-axis labels
            if (estimateTextWidth(text, typography.label) > maxWidth) {
                while (estimateTextWidth(text + "...", typography.label) > maxWidth && text.length > 0) {
                    text = text.slice(0, -1);
                }
                text += "...";
            }
            return text;
        });


    // Block 8: Main Data Visualization Rendering
    const barElements = mainChartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar")
        .attr("y", d => yScale(d.category))
        .attr("x", 0)
        .attr("height", yScale.bandwidth())
        .attr("width", d => Math.max(0, xScale(d.value))) // Ensure width is not negative
        .attr("fill", fillStyle.barColor);

    // Data Labels
    const labelElements = mainChartGroup.selectAll(".data-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label data-label")
        .attr("y", d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr("x", d => Math.max(0, xScale(d.value)) + 5) // Position 5px to the right of the bar
        .attr("dy", ".35em") // Vertical centering
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "start")
        .text(d => formatValue(d.value));

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}