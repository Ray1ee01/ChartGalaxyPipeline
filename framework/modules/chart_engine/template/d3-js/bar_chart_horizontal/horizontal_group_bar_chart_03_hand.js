/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Group Bar Chart",
    "chart_name": "horizontal_group_bar_chart_03_hand",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 8], [0, "inf"], [2, 6]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
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

// 水平分组条形图实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data                // 实际数据点数组
    const variables = jsonData.variables || {};     // 图表配置
    const typography = jsonData.typography || {     // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置
    const images = jsonData.images || { field: {}, other: {} };  // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
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
    
    // 为标题和副标题预留空间，即使不显示它们
    const titleHeight = 70;  // 为标题预留至少70的高度
    
    // 分析图表区域底部边距
    const bottomMargin = 50;
    
    // 初始设置边距
    const margin = { 
        top: titleHeight,     // 顶部留出标题空间
        right: 80,            // 右侧足够显示数值
        bottom: bottomMargin, // 底部边距
        left: 150             // 左侧暂时设为最小值，稍后会根据标签长度调整
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    let dimensionField = '', valueField = '', groupField = '';
    
    try {
        dimensionField = dataColumns.find(col => col.role === "x").name;
        valueField = dataColumns.find(col => col.role === "y").name;
        groupField = dataColumns.find(col => col.role === "group").name;
    } catch (error) {
        console.error("数据列定义有误", error);
        // 使用默认值防止出错
        dimensionField = dimensionField || "country";
        valueField = valueField || "value";
        groupField = groupField || "group";
    }
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; 
    let groupUnit = "";
    
    try {
        if (dataColumns.find(col => col.role === "x") && 
            dataColumns.find(col => col.role === "x").unit !== "none") {
            dimensionUnit = dataColumns.find(col => col.role === "x").unit;
        }
        
        if (dataColumns.find(col => col.role === "y") && 
            dataColumns.find(col => col.role === "y").unit !== "none") {
            valueUnit = dataColumns.find(col => col.role === "y").unit;
        }
        
        if (dataColumns.find(col => col.role === "group") && 
            dataColumns.find(col => col.role === "group").unit !== "none") {
            groupUnit = dataColumns.find(col => col.role === "group").unit; 
        }
    } catch (error) {
        console.error("获取单位时出错", error);
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取维度（如Gen Z, Millennials等）和分组（如$50 or more, $1-49, Nothing）
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // ---------- 5. 计算标签和图标空间 ----------
    
    // 创建临时SVG用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 计算维度标签最大宽度
    let maxDimensionWidth = 0;
    dimensions.forEach(dimension => {
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .text(dimension);
        
        const textWidth = tempText.node().getBBox().width;
        maxDimensionWidth = Math.max(maxDimensionWidth, textWidth);
        
        tempText.remove();
    });
    
    // 计算分组标签最大宽度
    let maxGroupWidth = 0;
    groups.forEach(group => {
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", "bold")
            .text(group);
        
        const textWidth = tempText.node().getBBox().width;
        maxGroupWidth = Math.max(maxGroupWidth, textWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 结合维度标签和组标签最大宽度，重新计算margin.left
    const maxLabelWidth = Math.max(maxDimensionWidth, maxGroupWidth);
    const dimensionLabelWidth = maxLabelWidth + 20; // 预留额外空间
    margin.left = Math.max(margin.left, dimensionLabelWidth + 20);
    
    // 计算实际绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 6. 动态计算垂直空间分配 ----------
    
    // 计算每个组内的维度数量
    const dimensionsPerGroup = {};
    let totalDimensions = 0;
    
    groups.forEach(group => {
        // 过滤出该组的数据
        const groupData = chartData.filter(d => d[groupField] === group);
        // 找出该组中所有唯一的维度
        const groupDimensions = [...new Set(groupData.map(d => d[dimensionField]))];
        // 保存该组的维度数量
        dimensionsPerGroup[group] = groupDimensions.length;
        totalDimensions += groupDimensions.length;
    });
    
    // 设置组间固定间距和组标题空间
    const groupTitleHeight = 25; // 组标题高度
    const groupMargin = 20;      // 组之间的固定间距
    
    // 计算所有组间距的总和
    const totalGroupMargins = (groups.length - 1) * groupMargin;
    
    // 计算所有组标题的总高度
    const totalGroupTitlesHeight = groups.length * groupTitleHeight;
    
    // 计算条形的可用空间 = 总高度 - 所有组间距 - 所有组标题高度
    const availableBarSpace = innerHeight - totalGroupMargins - totalGroupTitlesHeight;
    
    // 计算单个条形的理想高度
    const idealBarHeight = availableBarSpace / totalDimensions;
    
    // 计算条形间距（为条形高度的一部分）
    const barPadding = idealBarHeight * 0.2; // 条形间距为条形高度的30%
    
    // 准备保存每个组的位置和高度信息
    const groupPositions = {};
    let currentY = 0;
    
    // 为每个组计算起始位置和高度
    groups.forEach(group => {
        const numDimensions = dimensionsPerGroup[group];
        
        // 计算该组的总高度（组标题 + 所有条形高度 + 所有条形间距）
        const totalBarSpacing = (numDimensions - 1) * barPadding; // 组内所有条形间距总和
        const totalBarsHeight = numDimensions * idealBarHeight;    // 组内所有条形高度总和
        const groupHeight = groupTitleHeight + totalBarsHeight + totalBarSpacing;
        
        // 保存该组的位置信息
        groupPositions[group] = {
            startY: currentY,
            height: groupHeight,
            barHeight: idealBarHeight,
            barPadding: barPadding,
            titleHeight: groupTitleHeight
        };
        
        // 更新当前Y位置（加上组高度和组间距）
        currentY += groupHeight + groupMargin;
    });
    
    // ---------- 7. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建defs用于滤镜和渐变
    const defs = svg.append("defs");
    
    // ---------- 7.1 创建视觉效果 ----------
    
    // 添加阴影滤镜（如果启用）
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("width", "200%")
            .attr("height", "200%");
        
        // 添加阴影效果组件
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 4);
        
        filter.append("feOffset")
            .attr("dx", 4)
            .attr("dy", 4)
            .attr("result", "offsetblur");
        
        // 创建合并效果
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // 添加渐变（如果启用）
    if (variables.has_gradient) {
        groups.forEach(group => {
            const gradientId = `gradient-${group.replace(/\s+/g, '-').toLowerCase()}`;
            const baseColor = getGroupColor(group);
            
            const gradient = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(baseColor).brighter(1.2));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(baseColor).darker(0.7));
        });
    }
    
    // ---------- 8. 创建比例尺 ----------
    
    // 计算最大值用于X轴比例尺
    const maxValue = d3.max(chartData, d => +d[valueField]);
    
    // 值的X比例尺
    const xScale = d3.scaleLinear()
        .domain([0, maxValue * 1.1]) // 添加10%边距
        .range([0, innerWidth]);
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 10. 辅助函数 ----------
    
    // 获取组颜色
    function getGroupColor(group) {
        // 优先使用指定颜色
        if (colors.field && colors.field[group]) {
            return colors.field[group];
        }
        
        // 如果有可用颜色数组，按索引使用
        if (colors.available_colors && colors.available_colors.length > 0) {
            const groupIndex = groups.indexOf(group);
            return colors.available_colors[groupIndex % colors.available_colors.length];
        }
        
        // 默认颜色方案
        const defaultColors = d3.schemeTableau10; // 使用D3内置的10色方案
        const groupIndex = groups.indexOf(group);
        return defaultColors[groupIndex % defaultColors.length] || colors.other.primary || "#999";
    }
    
    // 获取描边颜色
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333"; // 默认颜色
    };
    
    
    // ---------- 11. 绘制图表 ----------
    // 为每个组创建一个分组
    groups.forEach((group, groupIndex) => {
        // 获取该组的位置信息
        const groupPos = groupPositions[group];
        const groupStartY = groupPos.startY;
        
        // 创建组标签及其背景
        const groupLabelGroup = g.append("g")
            .attr("transform", `translate(0, ${groupStartY + groupPos.titleHeight/2})`);
        
        // 创建一个临时隐藏文本来测量尺寸
        const tempText = groupLabelGroup.append("text")
            .style("visibility", "hidden")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(group);
        
        // 获取文本尺寸
        const textWidth = tempText.node().getBBox().width;
        const textHeight = tempText.node().getBBox().height;
        tempText.remove(); // 移除临时文本
        
        // 为矩形添加内边距
        const rectPadding = { x: 4, y: 2 };
        const shadowOffset = { x: 3, y: 3 }; // 阴影偏移
        
        // 创建矩形尺寸
        const rectX = -margin.left;
        const rectY = -textHeight/2 - rectPadding.y;
        const rectWidth = textWidth + rectPadding.x * 2 + 5;
        const rectHeight = textHeight + rectPadding.y * 2;
        const cornerRadius = rectPadding.y*2;

        // 创建一个右侧圆角矩形的路径
        const createRoundedRectPath = (x, y, width, height, radius) => {
            return [
                `M ${x} ${y}`,                                        // 从左上角开始
                `H ${x + width - radius}`,                           // 线到右上角减去圆角半径
                `Q ${x + width} ${y} ${x + width} ${y + radius}`,    // 右上角圆角
                `V ${y + height - radius}`,                          // 线到右下角减去圆角半径
                `Q ${x + width} ${y + height} ${x + width - radius} ${y + height}`,  // 右下角圆角
                `H ${x}`,                                            // 线到左下角
                `V ${y}`,                                            // 线到左上角
                'Z'                                                  // 闭合路径
            ].join(' ');
        };

        // 创建阴影矩形
        const shadowPath = createRoundedRectPath(
            rectX + shadowOffset.x, 
            rectY + shadowOffset.y, 
            rectWidth, 
            rectHeight, 
            cornerRadius
        );
        
        groupLabelGroup.append("path")
            .attr("d", shadowPath)
            .attr("fill", "#cccccc"); // 灰色阴影
        
        // 创建主白色矩形
        const mainPath = createRoundedRectPath(rectX, rectY, rectWidth, rectHeight, cornerRadius);
        
        groupLabelGroup.append("path")
            .attr("d", mainPath)
            .attr("fill", "#ffffff"); // 白色背景
        
        // 最后添加标签文本，使其位于顶层
        groupLabelGroup.append("text")
            .attr("x", -margin.left + 6)     // 文本位于左边距的10px处
            .attr("y", 0)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")     // 左对齐文本
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", "#000000")         // 黑色文本
            .text(group);
        
        // 筛选该组的数据
        const groupData = chartData.filter(d => d[groupField] === group);
        
        // 对该组的维度进行排序
        const groupDimensions = [...new Set(groupData.map(d => d[dimensionField]))];
        
        // 为每个维度绘制条形
        groupDimensions.forEach((dimension, dimIndex) => {
            // 查找数据点
            const dataPoint = groupData.find(d => d[dimensionField] === dimension);
            
            if (dataPoint) {
                // 条形的垂直位置（考虑组标题高度、每个条形高度和条形间距）
                const barY = groupStartY + groupPos.titleHeight + 
                             dimIndex * (groupPos.barHeight + groupPos.barPadding);
                
                // 条形宽度
                const barWidth = xScale(+dataPoint[valueField]);
                
                // 创建标签和图标组
                const labelGroup = g.append("g")
                    .attr("transform", `translate(0, ${barY + groupPos.barHeight/2})`);
                
                // 绘制维度标签（右对齐，与图标的左边缘对齐）
                labelGroup.append("text")
                    .attr("x", -5) // 左侧5像素
                    .attr("y", 0)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end") // 右对齐
                    .style("font-family", typography.label.font_family)
                    .style("font-size", `${Math.min(groupPos.barHeight * 0.9, parseFloat(typography.label.font_size))}px`)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", colors.text_color || "#333")
                    .text(dimension);
                
                // 绘制条形
                g.append("rect")
                    .attr("x", 0)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", groupPos.barHeight) // 使用为该组计算的条形高度
                    .attr("fill", variables.has_gradient ? 
                        `url(#gradient-${group.replace(/\s+/g, '-').toLowerCase()})` : 
                        getGroupColor(group))
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
                
                // 绘制数值标签（附加单位，如果有）
                const formattedValue = valueUnit ? 
                    `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                    `${formatValue(dataPoint[valueField])}`;
                
                // 创建临时文本元素来计算数值文本的宽度
                const tempText = g.append("text")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(18, Math.max(groupPos.barHeight * 0.5, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("visibility", "hidden")
                    .text(formattedValue);
                
                // 获取文本宽度
                const textWidth = tempText.node().getBBox().width;
                
                // 删除临时文本
                tempText.remove();
                
                // 获取条形颜色
                const barColor = variables.has_gradient ? 
                    getGroupColor(group) : // 渐变时使用基础颜色
                    getGroupColor(group);
                
                // 始终将文本放在条形外部的尾端
                g.append("text")
                    .attr("x", barWidth + 5) // 条形右侧5像素处
                    .attr("y", barY + groupPos.barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("fill", barColor) // 使用与条形相同的颜色
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(groupPos.barHeight * 0.9, parseFloat(typography.annotation.font_size))}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("pointer-events", "none")
                    .text(formattedValue);
            }
        });
    });
    
    const roughness = 1;
    const bowing = 1;
    const fillStyle = "zigzag";
    const randomize = false;
    const pencilFilter = false;
        
    const svgConverter = new svg2roughjs.Svg2Roughjs(containerSelector);
    svgConverter.pencilFilter = pencilFilter;
    svgConverter.randomize = randomize;
    svgConverter.svg = svg.node();
    svgConverter.roughConfig = {
        bowing,
        roughness,
        fillStyle
    };
    svgConverter.sketch();
    // Remove the first SVG element if it exists
    const firstSvg = document.querySelector(`${containerSelector} svg`);
    if (firstSvg) {
        firstSvg.remove();
    }
    

    return svg.node();
}