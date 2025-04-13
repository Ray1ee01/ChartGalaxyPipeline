/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart with Proportional Circles",
    "chart_name": "horizontal_bar_proportional_circle_area_chart_01",
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
    "required_other_colors": ["primary"],
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
        text_color: "#FFFFFF", 
        background_color: "#0A3B39",
        other: { primary: "#83C341" }
    };
    const images = jsonData.images || { field: {}, other: {} };   // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    const titles = jsonData.titles || {};           // 标题配置
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners !== undefined ? variables.has_rounded_corners : true;
    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距
    const margin = {
        top: 100,      // 顶部留出标题空间
        right: 5,     // 右侧边距
        bottom: 40,    // 底部边距
        left: 0       // 左侧边距很小，因为条形图需要紧贴左边
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
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
    
    // 图标尺寸
    const flagWidth = 30;
    const flagHeight = 30;
    const flagMargin = 10;
    const textMargin = 5;
    
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
    const barPadding = variables.has_spacing ? 0.3 : 0.1;
    
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
    const minRadius = yScale.bandwidth() * 0.3;  // 最小半径
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
    
    // 添加背景
    // svg.append("rect")
    //     .attr("width", width)
    //     .attr("height", height)
    //     .attr("fill", colors.background_color || "#0A3B39");
    
    // ---------- 8. 添加标题 ----------
   
    // 计算标题位置 - 调整左侧标题与国家文本标签左侧对齐
    const leftTitleX = margin.left + flagMargin + flagWidth + textMargin;
    
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
    
    // 右侧列标题 - 调整为右侧对齐
    svg.append("text")
        .attr("x", width - margin.right - 10)
        .attr("y", margin.top - 10)
        .attr("text-anchor", "end")
        .style("font-family", typography.description.font_family)
        .style("font-size", typography.description.font_size)
        .style("font-weight", typography.description.font_weight)
        .style("fill", colors.text_color)
        .text(columnTitle2);
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 10. 绘制条形和标签 ----------
    
    // 获取条形图颜色
    const getBarColor = (dimension) => {
        
        return colors.other.primary || "#83C341"; // 亮绿色
    };
    
    // 获取圆形图颜色
    const getCircleColor = (dimension) => {
        
        return colors.other.primary || "#83C341"; // 亮绿色
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
            const barWidthValue = xScale(+dataPoint[valueField1]);
            const radius = barHeight / 2;
            
            // 1. 绘制条形（左侧是方形，右侧是半圆）
            g.append("path")
                .attr("d", () => {
                    return `
                        M 0,${y}
                        L ${barWidthValue - radius},${y}
                        A ${radius},${radius} 0 0,1 ${barWidthValue},${centerY}
                        A ${radius},${radius} 0 0,1 ${barWidthValue - radius},${y + barHeight}
                        L 0,${y + barHeight}
                        Z
                    `;
                })
                .attr("fill", getBarColor(dimension))
                .attr("opacity", 0.9);
            
            // 2. 添加国家/地区标签和图标
            if (images.field && images.field[dimension]) {
                // 计算裁剪圆的半径 (80% of flagHeight/2)
                const clipRadius = (flagHeight/2) * 0.8;
                
                // 为每个国家图标创建唯一的clipPath ID
                const clipId = `clip-${dimension.replace(/\s+/g, '-').toLowerCase()}-${index}`;
                
                // 添加剪切路径定义
                const defs = g.append("defs");
                
                defs.append("clipPath")
                    .attr("id", clipId)
                    .append("circle")
                    .attr("cx", flagWidth/2)
                    .attr("cy", flagHeight/2)
                    .attr("r", clipRadius-2);
                
                // 创建一个组来包含图像和边框
                const iconGroup = g.append("g")
                    .attr("transform", `translate(${flagMargin}, ${centerY - flagHeight/2})`);
                
                // 添加黑色边框圆 - 放在图像下面但会显示在图像周围
                iconGroup.append("circle")
                    .attr("cx", flagWidth/2)
                    .attr("cy", flagHeight/2)
                    .attr("r", clipRadius)
                    .attr("fill", "none")
                    .attr("stroke", "#000000")
                    .attr("stroke-width", 2);
                
                // 添加裁剪后的国家/地区图标
                iconGroup.append("image")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", flagWidth)
                    .attr("height", flagHeight)
                    .attr("xlink:href", images.field[dimension])
                    .attr("clip-path", `url(#${clipId})`);
            }
            
            // 添加国家/地区名称
            g.append("text")
                .attr("x", flagMargin + flagWidth + textMargin)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(dimension.toUpperCase());
            
            // 3. 添加条形数值标签 - 决定标签位置
            const formattedValue1 = `${dataPoint[valueField1]}${valueUnit1}`;
            
            // 计算文本的预估宽度 (粗略估计)
            const estimatedTextWidth = formattedValue1.length * 9;
            
            // 如果是第一个条形，或者标签会超出第一个条形的右边缘，则放在内部
            const isFirstBar = index === 0;
            const labelWouldExtendBeyond = barWidthValue + estimatedTextWidth > firstBarWidth;
            const shouldPlaceInside = isFirstBar || labelWouldExtendBeyond;
            
            // 设置标签位置
            let labelX, textAnchor;
            if (shouldPlaceInside) {
                // 放在条形内部右侧
                labelX = barWidthValue- 5;
                textAnchor = "end";
            } else {
                // 放在条形外部
                labelX = barWidthValue + 5;
                textAnchor = "start";
            }
            
            // 根据标签位置确定文本颜色
            const labelColor = shouldPlaceInside ? "#FFFFFF" : colors.text_color;
            
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
            
            // 4. 绘制圆形
            const circleRadius = radiusScale(+dataPoint[valueField2]);
            const circleX = barChartWidth + circleChartWidth / 2;
            g.append("circle")
                .attr("cx", circleX)
                .attr("cy", centerY)
                .attr("r", circleRadius)
                .attr("fill", getCircleColor(dimension))
                .attr("opacity", 0.6);
            
            // 5. 添加圆形数值标签
            const formattedValue2 = `${dataPoint[valueField2]}${valueUnit2}`;
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
            
            // 6. 添加连接线 - 从条形图（或标签）到圆形
            // 选择一个颜色从available_colors数组
            const lineColorIndex = index % colors.available_colors.length;
            const lineColor = colors.available_colors[0];
            
            // 确定线的起始位置
            let lineStartX;
            if (shouldPlaceInside) {
                // 如果标签在条形内部，线从条形右边缘开始
                lineStartX = barWidthValue;
            } else {
                // 如果标签在条形外部，线从标签右边缘开始
                lineStartX = barWidthValue + 5 + estimatedTextWidth;
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