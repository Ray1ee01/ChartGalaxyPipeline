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
    const config = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed in colors_dark
    const imagesConfig = data.images || {}; // Though not used in this specific chart type
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldDef = dataColumns.find(col => col.role === "x");
    const yFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    const xField = xFieldDef ? xFieldDef.name : undefined;
    const yField = yFieldDef ? yFieldDef.name : undefined;
    const groupField = groupFieldDef ? groupFieldDef.name : undefined;

    if (!xField || !yField || !groupField) {
        const missingFields = [
            !xField ? "x role field" : null,
            !yField ? "y role field" : null,
            !groupField ? "group role field" : null
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMessage}</div>`);
        }
        return null;
    }
    
    const chartDataArray = rawChartData.filter(d => d[xField] != null && d[yField] != null && d[groupField] != null);


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
        },
        textColor: colorsConfig.text_color || '#0f223b',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        defaultCategoryColors: colorsConfig.available_colors || ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
        barStroke: '#FFFFFF', 
        barStrokeWidth: 0.5,
        valueLabelColor: '#FFFFFF', // For text inside bars
        centerDiscFill: '#FFFFFF',
        centerDiscStroke: '#DDDDDD',
        backgroundSectorOpacity: 0.3,
        backgroundSectorStroke: '#FFFFFF',
        backgroundSectorStrokeWidth: 0.5,
    };

    function getCategoryColor(categoryName, index) {
        if (colorsConfig.field && colorsConfig.field[categoryName]) {
            return colorsConfig.field[categoryName];
        }
        return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
    }

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No need to append to DOM for getBBox if it's a simple text element in an SVG context
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might not work as expected without DOM
            const avgCharWidth = parseFloat(fontSize) * 0.6; // Rough estimate
            return text.length * avgCharWidth;
        }
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    function wrapText(d3TextSelection, text, maxWidth, lineHeightEm) {
        d3TextSelection.each(function() {
            const textElement = d3.select(this);
            const words = text.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textElement.attr("x") || 0;
            const y = textElement.attr("y") || 0;
            const dy = parseFloat(textElement.attr("dy") || 0);
            
            textElement.text(null); // Clear existing text
            let tspan = textElement.append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");

            function appendNewLine() {
                lineNumber++;
                return textElement.append("tspan").attr("x", x).attr("y", y).attr("dy", lineNumber * lineHeightEm + dy + "em");
            }

            if (words.length === 1 && words[0].length > 0) { // Single word, try character wrapping
                const chars = words[0].split('');
                let currentLine = '';
                for (let i = 0; i < chars.length; i++) {
                    currentLine += chars[i];
                    tspan.text(currentLine);
                    if (tspan.node().getComputedTextLength() > maxWidth && currentLine.length > 1) {
                        currentLine = currentLine.slice(0, -1); // remove last char
                        tspan.text(currentLine);
                        currentLine = chars[i]; // start new line with current char
                        tspan = appendNewLine().text(currentLine);
                    }
                }
            } else { // Multiple words, wrap by word
                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                        line.pop(); // remove last word
                        tspan.text(line.join(" "));
                        line = [word]; // start new line with current word
                        tspan = appendNewLine().text(word);
                    }
                }
            }
        });
    }
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 40, bottom: 80, left: 40 }; // Adjusted margins
    
    const effectiveWidth = containerWidth - chartMargins.left - chartMargins.right;
    const effectiveHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const centerX = chartMargins.left + effectiveWidth / 2;
    const centerY = chartMargins.top + effectiveHeight / 2;
    
    const radius = Math.min(effectiveWidth, effectiveHeight) / 2;
    const innerCircleRadius = radius * 0.15; // Slightly larger inner circle

    // Block 5: Data Preprocessing & Transformation
    const valueUnit = (yFieldDef && yFieldDef.unit && yFieldDef.unit !== "none") ? yFieldDef.unit : "";
    
    const uniqueGroups = [...new Set(chartDataArray.map(d => d[groupField]))];
    
    chartDataArray.sort((a, b) => {
        const groupCompare = uniqueGroups.indexOf(a[groupField]) - uniqueGroups.indexOf(b[groupField]);
        if (groupCompare !== 0) return groupCompare;
        return b[yField] - a[yField]; // Descending by value within group
    });

    const groupedData = d3.group(chartDataArray, d => d[groupField]);
    const maxValue = d3.max(chartDataArray, d => +d[yField]) || 1; // Ensure maxValue is at least 1
    
    const totalItems = chartDataArray.length;
    const anglePerItem = totalItems > 0 ? (2 * Math.PI) / totalItems : 0;

    // Block 6: Scale Definition & Configuration
    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([innerCircleRadius, radius * 0.9]); // 0.9 to leave space for labels outside bars

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const chartArea = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "chart-area");

    // Background Sectors
    let currentAngleForBackground = 0;
    uniqueGroups.forEach((groupName, groupIndex) => {
        const groupItems = groupedData.get(groupName);
        if (!groupItems || groupItems.length === 0) return;

        const groupColor = getCategoryColor(groupName, groupIndex);
        const lightGroupColor = d3.rgb(groupColor).brighter(1.5).toString();
        
        const startAngle = currentAngleForBackground;
        const endAngle = startAngle + groupItems.length * anglePerItem;
        
        const backgroundArc = d3.arc()
            .innerRadius(innerCircleRadius)
            .outerRadius(radius)
            .startAngle(startAngle)
            .endAngle(endAngle)
            .padAngle(0.001);
            
        chartArea.append("path")
            .attr("d", backgroundArc)
            .attr("fill", lightGroupColor)
            .attr("opacity", fillStyle.backgroundSectorOpacity)
            .attr("stroke", fillStyle.backgroundSectorStroke)
            .attr("stroke-width", fillStyle.backgroundSectorStrokeWidth)
            .attr("class", "mark background-sector");
            
        currentAngleForBackground = endAngle;
    });

    // Center Disc
    chartArea.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", innerCircleRadius)
        .attr("fill", fillStyle.centerDiscFill)
        .attr("stroke", fillStyle.centerDiscStroke)
        .attr("stroke-width", 0.5)
        .attr("class", "mark center-disc");

    // Legend (Simplified approach)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${containerHeight - chartMargins.bottom + 20})`);

    const legendItemWidth = effectiveWidth / uniqueGroups.length;
    const legendBarHeight = 15;
    const legendPaddingTop = 8;
    const legendNumberFontSize = parseInt(fillStyle.typography.labelFontSize);
    const legendGroupNameFontSize = parseInt(fillStyle.typography.annotationFontSize);
    const legendLineHeightEm = 1.1;

    uniqueGroups.forEach((groupName, index) => {
        const groupColor = getCategoryColor(groupName, index);
        const legendItem = legendGroup.append("g")
            .attr("transform", `translate(${index * legendItemWidth}, 0)`)
            .attr("class", "legend-item");

        legendItem.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", legendItemWidth)
            .attr("height", legendBarHeight)
            .attr("fill", groupColor)
            .attr("class", "mark legend-color-sample");

        const textStartX = 5; // Small padding from left of item
        const textAvailableWidth = legendItemWidth - 10; // Padding on both sides

        legendItem.append("text")
            .attr("x", textStartX)
            .attr("y", legendBarHeight + legendPaddingTop)
            .attr("dy", "0.71em") // Adjust for baseline
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${legendNumberFontSize}px`)
            .style("font-weight", "bold")
            .style("fill", fillStyle.textColor)
            .attr("class", "text legend-text legend-number")
            .text(index + 1);
        
        const groupNameText = legendItem.append("text")
            .attr("x", textStartX + estimateTextWidth(String(index + 1), fillStyle.typography.labelFontFamily, `${legendNumberFontSize}px`, "bold") + 5)
            .attr("y", legendBarHeight + legendPaddingTop)
            .attr("dy", "0.71em") // Adjust for baseline
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${legendGroupNameFontSize}px`)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "text legend-text legend-group-name")
            .text(groupName);
        
        if (estimateTextWidth(groupName, fillStyle.typography.annotationFontFamily, `${legendGroupNameFontSize}px`, fillStyle.typography.annotationFontWeight) > textAvailableWidth - (textStartX + estimateTextWidth(String(index + 1), fillStyle.typography.labelFontFamily, `${legendNumberFontSize}px`, "bold") + 5)) {
             wrapText(groupNameText, groupName, textAvailableWidth - (textStartX + estimateTextWidth(String(index + 1), fillStyle.typography.labelFontFamily, `${legendNumberFontSize}px`, "bold") + 5), legendLineHeightEm);
        }
    });


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    let currentAngleForItem = 0;
    const categoryLabelFontSize = parseInt(fillStyle.typography.labelFontSize);
    const categoryLabelMinFontSize = 8; // Minimum font size for category labels
    const valueLabelMaxFontSize = parseInt(fillStyle.typography.annotationFontSize);
    const valueLabelMinFontSize = 7;

    // Pre-calculate category label properties (country names)
    let globalCategoryLabelFontSize = categoryLabelFontSize;
    let needsCategoryLabelWrapping = false;

    chartDataArray.forEach(item => {
        const itemName = String(item[xField]);
        const availableAngularWidth = radius * anglePerItem * 0.9; // Space for label at radius

        let currentWidth = estimateTextWidth(itemName, fillStyle.typography.labelFontFamily, `${globalCategoryLabelFontSize}px`, fillStyle.typography.labelFontWeight);
        if (currentWidth > availableAngularWidth) {
            globalCategoryLabelFontSize = Math.max(categoryLabelMinFontSize, globalCategoryLabelFontSize -1); // Reduce size iteratively if needed
            currentWidth = estimateTextWidth(itemName, fillStyle.typography.labelFontFamily, `${globalCategoryLabelFontSize}px`, fillStyle.typography.labelFontWeight);
            if (currentWidth > availableAngularWidth) {
                 needsCategoryLabelWrapping = true;
            }
        }
    });


    chartDataArray.forEach((item, itemIndex) => {
        const groupName = item[groupField];
        const groupIndex = uniqueGroups.indexOf(groupName);
        const itemColor = getCategoryColor(groupName, groupIndex);
        
        const itemStartAngle = currentAngleForItem;
        const itemEndAngle = currentAngleForItem + anglePerItem;
        const itemRadius = radiusScale(+item[yField]);

        const barArc = d3.arc()
            .innerRadius(innerCircleRadius)
            .outerRadius(itemRadius)
            .startAngle(itemStartAngle)
            .endAngle(itemEndAngle)
            .padAngle(0.005);

        chartArea.append("path")
            .attr("d", barArc)
            .attr("fill", itemColor)
            .attr("stroke", fillStyle.barStroke)
            .attr("stroke-width", fillStyle.barStrokeWidth)
            .attr("class", "mark data-bar")
            .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
            .on("mouseout", function() { d3.select(this).attr("opacity", 1); });

        // Data Value Labels (inside bars)
        const formattedValue = `${formatValue(item[yField])}${valueUnit}`;
        let finalValueFontSize = 0;

        for (let fs = valueLabelMaxFontSize; fs >= valueLabelMinFontSize; fs--) {
            const estimatedTextHeight = fs * 1.2;
            const radialSpaceForText = itemRadius - innerCircleRadius;
            if (estimatedTextHeight > radialSpaceForText) continue;

            const textPlacementRadius = Math.max(innerCircleRadius + estimatedTextHeight / 2, itemRadius - estimatedTextHeight / 2 - 4); // 4px padding
            const angularSpaceForText = anglePerItem * textPlacementRadius * 0.9; // 0.9 for padding
            
            if (estimateTextWidth(formattedValue, fillStyle.typography.annotationFontFamily, `${fs}px`, fillStyle.typography.annotationFontWeight) < angularSpaceForText) {
                finalValueFontSize = fs;
                break;
            }
        }
        
        if (finalValueFontSize > 0) {
            const textAngle = itemStartAngle + anglePerItem / 2;
            const estimatedTextHeight = finalValueFontSize * 1.2;
            const textRadius = Math.max(innerCircleRadius + estimatedTextHeight / 2, itemRadius - estimatedTextHeight / 2 - 4);
            
            const textX = textRadius * Math.cos(textAngle - Math.PI / 2);
            const textY = textRadius * Math.sin(textAngle - Math.PI / 2);
            let textRotationDeg = (textAngle * 180 / Math.PI) - 90;
            if (textAngle > Math.PI && textAngle < 2 * Math.PI) {
                textRotationDeg += 180;
            }

            chartArea.append("text")
                .attr("x", textX)
                .attr("y", textY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("transform", `rotate(${textRotationDeg}, ${textX}, ${textY})`)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${finalValueFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.valueLabelColor)
                .attr("class", "text value-label")
                .text(formattedValue);
        }

        // Category Labels (e.g., country names, outside circle)
        const itemName = String(item[xField]);
        const midAngle = itemStartAngle + anglePerItem / 2;
        const labelRadius = radius * 1.03; // Position labels slightly outside the main radius
        
        const labelX = labelRadius * Math.cos(midAngle - Math.PI / 2);
        const labelY = labelRadius * Math.sin(midAngle - Math.PI / 2);
        
        const angleDegrees = (midAngle * 180 / Math.PI);
        let textAnchor = "middle";
        if (angleDegrees > 10 && angleDegrees < 170) textAnchor = "start"; // Right hemisphere
        else if (angleDegrees > 190 && angleDegrees < 350) textAnchor = "end"; // Left hemisphere
        
        const categoryLabelElement = chartArea.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", textAnchor)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${globalCategoryLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "text category-label")
            .text(itemName);

        if (needsCategoryLabelWrapping) {
            const wrapWidth = radius * anglePerItem * 0.9; // Available width for wrapping
             wrapText(categoryLabelElement, itemName, wrapWidth, 1.03);
             // Adjust multi-line label vertical position for better centering
             const tspans = categoryLabelElement.selectAll('tspan');
             const numberOfLines = tspans.size();
             if (numberOfLines > 1) {
                 categoryLabelElement.attr("dy", `-${(numberOfLines - 1) * 0.5 * 1.03}em`);
             }
        }
        
        currentAngleForItem = itemEndAngle;
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (Hover effects are handled inline with bar creation)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}