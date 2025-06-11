/* REQUIREMENTS_BEGIN
{
  "chart_type": "Time Series Bar Chart",
  "chart_name": "time_series_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["temporal"], ["numerical"]],
  "required_fields_range": [[15, 50], [0, "inf"]],
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
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartRawData = data.data && data.data.data ? data.data.data : [];
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

    // Color defaults
    const defaultColors = {
        text_color: "#333333",
        other: { primary: "#D32F2F" },
        background_color: "#F0F0F0"
    };
    const inputColors = data.colors || {};
    const colors = {
        text_color: inputColors.text_color || defaultColors.text_color,
        other: { ...defaultColors.other, ...(inputColors.other || {}) },
        background_color: inputColors.background_color || defaultColors.background_color,
        field: inputColors.field || {},
        available_colors: inputColors.available_colors || []
    };
    
    // Images (not used in this chart, but parsed for consistency)
    // const images = data.images || {};

    // Clear the containerSelector
    d3.select(containerSelector).html("");

    // Critical Identifier Validation
    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");

    let missingFieldMessages = [];
    if (!xFieldCol) missingFieldMessages.push("Data column with role 'x'");
    if (!yFieldCol) missingFieldMessages.push("Data column with role 'y'");
    
    const xFieldName = xFieldCol ? xFieldCol.name : undefined;
    const yFieldName = yFieldCol ? yFieldCol.name : undefined;

    if (!xFieldName && xFieldCol) missingFieldMessages.push("Name for 'x' role column");
    if (!yFieldName && yFieldCol) missingFieldMessages.push("Name for 'y' role column");
    
    // Consolidate unique messages
    missingFieldMessages = Array.from(new Set(missingFieldMessages));

    if (missingFieldMessages.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFieldMessages.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        try {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .text(`Error: ${errorMsg}`);
        } catch (e) {
            // Fallback if d3 or containerSelector is problematic during error reporting
            console.error("Failed to write error to containerSelector:", e);
        }
        return null;
    }
    
    const xFieldUnit = xFieldCol && xFieldCol.unit !== "none" ? xFieldCol.unit : "";
    const yFieldUnit = yFieldCol && yFieldCol.unit !== "none" ? yFieldCol.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        barPrimary: colors.other.primary,
        textColor: colors.text_color,
        axisLineColor: colors.text_color, // Though domain line is removed, ticks might use this
        chartBackground: colors.background_color,
        typography: {
            labelFontFamily: typography.label.font_family,
            labelFontSize: typography.label.font_size,
            labelFontWeight: typography.label.font_weight,
            // Add other typography tokens (title, annotation) if used
        }
    };

    // Helper: Text width estimation (not used in this chart, but template for future)
    /*
    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        textElement.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        textElement.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        textElement.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox if not using a library.
        // For true in-memory, complex SVG attributes might be needed or a canvas context.
        // However, for simple cases, this might suffice or a library like `canvas-txt` could be used.
        // For this template, we'll assume a simplified approach if it were needed.
        // A robust implementation would require appending to DOM, measuring, then removing.
        // As per spec, it MUST NOT be appended to DOM. So, this is a placeholder.
        // return textElement.getComputedTextLength ? textElement.getComputedTextLength() : (text.length * (parseFloat(fontProps.fontSize) || 12) * 0.6); // Fallback
        return 0; // Placeholder as it's not used
    }
    */

    // Helper: Value Formatter
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800; // Default from original metadata's min_width
    const containerHeight = variables.height || 600; // Default from original metadata's min_height

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 40 };
    if (yFieldUnit) chartMargins.left += 10 * yFieldUnit.length; // Adjust left margin for y-axis unit

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartRawData.map((d, i) => ({
        time: new Date(d[xFieldName]),
        value: +d[yFieldName],
        order: i
    })).sort((a, b) => a.time - b.time);

    processedData.forEach((d, i) => { d.order = i; }); // Re-assign order after sorting

    // Block 6: Scale Definition & Configuration
    const numPoints = processedData.length;

    const xDomain = numPoints > 0 ? [0, numPoints - 1] : [0, 0];
    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerWidth]);

    const yDataMax = d3.max(processedData, d => d.value);
    const yDomain = [0, yDataMax === undefined || yDataMax === 0 ? 1 : yDataMax];
    const yScale = d3.scaleLinear().domain(yDomain).range([innerHeight, 0]).nice();

    const timeMin = d3.min(processedData, d => d.time);
    const timeMax = d3.max(processedData, d => d.time);
    const defaultTimeRange = [new Date(), new Date(Date.now() + 24*60*60*1000)];
    const timeDomain = timeMin && timeMax ? [timeMin, timeMax] : defaultTimeRange;
    // timeScale is primarily for formatting ticks, actual positioning is by index via xScale
    const timeScale = d3.scaleTime().domain(timeDomain).nice(); 

    const barBinWidth = numPoints > 0 ? Math.max(1, innerWidth / numPoints) : 0;
    const actualBarWidth = barBinWidth * 0.9;

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    
    // X-Axis
    const maxXTicks = 8;
    const xTickIndices = [];
    if (numPoints > 0) {
        const indexStep = Math.ceil(numPoints / maxXTicks);
        let currentIndex = 0;
        const endIndex = numPoints - 1;
        xTickIndices.push(currentIndex);
        while (currentIndex + indexStep < endIndex) {
            currentIndex += indexStep;
            xTickIndices.push(currentIndex);
        }
        if (xTickIndices[xTickIndices.length - 1] < endIndex && endIndex !== 0) {
             xTickIndices.push(endIndex);
        } else if (numPoints === 1 && xTickIndices.length === 0) {
            xTickIndices.push(0);
        }
    }
    
    const xAxis = d3.axisBottom(xScale)
        .tickValues(xTickIndices)
        .tickFormat(i => {
            if (numPoints === 0 || !processedData[i]) return "";
            const date = processedData[i].time;
            return d3.timeFormat('%Y')(date) + (xFieldUnit ? ` ${xFieldUnit}` : '');
        })
        .tickSize(0)
        .tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("text-anchor", "middle")
        .style("fill", fillStyle.textColor);
    
    xAxisGroup.select(".domain").remove();

    // Y-Axis
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => formatValue(d) + (yFieldUnit ? ` ${yFieldUnit}` : ''))
        .tickSize(0)
        .tickPadding(10);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    yAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("text-anchor", "end")
        .style("fill", fillStyle.textColor);
        // .attr("dx", "-0.5em"); // Original had this, but tickPadding is often better

    yAxisGroup.select(".domain").remove();

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar") // Standardized class
        .attr("x", d => xScale(d.order) - barBinWidth / 2) // Preserving original centering logic
        .attr("y", d => yScale(d.value))
        .attr("width", actualBarWidth)
        .attr("height", d => innerHeight - yScale(d.value))
        .attr("fill", fillStyle.barPrimary);

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations or icons in this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}