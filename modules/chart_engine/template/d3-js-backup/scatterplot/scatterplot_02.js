/* REQUIREMENTS_BEGIN
{
  "chart_type": "Scatterplot",
  "chart_name": "scatterplot_02",
  "is_composite": false,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[8, 150], ["-inf", "inf"], ["-inf", "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 750,
  "min_width": 750,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xRoleInfo = dataColumns.find(col => col.role === "x");
    const yRoleInfo = dataColumns.find(col => col.role === "y");
    const y2RoleInfo = dataColumns.find(col => col.role === "y2");

    const categoryField = xRoleInfo ? xRoleInfo.name : undefined; // For icons and labels
    const xValueField = yRoleInfo ? yRoleInfo.name : undefined;   // For chart's X-axis values
    const yValueField = y2RoleInfo ? y2RoleInfo.name : undefined; // For chart's Y-axis values

    const xAxisTitleText = yRoleInfo ? yRoleInfo.title : "";
    const yAxisTitleText = y2RoleInfo ? y2RoleInfo.title : "";

    const criticalFields = {
        "Category Field (role 'x')": categoryField,
        "X Value Field (role 'y')": xValueField,
        "Y Value Field (role 'y2')": yValueField
    };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyInput.title?.font_family || "Arial, sans-serif",
            titleFontSize: typographyInput.title?.font_size || "16px",
            titleFontWeight: typographyInput.title?.font_weight || "bold",
            labelFontFamily: typographyInput.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyInput.label?.font_size || "12px", // For axis titles
            labelFontWeight: typographyInput.label?.font_weight || "normal",
            annotationFontFamily: typographyInput.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyInput.annotation?.font_size || "10px", // For tick labels and data labels
            annotationFontWeight: typographyInput.annotation?.font_weight || "normal",
        },
        textColor: colorsInput.text_color || "#0f223b",
        backgroundColor: colorsInput.background_color || "#FFFFFF",
        primaryColor: colorsInput.other?.primary || "#1f77b4",
        gridLineColor: colorsInput.other?.grid_line || "#DDDDDD",
        axisLineColor: colorsInput.other?.axis_line || "#333333",
        zeroLineColor: colorsInput.other?.zero_line || "#000000",
        pointBackgroundColor: "#FFFFFF", // As per original
        pointStrokeColor: "#FFFFFF",   // As per original
    };

    function estimateTextWidth(text, fontDetails) {
        if (!text) return { width: 0, height: 0 };
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontDetails.fontFamily);
        tempText.setAttribute('font-size', fontDetails.fontSize);
        tempText.setAttribute('font-weight', fontDetails.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document append/remove is not strictly necessary for getBBox if SVG is properly formed,
        // but some browsers might be more reliable if it's briefly in DOM.
        // For full in-memory, ensure SVG has dimensions or text has x,y.
        // document.body.appendChild(tempSvg); 
        const bbox = tempText.getBBox();
        // document.body.removeChild(tempSvg);
        return { width: bbox.width, height: bbox.height };
    }
    
    const dataLabelFontDetails = {
        fontFamily: fillStyle.typography.annotationFontFamily,
        fontSize: fillStyle.typography.annotationFontSize,
        fontWeight: fillStyle.typography.annotationFontWeight,
    };

    function findOptimalPosition(d, allPoints, currentPositions, scales, dimensions, pointRadiusVal) {
        const { xScale, yScale } = scales;
        const { chartWidth, chartHeight } = dimensions;

        const positions = [
            { x: 20, y: 4, anchor: "start", priority: 1 },         // right
            { x: 0, y: -20, anchor: "middle", priority: 2 },       // top
            { x: -20, y: 4, anchor: "end", priority: 3 },          // left
            { x: 0, y: 28, anchor: "middle", priority: 4 },        // bottom
            { x: 20, y: -20, anchor: "start", priority: 5 },       // top-right
            { x: -20, y: -20, anchor: "end", priority: 6 },        // top-left
            { x: -20, y: 28, anchor: "end", priority: 7 },         // bottom-left
            { x: 20, y: 28, anchor: "start", priority: 8 }         // bottom-right
        ];

        const pointX = xScale(d[xValueField]);
        const pointY = yScale(d[yValueField]);

        if (currentPositions[d[categoryField]]) {
            return currentPositions[d[categoryField]];
        }
        
        const textMetrics = estimateTextWidth(d[categoryField], dataLabelFontDetails);
        const labelWidth = textMetrics.width;
        const labelHeight = textMetrics.height;

        for (const pos of positions) {
            let hasOverlap = false;
            let labelX1, labelY1, labelX2, labelY2;

            // Use original logic for collision box calculation relative to pointX, pointY
            if (pos.priority === 1) { // right
                labelX1 = pointX + 20; labelY1 = pointY - labelHeight / 2;
            } else if (pos.priority === 2) { // top
                labelX1 = pointX - labelWidth / 2; labelY1 = pointY - 20 - labelHeight;
            } else if (pos.priority === 3) { // left
                labelX1 = pointX - 20 - labelWidth; labelY1 = pointY - labelHeight / 2;
            } else if (pos.priority === 4) { // bottom
                labelX1 = pointX - labelWidth / 2; labelY1 = pointY + 20;
            } else if (pos.priority === 5) { // top-right
                labelX1 = pointX + 15; labelY1 = pointY - 15 - labelHeight;
            } else if (pos.priority === 6) { // top-left
                labelX1 = pointX - 15 - labelWidth; labelY1 = pointY - 15 - labelHeight;
            } else if (pos.priority === 7) { // bottom-left
                labelX1 = pointX - 15 - labelWidth; labelY1 = pointY + 15;
            } else { // bottom-right (pos.priority === 8)
                labelX1 = pointX + 15; labelY1 = pointY + 15;
            }
            labelX2 = labelX1 + labelWidth;
            labelY2 = labelY1 + labelHeight;

            if (labelX1 < 0 || labelX2 > chartWidth || labelY1 < 0 || labelY2 > chartHeight) {
                continue; // Label out of chart bounds
            }

            for (const p of allPoints) {
                if (p === d) continue;

                const pX = xScale(p[xValueField]);
                const pY = yScale(p[yValueField]);

                // Check overlap with other points
                const dxPt = (labelX1 + labelX2) / 2 - pX;
                const dyPt = (labelY1 + labelY2) / 2 - pY;
                const distancePt = Math.sqrt(dxPt * dxPt + dyPt * dyPt);
                if (distancePt < pointRadiusVal + Math.max(labelWidth, labelHeight) / 2) { // Simplified check
                    hasOverlap = true; break;
                }

                // Check overlap with other labels
                const pPos = currentPositions[p[categoryField]];
                if (pPos) {
                    const otherMetrics = estimateTextWidth(p[categoryField], dataLabelFontDetails);
                    const otherLabelWidth = otherMetrics.width;
                    const otherLabelHeight = otherMetrics.height;
                    let otherX1, otherY1;

                    // Reconstruct other label's collision box based on its chosen pos and pX, pY
                    if (pPos.priority === 1) { otherX1 = pX + 20; otherY1 = pY - otherLabelHeight / 2; }
                    else if (pPos.priority === 2) { otherX1 = pX - otherLabelWidth / 2; otherY1 = pY - 20 - otherLabelHeight; }
                    else if (pPos.priority === 3) { otherX1 = pX - 20 - otherLabelWidth; otherY1 = pY - otherLabelHeight / 2; }
                    else if (pPos.priority === 4) { otherX1 = pX - otherLabelWidth / 2; otherY1 = pY + 20; }
                    else if (pPos.priority === 5) { otherX1 = pX + 15; otherY1 = pY - 15 - otherLabelHeight; }
                    else if (pPos.priority === 6) { otherX1 = pX - 15 - otherLabelWidth; otherY1 = pY - 15 - otherLabelHeight; }
                    else if (pPos.priority === 7) { otherX1 = pX - 15 - otherLabelWidth; otherY1 = pY + 15; }
                    else { otherX1 = pX + 15; otherY1 = pY + 15; }
                    
                    const otherX2 = otherX1 + otherLabelWidth;
                    const otherY2 = otherY1 + otherLabelHeight;

                    if (labelX1 < otherX2 && labelX2 > otherX1 && labelY1 < otherY2 && labelY2 > otherY1) {
                        hasOverlap = true; break;
                    }
                }
            }
            if (!hasOverlap) return { ...pos, canShow: true };
        }
        return { ...positions[0], canShow: false }; // Default if all overlap
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    let maxLabelWidth = 0;
    if (chartDataArray.length > 0 && yValueField) {
        const yExtentTemp = d3.extent(chartDataArray, d => d[yValueField]);
        const tempYScale = d3.scaleLinear().domain(yExtentTemp).range([containerHeight, 0]); // Approx range
        const tempYAxis = d3.axisLeft(tempYScale);
        
        const tempSvgForAxis = d3.select(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
        const tempGAxis = tempSvgForAxis.append("g").call(tempYAxis);
        
        tempGAxis.selectAll(".tick text").each(function() {
            const textMetrics = estimateTextWidth(d3.select(this).text(), {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: fillStyle.typography.annotationFontSize,
                fontWeight: fillStyle.typography.annotationFontWeight,
            });
            if (textMetrics.width > maxLabelWidth) {
                maxLabelWidth = textMetrics.width;
            }
        });
    }
    
    const yAxisTickPadding = 10;
    const yAxisTitleSpace = yAxisTitleText ? (parseInt(fillStyle.typography.labelFontSize) + 15) : 0; // Approx height of title + padding
    const calculatedLeftMargin = Math.max(50, maxLabelWidth + yAxisTickPadding + yAxisTitleSpace);

    const chartMargins = {
        top: 25,
        right: 25,
        bottom: (xAxisTitleText ? (parseInt(fillStyle.typography.labelFontSize) + 25) : 25) + 15, // Title space + tick space
        left: calculatedLeftMargin
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    // Data is assumed to be in the correct format. Extents are calculated in scales.

    // Block 6: Scale Definition & Configuration
    const xDomainExtent = d3.extent(chartDataArray, d => d[xValueField]);
    const xPadding = (xDomainExtent[1] - xDomainExtent[0]) * 0.1 || 1; // Handle single point case
    const xScale = d3.scaleLinear()
        .domain([xDomainExtent[0] - xPadding, xDomainExtent[1] + xPadding])
        .range([0, innerWidth]);

    const yDomainExtent = d3.extent(chartDataArray, d => d[yValueField]);
    const yPadding = (yDomainExtent[1] - yDomainExtent[0]) * 0.1 || 1; // Handle single point case
    const yScale = d3.scaleLinear()
        .domain([yDomainExtent[0] - yPadding, yDomainExtent[1] + yPadding])
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxis = d3.axisBottom(xScale)
        .tickSize(-innerHeight)
        .tickPadding(10);

    const yAxis = d3.axisLeft(yScale)
        .tickSize(-innerWidth)
        .tickPadding(yAxisTickPadding);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    mainChartGroup.selectAll(".tick line")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-width", 0.5)
        .style("opacity", 0.7);

    mainChartGroup.selectAll(".domain").remove();

    mainChartGroup.selectAll(".tick text")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight);

    // Zero reference lines
    if (xScale.domain()[0] <= 0 && xScale.domain()[1] >= 0) {
        mainChartGroup.append("line")
            .attr("class", "reference-line zero-x-axis")
            .attr("x1", xScale(0))
            .attr("y1", 0)
            .attr("x2", xScale(0))
            .attr("y2", innerHeight)
            .style("stroke", fillStyle.zeroLineColor)
            .style("stroke-width", 1)
            .style("opacity", 0.8);
    }
    if (yScale.domain()[0] <= 0 && yScale.domain()[1] >= 0) {
        mainChartGroup.append("line")
            .attr("class", "reference-line zero-y-axis")
            .attr("x1", 0)
            .attr("y1", yScale(0))
            .attr("x2", innerWidth)
            .attr("y2", yScale(0))
            .style("stroke", fillStyle.zeroLineColor)
            .style("stroke-width", 1)
            .style("opacity", 0.8);
    }
    
    // Axis Titles
    if (xAxisTitleText) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title x-axis-title")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight + chartMargins.bottom - 15) // Adjusted position
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(xAxisTitleText);
    }

    if (yAxisTitleText) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title y-axis-title")
            .attr("transform", "rotate(-90)")
            .attr("x", -innerHeight / 2)
            .attr("y", -chartMargins.left + parseInt(fillStyle.typography.labelFontSize) + 5) // Adjusted position
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(yAxisTitleText);
    }

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const numPoints = chartDataArray.length;
    const circleRadius = numPoints <= 15 ? 15 : Math.max(10, 15 - (numPoints - 15) / 20);

    const pointsGroup = mainChartGroup.selectAll(".data-point-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "mark data-point-group")
        .attr("transform", d => `translate(${xScale(d[xValueField])}, ${yScale(d[yValueField])})`);

    pointsGroup.append("circle")
        .attr("class", "mark point-background")
        .attr("r", circleRadius)
        .attr("fill", fillStyle.pointBackgroundColor)
        .attr("stroke", fillStyle.pointStrokeColor) // Original had white stroke
        .attr("stroke-width", 4);

    pointsGroup.each(function(d) {
        const iconUrl = imagesInput.field && imagesInput.field[d[categoryField]] 
                        ? imagesInput.field[d[categoryField]]
                        : (imagesInput.other && imagesInput.other.primary ? imagesInput.other.primary : null);
        if (iconUrl) {
            d3.select(this).append("image")
                .attr("class", "icon point-icon")
                .attr("xlink:href", iconUrl)
                .attr("width", circleRadius * 2)
                .attr("height", circleRadius * 2)
                .attr("x", -circleRadius)
                .attr("y", -circleRadius);
        }
    });
    
    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    let labelPositions = {};
    chartDataArray.forEach(d => {
        labelPositions[d[categoryField]] = findOptimalPosition(
            d, 
            chartDataArray, 
            labelPositions,
            { xScale, yScale },
            { chartWidth: innerWidth, chartHeight: innerHeight },
            circleRadius
        );
    });

    pointsGroup.append("text")
        .attr("class", "label data-label")
        .attr("x", d => labelPositions[d[categoryField]].x)
        .attr("y", d => labelPositions[d[categoryField]].y)
        .attr("text-anchor", d => labelPositions[d[categoryField]].anchor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .style("opacity", d => labelPositions[d[categoryField]].canShow ? 1 : 0)
        .text(d => d[categoryField]);

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}