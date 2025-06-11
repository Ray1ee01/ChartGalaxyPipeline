/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
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
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is external to this function)

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data.data;
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Assuming data.colors, not data.colors_dark for now
    const imagesInput = data.images || {}; // Extracted as per requirements, though not used in this chart
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldDef = dataColumns.find(col => col.role === "x");
    const yFieldDef = dataColumns.find(col => col.role === "y");

    const xFieldName = xFieldDef ? xFieldDef.name : undefined;
    const yFieldName = yFieldDef ? yFieldDef.name : undefined;

    if (!xFieldName || !yFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push("x-role field (e.g., 'category')");
        if (!yFieldName) missingFields.push("y-role field (e.g., 'value')");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')} from data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {}
    };

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.labelFontFamily = (typographyInput.label && typographyInput.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (typographyInput.label && typographyInput.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (typographyInput.label && typographyInput.label.font_weight) || defaultTypography.label.font_weight;

    // Example for other typography styles if they were to be used:
    // fillStyle.typography.titleFontFamily = (typographyInput.title && typographyInput.title.font_family) || defaultTypography.title.font_family;
    // fillStyle.typography.titleFontSize = (typographyInput.title && typographyInput.title.font_size) || defaultTypography.title.font_size;
    // fillStyle.typography.titleFontWeight = (typographyInput.title && typographyInput.title.font_weight) || defaultTypography.title.font_weight;

    fillStyle.barPrimaryColor = (colorsInput.other && colorsInput.other.primary) || "#1f77b4"; // Default D3 blue
    fillStyle.barPrimaryDarkerColor = d3.rgb(fillStyle.barPrimaryColor).darker(0.7).toString();
    fillStyle.textColor = colorsInput.text_color || "#333333";
    fillStyle.backgroundColor = colorsInput.background_color || "#FFFFFF"; // Default SVG background

    function estimateTextWidth(text, fontProps) {
        if (!text || typeof text !== 'string') return 0;
        // Create a temporary SVG element in memory to measure text
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText); 
        // Note: Appending to the document body is not necessary for getBBox on <text> elements.
        const width = tempText.getBBox().width;
        return width;
    }

    const formatValue = (value) => { // Preserving original formatting logic
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
    const containerWidth = variables.width || 800;  // Default width if not specified
    const containerHeight = variables.height || 600; // Default height if not specified

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-svg-root");

    const chartMargins = {
        top: 50,
        right: 30,
        bottom: 80, // Adjusted for potential rotated X-axis labels
        left: 60    // Adjusted for Y-axis labels and values
    };
    
    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated chart dimensions (innerWidth or innerHeight) are not positive. Review container size and margins.");
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Chart dimensions are too small to render.</div>`);
        return null;
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    if (!chartDataArray || chartDataArray.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No data available to display.")
            .attr("class", "text label empty-data-message");
        return svgRoot.node();
    }
    
    const processedChartData = chartDataArray.map(d => ({
        category: String(d[xFieldName]), // Ensure category is a string for scale domain
        value: +d[yFieldName]            // Ensure value is a number
    }));

    const xUnit = (xFieldDef && xFieldDef.unit && xFieldDef.unit !== "none") ? " " + xFieldDef.unit : "";
    const yUnit = (yFieldDef && yFieldDef.unit && yFieldDef.unit !== "none") ? " " + yFieldDef.unit : "";

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedChartData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3); // Padding between bars

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedChartData, d => d.value) || 0]) // Handle empty or all-zero data
        .range([innerHeight, 0])
        .nice(); // Extend domain to nice round values

    const barColor = (d, i) => {
        // Preserving original logic: first bar darker, others primary color.
        return i === 0 ? fillStyle.barPrimaryDarkerColor : fillStyle.barPrimaryColor;
    };

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGenerator = d3.axisBottom(xScale)
        .tickSize(0)       // No tick lines
        .tickPadding(10);  // Padding between tick and label

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxisGenerator);

    xAxisGroup.selectAll(".tick text") // Select all text elements within ticks
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d + xUnit); // Append xUnit to tick labels

    // X-axis label rotation logic
    let rotateXLabels = false;
    const maxLabelWidthAllowed = xScale.bandwidth(); // Max width is the band width for each category

    xAxisGroup.selectAll(".tick text").each(function(tickValue) {
        // 'this' refers to the <text> element
        const textContent = d3.select(this).text(); // Get current text content (category + unit)
        const textWidth = estimateTextWidth(textContent, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (textWidth > maxLabelWidthAllowed) {
            rotateXLabels = true;
        }
    });

    if (rotateXLabels) {
        xAxisGroup.selectAll(".tick text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");
    } else {
        xAxisGroup.selectAll(".tick text")
            .style("text-anchor", "middle");
    }
    
    const yAxisGenerator = d3.axisLeft(yScale)
        .ticks(Math.max(2, Math.min(10, Math.floor(innerHeight / 40)))) // Dynamic ticks based on height, min 2
        .tickFormat(d => formatValue(d) + yUnit)
        .tickSize(0)      // No tick lines
        .tickPadding(10); // Padding between tick and label

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxisGenerator);

    yAxisGroup.select(".domain").remove(); // Remove the Y-axis domain line

    yAxisGroup.selectAll(".tick text") // Select all text elements within ticks
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar-mark")
        .data(processedChartData)
        .enter()
        .append("rect")
        .attr("class", "mark value bar-mark") // Standardized class
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(Math.max(0, d.value))) // Ensure y is not above chart for 0 or negative values
        .attr("width", xScale.bandwidth())
        .attr("height", d => Math.max(0, innerHeight - yScale(Math.max(0, d.value)))) // Ensure height is non-negative
        .attr("fill", (d, i) => barColor(d, i));

    const dataLabelElements = mainChartGroup.selectAll(".data-label")
        .data(processedChartData)
        .enter()
        .append("text")
        .attr("class", "text label data-label") // Standardized class
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(Math.max(0, d.value)) - 5) // Position 5px above the bar
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => {
            // Only show label if value is positive and bar is visible enough
            if (d.value > 0 && (innerHeight - yScale(d.value)) > (parseFloat(fillStyle.typography.labelFontSize) / 2) ) { 
                 return formatValue(d.value) + yUnit;
            }
            return ""; // Return empty string if value is not suitable for labeling
        });
        
    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., tooltips, advanced interactions - none in this simplified version)
    // X-axis label rotation logic is handled in Block 7 during axis rendering.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}