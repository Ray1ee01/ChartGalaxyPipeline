/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_07_2",
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
  "yAxis": "visible",
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
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assumes data.colors for light theme, or data.colors_dark for dark.
    const images = data.images || {}; // Not used in this chart, but extracted for consistency.
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;

    if (!xField || !yField) {
        console.error("Critical chart config missing: xField or yField name could not be derived from dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration (xField or yField) is missing.</div>");
        }
        return null;
    }
    
    let yUnit = dataColumns.find(col => col.role === "y" && col.unit !== "none")?.unit || "";

    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'bold', // Original used bold for some labels
        },
        textColor: colors.text_color || '#333333',
        textOnColorFill: '#FFFFFF', // For text on colored backgrounds
        chartBackground: colors.background_color || '#FFFFFF', // Not directly used on SVG, container expected to handle
        barPrimaryColor: (colors.other && colors.other.primary) ? colors.other.primary : '#D32F2F',
        axisLineColor: '#888888', // Default if not specified
        dashedLineColor: '#000000', // For the decorative dashed lines
    };
    fillStyle.barPrimaryDarkenedColor = d3.color(fillStyle.barPrimaryColor).darker(0.7).toString();

    // Helper for in-memory text measurement (not strictly needed for this chart after removing x-axis label adjustments)
    function estimateTextWidth(text, fontProps = `${fillStyle.typography.labelFontSize} ${fillStyle.typography.labelFontFamily}`) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('style', `font: ${fontProps};`);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but strictly forbidden by prompt.
        // For simple cases, this might suffice, or a fixed estimate per character could be used.
        // However, as this chart doesn't use it for layout adjustments, it's less critical.
        // A more robust in-memory approach would involve setting font properties directly.
        // This is a placeholder as the original logic using it was removed.
        return text.length * (parseInt(fillStyle.typography.labelFontSize) * 0.6); // Basic approximation
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // Optional: Add a background rect to the SVG itself
    // svgRoot.append("rect")
    //     .attr("width", containerWidth)
    //     .attr("height", containerHeight)
    //     .attr("fill", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 150, left: 60 }; // Increased bottom for extended paths
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const extensionHeight = 120; // Fixed layout parameter for the extended bar bases
    const offsetStep = 30;       // Fixed layout parameter for staggering extended bases

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataArray.map((d, i) => ({
        category: d[xField],
        value: +d[yField],
        originalIndex: i // Keep original index for color logic if needed
    }));
    
    const midIndex = Math.floor(processedData.length / 2);
    processedData.forEach((d, i) => {
        d.offset = (i - midIndex) * offsetStep;
    });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 0]) // Ensure domain starts at 0, handle empty data
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Y-axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale)
            .ticks(5)
            .tickFormat(d => d + (yUnit ? ` ${yUnit}` : ''))
            .tickSize(0)
            .tickPadding(10)
        );
    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);
    
    // No X-axis line or standard labels as per original's removal and custom path labels

    // Block 8: Main Data Visualization Rendering
    const barWidth = xScale.bandwidth();

    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "mark bar-group")
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    // Main bars
    barGroups.append("rect")
        .attr("class", "mark bar main-bar")
        .attr("x", 0)
        .attr("y", d => yScale(d.value))
        .attr("width", barWidth)
        .attr("height", d => innerHeight - yScale(d.value))
        .attr("fill", (d, i) => i === 0 ? fillStyle.barPrimaryDarkenedColor : fillStyle.barPrimaryColor);

    // Extended base paths
    barGroups.append("path")
        .attr("class", "mark extended-path")
        .attr("d", d => `
            M ${0},${innerHeight}
            L ${barWidth},${innerHeight}
            L ${barWidth + d.offset},${innerHeight + extensionHeight}
            L ${0 + d.offset},${innerHeight + extensionHeight}
            Z
        `)
        .attr("fill", (d, i) => i === 0 ? fillStyle.barPrimaryDarkenedColor : fillStyle.barPrimaryColor)
        .attr("opacity", 0.8);

    // Decorative dashed lines from bar center to extended base center
    barGroups.append("path")
        .attr("class", "mark decorative-line")
        .attr("d", d => `
            M ${barWidth / 2},${innerHeight}
            L ${barWidth / 2 + d.offset},${innerHeight + extensionHeight}
        `)
        .attr("stroke", fillStyle.dashedLineColor)
        .attr("stroke-width", 1.5)
        .attr("stroke-linecap", "round")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-dasharray", "5,5");

    // Text labels along the decorative lines (category names)
    barGroups.append("text")
        .attr("class", "label line-text")
        .attr("dy", -3) // Vertical offset from line
        .attr("text-anchor", "middle")
        .style("fill", fillStyle.textOnColorFill) // Assuming this text might be over colored parts or needs high contrast
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => d.category)
        .attr("transform", d => {
            const posX = barWidth / 2 + d.offset / 3; // Position 1/3 along the line from the top
            const posY = innerHeight + extensionHeight / 3;
            // Calculate rotation angle for text (degrees)
            // atan2(y,x) - y is vertical distance (extensionHeight), x is horizontal (d.offset)
            let textAngle = -Math.atan2(d.offset, extensionHeight) * (180 / Math.PI) + 90;
            if (textAngle > 90) textAngle -= 180; // Adjust for text readability
            if (textAngle < -90) textAngle += 180;
            return `translate(${posX}, ${posY}) rotate(${textAngle})`;
        });

    // Bar top value labels (background rect)
    barGroups.append("rect")
        .attr("class", "mark value-label-background")
        .attr("x", barWidth / 2 - 20)
        .attr("y", d => yScale(d.value) - 35)
        .attr("width", 40)
        .attr("height", 20)
        .attr("fill", (d, i) => i === 0 ? fillStyle.barPrimaryDarkenedColor : fillStyle.barPrimaryColor);
        // Removed rx, ry for simplicity

    // Bar top value labels (text)
    barGroups.append("text")
        .attr("class", "label value-label")
        .attr("x", barWidth / 2)
        .attr("y", d => yScale(d.value) - 25) // Adjusted y for middle alignment
        .style("fill", fillStyle.textOnColorFill)
        .style("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => `${d.value}${yUnit ? `${yUnit}` : ''}`);

    // Block 9: Optional Enhancements & Post-Processing
    // Removed "intersection-gradient" rect as it's a complex visual effect.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}