/* REQUIREMENTS_BEGIN
{
  "chart_type": "Stacked Circle Bar Chart",
  "chart_name": "stacked_circle_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
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
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const inputTypography = data.typography || {};
    const inputColors = data.colors || {};
    // const inputImages = data.images || {}; // Not used in this chart

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");

    if (!xFieldConfig || !xFieldConfig.name || !yFieldConfig || !yFieldConfig.name) {
        const missing = [];
        if (!xFieldConfig || !xFieldConfig.name) missing.push("x-field configuration");
        if (!yFieldConfig || !yFieldConfig.name) missing.push("y-field configuration");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const xFieldUnit = xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    const yFieldUnit = yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (inputTypography.label && inputTypography.label.font_family) ? inputTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (inputTypography.label && inputTypography.label.font_size) ? inputTypography.label.font_size : '12px',
            labelFontWeight: (inputTypography.label && inputTypography.label.font_weight) ? inputTypography.label.font_weight : 'normal',
            // title and annotation fonts are defined but not used in this chart as per no-title rule
        },
        textColor: inputColors.text_color || "#333333",
        primaryAccent: (inputColors.other && inputColors.other.primary) ? inputColors.other.primary : "#D32F2F",
        chartBackground: inputColors.background_color || "#FFFFFF", // Default to white if not specified
    };
    fillStyle.primaryAccentDarker = d3.rgb(fillStyle.primaryAccent).darker(0.7).toString();

    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document.body.appendChild(tempSvg); // DO NOT APPEND TO DOM
        const width = tempText.getBBox().width;
        // Document.body.removeChild(tempSvg);
        return width;
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 40 };
    if (variables.dynamic_margins) { // Example of a variable that might adjust margins
        // This chart doesn't use dynamic margins, but this is where it would go.
    }
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartData.map(d => ({
        category: d[xFieldName],
        value: +d[yFieldName] // Ensure yFieldName value is numeric
    }));

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.05);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 10]) // Ensure domain is valid even if max value is 0
        .range([innerHeight, 0])
        .nice();

    // Color scale logic for circles (first one darker)
    const circleColor = (indexInStack) => {
        return indexInStack === 0 ? fillStyle.primaryAccentDarker : fillStyle.primaryAccent;
    };

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);
    
    const xAxis = d3.axisBottom(xScale)
        .tickSize(0)
        .tickPadding(10)
        .tickValues(xScale.domain().filter((d, i) => {
            // Dynamic tick filtering: show a reasonable number of ticks
            const maxTicks = Math.floor(innerWidth / 80); // Approx 80px per tick
            const totalTicks = xScale.domain().length;
            if (totalTicks <= maxTicks) return true;
            const skipInterval = Math.ceil(totalTicks / maxTicks);
            return i % skipInterval === 0;
        }));


    xAxisGroup.call(xAxis)
        .selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) { // Check for label rotation
            const labelText = String(d);
            const textWidth = estimateTextWidth(labelText, {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            });
            if (textWidth > xScale.bandwidth() * 1.03) { // 1.03 to give a little margin
                d3.select(this)
                    .style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-45)");
            } else {
                d3.select(this).style("text-anchor", "middle");
            }
        });

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => formatValue(d) + (yFieldUnit ? ` ${yFieldUnit}` : ''))
        .tickSize(0)
        .tickPadding(10);

    yAxisGroup.call(yAxis)
        .call(g => g.select(".domain").remove()) // Remove Y-axis line
        .selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // Block 8: Main Data Visualization Rendering
    const circleRadius = xScale.bandwidth() / 2;
    const circleSpacing = 2; // Spacing between circles in a stack

    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "mark bar-group") // Added 'mark' class
        .attr("transform", d => `translate(${xScale(d.category) + xScale.bandwidth() / 2}, -10)`); // Original -10 offset

    barGroups.each(function(d) {
        const group = d3.select(this);
        const barTopY = yScale(d.value);
        const barBottomY = innerHeight; // yScale(0)
        const totalHeightForCircles = barBottomY - barTopY;
        const circleDiameterWithSpacing = circleRadius * 2 + circleSpacing;

        if (totalHeightForCircles <= 0 || circleDiameterWithSpacing <=0) return; // No space for circles or invalid radius/spacing

        const numCircles = Math.floor(totalHeightForCircles / circleDiameterWithSpacing);

        for (let i = 0; i < numCircles; i++) {
            group.append("circle")
                .attr("class", "mark value") // Added 'mark' and 'value' classes
                .attr("r", circleRadius)
                .attr("cx", 0) // Centered in the band by group transform
                .attr("cy", innerHeight - i * circleDiameterWithSpacing - circleRadius - (circleSpacing/2) ) // Position from bottom up, adjusted for radius and spacing
                .attr("fill", circleColor(i));
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations or interactive elements in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}