/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Bar Chart",
  "chart_name": "vertical_group_bar_chart_16",
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
  "xAxis": "minimal",
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
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldColumn = dataColumns.find(col => col.role === "x");
    const yFieldColumn = dataColumns.find(col => col.role === "y");
    const groupFieldColumn = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldColumn ? xFieldColumn.name : undefined;
    const yFieldName = yFieldColumn ? yFieldColumn.name : undefined;
    const groupFieldName = groupFieldColumn ? groupFieldColumn.name : undefined;

    const xFieldUnit = xFieldColumn && xFieldColumn.unit !== "none" ? (xFieldColumn.unit || "") : "";
    const yFieldUnit = yFieldColumn && yFieldColumn.unit !== "none" ? (yFieldColumn.unit || "") : "";

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x field" : null,
            !yFieldName ? "y field" : null,
            !groupFieldName ? "group field" : null
        ].filter(Boolean).join(", ");
        const errorMsg = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xValues = [...new Set(chartDataArray.map(d => d[xFieldName]))];
    const groupValues = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    if (groupValues.length !== 2) {
        const errorMsg = `Critical chart config: Exactly 2 groups are required for the 'group' field. Found ${groupValues.length}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        }
        return null;
    }
    const leftBarGroup = groupValues[0];
    const rightBarGroup = groupValues[1];


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) || '16px',
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) || 'bold',
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        axisLineColor: '#000000',
        chartBackground: colorsConfig.background_color || '#FFFFFF', // Not directly used for SVG background, but good practice
        barColorLeft: (colorsConfig.field && colorsConfig.field[leftBarGroup]) ||
                      (colorsConfig.available_colors ? colorsConfig.available_colors[0 % colors.available_colors.length] : '#4269d0'),
        barColorRight: (colorsConfig.field && colorsConfig.field[rightBarGroup]) ||
                       (colorsConfig.available_colors ? colorsConfig.available_colors[1 % Math.max(1, colorsConfig.available_colors.length)] : '#ff725c'), // Math.max to prevent % by 0
        iconUrls: {},
    };

    if (imagesConfig.field) {
        xValues.forEach(xVal => {
            if (imagesConfig.field[xVal]) {
                fillStyle.iconUrls[xVal] = imagesConfig.field[xVal];
            }
        });
    }
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        svg.style.width = 'auto';
        svg.style.height = 'auto';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Document append/remove is not strictly necessary for getBBox if styles are applied directly,
        // but some browsers might be more consistent if it's briefly in a document fragment or similar.
        // For this implementation, direct measurement without DOM append is assumed.
        // If issues arise, one might need to append to document.body temporarily.
        let width = 0;
        try {
             // Temporarily append to body to ensure styles are computed for getBBox
            document.body.appendChild(svg);
            width = textElement.getBBox().width;
            document.body.removeChild(svg);
        } catch (e) {
            console.warn("Could not measure text width using getBBox:", e);
            width = text.length * (parseInt(fontSize) * 0.6); // Fallback estimation
        }
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for Billion
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    function wrapText(textSelection, textContent, maxWidth, lineHeightEm = 1.1) {
        textSelection.each(function() {
            const textNode = d3.select(this);
            const words = textContent.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textNode.attr("x");
            const y = textNode.attr("y") || 0; // Ensure y is defined
            const dy = parseFloat(textNode.attr("dy") || 0);
            
            textNode.text(null); // Clear existing text
    
            let tspan = textNode.append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
            let lines = [];
    
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                    line.pop(); // Remove last word
                    lines.push(line.join(" "));
                    line = [word]; // Start new line with current word
                    lineNumber++;
                }
            }
            lines.push(line.join(" ")); // Push the last line
    
            textNode.text(null); // Clear again before adding final tspans
    
            // Adjust y offset for vertical centering if multiple lines
            const totalLines = lines.length;
            let startY = parseFloat(y);
            if (totalLines > 1) {
                 // Shift up by half of the total additional height
                startY -= (totalLines - 1) * lineHeightEm * parseFloat(textNode.style("font-size")) / 2;
            }

            lines.forEach((ln, i) => {
                textNode.append("tspan")
                    .attr("x", x)
                    .attr("y", startY) // Use adjusted startY for the first line
                    .attr("dy", (i * lineHeightEm) + dy + "em")
                    .text(ln);
            });
        });
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Optional: set SVG background

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 80, left: 30 }; // Adjusted top margin for legend
    
    // If icons are present, increase bottom margin
    if (Object.keys(fillStyle.iconUrls).length > 0) {
        chartMargins.bottom += 40; // Space for icons
    }

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    // `xValues`, `groupValues`, `leftBarGroup`, `rightBarGroup` already defined in Block 1
    // `chartDataArray` is already defined

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.2); // Padding between x-category groups

    const yMax = d3.max(chartDataArray, d => +d[yFieldName]) || 100;
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerHeight, 0]);

    // Bar width and gap calculation (based on original logic)
    // Each bar takes 40% of the xScale bandwidth for that category.
    // Gap between two bars in a group is 10% of xScale bandwidth.
    const barWidthRatio = 0.4;
    const interBarGapRatio = 0.1;
    const actualBarWidth = xScale.bandwidth() * barWidthRatio;
    const gapBetweenBars = xScale.bandwidth() * interBarGapRatio;


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // X-Axis Line
    mainChartGroup.append("line")
        .attr("class", "axis x-axis-line")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 2);

    // X-Axis Labels
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    const baseLabelFontSize = parseInt(fillStyle.typography.labelFontSize);
    const labelMaxWidthForCalc = xScale.bandwidth() * 1.3; // Max width for a label before wrapping
    
    let longestXLabelText = "";
    if (xValues.length > 0) {
        longestXLabelText = xValues.reduce((a, b) => a.toString().length > b.toString().length ? a.toString() : b.toString(), "");
    }
    
    const estimatedLongestLabelWidth = estimateTextWidth(
        longestXLabelText, 
        fillStyle.typography.labelFontFamily, 
        baseLabelFontSize + 'px', 
        fillStyle.typography.labelFontWeight
    );

    let uniformLabelFontSize = baseLabelFontSize;
    if (estimatedLongestLabelWidth > labelMaxWidthForCalc && longestXLabelText) {
        uniformLabelFontSize = Math.max(8, baseLabelFontSize * (labelMaxWidthForCalc / estimatedLongestLabelWidth));
    }
    uniformLabelFontSize = Math.floor(uniformLabelFontSize);


    xAxisGroup.selectAll(".x-label")
        .data(xValues)
        .enter()
        .append("text")
        .attr("class", "label x-label")
        .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
        .attr("y", 20) // Initial y, wrapText might adjust
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", `${uniformLabelFontSize}px`)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d)
        .each(function(d) {
            const textElement = d3.select(this);
            if (textElement.node().getComputedTextLength() > labelMaxWidthForCalc) {
                wrapText(textElement, d.toString(), labelMaxWidthForCalc, 1.1);
            }
        });

    // Legend
    const legendData = [
        { key: leftBarGroup, color: fillStyle.barColorLeft },
        { key: rightBarGroup, color: fillStyle.barColorRight }
    ];

    const legendItemHeight = 20;
    const legendRectSize = 15;
    const legendSpacing = 10; // Horizontal spacing between items
    const legendItemTextPadding = 5; // Padding between rect and text

    let legendItemsWidths = legendData.map(item => {
        return legendRectSize + legendItemTextPadding + estimateTextWidth(
            item.key,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontSize, // Use standard label font size for legend
            fillStyle.typography.labelFontWeight
        );
    });
    const totalLegendWidth = d3.sum(legendItemsWidths) + Math.max(0, legendData.length - 1) * legendSpacing;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2 - legendItemHeight / 2})`); // Centered in top margin

    let currentXOffset = 0;
    legendData.forEach((item, i) => {
        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentXOffset}, 0)`);

        itemGroup.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", item.color)
            .attr("y", (legendItemHeight - legendRectSize) / 2);

        itemGroup.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendRectSize + legendItemTextPadding)
            .attr("y", legendItemHeight / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(item.key);
        
        currentXOffset += legendItemsWidths[i] + legendSpacing;
    });


    // Block 8: Main Data Visualization Rendering
    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(xValues)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${xScale(d)}, 0)`);

    // Calculate base font size for bar value labels
    let longestValueString = "";
    if (chartDataArray.length > 0) {
        const maxYVal = d3.max(chartDataArray, d => +d[yFieldName]);
        if (maxYVal !== undefined) {
            longestValueString = formatValue(maxYVal) + (yFieldUnit ? ` ${yFieldUnit}` : '');
        }
    }
    
    const barLabelBaseFontSize = parseInt(fillStyle.typography.labelFontSize);
    const estimatedMaxBarLabelWidth = estimateTextWidth(
        longestValueString,
        fillStyle.typography.labelFontFamily,
        barLabelBaseFontSize + 'px',
        'bold' // Bar labels are often bold
    );
    
    let dynamicBarLabelFontSize = barLabelBaseFontSize;
    const barLabelAvailableWidth = actualBarWidth * 1.1; // Allow slight overflow
    if (estimatedMaxBarLabelWidth > barLabelAvailableWidth && longestValueString) {
        dynamicBarLabelFontSize = Math.max(6, barLabelBaseFontSize * (barLabelAvailableWidth / estimatedMaxBarLabelWidth));
    }
    dynamicBarLabelFontSize = Math.floor(dynamicBarLabelFontSize);


    chartDataArray.forEach(d => {
        const xVal = d[xFieldName];
        const yVal = +d[yFieldName];
        const groupVal = d[groupFieldName];

        if (isNaN(yVal) || yVal < 0) return; // Skip invalid data

        const barHeight = innerHeight - yScale(yVal);
        if (barHeight <= 0) return; // Skip zero or negative height bars

        const barY = yScale(yVal);
        let barX;

        if (groupVal === leftBarGroup) {
            barX = 0; // Relative to the xScale(xVal) band start
        } else if (groupVal === rightBarGroup) {
            barX = actualBarWidth + gapBetweenBars;
        } else {
            return; // Should not happen due to earlier validation
        }
        
        const parentGroup = barGroups.filter(x => x === xVal); // Get the G element for current xValue

        // Triangular top for bars
        const triangleCapHeight = Math.min(30, Math.max(10, actualBarWidth * 0.5)); // Cap height based on bar width
        const actualTriangleCapHeight = Math.min(triangleCapHeight, barHeight);

        parentGroup.append("path")
            .attr("class", `mark bar ${groupVal === leftBarGroup ? 'left-bar' : 'right-bar'}`)
            .attr("d", () => {
                let path = `M ${barX} ${innerHeight}`; // Bottom-left
                path += ` L ${barX} ${barY + actualTriangleCapHeight}`; // Top-left of rect part
                path += ` L ${barX + actualBarWidth / 2} ${barY}`; // Tip of triangle
                path += ` L ${barX + actualBarWidth} ${barY + actualTriangleCapHeight}`; // Top-right of rect part
                path += ` L ${barX + actualBarWidth} ${innerHeight}`; // Bottom-right
                path += ` Z`;
                return path;
            })
            .attr("fill", groupVal === leftBarGroup ? fillStyle.barColorLeft : fillStyle.barColorRight);

        // Bar Value Labels
        const valueText = formatValue(yVal) + (yFieldUnit ? ` ${yFieldUnit}` : '');
        let currentBarLabelFontSize = dynamicBarLabelFontSize;
        
        // Fine-tune font size if still too wide for this specific label
        const specificLabelWidth = estimateTextWidth(
            valueText, 
            fillStyle.typography.labelFontFamily, 
            currentBarLabelFontSize + 'px', 
            'bold'
        );
        if (specificLabelWidth > barLabelAvailableWidth) {
            currentBarLabelFontSize = Math.max(4, currentBarLabelFontSize * (barLabelAvailableWidth / specificLabelWidth));
            currentBarLabelFontSize = Math.floor(currentBarLabelFontSize);
        }

        parentGroup.append("text")
            .attr("class", "label value bar-label")
            .attr("x", barX + actualBarWidth / 2)
            .attr("y", barY - 5) // Position above the bar tip
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${currentBarLabelFontSize}px`)
            .style("font-weight", "bold") // As per original
            .style("fill", fillStyle.textColor)
            .text(valueText);
    });


    // Block 9: Optional Enhancements & Post-Processing
    // Category Icons (below X-axis labels)
    if (Object.keys(fillStyle.iconUrls).length > 0) {
        let maxLabelBottomY = 0;
        xAxisGroup.selectAll(".x-label").each(function() {
            const bbox = this.getBBox();
            // bbox.y is relative to xAxisGroup, which is at innerHeight.
            // Add some padding below the label text.
            maxLabelBottomY = Math.max(maxLabelBottomY, bbox.y + bbox.height + 5); 
        });
        
        const iconSize = 30; // Fixed icon size
        const iconTopY = maxLabelBottomY + 5; // Position icons below the lowest label part

        xValues.forEach(xVal => {
            if (fillStyle.iconUrls[xVal]) {
                xAxisGroup.append("image") // Append to xAxisGroup for correct relative positioning
                    .attr("class", "icon image category-icon")
                    .attr("xlink:href", fillStyle.iconUrls[xVal])
                    .attr("x", xScale(xVal) + xScale.bandwidth() / 2 - iconSize / 2)
                    .attr("y", iconTopY)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        });
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}