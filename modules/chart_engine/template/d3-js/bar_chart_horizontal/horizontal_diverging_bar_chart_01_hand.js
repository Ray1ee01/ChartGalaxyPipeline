/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Diverging Bar Chart",
    "chart_name": "horizontal_diverging_bar_chart_01_hand",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 15], ["-inf", "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary","secondary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
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

// 双向水平条形图实现 - 使用D3.js
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
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置
    const images = jsonData.images || { field: {}, other: {} };   // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = true;//variables.has_rounded_corners || false;
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
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列角色（role）提取字段名
    // 查找维度字段（role = "x"）
    let dimensionField = "dimension"; // 默认值
    for (let i = 0; i < dataColumns.length; i++) {
        if (dataColumns[i].role === "x") {
            dimensionField = dataColumns[i].name;
            break;
        }
    }
    
    // 查找数值字段（role = "y"）
    let valueField = "value"; // 默认值
    for (let i = 0; i < dataColumns.length; i++) {
        if (dataColumns[i].role === "y") {
            valueField = dataColumns[i].name;
            break;
        }
    }
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; 
    
    if (dataColumns.length > 0 && dataColumns[0].unit && dataColumns[0].unit !== "none") {
        dimensionUnit = dataColumns[0].unit;
    }
    
    if (dataColumns.length > 1 && dataColumns[1].unit && dataColumns[1].unit !== "none") {
        valueUnit = dataColumns[1].unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 修改：按数值升序排序数据（负值在上，正值在下）
    chartData.sort((a, b) => a[valueField] - b[valueField]);
    
    // 分离正负值
    const positiveData = chartData.filter(d => d[valueField] >= 0);
    const negativeData = chartData.filter(d => d[valueField] < 0);
    
    // 所有维度值按排序后的顺序
    const sortedDimensions = chartData.map(d => d[dimensionField]);
    
    // ---------- 5. 创建一个临时SVG来测量文本尺寸 ----------
    
    // 创建临时SVG进行文本测量
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 测量所有维度标签的宽度
    let maxDimensionLabelWidth = 0;
    let maxValueLabelWidth = 0;
    
    // 创建临时文本元素来测量文本宽度
    const tempText = tempSvg.append("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight);
    
    // 测量每个维度标签的宽度
    chartData.forEach(d => {
        const dimension = d[dimensionField];
        tempText.text(dimension);
        const textWidth = tempText.node().getComputedTextLength();
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, textWidth);
    });
    
    // 测量数值标签宽度
    tempText
        .style("font-family", typography.annotation.font_family)
        .style("font-size", typography.annotation.font_size)
        .style("font-weight", typography.annotation.font_weight);
    
    chartData.forEach(d => {
        const value = d[valueField];
        const formattedValue = value >= 0 ? 
            `+${formatValue(value)}${valueUnit}` : 
            `${formatValue(value)}${valueUnit}`;
        tempText.text(formattedValue);
        const textWidth = tempText.node().getComputedTextLength();
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // ---------- 6. 计算内部绘图区域尺寸和布局 ----------
    
    // 初始化绘图区域边距
    const labelPadding = 5; // 标签与条形之间的间距
    const valuePadding = 5; // 数值与条形之间的间距
    
    // 计算需要的空间
    const maxNegativeValue = d3.min(negativeData, d => d[valueField]) || 0;
    const maxPositiveValue = d3.max(positiveData, d => d[valueField]) || 0;
    
    // 设置边距，考虑文本宽度
    const margin = {
        top: 60,      // 顶部留出标题空间
        right: 0, 
        bottom: 30,   // 底部边距
        left: 0
    };
    
    // 计算内部绘图区域尺寸
    const innerWidth = width  - margin.left - margin.right; // 图表占总宽度的2/3
    const innerHeight = height - margin.top - margin.bottom;
    
    // 计算条形的额外间距
    const barPadding = variables.has_spacing ? 0.3 : 0.25;
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
        
    // 计算最大绝对值
    const maxAbsValue = Math.max(Math.abs(maxNegativeValue), Math.abs(maxPositiveValue)) * 1.05; // 添加5%边距
    
    // 计算负值栏最左侧位置（包括标签）
    const negLabelSpace = maxDimensionLabelWidth - 30;
    
    // 计算正值栏最右侧位置（包括标签）
    const posLabelSpace = maxDimensionLabelWidth - 30;
    
    // 创建从负值到正值的比例尺
    const xScale = d3.scaleLinear()
        .domain([-Math.abs(maxNegativeValue), Math.abs(maxPositiveValue)])
        .range([negLabelSpace, innerWidth - posLabelSpace]);
    
    // 中心点位置
    const center = xScale(0);
    
    // ---------- 7. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // // 如果有背景颜色设置，添加背景
    // if (colors.background_color) {
    //     svg.style("background-color", colors.background_color);
    // }
    
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
        // 正值渐变
        const positiveGradient = defs.append("linearGradient")
            .attr("id", "positive-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
        
        const positiveColor = colors.other.positive || "#90EE90";
        
        positiveGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(positiveColor).brighter(0.5));
        
        positiveGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(positiveColor).darker(0.3));
            
        // 负值渐变
        const negativeGradient = defs.append("linearGradient")
            .attr("id", "negative-gradient")
            .attr("x1", "100%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "0%");
        
        const negativeColor = colors.other.negative || "#C0C0C0";
        
        negativeGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(negativeColor).brighter(0.5));
        
        negativeGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(negativeColor).darker(0.3));
    }
    
    // ---------- 8. 获取颜色 ----------
    
    // 获取正负值条形颜色的辅助函数
    const getPositiveColor = () => {
        if (colors.other.primary) return colors.other.primary;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#4682B4"; // 默认蓝色
    };
    
    const getNegativeColor = () => {
        if (colors.other.secondary) return colors.other.secondary;
        if (colors.available_colors && colors.available_colors.length > 1) return colors.available_colors[1];
        return "#5F9EA0"; // 默认青绿色
    };
    
    // 获取描边颜色的辅助函数
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333";
    };
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 可选：添加中心线
    g.append("line")
        .attr("x1", center)
        .attr("y1", 0)
        .attr("x2", center)
        .attr("y2", innerHeight)
        .attr("stroke", "#000")  // 将 #ccc 改为 #000
        .attr("stroke-width", 1)
        .style("opacity", 0.5);
    
    // ---------- 10. 绘制条形和标签 ----------
    
    // 为每个维度绘制条形和标签
    chartData.forEach(d => {
        const dimension = d[dimensionField];
        const value = d[valueField];
        const barHeight = yScale.bandwidth();
        
        // 确定条形颜色：正值使用正值颜色，负值使用负值颜色
        const barColor = value >= 0 ? 
            (variables.has_gradient ? "url(#positive-gradient)" : getPositiveColor()) : 
            (variables.has_gradient ? "url(#negative-gradient)" : getNegativeColor());
        
        // 格式化数值标签（添加加号或保留负号）
        const formattedValue = value >= 0 ? 
        `+${formatValue(value)}${valueUnit}` : 
        `${formatValue(value)}${valueUnit}`;
        
        // 横条开始位置和宽度
        let barX = center;
        let barWidth = 0;
        
        if (value >= 0) {
            // 正值条形向右延伸
            barX = center;
            barWidth = xScale(value) - center;
        } else {
            // 负值条形向左延伸
            barWidth = center - xScale(value);
            barX = center - barWidth;
        }
        
        // 绘制条形
        if (variables.has_rounded_corners) {
            // 使用路径绘制具有选择性圆角的条形
            const radius = 5; // 圆角半径
            const y = yScale(dimension);
            const height = barHeight;
            
            if (value >= 0) {
                // 正值条形：只在右侧有圆角
                const path = [
                    `M ${barX},${y}`, // 左上角起点
                    `L ${barX + barWidth - radius},${y}`, // 到右上角圆角起点
                    `Q ${barX + barWidth},${y} ${barX + barWidth},${y + radius}`, // 右上角圆角
                    `L ${barX + barWidth},${y + height - radius}`, // 到右下角圆角起点
                    `Q ${barX + barWidth},${y + height} ${barX + barWidth - radius},${y + height}`, // 右下角圆角
                    `L ${barX},${y + height}`, // 到左下角
                    `Z` // 闭合路径
                ].join(' ');
                
                g.append("path")
                    .attr("d", path)
                    .attr("fill", barColor)
                    .style("stroke", variables.has_stroke ? getStrokeColor() : "none")
                    .style("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            } else {
                // 负值条形：只在左侧有圆角
                const path = [
                    `M ${barX + radius},${y}`, // 左上角圆角起点
                    `Q ${barX},${y} ${barX},${y + radius}`, // 左上角圆角
                    `L ${barX},${y + height - radius}`, // 到左下角圆角起点
                    `Q ${barX},${y + height} ${barX + radius},${y + height}`, // 左下角圆角
                    `L ${barX + barWidth},${y + height}`, // 到右下角
                    `L ${barX + barWidth},${y}`, // 到右上角
                    `Z` // 闭合路径
                ].join(' ');
                
                g.append("path")
                    .attr("d", path)
                    .attr("fill", barColor)
                    .style("stroke", variables.has_stroke ? getStrokeColor() : "none")
                    .style("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            }
        } else {
            // 没有圆角时使用普通矩形
            g.append("rect")
                .attr("x", barX)
                .attr("y", yScale(dimension))
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("fill", barColor)
                .style("stroke", variables.has_stroke ? getStrokeColor() : "none")
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
        }
        
        // 绘制维度标签
        if (value >= 0) {
            // 正值：标签在条形左侧
            g.append("text")
                .attr("x", center - labelPadding)
                .attr("y", yScale(dimension) + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#000000")
                .text(dimension);
        } else {
            // 负值：标签在条形右侧
            g.append("text")
                .attr("x", center + labelPadding)
                .attr("y", yScale(dimension) + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#000000")
                .text(dimension);
        }
        
        // 绘制数值标签
        if (value >= 0) {
            // 正值：数值标签在条形右侧
            g.append("text")
                .attr("x", barX + barWidth + valuePadding)
                .attr("y", yScale(dimension) + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#000000")
                .text(formattedValue);
        } else {
            // 负值：数值标签在条形左侧
            g.append("text")
                .attr("x", barX - valuePadding)
                .attr("y", yScale(dimension) + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color || "#000000")
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