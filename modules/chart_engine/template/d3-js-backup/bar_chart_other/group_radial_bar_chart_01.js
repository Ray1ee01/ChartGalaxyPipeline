/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Circular Bar Chart",
  "chart_name": "grouped_circular_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is now external to the function)

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {};
    const imagesConfig = data.images || {}; // Extracted per spec, though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const yFieldName = yFieldConfig ? yFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    let missingFields = [];
    if (!xFieldName) missingFields.push("x field (role 'x') name");
    if (!yFieldName) missingFields.push("y field (role 'y') name");
    if (!groupFieldName) missingFields.push("group field (role 'group') name");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    const chartDataArray = rawChartData.filter(d => 
        d[xFieldName] !== undefined && d[xFieldName] !== null &&
        d[yFieldName] !== undefined && d[yFieldName] !== null && typeof d[yFieldName] === 'number' && !isNaN(d[yFieldName]) &&
        d[groupFieldName] !== undefined && d[groupFieldName] !== null
    );
    
    if (chartDataArray.length === 0) {
        const errorMsg = rawChartData.length > 0 ? 
            `No valid data points found after filtering for required fields (x: ${xFieldName}, y: ${yFieldName}, group: ${groupFieldName}) and numeric y-values. Cannot render.` :
            `No data provided. Cannot render.`;
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    let valueUnit = "";
    if (yFieldConfig && yFieldConfig.unit && yFieldConfig.unit !== "none") {
        valueUnit = yFieldConfig.unit;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: {} // For consistency per spec
    };

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = (typographyConfig.title && typographyConfig.title.font_family) || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = (typographyConfig.title && typographyConfig.title.font_size) || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = (typographyConfig.title && typographyConfig.title.font_weight) || defaultTypography.title.font_weight;

    fillStyle.typography.labelFontFamily = (typographyConfig.label && typographyConfig.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (typographyConfig.label && typographyConfig.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (typographyConfig.label && typographyConfig.label.font_weight) || defaultTypography.label.font_weight;
    
    // For category labels that were bold in the original
    fillStyle.typography.categoryLabelFontWeight = (typographyConfig.label && typographyConfig.label.font_weight_bold) || "bold";


    fillStyle.typography.annotationFontFamily = (typographyConfig.annotation && typographyConfig.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (typographyConfig.annotation && typographyConfig.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (typographyConfig.annotation && typographyConfig.annotation.font_weight) || defaultTypography.annotation.font_weight;

    const defaultColors = {
        primary: "#1f77b4",
        background_color: "#FFFFFF",
        text_color: "#0f223b",
        grid_line_color: "#e0e0e0",
        axis_tick_label_color: "#888888",
        category_label_color: "#222b44",
        available_colors: d3.schemeCategory10
    };
    
    fillStyle.chartBackground = colorsConfig.background_color || defaultColors.background_color;
    fillStyle.textColor = colorsConfig.text_color || defaultColors.text_color;
    fillStyle.primaryColor = (colorsConfig.other && colorsConfig.other.primary) || defaultColors.primary;
    
    fillStyle.gridLineColor = (colorsConfig.other && colorsConfig.other.grid_line) || defaultColors.grid_line_color;
    fillStyle.axisTickLabelColor = (colorsConfig.other && colorsConfig.other.axis_label) || defaultColors.axis_tick_label_color;
    fillStyle.categoryLabelColor = (colorsConfig.other && colorsConfig.other.category_label) || defaultColors.category_label_color;

    const fieldColorsMap = colorsConfig.field || {};
    const availableColorsArray = colorsConfig.available_colors || defaultColors.available_colors;
    
    function estimateTextWidth(text, fontProps) {
        // This function provides a rough estimate. For accurate measurement, DOM attachment (briefly)
        // or a canvas-based approach is typically needed, but DOM attachment is forbidden by requirements.
        // getBBox on unattached elements is unreliable.
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.style.fontFamily = fontProps.font_family || defaultTypography.label.font_family;
        textElement.style.fontSize = fontProps.font_size || defaultTypography.label.font_size;
        textElement.style.fontWeight = fontProps.font_weight || defaultTypography.label.font_weight;
        textElement.textContent = text || "";
        svg.appendChild(textElement); // Must be in an SVG parent for getBBox
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-rendered SVGs
            width = (text ? text.length : 0) * (parseInt(fontProps.font_size || defaultTypography.label.font_size, 10) * 0.6);
        }
        return width;
    }
    
    const formatValue = (value) => {
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
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root other"); // Added 'other' as a general class for the root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 40, bottom: 40, left: 40 };
    // Adjust left margin if category labels might be long, or make it dynamic. For now, fixed.
    // The category labels are placed relative to the center, so chartMargins.left mostly affects legend placement if it were on the left.
    
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    const maxRadius = Math.min(chartWidth, chartHeight) / 2;

    const nBars = chartDataArray.length;
    const minRadius = maxRadius * 0.2; 
    const maxBarRadius = maxRadius * 0.95; 
    
    const totalBarSpace = maxBarRadius - minRadius;
    let barWidth = nBars > 0 ? (totalBarSpace / nBars) * 0.7 : 0;
    let barGap = nBars > 0 ? (totalBarSpace / nBars) * 0.3 : 0;
    
    const categoryLabelPadding = 20; 
    const legendItemHeight = 20;
    const legendMarkSize = 15;
    const legendTextOffsetX = 20;
    const legendDefaultWidth = variables.legend_width || 150; // Approximate width for positioning
    const legendXPosition = containerWidth - legendDefaultWidth - chartMargins.right;
    const legendYPosition = chartMargins.top;


    // Block 5: Data Preprocessing & Transformation
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort((a,b) => String(a).localeCompare(String(b)));

    chartDataArray.sort((a, b) => {
        const xCompare = String(a[xFieldName]).localeCompare(String(b[xFieldName]));
        if (xCompare !== 0) return xCompare;
        return String(a[groupFieldName]).localeCompare(String(b[groupFieldName]));
    });

    // Block 6: Scale Definition & Configuration
    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const maxValueForScale = (yMax === undefined || yMax === 0) ? 1 : yMax; // Ensure domain is not [0,0]

    const angleScale = d3.scaleLinear()
        .domain([0, maxValueForScale])
        .range([0, 1.5 * Math.PI]); // 270 degrees

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => fieldColorsMap[group] || availableColorsArray[i % availableColorsArray.length]));

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group other");

    const numTicks = 5;
    const tickValues = d3.ticks(0, maxValueForScale, numTicks);

    tickValues.forEach(tick => {
        mainChartGroup.append("path")
            .attr("class", "axis grid-line")
            .attr("d", d3.arc()
                .innerRadius(minRadius)
                .outerRadius(maxBarRadius + barWidth * 0.1)
                .startAngle(angleScale(tick))
                .endAngle(angleScale(tick))()
            )
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("fill", "none");

        mainChartGroup.append("text")
            .attr("class", "label tick-label")
            .attr("x", Math.cos(angleScale(tick) - Math.PI / 2) * (maxBarRadius + barWidth * 0.2 + 5))
            .attr("y", Math.sin(angleScale(tick) - Math.PI / 2) * (maxBarRadius + barWidth * 0.2 + 5))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.axisTickLabelColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(formatValue(tick) + valueUnit);
    });
    
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendXPosition}, ${legendYPosition})`);

    groups.forEach((group, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item other") // 'other' for group
            .attr("transform", `translate(0, ${i * legendItemHeight})`);

        legendItem.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendMarkSize)
            .attr("height", legendMarkSize)
            .attr("fill", colorScale(group));

        legendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendTextOffsetX)
            .attr("y", legendMarkSize / 2) // Align text with middle of rect
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(group);
    });

    // Block 8: Main Data Visualization Rendering
    chartDataArray.forEach((d, i) => {
        const innerR = minRadius + i * (barWidth + barGap);
        const outerR = innerR + barWidth;
        const currentEndAngle = angleScale(d[yFieldName]);

        mainChartGroup.append("path")
            .datum(d) // Attach data for potential interactions later
            .attr("class", "mark bar")
            .attr("d", d3.arc()
                .innerRadius(innerR)
                .outerRadius(outerR)
                .startAngle(0)
                .endAngle(currentEndAngle)()
            )
            .attr("fill", colorScale(d[groupFieldName]));

        const isFirstBarForThisXCategory = chartDataArray.findIndex(item => item[xFieldName] === d[xFieldName]) === i;
        if (isFirstBarForThisXCategory) {
            const labelRadius = innerR + barWidth / 2;
            mainChartGroup.append("text")
                .attr("class", "label category-label")
                .attr("transform", `translate(${Math.cos(-Math.PI / 2) * labelRadius - categoryLabelPadding}, ${Math.sin(-Math.PI / 2) * labelRadius})`)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.categoryLabelColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
                .text(d[xFieldName]);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., tooltips, hover effects - not implemented as per simplification rules)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}