/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_3",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal bar chart.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;

    if (!categoryFieldName || !valueFieldName) {
        const errorMessage = `Critical chart config missing: ${!categoryFieldName ? "x-field (category) " : ""}${!valueFieldName ? "y-field (value)" : ""}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>${errorMessage}</div>`);
        }
        return null;
    }

    const categoryFieldUnit = (dataColumns.find(col => col.role === "x" && col.unit !== "none") || {}).unit || "";
    const valueFieldUnit = (dataColumns.find(col => col.role === "y" && col.unit !== "none") || {}).unit || "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        barPrimaryColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#D32F2F',
        // For the gradient effect, derive a lighter shade or use a secondary if available
        barSecondaryColor: (colorsConfig.other && colorsConfig.other.secondary) ? colorsConfig.other.secondary : d3.interpolateRgb((colorsConfig.other && colorsConfig.other.primary) || '#D32F2F', "#ffffff")(0.6),
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        tempText.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        tempText.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but for strict adherence to "MUST NOT be appended to the document DOM",
        // this might be less accurate or fail in some environments.
        // A common robust approach involves a hidden, absolutely positioned SVG in the DOM.
        // However, sticking to the letter of the directive:
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback if getBBox is not available (e.g., in a pure JS environment without a full SVG rendering engine)
            return text ? text.length * (parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6) : 0;
        }
    }
    
    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace(/G/, "B"); // Use "B" for billions
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value).replace(/M/, "M");
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value).replace(/k/, "K");
        }
        return d3.format("~g")(value);
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root-svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 60, bottom: 50, left: 150 }; // Adjusted left for potential long labels/icons
    
    // Adjust left margin dynamically if icons are present and many categories
    // This is a simple heuristic; more complex logic might be needed for perfect fitting.
    const maxCategoryLabelWidth = d3.max(chartDataArray, d => estimateTextWidth(d[categoryFieldName], {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    })) || 60;

    let yAxisIconSize = 0;
    let yAxisIconPadding = 0;
    const hasIcons = chartDataArray.some(d => imagesConfig.field && imagesConfig.field[d[categoryFieldName]]);

    if (hasIcons) {
        yAxisIconPadding = 10; // Space between icon and text, and icon and axis line
        // Estimate icon size based on a fraction of typical bar height, then update margin
        // This is tricky without knowing yScale.bandwidth() yet.
        // Let's assume a typical icon size for margin calculation for now.
        yAxisIconSize = 20; // Placeholder, will be refined later
        chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + yAxisIconSize + 2 * yAxisIconPadding + 10);
    } else {
        chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + 10);
    }
    chartMargins.right = Math.max(chartMargins.right, d3.max(chartDataArray, d => estimateTextWidth(formatValue(d[valueFieldName]) + (valueFieldUnit ? ` ${valueFieldUnit}` : ''), {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    })) || 40) + 10; // Space for value labels


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataArray.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure value is numeric
    })).sort((a, b) => b.value - a.value); // Sort by value descending

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerHeight])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 0]) // Ensure domain starts at 0
        .range([0, innerWidth])
        .nice();

    const colorScale = d3.scaleLinear()
        .domain([0, processedData.length > 1 ? processedData.length - 1 : 1]) // Handle single item case
        .range([fillStyle.barPrimaryColor, fillStyle.barSecondaryColor]);

    // Refine icon size based on actual band width
    if (hasIcons) {
        yAxisIconSize = yScale.bandwidth() * 0.7;
    }


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxis = d3.axisBottom(xScale)
        .ticks(Math.max(2, Math.min(5, Math.floor(innerWidth / 80)))) // Dynamic number of ticks
        .tickFormat(d => formatValue(d) + (valueFieldUnit ? ` ${valueFieldUnit}` : ''))
        .tickSize(0)
        .tickPadding(10);

    mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove()) // Remove axis line
        .selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("opacity", 0); // Hide X-axis text as per original

    const yAxis = d3.axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10); // Initial padding

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis)
        .call(g => g.select(".domain").remove()); // Remove axis line

    yAxisGroup.selectAll(".tick").each(function(d_category) {
        const tick = d3.select(this);
        const textElement = tick.select("text");
        
        textElement
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "label");

        const iconUrl = imagesConfig.field && imagesConfig.field[d_category] ? imagesConfig.field[d_category] : null;

        if (iconUrl && yAxisIconSize > 0) {
            tick.append("image")
                .attr("class", "icon y-axis-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", -yAxisIconSize - yAxisIconPadding)
                .attr("y", -yAxisIconSize / 2)
                .attr("width", yAxisIconSize)
                .attr("height", yAxisIconSize);
            
            textElement.attr("x", -yAxisIconSize - (2 * yAxisIconPadding)); // Adjust text position
        } else {
            // Standard padding if no icon
            textElement.attr("x", -yAxisIconPadding);
        }
    });


    // Block 8: Main Data Visualization Rendering
    mainChartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar")
        .attr("y", d => yScale(d.category))
        .attr("x", 0)
        .attr("height", yScale.bandwidth())
        .attr("width", d => xScale(Math.max(0, d.value))) // Ensure width is not negative
        .attr("fill", (d, i) => colorScale(i));

    mainChartGroup.selectAll(".value-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label value-label")
        .attr("y", d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr("x", d => xScale(Math.max(0, d.value)) + 5) // Position to the right of the bar
        .attr("dy", ".35em") // Vertical alignment
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "start")
        .text(d => formatValue(d.value) + (valueFieldUnit ? ` ${valueFieldUnit}` : ''));

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects like shadows or SVG gradients are applied.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}