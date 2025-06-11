/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiple Area Chart",
  "chart_name": "small_multiple_area_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 20]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["background_color", "text_color", "primary"],
  "min_height": 600,
  "min_width": 800,
  "background": "dark",

  "elementAlignment": "none",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    // Prefer colors_dark if background is dark, otherwise use colors.
    const rawColors = (data.colors_dark && Object.keys(data.colors_dark).length > 0 ? data.colors_dark : data.colors) || {};
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldConfig = dataColumns.find(col => col.role === xFieldRole);
    const yFieldConfig = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldConfig = dataColumns.find(col => col.role === groupFieldRole);

    const xFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const yFieldName = yFieldConfig ? yFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    const missingFields = [];
    if (!xFieldName) missingFields.push(`field with role '${xFieldRole}'`);
    if (!yFieldName) missingFields.push(`field with role '${yFieldRole}'`);
    if (!groupFieldName) missingFields.push(`field with role '${groupFieldRole}'`);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    
    if (!chartData || chartData.length === 0) {
        const errorMsg = "No data provided to chart. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        chartBackground: rawColors.background_color || '#121212', // Dark default
        textColor: rawColors.text_color || '#E0E0E0', // Light text for dark background
        gridLineColor: (rawColors.other && rawColors.other.secondary) ? rawColors.other.secondary : '#FFFFFF',
        axisLineColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#CCCCCC',
        groupColorsByName: rawColors.field || {}, // Renamed for clarity
        availableColors: rawColors.available_colors && rawColors.available_colors.length > 0 ? rawColors.available_colors : d3.schemeCategory10,
    };
    
    // In-memory text measurement utility
    function estimateTextWidth(textProps) {
        const { text, fontFamily, fontSize, fontWeight } = textProps;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        const width = textElement.getBBox().width;
        return width;
    }

    // Date parsing function (assuming YYYY-MM-DD format, adjust if column spec provides format)
    const parseDate = d3.timeParse("%Y-%m-%d"); 

    // X-axis scale and ticks helper
    function createXAxisScaleAndHelper(currentChartData, xValField, dateParser, currentChartWidth) {
        const dates = currentChartData.map(d => d[xValField] ? dateParser(d[xValField]) : null).filter(d => d instanceof Date && !isNaN(d));
        
        if (dates.length === 0) { // Fallback if no valid dates
            const now = new Date();
            const fallbackScale = d3.scaleTime().domain([now, d3.timeDay.offset(now, 1)]).range([0, currentChartWidth]);
            return {
                xScale: fallbackScale,
                xTicks: fallbackScale.ticks(Math.max(2, Math.floor(currentChartWidth / 100))),
                xTickFormat: d3.timeFormat("%Y-%m-%d"),
            };
        }
        const dateExtent = d3.extent(dates);
        
        const xScale = d3.scaleTime()
            .domain(dateExtent)
            .range([0, currentChartWidth]);

        const numTicks = Math.max(2, Math.floor(currentChartWidth / 100));
        const xTicks = xScale.ticks(numTicks);
        
        const timeSpanDays = (dateExtent[1] - dateExtent[0]) / (1000 * 60 * 60 * 24);
        let xTickFormat;
        if (timeSpanDays <= 1) { 
             xTickFormat = d3.timeFormat("%H:%M"); // Hours:Minutes for single day
        } else if (timeSpanDays <= 31 * 3) { // Up to ~3 months
             xTickFormat = d3.timeFormat("%b %d"); // Month Day
        } else if (timeSpanDays <= 366 * 2) { // Up to 2 years
            xTickFormat = d3.timeFormat("%b %Y"); // Month Year
        } else { // More than 2 years
            xTickFormat = d3.timeFormat("%Y"); // Year
        }
        
        return { xScale, xTicks, xTickFormat };
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
    const uniqueGroupNames = [...new Set(chartData.map(d => d[groupFieldName]))];
    const longestGroupName = uniqueGroupNames.reduce((longest, current) => (current && current.length > longest.length) ? current : longest, "");
    
    const groupNameTextProps = {
        text: longestGroupName || "M", // Use "M" as a fallback for width calculation if no groups
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight,
    };
    const maxGroupNameWidth = estimateTextWidth(groupNameTextProps);

    const chartMargins = {
        top: 60,
        right: 60, 
        bottom: 60,
        left: Math.max(80, maxGroupNameWidth + 40) // Dynamic left margin
    };

    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (chartWidth <= 0 || chartHeight <= 0) {
        console.error("Calculated chart dimensions are not positive. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Chart dimensions too small.</div>");
        return null;
    }

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = uniqueGroupNames;

    const groupMaxValues = {};
    groups.forEach(group => {
        const groupData = chartData.filter(d => d[groupFieldName] === group);
        const yValues = groupData.map(d => parseFloat(d[yFieldName])).filter(v => !isNaN(v));
        groupMaxValues[group] = yValues.length > 0 ? d3.max(yValues) : 0;
    });

    const numGroups = groups.length > 0 ? groups.length : 1;
    const groupHeight = chartHeight / (numGroups * 1.5); 
    const groupPositions = {};
    groups.forEach((group, i) => {
        groupPositions[group] = i * groupHeight * 1.5;
    });

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xTickFormat } = createXAxisScaleAndHelper(chartData, xFieldName, parseDate, chartWidth);

    const yScales = {};
    groups.forEach(group => {
        yScales[group] = d3.scaleLinear()
            .domain([0, Math.max(1, groupMaxValues[group])])
            .range([groupHeight, 0]);
    });

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xGridLinesGroup = mainChartGroup.append("g").attr("class", "gridlines x-gridlines");
    xTicks.forEach(tick => {
        xGridLinesGroup.append("line")
            .attr("class", "gridline x-gridline")
            .attr("x1", xScale(tick))
            .attr("y1", 0)
            .attr("x2", xScale(tick))
            .attr("y2", chartHeight)
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-opacity", 0.1)
            .attr("stroke-width", 1);
    });

    const xAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis x-axis-labels");
    xTicks.forEach(tick => {
        xAxisLabelsGroup.append("text")
            .attr("class", "text x-axis-text top")
            .attr("x", xScale(tick))
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "alphabetic")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xTickFormat(tick));

        xAxisLabelsGroup.append("text")
            .attr("class", "text x-axis-text bottom")
            .attr("x", xScale(tick))
            .attr("y", chartHeight + chartMargins.bottom / 3) // Position relative to margin
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(xTickFormat(tick));
    });

    // Block 8: Main Data Visualization Rendering & Group-specific Components
    groups.forEach((group, groupIndex) => {
        const groupDataOriginal = chartData.filter(d => d[groupFieldName] === group);
        const groupDataProcessed = groupDataOriginal
            .map(d => {
                const date = d[xFieldName] ? parseDate(d[xFieldName]) : null;
                const value = d[yFieldName] !== undefined && d[yFieldName] !== null ? parseFloat(d[yFieldName]) : 0; // Ensure Y is numeric
                return { ...d, [xFieldName]: date, [yFieldName]: isNaN(value) ? 0 : value };
            })
            .filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]))
            .sort((a, b) => a[xFieldName] - b[xFieldName]);

        if (groupDataProcessed.length === 0) return;

        const groupColor = fillStyle.groupColorsByName[group] || 
                           fillStyle.availableColors[(groupIndex + fillStyle.availableColors.length) % fillStyle.availableColors.length];

        const groupSpecificG = mainChartGroup.append("g")
            .attr("class", `group-container mark ${group ? group.toString().replace(/\s+/g, '-').toLowerCase() : `group-${groupIndex}`}`);
        
        groupSpecificG.append("line") // Zero-line for the group
            .attr("class", "mark zero-line")
            .attr("x1", -chartMargins.left + 20)
            .attr("y1", groupPositions[group] + groupHeight)
            .attr("x2", chartWidth)
            .attr("y2", groupPositions[group] + groupHeight)
            .attr("stroke", groupColor)
            .attr("stroke-width", 1.5)
            .attr("stroke-opacity", 0.8);

        const areaGenerator = d3.area()
            .x(d => xScale(d[xFieldName]))
            .y0(groupPositions[group] + groupHeight)
            .y1(d => groupPositions[group] + yScales[group](d[yFieldName]))
            .curve(d3.curveBasis);

        groupSpecificG.append("path")
            .datum(groupDataProcessed)
            .attr("class", "mark area-mark")
            .attr("fill", groupColor)
            .attr("d", areaGenerator);

        groupSpecificG.append("text") // Group name label
            .attr("class", "label group-label")
            .attr("x", -chartMargins.left + 20)
            .attr("y", groupPositions[group] + groupHeight - 10)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "alphabetic")
            .attr("fill", groupColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight) // Adhering to token
            .text(group);
        
        const yAxisGenerator = d3.axisRight(yScales[group])
            .ticks(3)
            .tickSize(0)
            .tickFormat(d3.format(".1s"));

        const yAxisGroup = groupSpecificG.append("g")
            .attr("class", "axis y-axis")
            .attr("transform", `translate(${chartWidth}, ${groupPositions[group]})`)
            .call(yAxisGenerator);

        yAxisGroup.selectAll("path.domain").attr("stroke", groupColor);
        yAxisGroup.selectAll("text")
            .attr("class", "text y-axis-text")
            .attr("fill", groupColor)
            .style("font-family", fillStyle.typography.annotationFontFamily) // Smaller for Y-axis ticks
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("dx", "0.5em");

        const yGridGroup = groupSpecificG.append("g").attr("class", "gridlines y-gridlines-group");
        yScales[group].ticks(3).forEach(tick => {
            if (tick > 0) {
                yGridGroup.append("line")
                    .attr("class", "gridline y-gridline")
                    .attr("x1", 0)
                    .attr("y1", groupPositions[group] + yScales[group](tick))
                    .attr("x2", chartWidth)
                    .attr("y2", groupPositions[group] + yScales[group](tick))
                    .attr("stroke", groupColor)
                    .attr("stroke-opacity", 0.2)
                    .attr("stroke-width", 0.5)
                    .attr("stroke-dasharray", "2,2");
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements required by directives for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}