/* REQUIREMENTS_BEGIN
{
  "chart_type": "Diverging Bar Chart",
  "chart_name": "diverging_bar_plain_chart_06",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    // const imagesInput = data.images || {}; // Not used in this chart
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    if (!dimensionFieldDef || !valueFieldDef || !groupFieldDef) {
        const missing = [
            !dimensionFieldDef ? "x role" : null,
            !valueFieldDef ? "y role" : null,
            !groupFieldDef ? "group role" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: column definitions for roles [${missing}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const dimensionFieldName = dimensionFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const groupFieldName = groupFieldDef.name;

    const dimensionUnit = dimensionFieldDef.unit !== "none" ? dimensionFieldDef.unit : "";
    const valueUnit = valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";
    // const groupUnit = groupFieldDef.unit !== "none" ? groupFieldDef.unit : ""; // Not used for group labels in this version

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
            legendFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif', // Using label for legend
            legendFontSize: '14px', // As per original
            legendFontWeight: 'bold', // As per original
        },
        textColor: colorsInput.text_color || '#333333',
        axisLineColor: '#CCCCCC',
        groupColors: {}, // To be populated in Block 5 after groups are known
        defaultGroupColors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'] // Fallback if not enough in colorsInput
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.visibility = 'hidden';
        svg.style.position = 'absolute';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Document body append/remove is not strictly necessary for getBBox if styles are inline,
        // but some browsers might be more consistent if it's briefly in the DOM.
        // However, per spec, it should work without being in DOM.
        // For safety and to avoid DOM manipulation:
        // document.body.appendChild(svg);
        const width = textElement.getBBox().width;
        // document.body.removeChild(svg);
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("class", "chart-root");

    const chartMargins = { top: 80, right: 70, bottom: 40, left: 70 }; // Adjusted top margin for legend

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const uniqueDimensionNames = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    const groupNames = [...new Set(chartData.map(d => d[groupFieldName]))];

    if (groupNames.length < 2) {
        const errorMsg = "Diverging bar chart requires at least two groups. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    const leftGroupName = groupNames[0];
    const rightGroupName = groupNames[1];

    // Populate fillStyle.groupColors
    fillStyle.groupColors[leftGroupName] = (colorsInput.field && colorsInput.field[leftGroupName]) ||
                                       (colorsInput.available_colors && colorsInput.available_colors[0]) ||
                                       (colorsInput.other && colorsInput.other.primary) ||
                                       fillStyle.defaultGroupColors[0];
    fillStyle.groupColors[rightGroupName] = (colorsInput.field && colorsInput.field[rightGroupName]) ||
                                        (colorsInput.available_colors && colorsInput.available_colors[1]) ||
                                        (colorsInput.other && colorsInput.other.secondary) ||
                                        fillStyle.defaultGroupColors[1];


    const leftMax = d3.max(chartData.filter(d => d[groupFieldName] === leftGroupName), d => Math.abs(+d[valueFieldName])) || 0;
    const rightMax = d3.max(chartData.filter(d => d[groupFieldName] === rightGroupName), d => Math.abs(+d[valueFieldName])) || 0;
    const overallMax = Math.max(leftMax, rightMax);

    const maxUnitBars = 20;
    const valuePerUnitBar = overallMax > 0 ? Math.ceil(overallMax / maxUnitBars) : 1; // Avoid division by zero if overallMax is 0

    let maxDimensionLabelWidth = 0;
    uniqueDimensionNames.forEach(dimName => {
        const formattedDimName = dimensionUnit ? `${dimName}${dimensionUnit}` : `${dimName}`;
        const width = estimateTextWidth(formattedDimName, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, width);
    });
    const dimensionLabelSidePadding = 15;
    const centerDimensionLabelAreaWidth = maxDimensionLabelWidth + dimensionLabelSidePadding * 2;

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(uniqueDimensionNames)
        .range([0, innerHeight])
        .padding(0.2);

    const categoryBandHeight = yScale.bandwidth();
    const unitBarHeight = categoryBandHeight * 0.6; // Bars take 60% of band height
    const unitBarYOffset = (categoryBandHeight - unitBarHeight) / 2; // For vertical centering

    const unitBarWidth = 8;
    const unitBarSpacing = 3;

    const valueToBarCount = (value) => {
        if (valuePerUnitBar === 0) return 0; // Should not happen with new check
        return Math.min(maxUnitBars, Math.ceil(Math.abs(value) / valuePerUnitBar));
    };

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Central dividing line
    mainChartGroup.append("line")
        .attr("x1", innerWidth / 2)
        .attr("y1", 0)
        .attr("x2", innerWidth / 2)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3")
        .attr("class", "axis dividing-line");

    // Legend (Group Labels at top)
    const legendSquareSize = 12;
    const legendSpacing = 5;
    const legendYPosition = -chartMargins.top / 2; // Position above the main chart area

    const leftLegendText = leftGroupName; // Assuming no group unit for legend text for simplicity
    const rightLegendText = rightGroupName;

    const leftLegendTextWidth = estimateTextWidth(leftLegendText, fillStyle.typography.legendFontFamily, fillStyle.typography.legendFontSize, fillStyle.typography.legendFontWeight);
    // const rightLegendTextWidth = estimateTextWidth(rightLegendText, fillStyle.typography.legendFontFamily, fillStyle.typography.legendFontSize, fillStyle.typography.legendFontWeight); // Not used for positioning

    const legendGroup = svgRoot.append("g") // Append to svgRoot, position relative to it
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`); // Use main chart group's translation for consistency

    const legendLeftX = innerWidth / 2 - centerDimensionLabelAreaWidth / 2 - leftLegendTextWidth - legendSquareSize - legendSpacing - 20; // Adjusted for more space
    const legendRightX = innerWidth / 2 + centerDimensionLabelAreaWidth / 2 + 20;

    legendGroup.append("rect")
        .attr("x", legendLeftX)
        .attr("y", legendYPosition - legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.groupColors[leftGroupName])
        .attr("class", "mark legend-mark");

    legendGroup.append("text")
        .attr("x", legendLeftX + legendSquareSize + legendSpacing)
        .attr("y", legendYPosition)
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.legendFontFamily)
        .style("font-size", fillStyle.typography.legendFontSize)
        .style("font-weight", fillStyle.typography.legendFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label legend-label")
        .text(leftLegendText);

    legendGroup.append("rect")
        .attr("x", legendRightX)
        .attr("y", legendYPosition - legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.groupColors[rightGroupName])
        .attr("class", "mark legend-mark");

    legendGroup.append("text")
        .attr("x", legendRightX + legendSquareSize + legendSpacing)
        .attr("y", legendYPosition)
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.legendFontFamily)
        .style("font-size", fillStyle.typography.legendFontSize)
        .style("font-weight", fillStyle.typography.legendFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label legend-label")
        .text(rightLegendText);

    // Block 8: Main Data Visualization Rendering
    uniqueDimensionNames.forEach((dimName) => {
        const yPos = yScale(dimName);
        const barEffectiveY = yPos + unitBarYOffset;

        // Dimension Label in the center
        const formattedDimName = dimensionUnit ? `${dimName}${dimensionUnit}` : `${dimName}`;
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", yPos + categoryBandHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "label dimension-label")
            .text(formattedDimName);

        const leftDataItem = chartData.find(d => d[dimensionFieldName] === dimName && d[groupFieldName] === leftGroupName);
        const rightDataItem = chartData.find(d => d[dimensionFieldName] === dimName && d[groupFieldName] === rightGroupName);

        // Left side bars and value label
        if (leftDataItem && leftDataItem[valueFieldName] !== undefined) {
            const value = Math.abs(+leftDataItem[valueFieldName]);
            const numBars = valueToBarCount(value);
            const barStartX = innerWidth / 2 - centerDimensionLabelAreaWidth / 2;

            for (let i = 0; i < numBars; i++) {
                mainChartGroup.append("rect")
                    .attr("x", barStartX - (i + 1) * (unitBarWidth + unitBarSpacing) + unitBarSpacing) // Adjusted to align edge of first bar
                    .attr("y", barEffectiveY)
                    .attr("width", unitBarWidth)
                    .attr("height", unitBarHeight)
                    .attr("fill", fillStyle.groupColors[leftGroupName])
                    .attr("class", "mark value-bar left-bar");
            }

            const formattedVal = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
            const valueLabelX = barStartX - numBars * (unitBarWidth + unitBarSpacing) - 5; // 5px padding
             mainChartGroup.append("text")
                .attr("x", valueLabelX)
                .attr("y", yPos + categoryBandHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .attr("class", "label value-label left-value")
                .text(formattedVal);
        }

        // Right side bars and value label
        if (rightDataItem && rightDataItem[valueFieldName] !== undefined) {
            const value = Math.abs(+rightDataItem[valueFieldName]);
            const numBars = valueToBarCount(value);
            const barStartX = innerWidth / 2 + centerDimensionLabelAreaWidth / 2;

            for (let i = 0; i < numBars; i++) {
                mainChartGroup.append("rect")
                    .attr("x", barStartX + i * (unitBarWidth + unitBarSpacing))
                    .attr("y", barEffectiveY)
                    .attr("width", unitBarWidth)
                    .attr("height", unitBarHeight)
                    .attr("fill", fillStyle.groupColors[rightGroupName])
                    .attr("class", "mark value-bar right-bar");
            }
            
            const formattedVal = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
            const valueLabelX = barStartX + numBars * (unitBarWidth + unitBarSpacing) + 5; // 5px padding
            mainChartGroup.append("text")
                .attr("x", valueLabelX)
                .attr("y", yPos + categoryBandHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .attr("class", "label value-label right-value")
                .text(formattedVal);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}