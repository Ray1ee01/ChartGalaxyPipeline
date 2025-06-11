/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Circular Bar Chart",
  "chart_name": "grouped_circular_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "detailed",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed in data.colors_dark
    const rawImages = data.images || {}; // Though not used in this specific chart type
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    let missingFields = [];
    if (!dimensionFieldConfig) missingFields.push("x role");
    if (!valueFieldConfig) missingFields.push("y role");
    if (!groupFieldConfig) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: Column roles [${missingFields.join(", ")}] not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMsg);
        return null;
    }

    const dimensionField = dimensionFieldConfig.name;
    const valueField = valueFieldConfig.name;
    const groupField = groupFieldConfig.name;
    const valueUnit = (valueFieldConfig.unit && valueFieldConfig.unit !== "none") ? valueFieldConfig.unit : "";

    if (!dimensionField || !valueField || !groupField) {
        const errorMsg = `Critical chart config missing: Field names for roles x, y, or group are undefined. Cannot render.`;
        console.error(errorMsg);
         d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMsg);
        return null;
    }
    
    // Filter out data items with missing critical fields or non-numeric y-values
    const chartData = rawChartData.filter(d => 
        d[dimensionField] != null && 
        d[groupField] != null &&
        d[valueField] != null && 
        !isNaN(parseFloat(d[valueField]))
    );
    if (chartData.length === 0 && rawChartData.length > 0) {
        const errorMsg = `No valid data points to render after filtering. Check for missing values or non-numeric y-values.`;
        console.warn(errorMsg);
        // Optionally render a message, but for now, let it render an empty chart if scales can't be formed.
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: rawColors.text_color || "#333333",
        backgroundColor: rawColors.background_color || "#FFFFFF", // Not directly used on SVG, but good to have
        primaryAccent: (rawColors.other && rawColors.other.primary) || "#4682B4",
        defaultCategoryColor: "#CCCCCC",
        centerCircleFill: "#FFFFFF",
        centerCircleStroke: "#DDDDDD",
        backgroundSectorOpacity: 0.3,
        backgroundSectorStroke: "#FFFFFF",
        dataArcMouseOverOpacity: 0.8,
        valueLabelColor: "#FFFFFF", // Color for text labels on data arcs
        legendBarHeight: 15,
        legendPaddingTop: 8, // Space between legend color bar and text
        legendNumberLeftPadding: 3,
        legendNumberRightPadding: 5,
        legendTextPadding: 0, // Space between legend number and group name
    };

    fillStyle.typography = {
        titleFontFamily: (rawTypography.title && rawTypography.title.font_family) || "Arial, sans-serif",
        titleFontSize: (rawTypography.title && rawTypography.title.font_size) || "18px",
        titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || "bold",
        labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || "Arial, sans-serif",
        labelFontSize: (rawTypography.label && rawTypography.label.font_size) || "12px",
        labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || "normal",
        annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || "Arial, sans-serif",
        annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || "10px",
        annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || "normal",
        legendNumberFontSize: "16px", // Specific for legend numbers
        legendNumberFontWeight: "bold",
    };
    
    const MIN_ACCEPTABLE_FONT_SIZE = 8; // px

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text || text.length === 0) return 0;
        const svgNs = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNs, 'svg');
        const tempText = document.createElementNS(svgNs, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize); // fontSize should be like "12px"
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        try {
            return tempText.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth getBBox failed, using fallback:", e);
            return String(text).length * parseFloat(fontSize) * 0.6;
        }
    }

    function formatValue(value) {
        if (value == null || isNaN(value)) return "";
        if (Math.abs(value) >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (Math.abs(value) >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (Math.abs(value) >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    function cleanId(str) {
        return String(str).replace(/\s+/g, '-').replace(/[^\w\-]/g, '');
    }
    
    const groupColorsCache = {};
    const d3Category10 = d3.scaleOrdinal(d3.schemeCategory10);

    function getGroupColor(groupName, groupIndex) {
        if (groupColorsCache[groupName]) return groupColorsCache[groupName];

        let color;
        if (rawColors.field && rawColors.field[groupName]) {
            color = rawColors.field[groupName];
        } else if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            color = rawColors.available_colors[groupIndex % rawColors.available_colors.length];
        } else {
            color = d3Category10(groupName); // Fallback to d3.schemeCategory10
        }
        groupColorsCache[groupName] = color;
        return color;
    }

    function wrapText(d3TextSelection, text, width, lineHeightEm) {
        d3TextSelection.each(function() {
            const textElement = d3.select(this);
            const words = String(text).split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textElement.attr("x") || 0;
            const y = textElement.attr("y") || 0;
            const dy = parseFloat(textElement.attr("dy") || 0);
            
            let tspan = textElement.text(null).append("tspan")
                .attr("x", x).attr("y", y).attr("dy", dy + "em");

            if (words.length === 1 && words[0] === "") { // Handle empty text
                 tspan.text("");
                 return;
            }
            
            // Check if single word/string itself is too long, then try character wrapping
            let singleWordTooLong = false;
            if (words.length === 1) {
                tspan.text(words[0]);
                if (tspan.node().getComputedTextLength() > width) {
                    singleWordTooLong = true;
                }
                tspan.text(""); // Reset
            }


            if (singleWordTooLong || words.join(" ").length < text.length * 0.5) { // Heuristic for when to char wrap (e.g. CJK)
                const chars = String(text).split('');
                let currentLine = '';
                tspan.text(currentLine); // Start with empty tspan
                for (let i = 0; i < chars.length; i++) {
                    currentLine += chars[i];
                    tspan.text(currentLine);
                    if (tspan.node().getComputedTextLength() > width && currentLine.length > 1) {
                        currentLine = currentLine.slice(0, -1); // remove last char
                        tspan.text(currentLine); // set tspan to line without last char
                        
                        currentLine = chars[i]; // start new line with current char
                        tspan = textElement.append("tspan")
                            .attr("x", x).attr("y", y)
                            .attr("dy", (++lineNumber * lineHeightEm) + dy + "em")
                            .text(currentLine);
                    }
                }
            } else { // Word wrapping
                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > width && line.length > 1) {
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        tspan = textElement.append("tspan")
                            .attr("x", x).attr("y", y)
                            .attr("dy", (++lineNumber * lineHeightEm) + dy + "em")
                            .text(word);
                    }
                }
            }
        });
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 600;

    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 90, right: 50, bottom: 90, left: 50 }; // Consider making margins configurable
    
    const plotAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const plotAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = chartMargins.left + plotAreaWidth / 2;
    const centerY = chartMargins.top + plotAreaHeight / 2;
    
    const radius = Math.max(10, Math.min(plotAreaWidth, plotAreaHeight) / 2); // Ensure radius is positive
    const innerCircleRadius = Math.max(1, radius * 0.1); // Ensure inner radius is positive

    // Block 5: Data Preprocessing & Transformation
    if (chartData.length === 0) { // If no data after filtering or initially
        console.warn("No data available to render the chart.");
        svg.append("text")
           .attr("x", containerWidth / 2)
           .attr("y", containerHeight / 2)
           .attr("text-anchor", "middle")
           .attr("class", "label no-data-label")
           .style("font-family", fillStyle.typography.labelFontFamily)
           .style("font-size", fillStyle.typography.labelFontSize)
           .style("fill", fillStyle.textColor)
           .text("No data to display.");
        return svg.node(); // Exit early
    }
    
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    const totalItems = chartData.length;
    const anglePerItem = totalItems > 0 ? (2 * Math.PI) / totalItems : 0;

    chartData.sort((a, b) => {
        const groupCompare = groups.indexOf(a[groupField]) - groups.indexOf(b[groupField]);
        if (groupCompare !== 0) return groupCompare;
        return parseFloat(b[valueField]) - parseFloat(a[valueField]);
    });

    const sortedGroupedData = d3.group(chartData, d => d[groupField]);
    const maxValue = d3.max(chartData, d => +d[valueField]) || 0;


    // Block 6: Scale Definition & Configuration
    const radiusScale = d3.scaleLinear()
        .domain([0, Math.max(0.00001, maxValue)]) // Ensure domain is not [0,0]
        .range([innerCircleRadius, radius * 0.9]); // 0.9 factor for some padding from edge


    // Block 7: Chart Component Rendering (Background Sectors, Center Circle, Legend)
    const chartComponentsGroup = svg.append("g").attr("class", "chart-components");

    // Background Sectors
    let currentAngleForBackground = 0;
    groups.forEach((groupName, groupIdx) => {
        const groupItems = sortedGroupedData.get(groupName);
        if (!groupItems || groupItems.length === 0) return;

        const groupColor = getGroupColor(groupName, groupIdx);
        const lightGroupColor = d3.rgb(groupColor).brighter(1.5).toString();
        
        const startAngle = currentAngleForBackground;
        const endAngle = startAngle + groupItems.length * anglePerItem;

        const backgroundArc = d3.arc()
            .innerRadius(innerCircleRadius)
            .outerRadius(radius)
            .startAngle(startAngle)
            .endAngle(endAngle)
            .padAngle(0.001);

        chartComponentsGroup.append("path")
            .attr("d", backgroundArc)
            .attr("transform", `translate(${centerX}, ${centerY})`)
            .attr("fill", lightGroupColor)
            .attr("opacity", fillStyle.backgroundSectorOpacity)
            .attr("stroke", fillStyle.backgroundSectorStroke)
            .attr("stroke-width", 0.5)
            .attr("class", "mark background-sector");
        
        currentAngleForBackground = endAngle;
    });

    // Center Circle
    chartComponentsGroup.append("circle")
        .attr("cx", centerX)
        .attr("cy", centerY)
        .attr("r", innerCircleRadius)
        .attr("fill", fillStyle.centerCircleFill)
        .attr("stroke", fillStyle.centerCircleStroke)
        .attr("stroke-width", 0.5)
        .attr("class", "mark center-circle");

    // Legend Pre-calculation
    let globalLegendFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    let globalLegendNeedsWrapping = false;
    const estimatedLegendNumberWidth = estimateTextWidth("8", fillStyle.typography.labelFontFamily, fillStyle.typography.legendNumberFontSize, fillStyle.typography.legendNumberFontWeight);
    const legendGroupNameAvailableWidth = groups.length > 0 ? 
        Math.max(10, (plotAreaWidth / groups.length) - fillStyle.legendNumberLeftPadding - estimatedLegendNumberWidth - fillStyle.legendNumberRightPadding - fillStyle.legendTextPadding - fillStyle.legendNumberLeftPadding)
        : 10;

    groups.forEach(groupName => {
        let currentFontSize = parseFloat(fillStyle.typography.annotationFontSize);
        let measuredWidth = estimateTextWidth(groupName, fillStyle.typography.annotationFontFamily, `${currentFontSize}px`, fillStyle.typography.annotationFontWeight);
        
        if (measuredWidth > legendGroupNameAvailableWidth) {
            currentFontSize = MIN_ACCEPTABLE_FONT_SIZE;
            globalLegendFontSize = MIN_ACCEPTABLE_FONT_SIZE;
            measuredWidth = estimateTextWidth(groupName, fillStyle.typography.annotationFontFamily, `${currentFontSize}px`, fillStyle.typography.annotationFontWeight);
            if (measuredWidth > legendGroupNameAvailableWidth) {
                globalLegendNeedsWrapping = true;
            }
        }
    });
    
    // Legend Rendering
    const legendStartY = containerHeight - chartMargins.bottom * 0.8 + 10;
    const legendStartX = centerX - plotAreaWidth / 2;
    const legendGroup = chartComponentsGroup.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendStartX}, ${legendStartY})`);

    let currentLegendX = 0;
    const legendRectWidth = groups.length > 0 ? plotAreaWidth / groups.length : 0;

    groups.forEach((groupName, idx) => {
        const groupColor = getGroupColor(groupName, idx);

        const legendItemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, 0)`);

        legendItemGroup.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", legendRectWidth)
            .attr("height", fillStyle.legendBarHeight)
            .attr("fill", groupColor)
            .attr("class", "mark legend-mark");

        const numberX = fillStyle.legendNumberLeftPadding;
        const labelY = fillStyle.legendBarHeight + fillStyle.legendPaddingTop;
        const groupNameX = numberX + estimatedLegendNumberWidth + fillStyle.legendNumberRightPadding + fillStyle.legendTextPadding;

        legendItemGroup.append("text")
            .attr("x", numberX)
            .attr("y", labelY)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "hanging")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.legendNumberFontSize)
            .style("font-weight", fillStyle.typography.legendNumberFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "label legend-label legend-number")
            .text(idx + 1);

        const groupNameText = legendItemGroup.append("text")
            .attr("x", groupNameX)
            .attr("y", labelY)
            .attr("dominant-baseline", "hanging")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${globalLegendFontSize}px`)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "label legend-label legend-group-name");

        if (globalLegendNeedsWrapping && legendGroupNameAvailableWidth > 10) {
            wrapText(groupNameText, groupName, legendGroupNameAvailableWidth, 1.1);
        } else {
            groupNameText.text(groupName);
        }
        currentLegendX += legendRectWidth;
    });


    // Block 8: Main Data Visualization Rendering
    const mainDataVizGroup = svg.append("g").attr("class", "main-data-viz");
    
    // Dimension Label (Country Name) Pre-calculation
    let globalDimensionLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
    let globalDimensionLabelNeedsWrapping = false;
    const dimensionLabelWrapWidth = anglePerItem > 0 ? radius * anglePerItem * 1.0 : 20; // Available width for dimension label

    chartData.forEach(item => {
        const itemName = String(item[dimensionField]);
        let currentFontSize = parseFloat(fillStyle.typography.labelFontSize);
        let measuredWidth = estimateTextWidth(itemName, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);

        if (measuredWidth > dimensionLabelWrapWidth) {
            currentFontSize = MIN_ACCEPTABLE_FONT_SIZE;
            globalDimensionLabelFontSize = MIN_ACCEPTABLE_FONT_SIZE; // Apply globally if any needs shrinking
            measuredWidth = estimateTextWidth(itemName, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
            if (measuredWidth > dimensionLabelWrapWidth) {
                globalDimensionLabelNeedsWrapping = true; // Apply globally if any needs wrapping
            }
        }
        item.calculatedWrapWidth = dimensionLabelWrapWidth; // Store for rendering loop
    });


    let currentAngleForData = 0;
    chartData.forEach((item, itemIdx) => {
        const groupName = item[groupField];
        const groupIdx = groups.indexOf(groupName);
        const groupColor = getGroupColor(groupName, groupIdx);
        
        const itemStartAngle = currentAngleForData;
        const itemEndAngle = currentAngleForData + anglePerItem;
        const itemValue = +item[valueField];
        const itemRadius = radiusScale(itemValue);

        const dataArcGenerator = d3.arc()
            .innerRadius(innerCircleRadius)
            .outerRadius(Math.max(innerCircleRadius, itemRadius)) // Ensure outerRadius >= innerRadius
            .startAngle(itemStartAngle)
            .endAngle(itemEndAngle)
            .padAngle(0.005);

        mainDataVizGroup.append("path")
            .attr("d", dataArcGenerator)
            .attr("transform", `translate(${centerX}, ${centerY})`)
            .attr("fill", groupColor)
            .attr("class", "mark data-arc")
            .on("mouseover", function() { d3.select(this).style("opacity", fillStyle.dataArcMouseOverOpacity); })
            .on("mouseout", function() { d3.select(this).style("opacity", 1); });

        // Value Labels (inside arcs)
        const formattedValue = `${formatValue(itemValue)}${valueUnit}`;
        let finalValueFontSize = 0;
        const initialValueLabelSize = parseFloat(fillStyle.typography.annotationFontSize);

        for (let fs = initialValueLabelSize; fs >= MIN_ACCEPTABLE_FONT_SIZE; fs--) {
            const estimatedHeight = fs * 1.2;
            const radialSpace = itemRadius - innerCircleRadius;
            if (estimatedHeight > radialSpace) continue;

            const currentTextRadius = Math.max(innerCircleRadius + estimatedHeight / 2, itemRadius - estimatedHeight / 2 - 6);
            const angularSpaceForText = anglePerItem * currentTextRadius;
            const textWidth = estimateTextWidth(formattedValue, fillStyle.typography.annotationFontFamily, `${fs}px`, fillStyle.typography.annotationFontWeight);
            
            if (textWidth <= angularSpaceForText && estimatedHeight <= radialSpace) { // Check both width and height fit
                finalValueFontSize = fs;
                break;
            }
        }
        
        if (finalValueFontSize > 0) {
            const textAngle = itemStartAngle + anglePerItem / 2;
            const estimatedHeight = finalValueFontSize * 1.2;
            const textRadius = Math.max(innerCircleRadius + estimatedHeight / 2, itemRadius - estimatedHeight / 2 - 6); // 6px padding

            const textX = centerX + textRadius * Math.cos(textAngle - Math.PI / 2);
            const textY = centerY + textRadius * Math.sin(textAngle - Math.PI / 2);
            let textRotationDeg = (textAngle * 180 / Math.PI) - 90;
            if (textAngle > Math.PI && textAngle < 2 * Math.PI) {
                textRotationDeg += 180;
            }

            mainDataVizGroup.append("text")
                .attr("x", textX)
                .attr("y", textY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("transform", `rotate(${textRotationDeg}, ${textX}, ${textY})`)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${finalValueFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.valueLabelColor)
                .attr("class", "label value-label")
                .text(formattedValue);
        }

        // Dimension Labels (e.g., Country Names, outside arcs)
        const dimensionName = String(item[dimensionField]);
        if (dimensionName) {
            const midAngle = itemStartAngle + anglePerItem / 2;
            const labelRadius = radius * 1.05; // Position labels slightly outside the main radius
            const labelX = centerX + labelRadius * Math.cos(midAngle - Math.PI / 2);
            const labelY = centerY + labelRadius * Math.sin(midAngle - Math.PI / 2);
            
            const angleDegrees = (midAngle * 180 / Math.PI);
            let textAnchor = "middle";
            if (angleDegrees > 10 && angleDegrees < 170) textAnchor = "start";
            else if (angleDegrees > 190 && angleDegrees < 350) textAnchor = "end";

            const labelText = mainDataVizGroup.append("text")
                .attr("x", labelX)
                .attr("y", labelY)
                .attr("text-anchor", textAnchor)
                .attr("dominant-baseline", "middle") // Initial baseline
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${globalDimensionLabelFontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .attr("class", "label dimension-label");

            const lineHeightEm = 1.03;
            if (globalDimensionLabelNeedsWrapping) {
                wrapText(labelText, dimensionName, item.calculatedWrapWidth, lineHeightEm);
            } else {
                labelText.text(dimensionName);
            }
            
            // Adjust multi-line label vertical position to be centered around its y-coordinate
            const tspans = labelText.selectAll('tspan');
            const numberOfLines = tspans.size();
            if (numberOfLines > 1) {
                // Override dominant-baseline for multi-line to allow dy adjustments
                labelText.attr("dominant-baseline", null); 
                const firstTspan = tspans.filter((d, i) => i === 0);
                // Calculate total height of the text block (approx)
                const totalTextHeight = numberOfLines * globalDimensionLabelFontSize * lineHeightEm;
                // Shift the first tspan up by half the total height minus half of one line height
                const verticalOffset = -(totalTextHeight / 2) + (globalDimensionLabelFontSize * lineHeightEm / 2) ;
                firstTspan.attr("dy", verticalOffset + "px"); // Use px for absolute offset from original y
            }
        }
        currentAngleForData = itemEndAngle;
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Mouseover effects are handled inline with element creation.

    // Block 10: Cleanup & SVG Node Return
    return svg.node();
}