/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Bubble Chart",
    "chart_name": "bubble_chart_01",
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
    "required_fields_range": [[8, 150], [0, "inf"], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": ["primary"],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner"],
    "min_height": 750,
    "min_width": 750,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // Extract data
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    const colors = jsonData.colors;
    
    // Clear container
    d3.select(containerSelector).html("");
    
    // Get field names
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const y2Field = dataColumns[2].name;
    
    // Set dimensions and margins
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 25, right: 25, bottom: 50, left: 50 };
    
    // Create SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // Create chart area
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // Create scales
    const xExtent = d3.extent(chartData, d => d[yField]);
    const yExtent = d3.extent(chartData, d => d[y2Field]);
    
    // 检查数据是否包含负值或0值
    function hasNegativeOrZeroValues(data, field) {
        return data.some(d => d[field] <= 0);
    }
    
    // 判断数据分布是否不均匀
    function isDistributionUneven(data, field) {
        const values = data.map(d => d[field]);
        const extent = d3.extent(values);
        const range = extent[1] - extent[0];
        const median = d3.median(values);
        const q1 = d3.quantile(values.sort(d3.ascending), 0.25);
        const q3 = d3.quantile(values.sort(d3.ascending), 0.75);
        const iqr = q3 - q1;
        
        // 不均匀分布的判断标准
        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1])/2) > range * 0.2;
    }
    
    // 为X轴创建合适的比例尺
    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartData, yField);
    const xIsUneven = isDistributionUneven(chartData, yField);
    
    const xScale = (!xHasNegativeOrZero && xIsUneven) 
        ? d3.scaleLog()
            .domain([Math.max(xExtent[0] * 0.9, 0.1), xExtent[1] * 1.1])
            .range([0, chartWidth])
        : d3.scaleLinear()
            .domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1])
            .range([0, chartWidth]);
            
    // 为Y轴创建合适的比例尺
    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartData, y2Field);
    const yIsUneven = isDistributionUneven(chartData, y2Field);
    
    const yScale = (!yHasNegativeOrZero && yIsUneven)
        ? d3.scaleLog()
            .domain([Math.max(yExtent[0] * 0.9, 0.1), yExtent[1] * 1.1])
            .range([chartHeight, 0])
        : d3.scaleLinear()
            .domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1])
            .range([chartHeight, 0]);
    
    // Create axes
    const xAxis = d3.axisBottom(xScale)
        .tickSize(0)
        .tickPadding(10);
        
    const yAxis = d3.axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10);
    
    // Add X axis
    const xAxisGroup = g.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis)

    xAxisGroup
        .selectAll("path")
        .style("stroke", colors.text_color)
        .style("stroke-width", 1)
        .style("opacity", 0.5)

    xAxisGroup
        .selectAll("text")
        .style("color", colors.text_color)
        
    // Add Y axis
    const yAxisGroup = g.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis)
        .style("color", colors.text_color)
        .style("fill", "black");

    yAxisGroup
        .selectAll("path")
        .style("stroke", colors.text_color)
        .style("stroke-width", 1)
        .style("opacity", 0.5)

    yAxisGroup
        .selectAll("text")
        .style("color", colors.text_color)
    
    // Add axis titles
    g.append("text")
        .attr("class", "axis-title")
        .attr("x", chartWidth)
        .attr("y", chartHeight + margin.bottom / 2 + 15)
        .attr("text-anchor", "end")
        .attr("font-size", 13)
        .text(yField);
        
    g.append("text")
        .attr("class", "axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -margin.top)
        .attr("y", -margin.left / 2 - 10)
        .attr("text-anchor", "end")
        .attr("font-size", 13)
        .text(y2Field);
    
    // Create tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    // Helper function to find optimal label position
    function findOptimalPosition(d, allPoints, currentPositions = {}) {
        const positions = [
            { x: 20, y: 4, anchor: "start", priority: 1 },         // right
            { x: 0, y: -20, anchor: "middle", priority: 2 },       // top
            { x: -20, y: 4, anchor: "end", priority: 3 },          // left
            { x: 0, y: 28, anchor: "middle", priority: 4 },        // bottom
            { x: 20, y: -20, anchor: "start", priority: 5 },       // top-right
            { x: -20, y: -20, anchor: "end", priority: 6 },        // top-left
            { x: -20, y: 28, anchor: "end", priority: 7 },         // bottom-left
            { x: 20, y: 28, anchor: "start", priority: 8 }         // bottom-right
        ];
        
        const pointX = xScale(d[yField]);
        const pointY = yScale(d[y2Field]);
        const fontSize = 10;
        const labelWidth = d[xField].length * fontSize * 0.6;
        const labelHeight = fontSize * 1.2;
        
        // 如果已经有位置分配，直接返回
        if (currentPositions[d[xField]]) {
            return currentPositions[d[xField]];
        }
        
        // 贪心算法：按优先级顺序尝试每个位置，选择第一个没有重叠的位置
        for (const pos of positions) {
            let hasOverlap = false;
            
            // 计算标签边界
            let labelX1, labelY1, labelX2, labelY2;
            
            if (pos.priority === 1) { // right
                labelX1 = pointX + 20;
                labelY1 = pointY - labelHeight/2;
            } else if (pos.priority === 2) { // top
                labelX1 = pointX - labelWidth / 2;
                labelY1 = pointY - 20 - labelHeight;
            } else if (pos.priority === 3) { // left
                labelX1 = pointX - 20 - labelWidth;
                labelY1 = pointY - labelHeight/2;
            } else if (pos.priority === 4) { // bottom
                labelX1 = pointX - labelWidth / 2;
                labelY1 = pointY + 20;
            } else if (pos.priority === 5) { // top-right
                labelX1 = pointX + 15;
                labelY1 = pointY - 15 - labelHeight;
            } else if (pos.priority === 6) { // top-left
                labelX1 = pointX - 15 - labelWidth;
                labelY1 = pointY - 15 - labelHeight;
            } else if (pos.priority === 7) { // bottom-left
                labelX1 = pointX - 15 - labelWidth;
                labelY1 = pointY + 15;
            } else { // bottom-right
                labelX1 = pointX + 15;
                labelY1 = pointY + 15;
            }
            
            labelX2 = labelX1 + labelWidth;
            labelY2 = labelY1 + labelHeight;
            
            // 检查边界约束
            if (labelX1 < 0 || labelX2 > chartWidth || labelY1 < 0 || labelY2 > chartHeight) {
                hasOverlap = true;
                continue;
            }
            
            // 检查与其他点及其标签的重叠
            for (const p of allPoints) {
                if (p === d) continue; // 跳过自身
                
                const pX = xScale(p[yField]);
                const pY = yScale(p[y2Field]);
                
                // 检查这个点是否已经分配了位置
                const pPos = currentPositions[p[xField]];
                if (pPos) {
                    // 根据分配的位置计算其他标签的边界
                    let otherLabelX1, otherLabelY1, otherLabelX2, otherLabelY2;
                    const otherLabelWidth = p[xField].length * fontSize * 0.6;
                    const otherLabelHeight = fontSize * 1.2;
                    
                    if (pPos.priority === 1) {
                        otherLabelX1 = pX + 20;
                        otherLabelY1 = pY - otherLabelHeight/2;
                    } else if (pPos.priority === 2) {
                        otherLabelX1 = pX - otherLabelWidth / 2;
                        otherLabelY1 = pY - 20 - otherLabelHeight;
                    } else if (pPos.priority === 3) {
                        otherLabelX1 = pX - 20 - otherLabelWidth;
                        otherLabelY1 = pY - otherLabelHeight/2;
                    } else if (pPos.priority === 4) {
                        otherLabelX1 = pX - otherLabelWidth / 2;
                        otherLabelY1 = pY + 20;
                    } else if (pPos.priority === 5) {
                        otherLabelX1 = pX + 15;
                        otherLabelY1 = pY - 15 - otherLabelHeight;
                    } else if (pPos.priority === 6) {
                        otherLabelX1 = pX - 15 - otherLabelWidth;
                        otherLabelY1 = pY - 15 - otherLabelHeight;
                    } else if (pPos.priority === 7) {
                        otherLabelX1 = pX - 15 - otherLabelWidth;
                        otherLabelY1 = pY + 15;
                    } else {
                        otherLabelX1 = pX + 15;
                        otherLabelY1 = pY + 15;
                    }
                    
                    otherLabelX2 = otherLabelX1 + otherLabelWidth;
                    otherLabelY2 = otherLabelY1 + otherLabelHeight;
                    
                    // 检查标签是否重叠
                    if (labelX1 < otherLabelX2 && labelX2 > otherLabelX1 && 
                        labelY1 < otherLabelY2 && labelY2 > otherLabelY1) {
                        hasOverlap = true;
                        break;
                    }
                } else {
                    // 如果尚未分配位置，使用点重叠检测
                    const pointRadius = 20;
                    if (pX + pointRadius > labelX1 && pX - pointRadius < labelX2 && 
                        pY + pointRadius > labelY1 && pY - pointRadius < labelY2) {
                        hasOverlap = true;
                        break;
                    }
                }
            }
            
            // 如果没有重叠，返回这个位置
            if (!hasOverlap) {
                return pos;
            }
        }
        
        // 如果所有位置都有重叠，返回优先级最高的位置
        return positions[0];
    }
    // Determine circle size based on number of data points
    const numPoints = chartData.length;
    const circleRadius = numPoints <= 15 ? 15 : Math.max(10, 15 - (numPoints - 15) / 20);
    
    // Add data points
    const points = g.selectAll(".data-point")
        .data(chartData)
        .enter()
        .append("g")
        .attr("class", "data-point")
        .attr("transform", d => `translate(${xScale(d[yField])}, ${yScale(d[y2Field])})`);
    
    // random radius factor between 1 and 1.5
    const radiusFactor = Math.random() * 0.5 + 1;

    
    // Add white circular background
    points.append("circle")
        .attr("r", circleRadius * radiusFactor)
        .attr("fill", "white")
        .attr("stroke", "white")
        .attr("stroke-width", 4);
    
    // Add icon images
    points.append("image")
        .attr("xlink:href", d => images.field[d[xField]])
        .attr("width", circleRadius * 2 * radiusFactor)
        .attr("height", circleRadius * 2 * radiusFactor)
        .attr("x", -circleRadius * radiusFactor)
        .attr("y", -circleRadius * radiusFactor);
    
    // Iteratively optimize label positions to minimize overlaps
    let currentPositions = {};
    let totalOverlaps = Infinity;
    let iterations = 0;
    const MAX_ITERATIONS = 3;  // Limit iterations to prevent infinite loops
    
    while (iterations < MAX_ITERATIONS) {
        let newPositions = {};
        let newTotalOverlaps = 0;
        
        // Assign positions for all points
        chartData.forEach(d => {
            const bestPosition = findOptimalPosition(d, chartData, currentPositions);
            newPositions[d[xField]] = bestPosition;
            newTotalOverlaps += bestPosition.overlaps;
        });
        
        // If no improvement or no overlaps, stop iterating
        if (newTotalOverlaps >= totalOverlaps || newTotalOverlaps === 0) {
            break;
        }
        
        // Update positions for next iteration
        currentPositions = newPositions;
        totalOverlaps = newTotalOverlaps;
        iterations++;
    }
    
    // Check for label overlaps and only display non-overlapping labels
    const labelPositions = [];
    
    // Add labels with optimized positions
    points.each(function(d) {
        const bestPosition = currentPositions[d[xField]] || findOptimalPosition(d, chartData);
        const pointX = xScale(d[yField]);
        const pointY = yScale(d[y2Field]);
        
        const labelWidth = d[xField].length * 8;
        const labelHeight = 16;
        
        let labelX1, labelY1, labelX2, labelY2;
        
        if (bestPosition.priority === 1) { // right
            labelX1 = pointX + 26;
            labelY1 = pointY - 8;
        } else if (bestPosition.priority === 2) { // top
            labelX1 = pointX - labelWidth / 2;
            labelY1 = pointY - 26 - labelHeight;
        } else if (bestPosition.priority === 3) { // left
            labelX1 = pointX - 26 - labelWidth;
            labelY1 = pointY - 8;
        } else if (bestPosition.priority === 4) { // bottom
            labelX1 = pointX - labelWidth / 2;
            labelY1 = pointY + 26;
        } else if (bestPosition.priority === 5) { // top-right
            labelX1 = pointX + 20;
            labelY1 = pointY - 20 - labelHeight;
        } else if (bestPosition.priority === 6) { // top-left
            labelX1 = pointX - 20 - labelWidth;
            labelY1 = pointY - 20 - labelHeight;
        } else if (bestPosition.priority === 7) { // bottom-left
            labelX1 = pointX - 20 - labelWidth;
            labelY1 = pointY + 20;
        } else { // bottom-right
            labelX1 = pointX + 20;
            labelY1 = pointY + 20;
        }
        
        labelX2 = labelX1 + labelWidth;
        labelY2 = labelY1 + labelHeight;
        
        // Check if this label overlaps with any previously placed label
        let hasOverlap = false;
        for (const pos of labelPositions) {
            if (labelX1 < pos.x2 && labelX2 > pos.x1 && 
                labelY1 < pos.y2 && labelY2 > pos.y1) {
                hasOverlap = true;
                break;
            }
        }
        
        // Only add the label if it doesn't overlap
        if (!hasOverlap) {
            d3.select(this).append("text")
                .attr("class", "data-label")
                .attr("x", bestPosition.x)
                .attr("y", bestPosition.y)
                .attr("text-anchor", bestPosition.anchor)
                .style("font-family", typography.label.font_family)
                .style("font-size", 10)
                .style("font-weight", typography.label.font_weight)
                .text(d[xField]);
            
            // Add this label's position to the array
            labelPositions.push({
                x1: labelX1,
                y1: labelY1,
                x2: labelX2,
                y2: labelY2
            });
        }
    });
    
    // Add interactivity
    points
        .on("mouseover", function(event, d) {
            d3.select(this).select("image")
                .attr("width", circleRadius * 2 + 3)
                .attr("height", circleRadius * 2 + 3)
                .attr("x", -(circleRadius + 1.5))
                .attr("y", -(circleRadius + 1.5));
                
            d3.select(this).select(".data-label")
                .style("font-weight", "bold");
                
            tooltip.transition()
                .duration(200)
                .style("opacity", 0.9);
            tooltip.html(`<strong>${d[xField]}</strong><br/>${yField}: ${d[yField]}<br/>${y2Field}: ${d[y2Field]}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).select("image")
                .attr("width", circleRadius * 2)
                .attr("height", circleRadius * 2)
                .attr("x", -circleRadius)
                .attr("y", -circleRadius);
                
            d3.select(this).select(".data-label")
                .style("font-weight", "normal");
                
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    
    return svg.node();
}