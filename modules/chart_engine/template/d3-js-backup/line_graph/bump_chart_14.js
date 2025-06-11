/* REQUIREMENTS_BEGIN
{
  "chart_type": "Sorted Lines Chart",
  "chart_name": "bump_chart_14",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 12], [0, "inf"], [4, 10]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
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
    // This function renders a Sorted Lines Chart (Bump Chart).
    // It displays trends of different groups over time points,
    // with circle sizes representing values.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const timeFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    const timeFieldName = timeFieldDef ? timeFieldDef.name : undefined;
    const valueFieldName = valueFieldDef ? valueFieldDef.name : undefined;
    const groupFieldName = groupFieldDef ? groupFieldDef.name : undefined;

    if (!timeFieldName || !valueFieldName || !groupFieldName) {
        const missingFields = [
            !timeFieldName ? "x role field" : null,
            !valueFieldName ? "y role field" : null,
            !groupFieldName ? "group role field" : null
        ].filter(Boolean).join(", ");

        const errorMessage = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) ? typographyInput.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) ? typographyInput.title.font_size : '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) ? typographyInput.title.font_weight : 'bold',
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        defaultLineStrokeWidth: 2,
        circleStrokeColor: colorsInput.background_color || '#FFFFFF', // For contrast against circle fill
        circleStrokeWidth: 1.5,
        legendIconBorderColor: '#000000',
        legendIconBorderWidth: 0.2,
        legendIconFillNoImage: '#FFFFFF',
    };

    function estimateTextMetrics(text, fontFamily, fontSize, fontWeight) {
        if (!text) return { width: 0, height: 0 };
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        svg.style.width = '0px';
        svg.style.height = '0px';
        // No need to append to DOM for getBBox if attributes are set directly
        // document.body.appendChild(svg); // Not appending to DOM

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        
        // Must be in DOM to use getBBox, so create a temporary one
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.visibility = 'hidden';
        tempDiv.appendChild(svg);
        document.body.appendChild(tempDiv);

        let bbox = { width: 0, height: 0 };
        try {
            bbox = textElement.getBBox();
        } catch (e) {
            // console.warn("BBox calculation error:", e);
        }
        
        document.body.removeChild(tempDiv);
        return { width: bbox.width, height: bbox.height };
    }
    
    function getAdaptedFontSize(text, maxWidth, initialFontSize, fontFamily, fontWeight) {
        let fontSize = parseFloat(initialFontSize);
        if (isNaN(fontSize)) fontSize = 10; // Default if initial is not a number

        while (fontSize > 1) {
            const metrics = estimateTextMetrics(text, fontFamily, fontSize + "px", fontWeight);
            if (metrics.width <= maxWidth) {
                break;
            }
            fontSize -= 1;
        }
        return fontSize;
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format(".1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format(".1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format(".0f")(value / 1000) + "K";
        return d3.format(".0f")(value);
    }

    function isColorDarkEnough(color) {
        try {
            const rgb = d3.color(color).rgb();
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            return brightness < 128;
        } catch (e) {
            return false;
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 100, // Adjusted for legend and top time labels
        right: 50,
        bottom: 30,
        left: 30
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const timePoints = [...new Set(chartData.map(d => d[timeFieldName]))].sort((a, b) => {
        // Basic sort, assumes timePoints are comparable (e.g. years as numbers, or lexicographical for strings)
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
    });
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];

    let allDataPresent = true;
    for (const group of groups) {
        for (const timePoint of timePoints) {
            if (!chartData.some(d => d[groupFieldName] === group && d[timeFieldName] === timePoint)) {
                allDataPresent = false;
                break;
            }
        }
        if (!allDataPresent) break;
    }

    if (!allDataPresent) {
        const errorMessage = "Data is incomplete: each group must have data for all time points. Chart cannot be rendered.";
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMessage}</div>`);
        return null;
    }
    
    const maxValue = d3.max(chartData, d => +d[valueFieldName]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(timePoints)
        .range([0, innerWidth])
        .padding(0.1);

    const yScale = d3.scaleBand()
        .domain(groups)
        .range([0, innerHeight])
        .padding(0.2);

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => {
            if (colorsInput.field && colorsInput.field[group]) {
                return colorsInput.field[group];
            }
            if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                return colorsInput.available_colors[i % colorsInput.available_colors.length];
            }
            return d3.schemeCategory10[i % 10];
        }));
    
    const minCircleRadius = 2;
    const maxRadiusForTimePointWidth = (xScale.bandwidth() / 2) * 0.9;
    const maxRadiusForTimePointHeight = (yScale.bandwidth() / 2) * 0.9;
    const maxPossibleRadius = Math.min(maxRadiusForTimePointWidth, maxRadiusForTimePointHeight, 30); // Cap max radius

    const areaScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([Math.PI * Math.pow(minCircleRadius, 2), Math.PI * Math.pow(maxPossibleRadius, 2)])
        .clamp(true);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Legend
    if (groups && groups.length > 0) {
        const legendConfig = {
            circleSize: 12,
            padding: 6,
            interItemSpacing: 12,
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: parseFloat(fillStyle.typography.labelFontSize) || 11,
            fontWeight: fillStyle.typography.labelFontWeight,
            textColor: fillStyle.textColor,
            itemMaxHeight: Math.max(12, parseFloat(fillStyle.typography.labelFontSize) || 11),
            interLineVerticalPadding: 6,
            svgGlobalTopPadding: 15,
        };

        const legendItemsData = groups.map(group => {
            const text = String(group);
            const color = colorScale(group);
            const textWidth = estimateTextMetrics(text, legendConfig.fontFamily, legendConfig.fontSize + "px", legendConfig.fontWeight).width;
            const visualWidth = legendConfig.circleSize + legendConfig.padding + // Color circle + padding
                                legendConfig.circleSize + legendConfig.padding + // Icon circle + padding
                                textWidth; // Text
            return { text, color, visualWidth, group, imageUrl: (imagesInput.field && imagesInput.field[group]) ? imagesInput.field[group] : null };
        });

        const legendLines = [];
        let currentLineItems = [];
        let currentLineVisualWidth = 0;
        const availableWidthForLegendWrapping = innerWidth;

        legendItemsData.forEach(item => {
            let widthIfAdded = item.visualWidth;
            if (currentLineItems.length > 0) widthIfAdded += legendConfig.interItemSpacing;

            if (currentLineItems.length > 0 && (currentLineVisualWidth + widthIfAdded) > availableWidthForLegendWrapping) {
                legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
                currentLineItems = [item];
                currentLineVisualWidth = item.visualWidth;
            } else {
                if (currentLineItems.length > 0) currentLineVisualWidth += legendConfig.interItemSpacing;
                currentLineItems.push(item);
                currentLineVisualWidth += item.visualWidth;
            }
        });
        if (currentLineItems.length > 0) {
            legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
        }

        if (legendLines.length > 0) {
            const legendContainerGroup = mainChartGroup.append("g")
                .attr("class", "legend");
            const defs = legendContainerGroup.append("defs");
            let legendBlockStartY = -chartMargins.top + legendConfig.svgGlobalTopPadding;
            let currentLineBaseY = legendBlockStartY;

            legendLines.forEach((line, lineIndex) => {
                const lineRenderStartX = (innerWidth - line.totalVisualWidth) / 2;
                const lineCenterY = currentLineBaseY + legendConfig.itemMaxHeight / 2;
                let currentItemDrawX = lineRenderStartX;

                line.items.forEach((item, itemIndex) => {
                    const legendItemGroup = legendContainerGroup.append("g")
                        .attr("class", "legend-item");
                    
                    const circleRadius = legendConfig.circleSize / 2;

                    // Color Circle
                    legendItemGroup.append("circle")
                        .attr("class", "mark legend-color-mark")
                        .attr("cx", currentItemDrawX + circleRadius)
                        .attr("cy", lineCenterY)
                        .attr("r", circleRadius)
                        .attr("fill", item.color);
                    currentItemDrawX += legendConfig.circleSize + legendConfig.padding;

                    // Icon Circle
                    const clipId = `clip-legend-${lineIndex}-${itemIndex}`;
                    defs.append("clipPath")
                        .attr("id", clipId)
                        .append("circle")
                        .attr("cx", circleRadius)
                        .attr("cy", circleRadius)
                        .attr("r", circleRadius - 0.5); // Slightly smaller to avoid border issues

                    const iconGroup = legendItemGroup.append("g")
                        .attr("class", "legend-icon-group")
                        .attr("transform", `translate(${currentItemDrawX}, ${lineCenterY - circleRadius})`);

                    iconGroup.append("circle")
                        .attr("class", "mark legend-icon-border")
                        .attr("cx", circleRadius)
                        .attr("cy", circleRadius)
                        .attr("r", circleRadius)
                        .attr("fill", "none")
                        .attr("stroke", fillStyle.legendIconBorderColor)
                        .attr("stroke-width", fillStyle.legendIconBorderWidth);

                    if (item.imageUrl) {
                        iconGroup.append("image")
                            .attr("class", "image legend-icon-image")
                            .attr("x", 0)
                            .attr("y", 0)
                            .attr("width", legendConfig.circleSize)
                            .attr("height", legendConfig.circleSize)
                            .attr("xlink:href", item.imageUrl)
                            .attr("clip-path", `url(#${clipId})`);
                    } else {
                        iconGroup.append("circle")
                            .attr("class", "mark legend-icon-placeholder")
                            .attr("cx", circleRadius)
                            .attr("cy", circleRadius)
                            .attr("r", circleRadius - 0.5) // Match clip path size
                            .attr("fill", fillStyle.legendIconFillNoImage);
                    }
                    currentItemDrawX += legendConfig.circleSize + legendConfig.padding;
                    
                    // Text Label
                    legendItemGroup.append("text")
                        .attr("class", "label legend-label")
                        .attr("x", currentItemDrawX)
                        .attr("y", lineCenterY)
                        .attr("dominant-baseline", "middle")
                        .style("font-family", legendConfig.fontFamily)
                        .style("font-size", `${legendConfig.fontSize}px`)
                        .style("font-weight", legendConfig.fontWeight)
                        .style("fill", legendConfig.textColor)
                        .text(item.text);
                    
                    if (itemIndex < line.items.length - 1) {
                         currentItemDrawX += estimateTextMetrics(item.text, legendConfig.fontFamily, legendConfig.fontSize + "px", legendConfig.fontWeight).width + legendConfig.interItemSpacing;
                    }
                });
                currentLineBaseY += legendConfig.itemMaxHeight + legendConfig.interLineVerticalPadding;
            });
        }
    }

    // Time Point Labels (at the top of the chart, below legend)
    const timeLabelGroup = mainChartGroup.append("g").attr("class", "time-labels");
    timePoints.forEach(timePoint => {
        const text = String(timePoint);
        const adaptedFontSize = getAdaptedFontSize(
            text,
            xScale.bandwidth(),
            parseFloat(fillStyle.typography.labelFontSize),
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontWeight
        );

        timeLabelGroup.append("text")
            .attr("class", "label time-label")
            .attr("x", xScale(timePoint) + xScale.bandwidth() / 2)
            .attr("y", -10) // Position above the main chart area
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", adaptedFontSize + "px")
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(text);
    });


    // Block 8: Main Data Visualization Rendering
    const dataElementsGroup = mainChartGroup.append("g").attr("class", "data-elements");

    groups.forEach(group => {
        const groupData = chartData
            .filter(d => d[groupFieldName] === group)
            .sort((a, b) => timePoints.indexOf(a[timeFieldName]) - timePoints.indexOf(b[timeFieldName]));

        // Lines
        if (groupData.length >= 2) {
            const lineGenerator = d3.line()
                .x(d => xScale(d[timeFieldName]) + xScale.bandwidth() / 2)
                .y(d => yScale(d[groupFieldName]) + yScale.bandwidth() / 2);

            dataElementsGroup.append("path")
                .datum(groupData)
                .attr("class", "mark line data-line")
                .attr("fill", "none")
                .attr("stroke", colorScale(group))
                .attr("stroke-width", fillStyle.defaultLineStrokeWidth)
                .attr("d", lineGenerator);
        }

        // Circles and Value Labels
        groupData.forEach(d => {
            const cx = xScale(d[timeFieldName]) + xScale.bandwidth() / 2;
            const cy = yScale(d[groupFieldName]) + yScale.bandwidth() / 2;
            const value = +d[valueFieldName];
            const circleColor = colorScale(group);

            const circleArea = areaScale(value);
            const circleRadius = Math.sqrt(circleArea / Math.PI);

            dataElementsGroup.append("circle")
                .attr("class", "mark circle data-point-circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", circleRadius)
                .attr("fill", circleColor)
                .attr("stroke", fillStyle.circleStrokeColor)
                .attr("stroke-width", fillStyle.circleStrokeWidth);

            const formattedValue = formatValue(value);
            const annotationInitialFontSize = parseFloat(fillStyle.typography.annotationFontSize);
            const annotationMaxWidth = xScale.bandwidth(); // Max width for label is within the band
            
            const annotationFontSize = getAdaptedFontSize(
                formattedValue,
                annotationMaxWidth, // Try to fit within circle diameter first, then band
                annotationInitialFontSize,
                fillStyle.typography.annotationFontFamily,
                fillStyle.typography.annotationFontWeight
            );

            const textMetrics = estimateTextMetrics(
                formattedValue,
                fillStyle.typography.annotationFontFamily,
                annotationFontSize + "px",
                fillStyle.typography.annotationFontWeight
            );
            
            const labelPadding = 4; // Padding for label inside circle
            if (circleRadius * 2 >= textMetrics.width + labelPadding && circleRadius * 2 >= textMetrics.height + labelPadding) {
                dataElementsGroup.append("text")
                    .attr("class", "label value-label value-label-inside")
                    .attr("x", cx)
                    .attr("y", cy)
                    .attr("dominant-baseline", "central")
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", annotationFontSize + "px")
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", isColorDarkEnough(circleColor) ? fillStyle.chartBackground : fillStyle.textColor)
                    .text(formattedValue);
            } else {
                const labelPaddingBelowCircle = 5;
                dataElementsGroup.append("text")
                    .attr("class", "label value-label value-label-outside")
                    .attr("x", cx)
                    .attr("y", cy + circleRadius + labelPaddingBelowCircle)
                    .attr("dominant-baseline", "hanging")
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", annotationFontSize + "px")
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formattedValue);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this refactoring pass beyond core chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}