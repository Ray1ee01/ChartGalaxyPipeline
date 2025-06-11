/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Group Bar Chart",
  "chart_name": "horizontal_group_bar_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 10]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
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
  "valueSortDirection": "ascending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Could be data.colors_dark for dark themes, adapt if needed
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    if (!dimensionFieldConfig || !valueFieldConfig || !groupFieldConfig) {
        const missing = [];
        if (!dimensionFieldConfig) missing.push("dimension field (role: x)");
        if (!valueFieldConfig) missing.push("value field (role: y)");
        if (!groupFieldConfig) missing.push("group field (role: group)");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const dimensionFieldName = dimensionFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    let valueUnit = "";
    if (valueFieldConfig.unit && valueFieldConfig.unit !== "none") {
        valueUnit = valueFieldConfig.unit;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) ? typographyConfig.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) ? typographyConfig.title.font_size : '16px',
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) ? typographyConfig.title.font_weight : 'bold',
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        textColor: colorsConfig.text_color || '#0f223b',
        barLabelColor: '#FFFFFF', // Default for text inside bars
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        legendBackgroundColor: '#f5f5f5',
        legendBorderColor: '#cccccc',
        bracketLineColor: colorsConfig.text_color || '#0f223b',
        defaultCategoricalColors: d3.schemeCategory10
    };

    function getGroupColor(groupName, groupIndex, totalGroups) {
        if (colorsConfig.field && colorsConfig.field[groupName]) {
            return colorsConfig.field[groupName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[groupIndex % colorsConfig.available_colors.length];
        }
        return fillStyle.defaultCategoricalColors[groupIndex % fillStyle.defaultCategoricalColors.length];
    }

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('style', `font-family: ${fontFamily}; font-size: ${fontSize}; font-weight: ${fontWeight};`);
        textNode.textContent = text;
        svg.appendChild(textNode);
        // Document.body.appendChild(svg); // Temporarily append to measure accurately, then remove
        const width = textNode.getBBox().width;
        // Document.body.removeChild(svg);
        return width;
    }
    
    // In-memory text measurement (alternative, sometimes less accurate without DOM)
    const tempTextMeasure = (txt, fontFamily, fontSize, fontWeight) => {
        const context = document.createElement("canvas").getContext("2d");
        context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        return context.measureText(txt).width;
    };


    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.2s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.2s")(value / 1000) + "K";
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Defs are not strictly needed as complex effects are removed, but kept for structure
    const defs = svgRoot.append("defs");


    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin_top || 50,
        right: variables.margin_right || containerWidth * 0.35, // Adjusted for potential value labels
        bottom: variables.margin_bottom || 90, // For legend and y-axis label
        left: variables.margin_left || 40
    };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Icon dimensions (relative to bar height, which depends on yScale)
    // These will be calculated after yScale is defined, if icons are used.
    let iconWidth = 0, iconHeight = 0, iconRightPadding = 0;


    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [valueFieldName]: +d[valueFieldName] // Ensure value is numeric
    }));

    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort(); // Sort groups for consistent legend order

    chartDataArray.sort((a, b) => {
        const valueComparison = a[valueFieldName] - b[valueFieldName];
        if (valueComparison !== 0) return valueComparison;
        return String(a[dimensionFieldName]).localeCompare(String(b[dimensionFieldName]));
    });

    const dimensions = [...new Set(chartDataArray.map(d => d[dimensionFieldName]))]; // Order based on sorted data


    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartDataArray, d => d[valueFieldName]) || 0;
    const xScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, innerWidth])
        .nice();

    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.2); // Adjust padding between bars

    const actualBarHeight = yScale.bandwidth() * 0.85; // Make bars slightly smaller than bandwidth for spacing

    // Recalculate icon dimensions based on actualBarHeight
    iconWidth = actualBarHeight * 0.8;
    iconHeight = iconWidth;
    iconRightPadding = -iconWidth * 0.2; // Slight overlap or just before bar start


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Legend
    const legendItemHeight = 20;
    const legendPadding = 5;
    const legendSymbolSize = 10;
    const legendYStart = innerHeight + chartMargins.top / 2 + 10; // Position below chart
    
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${legendYStart})`);

    let currentX = 0;
    const legendMaxFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    
    // Estimate common font size for legend items
    let commonLegendFontSize = legendMaxFontSize;
    if (groups.length > 0) {
        const availableLegendWidth = innerWidth / groups.length;
        groups.forEach(group => {
            let textFits = false;
            let fontSize = legendMaxFontSize;
            while (!textFits && fontSize > 6) {
                const textWidth = estimateTextWidth(
                    group.toUpperCase(),
                    fillStyle.typography.annotationFontFamily,
                    `${fontSize}px`,
                    fillStyle.typography.annotationFontWeight
                );
                if (textWidth + legendSymbolSize + legendPadding * 2 < availableLegendWidth * 0.95) { // 0.95 for some buffer
                    textFits = true;
                } else {
                    fontSize -= 0.5;
                }
            }
            commonLegendFontSize = Math.min(commonLegendFontSize, fontSize);
        });
    }


    groups.forEach((group, i) => {
        const groupColor = getGroupColor(group, i, groups.length);
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, 0)`);

        legendItem.append("rect")
            .attr("x", 0)
            .attr("y", (legendItemHeight - legendSymbolSize) / 2)
            .attr("width", legendSymbolSize)
            .attr("height", legendSymbolSize)
            .attr("fill", groupColor)
            .attr("class", "mark legend-symbol");

        const legendText = legendItem.append("text")
            .attr("x", legendSymbolSize + legendPadding)
            .attr("y", legendItemHeight / 2)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${commonLegendFontSize}px`)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group.toUpperCase())
            .attr("class", "label legend-text");
        
        currentX += legendSymbolSize + legendPadding + legendText.node().getBBox().width + legendPadding * 2;
    });
    
    // Reposition legend group if it overflows (simple centering for now)
    const legendTotalWidth = currentX - legendPadding * 2;
    if (legendTotalWidth > innerWidth) {
        // Handle overflow, e.g. multiple rows or smaller font. For now, just center.
        legendGroup.attr("transform", `translate(${chartMargins.left + (innerWidth - legendTotalWidth)/2}, ${legendYStart})`);
    } else {
         legendGroup.attr("transform", `translate(${chartMargins.left + (innerWidth - legendTotalWidth)/2}, ${legendYStart})`);
    }


    // Block 8: Main Data Visualization Rendering
    const barPositionsByValue = {};

    chartDataArray.forEach(d => {
        const dimensionValue = d[dimensionFieldName];
        const value = d[valueFieldName];
        const groupValue = d[groupFieldName];
        const groupIndex = groups.indexOf(groupValue);

        const barColor = getGroupColor(groupValue, groupIndex, groups.length);
        const barY = yScale(dimensionValue);
        const barCenterY = barY + yScale.bandwidth() / 2;

        mainChartGroup.append("rect")
            .attr("class", "mark bar")
            .attr("x", 0)
            .attr("y", barY + (yScale.bandwidth() - actualBarHeight) / 2)
            .attr("width", xScale(value))
            .attr("height", actualBarHeight)
            .attr("fill", barColor);

        // Dimension label inside bar (adaptive font size)
        let dimensionLabelFontSize = actualBarHeight * 0.6;
        let textFits = false;
        const maxTextWidth = xScale(value) - (imagesConfig.field && imagesConfig.field[dimensionValue] ? iconWidth : 0) - 10; // 10px padding

        if (maxTextWidth > 10) { // Only attempt if there's some space
            while (!textFits && dimensionLabelFontSize > 6) {
                const textWidth = estimateTextWidth(
                    dimensionValue,
                    fillStyle.typography.labelFontFamily,
                    `${dimensionLabelFontSize}px`,
                    fillStyle.typography.labelFontWeight
                );
                if (textWidth < maxTextWidth) {
                    textFits = true;
                } else {
                    dimensionLabelFontSize -= 1;
                }
            }

            if (textFits) {
                mainChartGroup.append("text")
                    .attr("class", "label dimension-label")
                    .attr("x", (imagesConfig.field && imagesConfig.field[dimensionValue] ? iconWidth * 0.9 : 5)) // Position after icon or small padding
                    .attr("y", barCenterY)
                    .attr("dy", "0.35em")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", `${dimensionLabelFontSize}px`)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.barLabelColor)
                    .style("pointer-events", "none")
                    .text(dimensionValue);
            }
        }


        // Collect bar center positions for value labels
        if (!barPositionsByValue[value]) {
            barPositionsByValue[value] = [];
        }
        barPositionsByValue[value].push(barCenterY);
    });

    // Value labels (bracketed for groups with same value)
    Object.keys(barPositionsByValue).forEach(valueStr => {
        const value = +valueStr;
        const centers = barPositionsByValue[value].sort((a, b) => a - b);
        const labelText = valueUnit ? formatValue(value) + valueUnit : formatValue(value);
        const labelX = xScale(value) + 5;

        if (centers.length === 1) {
            mainChartGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", labelX)
                .attr("y", centers[0])
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(labelText);
        } else {
            const topY = centers[0] - actualBarHeight / 2;
            const bottomY = centers[centers.length - 1] + actualBarHeight / 2;
            const midY = (topY + bottomY) / 2;
            const fontSizeNum = parseFloat(fillStyle.typography.annotationFontSize) || 10;
            const textOffset = fontSizeNum * 0.6;
            const bracketWidth = 8;

            // Paths for bracket lines
            const bracketPath = `M ${labelX},${topY} H ${labelX + bracketWidth} M ${labelX},${bottomY} H ${labelX + bracketWidth} M ${labelX + bracketWidth},${topY} V ${midY - textOffset} M ${labelX + bracketWidth},${midY + textOffset} V ${bottomY}`;
            
            mainChartGroup.append("path")
                .attr("class", "other bracket-line")
                .attr("d", bracketPath)
                .attr("fill", "none")
                .attr("stroke", fillStyle.bracketLineColor)
                .attr("stroke-width", 1);

            mainChartGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", labelX + bracketWidth + 2) // Text after the vertical part of bracket
                .attr("y", midY)
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(labelText);
        }
    });


    // Block 9: Optional Enhancements & Post-Processing
    // Icons next to bars
    chartDataArray.forEach(d => {
        const dimensionValue = d[dimensionFieldName];
        const imageUrl = imagesConfig.field && imagesConfig.field[dimensionValue];

        if (imageUrl) {
            const barY = yScale(dimensionValue);
            const barCenterY = barY + yScale.bandwidth() / 2;

            mainChartGroup.append("image")
                .attr("class", "icon image dimension-icon")
                .attr("x", iconRightPadding - iconWidth / 2) // Centering the icon relative to iconRightPadding
                .attr("y", barCenterY - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", imageUrl)
                .attr("transform", `translate(${-iconWidth*0.5},0)`); // Adjust icon position to be to the left of the bar start
        }
    });

    // Y-axis "label" (descriptive text, not a formal D3 axis)
    const yAxisLabelText = valueFieldName; // Using the field name as label
    if (yAxisLabelText) {
        const yAxisLabelElement = svgRoot.append("text")
            .attr("class", "label y-axis-description")
            .attr("text-anchor", "middle")
            .attr("transform", `translate(${chartMargins.left / 2 - 10}, ${chartMargins.top + innerHeight / 2}) rotate(-90)`) // Position to the left, rotated
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(yAxisLabelText + (valueUnit ? ` (${valueUnit})` : ''));
    }


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}