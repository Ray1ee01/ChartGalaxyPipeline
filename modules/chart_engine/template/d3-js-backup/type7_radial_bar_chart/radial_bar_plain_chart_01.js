/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Bar Chart",
  "chart_name": "radial_bar_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "background_color", "text_color"],
  "min_height": 400,
  "min_width": 400,
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
    // (The /* REQUIREMENTS_BEGIN... */ block is now external to the function)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // For light themes
    // const colorsDark = data.colors_dark || {}; // Example for dark themes, not used here explicitly
    const images = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");

    let configErrors = [];
    if (!xFieldCol) {
        configErrors.push("x field role");
    }
    if (!yFieldCol) {
        configErrors.push("y field role");
    }
     if (!variables.width || !variables.height) {
        configErrors.push("variables.width and variables.height");
    }


    if (configErrors.length > 0) {
        const errorMsg = `Critical chart config missing: ${configErrors.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = xFieldCol.name;
    const valueFieldName = yFieldCol.name;

    if (chartDataInput.length > 0 && !chartDataInput.every(d => categoryFieldName in d && valueFieldName in d)) {
        const errorMsg = `Critical chart data missing: field names '${categoryFieldName}' or '${valueFieldName}' (derived from roles) not found in all data objects. Cannot render.`;
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }
    
    const chartDataArray = JSON.parse(JSON.stringify(chartDataInput));


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryBarColor: (colors.other && colors.other.primary) ? colors.other.primary : '#ff4d4f',
        gridLineColor: (colors.other && colors.other.secondary) ? colors.other.secondary : '#e0e0e0',
        axisTickTextColor: colors.text_color || '#888888',
        categoryLabelTextColor: colors.text_color || '#222b44',
        valueLabelTextColor: colors.text_color || '#b71c1c', // Or a color that contrasts well with primaryBarColor
        chartBackground: colors.background_color || 'transparent', // SVG background
        barOpacity: 0.85, // Fixed opacity for bars
    };

    fillStyle.typography = {
        axisTickText: {
            fontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            fontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            fontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
        },
        categoryLabelText: {
            fontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            fontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            fontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
        },
        valueLabelText: {
            fontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            fontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            fontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
        }
    };

    function estimateTextWidth(text, fontSize, fontFamily, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No need to append to DOM for getBBox
        const width = tempText.getBBox().width;
        return width;
    }

    const formatValue = (value) => {
        if (value == null || isNaN(value)) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value / 1000) + "K";
        } else {
             // Show up to 2 decimal places for small numbers, otherwise default
            return Math.abs(value) < 1 && value !== 0 ? d3.format(".2~f")(value) : d3.format("~g")(value);
        }
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width;
    const containerHeight = variables.height;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink") // For href in textPath, though 'href' is preferred
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    const chartMargins = { top: 40, right: 40, bottom: 40, left: 40 }; // Standard margins

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`)
        .attr("class", "main-chart-group");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartDrawableWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartDrawableHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const maxRadius = Math.min(chartDrawableWidth, chartDrawableHeight) / 2;
    const minRadius = maxRadius * 0.2; // Inner hole radius
    const maxBarRadius = maxRadius * 0.95; // Outermost point for bars

    const nBars = chartDataArray.length;
    if (nBars === 0) { // Handle empty data after setup
        mainChartGroup.append("text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.categoryLabelText.fontFamily)
            .style("font-size", fillStyle.typography.categoryLabelText.fontSize)
            .attr("fill", fillStyle.categoryLabelTextColor)
            .text("No data to display.");
        return svgRoot.node();
    }

    const totalBarSpace = maxBarRadius - minRadius;
    const barWidth = nBars > 0 ? (totalBarSpace / nBars) * 0.7 : 0;
    const barGap = nBars > 0 ? (totalBarSpace / nBars) * 0.3 : 0;


    // Block 5: Data Preprocessing & Transformation
    chartDataArray.sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartDataArray, d => d[valueFieldName]);
    const angleScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue : 1]) // Avoid domain [0,0]
        .range([0, 1.5 * Math.PI]); // 0 to 270 degrees, clockwise

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const numTicks = 5;
    const ticksData = maxValue > 0 ? d3.range(0, maxValue + (maxValue/numTicks)/2 , maxValue / numTicks) : [0];
    
    const gridGroup = mainChartGroup.append("g").attr("class", "axis grid-lines");

    ticksData.forEach(tickValue => {
        if (angleScale(tickValue) > angleScale.range()[1] + 1e-6) return; // Don't draw ticks beyond max angle

        gridGroup.append("path")
            .attr("class", "grid-line")
            .attr("d", d3.arc()
                .innerRadius(minRadius)
                .outerRadius(maxBarRadius + barWidth * 0.1) // Extend slightly beyond bars
                .startAngle(angleScale(tickValue))
                .endAngle(angleScale(tickValue))
            )
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("fill", "none");

        const tickRadius = maxBarRadius + barWidth * 0.1 + 5; // Position for tick labels
        const tickAngle = angleScale(tickValue);
        
        // Rotate tick angle by -PI/2 to align text baseline horizontally
        const labelX = Math.cos(tickAngle - Math.PI / 2) * tickRadius;
        const labelY = Math.sin(tickAngle - Math.PI / 2) * tickRadius;

        gridGroup.append("text")
            .attr("class", "label axis-tick-label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.axisTickTextColor)
            .style("font-family", fillStyle.typography.axisTickText.fontFamily)
            .style("font-size", fillStyle.typography.axisTickText.fontSize)
            .style("font-weight", fillStyle.typography.axisTickText.fontWeight)
            .text(formatValue(tickValue));
    });

    // Block 8: Main Data Visualization Rendering
    const barsGroup = mainChartGroup.append("g").attr("class", "marks bar-marks");
    const categoryLabelsGroup = mainChartGroup.append("g").attr("class", "labels category-labels");
    const valueLabelsGroup = mainChartGroup.append("g").attr("class", "labels value-labels");

    const categoryLabelPadding = 20; // Distance for category labels from center line

    chartDataArray.forEach((d, i) => {
        const innerR = minRadius + i * (barWidth + barGap);
        const outerR = innerR + barWidth;
        const barEndAngle = angleScale(d[valueFieldName]);

        barsGroup.append("path")
            .attr("class", "mark bar-segment")
            .attr("d", d3.arc()
                .innerRadius(innerR)
                .outerRadius(outerR)
                .startAngle(0) // Start bars from 0 angle (3 o'clock)
                .endAngle(barEndAngle)
                .padAngle(0.01) // Small padding between segments if needed, not typical for this type
                .cornerRadius(variables.barCornerRadius || 0) // Optional: from variables
            )
            .attr("fill", fillStyle.primaryBarColor)
            .attr("opacity", fillStyle.barOpacity);

        // Category Labels (Positioned at 12 o'clock, extending left)
        categoryLabelsGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", -categoryLabelPadding) // Offset to the left of center
            .attr("y", -(innerR + barWidth / 2)) // Position along the y-axis (upwards)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.categoryLabelTextColor)
            .style("font-family", fillStyle.typography.categoryLabelText.fontFamily)
            .style("font-size", fillStyle.typography.categoryLabelText.fontSize)
            .style("font-weight", fillStyle.typography.categoryLabelText.fontWeight)
            .text(d[categoryFieldName]);

        // Value Labels (Along the arc of the bar end)
        const valueText = formatValue(d[valueFieldName]);
        if (valueText) {
            const valueLabelRadius = innerR + barWidth / 2; // Mid-radius of the bar
            const valueTextPathId = `valueTextPath-${containerSelector.replace(/[^a-zA-Z0-9]/g, '')}-${i}`;

            const textPixelWidth = estimateTextWidth(
                valueText, 
                fillStyle.typography.valueLabelText.fontSize, 
                fillStyle.typography.valueLabelText.fontFamily, 
                fillStyle.typography.valueLabelText.fontWeight
            );
            
            // Calculate angular width needed for the text
            // Add a small buffer to angular width
            const textAngularHalfWidth = (textPixelWidth / valueLabelRadius / 2) * 1.1 || 0.05;


            let pathStartAngle = barEndAngle - textAngularHalfWidth;
            let pathEndAngle = barEndAngle + textAngularHalfWidth;

            // Ensure path doesn't go below 0 or exceed max angle significantly
            pathStartAngle = Math.max(0, pathStartAngle);
            pathEndAngle = Math.min(angleScale.range()[1] + textAngularHalfWidth, pathEndAngle); // Allow slight overshoot for text centering
            if (pathStartAngle >= pathEndAngle) { // If text is too long for the arc segment
                 pathEndAngle = pathStartAngle + 0.1; // Minimal arc
            }


            valueLabelsGroup.append("path")
                .attr("id", valueTextPathId)
                .attr("d", d3.arc()({ // Note: d3.arc() returns a path generator
                    innerRadius: valueLabelRadius,
                    outerRadius: valueLabelRadius,
                    startAngle: pathStartAngle,
                    endAngle: pathEndAngle
                }))
                .style("fill", "none")
                .style("stroke", "none"); // Make path invisible

            valueLabelsGroup.append("text")
                .attr("class", "label value-label")
                .style("font-family", fillStyle.typography.valueLabelText.fontFamily)
                .style("font-size", fillStyle.typography.valueLabelText.fontSize)
                .style("font-weight", fillStyle.typography.valueLabelText.fontWeight)
                .attr("fill", fillStyle.valueLabelTextColor)
                .append("textPath")
                .attr("href", `#${valueTextPathId}`)
                .attr("startOffset", "50%")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle") 
                .text(valueText);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - None in this refactor)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}