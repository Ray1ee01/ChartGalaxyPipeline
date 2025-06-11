/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Circular Bar Chart",
  "chart_name": "grouped_circular_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [ [2, 20], [0, "inf"], [2, 5] ],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "secondary", "background", "text"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Assuming light theme, or use a theme detector if data.colors_dark is relevant
    const imagesInput = data.images || {}; // Though not used in this chart, parse for completeness
    const dataColumnsInput = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getField = (role) => dataColumnsInput.find(col => col.role === role);

    const xFieldDef = getField(xFieldRole);
    const yFieldDef = getField(yFieldRole);
    const groupFieldDef = getField(groupFieldRole);

    const criticalFields = {};
    if (xFieldDef) criticalFields.xField = xFieldDef.name;
    if (yFieldDef) criticalFields.yField = yFieldDef.name;
    if (groupFieldDef) criticalFields.groupField = groupFieldDef.name;
    
    const { xField, yField, groupField } = criticalFields;

    if (!xField || !yField || !groupField) {
        const missing = [
            !xField ? `column with role '${xFieldRole}'` : null,
            !yField ? `column with role '${yFieldRole}'` : null,
            !groupField ? `column with role '${groupFieldRole}'` : null
        ].filter(Boolean).join(", ");
        
        const errorMessage = `Critical chart config missing: ${missing}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null;
    }

    let valueUnit = "";
    if (yFieldDef && yFieldDef.unit && yFieldDef.unit !== "none") {
        valueUnit = yFieldDef.unit;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: imagesInput // Store parsed images, though not used by this chart
    };

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    function getTypographyStyle(type, property) {
        return (typographyInput[type] && typographyInput[type][property]) || defaultTypography[type][property];
    }

    fillStyle.typography.axisLabelFontFamily = getTypographyStyle("label", "font_family");
    fillStyle.typography.axisLabelFontSize = getTypographyStyle("label", "font_size");
    fillStyle.typography.axisLabelFontWeight = getTypographyStyle("label", "font_weight");

    fillStyle.typography.categoryLabelFontFamily = getTypographyStyle("label", "font_family"); // Using 'label' for category labels too
    fillStyle.typography.categoryLabelFontSize = getTypographyStyle("label", "font_size");
    fillStyle.typography.categoryLabelFontWeight = "bold"; // Original was bold

    fillStyle.typography.legendLabelFontFamily = getTypographyStyle("annotation", "font_family");
    fillStyle.typography.legendLabelFontSize = getTypographyStyle("annotation", "font_size");
    fillStyle.typography.legendLabelFontWeight = getTypographyStyle("annotation", "font_weight");

    // Color defaults
    const defaultColors = {
        text_color: "#0F223B",
        background_color: "#FFFFFF",
        primary: "#1f77b4",
        secondary: "#ff7f0e",
        gridLine: "#e0e0e0",
        axisLabel: "#888888",
        categoryLabel: "#222b44",
        defaultCategoricalScheme: d3.schemeCategory10
    };

    fillStyle.textColor = colorsInput.text_color || defaultColors.text_color;
    fillStyle.chartBackground = colorsInput.background_color || defaultColors.background_color; // Not used to draw SVG background, but available
    fillStyle.gridLineColor = (colorsInput.other && colorsInput.other.gridLine) || defaultColors.gridLine;
    fillStyle.axisLabelColor = (colorsInput.other && colorsInput.other.axisLabel) || defaultColors.axisLabel;
    fillStyle.categoryLabelColor = (colorsInput.other && colorsInput.other.categoryLabel) || defaultColors.categoryLabel;
    fillStyle.legendLabelColor = fillStyle.textColor; // Default legend text to general text color
    fillStyle.defaultBarOpacity = 0.85; // As per original

    // Helper function to get color for a group
    function getGroupColor(groupName, groupIndex, CfgColors, defaultScheme) {
        if (CfgColors.field && CfgColors.field[groupName]) {
            return CfgColors.field[groupName];
        }
        if (CfgColors.available_colors && CfgColors.available_colors.length > 0) {
            return CfgColors.available_colors[groupIndex % CfgColors.available_colors.length];
        }
        return defaultScheme[groupIndex % defaultScheme.length];
    }
    
    // In-memory text measurement utility
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // Note: The temporary SVG is not appended to the DOM.
        // For getBBox to work, element must be in the DOM or an SVG context that can measure.
        // A more robust way if not in DOM is to append to a hidden part of the main SVG, measure, then remove.
        // However, for simplicity and adherence to "MUST NOT be appended to the document DOM",
        // this might require a canvas-based approach or rely on typical browser behavior for unattached SVGs.
        // For this implementation, we'll assume getBBox on an unattached element provides a reasonable estimate,
        // or acknowledge this limitation. A common practical approach is to briefly attach to DOM, measure, detach.
        // Given the constraints, we'll stick to the non-DOM-attached version.
        // If precise measurement is critical and this fails, a canvas context text measurement is an alternative.
        try {
            return textEl.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might not work on detached elements
            return (text || "").length * (parseFloat(fontSize) || 12) * 0.6; // Rough estimate
        }
    }

    // Value formatting utility
    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg");
        // No viewBox, no responsive width/height attributes

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 40, bottom: 40, left: 40 }; // From original
    // Adjust right margin if legend is wide, or make legend position dynamic. For now, keep original.
    // Consider legend width for right margin:
    // const legendApproxWidth = 150; // As used in original legend transform
    // chartMargins.right = Math.max(chartMargins.right, legendApproxWidth + 10);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    const maxRadius = Math.min(innerWidth, innerHeight) / 2;

    const minRadius = maxRadius * 0.2; // Doughnut hole size
    const maxBarRadius = maxRadius * 0.95; // Outermost extent of bars

    // Block 5: Data Preprocessing & Transformation
    // Ensure chartData is an array
    const chartDataArray = Array.isArray(chartDataInput) ? chartDataInput : [];
    
    // Convert yField to number
    chartDataArray.forEach(d => {
        d[yField] = +d[yField];
    });

    const groups = [...new Set(chartDataArray.map(d => d[groupField]))].sort((a,b) => String(a).localeCompare(String(b))); // Sort groups for consistent color mapping
    
    // Sort data for consistent bar ordering
    chartDataArray.sort((a, b) => {
        if (a[xField] !== b[xField]) {
            return String(a[xField]).localeCompare(String(b[xField]));
        }
        return String(a[groupField]).localeCompare(String(b[groupField]));
    });
    
    const nBars = chartDataArray.length;
    const barRadialSpace = (nBars > 0) ? (maxBarRadius - minRadius) / nBars : 0;
    const barWidth = barRadialSpace * 0.7;
    const barGap = barRadialSpace * 0.3;


    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartDataArray, d => d[yField]) || 0;
    const angleScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, 1.5 * Math.PI]); // 270 degrees, as per original

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => getGroupColor(group, i, colorsInput, defaultColors.defaultCategoricalScheme)));

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    
    // Radial "Axis" Gridlines and Labels
    const numTicks = 5;
    const ticksData = maxValue > 0 ? d3.range(0, maxValue + (maxValue / numTicks / 100), maxValue / numTicks) : [0]; // Add small epsilon to include maxValue

    const radialAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis radial-axis");

    ticksData.forEach(tickValue => {
        radialAxisGroup.append("path")
            .attr("class", "grid-line")
            .attr("d", d3.arc()
                .innerRadius(minRadius)
                .outerRadius(maxBarRadius + barWidth * 0.5) // Extend slightly beyond bars
                .startAngle(angleScale(tickValue))
                .endAngle(angleScale(tickValue))
            )
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("fill", "none");

        radialAxisGroup.append("text")
            .attr("class", "label axis-label")
            .attr("x", Math.cos(angleScale(tickValue) - Math.PI / 2) * (maxBarRadius + barWidth * 0.7 + 5)) // Position labels outside lines
            .attr("y", Math.sin(angleScale(tickValue) - Math.PI / 2) * (maxBarRadius + barWidth * 0.7 + 5))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.axisLabelColor)
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .text(formatValue(Math.round(tickValue)) + valueUnit);
    });

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${containerWidth - chartMargins.right - 130}, ${chartMargins.top})`); // Adjusted legend position slightly

    groups.forEach((group, i) => {
        const legendRow = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${i * 20})`);

        legendRow.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", colorScale(group))
            .attr("opacity", fillStyle.defaultBarOpacity);

        legendRow.append("text")
            .attr("class", "label legend-label")
            .attr("x", 20)
            .attr("y", 12) // Vertically center roughly
            .attr("fill", fillStyle.legendLabelColor)
            .style("font-family", fillStyle.typography.legendLabelFontFamily)
            .style("font-size", fillStyle.typography.legendLabelFontSize)
            .style("font-weight", fillStyle.typography.legendLabelFontWeight)
            .text(group);
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElementsGroup = mainChartGroup.append("g").attr("class", "bars-group");
    const categoryLabelsGroup = mainChartGroup.append("g").attr("class", "category-labels-group");
    const labelPadding = 20; // As per original

    chartDataArray.forEach((d, i) => {
        const innerR = minRadius + i * (barWidth + barGap);
        const outerR = innerR + barWidth;
        const endAngle = angleScale(d[yField]);

        if (outerR > innerR && endAngle > 0) { // Only draw if bar has positive thickness and value
            barElementsGroup.append("path")
                .datum(d)
                .attr("class", "mark bar")
                .attr("d", d3.arc()
                    .innerRadius(innerR)
                    .outerRadius(outerR)
                    .startAngle(0) // Start bars from 0 angle (upwards after rotation)
                    .endAngle(endAngle)
                )
                .attr("fill", colorScale(d[groupField]))
                .attr("opacity", fillStyle.defaultBarOpacity);
        }

        // Add category labels (for xField) - only for the first bar of each xField category
        const isFirstBarWithThisX = chartDataArray.findIndex(item => item[xField] === d[xField]) === i;
        if (isFirstBarWithThisX) {
            categoryLabelsGroup.append("text")
                .attr("class", "label category-label")
                // Position labels to the "start" (left, if 0 angle is up) of the bar group
                .attr("x", Math.cos(-Math.PI / 2) * (innerR + barWidth / 2) - labelPadding) 
                .attr("y", Math.sin(-Math.PI / 2) * (innerR + barWidth / 2))
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.categoryLabelColor)
                .style("font-family", fillStyle.typography.categoryLabelFontFamily)
                .style("font-size", fillStyle.typography.categoryLabelFontSize)
                .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
                .text(d[xField]);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (Not applicable for this chart beyond what's already done)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}