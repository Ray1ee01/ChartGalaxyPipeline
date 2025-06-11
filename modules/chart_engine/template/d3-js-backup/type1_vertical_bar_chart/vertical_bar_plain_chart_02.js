/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data?.columns || [];
    let chartDataArray = data.data?.data || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xCol = dataColumns.find(col => col.role === "x");
    const yCol = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xCol?.name;
    const valueFieldName = yCol?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role (categoryFieldName)");
        if (!valueFieldName) missingFields.push("y role (valueFieldName)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const yUnit = (yCol?.unit && yCol.unit !== "none") ? yCol.unit : "";
    // const xUnit = (xCol?.unit && xCol.unit !== "none") ? xCol.unit : ""; // xUnit not used in output

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const inputLabelTypography = typographyInput.label || {};
    fillStyle.typography.labelFontFamily = inputLabelTypography.font_family || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = inputLabelTypography.font_size || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = inputLabelTypography.font_weight || defaultTypography.label.font_weight;

    // Colors
    fillStyle.barColor = colorsInput.other?.primary || '#1f77b4'; // Default to a common categorical color
    fillStyle.textColor = colorsInput.text_color || '#333333';
    fillStyle.axisDomainColor = colorsInput.text_color || '#333333'; // Axis line color, defaults to text color
    // fillStyle.chartBackground = colorsInput.background_color || 'transparent'; // Not directly applied to SVG background

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: getBBox on a non-DOM-attached SVG might be inconsistent across browsers.
        // The prompt implies this method should be used and work.
        return tempText.getBBox().width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        }
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 30, // Reduced top margin as no title
        right: 30,
        bottom: 80, // Keep space for potentially rotated labels
        left: 40
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataArray.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName]
    }));

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 0]) // Ensure domain starts at 0, handle empty/all-zero data
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    let minXLabelRatio = 1.0;
    const maxXLabelWidth = xScale.bandwidth() * 1.03; // Allow slight overflow before rotation

    processedData.forEach(d => {
        const xLabelText = String(d.category);
        const currentWidth = estimateTextWidth(
            xLabelText,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontSize,
            fillStyle.typography.labelFontWeight
        );
        if (currentWidth > maxXLabelWidth) {
            minXLabelRatio = Math.min(minXLabelRatio, maxXLabelWidth / currentWidth);
        }
    });

    const xAxis = d3.axisBottom(xScale)
        .tickSize(0)
        .tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("text")
        .attr("class", "label") // As per VII, though "label" is more for data labels. Axis tick labels are "text".
                                // Let's use "text" for axis tick labels for clarity.
        .classed("label", false) // remove if added by call(xAxis)
        .classed("text", true)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", minXLabelRatio < 1.0 ? "end" : "middle")
        .attr("dx", minXLabelRatio < 1.0 ? "-0.8em" : "0em") // Adjust for rotation
        .attr("dy", minXLabelRatio < 1.0 ? "0.15em" : "0.71em") // Adjust for rotation / baseline
        .attr("transform", minXLabelRatio < 1.0 ? "rotate(-45)" : "rotate(0)");

    xAxisGroup.select(".domain")
        .style("stroke", fillStyle.axisDomainColor);
    
    // No Y-axis is rendered in this chart.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar_element_mark") // Use a more specific class to avoid conflict
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark") // Standardized class
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d.value))
        .attr("fill", fillStyle.barColor);

    const dataLabels = mainChartGroup.selectAll(".data_label_text") // Use a more specific class
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label") // Standardized class
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5) // Position above the bar
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => formatValue(d.value) + (yUnit ? ` ${yUnit}` : ''));

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations, icons, or complex interactions in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}