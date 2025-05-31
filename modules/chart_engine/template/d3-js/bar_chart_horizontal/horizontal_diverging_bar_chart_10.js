/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Diverging Bar Chart",
    "chart_name": "horizontal_diverging_bar_chart_10",
    "is_composite": false,
    "chart_for": "comparison",
    "required_fields": ["x", "y", "group","group2"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"],["categorical"]],
    "required_fields_range": [[2, 20], [0, 100], [2, 2],[2, 5]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
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

// 水平对比条形图 - 使用D3.js - 展示不同支持者组对各话题的意见对比
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                      // 完整的JSON数据对象
    const chartData = jsonData.data.data;       // 实际数据点数组
    const variables = jsonData.variables || {}; // 图表配置
    const typography = jsonData.typography || { // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        subtitle: { font_family: "Arial", font_size: "16px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333",
        available_colors: ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395"]
    };  
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || true;  // 默认启用组间距
    
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
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸和边距
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距
    const margin = { 
        top: 70,      // 顶部边距
        right: 30,     // 右侧足够显示标签
        bottom: 60,    // 底部边距
        left: 30      // 左侧边距，为支持者标签留出空间
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    let topicField, valueField, opinionGroupField, supporterGroupField;
    let valueUnit = "";
    
    // 从数据列中提取字段名称
    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    
    
    // 安全地提取字段名，并提供默认值
    if (xColumn) topicField = xColumn.name; 
    if (yColumn) valueField = yColumn.name; 
    opinionGroupField = dataColumns.filter(col => col.role === "group")[0].name;
    supporterGroupField = dataColumns.filter(col => col.role === "group2")[0].name;
   
    
    // 获取y轴字段单位（如果存在）
    if (yColumn && yColumn.unit && yColumn.unit !== "none") {
        valueUnit = yColumn.unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取各维度的唯一值
    const topics = [...new Set(chartData.map(d => d[topicField]))];
    const opinionGroups = [...new Set(chartData.map(d => d[opinionGroupField]))];
    const supporterGroups = [...new Set(chartData.map(d => d[supporterGroupField]))];
    
    // 确保只有两个意见组
    if (opinionGroups.length !== 2) {
        console.error("第一个group字段(意见类型)必须有且仅有2个唯一值");
        return;
    }
    
    // ---------- 5. 创建临时文本测量SVG ----------
    
    // 创建临时SVG用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 计算文本宽度的函数
    function getTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempText = tempSvg.append("text")
            .style("font-family", fontFamily)
            .style("font-size", fontSize)
            .style("font-weight", fontWeight)
            .text(text);
        
        const width = tempText.node().getBBox().width;
        tempText.remove();
        return width;
    }
    
    // 计算最长支持者标签的宽度
    let maxSupporterLabelWidth = 0;
    supporterGroups.forEach(supporter => {
        const textWidth = getTextWidth(
            supporter,
            typography.label.font_family,
            typography.label.font_size,
            typography.label.font_weight
        );
        maxSupporterLabelWidth = Math.max(maxSupporterLabelWidth, textWidth);
    });
    
    // 计算最大值标签的宽度
    let maxValueLabelWidth = 0;
    chartData.forEach(d => {
        const valueText = `${formatValue(d[valueField])}${valueUnit}`;
        const textWidth = getTextWidth(
            valueText, 
            typography.annotation.font_family,
            typography.annotation.font_size,
            typography.annotation.font_weight
        );
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });
    
    // 计算最长主题标题的宽度
    let maxTopicWidth = 0;
    topics.forEach(topic => {
        const textWidth = getTextWidth(
            topic,
            typography.label.font_family,
            typography.label.font_size,
            typography.label.font_weight
        );
        maxTopicWidth = Math.max(maxTopicWidth, textWidth);
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 适当调整左右边距以容纳标签和支持者标签
    // 考虑背景条宽度，确保支持者标签不与背景条重叠
    margin.left = Math.max(margin.left, maxSupporterLabelWidth + 60); // 显著增加左侧边距，确保足够空间
    margin.right = Math.max(margin.right, maxValueLabelWidth + 15);
    
    // 重新计算实际绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    // 创建defs用于滤镜和渐变
    const defs = svg.append("defs");
    
    // ---------- 6.1 创建视觉效果 ----------
    
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
        supporterGroups.forEach((supporter, i) => {
            // 为两种意见类型分别创建渐变
            opinionGroups.forEach((opinion, j) => {
                const gradientId = `gradient-${supporter.replace(/\s+/g, '-').toLowerCase()}-${opinion.replace(/\s+/g, '-').toLowerCase()}`;
                const baseColor = getOpinionColor(supporter, opinion, j);
                
                const gradient = defs.append("linearGradient")
                    .attr("id", gradientId)
                    .attr("x1", "0%")
                    .attr("y1", "0%")
                    .attr("x2", "100%")
                    .attr("y2", "0%");
                
                gradient.append("stop")
                    .attr("offset", "0%")
                    .attr("stop-color", d3.rgb(baseColor).brighter(0.2));
                
                gradient.append("stop")
                    .attr("offset", "100%")
                    .attr("stop-color", d3.rgb(baseColor).darker(0.2));
            });
        });
    }
    
    // ---------- 7. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 8. 设置颜色函数 ----------
    
    // 获取Group1颜色
    function getSupporterColor(supporter, index) {
        // 优先使用指定颜色
        if (colors.field && colors.field[supporter]) {
            return colors.field[supporter];
        }
        if (colors.other.primary) {
            return colors.other.primary;
        }
        // 如果有可用颜色数组，按索引使用
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[index % colors.available_colors.length];
        }
    }
    
    // 获取group2颜色
    function getOpinionColor(supporter, opinion, opinionIndex) {
        const baseColor = getSupporterColor(supporter, supporterGroups.indexOf(supporter));
        
        // 左侧(第一个意见)使用深色，右侧(第二个意见)使用浅色
        if (opinionIndex === 0) {
            // 深色
            return baseColor;
        } else {
            // 浅色
            return d3.rgb(baseColor).brighter(0.7);
        }
    }
    
    // ---------- 8.5. 计算全局最大值用于背景条 ----------
    
    // 查找所有数据中的最大值
    let globalMaxValue = 0;
    
    // 遍历所有数据点查找全局最大值
    topics.forEach(topic => {
        supporterGroups.forEach(supporter => {
            // 查找左侧最大值
            const leftDataPoint = chartData.find(d => 
                d[topicField] === topic && 
                d[supporterGroupField] === supporter &&
                d[opinionGroupField] === opinionGroups[0]
            );
            if (leftDataPoint) {
                globalMaxValue = Math.max(globalMaxValue, +leftDataPoint[valueField]);
            }
            
            // 查找右侧最大值
            const rightDataPoint = chartData.find(d => 
                d[topicField] === topic && 
                d[supporterGroupField] === supporter &&
                d[opinionGroupField] === opinionGroups[1]
            );
            if (rightDataPoint) {
                globalMaxValue = Math.max(globalMaxValue, +rightDataPoint[valueField]);
            }
        });
    });
    
    // 背景条长度增加20%
    const extendedGlobalMaxValue = globalMaxValue * 1.1;
    
    // ---------- 9. 计算布局参数 ----------
    
    // 计算字体大小（获取数值）
    const labelFontSize = parseFloat(typography.label.font_size);
    
    // 每个话题的高度 - 确保有足够空间容纳所有元素
    const topicHeight = innerHeight / topics.length;
    
    // 计算最小所需间距 - 保证一行文本高度即可
    const minTopicPadding = labelFontSize;
    const minOpinionLabelHeight = labelFontSize;
    
    // 话题标题到意见标签的间距 - 使用固定值
    const topicPadding = 15;
    
    // 意见标签区域的高度 - 使用一行文本高度
    const opinionLabelHeight = minOpinionLabelHeight;
    
    // 意见标签到条形图的间距 - 使用固定值
    const opinionToBarSpacing = 5;
    
    // 支持者组间距
    const supporterPadding = topicHeight * 0.05;
    
    // 每个条形的高度 - 重新计算，考虑所有必要的间距
    const barHeight = (topicHeight - topicPadding - opinionLabelHeight - opinionToBarSpacing - (supporterGroups.length - 1) * supporterPadding) / supporterGroups.length;
    
    // 创建值的x比例尺 - 分为左右两侧，使用同一个扩展后的最大值
    const halfWidth = innerWidth / 2;
    const xScaleLeft = d3.scaleLinear()
        .domain([0, extendedGlobalMaxValue])
        .range([halfWidth, 0]);
        
    const xScaleRight = d3.scaleLinear()
        .domain([0, extendedGlobalMaxValue])
        .range([0, halfWidth]);
    
    // 计算统一的背景条宽度 - 两侧使用相同的宽度
    const uniformBackgroundWidth = halfWidth;
    
    // ---------- 10. 绘制中心线 ----------
    
    // 添加中央分隔线
    g.append("line")
        .attr("x1", halfWidth)
        .attr("y1", 0)
        .attr("x2", halfWidth)
        .attr("y2", innerHeight)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2);
    
    // ---------- 12. 绘制话题组 ----------
    
    topics.forEach((topic, topicIndex) => {
        // 计算该话题组的垂直位置
        const topicY = topicIndex * topicHeight;
        
        // 计算bars的起始位置
        const barsStartY = topicY + opinionLabelHeight + topicPadding + opinionToBarSpacing;
        
        // 从bars位置向上计算意见标签的位置，使其下边缘紧挨bar上边缘
        const opinionLabelY = barsStartY - opinionToBarSpacing;
        
        // 从意见标签位置向上计算话题标题的位置，使其下边缘紧挨意见标签上边缘
        const topicTitleY = opinionLabelY - topicPadding;
        
        // 1. 绘制话题标题
        g.append("text")
            .attr("x", halfWidth)
            .attr("y", topicTitleY)
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color || "#333")
            .text(topic);
            
        // 2. 绘制意见标签
        // 绘制左侧意见标签
        g.append("text")
            .attr("x", halfWidth / 2)
            .attr("y", opinionLabelY)
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color || "#666")
            .text(opinionGroups[0]);
            
        // 绘制右侧意见标签
        g.append("text")
            .attr("x", halfWidth + halfWidth / 2)
            .attr("y", opinionLabelY)
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color || "#666")
            .text(opinionGroups[1]);
        
        // 为每个支持者组绘制条形
        supporterGroups.forEach((supporter, supporterIndex) => {
            // 计算条形的垂直位置 - 考虑支持者间距
            const barY = barsStartY + supporterIndex * (barHeight + supporterPadding);
            
            // 绘制支持者标签 - 放在左侧，确保右对齐，并确保不与背景条重叠
            g.append("text")
                .attr("x", halfWidth - uniformBackgroundWidth - 15)  // 在背景条左侧
                .attr("y", barY + barHeight / 2)
                .attr("text-anchor", "end")  // 右对齐
                .attr("dominant-baseline", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333")
                .text(supporter);
            
            // 绘制统一的背景条 - 左侧部分
            g.append("rect")
                .attr("x", halfWidth - uniformBackgroundWidth)
                .attr("y", barY)
                .attr("class", "background")
                .attr("width", uniformBackgroundWidth)
                .attr("height", barHeight)
                .attr("fill", "#f0f0f0")
                .attr("rx", variables.has_rounded_corners ? 3 : 0)
                .attr("ry", variables.has_rounded_corners ? 3 : 0)
                .attr("opacity", 0.7);
                
            // 绘制统一的背景条 - 右侧部分
            g.append("rect")
                .attr("x", halfWidth)
                .attr("y", barY)
                .attr("class", "background")
                .attr("width", uniformBackgroundWidth)
                .attr("height", barHeight)
                .attr("fill", "#f0f0f0")
                .attr("rx", variables.has_rounded_corners ? 3 : 0)
                .attr("ry", variables.has_rounded_corners ? 3 : 0)
                .attr("opacity", 0.7);
            
            // 查找左侧数据点（第一个意见类型）
            const leftDataPoint = chartData.find(d => 
                d[topicField] === topic && 
                d[supporterGroupField] === supporter &&
                d[opinionGroupField] === opinionGroups[0]
            );
            
            if (leftDataPoint) {
                const value = +leftDataPoint[valueField];
                const barWidth = halfWidth - xScaleLeft(value);
                
                // 获取左侧条形的颜色
                const leftColor = getOpinionColor(supporter, opinionGroups[0], 0);
                
                // 绘制左侧条形
                g.append("rect")
                    .attr("x", xScaleLeft(value))
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("fill", variables.has_gradient ? 
                        `url(#gradient-${supporter.replace(/\s+/g, '-').toLowerCase()}-${opinionGroups[0].replace(/\s+/g, '-').toLowerCase()})` : 
                        leftColor)
                    .attr("rx", variables.has_rounded_corners ? 3 : 0)
                    .attr("ry", variables.has_rounded_corners ? 3 : 0)
                    .style("stroke", variables.has_stroke ? "#333" : "none")
                    .style("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
                
                // 计算标签宽度
                const valueText = formatValue(value) + valueUnit;
                const labelWidth = getTextWidth(
                    valueText,
                    typography.annotation.font_family,
                    `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`,
                    typography.annotation.font_weight
                );
                
                // 如果标签宽度小于条形宽度，放在条形内部
                const labelFitsInside = labelWidth + 30< barWidth ;
                
                // 左侧值标签 - 如果在柱子内部，靠近左侧边缘放置
                g.append("text")
                    .attr("x", xScaleLeft(value) + (labelFitsInside ? 5 : -5)) // 靠近柱子左侧边缘或外侧
                    .attr("y", barY + barHeight / 2)
                    .attr("text-anchor", labelFitsInside ? "start" : "end") // 根据位置调整对齐方式
                    .attr("dominant-baseline", "middle")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", labelFitsInside ? "#ffffff" : colors.text_color || "#333")
                    .text(valueText);
            }
            
            // 查找右侧数据点（第二个意见类型）
            const rightDataPoint = chartData.find(d => 
                d[topicField] === topic && 
                d[supporterGroupField] === supporter &&
                d[opinionGroupField] === opinionGroups[1]
            );
            
            if (rightDataPoint) {
                const value = +rightDataPoint[valueField];
                const barWidth = xScaleRight(value);
                
                // 获取右侧条形的颜色
                const rightColor = getOpinionColor(supporter, opinionGroups[1], 1);
                
                // 绘制右侧条形
                g.append("rect")
                    .attr("x", halfWidth)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("fill", variables.has_gradient ? 
                        `url(#gradient-${supporter.replace(/\s+/g, '-').toLowerCase()}-${opinionGroups[1].replace(/\s+/g, '-').toLowerCase()})` : 
                        rightColor)
                    .attr("rx", variables.has_rounded_corners ? 3 : 0)
                    .attr("ry", variables.has_rounded_corners ? 3 : 0)
                    .style("stroke", variables.has_stroke ? "#333" : "none")
                    .style("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
                
                // 计算标签宽度
                const valueText = formatValue(value) + valueUnit;
                const labelWidth = getTextWidth(
                    valueText,
                    typography.annotation.font_family,
                    `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`,
                    typography.annotation.font_weight
                );
                
                // 如果标签宽度小于条形宽度，放在条形内部
                const labelFitsInside = labelWidth +30 < barWidth ;
                
                // 右侧值标签 - 如果在柱子内部，靠近右侧边缘放置
                g.append("text")
                    .attr("x", halfWidth + (labelFitsInside ? barWidth - 5 : barWidth + 5)) // 靠近柱子右侧边缘或外侧
                    .attr("y", barY + barHeight / 2)
                    .attr("text-anchor", labelFitsInside ? "end" : "start") // 根据位置调整对齐方式
                    .attr("dominant-baseline", "middle")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", labelFitsInside ? "#ffffff" : colors.text_color || "#333")
                    .text(valueText);
            }
        });
    });
    
    return svg.node();
}