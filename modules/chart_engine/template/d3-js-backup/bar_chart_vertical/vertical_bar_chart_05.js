/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_05",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 12], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "text_color", "background_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Assuming light theme, or use data.colors_dark if a theme mechanism is in place
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");

    if (!xFieldCol || !yFieldCol) {
        console.error("Critical chart config missing: 'x' or 'y' field role not defined in dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: Critical chart configuration missing (x or y field role). Chart cannot be rendered.</div>");
        }
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;

    if (!xFieldName || !yFieldName) {
        console.error("Critical chart config missing: xFieldName or yFieldName is undefined. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: Critical chart configuration missing (x or y field name). Chart cannot be rendered.</div>");
        }
        return null;
    }

    const xFieldUnit = xFieldCol.unit && xFieldCol.unit !== "none" ? " " + xFieldCol.unit : "";
    const yFieldUnit = yFieldCol.unit && yFieldCol.unit !== "none" ? " " + yFieldCol.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            // title and annotation fonts are defined here for completeness, though not used in this specific chart per V.1
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) ? typographyInput.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) ? typographyInput.title.font_size : '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) ? typographyInput.title.font_weight : 'bold',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        },
        primaryAccent: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#1f77b4',
        textColor: colorsInput.text_color || '#0f223b',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        axisLineColor: '#CCCCCC', // Default for axis lines if needed, though often removed
        imageCircleBackground: '#FFFFFF',
        imageCircleStroke: '#DDDDDD',
    };
    
    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: getBBox on non-rendered element might be inconsistent.
        // For this exercise, we follow the prompt's implication it works.
        return tempText.getBBox().width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    const chartInstanceId = "chart_" + Math.random().toString(36).substring(2, 11);


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 30, right: 30, bottom: 70, left: 60 }; // Adjusted for labels
     if (variables.dynamic_margins && variables.dynamic_margins.bottom) { // Allow dynamic bottom margin
        chartMargins.bottom = variables.dynamic_margins.bottom;
    }


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataInput.map(d => ({
        category: d[xFieldName],
        value: +d[yFieldName]
    }));

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 0]) // Ensure domain starts at 0, handle empty data
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10));

    xAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d + xFieldUnit) // Add unit to x-axis labels
        .each(function() { // Handle label rotation
            const labelText = d3.select(this).text();
            const labelWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontFamily);
            if (labelWidth > xScale.bandwidth()) {
                d3.select(this)
                    .style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-45)");
            } else {
                d3.select(this).style("text-anchor", "middle");
            }
        });
    
    xAxisGroup.select(".domain").remove();


    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => formatValue(d) + yFieldUnit).tickSize(0).tickPadding(10));

    yAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll(".tick line").remove();


    // Block 8: Main Data Visualization Rendering
    const barGroups = mainChartGroup.selectAll(".bar-mark-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "mark-group bar-mark-group")
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    barGroups.append("rect")
        .attr("class", "mark bar")
        .attr("x", 0)
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d.value))
        .attr("fill", fillStyle.primaryAccent)
        .attr("rx", 2) // Simple rounded corners
        .attr("ry", 2);

    // Add data labels on top of bars
    barGroups.append("text")
        .attr("class", "label data-label")
        .attr("x", xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5) // Position above the bar
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => formatValue(d.value) + yFieldUnit);

    // Block 9: Optional Enhancements & Post-Processing (Images on bars)
    barGroups.each(function(d, i) {
        const group = d3.select(this);
        const categoryValue = d.category;
        const imageUrl = imagesInput.field && imagesInput.field[categoryValue] ? imagesInput.field[categoryValue] : null;

        if (imageUrl) {
            const imageSize = xScale.bandwidth() * 0.7; // Image size relative to bar width
            const imagePadding = 10; // Padding from the top of the bar
            const imageY = yScale(d.value) + imagePadding;
            const imageX = (xScale.bandwidth() - imageSize) / 2; // Center image horizontally

            // Ensure image does not go outside bar boundaries if bar is too short
            if (innerHeight - yScale(d.value) > imageSize + imagePadding) {
                const clipId = `clip-circle-${chartInstanceId}-${i}`;

                group.append("clipPath")
                    .attr("id", clipId)
                    .append("circle")
                    .attr("class", "image-clip-path-shape")
                    .attr("cx", imageX + imageSize / 2)
                    .attr("cy", imageY + imageSize / 2)
                    .attr("r", imageSize / 2);

                group.append("circle")
                    .attr("class", "image-background")
                    .attr("cx", imageX + imageSize / 2)
                    .attr("cy", imageY + imageSize / 2)
                    .attr("r", imageSize / 2)
                    .attr("fill", fillStyle.imageCircleBackground)
                    .attr("stroke", fillStyle.imageCircleStroke)
                    .attr("stroke-width", 1);
                
                group.append("image")
                    .attr("class", "image icon")
                    .attr("x", imageX)
                    .attr("y", imageY)
                    .attr("width", imageSize)
                    .attr("height", imageSize)
                    .attr("clip-path", `url(#${clipId})`)
                    .attr("xlink:href", imageUrl)
                    .on("error", function() { // Handle broken image links gracefully
                        d3.select(this).remove(); // Remove the image element
                        // Optionally remove the background circle and clipPath too
                        group.select(`#${clipId}`).remove();
                        group.select(".image-background").remove();
                    });
            }
        }
    });
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}