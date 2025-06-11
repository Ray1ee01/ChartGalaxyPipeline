/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples Spline Chart",
  "chart_name": "small_multiples_spline_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 8]],
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const config = data;
    const chartDataArray = config.data.data;
    const chartVariables = config.variables || {};
    const typographyInput = config.typography || {};
    const colorsInput = config.colors || {};
    const imagesInput = config.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = config.data.columns || [];

    const xFieldCol = dataColumns.find(col => col.role === 'x');
    const yFieldCol = dataColumns.find(col => col.role === 'y');
    const groupFieldCol = dataColumns.find(col => col.role === 'group');

    const xFieldName = xFieldCol ? xFieldCol.name : undefined;
    const yFieldName = yFieldCol ? yFieldCol.name : undefined;
    const groupFieldName = groupFieldCol ? groupFieldCol.name : undefined;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push("x-role field");
        if (!yFieldName) missingFields.push("y-role field");
        if (!groupFieldName) missingFields.push("group-role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };

    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) || defaultTypography.title.font_family,
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) || defaultTypography.title.font_size,
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) || defaultTypography.title.font_weight,
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || defaultTypography.label.font_family,
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || defaultTypography.label.font_size,
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || defaultTypography.label.font_weight,
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || defaultTypography.annotation.font_family,
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || defaultTypography.annotation.font_size,
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || defaultTypography.annotation.font_weight,
        },
        textColor: colorsInput.text_color || defaultColors.text_color,
        gridLineColor: colorsInput.other?.grid || "#E0E0E0", // Assuming a potential config, else default
        baselineColor: colorsInput.other?.baseline || "#888888",
        inactiveLineColor: colorsInput.other?.inactive_line || "#D3D3D3",
        chartBackground: colorsInput.background_color || defaultColors.background_color,
    };
    
    function getGroupColor(groupName, allGroupNames, C_Input, defaultPalette) {
        const colorSourceField = C_Input.field || {};
        if (colorSourceField[groupName]) {
            return colorSourceField[groupName];
        }
        const availableColors = C_Input.available_colors || defaultPalette;
        const groupIndex = allGroupNames.indexOf(groupName);
        if (groupIndex === -1) return defaultPalette[0]; // Fallback for unknown group
        return availableColors[groupIndex % availableColors.length];
    }

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight = 'normal') {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No need to append to DOM
        const width = tempText.getBBox().width;
        return width;
    }

    function findClosestDataPoint(dataArray, targetDate) {
        if (!dataArray || dataArray.length === 0) return null;
        let closest = dataArray[0];
        let minDiff = Math.abs(closest.parsedX - targetDate);
        for (let i = 1; i < dataArray.length; i++) {
            const diff = Math.abs(dataArray[i].parsedX - targetDate);
            if (diff < minDiff) {
                minDiff = diff;
                closest = dataArray[i];
            }
        }
        return closest;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartVariables.width || 800;
    const containerHeight = chartVariables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root-svg")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Global margins

    // Subplot layout calculation
    const allUniqueGroups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    let numRows, numCols;

    if (allUniqueGroups.length === 4) { numRows = 2; numCols = 2; }
    else if (allUniqueGroups.length === 5) { numRows = 2; numCols = 3; } // Special: 2 top, 3 bottom
    else if (allUniqueGroups.length === 6) { numRows = 2; numCols = 3; }
    else if (allUniqueGroups.length === 7) { numRows = 3; numCols = 3; } // Special: 2 top, 3 mid, 2 bot
    else if (allUniqueGroups.length <= 3) { numRows = 1; numCols = allUniqueGroups.length; }
    else {
        numCols = Math.ceil(Math.sqrt(allUniqueGroups.length));
        numRows = Math.ceil(allUniqueGroups.length / numCols);
    }

    const subplotWidth = (containerWidth - chartMargins.left - chartMargins.right) / numCols;
    const subplotHeight = (containerHeight - chartMargins.top - chartMargins.bottom) / numRows;
    
    const subplotMargins = { top: 40, right: 20, bottom: 40, left: 40 }; // Margins within each subplot
    const subplotInnerWidth = subplotWidth - subplotMargins.left - subplotMargins.right;
    const subplotInnerHeight = subplotHeight - subplotMargins.top - subplotMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    chartDataArray.forEach(d => {
        d.parsedX = new Date(d[xFieldName]);
        d[yFieldName] = +d[yFieldName]; // Ensure Y is numeric
    });

    const baselineValue = d3.mean(chartDataArray, d => d[yFieldName]);

    // Block 6: Scale Definition & Configuration
    const xDomain = d3.extent(chartDataArray, d => d.parsedX);
    const xScale = d3.scaleTime().domain(xDomain).range([0, subplotInnerWidth]);

    const yMin = d3.min(chartDataArray, d => d[yFieldName]);
    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([yMin * (yMin > 0 ? 0.9 : 1.1), yMax * (yMax > 0 ? 1.1 : 0.9)]) // Adjust padding based on sign
        .range([subplotInnerHeight, 0]);

    const lineGenerator = d3.line()
        .x(d => xScale(d.parsedX))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveCatmullRom.alpha(0.5));

    // Determine X-axis ticks and format
    let xTickValues;
    let xAxisTickFormat;
    const timeDiffMs = xDomain[1] - xDomain[0];
    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneMonthMs = 30 * oneDayMs;
    const oneYearMs = 365 * oneDayMs;

    if (timeDiffMs > 2 * oneYearMs) {
        xTickValues = xScale.ticks(d3.timeYear.every(Math.max(1, Math.ceil(timeDiffMs / oneYearMs / 5))));
        xAxisTickFormat = d3.timeFormat("%Y");
    } else if (timeDiffMs > 2 * oneMonthMs) {
        xTickValues = xScale.ticks(d3.timeMonth.every(Math.max(1, Math.ceil(timeDiffMs / oneMonthMs / 5))));
        xAxisTickFormat = d3.timeFormat("%b %Y");
    } else if (timeDiffMs > 2 * oneDayMs) {
        xTickValues = xScale.ticks(d3.timeDay.every(Math.max(1, Math.ceil(timeDiffMs / oneDayMs / 5))));
        xAxisTickFormat = d3.timeFormat("%b %d");
    } else {
        xTickValues = xScale.ticks(d3.timeHour.every(Math.max(1, Math.ceil(timeDiffMs / (60 * 60 * 1000) / 5))));
        xAxisTickFormat = d3.timeFormat("%H:%M");
    }
    if (xTickValues.length === 0 && xDomain[0] && xDomain[1]) { // Ensure at least start and end if auto-ticks fail
        xTickValues = [xDomain[0], xDomain[1]];
    }


    // Block 7 & 8: Chart Component Rendering & Main Data Visualization (Iterating through subplots)
    allUniqueGroups.forEach((group, i) => {
        let currentRow, currentCol;
        if (allUniqueGroups.length === 5) {
            if (i < 2) { currentRow = 0; currentCol = i + 0.5; } 
            else { currentRow = 1; currentCol = i - 2; }
        } else if (allUniqueGroups.length === 7) {
            if (i < 2) { currentRow = 0; currentCol = i + 0.5; } 
            else if (i < 5) { currentRow = 1; currentCol = i - 2; } 
            else { currentRow = 2; currentCol = (i - 5) + 0.5; }
        } else {
            currentRow = Math.floor(i / numCols);
            currentCol = i % numCols;
        }

        const subplotX = chartMargins.left + currentCol * subplotWidth;
        const subplotY = chartMargins.top + currentRow * subplotHeight;

        const subplotGroup = svgRoot.append("g")
            .attr("class", "subplot mark")
            .attr("transform", `translate(${subplotX}, ${subplotY})`);

        const subplotContentGroup = subplotGroup.append("g")
            .attr("class", "subplot-content")
            .attr("transform", `translate(${subplotMargins.left}, ${subplotMargins.top})`);

        // Subplot Title (acting as legend)
        const titleRectWidth = 30;
        const titleRectHeight = 3;
        const titleSpacing = 5;
        const titleFontSizePx = parseInt(fillStyle.typography.titleFontSize);
        const titleTextWidth = estimateTextWidth(group, fillStyle.typography.titleFontFamily, fillStyle.typography.titleFontSize, fillStyle.typography.titleFontWeight);
        const subplotTitleWidth = titleRectWidth + titleSpacing + titleTextWidth;
        const subplotTitleX = (subplotInnerWidth - subplotTitleWidth) / 2;

        const titleGroup = subplotContentGroup.append("g").attr("class", "subplot-title");
        titleGroup.append("rect")
            .attr("class", "mark other")
            .attr("x", subplotTitleX)
            .attr("y", -titleFontSizePx - titleSpacing - (titleRectHeight/2)) // Position above text
            .attr("width", titleRectWidth)
            .attr("height", titleRectHeight)
            .attr("fill", getGroupColor(group, allUniqueGroups, colorsInput, defaultColors.available_colors));

        titleGroup.append("text")
            .attr("class", "text title")
            .attr("x", subplotTitleX + titleRectWidth + titleSpacing)
            .attr("y", -titleFontSizePx) // Vertically align with font size
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", fillStyle.typography.titleFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);

        // Y-Axis and Gridlines
        const yAxisTicks = yScale.ticks(3);
        const yAxisGroup = subplotContentGroup.append("g").attr("class", "axis y-axis");

        yAxisTicks.forEach(tick => {
            yAxisGroup.append("line")
                .attr("class", "grid-line y-grid-line")
                .attr("x1", 0)
                .attr("y1", yScale(tick))
                .attr("x2", subplotInnerWidth)
                .attr("y2", yScale(tick))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-opacity", 0.7) // Kept for subtlety
                .attr("stroke-dasharray", "2,2");

            yAxisGroup.append("text")
                .attr("class", "text label y-axis-label")
                .attr("x", -5)
                .attr("y", yScale(tick))
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .style("opacity", 0.7)
                .text(d3.format(".1s")(tick));
        });
        
        // Baseline
        subplotContentGroup.append("line")
            .attr("class", "line baseline-line")
            .attr("x1", 0)
            .attr("y1", yScale(baselineValue))
            .attr("x2", subplotInnerWidth)
            .attr("y2", yScale(baselineValue))
            .attr("stroke", fillStyle.baselineColor)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");

        // X-Axis Ticks (on baseline)
        const xAxisTicksGroup = subplotContentGroup.append("g").attr("class", "axis x-axis");
        const currentGroupData = chartDataArray.filter(d => d[groupFieldName] === group);

        xTickValues.forEach(tickDate => {
            xAxisTicksGroup.append("line")
                .attr("class", "tick x-axis-tick")
                .attr("x1", xScale(tickDate))
                .attr("y1", yScale(baselineValue) - 3)
                .attr("x2", xScale(tickDate))
                .attr("y2", yScale(baselineValue) + 3)
                .attr("stroke", fillStyle.textColor) // Using textColor for contrast
                .attr("stroke-opacity", 0.5)
                .attr("stroke-width", 1);

            if (i === 0) { // Only on the first subplot
                const closestDataPoint = findClosestDataPoint(currentGroupData, tickDate);
                const isAboveBaseline = closestDataPoint && closestDataPoint[yFieldName] > baselineValue;
                const textYPosition = isAboveBaseline ? yScale(baselineValue) + 10 : yScale(baselineValue) - 10;
                const textAnchorValue = isAboveBaseline ? "start" : "end"; // Adjust anchor to avoid line
                
                xAxisTicksGroup.append("text")
                    .attr("class", "text label x-axis-label")
                    .attr("transform", `translate(${xScale(tickDate)}, ${textYPosition + 5}) rotate(90)`)
                    .attr("text-anchor", textAnchorValue) // Dynamic anchor
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", "normal") // Make less prominent than title
                    .style("fill", fillStyle.textColor)
                    .style("opacity", 0.6)
                    .text(xAxisTickFormat(tickDate));
            }
        });

        // Background lines (other groups)
        allUniqueGroups.forEach(otherGroup => {
            if (otherGroup !== group) {
                const otherGroupData = chartDataArray.filter(d => d[groupFieldName] === otherGroup);
                subplotContentGroup.append("path")
                    .datum(otherGroupData)
                    .attr("class", "line mark series-line inactive-series")
                    .attr("fill", "none")
                    .attr("stroke", fillStyle.inactiveLineColor)
                    .attr("stroke-width", 1)
                    .attr("opacity", 0.5)
                    .attr("d", lineGenerator);
            }
        });
        
        // Main line (current group)
        subplotContentGroup.append("path")
            .datum(currentGroupData)
            .attr("class", "line mark series-line active-series")
            .attr("fill", "none")
            .attr("stroke", getGroupColor(group, allUniqueGroups, colorsInput, defaultColors.available_colors))
            .attr("stroke-width", 3)
            .attr("d", lineGenerator);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactored version)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}