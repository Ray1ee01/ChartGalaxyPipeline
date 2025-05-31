/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Sorted Lines Chart",
    "chart_name": "bump_chart_10",
    "is_composite": false,
    "chart_for": "comparison",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [
        [2, 12],
        [0, "inf"],
        [4, 10]
    ],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": ["spacing"],
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

// 排序线图(Bump Chart)实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------

    // 提取数据和配置
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data;           // 实际数据点数组
    const variables = jsonData.variables || {};     // 图表配置
    const typography = jsonData.typography || {     // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "bold" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置
    const images = jsonData.images || { field: {}, other: {} };   // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义

    // 清空容器
    d3.select(containerSelector).html("");

    // ---------- 辅助函数：动态调整字体大小 ----------
    function getAdaptedFontSize(text, maxWidth, initialFontSize, fontFamily, fontWeight) {
        let fontSize = initialFontSize;
        const tempSvgForFont = d3.select(containerSelector)
            .append("svg")
            .attr("width", 0)
            .attr("height", 0)
            .style("position", "absolute") // 防止影响布局
            .style("visibility", "hidden");

        let textElement = tempSvgForFont.append("text")
            .style("font-family", fontFamily)
            .style("font-weight", fontWeight)
            .text(text);

        while (fontSize > 1) { // 最小字体大小为1px
            textElement.style("font-size", fontSize + "px");
            const textWidth = textElement.node().getBBox().width;
            if (textWidth <= maxWidth) {
                break;
            }
            fontSize -= 1;
        }
        tempSvgForFont.remove();
        return fontSize;
    }

    // 获取文本度量（宽度和高度）
    function getTextMetrics(text, fontSize, fontFamily, fontWeight) {
        const tempSvg = d3.select(containerSelector)
            .append("svg")
            .attr("width", 0)
            .attr("height", 0)
            .style("position", "absolute")
            .style("visibility", "hidden");

        const textElement = tempSvg.append("text")
            .style("font-family", fontFamily)
            .style("font-size", fontSize + "px")
            .style("font-weight", fontWeight)
            .text(text);

        const bbox = textElement.node().getBBox();
        const metrics = {
            width: bbox.width,
            height: bbox.height
        };

        tempSvg.remove();
        return metrics;
    }

    // 判断颜色是否足够暗
    function isColorDarkEnough(color) {
        try {
            const rgb = d3.color(color).rgb();
            // 计算亮度: https://www.w3.org/TR/AERT/#color-contrast
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            // 如果亮度小于128（中等亮度），认为是暗色
            return brightness < 128;
        } catch (e) {
            // 如果颜色解析出错，默认认为不是暗色
            return false;
        }
    }

    // ---------- 2. 尺寸和布局设置 ----------

    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;

    // 设置边距
    const margin = {
        top: 100,     // 顶部留出标题空间
        right: 50,    // 右侧足够显示数值
        bottom: 50,   // 底部边距
        left: 120     // 左侧空间，用于维度标签和图标
    };

    // ---------- 3. 提取字段名和单位 ----------

    // 根据数据列顺序提取字段名
    const timeField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    const groupField = dataColumns.find(col => col.role === "group").name;

    // 获取字段单位（如果存在）
    let timeUnit = "";
    let valueUnit = "";
    let groupUnit = "";

    if (dataColumns.find(col => col.role === "x").unit !== "none") {
        timeUnit = dataColumns.find(col => col.role === "x").unit;
    }

    if (dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }

    if (dataColumns.find(col => col.role === "group").unit !== "none") {
        groupUnit = dataColumns.find(col => col.role === "group").unit;
    }

    // ---------- 4. 数据处理 ----------

    // 添加数值格式化函数
    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format(".1f")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format(".1f")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format(".0f")(value / 1000) + "K";
        } else {
            return d3.format(".0f")(value);
        }
    };

    // 获取唯一时间点和分组值
    const timePoints = [...new Set(chartData.map(d => d[timeField]))].sort();
    const groups = [...new Set(chartData.map(d => d[groupField]))];

    // ---------- 数据完整性检查 ----------
    let allDataPresent = true;
    for (const group of groups) {
        for (const timePoint of timePoints) {
            const dataExists = chartData.some(d => d[groupField] === group && d[timeField] === timePoint);
            if (!dataExists) {
                allDataPresent = false;
                break;
            }
        }
        if (!allDataPresent) {
            break;
        }
    }

    if (!allDataPresent) {
        d3.select(containerSelector).html(""); // 清空容器
        // 可以选择在此处添加提示信息到容器中，例如：
        // d3.select(containerSelector).append("p").text("数据不完整：每个组在所有时间点都必须有数据。图表无法生成。").style("padding", "10px").style("text-align", "center");
        return null; // 不返回图表节点
    }

    // ---------- 5. 创建临时SVG测量文本宽度 (用于组标签) ----------

    // 创建临时SVG来测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");

    // 计算最大组标签宽度
    let maxLabelWidth = 0;
    groups.forEach(group => {
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(group);

        const textWidth = tempText.node().getBBox().width;
        maxLabelWidth = Math.max(maxLabelWidth, textWidth);

        tempText.remove();
    });

    // 删除临时SVG
    tempSvg.remove();

    // 根据标签宽度调整左边距
    margin.left = Math.max(margin.left, maxLabelWidth + 70); // 增加空间给标签和图标

    // 计算内部绘图区域尺寸
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



    // ---------- 7. 计算最大值 (用于圆圈大小比例尺) ----------
    const maxValue = d3.max(chartData, d => +d[valueField]);

    // ---------- 8. 创建比例尺 ----------

    // X轴比例尺（时间点）
    const xScale = d3.scaleBand()
        .domain(timePoints)
        .range([0, innerWidth])
        .padding(0.1);

    // Y轴比例尺（组）
    const yScale = d3.scaleBand()
        .domain(groups)
        .range([0, innerHeight])
        .padding(0.2);

    // 颜色比例尺（组）
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => {
            if (colors.field && colors.field[group]) {
                return colors.field[group];
            }
            return d3.schemeCategory10[i % 10]; // 使用D3默认颜色方案
        }));

    // ---------- 9. 创建主图表组 ----------

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // ---------- 10. 添加组标签和图标 ----------

    const iconSize = 20; // 图标大小
    const iconPadding = 10; // 图标和标签之间的间距

    groups.forEach((group, index) => {
        const groupY = yScale(group) + yScale.bandwidth() / 2;

        // 添加组标签
        g.append("text")
            .attr("x", -iconSize - iconPadding)
            .attr("y", groupY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(group);

        // 添加图标（如果有）
        if (images.field && images.field[group]) {
            g.append("image")
                .attr("x", -iconSize)
                .attr("y", groupY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", images.field[group]);
        }
    });

    // ---------- 11. 绘制数据点和连线 ----------

    // 为每个组创建一个组元素
    const groupElements = g.selectAll(".group")
        .data(groups)
        .enter()
        .append("g")
        .attr("class", "group");

    // 为每个组和每个时间点绘制数据点
    groups.forEach(group => {
        // 创建路径生成器
        const lineGenerator = d3.line()
            .x(d => xScale(d[timeField]) + xScale.bandwidth() / 2)
            .y(d => yScale(d[groupField]) + yScale.bandwidth() / 2);

        // 获取此组的所有数据点，按时间排序
        const groupData = chartData.filter(d => d[groupField] === group)
            .sort((a, b) => timePoints.indexOf(a[timeField]) - timePoints.indexOf(b[timeField]));

        // 如果至少有2个数据点，绘制连线
        if (groupData.length >= 2) {
            // 绘制连线
            g.append("path")
                .datum(groupData)
                .attr("fill", "none")
                .attr("stroke", colorScale(group))
                .attr("stroke-width", 2)
                .attr("d", lineGenerator);
        }

        // 为每个时间点绘制圆点和数值
        groupData.forEach(d => {
            const cx = xScale(d[timeField]) + xScale.bandwidth() / 2;
            const cy = yScale(d[groupField]) + yScale.bandwidth() / 2;
            const value = +d[valueField];

            // 确定当前时间点在时间序列中的索引
            const timePointIndex = timePoints.indexOf(d[timeField]);
            const numTimePoints = timePoints.length;

            // 计算圆圈颜色，实现从左到右由亮变暗的效果
            let finalCircleColor = colorScale(group); // 默认为分组的基础颜色
            if (numTimePoints > 1) {
                const baseColorObject = d3.color(colorScale(group));
                if (baseColorObject) { // 确保颜色对象有效
                    // 定义亮度的最大调整参数（例如，0.6 意味着最亮的点比基色亮约25%，最暗的点暗约20%）
                    const brightnessParamMax = 2;

                    // 计算亮度调整值 kFactor:
                    // timePointIndex = 0 (最左/最早) => kFactor = brightnessParamMax (最亮)
                    // timePointIndex = numTimePoints - 1 (最右/最晚) => kFactor = -brightnessParamMax (最暗)
                    const kFactor = brightnessParamMax * (1 - (2 * timePointIndex) / (numTimePoints - 1));

                    if (kFactor > 0) {
                        finalCircleColor = baseColorObject.brighter(kFactor).toString();
                    } else if (kFactor < 0) {
                        finalCircleColor = baseColorObject.darker(Math.abs(kFactor)).toString();
                    } else {
                        // kFactor is 0, use base color (already set in finalCircleColor)
                        finalCircleColor = baseColorObject.toString(); //确保是字符串格式
                    }
                }
            }

            // 圆圈大小基于数值，不超过可用宽度和高度
            const maxRadiusForTimePointWidth = (xScale.bandwidth() / 2) * 0.9; // 0.9 为宽度边距因子
            const maxRadiusForTimePointHeight = (yScale.bandwidth() / 2) * 0.9; // 0.9 为高度边距因子
            const maxRadiusForTimePoint = Math.min(maxRadiusForTimePointWidth, maxRadiusForTimePointHeight); // 取宽高中的较小值
            const minCircleArea = Math.PI * Math.pow(2, 2); // 最小半径为2px
            const maxCircleArea = Math.PI * Math.pow(maxRadiusForTimePoint, 2);

            const areaScale = d3.scaleLinear()
                .domain([0, maxValue]) // 假设最小值为0
                .range([minCircleArea, maxCircleArea])
                .clamp(true); // 防止超出范围

            const circleArea = areaScale(value);
            const circleRadius = Math.sqrt(circleArea / Math.PI);

            // 绘制圆圈背景
            g.append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", circleRadius)
                .attr("fill", finalCircleColor) // 应用计算出的渐变颜色
                .attr("stroke", "white") // 添加白色描边
                .attr("stroke-width", 2); // 设置描边宽度为2px

            // 添加数值标签，动态调整字体大小
            const formattedValue = formatValue(value);
            const initialAnnotationFontSize = parseFloat(typography.annotation.font_size);
            // 数值标签的最大宽度现在是时间点的可用宽度
            const annotationMaxWidth = xScale.bandwidth();

            const annotationFontSize = getAdaptedFontSize(
                formattedValue,
                annotationMaxWidth,
                initialAnnotationFontSize,
                typography.annotation.font_family,
                typography.annotation.font_weight
            );

            // 判断圆圈是否可以容纳标签
            const textMetrics = getTextMetrics(
                formattedValue,
                annotationFontSize,
                typography.annotation.font_family,
                typography.annotation.font_weight
            );

            // 判断圆圈颜色是亮色还是暗色
            const isColorDark = isColorDarkEnough(finalCircleColor);

            // 如果圆圈足够大，可以放置标签，则将标签放在圆圈内部
            if (circleRadius * 2 >= textMetrics.width + 6) { // 加上一些内边距
                g.append("text")
                    .attr("x", cx)
                    .attr("y", cy)
                    .attr("dominant-baseline", "central")
                    .attr("text-anchor", "middle")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", annotationFontSize + "px")
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", isColorDark ? "white" : colors.text_color) // 暗色用白色，亮色用默认颜色
                    .text(formattedValue);
            } else {
                // 圆圈太小，将标签放在圆圈下方
                const labelPaddingBelowCircle = 5; // 圆圈和标签之间的间距
                g.append("text")
                    .attr("x", cx)
                    .attr("y", cy + circleRadius + labelPaddingBelowCircle)
                    .attr("dominant-baseline", "hanging") // 确保文本从y坐标开始向下渲染
                    .attr("text-anchor", "middle")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", annotationFontSize + "px")
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", colors.text_color) // 外部标签使用默认文本颜色
                    .text(formattedValue);
            }
        });
    });

    // ---------- 12. 添加时间点标签 ----------

    // 在顶部添加时间点标签
    timePoints.forEach(timePoint => {
        const availableWidthForTimeLabel = xScale.bandwidth();
        const initialLabelFontSize = parseFloat(typography.label.font_size);

        const adaptedTimeLabelFontSize = getAdaptedFontSize(
            timePoint,
            availableWidthForTimeLabel,
            initialLabelFontSize,
            typography.label.font_family,
            typography.label.font_weight
        );

        g.append("text")
            .attr("x", xScale(timePoint) + xScale.bandwidth() / 2)
            .attr("y", -10) // 根据需要调整Y位置
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", adaptedTimeLabelFontSize + "px")
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(timePoint);
    });

    // 返回SVG节点
    return svg.node();
}