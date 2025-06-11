/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 10]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal stacked bar chart.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const config = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const yFieldName = (dataColumns.find(col => col.role === "y") || {}).name;
    const groupFieldName = (dataColumns.find(col => col.role === "group") || {}).name;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push("x field");
        if (!yFieldName) missingFields.push("y field");
        if (!groupFieldName) missingFields.push("group field");
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')} name(s) are undefined. Roles 'x', 'y', 'group' must be defined in data.columns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("padding", "10px")
                .html(errorMessage.replace(/\. /g, ".<br>"));
        }
        return null;
    }
    
    const yFieldUnit = (dataColumns.find(col => col.role === "y" && col.unit && col.unit !== "none") || {}).unit || "";


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) || '16px',
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) || 'bold',
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        dataLabelColor: '#FFFFFF', // Default for labels inside bars
        legendTextColor: colorsConfig.text_color || '#333333',
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextNode.setAttribute('style', `font-family: ${fontFamily}; font-size: ${fontSize}; font-weight: ${fontWeight}; white-space: pre;`);
        tempTextNode.textContent = text;
        tempSvg.appendChild(tempTextNode);
        // Note: Appending to body and then getting BBox is more reliable for complex fonts/kerning,
        // but for simplicity and strict adherence to "MUST NOT be appended to the document DOM",
        // we use it without appending. This might be less accurate for some cases.
        // For a more robust solution if issues arise:
        // document.body.appendChild(tempSvg);
        const width = tempTextNode.getBBox().width;
        // document.body.removeChild(tempSvg);
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: config.margin_top || 70, // Increased top margin for legend
        right: config.margin_right || 30,
        bottom: config.margin_bottom || 30,
        left: config.margin_left || 200 // Default left margin for y-axis labels and icons
    };
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const uniqueGroupValues = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort(); // Sort for consistent legend order

    const processedData = Array.from(d3.group(chartDataArray, d => d[xFieldName]), ([key, values]) => {
        const obj = { [xFieldName]: key };
        uniqueGroupValues.forEach(group => {
            obj[group] = d3.sum(values.filter(d => d[groupFieldName] === group), d => +d[yFieldName]);
        });
        obj.total = d3.sum(values, d => +d[yFieldName]);
        return obj;
    });
    
    // Sort processedData by xFieldName if it's sortable (e.g. dates, numbers)
    // For now, assume categorical order as given or pre-sorted if needed.

    const stackGenerator = d3.stack()
        .keys(uniqueGroupValues)
        .order(d3.stackOrderNone) // Keep original group order
        .offset(d3.stackOffsetNone);

    const stackedData = stackGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d[xFieldName]))
        .range([innerHeight, 0])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) || 1]) // Ensure domain is at least [0,1]
        .range([0, innerWidth])
        .nice();

    let groupColorsMap = {};
    if (colorsConfig.field) {
        uniqueGroupValues.forEach(group => {
            if (colorsConfig.field[group]) {
                groupColorsMap[group] = colorsConfig.field[group];
            }
        });
    }
    const defaultColorPalette = colorsConfig.available_colors || d3.schemeCategory10;
    let colorIdx = 0;
    uniqueGroupValues.forEach(group => {
        if (!groupColorsMap[group]) {
            groupColorsMap[group] = defaultColorPalette[colorIdx % defaultColorPalette.length];
            colorIdx++;
        }
    });

    const colorScale = d3.scaleOrdinal()
        .domain(uniqueGroupValues)
        .range(uniqueGroupValues.map(group => groupColorsMap[group]));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10))
        .call(g => g.select(".domain").remove())
        .selectAll("text").remove(); // As per original, X-axis labels are removed

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickSize(0).tickPadding(10))
        .call(g => g.select(".domain").remove());

    yAxisGroup.selectAll("text")
        .attr("class", "label y-axis-label")
        .style("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    const iconSize = yScale.bandwidth() * 0.7;
    const iconPadding = 10;

    yAxisGroup.selectAll(".tick").each(function(d) {
        const tick = d3.select(this);
        const iconUrl = imagesConfig.field && imagesConfig.field[d] ? imagesConfig.field[d] : null;
        
        if (iconUrl) {
            tick.append("image")
                .attr("class", "icon y-axis-icon")
                .attr("x", -iconSize - iconPadding - (parseFloat(fillStyle.typography.labelFontSize) * 0.1)) // Adjust based on original logic
                .attr("y", -iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", iconUrl);
            
            tick.select("text.y-axis-label")
                .attr("dx", -iconSize - (2 * iconPadding));
        }
    });
    
    // Legend Rendering
    if (uniqueGroupValues && uniqueGroupValues.length > 0) {
        const legendMarkerSize = 12;
        const legendPadding = 6;
        const legendInterItemSpacing = 12;
        const legendLineHeight = Math.max(legendMarkerSize, parseFloat(fillStyle.typography.labelFontSize));
        const legendInterLineSpacing = 6;

        const legendItemsData = uniqueGroupValues.map(group => {
            const text = String(group);
            const color = colorScale(group);
            const textWidth = estimateTextWidth(text, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            const visualWidth = legendMarkerSize + legendPadding + textWidth;
            return { text, color, visualWidth };
        });

        const legendLines = [];
        let currentLineItems = [];
        let currentLineVisualWidth = 0;
        const availableWidthForLegend = innerWidth;

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
            const totalLegendBlockHeight = legendLines.length * legendLineHeight + Math.max(0, legendLines.length - 1) * legendInterLineSpacing;
            let legendBlockStartY = -chartMargins.top + 15; // Position above chart area

            const legendContainerGroup = svgRoot.append("g")
                .attr("class", "legend-container")
                .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);


            if (groupFieldName && (config.show_legend_title === undefined || config.show_legend_title === true)) {
                 legendContainerGroup.append("text")
                    .attr("class", "text legend-title")
                    .attr("x", availableWidthForLegend / 2)
                    .attr("y", legendBlockStartY - 10) // Position above legend items
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.titleFontFamily)
                    .style("font-size", fillStyle.typography.titleFontSize)
                    .style("font-weight", fillStyle.typography.titleFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(groupFieldName);
                legendBlockStartY += parseFloat(fillStyle.typography.titleFontSize) + 10; // Adjust startY for items
            }


            let currentLineBaseY = legendBlockStartY;
            legendLines.forEach((line) => {
                const lineRenderStartX = (availableWidthForLegend - line.totalVisualWidth) / 2; // Center line
                let currentItemDrawX = lineRenderStartX;

                line.items.forEach((item) => {
                    const legendItemGroup = legendContainerGroup.append("g").attr("class", "legend-item");
                    
                    legendItemGroup.append("rect")
                        .attr("class", "mark legend-marker")
                        .attr("x", currentItemDrawX)
                        .attr("y", currentLineBaseY + (legendLineHeight - legendMarkerSize) / 2)
                        .attr("width", legendMarkerSize)
                        .attr("height", legendMarkerSize)
                        .attr("rx", 3)
                        .attr("ry", 3)
                        .style("fill", item.color);

                    legendItemGroup.append("text")
                        .attr("class", "label legend-label")
                        .attr("x", currentItemDrawX + legendMarkerSize + legendPadding)
                        .attr("y", currentLineBaseY + legendLineHeight / 2)
                        .attr("dominant-baseline", "middle")
                        .style("font-family", fillStyle.typography.labelFontFamily)
                        .style("font-size", fillStyle.typography.labelFontSize)
                        .style("font-weight", fillStyle.typography.labelFontWeight)
                        .style("fill", fillStyle.legendTextColor)
                        .text(item.text);
                    
                    currentItemDrawX += item.visualWidth + legendInterItemSpacing;
                });
                currentLineBaseY += legendLineHeight + legendInterLineSpacing;
            });
        }
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barLayers = mainChartGroup.selectAll("g.bar-layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `bar-layer group-${d.key.toString().replace(/\s+/g, '-').toLowerCase()}`)
        .style("fill", d => colorScale(d.key));

    barLayers.selectAll("rect.mark.bar")
        .data(d => d.map(item => ({ ...item, key: d.key }))) // Add key to inner data for access
        .enter().append("rect")
        .attr("class", "mark bar")
        .attr("y", d => yScale(d.data[xFieldName]))
        .attr("x", d => xScale(d[0]))
        .attr("width", d => {
            const w = xScale(d[1]) - xScale(d[0]);
            return Math.max(0, w); // Ensure non-negative width
        })
        .attr("height", yScale.bandwidth());

    // Data Labels
    barLayers.selectAll("text.label.data-label")
        .data(d => d.map(item => ({ ...item, key: d.key })))
        .enter().append("text")
        .attr("class", "label data-label")
        .attr("y", d => yScale(d.data[xFieldName]) + yScale.bandwidth() / 2)
        .attr("x", d => {
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            return xScale(d[0]) + segmentWidth / 2;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", fillStyle.dataLabelColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => {
            const value = d[1] - d[0];
            if (value <= 0) return ''; // Don't show label for zero or negative segments
            
            const segmentWidth = xScale(d[1]) - xScale(d[0]);
            const formattedText = `${formatValue(value)}${yFieldUnit}`;
            const textWidth = estimateTextWidth(formattedText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
            
            return (segmentWidth > textWidth + 6) ? formattedText : ''; // Add some padding
        });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactoring beyond what's in other blocks)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}