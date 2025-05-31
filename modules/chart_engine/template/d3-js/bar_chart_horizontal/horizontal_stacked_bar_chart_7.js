/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Stacked Bar Chart",
    "chart_name": "horizontal_stacked_bar_chart_7",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 20], [0, "inf"], [2, 4]],
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
            const formattedText = `${formatValue(value)}${yUnit}`;
            const textwidth = getTextWidth(formattedText, typography.annotation.font_size);
            // 只在宽度大于文本宽度且值大于0时显示文本
            return (width > textwidth && value > 0) ? formattedText : '';
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
        .call(g => g.select(".domain").remove());

    // 添加黑色背景矩形和白色文本
    yAxis.selectAll(".tick").each(function(d) {
        const tick = d3.select(this);
        
        // 获取标签文本内容
        const labelText = d;
        
        // 移除原始文本
        tick.select("text").remove();
        
        // 添加黑色背景矩形
        tick.append("rect")
            .attr("x", -margin.left + 5)  // 稍微缩进一点
            .attr("y", -yScale.bandwidth() / 2)
            .attr("width", margin.left - 10)  // 减去一些边距
            .attr("height", yScale.bandwidth())
            .attr("fill", "black")
            .attr("opacity", 0.5)
            .attr("rx", 3)
            .attr("ry", 3);
        
        // 添加白色文本
        tick.append("text")
            .attr("x", -10)  // 保持一些右侧边距
            .attr("y", 0)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("fill", "#ffffff")
            .style("font-family", typography.label.font_family)
            .style("font-size", 12)
            .text(labelText);
    });

    let bandWidth = yScale.bandwidth();
    let iconSize = yScale.bandwidth() * 0.7;
    
    // 在右侧添加图标
    if (jsonData.images) {
        chartGroup.selectAll(".icon")
            .data(processedData)
            .enter()
            .append("image")
            .attr("class", "icon")
            .attr("x", chartWidth + 10)  // 放在条形图右侧
            .attr("y", d => yScale(d.period) + (yScale.bandwidth() - iconSize) / 2)
            .attr("width", iconSize)
            .attr("height", iconSize)
            .attr("xlink:href", d => jsonData.images.field[d.period]);
    }

    // ---------- 8. 图例 ----------
    
    // 测量所有图例项目的文本宽度
    const getLegendItemWidth = (text, fontSize) => {
        return getTextWidth(text, fontSize) + 30; // 增加到30px，为色块和文本间留出更多空间
    };
    
    const legendFontSize = "14px";
    let legendItems = [];
    
    // 计算标题宽度
    const titleWidth = getTextWidth(groupField, legendFontSize) + 25; // 增加到25px，为标题和第一个图例项留出更多空间
    
    // 计算每个图例项的宽度
    groups.forEach(group => {
        legendItems.push({
            key: group,
            width: getLegendItemWidth(group, legendFontSize)
        });
    });
    
    // 计算总宽度
    const totalLegendWidth = titleWidth + legendItems.reduce((sum, item) => sum + item.width, 0);
    
    // 创建图例布局
    const createLegend = () => {
        // 添加图例组 - 左边与x标签左端对齐
        const legendGroup = svg.append("g")
            .attr("transform", `translate(0, 30)`); // 将x坐标设为0以左对齐
        
        // 添加图例标题
        legendGroup.append("text")
            .attr("x", 0)
            .attr("y", 0)
            .attr("dominant-baseline", "middle")
            .attr("fill", "#333")
            .style("font-size", legendFontSize)
            .style("font-weight", "bold")
            .text(groupField);
        
        return legendGroup;
    };
    
    // 检查是否需要单行或双行布局
    const availableWidth = width - 20; // 留出一些边距
    
    if (totalLegendWidth < availableWidth) {
        // 单行布局 - 固定间隔
        const legendGroup = createLegend();
        
        // 使用固定间距而不是动态计算
        const fixedSpacing = 10; // 固定的最小间距
        let xOffset = titleWidth;
        
        legendItems.forEach((item, i) => {
            const itemGroup = legendGroup.append("g")
                .attr("transform", `translate(${xOffset}, 0)`);
            
            // 添加颜色方块
            itemGroup.append("rect")
                .attr("width", 15)
                .attr("height", 15)
                .attr("y", -7.5)
                .attr("fill", colorScale(item.key));
            
            // 添加文本
            itemGroup.append("text")
                .attr("x", 20)
                .attr("y", 0)
                .attr("dominant-baseline", "middle")
                .style("font-size", legendFontSize)
                .text(item.key);
            
            // 更新偏移量，加上当前项的宽度和固定间距
            xOffset += item.width + fixedSpacing;
        });
    } else {
        // 双行布局
        const legendGroup1 = createLegend();
        
        // 第一行只显示标题
        
        // 第二行显示图例项
        const legendGroup2 = svg.append("g")
            .attr("transform", `translate(0, 55)`); // 第二行位置
        
        const fixedSpacing = 20; // 第二行的间距可以更大一些
        let xOffset = 0; // 第二行从左边开始
        
        legendItems.forEach((item, i) => {
            const itemGroup = legendGroup2.append("g")
                .attr("transform", `translate(${xOffset}, 0)`);
            
            // 添加颜色方块
            itemGroup.append("rect")
                .attr("width", 15)
                .attr("height", 15)
                .attr("y", -7.5)
                .attr("fill", colorScale(item.key));
            
            // 添加文本
            itemGroup.append("text")
                .attr("x", 20)
                .attr("y", 0)
                .attr("dominant-baseline", "middle")
                .style("font-size", legendFontSize)
                .text(item.key);
            
            // 更新偏移量
            xOffset += item.width + fixedSpacing;
        });
        
        // 增加顶部边距以容纳两行图例
        margin.top = 75;
        chartGroup.attr("transform", `translate(${margin.left}, ${margin.top})`);
    }

    return svg.node();
}