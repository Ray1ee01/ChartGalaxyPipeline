/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Radar Chart",
  "chart_name": "multiple_radar_chart_03",
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
  "background": "dark",

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
    // The /* REQUIREMENTS_BEGIN... */ block is external.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors_dark || {}; // Using colors_dark as per original
    const images = data.images || {}; // Not used in this chart but extracted for consistency
    const dataColumns = data.data.columns || [];

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
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }
    
    if (!chartData || chartData.length === 0) {
        const errorMessage = "No data provided to render the chart.";
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        backgroundColor: colors.background_color || '#333333',
        textColor: colors.text_color || '#FFFFFF',
        gridColor: (colors.other && colors.other.grid) ? colors.other.grid : '#BBBBBB',
        axisLabelColor: (colors.other && colors.other.axisLabel) ? colors.other.axisLabel : '#FFFFFF',
        tickLabelColor: (colors.other && colors.other.tickLabel) ? colors.other.tickLabel : '#DDDDDD',
        defaultCategoricalPalette: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        getGroupColor: function(groupName, groupIndex) {
            if (colors.field && colors.field[groupName]) {
                return colors.field[groupName];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[groupIndex % colors.available_colors.length];
            }
            return this.defaultCategoricalPalette[groupIndex % this.defaultCategoricalPalette.length];
        },
        radarAreaOpacity: 0.2,
        gridStrokeWidth: 1,
        axisStrokeWidth: 1,
        radarLineStrokeWidth: 2,
        radarPointRadius: 4,
        radarPointStrokeColor: colors.background_color || '#FFFFFF', // Contrast with area fill
        radarPointStrokeWidth: 1,
    };
    
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // Appending to body and removing is more robust for getBBox but forbidden by prompt.
        // This should work in most modern browsers for text.
        const width = textElement.getBBox().width;
        return width;
    }

    function layoutLegend(legendContainer, items, colorAccessor, typographyProps, shape, itemSpacing, lineSpacing, legendItemHeight, maxWidth) {
        legendContainer.html(''); 
        let x = 0;
        let y = 0;
        let totalCalculatedWidth = 0;
        let currentLineWidth = 0;
        const shapeSize = parseInt(typographyProps.fontSize) * 0.8; 
        const textPadding = shapeSize * 0.5; 

        items.forEach((item, index) => {
            const itemColor = colorAccessor(item, index);
            const itemText = String(item); // Ensure text is string
            
            const textWidth = estimateTextWidth(itemText, typographyProps);
            const entryWidth = shapeSize + textPadding + textWidth + itemSpacing;

            if (x + entryWidth > maxWidth && x > 0) { 
                x = 0;
                y += legendItemHeight + lineSpacing;
                currentLineWidth = 0;
            }

            const gItem = legendContainer.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${x}, ${y})`);

            if (shape === "circle") {
                gItem.append("circle")
                    .attr("class", "legend-mark mark")
                    .attr("cx", shapeSize / 2)
                    .attr("cy", legendItemHeight / 2) 
                    .attr("r", shapeSize / 2)
                    .style("fill", itemColor);
            } else { 
                gItem.append("rect")
                    .attr("class", "legend-mark mark")
                    .attr("x", 0)
                    .attr("y", (legendItemHeight - shapeSize) / 2) 
                    .attr("width", shapeSize)
                    .attr("height", shapeSize)
                    .style("fill", itemColor);
            }

            gItem.append("text")
                .attr("class", "legend-label text")
                .attr("x", shapeSize + textPadding)
                .attr("y", legendItemHeight / 2)
                .attr("dominant-baseline", "middle")
                .style("font-family", typographyProps.fontFamily)
                .style("font-size", typographyProps.fontSize)
                .style("font-weight", typographyProps.fontWeight)
                .style("fill", fillStyle.textColor)
                .text(itemText);
            
            x += entryWidth;
            currentLineWidth += entryWidth;
            totalCalculatedWidth = Math.max(totalCalculatedWidth, currentLineWidth);
        });
        const totalHeight = y + legendItemHeight;
        return { width: totalCalculatedWidth > 0 ? totalCalculatedWidth - itemSpacing : 0, height: totalHeight }; // Subtract last itemSpacing
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
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendPadding = 20;
    const legendItemHeight = parseInt(fillStyle.typography.labelFontSize) * 1.5;
    const legendItemSpacing = 15;
    const legendLineSpacing = 5;
    
    const tempLegendGroups = [...new Set(chartData.map(d => d[groupFieldName]))];
    const estimatedLegendSize = layoutLegend(svgRoot.append("g").attr("class", "temp-legend-group"), tempLegendGroups, 
        (item, index) => fillStyle.getGroupColor(item, index), 
        { fontFamily: fillStyle.typography.labelFontFamily, fontSize: fillStyle.typography.labelFontSize, fontWeight: fillStyle.typography.labelFontWeight }, 
        "circle", legendItemSpacing, legendLineSpacing, legendItemHeight, containerWidth - 2 * legendPadding
    );
    svgRoot.select(".temp-legend-group").remove();

    const chartMargins = { 
        top: (variables.margin_top !== undefined) ? variables.margin_top : (legendPadding + estimatedLegendSize.height + legendPadding / 2),
        right: (variables.margin_right !== undefined) ? variables.margin_right : 50, 
        bottom: (variables.margin_bottom !== undefined) ? variables.margin_bottom : 50, 
        left: (variables.margin_left !== undefined) ? variables.margin_left : 50
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const radarPlotRadius = Math.min(innerWidth, innerHeight) / 2 * 0.9; // Factor to ensure labels fit
    const categoryLabelPadding = parseInt(fillStyle.typography.labelFontSize) * 1.2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2 + (chartMargins.top - chartMargins.bottom) / 2})`);

    // Block 5: Data Preprocessing & Transformation
    const categoriesArray = [...new Set(chartData.map(d => d[categoryFieldName]))];
    
    const groupAvgs = [...new Set(chartData.map(d => d[groupFieldName]))]
        .map(group => ({
            group,
            avg: d3.mean(chartData.filter(d => d[groupFieldName] === group), d => d[valueFieldName]) || 0
        }))
        .sort((a, b) => b.avg - a.avg); 
    
    const groupsArray = groupAvgs.map(d => d.group);
    const groupedDataMap = d3.group(chartData, d => d[groupFieldName]);

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categoriesArray)
        .range([0, 2 * Math.PI]); // Full circle, last point will overlap first if not handled by line generator

    const allValues = chartData.map(d => d[valueFieldName]).filter(v => v !== null && v !== undefined);
    const minValue = Math.min(0, d3.min(allValues) || 0);
    const maxValue = d3.max(allValues) || 0;
    
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue === minValue ? minValue + 1 : maxValue]) // Avoid domain [0,0]
        .range([0, radarPlotRadius])
        .nice();

    // Block 7: Chart Component Rendering
    const ticks = radiusScale.ticks(5);
    const maxRadiusForGrid = radiusScale(maxValue);

    mainChartGroup.selectAll(".grid-circle")
        .data(ticks)
        .enter()
        .append("circle")
        .attr("class", "grid-circle mark axis") 
        .attr("r", d => radiusScale(d))
        .style("fill", "none")
        .style("stroke", fillStyle.gridColor)
        .style("stroke-width", fillStyle.gridStrokeWidth)
        .style("stroke-dasharray", "4,4");

    mainChartGroup.selectAll(".radial-axis-line")
        .data(categoriesArray)
        .enter()
        .append("line")
        .attr("class", "radial-axis-line axis")
        .attr("y2", -maxRadiusForGrid) // Lines go from center upwards
        .attr("transform", d => `rotate(${angleScale(d) * 180 / Math.PI})`) // Rotate line
        .style("stroke", fillStyle.gridColor)
        .style("stroke-width", fillStyle.axisStrokeWidth);

    mainChartGroup.selectAll(".category-label")
        .data(categoriesArray)
        .enter()
        .append("text")
        .attr("class", "category-label label text")
        .attr("x", d => (maxRadiusForGrid + categoryLabelPadding) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (maxRadiusForGrid + categoryLabelPadding) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d); 
            if (Math.abs(angle - Math.PI / 2) < 0.01 || Math.abs(angle - 3 * Math.PI / 2) < 0.01) return "middle";
            return (angle > Math.PI / 2 && angle < 3 * Math.PI / 2) ? "end" : "start";
        })
        .attr("dominant-baseline", d => {
            const angle = angleScale(d);
            if (Math.abs(angle) < 0.01 || Math.abs(angle - Math.PI) < 0.01) return "middle";
            return (angle > 0 && angle < Math.PI) ? "hanging" : "alphabetic";
        })
        .style("fill", fillStyle.axisLabelColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d);

    mainChartGroup.selectAll(".tick-value-label")
        .data(ticks.filter(d => minValue === 0 ? d !== 0 : true)) 
        .enter()
        .append("text")
        .attr("class", "tick-value-label label text")
        .attr("x", 5) 
        .attr("y", d => -radiusScale(d))
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("fill", fillStyle.tickLabelColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => d);

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend");
    
    const finalLegendSize = layoutLegend(legendGroup, groupsArray, 
        (item, index) => fillStyle.getGroupColor(item, groupsArray.indexOf(item)), 
        { fontFamily: fillStyle.typography.labelFontFamily, fontSize: fillStyle.typography.labelFontSize, fontWeight: fillStyle.typography.labelFontWeight }, 
        "circle", legendItemSpacing, legendLineSpacing, legendItemHeight, containerWidth - 2 * legendPadding
    );
    legendGroup.attr("transform", `translate(${(containerWidth - finalLegendSize.width) / 2}, ${legendPadding})`);

    // Block 8: Main Data Visualization Rendering
    const linePathGenerator = d3.lineRadial()
        .angle(d => angleScale(d[categoryFieldName])) 
        .radius(d => radiusScale(d[valueFieldName]))
        .curve(d3.curveLinearClosed);

    groupsArray.forEach((group, groupIndex) => {
        const groupData = groupedDataMap.get(group) || [];
        if (groupData.length === 0) return;

        const sortedGroupData = categoriesArray.map(cat => {
            const point = groupData.find(item => item[categoryFieldName] === cat);
            return point || { [categoryFieldName]: cat, [valueFieldName]: minValue }; 
        });

        mainChartGroup.append("path")
            .datum(sortedGroupData)
            .attr("class", `radar-area mark group-${String(group).replace(/\s+/g, '-')}`)
            .attr("d", linePathGenerator)
            .style("fill", fillStyle.getGroupColor(group, groupIndex))
            .style("fill-opacity", fillStyle.radarAreaOpacity)
            .style("stroke", fillStyle.getGroupColor(group, groupIndex))
            .style("stroke-width", fillStyle.radarLineStrokeWidth)
            .style("stroke-linejoin", "miter");

        mainChartGroup.selectAll(`.radar-point.group-${String(group).replace(/\s+/g, '-')}`)
            .data(sortedGroupData.filter(d => d[valueFieldName] !== undefined && d[valueFieldName] !== null && d[valueFieldName] !== minValue && groupData.find(item => item[categoryFieldName] === d[categoryFieldName]))) // Only actual points
            .enter()
            .append("circle")
            .attr("class", `radar-point mark group-${String(group).replace(/\s+/g, '-')}`)
            .attr("r", fillStyle.radarPointRadius)
            .attr("transform", d => `rotate(${angleScale(d[categoryFieldName]) * 180 / Math.PI}) translate(0, ${-radiusScale(d[valueFieldName])})`) // Rotate then translate along new Y
            .style("fill", fillStyle.getGroupColor(group, groupIndex))
            .style("stroke", fillStyle.radarPointStrokeColor)
            .style("stroke-width", fillStyle.radarPointStrokeWidth);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}