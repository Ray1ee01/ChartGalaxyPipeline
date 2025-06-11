/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Range Area Chart",
  "chart_name": "radial_range_area_chart_grid_01",
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
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is external to this function)

    // Block 1: Configuration Parsing & Validation
    const rawVariables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // Assuming light theme, or use logic for dark theme if needed
    const rawImages = data.images || {}; // Not used in this chart, but for completeness
    const rawDataColumns = data.data && data.data.columns ? data.data.columns : [];
    const chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = (rawDataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (rawDataColumns.find(col => col.role === "y") || {}).name;
    const groupFieldName = (rawDataColumns.find(col => col.role === "group") || {}).name;

    const missingFields = [];
    if (!categoryFieldName) missingFields.push("x role field");
    if (!valueFieldName) missingFields.push("y role field");
    if (!groupFieldName) missingFields.push("group role field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    if (chartDataArray.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: {} // For consistency, though not used here
    };

    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = rawTypography.title?.font_family || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = rawTypography.title?.font_size || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = rawTypography.title?.font_weight || defaultTypography.title.font_weight;

    fillStyle.typography.labelFontFamily = rawTypography.label?.font_family || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = rawTypography.label?.font_size || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = rawTypography.label?.font_weight || defaultTypography.label.font_weight;
    
    // Annotation typography (not used in this chart, but for completeness)
    fillStyle.typography.annotationFontFamily = rawTypography.annotation?.font_family || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = rawTypography.annotation?.font_size || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = rawTypography.annotation?.font_weight || defaultTypography.annotation.font_weight;

    const defaultColors = {
        field: {},
        other: { primary: "#4f80ff", secondary: "#ff7f0e" }, // Default primary for area fill
        available_colors: [...d3.schemeCategory10],
        background_color: "#FFFFFF",
        text_color: "#333333"
    };
    
    fillStyle.textColor = rawColors.text_color || defaultColors.text_color;
    fillStyle.chartBackground = rawColors.background_color || defaultColors.background_color; // Not explicitly drawn, SVG is transparent
    fillStyle.gridLineColor = rawColors.text_color ? d3.color(rawColors.text_color).copy({opacity: 0.3}).toString() : "#cccccc";
    
    fillStyle.areaBaseColor = rawColors.other?.primary || 
                              (rawColors.available_colors && rawColors.available_colors.length > 0 ? rawColors.available_colors[0] : defaultColors.other.primary);
    fillStyle.areaBaseStrokeColor = fillStyle.areaBaseColor; // Or a darker version
    fillStyle.pointStrokeColor = "#FFFFFF"; // White stroke around data points

    fillStyle.defaultCategoricalColorPalette = rawColors.available_colors && rawColors.available_colors.length > 0 ? rawColors.available_colors : defaultColors.available_colors;

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontProps.font_family);
        tempTextElement.setAttribute('font-size', fontProps.font_size);
        tempTextElement.setAttribute('font-weight', fontProps.font_weight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // No need to append to DOM for getBBox
        const width = tempTextElement.getBBox().width;
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = rawVariables.width || 800;
    const containerHeight = rawVariables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .style("background-color", fillStyle.chartBackground) // Apply background to SVG itself
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const chartMargins = { top: 50, right: 50, bottom: 80, left: 50 }; // Increased bottom for legend

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(chartWidth, chartHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2 - chartMargins.bottom/2 + chartMargins.top/2})`); // Center considering margins

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    const groupNames = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    const groupAverages = groupNames.map(group => {
        const groupData = chartDataArray.filter(d => d[groupFieldName] === group);
        const avg = d3.mean(groupData, d => d[valueFieldName]);
        return { group, avg };
    });

    groupAverages.sort((a, b) => b.avg - a.avg); // Sort descending by average

    if (groupAverages.length < 2) {
         const errorMsg = "Radial Range Area Chart requires at least two groups to compare.";
         console.error(errorMsg);
         d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
         return null;
    }

    const upperGroup = groupAverages[0].group;
    const lowerGroup = groupAverages[groupAverages.length - 1].group;

    const upperGroupData = chartDataArray.filter(d => d[groupFieldName] === upperGroup);
    const lowerGroupData = chartDataArray.filter(d => d[groupFieldName] === lowerGroup);

    // Block 6: Scale Definition & Configuration
    const colorScale = (groupName) => {
        if (rawColors.field && rawColors.field[groupName]) {
            return rawColors.field[groupName];
        }
        const groupIndex = groupNames.indexOf(groupName);
        return fillStyle.defaultCategoricalColorPalette[groupIndex % fillStyle.defaultCategoricalColorPalette.length];
    };

    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]); // Ensure last point doesn't overlap first

    const allValues = chartDataArray.map(d => d[valueFieldName]);
    const minValue = Math.max(0, d3.min(allValues) || 0); // Ensure minValue is at least 0
    const maxValue = d3.max(allValues) || 0;
    const valuePadding = (maxValue - minValue) * 0.1; // 10% padding

    const radiusScale = d3.scaleLinear()
        .domain([Math.max(0, minValue - valuePadding), maxValue + valuePadding]) // Ensure domain starts >= 0
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const radialTicks = radiusScale.ticks(5);

    // Concentric Circle Gridlines
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

    // Radial Axis Lines
    mainChartGroup.selectAll(".axis-line-radial")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis axis-line-radial")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radiusScale(radiusScale.domain()[1]) * Math.cos(angleScale(d) - Math.PI / 2)) // Extend to max radius
        .attr("y2", d => radiusScale(radiusScale.domain()[1]) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    // Category Labels (Angular Axis)
    mainChartGroup.selectAll(".category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label category-label")
        .attr("x", d => (radiusScale(radiusScale.domain()[1]) + 15) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radiusScale(radiusScale.domain()[1]) + 15) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d);
            const epsilon = 0.01;
            if (Math.abs(angle) < epsilon || Math.abs(angle - 2 * Math.PI) < epsilon) return "middle"; // Top
            if (Math.abs(angle - Math.PI / 2) < epsilon) return "start";  // Right
            if (Math.abs(angle - Math.PI) < epsilon) return "middle"; // Bottom
            if (Math.abs(angle - 3 * Math.PI / 2) < epsilon) return "end";    // Left
            return (angle > Math.PI / 2 && angle < 3 * Math.PI / 2) ? "end" : "start";
        })
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .attr("font-family", fillStyle.typography.titleFontFamily)
        .attr("font-size", fillStyle.typography.titleFontSize)
        .attr("font-weight", fillStyle.typography.titleFontWeight)
        .text(d => d);

    // Tick Value Labels (Radial Axis)
    mainChartGroup.selectAll(".tick-label-radial")
        .data(radialTicks.filter(d => d > radiusScale.domain()[0] + 0.001)) // Avoid label at 0 if domain starts at 0
        .enter()
        .append("text")
        .attr("class", "value tick-label tick-label-radial")
        .attr("x", 5) // Offset slightly from the y-axis line (which is vertical here)
        .attr("y", d => -radiusScale(d) + 5) // Position above the line
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "auto")
        .attr("fill", fillStyle.textColor)
        .attr("font-family", fillStyle.typography.labelFontFamily)
        .attr("font-size", fillStyle.typography.labelFontSize)
        .attr("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d3.format(",.0f")(d));
    
    // Legend
    const legendData = [
        { label: String(upperGroup), color: colorScale(upperGroup) },
        { label: String(lowerGroup), color: colorScale(lowerGroup) }
    ];
    
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend");

    const legendItemHeight = 20;
    const legendIconSize = 12;
    const legendIconTextSpacing = 5;
    let currentLegendX = chartMargins.left;
    const legendY = containerHeight - chartMargins.bottom / 2;

    const legendItems = legendGroup.selectAll(".legend-item")
        .data(legendData)
        .enter()
        .append("g")
        .attr("class", "legend-item other") // 'other' as it's a chart component, not direct data
        .attr("transform", (d, i) => `translate(0, ${legendY + i * legendItemHeight})`); // Temporary Y for width calculation

    legendItems.append("circle")
        .attr("class", "mark legend-item-symbol")
        .attr("cx", legendIconSize / 2)
        .attr("cy", -legendIconSize / 2 + 1) // Adjust to align with text baseline
        .attr("r", legendIconSize / 2)
        .attr("fill", d => d.color);

    legendItems.append("text")
        .attr("class", "label legend-item-label")
        .attr("x", legendIconSize + legendIconTextSpacing)
        .attr("y", 0) // dominant-baseline will handle vertical alignment
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .attr("font-family", fillStyle.typography.labelFontFamily)
        .attr("font-size", fillStyle.typography.labelFontSize)
        .attr("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d.label);

    // Reposition legend items horizontally based on their actual widths
    let totalLegendWidth = 0;
    const legendPadding = 15;
    legendItems.each(function() {
        const itemWidth = this.getBBox().width;
        d3.select(this).attr("transform", `translate(${currentLegendX}, ${legendY})`);
        currentLegendX += itemWidth + legendPadding;
        totalLegendWidth += itemWidth + (totalLegendWidth > 0 ? legendPadding : 0);
    });
    
    // Center the legend block
    const legendBlockStartX = (containerWidth - totalLegendWidth) / 2;
    currentLegendX = legendBlockStartX;
     legendItems.each(function() {
        const itemWidth = this.getBBox().width;
        d3.select(this).attr("transform", `translate(${currentLegendX}, ${legendY})`);
        currentLegendX += itemWidth + legendPadding;
    });


    // Block 8: Main Data Visualization Rendering
    const areaChartData = categories.map(category => {
        const upperPoint = upperGroupData.find(d => d[categoryFieldName] === category);
        const lowerPoint = lowerGroupData.find(d => d[categoryFieldName] === category);
        return {
            category: category,
            upperValue: upperPoint ? upperPoint[valueFieldName] : radiusScale.domain()[0], // Default to min domain value
            lowerValue: lowerPoint ? lowerPoint[valueFieldName] : radiusScale.domain()[0]  // Default to min domain value
        };
    });

    const areaRadialGenerator = d3.areaRadial()
        .angle(d => angleScale(d.category))
        .innerRadius(d => radiusScale(d.lowerValue))
        .outerRadius(d => radiusScale(d.upperValue))
        .curve(d3.curveLinearClosed);

    mainChartGroup.append("path")
        .datum(areaChartData)
        .attr("class", "mark area-range")
        .attr("d", areaRadialGenerator)
        .attr("fill", fillStyle.areaBaseColor)
        .attr("fill-opacity", 0.4)
        .attr("stroke", fillStyle.areaBaseStrokeColor)
        .attr("stroke-width", 1) // Thinner stroke for area itself
        .attr("stroke-opacity", 0.8);

    const upperLineGenerator = d3.lineRadial()
        .angle(d => angleScale(d.category))
        .radius(d => radiusScale(d.upperValue))
        .curve(d3.curveLinearClosed);

    mainChartGroup.append("path")
        .datum(areaChartData)
        .attr("class", "mark line upper-boundary-line")
        .attr("d", upperLineGenerator)
        .attr("fill", "none")
        .attr("stroke", colorScale(upperGroup))
        .attr("stroke-width", 2);

    const lowerLineGenerator = d3.lineRadial()
        .angle(d => angleScale(d.category))
        .radius(d => radiusScale(d.lowerValue))
        .curve(d3.curveLinearClosed);

    mainChartGroup.append("path")
        .datum(areaChartData)
        .attr("class", "mark line lower-boundary-line")
        .attr("d", lowerLineGenerator)
        .attr("fill", "none")
        .attr("stroke", colorScale(lowerGroup))
        .attr("stroke-width", 2);

    // Block 9: Optional Enhancements & Post-Processing (Data Points)
    areaChartData.forEach(d => {
        const currentAngle = angleScale(d.category) - Math.PI / 2; // Adjusted for visual rotation

        // Upper boundary point
        const upperValueRadius = radiusScale(d.upperValue);
        mainChartGroup.append("circle")
            .attr("class", "mark data-point upper-point")
            .attr("cx", upperValueRadius * Math.cos(currentAngle))
            .attr("cy", upperValueRadius * Math.sin(currentAngle))
            .attr("r", 4)
            .attr("fill", colorScale(upperGroup))
            .attr("stroke", fillStyle.pointStrokeColor)
            .attr("stroke-width", 1.5);

        // Lower boundary point
        const lowerValueRadius = radiusScale(d.lowerValue);
        mainChartGroup.append("circle")
            .attr("class", "mark data-point lower-point")
            .attr("cx", lowerValueRadius * Math.cos(currentAngle))
            .attr("cy", lowerValueRadius * Math.sin(currentAngle))
            .attr("r", 4)
            .attr("fill", colorScale(lowerGroup))
            .attr("stroke", fillStyle.pointStrokeColor)
            .attr("stroke-width", 1.5);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}