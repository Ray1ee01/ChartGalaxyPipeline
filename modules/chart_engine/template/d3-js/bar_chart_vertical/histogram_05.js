/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Histogram",
    "chart_name": "histogram_05",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[10, 50], [0, "inf"], [2, 2]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary", "secondary", "background"],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 600,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                       // 完整的JSON数据对象
    const chartData = jsonData.data.data;        // 实际数据点数组  
    const variables = jsonData.variables || {};  // 图表配置
    const typography = jsonData.typography || {  // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333",
        other: { 
            primary: "#D32F2F",    // 主要颜色
            secondary: "#AAAAAA",  // 次要颜色
            background: "#F0F0F0" 
        }
    };  // 颜色设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_shadow = variables.has_shadow || false;
    variables.has_stroke = variables.has_stroke || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 600;
    const height = variables.height || 400;
    
    // 设置边距
    const margin = {
        top: 50,
        right: 30,
        bottom: 80,
        left: 40
    };
    
    // 计算实际绘图区域大小
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列获取字段名
    const xField = dataColumns.find(col => col.role === "x")?.name || "period";
    const yField = dataColumns.find(col => col.role === "y")?.name || "value";
    const groupField = dataColumns.find(col => col.role === "group")?.name || "group";
    
    // 获取字段单位（如果存在）
    let xUnit = "";
    let yUnit = "";
    
    if (dataColumns.find(col => col.role === "x")?.unit !== "none") {
        xUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        yUnit = dataColumns.find(col => col.role === "y").unit;
    }

    // 数值单位规范
    // 添加数值格式化函数
    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 处理数据，确保数据格式正确，将时间字符串转换为日期对象
    const processedData = chartData.map((d, i) => ({
        time: new Date(d[xField]), // 确保转换为日期对象
        value: +d[yField], // 确保转换为数字
        group: d[groupField], // 添加分组信息
        originalIndex: i // 保留原始索引
    }));
    
    // 排序数据（按时间升序）
    processedData.sort((a, b) => a.time - b.time);
    
    // 查找唯一的时间值
    const uniqueTimes = Array.from(new Set(processedData.map(d => d.time.getTime())))
        .map(t => new Date(t));
    uniqueTimes.sort((a, b) => a - b);
    
    // 为每个唯一的时间分配顺序值
    const timeOrderMap = new Map();
    uniqueTimes.forEach((time, index) => {
        timeOrderMap.set(time.getTime(), index);
    });
    
    // 为每个数据点分配order
    processedData.forEach(d => {
        d.order = timeOrderMap.get(d.time.getTime());
    });
    
    // 获取所有唯一的组值
    const groups = [...new Set(processedData.map(d => d.group))];
    
    // 只保留前两个组（根据需求）
    const groupsToUse = groups.slice(0, 2);
    
    // 为每个组分配颜色
    const groupColors = {};
    groupsToUse.forEach(group => {
        groupColors[group] = colors.field?.[group] || colors.other.primary; // 如果没有对应的颜色，使用主色作为后备
    });
    
    // ---------- 5. 创建比例尺 ----------
    
    // X轴比例尺 - 使用序号比例尺
    const xScale = d3.scaleLinear()
        .domain([0, uniqueTimes.length - 1])
        .range([0, chartWidth]);
    const binWidth = Math.max(1, chartWidth / uniqueTimes.length) * 0.45; // 使用当前宽度的一半，并留出一点间隔
    
    // Y轴比例尺 - 使用数值
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value)])
        .range([chartHeight, 0])
        .nice();

    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 添加图表主体容器
    const chartGroup = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 7. 绘制图表元素 ----------
    // 根据数据点数量计算合适的标签间距
    const maxTicks = 8; // 最多显示的刻度数
    const dataLength = uniqueTimes.length;
    
    // 计算间距 - 向上取整以确保不会超过最大刻度数
    const indexStep = Math.ceil(dataLength / maxTicks);
    
    // 生成标签索引
    const tickIndices = [];
    let currentIndex = 0;
    const endIndex = dataLength - 1;
    
    // 添加起点
    tickIndices.push(currentIndex);
    
    // 按计算出的间距添加中间点
    while (currentIndex + indexStep < endIndex) {
        currentIndex += indexStep;
        tickIndices.push(currentIndex);
    }
    
    // 添加终点(如果最后一个点不是终点)
    if (tickIndices[tickIndices.length - 1] + indexStep / 2 < endIndex) {
        tickIndices.push(endIndex);
    }
    
    const xAxis = d3.axisBottom(xScale)
        .tickValues(tickIndices)
        .tickFormat(i => {
            const date = uniqueTimes[i];
            return d3.timeFormat('%Y')(date); // 只显示年份
        })
        .tickSize(0); // 移除刻度线
    
    chartGroup.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis)
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", `calc(${typography.label.font_size} * 1.5)`)
        .style("text-anchor", "middle")
        .style("fill", colors.text_color);
    
    // 添加Y轴
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => formatValue(d)) // 只显示值，不显示单位
        .tickSize(0)          // 移除刻度线
        .tickPadding(15);     // 增加文字和轴的间距
    
    chartGroup.append("g")
        .attr("class", "y-axis")
        .call(yAxis)
        .call(g => g.select(".domain").remove())  // 移除轴线
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", `calc(${typography.label.font_size} * 1.5)`) // 字体大小增大1.5倍
        .style("text-anchor", "end") // 右对齐
        .attr("dx", "-0.5em") // 向左微调
        .style("fill", colors.text_color);
    
    // 如果存在Y轴单位，则在Y轴顶端显示
    if (yUnit) {
        chartGroup.append("text")
            .attr("class", "y-axis-unit")
            .attr("x", 10)
            .attr("y", -20)
            .style("text-anchor", "start")
            .style("font-family", typography.label.font_family)
            .style("font-size", `calc(${typography.label.font_size} * 1.5)`) // 字体大小增大1.5倍
            .style("fill", colors.text_color)
            .text("(" + yUnit + ")");
    }
    
    // 按组分别添加直方图柱子
    groupsToUse.forEach((group, groupIndex) => {
        // 过滤当前组的数据
        const groupData = processedData.filter(d => d.group === group);
        
        // 添加当前组的柱子
        chartGroup.selectAll(`.bar-${groupIndex}`)
            .data(groupData)
            .enter()
            .append("rect")
            .attr("class", `bar bar-${groupIndex}`)
            .attr("x", d => xScale(d.order) - binWidth/2 + (groupIndex * binWidth * 0.5)) // 错开排列
            .attr("y", d => yScale(d.value))
            .attr("opacity", 0.75)
            .attr("width", binWidth * 0.9) // 减小padding，使用85%的binWidth
            .attr("height", d => chartHeight - yScale(d.value))
            .attr("fill", groupColors[group]) // 使用组对应的颜色
            .attr("stroke", "none"); // 无边框
    });
    
    // 添加图例
    const legendGroup = svg.append("g")
        .attr("transform", `translate(${margin.left + chartWidth/2}, ${height - margin.bottom/2})`);
    
    // 先创建临时文本元素来计算文本宽度
    const tempText = svg.append("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", `calc(${typography.label.font_size} * 1.5)`)
        .style("visibility", "hidden");
    
    // 计算每个图例项的宽度
    const legendItemWidths = groupsToUse.map(group => {
        tempText.text(group);
        const textWidth = tempText.node().getBBox().width;
        return textWidth + 30 + 20 + 20; // 左边距 + 矩形宽度 + 矩形到文本距离 + 右边距
    });
    
    // 移除临时文本
    tempText.remove();
    
    // 计算所有图例的总宽度
    const totalLegendWidth = legendItemWidths.reduce((sum, width) => sum + width, 0);
    
    // 计算每个图例项的位置
    let currentX = -totalLegendWidth / 2; // 从总宽度的一半处开始，确保居中
    
    groupsToUse.forEach((group, i) => {
        const legendItem = legendGroup.append("g")
            .attr("transform", `translate(${currentX}, 0)`);
        
        // 添加颜色方块
        legendItem.append("rect")
            .attr("width", 20)
            .attr("height", 20)
            .attr("fill", groupColors[group]);
        
        // 添加文字
        legendItem.append("text")
            .attr("x", 30)
            .attr("y", 15)
            .text(group)
            .style("font-family", typography.label.font_family)
            .style("font-size", `calc(${typography.label.font_size} * 1.5)`)
            .style("fill", colors.text_color);
        
        // 更新下一个图例项的起始位置
        currentX += legendItemWidths[i];
    });

    return svg.node();
}