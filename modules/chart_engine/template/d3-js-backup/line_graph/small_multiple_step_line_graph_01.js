/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiple Step Line Graph",
  "chart_name": "small_multiple_step_line_graph_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 4]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
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
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const chartData = data.data && data.data.data ? data.data.data : [];
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || data.colors || {}; // Prefer dark theme if available
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const missingFields = [];
    if (!xFieldConfig) missingFields.push("x role");
    if (!yFieldConfig) missingFields.push("y role");
    if (!groupFieldConfig) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: data.columns definitions for ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    if (!chartData || chartData.length === 0) {
        const errorMsg = "No data provided to chart. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};

    const defaultTypography = {
        title: { font_family: "Impact, sans-serif", font_size: "24px", font_weight: "normal" },
        label: { font_family: '"Arial Narrow", Arial, sans-serif', font_size: "16px", font_weight: "normal" },
        annotation: { font_family: '"Arial Narrow", Arial, sans-serif', font_size: "18px", font_weight: "normal" }
    };

    fillStyle.typography = {
        title: {
            font_family: (typographyConfig.title && typographyConfig.title.font_family) || defaultTypography.title.font_family,
            font_size: (typographyConfig.title && typographyConfig.title.font_size) || defaultTypography.title.font_size,
            font_weight: (typographyConfig.title && typographyConfig.title.font_weight) || defaultTypography.title.font_weight,
        },
        label: {
            font_family: (typographyConfig.label && typographyConfig.label.font_family) || defaultTypography.label.font_family,
            font_size: (typographyConfig.label && typographyConfig.label.font_size) || defaultTypography.label.font_size,
            font_weight: (typographyConfig.label && typographyConfig.label.font_weight) || defaultTypography.label.font_weight,
        },
        annotation: {
            font_family: (typographyConfig.annotation && typographyConfig.annotation.font_family) || defaultTypography.annotation.font_family,
            font_size: (typographyConfig.annotation && typographyConfig.annotation.font_size) || defaultTypography.annotation.font_size,
            font_weight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || defaultTypography.annotation.font_weight,
        }
    };

    const defaultColorsDark = {
        field: {},
        other: { primary: "#5699EF" },
        available_colors: ["#5699EF", "#DE4E4E", "#8BC34A", "#FFC107", "#2196F3", "#9C27B0", "#FF9800", "#00BCD4", "#795548", "#607D8B"],
        background_color: "#1E1E1E",
        text_color: "#EAEAEA"
    };

    fillStyle.subplotTitleColor = colorsConfig.text_color || defaultColorsDark.text_color;
    fillStyle.axisLabelColor = (colorsConfig.text_color ? d3.color(colorsConfig.text_color).darker(0.3).toString() : null) || "#d5d5d5";
    fillStyle.dataValueLabelColor = (colorsConfig.text_color ? d3.color(colorsConfig.text_color).darker(0.3).toString() : null) || "#d5d5d5";
    fillStyle.gridLineColor = (colorsConfig.other && colorsConfig.other.grid) || "#333333";
    fillStyle.axisLineColor = (colorsConfig.other && colorsConfig.other.axis) || "#999999";
    fillStyle.imageBorderColor = (colorsConfig.other && colorsConfig.other.image_border) || "#FFFFFF";
    fillStyle.chartBackground = colorsConfig.background_color || defaultColorsDark.background_color;

    const uniqueGroupNames = [...new Set(chartData.map(d => d[groupFieldName]))].sort();

    fillStyle.getGroupLineColor = (groupName, groupIndex) => {
        if (colorsConfig.field && colorsConfig.field[groupName]) {
            return colorsConfig.field[groupName];
        }
        const allColors = colorsConfig.available_colors || defaultColorsDark.available_colors;
        return allColors[groupIndex % allColors.length];
    };

    function estimateTextWidth(text, fontProps) {
        if (!text || !fontProps) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.font_family);
        textElement.setAttribute('font-size', fontProps.font_size);
        textElement.setAttribute('font-weight', fontProps.font_weight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            const fontSize = parseFloat(fontProps.font_size) || 12;
            width = text.length * fontSize * 0.6; // Fallback crude estimate
        }
        return width;
    }
    
    function parseDate(dateString) {
        if (dateString instanceof Date) return dateString;
        if (typeof dateString === 'number') return new Date(dateString); // Handle timestamps
        const date = new Date(dateString); // Handles ISO 8601 and some other formats
        if (isNaN(date.getTime())) {
            // console.warn(`Failed to parse date: ${dateString}`);
            return null;
        }
        return date;
    }

    function createXAxisScaleAndTicks(allChartData, currentXFieldName, currentInnerWidth, dateParserFunc) {
        const allXValues = allChartData.map(d => dateParserFunc(d[currentXFieldName])).filter(d => d !== null).sort(d3.ascending);

        if (allXValues.length === 0) {
            const now = new Date();
            const defaultDomain = [d3.timeMonth.offset(now, -1), now];
            const tempXScale = d3.scaleTime().domain(defaultDomain).range([0, currentInnerWidth]);
            return { xScale: tempXScale, xTicks: tempXScale.ticks(5), xFormat: d3.timeFormat("%b %d") };
        }

        const xMin = allXValues[0];
        const xMax = allXValues[allXValues.length - 1];
        const currentXScale = d3.scaleTime().domain([xMin, xMax]).range([0, currentInnerWidth]);
        const timeSpanDays = (xMax.getTime() - xMin.getTime()) / (1000 * 60 * 60 * 24);
        let currentXFormat;

        if (timeSpanDays <= 2) { currentXFormat = d3.timeFormat("%H:%M"); }
        else if (timeSpanDays <= 14) { currentXFormat = d3.timeFormat("%a %d"); }
        else if (timeSpanDays <= 180) { currentXFormat = d3.timeFormat("%b"); }
        else if (timeSpanDays <= 365 * 3) { currentXFormat = d3.timeFormat("%b %Y"); }
        else { currentXFormat = d3.timeFormat("%Y"); }

        return { xScale: currentXScale, xTicks: currentXScale.ticks(5), xFormat: currentXFormat };
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Overall margins for the SVG container

    const numGroups = uniqueGroupNames.length;
    const layoutRows = Math.ceil(numGroups / 2);
    const layoutCols = Math.min(numGroups, 2);
    
    const subplotWidth = (containerWidth - chartMargins.left - chartMargins.right) / layoutCols;
    const subplotHeight = (containerHeight - chartMargins.top - chartMargins.bottom) / layoutRows;
    
    const subplotMargins = { top: 60, right: 20, bottom: 40, left: 50 }; // Margins within each subplot cell
    const subplotInnerWidth = subplotWidth - subplotMargins.left - subplotMargins.right;
    const subplotInnerHeight = subplotHeight - subplotMargins.top - subplotMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    // `uniqueGroupNames` already sorted.
    // Dates will be parsed as needed by scales/lines.

    // Block 6: Scale Definition & Configuration
    // X-scale is common for all subplots, based on global X range
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartData, xFieldName, subplotInnerWidth, parseDate);
    // Y-scales are defined per subplot due to varying data ranges.

    // Block 7: Chart Component Rendering (Axes, Gridlines, Subplot Titles)
    // Block 8: Main Data Visualization Rendering (Lines)
    // Block 9: Optional Enhancements & Post-Processing (Annotations, Icons)
    // These blocks are intertwined in the loop structure for small multiples.

    uniqueGroupNames.forEach((groupName, groupIndex) => {
        const currentRow = Math.floor(groupIndex / layoutCols);
        const currentCol = groupIndex % layoutCols;

        const subplotX = chartMargins.left + currentCol * subplotWidth;
        const subplotY = chartMargins.top + currentRow * subplotHeight;

        const subplotG = svgRoot.append("g")
            .attr("class", "subplot-group")
            .attr("transform", `translate(${subplotX}, ${subplotY})`);

        const chartAreaG = subplotG.append("g")
            .attr("class", "chart-area-group")
            .attr("transform", `translate(${subplotMargins.left}, ${subplotMargins.top})`);

        const groupData = chartData.filter(d => d[groupFieldName] === groupName);
        if (groupData.length === 0) return; // Skip if no data for this group

        // Per-subplot Y-scale
        const groupYMin = d3.min(groupData, d => d[yFieldName]);
        const groupYMax = d3.max(groupData, d => d[yFieldName]);
        const yDomainMin = Math.min(0, groupYMin * (groupYMin < 0 ? 1.1 : 0.9) ); // Extend slightly, ensure 0 is included if min is positive
        const yDomainMax = groupYMax * 1.1; // Extend slightly
        
        const yScale = d3.scaleLinear()
            .domain([yDomainMin, yDomainMax])
            .range([subplotInnerHeight, 0]);
        
        // Render Y-Gridlines
        const yAxisTicks = yScale.ticks(4);
        yAxisTicks.forEach(tick => {
            chartAreaG.append("line")
                .attr("class", "gridline y-gridline")
                .attr("x1", 0)
                .attr("y1", yScale(tick))
                .attr("x2", subplotInnerWidth)
                .attr("y2", yScale(tick))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 0.5);
        });

        // Render X-Gridlines
        xTicks.forEach(tick => {
            chartAreaG.append("line")
                .attr("class", "gridline x-gridline")
                .attr("x1", xScale(tick))
                .attr("y1", 0)
                .attr("x2", xScale(tick))
                .attr("y2", subplotInnerHeight)
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 0.5);
        });

        // Render Y-Axis Line (left or right)
        const yAxisLine = chartAreaG.append("line").attr("class", "axis y-axis-line");
        if (currentCol === layoutCols - 1 || layoutCols === 1) { // Last column or only column
             yAxisLine.attr("x1", subplotInnerWidth)
                .attr("y1", 0)
                .attr("x2", subplotInnerWidth)
                .attr("y2", subplotInnerHeight);
        } else { // Not the last column
             yAxisLine.attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", 0)
                .attr("y2", subplotInnerHeight);
        }
        yAxisLine.attr("stroke", fillStyle.axisLineColor).attr("stroke-width", 1);
        
        // Render X-Axis Line (at y=0 if visible, else bottom)
        const xAxisYPosition = (yDomainMin <= 0 && yDomainMax >=0) ? yScale(0) : subplotInnerHeight;
        chartAreaG.append("line")
            .attr("class", "axis x-axis-line")
            .attr("x1", 0)
            .attr("y1", xAxisYPosition)
            .attr("x2", subplotInnerWidth)
            .attr("y2", xAxisYPosition)
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);

        // Render Subplot Title (Group Name)
        subplotG.append("text")
            .attr("class", "label subplot-title-label")
            .attr("x", subplotMargins.left + (imagesConfig.field && imagesConfig.field[groupName] ? 40 : 0)) // Adjust X if icon present
            .attr("y", 32) // Position in top margin area
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.title.font_family)
            .style("font-size", fillStyle.typography.title.font_size)
            .style("font-weight", fillStyle.typography.title.font_weight)
            .style("fill", fillStyle.subplotTitleColor)
            .text(groupName);

        // Render Group Icon/Image (if available)
        if (imagesConfig.field && imagesConfig.field[groupName]) {
            const iconUrl = imagesConfig.field[groupName];
            const maskId = `circle-mask-${groupIndex}`;
            
            defs.append("mask")
                .attr("id", maskId)
                .append("circle")
                .attr("cx", 18)
                .attr("cy", 18)
                .attr("r", 18) // Slightly smaller radius for mask to avoid edge artifacts
                .attr("fill", "white");
            
            const iconGroup = subplotG.append("g")
                .attr("class", "icon-group")
                .attr("transform", `translate(${subplotMargins.left}, 7)`); // Position in top margin area
            
            iconGroup.append("circle") // Border
                .attr("class", "image-border")
                .attr("cx", 18)
                .attr("cy", 18)
                .attr("r", 19.5)
                .attr("fill", "none")
                .attr("stroke", fillStyle.imageBorderColor)
                .attr("stroke-width", 1);
            
            iconGroup.append("image")
                .attr("class", "image icon-image")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 36)
                .attr("height", 36)
                .attr("mask", `url(#${maskId})`)
                .attr("xlink:href", iconUrl);
        }

        // Render Y-Axis Tick Labels
        yAxisTicks.forEach(tick => {
            const tickLabelG = chartAreaG.append("g").attr("class", "axis y-axis tick-label-group");
            const tickText = tickLabelG.append("text")
                .attr("class", "label y-axis-label")
                .attr("y", yScale(tick))
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.label.font_family)
                .style("font-size", fillStyle.typography.label.font_size)
                .style("font-weight", fillStyle.typography.label.font_weight)
                .style("fill", fillStyle.axisLabelColor)
                .text(tick);

            if (currentCol === layoutCols - 1 || layoutCols === 1) { // Last column or only column: labels on right
                tickText.attr("x", subplotInnerWidth + 10).attr("text-anchor", "start");
            } else { // Labels on left
                tickText.attr("x", -10).attr("text-anchor", "end");
            }
        });
        
        // Render X-Axis Tick Labels
        xTicks.forEach(tick => {
            chartAreaG.append("text")
                .attr("class", "label x-axis-label")
                .attr("x", xScale(tick))
                .attr("y", subplotInnerHeight + 25) // Position below x-axis line
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.label.font_family)
                .style("font-size", fillStyle.typography.label.font_size)
                .style("font-weight", fillStyle.typography.label.font_weight)
                .style("fill", fillStyle.axisLabelColor)
                .text(xFormat(tick));
        });

        // Define Line Generator
        const lineGenerator = d3.line()
            .x(d => xScale(parseDate(d[xFieldName])))
            .y(d => yScale(d[yFieldName]))
            .defined(d => parseDate(d[xFieldName]) !== null && d[yFieldName] !== null && !isNaN(d[yFieldName])) // Handle null/invalid data points
            .curve(d3.curveStepAfter);

        // Render Line Path
        chartAreaG.append("path")
            .datum(groupData.sort((a, b) => parseDate(a[xFieldName]) - parseDate(b[xFieldName]))) // Ensure data is sorted by date for line
            .attr("class", "mark data-line")
            .attr("fill", "none")
            .attr("stroke", fillStyle.getGroupLineColor(groupName, groupIndex))
            .attr("stroke-width", 2.5)
            .attr("d", lineGenerator);
        
        // Render Final Data Point Label (Annotation)
        const validGroupData = groupData
            .map(d => ({ ...d, parsedDate: parseDate(d[xFieldName]) }))
            .filter(d => d.parsedDate !== null && d[yFieldName] !== null && !isNaN(d[yFieldName]))
            .sort((a, b) => a.parsedDate - b.parsedDate);

        if (validGroupData.length > 0) {
            const lastPoint = validGroupData[validGroupData.length - 1];
            let labelOffsetY = -10; // Default above
            if (validGroupData.length > 1) {
                const secondLastPoint = validGroupData[validGroupData.length - 2];
                if (lastPoint[yFieldName] < secondLastPoint[yFieldName]) { // Going down
                    labelOffsetY = 20; // Place below
                }
            }
            
            const labelOffsetX = (currentCol === layoutCols - 1 || layoutCols === 1) ? -10 : 10; // Adjust X to be inside chart area slightly
            const textAnchor = (currentCol === layoutCols - 1 || layoutCols === 1) ? "end" : "start";

            chartAreaG.append("text")
                .attr("class", "label data-value-label annotation")
                .attr("x", xScale(lastPoint.parsedDate) + labelOffsetX)
                .attr("y", yScale(lastPoint[yFieldName]) + labelOffsetY)
                .attr("text-anchor", textAnchor)
                .style("font-family", fillStyle.typography.annotation.font_family)
                .style("font-size", fillStyle.typography.annotation.font_size)
                .style("font-weight", fillStyle.typography.annotation.font_weight)
                .style("fill", fillStyle.dataValueLabelColor)
                .text(lastPoint[yFieldName].toFixed(1));
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}