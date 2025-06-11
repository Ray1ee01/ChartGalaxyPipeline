/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Stacked Area Chart",
  "chart_name": "radial_stacked_area_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 20], [0, "inf"], [1, 6]],
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
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // Note: The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const config = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Could be data.colors_dark for dark themes, adapt if needed
    const imagesConfig = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === 'x')?.name;
    const valueFieldName = dataColumns.find(col => col.role === 'y')?.name;
    const groupFieldName = dataColumns.find(col => col.role === 'group')?.name;

    const criticalFields = { categoryFieldName, valueFieldName, groupFieldName };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};
    fillStyle.typography = {
        titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) ? typographyConfig.title.font_family : 'Arial, sans-serif',
        titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) ? typographyConfig.title.font_size : '16px',
        titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) ? typographyConfig.title.font_weight : 'bold',
        labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
        labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '14px',
        labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
        annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
        annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
        annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
    };

    const defaultColors = {
        text_color: '#333333',
        background_color: '#FFFFFF',
        primary: '#007bff', // Example default primary
        available_colors: d3.schemeCategory10 
    };
    const currentColors = {
        ...defaultColors,
        ...colorsConfig,
        // Ensure nested objects are also merged or handled correctly
        field: colorsConfig.field || {},
        other: { ...defaultColors.other, ...(colorsConfig.other || {}) },
        available_colors: (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) ? colorsConfig.available_colors : defaultColors.available_colors
    };

    fillStyle.textColor = currentColors.text_color;
    fillStyle.backgroundColor = currentColors.background_color;
    fillStyle.axisLineColor = currentColors.text_color; // Default to text_color
    fillStyle.gridLineColor = currentColors.text_color; // Default to text_color, maybe lighter

    fillStyle.getColor = (groupName, groupIndex) => {
        if (currentColors.field && currentColors.field[groupName]) {
            return currentColors.field[groupName];
        }
        if (currentColors.available_colors && currentColors.available_colors.length > 0) {
            return currentColors.available_colors[groupIndex % currentColors.available_colors.length];
        }
        // This fallback should ideally not be reached if currentColors.available_colors is always populated
        return d3.schemeCategory10[groupIndex % d3.schemeCategory10.length];
    };
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const tempTextElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tempTextElement.setAttribute("font-family", fontFamily);
        tempTextElement.setAttribute("font-size", fontSize);
        tempTextElement.setAttribute("font-weight", fontWeight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // Note: getBBox on non-DOM-attached elements can be unreliable.
        // For this exercise, we assume it works as per prompt constraints.
        let width = 0;
        try {
            width = tempTextElement.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth: getBBox failed for off-DOM element.", e);
            // Fallback: rough estimate based on character count and font size
            width = text.length * (parseFloat(fontSize) * 0.6);
        }
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    svgRoot.style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: config.marginTop || 50,
        right: config.marginRight || 50,
        bottom: config.marginBottom || 80, // Increased for legend
        left: config.marginLeft || 50
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    
    const groupAverages = [...new Set(chartDataArray.map(d => d[groupFieldName]))]
        .map(group => ({
            group,
            avg: d3.mean(chartDataArray.filter(d_item => d_item[groupFieldName] === group), d_item => d_item[valueFieldName]) || 0
        }))
        .sort((a, b) => a.avg - b.avg); // Stack smaller averages inside
    
    const groups = groupAverages.map(d => d.group);

    const stackedData = categories.map(category => {
        const categoryData = { category };
        let cumulativeValue = 0;
        groups.forEach(group => {
            const point = chartDataArray.find(d => d[categoryFieldName] === category && d[groupFieldName] === group);
            const value = point ? point[valueFieldName] : 0;
            categoryData[`${group}_start`] = cumulativeValue;
            categoryData[`${group}_end`] = cumulativeValue + value;
            cumulativeValue += value;
        });
        categoryData.total = cumulativeValue;
        return categoryData;
    });

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]); // Ensure last segment doesn't overlap first

    const maxTotalValue = d3.max(stackedData, d => d.total) || 0;
    const radiusScale = d3.scaleLinear()
        .domain([0, maxTotalValue])
        .range([0, radius])
        .nice();

    const groupColorMapping = {};
    groups.forEach((group, index) => {
        groupColorMapping[group] = fillStyle.getColor(group, index);
    });
    const colorScale = (groupName) => groupColorMapping[groupName];

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Radial axis lines (spokes)
    mainChartGroup.selectAll(".radial-axis-line")
        .data(categories)
        .join("line")
        .attr("class", "axis radial-axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radiusScale(maxTotalValue) * Math.cos(angleScale(d) - Math.PI / 2)) // Extend to max radius
        .attr("y2", d => radiusScale(maxTotalValue) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Category labels
    mainChartGroup.selectAll(".category-label")
        .data(categories)
        .join("text")
        .attr("class", "label category-label")
        .attr("x", d => (radiusScale(maxTotalValue) + 15) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radiusScale(maxTotalValue) + 15) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d);
            // Adjust text anchor based on angle for better readability
            if (angle > Math.PI / 2 && angle < 3 * Math.PI / 2) { // Left side
                return (angleScale(d) - Math.PI / 2) > Math.PI ? "end" : "start"; // This logic might need refinement based on exact rotation
            }
            return (angleScale(d) - Math.PI / 2) > Math.PI && (angleScale(d) - Math.PI/2) < 2*Math.PI ? "end" : "start";
        })
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight) // Using labelFontWeight
        .attr("fill", fillStyle.textColor)
        .text(d => d);

    // Value ticks and labels (along one conceptual axis, e.g., vertical)
    const valueTicks = radiusScale.ticks(5).filter(d => d > 0);

    mainChartGroup.selectAll(".value-tick-line")
        .data(valueTicks)
        .join("line")
        .attr("class", "axis grid-line") // Using grid-line class
        .attr("x1", -5) // Short horizontal line
        .attr("y1", d => -radiusScale(d))
        .attr("x2", 5)
        .attr("y2", d => -radiusScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);
    
    mainChartGroup.selectAll(".value-tick-label")
        .data(valueTicks)
        .join("text")
        .attr("class", "label value-label") // Using value-label class
        .attr("x", 8) // Position to the right of the tick line
        .attr("y", d => -radiusScale(d))
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .attr("fill", fillStyle.textColor)
        .text(d => d3.format(",.0f")(d));

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend");

    const legendConfig = {
        itemSpacing: 25,
        rowSpacing: 15,
        iconSize: parseFloat(fillStyle.typography.labelFontSize) * 0.8 || 12, // Scale icon with font
        iconTextSpacing: 8,
        maxWidth: innerWidth * 0.9, // Max width for legend rows
        marginTop: 20 // Space above legend
    };
    
    const legendItems = groups.map(group => ({
        label: group,
        color: colorScale(group),
        width: legendConfig.iconSize + legendConfig.iconTextSpacing + estimateTextWidth(
            group, 
            fillStyle.typography.labelFontFamily, 
            fillStyle.typography.labelFontSize, 
            fillStyle.typography.labelFontWeight
        )
    }));

    const legendRows = [];
    let currentRow = [], currentRowWidth = 0;
    legendItems.forEach(item => {
        const itemTotalWidth = item.width + (currentRow.length > 0 ? legendConfig.itemSpacing : 0);
        if (currentRow.length === 0 || (currentRowWidth + itemTotalWidth) <= legendConfig.maxWidth) {
            currentRow.push(item);
            currentRowWidth += itemTotalWidth;
        } else {
            legendRows.push({ items: currentRow, width: currentRowWidth - (currentRow.length > 0 ? legendConfig.itemSpacing : 0) });
            currentRow = [item];
            currentRowWidth = item.width;
        }
    });
    if (currentRow.length > 0) {
         legendRows.push({ items: currentRow, width: currentRowWidth });
    }
    
    const legendTotalHeight = legendRows.length * (legendConfig.iconSize + legendConfig.rowSpacing) - (legendRows.length > 0 ? legendConfig.rowSpacing : 0);
    const legendMaxRowWidth = Math.max(0, ...legendRows.map(row => row.width));

    const legendStartX = (containerWidth - legendMaxRowWidth) / 2;
    // Position legend below the chart area, using bottom margin.
    const legendStartY = containerHeight - chartMargins.bottom + legendConfig.marginTop; 


    legendGroup.attr("transform", `translate(0, ${legendStartY})`);

    let currentYOffset = 0;
    legendRows.forEach(row => {
        let currentXOffset = legendStartX + (legendMaxRowWidth - row.width) / 2; // Center each row
        row.items.forEach((item, index) => {
            const itemGroup = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentXOffset}, ${currentYOffset})`);

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
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .attr("fill", fillStyle.textColor)
                .text(item.label);
            
            currentXOffset += item.width + legendConfig.itemSpacing;
        });
        currentYOffset += legendConfig.iconSize + legendConfig.rowSpacing;
    });


    // Block 8: Main Data Visualization Rendering
    const areaRadialGenerator = d3.areaRadial()
        .angle(d => angleScale(d.category))
        .innerRadius(d => radiusScale(d.innerValue))
        .outerRadius(d => radiusScale(d.outerValue))
        .curve(d3.curveLinearClosed);

    groups.forEach(group => {
        const groupAreaData = stackedData.map(d => ({
            category: d.category,
            innerValue: d[`${group}_start`],
            outerValue: d[`${group}_end`]
        }));

        mainChartGroup.append("path")
            .datum(groupAreaData)
            .attr("class", "mark area-segment")
            .attr("d", areaRadialGenerator)
            .attr("fill", colorScale(group))
            .attr("stroke", colorScale(group)) // Keep stroke as in original
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 1);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements identified from original that aren't covered.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}