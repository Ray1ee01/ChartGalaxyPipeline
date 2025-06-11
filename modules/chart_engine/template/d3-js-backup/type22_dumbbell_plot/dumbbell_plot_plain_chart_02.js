/* REQUIREMENTS_BEGIN
{
  "chart_type": "Dumbbell Plot",
  "chart_name": "dumbbell_plot_plain_chart_02",
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

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Prefer dark theme if colors_dark is primary
    const imagesInput = data.images || {}; // Parsed, though not used in this specific chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    if (!xFieldCol || !yFieldCol || !groupFieldCol) {
        const missing = [
            !xFieldCol ? "'x' role" : null,
            !yFieldCol ? "'y' role" : null,
            !groupFieldCol ? "'group' role" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart configuration missing: column(s) for ${missing} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px; font-family:sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const dimensionField = xFieldCol.name;
    const valueField = yFieldCol.name;
    const groupField = groupFieldCol.name;

    const dimensionUnit = xFieldCol.unit && xFieldCol.unit !== "none" ? xFieldCol.unit : "";
    const valueUnit = yFieldCol.unit && yFieldCol.unit !== "none" ? yFieldCol.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyInput.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyInput.title?.font_size || '16px',
            titleFontWeight: typographyInput.title?.font_weight || 'bold',
            labelFontFamily: typographyInput.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyInput.label?.font_size || '12px',
            labelFontWeight: typographyInput.label?.font_weight || 'normal',
            annotationFontFamily: typographyInput.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyInput.annotation?.font_size || '10px',
            annotationFontWeight: typographyInput.annotation?.font_weight || 'normal',
        },
        chartBackground: colorsInput.background_color || '#1A202C', // Default dark background
        textColor: colorsInput.text_color || '#E2E8F0',          // Default light text for dark background
        gridLineColor: 'rgba(225, 225, 225, 0.1)', // Softer subtle grid lines
        connectingLineColor: colorsInput.other?.primary || '#A0AEC0', // Neutral color for connecting line
        markerStrokeColor: '#FFFFFF', // Default white stroke for markers, as in original
        valueLabelTextColor: '#FFFFFF', // Text color for labels on colored backgrounds
        defaultCategoryColors: d3.schemeCategory10,
    };
    
    fillStyle.getCategoryColor = (categoryValue, index) => {
        if (colorsInput.field && colorsInput.field[categoryValue]) {
            return colorsInput.field[categoryValue];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[index % colorsInput.available_colors.length];
        }
        return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.position = 'absolute'; // Avoid layout shifts
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.style.fontFamily = fontProps.fontFamily;
        tempTextElement.style.fontSize = fontProps.fontSize;
        tempTextElement.style.fontWeight = fontProps.fontWeight;
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        document.body.appendChild(tempSvg); // Required for getBBox to work accurately
        const width = tempTextElement.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const uniqueDimensions = [...new Set(chartDataInput.map(d => d[dimensionField]))];
    const uniqueGroups = [...new Set(chartDataInput.map(d => d[groupField]))];
    
    const legendItemHeight = parseFloat(fillStyle.typography.labelFontSize) + 10; // Approx height for one line legend item
    const legendHeight = uniqueGroups.length > 0 ? legendItemHeight + 10 : 0; // Total legend area height + padding

    const chartMargins = {
        top: 20 + legendHeight, // Space for legend
        right: 40, 
        bottom: 60, // Space for dimension labels
        left: 60    // Space for Y-axis tick labels
    };
    
    // Dynamically adjust right margin for value labels if needed (simple heuristic)
    let maxValueLabelWidthEst = 0;
     chartDataInput.forEach(d => {
        const formattedValue = `${parseFloat(d[valueField]).toFixed(1)}${valueUnit}`;
         maxValueLabelWidthEst = Math.max(maxValueLabelWidthEst, estimateTextWidth(formattedValue, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        }));
    });
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidthEst / 2 + 20);


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartData = chartDataInput.map(d => ({
        ...d,
        [valueField]: parseFloat(d[valueField])
    })).filter(d => d[dimensionField] != null && !isNaN(d[valueField]) && d[groupField] != null);


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(uniqueDimensions)
        .range([0, innerWidth])
        .padding(0.25); 

    const allValues = chartData.map(d => d[valueField]);
    const minValue = d3.min(allValues);
    const maxValue = d3.max(allValues);
    
    const yDomainMax = (typeof maxValue === 'number' ? maxValue : 0) + Math.abs((typeof maxValue === 'number' ? maxValue : 0) * 0.05) + 5; // Add 5% padding + 5 units
    const yDomainMin = (typeof minValue === 'number' ? Math.min(minValue, 0) : 0) * 1.15; // Extend 15% if min is negative or zero

    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0]);

    const colorScale = d3.scaleOrdinal()
        .domain(uniqueGroups)
        .range(uniqueGroups.map((group, i) => fillStyle.getCategoryColor(group, i)));

    // Block 7: Chart Component Rendering
    // Legend
    if (uniqueGroups.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend chart-legend")
            .attr("transform", `translate(0, 20)`); 

        let currentX = 0;
        const legendItemPadding = 15;
        const legendItemCircleRadius = 6;

        uniqueGroups.forEach((groupName) => {
            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, 0)`);

            legendItem.append("circle")
                .attr("class", "mark legend-mark")
                .attr("cx", legendItemCircleRadius)
                .attr("cy", legendItemCircleRadius)
                .attr("r", legendItemCircleRadius)
                .attr("fill", colorScale(groupName))
                .attr("stroke", fillStyle.markerStrokeColor)
                .attr("stroke-width", 1);

            const legendText = legendItem.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendItemCircleRadius * 2 + 5)
                .attr("y", legendItemCircleRadius)
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(groupName);
            
            const textBBox = legendText.node().getBBox();
            currentX += legendItemCircleRadius * 2 + 5 + textBBox.width + legendItemPadding;
        });
        
        const legendWidth = Math.max(0, currentX - legendItemPadding);
        legendGroup.attr("transform", `translate(${(containerWidth - legendWidth) / 2}, 20)`);
    }

    // Y-axis Gridlines and Tick Labels
    const yTicks = yScale.ticks(10);
    const yAxisGroup = mainChartGroup.append("g").attr("class", "axis y-axis");

    yAxisGroup.selectAll(".gridline")
        .data(yTicks)
        .enter().append("line")
        .attr("class", "gridline y-gridline")
        .attr("x1", 0)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    yAxisGroup.selectAll(".tick-label")
        .data(yTicks)
        .enter().append("text")
        .attr("class", "label tick-label y-axis-label")
        .attr("x", -10)
        .attr("y", d => yScale(d))
        .attr("text-anchor", "end")
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => `${d}${valueUnit}`);
        
    const topmostTickY = yTicks.length > 0 ? yScale(yTicks[yTicks.length - 1]) : (yScale.range()[1] || 0);

    // X-axis Dimension Labels
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    uniqueDimensions.forEach(dim => {
        const formattedDim = `${dim}${dimensionUnit}`;
        xAxisGroup.append("text")
            .attr("class", "label tick-label x-axis-label")
            .attr("x", xScale(dim) + xScale.bandwidth() / 2)
            .attr("y", chartMargins.bottom / 2) // Position in the middle of bottom margin
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedDim);
    });

    // Block 8: Main Data Visualization Rendering
    const pointRadius = 6;
    const connectingRectWidth = 4; // Original was a rect of width 4

    uniqueDimensions.forEach(dimValue => {
        const dimensionDataPoints = chartData.filter(d => d[dimensionField] === dimValue);
        if (dimensionDataPoints.length === 0) return;

        const pointsForDimension = uniqueGroups.map(groupName => {
            const dataPoint = dimensionDataPoints.find(d => d[groupField] === groupName);
            if (dataPoint) {
                return {
                    group: groupName,
                    value: dataPoint[valueField],
                    x: xScale(dimValue) + xScale.bandwidth() / 2,
                    y: yScale(dataPoint[valueField])
                };
            }
            return null;
        }).filter(p => p !== null);

        if (pointsForDimension.length > 0) {
            let lowestNumericalValuePoint = pointsForDimension[0];
            for(let i = 1; i < pointsForDimension.length; i++) {
                if (pointsForDimension[i].value < lowestNumericalValuePoint.value) {
                    lowestNumericalValuePoint = pointsForDimension[i];
                }
            }
            
            if (lowestNumericalValuePoint) {
                mainChartGroup.append("rect")
                    .attr("class", "mark connecting-line")
                    .attr("x", lowestNumericalValuePoint.x - connectingRectWidth / 2)
                    .attr("y", Math.min(topmostTickY, lowestNumericalValuePoint.y))
                    .attr("width", connectingRectWidth)
                    .attr("height", Math.abs(lowestNumericalValuePoint.y - topmostTickY))
                    .attr("fill", fillStyle.connectingLineColor);
            }
        }
        
        pointsForDimension.forEach(point => {
            mainChartGroup.append("circle")
                .attr("class", "mark data-point-marker")
                .attr("cx", point.x)
                .attr("cy", point.y)
                .attr("r", pointRadius)
                .attr("fill", colorScale(point.group))
                .attr("stroke", fillStyle.markerStrokeColor)
                .attr("stroke-width", 1.5);

            const formattedValue = `${point.value.toFixed(1)}${valueUnit}`;
            const tempLabelText = mainChartGroup.append("text") // For measurement
                .attr("class", "label value-label-temp")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(formattedValue);
            const textBBox = tempLabelText.node().getBBox();
            tempLabelText.remove();

            const labelPadding = { x: 6, y: 4 };
            const labelWidth = textBBox.width + labelPadding.x * 2;
            const labelHeight = textBBox.height + labelPadding.y * 2;
            const labelYOffset = 8; // Distance above the circle's edge

            mainChartGroup.append("rect")
                .attr("class", "mark value-label-background")
                .attr("x", point.x - labelWidth / 2)
                .attr("y", point.y - labelHeight - pointRadius - labelYOffset)
                .attr("width", labelWidth)
                .attr("height", labelHeight)
                .attr("rx", 0) 
                .attr("ry", 0) 
                .attr("fill", colorScale(point.group))
                .attr("stroke", fillStyle.markerStrokeColor)
                .attr("stroke-width", 0.5);

            mainChartGroup.append("text")
                .attr("class", "label value-label-text")
                .attr("x", point.x)
                .attr("y", point.y - pointRadius - labelYOffset - labelHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.valueLabelTextColor)
                .text(formattedValue);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects applied.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}