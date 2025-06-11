/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pie Chart",
  "chart_name": "pie_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["none"],
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
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    d3.select(containerSelector).html(""); // Clear the container

    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed in colors_dark
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!categoryFieldDef || !categoryFieldDef.name) {
        console.error("Critical chart config missing: Category field (role 'x') name not defined in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration for category field is missing.</div>");
        return null;
    }
    if (!valueFieldDef || !valueFieldDef.name) {
        console.error("Critical chart config missing: Value field (role 'y') name not defined in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration for value field is missing.</div>");
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    if (chartDataArray.length === 0) {
        console.warn("Chart data is empty. Rendering an empty chart area.");
        // Optionally render a message in the container
        // d3.select(containerSelector).html("<div style='color:grey;'>No data to display.</div>");
        // return null; // Or proceed to render an empty SVG
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = (typographyInput.title && typographyInput.title.font_family) || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = (typographyInput.title && typographyInput.title.font_size) || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = (typographyInput.title && typographyInput.title.font_weight) || defaultTypography.title.font_weight;

    fillStyle.typography.labelFontFamily = (typographyInput.label && typographyInput.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (typographyInput.label && typographyInput.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (typographyInput.label && typographyInput.label.font_weight) || defaultTypography.label.font_weight;
    
    fillStyle.typography.annotationFontFamily = (typographyInput.annotation && typographyInput.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (typographyInput.annotation && typographyInput.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (typographyInput.annotation && typographyInput.annotation.font_weight) || defaultTypography.annotation.font_weight;

    fillStyle.textColor = colorsInput.text_color || '#0f223b';
    fillStyle.chartBackground = colorsInput.background_color || '#FFFFFF';
    fillStyle.defaultSliceColor = (colorsInput.other && colorsInput.other.primary) || '#4682B4';
    fillStyle.sliceStrokeColor = '#FFFFFF'; // Standardized stroke for slices

    function getColor(categoryName, index) {
        if (colorsInput.field && colorsInput.field[categoryName]) {
            return colorsInput.field[categoryName];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[index % colorsInput.available_colors.length];
        }
        if (typeof d3 !== 'undefined' && d3.schemeCategory10 && d3.schemeCategory10.length > 0) {
             return d3.schemeCategory10[index % d3.schemeCategory10.length];
        }
        return fillStyle.defaultSliceColor;
    }

    function getImageUrl(categoryName) {
        if (imagesInput.field && imagesInput.field[categoryName]) {
            return imagesInput.field[categoryName];
        }
        if (imagesInput.other && imagesInput.other.primary) {
            return imagesInput.other.primary;
        }
        return null;
    }

    function estimateTextWidth(text, style) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', style.fontFamily || fillStyle.typography.labelFontFamily);
        textNode.setAttribute('font-size', style.fontSize || fillStyle.typography.labelFontSize);
        textNode.setAttribute('font-weight', style.fontWeight || fillStyle.typography.labelFontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth: getBBox failed. Using fallback.", e);
            const fontSizeNumeric = parseFloat(style.fontSize || fillStyle.typography.labelFontSize);
            width = text.length * fontSizeNumeric * 0.6; 
        }
        return width;
    }
    
    const TEXT_SPLIT_MAX_LENGTH = 10; // Max characters per line for splitText
    function splitText(text, maxLength) {
        if (!text || text.length <= maxLength) return text ? [text] : [];
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';
        for (let word of words) {
            if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxLength) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
                // If a single word is longer than maxLength, split it
                while (currentLine.length > maxLength) {
                    lines.push(currentLine.substring(0, maxLength));
                    currentLine = currentLine.substring(maxLength);
                }
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("class", "chart-svg");

    if (fillStyle.chartBackground !== '#FFFFFF') {
        svgRoot.style("background-color", fillStyle.chartBackground);
    }
    
    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendSingleLineHeight = (parseFloat(fillStyle.typography.labelFontSize) || 12) + 10; // text height + padding
    const legendAreaHeight = 30 + legendSingleLineHeight; // Top padding + legend height + bottom padding

    const chartMargins = {
        top: (variables.legendPosition === 'none' || !variables.showLegend) ? 40 : legendAreaHeight, // Adjust if legend is hidden
        right: 40,
        bottom: 40,
        left: 40
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const centerX = chartMargins.left + innerWidth / 2;
    const centerY = chartMargins.top + innerHeight / 2;
    const maxRadius = Math.min(innerWidth, innerHeight) / 2 * 0.95; // Slightly smaller for labels/icons

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => d[valueFieldName]);
    const processedData = chartDataArray.map(d => ({
        ...d,
        percentage: totalValue === 0 ? 0 : (d[valueFieldName] / totalValue) * 100
    }));

    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null);
    const arcsData = pieGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const arcGenerator = d3.arc()
        .innerRadius(0) // Pie chart, not donut
        .outerRadius(maxRadius)
        .padAngle(0.01) // Small padding for visual separation if stroke is subtle
        .cornerRadius(0); // No rounded corners as per simplification

    // Block 7: Chart Component Rendering (Legend)
    if (variables.showLegend !== false) { // Default to show legend
        const legendTopPadding = 20;
        const legendItemHeight = parseFloat(fillStyle.typography.labelFontSize) || 12;
        const legendRectSize = legendItemHeight;
        const legendInterItemSpacing = 10;
        const legendTextPadding = 5;
        const legendTitleRightMargin = 10;

        const legendGroup = svgRoot.append("g")
            .attr("class", "legend chart-legend");
        
        let currentLegendX = 0;
        const uniqueCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];

        if (categoryFieldName && uniqueCategories.length > 0) {
            const legendTitleText = `${categoryFieldName}:`;
            const legendTitleElement = legendGroup.append("text")
                .attr("x", 0)
                .attr("y", legendRectSize / 2)
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight) // Could be bold: titleFontWeight
                .style("fill", fillStyle.textColor)
                .text(legendTitleText)
                .attr("class", "label legend-title");
            
            currentLegendX += estimateTextWidth(legendTitleText, { 
                fontFamily: fillStyle.typography.labelFontFamily, 
                fontSize: fillStyle.typography.labelFontSize, 
                fontWeight: fillStyle.typography.labelFontWeight 
            }) + legendTitleRightMargin;
        }

        uniqueCategories.forEach((category, index) => {
            const itemGroup = legendGroup.append("g")
                .attr("transform", `translate(${currentLegendX}, 0)`)
                .attr("class", "legend-item");

            itemGroup.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", legendRectSize)
                .attr("height", legendRectSize)
                .attr("fill", getColor(category, index))
                .attr("class", "mark legend-mark");

            const textElement = itemGroup.append("text")
                .attr("x", legendRectSize + legendTextPadding)
                .attr("y", legendRectSize / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(category)
                .attr("class", "label legend-text");
            
            const itemTextWidth = estimateTextWidth(category, { 
                fontFamily: fillStyle.typography.labelFontFamily, 
                fontSize: fillStyle.typography.labelFontSize, 
                fontWeight: fillStyle.typography.labelFontWeight 
            });
            currentLegendX += legendRectSize + legendTextPadding + itemTextWidth + legendInterItemSpacing;
        });
        
        const legendWidth = currentLegendX - legendInterItemSpacing; // Total width
        const legendXPosition = chartMargins.left + (innerWidth - legendWidth) / 2;
        const legendYPosition = legendTopPadding;
        legendGroup.attr("transform", `translate(${legendXPosition > chartMargins.left ? legendXPosition : chartMargins.left}, ${legendYPosition})`);
    }


    // Block 8: Main Data Visualization Rendering
    const sliceGroups = mainChartGroup.selectAll(".slice-group")
        .data(arcsData)
        .enter()
        .append("g")
        .attr("class", "slice-group");

    sliceGroups.append("path")
        .attr("d", arcGenerator)
        .attr("fill", (d, i) => getColor(d.data[categoryFieldName], i))
        .attr("stroke", fillStyle.sliceStrokeColor)
        .attr("stroke-width", 1) // Simplified stroke
        .attr("class", "mark pie-slice");

    // Add labels and icons
    sliceGroups.each(function(d, i) {
        const sliceGroup = d3.select(this);
        const angle = (d.startAngle + d.endAngle) / 2;
        const sliceArea = (d.endAngle - d.startAngle) * maxRadius * maxRadius / 2; // Approximation

        // Only add labels/icons if slice is large enough
        if (d.data.percentage < 1 && totalValue > 0) return; // Skip for very small slices if not zero total

        // Icon
        const iconImageUrl = getImageUrl(d.data[categoryFieldName]);
        if (iconImageUrl) {
            const iconSize = Math.min(maxRadius * 0.2, 24); // Max 24px, or 20% of radius
            const iconRadius = maxRadius * 0.8; // Place icons towards the outer part of the slice
            
            const iconArc = d3.arc().innerRadius(iconRadius).outerRadius(iconRadius);
            const [iconX, iconY] = iconArc.centroid(d);

            const clipId = `icon-clip-${i}`;
            mainChartGroup.append("defs") // Defs should be on mainChartGroup or svgRoot
                .append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("cx", iconX)
                .attr("cy", iconY)
                .attr("r", iconSize / 2);

            sliceGroup.append("image")
                .attr("href", iconImageUrl)
                .attr("x", iconX - iconSize / 2)
                .attr("y", iconY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("clip-path", `url(#${clipId})`)
                .attr("class", "icon slice-icon");
        }

        // Text Labels (Category, Percentage, Value)
        const labelRadius = maxRadius * 0.55; // Place labels more centrally
        const labelArc = d3.arc().innerRadius(labelRadius).outerRadius(labelRadius);
        const [labelX, labelY] = labelArc.centroid(d);
        
        const labelFontSizePx = parseFloat(fillStyle.typography.labelFontSize);
        const lineHeight = labelFontSizePx * 1.2;
        
        const categoryText = d.data[categoryFieldName];
        const categoryLines = splitText(categoryText, TEXT_SPLIT_MAX_LENGTH);
        
        let currentTextY = labelY - (categoryLines.length * lineHeight / 2); // Start Y to center block

        categoryLines.forEach((line, lineIndex) => {
            sliceGroup.append("text")
                .attr("x", labelX)
                .attr("y", currentTextY + lineIndex * lineHeight)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor) // Consider contrast with slice color
                .text(line)
                .attr("class", "text data-label category-label");
        });
        currentTextY += categoryLines.length * lineHeight;

        if (d.data.percentage >= 1) { // Show percentage if >= 1%
            sliceGroup.append("text")
                .attr("x", labelX)
                .attr("y", currentTextY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .style("font-family", fillStyle.typography.annotationFontFamily) // Use annotation for percentage
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(`${d.data.percentage.toFixed(1)}%`)
                .attr("class", "text data-label percentage-label");
            currentTextY += lineHeight * 0.9; // Annotation font might be smaller
        }
        
        // Raw value (optional, can be noisy)
        // sliceGroup.append("text")
        //     .attr("x", labelX)
        //     .attr("y", currentTextY)
        //     .attr("text-anchor", "middle")
        //     .attr("dominant-baseline", "central")
        //     .style("font-family", fillStyle.typography.annotationFontFamily)
        //     .style("font-size", fillStyle.typography.annotationFontSize)
        //     .style("font-weight", fillStyle.typography.annotationFontWeight)
        //     .style("fill", fillStyle.textColor)
        //     .text(d.data[valueFieldName].toLocaleString())
        //     .attr("class", "text data-label value-label");
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (No specific enhancements like tooltips or complex interactions in this refactor)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}