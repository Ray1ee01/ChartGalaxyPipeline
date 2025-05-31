/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Radar Line Chart",
    "chart_name": "multiple_radar_line_chart_03",
    "is_composite": false,
    "required_fields": ["group", "x", "y"],
    "required_fields_type": [["categorical"], ["categorical"], ["numerical"]],
    "required_fields_range": [[2, 7], [3, 12], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "stroke"],
    "min_height": 400,
    "min_width": 400,
    "background": "dark",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                       // 完整的JSON数据对象
    const chartData = jsonData.data.data;        // 实际数据点数组  
    const variables = jsonData.variables || {};  // 图表配置
    const typography = jsonData.typography || {  // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors_dark || { 
        text_color: "#ffffff",
        other: { primary: "#1f77b4" }
    };  // 颜色设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_shadow = variables.has_shadow || false;
    variables.has_stroke = variables.has_stroke || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距
    const margin = {
        top: 100,     // 顶部留出标题空间
        right: 50,
        bottom: 80,   // 底部留出标签空间
        left: 50
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列获取字段名
    const groupField = dataColumns.find(col => col.role === "group")?.name || dataColumns[0].name;
    const categoryField = dataColumns.find(col => col.role === "x")?.name || dataColumns[1].name;
    const valueField = dataColumns.find(col => col.role === "y")?.name || dataColumns[2].name;
    
    // 获取字段单位（如果存在）
    let valueUnit = "";
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取所有唯一的组值
    let groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 如果组数超过6个,只保留前6个
    if (groups.length > 6) {
        groups = groups.slice(0, 6);
    }
    
    // 将数据按组进行分组
    const groupedData = {};
    groups.forEach(group => {
        groupedData[group] = chartData.filter(d => d[groupField] === group);
    });
    
    // 计算每个组的最大值（用于后续分组比较）
    const groupMaxValues = {};
    groups.forEach(group => {
        groupMaxValues[group] = d3.max(groupedData[group], d => d[valueField]);
    });
    
    // 按组的最大值降序排列组（可选）
    const sortedGroups = [...groups].sort((a, b) => groupMaxValues[b] - groupMaxValues[a]);
    
    // 找出所有数据中的最大值，用于统一比例尺
    const allValues = chartData.map(d => d[valueField]);
    const minValue = Math.min(0, d3.min(allValues));
    const maxValue = d3.max(allValues);
    
    // 获取所有组中共有的类别
    let allCategories = [];
    groups.forEach(group => {
        const categoriesInGroup = groupedData[group].map(d => d[categoryField]);
        allCategories = [...allCategories, ...categoriesInGroup];
    });
    // 去重得到唯一类别
    allCategories = [...new Set(allCategories)];
    
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
    
    // 根据组数量确定网格布局（行数和列数）
    const numCharts = groups.length;
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
    } else {
        // 9-10个数据点：3行布局
        rows = 3;
        cols = Math.ceil(numCharts / 3);
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
    const groupFontSize = parseFloat(typography.label.font_size);
    
    // 测量最长组标签
    let maxGroupWidth = 0;
    
    groups.forEach(group => {
        const groupText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(group);
        
        const groupWidth = groupText.node().getBBox().width;
        maxGroupWidth = Math.max(maxGroupWidth, groupWidth);
        groupText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 计算图表间距为单元格宽度的一定比例
    const spacingFactorHorizontal = 0.15; // 水平间距为单元格宽度的15%
    const spacingFactorVertical = 0.15; // 垂直间距为单元格高度的15%
    
    // 计算实际的图表间距
    const chartSpacingHorizontal = cellWidth * spacingFactorHorizontal;
    const chartSpacingVertical = cellHeight * spacingFactorVertical;
    
    // 计算实际可用的单元格内部尺寸（减去间距）
    const innerCellWidth = cellWidth * (1 - spacingFactorHorizontal);
    const innerCellHeight = cellHeight * (1 - spacingFactorVertical);
    
    // 计算每个雷达图的半径
    const radius = Math.min(innerCellWidth, innerCellHeight) / 2.2;
    
    // ---------- 7. 检查文本是否会溢出并调整字体大小 ----------
    
    // 计算每个图表的最大可用宽度
    const maxChartAreaWidth = radius * 2.4;
    
    // 计算组标签的缩放因子
    let groupScaleFactor = 1;
    if (maxGroupWidth > maxChartAreaWidth) {
        groupScaleFactor = maxChartAreaWidth / (maxGroupWidth + 3);
    }
    
    // 计算调整后的字体大小
    const adjustedGroupFontSize = `${Math.floor(groupFontSize * groupScaleFactor)}px`;
    
    // ---------- 8. 为每个组创建雷达图 ----------
    
    // 创建角度比例尺（对所有雷达图共用）
    const angleScale = d3.scalePoint()
        .domain(allCategories)
        .range([0, 2 * Math.PI - (2 * Math.PI / allCategories.length)]);
    
    // 创建统一的半径比例尺
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue * 1.2])
        .range([0, radius])
        .nice();
    
    // 定义获取文本宽度的辅助函数
    function getTextWidth(text, fontSize) {
        // 简单估算，实际项目中可能需要更精确的测量
        return text.length * fontSize * 0.6;
    }
    
    // 定义雷达折线生成器
    const createLineGenerator = (groupData) => {
        return () => {
            const points = allCategories.map(cat => {
                const point = groupData.find(item => item[categoryField] === cat);
                if (point) {
                    const angle = angleScale(cat) - Math.PI/2;
                    const distance = radiusScale(point[valueField]);
                    return [
                        distance * Math.cos(angle),
                        distance * Math.sin(angle)
                    ];
                }
                // 如果该组没有这个类别的数据，默认为中心点
                return [0, 0]; 
            });
            
            // 使用折线连接点并闭合
            return d3.line()(points) + "Z"; 
        };
    };
    
    // 跟踪当前处理的组索引
    let groupIndex = 0;
    
    // 逐行创建雷达图
    for (let row = 0; row < rows; row++) {
        const itemsInThisRow = itemsPerRow[row];
        
        // 计算当前行的水平偏移（用于居中不满一行的情况）
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;
        
        // 逐列创建图表
        for (let col = 0; col < itemsInThisRow; col++) {
            if (groupIndex >= numCharts) break;
            
            const group = sortedGroups[groupIndex];
            const groupData = groupedData[group];
            
            // 计算当前图表的中心位置
            const chartCenterX = margin.left + rowOffset + (col + 0.5) * cellWidth;
            const chartCenterY = margin.top + (row + 0.5) * cellHeight;
            
            // 创建单个图表组
            const chartGroup = svg.append("g")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);
            
            // ---------- 9. 绘制雷达图背景 ----------
            
            // 绘制同心圆
            const ticks = radiusScale.ticks(5);
            chartGroup.selectAll(".circle-axis")
                .data(ticks)
                .enter()
                .append("circle")
                .attr("class", "circle-axis")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", d => radiusScale(d))
                .attr("fill", "none")
                .attr("stroke", "#bbb")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "4,4")
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            
            // 绘制径向轴线
            chartGroup.selectAll(".axis-line")
                .data(allCategories)
                .enter()
                .append("line")
                .attr("class", "axis-line")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", (d, i) => radius * Math.cos(angleScale(d) - Math.PI/2))
                .attr("y2", (d, i) => radius * Math.sin(angleScale(d) - Math.PI/2))
                .attr("stroke", "#bbb")
                .attr("stroke-width", 1);
            
            // 添加类别标签（较小字体）
            if (row === 0 && col === 0) {
                chartGroup.selectAll(".category-label")
                    .data(allCategories)
                    .enter()
                    .append("text")
                    .attr("class", "category-label")
                    .attr("x", d => (radius + 10) * Math.cos(angleScale(d) - Math.PI/2))
                    .attr("y", d => (radius + 10) * Math.sin(angleScale(d) - Math.PI/2))
                    .attr("text-anchor", d => {
                        const angle = angleScale(d);
                        if (Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1) {
                            return "middle";
                        }
                        return angle > Math.PI ? "end" : "start";
                    })
                    .attr("dominant-baseline", d => {
                        const angle = angleScale(d);
                        if (Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1) {
                            return "middle";
                        }
                        return angle < Math.PI ? "hanging" : "auto";
                    })
                    .attr("fill", "#fff")
                    .attr("font-size", "10px")
                    .attr("font-weight", "normal")
                    .text(d => d);
            }
            
            // ---------- 10. 绘制雷达折线 ----------
            
            // 创建并使用折线生成器
            const lineGenerator = createLineGenerator(groupData);
            
            // 绘制雷达折线图
            chartGroup.append("path")
                .attr("class", "radar-line")
                .attr("d", lineGenerator())
                .attr("fill", colors.other.primary)
                .attr("fill-opacity", 0.2)
                .attr("stroke", colors.other.primary)
                .attr("stroke-width", 4)
                .attr("stroke-linejoin", "miter")
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            
            // ---------- 11. 绘制数据点 ----------
            
            allCategories.forEach((cat, index) => {
                const point = groupData.find(item => item[categoryField] === cat);
                if (point) {
                    const angle = angleScale(cat) - Math.PI/2;
                    const distance = radiusScale(point[valueField]);
                    
                    // 绘制点
                    chartGroup.append("circle")
                        .attr("class", "radar-point")
                        .attr("cx", distance * Math.cos(angle))
                        .attr("cy", distance * Math.sin(angle))
                        .attr("r", 4)
                        .attr("fill", colors.other.primary)
                        .attr("stroke", "#fff")
                        .attr("stroke-width", 2);
                    
                    // 可选：为重要点添加值标签
                    if (point[valueField] >= maxValue * 0.8) {
                        const labelText = point[valueField].toString();
                        const textWidth = getTextWidth(labelText, 10);
                        
                        // 计算标签位置
                        const labelDistance = distance + radius * 0.1; // 比数据点稍远
                        const textX = labelDistance * Math.cos(angle);
                        const textY = labelDistance * Math.sin(angle);
                        
                        // 添加标签背景
                        chartGroup.append("rect")
                            .attr("class", "value-label-bg")
                            .attr("x", textX - textWidth/2 - 4)
                            .attr("y", textY - 8)
                            .attr("width", textWidth + 8)
                            .attr("height", 16)
                            .attr("fill", colors.other.primary)
                            .attr("rx", 3);
                        
                        // 添加标签文本
                        chartGroup.append("text")
                            .attr("class", "value-label")
                            .attr("x", textX)
                            .attr("y", textY)
                            .attr("text-anchor", "middle") 
                            .attr("dominant-baseline", "middle")
                            .attr("font-size", "10px")
                            .attr("fill", "#fff")
                            .text(labelText);
                    }
                }
            });
            
            // ---------- 12. 添加组标题 ----------
            
            // 添加组标签（上方）
            chartGroup.append("text")
                .attr("x", 0)
                .attr("y", -radius - 15)
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", adjustedGroupFontSize)
                .style("font-weight", "bold")
                .style("fill", "#fff")
                .text(group);
            
            // 增加组索引
            groupIndex++;
        }
    }
    
    // 返回SVG节点
    return svg.node();
} 