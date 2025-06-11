/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Stacked Bar Chart",
  "chart_name": "vertical_stacked_bar_plain_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 12], [0, "inf"], [3, 20]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // or data.colors_dark if theme logic was present
    const images = data.images || {}; // Not used in this chart but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    if (!xField || !yField || !groupField) {
        const missingFields = [
            !xField ? "x role" : null,
            !yField ? "y role" : null,
            !groupField ? "group role" : null
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: field names for roles (${missingFields}) not found in data.data.columns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; font-size: 12px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const yUnit = dataColumns.find(col => col.role === "y")?.unit !== "none" ? dataColumns.find(col => col.role === "y").unit : "";

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
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        dataLabelColor: '#FFFFFF', // Typically white for contrast on colored bars
        chartBackground: rawColors.background_color || '#FFFFFF', // Not explicitly used to draw a rect, but SVG bg
        axisLineColor: '#D3D3D3', // Default for axis lines if they were prominent
    };

    const tempSvgForTextMeasurement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const tempTextForMeasurement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tempSvgForTextMeasurement.appendChild(tempTextForMeasurement);

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        tempTextForMeasurement.textContent = text;
        tempTextForMeasurement.style.fontFamily = fontFamily;
        tempTextForMeasurement.style.fontSize = fontSize;
        tempTextForMeasurement.style.fontWeight = fontWeight;
        // Visibility hidden and position absolute are not strictly necessary for getBBox with createSVGNS
        // but good practice if it were ever appended to DOM for debugging.
        // tempTextForMeasurement.style.visibility = 'hidden'; 
        // tempTextForMeasurement.style.position = 'absolute';
        return tempTextForMeasurement.getBBox().width;
    }
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    function roundedRect(x, y, width, height, radius) {
        const topRadius = radius;
        if (height <= 0) return ""; // Avoid issues with zero or negative height
        if (height < radius) { // If height is less than radius, draw a partial arc
            const centerY = y + radius;
            // Ensure argument for acos is within [-1, 1]
            const acosArg = Math.max(-1, Math.min(1, (radius - height) / radius));
            const angle = Math.acos(acosArg);
            const startX = x + radius - radius * Math.sin(angle);
            const endX = x + width - radius + radius * Math.sin(angle);
            
            return `M${x},${y + height} L${startX},${y + height} A${radius},${radius} 0 0,1 ${endX},${y + height} L${x + width},${y + height} Z`;
        } else {
            return `M${x},${y + height} L${x},${y + topRadius} Q${x},${y} ${x + topRadius},${y} L${x + width - topRadius},${y} Q${x + width},${y} ${x + width},${y + topRadius} L${x + width},${y + height} Z`;
        }
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
        .style("background-color", fillStyle.chartBackground); // Apply background color to SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 70, right: 30, bottom: 80, left: 50 }; // Increased top margin for legend
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartData.map(d => d[groupField]))).sort(); // Sort for consistent stack order

    const groupedData = d3.group(chartData, d => d[xField]);
    const processedData = Array.from(groupedData, ([key, values]) => {
        const obj = { [xField]: key };
        groups.forEach(group => {
            obj[group] = d3.sum(values.filter(d => d[groupField] === group), d => +d[yField]);
        });
        obj.total = d3.sum(values, d => +d[yField]);
        return obj;
    }).sort((a, b) => { // Ensure consistent order of x-axis categories if not inherently sorted
        if (typeof a[xField] === 'string' && typeof b[xField] === 'string') {
            return a[xField].localeCompare(b[xField]);
        }
        return a[xField] - b[xField];
    });
    
    const stackGenerator = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone) // Keep original group order
        .offset(d3.stackOffsetNone);

    const stackedData = stackGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d[xField]))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) || 10]) // Ensure domain max is at least 10 if total is 0
        .range([innerHeight, 0])
        .nice();

    const defaultColors = d3.schemeCategory10;
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => {
            if (rawColors.field && rawColors.field[group]) {
                return rawColors.field[group];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[i % rawColors.available_colors.length];
            }
            return defaultColors[i % defaultColors.length];
        }));
    
    fillStyle.getCategoryColor = (groupName) => colorScale(groupName);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10))
        .call(g => g.select(".domain").remove());

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) { // X-axis label rotation logic
            const tickText = d3.select(this);
            const textContent = tickText.text();
            const textWidth = estimateTextWidth(textContent, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            if (textWidth > xScale.bandwidth() * 0.9 && textWidth > 20) { // Check if rotation is needed
                 tickText.style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-45)");
            } else {
                tickText.style("text-anchor", "middle");
            }
        });

    // Legend
    const legendContainerGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - 10})`); // Position above chart area

    const legendFieldTitleText = groupField || "Legend";
    const legendFieldTitleWidth = estimateTextWidth(legendFieldTitleText, fillStyle.typography.titleFontFamily, fillStyle.typography.titleFontSize, fillStyle.typography.titleFontWeight);
    
    const legendFieldTitle = legendContainerGroup.append("text")
        .attr("class", "text legend-title")
        .attr("x", 0)
        .attr("y", 0)
        .attr("dy", "0.32em") // Vertically center
        .style("font-family", fillStyle.typography.titleFontFamily)
        .style("font-size", fillStyle.typography.titleFontSize)
        .style("font-weight", fillStyle.typography.titleFontWeight)
        .style("fill", fillStyle.textColor)
        .text(legendFieldTitleText);

    let currentXOffsetForLegendItems = legendFieldTitleWidth + 15; // Space after title
    const legendItemSpacing = 15;
    const legendSwatchSize = 12;
    let legendTotalWidth = currentXOffsetForLegendItems;

    groups.forEach((groupName, i) => {
        const legendItem = legendContainerGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentXOffsetForLegendItems}, 0)`);

        legendItem.append("rect")
            .attr("class", "mark legend-swatch")
            .attr("x", 0)
            .attr("y", -legendSwatchSize / 2)
            .attr("width", legendSwatchSize)
            .attr("height", legendSwatchSize)
            .style("fill", colorScale(groupName));

        const legendItemText = legendItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendSwatchSize + 5)
            .attr("y", 0)
            .attr("dy", "0.32em") // Vertically center
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(groupName);
        
        const itemWidth = legendSwatchSize + 5 + estimateTextWidth(groupName, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        currentXOffsetForLegendItems += itemWidth + legendItemSpacing;
        legendTotalWidth = currentXOffsetForLegendItems - legendItemSpacing; // Update total width
    });
    
    // Center the legend
    const legendOffsetX = (innerWidth - legendTotalWidth) / 2;
    legendContainerGroup.attr("transform", `translate(${chartMargins.left + legendOffsetX}, ${chartMargins.top / 2 - 10})`);


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barLayers = mainChartGroup.selectAll(".layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `layer mark group-${d.key.replace(/\s+/g, '-')}`) // Add class for group
        .style("fill", d => colorScale(d.key));

    const cornerRadius = xScale.bandwidth() * 0.3; // Adjusted for a less pronounced curve

    barLayers.selectAll("path.mark.bar-segment")
        .data(d => d.map(item => ({ ...item, key: d.key }))) // Pass key down for top layer check
        .enter().append("path")
        .attr("class", "mark bar-segment")
        .attr("d", (d, i, nodes) => {
            const xVal = xScale(d.data[xField]);
            const yVal = yScale(d[1]);
            const barWidth = xScale.bandwidth();
            const barHeight = Math.max(0, yScale(d[0]) - yScale(d[1])); // Ensure height is not negative

            if (barHeight <= 0) return ""; // Don't draw zero-height bars

            // Check if this segment is the topmost visible segment for this xField category
            const currentGroupIndex = groups.indexOf(d.key);
            let isTopVisibleLayer = true;
            for (let j = currentGroupIndex + 1; j < groups.length; j++) {
                const nextGroupName = groups[j];
                const nextGroupDataForThisX = stackedData.find(layer => layer.key === nextGroupName)
                                                .find(item => item.data[xField] === d.data[xField]);
                if (nextGroupDataForThisX && (yScale(nextGroupDataForThisX[0]) - yScale(nextGroupDataForThisX[1])) > 0.1) { // Check if next layer has visible height
                    isTopVisibleLayer = false;
                    break;
                }
            }
            
            if (isTopVisibleLayer) {
                return roundedRect(xVal, yVal, barWidth, barHeight, cornerRadius);
            } else {
                return `M${xVal},${yVal} h${barWidth} v${barHeight} h${-barWidth} Z`;
            }
        });

    // Data labels on bars
    barLayers.selectAll("text.data-label")
        .data(d => d.map(item => ({ ...item, key: d.key })))
        .enter().append("text")
        .attr("class", "text data-label")
        .attr("x", d => xScale(d.data[xField]) + xScale.bandwidth() / 2)
        .attr("y", d => {
            const barHeight = yScale(d[0]) - yScale(d[1]);
            return yScale(d[1]) + barHeight / 2;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", fillStyle.dataLabelColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => {
            const value = d[1] - d[0];
            const barHeight = yScale(d[0]) - yScale(d[1]);
            const textHeightApproximation = parseFloat(fillStyle.typography.annotationFontSize) * 1.2; // Approx height of text
            
            if (barHeight > textHeightApproximation && value > 0) {
                return formatValue(value) + (yUnit ? ` ${yUnit}` : '');
            }
            return '';
        });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - most handled above)

    // Block 10: Cleanup & SVG Node Return
    // Cleanup temp SVG used for text measurement
    if (tempSvgForTextMeasurement.parentNode) {
      tempSvgForTextMeasurement.parentNode.removeChild(tempSvgForTextMeasurement);
    } else {
        // It was never added to DOM, just clear children if any were dynamically added beyond tempText
        while (tempSvgForTextMeasurement.firstChild) {
            tempSvgForTextMeasurement.removeChild(tempSvgForTextMeasurement.firstChild);
        }
    }
    
    return svgRoot.node();
}