/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart with Value Square",
  "chart_name": "horizontal_bar_chart_21",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "yes",
  "elementAlignment": "none",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    // const imagesConfig = data.images || {}; // Not used in this refactored version
    const dataColumns = data.data?.columns || [];
    let chartDataArray = data.data?.data || [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionFieldRole = "x";
    const valueFieldRole = "y";
    const valueField2Role = "y2";

    const getField = (role) => dataColumns.find(col => col.role === role)?.name;
    const getUnit = (role) => {
        const unit = dataColumns.find(col => col.role === role)?.unit;
        return unit === "none" ? "" : (unit || "");
    };
    const getDisplayName = (role, fallbackName) => dataColumns.find(col => col.role === role)?.display_name || fallbackName;

    const categoryFieldName = getField(dimensionFieldRole);
    const valueFieldName = getField(valueFieldRole);
    const valueField2Name = getField(valueField2Role);

    if (!categoryFieldName || !valueFieldName || !valueField2Name) {
        const missingFields = [
            !categoryFieldName ? `field with role '${dimensionFieldRole}'` : null,
            !valueFieldName ? `field with role '${valueFieldRole}'` : null,
            !valueField2Name ? `field with role '${valueField2Role}'` : null
        ].filter(Boolean).join(", ");

        console.error(`Critical chart config missing: ${missingFields}. Cannot render.`);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: Critical chart configuration missing (${missingFields}).</div>`);
        return null;
    }

    const categoryFieldUnit = getUnit(dimensionFieldRole);
    const valueFieldUnit = getUnit(valueFieldRole);
    const valueField2Unit = getUnit(valueField2Role);

    const valueFieldDisplayName = getDisplayName(valueFieldRole, valueFieldName);
    const valueField2DisplayName = getDisplayName(valueField2Role, valueField2Name);

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryBarColor: colorsConfig.other?.primary || "#1d6b64",
        secondaryShapeColor: colorsConfig.other?.secondary || "#ff7f0e",
        textColor: colorsConfig.text_color || "#333333",
        barLabelInsideColor: "#FFFFFF",
        chartBackground: colorsConfig.background_color || "transparent",
        typography: {
            labelFontFamily: typographyConfig.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyConfig.label?.font_size || "12px",
            labelFontWeight: typographyConfig.label?.font_weight || "normal",
            annotationFontFamily: typographyConfig.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyConfig.annotation?.font_size || "10px",
            annotationFontWeight: typographyConfig.annotation?.font_weight || "normal",
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to live DOM is more robust for getBBox but avoided for performance here.
        // If text measurement is inaccurate, consider appending to document.body temporarily.
        return tempText.getBBox().width;
    }

    const numberFormatter = (value) => {
        if (value === null || value === undefined || isNaN(value)) return "N/A";
        if (Math.abs(value) >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (Math.abs(value) >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (Math.abs(value) >= 1000) return d3.format("~g")(value / 1000) + "K";
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 40, 
        right: 20,
        bottom: 20,
        left: 20
    };

    let maxCategoryLabelWidth = 0;
    if (chartDataArray.length > 0) {
        maxCategoryLabelWidth = d3.max(chartDataArray, d => {
            const category = d[categoryFieldName];
            const formattedLabel = categoryFieldUnit ? `${category}${categoryFieldUnit}` : `${category}`;
            return estimateTextWidth(formattedLabel, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        }) || 0;
    }

    let maxValue2LabelWidth = 0;
    if (chartDataArray.length > 0) {
        maxValue2LabelWidth = d3.max(chartDataArray, d => {
            const value = d[valueField2Name];
            const formattedLabel = valueField2Unit ? `${numberFormatter(value)}${valueField2Unit}` : `${numberFormatter(value)}`;
            return estimateTextWidth(formattedLabel, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        }) || 0;
    }
   
    const valueField2DisplayNameWidth = estimateTextWidth(valueField2DisplayName, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
    maxValue2LabelWidth = Math.max(maxValue2LabelWidth, valueField2DisplayNameWidth);
    
    const categoryLabelPadding = 10;
    chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + categoryLabelPadding);
    
    const value2AreaPadding = 10; // Padding around the Y2 display area (square + label)
    chartMargins.right = Math.max(chartMargins.right, maxValue2LabelWidth + value2AreaPadding);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Cannot render chart.");
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "text error-message")
            .style("fill", "red")
            .style("font-family", "sans-serif")
            .text("Chart dimensions too small to render content.");
        return svgRoot.node();
    }

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray].sort((a, b) => (b[valueFieldName] || 0) - (a[valueFieldName] || 0));
    const sortedCategories = sortedData.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2;
    const yScale = d3.scaleBand()
        .domain(sortedCategories)
        .range([0, innerHeight])
        .padding(barPadding);

    const maxValY = d3.max(sortedData, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, maxValY > 0 ? maxValY * 1.05 : 1])
        .range([0, innerWidth]);

    const bandHeight = yScale.bandwidth();
    const maxValY2 = d3.max(sortedData, d => +d[valueField2Name]);
    const minSquareSide = Math.min(10, bandHeight * 0.4); 
    const maxSquareSide = bandHeight * 1.2; 

    const squareSideScale = d3.scaleSqrt()
        .domain([0, maxValY2 > 0 ? maxValY2 : 1])
        .range([minSquareSide, maxSquareSide])
        .clamp(true);

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    mainChartGroup.append("text")
        .attr("class", "text column-header y1-header")
        .attr("x", 0)
        .attr("y", -10)
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(valueFieldDisplayName);

    mainChartGroup.append("text")
        .attr("class", "text column-header y2-header")
        .attr("x", innerWidth + chartMargins.right - value2AreaPadding) 
        .attr("y", -10)
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(valueField2DisplayName);

    // Block 8: Main Data Visualization Rendering
    sortedCategories.forEach((category) => {
        const dataPoint = sortedData.find(d => d[categoryFieldName] === category);
        if (!dataPoint) return;

        const barY = yScale(category);
        if (barY === undefined) { // Category not in scale domain, skip
            console.warn(`Category "${category}" not found in yScale domain. Skipping.`);
            return;
        }
        const barW = xScale(Math.max(0, +dataPoint[valueFieldName] || 0));

        mainChartGroup.append("rect")
            .attr("class", "mark bar")
            .attr("x", 0)
            .attr("y", barY)
            .attr("width", barW)
            .attr("height", bandHeight)
            .attr("fill", fillStyle.primaryBarColor)
            .attr("rx", bandHeight / 2)
            .attr("ry", bandHeight / 2);

        const formattedCategory = categoryFieldUnit ? `${category}${categoryFieldUnit}` : `${category}`;
        mainChartGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", -categoryLabelPadding)
            .attr("y", barY + bandHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedCategory);

        const y1Value = +dataPoint[valueFieldName] || 0;
        const formattedY1Value = valueFieldUnit ? `${numberFormatter(y1Value)}${valueFieldUnit}` : `${numberFormatter(y1Value)}`;
        const y1ValueTextWidth = estimateTextWidth(formattedY1Value, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        
        const y2Value = +dataPoint[valueField2Name] || 0;
        const squareSide = squareSideScale(y2Value);
        const squareContainerX = innerWidth + value2AreaPadding / 2; // Start of Y2 content area
        const squareContainerWidth = chartMargins.right - value2AreaPadding;
        const finalSquareX = squareContainerX + (squareContainerWidth - squareSide) / 2;


        let y1LabelX, y1LabelAnchor, y1LabelFill;
        const y1LabelPadding = 5;
        const textFitsInsideBar = barW > y1ValueTextWidth + y1LabelPadding * 2;
        const textOutsideX = barW + y1LabelPadding;
        const wouldOverlapSquare = !textFitsInsideBar && (textOutsideX + y1ValueTextWidth > finalSquareX - y1LabelPadding);

        if (textFitsInsideBar) {
            y1LabelX = barW / 2;
            y1LabelAnchor = "middle";
            y1LabelFill = fillStyle.barLabelInsideColor;
        } else if (wouldOverlapSquare) {
            y1LabelX = barW / 2; 
            y1LabelAnchor = "middle";
            y1LabelFill = fillStyle.barLabelInsideColor;
        } else { 
            y1LabelX = textOutsideX;
            y1LabelAnchor = "start";
            y1LabelFill = fillStyle.textColor;
        }
        
        if (barW < y1ValueTextWidth && y1LabelAnchor === "middle") { // If forced inside but bar is too small
             // Potentially hide label or move outside if it doesn't fit well
             // For now, this case might lead to text overflow or clipping.
        }


        mainChartGroup.append("text")
            .attr("class", "label value-label y1-value")
            .attr("x", y1LabelX)
            .attr("y", barY + bandHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", y1LabelAnchor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", y1LabelFill)
            .text(formattedY1Value);

        const squareY = barY + (bandHeight - squareSide) / 2;
        mainChartGroup.append("rect")
            .attr("class", "mark shape y2-shape")
            .attr("x", finalSquareX)
            .attr("y", squareY)
            .attr("width", squareSide)
            .attr("height", squareSide)
            .attr("fill", fillStyle.secondaryShapeColor)
            .attr("opacity", 0.6);

        const formattedY2Value = valueField2Unit ? `${numberFormatter(y2Value)}${valueField2Unit}` : `${numberFormatter(y2Value)}`;
        mainChartGroup.append("text")
            .attr("class", "label value-label y2-value")
            .attr("x", finalSquareX + squareSide / 2)
            .attr("y", squareY + squareSide / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedY2Value);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // None for this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}