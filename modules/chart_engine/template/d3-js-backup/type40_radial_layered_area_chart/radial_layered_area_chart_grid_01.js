/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Layered Area Chart",
  "chart_name": "radial_layered_area_chart_grid_01",
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
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "subtle",
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
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    const imagesInput = data.images || {}; // Not used in this chart, but parsed for completeness
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
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        groupColors: {},
        availableColors: colorsInput.available_colors || [...d3.schemeTableau10],
    };

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" }, // Not used for chart title
        label: { font_family: "Arial, sans-serif", font_size: "14px", font_weight: "normal" }, // For category labels, legend
        annotation: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" } // For tick labels
    };

    fillStyle.typography.labelFontFamily = (typographyInput.label && typographyInput.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (typographyInput.label && typographyInput.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (typographyInput.label && typographyInput.label.font_weight) || defaultTypography.label.font_weight;

    fillStyle.typography.annotationFontFamily = (typographyInput.annotation && typographyInput.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (typographyInput.annotation && typographyInput.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (typographyInput.annotation && typographyInput.annotation.font_weight) || defaultTypography.annotation.font_weight;
    
    fillStyle.textColor = colorsInput.text_color || "#333333";
    fillStyle.gridLineColor = (colorsInput.other && colorsInput.other.grid) || "#CCCCCC";
    fillStyle.axisLineColor = (colorsInput.other && colorsInput.other.axis) || "#BBBBBB";
    fillStyle.backgroundColor = colorsInput.background_color || "transparent"; // SVG background

    const uniqueGroups = [...new Set(rawChartData.map(d => d[groupFieldName]))];
    uniqueGroups.forEach((group, i) => {
        if (colorsInput.field && colorsInput.field[group]) {
            fillStyle.groupColors[group] = colorsInput.field[group];
        } else {
            fillStyle.groupColors[group] = fillStyle.availableColors[i % fillStyle.availableColors.length];
        }
    });
    
    const estimateTextWidth = (text, fontProps) => {
        const tempSvg = d3.create("svg");
        const tempTextNode = tempSvg.append("text")
            .style("font-family", fontProps.font_family)
            .style("font-size", fontProps.font_size)
            .style("font-weight", fontProps.font_weight)
            .text(text);
        const width = tempTextNode.node().getBBox().width;
        tempSvg.remove();
        return width;
    };

    const layoutLegend = (legendContainerGroup, legendGroups, styleConfig, options = {}) => {
        const defaults = {
            maxWidth: 500, x: 0, y: 0, itemHeight: 20, itemSpacing: 15, rowSpacing: 10,
            symbolSize: 10, align: "left", shape: "circle"
        };
        const opts = {...defaults, ...options};

        const fontProps = {
            font_family: styleConfig.typography.labelFontFamily,
            font_size: styleConfig.typography.labelFontSize,
            font_weight: styleConfig.typography.labelFontWeight
        };

        const itemWidths = legendGroups.map(group => {
            return opts.symbolSize * 1.5 + 5 + estimateTextWidth(group, fontProps); // symbol + padding + text
        });
        
        const rows = [];
        let currentRow = [], currentRowWidth = 0;
        itemWidths.forEach((width, i) => {
            if (currentRow.length === 0 || currentRowWidth + width + opts.itemSpacing <= opts.maxWidth) {
                currentRow.push(i);
                currentRowWidth += width + (currentRow.length > 1 ? opts.itemSpacing : 0);
            } else {
                rows.push(currentRow);
                currentRow = [i];
                currentRowWidth = width;
            }
        });
        if (currentRow.length > 0) rows.push(currentRow);
        
        const totalHeight = rows.length * opts.itemHeight + (rows.length - 1) * opts.rowSpacing;
        const maxRowWidth = Math.max(0, ...rows.map(row => row.reduce((sum, i, idx) => sum + itemWidths[i] + (idx > 0 ? opts.itemSpacing : 0), 0)));
        
        rows.forEach((row, rowIndex) => {
            const rowWidth = row.reduce((sum, i, idx) => sum + itemWidths[i] + (idx > 0 ? opts.itemSpacing : 0), 0);
            let rowStartX = opts.x;
            if (opts.align === "center") rowStartX = opts.x + (opts.maxWidth - rowWidth) / 2;
            else if (opts.align === "right") rowStartX = opts.x + opts.maxWidth - rowWidth;
            
            let currentX = rowStartX;
            row.forEach(i => {
                const groupName = legendGroups[i];
                const color = styleConfig.groupColors[groupName];
                const itemGroup = legendContainerGroup.append("g")
                    .attr("class", "legend-item")
                    .attr("transform", `translate(${currentX}, ${opts.y + rowIndex * (opts.itemHeight + opts.rowSpacing)})`);
                
                if (opts.shape === "circle") {
                    itemGroup.append("circle").attr("class", "mark")
                        .attr("cx", opts.symbolSize / 2)
                        .attr("cy", opts.itemHeight / 2)
                        .attr("r", opts.symbolSize / 2)
                        .attr("fill", color);
                } else { // Default to square if not circle
                    itemGroup.append("rect").attr("class", "mark")
                        .attr("x", 0)
                        .attr("y", (opts.itemHeight - opts.symbolSize) / 2)
                        .attr("width", opts.symbolSize)
                        .attr("height", opts.symbolSize)
                        .attr("fill", color);
                }
                
                itemGroup.append("text").attr("class", "label")
                    .attr("x", opts.symbolSize * 1.5)
                    .attr("y", opts.itemHeight / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("fill", styleConfig.textColor)
                    .style("font-family", fontProps.font_family)
                    .style("font-size", fontProps.font_size)
                    .style("font-weight", fontProps.font_weight)
                    .text(groupName);
                
                currentX += itemWidths[i] + opts.itemSpacing;
            });
        });
        
        return { width: maxRowWidth, height: totalHeight };
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 50, bottom: 80, left: 50 }; // Increased bottom for legend
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2 - chartMargins.bottom / 2 + chartMargins.top / 2})`) // Center considering legend space
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [valueFieldName]: +d[valueFieldName] // Ensure value is numeric
    }));

    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    
    const groupAvgs = [...new Set(chartDataArray.map(d => d[groupFieldName]))]
        .map(group => ({
            group,
            avg: d3.mean(chartDataArray.filter(d_item => d_item[groupFieldName] === group), d_item => d_item[valueFieldName])
        }))
        .sort((a, b) => b.avg - a.avg); // Sort descending by average value

    const sortedGroups = groupAvgs.map(d => d.group);

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI * (1 - 1 / categories.length)]); // Leave a gap

    const allValues = chartDataArray.map(d => d[valueFieldName]);
    const maxValue = d3.max(allValues) || 0; // Ensure maxValue is at least 0
    
    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue]) // Values are non-negative as per requirements
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const radialTicks = radiusScale.ticks(5);

    mainChartGroup.selectAll(".gridline-circle")
        .data(radialTicks)
        .enter()
        .append("circle")
        .attr("class", "gridline gridline-circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d => radiusScale(d))
        .attr("fill", "none")
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");

    mainChartGroup.selectAll(".axis-radial-line")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis axis-radial-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radiusScale(maxValue) * Math.cos(angleScale(d) - Math.PI / 2)) // Extend to max radius
        .attr("y2", d => radiusScale(maxValue) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    mainChartGroup.selectAll(".label-category")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label label-category")
        .attr("x", d => (radius + 15) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radius + 15) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d); // Raw angle from scale (0 to ~2PI)
            // Heuristic: angles in (PI/4, 3PI/4) and (5PI/4, 7PI/4) might need dominant-baseline adjustments
            // For text-anchor: if angle is mostly on left side (PI/2 to 3PI/2), anchor end.
            // 0 is top. PI/2 is right. PI is bottom. 3PI/2 is left.
            if (angle > Math.PI * 0.5 && angle < Math.PI * 1.5) { // Roughly right side of vertical axis
                 return (angle > Math.PI * 0.9 && angle < Math.PI * 1.1) ? "middle" : "end"; // Near bottom
            }
             return (angle < Math.PI * 0.1 || angle > Math.PI * 1.9) ? "middle" : "start"; // Near top
        })
        .attr("dominant-baseline", d => {
            const angle = angleScale(d);
            if (angle < Math.PI * 0.1 || angle > Math.PI * 1.9) return "alphabetic"; // Top
            if (angle > Math.PI * 0.9 && angle < Math.PI * 1.1) return "hanging"; // Bottom
            return "middle";
        })
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d);

    mainChartGroup.selectAll(".value-tick-label")
        .data(radialTicks.filter(d => d > 0)) // Don't label origin if it's a tick
        .enter()
        .append("text")
        .attr("class", "value value-tick-label")
        .attr("x", 5) // Offset slightly from the "y-axis" (vertical line at 0 angle)
        .attr("y", d => -radiusScale(d) + 5) // Position along the "y-axis"
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => d);

    // Legend
    const legendContainerGroup = svgRoot.append("g")
        .attr("class", "legend");
    
    const legendOptions = {
        maxWidth: innerWidth,
        align: "center",
        shape: "circle",
        itemHeight: parseFloat(fillStyle.typography.labelFontSize) * 1.5, // Adjust based on font size
        symbolSize: parseFloat(fillStyle.typography.labelFontSize) * 0.7,
    };
    const legendSize = layoutLegend(legendContainerGroup, sortedGroups, fillStyle, legendOptions);
    
    legendContainerGroup.attr("transform", `translate(${chartMargins.left + (innerWidth - legendSize.width) / 2}, ${containerHeight - chartMargins.bottom + (chartMargins.bottom - legendSize.height)/2 })`);


    // Block 8: Main Data Visualization Rendering
    const areaRadialGenerator = d3.areaRadial()
        .angle(d => angleScale(d[categoryFieldName]))
        .innerRadius(0) // Areas start from the center
        .outerRadius(d => radiusScale(d[valueFieldName]))
        .curve(d3.curveLinearClosed);

    // Draw groups in reverse order of their average values (smallest avg on top)
    // sortedGroups is already high-to-low average. To draw low-avg first, iterate it reversed.
    [...sortedGroups].reverse().forEach(groupName => {
        const groupData = chartDataArray.filter(d => d[groupFieldName] === groupName);
        
        const processedGroupData = categories.map(cat => {
            const point = groupData.find(d => d[categoryFieldName] === cat);
            return point || { [categoryFieldName]: cat, [valueFieldName]: 0, [groupFieldName]: groupName }; // Ensure value is 0 for missing points
        });

        mainChartGroup.append("path")
            .datum(processedGroupData)
            .attr("class", "mark area-mark")
            .attr("d", areaRadialGenerator)
            .attr("fill", fillStyle.groupColors[groupName])
            .attr("fill-opacity", 0.35)
            .attr("stroke", fillStyle.groupColors[groupName])
            .attr("stroke-width", 1.5)
            .attr("stroke-opacity", 0.7);

        // Optional: draw data points on the areas
        processedGroupData.forEach(d => {
            if (d[valueFieldName] > 0) { // Only draw points with actual data
                const angle = angleScale(d[categoryFieldName]) - Math.PI / 2; // Adjusted for cartesian
                const r = radiusScale(d[valueFieldName]);
                mainChartGroup.append("circle")
                    .attr("class", "mark point-mark")
                    .attr("cx", r * Math.cos(angle))
                    .attr("cy", r * Math.sin(angle))
                    .attr("r", 2.5)
                    .attr("fill", fillStyle.groupColors[groupName])
                    .attr("stroke", fillStyle.backgroundColor === "transparent" ? "#FFFFFF" : fillStyle.backgroundColor) // Contrast stroke
                    .attr("stroke-width", 0.5);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable for this chart based on directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}