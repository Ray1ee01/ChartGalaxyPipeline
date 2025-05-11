/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Line Graph",
    "chart_name": "multiple_line_graph_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[4, 30], ["-inf", "inf"], [2, 8]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 600,
    "background": "dark",
    "icon_mark": "side",
    "icon_label": "side",
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
    const gridExtension = 30; // 网格线向左延伸的距离
    g.selectAll("line.grid-line-y")
        .data(yTicks)
        .enter()
        .append("line")
        .attr("class", "grid-line-y")
        .attr("x1", -gridExtension) // 向左延伸
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", "#ffffff")
        .attr("class", "background")
        .attr("stroke-width", d => d === 0 ? 2 : 1) // 0刻度线加粗
        .attr("opacity", d => d === 0 ? 1 : 0.3); // 0刻度线不透明


    // 绘制垂直网格线 - 确保不超过最大Y刻度，并与X轴刻度对应
    g.selectAll("line.grid-line-x")
        .data(xTicks) // 使用与X轴相同的刻度
        .enter()
        .append("line")
        .attr("class", "grid-line-x")
        .attr("x1", d => xScale(d))
        .attr("y1", maxYPos) // 从最大Y刻度开始
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight)
        .attr("stroke", "#ffffff")
        .attr("class", "background")
        .attr("stroke-width", 1)
        .attr("opacity", 0.3); // 降低透明度
    
    // 添加渐变效果
    const defs = svg.append("defs");
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
    
    // 创建线条生成器
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]));
    
    // 创建面积生成器（用于渐变填充）
    const area = d3.area()
        .x(d => xScale(parseDate(d[xField])))
        .y0(innerHeight)
        .y1(d => yScale(d[yField]));
    
    // 在绘制线条之前添加这段代码
    console.log("Available groups:", groups);
    groups.forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        console.log(`Group ${group} has ${groupData.length} data points`);
    });
    
    // 添加垂直参考线（最后一个年份）
    const lastYear = xValues[xValues.length - 1];
    const lastYearDate = parseDate(lastYear);

    // 添加垂直虚线
    g.append("line")
        .attr("x1", xScale(lastYearDate))
        .attr("y1", 0)
        .attr("x2", xScale(lastYearDate))
        .attr("y2", innerHeight)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,2");

    // 添加年份标签（纯白色，无边框）
    const yearLabelGroup = g.append("g")
        .attr("transform", `translate(${xScale(lastYearDate)}, 0)`);

    // 标签背景 - 纯白色无边框
    yearLabelGroup.append("rect")
        .attr("x", -20)
        .attr("y", -25)
        .attr("width", 40)
        .attr("height", 20)
        .attr("fill", "#ffffff")
        .attr("rx", 3)
        .attr("ry", 3);

    // 修正年份标签的三角形方向
    yearLabelGroup.append("path")
        .attr("d", "M0,0 L5,-5 L-5,-5 Z") // 创建一个向上的小三角形
        .attr("transform", "translate(0,0)") // 位置在标签下方
        .attr("fill", "#ffffff");

    // 标签文本
    yearLabelGroup.append("text")
        .attr("x", 0)
        .attr("y", -14)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", typography.label.font_family)
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("fill", "#333333")
        .text(xFormat(lastYearDate));

    // 在最后的竖线上为每个组添加彩色小圆点，并创建指向它们的标签
    let labelPositions = [];
    groups.forEach((group, i) => {
        const groupData = chartData.filter(d => d[groupField] === group);
        const lastPoint = groupData[groupData.length - 1];
        const circleY = yScale(lastPoint[yField]); // 圆点的实际Y坐标
        let labelY = circleY; // 标签的Y坐标，初始与圆点相同
        
        // 检查是否与现有标签重叠
        labelPositions.forEach(pos => {
            if (Math.abs(labelY - pos) < 45) {
                // 如果重叠，向下移动
                labelY = pos + 45;
            }
        });
        
        labelPositions.push(labelY);
        
        // 添加小圆点
        g.append("circle")
            .attr("cx", xScale(lastYearDate))
            .attr("cy", circleY)
            .attr("r", 5)
            .attr("fill", getColor(group));
        
        // 创建标签组
        const labelGroup = g.append("g")
            .attr("transform", `translate(${innerWidth + 20}, ${labelY})`);
        
        // 计算数值文本的宽度
        const valueText = `${Math.round(lastPoint[yField])}`;
        const textWidth = valueText.length * 10 + 20; // 估算文本宽度，每个字符约10px，两边各留10px空白
        
        // 标签背景 - 宽度自适应
        labelGroup.append("rect")
            .attr("x", 0)
            .attr("y", -15)
            .attr("width", textWidth) // 自适应宽度
            .attr("height", 30)
            .attr("fill", getColor(group))
            .attr("rx", 5)
            .attr("ry", 5);
        
        // 计算三角形的位置
        // 计算圆点相对于标签的位置
        const relativeCircleY = circleY - labelY; // 圆点相对于标签中心的Y偏移
        
        // 确定三角形应该贴在标签的哪个位置
        let triangleY = 0; // 默认在中间
        const triangleHeight = 12; // 三角形高度，标签高度(30)的40%
        
        if (relativeCircleY < -15) {
            // 圆点在标签上边界上方
            triangleY = -7; // 放在标签上部
        } else if (relativeCircleY > 15) {
            // 圆点在标签下边界下方
            triangleY = 7; // 放在标签下部
        }
        // 否则放在中间
        
        // 创建一个自定义的三角形路径
        // 三角形右边是垂直的，贴在标签上，左边的尖尖指向圆点
        const trianglePath = `
            M -12,${relativeCircleY} 
            L 0,${triangleY - triangleHeight/2} 
            L 0,${triangleY + triangleHeight/2} 
            Z
        `;
        
        // 添加指向小圆点的三角形
        labelGroup.append("path")
            .attr("d", trianglePath)
            .attr("fill", getColor(group));
        
        // 标签文本 - 只显示数值
        labelGroup.append("text")
            .attr("x", textWidth / 2) // 水平居中
            .attr("y", 2) // 修改为0以实现垂直居中
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", "20px")
            .style("font-weight", "bold")
            .style("fill", "#ffffff")
            .text(valueText);
        
        // 添加图片
        if (images.field && images.field[group]) {
            // 获取图片的base64数据
            const imgData = images.field[group];
            
            // 添加图片
            labelGroup.append("image")
                .attr("x", textWidth + 10) // 位于标签右侧，留出10px间距
                .attr("y", -25) // 垂直居中
                .attr("width", 80) // 图片宽度
                .attr("height", 50) // 图片高度
                .attr("xlink:href", imgData);
        }

        // 添加标签文本
        labelGroup.append("text")
            .attr("x", textWidth + 100) // 位于图片右侧,留出10px间距
            .attr("y", 2) // 垂直居中
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", "20px")
            .style("font-weight", "bold")
            .style("fill", "#ffffff")
            .text(group);
    });
    
    // 为每个组绘制线条和面积
    groups.forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        
        // 绘制面积（渐变填充）
        g.append("path")
            .datum(groupData)
            .attr("class", "area")
            .attr("fill", `url(#line-gradient-${group.replace(/\s+/g, '-').toLowerCase()})`)
            .attr("d", area);
        
        // 绘制线条
        g.append("path")
            .datum(groupData)
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", getColor(group))
            .attr("stroke-width", 3)
            .attr("d", line);
    });
    
    // 绘制X轴
    const xAxis = g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .tickFormat(xFormat) // 使用相同的刻度数量
            .ticks(xTicks.length) // 使用ticks的长度作为刻度数量
        );
    
    // 设置X轴样式 - 纯白色
    xAxis.selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", "bold")
        .style("fill", "#ffffff"); // 纯白色
    
    // 移除X轴线和刻度
    xAxis.select(".domain").remove();
    xAxis.selectAll(".tick line").remove();
    
    // 绘制Y轴 - 移除B后缀，并调整刻度位置
    const yAxis = g.append("g")
        .call(d3.axisLeft(yScale)
            .ticks(5)
            .tickSize(0) // 移除刻度线
        );

    // 移除Y轴线
    yAxis.select(".domain").remove();
    yAxis.selectAll(".tick line").remove();

    // 手动添加Y轴刻度文本，放在延伸的网格线上方
    yAxis.selectAll(".tick text")
        .attr("x", -gridExtension) // 放在延伸的网格线上方，留出一点间距
        .attr("dy", "-0.5em") // 向上移动一点
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", "bold")
        .style("fill", "#ffffff") // 白色
        .style("opacity", 0.8) // 稍微透明
        .style("text-anchor", "start") // 左对齐
        .text(function(d, i) {
            // 获取原始文本
            const originalText = d3.select(this).text();
            
            // 如果是最大刻度，添加字段名
            if (i === yTicks.length - 1) {
                // 获取Y轴字段名
                const yFieldName = dataColumns.find(col => col.role === "y").name;
                return `${originalText} ${yFieldName}`;
            }
            
            return originalText;
        });

    // 为最大刻度的字段名部分添加加粗样式
    yAxis.selectAll(".tick:last-child text")
        .each(function() {
            const text = d3.select(this);
            const textContent = text.text();
            const parts = textContent.split(' ');
            
            if (parts.length > 1) {
                // 清除原始文本
                text.text('');
                
                // 添加数值部分
                text.append("tspan")
                    .text(parts[0])
                    .style("font-weight", "bold");
                
                // 添加空格
                text.append("tspan")
                    .text(' ');
                
                // 添加字段名部分（加粗）
                text.append("tspan")
                    .text(parts.slice(1).join(' '))
                    .style("font-weight", "bolder")
                    .style("opacity", 0.8);
            }
        });
    
    return svg.node();
} 