/* REQUIREMENTS_BEGIN
{
  "chart_type": "Semicircle Donut Chart",
  "chart_name": "semicircle_donut_chart_04_d3",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
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
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    
    const inputTypography = data.typography || {};
    const inputColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via colors_dark
    const inputImages = data.images || {};

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');

    if (!xFieldConfig || !xFieldConfig.name) {
        console.error("Critical chart config missing: X-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: X-axis field configuration is missing.</div>");
        return null;
    }
    if (!yFieldConfig || !yFieldConfig.name) {
        console.error("Critical chart config missing: Y-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Y-axis field configuration is missing.</div>");
        return null;
    }

    const categoryFieldName = xFieldConfig.name;
    const valueFieldName = yFieldConfig.name;

    // Filter out data points with undefined/null crucial values
    const chartData = rawChartData.filter(d => d[categoryFieldName] != null && d[valueFieldName] != null && typeof d[valueFieldName] === 'number');

    if (chartData.length === 0) {
        console.warn("No valid data available to render the chart after filtering.");
        // Optionally render a message in the container
        d3.select(containerSelector).html("<div style='color:grey;'>No data to display.</div>");
        return null; 
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (inputTypography.label && inputTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (inputTypography.label && inputTypography.label.font_size) || '12px',
            labelFontWeight: (inputTypography.label && inputTypography.label.font_weight) || 'normal',
            legendFontFamily: (inputTypography.label && inputTypography.label.font_family) || 'Arial, sans-serif', // Assuming legend uses label style
            legendFontSize: (inputTypography.label && inputTypography.label.font_size) || '12px',
            legendFontWeight: (inputTypography.label && inputTypography.label.font_weight) || 'normal',
        },
        textColor: inputColors.text_color || '#333333',
        defaultSliceColor: (inputColors.other && inputColors.other.primary) || '#4682B4',
        sliceStrokeColor: '#FFFFFF', // Typically white for separation
        iconBackgroundColor: '#FFFFFF',
        legendItemColor: inputColors.text_color || '#333333',
    };
    
    const defaultColorPalette = d3.schemeCategory10;
    fillStyle.getSliceColor = (category, index) => {
        if (inputColors.field && inputColors.field[category]) {
            return inputColors.field[category];
        }
        if (inputColors.available_colors && inputColors.available_colors.length > 0) {
            return inputColors.available_colors[index % inputColors.available_colors.length];
        }
        return defaultColorPalette[index % defaultColorPalette.length];
    };

    fillStyle.getIconUrl = (category) => {
        if (inputImages.field && inputImages.field[category]) {
            return inputImages.field[category];
        }
        return null;
    };
    
    function parseFontSize(fontSizeString) {
        return parseFloat(fontSizeString.replace('px', ''));
    }

    function estimateTextDimensions(text, fontFamily, fontSize, fontWeight) {
        const numericFontSize = typeof fontSize === 'string' ? parseFontSize(fontSize) : fontSize;
        const tempSvgForText = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextNode.setAttribute('font-family', fontFamily);
        tempTextNode.setAttribute('font-size', `${numericFontSize}px`);
        tempTextNode.setAttribute('font-weight', fontWeight);
        tempTextNode.textContent = text;
        tempSvgForText.appendChild(tempTextNode);
        // Note: getBBox on a detached element can be unreliable. This adheres to prompt constraints.
        const bbox = tempTextNode.getBBox();
        return { width: bbox.width, height: bbox.height || numericFontSize * 1.2 }; // Fallback for height
    }

    function calculateSectorMaxWidth(d, radius, fontFamily, fontSize, fontWeight) {
        const sectorAngle = d.endAngle - d.startAngle;
        return sectorAngle * radius * 0.8; // 80% of arc length at mid-radius as safe width
    }

    function fitTextToWidth(text, initialFontSize, maxWidth, fontFamily, fontWeight) {
        let currentFontSize = initialFontSize;
        let currentText = text;
        let dimensions = estimateTextDimensions(currentText, fontFamily, `${currentFontSize}px`, fontWeight);

        const minFontSize = 8; // Minimum practical font size

        // Try reducing font size first
        while (dimensions.width > maxWidth && currentFontSize > minFontSize) {
            currentFontSize -= 1;
            dimensions = estimateTextDimensions(currentText, fontFamily, `${currentFontSize}px`, fontWeight);
        }

        // If still too wide, truncate text
        if (dimensions.width > maxWidth) {
            const avgCharWidth = dimensions.width / currentText.length;
            if (avgCharWidth > 0) { // Avoid division by zero
                 let maxChars = Math.floor(maxWidth / avgCharWidth);
                 if (maxChars <= 3) currentText = "..."; // Not enough space for meaningful text + ellipsis
                 else currentText = text.substring(0, maxChars - 2) + "..."; // Leave space for "..."
            } else {
                currentText = "..."; // Fallback if avgCharWidth is zero
            }
            dimensions = estimateTextDimensions(currentText, fontFamily, `${currentFontSize}px`, fontWeight);
        }
        return { text: currentText, fontSize: currentFontSize, width: dimensions.width, height: dimensions.height };
    }
    
    function getTextColorForBackground(hexColor) {
        if (!hexColor || typeof hexColor !== 'string' || !hexColor.startsWith('#')) {
            return fillStyle.textColor; // Default if color is invalid
        }
        const rgb = parseInt(hexColor.slice(1), 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = (rgb >> 0) & 0xff;
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 128 ? '#FFFFFF' : '#000000'; // Common threshold is 128
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 40, bottom: 40, left: 40 }; // Increased top margin for legend
    const legendHeightEstimate = 40; // Estimate for legend area
    chartMargins.top = Math.max(chartMargins.top, legendHeightEstimate);


    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2 + (chartMargins.top - legendHeightEstimate)/2; // Adjust centerY for legend space

    // Available drawing area for the donut itself
    const drawingWidth = containerWidth - chartMargins.left - chartMargins.right;
    const drawingHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const maxRadius = Math.min(drawingWidth, drawingHeight) / 2;
    const innerRadiusRatio = 0.5; // Ratio for inner radius of donut
    const donutInnerRadius = maxRadius * innerRadiusRatio;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartData, d => d[valueFieldName]);
    const chartDataWithPercentages = chartData.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (d[valueFieldName] / totalValue) * 100 : 0
    }));

    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null) // Keep original data order
        .startAngle(-Math.PI / 2) // Start at 12 o'clock
        .endAngle(Math.PI / 2);   // End at 6 o'clock (semicircle)

    const sectors = pieGenerator(chartDataWithPercentages);

    // Block 6: Scale Definition & Configuration
    const arcGenerator = d3.arc()
        .innerRadius(donutInnerRadius)
        .outerRadius(maxRadius)
        .padAngle(0.02); // Small padding between sectors

    // Helper for label positioning (simplified from original for clarity, can be expanded)
    function calculateLabelPosition(d, iconCentroid, iconSize, textWidth, textHeight) {
        const angle = (d.startAngle + d.endAngle) / 2;
        const labelRadius = (donutInnerRadius + maxRadius) / 2; // Mid-point of the donut ring

        let x = Math.sin(angle) * labelRadius;
        let y = -Math.cos(angle) * labelRadius;

        // Basic overlap avoidance with icon (simplified)
        if (iconCentroid) {
            const distToIconCenter = Math.sqrt(Math.pow(x - iconCentroid[0], 2) + Math.pow(y - iconCentroid[1], 2));
            const requiredDist = (iconSize / 2) + (Math.max(textWidth, textHeight) / 2) + 5; // 5px buffer

            if (distToIconCenter < requiredDist) {
                // Attempt to push label further out or in along the angle
                const pushFactor = (requiredDist - distToIconCenter);
                const newRadius = labelRadius + ( (angle > -Math.PI/2 && angle < Math.PI/2) ? pushFactor : -pushFactor); // Push out for right, in for left
                
                // Ensure it doesn't go too far in or out
                const boundedRadius = Math.max(donutInnerRadius * 0.8, Math.min(newRadius, maxRadius * 1.1));
                x = Math.sin(angle) * boundedRadius;
                y = -Math.cos(angle) * boundedRadius;
            }
        }
        return [x, y];
    }


    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - legendHeightEstimate / 2})`); // Position legend at top

    const legendItems = chartData.map(d => d[categoryFieldName]);
    const uniqueLegendItems = [...new Set(legendItems)];

    let currentX = 0;
    const legendItemHeight = parseFontSize(fillStyle.typography.legendFontSize) * 1.5;
    const legendPadding = 5;
    const swatchSize = parseFontSize(fillStyle.typography.legendFontSize);

    uniqueLegendItems.forEach((itemText, i) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, 0)`);

        itemGroup.append("rect")
            .attr("x", 0)
            .attr("y", (legendItemHeight - swatchSize) / 2 - swatchSize/2) // Center swatch vertically
            .attr("width", swatchSize)
            .attr("height", swatchSize)
            .attr("fill", fillStyle.getSliceColor(itemText, i))
            .attr("class", "legend-swatch");

        const textElement = itemGroup.append("text")
            .attr("x", swatchSize + legendPadding)
            .attr("y", legendItemHeight / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.legendFontFamily)
            .style("font-size", fillStyle.typography.legendFontSize)
            .style("font-weight", fillStyle.typography.legendFontWeight)
            .style("fill", fillStyle.legendItemColor)
            .text(itemText)
            .attr("class", "legend-label");
        
        const itemWidth = swatchSize + legendPadding + estimateTextDimensions(itemText, fillStyle.typography.legendFontFamily, fillStyle.typography.legendFontSize, fillStyle.typography.legendFontWeight).width;
        currentX += itemWidth + legendPadding * 2; // Add padding between items
    });
    
    // Center the legend block if space allows
    const legendBlockWidth = currentX - legendPadding * 2;
    if (legendBlockWidth < drawingWidth) {
        legendGroup.attr("transform", `translate(${(containerWidth - legendBlockWidth) / 2}, ${chartMargins.top / 2 - legendHeightEstimate / 2 + 10})`);
    }


    // Block 8: Main Data Visualization Rendering
    const sectorGroups = mainChartGroup.selectAll(".sector-group")
        .data(sectors)
        .enter()
        .append("g")
        .attr("class", "sector-group");

    sectorGroups.append("path")
        .attr("d", arcGenerator)
        .attr("fill", (d, i) => fillStyle.getSliceColor(d.data[categoryFieldName], i))
        .attr("stroke", fillStyle.sliceStrokeColor)
        .attr("stroke-width", 2)
        .attr("class", "mark donut-slice");

    sectorGroups.each(function(d, i) {
        const group = d3.select(this);
        const category = d.data[categoryFieldName];
        const value = d.data[valueFieldName];
        const sliceColor = fillStyle.getSliceColor(category, i);

        // Icon rendering logic (simplified from original)
        const iconUrl = fillStyle.getIconUrl(category);
        let iconCentroid, iconSize = 0;

        // Determine icon placement strategy (e.g., inside or outside based on arc size)
        const arcAngle = d.endAngle - d.startAngle;
        const arcMidRadius = (donutInnerRadius + maxRadius) / 2;
        const spaceForIcon = arcAngle * donutInnerRadius; // Approx space at inner edge
        
        let iconPlacementRadius;
        if (spaceForIcon > 30) { // Threshold to place icon inside
            iconPlacementRadius = donutInnerRadius + 15; // Place near inner edge
            iconSize = Math.min(30, arcAngle * donutInnerRadius * 0.5, (maxRadius - donutInnerRadius) * 0.4);
        } else { // Place icon outside
            iconPlacementRadius = maxRadius + 20;
            iconSize = 20;
        }
        iconSize = Math.max(10, iconSize); // Minimum icon size


        if (iconUrl && iconSize > 0) {
            const tempIconArc = d3.arc().innerRadius(iconPlacementRadius).outerRadius(iconPlacementRadius);
            iconCentroid = tempIconArc.centroid(d);

            const clipId = `clip-${i}-${Math.random().toString(36).substr(2, 9)}`;
            const defs = mainChartGroup.append("defs"); // Append defs to mainChartGroup or svgRoot
            defs.append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("cx", iconCentroid[0])
                .attr("cy", iconCentroid[1])
                .attr("r", iconSize / 2);

            group.append("circle")
                .attr("cx", iconCentroid[0])
                .attr("cy", iconCentroid[1])
                .attr("r", iconSize / 2 + 2) // Background circle slightly larger
                .attr("fill", fillStyle.iconBackgroundColor)
                .attr("stroke", sliceColor)
                .attr("stroke-width", 1.5)
                .attr("class", "icon-background");

            group.append("image")
                .attr("xlink:href", iconUrl)
                .attr("x", iconCentroid[0] - iconSize / 2)
                .attr("y", iconCentroid[1] - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("clip-path", `url(#${clipId})`)
                .attr("class", "image icon-image");
        }

        // Text label rendering
        const initialFontSize = parseFontSize(fillStyle.typography.labelFontSize);
        const textFontFamily = fillStyle.typography.labelFontFamily;
        const textFontWeight = fillStyle.typography.labelFontWeight;

        // Category Text
        const categoryTextMaxWidth = calculateSectorMaxWidth(d, arcMidRadius, textFontFamily, initialFontSize, textFontWeight) * 0.8; // 80% of available
        const fittedCategory = fitTextToWidth(String(category), initialFontSize, categoryTextMaxWidth, textFontFamily, textFontWeight);
        
        // Value Text
        const valueTextMaxWidth = categoryTextMaxWidth; // Assume similar width constraint
        const fittedValue = fitTextToWidth(String(value), initialFontSize, valueTextMaxWidth, textFontFamily, textFontWeight);

        const labelTextCombinedHeight = fittedCategory.height + fittedValue.height + 5; // 5px spacing
        const labelTextCombinedWidth = Math.max(fittedCategory.width, fittedValue.width);

        const [labelX, labelY] = calculateLabelPosition(d, iconCentroid, iconSize, labelTextCombinedWidth, labelTextCombinedHeight);
        
        const labelColor = getTextColorForBackground(sliceColor);

        group.append("text")
            .attr("x", labelX)
            .attr("y", labelY - fittedCategory.height / 2) // Position first line
            .attr("text-anchor", "middle")
            .style("font-family", textFontFamily)
            .style("font-size", `${fittedCategory.fontSize}px`)
            .style("font-weight", textFontWeight)
            .style("fill", labelColor)
            .text(fittedCategory.text)
            .attr("class", "text data-label category-label");

        group.append("text")
            .attr("x", labelX)
            .attr("y", labelY + fittedValue.height / 2 + 5) // Position second line (5px spacing)
            .attr("text-anchor", "middle")
            .style("font-family", textFontFamily)
            .style("font-size", `${fittedValue.fontSize}px`)
            .style("font-weight", textFontWeight)
            .style("fill", labelColor)
            .text(fittedValue.text)
            .attr("class", "text data-label value-label");
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (No additional enhancements specified beyond core rendering)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}