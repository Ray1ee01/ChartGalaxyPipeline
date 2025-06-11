/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_08_2",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "text_color", "background_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme preference if both exist, or just one
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");

    if (!xFieldCol || !yFieldCol) {
        const missing = [];
        if (!xFieldCol) missing.push("x field");
        if (!yFieldCol) missing.push("y field");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = xFieldCol.name;
    const valueFieldName = yFieldCol.name;
    const yFieldUnit = (yFieldCol.unit && yFieldCol.unit !== "none") ? ` ${yFieldCol.unit}` : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF', // Not directly used on SVG, container responsibility
        axisLineColor: rawColors.text_color || '#CCCCCC', // For minimal axis if lines were shown
    };

    fillStyle.barColorProvider = (category, index) => {
        if (rawColors.field && rawColors.field[category]) {
            return rawColors.field[category];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[index % rawColors.available_colors.length];
        }
        if (rawColors.other && rawColors.other.primary) {
            return rawColors.other.primary;
        }
        return '#4682B4'; // Default bar color
    };

    fillStyle.iconUrlProvider = (category) => {
        if (rawImages.field && rawImages.field[category]) {
            return rawImages.field[category];
        }
        if (rawImages.other && rawImages.other.primary) {
            return rawImages.other.primary;
        }
        return null;
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const tempText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        if (fontProps.font_family) tempText.setAttribute("font-family", fontProps.font_family);
        if (fontProps.font_size) tempText.setAttribute("font-size", fontProps.font_size);
        if (fontProps.font_weight) tempText.setAttribute("font-weight", fontProps.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        const width = tempText.getBBox().width;
        return width;
    }
    
    const ICON_SIZE = 20;
    const ICON_MARGIN_TOP = 5;
    const CATEGORY_LABEL_MARGIN_TOP = 10;
    const VALUE_LABEL_MARGIN_BOTTOM = 5;


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Optional: set SVG background

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 40, // Space for top value labels
        right: 30,
        bottom: 80, // Space for category labels and icons
        left: 60  // Space for Y-axis labels
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
        .domain([0, d3.max(processedData, d => d.value) || 10]) // Ensure domain is valid if max is 0
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickFormat("")) // No ticks, no default text
        .call(g => g.select(".domain").remove());

    // Custom category labels and icons (since axis text is removed)
    processedData.forEach(d => {
        const xPos = xScale(d.category) + xScale.bandwidth() / 2;
        
        // Category Label
        mainChartGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", xPos)
            .attr("y", innerHeight + CATEGORY_LABEL_MARGIN_TOP)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d.category);

        // Icon
        const iconUrl = fillStyle.iconUrlProvider(d.category);
        if (iconUrl) {
            const labelHeight = estimateTextWidth("M", { font_size: fillStyle.typography.labelFontSize }); // Approx height
            mainChartGroup.append("image")
                .attr("class", "icon category-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", xPos - ICON_SIZE / 2)
                .attr("y", innerHeight + CATEGORY_LABEL_MARGIN_TOP + labelHeight + ICON_MARGIN_TOP)
                .attr("width", ICON_SIZE)
                .attr("height", ICON_SIZE)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });


    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(val => `${val}${yFieldUnit}`).tickSize(0).tickPadding(10))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").remove());

    yAxisGroup.selectAll("text")
        .attr("class", "label y-axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "mark bar-item-group") // Changed class for clarity
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    barElements.append("rect")
        .attr("class", "mark bar")
        .attr("x", 0)
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d.value))
        .attr("fill", (d, i) => fillStyle.barColorProvider(d.category, i));

    // Value labels on top of bars
    barElements.append("text")
        .attr("class", "label value-label")
        .attr("x", xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - VALUE_LABEL_MARGIN_BOTTOM)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "alphabetic") // To place it just above the bar
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", "bold") // Make value labels bold
        .style("fill", fillStyle.textColor)
        .text(d => `${d.value}${yFieldUnit}`);

    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements like gradients, shadows, or detailed interactions in this refactor.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}