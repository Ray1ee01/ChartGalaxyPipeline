/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_0",
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
    const chartRawData = data.data.data;
    const variables = data.variables || {};
    const D3Typography = data.typography || {}; // Renamed to avoid conflict with fillStyle.typography
    const D3Colors = data.colors || {}; // Renamed to avoid conflict
    const images = data.images || {}; // Parsed as per requirement, though not used in this chart
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("field with role 'x'");
        if (!valueFieldName) missingFields.push("field with role 'y'");
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    const valueAxisUnit = dataColumns.find(col => col.role === "y" && col.unit && col.unit !== "none")?.unit || "";
    // categoryAxisUnit (from role "x") is not typically displayed directly, so not extracted here.

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            // Using prompt's specified defaults for font properties if not provided
            titleFontFamily: (D3Typography.title && D3Typography.title.font_family) ? D3Typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (D3Typography.title && D3Typography.title.font_size) ? D3Typography.title.font_size : '16px',
            titleFontWeight: (D3Typography.title && D3Typography.title.font_weight) ? D3Typography.title.font_weight : 'bold',
            labelFontFamily: (D3Typography.label && D3Typography.label.font_family) ? D3Typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (D3Typography.label && D3Typography.label.font_size) ? D3Typography.label.font_size : '12px',
            labelFontWeight: (D3Typography.label && D3Typography.label.font_weight) ? D3Typography.label.font_weight : 'normal',
            annotationFontFamily: (D3Typography.annotation && D3Typography.annotation.font_family) ? D3Typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (D3Typography.annotation && D3Typography.annotation.font_size) ? D3Typography.annotation.font_size : '10px',
            annotationFontWeight: (D3Typography.annotation && D3Typography.annotation.font_weight) ? D3Typography.annotation.font_weight : 'normal',
        },
        // Using prompt's specified defaults for colors if not provided
        barColor: (D3Colors.other && D3Colors.other.primary) ? D3Colors.other.primary : '#1f77b4',
        textColor: D3Colors.text_color || '#0f223b',
        chartBackground: D3Colors.background_color || '#FFFFFF',
    };

    // Helper: Format value with K, M, B suffixes using d3.format
    function formatValue(value) {
        if (value === 0) return "0";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace(/G/, "B"); // Giga to Billion
        } else if (Math.abs(value) >= 1000) { // Covers K and M
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value); // For smaller numbers or when no suffix is needed
    }
    
    // Helper: Estimate text width (defined as per III.2, not actively used by this chart's layout)
    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Per prompt: "MUST NOT be appended to the document DOM."
        // getBBox on unattached elements might be unreliable or return 0 in some browsers.
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements fails
            console.warn("estimateTextWidth: getBBox failed, possibly because the SVG was not in the DOM. Using crude fallback.", e);
            width = text.length * (parseFloat(fontSize) * 0.6); 
        }
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800; // Default width if not specified
    const containerHeight = variables.height || 600; // Default height if not specified

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root") // Standardized class for SVG root
        .style("background-color", fillStyle.chartBackground);
        // No viewBox, no "100%" width/height as per III.1

    // Block 4: Core Chart Dimensions & Layout Calculation
    const defaultMargins = { top: 20, right: 60, bottom: 20, left: 120 };
    const chartMargins = {
        top: variables.margin_top !== undefined ? variables.margin_top : (variables.margin?.top !== undefined ? variables.margin.top : defaultMargins.top),
        right: variables.margin_right !== undefined ? variables.margin_right : (variables.margin?.right !== undefined ? variables.margin.right : defaultMargins.right),
        bottom: variables.margin_bottom !== undefined ? variables.margin_bottom : (variables.margin?.bottom !== undefined ? variables.margin.bottom : defaultMargins.bottom),
        left: variables.margin_left !== undefined ? variables.margin_left : (variables.margin?.left !== undefined ? variables.margin.left : defaultMargins.left)
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated chart dimensions (innerWidth or innerHeight) are not positive. Check container size and margins.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Chart dimensions too small to render.</div>");
        return null;
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartRawData.map(d => ({
        category: String(d[categoryFieldName]), // Ensure category is a string
        value: +d[valueFieldName] || 0 // Ensure value is a number, default to 0 if parsing fails
    })).sort((a, b) => b.value - a.value); // Sort by value descending (largest bar at top)

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand() // For categories on the Y-axis
        .domain(processedData.map(d => d.category))
        .range([0, innerHeight])
        .padding(0.3);

    const maxValue = d3.max(processedData, d => d.value);
    const xScale = d3.scaleLinear() // For values on the X-axis
        .domain([0, maxValue > 0 ? maxValue : 1]) // Ensure domain max is at least 1 if all values are 0 or negative
        .range([0, innerWidth])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    
    // Y-axis (Categorical)
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis") // Standardized class
        .call(d3.axisLeft(yScale).tickSize(0).tickPadding(10)) // No tick lines, padding for labels
        .call(g => g.select(".domain").remove()); // Remove Y-axis domain line

    yAxisGroup.selectAll("text")
        .attr("class", "label") // Standardized class for axis text
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // X-axis (Numerical) - Metadata specifies "none", so no visual elements are rendered for the X-axis.
    // The xScale is still used for positioning bars and labels.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar-mark")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar-mark") // Standardized class: 'mark' for data element, 'bar-mark' for specificity
        .attr("y", d => yScale(d.category))
        .attr("x", 0)
        .attr("height", yScale.bandwidth())
        .attr("width", d => Math.max(0, xScale(d.value))) // Ensure width is not negative
        .attr("fill", fillStyle.barColor);

    // Data labels for bars
    const dataLabels = mainChartGroup.selectAll(".data-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label value data-label") // Standardized classes
        .attr("y", d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr("x", d => Math.max(0, xScale(d.value)) + 5) // Position to the right of the bar end
        .attr("dy", "0.35em") // Vertical centering
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "start") // Align text start to the x position
        .text(d => {
            const formattedVal = formatValue(d.value);
            return valueAxisUnit ? `${formattedVal} ${valueAxisUnit}` : formattedVal;
        });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations, icons, or complex interactions in this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}