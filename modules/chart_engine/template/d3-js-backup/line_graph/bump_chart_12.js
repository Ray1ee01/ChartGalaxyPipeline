/* REQUIREMENTS_BEGIN
{
  "chart_type": "Sorted Lines Chart",
  "chart_name": "sorted_lines_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 12], [0, "inf"], [4, 10]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    d3.select(containerSelector).html(""); // Clear the container first

    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Could be data.colors_dark if theme logic was here
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const timeField = xFieldConfig ? xFieldConfig.name : undefined;
    const valueField = yFieldConfig ? yFieldConfig.name : undefined;
    const groupField = groupFieldConfig ? groupFieldConfig.name : undefined;

    if (!timeField || !valueField || !groupField) {
        const missingFields = [
            !timeField ? "x role field" : null,
            !valueField ? "y role field" : null,
            !groupField ? "group role field" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    if (chartDataArray.length === 0) {
        const errorMsg = "No data provided. Cannot render chart.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const timePoints = [...new Set(chartDataArray.map(d => d[timeField]))].sort((a, b) => {
        // Basic sort, assumes timePoints are comparable (e.g. numbers or sortable strings)
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    });
    const groups = [...new Set(chartDataArray.map(d => d[groupField]))];

    let allDataPresent = true;
    for (const group of groups) {
        for (const timePoint of timePoints) {
            const dataExists = chartDataArray.some(d => d[groupField] === group && d[timeField] === timePoint);
            if (!dataExists) {
                allDataPresent = false;
                break;
            }
        }
        if (!allDataPresent) break;
    }

    if (!allDataPresent) {
        const errorMsg = "Incomplete data: Each group must have data for all time points. Chart cannot be rendered.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) || "Arial, sans-serif",
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) || "16px",
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) || "bold",
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || "Arial, sans-serif",
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || "12px",
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || "normal",
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || "Arial, sans-serif",
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || "10px",
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || "normal",
        },
        textColor: colorsInput.text_color || "#0f223b",
        chartBackground: colorsInput.background_color || "#FFFFFF", // Not directly used on SVG, assumes container handles it or transparent
        getGroupColor: (groupName, groupIndex) => {
            const defaultCategoricalColors = d3.schemeCategory10;
            if (colorsInput.field && colorsInput.field[groupName]) {
                return colorsInput.field[groupName];
            }
            if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                return colorsInput.available_colors[groupIndex % colorsInput.available_colors.length];
            }
            return defaultCategoricalColors[groupIndex % defaultCategoricalColors.length];
        },
        getGroupIcon: (groupName) => {
            if (imagesInput.field && imagesInput.field[groupName]) {
                return imagesInput.field[groupName];
            }
            return null;
        }
    };

    function _measureTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text || String(text).trim() === "") return 0;
        const svgNS = "http://www.w3.org/2000/svg";
        const tempSvg = document.createElementNS(svgNS, "svg");
        const tempText = document.createElementNS(svgNS, "text");
        tempText.setAttribute("font-family", fontFamily);
        tempText.setAttribute("font-size", fontSize); // fontSize should be like "12px"
        tempText.setAttribute("font-weight", fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Appending to a detached SVG and then using getBBox usually works.
        return tempText.getBBox().width;
    }

    function getAdaptedFontSize(text, maxWidth, initialFontSizePx, minFontSizePx, fontFamily, fontWeight) {
        let currentSize = parseFloat(initialFontSizePx); // Number part
        const minSize = parseFloat(minFontSizePx);

        if (!text || String(text).trim() === "" || maxWidth <= 0) return minSize;

        while (currentSize > minSize) {
            const width = _measureTextWidth(text, fontFamily, currentSize + "px", fontWeight);
            if (width <= maxWidth) {
                return currentSize;
            }
            currentSize--;
        }
        return minSize;
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format(".1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format(".1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format(".0f")(value / 1000) + "K";
        return d3.format(".0f")(value);
    }

    function hexagonPath(cx, cy, r) {
        const angles = d3.range(6).map(i => (i * Math.PI / 3) + (Math.PI / 6));
        const points = angles.map(angle => [cx + r * Math.sin(angle), cy - r * Math.cos(angle)]);
        return d3.line()(points) + "Z";
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
        .attr("class", "chart-svg");
    // .style("background-color", fillStyle.chartBackground); // Optional: if SVG itself needs a background color

    // Block 4: Core Chart Dimensions & Layout Calculation
    const ICON_SIZE = 20;
    const ICON_TEXT_PADDING = 10;
    const VALUE_LABEL_PADDING_BELOW_HEXAGON = 5;
    const MIN_ADAPTIVE_FONT_SIZE_PX = 8;
    const Y_AXIS_AREA_INITIAL_WIDTH = 120; // Initial guess for left margin
    const X_AXIS_AREA_INITIAL_HEIGHT = 30; // Space for time labels at top

    let maxGroupLabelWidth = 0;
    groups.forEach(group => {
        const width = _measureTextWidth(
            group,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontSize,
            fillStyle.typography.labelFontWeight
        );
        maxGroupLabelWidth = Math.max(maxGroupLabelWidth, width);
    });
    
    const chartMargins = {
        top: X_AXIS_AREA_INITIAL_HEIGHT + 40, // Increased top margin for time labels + padding
        right: 50,
        bottom: 50,
        left: Math.max(Y_AXIS_AREA_INITIAL_WIDTH, maxGroupLabelWidth + ICON_SIZE + ICON_TEXT_PADDING + 15) // 15 for extra safety
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions are too small. Increase container size or reduce margins/paddings.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    const maxValue = d3.max(chartDataArray, d => +d[valueField]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(timePoints)
        .range([0, innerWidth])
        .padding(0.1);

    const yScale = d3.scaleBand()
        .domain(groups)
        .range([0, innerHeight])
        .padding(0.2);

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => fillStyle.getGroupColor(group, i)));

    const areaScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue : 1]) // Ensure domain max is > 0
        .range([Math.PI * Math.pow(2, 2), Math.PI * Math.pow(Math.min(xScale.bandwidth() / 2 * 0.9, yScale.bandwidth() / 2 * 0.9), 2)])
        .clamp(true);
    
    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "chart-area");

    // Group Labels and Icons (Y-axis representation)
    groups.forEach(group => {
        const groupY = yScale(group) + yScale.bandwidth() / 2;
        const groupLabelX = -(ICON_SIZE + ICON_TEXT_PADDING);

        mainChartGroup.append("text")
            .attr("class", "label y-axis-label group-label")
            .attr("x", groupLabelX)
            .attr("y", groupY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);

        const iconUrl = fillStyle.getGroupIcon(group);
        if (iconUrl) {
            mainChartGroup.append("image")
                .attr("class", "icon group-icon")
                .attr("x", -ICON_SIZE) // Icon to the left of its reserved space
                .attr("y", groupY - ICON_SIZE / 2)
                .attr("width", ICON_SIZE)
                .attr("height", ICON_SIZE)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
        }
    });

    // Time Point Labels (X-axis representation)
    timePoints.forEach(timePoint => {
        const timeLabelX = xScale(timePoint) + xScale.bandwidth() / 2;
        const timeLabelY = -X_AXIS_AREA_INITIAL_HEIGHT / 2 - 10; // Position above chart content area
        const availableWidthForTimeLabel = xScale.bandwidth();
        
        const adaptedTimeLabelFontSize = getAdaptedFontSize(
            String(timePoint),
            availableWidthForTimeLabel,
            fillStyle.typography.labelFontSize,
            MIN_ADAPTIVE_FONT_SIZE_PX + "px", // min size with "px"
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontWeight
        );

        mainChartGroup.append("text")
            .attr("class", "label x-axis-label time-label")
            .attr("x", timeLabelX)
            .attr("y", timeLabelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", adaptedTimeLabelFontSize + "px")
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(timePoint);
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    groups.forEach(group => {
        const groupData = chartDataArray
            .filter(d => d[groupField] === group)
            .sort((a, b) => timePoints.indexOf(a[timeField]) - timePoints.indexOf(b[timeField]));

        if (groupData.length >= 2) {
            const lineGenerator = d3.line()
                .x(d => xScale(d[timeField]) + xScale.bandwidth() / 2)
                .y(d => yScale(d[groupField]) + yScale.bandwidth() / 2);

            mainChartGroup.append("path")
                .datum(groupData)
                .attr("class", "mark line group-line")
                .attr("fill", "none")
                .attr("stroke", colorScale(group))
                .attr("stroke-width", 2)
                .attr("d", lineGenerator);
        }

        groupData.forEach(d => {
            const cx = xScale(d[timeField]) + xScale.bandwidth() / 2;
            const cy = yScale(d[groupField]) + yScale.bandwidth() / 2;
            const value = +d[valueField];

            const circleArea = areaScale(value);
            const circleRadius = Math.sqrt(circleArea / Math.PI);

            if (circleRadius > 0) { // Only draw if radius is positive
                mainChartGroup.append("path")
                    .attr("class", "mark point data-hexagon")
                    .attr("d", hexagonPath(cx, cy, circleRadius))
                    .attr("fill", colorScale(group));

                const formattedValue = formatValue(value);
                const annotationMaxWidth = xScale.bandwidth() * 0.9; // Max width for value label
                
                const annotationFontSize = getAdaptedFontSize(
                    formattedValue,
                    annotationMaxWidth,
                    fillStyle.typography.annotationFontSize,
                    MIN_ADAPTIVE_FONT_SIZE_PX + "px",
                    fillStyle.typography.annotationFontFamily,
                    fillStyle.typography.annotationFontWeight
                );

                mainChartGroup.append("text")
                    .attr("class", "label value-label data-value")
                    .attr("x", cx)
                    .attr("y", cy + circleRadius + VALUE_LABEL_PADDING_BELOW_HEXAGON)
                    .attr("dominant-baseline", "hanging")
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", annotationFontSize + "px")
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formattedValue);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements for this chart in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}