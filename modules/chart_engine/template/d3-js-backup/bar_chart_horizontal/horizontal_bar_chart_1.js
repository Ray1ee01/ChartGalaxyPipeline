/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_1",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "text_color", "background_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
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
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    const images = data.images || {}; // Not used in this chart, but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");

    if (!xFieldConfig || !xFieldConfig.name) {
        console.error("Critical chart config missing: x-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (x-axis field name).</div>");
        return null;
    }
    if (!yFieldConfig || !yFieldConfig.name) {
        console.error("Critical chart config missing: y-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (y-axis field name).</div>");
        return null;
    }

    const categoryFieldName = xFieldConfig.name;
    const valueFieldName = yFieldConfig.name;
    const valueFieldUnit = (yFieldConfig.unit && yFieldConfig.unit !== "none") ? ` ${yFieldConfig.unit}` : "";

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
        barPrimaryColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#D32F2F',
        chartBackground: rawColors.background_color || '#FFFFFF', // Not directly used to fill SVG background, but available
    };

    // Helper function for text width estimation (not strictly needed for this chart's layout but good practice)
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox, but forbidden by prompt.
        // This in-memory approach might be less accurate for some browsers/fonts.
        // For this chart, it's not critical as dynamic label fitting isn't complex.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            return (text && text.length || 0) * (parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
    }
    
    // Helper function for formatting values
    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        let numValue = Number(value);
        if (isNaN(numValue)) return String(value); // Return original if not a number

        if (Math.abs(numValue) >= 1000000000) {
            return d3.format("~.2s")(numValue).replace(/G/, "B"); // More robust for billions
        } else if (Math.abs(numValue) >= 1000000) {
            return d3.format("~.2s")(numValue);
        } else if (Math.abs(numValue) >= 1000) {
            return d3.format("~.2s")(numValue);
        }
        return d3.format("~g")(numValue); // Use ~g for smaller numbers or non-SI fitting
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
        .attr("class", "chart-root-svg");
        // No viewBox, width/height are absolute.

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin_top || 20, // Simplified margins, original had more complex title/subtitle spacing
        right: variables.margin_right || 30, // Adjusted for labels
        bottom: variables.margin_bottom || 30, // Adjusted for hidden X-axis
        left: variables.margin_left || 100  // Adjusted for Y-axis labels
    };
    
    // Calculate actual inner chart dimensions
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataArray.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure value is numeric
    })).sort((a, b) => b.value - a.value); // Sort by value descending

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated chart dimensions are invalid. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Chart dimensions are too small.</div>");
        return null;
    }
    
    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerHeight])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) > 0 ? d3.max(processedData, d => d.value) : 1]) // Ensure domain is at least [0,1]
        .range([0, innerWidth])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Y-axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickSize(0).tickPadding(10));

    yAxisGroup.select(".domain").remove(); // Remove Y-axis line for a cleaner look, common in horizontal bars

    yAxisGroup.selectAll("text")
        .attr("class", "label y-axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // X-axis (rendered but hidden, as per original logic)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .ticks(Math.max(2, Math.floor(innerWidth / 80))) // Responsive ticks, at least 2
            .tickFormat(d => formatValue(d) + valueFieldUnit)
            .tickSize(0)
            .tickPadding(10)
        );
    
    xAxisGroup.select(".domain").remove(); // Remove X-axis line
    xAxisGroup.selectAll("text")
        .attr("class", "label x-axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("opacity", 0); // Hide X-axis text as per original behavior

    // No gridlines as per directive and original chart

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar-mark")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar-mark")
        .attr("y", d => yScale(d.category))
        .attr("x", 0)
        .attr("height", yScale.bandwidth())
        .attr("width", d => Math.max(0, xScale(d.value))) // Ensure width is not negative
        .attr("fill", fillStyle.barPrimaryColor);

    // Data labels on bars
    const dataLabels = mainChartGroup.selectAll(".data-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label data-label")
        .attr("y", d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr("x", d => Math.max(0, xScale(d.value)) + 5) // Position 5px to the right of the bar end
        .attr("dy", ".35em") // Vertical centering
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "start")
        .text(d => formatValue(d.value) + valueFieldUnit);
        
    // Adjust label position if it overflows chart width
    dataLabels.each(function(d) {
        const labelNode = d3.select(this);
        const labelWidth = this.getBBox ? this.getBBox().width : estimateTextWidth(labelNode.text(), {fontSize: fillStyle.typography.labelFontSize});
        const barEndPosition = Math.max(0, xScale(d.value));
        
        if (barEndPosition + 5 + labelWidth > innerWidth) {
            // If label overflows, try placing it inside the bar
            if (barEndPosition - 5 - labelWidth > 0) { // Check if there's space inside
                 labelNode.attr("x", barEndPosition - 5)
                          .style("text-anchor", "end")
                          .style("fill", d3.hsl(fillStyle.barPrimaryColor).l > 0.5 ? '#000000' : '#FFFFFF'); // Contrast color
            } else {
                // If no space inside either, hide it or truncate (hiding for simplicity)
                labelNode.style("opacity", 0);
            }
        }
    });


    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}