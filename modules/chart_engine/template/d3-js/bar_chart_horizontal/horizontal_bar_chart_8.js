/* 
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_8",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], ["-inf", "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
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

// 右对齐水平条形图实现 - 使用D3.js
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
        other: { primary: "#E74C3C" }  // 默认使用红色作为条形颜色
    };  
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x").name;
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
    
    // 获取唯一维度值并按数值降序排列数据
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    
    // 如果x维度数量超过15，每增加一个x，整个图像的高度增加3%
    const baseHeight = variables.height || 600;
    const adjustedHeight = dimensions.length > 15 
        ? baseHeight * (1 + (dimensions.length - 15) * 0.03) 
        : baseHeight;
    
    // 设置边距 - 根据样式调整
    const margin = {
        top: 90,      // 顶部边距，用于放置类别标签
        right: 10,    // 最小右侧边距
        bottom: 60,   // 底部边距
        left: 10     // 左侧边距，留足空间放置无法放入条内的数值标签
    };
    
    // 按数值降序排序数据
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);
    
    // 计算最小和最大值用于比例尺
    const minValue = d3.min(chartData, d => +d[valueField]);
    const maxValue = d3.max(chartData, d => +d[valueField]);
    
    // 确定是否有负值
    const hasNegativeValues = minValue < 0;
    
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
    
    // ---------- 5. 计算标签宽度和图表尺寸 ----------
    
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
    
    // 根据标签宽度调整左边距，确保有足够的空间显示无法放入条内的标签
    margin.left = Math.max(margin.left, maxValueWidth + 20);
    
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
    
    // 添加渐变（如果启用）
    if (variables.has_gradient) {
        const primaryColor = colors.other && colors.other.primary ? colors.other.primary : "#E74C3C";
        
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
            .attr("stop-color", d3.rgb(primaryColor));
    }
    
    // ---------- 7. 创建比例尺 ----------
    
    // 计算条形的额外间距（如果启用）
    const barPadding = variables.has_spacing ? 0.7 : 0.6;
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（用于数值）- 右对齐
    const xScale = d3.scaleLinear()
        .domain([
            hasNegativeValues ? Math.min(minValue * 1.1, 0) : 0, 
            Math.max(maxValue * 1.1, 0)
        ])
        .range([0, innerWidth]);
    
    // ---------- 8. 测量合适的维度标签字体大小 ----------
    
    // 建立临时SVG用于测量文本
    const tempSvg2 = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 从typography.label.font_size中解析初始字号
    const defaultFontSizeStr = typography.label.font_size || "12px";
    let fontSize = parseFloat(defaultFontSizeStr);
    
    // 设置最小字号
    const minFontSize = 10;
    
    // 移除临时SVG
    tempSvg2.remove();
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 10. 添加Y轴名称与标题栏 ----------
    
    // 获取条形颜色
    const getBarColor = () => {
        return colors.other && colors.other.primary ? colors.other.primary : "#E74C3C"; // 默认红色
    };
    
    // Y轴名称
    const yAxisName = valueField;

    
    // 创建临时文本测量轴名称宽度
    const tempAxisNameText = svg.append("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .text(yAxisName);
    
    const axisNameTextWidth = tempAxisNameText.node().getBBox().width;
    tempAxisNameText.remove();
    
    // 创建Y轴标题条
    const titleBarHeight = yScale.bandwidth(); // 标题条高度
    const titleBarY = -20; // 位置在第一个条形上方
    
    // 添加标题条
    g.append("rect")
        .attr("x", innerWidth - axisNameTextWidth - 5) // 右对齐
        .attr("y", titleBarY)
        .attr("width", axisNameTextWidth + 15)
        .attr("height", titleBarHeight)
        .attr("fill", getBarColor())
        .attr("rx", variables.has_rounded_corners ? 3 : 0)
        .attr("ry", variables.has_rounded_corners ? 3 : 0);
    
    // 添加Y轴名称文本 - 右对齐
    g.append("text")
        .attr("x", innerWidth + 5) // 右边缘减去一点padding
        .attr("y", titleBarY + titleBarHeight/2)
        .attr("dy", "0.35em") // 垂直居中
        .attr("text-anchor", "end") // 右对齐
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", "#FFFFFF") // 白色文字，与标题条形成对比
        .text(yAxisName);
    
    // ---------- 11. 绘制条形和标签 ----------
    
    // 获取描边颜色
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        return d3.rgb(getBarColor()).darker(0.2);
    };
    
    // 为每个维度绘制条形和标签
    sortedDimensions.forEach((dimension, index) => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const barHeight = yScale.bandwidth();
            const value = +dataPoint[valueField];
            
            // 计算条形宽度和位置 - 右对齐
            let barWidth = Math.abs(xScale(value) - xScale(0));
            let barX = value >= 0 ? innerWidth - barWidth : innerWidth - barWidth;
            
            // 创建条形组
            const barGroup = g.append("g")
                .attr("transform", `translate(0, ${yScale(dimension)})`);
            
            // 绘制条形
            barGroup.append("rect")
                .attr("x", barX)
                .attr("y", 0)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", variables.has_gradient ? "url(#bar-gradient)" : getBarColor())
                .attr("rx", variables.has_rounded_corners ? 3 : 0)
                .attr("ry", variables.has_rounded_corners ? 3 : 0)
                .style("stroke", variables.has_stroke ? getStrokeColor() : "none")
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            
            // 格式化数值用于显示
            const formattedValue = `${formatValue(value)}${valueUnit}`;
            
            // 创建临时文本测量数值标签宽度
            const tempValueText = svg.append("text")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .text(formattedValue);
            
            const valueTextWidth = tempValueText.node().getBBox().width;
            tempValueText.remove();
            
            // 判断数值标签是否能放入条形内
            const labelFitsInside = valueTextWidth + 10 < barWidth;
            
            // 添加数值标签
            if (labelFitsInside) {
                // 标签放在条形内部左侧
                barGroup.append("text")
                    .attr("x", barX + 5) // 条形内左侧5px
                    .attr("y", barHeight / 2)
                    .attr("dy", "0.35em") // 垂直居中
                    .attr("text-anchor", "start")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", "#FFFFFF") // 白色
                    .text(formattedValue);
            } else {
                // 标签放在条形外部左侧
                barGroup.append("text")
                    .attr("x", barX - 5) // 条形外左侧5px
                    .attr("y", barHeight / 2)
                    .attr("dy", "0.35em") // 垂直居中
                    .attr("text-anchor", "end")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", colors.text_color || "#333333") // 使用文本颜色
                    .text(formattedValue);
            }
            
            // 添加维度标签（在条形上方，右对齐）
            barGroup.append("text")
                .attr("x", innerWidth) // 与条形右边缘对齐
                .attr("y", -barHeight /4) // 条形上方10px
                .attr("text-anchor", "end") // 右对齐
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(dimension);
        }
    });
    
    // 返回SVG节点
    return svg.node();
}