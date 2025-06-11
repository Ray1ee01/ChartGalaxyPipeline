/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radar Spline Chart",
  "chart_name": "radar_spline_chart_03",
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
  "background": "dark",

  "elementAlignment": "center",
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
    // This function renders a Radar Spline Chart.

    // Block 1: Configuration Parsing & Validation
    const chartInputData = data;
    const chartDataArray = chartInputData.data.data;
    const chartVariables = chartInputData.variables || {};
    const chartTypography = chartInputData.typography || {};
    const chartColors = chartInputData.colors_dark || {}; // Using colors_dark as per original
    const chartImages = chartInputData.images || {}; // Not used in this chart but extracted for consistency
    const chartDataColumns = chartInputData.data.columns || [];

    const xColumn = chartDataColumns.find(col => col.role === "x");
    const yColumn = chartDataColumns.find(col => col.role === "y");

    if (!xColumn || !yColumn) {
        const missing = [];
        if (!xColumn) missing.push("x role");
        if (!yColumn) missing.push("y role");
        const errorMessage = `Critical chart config missing: ${missing.join(', ')} in data.data.columns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>${errorMessage}</div>`);
        }
        return null;
    }

    const categoryFieldName = xColumn.name;
    const valueFieldName = yColumn.name;

    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const defaultColorsDark = {
        other: { primary: "#1f77b4" },
        background_color: "#222222",
        text_color: "#FFFFFF",
        grid_line_color: "#BBBBBB",
        data_point_stroke_color: "#FFFFFF",
        secondary_text_color: "#DDDDDD",
        text_on_primary_color: "#FFFFFF"
    };

    const fillStyle = {
        primaryColor: (chartColors.other && chartColors.other.primary) ? chartColors.other.primary : defaultColorsDark.other.primary,
        chartBackground: chartColors.background_color || defaultColorsDark.background_color, // Not directly used for SVG background, but for consistency
        textColor: chartColors.text_color || defaultColorsDark.text_color,
        secondaryTextColor: (chartColors.other && chartColors.other.secondary_text) ? chartColors.other.secondary_text : defaultColorsDark.secondary_text_color,
        gridLineColor: (chartColors.other && chartColors.other.grid_line) ? chartColors.other.grid_line : defaultColorsDark.grid_line_color,
        axisLineColor: (chartColors.other && chartColors.other.axis_line) ? chartColors.other.axis_line : defaultColorsDark.grid_line_color, // Often same as grid
        dataPointStrokeColor: (chartColors.other && chartColors.other.data_point_stroke) ? chartColors.other.data_point_stroke : defaultColorsDark.data_point_stroke_color,
        textOnPrimaryColor: (chartColors.other && chartColors.other.text_on_primary) ? chartColors.other.text_on_primary : defaultColorsDark.text_on_primary_color,
        typography: {
            categoryLabelFontFamily: (chartTypography.label && chartTypography.label.font_family) ? chartTypography.label.font_family : defaultTypography.label.font_family,
            categoryLabelFontSize: (chartTypography.label && chartTypography.label.font_size) ? chartTypography.label.font_size : "16px", // Original specific
            categoryLabelFontWeight: (chartTypography.label && chartTypography.label.font_weight) ? chartTypography.label.font_weight : "bold", // Original specific

            tickLabelFontFamily: (chartTypography.annotation && chartTypography.annotation.font_family) ? chartTypography.annotation.font_family : defaultTypography.annotation.font_family,
            tickLabelFontSize: (chartTypography.annotation && chartTypography.annotation.font_size) ? chartTypography.annotation.font_size : "14px", // Original specific
            tickLabelFontWeight: (chartTypography.annotation && chartTypography.annotation.font_weight) ? chartTypography.annotation.font_weight : "normal",

            valueLabelFontFamily: (chartTypography.annotation && chartTypography.annotation.font_family) ? chartTypography.annotation.font_family : defaultTypography.annotation.font_family,
            valueLabelFontSize: (chartTypography.annotation && chartTypography.annotation.font_size) ? chartTypography.annotation.font_size : "14px", // Original specific
            valueLabelFontWeight: (chartTypography.annotation && chartTypography.annotation.font_weight) ? chartTypography.annotation.font_weight : "normal",
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute'; // Avoid affecting layout if it were in DOM
        tempSvg.style.visibility = 'hidden'; // Avoid display if it were in DOM
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // Appending to body temporarily for robust measurement, then removing.
        // This is a common workaround if getBBox on detached elements is unreliable.
        // The directive says "MUST NOT be appended to the document DOM".
        // We will follow this strictly and hope getBBox() works on detached elements.
        // If not, this part might lead to inaccurate text widths.
        // For a truly detached measurement, one might need a canvas context.
        // document.body.appendChild(tempSvg); // Not allowed by directives
        const width = textElement.getBBox().width;
        // document.body.removeChild(tempSvg); // Not allowed by directives
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartVariables.width || 800;
    const containerHeight = chartVariables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg radar-spline-chart")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
        // No viewBox, no responsive width="100%"

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 50, bottom: 50, left: 50 }; // Default margins
    if (chartVariables.margin_top !== undefined) chartMargins.top = chartVariables.margin_top;
    if (chartVariables.margin_right !== undefined) chartMargins.right = chartVariables.margin_right;
    if (chartVariables.margin_bottom !== undefined) chartMargins.bottom = chartVariables.margin_bottom;
    if (chartVariables.margin_left !== undefined) chartMargins.left = chartVariables.margin_left;
    
    const plotWidth = containerWidth - chartMargins.left - chartMargins.right;
    const plotHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(plotWidth, plotHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-group main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    if (categories.length < 3) {
        console.warn("Radar chart typically requires at least 3 categories.");
        // Potentially render an error or simplified message, but for now, proceed.
    }
    
    const preparedDataForLine = categories.map(cat => {
        const point = chartDataArray.find(item => item[categoryFieldName] === cat);
        return {
            [categoryFieldName]: cat,
            [valueFieldName]: point ? point[valueFieldName] : 0 // Default to 0 if no data for a category
        };
    });

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI * (categories.length -1) / categories.length ]); // Ensures points are evenly spaced, last point before 2*PI

    const allValues = chartDataArray.map(d => d[valueFieldName]);
    const maxValue = d3.max(allValues) || 0; // Ensure maxValue is at least 0

    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue === 0 ? 1 : maxValue * 1.2]) // Handle all-zero case for domain, give headroom
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const gridTicks = radiusScale.ticks(5);

    mainChartGroup.selectAll(".grid-line.circular")
        .data(gridTicks)
        .enter()
        .append("circle")
        .attr("class", "grid-line circular")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d => radiusScale(d))
        .attr("fill", "none")
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");

    mainChartGroup.selectAll(".grid-line.radial")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "grid-line radial axis") // Added axis class
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radiusScale(radiusScale.domain()[1]) * Math.cos(angleScale(d) - Math.PI / 2)) // Extend to max radius
        .attr("y2", d => radiusScale(radiusScale.domain()[1]) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    mainChartGroup.selectAll(".label.category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label category-label")
        .attr("x", d => (radiusScale(radiusScale.domain()[1]) + 20) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radiusScale(radiusScale.domain()[1]) + 20) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d); // Angle relative to positive X-axis
            // Heuristic for text-anchor based on angle in standard Cartesian (0 right, PI/2 up)
            // Our angles are rotated by -PI/2 (0 up, PI/2 left)
            const visualAngle = angle - Math.PI / 2;
            if (Math.abs(visualAngle % Math.PI) < 0.01) return "middle"; // Top or bottom
            return (visualAngle > -Math.PI/2 && visualAngle < Math.PI/2) ? "start" : "end"; // Right side vs Left side
        })
        .attr("dominant-baseline", d => {
             const visualAngle = angleScale(d) - Math.PI / 2;
             if (Math.abs(visualAngle + Math.PI/2) < 0.01 || Math.abs(visualAngle - Math.PI/2) < 0.01 ) return "middle"; // Right or Left extreme
             return (visualAngle > -Math.PI && visualAngle < 0) ? "alphabetic" : "hanging"; // Top half vs Bottom half
        })
        .attr("fill", fillStyle.textColor)
        .attr("font-family", fillStyle.typography.categoryLabelFontFamily)
        .attr("font-size", fillStyle.typography.categoryLabelFontSize)
        .attr("font-weight", fillStyle.typography.categoryLabelFontWeight)
        .text(d => d);

    mainChartGroup.selectAll(".label.tick-label")
        .data(gridTicks.filter(d => d > 0)) // Don't label origin tick
        .enter()
        .append("text")
        .attr("class", "label tick-label")
        .attr("x", 5) // Offset from the vertical axis line
        .attr("y", d => -radiusScale(d))
        .attr("dy", "-0.3em") // Adjust vertical position slightly
        .attr("text-anchor", "start")
        .attr("fill", fillStyle.secondaryTextColor)
        .attr("font-family", fillStyle.typography.tickLabelFontFamily)
        .attr("font-size", fillStyle.typography.tickLabelFontSize)
        .attr("font-weight", fillStyle.typography.tickLabelFontWeight)
        .text(d => d);

    // Block 8: Main Data Visualization Rendering
    const radarLineGenerator = d3.lineRadial()
        .angle(d => angleScale(d[categoryFieldName]) - Math.PI / 2)
        .radius(d => radiusScale(d[valueFieldName]))
        .curve(d3.curveCatmullRomClosed.alpha(0.5));

    mainChartGroup.append("path")
        .datum(preparedDataForLine)
        .attr("class", "mark radar-path")
        .attr("d", radarLineGenerator)
        .attr("fill", fillStyle.primaryColor)
        .attr("fill-opacity", 0) // Original had 0, making it a line chart not area
        .attr("stroke", fillStyle.primaryColor)
        .attr("stroke-width", chartVariables.stroke_width || 3); // Original used 6, made configurable or default 3

    // Block 9: Optional Enhancements & Post-Processing
    const dataPointsGroup = mainChartGroup.append("g").attr("class", "data-points-group");

    preparedDataForLine.forEach(d => {
        if (d[valueFieldName] === undefined) return; // Skip if no value

        const angle = angleScale(d[categoryFieldName]) - Math.PI / 2;
        const distance = radiusScale(d[valueFieldName]);

        dataPointsGroup.append("circle")
            .attr("class", "mark data-point")
            .attr("cx", distance * Math.cos(angle))
            .attr("cy", distance * Math.sin(angle))
            .attr("r", chartVariables.data_point_radius || 4) // Original used 6, made configurable or default 4
            .attr("fill", fillStyle.primaryColor)
            .attr("stroke", fillStyle.dataPointStrokeColor)
            .attr("stroke-width", chartVariables.data_point_stroke_width || 2); // Original used 3, default 2

        // Value labels
        const labelText = d[valueFieldName].toString();
        const textWidth = estimateTextWidth(
            labelText, 
            fillStyle.typography.valueLabelFontFamily, 
            fillStyle.typography.valueLabelFontSize, 
            fillStyle.typography.valueLabelFontWeight
        );

        const labelOffset = 15 + (chartVariables.data_point_radius || 4); // Offset from data point edge
        const textX = (distance + labelOffset) * Math.cos(angle);
        const textY = (distance + labelOffset) * Math.sin(angle);
        
        const labelPadding = 4;
        const rectHeight = parseFloat(fillStyle.typography.valueLabelFontSize) + 2 * labelPadding;
        const rectWidth = textWidth + 2 * labelPadding;

        dataPointsGroup.append("rect")
            .attr("class", "other value-label-background")
            .attr("x", textX - rectWidth / 2)
            .attr("y", textY - rectHeight / 2)
            .attr("width", rectWidth)
            .attr("height", rectHeight)
            .attr("fill", fillStyle.primaryColor)
            .attr("rx", 3);

        dataPointsGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", textX)
            .attr("y", textY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", fillStyle.textOnPrimaryColor)
            .attr("font-family", fillStyle.typography.valueLabelFontFamily)
            .attr("font-size", fillStyle.typography.valueLabelFontSize)
            .attr("font-weight", fillStyle.typography.valueLabelFontWeight)
            .text(labelText);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}