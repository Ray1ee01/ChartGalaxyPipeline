/* REQUIREMENTS_BEGIN
{
  "chart_type": "Sorted Lines Chart",
  "chart_name": "bump_chart_10",
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
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const timeFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    let missingFields = [];
    if (!timeFieldConfig) missingFields.push("x role");
    if (!valueFieldConfig) missingFields.push("y role");
    if (!groupFieldConfig) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: column roles [${missingFields.join(", ")}] not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMsg);
        return null;
    }

    const timeFieldName = timeFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    if (!timeFieldName || !valueFieldName || !groupFieldName) {
        const errorMsg = `Critical chart config missing: field names for roles x, y, or group are undefined. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMsg);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        colors: {
            textColor: colorsConfig.text_color || '#333333',
            backgroundColor: colorsConfig.background_color || '#FFFFFF',
            defaultLineStroke: colorsConfig.other && colorsConfig.other.primary ? colorsConfig.other.primary : '#4682B4',
            circleStrokeColor: '#FFFFFF', // Design choice for contrast
        },
        images: {}, // To be populated if needed, or accessed directly via imagesConfig
    };

    fillStyle.getGroupColor = (groupName, index) => {
        if (colorsConfig.field && colorsConfig.field[groupName]) {
            return colorsConfig.field[groupName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        return d3.schemeCategory10[index % 10];
    };

    fillStyle.getGroupImage = (groupName) => {
        if (imagesConfig.field && imagesConfig.field[groupName]) {
            return imagesConfig.field[groupName];
        }
        return null;
    };

    function measureText(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox on detached elements is supported in modern browsers.
        const bbox = tempText.getBBox();
        return { width: bbox.width, height: bbox.height };
    }

    function getAdaptedFontSize(text, maxWidth, initialFontSizePx, fontFamily, fontWeight) {
        let currentFontSize = initialFontSizePx;
        while (currentFontSize > 1) {
            const metrics = measureText(text, { fontFamily, fontSize: currentFontSize + 'px', fontWeight });
            if (metrics.width <= maxWidth && metrics.width > 0) {
                break;
            }
            if (metrics.width === 0 && currentFontSize > 1) { /* console.warn("measureText returned 0 width"); */ }
            currentFontSize -= 1;
        }
        return Math.max(1, currentFontSize);
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format(".1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format(".1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format(".0f")(value / 1000) + "K";
        return d3.format(".0f")(value);
    }

    function isColorDarkEnough(colorStr) {
        try {
            const color = d3.color(colorStr);
            if (!color) return false;
            const rgb = color.rgb();
            const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
            return luminance < 0.5; // Threshold for darkness (0 to 1 scale)
        } catch (e) {
            return false;
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
        // No viewBox as per requirements

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.marginTop || 60,    // Space for time labels
        right: variables.marginRight || 50,   // Space for potential overflow
        bottom: variables.marginBottom || 30,
        left: variables.marginLeft || 120   // Initial left margin, will be adjusted
    };

    const timePoints = [...new Set(chartDataArray.map(d => d[timeFieldName]))].sort((a, b) => {
        // Basic sort, assumes timePoints are comparable (e.g. numbers or sortable strings)
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
    });
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    let maxGroupLabelWidth = 0;
    const initialLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
    groups.forEach(group => {
        const metrics = measureText(group, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: initialLabelFontSize + 'px',
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (metrics.width > maxGroupLabelWidth) {
            maxGroupLabelWidth = metrics.width;
        }
    });

    const iconSize = 20;
    const iconPadding = 10;
    const groupLabelAreaWidth = maxGroupLabelWidth + (imagesConfig.field && Object.keys(imagesConfig.field).length > 0 ? iconSize + iconPadding : 0) + 20; // 20 for extra padding

    chartMargins.left = Math.max(chartMargins.left, groupLabelAreaWidth);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    let allDataPresent = true;
    for (const group of groups) {
        for (const timePoint of timePoints) {
            const dataExists = chartDataArray.some(d => d[groupFieldName] === group && d[timeFieldName] === timePoint);
            if (!dataExists) {
                allDataPresent = false;
                break;
            }
        }
        if (!allDataPresent) break;
    }

    if (!allDataPresent) {
        const errorMsg = "Data integrity issue: Not all groups have data for all time points. Chart cannot be rendered.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(timePoints)
        .range([0, innerWidth])
        .padding(0.1);

    const yScale = d3.scaleBand()
        .domain(groups) // Order of groups as they appear in unique set
        .range([0, innerHeight])
        .padding(0.2);

    const minCircleRadius = 2;
    const maxPossibleRadiusInBand = Math.min(xScale.bandwidth() / 2, yScale.bandwidth() / 2) * 0.9; // 0.9 for padding
    
    const areaScale = d3.scaleLinear()
        .domain([0, maxValue || 1]) // maxValue can be 0 if all values are 0
        .range([Math.PI * Math.pow(minCircleRadius, 2), Math.PI * Math.pow(maxPossibleRadiusInBand, 2)])
        .clamp(true);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Group Labels and Icons (Left "Axis")
    groups.forEach((group, index) => {
        const groupY = yScale(group) + yScale.bandwidth() / 2;
        const groupIconUrl = fillStyle.getGroupImage(group);

        let textXPosition = -iconPadding; // Default if no icon
        if (groupIconUrl) {
            mainChartGroup.append("image")
                .attr("class", "image group-icon")
                .attr("x", -iconSize - iconPadding - maxGroupLabelWidth) // Position icon to the left of text
                .attr("y", groupY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", groupIconUrl);
            textXPosition = -maxGroupLabelWidth; // Text starts after icon area
        } else {
             textXPosition = -maxGroupLabelWidth - iconPadding; // Align with where text would be if icon existed
        }


        mainChartGroup.append("text")
            .attr("class", "label group-label")
            .attr("x", textXPosition + maxGroupLabelWidth) // text-anchor end, so position at the right edge of allocated space
            .attr("y", groupY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(group);
    });

    // Time Point Labels (Top "Axis")
    const initialTimeLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
    timePoints.forEach(timePoint => {
        const adaptedTimeLabelFontSize = getAdaptedFontSize(
            String(timePoint),
            xScale.bandwidth(),
            initialTimeLabelFontSize,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontWeight
        );
        mainChartGroup.append("text")
            .attr("class", "label time-label")
            .attr("x", xScale(timePoint) + xScale.bandwidth() / 2)
            .attr("y", -10) // Position above the chart area
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", adaptedTimeLabelFontSize + "px")
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(timePoint);
    });

    // Block 8: Main Data Visualization Rendering
    const groupContainers = mainChartGroup.selectAll(".group-data-container")
        .data(groups)
        .enter()
        .append("g")
        .attr("class", "mark group-data-container"); // Using "mark" as it contains visual marks

    groupContainers.each(function(groupName, groupIndex) {
        const groupG = d3.select(this);
        const groupColor = fillStyle.getGroupColor(groupName, groupIndex);

        const groupData = chartDataArray
            .filter(d => d[groupFieldName] === groupName)
            .sort((a, b) => timePoints.indexOf(a[timeFieldName]) - timePoints.indexOf(b[timeFieldName]));

        // Line Generator
        const lineGenerator = d3.line()
            .x(d => xScale(d[timeFieldName]) + xScale.bandwidth() / 2)
            .y(d => yScale(d[groupFieldName]) + yScale.bandwidth() / 2);

        if (groupData.length >= 2) {
            groupG.append("path")
                .datum(groupData)
                .attr("class", "mark line")
                .attr("fill", "none")
                .attr("stroke", groupColor)
                .attr("stroke-width", 2)
                .attr("d", lineGenerator);
        }

        // Circles and Value Labels
        const initialAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
        groupData.forEach(d => {
            const cx = xScale(d[timeFieldName]) + xScale.bandwidth() / 2;
            const cy = yScale(d[groupFieldName]) + yScale.bandwidth() / 2;
            const value = +d[valueFieldName];

            const circleArea = areaScale(value);
            const circleRadius = Math.sqrt(circleArea / Math.PI);

            groupG.append("circle")
                .attr("class", "mark circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", Math.max(0, circleRadius)) // Ensure radius is not negative
                .attr("fill", groupColor)
                .attr("stroke", fillStyle.colors.circleStrokeColor)
                .attr("stroke-width", 1.5); // Slightly thinner stroke for circles

            const formattedValue = formatValue(value);
            const annotationMaxWidth = xScale.bandwidth() * 0.9; // Max width for label within circle or below
            
            const annotationFontSize = getAdaptedFontSize(
                formattedValue,
                annotationMaxWidth,
                initialAnnotationFontSize,
                fillStyle.typography.annotationFontFamily,
                fillStyle.typography.annotationFontWeight
            );

            const textMetrics = measureText(formattedValue, {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: annotationFontSize + 'px',
                fontWeight: fillStyle.typography.annotationFontWeight
            });

            const labelColor = isColorDarkEnough(groupColor) ? '#FFFFFF' : fillStyle.colors.textColor;
            const labelPadding = 3; // padding for text inside circle

            if (circleRadius * 2 >= textMetrics.width + labelPadding * 2 && circleRadius * 2 >= textMetrics.height + labelPadding * 2) {
                groupG.append("text")
                    .attr("class", "label value-label")
                    .attr("x", cx)
                    .attr("y", cy)
                    .attr("dominant-baseline", "central")
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", annotationFontSize + "px")
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", labelColor)
                    .text(formattedValue);
            } else {
                const labelYOffset = circleRadius + 5; // Place below circle
                groupG.append("text")
                    .attr("class", "label value-label")
                    .attr("x", cx)
                    .attr("y", cy + labelYOffset)
                    .attr("dominant-baseline", "hanging")
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", annotationFontSize + "px")
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.colors.textColor) // External labels use default text color
                    .text(formattedValue);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this refactoring beyond core requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}