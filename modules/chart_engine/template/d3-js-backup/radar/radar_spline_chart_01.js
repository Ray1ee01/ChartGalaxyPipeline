/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radar Spline Chart",
  "chart_name": "radar_spline_chart_01",
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

  "elementAlignment": "center",
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || (data.colors_dark || {});
    // const imagesConfig = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x-role field");
        if (!valueFieldName) missingFields.push("y-role field");
        const errorMsg = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    if (chartDataInput.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#1f77b4',
        gridLineColor: (colorsConfig.other && colorsConfig.other.grid) ? colorsConfig.other.grid : '#CCCCCC',
        axisLabelColor: colorsConfig.text_color || '#333333',
        tickLabelColor: colorsConfig.text_color || '#666666',
        dataPointStrokeColor: colorsConfig.background_color || '#FFFFFF',
        dataValueLabelColor: (colorsConfig.other && colorsConfig.other.value_label_text) ? colorsConfig.other.value_label_text : '#FFFFFF',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        textColor: colorsConfig.text_color || '#0f223b',
    };
    fillStyle.dataValueLabelBackgroundColor = (colorsConfig.other && colorsConfig.other.value_label_background) ? colorsConfig.other.value_label_background : fillStyle.primaryColor;


    fillStyle.typography = {
        labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
        labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
        labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'bold', // Category labels are often bold
        annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
        annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
        annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
    };

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        if (fontProps) {
            if (fontProps.fontFamily) textElement.style.fontFamily = fontProps.fontFamily;
            if (fontProps.fontSize) textElement.style.fontSize = fontProps.fontSize;
            if (fontProps.fontWeight) textElement.style.fontWeight = fontProps.fontWeight;
        }
        svg.appendChild(textElement);
        // No need to append to DOM for getBBox if it's an SVG element
        // document.body.appendChild(svg); // Not needed
        const width = textElement.getBBox().width;
        // document.body.removeChild(svg); // Not needed
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const chartMargins = { // Default margins, can be made configurable via `variables`
        top: variables.margin_top || 50,
        right: variables.margin_right || 50,
        bottom: variables.margin_bottom || 50,
        left: variables.margin_left || 50
    };
    
    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartRenderWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartRenderHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(chartRenderWidth, chartRenderHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartDataInput.map(d => d[categoryFieldName]))];
    const allValues = chartDataInput.map(d => parseFloat(d[valueFieldName])).filter(v => !isNaN(v));
    
    if (categories.length < 3) {
         const errorMsg = "Radar charts require at least 3 categories (x-axis points).";
         console.error(errorMsg);
         d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
         return null;
    }

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]); // Ensure categories don't overlap at 0/2PI

    const minValue = Math.min(0, d3.min(allValues) || 0);
    const maxValue = d3.max(allValues) || 0;
    
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue === 0 && minValue === 0 ? 1 : maxValue * 1.2]) // Handle all zero data, extend slightly
        .range([0, radius])
        .nice();

    const gridTicks = radiusScale.ticks(5).filter(t => t >= 0); // Ensure ticks are non-negative

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Concentric Circles (Gridlines)
    mainChartGroup.selectAll(".circular-grid-line")
        .data(gridTicks)
        .enter()
        .append("circle")
        .attr("class", "grid-line circular-grid-line")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d => radiusScale(d))
        .attr("fill", "none")
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // Radial Axis Lines (Spokes)
    mainChartGroup.selectAll(".radial-axis-line")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis radial-axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", (d) => radiusScale(radiusScale.domain()[1]) * Math.cos(angleScale(d) - Math.PI / 2)) // Extend to max radius
        .attr("y2", (d) => radiusScale(radiusScale.domain()[1]) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    // Category Labels (Axis Labels)
    const categoryLabelOffset = parseFloat(fillStyle.typography.labelFontSize) * 1.5; // Offset based on font size
    mainChartGroup.selectAll(".category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label category-label")
        .attr("x", d => (radiusScale(radiusScale.domain()[1]) + categoryLabelOffset) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radiusScale(radiusScale.domain()[1]) + categoryLabelOffset) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d);
            if (Math.abs(angle % Math.PI) < 0.01) return "middle"; // Top or bottom
            return (angle > 0 && angle < Math.PI) || (angle < -Math.PI && angle > -2*Math.PI) ? "start" : "end"; // Right or left side
        })
        .attr("dominant-baseline", d => {
            const angle = angleScale(d) - Math.PI / 2; // Adjusted for typical radar orientation
            if (Math.abs(angle + Math.PI/2) < 0.01 || Math.abs(angle - Math.PI/2) < 0.01 ) return "middle"; // Horizontal alignment
            return angle > -Math.PI/2 && angle < Math.PI/2 ? "auto" : "hanging"; // Vertical alignment
        })
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .attr("fill", fillStyle.axisLabelColor)
        .text(d => d);

    // Tick Value Labels (Axis Labels) - typically along one axis, e.g., vertical
    if (gridTicks.length > 0 && gridTicks[0] !== gridTicks[gridTicks.length-1]) { // Avoid label if only one tick (e.g. all zeros)
        mainChartGroup.selectAll(".tick-value-label")
            .data(gridTicks.filter(t => t > 0)) // Don't label 0 at the center typically
            .enter()
            .append("text")
            .attr("class", "label tick-value-label")
            .attr("x", 5) // Small offset from the vertical axis line
            .attr("y", d => -radiusScale(d))
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", fillStyle.tickLabelColor)
            .text(d => d);
    }


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => d.x)
        .y(d => d.y)
        .curve(d3.curveCatmullRomClosed.alpha(0.5));

    const radarLineData = categories.map(cat => {
        const pointData = chartDataInput.find(item => item[categoryFieldName] === cat);
        const value = pointData ? parseFloat(pointData[valueFieldName]) : 0;
        const angle = angleScale(cat) - Math.PI / 2; // Align with 0 degrees pointing up
        const currentRadius = radiusScale(isNaN(value) ? 0 : value);
        return {
            x: currentRadius * Math.cos(angle),
            y: currentRadius * Math.sin(angle),
            value: isNaN(value) ? 0 : value,
            category: cat
        };
    });

    mainChartGroup.append("path")
        .datum(radarLineData)
        .attr("class", "mark radar-spline-path")
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", fillStyle.primaryColor)
        .attr("stroke-width", variables.stroke_width || 3); // Configurable stroke width

    // Data Points (Circles)
    mainChartGroup.selectAll(".data-point")
        .data(radarLineData)
        .enter()
        .append("circle")
        .attr("class", "mark data-point")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", variables.data_point_radius || 4) // Configurable radius
        .attr("fill", fillStyle.primaryColor)
        .attr("stroke", fillStyle.dataPointStrokeColor)
        .attr("stroke-width", variables.data_point_stroke_width || 2);

    // Data Value Labels (if enabled, e.g., via variables.show_value_labels)
    if (variables.show_value_labels) {
        const labelOffset = (variables.data_point_radius || 4) + 8; // Offset from data point
        const valueLabelFontProps = {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        };

        radarLineData.forEach((d, i) => {
            const labelText = d.value.toString();
            const textWidth = estimateTextWidth(labelText, valueLabelFontProps);
            const angle = angleScale(d.category) - Math.PI / 2;

            // Position label slightly outside the point
            const textX = (radiusScale(d.value) + labelOffset) * Math.cos(angle);
            const textY = (radiusScale(d.value) + labelOffset) * Math.sin(angle);
            
            // Adjust anchor based on angle for better readability
            let textAnchor = "middle";
            if (Math.abs(Math.cos(angle)) > 0.9) { // Mostly horizontal
                 textAnchor = Math.cos(angle) > 0 ? "start" : "end";
            }

            let dominantBaseline = "middle";
             if (Math.abs(Math.sin(angle)) > 0.9) { // Mostly vertical
                 dominantBaseline = Math.sin(angle) > 0 ? "hanging" : "alphabetic";
            }


            // Background for label
            mainChartGroup.append("rect")
                .attr("class", "other data-value-label-background")
                .attr("x", textX - (textAnchor === "middle" ? textWidth / 2 : (textAnchor === "start" ? 0 : textWidth)) - 4)
                .attr("y", textY - (parseFloat(valueLabelFontProps.fontSize) / 2) - 4)
                .attr("width", textWidth + 8)
                .attr("height", parseFloat(valueLabelFontProps.fontSize) + 8)
                .attr("fill", fillStyle.dataValueLabelBackgroundColor)
                .attr("rx", 3);

            mainChartGroup.append("text")
                .attr("class", "label data-value-label")
                .attr("x", textX)
                .attr("y", textY)
                .attr("text-anchor", textAnchor)
                .attr("dominant-baseline", dominantBaseline)
                .style("font-family", valueLabelFontProps.fontFamily)
                .style("font-size", valueLabelFontProps.fontSize)
                .style("font-weight", valueLabelFontProps.fontWeight)
                .attr("fill", fillStyle.dataValueLabelColor)
                .text(labelText);
        });
    }

    // Block 9: Optional Enhancements & Post-Processing
    // (None specified for this chart beyond basic rendering)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}