/* 
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_9",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 多彩水平条形图实现 - 带百分比延伸背景 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                           // 完整的JSON数据对象
    const chartData = jsonData.data.data                 // 实际数据点数组  
    const variables = jsonData.variables || {};      // 图表配置
    const typography = jsonData.typography || {      // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "14px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333",
        other: { primary: "#1E88E5" },  // 默认主色
        field: {}                       // 各维度颜色
    };  
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 设置延伸条形的颜色（浅蓝色）
    const extensionColor = "#e6f0fa";  // 浅蓝色背景
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    // 使用调整后的高度
    // const height = variables.height || 600;
    
    // 设置边距 - 后面会根据标签宽度调整左侧边距
    const margin = {
        top: 90,      // 顶部边距
        right: 60,    // 右侧边距，留足空间放置数值
        bottom: 60,   // 底部边距
        left: 120     // 左侧边距，初始值，将根据标签长度调整
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; // 默认为空
    
    if (dataColumns.find(col => col.role === "x").unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值并按数值降序排列数据
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    
    // 如果x维度数量超过15，每增加一个x，整个图像的高度增加3%
    const baseHeight = variables.height || 600;
    const adjustedHeight = dimensions.length > 15 
        ? baseHeight * (1 + (dimensions.length - 15) * 0.03) 
        : baseHeight;
    
    // 按数值降序排序数据
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);
    
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
    
    // ---------- 5. 测量标签宽度和调整布局 ----------
    
    // 创建临时SVG来测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    // Original code section for measuring label width and adjusting margin
    // Replace with this modified version:
    // 函数：测量文本宽度
    function getTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempText = tempSvg.append("text")
            .style("font-family", fontFamily)
            .style("font-size", fontSize)
            .style("font-weight", fontWeight)
            .text(text);
        
        const width = tempText.node().getBBox().width;
        tempText.remove();
        return width;
    }
    // 计算最大维度标签宽度
    let maxLabelWidth = 0;
    dimensions.forEach(dimension => {
        // 测量每个维度标签的宽度
        const textWidth = getTextWidth(
            dimension, 
            typography.label.font_family,
            typography.label.font_size,
            typography.label.font_weight
        );
        
        maxLabelWidth = Math.max(maxLabelWidth, textWidth);
    });

    // 限制最大标签宽度为200px
    maxLabelWidth = Math.min(maxLabelWidth, 200);

    // 调整左侧边距，确保有足够的空间显示标签
    margin.left = Math.max(margin.left, maxLabelWidth + 30);

    // 添加文本换行函数
    function wrapText(text, maxWidth, fontFamily, fontSize, fontWeight) {
        // 如果文本不需要换行，直接返回
        const textWidth = getTextWidth(text, fontFamily, fontSize, fontWeight);
        if (textWidth <= maxWidth) {
            return [text];
        }
        
        // 分割文本为词语数组
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = words[0];
        
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = getTextWidth(currentLine + " " + word, fontFamily, fontSize, fontWeight);
            
            if (width <= maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        
        // 添加最后一行
        lines.push(currentLine);
        
        // 如果没有空格分隔词（如中文），则按字符分割
        if (lines.length === 1 && getTextWidth(lines[0], fontFamily, fontSize, fontWeight) > maxWidth) {
            const chars = text.split('');
            lines.length = 0;
            currentLine = chars[0];
            
            for (let i = 1; i < chars.length; i++) {
                const char = chars[i];
                const width = getTextWidth(currentLine + char, fontFamily, fontSize, fontWeight);
                
                if (width <= maxWidth) {
                    currentLine += char;
                } else {
                    lines.push(currentLine);
                    currentLine = char;
                }
            }
            
            // 添加最后一行
            lines.push(currentLine);
        }
        
        return lines;
    }
    
    // 计算最大数值标签宽度
    let maxValueWidth = 0;
    chartData.forEach(d => {
        const formattedValue = valueUnit ? 
            `${formatValue(d[valueField])}${valueUnit}` : 
            `${formatValue(d[valueField])}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .text(formattedValue);
        
        const textWidth = tempText.node().getBBox().width;
        
        maxValueWidth = Math.max(maxValueWidth, textWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = adjustedHeight - margin.top - margin.bottom;
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", adjustedHeight)
        .attr("viewBox", `0 0 ${width} ${adjustedHeight}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 添加defs用于视觉效果
    const defs = svg.append("defs");
    
    // 添加阴影滤镜（如果启用）
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
    
    // ---------- 7. 创建比例尺 ----------
    
    // 计算条形的额外间距（如果启用）
    const barPadding = variables.has_spacing ? 0.3 : 0.2;
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（用于数值）- 0-100%
    const xScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, innerWidth]);
    
    // ---------- 8. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 9. 绘制延伸背景和条形 ----------
    
    // 为每个维度绘制条形
    dimensions.forEach((dimension, index) => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const barHeight = yScale.bandwidth();
            const value = +dataPoint[valueField];
            const barWidth = xScale(value);
            
            // 获取条形颜色 - 从colors.field中获取，如果不存在则使用默认主色
            let barColor = colors.other.primary;
            if (colors.field && colors.field[dimension]) {
                barColor = colors.field[dimension];
            }
            
            // 创建条形组
            const barGroup = g.append("g")
                .attr("transform", `translate(0, ${yScale(dimension)})`);
            
            // 绘制100%延伸背景
            barGroup.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", innerWidth)
                .attr("height", barHeight)
                .attr("class","background")
                .attr("fill", extensionColor)
                .attr("rx", variables.has_rounded_corners ? 4 : 0)
                .attr("ry", variables.has_rounded_corners ? 4 : 0);
            
            // 绘制实际数值条形
            barGroup.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", variables.has_gradient ? 
                    d3.interpolateRgb(barColor, d3.rgb(barColor).brighter(0.5))(0.5) : 
                    barColor)
                .attr("rx", variables.has_rounded_corners ? 4 : 0)
                .attr("ry", variables.has_rounded_corners ? 4 : 0)
                .style("stroke", variables.has_stroke ? d3.rgb(barColor).darker(0.2) : "none")
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            
            // 计算动态字体大小（条形高度的60%）
            const dynamicFontSize = `${barHeight * 0.4}px`;
            
            // 格式化数值用于显示（根据条形是否有足够空间决定显示位置）
            const formattedValue = valueUnit ? 
                `${formatValue(value)}${valueUnit}` : 
                `${formatValue(value)}`;
            
            // 创建临时文本测量数值标签宽度（使用动态字体大小）
            const tempValueText = svg.append("text")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", dynamicFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .text(formattedValue);
            
            const valueTextWidth = tempValueText.node().getBBox().width;
            tempValueText.remove();
            
            // 判断数值标签是否能放入条形内
            const labelFitsInside = valueTextWidth + 10 < barWidth;
            
            // 添加数值标签（使用动态字体大小）
            if (labelFitsInside) {
                // 标签放在条形内部左侧
                barGroup.append("text")
                    .attr("x", barWidth - 5) // 条形内左侧5px
                    .attr("y", barHeight / 2)
                    .attr("dy", "0.35em") // 垂直居中
                    .attr("text-anchor", "end")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", dynamicFontSize)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", "#FFFFFF") // 白色
                    .text(formattedValue);
            } else {
                // 标签放在条形外部左侧
                barGroup.append("text")
                    .attr("x", barWidth + 5) // 条形外左侧5px
                    .attr("y", barHeight / 2)
                    .attr("dy", "0.35em") // 垂直居中
                    .attr("text-anchor", "start")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", dynamicFontSize)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", colors.text_color || "#333333") // 使用文本颜色
                    .text(formattedValue);
            }
            
            
            
            const wrappedText = wrapText(
                dimension,
                maxLabelWidth,
                typography.label.font_family,
                typography.label.font_size,
                typography.label.font_weight
            );
            
            // 计算行高
            const lineHeight = parseInt(typography.label.font_size) * 1.2;
            
            // 计算文本总高度
            const textHeight = wrappedText.length * lineHeight;
            
            // 创建文本组
            const labelGroup = barGroup.append("g")
                .attr("transform", `translate(${-maxLabelWidth - 10}, ${barHeight / 2 - textHeight / 2 + lineHeight / 2})`);
            
            // 添加每一行文本
            wrappedText.forEach((line, i) => {
                labelGroup.append("text")
                    .attr("x", 0)
                    .attr("y", i * lineHeight)
                    .attr("text-anchor", "start")
                    .style("font-family", typography.label.font_family)
                    .style("font-size", typography.label.font_size)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", colors.text_color || "#333333")
                    .text(line);
            });
        }
    });
    
    
    
    // 返回SVG节点
    return svg.node();
}