/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Bar Chart",
  "chart_name": "vertical_group_bar_plain_chart_04",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 5], [0, "inf"], [2, 3]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "subtle",
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
    const chartDataRaw = data.data && data.data.data ? data.data.data : [];
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or data.colors_dark for dark
    const images = data.images || {}; // Not used in this chart, but extracted per spec

    d3.select(containerSelector).html(""); // Clear the container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;
    const yUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y")?.unit || "");

    if (!xField || !yField || !groupField) {
        const missingFields = [
            !xField ? "x field" : null,
            !yField ? "y field" : null,
            !groupField ? "group field" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    const chartData = chartDataRaw.filter(d => d[yField] !== null && d[yField] !== undefined && !isNaN(parseFloat(d[yField])) && parseFloat(d[yField]) > 0);

    if (chartData.length === 0) {
        d3.select(containerSelector).html("<div>No valid data to display after filtering.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: (colors.other && colors.other.primary) || '#C13C37',
        textColor: colors.text_color || '#333333',
        axisLineColor: '#AAAAAA', // Retained from original baseline stroke
        gridLineColor: '#AAAAAA', // For the baseline
        labelBackgroundColor: '#FFFFFF', // For value label backgrounds
        getGroupColor: (group) => {
            if (colors.field && colors.field[group]) {
                return colors.field[group];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                // Simple hash function to pick a color based on group name, to ensure somewhat consistent color picking
                let hash = 0;
                for (let i = 0; i < group.length; i++) {
                    hash = group.charCodeAt(i) + ((hash << 5) - hash);
                }
                return colors.available_colors[Math.abs(hash) % colors.available_colors.length];
            }
            return fillStyle.primaryColor;
        },
        typography: {
            valueFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            valueFontSize: (typography.annotation && typography.annotation.font_size) || '12px',
            valueFontWeight: (typography.annotation && typography.annotation.font_weight) || 'bold',
            categoryFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            categoryFontSize: (typography.label && typography.label.font_size) || '11px',
            categoryFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            legendFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            legendFontSize: (typography.label && typography.label.font_size) || '11px',
            legendFontWeight: (typography.label && typography.label.font_weight) || 'normal',
        }
    };
    
    // In-memory text measurement utility
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document append/remove is not strictly necessary for getBBox on <text> if styled directly,
        // but some engines might be more reliable if it's briefly in a document fragment or a hidden SVG in DOM.
        // For pure in-memory, direct attribute setting and getBBox on the text element itself is usually enough.
        // However, to be safe and match common patterns:
        // document.body.appendChild(tempSvg); // Not appending to DOM as per directive III.2
        // const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg); // Not appending to DOM
        // A more robust way without appending to body:
        // Create an SVG element, add text, style it, then call getBBox().
        // The created SVG element itself doesn't need to be part of the main document.
        return tempText.getBBox().width;
    }


    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for billion
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    function splitTextIntoLines(text, fontFamily, fontSize, fontWeight, maxWidth) {
        if (!text) return [""];
        const words = String(text).split(/\s+/);
        const lines = [];
        let currentLine = "";

        if (words.length <= 2 && String(text).length > 5) { // Heuristic for CJK or similar
            const chars = String(text).split('');
            currentLine = chars[0] || "";
            for (let i = 1; i < chars.length; i++) {
                const testLine = currentLine + chars[i];
                if (estimateTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = chars[i];
                }
            }
        } else {
            currentLine = words[0] || "";
            for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + " " + words[i];
                if (estimateTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = words[i];
                }
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines.length > 0 ? lines : (text ? [String(text)] : [""]);
    }

    function splitValueTextIntoLines(text, fontFamily, fontSize, fontWeight, maxWidthForSplit) {
        if (!text) return [""];
        const lines = [];
        if (maxWidthForSplit <= 0) return [String(text)]; 

        let currentLine = "";
        const sText = String(text);
        for (let i = 0; i < sText.length; i++) {
            const char = sText[i];
            const testLine = currentLine + char;
            if (estimateTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidthForSplit) {
                currentLine = testLine;
            } else {
                if (currentLine === "") { 
                    lines.push(char);
                } else {
                    lines.push(currentLine);
                    currentLine = char; 
                }
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines.length > 0 ? lines : (sText ? [sText] : [""]);
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    if (colors.background_color) {
        svgRoot.style("background-color", colors.background_color);
    }


    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 40, bottom: 80, left: 40 }; // Default margins
    // Adjust margins if specified in variables
    if (variables.margin_top !== undefined) chartMargins.top = parseFloat(variables.margin_top);
    if (variables.margin_right !== undefined) chartMargins.right = parseFloat(variables.margin_right);
    if (variables.margin_bottom !== undefined) chartMargins.bottom = parseFloat(variables.margin_bottom);
    if (variables.margin_left !== undefined) chartMargins.left = parseFloat(variables.margin_left);
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const xValues = Array.from(new Set(chartData.map(d => d[xField])));
    const groupValues = Array.from(new Set(chartData.map(d => d[groupField])));
    const maxValue = d3.max(chartData, d => +d[yField]) || 0;

    // Block 6: Scale Definition & Configuration
    const xGroupScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(variables.x_group_scale_padding !== undefined ? variables.x_group_scale_padding : 0.2);

    const xBarScale = d3.scaleBand()
        .domain(groupValues)
        .range([0, xGroupScale.bandwidth()])
        .padding(variables.x_bar_scale_padding !== undefined ? variables.x_bar_scale_padding : 0.1);

    const yScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([innerHeight, parseFloat(fillStyle.typography.valueFontSize) * 1.5 + 5]); // Reserve space for value labels above bars

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    
    // Baseline (acting as a subtle gridline)
    mainChartGroup.append("line")
        .attr("class", "gridline baseline")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // X-axis labels
    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis");
        
    const categoryLabelFontSizeNumeric = parseFloat(fillStyle.typography.categoryFontSize);

    const shouldRotateLabels = xValues.some(x => {
        const width = estimateTextWidth(x, fillStyle.typography.categoryFontFamily, fillStyle.typography.categoryFontSize, fillStyle.typography.categoryFontWeight);
        return width > xGroupScale.bandwidth() * 0.9; // Adjusted threshold
    });

    xValues.forEach(xCat => {
        const xPos = xGroupScale(xCat) + xGroupScale.bandwidth() / 2;
        if (shouldRotateLabels) {
            xAxisLabelsGroup.append("text")
                .attr("class", "label category-label")
                .attr("text-anchor", "end")
                .attr("x", xPos)
                .attr("y", innerHeight + 10) // Position below baseline
                .attr("transform", `rotate(-45, ${xPos}, ${innerHeight + 10})`)
                .style("font-family", fillStyle.typography.categoryFontFamily)
                .style("font-size", fillStyle.typography.categoryFontSize)
                .style("font-weight", fillStyle.typography.categoryFontWeight)
                .style("fill", fillStyle.textColor)
                .text(xCat);
        } else {
            const maxWidth = xGroupScale.bandwidth() * 0.95;
            const lines = splitTextIntoLines(xCat, fillStyle.typography.categoryFontFamily, fillStyle.typography.categoryFontSize, fillStyle.typography.categoryFontWeight, maxWidth);
            const lineHeight = categoryLabelFontSizeNumeric * 1.2;
            
            lines.forEach((line, i) => {
                xAxisLabelsGroup.append("text")
                    .attr("class", "label category-label")
                    .attr("text-anchor", "middle")
                    .attr("x", xPos)
                    .attr("y", innerHeight + 15 + i * lineHeight) // Position below baseline
                    .style("font-family", fillStyle.typography.categoryFontFamily)
                    .style("font-size", fillStyle.typography.categoryFontSize)
                    .style("font-weight", fillStyle.typography.categoryFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(line);
            });
        }
    });

    // Legend
    if (groupValues && groupValues.length > 0) {
        const legendMarkerWidth = 12;
        const legendMarkerHeight = 12;
        const legendMarkerRx = 3;
        const legendMarkerRy = 3;
        const legendPadding = 6;
        const legendInterItemSpacing = 12;
        const legendFontSizeNumeric = parseFloat(fillStyle.typography.legendFontSize);

        const legendItemsData = groupValues.map(group => {
            const text = String(group);
            const color = fillStyle.getGroupColor(group);
            const textWidth = estimateTextWidth(text, fillStyle.typography.legendFontFamily, fillStyle.typography.legendFontSize, fillStyle.typography.legendFontWeight);
            const visualWidth = legendMarkerWidth + legendPadding + textWidth;
            return { text, color, visualWidth };
        });

        const legendLines = [];
        let currentLineItems = [];
        let currentLineVisualWidth = 0;
        const availableWidthForLegendWrapping = innerWidth;

        legendItemsData.forEach(item => {
            let widthIfAdded = item.visualWidth;
            if (currentLineItems.length > 0) {
                widthIfAdded += legendInterItemSpacing;
            }

            if (currentLineItems.length > 0 && (currentLineVisualWidth + widthIfAdded) > availableWidthForLegendWrapping) {
                legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
                currentLineItems = [item];
                currentLineVisualWidth = item.visualWidth;
            } else {
                if (currentLineItems.length > 0) {
                    currentLineVisualWidth += legendInterItemSpacing;
                }
                currentLineItems.push(item);
                currentLineVisualWidth += item.visualWidth;
            }
        });

        if (currentLineItems.length > 0) {
            legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
        }

        if (legendLines.length > 0) {
            const itemMaxHeight = Math.max(legendMarkerHeight, legendFontSizeNumeric);
            const interLineVerticalPadding = 6;
            const paddingBelowLegendToChart = 15;
            const minSvgGlobalTopPadding = 15;

            const totalLegendBlockHeight = legendLines.length * itemMaxHeight + Math.max(0, legendLines.length - 1) * interLineVerticalPadding;
            
            let legendBlockStartY = chartMargins.top - paddingBelowLegendToChart - totalLegendBlockHeight;
            legendBlockStartY = Math.max(minSvgGlobalTopPadding, legendBlockStartY);

            const legendContainerGroup = svgRoot.append("g")
                .attr("class", "legend chart-legend"); // Standardized class

            let currentLineBaseY = legendBlockStartY;
            legendLines.forEach((line) => {
                const lineRenderStartX = chartMargins.left + (innerWidth - line.totalVisualWidth) / 2; // Centered within chart area
                const lineCenterY = currentLineBaseY + itemMaxHeight / 2;

                let currentItemDrawX = lineRenderStartX;

                line.items.forEach((item, itemIndex) => {
                    legendContainerGroup.append("rect")
                        .attr("class", "mark legend-marker")
                        .attr("x", currentItemDrawX)
                        .attr("y", currentLineBaseY + (itemMaxHeight - legendMarkerHeight) / 2)
                        .attr("width", legendMarkerWidth)
                        .attr("height", legendMarkerHeight)
                        .attr("rx", legendMarkerRx)
                        .attr("ry", legendMarkerRy)
                        .attr("fill", item.color);

                    legendContainerGroup.append("text")
                        .attr("class", "label legend-label")
                        .attr("x", currentItemDrawX + legendMarkerWidth + legendPadding)
                        .attr("y", lineCenterY)
                        .attr("dominant-baseline", "middle")
                        .style("font-family", fillStyle.typography.legendFontFamily)
                        .style("font-size", fillStyle.typography.legendFontSize)
                        .style("font-weight", fillStyle.typography.legendFontWeight)
                        .style("fill", fillStyle.textColor)
                        .text(item.text);

                    if (itemIndex < line.items.length - 1) {
                         currentItemDrawX += item.visualWidth + legendInterItemSpacing;
                    }
                });
                currentLineBaseY += itemMaxHeight + interLineVerticalPadding;
            });
        }
    }

    // Block 8: Main Data Visualization Rendering
    const barsGroup = mainChartGroup.append("g").attr("class", "bars-group");
    const valueLabelFontSizeNumeric = parseFloat(fillStyle.typography.valueFontSize);

    xValues.forEach(xCat => {
        groupValues.forEach(groupCat => {
            const dataPoint = chartData.find(d => d[xField] === xCat && d[groupField] === groupCat);
            if (!dataPoint) return;
            
            const value = +dataPoint[yField];
            if (value <= 0) return;
            
            const barColor = fillStyle.getGroupColor(groupCat);
            
            const barX = xGroupScale(xCat) + xBarScale(groupCat);
            const barY = yScale(value);
            const barHeight = innerHeight - barY;
            const barWidth = xBarScale.bandwidth();
            const barMidX = barX + barWidth / 2;
            
            // Draw rectangular bars
            barsGroup.append("rect")
                .attr("class", "mark value bar")
                .attr("x", barX)
                .attr("y", barY)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", barColor);
                
            // Value labels above bars
            const formattedValue = formatValue(value);
            const valText = `${formattedValue}${yUnit}`;
            
            const maxTextWidthForValue = barWidth - 4; // Small padding
            const lines = splitValueTextIntoLines(valText, fillStyle.typography.valueFontFamily, fillStyle.typography.valueFontSize, fillStyle.typography.valueFontWeight, maxTextWidthForValue);
            
            const actualLineHeight = valueLabelFontSizeNumeric * 1.2;
            const wrappedLabelHeight = lines.length * actualLineHeight;
            
            const labelAboveBarBottomMargin = 4;
            const startYForFirstLineCenter = barY - labelAboveBarBottomMargin - wrappedLabelHeight + actualLineHeight / 2;
            
            const maxWrappedTextWidth = d3.max(lines, l => estimateTextWidth(l, fillStyle.typography.valueFontFamily, fillStyle.typography.valueFontSize, fillStyle.typography.valueFontWeight)) || 0;
            
            if (maxWrappedTextWidth > 0 && variables.show_value_label_background !== false) { // Optional background
                const rectPadding = 3;
                const bgRectWidth = Math.max(barWidth * 0.8, maxWrappedTextWidth + rectPadding * 2); // Background width can be based on text or bar
                const bgRectHeight = wrappedLabelHeight + rectPadding;
                const bgRectY = startYForFirstLineCenter - (actualLineHeight / 2) - rectPadding / 2;
                
                barsGroup.append("rect")
                    .attr("class", "other value-label-background")
                    .attr("x", barMidX - bgRectWidth / 2)
                    .attr("y", bgRectY)
                    .attr("width", bgRectWidth)
                    .attr("height", bgRectHeight)
                    .attr("rx", 2)
                    .attr("ry", 2)
                    .attr("fill", fillStyle.labelBackgroundColor);
            }
            
            lines.forEach((line, i) => {
                barsGroup.append("text")
                    .attr("class", "label value-label")
                    .attr("text-anchor", "middle")
                    .attr("x", barMidX)
                    .attr("y", startYForFirstLineCenter + (i * actualLineHeight))
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.valueFontFamily)
                    .style("font-size", fillStyle.typography.valueFontSize)
                    .style("font-weight", fillStyle.typography.valueFontWeight)
                    .style("fill", fillStyle.textColor) // Using general text color for labels on background
                    .text(line);
            });
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this refactoring beyond core chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}