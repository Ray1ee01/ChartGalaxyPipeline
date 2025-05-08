/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_17",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "hierarchy":["group"],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
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


function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data;           // 实际数据点数组  
    const variables = jsonData.variables || {};     // 图表配置
    const typography = jsonData.typography || {     // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置
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
        top: 90,      // 顶部留出标题空间
        right: 60,    // 右侧足够显示数值
        bottom: 60,   // 底部边距
        left: 0      // 左侧初始空间，后续会根据标签长度调整
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名称
    const dimensionField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    const groupField = dataColumns.find(col => col.role === "group").name;
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; 
    let groupUnit = "";
    
    if (dataColumns.find(col => col.role === "x").unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }

    if (dataColumns.find(col => col.role === "group").unit !== "none") {
        groupUnit = dataColumns.find(col => col.role === "group").unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    
    // 按数值从小到大排序数据
    const sortedData = [...chartData].sort((a, b) => a[valueField] - b[valueField]);
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
    
    // ---------- 5. 计算标签宽度和图标尺寸 ----------
    
    // 创建临时SVG来测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 计算内部绘图区域初始尺寸
    const innerHeight = height - margin.top - margin.bottom;
    
    // 计算条形高度和图标尺寸
    const barHeight = innerHeight / dimensions.length;
    const iconSize = barHeight * 0.7;  // 图标高度为条形高度的0.7倍
    const textPadding = 10;  // 文本内边距
    
    // 计算最大维度标签宽度
    let maxDimLabelWidth = 0;
    dimensions.forEach(dimension => {
        // 格式化维度名称（附加单位，如果有）
        const formattedDimension = dimensionUnit ? 
            `${dimension}${dimensionUnit}` : 
            `${dimension}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${Math.min(20,Math.max(barHeight * 0.5, parseFloat(typography.annotation.font_size)))}px`)
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
        
        const textWidth = tempText.node().getBBox().width;
        
        maxDimLabelWidth = Math.max(maxDimLabelWidth, textWidth);
        
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
            .style("font-size", `${Math.min(20,Math.max(barHeight * 0.5, parseFloat(typography.annotation.font_size)))}px`)
            .style("font-weight", typography.annotation.font_weight)
            .text(formattedValue);
        
        const textWidth = tempText.node().getBBox().width;
        
        maxValueWidth = Math.max(maxValueWidth, textWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 根据标签宽度调整左右边距
    const extraLeftSpace = iconSize + textPadding + maxDimLabelWidth;
    // margin.left = Math.max(margin.left, extraLeftSpace);
    margin.right = Math.max(margin.right, maxValueWidth + textPadding);
    
    // 重新计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    
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
    
    // 获取所有唯一的组值
    const uniqueGroups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 为每个组添加不同的渐变（如果启用）
    if (variables.has_gradient) {
        uniqueGroups.forEach(group => {
            const groupColor = colors.field && colors.field[group] ? 
                colors.field[group] : 
                colors.other.primary || "#4682B4";
                
            const gradient = defs.append("linearGradient")
                .attr("id", `bar-gradient-${group.replace(/\s+/g, '-')}`)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(groupColor).brighter(0.5));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(groupColor).darker(0.3));
        });
    }
    
    // ---------- 7. 创建比例尺 ----------
    
    // 计算条形的额外间距（如果启用）
    const barPadding = variables.has_spacing ? 0.2 : 0.15;
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（用于数值）
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField]) * 1.05]) // 添加5%边距
        .range([0, innerWidth]);
    
    // ---------- 8. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${0}, ${margin.top})`);
    
    // ---------- 9. 绘制条形和标签 ----------
    
    // 获取条形颜色的辅助函数
    const getBarColor = (dataPoint) => {
        // 如果定义了字段颜色，使用它们
        if (colors.field && colors.field[dataPoint[groupField]]) {
            return colors.field[dataPoint[groupField]];
        }
        
        // 否则使用主要颜色
        return colors.other.primary || "#4682B4";
    };
    
    // 获取渐变ID的辅助函数
    const getGradientId = (dataPoint) => {
        return `url(#bar-gradient-${dataPoint[groupField].replace(/\s+/g, '-')})`;
    };
    
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
            const barY = yScale(dimension);
            
            // 确保条形从图表左边缘开始
            const barX = 0;
            
            // 调整文本大小
            const textSize = Math.min(20,Math.max(barHeight * 0.5, parseFloat(typography.annotation.font_size)));
            
            // 绘制条形
            g.append("rect")
                .attr("x", barX)
                .attr("y", barY )
                .attr("width", barWidth + margin.left)  // 条形宽度包括左边距
                .attr("height", barHeight)
                .attr("fill", variables.has_gradient ? getGradientId(dataPoint) : getBarColor(dataPoint))
                .attr("rx", variables.has_rounded_corners ? 3 : 0)
                .attr("ry", variables.has_rounded_corners ? 3 : 0)
                .style("stroke", variables.has_stroke ? getStrokeColor() : "none")
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            
            // 获取组图标
            const groupIconUrl = jsonData.images && jsonData.images.field && jsonData.images.field[dataPoint[groupField]] ? 
                jsonData.images.field[dataPoint[groupField]] : 
                null;
            
            // 计算当前维度标签的实际宽度
            const tempText = svg.append("text")
                .style("visibility", "hidden")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${textSize}px`)
                .style("font-weight", typography.label.font_weight);
            
            // 格式化标签
            const dimensionLabel = dimensionUnit ? 
                `${dimension}${dimensionUnit}` : 
                `${dimension}`;
            
            const valueLabel = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
                
            tempText.text(dimensionLabel);
            const currentDimLabelWidth = tempText.node().getBBox().width;
            
            tempText.text(valueLabel);
            const currentValueWidth = tempText.node().getBBox().width;
            
            tempText.remove();
            
            // 计算图标位置
            const iconSize = Math.min(barHeight * 0.7, 30);  // 限制最大图标大小
            const iconMinSpace = iconSize + textPadding;
            const dimLabelMinSpace = currentDimLabelWidth + textPadding * 2;
            const totalMinSpace = iconMinSpace + dimLabelMinSpace;
            
            let iconX, dimLabelX, valueLabelX;
            let dimLabelAnchor, valueLabelAnchor;
            let dimLabelColor, valueLabelColor;
            
            // 判断条形宽度决定标签位置策略
            if (barWidth + margin.left < iconMinSpace) {
                // 场景1: 条形太窄，连图标都放不下，所有元素放在外部
                iconX = margin.left + barWidth + textPadding;
                dimLabelX = iconX + iconSize + textPadding;
                valueLabelX = dimLabelX + currentDimLabelWidth + textPadding;
                dimLabelAnchor = "start";
                valueLabelAnchor = "start";
                dimLabelColor = colors.text_color || "#333333";
                valueLabelColor = colors.text_color || "#333333";
            } else if (barWidth + margin.left < totalMinSpace) {
                // 场景2: 条形能放下图标但放不下文本，图标在内部，文本在外部
                iconX = textPadding;
                dimLabelX = margin.left + barWidth + textPadding;
                valueLabelX = dimLabelX + currentDimLabelWidth + textPadding;
                dimLabelAnchor = "start";
                valueLabelAnchor = "start";
                dimLabelColor = colors.text_color || "#333333";
                valueLabelColor = colors.text_color || "#333333";
            } else {
                // 场景3: 条形够宽，图标和维度标签放在内部
                iconX = textPadding;
                dimLabelX = iconX + iconSize + textPadding;
                
                // 再判断数值标签是否能放在内部
                if (barWidth + margin.left > totalMinSpace + currentValueWidth + textPadding * 2) {
                    // 数值标签也放在内部
                    valueLabelX = barX + margin.left + barWidth - textPadding;
                    valueLabelAnchor = "end";
                    valueLabelColor = "#FFFFFF";
                } else {
                    // 数值标签放在外部
                    valueLabelX = margin.left + barWidth + textPadding;
                    valueLabelAnchor = "start";
                    valueLabelColor = colors.text_color || "#333333";
                }
                
                dimLabelAnchor = "start";
                dimLabelColor = "#FFFFFF";
            }
            
            // 垂直居中位置
            const centerY = barY + barHeight / 2;
            
            // 绘制组图标
            if (groupIconUrl) {
                // 使用图片图标
                g.append("image")
                    .attr("x", iconX)
                    .attr("y", centerY - iconSize/2)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", groupIconUrl);
            } else {
                // 使用矩形作为图标占位符
                g.append("rect")
                    .attr("x", iconX)
                    .attr("y", centerY - iconSize/2)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("fill", getBarColor(dataPoint))
                    .attr("rx", variables.has_rounded_corners ? 3 : 0)
                    .attr("ry", variables.has_rounded_corners ? 3 : 0);
            }
            
            // 绘制维度标签
            g.append("text")
                .attr("x", dimLabelX)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", dimLabelAnchor)
                .style("font-family", typography.label.font_family)
                .style("font-size", `${textSize}px`)
                .style("font-weight", typography.label.font_weight)
                .style("fill", dimLabelColor)
                .text(dimensionLabel);
            
            // 绘制数值标签
            g.append("text")
                .attr("x", valueLabelX)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", valueLabelAnchor)
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${textSize}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", valueLabelColor)
                .text(valueLabel);
        }
    });
    
    // ---------- 10. 添加图例 ----------
    
    // 计算图例位置和大小
    const legendRectSize = 16;
    const legendSpacing = 8;
    const legendTextSize = parseFloat(typography.annotation.font_size) || 12;
    const legendPadding = 20;
    
    // 计算每组图例的宽度（使用临时元素来计算文本宽度）
    const tempSvgLegend = svg.append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    let legendItemWidths = [];
    let totalLegendWidth = 0;
    
    uniqueGroups.forEach(group => {
        const groupLabel = groupUnit ? 
            `${group}${groupUnit}` : 
            `${group}`;
        
        const tempText = tempSvgLegend.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", `${legendTextSize}px`)
            .style("font-weight", typography.annotation.font_weight)
            .text(groupLabel);
        
        const textWidth = tempText.node().getBBox().width;
        const itemWidth = legendRectSize + legendSpacing + textWidth + legendPadding;
        
        legendItemWidths.push(itemWidth);
        totalLegendWidth += itemWidth;
        
        tempText.remove();
    });
    
    tempSvgLegend.remove();
    
    // 创建图例容器
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(width - totalLegendWidth) / 2}, ${height - margin.bottom / 2})`);
    
    // 添加图例项
    let xOffset = 0;
    
    uniqueGroups.forEach((group, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(${xOffset}, 0)`);
        
        // 获取组的颜色
        const groupColor = colors.field && colors.field[group] ? 
            colors.field[group] : 
            colors.other.primary || "#4682B4";
        
        // 添加颜色框
        legendItem.append("rect")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", variables.has_gradient ? `url(#bar-gradient-${group.replace(/\s+/g, '-')})` : groupColor)
            .attr("rx", variables.has_rounded_corners ? 2 : 0)
            .attr("ry", variables.has_rounded_corners ? 2 : 0)
            .style("stroke", variables.has_stroke ? getStrokeColor() : "none")
            .style("stroke-width", variables.has_stroke ? 1 : 0);
        
        // 添加文字标签
        const groupLabel = groupUnit ? 
            `${group}${groupUnit}` : 
            `${group}`;
            
        legendItem.append("text")
            .attr("x", legendRectSize + legendSpacing)
            .attr("y", legendRectSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", `${legendTextSize}px`)
            .style("font-weight", typography.annotation.font_weight)
            .style("fill", colors.text_color || "#333333")
            .text(groupLabel);
        
        // 更新下一个图例项的x偏移
        xOffset += legendItemWidths[i];
    });
    
    // 返回SVG节点
    return svg.node();
}