/* REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_chart_08",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["none"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || {};
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const valueColumn = dataColumns.find(col => col.role === "y");
    const valueUnit = (valueColumn?.unit && valueColumn.unit !== "none") ? valueColumn.unit : "";

    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: categoryFieldName or valueFieldName derived from dataColumns is undefined.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration (x or y field) is missing. Cannot render.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" },
        centerValue: { font_family: "Arial, sans-serif", font_size: "48px", font_weight: "bold" }
    };

    fillStyle.typography.titleFontFamily = (inputTypography.title && inputTypography.title.font_family) || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = (inputTypography.title && inputTypography.title.font_size) || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = (inputTypography.title && inputTypography.title.font_weight) || defaultTypography.title.font_weight;

    fillStyle.typography.labelFontFamily = (inputTypography.label && inputTypography.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (inputTypography.label && inputTypography.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (inputTypography.label && inputTypography.label.font_weight) || defaultTypography.label.font_weight;

    fillStyle.typography.annotationFontFamily = (inputTypography.annotation && inputTypography.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (inputTypography.annotation && inputTypography.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (inputTypography.annotation && inputTypography.annotation.font_weight) || defaultTypography.annotation.font_weight;

    fillStyle.typography.centerValueFontFamily = (inputTypography.centerValue && inputTypography.centerValue.font_family) || defaultTypography.centerValue.font_family;
    fillStyle.typography.centerValueFontSize = (inputTypography.centerValue && inputTypography.centerValue.font_size) || defaultTypography.centerValue.font_size;
    fillStyle.typography.centerValueFontWeight = (inputTypography.centerValue && inputTypography.centerValue.font_weight) || defaultTypography.centerValue.font_weight;

    fillStyle.colors.textColor = inputColors.text_color || "#333333";
    fillStyle.colors.chartBackground = inputColors.background_color || "#FFFFFF";
    fillStyle.colors.sliceStrokeColor = "#FFFFFF"; // Default white stroke for slices
    fillStyle.colors.sliceLabelColor = "#FFFFFF"; // Default white for labels on slices
    fillStyle.colors.centerCircleFill = (inputColors.other && inputColors.other.center_fill) || "#FFFFFF";
    fillStyle.colors.centerCircleStroke = (inputColors.other && inputColors.other.center_stroke) || "#DDDDDD";
    
    // Helper: In-memory text measurement (boilerplate, not actively used for complex layout in this chart)
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // Note: Appending to body and then removing is more reliable for getBBox, but forbidden.
        // This in-memory approach might have limitations with getBBox if not rendered.
        // For simple cases or if a library handles it internally, this might be okay.
        // A more robust in-memory way:
        document.body.appendChild(svg); // Temporarily append
        const width = textEl.getBBox().width;
        document.body.removeChild(svg); // Clean up
        return width;
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.colors.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Minimal margins as donut is self-contained
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const radius = Math.min(chartWidth, chartHeight) / 2;
    const innerRadiusRatio = variables.innerRadiusRatio || 0.5; // Configurable inner radius ratio
    const innerRadius = radius * innerRadiusRatio;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.filter(d => d[valueFieldName] != null && !isNaN(parseFloat(d[valueFieldName])) && parseFloat(d[valueFieldName]) >= 0);
    
    if (chartDataArray.length === 0) {
        console.error("No valid data points after filtering.");
        d3.select(containerSelector).html("<div style='color:orange;'>No valid data to display.</div>");
        return null;
    }

    const totalValue = d3.sum(chartDataArray, d => +d[valueFieldName]);

    if (totalValue <= 0 && chartDataArray.length > 0) {
        console.error("Sum of values is not positive.");
        d3.select(containerSelector).html("<div style='color:orange;'>Sum of values must be positive to render a donut chart.</div>");
        return null;
    }
     if (totalValue <= 0) { // Handles both no data and all zero values if previous check missed it
        console.error("No positive data to display or sum of values is zero.");
        d3.select(containerSelector).html("<div style='color:orange;'>No positive data to display.</div>");
        return null;
    }


    const processedData = chartDataArray.sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);

    // Block 6: Scale Definition & Configuration
    const colorScale = d3.scaleOrdinal();
    const uniqueCategories = Array.from(new Set(processedData.map(d => d[categoryFieldName])));
    
    const colorValues = uniqueCategories.map((cat, i) => {
        if (inputColors.field && inputColors.field[cat]) {
            return inputColors.field[cat];
        }
        if (inputColors.available_colors && inputColors.available_colors.length > 0) {
            return inputColors.available_colors[i % inputColors.available_colors.length];
        }
        const defaultScheme = d3.schemeCategory10;
        return defaultScheme[i % defaultScheme.length];
    });
    colorScale.domain(uniqueCategories).range(colorValues);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this Donut Chart (no axes, gridlines, or separate legend).

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const pieGenerator = d3.pie()
        .value(d => +d[valueFieldName])
        .sort(null) // Data is pre-sorted
        .padAngle(variables.padAngle === undefined ? 0.02 : variables.padAngle); // Default 0.02, original was 0.05

    const arcGenerator = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(radius)
        .cornerRadius(variables.cornerRadius === undefined ? 4 : variables.cornerRadius); // Default 4

    const arcsGroup = mainChartGroup.selectAll(".arc-group")
        .data(pieGenerator(processedData))
        .enter()
        .append("g")
        .attr("class", "arc-group mark");

    arcsGroup.append("path")
        .attr("d", arcGenerator)
        .attr("fill", d => colorScale(d.data[categoryFieldName]))
        .attr("stroke", fillStyle.colors.sliceStrokeColor)
        .attr("stroke-width", variables.sliceStrokeWidth === undefined ? 2 : variables.sliceStrokeWidth) // Default 2px, original was 8px
        .attr("class", "mark-path");

    // Labels on slices
    const sliceLabelArcGenerator = d3.arc()
        .innerRadius(innerRadius + (radius - innerRadius) * 0.5) // Position labels in the middle of the slice thickness
        .outerRadius(innerRadius + (radius - innerRadius) * 0.5);

    arcsGroup.append("text")
        .attr("transform", d => `translate(${sliceLabelArcGenerator.centroid(d)})`)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.colors.sliceLabelColor)
        .attr("class", "label data-label")
        .each(function(d) {
            const angleRange = d.endAngle - d.startAngle;
            if (angleRange < (variables.minAngleForLabel || 0.35)) { // Hide label if slice is too small
                d3.select(this).style("opacity", 0);
                return;
            }
            
            const category = d.data[categoryFieldName];
            const percentage = (d.data[valueFieldName] / totalValue * 100);
            const percentageText = (percentage < 1 && percentage > 0) ? "<1%" : percentage.toFixed(0) + "%";


            const textElement = d3.select(this);

            textElement.append("tspan")
                .attr("x", 0)
                .attr("dy", "-0.6em")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .text(category)
                .attr("class", "text category-text");
            
            textElement.append("tspan")
                .attr("x", 0)
                .attr("dy", "1.2em")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(percentageText)
                .attr("class", "text percentage-text");
        });

    // Center text (Total)
    if (variables.showCenterTotal !== false) { // Default to true
        mainChartGroup.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", innerRadius * (variables.centerCircleScale || 0.9)) // Slightly smaller than innerRadius
            .attr("fill", fillStyle.colors.centerCircleFill)
            .attr("stroke", fillStyle.colors.centerCircleStroke)
            .attr("stroke-width", 1)
            .attr("class", "other center-circle-bg");

        const centerLabelGroup = mainChartGroup.append("text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.colors.textColor)
            .attr("class", "label center-label");

        centerLabelGroup.append("tspan")
            .attr("x", 0)
            .attr("dy", "-0.7em") // Adjusted for two lines
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", fillStyle.typography.titleFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .text(variables.centerTotalLabel || "Total")
            .attr("class", "text total-text-heading");

        centerLabelGroup.append("tspan")
            .attr("x", 0)
            .attr("dy", "1.0em") // Adjusted for two lines
            .style("font-family", fillStyle.typography.centerValueFontFamily)
            .style("font-size", fillStyle.typography.centerValueFontSize)
            .style("font-weight", fillStyle.typography.centerValueFontWeight)
            .text(`${d3.format(variables.centerTotalFormat || ",.0f")(totalValue)}${valueUnit}`)
            .attr("class", "text total-text-value");
    }

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - not in this chart's scope based on original)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}