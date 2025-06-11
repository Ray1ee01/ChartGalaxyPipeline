/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Circular Bar Chart",
  "chart_name": "grouped_circular_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": ["group"],
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
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawData = data;
    const chartDataArray = rawData.data.data;
    const variables = rawData.variables || {};
    const typographyInput = rawData.typography || {};
    const colorsInput = rawData.colors || {}; // Could be colors_dark too, logic to pick one if needed
    const imagesInput = rawData.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = rawData.data.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    let criticalMissingFields = [];
    if (!xFieldCol) criticalMissingFields.push("x role column");
    if (!yFieldCol) criticalMissingFields.push("y role column");
    if (!groupFieldCol) criticalMissingFields.push("group role column");

    if (criticalMissingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${criticalMissingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const groupFieldName = groupFieldCol.name;

    // Validate that fields exist in data (optional, d3 will handle missing data gracefully with undefined)
    if (chartDataArray.length > 0) {
        const samplePoint = chartDataArray[0];
        if (samplePoint[xFieldName] === undefined) criticalMissingFields.push(`x field ('${xFieldName}') not found in data`);
        if (samplePoint[yFieldName] === undefined) criticalMissingFields.push(`y field ('${yFieldName}') not found in data`);
        if (samplePoint[groupFieldName] === undefined) criticalMissingFields.push(`group field ('${groupFieldName}') not found in data`);

        if (criticalMissingFields.length > 0 && !criticalMissingFields.some(s => s.includes("role column"))) { // only if role columns were found
             const errorMsg = `Critical chart data fields missing: ${criticalMissingFields.join(', ')}. Cannot render.`;
             console.error(errorMsg);
             d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif;'>${errorMsg}</div>`);
             return null;
        }
    }


    let valueUnit = "";
    if (yFieldCol && yFieldCol.unit && yFieldCol.unit !== "none") {
        valueUnit = yFieldCol.unit;
    }

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: d3.schemeCategory10,
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };

    const fillStyle = {
        chartBackground: colorsInput.background_color || defaultColors.background_color,
        textColor: colorsInput.text_color || defaultColors.text_color,
        gridLineColor: (colorsInput.other && colorsInput.other.gridColor) || '#e0e0e0', // Example for a specific semantic color
        axisLineColor: (colorsInput.other && colorsInput.other.axisColor) || '#888888',
        typography: {
            categoryLabel: {
                fontFamily: (typographyInput.label && typographyInput.label.font_family) || defaultTypography.label.font_family,
                fontSize: (typographyInput.label && typographyInput.label.font_size) || defaultTypography.label.font_size,
                fontWeight: (typographyInput.label && typographyInput.label.font_weight) || "bold", // Original was bold
            },
            valueLabel: {
                fontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || defaultTypography.annotation.font_family,
                fontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || defaultTypography.annotation.font_size,
                fontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || defaultTypography.annotation.font_weight,
            },
            gridLabel: {
                fontFamily: (typographyInput.label && typographyInput.label.font_family) || defaultTypography.label.font_family,
                fontSize: (typographyInput.label && typographyInput.label.font_size) || "12px", // Original was 12px
                fontWeight: (typographyInput.label && typographyInput.label.font_weight) || defaultTypography.label.font_weight,
            },
            legendLabel: {
                fontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || defaultTypography.annotation.font_family,
                fontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || "10px", // Original was 10px
                fontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || defaultTypography.annotation.font_weight,
            }
        }
    };

    function formatValue(value) {
        if (value == null || isNaN(value)) return ""; // Handle null or NaN gracefully
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI an
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    }
    
    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        if (!text) return 0;
        const tempSvg = d3.select(document.createElementNS('http://www.w3.org/2000/svg', 'svg')).style('visibility', 'hidden').style('position', 'absolute');
        const textElement = tempSvg.append('text')
            .style('font-weight', fontWeight)
            .style('font-size', fontSize)
            .style('font-family', fontFamily)
            .text(text);
        let width = 0;
        try {
           width = textElement.node().getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            width = text.length * (parseFloat(fontSize) / 1.8); // Rough heuristic
        }
        tempSvg.remove();
        return width;
    }

    function createRoundedArcPath(innerRadius, outerRadius, startAngle, endAngle, cornerRadius) {
        const startAngleRad = startAngle - Math.PI / 2;
        const endAngleRad = endAngle - Math.PI / 2;
        
        const thickness = outerRadius - innerRadius;
        // Ensure cornerRadius is not too large
        const maxPossibleCornerRadius = Math.min(thickness / 2, Math.abs(endAngleRad - startAngleRad) * innerRadius / 2, Math.abs(endAngleRad - startAngleRad) * outerRadius / 2);
        const adjustedCornerRadius = Math.min(cornerRadius, maxPossibleCornerRadius);

        if (adjustedCornerRadius <= 0 || (endAngleRad - startAngleRad) === 0) { // Draw a simple arc if no rounding or zero angle
             return d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(outerRadius)
                .startAngle(startAngleRad)
                .endAngle(endAngleRad)();
        }
        
        const context = d3.path();
        context.moveTo(innerRadius * Math.cos(startAngleRad + adjustedCornerRadius / innerRadius), innerRadius * Math.sin(startAngleRad + adjustedCornerRadius / innerRadius));
        context.arcTo(innerRadius * Math.cos(startAngleRad), innerRadius * Math.sin(startAngleRad), outerRadius * Math.cos(startAngleRad), outerRadius * Math.sin(startAngleRad), adjustedCornerRadius);
        context.arcTo(outerRadius * Math.cos(startAngleRad), outerRadius * Math.sin(startAngleRad), outerRadius * Math.cos(startAngleRad + adjustedCornerRadius / outerRadius), outerRadius * Math.sin(startAngleRad + adjustedCornerRadius / outerRadius), adjustedCornerRadius);
        context.arc(0, 0, outerRadius, startAngleRad + adjustedCornerRadius / outerRadius, endAngleRad - adjustedCornerRadius / outerRadius, false);
        context.arcTo(outerRadius * Math.cos(endAngleRad), outerRadius * Math.sin(endAngleRad), innerRadius * Math.cos(endAngleRad), innerRadius * Math.sin(endAngleRad), adjustedCornerRadius);
        context.arcTo(innerRadius * Math.cos(endAngleRad), innerRadius * Math.sin(endAngleRad), innerRadius * Math.cos(endAngleRad - adjustedCornerRadius / innerRadius), innerRadius * Math.sin(endAngleRad - adjustedCornerRadius / innerRadius), adjustedCornerRadius);
        context.arc(0, 0, innerRadius, endAngleRad - adjustedCornerRadius / innerRadius, startAngleRad + adjustedCornerRadius / innerRadius, true);
        context.closePath();
        
        return context.toString();
    }

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
    const chartMargins = { top: 40, right: 40, bottom: 40, left: 40 }; // Original fixed margins
    const chartDrawableWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartDrawableHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    const maxPossibleRadius = Math.min(chartDrawableWidth, chartDrawableHeight) / 2;

    const numBars = chartDataArray.length;
    const minRadius = maxPossibleRadius * 0.2; // Inner empty circle radius
    const maxBarOuterRadius = maxPossibleRadius * 0.95; // Max radius for the outermost bar
    
    const totalBarSpace = maxBarOuterRadius - minRadius;
    const barThicknessUnit = numBars > 0 ? (totalBarSpace / numBars) * 0.7 : 0; // 70% for bar
    const barGapUnit = numBars > 0 ? (totalBarSpace / numBars) * 0.3 : 0; // 30% for gap

    const categoryLabelPadding = 20; // For x-axis labels

    // Block 5: Data Preprocessing & Transformation
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    
    chartDataArray.sort((a, b) => {
        if (a[xFieldName] !== b[xFieldName]) {
            return String(a[xFieldName]).localeCompare(String(b[xFieldName]));
        }
        return String(a[groupFieldName]).localeCompare(String(b[groupFieldName]));
    });

    // Block 6: Scale Definition & Configuration
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => 
            (colorsInput.field && colorsInput.field[group]) || 
            (colorsInput.available_colors && colorsInput.available_colors[i % colorsInput.available_colors.length]) ||
            defaultColors.available_colors[i % defaultColors.available_colors.length]
        ));

    const yMax = d3.max(chartDataArray, d => +d[yFieldName]);
    const angleScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 1]) // Ensure domain is not [0,0]
        .range([0, 1.5 * Math.PI]); // Max 270 degrees

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-area")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    // Radial Gridlines (Helper Lines)
    const numGridTicks = 5;
    const gridTickValues = yMax > 0 ? d3.range(0, yMax + (yMax / numGridTicks), yMax / numGridTicks) : [0, 0.25, 0.5, 0.75, 1];
    
    gridTickValues.forEach(tickValue => {
        if (angleScale(tickValue) > angleScale.range()[1]) return; // Don't draw ticks beyond max angle

        mainChartGroup.append("path")
            .attr("class", "grid-line radial")
            .attr("d", d3.arc()
                .innerRadius(minRadius)
                .outerRadius(maxBarOuterRadius + barThicknessUnit * 0.5) // Extend slightly beyond bars
                .startAngle(angleScale(tickValue))
                .endAngle(angleScale(tickValue))
                ())
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("fill", "none");

        mainChartGroup.append("text")
            .attr("class", "label grid-label")
            .attr("x", Math.cos(angleScale(tickValue) - Math.PI / 2) * (maxBarOuterRadius + barThicknessUnit * 0.7))
            .attr("y", Math.sin(angleScale(tickValue) - Math.PI / 2) * (maxBarOuterRadius + barThicknessUnit * 0.7))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.gridLabel.fontFamily)
            .style("font-size", fillStyle.typography.gridLabel.fontSize)
            .style("font-weight", fillStyle.typography.gridLabel.fontWeight)
            .text(formatValue(Math.round(tickValue)) + valueUnit);
    });
    
    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${containerWidth - chartMargins.right - 150}, ${chartMargins.top})`);

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
            .attr("class", "label legend-label")
            .attr("x", 20)
            .attr("y", 12) // Vertically align with rect
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.legendLabel.fontFamily)
            .style("font-size", fillStyle.typography.legendLabel.fontSize)
            .style("font-weight", fillStyle.typography.legendLabel.fontWeight)
            .text(group);
    });


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    chartDataArray.forEach((d, i) => {
        const barInnerRadius = minRadius + i * (barThicknessUnit + barGapUnit);
        const barOuterRadius = barInnerRadius + barThicknessUnit;
        const barEndAngle = angleScale(+d[yFieldName]);
        const barCornerRadius = barThicknessUnit / 2; // Fully rounded ends

        mainChartGroup.append("path")
            .attr("class", "mark bar")
            .attr("d", createRoundedArcPath(barInnerRadius, barOuterRadius, 0, barEndAngle, barCornerRadius))
            .attr("fill", colorScale(d[groupFieldName]));

        // Category Labels (X-axis equivalent) - only for the first bar of each xFieldName category
        const isFirstBarForThisX = chartDataArray.findIndex(item => item[xFieldName] === d[xFieldName]) === i;
        if (isFirstBarForThisX && d[xFieldName]) {
            mainChartGroup.append("text")
                .attr("class", "label category-label")
                .attr("x", -categoryLabelPadding) // Position to the left of 12 o'clock start
                .attr("y", -(barInnerRadius + barThicknessUnit / 2)) // Vertically align with the bar's radial center
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.categoryLabel.fontFamily)
                .style("font-size", fillStyle.typography.categoryLabel.fontSize)
                .style("font-weight", fillStyle.typography.categoryLabel.fontWeight)
                .text(d[xFieldName]);
        }

        // Value Labels on Arcs
        const valueText = formatValue(+d[yFieldName]) + valueUnit;
        if (valueText && barEndAngle > 0.1) { // Only show if bar is somewhat visible and text exists
            const valueLabelRadius = barInnerRadius + barThicknessUnit / 2; // Center of the bar
            const valueLabelAngle = barEndAngle;
            
            const textPathId = `value-text-path-${containerSelector.replace(/[^a-zA-Z0-9]/g, '')}-${i}`;

            const estimatedTextLength = estimateTextWidth(
                valueText, 
                fillStyle.typography.valueLabel.fontWeight, 
                fillStyle.typography.valueLabel.fontSize, 
                fillStyle.typography.valueLabel.fontFamily
            );

            const minArcAngleForText = 0.08; // Minimum angle for text path
            // Calculate required angular width for the text
            const requiredAngularWidth = valueLabelRadius > 0 ? Math.max(estimatedTextLength / valueLabelRadius, minArcAngleForText) : minArcAngleForText;
            
            // Define path for text, ensuring it doesn't start before 0 or extend too far
            const textPathStartAngle = Math.max(0, valueLabelAngle - requiredAngularWidth / 1.5); // Shift start back a bit
            const textPathEndAngle = Math.min(angleScale.range()[1] + 0.2, valueLabelAngle + requiredAngularWidth / 1.5); // Allow some overflow for path

            if (textPathEndAngle > textPathStartAngle) { // Ensure path has positive length
                mainChartGroup.append("path")
                    .attr("class", "text-path helper") // Class for helper path
                    .attr("id", textPathId)
                    .attr("d", d3.arc()({
                        innerRadius: valueLabelRadius,
                        outerRadius: valueLabelRadius,
                        startAngle: textPathStartAngle - Math.PI / 2, // Adjust for d3.arc convention
                        endAngle: textPathEndAngle - Math.PI / 2     // Adjust for d3.arc convention
                    }))
                    .style("fill", "none")
                    .style("stroke", "none");

                mainChartGroup.append("text")
                    .attr("class", "label value-label")
                    .style("font-family", fillStyle.typography.valueLabel.fontFamily)
                    .style("font-size", fillStyle.typography.valueLabel.fontSize)
                    .style("font-weight", fillStyle.typography.valueLabel.fontWeight)
                    .attr("fill", fillStyle.textColor)
                    .append("textPath")
                    .attr("xlink:href", `#${textPathId}`)
                    .attr("startOffset", "50%") // Try to center text on its path segment
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle") // Better vertical alignment on path
                    .text(valueText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this simplified version)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}