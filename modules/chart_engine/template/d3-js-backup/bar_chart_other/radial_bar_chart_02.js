/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Circular Bar Chart",
  "chart_name": "grouped_circular_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [
    [1, 20],
    [0, "inf"],
    [2, 2]
  ],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary", "background_color", "text_color"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "prominent",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "ascending",
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
    const colors = data.colors || data.colors_dark || {}; // Assuming light/dark theme might pass different color objects
    const images = data.images || {}; // Not used in this chart but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getFieldNameByRole = (role) => {
        const col = dataColumns.find(c => c.role === role);
        return col ? col.name : null;
    };

    const xFieldName = getFieldNameByRole(xFieldRole);
    const yFieldName = getFieldNameByRole(yFieldRole);
    const groupFieldName = getFieldNameByRole(groupFieldRole);

    const missingFields = [];
    if (!xFieldName) missingFields.push(`field with role '${xFieldRole}'`);
    if (!yFieldName) missingFields.push(`field with role '${yFieldRole}'`);
    if (!groupFieldName) missingFields.push(`field with role '${groupFieldRole}'`);

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
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '14px', // Matched original 14px
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            labelFontWeightBold: (typography.label && typography.label.font_weight_bold) ? typography.label.font_weight_bold : 'bold',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '12px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#333333',
        textOnBarColor: '#FFFFFF', // As per original for index numbers
        chartBackground: colors.background_color || 'transparent', // Changed from #FFFFFF to transparent
        gridLineColor: (colors.other && colors.other.grid) || '#D3D3D3', // silver
        group0BarColor: (colors.other && colors.other.primary) ? colors.other.primary : (colors.available_colors ? colors.available_colors[0] : '#1f77b4'),
        group1BarColor: (colors.other && colors.other.secondary) ? colors.other.secondary : (colors.available_colors && colors.available_colors.length > 1 ? colors.available_colors[1] : '#ff7f0e'),
    };

    const estimateTextWidth = (text, fontProps) => {
        if (!text || text.length === 0) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        textElement.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        textElement.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // No need to append to DOM for getBBox
        const width = textElement.getBBox().width;
        return width;
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
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
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 40, bottom: 40, left: 40 }; // Original margins
    const chartInnerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartInnerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    
    // This radius is for one of the radial charts. Original used width/4 - 50.
    const chartRadius = Math.min(chartInnerWidth, chartInnerHeight) / 4 - (variables.chartRadiusReduction || 50);
    const barPadding = variables.barPadding || 10;
    const innerHoleRadius = variables.innerHoleRadius || 50; // The "+50" and "-50" in original radius calculations

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartData = rawChartData.map(d => ({...d})); // Shallow copy

    const groupedData = d3.group(chartData, d => d[groupFieldName]);
    const groupNames = Array.from(groupedData.keys());

    if (groupNames.length !== 2) {
        const errorMsg = `This chart requires exactly 2 groups based on '${groupFieldName}', but found ${groupNames.length}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    
    let yMin = d3.min(chartData, d => d[yFieldName]);
    let yMax = d3.max(chartData, d => d[yFieldName]);
    if (yMin === undefined || yMax === undefined) {
         const errorMsg = `Could not determine min/max for y-axis field '${yFieldName}'. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }


    const yRange = yMax - yMin;
    yMin = (yMin - yRange * 0.1);
    if (yMin < 0 && d3.min(chartData, d => d[yFieldName]) >= 0) { // Prevent going negative if data is non-negative
        yMin = 0;
    }
    
    const group0Data = groupedData.get(groupNames[0]).sort((a, b) => a[yFieldName] - b[yFieldName]);
    const group1Data = groupedData.get(groupNames[1]).sort((a, b) => a[yFieldName] - b[yFieldName]);

    const nBarsGroup0 = group0Data.length;
    const nBarsGroup1 = group1Data.length;

    if (nBarsGroup0 === 0 || nBarsGroup1 === 0) {
        const errorMsg = `One or both groups have no data. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const barWidthGroup0 = nBarsGroup0 > 0 ? (chartRadius / nBarsGroup0 - barPadding) : 0;
    const barWidthGroup1 = nBarsGroup1 > 0 ? (chartRadius / nBarsGroup1 - barPadding) : 0;

    // Block 6: Scale Definition & Configuration (Scales are defined within the helper)

    // Helper function to draw a single radial group
    function drawRadialGroup(params) {
        const {
            parentSelection, groupData, nBarsInGroup, barWidthVal,
            angleScaleDomain, angleScaleRange, barColor,
            textPathArcReferenceAngle, textPathStartOffset, indexTextPositioning,
            uniqueGroupId
        } = params;

        const angleScale = d3.scaleLinear().domain(angleScaleDomain).range(angleScaleRange);

        groupData.forEach((d, i) => {
            d.radius = (chartRadius - innerHoleRadius) / nBarsInGroup * i + barPadding + innerHoleRadius;
            d.angle = angleScale(d[yFieldName]);
        });
        
        const groupChart = parentSelection.append("g").attr("class", `radial-group ${uniqueGroupId}`);
        if (params.transform) {
            groupChart.attr("transform", params.transform);
        }

        // Radial Axis Lines
        const radialAxisLinesGroup = groupChart.append("g").attr("class", "axis radial-axis-group");
        radialAxisLinesGroup.selectAll("path.radial-axis-line")
            .data(groupData)
            .join("path")
            .attr("class", "axis radial-axis-line")
            .attr("d", d => {
                const radius = d.radius + barWidthVal;
                return d3.arc()({
                    innerRadius: radius,
                    outerRadius: radius + 0.5, // Thin line
                    startAngle: angleScaleRange[0],
                    endAngle: angleScaleRange[1]
                })();
            })
            .style("fill", "none")
            .style("stroke", fillStyle.gridLineColor)
            .style("stroke-width", "1px");

        // Bars
        const arcGenerator = d3.arc()
            .innerRadius(d => d.radius)
            .outerRadius(d => d.radius + barWidthVal)
            .startAngle(angleScaleRange[0]) // Start angle of the group's sector
            .cornerRadius(variables.barCornerRadius !== undefined ? variables.barCornerRadius : 20);

        const barElements = groupChart.append("g").attr("class", "marks-group");
        barElements.selectAll("path.mark")
            .data(groupData)
            .join("path")
            .attr("class", "mark bar")
            .style("fill", barColor)
            .attr("d", d => arcGenerator.endAngle(d.angle)(d))
            .attr("stroke-linecap", "round"); // For rounded corners effect with stroke

        // Text labels on arcs
        const textLabelsGroup = groupChart.append("g").attr("class", "labels-group");
        groupData.forEach((d, i) => {
            const textPathId = `textPath-${uniqueGroupId}-${i}`;
            const textContent = `${d[xFieldName]} / ${formatValue(d[yFieldName])}`;
            
            const textFontProps = {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            };
            const textPixelWidth = estimateTextWidth(textContent, textFontProps);
            
            const textPathRadius = d.radius + barWidthVal / 2;
            const shiftAngle = textPixelWidth / textPathRadius / 2; // angular width / 2

            textLabelsGroup.append("path")
                .attr("id", textPathId)
                .attr("d", d3.arc()({
                    innerRadius: textPathRadius,
                    outerRadius: textPathRadius,
                    startAngle: textPathArcReferenceAngle - shiftAngle,
                    endAngle: textPathArcReferenceAngle
                }))
                .style("fill", "none")
                .style("stroke", "none");

            textLabelsGroup.append("text")
                .attr("class", "text data-label")
                .attr("dy", -5) // Fine-tune vertical position
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .append("textPath")
                .attr("xlink:href", `#${textPathId}`)
                .attr("startOffset", textPathStartOffset)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .text(textContent);
        });
        
        // Index numbers
        const indexLabelsGroup = groupChart.append("g").attr("class", "index-labels-group");
        groupData.forEach((d, i) => {
            const pos = indexTextPositioning(d.radius + barWidthVal / 2, i);
            indexLabelsGroup.append("text")
                .attr("class", "text index-label")
                .attr("x", pos.x)
                .attr("y", pos.y)
                .attr("dx", pos.dx || 0)
                .attr("dy", pos.dy || 0)
                .style("fill", fillStyle.textOnBarColor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeightBold) // Bold index
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .text(i);
        });
    }

    // Block 7: Chart Component Rendering (Axes, Gridlines are part of drawRadialGroup)
    // No separate legend or Cartesian axes.

    // Block 8: Main Data Visualization Rendering
    // Group 0
    drawRadialGroup({
        parentSelection: mainChartGroup,
        groupData: group0Data,
        nBarsInGroup: nBarsGroup0,
        barWidthVal: barWidthGroup0,
        angleScaleDomain: [yMin, yMax],
        angleScaleRange: [-Math.PI / 4, 3 * Math.PI / 4],
        barColor: fillStyle.group0BarColor,
        textPathArcReferenceAngle: 3 * Math.PI / 4,
        textPathStartOffset: "75%",
        indexTextPositioning: (r) => ({
            x: Math.cos(-3 * Math.PI / 4 + 0.03) * r,
            y: Math.sin(-3 * Math.PI / 4 + 0.03) * r
        }),
        uniqueGroupId: "group0",
        transform: null // No additional transform for the first group
    });

    // Group 1
    const group1TranslateX = -chartRadius * (variables.group1OffsetXFactor !== undefined ? variables.group1OffsetXFactor : 0.8);
    const group1TranslateY = -chartRadius * (variables.group1OffsetYFactor !== undefined ? variables.group1OffsetYFactor : 0.533); // approx -80 for chartRadius 150

    drawRadialGroup({
        parentSelection: mainChartGroup,
        groupData: group1Data,
        nBarsInGroup: nBarsGroup1,
        barWidthVal: barWidthGroup1,
        angleScaleDomain: [yMin, yMax],
        angleScaleRange: [3 * Math.PI / 4, 7 * Math.PI / 4], // Symmetric angle range
        barColor: fillStyle.group1BarColor,
        textPathArcReferenceAngle: 7 * Math.PI / 4,
        textPathStartOffset: "75%",
        indexTextPositioning: (r) => ({
            x: Math.cos(Math.PI / 4) * r,
            y: Math.sin(Math.PI / 4) * r,
            dx: -10, // Original specific offsets
            dy: 13
        }),
        uniqueGroupId: "group1",
        transform: `translate(${group1TranslateX}, ${group1TranslateY})`
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - none in this version)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}