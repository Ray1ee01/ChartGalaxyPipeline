/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Bar Chart",
  "chart_name": "radial_bar_chart_04",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary", "text_color", "background_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "yes",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "ascending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    // Prioritize colors_dark if available, then colors, then empty object
    const parsedColors = data.colors_dark || data.colors || {};
    const images = data.images || {}; // Though not used in this chart
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";

    const xFieldConfig = dataColumns.find(col => col.role === xFieldRole);
    const yFieldConfig = dataColumns.find(col => col.role === yFieldRole);

    if (!xFieldConfig || !xFieldConfig.name) {
        console.error("Critical chart config missing: X-axis field name (role='x'). Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: X-axis field configuration is missing.</div>");
        return null;
    }
    if (!yFieldConfig || !yFieldConfig.name) {
        console.error("Critical chart config missing: Y-axis field name (role='y'). Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Y-axis field configuration is missing.</div>");
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    // Typography
    fillStyle.typography.categoryLabelFontFamily = typography.title?.font_family || 'Arial, sans-serif';
    fillStyle.typography.categoryLabelFontSize = typography.title?.font_size || '16px';
    fillStyle.typography.categoryLabelFontWeight = typography.title?.font_weight || 'bold';

    fillStyle.typography.valueLabelFontFamily = typography.label?.font_family || 'Arial, sans-serif';
    fillStyle.typography.valueLabelFontSize = typography.label?.font_size || '12px';
    fillStyle.typography.valueLabelFontWeight = typography.label?.font_weight || 'normal';

    fillStyle.typography.axisTickLabelFontFamily = typography.label?.font_family || 'Arial, sans-serif';
    fillStyle.typography.axisTickLabelFontSize = typography.label?.font_size || '12px';
    fillStyle.typography.axisTickLabelFontWeight = typography.label?.font_weight || 'normal';

    // Colors
    fillStyle.barPrimary = parsedColors.other?.primary || '#ff4d4f';
    fillStyle.axisTickLine = parsedColors.other?.secondary || '#e0e0e0';
    fillStyle.chartBackground = parsedColors.background_color || '#FFFFFF'; // Default to white
    
    // Text colors (use general text_color from parsedColors, with specific fallbacks from original chart)
    const defaultTextColor = '#0f223b'; // A general default if parsedColors.text_color is missing
    fillStyle.axisTickText = parsedColors.text_color || '#888888';
    fillStyle.categoryLabelText = parsedColors.text_color || '#222b44';
    fillStyle.valueLabelText = parsedColors.text_color || '#b71c1c';


    // Helper: In-memory text measurement (not used by this chart's rendering logic but required by prompt)
    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-weight', fontWeight);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-family', fontFamily);
        textEl.textContent = text;
        tempSvg.appendChild(textEl);
        // Note: getBBox on non-DOM-appended SVG elements can be unreliable in some older environments.
        // Sticking to prompt's "MUST NOT be appended to the document DOM".
        let width = 0;
        try {
            width = textEl.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth: getBBox failed. Using fallback.", e);
            const avgCharWidth = parseFloat(fontSize) * 0.6; // Crude fallback
            width = text.length * avgCharWidth;
        }
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 40, bottom: 40, left: 40 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    const maxRadius = Math.min(innerWidth, innerHeight) / 2;

    const minRadius = maxRadius * 0.2; // Inner hole radius
    const maxBarRadius = maxRadius * 0.95; // Outer limit for bars

    const CATEGORY_LABEL_PADDING = 20; // Padding for category labels from center y-axis

    // Block 5: Data Preprocessing & Transformation
    let chartDataArray = JSON.parse(JSON.stringify(chartDataInput)); // Deep copy for manipulation

    // Sort data by yFieldName in ascending order
    chartDataArray.sort((a, b) => a[yFieldName] - b[yFieldName]);

    const nBars = chartDataArray.length;
    if (nBars === 0) {
        // No data to render, could display a message
        svgRoot.append("text")
            .attr("x", centerX)
            .attr("y", centerY)
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.categoryLabelText) // Use a text color
            .style("font-size", fillStyle.typography.categoryLabelFontSize)
            .style("font-family", fillStyle.typography.categoryLabelFontFamily)
            .text("No data available.");
        return svgRoot.node();
    }
    
    const barAvailableRadialThickness = maxBarRadius - minRadius;
    const barSectionThickness = barAvailableRadialThickness / nBars;
    const barWidth = barSectionThickness * 0.7;
    const barGap = barSectionThickness * 0.3;


    // Block 6: Scale Definition & Configuration
    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const angleScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 1]) // Ensure domain max is at least 1 to avoid issues with 0 max
        .range([0, 0.66 * Math.PI]); // Max 120 degrees arc

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-elements")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    const numTicks = 5;
    const tickValues = d3.range(0, (yMax > 0 ? yMax : 1) + 1, (yMax > 0 ? yMax : 1) / numTicks);

    tickValues.forEach(tick => {
        const tickAngle = angleScale(tick);
        // Tick lines (radial)
        mainChartGroup.append("path")
            .attr("class", "axis gridline")
            .attr("d", d3.arc()
                .innerRadius(minRadius)
                .outerRadius(maxBarRadius + barWidth * 0.1) // Extend slightly beyond bars
                .startAngle(tickAngle)
                .endAngle(tickAngle)
            )
            .attr("stroke", fillStyle.axisTickLine)
            .attr("stroke-width", 1)
            .attr("fill", "none");

        // Tick labels
        mainChartGroup.append("text")
            .attr("class", "label axis-label")
            .attr("x", Math.cos(tickAngle - Math.PI / 2) * (maxBarRadius + barWidth * 0.2 + 5)) // Position beyond lines
            .attr("y", Math.sin(tickAngle - Math.PI / 2) * (maxBarRadius + barWidth * 0.2 + 5))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.axisTickText)
            .style("font-family", fillStyle.typography.axisTickLabelFontFamily)
            .style("font-size", fillStyle.typography.axisTickLabelFontSize)
            .style("font-weight", fillStyle.typography.axisTickLabelFontWeight)
            .text(Math.round(tick));
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    chartDataArray.forEach((d, i) => {
        const innerR = minRadius + i * (barWidth + barGap);
        const outerR = innerR + barWidth;
        const barEndAngle = angleScale(d[yFieldName]);

        // Radial bars
        mainChartGroup.append("path")
            .attr("class", "mark bar")
            .attr("d", d3.arc()
                .innerRadius(innerR)
                .outerRadius(outerR)
                .startAngle(0) // Start angle at 0 (3 o'clock)
                .endAngle(barEndAngle)
                .padAngle(0.01) // Small padding between segments if they were part of a pie
                .cornerRadius(0) // No rounded corners
            )
            .attr("fill", fillStyle.barPrimary);
            // Removed opacity based on V.2

        // Category labels (at the start of the radial segments, along the y-axis)
        mainChartGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", -CATEGORY_LABEL_PADDING) // Positioned to the left of center
            .attr("y", -(innerR + barWidth / 2)) // Vertically aligned with the bar's radial center
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.categoryLabelText)
            .style("font-family", fillStyle.typography.categoryLabelFontFamily)
            .style("font-size", fillStyle.typography.categoryLabelFontSize)
            .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
            .text(d[xFieldName]);

        // Value labels (at the end of each bar)
        const valueText = d[yFieldName];
        const valueLabelRadius = innerR + barWidth / 2; // Mid-radius of the bar
        // Original angle calculation included a small offset: barEndAngle - Math.PI / 2 + Math.PI / 40
        // Preserving this offset as it might be for fine-tuning label placement.
        const valueLabelAngle = barEndAngle - Math.PI / 2 + (Math.PI / 40); 

        mainChartGroup.append("text")
            .attr("class", "value label")
            .attr("x", Math.cos(valueLabelAngle) * valueLabelRadius)
            .attr("y", Math.sin(valueLabelAngle) * valueLabelRadius)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.valueLabelText)
            .style("font-family", fillStyle.typography.valueLabelFontFamily)
            .style("font-size", fillStyle.typography.valueLabelFontSize)
            .style("font-weight", fillStyle.typography.valueLabelFontWeight)
            .text(valueText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}