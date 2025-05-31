/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Waffle Chart",
    "chart_name": "waffle_plain_chart_02",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "stroke"],
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

// 单位方块图实现 - 使用小方块表示数据值垂直方向
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    // 提取数据和配置
    const jsonData = data;                          
    const chartData = jsonData.data.data || [];          
    const variables = jsonData.variables || {};     
    const typography = jsonData.typography || {     
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333", 
        field: {},
        other: { 
            primary: "#4682B4" // 默认主色调
        } 
    };
    
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
    
    // 提取字段名称
    let xField, yField;
    
    // 安全提取字段名称
    const dataColumns = jsonData.data.columns || [];
    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    
    if (xColumn) xField = xColumn.name;
    if (yColumn) yField = yColumn.name;
    
    // 如果仍未找到，使用默认字段名
    if (!xField && chartData.length > 0) xField = Object.keys(chartData[0])[0];
    if (!yField && chartData.length > 0) yField = Object.keys(chartData[0])[1];
    yUnit = yColumn?.unit === "none" ? "" : (yColumn?.unit || "");
    
    // ---------- 2. 配置图表参数 ----------
    // 设置图表尺寸和边距
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 计算图例所需高度
    const legendSquareSize = 15; // 图例方块大小基准值
    const legendRowHeight = legendSquareSize * 3; // 每行图例的高度
    
    // 创建临时SVG用于精确测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
        
    // 计算每个图例项所需的最小宽度 - 精确测量
    const legendItemMinWidths = chartData.map(d => {
        const category = d[xField];
        const value = d[yField];
        
        // 测量类别文本宽度
        const categoryText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(category);
        const categoryWidth = categoryText.node().getBBox().width;
        categoryText.remove();
        
        // 测量值文本宽度
        const valueText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", "bold")
            .text(`${formatValue(value)} ${yUnit}`);
        const valueWidth = valueText.node().getBBox().width;
        valueText.remove();
        
        // 基本宽度 = 方块宽度 + 方块与文本间距 + 最大文本宽度 + 小安全边距
        return legendSquareSize + 6 + Math.max(categoryWidth, valueWidth) + 5;
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 计算图例所需行数
    const availableLegendWidth = width - 60; // 左右各30px的边距
    
    // 图例参数 - 减小间距使图例更紧凑
    const legendSpacing = 10; // 使用固定值减小图例项之间的水平间距
    
    // 计算每行能容纳多少个图例项
    let currentWidth = 0;
    let itemsInCurrentRow = 0;
    let rowCount = 1;
    
    for (let i = 0; i < legendItemMinWidths.length; i++) {
        if (currentWidth + legendItemMinWidths[i] <= availableLegendWidth) {
            currentWidth += legendItemMinWidths[i] + legendSpacing;
            itemsInCurrentRow++;
        } else {
            // 如果已经有项目在当前行，开始新行
            if (itemsInCurrentRow > 0) {
                rowCount++;
                currentWidth = legendItemMinWidths[i] + legendSpacing;
                itemsInCurrentRow = 1;
            } else {
                // 极端情况：单个图例项太宽，无法放入一行
                currentWidth = legendItemMinWidths[i] + legendSpacing;
                itemsInCurrentRow = 1;
                if (i > 0) rowCount++;
            }
        }
    }
    
    const legendHeight = rowCount * legendRowHeight;
    
    // 初始设置图表边距，后续会在绘制方块图后调整
    const margin = { 
        top: 100, // 临时值，后续会根据图例高度调整
        right: 30,
        bottom: 40,
        left: 30
    };
    
    // 计算实际绘图区域大小
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 3. 计算单位方块数和大小 ----------
    // 计算数据总和
    const totalValue = chartData.reduce((sum, d) => sum + (+d[yField] || 0), 0);
    
    // 确定单位方块的总数（目标是500-1000个）
    let totalSquares = totalValue;
    let valuePerSquare = 1;
    
    // 调整每个方块代表的值，确保方块总数在500-1000之间
    if (totalValue > 1000) {
        // 如果总数太大，增加每个方块的值
        valuePerSquare = Math.ceil(totalValue / 800); // 目标800个方块
        totalSquares = Math.ceil(totalValue / valuePerSquare);
    } else if (totalValue < 300) {
        // 如果总数太小，减少每个方块的值（允许代表小于1的数值）
        valuePerSquare = totalValue / 300; // 目标300个方块
        totalSquares = 300; // 固定方块数量
    }
    
    // 根据画布比例确定最适合的行列数，使方块更好地填充空间
    // 计算画布的宽高比
    const canvasRatio = innerWidth / innerHeight;
    
    // 计算最接近画布比例的行列组合
    // 这里采用开平方，然后根据画布比例调整的方式
    const sqrtSquares = Math.sqrt(totalSquares);
    let numCols = Math.round(sqrtSquares * Math.sqrt(canvasRatio));
    let numRows = Math.round(sqrtSquares / Math.sqrt(canvasRatio));
    
    // 确保行列乘积不少于总方块数
    while (numRows * numCols < totalSquares) {
        if (numRows / numCols < canvasRatio) {
            numRows++;
        } else {
            numCols++;
        }
    }
    
    // 确保至少有一行一列
    numRows = Math.max(1, numRows);
    numCols = Math.max(1, numCols);
    
    // 计算方块大小，确保完全填充可用空间
    // 首先计算可用于每个方块的空间
    const maxSquareWidth = innerWidth / numCols;
    const maxSquareHeight = innerHeight / numRows;
    
    // 使用较小的尺寸确保方块是正方形
    const maxSquareSize = Math.min(maxSquareWidth, maxSquareHeight);
    
    // 为了留出一些间距，使方块略小于可用空间
    const squareSize = maxSquareSize * 0.85; // 稍微减小方块以增加间距
    const squareSpacing = maxSquareSize * 0.15; // 增加间距使布局更美观
    
    // 重新计算基于优化后的方块大小实际使用的空间
    const actualChartWidth = numCols * maxSquareSize;
    const actualChartHeight = numRows * maxSquareSize;
    
    // 计算方块图的偏移量以居中显示
    const offsetX = (innerWidth - actualChartWidth) / 2;
    const offsetY = (innerHeight - actualChartHeight) / 2;
    
    // ---------- 4. 创建SVG容器 ----------
    // 清除容器
    d3.select(containerSelector).html("");
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // ---------- 5. 创建视觉效果 ----------
    const defs = svg.append("defs");
    
    // 如果需要，创建阴影滤镜
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("width", "200%")
            .attr("height", "200%");
        
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 1);
        
        filter.append("feOffset")
            .attr("dx", 1)
            .attr("dy", 1)
            .attr("result", "offsetblur");
        
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // ---------- 6. 创建图表区域 ----------
    // 创建一个容器，后续再添加实际内容
    const containerGroup = svg.append("g");
    
    // ---------- 7. 计算各类别的数据 ----------
    // 计算每个类别所需的方块数和起始位置
    const categorySquares = [];
    let squareCount = 0;
    
    // 用于颜色分配
    const categoryColors = {};
    
    // 如果没有为每个类别指定颜色，使用默认颜色方案
    const defaultColors = colors.available_colors || [
        "#4269d0", "#efb118", "#ff725c", "#6cc5b0", "#ff8ab7", "#97bbf5"
    ];
    
    chartData.forEach((d, i) => {
        const category = d[xField];
        const value = +d[yField];
        const numSquares = Math.round(value / valuePerSquare);
        
        // 确保每个类别有颜色
        if (colors.field && colors.field[category]) {
            categoryColors[category] = colors.field[category];
        } else {
            categoryColors[category] = defaultColors[i % defaultColors.length];
        }
        
        categorySquares.push({
            category: category,
            value: value,
            squares: numSquares,
            startSquare: squareCount,
            color: categoryColors[category]
        });
        
        squareCount += numSquares;
    });
    
    // ---------- 8. 创建图例，精确定位在方块图上方 ----------
    // 首先创建图例，计算其实际高度
    const legend = svg.append("g")
        .attr("class", "legend");
    
    // 初始化当前行和位置变量
    let currentRow = 0;
    let currentX = 0;
    
    // 为每个类别创建图例项
    chartData.forEach((d, i) => {
        const category = d[xField];
        const value = d[yField];
        const itemWidth = legendItemMinWidths[i];
        
        // 检查当前行是否还有足够空间
        if (currentX + itemWidth > availableLegendWidth && i > 0) {
            currentRow++;
            currentX = 0;
        }
        
        const legendItem = legend.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, ${currentRow * legendRowHeight})`);
        
        // 图例颜色方块
        legendItem.append("rect")
            .attr("width", legendSquareSize)
            .attr("height", legendSquareSize)
            .attr("fill", categoryColors[category])
            .attr("rx", variables.has_rounded_corners ? Math.max(1, legendSquareSize * 0.15) : 0)
            .attr("ry", variables.has_rounded_corners ? Math.max(1, legendSquareSize * 0.15) : 0);
        
        // 图例类别名称 - 减少间距
        legendItem.append("text")
            .attr("x", legendSquareSize + 6) // 减少方块到文本的距离
            .attr("y", legendSquareSize / 2)
            .attr("dy", "0.32em")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(category);
        
        // 图例值文本 - 调整位置使整体更紧凑
        legendItem.append("text")
            .attr("x", legendSquareSize + 6) // 保持与类别名称相同的缩进
            .attr("y", legendSquareSize * 1.7) // 稍微减少类别名称和值之间的距离
            .attr("dy", "0.32em")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", "bold")
            .style("fill", colors.text_color)
            .text(`${formatValue(value)} ${yUnit}`);
        
        // 更新当前X位置，为下一个图例项腾出空间
        currentX += itemWidth + legendSpacing;
    });
    
    // 获取图例的实际高度
    const actualLegendHeight = (currentRow + 1) * legendRowHeight;
    
    // 根据实际图例高度，调整图表布局
    // 图例在上方，方块图在下方，两者之间留出10px的间距
    const legendVerticalSpace = 10; // 图例和方块图之间的间距
    
    // 计算方块图的顶部位置，考虑图例高度和间距
    const chartTopPosition = actualLegendHeight + legendVerticalSpace;
    
    // 计算方块图需要的总高度
    const chartTotalHeight = actualChartHeight + 2 * offsetY;
    
    // 使方块图居中显示（垂直方向）
    const verticalCenterOffset = (height - chartTopPosition - chartTotalHeight) / 2;
    const finalChartTopPosition = chartTopPosition + Math.max(0, verticalCenterOffset);
    
    // 移动图例到适当位置
    legend.attr("transform", `translate(${margin.left}, 20)`);
    
    // ---------- 9. 绘制所有单位方块 ----------
    // 创建方块图区域，位于图例下方
    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left + offsetX}, ${finalChartTopPosition})`);
    
    // 为每个类别创建方块组
    // 创建一个二维数组表示方块的位置占用情况
    const occupiedPositions = Array(numRows).fill().map(() => Array(numCols).fill(false));
    let squareIndex = 0;
    
    // 为每个类别创建方块
    categorySquares.forEach(cat => {
        // 创建该类别的所有方块
        for (let i = 0; i < cat.squares; i++) {
            if (squareIndex >= numRows * numCols) break; // 防止越界
            
            // 先从上到下，再从左到右计数
            const col = Math.floor(squareIndex / numRows);
            const row = squareIndex % numRows;
            
            occupiedPositions[row][col] = true;
            
            chart.append("rect")
                .attr("data-category", cat.category) // 添加数据属性，方便交互
                .attr("x", col * maxSquareSize + squareSpacing / 2)
                .attr("y", row * maxSquareSize + squareSpacing / 2)
                .attr("width", squareSize)
                .attr("height", squareSize)
                .attr("fill", cat.color)
                .attr("rx", variables.has_rounded_corners ? Math.max(1, squareSize * 0.1) : 0) // 圆角大小与方块大小成比例
                .attr("ry", variables.has_rounded_corners ? Math.max(1, squareSize * 0.1) : 0)
                .attr("stroke", variables.has_stroke ? "#555" : "none")
                .attr("stroke-width", variables.has_stroke ? Math.max(0.5, squareSize * 0.05) : 0) // 描边宽度与方块大小成比例
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            
            squareIndex++;
        }
    });
    
    // 返回SVG节点
    return svg.node();
}