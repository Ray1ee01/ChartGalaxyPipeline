/* REQUIREMENTS_BEGIN
{
  "chart_type": "Semicircle Donut Chart",
  "chart_name": "semicircle_donut_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a Semicircle Donut Chart.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // Assuming light theme, add logic for dark if needed
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldDef = dataColumns.find(col => col.role === "x");
    const yFieldDef = dataColumns.find(col => col.role === "y");

    if (!xFieldDef || !xFieldDef.name) {
        console.error("Critical chart config missing: X-axis field name (role 'x'). Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: X-axis field configuration is missing.</div>");
        return null;
    }
    if (!yFieldDef || !yFieldDef.name) {
        console.error("Critical chart config missing: Y-axis field name (role 'y'). Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Y-axis field configuration is missing.</div>");
        return null;
    }

    const xFieldName = xFieldDef.name;
    const yFieldName = yFieldDef.name;

    // Filter out data points with missing or invalid yFieldName values if they are essential for sum calculation
    const chartDataArray = rawChartData.filter(d => typeof d[yFieldName] === 'number' && d[yFieldName] >= 0);

    if (chartDataArray.length === 0) {
        console.warn("No valid data to render for Semicircle Donut Chart.");
        // Optionally render a message in the container
        // d3.select(containerSelector).html("<div style='color:grey;'>No data available for the chart.</div>");
        // return null; // Or proceed to render an empty chart structure
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            // Add other typography tokens (title, annotation) if used, with defaults
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
        },
        colors: {
            textColor: rawColors.text_color || '#333333',
            defaultSegmentColor: (rawColors.other && rawColors.other.primary) || '#4682B4',
            labelLineColor: (rawColors.other && rawColors.other.secondary) || '#888888', // Example, adjust token if needed
            chartBackground: rawColors.background_color || '#FFFFFF', // Not directly applied to SVG root by default here
            categoryColorMap: {}
        },
        images: {
            field: (rawImages.field || {}),
            other: (rawImages.other || {})
        }
    };

    const allCategories = Array.from(new Set(chartDataArray.map(d => d[xFieldName])));
    const defaultPalette = d3.schemeCategory10;
    const availableColors = rawColors.available_colors || [];

    allCategories.forEach((category, index) => {
        if (rawColors.field && rawColors.field[category]) {
            fillStyle.colors.categoryColorMap[category] = rawColors.field[category];
        } else if (availableColors.length > 0) {
            fillStyle.colors.categoryColorMap[category] = availableColors[index % availableColors.length];
        } else {
            fillStyle.colors.categoryColorMap[category] = defaultPalette[index % defaultPalette.length];
        }
    });

    function getCategoryColor(category) {
        return fillStyle.colors.categoryColorMap[category] || fillStyle.colors.defaultSegmentColor;
    }

    function estimateTextWidth(text, fontProps) {
        // Simplified: not appending to DOM as per requirements
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.font_size || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.font_weight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        try {
            return tempText.getBBox().width;
        } catch (e) { // Fallback for environments where getBBox on detached elements might fail
            return (text || "").length * (parseInt(fontProps.font_size || "12px") * 0.6);
        }
    }

    function midAngle(d) {
        return d.startAngle + (d.endAngle - d.startAngle) / 2;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.colors.chartBackground); // Optional: apply background

    // Block 4: Core Chart Dimensions & Layout Calculation
    // Margins define the drawable area INSIDE the SVG.
    // For a centered pie/donut, margins often ensure labels don't get cut off.
    const chartMargins = { 
        top: variables.marginTop || 40, 
        right: variables.marginRight || 40, 
        bottom: variables.marginBottom || 40, 
        left: variables.marginLeft || 40 
    };

    // The group for the chart itself, centered.
    // For a semicircle donut opening upwards, typically centered horizontally,
    // and vertically positioned so the base is near the bottom or mid-height.
    // Original used height/2, which centers the arc's bounding box vertically.
    const mainChartGroupX = containerWidth / 2;
    const mainChartGroupY = containerHeight / 2; // Or e.g., containerHeight - chartMargins.bottom - (radius / N)

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${mainChartGroupX}, ${mainChartGroupY})`);

    const drawableWidth = containerWidth - chartMargins.left - chartMargins.right;
    const drawableHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    // Radius calculation should consider the space needed for labels outside the arc.
    // The original used Math.min(chartWidth, chartHeight) / 2 where chartWidth/Height were already margin-adjusted.
    // Let's use a factor to keep labels from hitting SVG edges.
    const outerRadius = Math.min(drawableWidth, drawableHeight) / 2 * (variables.radiusFactor || 0.8); // 0.8 to leave space for labels
    const innerRadius = outerRadius * (variables.innerRadiusRatio || 0.75);
    const padAngle = variables.padAngle || 0.02;


    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => d[yFieldName]);
    
    const dataWithPercentages = chartDataArray.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (d[yFieldName] / totalValue) : 0
    }));

    // Block 6: Scale Definition & Configuration
    const pieGenerator = d3.pie()
        .value(d => d.percentage)
        .sort(null) // Maintain original data order
        .startAngle(-Math.PI / 2) // Semicircle top half
        .endAngle(Math.PI / 2);

    const arcGenerator = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .padAngle(padAngle);
        // .cornerRadius removed as per simplification rules

    const outerArcForLabels = d3.arc()
        .innerRadius(outerRadius * 1.1) // Position for label anchors
        .outerRadius(outerRadius * 1.1);

    const pieData = pieGenerator(dataWithPercentages);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Labels and connecting lines for the donut segments
    if (chartDataArray.length > 0 && totalValue > 0) { // Only render labels if there's data
        const labelGroups = mainChartGroup.selectAll(".label-group")
            .data(pieData)
            .enter()
            .append("g")
            .attr("class", "label label-group");

        labelGroups.append("polyline")
            .attr("class", "other polyline-connector")
            .attr("points", d => {
                const pos = arcGenerator.centroid(d);
                const midPos = outerArcForLabels.centroid(d);
                const angle = midAngle(d);
                
                const textPos = [
                    midPos[0] * 1.2, 
                    midPos[1] * 1.1  
                ];
                
                if (angle > 0) { // Right side
                    textPos[0] = Math.abs(textPos[0]);
                } else { // Left side
                    textPos[0] = -Math.abs(textPos[0]);
                }
                return [pos, midPos, textPos];
            })
            .attr("stroke", fillStyle.colors.labelLineColor)
            .attr("fill", "none")
            .attr("stroke-width", 1);

        labelGroups.append("text")
            .attr("class", "text data-label")
            .attr("transform", d => {
                const midPos = outerArcForLabels.centroid(d);
                const angle = midAngle(d);
                const textPos = [
                    midPos[0] * 1.2,
                    midPos[1] * 1.1 
                ];
                if (angle > 0) {
                    textPos[0] = Math.abs(textPos[0]);
                } else {
                    textPos[0] = -Math.abs(textPos[0]);
                }
                return `translate(${textPos})`;
            })
            .attr("text-anchor", d => midAngle(d) < 0 ? "end" : "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.colors.textColor)
            .text(d => {
                const percentage = (d.data.percentage * 100).toFixed(1) + '%';
                return `${d.data[xFieldName]}: ${percentage}`;
            });
    }
    // No legend as per simplification and missing original implementation details.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    if (chartDataArray.length > 0 && totalValue > 0) { // Only render arcs if there's data
        const arcElements = mainChartGroup.selectAll(".mark-arc")
            .data(pieData)
            .enter()
            .append("path")
            .attr("class", "mark mark-arc")
            .attr("d", arcGenerator)
            .attr("fill", d => getCategoryColor(d.data[xFieldName]));
    }
    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No optional enhancements in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}