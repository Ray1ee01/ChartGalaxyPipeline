/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_14",
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
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": ["radius_corner", "spacing", "shadow", "gradient", "stroke"],
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

// 水平条形图与比例圆复合图表实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                           // 完整的JSON数据对象
    const chartData = jsonData.data.data                 // 实际数据点数组  
    const variables = jsonData.variables || {};      // 图表配置
    const typography = jsonData.typography || {      // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "28px", font_weight: 700 },
        label: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        description: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: 400 }
    };
    const colors = jsonData.colors || { 
        text_color: "#000000", 
        background_color: "#FFFFFF",
        other: { primary: "#83C341" }
    };
    const images = jsonData.images || { field: {}, other: {} };   // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    const titles = jsonData.titles || {};           // 标题配置
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners !== undefined ? variables.has_rounded_corners : false;
    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : false;
    variables.has_shadow = variables.has_shadow !== undefined ? variables.has_shadow : false;
    variables.has_gradient = variables.has_gradient !== undefined ? variables.has_gradient : false;
    variables.has_stroke = variables.has_stroke !== undefined ? variables.has_stroke : false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距
    const margin = {
        top: 100,      // 顶部留出标题空间
        right: 5,      // 右侧边距
        bottom: 40,    // 底部边距
        left: 10       // 左侧边距，给文字留出一些空间
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "Country";
    const valueField1 = dataColumns.find(col => col.role === "y" )?.name || "Crypto Ownership Percentage";
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name || "Number of Owners";
    
    // 获取字段单位
    let valueUnit1 = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : 
                       dataColumns.find(col => col.role === "y")?.unit;
    let valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit === "none"? "" :
                       dataColumns.find(col => col.role === "y2")?.unit;
    valueUnit1 = valueUnit1 ? valueUnit1 : "";
    valueUnit2 = valueUnit2 ? valueUnit2 : "";
    
    // 列标题（使用数据列的name字段，而不是description）
    const columnTitle1 = dataColumns.find(col => col.role === "y")?.name || 
                          "Crypto Ownership Percentage";
    const columnTitle2 = dataColumns.find(col => col.role === "y2")?.name || 
                          "Number of Owners";
    
    // ---------- 4. 数据处理 ----------
    
    // 按第一个数值字段降序排序数据
    const sortedData = [...chartData].sort((a, b) => b[valueField1] - a[valueField1]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);
    
    // ---------- 5. 布局计算 ----------
    
    // 设置条形图和圆形图的布局比例
    const leftColumnRatio = 0.85;  // 左列占比
    const rightColumnRatio = 0.15; // 右列占比
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 计算两列的宽度
    const barChartWidth = innerWidth * leftColumnRatio;
    const circleChartWidth = innerWidth * rightColumnRatio;
    
    // ---------- 6. 创建比例尺 ----------
    
    // 计算条形的额外间距（如果启用）
    const barPadding = variables.has_spacing ? 0.2 : 0.1;
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（用于第一个数值）- 条形图
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField1]) * 1.05]) // 添加5%边距
        .range([0, barChartWidth]);
    
    // 圆形面积比例尺（用于第二个数值）
    const maxValue2 = d3.max(chartData, d => +d[valueField2]);
    const minRadius = yScale.bandwidth() * 0.1;  // 最小半径
    const maxRadius = Math.min(yScale.bandwidth() * 1.0,circleChartWidth*0.5)  // 最大半径可以是两个条形的高度
    
    const radiusScale = d3.scaleSqrt()  // 使用平方根比例尺确保面积比例正确
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
    
    // ---------- 8. 添加SVG定义 ----------
    
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
    
    // 为每个维度创建渐变（如果启用）
    if (variables.has_gradient) {
        sortedDimensions.forEach(dimension => {
            const barColor = getBarColor(dimension);
            
            const gradient = defs.append("linearGradient")
                .attr("id", `bar-gradient-${dimension.replace(/\s+/g, '-')}`)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(barColor).brighter(0.5));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(barColor).darker(0.3));
        });
    }
    
    // ---------- 9. 添加标题和标题下的线条 ----------
   
    // 计算标题位置
    const leftTitleX = margin.left;
    const rightTitleX = margin.left + barChartWidth + circleChartWidth / 2;
    const titleY = margin.top - 25;
    const lineY = margin.top - 10;
    
    // 左侧列标题
    const leftTitleText = svg.append("text")
    .attr("x", leftTitleX)
    .attr("y", titleY)
    .attr("text-anchor", "start")
    .style("font-family", typography.description.font_family)
    .style("font-size", typography.description.font_size)
    .style("font-weight", typography.description.font_weight)
    .style("fill", colors.text_color)
    .text(columnTitle1.toUpperCase());

    // 计算左侧标题宽度，用于定位三角形
    const leftTitleWidth = leftTitleText.node().getBBox().width;

    
    // 右侧列标题
    svg.append("text")
        .attr("x", width - margin.right)
        .attr("y", titleY)
        .attr("text-anchor", "end")
        .style("font-family", typography.description.font_family)
        .style("font-size", typography.description.font_size)
        .style("font-weight", typography.description.font_weight)
        .style("fill", colors.text_color)
        .text(columnTitle2.toUpperCase());
    
    // 标题下的黑线
    svg.append("line")
        .attr("x1", margin.left)
        .attr("y1", lineY)
        .attr("x2", width - margin.right)
        .attr("y2", lineY)
        .attr("stroke", "#000000")
        .attr("stroke-width", 1.5);
    
    // 左侧标题下的三角形 - 放在左标题的正中心下面
    const leftTriangleX = leftTitleX + leftTitleWidth / 2;
    svg.append("polygon")
        .attr("points", `${leftTriangleX - 6},${lineY + 1} ${leftTriangleX + 6},${lineY + 1} ${leftTriangleX},${lineY + 8}`)
        .attr("fill", "#000000");
    
    // 右侧标题下的三角形
    svg.append("polygon")
        .attr("points", `${rightTitleX - 6},${lineY + 1} ${rightTitleX + 6},${lineY + 1} ${rightTitleX},${lineY + 8}`)
        .attr("fill", "#000000");
    
    // ---------- 10. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 11. 获取条形图颜色的辅助函数 ----------
    
    // 获取条形图颜色
    const getBarColor = (dimension) => {
        if (colors.field && colors.field[dimension]) {
            return colors.field[dimension];
        }
        return colors.other.primary || "#83C341";
    };
    
    // ---------- 12. 绘制所有圆形（从下到上）----------
    
    sortedDimensions.forEach((dimension, index) => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        if (!dataPoint) return;
        
        const barHeight = yScale.bandwidth();
        const y = yScale(dimension);
        const centerY = y + barHeight / 2;
        
        // 绘制圆形（应用视觉效果）
        const circleRadius = radiusScale(+dataPoint[valueField2]);
        const circleX = barChartWidth + circleChartWidth / 2;
        
        g.append("circle")
            .attr("cx", circleX)
            .attr("cy", centerY)
            .attr("r", circleRadius)
            .attr("fill", getBarColor(dimension))
            .style("stroke", variables.has_stroke ? d3.rgb(getBarColor(dimension)).darker(0.5) : "none")
            .style("stroke-width", variables.has_stroke ? 1.5 : 0)
            .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
    });
    
    // ---------- 13. 为每个维度绘制条形和圆形 ----------
    
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
            const barWidthValue = xScale(+dataPoint[valueField1]);
            
            // 1. 绘制条形（应用视觉效果）
            const barFill = variables.has_gradient 
                ? `url(#bar-gradient-${dimension.replace(/\s+/g, '-')})`
                : getBarColor(dimension);
                
            g.append("rect")
                .attr("x", 0)
                .attr("y", y)
                .attr("width", barWidthValue)
                .attr("height", barHeight)
                .attr("fill", barFill)
                .attr("rx", variables.has_rounded_corners ? barHeight * 0.2 : 0)
                .attr("ry", variables.has_rounded_corners ? barHeight * 0.2 : 0)
                .style("stroke", variables.has_stroke ? d3.rgb(getBarColor(dimension)).darker(0.5) : "none")
                .style("stroke-width", variables.has_stroke ? 1.5 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            
            // 2. 添加国家/地区名称（直接在条形内部左侧）
            const countryLabel = g.append("text")
                .attr("x", 10) // 左侧内边距
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", "#FFFFFF") // 白色文本
                .text(dimension.toUpperCase());
            
            // 创建临时文本元素用于测量
            const tempText = g.append("text")
                .attr("x", -1000)  // 放在不可见区域
                .attr("y", -1000)
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .text(dimension.toUpperCase());
            
            // 获取国家标签的精确宽度
            const countryLabelWidth = tempText.node().getBBox().width;
            tempText.remove();  // 移除临时元素
            
            // 3. 添加条形数值标签
            const formattedValue1 = `${dataPoint[valueField1]}${valueUnit1}`;
            
            // 创建临时文本元素用于测量数值宽度
            const tempValueText = g.append("text")
                .attr("x", -1000)
                .attr("y", -1000)
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .text(formattedValue1);
            
            const valueTextWidth = tempValueText.node().getBBox().width;
            tempValueText.remove();  // 移除临时元素
            
            // 判断是否有足够空间在条形内部放置数值（检查是否会与国家标签重叠）
            const minSpaceNeeded = countryLabelWidth + valueTextWidth + 5; // 额外的间距
            
            let labelX, textAnchor, labelColor;
            if (barWidthValue > minSpaceNeeded) {
                // 放在条形内部右侧
                labelX = barWidthValue - 5;
                textAnchor = "end";
                labelColor = "#FFFFFF"; // 白色文本
            } else {
                // 放在条形外部
                labelX = barWidthValue + 5;
                textAnchor = "start";
                labelColor = colors.text_color; // 使用定义的文本颜色
            }
            
            g.append("text")
                .attr("x", labelX)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", textAnchor)
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", labelColor)
                .text(formattedValue1);
            
            // 4. 添加圆形数值标签
            const circleRadius = radiusScale(+dataPoint[valueField2]);
            const circleX = barChartWidth + circleChartWidth / 2;
            const formattedValue2 = `${dataPoint[valueField2]}${valueUnit2}`;
            
            // 创建临时文本元素用于测量数值宽度
            const tempCircleValueText = g.append("text")
                .attr("x", -1000)
                .attr("y", -1000)
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .text(formattedValue2);
            
            const value2TextWidth = tempCircleValueText.node().getBBox().width;
            tempCircleValueText.remove();  // 移除临时元素
            
            // 判断文本是否能放入圆内
            let textFitsInCircle = (circleRadius * 2 > value2TextWidth + 10);           
            
            
            
            if (textFitsInCircle) {
                // 文本放在圆内，白色
                g.append("text")
                    .attr("x", circleX)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .style("font-family", typography.label.font_family)
                    .style("font-size", typography.label.font_size)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", "#FFFFFF")
                    .text(formattedValue2);
            } else {
                // 文本放在圆上方，与圆相同颜色
                g.append("text")
                    .attr("x", circleX)
                    .attr("y", centerY - circleRadius - 5)
                    .attr("dy", "0em")
                    .attr("text-anchor", "middle")
                    .style("font-family", typography.label.font_family)
                    .style("font-size", typography.label.font_size)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", getBarColor(dimension))
                    .text(formattedValue2);
            }
            
            // 5. 添加连接线 - 从条形图（或标签）到圆形
            // 获取线的颜色，使用对应维度的颜色
            const lineColor = getBarColor(dimension);
            
            // 确定线的起始位置
            let lineStartX;
            if (barWidthValue > minSpaceNeeded) {
                // 如果标签在条形内部，线从条形右边缘开始
                lineStartX = barWidthValue;
            } else {
                // 如果标签在条形外部，线从标签右边缘开始
                lineStartX = barWidthValue + 5 + valueTextWidth;
            }
            
            // 计算线的终点（圆的左边缘）
            const lineEndX = circleX - circleRadius;
            
            // 绘制连接线
            g.append("line")
                .attr("x1", lineStartX)
                .attr("y1", centerY)
                .attr("x2", lineEndX)
                .attr("y2", centerY)
                .attr("stroke", lineColor)
                .attr("stroke-width", 0.8);
            
        } catch (error) {
            console.error(`Error rendering chart element for ${dimension}:`, error);
            // Continue with the next item instead of stopping the entire chart
        }
    });
    
    // 返回SVG节点
    return svg.node();
}