/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_plain_chart_04",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 800,
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Or data.colors_dark if a theme mechanism were in place
    const images = data.images || {}; // Though not used in this chart
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);

    const categoryFieldName = xFieldDef ? xFieldDef.name : undefined;
    const valueFieldName = yFieldDef ? yFieldDef.name : undefined;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push(`field with role '${xFieldRole}'`);
        if (!valueFieldName) missingFields.push(`field with role '${yFieldRole}'`);
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    const yFieldUnit = (yFieldDef && yFieldDef.unit !== "none") ? yFieldDef.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            // Add title/annotation if used, e.g.:
            // titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            // titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            // titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
        },
        textColor: colors.text_color || '#0f223b',
        chartBackground: colors.background_color || '#FFFFFF', // Default to white
        barOtherColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4', // Default D3 category blue
    };
    fillStyle.barFirstColor = (colors.other && colors.other.primary) ? d3.rgb(colors.other.primary).darker(0.7).toString() : d3.rgb(fillStyle.barOtherColor).darker(0.7).toString();
    
    // In-memory text measurement utility
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        svg.appendChild(textNode);
        // Note: Appending to body and then removing is more reliable for getBBox, but prompt says not to append to DOM.
        // For simple cases, this might suffice. If not, a temporary off-screen append/remove is needed.
        // However, the prompt strictly says "MUST NOT be appended to the document DOM".
        // A common workaround is to append to an in-memory SVG, then use getComputedTextLength or approximate.
        // For getBBox, it often needs to be in the DOM. Let's assume getBBox on an unattached element works sufficiently for this context or use getComputedTextLength.
        // Using getComputedTextLength as it's generally more reliable for unattached elements.
        try {
            return textNode.getComputedTextLength();
        } catch(e) {
            // Fallback for environments where getComputedTextLength might fail without DOM.
            // This is a rough approximation.
            return (text ? text.length : 0) * (parseFloat(fontSize) * 0.6);
        }
    }

    // Value formatting utility
    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
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
        top: 50,
        right: 30,
        bottom: 80, // Increased bottom margin for potentially rotated labels
        left: 40   // Adjusted left margin for Y-axis labels
    };
    // Adjust left margin based on potential max Y-axis label width if needed, for now fixed.
    // Example: Estimate max Y-axis label width and adjust chartMargins.left
    // This part is simplified; a more robust calculation would involve rendering ticks and measuring.
    const yAxisApproxMaxLabel = formatValue(d3.max(chartData, d => +d[valueFieldName]) || 1000) + (yFieldUnit ? ` ${yFieldUnit}` : '');
    const yAxisLabelApproxWidth = estimateTextWidth(yAxisApproxMaxLabel, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
    chartMargins.left = Math.max(chartMargins.left, yAxisLabelApproxWidth + 20);


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartData.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure value is numeric
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

    const colorScale = (_, i) => {
        return i === 0 ? fillStyle.barFirstColor : fillStyle.barOtherColor;
    };
    
    // Calculate if X-axis labels need rotation
    let rotateXLabels = false;
    if (xScale.bandwidth() > 0) { // Check if bandwidth is positive to avoid division by zero or NaN issues
        const maxAllowedLabelWidth = xScale.bandwidth(); // Use full bandwidth
        for (const item of processedData) {
            const labelText = String(item.category);
            const estimatedWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            if (estimatedWidth > maxAllowedLabelWidth) {
                rotateXLabels = true;
                break;
            }
        }
    }
    if (processedData.length * parseFloat(fillStyle.typography.labelFontSize) * 1.5 > innerWidth && processedData.length > 5) { // Heuristic for many items
        rotateXLabels = true;
    }


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0));

    xAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", rotateXLabels ? "end" : "middle")
        .attr("transform", rotateXLabels ? "rotate(-45)" : "rotate(0)");
    
    xAxisGroup.select(".domain").remove(); // Remove X-axis line if desired, or style it

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale)
            .ticks(5) // Suggested number of ticks
            .tickFormat(d => formatValue(d) + (yFieldUnit ? ` ${yFieldUnit}` : ''))
            .tickSize(0)
            .tickPadding(10)
        );

    yAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    yAxisGroup.select(".domain").remove(); // Remove Y-axis line

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar-path-mark") // Use a more specific class if "mark" is too generic
        .data(processedData)
        .enter()
        .append("path")
        .attr("class", "mark bar-path-mark") // Standardized class
        .attr("d", d => {
            const x = xScale(d.category);
            const y = yScale(d.value);
            const barWidth = xScale.bandwidth();
            const barHeight = innerHeight - yScale(d.value); // Height of the bar
            const midX = x + barWidth / 2;

            // Ensure barHeight is non-negative; if value is 0, y is innerHeight, so barHeight is 0.
            if (barHeight <= 0) { // Handle zero or negative values gracefully by drawing a line or nothing
                 return `M ${x} ${innerHeight} L ${x + barWidth} ${innerHeight} Z`; // Flat line at baseline
            }
            
            // Original custom path for the bar shape
            return `M ${x} ${innerHeight}
                    L ${x + barWidth} ${innerHeight}
                    C ${x + barWidth * 0.55} ${innerHeight}, ${midX + barWidth * 0.05} ${y + barHeight * 0.5}, ${midX} ${y}
                    C ${midX - barWidth * 0.05} ${y + barHeight * 0.5}, ${x + barWidth * 0.45} ${innerHeight}, ${x} ${innerHeight}
                    Z`;
        })
        .attr("fill", (d, i) => colorScale(d, i));

    const dataLabels = mainChartGroup.selectAll(".data-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label data-label") // Standardized class
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5) // Position 5px above the bar's top point
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => (d.value > 0 || processedData.length === 1) ? (formatValue(d.value) + (yFieldUnit ? ` ${yFieldUnit}` : '')) : "") // Show label if value > 0 or if it's the only data point
        .style("opacity", d => (d.value > 0 || processedData.length === 1) ? 1 : 0); // Hide label for zero-value bars unless it's the only one

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations or icons in this specific chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}