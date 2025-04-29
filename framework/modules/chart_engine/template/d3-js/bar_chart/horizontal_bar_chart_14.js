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

// 水平条形图与比例圆复合图表实现 - 使用D3.js  horizontal bar proportional circle area chart 02
function makeChart(containerSelector, data) {
        // ---------- 1. 数据准备阶段 ----------
        
        // 提取数据和配置
        const jsonData = data;                           // 完整的JSON数据对象
        const chartData = jsonData.data.data                 // 实际数据点数组  
        const variables = jsonData.variables || {};      // 图表配置
        const typography = jsonData.typography || {      // 字体设置，如果不存在则使用默认值
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
        const images = jsonData.images || { field: {}, other: {} };   // 图像设置
        const dataColumns = jsonData.data.columns || []; // 数据列定义
        const titles = jsonData.titles || {};           // 标题配置
        
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
            top: 100,      // 顶部留出标题空间
            right: 5,      // 右侧边距
            bottom: 40,    // 底部边距
            left: 10       // 左侧边距，给文字留出一些空间
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
        const leftColumnRatio = 0.85;  // 左列占比
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
        const minRadius = yScale.bandwidth() * 0.1;  // 最小半径
        // 最大半径限制在条形高度的一半和右侧列宽的一半之间取较小值
        const maxRadius = Math.min(yScale.bandwidth() * 0.5, circleChartWidth * 0.4); // 稍微缩小一点以防边缘碰撞
        
        const radiusScale = d3.scaleSqrt()  // 使用平方根比例尺确保面积比例正确
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
                .attr("width", "200%") // 增加滤镜区域以包含阴影
                .attr("height", "200%");
            
            filter.append("feGaussianBlur")
                .attr("in", "SourceAlpha")
                .attr("stdDeviation", 3) // 阴影模糊度
                .attr("result", "blur");
            
            filter.append("feOffset")
                .attr("in", "blur") // 输入为模糊后的图像
                .attr("dx", 2) // 水平偏移
                .attr("dy", 2) // 垂直偏移
                .attr("result", "offsetBlur");
            
            const feMerge = filter.append("feMerge");
            feMerge.append("feMergeNode") // 添加阴影层
                .attr("in", "offsetBlur");
            feMerge.append("feMergeNode") // 添加原始图形层（置于顶层）
                .attr("in", "SourceGraphic");
        }
        
        // 为每个维度创建渐变（如果启用）
        if (variables.has_gradient) {
            sortedDimensions.forEach(dimension => {
                const barColor = getBarColor(dimension);
                
                const gradient = defs.append("linearGradient")
                    .attr("id", `bar-gradient-${dimension.replace(/\s+/g, '-')}`)
                    .attr("x1", "0%")
                    .attr("y1", "0%")
                    .attr("x2", "100%") // 水平渐变
                    .attr("y2", "0%");
                
                gradient.append("stop")
                    .attr("offset", "0%")
                    .attr("stop-color", d3.rgb(barColor).brighter(0.5)); // 渐变起始颜色（较亮）
                
                gradient.append("stop")
                    .attr("offset", "100%")
                    .attr("stop-color", d3.rgb(barColor).darker(0.3)); // 渐变结束颜色（较暗）
            });
        }
        
        // ---------- 9. 添加标题和标题下的线条 ----------
       
        // 计算标题位置
        const leftTitleX = margin.left;
        // 右标题的X位置应该基于右侧列的中心
        const rightTitleX = margin.left + barChartWidth + circleChartWidth / 2; 
        const titleY = margin.top - 25; // 标题Y坐标
        const lineY = margin.top - 10; // 分割线Y坐标
        
        // 左侧列标题
        const leftTitleText = svg.append("text")
            .attr("x", leftTitleX)
            .attr("y", titleY)
            .attr("text-anchor", "start") // 左对齐
            .style("font-family", typography.description.font_family)
            .style("font-size", typography.description.font_size)
            .style("font-weight", typography.description.font_weight)
            .style("fill", colors.text_color)
            .text(columnTitle1.toUpperCase()); // 转换为大写
    
        // 计算左侧标题宽度，用于定位三角形
        const leftTitleWidth = leftTitleText.node().getBBox().width;
        
        // 右侧列标题
        const rightTitleText = svg.append("text")
            .attr("x", width - margin.right) // 右对齐到SVG右边缘
            .attr("y", titleY)
            .attr("text-anchor", "end") // 右对齐
            .style("font-family", typography.description.font_family)
            .style("font-size", typography.description.font_size)
            .style("font-weight", typography.description.font_weight)
            .style("fill", colors.text_color)
            .text(columnTitle2.toUpperCase()); // 转换为大写
    
        // 计算右侧标题宽度，用于定位三角形
        const rightTitleWidth = rightTitleText.node().getBBox().width;
        // 修正右侧三角形的X位置，使其位于右标题的中心下方
        const rightTriangleX = (width - margin.right) - (rightTitleWidth / 2);
    
        // 标题下的黑线
        svg.append("line")
            .attr("x1", margin.left)
            .attr("y1", lineY)
            .attr("x2", width - margin.right) // 线条延伸到右边距
            .attr("y2", lineY)
            .attr("stroke", "#000000") // 黑色
            .attr("stroke-width", 1.5); // 线条粗细
        
        // 左侧标题下的三角形 - 放在左标题的正中心下面
        const leftTriangleX = leftTitleX + leftTitleWidth / 2;
        svg.append("polygon")
            .attr("points", `${leftTriangleX - 6},${lineY + 1} ${leftTriangleX + 6},${lineY + 1} ${leftTriangleX},${lineY + 8}`) // 定义三角形顶点
            .attr("fill", "#000000"); // 黑色填充
        
        // 右侧标题下的三角形 - 放在右标题的正中心下面
        svg.append("polygon")
            .attr("points", `${rightTriangleX - 6},${lineY + 1} ${rightTriangleX + 6},${lineY + 1} ${rightTriangleX},${lineY + 8}`) // 定义三角形顶点
            .attr("fill", "#000000"); // 黑色填充
        
        // ---------- 10. 创建主图表组 ----------
        
        const g = svg.append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`); // 应用边距
        
        // ---------- 11. 获取条形图颜色的辅助函数 ----------
        
        // 获取条形图颜色
        const getBarColor = (dimension) => {
            // 优先使用字段特定颜色
            if (colors.field && colors.field[dimension]) {
                return colors.field[dimension];
            }
            // 否则使用主要的备用颜色
            return colors.other?.primary || "#83C341"; // 使用可选链和默认值增加健壮性
        };
        
        // ---------- 12. 绘制所有圆形（先绘制，以免被条形覆盖，确保阴影等效果完整）----------
        // 注意：这里只绘制圆形本身，标签将在后面的循环中添加
        sortedDimensions.forEach((dimension, index) => {
            const dataPoint = chartData.find(d => d[dimensionField] === dimension);
            if (!dataPoint || isNaN(+dataPoint[valueField2])) return; // 跳过无效数据
            
            const barHeight = yScale.bandwidth();
            const y = yScale(dimension);
            const centerY = y + barHeight / 2;
            
            // 绘制圆形（应用视觉效果）
            const circleRadius = radiusScale(+dataPoint[valueField2]);
            // 圆心X坐标位于右侧列的中心
            const circleX = barChartWidth + circleChartWidth / 2; 
            
            g.append("circle")
                .attr("cx", circleX)
                .attr("cy", centerY)
                .attr("r", Math.max(0, circleRadius)) // 确保半径不为负
                .attr("fill", getBarColor(dimension))
                .style("stroke", variables.has_stroke ? d3.rgb(getBarColor(dimension)).darker(0.5) : "none") // 添加描边（如果启用）
                .style("stroke-width", variables.has_stroke ? 1.5 : 0) // 描边宽度
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none"); // 应用阴影（如果启用）
        });
        
        // ---------- 13. 为每个维度绘制条形、标签和连接线 ----------
        
        sortedDimensions.forEach((dimension, index) => {
            try {
                const dataPoint = chartData.find(d => d[dimensionField] === dimension);
                
                if (!dataPoint) {
                    console.warn(`No data found for dimension: ${dimension}`); // 使用warn而不是error
                    return; // 继续下一个循环
                }
                
                // 检查数据值是否有效
                if (isNaN(+dataPoint[valueField1]) || isNaN(+dataPoint[valueField2])) {
                    console.warn(`Invalid data values for ${dimension}: ${dataPoint[valueField1]}, ${dataPoint[valueField2]}`);
                    return; // 继续下一个循环
                }
                
                const barHeight = yScale.bandwidth();
                const y = yScale(dimension);
                if (typeof y !== 'number') { // 检查yScale返回是否有效
                    console.warn(`Invalid y position for dimension: ${dimension}`);
                    return; // 继续下一个循环
                }
                
                const centerY = y + barHeight / 2; // 条形和圆形的中心Y坐标
                const barWidthValue = xScale(+dataPoint[valueField1]); // 计算条形宽度
                const labelPadding = 5; // 标签与元素之间的通用内边距/外边距
                const labelPaddingInside = 10; // 标签在条形内部时的左右内边距
                const countryText = dimension.toUpperCase(); // 国家名称（大写）
                const value1Text = `${dataPoint[valueField1]}${valueUnit1}`; // 第一个数值的文本
                const value2Text = `${dataPoint[valueField2]}${valueUnit2}`; // 第二个数值的文本
                
                // 1. 绘制条形（应用视觉效果）
                const barFill = variables.has_gradient 
                    ? `url(#bar-gradient-${dimension.replace(/\s+/g, '-')})` // 使用渐变填充（如果启用）
                    : getBarColor(dimension); // 使用纯色填充
                    
                g.append("rect")
                    .attr("x", 0)
                    .attr("y", y)
                    .attr("width", Math.max(0, barWidthValue)) // 确保宽度不为负
                    .attr("height", barHeight)
                    .attr("fill", barFill)
                    .attr("rx", variables.has_rounded_corners ? barHeight * 0.2 : 0) // 圆角（如果启用）
                    .attr("ry", variables.has_rounded_corners ? barHeight * 0.2 : 0) // 圆角（如果启用）
                    .style("stroke", variables.has_stroke ? d3.rgb(getBarColor(dimension)).darker(0.5) : "none") // 描边（如果启用）
                    .style("stroke-width", variables.has_stroke ? 1.5 : 0) // 描边宽度
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none"); // 阴影（如果启用）
    
                // --- 标签定位逻辑 ---
    
                // a. 测量标签宽度 (使用临时元素获取精确宽度)
                const getTextWidth = (text, style) => {
                    const tempText = g.append("text")
                        .attr("x", -1000).attr("y", -1000) // 移出可视区域
                        .style("font-family", style.font_family)
                        .style("font-size", style.font_size)
                        .style("font-weight", style.font_weight)
                        .text(text);
                    const width = tempText.node().getBBox().width;
                    tempText.remove();
                    return width;
                };
    
                const countryLabelWidth = getTextWidth(countryText, typography.label);
                const value1LabelWidth = getTextWidth(value1Text, typography.label);
                const value2LabelWidth = getTextWidth(value2Text, typography.label);
    
                // b. 决定国家标签的位置和颜色
                let countryLabelX, countryLabelColor, countryLabelAnchor;
                let countryLabelIsInside = false; // 标记国家标签是否在条形内部
                // 条件：条形宽度是否足够容纳国家标签（包括左右内边距）
                if (barWidthValue >= labelPaddingInside + countryLabelWidth + labelPaddingInside) {
                    // 足够宽，放在内部左侧
                    countryLabelX = labelPaddingInside;
                    countryLabelColor = "#FFFFFF"; // 内部用白色
                    countryLabelAnchor = "start";
                    countryLabelIsInside = true;
                } else {
                    // 不够宽，放在外部右侧
                    countryLabelX = barWidthValue + labelPadding;
                    countryLabelColor = colors.text_color; // 外部用默认颜色
                    countryLabelAnchor = "start";
                    countryLabelIsInside = false;
                }
    
                // c. 决定数值1标签的位置和颜色
                let value1LabelX, value1LabelColor, value1LabelAnchor;
                let value1LabelIsOutside = false; // 标记数值1标签是否在条形外部
                let value1LabelEndPos = 0; // 记录数值1标签的右侧结束位置
    
                if (countryLabelIsInside) {
                    // --- 国家标签在内部 ---
                    // 检查条形内部剩余空间是否足够容纳数值1标签（在国家标签右侧，有间距）
                    if (barWidthValue >= countryLabelX + countryLabelWidth + labelPadding + value1LabelWidth + labelPaddingInside) {
                        // 空间足够，放在内部右侧
                        value1LabelX = barWidthValue - labelPaddingInside;
                        value1LabelColor = "#FFFFFF"; // 内部用白色
                        value1LabelAnchor = "end";
                        value1LabelIsOutside = false;
                        value1LabelEndPos = barWidthValue; // 结束位置就是条形末端
                    } else {
                        // 内部空间不足，放在外部
                        value1LabelX = barWidthValue + labelPadding;
                        value1LabelColor = colors.text_color; // 外部用默认颜色
                        value1LabelAnchor = "start";
                        value1LabelIsOutside = true;
                        value1LabelEndPos = value1LabelX + value1LabelWidth; // 结束位置是标签右侧
                    }
                } else {
                    // --- 国家标签在外部 ---
                    // 数值1标签必须放在国家标签的右侧
                    value1LabelX = countryLabelX + countryLabelWidth + labelPadding + 15; // 国家标签右侧+间距
                    value1LabelColor = colors.text_color; // 外部用默认颜色
                    value1LabelAnchor = "start";
                    value1LabelIsOutside = true;
                    value1LabelEndPos = value1LabelX + value1LabelWidth; // 结束位置是标签右侧
                }
    
                // --- 绘制标签 ---
    
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
    
                // 3. 绘制条形数值标签 (Value 1)
                g.append("text")
                    .attr("x", value1LabelX)
                    .attr("y", centerY)
                    .attr("dy", "0.35em") // 垂直居中微调
                    .attr("text-anchor", value1LabelAnchor)
                    .style("font-family", typography.label.font_family)
                    .style("font-size", typography.label.font_size)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", value1LabelColor)
                    .text(value1Text);
                    
                // 4. 添加圆形数值标签 (Value 2)
                const circleRadius = radiusScale(+dataPoint[valueField2]);
                // 圆心X坐标在右侧列的中心
                const circleX = barChartWidth + circleChartWidth / 2; 
                let value2LabelX, value2LabelY, value2LabelColor, value2LabelAnchor, value2LabelDy;
    
                // 判断文本宽度是否小于圆的直径 (留一些边距)
                if (circleRadius * 2 > value2LabelWidth + labelPadding * 2) {
                     // 空间足够，文本放在圆内，白色
                    value2LabelX = circleX;
                    value2LabelY = centerY;
                    value2LabelColor = "#FFFFFF";
                    value2LabelAnchor = "middle";
                    value2LabelDy = "0.35em"; // 垂直居中
                } else {
                     // 空间不足，文本放在圆上方，与圆相同颜色
                    value2LabelX = circleX;
                    value2LabelY = centerY - circleRadius - labelPadding; // 圆顶上方加一点间距
                    value2LabelColor = getBarColor(dimension); // 使用圆的颜色
                    value2LabelAnchor = "middle";
                    value2LabelDy = "0em"; // 基线对齐
                     // 如果标签放在上方后低于图表顶部标题线，则尝试放在下方
                    if (value2LabelY - (parseFloat(typography.label.font_size)/2) < -(margin.top - lineY -10) ){ // -margin.top是g元素的顶部，lineY是线的位置
                         value2LabelY = centerY + circleRadius + labelPadding + parseFloat(typography.label.font_size); // 圆底下方加间距和字体高度
                         value2LabelDy = "0.8em"; // 调整基线使文本看起来在圆下方
                    }
                }
    
                g.append("text")
                    .attr("x", value2LabelX)
                    .attr("y", value2LabelY)
                    .attr("dy", value2LabelDy)
                    .attr("text-anchor", value2LabelAnchor)
                    .style("font-family", typography.label.font_family)
                    .style("font-size", typography.label.font_size)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", value2LabelColor)
                    .text(value2Text);
                
                // 5. 添加连接线 - 从条形图（或标签）到圆形
                const lineColor = getBarColor(dimension); // 线条颜色与条形/圆形一致
                
                // 确定线的起始X坐标：应在数值1标签的右侧结束位置之后
                const lineStartX = value1LabelEndPos + labelPadding;
    
                // 计算线的终点X坐标（圆的左边缘）
                const lineEndX = circleX - circleRadius;
                
                // 只有当起始点在结束点左侧时才绘制线
                if (lineStartX < lineEndX - 1) { // 减1避免绘制极短的线
                    // 绘制连接线
                    g.append("line")
                        .attr("x1", lineStartX)
                        .attr("y1", centerY)
                        .attr("x2", lineEndX)
                        .attr("y2", centerY)
                        .attr("stroke", lineColor)
                        .attr("stroke-width", 0.8); // 线条粗细
                }
                
            } catch (error) {
                console.error(`Error rendering chart element for ${dimension}:`, error);
                // 继续处理下一个元素，而不是停止整个图表渲染
            }
        });
        
        // 返回SVG节点
        return svg.node();
    }