/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Bar Chart",
  "chart_name": "grouped_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via data.colors_dark
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const groupColumn = dataColumns.find(col => col.role === "group");

    const xFieldName = xColumn ? xColumn.name : undefined;
    const yFieldName = yColumn ? yColumn.name : undefined;
    const groupFieldName = groupColumn ? groupColumn.name : undefined;

    const xFieldUnit = xColumn && xColumn.unit !== "none" ? (xColumn.unit || "") : "";
    const yFieldUnit = yColumn && yColumn.unit !== "none" ? (yColumn.unit || "") : "";

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x field" : null,
            !yFieldName ? "y field" : null,
            !groupFieldName ? "group field" : null
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: [${missingFields} definition in dataColumns]. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) || '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal'
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF',
        defaultCategoricalColors: d3.schemeCategory10,
        images: {}
    };

    fillStyle.getColor = (groupValue, index) => {
        if (rawColors.field && rawColors.field[groupFieldName] && rawColors.field[groupFieldName][groupValue]) {
            return rawColors.field[groupFieldName][groupValue];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[index % rawColors.available_colors.length];
        }
        return fillStyle.defaultCategoricalColors[index % fillStyle.defaultCategoricalColors.length];
    };
    
    fillStyle.getImageUrl = (fieldValue) => {
        if (rawImages.field && rawImages.field[xFieldName] && rawImages.field[xFieldName][fieldValue]) {
            return rawImages.field[xFieldName][fieldValue];
        }
        if (rawImages.other && rawImages.other.primary) { // Fallback to a generic primary icon if specific not found
             // return rawImages.other.primary; // This line was commented out as per typical use case (specific icons or none)
        }
        return null;
    };


    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document append/remove is not strictly necessary for getBBox if SVG is fully defined,
        // but some browsers might be more reliable if it's briefly in DOM.
        // However, per spec, it should not be appended to document DOM.
        // Forcing a layout might be needed in some edge cases if not appended.
        // For simplicity and adherence to "MUST NOT be appended", we rely on direct getBBox.
        let width = 0;
        try {
             width = tempText.getBBox().width;
        } catch (e) {
            // console.warn("Could not measure text width with getBBox:", e);
            // Fallback for environments where getBBox might fail on non-rendered elements
            width = text.length * (parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
        return width;
    }
    
    function calculateDynamicFontSize(text, maxWidth, baseFontSize, minFontSize = 8) {
        const initialWidth = estimateTextWidth(text, { fontSize: `${baseFontSize}px` });
        if (initialWidth <= maxWidth) {
            return baseFontSize;
        }
        let newSize = baseFontSize * (maxWidth / initialWidth);
        return Math.max(minFontSize, Math.floor(newSize));
    }

    function wrapText(d3TextSelection, textContent, maxWidth, lineHeightEm = 1.1) {
        d3TextSelection.each(function() {
            const textElement = d3.select(this);
            const words = textContent.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textElement.attr("x");
            const y = textElement.attr("y") || 0; // Ensure y is defined
            const dy = parseFloat(textElement.attr("dy") || 0);
            
            textElement.text(null); // Clear existing text

            let tspan = textElement.append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = textElement.append("tspan").attr("x", x).attr("y", y).attr("dy", (++lineNumber * lineHeightEm + dy) + "em").text(word);
                }
            }
            // Adjust vertical centering for multi-line text
            const tspans = textElement.selectAll("tspan");
            const numTspans = tspans.size();
            if (numTspans > 1) {
                const totalHeight = (numTspans -1) * lineHeightEm; // in ems
                const firstTspanYCorrection = -(totalHeight / 2);
                 tspans.each(function(d, i) {
                    d3.select(this).attr("dy", (parseFloat(d3.select(this).attr("dy")) + firstTspanYCorrection) + "em");
                 });
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
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin_top || 80, // Space for legend and icons
        right: variables.margin_right || 30,
        bottom: variables.margin_bottom || 80, // Space for x-axis labels
        left: variables.margin_left || 30
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const xValues = [...new Set(chartData.map(d => d[xFieldName]))];
    const groupValues = [...new Set(chartData.map(d => d[groupFieldName]))];

    if (groupValues.length !== 2) {
        console.warn(`This chart is optimized for exactly 2 groups. Found ${groupValues.length} groups. Using the first two: ${groupValues.slice(0,2).join(', ')}.`);
        // The chart will proceed using the first two groups if more are provided, or might behave unexpectedly if less than 2.
        // The requirement `required_fields_range` for group is `[2, 2]` implies valid data will always have 2 groups.
    }
    const leftBarGroupKey = groupValues[0];
    const rightBarGroupKey = groupValues[1];


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.25); // Padding between x-categories

    const groupScale = d3.scaleBand()
        .domain([0, 1]) // For two bars: left (0) and right (1)
        .range([0, xScale.bandwidth()])
        .padding(0.15); // Padding between bars within the same x-category

    const yMax = d3.max(chartData, d => +d[yFieldName]) || 100;
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax * 1.1 : 10]) // Add some headroom, ensure domain is not [0,0]
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // X-Axis Labels
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    const baseLabelFontSize = parseInt(fillStyle.typography.labelFontSize);
    
    // Calculate a uniform font size for X-axis labels to prevent overlap
    let maxEstimatedXLabelWidth = 0;
    xValues.forEach(val => {
        maxEstimatedXLabelWidth = Math.max(maxEstimatedXLabelWidth, estimateTextWidth(val, {fontSize: `${baseLabelFontSize}px`}));
    });
    
    const xLabelAvailableWidth = xScale.bandwidth();
    const finalXLabelFontSize = calculateDynamicFontSize(
        xValues.reduce((a,b) => a.length > b.length ? a : b, ""), // longest label text
        xLabelAvailableWidth * 0.9, // Use 90% of bandwidth for safety
        baseLabelFontSize,
        8 // min font size
    );

    xAxisGroup.selectAll(".x-axis-label")
        .data(xValues)
        .enter()
        .append("text")
        .attr("class", "label x-axis-label")
        .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
        .attr("y", chartMargins.bottom / 2) // Position in the middle of the bottom margin
        .attr("dy", "0em") // Initial dy
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", `${finalXLabelFontSize}px`)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d)
        .each(function(d) {
            // Apply wrapping if text still overflows after font size adjustment
            if (this.getComputedTextLength() > xLabelAvailableWidth) {
                 wrapText(d3.select(this), d.toString(), xLabelAvailableWidth, 1.1);
            }
        });

    // Legend
    if (groupValues.length > 0) {
        const legendData = groupValues.slice(0,2).map((groupKey, i) => ({
            key: groupKey,
            color: fillStyle.getColor(groupKey, i)
        }));

        const legendItemHeight = 20;
        const legendRectSize = 15;
        const legendSpacing = 10; // Spacing between items
        const legendTextPadding = 5; // Padding between rect and text

        let totalLegendWidth = 0;
        const legendItemWidths = legendData.map(item => {
            const textWidth = estimateTextWidth(item.key, { fontSize: fillStyle.typography.labelFontSize });
            const itemWidth = legendRectSize + legendTextPadding + textWidth;
            totalLegendWidth += itemWidth;
            return itemWidth;
        });
        totalLegendWidth += (legendData.length - 1) * legendSpacing;

        const legendStartX = (innerWidth - totalLegendWidth) / 2; // Centered legend
        const legendY = -chartMargins.top / 2 - legendItemHeight / 2; // Position above chart area

        const legendGroup = mainChartGroup.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${legendStartX}, ${legendY})`);

        let currentXOffset = 0;
        legendData.forEach((item, i) => {
            const legendItemGroup = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentXOffset}, 0)`);

            legendItemGroup.append("rect")
                .attr("class", "mark legend-mark")
                .attr("x", 0)
                .attr("y", (legendItemHeight - legendRectSize) / 2)
                .attr("width", legendRectSize)
                .attr("height", legendRectSize)
                .style("fill", item.color);

            legendItemGroup.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendRectSize + legendTextPadding)
                .attr("y", legendItemHeight / 2)
                .attr("dy", "0.35em") // Vertical alignment
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .style("text-anchor", "start")
                .text(item.key);
            
            currentXOffset += legendItemWidths[i] + legendSpacing;
        });
    }

    // Block 8: Main Data Visualization Rendering
    const barWidth = groupScale.bandwidth();
    const valueLabelBaseFontSize = parseInt(fillStyle.typography.labelFontSize);

    xValues.forEach(xCat => {
        const categoryData = chartData.filter(d => d[xFieldName] === xCat);
        const leftBarDataPoint = categoryData.find(d => d[groupFieldName] === leftBarGroupKey);
        const rightBarDataPoint = categoryData.find(d => d[groupFieldName] === rightBarGroupKey);

        let minBarTopY = innerHeight; // For icon placement, track highest point of bars or labels
        let minExternalLabelTopY = innerHeight;

        // Left Bar
        if (leftBarDataPoint) {
            const value = +leftBarDataPoint[yFieldName];
            const barHeight = innerHeight - yScale(value);
            const barY = yScale(value);
            minBarTopY = Math.min(minBarTopY, barY);

            mainChartGroup.append("rect")
                .attr("class", "mark bar left-bar")
                .attr("x", xScale(xCat) + groupScale(0))
                .attr("y", barY)
                .attr("width", barWidth)
                .attr("height", Math.max(0, barHeight)) // Ensure height is not negative
                .style("fill", fillStyle.getColor(leftBarGroupKey, 0));

            // Data Label for Left Bar
            const labelText = `${value}${yFieldUnit}`;
            const labelFontSize = calculateDynamicFontSize(labelText, barWidth * 0.9, valueLabelBaseFontSize, 6);
            const labelHeightRequired = labelFontSize + 4; // Approx height + padding

            let labelY, labelColor, dominantBaseline;
            if (barHeight > labelHeightRequired && value > 0) { // Label inside bar
                labelY = barY + barHeight / 2; // Vertically centered in bar
                labelColor = d3.hsl(fillStyle.getColor(leftBarGroupKey, 0)).l > 0.5 ? '#333333' : '#FFFFFF'; // Contrast
                dominantBaseline = "middle";
            } else { // Label outside bar
                labelY = barY - 5;
                labelColor = fillStyle.textColor;
                dominantBaseline = "auto"; // typically bottom
                minExternalLabelTopY = Math.min(minExternalLabelTopY, labelY - labelFontSize);
            }
            if (value > 0 || (variables.show_zero_values || false)) { // Only show label if value > 0 or explicitly configured
                mainChartGroup.append("text")
                    .attr("class", "label value left-bar-label")
                    .attr("x", xScale(xCat) + groupScale(0) + barWidth / 2)
                    .attr("y", labelY)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", dominantBaseline)
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", `${labelFontSize}px`)
                    .style("font-weight", "bold")
                    .style("fill", labelColor)
                    .text(labelText);
            }
        }

        // Right Bar
        if (rightBarDataPoint) {
            const value = +rightBarDataPoint[yFieldName];
            const barHeight = innerHeight - yScale(value);
            const barY = yScale(value);
            minBarTopY = Math.min(minBarTopY, barY);

            mainChartGroup.append("rect")
                .attr("class", "mark bar right-bar")
                .attr("x", xScale(xCat) + groupScale(1))
                .attr("y", barY)
                .attr("width", barWidth)
                .attr("height", Math.max(0, barHeight))
                .style("fill", fillStyle.getColor(rightBarGroupKey, 1));

            // Data Label for Right Bar
            const labelText = `${value}${yFieldUnit}`;
            const labelFontSize = calculateDynamicFontSize(labelText, barWidth * 0.9, valueLabelBaseFontSize, 6);
            const labelHeightRequired = labelFontSize + 4;

            let labelY, labelColor, dominantBaseline;
            if (barHeight > labelHeightRequired && value > 0) { // Label inside bar
                labelY = barY + barHeight / 2;
                labelColor = d3.hsl(fillStyle.getColor(rightBarGroupKey, 1)).l > 0.5 ? '#333333' : '#FFFFFF';
                dominantBaseline = "middle";
            } else { // Label outside bar
                labelY = barY - 5;
                labelColor = fillStyle.textColor;
                dominantBaseline = "auto";
                minExternalLabelTopY = Math.min(minExternalLabelTopY, labelY - labelFontSize);
            }
             if (value > 0 || (variables.show_zero_values || false)) {
                mainChartGroup.append("text")
                    .attr("class", "label value right-bar-label")
                    .attr("x", xScale(xCat) + groupScale(1) + barWidth / 2)
                    .attr("y", labelY)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", dominantBaseline)
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", `${labelFontSize}px`)
                    .style("font-weight", "bold")
                    .style("fill", labelColor)
                    .text(labelText);
            }
        }
        
        // Block 9: Optional Enhancements & Post-Processing (Icons)
        const iconUrl = fillStyle.getImageUrl(xCat);
        if (iconUrl) {
            const iconSize = Math.min(30, xScale.bandwidth() * 0.4); // Icon size relative to bar group width
            const iconMargin = 5;
            const placementRefY = Math.min(minBarTopY, minExternalLabelTopY); // Highest point of content for this xCat
            
            // Ensure iconY is not too high if bars are very short or labels are far above
            let iconY = placementRefY - iconMargin - iconSize;
            if (iconY < -chartMargins.top + iconSize/2) { // Prevent icon from going too far above chart area
                iconY = -chartMargins.top + iconSize/2 + 5; // Place it just below the top margin line
            }
            // If placementRefY is near innerHeight (e.g. zero value bars), place icon a bit above axis.
            if (placementRefY > innerHeight - iconSize - iconMargin) {
                 iconY = innerHeight - iconSize - iconMargin;
            }


            mainChartGroup.append("image")
                .attr("class", "icon category-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", xScale(xCat) + xScale.bandwidth() / 2 - iconSize / 2)
                .attr("y", iconY)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}