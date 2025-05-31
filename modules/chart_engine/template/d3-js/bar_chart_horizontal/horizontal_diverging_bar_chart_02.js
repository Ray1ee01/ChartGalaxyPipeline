/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Diverging Bar Chart",
    "chart_name": "horizontal_diverging_bar_chart_02",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], ["-inf", "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["positive", "negative"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
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

// 利率下降后行业表现的水平条形图实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                           // 完整的JSON数据对象
    const chartData = jsonData.data.data                 // 实际数据点数组  
    const variables = jsonData.variables || {};      // 图表配置
    const typography = jsonData.typography || {      // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "16px", font_weight: "500" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "16px", font_weight: "bold" }
    };
    const colors = jsonData.colors || { 
        text_color: "#FFFFFF",
        background_color: "#161032"
    };  // 颜色设置
    const images = jsonData.images || { field: {}, other: {} };   // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners !== undefined ? variables.has_rounded_corners : true;
    variables.has_shadow = variables.has_shadow !== undefined ? variables.has_shadow : false;
    variables.has_gradient = variables.has_gradient !== undefined ? variables.has_gradient : false;
    variables.has_stroke = variables.has_stroke !== undefined ? variables.has_stroke : false;
    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : false;
    
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
    
    // ---------- 2. 提取字段名和单位 ----------
    
    // 根据数据列角色（role）提取字段名
    // 查找类别字段（role = "x"）- 行业部门
    let sectorField = "sector"; // 默认值
    for (let i = 0; i < dataColumns.length; i++) {
        if (dataColumns[i].role === "x") {
            sectorField = dataColumns[i].name;
            break;
        }
    }
    
    // 查找数值字段（role = "y"）- 表现指标
    let performanceField = "performance"; // 默认值
    for (let i = 0; i < dataColumns.length; i++) {
        if (dataColumns[i].role === "y") {
            performanceField = dataColumns[i].name;
            break;
        }
    }
    
    // 获取字段单位（如果存在）
    let performanceUnit = "pp"; // 默认单位为百分点(percentage points)
    if (dataColumns.length > 1 && dataColumns[1].unit && dataColumns[1].unit !== "none") {
        performanceUnit = dataColumns[1].unit;
    }
    
    // ---------- 3. 数据处理 ----------
    
    // 将数据按表现值从大到小排序
    chartData.sort((a, b) => b[performanceField] - a[performanceField]);
    
    // 分离正负值
    const positiveData = chartData.filter(d => d[performanceField] >= 0);
    const negativeData = chartData.filter(d => d[performanceField] < 0);
    
    // 所有部门名称按排序后的顺序
    const sortedSectors = chartData.map(d => d[sectorField]);
    
    // ---------- 4. 计算初始值和比例尺 ----------
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 设置图表总尺寸
    const width = variables.width || 600;
    const height = variables.height || 600; // 确保有足够高度容纳所有条形
    
    // 计算条形的间距
    const barPadding = variables.has_spacing ? 0.2 : 0.1;
    
    // 计算最大正负值
    const maxPositiveValue = d3.max(positiveData, d => d[performanceField]) || 0;
    const minNegativeValue = d3.min(negativeData, d => d[performanceField]) || 0;
    
    // 确定较大的绝对值，用于对称比例尺
    const maxAbsValue = Math.max(Math.abs(maxPositiveValue), Math.abs(minNegativeValue)) * 1.1; // 添加10%边距
    
    // ---------- 5. 设置初始边距和临时绘图区域 ----------
    
    // 设置一个初始的边距
    const initialMargin = {
        top: 100,
        right: 30,
        bottom: 30,
        left: 160
    };
    
    // 计算初始绘图区域尺寸
    const initialInnerWidth = width - initialMargin.left - initialMargin.right;
    const initialInnerHeight = height - initialMargin.top - initialMargin.bottom;
    
    // 创建初始比例尺
    const initialYScale = d3.scaleBand()
        .domain(sortedSectors)
        .range([0, initialInnerHeight])
        .padding(barPadding);
    
    const initialXScale = d3.scaleLinear()
        .domain([minNegativeValue, maxPositiveValue])
        .range([0, initialInnerWidth]);
    
    const initialCenter = initialXScale(0);
    
    // ---------- 6. 计算动态边距 ----------
    
    // 创建临时SVG用于文本测量
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 图标尺寸和位置
    const iconSize = 24;
    
    // 计算部门标签所需的最大宽度
    let maxLabelWidth = 0;
    chartData.forEach(d => {
        const sector = d[sectorField];
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(sector);
        
        const width = tempText.node().getComputedTextLength();
        if (width > maxLabelWidth) {
            maxLabelWidth = width;
        }
        tempText.remove();
    });
    
    // 计算需要显示在条形外的负值标签所需的最大空间
    let maxNegativeLabelWidth = 0;
    negativeData.forEach(d => {
        const performance = d[performanceField];
        const formattedValue = `${formatValue(performance)}${performanceUnit}`;
        
        const tempText = tempSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .text(formattedValue);
        
        const width = tempText.node().getComputedTextLength();
        tempText.remove();
        
        // 使用初始比例尺计算
        const barWidth = initialCenter - initialXScale(performance);
        if (barWidth < width + 10) { // 如果标签需要显示在外部
            if (width > maxNegativeLabelWidth) {
                maxNegativeLabelWidth = width;
            }
        }
    });
    
    // 移除临时SVG
    tempSvg.remove();
    
    // 计算最佳左边距
    const iconMargin = 10;
    const iconTextSpacing = 10;
    const textBarSpacing = 20;
    const additionalSafetyMargin = 10;
    
    const calculatedLeftMargin = iconMargin + iconSize + iconTextSpacing + 
                             maxLabelWidth  + maxNegativeLabelWidth;
    
    // 确定最终边距
    const margin = {
        top: 100,
        right: 30,
        bottom: 30,
        left: Math.max(calculatedLeftMargin, 60) // 确保至少100px的左边距
    };
    
    // ---------- 7. 使用最终边距定义绘图区域和比例尺 ----------
    
    // 计算最终内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 创建最终比例尺
    const yScale = d3.scaleBand()
        .domain(sortedSectors)
        .range([0, innerHeight])
        .padding(barPadding);
    
    const xScale = d3.scaleLinear()
        .domain([minNegativeValue, maxPositiveValue])
        .range([0, innerWidth]);
    
    // 中心点位置（零点）
    const center = xScale(0);
    
    // ---------- 8. 创建SVG容器 ----------
    
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
    
    // 添加图标的定义（如果需要）
    if (images && images.field && images.field[sectorField]) {
        Object.entries(images.field[sectorField]).forEach(([key, imageData]) => {
            if (imageData.startsWith('data:')) {
                // 为图标创建图案
                defs.append("pattern")
                    .attr("id", `icon-${key.replace(/\s+/g, '-').toLowerCase()}`)
                    .attr("width", 1)
                    .attr("height", 1)
                    .attr("patternContentUnits", "objectBoundingBox")
                    .append("image")
                    .attr("xlink:href", imageData)
                    .attr("width", 1)
                    .attr("height", 1)  
                    .attr("preserveAspectRatio","xMidYMid meet");
            }
        });
    }
        
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
            .attr("dx", 2)
            .attr("dy", 2)
            .attr("result", "offsetblur");
        
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // 添加渐变（如果启用）
    if (variables.has_gradient) {
        // 正值渐变（绿色）
        const positiveGradient = defs.append("linearGradient")
            .attr("id", "positive-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
        
        const positiveColor = colors.other && colors.other.positive ? 
            colors.other.positive : 
            "#44c2a7"; // 默认绿色
        
        positiveGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(positiveColor).darker(0.2));
        
        positiveGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(positiveColor).brighter(0.2));
        
        // 负值渐变（红色）
        const negativeGradient = defs.append("linearGradient")
            .attr("id", "negative-gradient")
            .attr("x1", "100%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "0%");
        
        const negativeColor = colors.other && colors.other.negative ? 
            colors.other.negative : 
            "#c13030"; // 默认红色
        
        negativeGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(negativeColor).darker(0.2));
        
        negativeGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(negativeColor).brighter(0.2));
    }
    
    // ---------- 9. 获取颜色设置 ----------
    
    // 获取正负值条形颜色的辅助函数
    const getPositiveColor = () => {
        if (colors.other && colors.other.positive) return colors.other.positive;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#44c2a7"; // 默认绿色
    };
    
    const getNegativeColor = () => {
        if (colors.other && colors.other.negative) return colors.other.negative;
        if (colors.available_colors && colors.available_colors.length > 1) return colors.available_colors[1];
        return "#c13030"; // 默认红色
    };
    
    // ---------- 10. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 添加中心线（零线）
    g.append("line")
        .attr("x1", center)
        .attr("y1", 0)
        .attr("x2", center)
        .attr("y2", innerHeight)
        .attr("stroke", "#808080")
        .attr("stroke-width", 2)
        .style("opacity", 0.7);
    // 在创建完主图表组后（约在第10部分的结尾添加此代码）
    // 获取role为"y"的变量名称
    let yFieldName = "Percentage change in real house prices"; // 默认值

    // 从数据列中查找role为"y"的字段
    for (let i = 0; i < dataColumns.length; i++) {
        if (dataColumns[i].role === "y") {
            yFieldName = dataColumns[i].name;
            break;
        }
    }

    // 计算右半部分的宽度（从中心线到右边缘）
    const rightSideWidth = innerWidth - center;

    // 创建用于测量文本宽度的临时文本元素
    const tempTitleText = g.append("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .text(yFieldName)
        .attr("opacity", 0);

    // 获取文本宽度
    const titleTextWidth = tempTitleText.node().getComputedTextLength();
    tempTitleText.remove();

    // 决定是否需要分行显示
    const titlePadding = 10; // 标题两侧的内边距
    const needsMultipleLines = titleTextWidth > rightSideWidth;

    // 提取字体大小
    const fontSize = parseInt(typography.label.font_size);
    const lineHeight = fontSize * 1.0; // 行高

    // 计算行数并确定标题的垂直位置
    let lines = [];
    if (needsMultipleLines) {
        // 将标题文本分成单词
        const words = yFieldName.split(' ');
        let currentLine = words[0];
        
        // 尝试将单词组合成行，确保每行宽度不超过可用空间
        for (let i = 1; i < words.length; i++) {
            const testLine = currentLine + ' ' + words[i];
            const testLineText = g.append("text")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .text(testLine)
                .attr("opacity", 0);
            
            const testLineWidth = testLineText.node().getComputedTextLength();
            testLineText.remove();
            
            if (testLineWidth <= rightSideWidth ) {
                currentLine = testLine;
            } else {
                lines.push(currentLine);
                currentLine = words[i];
            }
        }
        
        // 添加最后一行
        lines.push(currentLine);
    }

    // 根据行数计算标题的垂直位置
    const lineCount = needsMultipleLines ? lines.length : 1;
    const titleY = -(lineCount * lineHeight); // 根据行数动态计算垂直位置

    // 绘制标题
    if (needsMultipleLines) {
        // 绘制多行标题，左侧与中心线对齐
        lines.forEach((line, i) => {
            g.append("text")
                .attr("x", center) // 左侧与中心线对齐
                .attr("y", titleY + (i * lineHeight))
                .attr("text-anchor", "start") // 左对齐
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#000000")
                .text(line);
        });
    } else {
        // 绘制单行标题，左侧与中心线对齐
        g.append("text")
            .attr("x", center) // 左侧与中心线对齐
            .attr("y", titleY)
            .attr("text-anchor", "start") // 左对齐
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color || "#000000")
            .text(yFieldName);
    }
    // ---------- 11. 绘制条形和标签 ----------
    
    // 为每个部门绘制条形、图标和标签
    chartData.forEach(d => {
        const sector = d[sectorField];
        const performance = d[performanceField];
        const barHeight = yScale.bandwidth();
        const y = yScale(sector);
        
        // 确定条形颜色：正值使用绿色，负值使用红色
        const barColor = performance >= 0 ? 
            (variables.has_gradient ? "url(#positive-gradient)" : getPositiveColor()) : 
            (variables.has_gradient ? "url(#negative-gradient)" : getNegativeColor());
        
        // 格式化数值标签（添加加号或保留负号，添加单位）
        const formattedValue = performance >= 0 ? 
            `+${formatValue(performance)}${performanceUnit}` : 
            `${formatValue(performance)}${performanceUnit}`;
        
        // 横条开始位置和宽度
        let barX, barWidth;
        
        if (performance >= 0) {
            // 正值条形向右延伸
            barX = center;
            barWidth = xScale(performance) - center;
        } else {
            // 负值条形向左延伸
            barWidth = center - xScale(performance);
            barX = center - barWidth;
        }
        
        // 绘制条形
        if (variables.has_rounded_corners) {
            // 使用路径绘制具有选择性圆角的条形
            const radius = 6; // 圆角半径
            
            if (performance >= 0) {
                // 正值条形：只在右侧有圆角
                const path = [
                    `M ${barX},${y}`, // 左上角起点
                    `L ${barX + barWidth - radius},${y}`, // 到右上角圆角起点
                    `Q ${barX + barWidth},${y} ${barX + barWidth},${y + radius}`, // 右上角圆角
                    `L ${barX + barWidth},${y + barHeight - radius}`, // 到右下角圆角起点
                    `Q ${barX + barWidth},${y + barHeight} ${barX + barWidth - radius},${y + barHeight}`, // 右下角圆角
                    `L ${barX},${y + barHeight}`, // 到左下角
                    `Z` // 闭合路径
                ].join(' ');
                
                g.append("path")
                    .attr("d", path)
                    .attr("fill", barColor)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            } else {
                // 负值条形：只在左侧有圆角
                const path = [
                    `M ${barX + radius},${y}`, // 左上角圆角起点
                    `Q ${barX},${y} ${barX},${y + radius}`, // 左上角圆角
                    `L ${barX},${y + barHeight - radius}`, // 到左下角圆角起点
                    `Q ${barX},${y + barHeight} ${barX + radius},${y + barHeight}`, // 左下角圆角
                    `L ${barX + barWidth},${y + barHeight}`, // 到右下角
                    `L ${barX + barWidth},${y}`, // 到右上角
                    `Z` // 闭合路径
                ].join(' ');
                
                g.append("path")
                    .attr("d", path)
                    .attr("fill", barColor)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            }
        } else {
            // 没有圆角时使用普通矩形
            g.append("rect")
                .attr("x", barX)
                .attr("y", y)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", barColor)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
        }
        
        // 绘制图标（如果有）
        // 首先绘制与条形同色的圆角矩形作为背景
        g.append("rect")
            .attr("x", -margin.left + 20) // 图标位于左侧边距区域
            .attr("y", y + (barHeight - iconSize) / 2)
            .attr("width", iconSize)
            .attr("height", iconSize)
            .attr("fill", barColor) // 使用与条形相同的颜色
            .attr("rx", 4) // 圆角
            .attr("ry", 4);
        
        // 如果有自定义图标，在圆角矩形上绘制图标
        if (images && images.field && images.field[sector]) {
            // 计算图标应该稍小于背景，以便在背景内显示
            const iconPadding = 4; // 四周留出的空间
            g.append("image")
                .attr("x", -margin.left + 20 + iconPadding/2) // 添加一些内边距
                .attr("y", y + (barHeight - iconSize) / 2 + iconPadding/2)
                .attr("width", iconSize - iconPadding) // 图标略小于背景
                .attr("height", iconSize - iconPadding)
                .attr("xlink:href", images.field[sector])
                .attr("preserveAspectRatio","xMidYMid meet");
        }
        
        // 绘制部门标签
        g.append("text")
            .attr("x", -margin.left + iconSize + 30) // 标签位于图标右侧
            .attr("y", y + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color || "#FFFFFF")
            .text(sector);
        
        // 绘制数值标签 - 判断是否有足够空间在条形内放置标签
        // 首先创建一个临时文本元素来计算文本宽度
        const tempText = g.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", `${barHeight * 0.5}px`)  // 调整为条形高度的50%
            .style("font-weight", typography.annotation.font_weight)
            .text(formattedValue)
            .attr("opacity", 0); // 隐藏临时元素
        
        // 获取文本宽度
        const textWidth = tempText.node().getComputedTextLength();
        tempText.remove(); // 删除临时元素
        
        // 检查条形宽度是否足够容纳文本（添加一些padding）
        const textPadding = 3; // 文本与条形边缘的间距
        const canFitInside = barWidth > (textWidth + textPadding);
        
        // 确定文本位置和对齐方式
        let textX, textAnchor;
        
        if (performance >= 0) { // 正值条形
            if (canFitInside) {
                // 如果能放在条形内，则放在条形内部靠右侧
                textX = barX + barWidth - textPadding;
                textAnchor = "end";
            } else {
                // 如果不能放在条形内，则放在条形外部靠右侧
                textX = barX + barWidth + textPadding;
                textAnchor = "start";
            }
        } else { // 负值条形
            if (canFitInside) {
                // 如果能放在条形内，则放在条形内部靠左侧
                textX = barX + textPadding;
                textAnchor = "start";
            } else {
                // 如果不能放在条形内，则放在条形外部靠左侧
                textX = barX - textPadding;
                textAnchor = "end";
                
                // 检查是否与部门标签重叠
                const labelLeftEdge = textX - textWidth;
                const sectorLabelRightEdge = -margin.left + iconSize + 30 + maxLabelWidth;
                
                // 如果负值标签会与部门标签重叠，调整位置
                if (labelLeftEdge < sectorLabelRightEdge) {
                    // 如果条形宽度足够容纳部分文本，放在条形内
                    if (barWidth > textWidth * 0.7) {
                        textX = barX + textPadding;
                        textAnchor = "start";
                    } else {
                        // 否则放在条形下方或上方
                        textX = barX + barWidth / 2;
                        textAnchor = "middle";
                    }
                }
            }
        }
        
        // 绘制数值标签
        g.append("text")
            .attr("x", textX)
            .attr("y", y + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", textAnchor)
            .style("font-family", typography.annotation.font_family)
            .style("font-size", `${barHeight * 0.5}px`)  // 调整为条形高度的50%
            .style("font-weight", typography.annotation.font_weight)
            .style("fill", canFitInside ? "#FFFFFF" : (colors.text_color || "#000000"))
            .text(formattedValue);
    });
    
    // ---------- 12. 添加图表标题 ----------
    
    // 图表标题由外部处理，这里不添加
    
    // 返回SVG节点
    return svg.node();
}