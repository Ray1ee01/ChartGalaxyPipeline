/* REQUIREMENTS_BEGIN
{
  "chart_type": "Circular Stacked Bar Chart",
  "chart_name": "circular_stacked_bar_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 20], [0, "inf"], [2, 10]],
  "required_fields_icons": [],
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
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    // Default typography
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const typographyInput = {
        title: { ...defaultTypography.title, ...(data.typography && data.typography.title) },
        label: { ...defaultTypography.label, ...(data.typography && data.typography.label) },
        annotation: { ...defaultTypography.annotation, ...(data.typography && data.typography.annotation) }
    };

    // Default colors
    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#cccccc" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"], // d3.schemeCategory10
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };
    const colorsInput = {
        field: (data.colors && data.colors.field) || defaultColors.field,
        other: { ...defaultColors.other, ...(data.colors && data.colors.other) },
        available_colors: (data.colors && data.colors.available_colors && data.colors.available_colors.length > 0) ? [...data.colors.available_colors] : defaultColors.available_colors,
        background_color: (data.colors && data.colors.background_color) || defaultColors.background_color,
        text_color: (data.colors && data.colors.text_color) || defaultColors.text_color
    };
    
    const imagesInput = data.images || {}; // Parsed as per requirement, though not used in this chart.

    // Critical field name derivation
    const dimensionFieldRole = "x", valueFieldRole = "y", groupFieldRole = "group";
    const dimensionFieldName = dataColumns.find(col => col.role === dimensionFieldRole)?.name;
    const valueFieldName = dataColumns.find(col => col.role === valueFieldRole)?.name;
    const groupFieldName = dataColumns.find(col => col.role === groupFieldRole)?.name;

    // Critical Identifier Validation
    const missingRoles = [];
    if (!dimensionFieldName) missingRoles.push(`'${dimensionFieldRole}' (for dimension/category)`);
    if (!valueFieldName) missingRoles.push(`'${valueFieldRole}' (for value)`);
    if (!groupFieldName) missingRoles.push(`'${groupFieldRole}' (for grouping/stacking)`);

    if (missingRoles.length > 0) {
        const errorMessage = `Critical chart configuration missing: Field name(s) for role(s) ${missingRoles.join(', ')} not found in dataColumns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMessage}</div>`);
        }
        return null;
    }
    
    // Clear the container
    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyInput.title.font_family,
            titleFontSize: typographyInput.title.font_size,
            titleFontWeight: typographyInput.title.font_weight,
            labelFontFamily: typographyInput.label.font_family,
            labelFontSize: typographyInput.label.font_size,
            labelFontWeight: typographyInput.label.font_weight,
            annotationFontFamily: typographyInput.annotation.font_family,
            annotationFontSize: typographyInput.annotation.font_size, // Base size, may be overridden dynamically
            annotationFontWeight: typographyInput.annotation.font_weight,
        },
        textColor: colorsInput.text_color,
        chartBackground: colorsInput.background_color,
        primaryColor: colorsInput.other.primary,
        secondaryColor: colorsInput.other.secondary, // For neutral strokes, backgrounds
        getGroupColor: (groupName, groupIndex) => {
            if (colorsInput.field && colorsInput.field[groupName]) {
                return colorsInput.field[groupName];
            }
            // Use available_colors (which has a default of d3.schemeCategory10)
            return colorsInput.available_colors[groupIndex % colorsInput.available_colors.length];
        }
    };

    // Helper: Text width estimation (not actively used by this chart's layout but required)
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.appendChild(textElement);
        let width = 0;
        try {
            width = textElement.getComputedTextLength();
        } catch (e) {
            console.warn("Could not estimate text width for:", text, e);
            width = text.length * (parseFloat(fontSize) * 0.6); // Fallback
        }
        return width;
    }

    // Helper: Value formatting (based on original logic)
    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        let num = Number(value);
        if (isNaN(num)) return String(value);

        if (Math.abs(num) >= 1000000000) {
            return d3.format("~g")(num / 1000000000) + "B";
        } else if (Math.abs(num) >= 1000000) {
            return d3.format("~g")(num / 1000000) + "M";
        } else if (Math.abs(num) >= 1000) {
            return d3.format("~g")(num / 1000) + "K";
        }
        return d3.format("~g")(num);
    };
    
    // Unit for value field (works with the above formatValue)
    let valueFieldUnit = "";
    const valueColumn = dataColumns.find(col => col.role === valueFieldRole);
    if (valueColumn && valueColumn.unit && valueColumn.unit !== "none") {
        const unit = valueColumn.unit;
        if (unit.toUpperCase() !== "K" && unit.toUpperCase() !== "M" && unit.toUpperCase() !== "B") {
            valueFieldUnit = unit === "%" ? unit : " " + unit;
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 800;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 60, bottom: 60, left: 60 };
    const legendEnabled = variables.enable_legend !== false; // Default true
    if (legendEnabled) {
        chartMargins.right += 120; // Space for legend (approx width)
    }

    const effectiveWidth = containerWidth - chartMargins.left - chartMargins.right;
    const effectiveHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const plotRadius = Math.min(effectiveWidth, effectiveHeight) / 2;
    const plotCenterX = chartMargins.left + effectiveWidth / 2;
    const plotCenterY = chartMargins.top + effectiveHeight / 2;

    // Block 5: Data Preprocessing & Transformation
    const uniqueGroups = [...new Set(chartData.map(d => d[groupFieldName]))].sort(); 

    const groupedData = d3.group(chartData, d => d[dimensionFieldName]);
    const stackedData = Array.from(groupedData, ([category, items]) => {
        const stack = {};
        let total = 0;
        uniqueGroups.forEach(group => {
            const itemValue = items.find(it => it[groupFieldName] === group)?.[valueFieldName];
            const numericValue = itemValue !== undefined && itemValue !== null ? parseFloat(itemValue) : 0;
            
            stack[group] = {
                start: total,
                end: total + numericValue,
                value: numericValue
            };
            total += numericValue;
        });
        return { category, stacks: stack, total };
    });

    stackedData.sort((a, b) => b.total - a.total);

    if (stackedData.length === 0 || plotRadius <= 0) {
        svgRoot.append("text")
            .attr("class", "label no-data-message")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .text(plotRadius <=0 ? "Insufficient space to render chart." : "No data available to display.");
        return svgRoot.node();
    }
    
    const totalItems = stackedData.length;
    const anglePerItem = (2 * Math.PI) / totalItems;
    const maxValue = d3.max(stackedData, d => d.total);

    // Block 6: Scale Definition & Configuration
    const centralCircleMinRadius = Math.min(15, plotRadius * 0.1);
    const centralCircleFactor = 0.20;
    const centralCircleRadius = Math.max(centralCircleMinRadius, plotRadius * centralCircleFactor);
    
    const barStartOffset = Math.max(5, plotRadius * 0.05); 
    const barEndFactor = 0.9;

    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue : 1])
        .range([centralCircleRadius + barStartOffset, plotRadius * barEndFactor]);

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other") // Added 'other' for group classification
        .attr("transform", `translate(${plotCenterX}, ${plotCenterY})`);

    mainChartGroup.append("circle")
        .attr("class", "other central-background-circle")
        .attr("r", centralCircleRadius)
        .attr("fill", fillStyle.chartBackground)
        .attr("stroke", fillStyle.secondaryColor)
        .attr("stroke-width", 1.5);

    if (legendEnabled) {
        const legendItemHeight = 20;
        const legendRectSize = 14;
        const legendSpacing = 6;
        const legendX = plotCenterX + plotRadius + Math.min(30, chartMargins.right * 0.2); // Position right of circle
        const legendMaxHeight = effectiveHeight * 0.8;
        let legendY = plotCenterY - Math.min(uniqueGroups.length * legendItemHeight, legendMaxHeight) / 2;


        const legendGroup = svgRoot.append("g")
            .attr("class", "other legend")
            .attr("transform", `translate(${legendX}, ${legendY})`);

        uniqueGroups.forEach((group, i) => {
            if (i * legendItemHeight > legendMaxHeight) return; // Simple truncation if too many items

            const legendItem = legendGroup.append("g")
                .attr("class", "other legend-item")
                .attr("transform", `translate(0, ${i * legendItemHeight})`);

            legendItem.append("rect")
                .attr("class", "mark legend-mark")
                .attr("width", legendRectSize)
                .attr("height", legendRectSize)
                .attr("fill", fillStyle.getGroupColor(group, uniqueGroups.indexOf(group)));

            legendItem.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendRectSize + legendSpacing)
                .attr("y", legendRectSize / 2)
                .attr("dominant-baseline", "middle")
                .attr("font-family", fillStyle.typography.labelFontFamily)
                .attr("font-size", fillStyle.typography.labelFontSize)
                .attr("font-weight", fillStyle.typography.labelFontWeight)
                .attr("fill", fillStyle.textColor)
                .text(group);
        });
    }
    
    // Block 8: Main Data Visualization Rendering
    const sectorsGroup = mainChartGroup.append("g").attr("class", "mark sectors-group");
    const categoryLabelsGroup = mainChartGroup.append("g").attr("class", "label category-labels-group");
    const valueAnnotationsGroup = mainChartGroup.append("g").attr("class", "value value-annotations-group");

    stackedData.forEach((d, i) => {
        const itemStartAngle = i * anglePerItem;
        const itemEndAngle = itemStartAngle + anglePerItem;
        // Mid-angle for label positioning (0 degrees at top, positive clockwise)
        const itemMidAngleRad = itemStartAngle + anglePerItem / 2 - (Math.PI / 2); 

        uniqueGroups.forEach((groupName) => {
            const stackInfo = d.stacks[groupName];
            if (stackInfo && stackInfo.value > 0) {
                const innerR = radiusScale(stackInfo.start);
                const outerR = radiusScale(stackInfo.end);

                if (outerR > innerR) {
                    const arcGenerator = d3.arc()
                        .innerRadius(innerR)
                        .outerRadius(outerR)
                        .startAngle(itemStartAngle)
                        .endAngle(itemEndAngle)
                        .padAngle(0.015) 
                        .cornerRadius(0); // No rounded corners for "clean" style

                    sectorsGroup.append("path")
                        .attr("class", `mark arc-segment group-${uniqueGroups.indexOf(groupName)}`)
                        .attr("d", arcGenerator)
                        .attr("fill", fillStyle.getGroupColor(groupName, uniqueGroups.indexOf(groupName)));
                }
            }
        });
        
        const totalOuterRadiusScaled = radiusScale(d.total > 0 ? d.total : 0);
        const endCircleRadiusFactor = 0.07;
        const endCircleMinRadius = Math.min(8, plotRadius * 0.05);
        const endCircleMaxRadius = Math.min(25, plotRadius * 0.15);
        const endCircleRadius = Math.max(endCircleMinRadius, Math.min(endCircleMaxRadius, plotRadius * endCircleRadiusFactor));

        const endCircleOffset = endCircleRadius * 0.3 + 2;
        const endCircleX = Math.cos(itemMidAngleRad) * (totalOuterRadiusScaled + endCircleOffset);
        const endCircleY = Math.sin(itemMidAngleRad) * (totalOuterRadiusScaled + endCircleOffset);

        if (d.total > 0 && endCircleRadius > 1) { // Only show if total is positive and circle is visible
            valueAnnotationsGroup.append("circle")
                .attr("class", "other value-circle-background")
                .attr("cx", endCircleX)
                .attr("cy", endCircleY)
                .attr("r", endCircleRadius)
                .attr("fill", fillStyle.chartBackground)
                .attr("stroke", fillStyle.secondaryColor)
                .attr("stroke-width", 1);

            const valueText = `${formatValue(d.total)}${valueFieldUnit}`;
            const valueFontSize = Math.max(parseFloat(fillStyle.typography.annotationFontSize) * 0.7, endCircleRadius * 0.65);

            valueAnnotationsGroup.append("text")
                .attr("class", "value data-value-text")
                .attr("x", endCircleX)
                .attr("y", endCircleY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${valueFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight) // Use bold from annotation if specified, else normal
                .attr("fill", fillStyle.textColor)
                .text(valueText);
        }

        const labelPadding = Math.max(10, plotRadius * 0.05);
        const labelRadius = totalOuterRadiusScaled + (d.total > 0 && endCircleRadius > 1 ? (endCircleRadius + endCircleOffset) : 0) + labelPadding;
        const labelX = Math.cos(itemMidAngleRad) * labelRadius;
        const labelY = Math.sin(itemMidAngleRad) * labelRadius;

        const categoryText = categoryLabelsGroup.append("text")
            .attr("class", "label category-label-text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(d.category);
        
        // Adjust text anchor for labels on far left/right to improve readability
        const angleDegrees = (itemMidAngleRad * 180 / Math.PI + 360) % 360; // Normalize angle to 0-360
        if (angleDegrees > 90 && angleDegrees < 270) { // Left hemisphere
            if (angleDegrees > 170 && angleDegrees < 190) { // Close to horizontal left
                 categoryText.attr("text-anchor", "end");
            }
        } else { // Right hemisphere
            if (angleDegrees < 10 || angleDegrees > 350) { // Close to horizontal right
                 categoryText.attr("text-anchor", "start");
            }
        }
         // Adjust dominant-baseline for labels at very top or bottom
        if (angleDegrees > 260 && angleDegrees < 280) categoryText.attr("dominant-baseline", "hanging"); // Top
        if (angleDegrees > 80 && angleDegrees < 100) categoryText.attr("dominant-baseline", "alphabetic"); // Bottom

    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this simplified version)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}