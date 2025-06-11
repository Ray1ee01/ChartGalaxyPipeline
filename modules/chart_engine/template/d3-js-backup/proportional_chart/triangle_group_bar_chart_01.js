/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Triangle Chart",
  "chart_name": "triangle_group_bar_chart_01",
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const dataColumns = data.data?.columns || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const rawColors = data.colors_dark || data.colors || {}; // Prefer dark theme colors if available
    const images = data.images || {}; // Though not used in this chart

    d3.select(containerSelector).html(""); // Clear the container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    let yUnit = dataColumns.find(col => col.role === "y")?.unit || "";
    if (yUnit === "none") yUnit = "";

    const missingFields = [];
    if (!xField) missingFields.push("xField (role: 'x')");
    if (!yField) missingFields.push("yField (role: 'y')");
    if (!groupField) missingFields.push("groupField (role: 'group')");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("font-family", "sans-serif")
            .text(errorMsg);
        return null;
    }

    const chartDataArray = chartDataInput.filter(d => d[yField] !== null && d[yField] !== undefined && +d[yField] > 0);

    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points found after filtering (y-values > 0). Cannot render chart.";
        console.error(errorMsg);
         d3.select(containerSelector).append("div")
            .style("color", "red") // Standardizing to red for errors
            .style("font-family", "sans-serif")
            .text(errorMsg);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            annotationFontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typography.annotation?.font_size || '12px',
            annotationFontWeight: typography.annotation?.font_weight || 'bold',
            labelFontFamily: typography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typography.label?.font_size || '11px', // Original used 11, not 12px from prompt example
            labelFontWeight: typography.label?.font_weight || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        primaryAccent: rawColors.other?.primary || "#C13C37",
        getGroupColor: (groupValue, index, groupValues) => { // Added index and groupValues for available_colors fallback
            if (rawColors.field && rawColors.field[groupValue]) {
                return rawColors.field[groupValue];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[index % rawColors.available_colors.length];
            }
            return fillStyle.primaryAccent;
        },
        axisLineColor: rawColors.other?.grid || '#AAAAAA', // Assuming grid color can be used for axis line
        valueLabelBackgroundColor: rawColors.value_label_background || '#FFFFFF', // Custom token
        barOpacity: 0.7,
        valueLabelBackgroundOpacity: 0.9,
        legendMarkerOpacity: 0.85,
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // No DOM append needed for getBBox on <text> in modern browsers if attributes are set.
        // For full safety, one might append to a non-rendered SVG in DOM, but trying without first.
        // If issues arise, append to a temporary SVG in document.body, measure, then remove.
        const width = textElement.getBBox().width;
        return width;
    }
    
    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    function splitTextIntoLines(text, fontFamily, fontSize, fontWeight, maxWidth) {
        if (!text) return [""];
        const words = String(text).split(/\s+/);
        const lines = [];
        let currentLine = "";
        const spaceWidth = estimateTextWidth(" ", fontFamily, fontSize, fontWeight);

        if (words.length <= 2 && String(text).length > 5) { // Heuristic for CJK-like text
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
        if (maxWidthForSplit <= 0) return [String(text)];
        
        const lines = [];
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

    function createRoundedTrianglePath(topPoint, leftPoint, rightPoint, radius) {
        function calculateUnitVector(p1, p2) {
            const dx = p2[0] - p1[0];
            const dy = p2[1] - p1[1];
            const length = Math.sqrt(dx * dx + dy * dy);
            return length === 0 ? [0,0] : [dx / length, dy / length];
        }
        
        const top_left = calculateUnitVector(topPoint, leftPoint);
        const left_right = calculateUnitVector(leftPoint, rightPoint);
        const right_top = calculateUnitVector(rightPoint, topPoint);
        
        const topLeftStart = [ topPoint[0] + top_left[0] * radius, topPoint[1] + top_left[1] * radius ];
        const leftRightStart = [ leftPoint[0] + left_right[0] * radius, leftPoint[1] + left_right[1] * radius ];
        const rightTopStart = [ rightPoint[0] + right_top[0] * radius, rightPoint[1] + right_top[1] * radius ];
        
        const topRightEnd = [ topPoint[0] - right_top[0] * radius, topPoint[1] - right_top[1] * radius ];
        const leftTopEnd = [ leftPoint[0] - top_left[0] * radius, leftPoint[1] - top_left[1] * radius ];
        const rightLeftEnd = [ rightPoint[0] - left_right[0] * radius, rightPoint[1] - left_right[1] * radius ];
        
        return `M ${topLeftStart[0]},${topLeftStart[1]} L ${leftTopEnd[0]},${leftTopEnd[1]} A ${radius},${radius} 0 0 0 ${leftRightStart[0]},${leftRightStart[1]} L ${rightLeftEnd[0]},${rightLeftEnd[1]} A ${radius},${radius} 0 0 0 ${rightTopStart[0]},${rightTopStart[1]} L ${topRightEnd[0]},${topRightEnd[1]} A ${radius},${radius} 0 0 0 ${topLeftStart[0]},${topLeftStart[1]} Z`;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", rawColors.background_color || 'transparent');


    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 40, bottom: 80, left: 40 }; // Adjusted for legend and labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const xValues = Array.from(new Set(chartDataArray.map(d => d[xField])));
    const groupValues = Array.from(new Set(chartDataArray.map(d => d[groupField])));
    const maxValue = d3.max(chartDataArray, d => +d[yField]) || 0;

    // Block 6: Scale Definition & Configuration
    const xGroupScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.2);
        
    const xBarScale = d3.scaleBand()
        .domain(groupValues)
        .range([0, xGroupScale.bandwidth()])
        .padding(0.1);
    
    const yScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([innerHeight, 50]); // 50px space at the top for labels

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    
    // Baseline
    mainChartGroup.append("line")
        .attr("class", "gridline baseline")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // X-Axis Labels
    const xAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis x-axis");
    const parsedCategoryFontSize = parseFloat(fillStyle.typography.labelFontSize);

    const shouldRotateLabels = xValues.some(xVal => {
        const width = estimateTextWidth(xVal, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        return width > xGroupScale.bandwidth() * 0.8;
    });

    xValues.forEach(xVal => {
        const xPos = xGroupScale(xVal) + xGroupScale.bandwidth() / 2;
        if (shouldRotateLabels) {
            xAxisLabelsGroup.append("text")
                .attr("class", "label x-axis-label")
                .attr("text-anchor", "end")
                .attr("x", xPos)
                .attr("y", innerHeight + 10)
                .attr("transform", `rotate(-45, ${xPos}, ${innerHeight + 10})`)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(xVal);
        } else {
            const maxWidth = xGroupScale.bandwidth() * 0.9;
            const lines = splitTextIntoLines(xVal, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight, maxWidth);
            const lineHeight = parsedCategoryFontSize * 1.2;
            lines.forEach((line, i) => {
                xAxisLabelsGroup.append("text")
                    .attr("class", "label x-axis-label")
                    .attr("text-anchor", "middle")
                    .attr("x", xPos)
                    .attr("y", innerHeight + 15 + i * lineHeight) // Start 15px below baseline
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
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
        const parsedLegendFontSize = parseFloat(fillStyle.typography.labelFontSize);

        const legendItemsData = groupValues.map((group, i) => {
            const text = String(group);
            const color = fillStyle.getGroupColor(group, i, groupValues);
            const textWidth = estimateTextWidth(text, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            const visualWidth = legendMarkerWidth + legendPadding + textWidth;
            return { text, color, visualWidth };
        });

        const legendLines = [];
        let currentLineItems = [];
        let currentLineVisualWidth = 0;
        const availableWidthForLegendWrapping = innerWidth; // Legend uses chart body width

        legendItemsData.forEach(item => {
            let widthIfAdded = item.visualWidth;
            if (currentLineItems.length > 0) widthIfAdded += legendInterItemSpacing;

            if (currentLineItems.length > 0 && (currentLineVisualWidth + widthIfAdded) > availableWidthForLegendWrapping) {
                legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
                currentLineItems = [item];
                currentLineVisualWidth = item.visualWidth;
            } else {
                if (currentLineItems.length > 0) currentLineVisualWidth += legendInterItemSpacing;
                currentLineItems.push(item);
                currentLineVisualWidth += item.visualWidth;
            }
        });
        if (currentLineItems.length > 0) {
            legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
        }

        if (legendLines.length > 0) {
            const itemMaxHeight = Math.max(legendMarkerHeight, parsedLegendFontSize);
            const interLineVerticalPadding = 6;
            const paddingBelowLegendToChart = 15;
            const minSvgGlobalTopPadding = 15;

            const totalLegendBlockHeight = legendLines.length * itemMaxHeight + Math.max(0, legendLines.length - 1) * interLineVerticalPadding;
            let legendBlockStartY = chartMargins.top - paddingBelowLegendToChart - totalLegendBlockHeight;
            legendBlockStartY = Math.max(minSvgGlobalTopPadding, legendBlockStartY);

            const legendContainerGroup = svgRoot.append("g").attr("class", "legend");
            let currentLineBaseY = legendBlockStartY;

            legendLines.forEach((line) => {
                const lineRenderStartX = chartMargins.left + (innerWidth - line.totalVisualWidth) / 2; // Centered within chart body
                const lineCenterY = currentLineBaseY + itemMaxHeight / 2;
                let currentItemDrawX = lineRenderStartX;

                line.items.forEach((item, itemIndex) => {
                    legendContainerGroup.append("rect")
                        .attr("class", "legend-marker")
                        .attr("x", currentItemDrawX)
                        .attr("y", currentLineBaseY + (itemMaxHeight - legendMarkerHeight) / 2)
                        .attr("width", legendMarkerWidth)
                        .attr("height", legendMarkerHeight)
                        .attr("rx", legendMarkerRx)
                        .attr("ry", legendMarkerRy)
                        .attr("fill", item.color)
                        .attr("fill-opacity", fillStyle.legendMarkerOpacity);

                    legendContainerGroup.append("text")
                        .attr("class", "legend-label")
                        .attr("x", currentItemDrawX + legendMarkerWidth + legendPadding)
                        .attr("y", lineCenterY)
                        .attr("dominant-baseline", "middle")
                        .style("font-family", fillStyle.typography.labelFontFamily)
                        .style("font-size", fillStyle.typography.labelFontSize)
                        .style("font-weight", fillStyle.typography.labelFontWeight)
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
    const barsGroup = mainChartGroup.append("g").attr("class", "marks-group");
    const parsedValueFontSize = parseFloat(fillStyle.typography.annotationFontSize);

    xValues.forEach(xVal => {
        groupValues.forEach((groupVal, groupIndex) => {
            const dataPoint = chartDataArray.find(d => d[xField] === xVal && d[groupField] === groupVal);
            if (!dataPoint) return;
            
            const value = +dataPoint[yField];
            // Value > 0 check already done in chartDataArray filtering
            
            const barColor = fillStyle.getGroupColor(groupVal, groupIndex, groupValues);
            
            const barX = xGroupScale(xVal) + xBarScale(groupVal);
            const barY = yScale(value); // Top of the triangle
            // const barHeight = innerHeight - barY; // Not directly used for triangle path
            const barWidth = xBarScale.bandwidth();
            const barMidX = barX + barWidth / 2;
            
            const cornerRadius = 4;
            const trianglePath = createRoundedTrianglePath(
                [barMidX, barY],
                [barX, innerHeight], // Left base
                [barX + barWidth, innerHeight], // Right base
                cornerRadius
            );
            
            barsGroup.append("path")
                .attr("class", "mark bar triangle-bar")
                .attr("d", trianglePath)
                .attr("fill", barColor)
                .attr("fill-opacity", fillStyle.barOpacity);
                
            const formattedValue = formatValue(value);
            const valText = `${formattedValue}${yUnit}`;
            
            const maxTextWidth = barWidth - 4; // Small padding for text within bar width
            const lines = splitValueTextIntoLines(valText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight, maxTextWidth);
            
            const actualLineHeight = parsedValueFontSize * 1.2;
            const wrappedLabelHeight = lines.length * actualLineHeight;
            const labelAboveBarBottomMargin = 4;
            const startYForFirstLineCenter = barY - labelAboveBarBottomMargin - wrappedLabelHeight + actualLineHeight / 2;
            
            const maxWrappedTextWidth = d3.max(lines, l => estimateTextWidth(l, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight)) || 0;
            
            if (maxWrappedTextWidth > 0) {
                const rectPadding = 3;
                const bgRectWidth = Math.max(barWidth * 0.8, maxWrappedTextWidth + rectPadding * 2); // Ensure min width related to bar
                const bgRectHeight = wrappedLabelHeight + rectPadding;
                const bgRectY = startYForFirstLineCenter - (actualLineHeight / 2) - rectPadding / 2;
                
                barsGroup.append("rect")
                    .attr("class", "label-background value-label-background")
                    .attr("x", barMidX - bgRectWidth / 2)
                    .attr("y", bgRectY)
                    .attr("width", bgRectWidth)
                    .attr("height", bgRectHeight)
                    .attr("rx", 2)
                    .attr("ry", 2)
                    .attr("fill", fillStyle.valueLabelBackgroundColor)
                    .attr("fill-opacity", fillStyle.valueLabelBackgroundOpacity);
            }
            
            lines.forEach((line, i) => {
                const textY = startYForFirstLineCenter + (i * actualLineHeight);
                barsGroup.append("text")
                    .attr("class", "label data-label value-label")
                    .attr("text-anchor", "middle")
                    .attr("x", barMidX)
                    .attr("y", textY)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", barColor) // Using bar color for label text
                    .text(line);
            });
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No enhancements like annotations or interactivity in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}