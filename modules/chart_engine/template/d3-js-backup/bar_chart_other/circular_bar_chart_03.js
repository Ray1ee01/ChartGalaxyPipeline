/* REQUIREMENTS_BEGIN
{
  "chart_type": "Circular Bar Chart",
  "chart_name": "circular_bar_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 500,
  "min_width": 500,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data;
    let chartDataArray = chartConfig.data && chartConfig.data.data ? chartConfig.data.data : [];
    const variables = chartConfig.variables || {};
    const rawTypography = chartConfig.typography || {};
    const rawColors = chartConfig.colors || {}; // Could be colors_dark too, handle if needed or assume one.
    const rawImages = chartConfig.images || {};
    const dataColumns = chartConfig.data && chartConfig.data.columns ? chartConfig.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    let valueFieldUnit = "";
    const valueColumn = dataColumns.find(col => col.role === "y");
    if (valueColumn && valueColumn.unit && valueColumn.unit !== "none") {
        valueFieldUnit = valueColumn.unit === "B" ? " B" : valueColumn.unit; // Special handling for 'B' unit
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px', // Default for values in circles
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'bold', // Values in circles are often bold
        },
        textColor: rawColors.text_color || '#333333',
        primaryColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#084594',
        chartBackground: rawColors.background_color || '#FFFFFF', // Not directly used for SVG background, but for consistency
        centralCircleFill: '#FFFFFF',
        centralCircleStroke: '#AAAAAA',
        endCircleValueTextColor: '#FFFFFF', // Text color for values inside end circles
        endCircleStrokeColor: '#FFFFFF',
    };

    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but trying without first.
        // If issues, uncomment: document.body.appendChild(svg);
        const width = textElement.getBBox().width;
        // if (svg.parentNode === document.body) document.body.removeChild(svg);
        return width;
    }
    
    function formatValue(value) {
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        }
        return d3.format("~g")(value);
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 800;
    const baseSize = Math.min(containerWidth, containerHeight); // Ensure square aspect ratio for the chart logic

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Apply background to SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 50, bottom: 60, left: 50 };

    // Adjust effective width/height for chart calculations based on baseSize and margins
    const effectiveWidth = baseSize - chartMargins.left - chartMargins.right;
    const effectiveHeight = baseSize - chartMargins.top - chartMargins.bottom;

    // Center calculations should use containerWidth/Height if chart is not square,
    // but the circular chart logic itself uses baseSize.
    // For simplicity, we'll center based on baseSize, assuming the chart is effectively square.
    // If containerWidth != containerHeight, the chart will be centered within the baseSize square area.
    const chartCenterX = chartMargins.left + effectiveWidth / 2;
    const chartCenterY = chartMargins.top + effectiveHeight / 2;
    const chartRadius = Math.min(effectiveWidth, effectiveHeight) / 2;
    const centralCircleRadius = chartRadius * 0.25;

    // Block 5: Data Preprocessing & Transformation
    if (chartDataArray.length === 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .text("No data available.");
        return svgRoot.node();
    }
    
    chartDataArray.sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);

    const totalItems = chartDataArray.length;
    const anglePerItem = (2 * Math.PI) / totalItems;
    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]);
    const minValue = 0; // Assuming values start from 0

    // Block 6: Scale Definition & Configuration
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([centralCircleRadius + Math.max(5, chartRadius * 0.05), chartRadius * 0.9]); // Ensure min extension

    const lightColor = d3.rgb(fillStyle.primaryColor).brighter(0.5);
    const darkColor = d3.rgb(fillStyle.primaryColor).darker(0.5);
    const colorInterpolator = d3.interpolateRgb(lightColor, darkColor);
    const colorScale = d3.scaleSequential(colorInterpolator)
        .domain([totalItems - 1, 0]); // Index 0 (max value) gets darker color

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    svgRoot.append("circle")
        .attr("class", "mark central-circle")
        .attr("cx", chartCenterX)
        .attr("cy", chartCenterY)
        .attr("r", centralCircleRadius)
        .attr("fill", fillStyle.centralCircleFill)
        .attr("stroke", fillStyle.centralCircleStroke)
        .attr("stroke-width", 1.5);

    // Block 8: Main Data Visualization Rendering
    const arcGenerator = d3.arc()
        .innerRadius(centralCircleRadius)
        .padAngle(0.02);

    const sectorsGroup = svgRoot.append("g")
        .attr("class", "mark-group sectors")
        .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

    chartDataArray.forEach((d, i) => {
        const value = +d[valueFieldName];
        const category = d[categoryFieldName];

        const startAngle = i * anglePerItem;
        const endAngle = startAngle + anglePerItem;
        const midAngle = startAngle + anglePerItem / 2; // For positioning end circles and labels

        const currentOuterRadius = radiusScale(value);

        sectorsGroup.append("path")
            .attr("class", "mark sector-bar")
            .datum({ innerRadius: centralCircleRadius, outerRadius: currentOuterRadius, startAngle, endAngle })
            .attr("d", arcGenerator)
            .attr("fill", colorScale(i));
            // No stroke on bars for simplicity, adhering to "solid colors only"

        // End circle calculations
        const endCircleX = Math.sin(midAngle) * currentOuterRadius;
        const endCircleY = -Math.cos(midAngle) * currentOuterRadius;
        const endCircleRadius = Math.max(8, Math.min(25, chartRadius * 0.08 * (value / maxValue * 1.5 + 0.5)));


        sectorsGroup.append("circle")
            .attr("class", "mark end-circle")
            .attr("cx", endCircleX)
            .attr("cy", endCircleY)
            .attr("r", endCircleRadius)
            .attr("fill", colorScale(i))
            .attr("stroke", fillStyle.endCircleStrokeColor)
            .attr("stroke-width", 1);

        // Value text inside end circle
        const valueTextContent = `${formatValue(value)}${valueFieldUnit}`;
        let valueFontSize = endCircleRadius * 0.8; // Initial estimate
        // Simple heuristic to adjust font size if text is too long
        if (valueTextContent.length * valueFontSize * 0.5 > endCircleRadius * 1.6) { // 0.5 is avg char width/height ratio
            valueFontSize = (endCircleRadius * 1.6) / (valueTextContent.length * 0.5);
        }
        valueFontSize = Math.max(6, Math.min(valueFontSize, endCircleRadius * 1.2)); // Min/max font size


        sectorsGroup.append("text")
            .attr("class", "text value data-label")
            .attr("x", endCircleX)
            .attr("y", endCircleY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.annotationFontFamily)
            .attr("font-size", `${valueFontSize}px`)
            .attr("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", fillStyle.endCircleValueTextColor)
            .text(valueTextContent);

        // Block 9: Optional Enhancements & Post-Processing (Category Icons)
        // This part is inside the loop as it's per data item.
        const iconUrl = rawImages.field && rawImages.field[category] ? rawImages.field[category] : null;
        if (iconUrl) {
            const iconSize = Math.max(15, Math.min(30, chartRadius * 0.07)); // Dynamic icon size based on chart radius
            const labelPadding = Math.max(5, chartRadius * 0.03); // Padding between end circle and icon
            const iconRadialPosition = currentOuterRadius + endCircleRadius + labelPadding + iconSize / 2;

            const iconX = Math.sin(midAngle) * iconRadialPosition;
            const iconY = -Math.cos(midAngle) * iconRadialPosition;

            // Using the main svgRoot for labels group to ensure they are on top of sectors if needed,
            // but still transforming relative to chartCenter
            // For simplicity, appending to sectorsGroup, which is already translated.
            // If overlap issues, a separate labelsGroup on svgRoot would be better.
            sectorsGroup.append("image")
                .attr("class", "icon category-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", iconX - iconSize / 2)
                .attr("y", iconY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}