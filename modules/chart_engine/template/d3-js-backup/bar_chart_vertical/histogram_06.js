/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Bar Chart",
  "chart_name": "grouped_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[10, 50], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
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
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || data.colors || {}; // Prefer dark theme if available
    const imagesConfig = data.images || {}; // Not used in this chart, but extracted for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getField = (role) => dataColumns.find(col => col.role === role);

    const xFieldDef = getField(xFieldRole);
    const yFieldDef = getField(yFieldRole);
    const groupFieldDef = getField(groupFieldRole);

    const xFieldName = xFieldDef ? xFieldDef.name : undefined;
    const yFieldName = yFieldDef ? yFieldDef.name : undefined;
    const groupFieldName = groupFieldDef ? groupFieldDef.name : undefined;

    const xFieldUnit = xFieldDef && xFieldDef.unit !== "none" ? xFieldDef.unit : "";
    const yFieldUnit = yFieldDef && yFieldDef.unit !== "none" ? yFieldDef.unit : "";

    const criticalFields = {
        xFieldName,
        yFieldName,
        groupFieldName
    };
    const missingFields = Object.entries(criticalFields)
        .filter(([key, value]) => value === undefined)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

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
        primaryColor: (colorsConfig.other && colorsConfig.other.primary) || '#1f77b4',
        secondaryColor: (colorsConfig.other && colorsConfig.other.secondary) || '#ff7f0e',
        backgroundColor: colorsConfig.background_color || '#FFFFFF', // Not used for chart SVG background, but for completeness
        axisLineColor: colorsConfig.text_color || '#333333', // Default axis line to text color
        groupColors: {}, // To be populated later
    };

    // Helper for text measurement (in-memory)
    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but trying without first.
        // If issues, uncomment: document.body.appendChild(svg);
        const width = textElement.getBBox().width;
        // if (svg.parentNode === document.body) document.body.removeChild(svg);
        return width;
    }
    
    // Helper for value formatting
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor); // Optional: set SVG background if desired

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 50 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataArray.map((d, i) => ({
        time: new Date(d[xFieldName]),
        value: +d[yFieldName],
        group: d[groupFieldName],
        originalIndex: i
    })).sort((a, b) => a.time - b.time);

    const uniqueTimes = Array.from(new Set(processedData.map(d => d.time.getTime())))
        .map(t => new Date(t))
        .sort((a, b) => a - b);

    const timeOrderMap = new Map();
    uniqueTimes.forEach((time, index) => timeOrderMap.set(time.getTime(), index));

    processedData.forEach(d => d.order = timeOrderMap.get(d.time.getTime()));

    const allGroups = [...new Set(processedData.map(d => d.group))];
    const groupsToUse = allGroups.slice(0, 2); // As per original logic, limit to 2 groups

    const defaultCategoricalColors = d3.schemeCategory10;
    groupsToUse.forEach((group, i) => {
        if (colorsConfig.field && colorsConfig.field[group]) {
            fillStyle.groupColors[group] = colorsConfig.field[group];
        } else if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            fillStyle.groupColors[group] = colorsConfig.available_colors[i % colorsConfig.available_colors.length];
        } else {
            fillStyle.groupColors[group] = defaultCategoricalColors[i % defaultCategoricalColors.length];
        }
    });


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleLinear()
        .domain([0, uniqueTimes.length > 1 ? uniqueTimes.length - 1 : 1]) // Handle single time point case for domain
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 1]) // Ensure domain is at least [0,1]
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const maxTicks = 8;
    const dataLength = uniqueTimes.length;
    const indexStep = dataLength > 0 ? Math.ceil(dataLength / maxTicks) : 1;
    const tickIndices = [];
    if (dataLength > 0) {
        for (let i = 0; i < dataLength; i += indexStep) {
            tickIndices.push(i);
        }
        if (tickIndices[tickIndices.length - 1] !== dataLength - 1 && dataLength -1 >=0) {
             // Ensure last tick is included if not covered by step and exists
            if (!tickIndices.includes(dataLength - 1)) tickIndices.push(dataLength - 1);
        }
        if (tickIndices.length === 0 && dataLength === 1) tickIndices.push(0); // Case for single data point
    }


    const xAxisGenerator = d3.axisBottom(xScale)
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
        .call(xAxisGenerator);

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("text-anchor", "middle")
        .style("fill", fillStyle.textColor);
    
    xAxisGroup.select(".domain").remove();


    const yAxisGenerator = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(formatValue)
        .tickSize(0)
        .tickPadding(10);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxisGenerator);

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
            .attr("x", -chartMargins.left + 15) // Position relative to mainChartGroup
            .attr("y", -10) // Position above the y-axis
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
    const legendTextOffset = 20;
    const legendItemSpacing = 10; // Spacing between legend items

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${containerHeight - chartMargins.bottom + legendPadding + 20})`);

    let currentLegendX = 0;
    const legendItems = legendGroup.selectAll(".legend-item")
        .data(groupsToUse)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => {
            const previousWidth = i > 0 ? estimateTextWidth(groupsToUse[i-1], { 
                fontFamily: fillStyle.typography.labelFontFamily, 
                fontSize: fillStyle.typography.labelFontSize
            }) + legendRectSize + legendTextOffset + legendItemSpacing : 0;
            if (i > 0) currentLegendX += previousWidth;
            return `translate(${currentLegendX}, 0)`;
        });

    legendItems.append("rect")
        .attr("class", "mark legend-mark")
        .attr("width", legendRectSize)
        .attr("height", legendRectSize)
        .attr("y", (legendItemHeight - legendRectSize) / 2 - legendItemHeight/2) // Center vertically
        .attr("fill", d => fillStyle.groupColors[d]);

    legendItems.append("text")
        .attr("class", "label legend-label")
        .attr("x", legendRectSize + legendPadding)
        .attr("y", (legendItemHeight / 2) - legendItemHeight/2) // Center vertically
        .attr("dy", "0.35em") // Vertical alignment adjustment
        .text(d => d)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "start");

    // Center the legend group
    const legendWidth = legendGroup.node().getBBox().width;
    legendGroup.attr("transform", `translate(${(containerWidth - legendWidth) / 2}, ${containerHeight - chartMargins.bottom + legendPadding + 20})`);


    // Block 8: Main Data Visualization Rendering
    const numGroups = groupsToUse.length;
    // Calculate total width available for bars at each x-tick.
    // If uniqueTimes.length is 0 or 1, bandWidth could be innerWidth.
    const bandWidth = uniqueTimes.length > 1 ? (innerWidth / uniqueTimes.length) : (innerWidth > 0 ? innerWidth : 100);
    const barPaddingOuter = 0.1; // Padding on the outer edges of the group of bars
    const barPaddingInner = 0.05; // Padding between bars within a group
    
    const totalBarWidthPerTick = bandWidth * (1 - barPaddingOuter);
    const individualBarWidth = (totalBarWidthPerTick - (barPaddingInner * (numGroups -1) * bandWidth) ) / numGroups;


    groupsToUse.forEach((group, groupIndex) => {
        const groupData = processedData.filter(d => d.group === group);
        
        mainChartGroup.selectAll(`.bar-${groupFieldName}-${groupIndex}`) // More specific class
            .data(groupData)
            .enter()
            .append("rect")
            .attr("class", `mark bar bar-group-${groupIndex}`)
            .attr("x", d => {
                const groupOffset = (bandWidth * barPaddingOuter / 2) + groupIndex * (individualBarWidth + (bandWidth * barPaddingInner));
                return xScale(d.order) - totalBarWidthPerTick / 2 + groupOffset;
            })
            .attr("y", d => yScale(d.value))
            .attr("width", Math.max(1, individualBarWidth)) // Ensure width is at least 1px
            .attr("height", d => Math.max(0, innerHeight - yScale(d.value)))
            .attr("fill", fillStyle.groupColors[group])
            .attr("opacity", 0.75);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable for this chart based on current requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}