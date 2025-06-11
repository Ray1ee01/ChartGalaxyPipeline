/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Group Bar Chart",
  "chart_name": "vertical_group_bar_chart_7",
  "is_composite": false,
  "required_fields": ["x", "y", "group", "group2"],
  "hierarchy": ["x", "group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"], ["categorical"]],
  "required_fields_range": [
    [2, 20],
    [0, "inf"],
    [2, 2],
    [2, 2]
  ],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via colors_dark
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const group1Column = dataColumns.find(col => col.role === "group");
    const group2Column =  dataColumns.find(col => col.role === "group2");

    const missingFields = [];
    if (!xColumn) missingFields.push("x field (role: 'x')");
    if (!yColumn) missingFields.push("y field (role: 'y')");
    if (!group1Column) missingFields.push("group field (role: 'group')");
    if (!group2Column) missingFields.push("group2 field (role: 'group2')");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xColumn.name;
    const yFieldName = yColumn.name;
    const group1FieldName = group1Column.name;
    const group2FieldName = group2Column.name;
    const yFieldUnit = (yColumn.unit && yColumn.unit !== "none") ? yColumn.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyInput.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyInput.title?.font_size || '16px',
            titleFontWeight: typographyInput.title?.font_weight || 'bold',
            labelFontFamily: typographyInput.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyInput.label?.font_size || '12px',
            labelFontWeight: typographyInput.label?.font_weight || 'normal',
            annotationFontFamily: typographyInput.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyInput.annotation?.font_size || '10px',
            annotationFontWeight: typographyInput.annotation?.font_weight || 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF', // Not used directly on SVG, but available
        separatorColor: '#d3d3d3', // Default, not typically in colorsInput
        defaultCategoryColors: d3.schemeCategory10,
    };

    fillStyle.getColor = (categoryValue, index) => {
        if (colorsInput.field && colorsInput.field[categoryValue]) {
            return colorsInput.field[categoryValue];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[index % colorsInput.available_colors.length];
        }
        return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
    };
    
    function estimateTextWidth(text, fontSize, fontWeight, fontFamily) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but trying to adhere to "MUST NOT be appended to the document DOM".
        // For simple cases, this might work, but can be inaccurate.
        // A more robust in-memory approach might involve a canvas if SVG getBBox without DOM is tricky.
        // However, the original used canvas, and the prompt asks for in-memory SVG.
        // Let's assume a basic getBBox on an unattached element is sufficient for this context.
        // If not, this is a known limitation of not attaching to DOM.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements fails (e.g. JSDOM without layout)
            // This is a rough approximation.
            const avgCharWidth = parseFloat(fontSize) * 0.6;
            return String(text).length * avgCharWidth;
        }
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    function wrapText(textElement, text, maxWidth, x, y, fontSize, fontWeight, fontFamily) {
        textElement.each(function() {
            const self = d3.select(this);
            self.text(null); // Clear existing content

            let words = String(text).split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const lineHeight = 1.1; // ems
            let tspan = self.append("tspan").attr("x", x).attr("y", y).attr("dy", `${lineNumber * lineHeight}em`);

            if (estimateTextWidth(text, parseFloat(fontSize), fontWeight, fontFamily) <= maxWidth) {
                tspan.text(text);
                return;
            }
            
            let linesRendered = 0;
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (estimateTextWidth(line.join(" "), parseFloat(fontSize), fontWeight, fontFamily) > maxWidth && line.length > 1) {
                    if (linesRendered >= 1) { // Max 2 lines
                        line.pop();
                        tspan.text(line.join(" ") + "..."); // Add ellipsis if truncated
                        words = []; // Stop processing
                        break;
                    }
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    lineNumber++;
                    linesRendered++;
                    tspan = self.append("tspan").attr("x", x).attr("y", y).attr("dy", `${lineNumber * lineHeight}em`).text(word);
                }
            }
        });
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    const defs = svgRoot.append("defs");
    const patternSize = 8;
    const pattern = defs.append("pattern")
        .attr("id", "refactored-diagonal-stripe-pattern")
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", patternSize)
        .attr("height", patternSize)
        .attr("patternTransform", "rotate(-45)");

    pattern.append("rect")
           .attr("width", patternSize)
           .attr("height", patternSize)
           .attr("fill", "none");

    pattern.append("line")
           .attr("x1", 0)
           .attr("y1", patternSize / 2)
           .attr("x2", patternSize)
           .attr("y2", patternSize / 2)
           .attr("stroke", "#FFFFFF")
           .attr("stroke-width", 1.5);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 40, bottom: 100, left: 40 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const xValues = [...new Set(chartDataInput.map(d => d[xFieldName]))];
    const group1Values = [...new Set(chartDataInput.map(d => d[group1FieldName]))];
    const group2Values = [...new Set(chartDataInput.map(d => d[group2FieldName]))];

    if (group2Values.length !== 2) {
        const errorMsg = `Expected exactly 2 unique values for group2 field ('${group2FieldName}'), found ${group2Values.length}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }
    const primaryMetricName = group2Values[0];
    const secondaryMetricName = group2Values[1];

    const processedData = {};
    chartDataInput.forEach(d => {
        const xVal = d[xFieldName];
        const g1Val = d[group1FieldName];
        const g2Val = d[group2FieldName];
        const yVal = +d[yFieldName] || 0;

        if (!processedData[xVal]) processedData[xVal] = {};
        if (!processedData[xVal][g1Val]) processedData[xVal][g1Val] = { primaryValue: 0, secondaryRate: 0, overlayValue: 0 };

        if (g2Val === primaryMetricName) processedData[xVal][g1Val].primaryValue = yVal;
        else if (g2Val === secondaryMetricName) processedData[xVal][g1Val].secondaryRate = yVal;
    });

    Object.values(processedData).forEach(xGroup => {
        Object.values(xGroup).forEach(groupData => {
            groupData.overlayValue = groupData.primaryValue * (groupData.secondaryRate / 100);
        });
    });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.25);

    const group1Scale = d3.scaleBand()
        .domain(group1Values)
        .range([0, xScale.bandwidth()])
        .padding(0.1); // Fixed padding

    const yMax = d3.max(chartDataInput, d => (d[group2FieldName] === primaryMetricName) ? (+d[yFieldName] || 0) : 0) * 1.1 || 100;
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerHeight, 0])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(group1Values)
        .range(group1Values.map((g1, i) => fillStyle.getColor(g1, i)));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Legend
    const legendY = chartMargins.top / 4 * 3;
    const legendSquareSize = 12;
    const legendPadding = 25;
    const legendItemPadding = 8;

    if (group1Values.length < 2) {
        console.warn("Legend style expects at least 2 group1 values for colors. Using defaults if necessary.");
    }
    const legendG1Color1 = colorScale(group1Values[0]);
    const legendG1Color2 = colorScale(group1Values[1] || group1Values[0]); // Fallback for second color

    const legendFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const legendFontWeight = fillStyle.typography.labelFontWeight;
    const legendFontFamily = fillStyle.typography.labelFontFamily;

    const metric1NameWidth = estimateTextWidth(primaryMetricName, legendFontSize, legendFontWeight, legendFontFamily);
    const metric2NameWidth = estimateTextWidth(secondaryMetricName, legendFontSize, legendFontWeight, legendFontFamily);
    const totalLegendWidth = (legendSquareSize + legendItemPadding + metric1NameWidth) +
                           legendPadding +
                           (legendSquareSize + legendItemPadding + metric2NameWidth);
    const legendStartX = chartMargins.left + (innerWidth - totalLegendWidth) / 2;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend other")
        .attr("transform", `translate(${legendStartX}, ${legendY})`);

    let currentXLegend = 0;

    const swatch1 = legendGroup.append("g")
        .attr("class", "legend-swatch other")
        .attr("transform", `translate(${currentXLegend}, ${-legendSquareSize / 2})`);
    swatch1.append("path").attr("d", `M0,0 L${legendSquareSize},0 L0,${legendSquareSize} Z`).attr("fill", legendG1Color1).attr("class", "mark");
    swatch1.append("path").attr("d", `M${legendSquareSize},${legendSquareSize} L0,${legendSquareSize} L${legendSquareSize},0 Z`).attr("fill", legendG1Color2).attr("class", "mark");
    currentXLegend += legendSquareSize + legendItemPadding;

    legendGroup.append("text")
        .attr("class", "label legend-label text")
        .attr("x", currentXLegend)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFontFamily)
        .style("font-size", `${legendFontSize}px`)
        .style("font-weight", legendFontWeight)
        .style("fill", fillStyle.textColor)
        .text(primaryMetricName);
    currentXLegend += metric1NameWidth + legendPadding;

    const swatch2 = legendGroup.append("g")
        .attr("class", "legend-swatch other")
        .attr("transform", `translate(${currentXLegend}, ${-legendSquareSize / 2})`);
    swatch2.append("path").attr("d", `M0,0 L${legendSquareSize},0 L0,${legendSquareSize} Z`).attr("fill", legendG1Color1).attr("class", "mark");
    swatch2.append("path").attr("d", `M${legendSquareSize},${legendSquareSize} L0,${legendSquareSize} L${legendSquareSize},0 Z`).attr("fill", legendG1Color2).attr("class", "mark");
    swatch2.append("rect")
        .attr("class", "mark overlay")
        .attr("x", 0).attr("y", 0).attr("width", legendSquareSize).attr("height", legendSquareSize)
        .attr("fill", "url(#refactored-diagonal-stripe-pattern)");
    currentXLegend += legendSquareSize + legendItemPadding;

    legendGroup.append("text")
        .attr("class", "label legend-label text")
        .attr("x", currentXLegend)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFontFamily)
        .style("font-size", `${legendFontSize}px`)
        .style("font-weight", legendFontWeight)
        .style("fill", fillStyle.textColor)
        .text(secondaryMetricName);

    // Separator Lines
    mainChartGroup.append("line")
        .attr("class", "separator-line other")
        .attr("x1", 0).attr("y1", innerHeight)
        .attr("x2", innerWidth).attr("y2", innerHeight)
        .attr("stroke", fillStyle.separatorColor).attr("stroke-width", 1);

    const yLine2 = innerHeight + 30;
    mainChartGroup.append("line")
        .attr("class", "separator-line other")
        .attr("x1", 0).attr("y1", yLine2)
        .attr("x2", innerWidth).attr("y2", yLine2)
        .attr("stroke", fillStyle.separatorColor).attr("stroke-width", 1);
    
    const iconPaddingTop = 35; // Used for vertical line end calculation
    const maxIconSizeForLayout = d3.max(xValues, () => xScale.bandwidth() * 0.6) || 24;
    const verticalLineStartY = yLine2;
    const verticalLineEndY = innerHeight + iconPaddingTop + maxIconSizeForLayout + 10;

    for (let i = 0; i < xValues.length - 1; i++) {
        const xSeparator = xScale(xValues[i]) + xScale.bandwidth() + xScale.paddingInner() * xScale.step() / 2;
        mainChartGroup.append("line")
            .attr("class", "separator-line other")
            .attr("x1", xSeparator).attr("y1", verticalLineStartY)
            .attr("x2", xSeparator).attr("y2", verticalLineEndY)
            .attr("stroke", fillStyle.separatorColor).attr("stroke-width", 1);
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(xValues)
        .enter()
        .append("g")
        .attr("class", d => `bar-group other x-${String(d).replace(/\s+/g, '-')}`) // Add class based on xValue
        .attr("transform", d => `translate(${xScale(d)}, 0)`);

    const baseFontSizeAnnotationNum = parseFloat(fillStyle.typography.annotationFontSize);
    const baseFontSizeLabelNum = parseFloat(fillStyle.typography.labelFontSize);
    const minFontSize = 4;
    
    barGroups.each(function(xValue) {
        const groupG = d3.select(this);
        
        // Pre-calculate font sizes for this x-group if needed (original did it globally)
        // For simplicity, using fixed calculation from original, can be refined if too slow
        let minPrimaryLabelRatio = 1.0;
        let minSecondaryLabelRatio = 1.0;
        let minGroup1LabelRatio = 1.0;
        const maxValLabelWidth = group1Scale.bandwidth() * 1.1;
        const maxGroup1LabelWidth = group1Scale.bandwidth();

        group1Values.forEach(group1Value => {
            const groupData = processedData[xValue]?.[group1Value];
            if (!groupData) return;

            const primaryText = formatValue(groupData.primaryValue) + (yFieldUnit ? ` ${yFieldUnit}` : '');
            let width = estimateTextWidth(primaryText, baseFontSizeAnnotationNum, fillStyle.typography.annotationFontWeight, fillStyle.typography.annotationFontFamily);
            if (width > maxValLabelWidth) minPrimaryLabelRatio = Math.min(minPrimaryLabelRatio, maxValLabelWidth / width);
            
            const secondaryText = formatValue(groupData.secondaryRate) + (yFieldUnit ? ` ${yFieldUnit}` : '');
            width = estimateTextWidth(secondaryText, baseFontSizeAnnotationNum, fillStyle.typography.annotationFontWeight, fillStyle.typography.annotationFontFamily);
            if (width > maxValLabelWidth) minSecondaryLabelRatio = Math.min(minSecondaryLabelRatio, maxValLabelWidth / width);

            const group1Text = String(group1Value);
            width = estimateTextWidth(group1Text, baseFontSizeLabelNum, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
            if (width > maxGroup1LabelWidth) minGroup1LabelRatio = Math.min(minGroup1LabelRatio, maxGroup1LabelWidth / width);
        });

        const finalPrimaryFontSize = Math.max(minFontSize, baseFontSizeAnnotationNum * minPrimaryLabelRatio);
        const finalSecondaryFontSize = Math.max(minFontSize, baseFontSizeAnnotationNum * minSecondaryLabelRatio);
        const finalGroup1FontSize = Math.max(minFontSize, baseFontSizeLabelNum * minGroup1LabelRatio);


        group1Values.forEach(group1Value => {
            const groupData = processedData[xValue]?.[group1Value];
            if (!groupData) return;

            const barX = group1Scale(group1Value);
            const barWidth = group1Scale.bandwidth();
            const barColor = colorScale(group1Value);
            const centerX = barX + barWidth / 2;

            // Main bar
            const primaryY = yScale(groupData.primaryValue);
            const primaryHeight = innerHeight - primaryY;
            if (primaryHeight > 0) {
                groupG.append("rect")
                    .attr("class", "mark value main-bar")
                    .attr("x", barX).attr("y", primaryY)
                    .attr("width", barWidth).attr("height", primaryHeight)
                    .attr("fill", barColor);
            }

            // Overlay bar
            const overlayY = yScale(groupData.overlayValue);
            const overlayHeight = innerHeight - overlayY;
            if (overlayHeight > 0) {
                groupG.append("rect") // Base for pattern
                    .attr("class", "mark value overlay-base")
                    .attr("x", barX).attr("y", overlayY)
                    .attr("width", barWidth).attr("height", overlayHeight)
                    .attr("fill", barColor);
                groupG.append("rect") // Pattern
                    .attr("class", "mark value overlay-pattern")
                    .attr("x", barX).attr("y", overlayY)
                    .attr("width", barWidth).attr("height", overlayHeight)
                    .attr("fill", "url(#refactored-diagonal-stripe-pattern)");
            }

            // Primary value label
            if (groupData.primaryValue > 0) {
                groupG.append("text")
                    .attr("class", "label value-label primary-label text")
                    .attr("x", centerX).attr("y", primaryY - 5)
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${finalPrimaryFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formatValue(groupData.primaryValue) + (yFieldUnit ? ` ${yFieldUnit}` : ''));
            }

            // Secondary rate label (overlay)
            if (groupData.overlayValue > 0 && groupData.secondaryRate > 0) {
                const labelText = groupData.secondaryRate.toFixed(1) + yFieldUnit;
                const labelHeight = finalSecondaryFontSize * 1.4;
                const textWidth = estimateTextWidth(labelText, finalSecondaryFontSize, fillStyle.typography.annotationFontWeight, fillStyle.typography.annotationFontFamily);
                const labelRectWidth = Math.min(barWidth * 0.9, textWidth + 8);
                const labelBgWidth = barWidth * 1.05;
                const labelBgX = centerX - labelBgWidth / 2;
                const labelRectY = overlayY + (innerHeight - overlayY) * 0.2;

                groupG.append("rect")
                    .attr("class", "label-bg other secondary-label-bg")
                    .attr("x", labelBgX).attr("y", labelRectY - labelHeight / 2)
                    .attr("width", labelBgWidth).attr("height", labelHeight)
                    .attr("fill", barColor).attr("rx", 3).attr("ry", 3);

                groupG.append("text")
                    .attr("class", "label value-label secondary-label text")
                    .attr("x", centerX).attr("y", labelRectY)
                    .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${finalSecondaryFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", "#FFFFFF") // White text on colored background
                    .text(labelText);
            }
            
            // Group1 label (e.g., Year)
            const group1LabelY = innerHeight + 15;
            const group1Text = String(group1Value);
            const group1LabelElement = groupG.append("text")
                .attr("class", "label group1-label text")
                // x, y, dy are set by wrapText
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${finalGroup1FontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor);
            
            group1LabelElement.call(wrapText, group1Text, maxGroup1LabelWidth, centerX, group1LabelY, finalGroup1FontSize, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    barGroups.each(function(xValue) {
        const groupG = d3.select(this);
        const iconUrl = imagesInput.field?.[xValue];
        const iconSize = xScale.bandwidth() * 0.6;
        const iconY = innerHeight + iconPaddingTop; // Position below group1 labels

        if (iconUrl && iconSize > 10) {
            const iconX = xScale.bandwidth() / 2 - iconSize / 2; // Center icon within the x-group's bandwidth
            groupG.append("image")
                .attr("class", "icon image x-icon")
                .attr("x", iconX)
                .attr("y", iconY)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", iconUrl)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}