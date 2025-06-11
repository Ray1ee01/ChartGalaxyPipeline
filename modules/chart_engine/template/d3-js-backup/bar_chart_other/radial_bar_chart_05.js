/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Bar Chart",
  "chart_name": "radial_bar_chart_01",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {}; // Not used, but extracted per spec
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xCategoryField = dataColumns.find(col => col.role === 'x')?.name;
    const yValueField = dataColumns.find(col => col.role === 'y')?.name;

    if (!xCategoryField || !yValueField) {
        const missingFields = [];
        if (!xCategoryField) missingFields.push("x field (category)");
        if (!yValueField) missingFields.push("y field (value)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    
    if (!chartDataInput || chartDataInput.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    
    let chartDataArray = chartDataInput.map(d => ({...d})); // Shallow copy

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryBarColor: colors.other?.primary || '#ff4d4f',
        gridLineColor: colors.other?.grid || '#e0e0e0',
        chartBackground: colors.background_color || '#FFFFFF',
        categoryLabelColor: colors.text_color || '#222b44',
        valueLabelColor: (colors.other?.valueText) || colors.text_color || '#b71c1c',
        axisLabelColor: (colors.other?.axisText) || colors.text_color || '#888888',
    };

    fillStyle.typography = {
        categoryLabel: {
            fontFamily: typography.label?.font_family || 'Arial, sans-serif',
            fontSize: typography.label?.font_size || '12px', // Default from spec
            fontWeight: typography.label?.font_weight || 'normal', // Default from spec
        },
        valueLabel: {
            fontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
            fontSize: typography.annotation?.font_size || '10px',
            fontWeight: typography.annotation?.font_weight || 'normal',
        },
        axisTickLabel: {
            fontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
            fontSize: typography.annotation?.font_size || '10px',
            fontWeight: typography.annotation?.font_weight || 'normal',
        }
    };

    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-weight', fontWeight);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-family', fontFamily);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        const width = tempText.getBBox().width;
        return width;
    }

    const formatValue = (value) => { // Preserving original formatting logic
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    const createRoundedArcPath = (innerRadius, outerRadius, startAngle, endAngle, cornerRadius) => {
        // Angles for Math.cos/sin (0 at 12 o'clock, positive clockwise)
        const startAngleRad = startAngle - Math.PI / 2;
        const endAngleRad = endAngle - Math.PI / 2;

        const thickness = outerRadius - innerRadius;
        const cr = Math.min(cornerRadius, thickness / 2, 
                            Math.abs(endAngleRad - startAngleRad) * innerRadius / 2, 
                            Math.abs(endAngleRad - startAngleRad) * outerRadius / 2);

        if (cr <= 0.01 || Math.abs(endAngleRad - startAngleRad) < (cr / innerRadius + cr / outerRadius) * 0.5) { // Fallback for tiny arcs/corners
             return d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(outerRadius)
                .startAngle(startAngle) // Use D3 angles
                .endAngle(endAngle)();
        }
        
        const innerStartCornerAngle = startAngleRad + cr / innerRadius;
        const innerStartCornerX = innerRadius * Math.cos(innerStartCornerAngle);
        const innerStartCornerY = innerRadius * Math.sin(innerStartCornerAngle);
        
        const innerEndCornerAngle = endAngleRad - cr / innerRadius;
        const innerEndCornerX = innerRadius * Math.cos(innerEndCornerAngle);
        const innerEndCornerY = innerRadius * Math.sin(innerEndCornerAngle);
        
        const outerStartCornerAngle = startAngleRad + cr / outerRadius;
        const outerStartCornerX = outerRadius * Math.cos(outerStartCornerAngle);
        const outerStartCornerY = outerRadius * Math.sin(outerStartCornerAngle);
        
        const outerEndCornerAngle = endAngleRad - cr / outerRadius;
        const outerEndCornerX = outerRadius * Math.cos(outerEndCornerAngle);
        const outerEndCornerY = outerRadius * Math.sin(outerEndCornerAngle);
        
        const largeArcFlag = (endAngleRad - startAngleRad) > Math.PI ? 1 : 0;
        
        return `
            M ${innerStartCornerX} ${innerStartCornerY}
            A ${cr} ${cr} 0 0 1 ${outerStartCornerX} ${outerStartCornerY}
            A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEndCornerX} ${outerEndY}
            A ${cr} ${cr} 0 0 1 ${innerEndCornerX} ${innerEndCornerY}
            A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStartCornerX} ${innerStartCornerY}
            Z
        `;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root other") // Added class
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.margin_top || 40, 
        right: variables.margin_right || 40, 
        bottom: variables.margin_bottom || 40, 
        left: variables.margin_left || 40 
    };
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    const maxPossibleRadius = Math.min(chartWidth, chartHeight) / 2;

    const nBars = chartDataArray.length;
    const minRadius = maxPossibleRadius * (variables.minRadiusFactor || 0.2);
    const maxBarRadius = maxPossibleRadius * (variables.maxBarRadiusFactor || 0.9); // Slightly reduced to give space for labels
    
    const totalBarSpace = maxBarRadius - minRadius;
    const barPlusGapSize = nBars > 0 ? totalBarSpace / nBars : 0;
    const barWidthRatio = variables.barWidthRatio || 0.7;
    const barWidth = barPlusGapSize * barWidthRatio;
    const barGap = barPlusGapSize * (1 - barWidthRatio);

    const labelPadding = variables.labelPadding || 20; // For category labels
    const axisLabelOffset = variables.axisLabelOffset || 15; // For axis tick labels from grid lines

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other") // Added class
        .attr("transform", `translate(${centerX}, ${centerY})`);

    // Block 5: Data Preprocessing & Transformation
    chartDataArray.sort((a, b) => (b[yValueField] || 0) - (a[yValueField] || 0));

    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartDataArray, d => d[yValueField] || 0);
    const angleScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue : 1])
        .range([0, (variables.maxAngleDegrees || 270) * Math.PI / 180]);

    // Block 7: Chart Component Rendering (Gridlines)
    const numTicks = variables.numTicks || 5;
    if (maxValue > 0 && numTicks > 0) {
        const ticksData = angleScale.ticks(numTicks);
        const gridGroup = mainChartGroup.append("g").attr("class", "grid-lines axis");

        gridGroup.selectAll(".grid-line-radial")
            .data(ticksData)
            .join("line")
                .attr("class", "grid-line-radial mark")
                .attr("x1", 0).attr("y1", -minRadius)
                .attr("x2", 0).attr("y2", -maxBarRadius)
                .attr("transform", d => `rotate(${angleScale(d) * 180 / Math.PI})`)
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 1);

        gridGroup.selectAll(".grid-label")
            .data(ticksData)
            .join("text")
                .attr("class", "label axis-label")
                .attr("x", d => Math.cos(angleScale(d) - Math.PI / 2) * (maxBarRadius + axisLabelOffset))
                .attr("y", d => Math.sin(angleScale(d) - Math.PI / 2) * (maxBarRadius + axisLabelOffset))
                .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.axisLabelColor)
                .style("font-family", fillStyle.typography.axisTickLabel.fontFamily)
                .style("font-size", fillStyle.typography.axisTickLabel.fontSize)
                .style("font-weight", fillStyle.typography.axisTickLabel.fontWeight)
                .text(d => formatValue(d));
    }
    
    // Block 8: Main Data Visualization Rendering
    const barsGroup = mainChartGroup.append("g").attr("class", "bars-group other");

    chartDataArray.forEach((d, i) => {
        const innerR = minRadius + i * (barWidth + barGap);
        const outerR = innerR + barWidth;
        const value = d[yValueField] || 0;
        const barEndAngle = angleScale(value);
        const cornerRadius = barWidth / 2;

        if (outerR > innerR && barEndAngle > 0.001) { // Only draw if bar has positive thickness and angle
            barsGroup.append("path")
                .datum(d) // Attach data for potential interactions later
                .attr("class", "mark bar")
                .attr("d", createRoundedArcPath(innerR, outerR, 0, barEndAngle, cornerRadius))
                .attr("fill", fillStyle.primaryBarColor);
        }

        const categoryText = String(d[xCategoryField]);
        barsGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", -labelPadding) 
            .attr("y", -(innerR + barWidth / 2)) 
            .attr("text-anchor", "end").attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.categoryLabelColor)
            .style("font-family", fillStyle.typography.categoryLabel.fontFamily)
            .style("font-size", fillStyle.typography.categoryLabel.fontSize)
            .style("font-weight", fillStyle.typography.categoryLabel.fontWeight)
            .text(categoryText);

        if (value > 0 && barEndAngle > 0.001) {
            const valueText = formatValue(value);
            const valueLabelRadius = innerR + barWidth / 2;
            const valueTextPathId = `value-text-path-${containerSelector.substring(1)}-${i}`; // Unique ID
            
            const textWidthEst = estimateTextWidth(valueText, 
                fillStyle.typography.valueLabel.fontWeight, 
                fillStyle.typography.valueLabel.fontSize, 
                fillStyle.typography.valueLabel.fontFamily);

            const textAngularWidth = (textWidthEst / valueLabelRadius) * 1.1; // *1.1 for buffer
            
            const pathStartAngle = Math.max(0, barEndAngle - textAngularWidth / 2); // Center path on bar end
            const pathEndAngle = Math.min(angleScale.range()[1], barEndAngle + textAngularWidth / 2);

            if (pathEndAngle > pathStartAngle && valueLabelRadius > 0) {
                 const textPathGenerator = d3.arc()
                    .innerRadius(valueLabelRadius).outerRadius(valueLabelRadius)
                    .startAngle(pathStartAngle).endAngle(pathEndAngle);

                barsGroup.append("path")
                    .attr("id", valueTextPathId)
                    .attr("class", "text-path-helper other")
                    .attr("d", textPathGenerator)
                    .style("fill", "none").style("stroke", "none");

                barsGroup.append("text")
                    .attr("class", "label value-label")
                    .style("font-family", fillStyle.typography.valueLabel.fontFamily)
                    .style("font-size", fillStyle.typography.valueLabel.fontSize)
                    .style("font-weight", fillStyle.typography.valueLabel.fontWeight)
                    .attr("fill", fillStyle.valueLabelColor)
                    .append("textPath")
                        .attr("xlink:href", `#${valueTextPathId}`)
                        .attr("startOffset", "50%")
                        .attr("text-anchor", "middle").attr("dominant-baseline", "central")
                        .text(valueText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}