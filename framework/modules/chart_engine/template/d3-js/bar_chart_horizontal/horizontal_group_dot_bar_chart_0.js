/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Group Dot Bar Chart",
    "chart_name": "horizontal_group_dot_bar_chart_0",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 6], [0, 100], [2, 5]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": [],
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
    
    // 数值格式化函数
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
    
    // Y轴比例尺 - 使用分类数据
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, chartHeight])
        .padding(0.2);

    // 分组比例尺
    const groupScale = d3.scaleBand()
        .domain(groups)
        .range([0, yScale.bandwidth()])
        .padding(0.05);

    // X轴比例尺 - 使用数值
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[yField])])
        .range([0, chartWidth])
        .nice();

    // 确定标签的最大长度：
    let minYLabelRatio = 1.0;
    const maxYLabelWidth = yScale.bandwidth() * 1.03;

    chartData.forEach(d => {
        // y label
        const yLabelText = String(d[yField]);
        let currentWidth = getTextWidth(yLabelText);
        if (currentWidth > maxYLabelWidth) {
            minYLabelRatio = Math.min(minYLabelRatio, maxYLabelWidth / currentWidth);
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
    
    // 添加defs用于定义裁剪路径
    const defs = svg.append("defs");
    
    // ---------- 7. 绘制图表元素 ----------
    
    // 添加Y轴
    const yAxis = d3.axisLeft(yScale)
        .tickSize(0); // 移除刻度线
    
    chartGroup.append("g")
        .attr("class", "y-axis")
        .call(yAxis)
        .selectAll("text")
        .remove();
    
    // 添加X轴
    /*
    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d => formatValue(d) + (xUnit ? ` ${xUnit}` : ''))
        .tickSize(0)          // 移除刻度线
        .tickPadding(10);     // 增加文字和轴的间距
    
    chartGroup.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove())  // 移除轴线
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", colors.text_color);
    */

    // 为每个分类创建条形组
    const barGroups = chartGroup.selectAll(".bar-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(0,${yScale(d.category)})`);

    // 计算每个柱子的配置参数
    const maxValue = d3.max(chartData, d => +d[yField]);
    
    // 设置点状图标的默认参数
    const defaultBarWidth = 30;  // 默认图标宽度
    const defaultBarSpacing = 5; // 默认图标间距
    const largerGroupSpacing = 10; // 每组图标间的额外间距
    
    // 每组的图标数量
    const groupSize = 5;
    
    // 添加维度标签（分类名称）
    barGroups.append("text")
        .attr("x", -10)
        .attr("y", yScale.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(d => d.category);

    // 为每个分组依次绘制点图
    groups.forEach(group => {
        barGroups.each(function(d) {
            const rowY = groupScale(group); // 当前分组在Y轴的位置
            const rowHeight = groupScale.bandwidth(); // 分组高度
            const value = d.groups[group] || 0; // 获取值，如果不存在则为0
            
            // 计算要显示多少个完整图标
            const barCount = Math.floor(value / maxValue * 20); // 将值映射到 0-20 个图标（根据需要调整）
            const partialBar = (value / maxValue * 20) - barCount; // 计算小数部分
            
            // 计算图标大小（根据分组宽度调整）
            const barHeight = rowHeight * 0.8; // 图标高度为行高的80%
            const barWidth = barHeight; // 图标宽度等于高度，保持比例
            const barY = rowY + (rowHeight - barHeight) / 2; // 垂直居中
            
            // 计算图标间距
            const barSpacing = Math.min(defaultBarSpacing, barWidth * 0.2);
            
            // 绘制完整图标
            for (let i = 0; i < barCount; i++) {
                // 计算当前图标所在的组
                const groupIndex = Math.floor(i / groupSize);
                // 计算在当前组内的索引
                const inGroupIndex = i % groupSize;
                
                // 计算X位置（考虑组间的额外间距）
                const barX = (groupIndex * (groupSize * (barWidth + barSpacing) + largerGroupSpacing)) + 
                           (inGroupIndex * (barWidth + barSpacing));
                
                // 绘制单个图标
                d3.select(this)
                    .append("image")
                    .attr("x", barX)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("xlink:href", jsonData.images.field[group]);
            }
            
            // 如果有小数部分，绘制部分宽度的最后一个图标
            if (partialBar > 0) {
                const groupIndex = Math.floor(barCount / groupSize);
                const inGroupIndex = barCount % groupSize;
                
                const barX = (groupIndex * (groupSize * (barWidth + barSpacing) + largerGroupSpacing)) + 
                           (inGroupIndex * (barWidth + barSpacing));
                
                // 使用SVG裁剪路径实现部分图标显示
                const imageWidth = barWidth * partialBar;
                
                // 创建唯一的裁剪路径ID（使用分类名称和分组名称确保唯一性）
                const clipPathId = `clip-path-${d.category.replace(/\s+/g, '-')}-${group.replace(/\s+/g, '-')}-${barCount}`;
                
                // 在defs中定义裁剪路径
                defs.append("clipPath")
                    .attr("id", clipPathId)
                    .attr("clipPathUnits", "userSpaceOnUse")  // 使用用户坐标系而非对象坐标系
                    .append("rect")
                    .attr("x", barX)  // 使用与图像相同的x坐标
                    .attr("y", barY)  // 使用与图像相同的y坐标
                    .attr("width", imageWidth)
                    .attr("height", barHeight);
                
                // 使用裁剪路径显示部分图标
                d3.select(this)
                    .append("image")
                    .attr("x", barX)
                    .attr("y", barY)
                    .attr("width", barWidth)  // 使用完整宽度
                    .attr("height", barHeight)
                    .attr("clip-path", `url(#${clipPathId})`)
                    .attr("xlink:href", jsonData.images.field[group]);
            }
            
            // 计算最后一个图标的位置，用于放置数值标签
            const lastGroupIndex = Math.floor(barCount / groupSize);
            const lastInGroupIndex = barCount % groupSize;
            let lastBarX = (lastGroupIndex * (groupSize * (barWidth + barSpacing) + largerGroupSpacing)) + 
                           (lastInGroupIndex * (barWidth + barSpacing));
            
            // 如果有小数部分，调整标签位置
            if (partialBar > 0) {
                lastBarX += barWidth * partialBar;
            } else if (barCount > 0) {
                lastBarX += barWidth;
            }
            
            // 添加数值标签
            d3.select(this)
                .append("text")
                .attr("x", lastBarX + 15)
                .attr("y", barY + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", typography.annotation.font_size)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color)
                .text(formatValue(value) + (yUnit ? ` ${yUnit}` : ''));
        });
    });

    return svg.node();
}