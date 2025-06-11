/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_chart_01",
  "is_composite": true,
  "required_fields": ["x", "y", "y2", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"], [2, 5]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
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
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal stacked bar chart combined with proportional circles on the right.
    // It expects data with dimensions, values for stacking, group categories, and total values for circles.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Could be data.colors_dark if a theme mechanism was in place
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;
    const totalField = dataColumns.find(col => col.role === "y2")?.name;

    const criticalFields = { dimensionField, valueField, groupField, totalField };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: Roles for ${missingFields.join(', ')} not found in data.columns. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

    const valueUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y")?.unit || "");
    const totalUnit = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y2")?.unit || "");
    const totalFieldDescription = dataColumns.find(col => col.role === "y2")?.description || totalField;


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyInput.title?.font_family || "Arial, sans-serif",
            titleFontSize: typographyInput.title?.font_size || "24px",
            titleFontWeight: typographyInput.title?.font_weight || "700",
            labelFontFamily: typographyInput.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyInput.label?.font_size || "14px",
            labelFontWeight: typographyInput.label?.font_weight || "500",
            annotationFontFamily: typographyInput.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyInput.annotation?.font_size || "12px",
            annotationFontWeight: typographyInput.annotation?.font_weight || "400",
        },
        textColor: colorsInput.text_color || "#000000",
        chartBackground: colorsInput.background_color || "#FFFFFF",
        primaryColor: colorsInput.other?.primary || "#1E88E5",
        fieldColors: colorsInput.field || {},
        availableColors: colorsInput.available_colors || d3.schemeCategory10,
    };
    
    const images = {
        field: imagesInput.field || {},
        other: imagesInput.other || {}
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.position = 'absolute';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Appending to body to ensure getBBox works, then removing immediately.
        // This is a common workaround if not appending to the actual chart SVG.
        // For a truly in-memory solution without DOM append, canvas measureText or more complex SVG handling is needed.
        // Given the constraints, this is a pragmatic approach if direct in-memory SVG fails in some environments.
        // However, the prompt explicitly says "MUST NOT be appended to the document DOM".
        // So, we rely on getBBox working on an unattached element, which it generally does for modern browsers.
        // If issues arise, one might need to briefly attach it to a hidden part of the DOM.
        // For now, let's assume it works without appending to body.
        // document.body.appendChild(tempSvg); // Avoid this if possible
        const width = tempText.getBBox().width;
        // tempSvg.remove(); // if appended
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.1f")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    const getGroupColor = (group, index) => {
        if (fillStyle.fieldColors[group]) {
            return fillStyle.fieldColors[group];
        }
        return fillStyle.availableColors[index % fillStyle.availableColors.length];
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 15, bottom: 40, left: 60 };
    if (totalFieldDescription) chartMargins.top = Math.max(chartMargins.top, parseFloat(fillStyle.typography.labelFontSize) + 35);


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const barChartWidthRatio = 0.75;
    const circleChartWidthRatio = 1 - barChartWidthRatio;
    const barChartWidth = innerWidth * barChartWidthRatio;
    const circleChartWidth = innerWidth * circleChartWidthRatio;

    // Block 5: Data Preprocessing & Transformation
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))].sort(); // Sort groups for consistent color and legend

    const firstGroupValues = {};
    const dimensionCircleTotals = {};
    const primaryGroup = groups[0];

    dimensions.forEach(dim => {
        const dimensionData = chartData.filter(d => d[dimensionField] === dim);
        const primaryGroupData = dimensionData.find(d => d[groupField] === primaryGroup);
        firstGroupValues[dim] = primaryGroupData && primaryGroupData[valueField] !== undefined ? +primaryGroupData[valueField] : 0;
        
        const totalValueData = dimensionData.find(d => d[totalField] !== undefined);
        dimensionCircleTotals[dim] = totalValueData ? +totalValueData[totalField] : 0;
    });

    const sortedDimensions = [...dimensions].sort((a, b) => firstGroupValues[b] - firstGroupValues[a]);

    const stackData = {};
    sortedDimensions.forEach(dim => {
        stackData[dim] = { items: [], total: 0 };
        let accumulator = 0;
        groups.forEach(group => {
            const dataPoint = chartData.find(d => d[dimensionField] === dim && d[groupField] === group);
            const value = dataPoint && dataPoint[valueField] !== undefined ? +dataPoint[valueField] : 0;
            stackData[dim].items.push({
                group: group,
                start: accumulator,
                end: accumulator + value,
                value: value
            });
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

    const maxStackedValue = d3.max(Object.values(stackData), d => d.total) || 100; // Ensure maxStackedValue is at least 100 if all totals are 0
    const xScale = d3.scaleLinear()
        .domain([0, maxStackedValue > 0 ? maxStackedValue : 100]) // Use actual max sum or 100 if sum is 0
        .range([0, barChartWidth]);

    const maxCircleValue = d3.max(Object.values(dimensionCircleTotals)) || 0;
    const minRadius = yScale.bandwidth() * 0.1;
    const maxRadius = Math.min(yScale.bandwidth() * 0.8, circleChartWidth * 0.4); // Adjusted maxRadius

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxCircleValue > 0 ? maxCircleValue : 1]) // Ensure domain is not [0,0]
        .range([minRadius, maxRadius]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Render column header for circles (totalFieldDescription)
    if (totalFieldDescription) {
        const titleX = chartMargins.left + barChartWidth + circleChartWidth / 2;
        const titleY = chartMargins.top - 20;
        svgRoot.append("text")
            .attr("x", titleX)
            .attr("y", titleY)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "label column-header")
            .text(totalFieldDescription);
    }
    
    // Render Legend
    if (groups.length > 0) {
        let legendSquareSize = 12;
        let legendSpacing = 5;
        let legendItemHorzPadding = 8;
        let legendFontSize = parseFloat(fillStyle.typography.labelFontSize);

        const calculateLegendItemWidths = (currentFontSize, currentSquareSize) => {
            return groups.map(group => {
                const textWidth = estimateTextWidth(group, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                return currentSquareSize + legendSpacing + textWidth + 2 * legendItemHorzPadding;
            });
        };

        let legendItemWidths = calculateLegendItemWidths(legendFontSize, legendSquareSize);
        let totalLegendWidth = d3.sum(legendItemWidths);
        const availableLegendWidth = barChartWidth;

        if (totalLegendWidth > availableLegendWidth) {
            const scaleFactor = Math.max(0.6, availableLegendWidth / totalLegendWidth);
            legendFontSize = Math.max(8, Math.floor(legendFontSize * scaleFactor));
            legendSquareSize = Math.max(6, Math.floor(legendSquareSize * scaleFactor));
            legendItemWidths = calculateLegendItemWidths(legendFontSize, legendSquareSize);
            totalLegendWidth = d3.sum(legendItemWidths);
        }
        
        const legendGroup = svgRoot.append("g")
            .attr("transform", `translate(${chartMargins.left + (availableLegendWidth - totalLegendWidth)/2}, ${chartMargins.top - 35 - legendFontSize})`) // Centered above bars
            .attr("class", "legend");

        let currentX = 0;
        groups.forEach((group, i) => {
            const itemWidth = legendItemWidths[i];
            const legendItem = legendGroup.append("g")
                .attr("transform", `translate(${currentX}, 0)`)
                .attr("class", "legend-item");

            legendItem.append("rect")
                .attr("width", legendSquareSize)
                .attr("height", legendSquareSize)
                .attr("fill", getGroupColor(group, i))
                .attr("class", "mark legend-swatch");

            legendItem.append("text")
                .attr("x", legendSquareSize + legendSpacing)
                .attr("y", legendSquareSize / 2)
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${legendFontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .attr("class", "label legend-label")
                .text(group);
            
            currentX += itemWidth;
        });
    }


    // Block 8: Main Data Visualization Rendering
    sortedDimensions.forEach((dimension) => {
        const barHeight = yScale.bandwidth();
        const yPos = yScale(dimension);
        const centerY = yPos + barHeight / 2;

        // Render dimension icon (if available)
        if (images.field && images.field[dimension]) {
            const iconSize = Math.min(barHeight * 0.8, 30);
            const iconX = -iconSize - 10; // Position left of the bar area
            mainChartGroup.append("image")
                .attr("x", iconX)
                .attr("y", centerY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", images.field[dimension])
                .attr("class", "icon image dimension-icon");
        } else {
             // Optionally render dimension text if no icon
             mainChartGroup.append("text")
                .attr("x", -5) // Position left of the bar area
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize) // Use label font for dimension names
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .attr("class", "label dimension-label")
                .text(dimension);
        }


        // Render stacked bars
        const barSegments = [];
        stackData[dimension].items.forEach((item, groupIndex) => {
            if (item.value > 0) {
                const barWidthVal = xScale(item.value);
                const barXPos = xScale(item.start);
                
                mainChartGroup.append("rect")
                    .attr("x", barXPos)
                    .attr("y", yPos)
                    .attr("width", barWidthVal)
                    .attr("height", barHeight)
                    .attr("fill", getGroupColor(item.group, groups.indexOf(item.group)))
                    .attr("class", "mark bar");
                
                barSegments.push({ x: barXPos, end: barXPos + barWidthVal, y: yPos, height: barHeight });

                // Render data labels for bar segments
                const formattedVal = `${formatValue(item.value)}${valueUnit}`;
                const baseAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
                const dynamicFontSize = Math.min(16, Math.max(barHeight * 0.5, baseAnnotationFontSize));
                const labelTextWidth = estimateTextWidth(formattedVal, fillStyle.typography.annotationFontFamily, `${dynamicFontSize}px`, fillStyle.typography.annotationFontWeight);

                if (barWidthVal > labelTextWidth + 10) { // Enough space inside
                    mainChartGroup.append("text")
                        .attr("x", barXPos + barWidthVal / 2)
                        .attr("y", centerY)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "middle")
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", `${dynamicFontSize}px`)
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .style("fill", "#FFFFFF") // White text for contrast
                        .attr("class", "label data-label value")
                        .text(formattedVal);
                }
            }
        });
        
        // Add white separator lines
        for (let i = 1; i < barSegments.length; i++) {
            if (barSegments[i-1].end < barSegments[i].x - 0.5) { // Only if there's a visual gap due to 0 value items
                 // No line if items are perfectly abutted by calculation but one was zero.
            } else if (barSegments[i].x > barSegments[i-1].x) { // only if current segment starts after previous one
                 mainChartGroup.append("line")
                    .attr("x1", barSegments[i].x)
                    .attr("y1", yPos)
                    .attr("x2", barSegments[i].x)
                    .attr("y2", yPos + barHeight)
                    .attr("stroke", "#FFFFFF")
                    .attr("stroke-width", 1.5)
                    .attr("class", "mark separator-line");
            }
        }


        // Render circle for totalField
        const circleValue = dimensionCircleTotals[dimension];
        if (circleValue !== undefined && circleValue > 0) {
            const circleRadius = radiusScale(circleValue);
            const circleX = barChartWidth + circleChartWidth / 2;

            mainChartGroup.append("circle")
                .attr("cx", circleX)
                .attr("cy", centerY)
                .attr("r", circleRadius)
                .attr("fill", fillStyle.primaryColor)
                .style("stroke", fillStyle.chartBackground) // Use chart background for stroke for "cutout" effect
                .style("stroke-width", 1.5)
                .attr("class", "mark circle");

            // Render data label for circle
            const formattedTotal = `${formatValue(circleValue)}${totalUnit}`;
            const baseAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
            const dynamicFontSize = Math.min(16, Math.max(barHeight * 0.3, baseAnnotationFontSize * 0.8, 8)); // Smaller for circles
            const labelTextWidth = estimateTextWidth(formattedTotal, fillStyle.typography.annotationFontFamily, `${dynamicFontSize}px`, fillStyle.typography.annotationFontWeight);

            if (circleRadius * 1.8 > labelTextWidth) { // Enough space inside (1.8 instead of 2 for padding)
                mainChartGroup.append("text")
                    .attr("x", circleX)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${dynamicFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", "#FFFFFF")
                    .attr("class", "label data-label value")
                    .text(formattedTotal);
            } else if (circleChartWidth - (circleX - barChartWidth + circleRadius) > labelTextWidth + 5) { // Space to the right
                 mainChartGroup.append("text")
                    .attr("x", circleX + circleRadius + 5)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${dynamicFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .attr("class", "label data-label value")
                    .text(formattedTotal);
            }
            // else: label might be omitted if no space
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (No specific enhancements in this refactoring beyond core rendering)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}