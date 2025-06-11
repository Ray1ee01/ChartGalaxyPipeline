/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Range Area Chart",
  "chart_name": "radial_range_area_plain_chart_01",
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
  "gridLineType": "none",
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
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming light/dark theme might be passed
    const images = data.images || {}; // Extracted, though not used in this specific chart
    const dataColumns = data.data?.columns || [];

    const categoryFieldName = dataColumns.find(col => col.role === 'x')?.name;
    const valueFieldName = dataColumns.find(col => col.role === 'y')?.name;
    const groupFieldName = dataColumns.find(col => col.role === 'group')?.name;

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        const missingFields = [
            !categoryFieldName ? "x role field" : null,
            !valueFieldName ? "y role field" : null,
            !groupFieldName ? "group role field" : null
        ].filter(Boolean).join(", ");

        console.error(`Critical chart config missing: [${missingFields}]. Cannot render.`);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>Error: Critical chart configuration missing (${missingFields}). Cannot render chart.</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html("");

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
        textColor: colors.text_color || '#333333',
        backgroundColor: colors.background_color || 'transparent', // SVG background
        axisStrokeColor: colors.other?.axis_stroke || colors.text_color || '#CCCCCC',
        primaryAccent: (colors.other && colors.other.primary) ? colors.other.primary : (colors.available_colors && colors.available_colors.length > 0 ? colors.available_colors[0] : '#4f80ff'),
        getGroupColor: (groupName, index, totalGroups) => {
            if (colors.field && colors.field[groupFieldName] && colors.field[groupFieldName][groupName]) {
                return colors.field[groupFieldName][groupName];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return d3.schemeCategory10[index % 10];
        }
    };
    
    // Helper for text measurement (in-memory)
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM.
        // For simple cases, this might suffice. If not, a temporary append/remove is needed.
        // However, the spec says "MUST NOT be appended to the document DOM".
        // Using getComputedTextLength on a detached element is often 0.
        // A common workaround is to append to a non-rendered part of the main SVG if available early,
        // or accept that this in-memory version might be less accurate for complex fonts/kerning.
        // For this refactoring, we'll use a simplified approach that might need refinement for perfect accuracy.
        // A more robust way without DOM append:
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        return context.measureText(text).width;
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
    const chartMargins = { top: 50, right: 50, bottom: 80, left: 50 }; // Increased bottom for legend
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(chartWidth, chartHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartData.map(d => d[categoryFieldName]))];
    const groupNames = [...new Set(chartData.map(d => d[groupFieldName]))];

    const groupAverages = groupNames.map(group => {
        const groupData = chartData.filter(d => d[groupFieldName] === group);
        const avg = d3.mean(groupData, d => d[valueFieldName]);
        return { group, avg };
    });

    groupAverages.sort((a, b) => b.avg - a.avg);

    if (groupAverages.length < 2) {
        console.error("Need at least two groups to form a range. Cannot render chart.");
         d3.select(containerSelector).html("<div style='color:red;'>Error: Need at least two groups to form a range.</div>");
        return null;
    }
    
    const upperGroup = groupAverages[0].group;
    const lowerGroup = groupAverages[groupAverages.length - 1].group;

    const upperGroupData = chartData.filter(d => d[groupFieldName] === upperGroup);
    const lowerGroupData = chartData.filter(d => d[groupFieldName] === lowerGroup);

    const areaData = categories.map(category => {
        const upperPoint = upperGroupData.find(d => d[categoryFieldName] === category);
        const lowerPoint = lowerGroupData.find(d => d[categoryFieldName] === category);
        return {
            category: category,
            upperValue: upperPoint ? upperPoint[valueFieldName] : 0,
            lowerValue: lowerPoint ? lowerPoint[valueFieldName] : 0
        };
    });

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]); // Keep small gap

    const allValues = chartData.map(d => d[valueFieldName]);
    const minValue = Math.max(0, d3.min(allValues) || 0); // Ensure minValue is at least 0
    const maxValue = d3.max(allValues) || 0;
    const valuePadding = (maxValue - minValue) * 0.1;

    const radiusScale = d3.scaleLinear()
        .domain([minValue === 0 ? 0 : minValue - valuePadding, maxValue + valuePadding])
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Radial Axis Lines (spokes)
    mainChartGroup.selectAll(".radial-axis-line")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis radial-axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radiusScale(radiusScale.domain()[1]) * Math.cos(angleScale(d) - Math.PI / 2)) // Extend to max radius
        .attr("y2", d => radiusScale(radiusScale.domain()[1]) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.axisStrokeColor)
        .attr("stroke-width", 1);

    // Category Labels
    mainChartGroup.selectAll(".category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label category-label")
        .attr("x", d => (radiusScale(radiusScale.domain()[1]) + 15) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radiusScale(radiusScale.domain()[1]) + 15) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d); // Raw angle from scalePoint
            // Determine text anchor based on the plotted angle (angle - PI/2)
            const plottedAngle = (angle - Math.PI / 2 + 4 * Math.PI) % (2 * Math.PI); // Ensure positive angle
            if (plottedAngle > Math.PI * 0.05 && plottedAngle < Math.PI * 0.95) return "start"; // Right side
            if (plottedAngle > Math.PI * 1.05 && plottedAngle < Math.PI * 1.95) return "end";   // Left side
            return "middle"; // Top, bottom, or very close to vertical axis
        })
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .attr("font-family", fillStyle.typography.labelFontFamily)
        .attr("font-size", fillStyle.typography.labelFontSize)
        .attr("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d);

    // Radial Scale Ticks and Labels (along one axis, typically vertical pointing up)
    const ticks = radiusScale.ticks(5).filter(d => d > 0 && d <= radiusScale.domain()[1]);
    
    const yAxisTicksGroup = mainChartGroup.append("g").attr("class", "axis y-axis-ticks");

    yAxisTicksGroup.selectAll(".tick-line")
        .data(ticks)
        .enter()
        .append("line")
        .attr("class", "axis tick-line")
        .attr("x1", -5)
        .attr("y1", d => -radiusScale(d))
        .attr("x2", 5)
        .attr("y2", d => -radiusScale(d))
        .attr("stroke", fillStyle.axisStrokeColor)
        .attr("stroke-width", 1);

    yAxisTicksGroup.selectAll(".tick-label")
        .data(ticks)
        .enter()
        .append("text")
        .attr("class", "value tick-label")
        .attr("x", 10) // Position to the right of the upward pointing axis
        .attr("y", d => -radiusScale(d))
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .attr("font-family", fillStyle.typography.annotationFontFamily)
        .attr("font-size", fillStyle.typography.annotationFontSize)
        .attr("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => d3.format(",.0f")(d));

    // Legend
    const legendData = [
        { label: upperGroup, color: fillStyle.getGroupColor(upperGroup, groupNames.indexOf(upperGroup), groupNames.length) },
        { label: lowerGroup, color: fillStyle.getGroupColor(lowerGroup, groupNames.indexOf(lowerGroup), groupNames.length) }
    ];
    
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend");

    const legendItemSpacing = 20;
    const iconTextSpacing = 5;
    const iconSize = 10; // Diameter of circle

    let currentX = 0; // Will be calculated after measuring items
    const legendItemsWithWidth = legendData.map(item => {
        const textWidth = estimateTextWidth(item.label, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        const itemWidth = iconSize + iconTextSpacing + textWidth;
        return { ...item, itemWidth };
    });

    const totalLegendWidth = legendItemsWithWidth.reduce((sum, item) => sum + item.itemWidth, 0) + (legendItemsWithWidth.length - 1) * legendItemSpacing;
    const legendStartX = (containerWidth - totalLegendWidth) / 2;
    const legendY = containerHeight - chartMargins.bottom / 2; // Center in bottom margin

    currentX = legendStartX;
    legendItemsWithWidth.forEach((item) => {
        const legendItemG = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, ${legendY})`);

        legendItemG.append("circle")
            .attr("class", "mark legend-marker")
            .attr("cx", iconSize / 2)
            .attr("cy", 0) // Align with text baseline
            .attr("r", iconSize / 2)
            .attr("fill", item.color);

        legendItemG.append("text")
            .attr("class", "label legend-label")
            .attr("x", iconSize + iconTextSpacing)
            .attr("y", 0)
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .text(item.label);
        
        currentX += item.itemWidth + legendItemSpacing;
    });


    // Block 8: Main Data Visualization Rendering
    // Radial Area
    const areaRadialGenerator = d3.areaRadial()
        .angle(d => angleScale(d.category))
        .innerRadius(d => radiusScale(d.lowerValue))
        .outerRadius(d => radiusScale(d.upperValue))
        .curve(d3.curveLinearClosed);

    mainChartGroup.append("path")
        .datum(areaData)
        .attr("class", "mark area-range")
        .attr("d", areaRadialGenerator)
        .attr("fill", fillStyle.primaryAccent)
        .attr("fill-opacity", 0.4)
        .attr("stroke", fillStyle.primaryAccent)
        .attr("stroke-width", 1) // Thinner stroke for the area itself
        .attr("stroke-opacity", 0.8);

    // Upper Boundary Line
    const upperLineGenerator = d3.lineRadial()
        .angle(d => angleScale(d.category))
        .radius(d => radiusScale(d.upperValue))
        .curve(d3.curveLinearClosed);

    mainChartGroup.append("path")
        .datum(areaData)
        .attr("class", "mark line upper-bound-line")
        .attr("d", upperLineGenerator)
        .attr("fill", "none")
        .attr("stroke", fillStyle.getGroupColor(upperGroup, groupNames.indexOf(upperGroup), groupNames.length))
        .attr("stroke-width", 2.5);

    // Lower Boundary Line
    const lowerLineGenerator = d3.lineRadial()
        .angle(d => angleScale(d.category))
        .radius(d => radiusScale(d.lowerValue))
        .curve(d3.curveLinearClosed);

    mainChartGroup.append("path")
        .datum(areaData)
        .attr("class", "mark line lower-bound-line")
        .attr("d", lowerLineGenerator)
        .attr("fill", "none")
        .attr("stroke", fillStyle.getGroupColor(lowerGroup, groupNames.indexOf(lowerGroup), groupNames.length))
        .attr("stroke-width", 2.5);

    // Data Points (Circles on lines)
    areaData.forEach(d => {
        const plottedAngle = angleScale(d.category) - Math.PI / 2; // Angle for plotting (0 is top)
        
        // Upper boundary point
        const upperRadiusVal = radiusScale(d.upperValue);
        mainChartGroup.append("circle")
            .attr("class", "mark point upper-point")
            .attr("cx", upperRadiusVal * Math.cos(plottedAngle))
            .attr("cy", upperRadiusVal * Math.sin(plottedAngle))
            .attr("r", 4)
            .attr("fill", fillStyle.getGroupColor(upperGroup, groupNames.indexOf(upperGroup), groupNames.length))
            .attr("stroke", fillStyle.backgroundColor === 'transparent' ? '#FFFFFF' : fillStyle.backgroundColor) // Contrast stroke
            .attr("stroke-width", 1.5);
        
        // Lower boundary point
        const lowerRadiusVal = radiusScale(d.lowerValue);
        mainChartGroup.append("circle")
            .attr("class", "mark point lower-point")
            .attr("cx", lowerRadiusVal * Math.cos(plottedAngle))
            .attr("cy", lowerRadiusVal * Math.sin(plottedAngle))
            .attr("r", 4)
            .attr("fill", fillStyle.getGroupColor(lowerGroup, groupNames.indexOf(lowerGroup), groupNames.length))
            .attr("stroke", fillStyle.backgroundColor === 'transparent' ? '#FFFFFF' : fillStyle.backgroundColor)
            .attr("stroke-width", 1.5);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}