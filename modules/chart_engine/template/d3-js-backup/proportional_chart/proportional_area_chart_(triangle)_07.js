/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Triangle)",
  "chart_name": "proportional_area_chart_triangle_07",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[8, 20], [0, "inf"], [2, 8]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); 

    const xFieldDef = dataColumns.find(col => col.role === "x");
    const yFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldDef?.name;
    const yFieldName = yFieldDef?.name;
    const groupFieldName = groupFieldDef?.name;

    const yFieldUnit = yFieldDef && yFieldDef.unit !== "none" ? yFieldDef.unit : "";

    if (!xFieldName || !yFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push("x role field");
        if (!yFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    let chartDataArray = chartDataInput.filter(d => d[yFieldName] != null && +d[yFieldName] > 0);
    if (chartDataArray.length === 0) {
        d3.select(containerSelector).html("<div style='padding:10px;'>No valid data points to render.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: colors.other?.primary || '#1f77b4',
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#000000',
        textColorLight: '#FFFFFF',
        labelBackgroundColor: 'rgba(255, 255, 255, 0.9)',
        labelBorderColor: '#CCCCCC',
        groupColors: {},
        defaultCategoryColor: '#CCCCCC',
        availableColors: colors.available_colors || d3.schemeCategory10,
        typography: {
            titleFontFamily: typography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typography.title?.font_size || '16px',
            titleFontWeight: typography.title?.font_weight || 'bold',
            labelFontFamily: typography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typography.label?.font_size || '12px',
            labelFontWeight: typography.label?.font_weight || 'normal',
            annotationFontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typography.annotation?.font_size || '10px',
            annotationFontWeight: typography.annotation?.font_weight || 'normal',
        }
    };
    
    if (groupFieldName) {
        const uniqueGroupValues = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
        uniqueGroupValues.forEach((groupVal, i) => {
            fillStyle.groupColors[groupVal] = (colors.field && colors.field[groupVal]) 
                ? colors.field[groupVal] 
                : fillStyle.availableColors[i % fillStyle.availableColors.length];
        });
    }

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            const approxCharWidth = parseFloat(fontSize) * 0.6;
            width = text.length * approxCharWidth;
            console.warn("estimateTextWidth: getBBox failed. Using approximate width.", e);
        }
        return width;
    }

    function formatNumber(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return num.toString();
    }

    function splitTextIntoLines(text, fontFamily, fontSizeStr, maxWidth, fontWeight) {
        if (!text || maxWidth <=0) return [String(text)]; // Return original if no space or no text
        const S = String(text);
        const lines = [];
        
        // Try splitting by words first
        const words = S.split(/\s+/);
        let currentLine = "";

        if (words.length > 1) { // Process word by word if there are spaces
            currentLine = words[0];
            for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + " " + words[i];
                if (estimateTextWidth(testLine, fontFamily, fontSizeStr, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = words[i];
                }
            }
            lines.push(currentLine); // Push the last line
        } else { // No spaces or single word, try character by character
            currentLine = "";
            for (let i = 0; i < S.length; i++) {
                const char = S[i];
                const testLine = currentLine + char;
                if (estimateTextWidth(testLine, fontFamily, fontSizeStr, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    if (currentLine) lines.push(currentLine); // Push previous fit
                    currentLine = char; // Start new line with current char
                    if (estimateTextWidth(currentLine, fontFamily, fontSizeStr, fontWeight) > maxWidth) { // Single char too wide
                        lines.push(currentLine.substring(0,1)); // Push first char of it
                        currentLine = ""; // Reset
                        break; // Cannot fit more
                    }
                }
            }
            if (currentLine) lines.push(currentLine);
        }
        
        if (lines.length === 0 && S) { // If still no lines (e.g. single very long word not broken by char logic)
             let tempLine = S;
             while(tempLine.length > 1 && estimateTextWidth(tempLine + "...", fontFamily, fontSizeStr, fontWeight) > maxWidth) {
                 tempLine = tempLine.slice(0, -1);
             }
             return [tempLine + (tempLine.length < S.length ? "..." : "")];
        }
        return lines.map(l => l.trim()).filter(l => l.length > 0);
    }


    function createEquilateralTrianglePath(side) {
        const h = side * Math.sqrt(3) / 2;
        const topPoint = [0, -h * 2/3];
        const leftPoint = [-side/2, h * 1/3];
        const rightPoint = [side/2, h * 1/3];
        return `M ${topPoint[0]},${topPoint[1]} L ${leftPoint[0]},${leftPoint[1]} L ${rightPoint[0]},${rightPoint[1]} Z`;
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
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = { top: variables.margin_top ?? 40, right: variables.margin_right ?? 20, bottom: variables.margin_bottom ?? 40, left: variables.margin_left ?? 20 };

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const minRadius = variables.min_radius || 20; 
    const maxRadius = variables.max_radius || 80;
    const iconSize = variables.icon_size || 32;

    const arrangeTrianglesLayout = (nodes, availableWidth, startY, verticalItemPadding, horizontalItemPadding) => {
        let x = 0;
        let y = startY;
        let rowHeight = 0;
        let currentRowNodes = [];
        const rows = [];
        
        nodes.forEach(node => {
            const nodeDisplayWidth = node.triangleSide + horizontalItemPadding;

            if (x + node.triangleSide > availableWidth && currentRowNodes.length > 0) {
                rows.push({ yPos: y, height: rowHeight, nodes: currentRowNodes });
                x = 0;
                y += rowHeight + verticalItemPadding;
                rowHeight = 0;
                currentRowNodes = [];
            }
            
            node.layoutX = x + node.triangleSide / 2;
            node.layoutY = y + node.triangleHeight; 
            
            rowHeight = Math.max(rowHeight, node.triangleHeight);
            x += nodeDisplayWidth;
            currentRowNodes.push(node);
        });
        
        if (currentRowNodes.length > 0) {
            rows.push({ yPos: y, height: rowHeight, nodes: currentRowNodes });
        }
        return { rows };
    };
    
    // Block 5: Data Preprocessing & Transformation
    const yValues = chartDataArray.map(d => +d[yFieldName]);
    const minValue = d3.min(yValues) ?? 0; // Use ?? to handle empty yValues if filter somehow fails
    const maxValue = d3.max(yValues) ?? (minValue > 0 ? minValue : 1);


    const nodes = chartDataArray.map((d, i) => {
        const value = +d[yFieldName];
        const xVal = d[xFieldName] != null ? String(d[xFieldName]) : `__${i}__`;
        const groupVal = groupFieldName ? d[groupFieldName] : null;
        
        const currentRadius = (minValue === maxValue || maxValue - minValue === 0) ? minRadius : 
            minRadius + ( (value - minValue) / (maxValue - minValue) * (maxRadius - minRadius) );

        const triangleSide = currentRadius * 2; // 'currentRadius' is treated as half-side
        const triangleHeight = triangleSide * Math.sqrt(3) / 2;

        return {
            id: xVal,
            value: value,
            nodeRadius: currentRadius, 
            triangleSide: triangleSide,
            triangleHeight: triangleHeight,
            color: groupFieldName && groupVal ? fillStyle.groupColors[groupVal] : fillStyle.primaryColor,
            group: groupVal,
            iconUrl: images.field && images.field[xVal] ? images.field[xVal] : (images.other?.primary || null),
            rawData: d,
        };
    }).sort((a, b) => b.nodeRadius - a.nodeRadius);

    // Block 6: Scale Definition & Configuration
    // Scales are effectively incorporated in data mapping and fillStyle.

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    // Block 7: Chart Component Rendering (Legend)
    let legendHeight = 0;
    const legendItemMinHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.5;
    const legendPadding = 8;

    if (groupFieldName && Object.keys(fillStyle.groupColors).length > 0) {
        const legendGroup = mainChartGroup.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(0, ${legendPadding})`);

        const groupTitleText = groupFieldDef?.title || groupFieldName;
        const legendTitle = legendGroup.append("text")
            .attr("class", "label legend-title")
            .attr("x", 0)
            .attr("y", 0)
            .attr("dominant-baseline", "hanging")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", "bold")
            .style("fill", fillStyle.textColor)
            .text(groupTitleText);
        
        const legendTitleWidth = estimateTextWidth(groupTitleText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, "bold");
        let currentX = legendTitleWidth > 0 ? legendTitleWidth + 10 : 0;
        let currentY = 0;

        const legendRectSize = parseFloat(fillStyle.typography.labelFontSize);
        const legendSpacing = parseFloat(fillStyle.typography.labelFontSize) * 0.5;

        const groupValues = Object.keys(fillStyle.groupColors).sort();

        groupValues.forEach(groupValue => {
            const itemText = String(groupValue);
            const itemTextWidth = estimateTextWidth(itemText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            const itemWidth = legendRectSize + 5 + itemTextWidth;

            if (currentX + itemWidth > innerWidth && currentX > (legendTitleWidth > 0 ? legendTitleWidth + 10 : 0) ) {
                currentX = 0; 
                currentY += legendItemMinHeight;
            }
            
            const gItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${currentY})`);

            gItem.append("rect")
                .attr("class", "mark legend-mark")
                .attr("x", 0)
                .attr("y", (legendItemMinHeight - legendRectSize) / 2 - parseFloat(fillStyle.typography.labelFontSize)*0.1) // Adjust for better visual centering
                .attr("width", legendRectSize)
                .attr("height", legendRectSize)
                .style("fill", fillStyle.groupColors[groupValue]);

            gItem.append("text")
                .attr("class", "label legend-text")
                .attr("x", legendRectSize + 5)
                .attr("y", legendItemMinHeight / 2) 
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(itemText);
            
            currentX += itemWidth + legendSpacing;
        });
        legendHeight = currentY + legendItemMinHeight + legendPadding; 
    }

    // Block 8: Main Data Visualization Rendering
    const trianglesStartY = legendHeight;
    const triangleHorizontalPadding = (variables.triangle_horizontal_padding || 35) + iconSize;
    const triangleVerticalPadding = variables.triangle_vertical_padding || 20;

    arrangeTrianglesLayout(nodes, innerWidth, 0, triangleVerticalPadding, triangleHorizontalPadding);

    const allTrianglesGroup = mainChartGroup.append("g")
        .attr("class", "triangles-container")
        .attr("transform", `translate(0, ${trianglesStartY})`);

    const nodeGroups = allTrianglesGroup.selectAll("g.node-group")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", "mark node-group")
        .attr("transform", d => `translate(${d.layoutX}, ${d.layoutY - d.triangleHeight * 1/3})`);

    nodeGroups.each(function(d) {
        const groupElement = d3.select(this);
        const formattedValue = formatNumber(d.value);
        const valueText = `${formattedValue}${yFieldUnit ? ' ' + yFieldUnit : ''}`;
        const categoryText = d.id.startsWith("__") ? "" : d.id;

        groupElement.append("path")
            .attr("class", "mark triangle")
            .attr("d", createEquilateralTrianglePath(d.triangleSide))
            .style("fill", d.color)
            .style("stroke", fillStyle.chartBackground)
            .style("stroke-width", 1.5);

        const isLargeTriangle = d.triangleSide >= (variables.large_triangle_threshold_side || 80);
        
        const catLabelFF = fillStyle.typography.labelFontFamily;
        const catLabelFS = fillStyle.typography.labelFontSize;
        const catLabelFW = fillStyle.typography.labelFontWeight;
        const valLabelFF = fillStyle.typography.annotationFontFamily;
        const valLabelFS = fillStyle.typography.annotationFontSize;
        const valLabelFW = fillStyle.typography.annotationFontWeight;
        
        const labelBoxPadding = 5;
        const labelLineHeightFactor = 1.2;
        const labelIconSpacing = 5;

        if (isLargeTriangle) {
            const innerValueY = d.triangleHeight * 1/3 - parseFloat(valLabelFS) - 5;
            let valueLabelWidth = estimateTextWidth(valueText, valLabelFF, valLabelFS, valLabelFW);
            let actualValFS = valLabelFS;
            if (valueLabelWidth > d.triangleSide * 0.8 && d.triangleSide > 0) {
                 let newSize = parseFloat(valLabelFS) * (d.triangleSide * 0.8 / valueLabelWidth);
                 actualValFS = `${Math.max(8, Math.floor(newSize))}px`;
            }

            groupElement.append("text")
                .attr("class", "label value-label inner-label")
                .attr("text-anchor", "middle").attr("dominant-baseline", "middle").attr("y", innerValueY)
                .style("font-family", valLabelFF).style("font-size", actualValFS)
                .style("font-weight", valLabelFW).style("fill", fillStyle.textColorLight)
                .text(valueText);

            const categoryLabelY = -d.triangleHeight * 2/3 - 10;
            const maxCatLabelWidth = Math.max(d.triangleSide, 120);
            
            const lines = splitTextIntoLines(categoryText, catLabelFF, catLabelFS, maxCatLabelWidth - (d.iconUrl ? iconSize + labelIconSpacing : 0), catLabelFW);
            const lineHeight = parseFloat(catLabelFS) * labelLineHeightFactor;
            const totalTextHeight = lines.length * lineHeight - (lines.length > 0 ? (lineHeight * (labelLineHeightFactor-1)) : 0);

            let textBlockWidth = 0;
            lines.forEach(line => textBlockWidth = Math.max(textBlockWidth, estimateTextWidth(line, catLabelFF, catLabelFS, catLabelFW)));
            const labelBoxWidth = Math.min(maxCatLabelWidth, textBlockWidth + (d.iconUrl ? iconSize + labelIconSpacing : 0) + 2 * labelBoxPadding);
            const labelBoxHeight = totalTextHeight + 2 * labelBoxPadding;
            
            const labelGroup = groupElement.append("g").attr("class", "label-group category-label-group-outer")
                .attr("transform", `translate(0, ${categoryLabelY - labelBoxHeight / 2})`);

            labelGroup.append("rect").attr("class", "label-background")
                .attr("x", -labelBoxWidth / 2).attr("y", 0).attr("width", labelBoxWidth).attr("height", labelBoxHeight)
                .attr("rx", 3).attr("ry", 3).style("fill", fillStyle.labelBackgroundColor)
                .style("stroke", fillStyle.labelBorderColor).style("stroke-width", 0.5);

            let textStartX = -labelBoxWidth / 2 + labelBoxPadding;
            let textAnchor = "middle";
            let actualTextX = 0;

            if (d.iconUrl) {
                labelGroup.append("image").attr("class", "icon category-icon").attr("xlink:href", d.iconUrl)
                    .attr("x", textStartX).attr("y", (labelBoxHeight - iconSize) / 2)
                    .attr("width", iconSize).attr("height", iconSize);
                actualTextX = textStartX + iconSize + labelIconSpacing;
                textAnchor = "start";
            } else {
                 actualTextX = 0; // Centered if no icon
                 textAnchor = "middle";
            }
            
            lines.forEach((line, i) => {
                labelGroup.append("text").attr("class", "label category-label")
                    .attr("text-anchor", textAnchor).attr("dominant-baseline", "hanging")
                    .attr("x", actualTextX).attr("y", labelBoxPadding + i * lineHeight)
                    .style("font-family", catLabelFF).style("font-size", catLabelFS)
                    .style("font-weight", catLabelFW).style("fill", fillStyle.textColor).text(line);
            });

        } else { 
            const combinedLabelY = -d.triangleHeight * 2/3 - 10;
            const maxCombinedLabelWidth = Math.max(d.triangleSide * 1.5, 100);

            const catLines = splitTextIntoLines(categoryText, catLabelFF, catLabelFS, maxCombinedLabelWidth - (d.iconUrl ? iconSize + labelIconSpacing : 0), catLabelFW);
            const catLineHeight = parseFloat(catLabelFS) * labelLineHeightFactor;
            const totalCatTextHeight = catLines.length * catLineHeight - (catLines.length > 0 ? (catLineHeight * (labelLineHeightFactor-1)) : 0);

            const valLines = splitTextIntoLines(valueText, valLabelFF, valLabelFS, maxCombinedLabelWidth, valLabelFW);
            const valLineHeight = parseFloat(valLabelFS) * labelLineHeightFactor;
            const totalValTextHeight = valLines.length * valLineHeight - (valLines.length > 0 ? (valLineHeight * (labelLineHeightFactor-1)) : 0);
            
            const totalTextHeight = totalCatTextHeight + totalValTextHeight + (catLines.length > 0 && valLines.length > 0 ? 2 : 0);

            let catMaxWidth = 0;
            catLines.forEach(l => catMaxWidth = Math.max(catMaxWidth, estimateTextWidth(l, catLabelFF, catLabelFS, catLabelFW)));
            if (d.iconUrl && catLines.length > 0) catMaxWidth += iconSize + labelIconSpacing;
            let valMaxWidth = 0;
            valLines.forEach(l => valMaxWidth = Math.max(valMaxWidth, estimateTextWidth(l, valLabelFF, valLabelFS, valLabelFW)));
            const requiredTextWidth = Math.max(catMaxWidth, valMaxWidth);

            const labelBoxWidth = Math.min(maxCombinedLabelWidth, requiredTextWidth + 2 * labelBoxPadding);
            const labelBoxHeight = totalTextHeight + 2 * labelBoxPadding;

            const labelGroup = groupElement.append("g").attr("class", "label-group combined-label-group-outer")
                .attr("transform", `translate(0, ${combinedLabelY - labelBoxHeight / 2})`);

            labelGroup.append("rect").attr("class", "label-background")
                .attr("x", -labelBoxWidth / 2).attr("y", 0).attr("width", labelBoxWidth).attr("height", labelBoxHeight)
                .attr("rx", 3).attr("ry", 3).style("fill", fillStyle.labelBackgroundColor)
                .style("stroke", fillStyle.labelBorderColor).style("stroke-width", 0.5);

            let currentTextY = labelBoxPadding;
            let catTextAnchor = "middle";
            let catTextX = 0;

            if (d.iconUrl && catLines.length > 0) {
                const iconX = -labelBoxWidth / 2 + labelBoxPadding;
                labelGroup.append("image").attr("class", "icon category-icon").attr("xlink:href", d.iconUrl)
                    .attr("x", iconX).attr("y", currentTextY + (totalCatTextHeight - iconSize) / 2)
                    .attr("width", iconSize).attr("height", iconSize);
                catTextX = iconX + iconSize + labelIconSpacing;
                catTextAnchor = "start";
            }
            
            catLines.forEach((line, i) => {
                labelGroup.append("text").attr("class", "label category-label")
                    .attr("text-anchor", catTextAnchor).attr("dominant-baseline", "hanging")
                    .attr("x", catTextX).attr("y", currentTextY + i * catLineHeight)
                    .style("font-family", catLabelFF).style("font-size", catLabelFS)
                    .style("font-weight", catLabelFW).style("fill", fillStyle.textColor).text(line);
            });
            currentTextY += totalCatTextHeight + (catLines.length > 0 && valLines.length > 0 ? 2 : 0);

            valLines.forEach((line, i) => {
                labelGroup.append("text").attr("class", "label value-label")
                    .attr("text-anchor", "middle").attr("dominant-baseline", "hanging").attr("x", 0)
                    .attr("y", currentTextY + i * valLineHeight)
                    .style("font-family", valLabelFF).style("font-size", valLabelFS)
                    .style("font-weight", valLabelFW).style("fill", fillStyle.textColor).text(line);
            });
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // None

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}