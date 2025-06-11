/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Sorted Lines Chart",
  "chart_name": "bump_chart_13",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 12], [0, "inf"], [4, 10]],
  "required_fields_icons": [],
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
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END
*/
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const config = data; 
    const chartDataArray = config.data.data;
    const variables = config.variables || {};
    const typographyConfig = config.typography || {};
    const colorsConfig = config.colors || {};
    // const imagesConfig = config.images || {}; // Not used in this chart, define if needed.
    const dataColumns = config.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const timeFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const groupFieldName = dataColumns.find(col => col.role === "group")?.name;

    const criticalFields = { timeFieldName, valueFieldName, groupFieldName };
    const missingFields = Object.entries(criticalFields)
        .filter(([_, value]) => !value)
        .map(([key, _]) => key.replace("Name","")); // Make error message more user-friendly

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart configuration missing for role(s): ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px; text-align:center;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        colors: {
            textColor: colorsConfig.text_color || '#333333',
            getGroupColor: (groupName, index) => {
                if (colorsConfig.field && colorsConfig.field[groupName]) {
                    return colorsConfig.field[groupName];
                }
                if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                    return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
                }
                return d3.schemeCategory10[index % 10]; // Default categorical colors
            }
        },
        typography: {
            legend: {
                fontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
                fontSize: (typographyConfig.label && typographyConfig.label.font_size) || '11px',
                fontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            },
            timeAxisLabel: {
                fontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
                fontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
                fontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            },
            valueAnnotation: {
                fontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
                fontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '12px',
                fontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'bold',
            }
        }
    };

    let _memoizedTextWidth = {}; // For performance, cache text widths within a single chart render
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const key = `${text}-${fontFamily}-${fontSize}-${fontWeight}`;
        if (_memoizedTextWidth[key]) {
            return _memoizedTextWidth[key];
        }

        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const textElement = document.createElementNS(svgNS, 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // Note: No DOM append/remove for the temporary SVG
        const width = textElement.getBBox().width;
        _memoizedTextWidth[key] = width;
        return width;
    }
    
    function getAdaptedFontSize(text, maxWidth, initialFontSizeStr, fontFamily, fontWeight) {
        let fontSize = parseFloat(initialFontSizeStr);
        if (isNaN(fontSize) || fontSize <= 1) fontSize = 12; // Sensible default if parsing fails or too small

        // Max 100 iterations to prevent infinite loops with bad inputs
        for (let i=0; i < 100 && fontSize > 1; i++) { 
            const currentWidth = estimateTextWidth(text, fontFamily, `${fontSize}px`, fontWeight);
            if (currentWidth <= maxWidth) {
                break;
            }
            fontSize -= 1;
        }
        return `${Math.max(fontSize, 1)}px`; // Ensure font size is at least 1px
    }

    function hexagonPath(cx, cy, r) {
        const angles = d3.range(6).map(i => (i * Math.PI / 3) + (Math.PI / 6)); // Rotated for flat top/bottom
        const points = angles.map(angle => [
            cx + r * Math.sin(angle),
            cy - r * Math.cos(angle) 
        ]);
        return d3.line()(points) + "Z"; // Close path
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format(".1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format(".1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format(".0f")(value / 1000) + "K";
        return d3.format(".0f")(value);
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root") // Standardized class
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 120, right: 50, bottom: 50, left: 50 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group"); // Standardized class

    // Block 5: Data Preprocessing & Transformation
    const timePoints = [...new Set(chartDataArray.map(d => d[timeFieldName]))].sort((a,b) => d3.ascending(a,b)); // Ensure chronological sort
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    let allDataPresent = true;
    for (const group of groups) {
        for (const timePoint of timePoints) {
            if (!chartDataArray.some(d => d[groupFieldName] === group && d[timeFieldName] === timePoint)) {
                allDataPresent = false; break;
            }
        }
        if (!allDataPresent) break;
    }

    if (!allDataPresent) {
        const errorMessage = "Data incomplete: Each group must have data for all time points. Chart cannot be rendered.";
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px; text-align:center;'>${errorMessage}</div>`);
        return null;
    }

    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(timePoints)
        .range([0, innerWidth])
        .padding(0.1);

    const yScale = d3.scaleBand()
        .domain(groups) // Order of groups in yScale will be their natural occurrence order
        .range([0, innerHeight])
        .padding(0.2);

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => fillStyle.colors.getGroupColor(group, i)));
    
    const minCircleRadius = 2;
    const maxRadiusForBandwidth = Math.min(xScale.bandwidth() / 2 * 0.9, yScale.bandwidth() / 2 * 0.9); // 0.9 for padding
    
    const areaScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue : 1]) // Avoid [0,0] domain
        .range([Math.PI * Math.pow(minCircleRadius, 2), Math.PI * Math.pow(maxRadiusForBandwidth, 2)])
        .clamp(true);

    // Block 7: Chart Component Rendering (Legend, Time Point Labels)
    // Legend
    if (groups && groups.length > 0) {
        const legendHexSize = 12;
        const legendPadding = 6; // Space between hex and text
        const legendInterItemSpacing = 12; // Horizontal space between items
        const legendItemMaxHeight = Math.max(legendHexSize, parseFloat(fillStyle.typography.legend.fontSize));
        const legendInterLineVerticalPadding = 6;
        const legendMinSvgTopPadding = 15; // From SVG top to legend block

        const legendItemsData = groups.map((group) => ({
            text: String(group),
            color: colorScale(group),
            visualWidth: legendHexSize + legendPadding + estimateTextWidth(
                String(group),
                fillStyle.typography.legend.fontFamily,
                fillStyle.typography.legend.fontSize,
                fillStyle.typography.legend.fontWeight
            )
        }));

        const legendLines = [];
        let currentLineItems = [];
        let currentLineVisualWidth = 0;

        legendItemsData.forEach(item => {
            let widthIfAdded = item.visualWidth + (currentLineItems.length > 0 ? legendInterItemSpacing : 0);
            if (currentLineItems.length > 0 && (currentLineVisualWidth + widthIfAdded) > innerWidth) {
                legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
                currentLineItems = [item];
                currentLineVisualWidth = item.visualWidth;
            } else {
                currentLineVisualWidth += widthIfAdded - (currentLineItems.length > 0 ? 0 : item.visualWidth); // Add spacing only if not first
                currentLineItems.push(item);
                if(currentLineItems.length === 1) currentLineVisualWidth = item.visualWidth; // Set initial width for new line
            }
        });
        if (currentLineItems.length > 0) {
            legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
        }

        if (legendLines.length > 0) {
            const legendContainerGroup = mainChartGroup.append("g")
                .attr("class", "legend chart-legend"); // Standardized class
            let currentLineBaseY = -chartMargins.top + legendMinSvgTopPadding;

            legendLines.forEach((line) => {
                const lineRenderStartX = (innerWidth - line.totalVisualWidth) / 2; // Center line
                const lineCenterY = currentLineBaseY + legendItemMaxHeight / 2;
                let currentItemDrawX = lineRenderStartX;

                line.items.forEach((item, itemIndex) => {
                    const hexRadius = legendHexSize / 2;
                    legendContainerGroup.append("path")
                        .attr("d", hexagonPath(currentItemDrawX + hexRadius, lineCenterY, hexRadius))
                        .attr("fill", item.color)
                        .attr("class", "mark legend-mark"); // Standardized class

                    legendContainerGroup.append("text")
                        .attr("x", currentItemDrawX + legendHexSize + legendPadding)
                        .attr("y", lineCenterY)
                        .attr("dominant-baseline", "middle")
                        .style("font-family", fillStyle.typography.legend.fontFamily)
                        .style("font-size", fillStyle.typography.legend.fontSize)
                        .style("font-weight", fillStyle.typography.legend.fontWeight)
                        .style("fill", fillStyle.colors.textColor)
                        .attr("class", "label legend-label") // Standardized class
                        .text(item.text);
                    
                    currentItemDrawX += item.visualWidth + (itemIndex < line.items.length - 1 ? legendInterItemSpacing : 0);
                });
                currentLineBaseY += legendItemMaxHeight + legendInterLineVerticalPadding;
            });
        }
    }

    // Time Point Labels (Top "Axis")
    const timeLabelsGroup = mainChartGroup.append("g").attr("class", "axis time-axis-labels"); // Standardized class
    timePoints.forEach(timePoint => {
        const adaptedTimeLabelFontSize = getAdaptedFontSize(
            String(timePoint),
            xScale.bandwidth(),
            fillStyle.typography.timeAxisLabel.fontSize,
            fillStyle.typography.timeAxisLabel.fontFamily,
            fillStyle.typography.timeAxisLabel.fontWeight
        );

        timeLabelsGroup.append("text")
            .attr("x", xScale(timePoint) + xScale.bandwidth() / 2)
            .attr("y", -10) // Position above chart area
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.timeAxisLabel.fontFamily)
            .style("font-size", adaptedTimeLabelFontSize)
            .style("font-weight", fillStyle.typography.timeAxisLabel.fontWeight)
            .style("fill", fillStyle.colors.textColor)
            .attr("class", "label time-label") // Standardized class
            .text(timePoint);
    });

    // Block 8: Main Data Visualization Rendering
    const dataElementsGroup = mainChartGroup.append("g").attr("class", "data-elements"); // Standardized class

    groups.forEach(group => {
        const groupData = chartDataArray
            .filter(d => d[groupFieldName] === group)
            .sort((a, b) => timePoints.indexOf(a[timeFieldName]) - timePoints.indexOf(b[timeFieldName]));

        if (groupData.length >= 2) { // Lines
            const lineGenerator = d3.line()
                .x(d => xScale(d[timeFieldName]) + xScale.bandwidth() / 2)
                .y(d => yScale(d[groupFieldName]) + yScale.bandwidth() / 2);
            dataElementsGroup.append("path")
                .datum(groupData)
                .attr("fill", "none")
                .attr("stroke", colorScale(group))
                .attr("stroke-width", 2)
                .attr("d", lineGenerator)
                .attr("class", "mark line series-line"); // Standardized class
        }

        groupData.forEach(d => { // Hexagons and Value Labels
            const cx = xScale(d[timeFieldName]) + xScale.bandwidth() / 2;
            const cy = yScale(d[groupFieldName]) + yScale.bandwidth() / 2;
            const value = +d[valueFieldName];
            const circleRadius = Math.sqrt(areaScale(value) / Math.PI);

            dataElementsGroup.append("path")
                .attr("d", hexagonPath(cx, cy, circleRadius))
                .attr("fill", colorScale(group))
                .attr("class", "mark hexagon data-point-mark"); // Standardized class

            const formattedValue = formatValue(value);
            const adaptedAnnotationFontSize = getAdaptedFontSize(
                formattedValue,
                xScale.bandwidth(), // Max width for label is the band width
                fillStyle.typography.valueAnnotation.fontSize,
                fillStyle.typography.valueAnnotation.fontFamily,
                fillStyle.typography.valueAnnotation.fontWeight
            );
            
            dataElementsGroup.append("text")
                .attr("x", cx)
                .attr("y", cy + circleRadius + 5) // 5px padding below hexagon
                .attr("dominant-baseline", "hanging")
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.valueAnnotation.fontFamily)
                .style("font-size", adaptedAnnotationFontSize)
                .style("font-weight", fillStyle.typography.valueAnnotation.fontWeight)
                .style("fill", fillStyle.colors.textColor)
                .attr("class", "label value-label data-value") // Standardized class
                .text(formattedValue);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // None for this chart based on requirements.

    // Block 10: Cleanup & SVG Node Return
    _memoizedTextWidth = {}; // Clear cache for next potential call
    return svgRoot.node();
}