/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Triangle)",
  "chart_name": "proportional_area_chart_triangle_05",
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
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataRaw = data.data && data.data.data ? data.data.data : [];
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or use a theme selector if provided
    const images = data.images || {}; // Images are sourced but not rendered in this version to match original visual output.

    d3.select(containerSelector).html(""); // Clear the container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const yColDefinition = dataColumns.find(col => col.role === "y");
    const yUnit = yColDefinition?.unit === "none" || !yColDefinition?.unit ? "" : yColDefinition.unit;

    if (!xField || !yField) {
        const errorMessage = `Critical chart config missing: ${!xField ? "xField " : ""}${!yField ? "yField " : ""}is undefined. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMessage}</div>`);
        return null;
    }

    const chartDataArray = chartDataRaw.filter(d => d[yField] != null && !isNaN(parseFloat(d[yField])) && +d[yField] > 0);

    if (!chartDataArray.length) {
        d3.select(containerSelector).html("<div>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: colors.other?.primary || "#1f77b4",
        textColor: colors.text_color || "#333333",
        innerValueColor: colors.other?.inner_value_text_color || '#FFFFFF', // For text inside colored shapes
        labelBackgroundColor: colors.other?.label_background || '#FFFFFF',
        labelBorderColor: colors.other?.label_border || '#CCCCCC',
        labelBorderWidth: 0.5,
        triangleStrokeColor: colors.other?.triangle_stroke || '#FFFFFF',
        triangleStrokeWidth: 2.0, // Simplified from 3.0
        chartBackground: colors.background_color || "transparent", // Default to transparent
        typography: {
            valueFontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
            valueFontSize: typography.annotation?.font_size ? parseFloat(typography.annotation.font_size) : 12,
            valueFontWeight: typography.annotation?.font_weight || 'bold',
            categoryFontFamily: typography.label?.font_family || 'Arial, sans-serif',
            categoryFontSize: typography.label?.font_size ? parseFloat(typography.label.font_size) : 11,
            categoryFontWeight: typography.label?.font_weight || 'normal',
        }
    };
    
    // In-memory text measurement utility
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', `${fontSize}px`);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM append.
        // For simple cases, this might work, but getBBox on non-rendered SVG can be tricky.
        // A common robust way is to append to an off-screen part of the DOM, measure, then remove.
        // However, strictly following "MUST NOT be appended to the document DOM":
        // This might require a pre-rendered SVG element if getBBox is unreliable without rendering.
        // For this exercise, we assume getBBox works sufficiently on an in-memory element.
        // If not, one would use a hidden, fixed-size SVG in the DOM, or canvas context.
        // The original used canvas, which is a valid alternative.
        document.body.appendChild(tempSvg); // Temporarily append to measure
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg); // Clean up
        return width;
    }

    function splitTextIntoLines(text, fontFamily, fontSize, fontWeight, maxWidth) {
        if (!text) return [""];
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = "";

        const testAndPush = (line, word) => {
            const testLine = word ? (line ? line + " " + word : word) : line;
            if (estimateTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                return testLine;
            } else {
                if (line) lines.push(line);
                return word;
            }
        };
        
        if (words.length <= 1 && text.length > 0) { // Handle single long word or CJK text
            currentLine = "";
            for (let char of text) {
                const testLine = currentLine + char;
                if (estimateTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = char;
                }
            }
            if (currentLine) lines.push(currentLine);
            if (lines.length === 0 && currentLine === "") lines.push(text); // if text itself is too long

        } else {
            currentLine = words[0] || "";
            for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + " " + words[i];
                if (estimateTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = words[i];
                }
            }
            if (currentLine) lines.push(currentLine);
        }
        return lines.map(l => l.trim()).filter(l => l.length > 0);
    }

    function createTrianglePath(topPoint, leftPoint, rightPoint) {
        return `M ${topPoint[0]},${topPoint[1]} L ${leftPoint[0]},${leftPoint[1]} L ${rightPoint[0]},${rightPoint[1]} Z`;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    let containerHeight = variables.height || 600; // Initial height, may be adjusted

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight) // Set initial height
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = { top: 40, right: 20, bottom: 40, left: 20 };

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    // Block 4: Core Chart Dimensions & Layout Calculation
    let innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    let innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const minRadius = 20; // Smallest triangle "radius" (half-side)
    const maxRadius = 80; // Largest triangle "radius"
    const triangleMinSideForInnerLabel = 50; // Min side length for label to be inside

    // Triangle layout function (greedy, bottom-aligned rows)
    const arrangeTrianglesBottomAligned = (nodesToLayout, availableWidth) => {
        const horizontalPadding = 25; // Reduced from original
        const verticalPadding = 50;   // Reduced from original
        const labelHeightAllowance = 40; // Estimated space for labels above triangles

        let currentX = 0;
        let currentRowY = 0;
        let currentRowMaxHeight = 0;
        const layoutPositions = [];
        let overallMaxY = 0;

        nodesToLayout.forEach(node => {
            const triangleSide = node.r * 2;
            const triangleHeight = triangleSide * Math.sqrt(3) / 2;
            const nodeVisualWidth = triangleSide + horizontalPadding;

            if (currentX + triangleSide > availableWidth && currentX > 0) { // Move to next row
                currentRowY += currentRowMaxHeight + verticalPadding;
                currentX = 0;
                currentRowMaxHeight = 0;
            }

            node.layoutX = currentX + triangleSide / 2; // Center of triangle base
            node.layoutY = currentRowY + triangleHeight; // Base of triangle
            node.triangleSide = triangleSide;
            node.triangleHeight = triangleHeight;
            
            layoutPositions.push({ ...node }); // Store layout info

            currentX += nodeVisualWidth;
            currentRowMaxHeight = Math.max(currentRowMaxHeight, triangleHeight);
            overallMaxY = Math.max(overallMaxY, node.layoutY);
        });
        
        const totalLayoutHeight = overallMaxY + labelHeightAllowance;
        return { positions: layoutPositions, totalHeight: totalLayoutHeight };
    };


    // Block 5: Data Preprocessing & Transformation
    const yValues = chartDataArray.map(d => +d[yField]);
    const minValue = d3.min(yValues);
    const maxValue = d3.max(yValues);

    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([minRadius, maxRadius]);

    const nodes = chartDataArray.map((d, i) => ({
        id: d[xField] != null ? String(d[xField]) : `__generated_${i}__`,
        value: +d[yField],
        r: radiusScale(+d[yField]), // "Radius" for triangle sizing (e.g., half of base width)
        // iconUrl: images.field && images.field[d[xField]] ? images.field[d[xField]] : (images.other?.primary || null), // Sourced, but not rendered
        originalData: d,
    })).sort((a, b) => b.r - a.r); // Sort by size (descending)

    // Perform layout
    const layout = arrangeTrianglesBottomAligned(nodes, innerWidth);
    const laidOutNodes = layout.positions;
    const requiredLayoutHeight = layout.totalHeight;

    // Adjust SVG height if needed to fit content
    if (requiredLayoutHeight > innerHeight) {
        innerHeight = requiredLayoutHeight;
        containerHeight = innerHeight + chartMargins.top + chartMargins.bottom;
        svgRoot.attr("height", containerHeight);
    }
    
    // Block 6: Scale Definition & Configuration
    // radiusScale already defined in Block 5.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type as per original and simplification.

    // Block 8: Main Data Visualization Rendering
    const nodeGroups = mainChartGroup.selectAll("g.node-group")
        .data(laidOutNodes, d => d.id)
        .join("g")
        .attr("class", d => `node-group mark other ${d.id.startsWith("__generated_") ? "generated-id" : "data-id"}`)
        .attr("transform", d => {
            // Position group so that (0,0) is the triangle's centroid for easier path drawing
            // Triangle base is at d.layoutY. Centroid is 1/3 height from base.
            return `translate(${d.layoutX}, ${d.layoutY - d.triangleHeight / 3})`;
        });

    nodeGroups.each(function(dNode) {
        const group = d3.select(this);
        const side = dNode.triangleSide;
        const height = dNode.triangleHeight;
        const valueText = `${dNode.value}${yUnit}`;
        const categoryText = dNode.id.startsWith("__generated_") ? "" : dNode.id;

        // Triangle points relative to centroid (0,0)
        const topPoint = [0, -height * 2/3];
        const leftPoint = [-side / 2, height * 1/3];
        const rightPoint = [side / 2, height * 1/3];

        group.append("path")
            .attr("class", "mark triangle-path")
            .attr("d", createTrianglePath(topPoint, leftPoint, rightPoint))
            .attr("fill", fillStyle.primaryColor)
            .attr("stroke", fillStyle.triangleStrokeColor)
            .attr("stroke-width", fillStyle.triangleStrokeWidth);

        const isLargeTriangle = side >= triangleMinSideForInnerLabel;
        const labelPadding = 5; // General padding for labels

        if (isLargeTriangle) { // Labels inside for large triangles, category above
            // Value label inside, near bottom
            group.append("text")
                .attr("class", "label value-label inner-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "alphabetic") // baseline for y
                .attr("y", height * 1/3 - labelPadding - (fillStyle.typography.valueFontSize * 0.2)) // Position above bottom edge
                .style("font-family", fillStyle.typography.valueFontFamily)
                .style("font-size", `${fillStyle.typography.valueFontSize}px`)
                .style("font-weight", fillStyle.typography.valueFontWeight)
                .style("fill", fillStyle.innerValueColor)
                .text(valueText);

            // Category label above triangle
            if (categoryText) {
                const catLabelY = -height * 2/3 - labelPadding * 3; // Position above top point
                const lines = splitTextIntoLines(categoryText, fillStyle.typography.categoryFontFamily, fillStyle.typography.categoryFontSize, fillStyle.typography.categoryFontWeight, side * 1.2); // Max width related to triangle size
                
                const lineHeight = fillStyle.typography.categoryFontSize * 1.2;
                const totalTextHeight = lines.length * lineHeight - (lineHeight - fillStyle.typography.categoryFontSize); // More precise height

                if (lines.length > 0) {
                     const firstLineWidth = estimateTextWidth(lines[0], fillStyle.typography.categoryFontFamily, fillStyle.typography.categoryFontSize, fillStyle.typography.categoryFontWeight);
                     const rectWidth = Math.max(...lines.map(l => estimateTextWidth(l, fillStyle.typography.categoryFontFamily, fillStyle.typography.categoryFontSize, fillStyle.typography.categoryFontWeight))) + labelPadding * 2;
                     const rectHeight = totalTextHeight + labelPadding;
                
                    group.append("rect")
                        .attr("class", "label-background other")
                        .attr("x", -rectWidth / 2)
                        .attr("y", catLabelY - totalTextHeight + (lineHeight - fillStyle.typography.categoryFontSize)/2 - labelPadding/2)
                        .attr("width", rectWidth)
                        .attr("height", rectHeight)
                        .attr("rx", 3)
                        .attr("ry", 3)
                        .style("fill", fillStyle.labelBackgroundColor)
                        .style("stroke", fillStyle.labelBorderColor)
                        .style("stroke-width", fillStyle.labelBorderWidth);

                    lines.forEach((line, i) => {
                        group.append("text")
                            .attr("class", "label category-label outer-label")
                            .attr("text-anchor", "middle")
                            .attr("dominant-baseline", "hanging")
                            .attr("y", catLabelY - totalTextHeight + i * lineHeight + (lineHeight - fillStyle.typography.categoryFontSize)/2)
                            .style("font-family", fillStyle.typography.categoryFontFamily)
                            .style("font-size", `${fillStyle.typography.categoryFontSize}px`)
                            .style("font-weight", fillStyle.typography.categoryFontWeight)
                            .style("fill", fillStyle.textColor)
                            .text(line);
                    });
                }
            }

        } else { // All labels above for small triangles
            const combinedLabelY = -height * 2/3 - labelPadding * 3; // Start Y for labels above
            let currentY = combinedLabelY;
            const textsToRender = [];

            if (categoryText) {
                textsToRender.push({
                    text: categoryText,
                    fontFamily: fillStyle.typography.categoryFontFamily,
                    fontSize: fillStyle.typography.categoryFontSize,
                    fontWeight: fillStyle.typography.categoryFontWeight,
                    color: fillStyle.textColor,
                    class: "category-label outer-label"
                });
            }
            textsToRender.push({
                text: valueText,
                fontFamily: fillStyle.typography.valueFontFamily,
                fontSize: fillStyle.typography.valueFontSize,
                fontWeight: fillStyle.typography.valueFontWeight,
                color: fillStyle.textColor,
                class: "value-label outer-label"
            });

            const maxWidthForLabel = Math.max(side * 1.5, 80); // Ensure some minimum width
            let allLines = [];
            textsToRender.forEach(item => {
                const itemLines = splitTextIntoLines(item.text, item.fontFamily, item.fontSize, item.fontWeight, maxWidthForLabel);
                itemLines.forEach(line => allLines.push({line: line, ...item}));
            });
            
            const lineHeightFactor = 1.2;
            let totalTextHeight = 0;
            allLines.forEach(item => totalTextHeight += item.fontSize * lineHeightFactor);
            totalTextHeight -= (allLines.length > 0 ? allLines[allLines.length-1].fontSize * (lineHeightFactor - 1) : 0);


            if (allLines.length > 0) {
                const rectWidth = Math.max(...allLines.map(l => estimateTextWidth(l.line, l.fontFamily, l.fontSize, l.fontWeight))) + labelPadding * 2;
                const rectHeight = totalTextHeight + labelPadding;

                group.append("rect")
                    .attr("class", "label-background other")
                    .attr("x", -rectWidth / 2)
                    .attr("y", combinedLabelY - totalTextHeight - labelPadding / 2)
                    .attr("width", rectWidth)
                    .attr("height", rectHeight)
                    .attr("rx", 3)
                    .attr("ry", 3)
                    .style("fill", fillStyle.labelBackgroundColor)
                    .style("stroke", fillStyle.labelBorderColor)
                    .style("stroke-width", fillStyle.labelBorderWidth);
                
                currentY = combinedLabelY - totalTextHeight;
                allLines.forEach(item => {
                     group.append("text")
                        .attr("class", `label ${item.class}`)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "hanging")
                        .attr("y", currentY)
                        .style("font-family", item.fontFamily)
                        .style("font-size", `${item.fontSize}px`)
                        .style("font-weight", item.fontWeight)
                        .style("fill", item.color)
                        .text(item.line);
                    currentY += item.fontSize * lineHeightFactor;
                });
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects like shadows or gradients are applied.
    // Icons are not rendered in this version to match original visual output,
    // though `fillStyle.images` could be populated if `data.images` is provided.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}