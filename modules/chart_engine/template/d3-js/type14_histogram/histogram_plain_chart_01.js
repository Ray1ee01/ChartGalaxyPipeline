/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Histogram",
    "chart_name": "histogram_plain_chart_01",
    "required_fields": ["x", "y"],
    "required_fields_type": [["temporal"], ["numerical"]],
    "required_fields_range": [[15, 50], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
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
        order: i // 添加顺序索引
    }));
    
    // 排序数据（按时间升序）
    processedData.sort((a, b) => a.time - b.time);
    
    // 重新分配顺序
    processedData.forEach((d, i) => {
        d.order = i;
    });
    
    // ---------- 5. 创建比例尺 ----------
    
    // 获取时间范围
    const timeExtent = d3.extent(processedData, d => d.time);
    
    // X轴比例尺 - 使用序号比例尺
    const xScale = d3.scaleLinear()
        .domain([0, processedData.length - 1])
        .range([0, chartWidth]);
    
    // 时间格式化函数 - 使用nice让范围更合理
    const timeScale = d3.scaleTime()
        .domain(timeExtent)
        .range([0, processedData.length - 1])
        .nice(); // 使用nice优化时间范围
    
    // 计算柱宽
    const binWidth = Math.max(1, chartWidth / processedData.length);
    
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
    const dataLength = processedData.length;
    
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
            const date = processedData[i].time;
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
        .tickFormat(d => formatValue(d) + (yUnit ? ` ${yUnit}` : ''))
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
    
    // 添加直方图柱子
    const bars = chartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.order) - binWidth/2)
        .attr("y", d => yScale(d.value))
        .attr("width", binWidth * 0.9) // 减小padding (使用90%的binWidth)
        .attr("height", d => chartHeight - yScale(d.value))
        .attr("fill", colors.other.primary) // 使用纯色
        .attr("stroke", "none"); // 无边框
    
    // 移除数值标签（不显示bar的label）

    return svg.node();
}