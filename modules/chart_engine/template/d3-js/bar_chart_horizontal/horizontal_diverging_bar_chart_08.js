/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Diverging Bar Chart",
    "chart_name": "horizontal_diverging_bar_chart_08",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
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

// 水平对比型条形图实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // 辅助函数：获取文本宽度
    function getTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = d3.select(containerSelector)
            .append("svg")
            .attr("width", 0)
            .attr("height", 0)
            .style("visibility", "hidden");
            
        const tempText = tempSvg.append("text")
            .style("font-family", fontFamily)
            .style("font-size", fontSize)
            .style("font-weight", fontWeight)
            .text(text);
        
        const width = tempText.node().getBBox().width;
        tempSvg.remove();
        return width;
    }
    
    // 添加文本换行函数
    function wrapText(text, maxWidth, fontFamily, fontSize, fontWeight) {
        // 如果宽度无效，直接返回原文本
        if (maxWidth <= 10) return [text];
        
        // 如果文本不需要换行，直接返回
        const textWidth = getTextWidth(text, fontFamily, fontSize, fontWeight);
        if (textWidth <= maxWidth) {
            return [text];
        }
        
        // 分割文本为词语数组
        const words = text.split(/\s+/);
        if (words.length <= 1) {
            // 如果只有一个词或没有空格，按字符分割
            const chars = text.split('');
            const lines = [];
            let currentLine = chars[0] || '';
            
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
            
            if (currentLine) lines.push(currentLine);
            return lines.length > 0 ? lines : [text];
        } else {
            // 多个词的情况
            const lines = [];
            let currentLine = words[0] || '';
            
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
            
            if (currentLine) lines.push(currentLine);
            return lines.length > 0 ? lines : [text];
        }
    }

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
    const width = variables.width || 800;                  // 图表总宽度，默认值为800
    const height = variables.height || 600;                // 图表总高度，默认值为600
    // 边距：top-顶部，right-右侧，bottom-底部，left-左侧
    const margin = { top: 100, right: 70, bottom: 40, left: 70 };
    
    // 计算实际绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;    // 绘图区宽度
    const innerHeight = height - margin.top - margin.bottom;  // 绘图区高度
    
    // 设置各部分位置参数
    const centerX = margin.left + innerWidth / 2;   // 图表中心X坐标
    const topAreaHeight = 60;                       // 标题和标签区域高度
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    let dimensionField = '', valueField = '', groupField = '';
    
    try {
        dimensionField = dataColumns.find(col => col.role === "x").name;
        valueField = dataColumns.find(col => col.role === "y").name;
        groupField = dataColumns.find(col => col.role === "group").name;
    } catch (error) {
        console.error("数据列定义有误", error);
        // 使用默认值防止出错
        dimensionField = dimensionField || "country";
        valueField = valueField || "value";
        groupField = groupField || "group";
    }
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; 
    let groupUnit = "";
    
    try {
        if (dataColumns.find(col => col.role === "x") && 
            dataColumns.find(col => col.role === "x").unit !== "none") {
            dimensionUnit = dataColumns.find(col => col.role === "x").unit;
        }
        
        if (dataColumns.find(col => col.role === "y") && 
            dataColumns.find(col => col.role === "y").unit !== "none") {
            valueUnit = dataColumns.find(col => col.role === "y").unit;
        }
        
        if (dataColumns.find(col => col.role === "group") && 
            dataColumns.find(col => col.role === "group").unit !== "none") {
            groupUnit = dataColumns.find(col => col.role === "group").unit; 
        }
    } catch (error) {
        console.error("获取单位时出错", error);
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值和分组值
    const allDimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 确保至少有两个分组，否则无法绘制对比图
    if (groups.length < 2) {
        console.error("需要至少两个分组才能绘制对比图");
        return;
    }
    
    // 使用前两个分组作为左右两侧显示数据
    const leftGroup = groups[0];   // 左侧分组
    const rightGroup = groups[1];  // 右侧分组
    
    // 按照第一组（左侧）数值从大到小排序
    let dimensions;
    try {
        dimensions = [...allDimensions].sort((a, b) => {
            const aData = chartData.find(d => d[dimensionField] === a && d[groupField] === leftGroup);
            const bData = chartData.find(d => d[dimensionField] === b && d[groupField] === leftGroup);
            const aValue = aData ? parseFloat(aData[valueField]) || 0 : 0;
            const bValue = bData ? parseFloat(bData[valueField]) || 0 : 0;
            return bValue - aValue; // 从大到小排序
        });
    } catch (error) {
        console.error("排序出错", error);
        dimensions = [...allDimensions]; // 错误时使用原始顺序
    }
    
    // ---------- 5. 计算标签空间 ----------
    
    // 创建临时SVG容器用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");

    // 检查是否应该显示图标
    const showIcons = jsonData.variation && jsonData.variation.axis_label === "side";
    
    // 标志尺寸
    const flagWidth = 20;
    const flagHeight = 15;
    const flagPadding = 5;
    
    // 计算最大维度标签宽度
    let maxLabelWidth = 0;
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
        const totalWidth =  textWidth + 10;
        
        maxLabelWidth = Math.max(maxLabelWidth, totalWidth);
        
        tempText.remove();
    });
    
    // 计算值标签宽度
    let maxLeftValueWidth = 0;
    let maxRightValueWidth = 0;
    
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
            maxLeftValueWidth = Math.max(maxLeftValueWidth, textWidth + 10);
        } else if (d[groupField] === rightGroup) {
            maxRightValueWidth = Math.max(maxRightValueWidth, textWidth + 10);
        }
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 为计算出的宽度添加边距，确保有足够空间
    const dimensionLabelWidth = Math.max(maxLabelWidth , 60);  // 最小值为80像素
    
    // 为左右两侧的值标签预留空间
    const leftValueLabelPadding = maxLeftValueWidth + 5;   // 左侧值标签空间
    const rightValueLabelPadding = maxRightValueWidth + 5; // 右侧值标签空间
    
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
    
    // 左侧组标签 - 右对齐到左侧bar的右边缘
    const formattedLeftGroup = groupUnit ? `${leftGroup}${groupUnit}` : `${leftGroup}`;
    
    // 左侧bar的右边缘位置
    const leftBarRightEdge = margin.left + innerWidth / 2 - dimensionLabelWidth/2;
    
    // 添加左侧组标签
    svg.append("text")
        .attr("x", leftBarRightEdge)
        .attr("y", margin.top - 10)
        .attr("text-anchor", "end")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(formattedLeftGroup);
    
    // 右侧组标签 - 左对齐到右侧bar的左边缘
    const formattedRightGroup = groupUnit ? `${rightGroup}${groupUnit}` : `${rightGroup}`;
    
    // 右侧bar的左边缘位置
    const rightBarLeftEdge = margin.left + innerWidth/2 + dimensionLabelWidth/2;
    
    // 添加右侧组标签
    svg.append("text")
        .attr("x", rightBarLeftEdge)
        .attr("y", margin.top - 10)
        .attr("text-anchor", "start")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(formattedRightGroup);
    
    // ---------- 8. 创建绘图组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // ---------- 9. 创建比例尺 ----------
    
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(variables.has_spacing ? 0.4 : 0.3);
    
    // 计算两边的最大值，添加错误处理
    let maxLeftValue = 0;
    let maxRightValue = 0;
    
    try {
        maxLeftValue = d3.max(chartData.filter(d => d[groupField] === leftGroup), 
                             d => parseFloat(d[valueField])) || 0;
        maxRightValue = d3.max(chartData.filter(d => d[groupField] === rightGroup), 
                              d => parseFloat(d[valueField])) || 0;
    } catch (error) {
        console.error("计算最大值时出错", error);
        maxLeftValue = 100;
        maxRightValue = 100;
    }
    
    // 使用两边的最大值中的较大者，添加安全检查
    let maxValue = Math.max(maxLeftValue, maxRightValue);
    if (!isFinite(maxValue) || maxValue <= 0) maxValue = 100; // 默认值为100
    
    // 使用相同的域值范围创建比例尺
    const leftXScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([innerWidth / 2 - dimensionLabelWidth/2, 0]);
    
    const rightXScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, innerWidth / 2 - dimensionLabelWidth/2]);
    
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333";
    };
    const strokeColor = getStrokeColor();
    
    // ---------- 10. 添加交替行背景 ----------
    if (jsonData.variation && jsonData.variation.background === "styled") {
        // 使用与yScale相同的padding值来计算额外间距
        const paddingValue = variables.has_spacing ? 0.4 : 0.3;
        // 计算每个条形之间的间距像素值
        const step = innerHeight / dimensions.length;
        // 额外内边距 = 条形之间间距的一半
        const extraPadding = (step * paddingValue) / 2;
        
        dimensions.forEach((dimension, i) => {
            if (i % 2 === 0) {
                g.append("rect")
                    .attr("x", -margin.left/2)
                    .attr("y", yScale(dimension) - extraPadding) // 上移一段距离
                    .attr("width", innerWidth + margin.left/2 + margin.right/2)
                    .attr("height", yScale.bandwidth() + (extraPadding * 2)) // 增加高度
                    .attr("class","background")
                    .attr("fill", "#f5f5f5")
                    .attr("opacity", 0.8);
            }
        });
    }
    
    // ---------- 11. 绘制维度标签和图标 ----------
    
    dimensions.forEach(dimension => {
        const yPos = yScale(dimension) + yScale.bandwidth() / 2;
        
        const formattedDimension = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        
        if (showIcons) {
            // 在文本下方添加图标，而不是左边
            const textWidth = getTextWidth(
                formattedDimension, 
                typography.label.font_family, 
                typography.label.font_size, 
                typography.label.font_weight
            );
            
            // 文本和图标都居中对齐
            const centerX = innerWidth/2;
            
            // 添加居中对齐的文本
            g.append("text")
                .attr("x", centerX)
                .attr("y", yPos - flagHeight/2) // 上移文本，为图标留出空间
                .attr("dy", "0em")
                .attr("text-anchor", "middle")
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .text(formattedDimension);
            
            // 添加图标（如果存在）在文本下方
            if (images.field && images.field[dimension]) {
                g.append("image")
                    .attr("x", centerX - flagWidth/2) // 水平居中
                    .attr("y", yPos + 2) // 文本下方
                    .attr("width", flagWidth)
                    .attr("height", flagHeight)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", images.field[dimension]);
            }
        } else {
            // 不显示图标，只居中显示文本
            const startX = innerWidth/2;
            
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
        }
    });
    
    // ---------- 12. 绘制左侧条形图 ----------
    
    dimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === leftGroup
        );
        
        if (dataPoint) {
            // 解析数值，确保为数字
            const value = parseFloat(dataPoint[valueField]) || 0;
            
            // 计算条形图位置和尺寸
            const barWidth = innerWidth/2 - dimensionLabelWidth/2 - leftXScale(value);
            const yPos = yScale(dimension);
            const xPos = leftXScale(value);
            const barHeight = yScale.bandwidth();
            
            // 绘制普通矩形
            g.append("rect")
                .attr("x", xPos)
                .attr("y", yPos)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", variables.has_gradient ?
                    `url(#gradient-${leftGroup.replace(/\s+/g, '-').toLowerCase()})` :
                    getColor(leftGroup))
                .attr("rx", variables.has_rounded_corners ? 4 : 0)
                .attr("ry", variables.has_rounded_corners ? 4 : 0)
                .style("stroke", variables.has_stroke ? strokeColor : "none")
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
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
            
            // 添加数值标签在条形图外侧（左侧）
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            g.append("text")
                .attr("class", "label")
                .attr("x", xPos - 5) // 放在条形图左侧，留出一定间距
                .attr("y", yPos + yScale.bandwidth()/2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("fill", colors.text_color)
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("pointer-events", "none")
                .text(formattedValue);
        }
    });
    
    // ---------- 13. 绘制右侧条形图 ----------
    
    dimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === rightGroup
        );
        
        if (dataPoint) {
            // 解析数值，确保为数字
            const value = parseFloat(dataPoint[valueField]) || 0;
            
            // 计算条形图位置和尺寸
            const barWidth = rightXScale(value);
            const yPos = yScale(dimension);
            const barLeft = innerWidth/2 + dimensionLabelWidth/2;
            const barHeight = yScale.bandwidth();
            
            // 绘制普通矩形
            g.append("rect")
                .attr("x", barLeft)
                .attr("y", yPos)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", variables.has_gradient ?
                    `url(#gradient-${rightGroup.replace(/\s+/g, '-').toLowerCase()})` :
                    getColor(rightGroup))
                .attr("rx", variables.has_rounded_corners ? 4 : 0)
                .attr("ry", variables.has_rounded_corners ? 4 : 0)
                .style("stroke", variables.has_stroke ? strokeColor : "none")
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
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
            
            // 添加数值标签在条形图外侧（右侧）
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            g.append("text")
                .attr("class", "label")
                .attr("x", barLeft + barWidth + 5) // 放在条形图右侧，留出一定间距
                .attr("y", yPos + yScale.bandwidth()/2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
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