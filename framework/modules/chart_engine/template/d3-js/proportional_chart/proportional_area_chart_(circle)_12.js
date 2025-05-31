/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Circle)",
    "chart_name": "proportional_area_chart_circle_12",
    "is_composite": false,
    "required_fields": ["x","y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "stroke"],
    "min_height": 300,
    "min_width": 300,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 时钟饼图实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                       // 完整的JSON数据对象
    const chartData = jsonData.data.data;             // 实际数据点数组  
    const variables = jsonData.variables || {};  // 图表配置
    const typography = jsonData.typography || {  // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333",
        other: { primary: "#FF4136" }
    };  // 颜色设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_shadow = variables.has_shadow || false;
    variables.has_stroke = variables.has_stroke || false;
    
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
    }
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 600;
    const height = variables.height || 350;
    
    // 设置边距
    const margin = {
        top: 100,     // 顶部留出标题和维度名称空间
        right: 30,
        bottom: 80,  // 底部留出数值标签空间
        left: 30
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列获取字段名
    const dimensionField = dataColumns.find(col => col.role === "x")?.name ;
    const valueField = dataColumns.find(col => col.role === "y")?.name ;
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = "";
    
    if (dataColumns.find(col => col.role === "x")?.unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 过滤掉值为0的数据点，并按值降序排序
    const sortedData = [...chartData]
        .filter(d => d[valueField] > 0) // 过滤掉值为0的数据点
        .sort((a, b) => b[valueField] - a[valueField]);
    
    // 计算最大值，用于设置比例
    const maxValue = sortedData.length > 0 ? sortedData[0][valueField] : 0; // 确保有数据时才取值
    
    // ---------- 5. 创建SVG容器 ----------
    
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
    
    // 添加阴影滤镜（如果启用）
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("width", "200%")
            .attr("height", "200%");
        
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 2);
        
        filter.append("feOffset")
            .attr("dx", 1)
            .attr("dy", 1)
            .attr("result", "offsetblur");
        
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // ---------- 6. 计算网格布局 ----------
    
    // 根据数据点数量确定网格布局（行数和列数）
    const numCharts = sortedData.length;
    let rows, cols;
    
    // 确定行数和列数
    if (numCharts <= 3) {
        // 2-3个数据点：单行布局
        rows = 1;
        cols = numCharts;
    } else if (numCharts === 4) {
        // 4个数据点：2×2布局
        rows = 2;
        cols = 2;
    } else if (numCharts <= 8) {
        // 5-8个数据点：2行布局
        rows = 2;
        cols = Math.ceil(numCharts / 2);
    } else if (numCharts <= 12) {
        // 9-12个数据点：3行布局
        rows = 3;
        cols = Math.ceil(numCharts / 3);
    } else {
        // 13-20个数据点：4行布局
        rows = 4;
        cols = Math.ceil(numCharts / 4);
    }
    
    // 计算每行的数据点数量（最后一行可能不满）
    const itemsPerRow = [];
    for (let i = 0; i < rows; i++) {
        if (i < rows - 1) {
            // 非最后一行，按照每行最大数量填充
            itemsPerRow.push(cols);
        } else {
            // 最后一行，可能不满
            const remaining = numCharts - cols * (rows - 1);
            itemsPerRow.push(remaining);
        }
    }
    
    // 计算每个图表的可用空间
    const chartAreaWidth = width - margin.left - margin.right;
    const chartAreaHeight = height - margin.top - margin.bottom;
    
    // 初步计算每个图表单元的宽度和高度
    const cellWidth = chartAreaWidth / cols;
    const cellHeight = chartAreaHeight / rows;
    
    // 创建临时SVG用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 获取原始字体大小（去掉单位）
    const dimensionFontSize = parseFloat(typography.label.font_size);
    const valueFontSize = parseFloat(typography.annotation.font_size);
    
    // 测量最长维度标签和值标签
    let maxDimensionWidth = 0;
    let maxValueWidth = 0;
    
    sortedData.forEach(d => {
        // 测量维度标签
        const dimensionText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(d[dimensionField]);
        
        const dimensionWidth = dimensionText.node().getBBox().width;
        maxDimensionWidth = Math.max(maxDimensionWidth, dimensionWidth);
        dimensionText.remove();
        
        // 测量值标签
        const valueText = tempSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .text(valueUnit ? `${d[valueField]} ${valueUnit}` : d[valueField]);
        
        const valueWidth = valueText.node().getBBox().width;
        maxValueWidth = Math.max(maxValueWidth, valueWidth);
        valueText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 计算图表间距为单元格宽度的一定比例（不是硬编码值）
    const spacingFactorHorizontal = 0.15; // 水平间距为单元格宽度的20%
    const spacingFactorVertical = 0.15; // 垂直间距为单元格高度的20%
    
    // 计算实际的图表尺寸和间距
    const chartSpacingHorizontal = cellWidth * spacingFactorHorizontal;
    const chartSpacingVertical = cellHeight * spacingFactorVertical;
    
    // 计算实际可用的单元格内部尺寸（减去间距）
    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    // 计算图表半径（保持高宽比稍微高一点）
    const radius = Math.min(innerCellWidth / 2, innerCellHeight / 2.2) - 10;
    
    // ---------- 7. 检查文本是否会溢出并调整字体大小 ----------
    
    // 计算每个图表的最大可用宽度
    const maxChartAreaWidth = radius * 2.8;
    
    // 为维度标签和值标签分别计算独立的缩放因子
    let dimensionScaleFactor = 1;
    let valueScaleFactor = 1;
    
    // 计算维度标签的缩放因子
    if (maxDimensionWidth > maxChartAreaWidth) {
        dimensionScaleFactor = maxChartAreaWidth / (maxDimensionWidth + 3);
    }
    
    // 计算值标签的缩放因子
    if (maxValueWidth > maxChartAreaWidth) {
        valueScaleFactor = maxChartAreaWidth / (maxValueWidth + 3);
    }
    
    
    
    // 计算调整后的字体大小
    const adjustedDimensionFontSize = `${Math.floor(dimensionFontSize * dimensionScaleFactor)}px`;
    const adjustedValueFontSize = `${Math.floor(valueFontSize * valueScaleFactor)}px`;
    
    // ---------- 8. 为每个数据点创建时钟饼图 ----------
    
    // 跟踪当前处理的数据点索引
    let dataIndex = 0;
    
    // 逐行创建图表
    for (let row = 0; row < rows; row++) {
        const itemsInThisRow = itemsPerRow[row];
        
        // 计算当前行的水平偏移（用于居中不满一行的情况）
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;
        
        // 逐列创建图表
        for (let col = 0; col < itemsInThisRow; col++) {
            if (dataIndex >= numCharts) break;
            
            const d = sortedData[dataIndex];
            
            // 计算当前图表的中心位置
            const chartCenterX = margin.left + rowOffset + (col + 0.5) * cellWidth;
            const chartCenterY = margin.top + (row + 0.5) * cellHeight;
            
            // 创建单个图表组
            const chartGroup = svg.append("g")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);
            
            // ---------- 10. 绘制圆形 (原为扇形) / 定义裁剪路径 ----------
            
            // 计算圆形的半径，使其面积与数值成正比
            const proportionalRadius = maxValue > 0 ? radius * Math.sqrt(d[valueField] / maxValue) : 0;
            
            // 确保最小半径不小于5，除非值为0
            let displayRadius = proportionalRadius;
            if (proportionalRadius > 0 && proportionalRadius < 5) {
                displayRadius = 5;
            }

            /* 移除原有的背景圆形绘制
            chartGroup.append("circle")
                .attr("r", proportionalRadius)
                .attr("fill", colors.other.primary || "#FF4136")
                .attr("stroke", variables.has_stroke ? (colors.text_color || "#333333") : "none")
                .attr("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
                .style("opacity", 0.85);
            */
            
            // ---------- 添加维度图标到圆圈内部并应用圆形裁剪 ----------
            if (jsonData.images && jsonData.images.field && jsonData.images.field[d[dimensionField]] && displayRadius > 1) { // 图标仅在半径大于1时显示 (使用 displayRadius)
                const iconUrl = jsonData.images.field[d[dimensionField]];
                const iconDisplaySize = displayRadius * 2; // 图标显示尺寸等于裁剪圆的直径
                
                // 为每个图标创建唯一的 clipPath ID
                const clipPathId = `clip-${dataIndex}-${d[dimensionField].replace(/\W/g, '')}`;

                defs.append("clipPath")
                    .attr("id", clipPathId)
                    .append("circle")
                    .attr("r", displayRadius) // 使用 displayRadius
                    .attr("cx", 0) // 相对于 g 元素中心
                    .attr("cy", 0); // 相对于 g 元素中心

                chartGroup.append("image")
                    .attr("x", -displayRadius) // 图片左上角x, 使其在(0,0)为中心 (使用 displayRadius)
                    .attr("y", -displayRadius) // 图片左上角y (使用 displayRadius)
                    .attr("width", iconDisplaySize)
                    .attr("height", iconDisplaySize)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", iconUrl)
                    .attr("clip-path", `url(#${clipPathId})`)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none"); // 阴影应用到image上
            }

            // ---------- 11. 添加标签 ----------
            
            // 添加维度标签（上方）- 使用调整后的字体大小
            chartGroup.append("text")
                .attr("x", 0)
                .attr("y", -radius - 10) // 放在圆上方 (使用单元格最大半径 radius)
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(d[dimensionField]);
            
            // 添加数值标签（统一放在圆下方）- 使用调整后的字体大小
            const valueTextContent = valueUnit ? `${formatValue(d[valueField])} ${valueUnit}` : formatValue(d[valueField]);
            chartGroup.append("text")
                .attr("x", 0)
                .attr("y", displayRadius + 3) // 圆形下方边缘 +3px 间距 (使用 displayRadius)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", adjustedValueFontSize) 
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#333333") // 外部文本使用默认颜色
                .text(valueTextContent);
            
            // 增加数据索引
            dataIndex++;
        }
    }
    
    // 返回SVG节点
    return svg.node();
}