/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Diverging Bar Chart",
    "chart_name": "horizontal_diverging_bar_chart_06",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group", "group2"],
    "hierarchy":["group2"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, 10000], [1, 5], [1, 3]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
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

// 全面优化的Split Comparison Chart实现
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;
    const chartData = jsonData.data.data
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "24px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "16px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];
    
    // 设置默认视觉效果变量
    variables.has_rounded_corners = variables.has_rounded_corners !== undefined ? variables.has_rounded_corners : true;
    variables.has_shadow = variables.has_shadow !== undefined ? variables.has_shadow : false;
    variables.has_gradient = variables.has_gradient !== undefined ? variables.has_gradient : false;
    variables.has_stroke = variables.has_stroke !== undefined ? variables.has_stroke : false;
    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : true;
    
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
    
    // 设置图表尺寸
    const width = variables.width || 900;
    // 动态调整高度以适应所有数据
    const rowHeight = 50; // 减小行高以容纳更多数据
    const initialMargin = { top: 60, right: 40, bottom: 40, left: 40 };
    
    // 提取字段名称
    const xField = dataColumns.find(col => col.role === "x").name; 
    const yField = dataColumns.find(col => col.role === "y").name;
    
    
    
    // 使用第一个 group 作为 categoryField，如果不存在则使用默认值
    const categoryField =dataColumns.filter(col => col.role === "group")[0].name;
    
    // 使用第二个 group 作为 developmentStatusField，如果不存在则使用默认值
    const developmentStatusField = dataColumns.filter(col => col.role === "group2")[0].name;
    
    // 获取唯一维度和类别
    const allDimensions = [...new Set(chartData.map(d => d[xField]))];
    const allLeaveTypes = [...new Set(chartData.map(d => d[categoryField]))];
    const allDevelopmentStatuses = [...new Set(chartData.map(d => d[developmentStatusField]))];
    
    // 确定左右两组的类别
    let leftCategory, rightCategory;
    
    if (allLeaveTypes.length >= 2) {
        // 如果没有预期的值，但有至少两个类别，使用前两个
        leftCategory = allLeaveTypes[0];
        rightCategory = allLeaveTypes[1];
    } else {
        // 默认值
        leftCategory = "Left Category";
        rightCategory = "Right Category";
    }
    
    // 创建左右两侧数据
    const leftData = {};
    const rightData = {};
    
    // 处理数据
    chartData.forEach(item => {
        const dimension = item[xField];
        const value = item[yField];
        const category = item[categoryField];
        const developmentStatus = item[developmentStatusField]; // 获取发展状态
        
        // 左侧组数据
        if (category === leftCategory) {
            leftData[dimension] = {
                dimension: dimension,
                value: value,
                developmentStatus: developmentStatus // 保存发展状态
            };
        }
        
        // 右侧组数据
        if (category === rightCategory) {
            rightData[dimension] = {
                dimension: dimension,
                value: value,
                developmentStatus: developmentStatus // 保存发展状态
            };
        }
    });
    
    // 对左右两组数据独立排序（按值从大到小）
    const sortedLeftData = Object.values(leftData)
        .sort((a, b) => b.value - a.value);
        
    const sortedRightData = Object.values(rightData)
        .sort((a, b) => b.value - a.value);
    
    // 确定行数（左右两侧中较长的一个）
    const rowCount = Math.max(sortedLeftData.length, sortedRightData.length);
    
    // 动态计算整体高度
    const height = initialMargin.top + (rowCount * rowHeight) + initialMargin.bottom;
    
    // 计算实际图表区域尺寸
    const margin = initialMargin;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = rowCount * rowHeight;
    
    // 设置布局参数
    const centerX = innerWidth / 2;
    const rankCircleRadius = 18; // 缩小排名圆圈
    const itemIconWidth = 40;    // 缩小图标宽度
    const itemIconHeight = 43;   // 缩小图标高度
    
    // ---------- 3. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
        
    // 处理背景设置
    if (jsonData.variation?.background === "styled") {
        svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "#f9f9f9");
    } else {
        // 添加原有的背景 - 使用棋盘格图案
        svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "url(#checkerboard)");
    }
    
    // ---------- 4. 文本测量辅助函数 ----------
    
    // 计算文本宽度的函数
    const calculateTextWidth = (text, fontSize, fontWeight, fontFamily) => {
        // 创建临时文本元素来测量宽度
        const tempText = svg.append("text")
            .style("font-family", fontFamily || typography.label.font_family)
            .style("font-size", fontSize || typography.label.font_size)
            .style("font-weight", fontWeight || typography.label.font_weight)
            .style("visibility", "hidden")
            .text(text);
        
        const width = tempText.node().getBBox().width;
        
        // 删除临时元素
        tempText.remove();
        
        return width;
    };
    
    // ---------- 5. 创建视觉效果 ----------
    
    const defs = svg.append("defs");
    
    // 创建颜色获取函数 - 修改为同时考虑类别和发展状态
    const getColor = (category, developmentStatus, index) => {
        // 基础颜色 - 左侧为绿色，右侧为蓝色
        let baseColor;
        
        // 尝试从字段映射获取颜色
        if (colors.field && colors.field[category]) {
            baseColor = colors.field[category];
        } else if (colors.available_colors && colors.available_colors.length > 0) {
            // 如果未找到，使用基于位置的可用颜色
            const colorIndex = index % colors.available_colors.length;
            baseColor = colors.available_colors[colorIndex];
        } else {
            // 如果没有定义颜色，使用默认颜色
            baseColor = category === leftCategory ? "#4BB462" : "#5271C7";
        }
        
        // 根据发展状态调整颜色深浅
        if (developmentStatus === allDevelopmentStatuses[0]) {
            // 深色版本 - 对于已发展国家
            return baseColor;
        } else {
            // 浅色版本 - 对于发展中国家
            // 将颜色转换为RGB，然后调亮
            const rgb = d3.rgb(baseColor);
            return d3.rgb(
                Math.min(255, rgb.r + 60),
                Math.min(255, rgb.g + 60),
                Math.min(255, rgb.b + 60)
            ).toString();
        }
    };
    
    // 获取描边颜色
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333";
    };
    const strokeColor = getStrokeColor();
    
    // 创建阴影效果（如果启用）
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("width", "200%")
            .attr("height", "200%");
        
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 2);
        
        filter.append("feOffset")
            .attr("dx", 2)
            .attr("dy", 2)
            .attr("result", "offsetblur");
        
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // 创建渐变效果（如果启用）
    if (variables.has_gradient) {
        // 左侧渐变
        const leftGradientId = `gradient-${leftCategory.replace(/\s+/g, '-').toLowerCase()}`;
        const leftBaseColor = getColor(leftCategory, allDevelopmentStatuses[0], 0);
        
        const leftGradient = defs.append("linearGradient")
            .attr("id", leftGradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
        
        leftGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(leftBaseColor).brighter(1.2));
        
        leftGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(leftBaseColor).darker(0.7));
        
        // 右侧渐变
        const rightGradientId = `gradient-${rightCategory.replace(/\s+/g, '-').toLowerCase()}`;
        const rightBaseColor = getColor(rightCategory, allDevelopmentStatuses[0], 0);
        
        const rightGradient = defs.append("linearGradient")
            .attr("id", rightGradientId)
            .attr("x1", "100%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "0%");
        
        rightGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(rightBaseColor).brighter(1.2));
        
        rightGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(rightBaseColor).darker(0.7));
    }
    
    // ---------- 6. 计算状态标签宽度 ----------
    
    // 计算所有可能的发展状态标签宽度
    const statusLabelWidths = {};
    allDevelopmentStatuses.forEach(status => {
        // 使用小字体(12px)计算状态标签的宽度
        statusLabelWidths[status] = calculateTextWidth(status.toUpperCase(), "12px", "normal");
    });
    
    // 获取最大标签宽度，加上一些间距作为安全边距
    const maxStatusLabelWidth = Math.max(...Object.values(statusLabelWidths));
    
    // ---------- 7. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // 添加左右两侧的标题
    let leftCategoryName = leftCategory;
    let rightCategoryName = rightCategory;

    // 左右圆圈的起始X位置
    const leftRankX = 0;
    const rightRankX = centerX + maxStatusLabelWidth - 20;

    // 计算标题文本的宽度
    let fontSize = typography.label.font_size;
    let fontSizeValue = parseFloat(fontSize);
    let leftTextWidth = calculateTextWidth(leftCategoryName, fontSize);
    let rightTextWidth = calculateTextWidth(rightCategoryName, fontSize);

    // 计算每侧可用的最大宽度
    const leftMaxWidth = centerX - 20;
    const rightMaxWidth = centerX - 20;

    // 根据需要缩小字体，直到文本适合最大宽度
    // 同时确保左右标题使用相同的字体大小
    const minFontSize = 10;
    while ((leftTextWidth > leftMaxWidth || rightTextWidth > rightMaxWidth) && 
        fontSizeValue > minFontSize) {
        // 减小字体大小
        fontSizeValue -= 1;
        fontSize = fontSizeValue + "px";
        leftTextWidth = calculateTextWidth(leftCategoryName, fontSize);
        rightTextWidth = calculateTextWidth(rightCategoryName, fontSize);
    }

    // 计算标题矩形的宽度，确保适合文本
    const leftRectWidth = leftTextWidth + 10; // 在文本两侧添加一些填充
    const rightRectWidth = rightTextWidth + 10;

    // 左侧标题 - 与左侧圆圈对齐
    const leftTitleGroup = g.append("g")
        .attr("transform", `translate(${leftRankX}, -20)`);

    leftTitleGroup.append("rect")
        .attr("x", 0)
        .attr("y", -15)
        .attr("width", leftRectWidth)
        .attr("height", 25)
        .attr("fill", "#000");

    leftTitleGroup.append("text")
        .attr("x", leftRectWidth / 2)
        .attr("y", 0)
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .style("font-family", typography.label.font_family)
        .style("font-size", fontSize)
        .style("font-weight", typography.label.font_weight)
        .style("fill", "#fff")
        .text(leftCategoryName);

    // 右侧标题 - 与右侧圆圈对齐
    const rightTitleGroup = g.append("g")
        .attr("transform", `translate(${rightRankX}, -20)`);

    rightTitleGroup.append("rect")
        .attr("x", 0)
        .attr("y", -15)
        .attr("width", rightRectWidth)
        .attr("height", 25)
        .attr("fill", "#000");

    rightTitleGroup.append("text")
        .attr("x", rightRectWidth / 2)
        .attr("y", 0)
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .style("font-family", typography.label.font_family)
        .style("font-size", fontSize)
        .style("font-weight", typography.label.font_weight)
        .style("fill", "#fff")
        .text(rightCategoryName);
 
    // ---------- 8. 创建数据可视化 ----------
    
    // 添加交替行背景
    if (jsonData.variation?.background === "styled") {
        sortedLeftData.forEach((item, i) => {
            if (i % 2 === 0) {
                g.append("rect")
                    .attr("x", -margin.left/2)
                    .attr("y", i * rowHeight)
                    .attr("width", innerWidth + margin.left/2 + margin.right/2)
                    .attr("height", rowHeight)
                    .attr("class", "background")
                    .attr("fill", "#f5f5f5")
                    .attr("opacity", 0.8);
            }
        });
    }
    
    // 找出所有数据中的最大值，确保左右两侧使用统一比例尺
    const allValues = [...sortedLeftData.map(d => d.value), ...sortedRightData.map(d => d.value)];
    const globalMaxValue = Math.max(...allValues);

    // 左侧排名圆圈和图标所占空间
    const leftIconSpace = rankCircleRadius * 3 + itemIconWidth + 10;
    
    // 右侧排名圆圈和图标所占空间
    const rightIconSpace = rankCircleRadius * 3 + itemIconWidth + 10;
    
    // 左侧安全边距
    const leftSafetyMargin = 10;
    
    // 右侧安全边距 (包括状态标签的宽度)
    const rightSafetyMargin = maxStatusLabelWidth + 15;

    // 计算左右两侧可用的最大宽度
    const leftMaxBarWidth = centerX - leftIconSpace - leftSafetyMargin;
    const rightMaxBarWidth = centerX - rightIconSpace - leftSafetyMargin;

    // 创建统一的柱状图比例尺 - 左侧
    const leftBarScale = d3.scaleLinear()
        .domain([0, globalMaxValue])
        .range([0, leftMaxBarWidth]);

    // 创建统一的柱状图比例尺 - 右侧
    // 使用相同的比例关系，确保左右两侧相同值的柱子长度相同
    const rightBarScale = d3.scaleLinear()
        .domain([0, globalMaxValue])
        .range([0, rightMaxBarWidth]);
   
    // 用于跟踪左侧已经显示过的发展状态
    const leftShownStatusLabels = new Set();
    
    // 绘制左侧条目
    sortedLeftData.forEach((item, index) => {
        const dimension = item.dimension;
        const value = item.value;
        const developmentStatus = item.developmentStatus;
        const yPos = index * rowHeight; // 此行的起始y位置
        
        // 8.1 绘制排名圆圈和数字
        const rankX = 20;
        const rankY = yPos + rowHeight / 2;
        
        const rankGroup = g.append("g")
            .attr("transform", `translate(${rankX}, ${rankY})`);
        
        rankGroup.append("circle")
            .attr("r", rankCircleRadius)
            .attr("fill", "#000");
        
        rankGroup.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size) 
            .style("font-weight",typography.label.font_weight)
            .style("fill", "#fff")
            .text(index + 1);
        
        // 8.2 添加维度图标（如国家标志）- 紧接圆圈右边
        const iconX = rankX + rankCircleRadius + 3;
        const iconY = rankY - itemIconHeight / 2;
        
        // 如果有图标则使用
        if (images.field && images.field[dimension]) {
            g.append("image")
                .attr("x", iconX)
                .attr("y", iconY)
                .attr("width", itemIconWidth)
                .attr("height", itemIconHeight)
                .attr("preserveAspectRatio","xMidYMid meet")
                .attr("xlink:href", images.field[dimension]);
        }
        
        // 8.3 显示左侧值（柱状图）
        const barStartX = iconX + itemIconWidth + 5;
        const barWidth = leftBarScale(value); // 根据值计算长度
        const barHeight = rowHeight * 0.85;
        const barY = yPos + (rowHeight - barHeight) / 2;
        const boxColor = getColor(leftCategory, developmentStatus, index);
        const FontSize = Math.floor(barHeight * 0.5) + "px";
        
        // 确定填充颜色，考虑渐变效果
        const fillColor = variables.has_gradient ? 
            `url(#gradient-${leftCategory.replace(/\s+/g, '-').toLowerCase()})` : 
            boxColor;
        
        // 绘制值框 - 使用原始矩形形状
        g.append("rect")
            .attr("x", barStartX)
            .attr("y", barY)
            .attr("width", barWidth)
            .attr("height", barHeight)
            .attr("rx", variables.has_rounded_corners ? 5 : 0)
            .attr("ry", variables.has_rounded_corners ? 5 : 0)
            .attr("fill", fillColor)
            .style("stroke", variables.has_stroke ? strokeColor : "none")
            .style("stroke-width", variables.has_stroke ? 1 : 0)
            .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
            .on("mouseover", function() {
                d3.select(this).attr("opacity", 0.8);
            })
            .on("mouseout", function() {
                d3.select(this).attr("opacity", 1);
            });
        
        // For the left bar values:
        // First, calculate the text width
        const leftFormattedValue = `${formatValue(value)}${valueUnit}`;

        // Create temporary text element to measure width
        const leftTempText = g.append("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", FontSize)
        .style("font-weight", typography.label.font_weight)
        .style("visibility", "hidden")
        .text(leftFormattedValue);

        // Get text width
        const leftTextWidth = leftTempText.node().getBBox().width;

        // Remove temporary element
        leftTempText.remove();

        // Define minimum width needed for text to fit comfortably
        const leftMinWidthForText = leftTextWidth + 10; // Add padding

        // Check if bar is wide enough for text
        if (barWidth < leftMinWidthForText) {
        // Bar too narrow - place text outside left edge
        g.append("text")
            .attr("x", barStartX + barWidth + 16) // Position right of the bar
            .attr("y", barY + barHeight / 2)
            .attr("text-anchor", "end") // Right align
            .attr("dy", "0.35em")
            .style("font-family", typography.label.font_family)
            .style("font-size", FontSize) 
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color || "#333333") // Use default text color
            .text(leftFormattedValue);
        } else {
        // Bar wide enough - place text inside
        g.append("text")
            .attr("x", barStartX + barWidth - leftTextWidth)
            .attr("y", barY + barHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .style("font-family", typography.label.font_family)
            .style("font-size", FontSize) 
            .style("font-weight", typography.label.font_weight)
            .style("fill", "#fff") // White text for inside bar
            .text(leftFormattedValue);
        }
        
        // 如果此发展状态尚未显示过标签，则添加
        if (!leftShownStatusLabels.has(developmentStatus)) {
            leftShownStatusLabels.add(developmentStatus);
            
            g.append("text")
                .attr("x", barStartX + barWidth + 5)
                .attr("y", barY + barHeight / 2)
                .attr("text-anchor", "start")
                .attr("dy", "0.35em")
                .style("font-family", typography.label.font_family)
                .style("font-size", "12px") 
                .style("font-weight",typography.label.font_weight)
                .style("fill", boxColor)
                .text(developmentStatus.toUpperCase());
        }
    });
    
    // 用于跟踪右侧已经显示过的发展状态
    const rightShownStatusLabels = new Set();
    
    // 绘制右侧条目
    sortedRightData.forEach((item, index) => {
        const dimension = item.dimension;
        const value = item.value;
        const developmentStatus = item.developmentStatus;
        const yPos = index * rowHeight; // 此行的起始y位置
        
        // 8.1 绘制排名圆圈和数字
        const rankX = centerX + maxStatusLabelWidth - 25;
        const rankY = yPos + rowHeight / 2;
        
        // 8.2 添加维度图标（如国家标志）- 紧接圆圈右边
        const iconX = rankX  + 3;
        const iconY = rankY - itemIconHeight / 2;
        
        // 如果有图标则使用
        if (images.field && images.field[dimension]) {
            g.append("image")
                .attr("x", iconX)
                .attr("y", iconY)
                .attr("width", itemIconWidth)
                .attr("height", itemIconHeight)
                .attr("preserveAspectRatio","xMidYMid meet")
                .attr("xlink:href", images.field[dimension]);
        }
        
        // 8.3 显示右侧值（柱状图）
        const barStartX = iconX + itemIconWidth + 5;
        const barWidth = rightBarScale(value); // 根据值计算长度
        const barHeight = rowHeight * 0.85;
        const barY = yPos + (rowHeight - barHeight) / 2;
        const boxColor = getColor(rightCategory, developmentStatus, index);
        const FontSize = Math.floor(barHeight * 0.5) + "px";
        
        // 确定填充颜色，考虑渐变效果
        const fillColor = variables.has_gradient ? 
            `url(#gradient-${rightCategory.replace(/\s+/g, '-').toLowerCase()})` : 
            boxColor;
        
        // 绘制值框 - 使用原始矩形形状
        g.append("rect")
            .attr("x", barStartX)
            .attr("y", barY)
            .attr("width", barWidth)
            .attr("height", barHeight)
            .attr("rx", variables.has_rounded_corners ? 5 : 0)
            .attr("ry", variables.has_rounded_corners ? 5 : 0)
            .attr("fill", fillColor)
            .style("stroke", variables.has_stroke ? strokeColor : "none")
            .style("stroke-width", variables.has_stroke ? 1 : 0)
            .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
            .on("mouseover", function() {
                d3.select(this).attr("opacity", 0.8);
            })
            .on("mouseout", function() {
                d3.select(this).attr("opacity", 1);
            });
        
        // For the right bar values:
        // First, calculate the text width
        const rightFormattedValue = `${formatValue(value)}${valueUnit}`;

        // Create temporary text element to measure width
        const rightTempText = g.append("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", FontSize)
        .style("font-weight", typography.label.font_weight)
        .style("visibility", "hidden")
        .text(rightFormattedValue);

        // Get text width
        const rightTextWidth = rightTempText.node().getBBox().width;

        // Remove temporary element
        rightTempText.remove();

        // Define minimum width needed for text to fit comfortably
        const rightMinWidthForText = rightTextWidth + 10; // Add padding

        // Check if bar is wide enough for text
        if (barWidth < rightMinWidthForText) {
        // Bar too narrow - place text outside right edge
        g.append("text")
            .attr("x", barStartX + barWidth + 5) // Position right of the bar
            .attr("y", barY + barHeight / 2)
            .attr("text-anchor", "start") // Left align
            .attr("dy", "0.35em")
            .style("font-family", typography.label.font_family)
            .style("font-size", FontSize) 
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color || "#333333") // Use default text color
            .text(rightFormattedValue);
        } else {
        // Bar wide enough - place text inside
        g.append("text")
            .attr("x", barStartX + barWidth - rightTextWidth )
            .attr("y", barY + barHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .style("font-family", typography.label.font_family)
            .style("font-size", FontSize) 
            .style("font-weight", typography.label.font_weight)
            .style("fill", "#fff") // White text for inside bar
            .text(rightFormattedValue);
        }
        
        // 如果此发展状态尚未显示过标签，则添加
        if (!rightShownStatusLabels.has(developmentStatus)) {
            rightShownStatusLabels.add(developmentStatus);
            
            // 将标签固定在预留的空间内，避免与柱状图重叠
            g.append("text")
                .attr("x", barStartX + barWidth + 5)
                .attr("y", barY + barHeight / 2)
                .attr("text-anchor", "start")
                .attr("dy", "0.35em")
                .style("font-family", typography.label.font_family)
                .style("font-size", "12px") 
                .style("font-weight",typography.label.font_weight)
                .style("fill", boxColor)
                .text(developmentStatus.toUpperCase());
        }
    });
    
    // 返回SVG节点
    return svg.node();
}