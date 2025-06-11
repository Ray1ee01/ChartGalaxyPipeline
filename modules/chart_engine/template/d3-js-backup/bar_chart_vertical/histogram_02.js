/* REQUIREMENTS_BEGIN
{
  "chart_type": "Histogram",
  "chart_name": "histogram_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["temporal"], ["numerical"]],
  "required_fields_range": [[15, 50], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 600,
  "min_width": 800,
  "background": "dark",

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
    // This function renders a histogram-like bar chart based on time-series data.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || {}; // Using colors_dark as specified by original and metadata
    const imagesConfig = data.images || {}; // Though not used in this chart, adhere to structure
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");

    const xFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const yFieldName = yFieldConfig ? yFieldConfig.name : undefined;

    if (!xFieldName || !yFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push("x field (e.g., 'period')");
        if (!yFieldName) missingFields.push("y field (e.g., 'value')");
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMessage);
        return null;
    }

    const xFieldUnit = xFieldConfig && xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    const yFieldUnit = yFieldConfig && yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title && typographyConfig.title.font_family ? typographyConfig.title.font_family : 'Arial, sans-serif',
            titleFontSize: typographyConfig.title && typographyConfig.title.font_size ? typographyConfig.title.font_size : '18px',
            titleFontWeight: typographyConfig.title && typographyConfig.title.font_weight ? typographyConfig.title.font_weight : 'bold',
            labelFontFamily: typographyConfig.label && typographyConfig.label.font_family ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: typographyConfig.label && typographyConfig.label.font_size ? typographyConfig.label.font_size : '14px', // Original used 1.5x, now direct
            labelFontWeight: typographyConfig.label && typographyConfig.label.font_weight ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: typographyConfig.annotation && typographyConfig.annotation.font_family ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation && typographyConfig.annotation.font_size ? typographyConfig.annotation.font_size : '12px',
            annotationFontWeight: typographyConfig.annotation && typographyConfig.annotation.font_weight ? typographyConfig.annotation.font_weight : 'normal',
        },
        textColor: colorsConfig.text_color || "#FFFFFF", // Default for dark background
        primaryBarColor: colorsConfig.other && colorsConfig.other.primary ? colorsConfig.other.primary : "#D32F2F",
        secondaryColor: colorsConfig.other && colorsConfig.other.secondary ? colorsConfig.other.secondary : "#AAAAAA",
        chartBackground: colorsConfig.background_color || "#1E1E1E", // Default dark background
    };

    // Helper for text measurement (not strictly needed for this chart's current state, but good practice)
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.textContent = text;
        if (fontProps) {
            if (fontProps.font_family) tempText.style.fontFamily = fontProps.font_family;
            if (fontProps.font_size) tempText.style.fontSize = fontProps.font_size;
            if (fontProps.font_weight) tempText.style.fontWeight = fontProps.font_weight;
        }
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox if not using a library.
        // For this template, we assume direct measurement or a library would handle it.
        // For simplicity here, we'll just return an estimate or rely on D3's rendering.
        // A more robust version would append to DOM, measure, then remove.
        // document.body.appendChild(tempSvg);
        // const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg);
        // return width;
        return text ? text.length * (parseInt(fontProps.font_size) / 2) : 0; // Basic estimation
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
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
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 60 }; // Increased left margin for y-axis labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataArray.map((d, i) => ({
        time: new Date(d[xFieldName]),
        value: +d[yFieldName],
        originalIndex: i // Keep original index if needed, but sorting by time
    })).sort((a, b) => a.time - b.time)
       .map((d, i) => ({ ...d, order: i })); // Add 'order' after sorting

    if (processedData.length === 0) {
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

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleLinear()
        .domain([0, processedData.length > 1 ? processedData.length - 1 : 1]) // Handle single data point
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 1]) // Ensure domain is at least [0,1]
        .range([innerHeight, 0])
        .nice();

    const barStepWidth = processedData.length > 0 ? Math.max(1, innerWidth / processedData.length) : innerWidth;
    const actualBarWidth = barStepWidth * 0.9;

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    
    // X-axis
    const maxTicks = 8;
    const dataLength = processedData.length;
    const tickIndices = [];
    if (dataLength > 0) {
        const indexStep = Math.max(1, Math.ceil(dataLength / maxTicks));
        let currentIndex = 0;
        const endIndex = dataLength - 1;
        tickIndices.push(currentIndex);
        while (currentIndex + indexStep <= endIndex) {
            currentIndex += indexStep;
            tickIndices.push(currentIndex);
        }
        if (tickIndices[tickIndices.length - 1] < endIndex && dataLength > 1) {
             // Ensure last tick is included if it's not too close to the previous one
            if (endIndex - tickIndices[tickIndices.length - 1] >= indexStep / 2 || tickIndices.length === 1) {
                 tickIndices.push(endIndex);
            }
        }
        // If only one data point, ensure its index is in tickIndices
        if (dataLength === 1 && !tickIndices.includes(0)) {
            tickIndices.push(0);
        }
    }


    const xAxis = d3.axisBottom(xScale)
        .tickValues(tickIndices.filter(i => processedData[i])) // Ensure index exists
        .tickFormat(i => {
            const date = processedData[i] ? processedData[i].time : new Date();
            return d3.timeFormat('%Y')(date) + (xFieldUnit ? ` ${xFieldUnit}` : '');
        })
        .tickSize(0)
        .tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("text")
        .attr("class", "text label x-axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("text-anchor", "middle")
        .style("fill", fillStyle.textColor);

    xAxisGroup.select(".domain").remove();

    // Y-axis
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => formatValue(d) + (yFieldUnit ? ` ${yFieldUnit}` : ''))
        .tickSize(0)
        .tickPadding(10);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    yAxisGroup.selectAll("text")
        .attr("class", "text label y-axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("text-anchor", "end")
        .style("fill", fillStyle.textColor);

    yAxisGroup.select(".domain").remove();

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar-mark")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar-mark")
        .attr("x", d => xScale(d.order) - actualBarWidth / 2)
        .attr("y", d => yScale(d.value))
        .attr("width", Math.max(0, actualBarWidth)) // Ensure width is not negative
        .attr("height", d => Math.max(0, innerHeight - yScale(d.value))) // Ensure height is not negative
        .attr("fill", fillStyle.primaryBarColor);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}