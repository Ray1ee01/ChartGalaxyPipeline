/* REQUIREMENTS_BEGIN
{
  "chart_type": "Lollipop Chart",
  "chart_name": "horizontal_lollipop_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || (data.colors_dark || {}); // Assuming dark theme might be passed via colors_dark
    // const inputImages = data.images || {}; // Not used in this simplified chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    const dimensionFieldName = dimensionFieldDef ? dimensionFieldDef.name : undefined;
    const valueFieldName = valueFieldDef ? valueFieldDef.name : undefined;
    
    const dimensionUnit = dimensionFieldDef && dimensionFieldDef.unit !== "none" ? dimensionFieldDef.unit : "";
    const valueUnit = valueFieldDef && valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";

    const criticalErrors = [];
    if (!dimensionFieldName) {
        criticalErrors.push("Dimension field (role 'x') name missing from data.data.columns");
    }
    if (!valueFieldName) {
        criticalErrors.push("Value field (role 'y') name missing from data.data.columns");
    }

    if (criticalErrors.length > 0) {
        const errorMsg = `Critical chart config missing: ${criticalErrors.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("font-family", "sans-serif")
                .style("padding", "10px")
                .html(`Error: ${errorMsg}`);
        }
        return null;
    }
    
    if (chartData.length === 0) {
        console.warn("Chart data is empty. Rendering an empty chart area.");
        // Optionally, display a message in the container
        // d3.select(containerSelector).append("div").text("No data to display.");
        // return null; // Or proceed to render an empty chart structure
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const typographyTitle = inputTypography.title || {};
    fillStyle.typography.titleFontFamily = typographyTitle.font_family || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = typographyTitle.font_size || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = typographyTitle.font_weight || defaultTypography.title.font_weight;

    const typographyLabel = inputTypography.label || {};
    fillStyle.typography.labelFontFamily = typographyLabel.font_family || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = typographyLabel.font_size || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = typographyLabel.font_weight || defaultTypography.label.font_weight;
    
    const typographyAnnotation = inputTypography.annotation || {};
    fillStyle.typography.annotationFontFamily = typographyAnnotation.font_family || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = typographyAnnotation.font_size || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = typographyAnnotation.font_weight || defaultTypography.annotation.font_weight;

    fillStyle.textColor = inputColors.text_color || "#333333";
    fillStyle.primaryColor = (inputColors.other && inputColors.other.primary) || "#1f77b4";
    fillStyle.chartBackground = inputColors.background_color || "#FFFFFF"; // Not actively used to fill SVG, but defined
    
    fillStyle.gridLineColor = "#e0e0e0";
    fillStyle.axisTickColor = fillStyle.textColor;
    fillStyle.lollipopLineColor = fillStyle.primaryColor;
    fillStyle.lollipopCircleFill = fillStyle.primaryColor;
    fillStyle.lollipopCircleTextColor = "#FFFFFF"; // Standard white for contrast

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.style.fontFamily = fontProps.font_family;
        tempText.style.fontSize = fontProps.font_size;
        tempText.style.fontWeight = fontProps.font_weight;
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: getBBox on an unattached element can sometimes be unreliable.
        // If issues arise, a temporary append/remove to a hidden part of the main SVG might be needed,
        // but this adheres to the "MUST NOT be appended to the document DOM" for the *temporary* SVG.
        const width = tempText.getBBox().width;
        return width;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "N/A";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI prefix
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value); // Fallback for smaller numbers
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("class", "chart-root"); // Added a class for the root

    // Block 4: Core Chart Dimensions & Layout Calculation
    let maxDimensionLabelWidth = 0;
    if (chartData.length > 0) {
        chartData.forEach(d => {
            const text = String(d[dimensionFieldName] === null || d[dimensionFieldName] === undefined ? "" : d[dimensionFieldName]);
            maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, estimateTextWidth(text, {
                font_family: fillStyle.typography.labelFontFamily,
                font_size: fillStyle.typography.labelFontSize,
                font_weight: fillStyle.typography.labelFontWeight
            }));
        });
    }


    const chartMargins = {
        top: 20 + (valueUnit ? 20 : 0), // Extra space if unit label is shown
        right: 30,  // Padding for the end of lollipops / circles
        bottom: 30, // For X-axis labels
        left: maxDimensionLabelWidth + 15 // 10px padding from label to stem start + 5px general
    };
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => {
        const valA = +a[valueFieldName];
        const valB = +b[valueFieldName];
        if (isNaN(valA) && isNaN(valB)) return 0;
        if (isNaN(valA)) return 1; // Treat NaN as smaller
        if (isNaN(valB)) return -1;
        return valB - valA; // Descending sort
    });
    const sortedDimensionNames = sortedData.map(d => String(d[dimensionFieldName]));

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensionNames)
        .range([0, innerHeight])
        .padding(0.3); // Adjust padding for spacing between lollipops

    const lollipopStickThickness = Math.max(yScale.bandwidth() * 0.1, 2);
    const lollipopCircleRadius = Math.max(Math.min(yScale.bandwidth() * 0.35, 20), 6); // Capped radius

    const maxValue = d3.max(sortedData, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, (maxValue && maxValue > 0 ? maxValue : 1) * 1.1]) // Ensure domain is not [0,0] if all values are 0 or negative
        .range([0, innerWidth - lollipopCircleRadius]) // lollipop circle center will be at xScale(value)
        .nice();


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Gridlines
    const gridlinesGroup = mainChartGroup.append("g")
        .attr("class", "grid-lines");

    xScale.ticks(5).forEach(tickValue => {
        if (tickValue > 0) { // Don't draw grid line at 0
            gridlinesGroup.append("line")
                .attr("class", "grid-line")
                .attr("x1", xScale(tickValue))
                .attr("y1", 0)
                .attr("x2", xScale(tickValue))
                .attr("y2", innerHeight)
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3");
        }
    });
    
    // X-axis
    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickSizeOuter(0) // No line at the end of the axis
        .tickPadding(8)
        .tickFormat(formatValue);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.select(".domain").remove(); // Hide axis line

    xAxisGroup.selectAll(".tick text")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.axisTickColor)
        .attr("class", "text axis-tick-label");


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    if (chartData.length > 0) {
        const lollipopItems = mainChartGroup.selectAll(".lollipop-item")
            .data(sortedData)
            .enter()
            .append("g")
            .attr("class", "mark lollipop-item")
            .attr("transform", d => `translate(0, ${yScale(String(d[dimensionFieldName])) + yScale.bandwidth() / 2})`);

        // Lollipop line
        lollipopItems.append("line")
            .attr("class", "mark lollipop-line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", d => xScale(Math.max(0, +d[valueFieldName]))) // Ensure line doesn't go negative
            .attr("y2", 0)
            .attr("stroke", fillStyle.lollipopLineColor)
            .attr("stroke-width", lollipopStickThickness);

        // Lollipop circle
        lollipopItems.append("circle")
            .attr("class", "mark lollipop-circle")
            .attr("cx", d => xScale(Math.max(0, +d[valueFieldName])))
            .attr("cy", 0)
            .attr("r", lollipopCircleRadius)
            .attr("fill", fillStyle.lollipopCircleFill);

        // Dimension labels
        lollipopItems.append("text")
            .attr("class", "label dimension-label")
            .attr("x", -10) // Padding from stem start
            .attr("y", 0)
            .attr("dy", "0.35em") // Vertical alignment
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d => String(d[dimensionFieldName]));

        // Value labels inside circles
        const valueLabelFontSize = Math.min(parseFloat(fillStyle.typography.annotationFontSize), lollipopCircleRadius * 0.8);
        lollipopItems.append("text")
            .attr("class", "label value-label")
            .attr("x", d => xScale(Math.max(0, +d[valueFieldName])))
            .attr("y", 0)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${valueLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.lollipopCircleTextColor)
            .text(d => formatValue(+d[valueFieldName]));
    }


    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Unit label for the first item (if valueUnit is present)
    if (valueUnit && sortedData.length > 0) {
        const firstDataPoint = sortedData[0];
        const firstValue = +firstDataPoint[valueFieldName];
        if (!isNaN(firstValue)) {
            mainChartGroup.append("text")
                .attr("class", "label unit-label")
                .attr("x", xScale(Math.max(0, firstValue)))
                .attr("y", yScale(String(firstDataPoint[dimensionFieldName])) + yScale.bandwidth() / 2 - lollipopCircleRadius - 5) // Above the first circle
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize) // Use annotation font size
                .style("font-weight", "normal") // Typically normal weight for units
                .style("fill", fillStyle.textColor)
                .text(`(${valueUnit})`);
        }
    }
    
    if (dimensionUnit) {
        // Example: Add dimension unit label near the dimension labels if needed
        // This is often complex to place well, so keeping it simple or omitting if not critical
        // For instance, below the first dimension label:
        if (sortedData.length > 0) {
             mainChartGroup.append("text")
                .attr("class", "label unit-label dimension-unit-label")
                .attr("x", -10)
                .attr("y", yScale(sortedDimensionNames[0]) + yScale.bandwidth() / 2 + parseFloat(fillStyle.typography.labelFontSize) + 5)
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("fill", fillStyle.textColor)
                .text(`(${dimensionUnit})`);
        }
    }


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}