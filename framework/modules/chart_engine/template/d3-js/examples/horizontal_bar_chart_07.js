/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_07",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], [0, 100]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
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
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
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
    
    // 计算行间距（如果启用）
    const rowPadding = variables.has_spacing ? 0.3 : 0.2;
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(rowPadding);
    
    // 计算最大值，确保所有棒子能够显示
    const maxValue = d3.max(chartData, d => +d[valueField]);
    
    // 计算适合当前宽度的棒子尺寸
    const availableWidth = innerWidth;
    
    // 计算合适的棒子尺寸，确保所有数据都能显示
    // 默认值
    const defaultBarWidth = 10;
    const defaultBarSpacing = 5;
    const largerGroupSpacing = 15; // 每10个棒子后的额外间距
    
    // 棒子组大小（每组10个）
    const groupSize = 10;
    
    // 计算一组10个棒子需要的宽度（包括普通间距）
    const groupBaseWidth = groupSize * defaultBarWidth + (groupSize - 1) * defaultBarSpacing;
    
    // 计算需要多少组
    const requiredGroups = Math.ceil(maxValue / groupSize);
    
    // 计算总需要宽度（包括组间额外间距）
    const requiredWidth = requiredGroups * groupBaseWidth + (requiredGroups - 1) * largerGroupSpacing;
    
    // 如果需要的宽度大于可用宽度，则缩放
    let barWidth, barSpacing, groupSpacing;
    
    if (requiredWidth > availableWidth) {
        const scaleFactor = availableWidth / requiredWidth;
        barWidth = Math.max(3, Math.floor(defaultBarWidth * scaleFactor));
        barSpacing = Math.max(1, Math.floor(defaultBarSpacing * scaleFactor));
        groupSpacing = Math.max(3, Math.floor(largerGroupSpacing * scaleFactor));
    } else {
        barWidth = defaultBarWidth;
        barSpacing = defaultBarSpacing;
        groupSpacing = largerGroupSpacing;
    }
    
    // ---------- 8. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    
    
    // ---------- 10. 绘制百分比竖条图和标签 ----------
    
    // 为每个维度绘制竖条组和标签
    sortedDimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const rowHeight = yScale.bandwidth();
            const barHeight = rowHeight * 0.6;  // 竖条高度为行高的60%
            const barY = yScale(dimension) + (rowHeight - barHeight) / 2;  // 竖条垂直居中
            const barCount = Math.round(dataPoint[valueField]);  // 四舍五入到整数
            
            // 绘制竖条组
            for (let i = 0; i < barCount; i++) {
                // 计算当前棒子所在的组（每10个一组）
                const groupIndex = Math.floor(i / groupSize);
                // 计算在当前组内的索引（0-9）
                const inGroupIndex = i % groupSize;
                
                // 计算x位置（考虑组间的额外间距）
                const barX = (groupIndex * (groupSize * (barWidth + barSpacing) + groupSpacing)) + 
                            (inGroupIndex * (barWidth + barSpacing));
                
                // 获取当前组的渐变ID
                const gradientId = `bar-gradient-${groupIndex}`;
                
                // 绘制单个竖条
                g.append("rect")
                    .attr("x", barX)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("fill", `url(#${gradientId})`)
                    .attr("rx", barWidth / 2) // 圆角半径
                    .attr("ry", barWidth / 2) // 圆角半径
                    .style("stroke", variables.has_stroke ? d3.rgb(primaryColor).darker(0.3) : "none")
                    .style("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            }
            
            // 添加维度标签
            g.append("text")
                .attr("x", -10)
                .attr("y", yScale(dimension) + rowHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(dimension);
                
            // 计算动态字体大小（条形高度的60%）
            const dynamicFontSize = `${barHeight * 0.8}px`;
            
            // 添加数值标签
            const formattedValue = valueUnit ? 
                `${dataPoint[valueField]}${valueUnit}` : 
                `${dataPoint[valueField]}`;
            
            // 计算最后一个棒子的位置，用于放置数值标签
            const lastGroupIndex = Math.floor(barCount  / groupSize);
            const lastInGroupIndex = barCount  % groupSize;
            const lastBarX = (lastGroupIndex * (groupSize * (barWidth + barSpacing) + groupSpacing)) + 
                           (lastInGroupIndex * (barWidth + barSpacing));
            
            g.append("text")
                .attr("x", lastBarX + barWidth + 5)
                .attr("y", yScale(dimension) + rowHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", dynamicFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(formattedValue);
        }
    });
    
    // 返回SVG节点
    return svg.node();
}