/*
REQUIREMENTS_BEGIN
{
    "_comment": "线图的基本配置要求",
    "chart_type": "Line Chart",
    "chart_name": "line_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": ["string", "number", "string"],
    "supported_effects": ["shadow", "gradient", "stroke", "animation", "point"],
    "required_data_points": [5, 100],
    "required_image": ["trend"],
    "width": [500, 1000],
    "height": [300, 600],
    "x_range": [2, 20]
}
REQUIREMENTS_END
*/
// Line Chart implementation using D3.js
function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data;
    const variables = jsonData.variables;
    const constants = jsonData.constants;
    const typography = jsonData.typography;

    d3.select(containerSelector).html("");
    
    // 设置图表尺寸
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 60, right: 100, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 提取轴字段
    const xField = variables.x_axis.field;
    const yField = variables.y_axis.field;
    const groupField = jsonData.data_columns.find(col => col.role === "group").name;
    
    // 获取唯一的x值和分组
    const xValues = [...new Set(chartData.map(d => d[xField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 创建颜色比例尺
    const colorScale = d3.scaleOrdinal()
        .domain(variables.color.mark_color.domain)
        .range(variables.color.mark_color.range);
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    // 创建主图表组
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 创建比例尺
    const xScale = d3.scalePoint()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.5);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d[yField]) * 1.1])
        .range([innerHeight, 0]);
    
    // 创建线生成器
    const line = d3.line()
        .x(d => xScale(d[xField]))
        .y(d => yScale(d[yField]))
        .curve(d3.curveMonotoneX);
    
    // 添加渐变
    if (variables.mark.has_gradient) {
        const defs = svg.append("defs");
        groups.forEach(group => {
            const gradientId = `line-gradient-${group.replace(/\s+/g, '-').toLowerCase()}`;
            
            const gradient = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("gradientUnits", "userSpaceOnUse")
                .attr("x1", 0)
                .attr("y1", innerHeight)
                .attr("x2", 0)
                .attr("y2", 0);
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", colorScale(group))
                .attr("stop-opacity", 0.3);
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", colorScale(group));
        });
    }
    
    // 添加阴影滤镜
    if (variables.mark.has_shadow) {
        const defs = svg.select("defs").size() ? svg.select("defs") : svg.append("defs");
        
        defs.append("filter")
            .attr("id", "line-shadow")
            .append("feDropShadow")
            .attr("dx", 0)
            .attr("dy", 2)
            .attr("stdDeviation", 2)
            .attr("flood-opacity", 0.3);
    }
    
    // 绘制坐标轴
    if (constants.has_x_axis) {
        const xAxis = g.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale))
            .style("color", variables.x_axis.style.color)
            .style("opacity", variables.x_axis.style.opacity);
        
        if (!variables.x_axis.has_domain) {
            xAxis.select(".domain").remove();
        }
        
        if (!variables.x_axis.has_tick) {
            xAxis.selectAll(".tick line").remove();
        }
        
        xAxis.selectAll("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight);
    }
    
    if (constants.has_y_axis) {
        const yAxis = g.append("g")
            .call(d3.axisLeft(yScale))
            .style("color", variables.y_axis.style.color)
            .style("opacity", variables.y_axis.style.opacity);
        
        if (!variables.y_axis.has_domain) {
            yAxis.select(".domain").remove();
        }
        
        if (!variables.y_axis.has_tick) {
            yAxis.selectAll(".tick line").remove();
        }
        
        yAxis.selectAll("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight);
    }
    
    // 为每个分组绘制线条
    groups.forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        
        // 绘制线条
        g.append("path")
            .datum(groupData)
            .attr("class", "line")
            .attr("d", line)
            .style("fill", "none")
            .style("stroke", variables.mark.has_gradient ? 
                `url(#line-gradient-${group.replace(/\s+/g, '-').toLowerCase()})` : 
                colorScale(group))
            .style("stroke-width", variables.mark.has_stroke ? 3 : 2)
            .style("filter", variables.mark.has_shadow ? "url(#line-shadow)" : "none");
        
        // 如果需要显示数据点
        if (variables.mark.has_point) {
            g.selectAll(`.point-${group}`)
                .data(groupData)
                .enter()
                .append("circle")
                .attr("class", `point-${group}`)
                .attr("cx", d => xScale(d[xField]))
                .attr("cy", d => yScale(d[yField]))
                .attr("r", 4)
                .style("fill", colorScale(group))
                .style("stroke", "#fff")
                .style("stroke-width", 2);
        }
    });
    
    // 修改legend的位置，将其向左移动一些
    const legend = svg.append("g")
        .attr("transform", `translate(${width - margin.right - 30}, ${margin.top})`);
    
    groups.forEach((group, i) => {
        const legendRow = legend.append("g")
            .attr("transform", `translate(0, ${i * 25})`);
        
        legendRow.append("line")
            .attr("x1", 0)
            .attr("y1", 7)
            .attr("x2", 15)
            .attr("y2", 7)
            .style("stroke", colorScale(group))
            .style("stroke-width", 3);
        
        if (variables.mark.has_point) {
            legendRow.append("circle")
                .attr("cx", 7.5)
                .attr("cy", 7)
                .attr("r", 4)
                .style("fill", colorScale(group))
                .style("stroke", "#fff")
                .style("stroke-width", 2);
        }
        
        legendRow.append("text")
            .attr("x", 20)
            .attr("y", 12)
            .text(group)
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .style("fill", variables.color.text_color);
    });
    
    return svg.node();
} 