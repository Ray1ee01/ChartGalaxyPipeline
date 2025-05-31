/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Bar Chart",
    "chart_name": "vertical_bar_chart_07_2",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 20], [0, 100]],
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
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", colors.text_color);
    

    // 添加条形
    const bars = chartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    const barWidth = xScale.bandwidth();

    // 添加主柱体
    bars.append("rect")
        .attr("class", "main-bar")
        .attr("x", 0)
        .attr("y", d => yScale(d.value))
        .attr("width", barWidth)
        .attr("height", d => chartHeight - yScale(d.value))
        .attr("fill", (d, i) => colorScale(d, i));

    // 添加斜向延伸部分
    const extensionHeight = 120; // 斜向延伸的高度
    const midIndex = Math.floor(processedData.length / 2); // 中间柱子的索引
    const offsetStep = 30; // 左右柱子每相邻一列，向左右偏移的像素数

    // 给每项数据增加偏移量
    processedData.forEach((d, i) => {
        d.offset = (i - midIndex) * offsetStep;
    });

    // 添加斜向延伸路径
    bars.append("path")
        .attr("class", "extended-path")
        .attr("d", d => {
            // 主柱底部两个点
            const topLeftX = 0;
            const topLeftY = chartHeight;
            const topRightX = barWidth;
            const topRightY = chartHeight;
            // 底部两个点：在 chartHeight + extensionHeight 上，再加上水平方向 offset
            const bottomRightX = barWidth + d.offset;
            const bottomRightY = chartHeight + extensionHeight;
            const bottomLeftX = 0 + d.offset;
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
    
    // 沿线条添加文本
    bars.append("text")
        .attr("class", "line-text")
        .attr("dy", -3) // 文本垂直偏移
        .attr("text-anchor", "middle")
        .style("fill", "#fff")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .text(d => d.category)
        .attr("transform", d => {
            // 计算线条靠近起点的位置（从顶部往下约1/3处）
            const posX = barWidth / 2 + d.offset / 3;
            const posY = chartHeight + extensionHeight / 3;
            // 计算文本旋转角度
            let textAngle = -(Math.atan2(d.offset, extensionHeight) * (180 / Math.PI) - 90);
            if (textAngle > 90){
                textAngle = textAngle + 180
            }
            console.log(d.category)
            console.log(textAngle)
            return `translate(${posX}, ${posY}) rotate(${textAngle})`;
        });


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


    // 创建线性渐变定义
    const gradient = chartGroup.append("defs")
        .append("linearGradient")
        .attr("id", "intersection-gradient")
        .attr("x1", "50%")
        .attr("y1", "100%")
        .attr("x2", "50%")
        .attr("y2", "0%");
    
    // 添加渐变色标
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#000")
        .attr("stop-opacity", 0);
        
    gradient.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", "#000")
        .attr("stop-opacity", 0.5);
        
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#000")
        .attr("stop-opacity", 0);
    
    // 添加使用渐变的矩形
    chartGroup.append("rect")
        .attr("class", "intersection-line")
        .attr("x", 0)
        .attr("y", chartHeight-20)
        .attr("width", chartWidth)
        .attr("height", 40)
        .attr("fill", "url(#intersection-gradient)")
    
    return svg.node();
}