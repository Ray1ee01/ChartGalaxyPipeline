/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Spline Area Charts",
  "chart_name": "small_multiple_spline_area_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 30], [0, "inf"], [2, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is now external to the function)

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {}; // Parsed as per requirement, though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldDef = dataColumns.find(col => col.role === "x");
    const yFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    let missingConfigMessages = [];
    if (!xFieldDef || !xFieldDef.name) missingConfigMessages.push("x field definition (role: 'x')");
    if (!yFieldDef || !yFieldDef.name) missingConfigMessages.push("y field definition (role: 'y')");
    if (!groupFieldDef || !groupFieldDef.name) missingConfigMessages.push("group field definition (role: 'group')");
    
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 400;

    if (missingConfigMessages.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingConfigMessages.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("font-family", "Arial, sans-serif")
            .style("padding", "10px")
            .html(errorMsg);
        return null;
    }

    const xFieldName = xFieldDef.name;
    const yFieldName = yFieldDef.name;
    const groupFieldName = groupFieldDef.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colors.text_color || '#333333',
        axisLineColor: (colors.other && colors.other.axisLine) ? colors.other.axisLine : '#CCCCCC',
        gridLineColor: (colors.other && colors.other.gridLine) ? colors.other.gridLine : '#E0E0E0',
        areaOpacity: variables.areaOpacity !== undefined ? variables.areaOpacity : 0.3,
        lineStrokeWidth: variables.lineStrokeWidth !== undefined ? variables.lineStrokeWidth : 2,
        defaultCategoricalColor: '#1f77b4',
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
        }
    };
    
    const parseDate = (dateValue) => {
        if (dateValue instanceof Date) return dateValue;
        if (typeof dateValue === 'number') return new Date(dateValue, 0, 1); // Assume year
        if (typeof dateValue === 'string') {
            const parts = dateValue.split(/[-\/]/); // Allow / or - as separator
            if (parts.length === 3) return new Date(+parts[0], +parts[1] - 1, +parts[2]);
            if (parts.length === 2) return new Date(+parts[0], +parts[1] - 1, 1);
            if (/^\d{4}$/.test(parts[0])) return new Date(+parts[0], 0, 1);
        }
        return null;
    };

    const formatValue = (value) => {
        if (value === 0) return "0";
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value);
        return d3.format(Math.abs(value) < 1 && Math.abs(value) > 0 ? "~.2r" : "~g")(value);
    };
    
    const estimateTextWidth = (text, fontFamily, fontSize) => { // As per prompt, not used by this chart
        const svgNS = "http://www.w3.org/2000/svg";
        const tempSvg = document.createElementNS(svgNS, "svg");
        const tempText = document.createElementNS(svgNS, "text");
        tempText.setAttribute("font-family", fontFamily);
        tempText.setAttribute("font-size", fontSize);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        let width = 0;
        try { width = tempText.getBBox().width; } catch (e) { /* Do nothing */ }
        return width;
    };

    const createXAxisScaleAndTicks = (currentGroupDataForX, xAccessField, rangeStart, rangeEnd, padding = 0.05) => {
        const dates = currentGroupDataForX.map(d => d[xAccessField]).filter(d => d instanceof Date); // Already parsed
        if (dates.length === 0) return null;

        const [minD, maxD] = d3.extent(dates);
        if (minD === undefined || maxD === undefined) return null;
        
        const span = +maxD - +minD;
        const yearSpan = span / (365.25 * 24 * 60 * 60 * 1000);

        if (yearSpan < 1.5 && dates.length > 1) { // Original logic: skip if too short a span
            // If there are multiple points but span is less than 1.5 years, it might still be skippable
            // The original code effectively skipped. Let's maintain that.
        }
         if (yearSpan < 1.0 && dates.length <=5 ) { // Relaxed slightly: if span is very short AND few points
            return null;
        }


        const padAmount = (span === 0) ? (30 * 24 * 60 * 60 * 1000) : (span * padding); // Add 30 days padding if single date
        const domainMin = new Date(+minD - padAmount);
        const domainMax = new Date(+maxD + padAmount);

        const xScale = d3.scaleTime().domain([domainMin, domainMax]).range([rangeStart, rangeEnd]);

        let interval;
        if (yearSpan > 25) interval = d3.timeYear.every(10);
        else if (yearSpan > 20) interval = d3.timeYear.every(5);
        else if (yearSpan > 15) interval = d3.timeYear.every(4);
        else if (yearSpan > 10) interval = d3.timeYear.every(3);
        else if (yearSpan > 5) interval = d3.timeYear.every(2);
        else interval = d3.timeYear.every(1);
        
        let xTicks = xScale.ticks(interval);
        const xTickFormat = d => d3.timeFormat("%Y")(d);

        if (xTicks.length > 1 && xScale(maxD) - xScale(xTicks[xTicks.length - 1]) >= Math.min(50, subplotInnerWidth * 0.15) && maxD > xTicks[xTicks.length - 1]) {
            xTicks.push(maxD);
        }
         if (xTicks.length === 0 && dates.length > 0) {
            xTicks = [dates[0]]; // Use first date if no ticks generated
            if (dates.length > 1 && dates[0].getTime() !== dates[dates.length-1].getTime()) {
                 xTicks.push(dates[dates.length-1]); // And last if different
            }
        }
        xTicks = xTicks.filter(t => t >= domainMin && t <= domainMax); // Ensure ticks are within padded domain
        xTicks.sort((a, b) => a - b);
        
        // Deduplicate ticks (e.g. if maxD was close to a generated tick)
        xTicks = xTicks.filter((tick, index, self) => 
            index === self.findIndex(t => t.getTime() === tick.getTime()));

        return { xScale, xTicks, xTickFormat };
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-container"); // Added a general class for the SVG root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.marginTop || 40, 
        right: variables.marginRight || 40, 
        bottom: variables.marginBottom || 80, 
        left: variables.marginLeft || 40 
    };
    
    const numberOfColumns = Math.min(Math.max(1, variables.numberOfColumns || 2), 6);
    const plotGap = variables.plotGap !== undefined ? variables.plotGap : 20;

    const subplotMargins = { 
        top: variables.subplotMarginTop !== undefined ? variables.subplotMarginTop : 50,
        right: variables.subplotMarginRight !== undefined ? variables.subplotMarginRight : 35, // Increased for Y labels
        bottom: variables.subplotMarginBottom !== undefined ? variables.subplotMarginBottom : 40,
        left: variables.subplotMarginLeft !== undefined ? variables.subplotMarginLeft : 10 // Reduced as Y labels are on right
    };

    // Block 5: Data Preprocessing & Transformation
    let chartData = rawChartData.map(d => {
        const xVal = parseDate(d[xFieldName]);
        const yVal = parseFloat(String(d[yFieldName]).replace(/,/g, '')); // Handle numbers with commas
        return {
            ...d,
            [xFieldName]: xVal,
            [yFieldName]: (xVal && !isNaN(yVal)) ? yVal : undefined // Keep yVal only if xVal is valid and yVal is number
        };
    }).filter(d => d[xFieldName] instanceof Date && d[yFieldName] !== undefined);


    if (chartData.length === 0) {
        svgRoot.append("text").attr("class", "label error-message")
            .attr("x", containerWidth / 2).attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No valid data to display after processing.");
        return svgRoot.node();
    }
    
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))].sort((a,b) => String(a).localeCompare(String(b)));

    const globalYMax = d3.max(chartData, d => d[yFieldName]);
    const globalYMin = d3.min(chartData, d => d[yFieldName]); // Consider min for domain if negative values possible
    const yDomainPadding = Math.abs(globalYMax - (globalYMin < 0 ? globalYMin : 0)) * 0.1; // 10% padding
    const globalYDomain = [
        globalYMin < 0 ? globalYMin - yDomainPadding : 0, 
        (globalYMax > 0 ? globalYMax : 0) + yDomainPadding === 0 && globalYMax === 0 ? 1 : (globalYMax > 0 ? globalYMax : 0) + yDomainPadding // Ensure domain is not [0,0] unless data is all 0
    ];


    const numberOfRows = Math.ceil(groups.length / numberOfColumns);

    const totalHorizontalMarginAndGap = chartMargins.left + chartMargins.right + plotGap * (numberOfColumns - 1);
    const subplotWidth = (containerWidth - totalHorizontalMarginAndGap) / numberOfColumns;

    const totalVerticalMarginAndGap = chartMargins.top + chartMargins.bottom + plotGap * (numberOfRows - 1);
    const subplotHeight = (containerHeight - totalVerticalMarginAndGap) / numberOfRows;

    if (subplotWidth <= plotMargins.left + subplotMargins.right || subplotHeight <= subplotMargins.top + subplotMargins.bottom) {
        svgRoot.append("text").attr("class", "label error-message")
            .attr("x", containerWidth / 2).attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("Chart dimensions result in invalid subplot sizes. Adjust margins or container size.");
        return svgRoot.node();
    }

    const subplotInnerWidth = subplotWidth - subplotMargins.left - subplotMargins.right;
    const subplotInnerHeight = subplotHeight - subplotMargins.top - subplotMargins.bottom;

    // Block 6: Scale Definition & Configuration
    const globalYScale = d3.scaleLinear().domain(globalYDomain).range([subplotInnerHeight, 0]);
    const globalYTicks = globalYScale.ticks(Math.max(2, Math.floor(subplotInnerHeight / 35)));

    // Block 7 & 8: Chart Component Rendering & Main Data Visualization (Combined in loop)
    groups.forEach((groupName, groupIndex) => {
        const currentRow = Math.floor(groupIndex / numberOfColumns);
        const currentColumn = groupIndex % numberOfColumns;

        const subplotXPosition = chartMargins.left + currentColumn * (subplotWidth + plotGap);
        const subplotYPosition = chartMargins.top + currentRow * (subplotHeight + plotGap);

        const subplotGroup = svgRoot.append("g")
            .attr("class", "other subplot-group")
            .attr("transform", `translate(${subplotXPosition}, ${subplotYPosition})`);

        const chartAreaGroup = subplotGroup.append("g")
            .attr("transform", `translate(${subplotMargins.left}, ${subplotMargins.top})`);

        let currentGroupData = chartData.filter(d => d[groupFieldName] === groupName);
        currentGroupData.sort((a, b) => a[xFieldName] - b[xFieldName]);

        if (currentGroupData.length === 0) return;

        const xAxisConfig = createXAxisScaleAndTicks(currentGroupData, xFieldName, 0, subplotInnerWidth);
        
        if (!xAxisConfig || subplotInnerWidth <=0 || subplotInnerHeight <=0) {
            chartAreaGroup.append("text").attr("class", "label info-message")
                .attr("x", subplotInnerWidth / 2).attr("y", subplotInnerHeight / 2)
                .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("fill", fillStyle.textColor)
                .text(subplotInnerWidth <=0 || subplotInnerHeight <=0 ? "Not enough space" : "Time span too short or no data.");
            return; 
        }
        const { xScale, xTicks, xTickFormat } = xAxisConfig;
        const yScale = globalYScale;

        const groupColor = (colors.field && colors.field[groupName])
            ? colors.field[groupName]
            : (colors.available_colors && colors.available_colors.length > 0
                ? colors.available_colors[groupIndex % colors.available_colors.length]
                : d3.schemeCategory10[groupIndex % 10]);

        // X-axis base line & ticks
        chartAreaGroup.append("line").attr("class", "axis x-axis-line")
            .attr("x1", 0).attr("y1", subplotInnerHeight)
            .attr("x2", subplotInnerWidth).attr("y2", subplotInnerHeight)
            .attr("stroke", fillStyle.axisLineColor).attr("stroke-width", 1);

        xTicks.forEach(tickValue => {
            const tickX = xScale(tickValue);
            if (tickX >= 0 && tickX <= subplotInnerWidth) { // Draw only if within plot area
                chartAreaGroup.append("line").attr("class", "axis x-axis-tick")
                    .attr("x1", tickX).attr("y1", subplotInnerHeight)
                    .attr("x2", tickX).attr("y2", subplotInnerHeight + 5)
                    .attr("stroke", fillStyle.axisLineColor).attr("stroke-width", 1);

                chartAreaGroup.append("text").attr("class", "label x-axis-label")
                    .attr("x", tickX).attr("y", subplotInnerHeight + subplotMargins.bottom * 0.6)
                    .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(xTickFormat(tickValue));
            }
        });

        // Y-axis gridlines and labels
        globalYTicks.forEach(tickValue => {
            const yPos = yScale(tickValue);
            if (yPos >=0 && yPos <= subplotInnerHeight) { // Draw only if within plot area
                chartAreaGroup.append("line").attr("class", "gridline y-gridline")
                    .attr("x1", 0).attr("y1", yPos)
                    .attr("x2", subplotInnerWidth).attr("y2", yPos)
                    .attr("stroke", fillStyle.gridLineColor)
                    .attr("stroke-dasharray", (tickValue === 0 && globalYDomain[0] <= 0) ? "none" : "2,2")
                    .attr("stroke-width", 0.5);
            }
            
            chartAreaGroup.append("text").attr("class", "value y-axis-label")
                .attr("x", subplotInnerWidth + 6).attr("y", yPos)
                .attr("text-anchor", "start").attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${parseFloat(fillStyle.typography.labelFontSize) * 0.9}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(formatValue(tickValue));
        });
        
        subplotGroup.append("text").attr("class", "label subplot-title")
            .attr("x", subplotWidth / 2).attr("y", subplotMargins.top / 2.5) // Adjusted y position
            .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", fillStyle.typography.titleFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .style("fill", fillStyle.textColor)
            .text(String(groupName).length > (subplotWidth / (parseFloat(fillStyle.typography.titleFontSize)*0.7)) ? String(groupName).substring(0, Math.floor(subplotWidth / (parseFloat(fillStyle.typography.titleFontSize)*0.7)) - 3) + "..." : groupName ); // Truncate title if too long


        if (currentGroupData.length > 0 && xScale && yScale) {
            const areaGenerator = d3.area()
                .x(d => xScale(d[xFieldName]))
                .y0(yScale(Math.max(0, globalYDomain[0]))) // Area base at y=0 or bottom of domain if negative
                .y1(d => yScale(d[yFieldName]))
                .defined(d => d[xFieldName] instanceof Date && typeof d[yFieldName] === 'number' && xScale(d[xFieldName]) !== undefined && yScale(d[yFieldName]) !== undefined) // Ensure valid points
                .curve(d3.curveMonotoneX);

            chartAreaGroup.append("path").datum(currentGroupData)
                .attr("class", "mark area-mark")
                .attr("fill", groupColor).attr("opacity", fillStyle.areaOpacity)
                .attr("d", areaGenerator);

            const lineGenerator = d3.line()
                .x(d => xScale(d[xFieldName]))
                .y(d => yScale(d[yFieldName]))
                .defined(d => d[xFieldName] instanceof Date && typeof d[yFieldName] === 'number' && xScale(d[xFieldName]) !== undefined && yScale(d[yFieldName]) !== undefined)
                .curve(d3.curveMonotoneX);

            chartAreaGroup.append("path").datum(currentGroupData)
                .attr("class", "mark line-mark")
                .attr("fill", "none").attr("stroke", groupColor)
                .attr("stroke-width", fillStyle.lineStrokeWidth)
                .attr("d", lineGenerator);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None specific beyond subplot rendering)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}