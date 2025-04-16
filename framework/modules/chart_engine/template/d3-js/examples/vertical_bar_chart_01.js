/*
REQUIREMENTS_BEGIN
{
    "chart_type": "vertical_bar_chart",
    "chart_name": "vertical_bar_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 使用D3.js创建简单的垂直条形图
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data || [];          // 图表数据
    const variables = jsonData.variables || {};     // 图表配置
    const typography = jsonData.typography || {     // 字体设置
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333", 
        other: { primary: "#73D2C7", secondary: "#4682B4" } 
    };
    const images = jsonData.images || { field: {}, other: {} };  // 图片(标志等)
    const dataColumns = jsonData.data.columns || [];            // 数据列
    
    // 设置视觉效果变量
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表尺寸和边距
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 边距: 上, 右, 下, 左
    const margin = { 
        top: 60,         // 柱子上方数值标签的空间
        right: 30, 
        bottom: 150,     // x轴和图标的空间
        left: 60
    };
    
    // 计算实际图表区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 3. 提取字段名称和单位 ----------
    
    let xField, yField;
    let xUnit = "", yUnit = "";
    
    // 安全提取字段名称
    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    
    if (xColumn) xField = xColumn.name;
    if (yColumn) yField = yColumn.name;
    
    // 获取字段单位(如果存在)
    if (xColumn && xColumn.unit && xColumn.unit !== "none") {
        xUnit = xColumn.unit;
    }
    
    if (yColumn && yColumn.unit && yColumn.unit !== "none") {
        yUnit = yColumn.unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一的x轴值
    const xValues = [...new Set(chartData.map(d => d[xField]))];
    
    // 创建按y值降序排序的数据
    const sortedData = chartData.map(d => ({
        x: d[xField],
        y: d[yField]
    })).sort((a, b) => b.y - a.y);
    
    // ---------- 5. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    
    
    // ---------- 6. 创建视觉效果 ----------
    
    const defs = svg.append("defs");
    
    // 获取颜色函数
    const getColor = () => colors.other.primary;
    
    // 如果需要创建阴影滤镜
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("width", "200%")
            .attr("height", "200%");
        
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 3);
        
        filter.append("feOffset")
            .attr("dx", 2)
            .attr("dy", 2)
            .attr("result", "offsetblur");
        
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // 如果需要创建渐变
    if (variables.has_gradient) {
        sortedData.forEach((item, idx) => {
            // 添加安全的ID处理
            const safeCategory = typeof item.x === 'string' ? 
                item.x.toString().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : 
                `category-${idx}`;
            
            const baseColor = getColor();
            const gradientId = `gradient-${safeCategory}`;
            
            const gradient = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0%")
                .attr("y1", "100%")
                .attr("x2", "0%")
                .attr("y2", "0%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(baseColor).darker(0.1));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(baseColor).brighter(0.1));
        });
    }
    
    // 计算动态文本大小函数
    const calculateFontSize = (text, maxWidth, baseSize = 14) => {
        // 估算平均字符宽度(假设为基础大小的60%)
        const avgCharWidth = baseSize * 0.6;
        // 计算估计的文本宽度
        const textWidth = text.length * avgCharWidth;
        // 如果文本宽度小于最大宽度，返回基础大小
        if (textWidth < maxWidth) {
            return baseSize;
        }
        // 如果文本宽度超过最大宽度的两倍，则不显示
        if (textWidth > maxWidth * 2) {
            return 0; // 表示不显示文本
        }
        // 否则，按比例缩放字体大小
        return Math.max(8, Math.floor(baseSize * (maxWidth / textWidth)));
    };
    
    // ---------- 7. 创建图表 ----------
    
    // 创建图表组
    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 创建比例尺
    const xScale = d3.scaleBand()
        .domain(sortedData.map(d => d.x))
        .range([0, innerWidth])
        .padding(variables.has_spacing ? 0.4 : 0.2);
    
    const yMax = d3.max(sortedData, d => d.y);
    const yScale = d3.scaleLinear()
        .domain([0, yMax * 1.1]) // 添加10%的填充
        .range([innerHeight, 0]);
    
    // 没有水平网格线
    
    
    
    // 添加延伸到图标的柱子
    chart.selectAll(".bar")
        .data(sortedData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.x))
        .attr("y", d => yScale(d.y))
        .attr("width", xScale.bandwidth())
        .attr("height", d => innerHeight + 75 - yScale(d.y)) // 延伸到图标
        .attr("fill", d => {
            if (variables.has_gradient) {
                const safeCategory = typeof d.x === 'string' ? 
                    d.x.toString().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : 
                    `category-${sortedData.indexOf(d)}`;
                return `url(#gradient-${safeCategory})`;
            } 
            return getColor();
        })
        .attr("rx", variables.has_rounded_corners ? 4 : 0)
        .attr("ry", variables.has_rounded_corners ? 4 : 0)
        .style("stroke", variables.has_stroke ? "#333" : "none")
        .style("stroke-width", variables.has_stroke ? 1 : 0)
        .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
        .on("mouseover", function() {
            d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
        });
    // 添加波浪形背景到图表 - 添加在柱状图之后，但在文本和图标之前
    function createWavePattern(width, height, amplitude, frequency) {
        let path = `M0,${height} `;
        
        // 创建顶部波浪边缘
        for (let x = 0; x <= width; x += width/frequency) {
            const y = amplitude * Math.sin((x / width) * Math.PI * frequency);
            path += `L${x},${height/4 + y} `; // 使波浪线更高，进入柱状图区域
        }
        
        // 完成路径回到起点
        path += `L${width},${height} L0,${height} Z`;
        
        return path;
    }
    
    // // 添加波浪形背景到图表
    // const waveBackground = svg.append("path")
    //     .attr("d", createWavePattern(width, 180, 8, 20))
    //     .attr("transform", `translate(0, ${height-180})`)
    //     .attr("fill", "#4d627f")
    //     .attr("class","background")
    //     .attr("opacity", 0.9);

    // 在柱子上方添加数值标签
    chart.selectAll(".value-label")
        .data(sortedData)
        .enter()
        .append("text")
        .attr("class", "value-label")
        .attr("x", d => xScale(d.x) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.y) - 10)
        .attr("text-anchor", "middle")
        .style("font-family", typography.annotation.font_family)
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", colors.text_color)
        .text(d => d.y > 0 ? `+${d.y.toFixed(1)}` : d.y.toFixed(1));
    
    // 在维度标签上方添加水平线
    chart.append("line")
        .attr("x1", 0)
        .attr("y1", innerHeight + 20) // 直接位于维度标签上方的位置
        .attr("x2", innerWidth)
        .attr("y2", innerHeight + 20)
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 1);
    
    // 添加维度标签(带动态大小调整)
    chart.selectAll(".dimension-label")
        .data(sortedData)
        .enter()
        .append("text")
        .attr("class", "dimension-label")
        .attr("x", d => xScale(d.x) + xScale.bandwidth() / 2)
        .attr("y", innerHeight + 35) // 位于图标上方的位置
        .attr("text-anchor", "middle")
        .style("font-family", typography.label.font_family)
        .style("font-weight", "bold")
        .style("fill", "#ffffff") // 白色
        .each(function(d) {
            const fontSize = calculateFontSize(d.x, xScale.bandwidth(), 12);
            if (fontSize > 0) {
                d3.select(this)
                    .style("font-size", `${fontSize}px`)
                    .text(d.x);
            }
        });
    
    // 添加圆形图标(仅轮廓无填充)
    chart.selectAll(".icon-circle")
        .data(sortedData)
        .enter()
        .append("g")
        .attr("class", "icon-circle")
        .attr("transform", d => `translate(${xScale(d.x) + xScale.bandwidth() / 2}, ${innerHeight + 55})`)
        .each(function(d) {
            // 添加圆形轮廓
            d3.select(this)
                .append("circle")
                .attr("r", 15)
                .attr("fill", "none") // 无填充
                .attr("stroke", "#2D3748") // 更深灰色的描边
                .attr("stroke-width", 0.1);
            
            // 如果有该类别的图像
            if (images && images.field && images.field[d.x]) {
                d3.select(this)
                    .append("image")
                    .attr("xlink:href", images.field[d.x])
                    .attr("x", -12)
                    .attr("y", -12)
                    .attr("width", 24)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("height", 24);
            }
        });
    
    
    // 返回SVG节点
    return svg.node();
}