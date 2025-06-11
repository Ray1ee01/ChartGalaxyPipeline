/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Bar Chart",
  "chart_name": "vertical_grouped_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
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
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear container

    const getField = (role) => dataColumns.find(col => col.role === role);
    const getFieldName = (role) => getField(role)?.name;
    const getFieldUnit = (role) => {
        const unit = getField(role)?.unit;
        return unit === "none" || !unit ? "" : unit;
    };

    const categoryFieldName = getFieldName("x");
    const valueFieldName = getFieldName("y");
    const groupFieldName = getFieldName("group");

    const valueFieldUnit = getFieldUnit("y");

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push("x field (category)");
        if (!valueFieldName) missingFields.push("y field (value)");
        if (!groupFieldName) missingFields.push("group field");
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            axisLabelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            axisLabelFontSize: typographyConfig.label?.font_size || '12px',
            axisLabelFontWeight: typographyConfig.label?.font_weight || 'normal',
            dataLabelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            dataLabelBaseFontSize: typographyConfig.label?.font_size || '12px', 
            dataLabelFontWeight: typographyConfig.label?.font_weight || 'bold',
            legendLabelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            legendLabelFontSize: typographyConfig.label?.font_size || '12px',
            legendLabelFontWeight: typographyConfig.label?.font_weight || 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        dataLabelColorInsideBar: '#FFFFFF',
        dataLabelColorOutsideBar: colorsConfig.text_color || '#333333',
        defaultBarColors: d3.schemeCategory10, 
        images: imagesConfig.field || {},
        otherImages: imagesConfig.other || {}
    };

    fillStyle.getBarColor = (groupValue, groupIndex) => {
        if (colorsConfig.field && colorsConfig.field[groupValue]) {
            return colorsConfig.field[groupValue];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[groupIndex % colorsConfig.available_colors.length];
        }
        return fillStyle.defaultBarColors[groupIndex % fillStyle.defaultBarColors.length];
    };
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight = 'normal') {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        const width = tempText.getBBox().width;
        return width;
    }

    function wrapText(textSelection, textContent, maxWidth, lineHeightEm = 1.1) {
        textSelection.each(function() {
            const textEl = d3.select(this);
            const words = String(textContent).split(/\s+/).filter(w => w.length > 0).reverse();
            let word;
            let line = [];
            const x = textEl.attr("x"); 
            textEl.text(null); 
    
            const linesArray = [];
            let currentLineForMeasure = "";

            if (words.length === 0 && String(textContent).length > 0) { 
                 words.push(String(textContent)); 
            } else if (words.length === 0 && String(textContent).length === 0) {
                return; 
            }

            const textStyle = {
                fontFamily: textEl.style("font-family"),
                fontSize: textEl.style("font-size"),
                fontWeight: textEl.style("font-weight")
            };

            if (words.length === 1 && estimateTextWidth(words[0], textStyle.fontFamily, textStyle.fontSize, textStyle.fontWeight) > maxWidth) { 
                const chars = words[0].split('');
                let currentSegment = "";
                for (let i = 0; i < chars.length; i++) {
                    currentSegment += chars[i];
                    if (estimateTextWidth(currentSegment, textStyle.fontFamily, textStyle.fontSize, textStyle.fontWeight) > maxWidth && currentSegment.length > 1) {
                        linesArray.push(currentSegment.slice(0, -1));
                        currentSegment = chars[i];
                    }
                }
                if (currentSegment) linesArray.push(currentSegment);
            } else { 
                while (word = words.pop()) {
                    line.push(word);
                    currentLineForMeasure = line.join(" ");
                    if (estimateTextWidth(currentLineForMeasure, textStyle.fontFamily, textStyle.fontSize, textStyle.fontWeight) > maxWidth && line.length > 1) {
                        line.pop(); 
                        linesArray.push(line.join(" "));
                        line = [word]; 
                    }
                }
                if (line.length > 0) linesArray.push(line.join(" "));
            }
            
            const numLines = linesArray.length;
            // Adjust dy for the first tspan to center the block vertically if dominant-baseline is middle
            const yShift = -((numLines - 1) * lineHeightEm) / 2; 

            linesArray.forEach((lineText, i) => {
                textEl.append("tspan")
                    .attr("x", x)
                    .attr("dy", i === 0 ? `${yShift}em` : `${lineHeightEm}em`)
                    .text(lineText);
            });
        });
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: Math.max(60, containerHeight * 0.15), // Adjusted top margin for legend/icons
        right: 30,
        bottom: Math.max(60, containerHeight * 0.15), // Adjusted bottom margin for x-axis labels
        left: 30
    };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const xCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    let groupCategories = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    if (groupCategories.length !== 2) {
        const errorMsg = `Chart requires exactly 2 groups. Found ${groupCategories.length}: ${groupCategories.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }
    groupCategories.sort(); // Sort for consistent order
    const leftBarGroupCategory = groupCategories[0];
    const rightBarGroupCategory = groupCategories[1];

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xCategories)
        .range([0, innerWidth])
        .padding(0.2); 

    const groupPaddingBetweenBars = 0.1; 
    const numBarsPerGroup = 2;
    const barWidth = (xScale.bandwidth() * (1 - groupPaddingBetweenBars)) / numBarsPerGroup;
    
    const yMax = d3.max(chartDataArray, d => +d[valueFieldName]);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 100])
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    const baseAxisLabelFontSize = parseFloat(fillStyle.typography.axisLabelFontSize);
    let finalAxisLabelFontSize = baseAxisLabelFontSize;
    
    if (xCategories.length > 0) {
        const longestXLabel = xCategories.reduce((a, b) => String(a).length > String(b).length ? String(a) : String(b), "");
        const labelMaxWidth = xScale.bandwidth(); 
        const estimatedLongestLabelWidth = estimateTextWidth(longestXLabel, 
            fillStyle.typography.axisLabelFontFamily, 
            `${baseAxisLabelFontSize}px`, 
            fillStyle.typography.axisLabelFontWeight);

        if (estimatedLongestLabelWidth > labelMaxWidth * 1.2) { // Allow slight overflow before reducing
            finalAxisLabelFontSize = Math.max(8, baseAxisLabelFontSize * (labelMaxWidth * 1.2 / estimatedLongestLabelWidth));
        }
    }
    
    xAxisGroup.selectAll(".axis-label.x-label")
        .data(xCategories)
        .enter()
        .append("text")
        .attr("class", "label axis-label x-label")
        .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
        .attr("y", chartMargins.bottom * 0.4 ) // Position below axis line
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.axisLabelFontFamily)
        .style("font-size", `${finalAxisLabelFontSize}px`)
        .style("font-weight", fillStyle.typography.axisLabelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d)
        .each(function(d) {
            wrapText(d3.select(this), String(d), xScale.bandwidth() * 1.1); // Allow slight overflow for wrap
        });

    const legendData = [
        { key: leftBarGroupCategory, color: fillStyle.getBarColor(leftBarGroupCategory, 0) },
        { key: rightBarGroupCategory, color: fillStyle.getBarColor(rightBarGroupCategory, 1) }
    ];

    const legendRectSize = 15;
    const legendSpacingHorizontal = 15; 
    const legendSpacingRectText = 5; 
    
    let legendItemsWidths = legendData.map(item => {
        const textWidth = estimateTextWidth(item.key, 
            fillStyle.typography.legendLabelFontFamily, 
            fillStyle.typography.legendLabelFontSize, 
            fillStyle.typography.legendLabelFontWeight);
        return legendRectSize + legendSpacingRectText + textWidth;
    });
    const totalLegendWidth = d3.sum(legendItemsWidths) + (legendData.length - 1) * legendSpacingHorizontal;

    const legendStartX = containerWidth - chartMargins.right - totalLegendWidth;
    const legendY = chartMargins.top / 2 - legendRectSize / 2; 

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendStartX > chartMargins.left ? legendStartX : chartMargins.left}, ${legendY})`);

    let currentXOffset = 0;
    legendData.forEach((item, i) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "other legend-item")
            .attr("transform", `translate(${currentXOffset}, 0)`);

        itemGroup.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .style("fill", item.color);

        itemGroup.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendRectSize + legendSpacingRectText)
            .attr("y", legendRectSize / 2)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.legendLabelFontFamily)
            .style("font-size", fillStyle.typography.legendLabelFontSize)
            .style("font-weight", fillStyle.typography.legendLabelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(item.key);
        
        currentXOffset += legendItemsWidths[i] + legendSpacingHorizontal;
    });

    // Block 8: Main Data Visualization Rendering
    const barGroupsContainer = mainChartGroup.append("g").attr("class", "all-bar-groups");
    
    xCategories.forEach(xCategory => {
        const groupElement = barGroupsContainer.append("g")
            .attr("class", "bar-group")
            .attr("transform", `translate(${xScale(xCategory)}, 0)`);

        const categoryData = chartDataArray.filter(d => d[categoryFieldName] === xCategory);
        const leftDataPoint = categoryData.find(d => d[groupFieldName] === leftBarGroupCategory);
        const rightDataPoint = categoryData.find(d => d[groupFieldName] === rightBarGroupCategory);

        let minBarTopY = innerHeight; 
        let minExternalLabelTopY = innerHeight; 

        [leftDataPoint, rightDataPoint].forEach((dataPoint, index) => {
            if (!dataPoint) return;

            const value = +dataPoint[valueFieldName];
            const barHeight = innerHeight - yScale(value);
            const yPos = yScale(value);
            minBarTopY = Math.min(minBarTopY, yPos);

            const barXOffset = index === 0 ? 0 : barWidth + xScale.bandwidth() * groupPaddingBetweenBars;
            const groupCat = index === 0 ? leftBarGroupCategory : rightBarGroupCategory;

            groupElement.append("rect")
                .attr("class", `mark bar ${index === 0 ? 'left-bar' : 'right-bar'}`)
                .attr("x", barXOffset)
                .attr("y", yPos)
                .attr("width", barWidth)
                .attr("height", Math.max(0, barHeight))
                .style("fill", fillStyle.getBarColor(groupCat, index));

            const labelText = `${value}${valueFieldUnit}`;
            let labelFontSize = parseFloat(fillStyle.typography.dataLabelBaseFontSize);
            const estimatedWidth = estimateTextWidth(labelText, fillStyle.typography.dataLabelFontFamily, `${labelFontSize}px`, fillStyle.typography.dataLabelFontWeight);
            
            if (estimatedWidth > barWidth * 0.9 && labelFontSize > 8) { 
                labelFontSize = Math.max(8, labelFontSize * (barWidth * 0.9 / estimatedWidth));
            }

            const labelHeightRequired = labelFontSize + 5; 
            let labelY, labelColor, dominantBaseline = "middle";

            if (barHeight > labelHeightRequired && value > 0) { 
                labelY = yPos + barHeight / 2; 
                labelColor = fillStyle.dataLabelColorInsideBar;
            } else { 
                labelY = yPos - 5; 
                labelColor = fillStyle.dataLabelColorOutsideBar;
                dominantBaseline = "alphabetic"; 
                minExternalLabelTopY = Math.min(minExternalLabelTopY, labelY - labelFontSize);
            }
            
            if (value > 0 || (value === 0 && barHeight <= labelHeightRequired)) { 
                 groupElement.append("text")
                    .attr("class", `label data-label ${index === 0 ? 'left-label' : 'right-label'}`)
                    .attr("x", barXOffset + barWidth / 2)
                    .attr("y", labelY)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", dominantBaseline)
                    .style("font-family", fillStyle.typography.dataLabelFontFamily)
                    .style("font-size", `${labelFontSize}px`)
                    .style("font-weight", fillStyle.typography.dataLabelFontWeight)
                    .style("fill", labelColor)
                    .text(labelText);
            }
        });

        // Block 9: Optional Enhancements & Post-Processing (Icons)
        const iconUrl = fillStyle.images[xCategory] || fillStyle.otherImages.primary;
        if (iconUrl) {
            const iconSize = 30;
            const iconMargin = 5;
            const placementRefY = Math.min(minBarTopY, minExternalLabelTopY);
            const iconY = placementRefY - iconSize - iconMargin; 
            const iconX = xScale.bandwidth() / 2 - iconSize / 2; 

            if (iconY + iconSize > -chartMargins.top) { // Only draw if icon is somewhat visible
                 groupElement.append("image")
                    .attr("class", "icon category-icon")
                    .attr("x", iconX)
                    .attr("y", iconY)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", iconUrl);
            }
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}