/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_12",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
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
    const imagesInput = data.images || {}; // Though not used in this chart, adhere to structure
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    if (!dimensionFieldConfig || !valueFieldConfig || !groupFieldConfig) {
        const missing = [
            !dimensionFieldConfig ? "x role" : null,
            !valueFieldConfig ? "y role" : null,
            !groupFieldConfig ? "group role" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: data columns for roles [${missing}] not found. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const dimensionFieldName = dimensionFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    const dimensionUnit = dimensionFieldConfig.unit !== "none" ? dimensionFieldConfig.unit : "";
    const valueUnit = valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";
    const groupUnit = groupFieldConfig.unit !== "none" ? groupFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || "Arial, sans-serif",
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || "12px",
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || "normal",
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || "Arial, sans-serif",
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || "10px",
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || "normal",
            groupLabelFontSize: "14px", // Specific for group labels at top
            groupLabelFontWeight: "bold", // Specific for group labels at top
        },
        colors: {
            textColor: colorsInput.text_color || "#333333",
            chartBackground: colorsInput.background_color || "#FFFFFF", // Not directly used on SVG, but good practice
            separatorLineColor: "#CCCCCC",
            defaultGroupColor1: (colorsInput.available_colors && colorsInput.available_colors[0]) || d3.schemeCategory10[0],
            defaultGroupColor2: (colorsInput.available_colors && colorsInput.available_colors[1]) || d3.schemeCategory10[1],
        },
        images: {} // Placeholder for image URLs if they were used
    };
    
    // Populate images from imagesInput (example structure, not used in this chart)
    if (imagesInput.field) {
        fillStyle.images.field = { ...imagesInput.field };
    }
    if (imagesInput.other) {
        fillStyle.images.other = { ...imagesInput.other };
    }


    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.visibility = 'hidden';
        svg.style.position = 'absolute';
        document.body.appendChild(svg); // Needs to be in DOM for getBBox, but hidden

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) {
            // Fallback or error logging if needed
            console.warn("Could not measure text width for:", text, e);
        }
        
        document.body.removeChild(svg);
        return width;
    };

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
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
        .style("background-color", fillStyle.colors.chartBackground); // Optional: apply background color

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 70, bottom: 40, left: 70 }; // Adjusted top margin for group labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const centerX = chartMargins.left + innerWidth / 2;

    // Block 5: Data Preprocessing & Transformation
    const allDimensions = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];

    if (groups.length < 2) {
        const errorMsg = "This chart requires at least two distinct groups. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const dimensions = [...allDimensions]; // Use original order
    const leftGroupName = groups[0];
    const rightGroupName = groups[1];

    fillStyle.colors.leftGroupColor = (colorsInput.field && colorsInput.field[leftGroupName]) || fillStyle.colors.defaultGroupColor1;
    fillStyle.colors.rightGroupColor = (colorsInput.field && colorsInput.field[rightGroupName]) || fillStyle.colors.defaultGroupColor2;

    const leftMax = d3.max(chartData.filter(d => d[groupFieldName] === leftGroupName), d => Math.abs(+d[valueFieldName])) || 0;
    const rightMax = d3.max(chartData.filter(d => d[groupFieldName] === rightGroupName), d => Math.abs(+d[valueFieldName])) || 0;
    const overallMax = Math.max(leftMax, rightMax);

    const maxVisualBars = 20; // Max number of small visual bars per side
    const valuePerVisualBar = overallMax > 0 ? Math.ceil(overallMax / maxVisualBars) : 1; // Avoid division by zero if overallMax is 0

    let maxDimLabelWidth = 0;
    dimensions.forEach(dim => {
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateTextWidth(formattedDim, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight));
    });
    const labelSidePadding = 15;
    const centerLabelAreaWidth = maxDimLabelWidth + labelSidePadding * 2;

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.2);

    const categoryBandHeight = yScale.bandwidth();
    const visualBarHeight = categoryBandHeight * 0.6; // Small bars are 60% of category height
    const visualBarWidth = 8; // Width of individual small bars
    const visualBarSpacing = 3; // Spacing between small bars

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const legendSquareSize = 12;
    const legendSpacing = 5;
    const legendYPos = chartMargins.top / 2; // Position legend in the top margin area

    const formattedLeftGroup = groupUnit ? `${leftGroupName}${groupUnit}` : `${leftGroupName}`;
    const leftGroupLabelWidth = estimateTextWidth(formattedLeftGroup, fillStyle.typography.labelFontFamily, fillStyle.typography.groupLabelFontSize, fillStyle.typography.groupLabelFontWeight);
    
    const formattedRightGroup = groupUnit ? `${rightGroupName}${groupUnit}` : `${rightGroupName}`;
    const rightGroupLabelWidth = estimateTextWidth(formattedRightGroup, fillStyle.typography.labelFontFamily, fillStyle.typography.groupLabelFontSize, fillStyle.typography.groupLabelFontWeight);

    const totalLegendWidth = legendSquareSize + legendSpacing + leftGroupLabelWidth + 40 + legendSquareSize + legendSpacing + rightGroupLabelWidth; // 40 is spacing between legends
    const legendStartX = centerX - totalLegendWidth / 2;

    const leftLegendGroup = svgRoot.append("g")
        .attr("class", "legend-group")
        .attr("transform", `translate(${legendStartX}, ${legendYPos})`);

    leftLegendGroup.append("rect")
        .attr("class", "mark legend-swatch")
        .attr("x", 0)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.colors.leftGroupColor);

    leftLegendGroup.append("text")
        .attr("class", "label legend-label")
        .attr("x", legendSquareSize + legendSpacing)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.groupLabelFontSize)
        .style("font-weight", fillStyle.typography.groupLabelFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(formattedLeftGroup);

    const rightLegendGroupX = legendStartX + legendSquareSize + legendSpacing + leftGroupLabelWidth + 40;
    const rightLegendGroup = svgRoot.append("g")
        .attr("class", "legend-group")
        .attr("transform", `translate(${rightLegendGroupX}, ${legendYPos})`);

    rightLegendGroup.append("rect")
        .attr("class", "mark legend-swatch")
        .attr("x", 0)
        .attr("y", -legendSquareSize / 2)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", fillStyle.colors.rightGroupColor);

    rightLegendGroup.append("text")
        .attr("class", "label legend-label")
        .attr("x", legendSquareSize + legendSpacing)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.groupLabelFontSize)
        .style("font-weight", fillStyle.typography.groupLabelFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(formattedRightGroup);

    // Center separator line
    svgRoot.append("line")
        .attr("class", "separator-line other")
        .attr("x1", centerX)
        .attr("y1", chartMargins.top)
        .attr("x2", centerX)
        .attr("y2", containerHeight - chartMargins.bottom)
        .attr("stroke", fillStyle.colors.separatorLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-area")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    dimensions.forEach((dimension) => {
        const yPos = yScale(dimension);
        const visualBarY = yPos + (categoryBandHeight - visualBarHeight) / 2;

        const leftDataPoint = chartData.find(d => d[dimensionFieldName] === dimension && d[groupFieldName] === leftGroupName);
        const rightDataPoint = chartData.find(d => d[dimensionFieldName] === dimension && d[groupFieldName] === rightGroupName);

        // Dimension Label (Category Label)
        const formattedDimension = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", innerWidth / 2)
            .attr("y", yPos + categoryBandHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(formattedDimension);

        // Left side visual bars
        if (leftDataPoint && leftDataPoint[valueFieldName] !== undefined) {
            const value = Math.abs(+leftDataPoint[valueFieldName]);
            const barCount = value > 0 ? Math.ceil(value / valuePerVisualBar) : 0;
            const leftStartX = innerWidth / 2 - centerLabelAreaWidth / 2;

            for (let j = 0; j < barCount; j++) {
                mainChartGroup.append("rect")
                    .attr("class", "mark data-bar left-bar")
                    .attr("x", leftStartX - (j + 1) * (visualBarWidth + visualBarSpacing))
                    .attr("y", visualBarY)
                    .attr("width", visualBarWidth)
                    .attr("height", visualBarHeight)
                    .attr("fill", fillStyle.colors.leftGroupColor)
                    .attr("rx", visualBarWidth / 2) // Pill shape
                    .attr("ry", visualBarWidth / 2);
            }

            const formattedVal = valueUnit ? `${formatValue(value)}${valueUnit}` : formatValue(value);
            const valueLabelX = leftStartX - barCount * (visualBarWidth + visualBarSpacing) - visualBarSpacing - 5; // 5 for padding
            mainChartGroup.append("text")
                .attr("class", "value data-label left-label")
                .attr("x", valueLabelX)
                .attr("y", yPos + categoryBandHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(formattedVal);
        }

        // Right side visual bars
        if (rightDataPoint && rightDataPoint[valueFieldName] !== undefined) {
            const value = Math.abs(+rightDataPoint[valueFieldName]);
            const barCount = value > 0 ? Math.ceil(value / valuePerVisualBar) : 0;
            const rightStartX = innerWidth / 2 + centerLabelAreaWidth / 2;

            for (let j = 0; j < barCount; j++) {
                mainChartGroup.append("rect")
                    .attr("class", "mark data-bar right-bar")
                    .attr("x", rightStartX + j * (visualBarWidth + visualBarSpacing))
                    .attr("y", visualBarY)
                    .attr("width", visualBarWidth)
                    .attr("height", visualBarHeight)
                    .attr("fill", fillStyle.colors.rightGroupColor)
                    .attr("rx", visualBarWidth / 2) // Pill shape
                    .attr("ry", visualBarWidth / 2);
            }

            const formattedVal = valueUnit ? `${formatValue(value)}${valueUnit}` : formatValue(value);
            const valueLabelX = rightStartX + barCount * (visualBarWidth + visualBarSpacing) + visualBarSpacing + 5; // 5 for padding
            mainChartGroup.append("text")
                .attr("class", "value data-label right-label")
                .attr("x", valueLabelX)
                .attr("y", yPos + categoryBandHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(formattedVal);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}