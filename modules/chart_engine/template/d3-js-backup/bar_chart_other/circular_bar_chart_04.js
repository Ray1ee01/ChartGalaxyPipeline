/* REQUIREMENTS_BEGIN
{
  "chart_type": "Circular Bar Chart",
  "chart_name": "circular_bar_chart_04",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[5,10], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary", "text_color"],
  "min_height": 500,
  "min_width": 500,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
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
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Could be data.colors_dark for dark themes, adapt if needed
    const imagesInput = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMessage = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        return null;
    }

    let valueUnit = "";
    const valueColumn = dataColumns.find(col => col.role === "y");
    if (valueColumn && valueColumn.unit && valueColumn.unit !== "none") {
        valueUnit = valueColumn.unit;
    }
    if (valueUnit.length > 6) { // Specific business rule from original
        valueUnit = '';
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography tokens
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.labelFontFamily = (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : defaultTypography.label.font_weight;

    fillStyle.typography.annotationFontFamily = (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : defaultTypography.annotation.font_weight;

    // Color tokens
    fillStyle.colors.dataBarColor = (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#dcd5dd';
    fillStyle.colors.backgroundBarColor = (colorsInput.other && colorsInput.other.secondary) ? colorsInput.other.secondary : '#59575a';
    fillStyle.colors.centralCircleStrokeColor = (colorsInput.other && colorsInput.other.accent) ? colorsInput.other.accent : '#4a4a4a'; // Assuming 'accent' or similar for this
    fillStyle.colors.textColor = colorsInput.text_color || '#000000';
    fillStyle.colors.chartBackgroundColor = colorsInput.background_color || 'transparent'; // SVG default is transparent

    // Helper: Text measurement (not used by this chart's rendering logic, but required by spec)
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // document.body.appendChild(tempSvg); // Temporarily append to DOM for accurate measurement
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth: getBBox failed. Using approximate measurement.", e);
            width = text.length * (parseFloat(fontSize) * 0.6); // Simple approximation
        }
        // tempSvg.remove();
        return width;
    }

    // Helper: Value formatting
    const formatValue = (value) => {
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
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 800;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.colors.chartBackgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartSize = Math.min(containerWidth, containerHeight); // Chart will be square based on smaller dimension
    
    const chartMargins = { // Original margins were fixed at 100
        top: variables.margin_top || 100,
        right: variables.margin_right || 100,
        bottom: variables.margin_bottom || 100,
        left: variables.margin_left || 100
    };

    // Effective drawing area for the circle itself
    const effectiveWidth = chartSize - chartMargins.left - chartMargins.right;
    const effectiveHeight = chartSize - chartMargins.top - chartMargins.bottom;
    
    const centerX = chartSize / 2;
    const centerY = chartSize / 2;
    const radius = Math.min(effectiveWidth, effectiveHeight) / 2;

    const centralCircleRadius = radius * 0.2; // 20% of main radius

    // Block 5: Data Preprocessing & Transformation
    if (chartData.length === 0) {
        svgRoot.append("text")
            .attr("x", centerX)
            .attr("y", centerY)
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.colors.textColor)
            .text("No data available to display.");
        return svgRoot.node();
    }

    const totalItems = chartData.length;
    const anglePerItem = (2 * Math.PI) / totalItems;
    
    const maxValue = d3.max(chartData, d => +d[valueFieldName]);
    const minValue = 0; // Assuming values are non-negative

    // Block 6: Scale Definition & Configuration
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([radius * 0.4, radius * 0.8]); // Bar outer radius range

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    svgRoot.append("circle")
        .attr("class", "other central-guide-circle")
        .attr("cx", centerX)
        .attr("cy", centerY)
        .attr("r", centralCircleRadius)
        .attr("fill", "none")
        .attr("stroke", fillStyle.colors.centralCircleStrokeColor)
        .attr("stroke-width", 1);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const sectorsGroup = svgRoot.append("g")
        .attr("class", "mark-group sectors-group")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    const labelsGroup = svgRoot.append("g")
        .attr("class", "label-group text-group")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    const arcGenerator = d3.arc()
        .innerRadius(centralCircleRadius) // Data bars start from the central circle
        .outerRadius(d => radiusScale(+d.value))
        .cornerRadius(10) // Kept from original
        .padAngle(0.04);  // Kept from original

    const outerArcGenerator = d3.arc()
        .innerRadius(centralCircleRadius) // Background bars also start from central circle
        .outerRadius(radius) // Background bars extend to full radius
        .cornerRadius(10) // Kept from original
        .padAngle(0.04);  // Kept from original

    chartData.forEach((d, i) => {
        const startAngle = i * anglePerItem - Math.PI / 2; // Start at 12 o'clock
        const endAngle = startAngle + anglePerItem;
        const midAngle = startAngle + (anglePerItem / 2);

        // Background Sector
        sectorsGroup.append("path")
            .attr("class", "mark background-mark")
            .attr("d", outerArcGenerator({ startAngle: startAngle, endAngle: endAngle }))
            .attr("fill", fillStyle.colors.backgroundBarColor)
            .style("stroke", "none");

        // Data Sector
        sectorsGroup.append("path")
            .attr("class", "mark data-mark")
            .datum({ startAngle: startAngle, endAngle: endAngle, value: d[valueFieldName] })
            .attr("d", arcGenerator)
            .attr("fill", fillStyle.colors.dataBarColor)
            .attr("stroke", "none");

        // Label Positioning (radially outside, near edge)
        const labelRadiusOffset = 30; // How far from the main radius edge
        const labelPositionRadius = radius - labelRadiusOffset; 
        const labelX = Math.sin(midAngle) * labelPositionRadius;
        const labelY = -Math.cos(midAngle) * labelPositionRadius;
        
        const textAnchor = (midAngle > Math.PI/2 && midAngle < 3*Math.PI/2) ? "end" : "start";
        let dominantBaseline = "middle";
        // Adjust baseline for labels near top/bottom to prevent collision if text is long
        if (Math.abs(Math.cos(midAngle)) < 0.1) { // Near horizontal
             dominantBaseline = "middle";
        } else if (Math.cos(midAngle) > 0) { // Bottom half
             dominantBaseline = "hanging";
        } else { // Top half
             dominantBaseline = "alphabetic"; // Or 'ideographic' / 'bottom'
        }


        // Category Label
        labelsGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle") // Original used middle, keeping for consistency
            .attr("dominant-baseline", "middle") // Original used middle
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.colors.textColor)
            .text(d[categoryFieldName]);

        // Value Label (positioned below category label)
        const valueLabelOffsetY = parseFloat(fillStyle.typography.labelFontSize) * 1.2; // Offset based on category font size
        const valueX = labelX;
        const valueY = labelY + valueLabelOffsetY;
        const formattedValue = `${formatValue(d[valueFieldName])}${valueUnit}`;
        
        labelsGroup.append("text")
            .attr("class", "value data-value-label")
            .attr("x", valueX)
            .attr("y", valueY)
            .attr("text-anchor", "middle") // Original used middle
            .attr("dominant-baseline", "middle") // Original used middle
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", fillStyle.colors.textColor)
            .text(formattedValue);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements)
    // Icons could be rendered here if imagesInput and dataMappings were available/used.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}