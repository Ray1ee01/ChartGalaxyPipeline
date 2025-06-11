/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "text_color", "background_color"],
  "min_height": 200,
  "min_width": 300,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "visible",
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const imagesInput = data.images || {}; // Though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const valueFieldUnit = (dataColumns.find(col => col.role === "y" && col.unit && col.unit !== "none") || {}).unit || "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            // Annotation and Title typography can be added here if needed by other elements
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        },
        barPrimary: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#1f77b4', // Default primary color
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || 'transparent', // Default to transparent if not specified
        // No images used in this chart, so image token definitions are omitted.
    };

    // In-memory text measurement helper (not strictly needed for this refactored version as dynamic sizing was removed)
    // function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
    //     const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    //     const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    //     tempText.setAttribute('font-family', fontFamily);
    //     tempText.setAttribute('font-size', fontSize);
    //     tempText.setAttribute('font-weight', fontWeight);
    //     tempText.textContent = text;
    //     tempSvg.appendChild(tempText);
    //     // No DOM append/remove needed for getBBox if SVG is not in DOM.
    //     return tempText.getBBox().width;
    // }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 20, // Reduced top margin as no title
        right: 50, // Increased right for data labels
        bottom: 30, // Reduced bottom as X-axis labels are removed
        left: 100  // Adjusted for Y-axis labels, might need dynamic calculation if labels are very long
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataInput.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure value is numeric
    })).filter(d => d.category != null && !isNaN(d.value)); // Basic filtering for valid data

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerHeight])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 0]) // Handle empty or all-zero data
        .range([0, innerWidth])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    
    // Y-axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickSize(0).tickPadding(10));

    yAxisGroup.select(".domain").remove(); // Remove Y-axis line

    yAxisGroup.selectAll(".tick text")
        .attr("class", "label y-axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);
        // .attr("x", -10); // Default D3 behavior for axisLeft usually handles this. TickPadding is better.

    // X-axis (rendered invisibly as per original, only for scale reference if needed elsewhere)
    const xAxis = d3.axisBottom(xScale)
        .ticks(5) // Number of ticks suggestion
        .tickSize(0) // No visible tick marks
        .tickPadding(10);

    mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove()) // Remove X-axis line
        .selectAll("text")
        .remove(); // Remove X-axis labels

    // No gridlines in this chart

    // No legend in this chart

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar-mark")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar-mark")
        .attr("y", d => yScale(d.category))
        .attr("x", 0)
        .attr("width", d => xScale(d.value))
        .attr("height", yScale.bandwidth())
        .attr("fill", fillStyle.barPrimary);

    // Data labels
    const dataLabelElements = mainChartGroup.selectAll(".data-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label data-label value-label")
        .attr("x", d => xScale(d.value) + 5) // Position to the right of the bar
        .attr("y", d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr("dy", "0.35em") // Vertical centering
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "start")
        .text(d => `${d.value}${valueFieldUnit ? ` ${valueFieldUnit}` : ''}`);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Removed svg2roughjs logic and other complex visual effects.
    // No annotations or icons specified for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}