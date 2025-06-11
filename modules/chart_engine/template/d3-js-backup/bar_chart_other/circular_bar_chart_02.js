/* REQUIREMENTS_BEGIN
{
  "chart_type": "Circular Bar Chart",
  "chart_name": "circular_bar_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[15, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "background_color", "text_color"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "categorical_markers_overlay_edge"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = {
        width: 800, // Default width
        height: 600, // Default height
        barThickness: 20,
        rankCircleRadius: 18, // Radius of the circle for rank number
        rankToBarGap: 15, // Gap between rank circle and start of the bar
        barStartOffsetFromRank: 30, // Total offset for bar inner radius from rank circle center
        paddingForOuterExtent: 20, // Padding from SVG edge for max bar/grid extent
        barEndIconBackgroundRadius: 18,
        barEndIconImageDisplayRadius: 15,
        dataLabelOffset: 20, // Offset for data labels from bar end
        tickLabelOffset: 10, // Offset for tick labels from center line
        numberOfTicks: 5,
    };

    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assumes light theme, or data.colors_dark for dark
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldDef = dataColumns.find(col => col.role === 'x');
    const yFieldDef = dataColumns.find(col => col.role === 'y');

    if (!xFieldDef || !yFieldDef) {
        console.error("Critical chart config missing: x or y field definition not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration missing (x or y field).</div>");
        return null;
    }
    const xFieldName = xFieldDef.name;
    const yFieldName = yFieldDef.name;

    if (rawChartData.length === 0) {
        console.warn("No data provided to chart.");
        d3.select(containerSelector).html("<div style='text-align:center; padding:20px;'>No data to display.</div>");
        return null;
    }
    
    const chartData = JSON.parse(JSON.stringify(rawChartData)); // Deep copy for sorting

    // Sort data by yField in descending order
    chartData.sort((a, b) => b[yFieldName] - a[yFieldName]);

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#333333',
        primaryBarColor: (colors.other && colors.other.primary) ? colors.other.primary : '#008866',
        chartBackground: colors.background_color || '#FFFFFF',
        radialGridLineColor: (colors.other && colors.other.grid) ? colors.other.grid : '#E0E0E0',
        rankCircleFill: (colors.other && colors.other.rank_circle_fill) ? colors.other.rank_circle_fill : '#FFFFFF',
        rankCircleStroke: (colors.other && colors.other.rank_circle_stroke) ? colors.other.rank_circle_stroke : '#075c66',
        rankTextColor: (colors.other && colors.other.rank_text_color) ? colors.other.rank_text_color : '#075c66',
        tickLabelColor: (colors.other && colors.other.tick_label_color) ? colors.other.tick_label_color : '#666666',
        dataLabelColor: (colors.other && colors.other.data_label_color) ? colors.other.data_label_color : '#005540',
        dataLabelColorInside: (colors.other && colors.other.data_label_color_inside) ? colors.other.data_label_color_inside : '#FFFFFF',
        barEndIconBackgroundColor: '#FFFFFF',
    };

    function estimateTextWidth(text, fontProps) {
        const defaultFont = `${fillStyle.typography.labelFontSize} ${fillStyle.typography.labelFontFamily}`;
        const { fontSize, fontFamily, fontWeight } = fontProps || {};
        const effectiveFontFamily = fontFamily || fillStyle.typography.labelFontFamily;
        const effectiveFontSize = fontSize || fillStyle.typography.labelFontSize;
        const effectiveFontWeight = fontWeight || fillStyle.typography.labelFontWeight;

        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', effectiveFontFamily);
        tempText.setAttribute('font-size', effectiveFontSize);
        tempText.setAttribute('font-weight', effectiveFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: tempSvg is not added to DOM. getBBox() needs it to be in DOM or use specific browser APIs.
        // For robustness in this environment, we'll use an approximation or assume a fixed-width font behavior if getBBox fails.
        // A common approximation: text.length * fontSize_in_px * 0.6 (adjust 0.6 based on typical char width)
        // However, for compliance, trying to use getBBox on an unattached element.
        // This might return 0 in some environments. A real implementation often appends, measures, then removes.
        // For this refactor, we'll rely on it working or being approximated if it doesn't.
        try {
            // To make getBBox work, it often needs to be in the DOM.
            // This is a simplified version. For true accuracy, append to body, measure, remove.
            document.body.appendChild(tempSvg);
            const width = tempText.getBBox().width;
            document.body.removeChild(tempSvg);
            return width;
        } catch (e) {
            // Fallback for environments where getBBox on non-DOM elements fails
            const sizeInPx = parseFloat(effectiveFontSize);
            return text.length * sizeInPx * 0.6;
        }
    }
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || chartConfig.width;
    const containerHeight = variables.height || chartConfig.height;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group");

    const defs = svgRoot.append("defs");
    const clipPathId = `circular-bar-icon-clip-${Date.now()}`;
    defs.append("clipPath")
        .attr("id", clipPathId)
        .append("circle")
        .attr("r", variables.barEndIconImageDisplayRadius || chartConfig.barEndIconImageDisplayRadius)
        .attr("cx", variables.barEndIconImageDisplayRadius || chartConfig.barEndIconImageDisplayRadius)
        .attr("cy", variables.barEndIconImageDisplayRadius || chartConfig.barEndIconImageDisplayRadius);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.marginTop || 20, 
        right: variables.marginRight || 20, 
        bottom: variables.marginBottom || 20, 
        left: variables.marginLeft || 20 
    };

    // Center of the semicircle's straight edge
    // Position it to allow space for the semicircle to open to the left.
    // e.g. if semicircle radius is R, centerX could be R + left_padding.
    // Or, if it's meant to be on the right side of SVG, centerX = containerWidth - R - right_padding.
    // Original had halfCircleX at 700 for width 1000, opening left. So straight edge was on right.
    const effectiveChartRadius = Math.min(
        (containerWidth - chartMargins.left - chartMargins.right) / 2, 
        containerHeight - chartMargins.top - chartMargins.bottom 
    ) * 0.9; // A guess for a compact semicircle

    const baseRadiusForCalculations = variables.baseRadius || Math.min(containerWidth, containerHeight) / 3;


    const currentRankCircleRadius = variables.rankCircleRadius || chartConfig.rankCircleRadius;
    const currentBarStartOffsetFromRank = variables.barStartOffsetFromRank || chartConfig.barStartOffsetFromRank;
    const currentPaddingForOuterExtent = variables.paddingForOuterExtent || chartConfig.paddingForOuterExtent;
    
    const calculatedRankRadius = baseRadiusForCalculations * 0.5;
    const calculatedBarInnerRadius = calculatedRankRadius + (variables.rankToBarGap || chartConfig.rankToBarGap);
    // Max extent for bars, ensuring they fit. Semicircle opens left, centered vertically.
    // chartCenterX is the x-coordinate of the vertical diameter of the semicircle.
    const chartCenterX = variables.chartCenterX || containerWidth - calculatedRankRadius - currentPaddingForOuterExtent - (variables.maxBarLengthGuess || baseRadiusForCalculations * 0.7); 
    const chartCenterY = containerHeight / 2;

    const barOuterExtentRadius = Math.min(
        chartCenterX - chartMargins.left, // Space to the left of center
        chartCenterY - chartMargins.top,  // Space to the top of center (for vertical extent)
        containerHeight - chartCenterY - chartMargins.bottom // Space to the bottom
    ) - currentPaddingForOuterExtent;


    const startAngle = Math.PI / 2; // Top
    const endAngle = -Math.PI / 2;  // Bottom
    const angleStep = chartData.length > 1 ? (startAngle - endAngle) / (chartData.length - 1) : 0;
    const currentBarThickness = variables.barThickness || chartConfig.barThickness;


    // Block 5: Data Preprocessing & Transformation
    // Sorting was done in Block 1. No other major transformations here for this chart.

    // Block 6: Scale Definition & Configuration
    const yMax = d3.max(chartData, d => d[yFieldName]);
    const barScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 1]) // Ensure domain is not [0,0]
        .range([0, barOuterExtentRadius - calculatedBarInnerRadius > 0 ? barOuterExtentRadius - calculatedBarInnerRadius : 10]); // Ensure range is positive

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Radial Grid Lines
    const gridLinesGroup = mainChartGroup.append("g").attr("class", "grid-lines");
    if (chartData.length > 0) {
        chartData.forEach((d, i) => {
            const angle = startAngle - i * angleStep;
            gridLinesGroup.append("line")
                .attr("class", "gridline radial-gridline")
                .attr("x1", chartCenterX)
                .attr("y1", chartCenterY)
                .attr("x2", chartCenterX - barOuterExtentRadius * Math.cos(angle))
                .attr("y2", chartCenterY - barOuterExtentRadius * Math.sin(angle))
                .attr("stroke", fillStyle.radialGridLineColor)
                .attr("stroke-width", 1) // Thinner than bars
                .attr("opacity", 0.5);
        });
    }
    
    // Rank Numbers
    const rankGroup = mainChartGroup.append("g").attr("class", "ranks");
    chartData.forEach((d, i) => {
        const angle = startAngle - i * angleStep;
        const rankX = chartCenterX - calculatedRankRadius * Math.cos(angle);
        const rankY = chartCenterY - calculatedRankRadius * Math.sin(angle);

        rankGroup.append("circle")
            .attr("class", "mark rank-circle-background")
            .attr("cx", rankX)
            .attr("cy", rankY)
            .attr("r", currentRankCircleRadius)
            .attr("fill", fillStyle.rankCircleFill)
            .attr("stroke", fillStyle.rankCircleStroke)
            .attr("stroke-width", 1.5);

        rankGroup.append("text")
            .attr("class", "label rank-text")
            .attr("x", rankX)
            .attr("y", rankY)
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize) // Standardized
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.rankTextColor)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .text(i + 1);
    });

    // Radial Tick Labels (Y-axis equivalent)
    const tickGroup = mainChartGroup.append("g").attr("class", "axis y-axis ticks");
    const numTicks = variables.numberOfTicks || chartConfig.numberOfTicks;
    if (yMax > 0 && numTicks > 0) {
        const tickValues = d3.ticks(0, yMax, numTicks);
        tickValues.forEach(tickValue => {
            if (tickValue === 0 && barScale(tickValue) === 0) return; // Skip 0 tick if it's at the very start
            const tickRadius = calculatedBarInnerRadius + barScale(tickValue);
            tickGroup.append("text")
                .attr("class", "label tick-label")
                .attr("x", chartCenterX + (variables.tickLabelOffset || chartConfig.tickLabelOffset)) // Position to the right of center
                .attr("y", chartCenterY - tickRadius)
                .attr("font-family", fillStyle.typography.labelFontFamily)
                .attr("font-size", fillStyle.typography.annotationFontSize) // Smaller for ticks
                .attr("font-weight", fillStyle.typography.annotationFontWeight)
                .attr("fill", fillStyle.tickLabelColor)
                .attr("text-anchor", "start")
                .attr("dominant-baseline", "middle")
                .text(tickValue);
            
            // Optional: Add circular tick lines
            tickGroup.append("path")
                .attr("class", "gridline circular-gridline")
                .attr("d", d3.arc()
                    .innerRadius(tickRadius)
                    .outerRadius(tickRadius)
                    .startAngle(-Math.PI / 2 - 0.05) // slightly extend for semicircle
                    .endAngle(Math.PI / 2 + 0.05)) // slightly extend
                .attr("transform", `translate(${chartCenterX},${chartCenterY})`)
                .attr("stroke", fillStyle.radialGridLineColor)
                .attr("stroke-dasharray", "2,2")
                .attr("stroke-width", 0.5)
                .attr("fill", "none");
        });
    }

    // Block 8: Main Data Visualization Rendering
    const barsGroup = mainChartGroup.append("g").attr("class", "bars");
    barsGroup.selectAll(".bar")
        .data(chartData)
        .enter()
        .append("line")
        .attr("class", "mark bar")
        .attr("x1", (d, i) => {
            const angle = startAngle - i * angleStep;
            return chartCenterX - calculatedBarInnerRadius * Math.cos(angle);
        })
        .attr("y1", (d, i) => {
            const angle = startAngle - i * angleStep;
            return chartCenterY - calculatedBarInnerRadius * Math.sin(angle);
        })
        .attr("x2", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yFieldName]);
            return chartCenterX - (calculatedBarInnerRadius + barLength) * Math.cos(angle);
        })
        .attr("y2", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yFieldName]);
            return chartCenterY - (calculatedBarInnerRadius + barLength) * Math.sin(angle);
        })
        .attr("stroke", fillStyle.primaryBarColor)
        .attr("stroke-width", currentBarThickness)
        .attr("stroke-linecap", "round");

    // Value Labels
    const dataLabelsGroup = mainChartGroup.append("g").attr("class", "data-labels");
    chartData.forEach((d, i) => {
        const angle = startAngle - i * angleStep;
        const barLength = barScale(d[yFieldName]);
        
        const valueText = `${d[xFieldName]}: ${d[yFieldName]}`;
        const textFontProps = {
            fontSize: fillStyle.typography.labelFontSize,
            fontFamily: fillStyle.typography.labelFontFamily,
            fontWeight: "bold" // Data labels often bold
        };
        const estimatedWidth = estimateTextWidth(valueText, textFontProps);

        let labelX, labelY, textAnchor, labelColor;
        const labelOffset = variables.dataLabelOffset || chartConfig.dataLabelOffset;

        // Position outside by default
        labelX = chartCenterX - (calculatedBarInnerRadius + barLength + labelOffset) * Math.cos(angle);
        labelY = chartCenterY - (calculatedBarInnerRadius + barLength + labelOffset) * Math.sin(angle);
        textAnchor = (angle > -Math.PI/4 && angle < Math.PI/4) ? "start" : "end"; // Adjust anchor for readability near horizontal
         if (Math.cos(angle) < 0) { // Points left
            textAnchor = "end";
        } else if (Math.cos(angle) > 0) { // Points right (not in this chart)
            textAnchor = "start";
        } else { // Vertical
            textAnchor = "middle";
        }

        labelColor = fillStyle.dataLabelColor;

        // If label doesn't fit outside or bar is too short, try inside
        const spaceForLabelOutside = barOuterExtentRadius - (calculatedBarInnerRadius + barLength);
        if (estimatedWidth > spaceForLabelOutside && estimatedWidth < barLength - labelOffset) {
            labelX = chartCenterX - (calculatedBarInnerRadius + barLength - labelOffset - estimatedWidth/2) * Math.cos(angle); // simplified logic
            labelY = chartCenterY - (calculatedBarInnerRadius + barLength - labelOffset - estimatedWidth/2) * Math.sin(angle);
            labelColor = fillStyle.dataLabelColorInside;
             if (Math.cos(angle) < 0) { 
                textAnchor = "start";
            } else if (Math.cos(angle) > 0) {
                textAnchor = "end";
            } else { 
                textAnchor = "middle";
            }
        }
        
        const rotation = (angle * 180 / Math.PI);

        dataLabelsGroup.append("text")
            .attr("class", "label data-label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("font-family", textFontProps.fontFamily)
            .attr("font-size", textFontProps.fontSize)
            .attr("font-weight", textFontProps.fontWeight)
            .attr("fill", labelColor)
            .attr("text-anchor", textAnchor)
            .attr("dominant-baseline", "middle")
            .attr("transform", `rotate(${rotation}, ${labelX}, ${labelY})`)
            .text(valueText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Bar End Icons
    const iconsGroup = mainChartGroup.append("g").attr("class", "icons bar-end-icons");
    chartData.forEach((d, i) => {
        const iconUrl = (images.field && images.field[d[xFieldName]]) ? images.field[d[xFieldName]] : null;
        if (!iconUrl) return;

        const angle = startAngle - i * angleStep;
        const barLength = barScale(d[yFieldName]);
        
        const iconBgRadius = variables.barEndIconBackgroundRadius || chartConfig.barEndIconBackgroundRadius;
        const iconImageDisplayRadius = variables.barEndIconImageDisplayRadius || chartConfig.barEndIconImageDisplayRadius;

        const iconCenterX = chartCenterX - (calculatedBarInnerRadius + barLength) * Math.cos(angle);
        const iconCenterY = chartCenterY - (calculatedBarInnerRadius + barLength) * Math.sin(angle);

        iconsGroup.append("circle")
            .attr("class", "icon icon-background")
            .attr("cx", iconCenterX)
            .attr("cy", iconCenterY)
            .attr("r", iconBgRadius)
            .attr("fill", fillStyle.barEndIconBackgroundColor);

        iconsGroup.append("image")
            .attr("class", "icon icon-image")
            .attr("xlink:href", iconUrl)
            .attr("x", iconCenterX - iconImageDisplayRadius)
            .attr("y", iconCenterY - iconImageDisplayRadius)
            .attr("width", iconImageDisplayRadius * 2)
            .attr("height", iconImageDisplayRadius * 2)
            .attr("clip-path", `url(#${clipPathId})`);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}