/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Gauge Charts",
  "chart_name": "small_multiples_gauge_plain_chart_02",
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
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || (data.colors_dark || {});
    // const imagesConfig = data.images || {}; // Not used, but parsed for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");

    const xFieldName = xFieldCol ? xFieldCol.name : undefined;
    const yFieldName = yFieldCol ? yFieldCol.name : undefined;

    if (!xFieldName || !yFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push("x field (role: 'x')");
        if (!yFieldName) missingFields.push("y field (role: 'y')");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')} from data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    if (!rawChartData || rawChartData.length === 0) {
        const errorMsg = "No data provided (data.data.data is empty or missing). Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyConfig.title?.font_size || '18px', // For value labels
            titleFontWeight: typographyConfig.title?.font_weight || 'bold',
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '14px', // For category labels
            labelFontWeight: typographyConfig.label?.font_weight || 'bold',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px', // For small messages
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        },
        colors: {
            primary: colorsConfig.other?.primary || '#1f77b4',
            gaugeBackground: '#E0E0E0',
            textColor: colorsConfig.text_color || '#333333',
            chartBackground: colorsConfig.background_color || 'transparent',
        }
    };
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    const estimateTextWidth = (text, fontProps) => {
        if (!text || !fontProps) return 0;
        const { fontFamily, fontSize, fontWeight } = fontProps;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        if (fontFamily) tempText.setAttribute('font-family', fontFamily);
        if (fontSize) tempText.setAttribute('font-size', fontSize);
        if (fontWeight) tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on non-rendered element might fail or be inaccurate
            const size = parseInt(fontSize, 10) || 12;
            return text.length * size * 0.6; // Very rough estimate
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
        .attr("class", "chart-svg other"); // Added 'other' class as it's a root group

    if (fillStyle.colors.chartBackground && fillStyle.colors.chartBackground !== 'transparent') {
        svgRoot.style("background-color", fillStyle.colors.chartBackground);
    }

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.margin_top || 50, 
        right: variables.margin_right || 20, 
        bottom: variables.margin_bottom || 30, 
        left: variables.margin_left || 20 
    };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other");

    // Block 5: Data Preprocessing & Transformation
    const uniqueXValues = [...new Set(rawChartData.map(d => d[xFieldName]))];
    const chartData = uniqueXValues.map(xValue => {
        const item = rawChartData.find(d => d[xFieldName] === xValue);
        return {
            category: String(item[xFieldName]),
            value: +item[yFieldName],
            color: fillStyle.colors.primary 
        };
    });

    const globalMaxValue = Math.max(0, ...chartData.map(d => d.value));

    let rows, cols;
    const numCharts = chartData.length;
    if (numCharts === 0) { rows = 1; cols = 1; } // Should be caught earlier
    else if (numCharts === 1) { rows = 1; cols = 1; }
    else if (numCharts === 2) { rows = 1; cols = 2; } 
    else if (numCharts <= 4) { rows = 2; cols = 2; } 
    else if (numCharts <= 6) { rows = 2; cols = 3; } 
    else { rows = 3; cols = 3; } // Max 9 charts (3x3) based on original range
    
    const subChartWidth = innerWidth / cols;
    const subChartHeight = innerHeight / rows;

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scaleLinear()
        .domain([0, globalMaxValue > 0 ? globalMaxValue : 1])
        .range([0, Math.PI * 1.5]); // 0 to 270 degrees

    // Block 7: Chart Component Rendering
    // No traditional axes, gridlines, or legend for this chart.

    // Block 8: Main Data Visualization Rendering
    chartData.forEach((d, index) => {
        const rowIndex = Math.floor(index / cols);
        const colIndex = index % cols;
        const subChartBaseX = colIndex * subChartWidth;
        const subChartBaseY = rowIndex * subChartHeight;

        const subChartGroup = mainChartGroup.append("g")
            .attr("class", "sub-chart-group other")
            .attr("transform", `translate(${subChartBaseX}, ${subChartBaseY})`);

        const subPadding = Math.min(subChartWidth, subChartHeight) * 0.08; 

        const availableWidthForCellContent = subChartWidth - subPadding * 2;
        const availableHeightForCellContent = subChartHeight - subPadding * 2;
        
        const categoryLabelEstimatedHeight = parseInt(fillStyle.typography.labelFontSize, 10) * 1.3; 
        const valueLabelEstimatedHeight = parseInt(fillStyle.typography.titleFontSize, 10) * 1.3;
        
        const heightForGaugeArc = availableHeightForCellContent - categoryLabelEstimatedHeight - valueLabelEstimatedHeight;

        let maxRadius = Math.min(availableWidthForCellContent / 2, heightForGaugeArc / 2);
        maxRadius = Math.max(0, maxRadius * 0.95); 

        let arcThickness = Math.max(5, maxRadius * 0.25);

        if (maxRadius <= arcThickness || maxRadius < 10) {
            subChartGroup.append("text")
                .attr("x", subChartWidth / 2)
                .attr("y", subChartHeight / 2)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("fill", fillStyle.colors.textColor)
                .attr("class", "text label error-label")
                .text("N/A");
            return; 
        }
        
        const outerRadius = maxRadius;
        const innerRadius = outerRadius - arcThickness;

        const categoryLabelX = subChartWidth / 2;
        const categoryLabelY = subPadding + categoryLabelEstimatedHeight / 2;

        const gaugeCenterX = subChartWidth / 2;
        const gaugeCenterY = subPadding + categoryLabelEstimatedHeight + maxRadius;

        const valueLabelX = subChartWidth / 2;
        const valueLabelY = subPadding + categoryLabelEstimatedHeight + (2 * maxRadius) + valueLabelEstimatedHeight / 2;
        
        subChartGroup.append("text")
            .attr("class", "label text category-label")
            .attr("x", categoryLabelX)
            .attr("y", categoryLabelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(d.category);

        const startAngle = -Math.PI * 0.75; 
        const endAngleValueArc = startAngle + angleScale(d.value);
        const endAngleBackgroundArc = Math.PI * 0.75; 

        const gaugeArcGroup = subChartGroup.append("g")
            .attr("class", "gauge-arc-group other")
            .attr("transform", `translate(${gaugeCenterX}, ${gaugeCenterY})`);

        const arcGenerator = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius)
            .startAngle(startAngle);

        gaugeArcGroup.append("path")
            .attr("class", "mark gauge-background-arc")
            .attr("d", arcGenerator({ endAngle: endAngleBackgroundArc }))
            .style("fill", fillStyle.colors.gaugeBackground)
            .style("opacity", 0.7);

        gaugeArcGroup.append("path")
            .attr("class", "mark gauge-value-arc")
            .attr("d", arcGenerator({ endAngle: endAngleValueArc }))
            .style("fill", d.color);
            
        subChartGroup.append("text")
            .attr("class", "value text value-label")
            .attr("x", valueLabelX)
            .attr("y", valueLabelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle") 
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", fillStyle.typography.titleFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .style("fill", d.color)
            .text(formatValue(d.value));
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}