/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart With Circle",
    "chart_name": "horizontal_bar_chart_test",
    "is_composite": true,
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [
        ["categorical"],
        ["numerical"],
        ["numerical"]
    ],
    "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary","secondary"],
    "supported_effects": ["gradient", "stroke", "radius_corner"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // Block 1: Configuration & Data Extraction
    // ---------------------------------------------------------------------
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = {
        title: { font_family: "Arial", font_size: "28px", font_weight: 700, ...((jsonData.typography || {}).title || {}) },
        label: { font_family: "Arial", font_size: "16px", font_weight: 500, ...((jsonData.typography || {}).label || {}) },
        description: { font_family: "Arial", font_size: "16px", font_weight: 500, ...((jsonData.typography || {}).description || {}) },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: 400, ...((jsonData.typography || {}).annotation || {}) }
    };
    const colors = {
        text_color: "#FFFFFF",
        background_color: "#0A3B39",
        other: { primary: "#83C341", secondary: "#83C341", ...(jsonData.colors || {}).other },
        ...(jsonData.colors || {})
    };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];

    // Removed default fallback strings for field names and column titles
    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField1 = dataColumns.find(col => col.role === "y")?.name;
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name;

    let valueUnit1 = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y")?.unit || "");
    let valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y2")?.unit || "");

    const columnTitle1 = dataColumns.find(col => col.role === "y")?.name;
    const columnTitle2 = dataColumns.find(col => col.role === "y2")?.name;

    // Early exit or error if critical fields are not defined (optional, but good practice)
    if (!dimensionField || !valueField1 || !valueField2) {
        console.error("Critical data fields (dimensionField, valueField1, or valueField2) are not defined in dataColumns. Cannot render chart.");
        d3.select(containerSelector).html("<p style='color:red;'>Error: Chart configuration incomplete. Required data fields missing.</p>");
        return null; // Or throw new Error(...)
    }


    // Block 2: SVG Container Setup
    // ---------------------------------------------------------------------
    d3.select(containerSelector).html("");
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", variables.height || 600)
        .attr("viewBox", `0 0 ${variables.width || 800} ${variables.height || 600}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 3: Global Utilities & Helper Functions
    // ---------------------------------------------------------------------
    const tempTextMeasureGroup = svg.append("g").attr("visibility", "hidden").attr("id", "tempTextMeasureGroup");

    const estimateTextWidth = (text, fontConfig, dynamicFontSize = null) => {
        tempTextMeasureGroup.selectAll("text").remove();
        const textNode = tempTextMeasureGroup.append("text")
            .style("font-family", fontConfig.font_family)
            .style("font-size", dynamicFontSize || fontConfig.font_size)
            .style("font-weight", fontConfig.font_weight)
            .text(text);
        return textNode.node().getBBox().width;
    };

    function getWrappedTextLines(textContent, availableWidth, fontConfig) {
        const words = (textContent || "").trim().split(/\s+/).filter(w => w !== ""); // Handles undefined textContent gracefully
        const lines = [];
        const fontSizeValue = parseFloat(fontConfig.font_size);
        const lineHeight = fontSizeValue * 1.2;

        if (words.length === 0) return { linesArray: [], numLines: 0, lineHeight: lineHeight };

        const breakSingleWord = (word) => {
            let currentWordPart = "";
            const wordLines = [];
            for (let char of word) {
                if (estimateTextWidth(currentWordPart + char, fontConfig) > availableWidth && currentWordPart !== "") {
                    wordLines.push(currentWordPart);
                    currentWordPart = char;
                } else {
                    currentWordPart += char;
                }
            }
            if (currentWordPart !== "") wordLines.push(currentWordPart);
            return wordLines.length > 0 ? wordLines : [word];
        };

        if (words.length === 1) {
            lines.push(...(estimateTextWidth(words[0], fontConfig) > availableWidth ? breakSingleWord(words[0]) : [words[0]]));
            return { linesArray: lines.filter(l => l), numLines: lines.filter(l => l).length, lineHeight: lineHeight };
        }
        
        let currentLine = words[0];
        if (estimateTextWidth(currentLine, fontConfig) > availableWidth) {
            const brokenFirstWord = breakSingleWord(currentLine);
            lines.push(...brokenFirstWord.slice(0, -1));
            currentLine = brokenFirstWord.length > 0 ? brokenFirstWord[brokenFirstWord.length - 1] : "";
        }

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            if (estimateTextWidth(word, fontConfig) > availableWidth) {
                if (currentLine !== "") lines.push(currentLine);
                lines.push(...breakSingleWord(word));
                currentLine = "";
                continue;
            }
            const testLine = currentLine === "" ? word : currentLine + " " + word;
            if (estimateTextWidth(testLine, fontConfig) > availableWidth && currentLine !== "") {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine !== "") {
            lines.push(...(estimateTextWidth(currentLine, fontConfig) > availableWidth ? breakSingleWord(currentLine) : [currentLine]));
        }
        return { linesArray: lines.filter(l => l), numLines: lines.filter(l => l).length, lineHeight: lineHeight };
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    const getPrimaryColor = (variation = "default") => {
        const base = colors.other.primary;
        if (variation === "darker") return d3.rgb(base).darker(0.3).toString();
        if (variation === "brighter") return d3.rgb(base).brighter(0.5).toString();
        if (variation === "stroke") return d3.rgb(base).brighter(3).toString();
        return base;
    };
    const getSecondaryColor = () => colors.other.secondary;

    // Block 4: Core Chart Dimensions & Layout Calculation
    // ---------------------------------------------------------------------
    const width = variables.width || 800;
    const height = variables.height || 600;
    const flagWidth = 30;
    const flagHeight = 30;
    const textPadding = 5;
    const minFontSize = 8;
    const defaultLabelFontSize = parseFloat(typography.label.font_size);

    let maxDimLabelWidth = 0;
    chartData.forEach(d => {
        // Ensure d[dimensionField] is treated as a string for consistent measurement
        maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateTextWidth(String(d[dimensionField] || "").toUpperCase(), typography.label));
    });

    const maxAllowedLabelSpace = width * 0.15;
    let finalDimLabelFontSize = defaultLabelFontSize;
    if (maxDimLabelWidth > maxAllowedLabelSpace) {
        const scaleFactor = maxAllowedLabelSpace / maxDimLabelWidth;
        finalDimLabelFontSize = Math.max(minFontSize, defaultLabelFontSize * scaleFactor);
        maxDimLabelWidth = 0;
        chartData.forEach(d => {
            maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateTextWidth(String(d[dimensionField] || "").toUpperCase(), typography.label, `${finalDimLabelFontSize}px`));
        });
    }
    
    const margin = {
        top: 100,
        right: 5,
        bottom: 40,
        left: maxDimLabelWidth + textPadding + flagWidth + textPadding + 5
    };

    const leftColumnRatio = 0.85;
    const rightColumnRatio = 0.15;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const barChartWidth = innerWidth * leftColumnRatio;
    const circleChartWidth = innerWidth * rightColumnRatio;

    // Block 5: Data Preprocessing
    // ---------------------------------------------------------------------
    const sortedData = [...chartData].sort((a, b) => (b[valueField1] || 0) - (a[valueField1] || 0)); // Added fallback for sorting
    const sortedDimensions = sortedData.map(d => d[dimensionField]);

    // Block 6: Scale Definition
    // ---------------------------------------------------------------------
    const barPadding = 0.2;
    const yScale = d3.scaleBand()
        .domain(sortedDimensions) // If dimensionField was undefined, sortedDimensions might be array of undefineds
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        // Added fallback for max calculation in case valueField1 is missing or data is malformed
        .domain([0, d3.max(sortedData, d => +(d[valueField1] || 0)) * 1.05 || 1]) // Ensure domain is valid
        .range([0, barChartWidth]);

    const maxValue2 = d3.max(sortedData, d => +(d[valueField2] || 0));
    const minRadius = yScale.bandwidth() * 0.3; // yScale.bandwidth() could be 0 if sortedDimensions is empty
    const maxRadius = Math.min(yScale.bandwidth() * 1.0 || 20, circleChartWidth * 0.5 || 20); // Added fallback for bandwidth
    const radiusScale = d3.scaleSqrt()
        .domain([0, maxValue2 || 0])
        .range([minRadius || 5, maxRadius || 20]); // Added fallback for radii

    // Block 7: SVG Definitions (Defs) - Gradients, Filters, Patterns
    // ---------------------------------------------------------------------
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "bar-gradient")
        .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", getPrimaryColor("darker"));
    gradient.append("stop").attr("offset", "100%").attr("stop-color", getPrimaryColor("brighter"));

    // Block 8: Drawing Chart Titles & Headers (Column Titles)
    // ---------------------------------------------------------------------
    // columnTitle1 and columnTitle2 might be undefined. getWrappedTextLines handles this.
    const titleFontConfig = typography.description;
    const titleBottomPadding = 5;
    const desiredBaselineOfLastLine = margin.top - titleBottomPadding;

    const leftTitleAvailableWidth = innerWidth * 0.6;
    const leftTitleXPos = margin.left;
    const wrappedLeftTitle = getWrappedTextLines(columnTitle1, leftTitleAvailableWidth, titleFontConfig);
    if (wrappedLeftTitle.numLines > 0) {
        const initialYLeft = desiredBaselineOfLastLine - (wrappedLeftTitle.numLines - 1) * wrappedLeftTitle.lineHeight;
        const leftTitleText = svg.append("text")
            .attr("x", leftTitleXPos).attr("y", initialYLeft)
            .attr("text-anchor", "start")
            .style("font-family", titleFontConfig.font_family).style("font-size", titleFontConfig.font_size)
            .style("font-weight", titleFontConfig.font_weight).style("fill", colors.text_color);
        wrappedLeftTitle.linesArray.forEach((line, i) => {
            leftTitleText.append("tspan").attr("x", leftTitleXPos).attr("dy", i === 0 ? 0 : wrappedLeftTitle.lineHeight).text(line);
        });
    }

    const rightTitleAvailableWidth = innerWidth * 0.4;
    const rightTitleXPos = margin.left + innerWidth;
    const wrappedRightTitle = getWrappedTextLines(columnTitle2, rightTitleAvailableWidth, titleFontConfig);
    if (wrappedRightTitle.numLines > 0) {
        const initialYRight = desiredBaselineOfLastLine - (wrappedRightTitle.numLines - 1) * wrappedRightTitle.lineHeight;
        const rightTitleText = svg.append("text")
            .attr("x", rightTitleXPos).attr("y", initialYRight)
            .attr("text-anchor", "end")
            .style("font-family", titleFontConfig.font_family).style("font-size", titleFontConfig.font_size)
            .style("font-weight", titleFontConfig.font_weight).style("fill", colors.text_color);
        wrappedRightTitle.linesArray.forEach((line, i) => {
            rightTitleText.append("tspan").attr("x", rightTitleXPos).attr("dy", i === 0 ? 0 : wrappedRightTitle.lineHeight).text(line);
        });
    }

    // Block 9: Main Chart Rendering Loop
    // ---------------------------------------------------------------------
    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

    sortedData.forEach((dataPoint, index) => {
        const dimension = dataPoint[dimensionField]; // Might be undefined if dimensionField was not found
        
        const barHeight = yScale.bandwidth(); // Might be 0 or NaN if domain was empty/problematic
        const y = yScale(dimension); 
        
        // If y is undefined, centerY will be NaN. Operations using it will likely fail silently for SVG.
        const centerY = y + barHeight / 2; 
        const barWidthValue = Math.max(0, xScale(+(dataPoint[valueField1] || 0))); // Added fallback

        // --- Dimension Label & Icon ---
        const dimLabelX = -(flagWidth + textPadding + 5);
        const iconX = -flagWidth - 5;

        g.append("text")
            .attr("x", dimLabelX).attr("y", centerY).attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", typography.label.font_family).style("font-size", `${finalDimLabelFontSize}px`)
            .style("font-weight", typography.label.font_weight).style("fill", colors.text_color)
            .text(String(dimension || "").toUpperCase()); // Handle undefined dimension for text

        const iconGroup = g.append("g").attr("transform", `translate(${iconX}, ${centerY - flagHeight / 2})`);
        // Ensure dimension is a string for image key lookup, or provide a fallback
        const imageKey = String(dimension || `__undefined_key_${index}__`);
        if (images.field && images.field[imageKey]) {
            iconGroup.append("image")
                .attr("x", 0).attr("y", 0).attr("width", flagWidth).attr("height", flagHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", images.field[imageKey]);
        } else {
            iconGroup.append("rect")
                .attr("x", 0).attr("y", 0).attr("width", flagWidth).attr("height", flagHeight)
                .attr("fill", getPrimaryColor("stroke")).attr("opacity", 0.3);
        }

        // --- Bar Element ---
        if (typeof y === 'number' && barHeight > 0) { // Add check to prevent drawing if y or barHeight is invalid
            g.append("rect")
                .attr("x", 0).attr("y", y)
                .attr("width", barWidthValue).attr("height", barHeight)
                .attr("fill", "url(#bar-gradient)")
                .attr("rx", barHeight / 4).attr("ry", barHeight / 4)
                .attr("opacity", 0.9);

            // --- Bar Value Label ---
            const valueLabelText1 = `${formatValue(+(dataPoint[valueField1] || 0))}${valueUnit1}`; // Added fallback
            const dynamicValueLabelFontSize = `${Math.min(20, Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`;
            const currentBarValueLabelWidth = estimateTextWidth(valueLabelText1, typography.annotation, dynamicValueLabelFontSize);
            
            let valueLabel1XPos, valueLabel1Anchor, valueLabel1Fill;
            const internalPadding = 10; const externalPadding = 5;
            if (barWidthValue >= currentBarValueLabelWidth + internalPadding * 2) {
                valueLabel1XPos = internalPadding; valueLabel1Anchor = "start"; valueLabel1Fill = "#FFFFFF";
            } else {
                valueLabel1XPos = barWidthValue + externalPadding; valueLabel1Anchor = "start"; valueLabel1Fill = colors.text_color;
            }
            g.append("text")
                .attr("x", valueLabel1XPos).attr("y", centerY).attr("dy", "0.35em")
                .attr("text-anchor", valueLabel1Anchor)
                .style("font-family", typography.annotation.font_family).style("font-size", dynamicValueLabelFontSize)
                .style("font-weight", typography.annotation.font_weight).style("fill", valueLabel1Fill)
                .text(valueLabelText1);
        }

        // --- Circle Element ---
        const circleRadiusValue = radiusScale(+(dataPoint[valueField2] || 0)); // Added fallback
        if (typeof centerY === 'number' && typeof circleRadiusValue === 'number' && circleRadiusValue >= 0) { // Add check
            g.append("circle")
                .attr("cx", barChartWidth + circleChartWidth / 2).attr("cy", centerY)
                .attr("r", circleRadiusValue)
                .attr("fill", getSecondaryColor())
                .attr("opacity", 0.6);

            // --- Circle Value Label ---
            const valueLabelText2 = `${formatValue(+(dataPoint[valueField2] || 0))}${valueUnit2}`; // Added fallback
            const dynamicCircleLabelFontSize = `${Math.min(20, Math.max(barHeight * 0.6 || 10, parseFloat(typography.annotation.font_size)))}px`; // Fallback for barHeight

            g.append("text")
                .attr("x", barChartWidth + circleChartWidth / 2).attr("y", centerY).attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", typography.annotation.font_family).style("font-size", dynamicCircleLabelFontSize)
                .style("font-weight", typography.annotation.font_weight).style("fill", colors.text_color)
                .text(valueLabelText2);
        }
    });

    // Block 10: Cleanup
    // ---------------------------------------------------------------------
    tempTextMeasureGroup.remove();

    // Block 11: Return SVG Node
    // ---------------------------------------------------------------------
    return svg.node();
}