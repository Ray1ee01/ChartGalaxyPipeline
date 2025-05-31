/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_plain_chart_07",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 20], [0, "inf"], [2, 6]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "hierarchy":["group"],
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

function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data;                // 实际数据点数组  
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
        left: 80      // 左侧初始空间，用于维度标签和图标
    };
    const innerHeight = height - margin.top - margin.bottom; // 计算内部绘图区域高度
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
    
    // 定义圆形间距，半径将根据条形高度动态计算
    let circleRadius = innerHeight/dimensions.length/2; // 初始值，后续会被覆盖
    const circlePadding = 10;
    
    // 计算最大维度标签宽度
    let maxLabelWidth = 0;
    dimensions.forEach(dimension => {
        // 格式化维度名称（附加单位，如果有）
        const formattedDimension = dimensionUnit ? 
            `${dimension}${dimensionUnit}` : 
            `${dimension}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${innerHeight/dimensions.length * 0.5}px`)
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
        
        const textWidth = tempText.node().getBBox().width;
        const totalWidth = (circleRadius * 2) + circlePadding + textWidth;
        
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
            .style("font-size", `${innerHeight/dimensions.length * 0.4}px`)
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
    margin.right = Math.max(margin.right, maxValueWidth + 20);
    
    // 计算内部绘图区域尺寸
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
    
    // 为每个组添加不同的渐变（如果启用）
    if (variables.has_gradient) {
        // 获取所有唯一的组值
        const uniqueGroups = [...new Set(chartData.map(d => d[groupField]))];
        
        uniqueGroups.forEach(group => {
            const groupColor = colors.field && colors.field[group] ? 
                colors.field[group] : 
                colors.other.primary || "#882e2e";
                
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
    
    // ---------- 8. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 9. 绘制条形和标签 ----------
    
    // 获取条形颜色的辅助函数 - 基于组值而不是索引
    const getBarColor = (dataPoint) => {
        // 如果定义了字段颜色，使用它们
        if (colors.field && colors.field[dataPoint[groupField]]) {
            return colors.field[dataPoint[groupField]];
        }
        
        // 否则使用主要颜色
        return colors.other.primary || "#882e2e";
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
    
    // 使用yScale.bandwidth()计算circleRadius
    circleRadius = yScale.bandwidth() / 2 ;
    
    // 为每个维度绘制条形和标签
    sortedDimensions.forEach((dimension, index) => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const barHeight = yScale.bandwidth();
            const barWidth = xScale(+dataPoint[valueField]);
            
            // 计算圆形序号位置
            const circleX = -circleRadius * 2 - circlePadding;
            const circleY = yScale(dimension) + barHeight / 2;
            
            // 修改：绘制条形，从圆心开始
            g.append("rect")
                .attr("x", circleX)  // 修改：让条形从圆心开始
                .attr("y", yScale(dimension))
                .attr("width", barWidth + Math.abs(circleX))  // 修改：调整宽度以保持右侧位置不变
                .attr("height", barHeight)
                .attr("fill", variables.has_gradient ? getGradientId(dataPoint) : getBarColor(dataPoint))
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
            
            // 绘制黑色圆形
            g.append("circle")
                .attr("cx", circleX)
                .attr("cy", circleY)
                .attr("r", circleRadius)
                .attr("fill", "#000000"); // 黑色圆形
            const dynamicFontSize = `${barHeight * 0.5}px`;
            // 添加白色序号
            g.append("text")
                .attr("x", circleX)
                .attr("y", circleY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${barHeight * 0.5}px`)
                .style("font-weight", "bold")
                .style("fill", "#FFFFFF") // 白色文字
                .text(index + 1); // 序号从1开始
            
            // 添加维度标签
            g.append("text")
                .attr("x", circleX - circleRadius - 5)
                .attr("y", circleY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${Math.min(30, barHeight * 0.6)}px`)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(dimension);
            
            // 添加数值标签 - 改为使用对应条形的颜色
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            // 获取与条形相同的颜色
            const valueColor = variables.has_gradient ? 
                getBarColor(dataPoint) : // 使用纯色而不是渐变
                getBarColor(dataPoint);
            
            g.append("text")
                .attr("x", circleX + barWidth + Math.abs(circleX) + 5)  // 修改：调整数值标签位置
                .attr("y", yScale(dimension) + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(30, Math.max(12,barHeight * 0.6))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", valueColor) // 修改：使用条形的颜色
                .text(formattedValue);
        }
    });
    
    // ---------- 10. 改进图例 ----------
    const uniqueGroups = [...new Set(chartData.map(d => d[groupField]))];
    const barHeight = yScale.bandwidth();
    if (uniqueGroups.length > 1) {
        // 创建新的临时SVG用于测量图例文本宽度
        const legendTempSvg = svg.append("svg")
            .attr("width", 0)
            .attr("height", 0)
            .style("visibility", "hidden");
        
        // 计算每个图例项的宽度
        const legendItemPadding = 10;
        const legendItemHeight = 20; // 图例项高度
        const legendItemMargin = 10; // 图例项之间的间距
        
        // 计算图例可用的最大宽度（60%的图表宽度）
        const maxLegendWidth = width * 0.6;
        
        // 存储每个图例项的宽度和文本
        const legendItems = [];
        
        uniqueGroups.forEach(group => {
            const tempText = legendTempSvg.append("text")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .text(group);
            
            const textWidth = tempText.node().getBBox().width;
            
            // 计算整个图例项的宽度 (文本宽度 + 内边距 + 矩形宽度)
            const itemWidth = textWidth + legendItemPadding * 2;
            
            legendItems.push({
                group: group,
                width: itemWidth,
                textWidth: textWidth
            });
            
            tempText.remove();
        });
        
        // 删除临时SVG
        legendTempSvg.remove();
        
        // --- Simulate legend layout to determine total height ---
        let sim_currentX = 0;
        let sim_currentY = 0; // Y-offset of the top of the current simulated row
        const sim_rowHeight = legendItemHeight + 5; // Height of one row including spacing
        let max_sim_Y_for_last_row_top = 0;

        legendItems.forEach((item) => {
            const neededMargin = (sim_currentX === 0) ? 0 : legendItemMargin;
            if (sim_currentX !== 0 && (sim_currentX + neededMargin + item.width > maxLegendWidth)) {
                sim_currentX = 0;
                sim_currentY += sim_rowHeight;
            }
            // Update sim_currentX for the next item in the current simulated row
            sim_currentX += ((sim_currentX === 0) ? 0 : legendItemMargin) + item.width;
            max_sim_Y_for_last_row_top = Math.max(max_sim_Y_for_last_row_top, sim_currentY);
        });
        const totalLegendBlockHeight = max_sim_Y_for_last_row_top + legendItemHeight;
        
        // --- Calculate the actual Y translation for the legend group ---
        const legendPaddingAboveChart = 10; // Space between legend bottom and chart top
        const actualLegendGroupTranslateY = margin.top - legendPaddingAboveChart - totalLegendBlockHeight;

        // 创建图例容器
        const legend = svg.append("g")
            .attr("transform", `translate(${0}, ${actualLegendGroupTranslateY})`); // Use new Y translation
        
        // 计算图例布局 (this loop is for actual drawing, currentX/Y are relative to legend group)
        let currentX = 0;
        let currentY = 0;
        const rowHeight = legendItemHeight + 5; // 行高
        
        legendItems.forEach((item, i) => {
            // 检查当前行是否能放下这个图例项
            if (currentX + item.width + (i > 0 ? legendItemMargin : 0) > maxLegendWidth) {
                // 换行
                currentX = 0;
                currentY += rowHeight;
            }
            
            // 计算图例项位置
            const legendX = currentX + (i > 0 && currentX > 0 ? legendItemMargin : 0);
            const legendY = currentY;
            
            // 获取组的颜色
            const groupColor = colors.field && colors.field[item.group] ? 
                colors.field[item.group] : 
                colors.other.primary || "#882e2e";
            
            // 绘制图例背景矩形，使用组颜色
            legend.append("rect")
                .attr("x", legendX)
                .attr("y", legendY)
                .attr("width", item.width)
                .attr("height", legendItemHeight)
                .attr("fill", variables.has_gradient ?
                    `url(#bar-gradient-${item.group.replace(/\s+/g, '-')})` :
                    groupColor)
                .attr("rx", variables.has_rounded_corners ? 3 : 0)
                .attr("ry", variables.has_rounded_corners ? 3 : 0);
            
            // 添加图例文本，使用白色
            legend.append("text")
                .attr("x", legendX + item.width / 2)
                .attr("y", legendY + legendItemHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", "#FFFFFF") // 修改：使用白色文本
                .text(item.group);
            
            // 更新X位置
            currentX = legendX + item.width;
        });
    }
    
    // 返回SVG节点
    return svg.node();
}