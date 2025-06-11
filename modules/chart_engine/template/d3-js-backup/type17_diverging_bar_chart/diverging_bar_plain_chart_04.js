/* REQUIREMENTS_BEGIN
{
  "chart_type": "Diverging Bar Chart",
  "chart_name": "diverging_bar_plain_chart_04",
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
  "legend": "compact",
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
    // const imagesInput = data.images || {}; // Parsed, but not used in this chart type
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    if (!dimensionField || !valueField || !groupField) {
        console.error("Critical chart config missing: One or more required field names (x, y, group) could not be derived from dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing. Field roles for x, y, or group not found.</div>");
        return null;
    }

    if (!chartData || chartData.length === 0) {
        console.error("Chart data is empty or undefined. Cannot render.");
         d3.select(containerSelector).html("<div style='color:red;'>Error: Chart data is missing.</div>");
        return null;
    }

    const groups = [...new Set(chartData.map(d => d[groupField]))];
    if (groups.length < 2) {
        console.error(`Critical chart config missing: Insufficient groups for diverging chart. Need at least 2, found ${groups.length}. Cannot render.`);
        d3.select(containerSelector).html("<div style='color:red;'>Error: Insufficient groups for diverging chart. At least two groups are required.</div>");
        return null;
    }

    const dimensionUnit = dataColumns.find(col => col.role === "x")?.unit !== "none" ? dataColumns.find(col => col.role === "x").unit : "";
    const valueUnit = dataColumns.find(col => col.role === "y")?.unit !== "none" ? dataColumns.find(col => col.role === "y").unit : "";
    const groupUnit = dataColumns.find(col => col.role === "group")?.unit !== "none" ? dataColumns.find(col => col.role === "group").unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            label: {
                font_family: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
                font_size: (typographyInput.label && typographyInput.label.font_size) || '12px',
                font_weight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            },
            annotation: { // For value labels
                font_family: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
                font_size: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
                font_weight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
            }
        },
        colors: {
            textColor: colorsInput.text_color || '#333333',
            backgroundColor: colorsInput.background_color || '#FFFFFF',
            defaultPrimaryColor: (colorsInput.other && colorsInput.other.primary) || '#1f77b4',
            getBarColor: (groupName, groupIndex) => {
                if (colorsInput.field && colorsInput.field[groupName]) {
                    return colorsInput.field[groupName];
                }
                if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                    return colorsInput.available_colors[groupIndex % colorsInput.available_colors.length];
                }
                const defaultScheme = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
                return defaultScheme[groupIndex % defaultScheme.length];
            }
        }
    };

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempTextElement = document.createElementNS(svgNS, 'text');
        if (fontProps.font_family) tempTextElement.setAttribute('font-family', fontProps.font_family);
        if (fontProps.font_size) tempTextElement.setAttribute('font-size', fontProps.font_size);
        if (fontProps.font_weight) tempTextElement.setAttribute('font-weight', fontProps.font_weight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        let bboxWidth = 0;
        try {
            bboxWidth = tempTextElement.getBBox().width;
        } catch (e) {
            const fontSizeNumeric = parseFloat(fontProps.font_size || "12px");
            bboxWidth = (text.length * fontSizeNumeric * 0.6); 
        }
        return bboxWidth;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard for Billions
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
             return d3.format("~.2s")(value);
        }
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
        .style("background-color", fillStyle.colors.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 70, bottom: 40, left: 70 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const allDimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    let maxDimLabelWidth = 0;
    allDimensions.forEach(dim => {
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const width = estimateTextWidth(formattedDim, fillStyle.typography.label);
        if (width > maxDimLabelWidth) {
            maxDimLabelWidth = width;
        }
    });
    const dimensionLabelAreaWidth = Math.max(maxDimLabelWidth, 60) + 10; // Min 60px for text, 10px padding

    // Block 5: Data Preprocessing & Transformation
    const dimensions = allDimensions; // Use original order
    const leftGroup = groups[0];
    const rightGroup = groups[1];

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.3);

    const maxLeftValue = d3.max(chartData.filter(d => d[groupField] === leftGroup), d => Math.abs(parseFloat(d[valueField]))) || 0;
    const maxRightValue = d3.max(chartData.filter(d => d[groupField] === rightGroup), d => Math.abs(parseFloat(d[valueField]))) || 0;
    
    const barAreaWidth = (innerWidth - dimensionLabelAreaWidth) / 2;

    const leftXScale = d3.scaleLinear()
        .domain([0, maxLeftValue])
        .range([barAreaWidth, 0]); // Bar grows from center to left

    const rightXScale = d3.scaleLinear()
        .domain([0, maxRightValue])
        .range([0, barAreaWidth]); // Bar grows from center to right

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendSquareSize = 12;
    const legendSpacing = 5;

    // Left Group Label (Legend)
    const formattedLeftGroup = groupUnit ? `${leftGroup}${groupUnit}` : `${leftGroup}`;
    const leftGroupLabelWidth = estimateTextWidth(formattedLeftGroup, fillStyle.typography.label);
    const leftLabelGroup = mainChartGroup.append("g")
        .attr("class", "label group-label left-group-label")
        .attr("transform", `translate(${barAreaWidth / 2 - (leftGroupLabelWidth + legendSquareSize + legendSpacing) / 2}, -30)`);

    leftLabelGroup.append("rect")
        .attr("class", "mark legend-swatch")
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("y", -legendSquareSize / 2)
        .style("fill", fillStyle.colors.getBarColor(leftGroup, 0));

    leftLabelGroup.append("text")
        .attr("class", "text")
        .attr("x", legendSquareSize + legendSpacing)
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .style("fill", fillStyle.colors.textColor)
        .text(formattedLeftGroup);

    // Right Group Label (Legend)
    const formattedRightGroup = groupUnit ? `${rightGroup}${groupUnit}` : `${rightGroup}`;
    const rightGroupLabelWidth = estimateTextWidth(formattedRightGroup, fillStyle.typography.label);
    const rightLabelGroup = mainChartGroup.append("g")
        .attr("class", "label group-label right-group-label")
        .attr("transform", `translate(${barAreaWidth + dimensionLabelAreaWidth + barAreaWidth / 2 - (rightGroupLabelWidth + legendSquareSize + legendSpacing) / 2}, -30)`);

    rightLabelGroup.append("rect")
        .attr("class", "mark legend-swatch")
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("y", -legendSquareSize / 2)
        .style("fill", fillStyle.colors.getBarColor(rightGroup, 1));

    rightLabelGroup.append("text")
        .attr("class", "text")
        .attr("x", legendSquareSize + legendSpacing)
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .style("fill", fillStyle.colors.textColor)
        .text(formattedRightGroup);

    // Dimension Labels (Center)
    const dimensionLabelsGroup = mainChartGroup.append("g")
        .attr("class", "dimension-labels-group")
        .attr("transform", `translate(${barAreaWidth + dimensionLabelAreaWidth / 2}, 0)`);

    dimensions.forEach(dimension => {
        const yPos = yScale(dimension) + yScale.bandwidth() / 2;
        const formattedDimension = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        dimensionLabelsGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", 0) // Centered within its group
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("fill", fillStyle.colors.textColor)
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", fillStyle.typography.label.font_size)
            .style("font-weight", fillStyle.typography.label.font_weight)
            .text(formattedDimension);
    });

    // Block 8: Main Data Visualization Rendering
    // Left Bars
    const leftBarsGroup = mainChartGroup.append("g").attr("class", "left-bars-group");
    dimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension && d[groupField] === leftGroup);
        if (dataPoint) {
            const value = Math.abs(parseFloat(dataPoint[valueField])) || 0;
            const barWidth = leftXScale(0) - leftXScale(value); // width is positive
            const xPos = leftXScale(value); // x-coordinate of the left edge of the bar

            leftBarsGroup.append("rect")
                .attr("class", "mark bar left-bar")
                .attr("x", xPos)
                .attr("y", yScale(dimension))
                .attr("width", barWidth)
                .attr("height", yScale.bandwidth())
                .style("fill", fillStyle.colors.getBarColor(leftGroup, 0));

            const formattedVal = valueUnit ? `${formatValue(dataPoint[valueField])}${valueUnit}` : formatValue(dataPoint[valueField]);
            leftBarsGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", xPos - 5) // Position to the left of the bar
                .attr("y", yScale(dimension) + yScale.bandwidth() / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("fill", fillStyle.colors.textColor)
                .style("font-family", fillStyle.typography.annotation.font_family)
                .style("font-size", fillStyle.typography.annotation.font_size)
                .style("font-weight", fillStyle.typography.annotation.font_weight)
                .text(formattedVal);
        }
    });

    // Right Bars
    const rightBarsGroup = mainChartGroup.append("g")
        .attr("class", "right-bars-group")
        .attr("transform", `translate(${barAreaWidth + dimensionLabelAreaWidth}, 0)`);

    dimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension && d[groupField] === rightGroup);
        if (dataPoint) {
            const value = Math.abs(parseFloat(dataPoint[valueField])) || 0;
            const barWidth = rightXScale(value);

            rightBarsGroup.append("rect")
                .attr("class", "mark bar right-bar")
                .attr("x", 0) // Starts at the beginning of this group's area
                .attr("y", yScale(dimension))
                .attr("width", barWidth)
                .attr("height", yScale.bandwidth())
                .style("fill", fillStyle.colors.getBarColor(rightGroup, 1));

            const formattedVal = valueUnit ? `${formatValue(dataPoint[valueField])}${valueUnit}` : formatValue(dataPoint[valueField]);
            rightBarsGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", barWidth + 5) // Position to the right of the bar
                .attr("y", yScale(dimension) + yScale.bandwidth() / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("fill", fillStyle.colors.textColor)
                .style("font-family", fillStyle.typography.annotation.font_family)
                .style("font-size", fillStyle.typography.annotation.font_size)
                .style("font-weight", fillStyle.typography.annotation.font_weight)
                .text(formattedVal);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Removed hover effects and other optional visual enhancements as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}