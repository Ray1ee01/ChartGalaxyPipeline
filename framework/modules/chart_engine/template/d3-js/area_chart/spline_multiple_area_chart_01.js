/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Area Chart",
    "chart_name": "spline_multiple_area_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 50], [0, "inf"], [2, 2]],
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
    let groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 如果组数量大于2，只使用前两个组
    if (groups.length > 2) {
        console.warn("此图表设计用于比较两个组，但数据中有", groups.length, "个组。将只使用前两个组。");
        groups = groups.slice(0, 2);
    }
    
    // 设置尺寸和边距 - 注意左右两侧需要对称的空间
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 20, bottom: 60, left: 20 };
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;") // 深蓝色背景
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, chartHeight);
    
    // 定义中心区域的宽度（用于放置标签）
    const centerWidth = 60; // 中心区域宽度
    const halfCenter = centerWidth / 2; // 中心区域的一半宽度
    
    // 创建y轴比例尺（水平方向）- 对称布局，但留出中心空间
    const yMax = d3.max(chartData, d => d[yField]) * 1.1;
    
    // 左侧y轴（负值）- 从中心向左，但留出空间
    const yScaleLeft = d3.scaleLinear()
        .domain([0, yMax])
        .range([chartWidth/2 - halfCenter, 0]); // 从中心左侧向左
    
    // 右侧y轴（正值）- 从中心向右，但留出空间
    const yScaleRight = d3.scaleLinear()
        .domain([0, yMax])
        .range([chartWidth/2 + halfCenter, chartWidth]); // 从中心右侧向右
    
    // 添加中心区域背景（稍微亮一点，以突出年份标签）
    g.append("rect")
        .attr("x", chartWidth/2 - halfCenter)
        .attr("y", 0)
        .attr("width", centerWidth)
        .attr("height", chartHeight)
        .attr("fill", "#1a2748")
        .attr("opacity", 0.5);
    
    // 添加中心垂直线（左侧）
    g.append("line")
        .attr("x1", chartWidth/2 - halfCenter)
        .attr("y1", 0)
        .attr("x2", chartWidth/2 - halfCenter)
        .attr("y2", chartHeight)
        .attr("stroke", "#9badd3")
        .attr("opacity", 0.6)
        .attr("stroke-width", 1);
    
    // 添加中心垂直线（右侧）
    g.append("line")
        .attr("x1", chartWidth/2 + halfCenter)
        .attr("y1", 0)
        .attr("x2", chartWidth/2 + halfCenter)
        .attr("y2", chartHeight)
        .attr("stroke", "#9badd3")
        .attr("opacity", 0.6)
        .attr("stroke-width", 1);
    
    // 添加底部y轴刻度文本
    const yTicks = d3.ticks(0, yMax, 5);
    yTicks.forEach(tick => {
        // 左侧刻度文本 - 包括0刻度
        g.append("text")
            .attr("x", yScaleLeft(tick))
            .attr("y", chartHeight + 20)
            .attr("text-anchor", "middle")
            .attr("fill", "#fff")
            .style("font-size", "12px")
            .text(tick);
        
        // 右侧刻度文本 - 包括0刻度
        g.append("text")
            .attr("x", yScaleRight(tick))
            .attr("y", chartHeight + 20)
            .attr("text-anchor", "middle")
            .attr("fill", "#fff")
            .style("font-size", "12px")
            .text(tick);
    });
    
    // 为每个组创建面积图
    groups.forEach((group, i) => {
        // 获取颜色
        const color = colors.field && colors.field[group] 
            ? colors.field[group] 
            : d3.schemeCategory10[i % 10];
        
        // 过滤该组的数据
        const groupData = chartData.filter(d => d[groupField] === group);
        
        // 确保数据按日期排序
        groupData.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
        
        // 根据组的索引决定使用左侧还是右侧比例尺
        const yScale = i === 0 ? yScaleLeft : yScaleRight;
        
        // 创建面积生成器 - 使用曲线
        const area = d3.area()
            .x0(i === 0 ? chartWidth/2 - halfCenter : chartWidth/2 + halfCenter) // 起始点在中心区域边缘
            .x1(d => yScale(d[yField])) // 终点是数据值
            .y(d => xScale(parseDate(d[xField]))) // y值是时间
            .curve(d3.curveBasis); // 使用平滑曲线
        
        // 绘制面积 - 使用纯色填充，不透明
        g.append("path")
            .datum(groupData)
            .attr("fill", color)
            .attr("d", area);
        
        // 添加组标签（在侧面，纯文本，垂直中间位置）
        if (i === 0) {
            // 左侧组标签背景
            g.append("rect")
                .attr("x", 2)
                .attr("y", chartHeight / 2 - 12)
                .attr("width", group.length * 9 + 6)
                .attr("height", 24)
                .attr("fill", "white")
                .attr("opacity", 0.5)
                .attr("rx", 3);

            // 左侧组标签
            g.append("text")
                .attr("x", 5)
                .attr("y", chartHeight / 2)
                .attr("text-anchor", "start") 
                .attr("dominant-baseline", "middle")
                .attr("fill", color)
                .style("font-size", "14px")
                .style("font-weight", "bold")
                .text(group);
        } else {
            // 右侧组标签背景
            g.append("rect")
                .attr("x", chartWidth - group.length * 9 - 8)
                .attr("y", chartHeight / 2 - 12)
                .attr("width", group.length * 9 + 6)
                .attr("height", 24)
                .attr("fill", "white")
                .attr("opacity", 0.5)
                .attr("rx", 3);

            // 右侧组标签
            g.append("text")
                .attr("x", chartWidth - 5)
                .attr("y", chartHeight / 2)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("fill", color)
                .style("font-size", "14px")
                .style("font-weight", "bold")
                .text(group);
        }
    });

    // 添加X轴刻度和标签（垂直方向）- 放在中心
    // 所有刻度使用相同长度和样式
    xTicks.forEach(tick => {
        // 添加年份标签（每两年一个）
        g.append("text")
            .attr("x", chartWidth/2)
            .attr("y", xScale(tick))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#fff")
            .style("font-size", "12px")
            .text(xFormat(tick));
        
        // 添加刻度线（左侧）- 更长更明显
        g.append("line")
            .attr("x1", chartWidth/2 - halfCenter + 10)
            .attr("y1", xScale(tick))
            .attr("x2", chartWidth/2 - halfCenter)
            .attr("y2", xScale(tick))
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1.5);
        
        // 添加刻度线（右侧）- 更长更明显
        g.append("line")
            .attr("x1", chartWidth/2 + halfCenter)
            .attr("y1", xScale(tick))
            .attr("x2", chartWidth/2 + halfCenter - 10)
            .attr("y2", xScale(tick))
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1.5);
    });
    
    // 添加y轴标题（底部中心）
    g.append("text")
        .attr("x", chartWidth/2)
        .attr("y", chartHeight + 45)
        .attr("text-anchor", "middle")
        .attr("fill", "#fff")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text(dataColumns[1].label || yField);
    
    // 添加图表标题 - 使用yField的名称
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("fill", "#fff")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text(dataColumns[1].label || yField);
    
    return svg.node();
} 