`
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
`

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
    
    // 检查label是否应该显示 - 根据数据点数量限制标签显示
    function shouldShowLabel(d, allPoints, index) {
        // 如果数据点数量少于等于8个，全部显示标签
        if (allPoints.length <= 8) {
            return true;
        }
        
        // 如果数据点数量在9-15之间，只显示重要的点（例如四个象限的边缘点和中心附近的点）
        if (allPoints.length <= 15) {
            // 对点进行排序，找出四个象限边缘的点
            const sortedByX = [...allPoints].sort((a, b) => a[yField] - b[yField]);
            const sortedByY = [...allPoints].sort((a, b) => a[y2Field] - b[y2Field]);
            
            // 最左、最右、最上、最下的点
            const extremePoints = [
                sortedByX[0], // 最左
                sortedByX[sortedByX.length - 1], // 最右
                sortedByY[0], // 最下
                sortedByY[sortedByY.length - 1], // 最上
            ];
            
            // 添加四象限的极值点
            const quadrants = [
                {x: 1, y: 1}, {x: -1, y: 1}, {x: -1, y: -1}, {x: 1, y: -1}
            ];
            
            quadrants.forEach(q => {
                let bestPoint = null;
                let maxDistance = -Infinity;
                
                allPoints.forEach(p => {
                    const xValue = p[yField];
                    const yValue = p[y2Field];
                    
                    // 检查点是否在正确的象限
                    if ((xValue > 0 && q.x > 0 || xValue < 0 && q.x < 0) && 
                        (yValue > 0 && q.y > 0 || yValue < 0 && q.y < 0)) {
                        // 计算距离原点的距离
                        const distance = Math.sqrt(xValue * xValue + yValue * yValue);
                        if (distance > maxDistance) {
                            maxDistance = distance;
                            bestPoint = p;
                        }
                    }
                });
                
                if (bestPoint && !extremePoints.includes(bestPoint)) {
                    extremePoints.push(bestPoint);
                }
            });
            
            return extremePoints.includes(d);
        }
        
        // 如果数据点数量大于15，更严格地限制标签显示
        // 1. 显示极值点
        // 2. 每个象限最多显示一个点
        // 3. 确保标签有足够的间距
        
        // 极值点检查（最左，最右，最上，最下）
        const sortedByX = [...allPoints].sort((a, b) => a[yField] - b[yField]);
        const sortedByY = [...allPoints].sort((a, b) => a[y2Field] - b[y2Field]);
        
        const extremePoints = [
            sortedByX[0], // 最左
            sortedByX[sortedByX.length - 1], // 最右
            sortedByY[0], // 最下
            sortedByY[sortedByY.length - 1], // 最上
        ];
        
        if (extremePoints.includes(d)) {
            return true;
        }
        
        // 计算象限
        const quadrant = 
            d[yField] >= 0 && d[y2Field] >= 0 ? 1 :
            d[yField] < 0 && d[y2Field] >= 0 ? 2 :
            d[yField] < 0 && d[y2Field] < 0 ? 3 : 4;
        
        // 对每个象限选择一个代表点（离中心最远的点）
        const pointsInSameQuadrant = allPoints.filter(p => {
            const q = 
                p[yField] >= 0 && p[y2Field] >= 0 ? 1 :
                p[yField] < 0 && p[y2Field] >= 0 ? 2 :
                p[yField] < 0 && p[y2Field] < 0 ? 3 : 4;
            return q === quadrant;
        });
        
        // 如果这个象限只有一个点，显示它
        if (pointsInSameQuadrant.length === 1) {
            return true;
        }
        
        // 否则，选择离原点最远的点
        let maxDistance = -Infinity;
        let farthestPoint = null;
        
        pointsInSameQuadrant.forEach(p => {
            const distance = Math.sqrt(p[yField] * p[yField] + p[y2Field] * p[y2Field]);
            if (distance > maxDistance) {
                maxDistance = distance;
                farthestPoint = p;
            }
        });
        
        return d === farthestPoint;
    }
    
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
    
    // Iteratively optimize label positions to minimize overlaps
    let currentPositions = {};
    let totalOverlaps = Infinity;
    let iterations = 0;
    const MAX_ITERATIONS = 3;  // Limit iterations to prevent infinite loops
    
    while (iterations < MAX_ITERATIONS) {
        let newPositions = {};
        let newTotalOverlaps = 0;
        
        // Assign positions for all points
        chartData.forEach((d, i) => {
            // 仅为需要显示标签的点分配位置
            if (shouldShowLabel(d, chartData, i)) {
                const bestPosition = findOptimalPosition(d, chartData, currentPositions);
                newPositions[d[xField]] = bestPosition;
                newTotalOverlaps += bestPosition.overlaps;
            }
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
    points.each(function(d, i) {
        // 检查是否应该显示此标签
        if (!shouldShowLabel(d, chartData, i)) {
            return;
        }
        
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
    
    return svg.node();
}