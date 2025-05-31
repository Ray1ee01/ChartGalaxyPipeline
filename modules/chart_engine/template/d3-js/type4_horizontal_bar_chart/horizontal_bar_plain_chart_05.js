/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_plain_chart_05",
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
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 提取数据和配置
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333",
        other: { 
            primary: "#4472C4",
            secondary: "#AAAAAA",
            background: "#F0F0F0" 
        }
    };
    const dataColumns = jsonData.data.columns || [];
    
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
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 设置图表尺寸
    const width = variables.width || 300;
    const height = variables.height || 400;
    
    const margin = {
        top: 50,
        right: 60,
        bottom: 80,
        left: 40
    };
    
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // 获取字段名
    const xField = dataColumns.find(col => col.role === "x")?.name || "period";
    const yField = dataColumns.find(col => col.role === "y")?.name || "value";
    
    // 获取单位
    let yUnit = "";
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        yUnit = dataColumns.find(col => col.role === "y").unit;
    }
    
    // 处理数据
    const processedData = chartData.map(d => ({
        category: d[xField],
        value: +d[yField]
    })).sort((a, b) => b.value - a.value);
    
    // 创建比例尺
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, chartHeight])
        .padding(0.3);
    
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value)])
        .range([0, chartWidth])
        .nice();
    
    // 创建SVG容器
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    const chartGroup = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 添加隐藏的X轴
    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d => formatValue(d) + (yUnit ? ` ${yUnit}` : ''))
        .tickSize(0)
        .tickPadding(10);
        
    chartGroup.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove())
        .selectAll("text")
        .attr("class", "value")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", colors.text_color)
        .style("opacity", 0);
    
    // 添加条形
    const bars = chartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark")
        .attr("y", d => yScale(d.category))
        .attr("x", 0)
        .attr("height", yScale.bandwidth())
        .attr("width", d => xScale(d.value))
        .attr("fill", colors.other.primary);
    
    // 创建临时文本元素来测量文本宽度
    const tempText = svg.append("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("opacity", 0);
    
    // 计算文本宽度的辅助函数
    const getTextWidth = (text) => {
        tempText.text(text);
        return tempText.node().getComputedTextLength();
    };
    
    // 添加维度标签和数值标签
    processedData.forEach(d => {
        const barWidth = xScale(d.value);
        const categoryText = d.category;
        const valueText = formatValue(d.value) + (yUnit ? ` ${yUnit}` : '');
        
        const categoryTextWidth = getTextWidth(categoryText);
        const valueTextWidth = getTextWidth(valueText);
        
        // 判断维度标签是否能放在条形内部（留10px的边距）
        const canFitInside = categoryTextWidth + 20 <= barWidth;
        
        if (canFitInside) {
            // 维度标签放在条形内部左侧，白色字体
            chartGroup.append("text")
                .attr("class", "label")
                .attr("y", yScale(d.category) + yScale.bandwidth() / 2)
                .attr("x", 10)
                .attr("dy", ".35em")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("fill", "white")
                .text(categoryText);
            
            // 数值标签放在条形右侧
            chartGroup.append("text")
                .attr("class", "value")
                .attr("y", yScale(d.category) + yScale.bandwidth() / 2)
                .attr("x", barWidth + 5)
                .attr("dy", ".35em")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("fill", colors.text_color)
                .text(valueText);
        } else {
            // 维度标签放在条形右侧
            chartGroup.append("text")
                .attr("class", "label")
                .attr("y", yScale(d.category) + yScale.bandwidth() / 2)
                .attr("x", barWidth + 5)
                .attr("dy", ".35em")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("fill", colors.text_color)
                .text(categoryText);
            
            // 数值标签右移，放在维度标签右侧
            chartGroup.append("text")
                .attr("class", "value")
                .attr("y", yScale(d.category) + yScale.bandwidth() / 2)
                .attr("x", barWidth + categoryTextWidth + 15)
                .attr("dy", ".35em")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("fill", colors.text_color)
                .text(valueText);
        }
    });
    
    // 移除临时文本元素
    tempText.remove();
    
    return svg.node();
} 