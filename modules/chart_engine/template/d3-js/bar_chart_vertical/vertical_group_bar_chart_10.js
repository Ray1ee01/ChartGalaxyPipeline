/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Group Bar Chart",
    "chart_name": "vertical_group_bar_chart_10",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 6], [0, 100], [3, 4]],
    "required_fields_icons": [],
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
    }
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 600;
    const height = variables.height || 400;
    
    // 设置边距
    const margin = {
        top: 50,
        right: 30,
        bottom: 80,
        left: 40
    };
    
    // 计算实际绘图区域大小
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列获取字段名
    const xField = dataColumns.find(col => col.role === "x")?.name || "period";
    const yField = dataColumns.find(col => col.role === "y")?.name || "value";
    const groupField = dataColumns.find(col => col.role === "group")?.name || "group";
    
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
    
    // 获取所有唯一的分组值
    const groups = Array.from(new Set(chartData.map(d => d[groupField])));
    
    // 处理数据，按照分组组织
    const processedData = chartData.reduce((acc, d) => {
        const category = d[xField];
        const group = d[groupField];
        const value = +d[yField];
        
        const existingCategory = acc.find(item => item.category === category);
        if (existingCategory) {
            existingCategory.groups[group] = value;
        } else {
            const newCategory = {
                category: category,
                groups: {}
            };
            newCategory.groups[group] = value;
            acc.push(newCategory);
        }
        return acc;
    }, []);

    // ---------- 5. 创建比例尺 ----------
    
    // X轴比例尺 - 使用分类数据
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, chartWidth])
        .padding(0.4);

    // 分组比例尺
    const groupScale = d3.scaleBand()
        .domain(groups)
        .range([0, xScale.bandwidth()])
        .padding(0);

    // Y轴比例尺 - 使用数值
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[yField])])
        .range([chartHeight, 0])
        .nice();

    // // 颜色比例尺
    // const colorScale = d3.scaleOrdinal()
    //     .domain(groups)
    //     .range(d3.schemeCategory10);

    // 确定标签的最大长度：
    let minXLabelRatio = 1.0;
    const maxXLabelWidth = xScale.bandwidth() * 1.03;

    chartData.forEach(d => {
        // x label
        const xLabelText = String(d[xField]);
        let currentWidth = getTextWidth(xLabelText);
        if (currentWidth > maxXLabelWidth) {
            minXLabelRatio = Math.min(minXLabelRatio, maxXLabelWidth / currentWidth);
        }
    });

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
    
    // 添加X轴
    const xAxis = d3.axisBottom(xScale)
        .tickSize(0); // 移除刻度线
    
    chartGroup.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis)
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("text-anchor", minXLabelRatio < 1.0 ? "end" : "middle")
        .attr("transform", minXLabelRatio < 1.0 ? "rotate(-45)" : "rotate(0)")
        .style("fill", colors.text_color);
    
    // 添加Y轴
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => formatValue(d) + (yUnit ? ` ${yUnit}` : ''))
        .tickSize(0)          // 移除刻度线
        .tickPadding(10);     // 增加文字和轴的间距
    
    chartGroup.append("g")
        .attr("class", "y-axis")
        .call(yAxis)
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", colors.text_color);
    
    // 修改条形图绘制部分
    const barGroups = chartGroup.selectAll(".bar-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${xScale(d.category)},0)`);

    groups.forEach(group => {
        barGroups.append("rect")
            .attr("class", "bar")
            .attr("x", d => groupScale(group))
            .attr("y", d => yScale(d.groups[group] || 0))
            .attr("width", groupScale.bandwidth()*1.5)
            .attr("height", d => chartHeight - yScale(d.groups[group] || 0))
            .attr("fill", colors.field[group]);

        // 为每个柱子添加椭圆形装饰
        barGroups.append("ellipse")
            .attr("class", "bar-top-ellipse")
            .attr("cx", d => groupScale(group) + groupScale.bandwidth()*1.5/2)
            .attr("cy", d => yScale(d.groups[group] || 0))
            .attr("rx", groupScale.bandwidth()*1.5/2)  // 与柱子同宽
            .attr("ry", 4)
            .attr("fill", d3.rgb(colors.other.secondary).brighter(0.5))
            .attr("stroke", "none");
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

    return svg.node();
}