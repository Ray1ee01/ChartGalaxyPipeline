/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Gauge Charts",
  "chart_name": "small_multiples_gauge_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 9], [0, "inf"], [2, 3]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or data.colors_dark for dark
    const images = data.images || {}; // Though not used in this chart
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === 'x');
    const yFieldCol = dataColumns.find(col => col.role === 'y');
    const groupFieldCol = dataColumns.find(col => col.role === 'group');

    if (!xFieldCol || !yFieldCol || !groupFieldCol) {
        const missing = [
            !xFieldCol ? "'x' role" : null,
            !yFieldCol ? "'y' role" : null,
            !groupFieldCol ? "'group' role" : null
        ].filter(Boolean).join(', ');
        const errorMessage = `Critical chart config missing: Roles ${missing} not found in dataColumns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const groupFieldName = groupFieldCol.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'bold',
        },
        textColor: colors.text_color || '#0f223b',
        gaugeBackground: '#E0E0E0', // Default for background arc
        defaultPrimaryColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4',
        defaultAvailableColors: colors.available_colors || d3.schemeCategory10,
        getGroupColor: (groupName, index) => {
            if (colors.field && colors.field[groupName]) {
                return colors.field[groupName];
            }
            if (fillStyle.defaultAvailableColors.length > 0) {
                return fillStyle.defaultAvailableColors[index % fillStyle.defaultAvailableColors.length];
            }
            return fillStyle.defaultPrimaryColor;
        }
    };

    function measureText(text, style) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', style.fontFamily);
        tempText.setAttribute('font-size', style.fontSize);
        tempText.setAttribute('font-weight', style.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No need to append to DOM for getBBox
        const bbox = tempText.getBBox();
        return { width: bbox.width, height: bbox.height };
    }

    function parseFontSizeToNumber(fontSizeString) {
        if (typeof fontSizeString === 'number') return fontSizeString;
        if (typeof fontSizeString === 'string' && fontSizeString.endsWith('px')) {
            return parseFloat(fontSizeString.replace('px', ''));
        }
        return 10; // Default fallback
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
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
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .attr("class", "chart-root"); // Added class for root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 20, bottom: 20, left: 20 }; // Default margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const uniqueXValues = [...new Set(chartDataInput.map(d => d[xFieldName]))];
    const uniqueGroups = [...new Set(chartDataInput.map(d => d[groupFieldName]))];

    const groupTotals = {};
    uniqueGroups.forEach(group => {
        groupTotals[group] = chartDataInput
            .filter(d => d[groupFieldName] === group)
            .reduce((sum, d) => sum + (+d[yFieldName] || 0), 0);
    });

    const sortedGroups = uniqueGroups.sort((a, b) => groupTotals[b] - groupTotals[a]);

    const groupedData = {};
    uniqueXValues.forEach(xValue => {
        groupedData[xValue] = [];
        sortedGroups.forEach((group, groupIndex) => {
            const item = chartDataInput.find(d => d[xFieldName] === xValue && d[groupFieldName] === group);
            if (item) {
                groupedData[xValue].push({
                    group: group,
                    value: +item[yFieldName] || 0,
                    color: fillStyle.getGroupColor(group, groupIndex)
                });
            }
        });
    });

    const globalMaxValue = Math.max(1, ...chartDataInput.map(d => +d[yFieldName] || 0)); // Ensure globalMaxValue is at least 1 to prevent scale issues with all zero data

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scaleLinear().domain([0, globalMaxValue]).range([0, Math.PI]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendGroup = svgRoot.append("g")
        .attr("class", "other legend-group");

    const legendConfig = {
        itemSpacing: 15,
        iconSize: 10,
        iconTextSpacing: 5,
        yPosition: chartMargins.top / 2 // Vertically center legend in top margin
    };
    
    const legendTextStyle = {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    };

    const legendItems = sortedGroups.map((group, index) => {
        const textMetrics = measureText(group, legendTextStyle);
        return {
            label: group,
            color: fillStyle.getGroupColor(group, index),
            width: legendConfig.iconSize + legendConfig.iconTextSpacing + textMetrics.width
        };
    });

    const totalLegendWidth = legendItems.reduce((sum, item, i) =>
        sum + item.width + (i > 0 ? legendConfig.itemSpacing : 0), 0);
    const legendStartX = (containerWidth - totalLegendWidth) / 2;
    let currentLegendX = legendStartX;

    legendItems.forEach(item => {
        const itemGroup = legendGroup.append("g")
            .attr("transform", `translate(${currentLegendX}, ${legendConfig.yPosition})`);
        
        itemGroup.append("circle")
            .attr("class", "mark legend-icon")
            .attr("cx", legendConfig.iconSize / 2)
            .attr("cy", 0) // Align with text baseline
            .attr("r", legendConfig.iconSize / 2)
            .attr("fill", item.color);

        itemGroup.append("text")
            .attr("class", "label legend-text")
            .attr("x", legendConfig.iconSize + legendConfig.iconTextSpacing)
            .attr("y", 0) // Align with icon center
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", legendTextStyle.fontFamily)
            .style("font-size", legendTextStyle.fontSize)
            .style("font-weight", legendTextStyle.fontWeight)
            .text(item.label);
        currentLegendX += item.width + legendConfig.itemSpacing;
    });

    // Block 8: Main Data Visualization Rendering
    const numCharts = uniqueXValues.length;
    let rows, cols;
    if (numCharts === 0) { // Handle no data case for small multiples
        rows = 0; cols = 0;
    } else if (numCharts <= 2) { // Max 2 charts, 1 row is fine.
        rows = 1; cols = numCharts;
    } else if (numCharts <= 4) {
        rows = 2; cols = 2;
    } else if (numCharts <= 6) { // Max 6 charts
        rows = Math.ceil(numCharts / 2); cols = 2; // e.g. 5 charts -> 3 rows, 2 cols
    } else { // Max 9 charts
        rows = Math.ceil(numCharts / 3); cols = 3; // e.g. 7 charts -> 3 rows, 3 cols
    }


    const subChartWidth = cols > 0 ? innerWidth / cols : innerWidth;
    const subChartHeight = rows > 0 ? innerHeight / rows : innerHeight;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const X_CATEGORY_LABEL_STYLE = {
        fontFamily: fillStyle.typography.titleFontFamily,
        fontSize: fillStyle.typography.titleFontSize,
        fontWeight: fillStyle.typography.titleFontWeight,
    };
    const X_CATEGORY_LABEL_MARGIN_BOTTOM = 8;
    const GAUGE_VERTICAL_SCALE_FACTOR = 0.8; // How much of available vertical space gauge can use

    uniqueXValues.forEach((xValue, index) => {
        const rowIndex = Math.floor(index / cols);
        const colIndex = index % cols;
        const subChartX = colIndex * subChartWidth;
        const subChartY = rowIndex * subChartHeight;

        const subChartGroup = mainChartGroup.append("g")
            .attr("class", "other sub-chart-group")
            .attr("transform", `translate(${subChartX}, ${subChartY})`);

        const xCategoryLabelText = String(xValue);
        const xCategoryLabelHeight = measureText(xCategoryLabelText, X_CATEGORY_LABEL_STYLE).height;
        
        subChartGroup.append("text")
            .attr("class", "label x-category-label")
            .attr("x", subChartWidth / 2)
            .attr("y", xCategoryLabelHeight / 2) // Position at top, adjust for actual height
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", X_CATEGORY_LABEL_STYLE.fontFamily)
            .style("font-size", X_CATEGORY_LABEL_STYLE.fontSize)
            .style("font-weight", X_CATEGORY_LABEL_STYLE.fontWeight)
            .attr("fill", fillStyle.textColor)
            .text(xCategoryLabelText);

        const gaugeCenterY = xCategoryLabelHeight + X_CATEGORY_LABEL_MARGIN_BOTTOM + 
                             ((subChartHeight - xCategoryLabelHeight - X_CATEGORY_LABEL_MARGIN_BOTTOM) * 0.65); // Adjusted to give more space if label is tall
        const gaugeCenterX = subChartWidth / 2;
        
        const availableHeightForGauge = subChartHeight - xCategoryLabelHeight - X_CATEGORY_LABEL_MARGIN_BOTTOM;
        const maxRadius = Math.min(subChartWidth * 0.45, availableHeightForGauge * GAUGE_VERTICAL_SCALE_FACTOR * 0.5);

        const categoryData = groupedData[xValue] || [];
        const arcThickness = Math.max(8, maxRadius / (Math.max(1, categoryData.length) + 1)); // Ensure categoryData.length is at least 1
        const gapBetweenLayers = Math.max(1, arcThickness * 0.1);

        const startAngle = -Math.PI / 2;
        const endAngle = Math.PI / 2;

        const gaugeRenderGroup = subChartGroup.append("g")
            .attr("class", "other gauge-render-group")
            .attr("transform", `translate(${gaugeCenterX}, ${gaugeCenterY})`);

        categoryData.forEach((d, i) => {
            const outerRadius = maxRadius - i * (arcThickness + gapBetweenLayers);
            const innerRadius = Math.max(0, outerRadius - arcThickness);
            if (outerRadius <= innerRadius) return; // Skip if no space

            const backgroundArcGenerator = d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(outerRadius)
                .startAngle(startAngle)
                .endAngle(endAngle);

            gaugeRenderGroup.append("path")
                .attr("class", "mark gauge-background-arc")
                .attr("d", backgroundArcGenerator)
                .attr("fill", fillStyle.gaugeBackground);

            const valueArcGenerator = d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(outerRadius)
                .startAngle(startAngle);
            
            const targetAngle = startAngle + angleScale(d.value);

            gaugeRenderGroup.append("path")
                .attr("class", "mark gauge-value-arc")
                .attr("d", valueArcGenerator({ startAngle: startAngle, endAngle: targetAngle }))
                .attr("fill", d.color);

            // Value Label
            const labelRadius = (innerRadius + outerRadius) / 2;
            // Position label at the bottom center of the arc segment for horizontal gauges
            const valueLabelX = 0; // Centered horizontally under the gauge
            const valueLabelY = labelRadius + arcThickness * 0.1; // Position below the arc, adjust as needed

            const annotationStyle = {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: fillStyle.typography.annotationFontSize, // Base size
                fontWeight: fillStyle.typography.annotationFontWeight,
            };
            
            let currentFontSize = parseFontSizeToNumber(annotationStyle.fontSize);
            const maxAllowedFontSize = Math.min(arcThickness * 0.7, currentFontSize); // Max font size based on arc thickness
            const minFontSize = Math.max(5, arcThickness * 0.3);
            currentFontSize = maxAllowedFontSize;

            const formattedVal = formatValue(d.value);
            let textMetrics = measureText(formattedVal, { ...annotationStyle, fontSize: `${currentFontSize}px` });
            
            // Try to fit text, reduce font size if necessary
            // This specific label placement (bottom center) has more width available
            // For this chart, the original placed labels inside the arc, near the center point.
            // Reverting to original label placement logic:
            const originalLabelX = 0; // Center of the gauge
            const originalLabelY = (i - (categoryData.length -1) / 2) * (parseFontSizeToNumber(annotationStyle.fontSize) * 1.2); // Stacked vertically

            // If arcThickness is too small, labels might overlap or be unreadable.
            // The original logic for value label placement was complex and depended on arcThickness.
            // For simplicity and robustness, let's place it near the arc, but outside if too small.
            // The original code placed it at (labelX, labelY) which was (0, labelRadius * sin(PI) + arcThickness * 0.5)
            // This means x=0, y=arcThickness*0.5, which is at the center of the arc's thickness, at the 6 o'clock position if arc was full circle.
            // For semicircle, this is still at the center of the arc's thickness, at the bottom.
            // Let's use a simpler approach: place text at the center of the gauge, stacked.
            
            if (arcThickness > minFontSize * 1.5) { // Only draw label if there's enough space
                 gaugeRenderGroup.append("text")
                    .attr("class", "value gauge-value-label")
                    .attr("x", originalLabelX)
                    .attr("y", originalLabelY)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "central")
                    .style("font-family", annotationStyle.fontFamily)
                    .style("font-size", `${Math.min(parseFontSizeToNumber(annotationStyle.fontSize), arcThickness * 0.6)}px`) // Simplified font sizing
                    .style("font-weight", annotationStyle.fontWeight)
                    .attr("fill", d.color) // Using group color for text
                    .text(formattedVal);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}