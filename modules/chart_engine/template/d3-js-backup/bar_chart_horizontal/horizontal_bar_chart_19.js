/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_19",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "right",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "ascending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!dimensionFieldDef || !valueFieldDef) {
        const missing = [];
        if (!dimensionFieldDef) missing.push("dimension field (role 'x')");
        if (!valueFieldDef) missing.push("value field (role 'y')");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const dimensionFieldName = dimensionFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const dimensionUnit = dimensionFieldDef.unit && dimensionFieldDef.unit !== "none" ? dimensionFieldDef.unit : "";
    const valueUnit = valueFieldDef.unit && valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";

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
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#333333',
        primaryBarColor: (colors.other && colors.other.primary) ? colors.other.primary : '#E74C3C',
        getBarColor: (dimensionValue, index) => {
            if (colors.field && colors.field[dimensionValue]) {
                return colors.field[dimensionValue];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return fillStyle.primaryBarColor;
        },
        getIconUrl: (dimensionValue) => {
            if (images.field && images.field[dimensionValue]) {
                return images.field[dimensionValue];
            }
            if (images.other && images.other.primary) { // Fallback to a generic primary icon
                return images.other.primary;
            }
            return null;
        }
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // No need to append to DOM for measurement if using d3.select on an in-memory node
        const tempText = d3.select(tempSvgNode).append('text')
            .style('font-family', fontProps.fontFamily)
            .style('font-size', fontProps.fontSize)
            .style('font-weight', fontProps.fontWeight)
            .text(text);
        const width = tempText.node().getBBox().width;
        return width;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        const absValue = Math.abs(value);
        let sign = value < 0 ? "-" : "";
        if (absValue >= 1000000000) {
            return sign + d3.format("~.2s")(absValue).replace('G', 'B');
        } else if (absValue >= 1000000) {
            return sign + d3.format("~.2s")(absValue);
        } else if (absValue >= 1000) {
            return sign + d3.format("~.2s")(absValue);
        }
        return sign + d3.format("~g")(absValue);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    let maxValueLabelWidth = 0;
    if (chartDataInput && chartDataInput.length > 0) {
        chartDataInput.forEach(d => {
            const val = d[valueFieldName];
            const formattedVal = valueUnit ? `${formatValue(val)}${valueUnit}` : `${formatValue(val)}`;
            maxValueLabelWidth = Math.max(maxValueLabelWidth, estimateTextWidth(formattedVal, {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: fillStyle.typography.annotationFontSize,
                fontWeight: fillStyle.typography.annotationFontWeight
            }));
        });
    }
    
    const chartMargins = {
        top: variables.margin_top || 60, 
        right: variables.margin_right || 20,
        bottom: variables.margin_bottom || 30,
        left: variables.margin_left || Math.max(20, maxValueLabelWidth + 15)
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <=0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Adjust margins or container size.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({
        ...d,
        [valueFieldName]: (d[valueFieldName] === null || d[valueFieldName] === undefined) ? 0 : +d[valueFieldName]
    }));

    const orderedData = [...chartDataArray].sort((a, b) => a[valueFieldName] - b[valueFieldName]);
    const orderedDimensionNames = orderedData.map(d => d[dimensionFieldName]);

    const valueExtent = d3.extent(orderedData, d => d[valueFieldName]);
    const minValue = valueExtent[0] === undefined ? 0 : valueExtent[0];
    const maxValue = valueExtent[1] === undefined ? 0 : valueExtent[1];
    const hasNegativeValues = minValue < 0;

    // Block 6: Scale Definition & Configuration
    const Y_SCALE_PADDING = 0.55; 

    const yScale = d3.scaleBand()
        .domain(orderedDimensionNames)
        .range([0, innerHeight])
        .padding(Y_SCALE_PADDING);

    const xScale = d3.scaleLinear()
        .domain([
            hasNegativeValues ? Math.min(minValue * 1.1, 0) : 0,
            Math.max(maxValue * 1.1, 0) 
        ])
        .range([0, innerWidth]); 

    const barHeight = yScale.bandwidth();
    if (barHeight <= 0) { // Handle case where barHeight is not positive (e.g. too many items for innerHeight)
        console.warn("Calculated bar height is not positive. Chart may not render correctly.");
        // Potentially return or display an error
    }
    const iconSize = Math.max(5, Math.min(barHeight * 0.8, 30)); 
    const iconLabelVerticalOffset = iconSize + 5; 

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    if (valueFieldName) {
        const valueFieldLabelY = -(iconLabelVerticalOffset + parseFloat(fillStyle.typography.labelFontSize) / 2 + 10);
        // Ensure this label is within chartMargins.top
        if (Math.abs(valueFieldLabelY) > chartMargins.top - 5) { // 5px buffer from SVG top
            // console.warn("Value field label might be clipped due to insufficient top margin.");
        }
        mainChartGroup.append("text")
            .attr("class", "label value-field-label")
            .attr("x", innerWidth)
            .attr("y", valueFieldLabelY) 
            .attr("dy", "0.35em") // Vertically center text
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(valueFieldName + (valueUnit ? ` (${valueUnit})` : ''));
    }
    
    // Block 8: Main Data Visualization Rendering
    orderedData.forEach((d, i) => {
        const dimensionValue = d[dimensionFieldName];
        const value = d[valueFieldName];
        
        const yPosition = yScale(dimensionValue);
        if (yPosition === undefined) { 
            return;
        }

        const barColor = fillStyle.getBarColor(dimensionValue, i);
        const iconSrc = fillStyle.getIconUrl(dimensionValue);

        const scaledZero = xScale(0);
        const scaledValue = xScale(value);
        const barLengthOnScale = Math.abs(scaledValue - scaledZero);
        const barXRender = innerWidth - barLengthOnScale;

        // Dimension Label and Icon (Above the bar)
        const dimensionInfoGroup = mainChartGroup.append("g")
            .attr("class", "dimension-info-group")
            .attr("transform", `translate(0, ${yPosition - iconLabelVerticalOffset})`);

        let currentTextXEnd = innerWidth; 

        if (iconSrc) {
            dimensionInfoGroup.append("image")
                .attr("class", "icon dimension-icon")
                .attr("x", currentTextXEnd - iconSize)
                .attr("y", 0) 
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconSrc);
            currentTextXEnd -= (iconSize + 8); 
        }

        const formattedDimension = dimensionUnit ? `${dimensionValue}${dimensionUnit}` : `${dimensionValue}`;
        dimensionInfoGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", currentTextXEnd)
            .attr("y", iconSize / 2) 
            .attr("dy", "0.35em") 
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedDimension);

        // Bar
        const barElementGroup = mainChartGroup.append("g")
            .attr("class", "bar-element-group")
            .attr("transform", `translate(0, ${yPosition})`);

        barElementGroup.append("rect")
            .attr("class", "mark bar-rect")
            .attr("x", barXRender) 
            .attr("y", 0)
            .attr("width", Math.max(0, barLengthOnScale)) // Ensure width is not negative
            .attr("height", Math.max(0, barHeight)) // Ensure height is not negative
            .attr("fill", barColor);

        // Value Label (Left of the bar)
        const formattedVal = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
        barElementGroup.append("text")
            .attr("class", "value data-value-label")
            .attr("x", barXRender - 5) 
            .attr("y", barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedVal);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}