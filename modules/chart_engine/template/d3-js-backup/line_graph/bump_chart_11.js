/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bump Chart",
  "chart_name": "bump_chart_11",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 12], [0, "inf"], [4, 10]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Could be data.colors_dark for dark themes, assuming data.colors is primary
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const timeFieldColumn = dataColumns.find(col => col.role === "x");
    const valueFieldColumn = dataColumns.find(col => col.role === "y");
    const groupFieldColumn = dataColumns.find(col => col.role === "group");

    const timeFieldName = timeFieldColumn ? timeFieldColumn.name : undefined;
    const valueFieldName = valueFieldColumn ? valueFieldColumn.name : undefined;
    const groupFieldName = groupFieldColumn ? groupFieldColumn.name : undefined;

    if (!timeFieldName || !valueFieldName || !groupFieldName) {
        const missingFields = [
            !timeFieldName ? "x role field" : null,
            !valueFieldName ? "y role field" : null,
            !groupFieldName ? "group role field" : null
        ].filter(Boolean).join(", ");

        console.error(`Critical chart config missing: [${missingFields}]. Cannot render.`);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Critical chart configuration missing: ${missingFields}. Chart cannot be rendered.</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colors.text_color || '#0F223B',
        chartBackground: colors.background_color || '#FFFFFF',
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
        },
        getGroupColor: (groupName, index) => {
            if (colors.field && colors.field[groupName]) {
                return colors.field[groupName];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return d3.schemeCategory10[index % 10];
        }
    };

    function estimateTextDimensions(text, styles) {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvgNode.style.position = 'absolute';
        tempSvgNode.style.visibility = 'hidden';
        tempSvgNode.style.width = '0px'; // Ensure it doesn't occupy space if accidentally appended
        tempSvgNode.style.height = '0px';

        const textElement = d3.select(tempSvgNode).append('text')
            .style('font-family', styles.fontFamily)
            .style('font-size', styles.fontSize)
            .style('font-weight', styles.fontWeight)
            .text(text);
        
        const bbox = textElement.node().getBBox();
        // No need to remove tempSvgNode as it was never added to the DOM
        return { width: bbox.width, height: bbox.height };
    }
    
    function getAdaptedFontSize(text, maxWidth, initialFontSize, fontFamily, fontWeight) {
        let fontSize = parseFloat(initialFontSize);
        const styles = { fontFamily, fontWeight, fontSize: fontSize + 'px' };

        while (fontSize > 1) {
            styles.fontSize = fontSize + 'px';
            const { width } = estimateTextDimensions(text, styles);
            if (width <= maxWidth) {
                break;
            }
            fontSize -= 1;
        }
        return fontSize;
    }

    function hexagonPath(cx, cy, r) {
        const angles = d3.range(6).map(i => (i * Math.PI / 3) + (Math.PI / 6));
        const points = angles.map(angle => [
            cx + r * Math.sin(angle),
            cy - r * Math.cos(angle)
        ]);
        return d3.line()(points) + "Z";
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format(".1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format(".1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format(".0f")(value / 1000) + "K";
        return d3.format(".0f")(value);
    };

    function isColorLight(hexColor) {
        const color = d3.color(hexColor);
        if (!color) return false;
        const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b);
        return luminance > 160;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("class", "chart-svg bump-chart-svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink") // Kept for potential compatibility, though not strictly used
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.marginTop || 60,
        right: variables.marginRight || 50,
        bottom: variables.marginBottom || 50,
        left: variables.marginLeft || 60 // Initial left margin, will be adjusted
    };
    
    const timePoints = [...new Set(chartData.map(d => d[timeFieldName]))].sort((a, b) => {
        // Basic sort, assumes time points are comparable (e.g., strings like "Q1", "Q2" or numbers)
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
    });
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];

    let maxGroupLabelWidth = 0;
    groups.forEach(group => {
        const { width } = estimateTextDimensions(group, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        maxGroupLabelWidth = Math.max(maxGroupLabelWidth, width);
    });
    
    const groupLabelPadding = 15; // Padding between group label and the start of the chart drawing area
    chartMargins.left = Math.max(chartMargins.left, maxGroupLabelWidth + groupLabelPadding);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
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
        console.error("Data integrity issue: Each group must have data for all time points. Chart cannot be rendered.");
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Data integrity issue: Each group must have data for all time points. Chart cannot be rendered.</div>`);
        return null;
    }

    const maxValue = d3.max(chartData, d => +d[valueFieldName]);

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
        .domain([0, maxValue || 1]) // Ensure domain max is at least 1 to avoid issues with all zero values
        .clamp(true); // Range set dynamically per data point later

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Group Labels (Y-axis)
    groups.forEach(group => {
        mainChartGroup.append("text")
            .attr("class", "label group-label axis-label y-axis-label")
            .attr("x", -groupLabelPadding)
            .attr("y", yScale(group) + yScale.bandwidth() / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);
    });

    // Time Point Labels (X-axis)
    const timeLabelYOffset = -20; // Position above the chart content area
    timePoints.forEach(timePoint => {
        const timePointStr = String(timePoint);
        const adaptedTimeLabelFontSize = getAdaptedFontSize(
            timePointStr,
            xScale.bandwidth(),
            parseFloat(fillStyle.typography.labelFontSize),
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontWeight
        );

        mainChartGroup.append("text")
            .attr("class", "label time-label axis-label x-axis-label")
            .attr("x", xScale(timePoint) + xScale.bandwidth() / 2)
            .attr("y", timeLabelYOffset)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", adaptedTimeLabelFontSize + "px")
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(timePointStr);
    });

    // Block 8: Main Data Visualization Rendering
    groups.forEach((group, groupIndex) => {
        const groupColor = fillStyle.getGroupColor(group, groupIndex);

        const lineGenerator = d3.line()
            .x(d => xScale(d[timeFieldName]) + xScale.bandwidth() / 2)
            .y(d => yScale(d[groupFieldName]) + yScale.bandwidth() / 2);

        const groupData = chartData
            .filter(d => d[groupFieldName] === group)
            .sort((a, b) => timePoints.indexOf(a[timeFieldName]) - timePoints.indexOf(b[timeFieldName]));

        if (groupData.length >= 2) {
            mainChartGroup.append("path")
                .attr("class", "mark line series-line")
                .datum(groupData)
                .attr("fill", "none")
                .attr("stroke", groupColor)
                .attr("stroke-width", 2)
                .attr("d", lineGenerator);
        }

        groupData.forEach(d => {
            const cx = xScale(d[timeFieldName]) + xScale.bandwidth() / 2;
            const cy = yScale(d[groupFieldName]) + yScale.bandwidth() / 2;
            const value = +d[valueFieldName];

            const maxRadiusForCellWidth = (xScale.bandwidth() / 2) * 0.9;
            const maxRadiusForCellHeight = (yScale.bandwidth() / 2) * 0.9;
            const maxPossibleRadius = Math.min(maxRadiusForCellWidth, maxRadiusForCellHeight, 25); // Cap max radius
            
            const minCircleArea = Math.PI * Math.pow(2, 2); // Min radius 2px
            const maxCircleArea = Math.PI * Math.pow(maxPossibleRadius, 2);
            areaScale.range([minCircleArea, maxCircleArea]); // Set range for areaScale

            const circleArea = areaScale(value);
            const circleRadius = Math.max(1, Math.sqrt(circleArea / Math.PI)); // Ensure radius is at least 1

            let finalHexColor = groupColor;
            if (timePoints.length > 1) {
                const baseColorObject = d3.color(groupColor);
                if (baseColorObject) {
                    const brightnessParamMax = 1.5; // Adjusted from 2 for potentially less extreme effect
                    const timePointIndex = timePoints.indexOf(d[timeFieldName]);
                    const kFactor = brightnessParamMax * (-1 + (2 * timePointIndex) / (timePoints.length - 1));
                    
                    if (kFactor > 0) finalHexColor = baseColorObject.brighter(kFactor).toString();
                    else if (kFactor < 0) finalHexColor = baseColorObject.darker(Math.abs(kFactor)).toString();
                    else finalHexColor = baseColorObject.toString();
                }
            }

            mainChartGroup.append("path")
                .attr("class", "mark data-point hexagon")
                .attr("d", hexagonPath(cx, cy, circleRadius))
                .attr("fill", finalHexColor)
                .attr("stroke", fillStyle.chartBackground) // Use chart background for stroke for "cutout" effect
                .attr("stroke-width", 1);

            const formattedValue = formatValue(value);
            const initialAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
            const annotationMaxWidth = xScale.bandwidth() * 0.9; // Max width for label within cell

            const annotationFontSize = getAdaptedFontSize(
                formattedValue,
                annotationMaxWidth, // Max width for label is constrained by hexagon/cell
                initialAnnotationFontSize,
                fillStyle.typography.annotationFontFamily,
                fillStyle.typography.annotationFontWeight
            );

            const textMetrics = estimateTextDimensions(formattedValue, {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: annotationFontSize + 'px',
                fontWeight: fillStyle.typography.annotationFontWeight
            });
            
            const innerHexagonRadiusFactor = 0.866; // sqrt(3)/2
            if (circleRadius * innerHexagonRadiusFactor * 2 >= textMetrics.width + 4 && circleRadius * innerHexagonRadiusFactor * 2 >= textMetrics.height + 2) { // Check both width and height with padding
                mainChartGroup.append("text")
                    .attr("class", "label data-value")
                    .attr("x", cx)
                    .attr("y", cy)
                    .attr("dominant-baseline", "central")
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", annotationFontSize + "px")
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", isColorLight(finalHexColor) ? '#000000' : '#FFFFFF')
                    .text(formattedValue);
            } else if (circleRadius < textMetrics.height * 0.75) { // If hexagon is too small, place label below
                const labelPaddingBelowHexagon = 3;
                mainChartGroup.append("text")
                    .attr("class", "label data-value")
                    .attr("x", cx)
                    .attr("y", cy + circleRadius + labelPaddingBelowHexagon)
                    .attr("dominant-baseline", "hanging")
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", annotationFontSize + "px") // Use adapted size
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formattedValue);
            }
            // If label doesn't fit inside and hexagon is not too small, label might be omitted if it would overlap too much.
            // The original logic had an 'else' for placing below. This version is more restrictive to avoid clutter.
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (Brightness variation and dynamic font sizing are integrated above)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}