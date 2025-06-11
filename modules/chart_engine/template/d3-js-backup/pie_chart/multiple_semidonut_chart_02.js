/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Semi Donut Chart",
  "chart_name": "multiple_semi_donut_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 10], [0, "inf"], [2, 10]],
  "required_fields_icons": ["x"],
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
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors_dark || data.colors || {}; // Prefer dark theme colors if available
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const dimensionFieldName = dimensionFieldConfig?.name;
    const valueFieldName = valueFieldConfig?.name;
    const groupFieldName = groupFieldConfig?.name;

    const criticalFields = {
        "Dimension Field (role 'x')": dimensionFieldName,
        "Value Field (role 'y')": valueFieldName,
        "Group Field (role 'group')": groupFieldName
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

    const valueFieldUnit = valueFieldConfig?.unit !== "none" ? valueFieldConfig.unit : "";

    const allGroupValues = Array.from(new Set(chartDataInput.map(d => d[groupFieldName])));
    const groupValueToIndexMap = new Map(allGroupValues.map((val, idx) => [val, idx]));

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#333333',
        segmentLabelTextColor: '#FFFFFF', // For labels on dark segments

        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) || '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) || 'bold',

            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',

            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
        },

        getSegmentColor: (groupValue) => {
            if (colors.field && colors.field[groupValue]) {
                return colors.field[groupValue];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                const index = groupValueToIndexMap.get(groupValue);
                return colors.available_colors[index % colors.available_colors.length];
            }
            return (colors.other && colors.other.primary) || d3.schemeCategory10[groupValueToIndexMap.get(groupValue) % 10];
        }
    };

    function getTextDimensions(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // No DOM attachment for true in-memory calculation
        let bbox = { width: 0, height: 0, x: 0, y: 0 }; // Ensure all properties exist
        try {
            const measuredBBox = textElement.getBBox();
            bbox = { // defensive copy
                width: measuredBBox.width || 0,
                height: measuredBBox.height || 0,
                x: measuredBBox.x || 0,
                y: measuredBBox.y || 0
            };
        } catch (e) {
            // console.warn("Could not measure text dimensions using in-memory SVG: ", e);
            const parsedFontSize = parseFloat(fontSize) || 10;
            bbox.width = text.length * parsedFontSize * 0.6;
            bbox.height = parsedFontSize;
        }
        return { width: bbox.width, height: bbox.height };
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI prefix
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 850;
    const containerHeight = variables.height || 550;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 75,
        right: 70,
        bottom: 75,
        left: 70
    }; // Initial margins, top will be adjusted by legend

    // Block 5: Data Preprocessing & Transformation
    const groupedByDimension = d3.group(chartDataInput, d => d[dimensionFieldName]);
    const dimensionGroups = Array.from(groupedByDimension, ([key, values]) => {
        const total = d3.sum(values, d => d[valueFieldName]);
        return { dimension: key, values, total };
    }).sort((a, b) => String(a.dimension).localeCompare(String(b.dimension)));

    // Block 6: Scale Definition & Configuration
    // Color scale logic is within fillStyle.getSegmentColor
    // Pie and Arc generators will be defined per chart in Block 8

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendRectSize = 15;
    const legendRectTextPadding = 5;
    const legendItemPadding = 15;
    const legendRowSpacing = 12;
    const legendTopMargin = 10;
    const legendBottomMargin = 10;

    const legendTextWidths = {};
    let legendTextHeight = 0;

    allGroupValues.forEach(group => {
        const dims = getTextDimensions(group,
            fillStyle.typography.annotationFontFamily,
            fillStyle.typography.annotationFontSize,
            fillStyle.typography.annotationFontWeight
        );
        legendTextWidths[group] = dims.width;
        legendTextHeight = Math.max(legendTextHeight, dims.height);
    });

    const singleRowHeight = Math.max(legendTextHeight, legendRectSize);
    const legendItemWidths = allGroupValues.map(group =>
        legendRectSize + legendRectTextPadding + legendTextWidths[group] + legendItemPadding
    );

    const legendMaxWidth = containerWidth - chartMargins.left - chartMargins.right - 20; // Max width for legend items
    const legendRows = [];
    let currentRowItems = [];
    let currentRowWidth = 0;

    legendItemWidths.forEach((itemWidth, index) => {
        if (currentRowItems.length === 0 || currentRowWidth + itemWidth <= legendMaxWidth) {
            currentRowItems.push(index);
            currentRowWidth += itemWidth;
        } else {
            legendRows.push(currentRowItems);
            currentRowItems = [index];
            currentRowWidth = itemWidth;
        }
    });
    if (currentRowItems.length > 0) {
        legendRows.push(currentRowItems);
    }

    const actualLegendHeight = legendRows.length * singleRowHeight +
                               (legendRows.length > 0 ? (legendRows.length - 1) * legendRowSpacing : 0) +
                               legendTopMargin + legendBottomMargin;
    
    chartMargins.top = actualLegendHeight + 20; // Adjust top margin for legend

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${legendTopMargin})`);

    legendRows.forEach((rowIndices, rowIndex) => {
        const rowY = rowIndex * (singleRowHeight + legendRowSpacing);
        const rowTotalWidth = rowIndices.reduce((sum, itemIndex) => sum + legendItemWidths[itemIndex], 0) - legendItemPadding; // Subtract last padding

        const rowStartX = (containerWidth - chartMargins.left - chartMargins.right - rowTotalWidth) / 2;
        let currentX = rowStartX;

        rowIndices.forEach(itemIndex => {
            const groupName = allGroupValues[itemIndex];
            const itemWidth = legendItemWidths[itemIndex];

            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${rowY})`);

            legendItem.append("circle")
                .attr("class", "mark")
                .attr("cx", legendRectSize / 2)
                .attr("cy", singleRowHeight / 2) // Center vertically in the row
                .attr("r", legendRectSize / 2)
                .attr("fill", fillStyle.getSegmentColor(groupName));

            legendItem.append("text")
                .attr("class", "label")
                .attr("x", legendRectSize + legendRectTextPadding)
                .attr("y", singleRowHeight / 2) // Center vertically
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .style("dominant-baseline", "middle")
                .text(groupName);
            currentX += itemWidth;
        });
    });


    // Block 4 (continued): Layout calculations dependent on final margins
    const numCharts = dimensionGroups.length;
    let rows, cols;
    if (numCharts <= 3) { rows = 1; cols = numCharts; }
    else if (numCharts === 4) { rows = 2; cols = 2; }
    else if (numCharts <= 6) { rows = 2; cols = 3; }
    else if (numCharts <= 9) { rows = 3; cols = 3; }
    else {
        rows = Math.min(4, Math.ceil(Math.sqrt(numCharts)));
        cols = Math.ceil(numCharts / rows);
    }

    const itemsPerRow = [];
    for (let i = 0; i < rows; i++) {
        itemsPerRow.push(i < rows - 1 ? cols : numCharts - cols * (rows - 1));
    }

    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const cellWidth = chartAreaWidth / cols;
    const cellHeight = chartAreaHeight / rows; // Adjusted from original to be more standard

    const spacingFactorHorizontal = 0.15;
    const spacingFactorVertical = 0.20; // Increased vertical spacing for semi-donuts

    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    // Radius calculation, ensuring semi-donut fits (height is more critical for semi-circle)
    const chartRadius = Math.min(innerCellWidth / 2, innerCellHeight * 0.9); // Adjusted for semi-donut

    // Dynamic font size for dimension labels
    let maxDimensionLabelWidth = 0;
    dimensionGroups.forEach(group => {
        const dims = getTextDimensions(group.dimension,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontSize,
            fillStyle.typography.labelFontWeight);
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, dims.width);
    });
    
    const maxLabelDisplayWidth = chartRadius * 1.8; // Max width for dimension label under donut
    let dimensionLabelScaleFactor = 1;
    if (maxDimensionLabelWidth > maxLabelDisplayWidth && maxDimensionLabelWidth > 0) {
        dimensionLabelScaleFactor = maxLabelDisplayWidth / maxDimensionLabelWidth;
    }
    const adjustedDimensionFontSize = `${Math.floor(parseFloat(fillStyle.typography.labelFontSize) * dimensionLabelScaleFactor)}px`;


    // Block 8: Main Data Visualization Rendering
    let dataIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;

        for (let c = 0; c < itemsInThisRow; c++) {
            if (dataIndex >= numCharts) break;
            const currentGroupData = dimensionGroups[dataIndex];

            const chartCenterX = chartMargins.left + rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = chartMargins.top + (r + 0.5) * cellHeight + chartRadius * 0.2; // Adjust Y for semi-donut

            const mainChartGroup = svgRoot.append("g")
                .attr("class", "chart-group")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            const pieGenerator = d3.pie()
                .value(d => d[valueFieldName])
                .sort(null)
                .padAngle(0.01)
                .startAngle(-Math.PI / 2)
                .endAngle(Math.PI / 2);

            const arcGenerator = d3.arc()
                .innerRadius(chartRadius * 0.6)
                .outerRadius(chartRadius * 0.9);

            const generatedArcs = pieGenerator(currentGroupData.values);

            mainChartGroup.selectAll(".mark")
                .data(generatedArcs)
                .enter()
                .append("path")
                .attr("class", "mark")
                .attr("d", arcGenerator)
                .attr("fill", d => fillStyle.getSegmentColor(d.data[groupFieldName]));

            // Data labels on segments
            mainChartGroup.selectAll(".data-label")
                .data(generatedArcs)
                .enter()
                .append("text")
                .attr("class", "label value data-label")
                .each(function(d) {
                    const segment = d3.select(this);
                    const arcAngle = d.endAngle - d.startAngle;
                    const percent = arcAngle / Math.PI;
                    const valueText = valueFieldUnit ?
                        `${formatValue(d.data[valueFieldName])}${valueFieldUnit}` :
                        formatValue(d.data[valueFieldName]);

                    let labelFontSize = parseFloat(fillStyle.typography.annotationFontSize);
                    if (percent < 0.05 && percent > 0) labelFontSize *= 0.9; // Smaller font for tiny segments
                    else if (percent === 0) return; // Don't label zero-size segments

                    segment
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", `${labelFontSize}px`)
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .style("fill", fillStyle.segmentLabelTextColor)
                        .text(valueText)
                        .attr("text-anchor", "middle")
                        .style("dominant-baseline", "middle")
                        .style("pointer-events", "none");

                    if (percent > 0.12) { // Place inside if segment is large enough
                        const centroid = arcGenerator.centroid(d);
                        segment.attr("transform", `translate(${centroid[0]}, ${centroid[1]})`);
                    } else { // Place outside for smaller segments
                        const labelRadius = chartRadius * 1.05;
                        const angle = (d.startAngle + d.endAngle) / 2 - Math.PI / 2; // Adjust for D3's angle system
                        const x = labelRadius * Math.cos(angle);
                        const y = labelRadius * Math.sin(angle);
                        segment.attr("transform", `translate(${x}, ${y})`)
                               .style("fill", fillStyle.textColor); // Use main text color for outside labels
                    }
                });
            
            // Dimension label (below semi-donut)
            mainChartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", 0)
                .attr("y", chartRadius * 0.9 + 15) // Position below the donut
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(currentGroupData.dimension);

            // Block 9: Optional Enhancements & Post-Processing (Icons)
            const imageSize = chartRadius * 0.5;
            const minImageSize = 24; // Adjusted min image size
            const actualImageSize = Math.max(minImageSize, imageSize);

            if (images.field && images.field[currentGroupData.dimension] && actualImageSize > 0) {
                const clipId = `clip-center-${dataIndex}`;
                const defs = mainChartGroup.append("defs");
                defs.append("clipPath")
                    .attr("id", clipId)
                    .append("circle")
                    .attr("class", "other") // Generic class for clip path element
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", actualImageSize / 2);

                mainChartGroup.append("image")
                    .attr("class", "image icon-center") // Using "image" and a more specific class
                    .attr("xlink:href", images.field[currentGroupData.dimension])
                    .attr("clip-path", `url(#${clipId})`)
                    .attr("x", -actualImageSize / 2)
                    .attr("y", -actualImageSize / 2)
                    .attr("width", actualImageSize)
                    .attr("height", actualImageSize);
            }
            dataIndex++;
        }
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}