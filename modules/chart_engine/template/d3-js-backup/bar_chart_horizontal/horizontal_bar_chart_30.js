/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_30",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
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
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The REQUIREMENTS_BEGIN...REQUIREMENTS_END block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Assumes data.colors for light theme, or data.colors_dark if specified by caller
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!dimensionFieldDef || !valueFieldDef) {
        console.error("Critical chart config missing: Dimension (x) or Value (y) field definition not found in data.data.columns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration missing (dimension/value fields).</div>");
        }
        return null;
    }

    const dimensionFieldName = dimensionFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    if (!chartDataArray || chartDataArray.length === 0) {
        console.warn("Chart data is empty. Nothing to render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:orange; text-align:center; padding:20px;'>Chart data is empty.</div>");
        }
        return null;
    }
    
    // Validate that valueFieldName actually yields numbers and there's at least one valid data point
    const firstValidValue = chartDataArray.find(d => typeof d[valueFieldName] === 'number' && !isNaN(d[valueFieldName]));
    if (firstValidValue === undefined) {
        console.error(`Invalid or missing numerical data for value field: ${valueFieldName}. Cannot render.`);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>Error: Invalid or missing numerical data for value field '${valueFieldName}'.</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            baseFontFamily: typographyConfig.label?.font_family || "Arial, sans-serif", // General base
            annotationFontFamily: typographyConfig.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyConfig.annotation?.font_size || "10px",
            annotationFontWeight: typographyConfig.annotation?.font_weight || "normal",
            labelFontFamily: typographyConfig.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyConfig.label?.font_size || "12px",
            labelFontWeight: typographyConfig.label?.font_weight || "normal",
        },
        barColor: colorsConfig.other?.primary || "#882e2e",
        textColor: colorsConfig.text_color || "#333333",
        barLabelColor: "#FFFFFF", // Labels inside bars are typically white for contrast
        rankingCircleFill: "#000000",
        rankingCircleTextColor: "#FFFFFF",
        iconBackgroundColor: "#FFFFFF",
        chartBackground: colorsConfig.background_color || "transparent", // Use transparent if not specified
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        // Per directive III.2: In-memory SVG, not appended to DOM.
        // Note: getBBox() on non-rendered elements can be unreliable (often returns 0).
        // This implementation follows the directive strictly.
        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        svgNode.appendChild(textNode);
        // Attempt to get BBox. If this environment doesn't support it for unattached elements, width may be 0.
        try {
            return textNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox fails on unattached elements or if text is empty
            // A simple character count based estimation could be a last resort.
            const avgCharWidth = parseFloat(fontSize) * 0.6; // Very rough estimate
            return (text || "").length * avgCharWidth;
        }
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    // Height calculation is deferred until bar heights are known

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("class", "chart-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    if (fillStyle.chartBackground !== "transparent") {
        svgRoot.style("background-color", fillStyle.chartBackground);
    }

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 60, bottom: 40, left: 20 }; // Reduced top margin

    const MIN_BAR_HEIGHT = 36;
    const MAX_BAR_HEIGHT = 72;
    const fixedBarSpacing = 15; // Spacing between bars

    // Units
    let dimensionUnit = dimensionFieldDef.unit !== "none" ? dimensionFieldDef.unit : "";
    let valueUnit = valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray]
        .filter(d => typeof d[valueFieldName] === 'number' && !isNaN(d[valueFieldName])) // Ensure only valid numbers
        .sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    
    if (sortedData.length === 0) {
        console.warn("No valid data points after filtering. Cannot render chart.");
         if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:orange; text-align:center; padding:20px;'>No valid data to display.</div>");
        }
        return null;
    }

    const sortedDimensions = sortedData.map(d => d[dimensionFieldName]);

    const maxValue = d3.max(sortedData, d => +d[valueFieldName]);
    const minValue = d3.min(sortedData, d => +d[valueFieldName]);

    // Block 6: Scale Definition & Configuration
    const barHeightScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([1, 2]) // Multiplier for base bar height
        .clamp(true); // Clamp to ensure it stays within 1-2 range

    const baseBarHeight = Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, 50));

    const barHeights = sortedData.map(d => {
        const hScale = (maxValue === minValue) ? 1.5 : barHeightScale(+d[valueFieldName]); // Handle single value case
        return baseBarHeight * hScale;
    });
    
    const minActualBarHeight = Math.min(...barHeights); // Smallest rendered bar height

    const totalBarSpaceNeeded = barHeights.reduce((sum, height) => sum + height, 0) + (barHeights.length - 1) * fixedBarSpacing;
    
    const minContainerHeight = chartConfig.min_height || 400;
    const calculatedHeight = Math.max(minContainerHeight, totalBarSpaceNeeded + chartMargins.top + chartMargins.bottom);
    const containerHeight = chartConfig.height || calculatedHeight;

    svgRoot.attr("width", containerWidth).attr("height", containerHeight);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const xScale = d3.scaleLinear()
        .domain([0, maxValue * 1.05]) // Add 5% padding to domain
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 8: Main Data Visualization Rendering
    let currentY = 0;
    const barYPositions = barHeights.map(h => {
        const yPos = currentY;
        currentY += h + fixedBarSpacing;
        return yPos;
    });

    const totalRenderedHeight = currentY - fixedBarSpacing; // Total height used by bars and spacing
    const offsetY = (innerHeight - totalRenderedHeight) / 2; // For vertical centering

    const uniformCircleRadius = Math.max(8, minActualBarHeight * 0.3); // Ensure minimum radius

    sortedData.forEach((d, i) => {
        const dimensionValue = d[dimensionFieldName];
        const numericValue = +d[valueFieldName];
        
        const barBandHeight = barHeights[i];
        const yPos = offsetY + barYPositions[i];
        const barWidth = xScale(numericValue);
        const barCenterY = yPos + barBandHeight / 2;

        const barGroup = mainChartGroup.append("g")
            .attr("class", "bar-item-group");

        barGroup.append("rect")
            .attr("class", "mark bar")
            .attr("x", 0)
            .attr("y", yPos)
            .attr("width", barWidth)
            .attr("height", barBandHeight)
            .attr("fill", fillStyle.barColor)
            .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
            .on("mouseout", function() { d3.select(this).attr("opacity", 1); });

        const iconSize = barBandHeight * 0.7;
        const iconX = 10; // Padding from left edge of bar
        const iconY = yPos + (barBandHeight - iconSize) / 2;

        const iconUrl = imagesConfig.field && imagesConfig.field[dimensionValue] ? imagesConfig.field[dimensionValue] : null;
        if (iconUrl) {
            barGroup.append("circle")
                .attr("class", "mark other icon-background")
                .attr("cx", iconX + iconSize / 2)
                .attr("cy", iconY + iconSize / 2)
                .attr("r", iconSize / 2)
                .attr("fill", fillStyle.iconBackgroundColor);

            barGroup.append("image")
                .attr("class", "icon image")
                .attr("x", iconX)
                .attr("y", iconY)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
        }

        const formattedNumericValue = valueUnit ? `${formatValue(numericValue)}${valueUnit}` : formatValue(numericValue);
        const valueLabelFontSize = `${Math.max(8, barBandHeight * 0.30)}px`; // Ensure min font size
        const dimensionLabelFontSize = `${Math.max(7, barBandHeight * 0.20)}px`; // Ensure min font size

        const tempValueWidth = estimateTextWidth(formattedNumericValue, fillStyle.typography.annotationFontFamily, valueLabelFontSize, "bold");
        
        // Check if value + dimension label (two lines) fit inside
        const labelPadding = iconUrl ? (iconX + iconSize + 15) : 15; // Space for icon + padding or just padding
        const availableWidthForLabel = barWidth - labelPadding - 15; // 15 for right padding
        const labelFitsInside = tempValueWidth < availableWidthForLabel && (estimateTextWidth(dimensionValue, fillStyle.typography.labelFontFamily, dimensionLabelFontSize, fillStyle.typography.labelFontWeight) < availableWidthForLabel);


        if (labelFitsInside) {
            barGroup.append("text") // Value label
                .attr("class", "label text value-label")
                .attr("x", barWidth - 15)
                .attr("y", barCenterY - barBandHeight * 0.12) // Adjusted for two lines
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", valueLabelFontSize)
                .style("font-weight", "bold") // Explicit bold for value
                .style("fill", fillStyle.barLabelColor)
                .text(formattedNumericValue);

            barGroup.append("text") // Dimension label
                .attr("class", "label text dimension-label")
                .attr("x", barWidth - 15)
                .attr("y", barCenterY + barBandHeight * 0.18) // Adjusted for two lines
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", dimensionLabelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.barLabelColor)
                .text(dimensionValue);
        } else if (tempValueWidth < availableWidthForLabel) { // Only value label fits on right
             barGroup.append("text")
                .attr("class", "label text value-label")
                .attr("x", barWidth - 15)
                .attr("y", barCenterY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", valueLabelFontSize)
                .style("font-weight", "bold")
                .style("fill", fillStyle.barLabelColor)
                .text(formattedNumericValue);
        } else { // Value label on the left if it doesn't fit on the right
            barGroup.append("text")
                .attr("class", "label text value-label")
                .attr("x", labelPadding) // Place after icon or general padding
                .attr("y", barCenterY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", valueLabelFontSize)
                .style("font-weight", "bold") 
                .style("fill", fillStyle.barLabelColor)
                .text(formattedNumericValue);
        }

        const rankingCirclePadding = 5;
        const rankingCircleX = barWidth + rankingCirclePadding + uniformCircleRadius;

        barGroup.append("circle")
            .attr("class", "mark other ranking-circle-bg")
            .attr("cx", rankingCircleX)
            .attr("cy", barCenterY)
            .attr("r", uniformCircleRadius)
            .attr("fill", fillStyle.rankingCircleFill);

        barGroup.append("text")
            .attr("class", "label text ranking-text")
            .attr("x", rankingCircleX)
            .attr("y", barCenterY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${Math.max(7, uniformCircleRadius * 1.1)}px`) // Ensure min font size
            .style("font-weight", "bold") // Explicit bold for rank
            .style("fill", fillStyle.rankingCircleTextColor)
            .text(i + 1);

        if (i === 0 && valueUnit) {
            mainChartGroup.append("text") // Append to mainChartGroup to position relative to all bars
                .attr("class", "label text unit-label")
                .attr("x", innerWidth) // Align to the right of the chart area
                .attr("y", offsetY - 5 < 10 ? 10 : offsetY -5) // Position above the first bar, ensure not too close to top
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(`(${valueUnit})`);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Hover effects are handled inline with bar creation.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}