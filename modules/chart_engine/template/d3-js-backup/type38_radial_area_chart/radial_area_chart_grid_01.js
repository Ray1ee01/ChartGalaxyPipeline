/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Area Chart",
  "chart_name": "radial_area_chart_grid_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Could also check data.colors_dark
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    if (!categoryColumn || !valueColumn) {
        const missing = [];
        if (!categoryColumn) missing.push("x role column");
        if (!valueColumn) missing.push("y role column");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const estimateTextWidth = (text, fontProps) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document body append/remove is not strictly necessary for getBBox if SVG has dimensions,
        // but can be more robust in some environments. For truly in-memory, it's avoided.
        // document.body.appendChild(tempSvg); 
        const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg);
        return width;
    };
    
    const fillStyle = {
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#0f223b',
        primaryColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4',
        gridLineColor: '#CCCCCC', // Original was #bbb
        axisLineColor: '#CCCCCC', // Original was #bbb
        dataPointStrokeColor: '#FFFFFF',
        valueLabelTextContrastColor: '#FFFFFF', // For text on primaryColor background
    };

    fillStyle.typography = {
        titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
        titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
        titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
        
        labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
        labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '16px', // Original used 16px for category labels
        labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold', // Original used bold for category labels

        annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
        annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '14px', // Original used 14px for value/tick labels
        annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
    };
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground); // Apply background to SVG root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 50, bottom: 50, left: 50 }; // Original margins
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 5: Data Preprocessing & Transformation
    const uniqueCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    const allValues = chartDataArray.map(d => parseFloat(d[valueFieldName])).filter(v => !isNaN(v));

    if (uniqueCategories.length < 3) {
        const errorMsg = "Radial charts require at least 3 categories.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }
    if (allValues.length === 0 && chartDataArray.length > 0) {
        const errorMsg = `Value field '${valueFieldName}' contains no valid numbers. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }


    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(uniqueCategories)
        .range([0, 2 * Math.PI - (2 * Math.PI / uniqueCategories.length)]); // Ensures distinct start/end points

    const minValue = d3.min(allValues);
    const maxValue = d3.max(allValues);
    const radiusScale = d3.scaleLinear()
        .domain([Math.min(0, minValue || 0), (maxValue || 0) * 1.2]) // Ensure domain starts at 0 or less if data is negative
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const ticks = radiusScale.ticks(5);

    // Concentric Circle Gridlines
    mainChartGroup.selectAll(".grid-circle")
        .data(ticks)
        .enter()
        .append("circle")
        .attr("class", "grid grid-circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d => radiusScale(d))
        .attr("fill", "none")
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");

    // Radial Axis Lines
    mainChartGroup.selectAll(".axis-radial")
        .data(uniqueCategories)
        .enter()
        .append("line")
        .attr("class", "axis axis-radial")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radius * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y2", d => radius * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Category Labels (around the circle)
    mainChartGroup.selectAll(".label-category")
        .data(uniqueCategories)
        .enter()
        .append("text")
        .attr("class", "label label-category")
        .attr("x", d => (radius + 20) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radius + 20) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d); // Angle relative to positive x-axis, 0 at right
            const adjustedAngle = (angle - Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI); // Angle relative to positive y-axis (top), 0 at top
            if (Math.abs(adjustedAngle - Math.PI / 2) < 0.01 || Math.abs(adjustedAngle - 3 * Math.PI / 2) < 0.01) return "middle"; // Right or Left
            return adjustedAngle > Math.PI / 2 && adjustedAngle < 3 * Math.PI / 2 ? "end" : "start"; // Left half vs Right half
        })
        .attr("dominant-baseline", d => {
            const angle = angleScale(d);
            const adjustedAngle = (angle - Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
            if (Math.abs(adjustedAngle) < 0.01 || Math.abs(adjustedAngle - Math.PI) < 0.01) return "middle"; // Top or Bottom
            return adjustedAngle > 0 && adjustedAngle < Math.PI ? "hanging" : "auto"; // Bottom half vs Top half
        })
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d);
        
    // Tick Value Labels (along one axis, typically the first one)
    mainChartGroup.selectAll(".label-tick-value")
        .data(ticks.filter(d => d !== 0)) // Don't label origin if 0 is a tick
        .enter()
        .append("text")
        .attr("class", "label label-tick-value")
        .attr("x", 5) // Offset from the axis line
        .attr("y", d => -radiusScale(d))
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => d);

    // Block 8: Main Data Visualization Rendering
    const radarLine = d3.lineRadial()
        .angle(d => angleScale(d[categoryFieldName]))
        .radius(d => radiusScale(d[valueFieldName]))
        .curve(d3.curveLinearClosed); // Use curveLinearClosed for area

    // Map data to ensure correct order for path
    const orderedDataForPath = uniqueCategories.map(cat => {
        const pointData = chartDataArray.find(item => item[categoryFieldName] === cat);
        return pointData || { [categoryFieldName]: cat, [valueFieldName]: 0 }; // Default to 0 if missing
    });
    
    // Radar Area Path
    mainChartGroup.append("path")
        .datum(orderedDataForPath)
        .attr("class", "mark mark-area")
        .attr("d", radarLine)
        .attr("fill", fillStyle.primaryColor)
        .attr("fill-opacity", 0.3) // Original was 0.2, 0.3 is common
        .attr("stroke", fillStyle.primaryColor)
        .attr("stroke-width", 6); // Preserving original thick stroke

    // Data Points (Circles on vertices) & Value Labels
    orderedDataForPath.forEach((d, index) => {
        const value = parseFloat(d[valueFieldName]);
        if (isNaN(value)) return; // Skip if value is not a number

        const angle = angleScale(d[categoryFieldName]) - Math.PI / 2; // Adjust for top-origin
        const distance = radiusScale(value);
        const x = distance * Math.cos(angle);
        const y = distance * Math.sin(angle);

        // Data Point Circle
        mainChartGroup.append("circle")
            .attr("class", "mark mark-datapoint")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 6) // Original size
            .attr("fill", fillStyle.primaryColor)
            .attr("stroke", fillStyle.dataPointStrokeColor)
            .attr("stroke-width", 3); // Original stroke

        // Data Value Label
        const labelText = value.toString();
        const textFontProps = {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        };
        const textWidth = estimateTextWidth(labelText, textFontProps);
        
        // Positioning for value labels - preserved original logic for first point due to potential overlap
        let labelXOffset = 30;
        let labelYOffset = 30;
        let additionalXShift = 0;

        // This specific adjustment for index === 0 was in the original.
        // It's kept to preserve visual output but is a highly specific tweak.
        if (index === 0) {
            labelXOffset = 30; // Original (distance + 30)
            labelYOffset = 15; // Original (distance + 15)
            additionalXShift = -20; // Original -20
        }
        
        const textX = (distance + labelXOffset) * Math.cos(angle) + additionalXShift;
        const textY = (distance + labelYOffset) * Math.sin(angle);

        // Background for Label
        mainChartGroup.append("rect")
            .attr("class", "background background-value-label")
            .attr("x", textX - textWidth / 2 - 4)
            .attr("y", textY - (parseFloat(fillStyle.typography.annotationFontSize) / 2) - 4)
            .attr("width", textWidth + 8)
            .attr("height", parseFloat(fillStyle.typography.annotationFontSize) + 8)
            .attr("fill", fillStyle.primaryColor);
            // Removed rx for rounded corners to simplify

        // Label Text
        mainChartGroup.append("text")
            .attr("class", "label label-value")
            .attr("x", textX)
            .attr("y", textY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", textFontProps.fontFamily)
            .style("font-size", textFontProps.fontSize)
            .style("font-weight", textFontProps.fontWeight)
            .attr("fill", fillStyle.valueLabelTextContrastColor)
            .text(labelText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (Data value labels with backgrounds are handled in Block 8 as they are integral to data point representation here)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}