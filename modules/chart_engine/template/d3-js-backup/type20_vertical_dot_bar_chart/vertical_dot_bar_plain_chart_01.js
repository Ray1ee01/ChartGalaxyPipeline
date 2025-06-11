/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Dot Bar Chart",
  "chart_name": "vertical_dot_bar_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is now external to the function)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const imagesInput = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";

    const xFieldConfig = dataColumns.find(col => col.role === xFieldRole);
    const yFieldConfig = dataColumns.find(col => col.role === yFieldRole);

    if (!xFieldConfig || !xFieldConfig.name) {
        console.error("Critical chart config missing: x-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (x-axis field name).</div>");
        return null;
    }
    if (!yFieldConfig || !yFieldConfig.name) {
        console.error("Critical chart config missing: y-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (y-axis field name).</div>");
        return null;
    }

    const categoryFieldName = xFieldConfig.name;
    const valueFieldName = yFieldConfig.name;
    let valueFieldUnit = (yFieldConfig.unit && yFieldConfig.unit !== "none") ? yFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryDotColor: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#4A90E2',
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF', // Not directly used for SVG background, but good practice
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        }
    };

    function estimateTextWidth(text, fontProps) {
        if (!text || !fontProps) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.position = 'absolute'; // Avoid layout shift if appended, though not appending here
        // tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family || 'Arial, sans-serif');
        tempText.setAttribute('font-size', fontProps.font_size || '12px');
        tempText.setAttribute('font-weight', fontProps.font_weight || 'normal');
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // document.body.appendChild(tempSvg); // Required for reliable getBBox in some browsers
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached fails (e.g. JSDOM without layout)
            const fontSizePx = parseFloat(fontProps.font_size || '12px');
            width = text.length * fontSizePx * 0.6; // Very rough estimate
            // console.warn("getBBox failed for text measurement, using fallback.", e);
        }
        // document.body.removeChild(tempSvg); // Clean up if appended
        return width;
    }
    
    const calculateAdaptiveFontSize = (text, maxWidth, baseFontProps, minFontSize = 8) => {
        let fontSize = parseFloat(baseFontProps.font_size);
        let currentFontProps = { ...baseFontProps };

        while (fontSize >= minFontSize) {
            currentFontProps.font_size = `${fontSize}px`;
            if (estimateTextWidth(text, currentFontProps) <= maxWidth) {
                return `${fontSize}px`;
            }
            fontSize -= 0.5;
        }
        return `${minFontSize}px`;
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    const wrapText = (textElement, textContent, maxWidth) => {
        const words = textContent.split(/\s+/).reverse();
        let line = [];
        const lines = [];
        let word;
        
        textElement.text(null); // Clear existing text

        if (words.length > 1) {
            while (word = words.pop()) {
                line.push(word);
                const currentLineText = line.join(" ");
                // Temporarily set text to measure
                textElement.text(currentLineText);
                if (textElement.node().getComputedTextLength() > maxWidth && line.length > 1) {
                    textElement.text(null); // Clear temp text
                    line.pop(); // Remove last word
                    lines.push(line.join(" "));
                    line = [word]; // Start new line with current word
                }
            }
            if (line.length > 0) {
                 lines.push(line.join(" "));
            }
            textElement.text(null); // Clear text before adding tspans
        } else {
            lines.push(textContent);
            textElement.text(null);
        }
        
        const lineHeight = 1.1; // em
        const startDy = -(lines.length - 1) * lineHeight / 2; // Center vertically slightly better for 2 lines, or adjust as needed
                                                          // Original: -(lines.length - 1) * lineHeight aligns bottom line.
                                                          // For top labels, usually 0 for first line, then 1.1em for next.
                                                          // Let's try to align the block's middle more or less with y=0.
                                                          // Or, simply align top:
        const initialDy = 0; // Adjust if baseline needs to be different from y=0

        lines.forEach((singleLine, i) => {
            textElement.append("tspan")
                .attr("class", "text-segment") // Added class for tspan
                .attr("x", textElement.attr("x")) // Ensure x is reset for each tspan
                .attr("dy", (i === 0 ? initialDy : lineHeight) + "em") // First line at initialDy, subsequent lines offset by lineHeight
                .text(singleLine);
        });
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground); // Optional: set background on SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 30, bottom: 50, left: 30 }; // Adjusted bottom margin
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Dot layout parameters
    const defaultDotHeight = 8;
    const defaultDotSpacing = 3;
    const dotGroupSize = 10; // Number of dots before a larger spacing
    const dotGroupSpacing = 12; // Larger spacing between groups of dots

    // Block 5: Data Preprocessing & Transformation
    let chartData = JSON.parse(JSON.stringify(chartDataInput)); // Deep copy for manipulation

    const maxValueRaw = d3.max(chartData, d => Math.abs(+d[valueFieldName]));
    
    chartData.forEach(d => {
        d[`${valueFieldName}_normalized`] = +d[valueFieldName]; // Store original value for display
        if (maxValueRaw > 100) {
            d[`${valueFieldName}_dotCount`] = Math.max(1, Math.floor((+d[valueFieldName] / maxValueRaw) * 50));
        } else {
            d[`${valueFieldName}_dotCount`] = Math.max(1, Math.floor(+d[valueFieldName]));
        }
    });

    const sortedData = chartData.sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const sortedCategoryNames = sortedData.map(d => d[categoryFieldName]);

    // Calculate dynamic dot size based on available height
    // This calculation is an estimate based on a typical item (e.g., max dots)
    const maxDotsOverall = d3.max(sortedData, d => d[`${valueFieldName}_dotCount`]) || 1;
    const numGroupsForMax = Math.ceil(maxDotsOverall / dotGroupSize);
    const heightForMaxDotsStack = numGroupsForMax * dotGroupSize * defaultDotHeight + 
                                  (numGroupsForMax * (dotGroupSize -1) * defaultDotSpacing) + 
                                  Math.max(0, numGroupsForMax - 1) * dotGroupSpacing;

    const spaceForLabels = 60; // Approximate space for category and value labels
    const availableHeightForDots = innerHeight - spaceForLabels;
    
    let dotHeight = defaultDotHeight;
    let dotSpacing = defaultDotSpacing;

    if (heightForMaxDotsStack > availableHeightForDots && availableHeightForDots > 0) {
        const scaleFactor = availableHeightForDots / heightForMaxDotsStack;
        dotHeight = Math.max(2, Math.floor(defaultDotHeight * scaleFactor));
        dotSpacing = Math.max(1, Math.floor(defaultDotSpacing * scaleFactor));
    }


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(sortedCategoryNames)
        .range([0, innerWidth])
        .padding(0.2);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Pre-calculate uniform font size for category labels
    const longestCategoryName = sortedCategoryNames.reduce((a, b) => 
        (a ? a.toString() : "").length > (b ? b.toString() : "").length ? a : b, "").toString();
    
    const maxLabelWidth = xScale.bandwidth() * 0.9; // Allow more width for label
    const baseCategoryFontProps = {
        font_family: fillStyle.typography.labelFontFamily,
        font_size: fillStyle.typography.labelFontSize,
        font_weight: fillStyle.typography.labelFontWeight
    };
    const uniformCategoryFontSize = calculateAdaptiveFontSize(longestCategoryName, maxLabelWidth, baseCategoryFontProps);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    sortedCategoryNames.forEach(categoryName => {
        const dataPoint = sortedData.find(d => d[categoryFieldName] === categoryName);
        if (!dataPoint) return;

        const columnWidth = xScale.bandwidth();
        const dotStackWidth = columnWidth * 0.7; // Width of the stack of dots
        const dotX = xScale(categoryName) + (columnWidth - dotStackWidth) / 2;
        const dotCount = dataPoint[`${valueFieldName}_dotCount`];

        // Category Labels (at the top of each column)
        const categoryLabel = mainChartGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", xScale(categoryName) + columnWidth / 2)
            .attr("y", 0) // Positioned at the top of the main group, text grows downwards if wrapped
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", uniformCategoryFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryName.toString());
        
        // Apply wrapping if text is too long (using original y for first line)
        // The wrapText function needs to be called after initial text rendering to get computed styles if it relies on them.
        // Here, we pass explicit font details so it should be fine.
        // Check if wrapping is needed:
        const tempLabelFontProps = {
            font_family: fillStyle.typography.labelFontFamily,
            font_size: uniformCategoryFontSize,
            font_weight: fillStyle.typography.labelFontWeight
        };
        if (estimateTextWidth(categoryName.toString(), tempLabelFontProps) > maxLabelWidth) {
             // Adjust y for wrapped text to ensure it doesn't go too high with default wrapText behavior
             // The provided wrapText aligns the last line with the original 'y'.
             // For top labels, we want the first line at 'y' or slightly below.
             // The modified wrapText now uses dy=0 for first line, then 1.1em for subsequent.
            wrapText(categoryLabel, categoryName.toString(), maxLabelWidth);
        }
         // Adjust y position of category label to be slightly above the dots, considering wrapped text height.
        const labelBBox = categoryLabel.node().getBBox();
        categoryLabel.attr("y", -labelBBox.height /2); // Shift up to be above the y=0 line for dots

        // Render Dots (as rounded rectangles)
        let currentY = 10; // Starting Y position for the first dot/group, relative to mainChartGroup
        for (let i = 0; i < dotCount; i++) {
            const groupIndex = Math.floor(i / dotGroupSize);
            const inGroupIndex = i % dotGroupSize;

            if (inGroupIndex === 0 && i > 0) { // If start of a new group (and not the very first dot)
                currentY += dotGroupSpacing;
            }
            
            mainChartGroup.append("rect")
                .attr("class", "mark dot-mark")
                .attr("x", dotX)
                .attr("y", currentY)
                .attr("width", dotStackWidth)
                .attr("height", dotHeight)
                .attr("fill", fillStyle.primaryDotColor)
                .attr("rx", dotHeight / 2) // For pill/circle shape
                .attr("ry", dotHeight / 2);
            
            currentY += (dotHeight + dotSpacing);
        }
        const lastDotBottomY = currentY - dotSpacing; // Position of the bottom of the last dot

        // Value Labels (below the dots)
        const formattedValue = valueFieldUnit ?
            `${formatValue(dataPoint[`${valueFieldName}_normalized`])}${valueFieldUnit}` :
            `${formatValue(dataPoint[`${valueFieldName}_normalized`])}`;
        
        mainChartGroup.append("text")
            .attr("class", "value data-value-label")
            .attr("x", xScale(categoryName) + columnWidth / 2)
            .attr("y", lastDotBottomY + 15 + parseFloat(fillStyle.typography.annotationFontSize)) // Position below dots + padding + font ascender
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedValue);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - None in this chart)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}