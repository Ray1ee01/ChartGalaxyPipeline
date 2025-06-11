/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart with Icons and Secondary Value",
  "chart_name": "horizontal_bar_chart_20",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "yes",

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
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
    const chartData = data.data.data;
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name;

    if (!dimensionField || !valueField || !valueField2) {
        let missingFields = [];
        if (!dimensionField) missingFields.push("x role field");
        if (!valueField) missingFields.push("y role field");
        if (!valueField2) missingFields.push("y2 role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionUnit = dataColumns.find(col => col.role === "x")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "x")?.unit || "");
    const valueUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y")?.unit || "");
    const valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y2")?.unit || "");
    const valueField2Name = dataColumns.find(col => col.role === "y2")?.display_name || valueField2;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: rawTypography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: rawTypography.title?.font_size || '16px',
            titleFontWeight: rawTypography.title?.font_weight || 'bold',
            labelFontFamily: rawTypography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: rawTypography.label?.font_size || '12px',
            labelFontWeight: rawTypography.label?.font_weight || 'normal',
            annotationFontFamily: rawTypography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: rawTypography.annotation?.font_size || '10px',
            annotationFontWeight: rawTypography.annotation?.font_weight || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || null, // Use null for no explicit background
        defaultBarColor: '#4682B4', // Default if no other color is found
        valueLabelColorInsideBar: '#FFFFFF',
        barStrokeWidth: 1,
        barCornerRadius: 4,
        iconBorderColor: '#000000',
        iconBorderWidth: 0.5,
    };

    fillStyle.getBarColor = (dimensionValue) => {
        if (rawColors.field && rawColors.field[dimensionValue]) {
            return rawColors.field[dimensionValue];
        }
        if (rawColors.other && rawColors.other.primary) {
            return rawColors.other.primary;
        }
        return fillStyle.defaultBarColor;
    };

    fillStyle.getBarStrokeColor = (dimensionValue) => {
        const baseColor = fillStyle.getBarColor(dimensionValue);
        return d3.rgb(baseColor).darker(0.5).toString(); // Darker stroke
    };
    
    fillStyle.getImageUrl = (dimensionValue) => {
        return rawImages.field && rawImages.field[dimensionValue] ? rawImages.field[dimensionValue] : null;
    };

    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: getBBox needs the SVG to be in the DOM or have intrinsic size.
        // For more accuracy, it might be (briefly) added to DOM, or use a canvas context.
        // However, for many cases, this direct usage on an unattached element works sufficiently.
        // To be fully robust if issues arise:
        // document.body.appendChild(tempSvg);
        // const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg);
        // return width;
        // For this refactoring, assuming direct getBBox on unattached element is acceptable per typical D3 examples.
        // If not, a more complex setup or canvas might be needed.
        // A common simplified approach that often works:
        try {
            return tempText.getBBox().width;
        } catch (e) { // Fallback if getBBox fails on unattached element in some environments
            return text.length * (parseInt(fontProps.fontSize, 10) || 12) * 0.6; // Rough estimate
        }
    };

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value).replace('M', 'M');
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value).replace('k', 'K'); // d3.format uses 'k'
        return d3.format("~g")(value);
    };
    
    const fixedIconDisplaySize = 24; // Fixed size for icon display area
    const iconPadding = 5; // Padding around icon, and between icon and label

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .attr("class", "chart-root-svg");

    if (fillStyle.chartBackground) {
        svgRoot.style("background-color", fillStyle.chartBackground);
    }

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 30, // Space for y2 title
        right: 20, // Initial right margin
        bottom: 20,
        left: 20  // Initial left margin
    };

    let maxLabelWidth = 0;
    chartData.forEach(d => {
        const formattedDimension = dimensionUnit ? `${d[dimensionField]}${dimensionUnit}` : `${d[dimensionField]}`;
        const width = estimateTextWidth(formattedDimension, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (width > maxLabelWidth) maxLabelWidth = width;
    });
    
    chartMargins.left = maxLabelWidth + iconPadding + fixedIconDisplaySize + iconPadding; // label + pad + icon + pad + bar_start

    let maxValueWidth2 = 0;
    chartData.forEach(d => {
        const formattedValue2 = valueUnit2 ? `${formatValue(d[valueField2])}${valueUnit2}` : `${formatValue(d[valueField2])}`;
        const width = estimateTextWidth(formattedValue2, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        });
        if (width > maxValueWidth2) maxValueWidth2 = width;
    });
    
    const y2TitleWidth = estimateTextWidth(valueField2Name, {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    });
    maxValueWidth2 = Math.max(maxValueWidth2, y2TitleWidth);
    chartMargins.right = maxValueWidth2 + 10; // Space for y2 values/title + padding

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensionNames = sortedData.map(d => d[dimensionField]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2;
    const yScale = d3.scaleBand()
        .domain(sortedDimensionNames)
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueField]) || 1]) // Ensure domain is not [0,0]
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    mainChartGroup.append("text")
        .attr("class", "label title-label y2-title")
        .attr("x", innerWidth + chartMargins.right - 10) 
        .attr("y", -5) // Position above the first bar
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(valueField2Name);

    // Block 8: Main Data Visualization Rendering
    const barHeight = yScale.bandwidth();
    const iconRenderSize = Math.min(barHeight * 0.9, fixedIconDisplaySize); // Actual render size, fits in fixedIconDisplaySize

    sortedData.forEach((d, i) => {
        const dimensionValue = d[dimensionField];
        const barGroup = mainChartGroup.append("g")
            .attr("class", "bar-element-group")
            .attr("transform", `translate(0, ${yScale(dimensionValue)})`);

        const barWidth = xScale(+d[valueField]);

        barGroup.append("rect")
            .attr("class", "mark bar-mark")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", Math.max(0, barWidth)) // Ensure width is not negative
            .attr("height", barHeight)
            .attr("fill", fillStyle.getBarColor(dimensionValue))
            .attr("stroke", fillStyle.getBarStrokeColor(dimensionValue))
            .attr("stroke-width", fillStyle.barStrokeWidth)
            .attr("rx", fillStyle.barCornerRadius)
            .attr("ry", fillStyle.barCornerRadius);

        const iconXPosition = -(fixedIconDisplaySize + iconPadding);
        const labelXPosition = iconXPosition - iconPadding;
        
        const imageUrl = fillStyle.getImageUrl(dimensionValue);
        if (imageUrl) {
            const clipId = `clip-${dimensionValue.toString().replace(/\W/g, '')}-${i}`;
            defs.append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("cx", iconXPosition + fixedIconDisplaySize / 2)
                .attr("cy", barHeight / 2)
                .attr("r", iconRenderSize / 2);

            barGroup.append("circle")
                .attr("class", "icon icon-border")
                .attr("cx", iconXPosition + fixedIconDisplaySize / 2)
                .attr("cy", barHeight / 2)
                .attr("r", iconRenderSize / 2)
                .attr("fill", "none")
                .attr("stroke", fillStyle.iconBorderColor)
                .attr("stroke-width", fillStyle.iconBorderWidth);
            
            barGroup.append("image")
                .attr("class", "icon image dimension-icon")
                .attr("x", iconXPosition + (fixedIconDisplaySize - iconRenderSize) / 2)
                .attr("y", (barHeight - iconRenderSize) / 2)
                .attr("width", iconRenderSize)
                .attr("height", iconRenderSize)
                .attr("clip-path", `url(#${clipId})`)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", imageUrl);
        }

        const formattedDimension = dimensionUnit ? `${dimensionValue}${dimensionUnit}` : `${dimensionValue}`;
        barGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", labelXPosition)
            .attr("y", barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedDimension);

        const formattedValue = valueUnit ? `${formatValue(d[valueField])}${valueUnit}` : `${formatValue(d[valueField])}`;
        const valueTextWidth = estimateTextWidth(formattedValue, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        });
        
        const textFitsInside = barWidth > valueTextWidth + 10; // 10px padding

        barGroup.append("text")
            .attr("class", "label value-label primary-value")
            .attr("x", textFitsInside ? barWidth / 2 : barWidth + 5)
            .attr("y", barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", textFitsInside ? "middle" : "start")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", textFitsInside ? fillStyle.valueLabelColorInsideBar : fillStyle.textColor)
            .text(formattedValue);

        const formattedValue2 = valueUnit2 ? `${formatValue(d[valueField2])}${valueUnit2}` : `${formatValue(d[valueField2])}`;
        mainChartGroup.append("text") // Appended to mainChartGroup for consistent x relative to innerWidth
            .attr("class", "label value-label secondary-value")
            .attr("x", innerWidth + chartMargins.right - 10) // Align with y2 title
            .attr("y", yScale(dimensionValue) + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedValue2);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - mouseover effects removed for simplification)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}