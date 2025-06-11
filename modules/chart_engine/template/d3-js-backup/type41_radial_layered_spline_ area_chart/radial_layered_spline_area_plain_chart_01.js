/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Layered Area Chart",
  "chart_name": "radial_layered_spline_area_plain_chart_01",
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
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    let missingFields = [];
    if (!categoryFieldDef) missingFields.push("x role");
    if (!valueFieldDef) missingFields.push("y role");
    if (!groupFieldDef) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')} in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const groupFieldName = groupFieldDef.name;

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        const errorMsg = "Critical chart config missing: field names derived from roles are undefined. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography defaults
    const defaultFontFamily = "Arial, sans-serif";
    fillStyle.typography.categoryLabelFontFamily = (typography.label && typography.label.font_family) || defaultFontFamily;
    fillStyle.typography.categoryLabelFontSize = (typography.label && typography.label.font_size) || "14px";
    fillStyle.typography.categoryLabelFontWeight = (typography.label && typography.label.font_weight) || "bold";

    fillStyle.typography.legendTextFontFamily = (typography.label && typography.label.font_family) || defaultFontFamily;
    fillStyle.typography.legendTextFontSize = (typography.label && typography.label.font_size) || "12px";
    fillStyle.typography.legendTextFontWeight = (typography.label && typography.label.font_weight) || "normal";

    // Color defaults
    fillStyle.colors.chartBackground = colors.background_color || "#FFFFFF";
    fillStyle.colors.textColor = colors.text_color || "#333333";
    fillStyle.colors.axisLineColor = colors.other && colors.other.axis_line ? colors.other.axis_line : "#BBBBBB"; // Example for a specific semantic color
    fillStyle.colors.defaultGroupColor = colors.other && colors.other.primary ? colors.other.primary : "#1f77b4";
    fillStyle.colors.dataPointStroke = "#FFFFFF"; // Stroke for data points for contrast

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        if (fontFamily) textElement.setAttribute('font-family', fontFamily);
        if (fontSize) textElement.setAttribute('font-size', fontSize);
        if (fontWeight) textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.appendChild(textElement); // Append to an in-memory SVG, not to DOM

        try {
            return textElement.getBBox().width;
        } catch (e) {
            console.warn("Text measurement via getBBox failed. Using fallback.", e);
            const numChars = text ? text.length : 0;
            const size = parseFloat(fontSize || "10px");
            return numChars * size * 0.6; // Rough fallback
        }
    }

    function layoutLegend(legendContainerGroup, groupNames, colorScaleFunc, options = {}) {
        const itemHeight = parseFloat(options.itemHeight) || 20;
        const itemSpacing = parseFloat(options.itemSpacing) || 10; // Spacing between items in a row
        const rowSpacing = parseFloat(options.rowSpacing) || 5;   // Spacing between rows
        const symbolSize = parseFloat(options.symbolSize) || 10;
        const legendMaxWidth = parseFloat(options.maxWidth) || 500;
        const legendX = parseFloat(options.x) || 0;
        const legendY = parseFloat(options.y) || 0;
        const align = options.align || "left"; // 'left', 'center', 'right' for items within maxWidth

        const itemWidths = groupNames.map(name => {
            const textWidth = estimateTextWidth(
                name,
                fillStyle.typography.legendTextFontFamily,
                fillStyle.typography.legendTextFontSize,
                fillStyle.typography.legendTextFontWeight
            );
            return symbolSize + 5 + textWidth; // symbol + padding + text
        });

        const rows = [];
        let currentRow = [], currentRowWidth = 0;
        itemWidths.forEach((width, i) => {
            if (currentRow.length === 0 || currentRowWidth + width + itemSpacing <= legendMaxWidth) {
                currentRow.push(i);
                currentRowWidth += width + (currentRow.length > 1 ? itemSpacing : 0);
            } else {
                rows.push({ items: currentRow, width: currentRowWidth });
                currentRow = [i];
                currentRowWidth = width;
            }
        });
        if (currentRow.length > 0) rows.push({ items: currentRow, width: currentRowWidth });

        let currentY = legendY;
        let actualMaxRowWidth = 0;

        rows.forEach(row => {
            let currentX = legendX;
            if (align === "center") {
                currentX += (legendMaxWidth - row.width) / 2;
            } else if (align === "right") {
                currentX += legendMaxWidth - row.width;
            }
            actualMaxRowWidth = Math.max(actualMaxRowWidth, row.width);

            row.items.forEach((itemIndex, idxInRow) => {
                const groupName = groupNames[itemIndex];
                const itemGroup = legendContainerGroup.append("g")
                    .attr("class", "other legend-item")
                    .attr("transform", `translate(${currentX}, ${currentY})`);

                itemGroup.append("circle")
                    .attr("class", "mark legend-symbol")
                    .attr("cx", symbolSize / 2)
                    .attr("cy", itemHeight / 2)
                    .attr("r", symbolSize / 2)
                    .attr("fill", colorScaleFunc(groupName));

                itemGroup.append("text")
                    .attr("class", "label legend-text")
                    .attr("x", symbolSize + 5)
                    .attr("y", itemHeight / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("fill", fillStyle.colors.textColor)
                    .style("font-family", fillStyle.typography.legendTextFontFamily)
                    .style("font-size", fillStyle.typography.legendTextFontSize)
                    .style("font-weight", fillStyle.typography.legendTextFontWeight)
                    .text(groupName);
                
                currentX += itemWidths[itemIndex] + itemSpacing;
            });
            currentY += itemHeight + rowSpacing;
        });
        
        const totalHeight = rows.length * itemHeight + Math.max(0, rows.length - 1) * rowSpacing;
        return { width: actualMaxRowWidth, height: totalHeight };
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.colors.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 50, bottom: 80, left: 50 }; // Increased bottom for legend
    
    const chartInnerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartInnerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(chartInnerWidth, chartInnerHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2 - chartMargins.bottom/2 + chartMargins.top/2})`) // Center considering margins
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartData.map(d => d[categoryFieldName]))].sort(); // Sort categories for consistent order

    const groupAvgs = [...new Set(chartData.map(d => d[groupFieldName]))]
        .map(group => ({
            group,
            avg: d3.mean(chartData.filter(d => d[groupFieldName] === group), d => d[valueFieldName]) || 0
        }))
        .sort((a, b) => b.avg - a.avg); // Sort groups by average value, descending

    const sortedGroups = groupAvgs.map(d => d.group);

    // Block 6: Scale Definition & Configuration
    const colorScale = (groupName) => {
        if (colors.field && colors.field[groupName]) {
            return colors.field[groupName];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            const groupIndex = sortedGroups.indexOf(groupName);
            return colors.available_colors[groupIndex % colors.available_colors.length];
        }
        const groupIndex = sortedGroups.indexOf(groupName);
        return d3.schemeCategory10[groupIndex % 10]; // Fallback to d3.schemeCategory10
    };

    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]); // Small gap at the end

    const allValues = chartData.map(d => d[valueFieldName]);
    const maxValue = d3.max(allValues) || 0; // Ensure maxValue is at least 0

    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue]) // Values are expected to be non-negative
        .range([0, radius])
        .nice();
    
    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Render radial axis lines (spokes)
    mainChartGroup.selectAll(".axis-line")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis radial-axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radiusScale(maxValue) * Math.cos(angleScale(d) - Math.PI / 2)) // Use radiusScale(maxValue) for outer extent
        .attr("y2", d => radiusScale(maxValue) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.colors.axisLineColor)
        .attr("stroke-width", 1);

    // Render category labels
    const labelOffset = 20; // Offset for labels from the main chart radius
    mainChartGroup.selectAll(".category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label category-label")
        .attr("x", d => (radiusScale(maxValue) + labelOffset) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radiusScale(maxValue) + labelOffset) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d);
            // Adjust text-anchor based on angle for readability
            if (angle === 0 || Math.abs(angle - Math.PI) < 0.01) return "middle"; // Top or Bottom
            return angle > Math.PI ? "end" : "start"; // Left or Right side
        })
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.colors.textColor)
        .style("font-family", fillStyle.typography.categoryLabelFontFamily)
        .style("font-size", fillStyle.typography.categoryLabelFontSize)
        .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
        .text(d => d);

    // Render Legend
    if (sortedGroups.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "other legend");
        
        const legendSize = layoutLegend(legendGroup, sortedGroups, colorScale, {
            maxWidth: chartInnerWidth,
            itemHeight: 20,
            itemSpacing: 10,
            rowSpacing: 5,
            symbolSize: 10,
            align: "center"
        });

        legendGroup.attr("transform", `translate(${(containerWidth - legendSize.width) / 2}, ${containerHeight - chartMargins.bottom + 15})`);
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const areaRadialGenerator = d3.areaRadial()
        .angle(d => angleScale(d[categoryFieldName]))
        .innerRadius(0) // All areas start from the center
        .outerRadius(d => radiusScale(d[valueFieldName]))
        .curve(d3.curveCatmullRomClosed.alpha(0.5));

    // Render areas for each group (smallest average group drawn first, largest average group drawn last/on top)
    [...sortedGroups].reverse().forEach(group => {
        const groupData = chartData.filter(d => d[groupFieldName] === group);
        
        // Map data to categories, ensuring correct order and handling missing points for a category
        const processedGroupData = categories
            .map(cat => groupData.find(d => d[categoryFieldName] === cat))
            .filter(d => d !== undefined && d[valueFieldName] !== null && d[valueFieldName] !== undefined); // Ensure valid data points

        if (processedGroupData.length >= 3) { // Need at least 3 points for a closed area with CatmullRom
            mainChartGroup.append("path")
                .datum(processedGroupData)
                .attr("class", "mark area-mark")
                .attr("d", areaRadialGenerator)
                .attr("fill", colorScale(group))
                .attr("fill-opacity", 0.35) // Semi-transparent to see layers
                .attr("stroke", colorScale(group))
                .attr("stroke-width", 1.5)
                .attr("stroke-opacity", 0.8);
        }

        // Render data points (circles) for this group
        processedGroupData.forEach(point => {
            const angle = angleScale(point[categoryFieldName]) - Math.PI / 2;
            const r = radiusScale(point[valueFieldName]);
            
            mainChartGroup.append("circle")
                .attr("class", "mark point-mark")
                .attr("cx", r * Math.cos(angle))
                .attr("cy", r * Math.sin(angle))
                .attr("r", 3)
                .attr("fill", colorScale(group))
                .attr("stroke", fillStyle.colors.dataPointStroke)
                .attr("stroke-width", 1);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}