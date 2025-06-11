/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_10",
  "is_composite": false,
  "required_fields": ["x", "y", "group", "group2"],
  "hierarchy": ["x", "group2"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2], [2, 5]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group2"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Prefer data.colors, fallback to data.colors_dark
    const imagesInput = data.images || {}; // Not used in this chart, but parsed per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container early

    const topicColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");
    const opinionGroupColumn = dataColumns.find(col => col.role === "group");
    const supporterGroupColumn = dataColumns.find(col => col.role === "group2");

    const topicFieldName = topicColumn ? topicColumn.name : undefined;
    const valueFieldName = valueColumn ? valueColumn.name : undefined;
    const opinionGroupFieldName = opinionGroupColumn ? opinionGroupColumn.name : undefined;
    const supporterGroupFieldName = supporterGroupColumn ? supporterGroupColumn.name : undefined;
    const valueFieldUnit = valueColumn && valueColumn.unit && valueColumn.unit !== "none" ? valueColumn.unit : "";

    const criticalFieldNames = {
        topicFieldName,
        valueFieldName,
        opinionGroupFieldName,
        supporterGroupFieldName
    };
    const missingFields = Object.entries(criticalFieldNames)
        .filter(([, value]) => !value)
        .map(([key]) => key.replace("Name", ""));

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing for role(s): ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '14px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '12px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        barBackground: '#f0f0f0',
        centerLineStroke: '#CCCCCC',
        resolvedSupporterColors: {}
    };

    const defaultPrimaryColor = (colorsInput.other && colorsInput.other.primary) || '#1f77b4';
    const defaultAvailableColors = colorsInput.available_colors && colorsInput.available_colors.length > 0 ? colorsInput.available_colors : d3.schemeCategory10;

    const uniqueSupporterGroupsForColoring = [...new Set(chartDataArray.map(d => d[supporterGroupFieldName]))];
    uniqueSupporterGroupsForColoring.forEach((sgName, i) => {
        let color;
        if (colorsInput.field && colorsInput.field[sgName]) {
            color = colorsInput.field[sgName];
        } else {
            color = defaultAvailableColors[i % defaultAvailableColors.length];
        }
        fillStyle.resolvedSupporterColors[sgName] = color || defaultPrimaryColor;
    });

    function getSupporterBaseColor(supporterName) {
        return fillStyle.resolvedSupporterColors[supporterName] || defaultPrimaryColor;
    }

    function getOpinionBarColor(supporterName, opinionIndex) {
        const baseColorStr = getSupporterBaseColor(supporterName);
        const baseColor = d3.color(baseColorStr);

        if (!baseColor) return opinionIndex === 0 ? defaultPrimaryColor : d3.color(defaultPrimaryColor)?.brighter(0.7).toString() || '#aaaaaa';

        if (opinionIndex === 0) { // Left bar (first opinion group)
            return baseColor.toString();
        } else { // Right bar (second opinion group)
            return baseColor.brighter(0.7).toString();
        }
    }

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth failed for text:", text, e);
            width = (text ? String(text).length : 0) * (parseFloat(fontSize) * 0.6); // Fallback
        }
        return width;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (Math.abs(value) >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (Math.abs(value) >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 70, right: 30, bottom: 60, left: 30 };

    const tempSupporterGroupsForLayout = [...new Set(chartDataArray.map(d => d[supporterGroupFieldName]))];
    let maxSupporterLabelWidth = 0;
    tempSupporterGroupsForLayout.forEach(supporter => {
        maxSupporterLabelWidth = Math.max(maxSupporterLabelWidth, estimateTextWidth(
            supporter,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontSize,
            fillStyle.typography.labelFontWeight
        ));
    });

    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const valueText = `${formatValue(d[valueFieldName])}${valueFieldUnit}`;
        maxValueLabelWidth = Math.max(maxValueLabelWidth, estimateTextWidth(
            valueText,
            fillStyle.typography.annotationFontFamily,
            fillStyle.typography.annotationFontSize, // Base size for estimation
            fillStyle.typography.annotationFontWeight
        ));
    });
    
    chartMargins.left = Math.max(chartMargins.left, maxSupporterLabelWidth + 15); // Space for supporter labels + padding
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 15); // Space for value labels + padding

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const topics = [...new Set(chartDataArray.map(d => d[topicFieldName]))];
    const opinionGroups = [...new Set(chartDataArray.map(d => d[opinionGroupFieldName]))];
    const supporterGroups = [...new Set(chartDataArray.map(d => d[supporterGroupFieldName]))]; // Already got this for color/layout

    if (opinionGroups.length !== 2) {
        const errorMsg = `Configuration error: The 'group' field (opinion groups) must contain exactly 2 unique values. Found: ${opinionGroups.length} (${opinionGroups.join(', ')}). Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    let globalMaxValue = 0;
    chartDataArray.forEach(d => {
        const value = +d[valueFieldName];
        if (!isNaN(value)) {
            globalMaxValue = Math.max(globalMaxValue, value);
        }
    });
    const extendedGlobalMaxValue = globalMaxValue > 0 ? globalMaxValue * 1.1 : 1; // Ensure domain is not [0,0] if all values are 0

    const labelFontSizeNumeric = parseFloat(fillStyle.typography.labelFontSize);
    const topicHeight = topics.length > 0 ? innerHeight / topics.length : innerHeight;
    const topicPadding = 15; // Space for topic title
    const opinionLabelHeight = labelFontSizeNumeric; // Height for opinion labels
    const opinionToBarSpacing = 5;
    const supporterPadding = topicHeight * 0.05; // Spacing between supporter bars within a topic

    const barRegionHeight = topicHeight - topicPadding - opinionLabelHeight - opinionToBarSpacing;
    const barHeight = supporterGroups.length > 0 ? 
        (barRegionHeight - (supporterGroups.length - 1) * supporterPadding) / supporterGroups.length : 
        barRegionHeight;


    // Block 6: Scale Definition & Configuration
    const halfWidth = innerWidth / 2;
    const xScaleLeft = d3.scaleLinear()
        .domain([0, extendedGlobalMaxValue])
        .range([halfWidth, 0]); // Left side, positive values go from center to left

    const xScaleRight = d3.scaleLinear()
        .domain([0, extendedGlobalMaxValue])
        .range([0, halfWidth]); // Right side, positive values go from center to right
    
    const uniformBackgroundWidth = halfWidth;

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    mainChartGroup.append("line")
        .attr("class", "axis center-divider")
        .attr("x1", halfWidth)
        .attr("y1", 0)
        .attr("x2", halfWidth)
        .attr("y2", innerHeight)
        .style("stroke", fillStyle.centerLineStroke)
        .style("stroke-width", 2);

    // Block 8: Main Data Visualization Rendering
    topics.forEach((topic, topicIndex) => {
        const topicY = topicIndex * topicHeight;
        const barsStartY = topicY + topicPadding + opinionLabelHeight + opinionToBarSpacing;
        const opinionLabelY = barsStartY - opinionToBarSpacing - (opinionLabelHeight / 2) + (labelFontSizeNumeric / 2); // Vertically center
        const topicTitleY = opinionLabelY - opinionLabelHeight / 2 - topicPadding + (labelFontSizeNumeric / 2);


        mainChartGroup.append("text")
            .attr("class", "label topic-title")
            .attr("x", halfWidth)
            .attr("y", topicTitleY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(topic);

        mainChartGroup.append("text")
            .attr("class", "label opinion-label left")
            .attr("x", halfWidth / 2)
            .attr("y", opinionLabelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(opinionGroups[0]);

        mainChartGroup.append("text")
            .attr("class", "label opinion-label right")
            .attr("x", halfWidth + halfWidth / 2)
            .attr("y", opinionLabelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(opinionGroups[1]);

        supporterGroups.forEach((supporter, supporterIndex) => {
            const currentBarY = barsStartY + supporterIndex * (barHeight + supporterPadding);

            mainChartGroup.append("text")
                .attr("class", "label supporter-label")
                .attr("x", -10) // Position to the left of the chart area (margin handles actual placement)
                .attr("y", currentBarY + barHeight / 2)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(supporter);

            // Background rects
            mainChartGroup.append("rect") // Left background
                .attr("class", "mark background-bar left")
                .attr("x", 0) // Starts from the beginning of the left scale range
                .attr("y", currentBarY)
                .attr("width", uniformBackgroundWidth)
                .attr("height", barHeight)
                .style("fill", fillStyle.barBackground)
                .attr("opacity", 0.7);

            mainChartGroup.append("rect") // Right background
                .attr("class", "mark background-bar right")
                .attr("x", halfWidth)
                .attr("y", currentBarY)
                .attr("width", uniformBackgroundWidth)
                .attr("height", barHeight)
                .style("fill", fillStyle.barBackground)
                .attr("opacity", 0.7);

            // Left bar (opinionGroups[0])
            const leftDataPoint = chartDataArray.find(d =>
                d[topicFieldName] === topic &&
                d[supporterGroupFieldName] === supporter &&
                d[opinionGroupFieldName] === opinionGroups[0]
            );
            if (leftDataPoint) {
                const value = +leftDataPoint[valueFieldName];
                if (!isNaN(value) && value > 0) {
                    const barW = halfWidth - xScaleLeft(value);
                    mainChartGroup.append("rect")
                        .attr("class", "mark data-bar left-bar")
                        .attr("x", xScaleLeft(value))
                        .attr("y", currentBarY)
                        .attr("width", barW)
                        .attr("height", barHeight)
                        .style("fill", getOpinionBarColor(supporter, 0));

                    const valueText = formatValue(value) + valueFieldUnit;
                    const annotationFontSizeActual = Math.min(16, Math.max(barHeight * 0.5, parseFloat(fillStyle.typography.annotationFontSize))) + 'px';
                    const textWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, annotationFontSizeActual, fillStyle.typography.annotationFontWeight);
                    const labelFitsInside = textWidth + 10 < barW;

                    mainChartGroup.append("text")
                        .attr("class", "label value-label left")
                        .attr("x", xScaleLeft(value) + (labelFitsInside ? 5 : -5))
                        .attr("y", currentBarY + barHeight / 2)
                        .attr("text-anchor", labelFitsInside ? "start" : "end")
                        .attr("dominant-baseline", "middle")
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", annotationFontSizeActual)
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .style("fill", labelFitsInside ? (d3.hsl(getOpinionBarColor(supporter, 0)).l > 0.5 ? '#000000' : '#ffffff') : fillStyle.textColor)
                        .text(valueText);
                }
            }

            // Right bar (opinionGroups[1])
            const rightDataPoint = chartDataArray.find(d =>
                d[topicFieldName] === topic &&
                d[supporterGroupFieldName] === supporter &&
                d[opinionGroupFieldName] === opinionGroups[1]
            );
            if (rightDataPoint) {
                const value = +rightDataPoint[valueFieldName];
                 if (!isNaN(value) && value > 0) {
                    const barW = xScaleRight(value);
                    mainChartGroup.append("rect")
                        .attr("class", "mark data-bar right-bar")
                        .attr("x", halfWidth)
                        .attr("y", currentBarY)
                        .attr("width", barW)
                        .attr("height", barHeight)
                        .style("fill", getOpinionBarColor(supporter, 1));

                    const valueText = formatValue(value) + valueFieldUnit;
                    const annotationFontSizeActual = Math.min(16, Math.max(barHeight * 0.5, parseFloat(fillStyle.typography.annotationFontSize))) + 'px';
                    const textWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, annotationFontSizeActual, fillStyle.typography.annotationFontWeight);
                    const labelFitsInside = textWidth + 10 < barW;
                    
                    mainChartGroup.append("text")
                        .attr("class", "label value-label right")
                        .attr("x", halfWidth + barW + (labelFitsInside ? -5 : 5))
                        .attr("y", currentBarY + barHeight / 2)
                        .attr("text-anchor", labelFitsInside ? "end" : "start")
                        .attr("dominant-baseline", "middle")
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", annotationFontSizeActual)
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .style("fill", labelFitsInside ? (d3.hsl(getOpinionBarColor(supporter, 1)).l > 0.5 ? '#000000' : '#ffffff') : fillStyle.textColor)
                        .text(valueText);
                }
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}