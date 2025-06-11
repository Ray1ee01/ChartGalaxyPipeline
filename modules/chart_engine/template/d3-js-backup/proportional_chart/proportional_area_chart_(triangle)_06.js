/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Triangle)",
  "chart_name": "proportional_area_chart_triangle_06",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[8, 20], [0, "inf"], [2, 8]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawData = data.data || {};
    let chartDataArray = rawData.data || [];
    const dataColumns = rawData.columns || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; 
    const images = data.images || {};

    d3.select(containerSelector).html(""); // Clear container early

    const xFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const yFieldName = (dataColumns.find(col => col.role === "y") || {}).name;
    const groupFieldName = (dataColumns.find(col => col.role === "group") || {}).name;
    const yFieldUnit = (dataColumns.find(col => col.role === "y") || {}).unit;
    const yUnit = yFieldUnit === "none" || !yFieldUnit ? "" : yFieldUnit;

    if (!xFieldName || !yFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push("x field role");
        if (!yFieldName) missingFields.push("y field role");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')} in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .html(errorMsg);
        return null;
    }

    chartDataArray = chartDataArray.filter(d => d[yFieldName] != null && +d[yFieldName] > 0);
    if (!chartDataArray.length) {
        d3.select(containerSelector).append("div").html("No valid data to display after filtering.");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) || '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) || 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '12px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
        },
        colors: {
            primary: (colors.other && colors.other.primary) || '#1f77b4',
            textColor: colors.text_color || '#333333',
            backgroundColor: colors.background_color || '#FFFFFF',
            defaultCategoryColors: d3.schemeCategory10,
            groupFieldColors: colors.field || {},
            availableColors: colors.available_colors || d3.schemeCategory10,
        },
        images: { // Not actively used for rendering images in this chart, but extracted per spec
            fieldImages: images.field || {},
            otherImages: images.other || {},
        }
    };
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvgForTextMeasurement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // No need to style the SVG element itself for this purpose
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontFamily);
        tempTextElement.setAttribute('font-size', fontSize); // fontSize should include units like 'px'
        tempTextElement.setAttribute('font-weight', fontWeight);
        tempTextElement.textContent = text;
        tempSvgForTextMeasurement.appendChild(tempTextElement);
        // Appending to body is not strictly required for getBBox in modern browsers if styles are set directly.
        // However, if it were, it should be immediately removed.
        // document.body.appendChild(tempSvgForTextMeasurement);
        const width = tempTextElement.getBBox().width;
        // document.body.removeChild(tempSvgForTextMeasurement);
        return width;
    }

    function formatNumber(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return String(num);
    }

    function splitTextIntoLines(text, fontFamily, fontSizeWithUnit, maxWidth, fontWeight) {
        if (!text) return [""];
        const words = String(text).split(/\s+/);
        const lines = [];
        let currentLine = "";

        if (words.length <= 2 && String(text).length > 0) { 
            const chars = String(text).split('');
            currentLine = chars[0] || "";
            for (let i = 1; i < chars.length; i++) {
                const testLine = currentLine + chars[i];
                if (estimateTextWidth(testLine, fontFamily, fontSizeWithUnit, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = chars[i];
                }
            }
            if (currentLine) lines.push(currentLine);
        } else {
            currentLine = words[0] || "";
            for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + " " + words[i];
                if (estimateTextWidth(testLine, fontFamily, fontSizeWithUnit, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = words[i];
                }
            }
            if (currentLine) lines.push(currentLine);
        }
        return lines.length > 0 ? lines : (String(text).length > 0 ? [String(text)] : [""]);
    }
    
    function createRoundedTrianglePath(topPoint, leftPoint, rightPoint, radius) {
        function calculateUnitVector(p1, p2) {
            const dx = p2[0] - p1[0];
            const dy = p2[1] - p1[1];
            const length = Math.sqrt(dx * dx + dy * dy);
            return length === 0 ? [0,0] : [dx / length, dy / length];
        }
        
        const top_left = calculateUnitVector(topPoint, leftPoint);
        const left_right = calculateUnitVector(leftPoint, rightPoint);
        const right_top = calculateUnitVector(rightPoint, topPoint);
        
        const topLeftStart = [ topPoint[0] + top_left[0] * radius, topPoint[1] + top_left[1] * radius ];
        const leftRightStart = [ leftPoint[0] + left_right[0] * radius, leftPoint[1] + left_right[1] * radius ];
        const rightTopStart = [ rightPoint[0] + right_top[0] * radius, rightPoint[1] + right_top[1] * radius ];
        
        const topRightEnd = [ topPoint[0] - right_top[0] * radius, topPoint[1] - right_top[1] * radius ];
        const leftTopEnd = [ leftPoint[0] - top_left[0] * radius, leftPoint[1] - top_left[1] * radius ];
        const rightLeftEnd = [ rightPoint[0] - left_right[0] * radius, rightPoint[1] - left_right[1] * radius ];
        
        return `
            M ${topLeftStart[0]},${topLeftStart[1]}
            L ${leftTopEnd[0]},${leftTopEnd[1]}
            A ${radius},${radius} 0 0 0 ${leftRightStart[0]},${leftRightStart[1]}
            L ${rightLeftEnd[0]},${rightLeftEnd[1]}
            A ${radius},${radius} 0 0 0 ${rightTopStart[0]},${rightTopStart[1]}
            L ${topRightEnd[0]},${topRightEnd[1]}
            A ${radius},${radius} 0 0 0 ${topLeftStart[0]},${topLeftStart[1]}
            Z
        `;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.colors.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 };
    
    const minRadius = 20; 
    const maxRadius = 80; 
    const triangleHorizontalPadding = 35; 
    const triangleVerticalPadding = 20;
    const legendItemHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.5; // Approximate height for a legend item row
    const legendPadding = 10; 
    const legendTitleMarginBottom = 5;

    let legendRenderedHeight = 0;

    // Block 5: Data Preprocessing & Transformation
    const groupValues = groupFieldName ? [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort() : [];
    
    const yValues = chartDataArray.map(d => +d[yFieldName]);
    const minValue = d3.min(yValues) || 0;
    const maxValue = d3.max(yValues) || (minValue + 1); // Ensure maxValue > minValue

    // Block 6: Scale Definition & Configuration
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue === minValue ? minValue + 1 : maxValue])
        .range([minRadius, maxRadius]);

    const colorScale = d3.scaleOrdinal()
        .domain(groupValues)
        .range(groupValues.map((g, i) => 
            fillStyle.colors.groupFieldColors[g] || 
            fillStyle.colors.availableColors[i % fillStyle.colors.availableColors.length]
        ));

    const nodes = chartDataArray.map((d, i) => ({
        id: String(d[xFieldName] != null ? d[xFieldName] : `__node_${i}__`),
        val: +d[yFieldName],
        r: radiusScale(+d[yFieldName]),
        color: groupFieldName ? colorScale(d[groupFieldName]) : fillStyle.colors.primary,
        group: groupFieldName ? d[groupFieldName] : null,
        icon: (fillStyle.images.fieldImages[String(d[xFieldName])]) || null,
        raw: d,
    })).sort((a, b) => b.r - a.r);

    // Block 7: Chart Component Rendering (Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other main-chart-area")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    let effectiveInnerWidth = containerWidth - chartMargins.left - chartMargins.right;
    let effectiveInnerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (groupFieldName && groupValues.length > 0) {
        const legendGroup = mainChartGroup.append("g")
            .attr("class", "other legend");

        const groupTitleText = (dataColumns.find(c => c.name === groupFieldName) || {}).title || groupFieldName;
        const legendLabelFontSizePx = fillStyle.typography.labelFontSize; // e.g., "12px"
        const legendLabelNumericSize = parseFloat(legendLabelFontSizePx);
        
        const legendTitle = legendGroup.append("text")
            .attr("class", "label legend-title")
            .attr("x", 0)
            .attr("y", 0) 
            .attr("dominant-baseline", "hanging")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", legendLabelFontSizePx)
            .style("font-weight", "bold")
            .style("fill", fillStyle.colors.textColor)
            .text(groupTitleText);
        
        const legendTitleHeight = legendTitle.node().getBBox().height;
        let currentX = 0;
        let currentY = legendTitleHeight + legendTitleMarginBottom; 
        const legendRectSize = legendLabelNumericSize * 0.8;
        const legendTextRectSpacing = 5; 
        const legendItemMargin = 10;

        groupValues.forEach((groupValue) => {
            const itemText = String(groupValue);
            const itemTextWidth = estimateTextWidth(itemText, fillStyle.typography.labelFontFamily, legendLabelFontSizePx, fillStyle.typography.labelFontWeight);
            const itemWidth = legendRectSize + legendTextRectSpacing + itemTextWidth;

            if (currentX + itemWidth > effectiveInnerWidth && currentX > 0) { // Wrap if exceeds width
                currentX = 0;
                currentY += legendItemHeight;
            }

            const legendItem = legendGroup.append("g")
                .attr("class", "other legend-item")
                .attr("transform", `translate(${currentX}, ${currentY})`);

            legendItem.append("rect")
                .attr("class", "mark legend-mark")
                .attr("x", 0)
                .attr("y", (legendItemHeight - legendRectSize - legendLabelNumericSize) / 2) // Center rect with text
                .attr("width", legendRectSize)
                .attr("height", legendRectSize)
                .style("fill", colorScale(groupValue));

            legendItem.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendRectSize + legendTextRectSpacing)
                .attr("y", (legendItemHeight - legendLabelNumericSize) / 2) // Align text baseline
                .attr("dominant-baseline", "hanging")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", legendLabelFontSizePx)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(itemText);
            
            currentX += itemWidth + legendItemMargin;
        });
        
        const legendBBox = legendGroup.node().getBBox();
        legendRenderedHeight = legendBBox.height > 0 ? legendBBox.height + legendPadding : 0;
    }
    
    const trianglesGroup = mainChartGroup.append("g")
        .attr("class", "other triangles-visualization-area")
        .attr("transform", `translate(0, ${legendRenderedHeight})`);
    
    effectiveInnerHeight -= legendRenderedHeight;

    // Block 8: Main Data Visualization Rendering (Triangles)
    function arrangeTriangles(nodesToLayout, availableWidth, availableHeight) {
        let x = 0;
        let y = 0; 
        let rowHeight = 0;
        const positionedNodes = [];

        nodesToLayout.forEach(node => {
            const triangleSide = node.r * 2;
            const currentTriangleHeight = triangleSide * Math.sqrt(3) / 2;
            const nodeWidthWithPadding = triangleSide + triangleHorizontalPadding;

            if (x + triangleSide > availableWidth && positionedNodes.length > 0 && x > 0) {
                x = 0;
                y += rowHeight + triangleVerticalPadding;
                rowHeight = 0;
            }
            
            if (y + currentTriangleHeight > availableHeight && positionedNodes.length > 0) {
                 return; 
            }

            node.x = x + triangleSide / 2; 
            node.y = y + currentTriangleHeight;   
            node.triangleSide = triangleSide;
            node.triangleHeight = currentTriangleHeight;
            
            positionedNodes.push(node);

            rowHeight = Math.max(rowHeight, currentTriangleHeight);
            x += nodeWidthWithPadding;
        });
        return positionedNodes;
    }

    const layoutNodes = arrangeTriangles(nodes, effectiveInnerWidth, effectiveInnerHeight);

    const nodeGroups = trianglesGroup.selectAll("g.node-mark-group")
        .data(layoutNodes, d => d.id)
        .join("g")
        .attr("class", "mark node-mark-group") // Changed class name for clarity
        .attr("transform", d => `translate(${d.x}, ${d.y - d.triangleHeight * 1/3})`);

    nodeGroups.each(function(d) {
        const gNode = d3.select(this);
        const side = d.triangleSide;
        const triangleHeightVal = d.triangleHeight;
        const formattedVal = formatNumber(d.val);
        const valText = `${formattedVal}${yUnit ? ' ' + yUnit : ''}`;
        let catText = d.id.startsWith("__node_") ? "" : d.id;

        const isLargeTriangle = side >= 80; 
        const cornerRadius = Math.min(5, side * 0.1); // Smaller radius for smaller triangles

        const topPoint = [0, -triangleHeightVal * 2/3];
        const leftPoint = [-side/2, triangleHeightVal * 1/3];
        const rightPoint = [side/2, triangleHeightVal * 1/3];
        
        const roundedTrianglePath = createRoundedTrianglePath(topPoint, leftPoint, rightPoint, cornerRadius);
        
        gNode.append("path")
            .attr("class", "mark triangle-shape") // Changed class name
            .attr("d", roundedTrianglePath)
            .style("fill", d.color)
            .style("stroke", fillStyle.colors.backgroundColor) 
            .style("stroke-width", 2);

        const valueLabelFontSizePx = fillStyle.typography.annotationFontSize;
        const categoryLabelFontSizePx = fillStyle.typography.labelFontSize;
        const labelColor = fillStyle.colors.textColor;
        const innerLabelColor = "#FFFFFF";

        let finalCatFontSize = Math.min(14, Math.max(10, side / 12));
        let finalValFontSize = Math.min(16, Math.max(12, side / 10));
        let finalCatFontSizePx = `${finalCatFontSize}px`;
        let finalValFontSizePx = `${finalValFontSize}px`;

        if (isLargeTriangle) { 
            const innerValueY = triangleHeightVal * 1/3 - finalValFontSize * 0.5; 
            const maxInnerValueWidth = side * 0.7;
            const valueWidth = estimateTextWidth(valText, fillStyle.typography.annotationFontFamily, finalValFontSizePx, fillStyle.typography.annotationFontWeight);
            if (valueWidth > maxInnerValueWidth) {
                finalValFontSize = Math.max(8, Math.floor(finalValFontSize * maxInnerValueWidth / valueWidth));
                finalValFontSizePx = `${finalValFontSize}px`;
            }

            gNode.append("text")
                .attr("class", "label value-label value") 
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle") 
                .attr("y", innerValueY)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("font-size", finalValFontSizePx)
                .style("fill", innerLabelColor)
                .text(valText);

            const topLabelY = -triangleHeightVal * 2/3 - 10;
            const maxLabelWidth = Math.max(side, 120);
            const lines = splitTextIntoLines(catText, fillStyle.typography.labelFontFamily, finalCatFontSizePx, maxLabelWidth, fillStyle.typography.labelFontWeight);
            const lineHeight = finalCatFontSize * 1.2;
            const totalTextHeight = lines.length * lineHeight;
            
            lines.forEach((line, i) => {
                gNode.append("text")
                    .attr("class", "label category-label text")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "alphabetic") // Use alphabetic for multi-line blocks
                    .attr("y", topLabelY + (i * lineHeight) - (totalTextHeight / 2) + (lineHeight / 2) - 2) // Center block
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("font-size", finalCatFontSizePx)
                    .style("fill", labelColor)
                    .text(line);
            });

        } else { 
            const topLabelYBase = -triangleHeightVal * 2/3 - 8; 
            const maxOuterLabelWidth = Math.max(side * 1.5, 100);

            const catLines = splitTextIntoLines(catText, fillStyle.typography.labelFontFamily, finalCatFontSizePx, maxOuterLabelWidth, fillStyle.typography.labelFontWeight);
            const catLineHeight = finalCatFontSize * 1.1;
            let currentYTextOffset = 0;

            catLines.forEach((line, i) => {
                gNode.append("text")
                    .attr("class", "label category-label text")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .attr("y", topLabelYBase + currentYTextOffset + (i * catLineHeight))
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("font-size", finalCatFontSizePx)
                    .style("fill", labelColor)
                    .text(line);
            });
            currentYTextOffset += catLines.length * catLineHeight;

            gNode.append("text")
                .attr("class", "label value-label value")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", topLabelYBase + currentYTextOffset + (catLines.length > 0 ? 2 : 0)) 
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("font-size", finalValFontSizePx)
                .style("fill", labelColor)
                .text(valText);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No additional enhancements in this refactor.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}