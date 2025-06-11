/* REQUIREMENTS_BEGIN
{
  "chart_type": "Stacked Circular Bar Chart",
  "chart_name": "stacked_circular_bar_chart_03",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const config = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    // Typography parsing with defaults
    const rawTypography = data.typography || {};
    const typography = {
        title: {
            font_family: (rawTypography.title && rawTypography.title.font_family) || "Arial, sans-serif",
            font_size: (rawTypography.title && rawTypography.title.font_size) || "16px",
            font_weight: (rawTypography.title && rawTypography.title.font_weight) || "bold",
        },
        label: {
            font_family: (rawTypography.label && rawTypography.label.font_family) || "Arial, sans-serif",
            font_size: (rawTypography.label && rawTypography.label.font_size) || "12px",
            font_weight: (rawTypography.label && rawTypography.label.font_weight) || "normal",
        },
        annotation: {
            font_family: (rawTypography.annotation && rawTypography.annotation.font_family) || "Arial, sans-serif",
            font_size: (rawTypography.annotation && rawTypography.annotation.font_size) || "10px",
            font_weight: (rawTypography.annotation && rawTypography.annotation.font_weight) || "normal",
        }
    };

    // Colors parsing with defaults
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    const colors = {
        field: rawColors.field || {},
        other: rawColors.other || {},
        available_colors: rawColors.available_colors || d3.schemeCategory10,
        background_color: rawColors.background_color || "#FFFFFF",
        text_color: rawColors.text_color || "#0f223b",
    };
    
    // Images parsing (not used in this chart, but good practice)
    // const images = data.images || {}; // No images used in this specific chart

    d3.select(containerSelector).html(""); // Clear the container

    // Critical field name derivation
    const xCol = dataColumns.find(col => col.role === "x");
    const yCol = dataColumns.find(col => col.role === "y");
    const groupCol = dataColumns.find(col => col.role === "group");

    const categoryFieldName = xCol ? xCol.name : undefined;
    const valueFieldName = yCol ? yCol.name : undefined;
    const groupFieldName = groupCol ? groupCol.name : undefined;
    
    const valueUnit = (yCol && yCol.unit && yCol.unit !== "none") ? (yCol.unit === "B" ? " B" : yCol.unit) : "";


    // Critical Identifier Validation
    const missingFields = [];
    if (!categoryFieldName) missingFields.push("x role field");
    if (!valueFieldName) missingFields.push("y role field");
    if (!groupFieldName) missingFields.push("group role field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typography.title.font_family,
            titleFontSize: typography.title.font_size,
            titleFontWeight: typography.title.font_weight,
            labelFontFamily: typography.label.font_family,
            labelFontSize: typography.label.font_size,
            labelFontWeight: typography.label.font_weight,
            annotationFontFamily: typography.annotation.font_family,
            annotationFontSize: typography.annotation.font_size,
            annotationFontWeight: typography.annotation.font_weight,
        },
        textColor: colors.text_color,
        backgroundColor: colors.background_color,
        defaultStrokeColor: "#CCCCCC",
        centralCircleFill: colors.background_color, // Use background for central circle fill
        centralCircleStroke: colors.other.secondary || "#AAAAAA",
        endCircleFill: colors.background_color,
        endCircleStroke: colors.other.secondary || "#AAAAAA",
        groupColors: {}, // To be populated later
        defaultGroupColor: "#CCCCCC"
    };

    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const { family, size, weight } = fontProps;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', family);
        tempText.setAttribute('font-size', size);
        tempText.setAttribute('font-weight', weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document body append/remove is not ideal but getBBox needs layout.
        // A better way for truly in-memory is to have a shared, hidden SVG in DOM.
        // For this exercise, we'll assume this is sufficient for "in-memory" spirit if not appended.
        // However, getBBox on non-rendered element is often 0. So, we might need to append it.
        // The prompt says "MUST NOT be appended to the document DOM". This makes getBBox tricky.
        // Let's try with a canvas context if getBBox fails without DOM.
        // Fallback: A common workaround is to append to an off-screen part of the DOM and remove.
        // Given the strict "MUST NOT", this is a conflict.
        // Let's assume `getBBox` works on an unattached element for this context, or use a canvas hack.
        // For robustness in real D3, often a hidden SVG element already in DOM is used.
        // For now, let's stick to the spec, hoping getBBox is somewhat functional.
        // If not, this part would need a more complex solution (e.g. canvas measureText).
        // Let's use a canvas-based estimator as it's truly in-memory.
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${weight} ${size} ${family}`;
        return context.measureText(text).width;
    };
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    const addAdaptiveText = (parent, text, x, y, maxWidth, fontProps) => {
        const { family, size: initialSizeStr, weight } = fontProps;
        const initialFontSize = parseInt(initialSizeStr);
        const minFontSize = Math.max(8, initialFontSize / 2); // Ensure min font size is reasonable

        let currentFontSize = initialFontSize;
        let textWidth = estimateTextWidth(text, { family, size: `${currentFontSize}px`, weight });

        // Try shrinking font size
        while (textWidth > maxWidth && currentFontSize > minFontSize) {
            currentFontSize -= 1;
            textWidth = estimateTextWidth(text, { family, size: `${currentFontSize}px`, weight });
        }
        
        const finalFontSize = currentFontSize;

        if (textWidth <= maxWidth) {
            return parent.append("text")
                .attr("class", "text label")
                .attr("x", x)
                .attr("y", y)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-family", family)
                .attr("font-size", `${finalFontSize}px`)
                .attr("font-weight", weight)
                .attr("fill", fillStyle.textColor)
                .text(text);
        }

        // If still too wide, attempt word wrapping
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const textElement = parent.append("text")
            .attr("class", "text label")
            .attr("x", x)
            .attr("y", y)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle") // Adjust y later for multi-line
            .attr("font-family", family)
            .attr("font-size", `${finalFontSize}px`)
            .attr("font-weight", weight)
            .attr("fill", fillStyle.textColor);

        let line = "";
        let lineNumber = 0;
        const lineHeight = finalFontSize * 1.1; // Approximate line height

        for (let i = 0; i < words.length; i++) {
            const testLine = line + (line ? " " : "") + words[i];
            const testWidth = estimateTextWidth(testLine, { family, size: `${finalFontSize}px`, weight });

            if (testWidth > maxWidth && i > 0 && line) { // If line is not empty
                textElement.append("tspan")
                    .attr("x", x)
                    .attr("dy", lineNumber === 0 ? 0 : lineHeight)
                    .text(line);
                line = words[i];
                lineNumber++;
            } else {
                line = testLine;
            }
        }
        
        if (line) {
             textElement.append("tspan")
                .attr("x", x)
                .attr("dy", lineNumber === 0 ? 0 : lineHeight)
                .text(line);
            lineNumber++;
        }
        
        // Adjust y position for vertical centering of multi-line text
        if (lineNumber > 1) {
            textElement.attr("y", y - (lineHeight * (lineNumber -1) / 2) );
        }
        return textElement;
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 800;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink") // Retained for general SVG practice
        .style("background-color", fillStyle.backgroundColor); // Apply background to SVG root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: config.margin_top || 90,
        right: config.margin_right || 50,
        bottom: config.margin_bottom || 60,
        left: config.margin_left || 50,
    };
    
    // Calculate actual chart area dimensions
    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = chartMargins.left + chartAreaWidth / 2;
    const centerY = chartMargins.top + chartAreaHeight / 2;
    const radius = Math.min(chartAreaWidth, chartAreaHeight) / 2;

    // Block 5: Data Preprocessing & Transformation
    const uniqueGroups = [...new Set(rawChartData.map(d => d[groupFieldName]))].sort(); // Sort for consistent color mapping

    // Populate fillStyle.groupColors
    uniqueGroups.forEach((group, i) => {
        if (colors.field && colors.field[group]) {
            fillStyle.groupColors[group] = colors.field[group];
        } else if (colors.available_colors && colors.available_colors.length > 0) {
            fillStyle.groupColors[group] = colors.available_colors[i % colors.available_colors.length];
        } else {
            fillStyle.groupColors[group] = d3.schemeCategory10[i % d3.schemeCategory10.length]; // Fallback to d3 scheme
        }
    });
    
    const groupedData = d3.group(rawChartData, d => d[categoryFieldName]);
    const stackedData = Array.from(groupedData, ([category, values]) => {
        const stack = {};
        let total = 0;
        uniqueGroups.forEach(group => {
            const groupValueObject = values.find(v => v[groupFieldName] === group);
            const groupValue = groupValueObject ? +groupValueObject[valueFieldName] : 0; // Ensure numeric
            stack[group] = {
                start: total,
                end: total + groupValue,
                value: groupValue
            };
            total += groupValue;
        });
        return {
            category,
            stacks: stack,
            total
        };
    });

    stackedData.sort((a, b) => b.total - a.total); // Sort by total value descending

    if (stackedData.length === 0) {
        svgRoot.append("text")
            .attr("class", "text label")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("fill", fillStyle.textColor)
            .text("No data to display.");
        return svgRoot.node();
    }

    const totalItems = stackedData.length;
    const anglePerItem = (2 * Math.PI) / totalItems;
    const maxValue = d3.max(stackedData, d => d.total) || 1; // Ensure maxValue is not 0 to prevent scale issues

    // Block 6: Scale Definition & Configuration
    const centralCircleRadius = radius * (config.centralCircleRadiusFactor || 0.25);
    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([centralCircleRadius + (config.barBaseMinRadiusOffset || 10), radius * (config.barMaxRadiusFactor || 0.9)]); // Added minor config points for fine-tuning if needed

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    mainChartGroup.append("circle")
        .attr("class", "mark central-circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", centralCircleRadius)
        .attr("fill", fillStyle.centralCircleFill)
        .attr("stroke", fillStyle.centralCircleStroke)
        .attr("stroke-width", 1.5);

    // Legend
    const legendItemHeight = 20;
    const legendItemGap = 5;
    const legendPadding = 10;
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${containerWidth - chartMargins.right - (config.legendWidth || 150) + legendPadding}, ${chartMargins.top + legendPadding})`);

    uniqueGroups.forEach((group, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${i * (legendItemHeight + legendItemGap)})`);

        legendItem.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendItemHeight * 0.75)
            .attr("height", legendItemHeight * 0.75)
            .attr("fill", fillStyle.groupColors[group] || fillStyle.defaultGroupColor);

        legendItem.append("text")
            .attr("class", "text label legend-label")
            .attr("x", legendItemHeight)
            .attr("y", legendItemHeight * 0.75 / 2) // Vertically center
            .attr("dy", "0.35em") // Adjustment for dominant-baseline
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(group);
    });
    
    // Block 8: Main Data Visualization Rendering
    const sectorsGroup = mainChartGroup.append("g").attr("class", "sectors-group");
    const labelsGroup = mainChartGroup.append("g").attr("class", "labels-group");

    stackedData.forEach((d, i) => {
        const startAngle = i * anglePerItem;
        const endAngle = startAngle + anglePerItem;
        const midAngle = startAngle + anglePerItem / 2 - (Math.PI / 2); // Adjust midAngle to be 0 at top

        // Render stacked sectors
        uniqueGroups.forEach(groupName => {
            const stackInfo = d.stacks[groupName];
            if (stackInfo && stackInfo.value > 0) {
                const innerR = radiusScale(stackInfo.start);
                const outerR = radiusScale(stackInfo.end);

                if (outerR > innerR) { // Ensure valid radii
                    const arcGenerator = d3.arc()
                        .innerRadius(innerR)
                        .outerRadius(outerR)
                        .startAngle(startAngle - (Math.PI / 2)) // Adjust angles for D3 arc (0 is right)
                        .endAngle(endAngle - (Math.PI / 2))
                        .padAngle(config.padAngle || 0.015);

                    sectorsGroup.append("path")
                        .attr("class", "mark sector-mark")
                        .attr("d", arcGenerator)
                        .attr("fill", fillStyle.groupColors[groupName] || fillStyle.defaultGroupColor);
                        // No stroke or shadow per "clean" style and directive V.2
                }
            }
        });

        // Add end circles and total value labels
        const totalOuterRadius = radiusScale(d.total);
        const endCircleX = Math.cos(midAngle) * totalOuterRadius;
        const endCircleY = Math.sin(midAngle) * totalOuterRadius;
        
        const endCircleRadiusValue = Math.max(config.minEndCircleRadius || 8, Math.min(config.maxEndCircleRadius || 25, radius * (config.endCircleRadiusFactor || 0.08)));

        sectorsGroup.append("circle")
            .attr("class", "mark value-circle-mark")
            .attr("cx", endCircleX)
            .attr("cy", endCircleY)
            .attr("r", endCircleRadiusValue)
            .attr("fill", fillStyle.endCircleFill)
            .attr("stroke", fillStyle.endCircleStroke)
            .attr("stroke-width", 1);

        const valueTextContent = `${formatValue(d.total)}${valueUnit}`;
        sectorsGroup.append("text")
            .attr("class", "text value data-value-text")
            .attr("x", endCircleX)
            .attr("y", endCircleY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.annotationFontFamily)
            .attr("font-size", fillStyle.typography.annotationFontSize) // Use fixed size from typography
            .attr("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(valueTextContent);

        // Add category labels
        const labelRadiusPadding = config.categoryLabelPadding || 10;
        const labelRadius = totalOuterRadius + endCircleRadiusValue + labelRadiusPadding;
        const labelX = Math.cos(midAngle) * labelRadius;
        const labelY = Math.sin(midAngle) * labelRadius;
        
        const categoryLabelMaxWidth = config.categoryLabelMaxWidth || radius * 0.2; // Dynamic max width

        addAdaptiveText(labelsGroup, d.category, labelX, labelY, categoryLabelMaxWidth, {
            family: fillStyle.typography.labelFontFamily,
            size: fillStyle.typography.labelFontSize,
            weight: fillStyle.typography.labelFontWeight
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (No specific enhancements in this refactoring beyond core chart)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}