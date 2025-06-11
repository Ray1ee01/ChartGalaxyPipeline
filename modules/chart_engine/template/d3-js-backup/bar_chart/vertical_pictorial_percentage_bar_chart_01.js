/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pictorial Value Bar Chart",
  "chart_name": "vertical_pictorial_value_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["none"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 10], [0, "inf"]],
  "required_fields_icons": ["x"],
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
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a vertical pictorial bar chart where bars are represented by images (bottles),
    // and their fill level corresponds to data values. Icons and labels are displayed below each bottle.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const rawTypography = data.typography || {};
    const typography = {
        title: rawTypography.title || { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: rawTypography.label || { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: rawTypography.annotation || { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const rawColors = data.colors || {};
    const colors = {
        field: rawColors.field || {},
        other: rawColors.other || { primary: "#4CAF50", secondary: "#FF7F50" }, // Default primary for bottle if needed
        available_colors: rawColors.available_colors || d3.schemeCategory10,
        background_color: rawColors.background_color || "#FFFFFF",
        text_color: rawColors.text_color || "#000000"
    };

    const rawImages = data.images || {};
    const images = {
        field: rawImages.field || {},
        other: rawImages.other || {}
    };

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xColumn ? xColumn.name : undefined;
    const valueFieldName = yColumn ? yColumn.name : undefined;

    if (!categoryFieldName || !valueFieldName) {
        const errorMessage = `Critical chart config missing: ${!categoryFieldName ? "x-axis field " : ""}${!valueFieldName ? "y-axis field" : ""}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMessage}</div>`);
        return null;
    }

    const dimensionUnit = xColumn && xColumn.unit !== "none" ? xColumn.unit : ""; // Unused in this chart
    const valueUnit = yColumn && yColumn.unit !== "none" ? yColumn.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colors.text_color,
        bottleImageBackgroundColorOpacity: 0.15,
        valueLabelBackgroundColor: "#f5f5f5",
        valueLabelTextColor: "#333333", // Darker text for value labels
        categoryImages: images.field,
        // Typography tokens
        typography: {
            categoryLabelFontFamily: typography.label.font_family,
            categoryLabelFontSize: typography.label.font_size, // Base size, will be adjusted
            categoryLabelFontWeight: typography.label.font_weight,
            valueLabelFontFamily: typography.label.font_family, // Using label style for values
            valueLabelBaseFontSize: typography.label.font_size, // Base size, will be adjusted
            valueLabelFontWeight: "bold", // Values are often bold
        }
    };

    const BOTTLE_SVG_STRING = `<svg viewBox="0 0 200 500" xmlns="http://www.w3.org/2000/svg"><path d="M60,280 L60,450 Q100,480 140,450 L140,280 Z" fill="#8BC34A"/><path d="M60,230 L60,280 L140,280 L140,230 Z" fill="#FDD835"/><circle cx="100" cy="255" r="25" fill="#FDD835"/><path d="M75,50 Q100,40 125,50 L125,70 Q100,80 75,70 Z" fill="#555555"/><path d="M80,70 L60,230 L140,230 L120,70 Z" fill="#555555"/><path d="M80,70 Q100,60 120,70 L120,70 Q100,80 80,70 Z" fill="#555555"/></svg>`;

    function svgToBase64(svgString) {
        const cleanSvg = svgString.replace(/\s+/g, ' ').trim();
        const encoded = encodeURIComponent(cleanSvg);
        return 'data:image/svg+xml;base64,' + btoa(unescape(encoded));
    }
    fillStyle.bottleImageBase64 = svgToBase64(BOTTLE_SVG_STRING);

    const svgViewBoxMatch = BOTTLE_SVG_STRING.match(/viewBox="([^"]+)"/);
    const svgViewBox = svgViewBoxMatch ? svgViewBoxMatch[1].split(' ').map(Number) : [0, 0, 200, 500];
    const bottleImageSvgWidth = svgViewBox[2];
    const bottleImageSvgHeight = svgViewBox[3];
    const bottleImageAspectRatio = bottleImageSvgHeight / bottleImageSvgWidth;

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    // Helper for text wrapping (adapted from original)
    function wrapText(d3TextSelection, textString, maxWidth, lineHeight = 1.1, verticalAlignment = 'middle') {
        const words = String(textString).split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const initialY = parseFloat(d3TextSelection.attr("y")) || 0;
        const initialX = parseFloat(d3TextSelection.attr("x")) || 0;
        
        d3TextSelection.text(null);
        let tspansContent = [];

        if (words.length > 1 && words.join("").length > 0) { // Check if there are actual words
            let currentLineWords = [];
            while (word = words.pop()) {
                currentLineWords.push(word);
                const tempTspan = d3TextSelection.append("tspan").text(currentLineWords.join(" "));
                if (tempTspan.node().getComputedTextLength() > maxWidth && currentLineWords.length > 1) {
                    currentLineWords.pop();
                    tspansContent.push(currentLineWords.join(" "));
                    currentLineWords = [word];
                }
                tempTspan.remove();
            }
            if (currentLineWords.length > 0) {
                tspansContent.push(currentLineWords.join(" "));
            }
        } else { // Single word or empty string, try character wrapping for long single words
            const chars = String(textString).split('');
            let currentLineChars = '';
            if (chars.length > 0) {
                 for (let i = 0; i < chars.length; i++) {
                    const nextLine = currentLineChars + chars[i];
                    const tempTspan = d3TextSelection.append("tspan").text(nextLine);
                    if (tempTspan.node().getComputedTextLength() > maxWidth && currentLineChars.length > 0) {
                        tspansContent.push(currentLineChars);
                        currentLineChars = chars[i];
                    } else {
                        currentLineChars = nextLine;
                    }
                    tempTspan.remove();
                }
                if (currentLineChars.length > 0) {
                    tspansContent.push(currentLineChars);
                }
            } else {
                 tspansContent.push(""); // Handle empty string
            }
        }
        
        const totalLines = tspansContent.length;
        let startDy = 0;
        if (verticalAlignment === 'middle') {
            startDy = -((totalLines - 1) * lineHeight / 2);
        } else if (verticalAlignment === 'bottom') {
            startDy = -(totalLines - 1) * lineHeight;
        } // 'top' alignment has startDy = 0

        tspansContent.forEach((lineText, i) => {
            d3TextSelection.append("tspan")
                .attr("x", initialX)
                .attr("dy", (i === 0 ? startDy : lineHeight) + "em")
                .text(lineText);
        });
         if (totalLines === 0 && String(textString).length === 0) { // Ensure empty text has a tspan if needed for dy
            d3TextSelection.append("tspan").attr("x", initialX).attr("dy", startDy + "em").text("");
        }
    }
    
    // In-memory text measurement utility (basic version, may have limitations)
    // This specific chart uses a more direct measurement approach for dynamic font sizing.
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight = 'normal') {
        if (!text || String(text).length === 0) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempTextElement = document.createElementNS(svgNS, 'text');
        tempTextElement.setAttribute('font-family', fontFamily);
        tempTextElement.setAttribute('font-size', fontSize);
        tempTextElement.setAttribute('font-weight', fontWeight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // getBBox on an unattached element can be unreliable.
        // For this chart, dynamic sizing uses temporary elements within the main SVG.
        try {
            return tempTextElement.getBBox().width;
        } catch (e) { 
            // Fallback for environments where getBBox fails.
            return String(text).length * (parseFloat(fontSize) * 0.6); // Very rough estimate
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
        .style("background-color", colors.background_color);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 100, left: 30 }; // Adjusted margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const maxValue = d3.max(sortedData, d => d[valueFieldName]) || 1; // Ensure maxValue is not 0

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(sortedData.map(d => d[categoryFieldName]))
        .range([0, innerWidth])
        .padding(0.25); // Adjusted padding

    // Y-scale is not used for positioning bars directly, but for percentage calculation.
    // Bottle height is determined differently.

    const bandWidth = xScale.bandwidth();
    const bottleWidth = bandWidth;
    const bottleHeight = Math.min(bottleWidth * bottleImageAspectRatio, innerHeight * 0.7); // Cap bottle height

    const bottleTopY = innerHeight - bottleHeight - (variables.vertical_spacing_for_labels || 60); // Space for labels below

    const spacingAfterBottle = bottleWidth * 0.1;
    const spacingBetweenIconLabel = parseFloat(fillStyle.typography.categoryLabelFontSize) * 0.5; // Relative to font size

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend in this chart.

    // Block 8: Main Data Visualization Rendering
    const valueLabelsData = []; // To store data for dynamic font sizing of value labels

    const bottleGroups = mainChartGroup.selectAll(".bottle-item-group")
        .data(sortedData)
        .enter()
        .append("g")
        .attr("class", d => `bottle-item-group mark category-${String(d[categoryFieldName]).replace(/\s+/g, '-')}`)
        .attr("transform", d => `translate(${xScale(d[categoryFieldName])}, ${bottleTopY})`);

    bottleGroups.each(function(d, i) {
        const group = d3.select(this);
        const fillPercentage = Math.max(0, Math.min(1, (d[valueFieldName] / maxValue)));

        const clipId = `clip-bottle-${i}`;
        group.append("clipPath")
            .attr("id", clipId)
            .append("rect")
            .attr("class", "clip-rect")
            .attr("x", 0)
            .attr("y", bottleHeight * (1 - fillPercentage))
            .attr("width", bottleWidth)
            .attr("height", bottleHeight * fillPercentage);

        // Background bottle image (semi-transparent)
        group.append("image")
            .attr("xlink:href", fillStyle.bottleImageBase64)
            .attr("class", "bottle-background image")
            .attr("width", bottleWidth)
            .attr("height", bottleHeight)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("opacity", fillStyle.bottleImageBackgroundColorOpacity);

        // Foreground bottle image (clipped)
        group.append("image")
            .attr("xlink:href", fillStyle.bottleImageBase64)
            .attr("class", "bottle-foreground image")
            .attr("width", bottleWidth)
            .attr("height", bottleHeight)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .attr("clip-path", `url(#${clipId})`);

        // Value label square and text
        const squareSize = Math.min(bottleWidth * 0.5, bottleHeight * 0.25); // Responsive square size
        const squareX = (bottleWidth - squareSize) / 2;
        const squareY = bottleHeight * 0.6 - (squareSize / 2); // Position square around 2/3rds up

        if (squareSize > 5) { // Only add if square is reasonably sized
            group.append("rect")
                .attr("class", "value-bg mark")
                .attr("x", squareX)
                .attr("y", squareY)
                .attr("width", squareSize)
                .attr("height", squareSize)
                .attr("fill", fillStyle.valueLabelBackgroundColor)
                .attr("opacity", 0.85)
                .attr("rx", Math.max(2, squareSize * 0.1))
                .attr("ry", Math.max(2, squareSize * 0.1));

            const formattedValueText = `${formatValue(d[valueFieldName])}${valueUnit === "none" ? "" : valueUnit}`;
            const valueTextElement = group.append("text")
                .attr("class", "value-label label")
                .attr("x", bottleWidth / 2)
                .attr("y", squareY + squareSize / 2) // Vertically center roughly
                .attr("dy", "0.35em") // More precise vertical centering
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.valueLabelFontFamily)
                .style("font-weight", fillStyle.typography.valueLabelFontWeight)
                .style("fill", fillStyle.valueLabelTextColor)
                .text(formattedValueText);
            
            valueLabelsData.push({
                element: valueTextElement,
                text: formattedValueText,
                maxWidth: squareSize * 0.9, // 90% of square width for text
                maxHeight: squareSize * 0.9, // 90% of square height
                baseFontSize: parseFloat(fillStyle.typography.valueLabelBaseFontSize)
            });
        }

        // Category icon (flag) and label
        const iconLabelGroup = group.append("g")
            .attr("class", "icon-label-group")
            .attr("transform", `translate(${bottleWidth / 2}, ${bottleHeight + spacingAfterBottle})`);

        const iconSize = Math.min(bandWidth * 0.6, 40); // Max icon size 40px
        
        if (fillStyle.categoryImages && fillStyle.categoryImages[d[categoryFieldName]]) {
            iconLabelGroup.append("image")
                .attr("xlink:href", fillStyle.categoryImages[d[categoryFieldName]])
                .attr("class", "category-icon image")
                .attr("x", -iconSize / 2)
                .attr("y", 0)
                .attr("width", iconSize)
                .attr("height", iconSize * 0.75) // Assuming 4:3 aspect ratio for flags
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
        
        const categoryLabelText = iconLabelGroup.append("text")
            .attr("class", "category-label label")
            .attr("x", 0)
            .attr("y", (fillStyle.categoryImages && fillStyle.categoryImages[d[categoryFieldName]] ? iconSize * 0.75 : 0) + spacingBetweenIconLabel)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.categoryLabelFontFamily)
            .style("font-size", fillStyle.typography.categoryLabelFontSize) // Base size
            .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d[categoryFieldName]);

        // Wrap category label text
        const labelMaxWidth = bandWidth * 0.95; // Max width for category label
        wrapText(categoryLabelText, d[categoryFieldName], labelMaxWidth, 1.1, 'top');
    });

    // Block 9: Optional Enhancements & Post-Processing (Dynamic Font Sizing)
    // Adjust value label font sizes
    if (valueLabelsData.length > 0) {
        const tempTextMeasure = svgRoot.append("text") // Temporary text for measurement
            .attr("class", "temp-text-measure")
            .style("font-family", fillStyle.typography.valueLabelFontFamily)
            .style("font-weight", fillStyle.typography.valueLabelFontWeight)
            .attr("visibility", "hidden");

        let minScaleFactor = 1;
        valueLabelsData.forEach(item => {
            tempTextMeasure.style("font-size", `${item.baseFontSize}px`).text(item.text);
            const textWidth = tempTextMeasure.node().getComputedTextLength();
            const textHeight = item.baseFontSize; // Approximate height

            let scaleFactor = 1;
            if (textWidth > item.maxWidth) {
                scaleFactor = Math.min(scaleFactor, item.maxWidth / textWidth);
            }
            if (textHeight > item.maxHeight) { // Basic height check
                 scaleFactor = Math.min(scaleFactor, item.maxHeight / textHeight);
            }
            minScaleFactor = Math.min(minScaleFactor, scaleFactor);
        });
        tempTextMeasure.remove();

        const finalValueFontSize = Math.max(6, valueLabelsData[0].baseFontSize * minScaleFactor); // Minimum font size of 6px

        valueLabelsData.forEach(item => {
            item.element.style("font-size", `${finalValueFontSize}px`);
            // Re-center dy after font size change if needed, though 0.35em is usually robust
        });
    }
    
    // Adjust category label font sizes (if all labels need to fit and be same size)
    // This example keeps individual wrapping, but a similar approach to value labels could unify font size.
    // For now, category labels use base size + wrapping.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}