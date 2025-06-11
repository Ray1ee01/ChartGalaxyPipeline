/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Line Graph",
  "chart_name": "multiple_line_graph_07",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 7]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 800,
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "prominent",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const suppliedTypography = data.typography || {};
    const suppliedColors = data.colors_dark || data.colors || {}; // Prefer dark theme if available
    const suppliedImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xCol = dataColumns.find(col => col.role === "x");
    const yCol = dataColumns.find(col => col.role === "y");
    const groupCol = dataColumns.find(col => col.role === "group");

    if (!xCol || !yCol || !groupCol) {
        const missing = [
            !xCol ? "x role" : null,
            !yCol ? "y role" : null,
            !groupCol ? "group role" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: column(s) with ${missing}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const xField = xCol.name;
    const yField = yCol.name;
    const groupField = groupCol.name;
    const yAxisLabelText = yCol.label || yField;

    if (chartDataInput.length === 0) {
        d3.select(containerSelector).html("<div style='color:grey; padding:10px;'>No data provided to render the chart.</div>");
        return null;
    }
    
    // Filter out data points with invalid Y values early
    const chartData = chartDataInput.filter(d => d[yField] !== null && d[yField] !== undefined && !isNaN(parseFloat(d[yField])));


    // Block 2: Style Configuration & Helper Definitions
    const DEFAULT_TYPOGRAPHY = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const DEFAULT_COLORS_DARK = {
        field: {},
        other: { primary: "#5695F7", secondary: "#FFA500" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2"],
        background_color: "#121212", // Darker background
        text_color: "#E0E0E0"
    };
    
    const fillStyle = {
        typography: {
            labelFontFamily: (suppliedTypography.label && suppliedTypography.label.font_family) || DEFAULT_TYPOGRAPHY.label.font_family,
            labelFontSize: (suppliedTypography.label && suppliedTypography.label.font_size) || DEFAULT_TYPOGRAPHY.label.font_size,
            labelFontWeight: (suppliedTypography.label && suppliedTypography.label.font_weight) || DEFAULT_TYPOGRAPHY.label.font_weight,
            annotationFontFamily: (suppliedTypography.annotation && suppliedTypography.annotation.font_family) || DEFAULT_TYPOGRAPHY.annotation.font_family,
            annotationFontSize: (suppliedTypography.annotation && suppliedTypography.annotation.font_size) || DEFAULT_TYPOGRAPHY.annotation.font_size,
            annotationFontWeight: (suppliedTypography.annotation && suppliedTypography.annotation.font_weight) || DEFAULT_TYPOGRAPHY.annotation.font_weight,
        },
        backgroundColor: suppliedColors.background_color || DEFAULT_COLORS_DARK.background_color,
        textColor: suppliedColors.text_color || DEFAULT_COLORS_DARK.text_color,
        gridColor: suppliedColors.grid_color || "#3f3e40", // From original
        axisLineColor: suppliedColors.axis_line_color || "#e8f6fa", // From original
        lineStrokeWidth: variables.lineStrokeWidth || 3,
        pointRadius: variables.pointRadius || 4,
    };

    const uniqueGroups = [...new Set(chartData.map(d => d[groupField]))];
    const groupColors = {};
    const defaultColorPalette = suppliedColors.available_colors || DEFAULT_COLORS_DARK.available_colors;
    const colorScale = d3.scaleOrdinal(defaultColorPalette);

    uniqueGroups.forEach(group => {
        if (suppliedColors.field && suppliedColors.field[group]) {
            groupColors[group] = suppliedColors.field[group];
        } else {
            groupColors[group] = colorScale(group);
        }
    });
    fillStyle.groupColors = groupColors;

    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        if (fontProps) {
            if (fontProps.fontFamily) textElement.style.fontFamily = fontProps.fontFamily;
            if (fontProps.fontSize) textElement.style.fontSize = fontProps.fontSize;
            if (fontProps.fontWeight) textElement.style.fontWeight = fontProps.fontWeight;
        }
        svg.appendChild(textElement);
        // Document append/remove is not strictly necessary for getBBox if styles are applied directly
        // but some browsers might be more consistent if it's briefly in DOM.
        // For true in-memory, ensure all styles are applied that affect layout.
        // document.body.appendChild(svg); 
        const width = textElement.getBBox().width;
        // document.body.removeChild(svg);
        return width;
    }
    
    function parseDateValue(dateStr) {
        return new Date(dateStr);
    }

    function createXAxisScaleAndTicksHelper(data, key, minRange, maxRange) {
        const dates = data.map(d => parseDateValue(d[key])).sort((a, b) => a - b);
        const minDate = dates[0];
        const maxDate = dates[dates.length - 1];

        const scale = d3.scaleTime().domain([minDate, maxDate]).range([minRange, maxRange]);
        
        const timeDiffDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
        let format;

        if (timeDiffDays > 365 * 2) {
            format = d3.timeFormat("%Y");
        } else if (timeDiffDays > 60) {
            format = d3.timeFormat("%b %Y");
        } else if (timeDiffDays > 1) {
            format = d3.timeFormat("%d %b");
        } else {
            format = d3.timeFormat("%H:%M");
        }
        
        // Let D3 determine a reasonable number of ticks, typically 5-10.
        const ticks = scale.ticks(variables.xTicksCount || 5); 

        return { xScale: scale, xTicks: ticks, xFormat: format };
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
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.marginTop || 40, 
        right: variables.marginRight || 180, // Ample space for end-of-line labels
        bottom: variables.marginBottom || 60, 
        left: variables.marginLeft || 80 
    };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    // (Most data prep like unique groups already done in Block 2 for color assignment)
    // Sort data by date for line generator
    chartData.forEach(d => {
        d.parsedDate = parseDateValue(d[xField]); // Ensure dates are parsed for sorting and scales
    });
    chartData.sort((a, b) => a.parsedDate - b.parsedDate);
    
    const endPoints = [];
    const lastXDate = d3.max(chartData, d => d.parsedDate);


    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicksHelper(chartData, xField, 0, innerWidth);
    const endXPosition = xScale(lastXDate);

    const yDataMin = d3.min(chartData, d => +d[yField]);
    const yDataMax = d3.max(chartData, d => +d[yField]);
    
    const yScale = d3.scaleLinear()
        .domain([
            Math.min(0, yDataMin * (yDataMin > 0 ? 0.9 : 1.1)), // Adjust domain based on sign
            yDataMax * 1.1 // Extend 10% beyond max
        ])
        .range([innerHeight, 0])
        .nice();


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const yAxisTicks = yScale.ticks(variables.yTicksCount || 6);
    const filteredYTicks = yAxisTicks.filter((d, i) => i > 0 || d !== 0); // Remove 0 if it's the first tick, or always first if data is all positive/negative
    const gridExtension = 5;

    mainChartGroup.selectAll("rect.grid-line-y")
        .data(filteredYTicks)
        .enter()
        .append("rect")
        .attr("class", "grid grid-line-y")
        .attr("x", -gridExtension - (variables.yAxisGridLabelOffset || 30))
        .attr("y", d => yScale(d) - 0.5)
        .attr("width", innerWidth + gridExtension + (variables.yAxisGridLabelOffset || 30))
        .attr("height", 1)
        .style("fill", fillStyle.gridColor);

    mainChartGroup.selectAll("rect.grid-line-x")
        .data(xTicks)
        .enter()
        .append("rect")
        .attr("class", "grid grid-line-x")
        .attr("x", d => xScale(d) - 0.5)
        .attr("y", 0)
        .attr("width", 1)
        .attr("height", innerHeight)
        .style("fill", fillStyle.gridColor);

    // X-Axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).tickValues(xTicks).tickFormat(xFormat));
    
    xAxisGroup.selectAll("text")
        .attr("class", "label tick-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("dy", "0.7em");
    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll(".tick line").remove();

    mainChartGroup.append("line") // Horizontal line for X-axis base
        .attr("class", "axis-line x-axis-line")
        .attr("x1", -(variables.xAxisLineExtension || 20))
        .attr("y1", innerHeight)
        .attr("x2", innerWidth + (variables.xAxisLineExtension || 20))
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Y-Axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickValues(yAxisTicks).tickSize(0).tickFormat(d => d3.format(variables.yAxisFormat || "~s")(d))); // Use specified format or default short format

    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll(".tick line").remove();
    yAxisGroup.selectAll(".tick text")
        .attr("class", "label tick-label")
        .attr("x", -gridExtension - (variables.yAxisTickLabelOffset || 5))
        .attr("dy", variables.yAxisTickLabelVerticalAdjust || -5) // Adjust for better alignment with grid lines
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "end");

    mainChartGroup.append("text") // Y-Axis Title
        .attr("class", "label axis-title y-axis-title")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - chartMargins.left + (variables.yAxisTitleOffset || 20))
        .attr("x", 0 - (innerHeight / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(yAxisLabelText);
    
    // Vertical lines at start and end of chart area (stylistic)
    mainChartGroup.append("line")
        .attr("class", "boundary-line y-axis-boundary")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    mainChartGroup.append("line")
        .attr("class", "boundary-line end-x-boundary")
        .attr("x1", endXPosition)
        .attr("y1", 0)
        .attr("x2", endXPosition)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d.parsedDate))
        .y(d => yScale(+d[yField]));

    uniqueGroups.forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group).sort((a,b) => a.parsedDate - b.parsedDate);
        if (groupData.length === 0) return;

        mainChartGroup.append("path")
            .datum(groupData)
            .attr("class", "mark line data-line")
            .attr("fill", "none")
            .attr("stroke", fillStyle.groupColors[group])
            .attr("stroke-width", fillStyle.lineStrokeWidth)
            .attr("d", lineGenerator);

        // Start and End Points
        const firstPoint = groupData[0];
        const lastPoint = groupData[groupData.length - 1];

        [firstPoint, lastPoint].forEach(point => {
            if (!point) return;
            mainChartGroup.append("circle")
                .attr("class", "mark point data-point")
                .attr("cx", xScale(point.parsedDate))
                .attr("cy", yScale(+point[yField]))
                .attr("r", fillStyle.pointRadius)
                .attr("fill", fillStyle.groupColors[group]);
        });
        
        if (lastPoint) {
             endPoints.push({
                x: xScale(lastPoint.parsedDate),
                y: yScale(+lastPoint[yField]),
                value: d3.format(variables.dataLabelFormat || ",.0f")(+lastPoint[yField]), // Format value
                color: fillStyle.groupColors[group],
                group: group
            });
        }
    });

    // Block 9: Optional Enhancements & Post-Processing (End-of-Line Labels)
    endPoints.sort((a, b) => a.y - b.y); // Sort by Y for simple collision avoidance

    let lastLabelYEnd = -Infinity;
    const labelHeightApproximation = (variables.labelBlockHeight || 35); 
    const labelVerticalPadding = (variables.labelVerticalPadding || 5);
    const labelHorizontalOffset = (variables.labelHorizontalOffset || 15);
    const iconSize = (variables.iconSize || 20);
    const iconTextSpacing = (variables.iconTextSpacing || 5);

    endPoints.forEach(point => {
        let targetY = point.y - labelHeightApproximation / 2; // Aim to center label block on point.y
        if (targetY < lastLabelYEnd + labelVerticalPadding) {
            targetY = lastLabelYEnd + labelVerticalPadding;
        }

        const labelGroup = mainChartGroup.append("g")
            .attr("class", "label data-label-group")
            .attr("transform", `translate(${point.x + labelHorizontalOffset}, ${targetY})`);

        let currentXOffset = 0;
        if (suppliedImages.field && suppliedImages.field[point.group]) {
            labelGroup.append("image")
                .attr("class", "icon data-icon")
                .attr("x", currentXOffset)
                .attr("y", 0) 
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", suppliedImages.field[point.group]);
            currentXOffset += iconSize + iconTextSpacing;
        } else if (variables.showFallbackIcon !== false) { // Optional fallback icon
             labelGroup.append("circle")
                .attr("class", "icon fallback-icon data-icon")
                .attr("cx", currentXOffset + iconSize / 2) 
                .attr("cy", iconSize / 2)
                .attr("r", iconSize / 3)
                .attr("fill", point.color);
            currentXOffset += iconSize + iconTextSpacing;
        }
        
        // Group Name
        labelGroup.append("text")
            .attr("class", "text group-name-label")
            .attr("x", currentXOffset)
            .attr("y", iconSize / 2) // Align with middle of icon
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold") // Group name often bold
            .style("fill", point.color)
            .text(point.group);
        
        const groupNameWidth = estimateTextWidth(point.group, { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: "bold"
        });
        currentXOffset += groupNameWidth + (variables.nameValueSpacing || 10);

        // Value
        labelGroup.append("text")
            .attr("class", "text value-label")
            .attr("x", currentXOffset)
            .attr("y", iconSize / 2) // Align with middle of icon
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(point.value);
            
        lastLabelYEnd = targetY + labelHeightApproximation;
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}