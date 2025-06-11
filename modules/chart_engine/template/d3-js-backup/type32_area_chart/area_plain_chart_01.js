/* REQUIREMENTS_BEGIN
{
  "chart_type": "Area Chart",
  "chart_name": "area_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["temporal"], ["numerical"]],
  "required_fields_range": [[5, 30], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is now external to the function)

    // Block 1: Configuration Parsing & Validation
    const chartRawData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || data.colors || {};
    // const imagesConfig = data.images || {}; // Not used in this chart

    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');

    if (!xFieldConfig || !xFieldConfig.name) {
        console.error("Critical chart config missing: X-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: X-axis field name not configured.</div>");
        return null;
    }
    if (!yFieldConfig || !yFieldConfig.name) {
        console.error("Critical chart config missing: Y-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: Y-axis field name not configured.</div>");
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title && typographyConfig.title.font_family ? typographyConfig.title.font_family : 'Arial, sans-serif',
            titleFontSize: typographyConfig.title && typographyConfig.title.font_size ? typographyConfig.title.font_size : '16px',
            titleFontWeight: typographyConfig.title && typographyConfig.title.font_weight ? typographyConfig.title.font_weight : 'bold',
            labelFontFamily: typographyConfig.label && typographyConfig.label.font_family ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: typographyConfig.label && typographyConfig.label.font_size ? typographyConfig.label.font_size : '12px',
            labelFontWeight: typographyConfig.label && typographyConfig.label.font_weight ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: typographyConfig.annotation && typographyConfig.annotation.font_family ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation && typographyConfig.annotation.font_size ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: typographyConfig.annotation && typographyConfig.annotation.font_weight ? typographyConfig.annotation.font_weight : 'normal',
        },
        primaryColor: colorsConfig.other && colorsConfig.other.primary ? colorsConfig.other.primary : "#a67eb7",
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        textColor: colorsConfig.text_color || '#0f223b',
        axisTextColor: colorsConfig.text_color || '#555555', // Darker gray for better contrast on white
        labelBackgroundColor: colorsConfig.other && colorsConfig.other.primary ? colorsConfig.other.primary : "#a67eb7",
        labelTextColor: '#FFFFFF', // White text on primary color background
    };
    
    // Area fill: use primaryColor with opacity, assuming "solid color" allows RGBA.
    // This simplifies the original gradient to a transparent solid color.
    const areaBaseColor = d3.color(fillStyle.primaryColor);
    fillStyle.areaFillColor = areaBaseColor ? areaBaseColor.copy(c => { c.opacity = 0.3; return c; }).toString() : 'rgba(166,126,183,0.3)';
    fillStyle.lineStrokeColor = fillStyle.primaryColor;

    const estimateTextWidth = (text, fontSize, fontFamily) => {
        if (!text || text.length === 0) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        const svgEl = document.createElementNS(svgNS, 'svg');
        const textEl = document.createElementNS(svgNS, 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.textContent = text;
        svgEl.appendChild(textEl); 
        // Note: svgEl is not appended to the document, as per directive.
        try {
            return textEl.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM.
            return text.length * (parseFloat(fontSize) || 12) * 0.6; 
        }
    };

    const parseDateValue = (dateStr) => new Date(dateStr);

    const numericalFormatter = (value) => {
        if (value === null || value === undefined || isNaN(value)) return "N/A";
        if (Math.abs(value) >= 1e6) return d3.format(".2s")(value);
        if (Math.abs(value) >= 1e3 && Math.abs(value) < 1e6) return d3.format(",.0f")(value);
        return d3.format(".1f")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    // Using original margins to preserve visual proportions as much as possible.
    const chartMargins = { top: 120, right: 30, bottom: 120, left: 60 }; 
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    let chartData = chartRawData.map(d => {
        const xVal = d[xFieldName];
        const yVal = d[yFieldName];
        return {
            ...d, // Keep other fields if any
            [xFieldName]: xVal !== null && xVal !== undefined ? parseDateValue(xVal) : null,
            [yFieldName]: yVal !== null && yVal !== undefined ? +yVal : null,
        };
    }).filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]) && d[yFieldName] !== null && !isNaN(d[yFieldName]));


    if (chartData.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .attr("class", "text empty-chart-message")
            .text("No valid data available to display.");
        return svgRoot.node();
    }
    
    chartData.sort((a, b) => a[xFieldName] - b[xFieldName]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(chartData, d => d[xFieldName]))
        .range([0, innerWidth]);

    const yMax = d3.max(chartData, d => d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([0, (yMax || 0) * 1.4])
        .range([innerHeight, 0])
        .nice();

    const xTicks = xScale.ticks(Math.min(chartData.length > 1 ? 7 : 1, 7)); // Aim for up to 7 ticks, or 1 if single data point
    const xTickFormat = xScale.tickFormat(null, "%b %d"); // Example format: "Jan 01"

    const tickDataForLabels = xTicks.map(tick => {
        const tickTime = tick.getTime();
        let leftPoint = null;
        let rightPoint = null;

        for (let i = 0; i < chartData.length - 1; i++) {
            const currDate = chartData[i][xFieldName].getTime();
            const nextDate = chartData[i + 1][xFieldName].getTime();
            if (currDate <= tickTime && tickTime <= nextDate) {
                leftPoint = { time: currDate, value: chartData[i][yFieldName] };
                rightPoint = { time: nextDate, value: chartData[i + 1][yFieldName] };
                break;
            }
        }

        if (leftPoint && rightPoint) {
            if (rightPoint.time === leftPoint.time) {
                 return { xValue: tick, yValue: leftPoint.value };
            }
            const ratio = (tickTime - leftPoint.time) / (rightPoint.time - leftPoint.time);
            const interpolatedValue = leftPoint.value + (rightPoint.value - leftPoint.value) * ratio;
            return { xValue: tick, yValue: interpolatedValue };
        }
        
        const closestPoint = chartData.reduce((prev, curr) => 
            Math.abs(curr[xFieldName].getTime() - tickTime) < Math.abs(prev[xFieldName].getTime() - tickTime) ? curr : prev
        );
        return { xValue: tick, yValue: closestPoint[yFieldName] };
    });

    // Block 7: Chart Component Rendering (Axes)
    const xAxis = d3.axisBottom(xScale)
        .tickValues(xTicks)
        .tickFormat(xTickFormat);
        
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .attr("class", "axis x-axis")
        .call(xAxis);

    xAxisGroup.selectAll("text")
        .attr("class", "text axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("fill", fillStyle.axisTextColor);

    xAxisGroup.selectAll(".domain, .tick line") // Select both domain line and tick lines
        .attr("class", (d, i, nodes) => d3.select(nodes[i]).attr('class') + " other axis-line") // Append to existing D3 classes
        .style("stroke", fillStyle.axisTextColor);


    // Block 8: Main Data Visualization Rendering
    const areaGenerator = d3.area()
        .x(d => xScale(d[xFieldName]))
        .y0(innerHeight)
        .y1(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    mainChartGroup.append("path")
        .datum(chartData)
        .attr("fill", fillStyle.areaFillColor)
        .attr("d", areaGenerator)
        .attr("class", "mark area-mark");

    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    mainChartGroup.append("path")
        .datum(chartData)
        .attr("fill", "none")
        .attr("stroke", fillStyle.lineStrokeColor)
        .attr("stroke-width", 3)
        .attr("d", lineGenerator)
        .attr("class", "mark line-mark");

    // Block 9: Optional Enhancements & Post-Processing (Data Labels)
    let validLabelIndexes = [];
    let prevLabelX = -Infinity;
    const minLabelSpacing = 60; // Min horizontal pixels between labels

    const firstDataXPos = chartData.length > 0 ? xScale(chartData[0][xFieldName]) : -Infinity;
    const lastDataXPos = chartData.length > 0 ? xScale(chartData[chartData.length - 1][xFieldName]) : Infinity;

    tickDataForLabels.forEach((d, i) => {
        const xPos = xScale(d.xValue);
        
        // Ensure label is for a tick within or very near the actual data range
        if (xPos < firstDataXPos && i !== 0 && Math.abs(xPos - firstDataXPos) > 1) return; 
        if (xPos > lastDataXPos && i !== tickDataForLabels.length - 1 && Math.abs(xPos - lastDataXPos) > 1) return;

        if (xPos - prevLabelX >= minLabelSpacing || i === 0) { // Always show first label if possible
            validLabelIndexes.push(i);
            prevLabelX = xPos;
        } else if (i === tickDataForLabels.length - 1) { 
            if (validLabelIndexes.length > 0 && xPos - xScale(tickDataForLabels[validLabelIndexes[validLabelIndexes.length-1]].xValue) < minLabelSpacing) {
                validLabelIndexes.pop(); 
            }
            validLabelIndexes.push(i);
            prevLabelX = xPos;
        }
    });
    
    const labelGroup = mainChartGroup.append("g").attr("class", "data-labels-group");

    tickDataForLabels.forEach((d, i) => {
        if (!validLabelIndexes.includes(i) || d.yValue === null || isNaN(d.yValue)) {
            return;
        }

        const x = xScale(d.xValue);
        const y = yScale(d.yValue);
        const labelText = numericalFormatter(d.yValue);
        
        const textEstimatedWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontFamily);
        const labelPaddingHorizontal = 8; // Reduced padding slightly
        const labelRectWidth = textEstimatedWidth + 2 * labelPaddingHorizontal;
        const labelRectHeight = (parseFloat(fillStyle.typography.labelFontSize) * 1.4) + (2 * 3); // font-size + vertical padding
        const borderRadius = 4;
        const triangleSize = 7;
        const labelYOffset = -12; // How far above the point the triangle points

        const rectY = y + labelYOffset - triangleSize - labelRectHeight;
        const rectX = x - labelRectWidth / 2;

        labelGroup.append("rect")
            .attr("x", rectX)
            .attr("y", rectY)
            .attr("width", labelRectWidth)
            .attr("height", labelRectHeight)
            .attr("rx", borderRadius)
            .attr("ry", borderRadius)
            .attr("fill", fillStyle.labelBackgroundColor)
            .attr("class", "other data-label-background");

        labelGroup.append("text")
            .attr("x", x)
            .attr("y", rectY + labelRectHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.labelTextColor)
            .text(labelText)
            .attr("class", "text data-label");
        
        const trianglePoints = [
            [x - triangleSize / 2, rectY + labelRectHeight],
            [x + triangleSize / 2, rectY + labelRectHeight],
            [x, rectY + labelRectHeight + triangleSize]
        ];
        
        labelGroup.append("path")
            .attr("d", `M${trianglePoints.map(p => p.join(',')).join('L')}`)
            .attr("fill", fillStyle.labelBackgroundColor)
            .attr("class", "other data-label-pointer");
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}