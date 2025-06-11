/* REQUIREMENTS_BEGIN
{
  "chart_type": "Line Chart",
  "chart_name": "spline_graph_plain_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 50], [-1000, 1000], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "accent1", "accent2"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {};
    const imagesInput = data.images || {}; // Extracted per spec, though not used in this simplified chart.
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const getFieldNameByRole = (role) => {
        const column = dataColumns.find(col => col.role === role);
        return column ? column.name : undefined;
    };

    const xFieldName = getFieldNameByRole("x");
    const yFieldName = getFieldNameByRole("y");
    const groupFieldName = getFieldNameByRole("group");

    const criticalFields = {
        xFieldName: xFieldName,
        yFieldName: yFieldName,
        groupFieldName: groupFieldName
    };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')} (roles: x, y, group). Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) || '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) || 'bold',
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
        },
        textColor: colorsInput.text_color || '#0f223b',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        axisLineColor: (colorsInput.other && colorsInput.other.axisLine) || '#CCCCCC',
        tickColor: (colorsInput.other && colorsInput.other.tickMark) || '#888888',
        primaryLineColor: (colorsInput.other && colorsInput.other.primary) || '#1f77b4',
        annotationPositiveColor: (colorsInput.other && colorsInput.other.accent1) || '#ef9522', // Original orange-ish
        annotationNegativeColor: (colorsInput.other && colorsInput.other.accent2) || '#9a8abe', // Original purple-ish
        annotationNeutralColor: (colorsInput.other && colorsInput.other.neutral) || '#666666',
        annotationPointFill: '#FFFFFF',
    };
    
    // Helper function for text measurement (not actively used in this refactored chart)
    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        // This function is included for compliance but not essential for this specific refactored chart
        // as complex text layouts requiring pre-measurement were removed.
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-weight', fontWeight || fillStyle.typography.labelFontWeight);
        textElement.setAttribute('font-size', fontSize || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-family', fontFamily || fillStyle.typography.labelFontFamily);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements fails
            const avgCharWidth = parseFloat(fontSize || fillStyle.typography.labelFontSize) * 0.6;
            width = text.length * avgCharWidth;
        }
        return width;
    }

    const parseDate = (dateStr) => {
        if (dateStr instanceof Date && !isNaN(dateStr)) return dateStr;
        let parsed = d3.timeParse("%Y")(String(dateStr)); // Handles "YYYY"
        if (parsed) return parsed;
        parsed = new Date(dateStr); // Handles ISO strings and other parsable date formats
        return isNaN(parsed) ? null : parsed;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root other"); // Added class

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 40, bottom: 50, left: 60 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other");

    // Block 5: Data Preprocessing & Transformation
    let chartData = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName]
    })).filter(d => d[xFieldName] !== null && !isNaN(d[yFieldName]));

    const groupNames = [...new Set(chartData.map(d => d[groupFieldName]))];
    if (groupNames.length < 2) {
        const msg = "Error: Insufficient distinct groups for difference calculation. Expected at least 2.";
        console.error(msg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${msg}</div>`);
        return null;
    }
    
    const group1Data = chartData.filter(d => d[groupFieldName] === groupNames[0])
                              .sort((a, b) => a[xFieldName] - b[xFieldName]);
    const group2Data = chartData.filter(d => d[groupFieldName] === groupNames[1])
                              .sort((a, b) => a[xFieldName] - b[xFieldName]);

    const diffData = [];
    group1Data.forEach(d1 => {
        const d2 = group2Data.find(item => item[xFieldName].getTime() === d1[xFieldName].getTime());
        if (d2) {
            diffData.push({
                [xFieldName]: d1[xFieldName],
                value: d1[yFieldName] - d2[yFieldName] 
            });
        }
    });
    
    if (diffData.length === 0) {
        const msg = "Error: No matching data points found between groups. Cannot render difference line.";
        console.error(msg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${msg}</div>`);
        return null;
    }
    diffData.sort((a,b) => a[xFieldName] - b[xFieldName]); // Ensure final diffData is sorted by date

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(diffData, d => d[xFieldName]))
        .range([0, innerWidth]);

    const yMin = d3.min(diffData, d => d.value);
    const yMax = d3.max(diffData, d => d.value);
    const yPadding = Math.max(Math.abs(yMin), Math.abs(yMax)) * 0.15;

    const yScale = d3.scaleLinear()
        .domain([
            Math.min(yMin - yPadding, -5), 
            Math.max(yMax + yPadding, 5)
        ])
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .attr("class", "axis x-axis")
        .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat("%Y")));

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(10).tickFormat(d => `${d}%`));

    [xAxisGroup, yAxisGroup].forEach(axis => {
        axis.selectAll("path.domain")
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);
        axis.selectAll("line") // Tick lines
            .attr("stroke", fillStyle.tickColor)
            .attr("stroke-width", 1);
        axis.selectAll("text")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight);
    });
    
    if (yScale.domain()[0] < 0 && yScale.domain()[1] > 0) { // Check if zero is in domain
        mainChartGroup.append("line")
            .attr("class", "zero-line other")
            .attr("x1", 0)
            .attr("x2", innerWidth)
            .attr("y1", yScale(0))
            .attr("y2", yScale(0))
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,2");
    }

    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX);

    mainChartGroup.append("path")
        .datum(diffData)
        .attr("class", "mark line data-line")
        .attr("fill", "none")
        .attr("stroke", fillStyle.primaryLineColor)
        .attr("stroke-width", 3)
        .attr("d", lineGenerator);

    // Block 9: Optional Enhancements & Post-Processing
    const annotationsGroup = mainChartGroup.append("g")
        .attr("class", "annotations-group other");

    const pointsToAnnotate = [];
    if (diffData.length > 0) {
        const maxPoint = diffData.reduce((max, p) => p.value > max.value ? p : max, diffData[0]);
        pointsToAnnotate.push({ ...maxPoint, type: 'max' });

        const minPoint = diffData.reduce((min, p) => p.value < min.value ? p : min, diffData[0]);
        if (!(minPoint[xFieldName].getTime() === maxPoint[xFieldName].getTime() && minPoint.value === maxPoint.value)) {
             pointsToAnnotate.push({ ...minPoint, type: 'min' });
        }

        const lastPoint = diffData[diffData.length - 1];
        if (!pointsToAnnotate.some(p => p[xFieldName].getTime() === lastPoint[xFieldName].getTime() && p.value === lastPoint.value)) {
            pointsToAnnotate.push({ ...lastPoint, type: 'last' });
        }
    }
    
    pointsToAnnotate.forEach(point => {
        const pointX = xScale(point[xFieldName]);
        const pointY = yScale(point.value);
        let color, yTextOffset, dominantBaseline;

        if (point.type === 'max') {
            color = fillStyle.annotationPositiveColor;
            yTextOffset = -15; 
            dominantBaseline = "alphabetic";
        } else if (point.type === 'min') {
            color = fillStyle.annotationNegativeColor;
            yTextOffset = 15;
            dominantBaseline = "hanging";
        } else { // 'last' point
            color = point.value >= 0 ? fillStyle.annotationPositiveColor : fillStyle.annotationNegativeColor;
            // Position last point label to avoid overlap if possible, default below
            yTextOffset = (point.value >=0 && Math.abs(point.value - maxPoint.value) < (yScale.domain()[1] - yScale.domain()[0])*0.05 && point[xFieldName].getTime() === maxPoint[xFieldName].getTime()) ? 15 : -15; // if last is max, put below
            if (point.value < 0 && Math.abs(point.value - minPoint.value) < (yScale.domain()[1] - yScale.domain()[0])*0.05 && point[xFieldName].getTime() === minPoint[xFieldName].getTime()) yTextOffset = -15; // if last is min, put above
            dominantBaseline = yTextOffset < 0 ? "alphabetic" : "hanging";
             if (point.value === 0) color = fillStyle.annotationNeutralColor;
        }
        
        annotationsGroup.append("circle")
            .attr("class", "mark annotation-point")
            .attr("cx", pointX)
            .attr("cy", pointY)
            .attr("r", 6)
            .attr("fill", fillStyle.annotationPointFill)
            .attr("stroke", color)
            .attr("stroke-width", 2.5);

        annotationsGroup.append("text")
            .attr("class", "label annotation-text")
            .attr("x", pointX)
            .attr("y", pointY + yTextOffset)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", dominantBaseline)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", color)
            .text(`${Math.round(point.value)}%`);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}