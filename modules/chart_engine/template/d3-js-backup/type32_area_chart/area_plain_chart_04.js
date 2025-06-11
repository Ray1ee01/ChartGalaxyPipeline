/* REQUIREMENTS_BEGIN
{
  "chart_type": "Area Chart",
  "chart_name": "area_plain_chart_04",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["temporal"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Could be data.colors_dark for dark themes, adapt if needed
    const imagesConfig = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');

    if (!xFieldConfig || !yFieldConfig) {
        const missing = [];
        if (!xFieldConfig) missing.push("x field configuration (role: 'x')");
        if (!yFieldConfig) missing.push("y field configuration (role: 'y')");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const yFieldUnit = yFieldConfig.unit === 'none' ? '' : yFieldConfig.unit;

    if (chartDataArray.length === 0) {
        console.warn("Chart data is empty. Cannot render.");
        d3.select(containerSelector).html("<div style='color:orange; font-family: sans-serif;'>Chart data is empty.</div>");
        return null;
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
        },
        textColor: colorsConfig.text_color || '#0f223b',
        chartBackground: colorsConfig.background_color || '#FFFFFF', // Not directly used to set SVG bg, but available
        areaFillColor: (colorsConfig.other && colorsConfig.other.primary) || '#35356e',
        lineStrokeColor: (colorsConfig.other && colorsConfig.other.secondary) || '#e63946',
        dataPointFillColor: (colorsConfig.other && colorsConfig.other.secondary) || '#e63946', // Same as line for consistency
        xAxisLineColor: '#9191a9',
        xAxisTickLabelColor: '#2a2e7a', // A specific dark blue from original
        dataLabelValueColor: (colorsConfig.other && colorsConfig.other.secondary) || '#e63946',
        dataLabelTimeLightColor: '#FFFFFF', // For labels on dark area
        dataLabelTimeDarkColor: (colorsConfig.other && colorsConfig.other.primary) || '#35356e', // For labels on light background
    };

    function parseDate(dateStr) {
        if (dateStr instanceof Date && !isNaN(dateStr)) return dateStr;
        const parsed = new Date(dateStr); // Assumes ISO 8601 or other parsable formats
        return !isNaN(parsed) ? parsed : null;
    }

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.setAttribute('width', '0'); // Set to 0,0 to ensure it's not accidentally visible
        tempSvg.setAttribute('height', '0');
        tempSvg.style.position = 'absolute'; // Further ensure it's out of flow
        
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        
        tempSvg.appendChild(textElement);
        // Document must contain the SVG for getBBox to work reliably in all browsers.
        // However, prompt says "MUST NOT be appended to the document DOM".
        // This is a known issue. Some browsers might return 0.
        // If this fails, a pre-rendered hidden SVG in the main container is an alternative.
        // For now, adhering strictly to the "no append" rule.
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth: getBBox failed, possibly due to non-rendered SVG. Falling back to approximation.", e);
            // Fallback: crude approximation based on character count and font size
            const fontSizePx = parseFloat(fontProps.fontSize || fillStyle.typography.labelFontSize);
            width = text.length * fontSizePx * 0.6; // Very rough estimate
        }
        return width;
    }
    
    function getSampleLabelIndices(data, yValField, maxLabels = 5) {
        if (!data || data.length === 0) return [];
        if (data.length <= maxLabels) {
            return data.map((_, i) => i);
        }
        const indices = new Set();
        indices.add(0); 
        indices.add(data.length - 1);

        let maxVal = -Infinity;
        let maxIdx = -1;
        data.forEach((d, i) => {
            if (d[yValField] > maxVal) {
                maxVal = d[yValField];
                maxIdx = i;
            }
        });
        if (maxIdx !== -1) {
            indices.add(maxIdx);
        }

        const remainingSlots = maxLabels - indices.size;
        if (remainingSlots > 0 && data.length > maxLabels) { // Ensure data.length is greater to avoid issues with small arrays
            const step = Math.max(1, Math.floor((data.length -1) / (remainingSlots + 1))); // Ensure step is at least 1
            for (let i = 1; i <= remainingSlots; i++) {
                const potentialIndex = i * step;
                if(potentialIndex < data.length -1) { // Ensure we don't re-add last element or go out of bounds
                   indices.add(potentialIndex);
                }
            }
        }
        return Array.from(indices).sort((a, b) => a - b);
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Optional: set SVG background

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 40, bottom: 80, left: 40 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    chartDataArray = chartDataArray.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]), // Parse dates
        [yFieldName]: +d[yFieldName] // Ensure y is numeric
    })).filter(d => d[xFieldName] !== null && !isNaN(d[yFieldName])); // Filter out invalid data

    if (chartDataArray.length < 2) { // Area/line charts need at least 2 points
        console.warn("Insufficient valid data points (<2) after processing. Cannot render chart.");
        d3.select(containerSelector).html("<div style='color:orange; font-family: sans-serif;'>Insufficient valid data points to draw the chart.</div>");
        return null;
    }
    
    chartDataArray.sort((a, b) => a[xFieldName] - b[xFieldName]); // Sort by date

    const maxDataPoint = chartDataArray.reduce((max, current) => 
        current[yFieldName] > max[yFieldName] ? current : max, chartDataArray[0]
    );
    
    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(chartDataArray, d => d[xFieldName]))
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => d[yFieldName]) * 1.1]) // Add some padding to max Y
        .range([innerHeight, 0]);

    let xTickFormat;
    const timeDomain = xScale.domain();
    if (timeDomain[0] && timeDomain[1]) {
        const timeDiff = timeDomain[1].getTime() - timeDomain[0].getTime();
        const oneDay = 24 * 60 * 60 * 1000;
        const oneMonth = 30 * oneDay; // Approximate
        const oneYear = 365 * oneDay; // Approximate

        if (timeDiff < 2 * oneDay) xTickFormat = d3.timeFormat("%H:%M");
        else if (timeDiff < 2 * oneMonth) xTickFormat = d3.timeFormat("%b %d");
        else if (timeDiff < 2 * oneYear) xTickFormat = d3.timeFormat("%b '%y"); // Short year
        else xTickFormat = d3.timeFormat("%Y");
    } else {
        xTickFormat = d3.timeFormat("%Y-%m-%d"); // Default fallback
    }
    
    const xTicks = xScale.ticks(Math.max(2, Math.floor(innerWidth / 100))); // Adjust tick count by width

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    xAxisGroup.append("line")
        .attr("class", "axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", innerWidth)
        .attr("y2", 0)
        .attr("stroke", fillStyle.xAxisLineColor)
        .attr("stroke-width", 1.5);

    xTicks.forEach(tickValue => {
        const tickGroup = xAxisGroup.append("g")
            .attr("class", "tick")
            .attr("transform", `translate(${xScale(tickValue)}, 0)`);

        tickGroup.append("line")
            .attr("class", "tick-line")
            .attr("y1", 0)
            .attr("y2", -5) // Short tick lines
            .attr("stroke", fillStyle.xAxisLineColor) // Use axis line color for ticks too
            .attr("stroke-width", 1);

        tickGroup.append("text")
            .attr("class", "label tick-label")
            .attr("y", 15) // Position below axis line
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.xAxisTickLabelColor)
            .text(xTickFormat(tickValue));
    });

    // Block 8: Main Data Visualization Rendering
    const areaGenerator = d3.area()
        .x(d => xScale(d[xFieldName]))
        .y0(innerHeight)
        .y1(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    mainChartGroup.append("path")
        .datum(chartDataArray)
        .attr("class", "mark area")
        .attr("fill", fillStyle.areaFillColor)
        .attr("d", areaGenerator);

    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    mainChartGroup.append("path")
        .datum(chartDataArray)
        .attr("class", "mark line")
        .attr("fill", "none")
        .attr("stroke", fillStyle.lineStrokeColor)
        .attr("stroke-width", 2)
        .attr("d", lineGenerator);

    // Block 9: Optional Enhancements & Post-Processing (Data Points and Labels)
    const dataPointsGroup = mainChartGroup.append("g").attr("class", "data-points");
    const dataLabelsGroup = mainChartGroup.append("g").attr("class", "data-labels");

    // Label placement grid logic
    const gridSize = 5; // 5 pixels per grid cell
    const gridWidth = Math.ceil(innerWidth / gridSize);
    const gridHeight = Math.ceil(innerHeight / gridSize);
    const occupiedGrid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(false));

    // Mark line path on grid
    const linePathPoints = [];
    for (let i = 0; i < chartDataArray.length - 1; i++) {
        const p1 = chartDataArray[i];
        const p2 = chartDataArray[i+1];
        const x1 = xScale(p1[xFieldName]), y1 = yScale(p1[yFieldName]);
        const x2 = xScale(p2[xFieldName]), y2 = yScale(p2[yFieldName]);
        linePathPoints.push({x: x1, y: y1});
        if (i === chartDataArray.length - 2) linePathPoints.push({x:x2, y:y2});

        const steps = Math.max(Math.ceil(Math.abs(x2 - x1) / gridSize), Math.ceil(Math.abs(y2 - y1) / gridSize));
        if (steps > 0) { // Avoid division by zero if steps is 0
            for (let step = 0; step <= steps; step++) {
                const ratio = step / steps;
                const x = x1 + (x2 - x1) * ratio;
                const y = y1 + (y2 - y1) * ratio;
                const gx = Math.floor(x / gridSize);
                const gy = Math.floor(y / gridSize);
                if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
                    occupiedGrid[gy][gx] = true;
                }
            }
        }
    }
    
    // Define label box size in grid units (approx 40px wide, 25px high)
    const labelGridWidth = Math.ceil(estimateTextWidth("00.0%", {fontSize: fillStyle.typography.labelFontSize}) / gridSize) + 2; // Estimate width + padding
    const labelGridHeight = Math.ceil((parseFloat(fillStyle.typography.labelFontSize) + parseFloat(fillStyle.typography.annotationFontSize)) / gridSize) + 2; // Two lines of text + padding

    const sampleLabelIndices = getSampleLabelIndices(chartDataArray, yFieldName, chartConfig.maxLabels || 5);

    chartDataArray.forEach((d, index) => {
        const cx = xScale(d[xFieldName]);
        const cy = yScale(d[yFieldName]);
        const isHighestPoint = d[xFieldName] === maxDataPoint[xFieldName] && d[yFieldName] === maxDataPoint[yFieldName];

        if (isHighestPoint) {
            const starSize = 8;
            const starPoints = [];
            for (let i = 0; i < 5; i++) {
                starPoints.push([
                    cx + starSize * Math.cos((Math.PI * 2 * i) / 5 - Math.PI / 2),
                    cy + starSize * Math.sin((Math.PI * 2 * i) / 5 - Math.PI / 2)
                ]);
                starPoints.push([
                    cx + starSize * 0.4 * Math.cos((Math.PI * 2 * i + Math.PI) / 5 - Math.PI / 2),
                    cy + starSize * 0.4 * Math.sin((Math.PI * 2 * i + Math.PI) / 5 - Math.PI / 2)
                ]);
            }
            dataPointsGroup.append("path")
                .attr("class", "mark point star")
                .attr("d", "M" + starPoints.map(p => p.join(",")).join("L") + "Z")
                .attr("fill", fillStyle.dataPointFillColor);
        } else {
            dataPointsGroup.append("circle")
                .attr("class", "mark point circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", 3)
                .attr("fill", fillStyle.dataPointFillColor);
        }

        if (!sampleLabelIndices.includes(index)) return;

        const pointGridX = Math.floor(cx / gridSize);
        const pointGridY = Math.floor(cy / gridSize);
        let bestLabelX = -1, bestLabelY = -1, minDistanceSq = Infinity;
        const searchRadiusGrid = 20; // Search radius in grid units

        for (let gy = Math.max(0, pointGridY - searchRadiusGrid); gy < Math.min(gridHeight - labelGridHeight, pointGridY + searchRadiusGrid); gy++) {
            for (let gx = Math.max(0, pointGridX - searchRadiusGrid); gx < Math.min(gridWidth - labelGridWidth, pointGridX + searchRadiusGrid); gx++) {
                let canPlace = true;
                for (let r = 0; r < labelGridHeight; r++) {
                    for (let c = 0; c < labelGridWidth; c++) {
                        if (occupiedGrid[gy + r][gx + c]) {
                            canPlace = false; break;
                        }
                    }
                    if (!canPlace) break;
                }

                if (canPlace) {
                    const distSq = Math.pow(gx + labelGridWidth / 2 - pointGridX, 2) + Math.pow(gy + labelGridHeight / 2 - pointGridY, 2);
                    if (distSq < minDistanceSq) {
                        minDistanceSq = distSq;
                        bestLabelX = gx;
                        bestLabelY = gy;
                    }
                }
            }
        }
        
        if (bestLabelX >= 0 && bestLabelY >= 0) {
            for (let r = 0; r < labelGridHeight; r++) {
                for (let c = 0; c < labelGridWidth; c++) {
                    occupiedGrid[bestLabelY + r][bestLabelX + c] = true;
                }
            }

            const finalLabelX = bestLabelX * gridSize;
            const finalLabelY = bestLabelY * gridSize;
            const labelCenterX = finalLabelX + (labelGridWidth * gridSize) / 2;
            const labelCenterY = finalLabelY + (labelGridHeight * gridSize) / 2;

            let isBelowLine = false;
            let closestSegmentLineY = null;
            for (let i = 0; i < linePathPoints.length - 1; i++) {
                const p1 = linePathPoints[i];
                const p2 = linePathPoints[i+1];
                if ((p1.x <= labelCenterX && p2.x >= labelCenterX) || (p2.x <= labelCenterX && p1.x >= labelCenterX)) {
                    if (p2.x === p1.x) { // Vertical segment
                        closestSegmentLineY = (p1.y + p2.y) / 2; // Or check if labelCenterX is on the segment
                    } else {
                        const ratio = (labelCenterX - p1.x) / (p2.x - p1.x);
                        closestSegmentLineY = p1.y + ratio * (p2.y - p1.y);
                    }
                    break;
                }
            }
            if (closestSegmentLineY !== null && labelCenterY > closestSegmentLineY) {
                isBelowLine = true;
            }
            
            const timeLabelColor = isBelowLine ? fillStyle.dataLabelTimeLightColor : fillStyle.dataLabelTimeDarkColor;
            const valueText = `${d[yFieldName]}${yFieldUnit}`;
            const timeText = xTickFormat(d[xFieldName]); // Use same format as axis for consistency

            const labelGroup = dataLabelsGroup.append("g")
                .attr("class", "label data-label")
                .attr("transform", `translate(${finalLabelX + (labelGridWidth * gridSize / 2)}, ${finalLabelY + (labelGridHeight * gridSize / 2)})`);
            
            // Value label
            labelGroup.append("text")
                .attr("class", "value")
                .attr("x", 0)
                .attr("y", -parseFloat(fillStyle.typography.annotationFontSize) / 2) // Position first line
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", isHighestPoint ? (parseFloat(fillStyle.typography.labelFontSize) * 1.2) + 'px' : fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.dataLabelValueColor)
                .text(valueText);

            // Time label
            labelGroup.append("text")
                .attr("class", "text time-period")
                .attr("x", 0)
                .attr("y", parseFloat(fillStyle.typography.labelFontSize) / 2) // Position second line
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", timeLabelColor)
                .text(timeText);
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}