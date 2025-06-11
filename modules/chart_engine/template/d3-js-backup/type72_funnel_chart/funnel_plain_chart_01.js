/* REQUIREMENTS_BEGIN
{
  "chart_type": "Funnel Chart",
  "chart_name": "funnel_plain_chart_01",
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data; // Use data directly
    const chartDataArray = chartConfig.data && chartConfig.data.data ? chartConfig.data.data : [];
    const variables = chartConfig.variables || {};
    const typographyConfig = chartConfig.typography || {};
    const colorsConfig = chartConfig.colors || {};
    const imagesConfig = chartConfig.images || {}; // Though not used in this chart
    const dataColumns = chartConfig.data && chartConfig.data.columns ? chartConfig.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryRole = "x";
    const valueRole = "y";

    const categoryColumn = dataColumns.find(col => col.role === categoryRole);
    const valueColumn = dataColumns.find(col => col.role === valueRole);

    let configErrors = [];
    if (!categoryColumn) {
        configErrors.push(`Data column with role '${categoryRole}' (for category) not found.`);
    }
    if (!valueColumn) {
        configErrors.push(`Data column with role '${valueRole}' (for value) not found.`);
    }
    if (chartDataArray.length === 0) {
        configErrors.push("Chart data is empty.");
    }


    if (configErrors.length > 0) {
        const errorMessage = `Critical chart configuration errors: ${configErrors.join(" ")} Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" }, // Original had 14px bold, now config-driven
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"], // d3.schemeCategory10
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };

    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || defaultTypography.label.font_family,
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || defaultTypography.label.font_size,
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || defaultTypography.label.font_weight,
        },
        textColor: colorsConfig.text_color || defaultColors.text_color,
        backgroundColor: colorsConfig.background_color || defaultColors.background_color,
        getSegmentColor: (categoryValue, index) => {
            if (colorsConfig.field && colorsConfig.field[categoryValue]) {
                return colorsConfig.field[categoryValue];
            }
            const availableColors = colorsConfig.available_colors && colorsConfig.available_colors.length > 0 ? colorsConfig.available_colors : defaultColors.available_colors;
            return availableColors[index % availableColors.length];
        }
    };
    
    // In-memory text measurement utility (not used by this specific chart, but required)
    function estimateTextWidth(text, fontProps) {
        if (!text || !fontProps) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: getBBox on an unattached element can sometimes be unreliable across browsers for complex cases.
        // For simple text, it's generally fine.
        return tempText.getBBox().width;
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("class", "chart-svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 120, bottom: 40, left: 60 }; // Original margins
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const maxFunnelWidth = innerWidth * 0.8; // 80% of drawable width for funnel
    const funnelTotalHeight = innerHeight * 0.8; // 80% of drawable height for funnel

    // Block 5: Data Preprocessing & Transformation
    // Sort data by value descending (larger values at the top of the funnel)
    const sortedChartData = [...chartDataArray].sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    const totalValue = d3.sum(sortedChartData, d => d[valueFieldName]);

    // Add percentage to each data point
    const processedData = sortedChartData.map(d => ({
        ...d, // Copy original data
        percent: totalValue > 0 ? (d[valueFieldName] / totalValue) * 100 : 0
    }));
    
    if (processedData.length === 0) { // Should have been caught by configErrors, but as a safeguard
        console.warn("No data to render after processing.");
        return svgRoot.node();
    }

    const sectionHeight = funnelTotalHeight / processedData.length; // Equal height for each section

    // Block 6: Scale Definition & Configuration
    // Width scale maps percentage (0-100) to pixel width for funnel segments
    const funnelWidthScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.percent) || 100]) // Max percent or 100 if all zero
        .range([0, maxFunnelWidth]);
    
    // Calculate actual widths for each section based on their percentage of the max value, not total.
    // Or, if funnel segments represent share of total, then domain should be [0, 100]
    // The original code used d.percent (share of total) for widthScale.
    // Let's re-evaluate: if widthScale domain is [0,100], then sectionWidths are directly proportional to their percent of total.
    // If domain is [0, maxPercent], then the largest segment gets maxFunnelWidth.
    // The original code: widthScale.domain([0, 100]).range([0, maxFunnelWidth]);
    // This means a segment representing 100% of total would take maxFunnelWidth.
    // This seems correct for a typical funnel.
    
    const revisedWidthScale = d3.scaleLinear()
        .domain([0, 100]) // Percent domain
        .range([0, maxFunnelWidth]); // Max width of a segment

    const sectionWidths = processedData.map(d => revisedWidthScale(d.percent));

    const verticalCenteringOffset = (innerHeight - funnelTotalHeight) / 2;

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart (no axes, gridlines, legend by default)

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    processedData.forEach((d, i) => {
        const segmentColor = fillStyle.getSegmentColor(d[categoryFieldName], i);

        const topWidth = sectionWidths[i];
        // Next segment's width, or 80% of current for the last segment's bottom
        const bottomWidth = (i < processedData.length - 1) ? sectionWidths[i+1] : topWidth * 0.8;
        
        const segmentYPosition = i * sectionHeight + verticalCenteringOffset;

        // Points for the trapezoid: [TopLeft, TopRight, BottomRight, BottomLeft]
        const points = [
            [innerWidth / 2 - topWidth / 2, segmentYPosition],
            [innerWidth / 2 + topWidth / 2, segmentYPosition],
            [innerWidth / 2 + bottomWidth / 2, segmentYPosition + sectionHeight],
            [innerWidth / 2 - bottomWidth / 2, segmentYPosition + sectionHeight]
        ];

        mainChartGroup.append("polygon")
            .attr("class", "mark funnel-segment")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", segmentColor);

        // Add labels
        const labelText = `${d[categoryFieldName]} ${Math.round(d.percent)}%`;
        mainChartGroup.append("text")
            .attr("class", "label data-label")
            .attr("x", innerWidth / 2 + topWidth / 2 + 10) // Position to the right of the segment + padding
            .attr("y", segmentYPosition + sectionHeight / 2)
            .attr("dominant-baseline", "middle")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(labelText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements)
    // Not applicable for this basic funnel chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}