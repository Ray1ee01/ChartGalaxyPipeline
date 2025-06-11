/* REQUIREMENTS_BEGIN
{
  "chart_type": "Histogram",
  "chart_name": "histogram_05",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[10, 50], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "background_color", "text_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "none",
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
    const typography = data.typography || {};
    const colors = data.colors || {}; // Could be data.colors_dark if a theme mechanism was in place
    const images = data.images || {}; // Not used in this chart, but extracted for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldDef = dataColumns.find(col => col.role === groupFieldRole);

    const xFieldName = xFieldDef ? xFieldDef.name : undefined;
    const yFieldName = yFieldDef ? yFieldDef.name : undefined;
    const groupFieldName = groupFieldDef ? groupFieldDef.name : undefined;

    const xFieldUnit = xFieldDef && xFieldDef.unit !== "none" ? xFieldDef.unit : "";
    const yFieldUnit = yFieldDef && yFieldDef.unit !== "none" ? yFieldDef.unit : "";

    if (!xFieldName || !yFieldName || !groupFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push(`field with role '${xFieldRole}'`);
        if (!yFieldName) missingFields.push(`field with role '${yFieldRole}'`);
        if (!groupFieldName) missingFields.push(`field with role '${groupFieldRole}'`);
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#333333',
        chartBackground: colors.background_color || '#FFFFFF',
        primaryColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4', // Default primary
        groupColors: {}, // To be populated in Block 5
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Appending to body to ensure getBBox works, then removing immediately.
        // This is a common workaround for getBBox in detached elements.
        document.body.appendChild(tempSvg);
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    }
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 60 }; // Adjusted left margin for potentially larger y-axis labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartData.map((d, i) => ({
        time: new Date(d[xFieldName]),
        value: +d[yFieldName],
        group: d[groupFieldName],
        originalIndex: i
    }));

    processedData.sort((a, b) => a.time - b.time);

    const uniqueTimes = Array.from(new Set(processedData.map(d => d.time.getTime())))
        .map(t => new Date(t));
    uniqueTimes.sort((a, b) => a - b);

    const timeOrderMap = new Map();
    uniqueTimes.forEach((time, index) => {
        timeOrderMap.set(time.getTime(), index);
    });

    processedData.forEach(d => {
        d.order = timeOrderMap.get(d.time.getTime());
    });

    const allGroups = [...new Set(processedData.map(d => d.group))];
    const groupsToUse = allGroups.slice(0, 2); // As per original logic and implied by required_fields_range for group

    groupsToUse.forEach((group, index) => {
        if (colors.field && colors.field[group]) {
            fillStyle.groupColors[group] = colors.field[group];
        } else if (colors.available_colors && colors.available_colors.length > 0) {
            fillStyle.groupColors[group] = colors.available_colors[index % colors.available_colors.length];
        } else {
            // Fallback to primaryColor or a shifted version if multiple groups and only primary is defined
            fillStyle.groupColors[group] = index === 0 ? fillStyle.primaryColor : d3.color(fillStyle.primaryColor).darker(0.5 + index * 0.5).toString();
        }
    });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleLinear()
        .domain([0, uniqueTimes.length > 1 ? uniqueTimes.length - 1 : 1]) // Handle single data point case for domain
        .range([0, innerWidth]);

    const binWidthPercentage = 0.45; // Percentage of available space per time slot for one group's bar
    const barWidthPercentage = 0.9;  // Percentage of binWidth for the actual bar (for padding)
    
    // Calculate binWidth based on the space for each time point.
    // If only one time point, use a fraction of innerWidth.
    const singleTimeSlotWidth = uniqueTimes.length > 1 ? innerWidth / uniqueTimes.length : innerWidth / 2;
    const binWidth = Math.max(1, singleTimeSlotWidth * binWidthPercentage);


    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 1]) // Ensure domain is at least [0,1]
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const maxTicks = 8;
    const dataLength = uniqueTimes.length;
    const indexStep = dataLength > maxTicks ? Math.ceil(dataLength / maxTicks) : 1;
    
    const tickIndices = [];
    if (dataLength > 0) {
        for (let i = 0; i < dataLength; i += indexStep) {
            tickIndices.push(i);
        }
        if (tickIndices[tickIndices.length - 1] !== dataLength - 1 && dataLength -1 >=0) {
             // Ensure last tick is included if not already by step and not the same as previous
            if (!tickIndices.includes(dataLength -1)) tickIndices.push(dataLength - 1);
        }
        if (tickIndices.length === 0 && dataLength === 1) tickIndices.push(0); // Case for single data point
    }


    const xAxis = d3.axisBottom(xScale)
        .tickValues(tickIndices.length > 0 ? tickIndices : (uniqueTimes.length > 0 ? [0] : []))
        .tickFormat(i => {
            if (uniqueTimes[i]) {
                return d3.timeFormat('%Y')(uniqueTimes[i]);
            }
            return "";
        })
        .tickSize(0)
        .tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("text-anchor", "middle")
        .style("fill", fillStyle.textColor);
    
    xAxisGroup.select(".domain").remove();

    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => formatValue(d))
        .tickSize(0)
        .tickPadding(10);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    yAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("text-anchor", "end")
        .style("fill", fillStyle.textColor);

    yAxisGroup.select(".domain").remove();

    if (yFieldUnit) {
        mainChartGroup.append("text")
            .attr("class", "label y-axis-unit")
            .attr("x", -chartMargins.left + 15) // Position relative to mainChartGroup origin
            .attr("y", -10) // Above the y-axis
            .style("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(`(${yFieldUnit})`);
    }

    // Legend
    const legendItemHeight = 20;
    const legendPadding = 5;
    const legendRectSize = 15;
    const legendTextPadding = 5;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${containerHeight - chartMargins.bottom + legendPadding + 20})`); // Position below x-axis

    let legendTotalWidth = 0;
    const legendItemsData = groupsToUse.map(group => {
        const textWidth = estimateTextWidth(group, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        const itemWidth = legendRectSize + legendTextPadding + textWidth;
        legendTotalWidth += itemWidth;
        return { group, itemWidth };
    });
    
    legendTotalWidth += (groupsToUse.length - 1) * (legendPadding * 2); // Add spacing between items

    let currentX = (innerWidth - legendTotalWidth) / 2; // Start X for centering

    legendItemsData.forEach((itemData) => {
        const groupItem = legendGroup.append("g")
            .attr("transform", `translate(${currentX}, 0)`);

        groupItem.append("rect")
            .attr("class", "mark legend-mark")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("y", (legendItemHeight - legendRectSize) / 2)
            .attr("fill", fillStyle.groupColors[itemData.group]);

        groupItem.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendRectSize + legendTextPadding)
            .attr("y", legendItemHeight / 2)
            .attr("dy", "0.32em") // Vertical alignment
            .text(itemData.group)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .style("text-anchor", "start");
        
        currentX += itemData.itemWidth + (legendPadding * 2);
    });


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    groupsToUse.forEach((group, groupIndex) => {
        const groupData = processedData.filter(d => d.group === group);
        
        mainChartGroup.selectAll(`.bar-${group.replace(/\s+/g, '-')}-${groupIndex}`) // Sanitize group name for class
            .data(groupData, d => d.originalIndex) // Use originalIndex for key
            .enter()
            .append("rect")
            .attr("class", `mark bar bar-${group.replace(/\s+/g, '-')}-${groupIndex}`)
            .attr("x", d => {
                // Center the group of bars at the tick, then offset individual group bars
                const timeSlotCenter = xScale(d.order);
                const totalWidthForTwoBars = binWidth * 2; // Assuming max 2 groups
                const startOffset = timeSlotCenter - totalWidthForTwoBars / 2;
                return startOffset + (groupIndex * binWidth);
            })
            .attr("y", d => yScale(d.value))
            .attr("width", binWidth * barWidthPercentage)
            .attr("height", d => Math.max(0, innerHeight - yScale(d.value))) // Ensure height is not negative
            .attr("fill", fillStyle.groupColors[group]);
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No optional enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}