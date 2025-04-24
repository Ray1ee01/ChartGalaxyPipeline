/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Radial Bar Chart",
    "chart_name": "radial_bar_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 20], [0, 100], [3, 20]],
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
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];

    // Clear container
    d3.select(containerSelector).html("");
    
    // Get field names
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    
    // 处理数据：按xField分组，准备堆叠数据
    const groupedData = d3.group(chartData, d => d[xField]);
    const keys = Array.from(new Set(chartData.map(d => d[xField])));
    
    // 创建径向堆叠数据结构
    const stackData = [];
    let maxStackTotal = 0;
    
    groupedData.forEach((values, key) => {
        // 对每组数据按某种顺序排序（这里可以根据需要调整）
        values.sort((a, b) => a[yField] - b[yField]);
        
        let radius = 60; // 内圆半径
        let stackGroup = {
            key: key,
            segments: []
        };
        
        // 计算每个分段的起始和结束位置
        let total = 0;
        values.forEach((d, i) => {
            const value = +d[yField];
            const segment = {
                value: value,
                innerRadius: radius,
                outerRadius: radius + value,
                data: d
            };
            radius += value; // 更新下一段的起始半径
            total += value;
            stackGroup.segments.push(segment);
        });
        
        stackGroup.total = total;
        maxStackTotal = Math.max(maxStackTotal, total);
        stackData.push(stackGroup);
    });
    
    // Set dimensions and margins
    const width = variables.width || 600;
    const height = variables.height || 600;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    // Calculate center point
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Create a root group
    const g = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    // 计算每个堆栈的角度
    const numStacks = stackData.length;
    const angleStep = 2 * Math.PI / numStacks;
    const barWidth = Math.min(30, angleStep * 180 / Math.PI - 5); // 转换为角度并留出间隙
    
    // 创建径向网格线
    const gridRadius = 60 + maxStackTotal;
    const gridLines = g.append("g").attr("class", "grid-lines");
    
    // 绘制同心圆网格
    const gridStep = Math.ceil(maxStackTotal / 5) * 5; // 取整的网格步长
    for (let r = 60; r <= 60 + maxStackTotal; r += gridStep) {
        gridLines.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", r)
            .attr("fill", "none")
            .attr("stroke", "#ddd")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");
        
        // 添加径向标签
        if (r > 60) { // 跳过内圆
            gridLines.append("text")
                .attr("x", 5)
                .attr("y", -r + 5)
                .attr("font-size", "10px")
                .attr("fill", "#666")
                .text(r - 60);
        }
    }
    
    // 绘制径向轴线
    stackData.forEach((stack, i) => {
        const angle = i * angleStep;
        gridLines.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", Math.cos(angle) * gridRadius)
            .attr("y2", Math.sin(angle) * gridRadius)
            .attr("stroke", "#ddd")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");
    });
    
    // 为每个堆栈创建一个组
    stackData.forEach((stack, i) => {
        const stackGroup = g.append("g")
            .attr("class", `stack-group-${i}`);
        
        const startAngle = i * angleStep - barWidth / 2;
        const endAngle = startAngle + barWidth;
        
        // 绘制每个分段
        stack.segments.forEach((segment, j) => {
            // 创建弧形生成器
            const arc = d3.arc()
                .innerRadius(segment.innerRadius)
                .outerRadius(segment.outerRadius)
                .startAngle(startAngle)
                .endAngle(endAngle)
                .padAngle(0.01)
                .cornerRadius(2);
            
            // 绘制弧形
            stackGroup.append("path")
                .attr("d", arc())
                .attr("fill", () => {
                    // 使用定义好的颜色或生成渐变色
                    if (colors.segments && colors.segments[j]) {
                        return colors.segments[j];
                    }
                    const colorScale = d3.scaleOrdinal()
                        .domain(d3.range(stack.segments.length))
                        .range(d3.schemeCategory10);
                    return colorScale(j);
                })
                .attr("stroke", "#fff")
                .attr("stroke-width", 1)
                .attr("data-value", segment.value)
                .on("mouseover", function(event, d) {
                    d3.select(this).attr("opacity", 0.8);
                    
                    // 可以在这里添加悬停提示
                    // ...
                })
                .on("mouseout", function(event, d) {
                    d3.select(this).attr("opacity", 1);
                });
        });
        
        // 添加类别标签
        const labelAngle = i * angleStep;
        const labelRadius = 60 + maxStackTotal + 20;
        const labelX = Math.cos(labelAngle) * labelRadius;
        const labelY = Math.sin(labelAngle) * labelRadius;
        
        stackGroup.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", labelX > 0 ? "start" : (labelX < 0 ? "end" : "middle"))
            .attr("dominant-baseline", labelY > 0 ? "hanging" : (labelY < 0 ? "auto" : "middle"))
            .attr("transform", `rotate(${labelAngle * 180 / Math.PI + (labelX < 0 ? 180 : 0)}, ${labelX}, ${labelY})`)
            .attr("transform-origin", `${labelX}px ${labelY}px`)
            .attr("font-size", "12px")
            .attr("fill", "#333")
            .text(stack.key);
        
        // 可选：为该堆栈添加总值标签
        const totalLabelAngle = i * angleStep;
        const totalLabelRadius = 60 + stack.total / 2;
        const totalLabelX = Math.cos(totalLabelAngle) * totalLabelRadius;
        const totalLabelY = Math.sin(totalLabelAngle) * totalLabelRadius;
        
        if (stack.total > maxStackTotal * 0.2) { // 只为较大的堆栈添加标签
            stackGroup.append("text")
                .attr("x", totalLabelX)
                .attr("y", totalLabelY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", "10px")
                .attr("font-weight", "bold")
                .attr("fill", "#fff")
                .text(stack.total.toFixed(0));
        }
    });
    
    // 添加图例
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - 120}, ${height - 100})`);
    
    // 获取所有可能的段类型
    const allSegments = stackData.flatMap(stack => stack.segments);
    const uniqueSegmentLengths = [...new Set(allSegments.map(segment => segment.data[yField]))].sort((a, b) => a - b);
    
    // 显示最多5个图例项
    const legendData = uniqueSegmentLengths.slice(0, 5);
    
    legendData.forEach((value, i) => {
        legend.append("rect")
            .attr("x", 0)
            .attr("y", i * 20)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", () => {
                if (colors.segments && colors.segments[i]) {
                    return colors.segments[i];
                }
                const colorScale = d3.scaleOrdinal()
                    .domain(d3.range(legendData.length))
                    .range(d3.schemeCategory10);
                return colorScale(i);
            });
        
        legend.append("text")
            .attr("x", 25)
            .attr("y", i * 20 + 12)
            .attr("font-size", "12px")
            .attr("fill", "#333")
            .text(`Value: ${value}`);
    });
    
    // 添加中心标题
    g.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 50)
        .attr("fill", "#f9f9f9")
        .attr("stroke", "#ddd");
    
    g.append("text")
        .attr("x", 0)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .attr("fill", "#333")
        .text(variables.title || "Radial Stacked");
    
    g.append("text")
        .attr("x", 0)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("fill", "#666")
        .text("Bar Chart");

    return svg.node();
}