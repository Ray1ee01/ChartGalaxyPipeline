/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart With Circle",
  "chart_name": "horizontal_bar_chart_with_circle_plain_01",
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
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && Array.isArray(data.data.data) ? data.data.data : (Array.isArray(data.data) ? data.data : []);
    const config = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueField1Config = dataColumns.find(col => col.role === "y");
    const valueField2Config = dataColumns.find(col => col.role === "y2");

    const dimensionField = dimensionFieldConfig?.name;
    const valueField1 = valueField1Config?.name;
    const valueField2 = valueField2Config?.name;

    const criticalFields = {
        dimensionField: dimensionField,
        valueField1: valueField1,
        valueField2: valueField2
    };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    let valueUnit1 = valueField1Config?.unit === "none" ? "" : valueField1Config?.unit || "";
    let valueUnit2 = valueField2Config?.unit === "none" ? "" : valueField2Config?.unit || "";
    
    const columnTitle1 = valueField1Config?.name || "Value 1";
    const columnTitle2 = valueField2Config?.name || "Value 2";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: rawTypography.title?.font_family || "Arial, sans-serif",
            titleFontSize: rawTypography.title?.font_size || "16px", // Adjusted default
            titleFontWeight: rawTypography.title?.font_weight || "bold",
            labelFontFamily: rawTypography.label?.font_family || "Arial, sans-serif",
            labelFontSize: rawTypography.label?.font_size || "12px", // Adjusted default
            labelFontWeight: rawTypography.label?.font_weight || "normal", // Adjusted default
            annotationFontFamily: rawTypography.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: rawTypography.annotation?.font_size || "10px",
            annotationFontWeight: rawTypography.annotation?.font_weight || "normal",
        },
        textColor: rawColors.text_color || "#000000",
        chartBackground: rawColors.background_color || "#FFFFFF",
        barColor: (rawColors.field && rawColors.field[valueField1] ? rawColors.field[valueField1] : rawColors.other?.primary) || "#4269d0",
        circleColor: (rawColors.field && rawColors.field[valueField2] ? rawColors.field[valueField2] : rawColors.other?.secondary) || "#6cc5b0", // Different default for visual distinction
        iconUrls: rawImages.field || {},
        defaultIconUrl: rawImages.other?.primary || null
    };
    
    function estimateTextWidth(text, fontProps) {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempSvg = d3.select(tempSvgNode);
        const tempText = tempSvg.append("text")
            .style("font-family", fontProps.fontFamily)
            .style("font-size", fontProps.fontSize)
            .style("font-weight", fontProps.fontWeight)
            .text(text);
        const width = tempText.node().getBBox().width;
        tempSvg.remove(); // Clean up in-memory SVG
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for billion
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    function wrapText(textSelection, textContent, maxWidth, lineHeightEm) {
        textSelection.each(function() {
            const textNode = d3.select(this);
            const words = textContent.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textNode.attr("x") || 0;
            const y = textNode.attr("y") || 0;
            const dy = parseFloat(textNode.attr("dy") || 0);
            
            textNode.text(null); // Clear existing text
            let tspan = textNode.append("tspan")
                .attr("x", x)
                .attr("y", y)
                .attr("dy", dy + "em")
                .attr("class", "text");

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = textNode.append("tspan")
                        .attr("x", x)
                        .attr("y", y)
                        .attr("dy", (++lineNumber * lineHeightEm) + dy + "em")
                        .text(word)
                        .attr("class", "text");
                }
            }
        });
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartDataArray = JSON.parse(JSON.stringify(rawChartData)); // Deep copy for sorting

    const labelFontProps = { 
        fontFamily: fillStyle.typography.labelFontFamily, 
        fontSize: fillStyle.typography.labelFontSize, 
        fontWeight: fillStyle.typography.labelFontWeight 
    };
    const maxLabelWidth = d3.max(chartDataArray, d => estimateTextWidth(String(d[dimensionField]).toUpperCase(), labelFontProps)) || 0;
    const maxValue1Width = d3.max(chartDataArray, d => estimateTextWidth(`${formatValue(+d[valueField1])}${valueUnit1}`, labelFontProps)) || 0;
    
    const flagWidth = 24;
    const flagHeight = 24;
    const flagMargin = 10;
    const textIconGap = 10;
    const valueLabelGap = 5;
    const titleAreaHeight = 60; // Increased space for titles/legend

    const chartMargins = {
        top: titleAreaHeight,
        right: 20,
        bottom: 20, // Reduced bottom margin
        left: Math.max(20, maxLabelWidth + flagWidth + flagMargin + textIconGap + 10) // Ensure space for labels and icons
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const barChartRatio = 0.75; // Adjusted ratio
    const circleChartRatio = 0.25; // Adjusted ratio

    // Width available for bar + circle visuals (excluding bar value labels)
    const visualElementsWidth = innerWidth - maxValue1Width - valueLabelGap;
    
    const barChartWidth = visualElementsWidth * barChartRatio;
    const circleChartWidth = visualElementsWidth * circleChartRatio;
    
    const maxCircleDiameter = Math.min(circleChartWidth * 0.8, 60); // Slightly smaller max circle

    // Block 5: Data Preprocessing & Transformation
    chartDataArray.sort((a, b) => +b[valueField1] - +a[valueField1]);
    const sortedDimensions = chartDataArray.map(d => d[dimensionField]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2; // Fixed padding

    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    const barHeight = yScale.bandwidth();

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => +d[valueField1]) || 1]) // Ensure domain is at least [0,1]
        .range([0, barChartWidth]);

    const maxValue2 = d3.max(chartDataArray, d => +d[valueField2]) || 1; // Ensure domain is at least [0,1]
    const minRadius = Math.max(2, Math.min(barHeight * 0.2, maxCircleDiameter * 0.1)); // Ensure minRadius is visible
    const maxRadius = Math.min(barHeight / 2, maxCircleDiameter / 2); // Circle fits within bar height and max diameter

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxValue2])
        .range([minRadius, maxRadius]);

    // Block 7: Chart Component Rendering (Column Titles as Legend)
    const legendSize = 12;
    const legendMargin = 5;
    const legendTextOffset = legendSize + legendMargin;
    const titleYPosition = chartMargins.top / 2; // Vertically center titles in top margin area

    // Left Column Title (Bar Chart Legend)
    const leftTitleGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${titleYPosition})`)
        .attr("class", "legend-group");

    leftTitleGroup.append("rect")
        .attr("x", 0)
        .attr("y", -legendSize / 2)
        .attr("width", legendSize)
        .attr("height", legendSize)
        .attr("fill", fillStyle.barColor)
        .attr("class", "mark legend-swatch");

    if (columnTitle1) {
        const leftTitle = leftTitleGroup.append("text")
            .attr("x", legendTextOffset)
            .attr("y", 0)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily) // Using label for consistency
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "text legend-label")
            .text(columnTitle1);
        // wrapText(leftTitle, columnTitle1, (innerWidth / 2) - legendTextOffset, 1.2); // Wrapping if needed
    }
    
    // Right Column Title (Circle Chart Legend)
    // Calculate width of right title for positioning
    const rightTitleText = columnTitle2 || "";
    const rightTitleFontProps = {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    };
    const estimatedRightTitleWidth = estimateTextWidth(rightTitleText, rightTitleFontProps);
    const rightTitleTotalWidth = legendTextOffset + estimatedRightTitleWidth;

    const rightTitleGroup = svgRoot.append("g")
        .attr("transform", `translate(${containerWidth - chartMargins.right - rightTitleTotalWidth}, ${titleYPosition})`)
        .attr("class", "legend-group");

    rightTitleGroup.append("circle")
        .attr("cx", legendSize / 2)
        .attr("cy", 0)
        .attr("r", legendSize / 2)
        .attr("fill", fillStyle.circleColor)
        .attr("class", "mark legend-swatch");
    
    if (columnTitle2) {
        rightTitleGroup.append("text")
            .attr("x", legendTextOffset)
            .attr("y", 0)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "text legend-label")
            .text(columnTitle2);
    }

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    chartDataArray.forEach(d => {
        const dimensionValue = d[dimensionField];
        const value1 = +d[valueField1];
        const value2 = +d[valueField2];

        const yPos = yScale(dimensionValue);
        if (yPos === undefined) { // Skip if category not in scale (e.g. after filtering)
            console.warn(`Category ${dimensionValue} not found in yScale domain.`);
            return;
        }
        const centerY = yPos + barHeight / 2;
        
        // Category Label (Dimension)
        mainChartGroup.append("text")
            .attr("x", -textIconGap - flagWidth - flagMargin) // Position to the left of the icon
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(String(dimensionValue).toUpperCase())
            .attr("class", "label category-label");

        // Icon
        const iconUrl = fillStyle.iconUrls[dimensionValue] || (Object.keys(fillStyle.iconUrls).length > 0 ? null : fillStyle.defaultIconUrl); // Use default only if no field specific icons are provided at all
        if (iconUrl) {
            mainChartGroup.append("image")
                .attr("x", -flagWidth - flagMargin) // Position to the left of y-axis origin
                .attr("y", centerY - flagHeight / 2)
                .attr("width", flagWidth)
                .attr("height", flagHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl)
                .attr("class", "icon category-icon");
        } else if (!iconUrl && Object.keys(fillStyle.iconUrls).length > 0 && fillStyle.iconUrls[dimensionValue] === undefined) {
            // If images.field is provided but this specific key is missing, don't render an image.
        }


        // Bar
        const currentBarWidth = xScale(value1);
        mainChartGroup.append("rect")
            .attr("x", 0)
            .attr("y", yPos)
            .attr("width", currentBarWidth > 0 ? currentBarWidth : 0) // Ensure non-negative width
            .attr("height", barHeight)
            .attr("fill", fillStyle.barColor)
            .attr("opacity", 0.9)
            .attr("class", "mark bar");

        // Bar Value Label
        const formattedValue1 = `${formatValue(value1)}${valueUnit1}`;
        mainChartGroup.append("text")
            .attr("x", (currentBarWidth > 0 ? currentBarWidth : 0) + valueLabelGap)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedValue1)
            .attr("class", "label value-label bar-value-label");

        // Circle
        const circleX = barChartWidth + maxValue1Width + valueLabelGap + (circleChartWidth / 2);
        const circleRadius = radiusScale(value2);
        
        mainChartGroup.append("circle")
            .attr("cx", circleX)
            .attr("cy", centerY)
            .attr("r", circleRadius > 0 ? circleRadius : 0) // Ensure non-negative radius
            .attr("fill", fillStyle.circleColor)
            .attr("opacity", 0.7)
            .attr("class", "mark circle");

        // Circle Value Label
        const formattedValue2 = `${formatValue(value2)}${valueUnit2}`;
        mainChartGroup.append("text")
            .attr("x", circleX)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize) // Potentially smaller if radius is small
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor) // Consider contrasting color if circle is dark
            .text(formattedValue2)
            .attr("class", "label value-label circle-value-label");
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements as per requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}