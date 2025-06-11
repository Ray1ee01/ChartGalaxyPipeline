/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pyramid Chart",
  "chart_name": "pyramid_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
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
  "valueSortDirection": "ascending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a Pyramid Chart.
    // Segments are sized based on value, forming a pyramid shape, sorted ascending by value.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Supports light/dark theme color objects
    const images = data.images || {}; // Parsed but not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !valueColumn) {
        const missingFields = [];
        if (!categoryColumn) missingFields.push("category field (role 'x')");
        if (!valueColumn) missingFields.push("value field (role 'y')");
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            // Default to prompt's specified "sensible defaults"
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px', // Original used 14px
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal', // Original used bold
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#0f223b',
        segmentColor: (categoryName, index) => {
            if (colors.field && colors.field[categoryName]) {
                return colors.field[categoryName];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return d3.schemeCategory10[index % 10]; // Default D3 categorical colors
        }
    };

    // In-memory text measurement utility
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.style.fontFamily = fontProps.fontFamily;
        textElement.style.fontSize = fontProps.fontSize;
        textElement.style.fontWeight = fontProps.fontWeight;
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // Assumes getBBox works on non-DOM-appended SVG elements as per prompt's implication.
        const width = textElement.getBBox().width;
        // tempSvg and textElement are not appended to DOM, will be garbage collected.
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const svgWidth = variables.width || 800;
    const svgHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    const chartMargins = { top: 40, right: 120, bottom: 40, left: 60 }; // Based on original

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other"); // 'other' as it's a general grouping

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = svgWidth - chartMargins.left - chartMargins.right;
    const innerHeight = svgHeight - chartMargins.top - chartMargins.bottom;

    const maxPyramidVisualWidth = innerWidth * 0.6; // Max width of the pyramid base on screen (from original)
    const conceptualPyramidHeight = innerHeight * 0.6; // Conceptual height of the full triangle (from original)

    // Block 5: Data Preprocessing & Transformation
    if (!Array.isArray(chartDataInput) || chartDataInput.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "text error-message")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No data available to display.");
        return svgRoot.node();
    }
    
    const sortedData = [...chartDataInput].sort((a, b) => a[valueFieldName] - b[valueFieldName]);

    const totalValue = d3.sum(sortedData, d => d[valueFieldName]);
    if (totalValue <= 0) { // Also handle negative total, though unlikely for pyramid
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "text error-message")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text(totalValue === 0 ? "Data values sum to zero." : "Total data value is not positive.");
        return svgRoot.node();
    }

    const processedPyramidSegments = [];
    let currentPyramidY = 0; // Tracks the Y position for the apex of the current segment

    sortedData.forEach(d => {
        const value = d[valueFieldName];
        const percent = (value / totalValue) * 100;
        
        const conceptualTotalArea = (maxPyramidVisualWidth * conceptualPyramidHeight) / 2;
        const segmentArea = conceptualTotalArea * (percent / 100);

        const segmentApexWidth = maxPyramidVisualWidth * (currentPyramidY / conceptualPyramidHeight);

        const quadA = maxPyramidVisualWidth / (2 * conceptualPyramidHeight);
        const quadB = segmentApexWidth;
        const quadC = -2 * segmentArea;

        let segmentHeight = 0;
        if (Math.abs(quadA) < 1e-9) { // Effectively A is zero (linear equation B*h + C = 0)
            segmentHeight = (Math.abs(quadB) < 1e-9) ? 0 : (-quadC / quadB);
        } else {
            const discriminant = quadB * quadB - 4 * quadA * quadC;
            if (discriminant >= 0) {
                segmentHeight = (-quadB + Math.sqrt(discriminant)) / (2 * quadA);
            } else { // Fallback if no real solution (e.g. area too large for tapering pyramid tip)
                segmentHeight = conceptualPyramidHeight * (percent / 100); // Proportional height
            }
        }
        if (segmentHeight < 0) segmentHeight = 0; // Height cannot be negative

        const segmentBaseY = currentPyramidY + segmentHeight;
        const segmentBaseWidth = maxPyramidVisualWidth * (segmentBaseY / conceptualPyramidHeight);

        processedPyramidSegments.push({
            originalDataPoint: d,
            calculatedPercent: percent,
            yApex: currentPyramidY,
            yBase: segmentBaseY,
            widthApex: segmentApexWidth,
            widthBase: segmentBaseWidth,
        });
        currentPyramidY = segmentBaseY;
    });
    
    const actualRenderedPyramidHeight = currentPyramidY;
    const verticalOffset = (innerHeight - actualRenderedPyramidHeight) / 2;

    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales needed for positioning pyramid segments.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // No axes, gridlines, or legend for this pyramid chart.

    // Block 8: Main Data Visualization Rendering
    const pyramidSegmentsGroup = mainChartGroup.append("g")
        .attr("class", "pyramid-segments-group other");

    processedPyramidSegments.forEach((segment, i) => {
        const categoryName = segment.originalDataPoint[categoryFieldName];
        const segmentColor = fillStyle.segmentColor(categoryName, i);

        const points = [
            [innerWidth / 2 - segment.widthApex / 2, segment.yApex + verticalOffset],
            [innerWidth / 2 + segment.widthApex / 2, segment.yApex + verticalOffset],
            [innerWidth / 2 + segment.widthBase / 2, segment.yBase + verticalOffset],
            [innerWidth / 2 - segment.widthBase / 2, segment.yBase + verticalOffset]
        ];

        pyramidSegmentsGroup.append("polygon")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", segmentColor)
            .attr("class", "mark pyramid-segment");

        const labelY = (segment.yApex + segment.yBase) / 2 + verticalOffset;
        const labelX = innerWidth / 2 + Math.max(segment.widthApex, segment.widthBase) / 2 + 10; 

        pyramidSegmentsGroup.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "label data-label")
            .text(`${categoryName} ${Math.round(segment.calculatedPercent)}%`);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // None for this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}