/* REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_chart_icons_01",
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
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_edge"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is external to this function)

    // Block 1: Configuration Parsing & Validation
    d3.select(containerSelector).html(""); // Clear container

    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const dataColumns = data.data?.columns || [];

    const typographyInput = data.typography || {};
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const typography = {
        title: { ...defaultTypography.title, ...(typographyInput.title || {}) },
        label: { ...defaultTypography.label, ...(typographyInput.label || {}) },
        annotation: { ...defaultTypography.annotation, ...(typographyInput.annotation || {}) }
    };

    const colorsInput = data.colors || (data.colors_dark || {});
     const defaultColors = {
        field: {},
        other: { primary: "#4682B4", secondary: "#ff7f0e" },
        available_colors: [...d3.schemeCategory10],
        background_color: "#FFFFFF",
        text_color: "#333333"
    };
    const colors = {
        field: colorsInput.field || defaultColors.field,
        other: { ...defaultColors.other, ...(colorsInput.other || {}) },
        available_colors: colorsInput.available_colors && colorsInput.available_colors.length > 0 ? colorsInput.available_colors : defaultColors.available_colors,
        background_color: colorsInput.background_color || defaultColors.background_color,
        text_color: colorsInput.text_color || defaultColors.text_color
    };
    
    const images = data.images || { field: {}, other: {} };

    const categoryFieldName = dataColumns.find(col => col.role === 'x')?.name;
    const valueFieldName = dataColumns.find(col => col.role === 'y')?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    // Filter out data points with missing or invalid critical fields if necessary
    const chartDataArray = chartDataInput.filter(d => d[categoryFieldName] != null && typeof d[valueFieldName] === 'number' && d[valueFieldName] >= 0);
    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data to render the chart.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        chartBackground: colors.background_color,
        textColor: colors.text_color,
        segmentColor: (categoryName, index) => {
            if (colors.field && colors.field[categoryName]) {
                return colors.field[categoryName];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return d3.schemeCategory10[index % 10]; // Fallback
        },
        iconUrl: (categoryName) => {
            if (images.field && images.field[categoryName]) {
                return images.field[categoryName];
            }
            // No generic fallback for category-specific icons unless specified
            return null;
        },
        iconStrokeColor: (categoryName, index) => {
            // Use segment color for icon stroke for consistency
            return fillStyle.segmentColor(categoryName, index);
        },
        iconBackgroundColor: '#FFFFFF',
        typography: {
            label: {
                fontFamily: typography.label.font_family,
                fontSize: typography.label.font_size,
                fontWeight: typography.label.font_weight,
            },
            annotation: { // Used for min font size in text fitting
                fontFamily: typography.annotation.font_family,
                fontSize: typography.annotation.font_size,
                fontWeight: typography.annotation.font_weight,
            }
        }
    };

    function estimateTextWidth(text, fontProps) {
        if (!text || text.trim() === "") return 0;
        const { fontFamily, fontSize, fontWeight } = fontProps;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // Note: Appending to body and then getting BBox is more reliable across browsers
        // but per directive, "MUST NOT be appended to the document DOM".
        // For simple text, getBBox without appending might work in some environments.
        // If issues arise, a hidden SVG in the main containerSelector could be used.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements fails
            const avgCharWidth = parseFloat(fontSize) * 0.6; // Rough estimate
            return text.length * avgCharWidth;
        }
    }

    function estimateTextDimensions(text, fontProps) {
        const width = estimateTextWidth(text, fontProps);
        const fontSizeNumeric = parseFloat(fontProps.fontSize);
        const height = fontSizeNumeric * 1.2; // Estimated line height
        return { width, height, fontProps };
    }
    
    function calculateSectorMaxWidth(d, radius) {
        const sectorAngle = d.endAngle - d.startAngle;
        return sectorAngle * radius * 0.8; // 80% of arc length at radius
    }

    function fitTextToWidth(text, initialFontProps, maxWidth) {
        let currentText = text;
        let currentFontProps = { ...initialFontProps };
        let dimensions = estimateTextDimensions(currentText, currentFontProps);

        const minFontSizeNumeric = parseFloat(fillStyle.typography.annotation.fontSize || '10px');

        // Try reducing font size
        while (dimensions.width > maxWidth && parseFloat(currentFontProps.fontSize) > minFontSizeNumeric) {
            const newFontSizeNumeric = Math.max(minFontSizeNumeric, parseFloat(currentFontProps.fontSize) - 1); // Reduce by 1px
            currentFontProps.fontSize = `${newFontSizeNumeric}px`;
            dimensions = estimateTextDimensions(currentText, currentFontProps);
            if (newFontSizeNumeric === minFontSizeNumeric && dimensions.width > maxWidth) break; // Stop if at min font and still too wide
        }
        
        // If still too wide, truncate text
        if (dimensions.width > maxWidth) {
            const avgCharWidth = estimateTextWidth("M", currentFontProps); // Get width of a typical character
            if (avgCharWidth > 0) {
                 let maxChars = Math.floor(maxWidth / avgCharWidth);
                 if (maxChars <= 3) currentText = "..."; // Not enough space
                 else currentText = text.substring(0, maxChars - 2) + "..."; // Leave space for ellipsis
            } else { // Fallback if avgCharWidth is 0
                 currentText = "...";
            }
            dimensions = estimateTextDimensions(currentText, currentFontProps);
        }
        return { text: currentText, fontProps: currentFontProps, dimensions };
    }

    // Complex label positioning logic, preserved from original as it's core to visual output
    function calculateLabelPosition(d, iconCentroid, iconWidth, labelSearchInnerRadius, labelSearchOuterRadius, textWidth, textHeight) {
        const angle = (d.startAngle + d.endAngle) / 2;
        const labelRadius = (labelSearchInnerRadius + labelSearchOuterRadius) / 2;
        let x = Math.sin(angle) * labelRadius;
        let y = -Math.cos(angle) * labelRadius;

        const textBBox = { x: x - textWidth / 2, y: y - textHeight / 2, width: textWidth, height: textHeight };
        const iconBBox = { x: iconCentroid[0] - iconWidth / 2, y: iconCentroid[1] - iconWidth / 2, width: iconWidth, height: iconWidth };

        let overlapX = Math.max(0, Math.min(textBBox.x + textBBox.width, iconBBox.x + iconBBox.width) - Math.max(textBBox.x, iconBBox.x));
        let overlapY = Math.max(0, Math.min(textBBox.y + textBBox.height, iconBBox.y + iconBBox.height) - Math.max(textBBox.y, iconBBox.y));
        const overlap = overlapX > 0 && overlapY > 0;

        if (overlap) {
            const overlapArea = overlapX * overlapY;
            const textArea = textWidth * textHeight;
            const overlapRatio = textArea > 0 ? overlapArea / textArea : 1;
            
            const minSafeDistance = iconWidth / 2 + 5;
            const additionalDistance = Math.max(30 * overlapRatio, 10);
            const safetyDistance = minSafeDistance + additionalDistance;
            
            const currentDistanceToIconCenter = Math.sqrt(Math.pow(x - iconCentroid[0], 2) + Math.pow(y - iconCentroid[1], 2));

            if (currentDistanceToIconCenter < safetyDistance) {
                let bestPosition = null;
                let minDeviationFromIdeal = Infinity;

                const searchSteps = 16;
                const sectorAngleWidth = d.endAngle - d.startAngle;
                const angularSearchRange = Math.max(Math.min(Math.PI / 4, sectorAngleWidth * 0.7), Math.PI / 12);
                const angularStep = angularSearchRange / searchSteps;
                
                const radiusVariations = [labelRadius * 0.85, labelRadius, labelRadius * 1.15, labelRadius * 1.3];

                for (let i = -searchSteps; i <= searchSteps; i++) {
                    const offsetAngle = angle + i * angularStep;
                    for (const testRadius of radiusVariations) {
                        if (testRadius < labelSearchInnerRadius * 0.8 || testRadius > labelSearchOuterRadius * 1.2) continue; // Bound search radius

                        const newX = Math.sin(offsetAngle) * testRadius;
                        const newY = -Math.cos(offsetAngle) * testRadius;
                        const newTextBBox = { x: newX - textWidth / 2, y: newY - textHeight / 2, width: textWidth, height: textHeight };
                        
                        const newOverlapX = Math.max(0, Math.min(newTextBBox.x + newTextBBox.width, iconBBox.x + iconBBox.width) - Math.max(newTextBBox.x, iconBBox.x));
                        const newOverlapY = Math.max(0, Math.min(newTextBBox.y + newTextBBox.height, iconBBox.y + iconBBox.height) - Math.max(newTextBBox.y, iconBBox.y));
                        
                        if (!(newOverlapX > 0 && newOverlapY > 0)) { // No overlap
                            const idealX = Math.sin(angle) * labelRadius;
                            const idealY = -Math.cos(angle) * labelRadius;
                            const deviation = Math.sqrt(Math.pow(newX - idealX, 2) + Math.pow(newY - idealY, 2));
                            if (deviation < minDeviationFromIdeal) {
                                minDeviationFromIdeal = deviation;
                                bestPosition = [newX, newY];
                            }
                        }
                    }
                }
                if (bestPosition) return bestPosition;

                // Fallback: push radially if no non-overlapping spot found by angular search
                const pushFactor = (safetyDistance - currentDistanceToIconCenter + 5) / currentDistanceToIconCenter;
                if (currentDistanceToIconCenter > 0.1) { // Avoid division by zero or tiny numbers
                     x = x * (1 + pushFactor);
                     y = y * (1 + pushFactor);
                } else { // If label is right on top of icon center, push along original angle but further out
                     x = Math.sin(angle) * (labelRadius + safetyDistance);
                     y = -Math.cos(angle) * (labelRadius + safetyDistance);
                }
            }
        }
        return [x, y];
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Reduced margins as no axes/titles
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    const maxRadius = Math.min(chartWidth, chartHeight) / 2 * 0.9; // 0.9 to leave some padding
    const innerRadiusRatio = 0.5; // Standard donut hole size
    const donutInnerRadius = maxRadius * innerRadiusRatio;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group other");

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => d[valueFieldName]);
    const processedData = chartDataArray.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (d[valueFieldName] / totalValue) * 100 : 0
    }));

    // Block 6: Scale Definition & Configuration
    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null); // Preserve original data order

    const arcGenerator = d3.arc()
        .innerRadius(donutInnerRadius)
        .outerRadius(maxRadius)
        .padAngle(0.01); // Small padAngle for segment separation

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type as per simplification.

    // Block 8: Main Data Visualization Rendering
    const pieSectors = pieGenerator(processedData);

    pieSectors.forEach((d, i) => {
        const segmentGroup = mainChartGroup.append("g").attr("class", "segment-group other");
        const categoryName = d.data[categoryFieldName];
        const segmentColor = fillStyle.segmentColor(categoryName, i);

        segmentGroup.append("path")
            .attr("d", arcGenerator(d))
            .attr("fill", segmentColor)
            .attr("class", "mark");

        // Icon rendering
        const iconUrl = fillStyle.iconUrl(categoryName);
        if (iconUrl) {
            const segmentAngleWidth = d.endAngle - d.startAngle;
            const outerArcLength = segmentAngleWidth * maxRadius;
            
            let iconNominalWidth = Math.min(outerArcLength / 2.5, maxRadius * 0.25, 50); // Adjusted sizing logic
            iconNominalWidth = Math.max(iconNominalWidth, 15); // Minimum icon size

            let iconActualRadius, iconCentroid;
            // Position icons slightly outside the donut segments
            const iconPlacementRadius = maxRadius + iconNominalWidth * 0.3 + 5; // Base radius for icon center
            
            const tempIconArc = d3.arc().innerRadius(iconPlacementRadius).outerRadius(iconPlacementRadius);
            iconCentroid = tempIconArc.centroid(d);

            const clipId = `icon-clip-${i}`;
            defs.append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("cx", iconCentroid[0])
                .attr("cy", iconCentroid[1])
                .attr("r", iconNominalWidth / 2);

            segmentGroup.append("circle")
                .attr("cx", iconCentroid[0])
                .attr("cy", iconCentroid[1])
                .attr("r", iconNominalWidth / 2 + 2) // Background circle slightly larger
                .attr("fill", fillStyle.iconBackgroundColor)
                .attr("stroke", fillStyle.iconStrokeColor(categoryName, i))
                .attr("stroke-width", 1.5)
                .attr("class", "icon-background other");

            segmentGroup.append("image")
                .attr("href", iconUrl)
                .attr("x", iconCentroid[0] - iconNominalWidth / 2)
                .attr("y", iconCentroid[1] - iconNominalWidth / 2)
                .attr("width", iconNominalWidth)
                .attr("height", iconNominalWidth)
                .attr("clip-path", `url(#${clipId})`)
                .attr("class", "icon");

            // Data Label Rendering
            let displayTextCategory = String(d.data[categoryFieldName]);
            let displayTextNumerical = d.data.percentage >= 0.1 ? `${d.data.percentage.toFixed(1)}%` : ''; // Show value if percentage is small
            if (d.data.percentage < 0.1 && d.data[valueFieldName] > 0) displayTextNumerical = `${d.data[valueFieldName]}`; // Show raw value if % is tiny but value exists
            else if (d.data.percentage < 0.1) displayTextNumerical = ''; // Hide if effectively zero

            const initialCategoryFontProps = { ...fillStyle.typography.label };
            const initialNumericalFontProps = { ...fillStyle.typography.label, fontSize: `${parseFloat(fillStyle.typography.label.fontSize) * 0.9}px` }; // Slightly smaller for numerical

            // Max width for labels is tricky; consider segment width at mid-radius of label search area
            const labelSearchInnerRadius = donutInnerRadius * 0.8;
            const labelSearchOuterRadius = maxRadius * 1.2; // Allow labels inside and slightly outside donut
            const midLabelSearchRadius = (labelSearchInnerRadius + labelSearchOuterRadius) / 2;
            const maxLabelWidth = calculateSectorMaxWidth(d, midLabelSearchRadius);
            
            const fittedCategory = fitTextToWidth(displayTextCategory, initialCategoryFontProps, maxLabelWidth);
            const fittedNumerical = fitTextToWidth(displayTextNumerical, initialNumericalFontProps, maxLabelWidth);

            const categoryLabelHeight = fittedCategory.dimensions.height;
            const numericalLabelHeight = displayTextNumerical ? fittedNumerical.dimensions.height : 0;
            const totalLabelHeight = categoryLabelHeight + (displayTextNumerical ? numericalLabelHeight + 2 : 0); // 2px spacing
            const combinedLabelWidth = Math.max(fittedCategory.dimensions.width, fittedNumerical.dimensions.width);

            if (combinedLabelWidth > 5 && totalLabelHeight > 5) { // Only render if there's something to show
                const [labelX, labelY] = calculateLabelPosition(d, iconCentroid, iconNominalWidth, labelSearchInnerRadius, labelSearchOuterRadius, combinedLabelWidth, totalLabelHeight);

                const labelGroup = segmentGroup.append("g")
                    .attr("transform", `translate(${labelX}, ${labelY})`)
                    .attr("class", "data-label-group other");

                labelGroup.append("text")
                    .attr("class", "label category-label")
                    .attr("text-anchor", "middle")
                    .attr("dy", displayTextNumerical ? -numericalLabelHeight / 2 -1 : "0.35em") // Adjust dy based on presence of numerical line
                    .style("font-family", fittedCategory.fontProps.fontFamily)
                    .style("font-size", fittedCategory.fontProps.fontSize)
                    .style("font-weight", fittedCategory.fontProps.fontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(fittedCategory.text);

                if (displayTextNumerical) {
                    labelGroup.append("text")
                        .attr("class", "label numerical-label")
                        .attr("text-anchor", "middle")
                        .attr("dy", categoryLabelHeight / 2 + 1) // Position below category
                        .style("font-family", fittedNumerical.fontProps.fontFamily)
                        .style("font-size", fittedNumerical.fontProps.fontSize)
                        .style("font-weight", fittedNumerical.fontProps.fontWeight)
                        .style("fill", fillStyle.textColor)
                        .text(fittedNumerical.text);
                }
            }
        } else { // No icon, simpler label placement (e.g., centroid of arc)
            const [centroidX, centroidY] = arcGenerator.centroid(d);
            // Basic label rendering if no icon (can be enhanced)
             let displayTextCategory = String(d.data[categoryFieldName]);
             let displayTextNumerical = d.data.percentage >= 0.1 ? `${d.data.percentage.toFixed(1)}%` : '';
             if (d.data.percentage < 0.1 && d.data[valueFieldName] > 0) displayTextNumerical = `${d.data[valueFieldName]}`;
             else if (d.data.percentage < 0.1) displayTextNumerical = '';

            const initialFontProps = { ...fillStyle.typography.label };
            const maxLabelWidth = calculateSectorMaxWidth(d, (donutInnerRadius + maxRadius) / 2);
            const fittedCategory = fitTextToWidth(displayTextCategory, initialFontProps, maxLabelWidth);
            const fittedNumerical = fitTextToWidth(displayTextNumerical, initialFontProps, maxLabelWidth);

            if (fittedCategory.dimensions.width > 5) {
                 segmentGroup.append("text")
                    .attr("class", "label category-label")
                    .attr("transform", `translate(${centroidX}, ${centroidY - (displayTextNumerical ? parseFloat(fittedCategory.fontProps.fontSize) * 0.6 : 0)})`)
                    .attr("text-anchor", "middle")
                    .attr("dy", "0.35em")
                    .style("font-family", fittedCategory.fontProps.fontFamily)
                    .style("font-size", fittedCategory.fontProps.fontSize)
                    .style("font-weight", fittedCategory.fontProps.fontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(fittedCategory.text);
            }
            if (displayTextNumerical && fittedNumerical.dimensions.width > 5) {
                 segmentGroup.append("text")
                    .attr("class", "label numerical-label")
                    .attr("transform", `translate(${centroidX}, ${centroidY + parseFloat(fittedCategory.fontProps.fontSize) * 0.6})`)
                    .attr("text-anchor", "middle")
                    .attr("dy", "0.35em")
                    .style("font-family", fittedNumerical.fontProps.fontFamily)
                    .style("font-size", fittedNumerical.fontProps.fontSize)
                    .style("font-weight", fittedNumerical.fontProps.fontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(fittedNumerical.text);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No main title or other global annotations as per requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}