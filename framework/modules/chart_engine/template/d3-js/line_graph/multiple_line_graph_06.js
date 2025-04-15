/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Line Graph",
    "chart_name": "multiple_line_graph_06",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 30], [0, "inf"], [2, 8]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 600,
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
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 获取唯一的组值
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 20, right: 60, bottom: 80, left: 40 };
    
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
    
    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, chartWidth);
    
    // 确定全局y轴范围
    const yMin = Math.min(0, d3.min(chartData, d => d[yField]) * 1.4);
    const yMax = d3.max(chartData, d => d[yField]) * 1.1;

    // 创建y轴比例尺
    const yScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([chartHeight, 0]);
    
    // 添加Y轴线（虚线）
    g.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", chartHeight)
        .attr("stroke", "#9badd3")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2");

    // 添加X轴线（虚线）
    g.append("line")
        .attr("x1", 0)
        .attr("y1", chartHeight)
        .attr("x2", chartWidth)
        .attr("y2", chartHeight)
        .attr("stroke", "#9badd3")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2");
    
    // 添加y轴刻度和标签
    const yTicks = yScale.ticks(5); // 根据实际数据自动生成刻度
    
    // 添加y轴刻度和标签
    yTicks.forEach(tick => {
        g.append("text")
            .attr("x", -5)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Arial")
            .style("font-size", "16px")
            .style("fill", "#ffffff")
            .text(tick);
    });
    
    // 添加x轴刻度和标签
    xTicks.forEach((tick, i) => {
        // 添加主刻度线,跳过第一个刻度
        if(i !== 0) {
            g.append("line")
                .attr("x1", xScale(tick))
                .attr("y1", chartHeight - 2)
                .attr("x2", xScale(tick))
                .attr("y2", chartHeight + 2)
                .attr("stroke", "#ffffff")
                .attr("stroke-width", 1);
        }
        
        // 添加刻度标签
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", chartHeight + 20)
            .attr("text-anchor", i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle")
            .style("font-family", "Arial")
            .style("font-size", "16px")
            .style("fill", "#ffffff")
            .text(xFormat(tick));
    });
    
    // 创建线条生成器
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveLinear); // 使用普通折线
    
    // 绘制每个组的线条和收集标签点
    const labelPoints = [];
    
    groups.forEach(group => {
        // 过滤当前组的数据
        let groupData = chartData.filter(d => d[groupField] === group);
        const color = colors.field[group];
        
        // 确保第一个点从Y轴开始
        const firstDataDate = parseDate(groupData[0][xField]);
        const xMin = new Date(xScale.domain()[0]);
        // if (firstDataDate.getTime() > xMin.getTime()) {
        //     // 添加Y轴起点（使用第一个数据点的Y值）
        //     const firstPoint = {
        //         [xField]: xMin.getFullYear().toString(),
        //         [yField]: groupData[0][yField],
        //         [groupField]: group
        //     };
        //     groupData = [firstPoint, ...groupData];
        // }
        
        // 确保最后一个点精确对应最大X值
        const lastDataDate = parseDate(groupData[groupData.length - 1][xField]);
        const xMax = new Date(xScale.domain()[1]);
        if (lastDataDate.getTime() < xMax.getTime()) {
            // 添加最后一个点（使用最后一个数据点的Y值）
            const lastPoint = {
                [xField]: xMax.getFullYear().toString(),
                [yField]: groupData[groupData.length - 1][yField],
                [groupField]: group
            };
            groupData = [...groupData, lastPoint];
        }
        
        // 绘制线条
        g.append("path")
            .datum(groupData)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 4)
            .attr("d", line);
        
        // 收集最终值标签点
        if (groupData.length > 0) {
            const lastPoint = groupData[groupData.length - 1];
            
            labelPoints.push({
                x: chartWidth,
                y: yScale(lastPoint[yField]),
                value: Math.round(lastPoint[yField]),
                color: color,
                group: group
            });
        }
    });

    // 动态规划标签放置算法
    function placeLabelsDP(points, avoidYPositions = []) {
        // 每个格点的高度（像素）
        const GRID_SIZE = 3;
        // 圆点周围的保护区域（格点数）
        const PROTECTION_RADIUS = 3;
        // 标签高度（格点数）
        const LABEL_HEIGHT = 10; 
        
        // 离散化Y坐标，创建格点系统
        const minY = 0;
        const maxY = innerHeight;
        const gridCount = Math.ceil((maxY - minY) / GRID_SIZE);
        
        // 按照Y坐标排序点
        points.sort((a, b) => a.y - b.y);
        
        // 创建格点占用标记
        const occupied = new Array(gridCount).fill(false);
        
        // 标记圆点周围的保护区域为已占用
        // points.forEach(point => {
        //     const gridY = Math.floor(point.y / GRID_SIZE);
        //     for (let i = Math.max(0, gridY - PROTECTION_RADIUS); i <= Math.min(gridCount - 1, gridY + PROTECTION_RADIUS); i++) {
        //         occupied[i] = true;
        //     }
        // });
        
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
                    dp[0][j] = cost * cost;
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
                                const totalCost = dp[i-1][k] + curCost * curCost;
                                
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
    
    // 使用动态规划算法放置标签
    const labelPositions = placeLabelsDP(labelPoints, []);
    
    // 绘制标签
    labelPositions.forEach(pos => {
        g.append("text")
            .attr("x", chartWidth + 5)
            .attr("y", pos.labelY)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Arial")
            .style("font-size", "18px")
            .style("font-weight", "bold")
            .style("fill", pos.point.color)
            .text(pos.point.value);
    });
    
    // 添加图例（自适应大小）
    // 计算图例项
    const legendItems = groups;
    const legendPadding = 10;
    const legendItemHeight = 20;
    const legendItemSpacing = 0;
    const legendTextOffset = 10;
    const fontSize = 18;

    // 计算图例的总高度
    const legendHeight = legendItems.length * legendItemHeight + (legendItems.length - 1) * legendItemSpacing + 2 * legendPadding;

    // 创建临时文本元素来测量文本宽度
    const tempText = svg.append("text")
        .style("font-family", "Arial")
        .style("font-size", `${fontSize}px`)
        .style("visibility", "hidden");

    // 计算最长文本的宽度
    let maxTextWidth = 0;
    legendItems.forEach(item => {
        tempText.text(item);
        const textWidth = tempText.node().getComputedTextLength();
        maxTextWidth = Math.max(maxTextWidth, textWidth);
    });

    // 移除临时文本元素
    tempText.remove();

    // 计算图例的总宽度
    const legendLineWidth = 30;
    const legendWidth = legendLineWidth + legendTextOffset + maxTextWidth + 2 * legendPadding;

    // 计算图例的最佳位置（避免与数据线交叉）
    function findBestLegendPosition(legendWidth, legendHeight) {
        // 定义可能的位置（右上、右下、左上、左下）
        const positions = [
            { name: "rightTop", x: width - margin.right - legendWidth, y: margin.top + 10 },
            { name: "rightBottom", x: width - margin.right - legendWidth, y: height - margin.bottom - legendHeight },
            { name: "leftTop", x: margin.left + 10, y: margin.top + 10 },
            { name: "leftBottom", x: margin.left + 10, y: height - margin.bottom - legendHeight }
        ];
        
        // 创建临时图例用于碰撞检测
        const tempLegend = svg.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .attr("fill", "none")
            .attr("stroke", "none")
            .style("visibility", "hidden");
        
        // 计算每个位置与数据线的交叉程度
        const intersections = positions.map(pos => {
            tempLegend.attr("x", pos.x).attr("y", pos.y);
            let intersectionCount = 0;
            
            // 检查每条线与图例的交叉
            groups.forEach(group => {
                const groupData = chartData.filter(d => d[groupField] === group);
                
                // 简化：检查每个数据点是否在图例区域内
                for (let i = 0; i < groupData.length; i++) {
                    const x = margin.left + xScale(parseDate(groupData[i][xField]));
                    const y = margin.top + yScale(groupData[i][yField]);
                    
                    if (x >= pos.x && x <= pos.x + legendWidth && 
                        y >= pos.y && y <= pos.y + legendHeight) {
                        intersectionCount++;
                    }
                    
                    // 也检查线段是否穿过图例
                    if (i < groupData.length - 1) {
                        const nextX = margin.left + xScale(parseDate(groupData[i+1][xField]));
                        const nextY = margin.top + yScale(groupData[i+1][yField]);
                        
                        // 简化的线段与矩形相交检测
                        if (lineIntersectsRectangle(
                            x, y, nextX, nextY,
                            pos.x, pos.y, pos.x + legendWidth, pos.y + legendHeight
                        )) {
                            intersectionCount++;
                        }
                    }
                }
            });
            
            return { position: pos, count: intersectionCount };
        });
        
        // 移除临时图例
        tempLegend.remove();
        
        // 找出交叉最少的位置
        intersections.sort((a, b) => a.count - b.count);
        return intersections[0].position;
    }

    // 辅助函数：检测线段是否与矩形相交
    function lineIntersectsRectangle(x1, y1, x2, y2, rectX, rectY, rectX2, rectY2) {
        // 检查线段的两个端点是否都在矩形的同一侧
        if ((x1 <= rectX && x2 <= rectX) || // 线段在矩形左侧
            (x1 >= rectX2 && x2 >= rectX2) || // 线段在矩形右侧
            (y1 <= rectY && y2 <= rectY) || // 线段在矩形上方
            (y1 >= rectY2 && y2 >= rectY2)) { // 线段在矩形下方
            return false;
        }
        
        // 简化的相交检测
        // 如果线段的斜率使其穿过矩形，则认为相交
        if (x1 !== x2) { // 非垂直线
            const slope = (y2 - y1) / (x2 - x1);
            const yAtRectX = y1 + slope * (rectX - x1);
            const yAtRectX2 = y1 + slope * (rectX2 - x1);
            
            if ((yAtRectX >= rectY && yAtRectX <= rectY2) ||
                (yAtRectX2 >= rectY && yAtRectX2 <= rectY2)) {
                return true;
            }
        }
        
        if (y1 !== y2) { // 非水平线
            const inverseSlope = (x2 - x1) / (y2 - y1);
            const xAtRectY = x1 + inverseSlope * (rectY - y1);
            const xAtRectY2 = x1 + inverseSlope * (rectY2 - y1);
            
            if ((xAtRectY >= rectX && xAtRectY <= rectX2) ||
                (xAtRectY2 >= rectX && xAtRectY2 <= rectX2)) {
                return true;
            }
        }
        
        return false;
    }

    // 找出最佳位置
    const bestPosition = findBestLegendPosition(legendWidth, legendHeight);
    const legendX = bestPosition.x;
    const legendY = bestPosition.y;

    // 创建图例组
    const legend = svg.append("g")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    // 图例背景
    legend.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .attr("fill", "none")
        .attr("stroke", "#d1ddff")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");

    // 添加图例项
    legendItems.forEach((item, i) => {
        const itemY = legendPadding + i * (legendItemHeight + legendItemSpacing) + legendItemHeight / 2;
        const color = colors.field[item];
        
        // 线条
        legend.append("line")
            .attr("x1", legendPadding)
            .attr("y1", itemY)
            .attr("x2", legendPadding + legendLineWidth)
            .attr("y2", itemY)
            .attr("stroke", color)
            .attr("stroke-width", 5);
        
        // 文本
        legend.append("text")
            .attr("x", legendPadding + legendLineWidth + legendTextOffset)
            .attr("y", itemY)
            .attr("dominant-baseline", "middle")
            .style("font-family", "Arial")
            .style("font-size", `${fontSize}px`)
            .style("fill", color)
            .text(item);
    });
    
    return svg.node();
} 