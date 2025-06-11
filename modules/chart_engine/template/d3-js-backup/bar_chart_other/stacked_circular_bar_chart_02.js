/* REQUIREMENTS_BEGIN
{
  "chart_type": "Stacked Circular Bar Chart",
  "chart_name": "stacked_circular_bar_chart_02",
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
  "iconographyUsage": "categorical_markers_overlay_edge"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a stacked circular bar chart.
    // It adheres to specific styling and structural directives.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const config = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;
    const groupFieldName = (dataColumns.find(col => col.role === "group") || {}).name;

    const missingFields = [];
    if (!categoryFieldName) missingFields.push("Field with role 'x' (category)");
    if (!valueFieldName) missingFields.push("Field with role 'y' (value)");
    if (!groupFieldName) missingFields.push("Field with role 'group'");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMsg);
        return null;
    }

    const valueColumn = dataColumns.find(col => col.role === "y");
    const valueUnitSuffix = (valueColumn && valueColumn.unit && valueColumn.unit !== "none") ? ` ${valueColumn.unit}` : "";

    const uniqueGroups = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort();


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {},
        images: {}
    };

    // Typography
    fillStyle.typography.title = {
        font_family: (typographyInput.title && typographyInput.title.font_family) || 'Arial, sans-serif',
        font_size: (typographyInput.title && typographyInput.title.font_size) || '16px',
        font_weight: (typographyInput.title && typographyInput.title.font_weight) || 'bold',
    };
    fillStyle.typography.label = {
        font_family: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
        font_size: (typographyInput.label && typographyInput.label.font_size) || '12px',
        font_weight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
    };
    fillStyle.typography.annotation = {
        font_family: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
        font_size: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
        font_weight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
    };
    
    // Colors
    fillStyle.colors.textColor = colorsInput.text_color || '#333333';
    fillStyle.colors.backgroundColor = colorsInput.background_color || '#FFFFFF';
    fillStyle.colors.primaryColor = (colorsInput.other && colorsInput.other.primary) || '#084594';
    const defaultCategoricalColors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

    fillStyle.colors.groupColorMap = {};
    uniqueGroups.forEach((group, i) => {
        if (colorsInput.field && colorsInput.field[group]) {
            fillStyle.colors.groupColorMap[group] = colorsInput.field[group];
        } else if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            fillStyle.colors.groupColorMap[group] = colorsInput.available_colors[i % colorsInput.available_colors.length];
        } else {
            fillStyle.colors.groupColorMap[group] = defaultCategoricalColors[i % defaultCategoricalColors.length];
        }
    });
    fillStyle.colors.getGroupColor = (groupName) => fillStyle.colors.groupColorMap[groupName] || fillStyle.colors.primaryColor;

    // Images
    fillStyle.images.getIconUrl = (categoryName) => 
        (imagesInput.field && imagesInput.field[categoryName]) || 
        (imagesInput.other && imagesInput.other.primary) || 
        null;

    // Helper: Format value with K/M/B suffixes
    const formatValue = (value) => {
        if (value === null || value === undefined) return "N/A";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value / 1000) + "K";
        }
        return d3.format("~.2s")(value);
    };
    
    // Helper function for in-memory text measurement (as per prompt requirements)
    // This chart does not currently use estimateTextWidth for its layout calculations.
    // const estimateTextWidth = (text, fontProps) => {
    //     if (!text || !fontProps) return 0;
    //     const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    //     const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    //     tempText.setAttribute('font-family', fontProps.font_family);
    //     tempText.setAttribute('font-size', fontProps.font_size);
    //     tempText.setAttribute('font-weight', fontProps.font_weight);
    //     tempText.textContent = text;
    //     tempSvg.appendChild(tempText);
    //     try {
    //         return tempText.getBBox().width;
    //     } catch (e) {
    //         // Fallback for environments where getBBox might fail on in-memory SVGs
    //         const context = document.createElement('canvas').getContext('2d');
    //         context.font = `${fontProps.font_weight || 'normal'} ${fontProps.font_size || '12px'} ${fontProps.font_family || 'Arial, sans-serif'}`;
    //         return context.measureText(text).width;
    //     }
    // };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 800;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.colors.backgroundColor)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartSizeForCalcs = Math.min(containerWidth, containerHeight); // Use smallest dimension for circular layout basis
    const chartMargins = { top: 90, right: 50, bottom: 60, left: 50 }; // Standard margins

    const effectiveWidth = chartSizeForCalcs - chartMargins.left - chartMargins.right;
    const effectiveHeight = chartSizeForCalcs - chartMargins.top - chartMargins.bottom;
    
    // Center calculation should be based on containerWidth/Height to truly center content
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    
    const radius = Math.min(effectiveWidth, effectiveHeight) / 2;

    // Block 5: Data Preprocessing & Transformation
    const groupedDataByCategory = d3.group(chartDataArray, d => d[categoryFieldName]);
    const processedData = Array.from(groupedDataByCategory, ([category, values]) => {
        const stack = {};
        let total = 0;
        uniqueGroups.forEach(group => {
            const groupValueObject = values.find(v => v[groupFieldName] === group);
            const groupValue = groupValueObject ? parseFloat(groupValueObject[valueFieldName]) : 0;
            
            stack[group] = {
                start: total,
                end: total + groupValue,
                value: groupValue
            };
            total += groupValue;
        });
        return { category, stacks: stack, total };
    }).filter(d => d.total > 0); // Filter out categories with zero total

    processedData.sort((a, b) => b.total - a.total); // Sort by total value descending

    const totalItems = processedData.length;
    if (totalItems === 0) {
        svgRoot.append("text")
            .attr("x", centerX)
            .attr("y", centerY)
            .attr("text-anchor", "middle")
            .attr("class", "text label")
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", fillStyle.typography.label.font_size)
            .style("fill", fillStyle.colors.textColor)
            .text("No data to display after processing.");
        return svgRoot.node();
    }
    
    const anglePerItem = (1.5 * Math.PI) / totalItems; // Use 270 degrees (1.5 PI) for the arc span
    const maxValue = d3.max(processedData, d => d.total);

    // Block 6: Scale Definition & Configuration
    const barStartRadius = radius * 0.25; // Inner radius for the start of the bars
    const barMaxOuterRadius = radius * 0.85; // Max outer radius for the bars
    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([barStartRadius, barMaxOuterRadius]);

    // Block 7: Chart Component Rendering (Legend)
    const legendItemHeight = 20;
    const legendItemGap = 5;
    const legendWidth = 150; // Approximate width for legend
    const legendX = containerWidth - legendWidth - chartMargins.right + 30; // Position legend to the right
    const legendY = chartMargins.top;

    const legendGroup = svgRoot.append("g")
        .attr("class", "other legend")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    uniqueGroups.forEach((group, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "other legend-item")
            .attr("transform", `translate(0, ${i * (legendItemHeight + legendItemGap)})`);

        legendItem.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendItemHeight * 0.75)
            .attr("height", legendItemHeight * 0.75)
            .style("fill", fillStyle.colors.getGroupColor(group));

        legendItem.append("text")
            .attr("class", "text label legend-label")
            .attr("x", legendItemHeight)
            .attr("y", legendItemHeight * 0.75 / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", fillStyle.typography.label.font_size)
            .style("fill", fillStyle.colors.textColor)
            .text(group);
    });

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other main-chart-group")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    const sectorsGroup = mainChartGroup.append("g").attr("class", "other sectors-group");
    const labelsAndIconsGroup = mainChartGroup.append("g").attr("class", "other labels-icons-group");

    processedData.forEach((d, i) => {
        const startAngle = i * anglePerItem - (Math.PI / 2); // Start from top (adjust by -PI/2)
        const endAngle = startAngle + anglePerItem;
        const midAngle = startAngle + (anglePerItem / 2);

        // Render stacked sectors
        uniqueGroups.forEach(group => {
            const stack = d.stacks[group];
            if (stack && stack.value > 0) {
                const arcInnerRadius = radiusScale(stack.start);
                const arcOuterRadius = radiusScale(stack.end);

                const arcGenerator = d3.arc()
                    .innerRadius(arcInnerRadius)
                    .outerRadius(arcOuterRadius)
                    .startAngle(startAngle)
                    .endAngle(endAngle)
                    .padAngle(0.015) // Small padding between arcs
                    .cornerRadius(config.has_rounded_corners ? Math.min(5, (arcOuterRadius - arcInnerRadius)/2) : 0); // Simplified rounding

                sectorsGroup.append("path")
                    .attr("class", "mark data-sector")
                    .attr("d", arcGenerator)
                    .style("fill", fillStyle.colors.getGroupColor(group));
            }
        });

        // Render end circles and value labels
        const currentOuterRadiusForEndpoints = radiusScale(d.total);
        const endCircleX = Math.sin(midAngle) * currentOuterRadiusForEndpoints;
        const endCircleY = -Math.cos(midAngle) * currentOuterRadiusForEndpoints;
        const endCircleRadius = Math.max(8, Math.min(20, radius * 0.08)); // Adjusted size

        sectorsGroup.append("circle")
            .attr("class", "mark endpoint-circle")
            .attr("cx", endCircleX)
            .attr("cy", endCircleY)
            .attr("r", endCircleRadius)
            .style("fill", fillStyle.colors.backgroundColor) // Use background color for contrast
            .style("stroke", "#AAAAAA")
            .style("stroke-width", 1);

        const valueText = `${formatValue(d.total)}${valueUnitSuffix}`;
        const labelRadiusOffset = endCircleRadius + 15; // Distance from end circle
        const labelPositionRadius = currentOuterRadiusForEndpoints + labelRadiusOffset;
        const labelX = Math.sin(midAngle) * labelPositionRadius;
        const labelY = -Math.cos(midAngle) * labelPositionRadius;
        
        labelsAndIconsGroup.append("text")
            .attr("class", "text label value-label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotation.font_family)
            .style("font-size", fillStyle.typography.annotation.font_size)
            .style("font-weight", fillStyle.typography.annotation.font_weight || "bold")
            .style("fill", fillStyle.colors.textColor)
            .text(valueText);

        // Block 9: Optional Enhancements & Post-Processing (Icons)
        const iconUrl = fillStyle.images.getIconUrl(d.category);
        if (iconUrl) {
            const iconSize = endCircleRadius * 1.4; // Icon slightly larger than circle radius
            labelsAndIconsGroup.append("image")
                .attr("class", "image icon category-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", endCircleX - iconSize / 2)
                .attr("y", endCircleY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}