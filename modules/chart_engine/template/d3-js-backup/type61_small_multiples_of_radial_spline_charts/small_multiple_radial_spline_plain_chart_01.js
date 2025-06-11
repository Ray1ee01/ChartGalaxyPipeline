/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Radial Line Charts",
  "chart_name": "small_multiple_radial_line_plain_chart_01",
  "is_composite": false,
  "required_fields": ["group", "x", "y"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["categorical"], ["numerical"]],
  "required_fields_range": [[2, 7], [3, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const groupField = dataColumns.find(col => col.role === "group")?.name;
    const categoryField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;

    const criticalFields = { groupField, categoryField, valueField };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: {} // Placeholder for image URLs if used
    };

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = (rawTypography.title && rawTypography.title.font_family) || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = (rawTypography.title && rawTypography.title.font_size) || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = (rawTypography.title && rawTypography.title.font_weight) || defaultTypography.title.font_weight;

    fillStyle.typography.labelFontFamily = (rawTypography.label && rawTypography.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (rawTypography.label && rawTypography.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (rawTypography.label && rawTypography.label.font_weight) || defaultTypography.label.font_weight;
    
    fillStyle.typography.annotationFontFamily = (rawTypography.annotation && rawTypography.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (rawTypography.annotation && rawTypography.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (rawTypography.annotation && rawTypography.annotation.font_weight) || defaultTypography.annotation.font_weight;

    const defaultColors = {
        text_color: "#333333",
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"], // d3.schemeCategory10
        background_color: "#FFFFFF"
    };

    fillStyle.textColor = rawColors.text_color || defaultColors.text_color;
    fillStyle.primaryLineColor = (rawColors.other && rawColors.other.primary) || defaultColors.other.primary;
    fillStyle.gridLineColor = rawColors.grid_color || d3.color(fillStyle.textColor).copy({opacity: 0.3}).toString(); // Example: derive from text_color
    fillStyle.axisLineColor = rawColors.axis_color || d3.color(fillStyle.textColor).copy({opacity: 0.5}).toString(); // Example: derive from text_color

    // Helper for text measurement (using in-memory SVG, may have limitations)
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svgNs = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNs, 'svg');
        // tempSvg.style.position = 'absolute'; // Avoid layout shift if appended, but prompt says not to append.
        // tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS(svgNs, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // document.body.appendChild(tempSvg); // Required by some browsers for getBBox, but against prompt.
        const width = tempText.getBBox().width;
        // tempSvg.remove(); // If appended.
        return width || (text ? text.length * parseFloat(fontSize) * 0.6 : 0); // Fallback if getBBox fails
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
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 120, right: 50, bottom: 80, left: 50 }; // Initial top margin

    // Legend calculation (done early to adjust top margin)
    let allCategoriesForLegend = [];
    const tempGroupedDataForLegend = {};
    let tempGroupsForLegend = [...new Set(rawChartData.map(d => d[groupField]))];
    if (tempGroupsForLegend.length > 6) tempGroupsForLegend = tempGroupsForLegend.slice(0, 6); // Preserve original limit

    tempGroupsForLegend.forEach(group => {
        tempGroupedDataForLegend[group] = rawChartData.filter(d => d[groupField] === group);
        const categoriesInGroup = tempGroupedDataForLegend[group].map(d => d[categoryField]);
        allCategoriesForLegend = [...allCategoriesForLegend, ...categoriesInGroup];
    });
    allCategoriesForLegend = [...new Set(allCategoriesForLegend)];
    
    const legendConfig = {
        itemSpacing: 15, rowSpacing: 8, iconSize: 8, iconTextSpacing: 6,
        maxWidth: containerWidth - 100, 
        fontSize: parseFloat(fillStyle.typography.labelFontSize), // Use configured font size
        fontFamily: fillStyle.typography.labelFontFamily
    };

    const legendItems = allCategoriesForLegend.map(cat => {
        return {
            label: cat,
            // Color will be assigned by categoryColorScale later
            width: legendConfig.iconSize + legendConfig.iconTextSpacing + 
                   estimateTextWidth(cat, legendConfig.fontFamily, `${legendConfig.fontSize}px`, fillStyle.typography.labelFontWeight)
        };
    });

    const legendRows = [];
    let currentLegendRow = [], currentLegendRowWidth = 0;
    legendItems.forEach(item => {
        const itemWidthWithSpacing = item.width + (currentLegendRow.length > 0 ? legendConfig.itemSpacing : 0);
        if (currentLegendRow.length === 0 || (currentLegendRowWidth + itemWidthWithSpacing) <= legendConfig.maxWidth) {
            currentLegendRow.push(item);
            currentLegendRowWidth += itemWidthWithSpacing;
        } else {
            legendRows.push(currentLegendRow);
            currentLegendRow = [item];
            currentLegendRowWidth = item.width;
        }
    });
    if (currentLegendRow.length > 0) legendRows.push(currentLegendRow);

    const legendHeight = legendRows.length * legendConfig.fontSize + (legendRows.length > 0 ? (legendRows.length - 1) * legendConfig.rowSpacing : 0);
    const legendStartY = 20;
    chartMargins.top = legendStartY + legendHeight + 20; // Add some padding after legend

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Small multiples layout
    let groups = [...new Set(rawChartData.map(d => d[groupField]))];
    if (groups.length > 6) groups = groups.slice(0, 6); // Preserve original limit

    const numCharts = groups.length;
    let layoutRows, layoutCols;
    if (numCharts <= 3) { layoutRows = 1; layoutCols = numCharts; }
    else if (numCharts === 4) { layoutRows = 2; layoutCols = 2; }
    else { layoutRows = 2; layoutCols = Math.ceil(numCharts / 2); } // Max 3 per row for 5 or 6
    if (numCharts > 6) { // Should not happen due to slice, but defensive
        layoutRows = Math.ceil(numCharts / 3); layoutCols = 3;
    }


    const cellWidth = innerWidth / layoutCols;
    const cellHeight = innerHeight / layoutRows;
    
    const innerCellWidth = cellWidth * 0.85;
    const innerCellHeight = cellHeight * 0.85;
    const radius = Math.min(innerCellWidth, innerCellHeight) / 2.2;

    // Group title font size adjustment
    const groupLabelFontSizeOriginal = parseFloat(fillStyle.typography.labelFontSize);
    let maxGroupLabelWidth = 0;
    groups.forEach(group => {
        const groupWidth = estimateTextWidth(group, fillStyle.typography.labelFontFamily, `${groupLabelFontSizeOriginal}px`, fillStyle.typography.labelFontWeight);
        maxGroupLabelWidth = Math.max(maxGroupLabelWidth, groupWidth);
    });
    
    const maxChartAreaForTitle = radius * 2.4;
    let groupLabelScaleFactor = 1;
    if (maxGroupLabelWidth > maxChartAreaForTitle && maxChartAreaForTitle > 0) {
        groupLabelScaleFactor = maxChartAreaForTitle / (maxGroupLabelWidth + 3); // +3 for padding
    }
    const adjustedGroupLabelFontSize = `${Math.floor(groupLabelFontSizeOriginal * groupLabelScaleFactor)}px`;


    // Block 5: Data Preprocessing & Transformation
    const chartData = rawChartData; // Already filtered if needed by group limit
    const groupedData = {};
    const groupMaxValues = {};
    groups.forEach(group => {
        groupedData[group] = chartData.filter(d => d[groupField] === group);
        groupMaxValues[group] = d3.max(groupedData[group], d => d[valueField]);
    });

    const sortedGroups = [...groups].sort((a, b) => (groupMaxValues[b] || 0) - (groupMaxValues[a] || 0));
    const allValues = chartData.map(d => d[valueField]);
    const maxValue = d3.max(allValues) || 0;

    let allCategories = [];
    sortedGroups.forEach(group => {
        const categoriesInGroup = groupedData[group].map(d => d[categoryField]);
        allCategories = [...allCategories, ...categoriesInGroup];
    });
    allCategories = [...new Set(allCategories)];


    // Block 6: Scale Definition & Configuration
    const categoryColorScale = d3.scaleOrdinal()
        .domain(allCategories)
        .range(allCategories.map((cat, i) => {
            const fieldColors = rawColors.field || defaultColors.field;
            const availableColors = rawColors.available_colors || defaultColors.available_colors;
            return fieldColors[cat] || availableColors[i % availableColors.length];
        }));

    const angleScale = d3.scalePoint()
        .domain(allCategories)
        .range([0, 2 * Math.PI - (2 * Math.PI / (allCategories.length || 1))]); // Avoid division by zero

    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue * 1.2 : 1]) // Ensure domain is not [0,0]
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(0, ${legendStartY})`);

    const maxLegendRowWidth = Math.max(0, ...legendRows.map(row => 
        row.reduce((sum, item, i) => sum + item.width + (i > 0 ? legendConfig.itemSpacing : 0), 0)
    ));
    const legendStartX = (containerWidth - maxLegendRowWidth) / 2;

    legendRows.forEach((row, rowIndex) => {
        const rowWidth = row.reduce((sum, item, i) => sum + item.width + (i > 0 ? legendConfig.itemSpacing : 0), 0);
        let x = legendStartX + (maxLegendRowWidth - rowWidth) / 2;
        const y = rowIndex * (legendConfig.fontSize + legendConfig.rowSpacing);

        row.forEach(item => {
            const itemGroup = legendGroup.append("g").attr("transform", `translate(${x}, ${y})`);
            itemGroup.append("circle")
                .attr("class", "mark legend-mark")
                .attr("cx", legendConfig.iconSize / 2)
                .attr("cy", legendConfig.fontSize / 2 - legendConfig.iconSize / 4) // Adjust cy for better alignment
                .attr("r", legendConfig.iconSize / 2)
                .attr("fill", categoryColorScale(item.label));
            
            itemGroup.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendConfig.iconSize + legendConfig.iconTextSpacing)
                .attr("y", legendConfig.fontSize / 2)
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${legendConfig.fontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .text(item.label);
            x += item.width + legendConfig.itemSpacing;
        });
    });
    
    // Main chart area group
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const createLineGenerator = (currentGroupData) => {
        return d3.lineRadial()
            .angle(d => angleScale(d[categoryField]))
            .radius(d => radiusScale(d[valueField]))
            .curve(d3.curveLinearClosed) // Ensure path is closed
            .defined(d => typeof d[valueField] === 'number' && !isNaN(d[valueField])); // Handle missing/invalid data points
    };
    
    let groupIndex = 0;
    for (let r = 0; r < layoutRows; r++) {
        const itemsInThisRow = (r < layoutRows - 1 || numCharts % layoutCols === 0) ? layoutCols : numCharts % layoutCols;
        const rowOffset = (layoutCols - itemsInThisRow) * cellWidth / 2;

        for (let c = 0; c < itemsInThisRow; c++) {
            if (groupIndex >= numCharts) break;

            const groupName = sortedGroups[groupIndex];
            const currentGroupData = groupedData[groupName];

            const chartCenterX = rowOffset + (c + 0.5) * cellWidth;
            const chartCenterY = (r + 0.5) * cellHeight;

            const chartGroup = mainChartGroup.append("g")
                .attr("class", `chart-multiple chart-group-${groupName.replace(/\s+/g, '-')}`)
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            // Render gridlines (concentric circles) - part of Block 7 conceptually, but rendered per multiple
            const ticks = radiusScale.ticks(4).filter(tick => tick > 0); // Exclude 0 tick
            chartGroup.selectAll(".gridline-circle")
                .data(ticks)
                .enter()
                .append("circle")
                .attr("class", "gridline gridline-circle")
                .attr("cx", 0).attr("cy", 0)
                .attr("r", d => radiusScale(d))
                .attr("fill", "none")
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3");

            // Render radial axis lines - part of Block 7 conceptually
            if (allCategories.length > 0) {
                 chartGroup.selectAll(".axis-radial")
                    .data(allCategories)
                    .enter()
                    .append("line")
                    .attr("class", "axis axis-radial")
                    .attr("x1", 0).attr("y1", 0)
                    .attr("x2", d => radiusScale(maxValue > 0 ? maxValue * 1.2 : 1) * Math.cos(angleScale(d) - Math.PI / 2)) // Extend to max radius
                    .attr("y2", d => radiusScale(maxValue > 0 ? maxValue * 1.2 : 1) * Math.sin(angleScale(d) - Math.PI / 2))
                    .attr("stroke", fillStyle.axisLineColor)
                    .attr("stroke-width", 1);
            }
           

            // Prepare data for line generator: ensure all categories are present, with 0 value if missing
            const lineData = allCategories.map(cat => {
                const point = currentGroupData.find(item => item[categoryField] === cat);
                return point || { [categoryField]: cat, [valueField]: 0 }; // Use 0 for missing points in line
            });

            // Render main line
            const lineGenerator = createLineGenerator(lineData); // Pass lineData here
             chartGroup.append("path")
                .datum(lineData) // Bind data for line generator
                .attr("class", "mark line-mark")
                .attr("d", lineGenerator)
                .attr("fill", "none")
                .attr("stroke", fillStyle.primaryLineColor)
                .attr("stroke-width", 1.5)
                .attr("stroke-linejoin", "round");


            // Render data points and value labels
            currentGroupData.forEach(d => {
                const angle = angleScale(d[categoryField]);
                const value = d[valueField];
                if (typeof value !== 'number' || isNaN(value)) return; // Skip invalid data points

                const distance = radiusScale(value);
                const pointColor = categoryColorScale(d[categoryField]);
                
                const cx = distance * Math.cos(angle - Math.PI / 2);
                const cy = distance * Math.sin(angle - Math.PI / 2);

                chartGroup.append("circle")
                    .attr("class", "mark point-mark")
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("r", 3)
                    .attr("fill", pointColor)
                    .attr("stroke", fillStyle.chartBackground || "#fff") // Contrast stroke
                    .attr("stroke-width", 1);

                const labelText = value.toString();
                const labelDistance = Math.max(distance + 12, 24); // Position outside point
                const textX = labelDistance * Math.cos(angle - Math.PI / 2);
                const textY = labelDistance * Math.sin(angle - Math.PI / 2);

                chartGroup.append("text")
                    .attr("class", "value data-value-label")
                    .attr("x", textX).attr("y", textY)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .attr("fill", pointColor) // Use point color for label
                    .text(labelText);
            });

            // Render group title
            chartGroup.append("text")
                .attr("class", "label group-title-label")
                .attr("x", 0).attr("y", -radius - 15) // Position above chart
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", adjustedGroupLabelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .attr("fill", fillStyle.textColor)
                .text(groupName);

            groupIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements like annotations or complex interactions in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}