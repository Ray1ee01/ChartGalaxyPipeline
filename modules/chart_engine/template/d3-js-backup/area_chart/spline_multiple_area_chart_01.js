/* REQUIREMENTS_BEGIN
{
  "chart_type": "Symmetric Area Chart",
  "chart_name": "symmetric_area_chart_01",
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
  "background": "yes",

  "elementAlignment": "center",
  "xAxis": "minimal",
  "yAxis": "minimal",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    // Prioritize data.colors_dark if present, then data.colors, then an empty object.
    const rawColors = data.colors_dark || data.colors || {};
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    if (!xFieldConfig || !yFieldConfig || !groupFieldConfig) {
        const missing = [
            !xFieldConfig ? "x field role" : null,
            !yFieldConfig ? "y field role" : null,
            !groupFieldConfig ? "group field role" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: [${missing} definition in dataColumns]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px; font-family:sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;
    const yFieldLabel = yFieldConfig.label || yFieldName;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '14px', // Adjusted default for axis title
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: rawColors.text_color || '#FFFFFF',
        axisLineColor: (rawColors.other && rawColors.other.secondary) ? rawColors.other.secondary : '#9badd3',
        centerRegionFill: (rawColors.other && rawColors.other.primary_variant) ? rawColors.other.primary_variant : '#1a2748',
        chartBackground: rawColors.background_color || '#0f223b',
        defaultGroupColors: rawColors.available_colors || d3.schemeCategory10,
        getGroupColor: (groupName, index) => {
            if (rawColors.field && rawColors.field[groupName]) {
                return rawColors.field[groupName];
            }
            return fillStyle.defaultGroupColors[index % fillStyle.defaultGroupColors.length];
        }
    };
    
    const parseDate = d3.isoParse;

    function estimateTextWidth(text, fontStyle) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // Position off-screen to avoid brief flash if appended for measurement
        // svg.style.position = 'absolute'; svg.style.left = '-9999px';
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('style', fontStyle);
        textNode.textContent = text;
        svg.appendChild(textNode);
        // Appending to DOM is more reliable but forbidden by spec for this helper.
        // document.body.appendChild(svg); 
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on non-rendered SVG fails
            const fontSizePx = parseInt(fontStyle.match(/(\d+)px/)?.[1] || 12);
            width = text.length * fontSizePx * 0.6; // Rough estimate
        }
        // if (svg.parentNode === document.body) document.body.removeChild(svg);
        return width;
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
        .attr("class", "chart-svg-root other"); // Added class

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 60, left: 20 }; // Adjusted top margin as no main title
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const centerRegionWidth = 60; 
    const halfCenterRegionWidth = centerRegionWidth / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other"); // Added class

    // Block 5: Data Preprocessing & Transformation
    if (!chartDataInput || chartDataInput.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .attr("class", "label value") // Added class
            .text("No data available to display.");
        return svgRoot.node();
    }
    
    const processedData = chartDataInput.map(d => {
        const xVal = parseDate(d[xFieldName]);
        const yVal = +d[yFieldName];
        return {
            ...d,
            [xFieldName]: xVal,
            [yFieldName]: (xVal === null || isNaN(yVal)) ? 0 : yVal // Handle invalid data points gracefully for y-value
        };
    }).filter(d => d[xFieldName] !== null); // Keep entries with valid dates for x-axis


    let uniqueGroups = [...new Set(processedData.map(d => d[groupFieldName]))];
    if (uniqueGroups.length > 2) {
        console.warn(`This chart is designed to compare two groups, but data has ${uniqueGroups.length} groups. Only the first two will be used.`);
        uniqueGroups = uniqueGroups.slice(0, 2);
    }
    if (uniqueGroups.length === 0 && processedData.length > 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .attr("class", "label value")
            .text("No valid groups found in data.");
        return svgRoot.node();
    }
    if (uniqueGroups.length === 0) { // If still no groups (e.g. processedData was empty)
         mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .attr("class", "label value")
            .text("No data to render chart.");
        return svgRoot.node();
    }


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(processedData, d => d[xFieldName]))
        .range([0, innerHeight]);

    const yMax = d3.max(processedData, d => d[yFieldName]) * 1.1 || 10; 

    const yScaleLeft = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerWidth / 2 - halfCenterRegionWidth, 0]); 

    const yScaleRight = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerWidth / 2 + halfCenterRegionWidth, innerWidth]);

    // Block 7: Chart Component Rendering (Axes, NO Main Titles/Subtitles)
    mainChartGroup.append("rect")
        .attr("x", innerWidth / 2 - halfCenterRegionWidth)
        .attr("y", 0)
        .attr("width", centerRegionWidth)
        .attr("height", innerHeight)
        .attr("fill", fillStyle.centerRegionFill)
        .attr("opacity", 0.5)
        .attr("class", "center-region-background other");

    mainChartGroup.append("line")
        .attr("x1", innerWidth / 2 - halfCenterRegionWidth)
        .attr("y1", 0)
        .attr("x2", innerWidth / 2 - halfCenterRegionWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("opacity", 0.6)
        .attr("stroke-width", 1)
        .attr("class", "axis center-axis-line mark");

    mainChartGroup.append("line")
        .attr("x1", innerWidth / 2 + halfCenterRegionWidth)
        .attr("y1", 0)
        .attr("x2", innerWidth / 2 + halfCenterRegionWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("opacity", 0.6)
        .attr("stroke-width", 1)
        .attr("class", "axis center-axis-line mark");

    const xTimeExtent = d3.extent(processedData, d => d[xFieldName]);
    const yearCount = (xTimeExtent[0] && xTimeExtent[1]) ? d3.timeYear.count(xTimeExtent[0], xTimeExtent[1]) : 0;
    const xTickInterval = d3.timeYear.every(Math.max(1, Math.floor(yearCount / 6) || 2));
    const xTicks = xScale.ticks(xTickInterval);
    const xTickFormat = d3.timeFormat("%Y");

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis");

    xTicks.forEach(tick => {
        xAxisGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", xScale(tick))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("class", "axis-label label")
            .text(xTickFormat(tick));

        xAxisGroup.append("line")
            .attr("x1", innerWidth / 2 - halfCenterRegionWidth + 10)
            .attr("y1", xScale(tick))
            .attr("x2", innerWidth / 2 - halfCenterRegionWidth)
            .attr("y2", xScale(tick))
            .attr("stroke", fillStyle.textColor)
            .attr("stroke-width", 1.5)
            .attr("class", "axis-tick mark");

        xAxisGroup.append("line")
            .attr("x1", innerWidth / 2 + halfCenterRegionWidth - 10)
            .attr("y1", xScale(tick))
            .attr("x2", innerWidth / 2 + halfCenterRegionWidth)
            .attr("y2", xScale(tick))
            .attr("stroke", fillStyle.textColor)
            .attr("stroke-width", 1.5)
            .attr("class", "axis-tick mark");
    });

    const yAxisTicks = d3.ticks(0, yMax, 5);
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    yAxisTicks.forEach(tick => {
        yAxisGroup.append("text")
            .attr("x", yScaleLeft(tick))
            .attr("y", innerHeight + 20)
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("class", "axis-label label")
            .text(tick);

        if (tick !== 0) {
            yAxisGroup.append("text")
                .attr("x", yScaleRight(tick))
                .attr("y", innerHeight + 20)
                .attr("text-anchor", "middle")
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .attr("class", "axis-label label")
                .text(tick);
        }
    });
    
    if (yFieldLabel) {
        yAxisGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight + chartMargins.bottom - 15)
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", fillStyle.typography.titleFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .attr("class", "axis-title label")
            .text(yFieldLabel);
    }

    // Block 8: Main Data Visualization Rendering (Areas and Group Labels)
    uniqueGroups.forEach((group, i) => {
        const groupColor = fillStyle.getGroupColor(group, i);
        const groupData = processedData.filter(d => d[groupFieldName] === group)
            .sort((a, b) => a[xFieldName] - b[xFieldName]);

        if (groupData.length === 0) return;

        const currentYScale = i === 0 ? yScaleLeft : yScaleRight;
        const areaGenerator = d3.area()
            .x0(i === 0 ? innerWidth / 2 - halfCenterRegionWidth : innerWidth / 2 + halfCenterRegionWidth)
            .x1(d => currentYScale(d[yFieldName]))
            .y(d => xScale(d[xFieldName]))
            .curve(d3.curveBasis);

        mainChartGroup.append("path")
            .datum(groupData)
            .attr("fill", groupColor)
            .attr("d", areaGenerator)
            .attr("class", `area mark group-${i}`); // Added class

        const groupLabelText = String(group);
        const labelYPosition = innerHeight / 2;
        const labelFontStyle = `${fillStyle.typography.labelFontWeight} ${fillStyle.typography.labelFontSize} ${fillStyle.typography.labelFontFamily}`;
        const labelFontSizePx = parseInt(fillStyle.typography.labelFontSize);
        const estimatedLabelWidth = estimateTextWidth(groupLabelText, labelFontStyle);
        
        const labelBgColor = (fillStyle.chartBackground === "transparent" || !d3.color(fillStyle.chartBackground)) 
            ? "rgba(128,128,128,0.5)" 
            : d3.color(fillStyle.chartBackground).brighter(0.5).formatRgb();

        if (i === 0) { // Left group
             mainChartGroup.append("rect")
                .attr("x", 2)
                .attr("y", labelYPosition - (labelFontSizePx / 2) - 4)
                .attr("width", estimatedLabelWidth + 10)
                .attr("height", labelFontSizePx + 8)
                .attr("fill", labelBgColor)
                .attr("opacity", 0.7)
                .attr("rx", 3)
                .attr("class", "group-label-background other");
            
            mainChartGroup.append("text")
                .attr("x", 7) 
                .attr("y", labelYPosition)
                .attr("text-anchor", "start")
                .attr("dominant-baseline", "middle")
                .attr("fill", groupColor) 
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", "bold")
                .attr("class", "group-label label")
                .text(groupLabelText);
        } else { // Right group
            mainChartGroup.append("rect")
                .attr("x", innerWidth - estimatedLabelWidth - 12) 
                .attr("y", labelYPosition - (labelFontSizePx / 2) - 4)
                .attr("width", estimatedLabelWidth + 10)
                .attr("height", labelFontSizePx + 8)
                .attr("fill", labelBgColor)
                .attr("opacity", 0.7)
                .attr("rx", 3)
                .attr("class", "group-label-background other");

            mainChartGroup.append("text")
                .attr("x", innerWidth - 7) 
                .attr("y", labelYPosition)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("fill", groupColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", "bold")
                .attr("class", "group-label label")
                .text(groupLabelText);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects, gradients, shadows, or optional enhancements in this refactor.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}