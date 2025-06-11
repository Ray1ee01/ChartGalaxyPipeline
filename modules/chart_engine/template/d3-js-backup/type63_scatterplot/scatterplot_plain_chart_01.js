/* REQUIREMENTS_BEGIN
{
  "chart_type": "Scatterplot",
  "chart_name": "scatterplot_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[8, 150], [0, "inf"], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 750,
  "min_width": 750,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
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
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme preference if colors_dark exists
    const imagesInput = data.images || {}; // Not used in this chart but parsed for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const labelFieldDef = dataColumns.find(col => col.role === 'x');
    const xValueFieldDef = dataColumns.find(col => col.role === 'y');
    const yValueFieldDef = dataColumns.find(col => col.role === 'y2');

    if (!labelFieldDef || !xValueFieldDef || !yValueFieldDef) {
        const missing = [
            !labelFieldDef ? "label field (role 'x')" : null,
            !xValueFieldDef ? "x-value field (role 'y')" : null,
            !yValueFieldDef ? "y-value field (role 'y2')" : null
        ].filter(Boolean).join(', ');
        const errorMsg = `Critical chart config missing: ${missing}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const labelFieldName = labelFieldDef.name;
    const xValueFieldName = xValueFieldDef.name;
    const yValueFieldName = yValueFieldDef.name;

    const xValueLabel = xValueFieldDef.label || xValueFieldName;
    const yValueLabel = yValueFieldDef.label || yValueFieldName;
    
    // Filter out data points with invalid/missing critical values for scaling
    const chartDataArray = rawChartData.filter(d => 
        d[xValueFieldName] != null && !isNaN(parseFloat(d[xValueFieldName])) &&
        d[yValueFieldName] != null && !isNaN(parseFloat(d[yValueFieldName])) &&
        d[labelFieldName] != null
    );


    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        background_color: "transparent", // Changed from #FFFFFF to transparent for SVG
        text_color: "#0f223b"
    };

    const fillStyle = {
        pointColor: (colorsInput.other && colorsInput.other.primary) || defaultColors.other.primary,
        axisLineColor: colorsInput.text_color || defaultColors.text_color,
        axisTextColor: colorsInput.text_color || defaultColors.text_color,
        dataLabelColor: colorsInput.text_color || defaultColors.text_color,
        chartBackground: colorsInput.background_color || defaultColors.background_color,
        typography: {
            axisLabelFontFamily: (typographyInput.label && typographyInput.label.font_family) || defaultTypography.label.font_family,
            axisLabelFontSize: (typographyInput.label && typographyInput.label.font_size) || defaultTypography.label.font_size,
            axisLabelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || defaultTypography.label.font_weight,
            
            dataLabelFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || defaultTypography.annotation.font_family,
            dataLabelFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || defaultTypography.annotation.font_size,
            dataLabelFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || defaultTypography.annotation.font_weight,
        }
    };
    
    const estimateTextDimensions = (text, fontSize, fontFamily, fontWeight = 'normal') => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.position = 'absolute'; // Ensure it doesn't affect layout if accidentally visible
        // tempSvg.style.visibility = 'hidden'; // Hide it
        // tempSvg.style.left = '-9999px';
        // tempSvg.style.top = '-9999px';

        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // document.body.appendChild(tempSvg); // Temporarily append to getBBox accurately
        const bbox = tempText.getBBox();
        // document.body.removeChild(tempSvg); // Clean up
        return { width: bbox.width, height: bbox.height, x: bbox.x, y: bbox.y };
    };


    const hasNegativeOrZeroValues = (data, field) => data.some(d => parseFloat(d[field]) < 1);
    const isDistributionUneven = (data, field) => {
        const values = data.map(d => parseFloat(d[field])).filter(v => !isNaN(v) && v > 0); // Filter for log scale
        if (values.length < 3) return false; // Not enough data for meaningful stats
        const extent = d3.extent(values);
        if (extent[0] == null || extent[1] == null) return false;
        const range = extent[1] - extent[0];
        if (range === 0) return false;
        const median = d3.median(values);
        const q1 = d3.quantile(values.sort(d3.ascending), 0.25);
        const q3 = d3.quantile(values.sort(d3.ascending), 0.75);
        if (q1 == null || q3 == null || median == null) return false;
        const iqr = q3 - q1;
        if (iqr === 0 && range > 0) return true; // All values same except min/max, treat as uneven
        if (iqr === 0) return false;
        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1]) / 2) > range * 0.2;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 750;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 25, right: 25, bottom: 60, left: 70 }; // Increased bottom/left for axis titles
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const numPoints = chartDataArray.length;
    let circleRadius;
    if (numPoints <= 10) {
        circleRadius = 18 - numPoints * 0.6;
    } else {
        circleRadius = 12 - (numPoints - 10) * 0.3;
    }
    circleRadius = Math.max(1.5, Math.min(18, circleRadius));

    // findOptimalLabelPosition needs scales, so define scales first, then positions
    // This means moving label position calculation after scale definition or passing scales to it.
    // For now, we'll define scales in Block 6 and then calculate positions.

    // Block 6: Scale Definition & Configuration
    if (chartDataArray.length === 0) {
        // Handle empty data case: render axes with default domains if desired, or show message
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("class", "text")
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", "16px") // Larger message for no data
            .style("fill", fillStyle.axisTextColor)
            .text("No data available to display.");
        return svgRoot.node();
    }
    
    const xExtent = d3.extent(chartDataArray, d => parseFloat(d[xValueFieldName]));
    const yExtent = d3.extent(chartDataArray, d => parseFloat(d[yValueFieldName]));

    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartDataArray, xValueFieldName);
    const xIsUneven = isDistributionUneven(chartDataArray, xValueFieldName);
    
    const xScale = (!xHasNegativeOrZero && xIsUneven)
        ? d3.scaleLog()
            .domain([Math.max(xExtent[0] * 0.9, 0.01), xExtent[1] * 1.1]) // Ensure min domain > 0 for log
            .range([0, innerWidth])
            .clamp(true)
        : d3.scaleLinear()
            .domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1 || 0, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1 || 1])
            .range([0, innerWidth]);

    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartDataArray, yValueFieldName);
    const yIsUneven = isDistributionUneven(chartDataArray, yValueFieldName);

    const yScale = (!yHasNegativeOrZero && yIsUneven)
        ? d3.scaleLog()
            .domain([Math.max(yExtent[0] * 0.9, 0.01), yExtent[1] * 1.1]) // Ensure min domain > 0 for log
            .range([innerHeight, 0])
            .clamp(true)
        : d3.scaleLinear()
            .domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1 || 0, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1 || 1])
            .range([innerHeight, 0]);


    // Now, back to label positioning (effectively part of Block 5 or 9)
    const findOptimalLabelPosition = (d, allPoints, currentPositions, scales, dimensions) => {
        const candidateOffsets = [ // dx, dy, anchor, priority
            { dx: circleRadius + 5, dy: 0, anchor: "start", priority: 1 },
            { dx: 0, dy: -(circleRadius + 5), anchor: "middle", priority: 2 },
            { dx: -(circleRadius + 5), dy: 0, anchor: "end", priority: 3 },
            { dx: 0, dy: circleRadius + 5, anchor: "middle", priority: 4 },
            { dx: circleRadius + 3, dy: -(circleRadius + 3), anchor: "start", priority: 5 },
            { dx: -(circleRadius + 3), dy: -(circleRadius + 3), anchor: "end", priority: 6 },
            { dx: -(circleRadius + 3), dy: circleRadius + 3, anchor: "end", priority: 7 },
            { dx: circleRadius + 3, dy: circleRadius + 3, anchor: "start", priority: 8 }
        ];

        const pointX = scales.xScale(parseFloat(d[xValueFieldName]));
        const pointY = scales.yScale(parseFloat(d[yValueFieldName]));
        const labelText = String(d[labelFieldName]);

        const textMetrics = estimateTextDimensions(
            labelText, 
            fillStyle.typography.dataLabelFontSize, 
            fillStyle.typography.dataLabelFontFamily,
            fillStyle.typography.dataLabelFontWeight
        );
        const labelWidth = textMetrics.width;
        const labelHeight = textMetrics.height; // Full height from bbox

        for (const offset of candidateOffsets) {
            let hasOverlap = false;
            
            const textAttachX = pointX + offset.dx;
            const textAttachY = pointY + offset.dy;

            let currentLabelBox;
            if (offset.anchor === "start") {
                currentLabelBox = { x1: textAttachX, y1: textAttachY - labelHeight / 2, x2: textAttachX + labelWidth, y2: textAttachY + labelHeight / 2 };
            } else if (offset.anchor === "middle") {
                currentLabelBox = { x1: textAttachX - labelWidth / 2, y1: textAttachY - labelHeight / 2, x2: textAttachX + labelWidth / 2, y2: textAttachY + labelHeight / 2 };
            } else { // end
                currentLabelBox = { x1: textAttachX - labelWidth, y1: textAttachY - labelHeight / 2, x2: textAttachX, y2: textAttachY + labelHeight / 2 };
            }
            
            // Boundary check
            if (currentLabelBox.x1 < 0 || currentLabelBox.x2 > dimensions.innerWidth || currentLabelBox.y1 < 0 || currentLabelBox.y2 > dimensions.innerHeight) {
                continue;
            }

            // Check overlap with other points
            for (const p of allPoints) {
                if (p === d) continue;
                const pX = scales.xScale(parseFloat(p[xValueFieldName]));
                const pY = scales.yScale(parseFloat(p[yValueFieldName]));
                
                // Simplified: check if label box overlaps point circle's bounding box
                if (currentLabelBox.x1 < pX + circleRadius && currentLabelBox.x2 > pX - circleRadius &&
                    currentLabelBox.y1 < pY + circleRadius && currentLabelBox.y2 > pY - circleRadius) {
                    hasOverlap = true;
                    break;
                }
            }
            if (hasOverlap) continue;

            // Check overlap with other labels
            for (const pKey in currentPositions) {
                if (pKey === d[labelFieldName]) continue; // Should be unique ID if labels can be same
                
                const pData = allPoints.find(item => String(item[labelFieldName]) === pKey); // Find data for this positioned label
                if (!pData) continue;

                const pPos = currentPositions[pKey];
                const pScreenX = scales.xScale(parseFloat(pData[xValueFieldName]));
                const pScreenY = scales.yScale(parseFloat(pData[yValueFieldName]));
                const otherLabelText = String(pData[labelFieldName]);

                const otherTextMetrics = estimateTextDimensions(
                    otherLabelText, 
                    fillStyle.typography.dataLabelFontSize, 
                    fillStyle.typography.dataLabelFontFamily,
                    fillStyle.typography.dataLabelFontWeight
                );
                const otherLabelWidth = otherTextMetrics.width;
                const otherLabelHeight = otherTextMetrics.height;
                
                const otherAttachX = pScreenX + pPos.dx;
                const otherAttachY = pScreenY + pPos.dy;
                
                let otherLabelBox;
                 if (pPos.anchor === "start") {
                    otherLabelBox = { x1: otherAttachX, y1: otherAttachY - otherLabelHeight / 2, x2: otherAttachX + otherLabelWidth, y2: otherAttachY + otherLabelHeight / 2 };
                } else if (pPos.anchor === "middle") {
                    otherLabelBox = { x1: otherAttachX - otherLabelWidth / 2, y1: otherAttachY - otherLabelHeight / 2, x2: otherAttachX + otherLabelWidth / 2, y2: otherAttachY + otherLabelHeight / 2 };
                } else { // end
                    otherLabelBox = { x1: otherAttachX - otherLabelWidth, y1: otherAttachY - otherLabelHeight / 2, x2: otherAttachX, y2: otherAttachY + otherLabelHeight / 2 };
                }

                if (currentLabelBox.x1 < otherLabelBox.x2 && currentLabelBox.x2 > otherLabelBox.x1 &&
                    currentLabelBox.y1 < otherLabelBox.y2 && currentLabelBox.y2 > otherLabelBox.y1) {
                    hasOverlap = true;
                    break;
                }
            }
            if (!hasOverlap) {
                return { ...offset, canShow: true };
            }
        }
        return { ...candidateOffsets[0], canShow: false }; // Default, hidden
    };

    let labelPositions = {};
    chartDataArray.forEach(d => {
        // Ensure unique key for labelPositions if labels can be non-unique
        const key = String(d[labelFieldName]); // Assuming labelFieldName provides unique enough keys for this context
        labelPositions[key] = findOptimalLabelPosition(
            d, 
            chartDataArray, 
            labelPositions,
            { xScale, yScale },
            { innerWidth, innerHeight }
        );
    });


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxis = d3.axisBottom(xScale).tickSizeOuter(0).tickPadding(10);
    const yAxis = d3.axisLeft(yScale).tickSizeOuter(0).tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("path")
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1)
        .style("opacity", 0.7);

    xAxisGroup.selectAll("line") // Tick lines
        .style("stroke", fillStyle.axisLineColor)
        .style("opacity", 0.5);

    xAxisGroup.selectAll("text")
        .attr("class", "value")
        .style("fill", fillStyle.axisTextColor)
        .style("font-family", fillStyle.typography.axisLabelFontFamily)
        .style("font-size", fillStyle.typography.axisLabelFontSize)
        .style("font-weight", fillStyle.typography.axisLabelFontWeight);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    yAxisGroup.selectAll("path")
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1)
        .style("opacity", 0.7);
    
    yAxisGroup.selectAll("line") // Tick lines
        .style("stroke", fillStyle.axisLineColor)
        .style("opacity", 0.5);

    yAxisGroup.selectAll("text")
        .attr("class", "value")
        .style("fill", fillStyle.axisTextColor)
        .style("font-family", fillStyle.typography.axisLabelFontFamily)
        .style("font-size", fillStyle.typography.axisLabelFontSize)
        .style("font-weight", fillStyle.typography.axisLabelFontWeight);

    // Axis Titles
    mainChartGroup.append("text")
        .attr("class", "text axis-title")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + chartMargins.bottom - 15) // Adjusted position
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.axisLabelFontFamily)
        .style("font-size", fillStyle.typography.axisLabelFontSize) // Use consistent size
        .style("font-weight", "bold") // Make titles bold
        .style("fill", fillStyle.axisTextColor)
        .text(xValueLabel);

    mainChartGroup.append("text")
        .attr("class", "text axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -chartMargins.left + 20) // Adjusted position
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.axisLabelFontFamily)
        .style("font-size", fillStyle.typography.axisLabelFontSize)
        .style("font-weight", "bold")
        .style("fill", fillStyle.axisTextColor)
        .text(yValueLabel);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const pointsGroup = mainChartGroup.append("g").attr("class", "points-group");

    const pointElements = pointsGroup.selectAll(".data-point-group")
        .data(chartDataArray, d => String(d[labelFieldName])) // Use key for object constancy
        .enter()
        .append("g")
        .attr("class", "data-point-group")
        .attr("transform", d => {
            const xVal = parseFloat(d[xValueFieldName]);
            const yVal = parseFloat(d[yValueFieldName]);
            // Ensure values are within scale domains if clamping is not enough or for log scales with 0
            const clampedX = Math.max(xScale.domain()[0], Math.min(xScale.domain()[1], xVal));
            const clampedY = Math.max(yScale.domain()[0], Math.min(yScale.domain()[1], yVal));
            return `translate(${xScale(clampedX)}, ${yScale(clampedY)})`;
        });

    pointElements.append("circle")
        .attr("class", "mark data-point-circle")
        .attr("r", circleRadius)
        .attr("fill", fillStyle.pointColor);

    pointElements.append("text")
        .attr("class", "label data-point-label")
        .attr("x", d => {
            const pos = labelPositions[String(d[labelFieldName])];
            return pos ? pos.dx : 0;
        })
        .attr("y", d => {
            const pos = labelPositions[String(d[labelFieldName])];
            // Adjust y for dominant-baseline if needed, or assume dy is for baseline
            // For simplicity, using dy as is, assuming it's for baseline.
            // For vertical centering with anchor middle, dominant-baseline="middle" is better.
            // Here, we use dy to offset from point center, and text-anchor handles horizontal.
            // Vertical alignment of text box is approximated in findOptimalLabelPosition.
            return pos ? pos.dy : 0;
        })
        .attr("text-anchor", d => {
            const pos = labelPositions[String(d[labelFieldName])];
            return pos ? pos.anchor : "start";
        })
        .attr("dominant-baseline", d => { // Helps with vertical alignment for middle anchors
            const pos = labelPositions[String(d[labelFieldName])];
            return (pos && (pos.anchor === "middle" || pos.dy !== 0)) ? "middle" : "alphabetic";
        })
        .style("font-family", fillStyle.typography.dataLabelFontFamily)
        .style("font-size", fillStyle.typography.dataLabelFontSize)
        .style("font-weight", fillStyle.typography.dataLabelFontWeight)
        .style("fill", fillStyle.dataLabelColor)
        .style("opacity", d => {
            const pos = labelPositions[String(d[labelFieldName])];
            return pos && pos.canShow ? 1 : 0;
        })
        .text(d => String(d[labelFieldName]));

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Label optimization is handled above. No other enhancements specified.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}