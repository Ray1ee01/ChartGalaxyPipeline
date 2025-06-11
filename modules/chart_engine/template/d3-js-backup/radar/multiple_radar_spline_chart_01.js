/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Radar Spline Chart",
  "chart_name": "multiple_radar_spline_chart_01",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via data.colors_dark
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const groupFieldName = dataColumns.find(col => col.role === "group")?.name;

    const criticalFields = { categoryFieldName, valueFieldName, groupFieldName };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render. Required roles: 'x', 'y', 'group'.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null;
    }
    
    // Filter out data points with missing critical fields
    const chartData = rawChartData.filter(d => 
        d[categoryFieldName] !== undefined && 
        d[valueFieldName] !== undefined && 
        d[groupFieldName] !== undefined &&
        typeof d[valueFieldName] === 'number' && !isNaN(d[valueFieldName])
    );

    if (chartData.length === 0) {
        const errorMessage = "No valid data available to render the chart after filtering.";
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            categoryLabelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            categoryLabelFontSize: (typography.label && typography.label.font_size) || '12px',
            categoryLabelFontWeight: (typography.label && typography.label.font_weight) || 'bold',
            tickLabelFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            tickLabelFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            tickLabelFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
            legendFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            legendFontSize: (typography.label && typography.label.font_size) || '12px',
            legendFontWeight: (typography.label && typography.label.font_weight) || 'normal',
        },
        chartBackground: rawColors.background_color || '#FFFFFF',
        textColor: rawColors.text_color || '#333333',
        axisLineColor: rawColors.other?.axis_line || '#BBBBBB',
        gridLineColor: rawColors.other?.grid_line || '#DDDDDD',
        pointStrokeColor: rawColors.other?.point_stroke || '#FFFFFF',
        defaultGroupColors: d3.schemeTableau10,
    };

    function estimateTextWidth(text, fontProps) {
        if (!text || typeof text !== 'string') return 0;
        const defaultFont = {
            font_family: 'Arial, sans-serif',
            font_size: '12px',
            font_weight: 'normal',
        };
        const mergedProps = { ...defaultFont, ...fontProps };
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', mergedProps.font_family);
        tempText.setAttribute('font-size', mergedProps.font_size);
        tempText.setAttribute('font-weight', mergedProps.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // document.body.appendChild(tempSvg); // Temporarily append to measure accurately
        let width = 0;
        try {
             width = tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements fails or for complex text
            const fontSizePx = parseFloat(mergedProps.font_size) || 12;
            width = text.length * (fontSizePx * 0.6); // Rough estimate
        }
        // tempSvg.remove();
        return width;
    }
    
    function getColor(groupName, groupIndex) {
        if (rawColors.field && rawColors.field[groupFieldName] && rawColors.field[groupFieldName][groupName]) {
            return rawColors.field[groupFieldName][groupName];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[groupIndex % rawColors.available_colors.length];
        }
        return fillStyle.defaultGroupColors[groupIndex % fillStyle.defaultGroupColors.length];
    }

    function layoutLegend(legendContainer, legendItems, colorAccessor, textStyleProps) {
        const itemHeight = parseFloat(textStyleProps.legendFontSize) * 1.5 || 20;
        const spacing = parseFloat(textStyleProps.legendFontSize) * 0.5 || 5;
        const markerRadius = parseFloat(textStyleProps.legendFontSize) * 0.4 || 5;
        let maxWidth = 0;

        const legend = legendContainer.append("g").attr("class", "legend");

        legendItems.forEach((itemText, i) => {
            const legendItem = legend.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(0, ${i * itemHeight})`);

            legendItem.append("circle")
                .attr("class", "legend-mark")
                .attr("cx", markerRadius)
                .attr("cy", markerRadius - (parseFloat(textStyleProps.legendFontSize)/3)) // Align with text better
                .attr("r", markerRadius)
                .style("fill", colorAccessor(itemText, i));

            legendItem.append("text")
                .attr("class", "legend-label")
                .attr("x", markerRadius * 2 + spacing)
                .attr("y", markerRadius)
                .attr("dy", "0.32em") // Vertical alignment
                .style("font-family", textStyleProps.legendFontFamily)
                .style("font-size", textStyleProps.legendFontSize)
                .style("font-weight", textStyleProps.legendFontWeight)
                .style("fill", fillStyle.textColor)
                .text(itemText);
            
            const itemWidth = markerRadius * 2 + spacing + estimateTextWidth(itemText, textStyleProps);
            if (itemWidth > maxWidth) {
                maxWidth = itemWidth;
            }
        });
        return { width: maxWidth, height: legendItems.length * itemHeight };
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: variables.margin_top || 60, right: variables.margin_right || 60, bottom: variables.margin_bottom || 60, left: variables.margin_left || 60 };
    
    // Adjust margins if legend is very tall
    const tempSortedGroupNamesForLegend = [...new Set(chartData.map(d => d[groupFieldName]))];
    const estimatedLegendHeight = tempSortedGroupNamesForLegend.length * (parseFloat(fillStyle.typography.legendFontSize) * 1.5 || 20);
    if (chartMargins.top < estimatedLegendHeight + 20 && tempSortedGroupNamesForLegend.length > 0) { // 20 for padding
        chartMargins.top = estimatedLegendHeight + 20;
    }


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartData.map(d => d[categoryFieldName]))];
    
    const groupedChartData = d3.group(chartData, d => d[groupFieldName]);
    
    const groupAvgs = Array.from(groupedChartData.keys())
        .map(group => ({
            group,
            avg: d3.mean(groupedChartData.get(group), d => d[valueFieldName])
        }))
        .sort((a, b) => b.avg - a.avg); // Sort groups by average value, descending

    const sortedGroupNames = groupAvgs.map(d => d.group);


    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]); // Ensure last axis doesn't overlap first

    const allValues = chartData.map(d => d[valueFieldName]);
    const minValue = 0; // Per requirements y-range [0, "inf"]
    const maxValue = d3.max(allValues) || 0; // Handle empty allValues case

    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue === 0 ? 1 : maxValue * 1.1]) // Add 10% padding, handle all zero values
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const numTicks = 5;
    const ticks = radiusScale.ticks(numTicks);

    // Concentric Circles (Gridlines)
    mainChartGroup.selectAll(".grid-circle")
        .data(ticks)
        .enter().append("circle")
        .attr("class", "grid-line")
        .attr("r", d => radiusScale(d))
        .style("fill", "none")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-width", 1)
        .style("stroke-dasharray", "3,3");

    // Radial Axis Lines
    mainChartGroup.selectAll(".radial-axis-line")
        .data(categories)
        .enter().append("line")
        .attr("class", "axis radial-axis-line")
        .attr("y1", 0)
        .attr("x1", 0)
        .attr("x2", (d) => radiusScale(maxValue === 0 ? 1 : maxValue * 1.1) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y2", (d) => radiusScale(maxValue === 0 ? 1 : maxValue * 1.1) * Math.sin(angleScale(d) - Math.PI / 2))
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1);

    // Category Labels
    const categoryLabels = mainChartGroup.selectAll(".category-label")
        .data(categories)
        .enter().append("text")
        .attr("class", "label category-label")
        .attr("x", d => (radiusScale(maxValue === 0 ? 1 : maxValue * 1.1) + 15) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radiusScale(maxValue === 0 ? 1 : maxValue * 1.1) + 15) * Math.sin(angleScale(d) - Math.PI / 2))
        .text(d => d)
        .style("font-family", fillStyle.typography.categoryLabelFontFamily)
        .style("font-size", fillStyle.typography.categoryLabelFontSize)
        .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("text-anchor", d => {
            const angle = angleScale(d); // Original logic used angleScale(d) directly for this
            if (Math.abs(angle % Math.PI) < 0.01) return "middle"; // Close to 0 or PI (East/West on unit circle)
            return angle > Math.PI ? "end" : "start"; // (PI, 2PI) vs (0, PI)
        })
        .attr("dominant-baseline", d => {
            const angle = angleScale(d);
            const visualAngle = angleScale(d) - Math.PI / 2; // Angle for drawing
            if (Math.abs(visualAngle - Math.PI/2) < 0.01 || Math.abs(visualAngle + Math.PI/2) < 0.01) { // Top or bottom points
                 return "middle";
            }
            return visualAngle > -Math.PI/2 && visualAngle < Math.PI/2 ? "central" : "middle"; // Heuristic, original was complex
        });


    // Tick Value Labels
    mainChartGroup.selectAll(".tick-label")
        .data(ticks.filter(d => d > 0)) // Don't label origin tick if it's 0
        .enter().append("text")
        .attr("class", "label tick-label")
        .attr("x", 5)
        .attr("y", d => -radiusScale(d))
        .attr("dy", "-0.2em")
        .text(d => d)
        .style("font-family", fillStyle.typography.tickLabelFontFamily)
        .style("font-size", fillStyle.typography.tickLabelFontSize)
        .style("font-weight", fillStyle.typography.tickLabelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "start");

    // Legend
    if (sortedGroupNames.length > 0) {
        const legendElement = svgRoot.append("g").attr("class", "legend-group-container");
        const legendSize = layoutLegend(legendElement, sortedGroupNames, getColor, fillStyle.typography);
        
        const legendX = (containerWidth - legendSize.width) / 2;
        const legendY = chartMargins.top / 2 - legendSize.height / 2; // Center in top margin
        legendElement.attr("transform", `translate(${Math.max(chartMargins.left, legendX)}, ${Math.max(10, legendY)})`);
    }


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.lineRadial()
        .angle(d => angleScale(d[categoryFieldName]))
        .radius(d => radiusScale(d[valueFieldName]))
        .curve(d3.curveCatmullRomClosed.alpha(0.5));

    sortedGroupNames.forEach((groupName, groupIndex) => {
        const groupData = groupedChartData.get(groupName);
        if (!groupData || groupData.length === 0) return;

        // Ensure data is sorted by categories for line generator
        const orderedGroupData = categories.map(cat => {
            return groupData.find(p => p[categoryFieldName] === cat) || {[categoryFieldName]: cat, [valueFieldName]: minValue}; // Default to minValue if missing
        });
        
        // Radar Lines
        mainChartGroup.append("path")
            .datum(orderedGroupData)
            .attr("class", "mark radar-line")
            .attr("d", lineGenerator)
            .style("fill", "none")
            .style("stroke", getColor(groupName, groupIndex))
            .style("stroke-width", 3);

        // Data Points
        orderedGroupData.forEach(pointData => {
            if (pointData[valueFieldName] === undefined) return; // Skip if no value (e.g. from default above)

            const angle = angleScale(pointData[categoryFieldName]);
            const r = radiusScale(pointData[valueFieldName]);
            
            mainChartGroup.append("circle")
                .attr("class", "mark radar-point")
                .attr("cx", r * Math.cos(angle - Math.PI / 2))
                .attr("cy", r * Math.sin(angle - Math.PI / 2))
                .attr("r", 4)
                .style("fill", getColor(groupName, groupIndex))
                .style("stroke", fillStyle.pointStrokeColor)
                .style("stroke-width", 1.5);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable for this chart based on directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}