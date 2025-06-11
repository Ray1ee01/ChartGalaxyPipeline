/* REQUIREMENTS_BEGIN
{
  "chart_type": "Scatterplot",
  "chart_name": "scatterplot_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[8, 150], ["-inf", "inf"], ["-inf", "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data.data;
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {};
    const imagesInput = data.images || {}; // Not used in this chart
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x"; // Categorical label for points
    const yFieldRole = "y"; // Numerical value for X-axis
    const y2FieldRole = "y2"; // Numerical value for Y-axis

    const xFieldCol = dataColumns.find(col => col.role === xFieldRole);
    const yFieldCol = dataColumns.find(col => col.role === yFieldRole);
    const y2FieldCol = dataColumns.find(col => col.role === y2FieldRole);

    let missingFields = [];
    if (!xFieldCol) missingFields.push(xFieldRole + " (role)");
    if (!yFieldCol) missingFields.push(yFieldRole + " (role)");
    if (!y2FieldCol) missingFields.push(y2FieldRole + " (role)");
    
    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: roles ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family:sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;
    const y2FieldName = y2FieldCol.name;
    
    if (!rawChartData || rawChartData.length === 0) {
        const errorMsg = "Chart data is empty. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family:sans-serif;'>${errorMsg}</div>`);
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" }, // For axis titles
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" } // For axis ticks, data point labels
    };

    const typography = {
        title: { ...defaultTypography.title, ...(typographyInput.title || {}) },
        label: { ...defaultTypography.label, ...(typographyInput.label || {}) },
        annotation: { ...defaultTypography.annotation, ...(typographyInput.annotation || {}) }
    };

    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };

    const colors = {
        field: { ...defaultColors.field, ...(colorsInput.field || {}) },
        other: { ...defaultColors.other, ...(colorsInput.other || {}) },
        available_colors: colorsInput.available_colors || defaultColors.available_colors,
        background_color: colorsInput.background_color || defaultColors.background_color,
        text_color: colorsInput.text_color || defaultColors.text_color
    };
    
    const fillStyle = {
        backgroundColor: colors.background_color,
        textColor: colors.text_color,
        pointColor: colors.other.primary || defaultColors.other.primary,
        gridLineColor: "#DDDDDD",
        zeroLineColor: "#000000",
        typography: {
            axisTitle: typography.label,
            axisTick: typography.annotation,
            dataLabel: typography.annotation
        }
    };

    function estimateTextDimensions(text, fontFamily, fontSizeStr, fontWeight = 'normal') {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // No append to DOM as per directive
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontFamily);
        tempTextElement.setAttribute('font-size', fontSizeStr);
        tempTextElement.setAttribute('font-weight', fontWeight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        const bbox = tempTextElement.getBBox();
        return { width: bbox.width, height: bbox.height, y: bbox.y, x: bbox.x };
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = { top: 25, right: 25, bottom: 50, left: 50 }; // Default left margin

    // Calculate left margin based on Y-axis tick labels
    const tempYScaleForMargin = d3.scaleLinear()
        .domain(d3.extent(rawChartData, d => d[y2FieldName]))
        .range([containerHeight - chartMargins.top - chartMargins.bottom, 0]); // Placeholder range

    const tempYAxisForMargin = d3.axisLeft(tempYScaleForMargin);
    const tempSvgForMargin = svgRoot.append("g").attr("class", "temp-axis-group").style("opacity",0); // Temporary group for measurement
    tempSvgForMargin.call(tempYAxisForMargin);
    
    let maxLabelWidth = 0;
    tempSvgForMargin.selectAll(".tick text")
        .each(function() {
            const textWidth = this.getBBox().width;
            if (textWidth > maxLabelWidth) {
                maxLabelWidth = textWidth;
            }
        });
    tempSvgForMargin.remove();

    const yAxisTitleText = variables.yAxisTitle || "";
    const yAxisTitleHeightEstimate = yAxisTitleText ? (parseFloat(fillStyle.typography.axisTitle.font_size) + 5) : 0; // Approximate space for rotated title

    chartMargins.left = Math.max(50, maxLabelWidth + 10 + yAxisTitleHeightEstimate); // label width + padding + title space
    chartMargins.bottom = (variables.xAxisTitle || "") ? (parseFloat(fillStyle.typography.axisTitle.font_size) + 35) : 30; // Space for title + ticks
    chartMargins.top = 25;
    chartMargins.right = 25;


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({...d})); // Shallow copy

    // Block 6: Scale Definition & Configuration
    const xExtent = d3.extent(chartDataArray, d => d[yFieldName]);
    const yExtent = d3.extent(chartDataArray, d => d[y2FieldName]);

    const xPadding = (xExtent[1] - xExtent[0]) * 0.1 || 1; // Handle case where extent is 0
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1 || 1;

    const xScale = d3.scaleLinear()
        .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxis = d3.axisBottom(xScale)
        .tickSize(-innerHeight)
        .tickPadding(10);

    const yAxis = d3.axisLeft(yScale)
        .tickSize(-innerWidth)
        .tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    mainChartGroup.selectAll(".tick line")
        .attr("class", "gridline other")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-width", 0.5)
        .style("opacity", 0.7);

    mainChartGroup.selectAll(".domain").remove();

    mainChartGroup.selectAll(".tick text")
        .attr("class", "value")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.axisTick.font_family)
        .style("font-size", fillStyle.typography.axisTick.font_size)
        .style("font-weight", fillStyle.typography.axisTick.font_weight);

    // Zero lines
    if (yScale.domain()[0] < 0 && yScale.domain()[1] > 0) {
        mainChartGroup.append("line")
            .attr("class", "axis reference-line")
            .attr("x1", 0)
            .attr("y1", yScale(0))
            .attr("x2", innerWidth)
            .attr("y2", yScale(0))
            .style("stroke", fillStyle.zeroLineColor)
            .style("stroke-width", 1)
            .style("opacity", 0.8);
    }

    if (xScale.domain()[0] < 0 && xScale.domain()[1] > 0) {
        mainChartGroup.append("line")
            .attr("class", "axis reference-line")
            .attr("x1", xScale(0))
            .attr("y1", 0)
            .attr("x2", xScale(0))
            .attr("y2", innerHeight)
            .style("stroke", fillStyle.zeroLineColor)
            .style("stroke-width", 1)
            .style("opacity", 0.8);
    }
    
    // Axis Titles
    if (variables.xAxisTitle) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight + chartMargins.bottom - 10)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.axisTitle.font_family)
            .style("font-size", fillStyle.typography.axisTitle.font_size)
            .style("font-weight", fillStyle.typography.axisTitle.font_weight)
            .style("fill", fillStyle.textColor)
            .text(variables.xAxisTitle);
    }

    if (variables.yAxisTitle) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title")
            .attr("transform", "rotate(-90)")
            .attr("x", -innerHeight / 2)
            .attr("y", -chartMargins.left + parseFloat(fillStyle.typography.axisTitle.font_size) + 5) // Adjust based on font size
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.axisTitle.font_family)
            .style("font-size", fillStyle.typography.axisTitle.font_size)
            .style("font-weight", fillStyle.typography.axisTitle.font_weight)
            .style("fill", fillStyle.textColor)
            .text(variables.yAxisTitle);
    }


    // Block 8: Main Data Visualization Rendering
    const numPoints = chartDataArray.length;
    let circleRadius;
    if (numPoints <= 10) {
        circleRadius = 18 - numPoints * 0.6;
    } else {
        circleRadius = 12 - (numPoints - 10) * 0.3;
    }
    circleRadius = Math.max(1.5, Math.min(18, circleRadius));

    const pointGroups = mainChartGroup.selectAll(".data-point-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "data-point-group") // Using a more descriptive class for the group
        .attr("transform", d => `translate(${xScale(d[yFieldName])}, ${yScale(d[y2FieldName])})`);

    pointGroups.append("circle")
        .attr("class", "mark")
        .attr("r", Math.max(1, circleRadius - 2)) // Ensure radius is at least 1
        .attr("fill", fillStyle.pointColor);
        

    // Label positioning logic (adapted from original)
    function findOptimalLabelPosition(d, allData, currentPositions) {
        const candidatePositions = [ // {offsetX, offsetY, textAnchor, priority}
            { x: circleRadius + 5, y: 0 + parseFloat(fillStyle.typography.dataLabel.font_size) / 3, anchor: "start", priority: 1 }, // Right
            { x: 0, y: -(circleRadius + 5), anchor: "middle", priority: 2 }, // Top
            { x: -(circleRadius + 5), y: 0 + parseFloat(fillStyle.typography.dataLabel.font_size) / 3, anchor: "end", priority: 3 }, // Left
            { x: 0, y: circleRadius + 5 + parseFloat(fillStyle.typography.dataLabel.font_size), anchor: "middle", priority: 4 }, // Bottom
            // Diagonal positions as fallbacks
            { x: circleRadius + 2, y: -(circleRadius + 2), anchor: "start", priority: 5 },
            { x: -(circleRadius + 2), y: -(circleRadius + 2), anchor: "end", priority: 6 },
            { x: -(circleRadius + 2), y: circleRadius + 2 + parseFloat(fillStyle.typography.dataLabel.font_size), anchor: "end", priority: 7 },
            { x: circleRadius + 2, y: circleRadius + 2 + parseFloat(fillStyle.typography.dataLabel.font_size), anchor: "start", priority: 8 }
        ];

        const pointX = xScale(d[yFieldName]);
        const pointY = yScale(d[y2FieldName]);
        const labelText = d[xFieldName];

        const textDimensions = estimateTextDimensions(
            labelText, 
            fillStyle.typography.dataLabel.font_family, 
            fillStyle.typography.dataLabel.font_size,
            fillStyle.typography.dataLabel.font_weight
        );
        const labelWidth = textDimensions.width;
        const labelHeight = textDimensions.height;
        const labelBBoxY = textDimensions.y; // y of bbox relative to baseline

        for (const pos of candidatePositions) {
            let currentLabelBBox = {};
            const textElementX = pointX + pos.x;
            const textElementY = pointY + pos.y;

            if (pos.anchor === "start") {
                currentLabelBBox.x1 = textElementX + labelBBoxY.x; // textBBox.x is often 0 for 'start'
                currentLabelBBox.x2 = textElementX + labelBBoxY.x + labelWidth;
            } else if (pos.anchor === "middle") {
                currentLabelBBox.x1 = textElementX - labelWidth / 2 + labelBBoxY.x;
                currentLabelBBox.x2 = textElementX + labelWidth / 2 + labelBBoxY.x;
            } else { // end
                currentLabelBBox.x1 = textElementX - labelWidth + labelBBoxY.x;
                currentLabelBBox.x2 = textElementX + labelBBoxY.x;
            }
            currentLabelBBox.y1 = textElementY + labelBBoxY;
            currentLabelBBox.y2 = textElementY + labelBBoxY + labelHeight;
            
            // Check bounds
            if (currentLabelBBox.x1 < 0 || currentLabelBBox.x2 > innerWidth || 
                currentLabelBBox.y1 < 0 || currentLabelBBox.y2 > innerHeight) {
                continue;
            }

            let hasOverlap = false;
            // Check overlap with other points (simplified: check if label box overlaps point circle)
            for (const otherPointData of allData) {
                if (otherPointData === d) continue;
                const otherPX = xScale(otherPointData[yFieldName]);
                const otherPY = yScale(otherPointData[y2FieldName]);
                
                // Check if point center is inside expanded label bounding box
                const expandedR = circleRadius + 2; // A small buffer
                if (otherPX > currentLabelBBox.x1 - expandedR && otherPX < currentLabelBBox.x2 + expandedR &&
                    otherPY > currentLabelBBox.y1 - expandedR && otherPY < currentLabelBBox.y2 + expandedR) {
                     hasOverlap = true; break;
                }
            }
            if (hasOverlap) continue;

            // Check overlap with other labels
            for (const placedLabelKey in currentPositions) {
                const pLabelInfo = currentPositions[placedLabelKey];
                const pLabelData = allData.find(item => item[xFieldName] === placedLabelKey);
                if (!pLabelData || pLabelData === d) continue;

                const pTextDimensions = estimateTextDimensions(
                    pLabelData[xFieldName], 
                    fillStyle.typography.dataLabel.font_family, 
                    fillStyle.typography.dataLabel.font_size,
                    fillStyle.typography.dataLabel.font_weight
                );
                const pLabelWidth = pTextDimensions.width;
                const pLabelHeight = pTextDimensions.height;
                const pLabelBBoxY = pTextDimensions.y;

                let otherLabelBBox = {};
                const pTextElementX = xScale(pLabelData[yFieldName]) + pLabelInfo.x;
                const pTextElementY = yScale(pLabelData[y2FieldName]) + pLabelInfo.y;

                if (pLabelInfo.anchor === "start") {
                    otherLabelBBox.x1 = pTextElementX + pTextDimensions.x;
                    otherLabelBBox.x2 = pTextElementX + pTextDimensions.x + pLabelWidth;
                } else if (pLabelInfo.anchor === "middle") {
                    otherLabelBBox.x1 = pTextElementX - pLabelWidth / 2 + pTextDimensions.x;
                    otherLabelBBox.x2 = pTextElementX + pLabelWidth / 2 + pTextDimensions.x;
                } else { // end
                    otherLabelBBox.x1 = pTextElementX - pLabelWidth + pTextDimensions.x;
                    otherLabelBBox.x2 = pTextElementX + pTextDimensions.x;
                }
                otherLabelBBox.y1 = pTextElementY + pLabelBBoxY;
                otherLabelBBox.y2 = pTextElementY + pLabelBBoxY + pLabelHeight;

                // AABB overlap check
                if (currentLabelBBox.x1 < otherLabelBBox.x2 && currentLabelBBox.x2 > otherLabelBBox.x1 &&
                    currentLabelBBox.y1 < otherLabelBBox.y2 && currentLabelBBox.y2 > otherLabelBBox.y1) {
                    hasOverlap = true; break;
                }
            }
            if (!hasOverlap) {
                return { ...pos, canShow: true };
            }
        }
        return { ...candidatePositions[0], canShow: false }; // Default if no good position found
    }

    let labelPositions = {};
    chartDataArray.forEach(d => {
        if (d[xFieldName]) { // Only add labels for points with a name/label
             labelPositions[d[xFieldName]] = findOptimalLabelPosition(d, chartDataArray, labelPositions);
        }
    });

    pointGroups.append("text")
        .attr("class", "label data-label")
        .each(function(d) {
            const pos = labelPositions[d[xFieldName]];
            if (pos && d[xFieldName]) {
                d3.select(this)
                    .attr("x", pos.x)
                    .attr("y", pos.y)
                    .attr("text-anchor", pos.anchor)
                    .style("font-family", fillStyle.typography.dataLabel.font_family)
                    .style("font-size", fillStyle.typography.dataLabel.font_size)
                    .style("font-weight", fillStyle.typography.dataLabel.font_weight)
                    .style("fill", fillStyle.textColor)
                    .style("opacity", pos.canShow ? 1 : 0)
                    .text(d[xFieldName]);
            } else {
                d3.select(this).remove(); // Remove text element if no label or position
            }
        });

    // Block 9: Optional Enhancements & Post-Processing
    // (Label optimization is handled in Block 8)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}