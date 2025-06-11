/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_chart_09",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is external to the function)

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || (data.colors_dark || {});
    const imagesInput = data.images || {}; // Extracted per spec, though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";

    const xDataColumn = dataColumns.find(col => col.role === xFieldRole);
    const yDataColumn = dataColumns.find(col => col.role === yFieldRole);

    const xFieldName = xDataColumn ? xDataColumn.name : undefined;
    const yFieldName = yDataColumn ? yDataColumn.name : undefined;
    
    let missingFieldsMessages = [];
    if (!xFieldName) missingFieldsMessages.push("field for role 'x'");
    if (!yFieldName) missingFieldsMessages.push("field for role 'y'");

    if (missingFieldsMessages.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFieldsMessages.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    let valueUnit = "";
    if (yDataColumn && yDataColumn.unit && yDataColumn.unit !== "none") {
        valueUnit = yDataColumn.unit;
    }

    const validData = chartData.filter(d => 
        d[yFieldName] != null && 
        !isNaN(parseFloat(d[yFieldName])) && 
        parseFloat(d[yFieldName]) >= 0
    );
    
    if (validData.length === 0) {
        const errorMsg = "No valid data points after filtering (numeric, non-negative y-values required).";
        console.warn(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const totalValue = d3.sum(validData, d => +d[yFieldName]);

    if (totalValue <= 0 && validData.length > 0) { // Allow chart with all zero values if any valid data point exists (though pie won't show)
        const errorMsg = "Total sum of y-values is zero or negative. Cannot render meaningful donut chart proportions.";
        console.warn(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        }
        // Proceeding might draw an empty chart or error out in D3 pie, so best to return.
        return null;
    }
    
    const processedData = [...validData].sort((a, b) => +b[yFieldName] - +a[yFieldName]);


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: {} // For consistency, per spec
    };

    fillStyle.typography.defaultFontFamily = "Arial, sans-serif";
    fillStyle.typography.defaultFontSize = "12px";
    fillStyle.typography.defaultFontWeight = "normal";
    
    fillStyle.typography.labelFontFamily = (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : fillStyle.typography.defaultFontFamily;
    fillStyle.typography.labelFontSize = (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : fillStyle.typography.defaultFontSize;
    fillStyle.typography.labelFontWeight = (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : fillStyle.typography.defaultFontWeight;

    fillStyle.typography.annotationFontFamily = (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : fillStyle.typography.defaultFontFamily;
    fillStyle.typography.annotationFontSize = (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : "10px";
    fillStyle.typography.annotationFontWeight = (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : fillStyle.typography.defaultFontWeight;
    
    fillStyle.textColor = colorsInput.text_color || '#0F223B';
    fillStyle.chartBackground = colorsInput.background_color || '#FFFFFF';

    const defaultCategoricalColors = d3.schemeCategory10;
    fillStyle.getSliceColor = (categoryName, index) => {
        if (colorsInput.field && colorsInput.field[categoryName]) {
            return colorsInput.field[categoryName];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[index % colorsInput.available_colors.length];
        }
        return defaultCategoricalColors[index % defaultCategoricalColors.length];
    };

    function getContrastColor(hexColor) {
        if (!hexColor || typeof hexColor !== 'string' || hexColor.length < 4) return '#000000';
        let r, g, b;
        hexColor = hexColor.startsWith('#') ? hexColor : '#' + hexColor;

        if (hexColor.length === 4) {
            r = parseInt(hexColor[1] + hexColor[1], 16);
            g = parseInt(hexColor[2] + hexColor[2], 16);
            b = parseInt(hexColor[3] + hexColor[3], 16);
        } else if (hexColor.length === 7) {
            r = parseInt(hexColor.slice(1, 3), 16);
            g = parseInt(hexColor.slice(3, 5), 16);
            b = parseInt(hexColor.slice(5, 7), 16);
        } else {
            return '#000000'; // Invalid hex length
        }
        if (isNaN(r) || isNaN(g) || isNaN(b)) return '#000000';

        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 128 ? "#000000" : "#FFFFFF";
    }
    fillStyle.getLabelColorOnSlice = (sliceColor) => getContrastColor(sliceColor);
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            console.warn("Failed to estimate text width with getBBox on in-memory SVG. Using fallback.", e);
            width = (text || "").length * (parseFloat(fontSize.replace('px','')) || 10) * 0.6;
        }
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 600;
    const containerHeight = parseFloat(variables.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");


    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const radius = Math.min(innerWidth, innerHeight) / 2;
    const innerRadiusRatio = 0.5;
    const innerRadius = radius * innerRadiusRatio;


    // Block 5: Data Preprocessing & Transformation
    const pieGenerator = d3.pie()
        .value(d => +d[yFieldName])
        .sort(null) 
        .padAngle(0);

    if (processedData.length > 0 && totalValue > 0) {
        const firstSliceProportion = +processedData[0][yFieldName] / totalValue;
        const firstSliceAngle = Math.PI * 2 * firstSliceProportion;
        pieGenerator
            .startAngle(Math.PI - (firstSliceAngle / 2))
            .endAngle(Math.PI - (firstSliceAngle / 2) + Math.PI * 2);
    }


    // Block 6: Scale Definition & Configuration
    // Color determination is handled by fillStyle.getSliceColor in Block 8.

    // Block 7: Chart Component Rendering
    // Not applicable for this donut chart (no axes, gridlines, legend).

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`)
        .attr("class", "main-chart-group other"); // 'other' as a general group class

    const arcGenerator = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(radius);

    const pieData = pieGenerator(processedData);

    const arcPaths = mainChartGroup.selectAll(".arc-path")
        .data(pieData)
        .enter()
        .append("path")
        .attr("class", "mark arc-path")
        .attr("d", arcGenerator)
        .attr("fill", (d, i) => fillStyle.getSliceColor(d.data[xFieldName], i))
        .attr("stroke", "none");


    // Block 9: Optional Enhancements & Post-Processing
    const labelArcGenerator = d3.arc()
        .innerRadius(innerRadius + (radius - innerRadius) * 0.5)
        .outerRadius(innerRadius + (radius - innerRadius) * 0.5);

    const sliceLabels = mainChartGroup.selectAll(".slice-label-group")
        .data(pieData)
        .enter()
        .append("g")
        .attr("class", "label slice-label-group")
        .attr("transform", d => `translate(${labelArcGenerator.centroid(d)})`);

    sliceLabels.each(function(d, i) {
        const group = d3.select(this);
        const sliceAngle = d.endAngle - d.startAngle;
        const sliceColor = fillStyle.getSliceColor(d.data[xFieldName], i);
        const labelColor = fillStyle.getLabelColorOnSlice(sliceColor);

        if (sliceAngle < 0.3) { 
            group.append("text")
                .attr("class", "text slice-label-ellipsis")
                .text("...")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", "bold")
                .attr("fill", labelColor);
            return;
        }

        group.append("text")
            .attr("class", "text slice-label-category")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("dy", "-0.6em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", labelColor)
            .text(d.data[xFieldName]);

        group.append("text")
            .attr("class", "text slice-label-value")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("dy", "0.7em") 
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", labelColor)
            .text(`${d.data[yFieldName]}${valueUnit}`);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}