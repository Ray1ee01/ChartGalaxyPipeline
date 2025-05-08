/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Diverging Bar Chart",
    "chart_name": "horizontal_diverging_bar_chart_07",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "styled",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 水平对比型条形图实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data                // 实际数据点数组
    const variables = jsonData.variables || {};     // 图表配置，如果不存在则使用空对象
    const typography = jsonData.typography || {     // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置，如果不存在则使用默认值
    const images = jsonData.images || { field: {}, other: {} };  // 图像(国旗等)
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 检查并设置缺失的视觉效果变量，确保不会因为缺少变量而出错
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
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
    
    // 清空容器 - 在添加新图表前移除可能存在的内容
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸和边距
    const width = variables.width;                  // 图表总宽度
    const height = variables.height;                // 图表总高度
    // 边距：top-顶部，right-右侧，bottom-底部，left-左侧
    const margin = { top: 100, right: 10, bottom: 40, left: 10 };
    
    // 计算实际绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;    // 绘图区宽度
    const innerHeight = height - margin.top - margin.bottom;  // 绘图区高度
    
    // 设置各部分位置参数
    const centerX = margin.left + innerWidth / 2;   // 图表中心X坐标
    const topAreaHeight = 60;                       // 标题和标签区域高度
    
    // ---------- 3. 提取字段名和单位 ----------
    // 根据数据列顺序提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    const groupField = dataColumns.find(col => col.role === "group").name;
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; // 默认为百分比
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
    
    // ---------- 辅助函数：获取文本宽度 ----------
    function getTextWidth(text, fontFamily, fontSize, fontWeight) {
        // 创建临时SVG元素来测量文本宽度
        const tempText = d3.select(containerSelector)
            .append("svg")
            .attr("width", 0)
            .attr("height", 0)
            .style("visibility", "hidden")
            .append("text")
            .style("font-family", fontFamily)
            .style("font-size", fontSize)
            .style("font-weight", fontWeight)
            .text(text);
        
        const width = tempText.node().getBBox().width;
        tempText.remove();
        return width;
    }
    
    // 添加文本换行函数
    function wrapText(text, maxWidth, fontFamily, fontSize, fontWeight) {
        // 如果文本不需要换行，直接返回
        const textWidth = getTextWidth(text, fontFamily, fontSize, fontWeight);
        if (textWidth <= maxWidth) {
            return [text];
        }
        
        // 分割文本为词语数组
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = words[0];
        
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = getTextWidth(currentLine + " " + word, fontFamily, fontSize, fontWeight);
            
            if (width <= maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        
        // 添加最后一行
        lines.push(currentLine);
        
        // 如果没有空格分隔词（如中文），则按字符分割
        if (lines.length === 1 && getTextWidth(lines[0], fontFamily, fontSize, fontWeight) > maxWidth) {
            const chars = text.split('');
            lines.length = 0;
            currentLine = chars[0];
            
            for (let i = 1; i < chars.length; i++) {
                const char = chars[i];
                const width = getTextWidth(currentLine + char, fontFamily, fontSize, fontWeight);
                
                if (width <= maxWidth) {
                    currentLine += char;
                } else {
                    lines.push(currentLine);
                    currentLine = char;
                }
            }
            
            // 添加最后一行
            lines.push(currentLine);
        }
        
        return lines;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值和分组值
    const allDimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 不对维度进行排序，直接使用原始顺序
    const dimensions = [...allDimensions];
    
    // 使用前两个分组作为左右两侧显示数据
    const leftGroup = groups[0];   // 左侧分组
    const rightGroup = groups[1];  // 右侧分组
    
    // ---------- 5. 动态计算标签区域宽度 ----------
    
    // 创建临时SVG容器用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 计算最大维度标签宽度
    let maxLabelWidth = 0;
    dimensions.forEach(dimension => {
        // 格式化维度名称（附加单位，如果有）
        const formattedDimension = dimensionUnit ? 
            `${dimension}${dimensionUnit}` : 
            `${dimension}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
        
        const textWidth = tempText.node().getBBox().width;
        const totalWidth = textWidth + 5;
        
        maxLabelWidth = Math.max(maxLabelWidth, totalWidth);
        
        tempText.remove();
    });
    
    // 计算最大数值标签宽度 - 左侧和右侧
    let maxLeftValueWidth = 0;
    let maxRightValueWidth = 0;
    
    // 计算最大值，用于生成最长的可能标签
    const maxLeftValue = d3.max(chartData.filter(d => d[groupField] === leftGroup), d => d[valueField]);
    const maxRightValue = d3.max(chartData.filter(d => d[groupField] === rightGroup), d => d[valueField]);

    // 为每个数据点计算标签宽度
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
        
        if (d[groupField] === leftGroup) {
            maxLeftValueWidth = Math.max(maxLeftValueWidth, textWidth);
        } else if (d[groupField] === rightGroup) {
            maxRightValueWidth = Math.max(maxRightValueWidth, textWidth);
        }
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 为计算出的宽度添加边距，确保有足够空间
    const dimensionLabelWidth = Math.max(maxLabelWidth + 5, 80);  // 最小值为80像素
    
    // 为左右两侧的值标签预留空间
    const labelPadding = 5; // 标签与条形图之间的间距
    const leftValueLabelPadding = maxLeftValueWidth + labelPadding;   // 左侧值标签空间
    const rightValueLabelPadding = maxRightValueWidth + labelPadding; // 右侧值标签空间
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // ---------- 6.1 创建视觉效果 ----------
    
    const defs = svg.append("defs");
    
    const getColor = (group) => {
        return colors.field && colors.field[group] ? colors.field[group] : colors.other.primary;
    };
    
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("width", "200%")
            .attr("height", "200%");
        
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 4);
        
        filter.append("feOffset")
            .attr("dx", 4)
            .attr("dy", 4)
            .attr("result", "offsetblur");
        
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    if (variables.has_gradient) {
        const leftGradientId = `gradient-${leftGroup.replace(/\s+/g, '-').toLowerCase()}`;
        const leftBaseColor = getColor(leftGroup);
        
        const leftGradient = defs.append("linearGradient")
            .attr("id", leftGradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
        
        leftGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(leftBaseColor).brighter(1.2));
        
        leftGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(leftBaseColor).darker(0.7));
        
        const rightGradientId = `gradient-${rightGroup.replace(/\s+/g, '-').toLowerCase()}`;
        const rightBaseColor = getColor(rightGroup);
        
        const rightGradient = defs.append("linearGradient")
            .attr("id", rightGradientId)
            .attr("x1", "100%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "0%");
        
        rightGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(rightBaseColor).brighter(1.2));
        
        rightGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(rightBaseColor).darker(0.7));
    }

    // ---------- 7. 添加左右组标签 ----------
    
    // 格式化组标签
    const formattedLeftGroup = groupUnit ? `${leftGroup}${groupUnit}` : `${leftGroup}`;
    const formattedRightGroup = groupUnit ? `${rightGroup}${groupUnit}` : `${rightGroup}`;
    
    // 计算左侧标签区域宽度 - 从左边缘到左侧条形的右边缘
    const leftLabelMaxWidth = innerWidth / 2 - dimensionLabelWidth / 2 + 40;
    
    // 计算右侧标签区域宽度 - 从右侧条形的左边缘到右边缘
    const rightLabelMaxWidth = innerWidth / 2 - dimensionLabelWidth / 2 + 40;
    
    // 计算左侧标签的文本行
    const leftLines = wrapText(
        formattedLeftGroup, 
        leftLabelMaxWidth, 
        typography.label.font_family, 
        typography.label.font_size, 
        typography.label.font_weight
    );
    
    // 计算右侧标签的文本行
    const rightLines = wrapText(
        formattedRightGroup, 
        rightLabelMaxWidth, 
        typography.label.font_family, 
        typography.label.font_size, 
        typography.label.font_weight
    );
    
    // 计算行高 (基于字体大小的近似值)
    const fontSize = parseInt(typography.label.font_size);
    const lineHeight = fontSize * 1.2;
    
    // 调整标签垂直位置，考虑到多行文本
    const leftLabelHeight = leftLines.length * lineHeight;
    const rightLabelHeight = rightLines.length * lineHeight;
    
    // 为了垂直居中，我们需要考虑到标签的高度
    const leftLabelYOffset = margin.top + 10 - leftLabelHeight ; 
    const rightLabelYOffset = margin.top + 10 - rightLabelHeight ;
    
    // 左侧组标签组 - 位置从左边缘开始，左对齐
    const leftLabelGroup = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${leftLabelYOffset})`);
    
    // 绘制左侧标签的每一行
    leftLines.forEach((line, i) => {
        leftLabelGroup.append("text")
            .attr("x", 0)
            .attr("y", i * lineHeight)
            .attr("text-anchor", "start")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(line);
    });
    
    // 计算右侧条形的起始位置
    const rightBarStartX = margin.left + innerWidth / 2 + dimensionLabelWidth / 2;
    
    // 右侧组标签组 - 位置从右侧条形的左边缘开始，左对齐
    const rightLabelGroup = svg.append("g")
        .attr("transform", `translate(${rightBarStartX}, ${rightLabelYOffset})`);
    
    // 绘制右侧标签的每一行
    rightLines.forEach((line, i) => {
        rightLabelGroup.append("text")
            .attr("x", 0)
            .attr("y", i * lineHeight)
            .attr("text-anchor", "start")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(line);
    });
    
    // ---------- 8. 创建绘图组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // ---------- 9. 创建比例尺 ----------
    
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(variables.has_spacing ? 0.4 : 0.3);
    
    // 确保为标签预留足够空间
    const availableLeftWidth = innerWidth / 2 - dimensionLabelWidth / 2;
    const availableRightWidth = innerWidth / 2 - dimensionLabelWidth / 2;
    
    // 使用相同的全局最大值，确保左右比例尺一致
    const globalMaxValue = Math.max(maxLeftValue, maxRightValue);
    
    // 计算标签安全空间 - 比标签宽度多一点余量
    const leftLabelSafeSpace = leftValueLabelPadding + 15; // 增加额外安全边距
    const rightLabelSafeSpace = rightValueLabelPadding + 15; // 增加额外安全边距
    
    // 确保可用绘图空间
    const leftAvailableDrawSpace = Math.max(0, availableLeftWidth - leftLabelSafeSpace);
    const rightAvailableDrawSpace = Math.max(0, availableRightWidth - rightLabelSafeSpace);
    
    // 找出两侧中较小的可用空间，确保左右比例尺一致
    const consistentAvailableSpace = Math.min(leftAvailableDrawSpace, rightAvailableDrawSpace);
    
    // 修改左右比例尺使用相同的比例
    const leftXScale = d3.scaleLinear()
        .domain([0, globalMaxValue])
        .range([innerWidth / 2 - dimensionLabelWidth / 2, innerWidth / 2 - dimensionLabelWidth / 2 - consistentAvailableSpace]); 
    
    const rightXScale = d3.scaleLinear()
        .domain([0, globalMaxValue])
        .range([0, consistentAvailableSpace]);
    
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333";
    };
    const strokeColor = getStrokeColor();
    
    // ---------- 9. 添加交替行背景 ----------
    if (jsonData.variation?.background === "styled") {
        // 获取左右两侧组的基础颜色
        const leftBaseColor = getColor(leftGroup);
        const rightBaseColor = getColor(rightGroup);
        
        // 创建左右两侧背景的渐变
        const leftBgGradientId = "left-bg-gradient";
        const rightBgGradientId = "right-bg-gradient";
        
        // 创建左侧背景渐变 - 从淡蓝色到接近白色
        const leftBgGradient = defs.append("linearGradient")
            .attr("id", leftBgGradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
        
        leftBgGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(leftBaseColor).brighter(0.5));
        
        leftBgGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(leftBaseColor).brighter(3.0));
        
        // 创建右侧背景渐变 - 从淡红色到接近白色
        const rightBgGradient = defs.append("linearGradient")
            .attr("id", rightBgGradientId)
            .attr("x1", "100%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "0%");
        
        rightBgGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(rightBaseColor).brighter(0.5));
        
        rightBgGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(rightBaseColor).brighter(3.0));
        
        // 使用与yScale相同的padding值来计算额外间距
        const paddingValue = variables.has_spacing ? 0.4 : 0.3;
        // 计算每个条形之间的间距像素值
        const step = innerHeight / dimensions.length;
        // 额外内边距 = 条形之间间距的一半
        const extraPadding = (step * paddingValue) / 2;
        // 中心位置
        const centerX = innerWidth / 2;
        
        dimensions.forEach((dimension, i) => {
            if (i % 2 === 0) {
                // 左侧背景
                g.append("rect")
                    .attr("x", -margin.left/2)
                    .attr("y", yScale(dimension) - extraPadding)
                    .attr("width", centerX + margin.left/2)
                    .attr("height", yScale.bandwidth() + (extraPadding * 2))
                    .attr("class", "background")
                    .attr("fill", `url(#${leftBgGradientId})`)
                    .attr("opacity", 0.3);
                
                // 右侧背景
                g.append("rect")
                    .attr("x", centerX)
                    .attr("y", yScale(dimension) - extraPadding)
                    .attr("width", centerX + margin.right/2)
                    .attr("height", yScale.bandwidth() + (extraPadding * 2))
                    .attr("class", "background")
                    .attr("fill", `url(#${rightBgGradientId})`)
                    .attr("opacity", 0.3);
            }
        });
    }
    
    // ---------- 10. 绘制维度标签和图标 ----------
    
    dimensions.forEach(dimension => {
        const yPos = yScale(dimension) + yScale.bandwidth() / 2;
        
        const formattedDimension = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        
        const tempText = g.append("text")
            .attr("font-family", typography.label.font_family)
            .attr("font-size", typography.label.font_size)
            .attr("font-weight", typography.label.font_weight)
            .style("visibility", "hidden")
            .text(formattedDimension);
        
        const textWidth = tempText.node().getBBox().width;
        tempText.remove();
        
        // If not showing icons, center the text only
        const startX = innerWidth/2;
        
        // Add centered text without icon
        g.append("text")
            .attr("x", startX)
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("fill", colors.text_color)
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
        
    });

    // ---------- 计算标签位置 ----------
    
    // 计算标签位置 - 确保足够远离条形图
    const leftLabelX = margin.left + leftLabelSafeSpace / 2; // 左侧固定位置
    
    // 右侧标签位置 - 使用固定位置，不依赖于条形长度
    const rightBarEndX = margin.left + innerWidth / 2 + dimensionLabelWidth / 2 + consistentAvailableSpace;
    const rightLabelX = width - margin.right - rightLabelSafeSpace / 2; // 右侧固定位置 - 与边缘保持一定距离
    
    // ---------- 11. 绘制左侧条形图 ----------
    
    // 为每个维度绘制左侧条形
    dimensions.forEach(dimension => {
        // 查找数据点
        const dataPoint = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === leftGroup
        );
        
        if (dataPoint) {
            // 确保条形图不会超出预留给标签的空间
            const maxAllowedWidth = innerWidth / 2 - dimensionLabelWidth / 2 - leftLabelSafeSpace;
            
            // 计算条形的理论宽度
            const theoreticalBarWidth = innerWidth / 2 - dimensionLabelWidth / 2 - leftXScale(dataPoint[valueField]);
            
            // 确保不超出预留空间
            const barWidth = Math.min(theoreticalBarWidth, maxAllowedWidth);
            
            // Y位置
            const yPos = yScale(dimension);
            
            // 绘制条形
            g.append("rect")
                .attr("x", Math.max(leftXScale(dataPoint[valueField]), leftLabelSafeSpace)) // 确保不会遮挡标签
                .attr("y", yPos)
                .attr("width", barWidth)
                .attr("height", yScale.bandwidth())
                .attr("fill", variables.has_gradient ?
                    `url(#gradient-${leftGroup.replace(/\s+/g, '-').toLowerCase()})` :
                    getColor(leftGroup)
                )
                .attr("rx", variables.has_rounded_corners ? 4 : 0) // 圆角半径(如果启用)
                .attr("ry", variables.has_rounded_corners ? 4 : 0)
                .style("stroke", variables.has_stroke ? strokeColor : "none") // 边框
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none") // 阴影
                .on("mouseover", function(event, d) {
                    d3.select(this)
                      .transition()
                      .duration(100)
                      .attr("opacity", 0.8);
                })
                .on("mouseout", function(event, d) {
                    d3.select(this)
                      .transition()
                      .duration(100)
                      .attr("opacity", 1);
                });
            
            // 绘制数值标签（附加单位，如果有）
            const formattedValue = valueUnit ? 
            `${formatValue(dataPoint[valueField])}${valueUnit}` : 
            `${formatValue(dataPoint[valueField])}`;
            const barHeight = yScale.bandwidth();
            // 绘制左侧标签 - 使用统一的位置和右对齐
            g.append("text")
                .attr("class", "label")
                .attr("x", leftLabelX) // 使用统一的最左侧位置
                .attr("y", yPos + yScale.bandwidth()/2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end") // 右对齐文本
                .style("fill", colors.text_color)
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("pointer-events", "none")
                .text(formattedValue);
        }
    });
    
    // ---------- 12. 绘制右侧条形图 ----------
    
    // 为每个维度绘制右侧条形
    dimensions.forEach(dimension => {
        // 查找数据点
        const dataPoint = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === rightGroup
        );
        
        if (dataPoint) {
            // 确保条形图宽度不会超过可用空间
            const maxAllowedWidth = consistentAvailableSpace;
            
            // 计算条形理论宽度
            const theoreticalBarWidth = rightXScale(dataPoint[valueField]);
            
            // 确保不超出预留空间
            const barWidth = Math.min(theoreticalBarWidth, maxAllowedWidth);
            
            // Y位置
            const yPos = yScale(dimension);
            
            // 条形的左边界位置
            const barLeft = innerWidth / 2 + dimensionLabelWidth / 2;
            
            // 绘制条形 - 应用与左侧相同的视觉效果
            g.append("rect")
                .attr("x", barLeft) // 从中间右侧开始
                .attr("y", yPos)
                .attr("width", barWidth)
                .attr("height", yScale.bandwidth())
                .attr("fill", variables.has_gradient ?
                    `url(#gradient-${rightGroup.replace(/\s+/g, '-').toLowerCase()})` :
                    getColor(rightGroup)
                )
                .attr("rx", variables.has_rounded_corners ? 4 : 0) // 圆角半径(如果启用)
                .attr("ry", variables.has_rounded_corners ? 4 : 0)
                .style("stroke", variables.has_stroke ? strokeColor : "none") // 边框
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none") // 阴影
                .on("mouseover", function(event, d) {
                    d3.select(this)
                      .transition()
                      .duration(100)
                      .attr("opacity", 0.8);
                })
                .on("mouseout", function(event, d) {
                    d3.select(this)
                      .transition()
                      .duration(100)
                      .attr("opacity", 1);
                });
            
            // 绘制数值标签（附加单位，如果有）
            const formattedValue = valueUnit ? 
            `${formatValue(dataPoint[valueField])}${valueUnit}` : 
            `${formatValue(dataPoint[valueField])}`;
            const barHeight = yScale.bandwidth();
                
            // 绘制右侧标签 - 使用统一的位置和左对齐
            g.append("text")
                .attr("class", "label")
                .attr("x", rightLabelX) // 使用统一的最右侧位置
                .attr("y", yPos + yScale.bandwidth()/2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end") // 左对齐文本
                .style("fill", colors.text_color)
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("pointer-events", "none")
                .text(formattedValue);
        }
    });

    // 返回SVG节点
    return svg.node();
}