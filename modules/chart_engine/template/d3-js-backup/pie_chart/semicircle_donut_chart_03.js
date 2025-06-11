/* REQUIREMENTS_BEGIN
{
  "chart_type": "Semicircle Donut Chart",
  "chart_name": "semicircle_donut_chart_03_d3",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    d3.select(containerSelector).html(""); // Clear container

    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming light/dark theme might pass different objects
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const categoryColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    if (!categoryColumn || !categoryColumn.name || !valueColumn || !valueColumn.name) {
        const missingFields = [];
        if (!categoryColumn || !categoryColumn.name) missingFields.push("x role field");
        if (!valueColumn || !valueColumn.name) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .html(errorMsg);
        return null;
    }

    const categoryField = categoryColumn.name;
    const valueField = valueColumn.name;

    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    // Block 2: Style Configuration & Helper Definitions
    const DEFAULT_TYPOGRAPHY_STYLES = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const DEFAULT_COLOR_STYLES = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };
    
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || DEFAULT_TYPOGRAPHY_STYLES.label.font_family,
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || DEFAULT_TYPOGRAPHY_STYLES.label.font_size,
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || DEFAULT_TYPOGRAPHY_STYLES.label.font_weight,
            legendFontFamily: (typographyInput.label && typographyInput.label.font_family) || DEFAULT_TYPOGRAPHY_STYLES.label.font_family, // Assuming legend uses label style
            legendFontSize: (typographyInput.label && typographyInput.label.font_size) || DEFAULT_TYPOGRAPHY_STYLES.label.font_size,
            legendFontWeight: (typographyInput.label && typographyInput.label.font_weight) || DEFAULT_TYPOGRAPHY_STYLES.label.font_weight,
        },
        colors: {
            textColor: colorsInput.text_color || DEFAULT_COLOR_STYLES.text_color,
            chartBackground: colorsInput.background_color || DEFAULT_COLOR_STYLES.background_color,
            defaultPrimaryColor: (colorsInput.other && colorsInput.other.primary) || DEFAULT_COLOR_STYLES.other.primary,
            arcStrokeColor: '#FFFFFF', // Maintained from original
            getColor: (categoryName, index) => {
                const fieldColors = colorsInput.field || DEFAULT_COLOR_STYLES.field;
                if (fieldColors[categoryName]) return fieldColors[categoryName];
                const availableColors = colorsInput.available_colors || DEFAULT_COLOR_STYLES.available_colors;
                return availableColors[index % availableColors.length];
            }
        },
        images: {
            getImageURL: (categoryName) => {
                if (imagesInput.field && imagesInput.field[categoryName]) return imagesInput.field[categoryName];
                if (imagesInput.other && imagesInput.other.primary) return imagesInput.other.primary; // Fallback to primary if specified
                return null;
            }
        }
    };

    function estimateTextWidthSVG(text, styleProps) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', styleProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', styleProps.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', styleProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox in some headless environments,
        // but strictly per spec, it should not be appended to DOM. For robustness, one might temporarily append.
        // document.body.appendChild(tempSvg); 
        const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg);
        return width;
    }
    
    function getContrastingTextColor(hexColor) {
        if (!hexColor || typeof hexColor !== 'string') return fillStyle.colors.textColor;
        const hex = hexColor.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 128 ? '#FFFFFF' : '#000000'; // Adjusted threshold for better contrast
    }

    function fitTextToWidth(text, baseFontSize, maxWidth, fontFamily, fontWeight) {
        let fontSize = parseFloat(baseFontSize);
        const style = { fontSize: `${fontSize}px`, fontFamily, fontWeight };
        let width = estimateTextWidthSVG(text, style);

        if (width <= maxWidth) {
            return { text, fontSize: `${fontSize}px` };
        }

        const minFontSize = 8; // Minimum practical font size
        if (fontSize > minFontSize) {
            const newFontSize = Math.max(minFontSize, fontSize * (maxWidth / width));
            style.fontSize = `${newFontSize}px`;
            width = estimateTextWidthSVG(text, style);
            if (width <= maxWidth) {
                return { text, fontSize: `${newFontSize}px` };
            }
            fontSize = newFontSize; // Use the scaled down font size for truncation
        }
        
        // If still too wide, truncate
        // Estimate char width more carefully for truncation
        const avgCharWidth = estimateTextWidthSVG("M", style) || fontSize * 0.6; // Fallback if 'M' width is zero
        let maxChars = Math.floor(maxWidth / avgCharWidth);
        if (text.length > maxChars && maxChars > 2) {
            return { text: text.substring(0, maxChars - 2) + "...", fontSize: `${fontSize}px` };
        } else if (maxChars <=2 && text.length > 0) { // very small space
             return { text: text.substring(0, 1) + "...", fontSize: `${fontSize}px` };
        }
        return { text, fontSize: `${fontSize}px` }; // Return original if it somehow fits or can't be truncated
    }
    
    // Preserving original structure of calculateLabelPosition, adapted for new helpers
    function calculateLabelPosition(d, iconCentroid, iconWidth, labelBandInnerRadius, labelBandOuterRadius, textWidth, textHeight) {
        const angle = (d.startAngle + d.endAngle) / 2;
        const labelRadius = (labelBandInnerRadius + labelBandOuterRadius) / 2;
        let x = Math.sin(angle) * labelRadius; // Positive X is right
        let y = -Math.cos(angle) * labelRadius; // Positive Y is down, but SVG Y is down, so -cos for up

        const textBBox = {
            x: x - textWidth / 2,
            y: y - textHeight / 2,
            width: textWidth,
            height: textHeight
        };
        const iconBBox = {
            x: iconCentroid[0] - iconWidth / 2,
            y: iconCentroid[1] - iconWidth / 2,
            width: iconWidth,
            height: iconWidth
        };

        const overlapXAmount = Math.max(0, Math.min(textBBox.x + textBBox.width, iconBBox.x + iconBBox.width) - Math.max(textBBox.x, iconBBox.x));
        const overlapYAmount = Math.max(0, Math.min(textBBox.y + textBBox.height, iconBBox.y + iconBBox.height) - Math.max(textBBox.y, iconBBox.y));

        if (overlapXAmount > 0 && overlapYAmount > 0) {
            const overlapArea = overlapXAmount * overlapYAmount;
            const textArea = textWidth * textHeight || 1; // Avoid division by zero
            const overlapRatio = textArea > 0 ? overlapArea / textArea : 0;

            const minSafeDistance = iconWidth / 2 + 5;
            const additionalDistance = Math.max(30 * overlapRatio, 10);
            const safetyDistance = minSafeDistance + additionalDistance;

            const currentDistance = Math.sqrt(Math.pow(x - iconCentroid[0], 2) + Math.pow(y - iconCentroid[1], 2));
            const extraDistance = safetyDistance - currentDistance;

            if (extraDistance > 0) {
                let adjustedRadius;
                // Original logic: angle is PI/2 to 3PI/2 for left half in standard math, 0 to PI for D3 pie (starts at top, clockwise)
                // d.startAngle is -PI/2 to PI/2. So angle is -PI/2 to PI/2.
                // angle > 0 means right half. angle < 0 means left half.
                if (angle > -Math.PI / 4 && angle < Math.PI / 4) { // Top quadrant, move outwards
                     adjustedRadius = labelRadius + extraDistance + 5;
                } else { // Side quadrants
                    if (Math.abs(Math.sin(angle)) * labelRadius > textWidth/2 + iconWidth/2) { // Enough horizontal space
                        adjustedRadius = labelRadius + extraDistance + 5; // Move radially outward
                    } else { // Not enough horizontal space, try to move more tangentially or further radially
                        adjustedRadius = labelRadius + extraDistance + 15; // Push further out
                    }
                }
                 // Ensure label stays within reasonable bounds if possible
                adjustedRadius = Math.min(adjustedRadius, Math.max(labelBandInnerRadius, labelBandOuterRadius) + 20); 
                adjustedRadius = Math.max(adjustedRadius, Math.min(labelBandInnerRadius, labelBandOuterRadius) - 20);


                x = Math.sin(angle) * adjustedRadius;
                y = -Math.cos(angle) * adjustedRadius;
            }
        }
        return [x, y];
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.colors.chartBackground);

    const chartMargins = { top: 40, right: 40, bottom: 40, left: 40 }; // Maintained from original

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartContentWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartContentHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const maxRadius = Math.min(chartContentWidth, chartContentHeight) / 2;
    const innerRadiusRatio = 0.5; // Maintained from original
    const arcInnerRadius = maxRadius * innerRadiusRatio;
    const arcOuterRadius = maxRadius;

    // Block 5: Data Preprocessing & Transformation
    const pieGenerator = d3.pie()
        .value(d => d[valueField])
        .sort(null)
        .startAngle(-Math.PI / 2) // Semicircle top
        .endAngle(Math.PI / 2);

    const pieData = pieGenerator(chartDataArray);

    // Block 6: Scale Definition & Configuration
    const arcGenerator = d3.arc()
        .innerRadius(arcInnerRadius)
        .outerRadius(arcOuterRadius)
        .padAngle(0.02)
        .cornerRadius(5); // Maintained from original

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    function layoutLegend(legendContainer, legendItems, itemColorFunc, typographyStyles, itemShape = "rect", itemSize = 12, spacing = 5, maxLegendWidth) {
        legendContainer.html(""); // Clear previous legend
        let currentX = 0;
        let currentY = 0;
        let maxRowHeight = 0;
        let totalLegendWidth = 0;
        const itemsPerRow = [];

        legendItems.forEach((itemText, index) => {
            const itemGroup = legendContainer.append("g").attr("class", "legend-item");
            
            if (itemShape === "rect") {
                itemGroup.append("rect")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", itemSize)
                    .attr("height", itemSize)
                    .attr("fill", itemColorFunc(itemText, index))
                    .attr("class", "mark");
            } else { // circle
                 itemGroup.append("circle")
                    .attr("cx", itemSize / 2)
                    .attr("cy", itemSize / 2)
                    .attr("r", itemSize / 2)
                    .attr("fill", itemColorFunc(itemText, index))
                    .attr("class", "mark");
            }

            const textElement = itemGroup.append("text")
                .attr("x", itemSize + spacing)
                .attr("y", itemSize / 2)
                .attr("dy", "0.35em") // Vertical alignment
                .attr("font-family", typographyStyles.legendFontFamily)
                .attr("font-size", typographyStyles.legendFontSize)
                .attr("font-weight", typographyStyles.legendFontWeight)
                .attr("fill", fillStyle.colors.textColor)
                .text(itemText)
                .attr("class", "label");
            
            const itemWidth = itemGroup.node().getBBox().width;
            const itemHeight = itemGroup.node().getBBox().height;
            maxRowHeight = Math.max(maxRowHeight, itemHeight);

            if (currentX + itemWidth > maxLegendWidth && currentX > 0) { // New row
                currentX = 0;
                currentY += maxRowHeight + spacing;
                maxRowHeight = itemHeight; // Reset for new row
                itemsPerRow.push(totalLegendWidth);
                totalLegendWidth = 0;
            }
            
            itemGroup.attr("transform", `translate(${currentX}, ${currentY})`);
            currentX += itemWidth + spacing * 2; // Add spacing after item
            totalLegendWidth = Math.max(totalLegendWidth, currentX - spacing*2);
        });
        itemsPerRow.push(totalLegendWidth); // Width of the last row

        const finalLegendWidth = Math.max(...itemsPerRow);
        const finalLegendHeight = currentY + maxRowHeight;
        return { width: finalLegendWidth, height: finalLegendHeight };
    }

    const legendCategories = [...new Set(chartDataArray.map(d => d[categoryField]))];
    if (legendCategories.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend");
        
        const legendSize = layoutLegend(
            legendGroup,
            legendCategories,
            (categoryName, index) => fillStyle.colors.getColor(categoryName, index),
            fillStyle.typography,
            "rect",
            parseFloat(fillStyle.typography.legendFontSize) * 0.8, // itemSize based on font
            5,
            chartContentWidth // Max width for legend
        );

        const legendX = (containerWidth - legendSize.width) / 2;
        const legendY = chartMargins.top / 2; // Position legend in the top margin area
        legendGroup.attr("transform", `translate(${legendX}, ${legendY})`);
    }


    // Block 8: Main Data Visualization Rendering
    const segmentsGroup = mainChartGroup.append("g").attr("class", "segments");

    pieData.forEach((d, i) => {
        const segmentGroup = segmentsGroup.append("g").attr("class", "segment-group");
        const categoryName = d.data[categoryField];
        const categoryValue = d.data[valueField];
        const segmentColor = fillStyle.colors.getColor(categoryName, i);

        segmentGroup.append("path")
            .attr("d", arcGenerator(d))
            .attr("fill", segmentColor)
            .attr("stroke", fillStyle.colors.arcStrokeColor)
            .attr("stroke-width", 2)
            .attr("class", "mark arc-segment");

        const iconURL = fillStyle.images.getImageURL(categoryName);
        
        // Icon and Label positioning logic (simplified from original's conditional logic)
        // Determine icon size based on arc length, similar to original
        const arcLengthOuter = (d.endAngle - d.startAngle) * arcOuterRadius;
        let iconNominalWidth = Math.min(arcLengthOuter / 3, 40); // Max icon size 40px
        iconNominalWidth = Math.max(iconNominalWidth, 15); // Min icon size 15px

        let iconArcRadius, labelBandInnerR, labelBandOuterR;
        // Simplified: icons always on edge, labels inside.
        // Original had complex if (iconWidth > 20) logic. This is a simplification.
        iconArcRadius = arcOuterRadius;
        labelBandInnerR = arcInnerRadius + (arcOuterRadius - arcInnerRadius) * 0.2; // Inner 20% of band
        labelBandOuterR = arcOuterRadius - (arcOuterRadius - arcInnerRadius) * 0.2; // Outer 20% of band

        const iconDisplayArc = d3.arc().innerRadius(iconArcRadius).outerRadius(iconArcRadius);
        const [iconX, iconY] = iconDisplayArc.centroid(d);

        if (iconURL) {
            const clipId = `clip-${containerSelector.replace(/[^a-zA-Z0-9]/g, '')}-${i}`;
            const defs = segmentGroup.append("defs"); // Defs per segment to ensure unique IDs if needed
            
            defs.append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("cx", iconX)
                .attr("cy", iconY)
                .attr("r", iconNominalWidth / 2);

            segmentGroup.append("circle") // Background for icon
                .attr("cx", iconX)
                .attr("cy", iconY)
                .attr("r", iconNominalWidth / 2 + 2) // Slightly larger for border effect
                .attr("fill", fillStyle.colors.chartBackground) // Typically white or chart bg
                .attr("stroke", segmentColor)
                .attr("stroke-width", 1.5)
                .attr("class", "other icon-background");

            segmentGroup.append("image")
                .attr("xlink:href", iconURL)
                .attr("x", iconX - iconNominalWidth / 2)
                .attr("y", iconY - iconNominalWidth / 2)
                .attr("width", iconNominalWidth)
                .attr("height", iconNominalWidth)
                .attr("clip-path", `url(#${clipId})`)
                .attr("class", "icon");
        }
        
        // Data Labels (Category & Value)
        let displayTextCategory = String(categoryName);
        let displayTextNumerical = String(categoryValue);
        
        // Estimate available width for text within the segment (chord length at mid-radius of label band)
        const midLabelRadius = (labelBandInnerR + labelBandOuterR) / 2;
        const angleSpan = d.endAngle - d.startAngle;
        const maxTextWidthInSection = 2 * midLabelRadius * Math.sin(angleSpan / 2) * 0.8; // 80% of chord length

        const fittedCategory = fitTextToWidth(displayTextCategory, fillStyle.typography.labelFontSize, maxTextWidthInSection, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontWeight);
        displayTextCategory = fittedCategory.text;
        const categoryFontSize = fittedCategory.fontSize;

        const fittedNumerical = fitTextToWidth(displayTextNumerical, fillStyle.typography.labelFontSize, maxTextWidthInSection, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontWeight);
        displayTextNumerical = fittedNumerical.text;
        const numericalFontSize = fittedNumerical.fontSize;

        const categoryTextHeight = parseFloat(categoryFontSize) * 1.2;
        const numericalTextHeight = parseFloat(numericalFontSize) * 1.2;
        const totalLabelHeight = categoryTextHeight + numericalTextHeight + 5; // 5px spacing

        const categoryTextWidth = estimateTextWidthSVG(displayTextCategory, { fontSize: categoryFontSize, fontFamily: fillStyle.typography.labelFontFamily, fontWeight: fillStyle.typography.labelFontWeight });
        const numericalTextWidth = estimateTextWidthSVG(displayTextNumerical, { fontSize: numericalFontSize, fontFamily: fillStyle.typography.labelFontFamily, fontWeight: fillStyle.typography.labelFontWeight });
        const maxLabelActualWidth = Math.max(categoryTextWidth, numericalTextWidth);

        const [labelX, labelY] = calculateLabelPosition(d, [iconX, iconY], iconNominalWidth, labelBandInnerR, labelBandOuterR, maxLabelActualWidth, totalLabelHeight);
        
        const labelColor = getContrastingTextColor(segmentColor);

        segmentGroup.append("text")
            .attr("x", labelX)
            .attr("y", labelY - numericalTextHeight / 2) // Position first line
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", categoryFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", labelColor)
            .text(displayTextCategory)
            .attr("class", "label data-label category-label");

        segmentGroup.append("text")
            .attr("x", labelX)
            .attr("y", labelY + categoryTextHeight / 2 + 2) // Position second line (2px spacing)
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", numericalFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", labelColor)
            .text(displayTextNumerical)
            .attr("class", "label data-label value-label");
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No main title/subtitle in the center of the donut as per V.1.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}