/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Small Multiples of Waffle Charts",
    "chart_name": "small_multiples_waffle_plain_chart_01",
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

// 多网格单位方块图实现 - 每个类别各自有一个网格
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
    
    // 计算标题所需高度
    const titleHeight = 70; // 每个图表类别标题高度
    
    // 初始设置图表边距
    const margin = { 
        top: 30,
        right: 30,
        bottom: 40,
        left: 30
    };
    
    // 计算实际绘图区域大小
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 3. 为每个类别创建网格参数 ----------
    // 网格配置
    const gridSize = 10; // 每个网格10x10的格子
    const totalCells = gridSize * gridSize; // 总格子数
    
    // 用于颜色分配
    const categoryColors = {};
    
    // 如果没有为每个类别指定颜色，使用默认颜色方案
    const defaultColors = colors.available_colors || [
        "#4269d0", "#efb118", "#ff725c", "#6cc5b0", "#ff8ab7", "#97bbf5"
    ];
    
    // 计算数据总和
    const totalValue = chartData.reduce((sum, d) => sum + (+d[yField] || 0), 0);
    
    // 计算每个类别的比例
    const categoryInfo = chartData.map((d, i) => {
        const category = d[xField];
        const value = +d[yField];
        const percentage = totalValue > 0 ? (value / totalValue) * 100 : 0;
        const filledCells = Math.round((percentage / 100) * totalCells);
        
        // 确保每个类别有颜色
        if (colors.field && colors.field[category]) {
            categoryColors[category] = colors.field[category];
        } else {
            categoryColors[category] = defaultColors[i % defaultColors.length];
        }
        
        return {
            category: category,
            value: value,
            percentage: percentage,
            filledCells: filledCells,
            color: categoryColors[category]
        };
    });
    
    // 计算每个网格的尺寸
    const numCategories = categoryInfo.length;
    const gridMargin = 40; // 网格之间的间距
    
    // 根据类别数量确定网格布局（每行最多3个）
    const gridsPerRow = Math.min(3, numCategories);
    const numRows = Math.ceil(numCategories / gridsPerRow);
    
    const gridWidth = (innerWidth - (gridsPerRow - 1) * gridMargin) / gridsPerRow;
    const gridHeight = gridWidth; // 保持正方形
    
    // 计算单元格大小
    const cellSize = (gridWidth / gridSize) * 0.9; // 留一些间距
    const cellMargin = (gridWidth / gridSize) * 0.1;
    
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
    
    // ---------- 6. 创建主图表区域 ----------
    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 7. 为每个类别创建网格 ----------
    categoryInfo.forEach((info, index) => {
        // 计算网格位置
        const rowIndex = Math.floor(index / gridsPerRow);
        const colIndex = index % gridsPerRow;
        
        const gridX = colIndex * (gridWidth + gridMargin);
        const gridY = rowIndex * (gridHeight + titleHeight + gridMargin);
        
        // 创建网格容器
        const grid = chart.append("g")
            .attr("class", "category-grid")
            .attr("transform", `translate(${gridX}, ${gridY})`);
        
        // 添加标题
        grid.append("text")
            .attr("x", gridWidth / 2)
            .attr("y", -titleHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", "bold")
            .style("fill", colors.text_color)
            .text(`${info.category} ${info.percentage.toFixed(0)}%`);
        
        // 添加值
        grid.append("text")
            .attr("x", gridWidth / 2)
            .attr("y", -titleHeight / 4)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("fill", colors.text_color)
            .text(`${formatValue(info.value)} ${yUnit}`);
        
        // 创建背景单元格
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const cellIndex = row * gridSize + col;
                
                grid.append("rect")
                    .attr("x", col * (cellSize + cellMargin))
                    .attr("y", row * (cellSize + cellMargin))
                    .attr("width", cellSize)
                    .attr("height", cellSize)
                    .attr("fill", "#cccccc") // 改为灰色背景
                    .attr("opacity", 0.5)
                    .attr("rx", variables.has_rounded_corners ? Math.max(1, cellSize * 0.1) : 0)
                    .attr("ry", variables.has_rounded_corners ? Math.max(1, cellSize * 0.1) : 0);
            }
        }
        
        // 创建填充单元格
        for (let cellIndex = 0; cellIndex < info.filledCells; cellIndex++) {
            // 从底部开始填充
            const row = Math.floor(cellIndex / gridSize);
            const col = cellIndex % gridSize;
            
            grid.append("rect")
                .attr("x", col * (cellSize + cellMargin))
                .attr("y", row * (cellSize + cellMargin))
                .attr("width", cellSize)
                .attr("height", cellSize)
                .attr("fill", info.color)
                .attr("rx", variables.has_rounded_corners ? Math.max(1, cellSize * 0.1) : 0)
                .attr("ry", variables.has_rounded_corners ? Math.max(1, cellSize * 0.1) : 0)
                .attr("stroke", "none") // 移除描边
                .attr("stroke-width", 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
        }
    });
    
    // 返回SVG节点
    return svg.node();
}