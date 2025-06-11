/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_4",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    d3.select(containerSelector).html(""); // Clear the container

    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const config = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Assuming light theme if not specified
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const categoryFieldCol = dataColumns.find(col => col.role === "x");
    const valueFieldCol = dataColumns.find(col => col.role === "y");

    const categoryFieldName = categoryFieldCol ? categoryFieldCol.name : undefined;
    const valueFieldName = valueFieldCol ? valueFieldCol.name : undefined;

    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: categoryFieldName or valueFieldName derived from dataColumns is undefined. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration (category or value field) is missing.</div>");
        return null;
    }

    const categoryFieldUnit = categoryFieldCol && categoryFieldCol.unit !== "none" ? categoryFieldCol.unit : "";
    const valueFieldUnit = valueFieldCol && valueFieldCol.unit !== "none" ? valueFieldCol.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        barPrimaryColor: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : "#1f77b4",
        textColor: colorsInput.text_color || "#0f223b",
        chartBackground: colorsInput.background_color || "#FFFFFF", // Not directly used on SVG background
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : "Arial, sans-serif",
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : "12px",
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : "normal",
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : "Arial, sans-serif",
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : "10px",
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : "normal",
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox should work on unattached SVG elements in modern browsers
        return tempText.getBBox().width;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
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
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Apply background to SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const iconWidth = 20;
    const iconHeight = 15;
    const iconToTextPadding = 5;
    const textToBarPadding = 10; // Padding between end of category text and start of bar area
    const valueLabelPadding = 5; // Padding between end of bar and start of value label

    let maxCategoryContentWidth = 0;
    const uniqueCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];

    uniqueCategories.forEach(cat => {
        const categoryText = cat + categoryFieldUnit;
        let currentItemWidth = estimateTextWidth(categoryText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (imagesInput.field && imagesInput.field[cat]) {
            currentItemWidth += iconWidth + iconToTextPadding;
        }
        maxCategoryContentWidth = Math.max(maxCategoryContentWidth, currentItemWidth);
    });

    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const valueText = formatValue(d[valueFieldName]) + valueFieldUnit;
        maxValueLabelWidth = Math.max(maxValueLabelWidth, estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight));
    });

    const chartMargins = {
        top: 20,
        right: maxValueLabelWidth + valueLabelPadding + 10, // Ensure space for longest value label + padding
        bottom: 20,
        left: maxCategoryContentWidth + textToBarPadding + 10 // Ensure space for longest category content + padding
    };
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Cannot render chart.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Chart dimensions are too small for content.</div>");
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    const sortedDataArray = [...chartDataArray].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const sortedCategoryNames = sortedDataArray.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedCategoryNames)
        .range([0, innerHeight])
        .padding(0.2); // Fixed padding

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedDataArray, d => +d[valueFieldName]) * 1.05 || 1]) // Add 5% margin, ensure domain > 0
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes or gridlines for this chart type as per requirements.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const barItems = mainChartGroup.selectAll(".bar-item")
        .data(sortedDataArray)
        .join("g")
        .attr("class", "bar-item")
        .attr("transform", d => `translate(0, ${yScale(d[categoryFieldName])})`);

    barItems.append("rect")
        .attr("class", "mark bar")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", d => xScale(+d[valueFieldName]))
        .attr("height", yScale.bandwidth())
        .attr("fill", fillStyle.barPrimaryColor);

    // Category labels and icons
    barItems.each(function(d) {
        const g = d3.select(this);
        const categoryName = d[categoryFieldName];
        const categoryLabelText = categoryName + categoryFieldUnit;
        const textWidth = estimateTextWidth(categoryLabelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        const yPos = yScale.bandwidth() / 2;

        g.append("text")
            .attr("class", "label category-label")
            .attr("x", -textToBarPadding)
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryLabelText);

        if (imagesInput.field && imagesInput.field[categoryName]) {
            g.append("image")
                .attr("class", "icon category-icon")
                .attr("xlink:href", imagesInput.field[categoryName])
                .attr("x", -textToBarPadding - textWidth - iconToTextPadding - iconWidth)
                .attr("y", yPos - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });
    
    // Value labels
    barItems.append("text")
        .attr("class", "label value-label")
        .attr("x", d => xScale(+d[valueFieldName]) + valueLabelPadding)
        .attr("y", yScale.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => formatValue(d[valueFieldName]) + valueFieldUnit);

    // Block 9: Optional Enhancements & Post-Processing
    // Removed hover effects and alternating backgrounds for simplification.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}