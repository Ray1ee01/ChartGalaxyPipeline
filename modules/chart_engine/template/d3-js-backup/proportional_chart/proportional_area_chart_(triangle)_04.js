/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Triangle)",
  "chart_name": "proportional_area_chart_triangle_04",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[8, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const dataColumns = data.data?.columns || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || (data.colors_dark || {}); // Assuming dark theme might be passed as data.colors_dark
    const images = data.images || {};

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const yUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y")?.unit || "");

    if (!xField || !yField) {
        console.error("Critical chart config missing: xField or yField derived from data.columns roles 'x' or 'y' are undefined. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif; padding: 10px;'>Critical chart configuration missing: Required field roles (x, y) not found in data.columns. Cannot render chart.</div>");
        }
        return null;
    }

    d3.select(containerSelector).html(""); // Clear the container

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: colors.other?.primary || "#1f77b4",
        textColor: colors.text_color || "#333333",
        labelBackgroundColor: colors.other?.label_background || "#FFFFFF", // Example, can be more specific
        labelBorderColor: colors.other?.label_border || "#CCCCCC",
        connectorLineColor: colors.other?.connector_line || "#666666",
        chartBackground: colors.background_color || "#FFFFFF",
        typography: {
            labelFontFamily: typography.label?.font_family || "Arial, sans-serif",
            labelFontSize: typography.label?.font_size || "11px",
            labelFontWeight: typography.label?.font_weight || "normal",
            annotationFontFamily: typography.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typography.annotation?.font_size || "10px",
            annotationFontWeight: typography.annotation?.font_weight || "bold",
        }
    };

    // Text width measurement helper (using canvas as in original)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize} ${fontFamily || 'Arial'}`; // Note: fontSize should include units like 'px'
        return ctx.measureText(text).width;
    }
    
    // Triangle layout function (moved here as it's a significant helper)
    function arrangeTrianglesBottomAligned(nodes, containerWidth, horizontalPadding, verticalPadding, labelHeightEstimate) {
        let x = 0;
        let y = 0;
        let rowHeight = 0;
        let rowNodes = [];
        const rows = [];
        
        nodes.forEach(node => {
            const triangleSide = node.r * 2;
            const triangleHeightVal = triangleSide * Math.sqrt(3) / 2;
            
            const nodeWidth = triangleSide + horizontalPadding;
            
            if (x + triangleSide > containerWidth && rowNodes.length > 0) { // Ensure rowNodes is not empty before starting new row
                rows.push({ y: y, height: rowHeight, nodes: rowNodes });
                x = 0;
                y += rowHeight + verticalPadding;
                rowHeight = 0;
                rowNodes = [];
            }
            
            node.x = x + triangleSide / 2;
            node.y = y; // Base y for the row
            node.triangleSide = triangleSide;
            node.triangleHeight = triangleHeightVal;
            
            rowHeight = Math.max(rowHeight, triangleHeightVal);
            x += nodeWidth;
            rowNodes.push(node);
        });
        
        if (rowNodes.length > 0) {
            rows.push({ y: y, height: rowHeight, nodes: rowNodes });
        }
        
        const totalLayoutHeight = rows.length > 0 ? y + rowHeight + labelHeightEstimate : labelHeightEstimate;
        return { rows: rows, totalHeight: totalLayoutHeight };
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 20, bottom: 40, left: 20 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Triangle sizing and layout parameters
    const minRadius = variables.minRadius || 20;
    const maxRadius = variables.maxRadius || 80;
    const triangleHorizontalPadding = variables.triangleHorizontalPadding || 30;
    const triangleVerticalPadding = variables.triangleVerticalPadding || 60; // Includes space for labels
    const estimatedLabelHeight = variables.estimatedLabelHeight || 50; // For layout planning

    // Icon related configurations
    const iconSizeRatio = 0.6;
    const minIconSize = 24;
    const maxIconSize = 60;
    const minSideForIcon = 45;

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.filter(d => d[yField] != null && !isNaN(parseFloat(d[yField])) && +d[yField] > 0);

    if (!chartDataArray.length) {
        d3.select(containerSelector).html("<div style='font-family: sans-serif; padding: 10px;'>No valid data to display after filtering.</div>");
        return null;
    }

    const yValues = chartDataArray.map(d => +d[yField]);
    const minValue = d3.min(yValues) || 0;
    const maxValue = d3.max(yValues) || 1; // Avoid division by zero if all values are same or min/max are equal

    // Block 6: Scale Definition & Configuration
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([minRadius, maxRadius]);

    const nodes = chartDataArray.map((d, i) => ({
        id: d[xField] != null ? String(d[xField]) : `__${i}__`,
        val: +d[yField],
        r: (minValue === maxValue) ? (minRadius + maxRadius) / 2 : radiusScale(+d[yField]), // Handle single value case
        color: fillStyle.primaryColor,
        iconUrl: images.field?.[d[xField]] || (images.other?.defaultIcon || null), // Allow a default icon
        originalData: d,
    })).sort((a, b) => b.r - a.r);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type.

    // Block 8: Main Data Visualization Rendering
    const layout = arrangeTrianglesBottomAligned(nodes, innerWidth, triangleHorizontalPadding, triangleVerticalPadding, estimatedLabelHeight);
    
    // The SVG height is fixed. If layout.totalHeight > innerHeight, content might be clipped or overflow.
    // For centering the layout vertically if it's smaller than innerHeight:
    let yOffset = 0;
    if (layout.totalHeight < innerHeight) {
        yOffset = (innerHeight - layout.totalHeight) / 2;
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top + yOffset})`);

    const nodeGroups = mainChartGroup.selectAll("g.node-group")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", "mark node-group")
        .attr("transform", d => {
            // Adjust y position based on row's base y and triangle's own height
            // The d.y from layout is the baseline of the triangle's row.
            // Triangles are drawn with center at (0,0) relative to this transform.
            // The path itself is defined with top vertex at y = -triangleHeight * 2/3
            // So, to align bottom of triangle with d.y + d.triangleHeight, we translate to d.y + d.triangleHeight * 1/3
            return `translate(${d.x}, ${d.y + d.triangleHeight * 1/3})`;
        });

    nodeGroups.each(function(dNode) {
        const gNode = d3.select(this);
        const side = dNode.triangleSide;
        const triangleHeight = dNode.triangleHeight;
        const valueText = `${dNode.val}${yUnit}`;
        let categoryText = dNode.id.startsWith("__") ? "" : dNode.id;

        // Draw Triangle
        gNode.append("path")
            .attr("class", "mark triangle-path")
            .attr("d", d3.line()([
                [0, -triangleHeight * 2/3],      // Top vertex
                [-side / 2, triangleHeight * 1/3],  // Bottom-left vertex
                [side / 2, triangleHeight * 1/3]   // Bottom-right vertex
            ]))
            .attr("fill", dNode.color)
            .attr("stroke", "#FFFFFF") // Keep a white stroke for definition if desired, or remove
            .attr("stroke-width", 1.0);

        // Add Icon
        if (dNode.iconUrl && side >= minSideForIcon) {
            const maxSafeDiameter = side * 0.5; // Approx. incircle diameter
            const iconDisplaySize = Math.max(minIconSize, Math.min(maxSafeDiameter, side * iconSizeRatio, maxIconSize));
            gNode.append("image")
                .attr("class", "icon data-icon")
                .attr("xlink:href", dNode.iconUrl)
                .attr("width", iconDisplaySize)
                .attr("height", iconDisplaySize)
                .attr("x", -iconDisplaySize / 2)
                .attr("y", -triangleHeight / 6 - iconDisplaySize / 2) // Vertically center in upper part
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

        // Labels (all external)
        let currentLabelFontSize = Math.min(14, Math.max(10, side / 10)); // Initial dynamic font size
        const parsedLabelBaseFontSize = parseFloat(fillStyle.typography.labelFontSize); // e.g., 11px -> 11
        const parsedAnnotationBaseFontSize = parseFloat(fillStyle.typography.annotationFontSize); // e.g., 10px -> 10
        
        // Use configured base sizes, but allow dynamic reduction if too large
        let categoryLabelFontSize = Math.min(currentLabelFontSize, parsedLabelBaseFontSize);
        let valueLabelFontSize = Math.min(currentLabelFontSize, parsedAnnotationBaseFontSize);


        const labelYPosition = triangleHeight * 1/3 + 15; // Below triangle base

        // Connecting Line
        gNode.append("line")
            .attr("class", "other connector-line")
            .attr("x1", 0)
            .attr("y1", triangleHeight * 1/3) // From triangle base center
            .attr("x2", 0)
            .attr("y2", labelYPosition - 5) // To just above label box
            .attr("stroke", fillStyle.connectorLineColor)
            .attr("stroke-width", 0.8);

        const categoryTextWidth = estimateTextWidth(categoryText, fillStyle.typography.labelFontFamily, `${categoryLabelFontSize}px`, fillStyle.typography.labelFontWeight);
        const valueTextWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, `${valueLabelFontSize}px`, fillStyle.typography.annotationFontWeight);
        const maxTextWidth = Math.max(categoryTextWidth, valueTextWidth);

        const maxAllowedLabelWidth = Math.max(side * 1.5, 100); // Allow labels to be wider than triangle
        let finalLabelWidth = maxTextWidth;

        if (maxTextWidth > maxAllowedLabelWidth) {
            const scaleFactor = maxAllowedLabelWidth / maxTextWidth;
            const minAllowedFontSize = 8;
            categoryLabelFontSize = Math.max(minAllowedFontSize, Math.floor(categoryLabelFontSize * scaleFactor));
            valueLabelFontSize = Math.max(minAllowedFontSize, Math.floor(valueLabelFontSize * scaleFactor));
            
            const newCatWidth = estimateTextWidth(categoryText, fillStyle.typography.labelFontFamily, `${categoryLabelFontSize}px`, fillStyle.typography.labelFontWeight);
            const newValWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, `${valueLabelFontSize}px`, fillStyle.typography.annotationFontWeight);
            finalLabelWidth = Math.max(newCatWidth, newValWidth);
        }
        
        const labelLineHeightPadding = 4; // Padding between lines of text
        const totalLabelBoxHeight = categoryLabelFontSize + valueLabelFontSize + labelLineHeightPadding + 8; // 8 for top/bottom padding in box

        // Label Background
        gNode.append("rect")
            .attr("class", "other label-background")
            .attr("x", -finalLabelWidth / 2 - 5)
            .attr("y", labelYPosition - 4) // Align with text
            .attr("width", finalLabelWidth + 10)
            .attr("height", totalLabelBoxHeight)
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("fill", fillStyle.labelBackgroundColor)
            .attr("stroke", fillStyle.labelBorderColor)
            .attr("stroke-width", 0.5);

        // Category Label
        gNode.append("text")
            .attr("class", "label category-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("y", labelYPosition)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("font-size", `${categoryLabelFontSize}px`)
            .style("fill", fillStyle.textColor)
            .text(categoryText);

        // Value Label
        gNode.append("text")
            .attr("class", "label value-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("y", labelYPosition + categoryLabelFontSize + labelLineHeightPadding)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("font-size", `${valueLabelFontSize}px`)
            .style("fill", fillStyle.textColor)
            .text(valueText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements not covered by main rendering)
    // None in this refactoring beyond what's in Block 8.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}