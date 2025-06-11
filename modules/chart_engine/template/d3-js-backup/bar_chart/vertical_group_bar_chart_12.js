/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Vertical Bar Chart",
  "chart_name": "grouped_vertical_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Could be data.colors_dark for a dark theme
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const groupColumn = dataColumns.find(col => col.role === "group");

    const xField = xColumn ? xColumn.name : undefined;
    const yField = yColumn ? yColumn.name : undefined;
    const groupField = groupColumn ? groupColumn.name : undefined;

    const xUnit = xColumn && xColumn.unit !== "none" ? (xColumn.unit || "") : "";
    const yUnit = yColumn && yColumn.unit !== "none" ? (yColumn.unit || "") : "";

    const xValues = [...new Set(chartData.map(d => d[xField]))];
    const groupValues = [...new Set(chartData.map(d => d[groupField]))];

    let criticalErrorMessages = [];
    if (!xField) criticalErrorMessages.push("x field");
    if (!yField) criticalErrorMessages.push("y field");
    if (!groupField) criticalErrorMessages.push("group field");
    if (groupValues.length !== 2 && groupField) { // Check groupValues only if groupField is defined
         criticalErrorMessages.push("exactly 2 unique group values (found " + groupValues.length + ")");
    }
    if (xValues.length < 2 && xField) {
        criticalErrorMessages.push("at least 2 unique x values (found " + xValues.length + ")");
    }


    if (criticalErrorMessages.length > 0) {
        const errorText = "Critical chart config missing or invalid: " + criticalErrorMessages.join(", ") + ". Cannot render.";
        console.error(errorText);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorText}</div>`);
        }
        return null;
    }
    
    const leftBarGroup = groupValues[0]; // Assuming groupValues has been validated to have length 2
    const rightBarGroup = groupValues[1];


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            valueLabelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px', // Can be same as label or specific
            valueLabelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold',
        },
        textColor: colors.text_color || '#333333',
        chartBackground: colors.background_color || '#FFFFFF', // Not used directly on SVG, but for consistency
        defaultCategoricalColors: d3.schemeCategory10,
    };

    fillStyle.groupColors = {};
    groupValues.forEach((group, i) => {
        if (colors.field && colors.field[group]) {
            fillStyle.groupColors[group] = colors.field[group];
        } else if (colors.available_colors && colors.available_colors.length > i) {
            fillStyle.groupColors[group] = colors.available_colors[i];
        } else {
            fillStyle.groupColors[group] = fillStyle.defaultCategoricalColors[i % fillStyle.defaultCategoricalColors.length];
        }
    });
    
    fillStyle.categoryIcons = {};
    if (images.field) {
        xValues.forEach(xVal => {
            if (images.field[xVal]) {
                fillStyle.categoryIcons[xVal] = images.field[xVal];
            }
        });
    }

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const tempTextElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tempTextElement.setAttribute("font-family", fontProps.font_family || fillStyle.typography.labelFontFamily);
        tempTextElement.setAttribute("font-size", fontProps.font_size || fillStyle.typography.labelFontSize);
        tempTextElement.setAttribute("font-weight", fontProps.font_weight || fillStyle.typography.labelFontWeight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        let width = 0;
        try {
            width = tempTextElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might not work well off-DOM
            const fontSizeNumeric = parseFloat(fontProps.font_size || fillStyle.typography.labelFontSize);
            width = text.length * fontSizeNumeric * 0.6; // Crude approximation
        }
        return width;
    }

    function formatValue(value) {
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace(/G/, "B");
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value).replace(/M/, "M");
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value).replace(/k/, "K");
        return d3.format("~g")(value);
    }
    const formattedValueWithUnit = (value) => `${formatValue(value)}${yUnit}`;

    function wrapText(textSelection, textContent, maxWidth, lineHeightEm = 1.1) {
        textSelection.each(function() {
            const d3Text = d3.select(this);
            const words = textContent.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = d3Text.attr("x");
            const y = d3Text.attr("y");
            const dy = parseFloat(d3Text.attr("dy") || 0);
            
            d3Text.text(null); // Clear existing text

            let tspan = d3Text.append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
            let lines = [];

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                    line.pop(); // Remove last word
                    lines.push({text: line.join(" "), x: x, y: y, dy_offset: lineNumber * lineHeightEm});
                    line = [word]; // Start new line with current word
                    lineNumber++;
                }
            }
            lines.push({text: line.join(" "), x: x, y: y, dy_offset: lineNumber * lineHeightEm});

            d3Text.text(null); // Clear again before adding final tspans

            const totalLines = lines.length;
            const initialY = parseFloat(y || 0);
            const initialDy = parseFloat(dy || 0);

            lines.forEach((l, i) => {
                let currentDy = initialDy + l.dy_offset;
                // Adjust dy for vertical centering if multiple lines
                if (totalLines > 1) {
                    currentDy -= (totalLines - 1) * lineHeightEm / 2;
                }
                 d3Text.append("tspan")
                    .attr("x", l.x)
                    .attr("y", initialY) // Keep original y, adjust with dy
                    .attr("dy", currentDy + "em")
                    .text(l.text);
            });
        });
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 30, bottom: 80, left: 30 }; // Adjusted top for legend/icons
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    // `xValues`, `groupValues`, `leftBarGroup`, `rightBarGroup` already defined in Block 1.
    // `chartData` is the array of data points.

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.25); // Padding between x-axis groups

    const groupScale = d3.scaleBand()
        .domain([leftBarGroup, rightBarGroup]) // Use actual group names
        .range([0, xScale.bandwidth()])
        .paddingInner(0.1); // Padding between bars within a group

    const yMax = d3.max(chartData, d => +d[yField]);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 100]) // Ensure domain is not [0,0]
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // X-Axis Labels
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    const baseFontSizeNumeric = parseFloat(fillStyle.typography.labelFontSize);
    let longestXLabelText = "";
    xValues.forEach(val => {
        if (String(val).length > longestXLabelText.length) longestXLabelText = String(val);
    });
    
    const xAxisLabelFontProps = {
        font_family: fillStyle.typography.labelFontFamily,
        font_size: fillStyle.typography.labelFontSize, // string e.g. "12px"
        font_weight: fillStyle.typography.labelFontWeight
    };
    const longestXLabelWidth = estimateTextWidth(longestXLabelText, xAxisLabelFontProps);
    const xLabelAvailableWidth = xScale.bandwidth();
    
    let finalXLabelFontSize = baseFontSizeNumeric;
    if (longestXLabelWidth > xLabelAvailableWidth && longestXLabelWidth > 0) {
        finalXLabelFontSize = Math.max(8, baseFontSizeNumeric * (xLabelAvailableWidth / longestXLabelWidth));
    }

    xAxisGroup.selectAll(".x-label")
        .data(xValues)
        .enter()
        .append("text")
        .attr("class", "label x-label")
        .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
        .attr("y", chartMargins.bottom / 2.5) // Position below axis line, adjust as needed
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", `${finalXLabelFontSize}px`)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d)
        .each(function(d) {
            const currentTextWidth = estimateTextWidth(String(d), {...xAxisLabelFontProps, font_size: `${finalXLabelFontSize}px`});
            if (currentTextWidth > xLabelAvailableWidth) {
                wrapText(d3.select(this), String(d), xLabelAvailableWidth, 1.1);
            }
        });

    // Legend
    const legendItemHeight = 20;
    const legendSquareSize = 15;
    const legendSpacing = 5; // Space between square and text
    const legendItemMargin = 15; // Space between legend items

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - legendItemHeight / 2})`); // Position top-leftish

    let currentLegendXOffset = 0;
    groupValues.forEach((groupName, i) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendXOffset}, 0)`);

        itemGroup.append("rect")
            .attr("class", "mark legend-mark")
            .attr("x", 0)
            .attr("y", (legendItemHeight - legendSquareSize) / 2)
            .attr("width", legendSquareSize)
            .attr("height", legendSquareSize)
            .style("fill", fillStyle.groupColors[groupName]);

        const legendTextElement = itemGroup.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendSquareSize + legendSpacing)
            .attr("y", legendItemHeight / 2)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(groupName);
        
        currentLegendXOffset += legendSquareSize + legendSpacing + estimateTextWidth(groupName, xAxisLabelFontProps) + legendItemMargin;
    });
    // Center legend if space allows (optional, original was right-aligned)
    const legendWidth = currentLegendXOffset - legendItemMargin; // Total width of legend items
    const legendNewX = (containerWidth - legendWidth) / 2;
    if (legendNewX > chartMargins.left) {
         legendGroup.attr("transform", `translate(${legendNewX}, ${chartMargins.top / 2 - legendItemHeight / 2})`);
    }


    // Block 8: Main Data Visualization Rendering
    const barWidth = groupScale.bandwidth();
    const valueLabelBaseFontSize = parseFloat(fillStyle.typography.valueLabelFontSize);

    xValues.forEach(xValue => {
        const xData = chartData.filter(d => d[xField] === xValue);
        
        let minBarTopY = innerHeight;
        let minExternalLabelTopY = innerHeight;

        [leftBarGroup, rightBarGroup].forEach(currentGroup => {
            const barDataPoint = xData.find(d => d[groupField] === currentGroup);
            if (!barDataPoint) return;

            const value = +barDataPoint[yField];
            const barHeight = innerHeight - yScale(value);
            const barY = yScale(value);
            minBarTopY = Math.min(minBarTopY, barY);

            const barX = xScale(xValue) + groupScale(currentGroup);

            mainChartGroup.append("rect")
                .attr("class", `mark bar ${currentGroup === leftBarGroup ? 'left-bar' : 'right-bar'}`)
                .attr("x", barX)
                .attr("y", barY)
                .attr("width", barWidth)
                .attr("height", Math.max(0, barHeight)) // Ensure height is not negative
                .style("fill", fillStyle.groupColors[currentGroup])
                .attr("rx", 0) // No rounded corners
                .attr("ry", 0);

            // Data Labels
            const valueText = formattedValueWithUnit(value);
            const valueLabelFontProps = {
                font_family: fillStyle.typography.labelFontFamily, // Assuming same family for consistency
                font_size: fillStyle.typography.valueLabelFontSize,
                font_weight: fillStyle.typography.valueLabelFontWeight
            };
            
            let currentLabelFontSize = valueLabelBaseFontSize;
            let textWidth = estimateTextWidth(valueText, {...valueLabelFontProps, font_size: `${currentLabelFontSize}px`});
            
            if (textWidth > barWidth * 0.95 && textWidth > 0) { // Allow slight padding
                currentLabelFontSize = Math.max(6, currentLabelFontSize * (barWidth * 0.95 / textWidth));
            }

            const labelHeightRequired = currentLabelFontSize + 4; // Approx height + padding
            let labelY, labelColor, dominantBaseline;

            if (barHeight > labelHeightRequired) { // Place inside
                labelY = barY + barHeight / 2; // Vertically center inside bar
                labelColor = "#ffffff"; // Assuming dark bars, light text
                // Check contrast for labelColor, if bar is light, use fillStyle.textColor
                const barFillColor = d3.color(fillStyle.groupColors[currentGroup]);
                if (barFillColor && barFillColor.l > 0.6) { // If bar color is light
                     labelColor = fillStyle.textColor;
                }
                dominantBaseline = "middle";
            } else { // Place outside
                labelY = barY - 5; // Above bar
                labelColor = fillStyle.textColor;
                dominantBaseline = "alphabetic"; // Or "text-bottom"
                minExternalLabelTopY = Math.min(minExternalLabelTopY, labelY - currentLabelFontSize);
            }
            
            if (value !== 0 || variables.showZeroValueLabels) { // Only show label if value is not zero, or configured to show
                 mainChartGroup.append("text")
                    .attr("class", "label value")
                    .attr("x", barX + barWidth / 2)
                    .attr("y", labelY)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", dominantBaseline)
                    .style("font-family", valueLabelFontProps.font_family)
                    .style("font-size", `${currentLabelFontSize}px`)
                    .style("font-weight", valueLabelFontProps.font_weight)
                    .style("fill", labelColor)
                    .text(valueText);
            }
        });

        // Block 9: Optional Enhancements & Post-Processing (Icons)
        if (fillStyle.categoryIcons[xValue]) {
            const iconSize = Math.min(30, xScale.bandwidth() * 0.4, chartMargins.top * 0.3); // Dynamic icon size
            const iconMargin = 5;
            const placementRefY = Math.min(minBarTopY, minExternalLabelTopY);
            const iconY = placementRefY - iconMargin - iconSize; // Position above everything

            if (iconY > -iconSize) { // Ensure icon is somewhat visible within chart area
                mainChartGroup.append("image")
                    .attr("class", "icon category-icon")
                    .attr("x", xScale(xValue) + xScale.bandwidth() / 2 - iconSize / 2)
                    .attr("y", iconY)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", fillStyle.categoryIcons[xValue]);
            }
        }
    });


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}