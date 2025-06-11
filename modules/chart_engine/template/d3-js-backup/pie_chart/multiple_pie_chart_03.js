/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Pie Chart",
  "chart_name": "multiple_pie_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 10], [0, "inf"], [2, 10]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
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
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    // Typography defaults and merging
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const userTypography = data.typography || {};
    const typography = {
        title: { ...defaultTypography.title, ...(userTypography.title || {}) },
        label: { ...defaultTypography.label, ...(userTypography.label || {}) },
        annotation: { ...defaultTypography.annotation, ...(userTypography.annotation || {}) }
    };

    // Colors defaults and merging (prioritizing dark theme if specified)
    const defaultColors = {
        text_color: "#E0E0E0", // Light text for dark background as original used colors_dark
        background_color: "#121212", // Dark background
        other: {
            primary: "#007bff", // A more standard primary blue
            slice_stroke: "#121212" // Default stroke to match background for cutout effect
        },
        field: {},
        available_colors: d3.schemeCategory10
    };
    const userColors = data.colors_dark || data.colors || {};
    const colors = {
        text_color: userColors.text_color !== undefined ? userColors.text_color : defaultColors.text_color,
        background_color: userColors.background_color !== undefined ? userColors.background_color : defaultColors.background_color,
        other: { ...defaultColors.other, ...(userColors.other || {}) },
        field: { ...defaultColors.field, ...(userColors.field || {}) },
        available_colors: userColors.available_colors || defaultColors.available_colors
    };
    
    const images = data.images || {}; // Not used in this chart, but extracted per spec

    // Clear container
    d3.select(containerSelector).html("");

    // Field name extraction from dataColumns
    const dimensionFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;
    const groupFieldName = (dataColumns.find(col => col.role === "group") || {}).name;

    // Critical identifier validation
    const missingFields = [];
    if (!dimensionFieldName) missingFields.push("Dimension field (role 'x')");
    if (!valueFieldName) missingFields.push("Value field (role 'y')");
    if (!groupFieldName) missingFields.push("Group field (role 'group')");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    // Units
    let valueUnit = "";
    const yColumn = dataColumns.find(col => col.role === "y");
    if (yColumn && yColumn.unit && yColumn.unit !== "none") {
        valueUnit = yColumn.unit;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colors.text_color,
        chartBackground: colors.background_color,
        primaryColor: colors.other.primary,
        sliceStrokeColor: colors.other.slice_stroke || colors.background_color, // Fallback to background for cutout
        typography: {
            titleFontFamily: typography.title.font_family,
            titleFontSize: typography.title.font_size,
            titleFontWeight: typography.title.font_weight,
            labelFontFamily: typography.label.font_family,
            labelFontSize: typography.label.font_size,
            labelFontWeight: typography.label.font_weight,
            annotationFontFamily: typography.annotation.font_family,
            annotationFontSize: typography.annotation.font_size,
            annotationFontWeight: typography.annotation.font_weight,
        },
        getSliceColor: (groupName, index) => {
            if (colors.field && colors.field[groupName]) {
                return colors.field[groupName];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return fillStyle.primaryColor;
        }
    };

    function estimateTextDimensions(text, styleProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', styleProps.font_family);
        textNode.setAttribute('font-size', styleProps.font_size);
        textNode.setAttribute('font-weight', styleProps.font_weight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        // Note: getBBox on a detached element might not be universally reliable.
        // If issues arise, a canvas-based measurement or temporary DOM attachment might be needed.
        // However, adhering to "MUST NOT be appended to the document DOM".
        const bbox = textNode.getBBox();
        return { width: bbox.width, height: bbox.height };
    }

    const formatValue = (value) => {
        let formattedValue;
        if (value >= 1000000000) {
            formattedValue = d3.format("~.2s")(value).replace('G', 'B'); // More standard SI prefix
        } else if (value >= 1000000) {
            formattedValue = d3.format("~.2s")(value);
        } else if (value >= 1000) {
            formattedValue = d3.format("~.2s")(value);
        } else {
            formattedValue = d3.format("~g")(value);
        }
        return valueUnit ? `${formattedValue}${valueUnit}` : formattedValue;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 350;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-container");

    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = {
        top: 20, // Initial top margin, will be adjusted by legend
        right: 30,
        bottom: 20, 
        left: 30
    };

    // Legend dimension calculation (must happen before main chart area calculation)
    const allGroupsForLegend = Array.from(new Set(rawChartData.map(d => d[groupFieldName])));
    const legendRectSize = 15;
    const legendRectTextPadding = 5;
    const legendItemPadding = 15;
    const legendRowSpacing = 10;
    const legendTopMargin = 10;
    const legendBottomMargin = 10;

    const legendTextMetrics = allGroupsForLegend.map(group => {
        const dims = estimateTextDimensions(group, {
            font_family: fillStyle.typography.annotationFontFamily,
            font_size: fillStyle.typography.annotationFontSize,
            font_weight: fillStyle.typography.annotationFontWeight
        });
        return { group, width: dims.width, height: dims.height };
    });
    
    const maxLegendTextHeight = Math.max(0, ...legendTextMetrics.map(m => m.height));
    const singleLegendRowHeight = Math.max(maxLegendTextHeight, legendRectSize);
    
    const legendItemWidths = legendTextMetrics.map(metric => 
        legendRectSize + legendRectTextPadding + metric.width + legendItemPadding
    );

    const legendAvailableWidth = containerWidth - chartMargins.left - chartMargins.right - 20; // Small buffer
    const legendRowsLayout = [];
    let currentLegendRow = [];
    let currentLegendRowWidth = 0;

    legendItemWidths.forEach((itemWidth, index) => {
        if (currentLegendRow.length === 0 || currentLegendRowWidth + itemWidth <= legendAvailableWidth) {
            currentLegendRow.push(index);
            currentLegendRowWidth += itemWidth;
        } else {
            legendRowsLayout.push({ items: currentLegendRow, width: currentLegendRowWidth - legendItemPadding }); // Adjust width
            currentLegendRow = [index];
            currentLegendRowWidth = itemWidth;
        }
    });
    if (currentLegendRow.length > 0) {
        legendRowsLayout.push({ items: currentLegendRow, width: currentLegendRowWidth - legendItemPadding }); // Adjust width
    }
    
    const actualLegendHeight = legendRowsLayout.length * singleLegendRowHeight + 
                               Math.max(0, legendRowsLayout.length - 1) * legendRowSpacing + 
                               legendTopMargin + legendBottomMargin;
    
    chartMargins.top = actualLegendHeight + 10; // Add some space below legend

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const groupedByDimension = d3.group(rawChartData, d => d[dimensionFieldName]);
    const dimensionGroups = Array.from(groupedByDimension, ([key, values]) => {
        const total = d3.sum(values, d => d[valueFieldName]);
        return { dimension: key, values, total };
    }).sort((a, b) => String(a.dimension).localeCompare(String(b.dimension)));

    const numCharts = dimensionGroups.length;
    let gridRows, gridCols;
    if (numCharts <= 3) { gridRows = 1; gridCols = numCharts; }
    else if (numCharts === 4) { gridRows = 2; gridCols = 2; }
    else if (numCharts <= 8) { gridRows = 2; gridCols = Math.ceil(numCharts / 2); }
    else if (numCharts <= 12) { gridRows = 3; gridCols = Math.ceil(numCharts / 3); }
    else { gridRows = 4; gridCols = Math.ceil(numCharts / 4); }

    const itemsPerRow = [];
    for (let i = 0; i < gridRows; i++) {
        itemsPerRow.push( (i < gridRows - 1) ? gridCols : numCharts - gridCols * (gridRows - 1) );
    }

    const cellWidth = innerWidth / gridCols;
    const cellHeight = innerHeight / gridRows;
    
    const spacingFactorHorizontal = 0.15;
    const spacingFactorVertical = 0.15;
    const chartSpacingHorizontal = cellWidth * spacingFactorHorizontal;
    const chartSpacingVertical = cellHeight * spacingFactorVertical;
    const innerCellWidth = cellWidth - chartSpacingHorizontal;
    const innerCellHeight = cellHeight - chartSpacingVertical;

    // Radius calculation, also accounts for dimension label space (approx 20px)
    const radius = Math.min(innerCellWidth / 2, (innerCellHeight - 20) / 2) * 0.9;


    let maxDimensionWidth = 0;
    dimensionGroups.forEach(group => {
        const { width } = estimateTextDimensions(group.dimension, {
            font_family: fillStyle.typography.labelFontFamily,
            font_size: fillStyle.typography.labelFontSize, // Use base size for measurement
            font_weight: fillStyle.typography.labelFontWeight
        });
        maxDimensionWidth = Math.max(maxDimensionWidth, width);
    });
    
    const maxChartAreaForLabel = radius * 2; 
    let dimensionScaleFactor = 1;
    if (maxDimensionWidth > maxChartAreaForLabel && maxChartAreaForLabel > 0) {
        dimensionScaleFactor = maxChartAreaForLabel / maxDimensionWidth;
    }
    const baseLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const adjustedDimensionFontSize = `${Math.max(8, Math.floor(baseLabelFontSize * dimensionScaleFactor))}px`;


    // Block 6: Scale Definition & Configuration
    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null);

    const arcGenerator = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${legendTopMargin})`);

    legendRowsLayout.forEach((rowLayout, rowIndex) => {
        const rowY = rowIndex * (singleLegendRowHeight + legendRowSpacing) + (singleLegendRowHeight / 2);
        const rowStartX = (innerWidth - rowLayout.width) / 2; // Center the row
        let currentX = rowStartX;

        rowLayout.items.forEach(itemIndex => {
            const groupName = allGroupsForLegend[itemIndex];
            const itemWidth = legendItemWidths[itemIndex];
            
            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${rowY})`);

            legendItem.append("rect")
                .attr("class", "mark legend-mark")
                .attr("x", 0)
                .attr("y", -legendRectSize / 2)
                .attr("width", legendRectSize)
                .attr("height", legendRectSize)
                .attr("fill", fillStyle.getSliceColor(groupName, itemIndex));

            legendItem.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendRectSize + legendRectTextPadding)
                .attr("y", 0)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .style("dominant-baseline", "middle")
                .text(groupName);
            
            currentX += itemWidth;
        });
    });

    // Block 8: Main Data Visualization Rendering (Pies)
    let dataIndex = 0;
    for (let r = 0; r < gridRows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (gridCols - itemsInThisRow) * cellWidth / 2;

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const chartDataGroup = dimensionGroups[dataIndex];

            const chartCenterX = chartMargins.left + rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (r + 0.5) * cellHeight;

            const pieChartGroup = svgRoot.append("g")
                .attr("class", "chart-group mark")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const arcs = pieGenerator(chartDataGroup.values);

            pieChartGroup.selectAll("path.slice")
                .data(arcs)
                .enter()
                .append("path")
                .attr("class", "mark value slice")
                .attr("d", arcGenerator)
                .attr("fill", (d, i) => fillStyle.getSliceColor(d.data[groupFieldName], allGroupsForLegend.indexOf(d.data[groupFieldName])))
                .attr("stroke", fillStyle.sliceStrokeColor)
                .attr("stroke-width", 1);

            // Slice labels
            pieChartGroup.selectAll("text.pie-label")
                .data(arcs)
                .enter()
                .append("text")
                .attr("class", "label data-label pie-label")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .style("pointer-events", "none")
                .each(function(d) {
                    const thisLabel = d3.select(this);
                    const arcAngle = d.endAngle - d.startAngle;
                    const percent = arcAngle / (2 * Math.PI);
                    const valueText = formatValue(d.data[valueFieldName]);
                    const centroid = arcGenerator.centroid(d);
                    
                    if (percent > 0.08 && radius > 30) { // Place inside if slice is big enough and radius allows
                        thisLabel.attr("transform", `translate(${centroid[0]}, ${centroid[1]})`)
                            .attr("text-anchor", "middle")
                            .style("dominant-baseline", "middle")
                            .text(valueText);
                        // Check if label fits, if not, clear it (simple check)
                        const labelWidth = estimateTextDimensions(valueText, {
                            font_family: fillStyle.typography.annotationFontFamily,
                            font_size: fillStyle.typography.annotationFontSize,
                            font_weight: fillStyle.typography.annotationFontWeight
                        }).width;
                        if (labelWidth > radius * 0.8 && percent < 0.15) { // Heuristic
                             thisLabel.text("");
                        }

                    } else if (radius > 20) { // Place outside for smaller slices if radius allows
                        const midAngle = (d.startAngle + d.endAngle) / 2;
                        const x = (radius + 10) * Math.sin(midAngle); // A bit outside the arc
                        const y = -(radius + 10) * Math.cos(midAngle);
                        const textAnchor = (midAngle > Math.PI/2 && midAngle < 3*Math.PI/2) ? "end" : "start";
                        
                        thisLabel.attr("transform", `translate(${x}, ${y})`)
                            .attr("text-anchor", textAnchor)
                            .style("dominant-baseline", "middle")
                            .text(valueText);
                    }
                });

            // Dimension label (above pie)
            pieChartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", -radius - 8) // Position above the pie
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(chartDataGroup.dimension);

            dataIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}