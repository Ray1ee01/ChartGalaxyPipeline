/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Gauge Chart",
    "chart_name": "multiple_gauge_chart_03",
    "is_composite": false,
    "required_fields": ["x","y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 10], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "stroke"],
    "min_height": 300,
    "min_width": 300,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
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
    
    // 按数值降序排列数据
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    
    // 计算最大值，用于设置扇形尺度（确保最大值占圆的约80%）
    const maxValue = sortedData[0][valueField];
    // 计算比例尺，使最大值对应大约290度（约80%的圆）
    const maxAngle = 290 * (Math.PI / 180); // 转换为弧度
    
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
    const maxChartAreaWidth = radius * 2.4;
    
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
            
            // ---------- 9. 绘制时钟表盘 ----------
            
            // 绘制外圈圆
            chartGroup.append("circle")
                .attr("r", radius)
                .attr("fill", "none")
                .attr("stroke", colors.text_color || "#333333")
                .attr("stroke-width", 1.5)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            
            // 添加四个方向的刻度线
            const tickLength = radius * 0.07; // 刻度线长度为半径的7%
            
            // 上方刻度（12点位置）
            chartGroup.append("line")
                .attr("x1", 0)
                .attr("y1", -radius)
                .attr("x2", 0)
                .attr("y2", -(radius - tickLength))
                .attr("stroke", colors.text_color || "#333333")
                .attr("stroke-width", 1.5);
            
            // 右方刻度（3点位置）
            chartGroup.append("line")
                .attr("x1", radius)
                .attr("y1", 0)
                .attr("x2", radius - tickLength)
                .attr("y2", 0)
                .attr("stroke", colors.text_color || "#333333")
                .attr("stroke-width", 1.5);
            
            // 下方刻度（6点位置）
            chartGroup.append("line")
                .attr("x1", 0)
                .attr("y1", radius)
                .attr("x2", 0)
                .attr("y2", radius - tickLength)
                .attr("stroke", colors.text_color || "#333333")
                .attr("stroke-width", 1.5);
            
            // 左方刻度（9点位置）
            chartGroup.append("line")
                .attr("x1", -radius)
                .attr("y1", 0)
                .attr("x2", -(radius - tickLength))
                .attr("y2", 0)
                .attr("stroke", colors.text_color || "#333333")
                .attr("stroke-width", 1.5);
            
            // ---------- 10. 绘制扇形 ----------
            
            // 计算扇形的角度（作为最大值的百分比）
            const percent = d[valueField] / maxValue;
            const angle = percent * maxAngle;
            
            // 创建扇形路径
            const arc = d3.arc()
                .innerRadius(0)
                .outerRadius(radius*0.9)
                .startAngle(0 ) // 从12点钟方向开始
                .endAngle(0  - angle); // 逆时针扫过对应的角度
            
            // 绘制扇形
            chartGroup.append("path")
                .attr("d", arc)
                .attr("fill", colors.other.primary || "#FF4136")
                .attr("stroke", variables.has_stroke ? (colors.text_color || "#333333") : "none")
                .attr("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
                .style("opacity", 0.85);
            
            // ---------- 11. 添加标签 ----------
            
            // 添加维度标签（上方）- 使用调整后的字体大小
            chartGroup.append("text")
                .attr("x", 0)
                .attr("y", -radius - 10) // 放在圆上方
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(d[dimensionField]);
            
            // 添加数值标签（下方）- 使用调整后的字体大小
            chartGroup.append("text")
                .attr("x", 0)
                .attr("y", radius + 15) // 放在圆下方
                .attr("text-anchor", "middle")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", adjustedValueFontSize)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(valueUnit ? `${d[valueField]} ${valueUnit}` : d[valueField]);
            
            // 增加数据索引
            dataIndex++;
        }
    }
    
    // 返回SVG节点
    return svg.node();
}