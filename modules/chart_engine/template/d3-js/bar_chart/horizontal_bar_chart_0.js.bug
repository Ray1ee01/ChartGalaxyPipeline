/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_0",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 20], [0, 100000]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": [],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 300,
    "min_width": 300,
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
            primary: "#D32F2F",    // Red for "Still active"
            secondary: "#AAAAAA",  // Gray for "Ended"
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
    const width = variables.width || 300;
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
    let groupUnit = "";
    
    if (dataColumns.find(col => col.role === "x")?.unit !== "none") {
        xUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        yUnit = dataColumns.find(col => col.role === "y").unit;
    }

    
    // ---------- 4. 数据处理 ----------
    
    // 处理数据，确保数据格式正确
    const processedData = chartData.map(d => ({
        category: d[xField],
        value: +d[yField] // 确保转换为数字
    })).sort((a, b) => b.value - a.value); // 按值降序排序
    
    // ---------- 5. 创建比例尺 ----------
    
    // Y轴比例尺 - 使用分类数据
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, chartHeight])
        .padding(0.3);
    
    // X轴比例尺 - 使用数值
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value)])
        .range([0, chartWidth])
        .nice();

    // 颜色比例尺
    const colorScale = d3.scaleOrdinal()
        .domain(processedData.map(d => d.category))
        .range([colors.other.primary, colors.other.primary]);

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
    
    // 添加X轴（隐藏）
    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d => d + (yUnit ? ` ${yUnit}` : ''))
        .tickSize(0)          // 移除刻度线
        .tickPadding(10);     // 增加文字和轴的间距
        
    
    chartGroup.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove())  // 移除轴线
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", colors.text_color)
        .style("opacity", 0); // 隐藏X轴文本
    
    // 添加Y轴（不显示刻度线）
    const yAxis = d3.axisLeft(yScale)
        .tickSize(0); // 移除刻度线
    
    chartGroup.append("g")
        .attr("class", "y-axis")
        .call(yAxis)
        .call(g => g.select(".domain").remove())  // 移除轴线
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", colors.text_color);
    
    // 添加条形
    const bars = chartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("y", d => yScale(d.category))
        .attr("x", 0)
        .attr("height", yScale.bandwidth())
        .attr("width", d => xScale(d.value)) // 直接设置最终宽度
        .attr("fill", d => colorScale(d.category));
    
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
    
    // 添加数值标签
    const labels = chartGroup.selectAll(".label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("y", d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr("x", d => xScale(d.value) + 5)
        .attr("dy", ".35em")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", colors.text_color)
        .text(d => `${formatValue(d.value)}${yUnit ? ` ${yUnit}` : ''}`)
        .style("opacity", 1); // 直接设置为可见
    

    return svg.node();
}