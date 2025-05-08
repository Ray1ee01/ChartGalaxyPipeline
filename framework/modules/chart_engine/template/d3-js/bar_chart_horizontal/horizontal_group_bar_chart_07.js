/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Group Bar Chart",
    "chart_name": "horizontal_group_bar_chart_07",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [5,7]],
    "required_fields_icons": ["x"],
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

// 水平分组条形图实现 - 使用D3.js - 胶囊数量表示数值
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                           // 完整的JSON数据对象
    const chartData = jsonData.data.data;            // 实际数据点数组  
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
    
    // 设置视觉效果变量的默认值 - 圆角始终启用
    // variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow !== undefined ? variables.has_shadow : false;
    variables.has_gradient = variables.has_gradient !== undefined ? variables.has_gradient : false; // 虽然不用渐变填充，但保留效果选项
    variables.has_stroke = variables.has_stroke !== undefined ? variables.has_stroke : false;
    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : true; // 胶囊间需要间距
    
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
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距 - 右侧需要重新计算
    const margin = {
        top: 100,      // 顶部留出标题空间
        right: 30,    // 初始右侧边距，稍后调整
        bottom: 60,   // 底部边距
        left: 60     // 左侧初始空间，用于维度标签和图标
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
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
    
    // ---------- 4. 数据处理与值缩放 ----------
    
    // 获取唯一维度值和分组值
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 找出最大值，以确定胶囊数量
    const overallMax = d3.max(chartData, d => Math.abs(+d[valueField])) || 0;
    
    // 胶囊数量计算
    const maxCapsules = 30; // 每组最多显示30个胶囊
    // 计算每个胶囊代表的数值（处理 overallMax 为 0 的情况）
    const valuePerCapsule = overallMax > 0 ? Math.ceil(overallMax / maxCapsules) : 1;
    
    // 计算值到胶囊数量的映射函数
    const valueToCapsules = (value) => {
        if (valuePerCapsule === 0) return 0; // 避免除以零
        return Math.min(maxCapsules, Math.ceil(Math.abs(value) / valuePerCapsule));
    };
    
    // ---------- 5. 计算标签与布局 ----------
    
    // 创建临时SVG来测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
        
    // 图标和胶囊尺寸配置
    const iconSizeRatio = 0.6; // 图标高度占维度带宽的比例
    const maxIconSize = 25;    // 图标最大尺寸
    const iconPadding = 5;     // 图标和标签/胶囊之间的间距
    const capsuleWidth = 5;    // 单个胶囊宽度
    const capsuleSpacing = 2;  // 胶囊之间的间距
    
    // 计算最大维度标签宽度
    let maxDimLabelWidth = 0;
    dimensions.forEach(dimension => {
        const formattedDimension = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
        maxDimLabelWidth = Math.max(maxDimLabelWidth, tempText.node().getBBox().width);
        tempText.remove();
    });
    
    // 计算最大数值标签宽度 (基于最大可能值和单位)
    let maxValueLabelWidth = 0;
    const maxPossibleValue = overallMax;
    const formattedMaxValue = valueUnit ? `${maxPossibleValue}${valueUnit}` : `${maxPossibleValue}`;
    const tempValueText = tempSvg.append("text")
        .style("font-family", typography.annotation.font_family)
        .style("font-size", typography.annotation.font_size)
        .style("font-weight", typography.annotation.font_weight)
        .text(formattedMaxValue);
    maxValueLabelWidth = tempValueText.node().getBBox().width;
    tempValueText.remove();
    
    // 计算图例项宽度和总宽度
    const legendItemWidths = [];
    let totalLegendWidth = 0;
    const legendPadding = 15; // 图例项之间的间距 (增加间距)
    const legendCapsuleWidth = 12; // 图例胶囊宽度
    const legendCapsuleHeight = 8; // 图例胶囊高度
    const legendTextPadding = 5;   // 图例胶囊和文本之间的间距

    groups.forEach(group => {
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(group);
        const textWidth = tempText.node().getBBox().width;
        // 图例项宽度 = 胶囊宽度 + 间距 + 文本宽度 + 右侧间距
        const legendItemWidth = legendCapsuleWidth + legendTextPadding + textWidth + legendPadding;
        legendItemWidths.push(legendItemWidth);
        totalLegendWidth += legendItemWidth;
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 重新计算左边距以包含图标
    // 左边距 = 最大标签宽度 + 标签与图标间距 + 图标最大宽度 + 图标与条形图间距
    const labelIconPadding = 5; // 标签和图标之间的间距
    const iconBarPadding = 10; // 图标和条形图开始位置的间距
    margin.left = Math.max(margin.left, maxDimLabelWidth + labelIconPadding + maxIconSize + iconBarPadding);
    
    // 计算所需的最大右侧宽度 (保持不变)
    const maxCapsulesWidth = maxCapsules * (capsuleWidth + capsuleSpacing);
    const requiredRightWidth = maxCapsulesWidth + maxValueLabelWidth + 10; // 10px 额外间距
    margin.right = Math.max(margin.right, requiredRightWidth);
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 6. 创建SVG容器与效果 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 添加defs用于视觉效果 (保留阴影和纹理)
    const defs = svg.append("defs");

    const getColor = (group) => {
         if (colors.field && colors.field[group]) {
                return colors.field[group];
            }
            
    }
    
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

    // 创建斜线纹理模式 (包含渐变背景)
    const patternDensity = 6; // 固定斜线密度
    const patternStrokeWidth = 1.5; // 固定斜线宽度
    groups.forEach((group, i) => {
        const groupColor = getColor(group);
        const patternId = `pattern-${group.replace(/[^a-zA-Z0-9]/g, '-')}-${i}`; // 基于 group 生成 ID
        const gradientId = `pattern-gradient-${group.replace(/[^a-zA-Z0-9]/g, '-')}-${i}`; // 渐变 ID

        // 1. 定义 pattern 内使用的渐变
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "100%").attr("y2", "0%"); // 水平从左到右
        
        // 渐变颜色：从深到亮
        gradient.append("stop").attr("offset", "0%").attr("stop-color", d3.rgb(groupColor).darker(0.7));
        gradient.append("stop").attr("offset", "100%").attr("stop-color", d3.rgb(groupColor).brighter(1.2));

        // 2. 定义 pattern
        const pattern = defs.append("pattern")
            .attr("id", patternId)
            .attr("patternUnits", "userSpaceOnUse")
            .attr("width", patternDensity)
            .attr("height", patternDensity)
            .attr("patternTransform", "rotate(45)");
        
        // 3. 在 pattern 内添加使用上面定义的渐变的背景矩形
        pattern.append("rect")
            .attr("width", patternDensity)
            .attr("height", patternDensity)
            .attr("fill", `url(#${gradientId})`); // 使用 pattern 内的渐变填充
        
        // 4. 在 pattern 内添加白色斜线 (覆盖在渐变背景上)
        pattern.append("line")
            .attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", patternDensity)
            .attr("stroke", "white").attr("stroke-width", patternStrokeWidth).attr("opacity", 0.6);
    });
    
    // ---------- 7. 创建比例尺 ----------
    
    // Y轴比例尺（用于维度）- 使用原始顺序
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.3); // 维度组之间的间距
    
    // ---------- 8. 创建图例 ----------
    
    // 添加图例 (修改为水平胶囊，与数据条一致，并实现自动换行，且每行居中)
    const legendGroup = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(0, ${margin.top * 0.7})`); // Y 轴位置不变，X 轴将动态计算

    // 图例项样式参数
    const legendCapsuleHeightH = 10; // 水平胶囊的高度
    const legendCapsuleWidthH = 15;  // 水平胶囊的宽度
    const legendVerticalSpacing = 10; // 行之间的垂直间距
    const legendItemPadding = 15; // 图例项之间的间距
    const rowHeight = legendCapsuleHeightH + legendVerticalSpacing;

    // 1. 计算每个图例项的完整宽度（包括内部间距和项间距）
    const legendItemsData = [];
    const tempLegendSvg = d3.select(containerSelector).append("svg").attr("width", 0).attr("height", 0).style("visibility", "hidden");
    groups.forEach((group, i) => {
        const tempText = tempLegendSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(group);
        const textWidth = tempText.node().getBBox().width;
        tempText.remove();
        // 单个图例项内容宽度 = 胶囊宽度 + 胶囊与文本间距 + 文本宽度
        const itemContentWidth = legendCapsuleWidthH + legendTextPadding + textWidth;
        // 完整图例项宽度 = 内容宽度 + 项之间的间距
        const itemWidth = itemContentWidth + legendItemPadding;
        legendItemsData.push({ group: group, width: itemWidth, contentWidth: itemContentWidth, index: i });
    });
    tempLegendSvg.remove();

    // 2. 模拟布局并分组到行
    const legendRows = [];
    let currentRow = [];
    let currentRowWidth = 0;
    const maxLegendWidthForRow = width - 50 - 50; // 图例行的最大可用宽度

    legendItemsData.forEach(itemData => {
        // 检查添加此项是否会超出最大宽度 (注意第一个元素不需要检查)
        if (currentRow.length > 0 && currentRowWidth + itemData.width > maxLegendWidthForRow) {
            // 完成当前行
            legendRows.push({ items: currentRow, totalWidth: currentRowWidth - legendItemPadding }); // 减去最后一个元素的右侧间距
            // 开始新行
            currentRow = [itemData];
            currentRowWidth = itemData.width;
        } else {
            // 添加到当前行
            currentRow.push(itemData);
            currentRowWidth += itemData.width;
        }
    });
    // 添加最后一行
    if (currentRow.length > 0) {
        legendRows.push({ items: currentRow, totalWidth: currentRowWidth - legendItemPadding }); // 减去最后一个元素的右侧间距
    }

    // 3. & 4. 计算每行起始位置并绘制
    let currentY = 0;
    legendRows.forEach(row => {
        // 计算该行居中的起始 X 坐标
        const startX = (width - row.totalWidth) / 2;
        let currentX = startX;

        row.items.forEach(itemData => {
            // 创建当前图例项的容器
            const legendItem = legendGroup.append("g")
                .attr("transform", `translate(${currentX}, ${currentY})`);

            // 图例水平胶囊 (使用对应的 pattern 填充)
            const patternId = `pattern-${itemData.group.replace(/[^a-zA-Z0-9]/g, '-')}-${itemData.index}`;
            legendItem.append("rect")
                .attr("x", 0)
                .attr("y", -legendCapsuleHeightH / 2) // 垂直居中胶囊
                .attr("width", legendCapsuleWidthH)
                .attr("height", legendCapsuleHeightH)
                .attr("rx", legendCapsuleHeightH / 2)
                .attr("ry", legendCapsuleHeightH / 2)
                .attr("fill", `url(#${patternId})`);

            // 图例文本
            legendItem.append("text")
                .attr("x", legendCapsuleWidthH + legendTextPadding)
                .attr("y", 0) // 与胶囊中心对齐
                .attr("dy", "0.35em")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(itemData.group);

            // 更新下一个图例项的起始 X 坐标 (使用包含项间距的总宽度)
            currentX += itemData.width;
        });

        // 更新下一行的 Y 坐标
        currentY += rowHeight;
    });
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // 获取描边颜色（如果启用描边）
    const getStrokeColor = (barColor) => {
        return variables.has_stroke ? d3.rgb(barColor).darker(0.5) : "none";
    };
    
    // ---------- 10. 为每个维度绘制分组胶囊 ----------
    
    dimensions.forEach(dimension => {
        // 获取此维度下的所有数据点
        const dimensionData = chartData.filter(d => d[dimensionField] === dimension);
        
        if (dimensionData.length > 0) {
            const dimensionY = yScale(dimension);
            const dimensionBandwidth = yScale.bandwidth();
            
            // 计算每个组的胶囊行高度 (考虑组间间距)
            const groupSpacingRatio = 0.1; // 组间距占行高的比例
            const numGroups = groups.length;
            const totalSpacingHeight = dimensionBandwidth * groupSpacingRatio * (numGroups > 1 ? numGroups - 1 : 0);
            const availableGroupHeight = dimensionBandwidth - totalSpacingHeight;
            const groupCapsuleHeight = availableGroupHeight / numGroups;
            const finalCapsuleHeight = Math.max(4, groupCapsuleHeight); // 最小高度 4px
            const groupSpacing = dimensionBandwidth * groupSpacingRatio; // 实际间距像素值

            // 计算图标尺寸和位置
            const iconSize = Math.min(maxIconSize, dimensionBandwidth * iconSizeRatio);
            const iconY = dimensionY + (dimensionBandwidth - iconSize) / 2; // 图标垂直居中
            const iconAvailable = images.field && images.field[dimension];
            
            // --- Corrected Icon and Label Positioning --- 
            let finalLabelX;
            const labelCenterY = dimensionY + dimensionBandwidth / 2;

            if (iconAvailable) {
                // Position icon just left of the bar area (x=0)
                const iconX = -iconBarPadding - iconSize;
                // Position label left of the icon
                finalLabelX = iconX - labelIconPadding;

                // 添加维度图标
                g.append("image")
                    .attr("x", iconX)
                    .attr("y", iconY)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", images.field[dimension]);
            } else {
                // Position label just left of the bar area (x=0)
                finalLabelX = -iconBarPadding;
            }
            
            // 添加维度标签 (使用计算好的 finalLabelX)
            g.append("text")
                .attr("x", finalLabelX)
                .attr("y", labelCenterY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(dimension);
            
            // --- End of Corrected Positioning ---
            
            // 绘制每个组的胶囊
            groups.forEach((group, groupIndex) => {
                const dataPoint = dimensionData.find(d => d[groupField] === group);
                
                if (dataPoint) {
                    const value = parseFloat(dataPoint[valueField]);
                    const capsuleCount = valueToCapsules(value);
                    
                    // 计算当前组胶囊的垂直起始位置 (包含组间距)
                    const groupY = dimensionY + (groupIndex * (finalCapsuleHeight + groupSpacing));
                    
                    // 绘制胶囊
                    for (let j = 0; j < capsuleCount; j++) {
                        const capsuleX = j * (capsuleWidth + capsuleSpacing);
                        
                        g.append("rect")
                            .attr("x", capsuleX)
                            .attr("y", groupY)
                            .attr("width", capsuleWidth)
                            .attr("height", finalCapsuleHeight)
                            // 应用包含渐变的纹理填充
                            .attr("fill", `url(#pattern-${group.replace(/[^a-zA-Z0-9]/g, '-')}-${groupIndex})`)
                            // 圆角
                            .attr("rx", capsuleWidth / 2)
                            .attr("ry", capsuleWidth / 2) // 使用宽度的一半确保胶囊状
                            .style("stroke", getStrokeColor(getColor(group)))
                            .style("stroke-width", variables.has_stroke ? 1 : 0)
                            .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
                    }
                    
                    // 添加数值标签
                    const formattedValue = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
                    // 定位在最后一个胶囊之后
                    const lastCapsuleEnd = capsuleCount * (capsuleWidth + capsuleSpacing) - capsuleSpacing; // 最后一个胶囊的结束X坐标 (如果 count > 0)
                    const labelX = (capsuleCount > 0 ? lastCapsuleEnd : 0) + 5; // 如果没有胶囊，标签从0开始，否则从最后一个胶囊后5px开始
                    
                    g.append("text")
                        .attr("x", labelX)
                        .attr("y", groupY + finalCapsuleHeight / 2) // 垂直居中于胶囊行
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "start")
                        .style("font-family", typography.annotation.font_family)
                        .style("font-size", `${Math.max(finalCapsuleHeight * 0.5, parseFloat(typography.annotation.font_size))}px`)
                        .style("font-weight", typography.annotation.font_weight)
                        .style("fill", colors.text_color)
                        .text(formattedValue);
                }
            });
        }
    });
    
    // 返回SVG节点
    return svg.node();
}