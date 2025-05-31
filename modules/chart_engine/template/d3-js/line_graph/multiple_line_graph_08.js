/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Line Graph",
    "chart_name": "multiple_line_graph_08",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 30], [0, "inf"], [2, 7]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
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
    
    // 设置尺寸和边距 - 移除左侧边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 60, bottom: 60, left: 0 }; // 左侧边距设为0
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 获取唯一的组值
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表区域
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, innerWidth);
    
    // const yMin = Math.min(0, d3.min(chartData, d => d[yField]) * 1.1);
    // const yMax = d3.max(chartData, d => d[yField]) * 1.1;
    const yMin = d3.min(chartData, d => d[yField]);
    const yMax = d3.max(chartData, d => d[yField]);
    const yRange = yMax - yMin;
    const yMinScale = yMin - yRange * 0.2;
    const yMaxScale = yMax + yRange * 0.2;
    const yScale = d3.scaleLinear()
        .domain([yMinScale, yMaxScale])
        .range([innerHeight, 0]);
    
    // 使用数据JSON中的颜色
    // 获取颜色
    const getColor = (group) => {
        return colors.field && colors.field[group] ? colors.field[group] : colors.other.primary;
    };
    
    // 创建线条生成器 - 改为折线
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveLinear); // 使用折线而不是曲线
    
    // 按组分组数据
    const groupedData = groups.map(group => {
        return {
            group: group,
            values: chartData.filter(d => d[groupField] === group),
            color: getColor(group) // 获取该组的颜色
        };
    });
    
    // 绘制线条
    groupedData.forEach(gd => {
        // 添加阴影效果
        // 首先创建一个滤镜
        const filterId = `shadow-${gd.group.replace(/\s+/g, '-')}`;
        const filter = svg.append("defs")
            .append("filter")
            .attr("id", filterId)
            .attr("x", "-20%")
            .attr("y", "-20%")
            .attr("width", "140%")
            .attr("height", "140%");
        
        // 添加高斯模糊
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 1)
            .attr("result", "blur");
        
        // 添加偏移
        filter.append("feOffset")
            .attr("in", "blur")
            .attr("dx", 0)
            .attr("dy", 1)
            .attr("result", "offsetBlur");
        
        // 添加颜色 - 改为黑色
        filter.append("feFlood")
            .attr("flood-color", "black") // 使用黑色而不是线条颜色
            .attr("flood-opacity", 0.3)
            .attr("result", "coloredBlur");
        
        // 将颜色应用到偏移的模糊上
        filter.append("feComposite")
            .attr("in", "coloredBlur")
            .attr("in2", "offsetBlur")
            .attr("operator", "in")
            .attr("result", "coloredBlurOffset");
        
        // 合并原始图形和阴影
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode")
            .attr("in", "coloredBlurOffset");
        feMerge.append("feMergeNode")
            .attr("in", "SourceGraphic");
        
        // 绘制线条 - 添加阴影
        g.append("path")
            .datum(gd.values)
            .attr("fill", "none")
            .attr("stroke", gd.color)
            .attr("stroke-width", 3)
            .attr("d", line)
            .attr("filter", `url(#${filterId})`);
        
        // 获取最后一个数据点
        const lastPoint = gd.values[gd.values.length - 1];
        const x = xScale(parseDate(lastPoint[xField]));
        const y = yScale(lastPoint[yField]);

        const valueText = lastPoint[yField].toFixed(1);
        const valueTextWidth = getTextWidth(valueText, "12px");
        
        // 添加圆角矩形作为结束标记
        const rectWidth = valueTextWidth + 10;
        const rectHeight = 12;
        const rectX = x - 6;
        const rectY = y - rectHeight / 2;
        
        // 添加圆角矩形背景
        g.append("rect")
            .attr("x", rectX)
            .attr("y", rectY)
            .attr("width", rectWidth)
            .attr("height", rectHeight)
            .attr("rx", 6)
            .attr("ry", 6)
            .attr("fill", gd.color); // 使用获取的颜色
        
        // 添加数值文本（在矩形内）
        g.append("text")
            .attr("x", rectX + rectWidth / 2)
            .attr("y", rectY + rectHeight / 2 + 1)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Arial")
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .style("fill", "white")
            .text(lastPoint[yField].toFixed(1));

        // 添加国家名称
        g.append("text")
            .attr("x", rectX + rectWidth + 10)
            .attr("y", rectY + rectHeight / 2)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Arial")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .style("fill", gd.color)
            .text(gd.group);
    });
    
    // 找到结束时最高的数据点
    let highestEndGroup = null;
    let highestEndValue = -Infinity;
    let highestEndX = 0;
    let highestEndY = 0;
    let highestEndRect = null;
    
    groupedData.forEach(gd => {
        const lastPoint = gd.values[gd.values.length - 1];
        const value = lastPoint[yField];
        
        if (value > highestEndValue) {
            highestEndValue = value;
            highestEndGroup = gd.group;
            highestEndX = xScale(parseDate(lastPoint[xField]));
            highestEndY = yScale(value);
            
            // 保存矩形位置信息，用于后续添加标签
            highestEndRect = {
                x: highestEndX - 6,
                y: highestEndY - 6,
                width: 40,
                height: 12
            };
        }
    });
    
    // 如果找到了最高点，添加Y轴encoding名称和指向三角形
    if (highestEndRect) {
        // 获取Y轴字段的显示名称
        const yFieldName = dataColumns.find(col => col.name === yField)?.display_name || yField;
        
        // 判断最高点的趋势
        const highestGroup = groupedData.find(gd => gd.group === highestEndGroup);
        const lastIndex = highestGroup.values.length - 1;
        const lastValue = highestGroup.values[lastIndex][yField];
        const prevValue = highestGroup.values[lastIndex - 1][yField];
        const isIncreasing = lastValue > prevValue;
        
        // 根据趋势决定标签位置
        const labelBaseY = highestEndRect.y - 20
        
        // Y轴encoding名称的位置
        const encodingLabelY = labelBaseY;
        
        // 添加Y轴encoding名称
        g.append("text")
            .attr("x", highestEndRect.x + highestEndRect.width / 2)
            .attr("y", encodingLabelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Arial")
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .style("fill", "white")
            .text(dataColumns[1].label || yField);
        
        // 添加指向三角形
        const triangleSize = 6;
        const triangleX = highestEndRect.x + highestEndRect.width / 2;
        const triangleY = encodingLabelY + 15;
        
        g.append("path")
            .attr("d", `M${triangleX},${triangleY} L${triangleX + triangleSize},${triangleY - triangleSize} L${triangleX - triangleSize},${triangleY - triangleSize} Z`)
            .attr("fill", "white");
    }
    
    // 添加X轴 - 放在中间位置
    const xAxisY = innerHeight / 2; // 将X轴放在中间
    
    // 添加X轴线 - 使用点点虚线，延伸到整个SVG两侧
    g.append("line")
        .attr("x1", -margin.left) // 延伸到左侧边缘
        .attr("y1", xAxisY)
        .attr("x2", innerWidth + margin.right) // 延伸到右侧边缘
        .attr("y2", xAxisY)
        .attr("stroke", "#666")
        .attr("stroke-width", 1)
        .attr("opacity", 0.5)
        .attr("stroke-dasharray", "1,1");
    
    // 添加刻度和标签
    xTicks.forEach(tick => {
        const x = xScale(tick);
        
        // 添加圆角矩形背景
        g.append("rect")
            .attr("x", x - 15)
            .attr("y", xAxisY - 6)
            .attr("width", 30)
            .attr("height", 12)
            .attr("rx", 6)
            .attr("ry", 6)
            .attr("fill", "#fde7e5");
        
        // 添加年份文本
        g.append("text")
            .attr("x", x)
            .attr("y", xAxisY + 4)
            .attr("text-anchor", "middle")
            .style("font-family", "Arial")
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .style("fill", "#333")
            .text(xFormat(tick));
    });
    
    // 添加水平网格线 - 实线，延伸到整个SVG两侧
    g.selectAll("grid-line")
        .data(yScale.ticks(5))
        .enter()
        .append("line")
        .attr("x1", -margin.left) // 延伸到左侧边缘
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth + margin.right) // 延伸到右侧边缘
        .attr("y2", d => yScale(d))
        .attr("stroke", "rgba(255, 255, 255, 0.2)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "none")
        .attr("class", "background"); // 使用实线
    
    // 添加Y轴刻度值 - 调整位置
    g.selectAll(".y-tick")
        .data(yScale.ticks(5))
        .enter()
        .append("text")
        .attr("x", 10) // 正值，使文本位于图表内部
        .attr("y", d => yScale(d) + 15)
        .attr("text-anchor", "start") // 改为左对齐
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .style("fill", "white")
        .text(d => d);
    
    return svg.node();
} 