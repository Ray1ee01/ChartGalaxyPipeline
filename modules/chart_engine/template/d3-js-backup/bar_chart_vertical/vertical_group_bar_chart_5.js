/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Group Bar Chart",
  "chart_name": "vertical_group_bar_chart_5",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 10], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["percentage_indicator"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is now external to the function)

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    // const images = data.images || {}; // Images not used in this chart
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const groupColumn = dataColumns.find(col => col.role === "group");

    const xFieldName = xColumn?.name;
    const yFieldName = yColumn?.name;
    const groupFieldName = groupColumn?.name;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push("x field");
        if (!yFieldName) missingFields.push("y field");
        if (!groupFieldName) missingFields.push("group field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldUnit = xColumn?.unit === "none" ? "" : (xColumn?.unit || "");
    const yFieldUnit = yColumn?.unit === "none" ? "" : (yColumn?.unit || "");

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
        chartBackground: rawColors.background_color || '#FFFFFF', // Not used directly if SVG is transparent
        axisLineColor: '#000000',
        gridLineColor: '#e0e0e0',
        percentageIndicatorColor: rawColors.other?.percentage_indicator || '#C0392B',
        percentageIndicatorTextColor: '#FFFFFF', // Typically white for contrast on dark indicator
    };

    // Color assignment for bars will be done in Block 5 after groupValues are known

    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-weight', fontWeight);
        tempTextElement.setAttribute('font-size', fontSize);
        tempTextElement.setAttribute('font-family', fontFamily);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // No need to append to DOM for getBBox for modern browsers
        return tempTextElement.getBBox().width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    function calculateFontSize(text, maxWidth, baseFontSizeStr, minSize = 8) {
        const baseSize = parseInt(baseFontSizeStr);
        const avgCharWidth = baseSize * 0.6; // Approximation
        const estimatedTextWidth = text.length * avgCharWidth;
        if (estimatedTextWidth < maxWidth) {
            return `${baseSize}px`;
        }
        const newSize = Math.floor(baseSize * (maxWidth / estimatedTextWidth));
        return `${Math.max(minSize, newSize)}px`;
    }

    function wrapText(textElement, textContent, maxWidth, lineHeightEm) {
        textElement.each(function() {
            const d3Text = d3.select(this);
            const words = textContent.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = d3Text.attr("x") || 0;
            const y = d3Text.attr("y") || 0;
            const dy = parseFloat(d3Text.attr("dy") || 0);
            
            d3Text.text(null); // Clear existing text content

            let tspan = d3Text.append("tspan")
                .attr("x", x)
                .attr("y", y)
                .attr("dy", dy + "em")
                .attr("class", "text");

            function appendNewLine() {
                lineNumber++;
                tspan = d3Text.append("tspan")
                    .attr("x", x)
                    .attr("y", y)
                    .attr("dy", lineNumber * lineHeightEm + dy + "em")
                    .attr("class", "text");
            }
            
            if (words.length === 1 && words[0].length > 0 && estimateTextWidth(words[0], d3Text.style("font-weight"), d3Text.style("font-size"), d3Text.style("font-family")) > maxWidth) {
                // Single word too long, try character wrapping
                const chars = words[0].split('');
                let currentLine = '';
                for (let i = 0; i < chars.length; i++) {
                    const testLine = currentLine + chars[i];
                    if (estimateTextWidth(testLine, d3Text.style("font-weight"), d3Text.style("font-size"), d3Text.style("font-family")) > maxWidth && currentLine.length > 0) {
                        tspan.text(currentLine);
                        appendNewLine();
                        currentLine = chars[i];
                    } else {
                        currentLine = testLine;
                    }
                }
                tspan.text(currentLine);

            } else {
                 while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        appendNewLine();
                        tspan.text(word);
                    }
                }
            }
            // Adjust vertical position for multi-line text if needed (centering tspan block)
            if (lineNumber > 0) {
                 const tspanHeight = (tspan.node()?.getBBox()?.height || parseInt(d3Text.style("font-size"))) * 0.8; // Approximate line height
                 d3Text.selectAll("tspan").attr("dy", function(d, i) { return (i - lineNumber / 2) * lineHeightEm + dy + "em"; });
            }
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
        .style("background-color", fillStyle.chartBackground); // Apply background to SVG root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 100, right: 40, bottom: 80, left: 80 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const xValues = [...new Set(chartData.map(d => d[xFieldName]))];
    const groupValues = [...new Set(chartData.map(d => d[groupFieldName]))];

    if (groupValues.length !== 2) {
        console.warn(`This chart expects exactly 2 group field values for '${groupFieldName}'. Found ${groupValues.length}. Chart may not render as expected.`);
        // Proceeding with first two, or less if fewer than 2.
    }
    const leftBarGroup = groupValues[0];
    const rightBarGroup = groupValues[1]; // Might be undefined if groupValues.length < 2

    fillStyle.barColorLeft = (rawColors.field && rawColors.field[leftBarGroup]) ? rawColors.field[leftBarGroup] :
                             (rawColors.available_colors && rawColors.available_colors.length > 0) ? rawColors.available_colors[0 % rawColors.available_colors.length] :
                             (d3.schemeCategory10[0]);
    
    fillStyle.barColorRight = (rawColors.field && rawColors.field[rightBarGroup]) ? rawColors.field[rightBarGroup] :
                              (rawColors.available_colors && rawColors.available_colors.length > 1) ? rawColors.available_colors[1 % rawColors.available_colors.length] :
                              (rawColors.available_colors && rawColors.available_colors.length > 0) ? rawColors.available_colors[0 % rawColors.available_colors.length] : // fallback to first if only one available
                              (d3.schemeCategory10[1]);


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.2);

    const groupScale = d3.scaleBand()
        .domain([0, 1]) // For left and right bar in a group
        .range([0, xScale.bandwidth()])
        .padding(0.2);

    const yDataValues = chartData.map(d => +d[yFieldName]).filter(v => !isNaN(v));
    const dataMin = d3.min(yDataValues) ?? 0;
    const dataMax = d3.max(yDataValues) ?? 0;
    
    let yMin = dataMin < 0 ? Math.floor(dataMin * 1.2 / 10) * 10 : 0;
    let yMax = Math.ceil(dataMax * 1.2 / 10) * 10;
    if (yMin === 0 && yMax === 0 && dataMax > 0) yMax = dataMax * 1.2; // Handle case where all values are small positive
    if (yMin === yMax) yMax += 10; // Ensure domain has a range

    const yScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10));
    
    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll(".tick text")
        .attr("class", "text label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize) // Initial size
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const tickText = d3.select(this);
            const textContent = d.toString();
            const baseFontSize = parseInt(fillStyle.typography.labelFontSize);
            const maxWidthForLabel = xScale.bandwidth(); // Max width for this label
            
            // Calculate dynamic font size
            const dynamicFontSize = calculateFontSize(textContent, maxWidthForLabel, fillStyle.typography.labelFontSize, 8);
            tickText.style("font-size", dynamicFontSize);

            // Wrap text if still needed after font adjustment
            if (estimateTextWidth(textContent, tickText.style("font-weight"), dynamicFontSize, tickText.style("font-family")) > maxWidthForLabel) {
                 wrapText(tickText, textContent, maxWidthForLabel, 1.1);
            }
        });

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale)
            .tickSize(-innerWidth)
            .tickFormat(d => formatValue(d) + (yFieldUnit ? ` ${yFieldUnit}` : ''))
            .ticks(Math.max(2, Math.round(innerHeight / 50))) // Dynamic number of ticks
        );

    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll(".tick line")
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-dasharray", "2,2")
        .attr("class", "grid-line");
    yAxisGroup.selectAll(".tick text")
        .attr("class", "text label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    mainChartGroup.append("line")
        .attr("class", "axis-line x-axis-line")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 2);

    // Legend
    const legendData = [];
    if (leftBarGroup !== undefined) legendData.push({ key: leftBarGroup, color: fillStyle.barColorLeft });
    if (rightBarGroup !== undefined && rightBarGroup !== leftBarGroup) legendData.push({ key: rightBarGroup, color: fillStyle.barColorRight });
    
    const legendRectSize = 15;
    const legendRectTextGap = 5;
    const legendItemRightPadding = 20;
    let totalLegendWidth = 0;
    const legendItemWidths = [];

    legendData.forEach(item => {
        const textWidth = estimateTextWidth(
            item.key.toString().replace(" Sales", ""), // Preserving original label cleaning
            fillStyle.typography.labelFontWeight,
            fillStyle.typography.labelFontSize,
            fillStyle.typography.labelFontFamily
        );
        const itemWidth = legendRectSize + legendRectTextGap + textWidth + legendItemRightPadding;
        legendItemWidths.push(itemWidth);
        totalLegendWidth += itemWidth;
    });
    if (legendData.length > 0) totalLegendWidth -= legendItemRightPadding; // No padding after the last item

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2 + 10})`); // Centered horizontally, adjusted vertically

    let currentLegendX = 0;
    legendData.forEach((item, i) => {
        const legendItemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, 0)`);

        legendItemGroup.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", item.color);

        legendItemGroup.append("text")
            .attr("class", "text label legend-label")
            .attr("x", legendRectSize + legendRectTextGap)
            .attr("y", legendRectSize / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(item.key.toString().replace(" Sales", ""));
        
        currentLegendX += legendItemWidths[i];
    });

    // Block 8: Main Data Visualization Rendering
    const xCategoryGroups = mainChartGroup.selectAll(".x-category-group")
        .data(xValues)
        .enter()
        .append("g")
        .attr("class", d => `x-category-group mark ${d.toString().replace(/\s+/g, '-')}`) // Added mark class and dynamic class
        .attr("transform", d => `translate(${xScale(d)}, 0)`);

    xCategoryGroups.each(function(xValue) {
        const groupG = d3.select(this);
        const xData = chartData.filter(d => d[xFieldName] === xValue);
        
        const leftBarData = xData.find(d => d[groupFieldName] === leftBarGroup);
        const rightBarData = xData.find(d => d[groupFieldName] === rightBarGroup);

        if (leftBarData && !isNaN(+leftBarData[yFieldName])) {
            const yVal = +leftBarData[yFieldName];
            groupG.append("rect")
                .attr("class", "mark bar left-bar")
                .attr("x", groupScale(0))
                .attr("y", yVal >= 0 ? yScale(yVal) : yScale(0))
                .attr("width", groupScale.bandwidth())
                .attr("height", Math.abs(yScale(yVal) - yScale(0)))
                .attr("fill", fillStyle.barColorLeft);
        }

        if (rightBarData && !isNaN(+rightBarData[yFieldName])) {
            const yVal = +rightBarData[yFieldName];
            groupG.append("rect")
                .attr("class", "mark bar right-bar")
                .attr("x", groupScale(1))
                .attr("y", yVal >= 0 ? yScale(yVal) : yScale(0))
                .attr("width", groupScale.bandwidth())
                .attr("height", Math.abs(yScale(yVal) - yScale(0)))
                .attr("fill", fillStyle.barColorRight);
        }

        // Percentage change indicator
        if (leftBarData && rightBarData && !isNaN(+leftBarData[yFieldName]) && !isNaN(+rightBarData[yFieldName])) {
            const leftValue = +leftBarData[yFieldName];
            const rightValue = +rightBarData[yFieldName];
            let percentValue = 0;
            if (leftValue !== 0) {
                percentValue = Math.round(((rightValue - leftValue) / Math.abs(leftValue)) * 100);
            } else if (rightValue !== 0) {
                percentValue = Infinity; // Or handle as "N/A" or a large number if appropriate
            }

            if (percentValue !== Infinity) {
                const percentText = percentValue > 0 ? `+${percentValue}%` : `${percentValue}%`;
                
                const leftBarCenterRel = groupScale(0) + groupScale.bandwidth() / 2;
                const rightBarCenterRel = groupScale(1) + groupScale.bandwidth() / 2;
                const centerBetweenBarsRel = (leftBarCenterRel + rightBarCenterRel) / 2;

                const indicatorWidth = Math.min(groupScale.bandwidth() * 1.5, 40);
                const indicatorHeight = indicatorWidth / 2;
                const triangleHeight = indicatorHeight * 0.6;

                const dynamicPercentFontSize = calculateFontSize(percentText, indicatorWidth - 4, fillStyle.typography.annotationFontSize, 8);
                
                const maxBarYValue = Math.max(leftValue, rightValue);
                const indicatorYPos = yScale(maxBarYValue) - indicatorHeight - triangleHeight - 5;

                const indicatorGroup = groupG.append("g")
                    .attr("class", "annotation percent-indicator")
                    .attr("transform", `translate(${centerBetweenBarsRel}, ${indicatorYPos})`);

                indicatorGroup.append("rect")
                    .attr("class", "mark indicator-box")
                    .attr("x", -indicatorWidth / 2)
                    .attr("y", 0)
                    .attr("width", indicatorWidth)
                    .attr("height", indicatorHeight)
                    .attr("fill", fillStyle.percentageIndicatorColor)
                    .attr("rx", 2)
                    .attr("ry", 2);

                indicatorGroup.append("path")
                    .attr("class", "mark indicator-triangle")
                    .attr("d", `M${-triangleHeight * 0.8},${indicatorHeight} L${triangleHeight * 0.8},${indicatorHeight} L0,${indicatorHeight + triangleHeight} Z`)
                    .attr("fill", fillStyle.percentageIndicatorColor);

                indicatorGroup.append("text")
                    .attr("class", "text annotation-text")
                    .attr("x", 0)
                    .attr("y", indicatorHeight / 2)
                    .attr("dy", "0.35em") // Vertical center
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", dynamicPercentFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.percentageIndicatorTextColor)
                    .text(percentText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (Percentage indicator is handled in Block 8 as it's integral to data display)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}