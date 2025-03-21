/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Grouped Line Chart",
    "chart_name": "grouped_line_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical", "temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, 1000], [2, 8]],
    "required_fields_icons": ["x"],
    "required_other_icons": ["primary"],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "gradient"],
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
    const margin = { top: 60, right: 120, bottom: 60, left: 80 };
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
    
    // 获取颜色
    const getColor = (group) => {
        return colors.field && colors.field[group] ? colors.field[group] : colors.other.primary;
    };
    
    // 创建线条生成器
    const line = d3.line()
        .x(d => xScale(d[xField]) + xScale.bandwidth() / 2)
        .y(d => yScale(d[yField]));
    
    // 添加渐变效果（如果需要）
    if (variables.has_gradient) {
        const defs = svg.append("defs");
        groups.forEach(group => {
            const gradientId = `line-gradient-${group.replace(/\s+/g, '-').toLowerCase()}`;
            const baseColor = getColor(group);
            
            const gradient = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("gradientUnits", "userSpaceOnUse")
                .attr("x1", 0)
                .attr("y1", yScale(0))
                .attr("x2", 0)
                .attr("y2", yScale(d3.max(chartData, d => d[yField])));
                
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(baseColor).brighter(0.5));
                
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", baseColor);
        });
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
    
    // 为每个组绘制线条
    groups.forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        
        // 绘制线条
        g.append("path")
            .datum(groupData)
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", variables.has_gradient ? 
                `url(#line-gradient-${group.replace(/\s+/g, '-').toLowerCase()})` : 
                getColor(group))
            .attr("stroke-width", 2)
            .attr("d", line)
            .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
        
        // 绘制数据点
        g.selectAll(`.dot-${group.replace(/\s+/g, '-').toLowerCase()}`)
            .data(groupData)
            .enter()
            .append("circle")
            .attr("class", `dot-${group.replace(/\s+/g, '-').toLowerCase()}`)
            .attr("cx", d => xScale(d[xField]) + xScale.bandwidth() / 2)
            .attr("cy", d => yScale(d[yField]))
            .attr("r", 4)
            .attr("fill", getColor(group))
            .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
    });
    
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
    const uniqueXValues = [...new Set(chartData.map(d => d[xField]))];
    uniqueXValues.forEach(xValue => {
        if (icons[xValue]) {
            g.append("image")
                .attr("x", xScale(xValue) + xScale.bandwidth() / 2 - 10)
                .attr("y", innerHeight + 25)
                .attr("width", 20)
                .attr("height", 20)
                .attr("xlink:href", icons[xValue]);
        }
    });
    
    // 添加图例
    const legend = svg.append("g")
        .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);
    
    groups.forEach((group, i) => {
        const legendRow = legend.append("g")
            .attr("transform", `translate(0, ${i * 25})`);
        
        legendRow.append("line")
            .attr("x1", 0)
            .attr("y1", 10)
            .attr("x2", 15)
            .attr("y2", 10)
            .attr("stroke", getColor(group))
            .attr("stroke-width", 2);
        
        legendRow.append("circle")
            .attr("cx", 7.5)
            .attr("cy", 10)
            .attr("r", 4)
            .attr("fill", getColor(group));
        
        legendRow.append("text")
            .attr("x", 25)
            .attr("y", 15)
            .text(group)
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color);
    });
    
    return svg.node();
} 