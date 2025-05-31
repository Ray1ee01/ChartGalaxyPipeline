/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart With Circle",
    "chart_name": "horizontal_bar_chart_25",
    "is_composite": true,
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [
        ["categorical"],
        ["numerical"],
        ["numerical"]
    ],
    "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary","secondary"],
    "supported_effects": ["radius_corner"], 
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

// 水平条形图与比例圆复合图表实现 - 使用D3.js 圆在左边
function makeChart(containerSelector, data) {
    // 1. 数据准备
    const jsonData = data;                           // 完整JSON数据对象
    const chartData = jsonData.data.data             // 实际数据点数组
    const variables = jsonData.variables || {};      // 图表配置
    const typography = jsonData.typography || {      // 字体设置默认值
        title: { font_family: "Arial", font_size: "28px", font_weight: 700 },
        label: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        description: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: 400 }
    };
    const colors = jsonData.colors || {             // 颜色配置
        text_color: "#FFFFFF",
        background_color: "#0A3B39",
        other: { primary: "#83C341", secondary: "#FFA500" } // 提供备用颜色
    };
    // const images = jsonData.images || { field: {}, other: {} }; // 不再需要图标配置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    // const titles = jsonData.titles || {}; // 标题配置似乎未使用

    // 设置视觉效果变量 (圆角由代码直接控制，不再需要此变量)
    // variables.has_rounded_corners = variables.has_rounded_corners || false;

    // 清空容器
    d3.select(containerSelector).html("");

    // 2. 尺寸和布局设置
    const width = variables.width || 800;
    const height = variables.height || 600;

    // 设置边距
    const margin = {
        top: 90,      // 顶部标题空间
        right: 10,     // 右侧边距
        bottom: 50,    // 底部边距
        left: 10       // 左侧边距（初始值，将根据标签宽度调整）
    };

    // 3. 提取字段名和单位
    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "Country";
    const valueField1 = dataColumns.find(col => col.role === "y")?.name || "Crypto Ownership Percentage";
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name || "Number of Owners";

    // 获取字段单位
    let valueUnit1 = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" :
                       dataColumns.find(col => col.role === "y")?.unit;
    let valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit === "none"? "" :
                        dataColumns.find(col => col.role === "y2")?.unit;
    valueUnit1 = valueUnit1 ? valueUnit1 : "";
    valueUnit2 = valueUnit2 ? valueUnit2 : "";

    // 列标题
    const columnTitle1 = dataColumns.find(col => col.role === "y")?.name ||
                          "Crypto Ownership Percentage";
    const columnTitle2 = dataColumns.find(col => col.role === "y2")?.name ||
                          "Number of Owners";

    // 4. 数据处理
    const sortedData = [...chartData].sort((a, b) => b[valueField1] - a[valueField1]);
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
    
    const tempSvgForEstimation = d3.select(containerSelector).append("svg").attr("width", 0).attr("height", 0).style("visibility", "hidden"); // 用于估算文本宽度

    // ---------- Helper: Estimate Text Width ----------
    const estimateLabelWidth = (text, fontConfig, defaultFontSize = 12) => {
        const fontSize = fontConfig.font_size || `${defaultFontSize}px`;
        const fontFamily = fontConfig.font_family || "Arial";
        const fontWeight = fontConfig.font_weight || "normal";

        tempSvgForEstimation.selectAll("text").remove(); // 清除旧文本
        const tempText = tempSvgForEstimation.append("text")
            .style("font-family", fontFamily)
            .style("font-size", fontSize)
            .style("font-weight", fontWeight)
            .text(text);
        const width = tempText.node().getBBox().width;
        tempText.remove(); // 移除临时文本
        return width;
    };

    // 5. 布局计算
    const dimLabelPadding = 10; // 维度标签与左边缘的间距
    const valueLabelExternalPadding = 3; // 数值标签与其对应条形图左侧的间距
    const minFontSize = 10; // 最小字体大小
    const gapBetweenCircleAndBar = 15; // 圆形区域和条形图区域之间的固定间隙

    // 5.1 计算维度标签所需最大宽度和最终字体大小
    let maxDimLabelWidth = 0;
    let defaultLabelFontSize = parseFloat(typography.label.font_size);
    sortedDimensions.forEach(dimension => {
        const labelText = dimension.toUpperCase();
        maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateLabelWidth(labelText, typography.label, defaultLabelFontSize));
    });

    const maxAllowedLabelSpace = width * 0.20; // 允许标签占用的最大宽度比例
    let finalDimLabelFontSize = defaultLabelFontSize;
    if (maxDimLabelWidth > maxAllowedLabelSpace) {
        const scaleFactor = maxAllowedLabelSpace / maxDimLabelWidth;
        finalDimLabelFontSize = Math.max(minFontSize, defaultLabelFontSize * scaleFactor);
        // 重新计算调整后的最大宽度
        maxDimLabelWidth = 0;
        sortedDimensions.forEach(dimension => {
            const labelText = dimension.toUpperCase();
            maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateLabelWidth(labelText, typography.label, finalDimLabelFontSize));
        });
    }
    tempSvgForEstimation.remove(); // 移除临时SVG

    // 5.2 设置最终边距和内部尺寸
    const requiredLeftSpace = maxDimLabelWidth + dimLabelPadding; // 仅需要标签宽度和内边距
    margin.left = requiredLeftSpace + 10; // 增加10px缓冲
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 5.3 划分内部绘图区域宽度 (圆形区 + 间隙 + 条形区)
    const circleAreaRatio = 0.25; // 圆形区域占内部宽度的比例 (相对于总innerWidth)
    const circleAreaWidth = innerWidth * circleAreaRatio; // 圆形区域宽度
    let barAreaWidth = innerWidth - circleAreaWidth - gapBetweenCircleAndBar; // 剩余给条形图的宽度

    // 确保条形图区域有最小宽度
    const minBarWidth = 10;
    if (barAreaWidth < minBarWidth) {
        console.warn(`计算出的条形图区域宽度 (${barAreaWidth}px) 过小，已调整为最小值 ${minBarWidth}px。可能导致元素重叠或显示不佳。`);
        barAreaWidth = minBarWidth;
    }

    // 6. 创建比例尺
    const barPadding = 0.2;

    // Y轴比例尺（维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    // X轴比例尺（第一个数值）- 范围是调整后的 barAreaWidth
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField1]) * 1.05]) // 添加5%边距
        .range([0, barAreaWidth]); // 使用调整后的 barAreaWidth

    // 圆形面积比例尺（第二个数值）
    const maxValue2 = d3.max(chartData, d => +d[valueField2]);
    const minRadius = yScale.bandwidth() * 0.3;  // 最小半径
    const maxRadius = Math.min(yScale.bandwidth() * 0.45, circleAreaWidth / 2 - 5); // 避免贴边
    const radiusScale = d3.scaleSqrt()
        .domain([0, maxValue2])
        .range([minRadius, maxRadius]);

    // 7. 创建SVG容器
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // 8. 绘制标题和坐标轴标签 (如果有)
    // 条形图列标题 - 定位到内部区域最右边缘
    svg.append("text")
        .attr("x", margin.left + innerWidth) // 定位到内部区域右边缘
        .attr("y", margin.top - 10)
        .attr("text-anchor", "end") // 右对齐
        .style("font-family", typography.description.font_family)
        .style("font-size", typography.description.font_size)
        .style("font-weight", typography.description.font_weight)
        .style("fill", colors.text_color)
        .text(columnTitle1);

    // 圆形图列标题 - 定位到圆形图区域中心
    svg.append("text")
        .attr("x", margin.left + circleAreaWidth / 2) // 定位到圆形区域中心
        .attr("y", margin.top - 10)
        .attr("text-anchor", "middle") // 居中对齐
        .style("font-family", typography.description.font_family)
        .style("font-size", typography.description.font_size)
        .style("font-weight", typography.description.font_weight)
        .style("fill", colors.text_color)
        .text(columnTitle2);

    // ---------- Helper: Get Bar Color ----------
    const getBarColor = (dimension) => {
        return (colors.field && colors.field[dimension]) ? colors.field[dimension] : (colors.other.primary || "#83C341");
    };

    // ---------- Helper: Get Stroke Color ----------
    const getStrokeColor = (dimension) => {
        const baseColor = getBarColor(dimension);
        try {
            return d3.rgb(baseColor).brighter(3);
        } catch (error) {
            console.warn(`无法生成维度 ${dimension} 的描边颜色 (基础颜色: ${baseColor}): `, error);
            return baseColor;
        }
    };

    // ---------- 9. 创建主图表组 ----------
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // ---------- 10. 绘制元素 ----------

    // 为每个维度绘制元素
    sortedDimensions.forEach((dimension, index) => {
        try {
            const dataPoint = chartData.find(d => d[dimensionField] === dimension);

            if (!dataPoint) { console.error(`找不到维度的数据: ${dimension}`); return; }

            const value1 = +dataPoint[valueField1];
            const value2 = +dataPoint[valueField2];
            if (isNaN(value1) || isNaN(value2)) { console.error(`${dimension} 的数据值无效: ${dataPoint[valueField1]}, ${dataPoint[valueField2]}`); return; }

            const barHeight = yScale.bandwidth();
            const y = yScale(dimension);
            if (typeof y !== 'number') { console.error(`维度 ${dimension} 的y坐标无效`); return; }

            const centerY = y + barHeight / 2;

            // --- 定义元素 X 坐标 (基于动态计算) ---
            const dimensionLabelX = -dimLabelPadding;           // 维度标签 X (右边缘)
            const circleX = circleAreaWidth / 2;                // 圆心 X
            const barAreaStartX = circleAreaWidth + gapBetweenCircleAndBar; // 条形图区域起始 X
            const barWidthValue = Math.max(0, xScale(value1));  // 条形图宽度
            const barX = barAreaStartX + barAreaWidth - barWidthValue; // 条形图左上角 X (在 barArea 内右对齐)
            const valueLabelXPos = barX - valueLabelExternalPadding; // 数值标签 X (右边缘), 紧邻条形左侧

            // 1. 添加维度标签
            g.append("text")
                .attr("x", dimensionLabelX)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${finalDimLabelFontSize}px`) // 使用最终字体大小
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(dimension.toUpperCase());

            // 2. 绘制圆形
            const circleRadius = radiusScale(value2);
            const circleFillColor = (colors.field && colors.field[dimension]) ? colors.field[dimension] : (colors.other.secondary || '#A9A9A9');
            g.append("circle")
                .attr("cx", circleX)
                .attr("cy", centerY)
                .attr("r", circleRadius)
                .attr("fill", circleFillColor)
                .attr("opacity", 0.6)
                .attr("stroke", "#FFFFFF")
                .attr("stroke-width", 1)
                .attr("stroke-opacity", 0.5);

            // 3. 添加圆形数值标签
            const formattedValue2 = `${formatValue(value2)}${valueUnit2}`;
            const circleLabelFontSize = Math.min(14, Math.max(10, Math.min(barHeight * 0.4, circleRadius * 0.8)));
            g.append("text")
                .attr("x", circleX)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${circleLabelFontSize}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color)
                .text(formattedValue2);

            // 4. 绘制条形
            const barFillColor = getBarColor(dimension);
            g.append("rect")
                .attr("x", barX)
                .attr("y", y)
                .attr("width", barWidthValue)
                .attr("height", barHeight)
                .attr("fill", barFillColor)
                .attr("rx", barHeight * 0.5) // 半圆角
                .attr("ry", barHeight * 0.5) // 半圆角
                .attr("opacity", 0.9)
                .style("stroke", getStrokeColor(dimension)) // 描边
                .style("stroke-width", 1);

            // 5. 添加条形数值标签 (位置相对条形)
            const valueLabelText = `${formatValue(value1)}${valueUnit1}`;
            const valueLabelFontSize = Math.min(16, Math.max(barHeight * 0.5, 12));
            g.append("text")
                .attr("x", valueLabelXPos) // 使用相对条形的X坐标
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end") // 文本右对齐
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${valueLabelFontSize}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color) // 固定使用默认文本颜色
                .text(valueLabelText);

        } catch (error) {
            console.error(`渲染维度 ${dimension} 时出错:`, error);
        }
    });

    // 返回SVG节点
    return svg.node();
}