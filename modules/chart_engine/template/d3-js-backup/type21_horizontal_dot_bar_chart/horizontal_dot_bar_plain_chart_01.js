/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Dot Bar Chart",
  "chart_name": "horizontal_dot_bar_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["none"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    // const imagesInput = data.images || {}; // Not used in this chart but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const dimensionField = xColumn ? xColumn.name : undefined;
    const valueField = yColumn ? yColumn.name : undefined;

    if (!dimensionField || !valueField) {
        let missingFields = [];
        if (!dimensionField) missingFields.push("dimension field (role 'x')");
        if (!valueField) missingFields.push("value field (role 'y')");
        const errorMessage = `Critical chart config missing: ${missingFields.join(' and ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>Error: Critical chart configuration missing. ${missingFields.join(' and ')} not defined in data columns.</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    const labelTypography = typographyInput.label || {};
    const annotationTypography = typographyInput.annotation || {};

    fillStyle.typography.labelFontFamily = labelTypography.font_family || 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = labelTypography.font_size || '12px';
    fillStyle.typography.labelFontWeight = labelTypography.font_weight || 'normal';

    fillStyle.typography.annotationFontFamily = annotationTypography.font_family || 'Arial, sans-serif';
    fillStyle.typography.annotationFontSize = annotationTypography.font_size || '10px'; // Adjusted based on prompt example
    fillStyle.typography.annotationFontWeight = annotationTypography.font_weight || 'normal';
    
    const otherColors = colorsInput.other || {};
    fillStyle.colors.textColor = colorsInput.text_color || '#333333';
    fillStyle.colors.primaryBarColor = otherColors.primary || '#FFBB33';
    fillStyle.colors.barStrokeColor = d3.rgb(fillStyle.colors.primaryBarColor).darker(0.5).toString();
    fillStyle.colors.chartBackground = colorsInput.background_color || '#FFFFFF'; // Not actively used to fill SVG bg

    function estimateTextWidth(text, fontProps) {
        const tempSvg = d3.select(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
        const tempText = tempSvg.append('text')
            .style('font-family', fontProps.font_family)
            .style('font-size', fontProps.font_size)
            .style('font-weight', fontProps.font_weight)
            .text(text);
        const width = tempText.node().getBBox().width;
        tempText.remove();
        return width;
    }

    function formatValue(value) {
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
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
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.colors.chartBackground);


    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin_top || 20, // Simplified margin, original had 90 for title
        right: variables.margin_right || 30,
        bottom: variables.margin_bottom || 20, // Simplified margin
        left: variables.margin_left || 100
    };
    
    // Calculate max label widths for dynamic margin adjustment
    const tempLabelFontProps = { 
        font_family: fillStyle.typography.labelFontFamily, 
        font_size: fillStyle.typography.labelFontSize, 
        font_weight: fillStyle.typography.labelFontWeight 
    };
    const tempAnnotationFontProps = { 
        font_family: fillStyle.typography.annotationFontFamily, 
        font_size: fillStyle.typography.annotationFontSize, // Use defined annotation size
        font_weight: fillStyle.typography.annotationFontWeight
    };

    const dimensionUnit = (xColumn && xColumn.unit !== "none") ? xColumn.unit || "" : "";
    const valueUnit = (yColumn && yColumn.unit !== "none") ? yColumn.unit || "" : "";

    let maxDimensionLabelWidth = 0;
    chartDataInput.forEach(d => {
        const labelText = `${d[dimensionField]}${dimensionUnit}`;
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, estimateTextWidth(labelText, tempLabelFontProps));
    });

    let maxValueLabelWidth = 0;
    // Need to calculate max value label width based on potentially transformed values
    // This will be done after data transformation in Block 5.
    // For now, use a placeholder or calculate based on raw values if transformation is simple.
    // Let's defer precise margin.right adjustment or use a generous default.
    chartDataInput.forEach(d => {
        const valueText = `${formatValue(d[valueField])}${valueUnit}`;
        maxValueLabelWidth = Math.max(maxValueLabelWidth, estimateTextWidth(valueText, tempAnnotationFontProps));
    });
    
    chartMargins.left = Math.max(chartMargins.left, maxDimensionLabelWidth + 10); // Add padding
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 15); // Add padding + space for dot

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Cannot render chart.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Chart dimensions are too small to render content.</div>");
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    const transformedChartData = JSON.parse(JSON.stringify(chartDataInput)); // Deep copy
    const valueFieldTransformed = `${valueField}_transformed`;

    const maxValueRaw = d3.max(transformedChartData, d => +d[valueField]);
    if (maxValueRaw > 100) {
        transformedChartData.forEach(d => {
            d[valueFieldTransformed] = Math.max(1, Math.floor(+d[valueField] / maxValueRaw * 50));
        });
    } else {
        transformedChartData.forEach(d => {
            d[valueFieldTransformed] = +d[valueField]; // Use original value if max is within 100
        });
    }
    
    const sortedData = [...transformedChartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);

    // Block 6: Scale Definition & Configuration
    const rowPadding = 0.3; // Fixed spacing
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(rowPadding);

    const maxValueForDots = d3.max(sortedData, d => d[valueFieldTransformed]);

    const defaultDotWidth = 10;
    const defaultDotSpacing = 5;
    const groupSize = 10; // Dots per visual group
    const largerGroupSpacingFactor = 1.5; // Spacing between groups of 10 dots is 1.5x defaultDotSpacing

    // Calculate how many full groups of 10 dots and one partial group might be needed for maxValueForDots
    const numGroups = Math.ceil(maxValueForDots / groupSize);
    let requiredWidthForDots = 0;
    if (maxValueForDots > 0) {
        requiredWidthForDots = (maxValueForDots * defaultDotWidth) + 
                               (Math.ceil(maxValueForDots / groupSize) -1 ) * (defaultDotSpacing * largerGroupSpacingFactor) + // inter-group spacing
                               (maxValueForDots - numGroups) * defaultDotSpacing; // intra-group spacing
    }


    let dotWidth = defaultDotWidth;
    let dotSpacing = defaultDotSpacing;
    let actualLargerGroupSpacing = defaultDotSpacing * largerGroupSpacingFactor;

    if (requiredWidthForDots > innerWidth && maxValueForDots > 0) {
        const scaleFactor = innerWidth / requiredWidthForDots;
        dotWidth = Math.max(2, Math.floor(defaultDotWidth * scaleFactor));
        dotSpacing = Math.max(1, Math.floor(defaultDotSpacing * scaleFactor));
        actualLargerGroupSpacing = Math.max(1, Math.floor(actualLargerGroupSpacing * scaleFactor));
    }
    
    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type as per original and simplification.

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "chart-area");

    // Block 8: Main Data Visualization Rendering
    sortedDimensions.forEach(dimension => {
        const dataPoint = sortedData.find(d => d[dimensionField] === dimension);

        if (dataPoint) {
            const rowY = yScale(dimension);
            if (typeof rowY === 'undefined') return; // Skip if dimension not in scale (e.g. empty data)

            const rowHeight = yScale.bandwidth();
            const dotVisualHeight = rowHeight * 0.6; // Height of the pill/dot
            const dotY = rowY + (rowHeight - dotVisualHeight) / 2;
            
            const dotCount = Math.round(dataPoint[valueFieldTransformed]);

            let currentX = 0;
            for (let i = 0; i < dotCount; i++) {
                mainChartGroup.append("rect")
                    .attr("class", "mark dot-element")
                    .attr("x", currentX)
                    .attr("y", dotY)
                    .attr("width", dotWidth)
                    .attr("height", dotVisualHeight)
                    .attr("fill", fillStyle.colors.primaryBarColor)
                    .attr("stroke", fillStyle.colors.barStrokeColor)
                    .attr("stroke-width", 1)
                    .attr("rx", dotWidth / 2) // Rounded ends for pill shape
                    .attr("ry", dotVisualHeight / 2); // Fully rounded height

                currentX += dotWidth;
                if ((i + 1) % groupSize === 0 && i < dotCount -1) { // After every group of 10, if not the last dot
                    currentX += actualLargerGroupSpacing;
                } else if (i < dotCount - 1) { // If not the last dot and not end of group
                    currentX += dotSpacing;
                }
            }

            // Add dimension label
            mainChartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", -10)
                .attr("y", rowY + rowHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(`${dataPoint[dimensionField]}${dimensionUnit}`);

            // Add value label
            const dynamicValueFontSize = `${Math.max(8, dotVisualHeight * 0.7)}px`; // Ensure min font size
            const valueLabelText = `${formatValue(dataPoint[valueField])}${valueUnit}`;
            
            mainChartGroup.append("text")
                .attr("class", "value data-label")
                .attr("x", currentX + 5) // Position after the last dot
                .attr("y", rowY + rowHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", dynamicValueFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(valueLabelText);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}