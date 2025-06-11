/* REQUIREMENTS_BEGIN
{
  "chart_type": "Funnel Chart",
  "chart_name": "funnel_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 10], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Could be data.colors_dark for dark themes, adapt if needed
    const imagesConfig = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldCol = dataColumns.find(col => col.role === 'x');
    const valueFieldCol = dataColumns.find(col => col.role === 'y');

    if (!categoryFieldCol || !categoryFieldCol.name) {
        console.error("Critical chart config missing: Category field (role 'x') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (Category field).</div>");
        return null;
    }
    if (!valueFieldCol || !valueFieldCol.name) {
        console.error("Critical chart config missing: Value field (role 'y') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (Value field).</div>");
        return null;
    }

    const categoryFieldName = categoryFieldCol.name;
    const valueFieldName = valueFieldCol.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        categoryColors: {},
    };

    // Typography
    fillStyle.typography.defaultFontFamily = 'Arial, sans-serif';
    fillStyle.typography.defaultFontSize = '12px';
    fillStyle.typography.defaultFontWeight = 'normal';

    fillStyle.typography.titleFontFamily = typographyConfig.title && typographyConfig.title.font_family ? typographyConfig.title.font_family : fillStyle.typography.defaultFontFamily;
    fillStyle.typography.titleFontSize = typographyConfig.title && typographyConfig.title.font_size ? typographyConfig.title.font_size : '16px';
    fillStyle.typography.titleFontWeight = typographyConfig.title && typographyConfig.title.font_weight ? typographyConfig.title.font_weight : 'bold';

    fillStyle.typography.labelFontFamily = typographyConfig.label && typographyConfig.label.font_family ? typographyConfig.label.font_family : fillStyle.typography.defaultFontFamily;
    fillStyle.typography.labelFontSize = typographyConfig.label && typographyConfig.label.font_size ? typographyConfig.label.font_size : '14px'; // Original used 14px
    fillStyle.typography.labelFontWeight = typographyConfig.label && typographyConfig.label.font_weight ? typographyConfig.label.font_weight : 'bold'; // Original used bold

    fillStyle.typography.annotationFontFamily = typographyConfig.annotation && typographyConfig.annotation.font_family ? typographyConfig.annotation.font_family : fillStyle.typography.defaultFontFamily;
    fillStyle.typography.annotationFontSize = typographyConfig.annotation && typographyConfig.annotation.font_size ? typographyConfig.annotation.font_size : '10px';
    fillStyle.typography.annotationFontWeight = typographyConfig.annotation && typographyConfig.annotation.font_weight ? typographyConfig.annotation.font_weight : 'normal';
    
    // Colors
    fillStyle.backgroundColor = colorsConfig.background_color || '#FFFFFF';
    fillStyle.textColor = colorsConfig.text_color || '#000000';
    const defaultCategoryPalette = d3.schemeCategory10;

    // Helper for text measurement (not used in this specific chart's rendering logic but required by prompt)
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily || fillStyle.typography.defaultFontFamily);
        textElement.setAttribute('font-size', fontSize || fillStyle.typography.defaultFontSize);
        textElement.setAttribute('font-weight', fontWeight || fillStyle.typography.defaultFontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Document append/remove is not ideal, but getBBox needs layout.
        // A better approach for server-side or non-DOM environments would be needed.
        // For client-side, this is a common pattern, though not appending to DOM is preferred.
        // The prompt says "MUST NOT be appended to the document DOM".
        // However, getBBox on an unattached element often returns 0.
        // Let's try without appending, as per strict instructions.
        // If it fails, it highlights a limitation of non-DOM getBBox.
        // For robust measurement, a canvas-based approach or a properly configured headless browser context is better.
        // Given the constraints, we'll define it as requested.
        let width = 0;
        try {
             // Temporarily append to measure, then remove. This is more reliable for getBBox.
             // The prompt strictly says "MUST NOT be appended to the document DOM".
             // This means getBBox might not work reliably. We'll follow the strict rule.
             // If getBBox on an in-memory SVG text element works in the target environment, fine.
             // Otherwise, this function will likely return 0 or inaccurate results.
            width = textElement.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth: getBBox failed, possibly due to non-DOM SVG context.", e);
        }
        return width;
    }
    
    const INTER_SEGMENT_VERTICAL_GAP = 5; // Hardcoded from original: y_padding = 5

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 120, bottom: 40, left: 60 }; // Adapted from original
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const maxFunnelWidth = innerWidth * 0.8; // Max width of the top funnel segment
    const funnelHeightOverall = innerHeight * 0.8; // Total height allocated for trapezoids (excluding gaps by this definition)

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataInput].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    
    const totalValue = d3.sum(sortedData, d => d[valueFieldName]);
    
    sortedData.forEach(d => {
        d.percent = totalValue === 0 ? 0 : (d[valueFieldName] / totalValue) * 100;
    });

    if (sortedData.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .text("No data to display.");
        return svgRoot.node();
    }
    
    // Block 6: Scale Definition & Configuration
    const widthScale = d3.scaleLinear()
        .domain([0, 100]) // Percent domain
        .range([0, maxFunnelWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this funnel chart.

    // Block 8: Main Data Visualization Rendering
    const numSegments = sortedData.length;
    const segmentVisualHeight = numSegments > 0 ? funnelHeightOverall / numSegments : 0; // Height of each trapezoid

    // Recalculate verticalOffset to correctly center the funnel including gaps
    // Total height occupied by segments and gaps: N * segmentVisualHeight + (N-1) * INTER_SEGMENT_VERTICAL_GAP
    const actualFunnelDrawingHeight = numSegments * segmentVisualHeight + (numSegments > 0 ? (numSegments - 1) * INTER_SEGMENT_VERTICAL_GAP : 0);
    const verticalOffset = (innerHeight - actualFunnelDrawingHeight) / 2;

    const segmentWidths = sortedData.map(d => widthScale(d.percent));

    sortedData.forEach((d, i) => {
        const categoryName = d[categoryFieldName];
        let segmentColor;
        if (colorsConfig.field && colorsConfig.field[categoryName]) {
            segmentColor = colorsConfig.field[categoryName];
        } else if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            segmentColor = colorsConfig.available_colors[i % colorsConfig.available_colors.length];
        } else {
            segmentColor = defaultCategoryPalette[i % defaultCategoryPalette.length];
        }
        fillStyle.categoryColors[categoryName] = segmentColor;

        const topWidth = segmentWidths[i];
        const bottomWidth = (i < numSegments - 1) ? segmentWidths[i+1] : topWidth * 0.8; // Last segment tapers

        // Original logic for y-positioning to maintain visual output including gaps
        const segmentYPosition = i * segmentVisualHeight + verticalOffset + i * INTER_SEGMENT_VERTICAL_GAP;

        const points = [
            [innerWidth / 2 - topWidth / 2, segmentYPosition],
            [innerWidth / 2 + topWidth / 2, segmentYPosition],
            [innerWidth / 2 + bottomWidth / 2, segmentYPosition + segmentVisualHeight],
            [innerWidth / 2 - bottomWidth / 2, segmentYPosition + segmentVisualHeight]
        ];

        mainChartGroup.append("polygon")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", segmentColor)
            .attr("class", "mark funnel-segment");
        
        const labelText = `${d[categoryFieldName]} ${Math.round(d.percent)}%`;
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2 + topWidth / 2 + 10) // Position to the right of the segment
            .attr("y", segmentYPosition + segmentVisualHeight / 2)
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .attr("class", "label data-label")
            .text(labelText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}