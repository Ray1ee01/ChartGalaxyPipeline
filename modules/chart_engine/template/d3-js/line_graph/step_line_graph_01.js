/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Step Line Graph",
    "chart_name": "step_line_graph_01",
    "required_fields": ["x", "y"],
    "required_fields_type": [["temporal"], ["numerical"]],
    "required_fields_range": [[4, 20], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes",
    "chart_for": "trend"
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
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    
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
    
    // 创建y轴比例尺 - 使用数据的实际范围而不是固定范围
    const yMin = d3.min(chartData, d => d[yField]);
    const yMax = d3.max(chartData, d => d[yField]);
    
    // 为了美观，稍微扩展Y轴范围
    const yPadding = (yMax - yMin) * 0.5;
    const yDomainMax = yMax + yPadding;
    // const yDomainMin = Math.max(0, yMin - yPadding);
    const yDomainMin = yMin - yPadding;
    
    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax]) // 确保下限不小于0
        .range([chartHeight, 0]);
    
    // 获取颜色 - 修改为固定的蓝色
    const areaColor = colors.other.primary;
    
    // 创建线条生成器（用于阶梯线）
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveStepAfter); // 使用阶梯线样式
    
    // 获取实际的Y轴刻度
    const yTicks = yScale.ticks(8);
    const maxYTick = yTicks[yTicks.length - 1]; // 最大的Y轴刻度值
    const minYTick = yTicks[0]; // 最小的Y轴刻度值
    
    // 计算最大和最小Y刻度的位置
    const maxYTickPosition = yScale(maxYTick);
    const minYTickPosition = yScale(minYTick);
    
    // 添加条纹背景
    
    // 为每个X轴刻度创建条纹背景，使条纹以刻度为中心
    for (let i = 0; i < xTicks.length; i++) {
        const currentTick = xTicks[i];
        
        // 计算前一个和后一个刻度的位置
        const currentX = xScale(currentTick);
        const prevX = i > 0 ? xScale(xTicks[i-1]) : 0;
        const nextX = i < xTicks.length - 1 ? xScale(xTicks[i+1]) : chartWidth;
        
        // 计算当前条纹的左右边界
        const leftX = (prevX + currentX) / 2;  // 当前刻度和前一个刻度的中点
        const rightX = (currentX + nextX) / 2; // 当前刻度和后一个刻度的中点
        
        // 每隔一个刻度添加浅色背景
        if (i % 2 === 0) {
            g.append("rect")
                .attr("x", leftX)
                .attr("y", maxYTickPosition) // 从最高Y刻度开始
                .attr("width", rightX - leftX)
                .attr("height", minYTickPosition - maxYTickPosition) // 高度只到最低Y刻度
                .attr("fill", "#ececec")
                .attr("class", "background")
                .attr("opacity", 0.8);
        }
    }
    
    // 将条纹背景移到最底层
    g.selectAll("rect").lower();
    
    // 添加水平网格线
    yTicks.forEach(tick => {
        // 判断是否为0刻度，为0时使用实线，否则使用虚线
        const isZeroTick = tick === 0;
        
        g.append("line")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", chartWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", "#e0e0e0")
            .attr("class", "background")
            .attr("stroke-width", isZeroTick ? 1.5 : 1) // 0刻度线稍粗
            .attr("stroke-dasharray", isZeroTick ? null : "2,2"); // 0刻度线为实线
    });
    
    // 计算每个点相比前一个点的变化百分比
    const percentChanges = [];
    for (let i = 1; i < chartData.length; i++) {
        const currentValue = chartData[i][yField];
        const previousValue = chartData[i-1][yField];
        const percentChange = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;

        if (previousValue !== 0) {
            percentChanges.push({
                index: i,
                value: percentChange,
                isPositive: percentChange >= 0
            });
        }
    }
    
    // 找出最大的百分比变化（绝对值）
    const maxPercentChange = d3.max(percentChanges, d => Math.abs(d.value));
    
    // 绘制顶部边缘线 - 从第二个点开始
    const lineData = chartData.slice(1);
    g.append("path")
        .datum(lineData)
        .attr("fill", "none")
        .attr("stroke", areaColor)
        .attr("stroke-width", 4)
        .attr("d", line);
    
    // 添加数据点圆圈 - 从第二个点开始
    lineData.forEach((d, i) => {
        const x = xScale(parseDate(d[xField]));
        const y = yScale(d[yField]);
        
        // 判断是否为起点或终点
        const isEndpoint = i === 0 || i === lineData.length - 1;
        
        // 添加圆圈
        g.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", isEndpoint ? 5 : 2)
            .attr("fill", isEndpoint ? "#fff" : areaColor)
            .attr("stroke", areaColor)
            .attr("stroke-width", 4);
    });

    const sampleLabelIndex = sampleLabels(chartData.length);
    
    // 添加变化百分比三角形
    percentChanges.forEach(change => {
        if(!sampleLabelIndex.includes(change.index)) {
            return;
        }
        const d = chartData[change.index];
        const x = xScale(parseDate(d[xField]));
        const y = yScale(d[yField]);

        const prevY = yScale(chartData[change.index - 1][yField]);
        const nextY = change.index < chartData.length - 1 ? yScale(chartData[change.index + 1][yField]) : yScale(chartData[change.index][yField]);

        const prevYInterp = y + (prevY - y) * 0.2;
        const nextYInterp = y + (nextY - y) * 0.2;

        const finalY = change.isPositive ? Math.min(y, prevYInterp, nextYInterp) : Math.max(y, prevYInterp, nextYInterp);

        // 三角形颜色
        const triangleColor = change.isPositive ? "#469377" : "#c63310";
        
        // 三角形大小 - 根据相对于最大百分比的比例计算
        const absChange = Math.abs(change.value);
        const minSize = 10; // 最小大小
        const maxSize = 40; // 最大大小
        
        // 计算相对比例并确定大小
        const ratio = absChange / maxPercentChange;
        const size = minSize + (maxSize - minSize) * ratio;
        
        // 计算等边三角形的高度
        const triangleHeight = size * Math.sqrt(3) / 2;
        
        // 三角形位置
        const triangleY = change.isPositive ? 
            finalY - triangleHeight - 10 : // 上升三角形放在上方
            finalY + 10; // 下降三角形放在下方
        
        // 创建圆角等边三角形路径
        const radius = 3; // 圆角半径
        let path;
        
        if (change.isPositive) {
            // 上升三角形 - 尖端朝上
            // 等边三角形的三个顶点
            const top = [x, triangleY];
            const bottomLeft = [x - size/2, triangleY + triangleHeight];
            const bottomRight = [x + size/2, triangleY + triangleHeight];
            
            // 创建圆角等边三角形路径
            path = `
                M ${bottomLeft[0] + radius},${bottomLeft[1]}
                L ${bottomRight[0] - radius},${bottomRight[1]}
                Q ${bottomRight[0]},${bottomRight[1]} ${bottomRight[0] - radius * 0.5},${bottomRight[1] - radius * 0.8}
                L ${top[0] + radius * 0.5},${top[1] + radius * 0.8}
                Q ${top[0]},${top[1]} ${top[0] - radius * 0.5},${top[1] + radius * 0.8}
                L ${bottomLeft[0] + radius * 0.5},${bottomLeft[1] - radius * 0.8}
                Q ${bottomLeft[0]},${bottomLeft[1]} ${bottomLeft[0] + radius},${bottomLeft[1]}
                Z
            `;
        } else {
            // 下降三角形 - 尖端朝下
            // 等边三角形的三个顶点
            const bottom = [x, triangleY + triangleHeight];
            const topLeft = [x - size/2, triangleY];
            const topRight = [x + size/2, triangleY];
            
            // 创建圆角等边三角形路径
            path = `
                M ${topLeft[0] + radius},${topLeft[1]}
                L ${topRight[0] - radius},${topRight[1]}
                Q ${topRight[0]},${topRight[1]} ${topRight[0] - radius * 0.5},${topRight[1] + radius * 0.8}
                L ${bottom[0] + radius * 0.5},${bottom[1] - radius * 0.8}
                Q ${bottom[0]},${bottom[1]} ${bottom[0] - radius * 0.5},${bottom[1] - radius * 0.8}
                L ${topLeft[0] + radius * 0.5},${topLeft[1] + radius * 0.8}
                Q ${topLeft[0]},${topLeft[1]} ${topLeft[0] + radius},${topLeft[1]}
                Z
            `;
        }
        
        // 绘制三角形
        g.append("path")
            .attr("d", path)
            .attr("fill", triangleColor);
        
        // 格式化百分比文本 - 正值添加+号
        const formattedValue = change.value > 0 ? 
            `+${change.value.toFixed(1)}%` : 
            `${change.value.toFixed(1)}%`;
        
        // 添加变化百分比文本 - 放在三角形外部
        const textY = change.isPositive ? 
            triangleY - 10 : // 上升三角形，文本在三角形上方
            triangleY + triangleHeight + 20; // 下降三角形，文本在三角形下方
        
        g.append("text")
            .attr("x", x)
            .attr("y", textY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#333") // 黑色文本
            .attr("font-weight", "bold")
            .style("font-size", "14px")
            .text(formattedValue);
    });
    
    // 添加X轴文本 - 放在最小Y刻度下方
    xTicks.forEach(tick => {
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", minYTickPosition + 25) // 放在最小Y刻度下方25像素处
            .attr("text-anchor", "middle")
            .attr("fill", "#666")
            .style("font-size", "12px")
            .text(xFormat(tick));
    });
    
    // 添加Y轴文本
    yScale.ticks(5).forEach(tick => {
        g.append("text")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#666")
            .style("font-size", "12px")
            .text(tick.toFixed(1));
    });
    
    // 找到关键点：只关注终点和倒数第二个点
    const lastPoint = chartData[chartData.length - 1];
    const secondLastPoint = chartData[chartData.length - 2];
    
    // 判断结束趋势：如果最后一个点比倒数第二个点高，则趋势向上
    const isUpwardTrend = lastPoint[yField] > secondLastPoint[yField];
    
    // 添加关键点标注
    const addDataLabel = (point, isHighest) => {
        const x = xScale(parseDate(point[xField]));
        const y = yScale(point[yField]);
        
        // 创建标签背景
        const labelWidth = 45;
        const labelHeight = 25;
        const labelX = x - labelWidth / 2;
        
        // 根据是最高点还是最低点调整标签位置和三角形方向
        let labelY, trianglePath;
        
        if (isHighest) {
            // 最高点 - 标签在上方，三角形指向下方
            labelY = y - labelHeight - 20;
            trianglePath = `M${x},${labelY + labelHeight + 5} L${x - 5},${labelY + labelHeight} L${x + 5},${labelY + labelHeight} Z`;
        } else {
            // 最低点 - 标签在下方，三角形指向上方
            labelY = y + 20;
            trianglePath = `M${x},${labelY - 5} L${x - 5},${labelY} L${x + 5},${labelY} Z`;
        }
        
        // 添加标签背景
        g.append("rect")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("width", labelWidth)
            .attr("height", labelHeight)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", areaColor);
        
        // 添加三角形指向数据点
        g.append("path")
            .attr("d", trianglePath)
            .attr("fill", areaColor);
        
        // 添加文本
        g.append("text")
            .attr("x", x)
            .attr("y", labelY + labelHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "white")
            .attr("font-weight", "bold")
            .style("font-size", "12px")
            .text(point[yField].toFixed(2));
    };
    
    // 只添加终点标注
    // 如果趋势向上，标签放在下方(isHighest=false)；如果趋势向下，标签放在上方(isHighest=true)
    addDataLabel(lastPoint, !isUpwardTrend);
    
    // 添加图例 - 整体居中
    // 首先创建一个容器组，稍后再设置其位置
    const legendGroup = g.append("g");

    // 获取字段名称
    const fieldName = dataColumns[1].label || dataColumns[1].name;
    // 估算字段名称的宽度（每个字符约8像素）
    const fieldNameWidth = fieldName.length * 8;

    // 计算三角形图例的起始位置，确保不会与字段名称重叠
    const triangleStartX = 30 + fieldNameWidth;

    // 添加Sales图例
    legendGroup.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 8)
        .attr("fill", areaColor);

    legendGroup.append("text")
        .attr("x", 15)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .attr("fill", "#333")
        .style("font-size", "14px")
        .text(fieldName);

    // 添加% change图例 - 使用圆角等边三角形
    const triangleSize = 18; // 三角形大小
    const triangleHeight = triangleSize * Math.sqrt(3) / 2; // 等边三角形高度
    const triangleSpacing = -4; // 三角形之间的间距

    // 绿色上升三角形 - 使用圆角等边三角形路径
    const upTriangleX = triangleStartX;
    const upTriangleY = 0;

    // 创建上升三角形的顶点
    const upTop = [upTriangleX, upTriangleY - triangleHeight/2];
    const upBottomLeft = [upTriangleX - triangleSize/2, upTriangleY + triangleHeight/2];
    const upBottomRight = [upTriangleX + triangleSize/2, upTriangleY + triangleHeight/2];

    // 绘制上升三角形
    legendGroup.append("path")
        .attr("d", `
            M ${upBottomLeft[0]},${upBottomLeft[1]}
            L ${upBottomRight[0]},${upBottomRight[1]}
            L ${upTop[0]},${upTop[1]}
            Z
        `)
        .attr("fill", "#469377");

    // 红色下降三角形 - 使用圆角等边三角形路径
    const downTriangleX = upTriangleX + triangleSize + triangleSpacing;
    const downTriangleY = 0;

    // 创建下降三角形的顶点
    const downBottom = [downTriangleX, downTriangleY + triangleHeight/2];
    const downTopLeft = [downTriangleX - triangleSize/2, downTriangleY - triangleHeight/2];
    const downTopRight = [downTriangleX + triangleSize/2, downTriangleY - triangleHeight/2];

    // 绘制下降三角形
    legendGroup.append("path")
        .attr("d", `
            M ${downTopLeft[0]},${downTopLeft[1]}
            L ${downTopRight[0]},${downTopRight[1]}
            L ${downBottom[0]},${downBottom[1]}
            Z
        `)
        .attr("fill", "#c63310");

    // 添加"% change"文本
    const changeText = legendGroup.append("text")
        .attr("x", downTriangleX + triangleSize/2 + 10) // 放在下降三角形右侧
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .attr("fill", "#333")
        .style("font-size", "14px")
        .text("% change");

    // 计算整个图例的总宽度
    const changeTextWidth = "% change".length * 8; // 估算"% change"文本宽度
    const totalLegendWidth = downTriangleX + triangleSize/2 + 10 + changeTextWidth;

    // 设置图例组的位置，使其整体居中
    legendGroup.attr("transform", `translate(${(chartWidth - totalLegendWidth)/2}, 60)`);
    
    return svg.node();
} 