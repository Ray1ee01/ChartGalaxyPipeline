/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_33",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 600,
    "background": "none",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 水平条形图实现 - 使用D3.js  Horizontal Bar Chart  plain chart#3  bar顶端三角
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                           // 完整的JSON数据对象
    const chartData = jsonData.data.data;                 // 实际数据点数组  
    const variables = jsonData.variables || {};      // 图表配置
    const typography = jsonData.typography || {      // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置
    const images = jsonData.images || { field: {}, other: {} };   // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距
    const margin = {
        top: 60,      // 顶部留出标题空间
        right: 60,    // 右侧足够显示数值
        bottom: 30,   // 底部边距
        left: 150     // 左侧初始空间，用于维度标签和图标
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    const dimensionField = dataColumns.length > 0 ? dataColumns[0].name : "dimension";
    const valueField = dataColumns.length > 1 ? dataColumns[1].name : "value";
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; 
    
    if (dataColumns.length > 0 && dataColumns[0].unit && dataColumns[0].unit !== "none") {
        dimensionUnit = dataColumns[0].unit;
    }
    
    if (dataColumns.length > 1 && dataColumns[1].unit && dataColumns[1].unit !== "none") {
        valueUnit = dataColumns[1].unit;
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
    
    // ---------- 5. 计算标签宽度 ----------
    
    // 创建临时SVG来测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 图标尺寸
    const defaultFlagWidth = 48;
    const defaultFlagHeight = 48;
    const flagPadding = 0;
    
    // 计算最大维度标签宽度
    let maxLabelWidth = 0;
    dimensions.forEach(dimension => {
        // 格式化维度名称（附加单位，如果有）
        const formattedDimension = dimensionUnit ? 
            `${dimension}${dimensionUnit}` : 
            `${dimension}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
        
        const textWidth = tempText.node().getBBox().width;
        const totalWidth = defaultFlagWidth + flagPadding + textWidth;
        
        maxLabelWidth = Math.max(maxLabelWidth, totalWidth);
        
        tempText.remove();
    });
    
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
    
    // 根据标签宽度调整左边距（添加一些边距）
    margin.left = Math.max(margin.left, maxLabelWidth + 20);
    margin.right = Math.max(margin.right, maxValueWidth + 20);
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
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
    
    // 添加渐变（如果启用）
    if (variables.has_gradient) {
        const primaryColor = colors.other.primary || "#882e2e";
        
        const gradient = defs.append("linearGradient")
            .attr("id", "bar-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
        
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(primaryColor).brighter(0.5));
        
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(primaryColor).darker(0.3));
    }
    
    // ---------- 7. 创建比例尺 ----------
    
    // 计算条形的额外间距（如果启用）
    const barPadding = variables.has_spacing ? 0.3 : 0.2;
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（用于数值）
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField]) * 1.05]) // 添加5%边距
        .range([0, innerWidth]);

    let flagWidth = Math.min(defaultFlagWidth, yScale.bandwidth() - 10);
    let flagHeight = Math.min(defaultFlagHeight, yScale.bandwidth() - 10);
    
    // ---------- 8. 添加标题和副标题 ----------
    
    // 添加标题（如果有）
    if (variables.title && variables.title.text) {
        svg.append("text")
            .attr("x", margin.left)
            .attr("y", margin.top / 2)
            .attr("text-anchor", "start")
            .style("font-family", typography.title.font_family)
            .style("font-size", typography.title.font_size)
            .style("font-weight", typography.title.font_weight)
            .style("fill", colors.text_color)
            .text(variables.title.text);
    }
    
    // 添加副标题（如果有）
    if (variables.subtitle && variables.subtitle.text) {
        svg.append("text")
            .attr("x", margin.left)
            .attr("y", margin.top / 2 + 20)
            .attr("text-anchor", "start")
            .style("font-family", typography.description.font_family)
            .style("font-size", typography.description.font_size)
            .style("font-weight", typography.description.font_weight)
            .style("fill", colors.text_color)
            .text(variables.subtitle.text);
    }
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 10. 绘制条形和标签 ----------
    
    // 获取条形颜色的辅助函数
    // 获取条形颜色的辅助函数
    const getBarColor = () => {
        return colors.other.primary || "#882e2e"; // 默认暗红色
    };

    
    // 获取描边颜色的辅助函数
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333";
    };
    
    // 添加交替行背景（如果需要）
    if (jsonData.variation?.background === "styled") {
        sortedDimensions.forEach((dimension, i) => {
            if (i % 2 === 0) {
                g.append("rect")
                    .attr("x", -margin.left/2)
                    .attr("y", yScale(dimension))
                    .attr("width", innerWidth + margin.left/2 + margin.right/2)
                    .attr("height", yScale.bandwidth())
                    .attr("class","background")
                    .attr("fill", colors.background_color || "#f5f5f5")
                    .attr("opacity", 0.8);
            }
        });
    }
    
    // 为每个维度绘制条形和标签
    sortedDimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const barHeight = yScale.bandwidth();
            const barWidth = xScale(+dataPoint[valueField]);
            
            // 绘制带三角形尾部的条形
            if (barWidth > 0) { // 仅当宽度大于0时绘制
                // 三角形的宽度，设置为条形图高度，但最小10px，最大30px
                const triangleWidth = Math.min(30, Math.max(10, barHeight));
                // 确保三角形宽度不超过总宽度
                const actualTriangleWidth = Math.min(triangleWidth, barWidth);
                // 矩形部分的宽度
                const rectWidth = barWidth - actualTriangleWidth;

                g.append("path")
                    .attr("d", () => {
                        const yPos = yScale(dimension);
                        // 构建路径
                        // 从左上角开始
                        let path = `M 0 ${yPos}`;
                        // 到矩形右上角
                        path += ` L ${rectWidth} ${yPos}`;
                        // 到三角形上顶点
                        path += ` L ${rectWidth} ${yPos}`;
                        // 到三角形右侧顶点 (尖端)
                        path += ` L ${barWidth} ${yPos + barHeight / 2}`;
                        // 到三角形下顶点
                        path += ` L ${rectWidth} ${yPos + barHeight}`;
                        // 到矩形右下角
                        path += ` L ${rectWidth} ${yPos + barHeight}`;
                        // 到左下角
                        path += ` L 0 ${yPos + barHeight}`;
                        // 闭合路径
                        path += ` Z`;
                        return path;
                    })
                    .attr("fill", variables.has_gradient ? "url(#bar-gradient)" : getBarColor())
                    .style("stroke", variables.has_stroke ? getStrokeColor() : "none")
                    .style("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
                    .on("mouseover", function() {
                        d3.select(this).attr("opacity", 0.8);
                    })
                    .on("mouseout", function() {
                        d3.select(this).attr("opacity", 1);
                    });
            }
            
            // 添加带图标的维度标签
            const flagX = -flagWidth - flagPadding - 5;
            const labelY = yScale(dimension) + barHeight / 2;
            
            // 添加图标（如果有）
            if (images.field && images.field[dimension]) {
                g.append("image")
                    .attr("x", flagX)
                    .attr("y", labelY - flagHeight / 2)
                    .attr("width", flagWidth)
                    .attr("height", flagHeight)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", images.field[dimension]);
            }
            
            // 添加维度标签
            g.append("text")
                .attr("x", flagX - 5)
                .attr("y", labelY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(dimension);
            
            // 添加数值标签
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            g.append("text")
                .attr("x", barWidth + 5)
                .attr("y", yScale(dimension) + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color)
                .text(formattedValue);
        }
    });
    
    // 返回SVG节点
    return svg.node();
}