/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Bar Chart",
  "chart_name": "vertical_group_bar_chart_6",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["x", "group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");
    const groupFieldCol = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldCol?.name;
    const yFieldName = yFieldCol?.name;
    const groupFieldName = groupFieldCol?.name;

    const yFieldUnit = yFieldCol?.unit === "none" ? "" : (yFieldCol?.unit || "");

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x field" : null,
            !yFieldName ? "y field" : null,
            !groupFieldName ? "group field" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>Error: ${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: rawTypography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: rawTypography.title?.font_size || '18px',
            titleFontWeight: rawTypography.title?.font_weight || 'bold',
            labelFontFamily: rawTypography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: rawTypography.label?.font_size || '12px',
            labelFontWeight: rawTypography.label?.font_weight || 'normal',
            annotationFontFamily: rawTypography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: rawTypography.annotation?.font_size || '10px',
            annotationFontWeight: rawTypography.annotation?.font_weight || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF',
        primaryAccent: rawColors.other?.primary || '#4682B4',
        defaultCategoricalColors: d3.scaleOrdinal(d3.schemeCategory10),
        getBarColor: (groupValue) => {
            if (rawColors.field && rawColors.field[groupValue]) {
                return rawColors.field[groupValue];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                // Create a stable mapping from groupValue to available_colors index
                const groupValuesList = [...new Set(chartDataInput.map(d => d[groupFieldName]))].sort();
                const idx = groupValuesList.indexOf(groupValue);
                return rawColors.available_colors[idx % rawColors.available_colors.length];
            }
            return fillStyle.defaultCategoricalColors(groupValue);
        },
        getIconUrl: (xValue) => {
            if (rawImages.field && rawImages.field[xValue]) {
                return rawImages.field[xValue];
            }
            // No general fallback icon specified in requirements, so return null if specific not found
            return null;
        },
        axisLineColor: '#000000',
        iconCircleFill: '#FFFFFF',
        iconCircleStroke: '#DDDDDD',
    };

    function estimateTextWidth(text, fontProps) {
        const defaultFont = {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight,
        };
        const mergedProps = { ...defaultFont, ...fontProps };
        
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.visibility = 'hidden'; // Not strictly needed if not appended
        // tempSvg.style.position = 'absolute'; // Not strictly needed
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', mergedProps.fontFamily);
        textNode.setAttribute('font-size', mergedProps.fontSize);
        textNode.setAttribute('font-weight', mergedProps.fontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        
        // Some environments might require the SVG to be in the document for getBBox to work.
        // However, the prompt says "MUST NOT be appended to the document DOM".
        // We rely on getBBox working on an in-memory SVG structure.
        try {
            const width = textNode.getBBox().width;
            return width > 0 ? width : (text.length * parseInt(mergedProps.fontSize) * 0.6); // Fallback if getBBox fails
        } catch (e) {
            return text.length * parseInt(mergedProps.fontSize) * 0.6; // Fallback for errors
        }
    }
    
    const formatValue = (value) => {
        if (value == null || isNaN(value)) return "";
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More robust large number formatting
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    function wrapText(textSelection, textContent, maxWidth, lineHeightEm = 1.1) {
        textSelection.each(function() {
            const textNode = d3.select(this);
            const words = String(textContent).split(/\s+/).reverse();
            let word;
            let line = [];
            const x = textNode.attr("x") || 0;
            const initialY = textNode.attr("y") || 0;
            const initialDy = parseFloat(textNode.attr("dy") || 0);
            
            textNode.text(null); 
    
            let tspan = textNode.append("tspan").attr("x", x); // First tspan carries initial dy
            let linesArray = [];

            function newCurrentLine(txt) { linesArray.push(txt); }

            if (words.length === 1 && words[0].length > 0 && !words[0].includes(' ')) {
                const chars = words[0].split('');
                let currentSegment = "";
                for (let i = 0; i < chars.length; i++) {
                    currentSegment += chars[i];
                    tspan.text(currentSegment);
                    if (tspan.node().getComputedTextLength() > maxWidth && currentSegment.length > 1) {
                        newCurrentLine(currentSegment.slice(0, -1));
                        currentSegment = chars[i];
                    }
                }
                if (currentSegment) newCurrentLine(currentSegment);
            } else {
                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                        line.pop();
                        newCurrentLine(line.join(" "));
                        line = [word];
                    }
                }
                if (line.length > 0) newCurrentLine(line.join(" "));
            }
            
            tspan.remove(); // Clean up temp tspan

            const numLines = linesArray.length;
            const yAdjust = (-(numLines - 1) / 2) * lineHeightEm; // Vertical centering adjustment

            linesArray.forEach((lineText, i) => {
                textNode.append("tspan")
                    .attr("x", x)
                    .attr("dy", (i === 0 ? yAdjust + initialDy : lineHeightEm) + "em")
                    .text(lineText);
            });
            // If it ended up as a single line, ensure y is set correctly
            if (numLines === 1) {
                textNode.select("tspan").attr("y", initialY).attr("dy", initialDy + "em");
            } else if (numLines > 1) {
                 textNode.selectAll("tspan").attr("y", null); // Remove y if multi-line and rely on dy
            }
        });
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 80, left: 30 };
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({...d})); 

    const xValues = [...new Set(chartDataArray.map(d => d[xFieldName]))];
    const groupValues = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort(); // Sort for consistent color mapping

    if (groupValues.length !== 2 && chartDataArray.length > 0) {
         // Data doesn't meet requirement of exactly 2 groups.
         // This might lead to unexpected visual output or errors.
         // The prompt implies valid data, so we proceed.
    }
    const leftBarGroup = groupValues[0]; 
    const rightBarGroup = groupValues[1];

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.2); 

    const dataMax = d3.max(chartDataArray, d => +d[yFieldName]) || 1;
    const yScale = d3.scaleLinear()
        .domain([0, dataMax])
        .range([innerHeight, 0]);

    const xCategoryWidth = xScale.bandwidth();
    const numBarsInGroup = 2;
    const barGapRatioInGroup = 0.1; 
    const barWidth = (xCategoryWidth * (1 - barGapRatioInGroup)) / numBarsInGroup;
    const barGapInGroup = xCategoryWidth * barGapRatioInGroup;

    // Block 7: Chart Component Rendering
    mainChartGroup.append("line")
        .attr("class", "axis-line x-axis-line")
        .attr("x1", 0).attr("y1", innerHeight)
        .attr("x2", innerWidth).attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor).attr("stroke-width", 2);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    const baseXLabelFontSize = parseInt(fillStyle.typography.labelFontSize);
    let longestXLabelEstimatedWidth = 0;
    xValues.forEach(val => {
        const w = estimateTextWidth(String(val), { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: `${baseXLabelFontSize}px`, 
            fontWeight: fillStyle.typography.labelFontWeight 
        });
        if (w > longestXLabelEstimatedWidth) longestXLabelEstimatedWidth = w;
    });
    
    const xLabelMaxWidthAllowed = xScale.bandwidth() * 1.3; 
    let uniformXLabelFontSize = baseXLabelFontSize;
    if (longestXLabelEstimatedWidth > xLabelMaxWidthAllowed && longestXLabelEstimatedWidth > 0) {
        uniformXLabelFontSize = Math.max(8, baseXLabelFontSize * (xLabelMaxWidthAllowed / longestXLabelEstimatedWidth));
    }

    xAxisGroup.selectAll(".x-label")
        .data(xValues).enter()
        .append("text")
        .attr("class", "label x-label")
        .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
        .attr("y", 25) // Increased spacing for wrapped text
        .attr("dy", "0.35em") // For single line vertical centering
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", `${uniformXLabelFontSize}px`)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d)
        .each(function(d) {
            const textNode = d3.select(this);
            if (this.getComputedTextLength() > xLabelMaxWidthAllowed) {
                wrapText(textNode, String(d), xLabelMaxWidthAllowed, 1.1);
            }
        });

    const legendData = [
        { key: leftBarGroup, color: fillStyle.getBarColor(leftBarGroup) },
        { key: rightBarGroup, color: fillStyle.getBarColor(rightBarGroup) }
    ].filter(item => item.key !== undefined); // Filter out if groups are not 2

    const legendItemHeight = 15;
    const legendSpacing = 10; 
    const legendRectTextSpacing = 5;

    let legendTotalWidth = 0;
    const legendItemWidths = legendData.map(item => {
        const textWidth = estimateTextWidth(item.key, { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: '12px', 
            fontWeight: fillStyle.typography.labelFontWeight 
        });
        const itemWidth = legendItemHeight + legendRectTextSpacing + textWidth;
        legendTotalWidth += itemWidth;
        return itemWidth;
    });
    if (legendData.length > 1) legendTotalWidth += (legendData.length - 1) * legendSpacing;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(containerWidth - legendTotalWidth) / 2}, ${chartMargins.top / 2 - legendItemHeight / 2})`);

    let currentLegendX = 0;
    legendData.forEach((item, i) => {
        const legendItemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, 0)`);
        legendItemGroup.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendItemHeight).attr("height", legendItemHeight)
            .attr("fill", item.color);
        legendItemGroup.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendItemHeight + legendRectTextSpacing).attr("y", legendItemHeight / 2)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.labelFontFamily).style("font-size", "12px")
            .style("font-weight", fillStyle.typography.labelFontWeight).style("fill", fillStyle.textColor)
            .text(item.key);
        currentLegendX += legendItemWidths[i] + legendSpacing;
    });
    
    // Block 8: Main Data Visualization Rendering
    const barContainerGroups = mainChartGroup.selectAll(".bar-container-group")
        .data(xValues).enter()
        .append("g")
        .attr("class", "bar-container-group")
        .attr("transform", d => `translate(${xScale(d)}, 0)`);

    const baseValueLabelFontSize = parseInt(fillStyle.typography.labelFontSize);
    const valueLabelFontProps = {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontWeight: 'bold',
    };
    
    const valueLabelForbiddenZones = [];
    const valueLabelVerticalOffset = 5; 
    const estimatedValueLabelLineHeight = baseValueLabelFontSize * 1.2;

    chartDataArray.forEach(d => {
        const value = +d[yFieldName];
        if (isNaN(value)) return;
        const barY = yScale(value);
        valueLabelForbiddenZones.push({ 
            top: barY - valueLabelVerticalOffset - estimatedValueLabelLineHeight, 
            bottom: barY - valueLabelVerticalOffset 
        });
    });

    const iconCircleRadius = barWidth * 0.5; 
    const iconImageSize = iconCircleRadius * 1.6; 
    let globalIconYPosition = yScale(dataMax * 0.25); 
    const iconVerticalExtent = iconCircleRadius;
    
    // Simplified Icon Collision Avoidance
    let collision = false;
    const iconTopEdge = globalIconYPosition - iconVerticalExtent;
    const iconBottomEdge = globalIconYPosition + iconVerticalExtent;

    if (iconBottomEdge > innerHeight - 5) collision = true; // Too close to X-axis
    else {
        for (const zone of valueLabelForbiddenZones) {
            if (!(iconBottomEdge < zone.top || iconTopEdge > zone.bottom)) {
                collision = true; break;
            }
        }
    }
    
    if (collision) {
        const avgBarDataY = d3.mean(chartDataArray, d => yScale(+d[yFieldName])) || yScale(dataMax / 2);
        let testY = avgBarDataY - iconVerticalExtent - 5; // Try above average bar height
        
        let testCollision = false;
        const testIconTop = testY - iconVerticalExtent;
        const testIconBottom = testY + iconVerticalExtent;

        if (testIconBottom > innerHeight - 5) testCollision = true;
        else {
            for (const zone of valueLabelForbiddenZones) {
                if (!(testIconBottom < zone.top || testIconTop > zone.bottom)) {
                    testCollision = true; break;
                }
            }
        }
        if (!testCollision && testIconTop > 5) {
            globalIconYPosition = testY;
        } else {
            globalIconYPosition = innerHeight - iconVerticalExtent - 10; // Fallback near X-axis
            globalIconYPosition = Math.max(globalIconYPosition, iconVerticalExtent + 10); // Ensure not off top
        }
    }

    barContainerGroups.each(function(xValue) {
        const groupSelection = d3.select(this);
        const xCatData = chartDataArray.filter(d => d[xFieldName] === xValue);

        const leftData = xCatData.find(d => d[groupFieldName] === leftBarGroup);
        const rightData = xCatData.find(d => d[groupFieldName] === rightBarGroup);

        if (leftData) {
            const value = +leftData[yFieldName];
            const barY = yScale(value);
            const barH = innerHeight - barY;
            groupSelection.append("rect")
                .attr("class", "mark bar left-bar")
                .attr("x", 0).attr("y", barY)
                .attr("width", barWidth).attr("height", Math.max(0, barH))
                .attr("fill", fillStyle.getBarColor(leftBarGroup));

            const labelText = formatValue(value) + (yFieldUnit ? ` ${yFieldUnit}` : '');
            let actualLabelFontSize = baseValueLabelFontSize;
            let textW = estimateTextWidth(labelText, {...valueLabelFontProps, fontSize: `${actualLabelFontSize}px`});
            if (textW > barWidth * 1.05 && textW > 0) { // Allow 5% overflow
                actualLabelFontSize = Math.max(6, actualLabelFontSize * (barWidth * 1.05 / textW));
            }
            groupSelection.append("text")
                .attr("class", "label value value-label-left")
                .attr("x", barWidth / 2).attr("y", barY - valueLabelVerticalOffset)
                .attr("text-anchor", "middle")
                .style("font-family", valueLabelFontProps.fontFamily).style("font-size", `${actualLabelFontSize}px`)
                .style("font-weight", valueLabelFontProps.fontWeight).style("fill", fillStyle.textColor)
                .text(labelText);
        }

        if (rightData) {
            const value = +rightData[yFieldName];
            const barY = yScale(value);
            const barH = innerHeight - barY;
            groupSelection.append("rect")
                .attr("class", "mark bar right-bar")
                .attr("x", barWidth + barGapInGroup).attr("y", barY)
                .attr("width", barWidth).attr("height", Math.max(0, barH))
                .attr("fill", fillStyle.getBarColor(rightBarGroup));

            const labelText = formatValue(value) + (yFieldUnit ? ` ${yFieldUnit}` : '');
            let actualLabelFontSize = baseValueLabelFontSize;
            let textW = estimateTextWidth(labelText, {...valueLabelFontProps, fontSize: `${actualLabelFontSize}px`});
            if (textW > barWidth * 1.05 && textW > 0) {
                actualLabelFontSize = Math.max(6, actualLabelFontSize * (barWidth * 1.05 / textW));
            }
            groupSelection.append("text")
                .attr("class", "label value value-label-right")
                .attr("x", barWidth + barGapInGroup + barWidth / 2).attr("y", barY - valueLabelVerticalOffset)
                .attr("text-anchor", "middle")
                .style("font-family", valueLabelFontProps.fontFamily).style("font-size", `${actualLabelFontSize}px`)
                .style("font-weight", valueLabelFontProps.fontWeight).style("fill", fillStyle.textColor)
                .text(labelText);
        }

        const iconX = barWidth + barGapInGroup / 2; 
        const iconUrl = fillStyle.getIconUrl(xValue);
        if (iconUrl) {
            groupSelection.append("circle")
                .attr("class", "mark other icon-background-circle")
                .attr("cx", iconX).attr("cy", globalIconYPosition)
                .attr("r", iconCircleRadius)
                .attr("fill", fillStyle.iconCircleFill).attr("stroke", fillStyle.iconCircleStroke)
                .attr("stroke-width", 1);
            groupSelection.append("image")
                .attr("class", "icon image category-icon")
                .attr("href", iconUrl) 
                .attr("x", iconX - iconImageSize / 2).attr("y", globalIconYPosition - iconImageSize / 2)
                .attr("width", iconImageSize).attr("height", iconImageSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactoring beyond what's integrated)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}