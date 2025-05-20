/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Group Bar Chart",
    "chart_name": "horizontal_group_bar_chart_04",
    "is_composite": false,
    "required_fields": ["x", "y", "group", "group2"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"], ["categorical"]],
    "hierarchy":["group","group2"],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 5], [2, 5]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
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


// 水平分组条形图实现 - 使用D3.js  //horizontal_grouped_bar_chart_05
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                       // 完整的JSON数据对象
    const chartData = jsonData.data.data;        // 实际数据点数组  
    const variables = jsonData.variables || {};  // 图表配置
    const typography = jsonData.typography || {  // 字体设置，如果不存在则使用默认值
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
    
    // 设置边距
    const margin = {
        top: 40,      // 顶部留出标题空间
        right: 60,   // 右侧足够显示数值和分组标签
        bottom: 30,   // 底部边距
        left: 40     // 左侧空间减少，因为我们不显示维度文本，只显示图标
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    
    // 提取群组字段（默认取前两个group角色的列）
    
    const primaryGroupField = dataColumns.filter(col => col.role === "group")[0].name;
    const secondaryGroupField = dataColumns.filter(col => col.role === "group2")[0].name;
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; 
    
    if (dataColumns.find(col => col.role === "x").unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值和分组值
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const primaryGroups = [...new Set(chartData.map(d => d[primaryGroupField]))];
    const secondaryGroups = [...new Set(chartData.map(d => d[secondaryGroupField]))];
    
    // 按主要分组和数值进行分组和排序
    const groupedData = {};
    primaryGroups.forEach(group => {
        // 过滤属于此组的数据
        const groupItems = chartData.filter(d => d[primaryGroupField] === group);
        
        // 按数值降序排序
        const sortedItems = [...groupItems].sort((a, b) => b[valueField] - a[valueField]);
        
        groupedData[group] = sortedItems;
    });
    
    // ---------- 5. 计算标签宽度 ----------
    
    // 创建临时SVG来测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 图标尺寸
    const flagWidth = 20;
    const flagHeight = 15;
    const flagPadding = 5;
    const groupIconWidth = 20;
    const groupIconHeight = 15;
    const groupIconPadding = 5;
    
    // 计算最大数值标签宽度
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
    
    // 计算分组注释的最大宽度
    let maxGroupNoteWidth = 0;
    primaryGroups.forEach(group => {
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family) 
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(group);
        
        const textWidth = tempText.node().getBBox().width;
        
        maxGroupNoteWidth = Math.max(maxGroupNoteWidth, textWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 图标的总宽度
    const iconsWidth = flagWidth + flagPadding + groupIconWidth + groupIconPadding;
    
    // 根据图标尺寸调整左边距
    margin.left = Math.max(margin.left, iconsWidth + 40);
    
    
    // ---------- 6. 计算分组布局 ----------
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 计算合适的条形高度，确保所有条形在可用高度内可见
    // 计算总条形数量和组数
    let totalBars = 0;
    primaryGroups.forEach(group => {
        totalBars += groupedData[group].length;
    });
    
    const numGroups = primaryGroups.length;
    
    // 计算组间间距的总高度
    const groupPaddingRatio = 0.15; // 组间距占总高度的比例
    const groupPadding = innerHeight * groupPaddingRatio / (numGroups + 1); // 分配给每个组间距
    const totalGroupPadding = groupPadding * (numGroups - 1);
    
    // 计算可用于条形的总高度
    const availableForBars = innerHeight - totalGroupPadding;
    
    // 计算条形高度和条形间距
    const barPaddingRatio = variables.has_spacing ? 0.3 : 0.15; // 条形间距占条形高度的比例
    
    // 计算理想的条形高度(包括间距)
    const idealBarUnitHeight = availableForBars / totalBars;
    
    // 实际条形高度(不包括间距)
    const barHeight = idealBarUnitHeight * (1 - barPaddingRatio);
    const barPadding = idealBarUnitHeight * barPaddingRatio;
    
    // 计算每组的高度和偏移量
    const groupHeights = {};
    const groupOffsets = {};
    
    let currentOffset = margin.top;
    primaryGroups.forEach(group => {
        const itemCount = groupedData[group].length;
        // 计算当前组的总高度（包括所有条形和条形间距）
        const groupHeight = itemCount * barHeight + (itemCount - 1) * barPadding;
        
        groupHeights[group] = groupHeight;
        groupOffsets[group] = currentOffset;
        
        // 更新下一组的起始位置
        currentOffset += groupHeight + groupPadding;
    });
    
    // ---------- 7. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height) // 使用定义的高度，不进行自动调整
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
    
    // 为每个主要分组添加渐变（如果启用）
    if (variables.has_gradient) {
        primaryGroups.forEach(group => {
            const groupColor = colors.field[group] || colors.other.primary || "#3ca951";
            
            const gradient = defs.append("linearGradient")
                .attr("id", `bar-gradient-${group.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`)
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
    
    // ---------- 8. 创建比例尺 ----------
    
    // X轴比例尺（用于数值）
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField]) * 1.05]) // 添加5%边距
        .range([0, innerWidth]);
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`);
    
    // ---------- 10. 渲染每个分组 ----------
    
    // 获取条形颜色的辅助函数
    const getBarColor = (group) => {
        return colors.field[group] || colors.other.primary || "#3ca951";
    };
    
    // 获取描边颜色的辅助函数
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333";
    };
    // 在条形左侧添加灰色竖线
    g.append("line")
        .attr("x1", 0)
        .attr("y1", margin.top)
        .attr("x2", 0)
        .attr("y2", height - margin.bottom)
        .attr("stroke", "#cccccc")
        .attr("stroke-width", 3);
    // 遍历每个主要分组，添加背景矩形
    primaryGroups.forEach(group => {
        const groupData = groupedData[group];
        const groupOffset = groupOffsets[group];
        const groupHeight = groupHeights[group];
        const barColor = getBarColor(group);
        
        // 添加组背景矩形（使用组颜色的浅色调）
        if (groupData.length > 0) {
            const bgColor = d3.rgb(barColor).brighter(1.5);
            bgColor.opacity = 0.2; // 设置半透明
            
            g.append("rect")
                .attr("x", 0) // 背景矩形从bar左边缘开始
                .attr("y", groupOffset)
                .attr("width", innerWidth + margin.right) // 宽度调整为内部宽度加右边距
                .attr("height", groupHeight)
                .attr("fill", bgColor)
                .attr("class","background")
                .attr("rx", variables.has_rounded_corners ? 5 : 0)
                .attr("ry", variables.has_rounded_corners ? 5 : 0);
        }
        
        // 添加分组注释
        if (groupData.length > 0) {
            const lastItemIndex = groupData.length - 1;
            const lastItemY = groupOffset + lastItemIndex * (barHeight + barPadding) + barHeight / 2;
            
            g.append("text")
                .attr("x",  width - margin.left - 10)
                .attr("y", lastItemY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family) // 使用label字体
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#000000")
                
                .text(group);
        }
        
        // 为组中的每个项目绘制条形和标签
        groupData.forEach((dataPoint, index) => {
            // 计算条形的y坐标，考虑到条形间距
            const yPos = groupOffset + index * (barHeight + barPadding);
            const barWidth = xScale(+dataPoint[valueField]);
            
            
            
            // 绘制条形
            g.append("rect")
                .attr("x", 0)
                .attr("y", yPos)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", variables.has_gradient ? 
                    `url(#bar-gradient-${group.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')})` : 
                    barColor)
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
            
            // 提取维度和次要分组值
            const dimension = dataPoint[dimensionField];
            const secondaryGroup = dataPoint[secondaryGroupField];
            
            // 添加国家/维度图标
            const flagX = -flagWidth - flagPadding - groupIconWidth - groupIconPadding;
            const flagY = yPos + (barHeight - flagHeight) / 2;
            
            if (images.field && images.field[dimension]) {
                g.append("image")
                    .attr("x", flagX)
                    .attr("y", flagY)
                    .attr("width", flagWidth)
                    .attr("height", flagHeight)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", images.field[dimension]);
            }
            
            // 添加次要分组图标（如发展状态）
            const groupIconX = flagX + flagWidth + flagPadding;
            const groupIconY = yPos + (barHeight - groupIconHeight) / 2;
            
            if (images.field && images.field[secondaryGroup]) {
                g.append("image")
                    .attr("x", groupIconX)
                    .attr("y", groupIconY)
                    .attr("width", groupIconWidth)
                    .attr("height", groupIconHeight)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", images.field[secondaryGroup]);
            }
            
            // 不再添加维度文本标签，只显示图标
            
            // 添加数值标签
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            g.append("text")
                .attr("x", barWidth + 5)
                .attr("y", yPos + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${barHeight * 0.7}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#000000")
                .text(formattedValue);
        });
    });
    
    // 返回SVG节点
    return svg.node();
}