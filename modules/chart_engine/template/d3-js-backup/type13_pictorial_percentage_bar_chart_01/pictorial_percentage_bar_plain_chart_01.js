/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pictorial Percentage Bar Chart",
  "chart_name": "pictorial_percentage_bar_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 10], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldColumn = dataColumns.find(col => col.role === "x");
    const yFieldColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xFieldColumn?.name;
    const valueFieldName = yFieldColumn?.name;
    
    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field (category)");
        if (!valueFieldName) missingFields.push("y role field (value)");
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionUnit = xFieldColumn?.unit !== "none" && xFieldColumn?.unit ? xFieldColumn.unit : ""; // Extracted, not directly used in this chart's rendering logic
    const valueUnit = yFieldColumn?.unit !== "none" && yFieldColumn?.unit ? yFieldColumn.unit : "";


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyInput.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyInput.label?.font_size || "14px", 
            labelFontWeight: typographyInput.label?.font_weight || "normal",
            valueFontFamily: typographyInput.label?.font_family || "Arial, sans-serif", 
            valueFontSize: typographyInput.label?.font_size || "14px", 
            valueFontWeight: typographyInput.label?.font_weight || "bold",
        },
        textColor: colorsInput.text_color || "#333333",
        bottlePrimaryColor: colorsInput.other?.primary || "#4CAF50", // Note: This color is for config, but the bottle SVG has its own fixed colors.
        valueLabelBackgroundColor: colorsInput.other?.secondary || "#f0f0f0", // Example using secondary for background
        chartBackground: colorsInput.background_color || "transparent",
    };

    function estimateTextWidth(text, fontProps = {}) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        tempTextElement.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        tempTextElement.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        tempTextElement.style.visibility = "hidden"; // Important for accurate measurement if styles are complex
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // Appending to body temporarily for robust getBBox, then removing, is a common pattern,
        // but restricted by "MUST NOT be appended to the document DOM".
        // getBBox on unattached elements can be inconsistent.
        // This chart uses getComputedTextLength on elements within its own SVG for dynamic sizing.
        const width = tempTextElement.getBBox().width;
        return width;
    }
    
    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~.1f")(value / 1000000000) + "B";
        if (Math.abs(value) >= 1000000) return d3.format("~.1f")(value / 1000000) + "M";
        if (Math.abs(value) >= 1000) return d3.format("~.1f")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    function svgToBase64(svgString) {
        const cleanSvg = svgString.replace(/\s+/g, ' ').trim();
        try {
            const encoded = encodeURIComponent(cleanSvg)
                .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()); // More robust URI encoding
            return 'data:image/svg+xml;base64,' + btoa(unescape(encoded));
        } catch (e) { // Handle potential errors with unescape for certain characters
            return 'data:image/svg+xml;base64,' + btoa(cleanSvg);
        }
    }

    function wrapText(textSelection, textContent, maxWidth, lineHeightEm = 1.1, verticalAlignment = 'middle') {
        const words = textContent.toString().split(/\s+/).filter(w => w.length > 0);
        let line = [];
        const initialX = parseFloat(textSelection.attr("x")) || 0;
        
        textSelection.text(null);
        let tspanContentArray = [];

        if (words.length > 0) {
            let currentLineWords = [];
            let word;
            // Word wrapping
            while ((word = words.shift()) !== undefined) {
                currentLineWords.push(word);
                const tempTspan = textSelection.append("tspan").text(currentLineWords.join(" "));
                if (tempTspan.node().getComputedTextLength() > maxWidth && currentLineWords.length > 1) {
                    currentLineWords.pop(); 
                    tspanContentArray.push(currentLineWords.join(" "));
                    currentLineWords = [word]; 
                }
                tempTspan.remove();
            }
            if (currentLineWords.length > 0) {
                tspanContentArray.push(currentLineWords.join(" "));
            }
        }

        // If word wrapping failed or text is a single long word, try character wrapping
        if (tspanContentArray.length === 0 && textContent.length > 0) {
            const chars = textContent.toString().split('');
            let currentLineChars = '';
            for (let i = 0; i < chars.length; i++) {
                const testLine = currentLineChars + chars[i];
                const tempTspan = textSelection.append("tspan").text(testLine);
                if (tempTspan.node().getComputedTextLength() > maxWidth && currentLineChars.length > 0) {
                    tspanContentArray.push(currentLineChars);
                    currentLineChars = chars[i];
                } else {
                    currentLineChars = testLine;
                }
                tempTspan.remove();
            }
            if (currentLineChars.length > 0) {
                tspanContentArray.push(currentLineChars);
            }
        }
        
        let startDyOffset = 0;
        if (verticalAlignment === 'middle') {
            startDyOffset = -((tspanContentArray.length - 1) * lineHeightEm / 2);
        } else if (verticalAlignment === 'bottom') {
            startDyOffset = -((tspanContentArray.length - 1) * lineHeightEm);
        } // 'top' alignment has startDyOffset = 0, first line dy is 0 relative to text y

        tspanContentArray.forEach((lineText, i) => {
            textSelection.append("tspan")
                .attr("x", initialX)
                .attr("dy", (i === 0 ? startDyOffset : lineHeightEm) + "em")
                .text(lineText);
        });
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    if (fillStyle.chartBackground !== "transparent") {
        svgRoot.style("background-color", fillStyle.chartBackground);
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group");

    const bottleImageSVGString = `<svg viewBox="0 0 200 500" xmlns="http://www.w3.org/2000/svg"><path d="M60,280 L60,450 Q100,480 140,450 L140,280 Z" fill="#8BC34A"/><path d="M60,230 L60,280 L140,280 L140,230 Z" fill="#FDD835"/><circle cx="100" cy="255" r="25" fill="#FDD835"/><path d="M75,50 Q100,40 125,50 L125,70 Q100,80 75,70 Z" fill="#555555"/><path d="M80,70 L60,230 L140,230 L120,70 Z" fill="#555555"/><path d="M80,70 Q100,60 120,70 L120,70 Q100,80 80,70 Z" fill="#555555"/></svg>`;
    const bottleImageBase64 = svgToBase64(bottleImageSVGString);
    const svgViewBoxMatch = bottleImageSVGString.match(/viewBox="([^"]+)"/);
    const svgViewBox = svgViewBoxMatch ? svgViewBoxMatch[1].split(' ').map(Number) : [0,0,200,500];
    const svgImageWidth = svgViewBox[2];
    const svgImageHeight = svgViewBox[3];
    const svgImageAspectRatio = svgImageHeight / svgImageWidth;

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 30, bottom: 120, left: 30 }; 
    
    mainChartGroup.attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const chartData = chartDataInput.map(d => ({
        ...d,
        [valueFieldName]: +d[valueFieldName] 
    })).filter(d => !isNaN(d[valueFieldName])); // Filter out NaN values after coercion
    
    const sortedData = [...chartData].sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(sortedData.map(d => d[categoryFieldName]))
        .range([0, innerWidth])
        .padding(0.3); 

    const yMaxValue = d3.max(sortedData, d => d[valueFieldName]);
    const yMinValue = d3.min(sortedData, d => d[valueFieldName]); // For normalization if needed, not strictly percentage of max
    const dataDomainMax = yMaxValue > 0 ? yMaxValue : (yMinValue < 0 ? Math.max(1, Math.abs(yMinValue)) : 1) ; // Ensure positive domain for percentage


    // Block 7: Chart Component Rendering
    // No axes, gridlines, or legend for this chart.

    // Block 8: Main Data Visualization Rendering
    const itemBandwidth = xScale.bandwidth();
    const renderedBottleWidth = itemBandwidth;
    const renderedBottleHeight = renderedBottleWidth * svgImageAspectRatio;
    
    const bottleBottomY = innerHeight - (variables.verticalPaddingBetweenBottleAndLabel || renderedBottleHeight * 0.1); 
    const bottleTopY = bottleBottomY - renderedBottleHeight;

    const spacingAfterBottle = renderedBottleHeight * 0.05; 
    const spacingBetweenIconLabel = itemBandwidth * 0.1; 

    const valueLabelsData = []; 

    const bottleGroups = mainChartGroup.selectAll(".bottle-item-group")
        .data(sortedData)
        .enter()
        .append("g")
        .attr("class", d => `bottle-item-group mark data-item-${String(d[categoryFieldName]).replace(/\s+/g, '-')}`)
        .attr("transform", d => `translate(${xScale(d[categoryFieldName])}, ${bottleTopY})`);

    bottleGroups.each(function(d, i) {
        const group = d3.select(this);
        const currentValue = d[valueFieldName];
        // Ensure fillPercentage is between 0 and 1. Handles cases where currentValue might exceed dataDomainMax due to data variations.
        const fillPercentage = dataDomainMax > 0 ? Math.max(0, Math.min(1, currentValue / dataDomainMax)) : 0;


        const clipId = `clip-bottle-${i}`;
        group.append("clipPath")
            .attr("id", clipId)
            .append("rect")
            .attr("class", "clip-rect other")
            .attr("x", 0)
            .attr("y", renderedBottleHeight * (1 - fillPercentage))
            .attr("width", renderedBottleWidth)
            .attr("height", renderedBottleHeight * fillPercentage);

        group.append("image")
            .attr("class", "image bottle-background")
            .attr("xlink:href", bottleImageBase64)
            .attr("width", renderedBottleWidth)
            .attr("height", renderedBottleHeight)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("opacity", 0.15);

        group.append("image")
            .attr("class", "image bottle-foreground")
            .attr("xlink:href", bottleImageBase64)
            .attr("width", renderedBottleWidth)
            .attr("height", renderedBottleHeight)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .attr("clip-path", `url(#${clipId})`);

        const squareSize = Math.min(renderedBottleWidth * 0.6, renderedBottleHeight * 0.25);
        const squareX = (renderedBottleWidth - squareSize) / 2;
        const squareY = renderedBottleHeight * (2/3) - (squareSize / 2); // Position in lower-middle part of bottle

        group.append("rect")
            .attr("class", "value-bg-rect other")
            .attr("x", squareX)
            .attr("y", squareY)
            .attr("width", squareSize)
            .attr("height", squareSize)
            .attr("fill", fillStyle.valueLabelBackgroundColor)
            .attr("opacity", 0.85)
            .attr("rx", Math.min(5, squareSize * 0.1))
            .attr("ry", Math.min(5, squareSize * 0.1));
        
        const formattedValueText = `${formatValue(currentValue)}${valueUnit}`;
        const valueTextElement = group.append("text")
            .attr("class", "value-label label")
            .attr("x", renderedBottleWidth / 2)
            .attr("y", squareY + (squareSize / 2)) 
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .style("font-family", fillStyle.typography.valueFontFamily)
            .style("font-weight", fillStyle.typography.valueFontWeight)
            .style("fill", fillStyle.textColor)
            .style("font-size", fillStyle.typography.valueFontSize) 
            .text(formattedValueText);
            
        valueLabelsData.push({
            element: valueTextElement,
            text: formattedValueText,
            maxWidth: squareSize * 0.9, 
            maxHeight: squareSize * 0.9
        });
    });

    const categoryLabelGroups = mainChartGroup.selectAll(".category-label-item-group")
        .data(sortedData)
        .enter()
        .append("g")
        .attr("class", "category-label-item-group other")
        .attr("transform", d => {
            const xPos = xScale(d[categoryFieldName]) + itemBandwidth / 2;
            const yPos = bottleTopY + renderedBottleHeight + spacingAfterBottle;
            return `translate(${xPos}, ${yPos})`;
        });

    const iconWidth = Math.min(itemBandwidth * 0.8, 50); 
    const iconHeight = iconWidth * 0.75; 

    categoryLabelGroups.each(function(d) {
        const group = d3.select(this);
        const categoryName = d[categoryFieldName];
        
        const iconImageUrl = imagesInput.field?.[categoryName] || imagesInput.other?.defaultIcon;
        let iconRenderedHeight = 0;
        if (iconImageUrl) {
            group.append("image")
                .attr("class", "image category-icon")
                .attr("xlink:href", iconImageUrl)
                .attr("x", -iconWidth / 2)
                .attr("y", 0)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet");
            iconRenderedHeight = iconHeight;
        }

        const labelYPos = iconRenderedHeight + (iconRenderedHeight > 0 ? spacingBetweenIconLabel : 0);
        const categoryTextElement = group.append("text")
            .attr("class", "category-name-label label")
            .attr("x", 0)
            .attr("y", labelYPos) 
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize) 
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryName); // Initial text for measurement and wrapping
        
        const labelMaxWidth = itemBandwidth * 1.05; 
        wrapText(categoryTextElement, categoryName.toString(), labelMaxWidth, 1.1, 'top');
    });


    // Block 9: Optional Enhancements & Post-Processing
    const tempMeasureText = svgRoot.append("text")
        .attr("class", "temp-measure-text text") // Added class
        .attr("visibility", "hidden")
        .style("font-family", fillStyle.typography.valueFontFamily)
        .style("font-weight", fillStyle.typography.valueFontWeight);

    let minCalculatedValueFontSize = parseFloat(fillStyle.typography.valueFontSize.replace('px',''));

    valueLabelsData.forEach(item => {
        let currentFontSize = minCalculatedValueFontSize;
        tempMeasureText.style("font-size", `${currentFontSize}px`).text(item.text);
        let textWidth = tempMeasureText.node().getComputedTextLength();
        let textHeight = tempMeasureText.node().getBBox().height; // Approximate height

        // Scale based on width
        if (textWidth > item.maxWidth && item.maxWidth > 0) {
            currentFontSize = (item.maxWidth / textWidth) * currentFontSize;
        }
        // Scale based on height (important for multi-line, though current values are single line)
        if (textHeight > item.maxHeight && item.maxHeight > 0) {
             currentFontSize = Math.min(currentFontSize, (item.maxHeight / textHeight) * currentFontSize);
        }
        minCalculatedValueFontSize = Math.min(minCalculatedValueFontSize, currentFontSize);
    });
    
    minCalculatedValueFontSize = Math.max(minCalculatedValueFontSize, 6); // Ensure a minimum readable font size
    valueLabelsData.forEach(item => {
        item.element.style("font-size", `${minCalculatedValueFontSize}px`);
    });
    tempMeasureText.remove();

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}