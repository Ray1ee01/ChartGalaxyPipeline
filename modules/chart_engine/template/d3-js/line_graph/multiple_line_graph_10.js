/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Line Graph",
    "chart_name": "multiple_line_graph_10",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 30], ["-inf", "inf"], [2, 6]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 800,
    "background": "light",
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
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 60, right: 30, bottom: 60, left: 60 };
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 获取唯一的组值
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 按组分组数据
    const groupedData = d3.group(chartData, d => d[groupField]);

    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, chartWidth);
    
    // 创建y轴比例尺 - 使用数据的实际范围
    const yMin = d3.min(chartData, d => d[yField]);
    const yMax = d3.max(chartData, d => d[yField]);
    
    // 为了美观，稍微扩展Y轴范围
    const yPadding = (yMax - yMin) * 0.3;
    const yDomainMax = yMax + yPadding;
    const yDomainMin = Math.min(0, yMin - yPadding);
    
    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([chartHeight, 0]);
    
    // 创建颜色比例尺 - 使用提供的颜色或默认颜色
    const colorScale = d => {
        if (colors.field && colors.field[d]) {
            return colors.field[d];
        }
        return d3.schemeCategory10[groups.indexOf(d) % 10];
    };
    
    // 获取实际的Y轴刻度
    const yTicks = yScale.ticks(5);
    
    // 添加水平网格线 - 包括刻度之间的额外网格线
    // 首先添加主要刻度的网格线
    yTicks.forEach(tick => {
        g.append("line")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", chartWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", "#dddddd")
            .attr("stroke-width", 1)
            .attr("class", "background");
    });
    
    // 添加刻度之间的额外网格线
    if (yTicks.length > 1) {
        for (let i = 0; i < yTicks.length - 1; i++) {
            const currentTick = yTicks[i];
            const nextTick = yTicks[i + 1];
            const midValue = (currentTick + nextTick) / 2;
            
            g.append("line")
                .attr("x1", 0)
                .attr("y1", yScale(midValue))
                .attr("x2", chartWidth)
                .attr("y2", yScale(midValue))
                .attr("stroke", "#dddddd")
                .attr("stroke-width", 1)
                .attr("class", "background");
        }
    }
    
    // 添加Y轴刻度文本 - 保留0位小数，不带百分号
    yTicks.forEach(tick => {
        g.append("text")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#666")
            .style("font-size", "14px")
            .text(Math.round(tick)); // 四舍五入到整数，不带百分号
    });
    
    // 添加X轴刻度文本
    xTicks.forEach(tick => {
        
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", chartHeight + 20)
            .attr("text-anchor", "middle")
            .attr("fill", "#666")
            .style("font-size", "14px")
            .text(xFormat(tick));
    });
    
    // 添加X轴线
    g.append("line")
        .attr("x1", 0)
        .attr("y1", chartHeight)
        .attr("x2", chartWidth)
        .attr("y2", chartHeight)
        .attr("stroke", "#aaa")
        .attr("stroke-width", 1);
    
    // 定义线条粗细
    const lineWidth = 4;
    
    // 创建线条生成器
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveLinear); // 改为折线
    
    // 收集需要标注的数据点 - 按起点/终点/中点分类
    const startPoints = [];
    const middlePoints = [];
    const endPoints = [];
    
    groupedData.forEach((values, group) => {
        // 确保数据按日期排序
        values.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
        
        const color = colors.field[group];
        
        // 绘制线条
        g.append("path")
            .datum(values)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", lineWidth)
            .attr("d", line);
        
        // 找出中间的一个X位置
        const middleIndex = Math.floor(values.length / 2);
        
        // 收集需要标注的点
        values.forEach((d, i) => {
            if (i === 0) {
                // 起点
                startPoints.push({
                    x: xScale(parseDate(d[xField])),
                    y: yScale(d[yField]),
                    value: d[yField],
                    color: color,
                    group: group,
                    point: d
                });
            } else if (i === values.length - 1) {
                // 终点
                endPoints.push({
                    x: xScale(parseDate(d[xField])),
                    y: yScale(d[yField]),
                    value: d[yField],
                    color: color,
                    group: group,
                    point: d
                });
            } else if (i === middleIndex) {
                // 中点
                middlePoints.push({
                    x: xScale(parseDate(d[xField])),
                    y: yScale(d[yField]),
                    value: d[yField],
                    color: color,
                    group: group,
                    point: d
                });
            }
        });
    });
    
    // 分别对起点、中点和终点应用动态规划 - 添加g参数
    const startLabelPositions = placeLabelsDP(startPoints, yTicks.map(tick => yScale(tick)), "起点", chartHeight, chartWidth, g);
    const middleLabelPositions = placeLabelsDP(middlePoints, yTicks.map(tick => yScale(tick)), "中点", chartHeight, chartWidth, g);
    const endLabelPositions = placeLabelsDP(endPoints, yTicks.map(tick => yScale(tick)), "终点", chartHeight, chartWidth, g);
    
    // 绘制标签函数 - 保持multiple_line_graph_10的样式
    function drawLabels(labelPositions) {
        labelPositions.forEach(placement => {
            const point = placement.point;
            const labelY = placement.labelY;
            
            // 计算标签文本和宽度
            const labelText = formatValue(point.value);
            const labelWidth = labelText.toString().length * 10 + 10;
            const labelHeight = 24;
            
            // 添加圆角矩形背景
            g.append("rect")
                .attr("x", point.x - labelWidth / 2)
                .attr("y", labelY + labelHeight / 2)
                .attr("width", labelWidth)
                .attr("height", labelHeight)
                .attr("rx", 5)
                .attr("ry", 5)
                .attr("fill", point.color);
            
            // 添加文本 - 白色粗体
            g.append("text")
                .attr("x", point.x)
                .attr("y", labelY + labelHeight)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", "#fff")
                .attr("font-weight", "bold")
                .style("font-size", "14px")
                .text(labelText);
        });
    }
    
    // 绘制所有标签
    drawLabels(startLabelPositions);
    drawLabels(middleLabelPositions);
    drawLabels(endLabelPositions);
    
    // 添加图例 - 整体居中，向上移动
    const legendGroup = g.append("g");
    
    const legendSize = layoutLegend(legendGroup, groups, colors, {
        x: 0,
        y: 0,
        fontSize: 14,
        fontWeight: "bold",
        align: "left",
        maxWidth: chartWidth,
        shape: "line",
    });

    const maxYTickPosition = yScale(yTicks[yTicks.length - 1]);
    
    // 居中legend
    legendGroup.attr("transform", `translate(${(chartWidth - legendSize.width) / 2}, ${maxYTickPosition - 50 - legendSize.height/2})`);
    
    return svg.node();
}

