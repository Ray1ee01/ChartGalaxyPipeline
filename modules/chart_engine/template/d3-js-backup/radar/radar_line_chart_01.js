/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radar Line Chart",
  "chart_name": "radar_line_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "subtle",
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
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    const imagesConfig = data.images || {}; // Not used in this chart, but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldConfig = dataColumns.find(col => col.role === 'x');
    const valueFieldConfig = dataColumns.find(col => col.role === 'y');

    if (!categoryFieldConfig || !valueFieldConfig) {
        const missing = [];
        if (!categoryFieldConfig) missing.push("category field (role 'x')");
        if (!valueFieldConfig) missing.push("value field (role 'y')");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'bold', // Category labels were bold
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px', // Tick labels & value labels
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        primaryColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#1f77b4',
        gridLineColor: (colorsConfig.other && colorsConfig.other.grid) ? colorsConfig.other.grid : '#CCCCCC', // Original was #bbb
        axisLabelColor: (colorsConfig.text_color) ? colorsConfig.text_color : '#333333',
        tickLabelColor: (colorsConfig.text_color) ? colorsConfig.text_color : '#666666',
        dataPointStrokeColor: colorsConfig.background_color || '#FFFFFF', // For contrast against point fill
        dataValueLabelColor: colorsConfig.background_color || '#FFFFFF', // Text on colored background
        chartBackground: colorsConfig.background_color || 'transparent',
        textColor: colorsConfig.text_color || '#0f223b',
    };
    fillStyle.dataValueLabelBackgroundColor = fillStyle.primaryColor; // Background for value labels

    function estimateTextWidth(text, fontSize, fontFamily, fontWeight = 'normal') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Document body temporarily needed for getBBox to work reliably in some browsers.
        document.body.appendChild(svg);
        const width = textElement.getBBox().width;
        document.body.removeChild(svg);
        return width;
    }

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
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: chartConfig.margins && chartConfig.margins.top !== undefined ? chartConfig.margins.top : 60, // Increased for labels
        right: chartConfig.margins && chartConfig.margins.right !== undefined ? chartConfig.margins.right : 60,
        bottom: chartConfig.margins && chartConfig.margins.bottom !== undefined ? chartConfig.margins.bottom : 60,
        left: chartConfig.margins && chartConfig.margins.left !== undefined ? chartConfig.margins.left : 60,
    };

    const chartInnerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartInnerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(chartInnerWidth, chartInnerHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    if (categories.length < 3) {
        const errorMsg = "Radar chart requires at least 3 categories.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    
    // Ensure data is sorted according to categories for line generation
    const processedChartData = categories.map(cat => {
        return chartDataArray.find(d => d[categoryFieldName] === cat) || {[categoryFieldName]: cat, [valueFieldName]: 0}; // Default to 0 if missing
    });


    // Block 6: Scale Definition & Configuration
    const angleSlice = (Math.PI * 2) / categories.length;
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, Math.PI * 2 - angleSlice]); // Ensures points are distinct

    const allValues = processedChartData.map(d => d[valueFieldName]);
    const minValue = Math.min(0, d3.min(allValues) || 0);
    const maxValue = d3.max(allValues) || 0;

    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue === 0 ? 1 : maxValue * 1.1]) // Ensure maxValue is not 0 for domain, give some headroom
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const gridLevels = 5;
    const ticks = radiusScale.ticks(gridLevels).filter(t => t >= 0); // Only positive ticks

    // Concentric Circles (Grid)
    mainChartGroup.selectAll(".grid-circle")
        .data(ticks)
        .enter().append("circle")
        .attr("class", "grid-line circle-grid")
        .attr("r", d => radiusScale(d))
        .style("fill", "none")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-width", 1)
        .style("stroke-dasharray", "3,3");

    // Tick Value Labels (on one axis, e.g., vertical)
    mainChartGroup.selectAll(".tick-label")
        .data(ticks.filter(d => d > 0)) // Don't label origin if 0
        .enter().append("text")
        .attr("class", "label tick-label")
        .attr("x", 5)
        .attr("y", d => -radiusScale(d))
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.tickLabelColor)
        .text(d => d.toString());

    // Radial Axis Lines (Spokes)
    const axes = mainChartGroup.selectAll(".axis")
        .data(categories)
        .enter().append("g")
        .attr("class", "axis radial-axis");

    axes.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", (d, i) => radiusScale(maxValue === 0 ? 1 : maxValue * 1.1) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y2", (d, i) => radiusScale(maxValue === 0 ? 1 : maxValue * 1.1) * Math.sin(angleScale(d) - Math.PI / 2))
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-width", 1);

    // Category Labels
    axes.append("text")
        .attr("class", "label category-label")
        .attr("text-anchor", (d) => {
            const angle = angleScale(d);
            if (Math.abs(angle) < 0.01 || Math.abs(angle - Math.PI) < 0.01) return "middle";
            return angle > Math.PI ? "end" : "start";
        })
        .attr("dy", "0.35em")
        .attr("x", (d, i) => radiusScale(maxValue === 0 ? 1 : maxValue * 1.1) * 1.1 * Math.cos(angleScale(d) - Math.PI / 2)) // Position beyond max radius
        .attr("y", (d, i) => radiusScale(maxValue === 0 ? 1 : maxValue * 1.1) * 1.1 * Math.sin(angleScale(d) - Math.PI / 2))
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.axisLabelColor)
        .text(d => d);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const radarLineGenerator = d3.lineRadial()
        .angle(d => angleScale(d[categoryFieldName]))
        .radius(d => radiusScale(d[valueFieldName]))
        .curve(d3.curveLinearClosed);
    
    // The original code used a custom point calculation for d3.line().
    // This is an equivalent using Cartesian coordinates after polar to Cartesian conversion.
    // The `angleScale(cat) - Math.PI / 2` rotates the radar to start at the top.
    const lineDataPoints = processedChartData.map(d => {
        const angle = angleScale(d[categoryFieldName]) - Math.PI / 2;
        const r = radiusScale(d[valueFieldName]);
        return [r * Math.cos(angle), r * Math.sin(angle)];
    });

    // Radar Area
    mainChartGroup.append("path")
        .datum(lineDataPoints)
        .attr("class", "mark radar-area")
        .attr("d", d3.line().curve(d3.curveLinearClosed)) // Use d3.line for [x,y] points
        .style("fill", fillStyle.primaryColor)
        .style("fill-opacity", 0.2);

    // Radar Line
    mainChartGroup.append("path")
        .datum(lineDataPoints)
        .attr("class", "mark radar-line")
        .attr("d", d3.line().curve(d3.curveLinearClosed))
        .style("fill", "none")
        .style("stroke", fillStyle.primaryColor)
        .style("stroke-width", 2) // Original was 6, can be configured
        .style("stroke-linejoin", "miter");


    // Data Points (Circles)
    mainChartGroup.selectAll(".radar-point")
        .data(processedChartData)
        .enter().append("circle")
        .attr("class", "mark data-point")
        .attr("r", 4) // Original was 6
        .attr("cx", d => radiusScale(d[valueFieldName]) * Math.cos(angleScale(d[categoryFieldName]) - Math.PI / 2))
        .attr("cy", d => radiusScale(d[valueFieldName]) * Math.sin(angleScale(d[categoryFieldName]) - Math.PI / 2))
        .style("fill", fillStyle.primaryColor)
        .style("stroke", fillStyle.dataPointStrokeColor)
        .style("stroke-width", 2); // Original was 3

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Data Value Labels
    const valueLabelOffset = 15; // Offset from the data point
    const valueLabelPadding = { x: 4, y: 2 };
    const valueLabelRectRadius = 3;

    processedChartData.forEach(d => {
        if (d[valueFieldName] === undefined) return;

        const angle = angleScale(d[categoryFieldName]) - Math.PI / 2;
        const r = radiusScale(d[valueFieldName]);
        
        const labelText = d[valueFieldName].toString();
        const textEstWidth = estimateTextWidth(
            labelText, 
            fillStyle.typography.annotationFontSize, 
            fillStyle.typography.annotationFontFamily,
            fillStyle.typography.annotationFontWeight
        );
        const textEstHeight = parseFloat(fillStyle.typography.annotationFontSize);


        // Position for the center of the text label
        let textX = (r + valueLabelOffset) * Math.cos(angle);
        let textY = (r + valueLabelOffset) * Math.sin(angle);
        
        // Adjust anchor based on angle to keep labels from overlapping center or going too far out
        let textAnchor = "middle";
        if (Math.cos(angle) > 0.1) textAnchor = "start";
        else if (Math.cos(angle) < -0.1) textAnchor = "end";

        if (textAnchor === "start") textX += valueLabelPadding.x;
        if (textAnchor === "end") textX -= valueLabelPadding.x;


        const rectWidth = textEstWidth + 2 * valueLabelPadding.x;
        const rectHeight = textEstHeight + 2 * valueLabelPadding.y;
        let rectX = textX - rectWidth / 2; // Default for middle anchor
        let rectY = textY - rectHeight / 2;

        if (textAnchor === "start") rectX = textX - valueLabelPadding.x;
        if (textAnchor === "end") rectX = textX - rectWidth + valueLabelPadding.x;


        mainChartGroup.append("rect")
            .attr("class", "other value-label-background")
            .attr("x", rectX)
            .attr("y", rectY)
            .attr("width", rectWidth)
            .attr("height", rectHeight)
            .attr("rx", valueLabelRectRadius)
            .attr("ry", valueLabelRectRadius)
            .style("fill", fillStyle.dataValueLabelBackgroundColor);

        mainChartGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", textX)
            .attr("y", textY)
            .attr("text-anchor", textAnchor)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.dataValueLabelColor)
            .text(labelText);
    });


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}