/* REQUIREMENTS_BEGIN
{
  "chart_type": "Stacked Bar Chart with Transitions",
  "chart_name": "stacked_bar_transitions_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, "inf"], [0, "inf"], [2, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming dark theme preference if both exist, or just one.
    const imagesConfig = data.images || {}; // Not used in this chart, but extracted per spec.
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    let missingConfigs = [];
    if (!xFieldConfig) missingConfigs.push("x field configuration (role: 'x')");
    if (!yFieldConfig) missingConfigs.push("y field configuration (role: 'y')");
    if (!groupFieldConfig) missingConfigs.push("group field configuration (role: 'group')");

    if (missingConfigs.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingConfigs.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = (typographyConfig.title && typographyConfig.title.font_family) || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = (typographyConfig.title && typographyConfig.title.font_size) || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = (typographyConfig.title && typographyConfig.title.font_weight) || defaultTypography.title.font_weight;

    fillStyle.typography.labelFontFamily = (typographyConfig.label && typographyConfig.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (typographyConfig.label && typographyConfig.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (typographyConfig.label && typographyConfig.label.font_weight) || defaultTypography.label.font_weight;
    
    fillStyle.typography.annotationFontFamily = (typographyConfig.annotation && typographyConfig.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (typographyConfig.annotation && typographyConfig.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (typographyConfig.annotation && typographyConfig.annotation.font_weight) || defaultTypography.annotation.font_weight;

    // Color defaults
    fillStyle.backgroundColor = colorsConfig.background_color || "#FFFFFF";
    fillStyle.textColor = colorsConfig.text_color || "#333333";
    fillStyle.gridLineColor = colorsConfig.other && colorsConfig.other.grid || "#DDDDDD";
    fillStyle.axisLineColor = colorsConfig.other && colorsConfig.other.axis || "#AAAAAA";
    fillStyle.textOnBarColor = colorsConfig.other && colorsConfig.other.textOnBar || "#FFFFFF"; // For primary text on bars
    fillStyle.secondaryTextOnBarColor = colorsConfig.other && colorsConfig.other.secondaryTextOnBar || "#333333"; // For secondary text on bars, might need adjustment

    const defaultCategoricalColors = d3.schemeCategory10;
    fillStyle.getCategoryColor = (groupValue, index) => {
        if (colorsConfig.field && colorsConfig.field[groupFieldName] && colorsConfig.field[groupFieldName][groupValue]) {
            return colorsConfig.field[groupFieldName][groupValue];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        return defaultCategoricalColors[index % defaultCategoricalColors.length];
    };
    
    function getDarkerColor(color, factor = 0.7) {
        const c = d3.color(color);
        if (!c) return "#000000"; // Fallback for invalid input color
        return d3.rgb(c.r * factor, c.g * factor, c.b * factor).toString();
    }

    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, do not append.
        // This might lead to inaccuracies in some environments if the SVG isn't rendered.
        // For robustness in a real scenario, a temporary off-screen SVG in the DOM is better.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails (e.g. in a pure Node environment without JSDOM)
            return (text || "").length * (parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
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
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 30, bottom: 60, left: 70 }; // Adjusted margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    if (chartDataInput.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .text("No data available to render the chart.");
        return svgRoot.node();
    }
    
    const groups = [...new Set(chartDataInput.map(d => d[groupFieldName]))]
        .sort((a, b) => {
            const avgA = d3.mean(chartDataInput.filter(d => d[groupFieldName] === a), d => d[yFieldName]);
            const avgB = d3.mean(chartDataInput.filter(d => d[groupFieldName] === b), d => d[yFieldName]);
            return avgB - avgA; // Descending sort for stacking (larger at bottom)
        });

    const xValuesByGroup = {};
    groups.forEach(group => {
        xValuesByGroup[group] = new Set(
            chartDataInput.filter(d => d[groupFieldName] === group).map(d => d[xFieldName])
        );
    });

    let commonXValues = groups.length > 0 ? [...xValuesByGroup[groups[0]]] : [];
    for (let i = 1; i < groups.length; i++) {
        commonXValues = commonXValues.filter(x => xValuesByGroup[groups[i]].has(x));
    }

    commonXValues.sort((a, b) => { // Sort by original appearance
        const aIndex = chartDataInput.findIndex(d => d[xFieldName] === a);
        const bIndex = chartDataInput.findIndex(d => d[xFieldName] === b);
        return aIndex - bIndex;
    });

    const filteredChartData = chartDataInput.filter(d => commonXValues.includes(d[xFieldName]));

    const groupedDataByX = d3.group(filteredChartData, d => d[xFieldName]);

    const stackInputData = Array.from(groupedDataByX, ([key, values]) => {
        const obj = { category: key }; // 'category' is the xField value
        values.forEach(v => {
            obj[v[groupFieldName]] = v[yFieldName];
        });
        return obj;
    });

    stackInputData.forEach(d => {
        groups.forEach(group => {
            if (d[group] === undefined) {
                d[group] = 0;
            }
        });
    });

    stackInputData.sort((a, b) => commonXValues.indexOf(a.category) - commonXValues.indexOf(b.category));

    stackInputData.forEach(d => {
        const total = groups.reduce((sum, group) => sum + (d[group] || 0), 0);
        groups.forEach(group => {
            d[group + "_original"] = d[group] || 0;
            d[group] = total === 0 ? 0 : ((d[group] || 0) / total) * 100;
        });
    });

    const stackGenerator = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone) // Order is pre-determined by `groups` array
        .offset(d3.stackOffsetNone);

    const stackedSeriesData = stackGenerator(stackInputData);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(commonXValues)
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, 100]) // Percentages
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Y-axis Gridlines & Labels
    const yTicks = [0, 20, 40, 60, 80, 100];
    const yAxisGroup = mainChartGroup.append("g").attr("class", "axis y-axis");

    yTicks.forEach(tick => {
        yAxisGroup.append("line")
            .attr("class", "gridline")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", innerWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,2");

        yAxisGroup.append("text")
            .attr("class", "label y-axis-label")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(tick + "%");
    });

    // X-axis Labels
    const xAxisGroup = mainChartGroup.append("g").attr("class", "axis x-axis");
    commonXValues.forEach(categoryValue => {
        xAxisGroup.append("text")
            .attr("class", "label x-axis-label")
            .attr("x", xScale(categoryValue) + xScale.bandwidth() / 2)
            .attr("y", innerHeight + 25)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(categoryValue);
    });

    // X-axis Baseline
    xAxisGroup.append("line")
        .attr("class", "line x-axis-line")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Legend
    const legendGroup = mainChartGroup.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(0, ${-chartMargins.top / 2 - 10})`); // Position above chart

    const legendItemHeight = 20;
    const legendRectSize = 12;
    const legendSpacing = 5;
    let currentX = 0;
    const legendItemsMaxWidth = innerWidth; 
    let legendTitleWidth = 0;

    if (groupFieldName) {
        const legendTitleElement = legendGroup.append("text")
            .attr("class", "text legend-title")
            .attr("x", 0)
            .attr("y", legendItemHeight / 2 - legendSpacing)
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", fillStyle.typography.titleFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .text(groupFieldName + ":");
        legendTitleWidth = legendTitleElement.node().getBBox().width + legendSpacing * 2;
        currentX += legendTitleWidth;
    }
    
    let totalLegendWidth = legendTitleWidth;

    groups.forEach((group, i) => {
        const itemColor = fillStyle.getCategoryColor(group, i);
        const itemText = group;

        const textWidth = estimateTextWidth(itemText, { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight 
        });
        const itemWidth = legendRectSize + legendSpacing + textWidth + legendSpacing * 2;

        if (currentX + itemWidth > legendItemsMaxWidth && currentX > legendTitleWidth) { // Wrap legend items if too wide
             // This simple legend doesn't implement wrapping, items might overflow.
             // For a robust solution, more complex layout logic is needed.
        }
        
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, 0)`);

        legendItem.append("rect")
            .attr("class", "mark legend-mark")
            .attr("x", 0)
            .attr("y", (legendItemHeight - legendRectSize) / 2 - legendSpacing)
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", itemColor);

        legendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendRectSize + legendSpacing)
            .attr("y", legendItemHeight / 2 - legendSpacing)
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(itemText);
        
        currentX += itemWidth;
        totalLegendWidth = currentX;
    });
    
    // Center the legend
    const legendOffsetX = (innerWidth - totalLegendWidth) / 2;
    legendGroup.attr("transform", `translate(${legendOffsetX}, ${-chartMargins.top / 2})`);


    // Block 8: Main Data Visualization Rendering
    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(stackedSeriesData)
        .enter().append("g")
        .attr("class", d => `mark bar-series series-${d.key.replace(/\s+/g, '-')}`)
        .attr("fill", (d, i) => fillStyle.getCategoryColor(d.key, i));

    barGroups.selectAll("rect")
        .data(d => d.map(item => ({ ...item, key: d.key }))) // Add key to each segment for access
        .enter().append("rect")
        .attr("class", "mark bar-segment")
        .attr("x", d => xScale(d.data.category))
        .attr("y", d => yScale(d[1]))
        .attr("height", d => Math.max(0, yScale(d[0]) - yScale(d[1]))) // Ensure height is not negative
        .attr("width", xScale.bandwidth());

    // Data Labels (Percentage and Original Value)
    const minHeightForLabel = 20; // pixels
    stackedSeriesData.forEach((series, seriesIndex) => {
        const seriesColor = fillStyle.getCategoryColor(series.key, seriesIndex);
        series.forEach(d => {
            const barHeight = Math.max(0, yScale(d[0]) - yScale(d[1]));
            if (barHeight >= minHeightForLabel) {
                const xPos = xScale(d.data.category) + xScale.bandwidth() / 2;
                const yPos = yScale(d[1]) + barHeight / 2;
                const percentageValue = d.data[series.key]; // Percentage
                const originalValue = d.data[series.key + "_original"];

                // Percentage Label
                mainChartGroup.append("text")
                    .attr("class", "text data-label percentage")
                    .attr("x", xPos)
                    .attr("y", yPos - (barHeight > 30 ? 7 : 0)) // Adjust if space allows two lines
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", fillStyle.textOnBarColor)
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .text(`${percentageValue.toFixed(1)}%`);

                // Original Value Label (if enough space)
                if (barHeight > 30) {
                     mainChartGroup.append("text")
                        .attr("class", "text data-label original-value")
                        .attr("x", xPos)
                        .attr("y", yPos + 7)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .attr("fill", getDarkerColor(seriesColor, 0.3)) // Use a darker shade of bar for contrast, or a specific fillStyle token
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", (parseFloat(fillStyle.typography.annotationFontSize) * 0.9) + 'px') // Slightly smaller
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .text(`(${originalValue.toFixed(1)})`);
                }
            }
        });
    });
    
    // Transition Areas
    stackedSeriesData.forEach((series, seriesIndex) => {
        const seriesColor = fillStyle.getCategoryColor(series.key, seriesIndex);
        const darkerSeriesColor = getDarkerColor(seriesColor);

        series.forEach((d, i) => {
            if (i < series.length - 1) { // If not the last category in the series
                const currentSegment = d;
                const nextSegment = series[i+1];
                
                const x1_top = xScale(currentSegment.data.category) + xScale.bandwidth();
                const y1_top = yScale(currentSegment[1]);
                const y1_bottom = yScale(currentSegment[0]);

                const x2_top = xScale(nextSegment.data.category);
                const y2_top = yScale(nextSegment[1]);
                const y2_bottom = yScale(nextSegment[0]);

                // Ensure positive height for path area
                if (y1_bottom > y1_top && y2_bottom > y2_top) {
                    const pathData = `
                        M ${x1_top} ${y1_top}
                        L ${x2_top} ${y2_top}
                        L ${x2_top} ${y2_bottom}
                        L ${x1_top} ${y1_bottom}
                        Z
                    `;
                    mainChartGroup.append("path")
                        .attr("class", "mark transition-area")
                        .attr("d", pathData)
                        .attr("fill", darkerSeriesColor);
                }
            }
        });
    });


    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}