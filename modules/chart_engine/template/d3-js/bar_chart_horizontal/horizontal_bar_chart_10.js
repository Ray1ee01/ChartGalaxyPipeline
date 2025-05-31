/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_10",
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
    
    // 如果x维度数量超过15，每增加一个x，整个图像的高度增加3%
    const baseHeight = variables.height || 600;
    const adjustedHeight = dimensions.length > 15 
        ? baseHeight * (1 + (dimensions.length - 15) * 0.03) 
        : baseHeight;
    
    // 设置边距
    const margin = {
        top: 90,      // 顶部留出标题空间
        right: 10,    // 右侧足够显示数值
        bottom: 60,   // 底部边距
        left: 100     // 左侧初始空间，用于维度标签和图标
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
    
    // 临时条形高度（用于估算图标尺寸）
    const tempBarHeight = 30; // 临时默认值
    
    // 临时图标尺寸（基于临时条形高度）
    const tempFlagHeight = tempBarHeight * 0.9; 
    const tempFlagWidth = tempFlagHeight * 1.33;
    const flagPadding = 5;
    
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
        const totalWidth = tempFlagWidth + flagPadding + textWidth;
        
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
    margin.right = Math.max(margin.right, maxValueWidth + 10);
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = adjustedHeight - margin.top - margin.bottom;
    
    // ---------- 6. 创建比例尺 ----------
    
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

    // ---------- 7. 创建SVG容器 ----------
    
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

    
    // 获取描边颜色的辅助函数
    const getStrokeColor = () => {
        
        
        return "#D1E6F9";
    };
    
    
  
    
    // 为每个维度绘制条形和标签
    sortedDimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const barHeight = yScale.bandwidth();
            const barWidth = xScale(+dataPoint[valueField]);
            const y = yScale(dimension);
            const centerY = y + barHeight / 2;
            
            // 设置半圆的半径（等于条形高度的一半）
            const radius = barHeight / 2;
            
            // 创建条形组
            const barGroup = g.append("g");
            
            // 绘制条形（两端都是半圆）
            barGroup.append("path")
                .attr("d", () => {
                    // 如果条形宽度小于两个半径，则绘制一个完整的圆
                    if (barWidth <= radius * 2) {
                        return `
                            M ${radius},${y}
                            A ${radius},${radius} 0 0,1 ${radius},${y + barHeight}
                            A ${radius},${radius} 0 0,1 ${radius},${y}
                        `;
                    }
                    
                    // 否则绘制带有两端半圆的条形
                    return `
                        M ${radius},${y}
                        L ${barWidth - radius},${y}
                        A ${radius},${radius} 0 0,1 ${barWidth - radius},${y + barHeight}
                        L ${radius},${y + barHeight}
                        A ${radius},${radius} 0 0,1 ${radius},${y}
                        Z
                    `;
                })
                .attr("fill", variables.has_gradient ? "url(#bar-gradient)" : getBarColor())
                .style("stroke",  getStrokeColor())
                .style("stroke-width",  3 )
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
                .on("mouseover", function() {
                    d3.select(this).attr("opacity", 0.8);
                })
                .on("mouseout", function() {
                    d3.select(this).attr("opacity", 1);
                });
            
            // 使用动态计算的图标尺寸，为条形高度的90%
            const flagHeight = barHeight * 0.9;
            const flagWidth = flagHeight * 1.33; // 保持宽高比 4:3
            
            // 添加带图标的维度标签
            const flagX = -flagWidth - flagPadding - 5;
            const labelY = y + barHeight / 2;
            
            // 添加图标（如果有）
            if (images.field && images.field[dimension]) {
                barGroup.append("image")
                    .attr("x", flagX)
                    .attr("y", labelY - flagHeight / 2)
                    .attr("width", flagWidth)
                    .attr("height", flagHeight)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", images.field[dimension]);
            }
            
            // 添加维度标签
            barGroup.append("text")
                .attr("x", flagX - 5)
                .attr("y", labelY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(dimension);
            
            // 计算动态字体大小（条形高度的60%）
            const dynamicFontSize = `${barHeight * 0.6}px`;
            
            // 格式化数值用于显示
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            // 创建临时文本测量数值标签宽度（使用动态字体大小）
            const tempValueText = svg.append("text")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", dynamicFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .text(formattedValue);
            
            const valueTextWidth = tempValueText.node().getBBox().width;
            tempValueText.remove();
            
            // 判断数值标签是否能放入条形内（需要考虑左侧半圆）
            const effectiveBarWidth = barWidth - radius * 2; // 减去两端半圆的宽度
            const labelFitsInside = valueTextWidth + 10 < effectiveBarWidth;
            
            // 添加数值标签（使用动态字体大小）
            if (labelFitsInside) {
                // 标签放在条形内部
                barGroup.append("text")
                    .attr("x", barWidth - 5) // 考虑右侧半圆
                    .attr("y", y + barHeight / 2)
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
                    .attr("y", y + barHeight / 2)
                    .attr("dy", "0.35em") // 垂直居中
                    .attr("text-anchor", "start")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", dynamicFontSize)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", colors.text_color || "#333333") // 使用文本颜色
                    .text(formattedValue);
            }
        }
    });
    
    // 返回SVG节点
    return svg.node();
}