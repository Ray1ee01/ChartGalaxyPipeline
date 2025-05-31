/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Bar Chart",
    "chart_name": "vertical_bar_chart_08_2",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 20], [0, 100]],
    "required_fields_icons": ["x"],
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

    
    // ---------- 4. 数据处理 ----------
    
    // 处理数据，确保数据格式正确
    const processedData = chartData.map(d => ({
        category: d[xField],
        value: +d[yField] // 确保转换为数字
    }));
    // ---------- 5. 创建比例尺 ----------
    
    // X轴比例尺 - 使用分类数据
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, chartWidth])
        .padding(0.3);
    
    // Y轴比例尺 - 使用数值
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value)])
        .range([chartHeight, 0])
        .nice();

    // 颜色比例尺
    const colorScale = (d, i) => {
        if (i === 0) {
            // 第一个柱子使用更深的颜色
            return d3.rgb(colors.other.primary).darker(0.7);
        }
        // 其他柱子使用primary颜色
        return colors.other.primary;
    };


    // 确定标签的最大长度：
    let minXLabelRatio = 1.0
    const maxXLabelWidth = xScale.bandwidth() * 1.03

    chartData.forEach(d => {
        // x label
        const xLabelText = String(d[xField])
        let currentWidth = getTextWidth(xLabelText)
        if (currentWidth > maxXLabelWidth) {
            minXLabelRatio = Math.min(minXLabelRatio, maxXLabelWidth / currentWidth)
        }
    })

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
        .call(g => g.select(".domain").remove())  // 移除轴线
        .selectAll("text")
        .remove();
    
    // 添加Y轴
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => d + (yUnit ? ` ${yUnit}` : ''))
        .tickSize(0)          // 移除刻度线
        .tickPadding(10);     // 增加文字和轴的间距
    
    chartGroup.append("g")
        .attr("class", "y-axis")
        .call(yAxis)
        .call(g => g.select(".domain").remove())  // 移除轴线
        .selectAll("text")
        .remove();
    

    // 添加条形
    const bars = chartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    const barWidth = xScale.bandwidth();

    // 设置延伸部分的参数
    const extensionHeight = 100; // 斜向延伸的高度
    const midIndex = Math.floor(processedData.length / 2); // 中间柱子的索引
    const offsetStep = 50; // 左右柱子每相邻一列，向左右偏移的像素数

    // 给每项数据增加偏移量
    processedData.forEach((d, i) => {
        d.offset = (i - midIndex) * offsetStep;
    });

    // 添加主柱体
    bars.append("rect")
        .attr("class", "main-bar")
        .attr("x", 0)
        .attr("y", d => yScale(d.value))
        .attr("width", barWidth)
        .attr("height", d => chartHeight - yScale(d.value))
        .attr("fill", (d, i) => colorScale(d, i));

    // Add vertical dashed line in the middle of each main bar
    bars.append("line")
        .attr("class", "main-bar-center-line")
        .attr("x1", barWidth / 2)
        .attr("y1", d => yScale(d.value))
        .attr("x2", barWidth / 2)
        .attr("y2", chartHeight)
        .attr("stroke", "#fff") // White color for the line
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.7)
        .attr("stroke-dasharray", "3,3"); // Dashed line style

    // 添加斜向延伸部分
    bars.append("path")
        .attr("class", "extended-path")
        .attr("d", d => {
            // 主柱底部两个点
            const topLeftX = 0;
            const topLeftY = chartHeight;
            const topRightX = barWidth;
            const topRightY = chartHeight;
            
            // 计算底部两个点，保持与主体bar chart相同的间距
            // 使用xScale.padding()的值来确定间距比例
            const padding = xScale.padding();
            const totalWidth = xScale.bandwidth() * (1 + padding)
            const paddingWidth = totalWidth * padding
            // 计算底部宽度，适当放宽（减小padding效果）
            const bottomPadding = padding; // 减小padding效果，放宽间距
            const bottomWidth = totalWidth + offsetStep - paddingWidth;
            
            // 底部两个点：在 chartHeight + extensionHeight 上，再加上水平方向 offset
            const bottomRightX = topRightX + (bottomWidth - barWidth) / 2 + d.offset;
            const bottomRightY = chartHeight + extensionHeight;
            const bottomLeftX = topLeftX - (bottomWidth - barWidth) / 2 + d.offset;
            const bottomLeftY = chartHeight + extensionHeight;

            return `
                M ${topLeftX},${topLeftY}
                L ${topRightX},${topRightY}
                L ${bottomRightX},${bottomRightY}
                L ${bottomLeftX},${bottomLeftY}
                Z
            `;
        })
        .attr("fill", (d, i) => colorScale(d, i))
        .attr("opacity", 0.8);
        
    // 添加底部矩形
    bars.append("rect")
        .attr("class", "bottom-rect")
        .attr("x", d => {
            const padding = xScale.padding();
            const totalWidth = xScale.bandwidth() * (1 + padding);
            const paddingWidth = totalWidth * padding;
            const bottomWidth = totalWidth + offsetStep - paddingWidth;
            return -((bottomWidth - barWidth) / 2) + d.offset;
        })
        .attr("y", chartHeight + extensionHeight)
        .attr("width", d => {
            const padding = xScale.padding();
            const totalWidth = xScale.bandwidth() * (1 + padding);
            const paddingWidth = totalWidth * padding;
            return totalWidth + offsetStep - paddingWidth;
        })
        .attr("height", 50) // 底部矩形的高度
        .attr("fill", (d, i) => colorScale(d, i))
        .attr("opacity", 0.9);

    // 添加渐变线条
    bars.append("path")
        .attr("class", "gradient-line")
        .attr("d", d => {
            // 计算斜向延伸的角度
            const angle = Math.atan2(d.offset, extensionHeight);
            // 计算线条的起点和终点
            const topX = barWidth / 2;
            const topY = chartHeight;
            const bottomX = topX + d.offset;
            const bottomY = topY + extensionHeight;

            return `
                M ${topX},${topY}
                L ${bottomX},${bottomY}
            `;
        })
        .attr("stroke", "#000")
        .attr("stroke-width", 1.5)
        .attr("stroke-linecap", "round")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-dasharray", "5,5"); // 添加虚线效果
    
    // 添加柱体顶部标签
    bars.append("rect")
        .attr("x", barWidth / 2 - 20)
        .attr("y", d => yScale(d.value) - 35)
        .attr("width", 40)
        .attr("height", 20)
        .attr("fill", (d, i) => colorScale(d, i))
        .attr("rx", 4)
        .attr("ry", 4);

    bars.append("text")
        .attr("class", "bar-top-label")
        .attr("x", barWidth / 2)
        .attr("y", d => yScale(d.value) - 22)
        .style("fill", "#fff")
        .style("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .style("font-weight", "bold")
        .text(d => `${d.value}${yUnit ? ` ${yUnit}` : ''}`);

    // 在底部矩形中添加文本
    bars.append("text")
        .attr("class", "bottom-text")
        .attr("x", d => {
            const padding = xScale.padding();
            const totalWidth = xScale.bandwidth() * (1 + padding);
            const paddingWidth = totalWidth * padding;
            const bottomWidth = totalWidth + offsetStep - paddingWidth;
            return -((bottomWidth - barWidth) / 2) + d.offset + (bottomWidth / 2);
        })
        .attr("y", chartHeight + extensionHeight + 25)
        .style("fill", "#fff")
        .style("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .style("font-weight", "bold")
        .each(function(d) {
            const text = d3.select(this);
            const textContent = d.category;
            const maxWidth = d => {
                const padding = xScale.padding();
                const totalWidth = xScale.bandwidth() * (1 + padding);
                const paddingWidth = totalWidth * padding;
                return totalWidth + offsetStep - paddingWidth - 10; // 减去10px的边距
            };

            // 计算文本宽度
            const availableWidth = maxWidth(d);
            let fontSize = 12; // 初始字体大小
            let textWidth = getTextWidth(textContent, `${fontSize}px Arial`);

            // 如果文本宽度超过可用宽度，逐步减小字体大小
            while (textWidth > availableWidth && fontSize > 8) {
                fontSize -= 1;
                textWidth = getTextWidth(textContent, `${fontSize}px Arial`);
            }

            // 设置最终的字体大小和文本内容
            text.style("font-size", `${fontSize}px`)
                .text(textContent);
        });

    // ---------- 8. 创建专门的图标组，确保图标在最顶层 ----------
    
    // 创建图标组，这个组会在所有其他元素之上
    const iconsGroup = svg.append("g")
        .attr("class", "icons")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 在图标组中添加所有图标
    const iconElements = iconsGroup.selectAll(".bottom-icon")
        .data(processedData)
        .enter()
        .append("image")
        .attr("class", "bottom-icon")
        .attr("x", d => {
            const padding = xScale.padding();
            const totalWidth = xScale.bandwidth() * (1 + padding);
            const paddingWidth = totalWidth * padding;
            const bottomWidth = totalWidth + offsetStep - paddingWidth;
            return xScale(d.category) - ((bottomWidth - barWidth) / 2) + d.offset;
        })
        .attr("y", d => {
            const padding = xScale.padding();
            const totalWidth = xScale.bandwidth() * (1 + padding);
            const paddingWidth = totalWidth * padding;
            return chartHeight + extensionHeight - (totalWidth + offsetStep - paddingWidth); 
        })
        .attr("width", d => {
            const padding = xScale.padding();
            const totalWidth = xScale.bandwidth() * (1 + padding);
            const paddingWidth = totalWidth * padding;
            return totalWidth + offsetStep - paddingWidth;
        })
        .attr("height", d => {
            const padding = xScale.padding();
            const totalWidth = xScale.bandwidth() * (1 + padding);
            const paddingWidth = totalWidth * padding;
            return totalWidth + offsetStep - paddingWidth;
        })
        .attr("opacity", 1) // 设置为完全不透明
        .attr("preserveAspectRatio", "xMidYMid meet") // 保持图标比例
        .attr("xlink:href", d => jsonData.images.field[d.category]);

    return svg.node();
}