/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_33",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
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

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const dimensionField = xColumn ? xColumn.name : undefined;
    const valueField = yColumn ? yColumn.name : undefined;
    const dimensionUnit = xColumn && xColumn.unit && xColumn.unit !== "none" ? xColumn.unit : "";
    const valueUnit = yColumn && yColumn.unit && yColumn.unit !== "none" ? yColumn.unit : "";

    if (!dimensionField || !valueField) {
        let missing = [];
        if (!dimensionField) missing.push("dimensionField (role 'x')");
        if (!valueField) missing.push("valueField (role 'y')");
        const errorMessage = `Critical chart config missing: ${missing.join(', ')} not found in dataColumns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: Critical chart configuration missing. ${missing.join(' and ')} not defined.</div>`);
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
        primaryBarColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#882e2e',
        textColor: rawColors.text_color || '#333333',
        // No chartBackground explicitly set for svgRoot, assuming transparent or CSS controlled.
    };

    const estimateTextWidth = (text, fontProps) => {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvgNode.style.visibility = 'hidden';
        tempSvgNode.style.position = 'absolute';
        // No need to append to DOM for getBBox if styled directly on text element

        const tempTextNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextNode.setAttribute('font-family', fontProps.fontFamily);
        tempTextNode.setAttribute('font-size', fontProps.fontSize);
        tempTextNode.setAttribute('font-weight', fontProps.fontWeight);
        tempTextNode.textContent = text;
        
        tempSvgNode.appendChild(tempTextNode);
        // Appending to body temporarily to ensure styles are computed for getBBox
        document.body.appendChild(tempSvgNode);
        const width = tempTextNode.getBBox().width;
        document.body.removeChild(tempSvgNode);
        return width;
    };
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const baseWidth = variables.width || 800;
    const baseHeight = variables.height || 600;
    
    // Dynamic height adjustment based on number of dimensions (from original logic)
    const uniqueDimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const finalAdjustedHeight = uniqueDimensions.length > 15
        ? baseHeight * (1 + (uniqueDimensions.length - 15) * 0.03)
        : baseHeight;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("class", "chart-svg-root")
        .attr("width", baseWidth)
        .attr("height", finalAdjustedHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 60, bottom: 30, left: 150 }; // Initial margins

    const defaultIconWidth = 48; // Renamed from defaultFlagWidth
    const iconPadding = 5; // Space between icon and label text

    let maxDimensionLabelWidth = 0;
    uniqueDimensions.forEach(dim => {
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const textWidth = estimateTextWidth(formattedDim, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        const iconPresent = rawImages.field && rawImages.field[dim];
        const totalWidth = (iconPresent ? defaultIconWidth + iconPadding : 0) + textWidth;
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, totalWidth);
    });

    let maxValueLabelWidth = 0;
    chartData.forEach(d => {
        const formattedVal = valueUnit ? `${formatValue(d[valueField])}${valueUnit}` : `${formatValue(d[valueField])}`;
        const textWidth = estimateTextWidth(formattedVal, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        });
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });
    
    chartMargins.left = Math.max(chartMargins.left, maxDimensionLabelWidth + 20); // +20 for spacing
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 20); // +20 for spacing

    const innerWidth = baseWidth - chartMargins.left - chartMargins.right;
    const innerHeight = finalAdjustedHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2; // Fixed bar padding
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueField]) * 1.05 || 1]) // Ensure domain max is at least 1 to avoid issues with 0 max
        .range([0, innerWidth]);

    const iconWidth = Math.min(defaultIconWidth, yScale.bandwidth() - 10);
    const iconHeight = Math.min(defaultIconWidth, yScale.bandwidth() - 10); // Assuming square icons, use iconWidth for height too

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, legend, titles, or subtitles as per requirements.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    sortedData.forEach(d => {
        const dimension = d[dimensionField];
        const value = +d[valueField];

        const barHeight = yScale.bandwidth();
        const barY = yScale(dimension);
        const barWidth = xScale(value);

        if (barWidth > 0 && barY !== undefined) { // Check barY for undefined if dimension not in yScale domain
            const triangleWidth = Math.min(30, Math.max(10, barHeight));
            const actualTriangleWidth = Math.min(triangleWidth, barWidth);
            const rectWidth = barWidth - actualTriangleWidth;

            mainChartGroup.append("path")
                .attr("class", "mark bar")
                .attr("d", () => {
                    let path = `M 0 ${barY}`;
                    path += ` L ${rectWidth} ${barY}`;
                    path += ` L ${barWidth} ${barY + barHeight / 2}`;
                    path += ` L ${rectWidth} ${barY + barHeight}`;
                    path += ` L 0 ${barY + barHeight}`;
                    path += ` Z`;
                    return path;
                })
                .attr("fill", fillStyle.primaryBarColor);
        }

        // Dimension Label (Text part)
        const labelY = barY + barHeight / 2;
        let currentXOffset = -iconPadding; // Start from right edge of margin

        // Icon (if available)
        const iconUrl = rawImages.field && rawImages.field[dimension] ? rawImages.field[dimension] : null;
        if (iconUrl) {
            mainChartGroup.append("image")
                .attr("class", "image icon dimension-icon")
                .attr("x", currentXOffset - iconWidth)
                .attr("y", labelY - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
            currentXOffset -= (iconWidth + iconPadding);
        }
        
        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", currentXOffset)
            .attr("y", labelY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(dimensionUnit ? `${dimension}${dimensionUnit}` : dimension);

        // Value Label
        const formattedVal = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
        const baseAnnotationSize = parseFloat(fillStyle.typography.annotationFontSize);
        const dynamicSize = Math.max(baseAnnotationSize * 0.8, barHeight * 0.5); // Adjusted factors for better fit
        const finalAnnotationSize = Math.min(20, dynamicSize); // Max 20px

        mainChartGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", (barWidth > 0 ? barWidth : 0) + 5) // Position right of bar, or at 0 if barWidth is 0
            .attr("y", labelY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${finalAnnotationSize}px`)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedVal);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Removed mouseover effects and alternating row backgrounds as per simplification.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}