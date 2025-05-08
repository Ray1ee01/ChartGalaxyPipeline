/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Stacked Bar Chart",
    "chart_name": "horizontal_stacked_bar_chart_9",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 8], [0, "inf"], [2, 4]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary", "secondary", "background"],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 600,
    "min_width": 800,
    "background": "dark",
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
    const colors = jsonData.colors_dark || { 
        text_color: "#333333",
        other: { 
            primary: "#D32F2F",    // Red for "Still active"
            secondary: "#AAAAAA",  // Gray for "Ended"
            background: "#F0F0F0" 
        }
    };  // 颜色设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
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
    };
    
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
        right: 100,  // 增加右侧边距，为图标预留空间
        bottom: 80,
        left: 50
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
        .padding(0.4);  // 增加内边距，增加条形图之间的间距
    
    // X轴比例尺 - 使用数值
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) * 1.1])  // 增加10%空间
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
    
    // 用于测量文本宽度的辅助函数
    function getTextWidth(text, fontSize) {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        context.font = fontSize + " Arial";
        return context.measureText(text).width;
    }

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
    
    // 创建渐变定义
    const defs = svg.append("defs");
    
    // 为每个组创建一个渐变
    groups.forEach((group, i) => {
        const gradient = defs.append("linearGradient")
            .attr("id", `metalGradient-${i}`)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
            
        // 添加渐变停止点
        const baseColor = colorScale(group);
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.color(baseColor).brighter(0.5));
        
        gradient.append("stop")
            .attr("offset", "50%")
            .attr("stop-color", baseColor);
            
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.color(baseColor).darker(0.3));
    });
    
    // 创建阴影过滤器
    const filter = defs.append("filter")
        .attr("id", "shadow")
        .attr("height", "130%");
        
    filter.append("feGaussianBlur")
        .attr("in", "SourceAlpha")
        .attr("stdDeviation", 3)
        .attr("result", "blur");
        
    filter.append("feOffset")
        .attr("in", "blur")
        .attr("dx", 2)
        .attr("dy", 2)
        .attr("result", "offsetBlur");
        
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode")
        .attr("in", "offsetBlur");
    feMerge.append("feMergeNode")
        .attr("in", "SourceGraphic");

    // 绘制堆叠的条形
    const layers = chartGroup.selectAll(".layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", "layer")
        .style("fill", (d, i) => `url(#metalGradient-${i})`);

    layers.selectAll("rect")
        .data(d => d)
        .enter().append("rect")
        .attr("y", d => yScale(d.data.period))
        .attr("x", d => xScale(d[0]))
        .attr("width", d => xScale(d[1]) - xScale(d[0]))
        .attr("height", yScale.bandwidth())
        .style("stroke", variables.has_stroke ? "#ffffff" : "none")
        .style("stroke-width", variables.has_stroke ? 1 : 0)
        .style("filter", "url(#shadow)");

    // 添加组标签（在条形图上半部分）
    layers.selectAll(".group-label")
        .data(d => d)
        .enter().append("text")
        .attr("class", "group-label")
        .attr("y", d => yScale(d.data.period) + yScale.bandwidth() * 0.35)
        .attr("x", d => {
            // 始终在条形图内显示
            return xScale(d[0]) + 5; // 左对齐，留出5px边距
        })
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("fill", "#000000")  // 改为黑色以增强可读性
        .style("font-family", typography.annotation.font_family)
        .style("font-size", d => {
            const width = xScale(d[1]) - xScale(d[0]);
            // 根据宽度动态调整字体大小
            if (width < 40) {
                return "8px"; // 最小字体
            } else if (width < 60) {
                return "10px"; // 中等字体
            } else {
                return typography.annotation.font_size; // 默认字体
            }
        })
        .text((d, i, nodes) => {
            // 获取当前rect所属的layer组，从而获取group名称
            const parentGroup = d3.select(nodes[i].parentNode);
            const groupData = parentGroup.datum();
            
            // 检查宽度，如果太小则不显示
            const width = xScale(d[1]) - xScale(d[0]);
            if (width < 5) return ""; // 当宽度太小时不显示标签
            
            return groupData.key; // 使用堆叠数据的key作为group label
        });

    // 添加数值标注（在条形图下半部分）
    layers.selectAll(".value-label")
        .data(d => d)
        .enter().append("text")
        .attr("class", "value-label")
        .attr("y", d => yScale(d.data.period) + yScale.bandwidth() * 0.7)
        .attr("x", d => {
            // 始终在条形图内显示
            return xScale(d[0]) + 5; // 左对齐，留出5px边距
        })
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("fill", "#000000")  // 改为黑色以增强可读性
        .style("font-family", typography.annotation.font_family)
        .style("font-size", d => {
            const width = xScale(d[1]) - xScale(d[0]);
            const value = d[1] - d[0];
            // 只有在有值的情况下才显示
            if (value <= 0) return "0"; // 不显示

            // 根据宽度动态调整字体大小
            if (width < 40) {
                return "8px"; // 最小字体
            } else if (width < 60) {
                return "10px"; // 中等字体
            } else {
                return typography.annotation.font_size; // 默认字体
            }
        })
        .text(d => {
            const value = d[1] - d[0];
            const width = xScale(d[1]) - xScale(d[0]);
            
            // 检查宽度，如果太小或值为0则不显示
            if (width < 5 || value <= 0) return "";
            
            // 只在值大于0时显示
            return formatValue(value) + (yUnit ? yUnit : '');
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
        .style("fill", "#ffffff")
        .remove();

    // 添加Y轴
    const yAxis = chartGroup.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale)
            .tickSize(0)
            .tickPadding(10)
            .tickFormat(d => d))
        .call(g => g.select(".domain").remove());

    // 移除Y轴上的所有文本标签
    yAxis.selectAll(".tick text").remove();

    // 添加X标签到条形图上方
    processedData.forEach(d => {
        chartGroup.append("text")
            .attr("x", 0) // 与条形图左端对齐
            .attr("y", yScale(d.period) - 10) // 放在条形图上方10px
            .style("text-anchor", "start")
            .style("fill", "#ffffff") // 改为白色字体
            .style("font-size", "15px") // 15px字体大小
            .style("font-family", typography.label.font_family)
            .text(d.period);
    });

    // 移除原始Y轴标签和背景
    // yAxis.selectAll(".tick text").remove();  // 删除这一行，因为上面已经移除

    let bandWidth = yScale.bandwidth();
    let iconSize = yScale.bandwidth() * 0.7;
    
    // 在右侧添加图标，缩短与条形图的距离
    if (jsonData.images) {
        chartGroup.selectAll(".icon")
            .data(processedData)
            .enter()
            .append("image")
            .attr("class", "icon")
            .attr("x", chartWidth + 5)  // 放在条形图右侧，距离缩短为原来的一半
            .attr("y", d => yScale(d.period) + (yScale.bandwidth() - iconSize) / 2)
            .attr("width", iconSize)
            .attr("height", iconSize)
            .attr("xlink:href", d => jsonData.images.field[d.period]);
    }

    // 移除图例部分
    return svg.node();
}