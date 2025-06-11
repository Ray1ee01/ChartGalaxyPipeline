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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!categoryFieldDef || !categoryFieldDef.name) {
        console.error("Critical chart config missing: Category field (role 'x') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Category field configuration is missing.</div>");
        return null;
    }
    if (!valueFieldDef || !valueFieldDef.name) {
        console.error("Critical chart config missing: Value field (role 'y') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Value field configuration is missing.</div>");
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    const chartDataArray = chartDataInput.filter(d =>
        d[categoryFieldName] != null &&
        d[valueFieldName] != null &&
        !isNaN(parseFloat(d[valueFieldName])) &&
        parseFloat(d[valueFieldName]) >= 0
    );

    if (chartDataArray.length === 0) {
        console.error("No valid data available to render the chart after filtering.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colorsConfig.text_color || '#303030',
        backgroundColor: colorsConfig.background_color || '#FFFFFF',
        defaultSliceColor: (colorsConfig.other && colorsConfig.other.primary) || '#5DA5DA',
        iconBackgroundColor: '#FFFFFF',
        leaderLineColor: '#B0B0B0',
        typography: {
            label: {
                fontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
                fontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
                fontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
                color: colorsConfig.text_color || '#303030'
            },
            legend: {
                fontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
                fontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
                fontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
                color: colorsConfig.text_color || '#303030'
            }
        }
    };

    let d3ColorScale;
    if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
        d3ColorScale = d3.scaleOrdinal().range(colorsConfig.available_colors);
    } else {
        d3ColorScale = d3.scaleOrdinal(d3.schemeTableau10);
    }

    fillStyle.getCategoryColor = (category) => {
        if (colorsConfig.field && colorsConfig.field[category]) {
            return colorsConfig.field[category];
        }
        return d3ColorScale(category);
    };

    fillStyle.iconBorderColor = (category) => fillStyle.getCategoryColor(category);

    fillStyle.getImageUrl = (category) => {
        if (imagesConfig.field && imagesConfig.field[category]) {
            return imagesConfig.field[category];
        }
        return null;
    };

    function estimateTextWidth(text, fontSize, fontFamily, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('style', `font-family: ${fontFamily}; font-size: ${fontSize}; font-weight: ${fontWeight}; white-space: pre;`);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        try {
            return textNode.getBBox().width;
        } catch (e) {
            const avgCharWidth = parseFloat(fontSize) * 0.6;
            return text.length * avgCharWidth;
        }
    }

    function fitTextToWidth(text, initialFontSizeStr, fontFamily, fontWeight, maxWidth, minFontSizeVal = 8) {
        let fontSize = parseFloat(initialFontSizeStr);
        let currentWidth = estimateTextWidth(text, `${fontSize}px`, fontFamily, fontWeight);

        while (currentWidth > maxWidth && fontSize > minFontSizeVal) {
            fontSize -= 1;
            currentWidth = estimateTextWidth(text, `${fontSize}px`, fontFamily, fontWeight);
        }
        return { text, fontSize: `${fontSize}px` };
    }

    function calculateOuterLabelPosition(d, arcGenerator, outerRadius, labelOffset = 30) {
        const [x, y] = arcGenerator.centroid(d);
        const angle = Math.atan2(y, x); 
        const effectiveRadius = outerRadius + labelOffset;
        return [Math.cos(angle) * effectiveRadius, Math.sin(angle) * effectiveRadius];
    }

    function hasEnoughSpaceForIcon(d, arcInnerRadius, minArcLengthForIcon = 25) { // Reduced minArcLength slightly
        const sectorAngle = d.endAngle - d.startAngle;
        const arcLength = sectorAngle * arcInnerRadius;
        return arcLength >= minArcLengthForIcon;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root-svg")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 30, bottom: 30, left: 30 }; // Adjusted margins for labels
    const legendOptions = {
        itemHeight: 20, spacing: 10, symbolSize: 14, textPadding: 5,
        paddingBelowLegend: 20, 
        maxWidthRatio: 0.95
    };

    let legendRenderedHeight = 0;
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 7: Chart Component Rendering (Legend)
    const categoriesForLegend = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];

    function renderLegend(legendContainer, cats, style, opts) {
        let currentX = 0;
        let currentY = 0;
        const legendAreaMaxWidth = (containerWidth - chartMargins.left - chartMargins.right) * opts.maxWidthRatio;

        cats.forEach((cat) => {
            const color = style.getCategoryColor(cat);
            const textWidth = estimateTextWidth(cat, style.typography.legend.fontSize, style.typography.legend.fontFamily, style.typography.legend.fontWeight);
            const itemWidth = opts.symbolSize + opts.textPadding + textWidth;

            if (currentX + itemWidth > legendAreaMaxWidth && currentX > 0) {
                currentX = 0;
                currentY += opts.itemHeight + opts.spacing / 2;
            }

            const itemGroup = legendContainer.append("g")
                .attr("transform", `translate(${currentX}, ${currentY})`)
                .attr("class", "legend-item");

            itemGroup.append("rect")
                .attr("x", 0)
                .attr("y", (opts.itemHeight - opts.symbolSize) / 2)
                .attr("width", opts.symbolSize)
                .attr("height", opts.symbolSize)
                .attr("fill", color)
                .attr("class", "mark legend-symbol");

            itemGroup.append("text")
                .attr("x", opts.symbolSize + opts.textPadding)
                .attr("y", opts.itemHeight / 2)
                .attr("dominant-baseline", "middle")
                .style("font-family", style.typography.legend.fontFamily)
                .style("font-size", style.typography.legend.fontSize)
                .style("font-weight", style.typography.legend.fontWeight)
                .style("fill", style.typography.legend.color)
                .text(cat)
                .attr("class", "label legend-label");

            currentX += itemWidth + opts.spacing;
        });
        return currentY + opts.itemHeight;
    }

    if (categoriesForLegend.length > 0) {
        legendRenderedHeight = renderLegend(legendGroup, categoriesForLegend, fillStyle, legendOptions);
    }

    const donutAreaTop = chartMargins.top + legendRenderedHeight + (legendRenderedHeight > 0 ? legendOptions.paddingBelowLegend : 0);
    const donutAreaLeft = chartMargins.left;
    const donutAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const donutAreaHeight = containerHeight - donutAreaTop - chartMargins.bottom;

    if (donutAreaWidth <= 20 || donutAreaHeight <= 20) { // Check for minimal drawable area
        console.error("Not enough space to render the chart after accounting for margins and legend.");
        svgRoot.html("<text x='10' y='20' fill='red'>Error: Not enough space for chart.</text>");
        return svgRoot.node();
    }
    
    const donutCenterX = donutAreaLeft + donutAreaWidth / 2;
    const donutCenterY = donutAreaTop + donutAreaHeight / 2;

    const outerRadius = Math.min(donutAreaWidth, donutAreaHeight) / 2 * 0.85; // Adjusted for labels
    const innerRadius = outerRadius * 0.55; // Slightly thicker donut ring

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${donutCenterX}, ${donutCenterY})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => parseFloat(d[valueFieldName]));
    if (totalValue === 0 && chartDataArray.length > 0) { // Handle case where all values are 0
         // Display a message or render empty state, for now, it will render 0% slices
    }

    const chartDataProcessed = chartDataArray.map(d => ({
        ...d,
        value: parseFloat(d[valueFieldName]),
        percentage: totalValue > 0 ? (parseFloat(d[valueFieldName]) / totalValue) * 100 : 0
    }));

    const pieGenerator = d3.pie()
        .value(d => d.value)
        .sort(null)
        .startAngle(0)
        .endAngle(2 * Math.PI);

    const donutSectors = pieGenerator(chartDataProcessed);

    // Block 6: Scale Definition & Configuration (Arc Generator)
    const arcGenerator = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .padAngle(0.015) // Slightly increased padding
        .cornerRadius(3); // Slightly reduced corner radius

    // Block 8: Main Data Visualization Rendering (Donut Slices)
    const sliceGroups = mainChartGroup.selectAll(".slice-group")
        .data(donutSectors.filter(d => d.data.value > 0 || chartDataArray.length === 1)) // Filter zero-value slices unless it's the only one
        .enter()
        .append("g")
        .attr("class", "slice-group");

    sliceGroups.append("path")
        .attr("d", arcGenerator)
        .attr("fill", d => fillStyle.getCategoryColor(d.data[categoryFieldName]))
        .attr("class", "mark slice");

    // Block 9: Optional Enhancements & Post-Processing (Icons, Labels, Leader Lines)
    sliceGroups.each(function (d) {
        const sliceGroup = d3.select(this);
        const category = d.data[categoryFieldName];
        const iconUrl = fillStyle.getImageUrl(category);

        if (iconUrl && hasEnoughSpaceForIcon(d, innerRadius)) {
            const sectorAngle = d.endAngle - d.startAngle;
            const iconPlacementRadius = innerRadius + (outerRadius - innerRadius) * 0.30;
            const arcLengthAtIconRadius = sectorAngle * iconPlacementRadius;

            const minIconSize = 12;
            const maxIconSize = Math.min(30, (outerRadius - innerRadius) * 0.5);
            let iconSize = Math.min(maxIconSize, Math.max(minIconSize, arcLengthAtIconRadius * 0.35));
            iconSize = Math.min(iconSize, (outerRadius - innerRadius) * 0.6);

            const angle = (d.startAngle + d.endAngle) / 2 - Math.PI / 2;
            const iconX = Math.cos(angle) * iconPlacementRadius;
            const iconY = Math.sin(angle) * iconPlacementRadius;
            const clipId = `icon-clip-${category.replace(/[^a-zA-Z0-9]/g, '')}`; // Sanitize ID

            mainChartGroup.append("defs").append("clipPath") // Append defs to mainChartGroup to avoid duplicates
                .attr("id", clipId)
                .append("circle")
                .attr("cx", iconX)
                .attr("cy", iconY)
                .attr("r", iconSize / 2);

            sliceGroup.append("circle")
                .attr("cx", iconX)
                .attr("cy", iconY)
                .attr("r", iconSize / 2 + 1.5)
                .attr("fill", fillStyle.iconBackgroundColor)
                .attr("stroke", fillStyle.iconBorderColor(category))
                .attr("stroke-width", 1)
                .attr("class", "other icon-background");

            sliceGroup.append("image")
                .attr("xlink:href", iconUrl)
                .attr("x", iconX - iconSize / 2)
                .attr("y", iconY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("clip-path", `url(#${clipId})`)
                .attr("class", "icon item-icon");
        }

        const labelPosition = calculateOuterLabelPosition(d, arcGenerator, outerRadius, 20);
        const [lineStartX, lineStartY] = arcGenerator.centroid(d);

        sliceGroup.append("line")
            .attr("x1", lineStartX)
            .attr("y1", lineStartY)
            .attr("x2", labelPosition[0])
            .attr("y2", labelPosition[1])
            .attr("stroke", fillStyle.leaderLineColor)
            .attr("stroke-width", 1)
            .attr("class", "other leader-line");

        const labelGroup = sliceGroup.append("g")
            .attr("transform", `translate(${labelPosition[0]}, ${labelPosition[1]})`)
            .attr("class", "label-group");

        const textAnchor = (labelPosition[0] >= 0) ? "start" : "end";
        const labelFontSizeNum = parseFloat(fillStyle.typography.label.fontSize);
        const maxLabelWidth = Math.max(60, donutAreaWidth / 7);

        const fittedCategory = fitTextToWidth(
            d.data[categoryFieldName],
            fillStyle.typography.label.fontSize,
            fillStyle.typography.label.fontFamily,
            fillStyle.typography.label.fontWeight,
            maxLabelWidth
        );
        
        labelGroup.append("text")
            .attr("dy", -labelFontSizeNum * 0.1) 
            .attr("text-anchor", textAnchor)
            .style("font-family", fillStyle.typography.label.fontFamily)
            .style("font-size", fittedCategory.fontSize)
            .style("font-weight", fillStyle.typography.label.fontWeight)
            .style("fill", fillStyle.typography.label.color)
            .text(fittedCategory.text)
            .attr("class", "label data-label category-label");
        
        const valueText = `${d.data.percentage.toFixed(1)}% (${d.data.value})`;
        const fittedValue = fitTextToWidth(
            valueText,
            `${parseFloat(fillStyle.typography.label.fontSize) * 0.9}px`,
            fillStyle.typography.label.fontFamily,
            fillStyle.typography.label.fontWeight,
            maxLabelWidth
        );

        labelGroup.append("text")
            .attr("dy", labelFontSizeNum * 1.0) 
            .attr("text-anchor", textAnchor)
            .style("font-family", fillStyle.typography.label.fontFamily)
            .style("font-size", fittedValue.fontSize)
            .style("font-weight", fillStyle.typography.label.fontWeight)
            .style("fill", d3.color(fillStyle.typography.label.color).darker(0.3).toString())
            .text(fittedValue.text)
            .attr("class", "label data-label value-label");
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}