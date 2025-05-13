/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Range Chart",
    "chart_name": "horizontal_range_bar_chart_01",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "dark",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 使用D3.js实现水平分裂条形图
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    
    // 提取数据和配置
    const jsonData = data;                           // 完整JSON数据对象
    const chartData = jsonData.data.data;                 // 实际数据点数组  
    const variables = jsonData.variables || {};      // 图表配置
    const typography = jsonData.typography || {      // 字体设置，如未提供则使用默认值
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
    const height = variables.height || 600;
    
    // 设置边距
    const margin = {
        top: 90,      // 顶部空间用于标题
        right: 20,    // 右侧边距用于值标签
        bottom: 60,   // 底部边距
        left: 100     // 左侧用于维度标签
    };
    
    // ---------- 3. 提取字段名称和单位 ----------
    
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
    
    //if (dataColumns.find(col => col.role === "y").unit !== "none") {
    //    valueUnit = dataColumns.find(col => col.role === "y").unit;
    //}
    if (dataColumns.find(col => col.role === "group").unit !== "none") {
        groupUnit = dataColumns.find(col => col.role === "group").unit; 
    }
    
    // 数值格式化函数
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
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一的维度值和组值
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 如有需要可以对维度进行排序 - 当前使用原始顺序
    
    // ---------- 5. 计算标签宽度 ----------
    
    // 创建临时SVG以测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 初始填充值（将根据条形高度进行调整）
    const flagPadding = 5;
    
    // 计算最大维度标签宽度
    let maxLabelWidth = 0;
    dimensions.forEach(dimension => {
        // 格式化维度名称（如果存在单位则添加）
        const formattedDimension = dimensionUnit ? 
            `${dimension}${dimensionUnit}` : 
            `${dimension}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
        
        const textWidth = tempText.node().getBBox().width;
        const totalWidth = textWidth;
        
        maxLabelWidth = Math.max(maxLabelWidth, totalWidth);
        
        tempText.remove();
    });
    
    // 计算值标签的最大宽度
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
    
    // 计算图例项宽度
    const legendItemWidths = [];
    let totalLegendWidth = 0;
    const legendPadding = 10; // 图例项之间的间距
    
    groups.forEach(group => {
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(group);
        
        const textWidth = tempText.node().getBBox().width;
        const legendItemWidth = 15 + 5 + textWidth + legendPadding; // 颜色块(15) + 间距(5) + 文本宽度 + 右侧填充
        
        legendItemWidths.push(legendItemWidth);
        totalLegendWidth += legendItemWidth;
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 根据标签宽度调整左边距（添加一些边距）
    margin.left = Math.max(margin.left, maxLabelWidth + 10);
    margin.right = Math.max(margin.right, maxValueWidth + 10);
    
    // 计算内部绘图区域大小
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

    // 首先创建defs元素（必须在使用前创建）
    const defs = svg.append("defs");

    // 创建背景渐变
    const bgGradient = defs.append("linearGradient")
    .attr("id", "background-gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "100%");

    bgGradient.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", "#4a0032");

    bgGradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#1c3b6e");

    // 添加渐变背景（在所有其他元素之前）
    svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("class", "background")
    .attr("fill", "url(#background-gradient)")
    .attr("opacity", 1.0);

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
    
    // ---------- 7. 创建坐标轴比例尺 ----------
    
    // 计算额外的条形间距（如果启用）
    const barPadding = variables.has_spacing ? 0.3 : 0.2;

    // Y轴比例尺（用于维度） - 使用原始顺序
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    // X轴比例尺（用于值）
    // 找到最小和最大值来设置范围
    const minValue = d3.min(chartData, d => +d[valueField]);
    const maxValue = d3.max(chartData, d => +d[valueField]);

    // 修改X轴范围确保最小值和最大值都在刻度范围内
    // 这里使用更大的倍数以确保有足够的空间
    const xScale = d3.scaleLinear()
        .domain([Math.min(minValue, 0) * 1.15, maxValue + 5])
        .range([0, innerWidth]);
   
    
    // 颜色比例尺（用于组）
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => {
            if (colors.field && colors.field[group]) {
                return colors.field[group];
            }
            // 使用自定义颜色作为示例
            return i === 0 ? "#1d3c6f" : "#6fa0d8"; // 深蓝色和浅蓝色
        }));
    
    // ---------- 8. 创建图例 ----------
    
    // 计算适当的图例字体大小以防止溢出
    let legendFontSize = parseInt(typography.label.font_size);
    let calculatedTotalLegendWidth = totalLegendWidth;
    
    // 如果图例总宽度超过可用宽度，减小字体尺寸直到适合
    while (calculatedTotalLegendWidth > width - 10 && legendFontSize > 8) {
        legendFontSize--;
        
        // 使用新字体大小重新计算总宽度
        calculatedTotalLegendWidth = 0;
        const tempSvgForLegend = d3.select(containerSelector)
            .append("svg")
            .attr("width", 0)
            .attr("height", 0)
            .style("visibility", "hidden");
            
        const recalculatedWidths = [];
        
        groups.forEach(group => {
            const tempText = tempSvgForLegend.append("text")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${legendFontSize}px`)
                .style("font-weight", typography.label.font_weight)
                .text(group);
            
            const textWidth = tempText.node().getBBox().width;
            const legendItemWidth = 15 + 5 + textWidth + legendPadding;
            
            recalculatedWidths.push(legendItemWidth);
            calculatedTotalLegendWidth += legendItemWidth;
            
            tempText.remove();
        });
        
        tempSvgForLegend.remove();
        
        // 如果已经足够小，则使用新计算的宽度
        if (calculatedTotalLegendWidth <= width - 10 || legendFontSize <= 8) {
            legendItemWidths.splice(0, legendItemWidths.length, ...recalculatedWidths);
            totalLegendWidth = calculatedTotalLegendWidth;
        }
    }
    
    // 添加图例
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width / 2}, ${margin.top - 25})`);
    
    // 为每个组添加图例项，使用计算的宽度
    let legendOffset = 0;
    groups.forEach((group, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(${legendOffset}, 0)`);
        
        // 图例颜色块
        legendItem.append("circle")
            .attr("cx", 7.5)
            .attr("cy", 7.5)
            .attr("r", 7.5)
            .attr("fill", colorScale(group))
            .attr("stroke", "white")
            .attr("stroke-width", 1.2);
        
        // 图例文本
        legendItem.append("text")
            .attr("x", 20)
            .attr("y", 7.5)
            .attr("dy", "0.35em")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${legendFontSize}px`)
            .style("font-weight", typography.label.font_weight)
            .style("fill", "#ffffff")
            .text(group);
        
        // 累积偏移量用于下一个图例项
        legendOffset += legendItemWidths[i];
    });
    
    // 调整图例位置使其居中
    legend.attr("transform", `translate(${(width - totalLegendWidth) / 2}, ${margin.top - 25})`);
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    
    
    // ---------- 10. 添加网格线（Y轴） ----------
    
    // 添加垂直网格线（刻度标记）
    const xTicks = xScale.ticks(10);
    
    // 添加网格线
    g.selectAll(".grid-line")
        .data(xTicks)
        .enter()
        .append("line")
        .attr("class", "grid-line")
        .attr("x1", d => xScale(d))
        .attr("y1", 0)
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight)
        .attr("stroke", "rgba(255, 255, 255, 0.15)")
        .attr("stroke-width", 1);
    
    // 在底部添加X轴值
    g.selectAll(".x-tick-label")
        .data(xTicks)
        .enter()
        .append("text")
        .attr("class", "x-tick-label")
        .attr("x", d => xScale(d))
        .attr("y", innerHeight + 20)
        .attr("text-anchor", "middle")
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .style("fill", "white")
        .text(d => formatValue(d));
    
    // ---------- 11. 添加交替行背景 ----------
    
    if (jsonData.variation && jsonData.variation.background === "styled") {
        dimensions.forEach((dimension, i) => {
            
            g.append("rect")
                .attr("x", -margin.left + 10)
                .attr("y", yScale(dimension))
                .attr("width", innerWidth + margin.left + margin.right - 20)
                .attr("height", yScale.bandwidth())
                .attr("class", "background")
                .attr("fill", "rgba(255, 255, 255, 0.05)")
                .attr("rx", 4)
                .attr("ry", 4);
        
        });
    }
    
    // ---------- 12. 绘制条形和标记 ----------
    const barHeight = yScale.bandwidth();
    // 找到最右侧的刻度位置，用于连接线终点
    const rightmostTickX = xScale(xTicks[xTicks.length - 1]);
    
    dimensions.forEach(dimension => {
        // 获取此维度的所有数据点
        const dimensionData = chartData.filter(d => d[dimensionField] === dimension);
        
        if (dimensionData.length > 0) {
            const barHeight = yScale.bandwidth();
            const labelY = yScale(dimension) + barHeight / 2;
            
            // 添加维度标签
            g.append("text")
                .attr("x", -5)
                .attr("y", labelY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", "#ffffff")
                .text(dimension);
            
            // 两个组的数据
            const pointData = groups.map(group => {
                const dataPoint = dimensionData.find(d => d[groupField] === group);
                if (dataPoint) {
                    return {
                        group: group,
                        value: parseFloat(dataPoint[valueField]),
                        x: xScale(parseFloat(dataPoint[valueField])),
                        y: yScale(dimension) + barHeight / 2
                    };
                }
                return null;
            }).filter(d => d !== null);
            
            // 绘制连接线（从最低值数据点到右边缘）
            if (pointData.length > 0) {
                // 找到具有最低值的数据点
                const lowestValueData = pointData.reduce((lowest, current) => 
                    current.value < lowest.value ? current : lowest, pointData[0]);
                
                if (lowestValueData) {
                    // 绘制连接线 - 更粗并精确到最右侧刻度线
                    g.append("rect")
                        .attr("x", lowestValueData.x)
                        .attr("y", lowestValueData.y - 2) // 更粗的线
                        .attr("width", rightmostTickX - lowestValueData.x)
                        .attr("height", 4) // 更粗的线
                        .attr("fill", "#ffffff");
                }
            }
            
            // 添加每个数据点的标记（圆圈）
            pointData.forEach((point, i) => {
                // 绘制标记圆圈
                g.append("circle")
                    .attr("cx", point.x)
                    .attr("cy", point.y)
                    .attr("r", 8)
                    .attr("fill", colorScale(point.group))
                    .attr("stroke", "white")
                    .attr("stroke-width", 2);
                
                // 添加值标签 - 修改这里保留小数点和小数部分
                const formattedValue = valueUnit ? 
                    `${formatValue(point.value)}${valueUnit}` : 
                    `${formatValue(point.value)}`;
                
                // 创建临时文本来计算精确宽度和高度
                const tempTextGroup = svg.append("g").attr("visibility", "hidden");
                const tempTextElem = tempTextGroup.append("text")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", "bold")
                    .text(formattedValue);
                
                const textBBox = tempTextElem.node().getBBox();
                const textPadding = 8; // 文本两侧的小填充
                const labelWidth = textBBox.width + textPadding * 2;
                const labelHeight = textBBox.height + textPadding;
                
                tempTextGroup.remove();
                
                // 创建样式化值标签 - 移到圆圈右侧
                g.append("rect")
                    .attr("x", point.x + 12) // 从圆圈右侧开始
                    .attr("y", point.y - labelHeight/2) // 垂直居中
                    .attr("width", labelWidth)
                    .attr("height", labelHeight)
                    .attr("rx", 6)
                    .attr("ry", 6)
                    .attr("fill", colorScale(point.group))
                    .attr("stroke", "white")
                    .attr("stroke-width", 1);
                
                // 修改文本位置
                g.append("text")
                    .attr("x", point.x + 12 + labelWidth/2) // 文本在矩形中央
                    .attr("y", point.y)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", "bold")
                    .style("fill", "white")
                    .text(formattedValue);
            });
        }
    });
    
    // 返回SVG节点
    return svg.node();
}