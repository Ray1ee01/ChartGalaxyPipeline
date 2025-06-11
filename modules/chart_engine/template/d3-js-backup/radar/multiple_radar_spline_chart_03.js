/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radar Chart",
  "chart_name": "multiple_radar_spline_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 7], [0, "inf"], [1, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_light || {}; // Prioritize data.colors, fallback to data.colors_light for compatibility with original
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');
    const groupColumn = dataColumns.find(col => col.role === 'group');

    if (!categoryColumn || !valueColumn || !groupColumn) {
        const missing = [
            !categoryColumn ? "x role" : null,
            !valueColumn ? "y role" : null,
            !groupColumn ? "group role" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: column roles for ${missing}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;
    const groupFieldName = groupColumn.name;

    if (chartData.length === 0) {
        const errorMsg = "Chart data is empty. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    
    const categories = [...new Set(chartData.map(d => d[categoryFieldName]))];
    if (categories.length < 3) { // Radar charts typically need at least 3 axes
        const errorMsg = `Insufficient categories (found ${categories.length}, need at least 3). Cannot render radar chart.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        axisLineColor: colorsConfig.other?.axis_line || '#CCCCCC',
        gridLineColor: colorsConfig.other?.grid_line || '#E0E0E0',
        primaryAccent: colorsConfig.other?.primary || '#007bff',
        defaultGroupColors: d3.schemeCategory10,
        typography: {
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        }
    };

    fillStyle.getGroupColor = (groupName, groupIndex) => {
        if (colorsConfig.field && colorsConfig.field[groupName]) {
            return colorsConfig.field[groupName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[groupIndex % colorsConfig.available_colors.length];
        }
        return fillStyle.defaultGroupColors[groupIndex % fillStyle.defaultGroupColors.length];
    };
    
    fillStyle.getImageUrl = (imageKey, type = 'field') => { // type can be 'field' or 'other'
        if (type === 'field' && imagesConfig.field && imagesConfig.field[imageKey]) {
            return imagesConfig.field[imageKey];
        }
        if (type === 'other' && imagesConfig.other && imagesConfig.other[imageKey]) {
            return imagesConfig.other[imageKey];
        }
        return null;
    };

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No need to append to DOM for getBBox if attributes are set
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails (e.g., in some test environments)
            return text.length * (parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = { top: 60, right: 60, bottom: 60, left: 60 }; // Adjusted for labels and legend

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radarRadius = Math.min(innerWidth, innerHeight) / 2 * 0.85; // 0.85 to leave space for labels
    const radarCenterX = innerWidth / 2;
    const radarCenterY = innerHeight / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const radarContentGroup = mainChartGroup.append("g")
        .attr("class", "radar-content")
        .attr("transform", `translate(${radarCenterX}, ${radarCenterY})`);

    // Block 5: Data Preprocessing & Transformation
    const groupAvgs = [...new Set(chartData.map(d => d[groupFieldName]))]
        .map(group => ({
            group,
            avg: d3.mean(chartData.filter(d => d[groupFieldName] === group), d => d[valueFieldName])
        }))
        .sort((a, b) => b.avg - a.avg);
    
    const sortedGroupNames = groupAvgs.map(d => d.group);
    const groupedData = d3.group(chartData, d => d[groupFieldName]);

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI]); // Full circle, lineRadial will handle closing

    const allValues = chartData.map(d => d[valueFieldName]);
    const maxValue = d3.max(allValues) || 0; // Ensure maxValue is at least 0
    
    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue === 0 ? 1 : maxValue * 1.1]) // Ensure domain is not [0,0] if all values are 0; 1.1 for headroom
        .range([0, radarRadius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    
    // Radial Axis Lines (spokes)
    radarContentGroup.selectAll(".axis.radial-axis")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis radial-axis")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", (d) => radiusScale(radiusScale.domain()[1]) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y2", (d) => radiusScale(radiusScale.domain()[1]) * Math.sin(angleScale(d) - Math.PI / 2))
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1);

    // Concentric Grid Circles
    const numGridTicks = 5;
    const gridTicks = radiusScale.ticks(numGridTicks).slice(1); // Exclude center point

    radarContentGroup.selectAll(".gridline")
        .data(gridTicks)
        .enter()
        .append("circle")
        .attr("class", "gridline")
        .attr("r", d => radiusScale(d))
        .style("fill", "none")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-dasharray", "3,3");

    // Category Labels (Axis Labels)
    const labelOffset = 20;
    radarContentGroup.selectAll(".label.axis-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label axis-label")
        .attr("x", d => (radarRadius + labelOffset) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radarRadius + labelOffset) * Math.sin(angleScale(d) - Math.PI / 2))
        .text(d => d)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("text-anchor", d => {
            const angle = angleScale(d); // Angle where 0 is East
            if (Math.abs(angle - 0) < 0.01 || Math.abs(angle - Math.PI) < 0.01) return "middle"; // East or West
            return angle > 0 && angle < Math.PI ? "start" : "end"; // Lower half vs Upper half
        })
        .attr("dominant-baseline", d => {
            const angle = angleScale(d); // Angle where 0 is East
            const effectiveVisualAngle = (angle - Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI); // 0 is North
            if (Math.abs(effectiveVisualAngle - 0) < 0.01) return "alphabetic"; // Top
            if (Math.abs(effectiveVisualAngle - Math.PI) < 0.01) return "hanging"; // Bottom
            return "middle";
        });

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend");
    
    const legendItemHeight = parseInt(fillStyle.typography.labelFontSize) + 4;
    const legendSwatchSize = parseInt(fillStyle.typography.labelFontSize) * 0.8;
    const legendSwatchPadding = 5;
    let currentX = 0;
    let legendWidth = 0;

    sortedGroupNames.forEach((groupName, i) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item");

        itemGroup.append("rect")
            .attr("class", "mark legend-swatch")
            .attr("x", currentX)
            .attr("y", 0)
            .attr("width", legendSwatchSize)
            .attr("height", legendSwatchSize)
            .style("fill", fillStyle.getGroupColor(groupName, i));

        const textElement = itemGroup.append("text")
            .attr("class", "label legend-text")
            .attr("x", currentX + legendSwatchSize + legendSwatchPadding)
            .attr("y", legendSwatchSize / 2) // Vertically center with swatch
            .text(groupName)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("dominant-baseline", "middle");
        
        const itemWidth = legendSwatchSize + legendSwatchPadding + estimateTextWidth(groupName, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        currentX += itemWidth + 15; // 15 for padding between items
        legendWidth = currentX - 15; // Total width without last padding
    });
    
    const legendX = (containerWidth - legendWidth) / 2;
    const legendY = chartMargins.top / 2 - legendItemHeight / 2; // Center in top margin
    legendGroup.attr("transform", `translate(${legendX > 0 ? legendX : 10}, ${legendY > 0 ? legendY : 10})`);


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const lineRadialGenerator = d3.lineRadial()
        .angle(d => angleScale(d[categoryFieldName]) - Math.PI / 2) // Rotate by -PI/2 to start at North
        .radius(d => radiusScale(d[valueFieldName]))
        .curve(d3.curveLinearClosed);

    sortedGroupNames.forEach((groupName, groupIndex) => {
        const groupValues = groupedData.get(groupName) || [];
        
        // Ensure data for all categories, defaulting to 0 if missing
        const pathData = categories.map(cat => {
            const point = groupValues.find(item => item[categoryFieldName] === cat);
            return point ? point : { [categoryFieldName]: cat, [valueFieldName]: 0, [groupFieldName]: groupName };
        });

        radarContentGroup.append("path")
            .datum(pathData)
            .attr("class", `mark radar-area series-${groupIndex}`)
            .attr("d", lineRadialGenerator)
            .style("fill", fillStyle.getGroupColor(groupName, groupIndex))
            .style("fill-opacity", 0.35) // Reduced opacity for multiple series
            .style("stroke", fillStyle.getGroupColor(groupName, groupIndex))
            .style("stroke-width", 2);
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Not applicable for this refactoring pass.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}