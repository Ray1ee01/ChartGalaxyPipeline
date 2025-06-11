/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Stacked Bar Chart",
  "chart_name": "vertical_stacked_bar_chart_3",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 12], [0, "inf"], [3, 20]],
  "required_fields_icons": [],
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
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // Note: The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via colors_dark
    const imagesInput = data.images || {}; // Though not used in this chart, good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const yFieldName = yFieldConfig ? yFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    const xFieldUnit = xFieldConfig && xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    const yFieldUnit = yFieldConfig && yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";
    // const groupFieldUnit = groupFieldConfig && groupFieldConfig.unit !== "none" ? groupFieldConfig.unit : ""; // Not typically used for legend title

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push("x field (role='x')");
        if (!yFieldName) missingFields.push("y field (role='y')");
        if (!groupFieldName) missingFields.push("group field (role='group')");
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) || '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) || 'bold',
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF', // Not directly used on SVG, but for consistency
        primaryAccent: (colorsInput.other && colorsInput.other.primary) || '#007bff',
        defaultCategoricalColor: d3.scaleOrdinal(d3.schemeCategory10)
    };
    
    fillStyle.getColor = (groupValue, index) => {
        if (colorsInput.field && colorsInput.field[groupFieldName] && colorsInput.field[groupFieldName][groupValue]) {
            return colorsInput.field[groupFieldName][groupValue];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[index % colorsInput.available_colors.length];
        }
        return fillStyle.defaultCategoricalColor(groupValue);
    };

    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        svg.style.width = 'auto';
        svg.style.height = 'auto';
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-weight', fontWeight);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-family', fontFamily);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // No need to append to DOM for getBBox if attributes are set correctly.
        // However, some browsers might need it for `getComputedTextLength` or complex styles.
        // For `getBBox`, it's generally fine.
        // document.body.appendChild(svg); // Temporarily append to get accurate measurements
        const width = textEl.getBBox().width;
        // document.body.removeChild(svg);
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.2s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.2s")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    function layoutLegend(legendContainer, legendItems, itemColors, options) {
        const {
            x = 0, y = 0,
            fontSize = fillStyle.typography.labelFontSize,
            fontWeight = fillStyle.typography.labelFontWeight,
            fontFamily = fillStyle.typography.labelFontFamily,
            textColor = fillStyle.textColor,
            align = "left",
            maxWidth = Infinity,
            shape = "rect", // "rect", "circle"
            itemPadding = 5,
            lineSpacing = 8,
            symbolSize = parseInt(fontSize) * 0.8,
            symbolTextGap = 5
        } = options;

        legendContainer.selectAll("*").remove(); // Clear previous legend
        legendContainer.attr("class", "legend");

        let currentX = x;
        let currentY = y;
        let maxLineWidth = 0;
        let totalHeight = 0;

        const lines = [];
        let currentLineItems = [];
        let currentLineWidth = 0;

        legendItems.forEach((itemText, index) => {
            const itemWidth = symbolSize + symbolTextGap + estimateTextWidth(itemText, fontWeight, fontSize, fontFamily) + itemPadding;

            if (currentLineWidth + itemWidth > maxWidth && currentLineItems.length > 0) {
                lines.push({ items: currentLineItems, width: currentLineWidth - itemPadding });
                maxLineWidth = Math.max(maxLineWidth, currentLineWidth - itemPadding);
                currentLineItems = [];
                currentLineWidth = 0;
            }
            currentLineItems.push({ text: itemText, color: itemColors[index] || fillStyle.getColor(itemText, index) });
            currentLineWidth += itemWidth;
        });

        if (currentLineItems.length > 0) {
            lines.push({ items: currentLineItems, width: currentLineWidth - itemPadding });
            maxLineWidth = Math.max(maxLineWidth, currentLineWidth - itemPadding);
        }
        
        totalHeight = lines.length * (symbolSize + lineSpacing) - lineSpacing;
        if (totalHeight < 0) totalHeight = 0;


        lines.forEach((line, lineIndex) => {
            currentX = x;
            if (align === "center") {
                currentX = x + (maxLineWidth - line.width) / 2;
            } else if (align === "right") {
                currentX = x + (maxLineWidth - line.width);
            }
            currentY = y + lineIndex * (symbolSize + lineSpacing);

            line.items.forEach(item => {
                const legendItem = legendContainer.append("g")
                    .attr("class", "legend-item")
                    .attr("transform", `translate(${currentX}, ${currentY})`);

                if (shape === "rect") {
                    legendItem.append("rect")
                        .attr("class", "mark")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", symbolSize)
                        .attr("height", symbolSize)
                        .style("fill", item.color);
                } else if (shape === "circle") {
                    legendItem.append("circle")
                        .attr("class", "mark")
                        .attr("cx", symbolSize / 2)
                        .attr("cy", symbolSize / 2)
                        .attr("r", symbolSize / 2)
                        .style("fill", item.color);
                }

                legendItem.append("text")
                    .attr("class", "label")
                    .attr("x", symbolSize + symbolTextGap)
                    .attr("y", symbolSize / 2)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", fontFamily)
                    .style("font-size", fontSize)
                    .style("font-weight", fontWeight)
                    .style("fill", textColor)
                    .text(item.text);
                
                currentX += symbolSize + symbolTextGap + estimateTextWidth(item.text, fontWeight, fontSize, fontFamily) + itemPadding;
            });
        });
        return { width: maxLineWidth, height: totalHeight };
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
        .style("background-color", fillStyle.chartBackground); // Optional: set background on SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 60, // Increased for legend
        right: 30,
        bottom: 80, // Increased for X-axis labels
        left: 50
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartDataInput.map(d => d[groupFieldName]))).sort(); // Sort for consistent legend order

    const processedData = Array.from(d3.group(chartDataInput, d => d[xFieldName]), ([key, values]) => {
        const obj = { [xFieldName]: key };
        let total = 0;
        groups.forEach(group => {
            const sumVal = d3.sum(values.filter(d => d[groupFieldName] === group), d => +d[yFieldName]);
            obj[group] = sumVal;
            total += sumVal;
        });
        obj.total = total;
        return obj;
    });
    
    // Ensure consistent order of x-axis categories if they have a natural sort order
    // For now, using the order they appear in groupedData. If specific sort is needed, apply here.
    // processedData.sort((a, b) => d3.ascending(a[xFieldName], b[xFieldName])); // Example: sort by xField

    const stackGenerator = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone) // Keep original group order
        .offset(d3.stackOffsetNone);

    const stackedData = stackGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d[xFieldName]))
        .range([0, innerWidth])
        .padding(0.2); // Adjusted padding

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) || 1]) // Ensure domain starts at 0, fallback for empty data
        .range([innerHeight, 0])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((g, i) => fillStyle.getColor(g, i)));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .tickSize(0)
            .tickPadding(10))
        .call(g => g.select(".domain").remove()); // Remove axis line

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("text-anchor", "middle") // Default, can be adjusted if labels overlap
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => { // Truncate or wrap logic can be added here if needed
            const labelText = String(d);
            // Simple truncation example:
            // const maxLabelWidth = xScale.bandwidth();
            // let currentWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontFamily);
            // if (currentWidth > maxLabelWidth) return labelText.substring(0, Math.floor(labelText.length * maxLabelWidth / currentWidth) - 3) + "...";
            return labelText;
        });
        
    // Dynamic X-axis label rotation if needed
    let requiresRotation = false;
    const maxLabelPossibleWidth = xScale.bandwidth() * 1.1; // Allow slight overflow
    xAxisGroup.selectAll("text").each(function(d) {
        const textWidth = this.getBBox().width;
        if (textWidth > maxLabelPossibleWidth) {
            requiresRotation = true;
        }
    });

    if (requiresRotation) {
        xAxisGroup.selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");
    }


    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend-container"); // Use a container for easier positioning

    const legendTitleText = groupFieldConfig?.label || groupFieldName; // Use label from dataColumns if available
    const legendTitleWidth = estimateTextWidth(legendTitleText, fillStyle.typography.titleFontWeight, fillStyle.typography.labelFontSize, fillStyle.typography.titleFontFamily); // Using label size for legend title
    const legendTitleMargin = 10;

    const legendItems = groups;
    const legendItemColors = groups.map(g => colorScale(g));
    
    const legendRenderedSize = layoutLegend(legendGroup, legendItems, legendItemColors, {
        x: 0, // Relative to legendGroup
        y: 0, // Relative to legendGroup
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight,
        fontFamily: fillStyle.typography.labelFontFamily,
        textColor: fillStyle.textColor,
        align: "left",
        maxWidth: innerWidth - legendTitleWidth - legendTitleMargin, // Available width for items
        shape: "rect",
        itemPadding: 10,
        lineSpacing: 5,
        symbolSize: parseInt(fillStyle.typography.labelFontSize) * 0.9,
    });

    const legendTitleElement = legendGroup.append("text")
        .attr("class", "label legend-title")
        .attr("x", 0)
        .attr("y", legendRenderedSize.height / 2) // Vertically center with items
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.titleFontFamily) // Use title font for legend title
        .style("font-size", fillStyle.typography.labelFontSize) // Or a specific legend title size
        .style("font-weight", fillStyle.typography.titleFontWeight)
        .style("fill", fillStyle.textColor)
        .text(legendTitleText + ":");
    
    // Reposition legend items to make space for the title
    legendGroup.selectAll(".legend-item, rect.mark, circle.mark, text.label:not(.legend-title)")
        .attr("transform", function() {
            const currentTransform = d3.select(this.parentNode.tagName === 'g' ? this.parentNode : this).attr("transform") || "translate(0,0)";
            const parts = /translate\(\s*([^\s,)]+)[ ,]([^\s,)]+)/.exec(currentTransform);
            const tx = parseFloat(parts[1]);
            const ty = parseFloat(parts[2]);
            return `translate(${tx + legendTitleWidth + legendTitleMargin}, ${ty})`;
        });
    
    const totalLegendWidth = legendTitleWidth + legendTitleMargin + legendRenderedSize.width;
    const legendPosX = chartMargins.left + (innerWidth - totalLegendWidth) / 2; // Center legend
    const legendPosY = chartMargins.top / 2 - (legendRenderedSize.height / 2); // Position above chart area

    legendGroup.attr("transform", `translate(${legendPosX < 10 ? 10 : legendPosX}, ${legendPosY < 10 ? 10 : legendPosY})`);


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barLayers = mainChartGroup.selectAll(".bar-layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `bar-layer mark group-${d.key.replace(/\s+/g, '-').toLowerCase()}`) // Class for group
        .style("fill", d => colorScale(d.key));

    barLayers.selectAll("rect")
        .data(d => d)
        .enter().append("rect")
        .attr("class", "mark bar-segment")
        .attr("x", d => xScale(d.data[xFieldName]))
        .attr("y", d => yScale(d[1]))
        .attr("height", d => {
            const h = yScale(d[0]) - yScale(d[1]);
            return h > 0 ? h : 0; // Ensure non-negative height
        })
        .attr("width", xScale.bandwidth());

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // Data Labels
    barLayers.selectAll(".data-label")
        .data(d => d.map(item => ({ ...item, key: d.key }))) // Add key to item for color
        .enter().append("text")
        .attr("class", "label value data-label")
        .attr("x", d => xScale(d.data[xFieldName]) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d[1]) + (yScale(d[0]) - yScale(d[1])) / 2)
        .attr("dy", "0.35em") // Vertically center
        .style("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", (d) => { // Choose contrasting color for label
            // Simple brightness check for white/black text
            const barColor = d3.color(colorScale(d.key));
            return barColor && (barColor.r * 0.299 + barColor.g * 0.587 + barColor.b * 0.114) > 186 ? '#000000' : '#FFFFFF';
        })
        .text(d => {
            const value = d[1] - d[0];
            const segmentHeight = yScale(d[0]) - yScale(d[1]);
            // Only show label if value is significant and segment is tall enough
            if (value > 0 && segmentHeight > (parseInt(fillStyle.typography.annotationFontSize) * 1.2)) {
                return formatValue(value) + (yFieldUnit ? ` ${yFieldUnit}` : '');
            }
            return "";
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}