/* REQUIREMENTS_BEGIN
{
  "chart_type": "Semicircle Pie Chart",
  "chart_name": "semicircle_pie_chart_01_d3",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_edge"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (Handled by the external block)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("category field (role 'x')");
        if (!valueFieldName) missingFields.push("value field (role 'y')");
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }
    
    const chartDataArray = chartDataInput.filter(
        d => d[valueFieldName] != null && typeof d[valueFieldName] === 'number' && d[valueFieldName] >= 0 && d[categoryFieldName] != null
    );

    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points (non-negative numerical values and categories) to render.";
        console.warn(errorMsg); // Use warn as it's a data issue, not a config one.
        d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        categoryColors: {},
        categoryImages: {},
        defaultCategoryColor: '#CCCCCC',
        primaryAccent: colorsConfig.other?.primary || '#4682B4',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        textColor: colorsConfig.text_color || '#333333',
        iconStrokeColor: colorsConfig.other?.primary || '#4682B4',
        iconBackgroundColor: '#FFFFFF',
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyConfig.title?.font_size || '16px',
            titleFontWeight: typographyConfig.title?.font_weight || 'bold',
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        }
    };

    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    categories.forEach((cat, i) => {
        fillStyle.categoryColors[cat] = (colorsConfig.field && colorsConfig.field[cat]) 
                                       ? colorsConfig.field[cat]
                                       : (colorsConfig.available_colors && colorsConfig.available_colors.length > 0
                                         ? colorsConfig.available_colors[i % colorsConfig.available_colors.length]
                                         : d3.schemeCategory10[i % d3.schemeCategory10.length]);
        if (imagesConfig.field && imagesConfig.field[cat]) {
            fillStyle.categoryImages[cat] = imagesConfig.field[cat];
        }
    });
    
    function estimateTextDimensions(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // No styling needed for tempSvg itself if not appending to DOM
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText); // Append to in-memory SVG
        try {
            // getBBox on an unattached SVG element might not be universally reliable
            // but is requested by directive III.2
            const bbox = tempText.getBBox();
            return { width: bbox.width, height: bbox.height };
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements is problematic
            const fontSizePx = parseFloat(fontProps.fontSize || fillStyle.typography.labelFontSize) || 12;
            const avgCharWidth = fontSizePx * 0.6; // Rough estimate
            const height = fontSizePx * 1.2; // Rough estimate
            return { width: text.length * avgCharWidth, height: height };
        }
    }

    function getBrightness(hexColor) {
        if (!hexColor || typeof hexColor !== 'string' || !hexColor.startsWith('#') || (hexColor.length !== 4 && hexColor.length !== 7)) {
            return 128; // Default to mid-brightness for invalid colors
        }
        let color = hexColor.substring(1);
        if (color.length === 3) {
            color = color.split('').map(char => char + char).join('');
        }
        const rgb = parseInt(color, 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = (rgb >> 0) & 0xff;
        return (r * 299 + g * 587 + b * 114) / 1000;
    }

    function fitTextToWidth(text, baseFontSize, maxWidth, fontFamily, fontWeight) {
        let currentText = String(text); // Ensure text is a string
        let currentFontSize = parseFloat(baseFontSize);
        const minFontSize = 8; // px

        let dimensions = estimateTextDimensions(currentText, { fontSize: `${currentFontSize}px`, fontFamily, fontWeight });

        while (dimensions.width > maxWidth && currentFontSize > minFontSize) {
            currentFontSize -= 1;
            dimensions = estimateTextDimensions(currentText, { fontSize: `${currentFontSize}px`, fontFamily, fontWeight });
        }
        
        if (dimensions.width > maxWidth) {
            // Estimate character width based on current (possibly reduced) font size
            const avgCharWidth = currentText.length > 0 ? dimensions.width / currentText.length : (currentFontSize * 0.6);
            let maxChars = Math.floor(maxWidth / avgCharWidth);
            
            if (maxChars <= 2) { // Need space for "..."
                 currentText = maxChars === 2 ? ".." : (maxChars === 1 ? "." : ""); // Minimal representation
            } else {
                 currentText = currentText.substring(0, maxChars - 3) + "...";
            }
            dimensions = estimateTextDimensions(currentText, { fontSize: `${currentFontSize}px`, fontFamily, fontWeight });
        }
        return { text: currentText, fontSize: `${currentFontSize}px`, width: dimensions.width, height: dimensions.height };
    }
    
    // Simplified label positioning. The original chart had very complex logic here.
    // This version places labels near the centroid of an arc segment within the slice.
    // It includes a basic check against icon collision but is not as exhaustive as the original.
    function calculateLabelPosition(d, iconCentroid, iconWidth, labelArcRadius, textWidth, textHeight) {
        const angle = (d.startAngle + d.endAngle) / 2; // Mid-angle of the slice
        
        // Standard D3 pie chart coordinates: 0 angle is up, positive angle clockwise.
        // x = R * sin(angle), y = R * -cos(angle)
        let x = Math.sin(angle) * labelArcRadius;
        let y = -Math.cos(angle) * labelArcRadius;

        if (iconCentroid && iconWidth > 0) {
            const dx = x - iconCentroid[0];
            const dy = y - iconCentroid[1];
            const distToIconCenter = Math.sqrt(dx*dx + dy*dy);
            const requiredSeparation = (iconWidth / 2) + (Math.max(textWidth, textHeight) / 2) + 5; // 5px buffer

            if (distToIconCenter < requiredSeparation) {
                // Attempt to push label further along its radial line, away from icon
                const pushFactor = requiredSeparation / distToIconCenter;
                x *= pushFactor;
                y *= pushFactor;
            }
        }
        return [x, y];
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);
    
    let defs = svgRoot.select("defs");
    if (defs.empty()) {
        defs = svgRoot.append("defs");
    }

    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 };
    const legendItemHeight = 20;
    const legendMaxHeight = variables.show_legend === false ? 0 : legendItemHeight * 2.5; // Allow for ~2 lines of legend
    chartMargins.top += legendMaxHeight;

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${containerWidth / 2}, ${chartMargins.top + innerHeight})`)
        .attr("class", "main-chart-group");

    const maxRadius = Math.min(innerWidth / 2, innerHeight) * 0.95; // Use most of the available space

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => d[valueFieldName]);
    const dataWithPercentages = chartDataArray.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (d[valueFieldName] / totalValue) * 100 : 0
    }));

    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null)
        .startAngle(-Math.PI / 2)
        .endAngle(Math.PI / 2);

    const pieSectors = pieGenerator(dataWithPercentages);

    // Block 6: Scale Definition & Configuration
    const arcGenerator = d3.arc()
        .innerRadius(variables.inner_radius_ratio != null ? maxRadius * Math.max(0, Math.min(0.9, variables.inner_radius_ratio)) : 0) // Allow configurable inner radius for donut
        .outerRadius(maxRadius)
        .padAngle(0.01)
        .cornerRadius(0);

    const iconArcRadius = maxRadius * 1.05; // Icons slightly outside the main pie
    const iconOuterArcGenerator = d3.arc()
        .innerRadius(iconArcRadius)
        .outerRadius(iconArcRadius);
        
    const labelArcRadius = maxRadius * ( (variables.inner_radius_ratio || 0) + (1-(variables.inner_radius_ratio || 0)) * 0.65 ); // Place labels within the outer part of the slice

    // Block 7: Chart Component Rendering (Legend)
    if (variables.show_legend !== false && categories.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend axis") // 'axis' for role, though it's a legend
            .attr("transform", `translate(${chartMargins.left / 2}, 15)`);

        let currentX = 0;
        let currentY = 0;
        const legendPadding = 5;
        const legendRectSize = parseFloat(fillStyle.typography.labelFontSize) * 0.8 || 10;

        categories.forEach((category) => {
            const textMetrics = estimateTextDimensions(category, { fontSize: fillStyle.typography.labelFontSize, fontFamily: fillStyle.typography.labelFontFamily });
            const itemWidth = legendRectSize + legendPadding + textMetrics.width + legendPadding * 2;

            if (currentX + itemWidth > containerWidth - chartMargins.left / 2 - chartMargins.right / 2 && currentX > 0) {
                currentX = 0;
                currentY += legendItemHeight;
            }
            // Stop adding legend items if they overflow available legend height
            if (currentY + legendItemHeight > legendMaxHeight) return;


            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item other") // 'other' for role
                .attr("transform", `translate(${currentX}, ${currentY})`);

            legendItem.append("rect")
                .attr("x", 0)
                .attr("y", (legendItemHeight - legendRectSize) / 2)
                .attr("width", legendRectSize)
                .attr("height", legendRectSize)
                .attr("fill", fillStyle.categoryColors[category] || fillStyle.defaultCategoryColor)
                .attr("class", "mark");

            legendItem.append("text")
                .attr("x", legendRectSize + legendPadding)
                .attr("y", legendItemHeight / 2)
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(category)
                .attr("class", "label");
            
            currentX += itemWidth;
        });
    }

    // Block 8: Main Data Visualization Rendering
    const sliceGroups = mainChartGroup.selectAll(".slice-group")
        .data(pieSectors)
        .enter()
        .append("g")
        .attr("class", "slice-group mark"); // Role 'mark' for the group representing a data item

    sliceGroups.append("path")
        .attr("d", arcGenerator)
        .attr("fill", d => fillStyle.categoryColors[d.data[categoryFieldName]] || fillStyle.defaultCategoryColor)
        .attr("stroke", getBrightness(fillStyle.chartBackground) > 128 ? '#FFF' : '#CCC') // Use contrasting stroke for definition
        .style("stroke-width", "1px")
        .attr("class", "mark");

    const iconInfos = [];

    sliceGroups.each(function(d, i) {
        const sliceGroup = d3.select(this);
        const category = d.data[categoryFieldName];
        const iconUrl = fillStyle.categoryImages[category];
        let currentIconInfo = null;

        if (iconUrl && d.data.percentage > 0.5) { // Only show icon if slice is somewhat visible
            const [iconX, iconY] = iconOuterArcGenerator.centroid(d);
            const sliceAngleSpan = d.endAngle - d.startAngle;
            let iconSize = Math.min(sliceAngleSpan * iconArcRadius * 0.4, maxRadius * 0.15, 25);
            iconSize = Math.max(iconSize, 10);

            const clipId = `clip-${containerSelector.replace(/[^a-zA-Z0-9]/g, '')}-icon-${i}`;

            defs.append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("cx", iconX) // Relative to sliceGroup, but iconOuterArcGenerator gives coords relative to mainChartGroup
                .attr("cy", iconY)
                .attr("r", iconSize / 2);

            sliceGroup.append("circle")
                .attr("cx", iconX)
                .attr("cy", iconY)
                .attr("r", iconSize / 2 + 1.5)
                .attr("fill", fillStyle.iconBackgroundColor)
                .attr("stroke", fillStyle.categoryColors[category] || fillStyle.defaultCategoryColor)
                .attr("stroke-width", 1)
                .attr("class", "icon other"); // Role 'icon' and 'other'

            sliceGroup.append("image")
                .attr("xlink:href", iconUrl)
                .attr("x", iconX - iconSize / 2)
                .attr("y", iconY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("clip-path", `url(#${clipId})`)
                .attr("class", "icon image");
            
            currentIconInfo = { centroid: [iconX, iconY], width: iconSize };
        }
        iconInfos.push(currentIconInfo); // Store info or null

        // Data Labels
        if (d.data.percentage >= (variables.min_percentage_for_label || 1)) {
            const sliceColor = fillStyle.categoryColors[category] || fillStyle.defaultCategoryColor;
            const labelTextColor = getBrightness(sliceColor) < 128 ? '#FFFFFF' : fillStyle.textColor;

            const textCategoryRaw = category;
            const textNumericalRaw = `${d.data.percentage.toFixed(1)}%`;
            
            const angleSpan = d.endAngle - d.startAngle;
            const approxLabelWidthLimit = Math.max(angleSpan * labelArcRadius * 0.7, 30); // Min 30px width

            const categoryFontProps = {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            };
            const numericalFontProps = {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: `${parseFloat(fillStyle.typography.labelFontSize) * 0.9}px`,
                fontWeight: fillStyle.typography.labelFontWeight
            };

            const fittedCategory = fitTextToWidth(textCategoryRaw, categoryFontProps.fontSize, approxLabelWidthLimit, categoryFontProps.fontFamily, categoryFontProps.fontWeight);
            const fittedNumerical = fitTextToWidth(textNumericalRaw, numericalFontProps.fontSize, approxLabelWidthLimit, numericalFontProps.fontFamily, numericalFontProps.fontWeight);
            
            const labelTextHeight = fittedCategory.height + fittedNumerical.height + 2;
            const labelTextWidth = Math.max(fittedCategory.width, fittedNumerical.width);

            const [labelX, labelY] = calculateLabelPosition(
                d,
                currentIconInfo ? currentIconInfo.centroid : null,
                currentIconInfo ? currentIconInfo.width : 0,
                labelArcRadius,
                labelTextWidth,
                labelTextHeight
            );

            const textGroup = sliceGroup.append("g")
                .attr("transform", `translate(${labelX}, ${labelY})`)
                .attr("class", "data-label-group");

            textGroup.append("text")
                .attr("class", "label value") // Role 'label' and 'value'
                .attr("text-anchor", "middle")
                .attr("dy", -fittedNumerical.height / 2 + fittedCategory.height / 2 - fittedCategory.height/2) // Center first line
                .style("font-family", categoryFontProps.fontFamily)
                .style("font-size", fittedCategory.fontSize)
                .style("font-weight", categoryFontProps.fontWeight)
                .style("fill", labelTextColor)
                .text(fittedCategory.text);

            textGroup.append("text")
                .attr("class", "label value") // Role 'label' and 'value'
                .attr("text-anchor", "middle")
                .attr("dy", fittedCategory.height / 2 + 2 + fittedNumerical.height/2 - fittedNumerical.height/2) // Center second line, with spacing
                .style("font-family", numericalFontProps.fontFamily)
                .style("font-size", fittedNumerical.fontSize)
                .style("font-weight", numericalFontProps.fontWeight)
                .style("fill", labelTextColor)
                .text(fittedNumerical.text);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactoring)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}