// 动态规划标签放置算法 - 添加g参数
function placeLabelsDP(points, avoidYPositions = [], debugName = "", chartHeight, chartWidth, g) {
    // 每个格点的高度（像素）
    const GRID_SIZE = 3;
    // 圆点周围的保护区域（格点数）
    const PROTECTION_RADIUS = 3;
    // 标签高度（格点数）
    const LABEL_HEIGHT = 10; 
    
    // 离散化Y坐标，创建格点系统
    const minY = 0;
    const maxY = chartHeight; // 使用传入的chartHeight
    const gridCount = Math.ceil((maxY - minY) / GRID_SIZE);
    
    // 按照Y坐标排序点
    points.sort((a, b) => a.y - b.y);
    
    // 创建格点占用标记
    const occupied = new Array(gridCount).fill(false);
    // 存储占用原因，用于可视化
    const occupiedReason = new Array(gridCount).fill("");
    
    // 标记圆点周围的保护区域为已占用
    points.forEach((point, idx) => {
        const gridY = Math.floor(point.y / GRID_SIZE) - 3;
        for (let i = Math.max(0, gridY - PROTECTION_RADIUS); i <= Math.min(gridCount - 1, gridY + PROTECTION_RADIUS); i++) {
            occupied[i] = true;
            occupiedReason[i] = `数据点${idx + 1}保护区`;
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
    
    // 存储最终选择的标签位置（格点索引）
    const selectedGridPositions = [];
    
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
            
            // 记录选择的位置
            selectedGridPositions.unshift(pos);
            
            pos = prev[i][pos];
        }
    } else {
        // 无可行解，退化为简单方案处理
        let lastY = 0;
        for (let i = 0; i < n; i++) {
            const point = points[i];
            // 确保标签不超过下一个圆点的位置
            let maxY = chartHeight;
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

    const debug = false;
    
    // 添加格子系统可视化
    if (debug && points.length > 0) {
        // 确定可视化的位置 - 使用数据点的X位置
        const mainPointX = points.length > 0 ? points[0].x : 0; // 使用该组第一个点的X位置
        const visX = mainPointX;
        const visY = 10; // 从图表顶部开始
        const visWidth = 50; // 减小宽度以免干扰图表
        
        // 创建一个组用于添加可视化元素，并在需要时应用剪切
        const visGroup = g.append("g");
        
        // 限制可视化高度，避免太长
        const maxVisHeight = chartHeight - 20;
        const visibleGridCount = Math.min(gridCount, Math.floor(maxVisHeight / GRID_SIZE));
        
        // 添加半透明背景
        visGroup.append("rect")
            .attr("x", visX - 5)
            .attr("y", visY - 15)
            .attr("width", visWidth + 10)
            .attr("height", visibleGridCount * GRID_SIZE + 50)
            .attr("fill", "#fff")
            .attr("opacity", 0.8)
            .attr("rx", 5);
        
        // 添加标题
        visGroup.append("text")
            .attr("x", visX + visWidth/2)
            .attr("y", visY - 5)
            .attr("text-anchor", "middle")
            .attr("fill", "#333")
            .style("font-size", "10px")
            .text(debugName + "标签位置");
        
        // 绘制每个格子
        for (let i = 0; i < visibleGridCount; i++) {
            // 计算格子的颜色
            let fillColor = "#ddd"; // 默认颜色 - 可用格子
            
            if (occupied[i]) {
                fillColor = "#ffcccc"; // 不可用格子 - 红色
            }
            
            // 标记最终选择的位置
            const isSelected = selectedGridPositions.some(pos => {
                // 检查格子是否在标签范围内
                for (let j = 0; j < LABEL_HEIGHT; j++) {
                    if (pos + j === i) return true;
                }
                return false;
            });
            
            if (isSelected) {
                fillColor = "#99ff99"; // 选中的格子 - 绿色
            }
            
            // 绘制格子
            visGroup.append("rect")
                .attr("x", visX)
                .attr("y", visY + i * GRID_SIZE)
                .attr("width", visWidth)
                .attr("height", GRID_SIZE)
                .attr("fill", fillColor)
                .attr("stroke", "#ccc")
                .attr("stroke-width", 0.2);
        }
        
        // 添加数据点位置标记 - 只显示该组的点
        points.forEach((point, idx) => {
            const gridY = Math.floor(point.y / GRID_SIZE);
            
            // 仅当点位置在可视范围内时添加
            if (gridY < visibleGridCount) {
                // 绘制数据点位置线
                visGroup.append("line")
                    .attr("x1", visX - 3)
                    .attr("y1", visY + gridY * GRID_SIZE + GRID_SIZE/2)
                    .attr("x2", visX + visWidth)
                    .attr("y2", visY + gridY * GRID_SIZE + GRID_SIZE/2)
                    .attr("stroke", point.color)
                    .attr("stroke-width", 1)
                    .attr("stroke-dasharray", "2,1");
                
                // 添加简短的数据点标识
                visGroup.append("text")
                    .attr("x", visX - 5)
                    .attr("y", visY + gridY * GRID_SIZE + GRID_SIZE/2)
                    .attr("text-anchor", "end")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", point.color)
                    .style("font-size", "8px")
                    .text("点" + (idx + 1));
            }
        });
        
        // 在底部添加简化的图例
        const legendY = visY + visibleGridCount * GRID_SIZE + 5;
        const legendItems = [
            { label: "可用", color: "#ddd" },
            { label: "占用", color: "#ffcccc" },
            { label: "选中", color: "#99ff99" }
        ];
        
        legendItems.forEach((item, idx) => {
            // 水平放置图例项
            const itemX = visX + idx * (visWidth / 3);
            
            visGroup.append("rect")
                .attr("x", itemX)
                .attr("y", legendY)
                .attr("width", 6)
                .attr("height", 6)
                .attr("fill", item.color);
            
            visGroup.append("text")
                .attr("x", itemX + 8)
                .attr("y", legendY + 3)
                .attr("text-anchor", "start")
                .attr("dominant-baseline", "middle")
                .attr("fill", "#333")
                .style("font-size", "6px")
                .text(item.label);
        });
    }
    
    return labelPositions;
} 