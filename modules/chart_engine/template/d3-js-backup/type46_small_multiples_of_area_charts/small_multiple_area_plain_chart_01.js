/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Area Charts",
  "chart_name": "small_multiple_area_plain_chart_01",
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

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {}; // Not used, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldName = dataColumns.find(col => col.role === xFieldRole)?.name;
    const yFieldName = dataColumns.find(col => col.role === yFieldRole)?.name;
    const groupFieldName = dataColumns.find(col => col.role === groupFieldRole)?.name;

    const criticalConfigIssues = [];
    if (!xFieldName) criticalConfigIssues.push("x-axis field mapping (role 'x')");
    if (!yFieldName) criticalConfigIssues.push("y-axis field mapping (role 'y')");
    if (!groupFieldName) criticalConfigIssues.push("grouping field mapping (role 'group')");

    if (criticalConfigIssues.length > 0) {
        const missingFieldsMsg = criticalConfigIssues.join(', ');
        console.error(`Critical chart config missing: [${missingFieldsMsg}]. Cannot render.`);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: Critical chart configuration missing: ${missingFieldsMsg}. Cannot render chart.</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colors.text_color || '#0f223b',
        backgroundColor: colors.background_color || '#FFFFFF',
        axisLineColor: '#666666',
        gridLineColor: '#888888',
        defaultSeriesColors: d3.schemeCategory10,
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) || '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) || 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            valueFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            valueFontSize: (typography.label && typography.label.font_size) || '11px', // Specific from original
            valueFontWeight: (typography.label && typography.label.font_weight) || 'normal',
        },
        getGroupColor: (groupName, index) => {
            if (colors.field && colors.field[groupName]) {
                return colors.field[groupName];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return fillStyle.defaultSeriesColors[index % fillStyle.defaultSeriesColors.length];
        },
        areaFillOpacity: 0.4,
        lineWidth: 3, // From original
        axisTickSize: 5,
    };

    const parseDate = d => {
        if (d instanceof Date) return d;
        if (typeof d === 'string') {
            const parts = d.split('-');
            if (parts.length === 3 && !isNaN(new Date(d))) return new Date(d); // YYYY-MM-DD
            if (parts.length === 2 && !isNaN(new Date(parts[0], +parts[1] - 1, 1))) return new Date(+parts[0], +parts[1] - 1, 1); // YYYY-MM
            if (parts.length === 1 && /^\d{4}$/.test(parts[0]) && !isNaN(new Date(+parts[0], 0, 1))) return new Date(+parts[0], 0, 1); // YYYY
        }
        if (typeof d === 'number' && d >= 1000 && d <= 9999) return new Date(d, 0, 1); // Number as year
        return null;
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    const estimateTextWidth = (text, fontFamily, fontSize) => {
        const svgNs = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNs, 'svg');
        const tempText = document.createElementNS(svgNs, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            const avgCharWidth = parseFloat(fontSize) * 0.6;
            width = text.length * avgCharWidth;
        }
        return width;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 40, bottom: 80, left: 40 };
    const plotGap = 20;

    // Block 5: Data Preprocessing & Transformation
    let chartData = rawChartData.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName]
    })).filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]) && typeof d[yFieldName] === 'number' && !isNaN(d[yFieldName]));

    if (chartData.length === 0) {
        d3.select(containerSelector).html("<div style='color:orange; font-family: sans-serif; padding: 10px;'>Warning: No valid data to display after processing.</div>");
        return null;
    }
    
    const groups = Array.from(new Set(chartData.map(d => d[groupFieldName]))).sort();

    const subplotsPerRow = Math.min(groups.length, 2);
    const numberOfRows = Math.ceil(groups.length / subplotsPerRow);

    if (numberOfRows === 0 || subplotsPerRow === 0) {
         d3.select(containerSelector).html("<div style='color:orange; font-family: sans-serif; padding: 10px;'>Warning: No groups to display.</div>");
        return null;
    }

    const subplotWidth = (containerWidth - chartMargins.left - chartMargins.right - plotGap * (subplotsPerRow - 1)) / subplotsPerRow;
    const subplotHeight = (containerHeight - chartMargins.top - chartMargins.bottom - plotGap * (numberOfRows - 1)) / numberOfRows;
    
    const subplotInternalMargins = { top: 50, right: 35, bottom: 40, left: 10 };
    const subplotInnerWidth = subplotWidth - subplotInternalMargins.left - subplotInternalMargins.right;
    const subplotInnerHeight = subplotHeight - subplotInternalMargins.top - subplotInternalMargins.bottom;

    if (subplotInnerWidth <= 0 || subplotInnerHeight <= 0) {
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: Chart layout calculation resulted in too small drawing area.</div>");
        return null;
    }
    
    const globalYMax = d3.max(chartData, d => d[yFieldName]);
    const globalYDomain = [0, globalYMax > 0 ? globalYMax * 1.2 : 10];

    // Block 6: Scale Definition & Configuration
    const globalYScale = d3.scaleLinear()
        .domain(globalYDomain)
        .range([subplotInnerHeight, 0]);

    const globalYTicks = globalYScale.ticks(4);

    // Block 7 & 8: Chart Component Rendering & Main Data Visualization
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other main-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    groups.forEach((groupName, i) => {
        const groupData = chartData.filter(d => d[groupFieldName] === groupName)
                                 .sort((a, b) => a[xFieldName] - b[xFieldName]);

        if (groupData.length < 2) return;

        const dataMinDate = d3.min(groupData, d => d[xFieldName]);
        const dataMaxDate = d3.max(groupData, d => d[xFieldName]);
        const yearSpan = (dataMaxDate - dataMinDate) / (365 * 24 * 60 * 60 * 1000);

        if (yearSpan < 1.5) {
            console.warn(`Skipping subplot for group "${groupName}" due to insufficient time span (${yearSpan.toFixed(1)} years).`);
            return; 
        }
        
        const row = Math.floor(i / subplotsPerRow);
        const col = i % subplotsPerRow;
        
        const subplotX = col * (subplotWidth + plotGap);
        const subplotY = row * (subplotHeight + plotGap);

        const subplotGroup = mainChartGroup.append("g")
            .attr("class", "other subplot-group")
            .attr("transform", `translate(${subplotX}, ${subplotY})`);

        const drawingGroup = subplotGroup.append("g")
            .attr("class", "other drawing-group")
            .attr("transform", `translate(${subplotInternalMargins.left}, ${subplotInternalMargins.top})`);

        const dateSpanMs = +dataMaxDate - +dataMinDate;
        const paddingTime = dateSpanMs * 0.05;

        const xScale = d3.scaleTime()
            .domain([new Date(+dataMinDate - paddingTime), new Date(+dataMaxDate + paddingTime)])
            .range([0, subplotInnerWidth]);

        let xTickInterval;
        if (yearSpan > 25) xTickInterval = d3.timeYear.every(10);
        else if (yearSpan > 20) xTickInterval = d3.timeYear.every(5);
        else if (yearSpan > 15) xTickInterval = d3.timeYear.every(4);
        else if (yearSpan > 10) xTickInterval = d3.timeYear.every(3);
        else if (yearSpan > 5) xTickInterval = d3.timeYear.every(2);
        else xTickInterval = d3.timeYear.every(1);
        
        let xTicks = xScale.ticks(xTickInterval);
        const xTickFormat = d3.timeFormat("%Y");

        if (xTicks.length && groupData.length > 0) {
            const lastTickDate = xTicks[xTicks.length - 1];
            const lastDataPointDate = groupData[groupData.length - 1][xFieldName];
            if (xScale(lastTickDate) < xScale(lastDataPointDate) - 30) { // 30px threshold from original logic
                 if (!xTicks.find(t => t.getFullYear() === lastDataPointDate.getFullYear())) {
                     xTicks.push(lastDataPointDate);
                 }
            }
        }
        xTicks.sort((a, b) => a - b);
        xTicks = xTicks.filter(tick => xScale(tick) >= -1 && xScale(tick) <= subplotInnerWidth + 1);

        // X-axis line
        drawingGroup.append("line")
            .attr("class", "axis x-axis")
            .attr("x1", 0).attr("y1", subplotInnerHeight)
            .attr("x2", subplotInnerWidth).attr("y2", subplotInnerHeight)
            .attr("stroke", fillStyle.axisLineColor).attr("stroke-width", 1);

        // Y-axis gridlines
        globalYTicks.forEach(tick => {
            if (tick !== 0 && globalYScale(tick) > 1 && globalYScale(tick) < subplotInnerHeight -1 ) {
                drawingGroup.append("line")
                    .attr("class", "gridline")
                    .attr("x1", 0).attr("y1", globalYScale(tick))
                    .attr("x2", subplotInnerWidth).attr("y2", globalYScale(tick))
                    .attr("stroke", fillStyle.gridLineColor).attr("stroke-width", 0.5);
            }
        });

        // X-axis ticks and labels
        xTicks.forEach(tick => {
            const tickX = xScale(tick);
            if (tickX >= 0 && tickX <= subplotInnerWidth) {
                drawingGroup.append("line")
                    .attr("class", "axis tick")
                    .attr("x1", tickX).attr("y1", subplotInnerHeight)
                    .attr("x2", tickX).attr("y2", subplotInnerHeight + fillStyle.axisTickSize)
                    .attr("stroke", fillStyle.axisLineColor).attr("stroke-width", 1);

                drawingGroup.append("text")
                    .attr("class", "label x-axis-label")
                    .attr("x", tickX).attr("y", subplotInnerHeight + fillStyle.axisTickSize + 14)
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(xTickFormat(tick));
            }
        });

        // Y-axis labels
        globalYTicks.forEach(tick => {
             if (tick !== 0 && globalYScale(tick) > 1 && globalYScale(tick) < subplotInnerHeight -1) {
                drawingGroup.append("text")
                    .attr("class", "value y-axis-label")
                    .attr("x", subplotInnerWidth + 6).attr("y", globalYScale(tick))
                    .attr("text-anchor", "start").attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.valueFontFamily)
                    .style("font-size", fillStyle.typography.valueFontSize)
                    .style("font-weight", fillStyle.typography.valueFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formatValue(tick));
            }
        });

        // Subplot Title
        subplotGroup.append("text")
            .attr("class", "label title")
            .attr("x", subplotWidth / 2).attr("y", subplotInternalMargins.top / 2 + 5)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", fillStyle.typography.titleFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .style("fill", fillStyle.textColor)
            .text(groupName);

        const groupColor = fillStyle.getGroupColor(groupName, i);

        const areaGenerator = d3.area()
            .x(d => xScale(d[xFieldName]))
            .y0(subplotInnerHeight)
            .y1(d => globalYScale(d[yFieldName]))
            .curve(d3.curveLinear);

        drawingGroup.append("path")
            .datum(groupData)
            .attr("class", "mark area")
            .attr("fill", groupColor)
            .attr("opacity", fillStyle.areaFillOpacity)
            .attr("d", areaGenerator);

        const lineGenerator = d3.line()
            .x(d => xScale(d[xFieldName]))
            .y(d => globalYScale(d[yFieldName]))
            .curve(d3.curveLinear);

        drawingGroup.append("path")
            .datum(groupData)
            .attr("class", "mark line")
            .attr("fill", "none")
            .attr("stroke", groupColor)
            .attr("stroke-width", fillStyle.lineWidth)
            .attr("d", lineGenerator);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}