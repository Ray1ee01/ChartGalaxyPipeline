/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Circular Bar Chart",
  "chart_name": "grouped_circular_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [ 
    [2, 20],
    [0, "inf"],
    [2, 2]
  ],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "secondary"],
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
  "valueSortDirection": "ascending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or data.colors_dark for dark
    const images = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    const criticalFields = { xField, yField, groupField };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        groupColors: {},
    };

    fillStyle.typography.labelFontFamily = (typography.label && typography.label.font_family) || 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = (typography.label && typography.label.font_size) || '12px'; // Original used 14px, but this is a global label default
    fillStyle.typography.labelFontWeight = (typography.label && typography.label.font_weight) || 'normal';
    
    // Specific font size for this chart's labels, as per original's "14px"
    // This could also come from typography.annotation if more granular control is needed
    const barLabelFontSize = '14px'; 

    fillStyle.textColor = colors.text_color || '#333333';
    fillStyle.textColorLight = '#FFFFFF'; // For labels on dark backgrounds/bars
    fillStyle.chartBackground = colors.background_color || '#FFFFFF';
    fillStyle.gridLineColor = colors.other?.grid || '#CCCCCC'; // Original 'silver'
    const defaultCategoricalColors = d3.schemeCategory10;
    fillStyle.barColorFallback = defaultCategoricalColors[0];


    function estimateTextWidth(text, fontSize = fillStyle.typography.labelFontSize, fontFamily = fillStyle.typography.labelFontFamily, fontWeight = fillStyle.typography.labelFontWeight) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM manipulation.
        // This in-memory approach might be less accurate for complex fonts or kerning.
        // For robustness if issues arise: document.body.appendChild(svg); const width = textEl.getBBox().width; document.body.removeChild(svg); return width;
        try {
            return textEl.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            return text.length * (parseInt(fontSize) * 0.6); // Rough estimate
        }
    }

    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format("~s")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~s")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~s")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    // Scaling factor to adapt original logic (which used width*2) to current fixed SVG size
    const coordScaleFactor = 0.5; 

    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Reduced margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const mainChartGroupX = containerWidth / 2;
    const mainChartGroupY = containerHeight / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${mainChartGroupX}, ${mainChartGroupY})`)
        .attr("class", "main-chart-group");

    // Radii and padding, scaled from original's implicit 2x coordinate system
    const groupChartPlotRadius = (containerWidth / 2 - 50) * coordScaleFactor; // Original: variables.width / 2 - 50
    const fixedInnerPadding = 50 * coordScaleFactor;
    const barPadding = 10 * coordScaleFactor;

    const groupCenters = [
        { x: 0, y: 0 }, // Group 0 relative to mainChartGroup
        { x: -120 * coordScaleFactor, y: -80 * coordScaleFactor } // Group 1 relative to mainChartGroup
    ];
    
    // Block 5: Data Preprocessing & Transformation
    const groupedData = d3.group(chartData, d => d[groupField]);
    const groupNames = Array.from(groupedData.keys()).sort(); // Sort for consistency

    if (groupNames.length !== 2) {
        console.error("This chart is designed for exactly two groups. Found: " + groupNames.length);
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Chart error: Requires two groups.</div>");
        return null;
    }
    
    // Populate fillStyle.groupColors
    groupNames.forEach((groupName, index) => {
        let color;
        if (colors.field && colors.field[groupField] && colors.field[groupField][groupName]) {
            color = colors.field[groupField][groupName];
        } else if (index === 0 && colors.other?.primary) {
            color = colors.other.primary;
        } else if (index === 1 && colors.other?.secondary) {
            color = colors.other.secondary;
        } else if (colors.available_colors && colors.available_colors.length > index) {
            color = colors.available_colors[index];
        } else {
            color = defaultCategoricalColors[index % defaultCategoricalColors.length];
        }
        fillStyle.groupColors[groupName] = color;
    });

    let minY = d3.min(chartData, d => +d[yField]);
    let maxY = d3.max(chartData, d => +d[yField]);
    const yRange = maxY - minY;
    minY = (minY === maxY) ? minY - Math.abs(minY * 0.1 || 1) : minY - yRange * 0.1; // Ensure minY < maxY
    if (minY === maxY) maxY = minY + 1; // Handle single value case after adjustment

    let maxNBars = 0;
    groupedData.forEach(group => {
        if (group.length > maxNBars) maxNBars = group.length;
    });
    if (maxNBars === 0) maxNBars = 1; // Avoid division by zero

    const barSegmentThickness = Math.max(barPadding + 1, (groupChartPlotRadius - fixedInnerPadding) / maxNBars);
    const actualBarWidth = Math.max(1, barSegmentThickness - barPadding);

    groupedData.forEach((group, groupName) => {
        group.sort((a, b) => +a[yField] - +b[yField]); // Ascending sort
        group.forEach((d, i) => {
            d.calculatedRadius = fixedInnerPadding + i * barSegmentThickness;
            d.value = +d[yField]; // Ensure numeric
        });
    });

    // Block 6: Scale Definition & Configuration
    const angleScales = [
        d3.scaleLinear().domain([minY, maxY]).range([-Math.PI / 4, 3 * Math.PI / 4]), // Group 0
        d3.scaleLinear().domain([minY, maxY]).range([3 * Math.PI / 4, 7 * Math.PI / 4])  // Group 1
    ];

    groupedData.forEach((group, groupName) => {
        const groupIndex = groupNames.indexOf(groupName);
        group.forEach(d => {
            d.angle = angleScales[groupIndex](d.value);
        });
    });
    
    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)

    groupNames.forEach((groupName, groupIndex) => {
        const groupData = groupedData.get(groupName);
        if (!groupData) return;

        const groupChartG = mainChartGroup.append("g")
            .attr("class", `chart-group chart-group-${groupIndex} mark`)
            .attr("transform", `translate(${groupCenters[groupIndex].x}, ${groupCenters[groupIndex].y})`);

        // Radial Gridlines (as part of component rendering)
        const rAxis = groupChartG.append("g").attr("class", "axis r-axis");
        rAxis.selectAll("path.grid-line")
            .data(groupData)
            .join("path")
            .attr("class", "grid-line mark")
            .attr("d", d => {
                const radius = d.calculatedRadius + actualBarWidth; // Grid line at outer edge of bar
                return d3.arc()({
                    innerRadius: radius,
                    outerRadius: radius + (1 * coordScaleFactor), // Thin line
                    startAngle: angleScales[groupIndex].range()[0],
                    endAngle: angleScales[groupIndex].range()[1]
                });
            })
            .style("fill", "none")
            .style("stroke", fillStyle.gridLineColor)
            .style("stroke-width", `${1 * coordScaleFactor}px`);

        // Bars
        const arcGenerator = d3.arc()
            .innerRadius(d => d.calculatedRadius)
            .outerRadius(d => d.calculatedRadius + actualBarWidth)
            .startAngle(angleScales[groupIndex].range()[0])
            .endAngle(d => d.angle);
            // .cornerRadius removed as per "no complex visual effects"

        const bars = groupChartG.append('g').attr("class", "bars value");
        bars.selectAll('path.bar-mark')
            .data(groupData)
            .join('path')
            .attr("class", "bar-mark mark value")
            .style('fill', fillStyle.groupColors[groupName] || fillStyle.barColorFallback)
            .attr('d', arcGenerator);

        // Labels on Arcs (TextPath)
        const labelsOnPath = groupChartG.append("g").attr("class", "labels-on-path");
        groupData.forEach((d, i) => {
            const textPathId = `textPath-group${groupIndex}-item${i}-${Date.now()}`; // Unique ID
            const textPathRadius = d.calculatedRadius + actualBarWidth / 2;
            const textContent = `${d[xField]} / ${formatValue(d.value)}`;
            
            const estimatedTextPixelWidth = estimateTextWidth(textContent, barLabelFontSize, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontWeight);
            const shiftAngle = (estimatedTextPixelWidth / textPathRadius) / 2; // Approximation

            let pathStartAngle, pathEndAngle, textStartOffset = "75%", textAnchor = "middle";

            if (groupIndex === 0) { // Group 0 labels (top-right)
                pathStartAngle = angleScales[groupIndex].range()[1] - shiftAngle;
                pathEndAngle = angleScales[groupIndex].range()[1];
            } else { // Group 1 labels (bottom-left)
                pathStartAngle = angleScales[groupIndex].range()[1] - shiftAngle;
                pathEndAngle = angleScales[groupIndex].range()[1];
            }
            
            labelsOnPath.append("path")
                .attr("id", textPathId)
                .attr("d", d3.arc()({
                    innerRadius: textPathRadius,
                    outerRadius: textPathRadius,
                    startAngle: pathStartAngle,
                    endAngle: pathEndAngle
                }))
                .style("fill", "none")
                .style("stroke", "none");

            labelsOnPath.append("text")
                .attr("class", "label data-label text")
                .attr("dy", -5 * coordScaleFactor) // Adjust vertical position
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", barLabelFontSize) // Using specific size
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .append("textPath")
                .attr("xlink:href", `#${textPathId}`)
                .attr("startOffset", textStartOffset)
                .attr("text-anchor", textAnchor)
                .attr("dominant-baseline", "middle")
                .text(textContent);
        });
        
        // Index Labels
        const indexLabels = groupChartG.append("g").attr("class", "index-labels");
        groupData.forEach((d, i) => {
            let x, y, dx = 0, dy = 0;
            const labelRadius = d.calculatedRadius + actualBarWidth / 2;

            if (groupIndex === 0) {
                x = Math.cos(-3 * Math.PI / 4 + 0.03) * labelRadius; // Original positioning
                y = Math.sin(-3 * Math.PI / 4 + 0.03) * labelRadius;
            } else {
                x = Math.cos(Math.PI / 4) * labelRadius; // Original positioning
                y = Math.sin(Math.PI / 4) * labelRadius;
                dx = -10 * coordScaleFactor; // Original dx, dy
                dy = 13 * coordScaleFactor;
            }

            indexLabels.append("text")
                .attr("class", "label index-label text")
                .attr("x", x)
                .attr("y", y)
                .attr("dx", dx)
                .attr("dy", dy)
                .style("fill", fillStyle.textColorLight)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", barLabelFontSize) // Using specific size
                .style("font-weight", "bold")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .text(i);
        });
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}