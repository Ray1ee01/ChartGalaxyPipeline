/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Spline Area Chart",
    "chart_name": "spline_area_chart_02",
    "required_fields": ["x", "y"],
    "required_fields_type": [["temporal"], ["numerical"]],
    "required_fields_range": [[5, 30], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": ["primary"],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 400,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "no",
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
    const margin = { top: 120, right: 30, bottom: 120, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
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
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 确保数据按日期排序
    chartData.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
    
    // 创建x轴比例尺
    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, chartWidth);
    
    // 创建y轴比例尺 - 从0开始
    const yMax = d3.max(chartData, d => d[yField]);
    const yScale = d3.scaleLinear()
        .domain([0, yMax * 1.4]) // 顶部留出10%的空间
        .range([chartHeight, 0]);
    
    // 获取主色调
    const primaryColor = colors.other && colors.other.primary ? colors.other.primary : "#a67eb7";
    
    // 创建渐变
    const defs = svg.append("defs");
    const gradientId = "area-gradient";
    const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
    
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", primaryColor)
        .attr("stop-opacity", 0.7);
    
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", primaryColor)
        .attr("stop-opacity", 0);
    
    
    // 创建面积生成器
    const area = d3.area()
        .x(d => xScale(parseDate(d[xField])))
        .y0(chartHeight)
        .y1(d => yScale(d[yField]))
        .curve(d3.curveBasis);
    
    // 绘制面积
    g.append("path")
        .datum(chartData)
        .attr("fill", `url(#${gradientId})`)
        .attr("d", area);
    
    // 绘制线条
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveBasis);
    
    g.append("path")
        .datum(chartData)
        .attr("fill", "none")
        .attr("stroke", primaryColor)
        .attr("stroke-width", 3)
        .attr("d", line);
    
    const sampleLabelIndex = sampleLabels(chartData.length);

    // 添加数据点和标签 - 优化标签位置，包括首尾点
    chartData.forEach((d, i) => {
        if (!sampleLabelIndex.includes(i)) {
            return;
        }

        const x = xScale(parseDate(d[xField]));
        const y = yScale(d[yField]);
        
        // 计算更好的标签位置，避免遮挡线条
        let labelY = y;
        
        // 根据点的位置计算标签位置
        if (i === 0) {
            // 第一个点 - 考虑后一个点
            if (chartData.length > 1) {
                const nextPoint = chartData[i+1];
                const nextY = yScale(nextPoint[yField]);
                
                // 计算向前20%的插值
                const forwardY = y + (nextY - y) * 0.2;
                
                // 取两个值中的最小值
                labelY = Math.min(y, forwardY) - 4;
            }
            // 确保标签至少在数据点上方30像素
            labelY = Math.min(labelY, y - 4);
        } else if (i === chartData.length - 1) {
            // 最后一个点 - 考虑前一个点
            const prevPoint = chartData[i-1];
            const prevY = yScale(prevPoint[yField]);
            
            // 计算向后20%的插值
            const backwardY = y + (prevY - y) * 0.2;
            
            // 取两个值中的最小值
            labelY = Math.min(y, backwardY) - 4;
            
            // 确保标签至少在数据点上方30像素
            labelY = Math.min(labelY, y - 4);
        } else {
            // 中间点 - 考虑前后两个点
            const prevPoint = chartData[i-1];
            const nextPoint = chartData[i+1];
            
            // 计算前一个点的y值
            const prevY = yScale(prevPoint[yField]);
            
            // 计算后一个点的y值
            const nextY = yScale(nextPoint[yField]);
            
            // 计算向前20%的插值
            const forwardY = y + (nextY - y) * 0.2;
            
            // 计算向后20%的插值
            const backwardY = y + (prevY - y) * 0.2;
            
            // 取三个值中的最小值（在SVG中，较小的y值表示较高的位置）
            labelY = Math.min(y, forwardY, backwardY) - 4;
            
            // 确保标签至少在数据点上方30像素
            labelY = Math.min(labelY, y - 4);
        }
        
        // 添加标签背景
        const labelValue = Math.round(d[yField]);
        const labelWidth = String(labelValue).length * 10 + 20;
        const labelHeight = 25;
        
        g.append("rect")
            .attr("x", x - labelWidth / 2)
            .attr("y", labelY - labelHeight - 15)
            .attr("width", labelWidth)
            .attr("height", labelHeight)
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("fill", primaryColor)
            .attr("opacity", 0.9);
        
        // 添加标签文本
        g.append("text")
            .attr("x", x)
            .attr("y", labelY - 15 - labelHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#fff")
            .attr("font-weight", "bold")
            .style("font-size", "14px")
            .text(labelValue);
        
        // 添加倒三角形 - 连接到标签
        const triangleSize = 8;
        g.append("path")
            .attr("d", `M${x-triangleSize/2},${labelY-15} L${x+triangleSize/2},${labelY-15} L${x},${labelY-15+triangleSize} Z`)
            .attr("fill", primaryColor);
    
    });
    
    // 添加X轴刻度文本
    xTicks.forEach(tick => {
        const x = xScale(tick);
            
        g.append("text")
            .attr("x", x)
            .attr("y", chartHeight + 25)
            .attr("text-anchor", "middle")
            .attr("fill", colors.text_color)
            .style("font-size", "14px")
            .text(xFormat(tick));
    });
    
    return svg.node();
} 