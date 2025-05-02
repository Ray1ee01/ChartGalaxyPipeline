/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_24",
    "is_composite": true,
    "required_fields": [["x", "y"], ["x", "y2"]],
    "required_fields_type": [
        [["categorical"], ["numerical"]],
        [["categorical"], ["numerical"]]
    ],
    "required_fields_range": [
        [[2, 30], [0, "inf"]],
        [[2, 30], [0, "inf"]]
    ],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary","secondary"],
    "supported_effects": ["gradient",  "radius_corner"],
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

// 水平条形图与比例圆复合图表实现 - 使用D3.jshorizontal_bar_proportional_circle_area_chart_05
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
    const colors = jsonData.colors || { 
        text_color: "#FFFFFF", 
        background_color: "#0A3B39",
        other: { primary: "#83C341" }
    };
    const images = jsonData.images || { field: {}, other: {} };   // 图像配置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    const titles = jsonData.titles || {};           // 标题配置
    
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
        left: 0        // 左侧边距（初始值，将根据标签和图标宽度调整）
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
    
    // 5. 布局计算 和 字体调整
    const flagWidth = 30;
    const flagHeight = 30;
    const textPadding = 5; // 文本与图标/边缘的间距
    const minFontSize = 10; // 最小字体大小

    // 创建临时SVG用于文本测量
    const tempMeasureSvg = d3.select(containerSelector)
        .append("svg").attr("width", 0).attr("height", 0).style("visibility", "hidden");

    let maxDimLabelWidth = 0;
    let defaultLabelFontSize = parseFloat(typography.label.font_size);
    sortedDimensions.forEach(dimension => {
        const labelText = dimension.toUpperCase();
        const tempText = tempMeasureSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${defaultLabelFontSize}px`)
            .style("font-weight", typography.label.font_weight)
            .text(labelText);
        maxDimLabelWidth = Math.max(maxDimLabelWidth, tempText.node().getBBox().width);
        tempText.remove();
    });

    // 计算可用空间并调整字体大小
    const maxAllowedLabelSpace = width * 0.20; // 允许标签占用的最大宽度比例
    let finalDimLabelFontSize = defaultLabelFontSize;
    if (maxDimLabelWidth > maxAllowedLabelSpace) {
        const scaleFactor = maxAllowedLabelSpace / maxDimLabelWidth;
        finalDimLabelFontSize = Math.max(minFontSize, defaultLabelFontSize * scaleFactor);
        // 重新计算调整后的最大宽度
        maxDimLabelWidth = 0;
        sortedDimensions.forEach(dimension => {
            const labelText = dimension.toUpperCase();
            const tempText = tempMeasureSvg.append("text")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${finalDimLabelFontSize}px`)
                .style("font-weight", typography.label.font_weight)
                .text(labelText);
            maxDimLabelWidth = Math.max(maxDimLabelWidth, tempText.node().getBBox().width);
            tempText.remove();
        });
    }
    tempMeasureSvg.remove(); // 移除临时SVG

    // 设置各区域宽度 - 更新为 _04.js 的逻辑
    const requiredLeftSpace = maxDimLabelWidth + textPadding + flagWidth + textPadding;
    margin.left = requiredLeftSpace + 10; // 增加10px缓冲

    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 重新计算圆形图和条形图区域宽度（基于新的innerWidth）
    const circleAreaRatio = 0.25; // 圆形区域占内部宽度的比例
    const barAreaRatio = 1 - circleAreaRatio; // 条形区域占内部宽度的比例
    const circleAreaWidth = innerWidth * circleAreaRatio;
    const barAreaWidth = innerWidth * barAreaRatio;

    // 6. 创建比例尺
    const barPadding = 0.2;
    
    // Y轴比例尺（维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（第一个数值）- 范围调整为条形图区域宽度
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField1]) * 1.05]) // 添加5%边距
        .range([0, barAreaWidth]); // 使用 barAreaWidth
    
    // 圆形面积比例尺（第二个数值）
    const maxValue2 = d3.max(chartData, d => +d[valueField2]);
    const minRadius = yScale.bandwidth() * 0.3;  // 最小半径
    // 调整最大半径以适应 circleAreaWidth
    const maxRadius = Math.min(yScale.bandwidth(), circleAreaWidth / 2); // 使用新的 circleAreaWidth
    
    const radiusScale = d3.scaleSqrt()  // 使用平方根比例尺确保面积比例正确
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

    // 获取主题色
    const primaryColor = colors.other.primary || "#83C341";
    // 添加defs用于视觉效果
    const defs = svg.append("defs");

    // 添加水平渐变（从左到右）
    const gradient = defs.append("linearGradient")
        .attr("id", "bar-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d3.rgb(primaryColor).darker(0.3));

    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d3.rgb(primaryColor).brighter(0.5));


    
    // 条形图列标题 - 定位到条形图区域右侧
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
    
    // ---------- Helper: Estimate Text Width ----------
    const tempTextSvg = svg.append("g").attr("visibility", "hidden");
    const estimateLabelWidth = (text, fontConfig, barHeight) => {
        // Calculate dynamic font size for value labels if applicable
        const isValueLabel = fontConfig === typography.annotation;
        const fontSize = isValueLabel ? `${Math.min(20, Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px` : fontConfig.font_size;

        tempTextSvg.selectAll("text").remove(); // 清除旧文本
        const tempText = tempTextSvg.append("text")
            .style("font-family", fontConfig.font_family)
            .style("font-size", fontSize) // Use potentially dynamic font size
            .style("font-weight", fontConfig.font_weight)
            .text(text);
        const width = tempText.node().getBBox().width;
        return width;
    };

    // ---------- 9. 创建主图表组 ----------
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 10. 绘制元素 ----------
    
    // 获取条形描边颜色
    const getStrokeColor = (dimension) => {
        const baseColor = colors.other.primary || "#83C341";
        return d3.rgb(baseColor).brighter(3);
    };
    
    // 获取圆形图颜色
    const getCircleColor = (dimension) => {
        return colors.other.secondary || "#83C341"; // 亮绿色
    };

    // 为每个维度绘制元素
    sortedDimensions.forEach((dimension, index) => {
        try {
            const dataPoint = chartData.find(d => d[dimensionField] === dimension);
            
            if (!dataPoint) {
                console.error(`No data found for dimension: ${dimension}`);
                return;
            }
            
            // 检查数据值是否有效
            if (isNaN(+dataPoint[valueField1]) || isNaN(+dataPoint[valueField2])) {
                console.error(`Invalid data values for ${dimension}: ${dataPoint[valueField1]}, ${dataPoint[valueField2]}`);
                return;
            }
            
            const barHeight = yScale.bandwidth();
            const y = yScale(dimension);
            if (typeof y !== 'number') {
                console.error(`Invalid y position for dimension: ${dimension}`);
                return;
            }
            
            const centerY = y + barHeight / 2;
            const barWidthValue = Math.max(0, xScale(+dataPoint[valueField1])); // 确保不为负

            // --- 重新定义元素位置 (借鉴 _04.js 标签/图标逻辑) ---
            // 1. 标签位于 G 元素的左侧
            const labelX = -(flagWidth + textPadding + 5); // 相对 G 的 x 坐标
            // 2. 图标位于 G 元素的左侧，标签右侧
            const iconX = -(flagWidth + 5); // 相对 G 的 x 坐标
            // 3. 圆形图位于内部绘图区域的左侧部分 (circleAreaWidth)
            const circleX = circleAreaWidth / 2; // 圆心位于圆形区域中间
            // 4. 条形图位于内部绘图区域的右侧部分 (barAreaWidth)，右对齐
            const barAreaStartX = circleAreaWidth; // 条形区域开始的 X 坐标 (相对 G)
            const barX = barAreaStartX + barAreaWidth - barWidthValue; // 条形左上角 X (右对齐)

            // 1. 添加维度标签 (移到左侧)
            g.append("text")
                .attr("x", labelX) // 使用新的 x 坐标
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end") // 右对齐
                .style("font-family", typography.label.font_family)
                .style("font-size", `${finalDimLabelFontSize}px`) // 使用最终字体大小
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(dimension.toUpperCase());

            // 2. 添加图标 (移到左侧)
            const iconGroup = g.append("g")
                .attr("transform", `translate(${iconX}, ${centerY - flagHeight/2})`); // 使用新的 x 坐标

            if (images.field && images.field[dimension]) {
                // 绘制图片（移除边框圆圈）
                iconGroup.append("image")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", flagWidth)
                    .attr("height", flagHeight)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", images.field[dimension]);
            }

            // 3. 绘制圆形 - 位置调整到 circleAreaWidth 内
            const circleRadius = radiusScale(+dataPoint[valueField2]);
            g.append("circle")
                .attr("cx", circleX) // 使用新的 cx
                .attr("cy", centerY)
                .attr("r", circleRadius)
                .attr("fill", getCircleColor(dimension))
                .attr("opacity", 0.6)
                .attr("stroke", "#FFFFFF")
                .attr("stroke-width", 1)
                .attr("stroke-opacity", 0.5);

            // 4. 添加圆形数值标签
            const formattedValue2 = `${dataPoint[valueField2]}${valueUnit2}`;
            // 动态调整字体大小，确保适合圆圈
            const circleLabelFontSize = Math.min(
                14, 
                Math.max(10, Math.min(barHeight * 0.5, circleRadius * 0.8))
            );
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

            // 5. 绘制条形 - 位置和宽度调整到 barAreaWidth 内，右对齐
            g.append("rect")
                .attr("x", barX) // 使用新的 x 坐标
                .attr("y", y)
                .attr("width", barWidthValue) // 宽度基于 xScale
                .attr("height", barHeight)
                .attr("fill", "url(#bar-gradient)")
                .attr("rx", barHeight/4)
                .attr("ry", barHeight/4)
                .attr("opacity", 0.9);

            // 6. 添加条形数值标签 - 根据条形宽度智能放置 (坐标基于新的 barX)
            const valueLabelText = `${dataPoint[valueField1]}${valueUnit1}`;
            const currentValueLabelWidth = estimateLabelWidth(valueLabelText, typography.annotation, barHeight);
            const valueLabelFontSize = Math.min(16, Math.max(barHeight * 0.5, 12));
            
            // 确定标签位置：有足够空间时放在条形内部左侧，否则放在左侧外部
            let valueLabelXPos, valueLabelAnchor, valueLabelFill;
            const internalPadding = 10; // 内部所需间距
            const externalPadding = 8; // 外部所需间距

            if (barWidthValue >= currentValueLabelWidth + internalPadding * 2) {
                // 空间足够放内部，靠左显示
                valueLabelXPos = barX + internalPadding; // 基于新的 barX
                valueLabelAnchor = "start";
                valueLabelFill = "#FFFFFF"; // 条形内部使用白色文本
            } else {
                // 放外部
                valueLabelXPos = barX - externalPadding; // 基于新的 barX
                valueLabelAnchor = "end";
                valueLabelFill = colors.text_color;
            }

            g.append("text")
                .attr("x", valueLabelXPos)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", valueLabelAnchor)
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${valueLabelFontSize}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", valueLabelFill)
                .text(valueLabelText);
            
        } catch (error) {
            console.error(`渲染${dimension}时出错:`, error);
        }
    });

    // 移除临时SVG元素
    tempTextSvg.remove();

    // 返回SVG节点
    return svg.node();
}