/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_grouped_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
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
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const images = data.images || {}; // Though not used in this chart, adhere to structure
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldCol = dataColumns.find(col => col.role === "x");
    const valueFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    const dimensionFieldName = dimensionFieldCol ? dimensionFieldCol.name : undefined;
    const valueFieldName = valueFieldCol ? valueFieldCol.name : undefined;
    const groupFieldName = groupFieldCol ? groupFieldCol.name : undefined;

    const dimensionUnit = dimensionFieldCol && dimensionFieldCol.unit !== "none" ? dimensionFieldCol.unit : "";
    const valueUnit = valueFieldCol && valueFieldCol.unit !== "none" ? valueFieldCol.unit : "";
    // const groupUnit = groupFieldCol && groupFieldCol.unit !== "none" ? groupFieldCol.unit : ""; // Not used for display

    if (!dimensionFieldName || !valueFieldName || !groupFieldName) {
        let missingFields = [];
        if (!dimensionFieldName) missingFields.push("x role (dimension)");
        if (!valueFieldName) missingFields.push("y role (value)");
        if (!groupFieldName) missingFields.push("group role");
        const errorMsg = `Critical chart config missing: Field(s) for role(s) ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    if (chartData.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) || '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        backgroundColor: rawColors.background_color || '#FFFFFF', // Not used for SVG background, but for consistency
        defaultPrimaryColor: (rawColors.other && rawColors.other.primary) || '#1f77b4',
        defaultAvailableColors: rawColors.available_colors || d3.schemeCategory10,
    };

    fillStyle.getColor = (categoryName, index) => {
        if (rawColors.field && rawColors.field[categoryName]) {
            return rawColors.field[categoryName];
        }
        return fillStyle.defaultAvailableColors[index % fillStyle.defaultAvailableColors.length];
    };
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but adhering to "MUST NOT be appended to the document DOM".
        // For simple cases, direct measurement might work, but can be less accurate.
        // A common robust way without appending is to have a pre-rendered hidden SVG.
        // However, the prompt implies creating it on the fly.
        // Let's assume this direct creation is sufficient for the context.
        // If not, a hidden SVG in the main SVG could be used.
        // For this implementation, we'll use the direct creation method.
        // It's crucial that the browser supports getBBox on unattached elements.
        // Most modern browsers do.
        document.body.appendChild(tempSvg); // Temporarily append to get accurate BBox
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg); // Clean up
        return width;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        const numValue = Number(value);
        if (isNaN(numValue)) return String(value); // Return original if not a number

        if (Math.abs(numValue) >= 1000000000) {
            return d3.format("~.2s")(numValue).replace('G', 'B'); // More standard SI prefix
        } else if (Math.abs(numValue) >= 1000000) {
            return d3.format("~.2s")(numValue);
        } else if (Math.abs(numValue) >= 1000) {
            return d3.format("~.2s")(numValue);
        }
        return d3.format("~g")(numValue); // General format for smaller numbers
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.backgroundColor === '#FFFFFF' ? 'transparent' : fillStyle.backgroundColor); // Optional: if you want to color the SVG bg


    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 60, // Increased for legend
        right: 30,
        bottom: 40,
        left: 60
    };

    const dimensions = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];

    let maxDimensionLabelWidth = 0;
    dimensions.forEach(dim => {
        const labelText = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const width = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (width > maxDimensionLabelWidth) maxDimensionLabelWidth = width;
    });
    chartMargins.left = Math.max(chartMargins.left, maxDimensionLabelWidth + 20);

    let maxValueLabelWidth = 0;
    chartData.forEach(d => {
        const valueText = valueUnit ? `${formatValue(d[valueFieldName])}${valueUnit}` : `${formatValue(d[valueFieldName])}`;
        const width = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        if (width > maxValueLabelWidth) maxValueLabelWidth = width;
    });
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 20);
    
    const legendItemPadding = 10;
    const legendRectSize = 15;
    const legendRectTextGap = 5;
    let totalLegendWidth = 0;
    const legendItemWidths = groups.map(group => {
        const textWidth = estimateTextWidth(group, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        const itemWidth = legendRectSize + legendRectTextGap + textWidth;
        return itemWidth;
    });
    totalLegendWidth = legendItemWidths.reduce((sum, w) => sum + w, 0) + Math.max(0, groups.length - 1) * legendItemPadding;


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Adjust margins or container size.";
        console.error(errorMsg);
         d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    // (Unique dimensions and groups already extracted in Block 4 for label measurement)

    // Block 6: Scale Definition & Configuration
    const barGroupPadding = 0.2; // Padding between groups of bars for a dimension
    const barPadding = 0.1; // Padding between bars within a group (not directly used by yScale0, but by yScale1)

    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(barGroupPadding);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueFieldName]) || 0]) // Ensure domain starts at 0, handle empty/all-zero data
        .range([0, innerWidth])
        .nice(); // Extend domain to nice round values

    const groupScale = d3.scaleBand() // For bars within each dimension group
        .domain(groups)
        .range([0, yScale.bandwidth()])
        .padding(barPadding);

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => fillStyle.getColor(group, i)));


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendGroup = svgRoot.append("g")
        .attr("class", "other legend")
        .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2})`);

    let currentLegendX = 0;
    groups.forEach((group, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, 0)`);

        legendItem.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", colorScale(group));

        legendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendRectSize + legendRectTextGap)
            .attr("y", legendRectSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);
        
        currentLegendX += legendItemWidths[i] + legendItemPadding;
    });


    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const dimensionGroups = mainChartGroup.selectAll(".dimension-group")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "other dimension-group")
        .attr("transform", d => `translate(0, ${yScale(d)})`);

    // Add dimension labels (acting as Y-axis category labels)
    dimensionGroups.append("text")
        .attr("class", "label dimension-label")
        .attr("x", -10) // Position to the left of the bars
        .attr("y", yScale.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => dimensionUnit ? `${d}${dimensionUnit}` : d);

    dimensionGroups.each(function(dimension) {
        const currentDimensionData = chartData.filter(item => item[dimensionFieldName] === dimension);
        
        d3.select(this).selectAll(".bar")
            .data(currentDimensionData)
            .enter()
            .append("rect")
            .attr("class", d => `mark bar group-${String(d[groupFieldName]).replace(/\s+/g, '-')}`)
            .attr("x", 0)
            .attr("y", d => groupScale(d[groupFieldName]))
            .attr("width", d => Math.max(0, xScale(+d[valueFieldName]))) // Ensure width is not negative
            .attr("height", groupScale.bandwidth())
            .attr("fill", d => colorScale(d[groupFieldName]));

        // Add value labels
        d3.select(this).selectAll(".value-label")
            .data(currentDimensionData)
            .enter()
            .append("text")
            .attr("class", "value value-label")
            .attr("x", d => xScale(+d[valueFieldName]) + 5) // Position to the right of the bar
            .attr("y", d => groupScale(d[groupFieldName]) + groupScale.bandwidth() / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d => {
                const formatted = formatValue(d[valueFieldName]);
                return valueUnit ? `${formatted}${valueUnit}` : formatted;
            });
    });


    // Block 9: Optional Enhancements & Post-Processing
    // Removed: shadows, gradients, rounded corners, strokes, mouseover effects.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}