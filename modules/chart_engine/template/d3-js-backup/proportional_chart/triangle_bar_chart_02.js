/* REQUIREMENTS_BEGIN
{
  "chart_type": "Triangle Bar Chart",
  "chart_name": "triangle_bar_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 8], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or logic to pick dark theme if needed
    // const images = data.images || {}; // Not used in this chart
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const yFieldUnitDef = dataColumns.find(col => col.role === "y");
    const yUnitString = (yFieldUnitDef?.unit === "none" || !yFieldUnitDef?.unit) ? "" : String(yFieldUnitDef.unit);

    if (!xField || !yField) {
        console.error("Critical chart config missing: xField or yField name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Critical chart configuration missing (x or y field). Cannot render.</div>");
        return null;
    }

    const chartDataArray = chartDataInput.filter(d => d[yField] !== null && d[yField] !== undefined && !isNaN(parseFloat(d[yField])) && +d[yField] > 0);
    if (!chartDataArray.length) {
        d3.select(containerSelector).html("<div style='text-align:center; padding: 20px;'>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        // images: {} // Not used
    };

    // Typography tokens
    const defaultFontFamily = "Arial, sans-serif";
    fillStyle.typography.valueFontFamily = typography.annotation?.font_family || defaultFontFamily;
    fillStyle.typography.valueFontSize = typography.annotation?.font_size || "10px";
    fillStyle.typography.valueFontWeight = typography.annotation?.font_weight || "normal";

    fillStyle.typography.categoryFontFamily = typography.label?.font_family || defaultFontFamily;
    fillStyle.typography.categoryFontSize = typography.label?.font_size || "12px";
    fillStyle.typography.categoryFontWeight = typography.label?.font_weight || "normal";

    // Color tokens
    fillStyle.chartBackground = colors.background_color || "#FFFFFF";
    fillStyle.textColor = colors.text_color || "#212529";
    fillStyle.axisLineColor = colors.other?.axis_line || "#CCCCCC";
    fillStyle.valueLabelBackgroundColor = colors.other?.value_label_background || "#FFFFFF";
    fillStyle.defaultBarColor = colors.other?.primary || "#1f77b4";
    
    fillStyle.getBarColor = (itemData) => {
        const categoryValue = itemData[xField]; // xField is guaranteed to exist here
        if (colors.field && colors.field[categoryValue]) {
            return colors.field[categoryValue];
        }
        return fillStyle.defaultBarColor;
    };
    
    // In-memory text measurement utility
    const _measureTextCanvasContext = (document.createElement('canvas')).getContext('2d');
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvgForMeasurement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textElement.setAttribute("font-family", fontFamily);
        textElement.setAttribute("font-size", fontSize);
        textElement.setAttribute("font-weight", fontWeight);
        textElement.textContent = text;
        tempSvgForMeasurement.appendChild(textElement); // Appended to an in-memory, unattached SVG
        
        try {
            const width = textElement.getBBox().width;
            // Firefox (and potentially others) might return 0 for getBBox on non-rendered SVG.
            if (width === 0 && String(text).length > 0) { 
                 _measureTextCanvasContext.font = `${fontWeight || 'normal'} ${fontSize} ${fontFamily || 'Arial'}`;
                 return _measureTextCanvasContext.measureText(text).width;
            }
            return width;
        } catch (e) {
            // Fallback if getBBox fails (e.g., IE or specific conditions)
            console.warn("getBBox on in-memory SVG failed, using canvas fallback for text measurement.", e);
            _measureTextCanvasContext.font = `${fontWeight || 'normal'} ${fontSize} ${fontFamily || 'Arial'}`;
            return _measureTextCanvasContext.measureText(text).width;
        }
    }
    
    function splitTextIntoLines(textToSplit, fontFamily, fontSize, fontWeight, maxWidth) {
        const text = String(textToSplit); // Ensure text is a string
        if (!text) return [""];
        
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = "";

        if (words.length <= 2 && text.length > 5) { // Heuristic for CJK or single long words
            const chars = text.split('');
            currentLine = chars[0] || "";
            for (let i = 1; i < chars.length; i++) {
                const testLine = currentLine + chars[i];
                if (estimateTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = chars[i] || "";
                }
            }
            if (currentLine) lines.push(currentLine);
        } else { // Word-based splitting
            currentLine = words[0] || "";
            for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + " " + words[i];
                if (estimateTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = words[i] || "";
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
    const containerHeight = variables.height || 400;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 20, bottom: 80, left: 20 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const barWidth = 100; 
    const triangleMaxHeight = innerHeight * 0.9;

    let padding;
    if (chartDataArray.length <= 4) padding = 20;
    else if (chartDataArray.length <= 6) padding = -10;
    else padding = -30;

    const estimatedTotalContentWidth = chartDataArray.length * barWidth + (chartDataArray.length > 1 ? (chartDataArray.length - 1) * padding : 0);
    if (estimatedTotalContentWidth > innerWidth && chartDataArray.length > 1) {
        padding = Math.max(-barWidth * 0.75, (innerWidth - chartDataArray.length * barWidth) / (chartDataArray.length - 1));
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const maxValue = d3.max(chartDataArray, d => +d[yField]);

    // Block 6: Scale Definition & Configuration
    const heightScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue : 1]) // Ensure domain doesn't become [0,0]
        .range([0, triangleMaxHeight]);

    const nodes = chartDataArray.map((d, i) => {
        const id = d[xField] != null ? String(d[xField]) : `__generated_${i}__`;
        const value = +d[yField];
        return {
            id: id,
            value: value,
            scaledHeight: heightScale(value),
            barWidth: barWidth,
            color: fillStyle.getBarColor(d),
            rawData: d,
        };
    });

    const totalCalculatedWidth = nodes.length * barWidth + (nodes.length > 1 ? (nodes.length - 1) * padding : 0);
    let startX = (innerWidth - totalCalculatedWidth) / 2;
    if (startX < 0) startX = 0; 

    nodes.forEach((node, i) => {
        node.xPosition = startX + i * (barWidth + padding) + barWidth / 2;
    });
    
    // Block 7: Chart Component Rendering
    mainChartGroup.append("line")
        .attr("class", "axis baseline")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // Block 8: Main Data Visualization Rendering
    const parsedValueFontSize = parseFloat(fillStyle.typography.valueFontSize);
    const parsedCategoryFontSize = parseFloat(fillStyle.typography.categoryFontSize);

    const checkLabelOverlap = () => {
        if (nodes.length <= 1) return false;
        const estimatedLabelWidths = nodes.map(node => {
            const catText = node.id.startsWith("__generated_") ? "" : node.id;
            if (!catText) return 0;
            return estimateTextWidth(catText, fillStyle.typography.categoryFontFamily, fillStyle.typography.categoryFontSize, fillStyle.typography.categoryFontWeight);
        });
        const barSpacing = barWidth + padding;
        return estimatedLabelWidths.some(width => width > barSpacing * 0.85); // Adjusted threshold
    };
    const shouldWrapLabels = (nodes.length > 1 && padding < 0 && nodes.some(n => n.id.includes(" "))) || checkLabelOverlap();

    nodes.forEach(node => {
        const triangleGroup = mainChartGroup.append("g")
            .attr("class", "mark triangle-item")
            .attr("transform", `translate(${node.xPosition}, ${innerHeight})`);

        const halfBarWidth = node.barWidth / 2;
        const trianglePathData = createTrianglePath(
            [0, -node.scaledHeight],
            [-halfBarWidth, 0],
            [halfBarWidth, 0]
        );

        triangleGroup.append("path")
            .attr("class", "mark triangle-path")
            .attr("d", trianglePathData)
            .attr("fill", node.color)
            .attr("fill-opacity", 0.75);

        const valueLabelText = `${node.value}${yUnitString}`;
        const valueLabelTextWidth = estimateTextWidth(valueLabelText, fillStyle.typography.valueFontFamily, fillStyle.typography.valueFontSize, fillStyle.typography.valueFontWeight);
        
        triangleGroup.append("rect")
            .attr("class", "other value-label-background")
            .attr("x", -valueLabelTextWidth / 2 - 4)
            .attr("y", -node.scaledHeight - 10 - parsedValueFontSize)
            .attr("width", valueLabelTextWidth + 8)
            .attr("height", parsedValueFontSize + 4)
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("fill", fillStyle.valueLabelBackgroundColor);

        triangleGroup.append("text")
            .attr("class", "label value-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "text-after-edge")
            .attr("x", 0)
            .attr("y", -node.scaledHeight - 10)
            .style("font-family", fillStyle.typography.valueFontFamily)
            .style("font-size", fillStyle.typography.valueFontSize)
            .style("font-weight", fillStyle.typography.valueFontWeight)
            .style("fill", node.color)
            .text(valueLabelText);

        const categoryLabelText = node.id.startsWith("__generated_") ? "" : node.id;
        if (categoryLabelText) {
            const categoryLabelTextWidth = estimateTextWidth(categoryLabelText, fillStyle.typography.categoryFontFamily, fillStyle.typography.categoryFontSize, fillStyle.typography.categoryFontWeight);
            const maxLabelWidthBeforeAction = node.barWidth * 1.1; 
            const effectiveMaxLabelWidth = shouldWrapLabels ? Math.min(maxLabelWidthBeforeAction, node.barWidth * 0.9) : maxLabelWidthBeforeAction;

            if ((shouldWrapLabels && categoryLabelText.includes(" ")) || (categoryLabelTextWidth > effectiveMaxLabelWidth && categoryLabelText.includes(" "))) {
                const lines = splitTextIntoLines(categoryLabelText, fillStyle.typography.categoryFontFamily, fillStyle.typography.categoryFontSize, fillStyle.typography.categoryFontWeight, effectiveMaxLabelWidth);
                const lineHeight = parsedCategoryFontSize * 1.2;
                lines.forEach((line, i) => {
                    triangleGroup.append("text")
                        .attr("class", "label category-label category-label-line")
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "hanging")
                        .attr("x", 0)
                        .attr("y", 15 + i * lineHeight)
                        .style("font-family", fillStyle.typography.categoryFontFamily)
                        .style("font-size", fillStyle.typography.categoryFontSize)
                        .style("font-weight", fillStyle.typography.categoryFontWeight)
                        .style("fill", fillStyle.textColor)
                        .text(line);
                });
            } else if (categoryLabelTextWidth > node.barWidth * 0.9 && nodes.length > 3 && padding < 10) { 
                triangleGroup.append("text")
                    .attr("class", "label category-label rotated")
                    .attr("text-anchor", "end")
                    .attr("dominant-baseline", "middle")
                    .attr("x", -5) 
                    .attr("y", 15 + parsedCategoryFontSize / 2)
                    .attr("transform", `rotate(-45, 0, ${15 + parsedCategoryFontSize / 2})`)
                    .style("font-family", fillStyle.typography.categoryFontFamily)
                    .style("font-size", fillStyle.typography.categoryFontSize)
                    .style("font-weight", fillStyle.typography.categoryFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(categoryLabelText);
            } else { 
                triangleGroup.append("text")
                    .attr("class", "label category-label")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .attr("x", 0)
                    .attr("y", 15)
                    .style("font-family", fillStyle.typography.categoryFontFamily)
                    .style("font-size", fillStyle.typography.categoryFontSize)
                    .style("font-weight", fillStyle.typography.categoryFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(categoryLabelText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements in this refactoring pass.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}