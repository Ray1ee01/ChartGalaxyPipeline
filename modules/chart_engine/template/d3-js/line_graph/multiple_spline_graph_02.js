/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Spline Graph",
    "chart_name": "multiple_spline_graph_02",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 8]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 600,
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
    
    // 设置尺寸和边距 - 右侧留出更多空间用于标签
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 180, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 获取唯一的组值和X值
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    const xValues = [...new Set(chartData.map(d => d[xField]))].sort();
    
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
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // 添加渐变效果
    const defs = svg.append("defs");

    // 添加网格背景渐变
    const gridGradientId = "grid-background-gradient";
    const gridGradient = defs.append("linearGradient")
        .attr("class", "background")
        .attr("id", gridGradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
        
    gridGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#1e90ff")  // 深科技蓝
        .attr("stop-opacity", 0); // 顶部完全透明
        
    gridGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#1e90ff")  // 深科技蓝
        .attr("stop-opacity", 0.15); // 底部半透明

    // 添加网格背景矩形
    g.append("rect")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", `url(#${gridGradientId})`) // 使用渐变填充
        .attr("class", "background")
        .attr("rx", 0)
        .attr("ry", 0);

    // 创建比例尺 - 修改为时间比例尺
    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, innerWidth);
    
    // 修改Y轴比例尺，支持负值
    const yScale = d3.scaleLinear()
        .domain([
            Math.min(0, d3.min(chartData, d => d[yField]) * 1.1), // 取最小值和0中的较小者
            d3.max(chartData, d => d[yField]) * 1.1
        ])
        .range([innerHeight, 0]);
    
    // 获取颜色
    const getColor = (group) => {
        return colors.field && colors.field[group] ? colors.field[group] : colors.other.primary;
    };
    
    // 添加网格线 - 使用半透明白色
    // 首先获取Y轴的最大刻度值
    const yTicks = yScale.ticks(5);
    const maxYTick = yTicks[yTicks.length - 1];
    const maxYPos = yScale(maxYTick);

    // 绘制水平网格线 - 向左延伸
    const gridExtension = 5; // 网格线向左延伸的距离
    g.selectAll("line.grid-line-y")
        .data(yTicks)
        .enter()
        .append("line")
        .attr("class", "grid-line-y")
        .attr("class", "background")
        .attr("x1", -gridExtension) // 向左延伸
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", "#1e90ff")  // 深科技蓝
        .attr("stroke-width", 1)
        .attr("opacity", 0.15); // 半透明

    // 添加垂直网格线渐变
    const verticalGridGradientId = "vertical-grid-gradient";
    const verticalGridGradient = defs.append("linearGradient")
        .attr("id", verticalGridGradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
        
    verticalGridGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#1e90ff")  // 深科技蓝
        .attr("stop-opacity", 0.1); // 顶部较透明
        
    verticalGridGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#1e90ff")  // 深科技蓝
        .attr("stop-opacity", 0.2); // 底部较不透明

    // 绘制垂直网格线 - 延伸超过Y轴最大刻度和X轴，但不包括最后一个刻度
    g.selectAll("line.grid-line-x")
        .data(xTicks.filter((d, i) => i > 0 && i < xTicks.length - 1)) // 移除第一个和最后一个刻度
        .enter()
        .append("line")
        .attr("class", "grid-line-x")
        .attr("class", "background")
        .attr("x1", d => xScale(d))
        .attr("y1", 0) // 从顶部开始，超过最大Y刻度
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight + 10) // 延伸到X轴下方10像素
        .attr("stroke", "#1e90ff") // 深科技蓝
        .attr("stroke-width", 1)
        .attr("opacity", 0.15); // 半透明
    
    // 为每个组添加线条渐变
    groups.forEach(group => {
        const gradientId = `line-gradient-${group.replace(/\s+/g, '-').toLowerCase()}`;
        const baseColor = getColor(group);
        
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");
            
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", baseColor)
            .attr("stop-opacity", 0.3);
            
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", baseColor)
            .attr("stop-opacity", 0);
    });
    
    // 创建曲线生成器（而不是折线）
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveMonotoneX); // 使用单调曲线插值

    // 计算所有标签的固定宽度
    const fixedLabelWidth = 30; // 固定标签宽度

    // 在最后的竖线上为每个组添加彩色小圆点，并创建指向它们的标签
    let labelPositions = [];
    // 按照最终值，对group排序，从高到低
    groups.sort((a, b) => {
        const aData = chartData.filter(d => d[groupField] === a);
        const bData = chartData.filter(d => d[groupField] === b);
        return d3.descending(aData[aData.length - 1][yField], bData[bData.length - 1][yField]);
    });
    
    groups.forEach((group, i) => {
        const groupData = chartData.filter(d => d[groupField] === group);
        const lastPoint = groupData[groupData.length - 1];
        const circleY = yScale(lastPoint[yField]); // 圆点的实际Y坐标
        let labelY = circleY; // 标签的Y坐标，初始与圆点相同
        
        // 检查是否与现有标签重叠
        labelPositions.forEach(pos => {
            if (Math.abs(labelY - pos) < 30) {
                // 如果重叠，向下移动
                labelY = pos + 30;
            }
        });
        
        labelPositions.push(labelY);
        
        // 创建标签组
        const labelGroup = g.append("g")
            .attr("transform", `translate(${innerWidth + 20}, ${labelY})`);
        
        // 计算数值文本
        const valueText = `${Math.round(lastPoint[yField])}`;

        const textWidth = getTextWidth(valueText, typography.label.font_size) + 10;
        
        // 标签背景 - 固定宽度，无圆角
        labelGroup.append("rect")
            .attr("x", 0)
            .attr("y", -10)
            .attr("width", textWidth * 1.1) // 固定宽度
            .attr("height", 20)
            .attr("fill", getColor(group))
            .attr("rx", 0) // 移除圆角
            .attr("ry", 0); // 移除圆角
        
        // 计算三角形的位置
        // 计算圆点相对于标签的位置
        const relativeCircleY = circleY - labelY; // 圆点相对于标签中心的Y偏移
        
        // 创建一个自定义的三角形路径
        // 三角形右边是垂直的，贴在标签上，左边的尖尖指向圆点
        const trianglePath = `
            M -12,${relativeCircleY} 
            L 0,-10 
            L 0,10 
            Z
        `;
        
        // 添加指向小圆点的三角形
        labelGroup.append("path")
            .attr("d", trianglePath)
            .attr("fill", getColor(group));
        
        // 标签文本 - 只显示数值
        labelGroup.append("text")
            .attr("x", textWidth/2) // 左对齐，留出一点间距
            .attr("y", 2) // 垂直居中
            .attr("text-anchor", "middle") //
            .attr("dominant-baseline", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", "#ffffff")  // 改为白色
            .text(valueText);
        
        // 添加组名文本
        labelGroup.append("text")
            .attr("x", textWidth + 10) // 位于标签右侧，留出间距
            .attr("y", 2) // 垂直居中
            .attr("text-anchor", "start") // 左对齐
            .attr("dominant-baseline", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", "bold")
            .style("fill", getColor(group)) // 使用与组相同的颜色
            .text(group);
    });
    
    // 为每个组绘制线条和面积
    groups.forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        
        // 绘制线条
        g.append("path")
            .datum(groupData)
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", getColor(group))
            .attr("stroke-width", 2)
            .attr("d", line);
    });
    
    // 直接使用xTicks绘制X轴文本
    xTicks.forEach(tick => {
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", innerHeight + 25) // 下移文本
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", "#333333")
            .text(xFormat(tick));
    });
    
    
    // 为每个刻度添加文本
    yTicks.forEach(tick => {
        g.append("text")
            .attr("x", -gridExtension - 5)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", "#333333")
            .text(tick);
    });

    
    // 添加Y轴编码标签
    const labelGroup = g.append("g")
        .attr("transform", `translate(${-margin.left + 35}, ${maxYPos - 40})`);

    // 计算标签宽度（根据文字长度调整）
    const labelText = yField;
    const labelPadding = 20;
    const textWidth = getTextWidth(labelText, typography.label.font_size);

    const labelWidth = textWidth + 2 * labelPadding;
    const labelHeight = 20;
    const triangleHeight = 6;

    // 创建标签形状（矩形+三角形）
    const labelPath = `
        M 0,0 
        H ${labelWidth} 
        V ${labelHeight} 
        H ${labelWidth/2 + triangleHeight} 
        L ${labelWidth/2},${labelHeight + triangleHeight} 
        L ${labelWidth/2 - triangleHeight},${labelHeight} 
        H 0 
        Z
    `;

    // 绘制标签背景
    labelGroup.append("path")
        .attr("d", labelPath)
        .attr("fill", "transparent")
        .attr("stroke", "#333333")
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.5);

    // 添加文本
    labelGroup.append("text")
        .attr("x", labelWidth/2)
        .attr("y", labelHeight/2 + 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", "#333333")
        .text(labelText);
    
    return svg.node();
} 