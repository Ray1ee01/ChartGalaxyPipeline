/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Histogram",
    "chart_name": "vertical_bar_chart_11",
    "required_fields": ["x", "y"],
    "required_fields_type": [["temporal"], ["numerical"]],
    "required_fields_range": [[20,40], [0, 100]],
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
    }));
    // ---------- 5. 创建比例尺 ----------
    
    // X轴比例尺 - 使用分类数据
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, chartWidth])
        .padding(0.05);
    
    // Y轴比例尺 - 使用数值
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value)])
        .range([chartHeight, 0])
        .nice();

    // 颜色比例尺
    const colorScale = (d, i) => {
        console.log(i)
        if (i === 0) {
            // 第一个柱子使用更深的颜色
            return d3.rgb(colors.other.primary).darker(0.7);
        }
        // 其他柱子使用primary颜色
        return colors.other.primary;
    };


    // 确定标签的最大长度：
    let minXLabelRatio = 1.0
    const maxXLabelWidth = xScale.bandwidth() * 1.03

    chartData.forEach(d => {
        // x label
        const xLabelText = String(d[xField])
        let currentWidth = getTextWidth(xLabelText)
        if (currentWidth > maxXLabelWidth) {
            minXLabelRatio = Math.min(minXLabelRatio, maxXLabelWidth / currentWidth)
        }
    })

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
    
    // 添加X轴
    const xAxis = d3.axisBottom(xScale)
        .tickSize(0) // 移除刻度线
        .tickValues(xScale.domain().filter((d, i) => i % 4 === 0)); // 每隔4个显示一个标签
    
    chartGroup.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis)
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("text-anchor", minXLabelRatio < 1.0 ? "end" : "middle")
        .attr("transform", minXLabelRatio < 1.0 ? "rotate(-45)" : "rotate(0)") 
        .style("fill", colors.text_color);
    
    // 添加Y轴
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => formatValue(d) + (yUnit ? ` ${yUnit}` : ''))
        .tickSize(0)          // 移除刻度线
        .tickPadding(10);     // 增加文字和轴的间距
    
    chartGroup.append("g")
        .attr("class", "y-axis")
        .call(yAxis)
        .call(g => g.select(".domain").remove())  // 移除轴线
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", colors.text_color);
    
    // 添加条形
    const circleRadius = xScale.bandwidth() / 2; // 每个圆形的半径
    const circleSpacing = 2; // 圆形之间的间距
    
    // 为每个数据点创建圆形组
    const barGroups = chartGroup.selectAll(".bar-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${xScale(d.category) + xScale.bandwidth()/2}, -10)`);
    
    // 计算每个柱子需要多少个圆形
    barGroups.each(function(d) {
        const totalHeight = chartHeight - yScale(d.value);
        const numCircles = Math.floor(totalHeight / (circleRadius * 2 + circleSpacing));
        
        // 为每个柱子创建多个圆形
        for (let i = 0; i < numCircles; i++) {
            d3.select(this)
                .append("circle")
                .attr("r", circleRadius)
                .attr("cy", chartHeight - i * (circleRadius * 2 + circleSpacing))
                .attr("fill", colorScale(d, i))
                .attr("opacity", 1 - (i/numCircles/2)); // 添加透明度渐变效果
        }
    });

    return svg.node();
}