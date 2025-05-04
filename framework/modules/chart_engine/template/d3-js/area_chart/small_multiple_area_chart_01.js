/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Small Multiple Area Chart",
    "chart_name": "small_multiple_area_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 50], [0, "inf"], [2, 20]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["background"],
    "supported_effects": ["gradient", "opacity"],
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
    
    // 计算最长组名的长度，用于动态调整左边距
    const maxGroupNameLength = d3.max(groups, group => group.length);
    // 每个字符估计宽度为8像素，再加上基础边距和一些额外空间
    const dynamicLeftMargin = Math.max(120, maxGroupNameLength * 8 + 40);
    
    // 设置尺寸和边距 - 动态调整左侧边距和右侧边距（为Y轴留出空间）
    const width = variables.width;
    const height = variables.height;
    const margin = { 
        top: 60, 
        right: 60, // 增加右边距为Y轴留出空间
        bottom: 60, 
        left: dynamicLeftMargin
    };
    
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
    
    // 为每个组计算最大值
    const groupMaxValues = {};
    groups.forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        groupMaxValues[group] = d3.max(groupData, d => d[yField]);
    });
    
    // 计算每个组的垂直位置（上下错开）
    const groupHeight = chartHeight / (groups.length * 1.5); // 每个组的高度，留出一些间距
    const groupPositions = {};
    groups.forEach((group, i) => {
        groupPositions[group] = i * groupHeight * 1.5; // 乘以1.5是为了留出间距
    });
    
    // 创建y轴比例尺（每个组有自己的比例尺）
    const yScales = {};
    groups.forEach(group => {
        yScales[group] = d3.scaleLinear()
            .domain([0, groupMaxValues[group]])
            .range([groupHeight, 0]); // 从下到上
    });
    
    // 添加网格线和x轴刻度
    
    // 添加垂直网格线
    xTicks.forEach(tick => {
        g.append("line")
            .attr("x1", xScale(tick))
            .attr("y1", 0)
            .attr("x2", xScale(tick))
            .attr("y2", chartHeight)
            .attr("stroke", "#ffffff")
            .attr("stroke-opacity", 0.1)
            .attr("stroke-width", 1);
    });
    
    xTicks.forEach(tick => {
        // 添加上方x轴年份标签
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "bottom")
            .attr("fill", "#ffffff")
            .style("font-size", "12px")
            .text(xFormat(tick));
        
        // 添加下方x轴年份标签
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", chartHeight + 15)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("fill", "#ffffff")
            .style("font-size", "12px")
            .text(xFormat(tick));
    });
    
    // 创建面积生成器
    const area = (group) => d3.area()
        .x(d => xScale(parseDate(d[xField])))
        .y0(groupPositions[group] + groupHeight) // 底部是固定的
        .y1(d => groupPositions[group] + yScales[group](d[yField])) // 顶部根据数据变化
        .curve(d3.curveBasis); // 使用平滑曲线
    
    // 为每个组创建面积图和Y轴
    groups.forEach(group => {
        // 过滤该组的数据
        const groupData = chartData.filter(d => d[groupField] === group);
        
        // 确保数据按日期排序
        groupData.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
        
        // 获取颜色
        const color = colors.field && colors.field[group] 
            ? colors.field[group] 
            : d3.schemeCategory10[groups.indexOf(group) % 10];
        
        // 添加0线 - 水平线位于组的底部位置，延伸到图表结束
        g.append("line")
            .attr("x1", -margin.left + 20) // 从左侧边缘开始
            .attr("y1", groupPositions[group] + groupHeight) // y0位置
            .attr("x2", chartWidth) // 延伸到图表区域结束
            .attr("y2", groupPositions[group] + groupHeight)
            .attr("stroke", color)
            .attr("stroke-width", 1.5)
            .attr("stroke-opacity", 0.8);
        
        // 绘制面积
        g.append("path")
            .datum(groupData)
            .attr("fill", color)
            .attr("d", area(group));
        
        // 添加组名标签 - 放在面积图左侧，距离更远
        g.append("text")
            .attr("x", -margin.left + 20) // 增加与图表的距离
            .attr("y", groupPositions[group] + groupHeight - 10)
            .attr("text-anchor", "start") // 左对齐
            .attr("dominant-baseline", "middle")
            .attr("fill", color)
            .attr("font-weight", "bold")
            .style("font-size", "14px")
            .text(group);
        
        // 创建Y轴 - 在右侧
        const yAxis = d3.axisRight(yScales[group])
            .ticks(3) // 减少刻度数量，避免拥挤
            .tickSize(0) // 不显示刻度线
            .tickFormat(d => d3.format(".1s")(d)); // 使用简洁格式
        
        // 添加Y轴
        const yAxisGroup = g.append("g")
            .attr("transform", `translate(${chartWidth}, ${groupPositions[group]})`)
            .call(yAxis);
        
        // 设置Y轴样式
        yAxisGroup.selectAll("path")
            .attr("stroke", color);
        
        yAxisGroup.selectAll("text")
            .attr("fill", color)
            .attr("font-size", "10px")
            .attr("dx", "0.5em"); // 向右移动文本
        
        // 添加水平辅助线
        yScales[group].ticks(3).forEach(tick => {
            if (tick > 0) { // 跳过0线，因为已经单独添加了
                g.append("line")
                    .attr("x1", 0)
                    .attr("y1", groupPositions[group] + yScales[group](tick))
                    .attr("x2", chartWidth)
                    .attr("y2", groupPositions[group] + yScales[group](tick))
                    .attr("stroke", color)
                    .attr("stroke-opacity", 0.2)
                    .attr("stroke-width", 0.5)
                    .attr("stroke-dasharray", "2,2"); // 虚线
            }
        });
    });
    
    return svg.node();
} 