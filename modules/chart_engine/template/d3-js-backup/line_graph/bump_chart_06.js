/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bump Chart",
  "chart_name": "bump_chart_06",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [
    [4, 12],
    [0, "inf"],
    [3, 10]
  ],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // Note: The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    let missingConfigs = [];
    if (!xFieldConfig) missingConfigs.push("x field configuration (role: 'x')");
    if (!yFieldConfig) missingConfigs.push("y field configuration (role: 'y')");
    if (!groupFieldConfig) missingConfigs.push("group field configuration (role: 'group')");

    if (missingConfigs.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingConfigs.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        imageUrls: {},
        seriesColors: {}
    };

    // Typography
    fillStyle.typography.defaultFontFamily = 'Arial, sans-serif';
    fillStyle.typography.title = {
        font_family: (typographyConfig.title && typographyConfig.title.font_family) || fillStyle.typography.defaultFontFamily,
        font_size: (typographyConfig.title && typographyConfig.title.font_size) || '16px',
        font_weight: (typographyConfig.title && typographyConfig.title.font_weight) || 'bold',
    };
    fillStyle.typography.label = {
        font_family: (typographyConfig.label && typographyConfig.label.font_family) || fillStyle.typography.defaultFontFamily,
        font_size: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
        font_weight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
    };
    fillStyle.typography.annotation = { // Though not explicitly used for annotations, good for data labels
        font_family: (typographyConfig.annotation && typographyConfig.annotation.font_family) || fillStyle.typography.defaultFontFamily,
        font_size: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
        font_weight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
    };
    
    // Colors
    fillStyle.textColor = colorsConfig.text_color || '#333333';
    fillStyle.backgroundColor = colorsConfig.background_color || '#FFFFFF';
    fillStyle.primaryColor = (colorsConfig.other && colorsConfig.other.primary) || '#1f77b4';
    const defaultCategoricalColors = d3.schemeCategory10;

    const uniqueGroupsForColor = [...new Set(chartDataInput.map(d => d[groupFieldName]))];
    uniqueGroupsForColor.forEach((group, i) => {
        if (colorsConfig.field && colorsConfig.field[group]) {
            fillStyle.seriesColors[group] = colorsConfig.field[group];
        } else if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            fillStyle.seriesColors[group] = colorsConfig.available_colors[i % colorsConfig.available_colors.length];
        } else {
            fillStyle.seriesColors[group] = defaultCategoricalColors[i % defaultCategoricalColors.length];
        }
    });
    
    function getSeriesColor(group) {
        return fillStyle.seriesColors[group] || fillStyle.primaryColor;
    }

    // Images
    if (imagesConfig.field) {
        for (const key in imagesConfig.field) {
            fillStyle.imageUrls[key] = imagesConfig.field[key];
        }
    }
     if (imagesConfig.other && imagesConfig.other.primary) {
        fillStyle.imageUrls.primaryPlaceholder = imagesConfig.other.primary; // Example if needed
    }


    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family || fillStyle.typography.defaultFontFamily);
        tempText.setAttribute('font-size', fontProps.font_size || '12px');
        tempText.setAttribute('font-weight', fontProps.font_weight || 'normal');
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM.
        // If getBBox is 0, it might be due to not being in DOM. For this exercise, we assume it works.
        // A robust version might briefly append to a hidden div in DOM.
        // document.body.appendChild(tempSvg); // Temporarily append for measurement
        let width = 0;
        try {
             width = tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            width = text.length * (parseInt(fontProps.font_size || '12px') * 0.6);
        }
        // tempSvg.remove(); // Clean up if appended
        return width;
    }

    // Date parsing (assuming common date formats, adjust if specific format is known)
    const dateParsers = [
        d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ"), // ISO with milliseconds and Z
        d3.timeParse("%Y-%m-%dT%H:%M:%SZ"),    // ISO with Z
        d3.timeParse("%Y-%m-%d %H:%M:%S"),
        d3.timeParse("%Y/%m/%d %H:%M:%S"),
        d3.timeParse("%Y-%m-%d"),
        d3.timeParse("%m/%d/%Y"),
        d3.timeParse("%d-%b-%y")
    ];
    function parseDate(dateString) {
        if (dateString instanceof Date) return dateString;
        for (let parser of dateParsers) {
            const parsed = parser(dateString);
            if (parsed) return parsed;
        }
        // Fallback for numeric timestamps (e.g., Unix epoch in ms)
        if (!isNaN(dateString) && new Date(Number(dateString)) instanceof Date && !isNaN(new Date(Number(dateString)))) {
             return new Date(Number(dateString));
        }
        console.warn("Could not parse date:", dateString);
        return null;
    }
    
    // Simplified X-axis scale and ticks creation logic
    function createXAxisScaleAndInfo(chartData, xField, rangeMin, rangeMax) {
        const xValuesDate = chartData.map(d => parseDate(d[xField])).filter(d => d !== null);
        if (xValuesDate.length === 0) {
             return { xScale: d3.scaleTime().domain([new Date(), new Date()]).range([rangeMin, rangeMax]), xTicks: [], xFormat: () => "" };
        }
        const xScale = d3.scaleTime()
            .domain(d3.extent(xValuesDate))
            .range([rangeMin, rangeMax]);
        
        const xTicks = xScale.ticks(Math.min(xValuesDate.length, 7)); // Auto ticks, max 7
        const xFormat = xScale.tickFormat(); // Auto format

        return { xScale, xTicks, xFormat };
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
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 180, bottom: 60, left: 100 }; // Adjusted left for potentially longer group names + ranks
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = [...new Set(chartDataInput.map(d => d[groupFieldName]))];
    const xValuesRaw = [...new Set(chartDataInput.map(d => d[xFieldName]))].sort((a, b) => parseDate(a) - parseDate(b));

    const rankData = {};
    groups.forEach(group => { rankData[group] = []; });

    xValuesRaw.forEach(xVal => {
        const itemsAtX = chartDataInput.filter(d => d[xFieldName] === xVal);
        itemsAtX.sort((a, b) => b[yFieldName] - a[yFieldName]); // Higher yField = better rank

        const groupsWithDataAtX = new Set(itemsAtX.map(d => d[groupFieldName]));

        itemsAtX.forEach((d, i) => {
            rankData[d[groupFieldName]].push({
                x: d[xFieldName],
                rank: i + 1,
                value: d[yFieldName],
                hasData: true
            });
        });

        groups.forEach(group => {
            if (!groupsWithDataAtX.has(group)) {
                const existingEntries = rankData[group];
                // Use previous rank or default to last possible rank if no prior data
                const lastRank = existingEntries.length > 0 ? existingEntries[existingEntries.length - 1].rank : groups.length;
                rankData[group].push({
                    x: xVal,
                    rank: lastRank, 
                    value: null,
                    hasData: false
                });
            }
        });
    });

    groups.forEach(group => {
        rankData[group].sort((a, b) => parseDate(a.x) - parseDate(b.x));
    });

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat } = createXAxisScaleAndInfo(chartDataInput, xFieldName, 0, innerWidth);
    
    const yScale = d3.scaleLinear()
        .domain([1, Math.max(1, groups.length)]) // Domain from rank 1 to max groups
        .range([0, innerHeight]);

    const pointRadius = 5; // Fixed radius, original scale was [7,7]

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    
    // Top time labels (X-axis equivalent)
    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis-labels");

    // Optimize time labels to avoid overlap
    function getOptimizedTimeLabels(ticks, format, availableWidth, scale) {
        if (!ticks || ticks.length === 0) return [];
        if (ticks.length <= 1) return ticks;

        const labelFont = { font_size: fillStyle.typography.label.font_size, font_family: fillStyle.typography.label.font_family };
        const tickWidths = ticks.map(tick => estimateTextWidth(format(tick), labelFont) + 10); // 10px padding

        let totalWidth = 0;
        for(let i=0; i<ticks.length; i++) {
            if (i > 0) totalWidth += Math.abs(scale(ticks[i]) - scale(ticks[i-1]));
        }
        
        let estimatedTotalLabelWidth = tickWidths.reduce((a,b) => a+b, 0);

        if (estimatedTotalLabelWidth <= availableWidth * 1.5) { // Allow some flexibility
             // Check for pairwise overlap
            for (let i = 0; i < ticks.length - 1; i++) {
                const gap = scale(ticks[i+1]) - scale(ticks[i]);
                if (gap < (tickWidths[i] / 2 + tickWidths[i+1] / 2)) {
                    // Overlap detected, proceed to thinning
                    break; 
                }
                if (i === ticks.length - 2) return ticks; // No overlap
            }
        }

        const maxLabels = Math.floor(availableWidth / (estimatedTotalLabelWidth / ticks.length));
        if (maxLabels <=1 && ticks.length > 1) return [ticks[0], ticks[ticks.length-1]];
        if (maxLabels <=1 && ticks.length <=1) return ticks;


        const step = Math.max(1, Math.ceil(ticks.length / maxLabels));
        const optimized = [];
        for (let i = 0; i < ticks.length; i += step) {
            optimized.push(ticks[i]);
        }
        if (ticks.length > 0 && !optimized.includes(ticks[ticks.length - 1])) {
            optimized.push(ticks[ticks.length - 1]);
        }
        return [...new Set(optimized)]; // Ensure unique
    }

    const optimizedXTicks = getOptimizedTimeLabels(xTicks, xFormat, innerWidth, xScale);

    optimizedXTicks.forEach(tick => {
        xAxisLabelsGroup.append("text")
            .attr("class", "label x-axis-label")
            .attr("x", xScale(tick))
            .attr("y", -20) // Position above the chart
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", fillStyle.typography.label.font_size)
            .style("font-weight", fillStyle.typography.label.font_weight)
            .attr("fill", fillStyle.textColor)
            .text(xFormat(tick));
    });

    // Left side group/rank labels (Y-axis equivalent)
    const yAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis-labels");

    const groupLabelFont = { font_size: '14px', font_weight: 'bold', font_family: fillStyle.typography.label.font_family };
    const rankLabelFont = { font_size: '12px', font_weight: 'bold', font_family: fillStyle.typography.label.font_family };
    
    const maxGroupTextWidth = groups.reduce((max, group) => Math.max(max, estimateTextWidth(group, groupLabelFont)), 0);
    const rankTextWidth = estimateTextWidth("10", rankLabelFont); // Estimate width for rank numbers
    
    const iconSize = 24;
    const iconPadding = 5;
    const labelPadding = 8;
    const rankPadding = 5;

    // Positions from left edge of mainChartGroup (which is already translated by margin.left)
    // x=0 is the start of innerWidth. We need to place labels to the left of this.
    const rankLabelX = -chartMargins.left + 20; // Start from far left
    const groupLabelX = rankLabelX + rankTextWidth + rankPadding;
    const iconX = groupLabelX + maxGroupTextWidth + labelPadding;
    const triangleMarkerX = iconX + (imagesConfig.field ? iconSize : 0) + iconPadding; // Triangle after icon if icon exists

    groups.forEach((group) => {
        const firstDataPoint = rankData[group].find(d => d.hasData) || rankData[group][0];
        if (!firstDataPoint) return;

        const yPos = yScale(firstDataPoint.rank);

        // Rank Number
        yAxisLabelsGroup.append("text")
            .attr("class", "label rank-label")
            .attr("x", rankLabelX)
            .attr("y", yPos)
            .attr("dy", "0.35em") // Vertical centering
            .attr("text-anchor", "start")
            .style("font-family", rankLabelFont.font_family)
            .style("font-size", rankLabelFont.font_size)
            .style("font-weight", rankLabelFont.font_weight)
            .attr("fill", fillStyle.textColor)
            .text(firstDataPoint.rank);

        // Group Name
        yAxisLabelsGroup.append("text")
            .attr("class", "label group-name-label")
            .attr("x", groupLabelX)
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", groupLabelFont.font_family)
            .style("font-size", groupLabelFont.font_size)
            .style("font-weight", groupLabelFont.font_weight)
            .attr("fill", fillStyle.textColor)
            .text(group);
        
        // Image Icon (if exists)
        if (fillStyle.imageUrls[group]) {
            yAxisLabelsGroup.append("image")
                .attr("class", "icon group-icon")
                .attr("xlink:href", fillStyle.imageUrls[group])
                .attr("x", iconX)
                .attr("y", yPos - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize);
        }
        
        // Triangle Marker
        yAxisLabelsGroup.append("path")
            .attr("class", "mark group-marker")
            .attr("d", "M0,-5 L8,0 L0,5 Z") // Slightly smaller triangle
            .attr("transform", `translate(${triangleMarkerX},${yPos})`)
            .attr("fill", getSeriesColor(group));
    });


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const linesGroup = mainChartGroup.append("g").attr("class", "lines-group");
    const pointsGroup = mainChartGroup.append("g").attr("class", "points-group");
    const dataLabelsGroup = mainChartGroup.append("g").attr("class", "data-labels-group");

    groups.forEach(group => {
        const groupRanks = rankData[group];
        const seriesColor = getSeriesColor(group);

        // Segment lines for continuous data
        let currentSegment = [];
        const validSegments = [];
        groupRanks.forEach(d => {
            if (d.hasData) {
                currentSegment.push(d);
            } else {
                if (currentSegment.length > 0) validSegments.push(currentSegment);
                currentSegment = [];
            }
        });
        if (currentSegment.length > 0) validSegments.push(currentSegment);

        validSegments.forEach(segment => {
            if (segment.length > 1) { // Need at least two points for a line
                linesGroup.append("path")
                    .datum(segment)
                    .attr("class", "mark series-line")
                    .attr("fill", "none")
                    .attr("stroke", seriesColor)
                    .attr("stroke-width", 3)
                    .attr("d", d3.line()
                        .x(d => xScale(parseDate(d.x)))
                        .y(d => yScale(d.rank))
                    );
            }
        });

        // Draw points and data labels for points with data
        groupRanks.forEach(d => {
            if (d.hasData) {
                const cx = xScale(parseDate(d.x));
                const cy = yScale(d.rank);

                pointsGroup.append("circle")
                    .attr("class", "mark series-point")
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("r", pointRadius)
                    .attr("fill", seriesColor)
                    .attr("stroke", fillStyle.backgroundColor) // For a 'halo' effect
                    .attr("stroke-width", 1.5);
                
                dataLabelsGroup.append("text")
                    .attr("class", "label data-value-label")
                    .attr("x", cx)
                    .attr("y", cy + pointRadius + (parseInt(fillStyle.typography.annotation.font_size) * 0.8) + 2) // Position below point
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotation.font_family)
                    .style("font-size", fillStyle.typography.annotation.font_size)
                    .style("font-weight", fillStyle.typography.annotation.font_weight)
                    .attr("fill", fillStyle.textColor)
                    .text(d.value !== null ? d.value.toLocaleString() : "");
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (Icons already handled in Block 7 with Y-axis labels for this chart type)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}