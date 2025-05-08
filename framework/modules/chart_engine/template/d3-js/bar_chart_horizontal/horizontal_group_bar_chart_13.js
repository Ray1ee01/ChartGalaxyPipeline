/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Group Bar Chart",
    "chart_name": "horizontal_group_bar_chart_13",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"], 
    "required_other_colors": ["primary"],
    "supported_effects": [], 
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

// 水平分组条形图实现 - 使用D3.js   horizontal_split_bar_chart_06 (Applying Sketch Style)
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                           // 完整的JSON数据对象
    const chartData = jsonData.data.data;            // 实际数据点数组  
    const variables = jsonData.variables || {};      // 图表配置
    const typography = jsonData.typography || {      // 字体设置，如果不存在则使用默认值
        title: { font_family: "'Comic Sans MS', cursive", font_size: "18px", font_weight: "bold" },
        label: { font_family: "'Comic Sans MS', cursive", font_size: "12px", font_weight: "normal" },
        description: { font_family: "'Comic Sans MS', cursive", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "'Comic Sans MS', cursive", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置
    const images = jsonData.images || { field: {}, other: {} };   // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_stroke = variables.has_stroke !== undefined ? variables.has_stroke : true; // Default stroke to true for sketch
    
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
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距
    const margin = {
        top: 100,      // 顶部留出标题空间
        right: 30,    // 右侧足够显示数值
        bottom: 60,   // 底部边距
        left: 60     // 左侧初始空间，会动态调整
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    const groupField = dataColumns.find(col => col.role === "group").name;
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; 
    let groupUnit = "";
    
    if (dataColumns.find(col => col.role === "x").unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    if (dataColumns.find(col => col.role === "group").unit !== "none") {
        groupUnit = dataColumns.find(col => col.role === "group").unit; 
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值和分组值
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 不对数据进行排序，使用原始顺序
    
    // ---------- 5. 计算标签宽度 (使用手绘字体) ----------
    // *** 添加: 手绘背景内边距 ***
    const sketchPadding = 5;
    
    // 创建临时SVG来测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 计算最大维度标签宽度
    let maxLabelWidth = 0;
    dimensions.forEach(dimension => {
        const formattedDimension = dimensionUnit ? 
            `${dimension}${dimensionUnit}` : 
            `${dimension}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", "'Comic Sans MS', cursive") // 使用手绘字体
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
        
        const textWidth = tempText.node().getBBox().width;
        // *** 修改: 考虑背景padding ***
        const totalWidth = textWidth + 2 * sketchPadding; // 文本宽度 + 背景padding
        
        maxLabelWidth = Math.max(maxLabelWidth, totalWidth);
        
        tempText.remove();
    });
    
    // 计算最大数值标签宽度
    let maxValueWidth = 0;
    chartData.forEach(d => {
        const formattedValue = valueUnit ? 
            `${d[valueField]}${valueUnit}` : 
            `${d[valueField]}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.annotation.font_family) // 使用手绘字体
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight) // 通常数值标签会加粗
            .text(formattedValue);
        
        const textWidth = tempText.node().getBBox().width;
        // *** 修改: 考虑背景padding ***
        maxValueWidth = Math.max(maxValueWidth, textWidth + 2 * sketchPadding);
        
        tempText.remove();
    });
    
    // 计算图例项宽度 (使用手绘字体)
    const legendItemWidths = [];
    let totalLegendWidth = 0;
    const legendPadding = 15; // 图例项之间的间距 (稍微增大)
    
    groups.forEach(group => {
        const tempText = tempSvg.append("text")
            .style("font-family", "'Comic Sans MS', cursive") // 使用手绘字体
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(group);
        
        const textWidth = tempText.node().getBBox().width;
        const legendItemWidth = 15 + 8 + textWidth + legendPadding; // 色块(15) + 间距(8) + 文本宽度 + 右侧填充
        
        legendItemWidths.push(legendItemWidth);
        totalLegendWidth += legendItemWidth;
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 根据标签宽度调整左边距（添加一些边距）
    margin.left = Math.max(margin.left, maxLabelWidth + 15); // 增加右侧空间
    // 根据数值标签宽度调整右边距 (添加一些边距)
    margin.right = Math.max(margin.right, maxValueWidth + 15);
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 6. 创建SVG容器 ----------
    
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
    
    // *** 修改: 使用来自 vertical_group_bar_chart_13 的手绘图案定义 ***
    // --- Sketch Pattern Definitions ---
    const patternLeft = defs.append("pattern")
        .attr("id", "pattern-sketch-left")
        .attr("width", 8).attr("height", 8)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("patternTransform", "rotate(45)");
    patternLeft.append("rect").attr("width", 8).attr("height", 8).attr("fill", "#4269d0"); // Default color
    patternLeft.append("path").attr("d", "M -1,2 l 10,0 M -1,5 l 10,0 M -1,8 l 10,0").attr("stroke", "#FFFFFF").attr("stroke-width", 0.8);

    const patternRight = defs.append("pattern")
        .attr("id", "pattern-sketch-right")
        .attr("width", 8).attr("height", 8)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("patternTransform", "rotate(-45)");
    patternRight.append("rect").attr("width", 8).attr("height", 8).attr("fill", "#ff725c"); // Default color
    patternRight.append("path").attr("d", "M -1,2 l 10,0 M -1,5 l 10,0 M -1,8 l 10,0").attr("stroke", "#FFFFFF").attr("stroke-width", 0.8);

    const patternLabelSketch = defs.append("pattern")
         .attr("id", "pattern-label-sketch")
         .attr("width", 8).attr("height", 8)
         .attr("patternUnits", "userSpaceOnUse")
         .attr("patternTransform", "rotate(45)");
     patternLabelSketch.append("rect").attr("width", 8).attr("height", 8).attr("fill", "#FFFFFF");
     patternLabelSketch.append("path").attr("d", "M -1,2 l 10,0 M -1,5 l 10,0 M -1,8 l 10,0").attr("stroke", "#CCCCCC").attr("stroke-width", 0.6);

    // ---------- 7. 创建比例尺 ----------
    
    // 计算条形的额外间距 - 使用固定值
    const barPadding = 0.1;
    
    // Y轴比例尺（用于维度）- 使用原始顺序
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（用于数值）
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField]) || 1]) // Ensure domain starts at 0 and handles empty data
        .range([0, innerWidth]);
    
    // 获取组颜色 - 用于动态更新图案背景色 (可选)
    function getGroupColor(group) {
        // 优先使用指定颜色
        if (colors.field && colors.field[group]) {
            return colors.field[group];
        }
        // 如果有可用颜色数组，按索引使用
        if (colors.available_colors && colors.available_colors.length > 0) {
            const groupIndex = groups.indexOf(group);
            return colors.available_colors[groupIndex % colors.available_colors.length];
        }
         // 如果有 primary 颜色
        if (colors.other?.primary) {
             // 可以基于 group 索引生成不同深浅的 primary 颜色
             const groupIndex = groups.indexOf(group);
             // 简单的亮度调整示例
             const factor = 1 - (groupIndex * 0.15); // 索引越大越暗
             return d3.color(colors.other.primary).brighter(factor * 0.5).darker(factor*0.2); // 示例调整
        }
        // 提供默认 fallback 颜色
        const groupIndex = groups.indexOf(group);
        const defaultColors = ["#4269d0", "#ff725c", "#4CAF50", "#FFC107", "#9C27B0"];
        return defaultColors[groupIndex % defaultColors.length];
    }
    
    // ---------- 8. 创建图例 (应用手绘风格) ----------
    /* // --- 旧图例代码移除开始 ---
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width / 2}, ${margin.top / 2})`); // Initial position

    let legendOffset = 0;
    groups.forEach((group, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(${legendOffset}, 0)`);

        // *** 修改: 图例颜色方块使用手绘图案 ***
        const legendRect = legendItem.append("rect")
            .attr("width", 15)
            .attr("height", 15);

        // 确定该组使用的图案 ID
        const patternId = i % 2 === 0 ? "pattern-sketch-left" : "pattern-sketch-right";
        // 可选: 更新图案背景色
        const groupBaseColor = getGroupColor(group);
        // d3.select(`#${patternId} rect`).attr("fill", groupBaseColor); // Uncomment to dynamically color patterns
        legendRect.attr("fill", `url(#${patternId})`)
                  .attr("stroke", "#555") // 添加边框
                  .attr("stroke-width", 0.5);


        // *** 修改: 图例文本使用手绘字体 ***
        legendItem.append("text")
            .attr("x", 15 + 8) // 方块宽度 + 间距
            .attr("y", 7.5) // 垂直居中
            .attr("dy", "0.35em")
            .style("font-family", "'Comic Sans MS', cursive") // 手绘字体
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(group);

        legendOffset += legendItemWidths[i]; // 使用之前计算的宽度
    });

    // 调整图例位置，使其居中
    legend.attr("transform", `translate(${(width - totalLegendWidth) / 2}, ${margin.top / 2})`);
    */ // --- 旧图例代码移除结束 ---

    // ---------- 11. 创建新样式图例 (从 HGB 12 复制并调整) ----------
    
    // --- 11a. 预计算图例组名样式 (使用手绘字体) ---
    const legendTempText = svg.append("text")
        .style("font-family", "'Comic Sans MS', cursive") // *** 使用手绘字体 ***
        .style("opacity", 0).style("position", "absolute").style("pointer-events", "none");

    // 调整 getLegendTextWidth 以接受 fontWeight
    function getLegendTextWidth(text, fontSize, fontWeight = typography.annotation.font_weight) {
        legendTempText.style("font-size", fontSize + "px").style("font-weight", fontWeight).text(text);
        try {
            return legendTempText.node().getComputedTextLength();
        } catch (e) {
            return text.length * fontSize * 0.6; 
        }
    }

    const initialLegendFontSize = 12; 
    const minLegendFontSize = 8;    
    let globalLegendFontSize = initialLegendFontSize; 
    let globalLegendNeedsWrapping = false;      

    // *** 调整: 图例宽度计算基于可用总宽度 ***
    const legendAvailableTotalWidth = width * 0.8; // 限制图例总宽为画布的80%
    const equalGroupRectWidth = Math.min(innerWidth / groups.length, legendAvailableTotalWidth / groups.length); // 均分宽度，但不超过innerWidth
    
    // 估算序号宽度 (使用手绘字体)
    const numberFontSize = 16; 
    const numberFontWeight = "bold";
    const numberLeftPadding = 3; 
    const numberRightPadding = 5; 
    const textPadding = 0; 
    const estimatedNumberWidth = getLegendTextWidth("8", numberFontSize, numberFontWeight); 
    
    // 计算组名实际可用宽度 
    const groupNameAvailableWidth = Math.max(10, equalGroupRectWidth - numberLeftPadding - estimatedNumberWidth - numberRightPadding - textPadding - numberLeftPadding); 

    groups.forEach(group => {
        let measuredWidth = getLegendTextWidth(group, initialLegendFontSize);
        if (measuredWidth > groupNameAvailableWidth) { 
            measuredWidth = getLegendTextWidth(group, minLegendFontSize);
            globalLegendFontSize = minLegendFontSize; 
            if (measuredWidth > groupNameAvailableWidth) {
                globalLegendNeedsWrapping = true; 
            }
        }
    });
    legendTempText.remove(); 
    // --- 结束预计算 ---

    // --- 11b. 绘制图例 ---
    const legendBarHeight = 15; 
    const paddingTop = 8;    
    // *** 修改: 调整图例 Y 坐标到图表底部 ***
    const legendStartY = height - margin.bottom + 20; // 放置在底部边距下方一点 (增加距离)

    // --- 11c. 创建图例组，暂不设置 transform ---
    const legend = svg.append("g") // 使用新的 legend 变量
        .attr("class", "new-legend"); 

    let currentX = 0; // 用于计算总宽度
    groups.forEach((group, i) => {
        const groupColor = getGroupColor(group); // 获取组颜色（用于实心矩形）

        // 绘制图例条矩形部分 (等宽, 实心颜色)
        legend.append("rect")
            .attr("x", currentX)
            .attr("y", 0)
            .attr("width", equalGroupRectWidth)
            .attr("height", legendBarHeight)
            .attr("fill", groupColor) // *** 使用 getGroupColor 的实心颜色 ***
            .attr("stroke", "#555") // 添加手绘边框
            .attr("stroke-width", 0.5);

        // *** 修改: 移除序号绘制，调整组名X坐标 ***
        const labelY = legendBarHeight + paddingTop;
        // const numberX = currentX + numberLeftPadding; // 不再需要 numberX
        // const groupNameX_old = numberX + estimatedNumberWidth + numberRightPadding + textPadding; // 旧的计算方式
        const groupNameX = currentX + numberLeftPadding; // 新的X坐标：紧邻矩形左侧加padding
        const groupNameAvailableWidthAdjusted = Math.max(10, equalGroupRectWidth - numberLeftPadding - numberLeftPadding); // 调整可用宽度计算

        /* // --- 移除序号绘制代码 ---
        legend.append("text")
            .attr("x", numberX)
            .attr("y", labelY)
            .attr("text-anchor", "start") 
            .attr("dominant-baseline", "hanging") 
            .style("font-family", "'Comic Sans MS', cursive") // *** 强制手绘字体 ***
            .style("font-size", `${numberFontSize}px`)
            .style("font-weight", "bold")
            .style("fill", colors.text_color)
            .text(i + 1);
        */ // --- 结束移除序号绘制代码 ---

        // 绘制组名 (使用手绘字体，调整X坐标)
        const groupNameText = legend.append("text")
            .attr("x", groupNameX) // *** 使用调整后的X坐标 ***
            .attr("y", labelY)
            .attr("dominant-baseline", "hanging")
            .style("font-family", "'Comic Sans MS', cursive") // *** 强制手绘字体 ***
            .style("font-size", globalLegendFontSize + "px")
            .style("font-weight", typography.annotation.font_weight)
            .style("fill", colors.text_color);

        // 应用换行（如果需要，使用调整后的可用宽度）
        if (globalLegendNeedsWrapping && groupNameAvailableWidthAdjusted > 10) {
            const wrapWidth = groupNameAvailableWidthAdjusted; // *** 使用调整后的宽度 ***
            const lineHeight = 1.1;
            wrapText(groupNameText, group, wrapWidth, lineHeight);
        } else {
            groupNameText.text(group); 
        }

        // 累加当前 X 位置，用于计算总宽度
        currentX += equalGroupRectWidth; 
    });
    
    // --- 11d. 计算图例总宽度并设置居中 transform ---
    const totalLegendWidthCalculated = currentX; // 使用累加的宽度
    const legendStartXCentered = (width - totalLegendWidthCalculated) / 2; // 计算居中起始X坐标

    legend.attr("transform", `translate(${legendStartXCentered}, ${legendStartY})`); // 应用最终的 transform

    // ---------- 9. 创建主图表组 ----------
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 10. 为每个维度绘制分组条形 (应用手绘风格) ----------
    
    dimensions.forEach(dimension => {
        // 获取此维度下的所有数据点
        const dimensionData = chartData.filter(d => d[dimensionField] === dimension);
        
        if (dimensionData.length > 0) {
            const barGroupY = yScale(dimension); // Y position for the start of this dimension's group
            const barGroupHeight = yScale.bandwidth(); // Total height available for this dimension's bars
            
            // --- 添加带背景的维度标签 ---
            const labelGroup = g.append("g")
                .attr("class", "dimension-label-group");
            
            const labelTextContent = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
            const labelBaseFontSize = parseFloat(typography.label.font_size);
            const labelMaxHeight = barGroupHeight * 0.8; // Max height based on available space
            const labelFontSize = Math.min(labelBaseFontSize, labelMaxHeight);
            const labelTargetY = barGroupY + barGroupHeight / 2; // Target vertical center
            
            // 1. 创建临时文本测量
            const tempLabelText = labelGroup.append("text")
                .style("font-family", "'Comic Sans MS', cursive")
                .style("font-size", `${labelFontSize}px`)
                .style("font-weight", typography.label.font_weight)
                .style("visibility", "hidden")
                .text(labelTextContent);
            const labelBBox = tempLabelText.node().getBBox();
            tempLabelText.remove();
            
            // 2. 计算背景尺寸和位置 (使其右边缘在Y轴左侧10px, 垂直居中)
            const labelBgWidth = labelBBox.width + 2 * sketchPadding;
            const labelBgHeight = labelBBox.height + 1.5 * sketchPadding;
            const labelBgX = -10 - labelBgWidth; // 右边缘在-10
            const labelBgY = labelTargetY - labelBgHeight / 2; // 垂直居中
            
            // 3. 绘制背景
            labelGroup.append("rect")
                .attr("x", labelBgX)
                .attr("y", labelBgY)
                .attr("width", labelBgWidth)
                .attr("height", labelBgHeight)
                .attr("fill", "url(#pattern-label-sketch)")
                .attr("stroke", "#AAAAAA")
                .attr("stroke-width", 0.5);
            
            // 4. 绘制文本 (右对齐, 垂直居中)
            labelGroup.append("text")
                .attr("x", -10 - sketchPadding) // 文本右边缘在背景右侧内边距处
                .attr("y", labelTargetY) // 垂直中心
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .style("font-family", "'Comic Sans MS', cursive")
                .style("font-size", `${labelFontSize}px`)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(labelTextContent);
            
            // 计算每个组的条形高度
            const groupBarHeight = barGroupHeight / groups.length;
            
            // 绘制每个组的条形
            groups.forEach((group, groupIndex) => {
                const dataPoint = dimensionData.find(d => d[groupField] === group);
                
                if (dataPoint) {
                    const value = parseFloat(dataPoint[valueField]) || 0; // Default to 0 if parsing fails
                    const barWidth = xScale(value);
                    const groupY = barGroupY + (groupIndex * groupBarHeight);
                    const barActualY = groupY + groupBarHeight * 0.1; // Add slight top/bottom padding within group slot
                    const barActualHeight = groupBarHeight * 0.8; // Reduce height slightly for padding
                    
                    // *** 修改: 使用 <rect> 绘制条形，应用手绘图案和描边 ***
                    const barPatternId = groupIndex % 2 === 0 ? "pattern-sketch-left" : "pattern-sketch-right";
                    // 可选: 更新图案颜色
                    const groupBarColor = getGroupColor(group);
                    // d3.select(`#${barPatternId} rect`).attr("fill", groupBarColor);
                    
                    g.append("rect")
                        .attr("class", `bar group-${groupIndex}`)
                        .attr("x", 0)
                        .attr("y", barActualY)
                        .attr("width", Math.max(0, barWidth)) // Prevent negative width
                        .attr("height", Math.max(0, barActualHeight)) // Prevent negative height
                        .attr("fill", `url(#${barPatternId})`)
                        .attr("stroke", variables.has_stroke ? "#555" : "none")
                        .attr("stroke-width", variables.has_stroke ? 0.8 : 0); // Sketchy stroke width
                    
                    // 添加带背景的数值标签
                    const valueTextContent = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
                    const valueBaseFontSize = parseFloat(typography.annotation.font_size);
                     // Limit font size by available bar height
                    const valueFontSize = Math.min(valueBaseFontSize, barActualHeight * 0.7); 
                    
                    const valueLabelGroup = g.append("g")
                        .attr("class", "value-label-group");
                    
                    // 1. 测量文本
                    const tempValueText = valueLabelGroup.append("text")
                        .style("font-family", typography.annotation.font_family)
                        .style("font-size", `${valueFontSize}px`)
                        .style("font-weight", "bold") // Value bold
                        .style("visibility", "hidden")
                        .text(valueTextContent);
                    const valueBBox = tempValueText.node().getBBox();
                    tempValueText.remove();
                    
                    // 2. 计算背景尺寸和位置 (居中)
                    const valueBgWidth = valueBBox.width + 2 * sketchPadding;
                    const valueBgHeight = valueBBox.height + 1.5 * sketchPadding;
                    const valueBgX = -valueBgWidth / 2;
                    const valueBgY = -valueBgHeight / 2;
                    
                    // 3. 绘制背景
                    valueLabelGroup.append("rect")
                        .attr("x", valueBgX)
                        .attr("y", valueBgY)
                        .attr("width", valueBgWidth)
                        .attr("height", valueBgHeight)
                        .attr("fill", "url(#pattern-label-sketch)")
                        .attr("stroke", "#AAAAAA")
                        .attr("stroke-width", 0.5);
                    
                    // 4. 绘制文本 (居中)
                    valueLabelGroup.append("text")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .style("font-family", typography.annotation.font_family)
                        .style("font-size", `${valueFontSize}px`)
                        .style("font-weight", "bold")
                        .style("fill", colors.text_color)
                        .text(valueTextContent);
                    
                    // 5. 定位标签组 (条形右侧, 垂直居中)
                    const valueLabelTargetX = barWidth + 8 + valueBgWidth / 2; // Center X of group is 8px right of bar end
                    const valueLabelTargetY = barActualY + barActualHeight / 2; // Vertical center of the bar
                    valueLabelGroup.attr("transform", `translate(${valueLabelTargetX}, ${valueLabelTargetY})`);
                }
            });
        }
    });
    
    // *** 添加 wrapText 函数 (如果不存在) ***
    function wrapText(text, str, width, lineHeight) {
        const words = str.split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const y = text.attr("y"); 
        const x = text.attr("x"); 
        const dy = parseFloat(text.attr("dy") || 0); 

        text.text(null); 

        let tspans = [];

        if (words.length > 1 && words.some(w => w.length > 0)) { 
            let currentLine = [];
            while (word = words.pop()) {
                currentLine.push(word);
                const tempTspan = text.append("tspan").text(currentLine.join(" "));
                const isOverflow = tempTspan.node().getComputedTextLength() > width; 
                tempTspan.remove();

                if (isOverflow && currentLine.length > 1) {
                    currentLine.pop();
                    tspans.push(currentLine.join(" "));
                    currentLine = [word];
                    lineNumber++;
                }
            }
            if (currentLine.length > 0) {
                tspans.push(currentLine.join(" "));
            }
        } else { 
            const chars = str.split('');
            let currentLine = '';
            for (let i = 0; i < chars.length; i++) {
                const nextLine = currentLine + chars[i];
                const tempTspan = text.append("tspan").text(nextLine);
                const isOverflow = tempTspan.node().getComputedTextLength() > width;
                tempTspan.remove();

                if (isOverflow && currentLine.length > 0) {
                    tspans.push(currentLine);
                    currentLine = chars[i];
                    lineNumber++;
                } else {
                    currentLine = nextLine;
                }
            }
            if (currentLine.length > 0) {
                tspans.push(currentLine);
            }
        }

        const totalLines = tspans.length;
        // For dominant-baseline="hanging", dy controls offset from the *hanging* point.
        // First line hangs at y, subsequent lines offset by lineHeight.
        // No vertical centering adjustment needed here like in the x-axis middle anchor case.
        
        tspans.forEach((lineText, i) => {
            text.append("tspan")
                .attr("x", x) 
                .attr("dy", (i === 0 ? dy : lineHeight) + "em") // Apply base dy for first line, lineHeight for others
                .text(lineText);
        });
    }

    // 返回SVG节点
    return svg.node();
}