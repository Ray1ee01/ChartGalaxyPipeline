/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart With Circle",
    "chart_name": "horizontal_bar_chart_15",
    "is_composite": true,
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [
        ["categorical"],
        ["numerical"],
        ["numerical"]
    ],
    "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary", "secondary"],
    "supported_effects": ["radius_corner", "spacing"],
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

// 水平条形图与比例圆复合图表实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;
    
    // 获取实际数据数组 - 处理不同的数据结构形式
    let chartData = [];
    if (Array.isArray(jsonData.data)) {
        chartData = jsonData.data;
    } else if (jsonData.data && Array.isArray(jsonData.data.data)) {
        chartData = jsonData.data.data;
    }
    
    // 提取其他配置
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "28px", font_weight: 700 },
        label: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        description: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: 400 }
    };
    const colors = jsonData.colors || { 
        text_color: "#000000", 
        background_color: "#FFFFFF",
        other: { primary: "#4269d0", secondary: "#4269d0" },
        available_colors: ["#4269d0", "#6cc5b0", "#3ca951", "#ff8ab7", "#a463f2", "#97bbf5"]
    };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];
    const titles = jsonData.titles || {};
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = false;
    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 提取字段名和单位 ----------
    
    // 根据数据列提取字段名
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
    const columnTitle1 = dataColumns.find(col => col.role === "y")?.name || "Crypto Ownership Percentage";
    const columnTitle2 = dataColumns.find(col => col.role === "y2")?.name || "Number of Owners";
    
    // ---------- 3. 数据处理 ----------
    
    // 按第一个数值字段降序排序数据
    const sortedData = [...chartData].sort((a, b) => +b[valueField1] - +a[valueField1]);
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
    
    // ---------- 4. 创建SVG容器用于临时文本测量 ----------
    
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 4.1 创建临时文本元素来测量文本宽度
    const tempText = tempSvg.append("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight);
    
    // 4.2 测量每个标签的宽度并找出最大值
    const labelWidths = sortedDimensions.map(d => {
        tempText.text(d.toUpperCase());
        return tempText.node().getComputedTextLength();
    });
    
    // 4.3 测量数值标签的最大宽度
    const valueWidths = sortedData.map(d => {
        tempText.text(`${formatValue(+d[valueField1])}${valueUnit1}`);
        return tempText.node().getComputedTextLength();
    });
    
    // 4.4 测量第二个数值标签的最大宽度
    const value2Widths = sortedData.map(d => {
        tempText.text(`${formatValue(+d[valueField2])}${valueUnit2}`);
        return tempText.node().getComputedTextLength();
    });
    
    const maxLabelWidth = Math.max(...labelWidths);
    const maxValueWidth = Math.max(...valueWidths);
    const maxValue2Width = Math.max(...value2Widths);
    
    tempSvg.remove(); // 移除临时SVG
    
    // ---------- 5. 尺寸和布局设置 ----------
    
    // 图标尺寸
    const flagWidth = 24;
    const flagHeight = 24;
    const flagMargin = 10;
    const textIconGap = 10;  // 标签文本和图标之间的间距
    const valueLabelGap = 5; // 条形和值标签之间的间距
    
    // 基于内容计算合适的图表总宽度
    const leftSectionWidth = maxLabelWidth + flagWidth + flagMargin + textIconGap;
    
    // 设置图表总尺寸
    const minWidth = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距
    const margin = {
        top: 100,      // 顶部留出标题空间
        right: 20,   // 大幅增加右侧边距，确保圆形完全显示
        bottom: 60,   // 底部边距
        left: Math.max(20, leftSectionWidth + 20) // 确保左侧边距足够容纳标签和图标
    };
    
    // 计算内部绘图区域尺寸
    const innerWidth = minWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 设置条形图和圆形图的分配比例 - 条形图占更多空间
    const barChartRatio = 0.8;
    const circleChartRatio = 0.2;
    
    // 计算条形图的最大宽度，保证值标签显示
    const barChartWidth = innerWidth * barChartRatio - maxValueWidth - valueLabelGap;
    
    // 计算圆形图部分的宽度
    const circleChartWidth = innerWidth * circleChartRatio;
    
    // 计算圆形的最大直径，确保不溢出右侧边距
    const maxCircleDiameter = Math.min(circleChartWidth * 0.8, 80);
    
    // 计算实际总宽度
    const width = margin.left + barChartWidth + maxValueWidth + valueLabelGap + circleChartWidth + margin.right;
    
    // ---------- 6. 创建比例尺 ----------
    
    // 计算条形的额外间距
    const barPadding = variables.has_spacing ? 0.3 : 0.2;
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // 条形高度
    const barHeight = yScale.bandwidth();
    
    // X轴比例尺（用于第一个数值）- 条形图
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField1]) * 1.05]) // 添加5%边距
        .range([0, barChartWidth]);
    
    // 圆形面积比例尺（用于第二个数值）
    const maxValue2 = d3.max(chartData, d => +d[valueField2]);
    
    // 计算最小和最大半径
    const minRadius = Math.min(barHeight * 0.4, maxCircleDiameter * 0.2);
    const maxRadius = Math.min(barHeight * (1 + barPadding/2), maxCircleDiameter/2);
    
    const radiusScale = d3.scaleSqrt() 
        .domain([0, maxValue2])
        .range([minRadius, maxRadius]);
    
    // ---------- 7. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // ---------- 8. 添加标题 ----------
    
    // 获取条形图颜色和圆形图颜色用于图例
    const barColor = colors.field && colors.field[valueField1] 
        ? colors.field[valueField1] 
        : colors.other.primary;
        
    const circleColor = colors.field && colors.field[valueField2] 
        ? colors.field[valueField2] 
        : colors.other.secondary;
    
    // 标题宽度是总宽度的一半
    const titleWidth = width / 2;
    
    // 设置图例大小和间距
    const legendSize = 16;  // 图例方块/圆形大小
    const legendMargin = 8; // 图例与文本间距
    const legendTextOffset = legendSize + legendMargin; // 文本起始位置偏移
    
    // 修改：左侧列标题 - 左对齐，占据图表一半宽度，支持自动换行
    const leftTitleGroup = svg.append("g")
        .attr("transform", `translate(0, ${margin.top - 30})`);
    
    // 添加方形图例
    leftTitleGroup.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", legendSize)
        .attr("height", legendSize)
        .attr("fill", barColor);
    
    const leftTitle = leftTitleGroup.append("text")
        .attr("x", legendTextOffset)  // 从图例右侧开始
        .attr("y", legendSize / 2)    // 垂直居中对齐文本
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")  // 左对齐
        .style("font-family", typography.description.font_family)
        .style("font-size", typography.description.font_size)
        .style("font-weight", typography.description.font_weight)
        .style("fill", colors.text_color);
    
    // 为长文本实现换行
    wrapText(leftTitle, columnTitle1, titleWidth - legendTextOffset, 1.2);
    
    // 修改：右侧列标题 - 右对齐，占据图表一半宽度，圆形图例位于标题文本左侧
    const rightTitleGroup = svg.append("g")
        .attr("transform", `translate(0, ${margin.top - 30})`);
    
    // 首先添加标题文本 - 右对齐到图表右边缘
    const rightTitle = rightTitleGroup.append("text")
        .attr("x", width)  // 位于图表最右侧
        .attr("y", legendSize / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")  // 右对齐
        .style("font-family", typography.description.font_family)
        .style("font-size", typography.description.font_size)
        .style("font-weight", typography.description.font_weight)
        .style("fill", colors.text_color)
        .text(columnTitle2);
        
    // 测量文本宽度以便正确放置图例
    const rightTitleWidth = rightTitle.node().getComputedTextLength();
    
    // 添加圆形图例 - 位于文本左侧
    rightTitleGroup.append("circle")
        .attr("cx", width - rightTitleWidth - legendMargin - 5)
        .attr("cy", legendSize / 2)
        .attr("r", legendSize/2)
        .attr("fill", circleColor);
    
    // 文本换行函数 - 只用于左侧标题，右侧标题现在不需要换行
    function wrapText(text, str, width, lineHeight) {
        const words = str.split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const y = text.attr("y");
        const dy = parseFloat(text.attr("dy") || 0);
        let tspan = text.text(null).append("tspan")
            .attr("x", text.attr("x"))
            .attr("y", y)
            .attr("dy", dy + "em");
        
        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            const node = tspan.node();
            if (node.getComputedTextLength && node.getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan")
                    .attr("x", text.attr("x"))
                    .attr("y", y)
                    .attr("dy", ++lineNumber * lineHeight + dy + "em")
                    .text(word);
            }
        }
    }
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 10. 绘制元素 ----------
    
    // 获取条形图颜色
    const getBarColor = () => {
        if (colors.field && colors.field[valueField1]) {
            return colors.field[valueField1];
        }
        return colors.other.primary; 
    };
    
    // 获取圆形图颜色
    const getCircleColor = () => {
        if (colors.field && colors.field[valueField2]) {
            return colors.field[valueField2];
        }
        return colors.other.secondary;
    };
    
    // 为每个维度绘制内容
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
            
            const y = yScale(dimension);
            if (typeof y !== 'number') {
                console.error(`Invalid y position for dimension: ${dimension}`);
                return;
            }
            
            const barHeight = yScale.bandwidth();
            const centerY = y + barHeight / 2;
            const barWidthValue = xScale(+dataPoint[valueField1]);
            
            // 1. 添加国家/地区名称 - 右对齐
            // 标签位置在最左侧，右对齐
            const labelX = -flagWidth - flagMargin - textIconGap;
            
            g.append("text")
                .attr("x", labelX)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")  // 右对齐
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(dimension.toUpperCase());
                
            // 2. 添加国家/地区图标 - 修改：直接使用矩形图标
            if (images.field && images.field[dimension]) {
                // 创建一个组来包含图像
                const iconGroup = g.append("g")
                    .attr("transform", `translate(${-flagWidth - flagMargin}, ${centerY - flagHeight/2})`);
                
                // 直接添加国家/地区图标，不使用圆形裁剪
                iconGroup.append("image")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", flagWidth)
                    .attr("height", flagHeight)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", images.field[dimension]);
            }
            
            // 3. 绘制条形 - 只使用矩形
            g.append("rect")
                .attr("x", 0)
                .attr("y", y)
                .attr("width", barWidthValue)
                .attr("height", barHeight)
                .attr("fill", getBarColor())
                .attr("opacity", 0.9);
            
            // 4. 添加条形数值标签
            const formattedValue1 = `${formatValue(+dataPoint[valueField1])}${valueUnit1}`;
            
            g.append("text")
                .attr("x", barWidthValue + valueLabelGap)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(formattedValue1);
            
            // 5. 计算圆形位置
            // 确保圆形居中放置
            const circleX = barChartWidth + maxValueWidth + valueLabelGap + circleChartWidth / 2;
            const circleRadius = radiusScale(+dataPoint[valueField2]);
            
            // 绘制圆形
            g.append("circle")
                .attr("cx", circleX)
                .attr("cy", centerY)
                .attr("r", circleRadius)
                .attr("fill", getCircleColor())
                .attr("opacity", 0.7);
            
            // 6. 添加圆形数值标签
            const formattedValue2 = `${formatValue(+dataPoint[valueField2])}${valueUnit2}`;
            g.append("text")
                .attr("x", circleX)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(formattedValue2);
            
        } catch (error) {
            console.error(`Error rendering chart element for ${dimension}:`, error);
        }
    });
    
    // 返回SVG节点
    return svg.node();
}