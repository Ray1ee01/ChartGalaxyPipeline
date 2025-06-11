/* REQUIREMENTS_BEGIN
{
  "chart_type": "Span Chart",
  "chart_name": "span_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "yes",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a vertical span chart, comparing two values for each category.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data.data;
    const variables = data.variables || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const getFieldByRole = (role) => {
        const col = dataColumns.find(c => c.role === role);
        return col ? col.name : undefined;
    };

    const dimensionField = getFieldByRole("x");
    const valueField = getFieldByRole("y");
    const groupField = getFieldByRole("group");

    const criticalFields = { dimensionField, valueField, groupField };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key.replace("Field", " (role: " + key.substring(0, key.indexOf("Field")) + ")"));

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart configuration missing for roles: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("font-family", "Arial, sans-serif")
            .style("padding", "10px")
            .html(errorMsg);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const inputTypography = data.typography || {};
    const effectiveTypography = {
        label: { ...defaultTypography.label, ...(inputTypography.label || {}) },
        annotation: { ...defaultTypography.annotation, ...(inputTypography.annotation || {}) }
    };

    const defaultColors = {
        field: {},
        other: { primary: "#6fa0d8" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"], // d3.schemeCategory10
        background_color: "#333333",
        text_color: "#f0f0f0"
    };
    const inputColors = data.colors_dark || data.colors || {};
    const effectiveColors = {
        field: { ...defaultColors.field, ...(inputColors.field || {}) },
        other: { ...defaultColors.other, ...(inputColors.other || {}) },
        available_colors: inputColors.available_colors && inputColors.available_colors.length > 0 ? inputColors.available_colors : defaultColors.available_colors,
        background_color: inputColors.background_color || defaultColors.background_color,
        text_color: inputColors.text_color || defaultColors.text_color,
    };
    // const images = data.images || {}; // Not used in this chart

    const fillStyle = {
        typography: {
            labelFontFamily: effectiveTypography.label.font_family,
            labelFontSize: effectiveTypography.label.font_size,
            labelFontWeight: effectiveTypography.label.font_weight,
            annotationFontFamily: effectiveTypography.annotation.font_family,
            annotationFontSize: effectiveTypography.annotation.font_size,
            annotationFontWeight: effectiveTypography.annotation.font_weight,
        },
        chartBackground: effectiveColors.background_color,
        textColor: effectiveColors.text_color,
        primarySpanColor: effectiveColors.other.primary,
        gridLineColor: "rgba(255, 255, 255, 0.15)",
        legendMarkerStrokeColor: "white",
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        return tempText.getBBox().width;
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (Math.abs(value) >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (Math.abs(value) >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    const calculateFontSize = (text, maxWidth, baseFontSizePx, fontWeight, fontFamily) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let fontSize = baseFontSizePx;
        do {
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            if (ctx.measureText(text).width <= maxWidth) break;
            fontSize -= 0.5;
        } while (fontSize > 8);
        return fontSize;
    };

    const wrapText = (textElement, str, maxWidth, xPos) => {
        const words = str.toString().split(/\s+/).reverse();
        let currentLineWords = [];
        const lines = [];
        let word;
        const lineHeight = 1.1; // ems
        
        textElement.text(null); 

        while (word = words.pop()) {
            currentLineWords.push(word);
            const testLineText = currentLineWords.join(" ");
            textElement.text(testLineText); 
            if (textElement.node().getComputedTextLength() > maxWidth && currentLineWords.length > 1) {
                textElement.text(null); 
                currentLineWords.pop(); 
                lines.push(currentLineWords.join(" ")); 
                currentLineWords = [word]; 
            }
        }
        lines.push(currentLineWords.join(" ")); 
        
        textElement.text(null); 

        lines.forEach((l, i) => {
            textElement.append("tspan")
                .attr("x", xPos) 
                .attr("dy", (i === 0 ? 0 : lineHeight) + "em") 
                .text(l);
        });
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root-svg")
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = { top: (variables.hide_legend ? 20 : 90), right: 60, bottom: 80, left: 60 };

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const dimensions = [...new Set(chartDataArray.map(d => d[dimensionField]))];
    const groups = [...new Set(chartDataArray.map(d => d[groupField]))];

    if (groups.length !== 2) {
        const errorMsg = `Span chart requires exactly 2 groups for comparison. Found ${groups.length}: (${groups.join(', ')}). Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html("")
            .append("div").style("color", "red").style("font-family", "Arial, sans-serif").style("padding", "10px").html(errorMsg);
        return null;
    }
    
    const isDataComplete = dimensions.every(dim => {
        const dimensionData = chartDataArray.filter(d => d[dimensionField] === dim);
        const dimensionGroups = [...new Set(dimensionData.map(d => d[groupField]))];
        return dimensionGroups.length === groups.length;
    });

    if (!isDataComplete) {
        const errorMsg = 'Data is incomplete: each category (dimension) must have data for both groups. Cannot render span chart.';
        console.warn(errorMsg); // Warn as it might be partial data
         d3.select(containerSelector).html("")
            .append("div").style("color", "orange").style("font-family", "Arial, sans-serif").style("padding", "10px").html(errorMsg);
        return null;
    }

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerWidth])
        .padding(0.2);

    const allValues = chartDataArray.map(d => +d[valueField]).filter(v => !isNaN(v));
    const minValue = d3.min(allValues);
    const maxValue = d3.max(allValues);
    
    let yScaleDomainMin = minValue > 0 ? 0 : minValue * 1.15;
    let yScaleDomainMax = maxValue < 0 ? 0 : maxValue * 1.1;
    if (yScaleDomainMin === 0 && yScaleDomainMax === 0 && allValues.length > 0) { // All values are 0
        yScaleDomainMin = -1; yScaleDomainMax = 1; // Default range for all zeros
    }


    const yScale = d3.scaleLinear()
        .domain([yScaleDomainMin, yScaleDomainMax])
        .range([innerHeight, 0])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) =>
            (effectiveColors.field && effectiveColors.field[group]) ?
            effectiveColors.field[group] :
            (effectiveColors.available_colors[i % effectiveColors.available_colors.length])
        ));

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group chart-area");

    if (!variables.hide_legend) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend-group other");
        
        const legendItemHorzPadding = 15;
        const legendCircleRadius = 6;
        const legendCircleTextSpacing = 5;

        const legendItemsData = groups.map(group => {
            const textWidth = estimateTextWidth(group, {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            });
            const itemWidth = legendCircleRadius * 2 + legendCircleTextSpacing + textWidth;
            return { group, itemWidth };
        });

        const totalLegendWidth = d3.sum(legendItemsData, d => d.itemWidth) + Math.max(0, legendItemsData.length - 1) * legendItemHorzPadding;
        let currentXOffset = (containerWidth - totalLegendWidth) / 2;
        const legendYOffset = chartMargins.top / 2 - legendCircleRadius / 2; // Adjust for vertical centering

        legendItemsData.forEach((item) => {
            const legendItem = legendGroup.append("g")
                .attr("transform", `translate(${currentXOffset}, ${legendYOffset})`);

            legendItem.append("circle")
                .attr("cx", legendCircleRadius)
                .attr("cy", legendCircleRadius)
                .attr("r", legendCircleRadius)
                .attr("class", "mark legend-marker")
                .attr("fill", colorScale(item.group))
                .attr("stroke", fillStyle.legendMarkerStrokeColor)
                .attr("stroke-width", 1.2);

            legendItem.append("text")
                .attr("x", legendCircleRadius * 2 + legendCircleTextSpacing)
                .attr("y", legendCircleRadius)
                .attr("dy", "0.35em")
                .attr("class", "label legend-label")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(item.group);
            
            currentXOffset += item.itemWidth + legendItemHorzPadding;
        });
    }
    
    const yTicks = yScale.ticks(Math.max(2, Math.floor(innerHeight / 50))); // Dynamic number of ticks
    const yAxisGroup = mainChartGroup.append("g").attr("class", "axis y-axis");

    yAxisGroup.selectAll(".gridline")
        .data(yTicks)
        .enter().append("line")
        .attr("class", "gridline other")
        .attr("x1", 0)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("shape-rendering", "crispEdges");

    yAxisGroup.selectAll(".tick-value")
        .data(yTicks)
        .enter().append("text")
        .attr("class", "value tick-value label")
        .attr("x", -10)
        .attr("y", d => yScale(d))
        .attr("text-anchor", "end")
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => formatValue(d));

    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis-labels x-axis other")
        .attr("transform", `translate(0, ${innerHeight})`);

    const baseDimLabelFontSize = parseFloat(fillStyle.typography.labelFontSize) || 12;
    
    dimensions.forEach(dim => {
        const barW = xScale.bandwidth();
        const lblX = xScale(dim) + barW / 2;
        const maxLblW = barW * 0.95;

        const optimalFontSize = calculateFontSize(
            dim.toString(), maxLblW, baseDimLabelFontSize, 
            fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily
        );

        const labelTextElement = xAxisLabelsGroup.append("text")
            .attr("x", lblX)
            .attr("y", chartMargins.bottom * 0.35) // Position within bottom margin
            .attr("text-anchor", "middle")
            .attr("class", "label dimension-label")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${optimalFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(dim.toString());
        
        // Measure with applied optimal font size before deciding to wrap
        const currentLabelWidth = labelTextElement.node().getComputedTextLength();
        if (currentLabelWidth > maxLblW) {
            wrapText(labelTextElement, dim.toString(), maxLblW, lblX);
        }
    });

    // Block 8: Main Data Visualization Rendering
    const dataElementsGroup = mainChartGroup.append("g").attr("class", "data-elements mark");

    dimensions.forEach(dim => {
        const dimensionData = chartDataArray.filter(d => d[dimensionField] === dim);
        const barW = xScale.bandwidth();
        
        const pointData = groups.map(group => {
            const dataPoint = dimensionData.find(d => d[groupField] === group);
            const value = dataPoint ? parseFloat(dataPoint[valueField]) : NaN;
            return !isNaN(value) ? {
                group: group, value: value,
                x: xScale(dim), y: yScale(value)
            } : null;
        }).filter(d => d !== null);

        pointData.sort((a, b) => a.value - b.value);

        if (pointData.length === 2) {
            const startPoint = pointData[0];
            const endPoint = pointData[1];

            dataElementsGroup.append("rect")
                .attr("class", "mark span-bar")
                .attr("x", startPoint.x + barW * 0.25)
                .attr("y", endPoint.y) 
                .attr("width", barW * 0.5)
                .attr("height", Math.max(1, Math.abs(startPoint.y - endPoint.y))) // Min height 1px
                .attr("fill", fillStyle.primarySpanColor);

            pointData.forEach(point => {
                dataElementsGroup.append("circle")
                    .attr("class", "mark data-point")
                    .attr("cx", point.x + barW / 2)
                    .attr("cy", point.y)
                    .attr("r", Math.min(6, barW * 0.1)) // Responsive radius
                    .attr("fill", colorScale(point.group))
                    .attr("stroke", fillStyle.legendMarkerStrokeColor)
                    .attr("stroke-width", 1.5);
            });
            
            const valLabelBaseSize = parseFloat(fillStyle.typography.annotationFontSize) || 10;
            const valLabelFontSize = Math.min(16, Math.max(barW * 0.2, valLabelBaseSize));

            const yOffsetValueLabel = Math.min(10, barW * 0.15) + (Math.min(6, barW * 0.1)); // Offset from circle edge

            dataElementsGroup.append("text") // Lower value label
                .attr("class", "value data-label annotation")
                .attr("x", startPoint.x + barW / 2)
                .attr("y", startPoint.y + yOffsetValueLabel)
                .attr("dy", "0.35em") 
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${valLabelFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(formatValue(startPoint.value));

            dataElementsGroup.append("text") // Upper value label
                .attr("class", "value data-label annotation")
                .attr("x", endPoint.x + barW / 2)
                .attr("y", endPoint.y - yOffsetValueLabel)
                .attr("dy", "-0.1em") 
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${valLabelFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(formatValue(endPoint.value));
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None for this chart)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}