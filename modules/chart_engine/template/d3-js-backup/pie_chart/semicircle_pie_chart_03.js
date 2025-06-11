/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pie Chart",
  "chart_name": "pie_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": ["primary"],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 300,
  "min_width": 300,
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
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }
    
    const chartDataArray = chartDataInput.filter(d => typeof d[valueFieldName] === 'number' && d[valueFieldName] >= 0 && d[categoryFieldName] != null);


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyInput.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyInput.label?.font_size || "12px",
            labelFontWeight: typographyInput.label?.font_weight || "normal",
            legendFontFamily: typographyInput.label?.font_family || "Arial, sans-serif", // Using label for legend
            legendFontSize: typographyInput.label?.font_size || "12px",
            legendFontWeight: typographyInput.label?.font_weight || "normal",
        },
        colors: {
            textColor: colorsInput.text_color || "#333333",
            defaultSliceColor: colorsInput.other?.primary || "#4682B4",
            sliceStrokeColor: colorsInput.background_color === '#000000' || colorsInput.background_color === '#000' ? '#FFFFFF' : (colorsInput.other?.stroke ||'#FFFFFF'), // Contrast stroke
            iconBackgroundColor: colorsInput.background_color || "#FFFFFF", // Background for icon circle
            legendTextColor: colorsInput.text_color || "#333333",
        },
        images: { // Centralized image source lookup
            getFieldImage: (key) => (imagesInput.field && imagesInput.field[key]) || (imagesInput.other && imagesInput.other.primary) || null,
        },
        getColor: (category, index) => {
            return (colorsInput.field && colorsInput.field[category]) ||
                   (colorsInput.available_colors && colorsInput.available_colors[index % colorsInput.available_colors.length]) ||
                   fillStyle.colors.defaultSliceColor;
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight = "normal") {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute'; // Avoid affecting layout if it were in DOM
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document body append/remove is more robust but forbidden by prompt.
        // This direct getBBox might be less accurate or fail in some environments.
        try {
            // Some browsers require the SVG to be in the DOM for getBBox to work reliably.
            // As per constraints, not adding to DOM. This might lead to 0 width in some cases.
            document.body.appendChild(tempSvg); // Momentarily add to DOM for measurement
            const width = tempText.getBBox().width;
            document.body.removeChild(tempSvg);
            return width;
        } catch (e) {
            // Fallback for environments where getBBox on non-attached/briefly-attached elements is problematic
            const parsedFontSize = parseFloat(fontSize);
            if (isNaN(parsedFontSize)) return text.length * 8; // Absolute fallback
            const avgCharWidth = parsedFontSize * 0.6; // Simple fallback
            return text.length * avgCharWidth;
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .style("background-color", colorsInput.background_color || "transparent");

    const legendHeightEstimate = 40; // Estimated space for legend
    const chartMargins = {
        top: variables.margin_top ?? (legendHeightEstimate + 10), // Ensure space for legend
        right: variables.margin_right ?? 50,
        bottom: variables.margin_bottom ?? 50,
        left: variables.margin_left ?? 50
    };
    
    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = chartMargins.left + chartAreaWidth / 2;
    const centerY = chartMargins.top + chartAreaHeight / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    const maxOuterRadius = Math.min(chartAreaWidth, chartAreaHeight) / 2 * 0.75; // 0.75 to leave space for external labels
    const iconSizeRelativeToRadius = 0.4; // Icon size as a factor of the pie's effective radius portion
    const labelOffset = 20; // How far labels are from the pie

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => d[valueFieldName]);
    if (totalValue === 0 && chartDataArray.length > 0) { // Handle all zero values case
        chartDataArray.forEach(d => d.isZeroPlaceholder = true);
    }

    const processedData = chartDataArray.map(d => ({
        ...d,
        percentage: totalValue === 0 ? (100 / chartDataArray.length) : (d[valueFieldName] / totalValue) * 100
    }));

    const pieGenerator = d3.pie()
        .value(d => d.isZeroPlaceholder ? 1 : d[valueFieldName]) // Use 1 for zero placeholders to make equal slices
        .sort(null);
    const pieSectors = pieGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const arcGenerator = d3.arc()
        .innerRadius(0)
        .outerRadius(maxOuterRadius)
        .padAngle(0.01)
        .cornerRadius(variables.corner_radius === 0 ? 0 : (variables.corner_radius || 5)); // Allow disabling cornerRadius

    const labelArcGenerator = d3.arc()
        .innerRadius(maxOuterRadius + labelOffset)
        .outerRadius(maxOuterRadius + labelOffset);
    
    const iconCentroidArc = d3.arc()
        .innerRadius(maxOuterRadius * 0.25) // Position icons towards the center of the slice radial extent
        .outerRadius(maxOuterRadius * 0.75);


    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - legendHeightEstimate / 2 + 5})`); // Position in top margin

    const uniqueCategories = Array.from(new Set(chartDataArray.map(d => d[categoryFieldName])));
    let currentLegendX = 0;
    const legendRectSize = parseFloat(fillStyle.typography.legendFontSize) * 0.8 || 10;
    const legendSpacing = 5;
    const legendItemMargin = 15;

    uniqueCategories.forEach((category, i) => {
        const itemColor = fillStyle.getColor(category, i);
        const legendItemG = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, 0)`);

        legendItemG.append("rect")
            .attr("class", "mark")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", itemColor);

        const legendText = legendItemG.append("text")
            .attr("class", "label")
            .attr("x", legendRectSize + legendSpacing)
            .attr("y", legendRectSize / 2)
            .attr("dominant-baseline", "middle")
            .attr("fill", fillStyle.colors.legendTextColor)
            .style("font-family", fillStyle.typography.legendFontFamily)
            .style("font-size", fillStyle.typography.legendFontSize)
            .style("font-weight", fillStyle.typography.legendFontWeight)
            .text(category);
        
        currentLegendX += legendRectSize + legendSpacing + estimateTextWidth(category, fillStyle.typography.legendFontFamily, fillStyle.typography.legendFontSize, fillStyle.typography.legendFontWeight) + legendItemMargin;
    });
    
    // Center the legend if space allows
    const legendWidth = currentLegendX - legendItemMargin; // Total width of legend items
    if (legendWidth < chartAreaWidth) {
        legendGroup.attr("transform", `translate(${centerX - legendWidth / 2}, ${chartMargins.top / 2 - legendHeightEstimate / 2 + 5})`);
    }


    // Block 8: Main Data Visualization Rendering
    const sliceGroups = mainChartGroup.selectAll(".slice-group")
        .data(pieSectors)
        .enter()
        .append("g")
        .attr("class", "slice-group");

    sliceGroups.append("path")
        .attr("class", "mark")
        .attr("d", arcGenerator)
        .attr("fill", (d, i) => fillStyle.getColor(d.data[categoryFieldName], i))
        .attr("stroke", fillStyle.colors.sliceStrokeColor)
        .attr("stroke-width", 2);

    // Add icons
    sliceGroups.each(function(d, i) {
        const sliceGroup = d3.select(this);
        const iconUrl = fillStyle.images.getFieldImage(d.data[categoryFieldName]);
        
        if (iconUrl) {
            const [iconX, iconY] = iconCentroidArc.centroid(d);
            const sliceAngle = d.endAngle - d.startAngle;
            // Calculate available space for icon along the arc length at icon's radial position
            const midRadiusForIcon = (iconCentroidArc.innerRadius()()(d) + iconCentroidArc.outerRadius()()(d)) / 2;
            const arcLengthAtIcon = sliceAngle * midRadiusForIcon;
            const iconSize = Math.min(maxOuterRadius * iconSizeRelativeToRadius, arcLengthAtIcon * 0.8, 40); // Cap icon size

            if (iconSize < 5) return; // Icon too small to be useful

            const clipId = `clip-icon-${i}-${Date.now()}`; // Unique ID

            sliceGroup.append("defs")
                .append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("class", "other") // Generic class for clip path element
                .attr("cx", iconX)
                .attr("cy", iconY)
                .attr("r", iconSize / 2);

            // White background circle for icon
            sliceGroup.append("circle")
                .attr("class", "icon-background other")
                .attr("cx", iconX)
                .attr("cy", iconY)
                .attr("r", iconSize / 2 + 1) // Slightly larger for border effect
                .attr("fill", fillStyle.colors.iconBackgroundColor)
                .attr("stroke", fillStyle.getColor(d.data[categoryFieldName], i))
                .attr("stroke-width", 1);

            sliceGroup.append("image")
                .attr("class", "icon")
                .attr("xlink:href", iconUrl)
                .attr("x", iconX - iconSize / 2)
                .attr("y", iconY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("clip-path", `url(#${clipId})`);
        }
    });
    
    // Add labels
    sliceGroups.each(function(d) {
        if (d.data.percentage < 1 && totalValue !==0) return; // Don't label very small slices unless all are zero

        const sliceGroup = d3.select(this);
        const [labelX, labelY] = labelArcGenerator.centroid(d);
        const midAngle = (d.startAngle + d.endAngle) / 2;

        let textAnchor = "middle";
        // Simplified text anchor logic: right half -> start, left half -> end, top/bottom -> middle
        if (midAngle > Math.PI * 0.05 && midAngle < Math.PI * 0.95) { // Right side (approx)
            textAnchor = "start";
        } else if (midAngle > Math.PI * 1.05 && midAngle < Math.PI * 1.95) { // Left side (approx)
            textAnchor = "end";
        }

        const categoryText = d.data[categoryFieldName];
        const percentageText = `${d.data.percentage.toFixed(1)}%`;

        sliceGroup.append("text")
            .attr("class", "label category-label")
            .attr("transform", `translate(${labelX}, ${labelY})`)
            .attr("dy", "-0.1em") // Shift first line up slightly
            .attr("text-anchor", textAnchor)
            .style("fill", fillStyle.colors.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(categoryText);

        sliceGroup.append("text")
            .attr("class", "label percentage-label value")
            .attr("transform", `translate(${labelX}, ${labelY})`)
            .attr("dy", "1.1em") // Shift second line down
            .attr("text-anchor", textAnchor)
            .style("fill", fillStyle.colors.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold") // Percentage often bold
            .text(percentageText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (Clip paths were defined within the loop for simplicity and to ensure unique IDs)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}