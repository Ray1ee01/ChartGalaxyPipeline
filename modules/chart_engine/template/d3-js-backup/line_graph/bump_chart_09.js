/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bump Chart",
  "chart_name": "bump_chart_09",
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
  "xAxis": "none",
  "yAxis": "none",
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
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const timeFieldName = dataColumns.find(col => col.role === xFieldRole)?.name;
    const valueFieldName = dataColumns.find(col => col.role === yFieldRole)?.name;
    const groupFieldName = dataColumns.find(col => col.role === groupFieldRole)?.name;

    if (!timeFieldName || !valueFieldName || !groupFieldName) {
        let missingRoles = [];
        if (!timeFieldName) missingRoles.push(`role '${xFieldRole}'`);
        if (!valueFieldName) missingRoles.push(`role '${yFieldRole}'`);
        if (!groupFieldName) missingRoles.push(`role '${groupFieldRole}'`);
        
        const errorMsg = `Critical chart configuration missing: Column assignments for ${missingRoles.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("padding", "10px")
                .html(errorMsg);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'normal',
        },
        textColor: rawColors.text_color || '#0f223b',
        chartBackground: rawColors.background_color || '#FFFFFF',
        defaultLineStrokeWidth: 2,
        getGroupColor: (group, index) => {
            if (rawColors.field && rawColors.field[group]) {
                return rawColors.field[group];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[index % rawColors.available_colors.length];
            }
            return d3.schemeCategory10[index % 10];
        },
        getGroupIconUrl: (group) => {
            return (rawImages.field && rawImages.field[group]) ? rawImages.field[group] : null;
        }
    };

    function estimateTextWidth(text, fontFamily, fontSizeWithUnit, fontWeight) {
        const svgNS = "http://www.w3.org/2000/svg";
        const tempSvg = document.createElementNS(svgNS, "svg");
        const tempText = document.createElementNS(svgNS, "text");
        tempText.setAttribute("font-family", fontFamily);
        tempText.setAttribute("font-size", fontSizeWithUnit);
        tempText.setAttribute("font-weight", fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: getBBox on detached elements can be inconsistent. This assumes it works as per III.2.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on detached elements fails
            const fontSizeNumeric = parseFloat(fontSizeWithUnit) || 10;
            return text.length * fontSizeNumeric * 0.6; // Rough estimate
        }
    }

    function getAdaptedFontSize(text, maxWidth, initialFontSizePx, fontFamily, fontWeight, minFontSizePx = 6) {
        let currentFontSize = initialFontSizePx;
        while (currentFontSize > minFontSizePx) {
            const textWidth = estimateTextWidth(text, fontFamily, currentFontSize + "px", fontWeight);
            if (textWidth <= maxWidth) {
                break;
            }
            currentFontSize -= 1;
        }
        return Math.max(currentFontSize, minFontSizePx);
    }

    const formatValueForDisplay = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format(".1f")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format(".1f")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format(".0f")(value / 1000) + "K";
        } else {
            return d3.format(".0f")(value);
        }
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 50, bottom: 50, left: 120 }; // Initial left margin
    const iconSize = 20;
    const iconPadding = 10;
    const labelPaddingBelowCircle = 5;
    const timeLabelYOffset = -20;


    // Block 5: Data Preprocessing & Transformation
    const timePoints = [...new Set(chartData.map(d => d[timeFieldName]))].sort((a, b) => {
        // Basic sort, assumes timePoints are comparable (e.g. years as numbers, or lexicographical for strings)
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
    });
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];

    // Data integrity check
    let allDataPresent = true;
    for (const group of groups) {
        for (const timePoint of timePoints) {
            const dataExists = chartData.some(d => d[groupFieldName] === group && d[timeFieldName] === timePoint);
            if (!dataExists) {
                allDataPresent = false;
                break;
            }
        }
        if (!allDataPresent) break;
    }

    if (!allDataPresent) {
        const errorMsg = "Data is incomplete: each group must have data for all time points. Chart cannot be rendered.";
        console.error(errorMsg);
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("fill", "red")
            .text(errorMsg);
        return svgRoot.node(); // Return SVG with error
    }
    
    if (groups.length === 0 || timePoints.length === 0) {
        const errorMsg = "No data available to render the chart after processing groups and time points.";
        console.error(errorMsg);
         svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("fill", "red")
            .text(errorMsg);
        return svgRoot.node();
    }


    let maxGroupLabelWidth = 0;
    groups.forEach(group => {
        const textWidth = estimateTextWidth(
            group,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontSize,
            fillStyle.typography.labelFontWeight
        );
        if (textWidth > maxGroupLabelWidth) {
            maxGroupLabelWidth = textWidth;
        }
    });
    
    const groupIconUrlExists = groups.some(g => fillStyle.getGroupIconUrl(g));
    const iconSpace = groupIconUrlExists ? (iconSize + iconPadding) : 0;
    chartMargins.left = Math.max(chartMargins.left, maxGroupLabelWidth + iconSpace + 15); // 15 for extra padding

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const maxValue = d3.max(chartData, d => +d[valueFieldName]);
    const minValue = d3.min(chartData, d => +d[valueFieldName]) > 0 ? 0 : d3.min(chartData, d => +d[valueFieldName]);


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(timePoints)
        .range([0, innerWidth])
        .padding(0.1);

    const yScale = d3.scaleBand()
        .domain(groups)
        .range([0, innerHeight])
        .padding(0.2);

    const areaScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([Math.PI * Math.pow(2, 2), Math.PI * Math.pow(Math.min(xScale.bandwidth()/2, yScale.bandwidth()/2) * 0.8, 2)]) // Min radius 2, max radius 80% of half bandwidth
        .clamp(true);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Group labels and icons
    groups.forEach((group) => {
        const groupY = yScale(group) + yScale.bandwidth() / 2;
        const iconUrl = fillStyle.getGroupIconUrl(group);
        let labelXPosition = -iconPadding;

        if (iconUrl) {
            mainChartGroup.append("image")
                .attr("xlink:href", iconUrl)
                .attr("x", -(iconSize + iconPadding))
                .attr("y", groupY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("class", "icon image group-icon");
            labelXPosition = -(iconSize + iconPadding + 5); // 5 for padding between icon and text
        } else {
             labelXPosition = -iconPadding; // Default padding from y-axis line if no icon
        }


        mainChartGroup.append("text")
            .attr("x", labelXPosition)
            .attr("y", groupY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "label group-label")
            .text(group);
    });

    // Time point labels
    timePoints.forEach(timePoint => {
        const labelText = String(timePoint); // Ensure it's a string
        const availableWidthForTimeLabel = xScale.bandwidth();
        const initialLabelFontSizePx = parseFloat(fillStyle.typography.labelFontSize);

        const adaptedTimeLabelFontSizePx = getAdaptedFontSize(
            labelText,
            availableWidthForTimeLabel,
            initialLabelFontSizePx,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontWeight
        );

        mainChartGroup.append("text")
            .attr("x", xScale(timePoint) + xScale.bandwidth() / 2)
            .attr("y", timeLabelYOffset)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", adaptedTimeLabelFontSizePx + "px")
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "label time-label")
            .text(labelText);
    });

    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[timeFieldName]) + xScale.bandwidth() / 2)
        .y(d => yScale(d[groupFieldName]) + yScale.bandwidth() / 2);

    groups.forEach((group, groupIndex) => {
        const groupData = chartData
            .filter(d => d[groupFieldName] === group)
            .sort((a, b) => timePoints.indexOf(a[timeFieldName]) - timePoints.indexOf(b[timeFieldName]));

        if (groupData.length >= 2) {
            mainChartGroup.append("path")
                .datum(groupData)
                .attr("fill", "none")
                .attr("stroke", fillStyle.getGroupColor(group, groupIndex))
                .attr("stroke-width", fillStyle.defaultLineStrokeWidth)
                .attr("class", "mark line")
                .attr("d", lineGenerator);
        }

        groupData.forEach(d => {
            const cx = xScale(d[timeFieldName]) + xScale.bandwidth() / 2;
            const cy = yScale(d[groupFieldName]) + yScale.bandwidth() / 2;
            const value = +d[valueFieldName];

            const circleArea = areaScale(value);
            const circleRadius = Math.sqrt(circleArea / Math.PI);

            mainChartGroup.append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", Math.max(0, circleRadius)) // Ensure radius is not negative
                .attr("fill", fillStyle.getGroupColor(group, groupIndex))
                .attr("class", "mark point");

            const formattedValue = formatValueForDisplay(value);
            const initialAnnotationFontSizePx = parseFloat(fillStyle.typography.annotationFontSize);
            const annotationMaxWidth = xScale.bandwidth() * 0.9; // 90% of band width

            const annotationFontSizePx = getAdaptedFontSize(
                formattedValue,
                annotationMaxWidth,
                initialAnnotationFontSizePx,
                fillStyle.typography.annotationFontFamily,
                fillStyle.typography.annotationFontWeight
            );

            mainChartGroup.append("text")
                .attr("x", cx)
                .attr("y", cy + Math.max(0, circleRadius) + labelPaddingBelowCircle)
                .attr("dominant-baseline", "hanging")
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", annotationFontSizePx + "px")
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .attr("class", "label value-label")
                .text(formattedValue);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this chart beyond core rendering.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}