/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Dot Bar Chart",
    "chart_name": "vertical_dot_bar_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 6], [3, 20]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": [],
    "supported_effects": ["shadow",  "gradient", "stroke", "spacing"],
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

// 百分比竖条图实现 - 使用D3.js
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
    const colors = jsonData.colors || { 
        text_color: "#333333",
        other: { primary: "#FFBB33" }  // 默认橙黄色
    };  
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
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
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners !== undefined ? variables.has_rounded_corners : true;
    variables.has_shadow = variables.has_shadow !== undefined ? variables.has_shadow : false;
    variables.has_gradient = true; // 确保渐变被启用
    variables.has_stroke = variables.has_stroke !== undefined ? variables.has_stroke : false;
    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : true;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距
    const margin = {
        top: 90,      // 顶部留出标题空间
        right: 30,    // 右侧足够显示数值
        bottom: 40,   // 底部边距
        left: 100     // 左侧足够空间用于维度标签
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "dimension";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "value";
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; // 默认为百分比
    
    if (dataColumns.find(col => col.role === "x")?.unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x")?.unit || "";
    }
    
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y")?.unit || "";
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值并按数值降序排列数据
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const maxValue_ = d3.max(chartData, d => Math.abs(+d[valueField]));
    chartData.forEach(d => {
        d[`${valueField}_`] = d[valueField];
    });
    if (maxValue_ > 100) {
        // 确保所有数值在0-100范围内
        chartData.forEach(d => {
            d[`${valueField}_`] = Math.max(1, Math.floor(+d[valueField] / maxValue_ * 50));
        });
    }
    
    // 按数值降序排序数据
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);
    
    // ---------- 5. 计算标签宽度 ----------
    
    // 创建临时SVG来测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
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
    
    // 计算最大数值标签宽度
    let maxValueWidth = 0;
    chartData.forEach(d => {
        const formattedValue = valueUnit ? 
            `${formatValue(d[`${valueField}_`])}${valueUnit}` : 
            `${formatValue(d[`${valueField}_`])}`;
            
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
    margin.left = Math.max(margin.left, maxLabelWidth + 10);
    margin.right = Math.max(margin.right, maxValueWidth + 10);
    
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
            .attr("stdDeviation", 2);
        
        filter.append("feOffset")
            .attr("dx", 2)
            .attr("dy", 2)
            .attr("result", "offsetblur");
        
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // 获取主要颜色
    const primaryColor = colors.other.primary || "#FFBB33";
    
    // 创建每10个棒子一组的渐变定义
    const maxGroups = 10; // 假设最多10组（即最大100%）
    for (let group = 0; group < maxGroups; group++) {
        // 为每组创建渐变
        const gradient = defs.append("linearGradient")
            .attr("id", `bar-gradient-${group}`)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
        
        // 计算此组的亮度偏移
        // 随着组号增加，整体颜色变深
        const groupDarkenFactor = 0.2 * group;
        
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(primaryColor).brighter(1.0 - groupDarkenFactor));
        
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(primaryColor).darker(0.0 + groupDarkenFactor));
    }
    
    // ---------- 7. 创建比例尺 ----------
    
    // 计算列间距（如果启用）
    const columnPadding = variables.has_spacing ? 0.3 : 0.2;
    
    // X轴比例尺（用于维度）
    const xScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerWidth])
        .padding(columnPadding);
    
    // 计算最大值，确保所有棒子能够显示
    const maxValue = d3.max(chartData, d => +d[`${valueField}_`]);
    
    // 计算适合当前高度的棒子尺寸
    const availableHeight = innerHeight;
    
    // 计算合适的棒子尺寸，确保所有数据都能显示
    // 默认值
    const defaultBarHeight = 30;
    const defaultBarSpacing = 5;
    const largerGroupSpacing = 15; // 每10个棒子后的额外间距
    
    // 棒子组大小（每组10个）
    const groupSize = 5;
    
    // 计算一组10个棒子需要的高度（包括普通间距）
    const groupBaseHeight = groupSize * defaultBarHeight + (groupSize - 1) * defaultBarSpacing;
    
    // 计算需要多少组
    const requiredGroups = Math.ceil(maxValue / groupSize);
    
    // 计算总需要高度（包括组间额外间距）
    const requiredHeight = requiredGroups * groupBaseHeight + (requiredGroups - 1) * largerGroupSpacing;
    
    // 如果需要的高度大于可用高度，则缩放
    let barHeight, barSpacing, groupSpacing;
    
    if (requiredHeight > availableHeight) {
        const scaleFactor = availableHeight / requiredHeight;
        barHeight = Math.max(3, Math.floor(defaultBarHeight * scaleFactor));
        barSpacing = Math.max(1, Math.floor(defaultBarSpacing * scaleFactor));
        groupSpacing = Math.max(3, Math.floor(largerGroupSpacing * scaleFactor));
    } else {
        barHeight = defaultBarHeight;
        barSpacing = defaultBarSpacing;
        groupSpacing = largerGroupSpacing;
    }
    
    // ---------- 8. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    
    // ---------- 10. 绘制百分比竖条图和标签 ----------
    
    // 为每个维度绘制竖条组和标签
    sortedDimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const columnWidth = xScale.bandwidth();
            const barWidth = columnWidth * 0.8;  // 竖条宽度为列宽的80%
            const barX = xScale(dimension) + (columnWidth - barWidth) / 2;  // 竖条水平居中
            const barCount = Math.round(dataPoint[`${valueField}_`]);  // 四舍五入到整数
            
            // 绘制竖条组
            for (let i = 0; i < barCount; i++) {
                // 计算当前棒子所在的组（每10个一组）
                const groupIndex = Math.floor(i / groupSize);
                // 计算在当前组内的索引（0-9）
                const inGroupIndex = i % groupSize;
                
                // 计算y位置（考虑组间的额外间距）
                const barY = (groupIndex * (groupSize * (barHeight + barSpacing) + groupSpacing)) + 
                            (inGroupIndex * (barHeight + barSpacing));
                
                // 获取当前组的渐变ID
                const gradientId = `bar-gradient-${groupIndex}`;
                
                // 绘制单个竖条
                g.append("image")
                    .attr("x", barX)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("xlink:href", jsonData.images.field[dataPoint[dimensionField]]);
            }
            
            // 添加维度标签
            g.append("text")
                .attr("x", xScale(dimension) + columnWidth / 2)
                .attr("y", -10)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(dimension);
                
            // 计算动态字体大小（条形宽度的60%）
            const dynamicFontSize = `${barWidth * 0.8}px`;
            
            // 添加数值标签
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            // 计算最后一个棒子的位置，用于放置数值标签
            const lastGroupIndex = Math.floor(barCount / groupSize);
            const lastInGroupIndex = barCount % groupSize;
            const lastBarY = (lastGroupIndex * (groupSize * (barHeight + barSpacing) + groupSpacing)) + 
                           (lastInGroupIndex * (barHeight + barSpacing));
            
            // 提取原始字体大小的数字部分（去掉'px'）
            const baseFontSize = parseInt(typography.annotation.font_size);
            // 计算动态字体大小，并限制最大不超过原始字体大小的2倍
            const calculatedSize = Math.min(barWidth * 0.8, baseFontSize * 2);
            const limitedFontSize = `${calculatedSize}px`;
            
            g.append("text")
                .attr("x", xScale(dimension) + columnWidth / 2)
                .attr("y", lastBarY + barHeight + 5)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", limitedFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(formattedValue);
        }
    });
    
    // 返回SVG节点
    return svg.node();
}