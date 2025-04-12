/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Stacked Bar Chart",
    "chart_name": "horizontal_stacked_bar_chart",
    "is_composite": false,
    "required_fields": ["dimension", "value", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 30], [0, 100], [2, 5]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
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

// 水平堆叠条形图实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data                // 实际数据点数组
    const variables = jsonData.variables || {};     // 图表配置，如果不存在则使用空对象
    const typography = jsonData.typography || {     // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置，如果不存在则使用默认值
    const images = jsonData.images || { field: {}, other: {} };  // 图像(国旗等)
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 检查并设置缺失的视觉效果变量，确保不会因为缺少变量而出错
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 清空容器 - 在添加新图表前移除可能存在的内容
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸和边距
    const width = variables.width;                  // 图表总宽度
    const height = variables.height;                // 图表总高度
    // 边距：top-顶部，right-右侧，bottom-底部，left-左侧
    const margin = { top: 80, right: 160, bottom: 40, left: 60 };
    
    // 计算实际绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;    // 绘图区宽度
    const innerHeight = height - margin.top - margin.bottom;  // 绘图区高度
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 提取字段名称
    const dimensionField = dataColumns.length > 0 ? dataColumns[0].name : "dimension";
    const valueField = dataColumns.length > 1 ? dataColumns[1].name : "value";
    const groupField = dataColumns.length > 2 ? dataColumns[2].name : "group";
    
    // 获取所有字段的单位（如果存在且不是"none"）
    let dimensionUnit = "";
    let valueUnit = "";
    let groupUnit = "";
    
    // 维度字段的单位
    if (dataColumns.length > 0 && dataColumns[0].unit && dataColumns[0].unit !== "none") {
        dimensionUnit = dataColumns[0].unit;
    }
    
    // 数值字段的单位
    if (dataColumns.length > 1 && dataColumns[1].unit && dataColumns[1].unit !== "none") {
        valueUnit = dataColumns[1].unit;
    }
    
    // 分组字段的单位
    if (dataColumns.length > 2 && dataColumns[2].unit && dataColumns[2].unit !== "none") {
        groupUnit = dataColumns[2].unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值和分组值
    const allDimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 找到要用的两个数据组（排除Total Paid Leave，因为它在图中不显示为单独的条）
    const displayGroups = groups.filter(g => g !== "Total Paid Leave");
    const firstGroup = displayGroups[0];  // 第一组（通常是年假）
    const secondGroup = displayGroups[1]; // 第二组（通常是公共假期）
    
    // 计算每个维度的总值，用于排序
    const dimensionTotals = {};
    allDimensions.forEach(dimension => {
        let total = 0;
        displayGroups.forEach(group => {
            const dataPoint = chartData.find(d => d[dimensionField] === dimension && d[groupField] === group);
            if (dataPoint) {
                total += +dataPoint[valueField];
            }
        });
        dimensionTotals[dimension] = total;
    });
    
    // 按总值降序排序维度
    const dimensions = [...allDimensions].sort((a, b) => {
        // 先按总值排序
        const diff = dimensionTotals[b] - dimensionTotals[a];
        if (diff !== 0) return diff;
        
        // 如果总值相同，按字母顺序排序
        return a.localeCompare(b);
    });
    
    // ---------- 5. 动态计算标签区域宽度 ----------
    
    // 创建临时SVG容器用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 标志尺寸
    const flagWidth = 20;
    const flagHeight = 15;
    const flagPadding = 5;
    
    // 图例方块尺寸
    const legendSquareSize = 12;
    const legendSpacing = 5;
    
    // 计算最大标签宽度
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
        const totalWidth = flagWidth + flagPadding + textWidth;
        
        maxLabelWidth = Math.max(maxLabelWidth, totalWidth);
        
        tempText.remove();
    });
    
    // 计算组标签宽度，用于图例
    let maxGroupWidth = 0;
    displayGroups.forEach(group => {
        const formattedGroup = groupUnit ? 
            `${group}${groupUnit}` : 
            `${group}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(formattedGroup);
        
        const textWidth = tempText.node().getBBox().width;
        
        maxGroupWidth = Math.max(maxGroupWidth, textWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 调整左侧边距，确保有足够空间放置标签和国旗
    margin.left = Math.max(margin.left, maxLabelWidth + 20);
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // ---------- 6.1 创建视觉效果 ----------
    
    const defs = svg.append("defs");
    
    // 获取颜色辅助函数
    const getColor = (group) => {
        return colors.field && colors.field[group] ? colors.field[group] : colors.other.primary;
    };
    
    // 添加阴影效果（如果启用）
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
    
    // 添加渐变效果（如果启用）
    if (variables.has_gradient) {
        displayGroups.forEach(group => {
            const gradientId = `gradient-${group.replace(/\s+/g, '-').toLowerCase()}`;
            const baseColor = getColor(group);
            
            const gradient = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(baseColor).brighter(0.5));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(baseColor).darker(0.3));
        });
    }

    //  7.添加组图例
    // Create legend group with better positioning
    const legendGroup = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top - 20})`);

    // Add legend
    const legendGap = 10;  // Gap between legends
    const availableWidth = innerWidth + margin.right -20; // Available width for legends

    // First group legend
    const legend1 = legendGroup.append("g");
    legend1.append("rect")
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", getColor(firstGroup));

    // Add first legend text with variable font size
    let fontSize1 = parseFloat(typography.label.font_size);
    const legendText1 = legend1.append("text")
        .attr("x", legendSquareSize + legendSpacing)
        .attr("y", legendSquareSize / 2)
        .attr("dy", "0.35em")
        .style("font-family", typography.label.font_family)
        .style("font-size", `${fontSize1}px`)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(firstGroup);

    // Calculate first legend width
    const legend1Width = legendSquareSize + legendSpacing + 
        legendText1.node().getBBox().width;

    // Initialize second legend position
    let legend2X = legend1Width + legendGap;

    // Second group legend
    const legend2 = legendGroup.append("g")
        .attr("transform", `translate(${legend2X}, 0)`);

    legend2.append("rect")
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", getColor(secondGroup));

    // Add second legend text with initial font size
    let fontSize2 = fontSize1;
    const legendText2 = legend2.append("text")
        .attr("x", legendSquareSize + legendSpacing)
        .attr("y", legendSquareSize / 2)
        .attr("dy", "0.35em")
        .style("font-family", typography.label.font_family)
        .style("font-size", `${fontSize2}px`)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(secondGroup);

    // Check if second legend extends beyond drawing area
    const legend2Width = legendSquareSize + legendSpacing + 
        legendText2.node().getBBox().width;
    const legend2RightEdge = legend2X + legend2Width;

    // Adjust font size if legends overflow
    if (legend2RightEdge > availableWidth) {
        // Reduce font size until it fits
        while (legend2RightEdge > availableWidth && fontSize2 > 8) {
            // Reduce font size
            fontSize2 -= 0.5;
            fontSize1 = fontSize2; // Keep same size for both legends
            
            // Update font sizes
            legendText1.style("font-size", `${fontSize1}px`);
            legendText2.style("font-size", `${fontSize2}px`);
            
            // Recalculate widths
            const newLegend1Width = legendSquareSize + legendSpacing + 
                legendText1.node().getBBox().width;
                
            // Update legend2 position
            legend2X = newLegend1Width + legendGap;
            legend2.attr("transform", `translate(${legend2X}, 0)`);
            
            // Check if it now fits
            const newLegend2Width = legendSquareSize + legendSpacing + 
                legendText2.node().getBBox().width;
            const newLegend2RightEdge = legend2X + newLegend2Width;
            
            if (newLegend2RightEdge <= availableWidth) {
                break;
            }
        }
    }
    
    // ---------- 8. 创建主绘图组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 9. 创建比例尺 ----------
    
    // 获取描边颜色
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333";
    };
    const strokeColor = getStrokeColor();
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(variables.has_spacing ? 0.3 : 0.2);
    
    // 计算最大总值
    const maxTotal = d3.max(Object.values(dimensionTotals));
    
    // X轴比例尺（用于数值） - 使用更多的可用空间，只保留5%的右侧边距
    const xScale = d3.scaleLinear()
        .domain([0, maxTotal * 1.05])
        .range([0, innerWidth]);
    
    // ---------- 10. 添加交替行背景 ----------
    if (jsonData.variation?.background === "styled") {
        dimensions.forEach((dimension, i) => {
            if (i % 2 === 0) {
                g.append("rect")
                    .attr("x", -margin.left/2)
                    .attr("y", yScale(dimension))
                    .attr("width", innerWidth + margin.left/2 + margin.right/2)
                    .attr("height", yScale.bandwidth())
                    .attr("class","background")
                    .attr("fill", colors.background_color || "#f5f5f5")
                    .attr("opacity", 0.8);
            }
        });
    }
    
    // ---------- 11. 绘制条形图和标签 ----------

    // 存储用于数值标签位置计算的变量
    const labelPosCache = {
        firstGroupMaxWidth: 0,         // 第一组最大条形宽度
        firstGroupLabelX: 0,           // 第一组标签X位置
        secondGroupLabelStartX: 0,     // 第二组标签起始X位置（第一组最长条右侧）
        secondGroupLabelOffsetX: 0     // 第二组标签偏移量
    };

    // 用于存储条形边缘的"禁区"
    const forbiddenZones = {
        firstGroup: [],  // 第一组的禁区列表
        secondGroup: []  // 第二组的禁区列表
    };

    // 边缘安全距离（标签不应太靠近边缘）
    const safeDistance = 3;

    // 创建临时SVG元素用于测量文本宽度
    const tempTextSvg = svg.append("g")
        .attr("visibility", "hidden");

    // 估算标签宽度的函数
    const estimateLabelWidth = (text) => {
        const tempText = tempTextSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .text(text);
        
        const width = tempText.node().getBBox().width;
        tempText.remove();
        return width;
    };

    // 缓存标签宽度
    const labelWidths = {
        firstGroup: {},
        secondGroup: {}
    };

    // 计算最大标签宽度
    let maxLabelWidthFirstGroup = 0;
    let maxLabelWidthSecondGroup = 0;

    // 格式化函数
    const formatValue = (value) => {
        return valueUnit ? `${value}${valueUnit}` : `${value}`;
    };

    // 第一轮：计算所有标签宽度和条形的边缘位置
    dimensions.forEach((dimension) => {
        // 获取数据点
        const firstGroupData = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === firstGroup);
        const secondGroupData = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === secondGroup);
        
        // 计算第一组条形宽度、标签宽度和禁区
        if (firstGroupData) {
            const barWidth = xScale(firstGroupData[valueField]);
            labelPosCache.firstGroupMaxWidth = Math.max(labelPosCache.firstGroupMaxWidth, barWidth);
            
            // 计算标签宽度
            const labelText = formatValue(firstGroupData[valueField]);
            const labelWidth = estimateLabelWidth(labelText);
            labelWidths.firstGroup[dimension] = labelWidth;
            maxLabelWidthFirstGroup = Math.max(maxLabelWidthFirstGroup, labelWidth);
            
            // 添加左边缘禁区 (0 ± safeDistance)
            forbiddenZones.firstGroup.push({
                start: 0 - safeDistance,
                end: 0 + safeDistance
            });
            
            // 添加右边缘禁区 (barWidth ± safeDistance)
            forbiddenZones.firstGroup.push({
                start: barWidth - safeDistance,
                end: barWidth + safeDistance
            });
        }
        
        // 计算第二组条形的起始位置、宽度和标签宽度
        if (firstGroupData && secondGroupData) {
            const firstBarWidth = xScale(firstGroupData[valueField]);
            const secondBarWidth = xScale(secondGroupData[valueField]);
            
            // 计算标签宽度
            const labelText = formatValue(secondGroupData[valueField]);
            const labelWidth = estimateLabelWidth(labelText);
            labelWidths.secondGroup[dimension] = labelWidth;
            maxLabelWidthSecondGroup = Math.max(maxLabelWidthSecondGroup, labelWidth);
            
            // 第二组起始位置是第一组的宽度
            const secondGroupStart = firstBarWidth;
            
            // 添加左边缘禁区 (secondGroupStart ± safeDistance)
            forbiddenZones.secondGroup.push({
                start: secondGroupStart - safeDistance,
                end: secondGroupStart + safeDistance
            });
            
            // 添加右边缘禁区 (secondGroupStart + secondBarWidth ± safeDistance)
            forbiddenZones.secondGroup.push({
                start: secondGroupStart + secondBarWidth - safeDistance,
                end: secondGroupStart + secondBarWidth + safeDistance
            });
        }
    });

    // 移除临时SVG
    tempTextSvg.remove();

    // 设置初始标签位置
    labelPosCache.firstGroupLabelX = labelPosCache.firstGroupMaxWidth * 0.4;
    labelPosCache.secondGroupLabelStartX = labelPosCache.firstGroupMaxWidth;
    labelPosCache.secondGroupLabelOffsetX = 10; // 默认偏移值，稍后会基于实际需求调整

    // 合并重叠的禁区
    const mergeOverlappingZones = (zones) => {
        if (zones.length <= 1) return zones;
        
        // 按开始位置排序
        zones.sort((a, b) => a.start - b.start);
        
        const merged = [zones[0]];
        
        for (let i = 1; i < zones.length; i++) {
            const current = zones[i];
            const previous = merged[merged.length - 1];
            
            if (current.start <= previous.end) {
                // 禁区重叠，合并
                previous.end = Math.max(previous.end, current.end);
            } else {
                // 不重叠，添加新禁区
                merged.push(current);
            }
        }
        
        return merged;
    };

    // 合并重叠禁区
    forbiddenZones.firstGroup = mergeOverlappingZones(forbiddenZones.firstGroup);
    forbiddenZones.secondGroup = mergeOverlappingZones(forbiddenZones.secondGroup);

    // 检查标签是否与禁区重叠
    // 考虑标签的整个宽度范围，而不仅仅是中心点
    const isLabelOverlappingForbiddenZone = (centerX, labelWidth, zones) => {
        const halfWidth = labelWidth / 2;
        const labelStart = centerX - halfWidth;
        const labelEnd = centerX + halfWidth;
        
        for (const zone of zones) {
            // 检查标签任何部分是否与禁区重叠
            if (!(labelEnd < zone.start || labelStart > zone.end)) {
                return true;
            }
        }
        return false;
    };

    // 找到最近的安全位置，确保整个标签都不在禁区
    const findNearestSafePosition = (initialX, labelWidth, zones, maxSearchDistance) => {
        // 如果已经安全，则直接返回
        if (!isLabelOverlappingForbiddenZone(initialX, labelWidth, zones)) return initialX;
        
        // 设置搜索范围相对于初始位置
        const minX = initialX - maxSearchDistance;
        const maxX = initialX + maxSearchDistance;
        
        // 向左右同时搜索安全位置
        let leftPos = initialX;
        let rightPos = initialX;
        const step = 0.5; // 搜索步长
        
        for (let offset = step; offset <= maxSearchDistance; offset += step) {
            // 尝试左侧位置
            leftPos = initialX - offset;
            if (leftPos >= minX && !isLabelOverlappingForbiddenZone(leftPos, labelWidth, zones)) {
                return leftPos;
            }
            
            // 尝试右侧位置
            rightPos = initialX + offset;
            if (rightPos <= maxX && !isLabelOverlappingForbiddenZone(rightPos, labelWidth, zones)) {
                return rightPos;
            }
        }
        
        // 如果在最大搜索范围内找不到安全位置，返回初始位置
        // 这种情况应该很少发生，因为我们的搜索范围通常足够大
        return initialX;
    };

    // 调整第一组标签位置
    // 使用最大标签宽度确保所有标签都放在安全区域
    const maxSearchDistance = labelPosCache.firstGroupMaxWidth / 2; // 允许搜索的最大距离
    labelPosCache.firstGroupLabelX = findNearestSafePosition(
        labelPosCache.firstGroupLabelX, 
        maxLabelWidthFirstGroup,
        forbiddenZones.firstGroup,
        maxSearchDistance
    );

    // 调整第二组的标签位置
    // 先尝试将标签定在第二组第一个条形宽度的20%处
    const firstDimension = dimensions[0]; // 获取第一个维度（用于计算初始偏移）
    const secondGroupFirstData = chartData.find(d => 
        d[dimensionField] === firstDimension && d[groupField] === secondGroup);

    let secondGroupInitialOffset = 10; // 默认值
    if (secondGroupFirstData) {
        // 第二组第一个条形的宽度
        const secondBarWidth = xScale(secondGroupFirstData[valueField]);
        // 设置偏移为该条形宽度的20%
        secondGroupInitialOffset = Math.max(10, secondBarWidth * 0.2);
    }
    const secondGroupLabelX = labelPosCache.secondGroupLabelStartX + secondGroupInitialOffset;

    // 调整位置避开禁区，确保整个标签都在安全区域
    const adjustedSecondLabelX = findNearestSafePosition(
        secondGroupLabelX,
        maxLabelWidthSecondGroup,
        forbiddenZones.secondGroup,
        maxSearchDistance
    );

    // 更新偏移量
    labelPosCache.secondGroupLabelOffsetX = adjustedSecondLabelX - labelPosCache.secondGroupLabelStartX;

    // 第二轮：绘制条形和标签
    dimensions.forEach((dimension, dimIndex) => {
        // 当前行的Y位置
        const barY = yScale(dimension);
        const barHeight = yScale.bandwidth();
        
        // 获取数据点
        const firstGroupData = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === firstGroup);
        const secondGroupData = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === secondGroup);
        
        // 绘制图标和维度标签
        const flagX = -flagWidth - flagPadding - 5;
        const labelY = barY + barHeight / 2;
        
        // 添加图标（如果有）
        if (images.field && images.field[dimension]) {
            g.append("image")
                .attr("x", flagX)
                .attr("y", labelY - flagHeight / 2)
                .attr("width", flagWidth)
                .attr("height", flagHeight)
                .attr("xlink:href", images.field[dimension]);
        }
        
        // 添加维度标签
        g.append("text")
            .attr("x", flagX - 5)
            .attr("y", labelY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(dimension);
        
        // 变量用于跟踪当前X位置
        let xPos = 0;
        
        // 绘制第一组条形
        if (firstGroupData) {
            const barWidth = xScale(firstGroupData[valueField]);
            
            g.append("rect")
                .attr("x", xPos)
                .attr("y", barY)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", variables.has_gradient ? 
                    `url(#gradient-${firstGroup.replace(/\s+/g, '-').toLowerCase()})` : 
                    getColor(firstGroup))
                .attr("rx", variables.has_rounded_corners ? 3 : 0)
                .attr("ry", variables.has_rounded_corners ? 3 : 0)
                .style("stroke", variables.has_stroke ? strokeColor : "none")
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
                .on("mouseover", function() {
                    d3.select(this).attr("opacity", 0.8);
                })
                .on("mouseout", function() {
                    d3.select(this).attr("opacity", 1);
                });
            
            // 检查标签是否在条形内部
            const isLabelInside = labelPosCache.firstGroupLabelX < barWidth;
            
            // 添加第一组数值标签
            g.append("text")
                .attr("x", labelPosCache.firstGroupLabelX)
                .attr("y", barY + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", typography.annotation.font_size)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", isLabelInside ? "#ffffff" : colors.text_color)
                .text(formatValue(firstGroupData[valueField]));
            
            // 更新X位置
            xPos += barWidth;
        }
        
        // 绘制第二组条形
        if (secondGroupData) {
            const barWidth = xScale(secondGroupData[valueField]);
            
            g.append("rect")
                .attr("x", xPos)
                .attr("y", barY)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", variables.has_gradient ? 
                    `url(#gradient-${secondGroup.replace(/\s+/g, '-').toLowerCase()})` : 
                    getColor(secondGroup))
                .attr("rx", variables.has_rounded_corners ? 3 : 0)
                .attr("ry", variables.has_rounded_corners ? 3 : 0)
                .style("stroke", variables.has_stroke ? strokeColor : "none")
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
                .on("mouseover", function() {
                    d3.select(this).attr("opacity", 0.8);
                })
                .on("mouseout", function() {
                    d3.select(this).attr("opacity", 1);
                });
            
            // 计算第二组标签的x坐标 - 对所有维度保持一致
            const secondLabelX = labelPosCache.secondGroupLabelStartX + labelPosCache.secondGroupLabelOffsetX;
            
            // 检查标签是否在条形内部
            const isLabelInside = secondLabelX > xPos && secondLabelX < (xPos + barWidth);
            
            // 添加第二组数值标签
            g.append("text")
                .attr("x", secondLabelX)
                .attr("y", barY + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", typography.annotation.font_size)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", isLabelInside ? "#ffffff" : colors.text_color)
                .text(formatValue(secondGroupData[valueField]));
        }
    });
    // 返回SVG节点
    return svg.node();
}