/* REQUIREMENTS_BEGIN
{
  "chart_type": "Circular Bar Chart",
  "chart_name": "circular_bar_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",
  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
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
    const colorsInput = data.colors || {};
    // const imagesInput = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldRole = "x";
    const valueFieldRole = "y";

    const dimensionColumn = dataColumns.find(col => col.role === dimensionFieldRole);
    const valueColumn = dataColumns.find(col => col.role === valueFieldRole);

    let missingFields = [];
    if (!dimensionColumn) missingFields.push(`role '${dimensionFieldRole}' (e.g., category name)`);
    if (!valueColumn) missingFields.push(`role '${valueFieldRole}' (e.g., numerical value)`);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart configuration missing: Field(s) for ${missingFields.join(' and ')} not found in dataColumns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = dimensionColumn.name;
    const valueFieldName = valueColumn.name;

    let valueSuffix = "";
    if (valueColumn.unit && valueColumn.unit !== "none") {
        const unit = valueColumn.unit;
        if (!['B', 'M', 'K'].includes(unit.toUpperCase())) { // Avoid duplicating B/M/K from formatValueForDisplay
             valueSuffix = unit.startsWith('%') || unit.startsWith('°') || unit.startsWith('$') ? unit : " " + unit;
        }
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || "Arial, sans-serif",
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || "12px",
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || "normal",
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || "Arial, sans-serif",
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || "10px",
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || "normal",
        },
        textColor: colorsInput.text_color || "#333333",
        primaryBarColor: (colorsInput.other && colorsInput.other.primary) || "#084594",
        chartBackground: colorsInput.background_color || "#FFFFFF",
        centralCircleStroke: "#CCCCCC", 
        valueTextInCircleColor: "#FFFFFF", 
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            const avgCharWidth = parseFloat(fontSize) * 0.6; 
            width = text.length * avgCharWidth;
            console.warn("estimateTextWidth using fallback due to getBBox error.", e);
        }
        return width;
    }

    function formatValueForDisplay(value) {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        }
        return d3.format("~g")(value);
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    svgRoot.style("background-color", fillStyle.chartBackground);


    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 60, bottom: 60, left: 60 }; 
    
    const drawingWidth = containerWidth - chartMargins.left - chartMargins.right;
    const drawingHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (drawingWidth <=0 || drawingHeight <=0) {
        const errorMsg = "Calculated drawing area is too small. Please increase container dimensions or reduce margins.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    const centerX = chartMargins.left + drawingWidth / 2;
    const centerY = chartMargins.top + drawingHeight / 2;
    const radius = Math.min(drawingWidth, drawingHeight) / 2;

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = JSON.parse(JSON.stringify(chartDataInput)); 
    chartDataArray.sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);

    if (chartDataArray.length === 0) {
        svgRoot.append("text")
            .attr("class", "text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", "16px")
            .attr("fill", fillStyle.textColor)
            .text("No data available to display.");
        return svgRoot.node();
    }
    
    const totalItems = chartDataArray.length;
    const anglePerItem = (2 * Math.PI) / totalItems;
    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]) || 1; // Ensure maxValue is not 0
    const minValue = 0; 

    // Block 6: Scale Definition & Configuration
    const centralCircleRadius = radius * 0.25;
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([centralCircleRadius + 20, radius * 0.9]); 

    const lightColor = d3.rgb(fillStyle.primaryBarColor).brighter(0.5);
    const darkColor = d3.rgb(fillStyle.primaryBarColor).darker(0.5);
    const colorInterpolator = d3.interpolateRgb(lightColor, darkColor);
    const colorScale = d3.scaleSequential(colorInterpolator)
        .domain([totalItems - 1, 0]); 

    // Block 7: Chart Component Rendering
    svgRoot.append("circle")
        .attr("class", "mark other") 
        .attr("cx", centerX)
        .attr("cy", centerY)
        .attr("r", centralCircleRadius)
        .attr("fill", fillStyle.chartBackground) 
        .attr("stroke", fillStyle.centralCircleStroke)
        .attr("stroke-width", 1.5);

    // Block 8: Main Data Visualization Rendering
    const arcGenerator = d3.arc()
        .innerRadius(centralCircleRadius) 
        .padAngle(0.02); 

    const sectorsGroup = svgRoot.append("g")
        .attr("class", "group marks-group")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    const labelsGroup = svgRoot.append("g")
        .attr("class", "group labels-group")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    chartDataArray.forEach((d, i) => {
        const value = +d[valueFieldName];
        const category = d[categoryFieldName];

        const startAngle = i * anglePerItem;
        const endAngle = startAngle + anglePerItem;
        const midAngle = startAngle + anglePerItem / 2;

        const currentOuterRadius = radiusScale(value);

        sectorsGroup.append("path")
            .datum({
                innerRadius: centralCircleRadius, 
                outerRadius: currentOuterRadius,
                startAngle: startAngle,
                endAngle: endAngle
            })
            .attr("class", "mark")
            .attr("d", arcGenerator)
            .attr("fill", colorScale(i))
            .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
            .on("mouseout", function() { d3.select(this).attr("opacity", 1); });
        
        const endCircleActualRadius = Math.max(12, Math.min(30, radius * 0.1 * (value / maxValue * 2 + 0.5)));

        const endCircleX = Math.sin(midAngle) * currentOuterRadius;
        const endCircleY = -Math.cos(midAngle) * currentOuterRadius;
        
        sectorsGroup.append("circle")
            .attr("class", "mark other") 
            .attr("cx", endCircleX)
            .attr("cy", endCircleY)
            .attr("r", endCircleActualRadius)
            .attr("fill", colorScale(i)) 
            .attr("stroke", fillStyle.chartBackground) 
            .attr("stroke-width", 1);

        const valueText = `${formatValueForDisplay(value)}${valueSuffix}`;
        
        let valueFontSizePx = parseFloat(fillStyle.typography.annotationFontSize);
        valueFontSizePx = Math.min(valueFontSizePx, endCircleActualRadius * 0.9); 
        valueFontSizePx = Math.max(6, valueFontSizePx); 

        let currentTextWidth = estimateTextWidth(valueText,
            fillStyle.typography.annotationFontFamily,
            `${valueFontSizePx}px`,
            fillStyle.typography.annotationFontWeight
        );
        const availableTextWidth = endCircleActualRadius * 1.7; 

        if (currentTextWidth > availableTextWidth && valueFontSizePx > 6) {
            valueFontSizePx = valueFontSizePx * (availableTextWidth / currentTextWidth);
            valueFontSizePx = Math.max(6, valueFontSizePx);
        }
        
        sectorsGroup.append("text")
            .attr("class", "value")
            .attr("x", endCircleX)
            .attr("y", endCircleY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.annotationFontFamily)
            .attr("font-size", `${valueFontSizePx}px`)
            .attr("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", fillStyle.valueTextInCircleColor)
            .text(valueText);

        const labelPadding = 15; 
        const labelRadiusOuter = currentOuterRadius + endCircleActualRadius + labelPadding;
        const labelX = Math.sin(midAngle) * labelRadiusOuter;
        const labelY = -Math.cos(midAngle) * labelRadiusOuter;

        let textAnchor = "middle";
        const midAngleDeg = (midAngle * 180 / Math.PI + 360) % 360; 
        if (midAngleDeg > 10 && midAngleDeg < 170) { 
            textAnchor = "start";
        } else if (midAngleDeg > 190 && midAngleDeg < 350) { 
            textAnchor = "end";
        }
        
        labelsGroup.append("text")
            .attr("class", "label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", textAnchor)
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(category);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Mouseover effects are handled inline.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}