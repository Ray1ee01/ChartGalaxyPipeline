/* REQUIREMENTS_BEGIN
{
  "chart_type": "Circular Bar Chart",
  "chart_name": "circular_bar_chart_icons_01",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

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
        valueFieldUnit = valueColumn.unit === "B" ? " B" : valueColumn.unit;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyInput.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyInput.label?.font_size || "12px",
            labelFontWeight: typographyInput.label?.font_weight || "normal",
            annotationFontFamily: typographyInput.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyInput.annotation?.font_size || "10px", // Base, will be dynamic
            annotationFontWeight: typographyInput.annotation?.font_weight || "bold", // For values in circles
        },
        chartBackground: colorsInput.background_color || "#FFFFFF",
        textColor: colorsInput.text_color || "#333333",
        primaryColor: colorsInput.other?.primary || "#084594",
        centralCircleFill: "#FFFFFF",
        centralCircleStroke: "#AAAAAA",
        endCircleStrokeColor: "#FFFFFF", // White stroke for end circles
        textOnMarkColor: "#FFFFFF", // For text inside colored marks (end circles)
    };

    // Helper: In-memory text measurement
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but trying without for stricter adherence to "MUST NOT be appended to the document DOM".
        // If issues arise, a temporary append/remove might be needed.
        // For now, assuming direct getBBox on non-appended element works in modern browsers.
        // However, to be safe and standard, it's better to append, measure, remove.
        // Let's try a common workaround:
        // document.body.appendChild(svg); // Temporarily append
        // const width = textEl.getBBox().width;
        // document.body.removeChild(svg); // Remove
        // return width;
        // For strictness, if the above is disallowed, this is an approximation:
        return text.length * (parseFloat(fontSize) * 0.6); // Fallback if getBBox on detached fails
    }
     // More robust text width estimation without appending to DOM (if possible)
    const textMeasureContext = document.createElement("canvas").getContext("2d");
    function robustEstimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        textMeasureContext.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        return textMeasureContext.measureText(text).width;
    }


    // Helper: Format value with K, M, B suffixes
    const formatValue = (value) => {
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
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 800;
    const chartSize = Math.min(containerWidth, containerHeight);

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", chartSize)
        .attr("height", chartSize)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 60, bottom: 60, left: 60 }; // Adjusted for labels/icons

    const innerWidth = chartSize - chartMargins.left - chartMargins.right;
    const innerHeight = chartSize - chartMargins.top - chartMargins.bottom;

    const centerX = chartMargins.left + innerWidth / 2;
    const centerY = chartMargins.top + innerHeight / 2;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    // Block 5: Data Preprocessing & Transformation
    let chartDataArray = [...chartDataInput]; // Create a mutable copy
    chartDataArray.sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);

    const totalItems = chartDataArray.length;
    if (totalItems === 0) {
        svgRoot.append("text")
            .attr("x", chartSize / 2)
            .attr("y", chartSize / 2)
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .text("No data available.");
        return svgRoot.node();
    }

    const anglePerItem = (2 * Math.PI) / totalItems;
    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]);
    const minValue = 0; // Assuming values start from 0

    // Block 6: Scale Definition & Configuration
    const centralCircleRadius = radius * 0.25;
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([centralCircleRadius + Math.max(5, radius * 0.05), radius * 0.9]); // Ensure min extension

    const lightColor = d3.rgb(fillStyle.primaryColor).brighter(0.5);
    const darkColor = d3.rgb(fillStyle.primaryColor).darker(0.5);
    const colorInterpolator = d3.interpolateRgb(lightColor, darkColor);
    const colorScale = d3.scaleSequential(colorInterpolator)
        .domain([totalItems - 1, 0]); // Index 0 (max value) gets darker color

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    svgRoot.append("circle")
        .attr("class", "other central-circle")
        .attr("cx", centerX)
        .attr("cy", centerY)
        .attr("r", centralCircleRadius)
        .attr("fill", fillStyle.centralCircleFill)
        .attr("stroke", fillStyle.centralCircleStroke)
        .attr("stroke-width", 1.5);

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other main-chart-group")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const arcGenerator = d3.arc()
        .innerRadius(centralCircleRadius)
        .padAngle(0.02);

    const sectorsGroup = mainChartGroup.append("g").attr("class", "other sectors-group");
    const endElementsGroup = mainChartGroup.append("g").attr("class", "other end-elements-group"); // For circles and text
    const labelsGroup = mainChartGroup.append("g").attr("class", "other labels-group"); // For external icons

    chartDataArray.forEach((d, i) => {
        const value = +d[valueFieldName];
        const category = d[categoryFieldName];

        const startAngle = (i * anglePerItem);
        const endAngle = startAngle + anglePerItem;
        const midAngle = startAngle + anglePerItem / 2;

        const currentOuterRadius = radiusScale(value);

        sectorsGroup.append("path")
            .attr("class", "mark sector-bar")
            .datum({
                innerRadius: centralCircleRadius,
                outerRadius: currentOuterRadius,
                startAngle: startAngle,
                endAngle: endAngle
            })
            .attr("d", arcGenerator)
            .attr("fill", colorScale(i));

        const endCircleX = Math.sin(midAngle) * currentOuterRadius;
        const endCircleY = -Math.cos(midAngle) * currentOuterRadius;
        const endCircleRadius = Math.max(10, Math.min(25, radius * 0.08 * (value / maxValue * 1.5 + 0.5)));


        endElementsGroup.append("circle")
            .attr("class", "mark end-circle")
            .attr("cx", endCircleX)
            .attr("cy", endCircleY)
            .attr("r", endCircleRadius)
            .attr("fill", colorScale(i))
            .attr("stroke", fillStyle.endCircleStrokeColor)
            .attr("stroke-width", 1.5);

        const valueTextContent = `${formatValue(value)}${valueFieldUnit}`;
        let dynamicFontSize = endCircleRadius * 0.8; // Initial guess
        
        // Adjust font size to fit inside the circle
        let textWidth = robustEstimateTextWidth(valueTextContent, fillStyle.typography.annotationFontFamily, `${dynamicFontSize}px`, fillStyle.typography.annotationFontWeight);
        const maxTextWidth = endCircleRadius * 1.6; // Allow some padding

        while (textWidth > maxTextWidth && dynamicFontSize > 5) {
            dynamicFontSize -= 0.5;
            textWidth = robustEstimateTextWidth(valueTextContent, fillStyle.typography.annotationFontFamily, `${dynamicFontSize}px`, fillStyle.typography.annotationFontWeight);
        }
        if (dynamicFontSize < 5) dynamicFontSize = 5; // Minimum font size


        endElementsGroup.append("text")
            .attr("class", "text value data-label")
            .attr("x", endCircleX)
            .attr("y", endCircleY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.annotationFontFamily)
            .attr("font-size", `${dynamicFontSize}px`)
            .attr("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", fillStyle.textOnMarkColor)
            .text(valueTextContent);

        // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
        const iconUrl = imagesInput.field?.[category];
        if (iconUrl) {
            const iconSize = Math.max(20, Math.min(40, radius * 0.1)); // Dynamic icon size
            const labelPadding = iconSize * 0.5 + 5; // Padding between end circle and icon
            const iconRadialPosition = currentOuterRadius + endCircleRadius + labelPadding;

            const iconX = Math.sin(midAngle) * iconRadialPosition;
            const iconY = -Math.cos(midAngle) * iconRadialPosition;

            labelsGroup.append("image")
                .attr("class", "icon image category-icon")
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