/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Semi Donut Chart",
    "chart_name": "multiple_semi_donut_chart_01",
    "is_composite": false,
    "required_fields": ["x","y","group"],
    "required_fields_type": [["categorical"], ["numerical"],["categorical"]],
    "required_fields_range": [[2, 10], [0, "inf"],[2, 10]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "stroke"],
    "min_height": 400,
    "min_width": 600,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 多饼图实现 - 使用D3.js
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
        other: { primary: "#FF4136" },
        field: {}
    };  // 颜色设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_shadow = 1
    
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
    
    // 添加颜色亮度检测函数，用于决定文本颜色
    const getContrastColor = (hexColor) => {
        // 默认颜色处理
        if (!hexColor || hexColor === "#ffffff" || hexColor === "white") {
            return "#333333"; // 默认使用深色文本
        }
        
        // 移除十六进制颜色中的#号
        hexColor = hexColor.replace("#", "");
        
        // 如果是缩写形式如#ABC，转换为#AABBCC
        if (hexColor.length === 3) {
            hexColor = hexColor.split("").map(char => char + char).join("");
        }
        
        // 转换为RGB
        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);
        
        // 计算亮度 (0-255范围)
        // 使用感知亮度公式: (0.299*R + 0.587*G + 0.114*B)
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        
        // 亮度阈值，高于这个值使用黑色文本，否则使用白色
        return brightness > 130 ? "#333333" : "#ffffff";
    };
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸 - 确保有足够的显示空间
    const width = variables.width || 850; // 调整默认宽度，适中值
    const height = variables.height || 550; // 调整默认高度，适中值
    
    // 设置边距 - 调整边距以留出更多空间给饼图
    const margin = {
        top: 75,     // 适中顶部边距
        right: 70,   // 适中右侧边距
        bottom: 75,  // 适中底部边距
        left: 70     // 适中左侧边距
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列获取字段名
    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;
    
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
    
    // 按维度(x)分组数据
    const groupedByDimension = d3.group(chartData, d => d[dimensionField]);
    
    // 转换为数组并按每组总和降序排序
    const dimensionGroups = Array.from(groupedByDimension, ([key, values]) => {
        const total = d3.sum(values, d => d[valueField]);
        return { dimension: key, values, total };
    }).sort((a, b) => a.dimension.localeCompare(b.dimension));
    
    // ---------- 5. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 添加defs用于视觉效果
    const defs = svg.append("defs");
    
    // 添加阴影滤镜（如果启用）
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("x", "-50%")
            .attr("y", "-50%")
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
    
    // ---------- 5.1 创建图例 ----------
    
    // 提取所有唯一的组值
    const allGroups = Array.from(new Set(chartData.map(d => d[groupField])));
    
    // 基本图例项参数
    const legendRectSize = 15; // 图例颜色块大小
    const legendRectTextPadding = 5; // 图例颜色块与文本间距
    const legendItemPadding = 15; // 图例项之间的横向间距
    const legendRowSpacing = 12; // 减少图例行间距，保持紧凑但不重叠
    const legendTopMargin = 10; // 图例顶部边距
    const legendBottomMargin = 10; // 减少图例底部边距
    
    // 创建临时SVG用于测量文本宽度和高度
    const legendTempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 测量每个组名的宽度和一个样本文本的高度
    const legendTextWidths = {};
    let legendTextHeight = 0;
    
    allGroups.forEach(group => {
        const textElement = legendTempSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .text(group);
        
        const bbox = textElement.node().getBBox();
        legendTextWidths[group] = bbox.width;
        legendTextHeight = Math.max(legendTextHeight, bbox.height);
        textElement.remove();
    });
    
    // 计算单行图例的实际高度（使用文本实际高度和矩形高度的最大值）
    const singleRowHeight = Math.max(legendTextHeight, legendRectSize);
    
    // 计算每个图例项的总宽度
    const legendItemWidths = allGroups.map(group => 
        legendRectSize + legendRectTextPadding + legendTextWidths[group] + legendItemPadding
    );
    
    // 确定最大可用宽度（留出左右边距）
    const legendMaxWidth = width - 40;
    
    // 计算每行放置的图例项
    const legendRows = [];
    let currentRow = [];
    let currentRowWidth = 0;
    
    legendItemWidths.forEach((itemWidth, index) => {
        // 如果是第一个项或者加上这个项不超过最大宽度
        if (currentRow.length === 0 || currentRowWidth + itemWidth <= legendMaxWidth) {
            currentRow.push(index);
            currentRowWidth += itemWidth;
        } else {
            // 否则开始新行
            legendRows.push(currentRow);
            currentRow = [index];
            currentRowWidth = itemWidth;
        }
    });
    
    // 添加最后一行
    if (currentRow.length > 0) {
        legendRows.push(currentRow);
    }
    
    // 计算图例的实际总高度（包括行间距和上下边距）
    const actualLegendHeight = legendRows.length * singleRowHeight + 
                               (legendRows.length - 1) * legendRowSpacing + 
                               legendTopMargin + legendBottomMargin;
    
    // 设置图例上边距位置
    const legendY = legendTopMargin;
    
    // 根据图例高度设置图表上边距，确保留出足够空间
    margin.top = actualLegendHeight + 20; // 图例高度加上额外间距
    
    // 创建图例组
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${margin.left}, ${legendY})`); // 从左侧开始

    // 绘制分行后的图例
    legendRows.forEach((rowIndices, rowIndex) => {
        const rowY = rowIndex * (singleRowHeight + legendRowSpacing);
        
        // 计算本行所有图例项的总宽度
        const rowTotalWidth = rowIndices.reduce((sum, itemIndex) => 
            sum + legendItemWidths[itemIndex], 0);
        
        // 水平居中每一行
        const rowStartX = (width - margin.left - margin.right - rowTotalWidth) / 2;
        
        let currentX = rowStartX;
        
        // 创建当前行的图例项
        rowIndices.forEach(itemIndex => {
            const group = allGroups[itemIndex];
            const itemWidth = legendItemWidths[itemIndex];
            
            const legendItem = legend.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${rowY})`);
            
            // 添加颜色方块
            legendItem.append("circle")
                .attr("cx", legendRectSize / 2)
                .attr("cy", legendRectSize / 2)
                .attr("r", legendRectSize / 2)
                .attr("fill", colors.field[group] || colors.other.primary);
            
            // 添加文本标签
            legendItem.append("text")
                .attr("x", legendRectSize + legendRectTextPadding)
                .attr("y", legendRectSize - 3) // 垂直居中对齐
                .style("font-family", typography.annotation.font_family)
                .style("font-size", typography.annotation.font_size)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#333333")
                .style("dominant-baseline", "middle") // 提高垂直对齐精度
                .text(group);
            
            // 更新X位置
            currentX += itemWidth;
        });
    });
    
    // 删除临时SVG
    legendTempSvg.remove();
    
    // ---------- 6. 计算网格布局 ----------
    
    // 根据分组后的数据点数量确定网格布局（行数和列数）
    const numCharts = dimensionGroups.length;
    let rows, cols;
    
    // 确定行数和列数
    if (numCharts <= 3) {
        // 1-3个数据点：单行布局
        rows = 1;
        cols = numCharts;
    } else if (numCharts === 4) {
        // 4个数据点：2×2布局
        rows = 2;
        cols = 2;
    } else if (numCharts <= 6) {
        // 5-6个数据点：2行布局
        rows = 2;
        cols = 3;
    } else if (numCharts <= 9) {
        // 7-9个数据点：3×3布局
        rows = 3;
        cols = 3;
    } else {
        // 10+个数据点：使用适中行数和列数
        rows = Math.min(4, Math.ceil(Math.sqrt(numCharts)));
        cols = Math.ceil(numCharts / rows);
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
    
    // 初步计算每个图表单元的宽度和高度 - 调整高度以适应半圆形状
    const cellWidth = chartAreaWidth / cols;
    const cellHeight = (chartAreaHeight / rows) * 1.2 - 40; // 减少40px的行间距
    
    // 创建临时SVG用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 获取原始字体大小（去掉单位）
    const dimensionFontSize = parseFloat(typography.label.font_size);
    const valueFontSize = parseFloat(typography.annotation.font_size);
    
    // 测量最长维度标签
    let maxDimensionWidth = 0;
    
    dimensionGroups.forEach(group => {
        // 测量维度标签
        const dimensionText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(group.dimension);
        
        const dimensionWidth = dimensionText.node().getBBox().width;
        maxDimensionWidth = Math.max(maxDimensionWidth, dimensionWidth);
        dimensionText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 计算图表间距为单元格宽度的一定比例
    const spacingFactorHorizontal = 0.15; // 增加水平间距，避免重叠
    const spacingFactorVertical = 0.15; // 增加垂直间距，避免重叠
    
    // 计算实际的图表尺寸和间距
    const chartSpacingHorizontal = cellWidth * spacingFactorHorizontal;
    const chartSpacingVertical = cellHeight * spacingFactorVertical;
    
    // 计算实际可用的单元格内部尺寸（减去间距）
    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    // 计算图表半径 - 调整饼图尺寸，考虑半圆形状需要更大的空间
    const radius = Math.min(innerCellWidth / 2, innerCellHeight / 1.8) * 1.2; // 增加半径以适应半圆形状
    
    // ---------- 7. 检查文本是否会溢出并调整字体大小 ----------
    
    // 计算每个图表的最大可用宽度
    const maxChartAreaWidth = radius * 2.4;
    
    // 计算维度标签的缩放因子
    let dimensionScaleFactor = 1;
    if (maxDimensionWidth > maxChartAreaWidth) {
        dimensionScaleFactor = maxChartAreaWidth / (maxDimensionWidth + 3);
    }
    
    // 计算调整后的字体大小
    const adjustedDimensionFontSize = `${Math.floor(dimensionFontSize * dimensionScaleFactor)}px`;
    
    // ---------- 8. 创建饼图 ----------
    
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
            
            const group = dimensionGroups[dataIndex];
            
            // 计算当前图表的中心位置 - 调整Y位置以适应半圆形状
            const chartCenterX = margin.left + rowOffset + (col + 0.5) * cellWidth;
            const chartCenterY = margin.top + (row + 0.6) * cellHeight; // 将中心点向下移动
            
            // 创建单个图表组
            const chartGroup = svg.append("g")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);
            
            // ---------- 9. 创建饼图 ----------
            
            // 准备饼图数据
            const pieData = group.values;
            
            // 创建饼图生成器
            const pie = d3.pie()
                .value(d => d[valueField])
                .sort(null) // 不排序，保持数据原始顺序
                .padAngle(0.01) // 添加扇区间隔
                .startAngle(-Math.PI / 2) // 开始角度为-90度
                .endAngle(Math.PI / 2); // 结束角度为90度
            
            // 创建弧形生成器
            const arc = d3.arc()
                .innerRadius(radius * 0.6) // 设置内半径，使其成为甜甜圈图
                .outerRadius(radius * 0.9); // 调整饼图外半径比例为适中值
                
            // 创建用于标签的弧形生成器（比饼图大一点）
            const labelArc = d3.arc()
                .innerRadius(radius * 0.95) // 调整为适中值
                .outerRadius(radius * 1.1); // 调整为适中值
            
            // 生成饼图数据
            const arcs = pie(pieData);
            
            // 生成弧形路径
            const paths = chartGroup.selectAll("path")
                .data(arcs)
                .enter()
                .append("path")
                .attr("d", arc)
                .attr("fill", d => colors.field[d.data[groupField]] || colors.other.primary)
                .style("stroke", "none")
                .style("stroke-width", 1.5)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
                
            // 为每个甜甜圈添加中心图片
            const imageSize = radius * 0.5; // 图片大小不超过内圆
            const minImageSize = 32; // 增大最小图片尺寸为32
            const actualImageSize = Math.max(minImageSize, imageSize);
            
            // 创建剪切路径用于图片
            const clipId = `clip-center-${dataIndex}`;
            const defs = chartGroup.append("defs");
            const clipPath = defs.append("clipPath")
                .attr("id", clipId);
            
            // 添加圆形剪切路径
            clipPath.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", actualImageSize / 2);
            
            // 添加中心图片
            if (jsonData.images && jsonData.images.field && jsonData.images.field[group.dimension]) {
                chartGroup.append("image")
                    .attr("xlink:href", jsonData.images.field[group.dimension])
                    .attr("clip-path", `url(#${clipId})`)
                    .attr("x", -actualImageSize / 2)
                    .attr("y", -actualImageSize / 2)
                    .attr("width", actualImageSize)
                    .attr("height", actualImageSize);
            }
            
            // 添加数值标签
            const labels = chartGroup.selectAll(".pie-label")
                .data(arcs)
                .enter()
                .append("text")
                .attr("class", "pie-label")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", typography.annotation.font_size)
                .style("font-weight", typography.annotation.font_weight)
                .style("pointer-events", "none"); // 防止标签拦截鼠标事件
                
            // 为每个扇区添加标签，根据扇区角度大小决定标签位置
            labels.each(function(d) {
                const self = d3.select(this);
                
                // 设置文本颜色根据背景色自动调整
                self.style("fill", colors.text_color || "#333333");
                
                // 计算扇区所占角度（弧度）
                const arcAngle = d.endAngle - d.startAngle;
                
                // 数值文本 - 使用格式化函数
                const valueText = valueUnit ? 
                    `${formatValue(d.data[valueField])} ${valueUnit}` : 
                    formatValue(d.data[valueField]);
                
                // 计算扇区在整个半圆中所占比例
                const percent = arcAngle / Math.PI;
                
                // 增大标签字体大小，但保持适中
                self.style("font-size", `${parseFloat(typography.annotation.font_size) * 1.1}px`);
                
                // 如果扇区足够大（占比超过10%，适中值），将标签放在扇区内部
                if (percent > 0.1) {
                    const centroid = arc.centroid(d);
                    const angle = (d.startAngle + d.endAngle) / 2;
                    
                    // 调整标签位置，考虑半圆形状
                    const x = centroid[0];
                    const y = centroid[1];
                    
                    self.attr("x", x)
                        .attr("y", y)
                        .attr("text-anchor", "middle")
                        .style("dominant-baseline", "middle")
                        .text(valueText);
                } else {
                    const centroid = arc.centroid(d);
                    const angle = (d.startAngle + d.endAngle) / 2;
                    
                    // 调整外部标签位置，考虑半圆形状
                    const labelRadius = radius * 1.1;
                    const x = labelRadius * Math.cos(angle - Math.PI / 2);
                    const y = labelRadius * Math.sin(angle - Math.PI / 2);
                    
                    // 根据角度确定文本对齐方式
                    const textAnchor = angle > 0 ? "start" : "end";
                    
                    // 特别小的扇区使用更小的字体
                    if (percent < 0.05) {
                        self.style("font-size", `${parseFloat(typography.annotation.font_size) * 0.95}px`);
                    }
                    
                    self.attr("x", x)
                        .attr("y", y)
                        .attr("text-anchor", textAnchor)
                        .style("dominant-baseline", "middle")
                        .text(valueText);
                }
            });
            
            // ---------- 10. 添加标签 ----------
            
            // 添加维度标签（上方）- 调整位置
            chartGroup.append("text")
                .attr("x", 0)
                .attr("y", -radius * 0.9 - 10) // 标题向上移动10px
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", adjustedDimensionFontSize)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || getContrastColor("#ffffff"))
                .text(group.dimension);
            
            // 移除总计值标签
            
            // 增加数据索引
            dataIndex++;
        }
    }
    
    // 返回SVG节点
    return svg.node();
}