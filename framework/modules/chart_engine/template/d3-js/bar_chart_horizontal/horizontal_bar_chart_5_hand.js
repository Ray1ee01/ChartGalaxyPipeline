/* 
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_5_hand",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
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

// 水平条形图实现 - 使用D3.js (样式02)
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                           // 完整的JSON数据对象
    const chartData = jsonData.data.data                 // 实际数据点数组  
    const variables = jsonData.variables || {};      // 图表配置
    const typography = jsonData.typography || {      // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333",
        other: { primary: "#0099ff" }  // 默认使用蓝色作为条形颜色
    };  
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
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = 1;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const originalHeight = variables.height || 600;
    
    // 设置边距 - 这个样式需要更多的上部和下部空间用于标签
    const margin = {
        top: 100,      // 顶部边距
        right: 80,    // 右侧足够显示数值标签
        bottom: 70,   // 底部边距
        left: 20      // 左侧边距
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; // 默认为百分比
    
    if (dataColumns.find(col => col.role === "x").unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值并按数值降序排列数据
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    
    // 按数值降序排序数据（与图片相符）
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);
    
    // ---------- 5. 计算标签宽度、动态高度和图表尺寸 ----------
    
    // 动态调整高度
    const numDimensions = sortedDimensions.length;
    let adjustedHeight = originalHeight;
    const maxHeightFactor = 1.88;
    
    if (numDimensions > 18) {
        // 根据条目数量比例计算建议高度
        const suggestedHeight = originalHeight * (numDimensions / 18);
        // 限制最大高度
        adjustedHeight = Math.min(suggestedHeight, originalHeight * maxHeightFactor);
    }
    
    // 使用调整后的高度
    const height = adjustedHeight;
    
    // 创建临时SVG来测量文本宽度
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
        maxLabelWidth = Math.max(maxLabelWidth, textWidth);
        
        tempText.remove();
    });
    
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
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 根据标签宽度调整右边距
    margin.right = Math.max(margin.right, maxValueWidth + 10);
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom; 
    
   
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height) // 使用调整后的高度
        .attr("viewBox", `0 0 ${width} ${height}`) // 使用调整后的高度
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
            .attr("stdDeviation", 3);
        
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
        const primaryColor = colors.other && colors.other.primary ? colors.other.primary : "#0099ff";
        
        const gradient = defs.append("linearGradient")
            .attr("id", "bar-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
        
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(primaryColor).brighter(0.5));
        
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(primaryColor));
    }
    
    // ---------- 7. 创建比例尺 ----------
    
    // 计算条形的额外间距（如果启用）
    const barPadding = variables.has_spacing ? 0.7 : 0.6 ;
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（用于数值）
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField]) * 1.1]) // 添加10%边距
        .range([0, innerWidth]);
    
   // ---------- 4. 在"正式渲染"前，测量合适的维度标签字体大小 ----------

    // 4.1 建立一个临时 svg 用于测量文本
    const tempSvg2 = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");

    // 4.2 从 typography.label.font_size 中解析初始字号（可能是 "12px" 这种写法）
    const defaultFontSizeStr = typography.label.font_size || "12px";
    let fontSize = parseFloat(defaultFontSizeStr);

    // 设置最小字号，避免太小看不清
    const minFontSize = 4; // 保证最小字体是 4

    // 4.3 定义一个函数，用给定的字号去测量"所有"维度文本的最大高度
    function getMaxTextHeightForFontSize(testFontSize) {
        let maxH = 0;
        sortedDimensions.forEach(dim => {
            const tmpText = tempSvg2.append("text")
                .style("font-family", typography.label.font_family)
                .style("font-size", testFontSize + "px")
                .style("font-weight", typography.label.font_weight)
                .text(dim);
            const bbox = tmpText.node().getBBox();
            maxH = Math.max(maxH, bbox.height);
            tmpText.remove();
        });
        return maxH;
    }

    // 4.4 计算两条 bar（在 yScale 排列）之间的距离：就是 yScale.step()
    const barStep = yScale.step(); 
    // 因为标签要画在 bar 底部 + 一定空隙（例如 +10 px），
    // 相邻两条 bar 的文字基线相差 barStep。若文字高度大于 barStep，就会挤到下一行文本
    // 简单判断：若 textHeight > barStep，则判定会重叠

    // 4.5 不断减小字号直到能放下或到达最小字号
    while (true) {
        if (fontSize < minFontSize) {
            fontSize = minFontSize;
            break;
        }
        const maxTextHeight = getMaxTextHeightForFontSize(fontSize);
            if (maxTextHeight <= barStep) {
            // 说明可以放下，不会重叠
                break;
        }
        fontSize--;
    }

    // 用完后移除临时 svg
    tempSvg2.remove();
    // ---------- 8. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 9. 绘制条形和标签 ----------
    
    // 获取条形颜色
    const getBarColor = () => {
        return colors.other && colors.other.primary ? colors.other.primary : "#0099ff"; // 默认蓝色
    };
    
    // 获取描边颜色
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        return d3.rgb(getBarColor()).darker(0.2);
    };
    
    // ---- 动态计算维度标签位置 ----
    // 计算两个条形图之间的距离
    const barGap = yScale.step() - yScale.bandwidth();
    
    // 设置一个安全的最小距离，确保标签与条形图不会重叠
    const minSafeLabelDistance = Math.max(3, barGap / 4);
    
    // 调整字体大小计算部分，让它更合理地配合条形间距
    function calculateOptimalFontSize() {
        // 计算条形之间的可用空间 (即下方空间)
        const availableSpaceBelow = yScale.step() - yScale.bandwidth();
        
        // 基于可用空间估算理想字体大小
        // 字体高度约等于字体大小，留一点点空隙 (e.g., 2px)
        const fontSizeEstimate = Math.floor(availableSpaceBelow - 2);
        
        // 限制在合理范围内，确保不小于 minFontSize
        return Math.max(minFontSize, Math.min(fontSize, fontSizeEstimate));
    }
    
    // 调整现有的fontSize计算
    fontSize = calculateOptimalFontSize();
    
    // 为每个维度绘制条形和标签
    sortedDimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => d[dimensionField] === dimension);
        
        if (dataPoint) {
            const barHeight = yScale.bandwidth();
            const barWidth = xScale(+dataPoint[valueField]);
            
            // 创建条形组
            const barGroup = g.append("g")
                .attr("transform", `translate(0, ${yScale(dimension)})`);
            
            // 绘制条形
            barGroup.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", variables.has_gradient ? "url(#bar-gradient)" : getBarColor())
                .attr("rx", variables.has_rounded_corners ? 3 : 0)
                .attr("ry", variables.has_rounded_corners ? 3 : 0)
                .style("stroke", variables.has_stroke ? getStrokeColor() : "none")
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            
            // 计算标签位置 - 放置在条形下方，避免重叠
            const labelYPosition = barHeight + minSafeLabelDistance; // 在条形下方留出安全距离
            
            // 添加维度标签
            barGroup.append("text")
                .attr("x", 0) // 标签从条形左侧开始
                .attr("y", labelYPosition)
                .attr("dy", "0.71em") // 调整基线使文本顶部接近labelYPosition
                .attr("text-anchor", "start") // 左对齐
                .style("font-family", typography.label.font_family)
                .style("font-size", fontSize + "px")
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(dimension);
            
            // 添加数值标签（在条形右侧）
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            barGroup.append("text")
                .attr("x", barWidth + 5) // 条形右侧10px
                .attr("y", barHeight / 2)
                .attr("dy", "0.35em") // 垂直居中
                .attr("text-anchor", "start")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#333333")
                .text(formattedValue);
        }
    });
    
    const roughness = 1;
    const bowing = 2;
    const fillStyle = "hachure";
    const randomize = false;
    const pencilFilter = false;
        
    const svgConverter = new svg2roughjs.Svg2Roughjs(containerSelector);
    svgConverter.pencilFilter = pencilFilter;
    svgConverter.randomize = randomize;
    svgConverter.svg = svg.node();
    svgConverter.roughConfig = {
        bowing,
        roughness,
        fillStyle
    };
    svgConverter.sketch();
    // Remove the first SVG element if it exists
    const firstSvg = document.querySelector(`${containerSelector} svg`);
    if (firstSvg) {
        firstSvg.remove();
    }
    
    // 返回SVG节点
    return svg.node();
}