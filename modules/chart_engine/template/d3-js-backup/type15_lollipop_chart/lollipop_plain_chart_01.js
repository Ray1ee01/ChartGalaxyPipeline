/* REQUIREMENTS_BEGIN
{
  "chart_type": "Lollipop Chart",
  "chart_name": "lollipop_plain_chart_01",
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
  "xAxis": "visible",
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
    const chartData = data.data.data;
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    // const imagesInput = data.images || {}; // Not used in this chart
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    let valueUnit = "";
    if (valueFieldDef && valueFieldDef.unit !== "none") {
        valueUnit = valueFieldDef.unit;
    }

    if (!dimensionField || !valueField) {
        const missingFields = [];
        if (!dimensionField) missingFields.push("x-role field");
        if (!valueField) missingFields.push("y-role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '14px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'bold',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '12px', // Base for axis, unit
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal', // Base for axis, unit
            valueLabelInCircleFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'bold', // For value in circle
        },
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF', // Not directly used on SVG, but good to have
        primaryColor: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#F7941D',
        valueLabelColorOnPrimary: '#FFFFFF', // Color for text on primary-colored elements
        gridLineColor: '#e0e0e0',
    };

    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox if not using a library.
        // However, for this context, direct creation is requested.
        // For robustness in all browsers, one might need to briefly append to DOM.
        // document.body.appendChild(svg);
        const width = textElement.getBBox().width;
        // document.body.removeChild(svg);
        return width;
    };
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
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
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Optional: set background if needed

    const chartMargins = { top: 30, right: 40, bottom: 50, left: 60 };
    // Adjust left margin based on longest dimension label
    let maxLabelWidth = 0;
    if (chartData.length > 0) {
        chartData.forEach(d => {
            const labelWidth = estimateTextWidth(d[dimensionField], fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            if (labelWidth > maxLabelWidth) {
                maxLabelWidth = labelWidth;
            }
        });
        chartMargins.left = Math.max(chartMargins.left, maxLabelWidth + 10); // Add some padding
    }
    
    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(0.3); // Increased padding for better separation

    const rowHeight = yScale.bandwidth();
    const lollipopStickThickness = Math.max(2, Math.min(rowHeight * 0.15, 6)); // Thinner stick
    const lollipopCircleRadius = Math.max(5, Math.min(rowHeight * 0.35, 15)); // Circle radius based on row height

    const maxValue = d3.max(sortedData, d => +d[valueField]);
    const xScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue * 1.1 : 10]) // Ensure domain is at least 0-10 if max is 0
        .range([0, innerWidth - lollipopCircleRadius]); // Ensure circle fits within innerWidth

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Gridlines
    const gridValues = xScale.ticks(5);
    mainChartGroup.append("g")
        .attr("class", "gridlines")
        .selectAll("line.gridline")
        .data(gridValues)
        .enter()
        .append("line")
        .attr("class", "gridline")
        .attr("x1", d => xScale(d))
        .attr("y1", 0)
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // X-Axis
    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickSizeOuter(0) // Remove outer ticks
        .tickPadding(8)
        .tickFormat(d => formatValue(d));

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.select(".domain").remove(); // Remove axis line
    xAxisGroup.selectAll(".tick text")
        .attr("class", "value")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor);

    // Block 8: Main Data Visualization Rendering
    const lollipopGroup = mainChartGroup.append("g").attr("class", "lollipop-elements");

    sortedData.forEach((d, i) => {
        const dimension = d[dimensionField];
        const value = +d[valueField];
        const yPos = yScale(dimension) + yScale.bandwidth() / 2; // Center of the band
        const lineEndX = xScale(value);

        // Lollipop Line
        lollipopGroup.append("line")
            .attr("class", "mark lollipop-line")
            .attr("x1", 0)
            .attr("y1", yPos)
            .attr("x2", lineEndX)
            .attr("y2", yPos)
            .attr("stroke", fillStyle.primaryColor)
            .attr("stroke-width", lollipopStickThickness);

        // Dimension Label
        mainChartGroup.append("text") // Append to mainChartGroup to be to the left of lollipops
            .attr("class", "label dimension-label")
            .attr("x", -5) // Position to the left of the axis origin
            .attr("y", yPos)
            .attr("dy", "0.35em") // Vertical centering
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(dimension);

        // Lollipop Circle
        lollipopGroup.append("circle")
            .attr("class", "mark lollipop-circle")
            .attr("cx", lineEndX)
            .attr("cy", yPos)
            .attr("r", lollipopCircleRadius)
            .attr("fill", fillStyle.primaryColor);

        // Value Label inside Circle
        const formattedValue = formatValue(value);
        const valueLabelFontSize = Math.min(lollipopCircleRadius * 1.0, Math.max(lollipopCircleRadius * 0.6, 9)); // Adjusted scaling
        
        lollipopGroup.append("text")
            .attr("class", "value value-label-in-circle")
            .attr("x", lineEndX)
            .attr("y", yPos)
            .attr("dy", "0.35em") // Vertical centering
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${valueLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.valueLabelInCircleFontWeight)
            .style("fill", fillStyle.valueLabelColorOnPrimary)
            .text(formattedValue);

        // Unit Label (only for the first item if unit exists)
        if (i === 0 && valueUnit) {
            const unitLabelX = lineEndX; 
            const unitLabelY = yPos - lollipopCircleRadius - 5; // Position above the first circle
            
            // Check if unit label would go off top
            const finalUnitLabelY = unitLabelY < -chartMargins.top + 15 ? yPos + lollipopCircleRadius + 15 : unitLabelY;


            mainChartGroup.append("text") // Append to mainChartGroup for consistent positioning relative to chart area
                .attr("class", "text unit-label")
                .attr("x", unitLabelX)
                .attr("y", finalUnitLabelY)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(`(${valueUnit})`);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements for this chart version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}