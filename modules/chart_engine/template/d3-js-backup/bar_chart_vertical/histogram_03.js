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
  "min_width": 600,
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    // const images = data.images || {}; // Not used in this chart, but defined for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldConfig?.name;
    const yFieldName = yFieldConfig?.name;
    const groupFieldName = groupFieldConfig?.name;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push("x field mapping (role: 'x')");
        if (!yFieldName) missingFields.push("y field mapping (role: 'y')");
        if (!groupFieldName) missingFields.push("group field mapping (role: 'group')");
        
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px; font-family: Arial, sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const yFieldUnit = (yFieldConfig?.unit && yFieldConfig.unit !== "none") ? yFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        groupColors: {}
    };

    // Typography tokens
    fillStyle.typography.titleFontFamily = rawTypography.title?.font_family || 'Arial, sans-serif';
    fillStyle.typography.titleFontSize = rawTypography.title?.font_size || '16px';
    fillStyle.typography.titleFontWeight = rawTypography.title?.font_weight || 'bold';

    fillStyle.typography.labelFontFamily = rawTypography.label?.font_family || 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = rawTypography.label?.font_size || '12px';
    fillStyle.typography.labelFontWeight = rawTypography.label?.font_weight || 'normal';

    fillStyle.typography.annotationFontFamily = rawTypography.annotation?.font_family || 'Arial, sans-serif';
    fillStyle.typography.annotationFontSize = rawTypography.annotation?.font_size || '10px';
    fillStyle.typography.annotationFontWeight = rawTypography.annotation?.font_weight || 'normal';
    
    // Color tokens
    fillStyle.textColor = rawColors.text_color || '#333333';
    fillStyle.chartBackground = rawColors.background_color || '#FFFFFF';
    fillStyle.primaryColor = rawColors.other?.primary || '#D32F2F';
    fillStyle.secondaryColor = rawColors.other?.secondary || '#AAAAAA';
    const defaultCategoricalColors = d3.schemeCategory10;

    // Helper: Estimate Text Width (using in-memory SVG as per spec)
    function estimateTextWidth(text, fontProps) {
        if (!text || text.length === 0) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        
        textElement.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        
        tempSvg.appendChild(textElement);
        // Note: getBBox on an un-appended SVG element might be unreliable in some browsers (e.g., return 0).
        // The prompt strictly requires this method.
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            console.warn("getBBox on in-memory SVG text element failed. Legend layout might be affected.", e);
        }
        return width;
    }

    // Helper: Format Value
    function formatValue(value) {
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 60 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "chart-area");

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
    const groupsToUse = allGroups.slice(0, 2); // Limit to first two groups as per original logic

    groupsToUse.forEach((group, index) => {
        if (rawColors.field && rawColors.field[group]) {
            fillStyle.groupColors[group] = rawColors.field[group];
        } else if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            fillStyle.groupColors[group] = rawColors.available_colors[index % rawColors.available_colors.length];
        } else {
            fillStyle.groupColors[group] = defaultCategoricalColors[index % defaultCategoricalColors.length];
        }
    });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleLinear()
        .domain([0, Math.max(0, uniqueTimes.length - 1)]) // Handle empty uniqueTimes
        .range([0, innerWidth]);

    const barVisualWidth = uniqueTimes.length > 0 ? Math.max(1, innerWidth / uniqueTimes.length) * 0.45 : 10;
    const barEffectiveWidth = barVisualWidth * 0.9;

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 1]) // || 1 for empty/all-zero data
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // X-Axis
    if (uniqueTimes.length > 0) {
        const maxTicks = Math.min(8, uniqueTimes.length);
        const tickIndices = [];
        if (uniqueTimes.length <= maxTicks) {
            for(let i=0; i < uniqueTimes.length; i++) tickIndices.push(i);
        } else {
            const indexStep = Math.ceil(uniqueTimes.length / maxTicks);
            let currentIndex = 0;
            const endIndex = uniqueTimes.length - 1;
            tickIndices.push(currentIndex);
            while (currentIndex + indexStep < endIndex) {
                currentIndex += indexStep;
                tickIndices.push(currentIndex);
            }
            if (tickIndices[tickIndices.length - 1] !== endIndex) {
                 tickIndices.push(endIndex);
            }
        }
        
        const xAxisGenerator = d3.axisBottom(xScale)
            .tickValues(tickIndices)
            .tickFormat(i => {
                const date = uniqueTimes[i];
                return date ? d3.timeFormat('%Y')(date) : ""; // Show year
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
    }

    // Y-Axis
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
            .attr("x", 0) 
            .attr("y", -15) // Position above the y-axis
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

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${containerHeight - chartMargins.bottom / 2 + legendPadding})`);
    
    let currentLegendX = 0;
    const legendItems = legendGroup.selectAll(".legend-item")
        .data(groupsToUse)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => {
            const previousWidth = i > 0 ? estimateTextWidth(groupsToUse[i-1], {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            }) + legendRectSize + legendTextOffset + 15 : 0; // 15 for spacing between items
            currentLegendX += previousWidth;
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
        .attr("dy", "0.32em") // Fine-tune vertical alignment
        .text(d => d)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);
    
    // Center the legend block
    const legendWidth = currentLegendX + estimateTextWidth(groupsToUse[groupsToUse.length-1], {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    }) + legendRectSize + legendTextOffset;

    legendGroup.attr("transform", `translate(${(innerWidth - legendWidth) / 2 + chartMargins.left}, ${containerHeight - chartMargins.bottom / 2 + legendPadding + 10 })`);


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    groupsToUse.forEach((group, groupIndex) => {
        const groupData = processedData.filter(d => d.group === group);
        
        mainChartGroup.selectAll(`.bar-${group.replace(/\s+/g, '-')}`) // Sanitize group name for class
            .data(groupData, d => d.originalIndex)
            .enter()
            .append("rect")
            .attr("class", `mark bar bar-${group.replace(/\s+/g, '-')}`)
            .attr("x", d => xScale(d.order) - barVisualWidth / 2 + (groupIndex * barVisualWidth))
            .attr("y", d => yScale(d.value))
            .attr("width", barEffectiveWidth)
            .attr("height", d => Math.max(0, innerHeight - yScale(d.value))) // Ensure non-negative height
            .attr("fill", fillStyle.groupColors[group])
            .attr("stroke", "none");
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No complex visual effects, shadows, or gradients as per requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}