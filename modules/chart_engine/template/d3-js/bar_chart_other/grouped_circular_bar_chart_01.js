/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Grouped Circular Bar Chart",
    "chart_name": "grouped_circular_bar_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "hierarchy":["group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke"],
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



function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    const jsonData = data;                          // JSON数据
    const chartData = jsonData.data.data;           // 数据点数组
    const variables = jsonData.variables || {};     // 图表配置变量
    const typography = jsonData.typography || {     // 字体默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333", // 文本颜色
        other: { primary: "#4682B4" } // 主色调
    };  // 颜色设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 数值单位规范
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
    
    // 视觉效果默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false; // 圆角
    variables.has_shadow = variables.has_shadow || false; // 阴影
    variables.has_gradient = variables.has_gradient || false; // 渐变
    variables.has_stroke = variables.has_stroke || false; // 描边
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    const width = variables.width || 800; // 图表宽度
    const height = variables.height || 800; // 图表高度
    const size = Math.min(width, height); // 确保圆形
    
    // 边距
    const margin = {
        top: 90,
        right: 50,   // 右侧放标签
        bottom: 90,   // 底部放图例
        left: 50    // 左侧放标签
    };
    
    // 内部绘图区域
    const innerWidth = size - margin.left - margin.right;
    const innerHeight = size - margin.top - margin.bottom;
    
    // 圆心和半径
    const centerX = margin.left + innerWidth / 2;
    const centerY = margin.top + innerHeight / 2;
    const radius = Math.min(innerWidth, innerHeight) / 2;
    const innerCircleRadius = radius * 0.1; // 中心圆孔半径
    
    // ---------- 3. 提取字段名和单位 ----------
    
    const dimensionField = dataColumns.find(col => col.role === "x").name;  // 维度字段 (国家)
    const valueField = dataColumns.find(col => col.role === "y").name;      // 数值字段 (腐败感知)
    const groupField = dataColumns.find(col => col.role === "group").name;  // 分组字段 (地区)
    
    // 单位
    let valueUnit = "";
    if (dataColumns.find(col => col.role === "y").unit && dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    const groups = [...new Set(chartData.map(d => d[groupField]))]; // 唯一组名
    const totalItems = chartData.length; // 数据项总数
    const anglePerItem = 2 * Math.PI / totalItems; // 每项角度
    
    // 全局排序: 按组，组内按值降序
    chartData.sort((a, b) => {
        const groupCompare = groups.indexOf(a[groupField]) - groups.indexOf(b[groupField]);
        if (groupCompare !== 0) return groupCompare;
        return b[valueField] - a[valueField];
    });

    const sortedGroupedData = d3.group(chartData, d => d[groupField]); // 排序后的分组数据
    const maxValue = d3.max(chartData, d => +d[valueField]); // 最大值
    
    // ---------- 5. 创建SVG和效果定义 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", size)
        .attr("viewBox", `0 0 ${size} ${size}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    const defs = svg.append("defs");
    
    // 阴影滤镜
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse");
        filter.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 3);
        filter.append("feOffset").attr("dx", 2).attr("dy", 2).attr("result", "offsetblur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // 径向渐变
    if (variables.has_gradient) {
        groups.forEach(group => {
            const groupColor = getGroupColor(group);
            const gradient = defs.append("radialGradient")
                .attr("id", `gradient-${cleanId(group)}`)
                .attr("cx", "50%").attr("cy", "50%").attr("r", "50%").attr("fx", "50%").attr("fy", "50%");
            gradient.append("stop").attr("offset", "0%").attr("stop-color", d3.rgb(groupColor).brighter(0.5));
            gradient.append("stop").attr("offset", "100%").attr("stop-color", groupColor);
        });
    }
    
    // ---------- 6. 创建比例尺 ----------
    
    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([innerCircleRadius, radius * 0.9]);
    
    // ---------- 7. 创建背景和中心圆 ----------
    
    let currentAngle = 0;
    groups.forEach((group) => {
        const groupItems = sortedGroupedData.get(group);
        if (!groupItems) return;
        const groupColor = getGroupColor(group);
        const lightColor = d3.rgb(groupColor).brighter(1.5).toString();
        const startAngle = currentAngle;
        const endAngle = startAngle + groupItems.length * anglePerItem;
        const arc = d3.arc()
            .innerRadius(innerCircleRadius).outerRadius(radius)
            .startAngle(startAngle).endAngle(endAngle).padAngle(0.001);
        svg.append("path")
            .attr("d", arc)
            .attr("transform", `translate(${centerX}, ${centerY})`)
            .attr("fill", lightColor).attr("opacity", 0.3)
            .attr("stroke", "#fff").attr("stroke-width", 0.5);
        currentAngle = endAngle;
    });
    
    svg.append("circle") // 中心圆孔
        .attr("cx", centerX).attr("cy", centerY).attr("r", innerCircleRadius)
        .attr("fill", "#ffffff").attr("stroke", "#dddddd").attr("stroke-width", 0.5);
    
    // ---------- 8. 创建数据扇形和标签 ----------
    
    // --- 8a. 预计算全局字体大小和换行需求 ---
    const tempText = svg.append("text") // 用于测量宽度
        .style("font-family", typography.label.font_family)
        .style("font-weight", typography.label.font_weight)
        .style("opacity", 0).style("position", "absolute").style("pointer-events", "none");

    function getTextWidth(text, fontSize) {
        tempText.style("font-size", fontSize + "px").text(text);
        try {
            return tempText.node().getComputedTextLength();
        } catch (e) {
            console.error("Error getting text width:", e);
            return text.length * fontSize * 0.6; // 粗略后备
        }
    }

    const initialFontSize = 11; // 初始字体
    const minFontSize = 8; // 最小字体
    let globalMinFontSize = initialFontSize; // 全局应用的字体大小
    let globalNeedsWrapping = false; // 全局是否需要换行

    // 预计算循环
    chartData.forEach(item => {
        const countryName = item[dimensionField];
        const wrapWidth = radius * anglePerItem * 1.05; // 当前项的可用宽度
        item.calculatedWrapWidth = wrapWidth; // 存储以备后用

        let measuredWidth = getTextWidth(countryName, initialFontSize);

        if (measuredWidth > wrapWidth) { // 初始大小超宽
            measuredWidth = getTextWidth(countryName, minFontSize);
            globalMinFontSize = minFontSize; // 只要有一个需要缩小，全局就缩小
            if (measuredWidth > wrapWidth) { // 最小尺寸也超宽
                globalNeedsWrapping = true; // 只要有一个需要换行，全局就准备换行
            }
        }
    });

    tempText.remove(); // 清理临时元素
    // --- 结束预计算 ---

    currentAngle = 0; // 重置角度用于绘制
    
    // --- 8b. 绘制循环 ---
    chartData.forEach((item) => {
        const group = item[groupField];
        const groupColor = getGroupColor(group);
        const itemStartAngle = currentAngle;
        const itemEndAngle = currentAngle + anglePerItem;
        const itemRadius = radiusScale(+item[valueField]);
        
        // 数据扇形 Arc 生成器
        const arc = d3.arc()
            .innerRadius(innerCircleRadius).outerRadius(itemRadius)
            .startAngle(itemStartAngle).endAngle(itemEndAngle).padAngle(0.005);
        
        // 添加数据扇形 Path
        svg.append("path")
            .attr("d", arc)
            .attr("transform", `translate(${centerX}, ${centerY})`)
            .attr("fill", variables.has_gradient ? `url(#gradient-${cleanId(group)})` : groupColor)
            .attr("stroke", variables.has_stroke ? "#fff" : "none")
            .attr("stroke-width", variables.has_stroke ? 0.5 : 0)
            .attr("style", variables.has_shadow ? "filter: url(#shadow)" : "")
            .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
            .on("mouseout", function() { d3.select(this).attr("opacity", 1); });
        
        // --- 添加数值标签 (如果空间允许) ---
        const maxValueFontSize = 12; // 最大字体
        const minValueFontSize = 8;  // 最小字体
        let finalValueFontSize = 0; // 最终字体大小，0表示不显示
        const formattedValue = `${formatValue(item[valueField])}${valueUnit}`;

        // 循环检查字体大小
        for (let fs = maxValueFontSize; fs >= minValueFontSize; fs--) {
            const estimatedHeight = fs * 1.2; // 近似文本高度 (包括上下边距)
            const radialSpace = itemRadius - innerCircleRadius; // 可用径向空间

            // 粗略检查径向空间是否足够
            if (estimatedHeight > radialSpace) {
                continue; // 当前字体径向放不下，尝试更小的
            }

            // 计算此字体大小下的文本放置半径 (中心靠近外边缘)
            const radialPadding = 6; // 距外边缘的像素距离
            const currentTextRadius = Math.max(innerCircleRadius + estimatedHeight / 2, itemRadius - estimatedHeight / 2 - radialPadding);

            // 检查角向空间 (文本高度是否小于该半径处的弧长)
            const angularSpace = anglePerItem * currentTextRadius;
            if (estimatedHeight <= angularSpace) {
                // 找到了合适的字体大小
                finalValueFontSize = fs;
                break;
            }
        }

        // 如果找到了合适的字体大小
        if (finalValueFontSize > 0) {
            const textAngle = itemStartAngle + anglePerItem / 2; // 扇区中心角度
            // 重新计算最终放置半径
            const radialPadding = 6; // 增加一点内边距防止溢出
            const estimatedHeight = finalValueFontSize * 1.2;
            const textRadius = Math.max(innerCircleRadius + estimatedHeight / 2, itemRadius - estimatedHeight / 2 - radialPadding);

            // 计算最终坐标
            const textX = centerX + textRadius * Math.cos(textAngle - Math.PI / 2);
            const textY = centerY + textRadius * Math.sin(textAngle - Math.PI / 2);

            // 计算旋转角度 (使文本沿径向)
            // D3角度0朝上, SVG角度0朝右. 转换后减90度使水平文本基线与半径平行
            let textRotationDeg = (textAngle * 180 / Math.PI) - 90;
            // 确保文本总是朝外读: 左半圆的文本需要再旋转180度
            if (textAngle > Math.PI  && textAngle < 2 * Math.PI ) { 
                textRotationDeg += 180; 
            }

            // 添加文本元素
            svg.append("text")
                .attr("x", textX) 
                .attr("y", textY)
                .attr("text-anchor", "middle") 
                .attr("dominant-baseline", "middle")
                .attr("transform", `rotate(${textRotationDeg}, ${textX}, ${textY})`) // 围绕文本自身中心点旋转
                .style("font-family", typography.annotation.font_family) 
                .style("font-size", `${finalValueFontSize}px`) 
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", "#ffffff")
                .text(formattedValue);
        }

        // --- 添加国家名称标签 ---
        const midAngle = itemStartAngle + anglePerItem / 2;
        const labelRadius = radius * 1.05;
        const labelX = centerX + labelRadius * Math.cos(midAngle - Math.PI / 2);
        const labelY = centerY + labelRadius * Math.sin(midAngle - Math.PI / 2);
        const angleDegrees = (midAngle * 180 / Math.PI);
        let textAnchor = "middle";
        if (angleDegrees > 10 && angleDegrees < 170) textAnchor = "start";
        else if (angleDegrees > 190 && angleDegrees < 350) textAnchor = "end";

        const countryName = item[dimensionField];
        const wrapWidth = item.calculatedWrapWidth; // 使用预计算的宽度
        
        // 添加标签文本元素，使用全局字体大小
        const labelText = svg.append("text")
            .attr("x", labelX).attr("y", labelY)
            .attr("text-anchor", textAnchor).attr("dominant-baseline", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", globalMinFontSize + "px") // 应用全局字体大小
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color);
        
        // 应用换行（如果全局需要）和垂直居中
        const lineHeight = 1.03; // 行高

        if (globalNeedsWrapping) {
            wrapText(labelText, countryName, wrapWidth, lineHeight);
        } else {
            labelText.text(countryName);
        }

        // 调整多行标签垂直位置
        const tspans = labelText.selectAll('tspan');
        const numberOfLines = tspans.size();
        if (numberOfLines > 1) {
            labelText.attr("dominant-baseline", null);
            const firstTspan = tspans.filter((d, i) => i === 0);
            const initialDy = parseFloat(firstTspan.attr("dy") || 0);
            const verticalOffset = -((numberOfLines - 1) * lineHeight) / 2;
            firstTspan.attr("dy", (initialDy + verticalOffset) + "em");
        }

        // 更新角度
        currentAngle = itemEndAngle;
    });
    
    // ---------- 9. 创建新样式图例 ----------
    
    // --- 9a. 预计算图例组名样式 ---
    // 创建临时文本用于测量
    const legendTempText = svg.append("text")
        .style("font-family", typography.annotation.font_family) // Use annotation font for group names
        .style("opacity", 0).style("position", "absolute").style("pointer-events", "none");

    // 调整 getLegendTextWidth 以接受 fontWeight
    function getLegendTextWidth(text, fontSize, fontWeight = typography.annotation.font_weight) {
        legendTempText.style("font-size", fontSize + "px").style("font-weight", fontWeight).text(text);
        try {
            return legendTempText.node().getComputedTextLength();
        } catch (e) {
            return text.length * fontSize * 0.6; // 后备
        }
    }

    const initialLegendFontSize = 12; // 初始图例字体大小
    const minLegendFontSize = 8;    // 最小图例字体大小
    let globalLegendFontSize = initialLegendFontSize; // 全局图例字体大小
    let globalLegendNeedsWrapping = false;      // 全局图例是否需换行

    // 计算等宽矩形宽度
    const equalGroupRectWidth = innerWidth / groups.length;
    // 估算序号宽度 (取最宽数字'8' + 左右padding)
    const numberFontSize = 16; // 序号字体大小
    const numberFontWeight = "bold";
    const numberLeftPadding = 3; // 序号左侧内边距
    const numberRightPadding = 5; // 序号右侧内边距 (与文本间隔前)
    const textPadding = 0; // 序号和文本间距
    const estimatedNumberWidth = getLegendTextWidth("8", numberFontSize, numberFontWeight);
    // 计算组名实际可用宽度 (矩形宽度 - 序号区总宽度 - 文本间距 - 可能的右边距)
    // Ensure a minimum width, e.g., 10px, otherwise wrapping becomes impossible.
    const groupNameAvailableWidth = Math.max(10, equalGroupRectWidth - numberLeftPadding - estimatedNumberWidth - numberRightPadding - textPadding - numberLeftPadding); // Subtract padding/widths

    groups.forEach(group => {
        // 检查组名是否需要缩小或换行
        let measuredWidth = getLegendTextWidth(group, initialLegendFontSize);
        if (measuredWidth > groupNameAvailableWidth) { 
            measuredWidth = getLegendTextWidth(group, minLegendFontSize);
            globalLegendFontSize = minLegendFontSize; // 需要缩小字体
            if (measuredWidth > groupNameAvailableWidth) {
                globalLegendNeedsWrapping = true; // 需要换行
            }
        }
    });
    legendTempText.remove(); // 清理
    // --- 结束预计算 ---

    // --- 9b. 绘制图例 ---
    const legendBarHeight = 15; // 图例条高度
    const paddingTop = 8;    // 图例条与标签行的间距
    const legendStartY = size - margin.bottom * 0.8 + 10; // 图例起始 Y 坐标 (稍微往下调)
    const legendStartX = centerX - innerWidth / 2; // 图例起始 X 坐标

    const legend = svg.append("g")
        .attr("transform", `translate(${legendStartX}, ${legendStartY})`);

    let currentX = 0;
    groups.forEach((group, i) => {
        const groupColor = getGroupColor(group);

        // 绘制图例条矩形部分 (等宽)
        legend.append("rect")
            .attr("x", currentX)
            .attr("y", 0)
            .attr("width", equalGroupRectWidth)
            .attr("height", legendBarHeight)
            .attr("fill", groupColor);

        // 计算序号和文本的坐标
        const numberX = currentX + numberLeftPadding; // 序号左对齐，加左padding
        const labelY = legendBarHeight + paddingTop; // 标签行的Y坐标
        const groupNameX = numberX + estimatedNumberWidth + numberRightPadding + textPadding; // 组名起始X = 序号X+序号宽+序号右padding+文本padding

        // 绘制序号
        legend.append("text")
            .attr("x", numberX)
            .attr("y", labelY)
            .attr("text-anchor", "start") // 左对齐
            .attr("dominant-baseline", "hanging") // 顶部对齐
            .style("font-family", typography.label.font_family) // Using label font family for consistency
            .style("font-size", `${numberFontSize}px`)
            .style("font-weight", "bold")
            .style("fill", colors.text_color)
            .text(i + 1);

        // 绘制组名
        const groupNameText = legend.append("text")
            .attr("x", groupNameX).attr("y", labelY) // 与序号Y对齐
            .attr("dominant-baseline", "hanging") // 顶部对齐
            .style("font-family", typography.annotation.font_family) // 使用注释字体
            .style("font-size", globalLegendFontSize + "px") // 应用全局字体
            .style("font-weight", typography.annotation.font_weight)
            .style("fill", colors.text_color);

        // 应用换行（如果需要）
        if (globalLegendNeedsWrapping && groupNameAvailableWidth > 10) { // Ensure there's meaningful space to wrap
            const wrapWidth = groupNameAvailableWidth; 
            const lineHeight = 1.1;
            // wrapText 会处理 tspans 的 x 和 dy
            wrapText(groupNameText, group, wrapWidth, lineHeight);
        } else {
            groupNameText.text(group); // 单行直接设置文本
        }

        currentX += equalGroupRectWidth; // 更新X坐标
    });
    
    // ---------- 工具函数 ----------
    
    // 获取组颜色
    function getGroupColor(group) {
        if (colors.field && colors.field[group]) {
            return colors.field[group];
        }
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
        return colorScale(group);
    }
    
    // 清理ID
    function cleanId(str) {
        return String(str).replace(/\s+/g, '-').replace(/[^\w\-]/g, '');
    }
    
    // 文本自动换行
    function wrapText(text, str, width, lineHeight) {
        const words = str.split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const x = text.attr("x"); // Keep original X for all lines
        const y = text.attr("y");
        const dy = parseFloat(text.attr("dy") || 0); // Initial dy (should be 0 for hanging baseline)
        let tspan = text.text(null).append("tspan")
            .attr("x", x) // Use original x
            .attr("y", y) // Use original y
            .attr("dy", dy + "em"); // Apply initial dy
        
        if (words.length <= 1) { // 按字符分割
            const chars = str.split('');
            let currentLine = '';
            for (let i = 0; i < chars.length; i++) {
                currentLine += chars[i];
                tspan.text(currentLine);
                if (tspan.node().getComputedTextLength() > width && currentLine.length > 1) {
                    currentLine = currentLine.slice(0, -1);
                    tspan.text(currentLine);
                    currentLine = chars[i];
                    tspan = text.append("tspan")
                        .attr("x", x) // Use original x for new line
                        .attr("y", y)
                        .attr("dy", ++lineNumber * lineHeight + dy + "em") // Relative dy for new line
                        .text(currentLine);
                }
            }
        } else { // 按单词分割
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > width && line.length > 1) {
                    line.pop(); 
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = text.append("tspan")
                        .attr("x", x) // Use original x for new line
                        .attr("y", y)
                        .attr("dy", ++lineNumber * lineHeight + dy + "em") // Relative dy for new line
                        .text(word);
                }
            }
        }
    }
    
    // 返回 SVG 节点
    return svg.node();
}