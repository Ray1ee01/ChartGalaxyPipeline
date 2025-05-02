/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Stacked Bar Chart",
    "chart_name": "horizontal_stacked_bar_chart_0",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 20], [0, 100], [3, 20]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
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
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 600;
    const height = variables.height || 400;
    
    // 设置边距
    const margin = {
        top: 50,
        right: 30,
        bottom: 80,
        left: 200
    };
    
    // 计算实际绘图区域大小
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列获取字段名
    const xField = dataColumns.find(col => col.role === "x")?.name || "period";
    const yField = dataColumns.find(col => col.role === "y")?.name || "value";
    const groupField = dataColumns.find(col => col.role === "group")?.name || "status";
    
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

    if (dataColumns.find(col => col.role === "group")?.unit !== "none") {
        groupUnit = dataColumns.find(col => col.role === "group").unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取所有唯一的组值
    const groups = Array.from(new Set(chartData.map(d => d[groupField])));
    
    // 处理数据为堆叠格式
    const groupedData = d3.group(chartData, d => d[xField]);
    const processedData = Array.from(groupedData, ([key, values]) => {
        const obj = { period: key };
        groups.forEach(group => {
            obj[group] = d3.sum(values.filter(d => d[groupField] === group), d => +d[yField]);
        });
        obj.total = d3.sum(values, d => +d[yField]);
        return obj;
    });

    // 创建堆叠生成器
    const stack = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);

    // 生成堆叠数据
    const stackedData = stack(processedData);

    // ---------- 5. 创建比例尺 ----------
    
    // Y轴比例尺 - 使用时间段作为分类
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d.period))
        .range([chartHeight, 0])
        .padding(0.3);
    
    // X轴比例尺 - 使用数值
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total)])
        .range([0, chartWidth])
        .nice();

    // 根据colors.field的值，获取对应的color
    let group_colors = []
    for (let i = 0; i < groups.length; i++) {
        group_colors.push(colors.field[groups[i]])
    }
    // 颜色比例尺
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(group_colors)
    


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
    
    // 绘制堆叠的条形
    const layers = chartGroup.selectAll(".layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", "layer")
        .style("fill", (d) => colorScale(d.key));

    layers.selectAll("rect")
        .data(d => d)
        .enter().append("rect")
        .attr("y", d => yScale(d.data.period))
        .attr("x", d => xScale(d[0]))
        .attr("width", d => xScale(d[1]) - xScale(d[0]))
        .attr("height", yScale.bandwidth())
        .style("stroke", variables.has_stroke ? "#ffffff" : "none")
        .style("stroke-width", variables.has_stroke ? 1 : 0);

    // 添加数值标注
    layers.selectAll("text")
        .data(d => d)
        .enter().append("text")
        .attr("y", d => yScale(d.data.period) + yScale.bandwidth() / 2)
        .attr("x", d => {
            const width = xScale(d[1]) - xScale(d[0]);
            return xScale(d[0]) + width / 2;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", "#ffffff")
        .style("font-family", typography.annotation.font_family)
        .style("font-size", typography.annotation.font_size)
        .text(d => {
            const value = d[1] - d[0];
            const width = xScale(d[1]) - xScale(d[0]);
            const textwidth = getTextWidth(value.toFixed(1),typography.annotation.font_size)
            // 只在宽度大于20且值大于0时显示文本
            return (width > textwidth && value > 0) ? value.toFixed(1) : '';
        });

    // 添加X轴
    const xAxis = chartGroup.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(d3.axisBottom(xScale)
            .tickSize(0)
            .tickPadding(10))
        .call(g => g.select(".domain").remove())
        .selectAll("text")
        .remove();

    // 添加Y轴
    const yAxis = chartGroup.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale)
            .tickSize(0)
            .tickPadding(10)
            .tickFormat(d => d))
        .call(g => g.select(".domain").remove())
    yAxis.selectAll("text")
        .style("text-anchor", "end")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", colors.text_color);

    let bandWidth = yScale.bandwidth()
    let iconSize = yScale.bandwidth()*0.7
    let iconPadding = 10;
    // 添加文本和图标
    yAxis.selectAll(".tick").each(function(d) {
        const tick = d3.select(this);
        if(jsonData.images && jsonData.images.field[d]) {
            tick.append("image")
                .attr("x", - iconSize - iconPadding)  // 10是原有的padding
                .attr("y", -iconSize/2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", jsonData.images.field[d]);
            tick.select("text")
                .style("text-anchor", "end") 
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .attr("x", -iconSize-2*iconPadding)
        }
    });

    // 添加图例 - 放在图表上方
    const legendGroup = svg.append("g")
        .attr("transform", `translate(0, -50)`);
    
    // 计算字段名宽度并添加间距
    const titleWidth = groupField.length * 10;
    const titleMargin = 15;


    const legendSize = layoutLegend(legendGroup, groups, colors, {
        x: titleWidth + titleMargin,
        y: 0,
        fontSize: 14,
        fontWeight: "bold",
        align: "left",
        maxWidth: chartWidth - titleWidth - titleMargin,
        shape: "rect",
    });

    // 添加字段名称
    legendGroup.append("text")
        .attr("x", 0)
        .attr("y", legendSize.height / 2)
        .attr("dominant-baseline", "middle")
        .attr("fill", "#333")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text(groupField);
    
    // 将图例组向上移动 height/2, 并居中
    legendGroup.attr("transform", `translate(${(chartWidth - legendSize.width - titleWidth - titleMargin) / 2}, 0)`);
    

    return svg.node();
}