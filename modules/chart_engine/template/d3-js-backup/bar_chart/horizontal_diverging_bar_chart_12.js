/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_12",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "compact",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // Assuming light theme, or data.colors_dark if specified for dark themes
    const images = data.images || {}; // Extracted per spec, though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const groupFieldName = dataColumns.find(col => col.role === "group")?.name;

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        if (!groupFieldName) missingFields.push("group role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldUnitSpec = dataColumns.find(col => col.role === "x")?.unit;
    const valueFieldUnitSpec = dataColumns.find(col => col.role === "y")?.unit;
    const groupFieldUnitSpec = dataColumns.find(col => col.role === "group")?.unit;

    const categoryFieldUnit = (categoryFieldUnitSpec && categoryFieldUnitSpec !== "none") ? categoryFieldUnitSpec : "";
    const valueFieldUnit = (valueFieldUnitSpec && valueFieldUnitSpec !== "none") ? valueFieldUnitSpec : "";
    const groupFieldUnit = (groupFieldUnitSpec && groupFieldUnitSpec !== "none") ? groupFieldUnitSpec : "";


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            categoryLabel: {
                font_family: rawTypography.label?.font_family || "Arial, sans-serif",
                font_size: rawTypography.label?.font_size || "12px",
                font_weight: rawTypography.label?.font_weight || "normal",
            },
            valueLabel: {
                font_family: rawTypography.annotation?.font_family || "Arial, sans-serif",
                font_size: rawTypography.annotation?.font_size || "10px",
                font_weight: rawTypography.annotation?.font_weight || "normal",
            },
            groupHeaderLabel: {
                font_family: rawTypography.label?.font_family || "Arial, sans-serif",
                font_size: rawTypography.label?.font_size || "14px",
                font_weight: rawTypography.label?.font_weight || "bold",
            }
        },
        textColor: rawColors.text_color || "#333333",
        centerSeparatorLineColor: "#CCCCCC",
        chartBackground: rawColors.background_color || "transparent",
        // Group colors are assigned dynamically below
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: getBBox on a detached element is generally supported in modern browsers.
        // If issues arise, a temporary append/remove to DOM might be needed, but prompt forbids it.
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback or log, though ideally this should not happen in supported environments.
            console.warn("estimateTextWidth: getBBox failed for detached element. Text:", text, e);
        }
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    const defaultColorPalette = d3.schemeCategory10;
    let colorPaletteIndex = 0;
    const assignedGroupColors = {};

    function getGroupColor(groupName) {
        if (assignedGroupColors[groupName]) {
            return assignedGroupColors[groupName];
        }
        let color;
        if (rawColors.field && rawColors.field[groupName]) {
            color = rawColors.field[groupName];
        } else if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            color = rawColors.available_colors[colorPaletteIndex % rawColors.available_colors.length];
            colorPaletteIndex++;
        } else {
            color = defaultColorPalette[colorPaletteIndex % defaultColorPalette.length];
            colorPaletteIndex++;
        }
        assignedGroupColors[groupName] = color;
        return color;
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 70, bottom: 40, left: 70 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const plotAreaCenterX = chartMargins.left + innerWidth / 2;

    // Block 5: Data Preprocessing & Transformation
    const allCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    if (groups.length !== 2) {
        const errorMsg = `This chart requires exactly 2 groups. Found ${groups.length}: ${groups.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    const leftGroupName = groups[0];
    const rightGroupName = groups[1];

    fillStyle.leftGroupColor = getGroupColor(leftGroupName);
    fillStyle.rightGroupColor = getGroupColor(rightGroupName);

    const leftMax = d3.max(chartDataArray.filter(d => d[groupFieldName] === leftGroupName), d => Math.abs(+d[valueFieldName])) || 0;
    const rightMax = d3.max(chartDataArray.filter(d => d[groupFieldName] === rightGroupName), d => Math.abs(+d[valueFieldName])) || 0;
    const overallMax = Math.max(leftMax, rightMax);

    const maxSegmentsPerSide = 20;
    const valuePerSegment = overallMax > 0 ? Math.ceil(overallMax / maxSegmentsPerSide) : 1;

    let maxCategoryLabelWidth = 0;
    allCategories.forEach(cat => {
        const formattedCatName = categoryFieldUnit ? `${cat}${categoryFieldUnit}` : `${cat}`;
        const textWidth = estimateTextWidth(
            formattedCatName,
            fillStyle.typography.categoryLabel.font_family,
            fillStyle.typography.categoryLabel.font_size,
            fillStyle.typography.categoryLabel.font_weight
        );
        maxCategoryLabelWidth = Math.max(maxCategoryLabelWidth, textWidth);
    });
    const centerLabelAreaPadding = 15;
    const centerLabelAreaWidth = maxCategoryLabelWidth + centerLabelAreaPadding * 2;

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(allCategories)
        .range([0, innerHeight])
        .padding(0.2);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendSquareSize = 12;
    const legendSpacing = 5;
    const legendYPos = chartMargins.top / 2;

    const formattedLeftGroupName = groupFieldUnit ? `${leftGroupName}${groupFieldUnit}` : `${leftGroupName}`;
    const leftGroupHeaderWidth = estimateTextWidth(
        formattedLeftGroupName,
        fillStyle.typography.groupHeaderLabel.font_family,
        fillStyle.typography.groupHeaderLabel.font_size,
        fillStyle.typography.groupHeaderLabel.font_weight
    );
    const leftGroupHeaderX = plotAreaCenterX - centerLabelAreaWidth / 2 - 20 - leftGroupHeaderWidth - legendSquareSize - legendSpacing;

    svgRoot.append("rect")
        .attr("class", "mark legend-mark")
        .attr("x", leftGroupHeaderX)
        .attr("y", legendYPos - legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.leftGroupColor);

    svgRoot.append("text")
        .attr("class", "label group-header-label")
        .attr("x", leftGroupHeaderX + legendSquareSize + legendSpacing)
        .attr("y", legendYPos)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.groupHeaderLabel.font_family)
        .style("font-size", fillStyle.typography.groupHeaderLabel.font_size)
        .style("font-weight", fillStyle.typography.groupHeaderLabel.font_weight)
        .style("fill", fillStyle.textColor)
        .text(formattedLeftGroupName);

    const formattedRightGroupName = groupFieldUnit ? `${rightGroupName}${groupFieldUnit}` : `${rightGroupName}`;
    const rightGroupHeaderX = plotAreaCenterX + centerLabelAreaWidth / 2 + 20;

    svgRoot.append("rect")
        .attr("class", "mark legend-mark")
        .attr("x", rightGroupHeaderX)
        .attr("y", legendYPos - legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.rightGroupColor);

    svgRoot.append("text")
        .attr("class", "label group-header-label")
        .attr("x", rightGroupHeaderX + legendSquareSize + legendSpacing)
        .attr("y", legendYPos)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.groupHeaderLabel.font_family)
        .style("font-size", fillStyle.typography.groupHeaderLabel.font_size)
        .style("font-weight", fillStyle.typography.groupHeaderLabel.font_weight)
        .style("fill", fillStyle.textColor)
        .text(formattedRightGroupName);

    svgRoot.append("line")
        .attr("class", "separator center-line")
        .attr("x1", plotAreaCenterX)
        .attr("y1", chartMargins.top)
        .attr("x2", plotAreaCenterX)
        .attr("y2", containerHeight - chartMargins.bottom)
        .attr("stroke", fillStyle.centerSeparatorLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const bandHeight = yScale.bandwidth();
    const segmentVisualHeight = bandHeight * 0.6;
    const segmentYOffset = (bandHeight - segmentVisualHeight) / 2;

    const segmentWidth = 8;
    const segmentSpacing = 3;

    allCategories.forEach(category => {
        const yPos = yScale(category);
        const formattedCategoryName = categoryFieldUnit ? `${category}${categoryFieldUnit}` : `${category}`;

        mainChartGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", innerWidth / 2)
            .attr("y", yPos + bandHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.categoryLabel.font_family)
            .style("font-size", fillStyle.typography.categoryLabel.font_size)
            .style("font-weight", fillStyle.typography.categoryLabel.font_weight)
            .style("fill", fillStyle.textColor)
            .text(formattedCategoryName);

        const leftDatum = chartDataArray.find(d => d[categoryFieldName] === category && d[groupFieldName] === leftGroupName);
        const rightDatum = chartDataArray.find(d => d[categoryFieldName] === category && d[groupFieldName] === rightGroupName);

        if (leftDatum && typeof leftDatum[valueFieldName] !== 'undefined') {
            const value = Math.abs(+leftDatum[valueFieldName]);
            const numSegments = value > 0 ? Math.min(maxSegmentsPerSide, Math.ceil(value / valuePerSegment)) : 0;
            const segmentsStartX = innerWidth / 2 - centerLabelAreaWidth / 2 - segmentSpacing;

            for (let i = 0; i < numSegments; i++) {
                mainChartGroup.append("rect")
                    .attr("class", "mark bar-segment left-segment")
                    .attr("x", segmentsStartX - (i + 1) * segmentWidth - i * segmentSpacing)
                    .attr("y", yPos + segmentYOffset)
                    .attr("width", segmentWidth)
                    .attr("height", segmentVisualHeight)
                    .attr("fill", fillStyle.leftGroupColor);
            }

            const valueText = `${formatValue(value)}${valueFieldUnit}`;
            const valueLabelX = segmentsStartX - (numSegments > 0 ? (numSegments * (segmentWidth + segmentSpacing) - segmentSpacing) : 0) - 5;
            mainChartGroup.append("text")
                .attr("class", "label value-label left-value-label")
                .attr("x", valueLabelX)
                .attr("y", yPos + bandHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.valueLabel.font_family)
                .style("font-size", fillStyle.typography.valueLabel.font_size)
                .style("font-weight", fillStyle.typography.valueLabel.font_weight)
                .style("fill", fillStyle.textColor)
                .text(valueText);
        }

        if (rightDatum && typeof rightDatum[valueFieldName] !== 'undefined') {
            const value = Math.abs(+rightDatum[valueFieldName]);
            const numSegments = value > 0 ? Math.min(maxSegmentsPerSide, Math.ceil(value / valuePerSegment)) : 0;
            const segmentsStartX = innerWidth / 2 + centerLabelAreaWidth / 2 + segmentSpacing;

            for (let i = 0; i < numSegments; i++) {
                mainChartGroup.append("rect")
                    .attr("class", "mark bar-segment right-segment")
                    .attr("x", segmentsStartX + i * (segmentWidth + segmentSpacing))
                    .attr("y", yPos + segmentYOffset)
                    .attr("width", segmentWidth)
                    .attr("height", segmentVisualHeight)
                    .attr("fill", fillStyle.rightGroupColor);
            }

            const valueText = `${formatValue(value)}${valueFieldUnit}`;
            const valueLabelX = segmentsStartX + (numSegments > 0 ? (numSegments * (segmentWidth + segmentSpacing) - segmentSpacing) : 0) + 5;
             mainChartGroup.append("text")
                .attr("class", "label value-label right-value-label")
                .attr("x", valueLabelX)
                .attr("y", yPos + bandHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.valueLabel.font_family)
                .style("font-size", fillStyle.typography.valueLabel.font_size)
                .style("font-weight", fillStyle.typography.valueLabel.font_weight)
                .style("fill", fillStyle.textColor)
                .text(valueText);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements applied per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}