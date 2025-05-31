/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Line Graph",
    "chart_name": "line_graph_plain_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 10]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 800,
    "background": "light",
    "icon_mark": "overlay",
    "icon_label": "side",
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
    
    // X轴文本的高度
    const xAxisTextHeight = 30;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 获取唯一的组值
    const groups = [...new Set(chartData.map(d => d[groupField]))];

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
    
    // 添加条纹背景 - 使用更合适的时间间隔
    
    // 为每个X轴刻度创建条纹背景，使条纹以刻度为中心
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
                .attr("y", maxYTickPosition) // 从最大Y刻度开始
                .attr("width", x2 - x1)
                .attr("height", chartHeight - maxYTickPosition + xAxisTextHeight) // 延伸到X轴文本下方
                .attr("fill", "#ececec")
                .attr("class", "background")
                .attr("opacity", 0.8);
        }
    }
    
    
    // 将条纹背景移到最底层
    g.selectAll("rect").lower();
    
    // 添加图标水印（如果有）
    if (images && images.field) {
        // 创建一个滤镜使图像黑白化并变淡
        const defs = svg.append("defs");
        
        // 添加淡灰色滤镜 - 修改参数使颜色变淡
        const lightGrayFilter = defs.append("filter")
            .attr("id", "lightgray");
        
        // 先转为灰度
        lightGrayFilter.append("feColorMatrix")
            .attr("type", "matrix")
            .attr("values", "0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0 0 0 1 0");
        
        // 再提亮颜色 - 使用亮度组件
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
        
        // 计算每个组的线条中心位置
        const groupCenters = new Map();
        
        // 按组分组数据
        const groupedData = d3.group(chartData, d => d[groupField]);
        
        groupedData.forEach((values, group) => {
            // 确保数据按日期排序
            values.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
            
            // 计算该组线条的中心点
            const xPoints = values.map(d => xScale(parseDate(d[xField])));
            const yPoints = values.map(d => yScale(d[yField]));
            
            // 找到线条的中间点
            const midIndex = Math.floor(values.length / 2);
            const centerX = xPoints[midIndex];
            const centerY = yPoints[midIndex];
            
            // 存储中心点
            groupCenters.set(group, { x: centerX, y: centerY });
        });
        
        // 添加组图标水印 - 均匀分布在X轴上，Y位置对应X位置处的线条值
        groups.forEach((group, groupIndex) => {
            if (images.field[group]) {
                const values = groupedData.get(group);
                if (!values || values.length === 0) return;
                
                // 确保数据按日期排序
                values.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
                
                const iconSize = 120;
                
                // 计算X轴位置 - 将X轴均匀分成组数量的区域，但避开边缘
                // 使用更窄的区域，避开起止点标签
                const usableWidth = chartWidth * 0.7; // 使用70%的图表宽度
                const margin = (chartWidth - usableWidth) / 2; // 两侧边距
                
                const sectionWidth = usableWidth / groups.length;
                const xPos = margin + sectionWidth * (groupIndex + 0.5); // 区域中心点
                
                // 找到最接近xPos的数据点
                // 首先将xPos转换回日期域
                const xDate = xScale.invert(xPos);
                
                // 找到最接近该日期的数据点
                let closestPoint = values[0];
                let minDistance = Math.abs(parseDate(closestPoint[xField]) - xDate);
                
                for (let i = 1; i < values.length; i++) {
                    const distance = Math.abs(parseDate(values[i][xField]) - xDate);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestPoint = values[i];
                    }
                }
                
                // 使用最接近点的Y值
                const yPos = yScale(closestPoint[yField]);
                
                const watermark = g.append("image")
                    .attr("x", xPos - iconSize / 2) // 水印中心与区域中心对齐
                    .attr("y", yPos - iconSize / 2) // 使用对应X位置处的Y值
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("href", images.field[group])
                    .attr("opacity", 1) // 保持完全不透明
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("filter", "url(#lightgray)"); // 使用淡灰色滤镜
                
                // 确保水印在条纹背景上方，线条下方
                watermark.lower();
                g.selectAll("rect").lower();
            }
        });
    }
    
    // 添加水平网格线
    yTicks.forEach(tick => {
        g.append("line")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", chartWidth)
            .attr("y2", yScale(tick))
            .attr("class", "background")
            .attr("stroke", "#e0e0e0")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,2");
    });
    
    // 按组分组数据
    const groupedData = d3.group(chartData, d => d[groupField]);
    
    // 定义线条粗细
    const lineWidth = 4;
    
    // 创建线条生成器
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveLinear);
    
    // 绘制每个组的线条
    groupedData.forEach((values, group) => {
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
        
        // 添加起点和终点标注 - 简化为直接文本
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
            .attr("x", -20)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#666")
            .style("font-size", "12px")
            .text(tick.toFixed(1));
    });
    
    // 添加图例 - 整体居中，放在最大Y轴刻度上方
    const legendGroup = g.append("g");
    
    const legendSize = layoutLegend(legendGroup, groups, colors, {
        x: 0,
        y: 0,
        fontSize: 14,
        fontWeight: "bold",
        align: "left",
        maxWidth: chartWidth,
        shape: "circle",
    });
    
    // 居中legend
    legendGroup.attr("transform", `translate(${(chartWidth - legendSize.width) / 2}, ${maxYTickPosition - 50 - legendSize.height/2})`);
    
    // 添加数据标注函数 - 文本放在线条上方，不加粗
    function addDataLabel(point, isStart) {
        const x = xScale(parseDate(point[xField]));
        const y = yScale(point[yField]);
        
        // 添加文本 - 放在数据点上方，使用黑色
        g.append("text")
            .attr("x", x + (isStart ? -10 : 10))
            .attr("y", y) // 放在数据点上方
            .attr("text-anchor", isStart ? "end" : "start")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#000") // 黑色文本
            .attr("font-weight", "normal") // 移除加粗
            .style("font-size", "12px")
            .text(point[yField].toFixed(2));
    }
    
    return svg.node();
} 