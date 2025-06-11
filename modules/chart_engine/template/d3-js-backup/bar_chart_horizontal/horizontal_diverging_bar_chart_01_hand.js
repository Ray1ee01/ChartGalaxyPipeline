/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 15], ["-inf", "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "ascending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    // const imagesConfig = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!dimensionFieldName || !valueFieldName) {
        const missingFields = [];
        if (!dimensionFieldName) missingFields.push("dimension field (role: x)");
        if (!valueFieldName) missingFields.push("value field (role: y)");
        const errorMsg = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    
    // Validate that chartDataArray is an array and has data
    if (!Array.isArray(chartDataArray) || chartDataArray.length === 0) {
        const errorMsg = "Chart data is missing or not an array. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    
    // Ensure essential data fields exist in data points
    const firstDataItem = chartDataArray[0];
    if (typeof firstDataItem[dimensionFieldName] === 'undefined' || typeof firstDataItem[valueFieldName] === 'undefined') {
        const errorMsg = `Data items are missing required fields ('${dimensionFieldName}', '${valueFieldName}'). Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyConfig.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyConfig.label?.font_size || "12px",
            labelFontWeight: typographyConfig.label?.font_weight || "normal",
            annotationFontFamily: typographyConfig.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyConfig.annotation?.font_size || "10px",
            annotationFontWeight: typographyConfig.annotation?.font_weight || "normal",
        },
        positiveBarColor: colorsConfig.other?.primary || "#4682B4", // Default SteelBlue
        negativeBarColor: colorsConfig.other?.secondary || "#5F9EA0", // Default CadetBlue
        textColor: colorsConfig.text_color || "#333333",
        centerLineColor: colorsConfig.other?.axis_line_color || "#000000", // Default black for center line
        chartBackground: colorsConfig.background_color || "none", // Default transparent
    };

    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.style.fontFamily = fontProps.fontFamily;
        tempTextElement.style.fontSize = fontProps.fontSize;
        tempTextElement.style.fontWeight = fontProps.fontWeight;
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // Document body append/remove is not strictly necessary for getBBox on modern browsers if SVG has explicit size or text is simple
        // but to be safe for all environments, one might briefly append it.
        // For this refactor, assuming direct getBBox on non-DOM element works.
        return tempTextElement.getBBox().width;
    };

    const formatValue = (value) => {
        const valueUnit = dataColumns.find(col => col.name === valueFieldName)?.unit || "";
        let displayUnit = valueUnit !== "none" ? valueUnit : "";
        if (value === null || typeof value === 'undefined') return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B') + displayUnit;
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value) + displayUnit;
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value) + displayUnit;
        }
        return d3.format("~g")(value) + displayUnit;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const labelPadding = 5; // Padding between dimension label and center line
    const valuePadding = 5; // Padding between bar end and value label

    let maxDimensionLabelWidth = 0;
    chartDataArray.forEach(d => {
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, estimateTextWidth(d[dimensionFieldName], {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        }));
    });

    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const formattedVal = (d[valueFieldName] >= 0 ? "+" : "") + formatValue(d[valueFieldName]);
        maxValueLabelWidth = Math.max(maxValueLabelWidth, estimateTextWidth(formattedVal, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        }));
    });
    
    const chartMargins = {
        top: 20,
        right: maxValueLabelWidth + valuePadding + 10, // Space for value labels on positive side
        bottom: 20,
        left: maxValueLabelWidth + valuePadding + 10   // Space for value labels on negative side
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth < 2 * (maxDimensionLabelWidth + labelPadding) + 20) { // 20 for some minimal bar length
        const errorMsg = "Calculated innerWidth is too small to render the chart meaningfully. Increase container width or shorten labels.";
        console.warn(errorMsg); // Warn instead of error, try to render but might look bad.
        // Optionally, could display this message in the container.
    }


    // Block 5: Data Preprocessing & Transformation
    chartDataArray.sort((a, b) => a[valueFieldName] - b[valueFieldName]);
    const sortedDimensions = chartDataArray.map(d => d[dimensionFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(0.25); // Fixed bar padding

    const valueExtent = d3.extent(chartDataArray, d => d[valueFieldName]);
    const domainMin = Math.min(0, valueExtent[0] || 0);
    const domainMax = Math.max(0, valueExtent[1] || 0);

    const xScale = d3.scaleLinear()
        .domain([domainMin, domainMax])
        .range([0, innerWidth])
        .nice(); // Use nice() to make the domain end on round values if possible

    const centerPointX = xScale(0);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    if (domainMin < 0 && domainMax > 0) { // Only draw center line if data spans zero
         mainChartGroup.append("line")
            .attr("class", "axis center-axis-line")
            .attr("x1", centerPointX)
            .attr("y1", 0)
            .attr("x2", centerPointX)
            .attr("y2", innerHeight)
            .attr("stroke", fillStyle.centerLineColor)
            .attr("stroke-width", 1)
            .style("opacity", 0.7);
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barHeight = yScale.bandwidth();

    chartDataArray.forEach(d => {
        const value = d[valueFieldName];
        const dimension = d[dimensionFieldName];
        
        if (typeof value !== 'number' || isNaN(value)) {
            console.warn(`Skipping data point with invalid value: ${dimension}, ${value}`);
            return; 
        }

        const barY = yScale(dimension);
        if (typeof barY === 'undefined') { // Should not happen if dimensionFieldName is correct
            console.warn(`Skipping data point with unmapped dimension: ${dimension}`);
            return;
        }

        let barX, barWidth;
        const barColor = value >= 0 ? fillStyle.positiveBarColor : fillStyle.negativeBarColor;

        if (value >= 0) {
            barX = centerPointX;
            barWidth = xScale(value) - centerPointX;
        } else {
            barX = xScale(value);
            barWidth = centerPointX - xScale(value);
        }
        
        // Ensure barWidth is not negative due to float precision with xScale(0)
        if (barWidth < 0) barWidth = 0;

        mainChartGroup.append("rect")
            .attr("class", "mark bar")
            .attr("x", barX)
            .attr("y", barY)
            .attr("width", barWidth)
            .attr("height", barHeight)
            .attr("fill", barColor);

        // Dimension Labels (near center line)
        const dimensionLabelX = value >= 0 ? centerPointX - labelPadding : centerPointX + labelPadding;
        const dimensionTextAnchor = value >= 0 ? "end" : "start";

        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", dimensionLabelX)
            .attr("y", barY + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", dimensionTextAnchor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(dimension);

        // Value Labels (at the end of bars)
        const formattedValueText = (value >= 0 ? "+" : "") + formatValue(value);
        const valueLabelX = value >= 0 ? xScale(value) + valuePadding : xScale(value) - valuePadding;
        const valueTextAnchor = value >= 0 ? "start" : "end";

        mainChartGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", valueLabelX)
            .attr("y", barY + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", valueTextAnchor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedValueText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations, icons, or complex interactions in this refactor.
    // Removed svg2roughjs logic.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}