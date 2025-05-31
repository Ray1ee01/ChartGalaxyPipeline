/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Line Graph",
    "chart_name": "multiple_line_graph_12",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 30], [0, "inf"], [2, 2]],
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
    "has_y_axis": "yes",
    "chart_for": "comparison"
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
    const margin = { top: 100, right: 30, bottom: 100, left: 50 };
    
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
    
    // X轴文本的高度
    const xAxisTextHeight = 30;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 获取唯一的组值
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 按组分组数据
    const groupedData = d3.group(chartData, d => d[groupField]);
    
    // 计算每个组的平均值，找出最高和最低的组
    const groupAverages = new Map();
    
    groupedData.forEach((values, group) => {
        const sum = values.reduce((acc, d) => acc + d[yField], 0);
        const avg = sum / values.length;
        groupAverages.set(group, avg);
    });
    
    // 找出平均值最高和最低的组
    let highestGroup = null;
    let lowestGroup = null;
    let highestAvg = -Infinity;
    let lowestAvg = Infinity;
    
    groupAverages.forEach((avg, group) => {
        if (avg > highestAvg) {
            highestAvg = avg;
            highestGroup = group;
        }
        if (avg < lowestAvg) {
            lowestAvg = avg;
            lowestGroup = group;
        }
    });
    
    // 只保留最高和最低的两个组
    const selectedGroups = [highestGroup, lowestGroup];

    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, chartWidth);
    
    // 创建y轴比例尺 - 使用数据的实际范围
    const yMin = d3.min(chartData, d => d[yField]);
    const yMax = d3.max(chartData, d => d[yField]);
    
    // 为了美观，稍微扩展Y轴范围
    const yPadding = (yMax - yMin) * 0.3;
    const yDomainMax = yMax + yPadding;
    const yDomainMin = Math.max(0, yMin - yPadding); // 确保下限不小于0
    
    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([chartHeight, 0]);
    
    // 创建颜色比例尺
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((g, i) => {
            if (colors.field && colors.field[g]) {
                return colors.field[g];
            }
            return d3.schemeCategory10[i % 10];
        }));
    
    // 获取实际的Y轴刻度 - 减少刻度数量
    const yTicks = yScale.ticks(5); // 保持5个刻度
    const maxYTick = yTicks[yTicks.length - 1]; // 最大的Y轴刻度值
    
    // 计算最大Y刻度的位置
    const maxYTickPosition = yScale(maxYTick);
    
    // 添加图例 - 整体居中，放在最大Y轴刻度上方
    const legendY = maxYTickPosition - 60; // 最大Y轴刻度上方20像素
    
    // 计算比值圆形的Y位置
    const ratioCircleY = maxYTickPosition - 30;
    
    // 添加条纹背景 - 使用更合适的时间间隔
    
    // 为每个X轴刻度创建条纹背景，使条纹以刻度为中心
    // 条纹背景要覆盖到圆形区域
    for (let i = 0; i < xTicks.length - 1; i++) {
        // 获取相邻两个刻度
        const currentTick = xTicks[i];
        const nextTick = xTicks[i + 1];
        
        // 计算当前刻度和下一个刻度的位置
        const x1 = xScale(currentTick);
        const x2 = xScale(nextTick);
        
        // 每隔一个刻度添加浅色背景
        if (i % 2 === 0) {
            g.append("rect")
                .attr("x", x1)
                .attr("y", legendY + 10) // 从legend下方20像素开始
                .attr("width", x2 - x1)
                .attr("height", chartHeight + xAxisTextHeight - (legendY + 10)) // 高度需要减去legend的位置
                .attr("fill", "#ececec")
                .attr("class", "background")
                .attr("opacity", 0.8);
        }
    }
    
    // 将条纹背景移到最底层
    g.selectAll("rect").lower();
    
    // 添加水平网格线
    yTicks.forEach(tick => {
        g.append("line")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", chartWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", "#e0e0e0")
            .attr("stroke-width", 1)
            .attr("class", "background")
            .attr("stroke-dasharray", "2,2");
    });
    
    // 定义线条粗细
    const lineWidth = 4;
    
    // 创建线条生成器
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveLinear);
    
    // 为每个X刻度创建插值函数，计算比值
    const highValues = groupedData.get(highestGroup);
    const lowValues = groupedData.get(lowestGroup);
    
    // 确保数据按日期排序
    highValues.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
    lowValues.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
    
    // 创建插值函数
    const highInterpolator = d3.scaleTime()
        .domain(highValues.map(d => parseDate(d[xField])))
        .range(highValues.map(d => d[yField]))
        .clamp(true);
    
    const lowInterpolator = d3.scaleTime()
        .domain(lowValues.map(d => parseDate(d[xField])))
        .range(lowValues.map(d => d[yField]))
        .clamp(true);
    
    // 计算每个X刻度的比值（转为百分比）
    const ratios = xTicks.map(tick => {
        const highVal = highInterpolator(tick);
        const lowVal = lowInterpolator(tick);
        return {
            date: tick,
            ratio: (lowVal / highVal) * 100 // 转为百分比
        };
    });
    
    // 找出最大和最小的百分比值
    const minRatio = d3.min(ratios, d => d.ratio);
    const maxRatio = d3.max(ratios, d => d.ratio);
    
    // 创建圆形大小的比例尺
    const radiusScale = d3.scaleLinear()
        .domain([minRatio, maxRatio])
        .range([12, 20]); // 最小半径10，最大半径20
    
    // 获取两个组的颜色
    const highColor = colorScale(highestGroup);
    const lowColor = colorScale(lowestGroup);
    
    // 判断哪个颜色更浅
    const highColorRGB = d3.rgb(highColor);
    const lowColorRGB = d3.rgb(lowColor);
    
    // 计算颜色的亮度（简单方法：R+G+B的总和）
    const highBrightness = highColorRGB.r + highColorRGB.g + highColorRGB.b;
    const lowBrightness = lowColorRGB.r + lowColorRGB.g + lowColorRGB.b;
    
    // 确定浅色和深色
    let lightColor, darkColor;
    if (highBrightness >= lowBrightness) {
        lightColor = highColorRGB;
        darkColor = lowColorRGB;
    } else {
        lightColor = lowColorRGB;
        darkColor = highColorRGB;
    }
    
    // 计算圆的颜色：浅色变得更浅
    const circleR = Math.min(255, lightColor.r + (255 - lightColor.r) * 0.7);
    const circleG = Math.min(255, lightColor.g + (255 - lightColor.g) * 0.7); 
    const circleB = Math.min(255, lightColor.b + (255 - lightColor.b) * 0.7);
    
    const circleColor = d3.rgb(circleR, circleG, circleB);
    
    // 绘制只选中的两个组的线条
    selectedGroups.forEach(group => {
        const values = groupedData.get(group);
        // 确保数据按日期排序
        values.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
        
        const color = colorScale(group);
        
        // 绘制线条
        g.append("path")
            .datum(values)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", lineWidth)
            .attr("d", line);
        
        // 添加数据点 - 根据是否为起止点使用不同样式
        values.forEach((d, i) => {
            const isEndpoint = i === 0 || i === values.length - 1;
            
            if (isEndpoint) {
                // 起止点：白色填充，带有颜色描边
                g.append("circle")
                    .attr("cx", xScale(parseDate(d[xField])))
                    .attr("cy", yScale(d[yField]))
                    .attr("r", lineWidth * 1.2)
                    .attr("fill", "#fff")
                    .attr("stroke", color)
                    .attr("stroke-width", lineWidth);
            } else {
                // 中间点：实心颜色填充，无描边
                g.append("circle")
                    .attr("cx", xScale(parseDate(d[xField])))
                    .attr("cy", yScale(d[yField]))
                    .attr("r", lineWidth)
                    .attr("fill", color)
                    .attr("stroke", "none");
            }
        });
        
        // 添加起点和终点标注
        const firstPoint = values[0];
        const lastPoint = values[values.length - 1];
        
        // 添加起点标注
        addDataLabel(firstPoint, true);
        
        // 添加终点标注
        addDataLabel(lastPoint, false);
    });
    
    // 添加X轴文本 - 放置在条纹背景的中间
    for (let i = 0; i < xTicks.length - 1; i++) {
        // 获取相邻两个刻度
        const currentTick = xTicks[i];
        const nextTick = xTicks[i + 1];
        
        // 计算当前刻度和下一个刻度的位置
        const x1 = xScale(currentTick);
        const x2 = xScale(nextTick);
        
        // 计算中点位置
        const midX = (x1 + x2) / 2;
        
        g.append("text")
            .attr("x", midX)
            .attr("y", chartHeight + 20)
            .attr("text-anchor", "middle")
            .attr("fill", "#666")
            .style("font-size", "12px")
            .text(xFormat(currentTick));
    }
    
    
    // 添加Y轴文本
    yTicks.forEach(tick => {
        g.append("text")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#666")
            .style("font-size", "12px")
            .text(tick.toFixed(1));
    });
    
    // 添加图例 - 整体居中，放在最大Y轴刻度上方
    const legendGroup = g.append("g")
        .attr("transform", `translate(0, -50)`);
    
    const group_names = [lowestGroup, highestGroup, `${lowestGroup}/${highestGroup}`];
    const colors_legend = {
        field: {
            [lowestGroup]: lowColor,
            [highestGroup]: highColor,
            [`${lowestGroup}/${highestGroup}`]: circleColor,
        }
    }
    
    const legendSize = layoutLegend(legendGroup, group_names, colors_legend, {
        x: 0,
        y: 0,
        fontSize: 14,
        fontWeight: "bold",
        align: "left",
        maxWidth: chartWidth,
        shape: "circle",
    });

    // 居中legend
    legendGroup.attr("transform", `translate(${(chartWidth - legendSize.width) / 2}, ${-50 - legendSize.height/2})`);
    
    // 添加每个X刻度的比值，使用圆形背景
    ratios.forEach((ratio, i) => {
        if (i === 0) {
            return;
        }
        
        // 跳过无效比值
        if (ratio.invalid) {
            return;
        }
        
        const x = xScale(ratio.date) - (xScale(ratio.date) - xScale(ratios[i-1].date)) / 2;
        const y = ratioCircleY;
        const radius = radiusScale(ratio.ratio);
        
        // 添加圆形背景
        g.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", radius)
            .attr("fill", circleColor.toString());
        
        // 添加百分比文本
        g.append("text")
            .attr("x", x)
            .attr("y", y)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#333")
            .style("font-size", "12px")
            .text(`${ratio.ratio.toFixed(0)}%`);
    });
    
    // 添加数据标注函数 - 根据数据点的实际值决定标签位置
    function addDataLabel(point, isStart) {
        const x = xScale(parseDate(point[xField]));
        const y = yScale(point[yField]);
        
        // 获取点所属的组
        const group = point[groupField];
        const color = colorScale(group);
        
        // 计算标签文本
        const labelText = point[yField].toFixed(0);
        
        // 计算标签宽度和高度
        const labelWidth = labelText.length * 8 + 16; // 根据文本长度计算宽度
        const labelHeight = 24;
        
        // 获取另一组在同一时间点的值
        const otherGroup = group === highestGroup ? lowestGroup : highestGroup;
        const otherGroupData = groupedData.get(otherGroup);
        
        // 找到同一时间点的另一组数据
        const otherPoint = otherGroupData.find(d => d[xField] === point[xField]);
        
        // 判断当前点的值是否大于另一组同时间点的值
        const isHigherValue = otherPoint ? point[yField] > otherPoint[yField] : true;
        
        // 根据值的大小决定标签位置
        const labelY = isHigherValue ? y - 30 : y + 30;
        
        // 添加圆角矩形背景
        g.append("rect")
            .attr("x", x - labelWidth / 2)
            .attr("y", labelY - labelHeight / 2)
            .attr("width", labelWidth)
            .attr("height", labelHeight)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", color);
        
        // 添加三角形 - 方向根据标签位置决定
        const triangleSize = 8;
        if (isHigherValue) {
            // 值较高：向下的三角形
            g.append("path")
                .attr("d", `M${x-triangleSize/2},${labelY+labelHeight/2} L${x+triangleSize/2},${labelY+labelHeight/2} L${x},${labelY+labelHeight/2+triangleSize} Z`)
                .attr("fill", color);
        } else {
            // 值较低：向上的三角形
            g.append("path")
                .attr("d", `M${x-triangleSize/2},${labelY-labelHeight/2} L${x+triangleSize/2},${labelY-labelHeight/2} L${x},${labelY-labelHeight/2-triangleSize} Z`)
                .attr("fill", color);
        }
        
        // 添加文本 - 白色粗体
        g.append("text")
            .attr("x", x)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#fff") // 白色文本
            .attr("font-weight", "bold") // 粗体
            .style("font-size", "12px")
            .text(labelText);
    }
    
    return svg.node();
} 