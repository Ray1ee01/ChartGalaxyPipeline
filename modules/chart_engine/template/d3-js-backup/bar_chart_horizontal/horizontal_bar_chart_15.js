/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart With Circle",
  "chart_name": "horizontal_bar_chart_15",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "detailed",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal bar chart combined with a proportional circle chart.
    // Each row represents a category, showing two different numerical values:
    // one as bar length, the other as circle area.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && Array.isArray(data.data.data) ? data.data.data : (Array.isArray(data.data) ? data.data : []);
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldRole = "x";
    const valueField1Role = "y";
    const valueField2Role = "y2";

    const dimensionFieldConfig = dataColumns.find(col => col.role === dimensionFieldRole);
    const valueField1Config = dataColumns.find(col => col.role === valueField1Role);
    const valueField2Config = dataColumns.find(col => col.role === valueField2Role);

    const dimensionFieldName = dimensionFieldConfig?.name;
    const valueField1Name = valueField1Config?.name;
    const valueField2Name = valueField2Config?.name;

    if (!dimensionFieldName || !valueField1Name || !valueField2Name) {
        let missingRoles = [];
        if (!dimensionFieldName) missingRoles.push(`role: '${dimensionFieldRole}' (name)`);
        if (!valueField1Name) missingRoles.push(`role: '${valueField1Role}' (name)`);
        if (!valueField2Name) missingRoles.push(`role: '${valueField2Role}' (name)`);
        
        const errorMessage = `Critical chart configuration missing: Cannot find data columns for roles: ${missingRoles.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null;
    }

    const value1Unit = valueField1Config?.unit === "none" ? "" : (valueField1Config?.unit || "");
    const value2Unit = valueField2Config?.unit === "none" ? "" : (valueField2Config?.unit || "");
    
    const columnTitle1 = valueField1Config?.name || "Value 1";
    const columnTitle2 = valueField2Config?.name || "Value 2";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: rawImages.field || {},
        otherImages: rawImages.other || {}
    };

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = rawTypography.title?.font_family || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = rawTypography.title?.font_size || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = rawTypography.title?.font_weight || defaultTypography.title.font_weight;

    // Original code used `description` for column titles, mapping to `label` style here.
    fillStyle.typography.columnTitleFontFamily = rawTypography.label?.font_family || defaultTypography.label.font_family;
    fillStyle.typography.columnTitleFontSize = rawTypography.label?.font_size || defaultTypography.label.font_size;
    fillStyle.typography.columnTitleFontWeight = rawTypography.label?.font_weight || defaultTypography.label.font_weight;
    
    fillStyle.typography.labelFontFamily = rawTypography.label?.font_family || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = rawTypography.label?.font_size || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = rawTypography.label?.font_weight || defaultTypography.label.font_weight;

    fillStyle.textColor = rawColors.text_color || "#0f223b";
    fillStyle.backgroundColor = rawColors.background_color || "#FFFFFF";
    
    const defaultPrimaryColor = "#1f77b4";
    const defaultSecondaryColor = "#ff7f0e";

    if (rawColors.field && rawColors.field[valueField1Name]) {
        fillStyle.barColor = rawColors.field[valueField1Name];
    } else if (rawColors.other && rawColors.other.primary) {
        fillStyle.barColor = rawColors.other.primary;
    } else {
        fillStyle.barColor = defaultPrimaryColor;
    }

    if (rawColors.field && rawColors.field[valueField2Name]) {
        fillStyle.circleColor = rawColors.field[valueField2Name];
    } else if (rawColors.other && rawColors.other.secondary) {
        fillStyle.circleColor = rawColors.other.secondary;
    } else {
        fillStyle.circleColor = defaultSecondaryColor;
    }
    
    function estimateTextWidth(text, styleProperties) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', styleProperties.font_family);
        tempTextElement.setAttribute('font-size', styleProperties.font_size);
        tempTextElement.setAttribute('font-weight', styleProperties.font_weight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // Note: getBBox on an unattached element can be inconsistent.
        // For robustness, it's often better to briefly attach to DOM, measure, then detach.
        // However, adhering to "MUST NOT be appended to the document DOM".
        // A more reliable method if this fails is to append to a hidden div within containerSelector temporarily.
        // For now, direct getBBox().
        // If `document.body` is available and allowed for a quick append/remove, that's best.
        // Let's assume `getBBox` works sufficiently for this context or use `getComputedTextLength` if styles are applied.
        // The original used `getComputedTextLength` on a DOM-attached element.
        // For a truly in-memory element, `getBBox()` is more common.
        // Let's try to simulate style application for `getComputedTextLength`.
        // This is tricky without DOM. Fallback to `getBBox` if `getComputedTextLength` is 0.
        let width = 0;
        try {
            // Try to force style application for getComputedTextLength
            // This is often not effective without being in the DOM.
            // tempTextElement.style.fontFamily = styleProperties.font_family;
            // tempTextElement.style.fontSize = styleProperties.font_size;
            // tempTextElement.style.fontWeight = styleProperties.font_weight;
            // width = tempTextElement.getComputedTextLength();
            // if (width === 0 && text.length > 0) { // Fallback if getComputedTextLength fails
                 width = tempTextElement.getBBox().width;
            // }
        } catch (e) { // If getBBox also fails (e.g. in a very restricted environment)
            width = text.length * (parseFloat(styleProperties.font_size) || 12) * 0.6; // Rough estimate
        }
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    function wrapText(d3TextSelection, text, maxWidth, lineHeightEm) {
        d3TextSelection.each(function() {
            const textNode = d3.select(this);
            const words = text.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textNode.attr("x");
            const y = textNode.attr("y");
            const dy = parseFloat(textNode.attr("dy") || 0);
            let tspan = textNode.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = textNode.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeightEm + dy + "em").text(word);
                }
            }
        });
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
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 20, bottom: 30, left: 20 }; // Initial left margin, will be adjusted

    const iconWidth = 24;
    const iconHeight = 24;
    const iconMarginRight = 10; // Margin between icon and its label
    const labelIconGap = 10;    // Gap between dimension label text and icon
    const barValueLabelGap = 5; // Gap between bar and its value label

    // Measure text for layout
    const tempLabelStyle = { font_family: fillStyle.typography.labelFontFamily, font_size: fillStyle.typography.labelFontSize, font_weight: fillStyle.typography.labelFontWeight };
    
    const maxDimensionLabelWidth = d3.max(chartDataInput, d => estimateTextWidth(String(d[dimensionFieldName]).toUpperCase(), tempLabelStyle)) || 0;
    const maxValue1LabelWidth = d3.max(chartDataInput, d => estimateTextWidth(`${formatValue(+d[valueField1Name])}${value1Unit}`, tempLabelStyle)) || 0;
    
    chartMargins.left = Math.max(chartMargins.left, maxDimensionLabelWidth + iconWidth + iconMarginRight + labelIconGap + 10);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const barChartRatio = 0.75; // Adjusted ratio
    const circleChartRatio = 0.25;

    const barChartMaxWidth = innerWidth * barChartRatio - maxValue1LabelWidth - barValueLabelGap;
    const circleChartAvailableWidth = innerWidth * circleChartRatio;
    
    // Max circle diameter should be related to bar height and available space
    const barPadding = 0.2; // Simplified from variables.has_spacing
    const numBars = chartDataInput.length || 1;
    const calculatedBarHeight = innerHeight / numBars * (1 - barPadding);
    const maxCircleDiameter = Math.min(circleChartAvailableWidth * 0.7, calculatedBarHeight * 1.5, 80);


    // Block 5: Data Preprocessing & Transformation
    const sortedChartData = [...chartDataInput].sort((a, b) => +b[valueField1Name] - +a[valueField1Name]);
    const sortedDimensionValues = sortedChartData.map(d => d[dimensionFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensionValues)
        .range([0, innerHeight])
        .padding(barPadding);

    const actualBarHeight = yScale.bandwidth();

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedChartData, d => +d[valueField1Name]) || 1]) // Ensure domain is at least [0,1]
        .range([0, barChartMaxWidth]);

    const maxRadius = Math.min(actualBarHeight * 0.5, maxCircleDiameter / 2); // Adjusted maxRadius based on actualBarHeight
    const minRadius = maxRadius * 0.2; // Ensure minRadius is proportional and smaller

    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(sortedChartData, d => +d[valueField2Name]) || 1]) // Ensure domain is at least [0,1]
        .range([minRadius, maxRadius]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Column Titles / Legend
    const legendItemSize = 14;
    const legendMargin = 8;
    const legendTextOffsetX = legendItemSize + legendMargin;
    const columnTitleY = -chartMargins.top / 2; // Position above the chart area

    // Left Column Title (for bars)
    const leftTitleGroup = mainChartGroup.append("g")
        .attr("class", "legend-item")
        .attr("transform", `translate(0, ${columnTitleY})`);

    leftTitleGroup.append("rect")
        .attr("class", "legend-swatch mark")
        .attr("x", 0)
        .attr("y", -legendItemSize / 2)
        .attr("width", legendItemSize)
        .attr("height", legendItemSize)
        .attr("fill", fillStyle.barColor);

    const leftTitleText = leftTitleGroup.append("text")
        .attr("class", "text legend-label")
        .attr("x", legendTextOffsetX)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.columnTitleFontFamily)
        .style("font-size", fillStyle.typography.columnTitleFontSize)
        .style("font-weight", fillStyle.typography.columnTitleFontWeight)
        .style("fill", fillStyle.textColor)
        .text(columnTitle1);
    
    // Right Column Title (for circles) - positioned relative to the circle area
    const circleAreaXStart = barChartMaxWidth + maxValue1LabelWidth + barValueLabelGap;
    const rightTitleX = circleAreaXStart + circleChartAvailableWidth; // Align to the right of circle area

    const rightTitleGroup = mainChartGroup.append("g")
        .attr("class", "legend-item")
        .attr("transform", `translate(0, ${columnTitleY})`);
    
    const rightTitleText = rightTitleGroup.append("text")
        .attr("class", "text legend-label")
        .attr("x", rightTitleX)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.columnTitleFontFamily)
        .style("font-size", fillStyle.typography.columnTitleFontSize)
        .style("font-weight", fillStyle.typography.columnTitleFontWeight)
        .style("fill", fillStyle.textColor)
        .text(columnTitle2);

    // Measure right title text to place swatch correctly
    const rightTitleTextWidth = rightTitleText.node()?.getComputedTextLength() || 0;
    
    rightTitleGroup.append("circle")
        .attr("class", "legend-swatch mark")
        .attr("cx", rightTitleX - rightTitleTextWidth - legendMargin - legendItemSize / 2)
        .attr("cy", 0)
        .attr("r", legendItemSize / 2)
        .attr("fill", fillStyle.circleColor);
    
    // Apply wrapText if titles are very long (optional, as titles are usually short)
    // wrapText(leftTitleText, columnTitle1, barChartMaxWidth / 2, 1.2); 
    // wrapText(rightTitleText, columnTitle2, circleChartAvailableWidth / 2, 1.2); // More complex due to right alignment

    // Block 8: Main Data Visualization Rendering
    const rows = mainChartGroup.selectAll(".data-row")
        .data(sortedChartData)
        .enter()
        .append("g")
        .attr("class", "data-row")
        .attr("transform", d => `translate(0, ${yScale(d[dimensionFieldName])})`);

    // Dimension Labels (Text part)
    rows.append("text")
        .attr("class", "label dimension-label")
        .attr("x", -iconWidth - iconMarginRight - labelIconGap)
        .attr("y", actualBarHeight / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => String(d[dimensionFieldName]).toUpperCase());

    // Icons
    rows.each(function(d) {
        const group = d3.select(this);
        const iconUrl = fillStyle.images[d[dimensionFieldName]] || fillStyle.otherImages.primary;
        if (iconUrl) {
            group.append("image")
                .attr("class", "icon dimension-icon")
                .attr("x", -iconWidth - iconMarginRight)
                .attr("y", (actualBarHeight - iconHeight) / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
        }
    });
    
    // Bars
    rows.append("rect")
        .attr("class", "mark bar")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", d => xScale(+d[valueField1Name]))
        .attr("height", actualBarHeight)
        .attr("fill", fillStyle.barColor)
        .attr("opacity", 0.9);

    // Bar Value Labels
    rows.append("text")
        .attr("class", "label value-label bar-value")
        .attr("x", d => xScale(+d[valueField1Name]) + barValueLabelGap)
        .attr("y", actualBarHeight / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => `${formatValue(+d[valueField1Name])}${value1Unit}`);

    // Circles
    const circleCenterX = circleAreaXStart + circleChartAvailableWidth / 2;
    rows.append("circle")
        .attr("class", "mark circle")
        .attr("cx", circleCenterX)
        .attr("cy", actualBarHeight / 2)
        .attr("r", d => radiusScale(+d[valueField2Name]))
        .attr("fill", fillStyle.circleColor)
        .attr("opacity", 0.7);

    // Circle Value Labels
    rows.append("text")
        .attr("class", "label value-label circle-value")
        .attr("x", circleCenterX)
        .attr("y", actualBarHeight / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => `${formatValue(+d[valueField2Name])}${value2Unit}`);

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable for this chart based on current requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}