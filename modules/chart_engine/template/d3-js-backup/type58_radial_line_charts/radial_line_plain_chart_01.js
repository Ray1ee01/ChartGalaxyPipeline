/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Line Chart",
  "chart_name": "radial_line_plain_chart_01",
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
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {}; // Not used in this chart, but parsed for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!categoryFieldDef || !valueFieldDef) {
        console.error("Critical chart config missing: Category (role 'x') or Value (role 'y') field definition not found in data.data.columns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration missing. Category or Value field not defined.</div>");
        return null;
    }
    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    if (chartData.length === 0) {
        console.warn("Chart data is empty. Rendering an empty chart area.");
        // Optionally render a message or just an empty SVG
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#1f77b4',
        gridLineColor: '#CCCCCC',
        axisLabelColor: (colorsConfig.text_color) ? colorsConfig.text_color : '#333333',
        tickLabelColor: (colorsConfig.text_color) ? colorsConfig.text_color : '#666666',
        dataPointStrokeColor: '#FFFFFF',
        dataLineWidth: 3, // Thinner than original for a cleaner look, was 6
        dataAreaOpacity: 0.2,
        dataPointRadius: 5, // Slightly smaller than original, was 6
        dataPointStrokeWidth: 2, // Slightly smaller than original, was 3
        valueLabelColor: '#FFFFFF',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        textColor: colorsConfig.text_color || '#0f223b',
    };
    fillStyle.dataLineStrokeColor = fillStyle.primaryColor;
    fillStyle.dataAreaFillColor = fillStyle.primaryColor;
    fillStyle.dataPointFillColor = fillStyle.primaryColor;
    fillStyle.valueLabelBackgroundColor = fillStyle.primaryColor;


    fillStyle.typography = {
        titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) ? typographyConfig.title.font_family : 'Arial, sans-serif',
        titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) ? typographyConfig.title.font_size : '16px',
        titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) ? typographyConfig.title.font_weight : 'bold',

        labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
        labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px', // Was 16px for category, 14px for tick
        labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal', // Was bold for category

        annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
        annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px', // Was 14px for value labels
        annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
    };

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || 'Arial, sans-serif');
        tempText.setAttribute('font-size', fontProps.fontSize || '12px');
        tempText.setAttribute('font-weight', fontProps.fontWeight || 'normal');
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document append/remove is not strictly necessary for getBBox if styles are applied directly,
        // but some browsers might be more consistent if it's briefly in a document context.
        // However, per spec, it should NOT be appended to the main document DOM.
        // For this implementation, we rely on direct attribute setting and no DOM append.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            // This is a rough estimate
            const avgCharWidth = parseFloat(fontProps.fontSize || '12px') * 0.6;
            return text.length * avgCharWidth;
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root-svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 60, bottom: 60, left: 60 }; // Increased margin for labels
    if (variables.margin_top !== undefined) chartMargins.top = variables.margin_top;
    if (variables.margin_right !== undefined) chartMargins.right = variables.margin_right;
    if (variables.margin_bottom !== undefined) chartMargins.bottom = variables.margin_bottom;
    if (variables.margin_left !== undefined) chartMargins.left = variables.margin_left;
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartData.map(d => d[categoryFieldName]))];
    const allValues = chartData.map(d => d[valueFieldName]).filter(v => typeof v === 'number' && !isNaN(v));
    
    if (categories.length < 3 && chartData.length > 0) {
         console.warn("Radial charts are best with 3 or more categories. Current categories:", categories.length);
    }


    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / (categories.length || 1))]); // Avoid division by zero

    const maxValue = allValues.length > 0 ? d3.max(allValues) : 0;
    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue === 0 ? 1 : maxValue * 1.1]) // Ensure non-zero range, pad max value
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const gridTicks = radiusScale.ticks(5).filter(t => t > 0); // Only positive ticks for grid

    mainChartGroup.selectAll(".grid-circle")
        .data(gridTicks)
        .enter()
        .append("circle")
        .attr("class", "gridline grid-circle")
        .attr("r", d => radiusScale(d))
        .style("fill", "none")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-width", 1)
        .style("stroke-dasharray", "3,3");

    mainChartGroup.selectAll(".radial-axis-line")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis radial-axis-line")
        .attr("y2", -radius)
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-width", 1)
        .attr("transform", d => `rotate(${angleScale(d) * 180 / Math.PI - 90})`);

    const categoryLabelsGroup = mainChartGroup.append("g").attr("class", "category-labels-group");
    categoryLabelsGroup.selectAll(".category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label category-label")
        .attr("x", d => (radius + 15) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radius + 15) * Math.sin(angleScale(d) - Math.PI / 2))
        .text(d => d)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.axisLabelColor)
        .attr("text-anchor", d => {
            const angle = (angleScale(d) * 180 / Math.PI) % 360;
            if (angle > 10 && angle < 170) return "start";
            if (angle > 190 && angle < 350) return "end";
            return "middle";
        })
        .attr("dominant-baseline", d => {
            const angle = (angleScale(d) * 180 / Math.PI) % 360;
            if (angle === 0 || angle === 180) return "middle";
            if (angle > 0 && angle < 180) return "auto"; // text top aligned with point
            return "hanging"; // text bottom aligned with point
        });


    const tickLabelsGroup = mainChartGroup.append("g").attr("class", "tick-labels-group");
    tickLabelsGroup.selectAll(".tick-label")
        .data(gridTicks)
        .enter()
        .append("text")
        .attr("class", "label tick-label")
        .attr("x", 5)
        .attr("y", d => -radiusScale(d) - 2)
        .text(d => d)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.tickLabelColor)
        .attr("text-anchor", "start");

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    if (chartData.length > 0 && categories.length > 0) {
        const radialLineGenerator = d3.lineRadial()
            .angle(d => angleScale(d[categoryFieldName]))
            .radius(d => radiusScale(d[valueFieldName]))
            .curve(d3.curveLinearClosed); // Ensures the path is closed

        // Prepare data for line generator (needs to be in order of categories)
        const lineData = categories.map(cat => {
            const point = chartData.find(item => item[categoryFieldName] === cat);
            return point ? { [categoryFieldName]: cat, [valueFieldName]: point[valueFieldName] } : { [categoryFieldName]: cat, [valueFieldName]: 0 };
        });
        
        // Add the first point to the end to ensure smooth closing if not using curveLinearClosed
        // const closedLineData = [...lineData, lineData[0]];
        // For curveLinearClosed, this is not necessary.

        mainChartGroup.append("path")
            .datum(lineData)
            .attr("class", "mark data-area")
            .attr("d", radialLineGenerator)
            .style("fill", fillStyle.dataAreaFillColor)
            .style("fill-opacity", fillStyle.dataAreaOpacity)
            .style("stroke", fillStyle.dataLineStrokeColor)
            .style("stroke-width", fillStyle.dataLineWidth);

        const dataPointsGroup = mainChartGroup.append("g").attr("class", "data-points-group");
        dataPointsGroup.selectAll(".data-point")
            .data(lineData.filter(d => d[valueFieldName] !== undefined && d[valueFieldName] !== null)) // Only plot actual data points
            .enter()
            .append("circle")
            .attr("class", "mark data-point")
            .attr("cx", d => radiusScale(d[valueFieldName]) * Math.cos(angleScale(d[categoryFieldName]) - Math.PI / 2))
            .attr("cy", d => radiusScale(d[valueFieldName]) * Math.sin(angleScale(d[categoryFieldName]) - Math.PI / 2))
            .attr("r", fillStyle.dataPointRadius)
            .style("fill", fillStyle.dataPointFillColor)
            .style("stroke", fillStyle.dataPointStrokeColor)
            .style("stroke-width", fillStyle.dataPointStrokeWidth);

        // Value Labels (optional, can be very cluttered on radial charts)
        const valueLabelsGroup = mainChartGroup.append("g").attr("class", "value-labels-group");
        if (variables.showValueLabels !== false) { // Default to true unless explicitly false
            lineData.filter(d => d[valueFieldName] !== undefined && d[valueFieldName] !== null).forEach((d, i) => {
                const value = d[valueFieldName];
                const angle = angleScale(d[categoryFieldName]) - Math.PI / 2;
                const currentRadius = radiusScale(value);
                
                const labelText = value.toString();
                const textFontProps = {
                    fontFamily: fillStyle.typography.annotationFontFamily,
                    fontSize: fillStyle.typography.annotationFontSize,
                    fontWeight: fillStyle.typography.annotationFontWeight
                };
                const textWidth = estimateTextWidth(labelText, textFontProps);
                const textHeight = parseFloat(textFontProps.fontSize);

                let labelOffset = 15; // Distance from data point
                // Original specific offset for first point - simplified for consistency
                // const textX = (currentRadius + labelOffset) * Math.cos(angle);
                // const textY = (currentRadius + labelOffset) * Math.sin(angle);

                // Position label slightly outside the point, adjusting for text anchor
                let textX = currentRadius * Math.cos(angle);
                let textY = currentRadius * Math.sin(angle);
                let textAnchor = "middle";
                let dominantBaseline = "middle";

                const cosAngle = Math.cos(angle);
                const sinAngle = Math.sin(angle);

                // Adjust based on angle to push label outwards
                textX += cosAngle * labelOffset;
                textY += sinAngle * labelOffset;

                // Fine-tune anchor based on position
                if (Math.abs(cosAngle) < 0.1) { // Top or bottom
                    textAnchor = "middle";
                    dominantBaseline = sinAngle > 0 ? "hanging" : "alphabetic"; // Adjust vertical alignment
                     if (sinAngle > 0) textY += 2; else textY -=2;
                } else if (cosAngle > 0) { // Right side
                    textAnchor = "start";
                    textX += 2;
                } else { // Left side
                    textAnchor = "end";
                    textX -=2;
                }
                 if (Math.abs(sinAngle) < 0.1) { // Near horizontal
                    dominantBaseline = "middle";
                } else if (sinAngle < 0 && Math.abs(cosAngle) >= 0.1) { // Top half, not directly top
                     dominantBaseline = "alphabetic";
                     textY -=2;
                } else if (sinAngle > 0 && Math.abs(cosAngle) >= 0.1) { // Bottom half, not directly bottom
                     dominantBaseline = "hanging";
                     textY +=2;
                }


                // Background for label
                valueLabelsGroup.append("rect")
                    .attr("class", "other value-label-bg")
                    .attr("x", textX - (textAnchor === "middle" ? textWidth / 2 : (textAnchor === "start" ? 0 : textWidth)) - 4)
                    .attr("y", textY - textHeight * 0.7 - 2) // Approximate y adjustment
                    .attr("width", textWidth + 8)
                    .attr("height", textHeight + 4)
                    .attr("rx", 3)
                    .attr("ry", 3)
                    .style("fill", fillStyle.valueLabelBackgroundColor)
                    .style("fill-opacity", 0.8);

                valueLabelsGroup.append("text")
                    .attr("class", "label value-label")
                    .attr("x", textX)
                    .attr("y", textY)
                    .text(labelText)
                    .attr("text-anchor", textAnchor)
                    .attr("dominant-baseline", dominantBaseline)
                    .style("font-family", textFontProps.fontFamily)
                    .style("font-size", textFontProps.fontSize)
                    .style("font-weight", textFontProps.fontWeight)
                    .style("fill", fillStyle.valueLabelColor);
            });
        }
    }


    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}