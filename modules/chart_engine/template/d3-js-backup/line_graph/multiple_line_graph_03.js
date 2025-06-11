/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Line Graph",
  "chart_name": "multiple_line_graph_03",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 3]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 800,
  "background": "dark",

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
    // This chart displays multiple time series lines with labels at the start and end of each line.
    // Label placement uses a dynamic programming approach to minimize overlaps.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || {}; // Using dark theme colors as per original
    const imagesConfig = data.images || {}; // Parsed but not used in this chart
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getFieldNameByRole = (role) => {
        const column = dataColumns.find(col => col.role === role);
        return column ? column.name : null;
    };

    const xFieldName = getFieldNameByRole(xFieldRole);
    const yFieldName = getFieldNameByRole(yFieldRole);
    const groupFieldName = getFieldNameByRole(groupFieldRole);

    const yAxisDescription = (dataColumns.find(col => col.role === yFieldRole)?.description) || "";


    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? xFieldRole : null,
            !yFieldName ? yFieldRole : null,
            !groupFieldName ? groupFieldRole : null
        ].filter(Boolean).join(', ');
        const errorMsg = `Critical chart config missing: data field(s) for role(s) '${missingFields}'. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" },
        data_value: { font_family: "Arial, sans-serif", font_size: "18px", font_weight: "bold" }
    };

    const defaultColors = {
        field: {},
        other: {
            primary: "#3498db", // Default primary for lines
            yAxisTick: '#6bc7c5',
            xAxisTick: '#e8f6fa',
            xAxisBaseLine: '#e8f6fa',
            yAxisLabel: '#6bc7c5',
            gridLine: 'rgba(200, 200, 200, 0.2)'
        },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        background_color: "#1e1e1e",
        text_color: "#e0e0e0"
    };

    const fillStyle = {
        typography: {
            labelFontFamily: typographyConfig.label?.font_family || defaultTypography.label.font_family,
            labelFontSize: typographyConfig.label?.font_size || defaultTypography.label.font_size,
            labelFontWeight: typographyConfig.label?.font_weight || defaultTypography.label.font_weight,
            dataValueFontFamily: typographyConfig.data_value?.font_family || defaultTypography.data_value.font_family,
            dataValueFontSize: typographyConfig.data_value?.font_size || defaultTypography.data_value.font_size,
            dataValueFontWeight: typographyConfig.data_value?.font_weight || defaultTypography.data_value.font_weight,
        },
        chartBackground: colorsConfig.background_color || defaultColors.background_color,
        textColor: colorsConfig.text_color || defaultColors.text_color,
        yAxisTickColor: colorsConfig.other?.yAxisTick || defaultColors.other.yAxisTick,
        xAxisTickColor: colorsConfig.other?.xAxisTick || defaultColors.other.xAxisTick,
        xAxisBaseLineColor: colorsConfig.other?.xAxisBaseLine || defaultColors.other.xAxisBaseLine,
        yAxisLabelColor: colorsConfig.other?.yAxisLabel || defaultColors.other.yAxisLabel,
        gridLineColor: colorsConfig.other?.gridLine || defaultColors.other.gridLine,
        getLineColor: (group, index) => {
            const fieldColors = colorsConfig.field || defaultColors.field;
            const availableColors = colorsConfig.available_colors || defaultColors.available_colors;
            const primaryColor = colorsConfig.other?.primary || defaultColors.other.primary;

            return fieldColors[group] || availableColors[index % availableColors.length] || primaryColor;
        }
    };

    function estimateTextWidth(text, fontSize, fontFamily, fontWeight = 'normal') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // No need to append to DOM for getBBox if attributes are set
        // document.body.appendChild(svg); // Not appending to DOM
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might not work without DOM attachment
            // This is a rough estimate
            width = text.length * (parseFloat(fontSize) * 0.6);
            console.warn("estimateTextWidth: getBBox failed, using rough estimate.", e);
        }
        // svg.remove(); // Not needed as it was not appended
        return width;
    }

    // Date parser - assuming common ISO-like date strings (e.g., "YYYY-MM-DD")
    // Adjust format if data uses a different date string format.
    const parseDate = d3.timeParse("%Y-%m-%d"); // Example, adjust as needed

    // Dynamic programming label placement algorithm (from original code, adapted for styling)
    function placeLabelsDP(points, avoidYPositions = [], innerHeight) {
        const GRID_SIZE = 3;
        const PROTECTION_RADIUS = 3;
        const LABEL_HEIGHT_GRID_UNITS = Math.ceil(parseFloat(fillStyle.typography.dataValueFontSize) / GRID_SIZE) + 2; // Approx label height in grid units + padding

        const minY = 0;
        const maxY = innerHeight;
        const gridCount = Math.ceil((maxY - minY) / GRID_SIZE);

        points.sort((a, b) => a.y - b.y);

        const occupied = new Array(gridCount).fill(false);

        points.forEach(point => {
            const gridY = Math.floor(point.y / GRID_SIZE);
            for (let i = Math.max(0, gridY - PROTECTION_RADIUS); i <= Math.min(gridCount - 1, gridY + PROTECTION_RADIUS); i++) {
                occupied[i] = true;
            }
        });

        avoidYPositions.forEach(yPos => {
            const gridY = Math.floor(yPos / GRID_SIZE);
            for (let i = Math.max(0, gridY - PROTECTION_RADIUS); i <= Math.min(gridCount - 1, gridY + PROTECTION_RADIUS); i++) {
                occupied[i] = true;
            }
        });

        const n = points.length;
        if (n === 0) return [];
        
        const dp = Array(n).fill(null).map(() => Array(gridCount).fill(Infinity));
        const prev = Array(n).fill(null).map(() => Array(gridCount).fill(-1));

        const firstPointGridY = Math.floor(points[0].y / GRID_SIZE);

        for (let j = 0; j < gridCount; j++) {
            if (!occupied[j] && j + LABEL_HEIGHT_GRID_UNITS <= gridCount) {
                let canPlace = true;
                for (let k = 0; k < LABEL_HEIGHT_GRID_UNITS; k++) {
                    if (j + k < gridCount && occupied[j + k]) {
                        canPlace = false;
                        break;
                    }
                }
                if (n > 1) {
                    const nextPointGridY = Math.floor(points[1].y / GRID_SIZE);
                    if (j > nextPointGridY) {
                        canPlace = false;
                    }
                }
                if (canPlace) {
                    const cost = Math.abs(j - firstPointGridY);
                    dp[0][j] = cost;
                }
            }
        }

        for (let i = 1; i < n; i++) {
            const pointGridY = Math.floor(points[i].y / GRID_SIZE);
            for (let j = 0; j < gridCount; j++) {
                if (!occupied[j] && j + LABEL_HEIGHT_GRID_UNITS <= gridCount) {
                    let canPlace = true;
                    for (let k = 0; k < LABEL_HEIGHT_GRID_UNITS; k++) {
                        if (j + k < gridCount && occupied[j + k]) {
                            canPlace = false;
                            break;
                        }
                    }
                    if (i < n - 1) {
                        const nextPointGridY = Math.floor(points[i+1].y / GRID_SIZE);
                        if (j > nextPointGridY) {
                            canPlace = false;
                        }
                    }
                    if (i > 0) {
                        const prevPointGridY = Math.floor(points[i-1].y / GRID_SIZE);
                         if (j < prevPointGridY && j + LABEL_HEIGHT_GRID_UNITS < prevPointGridY) { // Allow some overlap if necessary
                            // Heuristic: if label is small enough and doesn't extend too far back
                           // canPlace = false; 
                        }
                    }
                    if (canPlace) {
                        for (let k = 0; k + LABEL_HEIGHT_GRID_UNITS <= j; k++) {
                            if (dp[i-1][k] !== Infinity) {
                                const curCost = Math.abs(j - pointGridY);
                                const totalCost = dp[i-1][k] + curCost;
                                if (totalCost < dp[i][j]) {
                                    dp[i][j] = totalCost;
                                    prev[i][j] = k;
                                }
                            }
                        }
                    }
                }
            }
        }

        let minCost = Infinity;
        let bestPos = -1;
        for (let j = 0; j < gridCount; j++) {
            if (dp[n-1][j] < minCost) {
                minCost = dp[n-1][j];
                bestPos = j;
            }
        }

        const labelPositions = [];
        if (bestPos !== -1) {
            let pos = bestPos;
            for (let i = n - 1; i >= 0; i--) {
                labelPositions.unshift({ point: points[i], labelY: pos * GRID_SIZE });
                if (i > 0) { // Check if pos is valid for prev[i]
                     pos = prev[i][pos];
                     if (pos === -1 || pos === undefined) { // Fallback if path broken
                        // console.warn("DP path broken, using fallback for earlier points.");
                        // Simple fallback for remaining points
                        for (let k = i - 1; k >= 0; k--) {
                            labelPositions.unshift({ point: points[k], labelY: points[k].y + 20 });
                        }
                        break;
                     }
                }
            }
        } else { // Fallback if no solution from DP
            let lastY = 0;
            for (let i = 0; i < n; i++) {
                const point = points[i];
                let maxYPos = innerHeight;
                if (i < n - 1) maxYPos = points[i+1].y;
                const labelY = Math.min(Math.max(point.y + 20, lastY + parseFloat(fillStyle.typography.dataValueFontSize) + 5), maxYPos - 5);
                labelPositions.push({ point: point, labelY: labelY });
                lastY = labelY;
            }
        }
        return labelPositions;
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root-svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 180, bottom: 60, left: 80 }; // Original margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]), // Parse date string to Date object
        [yFieldName]: parseFloat(d[yFieldName]) // Ensure Y value is numeric
    })).filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]) && !isNaN(d[yFieldName]));

    if (processedChartData.length === 0) {
        const errorMsg = "No valid data available after processing. Cannot render chart.";
        console.error(errorMsg);
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("fill", "red")
            .text(errorMsg);
        return svgRoot.node();
    }
    
    const groups = [...new Set(processedChartData.map(d => d[groupFieldName]))].sort();

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(processedChartData, d => d[xFieldName]))
        .range([0, innerWidth]);

    const yMin = d3.min(processedChartData, d => d[yFieldName]);
    const yMax = d3.max(processedChartData, d => d[yFieldName]);

    const yScale = d3.scaleLinear()
        .domain([
            Math.min(0, yMin * 1.1), // Original logic: include 0 or extend slightly below min
            yMax * 1.3 // Original logic: extend 30% above max
        ])
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const gridExtension = 20; // Original extension for Y-axis grid/ticks

    // Y-axis Ticks and Gridlines
    const yTicks = yScale.ticks(6); // Original tick count suggestion
    const filteredYTicks = yTicks.filter(d => d > (yTicks[0] !== undefined ? yTicks[0] : yScale.domain()[0])); // Remove smallest tick if it's the very bottom

    const yAxisGridGroup = mainChartGroup.append("g").attr("class", "grid y-grid");
    yAxisGridGroup.selectAll("line.grid-line-y")
        .data(filteredYTicks)
        .enter()
        .append("line")
        .attr("class", "grid-line grid-line-y")
        .attr("x1", -gridExtension)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    // X-axis Ticks and Gridlines
    const xTicks = xScale.ticks(); // Let D3 decide X ticks for time scale

    const xAxisGridGroup = mainChartGroup.append("g").attr("class", "grid x-grid");
    xAxisGridGroup.selectAll("line.grid-line-x")
        .data(xTicks)
        .enter()
        .append("line")
        .attr("class", "grid-line grid-line-x")
        .attr("x1", d => xScale(d))
        .attr("y1", 0)
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight + 10) // Original extension
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    // X-axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .attr("class", "axis x-axis")
        .call(d3.axisBottom(xScale).tickValues(xTicks)); // Use generated xTicks

    xAxisGroup.selectAll("text")
        .attr("class", "label axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.xAxisTickColor)
        .attr("dy", "1.5em"); // Original offset

    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll(".tick line").remove();

    // X-axis base line (original custom line)
    mainChartGroup.append("line")
        .attr("class", "axis-baseline x-axis-baseline")
        .attr("x1", -gridExtension) // Original extension
        .attr("y1", innerHeight + 40) // Original position
        .attr("x2", innerWidth + gridExtension) // Original extension
        .attr("y2", innerHeight + 40)
        .attr("stroke", fillStyle.xAxisBaseLineColor)
        .attr("stroke-width", 1);

    // Y-axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).tickValues(filteredYTicks).tickSize(0));

    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll(".tick line").remove();

    yAxisGroup.selectAll(".tick text")
        .attr("class", "label axis-label")
        .attr("x", -gridExtension - 5) // Original position
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.yAxisTickColor)
        .style("text-anchor", "end")
        .text(d => d); // Format if needed, original was direct value

    // Y-axis Description (Label)
    if (yAxisDescription) {
        const yAxisLabelX = -chartMargins.left / 2 + 5; // Original position
        const yAxisLabelY = yScale(yTicks[yTicks.length -1] !== undefined ? yTicks[yTicks.length -1] : yScale.domain()[1]) - 30; // Above highest tick

        const words = yAxisDescription.split(' ');
        let textLines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const testLine = currentLine + ' ' + words[i];
            const testWidth = estimateTextWidth(testLine, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontFamily);
            if (testWidth <= (chartMargins.left - 20)) { // Max width for label
                currentLine = testLine;
            } else {
                textLines.push(currentLine);
                currentLine = words[i];
            }
        }
        textLines.push(currentLine);

        textLines.forEach((line, i) => {
            mainChartGroup.append("text")
                .attr("class", "label axis-description y-axis-description")
                .attr("x", yAxisLabelX)
                .attr("y", yAxisLabelY + i * (parseFloat(fillStyle.typography.labelFontSize) * 1.2)) // Line height based on font size
                .attr("text-anchor", "start") // Original anchor
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.yAxisLabelColor)
                .text(line);
        });
    }

    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]));

    const startPoints = [];
    const endPoints = [];

    groups.forEach((group, groupIndex) => {
        const groupData = processedChartData.filter(d => d[groupFieldName] === group)
                                       .sort((a, b) => a[xFieldName] - b[xFieldName]); // Ensure data is sorted by date for lines

        if (groupData.length === 0) return;

        const lineColor = fillStyle.getLineColor(group, groupIndex);

        // Draw line
        mainChartGroup.append("path")
            .datum(groupData)
            .attr("class", "mark line")
            .attr("fill", "none")
            .attr("stroke", lineColor)
            .attr("stroke-width", 4) // Original stroke width
            .attr("d", lineGenerator);

        // Start and end points circles
        const firstPoint = groupData[0];
        const lastPoint = groupData[groupData.length - 1];

        const startX = xScale(firstPoint[xFieldName]);
        const startY = yScale(firstPoint[yFieldName]);
        mainChartGroup.append("circle")
            .attr("class", "mark point start-point")
            .attr("cx", startX)
            .attr("cy", startY)
            .attr("r", 4) // Original radius
            .attr("fill", lineColor);
        startPoints.push({ x: startX, y: startY, value: Math.round(firstPoint[yFieldName]), color: lineColor, group: group });

        const endX = xScale(lastPoint[xFieldName]);
        const endY = yScale(lastPoint[yFieldName]);
        mainChartGroup.append("circle")
            .attr("class", "mark point end-point")
            .attr("cx", endX)
            .attr("cy", endY)
            .attr("r", 4) // Original radius
            .attr("fill", lineColor);
        endPoints.push({ x: endX, y: endY, value: Math.round(lastPoint[yFieldName]), color: lineColor, group: group });
    });

    // Block 9: Optional Enhancements & Post-Processing (Data Labels)
    const yTickPositions = filteredYTicks.map(tick => yScale(tick));
    const startLabelPlacements = placeLabelsDP(startPoints, yTickPositions, innerHeight);
    const endLabelPlacements = placeLabelsDP(endPoints, [], innerHeight); // End points don't need to avoid Y ticks as strictly

    startLabelPlacements.forEach(placement => {
        const { point, labelY } = placement;
        mainChartGroup.append("text")
            .attr("class", "label data-label value start-label")
            .attr("x", point.x - 10) // Original offset, adjusted from -20 to -10 for better centering with text-anchor end
            .attr("y", labelY)
            .attr("text-anchor", "end") // Changed from middle to end for -10 offset
            .attr("dominant-baseline", "hanging")
            .style("font-family", fillStyle.typography.dataValueFontFamily)
            .style("font-size", fillStyle.typography.dataValueFontSize)
            .style("font-weight", fillStyle.typography.dataValueFontWeight)
            .style("fill", point.color)
            .text(point.value);
    });

    endLabelPlacements.forEach(placement => {
        const { point, labelY } = placement;
        mainChartGroup.append("text")
            .attr("class", "label data-label value group-label end-label")
            .attr("x", point.x + 10) // Original offset
            .attr("y", labelY)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "hanging")
            .style("font-family", fillStyle.typography.dataValueFontFamily)
            .style("font-size", fillStyle.typography.dataValueFontSize)
            .style("font-weight", fillStyle.typography.dataValueFontWeight)
            .style("fill", point.color)
            .text(point.value + " " + point.group);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}