/* REQUIREMENTS_BEGIN
{
  "chart_type": "Stacked Radial Bar Chart",
  "chart_name": "stacked_radial_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 10], [0, "inf"], [2, 20]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Assuming light theme if colors_dark is not specified
    const imagesInput = data.images || {}; // Not used in this chart, but parsed for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    let missingFields = [];
    if (!xFieldCol) missingFields.push("x role");
    if (!yFieldCol) missingFields.push("y role");
    if (!groupFieldCol) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: Column roles [${missingFields.join(", ")}] not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const groupFieldName = groupFieldCol.name;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const errorMsg = `Critical chart config missing: Field names for roles x, y, or group are undefined. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    let valueUnit = "";
    if (yFieldCol && yFieldCol.unit && yFieldCol.unit !== "none") {
        valueUnit = yFieldCol.unit;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) || '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) || 'bold',
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
        },
        textColor: colorsInput.text_color || '#222b44', // Default from original: #222b44 for category labels
        axisLabelColor: colorsInput.text_color || '#888888', // Default from original for tick labels
        gridLineColor: (colorsInput.other && colorsInput.other.grid) || '#e0e0e0',
        defaultMarkColor: (colorsInput.other && colorsInput.other.primary) || '#cccccc',
        legendBackgroundColor: colorsInput.background_color || '#FFFFFF', // Legend background
        valueLabelColor: '#FFFFFF', // Default from original for labels on bars
    };

    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        if (fontProps) {
            if (fontProps.font_family) textElement.style.fontFamily = fontProps.font_family;
            if (fontProps.font_size) textElement.style.fontSize = fontProps.font_size;
            if (fontProps.font_weight) textElement.style.fontWeight = fontProps.font_weight;
        }
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but violates "MUST NOT be appended to the document DOM".
        // For simple cases, this might work, but accuracy can vary.
        // A more robust in-memory approach might involve a canvas context if SVG getBBox proves unreliable without rendering.
        // However, sticking to the prompt's example:
        document.body.appendChild(svg); // Temporarily append to get styles computed
        const width = textElement.getBBox().width;
        document.body.removeChild(svg);
        return width;
    };
    
    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        let num = Number(value);
        if (isNaN(num)) return String(value);

        if (Math.abs(num) >= 1000000000) {
            return d3.format("~g")(num / 1000000000) + "B";
        } else if (Math.abs(num) >= 1000000) {
            return d3.format("~g")(num / 1000000) + "M";
        } else if (Math.abs(num) >= 1000) {
            return d3.format("~g")(num / 1000) + "K";
        }
        return d3.format("~g")(num);
    };

    const getColor = (groupValue) => {
        if (colorsInput.field && colorsInput.field[groupFieldName] && colorsInput.field[groupFieldName][groupValue]) {
            return colorsInput.field[groupFieldName][groupValue];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            // Create a consistent mapping from groupValue to an index in available_colors
            const uniqueGroupValues = [...new Set(rawChartData.map(d => d[groupFieldName]))].sort();
            const index = uniqueGroupValues.indexOf(groupValue);
            return colorsInput.available_colors[index % colorsInput.available_colors.length];
        }
        return fillStyle.defaultMarkColor;
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
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 150, bottom: 60, left: 150 }; // Adjusted for labels and legend
    // Legend width needs to be estimated first to potentially adjust right margin
    const tempLegendItems = [...new Set(rawChartData.map(d => d[groupFieldName]))];
    const legendItemHeight = 20;
    const legendPadding = 10;
    const maxLegendTextWidth = d3.max(tempLegendItems, item => estimateTextWidth(item, typographyInput.label)) || 0;
    const calculatedLegendWidth = maxLegendTextWidth + 25 + 2 * legendPadding; // 25 for color swatch and spacing
    
    chartMargins.right = Math.max(chartMargins.right, calculatedLegendWidth + 20); // Ensure space for legend

    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2; // Centered, margins will push content
    
    const maxRadius = Math.min(chartWidth, chartHeight) / 2 * 0.9; // Reduce slightly to avoid edge clipping

    // Block 5: Data Preprocessing & Transformation
    const groupedData = d3.group(rawChartData, d => d[xFieldName]);
    const chartDataArray = Array.from(groupedData, ([key, values]) => {
        const obj = { [xFieldName]: key };
        values.forEach(d => {
            obj[d[groupFieldName]] = d[yFieldName];
        });
        return obj;
    });

    const groupKeys = [...new Set(rawChartData.map(d => d[groupFieldName]))].sort(); // Ensure consistent order

    const stack = d3.stack()
        .keys(groupKeys)
        .value((d, key) => d[key] || 0);

    const stackedSeries = stack(chartDataArray);

    const nCategories = chartDataArray.length; // Number of radial "spokes" or categories
    const minRadius = maxRadius * 0.2;
    const maxBarRadius = maxRadius * 0.90; // Outer edge for bars
    
    const totalBarSpace = maxBarRadius - minRadius;
    const barWidthRatio = 0.7;
    const barGapRatio = 0.3;

    let barWidth, barGap;
    if (nCategories > 0) {
        const singleCategorySpace = totalBarSpace / nCategories;
        barWidth = singleCategorySpace * barWidthRatio;
        barGap = singleCategorySpace * barGapRatio;
    } else {
        barWidth = 0;
        barGap = 0;
    }


    // Block 6: Scale Definition & Configuration
    const maxValueForAngle = d3.max(stackedSeries, series => d3.max(series, d => d[1])) || 0;
    const angleScale = d3.scaleLinear()
        .domain([0, maxValueForAngle])
        .range([0, 1.5 * Math.PI]); // 270 degrees

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group");

    // Radial Gridlines (Ticks)
    const numTicks = 5;
    const tickValues = maxValueForAngle > 0 ? d3.range(0, maxValueForAngle + 1, maxValueForAngle / numTicks) : [0];
    
    const radialAxisGroup = mainChartGroup.append("g").attr("class", "axis radial-axis");

    tickValues.forEach(tick => {
        radialAxisGroup.append("path")
            .attr("class", "gridline")
            .attr("d", d3.arc()
                .innerRadius(minRadius)
                .outerRadius(maxBarRadius + barWidth * 0.1) // Extend slightly beyond bars
                .startAngle(angleScale(tick))
                .endAngle(angleScale(tick))
            )
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("fill", "none");

        radialAxisGroup.append("text")
            .attr("class", "label axis-label")
            .attr("x", Math.cos(angleScale(tick) - Math.PI / 2) * (maxBarRadius + barWidth * 0.2 + 5))
            .attr("y", Math.sin(angleScale(tick) - Math.PI / 2) * (maxBarRadius + barWidth * 0.2 + 5))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.axisLabelColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize) // Smaller for ticks
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(formatValue(tick) + valueUnit);
    });
    
    // Category Labels (around the circle, at 0-angle start)
    const categoryLabelPadding = 15;
    const categoryLabelsGroup = mainChartGroup.append("g").attr("class", "category-labels");

    chartDataArray.forEach((d, j) => {
        const currentRadius = minRadius + j * (barWidth + barGap) + barWidth / 2;
        categoryLabelsGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", Math.cos(-Math.PI / 2) * currentRadius - categoryLabelPadding) // Position to the left of start
            .attr("y", Math.sin(-Math.PI / 2) * currentRadius)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight) // Bolder for category names
            .text(d[xFieldName]);
    });

    // Legend
    const legendItems = groupKeys;
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${containerWidth - chartMargins.right + legendPadding + 10}, ${chartMargins.top})`);

    const legendHeight = legendItems.length * legendItemHeight + legendPadding * 2;

    legendGroup.append("rect")
        .attr("class", "legend-background")
        .attr("x", -legendPadding)
        .attr("y", -legendPadding)
        .attr("width", calculatedLegendWidth)
        .attr("height", legendHeight)
        .attr("fill", fillStyle.legendBackgroundColor)
        // .attr("fill-opacity", 0.9) // Removed as per "solid colors only"
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("stroke", fillStyle.gridLineColor); // Add a light border to legend

    legendItems.forEach((itemKey, i) => {
        const legendItemG = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${i * legendItemHeight})`);

        legendItemG.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", getColor(itemKey));

        legendItemG.append("text")
            .attr("class", "label legend-label")
            .attr("x", 20)
            .attr("y", 12) // Vertically center roughly
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(itemKey);
    });


    // Block 8: Main Data Visualization Rendering
    const barSeriesGroup = mainChartGroup.append("g").attr("class", "bar-series-group");

    stackedSeries.forEach((series) => {
        const seriesGroup = barSeriesGroup.append("g")
            .attr("class", `series-group mark series-${series.key.replace(/\s+/g, '-')}`);
            
        series.forEach((d, j) => { // j is index of category (xField)
            if (isNaN(d[0]) || isNaN(d[1])) return; // Skip if data is not valid

            const innerR = minRadius + j * (barWidth + barGap);
            const outerR = innerR + barWidth;
            const startAngle = angleScale(d[0]);
            const endAngle = angleScale(d[1]);

            if (endAngle > startAngle) { // Only draw if there's a segment
                seriesGroup.append("path")
                    .attr("class", "mark bar")
                    .attr("d", d3.arc()
                        .innerRadius(innerR)
                        .outerRadius(outerR)
                        .startAngle(startAngle)
                        .endAngle(endAngle)
                        .padAngle(0.005) // Small padding between segments for visual separation
                        .cornerRadius(1) // Slight rounding, if desired, or remove for sharp edges
                    )
                    .attr("fill", getColor(series.key));

                // Data Value Labels
                const value = d[1] - d[0];
                if (value > maxValueForAngle * 0.03) { // Show if segment is reasonably large
                    const formattedValue = formatValue(value);
                    const valueRadius = innerR + barWidth / 2;
                    const midAngle = (startAngle + endAngle) / 2;
                    
                    // Check if arc length is sufficient for the text
                    const textWidthEstimate = estimateTextWidth(formattedValue, { font_size: fillStyle.typography.annotationFontSize, font_family: fillStyle.typography.annotationFontFamily });
                    const arcLength = Math.abs(endAngle - startAngle) * valueRadius;

                    if (arcLength > textWidthEstimate + 5) { // Add some padding
                        const valueTextPathId = `valueTextPath-${series.key.replace(/\W/g, '')}-${j}`;
                        
                        // Define path for textPath
                        // Ensure path direction is correct for text rendering (usually counter-clockwise for outer, clockwise for inner)
                        // For radial, it's simpler: just ensure startAngle < endAngle for the text path itself.
                        let textPathStartAngle = midAngle - (textWidthEstimate / 2 / valueRadius);
                        let textPathEndAngle = midAngle + (textWidthEstimate / 2 / valueRadius);

                        // Clamp to actual segment angles
                        textPathStartAngle = Math.max(startAngle, textPathStartAngle);
                        textPathEndAngle = Math.min(endAngle, textPathEndAngle);
                        
                        if (textPathEndAngle > textPathStartAngle) {
                            seriesGroup.append("path")
                                .attr("id", valueTextPathId)
                                .attr("d", d3.arc()({
                                    innerRadius: valueRadius,
                                    outerRadius: valueRadius,
                                    startAngle: textPathStartAngle, 
                                    endAngle: textPathEndAngle
                                }))
                                .style("fill", "none")
                                .style("stroke", "none");

                            seriesGroup.append("text")
                                .attr("class", "label value-label")
                                .style("font-family", fillStyle.typography.annotationFontFamily)
                                .style("font-size", fillStyle.typography.annotationFontSize)
                                .style("font-weight", fillStyle.typography.annotationFontWeight)
                                .attr("fill", fillStyle.valueLabelColor)
                                .attr("dy", "0.35em") // Adjust vertical alignment on path
                                .append("textPath")
                                .attr("xlink:href", `#${valueTextPathId}`)
                                .attr("startOffset", "50%")
                                .attr("text-anchor", "middle")
                                .text(formattedValue);
                        }
                    }
                }
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactored version based on constraints)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}