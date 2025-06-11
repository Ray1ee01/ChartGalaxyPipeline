/* REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_chart_04_d3",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via colors_dark
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldDef = dataColumns.find(col => col.role === 'x');
    const valueFieldDef = dataColumns.find(col => col.role === 'y');

    if (!categoryFieldDef || !categoryFieldDef.name || !valueFieldDef || !valueFieldDef.name) {
        const missing = [];
        if (!categoryFieldDef || !categoryFieldDef.name) missing.push("category field (role 'x')");
        if (!valueFieldDef || !valueFieldDef.name) missing.push("value field (role 'y')");
        
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) ? typographyInput.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) ? typographyInput.title.font_size : '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) ? typographyInput.title.font_weight : 'bold',
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        sliceStrokeColor: colorsInput.background_color || '#FFFFFF', // Stroke with background color for separation
        connectorLineColor: '#888888',
        defaultPrimaryColor: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#4682B4',
        defaultAvailableColors: d3.schemeCategory10 
    };

    fillStyle.getSliceColor = (category) => {
        if (colorsInput.field && colorsInput.field[category]) {
            return colorsInput.field[category];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            // Simple hash function to pick a color based on category name, to make it somewhat consistent
            let hash = 0;
            for (let i = 0; i < category.length; i++) {
                hash = category.charCodeAt(i) + ((hash << 5) - hash);
            }
            hash = Math.abs(hash);
            return colorsInput.available_colors[hash % colorsInput.available_colors.length];
        }
        // Fallback to d3.schemeCategory10 if specific category or available_colors are not defined
        const uniqueCategories = [...new Set(chartDataInput.map(d => d[categoryFieldName]))];
        const colorScale = d3.scaleOrdinal(fillStyle.defaultAvailableColors).domain(uniqueCategories);
        return colorScale(category);
    };
    
    fillStyle.getImageUrl = (category) => {
        if (imagesInput.field && imagesInput.field[category]) {
            return imagesInput.field[category];
        }
        if (imagesInput.other && imagesInput.other.primary) {
            return imagesInput.other.primary; // Fallback to a generic primary icon if specified
        }
        return null; // No icon if not found
    };

    function estimateTextWidth(text, fontProps) {
        const d3Text = d3.select(document.createElementNS('http://www.w3.org/2000/svg', 'text'))
            .attr('font-family', fontProps.fontFamily)
            .attr('font-size', fontProps.fontSize)
            .attr('font-weight', fontProps.fontWeight)
            .text(text);
        try {
            return d3Text.node().getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on detached nodes (though rare for SVG)
            const size = parseFloat(String(fontProps.fontSize).replace(/[^\d.]/g, ''));
            return text.length * size * 0.6; // Rough estimate
        }
    }

    function fitTextToWidth(text, initialFontSize, fontWeight, fontFamily, maxWidth) {
        let fontSize = parseFloat(String(initialFontSize).replace(/[^\d.]/g, ''));
        const minFontSize = 8; // Minimum practical font size

        let currentWidth = estimateTextWidth(text, { fontSize: `${fontSize}px`, fontWeight, fontFamily });

        while (currentWidth > maxWidth && fontSize > minFontSize) {
            fontSize -= 1;
            currentWidth = estimateTextWidth(text, { fontSize: `${fontSize}px`, fontWeight, fontFamily });
        }
        if (currentWidth > maxWidth && fontSize === minFontSize) {
             // If still too wide at min font size, could truncate, but prompt implies just shrink.
             // For now, we accept it might overflow slightly if text is very long.
        }
        return { text, fontSize: `${fontSize}px` };
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root");

    const chartMargins = { top: 60, right: 40, bottom: 40, left: 40 }; // Increased top margin for legend

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const radius = Math.min(innerWidth, innerHeight) / 2 * 0.8; // Reduce radius slightly to ensure labels fit
    const innerRadiusFactor = 0.5;
    const outerRadius = radius;
    const donutInnerRadius = outerRadius * innerRadiusFactor;

    const chartCenterX = innerWidth / 2;
    const chartCenterY = innerHeight / 2;

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataInput, d => d[valueFieldName]);
    const processedChartData = chartDataInput.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (d[valueFieldName] / totalValue) * 100 : 0
    }));

    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null) // Keep original data order
        .startAngle(0)
        .endAngle(2 * Math.PI);

    const arcGenerator = d3.arc()
        .innerRadius(donutInnerRadius)
        .outerRadius(outerRadius)
        .padAngle(0.01) // Small padding for visual separation
        .cornerRadius(0); // No rounded corners as per V.2

    const pieSlices = pieGenerator(processedChartData);

    // Block 6: Scale Definition & Configuration
    // Color scale is handled by fillStyle.getSliceColor

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2})`); // Position legend in top margin

    const legendItems = [...new Set(processedChartData.map(d => d[categoryFieldName]))];
    const legendItemHeight = 20;
    const legendRectSize = 12;
    const legendSpacing = 5;
    let currentX = 0;

    // Legend Title (Category Field Name)
    if (categoryFieldName) {
        const legendTitle = legendGroup.append("text")
            .attr("x", currentX)
            .attr("y", legendItemHeight / 2)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryFieldName + ":")
            .attr("class", "text legend-title");
        currentX += legendTitle.node().getBBox().width + legendSpacing * 2;
    }
    
    legendItems.forEach((itemCategory, i) => {
        const legendElementGroup = legendGroup.append("g")
            .attr("transform", `translate(${currentX}, 0)`)
            .attr("class", "legend-item");

        legendElementGroup.append("rect")
            .attr("x", 0)
            .attr("y", (legendItemHeight - legendRectSize) / 2)
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .style("fill", fillStyle.getSliceColor(itemCategory))
            .attr("class", "mark legend-mark");

        const legendText = legendElementGroup.append("text")
            .attr("x", legendRectSize + legendSpacing)
            .attr("y", legendItemHeight / 2)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(itemCategory)
            .attr("class", "text legend-label");
        
        currentX += legendRectSize + legendSpacing + legendText.node().getBBox().width + legendSpacing * 2;
    });
    // Center the legend horizontally
    const legendWidth = currentX - legendSpacing * 2; // total width of legend items
    legendGroup.attr("transform", `translate(${(innerWidth - legendWidth) / 2 + chartMargins.left}, ${chartMargins.top / 3})`);


    // Block 8: Main Data Visualization Rendering
    const slicesGroup = mainChartGroup.append("g")
        .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`)
        .attr("class", "slices-group");

    const slicePaths = slicesGroup.selectAll("g.slice-item")
        .data(pieSlices)
        .enter()
        .append("g")
        .attr("class", "mark slice-item");

    slicePaths.append("path")
        .attr("d", arcGenerator)
        .attr("fill", d => fillStyle.getSliceColor(d.data[categoryFieldName]))
        .attr("stroke", fillStyle.sliceStrokeColor)
        .attr("stroke-width", 1) // Thin stroke for separation
        .attr("class", "mark slice-path");

    // Icons on slices
    slicePaths.each(function(d, i) {
        const sliceGroup = d3.select(this);
        const iconUrl = fillStyle.getImageUrl(d.data[categoryFieldName]);

        if (iconUrl) {
            // Check for space (simple check: if slice angle is large enough)
            const angleDegrees = (d.endAngle - d.startAngle) * (180 / Math.PI);
            if (angleDegrees > 10) { // Only show icon if slice is reasonably large
                const iconSizeRatio = 0.3; // Icon size relative to slice thickness
                const sliceThickness = outerRadius - donutInnerRadius;
                let iconSize = Math.min(sliceThickness * iconSizeRatio, angleDegrees * 0.3, 30); // Cap max icon size
                iconSize = Math.max(iconSize, 10); // Min icon size

                const centroid = arcGenerator.centroid(d); // Centroid of the whole slice
                // Position icon closer to inner radius, along the centroid line
                const iconRadius = donutInnerRadius + (outerRadius - donutInnerRadius) * 0.25; // 25% into the slice from inner edge
                const angle = (d.startAngle + d.endAngle) / 2 - Math.PI / 2; // Mid angle, adjusted for x,y
                
                const iconX = Math.cos(angle) * iconRadius;
                const iconY = Math.sin(angle) * iconRadius;

                const clipId = `icon-clip-${i}`;
                sliceGroup.append("defs").append("clipPath")
                    .attr("id", clipId)
                    .append("circle")
                    .attr("cx", iconX)
                    .attr("cy", iconY)
                    .attr("r", iconSize / 2)
                    .attr("class", "other icon-clip-path-shape");

                // Optional: white background circle for icon
                sliceGroup.append("circle")
                    .attr("cx", iconX)
                    .attr("cy", iconY)
                    .attr("r", iconSize / 2 + 1) // Slightly larger for border effect
                    .attr("fill", fillStyle.chartBackground)
                    .attr("class", "other icon-background");
                
                sliceGroup.append("image")
                    .attr("xlink:href", iconUrl)
                    .attr("x", iconX - iconSize / 2)
                    .attr("y", iconY - iconSize / 2)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("clip-path", `url(#${clipId})`)
                    .attr("class", "image icon");
            }
        }
    });
    
    // Data labels outside the donut
    const labelGroup = mainChartGroup.append("g")
        .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`)
        .attr("class", "labels-group");

    labelGroup.selectAll("g.label-item")
        .data(pieSlices)
        .enter()
        .append("g")
        .attr("class", "label label-item")
        .each(function(d) {
            const group = d3.select(this);
            const midAngle = (d.startAngle + d.endAngle) / 2;
            const isRightHalf = midAngle < Math.PI;

            const labelRadius = outerRadius * 1.15; // Position labels outside
            const labelX = Math.sin(midAngle) * labelRadius;
            const labelY = -Math.cos(midAngle) * labelRadius;
            
            const connectorEndX = Math.sin(midAngle) * (outerRadius * 1.05);
            const connectorEndY = -Math.cos(midAngle) * (outerRadius * 1.05);
            const arcCentroid = arcGenerator.centroid(d);

            // Connector line
            group.append("line")
                .attr("x1", arcCentroid[0])
                .attr("y1", arcCentroid[1])
                .attr("x2", connectorEndX)
                .attr("y2", connectorEndY)
                .attr("stroke", fillStyle.connectorLineColor)
                .attr("stroke-width", 1)
                .attr("class", "other connector-line");

            group.append("line") // Small horizontal part of polyline
                .attr("x1", connectorEndX)
                .attr("y1", connectorEndY)
                .attr("x2", labelX + (isRightHalf ? -5 : 5)) // extend slightly towards text
                .attr("y2", labelY)
                .attr("stroke", fillStyle.connectorLineColor)
                .attr("stroke-width", 1)
                .attr("class", "other connector-line-horizontal");

            const categoryText = d.data[categoryFieldName];
            const valueText = `${d.data.percentage.toFixed(1)}% (${d.data[valueFieldName]})`;
            
            const maxLabelWidth = innerWidth * 0.2; // Max width for label text

            const fittedCategory = fitTextToWidth(
                categoryText, 
                fillStyle.typography.labelFontSize, 
                fillStyle.typography.labelFontWeight, 
                fillStyle.typography.labelFontFamily, 
                maxLabelWidth
            );
            const fittedValue = fitTextToWidth(
                valueText, 
                fillStyle.typography.annotationFontSize, // Smaller for value
                fillStyle.typography.annotationFontWeight, 
                fillStyle.typography.annotationFontFamily, 
                maxLabelWidth
            );

            group.append("text")
                .attr("x", labelX)
                .attr("y", labelY - parseFloat(fittedCategory.fontSize) / 2 - 2) // Position category above value
                .attr("dy", "0em")
                .attr("text-anchor", isRightHalf ? "start" : "end")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fittedCategory.fontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(fittedCategory.text)
                .attr("class", "text data-label category-label");

            group.append("text")
                .attr("x", labelX)
                .attr("y", labelY + parseFloat(fittedValue.fontSize) / 2 + 2) // Position value below category
                .attr("dy", "0.35em")
                .attr("text-anchor", isRightHalf ? "start" : "end")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fittedValue.fontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(fittedValue.text)
                .attr("class", "text data-label value-label");
        });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects or enhancements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}