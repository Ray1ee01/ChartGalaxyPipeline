/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Bar Chart",
  "chart_name": "vertical_group_bar_chart_8",
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
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming dark theme preference if both exist
    // const imagesConfig = data.images || {}; // Not used in this chart
    const dataColumns = data.data?.columns || [];
    let chartDataArray = data.data?.data || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getField = (role) => dataColumns.find(col => col.role === role)?.name;
    const getUnit = (role) => {
        const unit = dataColumns.find(col => col.role === role)?.unit;
        return unit === "none" ? "" : unit || "";
    };

    const xFieldName = getField(xFieldRole);
    const yFieldName = getField(yFieldRole);
    const groupFieldName = getField(groupFieldRole);
    const yFieldUnit = getUnit(yFieldRole);

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? `role '${xFieldRole}'` : null,
            !yFieldName ? `role '${yFieldRole}'` : null,
            !groupFieldName ? `role '${groupFieldRole}'` : null
        ].filter(Boolean).join(", ");

        const errorMessage = `Critical chart config missing: Field names for roles (${missingFields}) not found in data.data.columns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    chartDataArray = chartDataArray.filter(d => d[yFieldName] !== null && d[yFieldName] !== undefined && !isNaN(parseFloat(d[yFieldName])) && +d[yFieldName] > 0);

    if (!chartDataArray.length) {
        const noDataMessage = "No valid data points to render after filtering.";
        console.warn(noDataMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='padding:10px;'>${noDataMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyConfig.title?.font_size || '16px',
            titleFontWeight: typographyConfig.title?.font_weight || 'bold',
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '12px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'bold',
        },
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        primaryColor: colorsConfig.other?.primary || '#C13C37',
        axisLineColor: colorsConfig.other?.axis_line || '#AAAAAA',
        dataLabelBackgroundColor: colorsConfig.other?.data_label_background || '#FFFFFF',
        getGroupColor: (groupValue) => {
            if (colorsConfig.field && colorsConfig.field[groupValue]) {
                return colorsConfig.field[groupValue];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                // Simple hash function to pick a color consistently
                let hash = 0;
                for (let i = 0; i < String(groupValue).length; i++) {
                    hash = String(groupValue).charCodeAt(i) + ((hash << 5) - hash);
                }
                return colorsConfig.available_colors[Math.abs(hash) % colorsConfig.available_colors.length];
            }
            return fillStyle.primaryColor;
        }
    };

    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but for estimation without DOM manipulation, this is a common approach.
        // For higher accuracy, a brief append/remove cycle might be needed.
        // However, the directive says "MUST NOT be appended to the document DOM".
        // So we rely on the SVG engine's ability to calculate without full rendering.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements is problematic
            // This is a rough approximation
            const avgCharWidth = parseFloat(fontSize) * 0.6;
            return text.length * avgCharWidth;
        }
    };
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (value >= 1000000) return d3.format("~.2s")(value).replace('M', 'M');
        if (value >= 1000) return d3.format("~.2s")(value).replace('k', 'K');
        return d3.format("~.2g")(value); // Use .2g for smaller numbers to avoid excessive precision
    };

    function splitTextIntoLines(text, fontFamily, fontSize, fontWeight, maxWidth) {
        if (!text) return [""];
        const words = String(text).split(/\s+/);
        const lines = [];
        let currentLine = "";

        if (words.length <= 2 && String(text).length > 5 && !String(text).includes(' ')) { // Likely CJK or single long word
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
        for (let i = 0; i < String(text).length; i++) {
            const char = String(text)[i];
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
        return lines.length > 0 ? lines : (text ? [String(text)] : [""]);
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 600;
    const containerHeight = chartConfig.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendHeightEstimate = 60; // Estimate for legend, adjust if dynamic
    const xAxisLabelMaxHeightEstimate = 60; // Estimate for multi-line/rotated x-axis labels

    const chartMargins = {
        top: chartConfig.margin_top || legendHeightEstimate, // Space for legend
        right: chartConfig.margin_right || 40,
        bottom: chartConfig.margin_bottom || xAxisLabelMaxHeightEstimate, // Space for X-axis labels
        left: chartConfig.margin_left || 40
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const valueLabelPaddingAboveBar = 4; // Space for value labels above bars
    const valueLabelFontSizePx = parseFloat(fillStyle.typography.annotationFontSize);


    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const xValues = Array.from(new Set(chartDataArray.map(d => d[xFieldName]))).sort(); // Sort for consistent order
    const groupValues = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort();

    const maxValue = d3.max(chartDataArray, d => +d[yFieldName]) || 0;

    // Block 6: Scale Definition & Configuration
    const xGroupScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(chartConfig.x_group_padding || 0.2);

    const xBarScale = d3.scaleBand()
        .domain(groupValues)
        .range([0, xGroupScale.bandwidth()])
        .padding(chartConfig.x_bar_padding || 0.1);

    const yScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([innerHeight, valueLabelFontSizePx * 2 + valueLabelPaddingAboveBar]); // Ensure space for labels above bars

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // X-axis baseline
    mainChartGroup.append("line")
        .attr("class", "axis baseline x-axis-baseline")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // X-axis labels
    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis-labels");
    
    const xLabelFontSizePx = parseFloat(fillStyle.typography.labelFontSize);
    const xLabelLineHeightFactor = 1.2;

    const shouldRotateXLabels = xValues.some(xVal => {
        const textWidth = estimateTextWidth(xVal, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        return textWidth > xGroupScale.bandwidth() * 0.9; // Heuristic for rotation
    });

    xValues.forEach(xVal => {
        const xPos = xGroupScale(xVal) + xGroupScale.bandwidth() / 2;
        const labelElement = xAxisLabelsGroup.append("text")
            .attr("class", "label x-axis-label")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor);

        if (shouldRotateXLabels) {
            labelElement
                .attr("text-anchor", "end")
                .attr("x", xPos - xLabelFontSizePx * 0.3) // Slight adjustment for rotation
                .attr("y", innerHeight + xLabelFontSizePx * 0.8)
                .attr("transform", `rotate(-45, ${xPos}, ${innerHeight + xLabelFontSizePx * 0.8})`)
                .text(xVal);
        } else {
            const lines = splitTextIntoLines(xVal, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight, xGroupScale.bandwidth() * 0.95);
            labelElement.attr("text-anchor", "middle");
            lines.forEach((line, i) => {
                labelElement.append("tspan")
                    .attr("x", xPos)
                    .attr("dy", i === 0 ? `${xLabelFontSizePx * xLabelLineHeightFactor}` : `${xLabelFontSizePx * xLabelLineHeightFactor}`)
                    .attr("y", i === 0 ? innerHeight + (xLabelFontSizePx * (xLabelLineHeightFactor -1))/2 : undefined) // Adjust first line to be below baseline
                    .text(line);
            });
        }
    });

    // Legend
    if (groupValues && groupValues.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend");

        const legendMarkerSize = 12;
        const legendPadding = 6;
        const legendInterItemSpacing = 12;
        const legendItemMaxHeight = Math.max(legendMarkerSize, parseFloat(fillStyle.typography.labelFontSize));
        const legendInterLineSpacing = 6;
        
        const legendItemsData = groupValues.map(group => {
            const text = String(group);
            const color = fillStyle.getGroupColor(group);
            const textWidth = estimateTextWidth(text, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            const visualWidth = legendMarkerSize + legendPadding + textWidth;
            return { text, color, visualWidth };
        });

        const legendLines = [];
        let currentLineItems = [];
        let currentLineVisualWidth = 0;
        const availableWidthForLegend = containerWidth - chartMargins.left - chartMargins.right; // Use full container width for centering

        legendItemsData.forEach(item => {
            let widthIfAdded = item.visualWidth;
            if (currentLineItems.length > 0) {
                widthIfAdded += legendInterItemSpacing;
            }
            if (currentLineItems.length > 0 && (currentLineVisualWidth + widthIfAdded) > availableWidthForLegend) {
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
            const totalLegendBlockHeight = legendLines.length * legendItemMaxHeight + Math.max(0, legendLines.length - 1) * legendInterLineSpacing;
            let legendBlockStartY = (chartMargins.top - totalLegendBlockHeight) / 2; // Center in top margin
            legendBlockStartY = Math.max(10, legendBlockStartY); // Ensure some padding from SVG top

            let currentLineBaseY = legendBlockStartY;

            legendLines.forEach(line => {
                const lineRenderStartX = (containerWidth - line.totalVisualWidth) / 2; // Center line horizontally in SVG
                const lineCenterY = currentLineBaseY + legendItemMaxHeight / 2;
                let currentItemDrawX = lineRenderStartX;

                line.items.forEach(item => {
                    legendGroup.append("rect")
                        .attr("class", "mark legend-mark")
                        .attr("x", currentItemDrawX)
                        .attr("y", currentLineBaseY + (legendItemMaxHeight - legendMarkerSize) / 2)
                        .attr("width", legendMarkerSize)
                        .attr("height", legendMarkerSize)
                        .attr("fill", item.color);

                    legendGroup.append("text")
                        .attr("class", "label legend-label")
                        .attr("x", currentItemDrawX + legendMarkerSize + legendPadding)
                        .attr("y", lineCenterY)
                        .attr("dominant-baseline", "middle")
                        .style("font-family", fillStyle.typography.labelFontFamily)
                        .style("font-size", fillStyle.typography.labelFontSize)
                        .style("font-weight", fillStyle.typography.labelFontWeight)
                        .style("fill", fillStyle.textColor)
                        .text(item.text);
                    
                    currentItemDrawX += item.visualWidth + legendInterItemSpacing;
                });
                currentLineBaseY += legendItemMaxHeight + legendInterLineSpacing;
            });
        }
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barsGroup = mainChartGroup.append("g")
        .attr("class", "marks bars-group");

    xValues.forEach(xVal => {
        const groupXPos = xGroupScale(xVal);
        const xGroup = barsGroup.append("g")
            .attr("class", `mark-group x-group ${String(xVal).replace(/\s+/g, '-')}`)
            .attr("transform", `translate(${groupXPos}, 0)`);

        groupValues.forEach(groupVal => {
            const dataPoint = chartDataArray.find(d => d[xFieldName] === xVal && d[groupFieldName] === groupVal);
            if (!dataPoint) return;

            const value = +dataPoint[yFieldName];
            if (value <= 0) return;

            const barColor = fillStyle.getGroupColor(groupVal);
            const barX = xBarScale(groupVal);
            const barY = yScale(value);
            const barHeight = innerHeight - barY;
            const barWidth = xBarScale.bandwidth();

            if (barHeight < 0 || barWidth <=0) return; // Skip rendering if dimensions are invalid

            xGroup.append("rect")
                .attr("class", "mark bar")
                .attr("x", barX)
                .attr("y", barY)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", barColor);

            // Value Labels
            const valText = `${formatValue(value)}${yFieldUnit}`;
            const valueLabelLines = splitValueTextIntoLines(valText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight, barWidth * 0.95);
            
            const valueLabelLineHeight = valueLabelFontSizePx * 1.2;
            const totalWrappedLabelHeight = valueLabelLines.length * valueLabelLineHeight;
            
            // Position labels above the bar
            let firstLineCenterY = barY - valueLabelPaddingAboveBar - totalWrappedLabelHeight + (valueLabelLineHeight / 2);

            // Optional: Add background for readability if configured
            const showValueLabelBackground = chartConfig.show_value_label_background !== undefined ? chartConfig.show_value_label_background : true; // Default to true
            if (showValueLabelBackground && valueLabelLines.length > 0 && valueLabelLines[0] !== "") {
                const maxWrappedTextWidth = d3.max(valueLabelLines, l => estimateTextWidth(l, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight)) || 0;
                if (maxWrappedTextWidth > 0) {
                    const bgRectPadding = 2;
                    const bgRectWidth = Math.min(barWidth, maxWrappedTextWidth + bgRectPadding * 2); // Fit to text or bar width
                    const bgRectHeight = totalWrappedLabelHeight + bgRectPadding;
                    const bgRectX = barX + (barWidth - bgRectWidth) / 2; // Center background
                    const bgRectY = firstLineCenterY - (valueLabelLineHeight / 2) - (bgRectPadding / 2);
                    
                    xGroup.append("rect")
                        .attr("class", "background data-label-background")
                        .attr("x", bgRectX)
                        .attr("y", bgRectY)
                        .attr("width", bgRectWidth)
                        .attr("height", bgRectHeight)
                        .attr("rx", 2)
                        .attr("ry", 2)
                        .attr("fill", fillStyle.dataLabelBackgroundColor)
                        .attr("fill-opacity", 0.85);
                }
            }

            valueLabelLines.forEach((line, i) => {
                const textY = firstLineCenterY + (i * valueLabelLineHeight);
                xGroup.append("text")
                    .attr("class", "label value-label")
                    .attr("text-anchor", "middle")
                    .attr("x", barX + barWidth / 2)
                    .attr("y", textY)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor) // Use general text color for better contrast
                    .text(line);
            });
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (No further enhancements in this refactoring beyond what's in Block 8)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}