/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Bar Chart",
  "chart_name": "radial_bar_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "subtle",
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
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or use data.colors_dark for dark themes if specified
    const images = data.images || {}; // Not used in this chart, but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');

    if (!xFieldConfig || !xFieldConfig.name || !yFieldConfig || !yFieldConfig.name) {
        console.error("Critical chart config missing: Required field names for x or y roles are not defined in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Critical chart configuration missing. Required field names for 'x' or 'y' roles are not defined.</div>");
        return null;
    }
    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            categoryLabelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            categoryLabelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '16px',
            categoryLabelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold',
            valueLabelFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            valueLabelFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '12px',
            valueLabelFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
            tickLabelFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            tickLabelFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '12px',
            tickLabelFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        primaryBarColor: colors.other && colors.other.primary ? colors.other.primary : '#ff4d4f',
        gridLineColor: '#e0e0e0',
        categoryLabelColor: colors.text_color || '#222b44',
        valueLabelColor: colors.text_color || '#b71c1c', // Could be a more specific semantic color if available
        tickLabelColor: colors.text_color || '#888888',
        chartBackground: colors.background_color || '#FFFFFF',
    };

    // Helper: In-memory text measurement (not strictly used for rendering decisions in this version but good practice)
    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        if (fontProps) {
            if (fontProps.font_family) textElement.style.fontFamily = fontProps.font_family;
            if (fontProps.font_size) textElement.style.fontSize = fontProps.font_size;
            if (fontProps.font_weight) textElement.style.fontWeight = fontProps.font_weight;
        }
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM append.
        // For simple cases, this might work, or use a pre-rendered hidden SVG.
        // A more robust way without DOM append is harder. For this refactor, we assume fixed sizes from typography.
        // If dynamic sizing based on content was critical, a temporary DOM append/remove would be more accurate.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM presence
            return text.length * (parseInt(fontProps.font_size, 10) || 12) * 0.6;
        }
    }

    // Helper: Format numeric values
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI prefix
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    // Helper: Generate rounded arc path
    const createRoundedArcPath = (innerRadius, outerRadius, startAngle, endAngle, cornerRadius) => {
        // Angles are expected in radians, 0 at 3 o'clock, positive clockwise.
        // D3 arc generator uses this convention.
        // The original function had a -Math.PI/2 adjustment, implying 0 at 12 o'clock.
        // We'll keep angles as D3 expects them (0 at 3 o'clock) and adjust rotation in SVG transform if needed,
        // or adjust start/end angles before calling this. For radial bars starting at 12 o'clock:
        const sa = startAngle - Math.PI / 2;
        const ea = endAngle - Math.PI / 2;

        const midRadius = (innerRadius + outerRadius) / 2;
        const thickness = outerRadius - innerRadius;
        
        // Cap corner radius
        let cr = Math.min(cornerRadius, thickness / 2);
        // Also cap by arc length at midRadius (approx)
        if (Math.abs(ea - sa) * midRadius < 2 * cr) {
            cr = Math.abs(ea - sa) * midRadius / 2.5; // Adjusted divisor
        }
        if (cr < 0) cr = 0;


        const p = d3.path();
        p.moveTo(innerRadius * Math.cos(sa + cr / innerRadius), innerRadius * Math.sin(sa + cr / innerRadius));
        p.arc(
            innerRadius * Math.cos(sa) + cr * Math.sin(sa), // cx for inner start corner
            innerRadius * Math.sin(sa) - cr * Math.cos(sa), // cy for inner start corner
            cr, // radius of corner
            Math.PI + sa, // start angle of corner arc
            Math.PI / 2 + sa, // end angle of corner arc
            true // counter-clockwise for this corner
        );
        p.lineTo(outerRadius * Math.cos(sa) - cr * Math.sin(sa), outerRadius * Math.sin(sa) + cr * Math.cos(sa));
        p.arc(
            outerRadius * Math.cos(sa) - cr * Math.sin(sa), // cx for outer start corner
            outerRadius * Math.sin(sa) + cr * Math.cos(sa), // cy for outer start corner
            cr, // radius of corner
            Math.PI / 2 + sa, // start angle of corner arc
            sa, // end angle of corner arc
            true // counter-clockwise
        );
        p.arc(0, 0, outerRadius, sa, ea, false); // Outer arc
        p.arc(
            outerRadius * Math.cos(ea) - cr * Math.sin(ea), // cx for outer end corner
            outerRadius * Math.sin(ea) + cr * Math.cos(ea), // cy for outer end corner
            cr, // radius of corner
            ea, // start angle of corner arc
            ea - Math.PI / 2, // end angle of corner arc
            true // counter-clockwise
        );
        p.lineTo(innerRadius * Math.cos(ea) + cr * Math.sin(ea), innerRadius * Math.sin(ea) - cr * Math.cos(ea));
        p.arc(
            innerRadius * Math.cos(ea) + cr * Math.sin(ea), // cx for inner end corner
            innerRadius * Math.sin(ea) - cr * Math.cos(ea), // cy for inner end corner
            cr, // radius of corner
            ea - Math.PI / 2, // start angle of corner arc
            ea - Math.PI, // end angle of corner arc
            true // counter-clockwise
        );
        p.arc(0, 0, innerRadius, ea, sa, true); // Inner arc (reversed)
        p.closePath();
        return p.toString();
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 40, bottom: 40, left: 40 }; // Original margins
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    const maxChartRadius = Math.min(chartWidth, chartHeight) / 2; // Max radius for the chart content itself

    const nBars = chartData.length;
    const minPlotRadius = maxChartRadius * 0.2; // Innermost radius for bars to start
    const maxPlotRadius = maxChartRadius * 0.95; // Outermost radius for bars to end
    
    const totalRadiusForBars = maxPlotRadius - minPlotRadius;
    const barThicknessPercent = 0.7; // 70% of available slot for bar, 30% for gap
    const singleBarSlotWidth = nBars > 0 ? totalRadiusForBars / nBars : 0;
    const barVisualThickness = singleBarSlotWidth * barThicknessPercent;
    const barGap = singleBarSlotWidth * (1 - barThicknessPercent);

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = [...chartData]; // Create a mutable copy
    chartDataArray.sort((a, b) => b[yFieldName] - a[yFieldName]);

    // Block 6: Scale Definition & Configuration
    const yMaxValue = d3.max(chartDataArray, d => d[yFieldName]) || 0;
    const angleScale = d3.scaleLinear()
        .domain([0, yMaxValue > 0 ? yMaxValue : 1]) // Avoid division by zero if yMaxValue is 0
        .range([0, 1.5 * Math.PI]); // 0 to 270 degrees in radians

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines - NO Main Titles/Subtitles)
    const numTicks = 5;
    const tickValues = yMaxValue > 0 ? d3.range(0, yMaxValue + (yMaxValue / numTicks), yMaxValue / numTicks) : [0];
    
    const gridGroup = mainChartGroup.append("g").attr("class", "grid-lines");

    tickValues.forEach(tick => {
        if (tick > yMaxValue && tickValues.length > 1 && yMaxValue > 0) return; // Don't draw tick beyond max unless it's the only one (0)
        const tickAngle = angleScale(tick);
        
        // Radial grid lines (spokes)
        gridGroup.append("line")
            .attr("class", "grid-line radial")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", Math.cos(tickAngle - Math.PI / 2) * (maxPlotRadius + barVisualThickness * 0.5))
            .attr("y2", Math.sin(tickAngle - Math.PI / 2) * (maxPlotRadius + barVisualThickness * 0.5))
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1);

        // Tick labels for these spokes
        gridGroup.append("text")
            .attr("class", "label tick-label")
            .attr("x", Math.cos(tickAngle - Math.PI / 2) * (maxPlotRadius + barVisualThickness * 0.5 + 5)) // 5px padding
            .attr("y", Math.sin(tickAngle - Math.PI / 2) * (maxPlotRadius + barVisualThickness * 0.5 + 5))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.tickLabelColor)
            .style("font-family", fillStyle.typography.tickLabelFontFamily)
            .style("font-size", fillStyle.typography.tickLabelFontSize)
            .style("font-weight", fillStyle.typography.tickLabelFontWeight)
            .text(formatValue(tick));
    });

    // Concentric circle grid lines (optional, original didn't have these explicitly, but helps readability)
    // For this refactor, we stick to original's radial spokes only.

    // Block 8: Main Data Visualization Rendering
    const barsGroup = mainChartGroup.append("g").attr("class", "bars-group");
    const categoryLabelPadding = 10; // Padding for category labels from the start of the bars

    chartDataArray.forEach((d, i) => {
        const innerR = minPlotRadius + i * (barVisualThickness + barGap);
        const outerR = innerR + barVisualThickness;
        const barEndAngle = angleScale(d[yFieldName]);
        const cornerRadius = barVisualThickness / 2; // For fully rounded ends

        // Bar
        barsGroup.append("path")
            .attr("class", "mark bar")
            .attr("d", createRoundedArcPath(innerR, outerR, 0, barEndAngle, cornerRadius))
            .attr("fill", fillStyle.primaryBarColor);

        // Category Label (at the start of the bar, outside, along the 0-angle line)
        // Positioned to the "left" of the radial chart if 0 degrees is at the top.
        // Original had text-anchor: end, x: cos(-PI/2)*radius - padding, y: sin(-PI/2)*radius
        // This places it along the negative Y-axis (12 o'clock position).
        const categoryLabelRadius = innerR + barVisualThickness / 2;
        barsGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", Math.cos(-Math.PI / 2) * categoryLabelRadius - categoryLabelPadding) // Offset to the left
            .attr("y", Math.sin(-Math.PI / 2) * categoryLabelRadius) // Centered on the bar's radial line
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.categoryLabelColor)
            .style("font-family", fillStyle.typography.categoryLabelFontFamily)
            .style("font-size", fillStyle.typography.categoryLabelFontSize)
            .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
            .text(d[xFieldName]);

        // Value Label (along the arc of the bar end)
        const valueText = formatValue(d[yFieldName]);
        const valueLabelRadius = innerR + barVisualThickness / 2; // Center of the bar
        const valueLabelAngle = barEndAngle; // At the end of the bar
        const valueTextPathId = `valueTextPath-${containerSelector.substring(1)}-${i}`; // Unique ID

        // Path for textPath
        // Ensure path is long enough for text, but not excessively so.
        // Estimate text length (simple approximation)
        const estimatedTextPixelLength = valueText.length * parseFloat(fillStyle.typography.valueLabelFontSize) * 0.6;
        let textPathAngleSpan = estimatedTextPixelLength / valueLabelRadius; // radians
        
        // Clamp textPathAngleSpan to avoid excessive curving or inversion
        textPathAngleSpan = Math.min(textPathAngleSpan, Math.PI / 3); // Max 60 degrees span
        textPathAngleSpan = Math.max(textPathAngleSpan, 0.1); // Min ~6 degrees span

        const pathStartAngleRad = Math.max(0, valueLabelAngle - textPathAngleSpan / 2);
        const pathEndAngleRad = Math.min(1.5 * Math.PI, valueLabelAngle + textPathAngleSpan / 2);


        const textArcGenerator = d3.arc()
            .innerRadius(valueLabelRadius)
            .outerRadius(valueLabelRadius)
            .startAngle(pathStartAngleRad - Math.PI / 2) // Adjust for 12 o'clock start
            .endAngle(pathEndAngleRad - Math.PI / 2); // Adjust for 12 o'clock start

        barsGroup.append("path")
            .attr("class", "text-path-helper")
            .attr("id", valueTextPathId)
            .attr("d", textArcGenerator())
            .style("fill", "none")
            .style("stroke", "none"); // Make invisible

        const textPath = barsGroup.append("text")
            .attr("class", "label value-label")
            .style("font-family", fillStyle.typography.valueLabelFontFamily)
            .style("font-size", fillStyle.typography.valueLabelFontSize)
            .style("font-weight", fillStyle.typography.valueLabelFontWeight)
            .attr("fill", fillStyle.valueLabelColor)
            .append("textPath")
            .attr("xlink:href", `#${valueTextPathId}`)
            .attr("startOffset", "50%") // Center text on path
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle") // Vertically center on path
            .text(valueText);
            
        // Adjust dominant-baseline if text is on outside of curve vs inside
        // For text on a path that curves "upwards" relative to text orientation, "hanging" or "alphabetic" might be better.
        // For text on a path that curves "downwards", "middle" or "ideographic" might be better.
        // Given it's centered on the bar's radius, "middle" should be fine.
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No additional enhancements specified beyond core chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}