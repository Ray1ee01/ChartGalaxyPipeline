/* REQUIREMENTS_BEGIN
{
  "chart_type": "Span Chart",
  "chart_name": "span_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors_dark || data.colors || {}; // Prefer dark if available, then light, then empty
    const images = data.images || {}; // Not used in this chart, but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xRoleFieldDef = dataColumns.find(col => col.role === "x");
    const yRoleFieldDef = dataColumns.find(col => col.role === "y");
    const groupRoleFieldDef = dataColumns.find(col => col.role === "group");

    const dimensionField = xRoleFieldDef ? xRoleFieldDef.name : undefined;
    const valueField = yRoleFieldDef ? yRoleFieldDef.name : undefined;
    const groupField = groupRoleFieldDef ? groupRoleFieldDef.name : undefined;

    const criticalFields = { 
        "dimension field (role 'x')": dimensionField, 
        "value field (role 'y')": valueField, 
        "group field (role 'group')": groupField 
    };
    const missingFields = Object.entries(criticalFields)
        .filter(([key, value]) => value === undefined)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'bold',
        },
        textColor: colors.text_color || '#0f223b',
        chartBackground: colors.background_color || '#FFFFFF',
        gridLineColor: 'rgba(0, 0, 0, 0.1)', // Default subtle grid for light background
        spanBarColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4',
        legendMarkerStroke: '#FFFFFF', // Default white stroke for legend markers, good contrast
    };
    
    const uniqueGroupsInitial = [...new Set(chartData.map(d => d[groupField]))];
    let groupColorScale;
    if (colors.field && Object.keys(colors.field).length > 0) {
        groupColorScale = d3.scaleOrdinal()
            .domain(uniqueGroupsInitial)
            .range(uniqueGroupsInitial.map(g => colors.field[g] || d3.schemeCategory10[uniqueGroupsInitial.indexOf(g) % 10]));
    } else if (colors.available_colors && colors.available_colors.length > 0) {
        groupColorScale = d3.scaleOrdinal(colors.available_colors).domain(uniqueGroupsInitial);
    } else {
        groupColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(uniqueGroupsInitial);
    }
    fillStyle.groupColorScale = groupColorScale;


    const estimateTextWidth = (text, fontProps) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // No need to style tempSvg itself, only the text element
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        tempText.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        tempText.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        tempText.textContent = text;
        tempSvg.appendChild(tempText); 
        // Appending to body and removing is not ideal for in-memory, getBBox should work without.
        // However, if styles are complex (e.g. CSS classes), it might be needed. Here, direct styles are fine.
        return tempText.getBBox().width;
    };

    const formatValue = (value) => {
        if (value === null || value === undefined || isNaN(parseFloat(value))) return "";
        const numValue = parseFloat(value);
        if (Math.abs(numValue) >= 1000000000) return d3.format("~g")(numValue / 1000000000) + "B";
        if (Math.abs(numValue) >= 1000000) return d3.format("~g")(numValue / 1000000) + "M";
        if (Math.abs(numValue) >= 1000) return d3.format("~g")(numValue / 1000) + "K";
        return d3.format("~g")(numValue);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 80, bottom: 60, left: 120 }; // Adjusted left for potentially long labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];

    if (groups.length !== 2 && chartData.length > 0) { // Check only if data exists
         const warnMsg = `Span chart expects exactly 2 groups based on configuration (required_fields_range for group is [2,2]), but found ${groups.length} unique groups in data. The chart will attempt to render using the min/max values among these groups for each dimension.`;
         console.warn(warnMsg);
         // No early exit, as the logic below will pick two points (min/max)
    }
    
    const isDataComplete = dimensions.every(dim => {
        const dimensionData = chartData.filter(d => d[dimensionField] === dim);
        const dimensionGroupsPresent = [...new Set(dimensionData.map(d => d[groupField]))];
        return groups.every(requiredGroup => dimensionGroupsPresent.includes(requiredGroup));
    });

    if (!isDataComplete && chartData.length > 0) {
        const errorMsg = 'Data is not complete: some dimensions are missing data for one or more required groups. Spans may not be rendered for these dimensions.';
        console.warn(errorMsg);
        // Non-fatal warning, chart will attempt to render what it can.
    }
    if (chartData.length === 0) {
        d3.select(containerSelector).html("<div style='color:grey; padding:10px;'>No data provided to render the chart.</div>");
        return null;
    }


    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.2);

    const allValues = chartData.map(d => parseFloat(d[valueField])).filter(v => !isNaN(v));
    const minValue = allValues.length > 0 ? d3.min(allValues) : 0;
    const maxValue = allValues.length > 0 ? d3.max(allValues) : 1; // Avoid domain of [0,0] if no data
    
    const xDomainMin = minValue >= 0 ? 0 : minValue * 1.15; // Start from 0 if all positive
    const xDomainMax = maxValue * 1.1;
    
    const xScale = d3.scaleLinear()
        .domain([xDomainMin, xDomainMax])
        .range([0, innerWidth])
        .nice();


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other") // Added 'other' for group classification
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Legend
    if (groups.length > 0) {
        const legendItemHeight = 20; // Approximate height for vertical centering
        const legendPadding = 5;
        const legendCircleRadius = 6; // Slightly smaller for a cleaner look
        
        let legendItems = [];
        groups.forEach(group => { // Iterate over actual groups found in data for legend
            const textWidth = estimateTextWidth(group, {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            });
            legendItems.push({
                group: group,
                width: legendCircleRadius * 2 + legendPadding + textWidth + 15 // circle + padding + text + item_spacing
            });
        });

        const totalLegendWidth = d3.sum(legendItems, d => d.width) - 15; // remove last item_spacing

        const legendGroup = svgRoot.append("g")
            .attr("class", "legend other")
            .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2 - legendItemHeight / 2})`); // Center legend block

        let currentX = 0;
        legendItems.forEach(item => {
            const legendItemGroup = legendGroup.append("g")
                .attr("class", "legend-item other")
                .attr("transform", `translate(${currentX}, 0)`);

            legendItemGroup.append("circle")
                .attr("class", "mark")
                .attr("cx", legendCircleRadius)
                .attr("cy", legendItemHeight / 2) // Vertically center circle in its allocated space
                .attr("r", legendCircleRadius)
                .style("fill", fillStyle.groupColorScale(item.group))
                .style("stroke", fillStyle.legendMarkerStroke)
                .style("stroke-width", 1.5);

            legendItemGroup.append("text")
                .attr("class", "label")
                .attr("x", legendCircleRadius * 2 + legendPadding)
                .attr("y", legendItemHeight / 2) 
                .attr("dy", "0.35em") // Standard vertical alignment
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(item.group);
            
            currentX += item.width;
        });
    }

    // Gridlines
    const xTicks = xScale.ticks(Math.max(2, Math.floor(innerWidth / 100))); 
    mainChartGroup.append("g").attr("class", "gridlines other") // Group for gridlines
        .selectAll(".gridline")
        .data(xTicks)
        .enter().append("line")
        .attr("class", "gridline other")
        .attr("x1", d => xScale(d))
        .attr("y1", 0)
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight)
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-width", 1)
        .style("shape-rendering", "crispEdges");

    // X-axis Tick Values (pseudo-axis)
    mainChartGroup.append("g").attr("class", "axis x-axis")
        .selectAll(".x-axis-tick-value")
        .data(xTicks)
        .enter().append("text")
        .attr("class", "value label") // Added label class
        .attr("x", d => xScale(d))
        .attr("y", innerHeight + 25) // Increased padding
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => formatValue(d));
    
    // Block 8: Main Data Visualization Rendering
    const yAxisGroup = mainChartGroup.append("g").attr("class", "axis y-axis");

    dimensions.forEach(dimension => {
        const dimensionDataRaw = chartData.filter(d => d[dimensionField] === dimension);
        const barY = yScale(dimension);
        const barHeight = yScale.bandwidth();

        if (dimensionDataRaw.length > 0 && barY !== undefined) {
            yAxisGroup.append("text")
                .attr("class", "label y-axis-dimension-label")
                .attr("x", -15) 
                .attr("y", barY + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(dimension);

            const pointData = dimensionDataRaw.map(d => {
                const val = parseFloat(d[valueField]);
                if (d[groupField] !== null && d[groupField] !== undefined && !isNaN(val)) {
                    return {
                        group: d[groupField],
                        value: val,
                        xPos: xScale(val),
                        yPos: barY
                    };
                }
                return null;
            }).filter(d => d !== null);
            
            pointData.sort((a, b) => a.value - b.value);

            if (pointData.length >= 2) { // Ensure at least two points to form a span
                const startPoint = pointData[0];
                const endPoint = pointData[pointData.length - 1]; 

                mainChartGroup.append("rect")
                    .attr("class", "mark span-bar")
                    .attr("x", Math.min(startPoint.xPos, endPoint.xPos)) // Handle cases where xScale might invert
                    .attr("y", startPoint.yPos + barHeight * 0.25)
                    .attr("width", Math.abs(endPoint.xPos - startPoint.xPos))
                    .attr("height", barHeight * 0.5)
                    .style("fill", fillStyle.spanBarColor);

                [startPoint, endPoint].forEach(point => {
                    mainChartGroup.append("circle")
                        .attr("class", "mark data-point-marker")
                        .attr("cx", point.xPos)
                        .attr("cy", point.yPos + barHeight / 2)
                        .attr("r", 6)
                        .style("fill", fillStyle.groupColorScale(point.group))
                        .style("stroke", fillStyle.legendMarkerStroke) 
                        .style("stroke-width", 2);
                });
                
                mainChartGroup.append("text")
                    .attr("class", "value data-value-label")
                    .attr("x", startPoint.xPos - 10) // Increased padding
                    .attr("y", startPoint.yPos + barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formatValue(startPoint.value));

                mainChartGroup.append("text")
                    .attr("class", "value data-value-label")
                    .attr("x", endPoint.xPos + 10) // Increased padding
                    .attr("y", endPoint.yPos + barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formatValue(endPoint.value));
            } else if (pointData.length === 1) { // Handle single point case if necessary (e.g., draw just the point)
                 const point = pointData[0];
                 mainChartGroup.append("circle")
                    .attr("class", "mark data-point-marker single")
                    .attr("cx", point.xPos)
                    .attr("cy", point.yPos + barHeight / 2)
                    .attr("r", 6)
                    .style("fill", fillStyle.groupColorScale(point.group))
                    .style("stroke", fillStyle.legendMarkerStroke)
                    .style("stroke-width", 2);
                mainChartGroup.append("text")
                    .attr("class", "value data-value-label single")
                    .attr("x", point.xPos + (point.xPos > innerWidth / 2 ? -10 : 10) ) // Basic label positioning
                    .attr("y", point.yPos + barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", point.xPos > innerWidth / 2 ? "end" : "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formatValue(point.value));
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}