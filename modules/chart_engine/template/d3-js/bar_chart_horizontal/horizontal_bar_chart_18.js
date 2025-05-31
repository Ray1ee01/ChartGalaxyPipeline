/* 
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_18",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": [],
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

// 水平条形图实现 - 使用D3.js (样式02): horizontal_bar_chart_10
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
        other: { primary: "#0099ff" }  // 默认使用蓝色作为条形颜色
    };  
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 获取图标数据
    const images = jsonData.images || {};
    
    // 设置视觉效果变量 - 根据需求，删除留白、阴影和圆角等效果
    variables.has_rounded_corners = false;
    variables.has_shadow = false;
    variables.has_gradient = true; // 强制开启渐变
    variables.has_stroke = false;
    variables.has_spacing = false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const originalHeight = variables.height || 600;
    
    // 设置边距 - 这个样式需要更多的上部和下部空间用于标签
    const margin = {
        top: 90,      // 顶部边距
        right: 40,    // 右侧足够显示数值标签
        bottom: 60,   // 底部边距
        left: 30      // 左侧边距
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; // 默认为百分比
    
    if (dataColumns.find(col => col.role === "x").unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值并按数值降序排列数据
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    
    // 按数值降序排序数据（与图片相符）
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
    
    // ---------- 5. 计算标签宽度、动态高度和图表尺寸 ----------
    
    // 动态调整高度
    const numDimensions = sortedDimensions.length;
    let adjustedHeight = originalHeight;
    const maxHeightFactor = 1.88;
    
    if (numDimensions > 18) {
        // 根据条目数量比例计算建议高度
        const suggestedHeight = originalHeight * (numDimensions / 18);
        // 限制最大高度
        adjustedHeight = Math.min(suggestedHeight, originalHeight * maxHeightFactor);
    }
    
    // 使用调整后的高度
    const height = adjustedHeight;
    
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
    
    // 根据标签宽度调整右边距
    margin.right = Math.max(margin.right, maxValueWidth + 10);
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom; 
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height) // 使用调整后的高度
        .attr("viewBox", `0 0 ${width} ${height}`) // 使用调整后的高度
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 添加defs用于视觉效果
    const defs = svg.append("defs");
    
    // ---------- 7. 创建比例尺 ----------
    
    // 计算条形的额外间距（取消留白）
    const barPadding = 0.55; // 设置适当的间距以确保有足够空间放置标签和图标
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（用于数值）
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField]) * 1.1]) // 添加10%边距
        .range([0, innerWidth]);
    
    // 确保小值仍然可见 - 设置最小宽度为0，确保严格按比例绘制
    const getBarWidth = (value) => {
        return xScale(value);
    };
    
    // ---------- 8. 自适应图标和字体大小计算 ----------

    // 计算条形之间的距离和条形高度
    const barStep = yScale.step();
    const barHeight = yScale.bandwidth();
    
    // 计算标签和图标可用的空间（条形上方的空间）
    const availableLabelSpace = barStep - barHeight;
    
    // 设置标签和图标的最大高度，确保不会重叠
    // 允许标签和图标总高度最多占可用空间的90%
    const maxTotalHeight = availableLabelSpace * 0.9;
    
    // 为标签和图标分配空间
    // 图标大小设为总高度的65%，文本设为35%
    const iconHeight = Math.min(barHeight * 0.8, maxTotalHeight * 0.65);
    const iconWidth = iconHeight; // 保持图标宽高比
    
    // 基于图标的高度计算合适的字体大小，因为它们是并排的
    // 字体大小通常是所需高度的约80%
    const targetFontSizeBasedOnIcon = iconHeight * 0.9;
    const fontSize = Math.max(4, Math.min(16, targetFontSizeBasedOnIcon)); // 限制字体大小在8px到12px之间
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 10. 为每个维度创建独立的渐变 ----------
    sortedDimensions.forEach((dimension, i) => {
        // 获取条形颜色 - 从colors.field中获取，如果不存在则使用默认主色
        let barColor = colors.other.primary;
        if (colors.field && colors.field[dimension]) {
            barColor = colors.field[dimension];
        }
        
        // 为每个条形创建专用渐变
        const gradient = defs.append("linearGradient")
            .attr("id", `bar-gradient-${i}`)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
        
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(barColor).darker(0.3)); // 左侧暗色
        
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(barColor).brighter(0.8)); // 右侧亮色
    });
    
    // ---------- 11. 绘制条形和标签 ----------
    
    // 为每个维度绘制条形和标签
    sortedDimensions.forEach((dimension, i) => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const barWidth = getBarWidth(+dataPoint[valueField]);
            const yPosition = yScale(dimension);
            
            // ---------- 创建条形组 ----------
            const barGroup = g.append("g")
                .attr("transform", `translate(0, ${yPosition})`);
            
            // ---------- 添加图标和维度标签（在条形上方）----------
            // 创建一个用于图标和标签的容器组
            const labelGroup = g.append("g")
                .attr("transform", `translate(0, ${yPosition - 2})`); // 紧贴条形上方的位置
            
            // 标签水平位置 - 根据是否有图标调整
            let labelX = 0; // 默认从左侧开始
            
            // 添加图标（如果有）
            if (images.field && images.field[dimension]) {
                labelGroup.append("image")
                    .attr("x", 0) // 与条形左侧对齐
                    .attr("y", -iconHeight) // 图标放在条形上方
                    .attr("width", iconWidth)
                    .attr("height", iconHeight)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", images.field[dimension]);
                
                // 如果有图标，调整标签位置
                labelX = iconWidth + 5;
            }
            
            // 添加维度标签
            labelGroup.append("text")
                .attr("x", labelX)
                .attr("y", -iconHeight / 2) // 垂直位置与图标中心对齐
                .attr("dy", "0.35em") // 垂直微调以居中
                .attr("text-anchor", "start") // 左对齐
                .style("font-family", typography.label.font_family)
                .style("font-size", `${fontSize}px`) // 使用新的fontSize
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(dimension);
            
            // ---------- 绘制条形 ----------
            // 获取条形颜色
            let barColor = colors.other.primary;
            if (colors.field && colors.field[dimension]) {
                barColor = colors.field[dimension];
            }
            
            // 绘制条形 - 右侧带有圆角
            barGroup.append("path")
                .attr("d", function() {
                    const radius = barHeight / 2;
                    
                    // 处理零或负值，避免绘制错误
                    if (barWidth <= 0) {
                        return ""; // 不绘制任何路径
                    }
                    
                    // 当条形宽度小于半径时，绘制一个椭圆弧段，确保最右点为 barWidth
                    if (barWidth < radius) {
                        // M 移动到起点 (0, 0)
                        // A 绘制椭圆弧: rx=barWidth, ry=radius, 旋转=0, 小弧=0, 顺时针=1, 终点=(0, barHeight)
                        // Z 关闭路径
                        return `M 0,0 A ${barWidth},${radius} 0 0,1 0,${barHeight} Z`;
                    } 
                    // 当条形宽度大于等于半径时，绘制矩形 + 半圆
                    else {
                        // M 移动到起点 (0, 0)
                        // H 水平线到半圆开始处 (barWidth - radius, 0)
                        // A 绘制标准圆弧: rx=radius, ry=radius, 旋转=0, 小弧=0, 顺时针=1, 终点=(barWidth - radius, barHeight)
                        // H 水平线回到左侧 (0, barHeight)
                        // Z 关闭路径
                        return `M 0,0 H ${barWidth - radius} A ${radius},${radius} 0 0,1 ${barWidth - radius},${barHeight} H 0 Z`;
                    }
                })
                .attr("fill", `url(#bar-gradient-${i})`) // 使用每个条的独立渐变
                .style("stroke", "none");
            
            // 添加数值标签（在条形右侧）
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            barGroup.append("text")
                .attr("x", barWidth + 5) // 条形右侧5px
                .attr("y", barHeight / 2)
                .attr("dy", "0.35em") // 垂直居中
                .attr("text-anchor", "start")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20, Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(formattedValue);
        }
    });
    
    // 返回SVG节点
    return svg.node();
}