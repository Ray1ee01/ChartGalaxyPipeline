/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Range Area Chart",
    "chart_name": "range_area_chart_icons_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 50], [0, "inf"], [2, 2]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 600,
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
    const margin = { top: 60, right: 60, bottom: 60, left: 80 };
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建网格线
    const gridSize = 20;
    for (let x = 0; x < width; x += gridSize) {
        svg.append("line")
            .attr("x1", x)
            .attr("y1", 0)
            .attr("x2", x)
            .attr("y2", height)
            .attr("stroke", "#555")
            .attr("opacity", 0.1)
            .attr("class", "background")
            .attr("stroke-width", 1);
    }
    
    for (let y = 0; y < height; y += gridSize) {
        svg.append("line")
            .attr("x1", 0)
            .attr("y1", y)
            .attr("x2", width)
            .attr("y2", y)
            .attr("stroke", "#555")
            .attr("opacity", 0.1)
            .attr("class", "background")
            .attr("stroke-width", 1);
    }
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 分离两个组的数据
    const groupNames = [...new Set(chartData.map(d => d[groupField]))];
    
    // 计算每个组的平均值
    const groupAverages = groupNames.map(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        const avg = d3.mean(groupData, d => d[yField]);
        return { group, avg };
    });
    
    // 按平均值排序
    groupAverages.sort((a, b) => b.avg - a.avg);
    
    // 选择平均值最高和最低的组
    const highestGroup = groupAverages[0].group;
    const lowestGroup = groupAverages[groupAverages.length - 1].group;
    
    // 获取这两个组的数据
    const group1Data = chartData.filter(d => d[groupField] === highestGroup);
    const group2Data = chartData.filter(d => d[groupField] === lowestGroup);
    
    // 更新组名数组，使其只包含选中的两个组
    const selectedGroupNames = [highestGroup, lowestGroup];
    
    // 确保两组数据按年份排序
    group1Data.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
    group2Data.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));

    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, chartWidth);
    
    // 创建y轴比例尺
    const yMin = Math.max(0, d3.min(chartData, d => d[yField]));
    const yMax = d3.max(chartData, d => d[yField]);

    const yPadding = 0.3 * (yMax - yMin);
    
    const yScale = d3.scaleLinear()
        .domain([yMin - yPadding, yMax + yPadding])
        .range([chartHeight, 0]);
    
    // 添加水平网格线
    const yTicks = d3.ticks(yMin - yPadding, yMax + yPadding, 5);
    
    // 添加水平网格线
    yTicks.forEach(tick => {
        if (tick > 0) { // 跳过0刻度线
            g.append("line")
                .attr("x1", 0)
                .attr("y1", yScale(tick))
                .attr("x2", chartWidth)
                .attr("y2", yScale(tick))
                .attr("stroke", "#cccccc")
                .attr("class", "background")
                .attr("stroke-width", 1)
            
            
        }
        // 添加y轴刻度标签
        g.append("text")
        .attr("x", -10)
        .attr("y", yScale(tick))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "10px")
        .style("fill", "#222222")
        .text(d3.format(",.0f")(tick));
    });
    
    // 添加x轴刻度和标签
    xTicks.forEach(tick => {
        
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", chartHeight + 15)
            .attr("text-anchor", "start")
            .style("font-family", "Arial")
            .style("font-size", "10px")
            .style("fill", "#222222")
            .text(xFormat(tick));
    });

    // 添加X轴线
    g.append("line")
        .attr("x1", 0)
        .attr("y1", chartHeight)
        .attr("x2", chartWidth)
        .attr("y2", chartHeight)
        .attr("stroke", "#666666")
        .attr("stroke-width", 1);
    
    // 添加Y轴线
    g.append("line")
        .attr("x1", 0)
        .attr("y1", yScale(d3.max(yTicks)))
        .attr("x2", 0)
        .attr("y2", chartHeight)
        .attr("stroke", "#222222")
        .attr("stroke-width", 1);
    
    // 添加y轴标题
    g.append("text")
        .attr("x", -25)
        .attr("y", yScale(d3.max(yTicks)) - 25)
        .attr("text-anchor", "start")
        .style("font-family", "Arial")
        .style("font-size", "14px")
        .style("fill", "#222222")
        .html(`<tspan style="font-weight: bold">${dataColumns[1].description}</tspan> <tspan>${d3.min(chartData, d => parseDate(d[xField]).getFullYear())}-${d3.max(chartData, d => parseDate(d[xField]).getFullYear())}</tspan>`);

    g.append("text")
        .attr("x", -25)
        .attr("y", yScale(d3.max(yTicks)) - 12)
        .attr("text-anchor", "start")
        .style("font-family", "Arial")
        .style("font-size", "10px")
        .style("fill", "#222222")
        .text(dataColumns[1].name);
    
    // 创建线条生成器
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]));
    
    // 创建面积生成器
    const area = d3.area()
        .x(d => xScale(parseDate(d[xField])))
        .y0(d => yScale(d.group2Value))
        .y1(d => yScale(d.group1Value));
    
    // 创建合并的数据集用于面积图
    const areaData = [];
    for (let i = 0; i < group1Data.length; i++) {
        const year = group1Data[i][xField];
        const group1Value = group1Data[i][yField];
        const group2Item = group2Data.find(d => d[xField] === year);
        
        if (group2Item) {
            const group2Value = group2Item[yField];
            areaData.push({
                [xField]: year,
                group1Value: group1Value,
                group2Value: group2Value
            });
        }
    }
    
    // 创建滤镜用于描边效果
    const defs = svg.append("defs");
    
    // 为第一组创建描边滤镜
    const filterId = "outline";
    const filter = defs.append("filter")
        .attr("id", filterId)
        .attr("x", "-20%")
        .attr("y", "-20%")
        .attr("width", "140%")
        .attr("height", "140%");
    
    filter.append("feMorphology")
        .attr("operator", "dilate")
        .attr("radius", "2")
        .attr("in", "SourceAlpha")
        .attr("result", "thicken");
    
    filter.append("feFlood")
        .attr("flood-color", "#000000")
        .attr("result", "black");
    
    filter.append("feComposite")
        .attr("in", "black")
        .attr("in2", "thicken")
        .attr("operator", "in")
        .attr("result", "outline");
    
    filter.append("feComposite")
        .attr("in", "SourceGraphic")
        .attr("in2", "outline")
        .attr("operator", "over");
    
    // 绘制面积
    g.append("path")
        .datum(areaData)
        .attr("fill", colors.available_colors?.[0] || "#ebbc48")
        .attr("d", area);
    
    // 绘制线条1 - 先添加描边
    g.append("path")
        .datum(group1Data)
        .attr("fill", "none")
        .attr("stroke", "#000")
        .attr("stroke-width", 9)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("d", line);
    
    // 绘制线条1 - 主线
    g.append("path")
        .datum(group1Data)
        .attr("fill", "none")
        .attr("stroke", colors.field[selectedGroupNames[0]])
        .attr("stroke-width", 5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("d", line);
    
    // 绘制线条2 - 先添加描边
    g.append("path")
        .datum(group2Data)
        .attr("fill", "none")
        .attr("stroke", "#000")
        .attr("stroke-width", 9)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("d", line);
    
    // 绘制线条2 - 主线
    g.append("path")
        .datum(group2Data)
        .attr("fill", "none")
        .attr("stroke", colors.field[selectedGroupNames[1]])
        .attr("stroke-width", 5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("d", line);
    
    const imageSize = 36;
    
    // 添加起始点和终点图标及标注
    // 线条1的起始点
    const firstPoint1 = group1Data[0];
    const lastPoint1 = group1Data[group1Data.length - 1];
    
    // 线条1起始点图标
    const startImgGroup1 = g.append("g")
        .attr("transform", `translate(${xScale(parseDate(firstPoint1[xField])) - imageSize / 2}, ${yScale(firstPoint1[yField]) - imageSize / 2})`);
    
    // 添加图片
    if (images.field && images.field[selectedGroupNames[0]]) {
        startImgGroup1.append("image")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", imageSize)
            .attr("height", imageSize)
            .attr("filter", `url(#${filterId})`)
            .attr("xlink:href", images.field[selectedGroupNames[0]]);
    } 
    
    // 添加起始值标注
    g.append("text")
        .attr("x", xScale(parseDate(firstPoint1[xField])) - 20)
        .attr("y", yScale(firstPoint1[yField]))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("fill", colors.field[selectedGroupNames[0]])
        .text(d3.format(",.0f")(firstPoint1[yField]));
    
    // 线条1终点图标
    const endImgGroup1 = g.append("g")
        .attr("transform", `translate(${xScale(parseDate(lastPoint1[xField])) - imageSize / 2}, ${yScale(lastPoint1[yField]) - imageSize / 2})`);

    // 添加图片
    if (images.field && images.field[selectedGroupNames[0]]) {
        endImgGroup1.append("image")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", imageSize)
            .attr("height", imageSize)
            .attr("filter", `url(#${filterId})`)
            .attr("xlink:href", images.field[selectedGroupNames[0]]);
    }
    
    // 添加终点值和组名标注（上方）- 调整位置
    g.append("text")
        .attr("x", xScale(parseDate(lastPoint1[xField]))) // 增加距离
        .attr("y", yScale(lastPoint1[yField]) - 40)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#222222")
        .text(selectedGroupNames[0]);
    
    g.append("text")
        .attr("x", xScale(parseDate(lastPoint1[xField]))) // 增加距离
        .attr("y", yScale(lastPoint1[yField]) - 25)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("fill", colors.field[selectedGroupNames[0]])
        .text(d3.format(",.0f")(lastPoint1[yField]));
    
    // 线条2的起始点和终点
    const firstPoint2 = group2Data[0];
    const lastPoint2 = group2Data[group2Data.length - 1];
    
    // 线条2起始点图标
    const startImgGroup2 = g.append("g")
        .attr("transform", `translate(${xScale(parseDate(firstPoint2[xField])) - imageSize / 2}, ${yScale(firstPoint2[yField]) - imageSize / 2})`);
    
    // 添加图片
    if (images.field && images.field[selectedGroupNames[1]]) {
        startImgGroup2.append("image")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", imageSize)
            .attr("height", imageSize)
            .attr("filter", `url(#${filterId})`)
            .attr("xlink:href", images.field[selectedGroupNames[1]]);
    }
    
    // 添加起始值标注
    g.append("text")
        .attr("x", xScale(parseDate(firstPoint2[xField])) - 20)
        .attr("y", yScale(firstPoint2[yField]))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("fill", colors.field[selectedGroupNames[1]])
        .text(d3.format(",.0f")(firstPoint2[yField]));
    
    // 线条2终点图标
    const endImgGroup2 = g.append("g")
        .attr("transform", `translate(${xScale(parseDate(lastPoint2[xField])) - imageSize / 2}, ${yScale(lastPoint2[yField]) - imageSize / 2})`);
    
    // 添加图片
    if (images.field && images.field[selectedGroupNames[1]]) {
        endImgGroup2.append("image")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", imageSize)
            .attr("height", imageSize)
            .attr("filter", `url(#${filterId})`)
            .attr("xlink:href", images.field[selectedGroupNames[1]]);
    }
    
    // 添加终点值和组名标注（下方）- 调整位置
    g.append("text")
        .attr("x", xScale(parseDate(lastPoint2[xField]))) // 增加距离
        .attr("y", yScale(lastPoint2[yField]) + 40)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#222222")
        .text(selectedGroupNames[1]);
    
    g.append("text")
        .attr("x", xScale(parseDate(lastPoint2[xField]))) // 增加距离
        .attr("y", yScale(lastPoint2[yField]) + 25)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("fill", colors.field[selectedGroupNames[1]])
        .text(d3.format(",.0f")(lastPoint2[yField]));
    
    // 创建滤镜用于文本描边效果
    const textStrokeFilter = defs.append("filter")
        .attr("id", "textStroke")
        .attr("x", "-20%")
        .attr("y", "-20%")
        .attr("width", "140%")
        .attr("height", "140%");
    
    textStrokeFilter.append("feMorphology")
        .attr("operator", "dilate")
        .attr("radius", "1")
        .attr("in", "SourceAlpha")
        .attr("result", "thicken");
    
    textStrokeFilter.append("feFlood")
        .attr("flood-color", "#e3bc58")
        .attr("result", "stroke");
    
    textStrokeFilter.append("feComposite")
        .attr("in", "stroke")
        .attr("in2", "thicken")
        .attr("operator", "in")
        .attr("result", "strokeOutline");
    
    textStrokeFilter.append("feComposite")
        .attr("in", "SourceGraphic")
        .attr("in2", "strokeOutline")
        .attr("operator", "over");

    // 添加起始点比率标签 - 带描边和箭头
    const startRatio = (firstPoint1[yField] / firstPoint2[yField]).toFixed(1);
    const startRatioY = (yScale(firstPoint1[yField]) + yScale(firstPoint2[yField])) / 2;
    
    // 添加上箭头 - 使用实心三角形尖端，调整与图标的距离
    g.append("line")
        .attr("x1", xScale(parseDate(firstPoint1[xField])))
        .attr("y1", startRatioY - 15)
        .attr("x2", xScale(parseDate(firstPoint1[xField])))
        .attr("y2", yScale(firstPoint1[yField]) + 20) // 减少距离
        .attr("stroke", '#030300')
        .attr("stroke-width", 1);
    
    // 添加上箭头的实心三角形尖端，调整位置
    g.append("polygon")
        .attr("points", `${xScale(parseDate(firstPoint1[xField]))},${yScale(firstPoint1[yField]) + 15} ${xScale(parseDate(firstPoint1[xField])) - 2.5},${yScale(firstPoint1[yField]) + 20} ${xScale(parseDate(firstPoint1[xField])) + 2.5},${yScale(firstPoint1[yField]) + 20}`)
        .attr("fill", '#030300');
    
    // 添加下箭头 - 使用实心三角形尖端，调整与图标的距离
    g.append("line")
        .attr("x1", xScale(parseDate(firstPoint1[xField])))
        .attr("y1", startRatioY + 15)
        .attr("x2", xScale(parseDate(firstPoint1[xField])))
        .attr("y2", yScale(firstPoint2[yField]) - 20) // 减少距离
        .attr("stroke", '#030300')
        .attr("stroke-width", 1);
    
    // 添加下箭头的实心三角形尖端，调整位置
    g.append("polygon")
        .attr("points", `${xScale(parseDate(firstPoint1[xField]))},${yScale(firstPoint2[yField]) - 15} ${xScale(parseDate(firstPoint1[xField])) - 2.5},${yScale(firstPoint2[yField]) - 20} ${xScale(parseDate(firstPoint1[xField])) + 2.5},${yScale(firstPoint2[yField]) - 20}`)
        .attr("fill", '#030300');
    
    g.append("text")
        .attr("x", xScale(parseDate(firstPoint1[xField])))
        .attr("y", startRatioY)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("filter", "url(#textStroke)")
        .style("font-family", "Arial")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("fill", "#333333")
        .text(startRatio);
    
    // 添加终点比率标签 - 带描边和箭头
    const ratio = (lastPoint1[yField] / lastPoint2[yField]).toFixed(1);
    const ratioY = (yScale(lastPoint1[yField]) + yScale(lastPoint2[yField])) / 2;
    
    // 添加上箭头 - 使用实心三角形尖端，调整与图标的距离
    g.append("line")
        .attr("x1", xScale(parseDate(lastPoint1[xField])))
        .attr("y1", ratioY - 15)
        .attr("x2", xScale(parseDate(lastPoint1[xField])))
        .attr("y2", yScale(lastPoint1[yField]) + 20) // 减少距离
        .attr("stroke", '#030300')
        .attr("stroke-width", 1);
    
    // 添加上箭头的实心三角形尖端，调整位置
    g.append("polygon")
        .attr("points", `${xScale(parseDate(lastPoint1[xField]))},${yScale(lastPoint1[yField]) + 15} ${xScale(parseDate(lastPoint1[xField])) - 2.5},${yScale(lastPoint1[yField]) + 20} ${xScale(parseDate(lastPoint1[xField])) + 2.5},${yScale(lastPoint1[yField]) + 20}`)
        .attr("fill", '#030300');
    
    // 添加下箭头 - 使用实心三角形尖端，调整与图标的距离
    g.append("line")
        .attr("x1", xScale(parseDate(lastPoint1[xField])))
        .attr("y1", ratioY + 15)
        .attr("x2", xScale(parseDate(lastPoint1[xField])))
        .attr("y2", yScale(lastPoint2[yField]) - 20) // 减少距离
        .attr("stroke", '#030300')
        .attr("stroke-width", 1);
    
    // 添加下箭头的实心三角形尖端，调整位置
    g.append("polygon")
        .attr("points", `${xScale(parseDate(lastPoint1[xField]))},${yScale(lastPoint2[yField]) - 15} ${xScale(parseDate(lastPoint1[xField])) - 2.5},${yScale(lastPoint2[yField]) - 20} ${xScale(parseDate(lastPoint1[xField])) + 2.5},${yScale(lastPoint2[yField]) - 20}`)
        .attr("fill", '#030300');
    
    // 添加新的比率标签 - 带描边
    g.append("text")
        .attr("x", xScale(parseDate(lastPoint1[xField])))
        .attr("y", ratioY - 5)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("filter", "url(#textStroke)")
        .style("font-family", "Arial")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("fill", "#333333")
        .text(ratio);
    
    g.append("text")
        .attr("x", xScale(parseDate(lastPoint1[xField])))
        .attr("y", ratioY + 10)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("filter", "url(#textStroke)")
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#333333")
        .text("Ratio");
    
    return svg.node();
} 