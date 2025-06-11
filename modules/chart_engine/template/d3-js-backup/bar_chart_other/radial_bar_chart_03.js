/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Bar Chart",
  "chart_name": "radial_bar_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary", "background_color", "text_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "minimal",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; 
    const images = data.images || {}; // Parsed, though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");

    if (!xFieldCol || !yFieldCol) {
        console.error("Critical chart config missing: x or y field role not defined in dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Critical chart configuration missing (x or y field role definition).</div>");
        }
        return null;
    }
    const categoryFieldName = xFieldCol.name;
    const valueFieldName = yFieldCol.name;

    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {}
    };

    // Typography defaults from prompt structure
    const defaultStyles = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.categoryLabelFontFamily = (typography.title && typography.title.font_family) || defaultStyles.title.font_family;
    fillStyle.typography.categoryLabelFontSize = (typography.title && typography.title.font_size) || defaultStyles.title.font_size;
    fillStyle.typography.categoryLabelFontWeight = (typography.title && typography.title.font_weight) || defaultStyles.title.font_weight;

    fillStyle.typography.valueLabelFontFamily = (typography.label && typography.label.font_family) || defaultStyles.label.font_family;
    fillStyle.typography.valueLabelFontSize = (typography.label && typography.label.font_size) || defaultStyles.label.font_size;
    fillStyle.typography.valueLabelFontWeight = (typography.label && typography.label.font_weight) || defaultStyles.label.font_weight;

    fillStyle.typography.tickLabelFontFamily = (typography.label && typography.label.font_family) || defaultStyles.label.font_family;
    fillStyle.typography.tickLabelFontSize = (typography.label && typography.label.font_size) || defaultStyles.label.font_size;
    fillStyle.typography.tickLabelFontWeight = (typography.label && typography.label.font_weight) || defaultStyles.label.font_weight;

    // Color defaults
    fillStyle.barPrimaryColor = (colors.other && colors.other.primary) || "#1f77b4"; // Default primary
    fillStyle.gridLineColor = (colors.other && colors.other.secondary) || "#d3d3d3"; // Default secondary (light gray)
    fillStyle.chartBackground = colors.background_color || "#FFFFFF";
    fillStyle.categoryLabelColor = colors.text_color || "#0f223b"; // Default text color
    fillStyle.valueLabelColor = (colors.other && colors.other.accent) || colors.text_color || "#0f223b";
    fillStyle.tickLabelColor = colors.text_color || "#555555"; // Slightly lighter for ticks

    const estimateTextWidth = (text, fontSize, fontFamily, fontWeight) => {
        if (!text) return 0;
        const svgNamespace = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNamespace, 'svg');
        // No need to style or append tempSvg for getBBox on text element itself
        const textEl = document.createElementNS(svgNamespace, 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        tempSvg.appendChild(textEl); // Append to temporary SVG, not document body
        let width = 0;
        try {
             width = textEl.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail (e.g., very specific JSDOM setups)
            const avgCharWidthMultiplier = 0.6; // General heuristic
            width = text.length * (parseFloat(fontSize) * avgCharWidthMultiplier);
        }
        return width;
    };
    
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
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const chartId = `chart-${(containerSelector || "sel").replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).substr(2, 9)}`;

    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: variables.margin_top || 40, right: variables.margin_right || 40, bottom: variables.margin_bottom || 40, left: variables.margin_left || 40 };
    const chartDrawableWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartDrawableHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const maxRadius = Math.min(chartDrawableWidth, chartDrawableHeight) / 2;
    
    const nBars = chartDataInput.length;
    if (nBars === 0) {
        svgRoot.append("text")
            .attr("class", "text label no-data-label")
            .attr("x", centerX)
            .attr("y", centerY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.categoryLabelFontFamily)
            .style("font-size", fillStyle.typography.categoryLabelFontSize)
            .attr("fill", fillStyle.categoryLabelColor)
            .text("No data available.");
        return svgRoot.node();
    }

    const minRadiusFactor = variables.min_radius_factor || 0.2;
    const maxBarRadiusFactor = variables.max_bar_radius_factor || 0.95;
    const barGroupPortion = variables.bar_group_portion || 0.7;

    const minRadius = maxRadius * minRadiusFactor;
    const maxBarRadiusOuterEdge = maxRadius * maxBarRadiusFactor;
    
    const totalRadiusForBarsAndGaps = maxBarRadiusOuterEdge - minRadius;
    const singleBarSlotWidth = totalRadiusForBarsAndGaps / Math.max(1, nBars);
    const barWidth = singleBarSlotWidth * barGroupPortion;
    const barGap = singleBarSlotWidth * (1 - barGroupPortion);
    
    const categoryLabelPadding = variables.category_label_padding || 20;

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = [...chartDataInput];
    chartDataArray.sort((a, b) => (b[valueFieldName] || 0) - (a[valueFieldName] || 0));

    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartDataArray, d => d[valueFieldName]) || 0;
    const angleScale = d3.scaleLinear()
        .domain([0, Math.max(maxValue, (maxValue === 0 ? 1 : 0) )]) // Ensure domain is not [0,0]
        .range([0, (variables.max_angle_degrees || 270) * (Math.PI / 180)]); // Default 270 degrees

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    const numTicks = variables.num_ticks || 5;
    const tickValues = angleScale.ticks(numTicks);
    // Ensure maxValue is a tick if not already close to one
    if (maxValue > 0 && !tickValues.some(t => Math.abs(t - maxValue) < 0.01 * maxValue)) {
        if (tickValues.length > 0 && maxValue > tickValues[tickValues.length -1]) {
             tickValues.push(maxValue);
        } else { // if maxValue is smaller than last tick or list is empty
            let newTicks = angleScale.copy().domain([0, maxValue]).ticks(numTicks);
            if (newTicks.length > 0 && newTicks[newTicks.length-1] < maxValue * 0.95 && newTicks[newTicks.length-1] !== maxValue) newTicks.push(maxValue);
            if(newTicks.length === 0 && maxValue > 0) newTicks.push(0, maxValue);
            if(newTicks.length === 0 && maxValue === 0) newTicks.push(0);
        }
    }


    const gridLinesGroup = mainChartGroup.append("g").attr("class", "axis grid-lines");
    
    tickValues.forEach(tickValue => {
        const tickAngle = angleScale(tickValue);
        gridLinesGroup.append("path")
            .attr("class", "grid-line")
            .attr("d", d3.arc()
                .innerRadius(minRadius)
                .outerRadius(maxBarRadiusOuterEdge + barWidth * 0.1) // Extend slightly
                .startAngle(tickAngle)
                .endAngle(tickAngle)
            )
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("fill", "none");

        gridLinesGroup.append("text")
            .attr("class", "text axis-label tick-label")
            .attr("x", Math.cos(tickAngle - Math.PI / 2) * (maxBarRadiusOuterEdge + barWidth * 0.2 + 5)) // Position beyond lines
            .attr("y", Math.sin(tickAngle - Math.PI / 2) * (maxBarRadiusOuterEdge + barWidth * 0.2 + 5))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.tickLabelColor)
            .style("font-family", fillStyle.typography.tickLabelFontFamily)
            .style("font-size", fillStyle.typography.tickLabelFontSize)
            .style("font-weight", fillStyle.typography.tickLabelFontWeight)
            .text(formatValue(tickValue));
    });

    // Block 8: Main Data Visualization Rendering
    const barsGroup = mainChartGroup.append("g").attr("class", "marks-group bars");

    chartDataArray.forEach((d, i) => {
        const currentInnerRadius = minRadius + i * singleBarSlotWidth;
        const currentOuterRadius = currentInnerRadius + barWidth;
        const barEndAngle = angleScale(d[valueFieldName] || 0);

        barsGroup.append("path")
            .attr("class", "mark bar")
            .attr("d", d3.arc()
                .innerRadius(currentInnerRadius)
                .outerRadius(currentOuterRadius)
                .startAngle(0) 
                .endAngle(barEndAngle)
                // .padAngle(0.005) // Optional: small padding between bars if they were segments of a pie
                .cornerRadius(0) // As per V.2, no complex effects
            )
            .attr("fill", fillStyle.barPrimaryColor);

        mainChartGroup.append("text")
            .attr("class", "text label category-label")
            .attr("x", -categoryLabelPadding) 
            .attr("y", -(currentInnerRadius + barWidth / 2)) 
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.categoryLabelColor)
            .style("font-family", fillStyle.typography.categoryLabelFontFamily)
            .style("font-size", fillStyle.typography.categoryLabelFontSize)
            .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
            .text(d[categoryFieldName]);

        const valueText = formatValue(d[valueFieldName]);
        if (valueText && (d[valueFieldName] || 0) !== 0) {
            const valueLabelRadius = currentInnerRadius + barWidth / 2;
            
            const valueTextEstimatedWidth = estimateTextWidth(
                valueText, 
                fillStyle.typography.valueLabelFontSize, 
                fillStyle.typography.valueLabelFontFamily, 
                fillStyle.typography.valueLabelFontWeight
            );

            let textAngularWidth = valueTextEstimatedWidth / Math.max(1, valueLabelRadius); // Avoid div by zero
            const minTextAngularDisplay = 0.05; // Min radians for text path

            const pathStartAngle = Math.max(0, barEndAngle - textAngularWidth / 2);
            const pathEndAngle = Math.min(angleScale.range()[1], barEndAngle + textAngularWidth / 2);
            const effectivePathEndAngle = Math.max(pathStartAngle + minTextAngularDisplay, pathEndAngle);

            if (pathStartAngle < effectivePathEndAngle) { // Only draw if path has positive length
                const valueTextPathId = `valueTextPath-${chartId}-${i}`;

                mainChartGroup.append("defs")
                    .append("path")
                    .attr("id", valueTextPathId)
                    .attr("d", d3.arc()({
                        innerRadius: valueLabelRadius,
                        outerRadius: valueLabelRadius,
                        startAngle: pathStartAngle,
                        endAngle: effectivePathEndAngle
                    }));

                mainChartGroup.append("text")
                    .attr("class", "text label value-label")
                    .style("font-family", fillStyle.typography.valueLabelFontFamily)
                    .style("font-size", fillStyle.typography.valueLabelFontSize)
                    .style("font-weight", fillStyle.typography.valueLabelFontWeight)
                    .attr("fill", fillStyle.valueLabelColor)
                    .append("textPath")
                    .attr("xlink:href", `#${valueTextPathId}`)
                    .attr("startOffset", "50%")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle") 
                    .text(valueText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}