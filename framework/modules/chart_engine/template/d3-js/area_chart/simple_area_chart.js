/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Simple Area Chart",
    "chart_name": "simple_area_chart_01",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical", "temporal"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, 1000]],
    "required_fields_icons": ["x"],
    "required_other_icons": ["primary"],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "gradient", "opacity"],
    "min_height": 300,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data_columns || [];

    // 清空容器
    d3.select(containerSelector).html("");
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 60, right: 100, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    // 添加标题
    if (variables.title && variables.title.text) {
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", margin.top / 2)
            .attr("text-anchor", "middle")
            .style("font-family", typography.title.font_family)
            .style("font-size", typography.title.font_size)
            .style("font-weight", typography.title.font_weight)
            .style("fill", colors.text_color)
            .text(variables.title.text);
    }
    
    // 创建图表组
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // 创建比例尺
    const xScale = d3.scaleBand()
        .domain(chartData.map(d => d[xField]))
        .range([0, innerWidth])
        .padding(0.1);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d[yField]) * 1.1])
        .range([innerHeight, 0]);
    
    // 创建面积生成器
    const area = d3.area()
        .x(d => xScale(d[xField]) + xScale.bandwidth() / 2)
        .y0(innerHeight)
        .y1(d => yScale(d[yField]));
    
    // 创建线条生成器（用于边界线）
    const line = d3.line()
        .x(d => xScale(d[xField]) + xScale.bandwidth() / 2)
        .y(d => yScale(d[yField]));
    
    // 添加渐变效果（如果需要）
    if (variables.has_gradient) {
        const defs = svg.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", "area-gradient")
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", 0)
            .attr("y1", yScale(0))
            .attr("x2", 0)
            .attr("y2", yScale(d3.max(chartData, d => d[yField])));
            
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(colors.other.primary).brighter(0.5));
            
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", colors.other.primary);
    }
    
    // 添加阴影效果（如果需要）
    if (variables.has_shadow) {
        const defs = svg.select("defs").size() ? svg.select("defs") : svg.append("defs");
        
        defs.append("filter")
            .attr("id", "shadow")
            .append("feDropShadow")
            .attr("dx", 0)
            .attr("dy", 2)
            .attr("stdDeviation", 2)
            .attr("flood-opacity", 0.3);
    }
    
    // 绘制面积
    g.append("path")
        .datum(chartData)
        .attr("class", "area")
        .attr("fill", variables.has_gradient ? "url(#area-gradient)" : colors.other.primary)
        .attr("fill-opacity", variables.has_opacity ? 0.6 : 0.8)
        .attr("d", area)
        .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
    
    // 绘制边界线
    g.append("path")
        .datum(chartData)
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", colors.other.primary)
        .attr("stroke-width", 2)
        .attr("d", line);
    
    // 绘制数据点
    g.selectAll(".dot")
        .data(chartData)
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", d => xScale(d[xField]) + xScale.bandwidth() / 2)
        .attr("cy", d => yScale(d[yField]))
        .attr("r", 4)
        .attr("fill", colors.other.primary)
        .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
    
    // 绘制X轴
    const xAxis = g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale));
    
    // 设置X轴样式
    xAxis.selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .attr("transform", "rotate(-45)")
        .attr("text-anchor", "end");
    
    // 绘制Y轴
    const yAxis = g.append("g")
        .call(d3.axisLeft(yScale));
    
    // 设置Y轴样式
    yAxis.selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color);
    
    // 添加X轴图标（如果有）
    const icons = jsonData.images.field;
    chartData.forEach(d => {
        const xValue = d[xField];
        if (icons[xValue]) {
            g.append("image")
                .attr("x", xScale(xValue) + xScale.bandwidth() / 2 - 10)
                .attr("y", innerHeight + 25)
                .attr("width", 20)
                .attr("height", 20)
                .attr("xlink:href", icons[xValue]);
        }
    });
    
    // 添加交互效果
    const tooltip = d3.select(containerSelector)
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background-color", "white")
        .style("border", "1px solid #ddd")
        .style("padding", "10px")
        .style("border-radius", "5px");
    
    g.selectAll(".dot")
        .on("mouseover", function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 6);
                
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
                
            tooltip.html(`${xField}: ${d[xField]}<br/>${yField}: ${d[yField]}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 4);
                
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    
    return svg.node();
} 