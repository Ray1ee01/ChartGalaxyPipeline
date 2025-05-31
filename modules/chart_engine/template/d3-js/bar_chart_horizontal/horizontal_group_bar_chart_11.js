/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Group Bar Chart",
    "chart_name": "horizontal_group_bar_chart_11",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["gradient"],
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

// 水平分组条形图实现 - 使用D3.js  //horizontal_grouped_bar_chart_05
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                       // 完整的JSON数据对象
    const chartData = jsonData.data.data;        // 实际数据点数组  
    const variables = jsonData.variables || {};  // 图表配置
    const typography = jsonData.typography || {  // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置
    const images = jsonData.images || { field: {}, other: {} };   // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 数值格式化函数
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
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距
    const margin = {
        top: 40,      // 顶部留出标题空间
        right: 60,   // 右侧足够显示数值和分组标签
        bottom: 30,   // 底部边距
        left: 40     // 左侧空间减少，因为我们不显示维度文本，只显示图标
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    
    const primaryGroupField = dataColumns.find(col => col.role === "group").name;
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; 
    
    if (dataColumns.find(col => col.role === "x").unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值和分组值
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const primaryGroups = [...new Set(chartData.map(d => d[primaryGroupField]))];
    
    // 按主要分组和数值进行分组和排序
    const groupedData = {};
    primaryGroups.forEach(group => {
        // 过滤属于此组的数据
        const groupItems = chartData.filter(d => d[primaryGroupField] === group);
        
        // 按数值降序排序
        const sortedItems = [...groupItems].sort((a, b) => b[valueField] - a[valueField]);
        
        groupedData[group] = sortedItems;
    });
    
    // ---------- 5. 计算标签宽度 ----------
    
    // 创建临时SVG来测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 图标尺寸
    const flagWidth = 20;
    const flagHeight = 15;
    const flagPadding = 5;
    
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
    
    // *** BEGIN ADDITION: Calculate Max Dimension Label Width ***
    let maxDimensionLabelWidth = 0;
    dimensions.forEach(dimension => {
        const formattedDimension = dimensionUnit ? 
            `${dimension}${dimensionUnit}` : 
            `${dimension}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family) 
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
        
        const textWidth = tempText.node().getBBox().width;
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, textWidth);
        tempText.remove();
    });
    // *** END ADDITION ***
    
    // 计算分组注释的最大宽度 - Now used for Legend Items
    let totalLegendWidth = 0;
    const legendItemWidths = [];
    const legendSwatchSize = 15;
    const legendSwatchPadding = 5;
    const legendItemSpacing = 15; // Spacing between legend items

    primaryGroups.forEach(group => {
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family) 
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(group);
        
        const textWidth = tempText.node().getBBox().width;
        const itemWidth = legendSwatchSize + legendSwatchPadding + textWidth + legendItemSpacing;
        legendItemWidths.push(itemWidth);
        totalLegendWidth += itemWidth;
        
        tempText.remove();
    });
    // Adjust total width (remove spacing after last item)
    if (totalLegendWidth > 0) {
        totalLegendWidth -= legendItemSpacing; 
    }
    
    // 删除临时SVG
    tempSvg.remove();

    // --- BEGIN LEGEND MARGIN ADJUSTMENT ---
    const legendHeight = legendSwatchSize + 20; // Swatch height + top/bottom padding
    margin.top += legendHeight;
    // --- END LEGEND MARGIN ADJUSTMENT ---
    
    // ** MODIFY ** 根据图标和最大标签尺寸调整左边距
    const baseLeftPadding = 10; // Base padding to the left of the labels
    margin.left = maxDimensionLabelWidth + flagPadding + flagWidth + flagPadding + baseLeftPadding;
    
    
    // ---------- 6. 计算分组布局 ----------
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    let innerHeight = height - margin.top - margin.bottom; // Recalculate innerHeight
    
    // 计算合适的条形高度，确保所有条形在可用高度内可见
    // 计算总条形数量和组数
    let totalBars = 0;
    primaryGroups.forEach(group => {
        totalBars += groupedData[group].length;
    });
    
    const numGroups = primaryGroups.length;
    
    // 计算组间间距的总高度
    const groupPaddingRatio = 0.15; // 组间距占总高度的比例
    const groupPadding = innerHeight * groupPaddingRatio / (numGroups + 1); // 分配给每个组间距
    const totalGroupPadding = groupPadding * (numGroups - 1);
    
    // 计算可用于条形的总高度
    const availableForBars = innerHeight - totalGroupPadding;
    
    // 计算条形高度和条形间距
    const barPaddingRatio = 0.15; // Use fixed padding ratio, remove spacing effect logic
    
    // 计算理想的条形高度(包括间距)
    const idealBarUnitHeight = availableForBars / totalBars;
    
    // 实际条形高度(不包括间距)
    const barHeight = idealBarUnitHeight * (1 - barPaddingRatio);
    const barPadding = idealBarUnitHeight * barPaddingRatio;
    
    // 计算每组的高度和偏移量
    const groupHeights = {};
    const groupOffsets = {};
    
    let currentOffset = margin.top;
    primaryGroups.forEach(group => {
        const itemCount = groupedData[group].length;
        // 计算当前组的总高度（包括所有条形和条形间距）
        const groupHeight = itemCount * barHeight + (itemCount - 1) * barPadding;
        
        groupHeights[group] = groupHeight;
        groupOffsets[group] = currentOffset;
        
        // 更新下一组的起始位置
        currentOffset += groupHeight + groupPadding;
    });
    
    // ---------- 7. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height) // 使用定义的高度，不进行自动调整
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // --- BEGIN Gradient Definitions ---
    const defs = svg.append("defs");
    
    // Moved getBarColor definition here (Needed for gradient definition)
    const getBarColor = (group) => {
        return colors.field[group] || colors.other.primary || "#3ca951";
    };

    primaryGroups.forEach(group => {
        const groupColor = getBarColor(group);
        const gradientId = `bar-gradient-${group.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;

        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%") // Horizontal gradient
            .attr("y2", "0%");

        // 3-stop gradient: dark -> bright -> dark
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(groupColor).darker(0.3));

        gradient.append("stop")
            .attr("offset", "50%")
            .attr("stop-color", d3.rgb(groupColor).brighter(1.5)); // Adjusted brightness a bit from 2.5

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(groupColor).darker(0.3));
    });
    // --- END Gradient Definitions ---

    // --- BEGIN LEGEND CREATION ---
    // getBarColor is defined above now

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(width - totalLegendWidth) / 2}, ${legendHeight / 2 + 80})`); // Position legend

    let legendOffset = 0;
    primaryGroups.forEach((group, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(${legendOffset}, 0)`);

        // 图例颜色方块
        legendItem.append("rect")
            .attr("width", legendSwatchSize)
            .attr("height", legendSwatchSize)
            .attr("fill", getBarColor(group));

        // 图例文本
        legendItem.append("text")
            .attr("x", legendSwatchSize + legendSwatchPadding)
            .attr("y", legendSwatchSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color || "#333333")
            .text(group);

        // 累加偏移量
        legendOffset += legendItemWidths[i];
    });
    // --- END LEGEND CREATION ---

    // ---------- 8. 创建比例尺 ----------
    
    // X轴比例尺（用于数值）
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField]) * 1.05]) // 添加5%边距
        .range([0, innerWidth]);
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`); // Adjust group transform for new margin
    
    // ---------- 10. 渲染每个分组 ----------
    
    // 遍历每个主要分组，添加背景矩形
    primaryGroups.forEach(group => {
        const groupData = groupedData[group];
        const groupOffset = groupOffsets[group];
        const groupHeight = groupHeights[group];
        const barColor = getBarColor(group);
        
        // 为组中的每个项目绘制条形和标签
        groupData.forEach((dataPoint, index) => {
            // 计算条形的y坐标，考虑到条形间距
            const yPos = groupOffset + index * (barHeight + barPadding);
            const barWidth = xScale(+dataPoint[valueField]);
            
            // Draw the bar using a simple rect element
            g.append("rect") // Revert back to rect
                .attr("x", 0)
                .attr("y", yPos)
                .attr("width", barWidth)
                .attr("height", barHeight)
                // Apply gradient fill
                .attr("fill", `url(#bar-gradient-${group.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')})`) 
                .attr("rx", barHeight/6)
                .attr("ry", barHeight/6)
                .on("mouseover", function() {
                    d3.select(this).attr("opacity", 0.8);
                })
                .on("mouseout", function() {
                    d3.select(this).attr("opacity", 1);
                });
            
            // 提取维度
            const dimension = dataPoint[dimensionField];
            
            // 添加国家/维度图标 (Positioned left of bar)
            const flagX = -flagWidth - flagPadding; // Icon right edge at -flagPadding
            const flagY = yPos + (barHeight - flagHeight) / 2;
            
            if (images.field && images.field[dimension]) {
                g.append("image")
                    .attr("x", flagX)
                    .attr("y", flagY)
                    .attr("width", flagWidth)
                    .attr("height", flagHeight)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", images.field[dimension]);
            }

            // *** BEGIN ADDITION: Add Dimension Label (Left of Icon, Right Aligned) ***
            const labelX = flagX - flagPadding; // Label right edge next to icon's left edge
            const labelY = yPos + barHeight / 2; // Vertically centered with bar
            const formattedDimension = dimensionUnit ? 
                `${dimension}${dimensionUnit}` : 
                `${dimension}`;

            g.append("text")
                .attr("class", "dimension-label")
                .attr("x", labelX)
                .attr("y", labelY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end") // Right align text
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#000000")
                .text(formattedDimension);
            // *** END ADDITION ***
            
            // 添加数值标签
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;

            // --- BEGIN MODIFICATION: Force Label Outside --- 
            
            const valueLabelX = barWidth + 5;
            const valueLabelAnchor = "start";
            const valueLabelFill = colors.text_color || "#000000";
            
            // Create the actual value label with fixed properties
            g.append("text")
                .attr("x", valueLabelX)
                .attr("y", yPos + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", valueLabelAnchor)
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${barHeight * 0.7}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", valueLabelFill)
                .text(formattedValue);
            // --- END MODIFICATION ---
        });
    });
    
    // 返回SVG节点
    return svg.node();
}