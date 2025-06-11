/* REQUIREMENTS_BEGIN
{
  "chart_type": "Diverging Spline Area Chart",
  "chart_name": "diverging_spline_area_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This chart displays diverging areas for two groups along a vertical time axis.
    // It's designed for comparing trends of two categories over time.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    
    const userTypography = data.typography || {};
    // Use data.colors, fallback to data.colors_dark, then to {}
    const userColors = data.colors || data.colors_dark || {}; 
    // Images are not used in this chart, so data.images is ignored.

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    let missingFieldsMessages = [];
    if (!xFieldCol) missingFieldsMessages.push("x role column");
    if (!yFieldCol) missingFieldsMessages.push("y role column");
    if (!groupFieldCol) missingFieldsMessages.push("group role column");

    if (missingFieldsMessages.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFieldsMessages.join(", ")} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const groupFieldName = groupFieldCol.name;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const errorMsg = `Critical chart config missing: Field names for roles x ('${xFieldName}'), y ('${yFieldName}'), or group ('${groupFieldName}') are invalid. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }
    
    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (userTypography.title && userTypography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (userTypography.title && userTypography.title.font_size) || '16px',
            titleFontWeight: (userTypography.title && userTypography.title.font_weight) || 'bold',
            labelFontFamily: (userTypography.label && userTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (userTypography.label && userTypography.label.font_size) || '12px',
            labelFontWeight: (userTypography.label && userTypography.label.font_weight) || 'normal',
            annotationFontFamily: (userTypography.annotation && userTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (userTypography.annotation && userTypography.annotation.font_size) || '10px',
            annotationFontWeight: (userTypography.annotation && userTypography.annotation.font_weight) || 'normal',
        },
        textColor: userColors.text_color || '#333333',
        backgroundColor: userColors.background_color || '#FFFFFF',
        axisLineColor: userColors.text_color || '#333333', 
        defaultCategoryColors: d3.schemeCategory10, // Fallback color scheme
        getCategoryColor: (groupName, index) => {
            if (userColors.field && userColors.field[groupName]) {
                return userColors.field[groupName];
            }
            if (userColors.available_colors && userColors.available_colors.length > 0) {
                return userColors.available_colors[index % userColors.available_colors.length];
            }
            return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
        }
    };

    const parseDate = d => {
        if (d instanceof Date) return d;
        if (typeof d === 'number' && d > 999 && d < 3000) return new Date(d, 0, 1); // Assume it's a year
        if (typeof d === 'string') {
            const parts = d.split('-');
            if (parts.length === 1 && /^\d{4}$/.test(parts[0])) return new Date(+parts[0], 0, 1); // YYYY
            if (parts.length === 2) return new Date(+parts[0], +parts[1] - 1, 1); // YYYY-MM
            if (parts.length >= 3) { // YYYY-MM-DD potentially with T HH:MM:SS
                 const dayAndTime = parts[2].split(/[T\s]/); // Split DD from HH:MM:SS
                 const day = +dayAndTime[0];
                 let hours = 0, minutes = 0, seconds = 0;
                 if (dayAndTime.length > 1 && dayAndTime[1]) { // Check if time part exists
                     const timeParts = dayAndTime[1].split(':');
                     hours = +timeParts[0] || 0;
                     minutes = timeParts.length > 1 ? +timeParts[1] : 0;
                     seconds = timeParts.length > 2 ? +timeParts[2] : 0;
                 }
                 return new Date(+parts[0], +parts[1] - 1, day, hours, minutes, seconds);
            }
        }
        return new Date(0); // Fallback for unparsable dates
    };

    const estimateTextWidth = (text, fontProps) => {
        const tempSvgForEstimation = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // Do not append to DOM: tempSvgForEstimation.style.visibility = 'hidden'; document.body.appendChild(tempSvgForEstimation);
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textNode.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textNode.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textNode.textContent = text;
        tempSvgForEstimation.appendChild(textNode);
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM (e.g. JSDOM without layout)
            const fontSizePx = parseFloat(fontProps.fontSize || fillStyle.typography.labelFontSize);
            width = text.length * fontSizePx * 0.6; // Rough approximation
        }
        // if (tempSvgForEstimation.parentNode) tempSvgForEstimation.parentNode.removeChild(tempSvgForEstimation);
        return width;
    };
    
    const createXAxisScaleAndTicks = (data, xField, rangeStart, rangeEnd, padding = 0.05) => {
        const dates = data.map(d => parseDate(d[xField]));
        const [minD, maxD] = d3.extent(dates);

        if (minD === undefined || maxD === undefined || +minD === +maxD && data.length <=1) { // Handle empty, single point, or invalid date data
            const fallbackDate = (minD instanceof Date && !isNaN(minD)) ? minD : new Date();
            const xScale = d3.scaleTime().domain([fallbackDate, fallbackDate]).range([rangeStart, rangeEnd]);
            const xTicks = (minD instanceof Date && !isNaN(minD)) ? [minD] : [];
            const xFormat = d => (d instanceof Date && !isNaN(d)) ? d3.timeFormat("%Y-%m-%d")(d) : "";
            return { xScale, xTicks, xFormat, timeSpan: { days: 0, months: 0, years: 0 } };
        }
        
        const span = +maxD - +minD;
        const daySpan = span / 86400000;
        const monthSpan = daySpan / 30;
        const yearSpan = daySpan / 365;
        const pad = span * padding;
    
        const xScale = d3.scaleTime()
            .domain([new Date(+minD - pad), new Date(+maxD + pad)])
            .range([rangeStart, rangeEnd]);
    
        let interval, format;
        if (yearSpan > 35) { interval = d3.timeYear.every(10); format = d => d3.timeFormat("%Y")(d); }
        else if (yearSpan > 15) { interval = d3.timeYear.every(5); format = d => d3.timeFormat("%Y")(d); }
        else if (yearSpan > 7) { interval = d3.timeYear.every(2); format = d => d3.timeFormat("%Y")(d); }
        else if (yearSpan > 2) { interval = d3.timeYear.every(1); format = d => d3.timeFormat("%Y")(d); }
        else if (yearSpan > 1) { interval = d3.timeMonth.every(3); format = d => `${d.getFullYear().toString().slice(-2)}Q${Math.floor(d.getMonth()/3)+1}`; }
        else if (monthSpan > 6) { interval = d3.timeMonth.every(1); format = d => d3.timeFormat("%b %Y")(d); }
        else if (monthSpan > 2) { interval = d3.timeWeek.every(1); format = d => d3.timeFormat("%d %b")(d); }
        else { 
            const c = Math.max(1, Math.ceil(daySpan / 10)); 
            interval = d3.timeDay.every(c); 
            format = d => d3.timeFormat("%d %b")(d);
        }
    
        const xTicks = xScale.ticks(interval);
        
        if (xTicks.length > 0) {
            const lastGeneratedTick = xTicks[xTicks.length - 1];
            if (lastGeneratedTick < maxD) {
                if (xScale(maxD) - xScale(lastGeneratedTick) > 30) { 
                    xTicks.push(maxD);
                } else if (xTicks.length ===1 || xScale(maxD) !== xScale(lastGeneratedTick)) { // Avoid replacing if only one tick and it's same as maxD
                    xTicks[xTicks.length - 1] = maxD;
                }
            }
        } else if (+minD !== +maxD) { 
            xTicks.push(minD, maxD);
        } else { // Single distinct date
            xTicks.push(minD);
        }
    
        return { xScale, xTicks, xFormat: format, timeSpan: { days: daySpan, months: monthSpan, years: yearSpan } };
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root") // Standardized class
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 80, left: 20 }; // Adjusted top margin
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group"); // Standardized class

    const centerWidth = 60; 
    const halfCenter = centerWidth / 2;

    // Block 5: Data Preprocessing & Transformation
    let uniqueGroups = [...new Set(rawChartData.map(d => d[groupFieldName]))];
    if (uniqueGroups.length > 2) {
        uniqueGroups = uniqueGroups.slice(0, 2);
    }
    
    const chartDataArray = rawChartData.filter(d => uniqueGroups.includes(d[groupFieldName]));


    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartDataArray, xFieldName, 0, innerHeight);

    const yMax = d3.max(chartDataArray, d => +d[yFieldName]) * 1.1 || 1; 

    const yScaleLeft = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerWidth / 2 - halfCenter, 0]); 

    const yScaleRight = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerWidth / 2 + halfCenter, innerWidth]); 

    const yTicksCount = 5;
    const yAxisTicks = d3.ticks(0, yMax, yTicksCount);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(${innerWidth / 2}, 0)`);

    xTicks.forEach(tick => {
        const tickGroup = xAxisGroup.append("g").attr("class", "tick-group"); // Standardized class
        
        tickGroup.append("text")
            .attr("class", "label axis-label") // Standardized class
            .attr("x", 0)
            .attr("y", xScale(tick))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xFormat(tick));
        
        tickGroup.append("line")
            .attr("class", "mark tick-line") // Standardized class
            .attr("x1", -halfCenter - 10)
            .attr("y1", xScale(tick))
            .attr("x2", -halfCenter)
            .attr("y2", xScale(tick))
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);
        
        tickGroup.append("line")
            .attr("class", "mark tick-line") // Standardized class
            .attr("x1", halfCenter)
            .attr("y1", xScale(tick))
            .attr("x2", halfCenter + 10)
            .attr("y2", xScale(tick))
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);
    });

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .attr("transform", `translate(0, ${innerHeight + 20})`); 

    yAxisTicks.forEach(tick => {
        yAxisGroup.append("text")
            .attr("class", "label axis-label") // Standardized class
            .attr("x", yScaleLeft(tick))
            .attr("y", 0)
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(tick);

        if (yScaleRight(tick) !== yScaleLeft(tick)) { 
             yAxisGroup.append("text")
                .attr("class", "label axis-label") // Standardized class
                .attr("x", yScaleRight(tick))
                .attr("y", 0)
                .attr("text-anchor", "middle")
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .text(tick);
        }
    });

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(0, ${containerHeight - chartMargins.bottom + 45})`); // Adjusted Y

    const legendItemHeight = parseFloat(fillStyle.typography.labelFontSize) || 12; // Base on font size
    const legendRectTextGap = 8;
    const legendItemMargin = 15;

    const legendFontProps = {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight,
    };

    const legendItemsData = uniqueGroups.map((group, i) => {
        const textWidth = estimateTextWidth(group, legendFontProps);
        return {
            label: group,
            color: fillStyle.getCategoryColor(group, i),
            width: legendItemHeight + legendRectTextGap + textWidth // Rect width is legendItemHeight
        };
    });
    
    const totalLegendWidth = legendItemsData.reduce((sum, item) => sum + item.width, 0) + Math.max(0, legendItemsData.length - 1) * legendItemMargin;
    let currentLegendX = (containerWidth - totalLegendWidth) / 2;

    legendItemsData.forEach(item => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item") // Standardized class
            .attr("transform", `translate(${currentLegendX}, 0)`);

        itemGroup.append("rect")
            .attr("class", "mark legend-mark") // Standardized class
            .attr("x", 0)
            .attr("y", -legendItemHeight / 2) // Vertically center with text
            .attr("width", legendItemHeight)
            .attr("height", legendItemHeight)
            .attr("fill", item.color);

        itemGroup.append("text")
            .attr("class", "label legend-label") // Standardized class
            .attr("x", legendItemHeight + legendRectTextGap)
            .attr("y", 0) 
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", legendFontProps.fontFamily)
            .style("font-size", legendFontProps.fontSize)
            .style("font-weight", legendFontProps.fontWeight)
            .text(item.label);
        
        currentLegendX += item.width + legendItemMargin;
    });

    // Block 8: Main Data Visualization Rendering (Areas)
    uniqueGroups.forEach((group, i) => {
        const groupData = chartDataArray
            .filter(d => d[groupFieldName] === group)
            .map(d => ({ ...d, date: parseDate(d[xFieldName]), value: +d[yFieldName] })) // Pre-parse
            .sort((a, b) => a.date - b.date);

        if (groupData.length < 2) { 
            return;
        }

        const currentYScale = i === 0 ? yScaleLeft : yScaleRight;
        const baseLineX = i === 0 ? innerWidth / 2 - halfCenter : innerWidth / 2 + halfCenter;

        const areaGenerator = d3.area()
            .x0(baseLineX)
            .x1(d => currentYScale(d.value)) 
            .y(d => xScale(d.date))  
            .curve(d3.curveMonotoneY); 

        mainChartGroup.append("path")
            .datum(groupData)
            .attr("class", "mark area-mark") // Standardized class
            .attr("fill", fillStyle.getCategoryColor(group, i))
            .attr("d", areaGenerator);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No enhancements in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}