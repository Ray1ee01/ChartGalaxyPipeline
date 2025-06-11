/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Circular Bar Chart",
  "chart_name": "grouped_circular_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a Grouped Circular Bar Chart.
    // It expects data with x, y, and group fields.
    // Rounded corners for bars are a core visual feature.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data?.data;
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    // const imagesInput = data.images || {}; // Not used in this chart
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldDef = dataColumns.find(col => col.role === "x");
    const yFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    if (!xFieldDef || !yFieldDef || !groupFieldDef) {
        const missing = [
            !xFieldDef ? "x role" : null,
            !yFieldDef ? "y role" : null,
            !groupFieldDef ? "group role" : null
        ].filter(Boolean).join(', ');
        const errorMsg = `Critical chart config missing: column definitions for roles [${missing}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const xFieldName = xFieldDef.name;
    const yFieldName = yFieldDef.name;
    const groupFieldName = groupFieldDef.name;
    const yFieldUnit = yFieldDef.unit && yFieldDef.unit !== "none" ? yFieldDef.unit : "";

    if (!rawChartData || rawChartData.length === 0) {
        const errorMsg = "No data provided to chart. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    // Make a copy to prevent in-place modification of original data
    const chartDataArray = JSON.parse(JSON.stringify(rawChartData));


    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" }, // Not used directly for chart title
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "bold" }, // For category labels
        axisTick: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" }, // For grid tick labels
        dataValue: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }, // For bar value labels
        legend: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" } // Generic annotation
    };

    const defaultColors = {
        field: {}, // For categorical mapping
        other: { 
            primary: "#1f77b4", 
            secondary: "#ff7f0e",
            grid: "#e0e0e0"
        },
        available_colors: [...d3.schemeCategory10],
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };

    const fillStyle = {
        typography: {
            categoryLabel: { ...defaultTypography.label, ...(typographyInput.label || {}) },
            axisTickLabel: { ...defaultTypography.axisTick, ...(typographyInput.label || {}) }, // Use 'label' from input for ticks too
            dataValueLabel: { ...defaultTypography.dataValue, ...(typographyInput.annotation || {}) }, // Use 'annotation' for data values
            legendLabel: { ...defaultTypography.legend, ...(typographyInput.annotation || {}) } // Use 'annotation' for legend
        },
        chartBackground: colorsInput.background_color || defaultColors.background_color,
        textColor: colorsInput.text_color || defaultColors.text_color,
        gridLineColor: (colorsInput.other && colorsInput.other.grid) || defaultColors.other.grid,
        // Bar colors will be handled by colorScale
    };
    
    fillStyle.typography.categoryLabel.font_size = typographyInput.label?.font_size || defaultTypography.label.font_size;
    fillStyle.typography.categoryLabel.font_family = typographyInput.label?.font_family || defaultTypography.label.font_family;
    fillStyle.typography.categoryLabel.font_weight = typographyInput.label?.font_weight || defaultTypography.label.font_weight;
    
    fillStyle.typography.axisTickLabel.font_size = typographyInput.label?.font_size || defaultTypography.axisTick.font_size;
    fillStyle.typography.axisTickLabel.font_family = typographyInput.label?.font_family || defaultTypography.axisTick.font_family;
    fillStyle.typography.axisTickLabel.font_weight = typographyInput.label?.font_weight || defaultTypography.axisTick.font_weight;

    fillStyle.typography.dataValueLabel.font_size = typographyInput.annotation?.font_size || defaultTypography.dataValue.font_size;
    fillStyle.typography.dataValueLabel.font_family = typographyInput.annotation?.font_family || defaultTypography.dataValue.font_family;
    fillStyle.typography.dataValueLabel.font_weight = typographyInput.annotation?.font_weight || defaultTypography.dataValue.font_weight;

    fillStyle.typography.legendLabel.font_size = typographyInput.annotation?.font_size || defaultTypography.legend.font_size;
    fillStyle.typography.legendLabel.font_family = typographyInput.annotation?.font_family || defaultTypography.legend.font_family;
    fillStyle.typography.legendLabel.font_weight = typographyInput.annotation?.font_weight || defaultTypography.legend.font_weight;


    function estimateTextWidth(text, fontProps) {
        if (!text || text.length === 0) return 0;
        const { font_family = 'sans-serif', font_size = '12px', font_weight = 'normal' } = fontProps || {};
        
        const svgNode = d3.create('svg').node();
        const textNode = d3.create('text')
            .attr('font-family', font_family)
            .attr('font-size', font_size)
            .attr('font-weight', font_weight)
            .text(text)
            .node();
        svgNode.appendChild(textNode);

        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on detached elements
            const fontSizePx = parseFloat(font_size) || 12;
            width = text.length * fontSizePx * 0.6; // Heuristic
        }
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    const createRoundedArcPath = (innerRadius, outerRadius, startAngle, endAngle, cornerRadius) => {
        const startAngleRad = startAngle - Math.PI / 2;
        const endAngleRad = endAngle - Math.PI / 2;
        
        const thickness = outerRadius - innerRadius;
        const adjustedCornerRadius = Math.min(cornerRadius, thickness / 2, Math.abs(endAngleRad - startAngleRad) * Math.min(innerRadius, outerRadius) / 2);

        if (adjustedCornerRadius <= 0) { // Fallback to non-rounded arc if radius is too small or zero
             return d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(outerRadius)
                .startAngle(startAngleRad + Math.PI / 2) // d3.arc expects angles relative to +X
                .endAngle(endAngleRad + Math.PI / 2)();
        }
        
        const sr = adjustedCornerRadius / innerRadius; // Angle span for inner corner
        const so = adjustedCornerRadius / outerRadius; // Angle span for outer corner

        const points = [
            // Point 1: Inner arc start, after corner
            [innerRadius * Math.cos(startAngleRad + sr), innerRadius * Math.sin(startAngleRad + sr)],
            // Point 2: Outer arc start, after corner
            [outerRadius * Math.cos(startAngleRad + so), outerRadius * Math.sin(startAngleRad + so)],
            // Point 3: Outer arc end, before corner
            [outerRadius * Math.cos(endAngleRad - so), outerRadius * Math.sin(endAngleRad - so)],
            // Point 4: Inner arc end, before corner
            [innerRadius * Math.cos(endAngleRad - sr), innerRadius * Math.sin(endAngleRad - sr)]
        ];

        const largeArcFlag = (endAngleRad - startAngleRad) > Math.PI ? 1 : 0;

        return `
            M ${points[0][0]} ${points[0][1]}
            A ${adjustedCornerRadius} ${adjustedCornerRadius} 0 0 1 ${points[1][0]} ${points[1][1]}
            A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${points[2][0]} ${points[2][1]}
            A ${adjustedCornerRadius} ${adjustedCornerRadius} 0 0 1 ${points[3][0]} ${points[3][1]}
            A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${points[0][0]} ${points[0][1]}
            Z
        `;
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
    const chartMargins = { top: 40, right: 150, bottom: 40, left: 40 }; // Increased right margin for legend
    if (variables.legend_position === 'bottom') { // Example of adjusting margins based on a variable
        chartMargins.bottom = 100;
        chartMargins.right = 40;
    }

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = chartMargins.left + innerWidth / 2;
    const centerY = chartMargins.top + innerHeight / 2;
    
    const maxOuterRadius = Math.min(innerWidth, innerHeight) / 2;
    const minInnerRadius = maxOuterRadius * (variables.minRadiusProportion || 0.2); // e.g. 20% of max radius for the center hole
    const barRegionRadius = maxOuterRadius * (variables.barRegionProportion || 0.95); // e.g. bars occupy up to 95% of max radius

    const numBars = chartDataArray.length;
    const barThicknessRatio = variables.barThicknessRatio || 0.7; // 70% bar, 30% gap

    const totalBarSpace = (barRegionRadius - minInnerRadius) / numBars;
    const barThickness = totalBarSpace * barThicknessRatio;
    const barGap = totalBarSpace * (1 - barThicknessRatio);
    
    const categoryLabelPadding = variables.categoryLabelPadding !== undefined ? variables.categoryLabelPadding : 20;
    const numGridTicks = variables.numGridTicks || 5;
    const cornerRadiusRatio = variables.cornerRadiusRatio !== undefined ? variables.cornerRadiusRatio : 0.5; // 0.5 for fully rounded ends

    // Block 5: Data Preprocessing & Transformation
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort((a,b) => String(a).localeCompare(String(b)));

    chartDataArray.sort((a, b) => {
        const xCompare = String(a[xFieldName]).localeCompare(String(b[xFieldName]));
        if (xCompare !== 0) return xCompare;
        return String(a[groupFieldName]).localeCompare(String(b[groupFieldName]));
    });

    // Block 6: Scale Definition & Configuration
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => 
            (colorsInput.field && colorsInput.field[group]) || 
            (colorsInput.available_colors && colorsInput.available_colors[i % colorsInput.available_colors.length]) ||
            defaultColors.available_colors[i % defaultColors.available_colors.length]
        ));

    const maxValue = d3.max(chartDataArray, d => d[yFieldName]);
    const angleScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue : 1]) // Ensure domain is not [0,0]
        .range([0, (variables.maxAngleDegrees || 270) * Math.PI / 180]); // Default 270 degrees

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group");

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Radial Gridlines & Tick Labels
    const gridTickValues = d3.range(0, (maxValue > 0 ? maxValue : 1) + 1, (maxValue > 0 ? maxValue : 1) / numGridTicks);
    const gridLinesGroup = mainChartGroup.append("g").attr("class", "gridlines-group");

    gridTickValues.forEach(tickValue => {
        const tickAngle = angleScale(tickValue);
        gridLinesGroup.append("path")
            .attr("class", "gridline radial-gridline")
            .attr("d", d3.arc()
                .innerRadius(minInnerRadius)
                .outerRadius(barRegionRadius + barThickness * 0.1) // Extend slightly beyond bars
                .startAngle(tickAngle - Math.PI / 2) // Adjust for d3.arc convention (0 is right)
                .endAngle(tickAngle - Math.PI / 2)   // Creates a radial line
            )
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("fill", "none");

        const tickLabelRadius = barRegionRadius + barThickness * 0.25;
        gridLinesGroup.append("text")
            .attr("class", "label tick-label")
            .attr("x", Math.cos(tickAngle - Math.PI / 2) * tickLabelRadius)
            .attr("y", Math.sin(tickAngle - Math.PI / 2) * tickLabelRadius)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.axisTickLabel.font_family)
            .style("font-size", fillStyle.typography.axisTickLabel.font_size)
            .style("font-weight", fillStyle.typography.axisTickLabel.font_weight)
            .text(formatValue(Math.round(tickValue)) + yFieldUnit);
    });

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend-group")
        .attr("transform", `translate(${containerWidth - chartMargins.right + 20}, ${chartMargins.top})`);

    const legendItemHeight = parseFloat(fillStyle.typography.legendLabel.font_size) + 5;
    const legendMarkSize = parseFloat(fillStyle.typography.legendLabel.font_size);

    groups.forEach((group, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${i * legendItemHeight})`);

        legendItem.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendMarkSize)
            .attr("height", legendMarkSize)
            .attr("fill", colorScale(group));

        legendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendMarkSize + 5)
            .attr("y", legendMarkSize / 2)
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.legendLabel.font_family)
            .style("font-size", fillStyle.typography.legendLabel.font_size)
            .style("font-weight", fillStyle.typography.legendLabel.font_weight)
            .text(group);
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barsGroup = mainChartGroup.append("g").attr("class", "bars-group");
    const categoryLabelsGroup = mainChartGroup.append("g").attr("class", "category-labels-group");
    const valueLabelsGroup = mainChartGroup.append("g").attr("class", "value-labels-group");

    chartDataArray.forEach((d, i) => {
        const innerR = minInnerRadius + i * (barThickness + barGap);
        const outerR = innerR + barThickness;
        const barEndAngle = angleScale(d[yFieldName]);
        const barCornerRadius = barThickness * cornerRadiusRatio;

        barsGroup.append("path")
            .attr("class", "mark bar")
            .attr("d", createRoundedArcPath(innerR, outerR, 0, barEndAngle, barCornerRadius))
            .attr("fill", colorScale(d[groupFieldName]));

        // Category Labels (X-axis equivalent) - only for the first bar of each X category
        const isFirstBarForThisX = chartDataArray.findIndex(item => item[xFieldName] === d[xFieldName]) === i;
        if (isFirstBarForThisX) {
            const labelRadius = innerR - barGap / 2; // Position just inside the bar
            categoryLabelsGroup.append("text")
                .attr("class", "label category-label")
                .attr("x", Math.cos(0 - Math.PI / 2) * (labelRadius > 0 ? labelRadius : 0) - categoryLabelPadding) // Start angle is 0, point upwards
                .attr("y", Math.sin(0 - Math.PI / 2) * (labelRadius > 0 ? labelRadius : 0))
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.categoryLabel.font_family)
                .style("font-size", fillStyle.typography.categoryLabel.font_size)
                .style("font-weight", fillStyle.typography.categoryLabel.font_weight)
                .text(d[xFieldName]);
        }

        // Value Labels on Arcs
        if (barEndAngle > 0.1) { // Only show label if bar is reasonably large
            const valueText = formatValue(d[yFieldName]) + yFieldUnit;
            const valueLabelRadius = innerR + barThickness / 2;
            
            const textWidth = estimateTextWidth(valueText, fillStyle.typography.dataValueLabel);
            const minArcAngleForText = 0.1; // Minimum angle for text path
            // Calculate the angle span needed for the text
            const angleSpanForText = Math.max(textWidth / valueLabelRadius, minArcAngleForText);

            // Ensure path is within bar's angle
            const pathStartAngle = Math.max(0, barEndAngle - angleSpanForText / 2);
            const pathEndAngle = Math.min(angleScale.range()[1], barEndAngle + angleSpanForText / 2);
            
            // Ensure start is less than end, and path is not too small
            if (pathEndAngle > pathStartAngle && (pathEndAngle - pathStartAngle) * valueLabelRadius > textWidth * 0.5) {
                 const valueTextPathId = `valueTextPath-${containerSelector.replace(/[^a-zA-Z0-9]/g, '')}-${i}`;
                
                valueLabelsGroup.append("path")
                    .attr("class", "text-path-helper")
                    .attr("id", valueTextPathId)
                    .attr("d", d3.arc()({
                        innerRadius: valueLabelRadius,
                        outerRadius: valueLabelRadius,
                        startAngle: pathStartAngle - Math.PI / 2, // d3.arc expects angles relative to +X
                        endAngle: pathEndAngle - Math.PI / 2
                    }))
                    .style("fill", "none")
                    .style("stroke", "none");

                valueLabelsGroup.append("text")
                    .attr("class", "label value-label")
                    .style("font-family", fillStyle.typography.dataValueLabel.font_family)
                    .style("font-size", fillStyle.typography.dataValueLabel.font_size)
                    .style("font-weight", fillStyle.typography.dataValueLabel.font_weight)
                    .attr("fill", fillStyle.textColor) // Or a contrasting color
                    .append("textPath")
                    .attr("xlink:href", `#${valueTextPathId}`)
                    .attr("startOffset", "50%")
                    .attr("text-anchor", "middle")
                    .text(valueText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactoring from the original)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}