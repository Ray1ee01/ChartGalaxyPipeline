/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_11",
    "is_composite": true,
    "required_fields": ["x", "y", "y2", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, 10000], [0, 10000], [2, 6]],
    "required_fields_icons": [],
    "hierarchy":["group"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "styled",
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
    let currentChartHeight = variables.height || 600; // 初始化图表高度，后续可能调整
    
    // 设置边距 - 初始值，稍后会根据标签长度调整
    const margin = {
        top: 90,      // 顶部留出标题空间
        right: 40,    // 右侧足够显示数值
        bottom: 40,   // 底部边距
        left: 40      // 左侧空间，稍后会调整
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "dimension";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "value";
    const groupField = dataColumns.find(col => col.role === "group")?.name || "group";
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name || "total";

    // 获取字段单位
    let valueUnit = "";
    let valueUnit2 = "";
    valueUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : 
                     dataColumns.find(col => col.role === "y")?.unit;
    valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : 
                     dataColumns.find(col => col.role === "y2")?.unit;
    // 添加维度单位定义
    const dimensionUnit = dataColumns.find(col => col.role === "x")?.unit === "none" ? "" : 
                     dataColumns.find(col => col.role === "x")?.unit;

    // 获取y2字段的显示名称用于标题
    const valueField2Name = dataColumns.find(col => col.role === "y2")?.display_name || valueField2;

    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值并按数值降序排列数据
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    
    // 动态调整图表高度
    if (dimensions.length > 15) {
        const excessDimensions = dimensions.length - 15;
        const percentIncrease = excessDimensions * 0.03; // 每增加一个维度，高度增加3%
        currentChartHeight = Math.round(currentChartHeight * (1 + percentIncrease));
    }

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
    
    // 序号宽度
    const rankingWidth = 25;
    
    // 图标尺寸
    let flagWidth = 40;
    let flagHeight = 40;
    const flagPadding = 5; // 图标与标签之间的间距
    
    // 计算最大维度标签宽度（不包括图标和序号）
    let maxLabelWidth = 0;
    dimensions.forEach(dimension => {
        // 获取当前维度对应的数据点
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        const group = dataPoint ? dataPoint[groupField] : "";
        
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
        
        // 计算组标签宽度
        const tempGroupText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", parseInt(typography.label.font_size) * 0.8 + "px") // 小一点的组标签
            .style("font-weight", "normal")
            .text(group);
        
        const groupTextWidth = tempGroupText.node().getBBox().width;
        
        maxLabelWidth = Math.max(maxLabelWidth, textWidth, groupTextWidth);
        
        tempText.remove();
        tempGroupText.remove();
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
    
    // 计算最大第二数值标签宽度
    let maxValueWidth2 = 0;
    chartData.forEach(d => {
        const formattedValue2 = valueUnit2 ? 
            `${formatValue(d[valueField2])}${valueUnit2}` : 
            `${formatValue(d[valueField2])}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .text(formattedValue2);
        
        const textWidth = tempText.node().getBBox().width;
        
        maxValueWidth2 = Math.max(maxValueWidth2, textWidth);
        
        tempText.remove();
    });
    
    // 计算y2字段标题的宽度
    const tempY2Title = tempSvg.append("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .text(valueField2Name);
    
    const y2TitleWidth = tempY2Title.node().getBBox().width;
    tempY2Title.remove();
    
    // 使用最大的第二值宽度和标题宽度
    maxValueWidth2 = Math.max(maxValueWidth2, y2TitleWidth);
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 计算左边距，考虑 标签 + 图标之间的间距
    // 序号在最左边，然后是标签（右对齐），然后是图标
    const totalLeftPadding = maxLabelWidth + flagWidth + flagPadding;
    margin.left = Math.max(margin.left, totalLeftPadding);
    
    // 设置右边距，考虑第二个数值标签 + 固定距离 20px
    margin.right = Math.max(margin.right, maxValueWidth2 + 20);
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = currentChartHeight - margin.top - margin.bottom; // 使用调整后的高度
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)  // 使用固定宽度而不是百分比
        .attr("height", currentChartHeight) // 使用调整后的高度
        .attr("viewBox", `0 0 ${width} ${currentChartHeight}`) // 使用调整后的高度
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    // 如果有背景颜色设置，添加背景
    if (colors.background_color) {
        svg.style("background-color","#8BC34A" );
    }
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
    
    // 添加水平渐变（从左到右）
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
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
        
    // ---------- 10. 添加交替行背景 ----------
    if (jsonData.variation && jsonData.variation.background === "styled") {
        
        // 计算每个条形之间的间距像素值
        const step = innerHeight / dimensions.length;
        // 额外内边距 = 条形之间间距的一半
        const extraPadding = (step * barPadding) / 2;
        
        dimensions.forEach((dimension, i) => {
            if (i % 2 === 0) {
                g.append("rect")
                    .attr("x", -margin.left + 10)
                    .attr("y", yScale(dimension) - extraPadding) // 上移一段距离
                    .attr("width", innerWidth + margin.left + margin.right - 20)
                    .attr("height", yScale.bandwidth() + (extraPadding * 2)) // 增加高度
                    .attr("class","background")
                    .attr("fill", "#f5f5f5")
                    .attr("opacity", 0.5);
            }
        });
    }
    
    // ---------- 10. 绘制条形和标签 ----------
    
    // 获取描边颜色的辅助函数
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333";
    };

    // 计算图标区域的尺寸和位置
    const barHeight = yScale.bandwidth();
    const iconWidth = barHeight * 1.1; // 与下方图标尺寸保持一致
    const iconX = -iconWidth - flagPadding;
    const iconContainerWidth = iconWidth + 2*flagPadding; // 图标宽度加上一些额外的空间，用于覆盖条形图的一部分
    const iconContainerHeight = innerHeight;
    
    // 添加半透明白色矩形，包裹所有图标并略微覆盖条形图的左侧
    g.append("rect")
        .attr("x", iconX - flagPadding/2 ) // 左侧多出一点空间
        .attr("y", -3) // 上方多出一点空间
        .attr("width", iconContainerWidth) // 宽度包括图标宽度和一些额外空间，用于覆盖条形图
        .attr("height", iconContainerHeight + 3 ) // 高度覆盖所有行并有额外空间
        .attr("fill", "white")
        .attr("opacity", 0.7); // 透明度很低
    
    // 添加y2字段标题（在第一行上方）
    g.append("text")
        .attr("x", innerWidth + margin.right - 20) // 右对齐，距离图表右边缘20px
        .attr("y", yScale(sortedDimensions[0]) - 15) // 第一行上方15px
        .attr("text-anchor", "end") // 右对齐
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(valueField2Name);
    
    // 为每个维度绘制条形和标签
    sortedDimensions.forEach((dimension, index) => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const barHeight = yScale.bandwidth();
            const barWidth = xScale(+dataPoint[valueField]);
            const group = dataPoint[groupField]; // 获取组名
            
            // 绘制条形
            g.append("rect")
                .attr("x", 0)
                .attr("y", yScale(dimension))
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", variables.has_gradient ? "url(#bar-gradient)" : primaryColor)
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
                
            // 设置图标尺寸与条形高度一致
            const adjustedFlagWidth = barHeight*1.1; // 图标宽度与条形高度相同
            const adjustedFlagHeight = barHeight*1.1; // 图标高度与条形高度相同
            
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
            
            // 测量组名标签宽度
            const tempGroupText = tempSvg.append("text")
                .style("font-family", typography.label.font_family)
                .style("font-size", parseInt(typography.label.font_size) * 0.95 + "px") // 小一点的组标签
                .style("font-weight", "normal")
                .text(group);
            
            const groupLabelWidth = tempGroupText.node().getBBox().width;
            tempSvg.remove();
            
            // 标签位置：在图标左侧，右对齐（相对于最长标签）
            const labelX = iconX - flagPadding;

            // -- 动态字体大小和定位逻辑 --
            const minFontSize = 8; // 最小字体大小 (px)
            const verticalPaddingBetweenLabels = 2; // 标签之间的垂直间距 (px)

            let initialDimensionFontSize = parseInt(typography.label.font_size) || 12;
            
            let currentDimensionFontSize = initialDimensionFontSize;
            let currentGroupFontSize = Math.max(minFontSize, Math.round(currentDimensionFontSize * 0.8));

            // 当总高度超过条形高度时，按比例缩小字体
            while (
                (currentDimensionFontSize + currentGroupFontSize + verticalPaddingBetweenLabels > barHeight) &&
                currentDimensionFontSize > minFontSize
            ) {
                currentDimensionFontSize--;
                currentGroupFontSize = Math.max(minFontSize, Math.round(currentDimensionFontSize * 0.8));
            }

            // 如果维度字体已是最小，但仍超高，尝试单独缩小组字体
            if (currentDimensionFontSize === minFontSize) {
                while (
                    (currentDimensionFontSize + currentGroupFontSize + verticalPaddingBetweenLabels > barHeight) &&
                    currentGroupFontSize > minFontSize
                ) {
                    currentGroupFontSize--;
                }
            }
            
            const finalDimensionFontSize = currentDimensionFontSize;
            const finalGroupFontSize = currentGroupFontSize;

            // 计算Y轴位置，使两个标签作为一个整体在barHeight内垂直居中
            const totalEffectiveTextHeight = finalDimensionFontSize + finalGroupFontSize + verticalPaddingBetweenLabels;
            const labelsTopY = yScale(dimension) + (barHeight - totalEffectiveTextHeight) / 2;

            const dimensionLabelCenterY = labelsTopY + finalDimensionFontSize / 2;
            const groupLabelCenterY = labelsTopY + finalDimensionFontSize + verticalPaddingBetweenLabels + finalGroupFontSize / 2;
            // -- 结束动态字体大小和定位逻辑 --
            
            // 2. 添加图标 - 使用组的图标而不是维度的图标
            if (images.field && images.field[group]) {
                // 设置图标尺寸为条形高度
                const iconHeight = barHeight;
                const iconWidth = iconHeight; // 保持正方形，或根据实际比例调整
                
                // 创建一个组来包含图像
                const iconGroup = g.append("g")
                    .attr("transform", `translate(${iconX}, ${yScale(dimension)})`);
                
                // 直接添加组图标，不进行裁剪
                iconGroup.append("image")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", iconWidth)
                    .attr("height", iconHeight)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", images.field[group]);
            }
            
            // 添加维度标签
            g.append("text")
                .attr("x", labelX)
                .attr("y", dimensionLabelCenterY)
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family)
                .style("font-size", finalDimensionFontSize + "px")
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .style("dominant-baseline", "middle")
                .text(formattedDimension);
            
            // 添加组标签
            g.append("text")
                .attr("x", labelX)
                .attr("y", groupLabelCenterY)
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family)
                .style("font-size", finalGroupFontSize + "px")
                .style("font-weight", "normal")
                .style("fill", colors.text_color)
                .style("opacity", 0.8)
                .style("dominant-baseline", "middle")
                .text(group);
            // 计算动态字体大小（条形高度的60%）
            const dynamicFontSize = `${barHeight * 0.6}px`;
            // 格式化数值
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            // 临时计算文本宽度
            const tempTextSvg = d3.select(containerSelector)
                .append("svg")
                .attr("width", 0)
                .attr("height", 0)
                .style("visibility", "hidden");
            
            const tempValueText = tempTextSvg.append("text")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", dynamicFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .text(formattedValue);
            
            const valueTextWidth = tempValueText.node().getBBox().width;
            tempTextSvg.remove();
            
            // 判断是否能在条形内部放置文本（需要多留一些边距）
            const textFitsInside = barWidth > valueTextWidth ;
            
            // 添加数值标签（在条形内部或外部）
            g.append("text")
                .attr("x", textFitsInside ? barWidth - 5 : barWidth + 5) // 如果放在内部，距离条形右侧5px，否则放在外部
                .attr("y", yScale(dimension) + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", textFitsInside ? "end" : "start") // 在内部时右对齐，在外部时左对齐
                .style("font-family", typography.annotation.font_family)
                .style("font-size", dynamicFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", textFitsInside ? "#ffffff" : colors.text_color) // 在内部时使用白色，在外部时使用文本颜色
                .text(formattedValue);
                
            // 格式化第二数值
            const formattedValue2 = valueUnit2 ? 
                `${formatValue(dataPoint[valueField2])}${valueUnit2}` : 
                `${formatValue(dataPoint[valueField2])}`;
                
            // 添加第二数值标签（在右边缘，右对齐，距离右边缘20px）
            g.append("text")
                .attr("x", innerWidth + margin.right - 20) // 右对齐，距离图表右边缘20px
                .attr("y", yScale(dimension) + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end") // 右对齐
                .style("font-family", typography.annotation.font_family)
                .style("font-size", dynamicFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color)
                .text(formattedValue2);
        }
    });
    
    // 返回SVG节点
    return svg.node();
}