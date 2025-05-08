/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Group Bar Chart",
    "chart_name": "horizontal_group_bar_chart_12",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 30], [0, "inf"], [2, 10]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 400,
    "background": "styled",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 水平分组条形图实现 - 使用D3.js  horizontal_grouped_bar_chart_01
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data;                // 实际数据点数组
    const variables = jsonData.variables || {};     // 图表配置
    const typography = jsonData.typography || {     // 字体设置，如果不存在则使用默认值
        title: { font_family: "'Comic Sans MS', cursive", font_size: "18px", font_weight: "bold" },
        label: { font_family: "'Comic Sans MS', cursive", font_size: "12px", font_weight: "normal" },
        description: { font_family: "'Comic Sans MS', cursive", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "'Comic Sans MS', cursive", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置
    const images = jsonData.images || { field: {}, other: {} };  // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    

    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸和边距
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 为标题和副标题预留空间，即使不显示它们
    const titleHeight = 70;  // 为标题预留至少70的高度
    
    // 分析图表区域底部边距
    const bottomMargin = 80;
    
    // 初始设置边距
    const margin = { 
        top: titleHeight,     // 顶部留出标题空间
        right: 80,            // 右侧足够显示数值
        bottom: bottomMargin, // 底部边距
        left: 150             // 左侧暂时设为最小值，稍后会根据标签长度调整
    };
    
    // ---------- 3. 提取字段名和单位 ----------
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
    
    // 获取维度（如Gen Z, Millennials等）和分组（如$50 or more, $1-49, Nothing）
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // ---------- 5. 计算标签和图标空间 ----------
    
    // 创建临时SVG用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 计算维度标签最大宽度
    let maxDimensionWidth = 0;
    dimensions.forEach(dimension => {
        const tempText = tempSvg.append("text")
            .style("font-family", "'Comic Sans MS', cursive")
            .style("font-size", typography.label.font_size)
            .text(dimension);
        
        const textWidth = tempText.node().getBBox().width;
        maxDimensionWidth = Math.max(maxDimensionWidth, textWidth);
        
        tempText.remove();
    });
    
    // 计算分组标签最大宽度
    let maxGroupWidth = 0;
    groups.forEach(group => {
        const tempText = tempSvg.append("text")
            .style("font-family", "'Comic Sans MS', cursive")
            .style("font-size", typography.label.font_size)
            .style("font-weight", "bold")
            .text(group);
        
        const textWidth = tempText.node().getBBox().width;
        maxGroupWidth = Math.max(maxGroupWidth, textWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // === 修改点：结合维度标签和组标签最大宽度，重新计算margin.left ===
    const maxLabelWidth = Math.max(maxDimensionWidth, maxGroupWidth);
    const sketchPadding = 5; // 背景内边距
    const dimensionLabelWidth = maxLabelWidth + 2 * sketchPadding + 20; // 标签宽度 + 背景padding + 额外空间
    margin.left = Math.max(margin.left, dimensionLabelWidth + 20);
    
    // 计算实际绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // *** 修改: 移除间距相关的计算 ***
    // const groupPadding = innerHeight * (variables.has_spacing ? 0.08 : 0.06);  // 移除组间距
    const groupHeight = innerHeight / groups.length; // 每组的原始高度
    
    // *** 修改: 移除间距对barHeight的影响 ***
    // const barHeight = (groupHeight - groupPadding) / dimensions.length;
    const barHeight = groupHeight / dimensions.length; // 维度在组内均分高度
    // const actualBarHeight = variables.has_spacing ? barHeight * 0.65 : barHeight * 0.75;   // 移除间距影响
    const actualBarHeight = barHeight * 0.75; // 固定条形实际高度比例
    
    // 标志尺寸
    const iconWidth = actualBarHeight * 0.9;
    const iconHeight = iconWidth;
    const iconRightPadding = iconWidth * 0.4;  // 图标右侧到柱子的间距
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建defs用于滤镜和渐变
    const defs = svg.append("defs");
    
    // ---------- 6.1 创建视觉效果 ----------
    
    // --- Sketch Pattern for Left Bars (or even index groups) ---
    const patternLeft = defs.append("pattern")
        .attr("id", "pattern-sketch-left")
        .attr("width", 8) 
        .attr("height", 8)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("patternTransform", "rotate(45)"); 

    patternLeft.append("rect")
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", "#4269d0"); // 使用一个基色，具体颜色会被覆盖

    patternLeft.append("path")
        .attr("d", "M -1,2 l 10,0 M -1,5 l 10,0 M -1,8 l 10,0")
        .attr("stroke", "#FFFFFF") 
        .attr("stroke-width", 0.8);

    // --- Sketch Pattern for Right Bars (or odd index groups) ---
    const patternRight = defs.append("pattern")
        .attr("id", "pattern-sketch-right")
        .attr("width", 8)
        .attr("height", 8)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("patternTransform", "rotate(-45)"); // 反向旋转

    patternRight.append("rect")
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", "#ff725c"); // 使用另一个基色

    patternRight.append("path")
        .attr("d", "M -1,2 l 10,0 M -1,5 l 10,0 M -1,8 l 10,0") 
        .attr("stroke", "#FFFFFF") 
        .attr("stroke-width", 0.8);

    // --- Sketch Pattern for Label Backgrounds ---
    const patternLabelSketch = defs.append("pattern")
         .attr("id", "pattern-label-sketch") 
         .attr("width", 8) 
         .attr("height", 8)
         .attr("patternUnits", "userSpaceOnUse")
         .attr("patternTransform", "rotate(45)"); 

     patternLabelSketch.append("rect")
         .attr("width", 8)
         .attr("height", 8)
         .attr("fill", "#FFFFFF"); 

     patternLabelSketch.append("path")
         .attr("d", "M -1,2 l 10,0 M -1,5 l 10,0 M -1,8 l 10,0") 
         .attr("stroke", "#CCCCCC") 
         .attr("stroke-width", 0.6); 

    
    // ---------- 7. 创建比例尺 ----------
    
    // 计算最大值用于X轴比例尺
    const maxValue = d3.max(chartData, d => +d[valueField]);
    
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
    
    // 值的X比例尺
    const xScale = d3.scaleLinear()
        .domain([0, maxValue * 1.1]) // 添加10%边距
        .range([0, innerWidth]);
    
    // ---------- 8. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 9. 辅助函数 ----------
    
    // 获取组颜色
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
        
        // Provide default fallback colors if none are defined
        const groupIndex = groups.indexOf(group);
        const defaultColors = ["#4269d0", "#ff725c", "#4CAF50", "#FFC107", "#9C27B0", "#795548"];
        return defaultColors[groupIndex % defaultColors.length];
    }
    
    // 获取描边颜色
    const getStrokeColor = () => {
        return "#555"; // 固定手绘描边颜色
    };
    
    // *** 添加: 计算字体大小的函数 (从 vertical_group_bar_chart_13 复制) ***
    const calculateFontSize = (text, maxWidth, baseSize = 12) => {
        const avgCharWidth = baseSize * 0.6;
        const textWidth = text.length * avgCharWidth;
        if (textWidth < maxWidth) {
            return baseSize;
        }
        return Math.max(8, Math.floor(baseSize * (maxWidth / textWidth))); // 最小字体8px
    };
    
    // ========== 9. 添加交替行背景（新增） ==========
    if (jsonData.variation?.background === "styled") {
        // 每个 group 下有若干维度，故在每个 group 里为维度的"行"画背景
        groups.forEach((group, groupIndex) => {
            const groupStartY = groupIndex * groupHeight;
            dimensions.forEach((dimension, dimIndex) => {
                // 偶数行添加背景
                if (dimIndex % 2 === 0) {
                    g.append("rect")
                        .attr("x", 0)
                        .attr("y", groupStartY + dimIndex * barHeight)
                        .attr("width", innerWidth)
                        .attr("height", barHeight)
                        .attr("class","background")
                        .attr("fill", "#f0f0f0") // 稍微调整背景色
                        .attr("opacity", 0.7); // 稍微调整透明度
                }
            });
        });
    }
    
    // ---------- 10. 绘制图表 ----------
    
    // 为每个组创建一个分组
    groups.forEach((group, groupIndex) => {
        // 计算该组的垂直位置
        const groupStartY = groupIndex * (groupHeight);
        
        // 筛选该组的数据
        const groupData = chartData.filter(d => d[groupField] === group);
        
        // *** 添加: 确定该组使用的手绘图案 ***
        const barPatternId = groupIndex % 2 === 0 ? "url(#pattern-sketch-left)" : "url(#pattern-sketch-right)";
        // *** 添加: 获取组的实际颜色，用于图案背景 (可选，如果需要动态颜色图案) ***
        const groupBaseColor = getGroupColor(group); 
        // *** 可选: 更新对应 pattern 的 rect fill (如果需要动态颜色) ***
        // d3.select(`#${barPatternId.slice(5, -1)} rect`).attr("fill", groupBaseColor);

        // 为每个维度绘制条形
        dimensions.forEach((dimension, dimIndex) => {
            // 查找数据点
            const dataPoint = groupData.find(d => d[dimensionField] === dimension);
            
            if (dataPoint) {
                // 条形的垂直位置
                const barY = groupStartY + dimIndex * barHeight;
                
                // 条形宽度
                const barWidth = xScale(+dataPoint[valueField]);
                
                // 创建标签和图标组
                const labelGroup = g.append("g")
                    .attr("transform", `translate(0, ${barY + actualBarHeight / 2})`);
                
                // 绘制图标
                if (images.field && images.field[dimension]) {
                    // 图标位置：紧贴条形左侧
                    labelGroup.append("image")
                        .attr("x", -iconWidth - iconRightPadding)
                        .attr("y", -iconHeight/2)
                        .attr("width", iconWidth)
                        .attr("height", iconHeight)
                        .attr("preserveAspectRatio","xMidYMid meet")
                        .attr("xlink:href", images.field[dimension]);
                }
                
                // *** 修改: 绘制带手绘背景的维度标签 ***
                const dimensionTextContent = dimension;
                const dimensionLabelX = -iconWidth - iconRightPadding - 15; // 文本右边缘 X 坐标
                const dimensionBaseFontSize = parseFloat(typography.label.font_size);
                const dimensionMaxTextHeight = actualBarHeight * 0.8; // 限制最大高度
                const dimensionFontSize = Math.min(dimensionBaseFontSize, dimensionMaxTextHeight);

                // 1. 创建文本元素 (用于测量)
                const tempDimText = labelGroup.append("text")
                    .attr("x", dimensionLabelX) 
                    .attr("y", 0) 
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end") // 右对齐
                    .style("font-family", "'Comic Sans MS', cursive")
                    .style("font-size", `${dimensionFontSize}px`)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", colors.text_color || "#333")
                    .style("visibility", "hidden") // 隐藏用于测量
                    .text(dimensionTextContent);
                    
                // 2. 获取文本边界框
                const dimBBox = tempDimText.node().getBBox();
                tempDimText.remove(); // 移除临时文本
                
                // 3. 计算背景尺寸和位置
                const dimBgWidth = dimBBox.width + 2 * sketchPadding;
                const dimBgHeight = dimBBox.height + 1.5 * sketchPadding;
                const dimBgX = dimensionLabelX - dimBBox.width - sketchPadding; // 背景左上角X
                const dimBgY = dimBBox.y - sketchPadding * 0.75; // 背景左上角Y (调整垂直居中)

                // 4. 绘制背景 (在文本之前插入)
                labelGroup.insert("rect", ":first-child") // 插入为第一个子元素
                    .attr("x", dimBgX)
                    .attr("y", dimBgY)
                    .attr("width", dimBgWidth)
                    .attr("height", dimBgHeight)
                    .attr("fill", "url(#pattern-label-sketch)")
                    .attr("stroke", "#AAAAAA")
                    .attr("stroke-width", 0.5);

                // 5. 绘制最终文本 (在背景之上)
                labelGroup.append("text")
                    .attr("class", "dimension-label")
                    .attr("x", dimensionLabelX) 
                    .attr("y", 0) 
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end") 
                    .style("font-family", "'Comic Sans MS', cursive") // *** 强制字体 ***
                    .style("font-size", `${dimensionFontSize}px`)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", colors.text_color || "#333")
                    .text(dimensionTextContent);

                // *** 修改: 绘制条形，使用手绘图案和描边 ***
                g.append("rect")
                    .attr("class", `bar group-${groupIndex}`)
                    .attr("x", 0)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", actualBarHeight) 
                    .attr("fill", barPatternId) // 应用手绘图案
                    .attr("rx", 5) // *** 强制圆角 ***
                    .attr("ry", 5) // *** 强制圆角 ***
                    .style("stroke", variables.has_stroke ? getStrokeColor() : "none") // 应用手绘描边
                    .style("stroke-width", variables.has_stroke ? 1 : 0) // 固定描边宽度
                    // .style("filter", variables.has_shadow ? "url(#shadow)" : "none") // *** 移除阴影应用 ***
                    .on("mouseover", function() {
                        d3.select(this).attr("opacity", 0.8);
                    })
                    .on("mouseout", function() {
                        d3.select(this).attr("opacity", 1);
                    });

                // *** 修改: 绘制带手绘背景的数值标签 ***
                const formattedValue = valueUnit ?
                    `${formatValue(dataPoint[valueField])}${valueUnit}` :
                    `${formatValue(dataPoint[valueField])}`;
                const valueLabelBaseFontSize = Math.min(parseFloat(typography.annotation.font_size), actualBarHeight * 0.55); // 基础字体大小
                
                // -- 创建一个组来容纳标签和背景 --
                const valueLabelGroup = g.append("g")
                    .attr("class", "value-label-group");

                // 1. 创建临时文本测量尺寸
                const tempValueText = valueLabelGroup.append("text")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${valueLabelBaseFontSize}px`)
                    .style("font-weight", "bold") // 数值标签加粗
                    .style("visibility", "hidden")
                    .text(formattedValue);
                
                // 2. 获取文本 bbox
                const valueBBox = tempValueText.node().getBBox();
                tempValueText.remove();

                // 3. 计算背景尺寸和位置 (相对于组的0,0) - 用于居中
                const valueBgWidth = valueBBox.width + 2 * sketchPadding;
                const valueBgHeight = valueBBox.height + 1.5 * sketchPadding;
                // *** 修改: 背景定位改为相对中心 (0,0) ***
                const valueBgX = -valueBgWidth / 2;
                const valueBgY = -valueBgHeight / 2;

                // 4. 绘制背景
                 valueLabelGroup.append("rect")
                    .attr("class", "value-label-background")
                    .attr("x", valueBgX)
                    .attr("y", valueBgY)
                    .attr("width", valueBgWidth)
                    .attr("height", valueBgHeight)
                    .attr("fill", "url(#pattern-label-sketch)")
                    .attr("stroke", "#AAAAAA")
                    .attr("stroke-width", 0.5);
                    
                // 5. 绘制最终文本 (在组内居中)
                valueLabelGroup.append("text")
                    .attr("class", "value-label")
                    .attr("x", 0) // *** 文本X居中 ***
                    .attr("y", 0) // *** 文本Y基线调整 ***
                    .attr("dy", "0em") // 配合 dominant-baseline
                    .attr("text-anchor", "middle") // *** 文本水平居中 ***
                    .attr("dominant-baseline", "middle") // *** 文本垂直居中 ***
                    .style("fill", colors.text_color || "#333")
                    .style("font-family", "'Comic Sans MS', cursive") // *** 强制字体 ***
                    .style("font-size", `${valueLabelBaseFontSize}px`)
                    .style("font-weight", "bold")
                    .style("pointer-events", "none")
                    .text(formattedValue);
                    
                // 6. 定位整个组 (调整X坐标以考虑背景宽度)
                // const valueLabelGroupX = barWidth + 8; // 旧的起始X
                const valueLabelGroupX = barWidth + 8 + valueBgWidth / 2; // *** 调整组X位置，使其中心在 bar 右侧 8px 处 ***
                const valueLabelGroupY = barY + actualBarHeight / 2; // 组的Y位置：条形垂直中心
                valueLabelGroup.attr("transform", `translate(${valueLabelGroupX}, ${valueLabelGroupY})`);
            }
        });
    });

    // *** 添加: wrapText 辅助函数 (如果尚未存在，需要从 vertical_group_bar_chart_13 复制或确保可用) ***
    // (假设 wrapText 函数已存在或已添加)
    function wrapText(text, str, width, lineHeight) {
        const words = str.split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const y = text.attr("y"); // 获取原始 y
        const x = text.attr("x"); // 获取原始 x
        const dy = parseFloat(text.attr("dy") || 0); // 获取原始 dy

        text.text(null); // 清空现有文本

        let tspans = [];

        // 优先按单词换行
        if (words.length > 1 && words.some(w => w.length > 0)) { // Check for actual words
            let currentLine = [];
            while (word = words.pop()) {
                currentLine.push(word);
                const tempTspan = text.append("tspan").text(currentLine.join(" "));
                // Use getComputedTextLength for accuracy
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
        } else { // 按字符换行
            const chars = str.split('');
            let currentLine = '';
            for (let i = 0; i < chars.length; i++) {
                const nextLine = currentLine + chars[i];
                const tempTspan = text.append("tspan").text(nextLine);
                 // Use getComputedTextLength for accuracy
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
        // 调整垂直居中: 向上移动半行 * (总行数 - 1)
        // dominant-baseline="hanging" 时，第一个 tspan 的 y 决定顶部位置
        // dy 用于后续行的偏移
        const firstLineYAdjust = - (totalLines - 1) / 2 * lineHeight; 

        tspans.forEach((lineText, i) => {
            text.append("tspan")
                .attr("x", x) // 保持原始 x
                .attr("dy", (i === 0 ? firstLineYAdjust + dy : lineHeight) + "em") // 第一行调整基线，后续行应用行高
                .text(lineText);
        });
    }

    // ---------- 11. 创建新样式图例 (手绘风格) ----------
    
    // --- 11a. 预计算图例组名样式 (使用手绘字体) ---
    const legendTempText = svg.append("text")
        .style("font-family", typography.annotation.font_family) // 手绘字体
        .style("opacity", 0).style("position", "absolute").style("pointer-events", "none");

    // 调整 getLegendTextWidth 以接受 fontWeight (保持不变)
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

    // 计算等宽矩形宽度 (保持不变)
    // *** 调整: 图例宽度基于 innerWidth 可能太宽，考虑基于总宽度 width ***
    const legendAvailableTotalWidth = width * 0.8; // 允许图例使用80%的总宽度
    const equalGroupRectWidth = Math.min(innerWidth / groups.length, legendAvailableTotalWidth / groups.length); // 限制最大宽度
    
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
    // 调整图例 Y 坐标到图表底部
    const legendStartY = height - margin.bottom + 20; // 增加一点距离

    // --- 11c. 创建图例组 ---
    const legend = svg.append("g")
        .attr("class", "new-legend"); 

    let currentX = 0; // 用于计算总宽度
    groups.forEach((group, i) => {
        const groupColor = getGroupColor(group);
        // *** 添加: 确定图例项图案 ***
        const legendPatternId = i % 2 === 0 ? "url(#pattern-sketch-left)" : "url(#pattern-sketch-right)";
        // *** 可选: 更新图案颜色 (如果需要) ***
        // d3.select(`#${legendPatternId.slice(5,-1)} rect`).attr("fill", groupColor);

        // *** 修改: 绘制图例条矩形部分，使用手绘图案和描边 ***
        legend.append("rect")
            .attr("x", currentX)
            .attr("y", 0)
            .attr("width", equalGroupRectWidth)
            .attr("height", legendBarHeight)
            .attr("fill", legendPatternId) // 使用图案填充
            .attr("stroke", "#555")        // 添加手绘描边
            .attr("stroke-width", 0.5);

        // 计算序号和文本的坐标
        const numberX = currentX + numberLeftPadding;
        const labelY = legendBarHeight + paddingTop;
        const groupNameX = numberX + estimatedNumberWidth + numberRightPadding + textPadding;

        // *** 修改: 绘制序号，使用手绘字体 ***
        legend.append("text")
            .attr("x", numberX)
            .attr("y", labelY)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "hanging")
            .style("font-family", "'Comic Sans MS', cursive") // *** 强制字体 ***
            .style("font-size", `${numberFontSize}px`)
            .style("font-weight", "bold")
            .style("fill", colors.text_color)
            .text(i + 1);

        // *** 修改: 绘制组名，使用手绘字体 ***
        const groupNameText = legend.append("text")
            .attr("x", groupNameX).attr("y", labelY)
            .attr("dominant-baseline", "hanging")
            .style("font-family", "'Comic Sans MS', cursive") // *** 强制字体 ***
            .style("font-size", globalLegendFontSize + "px")
            .style("font-weight", typography.annotation.font_weight)
            .style("fill", colors.text_color);

        // 应用换行（如果需要）
        if (globalLegendNeedsWrapping && groupNameAvailableWidth > 10) {
            const wrapWidth = groupNameAvailableWidth;
            const lineHeight = 1.1;
            // *** 调用 wrapText 函数 (确保已定义) ***
            wrapText(groupNameText, group, wrapWidth, lineHeight);
        } else {
            groupNameText.text(group);
        }

        // 累加当前 X 位置，用于计算总宽度
        currentX += equalGroupRectWidth;
    });

    // --- 11d. 计算图例总宽度并设置居中 transform ---
    const totalLegendWidth = currentX; // 循环结束后，currentX 即为总宽度
    const legendStartXCentered = (width - totalLegendWidth) / 2; // 计算居中起始X坐标

    legend.attr("transform", `translate(${legendStartXCentered}, ${legendStartY})`); // 应用最终的 transform

    return svg.node();
}
