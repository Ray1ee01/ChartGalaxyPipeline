/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Bar Chart",
  "chart_name": "vertical_group_bar_chart_13",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
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
    const typography = data.typography || {};
    const colors = data.colors || {};
    // const images = data.images || {}; // Images not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const groupColumn = dataColumns.find(col => col.role === "group");

    const xFieldName = xColumn ? xColumn.name : undefined;
    const yFieldName = yColumn ? yColumn.name : undefined;
    const groupFieldName = groupColumn ? groupColumn.name : undefined;

    const yFieldUnit = yColumn && yColumn.unit !== "none" ? yColumn.unit || "" : "";

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x field" : null,
            !yFieldName ? "y field" : null,
            !groupFieldName ? "group field" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    const xValues = [...new Set(chartDataArray.map(d => d[xFieldName]))];
    let groupValues = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    if (groupValues.length !== 2) {
        const errorMsg = `This chart requires exactly 2 groups. Found ${groupValues.length}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }
    const leftBarGroup = groupValues[0];
    const rightBarGroup = groupValues[1];


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : "'Comic Sans MS', cursive, sans-serif",
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : "12px",
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : "normal",
            valueLabelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : "12px", // Base for value labels
            valueLabelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : "bold",
        },
        textColor: colors.text_color || "#333333",
        barColors: {
            [leftBarGroup]: (colors.field && colors.field[leftBarGroup]) ? colors.field[leftBarGroup] : (colors.available_colors ? colors.available_colors[0] : "#4269d0"),
            [rightBarGroup]: (colors.field && colors.field[rightBarGroup]) ? colors.field[rightBarGroup] : (colors.available_colors && colors.available_colors.length > 1 ? colors.available_colors[1] : "#ff725c")
        },
        defaultBarColor: (colors.other && colors.other.primary) ? colors.other.primary : "#4682B4",
        legendRectBorderColor: "#555555",
        xAxisLabelBackgroundColor: "#FFFFFF", // Not used as sketch patterns removed
        xAxisLabelBorderColor: "#AAAAAA" // Not used
    };

    function estimateTextWidth(text, fontProps) {
        const defaultFont = "12px sans-serif";
        const font = `${fontProps.fontWeight || 'normal'} ${fontProps.fontSize || '12px'} ${fontProps.fontFamily || 'sans-serif'}`;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        context.font = font || defaultFont;
        return context.measureText(text).width;
    }
    
    function wrapText(textElement, textContent, maxWidth, lineHeightEm, baseFontProps) {
        textElement.text(null); // Clear existing content
        const words = textContent.split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const x = textElement.attr("x") || 0;
        let tspan = textElement.append("tspan").attr("x", x).attr("dy", "0em");
        let currentWidth = 0;

        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            currentWidth = estimateTextWidth(line.join(" "), baseFontProps);

            if (currentWidth > maxWidth && line.length > 1) {
                line.pop(); // Remove last word
                tspan.text(line.join(" ")); // Set tspan to previous line content
                line = [word]; // Start new line with current word
                tspan = textElement.append("tspan").attr("x", x).attr("dy", `${lineHeightEm}em`).text(word);
                lineNumber++;
            }
        }
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~g")(value);
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 100, left: 30 }; // Adjusted top for legend, bottom for labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    // (xValues, groupValues already processed in Block 1 for validation)

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.2);

    const groupScale = d3.scaleBand()
        .domain([0, 1]) // Left (0) and Right (1) bars
        .range([0, xScale.bandwidth()])
        .padding(0.1); // Fixed spacing within group

    const yMax = d3.max(chartDataArray, d => +d[yFieldName]) || 100;
    const yScale = d3.scaleLinear()
        .domain([0, yMax * 1.1]) // Add padding for labels above bars
        .range([innerHeight, 0]);

    const barWidth = groupScale.bandwidth();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // X-Axis Labels
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    const xAxisLabelFontProps = {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    };
    const xAxisLabelMaxWidth = xScale.bandwidth() * 1.1; 
    const xAxisLabelPadding = 5; // Padding around text if a background were used

    xAxisGroup.selectAll(".x-label-group")
        .data(xValues)
        .enter()
        .append("g")
        .attr("class", "x-label-item-group")
        .attr("transform", d => `translate(${xScale(d) + xScale.bandwidth() / 2}, 25)`)
        .each(function(d) {
            const group = d3.select(this);
            const textContent = String(d);
            
            const textEl = group.append("text")
                .attr("class", "label x-axis-label")
                .attr("x", 0)
                .attr("y", 0) 
                .attr("text-anchor", "middle")
                .style("font-family", xAxisLabelFontProps.fontFamily)
                .style("font-size", xAxisLabelFontProps.fontSize)
                .style("font-weight", xAxisLabelFontProps.fontWeight)
                .style("fill", fillStyle.textColor)
                .text(textContent);

            // Simple width check for wrapping (more advanced would adjust font size first)
            const estimatedWidth = estimateTextWidth(textContent, xAxisLabelFontProps);
            if (estimatedWidth > xAxisLabelMaxWidth) {
                wrapText(textEl, textContent, xAxisLabelMaxWidth, 1.1, xAxisLabelFontProps);
            }
            
            // Adjust y based on bbox if multi-line, to keep it roughly centered on its baseline
            const bbox = textEl.node().getBBox();
            if (textEl.selectAll("tspan").size() > 1) {
                 textEl.attr("y", - (bbox.height - parseFloat(xAxisLabelFontProps.fontSize)) / 2); // Crude adjustment for multi-line
            }
        });

    // Legend
    const legendData = [
        { key: leftBarGroup, color: fillStyle.barColors[leftBarGroup] },
        { key: rightBarGroup, color: fillStyle.barColors[rightBarGroup] }
    ];
    
    const legendFontProps = { 
        fontFamily: fillStyle.typography.labelFontFamily, 
        fontSize: "12px", // Fixed size for legend text
        fontWeight: fillStyle.typography.labelFontWeight 
    };
    const legendItemHeight = 15;
    const legendItemSpacing = 10; // Spacing between items
    const legendRectTextSpacing = 5; // Spacing between rect and text

    const legendItemGroup = svgRoot.append("g")
        .attr("class", "legend");

    let currentLegendX = 0;
    legendData.forEach((item, i) => {
        const singleLegendItem = legendItemGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, 0)`);

        singleLegendItem.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendItemHeight)
            .attr("height", legendItemHeight)
            .attr("fill", item.color)
            .attr("stroke", fillStyle.legendRectBorderColor)
            .attr("stroke-width", 0.5);

        const legendText = singleLegendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendItemHeight + legendRectTextSpacing)
            .attr("y", legendItemHeight / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", legendFontProps.fontFamily)
            .style("font-size", legendFontProps.fontSize)
            .style("font-weight", legendFontProps.fontWeight)
            .style("fill", fillStyle.textColor)
            .text(item.key);
        
        const itemWidth = legendItemHeight + legendRectTextSpacing + estimateTextWidth(item.key, legendFontProps);
        currentLegendX += itemWidth + legendItemSpacing;
    });
    
    // Center the legend group
    const legendWidth = currentLegendX - legendItemSpacing; // Remove last spacing
    legendItemGroup.attr("transform", `translate(${(containerWidth - legendWidth) / 2}, ${chartMargins.top / 2 - legendItemHeight / 2})`);


    // Block 8: Main Data Visualization Rendering
    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(xValues)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${xScale(d)}, 0)`);

    // Left Bars
    barGroups.each(function(xVal) {
        const parentGroup = d3.select(this);
        const d = chartDataArray.find(cd => cd[xFieldName] === xVal && cd[groupFieldName] === leftBarGroup);
        if (!d) return;

        const value = +d[yFieldName];
        if (isNaN(value) || value < 0) return; // Skip invalid data

        const barHeight = innerHeight - yScale(value);
        const barY = yScale(value);

        parentGroup.append("rect")
            .attr("class", "mark bar left-bar")
            .attr("x", groupScale(0))
            .attr("y", barY)
            .attr("width", barWidth)
            .attr("height", Math.max(0, barHeight))
            .attr("fill", fillStyle.barColors[leftBarGroup] || fillStyle.defaultBarColor);

        // Value Labels for Left Bars
        if (barHeight > 5) { // Only show label if bar is tall enough
            const textContent = formatValue(value) + (yFieldUnit ? ` ${yFieldUnit}` : '');
            const valueLabelFontProps = {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.valueLabelFontSize,
                fontWeight: fillStyle.typography.valueLabelFontWeight
            };
            // Basic font size adjustment (could be more sophisticated)
            let currentFontSizePx = parseFloat(valueLabelFontProps.fontSize);
            let estimatedWidth = estimateTextWidth(textContent, {...valueLabelFontProps, fontSize: `${currentFontSizePx}px`});
            
            if (estimatedWidth > barWidth * 1.1 && currentFontSizePx > 8) { // Allow slight overflow
                currentFontSizePx = Math.max(8, currentFontSizePx * (barWidth * 1.1 / estimatedWidth));
            }
            valueLabelFontProps.fontSize = `${currentFontSizePx}px`;

            const label = parentGroup.append("text")
                .attr("class", "label value value-label")
                .attr("x", groupScale(0) + barWidth / 2)
                .attr("y", barY - 5) // Position above bar
                .attr("text-anchor", "middle")
                .style("font-family", valueLabelFontProps.fontFamily)
                .style("font-size", valueLabelFontProps.fontSize)
                .style("font-weight", valueLabelFontProps.fontWeight)
                .style("fill", fillStyle.textColor)
                .text(textContent);

            estimatedWidth = estimateTextWidth(textContent, valueLabelFontProps); // Re-check with potentially new font size
            if (estimatedWidth > barWidth && currentFontSizePx <= 8.5) { // If still too wide and font is small, wrap
                 wrapText(label, textContent, barWidth, 1.1, valueLabelFontProps);
                 // Adjust y for wrapped text to ensure it's above the bar
                 const bbox = label.node().getBBox();
                 label.attr("y", barY - 5 - bbox.height + currentFontSizePx); 
            }
        }
    });

    // Right Bars
    barGroups.each(function(xVal) {
        const parentGroup = d3.select(this);
        const d = chartDataArray.find(cd => cd[xFieldName] === xVal && cd[groupFieldName] === rightBarGroup);
        if (!d) return;

        const value = +d[yFieldName];
        if (isNaN(value) || value < 0) return;

        const barHeight = innerHeight - yScale(value);
        const barY = yScale(value);

        parentGroup.append("rect")
            .attr("class", "mark bar right-bar")
            .attr("x", groupScale(1))
            .attr("y", barY)
            .attr("width", barWidth)
            .attr("height", Math.max(0, barHeight))
            .attr("fill", fillStyle.barColors[rightBarGroup] || fillStyle.defaultBarColor);

        // Value Labels for Right Bars
        if (barHeight > 5) {
            const textContent = formatValue(value) + (yFieldUnit ? ` ${yFieldUnit}` : '');
             const valueLabelFontProps = {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.valueLabelFontSize,
                fontWeight: fillStyle.typography.valueLabelFontWeight
            };
            let currentFontSizePx = parseFloat(valueLabelFontProps.fontSize);
            let estimatedWidth = estimateTextWidth(textContent, {...valueLabelFontProps, fontSize: `${currentFontSizePx}px`});

            if (estimatedWidth > barWidth * 1.1 && currentFontSizePx > 8) {
                currentFontSizePx = Math.max(8, currentFontSizePx * (barWidth * 1.1 / estimatedWidth));
            }
            valueLabelFontProps.fontSize = `${currentFontSizePx}px`;

            const label = parentGroup.append("text")
                .attr("class", "label value value-label")
                .attr("x", groupScale(1) + barWidth / 2)
                .attr("y", barY - 5)
                .attr("text-anchor", "middle")
                .style("font-family", valueLabelFontProps.fontFamily)
                .style("font-size", valueLabelFontProps.fontSize)
                .style("font-weight", valueLabelFontProps.fontWeight)
                .style("fill", fillStyle.textColor)
                .text(textContent);
            
            estimatedWidth = estimateTextWidth(textContent, valueLabelFontProps);
            if (estimatedWidth > barWidth && currentFontSizePx <= 8.5) {
                 wrapText(label, textContent, barWidth, 1.1, valueLabelFontProps);
                 const bbox = label.node().getBBox();
                 label.attr("y", barY - 5 - bbox.height + currentFontSizePx);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this simplified version)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}