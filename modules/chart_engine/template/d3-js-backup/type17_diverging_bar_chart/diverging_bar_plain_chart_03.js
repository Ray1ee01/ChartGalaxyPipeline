/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_04",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": ["x"],
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
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    const dimensionFieldName = dimensionFieldDef?.name;
    const valueFieldName = valueFieldDef?.name;
    const groupFieldName = groupFieldDef?.name;

    let missingFields = [];
    if (!dimensionFieldName) missingFields.push("x role field");
    if (!valueFieldName) missingFields.push("y role field");
    if (!groupFieldName) missingFields.push("group role field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionUnit = dimensionFieldDef.unit !== "none" ? dimensionFieldDef.unit : "";
    const valueUnit = valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";
    const groupUnit = groupFieldDef.unit !== "none" ? groupFieldDef.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};

    const defaultTypography = {
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography = {
        labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || defaultTypography.label.font_family,
        labelFontSize: (typographyInput.label && typographyInput.label.font_size) || defaultTypography.label.font_size,
        labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || defaultTypography.label.font_weight,
        annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || defaultTypography.annotation.font_family,
        annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || defaultTypography.annotation.font_size,
        annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || defaultTypography.annotation.font_weight,
    };

    const defaultColors = {
        textColor: "#333333",
        primaryBarColor: "#1f77b4",
        secondaryBarColor: "#ff7f0e", // Fallback if only one group color needed and not specified
        defaultCategorical: d3.schemeCategory10
    };

    fillStyle.textColor = colorsInput.text_color || defaultColors.textColor;

    fillStyle.getColorByGroup = (groupName, groupIndex) => {
        if (colorsInput.field && colorsInput.field[groupName]) {
            return colorsInput.field[groupName];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[groupIndex % colorsInput.available_colors.length];
        }
        return defaultColors.defaultCategorical[groupIndex % defaultColors.defaultCategorical.length];
    };
    
    fillStyle.getImageUrl = (dimensionName) => {
        if (imagesInput.field && imagesInput.field[dimensionName]) {
            return imagesInput.field[dimensionName];
        }
        return null;
    };

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B');
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
             return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value);
    };

    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox across browsers
        // but per spec, must not append to DOM. This might be less accurate in some edge cases.
        document.body.appendChild(tempSvg); // Temporarily append to measure
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg); // Clean up
        return width;
    };
    
    const showDimensionIcons = variables.showDimensionIcons !== undefined ? variables.showDimensionIcons : true;
    const iconWidth = 20;
    const iconHeight = 15;
    const iconPadding = 5; // Padding between icon and text

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 70, bottom: 40, left: 70 }; // Adjusted top margin
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const barSlope = 5; // For trapezoidal shape

    let maxDimLabelWidth = 0;
    const tempDimensions = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    tempDimensions.forEach(dim => {
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        let currentWidth = estimateTextWidth(formattedDim, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (showDimensionIcons && fillStyle.getImageUrl(dim)) {
            currentWidth += iconWidth + iconPadding;
        }
        maxDimLabelWidth = Math.max(maxDimLabelWidth, currentWidth);
    });
    
    const dimensionLabelAreaWidth = Math.max(maxDimLabelWidth + 10, 80); // Min width 80, 10 for padding

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const dimensions = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];

    if (groups.length < 2) {
        const errorMsg = "Insufficient groups. This chart requires exactly 2 groups.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }
    const leftGroup = groups[0];
    const rightGroup = groups[1];

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(variables.yScalePadding || 0.3);

    const maxLeftValue = d3.max(chartData.filter(d => d[groupFieldName] === leftGroup), d => Math.abs(d[valueFieldName]));
    const maxRightValue = d3.max(chartData.filter(d => d[groupFieldName] === rightGroup), d => Math.abs(d[valueFieldName]));
    
    const barAreaWidth = (innerWidth - dimensionLabelAreaWidth) / 2;

    const leftXScale = d3.scaleLinear()
        .domain([0, maxLeftValue || 0]) // Ensure domain starts at 0, handle empty/all-zero data
        .range([barAreaWidth, 0]); // Bar grows from center to left

    const rightXScale = d3.scaleLinear()
        .domain([0, maxRightValue || 0]) // Ensure domain starts at 0
        .range([0, barAreaWidth]); // Bar grows from center to right

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const groupLabelYPos = -chartMargins.top / 2 + 10; // Position above the chart area

    const formattedLeftGroup = groupUnit ? `${leftGroup}${groupUnit}` : `${leftGroup}`;
    svgRoot.append("text")
        .attr("class", "label group-label left-group-label")
        .attr("x", chartMargins.left + barAreaWidth / 2)
        .attr("y", groupLabelYPos)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedLeftGroup);

    const formattedRightGroup = groupUnit ? `${rightGroup}${groupUnit}` : `${rightGroup}`;
    svgRoot.append("text")
        .attr("class", "label group-label right-group-label")
        .attr("x", chartMargins.left + barAreaWidth + dimensionLabelAreaWidth + barAreaWidth / 2)
        .attr("y", groupLabelYPos)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedRightGroup);

    const dimensionLabelsGroup = mainChartGroup.append("g")
        .attr("class", "dimension-labels-group")
        .attr("transform", `translate(${barAreaWidth}, 0)`);

    dimensions.forEach(dim => {
        const yPos = yScale(dim) + yScale.bandwidth() / 2;
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const imageUrl = showDimensionIcons ? fillStyle.getImageUrl(dim) : null;
        
        const textElement = dimensionLabelsGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(formattedDim);

        let textWidth = 0;
        try { // getBBox can fail if element not in render tree or hidden
            textWidth = textElement.node().getBBox().width;
        } catch(e) {
            textWidth = estimateTextWidth(formattedDim, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        }

        if (imageUrl) {
            const totalContentWidth = iconWidth + iconPadding + textWidth;
            dimensionLabelsGroup.append("image")
                .attr("class", "icon dimension-icon")
                .attr("x", dimensionLabelAreaWidth / 2 - totalContentWidth / 2)
                .attr("y", yPos - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", imageUrl);
            textElement.attr("x", dimensionLabelAreaWidth / 2 - totalContentWidth / 2 + iconWidth + iconPadding)
                       .attr("text-anchor", "start");
        } else {
            textElement.attr("x", dimensionLabelAreaWidth / 2)
                       .attr("text-anchor", "middle");
        }
    });

    // Block 8: Main Data Visualization Rendering
    const barHeight = yScale.bandwidth();

    // Left bars
    dimensions.forEach(dim => {
        const dataPoint = chartData.find(d => d[dimensionFieldName] === dim && d[groupFieldName] === leftGroup);
        if (dataPoint) {
            const value = Math.abs(dataPoint[valueFieldName]);
            const barVisualWidth = leftXScale(0) - leftXScale(value); // width of the bar on screen
            const xStart = leftXScale(value); // right edge of the bar (closer to center)
            const yPos = yScale(dim);

            const pathDataLeft = [
                `M ${xStart} ${yPos}`,
                `L ${xStart + barVisualWidth} ${yPos}`,
                `L ${xStart + barVisualWidth} ${yPos + barHeight}`,
                `L ${xStart - barSlope} ${yPos + barHeight}`,
                "Z"
            ].join(" ");
            
            mainChartGroup.append("path")
                .attr("class", "mark bar left-bar")
                .attr("d", pathDataLeft)
                .attr("fill", fillStyle.getColorByGroup(leftGroup, 0));

            const formattedVal = valueUnit ? `${formatValue(dataPoint[valueFieldName])}${valueUnit}` : formatValue(dataPoint[valueFieldName]);
            mainChartGroup.append("text")
                .attr("class", "label value-label left-value-label")
                .attr("x", xStart - barSlope - 5) // 5 for padding
                .attr("y", yPos + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(formattedVal);
        }
    });

    // Right bars
    dimensions.forEach(dim => {
        const dataPoint = chartData.find(d => d[dimensionFieldName] === dim && d[groupFieldName] === rightGroup);
        if (dataPoint) {
            const value = Math.abs(dataPoint[valueFieldName]);
            const barVisualWidth = rightXScale(value) - rightXScale(0);
            const xStart = barAreaWidth + dimensionLabelAreaWidth; // left edge of the bar (closer to center)
            const yPos = yScale(dim);

            const pathDataRight = [
                `M ${xStart} ${yPos}`,
                `L ${xStart + barVisualWidth} ${yPos}`,
                `L ${xStart + barVisualWidth + barSlope} ${yPos + barHeight}`,
                `L ${xStart} ${yPos + barHeight}`,
                "Z"
            ].join(" ");

            mainChartGroup.append("path")
                .attr("class", "mark bar right-bar")
                .attr("d", pathDataRight)
                .attr("fill", fillStyle.getColorByGroup(rightGroup, 1));
            
            const formattedVal = valueUnit ? `${formatValue(dataPoint[valueFieldName])}${valueUnit}` : formatValue(dataPoint[valueFieldName]);
            mainChartGroup.append("text")
                .attr("class", "label value-label right-value-label")
                .attr("x", xStart + barVisualWidth + barSlope + 5) // 5 for padding
                .attr("y", yPos + barHeight / 2)
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
    // Removed mouseover/mouseout effects, shadows, gradients, rounded corners as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}