/* REQUIREMENTS_BEGIN
{
  "chart_type": "Rose Chart",
  "chart_name": "rose_chart",
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
  "legend": "none",
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
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed in colors_dark
    const rawImages = data.images || {};

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldDef = dataColumns.find(col => col.role === 'x');
    const yFieldDef = dataColumns.find(col => col.role === 'y');

    if (!xFieldDef || !xFieldDef.name || !yFieldDef || !yFieldDef.name) {
        const missing = [];
        if (!xFieldDef || !xFieldDef.name) missing.push("x field definition");
        if (!yFieldDef || !yFieldDef.name) missing.push("y field definition");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = xFieldDef.name;
    const valueFieldName = yFieldDef.name;
    const valueUnit = yFieldDef.unit || "";

    const chartDataArray = rawChartData.filter(d => d[valueFieldName] != null && d[categoryFieldName] != null);


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
        },
        textColor: rawColors.text_color || '#0f223b',
        textSecondaryColor: rawColors.text_secondary_color || '#555555', // For less prominent text like units
        chartBackground: rawColors.background_color || '#FFFFFF', // Not used for SVG background, but good practice
        defaultSegmentColor: (rawColors.other && rawColors.other.primary) || '#1f77b4',
        labelLineColor: (rawColors.other && rawColors.other.secondary) || '#cccccc',
        iconStrokeColorBase: (rawColors.other && rawColors.other.primary) || '#1f77b4',
        iconBackgroundColor: '#FFFFFF',
    };

    fillStyle.getCategoryColor = (category) => {
        if (rawColors.field && rawColors.field[category]) {
            return rawColors.field[category];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            // Simple hash function to pick a color based on category name, to ensure somewhat consistent coloring
            let hash = 0;
            for (let i = 0; i < category.length; i++) {
                hash = category.charCodeAt(i) + ((hash << 5) - hash);
            }
            return rawColors.available_colors[Math.abs(hash) % rawColors.available_colors.length];
        }
        return fillStyle.defaultSegmentColor;
    };
    
    fillStyle.getIconUrl = (category) => {
        if (rawImages.field && rawImages.field[category]) {
            return rawImages.field[category];
        }
        // No general fallback icon from rawImages.other.primary as per original logic (uses text fallback)
        return null; 
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family || 'Arial, sans-serif');
        tempText.setAttribute('font-size', fontProps.font_size || '12px');
        tempText.setAttribute('font-weight', fontProps.font_weight || 'normal');
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: getBBox might be inaccurate if SVG not in DOM and styles are complex,
        // but for basic font attributes, it's generally okay.
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail (e.g., JSDOM without layout)
            const fontSize = parseFloat(fontProps.font_size) || 12;
            width = text.length * fontSize * 0.6; // Very rough estimate
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
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground); // Optional: set SVG background

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    
    // Reserve space for labels outside the rose segments. Factor determines how much.
    // e.g., 1.3 means maxRadius for segments is (min(dimension)/2) / 1.3
    const labelSpaceFactor = 1.35; 
    const chartRadius = Math.min(containerWidth / 2, containerHeight / 2) / labelSpaceFactor;

    const innerRadius = chartRadius * 0.2; // Inner hole of the rose
    const segmentDrawableRadius = chartRadius * 0.8; // Max radius available for data representation part of segments

    mainChartGroup.attr("transform", `translate(${centerX}, ${centerY})`);
    
    const DEFAULT_ICON_SIZE = Math.min(30, chartRadius * 0.2); // Make icon size somewhat relative but capped


    // Block 5: Data Preprocessing & Transformation
    const maxValue = d3.max(chartDataArray, d => d[valueFieldName]);
    if (maxValue === undefined || maxValue === 0) { // Handle empty or all-zero data
        // console.warn("Max value is 0 or undefined, chart may not render correctly.");
        // No specific error message to container, chart will just be empty or minimal.
    }


    // Block 6: Scale Definition & Configuration
    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null) // Keep original data order
        .padAngle(0.02); // Small gap between segments

    const arcGenerator = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(d => {
            if (maxValue === 0 || !d.data || d.data[valueFieldName] === undefined) return innerRadius;
            return innerRadius + segmentDrawableRadius * (d.data[valueFieldName] / maxValue);
        })
        .cornerRadius(0); // No rounded corners for "clean" style

    const outerArcForLabels = d3.arc()
        .innerRadius(chartRadius * 1.05) // Position for start of label lines/text
        .outerRadius(chartRadius * 1.05);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const pieData = pieGenerator(chartDataArray);

    const segmentGroups = mainChartGroup.selectAll(".segment-group")
        .data(pieData)
        .enter()
        .append("g")
        .attr("class", "segment-group");

    segmentGroups.append("path")
        .attr("class", "mark")
        .attr("d", arcGenerator)
        .attr("fill", d => fillStyle.getCategoryColor(d.data[categoryFieldName]))
        .attr("stroke", fillStyle.chartBackground) // Use background for slight separation
        .style("stroke-width", "1px"); // Thin stroke for separation


    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Add icons to segments
    const iconGroups = segmentGroups.append("g")
        .attr("class", "icon-mark-group");

    iconGroups.each(function(d) {
        if (!d.data || d.data[valueFieldName] === undefined) return;

        const group = d3.select(this);
        const iconSize = DEFAULT_ICON_SIZE;
        
        const segmentOuterRadius = innerRadius + segmentDrawableRadius * (d.data[valueFieldName] / maxValue);
        // Position icon roughly in the middle of the segment's radial extent
        const iconRadialPosition = innerRadius + (segmentOuterRadius - innerRadius) * 0.6; 
        
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        const iconX = Math.sin(midAngle) * iconRadialPosition;
        const iconY = -Math.cos(midAngle) * iconRadialPosition;
        
        group.append("circle")
            .attr("class", "other icon-background")
            .attr("cx", iconX)
            .attr("cy", iconY)
            .attr("r", iconSize / 2)
            .attr("fill", fillStyle.iconBackgroundColor)
            .attr("stroke", fillStyle.getCategoryColor(d.data[categoryFieldName]))
            .attr("stroke-width", 2);
            
        const iconUrl = fillStyle.getIconUrl(d.data[categoryFieldName]);
        if (iconUrl) {
            group.append("image")
                .attr("class", "icon")
                .attr("xlink:href", iconUrl)
                .attr("x", iconX - iconSize / 2 + iconSize * 0.15) // Padding within circle
                .attr("y", iconY - iconSize / 2 + iconSize * 0.15)
                .attr("width", iconSize * 0.7)
                .attr("height", iconSize * 0.7);
        } else {
            group.append("text")
                .attr("class", "text icon-fallback-text")
                .attr("x", iconX)
                .attr("y", iconY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("fill", fillStyle.getCategoryColor(d.data[categoryFieldName]))
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${iconSize * 0.5}px`) // Scale fallback text with icon size
                .style("font-weight", "bold")
                .text(d.data[categoryFieldName] ? String(d.data[categoryFieldName]).charAt(0).toUpperCase() : "?");
        }
    });

    // Add labels outside segments
    const labelGroups = mainChartGroup.selectAll(".label-group")
        .data(pieData)
        .enter()
        .append("g")
        .attr("class", "label-group");

    labelGroups.each(function(d) {
        if (!d.data || d.data[valueFieldName] === undefined) return;

        const labelGroup = d3.select(this);
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        
        const segmentOuterRadius = innerRadius + segmentDrawableRadius * (d.data[valueFieldName] / maxValue);
        const lineStartX = Math.sin(midAngle) * segmentOuterRadius;
        const lineStartY = -Math.cos(midAngle) * segmentOuterRadius;

        const labelLineMidPoint = outerArcForLabels.centroid(d);
        // Extend line further for text placement
        const textAnchorX = chartRadius * 1.15 * (midAngle < Math.PI ? 1 : -1);
        const textAnchorY = labelLineMidPoint[1]; // Keep Y from centroid of outerArc

        const polylinePoints = [
            [lineStartX, lineStartY],
            labelLineMidPoint,
            [textAnchorX, textAnchorY]
        ];
        
        labelGroup.append("polyline")
            .attr("class", "other label-line")
            .attr("points", polylinePoints.map(p => p.join(",")).join(" "))
            .attr("fill", "none")
            .attr("stroke", fillStyle.labelLineColor)
            .attr("stroke-width", 1);
            
        const textAlignment = midAngle < Math.PI ? "start" : "end";
        const textXOffset = midAngle < Math.PI ? 5 : -5; // Padding from end of polyline
                
        const textBlock = labelGroup.append("g")
            .attr("class", "text-block")
            .attr("transform", `translate(${textAnchorX + textXOffset}, ${textAnchorY})`);
            
        // Category Name
        textBlock.append("text")
            .attr("class", "text label-category")
            .attr("dy", "-0.7em") // Adjust vertical position (multi-line)
            .attr("text-anchor", textAlignment)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold") // Make category name bold
            .style("fill", fillStyle.getCategoryColor(d.data[categoryFieldName]))
            .text(d.data[categoryFieldName]);
            
        // Value
        textBlock.append("text")
            .attr("class", "text label-value")
            .attr("dy", "0.5em") // Second line
            .attr("text-anchor", textAlignment)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize) // Use label font size for value too
            .style("font-weight", "bold") // Make value bold
            .style("fill", fillStyle.textColor)
            .text(d.data[valueFieldName].toLocaleString());
            
        // Unit
        if (valueUnit) {
            textBlock.append("text")
                .attr("class", "text label-unit")
                .attr("dy", "1.7em") // Third line
                .attr("text-anchor", textAlignment)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textSecondaryColor)
                .text(valueUnit);
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}