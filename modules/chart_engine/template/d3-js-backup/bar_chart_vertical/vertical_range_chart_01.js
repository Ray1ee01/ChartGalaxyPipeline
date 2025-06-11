/* REQUIREMENTS_BEGIN
{
  "chart_type": "Range Chart",
  "chart_name": "vertical_range_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 12], [0, "inf"], [2,2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "minimal",
  "yAxis": "minimal",
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
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    // Clear the container
    d3.select(containerSelector).html("");

    // Critical field name extraction
    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    let missingFields = [];
    if (!xFieldConfig) missingFields.push("x role");
    if (!yFieldConfig) missingFields.push("y role");
    if (!groupFieldConfig) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: role(s) ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionField = xFieldConfig.name;
    const valueField = yFieldConfig.name;
    const groupField = groupFieldConfig.name;
    
    const dimensionUnit = xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    const valueUnit = yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";
    // const groupUnit = groupFieldConfig.unit !== "none" ? groupFieldConfig.unit : ""; // Not typically used for group labels

    if (chartDataArray.length === 0) {
        const errorMsg = "Chart data is empty. Cannot render.";
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const parsedTypography = data.typography || {};
    const parsedColors = data.colors || data.colors_dark || {}; // Prefer dark if available, then general
    const parsedImages = data.images || {}; // Parsed, but not used in this chart

    const fillStyle = {
        typography: {
            labelFontFamily: (parsedTypography.label && parsedTypography.label.font_family) ? parsedTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (parsedTypography.label && parsedTypography.label.font_size) ? parsedTypography.label.font_size : '12px',
            labelFontWeight: (parsedTypography.label && parsedTypography.label.font_weight) ? parsedTypography.label.font_weight : 'normal',
            annotationFontFamily: (parsedTypography.annotation && parsedTypography.annotation.font_family) ? parsedTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (parsedTypography.annotation && parsedTypography.annotation.font_size) ? parsedTypography.annotation.font_size : '10px',
            annotationFontWeight: (parsedTypography.annotation && parsedTypography.annotation.font_weight) ? parsedTypography.annotation.font_weight : 'normal',
        },
        textColor: parsedColors.text_color || '#FFFFFF', // Default to white for dark themes
        chartBackground: parsedColors.background_color || '#2A2A38', // Default dark background
        gridLineColor: parsedColors.other && parsedColors.other.grid_line ? parsedColors.other.grid_line : 'rgba(255, 255, 255, 0.15)',
        axisLabelColor: parsedColors.text_color || '#FFFFFF',
        dimensionLabelColor: parsedColors.text_color || '#FFFFFF',
        valueLabelColor: parsedColors.text_color || '#FFFFFF', // Text color for labels on colored backgrounds
        legendTextColor: parsedColors.text_color || '#FFFFFF',
        markerStrokeColor: parsedColors.other && parsedColors.other.marker_stroke ? parsedColors.other.marker_stroke : '#FFFFFF',
        connectorLineColor: parsedColors.other && parsedColors.other.connector_line ? parsedColors.other.connector_line : '#FFFFFF',
        defaultCategoricalColor: d3.scaleOrdinal(parsedColors.available_colors || d3.schemeCategory10)
    };
    
    fillStyle.getColor = (groupValue, index) => {
        if (parsedColors.field && parsedColors.field[groupField] && parsedColors.field[groupField][groupValue]) {
            return parsedColors.field[groupField][groupValue];
        }
        if (parsedColors.field && parsedColors.field[groupValue]) { // Direct mapping if groupField name is not used as a key
             return parsedColors.field[groupValue];
        }
        if (parsedColors.available_colors && parsedColors.available_colors.length > 0) {
            return parsedColors.available_colors[index % parsedColors.available_colors.length];
        }
        return fillStyle.defaultCategoricalColor(groupValue);
    };


    function estimateTextWidth(text, fontProps) {
        if (!text || text.length === 0) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family);
        tempText.setAttribute('font-size', fontProps.font_size);
        tempText.setAttribute('font-weight', fontProps.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // document.body.appendChild(tempSvg); // Temporarily append for reliable BBox
        let width = 0;
        try {
             // Forcing a layout calculation can sometimes help unattached elements
            tempSvg.setAttribute("width", "1");
            tempSvg.setAttribute("height", "1");
            tempSvg.style.setProperty("opacity", "0");
            tempSvg.style.setProperty("position", "absolute");
            document.body.appendChild(tempSvg); // Required for reliable getBBox
            width = tempText.getBBox().width;
            document.body.removeChild(tempSvg);
        } catch (e) {
            const fontSize = parseFloat(fontProps.font_size) || 12;
            width = text.length * fontSize * 0.6; // Basic fallback
            console.warn("SVG getBBox for text width estimation might be inaccurate or failed, used heuristic.", e);
        }
        // tempSvg.remove(); // Clean up if appended
        return width;
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 90,      // Increased for legend
        right: 50,    // For value labels if they extend
        bottom: 60,   // For dimension labels
        left: 50      // For Y-axis tick labels
    };

    // Calculate max Y-axis label width to adjust left margin
    const tempYScaleForLabels = d3.scaleLinear().domain([
        d3.min(chartDataArray, d => +d[valueField]),
        d3.max(chartDataArray, d => +d[valueField])
    ]).nice();
    let maxYAxisLabelWidth = 0;
    tempYScaleForLabels.ticks(10).forEach(tick => {
        const tickText = `${tick}${valueUnit}`;
        const width = estimateTextWidth(tickText, {
            font_family: fillStyle.typography.labelFontFamily,
            font_size: fillStyle.typography.labelFontSize,
            font_weight: fillStyle.typography.labelFontWeight
        });
        if (width > maxYAxisLabelWidth) {
            maxYAxisLabelWidth = width;
        }
    });
    chartMargins.left = Math.max(chartMargins.left, maxYAxisLabelWidth + 10);


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const dimensions = [...new Set(chartDataArray.map(d => d[dimensionField]))];
    const groups = [...new Set(chartDataArray.map(d => d[groupField]))];

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerWidth])
        .padding(0.3); // Fixed padding

    const minValue = d3.min(chartDataArray, d => +d[valueField]);
    const maxValue = d3.max(chartDataArray, d => +d[valueField]);
    
    const yScale = d3.scaleLinear()
        .domain([Math.min(minValue, 0) * 1.15, maxValue * 1.05 + (maxValue === minValue ? 5 : 0)]) // Ensure some room if max=min
        .range([innerHeight, 0])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => fillStyle.getColor(group, i)));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - 10})`); // Position above chart

    let legendCurrentX = 0;
    const legendItemPadding = 15;
    const legendSwatchRadius = 7;

    groups.forEach((group, i) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${legendCurrentX}, 0)`);

        itemGroup.append("circle")
            .attr("class", "mark legend-swatch")
            .attr("cx", legendSwatchRadius)
            .attr("cy", 0)
            .attr("r", legendSwatchRadius)
            .attr("fill", colorScale(group))
            .attr("stroke", fillStyle.markerStrokeColor)
            .attr("stroke-width", 1);

        const legendText = itemGroup.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendSwatchRadius * 2 + 5)
            .attr("y", 0)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.legendTextColor)
            .text(group);
        
        const itemWidth = legendSwatchRadius * 2 + 5 + legendText.node().getBBox().width + legendItemPadding;
        legendCurrentX += itemWidth;
    });
    // Center legend
    const legendWidth = legendCurrentX - legendItemPadding; // Remove last padding
    legendGroup.attr("transform", `translate(${(containerWidth - legendWidth) / 2}, ${chartMargins.top / 2 - 10})`);


    // Gridlines (Y-axis)
    const yTicks = yScale.ticks(10);
    mainChartGroup.selectAll(".grid-line")
        .data(yTicks)
        .enter()
        .append("line")
        .attr("class", "grid-line y-grid-line")
        .attr("x1", 0)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    // Y-axis Tick Labels
    mainChartGroup.selectAll(".y-axis-label")
        .data(yTicks)
        .enter()
        .append("text")
        .attr("class", "label axis-label y-axis-label")
        .attr("x", -10)
        .attr("y", d => yScale(d))
        .attr("text-anchor", "end")
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.axisLabelColor)
        .text(d => `${d}${valueUnit}`);

    // X-axis Dimension Labels (at the bottom)
    dimensions.forEach(dimension => {
        mainChartGroup.append("text")
            .attr("class", "label axis-label x-axis-label")
            .attr("x", xScale(dimension) + xScale.bandwidth() / 2)
            .attr("y", innerHeight + 25) // Position below chart
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.dimensionLabelColor)
            .text(`${dimension}${dimensionUnit}`);
    });

    // Block 8: Main Data Visualization Rendering
    const topmostTickY = yTicks.length > 0 ? yScale(yTicks[yTicks.length - 1]) : 0;

    dimensions.forEach(dimension => {
        const dimensionData = chartDataArray.filter(d => d[dimensionField] === dimension);
        
        if (dimensionData.length > 0) {
            const pointData = groups.map(group => {
                const dataPoint = dimensionData.find(d => d[groupField] === group);
                if (dataPoint) {
                    return {
                        group: group,
                        value: parseFloat(dataPoint[valueField]),
                        x: xScale(dimension) + xScale.bandwidth() / 2,
                        y: yScale(parseFloat(dataPoint[valueField]))
                    };
                }
                return null;
            }).filter(d => d !== null);

            // Connector Line
            if (pointData.length > 0) {
                const lowestValueData = pointData.reduce((lowest, current) => 
                    current.value < lowest.value ? current : lowest, pointData[0]);
                
                if (lowestValueData) {
                    mainChartGroup.append("rect") // Using rect for thickness control as in original
                        .attr("class", "mark connector-line")
                        .attr("x", lowestValueData.x - 1.5) // Centered thick line
                        .attr("y", topmostTickY)
                        .attr("width", 3)
                        .attr("height", Math.max(0, lowestValueData.y - topmostTickY))
                        .attr("fill", fillStyle.connectorLineColor);
                }
            }

            // Markers (Circles) and Value Labels
            pointData.forEach(point => {
                mainChartGroup.append("circle")
                    .attr("class", "mark data-point")
                    .attr("cx", point.x)
                    .attr("cy", point.y)
                    .attr("r", 7) // Slightly smaller than original for cleaner look
                    .attr("fill", colorScale(point.group))
                    .attr("stroke", fillStyle.markerStrokeColor)
                    .attr("stroke-width", 1.5);

                // Value Label
                const formattedValue = `${point.value.toFixed(1)}${valueUnit}`;
                const labelTextElement = mainChartGroup.append("text")
                    .attr("class", "label data-label")
                    .attr("x", point.x)
                    .attr("y", point.y - 20) // Position above marker
                    .attr("text-anchor", "middle")
                    .attr("dy", "0.35em")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.valueLabelColor) // White text on colored background
                    .text(formattedValue);

                // Value Label Background (optional, for readability)
                const textBBox = labelTextElement.node().getBBox();
                const labelPadding = { x: 6, y: 3 };
                mainChartGroup.insert("rect", "text.data-label") // Insert background behind text
                    .attr("class", "mark data-label-background")
                    .attr("x", textBBox.x - labelPadding.x)
                    .attr("y", textBBox.y - labelPadding.y)
                    .attr("width", textBBox.width + labelPadding.x * 2)
                    .attr("height", textBBox.height + labelPadding.y * 2)
                    .attr("rx", 4)
                    .attr("ry", 4)
                    .attr("fill", colorScale(point.group))
                    .attr("stroke", fillStyle.markerStrokeColor)
                    .attr("stroke-width", 0.5);
            });
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}