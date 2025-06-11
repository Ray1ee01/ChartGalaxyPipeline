/* REQUIREMENTS_BEGIN
{
  "chart_type": "Circular Stacked Bar Chart",
  "chart_name": "circular_stacked_bar_chart_icons_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 20], [0, "inf"], [2, 10]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 500,
  "min_width": 500,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a circular stacked bar chart.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme preference if both exist, or just colors
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    if (!dimensionField || !valueField || !groupField) {
        const missingFields = [];
        if (!dimensionField) missingFields.push("x role field");
        if (!valueField) missingFields.push("y role field");
        if (!groupField) missingFields.push("group role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Filter out data points with missing critical fields
    const chartData = rawChartData.filter(d =>
        d[dimensionField] !== undefined && d[dimensionField] !== null &&
        d[valueField] !== undefined && d[valueField] !== null && typeof d[valueField] === 'number' &&
        d[groupField] !== undefined && d[groupField] !== null
    );
    
    if (chartData.length === 0) {
        const errorMsg = "No valid data points to render after filtering for required fields.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) ? rawTypography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) ? rawTypography.title.font_size : '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) ? rawTypography.title.font_weight : 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px', // Base size, will be scaled
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'bold', // Original used bold for value text
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF', // Not directly used for SVG background, but available
        primaryColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#084594',
        defaultCategoryColor: '#CCCCCC',
        axisLineColor: '#AAAAAA', // For central circle stroke
        groupColors: {}, // To be populated
        images: {} // To be populated for icons
    };

    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, not to DOM.
        // This method might be less accurate for some browsers/fonts without DOM attachment.
        // For simple cases or if accuracy isn't paramount, it's acceptable.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM
            return text.length * (parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.2s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.2s")(value / 1000) + "K";
        return d3.format("~.2s")(value);
    };
    
    const valueCol = dataColumns.find(col => col.role === "y");
    let valueUnit = "";
    if (valueCol && valueCol.unit && valueCol.unit !== "none") {
        valueUnit = valueCol.unit === "B" ? " B" : (valueCol.unit === "%" ? "%" : ` ${valueCol.unit}`);
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 800;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 60, bottom: 60, left: 60 }; // Adjusted for potential icon labels
    
    // Ensure the chart area is square for circular layout, based on the smaller dimension
    const effectiveSize = Math.min(containerWidth, containerHeight);

    const plotWidth = effectiveSize - chartMargins.left - chartMargins.right;
    const plotHeight = effectiveSize - chartMargins.top - chartMargins.bottom;
    
    const centerX = chartMargins.left + plotWidth / 2;
    const centerY = chartMargins.top + plotHeight / 2;
    const radius = Math.min(plotWidth, plotHeight) / 2;


    // Block 5: Data Preprocessing & Transformation
    const uniqueGroups = [...new Set(chartData.map(d => d[groupField]))].sort(); // Sort for consistent color mapping

    // Populate fillStyle.groupColors
    const availableColors = rawColors.available_colors || d3.schemeCategory10;
    uniqueGroups.forEach((group, i) => {
        if (rawColors.field && rawColors.field[group]) {
            fillStyle.groupColors[group] = rawColors.field[group];
        } else {
            fillStyle.groupColors[group] = availableColors[i % availableColors.length];
        }
    });
    
    // Populate fillStyle.images for icons (dimensionField based)
    const uniqueDimensionValues = [...new Set(chartData.map(d => d[dimensionField]))];
    uniqueDimensionValues.forEach(val => {
        if (rawImages.field && rawImages.field[val]) {
            fillStyle.images[val] = rawImages.field[val];
        }
    });


    const groupedData = d3.group(chartData, d => d[dimensionField]);
    const stackedData = Array.from(groupedData, ([category, values]) => {
        const stack = {};
        let total = 0;
        uniqueGroups.forEach(group => {
            const groupValue = values.find(v => v[groupField] === group)?.[valueField] || 0;
            stack[group] = {
                start: total,
                end: total + groupValue,
                value: groupValue
            };
            total += groupValue;
        });
        return { category, stacks: stack, total };
    });

    stackedData.sort((a, b) => b.total - a.total); // Sort by total value descending

    const totalItems = stackedData.length;
    if (totalItems === 0) { // Should have been caught by chartData.length check, but good to be safe
        console.warn("No data to render after grouping.");
        return svgRoot.node();
    }

    const anglePerItem = (2 * Math.PI) / totalItems;
    const maxValue = d3.max(stackedData, d => d.total) || 1; // Ensure maxValue is at least 1 to prevent scale issues with all-zero data

    // Block 6: Scale Definition & Configuration
    const centralCircleRadiusFactor = 0.20; // Proportion of radius for central circle
    const barStartRadiusFactor = 0.22; // Start of bars slightly outside central circle
    const barEndRadiusFactor = 0.85; // End of bars, leaving space for labels/icons

    const centralCircleRadius = radius * centralCircleRadiusFactor;
    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([radius * barStartRadiusFactor, radius * barEndRadiusFactor]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    mainChartGroup.append("circle")
        .attr("class", "mark central-circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", centralCircleRadius)
        .attr("fill", fillStyle.chartBackground) // Use chart background for center
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1.5);

    // Legend
    const legendItemHeight = 20;
    const legendRectSize = 15;
    const legendSpacing = 5;
    const legendPadding = 10;
    
    // Calculate max legend width for positioning
    let maxLegendLabelWidth = 0;
    uniqueGroups.forEach(group => {
        maxLegendLabelWidth = Math.max(maxLegendLabelWidth, estimateTextWidth(group, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        }));
    });
    const legendWidth = legendRectSize + legendSpacing + maxLegendLabelWidth + 2 * legendPadding;
    const legendHeight = uniqueGroups.length * legendItemHeight + (uniqueGroups.length -1) * legendSpacing / 2 + 2 * legendPadding;


    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${containerWidth - legendWidth - chartMargins.right + legendPadding}, ${chartMargins.top})`);

    uniqueGroups.forEach((group, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${legendPadding}, ${legendPadding + i * (legendItemHeight + legendSpacing / 2)})`);

        legendItem.append("rect")
            .attr("class", "mark legend-color-sample")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", fillStyle.groupColors[group] || fillStyle.defaultCategoryColor);

        legendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendRectSize + legendSpacing)
            .attr("y", legendRectSize / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);
    });


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const sectorsGroup = mainChartGroup.append("g").attr("class", "sectors-group");
    const endCapsGroup = mainChartGroup.append("g").attr("class", "end-caps-group"); // For circles and value text
    const categoryLabelsGroup = mainChartGroup.append("g").attr("class", "category-labels-group"); // For icons

    stackedData.forEach((d, i) => {
        const startAngle = i * anglePerItem - Math.PI / 2; // Offset by -PI/2 to start at 12 o'clock
        const endAngle = startAngle + anglePerItem;
        const midAngle = startAngle + anglePerItem / 2;

        // Render stacked segments for each group
        uniqueGroups.forEach(group => {
            const stackInfo = d.stacks[group];
            if (stackInfo && stackInfo.value > 0) {
                const innerR = radiusScale(stackInfo.start);
                const outerR = radiusScale(stackInfo.end);

                const arcGenerator = d3.arc()
                    .innerRadius(innerR)
                    .outerRadius(outerR)
                    .startAngle(startAngle)
                    .endAngle(endAngle)
                    .padAngle(0.015); // Small padding between segments

                sectorsGroup.append("path")
                    .attr("class", "mark data-segment")
                    .attr("d", arcGenerator)
                    .attr("fill", fillStyle.groupColors[group] || fillStyle.defaultCategoryColor);
            }
        });

        // Add end caps (circles with total value)
        const totalOuterRadius = radiusScale(d.total);
        const endCapRadius = Math.max(8, Math.min(15, radius * 0.05)); // Dynamic size for end cap

        const endCapX = Math.cos(midAngle) * (totalOuterRadius + endCapRadius * 0.2); // Slight offset for better visual
        const endCapY = Math.sin(midAngle) * (totalOuterRadius + endCapRadius * 0.2);

        endCapsGroup.append("circle")
            .attr("class", "mark data-value-cap")
            .attr("cx", endCapX)
            .attr("cy", endCapY)
            .attr("r", endCapRadius)
            .attr("fill", fillStyle.chartBackground)
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);

        const valueTextContent = `${formatValue(d.total)}${valueUnit}`;
        endCapsGroup.append("text")
            .attr("class", "label data-value-text")
            .attr("x", endCapX)
            .attr("y", endCapY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${Math.max(6, endCapRadius * 0.7)}px`) // Scaled font size
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(valueTextContent);

        // Block 9: Optional Enhancements & Post-Processing (Category Icons)
        const iconSize = Math.max(15, Math.min(25, radius * 0.1)); // Dynamic icon size
        const iconPadding = 5; // Padding between end cap and icon
        const iconRadius = totalOuterRadius + endCapRadius + iconPadding + iconSize / 2;
        
        const iconX = Math.cos(midAngle) * iconRadius;
        const iconY = Math.sin(midAngle) * iconRadius;

        const iconUrl = fillStyle.images[d.category];
        if (iconUrl) {
            categoryLabelsGroup.append("image")
                .attr("class", "icon category-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", iconX - iconSize / 2)
                .attr("y", iconY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
        } else {
            // Fallback to text label if icon is missing
            categoryLabelsGroup.append("text")
                .attr("class", "label category-text-label")
                .attr("x", iconX)
                .attr("y", iconY)
                .attr("text-anchor", midAngle > -Math.PI/2 && midAngle < Math.PI/2 ? "start" : "end") // Adjust anchor based on angle
                .attr("dominant-baseline", "middle")
                .attr("transform", `rotate(${midAngle * 180 / Math.PI + (midAngle > -Math.PI/2 && midAngle < Math.PI/2 ? 0 : 180)}, ${iconX}, ${iconY}) translate(${midAngle > -Math.PI/2 && midAngle < Math.PI/2 ? 5 : -5}, 0)`) // Rotate and shift
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(d.category);
        }
    });


    // Block 10: Cleanup & SVG Node Return
    // No specific cleanup needed beyond standard D3 practices.
    return svgRoot.node();
}