/* REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
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
  "legend": "detailed",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const valueFieldName = yFieldConfig ? yFieldConfig.name : undefined;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x field (category)");
        if (!valueFieldName) missingFields.push("y field (value)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>Error: ${errorMsg}</div>`);
        return null;
    }

    let valueUnit = "";
    if (yFieldConfig && yFieldConfig.unit && yFieldConfig.unit !== "none") {
        valueUnit = yFieldConfig.unit;
    }

    const chartDataArray = rawChartData.filter(d => d[valueFieldName] != null && !isNaN(parseFloat(d[valueFieldName])) && parseFloat(d[valueFieldName]) >= 0);

    if (chartDataArray.length === 0) {
        d3.select(containerSelector).html("<div style='color:orange; padding:10px;'>No valid data to display.</div>");
        return null;
    }

    const totalY = d3.sum(chartDataArray, d => +d[valueFieldName]);
    if (totalY <= 0) {
        d3.select(containerSelector).html("<div style='color:orange; padding:10px;'>Sum of values must be greater than 0.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '13px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            // Assuming title and annotation are not used directly for legend/pie elements based on original and simplification
        },
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF', // Not directly used on SVG, but good to have
        defaultSliceColor: '#cccccc'
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox works on unattached SVG elements
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            console.warn("Could not measure text width for:", text, e);
            width = (text ? text.length : 0) * (parseFloat(fontSize) * 0.6); // Rough fallback
        }
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Apply background color to SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 };

    // Legend layout constants and calculations
    const legendMarkerRadius = 6;
    const idealIconSizeRatio = 1.1;
    const minIconSize = 10;
    const legendLabelFontSizeNumeric = parseFloat(fillStyle.typography.labelFontSize);
    const padding1 = 10; // Marker to icon
    const padding2 = 10; // Icon to value
    const padding3 = 10; // Value to label text
    const verticalPaddingRatio = 0.4; // For item height calculation

    const idealIconSize = Math.max(minIconSize, legendLabelFontSizeNumeric * idealIconSizeRatio);
    const idealItemHeight = Math.max(legendLabelFontSizeNumeric, idealIconSize) * (1 + verticalPaddingRatio);
    const absoluteMinItemHeight = Math.max(16, legendLabelFontSizeNumeric + 4, minIconSize + 4);

    let maxValueWidth = 0;
    let maxLabelWidth = 0;
    chartDataArray.forEach(d => {
        const valueText = `${d[valueFieldName]}${valueUnit}`;
        maxValueWidth = Math.max(maxValueWidth, estimateTextWidth(valueText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight));
        const labelText = d[categoryFieldName];
        maxLabelWidth = Math.max(maxLabelWidth, estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight));
    });

    const legendAvailableHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const maxHeightPerItem = legendAvailableHeight / chartDataArray.length;

    let finalLegendItemHeight = Math.max(absoluteMinItemHeight, Math.min(idealItemHeight, maxHeightPerItem));
    let finalIconSize;
    if (finalLegendItemHeight < idealItemHeight && idealItemHeight > 0) { // Added idealItemHeight > 0 to prevent division by zero
        finalIconSize = Math.max(minIconSize, finalLegendItemHeight * (idealIconSize / idealItemHeight));
    } else {
        finalIconSize = idealIconSize;
        finalLegendItemHeight = idealItemHeight;
    }
    
    finalLegendItemHeight = Math.max(finalLegendItemHeight, legendLabelFontSizeNumeric + 4, finalIconSize + 4); // Ensure text and icon fit

    const totalActualLegendHeight = finalLegendItemHeight * chartDataArray.length;
    const legendStartY = chartMargins.top + (legendAvailableHeight - totalActualLegendHeight) / 2; // Centered vertically

    const legendItemContentWidth = (legendMarkerRadius * 2) + padding1 + finalIconSize + padding2 + maxValueWidth + padding3 + maxLabelWidth;
    const legendAreaWidth = chartMargins.left + legendItemContentWidth + padding3; // Add padding on the right of legend area

    const pieAreaMargins = { top: 20, right: 20, bottom: 20, left: 30 }; // Pie's own margins relative to its allocated space
    const pieChartAreaWidth = containerWidth - legendAreaWidth - pieAreaMargins.left - chartMargins.right;
    const pieChartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom - pieAreaMargins.top - pieAreaMargins.bottom;

    if (pieChartAreaWidth <= 0 || pieChartAreaHeight <= 0) {
        svgRoot.remove();
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Not enough space to render the chart. Please increase width or height.</div>");
        return null;
    }

    const pieRadius = Math.min(pieChartAreaWidth, pieChartAreaHeight) / 2;
    const donutInnerRadiusRatio = 0.6;
    const pieCenterX = legendAreaWidth + pieAreaMargins.left + pieRadius;
    const pieCenterY = chartMargins.top + pieAreaMargins.top + (pieChartAreaHeight / 2);


    // Block 5: Data Preprocessing & Transformation
    const processedData = [...chartDataArray].sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);

    const pieGenerator = d3.pie()
        .value(d => +d[valueFieldName])
        .sort(null) // Data is pre-sorted
        .padAngle(0);

    const arcGenerator = d3.arc()
        .innerRadius(pieRadius * donutInnerRadiusRatio)
        .outerRadius(pieRadius)
        .cornerRadius(0);

    // Block 6: Scale Definition & Configuration
    const categoryDomain = processedData.map(d => d[categoryFieldName]);
    let colorRange = categoryDomain.map((fieldVal, i) => {
        if (colorsInput.field && colorsInput.field[fieldVal]) {
            return colorsInput.field[fieldVal];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[i % colorsInput.available_colors.length];
        }
        return null; // Placeholder for default scheme
    });

    if (colorRange.some(c => c === null)) { // If any color couldn't be mapped, use a default scheme
       colorRange = d3.schemeCategory10;
    }
    
    const colorScale = d3.scaleOrdinal()
        .domain(categoryDomain)
        .range(colorRange);


    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${legendStartY})`);

    processedData.forEach((d, i) => {
        const itemYPosition = i * finalLegendItemHeight;
        const itemCenterY = itemYPosition + finalLegendItemHeight / 2;

        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${itemYPosition})`);

        // 1. Color marker
        legendItem.append("circle")
            .attr("class", "mark")
            .attr("cx", legendMarkerRadius)
            .attr("cy", itemCenterY)
            .attr("r", legendMarkerRadius)
            .attr("fill", colorScale(d[categoryFieldName]));

        // 2. Icon
        const iconXPosition = (legendMarkerRadius * 2) + padding1;
        const iconUrl = imagesInput.field && imagesInput.field[d[categoryFieldName]] ? imagesInput.field[d[categoryFieldName]] : null;
        if (iconUrl) {
            legendItem.append("image")
                .attr("class", "icon")
                .attr("x", iconXPosition)
                .attr("y", itemCenterY - finalIconSize / 2)
                .attr("width", finalIconSize)
                .attr("height", finalIconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
        }

        // 3. Value text
        const valueTextXPosition = iconXPosition + (iconUrl ? finalIconSize : 0) + padding2 + maxValueWidth;
        legendItem.append("text")
            .attr("class", "text value")
            .attr("x", valueTextXPosition)
            .attr("y", itemCenterY)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(`${d[valueFieldName]}${valueUnit}`);

        // 4. Label text
        const labelTextXPosition = valueTextXPosition + padding3;
        legendItem.append("text")
            .attr("class", "text label")
            .attr("x", labelTextXPosition)
            .attr("y", itemCenterY)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d[categoryFieldName]);
    });

    // Block 8: Main Data Visualization Rendering (Donut Chart)
    const pieChartGroup = svgRoot.append("g")
        .attr("class", "chart donut-chart") // Added 'chart' class
        .attr("transform", `translate(${pieCenterX}, ${pieCenterY})`);

    pieChartGroup.selectAll("path.mark") // Added class selector
        .data(pieGenerator(processedData))
        .join("path")
        .attr("class", "mark") // Class for slices
        .attr("d", arcGenerator)
        .attr("fill", d_arc => colorScale(d_arc.data[categoryFieldName]))
        .style("stroke", "none"); // No stroke for clean style

    // Block 9: Optional Enhancements & Post-Processing
    // Removed svg2roughjs and mouseover/mouseout transitions for simplification and clean style.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}