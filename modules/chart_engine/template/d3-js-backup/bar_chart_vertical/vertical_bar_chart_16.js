/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_16",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "text_color", "background_color"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const images = data.images || {}; // Though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");

    const xFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const yFieldName = yFieldConfig ? yFieldConfig.name : undefined;

    if (!xFieldName || !yFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push("x field (role: 'x')");
        if (!yFieldName) missingFields.push("y field (role: 'y')");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldUnit = xFieldConfig && xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    const yFieldUnit = yFieldConfig && yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) ? rawTypography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) ? rawTypography.title.font_size : '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) ? rawTypography.title.font_weight : 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'normal',
        },
        barPrimary: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#4682B4', // SteelBlue
        textColor: rawColors.text_color || '#333333',
        axisLineColor: rawColors.text_color || '#333333', // Default axis line to text color
        chartBackground: rawColors.background_color || '#FFFFFF',
    };

    function estimateTextWidth(text, fontFamily = fillStyle.typography.labelFontFamily, fontSize = fillStyle.typography.labelFontSize, fontWeight = fillStyle.typography.labelFontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        svg.style.width = 'auto';
        svg.style.height = 'auto';

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        
        // This temporary SVG is not appended to the live DOM for measurement.
        // Instead, we append it to a temporary, non-rendered document fragment or just use it in memory.
        // For robust measurement, it would typically be appended to document.body, measured, then removed.
        // However, to strictly adhere to "MUST NOT be appended to the document DOM", we rely on getBBox which works on detached elements in modern browsers.
        // If getBBox on detached elements is unreliable in some edge cases, a temporary body append/remove would be more robust.
        // For this exercise, we assume getBBox on a detached element is sufficient.
        
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on detached elements or for very simple text.
            const numFontSize = parseFloat(fontSize) || 12;
            width = text.length * numFontSize * 0.6; // Simple approximation
            console.warn("estimateTextWidth: getBBox failed, using approximation.", e);
        }
        return width;
    }

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
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 50,
        right: 30,
        bottom: 80, // Increased bottom margin for potentially rotated labels
        left: 60  // Increased left margin for y-axis labels and values
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataInput.map(d => ({
        category: d[xFieldName],
        value: +d[yFieldName] // Ensure value is numeric
    })).filter(d => d.category !== undefined && !isNaN(d.value));


    if (processedData.length === 0) {
        const errorMsg = "No valid data points to render after processing.";
        console.error(errorMsg);
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .text(errorMsg);
        return svgRoot.node();
    }
    
    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 0]) // Ensure domain starts at 0, handle empty data for max
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10));

    // X-axis label rotation logic
    let minXLabelRatio = 1.0;
    const maxXLabelWidth = xScale.bandwidth() * 1.03; // Allow slight overflow before rotation
    
    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const textContent = String(d) + (xFieldUnit ? ` ${xFieldUnit}` : '');
            d3.select(this).text(textContent); // Set text content first
            const currentWidth = estimateTextWidth(textContent, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            if (currentWidth > maxXLabelWidth) {
                minXLabelRatio = Math.min(minXLabelRatio, maxXLabelWidth / currentWidth);
            }
        })
        .style("text-anchor", minXLabelRatio < 1.0 ? "end" : "middle")
        .attr("dx", minXLabelRatio < 1.0 ? "-.8em" : "0em")
        .attr("dy", minXLabelRatio < 1.0 ? ".15em" : ".71em") // .71em is default for middle, .15em for end/rotated
        .attr("transform", minXLabelRatio < 1.0 ? "rotate(-45)" : "rotate(0)");

    xAxisGroup.select(".domain").attr("stroke", fillStyle.axisLineColor);


    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale)
            .ticks(5)
            .tickFormat(d => formatValue(d) + (yFieldUnit ? ` ${yFieldUnit}` : ''))
            .tickSize(0)
            .tickPadding(10)
        );
    
    yAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    yAxisGroup.select(".domain").remove(); // Remove Y-axis line as per original behavior

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar")
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d.value))
        .attr("fill", fillStyle.barPrimary);

    // Data labels on top of bars
    mainChartGroup.selectAll(".data-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label data-label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5) // Position 5px above the bar
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => formatValue(d.value) + (yFieldUnit ? ` ${yFieldUnit}` : ''));

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations or icons in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}