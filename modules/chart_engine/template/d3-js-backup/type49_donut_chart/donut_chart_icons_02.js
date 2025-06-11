/* REQUIREMENTS_BEGIN
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
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Prioritize data.colors
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');

    if (!xFieldConfig || !xFieldConfig.name) {
        console.error("Critical chart config missing: X-axis field name (role 'x'). Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: X-axis field configuration is missing.</div>");
        return null;
    }
    if (!yFieldConfig || !yFieldConfig.name) {
        console.error("Critical chart config missing: Y-axis field name (role 'y'). Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Y-axis field configuration is missing.</div>");
        return null;
    }

    const categoryFieldName = xFieldConfig.name;
    const valueFieldName = yFieldConfig.name;

    const chartDataArray = chartDataInput.filter(d => d[valueFieldName] != null && d[valueFieldName] > 0);
    if (chartDataArray.length === 0) {
        console.error("No valid data to render for the donut chart.");
         d3.select(containerSelector).html("<div style='color:gray;'>No data available to display chart.</div>");
        return null;
    }


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
        segmentStrokeColor: colorsConfig.background_color || '#FFFFFF', // Use background for stroke to create separation
        labelLineColor: '#888888',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
    };

    const defaultColors = d3.schemeCategory10;
    const uniqueCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    
    fillStyle.getSegmentColor = (category) => {
        if (colorsConfig.field && colorsConfig.field[category]) {
            return colorsConfig.field[category];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            const index = uniqueCategories.indexOf(category);
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        const index = uniqueCategories.indexOf(category);
        return defaultColors[index % defaultColors.length];
    };

    fillStyle.getIconUrl = (category) => {
        if (imagesConfig.field && imagesConfig.field[category]) {
            return imagesConfig.field[category];
        }
        return (imagesConfig.other && imagesConfig.other.primary) ? imagesConfig.other.primary : null;
    };
    
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document append/remove is not strictly necessary for getBBox if SVG is fully defined,
        // but some browsers might need it for full style computation.
        // For this in-memory version, we assume basic properties are enough.
        // If not, one would append to document.body, measure, then remove.
        // However, the prompt says "MUST NOT be appended to the document DOM".
        return tempText.getBBox().width;
    }

    function fitTextToWidth(text, initialFontSize, fontWeight, fontFamily, maxWidth, minFontSize = 8) {
        let fontSize = parseFloat(initialFontSize);
        let textToRender = text;
        let currentWidth = estimateTextWidth(textToRender, { fontSize: `${fontSize}px`, fontWeight, fontFamily });

        while (currentWidth > maxWidth && fontSize > minFontSize) {
            fontSize -= 1;
            currentWidth = estimateTextWidth(textToRender, { fontSize: `${fontSize}px`, fontWeight, fontFamily });
        }
        if (currentWidth > maxWidth && fontSize <= minFontSize) { // If still too wide at min font size
             // Simple truncation strategy if shrinking is not enough (though prompt says "don't truncate")
             // For strict adherence, we'd return the text even if it overflows, or make minFontSize smaller.
             // Given "只缩小字体，不截断文本", we accept potential overflow if minFontSize is reached.
        }
        return { text: textToRender, fontSize: `${fontSize}px` };
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.margin_top || 60, 
        right: variables.margin_right || 40, 
        bottom: variables.margin_bottom || 40, 
        left: variables.margin_left || 40 
    };
    
    // Legend dimensions (approximate, will be calculated more precisely)
    let legendHeight = 0; // Will be calculated in Block 7
    const legendItemHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.5;
    const legendPadding = 10;


    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => d[valueFieldName]);
    const dataWithPercentages = chartDataArray.map(d => ({
        ...d,
        percentage: (d[valueFieldName] / totalValue) * 100
    }));

    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null) // Keep original data order
        .startAngle(0)
        .endAngle(2 * Math.PI);

    const arcData = pieGenerator(dataWithPercentages);

    // Block 6: Scale Definition & Configuration
    // Color scale is handled by fillStyle.getSegmentColor
    // Positional scales are implicit in pie/arc generators

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2})`); // Position legend in top margin

    let currentX = 0;
    const legendRectSize = parseFloat(fillStyle.typography.labelFontSize);
    const legendSpacing = 5; // Space between rect and text
    const legendItemMargin = 15; // Space between legend items

    uniqueCategories.forEach((category, i) => {
        const legendItem = legendGroup.append("g")
            .attr("transform", `translate(${currentX}, 0)`);

        legendItem.append("rect")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", fillStyle.getSegmentColor(category))
            .attr("class", "mark");

        const legendTextElement = legendItem.append("text")
            .attr("x", legendRectSize + legendSpacing)
            .attr("y", legendRectSize / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .text(category)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "label");
        
        const itemWidth = legendRectSize + legendSpacing + estimateTextWidth(category, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        currentX += itemWidth + legendItemMargin;
    });
    
    // Calculate actual legend height (assuming single line for now)
    if (uniqueCategories.length > 0) {
        legendHeight = legendItemHeight + legendPadding; // Add padding below legend
    }
    
    // Adjust main chart group position based on legend
    const chartRenderWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartRenderHeight = containerHeight - chartMargins.top - chartMargins.bottom - legendHeight;

    const outerRadius = Math.min(chartRenderWidth, chartRenderHeight) / 2 * 0.9; // 0.9 for some padding
    const innerRadiusRatio = variables.innerRadiusRatio || 0.6; // Default inner radius ratio
    const innerRadius = outerRadius * innerRadiusRatio;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left + chartRenderWidth / 2}, ${chartMargins.top + legendHeight + chartRenderHeight / 2})`);


    // Block 8: Main Data Visualization Rendering
    const arcGenerator = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .padAngle(0.01); // Small padAngle for visual separation, can be 0

    const segments = mainChartGroup.selectAll(".arc-segment")
        .data(arcData)
        .enter()
        .append("g")
        .attr("class", "arc-segment");

    segments.append("path")
        .attr("d", arcGenerator)
        .attr("fill", d => fillStyle.getSegmentColor(d.data[categoryFieldName]))
        .attr("stroke", fillStyle.segmentStrokeColor)
        .attr("stroke-width", 2) // Standardize stroke width
        .attr("class", "mark value");

    // Add labels and connector lines
    const labelOffset = variables.labelOffset || 20; // Distance from outer arc for labels
    const leaderLineOuterPointRadius = outerRadius + labelOffset / 2;
    const labelRadius = outerRadius + labelOffset;

    segments.each(function(d, i) {
        const segmentGroup = d3.select(this);
        const angle = (d.startAngle + d.endAngle) / 2;
        const isRightHalf = angle < Math.PI; // Angle relative to positive y-axis (top)

        // Connector line
        const arcCentroid = arcGenerator.centroid(d);
        const lineEndX = Math.sin(angle) * leaderLineOuterPointRadius;
        const lineEndY = -Math.cos(angle) * leaderLineOuterPointRadius;

        segmentGroup.append("line")
            .attr("x1", arcCentroid[0])
            .attr("y1", arcCentroid[1])
            .attr("x2", lineEndX)
            .attr("y2", lineEndY)
            .attr("stroke", fillStyle.labelLineColor)
            .attr("stroke-width", 1)
            .attr("class", "connector-line other");

        // Label text
        const labelX = Math.sin(angle) * labelRadius;
        const labelY = -Math.cos(angle) * labelRadius;
        
        const categoryText = d.data[categoryFieldName];
        const valueText = `${d.data.percentage.toFixed(1)}%`; // (${d.data[valueFieldName]})

        const categoryLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
        const valueLabelFontSize = parseFloat(fillStyle.typography.labelFontSize) * 0.9;

        // Fit category text
        const fittedCategory = fitTextToWidth(
            categoryText,
            `${categoryLabelFontSize}px`,
            fillStyle.typography.labelFontWeight,
            fillStyle.typography.labelFontFamily,
            chartRenderWidth * 0.2 // Max width for label part
        );
        
        segmentGroup.append("text")
            .attr("transform", `translate(${labelX}, ${labelY})`)
            .attr("dy", -2) // Adjust vertical position slightly for category
            .attr("text-anchor", isRightHalf ? "start" : "end")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fittedCategory.fontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(fittedCategory.text)
            .attr("class", "label category-label");

        segmentGroup.append("text")
            .attr("transform", `translate(${labelX}, ${labelY})`)
            .attr("dy", parseFloat(fittedCategory.fontSize) * 0.9 + 2) // Position value below category
            .attr("text-anchor", isRightHalf ? "start" : "end")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${valueLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(valueText)
            .attr("class", "label value-label");
    });


    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons)
    const iconSizeRatio = variables.iconSizeRatio || 0.3; // Relative to innerRadius band width
    const minIconSize = variables.minIconSize || 16;
    const maxIconSize = variables.maxIconSize || 40;
    
    segments.each(function(d, i) {
        const iconUrl = fillStyle.getIconUrl(d.data[categoryFieldName]);
        if (iconUrl) {
            const segmentGroup = d3.select(this);
            const angle = (d.startAngle + d.endAngle) / 2;
            
            // Calculate icon size based on the space available in the segment's radial depth
            const radialDepth = outerRadius - innerRadius;
            let iconDim = Math.min(maxIconSize, Math.max(minIconSize, radialDepth * iconSizeRatio));
            
            // Ensure icon fits angularly too (approx)
            const arcLengthAtMidRadius = ( (innerRadius + outerRadius) / 2 ) * (d.endAngle - d.startAngle);
            iconDim = Math.min(iconDim, arcLengthAtMidRadius * 0.7); // Ensure it's not wider than 70% of arc length

            if (iconDim < minIconSize / 2) return; // Icon too small to be useful

            const iconRadiusPosition = innerRadius + (outerRadius - innerRadius) / 2; // Center icon radially
            const iconX = Math.sin(angle) * iconRadiusPosition - iconDim / 2;
            const iconY = -Math.cos(angle) * iconRadiusPosition - iconDim / 2;

            const clipId = `icon-clip-${i}`;
            svgRoot.append("defs") // Defs should be on svgRoot
                .append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("cx", iconX + iconDim / 2) // Clip path relative to its own coordinate system if not transformed
                .attr("cy", iconY + iconDim / 2) // Or relative to the group it's applied to.
                                                // Here, image is in segmentGroup, so clip path coords are fine.
                .attr("r", iconDim / 2);

            segmentGroup.append("image")
                .attr("xlink:href", iconUrl)
                .attr("x", iconX)
                .attr("y", iconY)
                .attr("width", iconDim)
                .attr("height", iconDim)
                .attr("clip-path", `url(#${clipId})`)
                .attr("class", "icon image");
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}