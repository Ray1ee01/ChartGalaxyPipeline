/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Group Bar Chart",
  "chart_name": "vertical_group_bar_chart_11",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "visible",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme preference if both exist
    const rawImages = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldColumn = dataColumns.find(col => col.role === "x");
    const yFieldColumn = dataColumns.find(col => col.role === "y");
    const groupFieldColumn = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldColumn?.name;
    const yFieldName = yFieldColumn?.name;
    const groupFieldName = groupFieldColumn?.name;

    const xFieldUnit = xFieldColumn?.unit === "none" ? "" : (xFieldColumn?.unit || "");
    const yFieldUnit = yFieldColumn?.unit === "none" ? "" : (yFieldColumn?.unit || "");

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missing = [
            !xFieldName ? "x field" : null,
            !yFieldName ? "y field" : null,
            !groupFieldName ? "group field" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: [${missing}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const uniqueGroupValues = [...new Set(chartData.map(d => d[groupFieldName]))];
    if (uniqueGroupValues.length !== 2) {
        const errorMsg = `This chart requires exactly 2 unique values for the group field ('${groupFieldName}'). Found ${uniqueGroupValues.length}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }
    const groupValue1 = uniqueGroupValues[0];
    const groupValue2 = uniqueGroupValues[1];


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: rawTypography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: rawTypography.title?.font_size || '16px',
            titleFontWeight: rawTypography.title?.font_weight || 'bold',
            labelFontFamily: rawTypography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: rawTypography.label?.font_size || '12px',
            labelFontWeight: rawTypography.label?.font_weight || 'normal',
            annotationFontFamily: rawTypography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: rawTypography.annotation?.font_size || '10px',
            annotationFontWeight: rawTypography.annotation?.font_weight || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF',
        groupColors: {},
        iconUrls: {}
    };

    const defaultCategoricalColors = d3.schemeCategory10;
    uniqueGroupValues.forEach((group, i) => {
        fillStyle.groupColors[group] = (rawColors.field && rawColors.field[group]) ||
                                       (rawColors.available_colors && rawColors.available_colors[i % rawColors.available_colors.length]) ||
                                       defaultCategoricalColors[i % defaultCategoricalColors.length];
    });
    
    const xCategories = [...new Set(chartData.map(d => d[xFieldName]))];
    xCategories.forEach(category => {
        if (rawImages.field && rawImages.field[category]) {
            fillStyle.iconUrls[category] = rawImages.field[category];
        }
    });
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            const avgCharWidth = parseFloat(fontSize) * 0.6;
            width = text.length * avgCharWidth;
            console.warn("getBBox on in-memory SVG failed, using approximate text width.", e);
        }
        return width;
    }

    function formatValue(value) {
        const absValue = Math.abs(value);
        let suffix = yFieldUnit;
        let scaledValue = value;

        if (absValue >= 1000000000) {
            scaledValue = value / 1000000000;
            suffix = "B" + yFieldUnit;
        } else if (absValue >= 1000000) {
            scaledValue = value / 1000000;
            suffix = "M" + yFieldUnit;
        } else if (absValue >= 1000) {
            scaledValue = value / 1000;
            suffix = "K" + yFieldUnit;
        }
        return d3.format("~g")(scaledValue) + suffix;
    }

    function wrapText(textSelection, textContent, maxWidth, lineHeightEm = 1.1) {
        textSelection.each(function() {
            const textEl = d3.select(this);
            textEl.text(null); // Clear existing content

            const words = textContent.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textEl.attr("x") || 0;
            const y = textEl.attr("y") || 0;
            const dy = parseFloat(textEl.attr("dy") || 0);
            
            let tspan = textEl.append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");

            let lines = [];
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                    line.pop(); // remove last word
                    lines.push(line.join(" "));
                    line = [word]; // start new line with current word
                }
            }
            lines.push(line.join(" ")); // push the last line

            textEl.text(null); // Clear again before adding final tspans

            const numLines = lines.length;
            const verticalOffset = (numLines > 1) ? -( (numLines -1) * lineHeightEm / 2 ) : 0;

            lines.forEach((currentLine, i) => {
                textEl.append("tspan")
                    .attr("x", x)
                    .attr("y", y)
                    .attr("dy", (verticalOffset + i * lineHeightEm + dy) + "em")
                    .text(currentLine);
            });
        });
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 100, left: 30 }; // Adjusted top for legend, bottom for labels & icons
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    // chartDataArray is chartData
    // xCategories and uniqueGroupValues already defined

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xCategories)
        .range([0, innerWidth])
        .padding(0.2); // Padding between x-axis category groups

    const xSubgroupScale = d3.scaleBand()
        .domain(uniqueGroupValues)
        .range([0, xScale.bandwidth()])
        .paddingInner(0.1); // Padding between bars within the same category group

    const yMax = d3.max(chartData, d => +d[yFieldName]) || 100;
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax * 1.1 : 10]) // Add some headroom, ensure positive domain
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // X-Axis Labels
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    xAxisGroup.selectAll(".x-axis-label")
        .data(xCategories)
        .enter()
        .append("text")
        .attr("class", "label x-axis-label")
        .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
        .attr("y", 25) // Position below the axis line (which is implicit at innerHeight)
        .attr("dy", 0) // Initial dy for wrapText
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d)
        .each(function(d) {
            const textElement = d3.select(this);
            const labelMaxWidth = xScale.bandwidth();
            if (estimateTextWidth(d.toString(), fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight) > labelMaxWidth) {
                 wrapText(textElement, d.toString(), labelMaxWidth, 1.1);
            }
        });

    // Legend
    const legendData = uniqueGroupValues.map(group => ({
        key: group,
        color: fillStyle.groupColors[group]
    }));

    const legendItemHeight = 20;
    const legendRectSize = 15;
    const legendSpacing = 10; // Spacing between rect and text
    const legendItemPadding = 15; // Spacing between legend items

    let totalLegendWidth = 0;
    const legendItemWidths = legendData.map(item => {
        const textWidth = estimateTextWidth(item.key, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        return legendRectSize + legendSpacing + textWidth;
    });
    totalLegendWidth = legendItemWidths.reduce((sum, w) => sum + w, 0) + (legendData.length - 1) * legendItemPadding;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2 - legendItemHeight / 2})`); // Vertically center in top margin

    let currentLegendX = 0;
    legendData.forEach((item, i) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, 0)`);

        itemGroup.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", item.color)
            .attr("rx", 2)
            .attr("ry", 2);

        itemGroup.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendRectSize + legendSpacing)
            .attr("y", legendRectSize / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(item.key);
        
        currentLegendX += legendItemWidths[i] + legendItemPadding;
    });


    // Block 8: Main Data Visualization Rendering
    const barWidth = xSubgroupScale.bandwidth();

    xCategories.forEach(xCat => {
        const categoryData = chartData.filter(d => d[xFieldName] === xCat);

        uniqueGroupValues.forEach(groupVal => {
            const barDataPoint = categoryData.find(d => d[groupFieldName] === groupVal);
            if (barDataPoint) {
                const value = +barDataPoint[yFieldName];
                if (value >= 0) { // Only render non-negative values for this bar chart type
                    const barX = xScale(xCat) + xSubgroupScale(groupVal);
                    const barY = yScale(value);
                    const barHeight = innerHeight - barY;

                    mainChartGroup.append("rect")
                        .attr("class", `mark bar ${groupVal === groupValue1 ? 'group1-bar' : 'group2-bar'}`)
                        .attr("x", barX)
                        .attr("y", barY)
                        .attr("width", barWidth)
                        .attr("height", barHeight > 0 ? barHeight : 0)
                        .attr("fill", fillStyle.groupColors[groupVal])
                        .attr("rx", 0) 
                        .attr("ry", 0);

                    // Value Labels on top of bars
                    const formattedVal = formatValue(value);
                    mainChartGroup.append("text")
                        .attr("class", "label value-label")
                        .attr("x", barX + barWidth / 2)
                        .attr("y", barY - 5) // Position above the bar
                        .attr("text-anchor", "middle")
                        .style("font-family", fillStyle.typography.labelFontFamily)
                        .style("font-size", fillStyle.typography.labelFontSize) // Use fixed size
                        .style("font-weight", "bold") // Make value labels bold
                        .style("fill", fillStyle.textColor)
                        .text(formattedVal);
                }
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Icons below X-axis labels
    const iconSize = 24; // Fixed icon size
    const iconYOffset = 50; // Y position below the axis line (adjust based on x-axis label height)

    xCategories.forEach(xCat => {
        if (fillStyle.iconUrls[xCat]) {
            xAxisGroup.append("image") // Append to xAxisGroup for consistent translation
                .attr("class", "icon category-icon")
                .attr("x", xScale(xCat) + xScale.bandwidth() / 2 - iconSize / 2)
                .attr("y", iconYOffset) // Relative to xAxisGroup transform
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", fillStyle.iconUrls[xCat]);
        }
    });
    // Adjust bottom margin if icons push content further down.
    // The current margin.bottom = 100 should accommodate labels (25-40px) + icons (24px + padding).

    // Block 10: Cleanup & SVG Node Return
    // No specific cleanup needed beyond initial container clear.
    return svgRoot.node();
}