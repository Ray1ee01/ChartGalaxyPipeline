/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_group_bar_chart_12",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 10]],
  "required_fields_icons": ["x"],
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
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal grouped bar chart.
    // It adheres to specific styling and structural directives.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const dimensionFieldConfig = dataColumns.find(col => col.role === xFieldRole);
    const valueFieldConfig = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldConfig = dataColumns.find(col => col.role === groupFieldRole);

    let missingFields = [];
    if (!dimensionFieldConfig) missingFields.push(xFieldRole + " role field");
    if (!valueFieldConfig) missingFields.push(yFieldRole + " role field");
    if (!groupFieldConfig) missingFields.push(groupFieldRole + " role field");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionFieldName = dimensionFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    const valueFieldUnit = valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'normal',
        },
        textColor: rawColors.text_color || '#0f223b',
        chartBackground: rawColors.background_color || '#FFFFFF',
        primaryAccent: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#1f77b4',
        defaultCategoryColors: d3.schemeCategory10,
    };

    function getGroupColor(groupName, groupIndex) {
        if (rawColors.field && rawColors.field[groupFieldName] && rawColors.field[groupFieldName][groupName]) {
            return rawColors.field[groupFieldName][groupName];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[groupIndex % rawColors.available_colors.length];
        }
        return fillStyle.defaultCategoryColors[groupIndex % fillStyle.defaultCategoryColors.length];
    }

    function getDimensionIconUrl(dimensionName) {
        if (rawImages.field && rawImages.field[dimensionFieldName] && rawImages.field[dimensionFieldName][dimensionName]) {
            return rawImages.field[dimensionFieldName][dimensionName];
        }
        // Fallback to a generic icon if specified in `rawImages.other.primary` for icons, though not typical for field-specific icons
        // if (rawImages.other && rawImages.other.primary) return rawImages.other.primary;
        return null;
    }
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No need to append to DOM for getBBox to work on 'text' element
        const width = tempText.getBBox().width;
        return width;
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    function wrapText(textSelection, textContent, maxWidth, lineHeightEm) {
        textSelection.each(function() {
            const textD3 = d3.select(this);
            const words = textContent.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textD3.attr("x") || 0;
            const y = textD3.attr("y") || 0;
            let dy = parseFloat(textD3.attr("dy") || 0);
            
            textD3.text(null);
            let tspan = textD3.append("tspan").attr("x", x).attr("dy", dy + "em");

            let tempLines = [];
            if (words.length > 1 && words.some(w => w.length > 0)) {
                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                        line.pop();
                        tempLines.push(line.join(" "));
                        line = [word];
                    }
                }
                tempLines.push(line.join(" "));
            } else { // Single word or character wrapping
                const chars = textContent.split('');
                let currentLine = '';
                for (let i = 0; i < chars.length; i++) {
                    const nextLine = currentLine + chars[i];
                    tspan.text(nextLine);
                    if (tspan.node().getComputedTextLength() > maxWidth && currentLine.length > 0) {
                        tempLines.push(currentLine);
                        currentLine = chars[i];
                    } else {
                        currentLine = nextLine;
                    }
                }
                if (currentLine.length > 0) tempLines.push(currentLine);
            }
            
            textD3.text(null); // Clear again before adding final tspans
            const totalLines = tempLines.length;
            const firstLineYAdjust = - (totalLines - 1) / 2 * lineHeightEm;

            tempLines.forEach((lineText, i) => {
                textD3.append("tspan")
                    .attr("x", x)
                    .attr("dy", (i === 0 ? firstLineYAdjust + dy : lineHeightEm) + "em")
                    .text(lineText);
            });
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
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 30, // Reduced top margin as no main title
        right: 80, // For value labels
        bottom: 80, // For legend
        left: 150  // Initial, will be adjusted
    };

    const dimensions = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];

    let maxDimensionLabelWidth = 0;
    dimensions.forEach(dim => {
        const width = estimateTextWidth(dim, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (width > maxDimensionLabelWidth) maxDimensionLabelWidth = width;
    });
    
    // Icon size calculation (dependent on barHeight, which depends on innerHeight, which depends on margin.left)
    // This creates a circular dependency if icon size affects margin.left.
    // For now, assume a fixed icon size or calculate it after barHeight is known.
    // Let's use a provisional icon width for margin calculation.
    const provisionalIconWidth = parseFloat(fillStyle.typography.labelFontSize) * 1.5; // Approx icon size
    const iconRightPaddingToText = 5;
    const textRightPaddingToAxis = 15;
    
    chartMargins.left = Math.max(chartMargins.left, maxDimensionLabelWidth + provisionalIconWidth + iconRightPaddingToText + textRightPaddingToAxis);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const groupHeight = innerHeight / groups.length;
    const barHeight = groupHeight / dimensions.length; 
    const actualBarHeight = barHeight * 0.75; 

    const iconWidth = actualBarHeight * 0.9;
    const iconHeight = iconWidth;
    const iconRightPaddingToBar = iconWidth * 0.4;


    // Block 5: Data Preprocessing & Transformation
    // Data is mostly pre-processed by grouping for rendering.
    // Max value for scale domain:
    const maxValue = d3.max(chartData, d => +d[valueFieldName]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue * 1.1 : 1]) // Add 10% padding, handle all-zero case
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend");
    
    const legendItemHeight = 20; // Height of the color swatch area
    const legendPaddingTop = 8; // Padding above legend text
    const legendSwatchSize = 15;
    const legendSwatchTextGap = 5;
    const legendItemSpacing = 10; // Horizontal spacing between legend items

    let legendCurrentX = 0;
    const legendItems = [];

    groups.forEach((group, i) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item");

        itemGroup.append("rect")
            .attr("class", "mark")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", legendSwatchSize)
            .attr("height", legendSwatchSize)
            .style("fill", getGroupColor(group, i));

        const legendText = itemGroup.append("text")
            .attr("class", "label")
            .attr("x", legendSwatchSize + legendSwatchTextGap)
            .attr("y", legendSwatchSize / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);
        
        const itemWidth = legendSwatchSize + legendSwatchTextGap + legendText.node().getBBox().width;
        legendItems.push({element: itemGroup, width: itemWidth});
    });

    // Position legend items
    let totalLegendWidth = 0;
    legendItems.forEach((item, i) => {
        item.element.attr("transform", `translate(${legendCurrentX}, 0)`);
        legendCurrentX += item.width + legendItemSpacing;
        if (i < legendItems.length -1) { // Add spacing for all but last item
             totalLegendWidth += item.width + legendItemSpacing;
        } else {
             totalLegendWidth += item.width;
        }
    });
    
    const legendStartX = (containerWidth - totalLegendWidth) / 2;
    const legendStartY = containerHeight - chartMargins.bottom / 2 - legendItemHeight / 2; // Center in bottom margin
    legendGroup.attr("transform", `translate(${legendStartX}, ${legendStartY})`);


    // Block 8: Main Data Visualization Rendering
    groups.forEach((group, groupIndex) => {
        const groupData = chartData.filter(d => d[groupFieldName] === group);
        const groupColor = getGroupColor(group, groupIndex);
        const groupElement = mainChartGroup.append("g")
            .attr("class", `chart-group group-${groupIndex}`);

        dimensions.forEach((dimension, dimIndex) => {
            const dataPoint = groupData.find(d => d[dimensionFieldName] === dimension);
            if (dataPoint) {
                const barY = groupIndex * groupHeight + dimIndex * barHeight + (barHeight - actualBarHeight) / 2;
                const barWidthValue = +dataPoint[valueFieldName];
                const barRenderWidth = xScale(barWidthValue > 0 ? barWidthValue : 0);

                const itemGroup = groupElement.append("g")
                    .attr("class", "chart-item");

                // Dimension Label and Icon Group (positioned to the left of y-axis origin)
                const labelAndIconGroup = itemGroup.append("g")
                    .attr("class", "dimension-label-group")
                    .attr("transform", `translate(0, ${barY + actualBarHeight / 2})`);

                const iconUrl = getDimensionIconUrl(dimension);
                let currentLabelX = -textRightPaddingToAxis; // Start position for text (right edge)

                if (iconUrl) {
                    labelAndIconGroup.append("image")
                        .attr("class", "icon")
                        .attr("xlink:href", iconUrl)
                        .attr("x", -(iconWidth + iconRightPaddingToText + maxDimensionLabelWidth)) // Position icon to the far left
                        .attr("y", -iconHeight / 2)
                        .attr("width", iconWidth)
                        .attr("height", iconHeight)
                        .attr("preserveAspectRatio", "xMidYMid meet");
                    currentLabelX = -(iconWidth + iconRightPaddingToText); // Adjust text position if icon present
                }
                
                labelAndIconGroup.append("text")
                    .attr("class", "label dimension-label")
                    .attr("x", currentLabelX)
                    .attr("y", 0)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(dimension);

                // Bar
                itemGroup.append("rect")
                    .attr("class", "mark bar")
                    .attr("x", 0)
                    .attr("y", barY)
                    .attr("width", barRenderWidth)
                    .attr("height", actualBarHeight)
                    .style("fill", groupColor);

                // Value Label
                const formattedValue = valueFieldUnit ? 
                    `${formatValue(barWidthValue)}${valueFieldUnit}` : 
                    `${formatValue(barWidthValue)}`;
                
                const valueLabelFontSizePx = parseFloat(fillStyle.typography.annotationFontSize);
                const dynamicFontSize = Math.min(valueLabelFontSizePx, actualBarHeight * 0.7); // Ensure fits bar height

                itemGroup.append("text")
                    .attr("class", "value value-label")
                    .attr("x", barRenderWidth + 5) // Padding from bar end
                    .attr("y", barY + actualBarHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${dynamicFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formattedValue);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Example: Mouseover effects (simplified)
    mainChartGroup.selectAll(".mark.bar")
        .on("mouseover", function() {
            d3.select(this).style("opacity", 0.8);
        })
        .on("mouseout", function() {
            d3.select(this).style("opacity", 1);
        });
    
    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}