/* REQUIREMENTS_BEGIN
{
  "chart_type": "Stacked Radial Bar Chart",
  "chart_name": "stacked_radial_bar_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 10], [0, "inf"], [2, 20]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "background_color", "text_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "yes",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "prominent",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    // Typography configuration
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const typographyConfig = {
        title: { ...defaultTypography.title, ...(data.typography && data.typography.title) },
        label: { ...defaultTypography.label, ...(data.typography && data.typography.label) },
        annotation: { ...defaultTypography.annotation, ...(data.typography && data.typography.annotation) }
    };

    // Color configuration (assuming dark theme context from original)
    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: d3.schemeCategory10,
        background_color: "#333333", // Default dark background
        text_color: "#FFFFFF"       // Default light text for dark background
    };
    const colorsInput = data.colors_dark || data.colors || {}; // Prefer colors_dark, fallback to colors
    const colorsConfig = {
        field: { ...defaultColors.field, ...(colorsInput.field) },
        other: { ...defaultColors.other, ...(colorsInput.other) },
        available_colors: colorsInput.available_colors ? colorsInput.available_colors : defaultColors.available_colors,
        background_color: colorsInput.background_color ? colorsInput.background_color : defaultColors.background_color,
        text_color: colorsInput.text_color ? colorsInput.text_color : defaultColors.text_color
    };
    
    // Image configuration (not used in this chart, but extracted per spec)
    // const imagesConfig = data.images || {};

    d3.select(containerSelector).html(""); // Clear container

    // Critical field name derivation
    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    if (!xFieldCol || !yFieldCol || !groupFieldCol) {
        const missingRoles = [
            !xFieldCol ? "'x'" : null,
            !yFieldCol ? "'y'" : null,
            !groupFieldCol ? "'group'" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: Roles ${missingRoles} not found in dataColumns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const groupFieldName = groupFieldCol.name;
    const yFieldUnit = (yFieldCol && yFieldCol.unit && yFieldCol.unit !== "none") ? yFieldCol.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title.font_family,
            titleFontSize: typographyConfig.title.font_size,
            titleFontWeight: typographyConfig.title.font_weight,
            labelFontFamily: typographyConfig.label.font_family,
            labelFontSize: typographyConfig.label.font_size,
            labelFontWeight: typographyConfig.label.font_weight,
            annotationFontFamily: typographyConfig.annotation.font_family,
            annotationFontSize: typographyConfig.annotation.font_size,
            annotationFontWeight: typographyConfig.annotation.font_weight,
        },
        textColor: colorsConfig.text_color,
        chartBackground: colorsConfig.background_color,
        gridLineColor: colorsConfig.other.grid_line || '#777777', // Softer grid for dark bg
        axisTickLabelColor: colorsConfig.text_color,
        categoryLabelColor: colorsConfig.text_color,
        dataLabelColor: colorsConfig.other.data_label_color || '#FFFFFF', // Default white for labels on colored bars
        legendRectFill: colorsConfig.other.legend_background || 'rgba(255, 255, 255, 0.9)',
        legendTextColor: colorsConfig.other.legend_text_color || '#000000', // Default black for text on light legend bg
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontProps.font_family);
        textNode.setAttribute('font-size', fontProps.font_size);
        textNode.setAttribute('font-weight', fontProps.font_weight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        try {
            return textNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on in-memory SVG might fail
            return text.length * (parseFloat(fontProps.font_size) || 12) * 0.6;
        }
    }
    
    const formatValueWithUnit = (value) => {
        let formattedValue;
        if (value >= 1000000000) {
            formattedValue = d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            formattedValue = d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            formattedValue = d3.format("~g")(value / 1000) + "K";
        } else {
            formattedValue = d3.format("~g")(value);
        }
        return formattedValue + yFieldUnit;
    };
    
    const uniqueGroupValues = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    const getColor = (groupValue) => {
        if (colorsConfig.field && colorsConfig.field[groupValue]) {
            return colorsConfig.field[groupValue];
        }
        const groupIndex = uniqueGroupValues.indexOf(groupValue);
        if (groupIndex !== -1 && colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[groupIndex % colorsConfig.available_colors.length];
        }
        return (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#CCCCCC';
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
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 40, bottom: 40, left: 40 }; // Original margins
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2 + 50; // Original offset
    const maxRadius = Math.min(chartWidth, chartHeight) / 2;
    
    // Block 5: Data Preprocessing & Transformation
    if (chartDataArray.length === 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .attr("fill", fillStyle.textColor)
            .text("No data available to display.");
        return svgRoot.node();
    }

    const stack = d3.stack()
        .keys(uniqueGroupValues)
        .value((d, key) => d[key] || 0);

    const groupedData = d3.group(chartDataArray, d => d[xFieldName]);
    const stackedDataInput = Array.from(groupedData, ([key, values]) => {
        const obj = { [xFieldName]: key };
        values.forEach(d => {
            obj[d[groupFieldName]] = d[yFieldName];
        });
        return obj;
    });

    const stackedSeries = stack(stackedDataInput);

    const nBars = stackedDataInput.length;
    if (nBars === 0) { // Should be caught by chartDataArray.length === 0, but as a safeguard
        svgRoot.append("text").attr("x", containerWidth/2).attr("y", containerHeight/2).attr("text-anchor", "middle").attr("fill", fillStyle.textColor).text("Not enough data for radial bars.");
        return svgRoot.node();
    }
    const minRadius = maxRadius * 0.2;
    const maxBarRadius = maxRadius * 0.95;
    const barWidth = (maxBarRadius - minRadius) / nBars * 0.7;
    const barGap = (maxBarRadius - minRadius) / nBars * 0.3;

    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(stackedSeries, series => d3.max(series, d => d[1])) || 1; // Ensure maxValue is at least 1
    const angleScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, 1.5 * Math.PI]); // Max 270 degrees

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "chart-area");

    // Radial Gridlines (Ticks)
    const numTicks = 5;
    const ticks = d3.range(0, maxValue + 1, maxValue / numTicks);
    ticks.forEach(tick => {
        if (tick > maxValue) return; // Don't draw tick beyond max
        mainChartGroup.append("path")
            .attr("class", "gridline")
            .attr("d", d3.arc()
                .innerRadius(minRadius)
                .outerRadius(maxBarRadius + barWidth * 0.5)
                .startAngle(angleScale(tick))
                .endAngle(angleScale(tick))
            )
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("fill", "none");

        mainChartGroup.append("text")
            .attr("class", "label tick-label")
            .attr("x", Math.cos(angleScale(tick) - Math.PI / 2) * (maxBarRadius + barWidth * 0.7))
            .attr("y", Math.sin(angleScale(tick) - Math.PI / 2) * (maxBarRadius + barWidth * 0.7))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.axisTickLabelColor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .text(formatValueWithUnit(tick));
    });
    
    // Legend
    const legendItemHeight = 20;
    const legendPadding = 10;
    const legendItems = stackedSeries.map(d => d.key);

    const legendFontProps = {
        font_family: fillStyle.typography.labelFontFamily,
        font_size: fillStyle.typography.labelFontSize,
        font_weight: fillStyle.typography.labelFontWeight
    };
    const maxTextWidth = d3.max(legendItems, item => estimateTextWidth(item, legendFontProps)) || 50;
    
    const legendCalculatedWidth = maxTextWidth + 15 /*swatch*/ + 5 /*gap*/ + 2 * legendPadding;
    const legendCalculatedHeight = legendItems.length * legendItemHeight + legendPadding; // Adjusted for items + top/bottom padding

    const legendX = containerWidth - legendCalculatedWidth - chartMargins.right + legendPadding; // Adjusted for padding
    const legendY = chartMargins.top;
    
    const legendGroup = svgRoot.append("g")
        .attr("transform", `translate(${legendX}, ${legendY})`)
        .attr("class", "legend");

    legendGroup.append("rect")
        .attr("class", "other legend-background")
        .attr("x", -legendPadding)
        .attr("y", 0) // Align with first item's baseline
        .attr("width", legendCalculatedWidth)
        .attr("height", legendCalculatedHeight)
        .attr("fill", fillStyle.legendRectFill)
        .attr("rx", 4)
        .attr("ry", 4);

    legendItems.forEach((itemKey, i) => {
        const legendItem = legendGroup.append("g")
            .attr("transform", `translate(0, ${i * legendItemHeight + legendPadding / 2})`) // Center items within padded area
            .attr("class", "legend-item");

        legendItem.append("rect")
            .attr("class", "mark legend-swatch")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", getColor(itemKey));

        legendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", 25)
            .attr("y", 12) // Vertically center text with swatch
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.legendTextColor)
            .text(itemKey);
    });


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const categoryLabelPadding = 20; // Original padding

    stackedSeries.forEach((series, seriesIndex) => {
        series.forEach((d, dataIndex) => {
            const innerR = minRadius + dataIndex * (barWidth + barGap);
            const outerR = innerR + barWidth;
            const startAngle = angleScale(d[0]);
            const endAngle = angleScale(d[1]);

            if (endAngle > startAngle) { // Only draw if there's an arc
                mainChartGroup.append("path")
                    .attr("class", "mark bar")
                    .attr("d", d3.arc()
                        .innerRadius(innerR)
                        .outerRadius(outerR)
                        .startAngle(startAngle)
                        .endAngle(endAngle)
                    )
                    .attr("fill", getColor(series.key));
            }

            // Category Labels (X-axis equivalent)
            if (seriesIndex === 0) { // Only draw for the first series to avoid overlap
                mainChartGroup.append("text")
                    .attr("class", "label category-label")
                    .attr("x", Math.cos(-Math.PI / 2) * (innerR + barWidth / 2) - categoryLabelPadding)
                    .attr("y", Math.sin(-Math.PI / 2) * (innerR + barWidth / 2))
                    .attr("text-anchor", "end")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", fillStyle.categoryLabelColor)
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", "bold") // Make category labels bold as per original
                    .text(d.data[xFieldName]);
            }

            // Data Value Labels
            const value = d[1] - d[0];
            if (value > maxValue * 0.08) { // Original threshold
                const formattedValue = formatValueWithUnit(value);
                const valueRadius = innerR + barWidth / 2;
                const valueTextPathId = `valueTextPath-${seriesIndex}-${dataIndex}`;
                
                const arcLengthForText = Math.abs(endAngle - startAngle) * valueRadius;
                const estimatedCharWidth = parseFloat(fillStyle.typography.annotationFontSize) * 0.5 || 4; // Rough estimate
                const valueTextLen = String(formattedValue).length * estimatedCharWidth;

                if (arcLengthForText > valueTextLen + 5) { // Add some padding
                    const midAngle = (startAngle + endAngle) / 2;
                    // Define path for text, ensuring it's within the bar's arc
                    // Simple approach: place text at midAngle, adjust startOffset of textPath
                    // More robust: define a shorter arc for the textPath itself
                    let textPathStartAngle = startAngle;
                    let textPathEndAngle = endAngle;
                    const textArcLengthRatio = Math.min(1, valueTextLen / arcLengthForText * 1.2); // *1.2 for some breathing room
                    
                    if (textArcLengthRatio < 1) {
                        const angleDiff = (endAngle - startAngle) * (1 - textArcLengthRatio) / 2;
                        textPathStartAngle = startAngle + angleDiff;
                        textPathEndAngle = endAngle - angleDiff;
                    }


                    mainChartGroup.append("path")
                        .attr("class", "other text-path")
                        .attr("id", valueTextPathId)
                        .attr("d", d3.arc()({
                            innerRadius: valueRadius,
                            outerRadius: valueRadius,
                            startAngle: textPathStartAngle, // Use adjusted angles
                            endAngle: textPathEndAngle
                        }))
                        .style("fill", "none")
                        .style("stroke", "none");

                    mainChartGroup.append("text")
                        .attr("class", "label value-label")
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", fillStyle.typography.annotationFontSize)
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .attr("fill", fillStyle.dataLabelColor)
                        .append("textPath")
                        .attr("xlink:href", `#${valueTextPathId}`)
                        .attr("startOffset", "50%") 
                        .attr("text-anchor", "middle") 
                        .attr("dominant-baseline", "middle") // Better for centering on path
                        .text(formattedValue);
                }
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements required by directives for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}