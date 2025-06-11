/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Scatterplot",
  "chart_name": "grouped_scatterplot_01",
  "is_composite": false,
  "required_fields": ["x", "y", "y2", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[8, 150], [0, "inf"], [0, "inf"], [2, 6]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 750,
  "min_width": 750,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartRawData = data.data?.data; // Renamed to avoid conflict
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {};
    const images = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const labelFieldRole = "x";
    const xAxisValueFieldRole = "y";
    const yAxisValueFieldRole = "y2";
    const groupFieldRole = "group";

    const labelFieldDef = dataColumns.find(col => col.role === labelFieldRole);
    const xAxisValueFieldDef = dataColumns.find(col => col.role === xAxisValueFieldRole);
    const yAxisValueFieldDef = dataColumns.find(col => col.role === yAxisValueFieldRole);
    const groupFieldDef = dataColumns.find(col => col.role === groupFieldRole);

    const labelFieldName = labelFieldDef?.name;
    const xAxisValueFieldName = xAxisValueFieldDef?.name;
    const yAxisValueFieldName = yAxisValueFieldDef?.name;
    const groupFieldName = groupFieldDef?.name;
    
    const xAxisTitleText = xAxisValueFieldDef?.label || xAxisValueFieldName;
    const yAxisTitleText = yAxisValueFieldDef?.label || yAxisValueFieldName;
    const legendTitleText = groupFieldDef?.label || groupFieldName;

    const criticalFields = {
        labelFieldName,
        xAxisValueFieldName,
        yAxisValueFieldName,
        groupFieldName
    };
    const missingFields = Object.entries(criticalFields)
        .filter(([_, value]) => !value)
        .map(([key, _]) => key.replace("Name", "")); // Make it more user-friendly

    if (missingFields.length > 0 || !chartRawData || chartRawData.length === 0) {
        let errorMsg = "";
        if (!chartRawData || chartRawData.length === 0) {
            errorMsg = "Chart data is missing or empty.";
        } else {
            errorMsg = `Critical chart configuration missing for role(s): ${missingFields.join(', ')}.`;
        }
        console.error(errorMsg + " Cannot render.");
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg} Cannot render chart.</div>`);
        return null;
    }
    
    // Filter out data points with invalid/missing critical values for plotting
    const chartData = chartRawData.filter(d => 
        typeof d[xAxisValueFieldName] === 'number' && isFinite(d[xAxisValueFieldName]) &&
        typeof d[yAxisValueFieldName] === 'number' && isFinite(d[yAxisValueFieldName]) &&
        d[groupFieldName] !== undefined && d[groupFieldName] !== null &&
        d[labelFieldName] !== undefined && d[labelFieldName] !== null
    );

    if (chartData.length === 0) {
        const errorMsg = "No valid data points to render after filtering.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typography.title?.font_size || '16px',
            titleFontWeight: typography.title?.font_weight || 'bold',
            labelFontFamily: typography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typography.label?.font_size || '12px',
            labelFontWeight: typography.label?.font_weight || 'normal',
            annotationFontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typography.annotation?.font_size || '10px',
            annotationFontWeight: typography.annotation?.font_weight || 'normal',
        },
        textColor: colors.text_color || '#333333',
        axisLineColor: colors.text_color || '#B0B0B0',
        backgroundColor: colors.background_color || '#FFFFFF',
        defaultCategoryColors: d3.schemeCategory10
    };

    fillStyle.getCategoryColor = (categoryValue, index) => {
        // Check for specific mapping under groupFieldName key first
        if (colors.field && colors.field[groupFieldName] && typeof colors.field[groupFieldName] === 'object' && colors.field[groupFieldName][categoryValue]) {
            return colors.field[groupFieldName][categoryValue];
        }
        // Fallback to direct mapping if categoryValue is a key in colors.field
        if (colors.field && colors.field[categoryValue]) {
             return colors.field[categoryValue];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[index % colors.available_colors.length];
        }
        return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
    };
    
    fillStyle.getImageUrl = (imageKey) => {
        // Check for specific mapping under labelFieldName key first
        if (images.field && images.field[labelFieldName] && typeof images.field[labelFieldName] === 'object' && images.field[labelFieldName][imageKey]) {
            return images.field[labelFieldName][imageKey];
        }
        // Fallback to direct mapping if imageKey is a key in images.field
        if (images.field && images.field[imageKey]) {
            return images.field[imageKey];
        }
        // No generic fallback like images.other.primary as per current directives for field-specific images
        return null;
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvgForEstimation = d3.select(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
        const tempTextElement = tempSvgForEstimation.append("text")
            .attr("font-family", fontFamily)
            .attr("font-size", fontSize)
            .attr("font-weight", fontWeight)
            .text(text);
        const width = tempTextElement.node().getBBox().width;
        tempSvgForEstimation.remove(); // Clean up
        return width;
    }
    
    function estimateTextHeight(fontFamily, fontSize, fontWeight) {
        const tempSvgForEstimation = d3.select(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
        const tempTextElement = tempSvgForEstimation.append("text")
            .attr("font-family", fontFamily)
            .attr("font-size", fontSize)
            .attr("font-weight", fontWeight)
            .text("M"); // Measure with a capital letter for representative height
        const height = tempTextElement.node().getBBox().height;
        tempSvgForEstimation.remove();
        return height;
    }

    function hasNegativeOrZeroValues(data, field) {
        return data.some(d => d[field] <= 0);
    }

    function isDistributionUneven(data, field) {
        const values = data.map(d => d[field]).filter(v => typeof v === 'number' && isFinite(v));
        if (values.length < 3) return false; 
        const extent = d3.extent(values);
        const range = extent[1] - extent[0];
        if (range === 0) return false;

        const median = d3.median(values);
        const sortedValues = values.sort(d3.ascending);
        const q1 = d3.quantile(sortedValues, 0.25);
        const q3 = d3.quantile(sortedValues, 0.75);
        const iqr = q3 - q1;
        
        if (iqr === 0) return range > 0; // e.g., [1,1,1,1,100] -> iqr=0, range > 0
        
        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1])/2) > range * 0.2;
    }
    
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))].sort();

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 750;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);

    const defaultTopMargin = groups.length > 0 && variables.show_legend !== false ? 70 : 25;
    const chartMargins = { 
        top: variables.margin_top || defaultTopMargin, 
        right: variables.margin_right || 25, 
        bottom: variables.margin_bottom || 50, 
        left: variables.margin_left || 60 
    };

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <=0 || innerHeight <=0) {
        console.error("Calculated chart dimensions (innerWidth or innerHeight) are not positive. Check container size and margins.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Chart dimensions are too small to render.</div>");
        return null;
    }

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other") // Added class
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const numPoints = chartData.length;
    const baseCircleRadius = numPoints <= 15 ? 15 : Math.max(10, 15 - (numPoints - 15) / 20);
    const iconContainerRadius = baseCircleRadius; // Radius for icon area
    const coloredBackgroundRadius = iconContainerRadius + 4; // Effective radius of colored disc (original stroke effect)


    // Block 6: Scale Definition & Configuration
    const xDataExtent = d3.extent(chartData, d => d[xAxisValueFieldName]);
    const yDataExtent = d3.extent(chartData, d => d[yAxisValueFieldName]);

    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartData, xAxisValueFieldName);
    const xIsUneven = isDistributionUneven(chartData, xAxisValueFieldName);
    
    let xScale;
    if (!xHasNegativeOrZero && xIsUneven) {
        const xMin = Math.max(xDataExtent[0] > 0 ? xDataExtent[0] * 0.9 : 0.1, 0.1);
        const xMax = xDataExtent[1] > 0 ? xDataExtent[1] * 1.1 : 1;
        xScale = d3.scaleLog().domain([xMin, xMax > xMin ? xMax : xMin * 10]).range([0, innerWidth]).clamp(true);
    } else {
        const xRange = xDataExtent[1] - xDataExtent[0];
        xScale = d3.scaleLinear()
            .domain([xDataExtent[0] - xRange * 0.1, xDataExtent[1] + xRange * 0.1])
            .range([0, innerWidth]);
    }
    if (xScale.domain()[0] === xScale.domain()[1]) {
        xScale.domain([xScale.domain()[0] - 1, xScale.domain()[1] + 1]);
    }


    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartData, yAxisValueFieldName);
    const yIsUneven = isDistributionUneven(chartData, yAxisValueFieldName);
    
    let yScale;
    if (!yHasNegativeOrZero && yIsUneven) {
        const yMin = Math.max(yDataExtent[0] > 0 ? yDataExtent[0] * 0.9 : 0.1, 0.1);
        const yMax = yDataExtent[1] > 0 ? yDataExtent[1] * 1.1 : 1;
        yScale = d3.scaleLog().domain([yMin, yMax > yMin ? yMax : yMin * 10]).range([innerHeight, 0]).clamp(true);
    } else {
        const yRange = yDataExtent[1] - yDataExtent[0];
        yScale = d3.scaleLinear()
            .domain([yDataExtent[0] - yRange * 0.1, yDataExtent[1] + yRange * 0.1])
            .range([innerHeight, 0]);
    }
     if (yScale.domain()[0] === yScale.domain()[1]) {
        yScale.domain([yScale.domain()[0] - 1, yScale.domain()[1] + 1]);
    }

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    const yAxis = d3.axisLeft(yScale).tickSize(0).tickPadding(10);
    
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("path.domain").style("stroke", fillStyle.axisLineColor).style("stroke-width", 1).style("opacity", 0.8);
    xAxisGroup.selectAll("line").style("stroke", fillStyle.axisLineColor); // For ticks if any visible
    xAxisGroup.selectAll("text").attr("class", "label").style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);
        
    const yAxisGroup = mainChartGroup.append("g").attr("class", "axis y-axis").call(yAxis);
    yAxisGroup.selectAll("path.domain").style("stroke", fillStyle.axisLineColor).style("stroke-width", 1).style("opacity", 0.8);
    yAxisGroup.selectAll("line").style("stroke", fillStyle.axisLineColor);
    yAxisGroup.selectAll("text").attr("class", "label").style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);
    
    if (xAxisTitleText) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title x-axis-title")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight + chartMargins.bottom - 10) // Adjusted y position
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold") // Axis titles often bolder
            .style("fill", fillStyle.textColor)
            .text(xAxisTitleText);
    }
        
    if (yAxisTitleText) {
        mainChartGroup.append("text")
            .attr("class", "label axis-title y-axis-title")
            .attr("transform", "rotate(-90)")
            .attr("x", -innerHeight / 2)
            .attr("y", -chartMargins.left + 20) // Adjusted y position
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold")
            .style("fill", fillStyle.textColor)
            .text(yAxisTitleText);
    }

    if (groups.length > 0 && variables.show_legend !== false) {
        const legendItemPadding = 5;
        const legendColumnPadding = 15;
        const legendRowPadding = 10;
        let legendFontSize = parseFloat(fillStyle.typography.labelFontSize);
        let legendMarkRadius = Math.max(5, legendFontSize * 0.4);

        const legendItems = groups.map(group => ({
            group: group,
            textWidth: estimateTextWidth(group, fillStyle.typography.labelFontFamily, `${legendFontSize}px`, fillStyle.typography.labelFontWeight),
            itemWidth: (legendMarkRadius * 2) + legendItemPadding + estimateTextWidth(group, fillStyle.typography.labelFontFamily, `${legendFontSize}px`, fillStyle.typography.labelFontWeight)
        }));
        
        let totalLegendWidth = legendItems.reduce((sum, item) => sum + item.itemWidth, 0) + (legendItems.length - 1) * legendColumnPadding;
        const maxAllowedLegendWidth = innerWidth * 0.95;
        let numLegendRows = 1;

        if (totalLegendWidth > maxAllowedLegendWidth) {
            numLegendRows = 2; // Try 2 rows
            const itemsPerRowEst = Math.ceil(legendItems.length / numLegendRows);
            let maxRowWidthEst = 0;
            for (let i = 0; i < numLegendRows; i++) {
                const rowItemsEst = legendItems.slice(i * itemsPerRowEst, (i + 1) * itemsPerRowEst);
                if (rowItemsEst.length > 0) {
                    const rowWidthEst = rowItemsEst.reduce((sum, item) => sum + item.itemWidth, 0) + (rowItemsEst.length - 1) * legendColumnPadding;
                    if (rowWidthEst > maxRowWidthEst) maxRowWidthEst = rowWidthEst;
                }
            }
            if (maxRowWidthEst > maxAllowedLegendWidth) { // Shrink if 2 rows still too wide
                const shrinkFactor = Math.min(1, maxAllowedLegendWidth / maxRowWidthEst);
                legendFontSize = Math.max(parseFloat(fillStyle.typography.annotationFontSize), legendFontSize * shrinkFactor * 0.9);
                legendMarkRadius = Math.max(3, legendMarkRadius * shrinkFactor * 0.9);
                legendItems.forEach(item => {
                    item.textWidth = estimateTextWidth(item.group, fillStyle.typography.labelFontFamily, `${legendFontSize}px`, fillStyle.typography.labelFontWeight);
                    item.itemWidth = (legendMarkRadius * 2) + legendItemPadding + item.textWidth;
                });
            }
        }
        
        const legendGroup = svgRoot.append("g").attr("class", "legend other");
        const legendTitleHeight = legendTitleText ? (legendFontSize + 1 + 5) : 0; // 5 for padding
        const legendContentHeight = numLegendRows * legendFontSize + (numLegendRows - 1) * legendRowPadding;
        const totalLegendBlockHeight = legendTitleHeight + legendContentHeight;
        const legendStartY = (chartMargins.top - totalLegendBlockHeight) / 2;


        if (legendTitleText) {
            legendGroup.append("text")
                .attr("class", "text legend-title")
                .attr("x", chartMargins.left + innerWidth / 2)
                .attr("y", legendStartY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${legendFontSize + 1}px`)
                .style("font-weight", "bold")
                .style("fill", fillStyle.textColor)
                .text(legendTitleText);
        }
        
        const itemsPerRow = Math.ceil(legendItems.length / numLegendRows);
        for (let r = 0; r < numLegendRows; r++) {
            const rowItems = legendItems.slice(r * itemsPerRow, (r + 1) * itemsPerRow);
            if (rowItems.length === 0) continue;
            const rowWidth = rowItems.reduce((sum, item) => sum + item.itemWidth, 0) + (rowItems.length - 1) * legendColumnPadding;
            let currentX = chartMargins.left + (innerWidth - rowWidth) / 2;
            const rowY = legendStartY + legendTitleHeight + r * (legendFontSize + legendRowPadding) + legendFontSize / 2; // Center text vertically

            rowItems.forEach((item, index) => {
                const legendItemG = legendGroup.append("g")
                    .attr("class", "legend-item other")
                    .attr("transform", `translate(${currentX}, ${rowY})`);
                
                legendItemG.append("circle")
                    .attr("class", "mark legend-mark")
                    .attr("cx", legendMarkRadius)
                    .attr("cy", 0) 
                    .attr("r", legendMarkRadius)
                    .style("fill", fillStyle.getCategoryColor(item.group, groups.indexOf(item.group)));
                
                legendItemG.append("text")
                    .attr("class", "label legend-text")
                    .attr("x", (legendMarkRadius * 2) + legendItemPadding)
                    .attr("y", 0)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", `${legendFontSize}px`)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(item.group);
                currentX += item.itemWidth + legendColumnPadding;
            });
        }
    }

    // Block 8: Main Data Visualization Rendering
    const pointsGroup = mainChartGroup.append("g").attr("class", "points-group other");

    const pointElements = pointsGroup.selectAll(".data-point")
        .data(chartData)
        .enter()
        .append("g")
        .attr("class", "mark data-point")
        .attr("transform", d => `translate(${xScale(d[xAxisValueFieldName])}, ${yScale(d[yAxisValueFieldName])})`);
    
    pointElements.append("circle")
        .attr("class", "value mark-background")
        .attr("r", coloredBackgroundRadius)
        .style("fill", (d, i) => fillStyle.getCategoryColor(d[groupFieldName], groups.indexOf(d[groupFieldName])));

    pointElements.each(function(d) {
        const imageUrl = fillStyle.getImageUrl(d[labelFieldName]);
        if (imageUrl) {
            d3.select(this).append("image")
                .attr("class", "icon data-icon")
                .attr("xlink:href", imageUrl)
                .attr("width", iconContainerRadius * 2)
                .attr("height", iconContainerRadius * 2)
                .attr("x", -iconContainerRadius)
                .attr("y", -iconContainerRadius);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing (Data Labels)
    function findOptimalLabelPosition(d, allPointsData, currentPositionsCache) {
        const pointElementRadius = coloredBackgroundRadius; // Labels should avoid the entire visual element
        const positions = [ 
            { dx: pointElementRadius + 5, dy: 0, anchor: "start", priority: 1 },
            { dx: 0, dy: -(pointElementRadius + 5), anchor: "middle", priority: 2 },
            { dx: -(pointElementRadius + 5), dy: 0, anchor: "end", priority: 3 },
            { dx: 0, dy: pointElementRadius + 5, anchor: "middle", priority: 4 },
            { dx: pointElementRadius * 0.707 + 3, dy: -(pointElementRadius * 0.707 + 3), anchor: "start", priority: 5 },
            { dx: -(pointElementRadius * 0.707 + 3), dy: -(pointElementRadius * 0.707 + 3), anchor: "end", priority: 6 },
            { dx: -(pointElementRadius * 0.707 + 3), dy: pointElementRadius * 0.707 + 3, anchor: "end", priority: 7 },
            { dx: pointElementRadius * 0.707 + 3, dy: pointElementRadius * 0.707 + 3, anchor: "start", priority: 8 }
        ];

        const currentPointX = xScale(d[xAxisValueFieldName]);
        const currentPointY = yScale(d[yAxisValueFieldName]);
        const labelText = String(d[labelFieldName] || "");
        if (!labelText) return { dx:0, dy:0, anchor: "middle", canShow: false};

        const labelFont = { family: fillStyle.typography.annotationFontFamily, size: fillStyle.typography.annotationFontSize, weight: fillStyle.typography.annotationFontWeight };
        const labelWidth = estimateTextWidth(labelText, labelFont.family, labelFont.size, labelFont.weight);
        const labelHeight = estimateTextHeight(labelFont.family, labelFont.size, labelFont.weight);

        for (const pos of positions) {
            let proposedLabelX, proposedLabelYAnchor;
            if (pos.anchor === "start") proposedLabelX = currentPointX + pos.dx;
            else if (pos.anchor === "middle") proposedLabelX = currentPointX + pos.dx - labelWidth / 2;
            else proposedLabelX = currentPointX + pos.dx - labelWidth; // end

            if (pos.anchor === "middle" && (pos.priority === 2 || pos.priority === 4)) { // top or bottom
                 proposedLabelYAnchor = currentPointY + pos.dy + (pos.dy < 0 ? 0 : labelHeight * 0.8); // Adjust for baseline
            } else { // left, right, or corners
                 proposedLabelYAnchor = currentPointY + pos.dy - labelHeight / 2; // Center of text box
            }
            
            const labelRect = { x1: proposedLabelX, y1: proposedLabelYAnchor, x2: proposedLabelX + labelWidth, y2: proposedLabelYAnchor + labelHeight };

            if (labelRect.x1 < 0 || labelRect.x2 > innerWidth || labelRect.y1 < 0 || labelRect.y2 > innerHeight) continue; // Check chart area boundaries
            
            let hasOverlap = false;
            for (const otherPoint of allPointsData) { // Check overlap with other points
                if (otherPoint === d) continue;
                const otherPX = xScale(otherPoint[xAxisValueFieldName]);
                const otherPY = yScale(otherPoint[yAxisValueFieldName]);
                if (labelRect.x1 < otherPX + pointElementRadius && labelRect.x2 > otherPX - pointElementRadius &&
                    labelRect.y1 < otherPY + pointElementRadius && labelRect.y2 > otherPY - pointElementRadius) {
                    hasOverlap = true; break;
                }
            }
            if (hasOverlap) continue;

            for (const key in currentPositionsCache) { // Check overlap with other labels
                const otherPlaced = currentPositionsCache[key];
                if (!otherPlaced.canShow || key === labelText) continue; // Skip self or hidden labels
                
                const otherPointData = allPointsData.find(p => String(p[labelFieldName]) === key);
                if (!otherPointData) continue;

                const otherLabelW = estimateTextWidth(key, labelFont.family, labelFont.size, labelFont.weight);
                const otherLabelH = estimateTextHeight(labelFont.family, labelFont.size, labelFont.weight);
                const opX = xScale(otherPointData[xAxisValueFieldName]);
                const opY = yScale(otherPointData[yAxisValueFieldName]);

                let otherRectX1;
                if (otherPlaced.anchor === "start") otherRectX1 = opX + otherPlaced.dx;
                else if (otherPlaced.anchor === "middle") otherRectX1 = opX + otherPlaced.dx - otherLabelW / 2;
                else otherRectX1 = opX + otherPlaced.dx - otherLabelW;
                
                let otherRectY1;
                if (otherPlaced.anchor === "middle" && (otherPlaced.priority === 2 || otherPlaced.priority === 4)) {
                     otherRectY1 = opY + otherPlaced.dy + (otherPlaced.dy < 0 ? 0 : otherLabelH * 0.8);
                } else {
                     otherRectY1 = opY + otherPlaced.dy - otherLabelH / 2;
                }
                const otherRect = { x1: otherRectX1, y1: otherRectY1, x2: otherRectX1 + otherLabelW, y2: otherRectY1 + otherLabelH };

                if (labelRect.x1 < otherRect.x2 && labelRect.x2 > otherRect.x1 && labelRect.y1 < otherRect.y2 && labelRect.y2 > otherRect.y1) {
                    hasOverlap = true; break;
                }
            }
            if (!hasOverlap) return { ...pos, canShow: true };
        }
        return { ...positions[0], canShow: false };
    }

    if (variables.show_data_labels !== false) {
        const labelPositionsCache = {};
        // Sort data to prioritize, e.g., by a value, or just iterate
        // For now, iterate in given order. More complex prioritization could be added.
        chartData.forEach(d => {
            const pos = findOptimalLabelPosition(d, chartData, labelPositionsCache);
            labelPositionsCache[String(d[labelFieldName])] = pos; // Ensure key is string
        });

        pointElements.append("text")
            .attr("class", "label data-label")
            .each(function(d) {
                const labelKey = String(d[labelFieldName]);
                const pos = labelPositionsCache[labelKey];
                if (pos && pos.canShow) {
                    let yPosFinal = pos.dy;
                    let dominantBaseline = "central";
                    if (pos.anchor === "middle" && (pos.priority === 2 || pos.priority === 4)) { // top or bottom
                        dominantBaseline = (pos.dy < 0 ? "alphabetic" : "hanging");
                         // Adjust y for hanging/alphabetic from center if dy was for center
                        const labelHeight = estimateTextHeight(fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
                        yPosFinal = pos.dy + (pos.dy < 0 ? -labelHeight*0.2 : labelHeight*0.2); // Small empirical adjustment
                    }

                    d3.select(this)
                        .attr("x", pos.dx)
                        .attr("y", yPosFinal)
                        .attr("text-anchor", pos.anchor)
                        .attr("dominant-baseline", dominantBaseline)
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", fillStyle.typography.annotationFontSize)
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .style("fill", fillStyle.textColor)
                        .text(d[labelFieldName]);
                }
            });
    }
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}