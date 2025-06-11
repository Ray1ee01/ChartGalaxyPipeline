/* REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_chart_03_d3",
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
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_edge"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The REQUIREMENTS_BEGIN...END block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldDef = dataColumns.find(col => col.role === 'x');
    const valueFieldDef = dataColumns.find(col => col.role === 'y');

    if (!categoryFieldDef || !categoryFieldDef.name || !valueFieldDef || !valueFieldDef.name) {
        console.error("Critical chart config missing: 'x' or 'y' role field name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration missing (x or y field).</div>");
        return null;
    }
    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const T = { // Merged Typography
        title: { ...defaultTypography.title, ...rawTypography.title },
        label: { ...defaultTypography.label, ...rawTypography.label },
        annotation: { ...defaultTypography.annotation, ...rawTypography.annotation }
    };

    const defaultColors = {
        field: {},
        other: { primary: "#4682B4" },
        available_colors: [...d3.schemeCategory10],
        background_color: "#FFFFFF",
        text_color: "#333333"
    };

    const C = { // Merged Colors
        ...defaultColors,
        ...rawColors,
        other: { ...defaultColors.other, ...rawColors.other },
        field: { ...defaultColors.field, ...rawColors.field },
        available_colors: rawColors.available_colors && rawColors.available_colors.length > 0 ? rawColors.available_colors : defaultColors.available_colors,
        background_color: rawColors.background_color || defaultColors.background_color,
        text_color: rawColors.text_color || defaultColors.text_color
    };
    
    const I = { // Merged Images
        field: rawImages.field || {},
        other: rawImages.other || {}
    };

    const fillStyle = {
        typography: {
            titleFontFamily: T.title.font_family,
            titleFontSize: T.title.font_size,
            titleFontWeight: T.title.font_weight,
            labelFontFamily: T.label.font_family,
            labelFontSize: T.label.font_size,
            labelFontWeight: T.label.font_weight,
            annotationFontFamily: T.annotation.font_family,
            annotationFontSize: T.annotation.font_size,
            annotationFontWeight: T.annotation.font_weight,
        },
        textColor: C.text_color,
        backgroundColor: C.background_color,
        primaryColor: C.other.primary,
        defaultCategoryColors: C.available_colors
    };

    function estimateTextWidth(text, fontProps) {
        if (!text || text.length === 0) return 0;
        const { family, size, weight } = fontProps;
        const fontSizePx = parseFloat(size);

        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', family);
        textNode.setAttribute('font-size', fontSizePx + 'px');
        textNode.setAttribute('font-weight', weight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            console.warn("getBBox on in-memory text failed, falling back to rough estimate.", e);
            width = text.length * fontSizePx * 0.6; 
        }
        return width;
    }
    
    function getTextHeightEstimate(fontProps) {
        const fontSizePx = parseFloat(fontProps.size);
        return fontSizePx * 1.2; 
    }

    const getColor = (categoryKey, index) => {
        if (C.field && C.field[categoryKey]) {
            return C.field[categoryKey];
        }
        if (fillStyle.defaultCategoryColors.length > 0) {
            return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
        }
        return fillStyle.primaryColor;
    };

    const getImageUrl = (categoryKey) => {
        if (I.field && I.field[categoryKey]) {
            return I.field[categoryKey];
        }
        return null;
    };

    function fitTextToWidth(text, initialFontProps, maxWidth, estimateWidthFunc) {
        let currentText = text;
        let currentFontSize = parseFloat(initialFontProps.size);
        const minFontSize = 8; 

        let textWidth = estimateWidthFunc(currentText, { ...initialFontProps, size: currentFontSize + 'px' });

        while (textWidth > maxWidth && currentFontSize > minFontSize) {
            currentFontSize = Math.max(minFontSize, currentFontSize - 1);
            textWidth = estimateWidthFunc(currentText, { ...initialFontProps, size: currentFontSize + 'px' });
        }
        
        if (textWidth > maxWidth && currentText.length > 0) {
            // Estimate average character width for the current (possibly reduced) font size
            const avgCharWidth = estimateWidthFunc("M", { ...initialFontProps, size: currentFontSize + 'px' }) || currentFontSize * 0.6;
            let maxChars = Math.floor(maxWidth / avgCharWidth);
            if (maxChars <= 2) currentText = ".."; 
            else if (maxChars < currentText.length) currentText = text.substring(0, maxChars - 2) + "..";
        }
        
        return { 
            text: currentText, 
            fontProps: { ...initialFontProps, size: currentFontSize + 'px' }
        };
    }

    function calculateLabelPosition(d_arc, iconCentroid, iconSize, innerR, outerR, labelWidth, labelHeight) {
        const angle = (d_arc.startAngle + d_arc.endAngle) / 2;
        const defaultLabelRadius = (innerR + outerR) / 2;
        
        let x = Math.sin(angle) * defaultLabelRadius;
        let y = -Math.cos(angle) * defaultLabelRadius;

        if (!iconCentroid || iconSize === 0) return [x, y];

        const textBBox = { x: x - labelWidth / 2, y: y - labelHeight / 2, width: labelWidth, height: labelHeight };
        const iconBBox = { x: iconCentroid[0] - iconSize / 2, y: iconCentroid[1] - iconSize / 2, width: iconSize, height: iconSize };

        const overlapX = Math.max(0, Math.min(textBBox.x + textBBox.width, iconBBox.x + iconBBox.width) - Math.max(textBBox.x, iconBBox.x));
        const overlapY = Math.max(0, Math.min(textBBox.y + textBBox.height, iconBBox.y + iconBBox.height) - Math.max(textBBox.y, iconBBox.y));

        if (overlapX > 0 && overlapY > 0) {
            const safetyMargin = 5;
            const distTextToIconCenter = Math.sqrt(Math.pow(x - iconCentroid[0], 2) + Math.pow(y - iconCentroid[1], 2));
            const requiredDist = (iconSize / 2) + (Math.max(labelWidth, labelHeight) / 2) + safetyMargin;

            if (distTextToIconCenter < requiredDist) {
                if (distTextToIconCenter > 1e-6) {
                    const dx = x - iconCentroid[0];
                    const dy = y - iconCentroid[1];
                    const scaleFactor = requiredDist / distTextToIconCenter;
                    x = iconCentroid[0] + dx * scaleFactor;
                    y = iconCentroid[1] + dy * scaleFactor;
                } else { // Centers are coincident
                    const adjustedRadius = outerR + labelHeight / 2 + safetyMargin;
                    x = Math.sin(angle) * adjustedRadius;
                    y = -Math.cos(angle) * adjustedRadius;
                }
            }
        }
        return [x, y];
    }
    
    function layoutLegend(legendContainer, categories, colorFunc, legendOptions) {
        const { x, y, itemHeight, spacing, HitemPadding, VitemPadding, maxLegendWidth, textProps, titleTextProps } = legendOptions;
        let currentX = x;
        let currentY = y;
        let legendActualWidth = 0;
        let rowMaxHeight = 0;

        const legendTitleText = categoryFieldDef.label || categoryFieldName;
        const legendTitleWidth = estimateTextWidth(legendTitleText, titleTextProps);
        
        legendContainer.append("text")
            .attr("class", "label legend-title")
            .attr("x", currentX)
            .attr("y", currentY + itemHeight / 2)
            .attr("dominant-baseline", "middle")
            .style("font-family", titleTextProps.family)
            .style("font-size", titleTextProps.size)
            .style("font-weight", titleTextProps.weight)
            .style("fill", fillStyle.textColor)
            .text(legendTitleText);

        currentX += legendTitleWidth + HitemPadding * 2;
        legendActualWidth = currentX - x;
        rowMaxHeight = itemHeight;

        categories.forEach((cat, i) => {
            const itemGroup = legendContainer.append("g").attr("class", "legend-item");
            const rectSize = itemHeight * 0.6;
            
            itemGroup.append("rect")
                .attr("class", "mark legend-swatch")
                .attr("width", rectSize)
                .attr("height", rectSize)
                .attr("y", (itemHeight - rectSize) / 2) // Center swatch vertically in itemHeight
                .style("fill", colorFunc(cat, i));

            const labelText = String(cat); // Ensure it's a string
            const labelWidth = estimateTextWidth(labelText, textProps);
            
            itemGroup.append("text")
                .attr("class", "label legend-text")
                .attr("x", rectSize + HitemPadding)
                .attr("y", itemHeight / 2)
                .attr("dominant-baseline", "middle")
                .style("font-family", textProps.family)
                .style("font-size", textProps.size)
                .style("font-weight", textProps.weight)
                .style("fill", fillStyle.textColor)
                .text(labelText);

            const itemWidth = rectSize + HitemPadding + labelWidth;
            
            if (currentX + itemWidth > x + maxLegendWidth && currentX > x + legendTitleWidth + HitemPadding * 2) { // Wrap if not first item in row
                currentX = x + legendTitleWidth + HitemPadding * 2; // Align with items, not title start
                currentY += rowMaxHeight + VitemPadding;
                rowMaxHeight = 0;
            }
            itemGroup.attr("transform", `translate(${currentX}, ${currentY})`);
            
            currentX += itemWidth + spacing;
            legendActualWidth = Math.max(legendActualWidth, currentX - x - spacing);
            rowMaxHeight = Math.max(rowMaxHeight, itemHeight);
        });
        const legendActualHeight = currentY + rowMaxHeight - y;
        return { width: legendActualWidth, height: legendActualHeight };
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.backgroundColor);
    
    const defsNode = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const defaultMargins = { top: 60, right: 40, bottom: 40, left: 40 };
    const chartMargins = variables.margins || defaultMargins;

    const chartActualWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartActualHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const effectiveCenterX = chartMargins.left + chartActualWidth / 2;
    const effectiveCenterY = chartMargins.top + chartActualHeight / 2;
    
    const maxRadius = Math.min(chartActualWidth, chartActualHeight) / 2 * 0.95; // Give a little breathing room
    const innerRadius = maxRadius * 0.5;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-group")
        .attr("transform", `translate(${effectiveCenterX}, ${effectiveCenterY})`);

    // Block 5: Data Preprocessing & Transformation
    if (rawChartDataInput.length === 0) {
        mainChartGroup.append("text").attr("class", "label no-data-label").attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily).style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor).text("No data to display.");
        return svgRoot.node();
    }
    
    const totalValue = d3.sum(rawChartDataInput, d => d[valueFieldName]);
    const chartData = rawChartDataInput.map(d => ({
        ...d,
        percentage: totalValue === 0 ? 0 : (d[valueFieldName] / totalValue) * 100
    })).filter(d => d[valueFieldName] > 0);

    if (chartData.length === 0) {
         mainChartGroup.append("text").attr("class", "label no-data-label").attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily).style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor).text("All data values are zero or invalid.");
        return svgRoot.node();
    }

    const pieGenerator = d3.pie().value(d => d[valueFieldName]).sort(null);
    const arcsData = pieGenerator(chartData);

    // Block 6: Scale Definition & Configuration
    const arcPathGenerator = d3.arc().innerRadius(innerRadius).outerRadius(maxRadius).padAngle(0.01);

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g").attr("class", "legend axis"); // Added 'axis' class as per VII for complex components
    const uniqueCategories = Array.from(new Set(chartData.map(d => d[categoryFieldName])));
    
    const legendOptions = {
        x: 0, y: 0,
        itemHeight: parseFloat(fillStyle.typography.labelFontSize) * 1.5,
        spacing: 10, HitemPadding: 5, VitemPadding: 5,
        maxLegendWidth: chartActualWidth * 0.9, // Max width for legend items area (after title)
        textProps: { family: fillStyle.typography.labelFontFamily, size: fillStyle.typography.labelFontSize, weight: fillStyle.typography.labelFontWeight },
        titleTextProps: { family: fillStyle.typography.titleFontFamily, size: fillStyle.typography.titleFontSize, weight: fillStyle.typography.titleFontWeight }
    };

    const legendSize = layoutLegend(legendGroup, uniqueCategories, getColor, legendOptions);
    const legendX = chartMargins.left + (chartActualWidth - legendSize.width) / 2;
    const legendY = (chartMargins.top - legendSize.height) / 2;
    legendGroup.attr("transform", `translate(${Math.max(chartMargins.left, legendX)}, ${Math.max(5, legendY)})`);

    // Block 8: Main Data Visualization Rendering
    const arcSegmentGroups = mainChartGroup.selectAll(".arc-segment-group")
        .data(arcsData).enter().append("g").attr("class", "arc-segment-group");

    arcSegmentGroups.append("path")
        .attr("class", "mark arc-path")
        .attr("d", arcPathGenerator)
        .attr("fill", (d, i) => getColor(d.data[categoryFieldName], i));

    arcSegmentGroups.each(function(d_arc, i) {
        const segmentGroup = d3.select(this);
        const category = d_arc.data[categoryFieldName];
        
        const outerArcLength = (d_arc.endAngle - d_arc.startAngle) * maxRadius;
        let iconSize = Math.min(outerArcLength / 2.5, maxRadius * 0.2, 30);
        let iconPositionRadius = maxRadius + 5;

        if (iconSize < 12) iconSize = 0;
        else if ((d_arc.endAngle - d_arc.startAngle) < Math.PI / 10) iconPositionRadius = maxRadius + iconSize / 2 + 8;
        
        let iconCentroid = null;
        const imageUrl = getImageUrl(category);

        if (iconSize > 0 && imageUrl) {
            const iconArcGen = d3.arc().innerRadius(iconPositionRadius).outerRadius(iconPositionRadius);
            iconCentroid = iconArcGen.centroid(d_arc);
            const clipId = `clip-arc-${i}`;
            defsNode.append("clipPath").attr("id", clipId)
                .append("circle").attr("cx", iconCentroid[0]).attr("cy", iconCentroid[1]).attr("r", iconSize / 2);

            segmentGroup.append("circle").attr("class", "other icon-background")
                .attr("cx", iconCentroid[0]).attr("cy", iconCentroid[1]).attr("r", iconSize / 2 + 1.5)
                .style("fill", fillStyle.backgroundColor).style("stroke", getColor(category, i)).style("stroke-width", 1);

            segmentGroup.append("image").attr("class", "image icon")
                .attr("xlink:href", imageUrl).attr("clip-path", `url(#${clipId})`)
                .attr("x", iconCentroid[0] - iconSize / 2).attr("y", iconCentroid[1] - iconSize / 2)
                .attr("width", iconSize).attr("height", iconSize);
        } else { iconSize = 0; iconCentroid = null; }

        const labelTextCategory = String(category);
        const labelTextNumerical = d_arc.data.percentage >= 0.1 ? `${d_arc.data.percentage.toFixed(1)}%` : '';

        const catFontProps = { family: fillStyle.typography.labelFontFamily, size: fillStyle.typography.labelFontSize, weight: fillStyle.typography.labelFontWeight };
        const numFontProps = { family: fillStyle.typography.annotationFontFamily, size: fillStyle.typography.annotationFontSize, weight: fillStyle.typography.annotationFontWeight };
        
        const maxLblWidth = (d_arc.endAngle - d_arc.startAngle) * ((innerRadius + maxRadius) / 2) * 0.65;
        const fitCat = fitTextToWidth(labelTextCategory, catFontProps, maxLblWidth, estimateTextWidth);
        const fitNum = fitTextToWidth(labelTextNumerical, numFontProps, maxLblWidth, estimateTextWidth);

        const catH = fitCat.text ? getTextHeightEstimate(fitCat.fontProps) : 0;
        const numH = fitNum.text ? getTextHeightEstimate(fitNum.fontProps) : 0;
        const lblW = Math.max(fitCat.text ? estimateTextWidth(fitCat.text, fitCat.fontProps) : 0, fitNum.text ? estimateTextWidth(fitNum.text, fitNum.fontProps) : 0);
        const lblH = catH + (catH && numH ? 2 : 0) + numH;
        
        const [lblX, lblY] = calculateLabelPosition(d_arc, iconCentroid, iconSize, innerRadius, maxRadius, lblW, lblH);
        let currentYOffset = lblY - lblH / 2;

        if (fitCat.text) {
            segmentGroup.append("text").attr("class", "label category-label")
                .attr("x", lblX).attr("y", currentYOffset + catH / 2).attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                .style("font-family", fitCat.fontProps.family).style("font-size", fitCat.fontProps.size)
                .style("font-weight", fitCat.fontProps.weight).style("fill", fillStyle.textColor).text(fitCat.text);
            currentYOffset += catH + (numH ? 2 : 0);
        }
        if (fitNum.text) {
            segmentGroup.append("text").attr("class", "label numerical-label")
                .attr("x", lblX).attr("y", currentYOffset + numH / 2).attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                .style("font-family", fitNum.fontProps.family).style("font-size", fitNum.fontProps.size)
                .style("font-weight", fitNum.fontProps.weight).style("fill", fillStyle.textColor).text(fitNum.text);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}