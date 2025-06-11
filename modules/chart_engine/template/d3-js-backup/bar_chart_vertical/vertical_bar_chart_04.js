/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_04",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "text_color", "background_color"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
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
    // This function renders a vertical bar chart.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Could be data.colors_dark for dark themes, handled by caller.
    // const imagesInput = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const valueFieldName = yFieldConfig ? yFieldConfig.name : undefined;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x field (category)");
        if (!valueFieldName) missingFields.push("y field (value)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; font-size: 14px;'>${errorMsg}</div>`);
        return null;
    }

    let categoryFieldUnit = xFieldConfig.unit && xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    let valueFieldUnit = yFieldConfig.unit && yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
        },
        textColor: colorsInput.text_color || '#0f223b',
        chartBackground: colorsInput.background_color || '#FFFFFF', // Not directly used on SVG, but available
        getBarColor: (d, index) => {
            if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                return colorsInput.available_colors[index % colorsInput.available_colors.length];
            }
            if (colorsInput.other && colorsInput.other.primary) {
                return colorsInput.other.primary;
            }
            return '#1f77b4'; // Default primary color
        }
    };

    function estimateTextWidth(text, fontSize, fontFamily, fontWeight) {
        const svgNamespace = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNamespace, 'svg');
        const textElement = document.createElementNS(svgNamespace, 'text');
        if (fontFamily) textElement.setAttribute('font-family', fontFamily);
        if (fontSize) textElement.setAttribute('font-size', fontSize);
        if (fontWeight) textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        let width = 0;
        try {
            const bbox = textElement.getBBox();
            width = bbox.width;
        } catch (e) {
            // Fallback for environments where getBBox on non-DOM elements is problematic
            const averageCharWidthMultiplier = 0.6; // Crude estimate
            width = text.length * (parseInt(fontSize, 10) || 12) * averageCharWidthMultiplier;
            if (width === 0 && text.length > 0) {
                 width = text.length * 7; // Assuming ~7px per char for a 12px font if parseInt failed
            }
        }
        return width;
    }

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
        .attr("class", "chart-root-svg"); // Added a class for the root SVG

    // Optional: Add a background rect if chartBackground is meant for the plot area
    // svgRoot.append("rect")
    //    .attr("width", containerWidth)
    //    .attr("height", containerHeight)
    //    .attr("fill", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 30, right: 30, bottom: 70, left: 60 };
    if (variables.dynamic_margins) { // Example of how variables could influence margins
        chartMargins.bottom = variables.dynamic_margins.bottom || 70;
        chartMargins.left = variables.dynamic_margins.left || 60;
    }
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure value is numeric
    }));

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(chartDataArray.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => d.value) || 0]) // Ensure domain max is at least 0
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10));

    xAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) { // Rotate labels if they are too long
            const labelText = String(d) + (categoryFieldUnit ? ` ${categoryFieldUnit}` : '');
            d3.select(this).text(labelText); // Set text with unit first
            const textWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontWeight);
            if (textWidth > xScale.bandwidth() * 1.1) { // 1.1 gives a little margin
                d3.select(this)
                    .style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-45)");
            } else {
                d3.select(this).style("text-anchor", "middle");
            }
        });
    
    xAxisGroup.select(".domain").style("stroke", fillStyle.textColor); // Make domain line visible and use text color

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => formatValue(d) + (valueFieldUnit ? ` ${valueFieldUnit}` : '')).tickSize(0).tickPadding(10));

    yAxisGroup.select(".domain").remove(); // Remove Y-axis line
    yAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);
    
    yAxisGroup.selectAll(".tick line").remove(); // Ensure no tick lines are drawn

    // Block 8: Main Data Visualization Rendering
    const barElements = mainChartGroup.selectAll(".bar")
        .data(chartDataArray)
        .enter()
        .append("rect")
        .attr("class", "mark bar")
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d.value))
        .attr("fill", (d, i) => fillStyle.getBarColor(d, i));

    // Data Labels on top of bars
    const dataLabels = mainChartGroup.selectAll(".data-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label data-label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5) // Position 5px above the bar
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily) // Using annotation for data labels
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => formatValue(d.value) + (valueFieldUnit ? ` ${valueFieldUnit}` : ''));

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}