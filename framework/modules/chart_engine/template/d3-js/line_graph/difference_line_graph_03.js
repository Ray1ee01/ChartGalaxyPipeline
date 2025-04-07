/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Line Graph",
    "chart_name": "difference_line_graph_03",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 30], [0, 100], [2, 2]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 400,
    "min_width": 800,
    "background": "styled",
    "icon_mark": "circle",
    "icon_label": "legend",
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
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    // 添加背景
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#f9f9f9");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // X轴文本的高度
    const xAxisTextHeight = 30;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 解析日期 - 只解析年份
    const parseDate = d => {
        if (d instanceof Date) return d;
        if (typeof d === 'number') return new Date(d);
        if (typeof d === 'string') {
            // 提取年份 - 支持YYYY/... 或 YYYY-...格式
            const yearMatch = d.match(/^(\d{4})[/-]/);
            if (yearMatch) {
                const year = parseInt(yearMatch[1]);
                return new Date(year, 0, 1); // 设置为该年的1月1日
            }
        }
        console.warn("无法解析日期:", d);
        return new Date(0); // 返回默认日期作为后备
    };
    
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
    
    // 创建x轴比例尺 - 扩宽范围
    const xExtent = d3.extent(chartData, d => parseDate(d[xField]));
    const xRange = xExtent[1] - xExtent[0];
    const xPadding = xRange * 0.05; // 添加5%的填充
    
    const xScale = d3.scaleTime()
        .domain([
            new Date(xExtent[0].getTime() - xPadding),
            new Date(xExtent[1].getTime() + xPadding)
        ])
        .range([0, chartWidth]);
    
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
            if (colors.fields && colors.fields.group && colors.fields.group[g]) {
                return colors.fields.group[g];
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
    // 根据数据范围选择合适的时间间隔
    let timeInterval;
    const yearDiff = xExtent[1].getFullYear() - xExtent[0].getFullYear();
    
    if (yearDiff > 10) {
        timeInterval = d3.timeYear.every(5); // 每5年
    } else if (yearDiff > 5) {
        timeInterval = d3.timeYear.every(2); // 每2年
    } else if (yearDiff >= 2) {
        timeInterval = d3.timeYear.every(1); // 每1年
    } else {
        timeInterval = d3.timeMonth.every(3); // 每季度
    }
    
    // 获取适当数量的X轴刻度
    const xTicks = xScale.ticks(timeInterval);
    
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
                .attr("opacity", 0.8);
        }
    }
    
    // 将条纹背景移到最底层
    g.selectAll("rect").lower();
    
    // 添加图标水印（如果有）- 放在最高Y刻度之下
    if (images && images.other && images.other.primary) {
        // 创建一个滤镜使图像变淡
        const defs = svg.append("defs");
        
        lightGrayFilter = defs.append("filter")
            .attr("id", "lightgray");
            
        lightGrayFilter.append("feColorMatrix")
            .attr("type", "matrix")
            .attr("values", "0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0 0 0 1 0");
        
        lightGrayFilter.append("feComponentTransfer")
            .append("feFuncR")
            .attr("type", "linear")
            .attr("slope", "0.6")
            .attr("intercept", "0.4");
        
        lightGrayFilter.append("feComponentTransfer")
            .append("feFuncG")
            .attr("type", "linear")
            .attr("slope", "0.6")
            .attr("intercept", "0.4");
        
        lightGrayFilter.append("feComponentTransfer")
            .append("feFuncB")
            .attr("type", "linear")
            .attr("slope", "0.6")
            .attr("intercept", "0.4");
        
        // 添加整个图表的水印 - 放在最高Y刻度之下
        const iconSize = 120;
        const watermark = g.append("image")
            .attr("x", 20)
            .attr("y", maxYTickPosition + 20) // 放在最高Y刻度下方20像素
            .attr("width", iconSize)
            .attr("height", iconSize)
            .attr("href", images.other.primary)
            .attr("opacity", 0.3)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .attr("filter", "url(#lightgray)");
        
        watermark.lower();
        g.selectAll("rect").lower();
    }
    
    // 添加水平网格线
    yTicks.forEach(tick => {
        g.append("line")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", chartWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", "#e0e0e0")
            .attr("stroke-width", 1)
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
        
        // 使用年份作为标签
        const year = currentTick.getFullYear();
        
        g.append("text")
            .attr("x", midX)
            .attr("y", chartHeight + 20)
            .attr("text-anchor", "middle")
            .attr("fill", "#666")
            .style("font-size", "12px")
            .text(year);
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
    const legendItemWidth = 120; // 每个图例项的宽度
    
    // 计算图例的总宽度
    const totalLegendWidth = selectedGroups.length * legendItemWidth;
    
    // 计算图例的起始X位置，使其居中
    const legendStartX = (chartWidth - totalLegendWidth) / 2;
    
    // 为选中的两个组添加图例
    selectedGroups.forEach((group, i) => {
        const color = colorScale(group);
        const legendX = legendStartX + i * legendItemWidth;
        
        g.append("circle")
            .attr("cx", legendX)
            .attr("cy", legendY)
            .attr("r", 6)
            .attr("fill", color);
        
        g.append("text")
            .attr("x", legendX + 15)
            .attr("y", legendY)
            .attr("dominant-baseline", "middle")
            .attr("fill", "#333")
            .style("font-size", "14px")
            .text(group);
    });
    
    // 添加比值图例
    const ratioLegendY = legendY;
    const ratioLegendX = legendStartX + totalLegendWidth + 10; // 在组图例右侧40像素处
    
    // 添加比值图例的圆形示例
    const sampleRadius = 6;
    g.append("circle")
        .attr("cx", ratioLegendX)
        .attr("cy", ratioLegendY)
        .attr("r", sampleRadius)
        .attr("fill", circleColor.toString());
    
    // 添加比值图例的文本
    g.append("text")
        .attr("x", ratioLegendX + sampleRadius + 10)
        .attr("y", ratioLegendY)
        .attr("dominant-baseline", "middle")
        .attr("fill", "#333")
        .style("font-size", "14px")
        .text(`${lowestGroup}/${highestGroup}`);
    
    // 添加每个X刻度的比值，使用圆形背景
    ratios.forEach((ratio, i) => {
        if (i === 0) {
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
    
    // 添加数据标注函数 - 使用圆角矩形和倒三角
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
        
        // 计算标签位置 - 放在数据点上方
        const labelY = y - 30;
        
        // 添加圆角矩形背景
        g.append("rect")
            .attr("x", x - labelWidth / 2)
            .attr("y", labelY - labelHeight / 2)
            .attr("width", labelWidth)
            .attr("height", labelHeight)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", color);
        
        // 添加倒三角形
        const triangleSize = 8;
        g.append("path")
            .attr("d", `M${x-triangleSize/2},${labelY+labelHeight/2} L${x+triangleSize/2},${labelY+labelHeight/2} L${x},${labelY+labelHeight/2+triangleSize} Z`)
            .attr("fill", color);
        
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