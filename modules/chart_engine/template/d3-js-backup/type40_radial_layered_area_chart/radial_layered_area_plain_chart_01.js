/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Layered Area Chart",
  "chart_name": "radial_layered_area_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 7], [0, "inf"], [2, 6]],
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
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is now external to the function)

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldDef = dataColumns.find(col => col.role === 'x');
    const valueFieldDef = dataColumns.find(col => col.role === 'y');
    const groupFieldDef = dataColumns.find(col => col.role === 'group');

    let missingFieldRoles = [];
    if (!categoryFieldDef) missingFieldRoles.push("x");
    if (!valueFieldDef) missingFieldRoles.push("y");
    if (!groupFieldDef) missingFieldRoles.push("group");
    
    if (missingFieldRoles.length > 0) {
        const errorMsg = `Critical chart config missing: Column role(s) [${missingFieldRoles.join(', ')}] not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const groupFieldName = groupFieldDef.name;

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        let missingFieldNames = [];
        if (!categoryFieldName) missingFieldNames.push("x field name");
        if (!valueFieldName) missingFieldNames.push("y field name");
        if (!groupFieldName) missingFieldNames.push("group field name");
        const errorMsg = `Critical chart config missing: Field name(s) for role(s) [${missingFieldNames.join(', ')}] are undefined. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }
    
    if (!Array.isArray(chartData) || chartData.length === 0) {
        const errorMsg = "Chart data is missing, empty, or not an array. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography = {
        labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || defaultTypography.label.font_family,
        labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || defaultTypography.label.font_size,
        labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || defaultTypography.label.font_weight,
    };
    
    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e", grid: "#CCCCCC" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"], // d3.schemeCategory10
        background_color: "#FFFFFF",
        text_color: "#333333"
    };

    fillStyle.backgroundColor = colorsConfig.background_color || defaultColors.background_color;
    fillStyle.textColor = colorsConfig.text_color || defaultColors.text_color;
    fillStyle.gridLineColor = (colorsConfig.other && colorsConfig.other.grid) || defaultColors.other.grid;
    
    fillStyle.seriesColors = (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) ? colorsConfig.available_colors : defaultColors.available_colors;
    fillStyle.fieldColorMappings = colorsConfig.field || defaultColors.field;

    fillStyle.getSeriesColorForGroup = (groupName, groupIndexInSortedList) => {
        if (fillStyle.fieldColorMappings[groupName]) {
            return fillStyle.fieldColorMappings[groupName];
        }
        return fillStyle.seriesColors[groupIndexInSortedList % fillStyle.seriesColors.length];
    };
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback: append to body, measure, remove
            // console.warn("Detached getBBox failed for text measurement, trying attached.", e);
            tempSvg.style.position = 'absolute';
            tempSvg.style.visibility = 'hidden';
            tempSvg.style.left = '-9999px'; // Position off-screen
            document.body.appendChild(tempSvg);
            try {
                width = textElement.getBBox().width;
            } catch (e2) {
                console.error("Failed to measure text width even when appended to body.", e2);
                width = (text ? text.length : 0) * (parseFloat(fontSize) || 12) * 0.6; // Rough estimate
            }
            document.body.removeChild(tempSvg);
        }
        return width;
    }

    function layoutLegend(legendContainerGroup, groupNames, colorScaleFunc, options = {}) {
        const opts = {
            maxWidth: 500, x: 0, y: 0, itemHeight: 20, itemSpacing: 10,
            rowSpacing: 10, symbolSize: 10, align: "left", shape: "circle",
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight,
            textColor: fillStyle.textColor,
            ...options 
        };

        const itemContentWidths = groupNames.map(groupName => {
            const textWidth = estimateTextWidth(groupName, opts.fontFamily, opts.fontSize, opts.fontWeight);
            return opts.symbolSize + 5 + textWidth; // symbol + padding + text
        });
        
        const rowsOfIndices = [];
        let currentRowIndices = [];
        let currentRowWidth = 0;
        
        groupNames.forEach((groupName, i) => {
            const contentWidth = itemContentWidths[i];
            const prospectiveWidth = currentRowIndices.length === 0 ? contentWidth : currentRowWidth + opts.itemSpacing + contentWidth;

            if (currentRowIndices.length === 0 || prospectiveWidth <= opts.maxWidth) {
                currentRowIndices.push(i);
                currentRowWidth = prospectiveWidth;
            } else {
                rowsOfIndices.push(currentRowIndices);
                currentRowIndices = [i];
                currentRowWidth = contentWidth;
            }
        });
        if (currentRowIndices.length > 0) rowsOfIndices.push(currentRowIndices);

        let maxRowActualWidth = 0;
        let currentY = opts.y;

        rowsOfIndices.forEach((rowIndices) => {
            let L_rowCalculatedWidth = 0;
            rowIndices.forEach((itemIndex, idxInRow) => {
                L_rowCalculatedWidth += itemContentWidths[itemIndex];
                if (idxInRow < rowIndices.length - 1) {
                    L_rowCalculatedWidth += opts.itemSpacing;
                }
            });
            maxRowActualWidth = Math.max(maxRowActualWidth, L_rowCalculatedWidth);

            let currentX = opts.x;
            if (opts.align === "center") {
                currentX += (opts.maxWidth - L_rowCalculatedWidth) / 2;
            } else if (opts.align === "right") {
                currentX += opts.maxWidth - L_rowCalculatedWidth;
            }

            rowIndices.forEach((itemIndex, idxInRow) => {
                const groupName = groupNames[itemIndex];
                const color = colorScaleFunc(groupName, itemIndex); // Pass original index for color consistency

                const itemGroup = legendContainerGroup.append("g")
                    .attr("class", "legend-item")
                    .attr("transform", `translate(${currentX}, ${currentY})`);

                if (opts.shape === "circle") {
                    itemGroup.append("circle")
                        .attr("class", "mark legend-symbol")
                        .attr("cx", opts.symbolSize / 2)
                        .attr("cy", opts.itemHeight / 2)
                        .attr("r", opts.symbolSize / 2)
                        .attr("fill", color);
                } else { 
                    itemGroup.append("rect")
                        .attr("class", "mark legend-symbol")
                        .attr("x", 0)
                        .attr("y", (opts.itemHeight - opts.symbolSize) / 2)
                        .attr("width", opts.symbolSize)
                        .attr("height", opts.symbolSize)
                        .attr("fill", color);
                }

                itemGroup.append("text")
                    .attr("class", "label legend-label")
                    .attr("x", opts.symbolSize + 5)
                    .attr("y", opts.itemHeight / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("fill", opts.textColor)
                    .style("font-family", opts.fontFamily)
                    .style("font-size", opts.fontSize)
                    .style("font-weight", opts.fontWeight)
                    .text(groupName);
                
                currentX += itemContentWidths[itemIndex] + (idxInRow < rowIndices.length - 1 ? opts.itemSpacing : 0);
            });
            currentY += opts.itemHeight + opts.rowSpacing;
        });
        
        const totalLegendHeight = rowsOfIndices.length * opts.itemHeight + (rowsOfIndices.length > 0 ? (rowsOfIndices.length - 1) * opts.rowSpacing : 0);
        return { width: maxRowActualWidth, height: totalLegendHeight };
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("class", "chart-svg-root") // Added class for root
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: parseFloat(variables.margin_top) || 50, 
        right: parseFloat(variables.margin_right) || 50, 
        bottom: parseFloat(variables.margin_bottom) || 80, 
        left: parseFloat(variables.margin_left) || 50 
    };

    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(chartWidth, chartHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left + chartWidth / 2}, ${chartMargins.top + chartHeight / 2})`);

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartData.map(d => d[categoryFieldName]))];
    if (categories.length === 0) {
        const errorMsg = "No categories found in data. Cannot render radial chart.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }
    
    const groupAvgs = [...new Set(chartData.map(d => d[groupFieldName]))]
        .map(group => ({
            group,
            avg: d3.mean(chartData.filter(d => d[groupFieldName] === group), d => parseFloat(d[valueFieldName])) || 0
        }))
        .sort((a, b) => b.avg - a.avg); 

    const sortedGroups = groupAvgs.map(d => d.group); 

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]); 

    const allValues = chartData.map(d => parseFloat(d[valueFieldName])).filter(v => !isNaN(v));
    const minValue = Math.min(0, d3.min(allValues) || 0); 
    const maxValue = d3.max(allValues) || 0; 
    
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue === minValue ? minValue + 1 : maxValue]) // Avoid domain [0,0]
        .range([0, radius]) 
        .nice();

    // Block 7: Chart Component Rendering
    const effectiveMaxValueForGrid = radiusScale.domain()[1]; // Use the scaled domain max

    const radialTicks = radiusScale.ticks(5).filter(tick => tick > 0 && tick <= effectiveMaxValueForGrid);
    mainChartGroup.selectAll(".circular-gridline")
        .data(radialTicks)
        .enter().append("circle")
        .attr("class", "gridline circular-gridline")
        .attr("r", d => radiusScale(d))
        .attr("fill", "none")
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 0.5) 
        .attr("stroke-dasharray", "3,3");

    mainChartGroup.selectAll(".radial-axis-line")
        .data(categories)
        .enter().append("line")
        .attr("class", "axis radial-axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radiusScale(effectiveMaxValueForGrid) * Math.cos(angleScale(d) - Math.PI / 2)) 
        .attr("y2", d => radiusScale(effectiveMaxValueForGrid) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    const labelRadius = radiusScale(effectiveMaxValueForGrid) + (parseFloat(fillStyle.typography.labelFontSize) || 12) * 1.5; 
    mainChartGroup.selectAll(".category-label")
        .data(categories)
        .enter().append("text")
        .attr("class", "label category-label")
        .attr("x", d => labelRadius * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => labelRadius * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angleRad = angleScale(d);
            if (Math.abs(angleRad) < 0.01 || Math.abs(angleRad - 2 * Math.PI) < 0.01) return "start"; // 0 degrees
            if (Math.abs(angleRad - Math.PI) < 0.01) return "end"; // 180 degrees
            if (angleRad > 0 && angleRad < Math.PI) return "middle"; // Top half
            return "middle"; // Bottom half
        })
        .attr("dominant-baseline", d => {
            const angleRad = angleScale(d);
            if (Math.abs(angleRad - Math.PI / 2) < 0.01) return "auto"; // 90 degrees (top)
            if (Math.abs(angleRad - 3 * Math.PI / 2) < 0.01) return "hanging"; // 270 degrees (bottom)
            if (angleRad > Math.PI / 2 && angleRad < 3 * Math.PI / 2) return "hanging"; // Left side
            return "auto"; // Right side
        })
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d);

    if (sortedGroups.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend");
        
        const legendOptions = {
            maxWidth: chartWidth,
            align: "center",
        };
        // Pass sortedGroups to legend, color func will use index from this list
        const legendSize = layoutLegend(legendGroup, sortedGroups, (groupName, index) => fillStyle.getSeriesColorForGroup(groupName, index), legendOptions);
        
        const legendX = (containerWidth - legendSize.width) / 2;
        const legendY = containerHeight - chartMargins.bottom + (parseFloat(fillStyle.typography.labelFontSize) || 12) * 0.5 + 10; // Adjusted Y for better spacing
        legendGroup.attr("transform", `translate(${legendX}, ${legendY})`);
    }

    // Block 8: Main Data Visualization Rendering
    const areaRadialGenerator = d3.areaRadial()
        .angle(d => angleScale(d[categoryFieldName]))
        .innerRadius(0) 
        .outerRadius(d => radiusScale(parseFloat(d[valueFieldName])))
        .curve(d3.curveLinearClosed); 

    [...sortedGroups].reverse().forEach((groupName) => { // Draw smallest avg group first, largest avg group last (bottom layer)
        const groupData = chartData.filter(d => d[groupFieldName] === groupName);
        const groupIndexInSortedList = sortedGroups.indexOf(groupName); // Get index from original sort order for color consistency
        
        const processedGroupData = categories.map(cat => {
            const point = groupData.find(d => d[categoryFieldName] === cat);
            const value = point ? parseFloat(point[valueFieldName]) : 0;
            return { [categoryFieldName]: cat, [valueFieldName]: isNaN(value) ? 0 : value, [groupFieldName]: groupName };
        });

        mainChartGroup.append("path")
            .datum(processedGroupData)
            .attr("class", "mark area-mark")
            .attr("d", areaRadialGenerator)
            .attr("fill", fillStyle.getSeriesColorForGroup(groupName, groupIndexInSortedList)) 
            .attr("fill-opacity", 0.35) 
            .attr("stroke", fillStyle.getSeriesColorForGroup(groupName, groupIndexInSortedList))
            .attr("stroke-width", 1.5)
            .attr("stroke-opacity", 0.7);

        processedGroupData.forEach(d => {
            if (d[valueFieldName] > 0) { 
                const angleRad = angleScale(d[categoryFieldName]) - Math.PI / 2;
                const r = radiusScale(d[valueFieldName]);
                mainChartGroup.append("circle")
                    .attr("class", "mark point-mark")
                    .attr("cx", r * Math.cos(angleRad))
                    .attr("cy", r * Math.sin(angleRad))
                    .attr("r", 2.5) 
                    .attr("fill", fillStyle.getSeriesColorForGroup(groupName, groupIndexInSortedList))
                    .attr("stroke", fillStyle.backgroundColor) 
                    .attr("stroke-width", 0.5);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this chart)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}