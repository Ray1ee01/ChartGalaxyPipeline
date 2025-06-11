/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Scatterplot",
  "chart_name": "grouped_scatterplot_05",
  "is_composite": false,
  "required_fields": ["x", "y", "y2", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[8, 150], [0, "inf"], [0, "inf"], [2, 6]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 750,
  "min_width": 750,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const pointLabelDataColumn = dataColumns.find(col => col.role === "x");
    const xAxisDataColumn = dataColumns.find(col => col.role === "y");
    const yAxisDataColumn = dataColumns.find(col => col.role === "y2");
    const groupDataColumn = dataColumns.find(col => col.role === "group");

    const pointLabelFieldName = pointLabelDataColumn ? pointLabelDataColumn.name : undefined;
    const xAxisDataFieldName = xAxisDataColumn ? xAxisDataColumn.name : undefined;
    const yAxisDataFieldName = yAxisDataColumn ? yAxisDataColumn.name : undefined;
    const groupFieldName = groupDataColumn ? groupDataColumn.name : undefined;

    if (!pointLabelFieldName || !xAxisDataFieldName || !yAxisDataFieldName || !groupFieldName) {
        console.error("Critical chart config missing: Field names for point labels (role 'x'), X-axis data (role 'y'), Y-axis data (role 'y2'), or grouping (role 'group') could not be derived from dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Critical chart configuration missing. Roles 'x', 'y', 'y2', 'group' must be defined in data.data.columns.</div>");
        }
        return null;
    }

    const pointLabelFieldTitle = pointLabelDataColumn.title || pointLabelFieldName;
    const xAxisFieldTitle = xAxisDataColumn.title || xAxisDataFieldName;
    const yAxisFieldTitle = yAxisDataColumn.title || yAxisDataFieldName;
    const groupFieldTitle = groupDataColumn.title || groupFieldName;

    const uniqueGroupNames = [...new Set(chartData.map(d => d[groupFieldName]))];

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
        primaryAccent: (colors.other && colors.other.primary) ? colors.other.primary : '#007bff',
        gridLineColor: '#E0E0E0', // Subtle gridline
        axisLineColor: colors.text_color || '#333333', // Default to text color for axis lines
        getGroupColor: (groupName) => {
            const groupIndex = uniqueGroupNames.indexOf(groupName);
            return (colors.field && colors.field[groupName]) ?
                   colors.field[groupName] :
                   (colors.available_colors ? colors.available_colors[groupIndex % colors.available_colors.length] : '#CCCCCC');
        },
        getGroupIconUrl: (groupName) => (images.field && images.field[groupName]) ? images.field[groupName] : null,
    };

    function estimateTextMetrics(text, fontProps) {
        const tempSvg = d3.create("svg");
        const textNode = tempSvg.append("text")
            .attr("font-family", fontProps.fontFamily)
            .attr("font-size", fontProps.fontSize)
            .attr("font-weight", fontProps.fontWeight)
            .text(text);
        const bbox = textNode.node().getBBox();
        tempSvg.remove();
        return { width: bbox.width, height: bbox.height };
    }

    function hasNegativeOrZeroValues(data, field) {
        return data.some(d => d[field] <= 0);
    }

    function isDistributionUneven(data, field) {
        const values = data.map(d => d[field]).filter(v => typeof v === 'number' && isFinite(v));
        if (values.length < 3) return false; // Not enough data to determine
        const extent = d3.extent(values);
        if (extent[0] === undefined || extent[1] === undefined) return false;
        const range = extent[1] - extent[0];
        if (range === 0) return false; // All values are the same

        const median = d3.median(values);
        const q1 = d3.quantile(values.sort(d3.ascending), 0.25);
        const q3 = d3.quantile(values.sort(d3.ascending), 0.75);
        if (q1 === undefined || q3 === undefined || median === undefined) return false;
        const iqr = q3 - q1;
        
        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1])/2) > range * 0.2;
    }
    
    function formatAxisValue(value) {
        if (value > 0 && value < 1) {
            if (value < 0.001) return value.toExponential(1);
            if (value < 0.01) return value.toFixed(3);
            if (value < 0.1) return value.toFixed(2);
            return value.toFixed(1);
        }
        if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(1) + "G";
        if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + "M";
        if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(1) + "k";
        
        const absValue = Math.abs(value);
        if (absValue === 0) return "0";
        if (absValue < 10 && absValue !== Math.floor(absValue)) return value.toFixed(2);
        if (absValue < 100 && absValue !== Math.floor(absValue)) return value.toFixed(1);
        return value.toFixed(0);
    }

    function generateGridPositions(scale, count, domain) {
        const min = domain[0];
        const max = domain[1];
        const isLog = scale.constructor.name.includes('Log');
        
        if (isLog) {
            const logMin = Math.log10(Math.max(min, 0.0000000001)); // Avoid log(0) or log(negative)
            const logMax = Math.log10(Math.max(max, 0.0000000001));
            if (logMin === logMax) return [min];
            const step = (logMax - logMin) / (count -1 < 1 ? 1 : count -1);
            return Array.from({length: count}, (_, i) => Math.pow(10, logMin + step * i));
        } else {
            if (min === max) return [min];
            const step = (max - min) / (count -1 < 1 ? 1 : count -1);
            return Array.from({length: count}, (_, i) => min + step * i);
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 750;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    const defs = svgRoot.append("defs");

    uniqueGroupNames.forEach((group, i) => {
        const iconUrl = fillStyle.getGroupIconUrl(group);
        if (iconUrl) {
            defs.append("image")
                .attr("id", `icon-def-${uniqueGroupNames.indexOf(group)}`) // Use index for stable ID
                .attr("xlink:href", iconUrl)
                .attr("width", 24) // Default size, can be overridden by use
                .attr("height", 24)
                .attr("x", -12) // Centered
                .attr("y", -12);
        }
    });
    
    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 25, bottom: 60, left: 70 };
    if (uniqueGroupNames.length > 0) chartMargins.top = 80; // More space for legend

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const numPoints = chartData.length;
    const circleRadius = numPoints <= 15 ? 15 : Math.max(10, 15 - (numPoints - 15) / 20);

    // Block 6: Scale Definition & Configuration
    const xExtent = d3.extent(chartData, d => d[xAxisDataFieldName]);
    const yExtent = d3.extent(chartData, d => d[yAxisDataFieldName]);

    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartData, xAxisDataFieldName);
    const xIsUneven = isDistributionUneven(chartData, xAxisDataFieldName);
    
    const xScale = (!xHasNegativeOrZero && xIsUneven && xExtent[0] > 0) 
        ? d3.scaleLog()
            .domain([Math.max(xExtent[0] * 0.9, 0.001), xExtent[1] * 1.1])
            .range([0, innerWidth])
        : d3.scaleLinear()
            .domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1])
            .range([0, innerWidth]);
    if (xScale.domain()[0] === xScale.domain()[1]) { // Handle single data point for domain
        xScale.domain([xScale.domain()[0] * 0.9 || -1, xScale.domain()[1] * 1.1 || 1]);
    }


    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartData, yAxisDataFieldName);
    const yIsUneven = isDistributionUneven(chartData, yAxisDataFieldName);

    const yScale = (!yHasNegativeOrZero && yIsUneven && yExtent[0] > 0)
        ? d3.scaleLog()
            .domain([Math.max(yExtent[0] * 0.9, 0.001), yExtent[1] * 1.1])
            .range([innerHeight, 0])
        : d3.scaleLinear()
            .domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1])
            .range([innerHeight, 0]);
    if (yScale.domain()[0] === yScale.domain()[1]) { // Handle single data point for domain
         yScale.domain([yScale.domain()[0] * 0.9 || -1, yScale.domain()[1] * 1.1 || 1]);
    }


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Gridlines
    const xGridCount = 8;
    const yGridCount = 6;
    const xGridPositions = generateGridPositions(xScale, xGridCount, xScale.domain());
    const yGridPositions = generateGridPositions(yScale, yGridCount, yScale.domain());

    mainChartGroup.append("g")
        .attr("class", "grid x-grid")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .tickSize(-innerHeight)
            .tickFormat("")
            .tickValues(xGridPositions)
        )
        .selectAll("line")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-opacity", 0.7);
    mainChartGroup.selectAll(".grid.x-grid path").style("stroke", "none");

    mainChartGroup.append("g")
        .attr("class", "grid y-grid")
        .call(d3.axisLeft(yScale)
            .tickSize(-innerWidth)
            .tickFormat("")
            .tickValues(yGridPositions)
        )
        .selectAll("line")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-opacity", 0.7);
    mainChartGroup.selectAll(".grid.y-grid path").style("stroke", "none");
    mainChartGroup.selectAll(".grid").lower();

    // Axes
    const xAxis = d3.axisBottom(xScale)
        .tickSize(0)
        .tickPadding(10)
        .ticks((!xHasNegativeOrZero && xIsUneven && xExtent[0] > 0) ? 5 : 6)
        .tickFormat(d => formatAxisValue(d));
        
    const yAxis = d3.axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10)
        .ticks((!yHasNegativeOrZero && yIsUneven && yExtent[0] > 0) ? 5 : 6)
        .tickFormat(d => formatAxisValue(d));

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("path")
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1)
        .style("opacity", 0.5);
    xAxisGroup.selectAll("text")
        .attr("class", "label axis-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    yAxisGroup.selectAll("path")
        .style("stroke", fillStyle.axisLineColor)
        .style("stroke-width", 1)
        .style("opacity", 0.5);
    yAxisGroup.selectAll("text")
        .attr("class", "label axis-label")
        .style("fill", fillStyle.textColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight);
    
    // Axis Titles
    mainChartGroup.append("text")
        .attr("class", "label axis-title")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + chartMargins.bottom - 10)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", "bold")
        .style("fill", fillStyle.textColor)
        .text(xAxisFieldTitle);
        
    mainChartGroup.append("text")
        .attr("class", "label axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -chartMargins.left + 20)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", "bold")
        .style("fill", fillStyle.textColor)
        .text(yAxisFieldTitle);

    // Legend
    if (uniqueGroupNames.length > 0) {
        const legendFontSize = parseFloat(fillStyle.typography.labelFontSize);
        const legendSquareSize = 20;
        const legendItemPadding = 5;
        const legendColumnPadding = 15;
        const legendTopMargin = - (chartMargins.top / 2) -10 ; // Position above chart area

        const legendContainerGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${chartMargins.left}, ${legendTopMargin + 30})`);

        const legendTitle = legendContainerGroup.append("text")
            .attr("class", "label legend-title")
            .attr("x", 0)
            .attr("y", 0) 
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${legendFontSize}px`)
            .style("font-weight", "bold")
            .style("fill", fillStyle.textColor)
            .text(groupFieldTitle + ":");
        
        const titleWidth = legendTitle.node().getBBox().width;
        let currentX = titleWidth + 10;

        uniqueGroupNames.forEach((groupName, index) => {
            const legendItem = legendContainerGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, 0)`);
            
            const iconUrl = fillStyle.getGroupIconUrl(groupName);
            if (iconUrl && defs.select(`#icon-def-${index}`).size() > 0) {
                legendItem.append("use")
                    .attr("xlink:href", `#icon-def-${index}`)
                    .attr("class", "icon mark legend-mark")
                    .attr("width", legendSquareSize)
                    .attr("height", legendSquareSize)
                    .attr("x", -legendSquareSize / 2) // Centering the 'use' content
                    .attr("y", -legendSquareSize / 2)
                    .attr("transform", `translate(${legendSquareSize/2}, 0)`);
            } else {
                legendItem.append("circle")
                    .attr("class", "mark legend-mark")
                    .attr("cx", legendSquareSize / 2)
                    .attr("cy", 0)
                    .attr("r", legendSquareSize / 2)
                    .style("fill", fillStyle.getGroupColor(groupName));
            }
            
            const legendText = legendItem.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendSquareSize + legendItemPadding)
                .attr("y", 0)
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${legendFontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(groupName);
            
            currentX += legendSquareSize + legendItemPadding + legendText.node().getBBox().width + legendColumnPadding;
        });
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    function findOptimalPosition(d, allPointsData, currentPositions = {}) {
        const positions = [
            { x: circleRadius + 5, y: 0, anchor: "start", priority: 1 },   // right
            { x: 0, y: -(circleRadius + 5), anchor: "middle", priority: 2 },// top
            { x: -(circleRadius + 5), y: 0, anchor: "end", priority: 3 },   // left
            { x: 0, y: circleRadius + 12, anchor: "middle", priority: 4 },  // bottom (12 for text height)
        ];

        const pointX = xScale(d[xAxisDataFieldName]);
        const pointY = yScale(d[yAxisDataFieldName]);

        if (currentPositions[d[pointLabelFieldName]]) {
            return currentPositions[d[pointLabelFieldName]];
        }

        const textMetrics = estimateTextMetrics(d[pointLabelFieldName], {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        });
        const labelWidth = textMetrics.width;
        const labelHeight = textMetrics.height;

        for (const pos of positions) {
            let hasOverlap = false;
            let labelX1 = pointX + pos.x;
            let labelY1 = pointY + pos.y;

            if (pos.anchor === "middle") labelX1 -= labelWidth / 2;
            else if (pos.anchor === "end") labelX1 -= labelWidth;
            
            // Adjust Y for vertical centering if needed, or baseline
            labelY1 -= labelHeight / 2; // Assuming y is center of text
            if (pos.priority === 2) labelY1 -= labelHeight/2; // top
            if (pos.priority === 4) labelY1 += labelHeight/2; // bottom

            const labelX2 = labelX1 + labelWidth;
            const labelY2 = labelY1 + labelHeight;

            if (labelX1 < -5 || labelX2 > innerWidth + 5 || labelY1 < -5 || labelY2 > innerHeight + 5) { // Allow small overflow
                continue;
            }

            for (const otherPoint of allPointsData) {
                if (otherPoint === d) continue;
                const otherPointX = xScale(otherPoint[xAxisDataFieldName]);
                const otherPointY = yScale(otherPoint[yAxisDataFieldName]);

                // Check overlap with other points
                if (labelX1 < otherPointX + circleRadius && labelX2 > otherPointX - circleRadius &&
                    labelY1 < otherPointY + circleRadius && labelY2 > otherPointY - circleRadius) {
                    hasOverlap = true; break;
                }
                
                // Check overlap with other labels
                const otherLabelPos = currentPositions[otherPoint[pointLabelFieldName]];
                if (otherLabelPos && otherLabelPos.canShow) {
                     const otherMetrics = estimateTextMetrics(otherPoint[pointLabelFieldName], {
                        fontFamily: fillStyle.typography.annotationFontFamily,
                        fontSize: fillStyle.typography.annotationFontSize,
                        fontWeight: fillStyle.typography.annotationFontWeight
                    });
                    let otherLX1 = xScale(otherPoint[xAxisDataFieldName]) + otherLabelPos.x;
                    let otherLY1 = yScale(otherPoint[yAxisDataFieldName]) + otherLabelPos.y;
                    if (otherLabelPos.anchor === "middle") otherLX1 -= otherMetrics.width / 2;
                    else if (otherLabelPos.anchor === "end") otherLX1 -= otherMetrics.width;
                    otherLY1 -= otherMetrics.height / 2;
                     if (otherLabelPos.priority === 2) otherLY1 -= otherMetrics.height/2;
                     if (otherLabelPos.priority === 4) otherLY1 += otherMetrics.height/2;


                    const otherLX2 = otherLX1 + otherMetrics.width;
                    const otherLY2 = otherLY1 + otherMetrics.height;

                    if (labelX1 < otherLX2 && labelX2 > otherLX1 && labelY1 < otherLY2 && labelY2 > otherLY1) {
                        hasOverlap = true; break;
                    }
                }
            }
            if (!hasOverlap) return { ...pos, canShow: true };
        }
        return { ...positions[0], canShow: false }; // Default, hide if all overlap
    }
    
    const pointGroups = mainChartGroup.selectAll(".data-point-group")
        .data(chartData)
        .enter()
        .append("g")
        .attr("class", "mark data-point-group")
        .attr("transform", d => `translate(${xScale(d[xAxisDataFieldName])}, ${yScale(d[yAxisDataFieldName])})`);

    pointGroups.append("circle")
        .attr("class", "mark point-background")
        .attr("r", circleRadius)
        .style("fill", d => fillStyle.getGroupColor(d[groupFieldName]))
        .style("stroke", d => d3.color(fillStyle.getGroupColor(d[groupFieldName])).darker(0.5))
        .style("stroke-width", 1);
        
    pointGroups.each(function(d) {
        const groupName = d[groupFieldName];
        const iconUrl = fillStyle.getGroupIconUrl(groupName);
        const groupIndex = uniqueGroupNames.indexOf(groupName);
        if (iconUrl && defs.select(`#icon-def-${groupIndex}`).size() > 0) {
            d3.select(this).append("use")
                .attr("xlink:href", `#icon-def-${groupIndex}`)
                .attr("class", "icon mark point-icon")
                .attr("width", circleRadius * 1.8) // Slightly smaller than circle for padding
                .attr("height", circleRadius * 1.8)
                .attr("x", -circleRadius * 0.9)
                .attr("y", -circleRadius * 0.9);
        }
    });
    
    let labelPositions = {};
    chartData.forEach(d => {
        labelPositions[d[pointLabelFieldName]] = findOptimalPosition(d, chartData, labelPositions);
    });

    pointGroups.append("text")
        .attr("class", "label data-label")
        .attr("x", d => labelPositions[d[pointLabelFieldName]].x)
        .attr("y", d => labelPositions[d[pointLabelFieldName]].y)
        .attr("text-anchor", d => labelPositions[d[pointLabelFieldName]].anchor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .style("opacity", d => labelPositions[d[pointLabelFieldName]].canShow ? 1 : 0)
        .text(d => d[pointLabelFieldName]);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip chart-tooltip") // Added chart-tooltip for better scoping if needed
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background-color", "rgba(255,255,255,0.9)")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("padding", "8px")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", "11px")
        .style("pointer-events", "none"); // Prevent tooltip from interfering with mouse events

    pointGroups
        .on("mouseover", function(event, d) {
            d3.select(this)
                .transition().duration(100)
                .attr("transform", `translate(${xScale(d[xAxisDataFieldName])}, ${yScale(d[yAxisDataFieldName])}) scale(1.2)`);
            
            d3.select(this).select(".data-label")
                .style("font-weight", "bold")
                .style("opacity", 1); // Ensure label is visible on hover
                
            tooltip.transition().duration(200).style("opacity", 0.95);
            tooltip.html(
                `<strong>${d[pointLabelFieldName]}</strong><br/>` +
                `${groupFieldTitle}: ${d[groupFieldName]}<br/>` +
                `${xAxisFieldTitle}: ${formatAxisValue(d[xAxisDataFieldName])}<br/>` +
                `${yAxisFieldTitle}: ${formatAxisValue(d[yAxisDataFieldName])}`
            )
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 15) + "px");
        })
        .on("mouseout", function(event, d) {
            d3.select(this)
                .transition().duration(100)
                .attr("transform", `translate(${xScale(d[xAxisDataFieldName])}, ${yScale(d[yAxisDataFieldName])}) scale(1.0)`);
            
            d3.select(this).select(".data-label")
                .style("font-weight", fillStyle.typography.annotationFontWeight) // Reset to original
                .style("opacity", labelPositions[d[pointLabelFieldName]].canShow ? 1 : 0); // Reset opacity
                
            tooltip.transition().duration(300).style("opacity", 0);
        });

    // Block 10: Cleanup & SVG Node Return
    // Tooltip is appended to body, typically managed by the page context or removed if chart is destroyed.
    return svgRoot.node();
}