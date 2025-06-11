/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Bar Chart",
  "chart_name": "circular_bar_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [["1", "30"], ["0", "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary", "secondary", "background_color", "text_color"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming light/dark theme handled by input `colors`
    const images = data.images || {}; // Not used in this chart, but extracted for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === 'x');
    const yFieldCol = dataColumns.find(col => col.role === 'y');

    if (!xFieldCol || !xFieldCol.name) {
        console.error("Critical chart config missing: x-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (x-axis field name).</div>");
        return null;
    }
    if (!yFieldCol || !yFieldCol.name) {
        console.error("Critical chart config missing: y-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (y-axis field name).</div>");
        return null;
    }

    const xFieldName = xFieldCol.name;
    const yFieldName = yFieldCol.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
        },
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#333333',
        primaryBarColor: (colors.other && colors.other.primary) || '#1f77b4',
        gridLineColor: (colors.other && colors.other.secondary) || '#CCCCCC',
        getBarColor: (category, index) => {
            if (colors.field && colors.field[xFieldName] && colors.field[xFieldName][category]) {
                return colors.field[xFieldName][category];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return fillStyle.primaryBarColor;
        }
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox, but against directives.
        // For in-memory, this might be less accurate but adheres to "MUST NOT be appended to the document DOM".
        // A common workaround is to append to a detached SVG in the DOM, measure, then remove,
        // but the directive is strict. If getBBox on a non-rendered element is problematic,
        // a fixed-width estimation or a canvas-based method might be alternatives.
        // Assuming getBBox on an unattached element provides a reasonable estimate here.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on unattached elements
            return (text ? text.length : 0) * (parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 60, bottom: 60, left: 60 }; // Adjusted for labels
    if (variables.chartMargins) { // Allow overriding margins
        chartMargins.top = variables.chartMargins.top !== undefined ? variables.chartMargins.top : chartMargins.top;
        chartMargins.right = variables.chartMargins.right !== undefined ? variables.chartMargins.right : chartMargins.right;
        chartMargins.bottom = variables.chartMargins.bottom !== undefined ? variables.chartMargins.bottom : chartMargins.bottom;
        chartMargins.left = variables.chartMargins.left !== undefined ? variables.chartMargins.left : chartMargins.left;
    }

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const radius = Math.min(innerWidth, innerHeight) / 2;
    const innerRadius = radius * 0.3; // Space for center, or make configurable
    const outerRadius = radius * 0.9; // Leave some space for outer labels

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 5: Data Preprocessing & Transformation
    let chartDataArray = [...chartDataInput]; // Create a mutable copy
    chartDataArray.sort((a, b) => b[yFieldName] - a[yFieldName]); // Sort descending by yField

    // Filter out invalid data points for scales
    chartDataArray = chartDataArray.filter(d => d[xFieldName] != null && d[yFieldName] != null && !isNaN(parseFloat(d[yFieldName])) && isFinite(d[yFieldName]));

    if (chartDataArray.length === 0) {
        console.warn("No valid data to render for radial bar chart.");
         mainChartGroup.append("text")
            .attr("class", "text no-data-message")
            .attr("text-anchor", "middle")
            .attr("y", 0)
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .text("No data available to display chart.");
        return svgRoot.node();
    }
    
    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(chartDataArray.map(d => d[xFieldName]))
        .range([0, 2 * Math.PI]) // Full circle
        .padding(0.1); // Padding between bars

    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const yScale = d3.scaleRadial()
        .domain([0, yMax > 0 ? yMax : 1]) // Ensure domain is not [0,0]
        .range([innerRadius, outerRadius]);

    const arcGenerator = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(d => yScale(d[yFieldName]))
        .startAngle(d => xScale(d[xFieldName]))
        .endAngle(d => xScale(d[xFieldName]) + xScale.bandwidth())
        .padAngle(0.01) // Small padding within arc sections if needed
        .cornerRadius(variables.cornerRadius || 0); // Simple corner radius

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    
    // Radial Axis Gridlines (Concentric circles)
    const yAxisGridGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis-grid");

    const yTicks = yScale.ticks(5).slice(1); // Get ~5 ticks, remove the 0 tick for grid lines

    yAxisGridGroup.selectAll("circle.grid-line")
        .data(yTicks)
        .enter()
        .append("circle")
        .attr("class", "grid-line other")
        .attr("r", d => yScale(d))
        .style("fill", "none")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-dasharray", "2,2")
        .style("opacity", 0.7);

    // Radial Axis Labels
    const yAxisLabelGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis-labels");

    yAxisLabelGroup.selectAll("text.axis-label")
        .data(yTicks)
        .enter()
        .append("text")
        .attr("class", "label axis-label")
        .attr("x", 4) // Offset from the center line
        .attr("y", d => -yScale(d) + (parseInt(fillStyle.typography.annotationFontSize)/3) ) // Position above the line
        .attr("dy", "0em")
        .style("text-anchor", "start")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d3.format(".2s")(d)); // Format ticks (e.g., 1.0k, 1.5M)

    // Category Labels (Angular "Axis")
    const xAxisLabelGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis-labels");

    xAxisLabelGroup.selectAll("text.axis-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label axis-label")
        .attr("dy", ".35em")
        .attr("transform", d => {
            const angle = (xScale(d[xFieldName]) + xScale.bandwidth() / 2) * 180 / Math.PI - 90;
            const rotation = angle > 90 && angle < 270 ? angle + 180 : angle; // Flip if upside down
            const xPos = (outerRadius + 10) * Math.cos((xScale(d[xFieldName]) + xScale.bandwidth() / 2) - Math.PI / 2);
            const yPos = (outerRadius + 10) * Math.sin((xScale(d[xFieldName]) + xScale.bandwidth() / 2) - Math.PI / 2);
            return `translate(${xPos}, ${yPos}) rotate(${rotation})`;
        })
        .style("text-anchor", d => {
            const angle = (xScale(d[xFieldName]) + xScale.bandwidth() / 2) * 180 / Math.PI - 90;
            return (angle > 90 && angle < 270) ? "end" : "start";
        })
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => {
            const labelText = String(d[xFieldName]);
            // Simple truncation, consider estimateTextWidth for more complex logic
            return labelText.length > 15 ? labelText.substring(0, 12) + "..." : labelText;
        });


    // Block 8: Main Data Visualization Rendering
    const barElements = mainChartGroup.append("g")
        .attr("class", "bars-group")
        .selectAll("path.mark")
        .data(chartDataArray)
        .enter()
        .append("path")
        .attr("class", "mark bar")
        .attr("d", arcGenerator)
        .style("fill", (d, i) => fillStyle.getBarColor(d[xFieldName], i))
        .style("stroke", "none");

    // Block 9: Optional Enhancements & Post-Processing (e.g., Data Labels)
    const dataLabelGroup = mainChartGroup.append("g")
        .attr("class", "data-labels-group");

    dataLabelGroup.selectAll("text.data-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label data-label")
        .attr("transform", d => {
            const centroid = arcGenerator.centroid(d);
            // Position labels outside the arc, adjust angle for readability
            const midAngle = xScale(d[xFieldName]) + xScale.bandwidth() / 2;
            const labelRadius = yScale(d[yFieldName]) + 15; // Adjust offset as needed
            const x = labelRadius * Math.cos(midAngle - Math.PI / 2);
            const y = labelRadius * Math.sin(midAngle - Math.PI / 2);
            let angle = midAngle * 180 / Math.PI - 90;
            if (angle > 90 && angle < 270) { // Flip text if it's upside down
                angle += 180;
            }
            return `translate(${x}, ${y}) rotate(${angle})`;
        })
        .attr("dy", "0.35em")
        .style("text-anchor", d => {
            const midAngle = xScale(d[xFieldName]) + xScale.bandwidth() / 2;
            return (midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5) ? "end" : "start";
        })
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d3.format(".1f")(d[yFieldName])); // Show formatted Y value

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}