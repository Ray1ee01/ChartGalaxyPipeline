/* REQUIREMENTS_BEGIN
{
  "chart_type": "Gauge Chart",
  "chart_name": "gauge_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": ["group"],
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
    const config = data; // Use 'config' for the input data object
    const rawChartData = config.data && config.data.data ? config.data.data : [];
    const variables = config.variables || {};
    const rawTypography = config.typography || {};
    const rawColors = config.colors || {}; // Or config.colors_dark if theme logic were here
    const images = config.images || {}; // Not used in this chart, but for completeness
    const dataColumns = config.data && config.data.columns ? config.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    let categoryFieldName = dataColumns.find(col => col.role === "group")?.name;
    if (!categoryFieldName) {
        categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    }
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("category field (role 'group' or 'x')");
        if (!valueFieldName) missingFields.push("value field (role 'y')");
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const DEFAULT_TYPOGRAPHY = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const DEFAULT_COLORS = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: d3.schemeCategory10.slice(), // Use a copy
        background_color: "#FFFFFF",
        text_color: "#333333",
        grid_subtle_color: "#E0E0E0"
    };
    
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) || DEFAULT_TYPOGRAPHY.title.font_family,
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) || DEFAULT_TYPOGRAPHY.title.font_size,
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || DEFAULT_TYPOGRAPHY.title.font_weight,
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || DEFAULT_TYPOGRAPHY.label.font_family,
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || DEFAULT_TYPOGRAPHY.label.font_size,
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || DEFAULT_TYPOGRAPHY.label.font_weight,
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || DEFAULT_TYPOGRAPHY.annotation.font_family,
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || DEFAULT_TYPOGRAPHY.annotation.font_size,
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || DEFAULT_TYPOGRAPHY.annotation.font_weight,
        },
        textColor: rawColors.text_color || DEFAULT_COLORS.text_color,
        backgroundColor: rawColors.background_color || DEFAULT_COLORS.background_color,
        primaryColor: (rawColors.other && rawColors.other.primary) || DEFAULT_COLORS.other.primary,
        defaultCategoryColors: rawColors.available_colors || DEFAULT_COLORS.available_colors,
        categoryColorMappings: rawColors.field || DEFAULT_COLORS.field,
        gridSubtleColor: DEFAULT_COLORS.grid_subtle_color, // For gauge background arc
    };

    fillStyle.getCategoryColor = (categoryName, index) => {
        if (fillStyle.categoryColorMappings && fillStyle.categoryColorMappings[categoryName]) {
            return fillStyle.categoryColorMappings[categoryName];
        }
        if (fillStyle.defaultCategoryColors && fillStyle.defaultCategoryColors.length > 0) {
            return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
        }
        return fillStyle.primaryColor;
    };

    function estimateTextWidth(text, styleProps) {
        const { fontFamily, fontSize, fontWeight } = styleProps;
        const tempSvgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const tempTextNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tempTextNode.setAttribute("font-family", fontFamily);
        tempTextNode.setAttribute("font-size", fontSize);
        tempTextNode.setAttribute("font-weight", fontWeight);
        tempTextNode.textContent = text;
        tempSvgNode.appendChild(tempTextNode);
        document.body.appendChild(tempSvgNode); // Required for getBBox to work reliably
        let width = 0;
        try {
            width = tempTextNode.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth failed:", e);
            const size = parseFloat(fontSize) || 12;
            width = text.length * size * 0.6; // Fallback
        }
        document.body.removeChild(tempSvgNode); // Clean up
        return width;
    }
    
    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value);
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
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 30, bottom: 40, left: 30 }; // Top margin for legend
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Legend layout constants
    const legendConfig = {
        itemSpacing: 15,
        rowSpacing: parseFloat(fillStyle.typography.labelFontSize) * 0.5, // Relative to font size
        iconSize: parseFloat(fillStyle.typography.labelFontSize) * 0.8, // Relative to font size
        iconTextSpacing: 5,
        maxWidth: innerWidth, // Max width for legend rows
    };
    
    // Gauge parameters
    const gaugeCenterX = innerWidth / 2;
    const gaugeCenterY = innerHeight * 0.5; // Vertically center the gauge in its allocated space
    const maxGaugeRadius = Math.min(innerWidth, innerHeight * 0.9) / 2; // 0.9 to give some padding

    // Block 5: Data Preprocessing & Transformation
    const categoryData = [];
    const uniqueCategories = [...new Set(rawChartData.map(d => d[categoryFieldName]))];

    uniqueCategories.forEach((catName, index) => {
        const item = rawChartData.find(d => d[categoryFieldName] === catName);
        if (item) {
            categoryData.push({
                categoryName: String(catName), // Ensure string
                value: +item[valueFieldName],
                color: fillStyle.getCategoryColor(String(catName), index)
            });
        }
    });

    categoryData.sort((a, b) => b.value - a.value); // Larger values for outer arcs

    if (rawChartData.length === 0 || categoryData.length === 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .text("No data available to display chart.");
        return svgRoot.node();
    }
    
    const numLayers = categoryData.length > 0 ? categoryData.length : 1;
    const arcThickness = Math.max(12, maxGaugeRadius / (numLayers + 1.5)); // +1.5 for more spacing if many layers
    const gapBetweenLayers = Math.max(4, arcThickness * 0.2);

    // Block 6: Scale Definition & Configuration
    const globalMaxValue = categoryData.length > 0 ? Math.max(1, ...categoryData.map(d => d.value)) : 100;
    const angleScale = d3.scaleLinear().domain([0, globalMaxValue]).range([0, Math.PI]); // 0 to 180 degrees

    const arcStartAngle = -Math.PI / 2; // 12 o'clock
    const arcEndAngle = Math.PI / 2;    // 6 o'clock

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendContainerGroup = svgRoot.append("g")
        .attr("class", "other legend-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - (legendConfig.rowSpacing + parseFloat(fillStyle.typography.labelFontSize)) /2 * (categoryData.length > 0 ? 1:0) })`); // Adjust Y to center in top margin

    const legendItems = categoryData.map(d => {
        const textWidth = estimateTextWidth(d.categoryName, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        return {
            label: d.categoryName,
            color: d.color,
            width: legendConfig.iconSize + legendConfig.iconTextSpacing + textWidth
        };
    });

    const legendRows = [];
    let currentRowItems = [], currentRowWidth = 0;
    legendItems.forEach(item => {
        const requiredWidth = currentRowWidth + item.width + (currentRowItems.length > 0 ? legendConfig.itemSpacing : 0);
        if (currentRowItems.length === 0 || requiredWidth <= legendConfig.maxWidth) {
            currentRowItems.push(item);
            currentRowWidth = requiredWidth;
        } else {
            legendRows.push(currentRowItems);
            currentRowItems = [item];
            currentRowWidth = item.width;
        }
    });
    if (currentRowItems.length > 0) legendRows.push(currentRowItems);

    const maxLegendRowWidth = Math.max(0, ...legendRows.map(row =>
        row.reduce((sum, item, i) => sum + item.width + (i > 0 ? legendConfig.itemSpacing : 0), 0)
    ));
    
    const legendInitialX = (innerWidth - maxLegendRowWidth) / 2; // Center rows
    let currentLegendY = 0;

    legendRows.forEach((row) => {
        const totalRowWidth = row.reduce((sum, item, i) => sum + item.width + (i > 0 ? legendConfig.itemSpacing : 0), 0);
        let currentX = legendInitialX + (maxLegendRowWidth - totalRowWidth) / 2; // Center this specific row within max width
        
        row.forEach(item => {
            const itemGroup = legendContainerGroup.append("g")
                .attr("class", "other legend-item")
                .attr("transform", `translate(${currentX}, ${currentLegendY})`);

            itemGroup.append("circle")
                .attr("class", "mark legend-icon")
                .attr("cx", legendConfig.iconSize / 2)
                .attr("cy", parseFloat(fillStyle.typography.labelFontSize) / 2 - legendConfig.iconSize / 4) // Align with text middle
                .attr("r", legendConfig.iconSize / 2)
                .attr("fill", item.color);

            itemGroup.append("text")
                .attr("class", "label legend-text")
                .attr("x", legendConfig.iconSize + legendConfig.iconTextSpacing)
                .attr("y", parseFloat(fillStyle.typography.labelFontSize) / 2 + parseFloat(fillStyle.typography.labelFontSize) * 0.1) // dominant-baseline approx
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .attr("fill", fillStyle.textColor)
                .attr("dominant-baseline", "middle")
                .text(item.label);
            currentX += item.width + legendConfig.itemSpacing;
        });
        currentLegendY += parseFloat(fillStyle.typography.labelFontSize) + legendConfig.rowSpacing;
    });
    
    // Adjust top margin dynamically based on legend height
    const legendHeight = currentLegendY > 0 ? currentLegendY - legendConfig.rowSpacing : 0;
    const dynamicTopMargin = legendHeight + 20; // 20px padding below legend
    chartMargins.top = Math.max(chartMargins.top, dynamicTopMargin); // Ensure it's at least the original or new dynamic
    
    // Re-calculate innerHeight and gaugeCenterY if margin changed
    const finalInnerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const finalGaugeCenterY = finalInnerHeight * 0.5;


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other main-chart-group")
        .attr("transform", `translate(${chartMargins.left + gaugeCenterX}, ${chartMargins.top + finalGaugeCenterY})`);

    categoryData.forEach((d, i) => {
        const outerRadius = maxGaugeRadius - i * (arcThickness + gapBetweenLayers);
        const innerRadius = outerRadius - arcThickness;

        if (innerRadius < 0) return; // Skip if arc is too small to draw

        const backgroundArcGenerator = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius)
            .startAngle(arcStartAngle)
            .endAngle(arcEndAngle);

        mainChartGroup.append("path")
            .attr("class", "mark background-arc")
            .attr("d", backgroundArcGenerator)
            .attr("fill", fillStyle.gridSubtleColor)
            .attr("opacity", 0.7);

        const valueArcGenerator = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius)
            .startAngle(arcStartAngle); // End angle will be set by data

        const targetAngle = arcStartAngle + angleScale(d.value);
        
        mainChartGroup.append("path")
            .attr("class", "mark value-arc")
            .datum({ startAngle: arcStartAngle, endAngle: targetAngle })
            .attr("d", valueArcGenerator)
            .attr("fill", d.color);

        // Value Label
        const labelRadius = (innerRadius + outerRadius) / 2;
        const labelAnglePosition = Math.PI; // 9 o'clock position for label text
        const labelX = labelRadius * Math.cos(labelAnglePosition); // Horizontal position
        const labelY = labelRadius * Math.sin(labelAnglePosition) + arcThickness * 0.1; // Vertical, slightly offset if needed

        const baseFontSizeNumeric = parseFloat(fillStyle.typography.annotationFontSize);
        const maxAllowedFontSize = Math.min(arcThickness * 0.6, baseFontSizeNumeric);
        const minAllowedFontSize = Math.max(8, arcThickness * 0.3);
        let finalFontSize = maxAllowedFontSize;

        const formattedVal = formatValue(d.value);
        const textWidth = estimateTextWidth(formattedVal, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: finalFontSize + "px",
            fontWeight: fillStyle.typography.annotationFontWeight
        });
        
        const availableTextWidth = arcThickness * 1.5; // Allow some overflow from center
        if (textWidth > availableTextWidth && textWidth > 0) { // textWidth > 0 to avoid division by zero
            finalFontSize = Math.max(minAllowedFontSize, finalFontSize * availableTextWidth / textWidth);
        }
        
        mainChartGroup.append("text")
            .attr("class", "value data-label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", finalFontSize + "px")
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", d.color) // Or a contrasting color: fillStyle.textColor
            .text(formattedVal);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects, shadows, or gradients.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}