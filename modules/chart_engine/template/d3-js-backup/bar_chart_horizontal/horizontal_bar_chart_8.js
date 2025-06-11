/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], ["-inf", "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "right",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const configVariables = data.variables || {};
    const configTypography = data.typography || {};
    const configColors = data.colors || (data.colors_dark || {});
    const configImages = data.images || {}; // Adhere to structure, though not used
    const dataColumnsDefinition = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumnsDefinition.find(col => col.role === "x");
    const valueFieldDef = dataColumnsDefinition.find(col => col.role === "y");

    if (!categoryFieldDef || !categoryFieldDef.name) {
        console.error("Critical chart config missing: Category field (role 'x') name not found. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (category field).</div>");
        return null;
    }
    if (!valueFieldDef || !valueFieldDef.name) {
        console.error("Critical chart config missing: Value field (role 'y') name not found. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (value field).</div>");
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    const categoryFieldUnit = categoryFieldDef.unit && categoryFieldDef.unit !== "none" ? categoryFieldDef.unit : "";
    const valueFieldUnit = valueFieldDef.unit && valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};
    fillStyle.typography = {
        titleFontFamily: (configTypography.title && configTypography.title.font_family) || 'Arial, sans-serif',
        titleFontSize: (configTypography.title && configTypography.title.font_size) || '16px',
        titleFontWeight: (configTypography.title && configTypography.title.font_weight) || 'bold',
        labelFontFamily: (configTypography.label && configTypography.label.font_family) || 'Arial, sans-serif',
        labelFontSize: (configTypography.label && configTypography.label.font_size) || '12px',
        labelFontWeight: (configTypography.label && configTypography.label.font_weight) || 'normal',
        annotationFontFamily: (configTypography.annotation && configTypography.annotation.font_family) || 'Arial, sans-serif',
        annotationFontSize: (configTypography.annotation && configTypography.annotation.font_size) || '10px',
        annotationFontWeight: (configTypography.annotation && configTypography.annotation.font_weight) || 'normal',
    };

    fillStyle.barColor = (configColors.other && configColors.other.primary) || "#E74C3C";
    fillStyle.textColor = configColors.text_color || "#333333";
    fillStyle.valueLabelColorInside = "#FFFFFF";
    fillStyle.valueLabelColorOutside = fillStyle.textColor;
    fillStyle.chartBackground = configColors.background_color || "none"; // Use "none" for transparent default

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('style', `font-family: ${fontFamily}; font-size: ${fontSize}; font-weight: ${fontWeight};`);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        let bboxWidth = 0;
        try {
            bboxWidth = tempTextElement.getBBox().width;
        } catch (e) {
            bboxWidth = (text || "").length * (parseFloat(fontSize) || 12) * 0.6; // Crude fallback
        }
        return bboxWidth;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B');
        } else if (Math.abs(value) >= 1000000 || Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format(",")(value); // Use comma for thousands separator for smaller numbers
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = configVariables.width || 800;
    const containerHeight = configVariables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    let maxPotentialValueLabelWidth = 0;
    if (chartDataArray && chartDataArray.length > 0) {
        chartDataArray.forEach(d => {
            const numericalValue = +d[valueFieldName];
            if (isNaN(numericalValue)) return;
            const formattedVal = formatValue(numericalValue) + (valueFieldUnit || "");
            const textWidth = estimateTextWidth(
                formattedVal,
                fillStyle.typography.annotationFontFamily,
                fillStyle.typography.annotationFontSize,
                fillStyle.typography.annotationFontWeight
            );
            maxPotentialValueLabelWidth = Math.max(maxPotentialValueLabelWidth, textWidth);
        });
    }
    
    const chartMargins = {
        top: parseFloat(fillStyle.typography.labelFontSize) + 15,
        right: 10,
        bottom: 20,
        left: Math.max(10, maxPotentialValueLabelWidth + 15) // Add a bit more padding
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Cannot render chart.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Chart dimensions too small for content.</div>");
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    const validDataArray = chartDataArray.filter(d => d[valueFieldName] !== null && d[valueFieldName] !== undefined && !isNaN(+d[valueFieldName]));
    const sortedDataArray = [...validDataArray].sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);
    const sortedCategories = sortedDataArray.map(d => d[categoryFieldName]);

    const valueExtents = d3.extent(sortedDataArray, d => +d[valueFieldName]);
    let minValue = valueExtents[0] !== undefined ? valueExtents[0] : 0;
    let maxValue = valueExtents[1] !== undefined ? valueExtents[1] : 0;
    
    if (sortedDataArray.length === 0) { // Handle empty data case for scales
        minValue = 0;
        maxValue = 1;
    } else if (minValue === 0 && maxValue === 0) { // Handle all zero data
        maxValue = 1;
    }

    const hasNegativeValues = minValue < 0;

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedCategories)
        .range([0, innerHeight])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([
            hasNegativeValues ? minValue * 1.1 : 0,
            maxValue > 0 ? maxValue * 1.1 : (hasNegativeValues ? 0 : 1) // Ensure positive range if max is 0 or less
        ])
        .range([0, innerWidth]);
    
    if (xScale.domain()[0] === xScale.domain()[1]) { // Prevent domain [0,0] if all values are 0 after adjustments
         xScale.domain([xScale.domain()[0], xScale.domain()[1] + 1]);
    }


    // Block 7: Chart Component Rendering
    // No axes, gridlines, or legend for this chart.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    sortedDataArray.forEach(d => {
        const category = d[categoryFieldName];
        const value = +d[valueFieldName];

        const barY = yScale(category);
        if (barY === undefined) return; // Category not in scale
        const barHeight = yScale.bandwidth();
        if (barHeight <= 0) return; // Skip if bar height is not positive

        const x0 = xScale(0);
        const xVal = xScale(value);
        
        const barRenderWidth = Math.abs(xVal - x0);
        const barActualX = value >= 0 ? x0 : xVal;
        
        // For right alignment, shift all bars so positive values end at innerWidth
        // and negative values also "originate" from a conceptual zero line that would
        // make their magnitudes align rightwards.
        // The current xScale maps data values to [0, innerWidth].
        // A bar from xScale(0) to xScale(value) needs to be shifted.
        // Let's use the original logic for right-alignment: bars grow left from innerWidth.
        const barX = value >= 0 ? innerWidth - barRenderWidth : innerWidth - barRenderWidth;


        const barGroup = mainChartGroup.append("g")
            .attr("class", "mark bar-group")
            .attr("transform", `translate(0, ${barY})`);

        barGroup.append("rect")
            .attr("class", "mark bar")
            .attr("x", barX)
            .attr("y", 0)
            .attr("width", Math.max(0, barRenderWidth))
            .attr("height", barHeight)
            .attr("fill", fillStyle.barColor);

        const formattedValue = formatValue(value) + (valueFieldUnit || "");
        const valueLabelBaseFontSize = parseFloat(fillStyle.typography.annotationFontSize);
        const valueLabelActualFontSizeNum = Math.min(barHeight * 0.8, Math.min(20, Math.max(barHeight * 0.5, valueLabelBaseFontSize)));
        const valueLabelActualFontSize = `${Math.max(8, valueLabelActualFontSizeNum)}px`; // Ensure min font size

        const valueLabelTextWidth = estimateTextWidth(
            formattedValue,
            fillStyle.typography.annotationFontFamily,
            valueLabelActualFontSize,
            fillStyle.typography.annotationFontWeight
        );

        const labelFitsInside = valueLabelTextWidth + 10 < barRenderWidth;

        if (labelFitsInside) {
            barGroup.append("text")
                .attr("class", "label value-label inside")
                .attr("x", barX + 5)
                .attr("y", barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", valueLabelActualFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.valueLabelColorInside)
                .text(formattedValue);
        } else {
            barGroup.append("text")
                .attr("class", "label value-label outside")
                .attr("x", barX - 5)
                .attr("y", barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", valueLabelActualFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.valueLabelColorOutside)
                .text(formattedValue);
        }

        const formattedCategory = category + (categoryFieldUnit || "");
        barGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", innerWidth)
            .attr("y", -5) 
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedCategory);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex visual effects.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}