/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Group Dot Bar Chart",
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
    
    // ---------- 7. 绘制图表元素 ----------
    
    // 添加Y轴
    const yAxis = d3.axisLeft(yScale)
        .tickSize(0); // 移除刻度线
    
    chartGroup.append("g")
        .attr("class", "y-axis")
        .call(yAxis)
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("text-anchor", "end")
        .style("fill", colors.text_color);
    
    // 添加X轴
    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d => d + (xUnit ? ` ${xUnit}` : ''))
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

    // 修改条形图绘制部分
    const barGroups = chartGroup.selectAll(".bar-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(0,${yScale(d.category)})`);

    // 计算每个柱子的最大宽度
    const maxValue = d3.max(chartData, d => +d[yField]);
    const iconSize = groupScale.bandwidth() * 0.8; // icon大小为分组宽度的80%
    const iconSpacing = iconSize * 0.1; // icon之间的间距为icon大小的10%
    const maxIconsPerRow = Math.floor(chartWidth / (iconSize + iconSpacing)); // 计算每行最多可以放多少个icon

    groups.forEach(group => {
        barGroups.each(function(d) {
            const value = d.groups[group] || 0;
            const iconCount = Math.ceil(value / maxValue * 10); // 将值映射到0-10个icon
            const groupY = groupScale(group);
            
            // 计算需要多少行
            const rows = Math.ceil(iconCount / maxIconsPerRow);
            
            // 计算每行的高度
            const rowHeight = iconSize + iconSpacing;
            
            // 绘制icon
            for (let i = 0; i < iconCount; i++) {
                const row = Math.floor(i / maxIconsPerRow);
                const col = i % maxIconsPerRow;
                
                d3.select(this)
                    .append("image")
                    .attr("x", col * (iconSize + iconSpacing))
                    .attr("y", groupY + row * rowHeight)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("xlink:href", jsonData.images.field[group]);
            }
        });

        // 添加数值标签
        barGroups.append("text")
            .attr("class", "label")
            .attr("x", d => {
                const value = d.groups[group] || 0;
                const iconCount = Math.ceil(value / maxValue * 10);
                const cols = Math.min(iconCount, maxIconsPerRow);
                return cols * (iconSize + iconSpacing) + 5;
            })
            .attr("y", d => {
                const value = d.groups[group] || 0;
                const iconCount = Math.ceil(value / maxValue * 10);
                const rows = Math.ceil(iconCount / maxIconsPerRow);
                return groupScale(group) + (rows * (iconSize + iconSpacing)) / 2;
            })
            .attr("text-anchor", "start")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", colors.text_color)
            .text(d => (d.groups[group] || 0) + (xUnit ? ` ${xUnit}` : ''))
            .style("opacity", 1);
    });
    // // 添加图例 - 放在图表上方
    // const legendGroup = svg.append("g")
    //     .attr("transform", `translate(0, -50)`);
    
    // // 计算字段名宽度并添加间距
    // const titleWidth = groupField.length * 10;
    // const titleMargin = 15;


    // const legendSize = layoutLegend(legendGroup, groups, colors, {
    //     x: titleWidth + titleMargin,
    //     y: 0,
    //     fontSize: 14,
    //     fontWeight: "bold",
    //     align: "left",
    //     maxWidth: chartWidth - titleWidth - titleMargin,
    //     shape: "rect",
    // });


    return svg.node();
}