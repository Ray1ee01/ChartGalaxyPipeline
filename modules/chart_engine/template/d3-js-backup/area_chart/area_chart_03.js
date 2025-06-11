/* REQUIREMENTS_BEGIN
{
  "chart_type": "Area Chart",
  "chart_name": "area_chart_03",
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
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */



// Block 0: Metadata & Other Function-Level Comments
// The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

function makeChart(containerSelector, data) {
    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // data.colors_dark for dark themes
    const images = data.images || {}; // Extracted per spec, though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);

    if (!xFieldDef || !xFieldDef.name) {
        const errorMsg = "Critical chart config missing: X-axis field definition (role='x'). Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }
    if (!yFieldDef || !yFieldDef.name) {
        const errorMsg = "Critical chart config missing: Y-axis field definition (role='y'). Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldDef.name;
    const yFieldName = yFieldDef.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        areaPrimary: (colors.other && colors.other.primary) ? colors.other.primary : '#c62828',
        gridLineColor: (colors.other && colors.other.gridLine) ? colors.other.gridLine : '#e0e0e0',
        axisTextColor: (colors.other && colors.other.axisText) ? colors.other.axisText : (colors.text_color || '#666666'),
        dataLabelTextColor: (colors.other && colors.other.dataLabelText) ? colors.other.dataLabelText : '#FFFFFF',
        chartBackground: colors.background_color || '#FFFFFF',
        alternateBackgroundStripe: (colors.other && colors.other.backgroundStripe) ? colors.other.backgroundStripe : '#ececec',
        textColor: colors.text_color || '#0f223b',
    };
    fillStyle.dataLabelBackgroundColor = fillStyle.areaPrimary; // Derived

    fillStyle.typography = {
        axisLabelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
        axisLabelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
        axisLabelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
        dataLabelFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
        dataLabelFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '12px',
        dataLabelFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'bold',
    };

    function estimateTextWidth(text, fontSize, fontFamily, fontWeight = 'normal') {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            const numFontSize = parseFloat(fontSize) || 12;
            width = text.length * (numFontSize * 0.6); // Rough estimate
            // console.warn("getBBox failed for unattached SVG, using rough estimate.", e);
        }
        return width;
    }

    function parseDate(dateString) {
        if (dateString instanceof Date && !isNaN(dateString)) {
            return dateString;
        }
        const d = new Date(dateString);
        if (!isNaN(d.getTime())) {
            return d;
        }
        return null;
    }

    function temporalFilter(inputData, dateField) {
        if (!inputData || inputData.length === 0) return [];
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        return inputData
            .map(d => {
                const parsed = parseDate(d[dateField]);
                return parsed ? { ...d, [dateField]: parsed } : null;
            })
            .filter(d => d && d[dateField] >= oneYearAgo)
            .sort((a, b) => a[dateField] - b[dateField]);
    }

    function createXAxisScaleAndTicks(data, dateField, rangeMin, rangeMax) {
        const dates = data.map(d => d[dateField]).filter(d => d instanceof Date && !isNaN(d));
        
        if (dates.length === 0) {
            const now = new Date();
            const fallbackScale = d3.scaleTime().domain([now, d3.timeDay.offset(now, 1)]).range([rangeMin, rangeMax]).nice();
            return { xScale: fallbackScale, xTicks: fallbackScale.ticks(d3.timeDay.every(1)), xFormat: d3.timeFormat("%b %d"), timeSpanDays: 1 };
        }

        const extent = d3.extent(dates);
        const timeSpanDays = Math.max(0, (extent[1].getTime() - extent[0].getTime()) / (1000 * 60 * 60 * 24));

        let tickInterval, xFormat;

        if (timeSpanDays < 1/24) { // Less than an hour, effectively single point or very short span
             tickInterval = d3.timeMinute.every(15);
             xFormat = d3.timeFormat("%H:%M");
        } else if (timeSpanDays <= 1) { 
            tickInterval = d3.timeHour.every(Math.max(1, Math.floor(timeSpanDays * 24 / 6)));
            xFormat = d3.timeFormat("%H:%M");
        } else if (timeSpanDays <= 7) { 
            tickInterval = d3.timeDay.every(1);
            xFormat = d3.timeFormat("%a %d");
        } else if (timeSpanDays <= 30 * 3) { 
            tickInterval = d3.timeMonday.every(Math.max(1, Math.floor(timeSpanDays / 7 / 6)));
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 365 * 2) { 
            tickInterval = d3.timeMonth.every(Math.max(1, Math.floor(timeSpanDays / 30 / 6)));
            xFormat = d3.timeFormat("%b '%y");
        } else { 
            tickInterval = d3.timeYear.every(Math.max(1, Math.floor(timeSpanDays / 365 / 6)));
            xFormat = d3.timeFormat("%Y");
        }
        
        const xScale = d3.scaleTime().domain(extent).range([rangeMin, rangeMax]).nice();
        let xTicks = xScale.ticks(tickInterval);
        if (xTicks.length === 0 && dates.length > 0) { 
            xTicks = [dates[0]];
            if (dates.length > 1) xTicks.push(dates[dates.length-1]);
            xTicks = [...new Set(xTicks.map(d => d.getTime()))].map(t => new Date(t)).sort((a,b) => a-b); // Unique sorted
        }
        if (xTicks.length === 1 && dates.length > 1) { // If only one tick but range exists
             xTicks = [extent[0], extent[1]]; // Show start and end
        }


        return { xScale, xTicks, xFormat, timeSpanDays };
    }

    function createNumericalFormatter(data, valueField) {
        const values = data.map(d => d[valueField]).filter(v => typeof v === 'number' && isFinite(v));
        if (values.length === 0) return (val) => `${val}`;

        const maxValAbs = d3.max(values.map(v => Math.abs(v)));

        if (maxValAbs >= 1000000) return d3.format(".2s");
        else if (maxValAbs >= 1000) return d3.format(".2s");
        else if (maxValAbs > 0 && maxValAbs < 0.01) return d3.format(".2e");
        else if (maxValAbs < 10) return d3.format(".2f"); // More precision for small numbers
        else return d3.format(".1f");
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
        .attr("class", "chart-svg-root area-chart");

    const chartMargins = { top: 30, right: 30, bottom: 50, left: 60 }; // Adjusted for labels

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const xAxisLabelAreaHeight = 30; // For background stripe extension

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    let chartDataArray = temporalFilter(rawChartData, xFieldName);
    
    chartDataArray = chartDataArray.filter(d => 
        d[xFieldName] instanceof Date && !isNaN(d[xFieldName]) && 
        typeof d[yFieldName] === 'number' && isFinite(d[yFieldName])
    );

    if (chartDataArray.length < 2) {
        const msg = chartDataArray.length === 0 ? "No valid data available for the selected period." : "Not enough data to draw an area chart (minimum 2 points required).";
        mainChartGroup.append("text")
            .attr("class", "label message-text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .attr("fill", fillStyle.textColor)
            .text(msg);
        return svgRoot.node();
    }

    const numericalFormatter = createNumericalFormatter(chartDataArray, yFieldName);

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartDataArray, xFieldName, 0, innerWidth);

    const yMin = d3.min(chartDataArray, d => d[yFieldName]);
    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    
    const yPaddingRatio = 0.1;
    let yDomainMin = yMin - (yMax - yMin) * yPaddingRatio;
    let yDomainMax = yMax + (yMax - yMin) * yPaddingRatio;

    if (yMin === yMax) {
        yDomainMin = yMin - Math.abs(yMin * yPaddingRatio || 1); 
        yDomainMax = yMax + Math.abs(yMax * yPaddingRatio || 1);
    }
    if (yDomainMin === yDomainMax) { // Still equal (e.g. yMin=0, yMax=0)
        yDomainMin -= 1;
        yDomainMax +=1;
    }
    
    // Original logic: Math.max(0, yMin - yPadding). This keeps that spirit if data is non-negative.
    if (yMin >= 0) {
      yDomainMin = Math.max(0, yDomainMin);
    }


    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const yAxisTicks = yScale.ticks(5);
    const topYTickValue = yAxisTicks.length > 0 ? yAxisTicks[yAxisTicks.length - 1] : (yScale.domain()[1]);
    const topYTickPosition = yScale(topYTickValue);

    // Alternating background stripes
    const backgroundStripesGroup = mainChartGroup.append("g").attr("class", "background-stripes");
    for (let i = 0; i < xTicks.length; i++) {
        const currentTickDate = xTicks[i];
        const currentX = xScale(currentTickDate);
        const prevX = i > 0 ? xScale(xTicks[i-1]) : 0;
        const nextX = i < xTicks.length - 1 ? xScale(xTicks[i+1]) : innerWidth;
        
        const bandLeftX = (i === 0 && xTicks.length > 1) ? 0 : (prevX + currentX) / 2;
        const bandRightX = (i === xTicks.length - 1 && xTicks.length > 1) ? innerWidth : (currentX + nextX) / 2;
        if(xTicks.length === 1) { // Single tick, full width
            bandLeftX = 0;
            bandRightX = innerWidth;
        }
        const bandWidth = bandRightX - bandLeftX;

        if (i % 2 === 0 && bandWidth > 0) {
            backgroundStripesGroup.append("rect")
                .attr("class", "background-stripe")
                .attr("x", bandLeftX)
                .attr("y", topYTickPosition) 
                .attr("width", bandWidth)
                .attr("height", innerHeight - topYTickPosition + xAxisLabelAreaHeight)
                .attr("fill", fillStyle.alternateBackgroundStripe);
        }
    }
    if (backgroundStripesGroup.node()) backgroundStripesGroup.lower();


    // Horizontal gridlines
    const gridLinesGroup = mainChartGroup.append("g").attr("class", "gridlines horizontal-gridlines");
    yAxisTicks.forEach(tick => {
        gridLinesGroup.append("line")
            .attr("class", "gridline horizontal")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", innerWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,2");
    });

    // X-axis labels
    const xAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis x-axis labels");
    xTicks.forEach(tick => {
        xAxisLabelsGroup.append("text")
            .attr("class", "label x-axis-label")
            .attr("x", xScale(tick))
            .attr("y", innerHeight + chartMargins.bottom / 2.5) 
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .attr("fill", fillStyle.axisTextColor)
            .text(xFormat(tick));
    });

    // Y-axis labels
    const yAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis y-axis labels");
    yScale.ticks(5).forEach(tick => {
        yAxisLabelsGroup.append("text")
            .attr("class", "label y-axis-label")
            .attr("x", -chartMargins.left / 8) 
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .attr("fill", fillStyle.axisTextColor)
            .text(numericalFormatter(tick));
    });

    // Block 8: Main Data Visualization Rendering
    const areaGenerator = d3.area()
        .x(d => xScale(d[xFieldName]))
        .y0(innerHeight)
        .y1(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveLinear);

    mainChartGroup.append("path")
        .datum(chartDataArray)
        .attr("class", "mark area")
        .attr("fill", fillStyle.areaPrimary)
        // No fill-opacity for "solid colors only"
        .attr("d", areaGenerator);

    mainChartGroup.append("path")
        .datum(chartDataArray)
        .attr("class", "mark line")
        .attr("fill", "none")
        .attr("stroke", fillStyle.areaPrimary) // Line color same as area for solid appearance
        .attr("stroke-width", 3)
        .attr("d", lineGenerator);

    // Block 9: Optional Enhancements & Post-Processing (Annotations)
    const keyPoints = [];
    if (chartDataArray.length > 0) {
        const firstPoint = chartDataArray[0];
        const lastPoint = chartDataArray[chartDataArray.length - 1];
        
        let lowestPoint = chartDataArray[0];
        chartDataArray.forEach(p => {
            if (p[yFieldName] < lowestPoint[yFieldName]) lowestPoint = p;
        });
        
        keyPoints.push({ point: firstPoint, type: 'first', isHighestLabel: true });
        // Only add last point if distinct from first (for single data point charts)
        if (chartDataArray.length > 1 || firstPoint[xFieldName].getTime() !== lastPoint[xFieldName].getTime() || firstPoint[yFieldName] !== lastPoint[yFieldName]) {
            keyPoints.push({ point: lastPoint, type: 'last', isHighestLabel: true });
        }
        
        if (lowestPoint !== firstPoint && lowestPoint !== lastPoint) {
            const lowIndex = chartDataArray.indexOf(lowestPoint);
            const isValley = (lowIndex > 0 && chartDataArray[lowIndex-1][yFieldName] > lowestPoint[yFieldName]) &&
                             (lowIndex < chartDataArray.length - 1 && chartDataArray[lowIndex+1][yFieldName] > lowestPoint[yFieldName]);
            if(isValley || chartDataArray.length <=3) {
                 keyPoints.push({ point: lowestPoint, type: 'lowest', isHighestLabel: false });
            }
        }
    }
    
    const dataLabelsGroup = mainChartGroup.append("g").attr("class", "data-labels-group");

    keyPoints.forEach(kp => {
        const pointData = kp.point;
        const xPos = xScale(pointData[xFieldName]);
        const yPos = yScale(pointData[yFieldName]);
        const displayText = numericalFormatter(pointData[yFieldName]);

        const textEstWidth = estimateTextWidth(
            displayText, 
            fillStyle.typography.dataLabelFontSize, 
            fillStyle.typography.dataLabelFontFamily, 
            fillStyle.typography.dataLabelFontWeight
        );

        let labelWidth = Math.max(45, textEstWidth + 16); // Padding for text
        const labelHeight = 25;
        const labelRx = 4;
        const pointerSize = 5; 
        const labelGap = 5;

        let labelX = xPos - labelWidth / 2;
        let labelY, pointerPath;
        let currentLabelIsHighest = kp.isHighestLabel;


        function setLabelPosition(isHigh) {
            if (isHigh) { 
                labelY = yPos - pointerSize - labelHeight - labelGap;
                pointerPath = `M${xPos},${yPos - labelGap} L${xPos - pointerSize},${yPos - pointerSize - labelGap} L${xPos + pointerSize},${yPos - pointerSize - labelGap} Z`;
            } else { 
                labelY = yPos + pointerSize + labelGap;
                pointerPath = `M${xPos},${yPos + labelGap} L${xPos - pointerSize},${yPos + pointerSize + labelGap} L${xPos + pointerSize},${yPos + pointerSize + labelGap} Z`;
            }
        }
        setLabelPosition(currentLabelIsHighest);
        
        if (labelX < 0) labelX = 0;
        if (labelX + labelWidth > innerWidth) labelX = innerWidth - labelWidth;
        
        if (currentLabelIsHighest && labelY < 0) { // Flip if off top
            setLabelPosition(false); 
        } else if (!currentLabelIsHighest && labelY + labelHeight > innerHeight) { // Flip if off bottom
            setLabelPosition(true);
        }


        const singleLabelGroup = dataLabelsGroup.append("g").attr("class", `data-label ${kp.type}-label`);

        singleLabelGroup.append("rect")
            .attr("class", "mark data-label-background")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("width", labelWidth)
            .attr("height", labelHeight)
            .attr("rx", labelRx)
            .attr("ry", labelRx)
            .attr("fill", fillStyle.dataLabelBackgroundColor);

        singleLabelGroup.append("path")
            .attr("class", "mark data-label-pointer")
            .attr("d", pointerPath)
            .attr("fill", fillStyle.dataLabelBackgroundColor);

        singleLabelGroup.append("text")
            .attr("class", "text data-label-text")
            .attr("x", labelX + labelWidth / 2) 
            .attr("y", labelY + labelHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.dataLabelFontFamily)
            .style("font-size", fillStyle.typography.dataLabelFontSize)
            .style("font-weight", fillStyle.typography.dataLabelFontWeight)
            .attr("fill", fillStyle.dataLabelTextColor)
            .text(displayText);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}