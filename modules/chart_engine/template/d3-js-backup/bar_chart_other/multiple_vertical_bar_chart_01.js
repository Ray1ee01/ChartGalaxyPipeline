/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Vertical Bar Chart",
  "chart_name": "grouped_vertical_bar_chart_01",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["none"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // Could be data.colors_dark for dark themes, handled by caller
    const rawImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const y2Column = dataColumns.find(col => col.role === "y2");

    const categoryFieldName = xColumn ? xColumn.name : undefined;
    const valueFieldNameLeft = yColumn ? yColumn.name : undefined;
    const valueFieldNameRight = y2Column ? y2Column.name : undefined;

    const yUnit = (yColumn && yColumn.unit && yColumn.unit !== "none" && yColumn.unit.length <= 5) ? yColumn.unit : "";
    const y2Unit = (y2Column && y2Column.unit && y2Column.unit !== "none" && y2Column.unit.length <= 5) ? y2Column.unit : "";


    if (!categoryFieldName || !valueFieldNameLeft || !valueFieldNameRight) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push("x field (category)");
        if (!valueFieldNameLeft) missingFields.push("y field (left chart value)");
        if (!valueFieldNameRight) missingFields.push("y2 field (right chart value)");
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) ? rawTypography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) ? rawTypography.title.font_size : '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) ? rawTypography.title.font_weight : 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF',
        primaryBarColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#4682B4',
        secondaryBarColor: (rawColors.other && rawColors.other.secondary) ? rawColors.other.secondary : '#FF7F50',
        gridLineColor: '#E0E0E0', // Default subtle gridline color
        axisLineColor: '#888888',
        images: {
            field: rawImages.field || {},
            other: rawImages.other || {}
        }
    };
    
    // In-memory text measurement utility
    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        textElement.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        textElement.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        textElement.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM append.
        // For simple cases, this might suffice. If not, a temporary, hidden append/remove is needed.
        // However, the spec says "MUST NOT be appended to the document DOM".
        // A common workaround is to have a pre-rendered hidden SVG in the DOM for measurements,
        // or accept that getBBox on non-rendered elements can be inconsistent.
        // For this refactor, we'll assume this method is sufficient or that the environment handles it.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-rendered elements
            const avgCharWidth = parseFloat(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6;
            return text.length * avgCharWidth;
        }
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
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
        .style("background-color", fillStyle.chartBackground);

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 60, // Space for sub-chart titles
        right: 30,
        bottom: 80, // Space for x-axis labels and icons
        left: 70  // Space for y-axis labels
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const subChartWidth = innerWidth / 2 - 20; // 20px for spacing between charts

    // Block 5: Data Preprocessing & Transformation
    const leftChartData = chartData.map(d => ({
        category: d[categoryFieldName],
        value: parseFloat(d[valueFieldNameLeft]) || 0
    })).sort((a, b) => b.value - a.value);

    const rightChartData = chartData.map(d => ({
        category: d[categoryFieldName],
        value: parseFloat(d[valueFieldNameRight]) || 0
    })).sort((a, b) => b.value - a.value);

    const leftChartCategories = leftChartData.map(d => d.category);
    const rightChartCategories = rightChartData.map(d => d.category);

    // Block 6: Scale Definition & Configuration
    const leftXScale = d3.scaleBand()
        .domain(leftChartCategories)
        .range([0, subChartWidth])
        .padding(0.2);

    const leftYMax = d3.max(leftChartData, d => d.value);
    const leftYScale = d3.scaleLinear()
        .domain([0, leftYMax > 0 ? leftYMax * 1.1 : 10]) // Add 10% padding, handle all zero data
        .range([innerHeight, 0]);

    const rightXScale = d3.scaleBand()
        .domain(rightChartCategories)
        .range([0, subChartWidth])
        .padding(0.2);

    const rightYMax = d3.max(rightChartData, d => d.value);
    const rightYScale = d3.scaleLinear()
        .domain([0, rightYMax > 0 ? rightYMax * 1.1 : 10]) // Add 10% padding, handle all zero data
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    
    // Left Chart Group
    const leftChartGroup = svgRoot.append("g")
        .attr("class", "chart-group left-chart")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Left Chart Title (Metric Name)
    if (valueFieldNameLeft) {
        leftChartGroup.append("text")
            .attr("class", "label chart-subtitle")
            .attr("x", 0)
            .attr("y", -20) // Position above the chart
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", fillStyle.typography.titleFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .style("fill", fillStyle.textColor)
            .text(valueFieldNameLeft + (yUnit ? ` (${yUnit})` : ''));
    }

    // Left Y-Axis
    const leftYAxis = d3.axisLeft(leftYScale)
        .ticks(5)
        .tickSize(0)
        .tickFormat(d => formatValue(d) + (d === leftYScale.domain()[1] ? "" : yUnit)); // Unit only on non-max ticks if needed

    leftChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(leftYAxis)
        .call(g => g.select(".domain").remove()) // Remove axis line
        .selectAll("text")
            .attr("class", "label axis-label")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight);

    // Left X-Axis (line only, labels added in Block 9 if they fit)
    leftChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(leftXScale).tickSize(0).tickFormat(''))
        .select(".domain")
            .style("stroke", fillStyle.axisLineColor);


    // Left Chart Gridlines
    leftChartGroup.append("g")
        .attr("class", "grid other")
        .selectAll("line")
        .data(leftYScale.ticks(5))
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("y1", d => leftYScale(d))
        .attr("x2", subChartWidth)
        .attr("y2", d => leftYScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2");


    // Right Chart Group
    const rightChartGroup = svgRoot.append("g")
        .attr("class", "chart-group right-chart")
        .attr("transform", `translate(${chartMargins.left + subChartWidth + 40}, ${chartMargins.top})`);

    // Right Chart Title (Metric Name)
     if (valueFieldNameRight) {
        rightChartGroup.append("text")
            .attr("class", "label chart-subtitle")
            .attr("x", 0)
            .attr("y", -20) // Position above the chart
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", fillStyle.typography.titleFontSize)
            .style("font-weight", fillStyle.typography.titleFontWeight)
            .style("fill", fillStyle.textColor)
            .text(valueFieldNameRight + (y2Unit ? ` (${y2Unit})` : ''));
    }

    // Right Y-Axis
    const rightYAxis = d3.axisLeft(rightYScale)
        .ticks(5)
        .tickSize(0)
        .tickFormat(d => formatValue(d) + (d === rightYScale.domain()[1] ? "" : y2Unit));

    rightChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(rightYAxis)
        .call(g => g.select(".domain").remove()) // Remove axis line
        .selectAll("text")
            .attr("class", "label axis-label")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight);
    
    // Right X-Axis (line only, labels added in Block 9 if they fit)
    rightChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(rightXScale).tickSize(0).tickFormat(''))
        .select(".domain")
            .style("stroke", fillStyle.axisLineColor);

    // Right Chart Gridlines
    rightChartGroup.append("g")
        .attr("class", "grid other")
        .selectAll("line")
        .data(rightYScale.ticks(5))
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("y1", d => rightYScale(d))
        .attr("x2", subChartWidth)
        .attr("y2", d => rightYScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2");

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    // Left Chart Bars
    leftChartGroup.selectAll(".bar-mark")
        .data(leftChartData)
        .enter()
        .append("rect")
        .attr("class", "mark bar-mark")
        .attr("x", d => leftXScale(d.category))
        .attr("y", d => leftYScale(d.value))
        .attr("width", leftXScale.bandwidth())
        .attr("height", d => innerHeight - leftYScale(d.value))
        .attr("fill", fillStyle.primaryBarColor);

    // Right Chart Bars
    rightChartGroup.selectAll(".bar-mark")
        .data(rightChartData)
        .enter()
        .append("rect")
        .attr("class", "mark bar-mark")
        .attr("x", d => rightXScale(d.category))
        .attr("y", d => rightYScale(d.value))
        .attr("width", rightXScale.bandwidth())
        .attr("height", d => innerHeight - rightYScale(d.value))
        .attr("fill", fillStyle.secondaryBarColor);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    const iconSize = Math.min(leftXScale.bandwidth() * 0.8, 24); // Icon size based on bar width, max 24px
    const iconYOffset = 25; // Below x-axis line

    // Left Chart Icons & X-Axis Labels
    let showLeftXLabels = true;
    leftChartCategories.forEach(category => {
        const textWidth = estimateTextWidth(category, { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (textWidth > leftXScale.bandwidth() * 1.5) { // Allow some overflow, but not too much
            showLeftXLabels = false;
        }
    });
    
    if (showLeftXLabels) {
        leftChartGroup.selectAll(".x-axis-label")
            .data(leftChartCategories)
            .enter()
            .append("text")
            .attr("class", "label x-axis-label")
            .attr("x", d => leftXScale(d) + leftXScale.bandwidth() / 2)
            .attr("y", innerHeight + iconYOffset - (fillStyle.images.field && Object.keys(fillStyle.images.field).length > 0 ? 0 : 10)) // Adjust if no icons
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d => d);
    }

    if (fillStyle.images.field && Object.keys(fillStyle.images.field).length > 0) {
        leftChartGroup.selectAll(".icon-image")
            .data(leftChartCategories)
            .enter()
            .append("g")
            .attr("class", "icon image-icon-group")
            .attr("transform", d => `translate(${leftXScale(d) + leftXScale.bandwidth() / 2}, ${innerHeight + iconYOffset + (showLeftXLabels ? 15 : 0)})`)
            .each(function(d) {
                const categoryKey = String(d);
                if (fillStyle.images.field[categoryKey]) {
                    const imagePath = fillStyle.images.field[categoryKey];
                    const clipId = `clip-left-${categoryKey.replace(/[^a-zA-Z0-9]/g, '-')}`;
                    
                    let clipPath = defs.select(`#${clipId}`);
                    if (clipPath.empty()) {
                        clipPath = defs.append("clipPath").attr("id", clipId);
                        clipPath.append("circle").attr("r", iconSize / 2);
                    }
                    
                    d3.select(this).append("image")
                        .attr("class", "image icon-image-element")
                        .attr("xlink:href", imagePath)
                        .attr("clip-path", `url(#${clipId})`)
                        .attr("x", -iconSize / 2)
                        .attr("y", -iconSize / 2)
                        .attr("width", iconSize)
                        .attr("height", iconSize);
                }
            });
    }


    // Right Chart Icons & X-Axis Labels
    let showRightXLabels = true;
    rightChartCategories.forEach(category => {
        const textWidth = estimateTextWidth(category, { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (textWidth > rightXScale.bandwidth() * 1.5) {
            showRightXLabels = false;
        }
    });

    if (showRightXLabels) {
        rightChartGroup.selectAll(".x-axis-label")
            .data(rightChartCategories)
            .enter()
            .append("text")
            .attr("class", "label x-axis-label")
            .attr("x", d => rightXScale(d) + rightXScale.bandwidth() / 2)
            .attr("y", innerHeight + iconYOffset - (fillStyle.images.field && Object.keys(fillStyle.images.field).length > 0 ? 0 : 10))
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d => d);
    }
    
    if (fillStyle.images.field && Object.keys(fillStyle.images.field).length > 0) {
        rightChartGroup.selectAll(".icon-image")
            .data(rightChartCategories)
            .enter()
            .append("g")
            .attr("class", "icon image-icon-group")
            .attr("transform", d => `translate(${rightXScale(d) + rightXScale.bandwidth() / 2}, ${innerHeight + iconYOffset + (showRightXLabels ? 15 : 0)})`)
            .each(function(d) {
                const categoryKey = String(d);
                if (fillStyle.images.field[categoryKey]) {
                    const imagePath = fillStyle.images.field[categoryKey];
                    const clipId = `clip-right-${categoryKey.replace(/[^a-zA-Z0-9]/g, '-')}`;
                    
                    let clipPath = defs.select(`#${clipId}`);
                    if (clipPath.empty()) {
                        clipPath = defs.append("clipPath").attr("id", clipId);
                        clipPath.append("circle").attr("r", iconSize / 2);
                    }
                    
                    d3.select(this).append("image")
                        .attr("class", "image icon-image-element")
                        .attr("xlink:href", imagePath)
                        .attr("clip-path", `url(#${clipId})`)
                        .attr("x", -iconSize / 2)
                        .attr("y", -iconSize / 2)
                        .attr("width", iconSize)
                        .attr("height", iconSize);
                }
            });
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}