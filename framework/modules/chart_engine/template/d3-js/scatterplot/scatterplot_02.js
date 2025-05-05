/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Scatterplot",
    "chart_name": "scatterplot_02",
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
    "required_fields_range": [[8, 150], ["-inf", "inf"], ["-inf", "inf"]],
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
    
    // 创建临时SVG计算文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
        
    // 创建临时axis获取标签
    const yExtent = d3.extent(chartData, d => d[y2Field]);
    const tempYScale = d3.scaleLinear()
        .domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1])
        .range([height, 0]);
    
    const tempYAxis = d3.axisLeft(tempYScale);
    const tempG = tempSvg.append("g").call(tempYAxis);
    
    // 计算最长标签的宽度
    let maxLabelWidth = 0;
    tempG.selectAll(".tick text")
        .each(function() {
            const textWidth = this.getBBox().width;
            if (textWidth > maxLabelWidth) {
                maxLabelWidth = textWidth;
            }
        });
    
    // 移除临时SVG
    tempSvg.remove();
    
    // 根据最长标签计算左边距，加上一些额外空间和y轴标题空间
    const leftMargin = Math.max(50, maxLabelWidth + 20 + 25); // 标签宽度 + tick线 + 标题空间
    
    const margin = { top: 25, right: 25, bottom: 50, left: leftMargin };
    
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
    
    // 使用线性比例尺，确保支持负值
    const xScale = d3.scaleLinear()
        .domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1])
        .range([0, chartWidth]);
            
    const yScale = d3.scaleLinear()
        .domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1])
        .range([chartHeight, 0]);
    
    // Create axes with grid lines
    const xAxis = d3.axisBottom(xScale)
        .tickSize(-chartHeight)
        .tickPadding(10);
        
    const yAxis = d3.axisLeft(yScale)
        .tickSize(-chartWidth)
        .tickPadding(10);
    
    // Add X axis
    const xAxisGroup = g.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis);

    // Add Y axis
    const yAxisGroup = g.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);
        
    // 修改网格线样式 - 必须先选择tick线条
    g.selectAll(".tick line")
        .style("stroke", "#ddd")
        .style("stroke-width", 0.5)
        .style("opacity", 0.5);
    
    // 移除轴线域路径
    g.selectAll(".domain").remove();
    
    // 设置轴刻度文本样式
    g.selectAll(".tick text")
        .style("color", colors.text_color)
        .style("font-size", "10px");
    
    // 添加参考线 - 零轴 (放在网格线之后，保证在上层)
    g.append("line")
        .attr("x1", 0)
        .attr("y1", yScale(0))
        .attr("x2", chartWidth)
        .attr("y2", yScale(0))
        .style("stroke", "#000")
        .style("stroke-width", 1)
        .style("opacity", 0.5);
        
    g.append("line")
        .attr("x1", xScale(0))
        .attr("y1", 0)
        .attr("x2", xScale(0))
        .attr("y2", chartHeight)
        .style("stroke", "#000")
        .style("stroke-width", 1)
        .style("opacity", 0.5);
    
    // Add axis titles
    g.append("text")
        .attr("class", "axis-title")
        .attr("x", chartWidth / 2)
        .attr("y", chartHeight + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .attr("font-size", 13)
        .text("Difference in yards per attempt");
        
    // 修改Y轴标题的位置，根据左边距自适应
    g.append("text")
        .attr("class", "axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -chartHeight / 2)
        .attr("y", -margin.left + Math.min(30, leftMargin / 3)) // 根据边距自适应调整
        .attr("text-anchor", "middle")
        .attr("font-size", 13)
        .text("Difference in points above replacement");
    
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

        // 如果已经有位置分配，直接返回
        if (currentPositions[d[xField]]) {
            return currentPositions[d[xField]];
        }

        // 创建临时文本元素来测量实际文本大小
        const tempText = g.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", "10px")
            .text(d[xField]);
        const textBBox = tempText.node().getBBox();
        tempText.remove();

        const labelWidth = textBBox.width;
        const labelHeight = textBBox.height;

        // 贪心算法：按优先级顺序尝试每个位置，选择第一个没有重叠的位置
        for (const pos of positions) {
            let hasOverlap = false;

            // 计算标签边界
            let labelX1, labelY1, labelX2, labelY2;

            if (pos.priority === 1) { // right
                labelX1 = pointX + 20;
                labelY1 = pointY - labelHeight / 2;
            } else if (pos.priority === 2) { // top
                labelX1 = pointX - labelWidth / 2;
                labelY1 = pointY - 20 - labelHeight;
            } else if (pos.priority === 3) { // left
                labelX1 = pointX - 20 - labelWidth;
                labelY1 = pointY - labelHeight / 2;
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
                continue;
            }

            // 检查与其他点及其标签的重叠
            for (const p of allPoints) {
                if (p === d) continue;

                const pX = xScale(p[yField]);
                const pY = yScale(p[y2Field]);

                // 检查与点的重叠
                const pointRadius = circleRadius;
                const dx = labelX1 + labelWidth/2 - pX;
                const dy = labelY1 + labelHeight/2 - pY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < pointRadius + Math.sqrt(labelWidth * labelWidth + labelHeight * labelHeight) / 2) {
                    hasOverlap = true;
                    break;
                }

                // 检查与其他标签的重叠
                const pPos = currentPositions[p[xField]];
                if (pPos) {
                    const tempText = g.append("text")
                        .style("font-family", typography.label.font_family)
                        .style("font-size", "10px")
                        .text(p[xField]);
                    const otherBBox = tempText.node().getBBox();
                    tempText.remove();

                    let otherX1, otherY1;
                    if (pPos.anchor === "start") {
                        otherX1 = pX + pPos.x;
                        otherY1 = pY + pPos.y - otherBBox.height/2;
                    } else if (pPos.anchor === "middle") {
                        otherX1 = pX + pPos.x - otherBBox.width/2;
                        otherY1 = pY + pPos.y;
                    } else {
                        otherX1 = pX + pPos.x - otherBBox.width;
                        otherY1 = pY + pPos.y - otherBBox.height/2;
                    }

                    if (labelX1 < otherX1 + otherBBox.width && labelX2 > otherX1 &&
                        labelY1 < otherY1 + otherBBox.height && labelY2 > otherY1) {
                        hasOverlap = true;
                        break;
                    }
                }
            }

            if (!hasOverlap) {
                return { ...pos, canShow: true };
            }
        }

        // 如果所有位置都有重叠，返回优先级最高的位置，但标记为不显示
        return { ...positions[0], canShow: false };
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
    
    // Add white circular background
    points.append("circle")
        .attr("r", circleRadius)
        .attr("fill", "white")
        .attr("stroke", "white")
        .attr("stroke-width", 4);
    
    // Add icon images
    points.append("image")
        .attr("xlink:href", d => images.field[d[xField]])
        .attr("width", circleRadius * 2)
        .attr("height", circleRadius * 2)
        .attr("x", -circleRadius)
        .attr("y", -circleRadius);
    
    // Calculate optimal positions for all labels
    let labelPositions = {};
    chartData.forEach(d => {
        labelPositions[d[xField]] = findOptimalPosition(d, chartData, labelPositions);
    });

    // Add labels with optimized positions, only showing non-overlapping ones
    points.append("text")
        .attr("class", "data-label")
        .attr("x", d => labelPositions[d[xField]].x)
        .attr("y", d => labelPositions[d[xField]].y)
        .attr("text-anchor", d => labelPositions[d[xField]].anchor)
        .style("font-family", typography.label.font_family)
        .style("font-size", 10)
        .style("font-weight", typography.label.font_weight)
        .style("opacity", d => labelPositions[d[xField]].canShow ? 1 : 0)
        .text(d => d[xField]);
    
    return svg.node();
}