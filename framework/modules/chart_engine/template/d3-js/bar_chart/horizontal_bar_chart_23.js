/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_23",
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
    "supported_effects": ["gradient", "stroke", "radius_corner"],
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

// 水平条形图与比例圆复合图表实现 - 使用D3.jshorizontal_bar_proportional_circle_area_chart_04
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
        top: 100,      // 顶部标题空间
        right: 5,      // 右侧边距
        bottom: 40,    // 底部边距
        left: 0        // 左侧边距（条形图紧贴左边）
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
    const minFontSize = 8; // 最小字体大小

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
    const maxAllowedLabelSpace = width * 0.15; // 允许标签占用的最大宽度比例
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

    // 更新左边距
    const requiredLeftSpace = maxDimLabelWidth + textPadding + flagWidth + textPadding;
    margin.left = requiredLeftSpace + 5; // 加5px额外缓冲
    
    // 设置条形图和圆形图的布局比例
    const leftColumnRatio = 0.85;  // 左列占比
    const rightColumnRatio = 0.15; // 右列占比
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 计算两列的宽度
    const barChartWidth = innerWidth * leftColumnRatio;
    const circleChartWidth = innerWidth * rightColumnRatio;
    
    // 6. 创建比例尺
    const barPadding = 0.2;
    
    // Y轴比例尺（维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（第一个数值）
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField1]) * 1.05]) // 添加5%边距
        .range([0, barChartWidth]);
    
    // 圆形面积比例尺（第二个数值）
    const maxValue2 = d3.max(chartData, d => +d[valueField2]);
    const minRadius = yScale.bandwidth() * 0.3;  // 最小半径
    const maxRadius = Math.min(yScale.bandwidth() * 1.0, circleChartWidth*0.5)  // 最大半径
    
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

    // 添加水平渐变（从左到右，匹配_02.js的最终版本）
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

    // 8. 添加标题
    const leftTitleX = margin.left; 
    
    // 左侧列标题
    svg.append("text")
        .attr("x", leftTitleX)
        .attr("y", margin.top - 10)
        .attr("text-anchor", "start")
        .style("font-family", typography.description.font_family)
        .style("font-size", typography.description.font_size)
        .style("font-weight", typography.description.font_weight)
        .style("fill", colors.text_color)
        .text(columnTitle1);
    
    // 右侧列标题
    svg.append("text")
        .attr("x", width - margin.right - 10)
        .attr("y", margin.top - 10)
        .attr("text-anchor", "end")
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
    
    // ---------- 10. 绘制条形和标签 ----------
    
    // 获取条形描边颜色 (匹配_02.js的最终版本)
    const getStrokeColor = (dimension) => {
        const baseColor = colors.other.primary || "#83C341";
        return d3.rgb(baseColor).brighter(3);
    };
    
    // 获取圆形图颜色
    const getCircleColor = (dimension) => {
        
        return colors.other.secondary || "#83C341"; // 亮绿色
    };

    // 存储第一个条形的宽度，用于后续条形图标签位置决策
    let firstBarWidth = 0;
    if (sortedDimensions.length > 0) {
        const firstDataPoint = chartData.find(d => d[dimensionField] === sortedDimensions[0]);
        if (firstDataPoint) {
            firstBarWidth = xScale(+firstDataPoint[valueField1]);
        }
    }
    
    // 为每个维度绘制条形和圆形
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
            const barWidthValue = Math.max(0, xScale(+dataPoint[valueField1])); //确保不为负

            // --- 定义元素位置 (新布局) ---
            const labelX = -(flagWidth + textPadding + 5);
            const iconX = -flagWidth - 5;

            // 1. 绘制条形 (强制视觉效果) (保持不变)
            g.append("rect")
                .attr("x", 0)
                .attr("y", y)
                .attr("width", barWidthValue)
                .attr("height", barHeight)
                .attr("fill", "url(#bar-gradient)") // 强制渐变填充
                .attr("rx", barHeight/4) // 强制圆角半径4
                .attr("ry", barHeight/4) // 强制圆角半径4
                .attr("opacity", 0.9);

            // 2. 添加维度标签 (新位置和字体大小)
            g.append("text")
                .attr("x", labelX)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end") // 右对齐
                .style("font-family", typography.label.font_family)
                .style("font-size", `${finalDimLabelFontSize}px`) // 使用最终字体大小
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(dimension.toUpperCase());

            // 3. 添加图标 (新位置, 无裁剪)
            const iconGroup = g.append("g")
                .attr("transform", `translate(${iconX}, ${centerY - flagHeight/2})`);

            if (images.field && images.field[dimension]) {
                // 绘制图片（无边框圆圈）
                iconGroup.append("image")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", flagWidth)
                    .attr("height", flagHeight)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", images.field[dimension]);
                    // 不再需要clip-path
            } else {
                // 图片不存在时的占位符（无边框）
                iconGroup.append("rect")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", flagWidth)
                    .attr("height", flagHeight)
                    .attr("fill", getStrokeColor(dimension))
                    .attr("opacity", 0.3);
            }

            // 4. 添加条形数值标签 (需要重新评估位置逻辑)
            const valueLabelText = `${dataPoint[valueField1]}${valueUnit1}`;
            const currentValueLabelWidth = estimateLabelWidth(valueLabelText, typography.annotation, barHeight);
            const valueLabelFontSize = `${Math.min(20, Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`;
            
            // 定位逻辑：优先放内部左侧，如果放不下或者太拥挤，再放外部
            let valueLabelXPos, valueLabelAnchor, valueLabelFill;
            const internalPadding = 10; // 内部所需间距
            const externalPadding = 5; // 外部所需间距

            if (barWidthValue >= currentValueLabelWidth + internalPadding * 2) {
                // 空间足够放内部，靠左显示
                valueLabelXPos = internalPadding; // 靠左
                valueLabelAnchor = "start";
                valueLabelFill = "#FFFFFF";
            } else {
                 // 放外部
                valueLabelXPos = barWidthValue + externalPadding;
                valueLabelAnchor = "start";
                valueLabelFill = colors.text_color;
            }

            g.append("text")
                .attr("x", valueLabelXPos)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", valueLabelAnchor)
                .style("font-family", typography.annotation.font_family)
                .style("font-size", valueLabelFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", valueLabelFill)
                .text(valueLabelText);

            // 5. 绘制圆形 (保持不变, 但注意其绝对X位置受margin.left影响)
            const circleRadius = radiusScale(+dataPoint[valueField2]);
            const circleX = barChartWidth + circleChartWidth / 2;
            g.append("circle")
                .attr("cx", circleX)
                .attr("cy", centerY)
                .attr("r", circleRadius)
                .attr("fill", getCircleColor(dimension))
                .attr("opacity", 0.6);

            // 6. 添加圆形数值标签 (GDP Value)
            const formattedValue2 = `${dataPoint[valueField2]}${valueUnit2}`;
            const circleLabelFontSize = `${Math.min(20, Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`;
            g.append("text")
                .attr("x", circleX)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", circleLabelFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color)
                .text(formattedValue2);

            
        } catch (error) {
            console.error(`渲染${dimension}时出错:`, error);
        }
    });

    // 移除临时SVG元素
    tempTextSvg.remove();

    // 返回SVG节点
    return svg.node();
}