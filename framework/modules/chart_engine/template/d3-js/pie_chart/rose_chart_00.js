/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Rose Chart",
    "chart_name": "rose_chart_new_00",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "stroke"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 玫瑰图实现 - 带有图标和标签的分段饼图
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    // 提取数据和配置
    const jsonData = data;
    const chartData = jsonData.data.data || [];
    const variables = jsonData.variables || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || { field: {} };
    
    // 获取单位
    const unit = dataColumns[1].unit || "";

    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || {
        text_color: "#333333",
        field: {},
        other: {
            primary: "#4682B4" // 默认主色调
        }
    };

    // 提取字段名称
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    
    // Set dimensions and margins
    const width = variables.width || 800;
    const height = variables.height || 800;
    const margin = { top: 80, right: 120, bottom: 80, left: 120 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 中心点和半径计算
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(chartWidth, chartHeight) / 2;
    
    // Create a root group
    const g = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);
    
    // 创建饼图生成器
    const pie = d3.pie()
        .value(d => d[yField])
        .sort(null)
        .padAngle(0.02);

    // 创建弧形生成器
    const arc = d3.arc()
        .innerRadius(maxRadius * 0.2) // 内半径
        .outerRadius(d => {
            // 根据数值调整外半径，创建玫瑰图效果
            return maxRadius * 0.2 + (maxRadius * 0.8) * (d.data[yField] / d3.max(chartData, d => d[yField]));
        })
        .cornerRadius(5);

    // 计算每个组的百分比
    const total = d3.sum(chartData, d => d[yField]);
    const dataWithPercentages = chartData.map(d => ({
        ...d,
        percentage: (d[yField] / total) * 100
    }));

    // 绘制玫瑰图的各个部分
    const arcs = g.selectAll("path")
        .data(pie(dataWithPercentages))
        .enter()
        .append("path")
        .attr("fill", (d, i) => colors.field[d.data[xField]] || colors.other.primary)
        .attr("d", arc);
    
    // 添加图标到扇区上
    const iconGroups = g.selectAll(".icon-group")
        .data(pie(dataWithPercentages))
        .enter()
        .append("g")
        .attr("class", "icon-group");
    
    iconGroups.each(function(d) {
        const group = d3.select(this);
        const iconSize = 36;
        
        // 计算扇区中心角度
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        
        // 计算扇区实际外半径
        const actualOuterRadius = maxRadius * 0.2 + (maxRadius * 0.8) * (d.data[yField] / d3.max(chartData, d => d[yField]));
        
        // 将图标放在外半径的60%处，确保位于扇区内部
        const iconRadius = maxRadius * 0.2 + (actualOuterRadius - maxRadius * 0.2) * 0.6;
        
        // 使用扇区角度计算图标位置
        const iconX = Math.sin(midAngle) * iconRadius; // 注意：这里使用sin而不是cos
        const iconY = -Math.cos(midAngle) * iconRadius; // 注意：这里使用-cos而不是sin
        
        // 添加图标背景
        group.append("circle")
            .attr("cx", iconX)
            .attr("cy", iconY)
            .attr("r", iconSize/2)
            .attr("fill", "white")
            .attr("stroke", colors.field[d.data[xField]] || colors.other.primary)
            .attr("stroke-width", 2);
            
        // 添加图标（如果有）
        if (images.field && images.field[d.data[xField]]) {
            group.append("image")
                .attr("xlink:href", images.field[d.data[xField]])
                .attr("x", iconX - iconSize/2 + iconSize * 0.15)
                .attr("y", iconY - iconSize/2 + iconSize * 0.15)
                .attr("width", iconSize * 0.7)
                .attr("height", iconSize * 0.7);
        } else {
            // 如果没有图标，使用首字母
            group.append("text")
                .attr("x", iconX)
                .attr("y", iconY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", colors.field[d.data[xField]] || colors.other.primary)
                .attr("font-weight", "bold")
                .attr("font-size", "14px")
                .text(d.data[xField].charAt(0));
        }
    });

    // 计算外部标签位置
    const outerArc = d3.arc()
        .innerRadius(maxRadius * 1.05)
        .outerRadius(maxRadius * 1.05);
        
    // 添加标签线和标签组
    const labelGroups = g.selectAll(".label-group")
        .data(pie(dataWithPercentages))
        .enter()
        .append("g")
        .attr("class", "label-group");
    
    // 计算标签位置 - 将标签放在扇区外部但更接近
    labelGroups.each(function(d) {
        const label = d3.select(this);
        const pos = outerArc.centroid(d);
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        // 减小距离，从1.2倍减小到1.1倍
        pos[0] = maxRadius * 1.1 * (midAngle < Math.PI ? 1 : -1);
        
        // 计算扇区实际外半径
        const actualOuterRadius = maxRadius * 0.2 + (maxRadius * 0.8) * (d.data[yField] / d3.max(chartData, d => d[yField]));
        
        // 计算扇区外弧上的点作为连线起点
        const startX = Math.sin(midAngle) * actualOuterRadius;
        const startY = -Math.cos(midAngle) * actualOuterRadius;
        
        // 添加连接线 - 从外弧开始而不是中心点
        const midPoint = outerArc.centroid(d);
        midPoint[0] = maxRadius * (midAngle < Math.PI ? 1.02 : -1.02);
        
        const polyline = [[startX, startY], midPoint, [pos[0], pos[1]]];
        
        label.append("polyline")
            .attr("points", polyline.map(p => p.join(",")).join(" "))
            .attr("fill", "none")
            .attr("stroke", "#999")
            .attr("stroke-width", 1);
            
        // 根据角度调整文本对齐方式
        const textAnchor = midAngle < Math.PI ? "start" : "end";
        
        // 计算文本位置的偏移量，不再需要图标偏移
        const paddingX = midAngle < Math.PI ? 5 : -5;
                
        // 添加标签文本 - 分成三行：类别名、数值、单位
        const textGroup = label.append("g")
            .attr("transform", `translate(${pos[0] + paddingX}, ${pos[1] - 25})`);
            
        // 类别名
        textGroup.append("text")
            .attr("text-anchor", textAnchor)
            .attr("dy", "0em")
            .style("font-family", typography.label.font_family)
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .style("fill", colors.field[d.data[xField]] || colors.other.primary)
            .text(d.data[xField]);
            
        // 数值
        textGroup.append("text")
            .attr("text-anchor", textAnchor)
            .attr("dy", "1.2em")
            .style("font-family", typography.label.font_family)
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .style("fill", colors.text_color)
            .text(d.data[yField].toLocaleString());
            
        // 单位 - 使用columns[1].unit
        if (unit) {
            textGroup.append("text")
                .attr("text-anchor", textAnchor)
                .attr("dy", "2.4em")
                .style("font-family", typography.label.font_family)
                .style("font-size", "12px")
                .style("fill", "#777")
                .text(unit);
        }
    });
    
    return svg.node();
}
