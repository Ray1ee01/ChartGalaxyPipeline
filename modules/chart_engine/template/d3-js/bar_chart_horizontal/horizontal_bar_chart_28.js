/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_28",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "gradient", "spacing"],
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

// 水平条形图实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                           // 完整的JSON数据对象
    const chartData = jsonData.data.data                 // 实际数据点数组  
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
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    
    // 提取维度字段
    const dimensionField = dataColumns.find(col => col.role === "x").name;
    
    // 获取数据维度数量
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const dimensionCount = dimensions.length;
    
    // 设置边距
    const margin = {
        top: 90,      // 顶部留出标题空间
        right: 120,   // 右侧足够显示标签
        bottom: 60,   // 底部边距
        left: 100     // 左侧空间
    };
    
    // 计算每个条形的理想高度 - 最小为64像素，最大为128像素
    const MIN_BAR_HEIGHT = 64;
    const MAX_BAR_HEIGHT = 128;
    const barPadding = variables.has_spacing ? 20 : 10;
    
    // 计算条形高度，使用合理的默认值
    const barHeight = Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, 80)); // 默认80像素高
    
    // 计算总的条形空间需求
    const totalBarSpace = (barHeight + barPadding) * dimensionCount;
    
    // 计算图表所需的最小高度 (条形总高度 + 标题和底部的空间)
    const extraSpace = 150; // 为标题和底部空间预留的额外高度
    const minHeight = variables.min_height || 400;
    const calculatedHeight = Math.max(minHeight, totalBarSpace + extraSpace);
    
    // 使用计算值或用户指定值作为最终高度
    const height = variables.height || calculatedHeight;
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 根据实际可用空间，可能需要调整条形高度
    const availableHeight = innerHeight - 50; // 保留一些间距
    const adjustedBarHeight = Math.min(
        barHeight, 
        Math.max(MIN_BAR_HEIGHT, availableHeight / dimensionCount)
    );
    
    // 使用调整后的条形高度
    const finalBarHeight = adjustedBarHeight;
    const totalBarSpaceAdjusted = (finalBarHeight + barPadding) * dimensionCount;
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    const valueField = dataColumns.find(col => col.role === "y").name;
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; 
    
    if (dataColumns.find(col => col.role === "x").unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
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
    
    // 计算最大数值标签宽度
    let maxValueWidth = 0;
    chartData.forEach(d => {
        const formattedValue = valueUnit ? 
            `${d[valueField]}${valueUnit}` : 
            `${d[valueField]}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .text(formattedValue);
        
        const textWidth = tempText.node().getBBox().width;
        
        maxValueWidth = Math.max(maxValueWidth, textWidth);
        
        tempText.remove();
    });
    
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
        
        maxLabelWidth = Math.max(maxLabelWidth, textWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 根据标签宽度调整边距
    margin.right = Math.max(margin.right, maxLabelWidth + 30);
    
    // ---------- 6. 创建比例尺 ----------
    
    // 计算条形的额外间距（如果启用）
    const barScalePadding = variables.has_spacing ? 0.3 : 0.2;
    
    // 计算实际需要的总高度（基于调整后的条形高度）
    const actualNeededHeight = (finalBarHeight + barPadding) * dimensionCount;
    
    // 确保Y轴比例尺使用基于finalBarHeight计算的适当范围
    // 如果actualNeededHeight小于innerHeight，则居中显示
    const yAxisStart = Math.max(0, (innerHeight - actualNeededHeight) / 2);
    const yAxisEnd = Math.min(innerHeight, yAxisStart + actualNeededHeight);
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([yAxisStart, yAxisEnd])
        .padding(barScalePadding);
    
    // X轴比例尺（用于数值）
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField]) * 1.05]) // 添加5%边距
        .range([0, innerWidth]);

    // ---------- 7. 创建SVG容器 ----------
    
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
    
    // ---------- 8. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 9. 绘制条形和标签 ----------
    
    // 获取条形颜色的辅助函数
    const getBarColor = () => {
        return colors.other.primary || "#882e2e"; // 默认暗红色
    };
    
    // 绘制条形和标签
    sortedDimensions.forEach((dimension, index) => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const barBandHeight = yScale.bandwidth();
            const barWidth = xScale(+dataPoint[valueField]);
            const y = yScale(dimension);
            const centerY = y + barBandHeight / 2;
            
            // 创建条形组
            const barGroup = g.append("g");
            
            // 绘制矩形条形（没有圆角和边框）
            barGroup.append("rect")
                .attr("x", 0)
                .attr("y", y)
                .attr("width", barWidth)
                .attr("height", barBandHeight)
                .attr("fill", variables.has_gradient ? "url(#bar-gradient)" : getBarColor())
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
                .on("mouseover", function() {
                    d3.select(this).attr("opacity", 0.8);
                })
                .on("mouseout", function() {
                    d3.select(this).attr("opacity", 1);
                });
            
            // 准备图标尺寸
            const iconSize = barBandHeight * 0.7;
            const iconX = 0;
            const iconY = y + (barBandHeight - iconSize) / 2;
            
            // 添加图标（如果有）- 带白色圆形背景
            if (images.field && images.field[dimension]) {
                // 添加白色圆形背景
                barGroup.append("circle")
                    .attr("cx", iconX + iconSize/2)
                    .attr("cy", iconY + iconSize/2)
                    .attr("r", iconSize/2)
                    .attr("fill", "white");
                
                // 添加图标
                barGroup.append("image")
                    .attr("x", iconX)
                    .attr("y", iconY)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", images.field[dimension]);
            }
            
            // 格式化数值用于显示
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            // 计算动态字体大小（条形高度的60%）
            const dynamicFontSize = `${barBandHeight * 0.6}px`;
            
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
                // 标签放在条形内部
                barGroup.append("text")
                    .attr("x", barWidth - 5)
                    .attr("y", y + barBandHeight / 2)
                    .attr("dy", "0.35em") // 垂直居中
                    .attr("text-anchor", "end")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", dynamicFontSize)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", "#FFFFFF") // 白色
                    .text(formattedValue);
            } else {
                // 标签放在条形外部
                barGroup.append("text")
                    .attr("x", barWidth + 5)
                    .attr("y", y + barBandHeight / 2)
                    .attr("dy", "0.35em") // 垂直居中
                    .attr("text-anchor", "start")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", dynamicFontSize)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", colors.text_color || "#333333") // 使用文本颜色
                    .text(formattedValue);
            }
            
            // 添加维度标签（X标签）- 放在条形右边
            barGroup.append("text")
                .attr("x", barWidth + (labelFitsInside ? 5 : valueTextWidth + 15))
                .attr("y", y + barBandHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(dimension);
            
            // 在第一个条形上显示单位（如果有）
            if (index === 0 && valueUnit) {
                barGroup.append("text")
                    .attr("x", barWidth)
                    .attr("y", y - 5) // 条形顶部上方
                    .attr("text-anchor", "end")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", typography.annotation.font_size)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", colors.text_color || "#333333")
                    .text(`(${valueUnit})`);
            }
        }
    });
    
    // 返回SVG节点
    return svg.node();
}