/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Bar Chart",
    "chart_name": "vertical_bar_chart_09",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 10], [0, 100]],
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
    
    // 数值格式化函数
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
        .padding(0.3);
    
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


    const imageBase64 = "data:image/png;base64,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"

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
        .tickSize(0); // 移除刻度线
    
    chartGroup.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove())  // 移除轴线
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("text-anchor", minXLabelRatio < 1.0 ? "end" : "middle")
        .attr("transform", minXLabelRatio < 1.0 ? "rotate(-45)" : "rotate(0)") 
        .style("fill", colors.text_color);
    
    // 添加Y轴
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => d + (yUnit ? ` ${yUnit}` : ''))
        .tickSize(0)          // 移除刻度线
        .tickPadding(10);     // 增加文字和轴的间距
    
    chartGroup.append("g")
        .attr("class", "y-axis")
        .call(yAxis)
        .call(g => g.select(".domain").remove())  // 移除轴线
        .selectAll("text")
        .remove()
    
    // 添加条形
    const bars = chartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    // 计算图片的宽高比
    const imgAspectRatio = 1

    // 为每个柱子添加图片叠加
    bars.each(function(d) {
        const barHeight = chartHeight - yScale(d.value);
        const barWidth = xScale.bandwidth();
        
        // 计算单个图片的尺寸
        const imgWidth = barWidth;
        const imgHeight = imgWidth / imgAspectRatio;
        
        // 计算需要叠加的图片数量
        const numImages = Math.ceil(barHeight / imgHeight)/0.353;
        
        // 创建图片叠加
        for (let i = 0; i < numImages; i++) {
            d3.select(this)
                .append("image")
                .attr("xlink:href", imageBase64)
                .attr("x", 0)
                .attr("y", chartHeight-imgHeight*0.7 - (i + 1) * imgHeight*0.353)
                .attr("width", imgWidth)
                .attr("height", imgHeight);
        }
    });
    // 添加数值标签
    const labels = chartGroup.selectAll(".label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => {
            // 计算图片堆叠的实际高度
            const barHeight = chartHeight - yScale(d.value);
            const imgWidth = xScale.bandwidth();
            const imgHeight = imgWidth / imgAspectRatio;
            const numImages = Math.ceil(barHeight / imgHeight) / 0.353;
            const stackHeight = numImages * imgHeight * 0.353;
            
            // 确保标签位于图片堆叠的顶部上方
            return chartHeight - stackHeight - imgHeight-10;
        })
        .attr("text-anchor", "middle")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", colors.text_color)
        .text(d => formatValue(d.value) + (yUnit ? ` ${yUnit}` : ''))
        .style("opacity", 1);

    return svg.node();
}