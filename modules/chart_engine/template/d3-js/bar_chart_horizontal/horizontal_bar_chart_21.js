/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart With Circle",
    "chart_name": "horizontal_bar_chart_21",
    "is_composite": true,
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [
        ["categorical"],
        ["numerical"],
        ["numerical"]
    ],
    "required_fields_range": [[2, 20], [0, "inf"], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary","secondary"],
    "supported_effects": ["radius_corner", "gradient", "stroke"],
    "min_height": 400,
    "min_width": 400,
    "background": "none",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 水平条形图实现 - 使用D3.js  horizontal_bar_chart_composite_03
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
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置
    const images = jsonData.images || { field: {}, other: {} };   // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_stroke = variables.has_stroke || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距 - 初始值，稍后会根据标签长度调整
    const margin = {
        top: 90,      // 顶部留出标题空间
        right: 40,    // 右侧足够显示数值
        bottom: 40,   // 底部边距
        left: 40      // 左侧空间，稍后会调整
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "dimension";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "value";
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name || "total";

    // 获取字段单位
    let valueUnit = "";
    let valueUnit2 = "";
    valueUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : 
                     dataColumns.find(col => col.role === "y")?.unit;
    valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : 
                     dataColumns.find(col => col.role === "y2")?.unit;
    // 添加维度单位定义
    const dimensionUnit = dataColumns.find(col => col.role === "x")?.unit === "none" ? "" : 
                     dataColumns.find(col => col.role === "x")?.unit;

    // 获取y2字段的显示名称用于标题
    const valueField2Name = dataColumns.find(col => col.role === "y2")?.display_name || valueField2;
    // 获取y1字段的显示名称用于标题
    const valueFieldName = dataColumns.find(col => col.role === "y")?.display_name || valueField;

    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值并按数值降序排列数据
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    
    // 按数值降序排序数据
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
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
    
    // ---------- 5. 计算标签宽度 ----------
    
    // 创建临时SVG来测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 序号宽度
    const rankingWidth = 25;
    
    // 图标尺寸
    let flagWidth = 40;
    let flagHeight = 40;
    const flagPadding = 5; // 图标与标签之间的间距
    
    // 计算最大维度标签宽度（不包括图标和序号）
    let maxLabelWidth = 0;
    dimensions.forEach(dimension => {
        // 格式化维度名称（附加单位，如果有）
        const formattedDimension = dimensionUnit ? 
            `${dimension}${dimensionUnit}` : 
            `${dimension}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
        
        const textWidth = tempText.node().getBBox().width;
        maxLabelWidth = Math.max(maxLabelWidth, textWidth);
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
    
    // 计算最大第二数值标签宽度
    let maxValueWidth2 = 0;
    chartData.forEach(d => {
        const formattedValue2 = valueUnit2 ? 
            `${formatValue(d[valueField2])}${valueUnit2}` : 
            `${formatValue(d[valueField2])}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .text(formattedValue2);
        
        const textWidth = tempText.node().getBBox().width;
        
        maxValueWidth2 = Math.max(maxValueWidth2, textWidth);
        
        tempText.remove();
    });
    
    // 计算y2字段标题的宽度
    const tempY2Title = tempSvg.append("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .text(valueField2Name);
    
    const y2TitleWidth = tempY2Title.node().getBBox().width;
    tempY2Title.remove();
    
    // 使用最大的第二值宽度和标题宽度
    maxValueWidth2 = Math.max(maxValueWidth2, y2TitleWidth);
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 计算左边距，仅考虑标签宽度和一些间距
    margin.left = Math.max(margin.left, maxLabelWidth + flagPadding * 2);
    
    // 设置右边距，考虑第二个数值标签 + 固定距离 20px
    margin.right = Math.max(margin.right, maxValueWidth2 + 10);
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)  // 使用固定宽度而不是百分比
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    // 如果有背景颜色设置，添加背景
    if (colors.background_color) {
        svg.style("background-color","#8BC34A" );
    }
    // 添加defs用于视觉效果
    const defs = svg.append("defs");
    
    // 获取主题色
    const primaryColor = colors.other && colors.other.primary ? colors.other.primary : "#1d6b64";
    const secondaryColor = colors.other && colors.other.secondary ? colors.other.secondary : "#ff7f0e"; // 获取次要颜色，设置默认值
    
    // ---------- 7. 创建比例尺 ----------
    
    // 设置固定的条形间距
    const barPadding = 0.2; 
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（用于数值）
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField]) * 1.05]) // 添加5%边距
        .range([0, innerWidth]);
    
    // 为右侧正方形创建面积比例尺
    const barH = yScale.bandwidth(); // 获取单个bar的高度
    const maxY2 = d3.max(chartData, d => +d[valueField2]);
    const minSideLength = 10; // 最小边长
    const maxSideLength = barH * 2; // 最大边长
    const squareSideScale = d3.scaleSqrt() // 使用sqrt比例尺映射面积到边长
        .domain([0, maxY2]) // Y2值范围
        .range([minSideLength, maxSideLength]) // 映射到边长范围
        .clamp(true); // 防止超出范围
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 10. 绘制条形和标签 ----------
    
    // 获取条形颜色的辅助函数
    const getBarColor = (dimension) => {
        // 获取维度对应的颜色
        return colors.field && colors.field[dimension] ? colors.field[dimension] : primaryColor;
    };

    // 计算图标区域的尺寸和位置
    const barHeight = yScale.bandwidth();
    const iconWidth = barHeight * 1.1; // 与下方图标尺寸保持一致
    const iconX = -iconWidth - flagPadding;
    const iconContainerWidth = iconWidth + 2*flagPadding; // 图标宽度加上一些额外的空间，用于覆盖条形图的一部分
    const iconContainerHeight = innerHeight;
    
    // 添加y1字段标题（在第一行上方，左对齐）
    g.append("text")
        .attr("x", 0) // 左对齐到条形图起点
        .attr("y", -10) // 与y2标题垂直对齐
        .attr("text-anchor", "start") // 左对齐
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(valueFieldName);
    
    // 添加y2字段标题（在第一行上方）
    g.append("text")
        .attr("x", innerWidth + margin.right - 10) // 右对齐，距离图表右边缘10px
        .attr("y", - 10) 
        .attr("text-anchor", "end") // 右对齐
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(valueField2Name);
    
    // 为每个维度绘制条形和标签
    sortedDimensions.forEach((dimension, index) => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const barHeight = yScale.bandwidth();
            const barWidth = xScale(+dataPoint[valueField]);
            
            // 绘制条形
            g.append("rect")
                .attr("x", 0)
                .attr("y", yScale(dimension))
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", primaryColor) // 强制使用主颜色填充
                .attr("rx", barHeight / 2) // 强制使用圆角半径 barHeight / 2
                .attr("ry", barHeight / 2) // 强制使用圆角半径 barHeight / 2
                .on("mouseover", function() {
                    d3.select(this).attr("opacity", 0.8);
                })
                .on("mouseout", function() {
                    d3.select(this).attr("opacity", 1);
                });
                
            // 标签位置：条形左侧，左对齐
            const labelX = -flagPadding; // 距离条形左侧一点间距
            
            // 添加维度标签
            g.append("text")
                .attr("x", labelX)
                .attr("y", yScale(dimension) + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end") // 修正：应该还是end对齐到labelX
                .style("font-family", typography.label.font_family)
                .style("font-size", `${Math.max(barHeight * 0.4, 8)}px`)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(dimensionUnit ? 
                    `${dimension}${dimensionUnit}` : 
                    `${dimension}`);
            
            // 计算动态字体大小（条形高度的60%）
            const dynamicFontSize = `${Math.max(barHeight * 0.4, 8)}px`;
            // 格式化数值
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            // 临时计算文本宽度
            const tempTextSvg = d3.select(containerSelector)
                .append("svg")
                .attr("width", 0)
                .attr("height", 0)
                .style("visibility", "hidden");
            
            const tempValueText = tempTextSvg.append("text")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", dynamicFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .text(formattedValue);
            
            const valueTextWidth = tempValueText.node().getBBox().width;
            tempTextSvg.remove();
            
            // -- 计算 Y2 和正方形属性 -- （移到此处）
            const y2Value = +dataPoint[valueField2];
            const sideLength = squareSideScale(y2Value);
            const squareX = innerWidth + margin.right / 2 - sideLength / 2; // 水平居中于右侧边距
            const squareY = yScale(dimension) + barHeight / 2 - sideLength / 2; // 垂直居中于条形
            const formattedValue2 = valueUnit2 ? `${formatValue(y2Value)}${valueUnit2}` : `${formatValue(y2Value)}`;

            // -- 添加 Y 数值标签 (考虑重叠) --
            const textFitsInside = barWidth > valueTextWidth + 10; // 内部判断加宽边距
            const outsideX = barWidth + 5;
            const wouldOverlap = !textFitsInside && (outsideX + valueTextWidth > squareX);
            
            let labelXPos, labelAnchor, labelFill;
            if (textFitsInside) {
                labelXPos = barWidth / 2;
                labelAnchor = "middle";
                labelFill = "#ffffff";
            } else if (wouldOverlap) {
                labelXPos = barWidth / 2; // 强制放内部
                labelAnchor = "middle";
                labelFill = "#ffffff"; // 内部用白色
            } else {
                labelXPos = outsideX; // 放外部
                labelAnchor = "start";
                labelFill = colors.text_color;
            }
            
            g.append("text")
                .attr("x", labelXPos)
                .attr("y", yScale(dimension) + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", labelAnchor)
                .style("font-family", typography.annotation.font_family)
                .style("font-size", dynamicFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", labelFill)
                .text(formattedValue);
                
            // -- 绘制右侧正方形 -- 
            g.append("rect")
                .attr("x", squareX)
                .attr("y", squareY)
                .attr("width", sideLength)
                .attr("height", sideLength)
                .attr("fill", secondaryColor)
                .attr("opacity", 0.6);

            // -- 添加 Y2 数值标签 (居中于正方形) --
            g.append("text")
                .attr("x", squareX + sideLength / 2) // 水平居中
                .attr("y", squareY + sideLength / 2) // 垂直居中
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle") // 居中对齐
                .style("font-family", typography.annotation.font_family)
                .style("font-size", dynamicFontSize) // Use same dynamic font size
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color)
                .text(formattedValue2);

        }
    });
    
    // 返回SVG节点
    return svg.node();
}