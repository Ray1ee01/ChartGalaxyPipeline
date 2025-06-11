/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_chart_2",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 2]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data;
    const chartDataArray = chartConfig.data.data;
    const variables = chartConfig.variables || {};
    const rawTypography = chartConfig.typography || {};
    const rawColors = chartConfig.colors || {};
    const rawImages = chartConfig.images || {};
    const dataColumns = chartConfig.data.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionFieldRole = "x";
    const valueFieldRole = "y";
    const groupFieldRole = "group";

    const getField = (role) => dataColumns.find(col => col.role === role);

    const dimensionColumn = getField(dimensionFieldRole);
    const valueColumn = getField(valueFieldRole);
    const groupColumn = getField(groupFieldRole);

    if (!dimensionColumn || !valueColumn || !groupColumn) {
        const missing = [
            !dimensionColumn ? `role '${dimensionFieldRole}'` : null,
            !valueColumn ? `role '${valueFieldRole}'` : null,
            !groupColumn ? `role '${groupFieldRole}'` : null
        ].filter(Boolean).join(', ');
        const errorMsg = `Critical chart config missing: column definitions for ${missing}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const dimensionFieldName = dimensionColumn.name;
    const valueFieldName = valueColumn.name;
    const groupFieldName = groupColumn.name;

    const dimensionUnit = (dimensionColumn.unit && dimensionColumn.unit !== "none") ? dimensionColumn.unit : "";
    const valueUnit = (valueColumn.unit && valueColumn.unit !== "none") ? valueColumn.unit : "";
    const groupUnit = (groupColumn.unit && groupColumn.unit !== "none") ? groupColumn.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) || '18px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF',
        defaultCategoryColor: '#CCCCCC',
        defaultPrimaryAccent: '#1f77b4', // A default if colors.other.primary is not set
        getCategoryColor: (groupName, index) => {
            if (rawColors.field && rawColors.field[groupName]) {
                return rawColors.field[groupName];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[index % rawColors.available_colors.length];
            }
            const defaultScheme = d3.schemeCategory10;
            return defaultScheme[index % defaultScheme.length] || fillStyle.defaultCategoryColor;
        },
        getImageUrl: (itemName, type = 'field') => {
            if (type === 'field' && rawImages.field && rawImages.field[itemName]) {
                return rawImages.field[itemName];
            }
            if (type === 'other' && rawImages.other && rawImages.other[itemName]) {
                return rawImages.other[itemName];
            }
            return null;
        }
    };
    fillStyle.primaryAccent = (rawColors.other && rawColors.other.primary) || fillStyle.defaultPrimaryAccent;


    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };
    
    const formatValueWithUnit = (value) => `${formatValue(value)}${valueUnit}`;

    let _tempSvgForTextMeasurement;
    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        if (!_tempSvgForTextMeasurement) {
            _tempSvgForTextMeasurement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            _tempSvgForTextMeasurement.style.position = 'absolute';
            _tempSvgForTextMeasurement.style.visibility = 'hidden';
            _tempSvgForTextMeasurement.style.width = '0px';
            _tempSvgForTextMeasurement.style.height = '0px';
            // No need to append to DOM
        }
        const d3TempSvg = d3.select(_tempSvgForTextMeasurement);
        d3TempSvg.selectAll('*').remove(); // Clear previous text
        const tempTextNode = d3TempSvg.append('text')
            .style('font-family', fontFamily)
            .style('font-size', fontSize)
            .style('font-weight', fontWeight)
            .text(text);
        const width = tempTextNode.node().getBBox().width;
        return width;
    };
    
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
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const iconWidth = 20;
    const iconHeight = 15;
    const iconPadding = 5;
    const legendSquareSize = 12;
    const legendSpacing = 5;
    const dataLabelPadding = 5;

    let maxDimensionLabelWidth = 0;
    const uniqueDimensionNames = [...new Set(chartDataArray.map(d => d[dimensionFieldName]))];
    
    uniqueDimensionNames.forEach(dimName => {
        const formattedDimName = `${dimName}${dimensionUnit}`;
        const textWidth = estimateTextWidth(
            formattedDimName,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontSize,
            fillStyle.typography.labelFontWeight
        );
        const totalWidth = iconWidth + iconPadding + textWidth;
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, totalWidth);
    });
    
    const chartMargins = {
        top: 60, // Increased top margin for legend
        right: 80, // Space for potential outside labels
        bottom: 40,
        left: Math.max(60, maxDimensionLabelWidth + 20) // Ensure space for dimension labels and icons
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const allGroups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    // The chart is designed to display exactly two groups.
    const displayGroups = allGroups.slice(0, 2);
    if (displayGroups.length < 2) {
        const errorMsg = `Chart requires at least 2 groups, found ${displayGroups.length}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    const firstGroupName = displayGroups[0];
    const secondGroupName = displayGroups[1];

    const dimensionTotals = {};
    uniqueDimensionNames.forEach(dimName => {
        let total = 0;
        displayGroups.forEach(groupName => {
            const dataPoint = chartDataArray.find(d => d[dimensionFieldName] === dimName && d[groupFieldName] === groupName);
            if (dataPoint && typeof +dataPoint[valueFieldName] === 'number' && !isNaN(+dataPoint[valueFieldName])) {
                total += +dataPoint[valueFieldName];
            }
        });
        dimensionTotals[dimName] = total;
    });

    const sortedDimensionNames = [...uniqueDimensionNames].sort((a, b) => {
        const diff = dimensionTotals[b] - dimensionTotals[a];
        if (diff !== 0) return diff;
        return a.localeCompare(b);
    });

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensionNames)
        .range([0, innerHeight])
        .padding(0.25); // Sensible default padding

    const maxTotalValue = d3.max(Object.values(dimensionTotals)) || 0;
    
    const xScale = d3.scaleLinear()
        .domain([0, maxTotalValue * 1.05]) // Add 5% padding to the right
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top - 30})`); // Position above chart area

    let legendCurrentX = 0;
    
    [firstGroupName, secondGroupName].forEach((groupName, index) => {
        const legendItem = legendGroup.append("g")
            .attr("transform", `translate(${legendCurrentX}, 0)`)
            .attr("class", "legend-item");

        legendItem.append("rect")
            .attr("width", legendSquareSize)
            .attr("height", legendSquareSize)
            .attr("fill", fillStyle.getCategoryColor(groupName, index))
            .attr("class", "mark legend-mark");

        const legendTextContent = `${groupName}${groupUnit}`;
        const legendText = legendItem.append("text")
            .attr("x", legendSquareSize + legendSpacing)
            .attr("y", legendSquareSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(legendTextContent)
            .attr("class", "label legend-label text");
        
        legendCurrentX += legendSquareSize + legendSpacing + legendText.node().getBBox().width + legendSpacing * 3;
    });


    // Block 8: Main Data Visualization Rendering
    sortedDimensionNames.forEach((dimName) => {
        const barY = yScale(dimName);
        const barHeight = yScale.bandwidth();
        const centerY = barY + barHeight / 2;

        const dimensionRowGroup = mainChartGroup.append("g")
            .attr("class", "dimension-row")
            .attr("transform", `translate(0, ${barY})`);

        // Dimension Icon
        const iconUrl = fillStyle.getImageUrl(dimName, 'field');
        if (iconUrl) {
            dimensionRowGroup.append("image")
                .attr("x", -(iconWidth + iconPadding + chartMargins.left - (maxDimensionLabelWidth + 20))) // Adjust to align with label
                .attr("y", barHeight / 2 - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl)
                .attr("class", "icon dimension-icon image");
        }

        // Dimension Label
        dimensionRowGroup.append("text")
            .attr("x", -(iconPadding + chartMargins.left - (maxDimensionLabelWidth + 20)) + (iconUrl ? 0 : iconWidth)) // Adjust based on icon presence
            .attr("y", barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(`${dimName}${dimensionUnit}`)
            .attr("class", "label dimension-label text");

        let currentXOffset = 0;
        let totalBarWidthForLabels = 0; // Used for placing labels outside the entire stack

        const firstGroupDataPoint = chartDataArray.find(d => d[dimensionFieldName] === dimName && d[groupFieldName] === firstGroupName);
        const secondGroupDataPoint = chartDataArray.find(d => d[dimensionFieldName] === dimName && d[groupFieldName] === secondGroupName);
        
        const segmentsData = [
            { dataPoint: firstGroupDataPoint, groupName: firstGroupName, index: 0 },
            { dataPoint: secondGroupDataPoint, groupName: secondGroupName, index: 1 }
        ];

        segmentsData.forEach(segment => {
            if (segment.dataPoint && typeof +segment.dataPoint[valueFieldName] === 'number' && !isNaN(+segment.dataPoint[valueFieldName])) {
                totalBarWidthForLabels += xScale(+segment.dataPoint[valueFieldName]);
            }
        });
        
        let lastSegmentHadOutsideLabel = false;

        segmentsData.forEach((segment, segmentIndex) => {
            if (!segment.dataPoint || typeof +segment.dataPoint[valueFieldName] !== 'number' || isNaN(+segment.dataPoint[valueFieldName])) return;

            const value = +segment.dataPoint[valueFieldName];
            if (value <= 0) return; // Do not render zero or negative value segments

            const segmentWidth = xScale(value);

            dimensionRowGroup.append("rect")
                .attr("x", currentXOffset)
                .attr("y", 0) // Relative to dimensionRowGroup
                .attr("width", segmentWidth)
                .attr("height", barHeight)
                .attr("fill", fillStyle.getCategoryColor(segment.groupName, segment.index))
                .attr("class", "mark bar-segment");

            // Data Label for the segment
            const labelText = formatValueWithUnit(value);
            const labelWidth = estimateTextWidth(
                labelText,
                fillStyle.typography.annotationFontFamily,
                fillStyle.typography.annotationFontSize,
                fillStyle.typography.annotationFontWeight
            );

            if (labelWidth + 2 * dataLabelPadding < segmentWidth) { // Label fits inside segment
                dimensionRowGroup.append("text")
                    .attr("x", currentXOffset + segmentWidth / 2)
                    .attr("y", barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", "#FFFFFF") // Assuming white is a good contrast
                    .text(labelText)
                    .attr("class", "label data-label value text inside");
            } else if (segmentIndex === segmentsData.length - 1 && !lastSegmentHadOutsideLabel) { 
                // Label does not fit, and it's the last segment (or only segment)
                // Place it to the right of the entire stacked bar for this dimension
                dimensionRowGroup.append("text")
                    .attr("x", totalBarWidthForLabels + dataLabelPadding)
                    .attr("y", barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(labelText)
                    .attr("class", "label data-label value text outside");
                lastSegmentHadOutsideLabel = true;
            } else {
                // Label does not fit and it's not the last segment, or last segment already has outside label
                // Omit label to avoid clutter or overlap
            }
            currentXOffset += segmentWidth;
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects, hovers, or annotations as per directives.

    // Block 10: Cleanup & SVG Node Return
    if (_tempSvgForTextMeasurement && _tempSvgForTextMeasurement.parentNode) {
        _tempSvgForTextMeasurement.parentNode.removeChild(_tempSvgForTextMeasurement);
    }
    _tempSvgForTextMeasurement = null; // Allow garbage collection

    return svgRoot.node();
}