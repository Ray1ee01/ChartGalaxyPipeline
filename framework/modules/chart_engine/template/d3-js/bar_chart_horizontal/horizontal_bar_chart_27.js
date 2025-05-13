/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart With Circle",
    "chart_name": "horizontal_bar_chart_27",
    "is_composite": true,
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [["categorical"],["numerical"],["numerical"]],
    "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
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

// 水平条形图与比例正方形复合图表实现 - 使用D3.js horizontal_bar_proportional_square_area_chart (基于 26 修改)
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

    // 设置各区域宽度 - 移除图标空间
    const requiredLeftSpace = maxDimLabelWidth + textPadding; // 只需标签和边距
    margin.left = requiredLeftSpace ; // 增加10px缓冲

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
    
    // Y轴比例尺（维度） - 先定义 yScale 以计算 barHeight
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
        
    // 计算 barHeight 和 valueLabelFontSize 以便估算宽度
    const barHeight = yScale.bandwidth();
    const valueLabelFontSize = Math.min(20, Math.max(barHeight * 0.5, 12));
    
    // 4.3 测量数值标签的最大宽度
    const valueWidths = sortedData.map(d => {
        const tempText = tempMeasureSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", `${valueLabelFontSize}px`)
            .style("font-weight", typography.annotation.font_weight)
            .text(`${formatValue(+d[valueField1])}${valueUnit1}`);
        return tempText.node().getBBox().width;
    });
    
    // 计算条形图可用的实际宽度
    const availableBarWidth = Math.max(0, barAreaWidth - valueWidths[0] - textPadding);
    
    // X轴比例尺（第一个数值）- 范围调整为 availableBarWidth
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField1]) * 1.05]) // 添加5%边距
        .range([0, availableBarWidth]); // 使用调整后的可用宽度
    
    // 正方形面积比例尺（第二个数值）
    const maxValue2 = d3.max(chartData, d => +d[valueField2]);
    const minSide = yScale.bandwidth() * 0.05;  // 最小边长
    // 调整最大边长以适应 squareAreaWidth 和条目高度
    const maxSide = Math.min(yScale.bandwidth() * 1.8, circleAreaWidth); // 使用新的 circleAreaWidth (现在代表正方形区域宽度)
    
    const sideScale = d3.scaleSqrt()  // 使用平方根比例尺确保面积比例正确
        .domain([0, maxValue2])
        .range([minSide, maxSide]);
    
    // 7. 创建SVG容器
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // ---------- Helper: 定义用于绘图循环中 estimateLabelWidth 的临时 SVG ----------
    const tempTextSvg = svg.append("g").attr("visibility", "hidden");

    // 获取主题色
    const primaryColor = colors.other.primary || "#83C341";
    const secondaryColor = colors.other.secondary || "#57A0D3";
    // 添加defs用于视觉效果
    const defs = svg.append("defs");

    

    // --- 移除渐变定义代码 ---
    /*
    // --- 为每个唯一条形图颜色定义渐变 (基于维度颜色或 secondaryColor) ---
    const uniqueBarColors = [...new Set(chartData.map(d => {
        const dimension = d[dimensionField];
        // 后备颜色使用 secondaryColor
        return (colors.field && colors.field[dimension]) ? colors.field[dimension] : secondaryColor;
    }))];

    uniqueBarColors.forEach(barColor => {
        // 清理颜色值以用作ID (移除#和任何非字母数字字符)
        const gradientId = `bar-gradient-${barColor.replace(/[^a-zA-Z0-9]/g, '')}`;
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%") // 水平渐变
            .attr("y2", "0%");

        // 定义渐变，中间最亮，两边较暗
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(barColor).darker(0.5)); // 可以调整暗度
        gradient.append("stop")
            .attr("offset", "50%")
            .attr("stop-color", d3.rgb(barColor).brighter(1.5)); // 可以调整亮度
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(barColor).darker(0.5)); // 与起始点相同暗度
    });
    // --- 渐变定义结束 ---
    */
    
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
    
    // 正方形图列标题 - 定位到正方形图区域中心
    svg.append("text")
        .attr("x", margin.left + circleAreaWidth / 2) // 定位到正方形区域中心
        .attr("y", margin.top - 10)
        .attr("text-anchor", "middle") // 居中对齐
        .style("font-family", typography.description.font_family)
        .style("font-size", typography.description.font_size)
        .style("font-weight", typography.description.font_weight)
        .style("fill", colors.text_color)
        .text(columnTitle2);
    
    // ---------- Helper: Estimate Text Width (使用附加到主 SVG 的 tempTextSvg) ----------
    // const tempTextSvg = svg.append("g").attr("visibility", "hidden"); // 定义移到主 SVG 创建之后
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
    
    // 获取条形图颜色的辅助函数
    const getBarColor = (dimension) => {
        return (colors.field && colors.field[dimension]) ? colors.field[dimension] : secondaryColor;
    };
    
    // 获取描边颜色的辅助函数 (来自用户)
    const getStrokeColor = (dimension) => {
        // 获取条形的基础颜色
        const baseColor = getBarColor(dimension); 
        // 返回该颜色的更亮版本
        return d3.rgb(baseColor).brighter(3); 
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

            // --- 重新定义元素位置 (无图标) ---
            // 1. 标签位于 G 元素的左侧
            const labelX = -(textPadding); // 相对 G 的 x 坐标 (无图标宽度)
            // 2. 正方形图位于内部绘图区域的左侧部分 (circleAreaWidth)
            const squareAreaCenterX = circleAreaWidth / 2; // 正方形区域中心 X 坐标
            // 3. 条形图位于内部绘图区域的右侧部分 (barAreaWidth)，右对齐
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

            // 3. 绘制正方形 - 位置调整到 circleAreaWidth (正方形区域) 内
            const squareSide = sideScale(+dataPoint[valueField2]);
            const squareX = squareAreaCenterX - squareSide / 2; // 正方形左上角 x
            const squareY = centerY - squareSide / 2; // 正方形左上角 y

            // --- 确定颜色 (正方形固定 primary, 条形图基于维度或 secondary) ---
            // const barColor = getBarColor(dimension); // 在绘制时获取
            // const squareColor = primaryColor; // 正方形颜色直接使用 primaryColor
            // --- 颜色确定结束 ---

            g.append("rect") // 绘制矩形代表正方形
                .attr("x", squareX)
                .attr("y", squareY)
                .attr("width", squareSide)
                .attr("height", squareSide)
                .attr("fill", primaryColor) // 使用 primary 颜色
                .attr("opacity", 0.7) // 轻微调整不透明度以便区分
                .attr("stroke", "#FFFFFF")
                .attr("stroke-width", 1)
                .attr("stroke-opacity", 0.5);

            // 4. 添加正方形数值标签 - 根据大小决定位置和颜色
            const formattedValue2 = valueUnit2 ? 
                `${formatValue(+dataPoint[valueField2])}${valueUnit2}` : 
                `${formatValue(+dataPoint[valueField2])}`;
            // 动态调整字体大小，确保适合正方形
            const squareLabelFontSize = Math.min(
                16, 
                Math.max(12, Math.min(barHeight * 0.5, squareSide * 0.7)) // 基于 squareSide 调整
            );
            
            // 定义标签位置和颜色的阈值
            const labelPositionThreshold = barHeight * 0.4; // 当边长大于此值时，标签在内部
            let squareLabelFill, squareLabelX, squareLabelY, squareLabelAnchor, squareLabelDy;

            if (squareSide >= labelPositionThreshold) {
                // 大正方形：标签在内部，白色
                squareLabelFill = "#FFFFFF";
                squareLabelX = squareAreaCenterX;
                squareLabelY = centerY;
                squareLabelAnchor = "middle";
                squareLabelDy = "0.35em";
            } else {
                // 小正方形：标签在上方，与正方形同色
                squareLabelFill = primaryColor; // 使用 primary 颜色
                squareLabelX = squareAreaCenterX;
                squareLabelY = squareY - 5; // 放置在正方形顶部上方一点
                squareLabelAnchor = "middle";
                squareLabelDy = "0em"; // 基线对齐
            }

            g.append("text")
                .attr("x", squareLabelX) // 使用计算出的 X
                .attr("y", squareLabelY) // 使用计算出的 Y
                .attr("dy", squareLabelDy) // 使用计算出的 dy
                .attr("text-anchor", squareLabelAnchor) // 使用计算出的 text-anchor
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${squareLabelFontSize}px`) // 使用新的字体大小
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", squareLabelFill) // 使用计算出的 fill
                .text(formattedValue2);

            // 5. 绘制条形 - 位置和宽度调整到 barAreaWidth 内，右对齐
            const barColor = getBarColor(dimension); // 获取当前 bar 颜色
            const strokeColor = getStrokeColor(dimension); // 获取当前 stroke 颜色
            
            g.append("rect")
                .attr("x", barX) // 使用新的 x 坐标
                .attr("y", y)
                .attr("width", barWidthValue) // 宽度基于 xScale
                .attr("height", barHeight)
                .attr("fill", barColor) // 直接使用 barColor 填充
                .attr("stroke", strokeColor) // 添加描边颜色
                .attr("stroke-width", 1.5) // 设置描边宽度
                .attr("rx", barHeight/8)
                .attr("ry", barHeight/8)
                .attr("opacity", 0.9);

            // 6. 添加条形数值标签 - 固定放在条形左侧外部
            const formattedValue1 = valueUnit1 ? 
                `${formatValue(+dataPoint[valueField1])}${valueUnit1}` : 
                `${formatValue(+dataPoint[valueField1])}`;
            const valueLabelXPos = barX - textPadding; // 固定在条形左侧
            const valueLabelAnchor = "end"; // 右对齐
            const valueLabelFill = colors.text_color; // 固定文本颜色

            g.append("text")
                .attr("x", valueLabelXPos)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", valueLabelAnchor)
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${valueLabelFontSize}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", valueLabelFill)
                .text(formattedValue1);
            
        } catch (error) {
            console.error(`渲染${dimension}时出错:`, error);
        }
    });

    // 移除用于 estimateLabelWidth 的临时 SVG 组
    tempTextSvg.remove();

    // 返回SVG节点
    return svg.node();
}