/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_7",
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
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距 - 初始值，稍后会根据标签长度调整
    const margin = {
        top: 60,      // 顶部留出标题空间
        right: 40,    // 右侧足够显示数值
        bottom: 30,   // 底部边距
        left: 80      // 左侧空间，稍后会调整
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    // 根据数据列提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "dimension";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "value";
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; // 默认为百分比
    
    if (dataColumns.find(col => col.role === "x").unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }

    let valueUnit2 = "";
    valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : 
                     dataColumns.find(col => col.role === "y2")?.unit;
    
    
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
    }
    
    // ---------- 5. 计算标签宽度 ----------
    
    // 创建临时SVG来测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 序号宽度
    const rankingWidth = 25;
    
    // 图标尺寸
    let flagWidth = 40;
    let flagHeight = 40;
    const flagPadding = 7;
    
    // 计算最大维度标签宽度（不包括图标和序号）
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
        const value = +d[valueField];
        const valueText = `${formatValue(value)}${valueUnit}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .text(valueText);
        
        const textWidth = tempText.node().getBBox().width;
        
        maxValueWidth = Math.max(maxValueWidth, textWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 计算左边距，考虑序号 + 标签 + 图标之间的间距
    // 序号在最左边，然后是标签（右对齐），然后是图标
    const totalLeftPadding = rankingWidth + maxLabelWidth + flagWidth + flagPadding * 5;
    margin.left = Math.max(margin.left, totalLeftPadding);
    margin.right = Math.max(margin.right, maxValueWidth + 10);
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = adjustedHeight - margin.top - margin.bottom;
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)  // 使用固定宽度而不是百分比
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
    
    // 获取主题色
    const primaryColor = colors.other && colors.other.primary ? colors.other.primary : "#1d6b64";
    
    // 获取最大值和最小值用于颜色插值
    const minValue = d3.min(chartData, d => +d[valueField]);
    const maxValue = d3.max(chartData, d => +d[valueField]);
    
    // 创建颜色比例尺 - 将数值映射到颜色
    const colorScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([d3.rgb(primaryColor).brighter(0.4), d3.rgb(primaryColor).darker(0.4)]);
    
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
    
    // ---------- 8. 创建标题和描述 ----------
    
    // 添加图表标题（如果存在）
    if (jsonData.title) {
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", 30)
            .attr("text-anchor", "middle")
            .style("font-family", typography.title.font_family)
            .style("font-size", typography.title.font_size)
            .style("font-weight", typography.title.font_weight)
            .style("fill", colors.text_color)
            .text(jsonData.title);
    }
    
    // 添加图表描述（如果存在）
    if (jsonData.description) {
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", 50)
            .attr("text-anchor", "middle")
            .style("font-family", typography.description.font_family)
            .style("font-size", typography.description.font_size)
            .style("font-weight", typography.description.font_weight)
            .style("fill", colors.text_color)
            .text(jsonData.description);
    }
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 10. 绘制条形和标签 ----------
    
    // 获取描边颜色的辅助函数
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333";
    };
    
    // 为每个维度绘制条形和标签
    sortedDimensions.forEach((dimension, index) => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const barHeight = yScale.bandwidth();
            const barWidth = xScale(+dataPoint[valueField]);
            
            // 计算此条形的颜色 - 基于其值
            const barColor = colorScale(+dataPoint[valueField]);
            
            // 绘制条形
            g.append("rect")
                .attr("x", 0)
                .attr("y", yScale(dimension))
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", barColor) // 使用单一颜色
                .attr("rx", variables.has_rounded_corners ? 3 : 0)
                .attr("ry", variables.has_rounded_corners ? 3 : 0)
                .style("stroke", variables.has_stroke ? getStrokeColor() : "none")
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
                .on("mouseover", function() {
                    d3.select(this).attr("opacity", 0.8);
                })
                .on("mouseout", function() {
                    d3.select(this).attr("opacity", 1);
                });
                
            // 修复: 正确设置图标大小
            const adjustedFlagWidth = Math.min(barHeight * 0.8, flagWidth); // 限制图标宽度
            const adjustedFlagHeight = Math.min(barHeight * 0.8, flagHeight); // 限制图标高度
            
            // 计算每个标签的位置
            // 图标位置：紧贴条形左边
            const iconX = -adjustedFlagWidth - flagPadding;
            
            // 获取当前维度标签的宽度
            const tempSvg = d3.select(containerSelector)
                .append("svg")
                .attr("width", 0)
                .attr("height", 0)
                .style("visibility", "hidden");
                
            const formattedDimension = dimensionUnit ? 
                `${dimension}${dimensionUnit}` : 
                `${dimension}`;
                
            const tempText = tempSvg.append("text")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .text(formattedDimension);
            
            const labelWidth = tempText.node().getBBox().width;
            tempSvg.remove();
            
            // 标签位置：在图标左侧，右对齐（相对于最长标签）
            const labelX = iconX - flagPadding;
            
            // 序号位置：在标签最左边，考虑最长的标签
            const rankingX = labelX - maxLabelWidth - flagPadding * 2;
            
            // 2. 添加国家/地区标签和图标
            if (images.field && images.field[dimension]) {
                // 计算裁剪圆的半径 (80% of adjustedFlagHeight/2)
                const clipRadius = (adjustedFlagHeight/2) * 0.8;
                
                // 为每个国家图标创建唯一的clipPath ID
                const clipId = `clip-${dimension.replace(/\s+/g, '-').toLowerCase()}-${index}`;
                
                // 添加剪切路径定义
                const defs = g.append("defs");
                
                defs.append("clipPath")
                    .attr("id", clipId)
                    .append("circle")
                    .attr("cx", adjustedFlagWidth/2)
                    .attr("cy", adjustedFlagHeight/2)
                    .attr("r", clipRadius-2);
                
                // 创建一个组来包含图像和边框
                const iconGroup = g.append("g")
                    .attr("transform", `translate(${iconX}, ${yScale(dimension) + (barHeight - adjustedFlagHeight) / 2})`);
                
                // 添加黑色边框圆 - 放在图像下面但会显示在图像周围
                iconGroup.append("circle")
                    .attr("cx", adjustedFlagWidth/2)
                    .attr("cy", adjustedFlagHeight/2)
                    .attr("r", clipRadius)
                    .attr("fill", "none")
                    .attr("stroke", "#000000")
                    .attr("stroke-width", 0.2);
                
                // 添加裁剪后的国家/地区图标
                iconGroup.append("image")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", adjustedFlagWidth)
                    .attr("height", adjustedFlagHeight)
                    .attr("xlink:href", images.field[dimension])
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("clip-path", `url(#${clipId})`);
            }
            // 添加维度标签
            g.append("text")
                .attr("x", labelX)
                .attr("y", yScale(dimension) + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(formattedDimension);
            
            // 添加序号
            g.append("text")
                .attr("x", rankingX)
                .attr("y", yScale(dimension) + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(`${index + 1}.`);
            
            // 格式化数值
            const formattedValue = `${formatValue(+dataPoint[valueField])}${valueUnit}`;
            
            // 临时计算文本宽度
            const tempTextSvg = d3.select(containerSelector)
                .append("svg")
                .attr("width", 0)
                .attr("height", 0)
                .style("visibility", "hidden");
            
            const tempValueText = tempTextSvg.append("text")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .text(formattedValue);
            
            const valueTextWidth = tempValueText.node().getBBox().width;
            tempTextSvg.remove();
            
            // 判断是否能在条形内部放置文本（需要多留一些边距）
            const textFitsInside = barWidth > valueTextWidth + 20;
            
            // 添加数值标签（在条形内部或外部）
            g.append("text")
                .attr("x", textFitsInside ? barWidth - 5 : barWidth + 5) // 如果放在内部，距离条形右侧5px，否则放在外部
                .attr("y", yScale(dimension) + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", textFitsInside ? "end" : "start") // 在内部时右对齐，在外部时左对齐
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", textFitsInside ? "#ffffff" : colors.text_color) // 在内部时使用白色，在外部时使用文本颜色
                .text(formattedValue);
        }
    });
    
    // 返回SVG节点
    return svg.node();
}