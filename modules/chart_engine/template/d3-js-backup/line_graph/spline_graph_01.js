/* REQUIREMENTS_BEGIN
{
  "chart_type": "Line Chart",
  "chart_name": "spline_graph_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": [],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 50], [-1000, 1000], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is external)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // or data.colors_dark
    // const imagesConfig = data.images || {}; // Not used in this refactored version
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const getFieldByRole = (role) => {
        const column = dataColumns.find(col => col.role === role);
        return column ? column.name : undefined;
    };

    const xField = getFieldByRole("x");
    const yField = getFieldByRole("y");
    const groupField = getFieldByRole("group");

    const criticalFields = { x: xField, y: yField, group: groupField };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: Roles [${missingFields.join(', ')}] not found in dataColumns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    const yColumnLabel = (dataColumns.find(col => col.role === "y") || {}).name || yField;


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        textColor: colorsConfig.text_color || '#333333',
        axisLineColor: colorsConfig.other && colorsConfig.other.secondary ? colorsConfig.other.secondary : '#CCCCCC',
        lineColor: colorsConfig.other && colorsConfig.other.primary ? colorsConfig.other.primary : '#007bff',
        positiveAccentColor: (colorsConfig.other && colorsConfig.other.positive) || '#28a745', // Green for positive
        negativeAccentColor: (colorsConfig.other && colorsConfig.other.negative) || '#dc3545', // Red for negative
        markerFillColor: '#FFFFFF',
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
        }
    };
    
    // Specific style for Y-axis zero tick, derived from label typography but potentially overridden
    fillStyle.typography.yZeroTickFontSize = (typographyConfig.label && typographyConfig.label.font_size_large) || '14px'; // Example custom key
    fillStyle.typography.yZeroTickFontWeight = (typographyConfig.label && typographyConfig.label.font_weight_strong) || 'bold';


    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight = 'normal') => {
        if (!text) return 0;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        return context.measureText(text).width;
    };

    const wrapText = (text, maxWidth, fontFamily, fontSize, fontWeight) => {
        if (!text) return [];
        const words = text.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return [];
        
        let lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const prospectiveLine = currentLine + " " + word;
            if (estimateTextWidth(prospectiveLine, fontFamily, fontSize, fontWeight) > maxWidth) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = prospectiveLine;
            }
        }
        lines.push(currentLine);
        return lines;
    };
    
    const parseDate = (dateStr) => new Date(dateStr);

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
    const chartMargins = { top: 60, right: 50, bottom: 70, left: 70 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartDataInput.map(d => ({
        ...d,
        [xField]: parseDate(d[xField]), // Ensure xField is Date object
        [yField]: parseFloat(d[yField]) // Ensure yField is number
    })).filter(d => !isNaN(d[xField]) && !isNaN(d[yField]));


    const groupNames = [...new Set(processedChartData.map(d => d[groupField]))];
    if (groupNames.length < 2) {
        const errorMsg = "Insufficient groups for difference calculation. Need at least 2 groups.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }
    
    const group1Data = processedChartData.filter(d => d[groupField] === groupNames[0])
        .sort((a, b) => a[xField] - b[xField]);
    const group2Data = processedChartData.filter(d => d[groupField] === groupNames[1])
        .sort((a, b) => a[xField] - b[xField]);

    const diffData = [];
    group1Data.forEach(d1 => {
        const d2 = group2Data.find(item => item[xField].getTime() === d1[xField].getTime());
        if (d2) {
            diffData.push({
                [xField]: d1[xField],
                [yField]: d1[yField] - d2[yField] // Difference
            });
        }
    });

    if (diffData.length === 0) {
        const errorMsg = "No matching data points found between groups to calculate differences.";
         console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(diffData, d => d[xField]))
        .range([0, innerWidth]);

    const yMin = d3.min(diffData, d => d[yField]);
    const yMax = d3.max(diffData, d => d[yField]);
    const yPadding = Math.max(Math.abs(yMin), Math.abs(yMax)) * 0.15 || 5; // Ensure some padding

    const yScale = d3.scaleLinear()
        .domain([Math.min(0, yMin) - yPadding, Math.max(0, yMax) + yPadding])
        .range([innerHeight, 0]);
    
    // Ensure domain includes at least -5 to 5 if data is very small, and 0 is visible
    const currentYDomain = yScale.domain();
    yScale.domain([
        Math.min(currentYDomain[0], -5),
        Math.max(currentYDomain[1], 5)
    ]);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Custom Y-axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    const yTicks = yScale.ticks(10);

    yAxisGroup.append("line") // Vertical axis line
        .attr("class", "axis-line")
        .attr("x1", 0)
        .attr("y1", yScale(yTicks[yTicks.length-1]))
        .attr("x2", 0)
        .attr("y2", yScale(yTicks[0]))
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    yTicks.forEach(tick => {
        yAxisGroup.append("line") // Tick mark
            .attr("class", "tick-mark")
            .attr("x1", -5)
            .attr("y1", yScale(tick))
            .attr("x2", 0)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);

        yAxisGroup.append("text")
            .attr("class", "tick-label label")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", tick === 0 ? fillStyle.typography.yZeroTickFontSize : fillStyle.typography.labelFontSize)
            .style("font-weight", tick === 0 ? fillStyle.typography.yZeroTickFontWeight : fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(tick + (variables.yAxisUnit || "%"));
    });

    // Custom X-axis (labels at y=0 line)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${yScale(0)})`); // Position labels along the zero line

    const xNumTicks = Math.max(2, Math.min(10, Math.floor(innerWidth / 80))); // Dynamic number of ticks
    const xTicks = xScale.ticks(xNumTicks);
    const xTickFormat = xScale.tickFormat(xNumTicks, d3.timeFormat(variables.xAxisTimeFormat || "%Y-%m-%d")); // Configurable time format

    xTicks.forEach(tick => {
        xAxisGroup.append("text")
            .attr("class", "tick-label label")
            .attr("x", xScale(tick))
            .attr("y", parseFloat(fillStyle.typography.labelFontSize) + 5) // Offset below the zero line
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(xTickFormat(tick));
    });


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xField]))
        .y(d => yScale(d[yField]))
        .curve(d3.curveMonotoneX);

    mainChartGroup.append("path")
        .datum(diffData)
        .attr("class", "data-line mark")
        .attr("fill", "none")
        .attr("stroke", fillStyle.lineColor)
        .attr("stroke-width", 3)
        .attr("d", lineGenerator);

    // Block 9: Optional Enhancements & Post-Processing
    // Min/Max/Last point annotations
    const annotations = [];
    if (diffData.length > 0) {
        const maxPoint = diffData.reduce((max, p) => p[yField] > max[yField] ? p : max, diffData[0]);
        annotations.push({ point: maxPoint, type: 'max', color: fillStyle.positiveAccentColor, yOffset: -15 });

        const minPoint = diffData.reduce((min, p) => p[yField] < min[yField] ? p : min, diffData[0]);
        annotations.push({ point: minPoint, type: 'min', color: fillStyle.negativeAccentColor, yOffset: 20 });
        
        const lastPoint = diffData[diffData.length - 1];
        if (lastPoint !== maxPoint && lastPoint !== minPoint) {
             annotations.push({ point: lastPoint, type: 'last', color: lastPoint[yField] >= 0 ? fillStyle.positiveAccentColor : fillStyle.negativeAccentColor, yOffset: lastPoint[yField] >=0 ? -15 : 20 });
        }
    }
    
    const annotationGroup = mainChartGroup.append("g").attr("class", "annotations-group");

    annotations.forEach(ann => {
        annotationGroup.append("circle")
            .attr("class", `annotation-marker mark ${ann.type}-marker`)
            .attr("cx", xScale(ann.point[xField]))
            .attr("cy", yScale(ann.point[yField]))
            .attr("r", 6)
            .attr("fill", fillStyle.markerFillColor)
            .attr("stroke", ann.color)
            .attr("stroke-width", 2.5);

        annotationGroup.append("text")
            .attr("class", `annotation-label text ${ann.type}-label`)
            .attr("x", xScale(ann.point[xField]))
            .attr("y", yScale(ann.point[yField]) + ann.yOffset)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", ann.color)
            .text(Math.round(ann.point[yField]) + (variables.yAxisUnit || "%"));
    });

    // Descriptive texts (e.g., "Y-FIELD DIFFERENCE", "GroupA and GroupB")
    const titleTextGroup = mainChartGroup.append("g").attr("class", "title-text-group");
    const yLabelText = `${yColumnLabel} DIFFERENCE`.toUpperCase();
    const yLabelLines = wrapText(yLabelText, innerWidth * 0.3, fillStyle.typography.titleFontFamily, fillStyle.typography.titleFontSize, fillStyle.typography.titleFontWeight);
    
    yLabelLines.forEach((line, i) => {
        titleTextGroup.append("text")
            .attr("class", "chart-title-custom text")
            .attr("x", 0) 
            .attr("y", -chartMargins.top / 2 + i * (parseFloat(fillStyle.typography.titleFontSize) + 5) ) 
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", fillStyle.typography.titleFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .style("fill", fillStyle.textColor)
            .text(line);
    });

    const groupDescText = `${groupNames[0]} vs ${groupNames[1]}`;
    const groupDescLines = wrapText(groupDescText, innerWidth * 0.3, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
    
    groupDescLines.forEach((line, i) => {
        titleTextGroup.append("text")
            .attr("class", "chart-subtitle-custom text")
            .attr("x", 0)
            .attr("y", -chartMargins.top / 2 + yLabelLines.length * (parseFloat(fillStyle.typography.titleFontSize) + 5) + i * (parseFloat(fillStyle.typography.labelFontSize) + 3))
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(line);
    });

    // "Outperform" labels
    const outperformTextYPosition = -chartMargins.top / 2 + 5; // Align with title text area
    const outperformTextGroup = mainChartGroup.append("g").attr("class", "outperform-text-group");

    const outperformText1 = variables.positiveDifferenceLabel || `${groupNames[0]} outperforms ${groupNames[1]}`;
    outperformTextGroup.append("text")
        .attr("class", "outperform-positive text")
        .attr("x", innerWidth)
        .attr("y", outperformTextYPosition)
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.positiveAccentColor)
        .text(`(+) ${outperformText1}`);

    const outperformText2 = variables.negativeDifferenceLabel || `${groupNames[1]} outperforms ${groupNames[0]}`;
     outperformTextGroup.append("text")
        .attr("class", "outperform-negative text")
        .attr("x", innerWidth)
        .attr("y", outperformTextYPosition + parseFloat(fillStyle.typography.labelFontSize) + 5)
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.negativeAccentColor)
        .text(`(-) ${outperformText2}`);


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}