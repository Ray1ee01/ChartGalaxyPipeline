/* REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_chart_icons_03",
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
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is now external to the function)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !categoryColumn.name) {
        console.error("Critical chart config missing: Category field name (role 'x'). Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Critical chart configuration missing (Category field 'x').</div>");
        return null;
    }
    if (!valueColumn || !valueColumn.name) {
        console.error("Critical chart config missing: Value field name (role 'y'). Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Critical chart configuration missing (Value field 'y').</div>");
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;
    
    const chartId = (containerSelector.replace(/[^a-zA-Z0-9]/g, '') || 'chart') + '-' + Date.now();


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        segmentStrokeColor: colorsConfig.background_color || '#FFFFFF',
        defaultSegmentColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#4682B4',
        iconBackgroundColor: colorsConfig.background_color || '#FFFFFF',
        getCategoryColor: (categoryName, index) => {
            if (colorsConfig.field && colorsConfig.field[categoryName]) {
                return colorsConfig.field[categoryName];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
            }
            // Fallback to d3.schemeCategory10 if primary is not suitable for series or not defined
            const scheme = d3.schemeCategory10;
            return scheme[index % scheme.length];
        },
        getIconUrl: (categoryName) => {
            if (imagesConfig.field && imagesConfig.field[categoryName]) {
                return imagesConfig.field[categoryName];
            }
            return (imagesConfig.other && imagesConfig.other.primary) ? imagesConfig.other.primary : null; 
        }
    };
    
    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        
        textElement.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);

        // The prompt insists on not appending to DOM. getBBox on a truly detached SVG element
        // might not be reliable. This relies on browser capabilities.
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) { /* getBBox failed or not supported reliably on detached */ }

        if (width === 0 && text) { // Fallback simple estimation
            const size = parseFloat(fontProps.fontSize || fillStyle.typography.labelFontSize);
            const avgCharWidthRatio = fontProps.fontWeight === 'bold' ? 0.65 : 0.55; // Slightly wider for bold
            width = text.length * size * avgCharWidthRatio;
        }
        return width;
    }

    function parseFontSize(fontSizeString) {
        return parseFloat(fontSizeString);
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
        .attr("class", "chart-root-svg other"); // Added 'other' as per VII for root elements

    let defs = svgRoot.select("defs");
    if (defs.empty()) {
        defs = svgRoot.append("defs");
    }

    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendLabelFontSize = parseFontSize(fillStyle.typography.labelFontSize);
    const legendItemHeight = legendLabelFontSize + 10; 
    const legendTopMargin = 20;
    const legendBottomMargin = 30;

    // Estimate max label width for dynamic margins (simplified)
    let maxOuterLabelWidth = 0;
    if (chartDataInput.length > 0) {
         const sampleCategory = chartDataInput[0][categoryFieldName] || "Sample Category";
         const samplePercent = "100.0%";
         maxOuterLabelWidth = Math.max(
            estimateTextWidth(sampleCategory, { fontSize: fillStyle.typography.labelFontSize, fontFamily: fillStyle.typography.labelFontFamily, fontWeight: fillStyle.typography.labelFontWeight }),
            estimateTextWidth(samplePercent, { fontSize: fillStyle.typography.annotationFontSize, fontFamily: fillStyle.typography.annotationFontFamily, fontWeight: fillStyle.typography.annotationFontWeight })
         ) + 20; // Add some padding
    }
    maxOuterLabelWidth = Math.min(maxOuterLabelWidth, containerWidth / 4); // Cap at 25% of width


    const chartMargins = { 
        top: legendItemHeight + legendTopMargin + legendBottomMargin,
        right: Math.max(40, maxOuterLabelWidth), 
        bottom: Math.max(40, maxOuterLabelWidth / 2), // Less space needed at bottom typically
        left: Math.max(40, maxOuterLabelWidth)
    };
    
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = chartMargins.left + chartWidth / 2;
    const centerY = chartMargins.top + chartHeight / 2;
    
    const outerRadius = Math.min(chartWidth, chartHeight) / 2;
    const innerRadiusRatio = 0.6;
    const innerRadius = outerRadius * innerRadiusRatio;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group other");


    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataInput, d => d[valueFieldName]);
    const processedData = chartDataInput.map(d => ({
        ...d,
        percentage: totalValue === 0 ? 0 : (d[valueFieldName] / totalValue) * 100
    }));

    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null); 

    const arcData = pieGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const arcPathGenerator = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .padAngle(0.01);

    const iconArcCentroidGenerator = d3.arc()
        .innerRadius((innerRadius + outerRadius) / 2) 
        .outerRadius((innerRadius + outerRadius) / 2);

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend") // As per VII, complex components get a class
        .attr("transform", `translate(${chartMargins.left}, ${legendTopMargin})`);

    const legendCategories = processedData.map(d => d[categoryFieldName]);
    const uniqueLegendCategories = [...new Set(legendCategories)];

    let currentX = 0;
    const legendRectSize = legendLabelFontSize * 0.8;
    const legendSpacing = 15; 
    const legendTextPadding = 5;

    uniqueLegendCategories.forEach((category, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item other") // Standard class 'other' for group
            .attr("transform", `translate(${currentX}, 0)`);

        legendItem.append("rect")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", fillStyle.getCategoryColor(category, i))
            .attr("class", "mark legend-mark");

        const legendTextElement = legendItem.append("text")
            .attr("x", legendRectSize + legendTextPadding)
            .attr("y", legendRectSize / 2)
            .attr("dy", "0.35em") 
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(category)
            .attr("class", "label legend-label");
        
        const textWidth = estimateTextWidth(category, { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        currentX += legendRectSize + legendTextPadding + textWidth + legendSpacing;
    });
    
    const legendTotalWidth = Math.max(0, currentX - legendSpacing); 
    if (legendTotalWidth < chartWidth && legendTotalWidth > 0) {
        const legendOffsetX = (chartWidth - legendTotalWidth) / 2;
        legendGroup.attr("transform", `translate(${chartMargins.left + legendOffsetX}, ${legendTopMargin})`);
    }


    // Block 8: Main Data Visualization Rendering
    const segments = mainChartGroup.selectAll(".arc-segment")
        .data(arcData)
        .enter()
        .append("g")
        .attr("class", "arc-segment other"); // Standard class 'other' for group

    segments.append("path")
        .attr("d", arcPathGenerator)
        .attr("fill", (d, i) => fillStyle.getCategoryColor(d.data[categoryFieldName], i))
        .attr("stroke", fillStyle.segmentStrokeColor)
        .attr("stroke-width", 1.5) 
        .attr("class", "mark");

    segments.each(function(d, i) {
        const segmentGroup = d3.select(this);
        const iconUrl = fillStyle.getIconUrl(d.data[categoryFieldName]);

        if (iconUrl) {
            const [cx, cy] = iconArcCentroidGenerator.centroid(d);
            
            let iconDiameter = (outerRadius - innerRadius) * 0.6; // 60% of donut thickness
            iconDiameter = Math.max(iconDiameter, 15); 
            iconDiameter = Math.min(iconDiameter, 40); 
            const iconRadius = iconDiameter / 2;

            const clipPathId = `clip-${chartId}-${i}`;
            
            defs.append("clipPath")
                .attr("id", clipPathId)
                .append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", iconRadius);

            segmentGroup.append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", iconRadius + 1) 
                .attr("fill", fillStyle.iconBackgroundColor)
                .attr("stroke", fillStyle.getCategoryColor(d.data[categoryFieldName], i))
                .attr("stroke-width", 1)
                .attr("class", "other icon-background-circle"); // Standard class 'other'

            segmentGroup.append("image")
                .attr("xlink:href", iconUrl)
                .attr("x", cx - iconRadius)
                .attr("y", cy - iconRadius)
                .attr("width", iconDiameter)
                .attr("height", iconDiameter)
                .attr("clip-path", `url(#${clipPathId})`)
                .attr("class", "image icon"); // Standard class 'image' and 'icon'
        }
    });
    
    const labelFontSizeNum = parseFontSize(fillStyle.typography.labelFontSize);
    const annotationFontSizeNum = parseFontSize(fillStyle.typography.annotationFontSize);
    const labelOffset = 15; 

    segments.each(function(d) {
        if (d.data.percentage < 1 && arcData.length > 5) return; 

        const segmentGroup = d3.select(this);
        const midAngle = (d.startAngle + d.endAngle) / 2; 

        const labelRadius = outerRadius + labelOffset;
        const labelX = labelRadius * Math.sin(midAngle);
        const labelY = -labelRadius * Math.cos(midAngle);
        
        let textAnchor = "middle";
        const angleThreshold = 0.15; // Approx 8.5 degrees
        if (midAngle > angleThreshold && midAngle < Math.PI - angleThreshold) { 
            textAnchor = "start";
        } else if (midAngle > Math.PI + angleThreshold && midAngle < 2 * Math.PI - angleThreshold) { 
            textAnchor = "end";
        }

        const categoryText = d.data[categoryFieldName];
        const percentageText = `${d.data.percentage.toFixed(1)}%`;

        const labelTextGroup = segmentGroup.append("g")
            .attr("transform", `translate(${labelX}, ${labelY})`)
            .attr("class", "data-label-group other"); // Standard class 'other' for group

        labelTextGroup.append("text")
            .text(categoryText)
            .attr("text-anchor", textAnchor)
            .attr("dy", -(annotationFontSizeNum / 2) + 2) // Adjust to center the two-line block
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .attr("class", "label category-label");

        labelTextGroup.append("text")
            .text(percentageText)
            .attr("text-anchor", textAnchor)
            .attr("dy", (labelFontSizeNum / 2) + 2) // Position below category text
            .attr("font-family", fillStyle.typography.annotationFontFamily)
            .attr("font-size", fillStyle.typography.annotationFontSize)
            .attr("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", fillStyle.textColor)
            .attr("class", "label value-label");
    });


    // Block 9: Optional Enhancements & Post-Processing
    // No main title/subtitle in the center or other enhancements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}