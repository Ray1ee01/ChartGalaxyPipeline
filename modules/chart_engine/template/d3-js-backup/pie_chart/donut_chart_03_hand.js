/* REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_chart_01",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    d3.select(containerSelector).html(""); // Clear the container

    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming light theme preference if both exist
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');

    if (!xFieldConfig || !xFieldConfig.name || !yFieldConfig || !yFieldConfig.name) {
        console.error("Critical chart config missing: x or y field name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration missing (x or y field name).</div>");
        return null;
    }
    const categoryFieldName = xFieldConfig.name;
    const valueFieldName = yFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px', // Base size, can be adjusted by fitText
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
        },
        textColor: colorsConfig.text_color || '#0f223b',
        iconBackgroundColor: '#FFFFFF', // Default white background for icons
        getSegmentColor: (category, index) => {
            if (colorsConfig.field && colorsConfig.field[category]) return colorsConfig.field[category];
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
            const defaultScheme = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"]; // d3.schemeCategory10
            return defaultScheme[index % defaultScheme.length];
        }
    };
    fillStyle.getIconBorderColor = fillStyle.getSegmentColor; // Icon border matches segment color

    function estimateTextDimensions(text, fontFamily, fontSize, fontWeight) {
        if (!text || String(text).trim() === "") {
            const numericFontSize = parseFloat(fontSize) || 12;
            return { width: 0, height: numericFontSize };
        }
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = String(text);
        tempSvg.appendChild(tempText);
        // Not appending to DOM as per requirements
        try {
            const bbox = tempText.getBBox();
            return { width: bbox.width, height: bbox.height };
        } catch (e) { // Fallback if getBBox fails on non-DOM element
            const numericFontSize = parseFloat(fontSize) || 12;
            return { width: String(text).length * numericFontSize * 0.6, height: numericFontSize * 1.2 };
        }
    }

    function fitTextToWidth(text, baseFontSize, fontFamily, fontWeight, maxWidth) {
        let currentFontSize = parseFloat(baseFontSize);
        let displayText = String(text);
        const minFontSize = 8; // Minimum practical font size

        let dimensions = estimateTextDimensions(displayText, fontFamily, `${currentFontSize}px`, fontWeight);

        // Try reducing font size
        while (dimensions.width > maxWidth && currentFontSize > minFontSize) {
            currentFontSize -= 1;
            dimensions = estimateTextDimensions(displayText, fontFamily, `${currentFontSize}px`, fontWeight);
        }

        // If still too wide, truncate
        if (dimensions.width > maxWidth) {
            const avgCharWidth = dimensions.width / displayText.length;
            if (avgCharWidth > 0) {
                 let maxChars = Math.floor(maxWidth / avgCharWidth);
                 if (maxChars <= 3) displayText = "...";
                 else displayText = displayText.substring(0, maxChars - 2) + "...";
            } else {
                displayText = "..."; // Failsafe if avgCharWidth is 0
            }
            dimensions = estimateTextDimensions(displayText, fontFamily, `${currentFontSize}px`, fontWeight);
        }
        return { text: displayText, fontSize: `${currentFontSize}px`, width: dimensions.width, height: dimensions.height };
    }

    // Simplified calculateSectorMaxWidth - using a fraction of arc length at mid-radius
    function calculateSectorAngularWidth(d, radius) {
        const sectorAngle = d.endAngle - d.startAngle;
        return sectorAngle * radius * 0.7; // 70% of arc length as a heuristic
    }

    // Preserving calculateLabelPosition with adaptations
    function calculateLabelPosition(d, iconCentroid, iconDiameter, labelBandInnerRadius, labelBandOuterRadius, textWidth, textHeight) {
        const angle = (d.startAngle + d.endAngle) / 2;
        const midLabelRadius = (labelBandInnerRadius + labelBandOuterRadius) / 2;

        let x = Math.sin(angle) * midLabelRadius;
        let y = -Math.cos(angle) * midLabelRadius;

        const textBBox = { x: x - textWidth / 2, y: y - textHeight / 2, width: textWidth, height: textHeight };
        const iconBBox = { x: iconCentroid[0] - iconDiameter / 2, y: iconCentroid[1] - iconDiameter / 2, width: iconDiameter, height: iconDiameter };

        const overlaps = (box1, box2) => {
            return !(box1.x + box1.width < box2.x || box1.x > box2.x + box2.width ||
                     box1.y + box1.height < box2.y || box1.y > box2.y + box2.height);
        };

        if (overlaps(textBBox, iconBBox)) {
            const safetyMargin = 5; // Small margin
            const effectiveIconRadius = iconDiameter / 2 + safetyMargin;
            
            let bestPosition = null;
            let minDeviation = Infinity;

            // Try positions along an arc, slightly outside the icon
            // Iterate angle and radius
            const angularStep = Math.PI / 18; // 10 degrees
            const radiusSteps = 3;
            const radiusStepSize = (labelBandOuterRadius - labelBandInnerRadius) / (radiusSteps > 1 ? radiusSteps -1 : 1);


            for (let rStep = 0; rStep < radiusSteps; rStep++) {
                const currentTestRadius = labelBandInnerRadius + rStep * radiusStepSize;
                 if (currentTestRadius < effectiveIconRadius + textHeight/2) continue; // Ensure radius is large enough

                for (let i = -5; i <= 5; i++) { // Try up to +/- 50 degrees from original angle
                    const testAngle = angle + i * angularStep;
                    const newX = Math.sin(testAngle) * currentTestRadius;
                    const newY = -Math.cos(testAngle) * currentTestRadius;
                    const newTextBBox = { x: newX - textWidth / 2, y: newY - textHeight / 2, width: textWidth, height: textHeight };

                    if (!overlaps(newTextBBox, iconBBox)) {
                        // Prefer positions closer to the original angle and midLabelRadius
                        const deviation = Math.abs(i * angularStep) + Math.abs(currentTestRadius - midLabelRadius) / midLabelRadius * Math.PI/4; // Heuristic for "goodness"
                        if (deviation < minDeviation) {
                            minDeviation = deviation;
                            bestPosition = [newX, newY];
                        }
                    }
                }
            }
            if (bestPosition) return bestPosition;

            // Fallback: push radially outward from icon center
            const dx = x - iconCentroid[0];
            const dy = y - iconCentroid[1];
            const dist = Math.sqrt(dx*dx + dy*dy);
            const desiredDist = effectiveIconRadius + Math.max(textWidth, textHeight) / 2; // Push out enough for text
            
            if (dist > 0 && dist < desiredDist) {
                x = iconCentroid[0] + dx/dist * desiredDist;
                y = iconCentroid[1] + dy/dist * desiredDist;
            } else if (dist === 0) { // Text center is same as icon center
                 x = iconCentroid[0] + Math.sin(angle) * desiredDist;
                 y = iconCentroid[1] - Math.cos(angle) * desiredDist;
            }
        }
        return [x, y];
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", colorsConfig.background_color || 'transparent');

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Reduced margins, as labels/icons are positioned relative to donut
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = containerWidth / 2; // Center of the SVG, not just innerWidth
    const centerY = containerHeight / 2;

    const outerRadiusActual = Math.min(innerWidth, innerHeight) / 2 * 0.8; // 80% to leave space for outer icons/labels
    const innerRadiusActual = outerRadiusActual * 0.5; // Donut hole size

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataInput, d => d[valueFieldName]);
    const chartDataProcessed = chartDataInput.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (d[valueFieldName] / totalValue) * 100 : 0
    }));

    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null); // Preserve original data order

    const arcsData = pieGenerator(chartDataProcessed);

    // Block 6: Scale Definition & Configuration
    const arcGenerator = d3.arc()
        .innerRadius(innerRadiusActual)
        .outerRadius(outerRadiusActual)
        .padAngle(0) // No padding between segments
        .cornerRadius(0); // No rounded corners

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this donut chart.

    // Block 8: Main Data Visualization Rendering
    const segmentsGroup = mainChartGroup.append("g").attr("class", "segments-group");

    arcsData.forEach((d, i) => {
        const categoryName = d.data[categoryFieldName];
        const segmentColor = fillStyle.getSegmentColor(categoryName, i);

        segmentsGroup.append("path")
            .attr("d", arcGenerator(d))
            .attr("fill", segmentColor)
            .attr("class", "mark value"); // Standardized class
    });

    // Block 9: Optional Enhancements & Post-Processing (Icons and Labels)
    const enhancementsGroup = mainChartGroup.append("g").attr("class", "enhancements-group");
    const defs = enhancementsGroup.append("defs"); // Defs for clipPaths

    arcsData.forEach((d, i) => {
        const categoryName = d.data[categoryFieldName];
        const segmentColor = fillStyle.getSegmentColor(categoryName, i); // Also used for icon border

        // Icon properties
        const segmentArcLengthOuter = (d.endAngle - d.startAngle) * outerRadiusActual;
        let iconDiameter = Math.min(segmentArcLengthOuter / 2.5, Math.min(outerRadiusActual - innerRadiusActual, 60) * 0.8, 40); // Max 40px, scaled by segment and thickness
        iconDiameter = Math.max(iconDiameter, 20); // Min 20px

        let iconCentroidRadius, labelBandInnerRadius, labelBandOuterRadius;
        const smallIconThreshold = 25; // Diameter

        if (iconDiameter > smallIconThreshold) { // Larger icons, on the donut rim
            iconCentroidRadius = outerRadiusActual;
            labelBandInnerRadius = innerRadiusActual * 0.8; // Labels can be inside donut
            labelBandOuterRadius = outerRadiusActual * 1.1; // Or slightly outside
        } else { // Smaller icons, pushed further out
            iconDiameter = 20; // Standardize small icon size
            iconCentroidRadius = outerRadiusActual + iconDiameter * 0.6 + 5; // Place small icons slightly outside with a gap
            labelBandInnerRadius = outerRadiusActual + iconDiameter + 10; // Labels start outside icon
            labelBandOuterRadius = outerRadiusActual + iconDiameter + 50; // And extend further
        }
        
        const iconArc = d3.arc().innerRadius(iconCentroidRadius).outerRadius(iconCentroidRadius);
        const [iconX, iconY] = iconArc.centroid(d);
        
        const iconUrl = imagesConfig.field && imagesConfig.field[categoryName] ? imagesConfig.field[categoryName] : null;

        if (iconUrl) {
            const clipId = `icon-clip-${i}`;
            defs.append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("cx", iconX)
                .attr("cy", iconY)
                .attr("r", iconDiameter / 2);

            enhancementsGroup.append("circle") // Icon background
                .attr("cx", iconX)
                .attr("cy", iconY)
                .attr("r", iconDiameter / 2 + 2) // Background slightly larger for border effect
                .attr("fill", fillStyle.iconBackgroundColor)
                .attr("stroke", fillStyle.getIconBorderColor(categoryName, i))
                .attr("stroke-width", 1.5)
                .attr("class", "icon-background other");

            enhancementsGroup.append("image")
                .attr("xlink:href", iconUrl)
                .attr("x", iconX - iconDiameter / 2)
                .attr("y", iconY - iconDiameter / 2)
                .attr("width", iconDiameter)
                .attr("height", iconDiameter)
                .attr("clip-path", `url(#${clipId})`)
                .attr("class", "icon image");
        }

        // Labels
        const percentageValue = d.data.percentage;
        const rawValue = d.data[valueFieldName];

        let categoryText = String(categoryName);
        let valueText = percentageValue >= 1 ? `${percentageValue.toFixed(1)}% (${rawValue})` : ''; // Show if >= 1%

        // Max width for text is related to segment width or a fixed portion of radius
        const maxTextWidth = calculateSectorAngularWidth(d, (labelBandInnerRadius + labelBandOuterRadius) / 2) * 0.8;
        
        const fittedCategory = fitTextToWidth(categoryText, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontWeight, maxTextWidth);
        categoryText = fittedCategory.text;
        const categoryFontSize = fittedCategory.fontSize;
        const categoryTextDims = {width: fittedCategory.width, height: fittedCategory.height};


        const fittedValue = fitTextToWidth(valueText, categoryFontSize, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontWeight, maxTextWidth);
        valueText = fittedValue.text;
        const valueFontSize = fittedValue.fontSize; // Use potentially reduced size from category for consistency or re-fit
        const valueTextDims = {width: fittedValue.width, height: fittedValue.height};


        if (categoryText || valueText) {
            const totalLabelHeight = categoryTextDims.height + (valueText ? valueTextDims.height + 2 : 0); // 2px spacing
            const maxLabelWidth = Math.max(categoryTextDims.width, valueTextDims.width);
            
            const [labelX, labelY] = calculateLabelPosition(d, [iconX, iconY], iconDiameter, labelBandInnerRadius, labelBandOuterRadius, maxLabelWidth, totalLabelHeight);

            if (categoryText) {
                enhancementsGroup.append("text")
                    .attr("x", labelX)
                    .attr("y", labelY - (valueText ? valueTextDims.height / 2 + 1 : 0)) // Adjust Y if two lines
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", categoryFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .attr("class", "label text")
                    .text(categoryText);
            }

            if (valueText) {
                enhancementsGroup.append("text")
                    .attr("x", labelX)
                    .attr("y", labelY + (categoryText ? categoryTextDims.height / 2 + 1 : 0)) // Adjust Y if two lines
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", valueFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .attr("class", "label text value")
                    .text(valueText);
            }
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}