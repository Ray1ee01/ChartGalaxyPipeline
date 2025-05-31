/* 
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_19",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
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

// 右对齐水平条形图实现 - 使用D3.js (集成图标和独立颜色)  horizontal_bar_chart_11
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                           // 完整的JSON数据对象
    const chartData = jsonData.data.data                 // 实际数据点数组  
    const variables = jsonData.variables || {};      // 图表配置
    const typography = jsonData.typography || {      // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333",
        other: { primary: "#E74C3C" }  // 默认使用红色作为条形颜色
    };  
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    const images = jsonData.images || {}; // 获取图标数据
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距 - 增加顶部边距以容纳Y轴名称和第一个标签/图标
    const margin = {
        top: 100,     // 增加顶部边距
        right: 10,    // 最小右侧边距
        bottom: 60,   // 底部边距
        left: 10     // 左侧边距，留足空间放置数值标签
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    
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
    
    // 获取唯一维度值
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    
    // 按数值从小到大排序数据
    const orderedData = [...chartData].sort((a, b) => +a[valueField] - +b[valueField]);
    const orderedDimensions = orderedData.map(d => d[dimensionField]);
    
    // 计算最小和最大值用于比例尺
    const minValue = d3.min(chartData, d => +d[valueField]);
    const maxValue = d3.max(chartData, d => +d[valueField]);
    
    // 确定是否有负值
    const hasNegativeValues = minValue < 0;
    
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
    
    // ---------- 5. 计算标签宽度和图表尺寸 ----------
    
    // 创建临时SVG来测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 计算最大维度标签宽度（用于潜在的布局调整，这里暂时不用）
    let maxLabelWidth = 0;
    dimensions.forEach(dimension => {
        const formattedDimension = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size) // 使用基础字号
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
        maxLabelWidth = Math.max(maxLabelWidth, tempText.node().getBBox().width);
        tempText.remove();
    });
    
    // 计算最大数值标签宽度
    let maxValueWidth = 0;
    chartData.forEach(d => {
        const formattedValue = valueUnit ? 
            `${formatValue(d[valueField])}${valueUnit}` : 
            `${formatValue(d[valueField])}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .text(formattedValue);
        
        const textWidth = tempText.node().getBBox().width;
        maxValueWidth = Math.max(maxValueWidth, textWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 根据数值标签宽度调整左边距
    margin.left = Math.max(margin.left, maxValueWidth + 10); // 增加一点间距
    
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
    
    // 添加defs用于视觉效果
    const defs = svg.append("defs");
    
    // ---------- 7. 创建比例尺 ----------
    
    // 计算条形的额外间距（如果启用）
    const barPadding = 0.55;
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(orderedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（用于数值）- 右对齐
    const xScale = d3.scaleLinear()
        .domain([
            hasNegativeValues ? Math.min(minValue * 1.1, 0) : 0, 
            Math.max(maxValue * 1.1, 0)
        ])
        .range([0, innerWidth]);
        
    // ---------- 8. 动态图标和标签大小计算 (恢复基于可用空间) ----------
    const barStep = yScale.step(); 
    const barHeight = yScale.bandwidth();
    // 计算条形本身之间的垂直间隙
    const gapBetweenBars = barStep - barHeight;
    
    // 允许图标/标签使用的最大垂直空间（例如，间隙的80%）
    const maxTotalHeight = Math.max(15, gapBetweenBars * 0.8); // 保证最小15px

    // 根据最大总高度分配图标和标签的高度
    // 图标高度占总高度的约 70%，但不超过 barHeight 的 90%，且不超过20px
    const iconHeight = Math.min(barHeight * 0.9, maxTotalHeight * 0.7, 20); 
    const iconWidth = iconHeight; // 保持图标宽高比

    // 基于图标高度计算维度标签的字体大小 (因为并排)
    const targetLabelFontSize = iconHeight * 0.9;
    const labelFontSize = `${Math.max(4, Math.min(16, targetLabelFontSize))}px`; // 限制范围 8px-16px, 并转为字符串

    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
        
    // ---------- 10. 添加Y轴名称 (Value Field Name) ----------
    const yAxisName = valueField; // Y轴使用的字段名
    g.append("text")
        .attr("x", innerWidth) // 右对齐到绘图区边缘
        .attr("y", -5) 
        .attr("dy", "0.35em") // 垂直微调
        .attr("text-anchor", "end") // 右对齐
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size) // 使用label的字体设置
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color || "#333333") // 默认文本颜色
        .text(yAxisName);
        
    // ---------- 11. 绘制条形、标签和图标 ----------
    
    orderedDimensions.forEach((dimension, index) => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const yPosition = yScale(dimension);
            const value = +dataPoint[valueField];
            
            // 获取特定颜色和图标
            const barColor = (colors.field && colors.field[dimension]) ? colors.field[dimension] : colors.other.primary;
            const iconSrc = (images.field && images.field[dimension]) ? images.field[dimension] : null;

            // 为每个bar创建独立的渐变
            const gradientId = `bar-gradient-${index}`;
            const gradient = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");

            // 定义从左到右的渐变，中间最亮，两边较暗
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(barColor).darker(0.3));

            gradient.append("stop")
                .attr("offset", "50%")
                .attr("stop-color", d3.rgb(barColor).brighter(2.5));

            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(barColor).darker(0.3));

            // 计算条形宽度和位置 - 右对齐
            let barWidth = Math.abs(xScale(value) - xScale(0));
            let barX = value >= 0 ? innerWidth - barWidth : innerWidth - barWidth; // 考虑负值（虽然此图表类型通常不处理）
            
            // ---------- 添加图标和维度标签（条形上方，右对齐 - 使用动态计算）----------
            let labelEndX = innerWidth; // 标签默认结束于右边缘

            // 添加图标（如果存在）
            if (iconSrc) {
                g.append("image") // 直接添加到主绘图组g
                    .attr("x", innerWidth - iconWidth) // 使用动态iconWidth
                    .attr("y", yPosition - iconHeight - 5) // 使用动态iconHeight
                    .attr("width", iconWidth)
                    .attr("height", iconHeight)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", iconSrc);
                
                // 如果有图标，标签向左移动一点
                labelEndX = innerWidth - iconWidth - 8; // 8px间距
            }
            
            // 添加维度标签
            const formattedDimension = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
            g.append("text") // 直接添加到主绘图组g
                .attr("x", labelEndX) // 结束位置（右对齐）
                // 垂直居中于图标的位置 (基于动态 iconHeight)
                .attr("y", yPosition - 5 - iconHeight / 2) 
                .attr("dy", "0.35em") // 垂直微调
                .attr("text-anchor", "end") // 右对齐
                .style("font-family", typography.label.font_family)
                .style("font-size", labelFontSize) // 使用动态计算的字号
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(formattedDimension);

            // ---------- 创建条形组（为了方便管理标签和条形） ----------
            const barGroup = g.append("g")
                .attr("transform", `translate(0, ${yPosition})`);
            
            // ---------- 绘制条形 (简化实现，使用rect元素实现左侧圆角) ----------
            barGroup.append("rect")
                .attr("x", barX)
                .attr("y", 0)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", `url(#${gradientId})`) // 使用每个bar独立的渐变
                .attr("rx", barHeight / 4) // 左侧圆角
                .attr("ry", barHeight / 4);
            
            // ---------- 添加数值标签（条形外侧左边） ----------
            const formattedValue = valueUnit ? 
                `${formatValue(value)}${valueUnit}` : 
                `${formatValue(value)}`;
            
            barGroup.append("text")
                .attr("x", barX - 5) // 条形外左侧5px
                .attr("y", barHeight / 2)
                .attr("dy", "0.35em") // 垂直居中
                .attr("text-anchor", "end") // 右对齐（相对于x坐标）
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(18, Math.max(barHeight * 0.5, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#333333") // 使用默认文本颜色
                .text(formattedValue);
        }
    });
    
    // 返回SVG节点
    return svg.node();
}