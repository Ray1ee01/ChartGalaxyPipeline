/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Circular Bar Chart",
    "chart_name": "circular_bar_chart_icons_01",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke"],
    "min_height": 500,
    "min_width": 500,
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

    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {     // 字体默认配置
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || {             // 颜色配置
        text_color: "#333333", // 文本颜色
        other: { primary: "#084594" } // 默认主颜色 (用于插值的深蓝色)
    };
    const images = jsonData.images || {};           // 用于图标/Logo
    const dataColumns = jsonData.data.columns || [];

    // 视觉效果默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false; // 圆角 (应用于末端圆圈)
    variables.has_shadow = variables.has_shadow || false;                   // 阴影
    variables.has_gradient = variables.has_gradient || false;               // 渐变 (径向渐变)
    variables.has_stroke = variables.has_stroke || false;                   // 描边

    // 清空容器
    d3.select(containerSelector).html("");

    // ---------- 2. 尺寸和布局设置 ----------

    const width = variables.width || 800;
    const height = variables.height || 800;
    const size = Math.min(width, height); // 确保圆形图表的正方形宽高比

    // 边距 - 增加外边距以便放置标签/图标
    const margin = {
        top: 90,
        right: 50,   // 右侧更多空间给标签/图标
        bottom: 60,
        left: 50     // 左侧更多空间给标签/图标
    };

    // 内部绘图区域
    const innerWidth = size - margin.left - margin.right;
    const innerHeight = size - margin.top - margin.bottom;

    // 圆心和半径
    const centerX = margin.left + innerWidth / 2; // 使用边距进行居中
    const centerY = margin.top + innerHeight / 2;
    const radius = Math.min(innerWidth, innerHeight) / 2; // 扇区的最大半径

    // ---------- 3. 提取字段名和单位 ----------

    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "category";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "value";

    // 单位
    let valueUnit = "";
    const valueCol = dataColumns.find(col => col.role === "y");
    if (valueCol && valueCol.unit && valueCol.unit !== "none") {
        valueUnit = valueCol.unit === "B" ? " B" : valueCol.unit; // 如果单位是'B'，则添加空格，类似示例图片
    }

    // ---------- 4. 数据处理 ----------

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

    // 按值降序排序数据
    chartData.sort((a, b) => b[valueField] - a[valueField]);

    const totalItems = chartData.length;
    if (totalItems === 0) return; // 如果没有数据则退出

    const anglePerItem = (2 * Math.PI) / totalItems; // 每项分配的角度
    const maxValue = d3.max(chartData, d => +d[valueField]);
    const minValue = 0; // 假设值从0开始

    // ---------- 5. 创建SVG和效果定义 ----------

    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", size)
        .attr("viewBox", `0 0 ${size} ${size}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink"); // 为图像添加 xlink 命名空间

    const defs = svg.append("defs");

    // 阴影滤镜
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("x", -innerWidth/2).attr("y", -innerHeight/2) // 调整滤镜区域
            .attr("width", innerWidth*2).attr("height", innerHeight*2);
        filter.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 4); // 稍大的模糊
        filter.append("feOffset").attr("dx", 3).attr("dy", 3).attr("result", "offsetblur"); // 稍大的偏移
        filter.append("feFlood").attr("flood-color", "#000").attr("flood-opacity", 0.3); // 更深的阴影
        filter.append("feComposite").attr("in2", "offsetblur").attr("operator", "in");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode"); // 阴影节点
        feMerge.append("feMergeNode").attr("in", "SourceGraphic"); // 原始图形置于顶部
    }

    // 定义主颜色
    const primaryColor = colors.other.primary ;
    // 不再定义径向渐变
    // if (variables.has_gradient) { ... } // 删除或注释掉这部分

    // ---------- 6. 创建比例尺 ----------

    // 半径比例尺将值映射到距中心的距离
    const centralCircleRadius = radius * 0.25; // 首先定义中心圆的大小
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        // 确保对于较小值，从中心圆有最小延伸距离(20px)
        .range([centralCircleRadius + 20, radius * 0.9]);

    // 颜色比例尺 - 值越高颜色越深 (使用排序后的索引)
    // 从浅色调 (接近白色) 插值到主颜色或稍深的色调
    const lightColor = d3.rgb(primaryColor).brighter(0.5); // 调整亮度，使最浅颜色不会太亮
    const darkColor = d3.rgb(primaryColor).darker(0.5);    // 稍深的颜色
    const colorInterpolator = d3.interpolateRgb(lightColor, darkColor); // 浅 -> 深
    const colorScale = d3.scaleSequential(colorInterpolator)
        .domain([totalItems - 1, 0]); // 反转域：索引0 (最大值) 获得最深颜色 (darkColor)

    // ---------- 7. 创建中心圆和背景 ----------

    // 中心圆元素 (类似 "HOTEL" 标志)
    svg.append("circle")
        .attr("cx", centerX)
        .attr("cy", centerY)
        .attr("r", centralCircleRadius)
        .attr("fill", "#ffffff") // 白色背景
        .attr("stroke", "#aaaaaa") // 灰色边框
        .attr("stroke-width", 1.5);



    // ---------- 8. 创建扇形、端点圆和标签 ----------

    // 扇区的弧生成器
    const arcGenerator = d3.arc()
        .innerRadius(centralCircleRadius) // 从中心圆开始
        .padAngle(0.02); // 扇形之间的间距

    // 所有扇形元素的组
    const sectorsGroup = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    // 标签组（在扇形之后绘制）
    const labelsGroup = svg.append("g")
         .attr("transform", `translate(${centerX}, ${centerY})`);

    // 遍历排序后的数据来创建元素
    chartData.forEach((d, i) => {
        const value = +d[valueField];
        const category = d[dimensionField];

        // 确保第一个扇形中心在12点钟位置
        const startAngle = (i * anglePerItem) ;
        const endAngle = startAngle + anglePerItem;
        const midAngle = startAngle + anglePerItem / 2;

        // 根据值计算外半径
        const currentOuterRadius = radiusScale(value);

        // --- 8a. 绘制扇形 ---
        sectorsGroup.append("path")
            .datum({
                innerRadius: centralCircleRadius,
                outerRadius: currentOuterRadius,
                startAngle: startAngle,
                endAngle: endAngle
            })
            .attr("d", arcGenerator)
            // 直接使用 colorScale 进行填充，不再检查 has_gradient 或使用径向渐变
            .attr("fill", colorScale(i)) 
            .attr("stroke", variables.has_stroke ? d3.rgb(colorScale(i)).darker(0.5) : "none")
            .attr("stroke-width", variables.has_stroke ? 1 : 0)
            .attr("style", variables.has_shadow ? "filter: url(#shadow)" : null)
            .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
            .on("mouseout", function() { d3.select(this).attr("opacity", 1); });

        // --- 8b. 计算末端圆圈位置 ---

        // 在使用D3的SVG中，0弧度位于12点钟位置并顺时针增加
        // Math.cos/sin 使用标准坐标，其中0位于3点钟位置
        const endCircleX = Math.sin(midAngle) * currentOuterRadius;
        const endCircleY = -Math.cos(midAngle) * currentOuterRadius;
        // 末端圆圈的动态半径，有范围限制
        const endCircleRadius = Math.max(12, Math.min(30, radius * 0.1 * (value / maxValue * 2 + 0.5)));

        // --- 8c. 绘制末端圆圈 ---
        sectorsGroup.append("circle")
            .attr("cx", endCircleX)
            .attr("cy", endCircleY)
            .attr("r", endCircleRadius)
            .attr("fill", colorScale(i)) // 确保末端圆圈也使用 colorScale
            .attr("stroke", "#ffffff" ) // 如果启用，则使用白色描边
            .attr("stroke-width", 1)
            .attr("style", variables.has_shadow ? "filter: url(#shadow)" : null);

        // --- 8d. 在末端圆圈内添加数值文本 ---
        // 动态计算字体大小以适应圆圈内部
        const valueText = `${formatValue(value)}${valueUnit}`;
        let valueFontSize = endCircleRadius * 0.9; // 基于半径的最大字体大小
        // 简单检查：如果文本宽度过大（近似值），则减小字体大小
        if (valueText.length * valueFontSize * 0.6 > endCircleRadius * 1.8) {
            valueFontSize = endCircleRadius * 1.8 / (valueText.length * 0.6); 
        }

        sectorsGroup.append("text")
            .attr("x", endCircleX)
            .attr("y", endCircleY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", typography.annotation.font_family)
            .attr("font-size", `${valueFontSize}px`)
            .attr("font-weight", "bold") // 加粗数值文本
            .attr("fill", "#ffffff") // 白色文本
            .text(valueText);

        // --- 8e. 计算外部标签/图标位置 ---
        // 将标签/图标直接放置在末端圆圈旁边，而不是固定半径
        const iconSize = 30; // 期望的图标大小
        const labelPadding = 20; // 末端圆圈和图标/标签之间的间距

        // 根据图标所在半圆，将其放置在末端圆圈的右侧或左侧
        const iconRadius = currentOuterRadius + endCircleRadius + labelPadding; // Radial distance for the icon/label center

        const iconX = Math.sin(midAngle) * iconRadius;
        const iconY = -Math.cos(midAngle) * iconRadius;


        // --- 8f. Add Outer Label (Text or Icon) ---
        const iconUrl = images?.field?.[category]; // Check if an icon URL is provided for this category

        if (iconUrl) {
            labelsGroup.append("image")
                .attr("xlink:href", iconUrl)
                .attr("x", iconX - iconSize / 2) // Center the icon horizontally at iconX
                .attr("y", iconY - iconSize / 2) // Center the icon vertically at iconY
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet"); // Scale icon nicely
        }
    });

    // 返回SVG节点
    return svg.node();
}