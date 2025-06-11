/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_05",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [-Infinity, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // data.colors_dark could be handled here if a theme switch was present
    const images = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const dimensionFieldName = dimensionFieldConfig ? dimensionFieldConfig.name : undefined;
    const valueFieldName = valueFieldConfig ? valueFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    if (!dimensionFieldName || !valueFieldName || !groupFieldName) {
        let missingFields = [];
        if (!dimensionFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        if (!groupFieldName) missingFields.push("group role field");
        
        const errorMessage = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#333333',
        chartBackground: colors.background_color || '#FFFFFF',
        groupColors: {},
        defaultGroupColor: '#CCCCCC',
    };

    const uniqueGroups = [...new Set(chartData.map(d => d[groupFieldName]))];
    uniqueGroups.forEach((group, i) => {
        if (colors.field && colors.field[groupFieldName] && colors.field[groupFieldName][group]) {
            fillStyle.groupColors[group] = colors.field[groupFieldName][group];
        } else if (colors.available_colors && colors.available_colors.length > 0) {
            fillStyle.groupColors[group] = colors.available_colors[i % colors.available_colors.length];
        } else {
            fillStyle.groupColors[group] = d3.schemeCategory10[i % d3.schemeCategory10.length]; // Fallback to d3 scheme
        }
    });
    if (uniqueGroups.length > 0 && colors.other && colors.other.primary && !fillStyle.groupColors[uniqueGroups[0]]) {
         fillStyle.groupColors[uniqueGroups[0]] = colors.other.primary; // Use primary for first group if specific not set
    }
     if (uniqueGroups.length > 1 && colors.other && colors.other.secondary && !fillStyle.groupColors[uniqueGroups[1]]) {
         fillStyle.groupColors[uniqueGroups[1]] = colors.other.secondary; // Use secondary for second group
    }


    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        svg.style.width = '0px';
        svg.style.height = '0px';
        // No need to append to DOM for getBBox if text element is created correctly with styles
        // document.body.appendChild(svg); // Not strictly necessary for getBBox on a text element

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.fontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Appending to body and then removing is more robust for complex cases, but for simple text, direct creation is often enough.
        // For full robustness if issues arise:
        // document.body.appendChild(svg);
        // const width = textElement.getBBox().width;
        // document.body.removeChild(svg);
        // return width;
        // Simpler approach if direct creation works (often does):
        return textElement.getBBox().width;
    }

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
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 70, bottom: 40, left: 70 }; // Adjusted top margin for group labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const legendSquareSize = 12;
    const legendSpacing = 5;

    // Block 5: Data Preprocessing & Transformation
    const allDimensionValues = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    const groupValues = [...new Set(chartData.map(d => d[groupFieldName]))];

    // Use original order of dimensions
    const dimensions = allDimensionValues;

    const leftGroup = groupValues[0];
    const rightGroup = groupValues[1]; // Assumes at least two groups as per requirements

    const dimensionUnit = dimensionFieldConfig.unit !== "none" ? dimensionFieldConfig.unit : "";
    const valueUnit = valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";
    const groupUnit = groupFieldConfig.unit !== "none" ? groupFieldConfig.unit : "";

    let maxDimLabelWidth = 0;
    dimensions.forEach(dim => {
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const width = estimateTextWidth(formattedDim, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (width > maxDimLabelWidth) {
            maxDimLabelWidth = width;
        }
    });
    const dimensionLabelWidth = Math.max(maxDimLabelWidth + 10, 80); // Add padding, min 80px

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.3); // Fixed padding

    const maxLeftValue = d3.max(chartData.filter(d => d[groupFieldName] === leftGroup), d => Math.abs(d[valueFieldName])) || 0;
    const maxRightValue = d3.max(chartData.filter(d => d[groupFieldName] === rightGroup), d => Math.abs(d[valueFieldName])) || 0;
    
    const barAreaWidth = (innerWidth - dimensionLabelWidth) / 2;

    const leftXScale = d3.scaleLinear()
        .domain([0, maxLeftValue])
        .range([barAreaWidth, 0]); // Bars grow from center to left

    const rightXScale = d3.scaleLinear()
        .domain([0, maxRightValue])
        .range([0, barAreaWidth]); // Bars grow from center to right

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Group Labels (Legend)
    const formattedLeftGroup = groupUnit ? `${leftGroup}${groupUnit}` : `${leftGroup}`;
    const formattedRightGroup = groupUnit ? `${rightGroup}${groupUnit}` : `${rightGroup}`;

    const leftGroupLabelWidth = estimateTextWidth(formattedLeftGroup, {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight // Using label font for consistency
    });
    const rightGroupLabelWidth = estimateTextWidth(formattedRightGroup, {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    });

    const leftLegendGroup = svgRoot.append("g") // Append to svgRoot to place above mainChartGroup
        .attr("class", "legend-group left")
        .attr("transform", `translate(${chartMargins.left + barAreaWidth / 2 - (leftGroupLabelWidth + legendSquareSize + legendSpacing) / 2}, ${chartMargins.top / 2})`);

    leftLegendGroup.append("rect")
        .attr("class", "legend mark")
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("y", -legendSquareSize / 2)
        .style("fill", fillStyle.groupColors[leftGroup] || fillStyle.defaultGroupColor);

    leftLegendGroup.append("text")
        .attr("class", "legend label")
        .attr("x", legendSquareSize + legendSpacing)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedLeftGroup);

    const rightLegendGroup = svgRoot.append("g") // Append to svgRoot
        .attr("class", "legend-group right")
        .attr("transform", `translate(${chartMargins.left + barAreaWidth + dimensionLabelWidth + barAreaWidth / 2 - (rightGroupLabelWidth + legendSquareSize + legendSpacing) / 2}, ${chartMargins.top / 2})`);

    rightLegendGroup.append("rect")
        .attr("class", "legend mark")
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("y", -legendSquareSize / 2)
        .style("fill", fillStyle.groupColors[rightGroup] || fillStyle.defaultGroupColor);

    rightLegendGroup.append("text")
        .attr("class", "legend label")
        .attr("x", legendSquareSize + legendSpacing)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedRightGroup);

    // Dimension Labels (Centered)
    dimensions.forEach(dim => {
        const yPos = yScale(dim) + yScale.bandwidth() / 2;
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        
        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", barAreaWidth + dimensionLabelWidth / 2) // Center of the dimension label area
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(formattedDim);
    });

    // Block 8: Main Data Visualization Rendering
    // Left Bars
    dimensions.forEach(dim => {
        const dataPoint = chartData.find(d => d[dimensionFieldName] === dim && d[groupFieldName] === leftGroup);
        if (dataPoint) {
            const value = Math.abs(dataPoint[valueFieldName]); // Diverging can have negative, but width is positive
            const barWidth = barAreaWidth - leftXScale(value);
            const yPos = yScale(dim);

            mainChartGroup.append("rect")
                .attr("class", "mark bar left-bar")
                .attr("x", leftXScale(value))
                .attr("y", yPos)
                .attr("width", barWidth)
                .attr("height", yScale.bandwidth())
                .style("fill", fillStyle.groupColors[leftGroup] || fillStyle.defaultGroupColor);

            const formattedVal = valueUnit ? `${formatValue(dataPoint[valueFieldName])}${valueUnit}` : formatValue(dataPoint[valueFieldName]);
            mainChartGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", leftXScale(value) - 5) // Outside bar, to the left
                .attr("y", yPos + yScale.bandwidth() / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(formattedVal);
        }
    });

    // Right Bars
    dimensions.forEach(dim => {
        const dataPoint = chartData.find(d => d[dimensionFieldName] === dim && d[groupFieldName] === rightGroup);
        if (dataPoint) {
            const value = Math.abs(dataPoint[valueFieldName]);
            const barWidth = rightXScale(value);
            const yPos = yScale(dim);
            const barX = barAreaWidth + dimensionLabelWidth; // Start of right bar area

            mainChartGroup.append("rect")
                .attr("class", "mark bar right-bar")
                .attr("x", barX)
                .attr("y", yPos)
                .attr("width", barWidth)
                .attr("height", yScale.bandwidth())
                .style("fill", fillStyle.groupColors[rightGroup] || fillStyle.defaultGroupColor);

            const formattedVal = valueUnit ? `${formatValue(dataPoint[valueFieldName])}${valueUnit}` : formatValue(dataPoint[valueFieldName]);
            mainChartGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", barX + barWidth + 5) // Outside bar, to the right
                .attr("y", yPos + yScale.bandwidth() / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(formattedVal);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Removed: shadows, gradients, rounded corners, strokes, hover effects, alternating row backgrounds.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}