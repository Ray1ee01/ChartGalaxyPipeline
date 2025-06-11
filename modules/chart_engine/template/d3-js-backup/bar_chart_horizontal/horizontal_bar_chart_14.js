/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart With Proportional Circles",
  "chart_name": "horizontal_bar_chart_14",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
  "required_fields_icons": [],
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
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal bar chart combined with proportional circles.
    // Each category has a bar representing one value and a circle representing another.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || {}; // Assuming data.colors is prioritized or data.colors_dark is resolved into data.colors by caller
    const inputImages = data.images || {}; // Parsed but not used as per requirements
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueField1Def = dataColumns.find(col => col.role === "y");
    const valueField2Def = dataColumns.find(col => col.role === "y2");

    const dimensionFieldName = dimensionFieldDef?.name;
    const valueField1Name = valueField1Def?.name;
    const valueField2Name = valueField2Def?.name;

    let criticalFieldsMissing = [];
    if (!dimensionFieldName) criticalFieldsMissing.push("dimension field (role: x)");
    if (!valueField1Name) criticalFieldsMissing.push("value field (role: y)");
    if (!valueField2Name) criticalFieldsMissing.push("value field (role: y2)");

    if (criticalFieldsMissing.length > 0) {
        const errorMsg = `Critical chart config missing: ${criticalFieldsMissing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("font-family", "sans-serif")
                .html(`Error: Critical chart configuration missing: ${criticalFieldsMissing.join(', ')}.`);
        }
        return null;
    }

    const value1Unit = (valueField1Def?.unit === "none" || !valueField1Def?.unit) ? "" : valueField1Def.unit;
    const value2Unit = (valueField2Def?.unit === "none" || !valueField2Def?.unit) ? "" : valueField2Def.unit;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            label: {
                font_family: inputTypography.label?.font_family || "Arial, sans-serif",
                font_size: inputTypography.label?.font_size || "12px",
                font_weight: inputTypography.label?.font_weight || "normal"
            },
            // title and annotation not used directly by this chart's core elements after refactoring
        },
        textColor: inputColors.text_color || "#000000",
        chartBackground: inputColors.background_color || "#FFFFFF",
        primaryColor: inputColors.other?.primary || "#4682B4", // Default: SteelBlue
        defaultCategoryColors: [...(inputColors.available_colors || d3.schemeCategory10)],
        categoryColorProvider: (category) => {
            if (inputColors.field && inputColors.field[category]) {
                return inputColors.field[category];
            }
            const categoryIndex = rawChartData.findIndex(d => d[dimensionFieldName] === category);
            return fillStyle.defaultCategoryColors[Math.abs(categoryIndex) % fillStyle.defaultCategoryColors.length] || fillStyle.primaryColor;
        },
        connectorLineColor: inputColors.other?.secondary || "#A9A9A9" // Default: DarkGray
    };
    
    // In-memory text measurement will use a hidden group within the main SVG.
    // Declaration of textMeasureGroup is in Block 3.
    // estimateTextWidth and getWrappedLines are defined before first use in Block 8 or here.

    function estimateTextWidthInternal(text, fontStyleObj, textMeasureG) {
        if (!text || text.length === 0 || !textMeasureG) return 0;
        const tempText = textMeasureG.append("text")
            .attr("font-family", fontStyleObj.font_family)
            .attr("font-size", fontStyleObj.font_size)
            .attr("font-weight", fontStyleObj.font_weight)
            .text(text);
        const width = tempText.node().getBBox().width;
        tempText.remove();
        return width;
    }
    
    function getWrappedLinesInternal(text, maxWidth, fontStyleObj, textMeasureG, estimateWidthFunc) {
        const words = String(text).split(/\s+/).filter(w => w.length > 0);
        const lines = [];
        if (words.length === 0) return [""];
    
        const wrapSingleWord = (singleWord) => {
            const wordLines = [];
            let currentWordPart = "";
            for (const char of singleWord) {
                if (estimateWidthFunc(currentWordPart + char, fontStyleObj, textMeasureG) > maxWidth && currentWordPart !== "") {
                    wordLines.push(currentWordPart);
                    currentWordPart = char;
                } else {
                    currentWordPart += char;
                }
            }
            if (currentWordPart !== "") wordLines.push(currentWordPart);
            return wordLines.length > 0 ? wordLines : [singleWord];
        };
    
        if (words.length === 1) {
            return estimateWidthFunc(words[0], fontStyleObj, textMeasureG) > maxWidth ? wrapSingleWord(words[0]) : [words[0]];
        }
    
        let currentLine = words[0];
        if (estimateWidthFunc(currentLine, fontStyleObj, textMeasureG) > maxWidth) {
            const wrappedFirst = wrapSingleWord(currentLine);
            lines.push(...wrappedFirst.slice(0, -1));
            currentLine = wrappedFirst.length > 0 ? wrappedFirst[wrappedFirst.length -1] : "";
        }
    
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            if (estimateWidthFunc(word, fontStyleObj, textMeasureG) > maxWidth) {
                if (currentLine !== "") lines.push(currentLine);
                lines.push(...wrapSingleWord(word));
                currentLine = "";
                continue;
            }
            const testLine = currentLine === "" ? word : `${currentLine} ${word}`;
            if (estimateWidthFunc(testLine, fontStyleObj, textMeasureG) > maxWidth && currentLine !== "") {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine !== "") {
             if (estimateWidthFunc(currentLine, fontStyleObj, textMeasureG) > maxWidth && !currentLine.includes(" ")) {
                 lines.push(...wrapSingleWord(currentLine));
             } else if (estimateWidthFunc(currentLine, fontStyleObj, textMeasureG) > maxWidth) { // Multi-word but still too long
                 const subLines = getWrappedLinesInternal(currentLine, maxWidth, fontStyleObj, textMeasureG, estimateWidthFunc);
                 lines.push(...subLines);
             } else {
                lines.push(currentLine);
             }
        }
        return lines.filter(l => l !== "");
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return `${d3.format("~.2s")(value / 1000000000)}B`;
        if (value >= 1000000) return `${d3.format("~.2s")(value / 1000000)}M`;
        if (value >= 1000) return `${d3.format("~.2s")(value / 1000)}K`;
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    const textMeasureGroup = svgRoot.append("g").attr("class", "text-measure-util").style("visibility", "hidden").style("opacity",0).attr("pointer-events", "none");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Simplified margins
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const leftColumnRatio = 0.80; // Bar chart part
    const rightColumnRatio = 0.20; // Circle chart part

    const barChartWidth = innerWidth * leftColumnRatio;
    const circleChartWidth = innerWidth * rightColumnRatio;
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [valueField1Name]: +d[valueField1Name],
        [valueField2Name]: +d[valueField2Name]
    })).sort((a, b) => b[valueField1Name] - a[valueField1Name]);

    const sortedDimensions = chartDataArray.map(d => d[dimensionFieldName]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2;
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    const maxVal1 = d3.max(chartDataArray, d => d[valueField1Name]);
    const xScale = d3.scaleLinear()
        .domain([0, maxVal1 > 0 ? maxVal1 * 1.05 : 1]) // Add 5% padding, ensure domain > 0
        .range([0, barChartWidth]);

    const maxVal2 = d3.max(chartDataArray, d => d[valueField2Name]);
    const minRadius = Math.max(2, yScale.bandwidth() * 0.05);
    const maxRadius = Math.min(yScale.bandwidth() * 0.45, circleChartWidth * 0.40);
    
    const radiusScale = d3.scaleSqrt()
        .domain([0, maxVal2 > 0 ? maxVal2 : 1]) // Ensure domain > 0
        .range([minRadius, maxRadius]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend as per original design and refactoring constraints.
    // Column titles removed as per V.1.

    // Block 8: Main Data Visualization Rendering
    chartDataArray.forEach(d => {
        const category = d[dimensionFieldName];
        const value1 = d[valueField1Name];
        const value2 = d[valueField2Name];

        const yPos = yScale(category);
        if (typeof yPos === 'undefined') {
            console.warn(`Category ${category} not found in yScale domain.`);
            return;
        }
        const barHeight = yScale.bandwidth();
        const centerY = yPos + barHeight / 2;

        const barColor = fillStyle.categoryColorProvider(category);

        // 1. Render Bars
        const currentBarWidth = xScale(value1 > 0 ? value1 : 0);
        mainChartGroup.append("rect")
            .attr("class", "mark bar")
            .attr("x", 0)
            .attr("y", yPos)
            .attr("width", Math.max(0, currentBarWidth))
            .attr("height", barHeight)
            .attr("fill", barColor);

        // 2. Render Circles
        const circleRadius = radiusScale(value2 > 0 ? value2 : 0);
        const circleX = barChartWidth + (circleChartWidth / 2);
        mainChartGroup.append("circle")
            .attr("class", "mark circle")
            .attr("cx", circleX)
            .attr("cy", centerY)
            .attr("r", Math.max(0, circleRadius))
            .attr("fill", barColor);

        // 3. Labels
        const labelPadding = 5;
        const labelPaddingInside = 8;
        const baseLabelStyle = fillStyle.typography.label;

        // Dimension Label (Category)
        const dimTextOriginal = String(d[dimensionFieldName]);
        const dimTextForDisplay = dimTextOriginal.toUpperCase();
        const maxAllowedDimLabelWidth = barChartWidth * 0.4; // Max width for dimension label
        
        let finalDimFontSize = parseFloat(baseLabelStyle.font_size);
        let currentDimLabelStyle = { ...baseLabelStyle, font_size: `${finalDimFontSize}px` };
        let currentDimLabelWidth = estimateTextWidthInternal(dimTextForDisplay, currentDimLabelStyle, textMeasureGroup);

        // Reduce font size if too wide
        while (currentDimLabelWidth > maxAllowedDimLabelWidth && finalDimFontSize > 8) {
            finalDimFontSize -= 1;
            currentDimLabelStyle.font_size = `${finalDimFontSize}px`;
            currentDimLabelWidth = estimateTextWidthInternal(dimTextForDisplay, currentDimLabelStyle, textMeasureGroup);
        }
        
        let dimLabelLines = [dimTextForDisplay];
        if (currentDimLabelWidth > maxAllowedDimLabelWidth) { // Still too wide, wrap
            dimLabelLines = getWrappedLinesInternal(dimTextForDisplay, maxAllowedDimLabelWidth, currentDimLabelStyle, textMeasureGroup, estimateTextWidthInternal);
        }
        // Recalculate effective width based on the longest wrapped line
        let dimLabelEffectiveWidth = 0;
        dimLabelLines.forEach(line => {
            dimLabelEffectiveWidth = Math.max(dimLabelEffectiveWidth, estimateTextWidthInternal(line, currentDimLabelStyle, textMeasureGroup));
        });


        let dimLabelX, dimLabelColor, dimLabelAnchor;
        let dimLabelEndPosX;

        if (dimLabelLines.length === 1 && currentBarWidth >= labelPaddingInside + dimLabelEffectiveWidth + labelPaddingInside) {
            dimLabelX = labelPaddingInside;
            dimLabelColor = d3.hsl(barColor).l > 0.5 ? "#000000" : "#FFFFFF"; // Contrast
            dimLabelAnchor = "start";
            dimLabelEndPosX = dimLabelX + dimLabelEffectiveWidth;
        } else {
            dimLabelX = currentBarWidth + labelPadding;
            dimLabelColor = fillStyle.textColor;
            dimLabelAnchor = "start";
            dimLabelEndPosX = dimLabelX + dimLabelEffectiveWidth;
        }
        
        const dimLabelLineHeight = finalDimFontSize * 1.2;
        const totalDimLabelHeight = dimLabelLines.length * dimLabelLineHeight;
        const firstDimLineY = centerY - (totalDimLabelHeight / 2) + (dimLabelLineHeight / 2) - ((dimLabelLines.length -1) * dimLabelLineHeight / 2) ;


        const dimTextElement = mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("text-anchor", dimLabelAnchor)
            .style("font-family", currentDimLabelStyle.font_family)
            .style("font-size", currentDimLabelStyle.font_size)
            .style("font-weight", currentDimLabelStyle.font_weight)
            .style("fill", dimLabelColor);

        dimLabelLines.forEach((line, i) => {
            dimTextElement.append("tspan")
                .attr("x", dimLabelX)
                .attr("y", firstDimLineY + (i * dimLabelLineHeight))
                .text(line);
        });


        // Value 1 Label (Bar Value)
        const value1Text = `${formatValue(value1)}${value1Unit}`;
        const value1LabelStyle = baseLabelStyle;
        const value1LabelWidth = estimateTextWidthInternal(value1Text, value1LabelStyle, textMeasureGroup);
        let value1LabelX, value1LabelColor, value1LabelAnchor;
        let value1LabelEndPos;

        const isDimLabelInsideBar = (dimLabelX === labelPaddingInside);

        if (isDimLabelInsideBar) {
            if (currentBarWidth >= dimLabelEndPosX + labelPadding + value1LabelWidth + labelPaddingInside) {
                value1LabelX = currentBarWidth - labelPaddingInside;
                value1LabelColor = d3.hsl(barColor).l > 0.5 ? "#000000" : "#FFFFFF";
                value1LabelAnchor = "end";
            } else {
                value1LabelX = currentBarWidth + labelPadding;
                value1LabelColor = fillStyle.textColor;
                value1LabelAnchor = "start";
            }
        } else {
            value1LabelX = dimLabelEndPosX + labelPadding;
            value1LabelColor = fillStyle.textColor;
            value1LabelAnchor = "start";
        }
        value1LabelEndPos = (value1LabelAnchor === "start") ? value1LabelX + value1LabelWidth : value1LabelX;
        
        mainChartGroup.append("text")
            .attr("class", "label value-label value1-label")
            .attr("x", value1LabelX)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", value1LabelAnchor)
            .style("font-family", value1LabelStyle.font_family)
            .style("font-size", value1LabelStyle.font_size)
            .style("font-weight", value1LabelStyle.font_weight)
            .style("fill", value1LabelColor)
            .text(value1Text);

        // Value 2 Label (Circle Value)
        const value2Text = `${formatValue(value2)}${value2Unit}`;
        const value2LabelStyle = baseLabelStyle;
        const value2LabelWidth = estimateTextWidthInternal(value2Text, value2LabelStyle, textMeasureGroup);
        let value2LabelX, value2LabelY, value2LabelColor, value2LabelAnchor, value2LabelDy;

        if (circleRadius * 2 > value2LabelWidth + labelPadding * 2) { // Fits inside circle
            value2LabelX = circleX;
            value2LabelY = centerY;
            value2LabelColor = d3.hsl(barColor).l > 0.5 ? "#000000" : "#FFFFFF";
            value2LabelAnchor = "middle";
            value2LabelDy = "0.35em";
        } else { // Outside circle
            value2LabelX = circleX;
            value2LabelY = centerY - circleRadius - labelPadding; // Above
            value2LabelColor = fillStyle.textColor; // Use standard text color when outside
            value2LabelAnchor = "middle";
            value2LabelDy = "0em"; // Baseline alignment for text above
            // Check if too high (e.g., overlaps with element from row above or chart top)
            // This check is simplified; a more robust check would consider previous element's bottom.
            if (value2LabelY - parseFloat(value2LabelStyle.font_size) < yPos - barHeight*0.8 ) { 
                 value2LabelY = centerY + circleRadius + labelPadding + parseFloat(value2LabelStyle.font_size); // Below
                 value2LabelDy = "0.71em"; // Adjust baseline for text below
            }
        }

        mainChartGroup.append("text")
            .attr("class", "label value-label value2-label")
            .attr("x", value2LabelX)
            .attr("y", value2LabelY)
            .attr("dy", value2LabelDy)
            .attr("text-anchor", value2LabelAnchor)
            .style("font-family", value2LabelStyle.font_family)
            .style("font-size", value2LabelStyle.font_size)
            .style("font-weight", value2LabelStyle.font_weight)
            .style("fill", value2LabelColor)
            .text(value2Text);

        // 4. Connector Line
        const lineStartX = value1LabelEndPos + labelPadding;
        const lineEndX = circleX - circleRadius - labelPadding; // Small gap before circle

        if (lineStartX < lineEndX - 1) { // Only draw if there's space and line is meaningful
            mainChartGroup.append("line")
                .attr("class", "mark connector-line")
                .attr("x1", lineStartX)
                .attr("y1", centerY)
                .attr("x2", lineEndX)
                .attr("y2", centerY)
                .attr("stroke", fillStyle.connectorLineColor)
                .attr("stroke-width", 1);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No further enhancements in this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}