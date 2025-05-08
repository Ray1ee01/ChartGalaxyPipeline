/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_30",
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
    
    // 计算每个条形的理想高度 - 减小最小和最大高度
    const MIN_BAR_HEIGHT = 36;  // 从64减小到45
    const MAX_BAR_HEIGHT = 72;  // 从128减小到90
    const barPadding = variables.has_spacing ? 20 : 10;
    
    // 计算内部绘图区域尺寸（暂时宽度）
    const innerWidth = width - margin.left - margin.right;
    let innerHeight; // 高度稍后初始化
    
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

    // 计算最大值和最小值用于条形高度的缩放
    const maxValue = d3.max(chartData, d => +d[valueField]);
    const minValue = d3.min(chartData, d => +d[valueField]);
    
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
    
    // 固定条形间距
    const fixedBarSpacing = 15; // 条形之间的固定间距像素值
    
    // 创建条形高度比例尺 - 根据数值大小来变化条形高度（1-2倍基础高度）
    const barHeightScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([1, 2]); // 1倍到2倍的倍数范围
    
    // 基础条形高度 - 减小默认值
    const baseBarHeight = Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, 50)); // 从60减小到50
    
    // 计算每个条形的高度
    const barHeights = sortedDimensions.map(dimension => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        if (dataPoint) {
            const heightScale = barHeightScale(+dataPoint[valueField]);
            return baseBarHeight * heightScale;
        }
        return baseBarHeight;
    });
    
    // 计算总高度需求，包含固定间距
    const totalBarSpaceNeeded = barHeights.reduce((sum, height) => sum + height, 0) + 
        (barHeights.length - 1) * fixedBarSpacing; 
    
    // 计算图表所需的最小高度
    const extraSpace = 150; // 为标题和底部空间预留的额外高度
    const minHeight = variables.min_height || 400;
    const calculatedHeight = Math.max(minHeight, totalBarSpaceNeeded + extraSpace);
    
    // 使用计算值或用户指定值作为最终高度
    const height = variables.height || calculatedHeight;
    
    // 更新内部高度
    innerHeight = height - margin.top - margin.bottom;
    
    // X轴比例尺（用于数值）- 最小宽度从50改为100
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField]) * 1.05]) // 添加5%边距
        .range([75, innerWidth]); // 从100开始，而不是50

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
    
    // 计算所有条形中的最小高度，用于统一圆圈大小
    let minBarHeight = Math.min(...barHeights);
    const uniformCircleRadius = minBarHeight * 0.3;
    
    // 计算每个条形的Y坐标，使用固定间距
    let barPositions = [];
    let currentY = 0;
    
    barHeights.forEach(height => {
        barPositions.push(currentY);
        currentY += height + fixedBarSpacing;
    });
    
    // 居中调整所有条形
    const totalUsedHeight = currentY - fixedBarSpacing; // 减去最后一个不需要的间距
    const startY = (innerHeight - totalUsedHeight) / 2;
    
    // 绘制条形和标签
    sortedDimensions.forEach((dimension, index) => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            // 计算实际条形高度
            const barBandHeight = barHeights[index];
            
            // 使用预先计算的Y位置，加上居中调整
            const y = startY + barPositions[index];
            
            const barWidth = xScale(+dataPoint[valueField]);
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
            const iconX = 10;
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
            
            // 减小字体大小（条形高度的比例）
            const valueFontSize = `${barBandHeight * 0.35}px`;
            const labelFontSize = `${barBandHeight * 0.22}px`; // 明显更小的x标签字体大小
            
            // 创建临时文本测量数值标签宽度
            const tempValueText = svg.append("text")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", valueFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .text(formattedValue);
            
            const valueTextWidth = tempValueText.node().getBBox().width;
            tempValueText.remove();
            
            // 判断数值标签是否能放入条形内
            const labelFitsInside = valueTextWidth + 40 < barWidth; // 增加边距以容纳两行
            
            // 添加标签 - 两行：数值和维度名称
            if (labelFitsInside) {
                // 标签放在条形内部
                // 第一行：数值（上面一行）
                barGroup.append("text")
                    .attr("x", barWidth - 15)
                    .attr("y", centerY - barBandHeight * 0.15)
                    .attr("text-anchor", "end")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", valueFontSize)
                    .style("font-weight", "bold")
                    .style("fill", "#FFFFFF") // 白色
                    .text(formattedValue);
                    
                // 第二行：维度名称（下面一行）- 使用更小的字体
                barGroup.append("text")
                    .attr("x", barWidth - 15)
                    .attr("y", centerY + barBandHeight * 0.15)
                    .attr("text-anchor", "end")
                    .style("font-family", typography.label.font_family)
                    .style("font-size", labelFontSize)
                    .style("font-weight", "normal")
                    .style("fill", "#FFFFFF") // 白色
                    .text(dimension);
            } else {
                // 标签放在条形内左侧
                barGroup.append("text")
                    .attr("x", 15)
                    .attr("y", centerY)
                    .attr("dy", "0.35em") // 垂直居中
                    .attr("text-anchor", "start")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", valueFontSize)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", "#FFFFFF") // 白色
                    .text(formattedValue);
            }
            
            // 添加排名圆圈（黑色圆圈，白色文字）- 使用统一的半径
            const rankingCirclePadding = 5; // 圆圈与条形之间的间距
            const rankingCircleX = barWidth + rankingCirclePadding + uniformCircleRadius;
            
            // 绘制黑色圆圈
            barGroup.append("circle")
                .attr("cx", rankingCircleX)
                .attr("cy", centerY)
                .attr("r", uniformCircleRadius)
                .attr("fill", "#000000"); // 黑色填充
            
            // 添加排名数字（白色）
            barGroup.append("text")
                .attr("x", rankingCircleX)
                .attr("y", centerY)
                .attr("dy", "0.35em") // 垂直居中
                .attr("text-anchor", "middle") // 水平居中
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${uniformCircleRadius * 1.2}px`) // 字体大小适合圆圈
                .style("font-weight", "bold")
                .style("fill", "#FFFFFF") // 白色
                .text(index + 1); // 排名从1开始
            
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