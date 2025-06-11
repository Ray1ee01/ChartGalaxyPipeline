/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Radar Line Chart",
  "chart_name": "multiple_radar_line_chart_03",
  "is_composite": false,
  "required_fields": ["group", "x", "y"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["categorical"], ["numerical"]],
  "required_fields_range": [[2, 6], [3, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "none",
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
    const inputTypography = data.typography || {};
    const inputColors = data.colors_dark || data.colors || {}; // Prefer dark theme colors
    // const inputImages = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const groupFieldName = (dataColumns.find(col => col.role === "group") || {}).name;
    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;

    if (!groupFieldName || !categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!groupFieldName) missingFields.push("group field (role='group')");
        if (!categoryFieldName) missingFields.push("category field (role='x')");
        if (!valueFieldName) missingFields.push("value field (role='y')");
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    if (chartDataArray.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMsg}</div>`);
        return null;
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        other: {}
    };

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.defaultFontFamily = (inputTypography.label && inputTypography.label.font_family) || defaultTypography.label.font_family;
    
    fillStyle.typography.groupTitleFontFamily = (inputTypography.label && inputTypography.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.groupTitleFontSize = (inputTypography.label && inputTypography.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.groupTitleFontWeight = (inputTypography.label && inputTypography.label.font_weight) || defaultTypography.label.font_weight;

    fillStyle.typography.categoryLabelFontFamily = (inputTypography.annotation && inputTypography.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.categoryLabelFontSize = (inputTypography.annotation && inputTypography.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.categoryLabelFontWeight = (inputTypography.annotation && inputTypography.annotation.font_weight) || defaultTypography.annotation.font_weight;

    // Color defaults (for dark theme)
    fillStyle.backgroundColor = inputColors.background_color || "#1E1E1E"; // Dark background
    fillStyle.textColor = inputColors.text_color || "#FFFFFF";
    fillStyle.primaryColor = (inputColors.other && inputColors.other.primary) || "#1f77b4";
    fillStyle.gridLineColor = inputColors.grid_line_color || "#555555"; // Subtle grid for dark bg
    fillStyle.radarPointStrokeColor = inputColors.radar_point_stroke_color || "#FFFFFF"; // Contrast for points
    fillStyle.radarAreaOpacity = 0.2;


    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        tempSvgNode.appendChild(textNode);
        // Appending to body temporarily for reliable getBBox, then removing.
        // This deviates slightly from "MUST NOT be appended" if interpreted strictly as "never ever",
        // but is the most reliable way for getBBox. If truly forbidden, accuracy may suffer.
        // Let's try without appending first, as per strict interpretation of III.2 example.
        // document.body.appendChild(tempSvgNode); 
        try {
            const width = textNode.getBBox().width;
            // if (document.body.contains(tempSvgNode)) document.body.removeChild(tempSvgNode);
            return width;
        } catch (e) {
            // if (document.body.contains(tempSvgNode)) document.body.removeChild(tempSvgNode);
            console.warn("SVG getBBox failed for text measurement without DOM attachment, using fallback. Text:", text, e);
            const size = parseFloat(fontSize) || 12;
            return text.length * size * 0.6; 
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-container")
        .style("background-color", fillStyle.backgroundColor);
        // No viewBox, fixed dimensions as per III.1

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 50, bottom: 50, left: 50 }; // Adjusted margins

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    let uniqueGroups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    if (uniqueGroups.length > 6) {
        uniqueGroups = uniqueGroups.slice(0, 6);
    }
    
    const groupedData = {};
    uniqueGroups.forEach(group => {
        groupedData[group] = chartDataArray.filter(d => d[groupFieldName] === group && d[valueFieldName] !== null && d[valueFieldName] !== undefined);
    });

    const groupMaxValues = {};
    uniqueGroups.forEach(group => {
        groupMaxValues[group] = d3.max(groupedData[group], d => d[valueFieldName]);
    });
    const sortedGroups = [...uniqueGroups].sort((a, b) => groupMaxValues[b] - groupMaxValues[a]);

    const allValues = chartDataArray.map(d => d[valueFieldName]).filter(v => v !== null && v !== undefined);
    const minValue = Math.min(0, d3.min(allValues) || 0);
    const maxValue = d3.max(allValues) || 0;

    let allCategories = [];
    uniqueGroups.forEach(group => {
        const categoriesInGroup = groupedData[group].map(d => d[categoryFieldName]);
        allCategories = [...allCategories, ...categoriesInGroup];
    });
    allCategories = [...new Set(allCategories)];

    if (allCategories.length < 3) {
         const errorMsg = `Radar charts require at least 3 categories (axis). Found ${allCategories.length}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }


    // Grid layout calculation
    const numCharts = sortedGroups.length;
    let rows, cols;
    if (numCharts === 0) {
        d3.select(containerSelector).html("<div style='color:orange; padding:10px;'>No groups to display after filtering.</div>");
        return null;
    }
    if (numCharts <= 3) { rows = 1; cols = numCharts; }
    else if (numCharts === 4) { rows = 2; cols = 2; }
    else { rows = 2; cols = Math.ceil(numCharts / 2); } // Max 6 charts -> 2x3

    const itemsPerRow = [];
    for (let i = 0; i < rows; i++) {
        itemsPerRow.push( (i < rows - 1) ? cols : numCharts - cols * (rows - 1) );
    }

    const cellWidth = innerWidth / cols;
    const cellHeight = innerHeight / rows;
    
    const spacingFactorHorizontal = 0.15;
    const spacingFactorVertical = 0.15;
    const chartSpacingHorizontal = cellWidth * spacingFactorHorizontal;
    const chartSpacingVertical = cellHeight * spacingFactorVertical;

    const innerCellWidth = cellWidth - chartSpacingHorizontal;
    const innerCellHeight = cellHeight - chartSpacingVertical;
    
    const radarRadius = Math.min(innerCellWidth, innerCellHeight) / 2.2;

    // Adjust group title font size
    let maxGroupTitleWidth = 0;
    const groupTitleBaseFontSize = parseFloat(fillStyle.typography.groupTitleFontSize);

    sortedGroups.forEach(group => {
        const titleWidth = estimateTextWidth(group, 
            fillStyle.typography.groupTitleFontFamily, 
            fillStyle.typography.groupTitleFontSize, 
            fillStyle.typography.groupTitleFontWeight
        );
        maxGroupTitleWidth = Math.max(maxGroupTitleWidth, titleWidth);
    });
    
    const maxChartAreaWidthForTitle = radarRadius * 2.4;
    let groupTitleScaleFactor = 1;
    if (maxGroupTitleWidth > maxChartAreaWidthForTitle && maxChartAreaWidthForTitle > 0) {
        groupTitleScaleFactor = maxChartAreaWidthForTitle / (maxGroupTitleWidth + 3); // +3 for padding
    }
    const adjustedGroupTitleFontSize = `${Math.max(8, Math.floor(groupTitleBaseFontSize * groupTitleScaleFactor))}px`;


    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(allCategories)
        .range([0, 2 * Math.PI - (2 * Math.PI / allCategories.length)]);

    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue === minValue ? minValue + 1 : maxValue * 1.1]) // Add 1.1 factor for padding, handle maxValue === minValue
        .range([0, radarRadius])
        .nice();

    const radarLineGenerator = d3.lineRadial()
        .angle(d => angleScale(d[categoryFieldName]))
        .radius(d => radiusScale(d[valueFieldName]))
        .curve(d3.curveLinearClosed);
    
    // Block 7: Chart Component Rendering (Axes, Gridlines within each radar)
    // Block 8: Main Data Visualization Rendering (Radar shapes)
    // Block 9: Optional Enhancements & Post-Processing (Group Titles)

    let groupIndex = 0;
    for (let r = 0; r < rows; r++) {
        const itemsInThisRow = itemsPerRow[r];
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;

        for (let c = 0; c < itemsInThisRow; c++) {
            if (groupIndex >= numCharts) break;
            const currentGroup = sortedGroups[groupIndex];
            const currentGroupData = groupedData[currentGroup];

            const chartCenterX = chartMargins.left + rowOffset + (c * cellWidth) + (cellWidth / 2) ;
            const chartCenterY = chartMargins.top + (r * cellHeight) + (cellHeight / 2);

            const radarChartGroup = svgRoot.append("g")
                .attr("class", "radar-chart-group")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            // Render Gridlines (Concentric Circles) - Block 7
            const ticks = radiusScale.ticks(4); // 4 concentric circles
            radarChartGroup.selectAll(".radar-axis-concentric")
                .data(ticks)
                .enter().append("circle")
                .attr("class", "axis radar-axis-concentric")
                .attr("r", d => radiusScale(d))
                .attr("fill", "none")
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 0.5) // Thinner grid lines
                .attr("stroke-dasharray", "3,3");

            // Render Radial Axes Lines - Block 7
            radarChartGroup.selectAll(".radar-axis-radial")
                .data(allCategories)
                .enter().append("line")
                .attr("class", "axis radar-axis-radial")
                .attr("y1", 0)
                .attr("x1", 0)
                .attr("x2", d => radiusScale(maxValue === minValue ? minValue + 1 : maxValue * 1.1) * Math.cos(angleScale(d) - Math.PI / 2)) // Extend to max radius
                .attr("y2", d => radiusScale(maxValue === minValue ? minValue + 1 : maxValue * 1.1) * Math.sin(angleScale(d) - Math.PI / 2))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 0.5);

            // Render Category Labels (only for the first chart to avoid clutter) - Block 7
            if (r === 0 && c === 0) {
                const labelOffset = 10; // Offset from max radius
                radarChartGroup.selectAll(".radar-category-label")
                    .data(allCategories)
                    .enter().append("text")
                    .attr("class", "label radar-category-label")
                    .attr("x", d => (radarRadius + labelOffset) * Math.cos(angleScale(d) - Math.PI / 2))
                    .attr("y", d => (radarRadius + labelOffset) * Math.sin(angleScale(d) - Math.PI / 2))
                    .text(d => d)
                    .style("font-family", fillStyle.typography.categoryLabelFontFamily)
                    .style("font-size", fillStyle.typography.categoryLabelFontSize)
                    .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
                    .attr("fill", fillStyle.textColor)
                    .attr("text-anchor", d => {
                        const angle = angleScale(d) - Math.PI / 2;
                        if (Math.abs(angle) < 0.01 || Math.abs(angle - Math.PI) < 0.01 || Math.abs(angle + Math.PI) < 0.01) return "middle";
                        return angle > -Math.PI && angle < 0 || angle > Math.PI ? "end" : "start";
                    })
                    .attr("dominant-baseline", d => {
                        const angle = angleScale(d) - Math.PI / 2;
                         if (Math.abs(angle - Math.PI/2) < 0.01 || Math.abs(angle + Math.PI/2) < 0.01 ) return "middle";
                         return angle > -Math.PI/2 && angle < Math.PI/2 ? "hanging" : "alphabetic";
                    });
            }
            
            // Prepare data for radar line generator (ensure order matches allCategories)
            const radarPathData = allCategories.map(cat => {
                const point = currentGroupData.find(item => item[categoryFieldName] === cat);
                return {
                    [categoryFieldName]: cat,
                    [valueFieldName]: point ? point[valueFieldName] : 0 // Default to 0 if category is missing for this group
                };
            });


            // Render Radar Area/Line - Block 8
            // Using a slightly different line generator for direct data mapping
            const specificRadarLineGenerator = d3.lineRadial()
                .angle(d => angleScale(d[categoryFieldName]) - Math.PI / 2) // Adjust angle for upward first axis
                .radius(d => radiusScale(d[valueFieldName]))
                .curve(d3.curveLinearClosed);

            radarChartGroup.append("path")
                .datum(radarPathData)
                .attr("class", "mark radar-shape")
                .attr("d", specificRadarLineGenerator)
                .attr("fill", fillStyle.primaryColor)
                .attr("fill-opacity", fillStyle.radarAreaOpacity)
                .attr("stroke", fillStyle.primaryColor)
                .attr("stroke-width", 2) // Thinner line than original 4
                .attr("stroke-linejoin", "round");

            // Render Data Points - Block 8
            radarChartGroup.selectAll(".radar-point")
                .data(radarPathData.filter(d => d[valueFieldName] !== undefined && d[valueFieldName] !== null)) // Only plot existing data points
                .enter().append("circle")
                .attr("class", "mark radar-point")
                .attr("r", 3) // Smaller points than original 4
                .attr("cx", d => radiusScale(d[valueFieldName]) * Math.cos(angleScale(d[categoryFieldName]) - Math.PI / 2))
                .attr("cy", d => radiusScale(d[valueFieldName]) * Math.sin(angleScale(d[categoryFieldName]) - Math.PI / 2))
                .attr("fill", fillStyle.primaryColor)
                .attr("stroke", fillStyle.radarPointStrokeColor)
                .attr("stroke-width", 1.5);

            // Render Group Title - Block 9
            radarChartGroup.append("text")
                .attr("class", "label group-title")
                .attr("x", 0)
                .attr("y", -radarRadius - (parseFloat(adjustedGroupTitleFontSize) > 15 ? 20 : 15) ) // Dynamic offset based on font size
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.groupTitleFontFamily)
                .style("font-size", adjustedGroupTitleFontSize)
                .style("font-weight", fillStyle.typography.groupTitleFontWeight)
                .attr("fill", fillStyle.textColor)
                .text(currentGroup);

            groupIndex++;
        }
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}