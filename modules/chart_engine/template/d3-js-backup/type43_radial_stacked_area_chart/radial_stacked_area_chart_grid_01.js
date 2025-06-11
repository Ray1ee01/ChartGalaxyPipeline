/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Stacked Area Chart",
  "chart_name": "radial_stacked_area_chart_grid_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 7], [0, "inf"], [1, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "prominent",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "ascending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a radial stacked area chart.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme if not specified, dark theme would be data.colors_dark
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;
    const groupFieldName = (dataColumns.find(col => col.role === "group") || {}).name;

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        if (!groupFieldName) missingFields.push("group role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        colors: {
            textColor: colors.text_color || '#333333',
            backgroundColor: colors.background_color || '#FFFFFF',
            gridLineColor: colors.text_color || '#CCCCCC', // Defaulting to text_color or a light gray
            defaultCategoryColors: d3.schemeCategory10,
        }
    };

    fillStyle.colors.categoryColorScale = (groupName, groupIndex) => {
        if (colors.field && colors.field[groupName]) {
            return colors.field[groupName];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[groupIndex % colors.available_colors.length];
        }
        return fillStyle.colors.defaultCategoryColors[groupIndex % fillStyle.colors.defaultCategoryColors.length];
    };
    
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox across browsers
        // but per spec, must not append to DOM. This might be less accurate in some edge cases.
        // If accuracy is paramount and temporary DOM append is allowed, that's preferred.
        // For this implementation, strictly adhering to "MUST NOT be appended to the document DOM".
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            return (text || '').length * (parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root-svg")
        .style("background-color", fillStyle.colors.backgroundColor)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const chartMargins = { top: 50, right: 50, bottom: 80, left: 50 }; // Increased bottom for legend

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2 - chartMargins.bottom/2 + chartMargins.top/2})`); // Centering the radial plot

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartData.map(d => d[categoryFieldName]))];
    
    const groupAvgs = [...new Set(chartData.map(d => d[groupFieldName]))]
        .map(group => ({
            group,
            avg: d3.mean(chartData.filter(d => d[groupFieldName] === group), d => +d[valueFieldName] || 0)
        }))
        .sort((a, b) => a.avg - b.avg); // Stack smaller average groups on the inside

    const groups = groupAvgs.map(d => d.group);

    const stackedData = categories.map(category => {
        const categoryData = { category };
        let cumulative = 0;
        groups.forEach(group => {
            const point = chartData.find(d => d[categoryFieldName] === category && d[groupFieldName] === group);
            const value = point ? (+point[valueFieldName] || 0) : 0;
            categoryData[`${group}_start`] = cumulative;
            categoryData[`${group}_end`] = cumulative + value;
            cumulative += value;
        });
        categoryData.total = cumulative;
        return categoryData;
    });

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]); // Ensure segments don't overlap at 0/2PI

    const maxTotal = d3.max(stackedData, d => d.total);
    const radiusScale = d3.scaleLinear()
        .domain([0, maxTotal > 0 ? maxTotal : 1]) // Ensure domain is not [0,0]
        .range([0, radius])
        .nice();

    // Color scale is fillStyle.colors.categoryColorScale defined in Block 2

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const gridTicks = radiusScale.ticks(5);

    // Concentric Circle Gridlines
    mainChartGroup.selectAll(".grid-circle")
        .data(gridTicks)
        .enter()
        .append("circle")
        .attr("class", "gridline grid-circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d => radiusScale(d))
        .attr("fill", "none")
        .attr("stroke", fillStyle.colors.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");

    // Radial Axis Lines
    mainChartGroup.selectAll(".radial-axis-line")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis radial-axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radiusScale(maxTotal > 0 ? maxTotal : 1) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y2", d => radiusScale(maxTotal > 0 ? maxTotal : 1) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.colors.gridLineColor)
        .attr("stroke-width", 1);

    // Category Labels (Outer)
    mainChartGroup.selectAll(".category-label-text")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label category-label-text")
        .attr("x", d => (radiusScale(maxTotal > 0 ? maxTotal : 1) + 15) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radiusScale(maxTotal > 0 ? maxTotal : 1) + 15) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d);
            // Adjust anchor based on angle to keep text readable
            if (angle > Math.PI / 2 && angle < 3 * Math.PI / 2) { // Left side
                return (angle > Math.PI * 0.9 && angle < Math.PI * 1.1) ? "middle" : "end";
            } else { // Right side
                return (angle < Math.PI * 0.1 || angle > Math.PI * 1.9) ? "middle" : "start";
            }
        })
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.colors.textColor)
        .attr("font-family", fillStyle.typography.labelFontFamily)
        .attr("font-size", fillStyle.typography.labelFontSize)
        .attr("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d);

    // Tick Value Labels (Radial)
    mainChartGroup.selectAll(".tick-value-label-text")
        .data(gridTicks.filter(d => d > 0)) // Don't label origin
        .enter()
        .append("text")
        .attr("class", "value tick-value-label-text")
        .attr("x", 5) // Offset slightly from the axis line
        .attr("y", d => -radiusScale(d) + parseInt(fillStyle.typography.annotationFontSize)/3) // Position along the upward vertical axis
        .attr("text-anchor", "start")
        .attr("fill", fillStyle.colors.textColor)
        .attr("font-family", fillStyle.typography.annotationFontFamily)
        .attr("font-size", fillStyle.typography.annotationFontSize)
        .attr("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => d3.format(",.0f")(d));
    
    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend chart-legend");

    const legendConfig = {
        itemSpacing: 15,
        rowSpacing: 5,
        iconSize: 12,
        iconTextSpacing: 6,
        marginTop: 20, // Margin from chart to legend
        marginLeftRight: chartMargins.left,
        maxLegendWidth: containerWidth - chartMargins.left - chartMargins.right,
        fontProps: {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        }
    };
    
    const legendItemsData = groups.map((group, i) => ({
        label: group,
        color: fillStyle.colors.categoryColorScale(group, i),
        width: legendConfig.iconSize + legendConfig.iconTextSpacing + estimateTextWidth(group, legendConfig.fontProps)
    }));

    const legendRows = [];
    let currentRowItems = [], currentRowWidth = 0;
    legendItemsData.forEach(item => {
        const itemWidthWithSpacing = item.width + (currentRowItems.length > 0 ? legendConfig.itemSpacing : 0);
        if (currentRowItems.length === 0 || (currentRowWidth + itemWidthWithSpacing) <= legendConfig.maxLegendWidth) {
            currentRowItems.push(item);
            currentRowWidth += itemWidthWithSpacing;
        } else {
            legendRows.push({ items: currentRowItems, width: currentRowWidth - legendConfig.itemSpacing }); // remove last spacing
            currentRowItems = [item];
            currentRowWidth = item.width;
        }
    });
    if (currentRowItems.length > 0) {
        legendRows.push({ items: currentRowItems, width: currentRowWidth });
    }
    
    const legendItemHeight = legendConfig.iconSize; // Assuming text fits
    const totalLegendHeight = legendRows.length * legendItemHeight + (legendRows.length - 1) * legendConfig.rowSpacing;
    const legendStartY = containerHeight - chartMargins.bottom + legendConfig.marginTop; // Position below chart area

    legendRows.forEach((row, rowIndex) => {
        let currentX = (containerWidth - row.width) / 2; // Center each row
        const currentY = legendStartY + rowIndex * (legendItemHeight + legendConfig.rowSpacing);

        row.items.forEach(item => {
            const itemGroup = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${currentY})`);

            itemGroup.append("circle")
                .attr("class", "mark legend-mark")
                .attr("cx", legendConfig.iconSize / 2)
                .attr("cy", legendConfig.iconSize / 2)
                .attr("r", legendConfig.iconSize / 2)
                .attr("fill", item.color);

            itemGroup.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendConfig.iconSize + legendConfig.iconTextSpacing)
                .attr("y", legendConfig.iconSize / 2)
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.colors.textColor)
                .attr("font-family", legendConfig.fontProps.fontFamily)
                .attr("font-size", legendConfig.fontProps.fontSize)
                .attr("font-weight", legendConfig.fontProps.fontWeight)
                .text(item.label);
            
            currentX += item.width + legendConfig.itemSpacing;
        });
    });


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const areaRadialGenerator = d3.areaRadial()
        .angle(d => angleScale(d.category))
        .innerRadius(d => radiusScale(d.innerValue))
        .outerRadius(d => radiusScale(d.outerValue))
        .curve(d3.curveLinearClosed);

    groups.forEach((group, groupIndex) => {
        const groupAreaData = stackedData.map(d => ({
            category: d.category,
            innerValue: d[`${group}_start`],
            outerValue: d[`${group}_end`]
        }));

        mainChartGroup.append("path")
            .datum(groupAreaData)
            .attr("class", "mark area-segment")
            .attr("d", areaRadialGenerator)
            .attr("fill", fillStyle.colors.categoryColorScale(group, groupIndex))
            .attr("stroke", fillStyle.colors.categoryColorScale(group, groupIndex)) // Using same color for stroke
            .attr("stroke-width", 0.5) // Subtle stroke to differentiate segments if colors are similar
            .attr("stroke-opacity", 0.8);
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No optional enhancements specified for this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}