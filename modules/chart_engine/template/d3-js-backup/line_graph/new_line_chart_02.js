/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bar and Line Chart",
  "chart_name": "bar_line_combo_01",
  "is_composite": true,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 12], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 800,
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || data.colors || {}; // Prioritize dark theme colors
    const imagesConfig = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";

    const xDataColumn = dataColumns.find(col => col.role === xFieldRole);
    const yDataColumn = dataColumns.find(col => col.role === yFieldRole);

    if (!xDataColumn || !xDataColumn.name) {
        console.error("Critical chart config missing: X-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: X-axis field configuration is missing.</div>");
        return null;
    }
    if (!yDataColumn || !yDataColumn.name) {
        console.error("Critical chart config missing: Y-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Y-axis field configuration is missing.</div>");
        return null;
    }

    const categoryFieldName = xDataColumn.name;
    const valueFieldName = yDataColumn.name;
    const valueFieldUnit = yDataColumn.unit || '';

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyConfig.title?.font_size || '16px',
            titleFontWeight: typographyConfig.title?.font_weight || 'bold',
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        },
        textColor: colorsConfig.text_color || '#FFFFFF',
        primaryAccent: colorsConfig.other?.primary || '#3498db',
        chartBackground: colorsConfig.background_color || '#2c3e50',
        // Specific element colors
        barFill: colorsConfig.other?.primary || '#3498db',
        lineStroke: colorsConfig.other?.primary || '#3498db',
        pointFill: colorsConfig.background_color || '#2c3e50', // To make points "pop" on the line
        pointStroke: colorsConfig.other?.primary || '#3498db',
    };
    
    // Helper to estimate text width (in-memory SVG)
    function estimateTextWidth(text, styleProps) {
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        if (styleProps.fontSize) textElement.style.fontSize = styleProps.fontSize;
        if (styleProps.fontFamily) textElement.style.fontFamily = styleProps.fontFamily;
        if (styleProps.fontWeight) textElement.style.fontWeight = styleProps.fontWeight;
        textElement.textContent = text;

        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute'; // Keep it out of flow
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.width = '0px';
        tempSvg.style.height = '0px';
        tempSvg.appendChild(textElement);
        // Appending to a non-displayed SVG is usually enough for getComputedTextLength
        return textElement.getComputedTextLength();
    }

    // Helper to wrap text for D3 selections
    function wrapText(textSelection, maxWidth, textStyle) {
        textSelection.each(function() {
            const textElement = d3.select(this);
            const words = textElement.text().split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const lineHeight = 1.1; // ems
            const x = textElement.attr("x"); // Keep original x for centering
            const y = textElement.attr("y");
            let dy = parseFloat(textElement.attr("dy") || 0);
            if (isNaN(dy)) dy = 0;


            textElement.text(null); // Clear original text

            let tspan = textElement.append("tspan")
                .attr("x", x)
                .attr("y", y)
                .attr("dy", dy + "em");

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                const currentTextWidth = estimateTextWidth(tspan.text(), textStyle);
                if (currentTextWidth > maxWidth && line.length > 1) {
                    line.pop(); // remove last word
                    tspan.text(line.join(" "));
                    line = [word]; // start new line with current word
                    tspan = textElement.append("tspan")
                        .attr("x", x)
                        .attr("y", y)
                        .attr("dy", (++lineNumber * lineHeight + dy) + "em")
                        .text(word);
                }
            }
        });
    }
    
    // Simple value formatter
    const formatValue = (value) => {
        if (typeof value === 'number') {
            // Basic formatting, can be expanded (e.g. based on dataColumns.format)
            return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
        }
        return value;
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
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = { top: 20, right: 30, bottom: 80, left: 60 }; // Increased left margin for y-axis label

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const categories = chartData.map(d => d[categoryFieldName]);
    const yMax = d3.max(chartData, d => d[valueFieldName]) || 0;

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, yMax * 1.2]) // Add 20% padding at the top
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // X-axis labels
    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis");

    const xLabelTextStyle = {
        fontSize: fillStyle.typography.labelFontSize,
        fontFamily: fillStyle.typography.labelFontFamily,
        fontWeight: fillStyle.typography.labelFontWeight
    };

    xAxisLabelsGroup.selectAll(".x-axis-label")
        .data(chartData)
        .enter()
        .append("text")
        .attr("class", "label x-axis-label")
        .attr("x", d => xScale(d[categoryFieldName]) + xScale.bandwidth() / 2)
        .attr("y", innerHeight + 25) // Position below the chart
        .attr("dy", "0em") // Initial dy for wrapText
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .attr("fill", fillStyle.textColor)
        .text(d => d[categoryFieldName])
        .call(wrapText, xScale.bandwidth(), xLabelTextStyle);

    // Y-axis label
    if (valueFieldUnit) {
        mainChartGroup.append("text")
            .attr("class", "label y-axis-label axis y-axis")
            .attr("transform", "rotate(-90)")
            .attr("x", -innerHeight / 2)
            .attr("y", -chartMargins.left + 15) // Adjusted position
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize) // Using labelFontSize
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(valueFieldUnit);
    }

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    // Bars
    mainChartGroup.selectAll(".bar")
        .data(chartData)
        .enter()
        .append("rect")
        .attr("class", "mark bar")
        .attr("x", d => xScale(d[categoryFieldName]))
        .attr("y", d => yScale(d[valueFieldName]))
        .attr("width", xScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d[valueFieldName]))
        .attr("fill", fillStyle.barFill);

    // Line
    const lineGenerator = d3.line()
        .x(d => xScale(d[categoryFieldName]) + xScale.bandwidth() / 2)
        .y(d => yScale(d[valueFieldName]))
        .curve(d3.curveLinear);

    mainChartGroup.append("path")
        .datum(chartData)
        .attr("class", "mark line")
        .attr("fill", "none")
        .attr("stroke", fillStyle.lineStroke)
        .attr("stroke-width", 2)
        .attr("d", lineGenerator);

    // Data points (circles on the line)
    const circleRadius = 6; // Adjusted radius
    mainChartGroup.selectAll(".data-point")
        .data(chartData)
        .enter()
        .append("circle")
        .attr("class", "mark point data-point")
        .attr("cx", d => xScale(d[categoryFieldName]) + xScale.bandwidth() / 2)
        .attr("cy", d => yScale(d[valueFieldName]))
        .attr("r", circleRadius)
        .attr("fill", fillStyle.pointFill)
        .attr("stroke", fillStyle.pointStroke)
        .attr("stroke-width", 2);

    // Value labels (above data points)
    const valueLabelTextStyle = {
        fontSize: fillStyle.typography.annotationFontSize, // Using annotation for smaller data labels
        fontFamily: fillStyle.typography.annotationFontFamily,
        fontWeight: fillStyle.typography.annotationFontWeight
    };
    mainChartGroup.selectAll(".value-label")
        .data(chartData)
        .enter()
        .append("text")
        .attr("class", "label value-label")
        .attr("x", d => xScale(d[categoryFieldName]) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d[valueFieldName]) - circleRadius - 5) // Position above circle
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "alphabetic") // Ensure consistent baseline
        .style("font-family", valueLabelTextStyle.fontFamily)
        .style("font-size", valueLabelTextStyle.fontSize)
        .style("font-weight", valueLabelTextStyle.fontWeight)
        .attr("fill", fillStyle.textColor)
        .text(d => formatValue(d[valueFieldName]));

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Icons (below bars)
    const iconSize = xScale.bandwidth() * 0.8; // Make icon slightly smaller than band width
    const iconXOffset = (xScale.bandwidth() - iconSize) / 2; // Center icon in band

    const iconsGroup = mainChartGroup.append("g")
        .attr("class", "icons-group");

    chartData.forEach(d => {
        const iconUrl = imagesConfig.field && imagesConfig.field[d[categoryFieldName]]
            ? imagesConfig.field[d[categoryFieldName]]
            : null;

        if (iconUrl) {
            iconsGroup.append("image")
                .attr("class", "icon item-icon")
                .attr("x", xScale(d[categoryFieldName]) + iconXOffset)
                .attr("y", innerHeight - iconSize - 5) // Positioned near bottom of bar area, adjust as needed
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", iconUrl);
        }
    });
    
    // Adjust bottom margin if icons are present and potentially overlap with x-axis labels
    // This is a simple check; more sophisticated layout management might be needed for complex cases.
    if (imagesConfig.field && Object.keys(imagesConfig.field).length > 0) {
        // If icons are rendered, ensure x-axis labels are further down.
        // The current x-axis label y is innerHeight + 25.
        // Icon y is innerHeight - iconSize - 5.
        // If iconSize + 5 > 25, they might overlap.
        // The wrapText function adds tSpans, so the total height of wrapped text needs consideration.
        // For simplicity, this example assumes fixed positioning is sufficient.
        // A more robust solution would calculate actual rendered height of wrapped labels.
    }


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}