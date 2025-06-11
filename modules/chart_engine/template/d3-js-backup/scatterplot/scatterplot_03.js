/* REQUIREMENTS_BEGIN
{
  "chart_type": "Scatterplot",
  "chart_name": "scatterplot_03",
  "is_composite": false,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[8, 50], [0, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 750,
  "min_width": 750,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
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

    const categoryRoleName = "x"; // Role for category, icons, labels
    const xAxisValueRoleName = "y"; // Role for X-axis numerical data
    const yAxisValueRoleName = "y2"; // Role for Y-axis numerical data & size

    const categoryColumn = dataColumns.find(col => col.role === categoryRoleName);
    const xValueColumn = dataColumns.find(col => col.role === xAxisValueRoleName);
    const yValueColumn = dataColumns.find(col => col.role === yAxisValueRoleName);

    const categoryFieldIdentifier = categoryColumn ? categoryColumn.name : undefined;
    const xAxisValueFieldIdentifier = xValueColumn ? xValueColumn.name : undefined;
    const yAxisValueFieldIdentifier = yValueColumn ? yValueColumn.name : undefined;
    
    const categoryFieldLabel = categoryColumn?.label || categoryFieldIdentifier;
    const xAxisValueFieldLabel = xValueColumn?.label || xAxisValueFieldIdentifier;
    const yAxisValueFieldLabel = yValueColumn?.label || yAxisValueFieldIdentifier;


    if (!categoryFieldIdentifier || !xAxisValueFieldIdentifier || !yAxisValueFieldIdentifier) {
        const missingFields = [];
        if (!categoryFieldIdentifier) missingFields.push(`field with role '${categoryRoleName}'`);
        if (!xAxisValueFieldIdentifier) missingFields.push(`field with role '${xAxisValueRoleName}'`);
        if (!yAxisValueFieldIdentifier) missingFields.push(`field with role '${yAxisValueRoleName}'`);
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) || '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) || 'bold',
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        backgroundColor: colorsInput.background_color || '#FFFFFF',
        primaryColor: (colorsInput.other && colorsInput.other.primary) || '#007bff',
        gridLineColor: colorsInput.text_color ? d3.color(colorsInput.text_color).copy({opacity: 0.2}).toString() : 'rgba(0,0,0,0.1)',
        defaultCategoricalColor: '#CCCCCC',
        getCategoryColor: (categoryKey) => {
            if (colorsInput.field && colorsInput.field[categoryKey]) {
                return colorsInput.field[categoryKey];
            }
            if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                // Simple hash to pick a color, not ideal but works without index
                let hash = 0;
                for (let i = 0; i < categoryKey.length; i++) {
                    hash = categoryKey.charCodeAt(i) + ((hash << 5) - hash);
                }
                return colorsInput.available_colors[Math.abs(hash) % colorsInput.available_colors.length];
            }
            return fillStyle.defaultCategoricalColor;
        },
        getIconUrl: (categoryKey) => {
            if (imagesInput.field && imagesInput.field[categoryKey]) {
                return imagesInput.field[categoryKey];
            }
            // No general fallback icon specified in requirements for field-specific icons
            return null; 
        }
    };

    function estimateTextDimensions(text, fontFamily, fontSize, fontWeight = 'normal') {
        if (!text) return { width: 0, height: 0 };
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        tempSvg.appendChild(textEl);
        // document.body.appendChild(tempSvg); // Temporarily append for reliable getBBox
        let bbox = { width: 0, height: 0 };
        try {
            bbox = textEl.getBBox();
        } catch (e) {
            console.warn("Could not measure text dimensions in-memory:", e);
            // Fallback: estimate based on character count and font size (crude)
            const avgCharWidth = parseFloat(fontSize) * 0.6;
            const avgCharHeight = parseFloat(fontSize);
            bbox.width = text.length * avgCharWidth;
            bbox.height = avgCharHeight;
        }
        // tempSvg.remove(); // Remove if appended
        return { width: bbox.width, height: bbox.height };
    }
    
    function hasNegativeOrZeroValues(data, field) {
        return data.some(d => d[field] < 1);
    }

    function isDistributionUneven(data, field) {
        const values = data.map(d => d[field]).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
        if (values.length < 2) return false;
        const extent = d3.extent(values);
        const range = extent[1] - extent[0];
        if (range === 0) return false;
        const median = d3.median(values);
        const q1 = d3.quantile(values.sort(d3.ascending), 0.25);
        const q3 = d3.quantile(values.sort(d3.ascending), 0.75);
        const iqr = q3 - q1;
        if (iqr === 0) return range > 0; // If IQR is 0 but range is not, it's uneven
        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1]) / 2) > range * 0.2;
    }

    function wrapTextAtDelimiters(textSelection) {
        textSelection.each(function() {
            const textElement = d3.select(this);
            const originalText = textElement.text();
            if (!originalText) return;

            const hasDelimiter = originalText.includes(',') || originalText.includes('(');
            if (hasDelimiter) {
                let firstLine = "";
                let secondLine = "";
                let delimiterFound = false;
                for (let i = 0; i < originalText.length; i++) {
                    const char = originalText[i];
                    if (!delimiterFound && (char === ',' || char === '(')) {
                        firstLine += char;
                        delimiterFound = true;
                    } else if (delimiterFound) {
                        secondLine += char;
                    } else {
                        firstLine += char;
                    }
                }
                textElement.text(null);
                textElement.append("tspan").attr("x", 0).attr("dy", "0em").text(firstLine.trim()).attr("class", "text");
                if (secondLine) {
                    textElement.append("tspan").attr("x", 0).attr("dy", "1.2em").text(secondLine.trim()).attr("class", "text");
                }
            }
        });
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 750;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 50, bottom: 60, left: 60 }; // Increased margins for labels/titles
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    // (No major transformations beyond filtering for valid data for scales)
    const validChartData = chartDataArray.filter(d => 
        typeof d[xAxisValueFieldIdentifier] === 'number' && !isNaN(d[xAxisValueFieldIdentifier]) &&
        typeof d[yAxisValueFieldIdentifier] === 'number' && !isNaN(d[yAxisValueFieldIdentifier])
    );
    if (validChartData.length === 0 && chartDataArray.length > 0) {
         console.warn("No valid data points to render after filtering.");
         // Optionally render a message in the container
    }


    // Block 6: Scale Definition & Configuration
    const xExtent = d3.extent(validChartData, d => d[xAxisValueFieldIdentifier]);
    const yExtent = d3.extent(validChartData, d => d[yAxisValueFieldIdentifier]);

    const xHasNegativeOrZero = hasNegativeOrZeroValues(validChartData, xAxisValueFieldIdentifier);
    const xIsUneven = isDistributionUneven(validChartData, xAxisValueFieldIdentifier);
    
    let xScale;
    if (xExtent[0] === undefined) { // No valid data
        xScale = d3.scaleLinear().domain([0,1]).range([0, chartWidth]);
    } else if (!xHasNegativeOrZero && xIsUneven) {
        xScale = d3.scaleLog()
            .domain([Math.max(xExtent[0] * 0.9, 0.1), xExtent[1] * 1.1])
            .range([0, chartWidth]).clamp(true);
    } else {
        xScale = d3.scaleLinear()
            .domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1])
            .range([0, chartWidth]);
    }

    const yHasNegativeOrZero = hasNegativeOrZeroValues(validChartData, yAxisValueFieldIdentifier);
    const yIsUneven = isDistributionUneven(validChartData, yAxisValueFieldIdentifier);

    let yScale;
     if (yExtent[0] === undefined) { // No valid data
        yScale = d3.scaleLinear().domain([0,1]).range([chartHeight, 0]);
    } else if (!yHasNegativeOrZero && yIsUneven) {
        yScale = d3.scaleLog()
            .domain([Math.max(yExtent[0] * 0.9, 0.1), yExtent[1] * 1.1])
            .range([chartHeight, 0]).clamp(true);
    } else {
        yScale = d3.scaleLinear()
            .domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1])
            .range([chartHeight, 0]);
    }
    
    const minY2 = d3.min(validChartData, d => d[yAxisValueFieldIdentifier]);
    const maxY2 = d3.max(validChartData, d => d[yAxisValueFieldIdentifier]);
    
    const radiusScale = d3.scaleLinear()
        .domain([minY2, maxY2])
        .range([10, 25]) // Fixed radius range as per original
        .clamp(true);
    
    const getCircleRadius = d => (minY2 === undefined || maxY2 === undefined || minY2 === maxY2) ? 15 : radiusScale(d[yAxisValueFieldIdentifier]);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    const yAxis = d3.axisLeft(yScale).tickSize(0).tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis);
    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll("text")
        .attr("class", "label axis-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);
    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll("text")
        .attr("class", "label axis-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);

    mainChartGroup.selectAll(".h-grid-line")
        .data(yScale.ticks(4)) // Use scale's ticks for gridlines
        .enter().append("line")
        .attr("class", "grid-line horizontal")
        .attr("x1", 0).attr("x2", chartWidth)
        .attr("y1", d => yScale(d)).attr("y2", d => yScale(d))
        .style("stroke", fillStyle.gridLineColor).style("stroke-width", 0.5);

    mainChartGroup.selectAll(".v-grid-line")
        .data(xScale.ticks(4)) // Use scale's ticks for gridlines
        .enter().append("line")
        .attr("class", "grid-line vertical")
        .attr("x1", d => xScale(d)).attr("x2", d => xScale(d))
        .attr("y1", 0).attr("y2", chartHeight)
        .style("stroke", fillStyle.gridLineColor).style("stroke-width", 0.5);

    if (xAxisValueFieldLabel) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title")
            .attr("x", chartWidth)
            .attr("y", chartHeight + chartMargins.bottom / 2 + 10) // Adjusted position
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(xAxisValueFieldLabel);
    }

    if (yAxisValueFieldLabel) {
        const yAxisTitle = mainChartGroup.append("text")
            .attr("class", "label axis-title")
            .attr("x", 0)
            .attr("y", -chartMargins.top / 2)
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(yAxisValueFieldLabel);
        yAxisTitle.call(wrapTextAtDelimiters);
    }
    
    // Helper function for label positioning (defined here as it uses scales and chart dimensions)
    function findOptimalPosition(d, allPoints, currentPositions = {}, radius, 
                                 xScaleFn, yScaleFn, plotWidth, plotHeight, 
                                 textEstimator, labelFontFamily, labelFontSize, labelFontWeight) {
        const positions = [
            { dx: 20, dy: 4, anchor: "start", priority: 1 },    // right
            { dx: 0, dy: -20, anchor: "middle", priority: 2 },  // top
            { dx: -20, dy: 4, anchor: "end", priority: 3 },     // left
            { dx: 0, dy: 28, anchor: "middle", priority: 4 },   // bottom
            { dx: 15, dy: -15, anchor: "start", priority: 5 },  // top-right (adjusted from original)
            { dx: -15, dy: -15, anchor: "end", priority: 6 },   // top-left (adjusted)
            { dx: -15, dy: 20, anchor: "end", priority: 7 },    // bottom-left (adjusted)
            { dx: 15, dy: 20, anchor: "start", priority: 8 }    // bottom-right (adjusted)
        ];
        
        const pointX = xScaleFn(d[xAxisValueFieldIdentifier]);
        const pointY = yScaleFn(d[yAxisValueFieldIdentifier]);

        if (currentPositions[d[categoryFieldIdentifier]]) {
            return currentPositions[d[categoryFieldIdentifier]];
        }

        const labelText = String(d[categoryFieldIdentifier]);
        const textMetrics = textEstimator(labelText, labelFontFamily, labelFontSize, labelFontWeight);
        const labelWidth = textMetrics.width;
        const labelHeight = textMetrics.height;

        for (const pos of positions) {
            let hasOverlap = false;
            let labelX1, labelY1, labelX2, labelY2;

            if (pos.anchor === "start") { // right, top-right, bottom-right
                labelX1 = pointX + pos.dx;
                labelY1 = pointY + pos.dy - labelHeight / 2; // Vertically center for side labels
                if(pos.dy < -5 || pos.dy > 5) labelY1 = pointY + pos.dy - (pos.dy < 0 ? labelHeight : 0); // Adjust for top/bottom aligned
            } else if (pos.anchor === "middle") { // top, bottom
                labelX1 = pointX + pos.dx - labelWidth / 2;
                labelY1 = pointY + pos.dy - (pos.dy < 0 ? labelHeight : 0);
            } else { // end (left, top-left, bottom-left)
                labelX1 = pointX + pos.dx - labelWidth;
                labelY1 = pointY + pos.dy - labelHeight / 2; // Vertically center for side labels
                 if(pos.dy < -5 || pos.dy > 5) labelY1 = pointY + pos.dy - (pos.dy < 0 ? labelHeight : 0); // Adjust for top/bottom aligned
            }
            
            labelX2 = labelX1 + labelWidth;
            labelY2 = labelY1 + labelHeight;

            if (labelX1 < 0 || labelX2 > plotWidth || labelY1 < 0 || labelY2 > plotHeight) {
                continue;
            }

            for (const p of allPoints) {
                if (p === d) continue;
                const pX = xScaleFn(p[xAxisValueFieldIdentifier]);
                const pY = yScaleFn(p[yAxisValueFieldIdentifier]);
                const pRadius = getCircleRadius(p); // Use getCircleRadius for other points

                // Check overlap with other points (circle)
                // AABB check for label vs circle
                const closestX = Math.max(labelX1, Math.min(pX, labelX2));
                const closestY = Math.max(labelY1, Math.min(pY, labelY2));
                const distanceX = pX - closestX;
                const distanceY = pY - closestY;
                if ((distanceX * distanceX + distanceY * distanceY) < (pRadius * pRadius)) {
                    hasOverlap = true;
                    break;
                }

                // Check overlap with other labels
                const pPos = currentPositions[p[categoryFieldIdentifier]];
                if (pPos && pPos.canShow) {
                    const otherLabelText = String(p[categoryFieldIdentifier]);
                    const otherMetrics = textEstimator(otherLabelText, labelFontFamily, labelFontSize, labelFontWeight);
                    let otherX1, otherY1;
                    if (pPos.anchor === "start") {
                        otherX1 = pX + pPos.dx;
                        otherY1 = pY + pPos.dy - otherMetrics.height / 2;
                         if(pPos.dy < -5 || pPos.dy > 5) otherY1 = pY + pPos.dy - (pPos.dy < 0 ? otherMetrics.height : 0);
                    } else if (pPos.anchor === "middle") {
                        otherX1 = pX + pPos.dx - otherMetrics.width / 2;
                        otherY1 = pY + pPos.dy - (pPos.dy < 0 ? otherMetrics.height : 0);
                    } else { // end
                        otherX1 = pX + pPos.dx - otherMetrics.width;
                        otherY1 = pY + pPos.dy - otherMetrics.height / 2;
                        if(pPos.dy < -5 || pPos.dy > 5) otherY1 = pY + pPos.dy - (pPos.dy < 0 ? otherMetrics.height : 0);
                    }
                    const otherX2 = otherX1 + otherMetrics.width;
                    const otherY2 = otherY1 + otherMetrics.height;

                    if (labelX1 < otherX2 && labelX2 > otherX1 && labelY1 < otherY2 && labelY2 > otherY1) {
                        hasOverlap = true;
                        break;
                    }
                }
            }
            if (!hasOverlap) return { ...pos, canShow: true };
        }
        return { ...positions[0], canShow: false }; // Default to first position, hidden
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const dataPointGroups = mainChartGroup.selectAll(".data-point")
        .data(validChartData, d => d[categoryFieldIdentifier]) // Use key function for object constancy
        .enter()
        .append("g")
        .attr("class", "mark data-point")
        .attr("transform", d => `translate(${xScale(d[xAxisValueFieldIdentifier])}, ${yScale(d[yAxisValueFieldIdentifier])})`);

    dataPointGroups.append("circle")
        .attr("class", "mark circle-mark-background") // Specific class for the background circle
        .attr("r", d => getCircleRadius(d))
        .style("fill", d => fillStyle.getCategoryColor(d[categoryFieldIdentifier]))
        .style("stroke", d => fillStyle.getCategoryColor(d[categoryFieldIdentifier]))
        .style("stroke-width", 8); // Fixed stroke width as per original

    dataPointGroups.each(function(d) {
        const iconUrl = fillStyle.getIconUrl(d[categoryFieldIdentifier]);
        if (iconUrl) {
            d3.select(this).append("image")
                .attr("class", "icon data-icon")
                .attr("xlink:href", iconUrl)
                .attr("width", d => getCircleRadius(d) * 1.5) // Slightly smaller than background circle for better visibility
                .attr("height", d => getCircleRadius(d) * 1.5)
                .attr("x", d => -getCircleRadius(d) * 0.75)
                .attr("y", d => -getCircleRadius(d) * 0.75);
        }
    });
    
    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    let labelPositions = {};
    validChartData.forEach(d => {
        labelPositions[d[categoryFieldIdentifier]] = findOptimalPosition(
            d, validChartData, labelPositions, getCircleRadius(d),
            xScale, yScale, chartWidth, chartHeight,
            estimateTextDimensions, 
            fillStyle.typography.annotationFontFamily, 
            fillStyle.typography.annotationFontSize,
            fillStyle.typography.annotationFontWeight
        );
    });

    dataPointGroups.append("text")
        .attr("class", "label data-label")
        .attr("x", d => labelPositions[d[categoryFieldIdentifier]].dx)
        .attr("y", d => labelPositions[d[categoryFieldIdentifier]].dy)
        .attr("text-anchor", d => labelPositions[d[categoryFieldIdentifier]].anchor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .style("opacity", d => labelPositions[d[categoryFieldIdentifier]].canShow ? 1 : 0)
        .text(d => d[categoryFieldIdentifier]);

    const tooltip = d3.select("body").selectAll(".chart-tooltip-scatterplot_03").data([null])
        .join("div") // Use join for enter/update
        .attr("class", "tooltip chart-tooltip-scatterplot_03") // Unique class for this chart type's tooltip
        .style("opacity", 0)
        .style("position", "absolute")
        .style("padding", "8px")
        .style("background-color", "rgba(0,0,0,0.75)")
        .style("color", "white")
        .style("border-radius", "4px")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("pointer-events", "none"); // So it doesn't interfere with mouse events on elements underneath

    dataPointGroups
        .on("mouseover", function(event, d) {
            const pointGroup = d3.select(this);
            pointGroup.select(".data-icon") // Assuming icon class is 'data-icon'
                .transition().duration(100)
                .attr("width", getCircleRadius(d) * 2) // Enlarge icon
                .attr("height", getCircleRadius(d) * 2)
                .attr("x", -getCircleRadius(d))
                .attr("y", -getCircleRadius(d));
            
            pointGroup.select(".data-label")
                .style("font-weight", "bold");

            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip.html(`<strong>${d[categoryFieldIdentifier]}</strong><br/>
                          ${xAxisValueFieldLabel || xAxisValueFieldIdentifier}: ${d[xAxisValueFieldIdentifier]}<br/>
                          ${yAxisValueFieldLabel || yAxisValueFieldIdentifier}: ${d[yAxisValueFieldIdentifier]}`)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(event, d) {
            const pointGroup = d3.select(this);
            pointGroup.select(".data-icon")
                .transition().duration(100)
                .attr("width", getCircleRadius(d) * 1.5) // Restore original size
                .attr("height", getCircleRadius(d) * 1.5)
                .attr("x", -getCircleRadius(d) * 0.75)
                .attr("y", -getCircleRadius(d) * 0.75);

            pointGroup.select(".data-label")
                .style("font-weight", fillStyle.typography.annotationFontWeight); // Restore original weight

            tooltip.transition().duration(500).style("opacity", 0);
        });

    // Block 10: Cleanup & SVG Node Return
    // Tooltip is on body, managed by mouse events. No specific cleanup here unless chart is destroyed.
    return svgRoot.node();
}