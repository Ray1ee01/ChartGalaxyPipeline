/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Stack Area Chart",
    "chart_name": "stack_area_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical", "temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, 1000], [2, 8]],
    "required_fields_icons": ["x"],
    "required_other_icons": ["primary"],
    "required_fields_colors": ["group"],
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
    const margin = { top: 60, right: 120, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 获取唯一的组值和X值
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    const xValues = [...new Set(chartData.map(d => d[xField]))];
    
    // 重组数据为堆叠格式
    const stackData = xValues.map(xValue => {
        const item = { x: xValue };
        groups.forEach(group => {
            const match = chartData.find(d => d[xField] === xValue && d[groupField] === group);
            item[group] = match ? match[yField] : 0;
        });
        return item;
    });
    
    // 创建堆叠生成器
    const stack = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);
    
    const series = stack(stackData);
    
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
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.1);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(series, d => d3.max(d, d => d[1])) * 1.1])
        .range([innerHeight, 0]);
    
    // 获取颜色
    const getColor = (group) => {
        return colors.field && colors.field[group] ? colors.field[group] : colors.other.primary;
    };
    
    // 添加渐变效果（如果需要）
    if (variables.has_gradient) {
        const defs = svg.append("defs");
        groups.forEach(group => {
            const gradientId = `area-gradient-${group.replace(/\s+/g, '-').toLowerCase()}`;
            const baseColor = getColor(group);
            
            const gradient = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("gradientUnits", "userSpaceOnUse")
                .attr("x1", 0)
                .attr("y1", yScale(0))
                .attr("x2", 0)
                .attr("y2", yScale(d3.max(series, d => d3.max(d, d => d[1]))));
                
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
    
    // 创建面积生成器
    const area = d3.area()
        .x(d => xScale(d.data.x) + xScale.bandwidth() / 2)
        .y0(d => yScale(d[0]))
        .y1(d => yScale(d[1]));
    
    // 绘制堆叠面积
    const layers = g.selectAll(".layer")
        .data(series)
        .enter()
        .append("g")
        .attr("class", "layer");
    
    layers.append("path")
        .attr("class", "area")
        .style("fill", (d, i) => {
            const group = groups[i];
            if (variables.has_gradient) {
                return `url(#area-gradient-${group.replace(/\s+/g, '-').toLowerCase()})`;
            }
            return getColor(group);
        })
        .attr("fill-opacity", variables.has_opacity ? 0.7 : 0.9)
        .attr("d", area)
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
    xValues.forEach(xValue => {
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
        
        legendRow.append("rect")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", getColor(group));
        
        legendRow.append("text")
            .attr("x", 25)
            .attr("y", 12)
            .text(group)
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color);
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
    
    layers.selectAll("path")
        .on("mouseover", function(event, d) {
            const group = groups[d.index];
            d3.select(this)
                .transition()
                .duration(200)
                .attr("fill-opacity", variables.has_opacity ? 0.9 : 1);
            
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            
            tooltip.html(`Group: ${group}<br/>Value: ${d3.sum(d, v => v[1] - v[0])}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("fill-opacity", variables.has_opacity ? 0.7 : 0.9);
            
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    
    return svg.node();
} 