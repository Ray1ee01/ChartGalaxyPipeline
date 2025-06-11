/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_17_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "none",
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Could be data.colors_dark for dark themes, adapt if needed
    const imagesInput = data.images || {}; // Not used in this chart, but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldUnit = (dataColumns.find(col => col.role === "x" && col.unit !== "none") || {}).unit || "";
    const yFieldUnit = (dataColumns.find(col => col.role === "y" && col.unit !== "none") || {}).unit || "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        barPrimaryColor: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#D32F2F',
        barDarkerPrimaryColor: d3.rgb((colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#D32F2F').darker(0.7).toString(),
        barTopLabelColor: '#FFFFFF', // Typically white for contrast on dark bars
        chartBackground: colorsInput.background_color || 'transparent', // Default to transparent if not specified
    };

    // Helper function for text width estimation (not strictly needed for this refactored version but good practice)
    function estimateTextWidth(text, fontProps = {}) {
        const defaultFont = "12px sans-serif";
        const font = `${fontProps.fontWeight || ''} ${fontProps.fontSize || ''} ${fontProps.fontFamily || ''}`.trim() || defaultFont;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font', font); // Note: 'font' shorthand might not be fully supported by getBBox in all SVG implementations.
                                            // It's better to set font-family, font-size, font-weight individually if issues arise.
        textNode.style.fontFamily = fontProps.fontFamily || 'sans-serif';
        textNode.style.fontSize = fontProps.fontSize || '12px';
        textNode.style.fontWeight = fontProps.fontWeight || 'normal';
        textNode.textContent = text;
        svg.appendChild(textNode);
        // document.body.appendChild(svg); // Temporarily append to measure, then remove. DO NOT APPEND TO DOM.
        // The above line is incorrect per instructions. Use in-memory SVG.
        // For in-memory, we don't append to body. getBBox should work on unattached elements.
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            console.warn("Could not measure text width using getBBox for unattached SVG.", e);
            // Fallback or no-op
        }
        // svg.remove(); // If it were appended
        return width;
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 50,
        right: 30,
        bottom: 180, // Increased bottom margin for extended paths and labels
        left: 50  // Increased left margin for y-axis labels
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Layout constants for the extended paths
    const extensionHeight = 120;
    const offsetStep = 30;


    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataInput.map((d, i, arr) => {
        const midIndex = Math.floor(arr.length / 2);
        return {
            category: d[categoryFieldName],
            value: +d[valueFieldName],
            offset: (i - midIndex) * offsetStep // Calculate offset for extended paths
        };
    });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 10]) // Ensure domain is at least 0-10
        .range([innerHeight, 0])
        .nice();

    const barWidth = xScale.bandwidth();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const yAxisGenerator = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => `${d}${yFieldUnit ? ` ${yFieldUnit}` : ''}`)
        .tickSize(0)
        .tickPadding(10);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxisGenerator);

    yAxisGroup.select(".domain").remove(); // Remove axis line

    yAxisGroup.selectAll("text")
        .attr("class", "label axis-label y-axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // X-axis is not rendered in a traditional way; labels are on paths.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "mark bar-group")
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    // Main bars
    barGroups.append("rect")
        .attr("class", "mark bar-main")
        .attr("x", 0)
        .attr("y", d => yScale(d.value))
        .attr("width", barWidth)
        .attr("height", d => innerHeight - yScale(d.value))
        .attr("fill", (d, i) => (i === 0 ? fillStyle.barDarkerPrimaryColor : fillStyle.barPrimaryColor));

    // Extended paths at the bottom
    barGroups.append("path")
        .attr("class", "mark extension-path")
        .attr("d", d => `
            M ${0},${innerHeight}
            L ${barWidth},${innerHeight}
            L ${barWidth + d.offset},${innerHeight + extensionHeight}
            L ${0 + d.offset},${innerHeight + extensionHeight}
            Z
        `)
        .attr("fill", (d, i) => (i === 0 ? fillStyle.barDarkerPrimaryColor : fillStyle.barPrimaryColor))
        .attr("opacity", 0.8);

    // Category labels on the extended paths
    barGroups.append("text")
        .attr("class", "label category-on-path")
        .attr("text-anchor", "middle")
        .style("fill", fillStyle.barTopLabelColor) // Using barTopLabelColor for contrast on path
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => d.category)
        .attr("transform", d => {
            const posX = barWidth / 2 + d.offset * 0.66; // Position along the path's angle
            const posY = innerHeight + extensionHeight * 0.66;
            let textAngle = -(Math.atan2(d.offset, extensionHeight) * (180 / Math.PI) - 90);
            if (textAngle > 90 || textAngle < -90) { // Flip if upside down
                textAngle += 180;
            }
            return `translate(${posX}, ${posY}) rotate(${textAngle})`;
        })
        .attr("dy", "0.35em"); // Vertical alignment adjustment

    // Bar top value labels (background rectangle)
    barGroups.append("rect")
        .attr("class", "mark value-label-bg")
        .attr("x", barWidth / 2 - 20)
        .attr("y", d => yScale(d.value) - 25) // Adjusted y position
        .attr("width", 40)
        .attr("height", 20)
        .attr("fill", (d, i) => (i === 0 ? fillStyle.barDarkerPrimaryColor : fillStyle.barPrimaryColor))
        .attr("rx", 4)
        .attr("ry", 4);

    // Bar top value labels (text)
    barGroups.append("text")
        .attr("class", "label value-label")
        .attr("x", barWidth / 2)
        .attr("y", d => yScale(d.value) - 15) // Adjusted y position
        .style("fill", fillStyle.barTopLabelColor)
        .style("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", "bold")
        .text(d => `${d.value}${yFieldUnit ? ` ${yFieldUnit}` : ''}`);

    // Block 9: Optional Enhancements & Post-Processing
    // Removed gradient line and intersection gradient as per directives.
    // Removed shadow/stroke logic.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}