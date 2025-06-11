/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_chart_01",
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
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END
*/
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    d3.select(containerSelector).html(""); // Clear the container

    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !categoryColumn.name || !valueColumn || !valueColumn.name) {
        const missingFields = [];
        if (!categoryColumn || !categoryColumn.name) missingFields.push("category field (role 'x')");
        if (!valueColumn || !valueColumn.name) missingFields.push("value field (role 'y')");
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) ? typographyConfig.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) ? typographyConfig.title.font_size : '16px',
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) ? typographyConfig.title.font_weight : 'bold',
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        segmentStrokeColor: '#FFFFFF', // Standard stroke for segments
        defaultSegmentColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#4682B4',
        legendColorBoxSize: 12,
        legendSpacing: 5,
        legendTextGap: 8,
    };

    fillStyle.getSegmentColor = (categoryName, index) => {
        if (colorsConfig.field && colorsConfig.field[categoryName]) {
            return colorsConfig.field[categoryName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        return d3.schemeCategory10[index % d3.schemeCategory10.length] || fillStyle.defaultSegmentColor;
    };

    fillStyle.getImageUrl = (categoryName) => {
        if (imagesConfig.field && imagesConfig.field[categoryName]) {
            return imagesConfig.field[categoryName];
        }
        if (imagesConfig.other && imagesConfig.other.primary) {
            return imagesConfig.other.primary; // Fallback to a primary icon if specified
        }
        return null; // No image available
    };
    
    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Document append/remove is not strictly necessary for getBBox if SVG has intrinsic size or text element is simple
        // but to be safe for all browsers, one might append it temporarily.
        // For this implementation, we assume getBBox works on non-appended SVG text elements.
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-rendered elements
            width = text.length * (parseFloat(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
        return width;
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
        .attr("class", "chart-svg-root");

    const chartMargins = { 
        top: variables.marginTop || 60, // Increased top margin for legend
        right: variables.marginRight || 40, 
        bottom: variables.marginBottom || 40, 
        left: variables.marginLeft || 40 
    };
    
    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2; // Center of the full SVG for the donut

    const radius = Math.min(innerWidth, innerHeight) / 2 * (variables.radiusMultiplier || 0.8); // Reduce radius slightly to fit labels
    const innerRadiusRatio = variables.innerRadiusRatio || 0.5;
    const innerRadius = radius * innerRadiusRatio;
    const outerRadius = radius;

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
        .sort(null);

    const pieData = pieGenerator(chartDataProcessed);

    // Block 6: Scale Definition & Configuration
    const arcGenerator = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .padAngle(variables.padAngle || 0.01) // Small padAngle for separation
        .cornerRadius(variables.cornerRadius || 0); // No rounded corners by default

    const arcCentroidGenerator = d3.arc()
        .innerRadius((innerRadius + outerRadius) / 2)
        .outerRadius((innerRadius + outerRadius) / 2);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendContainerGroup = svgRoot.append("g")
        .attr("class", "legend-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - 10})`); // Position legend at top

    const uniqueCategories = Array.from(new Set(chartDataProcessed.map(d => d[categoryFieldName])));
    
    let currentXOffset = 0;
    const legendItemPadding = 15;

    uniqueCategories.forEach((category, i) => {
        const legendItem = legendContainerGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentXOffset}, 0)`);

        legendItem.append("rect")
            .attr("x", 0)
            .attr("y", -fillStyle.legendColorBoxSize / 2)
            .attr("width", fillStyle.legendColorBoxSize)
            .attr("height", fillStyle.legendColorBoxSize)
            .attr("fill", fillStyle.getSegmentColor(category, i))
            .attr("class", "mark");

        const legendText = legendItem.append("text")
            .attr("x", fillStyle.legendColorBoxSize + fillStyle.legendTextGap)
            .attr("y", 0)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(category)
            .attr("class", "text");
        
        const textWidth = estimateTextWidth(category, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        currentXOffset += fillStyle.legendColorBoxSize + fillStyle.legendTextGap + textWidth + legendItemPadding;
    });
    
    // Center the legend if space allows
    const legendWidth = currentXOffset - legendItemPadding; // Total width of legend items
    if (legendWidth < innerWidth) {
        legendContainerGroup.attr("transform", `translate(${(containerWidth - legendWidth) / 2}, ${chartMargins.top / 2 - 10})`);
    }


    // Block 8: Main Data Visualization Rendering
    const segmentGroups = mainChartGroup.selectAll(".segment-group")
        .data(pieData)
        .enter()
        .append("g")
        .attr("class", "segment-group");

    segmentGroups.append("path")
        .attr("d", arcGenerator)
        .attr("fill", (d, i) => fillStyle.getSegmentColor(d.data[categoryFieldName], i))
        .attr("stroke", fillStyle.segmentStrokeColor)
        .attr("stroke-width", variables.segmentStrokeWidth || 2)
        .attr("class", "mark");

    // Block 9: Optional Enhancements & Post-Processing (Icons and Labels)
    segmentGroups.each(function(d, i) {
        const segmentGroup = d3.select(this);
        const categoryName = d.data[categoryFieldName];
        const iconUrl = fillStyle.getImageUrl(categoryName);

        // Calculate centroid for icon
        const [cx, cy] = arcCentroidGenerator.centroid(d);

        // Icon rendering (if URL exists)
        if (iconUrl) {
            const angleSize = d.endAngle - d.startAngle;
            const iconSizeBase = Math.min(angleSize * radius * 0.25, Math.min(outerRadius - innerRadius, 40) * 0.7);
            const iconSize = Math.max(iconSizeBase, 15); // Min icon size

            const iconGroupId = `icon-clip-${i}`;
            
            // Define clipPath for circular icon
            svgRoot.select("defs").empty(); // Clear previous defs if any, or manage them better
            const defs = svgRoot.append("defs"); // Append defs to svgRoot, not mainChartGroup
            
            defs.append("clipPath")
                .attr("id", iconGroupId)
                .append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", iconSize / 2);

            // White background for icon
            segmentGroup.append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", iconSize / 2 + (variables.iconPadding || 2))
                .attr("fill", "white")
                .attr("stroke", fillStyle.getSegmentColor(categoryName, i))
                .attr("stroke-width", variables.iconBgStrokeWidth || 1)
                .attr("class", "icon-background");

            segmentGroup.append("image")
                .attr("xlink:href", iconUrl)
                .attr("x", cx - iconSize / 2)
                .attr("y", cy - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("clip-path", `url(#${iconGroupId})`) // Clip path needs to be relative to the SVG root
                .attr("class", "icon");
        }

        // Data labels (Category Name and Percentage) - outside the donut
        const labelArc = d3.arc()
            .innerRadius(outerRadius + (variables.labelOffsetInner || 10))
            .outerRadius(outerRadius + (variables.labelOffsetOuter || 30));
        
        const labelCentroid = labelArc.centroid(d);
        const midAngle = (d.startAngle + d.endAngle) / 2;
        
        let textAnchor = "middle";
        if (midAngle > Math.PI * 0.05 && midAngle < Math.PI * 0.95) { // Right half
            textAnchor = "start";
        } else if (midAngle > Math.PI * 1.05 && midAngle < Math.PI * 1.95) { // Left half
            textAnchor = "end";
        }

        const labelGroup = segmentGroup.append("g")
            .attr("transform", `translate(${labelCentroid[0]}, ${labelCentroid[1]})`)
            .attr("class", "label-group");

        // Category Name Label
        labelGroup.append("text")
            .text(categoryName)
            .attr("dy", "-0.1em")
            .attr("text-anchor", textAnchor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "text category-label");

        // Percentage Label
        labelGroup.append("text")
            .text(`${d.data.percentage.toFixed(1)}%`)
            .attr("dy", "1.1em")
            .attr("text-anchor", textAnchor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "text percentage-label");
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}