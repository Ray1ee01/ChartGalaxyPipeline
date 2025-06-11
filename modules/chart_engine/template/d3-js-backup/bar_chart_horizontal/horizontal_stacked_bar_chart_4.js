/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart with Squares",
  "chart_name": "horizontal_stacked_bar_chart_01",
  "is_composite": true,
  "required_fields": ["x", "y", "y2", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"],["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"], [2, 5]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // Could be data.colors_dark for a dark theme
    const rawImages = data.images || {}; // Not used in this chart, but parsed as per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;
    const totalField = dataColumns.find(col => col.role === "y2")?.name;

    const missingFields = [];
    if (!dimensionField) missingFields.push("x role field");
    if (!valueField) missingFields.push("y role field");
    if (!groupField) missingFields.push("group role field");
    if (!totalField) missingFields.push("y2 role field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMsg);
        return null;
    }

    const valueUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" :
                      dataColumns.find(col => col.role === "y")?.unit || "";
    const totalUnit = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" :
                      dataColumns.find(col => col.role === "y2")?.unit || "";
    
    const totalFieldDescription = dataColumns.find(col => col.role === "y2")?.label || totalField;


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) || '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
        },
        textColor: rawColors.text_color || '#0f223b',
        chartBackground: rawColors.background_color || '#FFFFFF',
        primaryColor: (rawColors.other && rawColors.other.primary) || '#1f77b4',
        defaultCategoryColor: '#CCCCCC', // Fallback for individual categories if all else fails
        groupColorMap: {}, // To be populated
        images: { // Processed image URLs, not directly used for elements in this chart
            field: rawImages.field || {},
            other: rawImages.other || {}
        }
    };

    const defaultAvailableColors = d3.schemeCategory10;
    const availableColors = rawColors.available_colors && rawColors.available_colors.length > 0 ? rawColors.available_colors : defaultAvailableColors;
    
    // Populate groupColorMap
    const tempGroupsForColorMapping = [...new Set(rawChartData.map(d => d[groupField]))].sort();
    tempGroupsForColorMapping.forEach((group, i) => {
        if (rawColors.field && rawColors.field[group]) {
            fillStyle.groupColorMap[group] = rawColors.field[group];
        } else {
            fillStyle.groupColorMap[group] = availableColors[i % availableColors.length];
        }
    });
    
    function getGroupColor(groupName) {
        return fillStyle.groupColorMap[groupName] || fillStyle.defaultCategoryColor;
    }

    function estimateTextWidth(text, styleOptions = {}) {
        const { fontFamily, fontSize, fontWeight } = styleOptions;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.width = '0px'; // Ensure it doesn't affect layout if accidentally appended
        tempSvg.style.height = '0px';

        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        if (fontFamily) tempText.style.fontFamily = fontFamily;
        if (fontSize) tempText.style.fontSize = fontSize;
        if (fontWeight) tempText.style.fontWeight = fontWeight;
        tempText.textContent = text;
        
        tempSvg.appendChild(tempText);
        // Appending to body temporarily to getBBox, then removing.
        // This is more reliable across browsers than a completely detached SVG.
        document.body.appendChild(tempSvg);
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        
        return width;
    }

    const formatValue = (value) => {
        if (value == null || isNaN(value)) return "N/A";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for billion
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value);
    };

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
    let maxLabelWidth = 0;
    const tempDimensionsForLabelCalc = [...new Set(rawChartData.map(d => d[dimensionField]))];
    tempDimensionsForLabelCalc.forEach(dim => {
        const textWidth = estimateTextWidth(dim, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        maxLabelWidth = Math.max(maxLabelWidth, textWidth);
    });

    const labelMargin = 10; // Space between label and bar start
    const chartMargins = {
        top: 60,    // Space for legend and square chart title
        right: 15,  // Right padding
        bottom: 40, // Bottom padding
        left: maxLabelWidth + labelMargin
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const barChartWidthRatio = 0.70; // Adjusted for potentially wider square area
    const squareChartWidthRatio = 0.30;
    const barChartWidth = innerWidth * barChartWidthRatio;
    const squareChartWidth = innerWidth * squareChartWidthRatio;
    
    // Block 5: Data Preprocessing & Transformation
    const chartData = rawChartData.filter(d => d[dimensionField] != null && d[valueField] != null && d[groupField] != null && d[totalField] != null);

    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))].sort(); // Sort groups for consistent legend and color

    const firstGroupValues = {};
    const dimensionSquareTotals = {};
    const primarySortGroup = groups[0];

    dimensions.forEach(dim => {
        const dimensionData = chartData.filter(d => d[dimensionField] === dim);
        const primaryGroupDataPoint = dimensionData.find(d => d[groupField] === primarySortGroup);
        firstGroupValues[dim] = primaryGroupDataPoint ? +primaryGroupDataPoint[valueField] : 0;

        const totalDataPoint = dimensionData.find(d => d[totalField] != null);
        dimensionSquareTotals[dim] = totalDataPoint ? +totalDataPoint[totalField] : 0;
    });

    const sortedDimensions = [...dimensions].sort((a, b) => firstGroupValues[b] - firstGroupValues[a]);

    const stackData = {};
    sortedDimensions.forEach(dim => {
        stackData[dim] = { items: {}, total: 0 };
        let accumulator = 0;
        groups.forEach(group => {
            const dataPoint = chartData.find(d => d[dimensionField] === dim && d[groupField] === group);
            const value = dataPoint && dataPoint[valueField] != null ? +dataPoint[valueField] : 0;
            stackData[dim].items[group] = { start: accumulator, end: accumulator + value, value: value };
            accumulator += value;
        });
        stackData[dim].total = accumulator;
    });

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2; // Fixed padding

    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        .domain([0, 100]) // Assumes values are percentages or normalized to 100.
        .range([0, barChartWidth]);

    const maxSquareValue = d3.max(Object.values(dimensionSquareTotals).filter(v => v > 0));
    const minSquareRadius = yScale.bandwidth() * 0.1;
    const maxSquareRadius = Math.min(yScale.bandwidth() * 0.8, squareChartWidth * 0.4); // Max side length

    const squareSideScale = d3.scaleSqrt()
        .domain([0, maxSquareValue > 0 ? maxSquareValue : 1]) // Avoid domain [0,0]
        .range([minSquareRadius, maxSquareRadius]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Right-side Square Chart Title (Total Field Description)
    if (totalFieldDescription) {
        const titleX = containerWidth - chartMargins.right;
        const titleY = chartMargins.top - 35; // Position above legend
        svgRoot.append("text")
            .attr("class", "label chart-subtitle") // Using 'label' as per spec, 'chart-subtitle' for context
            .attr("x", titleX)
            .attr("y", titleY)
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(totalFieldDescription);
    }
    
    // Legend
    let legendSquareSize = 12;
    let legendSpacing = 5;
    let legendFontSize = parseInt(fillStyle.typography.labelFontSize, 10);

    const calculateLegendItemWidths = (fontSize, squareSize) => {
        return groups.map(group => {
            const textWidth = estimateTextWidth(group, {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: `${fontSize}px`,
                fontWeight: fillStyle.typography.labelFontWeight
            });
            return squareSize + legendSpacing + textWidth;
        });
    };

    let legendItemWidths = calculateLegendItemWidths(legendFontSize, legendSquareSize);
    const legendAreaWidth = barChartWidth; // Legend above bar chart area
    const minItemSpacing = 10;
    
    let totalLegendItemsWidth = d3.sum(legendItemWidths);
    let requiredLegendWidth = totalLegendItemsWidth + Math.max(0, groups.length - 1) * minItemSpacing;

    if (requiredLegendWidth > legendAreaWidth && groups.length > 0) {
        const scaleFactor = Math.max(0.7, legendAreaWidth / requiredLegendWidth); // Min scale 70%
        legendFontSize = Math.max(8, Math.floor(legendFontSize * scaleFactor));
        legendSquareSize = Math.max(6, Math.floor(legendSquareSize * scaleFactor));
        legendItemWidths = calculateLegendItemWidths(legendFontSize, legendSquareSize);
        totalLegendItemsWidth = d3.sum(legendItemWidths);
    }
    
    const actualItemSpacing = groups.length > 1 ? (legendAreaWidth - totalLegendItemsWidth) / (groups.length - 1) : 0;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top - 15})`); // Position legend

    let currentX = 0;
    groups.forEach((group, i) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, 0)`);

        itemGroup.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendSquareSize)
            .attr("height", legendSquareSize)
            .attr("fill", getGroupColor(group));

        itemGroup.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendSquareSize + legendSpacing)
            .attr("y", legendSquareSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${legendFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);
        
        currentX += legendItemWidths[i] + (i < groups.length - 1 ? actualItemSpacing : 0);
    });


    // Block 8: Main Data Visualization Rendering
    sortedDimensions.forEach((dimension) => {
        const barHeight = yScale.bandwidth();
        const yPos = yScale(dimension);
        const centerY = yPos + barHeight / 2;

        // Dimension Label (Y-axis like)
        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", -labelMargin)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(dimension);

        // Stacked Bars
        const barSegments = [];
        groups.forEach((group, groupIndex) => {
            const stackItem = stackData[dimension].items[group];
            if (!stackItem || stackItem.value <= 0) return;

            const segmentWidth = xScale(stackItem.value) - xScale(0); // Ensure width is positive
            const segmentX = xScale(stackItem.start);

            mainChartGroup.append("rect")
                .attr("class", "mark bar-segment")
                .attr("x", segmentX)
                .attr("y", yPos)
                .attr("width", segmentWidth)
                .attr("height", barHeight)
                .attr("fill", getGroupColor(group));
            
            barSegments.push({ x: segmentX, width: segmentWidth, y: yPos, height: barHeight });

            // Bar Value Label
            const formattedVal = `${formatValue(stackItem.value)}${valueUnit}`;
            const annotationBaseFontSize = parseFloat(fillStyle.typography.annotationFontSize);
            const dynamicFontSize = Math.min(16, Math.max(barHeight * 0.5, annotationBaseFontSize)); // Adjusted dynamic font size
            
            const labelTextWidth = estimateTextWidth(formattedVal, {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: `${dynamicFontSize}px`,
                fontWeight: fillStyle.typography.annotationFontWeight
            });

            const labelPadding = 5;
            if (segmentWidth > labelTextWidth + labelPadding * 2) { // Place inside if enough space
                mainChartGroup.append("text")
                    .attr("class", "label value data-label inside")
                    .attr("x", segmentX + segmentWidth / 2) // Centered in segment
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${dynamicFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", "#FFFFFF") // White for contrast
                    .text(formattedVal);
            } else if (groupIndex === groups.length - 1 && barChartWidth - (segmentX + segmentWidth) > labelTextWidth + labelPadding) {
                 // Place outside (right) if last segment and space available in bar chart area
                mainChartGroup.append("text")
                    .attr("class", "label value data-label outside")
                    .attr("x", segmentX + segmentWidth + labelPadding)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${dynamicFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formattedVal);
            }
        });
        
        // White separator lines
        for (let i = 1; i < barSegments.length; i++) {
            const prevSegment = barSegments[i-1];
            const currentSegment = barSegments[i];
             // Draw line at the start of the current segment if it's not the very first segment overall
            if (currentSegment.x > 0) {
                 mainChartGroup.append("line")
                    .attr("class", "other separator-line")
                    .attr("x1", currentSegment.x)
                    .attr("y1", currentSegment.y)
                    .attr("x2", currentSegment.x)
                    .attr("y2", currentSegment.y + currentSegment.height)
                    .attr("stroke", "#FFFFFF")
                    .attr("stroke-width", 1.5); // Slightly thicker for better visibility
            }
        }


        // Squares (Total Value)
        const squareVal = dimensionSquareTotals[dimension];
        if (squareVal != null && squareVal > 0) {
            const sideLength = squareSideScale(squareVal);
            const squareX = barChartWidth + (squareChartWidth - sideLength) / 2; // Centered in square area
            
            mainChartGroup.append("rect")
                .attr("class", "mark total-square")
                .attr("x", squareX)
                .attr("y", centerY - sideLength / 2)
                .attr("width", sideLength)
                .attr("height", sideLength)
                .attr("fill", fillStyle.primaryColor)
                .style("stroke", "#FFFFFF") // White border for definition
                .style("stroke-width", 1);

            // Square Value Label
            const formattedTotal = `${formatValue(squareVal)}${totalUnit}`;
            const annotationBaseFontSize = parseFloat(fillStyle.typography.annotationFontSize);
            const dynamicFontSize = Math.min(16, Math.max(sideLength * 0.4, annotationBaseFontSize));

            const totalLabelTextWidth = estimateTextWidth(formattedTotal, {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: `${dynamicFontSize}px`,
                fontWeight: fillStyle.typography.annotationFontWeight
            });
            
            const labelPadding = 2;
            if (sideLength > totalLabelTextWidth + labelPadding * 2 && sideLength > dynamicFontSize + labelPadding * 2) { // Place inside if enough space
                mainChartGroup.append("text")
                    .attr("class", "label value data-label inside")
                    .attr("x", squareX + sideLength / 2)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${dynamicFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", "#FFFFFF")
                    .text(formattedTotal);
            } else { // Place above if not enough space
                mainChartGroup.append("text")
                    .attr("class", "label value data-label above")
                    .attr("x", squareX + sideLength / 2)
                    .attr("y", centerY - sideLength / 2 - 5) // 5px above square
                    .attr("dy", "0em") // Align top of text
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize) // Use base annotation size if outside
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formattedTotal);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactoring beyond what's in Block 8)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}