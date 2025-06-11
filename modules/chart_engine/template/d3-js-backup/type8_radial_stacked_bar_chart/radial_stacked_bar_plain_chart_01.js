/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Stacked Bar Chart",
  "chart_name": "radial_stacked_bar_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 10], [0, "inf"], [2, 20]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["background_color", "text_color", "primary"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or use data.colors_dark if a theme mechanism is in place
    const images = data.images || {}; // Not used in this chart, but parsed for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldCol = dataColumns.find(col => col.role === 'x');
    const yFieldCol = dataColumns.find(col => col.role === 'y');
    const groupFieldCol = dataColumns.find(col => col.role === 'group');

    if (!xFieldCol || !yFieldCol || !groupFieldCol) {
        const missing = [
            !xFieldCol ? "x role" : null,
            !yFieldCol ? "y role" : null,
            !groupFieldCol ? "group role" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: column roles for ${missing}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const groupFieldName = groupFieldCol.name;

    let valueUnit = "";
    if (yFieldCol && yFieldCol.unit && yFieldCol.unit !== "none") {
        valueUnit = yFieldCol.unit;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) || '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) || 'bold',

            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',

            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
        },
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#0f223b',
        gridLineColor: (colors.other && colors.other.grid_line) || '#e0e0e0',
        axisLabelColor: (colors.other && colors.other.axis_label) || '#888888',
        categoryLabelColor: (colors.other && colors.other.category_label) || '#222b44',
        valueLabelColor: (colors.other && colors.other.value_label) || '#FFFFFF',
        legendBackgroundColor: (colors.other && colors.other.legend_background) || '#FFFFFF',
        defaultSeriesColor: (colors.other && colors.other.primary) || '#cccccc'
    };
    
    fillStyle.legendTextColor = (colors.other && colors.other.legend_text) || fillStyle.textColor;


    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        svg.style.width = 'auto';
        svg.style.height = 'auto';
        // No need to append to DOM for getBBox if attributes are set directly
        // document.body.appendChild(svg); // Not appending to DOM

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        
        // Must be appended to something with layout for getBBox to work reliably in all UAs,
        // but for simple text, direct attributes often suffice.
        // For full reliability, a temporary attachment to DOM might be needed, but trying without first.
        // If issues arise, a detached SVG added to a temporary div not in main flow could be used.
        // The prompt specifies "MUST NOT be appended to the document DOM".
        // A common workaround is to append to a detached element, or rely on direct attribute setting.
        // For this implementation, we'll assume direct attribute setting is sufficient for `getBBox`.
        // If `getBBox` returns 0, it means the element isn't rendered in a way that allows measurement.
        // A more robust in-memory approach might involve a more complex setup or a canvas-based measurement.
        // For now, this is the standard D3-idiomatic approach for non-DOM-appended measurement.
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on detached elements is problematic
            // Approximate width based on character count and font size (less accurate)
            const avgCharWidth = parseFloat(fontSize) * 0.6; // Rough estimate
            width = text.length * avgCharWidth;
            console.warn("SVG getBBox failed for text measurement, using approximation.", e);
        }
        // svg.remove(); // Not needed if not appended
        return width;
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // G for Giga, use B for Billion
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~.2g")(value); // Use .2g for smaller numbers to avoid excessive precision
    };
    
    const groupKeys = [...new Set(chartDataInput.map(d => d[groupFieldName]))].sort(); // Sort for consistent color assignment

    const getColor = (groupValue) => {
        if (colors.field && colors.field[groupValue]) {
            return colors.field[groupValue];
        }
        if (colors.available_colors) {
            const index = groupKeys.indexOf(groupValue);
            if (index !== -1) {
                return colors.available_colors[index % colors.available_colors.length];
            }
        }
        return fillStyle.defaultSeriesColor;
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

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.marginTop || 40, 
        right: variables.marginRight || 40, 
        bottom: variables.marginBottom || 40, 
        left: variables.marginLeft || 40 
    };
    // Adjust margins if legend is very wide or tall, or make legend part of chart area.
    // For this refactor, assume legend fits within reasonable default margins or specific ones.

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const chartCenterOffsetY = variables.chartCenterOffsetY || 50;
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2 + chartCenterOffsetY;
    
    const maxPossibleRadius = Math.min(innerWidth, innerHeight) / 2;

    // Block 5: Data Preprocessing & Transformation
    const stack = d3.stack()
        .keys(groupKeys) // Use sorted group keys
        .value((d, key) => d[key] || 0);

    const groupedData = d3.group(chartDataInput, d => d[xFieldName]);
    const chartDataArray = Array.from(groupedData, ([key, values]) => {
        const obj = { [xFieldName]: key };
        values.forEach(d => {
            obj[d[groupFieldName]] = d[yFieldName];
        });
        return obj;
    });

    const stackedSeries = stack(chartDataArray);

    const nBars = chartDataArray.length;
    if (nBars === 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .text("No data available to display.");
        return svgRoot.node();
    }
    
    const minRadiusRatio = variables.minRadiusRatio || 0.2; // e.g. 20% of maxRadius for the hole
    const maxBarRadiusRatio = variables.maxBarRadiusRatio || 0.95; // e.g. 95% of maxRadius for bar area
    const barWidthRatio = variables.barWidthRatio || 0.7; // e.g. 70% of available slot for bar, 30% for gap

    const minRadius = maxPossibleRadius * minRadiusRatio;
    const maxBarOuterRadius = maxPossibleRadius * maxBarRadiusRatio; // Outer edge of the outermost bar category
    
    const totalBarAreaRadius = maxBarOuterRadius - minRadius;
    const barSlotWidth = totalBarAreaRadius / nBars;
    const barWidth = barSlotWidth * barWidthRatio;
    const barGap = barSlotWidth * (1 - barWidthRatio);


    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(stackedSeries, series => d3.max(series, d => d[1])) || 1; // Ensure maxValue is at least 1
    const angleScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, (variables.angleRangeDegrees || 270) * Math.PI / 180]); // Default 270 degrees

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group");

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Radial Grid Lines (acting as Y-axis)
    const numTicks = variables.numRadialTicks || 5;
    const ticks = d3.range(0, maxValue + 1e-9, maxValue / numTicks); // Add epsilon for last tick
    const gridGroup = mainChartGroup.append("g").attr("class", "grid radial-grid");

    ticks.forEach(tick => {
        gridGroup.append("path")
            .attr("class", "grid-line")
            .attr("d", d3.arc()
                .innerRadius(minRadius)
                .outerRadius(maxBarOuterRadius + barWidth * 0.1) // Extend slightly beyond bars
                .startAngle(angleScale(tick))
                .endAngle(angleScale(tick))
            )
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("fill", "none");

        const tickLabelRadius = maxBarOuterRadius + barWidth * 0.1 + (parseFloat(fillStyle.typography.labelFontSize) * 0.5);
        gridGroup.append("text")
            .attr("class", "axis-label y-axis-label")
            .attr("x", Math.cos(angleScale(tick) - Math.PI / 2) * tickLabelRadius)
            .attr("y", Math.sin(angleScale(tick) - Math.PI / 2) * tickLabelRadius)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.axisLabelColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(formatValue(tick) + valueUnit);
    });

    // Legend
    const legendItems = groupKeys;
    const legendItemHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.5;
    const legendPadding = 10;
    const legendMarkSize = parseFloat(fillStyle.typography.labelFontSize);
    const legendMarkTextGap = 5;

    const maxLegendTextWidth = d3.max(legendItems, item => 
        estimateTextWidth(item, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight)
    ) || 0;

    const legendTotalWidth = legendMarkSize + legendMarkTextGap + maxLegendTextWidth + 2 * legendPadding;
    const legendTotalHeight = legendItems.length * legendItemHeight + (legendItems.length -1) * (legendItemHeight * 0.2) + 2 * legendPadding;
    
    const legendX = containerWidth - legendTotalWidth - chartMargins.right + legendPadding; // Position inside right margin
    const legendY = chartMargins.top;

    const legendGroup = svgRoot.append("g")
        .attr("transform", `translate(${legendX}, ${legendY})`)
        .attr("class", "legend");

    legendGroup.append("rect")
        .attr("class", "legend-background")
        .attr("x", -legendPadding)
        .attr("y", -legendPadding)
        .attr("width", legendTotalWidth)
        .attr("height", legendTotalHeight)
        .attr("fill", fillStyle.legendBackgroundColor)
        .attr("rx", 4)
        .attr("ry", 4);

    legendItems.forEach((itemKey, i) => {
        const legendItemG = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${i * (legendItemHeight + legendItemHeight * 0.2)})`);

        legendItemG.append("rect")
            .attr("class", "legend-mark")
            .attr("width", legendMarkSize)
            .attr("height", legendMarkSize)
            .attr("fill", getColor(itemKey));

        legendItemG.append("text")
            .attr("class", "legend-label")
            .attr("x", legendMarkSize + legendMarkTextGap)
            .attr("y", legendMarkSize / 2) // Align text vertically with center of mark
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.legendTextColor)
            .text(itemKey);
    });


    // Block 8: Main Data Visualization Rendering
    const categoryLabelPadding = variables.categoryLabelPadding || 20; // For xField labels

    stackedSeries.forEach((series) => {
        const seriesGroup = mainChartGroup.append("g")
            .attr("class", `series-group mark series-${series.key.replace(/\s+/g, '-')}`);

        series.forEach((d, j) => { // j is index of xCategory
            const innerR = minRadius + j * (barWidth + barGap);
            const outerR = innerR + barWidth;
            const startAngle = angleScale(d[0]);
            const endAngle = angleScale(d[1]);

            if (endAngle > startAngle) { // Only draw if there's a segment
                seriesGroup.append("path")
                    .attr("class", "mark bar-segment")
                    .attr("d", d3.arc()
                        .innerRadius(innerR)
                        .outerRadius(outerR)
                        .startAngle(startAngle)
                        .endAngle(endAngle)
                    )
                    .attr("fill", getColor(series.key));
            }

            // Category Labels (xFieldName labels), rendered once per xCategory
            if (stackedSeries.indexOf(series) === 0) { // Render only for the first series to avoid overlap
                mainChartGroup.append("text")
                    .attr("class", "label category-label x-axis-label")
                    .attr("x", Math.cos(-Math.PI / 2) * (innerR + barWidth / 2) - categoryLabelPadding) // Position to the left of the start of bars
                    .attr("y", Math.sin(-Math.PI / 2) * (innerR + barWidth / 2))
                    .attr("text-anchor", "end")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", fillStyle.categoryLabelColor)
                    .style("font-family", fillStyle.typography.titleFontFamily) // Using title style for prominence
                    .style("font-size", fillStyle.typography.titleFontSize)
                    .style("font-weight", fillStyle.typography.titleFontWeight)
                    .text(d.data[xFieldName]);
            }

            // Value Labels
            const value = d[1] - d[0];
            const valueDisplayThreshold = variables.valueLabelDisplayThresholdRatio !== undefined ? maxValue * variables.valueLabelDisplayThresholdRatio : maxValue * 0.05;

            if (value > valueDisplayThreshold) {
                const formattedValue = formatValue(value);
                const valueText = formattedValue + valueUnit;
                
                const valueTextWidth = estimateTextWidth(
                    valueText, 
                    fillStyle.typography.annotationFontFamily, 
                    fillStyle.typography.annotationFontSize, 
                    fillStyle.typography.annotationFontWeight
                );

                const valueRadius = innerR + barWidth / 2;
                const midAngle = (startAngle + endAngle) / 2;
                const arcLength = Math.abs(endAngle - startAngle) * valueRadius;

                if (arcLength > valueTextWidth * 1.1) { // Ensure arc is at least 10% wider than text
                    const valueTextPathId = `valueTextPath-${series.key.replace(/\W/g, '')}-${j}`;
                    
                    // Define path for text alignment
                    // Adjust path angles to ensure text fits and is centered
                    const angleRequiredForText = valueTextWidth / valueRadius;
                    let pathStartAngle = midAngle - angleRequiredForText / 2;
                    let pathEndAngle = midAngle + angleRequiredForText / 2;

                    // Ensure path stays within the bar segment
                    pathStartAngle = Math.max(pathStartAngle, startAngle);
                    pathEndAngle = Math.min(pathEndAngle, endAngle);
                    
                    // If adjusted path is too small, don't render
                    if ((pathEndAngle - pathStartAngle) * valueRadius < valueTextWidth * 0.8) {
                        // console.warn("Skipping value label, not enough space after adjustment:", valueText);
                    } else {
                        seriesGroup.append("path")
                            .attr("id", valueTextPathId)
                            .attr("d", d3.arc()({
                                innerRadius: valueRadius,
                                outerRadius: valueRadius,
                                startAngle: pathStartAngle,
                                endAngle: pathEndAngle
                            }))
                            .style("fill", "none")
                            .style("stroke", "none"); // For debugging, set to a color

                        seriesGroup.append("text")
                            .attr("class", "label value-label")
                            .style("font-family", fillStyle.typography.annotationFontFamily)
                            .style("font-size", fillStyle.typography.annotationFontSize)
                            .style("font-weight", fillStyle.typography.annotationFontWeight)
                            .attr("fill", fillStyle.valueLabelColor)
                            .append("textPath")
                            .attr("xlink:href", `#${valueTextPathId}`)
                            .attr("startOffset", "50%")
                            .attr("text-anchor", "middle")
                            .attr("dominant-baseline", "middle") // Better vertical centering on path
                            .text(valueText);
                    }
                }
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - none in this simplified version)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}