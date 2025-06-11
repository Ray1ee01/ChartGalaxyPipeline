/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Gauge Charts",
  "chart_name": "small_multiples_gauge_plain_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 9], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data?.data;
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {};
    const imagesConfig = data.images || {}; // Extracted per spec, though not used in this chart
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x-role field (category)");
        if (!valueFieldName) missingFields.push("y-role field (value)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        return null;
    }
    
    if (!chartDataArray || chartDataArray.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: colorsConfig.other?.primary || '#1f77b4',
        gaugeBackgroundFill: colorsConfig.other?.secondary || '#E0E0E0',
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyConfig.title?.font_size || '16px',
            titleFontWeight: typographyConfig.title?.font_weight || 'bold',
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '14px',
            labelFontWeight: typographyConfig.label?.font_weight || 'bold',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '12px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'bold',
        }
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    // In-memory text measurement utility (not critically used for layout precision in this chart)
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svgNamespace = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNamespace, 'svg');
        const textElement = document.createElementNS(svgNamespace, 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // getBBox on non-DOM-attached elements can be inconsistent.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback: very rough estimate based on character count and font size.
            return (text || "").length * (parseFloat(fontSize) * 0.6); 
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: chartConfig.marginTop !== undefined ? chartConfig.marginTop : 50, 
        right: chartConfig.marginRight !== undefined ? chartConfig.marginRight : 20, 
        bottom: chartConfig.marginBottom !== undefined ? chartConfig.marginBottom : 30, 
        left: chartConfig.marginLeft !== undefined ? chartConfig.marginLeft : 20
    };
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const uniqueCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    const processedData = uniqueCategories.map(category => {
        const item = chartDataArray.find(d => d[categoryFieldName] === category);
        return {
            category: category,
            value: +item[valueFieldName], // Ensure numeric
            color: fillStyle.primaryColor 
        };
    });

    const globalMaxValue = Math.max(0, ...processedData.map(d => d.value));

    const numCharts = processedData.length;
    let rows, cols;
    if (numCharts <= 0) { rows = 1; cols = 1;} // Should not happen due to earlier check
    else if (numCharts === 1) { rows = 1; cols = 1; }
    else if (numCharts === 2) { rows = 1; cols = 2; } 
    else if (numCharts <= 4) { rows = 2; cols = 2; } 
    else if (numCharts <= 6) { rows = 2; cols = 3; } 
    else { rows = 3; cols = Math.ceil(numCharts / 3); }

    const subChartWidth = innerWidth / cols;
    const subChartHeight = innerHeight / rows;

    // Block 6: Scale Definition & Configuration
    const gaugeOverallStartAngle = -Math.PI / 2; // 12 o'clock
    const gaugeSweepAngle = 1.5 * Math.PI;       // 270 degrees sweep clockwise

    const angleScale = d3.scaleLinear()
        .domain([0, globalMaxValue === 0 ? 1 : globalMaxValue]) // Avoid division by zero if max is 0
        .range([0, gaugeSweepAngle]);

    // Block 7: Chart Component Rendering
    // Not applicable for this chart type (no shared axes, legend, etc.).

    // Block 8: Main Data Visualization Rendering
    processedData.forEach((d, index) => {
        const rowIndex = Math.floor(index / cols);
        const colIndex = index % cols;
        const subChartX = colIndex * subChartWidth;
        const subChartY = rowIndex * subChartHeight;

        const subChartGroup = mainChartGroup.append("g")
            .attr("class", "gauge-multiple other")
            .attr("transform", `translate(${subChartX}, ${subChartY})`);

        const subMargin = chartConfig.gaugePadding !== undefined ? chartConfig.gaugePadding : 20;
        const gaugeCenterX = subChartWidth / 2;
        
        const categoryLabelHeight = parseFloat(fillStyle.typography.labelFontSize) + (chartConfig.categoryLabelSpacing || 15); // Font size + spacing
        const gaugeCenterY = (subChartHeight - categoryLabelHeight) / 2; // Center gauge in remaining vertical space

        const availableWidthForGauge = subChartWidth - subMargin * 2;
        const availableHeightForGauge = (subChartHeight - categoryLabelHeight) - subMargin * 2;
        
        const maxRadius = Math.min(availableWidthForGauge / 2, availableHeightForGauge / 2) * (chartConfig.gaugeRadiusFactor || 0.9);


        const arcThickness = Math.max(
            chartConfig.minArcThickness || 10, 
            maxRadius * (chartConfig.arcThicknessRatio || 0.25)
        );

        const categoryLabelYPosition = gaugeCenterY * 2 + categoryLabelHeight - (chartConfig.categoryLabelSpacing || 15)/2 ; // Place label at the bottom
        subChartGroup.append("text")
            .attr("class", "label text category-label")
            .attr("x", gaugeCenterX)
            .attr("y", categoryLabelYPosition)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "alphabetic") // Better for bottom alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d.category);

        const gaugeGroup = subChartGroup.append("g")
            .attr("class", "gauge-elements")
            .attr("transform", `translate(${gaugeCenterX}, ${gaugeCenterY})`);

        const outerRadius = maxRadius;
        const innerRadius = Math.max(0, outerRadius - arcThickness);

        const backgroundArcGenerator = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius)
            .startAngle(gaugeOverallStartAngle)
            .endAngle(gaugeOverallStartAngle + gaugeSweepAngle);

        gaugeGroup.append("path")
            .attr("class", "mark gauge-background-arc")
            .attr("d", backgroundArcGenerator)
            .style("fill", fillStyle.gaugeBackgroundFill);

        const valueArcGenerator = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius)
            .startAngle(gaugeOverallStartAngle);

        const valueEndAngle = gaugeOverallStartAngle + angleScale(d.value);
        gaugeGroup.append("path")
            .attr("class", "mark gauge-value-arc")
            .attr("d", valueArcGenerator({ endAngle: valueEndAngle }))
            .style("fill", d.color);

        const valueLabelOffsetX = chartConfig.valueLabelOffsetX || -10; 
        const valueLabelOffsetYRatio = chartConfig.valueLabelOffsetYRatio || 0.5; // Ratio of arc thickness for Y offset
        const valueLabelY = -outerRadius + arcThickness * valueLabelOffsetYRatio;

        let baseAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
        const dynamicValueFontSize = Math.min(
            baseAnnotationFontSize, 
            arcThickness * (chartConfig.valueFontSizeToArcThicknessRatio || 0.8), 
            chartConfig.maxGaugeValueFontSize || 16
        );

        subChartGroup.append("text")
            .attr("class", "value text gauge-value-label")
            .attr("x", gaugeCenterX + valueLabelOffsetX) 
            .attr("y", gaugeCenterY + valueLabelY)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", dynamicValueFontSize + "px")
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", d.color)
            .text(formatValue(d.value));
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}