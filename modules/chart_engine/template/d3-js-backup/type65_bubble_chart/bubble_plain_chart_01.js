/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bubble Chart",
  "chart_name": "bubble_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
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
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataTypography = data.typography || {};
    const dataColors = data.colors || {};
    // const dataImages = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const xValueFieldDef = dataColumns.find(col => col.role === "y");
    const yValueFieldDef = dataColumns.find(col => col.role === "y2"); // y2 is for y-axis and bubble size

    const missingFields = [];
    if (!categoryFieldDef) missingFields.push("x (category)");
    if (!xValueFieldDef) missingFields.push("y (x-value)");
    if (!yValueFieldDef) missingFields.push("y2 (y-value/size)");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: Roles ${missingFields.join(', ')} not found in data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const xValueFieldName = xValueFieldDef.name;
    const yValueFieldName = yValueFieldDef.name; // Used for Y-axis and bubble radius

    const xValueAxisTitle = xValueFieldDef.label || xValueFieldName;
    const yValueAxisTitle = yValueFieldDef.label || yValueFieldName;


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }, // Original used 10px for data labels
        axisLabel: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" }, // For axis tick labels
        axisTitle: { font_family: "Arial, sans-serif", font_size: "13px", font_weight: "normal" } // For axis titles
    };

    fillStyle.typography.labelFontFamily = (dataTypography.label && dataTypography.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (dataTypography.label && dataTypography.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (dataTypography.label && dataTypography.label.font_weight) || defaultTypography.label.font_weight;

    fillStyle.typography.axisLabelFontFamily = (dataTypography.label && dataTypography.label.font_family) || defaultTypography.axisLabel.font_family;
    fillStyle.typography.axisLabelFontSize = (dataTypography.label && dataTypography.label.font_size) || defaultTypography.axisLabel.font_size;
    fillStyle.typography.axisLabelFontWeight = (dataTypography.label && dataTypography.label.font_weight) || defaultTypography.axisLabel.font_weight;
    
    fillStyle.typography.axisTitleFontFamily = (dataTypography.title && dataTypography.title.font_family) || defaultTypography.axisTitle.font_family; // Using title for axis titles as per original font size
    fillStyle.typography.axisTitleFontSize = (dataTypography.title && dataTypography.title.font_size) || defaultTypography.axisTitle.font_size;
    fillStyle.typography.axisTitleFontWeight = (dataTypography.title && dataTypography.title.font_weight) || defaultTypography.axisTitle.font_weight;


    fillStyle.colors.textColor = dataColors.text_color || "#0f223b";
    fillStyle.colors.primary = (dataColors.other && dataColors.other.primary) || "#1f77b4";
    fillStyle.colors.chartBackground = dataColors.background_color || "#FFFFFF";
    fillStyle.colors.axisLine = dataColors.text_color || "#0f223b"; // Original used text_color for axis lines

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fontProps.font_family); // Allow both conventions
        tempText.setAttribute('font-size', fontProps.fontSize || fontProps.font_size);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fontProps.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            console.warn("getBBox failed for off-DOM SVG text measurement. Using fallback.", e);
            const fontSizeNumeric = parseFloat(fontProps.fontSize || fontProps.font_size) || 10;
            width = String(text).length * fontSizeNumeric * 0.6;
        }
        return width;
    }

    function hasNegativeOrZeroValues(data, field) {
        return data.some(d => d[field] <= 0);
    }

    function isDistributionUneven(data, field) {
        if (data.length < 3) return false; // Not enough data to determine unevenness
        const values = data.map(d => d[field]).filter(v => typeof v === 'number' && isFinite(v));
        if (values.length < 3) return false;
        const extent = d3.extent(values);
        if (extent[0] === undefined || extent[1] === undefined) return false;
        const range = extent[1] - extent[0];
        if (range === 0) return false; // All values are the same

        const median = d3.median(values);
        const q1 = d3.quantile(values.sort(d3.ascending), 0.25);
        const q3 = d3.quantile(values.sort(d3.ascending), 0.75);
        if (q1 === undefined || q3 === undefined || median === undefined) return false;
        
        const iqr = q3 - q1;
        if (iqr === 0 && range > 0) return true; // Indicates extreme outliers if IQR is 0 but range is not
        if (iqr === 0 && range === 0) return false;

        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1]) / 2) > range * 0.2;
    }

    function findOptimalLabelPosition(d, allPointsData, currentXScale, currentYScale, catField, valXField, valYField, rScale, chartInnerWidth, chartInnerHeight, labelTypo, textEstimator, placedRects) {
        const candidateOffsets = [ // { dx, dy, anchor, priority }
            { dx: 20, dy: 4, anchor: "start", priority: 1 },   // Right, slightly down
            { dx: 0, dy: -20, anchor: "middle", priority: 2 }, // Above
            { dx: -20, dy: 4, anchor: "end", priority: 3 },    // Left, slightly down
            { dx: 0, dy: 28, anchor: "middle", priority: 4 },  // Below
            { dx: 20, dy: -20, anchor: "start", priority: 5 }, // Top-right
            { dx: -20, dy: -20, anchor: "end", priority: 6 },  // Top-left
            { dx: -20, dy: 28, anchor: "end", priority: 7 },   // Bottom-left
            { dx: 20, dy: 28, anchor: "start", priority: 8 }   // Bottom-right
        ];

        const pointX = currentXScale(d[valXField]);
        const pointY = currentYScale(d[valYField]);
        const textContent = String(d[catField] || "");
        
        const labelWidth = textEstimator(textContent, labelTypo);
        const labelHeight = parseFloat(labelTypo.fontSize || labelTypo.font_size) * 1.2; // Approx height

        for (const offset of candidateOffsets) {
            let prospectiveX = pointX + offset.dx;
            let prospectiveY = pointY + offset.dy;
            let labelX1, labelY1, labelX2, labelY2;

            // Calculate AABB for the label at this prospective position
            if (offset.anchor === "start") {
                labelX1 = prospectiveX;
                labelY1 = prospectiveY - labelHeight / 2; // Assuming dy is baseline offset
            } else if (offset.anchor === "middle") {
                labelX1 = prospectiveX - labelWidth / 2;
                labelY1 = prospectiveY - labelHeight / 2;
            } else { // end
                labelX1 = prospectiveX - labelWidth;
                labelY1 = prospectiveY - labelHeight / 2;
            }
            labelX2 = labelX1 + labelWidth;
            labelY2 = labelY1 + labelHeight;

            // Check 1: Chart boundary collision
            if (labelX1 < 0 || labelX2 > chartInnerWidth || labelY1 < 0 || labelY2 > chartInnerHeight) {
                continue;
            }

            // Check 2: Collision with other already placed labels
            let overlapWithPlacedLabel = false;
            for (const rect of placedRects) {
                if (labelX1 < rect.x2 && labelX2 > rect.x1 && labelY1 < rect.y2 && labelY2 > rect.y1) {
                    overlapWithPlacedLabel = true;
                    break;
                }
            }
            if (overlapWithPlacedLabel) {
                continue;
            }

            // Check 3: Collision with other data points (bubbles)
            // This is a simplified check: does the label's AABB overlap with any other bubble's AABB?
            let overlapWithOtherPoint = false;
            for (const otherPt of allPointsData) {
                if (otherPt === d) continue; // Skip self
                const otherPtX = currentXScale(otherPt[valXField]);
                const otherPtY = currentYScale(otherPt[valYField]);
                const otherPtRadius = rScale(otherPt);
                
                // AABB of other point
                const otherPtX1 = otherPtX - otherPtRadius;
                const otherPtX2 = otherPtX + otherPtRadius;
                const otherPtY1 = otherPtY - otherPtRadius;
                const otherPtY2 = otherPtY + otherPtRadius;

                if (labelX1 < otherPtX2 && labelX2 > otherPtX1 && labelY1 < otherPtY2 && labelY2 > otherPtY1) {
                    overlapWithOtherPoint = true;
                    break;
                }
            }
            if (overlapWithOtherPoint) {
                continue;
            }
            
            // If no collision, this is a good position
            return { x: offset.dx, y: offset.dy, anchor: offset.anchor };
        }
        return null; // No suitable position found (or return first one as fallback if absolutely needed)
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
        .style("background-color", fillStyle.colors.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 25, right: 25, bottom: 60, left: 60 }; // Increased bottom/left for axis titles
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    // (Data is assumed to be mostly ready; type checks implicitly handled by scales)

    // Block 6: Scale Definition & Configuration
    const xExtent = d3.extent(chartDataArray, d => d[xValueFieldName]);
    const yExtent = d3.extent(chartDataArray, d => d[yValueFieldName]);

    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartDataArray, xValueFieldName);
    const xIsUneven = isDistributionUneven(chartDataArray, xValueFieldName);
    
    const xScale = (!xHasNegativeOrZero && xIsUneven && xExtent[0] > 0)
        ? d3.scaleLog().domain([Math.max(xExtent[0] * 0.9, 0.01), xExtent[1] * 1.1]).range([0, innerWidth]).clamp(true)
        : d3.scaleLinear().domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1]).range([0, innerWidth]);

    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartDataArray, yValueFieldName);
    const yIsUneven = isDistributionUneven(chartDataArray, yValueFieldName);

    const yScale = (!yHasNegativeOrZero && yIsUneven && yExtent[0] > 0)
        ? d3.scaleLog().domain([Math.max(yExtent[0] * 0.9, 0.01), yExtent[1] * 1.1]).range([innerHeight, 0]).clamp(true)
        : d3.scaleLinear().domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1]).range([innerHeight, 0]);

    // Radius scale (for bubble size, based on yValueFieldName)
    const numPoints = chartDataArray.length;
    const baseRadius = numPoints <= 15 ? 15 : Math.max(8, 15 - (numPoints - 15) / 10); // Adjusted min radius
    const minPixelRadius = Math.max(3, baseRadius * 0.5); // Ensure min radius is somewhat visible
    const maxPixelRadius = baseRadius * 1.5;
    
    const sizeValueExtent = d3.extent(chartDataArray, d => d[yValueFieldName]); // yValueFieldName is used for size

    let radiusScale;
    if (sizeValueExtent[0] === undefined) { // Handle empty or invalid data for radius
        radiusScale = () => baseRadius;
    } else if (!yHasNegativeOrZero && yIsUneven && sizeValueExtent[0] > 0) { // Use y-axis characteristics for size scale as well
        const areaScale = d3.scaleLog()
            .domain([Math.max(sizeValueExtent[0], 0.01), sizeValueExtent[1] || Math.max(sizeValueExtent[0], 0.01) * 2]) // Handle single point for domain
            .range([minPixelRadius * minPixelRadius, maxPixelRadius * maxPixelRadius])
            .clamp(true);
        radiusScale = d => Math.sqrt(areaScale(Math.max(d[yValueFieldName], 0.01)));
    } else {
        const areaScale = d3.scaleLinear()
            .domain(sizeValueExtent[0] !== sizeValueExtent[1] ? sizeValueExtent : [sizeValueExtent[0] * 0.9, sizeValueExtent[1] * 1.1 || sizeValueExtent[0] *1.1 + 0.1]) // Handle single point
            .range([minPixelRadius * minPixelRadius, maxPixelRadius * maxPixelRadius])
            .clamp(true);
        radiusScale = d => Math.sqrt(areaScale(d[yValueFieldName]));
    }


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGenerator = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    const yAxisGenerator = d3.axisLeft(yScale).tickSize(0).tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxisGenerator);

    xAxisGroup.selectAll("path")
        .style("stroke", fillStyle.colors.axisLine)
        .style("stroke-width", 1)
        .style("opacity", 0.5);
    xAxisGroup.selectAll("text")
        .attr("class", "value")
        .style("fill", fillStyle.colors.textColor)
        .style("font-family", fillStyle.typography.axisLabelFontFamily)
        .style("font-size", fillStyle.typography.axisLabelFontSize)
        .style("font-weight", fillStyle.typography.axisLabelFontWeight);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxisGenerator);

    yAxisGroup.selectAll("path")
        .style("stroke", fillStyle.colors.axisLine)
        .style("stroke-width", 1)
        .style("opacity", 0.5);
    yAxisGroup.selectAll("text")
        .attr("class", "value")
        .style("fill", fillStyle.colors.textColor)
        .style("font-family", fillStyle.typography.axisLabelFontFamily)
        .style("font-size", fillStyle.typography.axisLabelFontSize)
        .style("font-weight", fillStyle.typography.axisLabelFontWeight);

    // Axis Titles
    mainChartGroup.append("text")
        .attr("class", "text axis-title x-axis-title")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + chartMargins.bottom - 15) // Adjusted position
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.axisTitleFontFamily)
        .style("font-size", fillStyle.typography.axisTitleFontSize)
        .style("font-weight", fillStyle.typography.axisTitleFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(xValueAxisTitle);
        
    mainChartGroup.append("text")
        .attr("class", "text axis-title y-axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -chartMargins.left + 20) // Adjusted position
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.axisTitleFontFamily)
        .style("font-size", fillStyle.typography.axisTitleFontSize)
        .style("font-weight", fillStyle.typography.axisTitleFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(yValueAxisTitle);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const bubbleGroups = mainChartGroup.selectAll(".data-point-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "mark data-point-group")
        .attr("transform", d => {
            const xPos = xScale(d[xValueFieldName]);
            const yPos = yScale(d[yValueFieldName]);
            // Ensure positions are finite, otherwise default to 0,0 (or edge) to prevent errors
            return `translate(${isFinite(xPos) ? xPos : 0}, ${isFinite(yPos) ? yPos : 0})`;
        });
    
    bubbleGroups.append("circle")
        .attr("class", "mark data-bubble")
        .attr("r", d => {
            const r = radiusScale(d);
            return isFinite(r) && r > 0 ? r : minPixelRadius; // Ensure radius is valid
        })
        .attr("fill", d => {
            return (dataColors.field && dataColors.field[d[categoryFieldName]]) 
                   ? dataColors.field[d[categoryFieldName]] 
                   : fillStyle.colors.primary;
        })
        .attr("opacity", 0.7); // Added slight transparency for overlaps

    const placedLabelBoundingBoxes = [];
    const labelFontProperties = {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    };

    bubbleGroups.each(function(d) {
        const textContent = String(d[categoryFieldName] || "");
        if (!textContent.trim()) return;

        const groupNode = d3.select(this);
        const currentX = xScale(d[xValueFieldName]);
        const currentY = yScale(d[yValueFieldName]);

        if (!isFinite(currentX) || !isFinite(currentY)) return; // Don't draw label for invalid points

        const bestPosition = findOptimalLabelPosition(
            d, chartDataArray, xScale, yScale, 
            categoryFieldName, xValueFieldName, yValueFieldName, radiusScale,
            innerWidth, innerHeight, 
            labelFontProperties, 
            estimateTextWidth, 
            placedLabelBoundingBoxes
        );

        if (bestPosition) {
            const label = groupNode.append("text")
                .attr("class", "label data-label")
                .attr("x", bestPosition.x)
                .attr("y", bestPosition.y)
                .attr("text-anchor", bestPosition.anchor)
                .style("font-family", labelFontProperties.fontFamily)
                .style("font-size", labelFontProperties.fontSize)
                .style("font-weight", labelFontProperties.fontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(textContent);
            
            // Add this label's bounding box to the list for future collision checks
            // BBox is relative to the text element's (x,y) which are relative to the group's transform
            const labelNode = label.node();
            if (labelNode) {
                try {
                    const textBBox = labelNode.getBBox();
                    placedLabelBoundingBoxes.push({
                        x1: currentX + bestPosition.x + textBBox.x,
                        y1: currentY + bestPosition.y + textBBox.y,
                        x2: currentX + bestPosition.x + textBBox.x + textBBox.width,
                        y2: currentY + bestPosition.y + textBBox.y + textBBox.height,
                    });
                } catch (e) {
                    console.warn("Could not get BBox for label, skipping collision update.", e);
                }
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - none in this chart)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}