/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[1, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal bar chart.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme preference if both exist, or just colors
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!categoryFieldDef || !categoryFieldDef.name) {
        console.error("Critical chart config missing: Category field (role 'x') name not defined in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Category field configuration is missing.</div>");
        return null;
    }
    if (!valueFieldDef || !valueFieldDef.name) {
        console.error("Critical chart config missing: Value field (role 'y') name not defined in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Value field configuration is missing.</div>");
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const categoryFieldUnit = categoryFieldDef.unit !== "none" ? categoryFieldDef.unit : "";
    const valueFieldUnit = valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        barPrimaryColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#4682B4', // SteelBlue
        chartBackground: rawColors.background_color || '#FFFFFF',
        textColor: rawColors.text_color || '#333333',
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) ? rawTypography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) ? rawTypography.title.font_size : '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) ? rawTypography.title.font_weight : 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'normal',
        },
        images: {
            field: (rawImages.field || {}),
            other: (rawImages.other || {})
        }
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.position = 'absolute';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        tempText.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        tempText.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Appending to body to ensure getBBox works, then removing immediately.
        // This is a common workaround for getBBox in detached elements.
        document.body.appendChild(tempSvg);
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Base margins

    // Calculate max value label width and category label width to adjust margins
    let maxValueLabelWidth = 0;
    chartDataInput.forEach(d => {
        const formattedVal = formatValue(d[valueFieldName]) + (valueFieldUnit ? valueFieldUnit : "");
        const textWidth = estimateTextWidth(formattedVal, { 
            fontFamily: fillStyle.typography.annotationFontFamily, 
            fontSize: fillStyle.typography.annotationFontSize, // Use annotation for value labels
            fontWeight: fillStyle.typography.annotationFontWeight 
        });
        if (textWidth > maxValueLabelWidth) maxValueLabelWidth = textWidth;
    });
    
    let maxCategoryLabelWidth = 0;
    chartDataInput.forEach(d => {
        const categoryText = d[categoryFieldName] + (categoryFieldUnit ? " " + categoryFieldUnit : "");
        const textWidth = estimateTextWidth(categoryText, { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: fillStyle.typography.labelFontSize, 
            fontWeight: fillStyle.typography.labelFontWeight 
        });
        if (textWidth > maxCategoryLabelWidth) maxCategoryLabelWidth = textWidth;
    });

    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + maxCategoryLabelWidth + 30); // Space for value + category label + padding

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    if (!chartDataInput || chartDataInput.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No data available to display.")
            .attr("class", "text no-data-message");
        return svgRoot.node();
    }
    
    const chartDataArray = [...chartDataInput].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const categories = chartDataArray.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerHeight])
        .padding(0.2); // Standard padding

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => +d[valueFieldName]) * 1.05]) // 5% padding at the end
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type as per requirements (no axes, gridlines, legend).

    // Block 8: Main Data Visualization Rendering
    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", d => `mark bar-group category-${String(d[categoryFieldName]).replace(/\s+/g, '-')}`)
        .attr("transform", d => `translate(0, ${yScale(d[categoryFieldName])})`);

    barGroups.append("rect")
        .attr("class", "value bar-rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", d => xScale(+d[valueFieldName]))
        .attr("height", yScale.bandwidth())
        .attr("fill", fillStyle.barPrimaryColor);

    const iconSizeRatio = 0.7; // Icon size relative to bar height
    const iconPadding = (1 - iconSizeRatio) / 2 * yScale.bandwidth();

    barGroups.each(function(d) {
        const group = d3.select(this);
        const barWidth = xScale(+d[valueFieldName]);
        const barHeight = yScale.bandwidth();
        const categoryValue = d[categoryFieldName];

        // Render Icon
        const iconUrl = fillStyle.images.field && fillStyle.images.field[categoryValue] 
                        ? fillStyle.images.field[categoryValue] 
                        : (fillStyle.images.other && fillStyle.images.other.primary ? fillStyle.images.other.primary : null);

        if (iconUrl) {
            const iconActualSize = barHeight * iconSizeRatio;
            const iconX = iconPadding; // Small padding from left edge of bar
            const iconY = iconPadding;
            
            // Ensure icon does not overflow small bars
            if (iconActualSize < barWidth - 2 * iconPadding) {
                 group.append("image")
                    .attr("class", "icon bar-icon")
                    .attr("x", iconX)
                    .attr("y", iconY)
                    .attr("width", iconActualSize)
                    .attr("height", iconActualSize)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", iconUrl);
            }
        }

        // Render Value Label
        const valueText = formatValue(d[valueFieldName]) + (valueFieldUnit ? valueFieldUnit : "");
        const dynamicValueFontSize = Math.max(8, Math.min(parseFloat(fillStyle.typography.annotationFontSize), barHeight * 0.5)) + 'px';
        
        const valueLabelWidth = estimateTextWidth(valueText, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: dynamicValueFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        });

        const valueLabelXOffset = 5; // Padding from bar edge or previous label
        let valueLabelAnchor = "start";
        let valueLabelX = barWidth + valueLabelXOffset;
        let valueLabelColor = fillStyle.textColor;

        if (valueLabelWidth + valueLabelXOffset * 2 < barWidth) { // Fits inside
            valueLabelAnchor = "end";
            valueLabelX = barWidth - valueLabelXOffset;
            valueLabelColor = d3.hsl(fillStyle.barPrimaryColor).l > 0.5 ? '#333333' : '#FFFFFF'; // Contrast color
        }
        
        group.append("text")
            .attr("class", "label value-label")
            .attr("x", valueLabelX)
            .attr("y", barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", valueLabelAnchor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", dynamicValueFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", valueLabelColor)
            .text(valueText);

        // Render Category Label
        const categoryText = d[categoryFieldName] + (categoryFieldUnit ? " " + categoryFieldUnit : "");
        const categoryLabelXStart = (valueLabelAnchor === 'start') ? (valueLabelX + valueLabelWidth + valueLabelXOffset) : (barWidth + valueLabelXOffset);
        
        group.append("text")
            .attr("class", "label category-label")
            .attr("x", categoryLabelXStart)
            .attr("y", barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements like tooltips or advanced interactions in this refactor.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}