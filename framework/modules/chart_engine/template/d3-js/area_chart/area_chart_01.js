/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Area Chart",
    "chart_name": "area_chart_01",
    "required_fields": ["x", "y"],
    "required_fields_type": [["temporal"], ["numerical"]],
    "required_fields_range": [[3, 20], [0, 100]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": [],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 600,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    let chartData = jsonData.data.data;
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
    
    chartData = temporalFilter(chartData, xField);
    if (chartData.length === 0) {
        console.log("chartData is empty");
        return;
    }


    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 40, bottom: 80, left: 40 };
    
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
    
    // 创建y轴比例尺 (百分比)
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d[yField]) * 1.1])
        .range([chartHeight, 0]);
    
    // 创建面积生成器
    const area = d3.area()
        .x(d => xScale(parseDate(d[xField])))
        .y0(chartHeight)
        .y1(d => yScale(d[yField]))
        .curve(d3.curveLinear); // 使用折线
    
    // 创建线条生成器（用于边界线）
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveLinear); // 使用折线
    
    // 创建渐变定义
    const defs = svg.append("defs");
    
    // 创建小点图案
    const patternId = "dot-pattern";
    const pattern = defs.append("pattern")
        .attr("id", patternId)
        .attr("width", 4)  // 5像素大小的网格
        .attr("height", 4) // 5像素大小的网格
        .attr("patternUnits", "userSpaceOnUse")
        .attr("patternTransform", "rotate(45)"); // 45度旋转
    
    // 添加像素级小点
    pattern.append("rect")
        .attr("x", 2)
        .attr("y", 2)
        .attr("width", 1) // 1像素宽
        .attr("height", 1) // 1像素高
        .attr("fill", "white");
    
    // 创建白色小点的透明度渐变
    const dotGradientId = "dot-opacity-gradient";
    const dotGradient = defs.append("linearGradient")
        .attr("id", dotGradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
    
    // 渐变起始颜色 - 完全不透明
    dotGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "white")
        .attr("stop-opacity", 1);
    
    // 渐变结束颜色 - 完全透明
    dotGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "white")
        .attr("stop-opacity", 0);
    
    // 绘制面积 - 纯色底色
    g.append("path")
        .datum(chartData)
        .attr("fill", "#35356e") // 深蓝色底色
        .attr("d", area);
    
    // 创建小点图案的蒙版
    const dotMaskId = "dot-mask";
    const dotMask = defs.append("mask")
        .attr("id", dotMaskId);
    
    // 添加黑色背景到蒙版（黑色在mask中表示透明）
    dotMask.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "black");
    
    // 添加小点图案到蒙版（白色在mask中表示不透明）
    dotMask.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "url(#" + patternId + ")");
    
    // 添加带渐变的小点图层
    g.append("path")
        .datum(chartData)
        .attr("fill", "url(#" + dotGradientId + ")") // 使用白色渐变
        .attr("mask", "url(#" + dotMaskId + ")") // 使用小点蒙版
        .attr("d", area);
    
    // 绘制边界线 - 添加白色描边
    // 先绘制一条较粗的白色线作为描边
    g.append("path")
        .datum(chartData)
        .attr("fill", "none")
        .attr("stroke", "white") // 白色描边
        .attr("stroke-width", 4) // 较粗的线宽
        .attr("d", line);
    
    // 再绘制红色线
    g.append("path")
        .datum(chartData)
        .attr("fill", "none")
        .attr("stroke", "#e63946") // 红色边界线
        .attr("stroke-width", 2)
        .attr("d", line);
    
    // 添加数据点和标签
    // 首先创建网格系统
    const gridSize = 5; // 5像素一格
    const gridWidth = Math.ceil(chartWidth / gridSize);
    const gridHeight = Math.ceil(chartHeight / gridSize);
    
    // 创建网格占用情况的二维数组
    const grid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(false));
    
    // 标记折线占用的网格
    const linePoints = [];
    for (let i = 0; i < chartData.length - 1; i++) {
        const current = chartData[i];
        const next = chartData[i + 1];
        
        const x1 = xScale(parseDate(current[xField]));
        const y1 = yScale(current[yField]);
        const x2 = xScale(parseDate(next[xField]));
        const y2 = yScale(next[yField]);
        
        // 存储折线点用于后续判断标签是否在折线上方或下方
        linePoints.push({ x: x1, y: y1 });
        if (i === chartData.length - 2) {
            linePoints.push({ x: x2, y: y2 });
        }
        
        // 使用线性插值标记折线路径上的点
        const steps = Math.max(
            Math.ceil(Math.abs(x2 - x1) / gridSize),
            Math.ceil(Math.abs(y2 - y1) / gridSize)
        );
        
        for (let step = 0; step <= steps; step++) {
            const ratio = step / steps;
            const x = x1 + (x2 - x1) * ratio;
            const y = y1 + (y2 - y1) * ratio;
            
            // 标记网格为占用
            const gridX = Math.floor(x / gridSize);
            const gridY = Math.floor(y / gridSize);
            
            if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                grid[gridY][gridX] = true;
                
                // // 标记周围的网格也为占用，确保标签不会太靠近折线
                // for (let dy = -1; dy <= 1; dy++) {
                //     for (let dx = -1; dx <= 1; dx++) {
                //         const nx = gridX + dx;
                //         const ny = gridY + dy;
                //         if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
                //             grid[ny][nx] = true;
                //         }
                //     }
                // }
            }
        }
    }
    
    // 添加调试功能 - 可视化网格和标签布局
    const debugLayout = false; // 设置为true开启可视化，false关闭
    
    if (debugLayout) {
        // 创建一个单独的组用于网格可视化
        const debugGroup = g.append("g")
            .attr("class", "debug-grid")
            .style("opacity", 0.3); // 半透明，不干扰主要内容
        
        // 绘制所有网格单元
        for (let gridY = 0; gridY < gridHeight; gridY++) {
            for (let gridX = 0; gridX < gridWidth; gridX++) {
                // 计算实际坐标
                const x = gridX * gridSize;
                const y = gridY * gridSize;
                
                // 绘制网格单元
                debugGroup.append("rect")
                    .attr("x", x)
                    .attr("y", y)
                    .attr("width", gridSize)
                    .attr("height", gridSize)
                    .attr("fill", grid[gridY][gridX] ? "rgba(255, 0, 0, 0.3)" : "rgba(0, 0, 0, 0)")
                    .attr("stroke", "rgba(100, 100, 100, 0.2)")
                    .attr("stroke-width", 0.5);
            }
        }
        
        // 在处理完所有标签后，再次可视化最终的网格占用情况
        const finalDebugGroup = g.append("g")
            .attr("class", "debug-final-grid")
            .style("opacity", 0.5); // 半透明，不干扰主要内容
        
        // 在所有标签处理完成后，添加这段代码
        chartData.forEach((d, i) => {
            if (i === chartData.length - 1) { // 在最后一个数据点处理完后执行
                // 绘制所有网格单元的最终状态
                for (let gridY = 0; gridY < gridHeight; gridY++) {
                    for (let gridX = 0; gridX < gridWidth; gridX++) {
                        // 计算实际坐标
                        const x = gridX * gridSize;
                        const y = gridY * gridSize;
                        
                        // 只绘制被占用的网格
                        if (grid[gridY][gridX]) {
                            finalDebugGroup.append("rect")
                                .attr("x", x)
                                .attr("y", y)
                                .attr("width", gridSize)
                                .attr("height", gridSize)
                                .attr("fill", "rgba(0, 0, 255, 0.3)")
                                .attr("stroke", "rgba(0, 0, 255, 0.5)")
                                .attr("stroke-width", 0.5);
                        }
                    }
                }
            }
        });
    }
    
    // 定义标签尺寸
    const labelWidth = 8; // 宽8格
    const labelHeight = 5; // 高5格
    
    // 找到最高点的数据
    const maxDataPoint = chartData.reduce((max, current) => 
        current[yField] > max[yField] ? current : max, chartData[0]);

    const sampleLabelIndex = sampleLabels(chartData.length);
    
    // 为每个数据点找到最佳标签位置
    chartData.forEach((d, index) => {
        const x = xScale(parseDate(d[xField]));
        const y = yScale(d[yField]);
        
        // 检查是否是最高点
        const isHighestPoint = d[yField] === maxDataPoint[yField];
        
        if (isHighestPoint) {
            // 为最高点绘制五角星
            const starSize = 8; // 五角星大小
            
            // 创建五角星路径
            const starPoints = [];
            for (let i = 0; i < 5; i++) {
                // 外部点
                const outerAngle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const outerX = x + starSize * Math.cos(outerAngle);
                const outerY = y + starSize * Math.sin(outerAngle);
                starPoints.push([outerX, outerY]);
                
                // 内部点
                const innerAngle = (Math.PI * 2 * i + Math.PI) / 5 - Math.PI / 2;
                const innerX = x + starSize * 0.4 * Math.cos(innerAngle);
                const innerY = y + starSize * 0.4 * Math.sin(innerAngle);
                starPoints.push([innerX, innerY]);
            }
            
            // 构建路径字符串
            const pathData = starPoints.map((point, i) => 
                (i === 0 ? 'M' : 'L') + point[0] + ',' + point[1]
            ).join(' ') + 'Z';
            
            // 添加白色描边的五角星
            g.append("path")
                .attr("d", pathData)
                .attr("fill", "white")
                .attr("stroke", "none");
            
            // 添加红色五角星
            g.append("path")
                .attr("d", pathData)
                .attr("fill", "#e63946")
                .attr("stroke", "none")
                .attr("transform", "scale(0.8) translate(" + (x * 0.25) + "," + (y * 0.25) + ")");
        } else {
            // 为其他点添加普通圆点
            // 添加数据点 - 先添加白色描边
            g.append("circle")
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", 4)
                .attr("fill", "white");
            
            // 添加红色数据点
            g.append("circle")
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", 3)
                .attr("fill", "#e63946");
        }

        if (!sampleLabelIndex.includes(index)) {
            return;
        }
        
        // 将数据点转换为网格坐标
        const pointGridX = Math.floor(x / gridSize);
        const pointGridY = Math.floor(y / gridSize);
        
        // 搜索最佳标签位置
        let bestX = -1, bestY = -1;
        let bestDistance = Infinity;
        
        // 定义搜索范围
        const searchRadius = 20; // 搜索半径（网格单位）
        
        // 枚举所有可能的标签位置
        for (let gridY = Math.max(0, pointGridY - searchRadius); gridY < Math.min(gridHeight - labelHeight, pointGridY + searchRadius); gridY++) {
            for (let gridX = Math.max(0, pointGridX - searchRadius); gridX < Math.min(gridWidth - labelWidth, pointGridX + searchRadius); gridX++) {
                
                // 检查这个位置是否有足够的空间放置标签
                let canPlace = true;
                for (let dy = 0; dy < labelHeight; dy++) {
                    for (let dx = 0; dx < labelWidth; dx++) {
                        if (grid[gridY + dy][gridX + dx]) {
                            canPlace = false;
                            break;
                        }
                    }
                    if (!canPlace) break;
                }
                
                if (canPlace) {
                    // 计算到数据点的距离
                    const distance = Math.sqrt(
                        Math.pow(gridX + labelWidth / 2 - pointGridX, 2) + 
                        Math.pow(gridY + labelHeight / 2 - pointGridY, 2)
                    );
                    
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestX = gridX;
                        bestY = gridY;
                    }
                }
            }
        }
        
        // 如果找到了合适的位置
        if (bestX >= 0 && bestY >= 0) {
            // 标记这个位置为已占用
            for (let dy = 0; dy < labelHeight; dy++) {
                for (let dx = 0; dx < labelWidth; dx++) {
                    grid[bestY + dy][bestX + dx] = true;
                }
            }
            
            // 计算标签的实际像素位置
            const labelX = bestX * gridSize;
            const labelY = bestY * gridSize;
            
            // 判断标签是否在折线下方
            // 使用射线法判断点是否在折线下方
            let isBelow = false;
            
            // 找到标签中心点
            const labelCenterX = labelX + (labelWidth * gridSize) / 2;
            const labelCenterY = labelY + (labelHeight * gridSize) / 2;
            
            // 找到最近的两个折线点
            let leftPoint = null, rightPoint = null;
            for (let i = 0; i < linePoints.length - 1; i++) {
                if (linePoints[i].x <= labelCenterX && linePoints[i + 1].x >= labelCenterX) {
                    leftPoint = linePoints[i];
                    rightPoint = linePoints[i + 1];
                    break;
                }
            }
            
            // 如果找到了包含标签x坐标的线段
            if (leftPoint && rightPoint) {
                // 计算线段在标签x坐标处的y值
                const ratio = (labelCenterX - leftPoint.x) / (rightPoint.x - leftPoint.x);
                const lineY = leftPoint.y + ratio * (rightPoint.y - leftPoint.y);
                
                // 如果标签中心点的y值大于线段的y值，则标签在折线下方
                isBelow = labelCenterY > lineY;
            }
            
            // 根据标签位置选择文本颜色
            const yearColor = isBelow ? "white" : "#35356e";
            
            // 添加百分比标签 - 最高点使用更大的字体
            g.append("text")
                .attr("x", labelX + (labelWidth * gridSize) / 2 - 15)
                .attr("y", labelY + 20)
                .attr("text-anchor", "start")
                .style("font-family", "Arial")
                .style("font-size", isHighestPoint ? "18px" : "12px") // 最高点使用更大字体
                .style("font-weight", "bold")
                .style("fill", "#e63946") // 红色文本
                .text(`${d[yField]} ${dataColumns[1].unit === 'none' ? '' : dataColumns[1].unit}`);
            
            // 添加年份标签
            g.append("text")
                .attr("x", labelX + (labelWidth * gridSize) / 2 - 15)
                .attr("y", isHighestPoint ? labelY + 5 : labelY + 9)
                .attr("text-anchor", "start")
                .style("font-family", "Arial")
                .style("font-size", "10px")
                .style("font-weight", "bold")
                .style("fill", yearColor) // 根据位置选择颜色
                .text(xFormat(parseDate(d[xField])));
            
            // 添加调试可视化 - 标签区域
            if (debugLayout) {
                g.append("rect")
                    .attr("x", labelX)
                    .attr("y", labelY)
                    .attr("width", labelWidth * gridSize)
                    .attr("height", labelHeight * gridSize)
                    .attr("fill", "none")
                    .attr("stroke", "#35356e")
                    .attr("stroke-width", 1)
                    .attr("stroke-dasharray", "2,2");
                
                // 添加标签索引
                g.append("text")
                    .attr("x", labelX + (labelWidth * gridSize) / 2)
                    .attr("y", labelY + (labelHeight * gridSize) / 2)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", "Arial")
                    .style("font-size", "10px")
                    .style("font-weight", "bold")
                    .style("fill", isBelow ? "white" : "#35356e")
                    .text(index + 1);
            }
        }
    });
    
    // 添加X轴
    g.append("line")
        .attr("x1", 0)
        .attr("y1", chartHeight)
        .attr("x2", chartWidth)
        .attr("y2", chartHeight)
        .attr("stroke", "#9191a9") // 更改为指定的颜色
        .attr("stroke-width", 1.5); // 稍微加粗一点
    
    xTicks.forEach(tick => {
        // 添加白色刻度线
        g.append("line")
            .attr("x1", xScale(tick))
            .attr("y1", chartHeight)
            .attr("x2", xScale(tick))
            .attr("y2", chartHeight - 3) // 刻度线长度为5像素
            .attr("stroke", "white") // 纯白色刻度线
            .attr("stroke-width", 1); // 与X轴线宽一致
        
        // 添加年份标签
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", chartHeight + 12)
            .attr("text-anchor", "middle")
            .style("font-family", "Arial")
            .style("font-size", "10px")
            .style("fill", "#2a2e7a") // 保持深蓝色文本
            .style("font-weight", "bold")
            .text(xFormat(tick));
    });
    
    
    return svg.node();
} 