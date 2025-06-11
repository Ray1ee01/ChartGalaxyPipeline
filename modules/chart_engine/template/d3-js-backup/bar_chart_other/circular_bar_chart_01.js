/* REQUIREMENTS_BEGIN
{
  "chart_type": "Circular Bar Chart",
  "chart_name": "circular_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": ["primary"],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "text_color"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "background_contextual"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    d3.select(containerSelector).html(""); // Clear the container

    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || (data.colors_dark || {});
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xFieldCol ? xFieldCol.name : undefined;
    const valueFieldName = yFieldCol ? yFieldCol.name : undefined;
    
    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: categoryFieldName or valueFieldName derived from dataColumns roles 'x' or 'y' is undefined. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration (x or y field) is missing.</div>");
        }
        return null;
    }

    if (chartDataArray.length === 0) {
        console.warn("Chart data is empty. Rendering placeholder or empty chart.");
         if (containerSelector) {
            // Optionally render a message, or just an empty SVG
            d3.select(containerSelector).html("<div style='text-align:center; padding:20px;'>No data provided to render the chart.</div>");
        }
        // return null; // Or proceed to render an empty chart structure
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = { typography: {} };

    // Typography tokens
    fillStyle.typography.defaultFontFamily = 'Arial, sans-serif';
    fillStyle.typography.labelFontFamily = typographyConfig.label && typographyConfig.label.font_family ? typographyConfig.label.font_family : fillStyle.typography.defaultFontFamily;
    
    fillStyle.typography.valueLabelFontSize = typographyConfig.label && typographyConfig.label.font_size ? typographyConfig.label.font_size : '18px';
    fillStyle.typography.valueLabelFontWeight = typographyConfig.label && typographyConfig.label.font_weight ? typographyConfig.label.font_weight : 'bold';

    fillStyle.typography.categoryLabelFontSize = typographyConfig.label && typographyConfig.label.font_size ? typographyConfig.label.font_size : '16px';
    fillStyle.typography.categoryLabelFontWeight = typographyConfig.label && typographyConfig.label.font_weight ? typographyConfig.label.font_weight : 'bold';

    // Color tokens
    fillStyle.textColor = colorsConfig.text_color || '#000000'; // Default text color
    fillStyle.primaryBarColor = (colorsConfig.other && colorsConfig.other.primary) || (colorsConfig.available_colors && colorsConfig.available_colors[0]) || '#d5481f';
    fillStyle.valueLabelColor = colorsConfig.text_color || '#FFFFFF'; // Default for labels inside bars
    fillStyle.categoryLabelColor = colorsConfig.text_color || '#c75526'; // Default for category labels
    fillStyle.innerCircleStrokeColor = (colorsConfig.other && colorsConfig.other.axis_line) || fillStyle.textColor;

    // Image tokens
    fillStyle.centerImageURL = imagesConfig.other && imagesConfig.other.primary ? imagesConfig.other.primary : null;

    // Helper: Format value (K, M, B)
    function formatValue(value) {
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    }
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .attr("class", "chart-root other"); // Added class, 'other' for root

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`)
        .attr("class", "main-chart-group other"); // Added class

    // Defs for potential patterns or clipPaths if images need them, though gradients are removed.
    mainChartGroup.append("defs"); 

    // Block 4: Core Chart Dimensions & Layout Calculation
    const effectiveRadiusBase = Math.min(containerWidth / 2 - (variables.radial_padding || 60), containerHeight / 2 - (variables.radial_padding || 60)); // Ensure labels fit
    const innerRadiusRatio = variables.inner_radius_ratio || 0.35;
    const outerRadiusMaxRatio = variables.outer_radius_max_ratio || 0.75;

    const innerRadius = effectiveRadiusBase * innerRadiusRatio;
    const outerRadiusMax = effectiveRadiusBase * outerRadiusMaxRatio;
    
    const startAngle = 0; // 0 degrees
    const endAngle = (5 * Math.PI) / 3; // 300 degrees (leaves a 60-degree gap at the top-left)

    // Block 5: Data Preprocessing & Transformation
    const valueUnitString = (yFieldCol && yFieldCol.unit && yFieldCol.unit !== "none" ? yFieldCol.unit : "");

    // Block 6: Scale Definition & Configuration
    const indices = chartDataArray.map((_, i) => i);
    const angleScale = d3.scaleBand()
        .domain(indices)
        .range([startAngle, endAngle])
        .padding(variables.bar_padding !== undefined ? variables.bar_padding : 0.05);

    const yMaxValue = d3.max(chartDataArray, d => d[valueFieldName]);
    const yDomainMax = variables.y_axis_max_value || (yMaxValue || (chartDataArray.length > 0 ? 100 : 0)); // Default to 100 if data, 0 if no data

    const radiusScale = d3.scaleLinear()
        .domain([0, yDomainMax])
        .range([innerRadius + (variables.bar_base_offset_from_inner_radius || Math.min(20, innerRadius * 0.2)), outerRadiusMax]);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Render the inner circle boundary (with the gap)
    const innerCircleArcGenerator = d3.arc()
        .innerRadius(innerRadius - 1) // Slight offset for stroke visibility
        .outerRadius(innerRadius)
        .startAngle(startAngle)
        .endAngle(endAngle);

    mainChartGroup.append("path")
        .attr("d", innerCircleArcGenerator)
        .attr("fill", "none")
        .attr("stroke", fillStyle.innerCircleStrokeColor)
        .attr("stroke-width", 1.5)
        .attr("class", "mark inner-circle-boundary");

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    if (chartDataArray.length > 0) {
        chartDataArray.forEach((d, i) => {
            const startAngleBar = angleScale(i);
            const endAngleBar = startAngleBar + angleScale.bandwidth();
            // Ensure barOuterRadius is not less than innerRadius if data value is 0 or negative
            const barOuterRadiusValue = Math.max(innerRadius, radiusScale(d[valueFieldName]));


            const barArcGenerator = d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(barOuterRadiusValue)
                .startAngle(startAngleBar)
                .endAngle(endAngleBar)
                .padAngle(variables.bar_pad_angle !== undefined ? variables.bar_pad_angle : 0.03)
                .padRadius(innerRadius); // Keeps padding consistent with inner radius

            mainChartGroup.append("path")
                .datum(d) // Bind data for potential interactions later
                .attr("d", barArcGenerator)
                .attr("fill", fillStyle.primaryBarColor)
                .attr("class", "mark bar-segment");

            // Value labels (inside/on bars)
            const valueLabelAngle = startAngleBar + (endAngleBar - startAngleBar) / 2;
            // Position label closer to outer edge if bar is thin, or centered if thick
            const valueLabelRadius = innerRadius + (barOuterRadiusValue - innerRadius) * 0.6; 
            const valueLabelX = Math.sin(valueLabelAngle) * valueLabelRadius;
            const valueLabelY = -Math.cos(valueLabelAngle) * valueLabelRadius;
            const formattedValue = `${formatValue(d[valueFieldName])}${valueUnitString}`;

            mainChartGroup.append("text")
                .attr("x", valueLabelX)
                .attr("y", valueLabelY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.valueLabelColor)
                .attr("font-size", fillStyle.typography.valueLabelFontSize)
                .attr("font-weight", fillStyle.typography.valueLabelFontWeight)
                .attr("font-family", fillStyle.typography.labelFontFamily)
                .attr("class", "label value-label text")
                .text(formattedValue);

            // Category (xField) labels (outside bars)
            const categoryLabelOffset = variables.category_label_offset || 25; // Default offset from bar's outer radius
            const categoryLabelRadius = barOuterRadiusValue + categoryLabelOffset;
            const categoryLabelX = Math.sin(valueLabelAngle) * categoryLabelRadius;
            const categoryLabelY = -Math.cos(valueLabelAngle) * categoryLabelRadius;

            mainChartGroup.append("text")
                .attr("x", categoryLabelX)
                .attr("y", categoryLabelY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.categoryLabelColor)
                .attr("font-size", fillStyle.typography.categoryLabelFontSize)
                .attr("font-weight", fillStyle.typography.categoryLabelFontWeight)
                .attr("font-family", fillStyle.typography.labelFontFamily)
                .attr("class", "label category-label text")
                .text(d[categoryFieldName]);
        });
    }


    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    if (fillStyle.centerImageURL) {
        const imageSizePercentageOfInnerRadius = variables.center_image_size_ratio || 0.8; // e.g., 80% of inner radius diameter
        const imageSize = Math.min(innerRadius * 2 * imageSizePercentageOfInnerRadius, containerWidth * 0.25, containerHeight * 0.25); // Cap size
        const imageX = -imageSize / 2;
        const imageY = -imageSize / 2; // Center the image

        mainChartGroup.append("image")
            .attr("xlink:href", fillStyle.centerImageURL)
            .attr("width", imageSize)
            .attr("height", imageSize)
            .attr("x", imageX)
            .attr("y", imageY)
            .attr("class", "icon center-image image"); // Added standard classes
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}