/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_plain_chart_05",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 300,
  "min_width": 300,
  "background": "no",

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is now external to the function)

    // Block 1: Configuration Parsing & Validation
    const chartRawData = data && data.data && data.data.data;
    const variables = (data && data.variables) || {};
    const inputTypography = (data && data.typography) || {};
    const inputColors = (data && data.colors) || {}; // Assuming data.colors, not data.colors_dark
    const inputImages = (data && data.images) || {}; // Parsed but not used in this chart
    const dataColumns = (data && data.data && data.data.columns) || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const valueFieldUnitInfo = dataColumns.find(col => col.role === "y");
    let valueFieldUnit = "";
    if (valueFieldUnitInfo && valueFieldUnitInfo.unit && valueFieldUnitInfo.unit !== "none") {
        valueFieldUnit = valueFieldUnitInfo.unit;
    }

    if (!categoryFieldName || !valueFieldName) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push("category field (role 'x')");
        if (!valueFieldName) missingFields.push("value field (role 'y')");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    if (!chartRawData || chartRawData.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.warn(errorMsg); // Use warn for no data, error for config issues
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypographyStyles = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const fillStyle = {
        barColor: (inputColors.other && inputColors.other.primary) || "#4472C4", // Default from original
        labelColor: inputColors.text_color || "#333333", // Default from original
        labelColorInsideBar: "#FFFFFF", // Standard contrast
        backgroundColor: inputColors.background_color || "#FFFFFF", // Default from prompt
        typography: {
            labelFontFamily: (inputTypography.label && inputTypography.label.font_family) || defaultTypographyStyles.label.font_family,
            labelFontSize: (inputTypography.label && inputTypography.label.font_size) || defaultTypographyStyles.label.font_size,
            labelFontWeight: (inputTypography.label && inputTypography.label.font_weight) || defaultTypographyStyles.label.font_weight,
        }
    };

    const labelFontProps = { 
        fontFamily: fillStyle.typography.labelFontFamily, 
        fontSize: fillStyle.typography.labelFontSize, 
        fontWeight: fillStyle.typography.labelFontWeight 
    };
    
    function estimateTextWidth(text, fontProperties) {
        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const tempTextElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tempTextElement.setAttribute("font-family", fontProperties.fontFamily);
        tempTextElement.setAttribute("font-size", fontProperties.fontSize);
        tempTextElement.setAttribute("font-weight", fontProperties.fontWeight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        
        let width = 0;
        try {
            // getBBox should work on SVG elements not attached to the DOM.
            width = tempTextElement.getBBox().width;
        } catch (e) {
            console.warn("SVG getBBox failed for text measurement, falling back to canvas.", e);
            try {
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                context.font = `${fontProperties.fontWeight} ${fontProperties.fontSize} ${fontProperties.fontFamily}`;
                width = context.measureText(text).width;
            } catch (e2) {
                console.error("Canvas text measurement also failed.", e2);
                width = text.length * (parseInt(fontProperties.fontSize) || 12) * 0.6; // Very rough fallback
            }
        }
        return width;
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (Math.abs(value) >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (Math.abs(value) >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800; 
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-svg-root");


    // Block 4: Core Chart Dimensions & Layout Calculation
    // Using original margins to preserve visual output as much as possible.
    const chartMargins = { top: 50, right: 60, bottom: 80, left: 40 }; 

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <=0 || innerHeight <= 0) {
        console.error("Calculated chart dimensions (innerWidth or innerHeight) are not positive. Aborting rendering.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Chart dimensions are too small to render.</div>");
        return null;
    }

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");


    // Block 5: Data Preprocessing & Transformation
    const processedData = chartRawData.map(d => ({
        category: d[categoryFieldName] === null || d[categoryFieldName] === undefined ? "N/A" : String(d[categoryFieldName]),
        value: +d[valueFieldName] || 0 // Ensure value is numeric, default to 0 if parsing fails
    })).sort((a, b) => b.value - a.value); // Sort descending by value


    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerHeight])
        .padding(0.3);

    const xMax = d3.max(processedData, d => d.value);
    const xScale = d3.scaleLinear()
        .domain([0, xMax > 0 ? xMax : 1]) // Ensure domain has positive extent
        .range([0, innerWidth])
        .nice();


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // (No axes or gridlines as per requirements)


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar") 
        .attr("y", d => yScale(d.category))
        .attr("x", 0)
        .attr("height", yScale.bandwidth())
        .attr("width", d => xScale(Math.max(0, d.value))) // Ensure width is not negative
        .attr("fill", fillStyle.barColor);

    const labelGroups = mainChartGroup.selectAll(".data-labels-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "data-labels-group")
        .attr("transform", d => `translate(0, ${yScale(d.category) + yScale.bandwidth() / 2})`);

    labelGroups.each(function(d) {
        const group = d3.select(this);
        const barWidth = xScale(Math.max(0, d.value));
        
        const categoryText = d.category; // Already stringified in processedData
        const valueText = formatValue(d.value) + (valueFieldUnit ? ` ${valueFieldUnit}` : '');

        const categoryTextWidth = estimateTextWidth(categoryText, labelFontProps);
        
        const paddingInside = 10;
        const paddingOutside = 5;
        const spaceBetweenCategoryAndValue = 10; // Space between category and value if both are outside

        if (categoryTextWidth + paddingInside * 2 <= barWidth) {
            // Category label inside bar
            group.append("text")
                .attr("class", "label category-label")
                .attr("x", paddingInside)
                .attr("dy", ".35em") // Vertical centering
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.labelColorInsideBar)
                .text(categoryText);

            // Value label outside bar, to the right
            group.append("text")
                .attr("class", "value value-label")
                .attr("x", barWidth + paddingOutside)
                .attr("dy", ".35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.labelColor)
                .text(valueText);
        } else {
            // Category label outside bar, to the right
            group.append("text")
                .attr("class", "label category-label")
                .attr("x", barWidth + paddingOutside)
                .attr("dy", ".35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.labelColor)
                .text(categoryText);
            
            // Value label outside bar, to the right of category label
            group.append("text")
                .attr("class", "value value-label")
                .attr("x", barWidth + paddingOutside + categoryTextWidth + spaceBetweenCategoryAndValue)
                .attr("dy", ".35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.labelColor)
                .text(valueText);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None for this chart)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}