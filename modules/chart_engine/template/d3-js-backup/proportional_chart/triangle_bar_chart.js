/* REQUIREMENTS_BEGIN
{
  "chart_type": "Triangle Bar Chart",
  "chart_name": "triangle_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 8], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    // const images = data.images || {}; // Not used in this chart
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xCol = dataColumns.find(c => c.role === "x");
    const yCol = dataColumns.find(c => c.role === "y");

    const xField = xCol?.name;
    const yField = yCol?.name;

    if (!xField || !yField) {
        console.error("Critical chart config missing: xField or yField. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Critical chart configuration (x or y field) is missing.</div>");
        return null;
    }

    const yUnit = yCol?.unit && yCol.unit !== "none" ? yCol.unit : "";

    const chartDataArray = chartDataInput.filter(d => d[yField] != null && +d[yField] > 0);

    if (!chartDataArray.length) {
        d3.select(containerSelector).html("<div style='text-align:center; padding: 20px;'>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: (colors.other && colors.other.primary) ? colors.other.primary : '#C13C37',
        textColor: colors.text_color || '#0f223b',
        axisLineColor: '#AAAAAA',
        chartBackground: colors.background_color || '#FFFFFF',
        typography: {
            valueFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            valueFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            valueFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'bold',
            categoryFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            categoryFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            categoryFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const svgNs = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNs, 'svg');
        const textElement = document.createElementNS(svgNs, 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // Note: getBBox on an unattached SVG element can be unreliable in some older browsers.
        // Modern browsers generally support this.
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            console.warn("Could not measure text width using in-memory SVG:", e);
            // Fallback to a very rough estimate if getBBox fails
            width = text.length * (parseFloat(fontSize) || 10) * 0.6;
        }
        return width;
    }

    function splitTextIntoLines(text, fontFamily, fontSize, fontWeight, maxWidth) {
        if (!text) return [""];
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = "";

        if (words.length <= 2 && text.length > 5) { // Heuristic for CJK or similar
            const chars = text.split('');
            currentLine = chars[0] || "";
            for (let i = 1; i < chars.length; i++) {
                const testLine = currentLine + chars[i];
                if (estimateTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = chars[i];
                }
            }
            if (currentLine) lines.push(currentLine);
        } else {
            currentLine = words[0] || "";
            for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + " " + words[i];
                if (estimateTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = words[i];
                }
            }
            if (currentLine) lines.push(currentLine);
        }
        return lines.length > 0 ? lines : [""]; // Ensure at least one empty line if text was empty
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 20, bottom: 80, left: 20 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    const barWidth = 100; // Each triangle's base width
    const maxTriangleHeight = innerHeight * 0.9;

    let padding;
    if (chartDataArray.length <= 4) {
        padding = 20;
    } else if (chartDataArray.length <= 6) {
        padding = -10;
    } else {
        padding = -30;
    }

    const totalWidthEstimate = chartDataArray.length * (barWidth + padding) - padding;
    if (totalWidthEstimate > innerWidth && chartDataArray.length > 1) {
        padding = Math.max(-30, (innerWidth - chartDataArray.length * barWidth) / (chartDataArray.length - 1));
    } else if (totalWidthEstimate > innerWidth && chartDataArray.length === 1) {
        // If only one bar and it's too wide, it will just be centered.
        // Padding doesn't apply. We could potentially scale down barWidth here,
        // but current logic keeps barWidth fixed.
    }


    // Block 5: Data Preprocessing & Transformation
    const maxValue = d3.max(chartDataArray, d => +d[yField]);

    // Block 6: Scale Definition & Configuration
    const heightScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, maxTriangleHeight]);

    const nodesData = chartDataArray.map((d, i) => ({
        id: d[xField] != null ? String(d[xField]) : `__${i}__`,
        val: +d[yField],
        height: heightScale(+d[yField]),
        width: barWidth,
        color: fillStyle.primaryColor,
        raw: d,
    }));

    const totalActualWidth = nodesData.length * (barWidth + padding) - (nodesData.length > 0 ? padding : 0) ;
    let startX = (innerWidth - totalActualWidth) / 2;
    if (startX < 0) startX = 0; // Should not happen if padding adjustment is correct

    nodesData.forEach((node, i) => {
        node.x = startX + i * (barWidth + padding) + barWidth / 2; // Center X of the triangle base
    });

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    mainChartGroup.append("line")
        .attr("class", "other gridline")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // Block 8: Main Data Visualization Rendering
    nodesData.forEach(node => {
        const triangleGroup = mainChartGroup.append("g")
            .attr("class", "mark-group other") // Added class
            .attr("transform", `translate(${node.x}, ${innerHeight})`);

        const halfWidth = node.width / 2;
        const trianglePath = `M 0,${-node.height} L ${-halfWidth},0 L ${halfWidth},0 Z`;

        triangleGroup.append("path")
            .attr("class", "mark") // Added class
            .attr("d", trianglePath)
            .attr("fill", node.color);

        // Value label (top)
        const valText = `${node.val}${yUnit}`;
        triangleGroup.append("text")
            .attr("class", "text value") // Added class
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "text-after-edge")
            .attr("x", 0)
            .attr("y", -node.height - 10)
            .style("font-family", fillStyle.typography.valueFontFamily)
            .style("font-weight", fillStyle.typography.valueFontWeight)
            .style("font-size", fillStyle.typography.valueFontSize)
            .style("fill", fillStyle.textColor)
            .text(valText);

        // Category label (bottom)
        const catText = node.id.startsWith("__") ? "" : node.id;
        if (catText) {
            const labelMaxWidth = Math.max(node.width * 1.2, 80);
            const lines = splitTextIntoLines(
                catText,
                fillStyle.typography.categoryFontFamily,
                fillStyle.typography.categoryFontSize,
                fillStyle.typography.categoryFontWeight,
                labelMaxWidth
            );
            const lineHeight = parseFloat(fillStyle.typography.categoryFontSize) * 1.2;

            lines.forEach((line, i) => {
                triangleGroup.append("text")
                    .attr("class", "text category") // Added class
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .attr("x", 0)
                    .attr("y", 15 + i * lineHeight)
                    .style("font-family", fillStyle.typography.categoryFontFamily)
                    .style("font-weight", fillStyle.typography.categoryFontWeight)
                    .style("font-size", fillStyle.typography.categoryFontSize)
                    .style("fill", fillStyle.textColor)
                    .text(line);
            });
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}