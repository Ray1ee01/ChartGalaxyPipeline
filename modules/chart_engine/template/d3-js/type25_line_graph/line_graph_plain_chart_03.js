/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Line Graph",
    "chart_name": "line_graph_plain_chart_03",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 7]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 800,
    "background": "dark",
    "icon_mark": "side",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors_dark || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 设置尺寸和边距 - 右侧留出更多空间用于标签
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 180, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 获取唯一的组值和X值
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    const xValues = [...new Set(chartData.map(d => d[xField]))].sort();
    
    // 创建比例尺 - 修改为时间比例尺
    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, innerWidth);
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表组
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // 修改Y轴比例尺，支持负值，并确保最大刻度超过数据最大值
    const yScale = d3.scaleLinear()
        .domain([
            Math.min(0, d3.min(chartData, d => d[yField]) * 1.1), // 取最小值和0中的较小者
            d3.max(chartData, d => d[yField]) * 1.3 // 将最大值扩大30%
        ])
        .range([innerHeight, 0]);
    
    // 获取颜色
    const getColor = (group) => {
        return colors.field && colors.field[group] ? colors.field[group] : colors.other.primary;
    };
    
    // 添加网格线 - 使用半透明白色
    // 首先获取Y轴的最大刻度值
    const yTicks = yScale.ticks(6); // 增加刻度数量，确保有足够的刻度
    const maxYTick = yTicks[yTicks.length - 1];
    const maxYPos = yScale(maxYTick);

    // 绘制水平网格线 - 向左延伸
    const gridExtension = 5; // 网格线向左延伸的距离

    // 过滤Y轴刻度，移除最小的刻度（通常是0或负值）
    const filteredYTicks = yTicks.filter(d => d > yTicks[0]);

    // 创建水平网格线，不包括最下方的刻度
    g.selectAll("rect.grid-rect-y")
        .data(filteredYTicks)
        .enter()
        .append("rect")
        .attr("class", "grid-rect-y")
        .attr("class", "background")
        .attr("x", -gridExtension - 30)
        .attr("y", d => yScale(d) - 0.5) // 减去0.5使线条居中
        .attr("width", innerWidth + gridExtension)
        .attr("height", 1)
        .style("fill", "#3f3e40");

    // 绘制垂直网格线 
    g.selectAll("rect.grid-rect-x")
        .data(xTicks)
        .enter()
        .append("rect")
        .attr("class", "grid-rect-x")
        .attr("class", "background")
        .attr("x", d => xScale(d) - 0.5)
        .attr("y", 0)
        .attr("width", 1)
        .attr("height", innerHeight)
        .style("fill", "#3f3e40");
    
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))

    // 首先收集所有点信息，并分为起点和终点两组
    const startPoints = [];
    const endPoints = [];

    let endX = 0;
    // 获取最后一个时间点对应的x坐标
    const lastXValue = xValues[xValues.length - 1];
    endX = xScale(parseDate(lastXValue));
    
    // 创建渐变定义
    const defs = svg.append("defs");
    
    // 添加Y轴线 - 与X轴线样式一致
    g.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", innerHeight)
        .attr("stroke", "#e8f6fa")
        .attr("stroke-width", 1);
    
    // 添加最后一个年份的垂直线 - 与X轴线样式一致
    g.append("line")
        .attr("x1", endX)
        .attr("y1", 0)
        .attr("x2", endX)
        .attr("y2", innerHeight)
        .attr("stroke", "#e8f6fa")
        .attr("stroke-width", 1);

    // 找出结束值最高的组
    let highestEndGroup = null;
    let highestEndValue = -Infinity;
    
    groups.forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        const lastPoint = groupData[groupData.length - 1];
        
        if (lastPoint[yField] > highestEndValue) {
            highestEndValue = lastPoint[yField];
            highestEndGroup = group;
        }
    });
    
    // 为最高值组创建渐变 - 使用更多的小段和插值
    const gradientId = "area-gradient";
    
    // 获取最高组的数据
    const highestGroupData = chartData.filter(d => d[groupField] === highestEndGroup);
    
    // 计算插值点，使渐变更加平滑 - 直接对x坐标进行插值
    const interpolatedData = [];
    const interpolationCount = 10; // 增加插值点数量，使效果更平滑
    
    for (let i = 0; i < highestGroupData.length - 1; i++) {
        const current = highestGroupData[i];
        const next = highestGroupData[i + 1];
        
        // 计算当前点和下一个点的x坐标
        const currentX = xScale(parseDate(current[xField]));
        const nextX = xScale(parseDate(next[xField]));
        
        // 计算当前点和下一个点的y值
        const currentY = current[yField];
        const nextY = next[yField];
        
        // 添加当前点
        interpolatedData.push({
            x: currentX,
            y: currentY,
            original: current
        });
        
        // 在当前点和下一个点之间插入额外的点
        for (let j = 1; j <= interpolationCount; j++) {
            const ratio = j / (interpolationCount + 1);
            
            // 直接对x坐标和y值进行线性插值
            const interpolatedX = currentX * (1 - ratio) + nextX * ratio;
            const interpolatedY = currentY * (1 - ratio) + nextY * ratio;
            
            interpolatedData.push({
                x: interpolatedX,
                y: interpolatedY,
                // 保存一个引用，用于获取其他属性
                original: current
            });
        }
    }
    
    // 添加最后一个点
    interpolatedData.push({
        x: xScale(parseDate(highestGroupData[highestGroupData.length - 1][xField])),
        y: highestGroupData[highestGroupData.length - 1][yField],
        original: highestGroupData[highestGroupData.length - 1]
    });
    
    // 为每个插值点创建一个渐变
    interpolatedData.forEach((d, i) => {
        const pointGradientId = `${gradientId}-${i}`;
        const pointGradient = defs.append("linearGradient")
            .attr("id", pointGradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%")
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("gradientTransform", `translate(0, ${yScale(d.y)})`);
        
        // 添加渐变色标 - 使用更多的色标点
        pointGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", getColor(highestEndGroup))
            .attr("stop-opacity", 0.7);
        
        pointGradient.append("stop")
            .attr("offset", "20%")
            .attr("stop-color", getColor(highestEndGroup))
            .attr("stop-opacity", 0.5);
        
        pointGradient.append("stop")
            .attr("offset", "40%")
            .attr("stop-color", getColor(highestEndGroup))
            .attr("stop-opacity", 0.3);
        
        pointGradient.append("stop")
            .attr("offset", "60%")
            .attr("stop-color", getColor(highestEndGroup))
            .attr("stop-opacity", 0.2);
        
        pointGradient.append("stop")
            .attr("offset", "80%")
            .attr("stop-color", getColor(highestEndGroup))
            .attr("stop-opacity", 0.1);
        
        pointGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", getColor(highestEndGroup))
            .attr("stop-opacity", 0);
    });

    groups.forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);

        // 如果是最高值组，添加面积渐变
        if (group === highestEndGroup) {
            // 创建自定义面积生成器，直接使用x坐标
            const customArea = (segment) => {
                const [p1, p2] = segment;
                return `
                    M ${p1.x},${yScale(p1.y)}
                    L ${p2.x},${yScale(p2.y)}
                    L ${p2.x},${innerHeight}
                    L ${p1.x},${innerHeight}
                    Z
                `;
            };
            
            // 添加面积 - 使用插值后的数据点
            for (let i = 0; i < interpolatedData.length - 1; i++) {
                const segmentData = [interpolatedData[i], interpolatedData[i+1]];
                const segmentGradientId = `${gradientId}-${i}`;
                
                g.append("path")
                    .attr("class", "area-segment")
                    .attr("fill", `url(#${segmentGradientId})`)
                    .attr("d", customArea(segmentData))
                    .attr("opacity", 0.8);
            }
        }
        
        // 绘制线条 - 添加黑色描边
        // 先绘制黑色描边
        g.append("path")
            .datum(groupData)
            .attr("class", "line-stroke")
            .attr("fill", "none")
            .attr("stroke", "#333333")
            .attr("stroke-width", 8) // 比实际线条宽一些
            .attr("d", line);
        
        // 再绘制彩色线条
        g.append("path")
            .datum(groupData)
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", getColor(group))
            .attr("stroke-width", 4)
            .attr("d", line);
        
        // 添加起点和终点的圆点
        const firstPoint = groupData[0];
        const lastPoint = groupData[groupData.length - 1];
        
        // 处理起点 - 添加黑色描边
        const startX = xScale(parseDate(firstPoint[xField]));
        const startY = yScale(firstPoint[yField]);
        
        // 添加圆点描边
        g.append("circle")
            .attr("cx", startX)
            .attr("cy", startY)
            .attr("r", 6) // 比实际圆点大一些
            .attr("fill", "#333333");
        
        // 添加圆点
        g.append("circle")
            .attr("cx", startX)
            .attr("cy", startY)
            .attr("r", 4)
            .attr("fill", getColor(group));
        
        // 收集起点信息
        startPoints.push({
            x: startX,
            y: startY,
            value: Math.round(firstPoint[yField]),
            color: getColor(group),
            group: group
        });
        
        // 处理终点 - 添加黑色描边
        endX = xScale(parseDate(lastPoint[xField]));
        const endY = yScale(lastPoint[yField]);
        
        // 添加圆点描边
        g.append("circle")
            .attr("cx", endX)
            .attr("cy", endY)
            .attr("r", 6) // 比实际圆点大一些
            .attr("fill", "#333333");
        
        // 添加圆点
        g.append("circle")
            .attr("cx", endX)
            .attr("cy", endY)
            .attr("r", 4)
            .attr("fill", getColor(group));
        
        // 收集终点信息
        endPoints.push({
            x: endX,
            y: endY,
            value: Math.round(lastPoint[yField]),
            color: getColor(group),
            group: group
        });

    });
    
    // 绘制X轴 - 使用均匀分布的刻度
    const xAxis = g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .tickFormat(xFormat) // 使用自定义刻度值
        );
    
    // 设置X轴样式，并下移文本
    xAxis.selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", "12px")
        .style("fill", "#ffffff")
        .attr("dy", "0.7em"); // 下移文本
    
    // 移除X轴线和刻度
    xAxis.select(".domain").remove();
    xAxis.selectAll(".tick line").remove();
    
    // 在X轴刻度下方添加一条水平线
    g.append("line")
        .attr("x1", -20)
        .attr("y1", innerHeight) // 放在X轴刻度文本下方
        .attr("x2", innerWidth + 20)
        .attr("y2", innerHeight) // 保持水平
        .attr("stroke", "#e8f6fa") // 与X轴文本相同的颜色
        .attr("stroke-width", 1);


    // 绘制Y轴 - 移除B后缀，并调整刻度位置
    const yAxis = g.append("g")
        .call(d3.axisLeft(yScale)
            .tickValues(filteredYTicks) // 使用过滤后的刻度
            .tickSize(0) // 移除刻度线
        );

    // 移除Y轴线
    yAxis.select(".domain").remove();
    yAxis.selectAll(".tick line").remove();

    // 手动添加Y轴刻度文本，放在延伸的网格线上方
    yAxis.selectAll(".tick text")
        .attr("x", -gridExtension - 5) // 放在延伸的网格线上方，留出一点间距
        .attr("dy", -5)
        .style("font-family", typography.label.font_family)
        .style("font-size", "12px")
        .style("fill", "#ffffff") // 白色
        .style("text-anchor", "end") 
        .text(d => d);
    
    // 添加Y轴标题 - 旋转90度
    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20) // 位置调整
        .attr("x", -innerHeight / 2) // 居中
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-family", typography.label.font_family)
        .style("font-size", "12px")
        .style("fill", "#ffffff")
        .text(dataColumns[1].label || yField); // 使用标签或字段名
    

    
    // 动态规划标签放置算法
    function placeLabelsDP(points, avoidYPositions = []) {
        // 每个格点的高度（像素）
        const GRID_SIZE = 3;
        // 圆点周围的保护区域（格点数）
        const PROTECTION_RADIUS = 3;
        // 标签高度（格点数）
        const LABEL_HEIGHT = 5; 
        
        // 离散化Y坐标，创建格点系统
        const minY = 0;
        const maxY = innerHeight;
        const gridCount = Math.ceil((maxY - minY) / GRID_SIZE);
        
        // 按照Y坐标排序点
        points.sort((a, b) => a.y - b.y);
        
        // 创建格点占用标记
        const occupied = new Array(gridCount).fill(false);
        
        // 标记圆点周围的保护区域为已占用
        points.forEach(point => {
            const gridY = Math.floor(point.y / GRID_SIZE);
            for (let i = Math.max(0, gridY - PROTECTION_RADIUS); i <= Math.min(gridCount - 1, gridY + PROTECTION_RADIUS); i++) {
                occupied[i] = true;
            }
        });
        
        // 标记需要避开的Y轴刻度位置为已占用
        avoidYPositions.forEach(yPos => {
            const gridY = Math.floor(yPos / GRID_SIZE);
            // 为每个刻度值添加一些保护区域
            for (let i = Math.max(0, gridY - PROTECTION_RADIUS); i <= Math.min(gridCount - 1, gridY + PROTECTION_RADIUS); i++) {
                occupied[i] = true;
            }
        });
        
        // 定义状态: dp[i][j] 表示前i个点，第i个点的标签放在第j个格点时的最小代价
        const n = points.length;
        const dp = Array(n).fill().map(() => Array(gridCount).fill(Infinity));
        const prev = Array(n).fill().map(() => Array(gridCount).fill(-1));
        
        // 初始条件：第一个点的标签放置
        const firstPointGridY = Math.floor(points[0].y / GRID_SIZE);
        
        // 尝试将第一个点的标签放在可行的位置
        for (let j = 0; j < gridCount; j++) {
            // 检查是否可行（不在保护区域内且有足够空间放置标签）
            if (!occupied[j] && j + LABEL_HEIGHT <= gridCount) {
                // 检查标签是否会与其他标签重叠
                let canPlace = true;
                for (let k = 0; k < LABEL_HEIGHT; k++) {
                    if (j + k < gridCount && occupied[j + k]) {
                        canPlace = false;
                        break;
                    }
                }
                
                // 确保第一个标签不超过第二个圆点位置（如果有第二个圆点）
                if (n > 1) {
                    const nextPointGridY = Math.floor(points[1].y / GRID_SIZE);
                    if (j > nextPointGridY) {
                        canPlace = false; // 不允许标签越过下一个圆点
                    }
                }
                
                if (canPlace) {
                    // 计算代价：与圆点位置的距离
                    const cost = Math.abs(j - firstPointGridY);
                    dp[0][j] = cost;
                }
            }
        }
        
        // 填充dp表
        for (let i = 1; i < n; i++) {
            const pointGridY = Math.floor(points[i].y / GRID_SIZE);
            
            for (let j = 0; j < gridCount; j++) {
                // 检查当前位置是否可行
                if (!occupied[j] && j + LABEL_HEIGHT <= gridCount) {
                    // 检查标签是否会与其他标签重叠
                    let canPlace = true;
                    for (let k = 0; k < LABEL_HEIGHT; k++) {
                        if (j + k < gridCount && occupied[j + k]) {
                            canPlace = false;
                            break;
                        }
                    }
                    
                    // 确保当前标签不超过下一个圆点位置（如果有下一个圆点）
                    if (i < n - 1) {
                        const nextPointGridY = Math.floor(points[i+1].y / GRID_SIZE);
                        if (j > nextPointGridY) {
                            canPlace = false; // 不允许标签越过下一个圆点
                        }
                    }

                    // 确保当前标签至少超过上一个圆点位置
                    if (i > 0) {
                        const prevPointGridY = Math.floor(points[i-1].y / GRID_SIZE);
                        if (j < prevPointGridY) {
                            canPlace = false; // 不允许标签越过上一个圆点
                        }
                    }
                    
                    if (canPlace) {
                        // 根据上一个点的标签位置计算当前最小代价
                        for (let k = 0; k + LABEL_HEIGHT <= j; k++) {
                            if (dp[i-1][k] !== Infinity) {

                                // 当前标签的代价
                                const curCost = Math.abs(j - pointGridY);
                                const totalCost = dp[i-1][k] + curCost;
                                
                                if (totalCost < dp[i][j]) {
                                    dp[i][j] = totalCost;
                                    prev[i][j] = k; // 记录前驱
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // 找出最后一个点的最优放置位置
        let minCost = Infinity;
        let bestPos = -1;
        
        for (let j = 0; j < gridCount; j++) {
            if (dp[n-1][j] < minCost) {
                minCost = dp[n-1][j];
                bestPos = j;
            }
        }
        
        // 回溯构建结果
        const labelPositions = [];
        if (bestPos !== -1) {
            // 从后向前回溯
            let pos = bestPos;
            
            for (let i = n - 1; i >= 0; i--) {
                labelPositions.unshift({
                    point: points[i],
                    labelY: pos * GRID_SIZE
                });
                
                pos = prev[i][pos];
            }

            console.log('success');
        } else {
            console.log('fail');
            // 无可行解，退化为简单方案
            let lastY = 0;
            for (let i = 0; i < n; i++) {
                const point = points[i];
                
                const labelY = Math.max(point.y, lastY + 45);
                
                labelPositions.push({
                    point: point,
                    labelY: labelY
                });
                
                lastY = labelY;
            }
        }
        
        return labelPositions;
    }

    // 分别对起点和终点应用动态规划
    // 获取Y轴刻度位置用于避开
    const endLabelPositions = placeLabelsDP(endPoints, []); // 终点不需要避开Y轴刻度

    // 为每个组创建一个图像图标
    endLabelPositions.forEach(placement => {
        const {point, labelY} = placement;
        
        // 如果是最高组，特殊处理其标签位置
        if (point.group === highestEndGroup) {
            // 创建10px间隔的网格系统
            const gridSize = 10;
            const gridWidth = Math.ceil(innerWidth / gridSize);
            const gridHeight = Math.ceil(innerHeight / gridSize);
            const grid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(false));
            
            // 标记所有折线占用的网格
            groups.forEach(group => {
                if (group !== highestEndGroup) { // 不标记最高组自己的折线
                    const groupData = chartData.filter(d => d[groupField] === group);
                    
                    // 标记折线路径
                    for (let i = 0; i < groupData.length - 1; i++) {
                        const current = groupData[i];
                        const next = groupData[i + 1];
                        
                        const x1 = xScale(parseDate(current[xField]));
                        const y1 = yScale(current[yField]);
                        const x2 = xScale(parseDate(next[xField]));
                        const y2 = yScale(next[yField]);
                        
                        // 使用线性插值标记路径上的点
                        const steps = Math.max(
                            Math.ceil(Math.abs(x2 - x1) / gridSize),
                            Math.ceil(Math.abs(y2 - y1) / gridSize)
                        );
                        
                        for (let step = 0; step <= steps; step++) {
                            const ratio = step / steps;
                            const x = x1 + (x2 - x1) * ratio;
                            const y = y1 + (y2 - y1) * ratio;
                            
                            // 标记周围的网格为占用
                            const gridX = Math.floor(x / gridSize);
                            const gridY = Math.floor(y / gridSize);
                            grid[gridY][gridX] = true;
                            
                            // // 添加保护区域
                            // for (let dy = -2; dy <= 2; dy++) {
                            //     for (let dx = -2; dx <= 2; dx++) {
                            //         const nx = gridX + dx;
                            //         const ny = gridY + dy;
                            //         if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
                            //             grid[ny][nx] = true; // 标记为占用
                            //         }
                            //     }
                            // }
                        }
                    }
                }
            });

            // 标记最高组折线上方的区域为占用
            const highestGroupData = chartData.filter(d => d[groupField] === highestEndGroup);
            for (let i = 0; i < highestGroupData.length - 1; i++) {
                const current = highestGroupData[i];
                const next = highestGroupData[i + 1];
                
                const x1 = xScale(parseDate(current[xField]));
                const y1 = yScale(current[yField]);
                const x2 = xScale(parseDate(next[xField]));
                const y2 = yScale(next[yField]);
                
                // 使用线性插值标记路径上的点
                const steps = Math.max(
                    Math.ceil(Math.abs(x2 - x1) / gridSize),
                    Math.ceil(Math.abs(y2 - y1) / gridSize)
                );
                
                for (let step = 0; step <= steps; step++) {
                    const ratio = step / steps;
                    const x = x1 + (x2 - x1) * ratio;
                    const y = y1 + (y2 - y1) * ratio;
                    
                    // 标记当前点上方的所有网格为占用
                    const gridX = Math.floor(x / gridSize);
                    const minY = 0;
                    const maxY = Math.ceil(y / gridSize);
                    
                    for (let gridY = minY; gridY <= maxY - 2; gridY++) {
                        if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                            grid[gridY][gridX] = true;
                        }
                    }
                }
            }
            
            // 找到最高组折线下方的空位

            // 计算标签尺寸（网格单位）
            const labelWidth = 4 + Math.ceil(getTextWidth(point.group, 22) / gridSize); // 根据实际文本宽度计算网格单位
            const labelHeight = 4; // 估计标签高度
            
            // 找到合适的位置
            let bestX = -1, bestY = -1;
            let bestScore = -Infinity;

            
            // 在折线下方搜索空位
            for (let gridY = 0; gridY < gridHeight - labelHeight; gridY++) {
                for (let gridX = 0; gridX < gridWidth - labelWidth; gridX++) {
                    // 检查这个区域是否有足够的空间
                    let hasSpace = true;
                    for (let dy = 0; dy < labelHeight; dy++) {
                        for (let dx = 0; dx < labelWidth; dx++) {
                            if (grid[gridY + dy][gridX + dx]) {
                                hasSpace = false;
                                break;
                            }
                        }
                        if (!hasSpace) break;
                    }
                    
                    if (hasSpace) {                 
                        // 优先选择靠上且靠中间的位置
                        const centerX = gridWidth / 2;
                        const distanceFromCenter = Math.abs(gridX + labelWidth / 2 - centerX);
                        const score = -gridY * 0.01 - 2 * distanceFromCenter; // 越靠上gridY越小,越靠近中间distanceFromCenter越小,分数越高
                        
                        if (score > bestScore) {
                            bestScore = score;
                            bestX = gridX;
                            bestY = gridY;
                        }
                    }
                }
            }
            
            // 可视化网格占用情况
            const debugGrid = false; // 设置为true开启可视化，false关闭
            
            if (debugGrid) {
                // 创建一个单独的组用于网格可视化
                const gridDebugGroup = g.append("g")
                    .attr("class", "grid-debug");
                
                // 绘制所有网格单元
                for (let gridY = 0; gridY < gridHeight; gridY++) {
                    for (let gridX = 0; gridX < gridWidth; gridX++) {
                        // 计算实际坐标
                        const x = gridX * gridSize;
                        const y = gridY * gridSize;
                        
                        // 绘制网格单元
                        gridDebugGroup.append("rect")
                            .attr("x", x)
                            .attr("y", y)
                            .attr("width", gridSize)
                            .attr("height", gridSize)
                            .attr("fill", grid[gridY][gridX] ? "rgba(255, 0, 0, 0.2)" : "rgba(0, 255, 0, 0.05)")
                            .attr("stroke", "rgba(255, 255, 255, 0.1)")
                            .attr("stroke-width", 0.5);
                    }
                }
                
                // 标记最佳位置
                if (bestX >= 0 && bestY >= 0) {
                    gridDebugGroup.append("rect")
                        .attr("x", bestX * gridSize)
                        .attr("y", bestY * gridSize)
                        .attr("width", gridSize)
                        .attr("height", gridSize)
                        .attr("fill", "rgba(0, 0, 255, 0.5)")
                        .attr("stroke", "white")
                        .attr("stroke-width", 1);
                }
                
            }
            
            // 如果找到了合适的位置
            if (bestX >= 0 && bestY >= 0) {
                // 创建标签组 - 只用于图标和组名
                const iconGroup = g.append("g")
                    .attr("transform", `translate(${bestX * gridSize}, ${bestY * gridSize})`);
                
                // 添加图像图标
                if (images && images.field[point.group]) {
                    iconGroup.append("image")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", 40)
                        .attr("height", 40)
                        .attr("xlink:href", images.field[point.group]);
                } else {
                    iconGroup.append("circle")
                        .attr("cx", 10)
                        .attr("cy", 10)
                        .attr("r", 5)
                        .attr("fill", point.color);
                }
                
                // 添加组名
                iconGroup.append("text")
                    .attr("x", 40)
                    .attr("y", 25)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", typography.label.font_family)
                    .style("font-size", "22px")
                    .style("font-weight", "bold")
                    .style("fill", "#f7f7fc")
                    .text(point.group);
                
                // 创建常规标签组 - 只用于标签值
                // 但位置在右侧，与其他标签一致
                const valueGroup = g.append("g")
                    .attr("transform", `translate(${point.x + 15}, ${labelY})`);
                
                // 只添加标签值
                valueGroup.append("text")
                    .attr("x", 0)
                    .attr("y", -10)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", typography.label.font_family)
                    .style("font-size", "24px")
                    .style("font-weight", "bold")
                    .style("fill", point.color)
                    .text(point.value);
                
                // 跳过常规标签创建
                return;
            }
        }
        
        // 常规标签创建（非最高组或未找到合适位置的最高组）
        // 创建标签组
        const labelGroup = g.append("g")
            .attr("transform", `translate(${point.x + 15}, ${labelY})`);
        
        // 第一行：图像图标 + 组名（较小字体）
        // 添加图像图标
        if (images && images.field[point.group]) {
            // 使用图像作为图标
            labelGroup.append("image")
                .attr("x", -10) // 调整位置，使图标居中
                .attr("y", -10) // 调整位置，使图标居中
                .attr("width", 20)
                .attr("height", 20)
                .attr("xlink:href", images.field[point.group]);
        } else {
            // 如果没有图像，使用彩色圆点作为备选
            labelGroup.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", 3)
                .attr("fill", point.color);
        }
        
        // 添加组名（较小字体）
        labelGroup.append("text")
            .attr("x", 15) // 增加与图标的距离
            .attr("y", 0)
            .attr("dominant-baseline", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", "14px") // 较小字体
            .style("font-weight", "normal") // 普通粗细
            .style("fill", point.color) // 使用组的颜色
            .text(point.group);
        
        // 第二行：标签值（较大字体）
        labelGroup.append("text")
            .attr("x", 0)
            .attr("y", 14) // 下移到第二行
            .attr("dominant-baseline", "hanging")
            .style("font-family", typography.label.font_family)
            .style("font-size", "18px") // 较大字体
            .style("font-weight", "bold") // 加粗
            .style("fill", point.color) // 使用组的颜色
            .text(point.value);
    });
    return svg.node();
} 