/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Line Graph",
    "chart_name": "multiple_line_graph_03",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 3]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 800,
    "background": "dark",
    "icon_mark": "none",
    "icon_label": "none",
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
    
    // 确保在创建网格线之前定义渐变
    const defs = svg.append("defs");

    // 创建一个唯一的ID，避免冲突
    const horizontalGradientId = `horizontal-grid-gradient-${Math.random().toString(36).substr(2, 9)}`;
    const verticalGradientId = `vertical-grid-gradient-${Math.random().toString(36).substr(2, 9)}`;

    // 添加水平网格线渐变
    const horizontalGridGradient = defs.append("linearGradient")
        .attr("id", horizontalGradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

    horizontalGridGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#6bc7c5")
        .attr("stop-opacity", 0.2);

    horizontalGridGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#6bc7c5")
        .attr("stop-opacity", 0.05);

    // 添加垂直网格线渐变
    const verticalGridGradient = defs.append("linearGradient")
        .attr("id", verticalGradientId)
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");

    verticalGridGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#e8f6fa")
        .attr("stop-opacity", 0.3);

    verticalGridGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#e8f6fa")
        .attr("stop-opacity", 0.1);

    // 创建比例尺 - 修改为时间比例尺
    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, innerWidth);
    
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
    const gridExtension = 20; // 网格线向左延伸的距离

    const horizontalGradient = defs.append("linearGradient")
        .attr("id", "horizontal-grid-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");
    
    horizontalGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#6bc7c5")
        .attr("stop-opacity", 1);
        
    horizontalGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#6bc7c5")
        .attr("stop-opacity", 0.2);
        

    // 过滤Y轴刻度，移除最小的刻度（通常是0或负值）
    const filteredYTicks = yTicks.filter(d => d > yTicks[0]);

    // 创建水平网格渐变矩形，不包括最下方的刻度
    g.selectAll("rect.grid-rect-y")
        .data(filteredYTicks)
        .enter()
        .append("rect")
        .attr("class", "grid-rect-y")
        .attr("class", "background")
        .attr("x", -gridExtension)
        .attr("y", d => yScale(d) - 0.5) // 减去0.5使线条居中
        .attr("width", innerWidth + gridExtension)
        .attr("height", 1)
        .style("fill", `url(#horizontal-grid-gradient)`);

    const verticalGradient = defs.append("linearGradient")
        .attr("id", "vertical-grid-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
    
    verticalGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#6bc7c5")
        .attr("stop-opacity", 0);
        
    verticalGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#6bc7c5")
        .attr("stop-opacity", 0.4);
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
        .attr("height", innerHeight + 10)
        .style("fill", `url(#vertical-grid-gradient)`);
    
    // 为每个组添加线条渐变
    groups.forEach(group => {
        const gradientId = `line-gradient-${group.replace(/\s+/g, '-').toLowerCase()}`;
        const baseColor = getColor(group);
        
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");
            
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", baseColor)
            .attr("stop-opacity", 0.3);
            
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", baseColor)
            .attr("stop-opacity", 0);
    });
    
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))

    // 首先收集所有点信息，并分为起点和终点两组
    const startPoints = [];
    const endPoints = [];

    groups.forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        
        // 绘制线条
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
        
        // 处理起点
        const startX = xScale(parseDate(firstPoint[xField]));
        const startY = yScale(firstPoint[yField]);
        
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
        
        // 处理终点
        const endX = xScale(parseDate(lastPoint[xField]));
        const endY = yScale(lastPoint[yField]);
        
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
    
    // 绘制X轴
    const xAxis = g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .tickFormat(xFormat) // 使用相同的刻度数量
        );
    
    // 设置X轴样式，并下移文本
    xAxis.selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", "#e8f6fa")
        .attr("dy", "1.5em"); // 下移文本
    
    // 移除X轴线和刻度
    xAxis.select(".domain").remove();
    xAxis.selectAll(".tick line").remove();
    
    // 在X轴刻度下方添加一条水平线
    g.append("line")
        .attr("x1", -20)
        .attr("y1", innerHeight + 40) // 放在X轴刻度文本下方
        .attr("x2", innerWidth + 20)
        .attr("y2", innerHeight + 40) // 保持水平
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
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", "#6bc7c5") // 白色
        .style("text-anchor", "end") 
        .text(d => d);
    
    // 添加Y轴编码描述
    // 获取Y轴字段名称
    const yAxisLabel = dataColumns[1].description;

    // 计算Y轴标签位置 - 在最大刻度下方
    const yAxisLabelX = -margin.left / 2 + 5; // 在Y轴中间位置
    const yAxisLabelY = yScale(yTicks[yTicks.length - 1]) - 30; // 最大刻度上方一点

    // 添加Y轴描述文本
    const words = yAxisLabel.split(' ');
    let lines = [];
    let currentLine = words[0];
    
    // 计算每行文本
    for(let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        const testWidth = getTextWidth(testLine, typography.label.font_size);
        
        if(testWidth <= 200) {
            currentLine = testLine;
        } else {
            lines.push(currentLine);
            currentLine = words[i];
        }
    }
    lines.push(currentLine);
    
    // 绘制多行文本
    lines.forEach((line, i) => {
        g.append("text")
            .attr("class", "y-axis-label")
            .attr("x", yAxisLabelX)
            .attr("y", yAxisLabelY + i * 20)
            .attr("text-anchor", "start")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", "#6bc7c5")
            .text(line);
    });
    
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
                // 确保标签不超过下一个圆点的位置
                let maxY = innerHeight;
                if (i < n - 1) {
                    maxY = points[i+1].y;
                }
                
                const labelY = Math.min(Math.max(point.y + 20, lastY + 25), maxY - 5);
                
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
    const yTickPositions = filteredYTicks.map(tick => yScale(tick));
    const startLabelPositions = placeLabelsDP(startPoints, yTickPositions); // 起点需要避开Y轴刻度
    const endLabelPositions = placeLabelsDP(endPoints, []); // 终点不需要避开Y轴刻度

    // 分别处理起点和终点标签
    startLabelPositions.forEach(placement => {
        const {point, labelY} = placement;
        
        // 添加起点标签,向左偏移10px
        g.append("text")
            .attr("x", point.x - 20)
            .attr("y", labelY)
            .attr("text-anchor", "middle") 
            .attr("dominant-baseline", "hanging")
            .style("font-family", typography.label.font_family)
            .style("font-size", "18px")
            .style("font-weight", "bold")
            .style("fill", point.color)
            .text(point.value);
    });

    endLabelPositions.forEach(placement => {
        const {point, labelY} = placement;
        
        // 添加终点标签,向右偏移10px
        g.append("text")
            .attr("x", point.x + 10)
            .attr("y", labelY)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "hanging")
            .style("font-family", typography.label.font_family)
            .style("font-size", "18px")
            .style("font-weight", "bold")
            .style("fill", point.color)
            .text(point.value + " " + point.group);
    });
    return svg.node();
} 