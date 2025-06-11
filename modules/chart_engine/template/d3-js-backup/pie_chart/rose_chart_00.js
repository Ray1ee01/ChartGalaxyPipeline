/* REQUIREMENTS_BEGIN
{
  "chart_type": "Rose Chart",
  "chart_name": "rose_chart_new_00",
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
  "legend": "none",
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
    const chartDataInput = data.data.data || [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";

    const xColumn = dataColumns.find(col => col.role === xFieldRole);
    const yColumn = dataColumns.find(col => col.role === yFieldRole);

    if (!xColumn || !xColumn.name) {
        const errorMsg = "Critical chart config missing: X-axis field name (role 'x'). Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }
    if (!yColumn || !yColumn.name) {
        const errorMsg = "Critical chart config missing: Y-axis field name (role 'y'). Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = xColumn.name;
    const valueFieldName = yColumn.name;
    const valueFieldUnit = yColumn.unit || "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        iconUrls: {}, // Stores URL per category
        segmentColors: {}, // Stores color per category
    };

    const defaultPrimaryColor = '#4682B4';
    const defaultTextColor = '#333333';
    const defaultCategoricalPalette = d3.schemeCategory10; // Fallback if available_colors is empty

    fillStyle.chartBackground = colorsConfig.background_color || 'transparent'; // Default to transparent
    fillStyle.textColor = colorsConfig.text_color || defaultTextColor;
    fillStyle.textColorSubtle = colorsConfig.text_color ? d3.color(fillStyle.textColor).darker(0.5).toString() : '#777777';

    fillStyle.primaryColor = (colorsConfig.other && colorsConfig.other.primary) || defaultPrimaryColor;
    
    const uniqueCategories = Array.from(new Set(chartDataInput.map(d => d[categoryFieldName])));

    uniqueCategories.forEach((category, i) => {
        if (colorsConfig.field && colorsConfig.field[category]) {
            fillStyle.segmentColors[category] = colorsConfig.field[category];
        } else if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            fillStyle.segmentColors[category] = colorsConfig.available_colors[i % colorsConfig.available_colors.length];
        } else {
             // Fallback to d3.schemeCategory10 if primaryColor is also meant for non-categorical things
            fillStyle.segmentColors[category] = defaultCategoricalPalette[i % defaultCategoricalPalette.length];
        }

        if (imagesConfig.field && imagesConfig.field[category]) {
            fillStyle.iconUrls[category] = imagesConfig.field[category];
        } else {
            fillStyle.iconUrls[category] = null;
        }
    });
    
    fillStyle.getSegmentColor = (category) => fillStyle.segmentColors[category] || fillStyle.primaryColor; // Final fallback
    fillStyle.getIconUrl = (category) => fillStyle.iconUrls[category];

    fillStyle.iconBackgroundColor = (colorsConfig.other && colorsConfig.other.icon_background) || '#FFFFFF';
    fillStyle.labelLineColor = (colorsConfig.other && colorsConfig.other.label_line) || '#999999';

    // Typography
    fillStyle.typography.categoryNameFontFamily = (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif';
    fillStyle.typography.categoryNameFontSize = (typographyConfig.label && typographyConfig.label.font_size) || '14px';
    fillStyle.typography.categoryNameFontWeight = (typographyConfig.label && typographyConfig.label.font_weight) || 'bold';

    fillStyle.typography.dataValueFontFamily = (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif';
    fillStyle.typography.dataValueFontSize = '16px'; 
    fillStyle.typography.dataValueFontWeight = 'bold';

    fillStyle.typography.dataUnitFontFamily = (typographyConfig.annotation && typographyConfig.annotation.font_family) || fillStyle.typography.categoryNameFontFamily;
    fillStyle.typography.dataUnitFontSize = (typographyConfig.annotation && typographyConfig.annotation.font_size) || '12px';
    fillStyle.typography.dataUnitFontWeight = (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal';

    fillStyle.typography.iconFallbackTextFontFamily = (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif';
    fillStyle.typography.iconFallbackTextFontSize = '14px';
    fillStyle.typography.iconFallbackTextFontWeight = 'bold';

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        // This function is not used in this specific chart's refactoring but included as per template.
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        return tempText.getBBox().width;
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

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other main-chart-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartRadiusOuterBoundary = Math.min(containerWidth, containerHeight) / 2;
    const roseMaxRadius = chartRadiusOuterBoundary * 0.70; // Max radius for segments, leaving space for labels
    const roseInnerRadius = roseMaxRadius * 0.2; 
    const iconSize = 36; 
    const labelOffset = chartRadiusOuterBoundary * 0.05;

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({ ...d })); 
    const maxValue = d3.max(chartDataArray, d => d[valueFieldName]);

    if (typeof maxValue !== 'number' || isNaN(maxValue)) { // Check if maxValue is valid
        const errorMsg = "Critical chart data issue: Max value is invalid or data is empty. Cannot render scales.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }
    
    // Block 6: Scale Definition & Configuration
    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null) 
        .padAngle(0.02);

    const arcGenerator = d3.arc()
        .innerRadius(roseInnerRadius)
        .outerRadius(d => {
            if (maxValue === 0) { 
                return roseInnerRadius + (roseMaxRadius - roseInnerRadius) * 0.05; // Minimal visible segment
            }
            return roseInnerRadius + (roseMaxRadius - roseInnerRadius) * (d.data[valueFieldName] / maxValue);
        });

    const outerArcForLabelLine = d3.arc()
        .innerRadius(roseMaxRadius + labelOffset)
        .outerRadius(roseMaxRadius + labelOffset);

    // Block 7: Chart Component Rendering (No Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type.

    // Block 8: Main Data Visualization Rendering
    const segmentGroups = mainChartGroup.selectAll(".segment-group")
        .data(pieGenerator(chartDataArray))
        .enter()
        .append("g")
        .attr("class", "mark segment-group");

    segmentGroups.append("path")
        .attr("class", "mark segment-path")
        .attr("d", arcGenerator)
        .attr("fill", d => fillStyle.getSegmentColor(d.data[categoryFieldName]));

    // Block 9: Optional Enhancements & Post-Processing
    const iconAndLabelGroups = mainChartGroup.selectAll(".enhancement-group")
        .data(pieGenerator(chartDataArray))
        .enter()
        .append("g")
        .attr("class", "other enhancement-group"); // Group for both icon and label for a segment

    iconAndLabelGroups.each(function(d) {
        const group = d3.select(this);
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        
        let currentSegmentOuterRadius;
        if (maxValue === 0) {
            currentSegmentOuterRadius = roseInnerRadius + (roseMaxRadius - roseInnerRadius) * 0.05;
        } else {
            currentSegmentOuterRadius = roseInnerRadius + (roseMaxRadius - roseInnerRadius) * (d.data[valueFieldName] / maxValue);
        }
        const segmentThickness = currentSegmentOuterRadius - roseInnerRadius;

        // Render Icons
        if (segmentThickness >= iconSize * 0.5) { // Only draw icon if segment is thick enough
            const iconRadialPosition = roseInnerRadius + segmentThickness * 0.6;
            const iconX = Math.sin(midAngle) * iconRadialPosition;
            const iconY = -Math.cos(midAngle) * iconRadialPosition;

            group.append("circle")
                .attr("class", "other icon-background")
                .attr("cx", iconX)
                .attr("cy", iconY)
                .attr("r", iconSize / 2)
                .attr("fill", fillStyle.iconBackgroundColor)
                .attr("stroke", fillStyle.getSegmentColor(d.data[categoryFieldName]))
                .attr("stroke-width", 2);

            const iconUrl = fillStyle.getIconUrl(d.data[categoryFieldName]);
            if (iconUrl) {
                group.append("image")
                    .attr("class", "image icon-image")
                    .attr("xlink:href", iconUrl)
                    .attr("x", iconX - iconSize / 2 + iconSize * 0.15)
                    .attr("y", iconY - iconSize / 2 + iconSize * 0.15)
                    .attr("width", iconSize * 0.7)
                    .attr("height", iconSize * 0.7);
            } else {
                group.append("text")
                    .attr("class", "text icon-fallback-text")
                    .attr("x", iconX)
                    .attr("y", iconY)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fillStyle.typography.iconFallbackTextFontFamily)
                    .style("font-size", fillStyle.typography.iconFallbackTextFontSize)
                    .style("font-weight", fillStyle.typography.iconFallbackTextFontWeight)
                    .style("fill", fillStyle.getSegmentColor(d.data[categoryFieldName]))
                    .text(String(d.data[categoryFieldName]).charAt(0).toUpperCase());
            }
        }

        // Render Labels
        const lineStartX = Math.sin(midAngle) * (currentSegmentOuterRadius + 2);
        const lineStartY = -Math.cos(midAngle) * (currentSegmentOuterRadius + 2);

        const polylineMidPoint = outerArcForLabelLine.centroid(d);
        
        const textAnchor = (midAngle < Math.PI) ? "start" : "end";
        const labelHorizontalEnd = (roseMaxRadius + labelOffset + chartRadiusOuterBoundary * 0.05) * (textAnchor === "start" ? 1 : -1);
        
        const lineEndX = labelHorizontalEnd;
        const lineEndY = polylineMidPoint[1]; 

        const polylinePoints = [
            [lineStartX, lineStartY],
            [polylineMidPoint[0], polylineMidPoint[1]],
            [lineEndX, lineEndY]
        ];

        group.append("polyline")
            .attr("class", "other label-line")
            .attr("points", polylinePoints.map(p => p.join(",")).join(" "))
            .attr("fill", "none")
            .attr("stroke", fillStyle.labelLineColor)
            .attr("stroke-width", 1);

        const textPaddingX = textAnchor === "start" ? 5 : -5;
        const labelTextGroup = group.append("g")
            .attr("class", "label label-text-group") // Class for the group of text elements
            .attr("transform", `translate(${lineEndX + textPaddingX}, ${lineEndY})`);

        labelTextGroup.append("text")
            .attr("class", "text category-name-text")
            .attr("dy", "-0.7em") 
            .attr("text-anchor", textAnchor)
            .style("font-family", fillStyle.typography.categoryNameFontFamily)
            .style("font-size", fillStyle.typography.categoryNameFontSize)
            .style("font-weight", fillStyle.typography.categoryNameFontWeight)
            .style("fill", fillStyle.getSegmentColor(d.data[categoryFieldName]))
            .text(d.data[categoryFieldName]);

        labelTextGroup.append("text")
            .attr("class", "text data-value-text")
            .attr("dy", "0.5em") 
            .attr("text-anchor", textAnchor)
            .style("font-family", fillStyle.typography.dataValueFontFamily)
            .style("font-size", fillStyle.typography.dataValueFontSize)
            .style("font-weight", fillStyle.typography.dataValueFontWeight)
            .style("fill", fillStyle.textColor)
            .text(Number(d.data[valueFieldName]).toLocaleString());

        if (valueFieldUnit) {
            labelTextGroup.append("text")
                .attr("class", "text data-unit-text")
                .attr("dy", "1.7em") 
                .attr("text-anchor", textAnchor)
                .style("font-family", fillStyle.typography.dataUnitFontFamily)
                .style("font-size", fillStyle.typography.dataUnitFontSize)
                .style("font-weight", fillStyle.typography.dataUnitFontWeight)
                .style("fill", fillStyle.textColorSubtle)
                .text(valueFieldUnit);
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}