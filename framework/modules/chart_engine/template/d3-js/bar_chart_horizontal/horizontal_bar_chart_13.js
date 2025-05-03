/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_13",
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
    
    // 设置视觉效果默认值
    variables.has_rounded_corners = variables.has_rounded_corners !== undefined ? variables.has_rounded_corners : true;
    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : false;
    
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
    
    // 5. 布局计算
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
    
    // 6. 创建比例尺
    const barPadding = variables.has_spacing ? 0.3 : 0.1;
    
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

    // Define clip path for bars
    const clipPathId = "bar-clip-path";
    svg.append("defs")
        .append("clipPath")
        .attr("id", clipPathId)
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", barChartWidth) // Clip at the right edge of the bar area
        .attr("height", innerHeight);

    // 8. 添加标题
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
            const barRadius = barHeight / 2; // 条形图右侧圆角半径

            // --- Calculate Element Widths and Spaces ---
            const iconSize = flagWidth; // 图标大小
            const textPadding = 5; // 文本内边距

            const dimensionLabelText = dimension.toUpperCase();
            const valueLabelText = `${dataPoint[valueField1]}${valueUnit1}`;

            const currentDimLabelWidth = estimateLabelWidth(dimensionLabelText, typography.label, barHeight);
            const currentValueLabelWidth = estimateLabelWidth(valueLabelText, typography.annotation, barHeight);

            const iconMinSpace = iconSize + textPadding; // 仅图标所需空间
            const totalIconDimSpace = iconMinSpace + currentDimLabelWidth + textPadding; // 图标+维度标签所需空间
            const totalInsideSpace = totalIconDimSpace + currentValueLabelWidth + textPadding * 2; // 所有元素所需空间

            // --- Determine Positioning Strategy based on barWidthValue ---
            let iconX, dimLabelX, valueLabelX;
            let dimLabelColor, valueLabelColor;
            let dimLabelAnchor, valueLabelAnchor;
            let lineStartX; // 连接线起点

            if (barWidthValue < iconMinSpace) {
                // 策略1：所有元素放在外部
                iconX = barWidthValue + textPadding;
                dimLabelX = iconX + iconSize + textPadding;
                valueLabelX = dimLabelX + currentDimLabelWidth + 15;
                
                dimLabelColor = colors.text_color;
                valueLabelColor = colors.text_color;
                dimLabelAnchor = "start";
                valueLabelAnchor = "start";
                lineStartX = valueLabelX + currentValueLabelWidth;
            
            } else if (barWidthValue < totalIconDimSpace) {
                // 策略2：图标内部，文本外部
                iconX = textPadding;
                dimLabelX = barWidthValue + textPadding;
                valueLabelX = dimLabelX + currentDimLabelWidth + 15;
                
                dimLabelColor = colors.text_color;
                valueLabelColor = colors.text_color;
                dimLabelAnchor = "start";
                valueLabelAnchor = "start";
                lineStartX = valueLabelX + currentValueLabelWidth;
            
            } else {
                // 策略3：图标和维度标签内部，检查数值标签
                iconX = textPadding;
                dimLabelX = iconX + iconSize + textPadding;
                dimLabelColor = colors.text_color;
                dimLabelAnchor = "start";
                
                if (barWidthValue >= totalInsideSpace) {
                    // 策略3a：所有元素内部
                    valueLabelX = barWidthValue - textPadding;
                    valueLabelColor = "#FFFFFF";
                    valueLabelAnchor = "end";
                    lineStartX = barWidthValue;
                } else {
                    // 策略3b：数值标签外部
                    valueLabelX = barWidthValue + textPadding;
                    valueLabelColor = colors.text_color;
                    valueLabelAnchor = "start";
                    lineStartX = valueLabelX + currentValueLabelWidth;
                }
            }

            // 1. 绘制条形 (barRadius was defined above)
            g.append("path")
                .attr("d", () => {
                    // Always draw the bar with the rounded right corner
                    // The clip path will handle cases where barWidthValue < barRadius
                    const pathData = `
                        M 0,${y}
                        L ${barWidthValue - barRadius},${y}
                        A ${barRadius},${barRadius} 0 0,1 ${barWidthValue},${centerY}
                        A ${barRadius},${barRadius} 0 0,1 ${barWidthValue - barRadius},${y + barHeight}
                        L 0,${y + barHeight}
                        Z
                    `;
                    return pathData;
                })
                .attr("fill", getBarColor(dimension))
                .attr("opacity", 0.9)
                .attr("clip-path", `url(#${clipPathId})`); // Apply the clip path

            // 2. 添加国家/地区标签和图标 (using calculated positions)
            const iconGroup = g.append("g")
                .attr("transform", `translate(${iconX}, ${centerY - flagHeight/2})`);

            if (images.field && images.field[dimension]) {
                const clipRadius = (flagHeight/2) * 0.8;
                const clipId = `clip-${dimension.replace(/\s+/g, '-').toLowerCase()}-${index}`;
                const defs = g.append("defs");
                defs.append("clipPath")
                    .attr("id", clipId)
                    .append("circle")
                    .attr("cx", flagWidth/2)
                    .attr("cy", flagHeight/2)
                    .attr("r", clipRadius - 2);
                
                // Border Circle (always add, even if image is missing, for consistency? Maybe not)
                iconGroup.append("circle")
                    .attr("cx", flagWidth/2)
                    .attr("cy", flagHeight/2)
                    .attr("r", clipRadius)
                    .attr("fill", "none")
                    .attr("stroke", "#000000") // Keep border consistent
                    .attr("stroke-width", 2);

                // Clipped Image
                iconGroup.append("image")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", flagWidth)
                    .attr("height", flagHeight)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", images.field[dimension])
                    .attr("clip-path", `url(#${clipId})`);
            } else {
                 // Placeholder if no image? Or just omit?
                 // For now, draw a simple circle placeholder using icon color
                 iconGroup.append("circle")
                    .attr("cx", flagWidth / 2)
                    .attr("cy", flagHeight / 2)
                    .attr("r", (flagHeight / 2) * 0.8) // Match clipRadius approx
                    .attr("fill", getBarColor(dimension)) // Use bar color?
                    .attr("stroke", "#000000")
                    .attr("stroke-width", 2);
            }

            // Dimension Label (Country Name)
            g.append("text")
                .attr("x", dimLabelX)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", dimLabelAnchor)
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", dimLabelColor)
                .text(dimensionLabelText);

            // 3. 添加条形数值标签 (Percentage)
            const valueLabelFontSize = `${Math.min(20, Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`;
            g.append("text")
                .attr("x", valueLabelX)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", valueLabelAnchor)
                .style("font-family", typography.annotation.font_family)
                .style("font-size", valueLabelFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", valueLabelColor)
                .text(valueLabelText);

            // 4. 绘制圆形 (Nominal GDP)
            const circleRadius = radiusScale(+dataPoint[valueField2]);
            const circleX = barChartWidth + circleChartWidth / 2;
            g.append("circle")
                .attr("cx", circleX)
                .attr("cy", centerY)
                .attr("r", circleRadius)
                .attr("fill", getCircleColor(dimension))
                .attr("opacity", 0.6);

            // 5. 添加圆形数值标签 (GDP Value)
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

            // 6. 添加连接线 - using calculated lineStartX
            const lineColorIndex = index % (colors.available_colors?.length || 1);
            const lineColor = colors.available_colors?.[lineColorIndex] || colors.other.primary || "#83C341";
            const lineEndX = circleX - circleRadius;

            if (lineStartX < lineEndX - 1) {
                g.append("line")
                    .attr("x1", lineStartX)
                    .attr("y1", centerY)
                    .attr("x2", lineEndX)
                    .attr("y2", centerY)
                    .attr("stroke", lineColor)
                    .attr("stroke-width", 0.8);
            }
        } catch (error) {
            console.error(`渲染${dimension}时出错:`, error);
        }
    });

    // 移除临时SVG元素
    tempTextSvg.remove();

    // 返回SVG节点
    return svg.node();
}