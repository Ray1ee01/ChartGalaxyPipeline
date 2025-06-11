/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Layered Area Chart",
  "chart_name": "radial_layered_area_chart_01",
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
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme if not specified
    const images = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === 'x');
    const valueFieldDef = dataColumns.find(col => col.role === 'y');
    const groupFieldDef = dataColumns.find(col => col.role === 'group');

    const missingFields = [];
    if (!categoryFieldDef) missingFields.push("x role");
    if (!valueFieldDef) missingFields.push("y role");
    if (!groupFieldDef) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')} in dataColumns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const groupFieldName = groupFieldDef.name;

    if (!chartData || chartData.length === 0) {
        const errorMsg = "No data provided to chart. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding: 20px;'>${errorMsg}</div>`);
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
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#333333',
        primaryColor: (colors.other && colors.other.primary) ? colors.other.primary : '#007bff',
        gridLineColor: (colors.other && colors.other.grid) ? colors.other.grid : '#CCCCCC', // Added a specific grid color or use primary
        axisLabelColor: colors.text_color || '#333333',
        dataPointStrokeColor: '#FFFFFF', // For stroke around data points on areas
    };

    const estimateTextWidth = (text, fontProps) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on in-memory SVG might fail
            const avgCharWidth = parseFloat(fontProps.fontSize) * 0.6; // Rough estimate
            return text.length * avgCharWidth;
        }
    };
    
    const defaultColors = d3.schemeTableau10;
    const getColor = (groupValue, index) => {
        if (colors.field && colors.field[groupValue]) {
            return colors.field[groupValue];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[index % colors.available_colors.length];
        }
        return defaultColors[index % defaultColors.length];
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 50, bottom: 80, left: 50 }; // Increased bottom for legend
    
    const legendItemHeight = 20;
    const legendSymbolSize = 10;
    const legendMaxHeightEstimate = 60; // Estimate for legend, adjust if dynamic calculation is too complex here
    chartMargins.bottom = Math.max(chartMargins.bottom, legendMaxHeightEstimate);


    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(chartWidth, chartHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2 - chartMargins.bottom / 2 + chartMargins.top / 2})`); // Center considering legend space

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartData.map(d => d[categoryFieldName]))];
    
    const groupAvgs = [...new Set(chartData.map(d => d[groupFieldName]))]
        .map(group => ({
            group,
            avg: d3.mean(chartData.filter(d => d[groupFieldName] === group), d => d[valueFieldName])
        }))
        .sort((a, b) => b.avg - a.avg); // Sort descending by average value

    const sortedGroups = groupAvgs.map(d => d.group);

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]); // Ensure segments don't overlap at 0/2PI

    const allValues = chartData.map(d => d[valueFieldName]);
    // Per prompt, y-range is [0, "inf"], so values are non-negative.
    const minValue = 0; 
    const maxValue = d3.max(allValues) || 0; // Handle empty or all-zero data

    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const gridTicks = radiusScale.ticks(5);

    mainChartGroup.selectAll(".gridline-circle")
        .data(gridTicks)
        .enter()
        .append("circle")
        .attr("class", "gridline gridline-circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d => radiusScale(d))
        .attr("fill", "none")
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    mainChartGroup.selectAll(".axis-radial-line")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis axis-radial-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radiusScale(maxValue) * Math.cos(angleScale(d) - Math.PI / 2)) // Extend to max radius
        .attr("y2", d => radiusScale(maxValue) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    mainChartGroup.selectAll(".label-category")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label label-category")
        .attr("x", d => (radius + 15) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radius + 15) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d);
            if (angle > Math.PI * 0.05 && angle < Math.PI * 0.95) return "middle"; // Top half, but not extreme edges
            if (angle > Math.PI * 1.05 && angle < Math.PI * 1.95) return "middle"; // Bottom half, but not extreme edges
            return (angle >= Math.PI * 0.95 && angle <= Math.PI * 1.05) ? "end" : "start"; // Left/Right edges
        })
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.axisLabelColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d);

    mainChartGroup.selectAll(".value-tick-label")
        .data(gridTicks.filter(d => d > minValue)) // Don't label origin if it's a tick
        .enter()
        .append("text")
        .attr("class", "value value-tick-label")
        .attr("x", 5) // Offset slightly from the Y-axis line (0-degree radial)
        .attr("y", d => -radiusScale(d) + 5) // Position above the circle, adjust for baseline
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "alphabetic")
        .attr("fill", fillStyle.axisLabelColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", parseFloat(fillStyle.typography.labelFontSize) * 0.9 + 'px') // Slightly smaller
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d);

    // Simplified Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend");

    const legendItems = sortedGroups.map((group, i) => ({
        name: group,
        color: getColor(group, i)
    }));

    let currentX = 0;
    let currentY = 0;
    const legendPadding = 5;
    const legendItemSpacing = 10;
    const legendRowSpacing = 5;
    const legendMaxWidth = chartWidth * 0.9; // Max width for legend area

    legendItems.forEach(item => {
        const itemTextWidth = estimateTextWidth(item.name, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        const itemWidth = legendSymbolSize + legendPadding + itemTextWidth;

        if (currentX + itemWidth > legendMaxWidth && currentX > 0) { // Wrap to new line
            currentX = 0;
            currentY += legendItemHeight + legendRowSpacing;
        }

        const legendElement = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, ${currentY})`);

        legendElement.append("circle")
            .attr("class", "mark legend-symbol")
            .attr("cx", legendSymbolSize / 2)
            .attr("cy", legendItemHeight / 2 - legendSymbolSize / 4) // Adjusted for better vertical alignment with text
            .attr("r", legendSymbolSize / 2)
            .attr("fill", item.color);

        legendElement.append("text")
            .attr("class", "label legend-text")
            .attr("x", legendSymbolSize + legendPadding)
            .attr("y", legendItemHeight / 2)
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(item.name);
        
        currentX += itemWidth + legendItemSpacing;
    });
    
    const legendBBox = legendGroup.node().getBBox();
    const legendWidth = legendBBox.width;
    const legendHeight = legendBBox.height;

    legendGroup.attr("transform", `translate(${(containerWidth - legendWidth) / 2}, ${containerHeight - legendHeight - chartMargins.bottom / 4})`);


    // Block 8: Main Data Visualization Rendering
    const areaRadialGenerator = d3.areaRadial()
        .angle(d => angleScale(d[categoryFieldName]))
        .innerRadius(0) // All areas start from the center
        .outerRadius(d => radiusScale(d[valueFieldName]))
        .curve(d3.curveCatmullRomClosed.alpha(0.5)); // Smooth curve through points

    // Draw groups from smallest average to largest average for correct layering with opacity
    [...sortedGroups].reverse().forEach((group, groupIndex) => {
        const groupData = chartData.filter(d => d[groupFieldName] === group);
        
        // Ensure data is sorted by category order for area generator
        const areaPoints = categories
            .map(cat => groupData.find(d => d[categoryFieldName] === cat))
            .filter(d => d !== undefined && typeof d[valueFieldName] === 'number' && isFinite(d[valueFieldName]));

        if (areaPoints.length >= 2) { // Need at least 2 points for an area, 3 for CatmullRom to close nicely
            mainChartGroup.append("path")
                .datum(areaPoints)
                .attr("class", "mark area-mark")
                .attr("d", areaRadialGenerator)
                .attr("fill", getColor(group, sortedGroups.indexOf(group)))
                .attr("fill-opacity", 0.35)
                .attr("stroke", getColor(group, sortedGroups.indexOf(group)))
                .attr("stroke-width", 1.5)
                .attr("stroke-opacity", 0.7);
        }

        // Draw data points on top of areas
        areaPoints.forEach(point => {
            const angle = angleScale(point[categoryFieldName]) - Math.PI / 2; // Align with radial lines
            const distance = radiusScale(point[valueFieldName]);
            
            mainChartGroup.append("circle")
                .attr("class", "mark point-mark")
                .attr("cx", distance * Math.cos(angle))
                .attr("cy", distance * Math.sin(angle))
                .attr("r", 3)
                .attr("fill", getColor(group, sortedGroups.indexOf(group)))
                .attr("stroke", fillStyle.dataPointStrokeColor)
                .attr("stroke-width", 1);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Tooltips - none in this version)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}