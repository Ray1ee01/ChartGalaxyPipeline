/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Diverging Bar Chart",
  "chart_name": "diverging_bar_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], ["-inf", "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "ascending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is external)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    // const imagesInput = data.images || {}; // Not used in this chart type
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldDef = dataColumns.find(col => col.role === "x");
    const yFieldDef = dataColumns.find(col => col.role === "y");

    if (!xFieldDef || !yFieldDef) {
        const missing = [];
        if (!xFieldDef) missing.push("role: 'x' (dimension field)");
        if (!yFieldDef) missing.push("role: 'y' (value field)");
        const errorMsg = `Critical chart config missing from data.data.columns: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    const dimensionFieldName = xFieldDef.name;
    const valueFieldName = yFieldDef.name;
    const valueUnit = yFieldDef.unit && yFieldDef.unit !== "none" ? ` ${yFieldDef.unit}` : ""; // Add space if unit exists

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};
    fillStyle.typography = {
        labelFontFamily: typographyInput.label?.font_family || "Arial, sans-serif",
        labelFontSize: typographyInput.label?.font_size || "12px",
        labelFontWeight: typographyInput.label?.font_weight || "normal",
        annotationFontFamily: typographyInput.annotation?.font_family || "Arial, sans-serif",
        annotationFontSize: typographyInput.annotation?.font_size || "10px",
        annotationFontWeight: typographyInput.annotation?.font_weight || "normal",
    };

    fillStyle.positiveBarColor = colorsInput.other?.primary || (colorsInput.available_colors?.[0]) || '#4682B4';
    fillStyle.negativeBarColor = colorsInput.other?.secondary || (colorsInput.available_colors?.[1]) || '#FF6347';
    fillStyle.textColor = colorsInput.text_color || '#333333';
    fillStyle.centerLineColor = colorsInput.other?.axis_line_color || '#000000'; // Configurable center line

    function estimateTextWidth(text, styleConfig) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // No need to style the SVG element itself for getBBox on text
        
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', styleConfig.fontFamily);
        tempText.setAttribute('font-size', styleConfig.fontSize);
        tempText.setAttribute('font-weight', styleConfig.fontWeight);
        tempText.textContent = text;
        
        tempSvg.appendChild(tempText);
        // getBBox should work on an unattached SVG element with children
        return tempText.getBBox().width;
    }
    
    const formatValue = (value) => {
        const absValue = Math.abs(value);
        if (absValue >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // Use "B" for billions
        } else if (absValue >= 1000000) {
            return d3.format("~.2s")(value); // M for millions
        } else if (absValue >= 1000) {
            return d3.format("~.2s")(value); // K for thousands
        }
        return d3.format("~g")(value); // General format for smaller numbers
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 10, bottom: 20, left: 10 }; // Base margins
    const labelPadding = 8; 
    const valueLabelPadding = 5;

    let maxDimensionLabelWidth = 0;
    if (chartDataInput.length > 0) {
        chartDataInput.forEach(d => {
            maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, estimateTextWidth(d[dimensionFieldName], {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            }));
        });
    }
    
    let maxNegValueLabelWidth = 0;
    let maxPosValueLabelWidth = 0;
    if (chartDataInput.length > 0) {
        chartDataInput.forEach(d => {
            const val = d[valueFieldName];
            const formattedText = (val >= 0 ? "+" : "") + formatValue(val) + valueUnit;
            const width = estimateTextWidth(formattedText, {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: fillStyle.typography.annotationFontSize, 
                fontWeight: fillStyle.typography.annotationFontWeight
            });
            if (val < 0) {
                maxNegValueLabelWidth = Math.max(maxNegValueLabelWidth, width);
            } else {
                maxPosValueLabelWidth = Math.max(maxPosValueLabelWidth, width);
            }
        });
    }
    
    chartMargins.left += maxNegValueLabelWidth > 0 ? maxNegValueLabelWidth + valueLabelPadding : 0;
    chartMargins.right += maxPosValueLabelWidth > 0 ? maxPosValueLabelWidth + valueLabelPadding : 0;
    
    let innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= maxDimensionLabelWidth + 2 * labelPadding || innerHeight <= 0) {
        const errorMsg = "Not enough space to render chart content after calculating margins and label space. Adjust size or data.";
        console.warn(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = Array.from(chartDataInput); // Ensure it's an array
    chartDataArray.sort((a, b) => a[valueFieldName] - b[valueFieldName]);
    const sortedDimensionNames = chartDataArray.map(d => d[dimensionFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensionNames)
        .range([0, innerHeight])
        .padding(0.25);

    const minVal = d3.min(chartDataArray, d => d[valueFieldName]);
    const maxVal = d3.max(chartDataArray, d => d[valueFieldName]);
    
    const xScale = d3.scaleLinear()
        .domain([
            minVal !== undefined ? Math.min(0, minVal) : 0,
            maxVal !== undefined ? Math.max(0, maxVal) : 0
        ])
        .range([0, innerWidth])
        .nice();

    const centerLineX = xScale(0);

    // Block 7: Chart Component Rendering
    mainChartGroup.append("line")
        .attr("class", "axis other center-line")
        .attr("x1", centerLineX)
        .attr("y1", 0)
        .attr("x2", centerLineX)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.centerLineColor)
        .attr("stroke-width", 1)
        .style("opacity", 0.7);

    // Block 8: Main Data Visualization Rendering
    const barHeight = yScale.bandwidth();

    if (barHeight <= 0) { // Further check if bars would be invisible
        console.warn("Calculated bar height is zero or negative. Cannot render bars.");
        return null; // Or display a message
    }

    mainChartGroup.selectAll(".mark")
        .data(chartDataArray)
        .join("rect")
        .attr("class", "mark")
        .attr("y", d => yScale(d[dimensionFieldName]))
        .attr("height", barHeight)
        .attr("fill", d => d[valueFieldName] < 0 ? fillStyle.negativeBarColor : fillStyle.positiveBarColor)
        .attr("x", d => d[valueFieldName] < 0 ? xScale(d[valueFieldName]) : centerLineX)
        .attr("width", d => Math.abs(xScale(d[valueFieldName]) - centerLineX));

    mainChartGroup.selectAll(".label.dimension-label")
        .data(chartDataArray)
        .join("text")
        .attr("class", "label dimension-label")
        .attr("x", d => d[valueFieldName] < 0 ? centerLineX + labelPadding : centerLineX - labelPadding)
        .attr("y", d => yScale(d[dimensionFieldName]) + barHeight / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d[valueFieldName] < 0 ? "start" : "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d[dimensionFieldName]);

    mainChartGroup.selectAll(".value.data-value-label")
        .data(chartDataArray)
        .join("text")
        .attr("class", "value data-value-label")
        .attr("x", d => {
            const val = d[valueFieldName];
            return val < 0 ? xScale(val) - valueLabelPadding : xScale(val) + valueLabelPadding;
        })
        .attr("y", d => yScale(d[dimensionFieldName]) + barHeight / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d[valueFieldName] < 0 ? "end" : "start")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", () => {
            const baseSize = parseFloat(fillStyle.typography.annotationFontSize);
            return `${Math.min(20, Math.max(barHeight * 0.6, baseSize))}px`;
        })
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => {
            const val = d[valueFieldName];
            return (val >= 0 ? "+" : "") + formatValue(val) + valueUnit;
        });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements in this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}