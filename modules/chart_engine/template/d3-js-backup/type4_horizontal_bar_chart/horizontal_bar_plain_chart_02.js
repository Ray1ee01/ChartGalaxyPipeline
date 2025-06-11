/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal bar chart with rounded ends and optional icons.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Could be data.colors_dark if a theme mechanism was in place
    const imagesConfig = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");

    if (!dimensionFieldConfig || !valueFieldConfig) {
        const missing = [];
        if (!dimensionFieldConfig) missing.push("dimension field (role: x)");
        if (!valueFieldConfig) missing.push("value field (role: y)");
        const errorMessage = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const dimensionFieldName = dimensionFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;
    const dimensionUnit = dimensionFieldConfig.unit !== "none" ? dimensionFieldConfig.unit : "";
    const valueUnit = valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px', // Default, will be overridden by dynamic size for value labels
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        colors: {
            barColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#882e2e',
            textColor: colorsConfig.text_color || '#333333',
            barLabelColor: '#FFFFFF', // For labels inside bars
            chartBackground: colorsConfig.background_color || '#FFFFFF',
        },
        images: {
            field: imagesConfig.field || {},
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
        // Note: Appending to body and then removing is more reliable for getBBox across browsers
        // but per spec, keep it in-memory if possible. If issues arise, this is a point to check.
        // For this exercise, we assume in-memory works.
        return tempText.getBBox().width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const baseContainerHeight = variables.height || 600;
    
    const uniqueDimensionCount = new Set(chartData.map(d => d[dimensionFieldName])).size;
    const containerHeight = uniqueDimensionCount > 15
        ? baseContainerHeight * (1 + (uniqueDimensionCount - 15) * 0.03)
        : baseContainerHeight;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.colors.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 20, // Reduced as no main title
        right: 10,
        bottom: 20, // Reduced as no x-axis labels
        left: 100
    };

    // Calculate max label widths for dynamic margins
    // Temporary values for icon, assuming bar height will be around 30px for this calculation
    const tempBarHeightForIconCalc = 30;
    const tempIconHeight = tempBarHeightForIconCalc * 0.9;
    const tempIconWidth = tempIconHeight * 1.33;
    const iconPadding = 5;

    let maxDimensionLabelWidth = 0;
    chartData.forEach(d => {
        const labelText = dimensionUnit ? `${d[dimensionFieldName]}${dimensionUnit}` : `${d[dimensionFieldName]}`;
        let textWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (fillStyle.images.field[d[dimensionFieldName]]) {
            textWidth += tempIconWidth + iconPadding;
        }
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, textWidth);
    });

    let maxValueLabelWidth = 0;
    chartData.forEach(d => {
        const valueText = valueUnit ? `${formatValue(d[valueFieldName])}${valueUnit}` : `${formatValue(d[valueFieldName])}`;
        // Using annotation font for value labels, but size will be dynamic. Use default for margin calculation.
        const textWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });

    chartMargins.left = Math.max(chartMargins.left, maxDimensionLabelWidth + 20); // Add padding
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 15); // Add padding for value labels outside bars

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const sortedDimensionNames = sortedData.map(d => d[dimensionFieldName]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2; // Fixed padding
    const yScale = d3.scaleBand()
        .domain(sortedDimensionNames)
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueFieldName]) * 1.05]) // Add 5% headroom
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // No axes or gridlines for this chart type as per original and requirements.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    sortedData.forEach(d => {
        const dimensionName = d[dimensionFieldName];
        const value = +d[valueFieldName];

        const barHeight = yScale.bandwidth();
        const barWidth = xScale(value);
        const yPos = yScale(dimensionName);
        
        if (yPos === undefined || barHeight === undefined || isNaN(barWidth)) {
            console.warn("Skipping data point due to invalid scale output:", d);
            return;
        }

        const barGroup = mainChartGroup.append("g")
            .attr("class", "mark bar-group")
            .attr("transform", `translate(0, ${yPos})`);

        const radius = barHeight / 2;

        barGroup.append("path")
            .attr("class", "mark bar")
            .attr("d", () => {
                if (barWidth <= radius * 2 && barWidth > 0) { // Draw a full circle if width is too small
                    return `
                        M ${radius},${0}
                        A ${radius},${radius} 0 0,1 ${radius},${barHeight}
                        A ${radius},${radius} 0 0,1 ${radius},${0}
                        Z
                    `;
                } else if (barWidth <= 0) {
                    return ""; // No path for zero or negative width
                }
                // Standard rounded bar
                return `
                    M ${radius},${0}
                    L ${barWidth - radius},${0}
                    A ${radius},${radius} 0 0,1 ${barWidth - radius},${barHeight}
                    L ${radius},${barHeight}
                    A ${radius},${radius} 0 0,1 ${radius},${0}
                    Z
                `;
            })
            .attr("fill", fillStyle.colors.barColor)
            .on("mouseover", function() {
                d3.select(this).attr("opacity", 0.8);
            })
            .on("mouseout", function() {
                d3.select(this).attr("opacity", 1);
            });

        // Dimension Label and Icon
        const iconHeight = barHeight * 0.9;
        const iconWidth = iconHeight * 1.33;
        const iconUrl = fillStyle.images.field[dimensionName];
        const labelYPos = barHeight / 2;

        let currentXOffset = -iconPadding; // Start from right to left

        // Dimension Text Label
        const dimensionText = dimensionUnit ? `${dimensionName}${dimensionUnit}` : dimensionName;
        const dimensionLabel = barGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("y", labelYPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(dimensionText);
        
        currentXOffset -= (dimensionLabel.node()?.getBBox()?.width || 0);
        dimensionLabel.attr("x", currentXOffset);


        // Icon
        if (iconUrl) {
            currentXOffset -= (iconPadding + iconWidth/2); // Adjust for icon center
            barGroup.append("image")
                .attr("class", "image icon dimension-icon")
                .attr("x", currentXOffset - iconWidth/2)
                .attr("y", labelYPos - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
            // currentXOffset -= (iconWidth + iconPadding); // This was causing double subtraction
        }


        // Value Label
        const dynamicValueFontSize = barHeight * 0.5; // Adjusted for better fit
        const formattedValueText = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
        
        const valueLabelWidth = estimateTextWidth(
            formattedValueText, 
            fillStyle.typography.annotationFontFamily, 
            `${dynamicValueFontSize}px`, 
            fillStyle.typography.annotationFontWeight
        );

        const spaceForLabelInside = barWidth - radius * 2 - 10; // 10px padding
        const labelFitsInside = valueLabelWidth < spaceForLabelInside;

        if (value > 0) { // Only show value label if value is positive
            const valueLabel = barGroup.append("text")
                .attr("class", "label value-label")
                .attr("y", barHeight / 2)
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${dynamicValueFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(formattedValueText);

            if (labelFitsInside) {
                valueLabel
                    .attr("x", barWidth - radius - 5) // 5px padding from the right edge of the straight part
                    .attr("text-anchor", "end")
                    .style("fill", fillStyle.colors.barLabelColor);
            } else {
                valueLabel
                    .attr("x", barWidth + 5) // 5px padding from the bar end
                    .attr("text-anchor", "start")
                    .style("fill", fillStyle.colors.textColor);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Hover effects are handled in Block 8. No other enhancements here.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}