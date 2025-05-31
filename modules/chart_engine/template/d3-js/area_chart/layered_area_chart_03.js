/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Layered Area Chart",
    "chart_name": "layered_area_chart_03",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 50], [0, "inf"], [2, 6]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
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
    let chartData = jsonData.data.data;
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

    chartData = temporalFilter(chartData, xField);
    if (chartData.length === 0) {
        console.log("chartData is empty");
        return;
    }
    
    // 获取唯一的组值并按最后y值排序
    const groups = [...new Set(chartData.map(d => d[groupField]))]
        .sort((a, b) => {
            const aLast = chartData.filter(d => d[groupField] === a).slice(-1)[0][yField];
            const bLast = chartData.filter(d => d[groupField] === b).slice(-1)[0][yField];
            return aLast - bLast;
        });
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 20, right: 60, bottom: 40, left: 60 };
    
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
    
    // 创建y轴比例尺 (百分比)
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d[yField]) * 1.5])
        .range([chartHeight, 0]);

    // 添加X轴线
    g.append("line")
        .attr("x1", -40)
        .attr("y1", chartHeight)
        .attr("x2", chartWidth)
        .attr("y2", chartHeight)
        .attr("stroke", "#9badd3")
        .attr("opacity", 0.6)
        .attr("stroke-width", 1)
    
    // 添加水平网格线
    const yTicks = d3.ticks(0, d3.max(chartData, d => d[yField]) * 1.3, 5); // 根据实际数据生成刻度
    
    // 添加y轴刻度和标签
    yTicks.forEach(tick => {
        if (tick !== 0) { // 跳过0刻度
            g.append("text")
                .attr("x", -10)
                .attr("y", yScale(tick) + 15)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .style("font-family", "Arial")
                .style("font-size", "16px")
                .style("fill", "#87aac0")
                .text(tick);
        }
    });
    
    // 添加x轴刻度和标签
    xTicks.forEach((tick, i) => {
        if (i === xTicks.length - 1) {
            return;
        }
        // 添加刻度标签
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", chartHeight + 20)
            .attr("text-anchor", "middle")
            .style("font-family", "Arial")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .style("fill", "#87aac0")
            .text(xFormat(tick));
    });
    
    // 创建面积生成器
    const area = d3.area()
        .x(d => xScale(parseDate(d[xField])))
        .y0(chartHeight)
        .y1(d => yScale(d[yField]))
        .curve(d3.curveLinear);
    
    // 创建渐变定义
    const defs = svg.append("defs");

    // 为每个组创建渐变
    groups.forEach(group => {
        const color = colors.field[group];
        const gradientId = `gradient-${group.replace(/\s+/g, '-')}`;
        
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");
        
        // 渐变起始颜色（原始颜色）
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.color(color))
            .attr("stop-opacity", 1);
        
        // 渐变结束颜色（偏白色）
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.color(color).brighter(1.0)) // 使颜色更亮（偏白）
            .attr("stop-opacity", 1);
    });

    // 创建阴影滤镜 - 修复截断问题
    const filters = defs.append("filter")
        .attr("id", "drop-shadow")
        .attr("x", "-50%")    // 扩展滤镜区域左侧
        .attr("y", "-100%")    // 扩展滤镜区域上方
        .attr("width", "200%") // 扩展滤镜区域宽度
        .attr("height", "200%"); // 扩展滤镜区域高度

    // 调整阴影颜色和透明度
    filters.append("feComponentTransfer")
        .append("feFuncA")
        .attr("type", "linear")
        .attr("slope", 0.2); // 降低阴影不透明度，使其更加柔和

    // 添加高斯模糊
    filters.append("feGaussianBlur")
        .attr("in", "SourceAlpha")
        .attr("stdDeviation", 25) // 调整模糊程度，使阴影更加柔和
        .attr("result", "blur");

    // 添加偏移
    filters.append("feOffset")
        .attr("in", "blur")
        .attr("dx", 0)
        .attr("dy", 15)
        .attr("result", "offsetBlur");

    // 合并原始图形和阴影
    const feMerge = filters.append("feMerge");
    feMerge.append("feMergeNode")
        .attr("in", "offsetBlur");
    feMerge.append("feMergeNode")
        .attr("in", "SourceGraphic");

    // 绘制面积图
    // 按照组的顺序反向绘制，确保第一个组在最上面
    [...groups].reverse().forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        const gradientId = `gradient-${group.replace(/\s+/g, '-')}`;
        
        // 绘制面积
        g.append("path")
            .datum(groupData)
            .attr("fill", `url(#${gradientId})`) // 使用渐变填充
            .attr("opacity", 0.8)
            .attr("d", area)
            .style("filter", "url(#drop-shadow)"); // 添加阴影效果
    });

    // 添加网格背景
    g.append("rect")
        .attr("class", "background")
        .attr("x", 0)
        .attr("y", yScale(d3.max(yTicks)))
        .attr("width", chartWidth)
        .attr("height", chartHeight - yScale(d3.max(yTicks)))
        .attr("fill", "#87aac0")
        .attr("opacity", 0.1);

    // 添加垂直网格线
    xTicks.forEach(tick => {
        g.append("line")
            .attr("x1", xScale(tick))
            .attr("y1", yScale(d3.max(yTicks))) // 从y轴最大刻度开始
            .attr("x2", xScale(tick))
            .attr("y2", chartHeight)
            .attr("stroke", "#87aac0")
            .attr("opacity", 0.2)
            .attr("class", "background")
            .attr("stroke-width", 1)
    });
    // 添加水平网格线
    yTicks.forEach(tick => {
        g.append("line")
            .attr("x1", -40)
            .attr("y1", yScale(tick))
            .attr("x2", chartWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", "#87aac0")
            .attr("opacity", 0.2)
            .attr("stroke-width", 1)
            .attr("class", "background")
    });

    // 获取最后一个刻度的x值
    const lastTickX = xScale(xTicks[xTicks.length - 1]);
    
    // 添加最后一年标注
    g.append("text")
        .attr("x", lastTickX)
        .attr("y", yScale(d3.max(yTicks)) - 10) // 调整文本位置到y轴最大刻度上方
        .attr("text-anchor", "middle")
        .style("font-family", "Arial")
        .style("font-size", "14px")
        .style("fill", "#87aac0")
        .text(xFormat(xTicks[xTicks.length - 1]));

    // 添加倒置的蓝色小三角
    g.append("path")
        .attr("d", "M" + (lastTickX-5) + "," + yScale(d3.max(yTicks)) + " L" + (lastTickX+5) + "," + yScale(d3.max(yTicks)) + " L" + lastTickX + "," + (yScale(d3.max(yTicks))+5) + "Z")
        .attr("fill", "#87aac0");
    
    // 添加垂直虚线指向最后一年
    g.append("line")
        .attr("x1", lastTickX)
        .attr("y1", yScale(d3.max(yTicks))+5)
        .attr("x2", lastTickX)
        .attr("y2", chartHeight)
        .attr("stroke", "#87aac0")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");
    
    // 添加最终值标签
    let prevLabelYBase = null; // 跟踪上一个标签的Y位置
    const minLabelDistance = 50; // 最小标签间距

    [...groups].forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        const lastPoint = groupData[groupData.length - 1];
        const color = colors.field[group];

        // 计算标签基础位置
        let labelYBase = yScale(lastPoint[yField]);
        let labelXBase = xScale(parseDate(lastPoint[xField]));
        
        // 检查与上一个标签的距离，如果太近则调整位置
        if (prevLabelYBase !== null && Math.abs(prevLabelYBase - labelYBase) < minLabelDistance) {
            labelYBase = labelYBase - minLabelDistance;
        }
        
        // 更新上一个标签位置
        prevLabelYBase = labelYBase;
        let textWidth = getTextWidth(group, 10) * 1.3;
        // 创建标签背景
        const labelBg = g.append("rect")
            .attr("x", labelXBase - textWidth / 2)
            .attr("y", labelYBase - 50)
            .attr("rx", 10)
            .attr("ry", 10)
            .attr("width", textWidth)
            .attr("height", 40)
            .attr("fill", color);
        
        // 添加倒三角
        g.append("path")
            .attr("d", `M${labelXBase}, ${labelYBase} 
                       L${labelXBase - 10}, ${labelYBase - 15} 
                       L${labelXBase + 10}, ${labelYBase - 15} Z`)
            .attr("fill", color);
        
        // 添加组名（上部分文本）
        g.append("text")
            .attr("x", labelXBase)
            .attr("y", labelYBase - 40)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Arial")
            .style("font-size", "10px")
            .style("fill", "#ffffff")
            .style("opacity", 0.5)
            .text(group);
        
        // 添加最终值（下部分文本）
        g.append("text")
            .attr("x", labelXBase)
            .attr("y", labelYBase - 22)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Arial")
            .style("font-size", "22px")
            .style("font-weight", "bold")
            .style("fill", "#ffffff")
            .text(Math.round(lastPoint[yField]));
        
    });
    
    return svg.node();
} 