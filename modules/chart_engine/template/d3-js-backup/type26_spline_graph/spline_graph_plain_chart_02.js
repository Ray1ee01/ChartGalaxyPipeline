/* REQUIREMENTS_BEGIN
{
  "chart_type": "Spline Graph",
  "chart_name": "spline_graph_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 8]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
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
    const rawChartData = data.data?.data;
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming light/dark theme might pass different color objects
    const images = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldConfig = dataColumns.find(col => col.role === xFieldRole);
    const yFieldConfig = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldConfig = dataColumns.find(col => col.role === groupFieldRole);

    const xFieldName = xFieldConfig?.name;
    const yFieldName = yFieldConfig?.name;
    const groupFieldName = groupFieldConfig?.name;

    let missingFields = [];
    if (!xFieldName) missingFields.push(`x-axis field (role: ${xFieldRole})`);
    if (!yFieldName) missingFields.push(`y-axis field (role: ${yFieldRole})`);
    if (!groupFieldName) missingFields.push(`grouping field (role: ${groupFieldRole})`);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    if (!rawChartData || rawChartData.length === 0) {
        const errorMsg = "Chart data is empty or not provided. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const chartDataArray = rawChartData;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.labelFontFamily = rawTypography.label?.font_family || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = rawTypography.label?.font_size || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = rawTypography.label?.font_weight || defaultTypography.label.font_weight;
    
    // Color defaults
    const defaultColors = {
        textColor: "#333333",
        primary: "#1f77b4",
        gridLine: "#e0e0e0", // Softer default gridline
        chartBackground: "#FFFFFF",
        available: d3.schemeCategory10
    };

    fillStyle.colors.textColor = rawColors.text_color || defaultColors.textColor;
    fillStyle.colors.chartBackground = rawColors.background_color || defaultColors.chartBackground;
    fillStyle.colors.gridLineColor = rawColors.other?.grid || defaultColors.gridLine;
    
    const getGroupColor = (groupName) => {
        if (rawColors.field && rawColors.field[groupName]) {
            return rawColors.field[groupName];
        }
        if (rawColors.other && rawColors.other.primary) {
            return rawColors.other.primary;
        }
        const groupIndex = groups.indexOf(groupName);
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[groupIndex % rawColors.available_colors.length];
        }
        return defaultColors.available[groupIndex % defaultColors.available.length];
    };
    
    fillStyle.colors.contrastTextColor = "#FFFFFF"; // For text on colored backgrounds

    // Helper: Parse Date
    const parseDate = d => {
        if (d instanceof Date) return d;
        if (typeof d === 'string' || typeof d === 'number') { // Simplified parsing, assuming common formats or timestamps
            const date = new Date(d);
            if (!isNaN(date.getTime())) return date;
        }
        // Fallback for specific string formats if new Date(d) fails for them
        if (typeof d === 'string') {
            const parts = d.split('-');
            if (parts.length === 3) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            if (parts.length === 2) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            if (parts.length === 1 && /^\d{4}$/.test(parts[0])) return new Date(parseInt(parts[0]), 0, 1);
        }
        return new Date(); // Should ideally not happen with valid data
    };
    
    // Helper: Estimate Text Width (in-memory SVG)
    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight = 'normal') => {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // No DOM append/remove needed for getBBox if element is properly created in SVG NS
        const width = textElement.getBBox().width;
        return width;
    };

    // Helper: Create X-Axis Scale and Ticks
    const createXAxisScaleAndTicks = (data, xField, rangeStart, rangeEnd) => {
        const dates = data.map(d => parseDate(d[xField]));
        const xExtent = d3.extent(dates);
        if (!xExtent[0] || !xExtent[1]) { // Handle case with no valid dates
             return { xScale: d3.scaleTime().domain([new Date(), new Date()]).range([rangeStart, rangeEnd]), xTicks: [], xFormat: d => "" };
        }
        const xScale = d3.scaleTime().domain(xExtent).range([rangeStart, rangeEnd]);
        
        const timeSpan = xExtent[1].getTime() - xExtent[0].getTime();
        const yearSpan = timeSpan / (1000 * 60 * 60 * 24 * 365.25);
        
        let timeInterval, formatFunction;
        if (yearSpan > 35) {
            timeInterval = d3.timeYear.every(10); formatFunction = d3.timeFormat("%Y");
        } else if (yearSpan > 15) {
            timeInterval = d3.timeYear.every(5); formatFunction = d3.timeFormat("%Y");
        } else if (yearSpan > 7) {
            timeInterval = d3.timeYear.every(2); formatFunction = d3.timeFormat("%Y");
        } else if (yearSpan > 2) {
            timeInterval = d3.timeYear.every(1); formatFunction = d3.timeFormat("%Y");
        } else if (yearSpan > 0.5) { // Adjusted for months / quarters
            timeInterval = d3.timeMonth.every(3);
            formatFunction = d => {
                const month = d.getMonth();
                const quarter = Math.floor(month / 3) + 1;
                return `${d3.timeFormat("%y")(d)}Q${quarter}`;
            };
        } else { // Default to months if very short span
            timeInterval = d3.timeMonth.every(1); formatFunction = d3.timeFormat("%b %y");
        }
        
        const xTicks = xScale.ticks(timeInterval);
        return { xScale, xTicks, xFormat: formatFunction };
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.colors.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 180, bottom: 60, left: 80 }; // Right margin for side labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    chartDataArray.forEach(d => {
        d.parsedX = parseDate(d[xFieldName]);
        d.parsedY = +d[yFieldName]; // Ensure Y is numeric
    });

    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort((a, b) => {
        const aLastPoint = chartDataArray.filter(d => d[groupFieldName] === a).sort((p1, p2) => d3.descending(p1.parsedX, p2.parsedX))[0];
        const bLastPoint = chartDataArray.filter(d => d[groupFieldName] === b).sort((p1, p2) => d3.descending(p1.parsedX, p2.parsedX))[0];
        return d3.descending(aLastPoint?.parsedY || -Infinity, bLastPoint?.parsedY || -Infinity);
    });


    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartDataArray, xFieldName, 0, innerWidth);
    
    const yMin = d3.min(chartDataArray, d => d.parsedY);
    const yMax = d3.max(chartDataArray, d => d.parsedY);
    const yScale = d3.scaleLinear()
        .domain([Math.min(0, yMin * (yMin > 0 ? 0.9 : 1.1)), yMax * 1.1]) // Adjust padding based on min value
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const yAxisTicks = yScale.ticks(5);
    const gridLabelExtension = 5; // For Y-axis tick labels

    // Horizontal Gridlines
    mainChartGroup.append("g")
        .attr("class", "gridlines y-gridlines")
        .selectAll("line.gridline-y")
        .data(yAxisTicks)
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", -gridLabelExtension)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.colors.gridLineColor)
        .attr("stroke-width", 1)
        .attr("opacity", 0.7); // Kept opacity for subtlety

    // Vertical Gridlines (excluding first and last if they are on the edge)
    mainChartGroup.append("g")
        .attr("class", "gridlines x-gridlines")
        .selectAll("line.gridline-x")
        .data(xTicks.filter((d, i) => xScale(d) > 0 && xScale(d) < innerWidth))
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", d => xScale(d))
        .attr("y1", 0)
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight + 10) // Small extension
        .attr("stroke", fillStyle.colors.gridLineColor)
        .attr("stroke-width", 1)
        .attr("opacity", 0.7);

    // X-Axis Labels
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    xAxisGroup.selectAll("text.x-axis-label")
        .data(xTicks)
        .enter().append("text")
        .attr("class", "label x-axis-label")
        .attr("x", d => xScale(d))
        .attr("y", 25) // Position below axis line
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(d => xFormat(d));

    // Y-Axis Labels
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    yAxisGroup.selectAll("text.y-axis-label")
        .data(yAxisTicks)
        .enter().append("text")
        .attr("class", "value y-axis-label")
        .attr("x", -gridLabelExtension - 5) // Position left of axis line
        .attr("y", d => yScale(d))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(d => d);

    // Y-Axis Field Label (custom style)
    const yAxisTitleGroup = mainChartGroup.append("g")
        .attr("class", "other axis-title-group");
    
    if (yFieldName) {
        const yAxisLabelText = yFieldConfig?.label || yFieldName;
        const yAxisLabelTextWidth = estimateTextWidth(yAxisLabelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        const labelPadding = 15;
        const labelWidth = yAxisLabelTextWidth + 2 * labelPadding;
        const labelHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.5; // Approx height
        const triangleHeight = 6;

        const yAxisTitlePath = `
            M 0,0 
            H ${labelWidth} 
            V ${labelHeight} 
            H ${labelWidth/2 + triangleHeight} 
            L ${labelWidth/2},${labelHeight + triangleHeight} 
            L ${labelWidth/2 - triangleHeight},${labelHeight} 
            H 0 
            Z
        `;
        const yAxisTitleX = -chartMargins.left + 20; // Position relative to mainChartGroup
        const yAxisTitleY = yScale(yAxisTicks[yAxisTicks.length -1]) - labelHeight - triangleHeight - 10; // Above highest tick

        yAxisTitleGroup.attr("transform", `translate(${yAxisTitleX}, ${yAxisTitleY})`);

        yAxisTitleGroup.append("path")
            .attr("d", yAxisTitlePath)
            .attr("fill", "none")
            .attr("stroke", fillStyle.colors.textColor)
            .attr("stroke-width", 1)
            .attr("opacity", 0.5) // Keep subtle opacity for this decorative element
            .attr("class", "mark axis-title-shape");

        yAxisTitleGroup.append("text")
            .attr("x", labelWidth / 2)
            .attr("y", labelHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("class", "label axis-title-text")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(yAxisLabelText);
    }


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d.parsedX))
        .y(d => yScale(d.parsedY))
        .curve(d3.curveMonotoneX);

    const linesGroup = mainChartGroup.append("g").attr("class", "lines-group");

    groups.forEach(group => {
        const groupData = chartDataArray.filter(d => d[groupFieldName] === group);
        if (groupData.length > 0) {
            linesGroup.append("path")
                .datum(groupData)
                .attr("class", "mark data-line")
                .attr("fill", "none")
                .attr("stroke", getGroupColor(group))
                .attr("stroke-width", 2)
                .attr("d", lineGenerator);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing (Side Labels / Annotations)
    const sideLabelsGroup = mainChartGroup.append("g")
        .attr("class", "annotations-group")
        .attr("transform", `translate(${innerWidth + 20}, 0)`); // Position to the right of chart

    let labelYPositions = []; // For simple collision avoidance
    const labelVerticalSpacing = parseFloat(fillStyle.typography.labelFontSize) * 2.5; // Min space between labels

    groups.forEach((group, i) => {
        const groupData = chartDataArray.filter(d => d[groupFieldName] === group);
        const lastPoint = groupData.sort((a,b) => d3.descending(a.parsedX, b.parsedX))[0];

        if (!lastPoint) return;

        const endCircleY = yScale(lastPoint.parsedY);
        let targetLabelY = endCircleY;

        // Adjust Y to avoid overlap
        let overlapped;
        do {
            overlapped = false;
            for (const pos of labelYPositions) {
                if (Math.abs(targetLabelY - pos) < labelVerticalSpacing) {
                    targetLabelY = pos + labelVerticalSpacing; // Push down
                    overlapped = true;
                    break; 
                }
            }
        } while (overlapped);
        labelYPositions.push(targetLabelY);
        labelYPositions.sort((a,b) => a-b); // Keep sorted for next iteration

        const groupLabelElement = sideLabelsGroup.append("g")
            .attr("class", "other annotation-item")
            .attr("transform", `translate(0, ${targetLabelY})`);
        
        const valueText = `${Math.round(lastPoint.parsedY)}`;
        const valueTextWidth = estimateTextWidth(valueText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        const rectWidth = valueTextWidth + 10; // Padding for rect
        const rectHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.5;
        const groupColor = getGroupColor(group);

        // Label Background Rect
        groupLabelElement.append("rect")
            .attr("class", "mark annotation-background")
            .attr("x", 0)
            .attr("y", -rectHeight / 2)
            .attr("width", rectWidth)
            .attr("height", rectHeight)
            .attr("fill", groupColor);
        
        // Pointer Triangle
        const relativeCircleYForPointer = endCircleY - targetLabelY; // Y of circle relative to label's Y
        const trianglePath = `M -12,${relativeCircleYForPointer} L 0,${-rectHeight/2} L 0,${rectHeight/2} Z`;
        
        groupLabelElement.append("path")
            .attr("class", "mark annotation-pointer")
            .attr("d", trianglePath)
            .attr("fill", groupColor);
        
        // Value Text
        groupLabelElement.append("text")
            .attr("class", "value annotation-value-text")
            .attr("x", rectWidth / 2)
            .attr("y", 0) // Vertically centered due to dominant-baseline
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.colors.contrastTextColor)
            .text(valueText);
        
        // Group Name Text
        const groupNameText = groupFieldConfig?.labelMapping?.[group] || group;
        groupLabelElement.append("text")
            .attr("class", "label annotation-group-text")
            .attr("x", rectWidth + 8) // Spacing after rect
            .attr("y", 0) // Vertically centered
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold") // Group name often bold
            .style("fill", groupColor)
            .text(groupNameText);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}