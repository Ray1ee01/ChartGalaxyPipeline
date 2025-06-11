/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Lollipop Chart",
  "chart_name": "vertical_lollipop_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 12], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "visible",
  "gridLineType": "subtle",
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");

    if (!xFieldConfig || !xFieldConfig.name) {
        console.error("Critical chart config missing: X-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: X-axis field name is not configured.</div>");
        return null;
    }
    if (!yFieldConfig || !yFieldConfig.name) {
        console.error("Critical chart config missing: Y-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Y-axis field name is not configured.</div>");
        return null;
    }

    const categoryFieldName = xFieldConfig.name;
    const valueFieldName = yFieldConfig.name;
    const categoryFieldUnit = xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    const valueFieldUnit = yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            axisLabelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            axisLabelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '14px',
            axisLabelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'bold',
            
            dataLabelFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            dataLabelFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '16px', // Base size, might be adjusted
            dataLabelFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'bold',

            tickLabelFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            tickLabelFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size && parseInt(typographyConfig.annotation.font_size) > 6 ? typographyConfig.annotation.font_size : '12px'), // Original had 12px fixed
            tickLabelFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        primaryColor: (colorsConfig.other && colorsConfig.other.primary) || '#1f77b4',
        gridLineColor: (colorsConfig.other && colorsConfig.other.grid) || '#e0e0e0',
        axisLineColor: 'none', // As per original, y-axis domain line hidden
        iconUrls: {},
    };

    if (imagesConfig.field) {
        Object.keys(imagesConfig.field).forEach(key => {
            fillStyle.iconUrls[key] = imagesConfig.field[key];
        });
    }
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    const estimateTextWidth = (text, fontConfig) => {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.width = '1px'; // Minimal size
        tempSvg.style.height = '1px';

        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.style.fontFamily = fontConfig.font_family || fillStyle.typography.axisLabelFontFamily;
        tempTextElement.style.fontSize = fontConfig.font_size || fillStyle.typography.axisLabelFontSize;
        tempTextElement.style.fontWeight = fontConfig.font_weight || fillStyle.typography.axisLabelFontWeight;
        tempTextElement.textContent = text;
        
        tempSvg.appendChild(tempTextElement);
        // Appending to body temporarily to allow getBBox, then remove.
        // This is a common workaround if not already in a rendered SVG context.
        // However, for true in-memory, it should work without appending if styles are fully defined.
        // Let's try without appending first. If getBBox returns 0, this might be needed.
        // document.body.appendChild(tempSvg); // Not ideal, try to avoid
        let width = 0;
        try {
            width = tempTextElement.getBBox().width;
        } catch (e) {
            // Fallback or error handling if getBBox fails (e.g. in a very restricted environment)
            // For this refactor, assume getBBox works on non-appended elements with explicit styling.
            console.warn("estimateTextWidth getBBox failed for text:", text, e);
            width = text.length * (parseInt(fontConfig.font_size || fillStyle.typography.axisLabelFontSize) * 0.6); // Rough estimate
        }
        // tempSvg.remove(); // if appended to body
        return width;
    };
    
    const calculateFontSizeForCategoryLabels = (text, maxWidth, baseSize = 12) => {
        const avgCharWidth = baseSize * 0.6;
        const textWidth = text.length * avgCharWidth;
        if (textWidth < maxWidth) return baseSize;
        return Math.max(8, Math.floor(baseSize * (maxWidth / textWidth)));
    };

    function wrapText(textElement, textContent, maxWidth, lineHeightEm = 1.1, verticalAlignment = 'middle') {
        textElement.text(null); // Clear existing content
        const words = textContent.split(/\s+/).reverse();
        let word;
        let line = [];
        let tspanLines = [];
        const x = textElement.attr("x"); // Keep original x
        const initialY = parseFloat(textElement.attr("y"));
        const actualFontSize = parseFloat(textElement.style("font-size"));

        let currentLineContent = [];
        if (words.length > 1) { // Word wrapping
            while (word = words.pop()) {
                currentLineContent.push(word);
                textElement.text(currentLineContent.join(" "));
                if (textElement.node().getComputedTextLength() > maxWidth && currentLineContent.length > 1) {
                    currentLineContent.pop();
                    tspanLines.push(currentLineContent.join(" "));
                    currentLineContent = [word];
                }
            }
            tspanLines.push(currentLineContent.join(" "));
        } else { // Character wrapping for single very long word
            const chars = textContent.split('');
            let currentSegment = '';
            for (let char of chars) {
                textElement.text(currentSegment + char);
                if (textElement.node().getComputedTextLength() > maxWidth && currentSegment.length > 0) {
                    tspanLines.push(currentSegment);
                    currentSegment = char;
                } else {
                    currentSegment += char;
                }
            }
            tspanLines.push(currentSegment);
        }
        textElement.text(null); // Clear again before adding tspans

        const totalLines = tspanLines.length;
        let startDy;
        if (verticalAlignment === 'middle') {
            startDy = -((totalLines - 1) / 2) * lineHeightEm;
        } else if (verticalAlignment === 'bottom') {
            startDy = -(totalLines - 1) * lineHeightEm;
        } else { // top alignment
            startDy = 0;
        }
        
        tspanLines.forEach((lineText, i) => {
            textElement.append("tspan")
                .attr("x", x)
                .attr("dy", (i === 0 ? startDy : lineHeightEm) + "em")
                .text(lineText);
        });
         // Reset Y to initial Y if alignment is top, otherwise adjust based on startDy
        if (verticalAlignment === 'top') {
            textElement.attr("y", initialY);
        } else {
             textElement.attr("y", initialY + (startDy * actualFontSize)); // Approximate adjustment
        }
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
        .style("background-color", colorsConfig.background_color || 'transparent');


    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 40,
        right: 20, // Adjusted as value labels are above, not to the right
        bottom: 90, // For category labels
        left: 60  // For Y-axis labels
    };
    
    // Pre-calculate category label widths for wrapping logic
    const categoryLabelWidths = {};
    chartDataInput.forEach(d => {
        const categoryText = String(d[categoryFieldName] || "");
         categoryLabelWidths[categoryText] = estimateTextWidth(categoryText, {
            font_family: fillStyle.typography.axisLabelFontFamily,
            font_size: fillStyle.typography.axisLabelFontSize,
            font_weight: fillStyle.typography.axisLabelFontWeight
        });
    });
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const sortedDataArray = [...chartDataInput].sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);
    const sortedCategoryNames = sortedDataArray.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(sortedCategoryNames)
        .range([0, innerWidth])
        .padding(0.2);

    const columnWidth = xScale.bandwidth();
    const barWidth = Math.max(columnWidth * 0.6, 10); // Lollipop head/stem base width
    const iconVisualRadius = barWidth / 2; // Radius of the circle part of lollipop
    const stemWidth = Math.max(barWidth / 4, 2); // Width of the lollipop stem

    // Y-scale: range adjusted to leave space for icons/labels above the lollipop heads
    // The original logic for iconPadding in yScale range was a bit opaque.
    // Simpler: ensure max value + label fits. Max value label height can be estimated.
    // For now, let's use a fixed padding at the top, e.g., 30px for labels.
    const yAxisTopPadding = iconVisualRadius + (parseFloat(fillStyle.typography.dataLabelFontSize) * 2.5); // Space for circle + label (approx 2 lines)

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(sortedDataArray, d => +d[valueFieldName]) * 1.1 || 10]) // Ensure domain is at least 0-10
        .range([innerHeight, yAxisTopPadding]); // Value 0 at bottom, max value with padding at top


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const gridLinesGroup = mainChartGroup.append("g")
        .attr("class", "grid");

    yScale.ticks(5).forEach(tickValue => {
        if (tickValue > 0) { // Don't draw grid line at 0 if axis line is there
            gridLinesGroup.append("line")
                .attr("class", "grid-line")
                .attr("x1", 0)
                .attr("y1", yScale(tickValue))
                .attr("x2", innerWidth)
                .attr("y2", yScale(tickValue))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3");
        }
    });

    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat(d => formatValue(d) + (valueFieldUnit && d > 0 ? ` ${valueFieldUnit}`: '')); // Add unit only if value > 0

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    yAxisGroup.select(".domain").style("stroke", fillStyle.axisLineColor);
    yAxisGroup.selectAll(".tick text")
        .style("font-family", fillStyle.typography.tickLabelFontFamily)
        .style("font-size", fillStyle.typography.tickLabelFontSize)
        .style("font-weight", fillStyle.typography.tickLabelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label");


    // Block 8: Main Data Visualization Rendering (Lollipops)
    const lollipopGroup = mainChartGroup.append("g").attr("class", "lollipops");
    
    const longestCategoryLabel = sortedCategoryNames.reduce((a, b) => 
        String(a).length > String(b).length ? a : b, "").toString();
    const categoryLabelBaseFontSize = parseInt(fillStyle.typography.axisLabelFontSize);
    const categoryLabelMaxWidth = xScale.bandwidth() * 1.5; // Allow some overflow if needed
    const uniformCategoryLabelFontSize = calculateFontSizeForCategoryLabels(longestCategoryLabel, categoryLabelMaxWidth, categoryLabelBaseFontSize);

    sortedDataArray.forEach(d => {
        const category = d[categoryFieldName];
        const value = +d[valueFieldName];
        if (isNaN(value)) return; // Skip if value is not a number

        const xCenter = xScale(category) + columnWidth / 2;
        const yValue = yScale(value);
        const yBase = yScale(0); // Typically innerHeight, unless domain starts > 0

        // Lollipop Stem
        lollipopGroup.append("line")
            .attr("class", "mark lollipop-stem")
            .attr("x1", xCenter)
            .attr("y1", yBase)
            .attr("x2", xCenter)
            .attr("y2", yValue)
            .attr("stroke", fillStyle.primaryColor)
            .attr("stroke-width", stemWidth);

        // Lollipop Head (Circle)
        lollipopGroup.append("circle")
            .attr("class", "mark lollipop-head")
            .attr("cx", xCenter)
            .attr("cy", yValue)
            .attr("r", iconVisualRadius)
            .attr("fill", fillStyle.primaryColor);

        // Icon on Lollipop Head
        if (fillStyle.iconUrls[category]) {
            const iconSize = iconVisualRadius * 1.5; // Icon slightly larger than circle radius
            lollipopGroup.append("image")
                .attr("class", "icon image lollipop-icon")
                .attr("x", xCenter - iconSize / 2)
                .attr("y", yValue - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", fillStyle.iconUrls[category]);
        }

        // Category Label (X-axis)
        const categoryLabelY = innerHeight + 20; // Position below chart area
        const categoryLabelElement = lollipopGroup.append("text")
            .attr("class", "label x-axis-label")
            .attr("x", xCenter)
            .attr("y", categoryLabelY)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", `${uniformCategoryLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(String(category) + (categoryFieldUnit ? ` (${categoryFieldUnit})` : ''));
        
        if (categoryLabelWidths[category] > categoryLabelMaxWidth) {
            wrapText(categoryLabelElement, String(category) + (categoryFieldUnit ? ` (${categoryFieldUnit})` : ''), categoryLabelMaxWidth, 1.1, 'top');
        }


        // Value Label (above lollipop head)
        const formattedValueText = formatValue(value) + (valueFieldUnit ? ` ${valueFieldUnit}` : '');
        const valueLabelY = yValue - iconVisualRadius - 5; // 5px padding above circle
        
        let valueLabelFontSize = parseFloat(fillStyle.typography.dataLabelFontSize);
        const valueLabelMaxWidth = columnWidth * 1.5; // Max width for value label

        // Estimate width and adjust font if needed (simplified logic)
        const tempValueLabelForSizing = svgRoot.append("text") // Use svgRoot for temp as mainChartGroup might be transformed
            .style("visibility", "hidden")
            .style("font-family", fillStyle.typography.dataLabelFontFamily)
            .style("font-size", `${valueLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.dataLabelFontWeight)
            .text(formattedValueText);
        const estimatedValueLabelWidth = tempValueLabelForSizing.node().getComputedTextLength();
        tempValueLabelForSizing.remove();

        if (estimatedValueLabelWidth > valueLabelMaxWidth) {
            valueLabelFontSize = Math.max(8, valueLabelFontSize * (valueLabelMaxWidth / estimatedValueLabelWidth));
        }
        
        const valueLabelElement = lollipopGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", xCenter)
            .attr("y", valueLabelY)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.dataLabelFontFamily)
            .style("font-size", `${valueLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.dataLabelFontWeight)
            .style("fill", fillStyle.textColor);

        // Value label wrapping (custom multi-line logic from original, adapted)
        if (estimatedValueLabelWidth > valueLabelMaxWidth && valueLabelFontSize <= 8) { // Only wrap if font is already small
            valueLabelElement.text(null);
            const words = formattedValueText.split(/\s+/);
            let lines = [];
            if (words.length <= 1 && formattedValueText.length > 5) { // Single long word, try char split
                const chars = formattedValueText.split('');
                let currentLine = '';
                for (let i = 0; i < chars.length; i++) {
                    const testLine = currentLine + chars[i];
                    tempValueLabelForSizing.text(testLine); // Re-use temp element for sizing
                    if (tempValueLabelForSizing.node().getComputedTextLength() > valueLabelMaxWidth && currentLine.length > 0) {
                        lines.push(currentLine);
                        currentLine = chars[i];
                    } else {
                        currentLine = testLine;
                    }
                }
                if (currentLine.length > 0) lines.push(currentLine);
                tempValueLabelForSizing.remove();
            } else { // Word split
                 let currentLineArray = [];
                 while(words.length > 0) {
                    const word = words.shift();
                    currentLineArray.push(word);
                    tempValueLabelForSizing.text(currentLineArray.join(' '));
                    if (tempValueLabelForSizing.node().getComputedTextLength() > valueLabelMaxWidth && currentLineArray.length > 1) {
                        currentLineArray.pop();
                        lines.push(currentLineArray.join(' '));
                        currentLineArray = [word];
                    }
                 }
                 if (currentLineArray.length > 0) lines.push(currentLineArray.join(' '));
                 tempValueLabelForSizing.remove();
            }

            const lineHeight = valueLabelFontSize * 1.2;
            const totalHeight = lineHeight * lines.length;
            const firstLineY = valueLabelY - (totalHeight - lineHeight); // Adjust so last line is near original Y

            lines.forEach((lineText, i) => {
                valueLabelElement.append("tspan")
                    .attr("x", xCenter)
                    .attr("dy", i === 0 ? (firstLineY - valueLabelY) : `${lineHeight}px`) // dy relative to previous or absolute for first
                    .text(lineText);
            });
        } else {
            valueLabelElement.text(formattedValueText);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this refactor beyond core rendering.

    // Block 10: Cleanup & SVG Node Return
    // Temporary elements for text measurement are handled within their respective functions or removed immediately.
    return svgRoot.node();
}