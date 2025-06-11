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
  "gridLineType": "prominent",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is external)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataTypography = data.typography || {};
    // Prefer data.colors, fallback to data.colors_dark, then to an empty object
    const rawColors = data.colors || data.colors_dark || {}; 
    // const images = data.images || {}; // Not used in this chart type
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const getFieldByRole = (role) => {
        const col = dataColumns.find(c => c.role === role);
        return col ? col.name : undefined;
    };

    const xFieldName = getFieldByRole("x");
    const yFieldName = getFieldByRole("y");
    const groupFieldName = getFieldByRole("group");

    const criticalFields = { xFieldName, yFieldName, groupFieldName };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key.replace("Name"," Field")); // e.g. xFieldName -> x Field

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: [${missingFields.join(", ")}]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }
    
    let valueUnit = "";
    const yFieldCol = dataColumns.find(col => col.name === yFieldName && col.role === "y");
    if (yFieldCol && yFieldCol.unit && yFieldCol.unit !== "none") {
        valueUnit = yFieldCol.unit;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        // groupColors will be populated by d3.scaleOrdinal later
    };

    const defaultTypographyStyles = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.axisTick = {
        font_family: (dataTypography.label && dataTypography.label.font_family) || defaultTypographyStyles.label.font_family,
        font_size: (dataTypography.label && dataTypography.label.font_size) || "12px",
        font_weight: (dataTypography.label && dataTypography.label.font_weight) || defaultTypographyStyles.label.font_weight,
    };
    fillStyle.typography.xCategoryLabel = { // For labels like 'USA', 'China'
        font_family: (dataTypography.title && dataTypography.title.font_family) || defaultTypographyStyles.title.font_family,
        font_size: (dataTypography.title && dataTypography.title.font_size) || "14px", 
        font_weight: (dataTypography.title && dataTypography.title.font_weight) || "bold",
    };
    fillStyle.typography.legendText = {
        font_family: (dataTypography.annotation && dataTypography.annotation.font_family) || defaultTypographyStyles.annotation.font_family,
        font_size: (dataTypography.annotation && dataTypography.annotation.font_size) || "10px",
        font_weight: (dataTypography.annotation && dataTypography.annotation.font_weight) || defaultTypographyStyles.annotation.font_weight,
    };
    
    fillStyle.chartBackground = rawColors.background_color || "#FFFFFF";
    fillStyle.textColor = rawColors.text_color || "#333333";
    fillStyle.gridLineColor = (rawColors.other && rawColors.other.grid_line) || "#E0E0E0";
    // fillStyle.defaultCategoryColor = (rawColors.other && rawColors.other.default_category) || "#CCCCCC"; // For colorScale fallback
    // fillStyle.primaryAccent = (rawColors.other && rawColors.other.primary) || d3.schemeCategory10[0]; // General accent

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI prefixes
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value); // Use ~g for smaller numbers or non-SI fitting
    };

    // estimateTextWidth is not critically used for layout in this chart.
    // function estimateTextWidth(text, fontProps) {
    //     const fontSize = parseFloat(fontProps.font_size || '12px');
    //     const avgCharWidthFactor = 0.6; 
    //     return text.length * fontSize * avgCharWidthFactor;
    // }

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
    const chartMargins = { top: 40, right: Math.max(100, containerWidth * 0.15), bottom: 40, left: Math.max(60, containerWidth * 0.1) }; // Dynamic margins
    
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    
    // Calculate available radius based on the smallest dimension after margins for the chart area itself
    const effectiveChartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const effectiveChartHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const maxRadius = Math.min(effectiveChartWidth, effectiveChartHeight) / 2 * 0.95; // Ensure some padding

    const minRadius = maxRadius * 0.2;
    const maxBarRadius = maxRadius * 0.95; 

    const xCategoryLabelPadding = 15; 

    // Block 5: Data Preprocessing & Transformation
    let chartDataArray = chartDataInput.map(d => ({
        ...d,
        [yFieldName]: (d[yFieldName] === null || d[yFieldName] === undefined || isNaN(parseFloat(d[yFieldName]))) ? 0 : +d[yFieldName]
    }));

    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort((a,b) => String(a).localeCompare(String(b)));
    // const uniqueXValues = [...new Set(chartDataArray.map(d => d[xFieldName]))]; // Not directly used after this

    chartDataArray.sort((a, b) => {
        const xComp = String(a[xFieldName]).localeCompare(String(b[xFieldName]));
        if (xComp !== 0) return xComp;
        return String(a[groupFieldName]).localeCompare(String(b[groupFieldName]));
    });
    
    const nBars = chartDataArray.length;
    const barWidth = nBars > 0 ? (maxBarRadius - minRadius) / nBars * 0.7 : 10;
    const barGap = nBars > 0 ? (maxBarRadius - minRadius) / nBars * 0.3 : 2;

    // Block 6: Scale Definition & Configuration
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((groupValue, i) => {
            if (rawColors.field && rawColors.field[groupFieldName] && rawColors.field[groupFieldName][groupValue]) {
                return rawColors.field[groupFieldName][groupValue];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[i % rawColors.available_colors.length];
            }
            return d3.schemeCategory10[i % 10];
        }));

    const yValues = chartDataArray.map(d => d[yFieldName]);
    const maxValue = yValues.length > 0 ? d3.max(yValues) : 0;
    
    const angleScale = d3.scaleLinear()
        .domain([0, Math.max(1, maxValue)]) 
        .range([0, 1.5 * Math.PI]); // 270 degrees

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-elements")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    const numTicks = 5;
    const tickStep = maxValue > 0 ? maxValue / numTicks : 1 / numTicks;
    const ticksData = maxValue > 0 ? d3.range(0, maxValue + tickStep / 2, tickStep) : d3.range(0, 1 + tickStep / 2, tickStep);


    ticksData.forEach(tick => {
        if (tick > maxValue && maxValue > 0) return; // Don't draw ticks beyond actual max unless max is 0
        mainChartGroup.append("path")
            .attr("class", "grid-line axis") // Added axis class
            .attr("d", d3.arc()
                .innerRadius(minRadius)
                .outerRadius(maxBarRadius + barWidth * 0.5)
                .startAngle(angleScale(tick))
                .endAngle(angleScale(tick))() 
            )
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("fill", "none");

        mainChartGroup.append("text")
            .attr("class", "text axis-label")
            .attr("x", Math.cos(angleScale(tick) - Math.PI / 2) * (maxBarRadius + barWidth * 0.7 + 5)) // Added small offset for label
            .attr("y", Math.sin(angleScale(tick) - Math.PI / 2) * (maxBarRadius + barWidth * 0.7 + 5))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.axisTick.font_family)
            .style("font-size", fillStyle.typography.axisTick.font_size)
            .style("font-weight", fillStyle.typography.axisTick.font_weight)
            .text(formatValue(tick) + valueUnit);
    });

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${containerWidth - chartMargins.right + 20}, ${chartMargins.top})`);

    groups.forEach((group, i) => {
        const legendRow = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${i * 20})`);

        legendRow.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", colorScale(group));

        legendRow.append("text")
            .attr("class", "text legend-label")
            .attr("x", 20)
            .attr("y", 15 / 2) // Center text vertically with rect
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.legendText.font_family)
            .style("font-size", fillStyle.typography.legendText.font_size)
            .style("font-weight", fillStyle.typography.legendText.font_weight)
            .attr("fill", fillStyle.textColor)
            .text(group);
    });

    // Block 8: Main Data Visualization Rendering
    chartDataArray.forEach((d, i) => {
        const innerR = minRadius + i * (barWidth + barGap);
        const outerR = innerR + barWidth;
        const endAngleValue = angleScale(d[yFieldName]);

        if (outerR <= innerR) return; // Skip if bar has no thickness

        mainChartGroup.append("path")
            .datum(d) 
            .attr("class", "mark bar")
            .attr("d", d3.arc()
                .innerRadius(innerR)
                .outerRadius(outerR)
                .startAngle(0)
                .endAngle(endAngleValue)() 
            )
            .attr("fill", colorScale(d[groupFieldName]));

        const isFirstBarWithThisX = chartDataArray.findIndex(item => item[xFieldName] === d[xFieldName]) === i;
        if (isFirstBarWithThisX) {
            // Calculate position for X-Category Labels
            // Angle is -PI/2 (straight up, which becomes left due to radial layout)
            // Radius is mid-point of the first bar in this group
            const labelRadius = innerR + barWidth / 2; 
            const labelX = Math.cos(-Math.PI / 2) * labelRadius - xCategoryLabelPadding;
            const labelY = Math.sin(-Math.PI / 2) * labelRadius;

            mainChartGroup.append("text")
                .attr("class", "text label x-category-label")
                .attr("x", labelX) 
                .attr("y", labelY)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.xCategoryLabel.font_family)
                .style("font-size", fillStyle.typography.xCategoryLabel.font_size)
                .style("font-weight", fillStyle.typography.xCategoryLabel.font_weight)
                .text(d[xFieldName]);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactoring)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}