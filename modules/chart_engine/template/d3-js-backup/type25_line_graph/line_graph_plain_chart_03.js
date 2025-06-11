/* REQUIREMENTS_BEGIN
{
  "chart_type": "Line Chart",
  "chart_name": "line_graph_plain_chart_03",
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
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "adjacent_indicator",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data; // Renamed for clarity
    const chartDataArray = chartConfig.data.data;
    const variables = chartConfig.variables || {};
    const typographyConfig = chartConfig.typography || {};
    const colorsConfig = chartConfig.colors_dark || chartConfig.colors || {}; // Prioritize dark theme colors
    const imagesConfig = chartConfig.images || {};
    const dataColumns = chartConfig.data.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = dataColumns.find(col => col.role === "x");
    const yFieldRole = dataColumns.find(col => col.role === "y");
    const groupFieldRole = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldRole ? xFieldRole.name : undefined;
    const yFieldName = yFieldRole ? yFieldRole.name : undefined;
    const groupFieldName = groupFieldRole ? groupFieldRole.name : undefined;
    const yFieldLabel = yFieldRole ? yFieldRole.label : yFieldName;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x role" : null,
            !yFieldName ? "y role" : null,
            !groupFieldName ? "group role" : null,
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: field names for roles (${missingFields}). Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    if (!chartDataArray || chartDataArray.length === 0) {
        const errorMessage = "No data provided to render the chart.";
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

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
        chartBackground: colorsConfig.background_color || '#252525', // Dark default
        textColor: colorsConfig.text_color || '#E0E0E0', // Light default for dark background
        gridLineColor: colorsConfig.other && colorsConfig.other.grid_line ? colorsConfig.other.grid_line : '#4F4F4F', // Subtle dark theme grid
        axisLineColor: colorsConfig.other && colorsConfig.other.axis_line ? colorsConfig.other.axis_line : '#8F8F8F', // Subtle dark theme axis
        defaultLineStrokeWidth: 2,
        defaultPointRadius: 4,
        getGroupColor: (groupName, index) => {
            if (colorsConfig.field && colorsConfig.field[groupName]) {
                return colorsConfig.field[groupName];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
            }
            return d3.schemeCategory10[index % d3.schemeCategory10.length]; // Fallback to D3 scheme
        },
        getGroupImage: (groupName) => {
            if (imagesConfig.field && imagesConfig.field[groupName]) {
                return imagesConfig.field[groupName];
            }
            if (imagesConfig.other && imagesConfig.other[groupName]) { // Check other as well, though less common for field-specific
                return imagesConfig.other[groupName];
            }
            return null;
        }
    };

    // Helper for text measurement (not strictly needed by placeLabelsDP as it uses grid units, but good practice)
    function estimateTextWidth(text, fontProps = {}) {
        const defaultFont = {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight,
            ...fontProps
        };
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', defaultFont.fontFamily);
        tempText.setAttribute('font-size', defaultFont.fontSize);
        tempText.setAttribute('font-weight', defaultFont.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM append.
        // This might be less accurate if not in DOM, but for estimation it's often acceptable.
        // For higher accuracy, a hidden live SVG element is better.
        // However, the prompt explicitly says "MUST NOT be appended to the document DOM".
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails (e.g. in some test environments)
            return text.length * (parseInt(defaultFont.fontSize) * 0.6);
        }
    }

    // Assuming X values are year strings like "2020", "2021", etc.
    // Modify if X data type is different (e.g. full dates, or numerical)
    const parseDate = d3.timeParse(xFieldRole.format || "%Y");


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
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 180, bottom: 60, left: 80 }; // Keep original margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartDataArray.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]), // Parse dates
        [yFieldName]: parseFloat(d[yFieldName]) // Ensure Y is numeric
    })).filter(d => d[xFieldName] !== null && !isNaN(d[yFieldName])); // Filter out invalid dates/numbers

    if (processedChartData.length === 0) {
        const errorMessage = "Data is empty or invalid after processing. Cannot render.";
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMessage}</div>`);
        return null;
    }
    
    const groups = [...new Set(processedChartData.map(d => d[groupFieldName]))].sort();
    const allXDateValues = processedChartData.map(d => d[xFieldName]).sort(d3.ascending);


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(allXDateValues))
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([
            Math.min(0, d3.min(processedChartData, d => d[yFieldName]) * 1.1 || 0),
            d3.max(processedChartData, d => d[yFieldName]) * 1.3 || 0
        ])
        .range([innerHeight, 0]);

    const xTicks = xScale.ticks(variables.x_axis_ticks || 7); // Sensible default for time ticks
    const xTickFormat = d3.timeFormat(xFieldRole.format_output || "%Y");

    const yTicks = yScale.ticks(variables.y_axis_ticks || 6);
    const filteredYTicks = yTicks.filter((d, i, arr) => i > 0 || (arr.length === 1 && d === 0)); // Keep 0 if it's the only tick, otherwise remove first if multiple


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const gridExtension = 5; // Original value

    // Horizontal Gridlines
    mainChartGroup.append("g")
        .attr("class", "gridlines y-gridlines")
        .selectAll("line.gridline")
        .data(filteredYTicks)
        .enter()
        .append("line")
        .attr("class", "gridline horizontal-gridline")
        .attr("x1", -gridExtension - 30)
        .attr("x2", innerWidth + gridExtension)
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "2,2");

    // Vertical Gridlines
    mainChartGroup.append("g")
        .attr("class", "gridlines x-gridlines")
        .selectAll("line.gridline")
        .data(xTicks)
        .enter()
        .append("line")
        .attr("class", "gridline vertical-gridline")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "2,2");

    // X-Axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).tickValues(xTicks).tickFormat(xTickFormat).tickSize(0).tickPadding(10));

    xAxisGroup.selectAll("text")
        .attr("class", "label x-axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("dy", "0.35em"); // Adjusted for better alignment

    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll(".tick line").remove();

    // Horizontal line for X-axis base
    mainChartGroup.append("line")
        .attr("class", "axis-line x-axis-line")
        .attr("x1", -20)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth + 20)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Y-Axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickValues(filteredYTicks).tickFormat(d => d3.format(variables.y_axis_format || "~s")(d)).tickSize(0).tickPadding(0));

    yAxisGroup.selectAll("text")
        .attr("class", "label y-axis-label")
        .attr("x", -gridExtension - 5) // Position based on original
        .attr("dy", -3) // Fine-tune vertical position
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "end");

    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll(".tick line").remove();

    // Y-Axis Title
    if (yFieldLabel) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title y-axis-title")
            .attr("transform", "rotate(-90)")
            .attr("y", -chartMargins.left + 20)
            .attr("x", -innerHeight / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(yFieldLabel);
    }
    
    // Vertical line at the end of X-axis data
    const lastXDate = allXDateValues[allXDateValues.length - 1];
    if (lastXDate) {
        mainChartGroup.append("line")
            .attr("class", "other end-marker-line")
            .attr("x1", xScale(lastXDate))
            .attr("y1", 0)
            .attr("x2", xScale(lastXDate))
            .attr("y2", innerHeight)
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);
    }
     // Y-axis line at x=0
    mainChartGroup.append("line")
        .attr("class", "axis-line y-axis-main-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .defined(d => d[xFieldName] != null && !isNaN(d[yFieldName])); // Handle missing points in a series

    const endPointsData = [];

    groups.forEach((group, i) => {
        const groupData = processedChartData.filter(d => d[groupFieldName] === group).sort((a, b) => d3.ascending(a[xFieldName], b[xFieldName]));
        const groupColor = fillStyle.getGroupColor(group, i);

        if (groupData.length > 0) {
            // Draw line
            mainChartGroup.append("path")
                .datum(groupData)
                .attr("class", "mark line series-line")
                .attr("fill", "none")
                .attr("stroke", groupColor)
                .attr("stroke-width", fillStyle.defaultLineStrokeWidth)
                .attr("d", lineGenerator);

            // Start point
            const firstPoint = groupData[0];
            mainChartGroup.append("circle")
                .attr("class", "mark point start-point")
                .attr("cx", xScale(firstPoint[xFieldName]))
                .attr("cy", yScale(firstPoint[yFieldName]))
                .attr("r", fillStyle.defaultPointRadius)
                .attr("fill", groupColor);

            // End point
            const lastPoint = groupData[groupData.length - 1];
            mainChartGroup.append("circle")
                .attr("class", "mark point end-point")
                .attr("cx", xScale(lastPoint[xFieldName]))
                .attr("cy", yScale(lastPoint[yFieldName]))
                .attr("r", fillStyle.defaultPointRadius)
                .attr("fill", groupColor);
            
            endPointsData.push({
                x: xScale(lastPoint[xFieldName]),
                y: yScale(lastPoint[yFieldName]),
                value: Math.round(lastPoint[yFieldName]),
                color: groupColor,
                group: group,
                imageUrl: fillStyle.getGroupImage(group)
            });
        }
    });

    // Block 9: Optional Enhancements & Post-Processing (Labels at line ends)
    
    // Simplified label placement. The DP algorithm is complex and its constants are tuned.
    // For this refactoring, using a simpler greedy approach or direct placement with offsets.
    // If placeLabelsDP is critical, it would need careful integration and testing.
    // Given simplification goals, a direct placement is chosen here.
    // The original placeLabelsDP is very involved; replacing with simpler logic for now.
    
    endPointsData.sort((a, b) => a.y - b.y); // Sort by Y for staggered placement if needed

    let lastLabelY = -Infinity;
    const labelPadding = 5; // Min vertical pixels between labels
    const labelLineHeight1 = parseInt(fillStyle.typography.annotationFontSize) * 1.2 || 12;
    const labelLineHeight2 = parseInt(fillStyle.typography.labelFontSize) * 1.2 || 14;


    endPointsData.forEach(point => {
        const labelGroup = mainChartGroup.append("g")
            .attr("class", "label data-label end-label")
            .attr("transform", `translate(${point.x + 10}, ${point.y})`); // Initial position, adjust below

        let currentY = point.y;
        // Basic collision avoidance: if currentY is too close to lastLabelY, shift down.
        if (currentY < lastLabelY + labelLineHeight1 + labelLineHeight2 + labelPadding) {
            currentY = lastLabelY + labelLineHeight1 + labelLineHeight2 + labelPadding;
        }
        // Ensure label doesn't go above chart top or too far below chart bottom
        currentY = Math.max(currentY, labelLineHeight1); // Enough space for first line
        currentY = Math.min(currentY, innerHeight - labelLineHeight2); // Enough space for second line from bottom

        labelGroup.attr("transform", `translate(${point.x + 10}, ${currentY})`);
        lastLabelY = currentY;


        const iconSize = 20;
        const textXOffset = point.imageUrl ? iconSize + 5 : 0;

        if (point.imageUrl) {
            labelGroup.append("image")
                .attr("class", "icon group-icon")
                .attr("x", 0)
                .attr("y", -iconSize / 2 - labelLineHeight1 / 2) // Center icon with first line of text
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", point.imageUrl);
        } else {
            labelGroup.append("circle")
                .attr("class", "icon group-icon-fallback")
                .attr("cx", iconSize / 4) // Smaller circle if no image
                .attr("cy", -labelLineHeight1 / 2) // Align with first text line center
                .attr("r", 3)
                .attr("fill", point.color);
        }

        // Group Name (smaller font)
        labelGroup.append("text")
            .attr("class", "text group-name-text")
            .attr("x", textXOffset)
            .attr("y", -labelLineHeight1 / 2) // First line, centered vertically
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily) // Use annotation for smaller text
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", point.color)
            .text(point.group);

        // Value (larger font)
        labelGroup.append("text")
            .attr("class", "text value-text")
            .attr("x", textXOffset)
            .attr("y", labelLineHeight2 / 2) // Second line, centered vertically
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold")
            .style("fill", point.color)
            .text(point.value);
    });


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}