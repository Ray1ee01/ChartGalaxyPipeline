/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Bar Chart",
    "chart_name": "vertical_bar_chart_16",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 12], [0, 100]],
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
    
    // 数值单位规范
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
    
    // 辅助函数 - 用于估算文本宽度
    function getTextWidth(text, fontFamily = typography.label.font_family, fontSize = typography.label.font_size) {
        // 创建临时元素来测量文本宽度
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${fontSize} ${fontFamily}`;
        const metrics = context.measureText(text);
        
        // 如果浏览器支持，则直接返回测量宽度
        if (metrics && metrics.width) {
            return metrics.width;
        }
        
        // 备用方案 - 简单估算（每个字符约为fontSize的0.6倍宽度）
        fontSize = parseInt(fontSize, 10) || 14;
        return text.length * fontSize * 0.6;
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
        console.log(i)
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
    
    // 创建渐变定义
    const defs = svg.append("defs");
    
    // 为每个柱子创建独立的渐变
    processedData.forEach((d, i) => {
        // 使用金色系调色板
        let baseColor;
        if (i === 0) {
            // 第一个柱子使用深一点的金色
            baseColor = d3.rgb("#D4AF37");  // 金色
        } else {
            // 从金色到浅金色的变化
            const goldColors = [
                "#D4AF37",  // 金色
                "#CFB53B",  // 旧金色
                "#E6BE8A",  // 香槟金
                "#F7E98E",  // 浅金色
                "#FFDF00",  // 金黄色
                "#B8860B",  // 暗金色
                "#DAA520",  // 金菊色
                "#FFD700",  // 纯金色
                "#FFC125"   // 深黄金色
            ];
            
            // 在数组范围内循环选择颜色
            baseColor = d3.rgb(goldColors[i % goldColors.length]);
        }
        
        // 创建金属光泽渐变ID
        const gradientId = `metalGradient-${i}`;
        
        // 创建线性渐变 - 从中间向两侧渐变
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
        
        // 金色金属光泽效果 - 更复杂的渐变
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", baseColor.darker(1.5))
            .attr("stop-opacity", 1);
            
        gradient.append("stop")
            .attr("offset", "15%")
            .attr("stop-color", baseColor.darker(0.5))
            .attr("stop-opacity", 1);
            
        gradient.append("stop")
            .attr("offset", "40%")
            .attr("stop-color", baseColor.brighter(1.8))
            .attr("stop-opacity", 1);
            
        gradient.append("stop")
            .attr("offset", "50%")
            .attr("stop-color", baseColor.brighter(2.0))
            .attr("stop-opacity", 1);
            
        gradient.append("stop")
            .attr("offset", "60%")
            .attr("stop-color", baseColor.brighter(1.8))
            .attr("stop-opacity", 1);
            
        gradient.append("stop")
            .attr("offset", "85%")
            .attr("stop-color", baseColor.darker(0.5))
            .attr("stop-opacity", 1);
            
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", baseColor.darker(1.5))
            .attr("stop-opacity", 1);

        // 创建第二个渐变用于3D立体效果
        const gradientId3D = `metalGradient3D-${i}`;
        const gradient3D = defs.append("linearGradient")
            .attr("id", gradientId3D)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");
            
        gradient3D.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "rgba(255, 255, 255, 0.7)")
            .attr("stop-opacity", 0.7);
            
        gradient3D.append("stop")
            .attr("offset", "10%")
            .attr("stop-color", "rgba(255, 255, 255, 0.2)")
            .attr("stop-opacity", 0.2);
            
        gradient3D.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "rgba(0, 0, 0, 0.05)")
            .attr("stop-opacity", 0.05);
        
        // 添加纹理效果的渐变
        const textureId = `goldTexture-${i}`;
        const textureGradient = defs.append("linearGradient")
            .attr("id", textureId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "100%");
            
        // 添加细微的纹理变化
        for (let j = 0; j < 10; j++) {
            const offset = j * 10 + "%";
            const opacity = 0.1 + Math.random() * 0.05; // 轻微随机变化
            
            textureGradient.append("stop")
                .attr("offset", offset)
                .attr("stop-color", j % 2 === 0 ? "#FFFFFF" : "#000000")
                .attr("stop-opacity", opacity);
        }
    });
    
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
        .call(g => g.select(".domain").remove())  // 移除轴线
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", colors.text_color);
    
    // 添加条形
    const bars = chartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => chartHeight - yScale(d.value))
        .attr("fill", (d, i) => `url(#metalGradient-${i})`)
        .attr("stroke", (d, i) => {
            // 深金色边框
            return d3.rgb("#B8860B").darker(0.5);
        })
        .attr("stroke-width", 1)
        .attr("rx", 3) // 增加圆角
        .attr("ry", 3);
        
    // 添加柱顶倒影效果 - 较浅的光线效果
    chartGroup.selectAll(".bar-top-reflection")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "bar-top-reflection")
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", 2)
        .attr("fill", "rgba(255, 255, 255, 0.8)")
        .attr("rx", 3)
        .attr("ry", 3);

    // 增强3D效果 - 添加顶部高光
    chartGroup.selectAll(".bar-top-highlight")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "bar-top-highlight")
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => Math.min(15, (chartHeight - yScale(d.value)) * 0.15))
        .attr("fill", (d, i) => `url(#metalGradient3D-${i})`)
        .attr("rx", 3)
        .attr("ry", 3)
        .attr("opacity", 0.7);

    // 添加纹理层 - 为金属添加一些细微的纹理
    chartGroup.selectAll(".bar-texture")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "bar-texture")
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => chartHeight - yScale(d.value))
        .attr("fill", (d, i) => `url(#goldTexture-${i})`)
        .attr("opacity", 0.05)
        .attr("rx", 3)
        .attr("ry", 3);

    // 添加侧边高光效果 - 模拟光源从左侧照射
    chartGroup.selectAll(".bar-side-highlight")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "bar-side-highlight")
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(d.value) + 3)
        .attr("width", xScale.bandwidth() * 0.15)
        .attr("height", d => chartHeight - yScale(d.value) - 6)
        .attr("fill", "rgba(255, 255, 255, 0.25)")
        .attr("opacity", 0.4);

    // 添加右侧阴影效果 - 模拟光源从左侧照射
    chartGroup.selectAll(".bar-shadow")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "bar-shadow")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() * 0.85)
        .attr("y", d => yScale(d.value) + 3)
        .attr("width", xScale.bandwidth() * 0.15)
        .attr("height", d => chartHeight - yScale(d.value) - 6)
        .attr("fill", "rgba(0, 0, 0, 0.15)")
        .attr("opacity", 0.5);
    
    // 添加数值标签
    const labels = chartGroup.selectAll(".label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5)
        .attr("text-anchor", "middle")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", colors.text_color)
        .text(d => formatValue(d.value) + (yUnit ? ` ${yUnit}` : ''))
        .style("opacity", 1); // 直接设置为可见
    

    return svg.node();
}