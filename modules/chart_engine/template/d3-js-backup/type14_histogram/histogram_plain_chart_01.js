/* REQUIREMENTS_BEGIN
{
  "chart_type": "Histogram",
  "chart_name": "histogram_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["temporal"], ["numerical"]],
  "required_fields_range": [[15, 50], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "none",
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

    const xCol = dataColumns.find(col => col.role === "x");
    const yCol = dataColumns.find(col => col.role === "y");

    if (!xCol || !yCol) {
        const missingFields = [];
        if (!xCol) missingFields.push("x role");
        if (!yCol) missingFields.push("y role");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')} in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xField = xCol.name;
    const yField = yCol.name;
    const xUnit = xCol.unit !== "none" ? xCol.unit : "";
    const yUnit = yCol.unit !== "none" ? yCol.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            // No title or annotation used in this specific chart's rendering logic
        },
        barPrimary: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#1f77b4',
        textColor: colorsInput.text_color || '#333333',
        axisLineColor: (colorsInput.other && colorsInput.other.secondary) ? colorsInput.other.secondary : '#CCCCCC', // For potential future use, though domain lines are removed
        chartBackground: colorsInput.background_color || '#FFFFFF'
    };

    // In-memory text measurement utility (as per directive III.2)
    // Not actively used in this chart's layout, but defined as required.
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const tempText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tempText.setAttribute("font-family", fontProps.font_family || 'Arial');
        tempText.setAttribute("font-size", fontProps.font_size || '12px');
        if (fontProps.font_weight) {
            tempText.setAttribute("font-weight", fontProps.font_weight);
        }
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        try {
            // This may return 0 or throw error in some environments (e.g. JSDOM) if SVG not in DOM
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback: very rough estimate
            const fontSizePx = parseFloat(fontProps.font_size || '12px');
            return (text || "").length * fontSizePx * 0.6;
        }
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
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
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 20, // Reduced top margin as no main title
        right: 30,
        bottom: 50, // Adjusted for x-axis labels
        left: 60  // Adjusted for y-axis labels
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    if (!chartDataInput || chartDataInput.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No data available to display.");
        return svgRoot.node();
    }
    
    const processedData = chartDataInput.map((d, i) => ({
        time: new Date(d[xField]),
        value: +d[yField],
        originalIndex: i // Keep original index if needed, though order is by time
    })).sort((a, b) => a.time - b.time)
       .map((d, i) => ({ ...d, order: i })); // Add sequential order after sorting

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.order))
        .range([0, innerWidth])
        .padding(0.1); // 10% padding between bars

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 10]) // Ensure domain is at least 0-10 if max is 0 or data is empty
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    
    // X-axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    const maxTicks = Math.min(10, Math.floor(innerWidth / 70)); // Max 10 ticks, or one every 70px
    const dataLength = processedData.length;
    let tickValuesX = [];

    if (dataLength > 0) {
        if (dataLength <= maxTicks) {
            tickValuesX = processedData.map(d => d.order);
        } else {
            const step = Math.ceil(dataLength / maxTicks);
            for (let i = 0; i < dataLength; i += step) {
                tickValuesX.push(processedData[i].order);
            }
            // Ensure the last tick is included if not covered by step
            if (tickValuesX[tickValuesX.length - 1] !== processedData[dataLength - 1].order && dataLength > 1) {
                 if (!tickValuesX.includes(processedData[dataLength - 1].order)) {
                    tickValuesX.push(processedData[dataLength - 1].order);
                 }
            }
        }
    }
    
    const xAxis = d3.axisBottom(xScale)
        .tickValues(tickValuesX)
        .tickFormat(orderIndex => {
            const datum = processedData.find(d => d.order === orderIndex);
            return datum ? d3.timeFormat('%Y')(datum.time) : ''; // Format as Year
        })
        .tickSize(0)
        .tickPadding(10);

    xAxisGroup.call(xAxis)
        .selectAll(".domain").remove(); // Remove X-axis line

    xAxisGroup.selectAll("text.tick-label, text") // D3 v5+ uses 'text', older might use .tick-label
        .attr("class", "label text") // Standardized class
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("text-anchor", "middle")
        .style("fill", fillStyle.textColor);

    // Y-axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    const yAxis = d3.axisLeft(yScale)
        .ticks(Math.max(2, Math.floor(innerHeight / 40))) // Responsive number of ticks
        .tickFormat(d => formatValue(d) + (yUnit ? ` ${yUnit}` : ''))
        .tickSize(0)
        .tickPadding(10);

    yAxisGroup.call(yAxis)
        .selectAll(".domain").remove(); // Remove Y-axis line

    yAxisGroup.selectAll("text.tick-label, text")
        .attr("class", "label text") // Standardized class
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("text-anchor", "end")
        .style("fill", fillStyle.textColor);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar-mark")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark value bar-mark") // Standardized class
        .attr("x", d => xScale(d.order))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d.value))
        .attr("fill", fillStyle.barPrimary);

    // No data labels on bars as per original and simplification.

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // None for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}