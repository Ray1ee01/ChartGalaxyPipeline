/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Square)",
  "chart_name": "proportional_area_chart_square_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[4, 10], [0, 100]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This chart displays proportional data using squares, where a diagonal division within each square represents the proportion.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or colors_dark would be specified if needed
    const images = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const groupFieldConfig = dataColumns.find(col => col.role === "x");
    const percentageFieldConfig = dataColumns.find(col => col.role === "y");

    if (!groupFieldConfig || !percentageFieldConfig) {
        const missing = [];
        if (!groupFieldConfig) missing.push("x-role field");
        if (!percentageFieldConfig) missing.push("y-role field");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const groupFieldName = groupFieldConfig.name;
    const percentageFieldName = percentageFieldConfig.name;
    const percentageFieldLabel = percentageFieldConfig.title || percentageFieldName;


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#0f223b',
        primaryColor: (colors.other && colors.other.primary) ? colors.other.primary : '#f39c12', // Default Orange
        secondaryColor: (colors.other && colors.other.secondary) ? colors.other.secondary : '#3498db', // Default Blue
        groupLabelColor: '#FFFFFF', // White text for labels on colored squares
        typography: {
            baseFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            baseFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold', // Group labels were bold
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'bold', // Percentage labels were bold
        }
    };
    
    // Helper to estimate text width (in-memory)
    function estimateTextWidth(text, fontSize, fontFamily, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Document.body.appendChild(svg); // Temporarily append to getBBox, then remove
        // Note: Appending to body is not strictly necessary for getBBox in modern browsers if styles are applied directly.
        // However, for full robustness, especially with complex CSS, it can be safer.
        // For this refactoring, assuming direct style application is sufficient for getBBox.
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback or error handling if getBBox fails (e.g., in a very restricted environment)
            console.warn("getBBox failed for text width estimation", e);
            width = text.length * (parseFloat(fontSize) * 0.6); // Rough estimate
        }
        // svg.remove(); // If appended
        return width;
    }

    // Helper for text wrapping
    function wrapText(textElement, text, maxWidth, lineHeight, fontSize, fontFamily, fontWeight) {
        textElement.selectAll("tspan").remove(); // Clear previous tspans
        const words = text.split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const x = textElement.attr("x") || 0;
        const y = textElement.attr("y") || 0;
        const dy = parseFloat(textElement.attr("dy") || 0);
        
        let tspan = textElement.append("tspan").attr("x", x).attr("dy", dy + "em");

        let lines = [];
        let currentLineArray = [];

        while (word = words.pop()) {
            currentLineArray.push(word);
            tspan.text(currentLineArray.join(" "));
            if (estimateTextWidth(currentLineArray.join(" "), `${fontSize}px`, fontFamily, fontWeight) > maxWidth && currentLineArray.length > 1) {
                currentLineArray.pop(); // remove word that broke limit
                lines.push(currentLineArray.join(" "));
                currentLineArray = [word]; // start new line with current word
            }
        }
        lines.push(currentLineArray.join(" ")); // push the last line

        textElement.text(null); // Clear original text before adding tspans

        const totalTextHeight = lines.length * lineHeight;
        const startYOffset = -(totalTextHeight / 2) + (lineHeight / 2) - (lineHeight * 0.15); // Adjust for dominant-baseline and centering

        lines.forEach((lineText, i) => {
            textElement.append("tspan")
                .attr("x", x)
                .attr("dy", (i === 0 ? startYOffset : lineHeight) + "px") // Relative dy for subsequent lines
                .text(lineText)
                .attr("class", "text-line");
        });
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 };
    if (variables.margin_top !== undefined) chartMargins.top = variables.margin_top;
    if (variables.margin_right !== undefined) chartMargins.right = variables.margin_right;
    if (variables.margin_bottom !== undefined) chartMargins.bottom = variables.margin_bottom;
    if (variables.margin_left !== undefined) chartMargins.left = variables.margin_left;
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const filteredData = chartDataInput.filter(d =>
        d[percentageFieldName] !== null && d[percentageFieldName] !== undefined &&
        d[percentageFieldName] >= 0 && d[percentageFieldName] <= 100
    );

    filteredData.sort((a, b) => b[percentageFieldName] - a[percentageFieldName]);

    // Block 6: Scale Definition & Configuration (Calculations for layout)
    const squareCount = filteredData.length;
    const squarePadding = variables.square_padding !== undefined ? variables.square_padding : 10; // Padding between squares

    // Calculate squareSize to fit vertically, considering padding
    // Max possible height for squares area: innerHeight
    // Total padding: (squareCount - 1) * squarePadding
    // Height available for squares themselves: innerHeight - (squareCount - 1) * squarePadding
    // Height per square: (innerHeight - (squareCount - 1) * squarePadding) / squareCount
    let squareSize = (innerHeight - Math.max(0, squareCount - 1) * squarePadding) / Math.max(1, squareCount);
    // Also ensure squares don't overflow horizontally (though they are stacked vertically)
    squareSize = Math.min(squareSize, innerWidth);
    squareSize = Math.max(10, squareSize); // Minimum square size


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type.
    // Background is handled by SVG root style.

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "chart-group");

    // Block 8: Main Data Visualization Rendering
    filteredData.forEach((d, i) => {
        const groupName = d[groupFieldName];
        const percentage = d[percentageFieldName];

        const yPos = i * (squareSize + squarePadding);

        // Original logic for x position based on a diagonal across the *entire SVG*
        // y_in_svg_coords = chartMargins.top + yPos
        // diagonal_ref_x_at_y_in_svg_coords = (chartMargins.top + yPos) * (containerWidth / containerHeight)
        // x_pos_in_mainChartGroup = diagonal_ref_x_at_y_in_svg_coords - chartMargins.left + squareSize * (percentage / 50 - 1)
        // This can be simplified if the diagonal is meant to be within the mainChartGroup's coordinate system using innerWidth/innerHeight
        // Let's stick to the original's apparent intent: diagonal relative to overall SVG dimensions
        const diagonalXReference = (yPos + chartMargins.top) * (containerWidth / containerHeight) - chartMargins.left;
        const xPos = diagonalXReference + squareSize * (percentage / 100 * 2 - 1); // percentage/50 - 1 = percentage/100*2 - 1

        const squareGroup = mainChartGroup.append("g")
            .attr("transform", `translate(${xPos}, ${yPos})`)
            .attr("class", "mark square-item");

        // Background part of the square (secondary color)
        squareGroup.append("path")
            .attr("d", `M 0,0 L ${squareSize},0 L ${squareSize},${squareSize} L 0,${squareSize} Z`)
            .attr("fill", fillStyle.secondaryColor)
            .attr("class", "mark square-path background-part");

        // Foreground part of the square (primary color)
        squareGroup.append("path")
            .attr("d", () => {
                if (percentage <= 50) {
                    const p = percentage / 50; // Scale 0-50% to 0-1
                    const cutX = (1 - p) * squareSize;
                    return `M ${cutX},0 L ${squareSize},0 L ${squareSize},${squareSize - cutX} Z`;
                } else {
                    const p = (percentage - 50) / 50; // Scale 50-100% to 0-1
                    const cutX = p * squareSize;
                    return `M 0,0 L ${squareSize},0 L ${squareSize},${squareSize} L ${squareSize - cutX},${squareSize} L 0,${cutX} Z`;
                }
            })
            .attr("fill", fillStyle.primaryColor)
            .attr("class", "mark square-path foreground-part");

        // Group name label
        const groupLabelFontSize = Math.max(12, Math.min(24, squareSize / 8)); // Dynamic font size
        const groupLabelLineHeight = groupLabelFontSize * 1.2;
        const groupLabelMaxWidth = squareSize * 0.9;

        const groupLabel = squareGroup.append("text")
            .attr("x", squareSize / 2)
            .attr("y", squareSize / 2) // Initial y, wrapText will adjust
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central") // Better for vertical centering with tspans
            .attr("fill", fillStyle.groupLabelColor)
            .style("font-family", fillStyle.typography.baseFontFamily)
            .style("font-weight", fillStyle.typography.baseFontWeight)
            .style("font-size", `${groupLabelFontSize}px`)
            .attr("class", "label group-label");
        
        wrapText(groupLabel, String(groupName), groupLabelMaxWidth, groupLabelLineHeight, groupLabelFontSize, fillStyle.typography.baseFontFamily, fillStyle.typography.baseFontWeight);


        // Percentage labels and extension lines
        const isFirstSquare = i === 0;
        const isLastSquare = i === filteredData.length - 1;
        const extensionLength = variables.extension_line_length || 30;
        const percentageLabelFontSize = Math.max(10, Math.min(18, squareSize / 10));
        const percentageLabelYFieldExtraLength = (percentageFieldLabel || "").length * percentageLabelFontSize * 0.5;


        // Primary percentage label (top/right)
        if (isLastSquare && squareCount > 1) { // Last square: line goes up from right edge
            squareGroup.append("line")
                .attr("x1", squareSize - 1)
                .attr("y1", 0)
                .attr("x2", squareSize - 1)
                .attr("y2", -extensionLength)
                .attr("stroke", fillStyle.primaryColor)
                .attr("stroke-width", 1.5)
                .attr("class", "mark extension-line primary");
            squareGroup.append("text")
                .attr("x", squareSize - 5)
                .attr("y", -extensionLength / 2)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.primaryColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("font-size", `${percentageLabelFontSize}px`)
                .text(`${Number(percentage).toFixed(1)}%`)
                .attr("class", "label percentage-label primary");
        } else { // Other squares (including first, or if only one square): line goes right from top edge
            const lineEndX = squareSize + extensionLength + (isFirstSquare ? percentageLabelYFieldExtraLength : 0);
            squareGroup.append("line")
                .attr("x1", squareSize)
                .attr("y1", 1)
                .attr("x2", lineEndX)
                .attr("y2", 1)
                .attr("stroke", fillStyle.primaryColor)
                .attr("stroke-width", 1.5)
                .attr("class", "mark extension-line primary");
            squareGroup.append("text")
                .attr("x", squareSize + 5)
                .attr("y", -5) // Position above the line
                .attr("text-anchor", "start")
                .attr("dominant-baseline", "alphabetic")
                .attr("fill", fillStyle.primaryColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("font-size", `${percentageLabelFontSize}px`)
                .text(`${Number(percentage).toFixed(1)}%`)
                .attr("class", "label percentage-label primary");

            if (isFirstSquare) {
                squareGroup.append("text")
                    .attr("x", squareSize + 5 + extensionLength * 0.7) // Position after percentage
                    .attr("y", -5)
                    .attr("text-anchor", "start")
                    .attr("dominant-baseline", "alphabetic")
                    .attr("fill", fillStyle.primaryColor)
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("font-size", `${percentageLabelFontSize}px`)
                    .text(percentageFieldLabel)
                    .attr("class", "label field-name-label primary");
            }
        }

        // Inverse percentage label (bottom/left)
        const inversePercentage = 100 - percentage;
        if (isFirstSquare && squareCount > 1) { // First square: line goes down from left edge
            squareGroup.append("line")
                .attr("x1", 1)
                .attr("y1", squareSize)
                .attr("x2", 1)
                .attr("y2", squareSize + extensionLength)
                .attr("stroke", fillStyle.secondaryColor)
                .attr("stroke-width", 1.5)
                .attr("class", "mark extension-line secondary");
            squareGroup.append("text")
                .attr("x", 5)
                .attr("y", squareSize + extensionLength / 2)
                .attr("text-anchor", "start")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.secondaryColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("font-size", `${percentageLabelFontSize}px`)
                .text(`${Number(inversePercentage).toFixed(1)}%`)
                .attr("class", "label percentage-label secondary");
        } else if (squareCount > 0) { // Other squares (including last, or if only one square): line goes left from bottom edge
             squareGroup.append("line")
                .attr("x1", 0)
                .attr("y1", squareSize - 1)
                .attr("x2", -extensionLength)
                .attr("y2", squareSize - 1)
                .attr("stroke", fillStyle.secondaryColor)
                .attr("stroke-width", 1.5)
                .attr("class", "mark extension-line secondary");
            squareGroup.append("text")
                .attr("x", -5)
                .attr("y", squareSize + 5) // Position below the line
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "hanging")
                .attr("fill", fillStyle.secondaryColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("font-size", `${percentageLabelFontSize}px`)
                .text(`${Number(inversePercentage).toFixed(1)}%`)
                .attr("class", "label percentage-label secondary");
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements)
    // None in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}