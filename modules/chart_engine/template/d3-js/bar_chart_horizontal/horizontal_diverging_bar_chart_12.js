/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Diverging Bar Chart",
    "chart_name": "horizontal_diverging_bar_chart_12",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
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

// 水平对比型条形图实现 - 使用D3.js - 棒子数量表示数值
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
    const margin = { top: 100, right: 70, bottom: 40, left: 70 };
    
    // 计算实际绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;    // 绘图区宽度
    const innerHeight = height - margin.top - margin.bottom;  // 绘图区高度
    
    // 设置各部分位置参数
    const centerX = margin.left + innerWidth / 2;   // 图表中心X坐标
    const topAreaHeight = 60;                       // 标题和标签区域高度
    const barPadding = 8;                           // 条形图之间的间距
    
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
    if (dataColumns.find(col => col.role === "group").unit!== "none") {
        groupUnit = dataColumns.find(col => col.role === "group").unit; 
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
    
    // 找出两侧最大值，以确定棒子数量
    const leftMax = d3.max(
        chartData.filter(d => d[groupField] === leftGroup),
        d => Math.abs(+d[valueField])
    ) || 0;
    
    const rightMax = d3.max(
        chartData.filter(d => d[groupField] === rightGroup),
        d => Math.abs(+d[valueField])
    ) || 0;
    
    // 取两侧绝对值最大的值
    const overallMax = Math.max(leftMax, rightMax);
    
    // 棒子数量计算
    const maxBars = 20; // 最大显示20个棒子
    // 计算每个棒子代表的数值（向上取整确保覆盖所有值）
    const valuePerBar = Math.ceil(overallMax / maxBars);
    
    // ---------- 5. 动态计算维度标签区域宽度 ----------
    
    // 创建临时SVG容器用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 计算最大标签宽度
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
        // 直接使用计算出的宽度
        maxLabelWidth = Math.max(maxLabelWidth, textWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 为计算出的宽度添加边距，确保有足够空间
    const labelSidePadding = 15; // 标签两侧各留15像素的间距
    const centerLabelAreaWidth = maxLabelWidth + labelSidePadding * 2; // 中心标签区域的总宽度
    
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
    
    // 为左右两侧创建渐变
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
        .attr("stop-color", d3.rgb(leftBaseColor).darker(0.7));
    
    leftGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d3.rgb(leftBaseColor).brighter(1.2));
    
    const rightGradientId = `gradient-${rightGroup.replace(/\s+/g, '-').toLowerCase()}`;
    const rightBaseColor = getColor(rightGroup);
    
    const rightGradient = defs.append("linearGradient")
        .attr("id", rightGradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");
    
    rightGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d3.rgb(rightBaseColor).brighter(1.2));
    
    rightGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d3.rgb(rightBaseColor).darker(0.7));
    
    // ---------- 7. 添加左右组标签 ----------
    
    // 图例方块尺寸
    const legendSquareSize = 12;
    const legendSpacing = 5;
    
    // 创建临时SVG容器用于测量组标签文本宽度
    const tempLabelSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 格式化组标签
    const formattedLeftGroup = groupUnit ? `${leftGroup}${groupUnit}` : `${leftGroup}`;
    const formattedRightGroup = groupUnit ? `${rightGroup}${groupUnit}` : `${rightGroup}`;
    
    // 测量左侧组标签宽度
    const tempLeftText = tempLabelSvg.append("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text(formattedLeftGroup);
    const leftTextWidth = tempLeftText.node().getBBox().width;
    tempLeftText.remove();
    
    // 测量右侧组标签宽度
    const tempRightText = tempLabelSvg.append("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text(formattedRightGroup);
    const rightTextWidth = tempRightText.node().getBBox().width;
    tempRightText.remove();
    
    // 删除临时SVG
    tempLabelSvg.remove();
    
    // 计算图例左右位置
    const leftLegendX = centerX - 50 - leftTextWidth - legendSquareSize - legendSpacing;
    const rightLegendX = centerX + 50;
    
    // 添加左侧组标签
    svg.append("rect")
        .attr("x", leftLegendX)
        .attr("y", margin.top - 35)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", getColor(leftGroup));
    
    svg.append("text")
        .attr("x", leftLegendX + legendSquareSize + legendSpacing)
        .attr("y", margin.top - 35 + legendSquareSize / 2)
        .attr("dy", "0.35em")
        .style("font-family", typography.label.font_family)
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", colors.text_color || "#333333")
        .text(formattedLeftGroup);
    
    // 添加右侧组标签
    svg.append("rect")
        .attr("x", rightLegendX)
        .attr("y", margin.top - 35)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", getColor(rightGroup));
    
    svg.append("text")
        .attr("x", rightLegendX + legendSquareSize + legendSpacing)
        .attr("y", margin.top - 35 + legendSquareSize / 2)
        .attr("dy", "0.35em")
        .style("font-family", typography.label.font_family)
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", colors.text_color || "#333333")
        .text(formattedRightGroup);
    
    // ---------- 8. 绘制比例尺和中线 ----------
    
    // 文字颜色
    const textColor = colors.text_color || "#333333";
    
    // 中线 - 保持在中点
    svg.append("line")
        .attr("x1", margin.left + innerWidth / 2) // 使用绝对中心点
        .attr("y1", margin.top)
        .attr("x2", margin.left + innerWidth / 2) // 使用绝对中心点
        .attr("y2", height - margin.bottom)
        .attr("stroke", "#CCCCCC")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");
    
    // ---------- 9. 设置比例尺 ----------
    
    // Y轴比例尺 - 用于不同维度的垂直位置
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.2);  // 条形图之间的间距
    
    // 计算棒子尺寸
    const barHeight = yScale.bandwidth();
    
    // 棒子配置
    const barWidth = 8; // 单个棒子宽度
    const barSpacing = 3; // 棒子之间的间距
    
    // 计算值到棒子的映射函数
    const valueToBars = (value) => {
        return Math.min(maxBars, Math.ceil(Math.abs(value) / valuePerBar));
    };
    
    // 中间标签区宽度计算 - 已移至上方
    /*
    const centerLabelWidth = dimensions.reduce((maxWidth, dimension) => {
        const tempText = tempSvg.append("text") // tempSvg is already removed here
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(dimension);
        
        const width = tempText.node().getBBox().width;
        tempText.remove();
        return Math.max(maxWidth, width);
    }, 0);
    
    // 确保中间区域有足够空间 - 预留左右各15px的间距
    const centerPadding = 30; // 中间标签两侧各15px空间
    const centerWidth = centerLabelWidth + centerPadding;
    */
    
    // ---------- 10. 绘制主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 获取描边颜色（如果启用描边）
    const getStrokeColor = (barColor) => {
        return variables.has_stroke ? d3.rgb(barColor).darker(0.5) : "none";
    };
    
    // 获取填充颜色（考虑渐变）
    const getLeftFill = () => {
        return variables.has_gradient ? `url(#${leftGradientId})` : getColor(leftGroup);
    };
    
    const getRightFill = () => {
        return variables.has_gradient ? `url(#${rightGradientId})` : getColor(rightGroup);
    };
    
    // 为每个维度绘制数据棒子和标签
    dimensions.forEach((dimension, i) => {
        const y = yScale(dimension);
        const barY = y + (barHeight - barHeight * 0.6) / 2; // 垂直居中（高度为60%行高）
        const finalBarHeight = barHeight * 0.6; // 行高的60%
        
        // 找出此维度下的左右两侧数据
        const leftData = chartData.find(d => d[dimensionField] === dimension && d[groupField] === leftGroup);
        const rightData = chartData.find(d => d[dimensionField] === dimension && d[groupField] === rightGroup);
        
        // 添加维度标签 - 居中显示在图表中心 (基于innerWidth)
        g.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", y + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", textColor)
            .text(dimension);
        
        // 绘制左侧棒子
        if (leftData && leftData[valueField] !== undefined) {
            const value = Math.abs(+leftData[valueField]);
            const barCount = valueToBars(value);
            
            // 计算左侧起始位置，从中间标签区域左侧开始
            const leftStartX = innerWidth / 2 - centerLabelAreaWidth / 2;
            
            // 绘制每个棒子
            for (let j = 0; j < barCount; j++) {
                const barX = leftStartX - (j + 1) * (barWidth + barSpacing);
                
                g.append("rect")
                    .attr("x", barX)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", finalBarHeight)
                    .attr("fill", getLeftFill())
                    .attr("rx", barWidth / 2)
                    .attr("ry", barWidth / 2)
                    .style("stroke", getStrokeColor(getColor(leftGroup)))
                    .style("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            }
            
            // 添加左侧数值标签
            const formattedValue = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
            const lastBarX = leftStartX - barCount * (barWidth + barSpacing) - 5;
            
            g.append("text")
                .attr("x", lastBarX)
                .attr("y", y + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", typography.annotation.font_size)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", textColor)
                .text(formattedValue);
        }
        
        // 绘制右侧棒子
        if (rightData && rightData[valueField] !== undefined) {
            const value = Math.abs(+rightData[valueField]);
            const barCount = valueToBars(value);
            
            // 计算右侧起始位置，从中间标签区域右侧开始
            const rightStartX = innerWidth / 2 + centerLabelAreaWidth / 2;
            
            // 绘制每个棒子
            for (let j = 0; j < barCount; j++) {
                const barX = rightStartX + j * (barWidth + barSpacing);
                
                g.append("rect")
                    .attr("x", barX)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", finalBarHeight)
                    .attr("fill", getRightFill())
                    .attr("rx", barWidth / 2)
                    .attr("ry", barWidth / 2)
                    .style("stroke", getStrokeColor(getColor(rightGroup)))
                    .style("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
            }
            
            // 添加右侧数值标签
            const formattedValue = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
            const lastBarX = rightStartX + barCount * (barWidth + barSpacing) + 5;
            
            g.append("text")
                .attr("x", lastBarX)
                .attr("y", y + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", typography.annotation.font_size)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", textColor)
                .text(formattedValue);
        }
    });
    
    // 返回SVG节点
    return svg.node();
}
