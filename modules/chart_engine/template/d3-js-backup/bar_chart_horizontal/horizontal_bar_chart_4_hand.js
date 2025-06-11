/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
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
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || {};
    const inputImages = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!categoryFieldDef || !categoryFieldDef.name) {
        console.error("Critical chart config missing: Category field name (role 'x') not defined in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (Category field 'x').</div>");
        return null;
    }
    if (!valueFieldDef || !valueFieldDef.name) {
        console.error("Critical chart config missing: Value field name (role 'y') not defined in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (Value field 'y').</div>");
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const categoryFieldUnit = categoryFieldDef.unit !== "none" ? categoryFieldDef.unit : "";
    const valueFieldUnit = valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        barPrimaryColor: (inputColors.other && inputColors.other.primary) ? inputColors.other.primary : "#1f77b4",
        textColor: inputColors.text_color || "#333333",
        chartBackground: inputColors.background_color || "#FFFFFF",
        typography: {
            categoryLabel: {
                font_family: (inputTypography.label && inputTypography.label.font_family) ? inputTypography.label.font_family : "Arial, sans-serif",
                font_size: (inputTypography.label && inputTypography.label.font_size) ? inputTypography.label.font_size : "12px",
                font_weight: (inputTypography.label && inputTypography.label.font_weight) ? inputTypography.label.font_weight : "normal",
            },
            valueLabel: {
                font_family: (inputTypography.annotation && inputTypography.annotation.font_family) ? inputTypography.annotation.font_family : "Arial, sans-serif",
                font_size: (inputTypography.annotation && inputTypography.annotation.font_size) ? inputTypography.annotation.font_size : "11px",
                font_weight: (inputTypography.annotation && inputTypography.annotation.font_weight) ? inputTypography.annotation.font_weight : "normal",
            }
        },
        images: inputImages.field || {}
    };

    function estimateTextWidth(text, style) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', style.font_family);
        tempText.setAttribute('font-size', style.font_size);
        tempText.setAttribute('font-weight', style.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox, but
        // the prompt asks for in-memory. If sizing is off, this might be a cause.
        // For this implementation, we assume getBBox on an unattached element is sufficient.
        // If not, a temporary, hidden attachment to the DOM would be needed.
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            // Fallback or error logging if getBBox fails (e.g. in certain test environments)
            console.warn("BBox calculation failed for text:", text, e);
            width = text.length * (parseInt(style.font_size) * 0.6); // Rough estimate
        }
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (value >= 1000000) return d3.format("~.2s")(value).replace('M', 'M');
        if (value >= 1000) return d3.format("~.2s")(value).replace('k', 'K');
        return d3.format("~g")(value);
    };
    
    const ICON_MAX_WIDTH = 30; // Max width for icon, used for margin calculation
    const ICON_LABEL_PADDING = 5; // Padding between icon and label text
    const VALUE_LABEL_OFFSET = 5; // Offset for value label from bar end

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
    let maxCategoryLabelWidth = 0;
    chartDataInput.forEach(d => {
        const labelText = `${d[categoryFieldName]}${categoryFieldUnit}`;
        const textWidth = estimateTextWidth(labelText, fillStyle.typography.categoryLabel);
        let iconSpace = 0;
        if (fillStyle.images[d[categoryFieldName]]) {
            iconSpace = ICON_MAX_WIDTH + ICON_LABEL_PADDING;
        }
        maxCategoryLabelWidth = Math.max(maxCategoryLabelWidth, textWidth + iconSpace);
    });

    let maxValueLabelWidth = 0;
    chartDataInput.forEach(d => {
        const valueText = `${formatValue(d[valueFieldName])}${valueFieldUnit}`;
        const textWidth = estimateTextWidth(valueText, fillStyle.typography.valueLabel);
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });
    
    const chartMargins = {
        top: 20,
        right: Math.max(20, maxValueLabelWidth + VALUE_LABEL_OFFSET + 10), // Ensure space for value labels
        bottom: 20,
        left: Math.max(20, maxCategoryLabelWidth + 10) // Ensure space for category labels and icons
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated inner dimensions are not positive. Check container size and margins.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Chart dimensions too small for content.</div>");
        return null;
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = [...chartDataInput].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const sortedCategories = chartDataArray.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedCategories)
        .range([0, innerHeight])
        .padding(0.2); // Fixed padding

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => +d[valueFieldName]) * 1.05 || 10]) // Add 5% padding, or default max if data is all 0
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type as per simplification.

    // Block 8: Main Data Visualization Rendering
    const barsGroup = mainChartGroup.append("g").attr("class", "bars-group");

    chartDataArray.forEach(d => {
        const category = d[categoryFieldName];
        const value = +d[valueFieldName];

        const barY = yScale(category);
        const barHeight = yScale.bandwidth();
        const barWidth = xScale(value);

        if (barY === undefined || barHeight === undefined) {
            console.warn(`Category "${category}" not found in yScale. Skipping bar.`);
            return;
        }
        
        // Render Bar
        barsGroup.append("rect")
            .attr("x", 0)
            .attr("y", barY)
            .attr("width", Math.max(0, barWidth)) // Ensure width is not negative
            .attr("height", barHeight)
            .attr("fill", fillStyle.barPrimaryColor)
            .attr("class", "mark");

        // Render Icon (if available)
        const iconUrl = fillStyle.images[category];
        let iconRenderedWidth = 0;
        if (iconUrl) {
            const iconHeight = Math.min(ICON_MAX_WIDTH, barHeight * 0.8); // Dynamic icon height
            const iconWidth = iconHeight; // Assuming square icons or using height as primary dim
            
            mainChartGroup.append("image")
                .attr("xlink:href", iconUrl)
                .attr("x", -(iconWidth + ICON_LABEL_PADDING))
                .attr("y", barY + (barHeight - iconHeight) / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("class", "icon");
            iconRenderedWidth = iconWidth + ICON_LABEL_PADDING;
        }

        // Render Category Label
        mainChartGroup.append("text")
            .attr("x", -iconRenderedWidth - (iconRenderedWidth > 0 ? 0 : ICON_LABEL_PADDING/2) ) // Position left of icon, or just padding if no icon
            .attr("y", barY + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.categoryLabel.font_family)
            .style("font-size", fillStyle.typography.categoryLabel.font_size)
            .style("font-weight", fillStyle.typography.categoryLabel.font_weight)
            .style("fill", fillStyle.textColor)
            .text(`${category}${categoryFieldUnit}`)
            .attr("class", "label");

        // Render Value Label
        const formattedValueText = `${formatValue(value)}${valueFieldUnit}`;
        const dynamicValueFontSize = Math.min(18, Math.max(barHeight * 0.5, parseFloat(fillStyle.typography.valueLabel.font_size)));
        
        mainChartGroup.append("text")
            .attr("x", Math.max(0, barWidth) + VALUE_LABEL_OFFSET)
            .attr("y", barY + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.valueLabel.font_family)
            .style("font-size", `${dynamicValueFontSize}px`)
            .style("font-weight", fillStyle.typography.valueLabel.font_weight)
            .style("fill", fillStyle.textColor)
            .text(formattedValueText)
            .attr("class", "value");
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No enhancements like tooltips, complex interactions, or annotations in this refactored version.
    // svg2roughjs logic removed.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}