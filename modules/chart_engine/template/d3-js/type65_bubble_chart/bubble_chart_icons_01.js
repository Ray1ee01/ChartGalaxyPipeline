/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Bubble Chart",
    "chart_name": "bubble_chart_icons_01",
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
    "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": ["primary"],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": [],
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
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    const colors = jsonData.colors;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const y2Field = dataColumns[2].name;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 25, right: 25, bottom: 50, left: 50 };
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 创建比例尺
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
        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1])/2) > range * 0.2;
    }
    
    // 为X轴创建合适的比例尺
    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartData, yField);
    const xIsUneven = isDistributionUneven(chartData, yField);
    
    const xScale = (!xHasNegativeOrZero && xIsUneven) 
        ? d3.scaleLog().domain([Math.max(xExtent[0] * 0.9, 0.1), xExtent[1] * 1.1]).range([0, chartWidth])
        : d3.scaleLinear().domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1]).range([0, chartWidth]);
            
    // 为Y轴创建合适的比例尺
    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartData, y2Field);
    const yIsUneven = isDistributionUneven(chartData, y2Field);
    
    const yScale = (!yHasNegativeOrZero && yIsUneven)
        ? d3.scaleLog().domain([Math.max(yExtent[0] * 0.9, 0.1), yExtent[1] * 1.1]).range([chartHeight, 0])
        : d3.scaleLinear().domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1]).range([chartHeight, 0]);
    
    // 创建坐标轴
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    const yAxis = d3.axisLeft(yScale).tickSize(0).tickPadding(10);
    
    // 添加X轴
    const xAxisGroup = g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("path").style("stroke", colors.text_color).style("stroke-width", 1).style("opacity", 0.5);
    xAxisGroup.selectAll("text").attr("class", "value").style("color", colors.text_color);
        
    // 添加Y轴
    const yAxisGroup = g.append("g")
        .attr("class", "axis")
        .call(yAxis);

    yAxisGroup.selectAll("path").style("stroke", colors.text_color).style("stroke-width", 1).style("opacity", 0.5);
    yAxisGroup.selectAll("text").attr("class", "value").style("color", colors.text_color);
    
    // 添加轴标题
    g.append("text")
        .attr("class", "text")
        .attr("x", chartWidth)
        .attr("y", chartHeight + margin.bottom / 2 + 15)
        .attr("text-anchor", "end")
        .attr("font-size", 13)
        .text(yField);
        
    g.append("text")
        .attr("class", "text")
        .attr("transform", "rotate(-90)")
        .attr("x", -margin.top)
        .attr("y", -margin.left / 2 - 10)
        .attr("text-anchor", "end")
        .attr("font-size", 13)
        .text(y2Field);
    
    // 寻找最优标签位置的辅助函数
    function findOptimalPosition(d, allPoints, currentPositions = {}) {
        const positions = [
            { x: 20, y: 4, anchor: "start", priority: 1 },
            { x: 0, y: -20, anchor: "middle", priority: 2 },
            { x: -20, y: 4, anchor: "end", priority: 3 },
            { x: 0, y: 28, anchor: "middle", priority: 4 },
            { x: 20, y: -20, anchor: "start", priority: 5 },
            { x: -20, y: -20, anchor: "end", priority: 6 },
            { x: -20, y: 28, anchor: "end", priority: 7 },
            { x: 20, y: 28, anchor: "start", priority: 8 }
        ];
        
        const pointX = xScale(d[yField]);
        const pointY = yScale(d[y2Field]);
        const fontSize = 10;
        const labelWidth = d[xField].length * fontSize * 0.6;
        const labelHeight = fontSize * 1.2;
        
        if (currentPositions[d[xField]]) {
            return currentPositions[d[xField]];
        }
        
        // 贪心算法：按优先级顺序尝试每个位置
        for (const pos of positions) {
            let hasOverlap = false;
            
            // 计算标签边界的辅助函数
            const calculateLabelBounds = (priority, x, y, w, h) => {
                const offsets = {
                    1: [20, -h/2], 2: [-w/2, -20-h], 3: [-20-w, -h/2], 4: [-w/2, 20],
                    5: [15, -15-h], 6: [-15-w, -15-h], 7: [-15-w, 15], 8: [15, 15]
                };
                const [offsetX, offsetY] = offsets[priority];
                return [x + offsetX, y + offsetY, x + offsetX + w, y + offsetY + h];
            };
            
            const [labelX1, labelY1, labelX2, labelY2] = calculateLabelBounds(pos.priority, pointX, pointY, labelWidth, labelHeight);
            
            // 检查边界约束
            if (labelX1 < 0 || labelX2 > chartWidth || labelY1 < 0 || labelY2 > chartHeight) {
                continue;
            }
            
            // 检查与其他点及其标签的重叠
            for (const p of allPoints) {
                if (p === d) continue;
                
                const pX = xScale(p[yField]);
                const pY = yScale(p[y2Field]);
                const pPos = currentPositions[p[xField]];
                
                if (pPos) {
                    const otherLabelWidth = p[xField].length * fontSize * 0.6;
                    const otherLabelHeight = fontSize * 1.2;
                    const [otherX1, otherY1, otherX2, otherY2] = calculateLabelBounds(pPos.priority, pX, pY, otherLabelWidth, otherLabelHeight);
                    
                    // 检查标签是否重叠
                    if (labelX1 < otherX2 && labelX2 > otherX1 && labelY1 < otherY2 && labelY2 > otherY1) {
                        hasOverlap = true;
                        break;
                    }
                } else {
                    // 使用点重叠检测
                    const pointRadius = 20;
                    if (pX + pointRadius > labelX1 && pX - pointRadius < labelX2 && 
                        pY + pointRadius > labelY1 && pY - pointRadius < labelY2) {
                        hasOverlap = true;
                        break;
                    }
                }
            }
            
            if (!hasOverlap) {
                return pos;
            }
        }
        
        return positions[0];
    }
    
    // 根据数据点数量确定圆圈大小
    const numPoints = chartData.length;
    const baseRadius = numPoints <= 15 ? 15 : Math.max(10, 15 - (numPoints - 15) / 20);
    
    // 创建半径比例尺 - 让面积与y2成正比
    const y2Extent = d3.extent(chartData, d => d[y2Field]);
    const minRadius = baseRadius * 0.5;
    const maxRadius = baseRadius * 1.5;
    
    // 判断是否使用对数比例尺
    const y2HasNegativeOrZero = hasNegativeOrZeroValues(chartData, y2Field);
    const y2IsUneven = isDistributionUneven(chartData, y2Field);
    
    // 面积比例尺（因为面积∝半径²，所以使用sqrt来计算半径）
    let radiusScale;
    if (!y2HasNegativeOrZero && y2IsUneven) {
        const areaScale = d3.scaleLog()
            .domain([Math.max(y2Extent[0], 0.1), y2Extent[1]])
            .range([minRadius * minRadius, maxRadius * maxRadius]);
        radiusScale = d => Math.sqrt(areaScale(d[y2Field]));
    } else {
        const areaScale = d3.scaleLinear()
            .domain(y2Extent)
            .range([minRadius * minRadius, maxRadius * maxRadius]);
        radiusScale = d => Math.sqrt(areaScale(d[y2Field]));
    }
    
    // 添加数据点
    const points = g.selectAll(".data-point")
        .data(chartData)
        .enter()
        .append("g")
        .attr("class", "mark")
        .attr("transform", d => `translate(${xScale(d[yField])}, ${yScale(d[y2Field])})`);
    
    // 添加白色圆形背景
    points.append("circle")
        .attr("class", "background")
        .attr("r", d => radiusScale(d))
        .attr("fill", "white")
        .attr("stroke", "white")
        .attr("stroke-width", 4);
    
    // 添加图标图像
    points.append("image")
        .attr("class", "image")
        .attr("xlink:href", d => images.field[d[xField]])
        .attr("width", d => radiusScale(d) * 2)
        .attr("height", d => radiusScale(d) * 2)
        .attr("x", d => -radiusScale(d))
        .attr("y", d => -radiusScale(d));
    
    // 迭代优化标签位置以最小化重叠
    let currentPositions = {};
    let totalOverlaps = Infinity;
    let iterations = 0;
    const MAX_ITERATIONS = 3;
    
    while (iterations < MAX_ITERATIONS) {
        let newPositions = {};
        let newTotalOverlaps = 0;
        
        chartData.forEach(d => {
            const bestPosition = findOptimalPosition(d, chartData, currentPositions);
            newPositions[d[xField]] = bestPosition;
            newTotalOverlaps += bestPosition.overlaps;
        });
        
        if (newTotalOverlaps >= totalOverlaps || newTotalOverlaps === 0) {
            break;
        }
        
        currentPositions = newPositions;
        totalOverlaps = newTotalOverlaps;
        iterations++;
    }
    
    // 检查标签重叠并只显示非重叠标签
    const labelPositions = [];
    
    // 添加优化位置的标签
    points.each(function(d) {
        const bestPosition = currentPositions[d[xField]] || findOptimalPosition(d, chartData);
        const pointX = xScale(d[yField]);
        const pointY = yScale(d[y2Field]);
        
        const labelWidth = d[xField].length * 8;
        const labelHeight = 16;
        
        let labelX1, labelY1, labelX2, labelY2;
        
        if (bestPosition.priority === 1) {
            labelX1 = pointX + 26; labelY1 = pointY - 8;
        } else if (bestPosition.priority === 2) {
            labelX1 = pointX - labelWidth / 2; labelY1 = pointY - 26 - labelHeight;
        } else if (bestPosition.priority === 3) {
            labelX1 = pointX - 26 - labelWidth; labelY1 = pointY - 8;
        } else if (bestPosition.priority === 4) {
            labelX1 = pointX - labelWidth / 2; labelY1 = pointY + 26;
        } else if (bestPosition.priority === 5) {
            labelX1 = pointX + 20; labelY1 = pointY - 20 - labelHeight;
        } else if (bestPosition.priority === 6) {
            labelX1 = pointX - 20 - labelWidth; labelY1 = pointY - 20 - labelHeight;
        } else if (bestPosition.priority === 7) {
            labelX1 = pointX - 20 - labelWidth; labelY1 = pointY + 20;
        } else {
            labelX1 = pointX + 20; labelY1 = pointY + 20;
        }
        
        labelX2 = labelX1 + labelWidth;
        labelY2 = labelY1 + labelHeight;
        
        // 检查此标签是否与任何已放置的标签重叠
        let hasOverlap = false;
        for (const pos of labelPositions) {
            if (labelX1 < pos.x2 && labelX2 > pos.x1 && 
                labelY1 < pos.y2 && labelY2 > pos.y1) {
                hasOverlap = true;
                break;
            }
        }
        
        // 仅当不重叠时添加标签
        if (!hasOverlap) {
            d3.select(this).append("text")
                .attr("class", "label")
                .attr("x", bestPosition.x)
                .attr("y", bestPosition.y)
                .attr("text-anchor", bestPosition.anchor)
                .style("font-family", typography.label.font_family)
                .style("font-size", 10)
                .style("font-weight", typography.label.font_weight)
                .text(d[xField]);
            
            labelPositions.push({
                x1: labelX1, y1: labelY1, x2: labelX2, y2: labelY2
            });
        }
    });
    
    return svg.node();
}