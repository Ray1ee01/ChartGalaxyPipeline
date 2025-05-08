/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Stacked Bar Chart",
    "chart_name": "horizontal_stacked_bar_chart_3",
    "is_composite": true,
    "required_fields": ["x", "y", "y2", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["numerical"],["categorical"]],
    "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"], [2, 5]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["radius_corner", "spacing", "shadow", "gradient", "stroke"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "replace",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 水平堆叠条形图与比例圆复合图表实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data            // 实际数据点数组
    const variables = jsonData.variables || {};     // 图表配置
    const typography = jsonData.typography || {     // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "24px", font_weight: 700 },
        label: { font_family: "Arial", font_size: "14px", font_weight: 500 },
        description: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: 400 }
    };
    const colors = jsonData.colors || { 
        text_color: "#000000", 
        background_color: "#FFFFFF",
        other: { primary: "#1E88E5" }
    };
    const images = jsonData.images || { field: {}, other: {} };  // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    const titles = jsonData.titles || {};           // 标题配置
    
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
    variables.has_rounded_corners = variables.has_rounded_corners !== undefined ? variables.has_rounded_corners : false;
    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : false;
    variables.has_shadow = variables.has_shadow !== undefined ? variables.has_shadow : false;
    variables.has_gradient = variables.has_gradient !== undefined ? variables.has_gradient : false;
    variables.has_stroke = variables.has_stroke !== undefined ? variables.has_stroke : false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距
    const margin = {
        top: 90,       // 顶部留出标题空间
        right: 5,     // 右侧边距
        bottom: 40,    // 底部边距
        left: 60      // 左侧边距，给图标和文字留出空间
    };
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "dimension";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "value";
    const groupField = dataColumns.find(col => col.role === "group")?.name || "group";
    const totalField = dataColumns.find(col => col.role === "y2")?.name || "total";
    
    // 获取字段描述用于右侧圆圈图标题
    const totalFieldDescription = totalField;
    
    // 获取字段单位
    let valueUnit = "";
    let totalUnit = "";
    valueUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : 
                     dataColumns.find(col => col.role === "y")?.unit;
    totalUnit = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : 
                     dataColumns.find(col => col.role === "y2")?.unit;
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值和分组值
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 为排序和圆形图准备数据
    const firstGroupValues = {};    // 存储第一个分组值（用于排序）
    const dimensionCircleTotals = {}; // 存储圆形图数据

    // 获取所有分组，确保排序一致
    const sortedGroups = [...groups].sort();
    const primaryGroup = sortedGroups[0]; // 使用第一个分组值排序

    // 为每个维度获取第一个分组的值和圆形图数据
    dimensions.forEach(dimension => {
        // 找到该维度下的所有数据点
        const dimensionData = chartData.filter(d => d[dimensionField] === dimension);
        
        // 获取第一个分组的值（用于排序）
        const primaryGroupData = dimensionData.find(d => d[groupField] === primaryGroup);
        firstGroupValues[dimension] = primaryGroupData && primaryGroupData[valueField] !== undefined ? 
            +primaryGroupData[valueField] : 0;
        
        // 获取圆形图的值(y2/totalField)
        // 注意：总天数值应该对每个维度只有一个，取第一个有值的数据点
        const totalDaysData = dimensionData.find(d => d[totalField] !== undefined);
        dimensionCircleTotals[dimension] = totalDaysData ? +totalDaysData[totalField] : 0;
    });
    
    // 按第一个分组值降序排序维度
    const sortedDimensions = [...dimensions].sort((a, b) => {
        return firstGroupValues[b] - firstGroupValues[a];
    });
    
    // 为每个维度准备堆叠数据
    const stackData = {};
    sortedDimensions.forEach(dimension => {
        stackData[dimension] = {};
        
        let accumulator = 0;
        groups.forEach(group => {
            const dataPoint = chartData.find(d => 
                d[dimensionField] === dimension && d[groupField] === group);
            
            if (dataPoint && dataPoint[valueField] !== undefined) {
                const value = +dataPoint[valueField];
                stackData[dimension][group] = {
                    start: accumulator,
                    end: accumulator + value,
                    value: value
                };
                accumulator += value;
            } else {
                stackData[dimension][group] = {
                    start: accumulator,
                    end: accumulator,
                    value: 0
                };
            }
        });
        
        // 添加总计
        stackData[dimension].total = accumulator;
    });
    
    // ---------- 5. 布局计算 ----------
    
    // 设置堆叠条形图和圆形图的布局比例
    const barChartWidthRatio = 0.75;  // 堆叠条形图占比
    const circleChartWidthRatio = 0.25; // 圆形图占比
    
    // 计算各部分宽度
    const barChartWidth = innerWidth * barChartWidthRatio;
    const circleChartWidth = innerWidth * circleChartWidthRatio;
    
    // ---------- 6. 创建比例尺 ----------
    
    // 计算条形的额外间距（如果启用）
    const barPadding = variables.has_spacing ? 0.3 : 0.2;
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（用于堆叠条形图）
    const xScale = d3.scaleLinear()
        .domain([0, 100]) // 假设堆叠值总和为100%
        .range([0, barChartWidth]);
    
    // 圆形面积比例尺（用于总值）
    const maxCircleValue = d3.max(Object.values(dimensionCircleTotals));
    const minRadius = yScale.bandwidth() * 0.1;  // 最小半径
    const maxRadius = Math.min(yScale.bandwidth() * 1.0,circleChartWidth*0.5)  // 最大半径可以是两个条形的高度
    
    const radiusScale = d3.scaleSqrt()  // 使用平方根比例尺确保面积比例正确
        .domain([0, maxCircleValue])
        .range([minRadius, maxRadius]);
    
    // ---------- 7. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // ---------- 8. 添加SVG定义 ----------
    
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
    
    // 为每个组创建渐变（如果启用）
    if (variables.has_gradient) {
        groups.forEach(group => {
            const barColor = getColor(group);
            
            const gradient = defs.append("linearGradient")
                .attr("id", `bar-gradient-${group.replace(/\s+/g, '-')}`)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(barColor).brighter(0.5));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(barColor).darker(0.3));
        });
    }
    
    // ---------- 9. 不添加标题 ----------
    
    // ---------- 10. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 11. 获取颜色的辅助函数 ----------
    
    // 获取组的颜色
    const getColor = (group) => {
        if (colors.field && colors.field[group]) {
            return colors.field[group];
        }
        // 如果没有指定颜色，则使用主色或默认颜色
        return colors.other?.primary || "#1E88E5";
    };
    
    // ---------- 12. 添加右侧圆圈图标题 ----------
    
    if (totalFieldDescription) {
        // 计算标题位置 - 右对齐
        const titleX = width - margin.right;
        const titleY = margin.top - 20; // 标题在图表上方

        svg.append("text")
            .attr("x", titleX)
            .attr("y", titleY)
            .attr("text-anchor", "end") // 右对齐
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(totalFieldDescription);
    }
    
    // ---------- 13. 创建图例（修改后）----------
    
    // 创建临时SVG来计算文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 图例配置
    let legendSquareSize = 12;      // 图例方块大小（可能会动态缩小）
    let legendSpacing = 5;          // 方块和文本之间的间距
    let legendFontSize = parseInt(typography.label.font_size, 10); // 初始字体大小
    
    // 计算每个图例项的宽度
    const calculateLegendItemWidths = (fontSize, squareSize) => {
        const textStyle = {
            fontFamily: typography.label.font_family,
            fontSize: `${fontSize}px`,
            fontWeight: typography.label.font_weight
        };
        
        return groups.map(group => {
            const tempText = tempSvg.append("text")
                .attr("font-family", textStyle.fontFamily)
                .attr("font-size", textStyle.fontSize)
                .attr("font-weight", textStyle.fontWeight)
                .text(group);
            
            const textWidth = tempText.node().getBBox().width;
            tempText.remove();
            
            // 总宽度 = 方块宽度 + 间距 + 文本宽度
            return squareSize + legendSpacing + textWidth;
        });
    };
    
    // 初始计算图例项宽度
    let legendItemWidths = calculateLegendItemWidths(legendFontSize, legendSquareSize);
    
    // 计算所有图例项的总宽度（包括项目之间的间距）
    const totalLegendWidth = d3.sum(legendItemWidths);
    
    // 确定图例区域的宽度（与条形图同宽）
    const legendWidth = barChartWidth;
    
    // 计算需要的最小间距
    const minRequiredSpacing = 15; // 图例项之间的最小间距，避免重叠
    
    // 检查是否需要缩小字体和图例尺寸
    // 计算总宽度如果包括最小间距
    const requiredWidth = totalLegendWidth + (groups.length - 1) * minRequiredSpacing;
    
    // 如果所需宽度大于可用宽度，需要缩小
    let scaleFactor = 1.0;
    if (requiredWidth > legendWidth) {
        scaleFactor = legendWidth / requiredWidth;
        // 缩小至最小阈值
        scaleFactor = Math.max(0.6, scaleFactor); // 不允许缩小到60%以下
        
        // 应用缩放因子
        legendFontSize = Math.max(8, Math.floor(legendFontSize * scaleFactor));
        legendSquareSize = Math.max(6, Math.floor(legendSquareSize * scaleFactor));
        
        // 重新计算图例项宽度
        legendItemWidths = calculateLegendItemWidths(legendFontSize, legendSquareSize);
    }
    
    // 计算图例间的间距（均匀分布）
    const totalItemsWidth = d3.sum(legendItemWidths);
    const spacingBetweenItems = (legendWidth - totalItemsWidth) / (groups.length - 1);
    
    // 创建图例组
    const legendGroup = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top - 30})`);
    
    // 保持跟踪当前x位置
    let currentX = 0;
    
    // 添加每个图例项
    groups.forEach((group, i) => {
        const legendItem = legendGroup.append("g")
            .attr("transform", `translate(${currentX}, 0)`);
        
        // 添加图例方块
        legendItem.append("rect")
            .attr("width", legendSquareSize)
            .attr("height", legendSquareSize)
            .attr("fill", getColor(group));
        
        // 添加图例文本
        legendItem.append("text")
            .attr("x", legendSquareSize + legendSpacing)
            .attr("y", legendSquareSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${legendFontSize}px`)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(group);
        
        // 更新x位置用于下一个图例项
        // 如果不是最后一个项目，添加间距
        if (i < groups.length - 1) {
            currentX += legendItemWidths[i] + spacingBetweenItems;
        }
    });
    
    // 清除临时SVG
    tempSvg.remove();
    
    // ---------- 14. 为每个维度绘制堆叠条形和圆形 ----------
    
    sortedDimensions.forEach((dimension, index) => {
        const barHeight = yScale.bandwidth();
        const y = yScale(dimension);
        const centerY = y + barHeight / 2;
        
        // 1. 添加维度图标（如果有）
        const iconSize = Math.min(barHeight * 0.8, 30);
        const iconX = -iconSize;  // 图标位置
        
        if (images.field && images.field[dimension]) {
            g.append("image")
                .attr("x", iconX - iconSize / 2)
                .attr("y", centerY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio","xMidYMid meet")
                .attr("xlink:href", images.field[dimension]);
        }
        
        // 2. 绘制堆叠条形
        const barSegments = [];  // 存储条形段用于后续添加白线
        
        groups.forEach((group, groupIndex) => {
            if (!stackData[dimension][group]) return;
            
            const stackItem = stackData[dimension][group];
            const barWidth = xScale(stackItem.value);
            const isLastGroup = groupIndex === groups.length - 1;
            
            // 只绘制有值的部分
            if (stackItem.value > 0) {
                // 获取填充颜色（考虑渐变）
                const fillColor = variables.has_gradient ?
                    `url(#bar-gradient-${group.replace(/\s+/g, '-')})` :
                    getColor(group);
                
                // 绘制条形
                const barSegment = g.append("rect")
                    .attr("x", xScale(stackItem.start))
                    .attr("y", y)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("fill", fillColor)
                    .attr("rx", variables.has_rounded_corners ? Math.min(barHeight * 0.2, 5) : 0)
                    .attr("ry", variables.has_rounded_corners ? Math.min(barHeight * 0.2, 5) : 0)
                    .style("stroke", variables.has_stroke ? d3.rgb(getColor(group)).darker(0.5) : "none")
                    .style("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
                
                // 存储条形段信息用于后续添加白线
                barSegments.push({
                    x: xScale(stackItem.start),
                    end: xScale(stackItem.start) + barWidth,
                    y,
                    height: barHeight
                });
                
                // 测量标签宽度
                const formattedValue = `${formatValue(stackItem.value)}${valueUnit}`;
                const tempLabel = tempSvg.append("text")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .text(formattedValue);
                
                const labelWidth = tempLabel.node().getBBox().width;
                tempLabel.remove();
                
                // 判断标签是放在内部还是外部
                const minWidthForLabel = labelWidth + 5; // 确保有足够空间
                
                if (barWidth > minWidthForLabel || !isLastGroup) {
                    // 如果条形宽度足够大或不是最后一组，添加内部标签（右对齐）
                    g.append("text")
                        .attr("x", xScale(stackItem.start) + barWidth - 5) // 距离右边缘5px
                        .attr("y", centerY)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "end") // 右对齐
                        .style("font-family", typography.annotation.font_family)
                        .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                        .style("font-weight", typography.annotation.font_weight)
                        .style("fill", "#FFFFFF")  // 白色文本更易读
                        .text(formattedValue);
                } else if (isLastGroup) {
                    // 如果是最后一组且条形宽度不够，添加外部标签
                    g.append("text")
                        .attr("x", xScale(stackItem.start) + barWidth + 5) // 距离右边缘5px
                        .attr("y", centerY)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "start") // 左对齐（在条形外部）
                        .style("font-family", typography.annotation.font_family)
                        .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                        .style("font-weight", typography.annotation.font_weight)
                        .style("fill", colors.text_color)  // 使用文本颜色
                        .text(formattedValue);
                }
            }
        });
        
        // 添加白线分隔相邻的条形段
        for (let i = 1; i < barSegments.length; i++) {
            const x = barSegments[i].x;
            g.append("line")
                .attr("x1", x)
                .attr("y1", y)
                .attr("x2", x)
                .attr("y2", y + barHeight)
                .attr("stroke", "#FFFFFF")
                .attr("stroke-width", 1);
        }
        
        // 3. 绘制圆形（显示总值）
        const circleValue = dimensionCircleTotals[dimension];
        if (circleValue > 0) {
            const circleRadius = radiusScale(circleValue);
            const circleX = barChartWidth + circleChartWidth / 2;
            
            // 绘制圆形
            g.append("circle")
                .attr("cx", circleX)
                .attr("cy", centerY)
                .attr("r", circleRadius)
                .attr("fill", colors.other?.primary || "#1E88E5")
                .style("stroke", "#FFFFFF")
                .style("stroke-width", 1.5 )
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            
            // 添加总值标签
            const formattedTotal = `${formatValue(circleValue)}${totalUnit}`;
            
            // 测量文本宽度以决定放置位置
            const tempText = svg.append("text")
                .attr("x", -1000)
                .attr("y", -1000)
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .text(formattedTotal);
            
            const textWidth = tempText.node().getBBox().width;
            tempText.remove();
            
            // 如果圆足够大，将文本放在圆内；否则放在上方
            if (circleRadius * 2 > textWidth + 10) {
                g.append("text")
                    .attr("x", circleX)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", "#FFFFFF")
                    .text(formattedTotal);
            } else {
                g.append("text")
                    .attr("x", circleX)
                    .attr("y", centerY - circleRadius - 5)
                    .attr("dy", "0em")
                    .attr("text-anchor", "middle")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", typography.annotation.font_size)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", colors.text_color)
                    .text(formattedTotal);
            }
        }
    });
    
    // 返回SVG节点
    return svg.node();
}