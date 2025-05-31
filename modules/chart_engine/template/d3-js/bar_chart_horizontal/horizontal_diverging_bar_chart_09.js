/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Diverging Bar Chart",
    "chart_name": "horizontal_diverging_bar_chart_09",
    "is_composite": false,
    "required_fields": ["x", "y", "group", "group2"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"],["categorical"]],
    "required_fields_range": [[2, 20], [0, 100], [2, 2],[2, 2]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group", "group2"],
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

// 水平分组条形图实现 - 使用D3.js - 改为水平对比分组条形图
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                      // 完整的JSON数据对象
    const chartData = jsonData.data.data;       // 实际数据点数组
    const variables = jsonData.variables || {}; // 图表配置
    const typography = jsonData.typography || { // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置
    const images = jsonData.images || { field: {}, other: {} };  // 图像设置
    const dataColumns = jsonData.data.data_columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
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
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸和边距
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 为标题和副标题预留空间
    const titleHeight = 120;  // 为标题和图例预留更多高度
    
    // 分析图表区域底部边距
    const bottomMargin = 50;
    
    // 初始设置边距
    const margin = { 
        top: titleHeight,     // 顶部留出标题和图例空间
        right: 80,            // 右侧足够显示数值
        bottom: bottomMargin, // 底部边距
        left: 80              // 左侧足够显示数值
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    let parentTypeField, valueField, genderField, careerImpactField;
    let valueUnit = "";
    
    // 从数据列中安全提取字段名称
    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    
    
    // 安全地提取字段名，并提供默认值
    if (xColumn) parentTypeField = xColumn.name; else parentTypeField = "Parent Type";
    if (yColumn) valueField = yColumn.name; else valueField = "Percentage";
    
    genderField = dataColumns.find(col => col.role === "group").name; // 默认值

    careerImpactField = dataColumns.find(col => col.role === "group2").name; // 默认值
    
    // 获取y轴字段单位（如果存在）
    if (yColumn && yColumn.unit && yColumn.unit !== "none") {
        valueUnit = yColumn.unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取各维度的唯一值
    const parentTypes = [...new Set(chartData.map(d => d[parentTypeField]))];
    const genders = [...new Set(chartData.map(d => d[genderField]))];
    const careerImpacts = [...new Set(chartData.map(d => d[careerImpactField]))];
    
    // 确保只有两个性别分组（用于水平对比）
    if (genders.length !== 2) {
        console.error("The gender field must have exactly 2 unique values for this chart type");
        return;
    }
    
    // 动态分配左右两侧的性别
    const leftGender = genders[1];
    const rightGender = genders[0];
    
    // ---------- 5. 计算标签和图表空间 ----------
    
    // 创建临时SVG用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 计算文本宽度的函数
    function getTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempText = tempSvg.append("text")
            .style("font-family", fontFamily)
            .style("font-size", fontSize)
            .style("font-weight", fontWeight)
            .text(text);
        
        const width = tempText.node().getBBox().width;
        tempText.remove();
        return width;
    }
    
    // 计算最大值标签的宽度
    let maxValueWidth = 0;
    chartData.forEach(d => {
        const valueText = `${d[valueField]}${valueUnit}`;
        const textWidth = getTextWidth(
            valueText, 
            typography.annotation.font_family,
            typography.annotation.font_size,
            typography.annotation.font_weight
        );
        maxValueWidth = Math.max(maxValueWidth, textWidth);
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 为值标签预留空间
    margin.left = Math.max(margin.left, maxValueWidth + 20);
    margin.right = Math.max(margin.right, maxValueWidth + 20);
    
    // 计算实际绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 计算总分组数（每个career impact有多个parent types）
    const totalGroups = careerImpacts.length;
    
    // 计算标签所需的垂直空间
    const labelFontSize = parseInt(typography.label.font_size) || 16;
    const labelSpace = labelFontSize + 10; // 标签高度 + 额外间距
    
    // 每个careerImpact组的高度
    const impactGroupHeight = innerHeight / totalGroups;
    // 组间距
    const groupPadding =  (labelFontSize + variables.has_spacing ? impactGroupHeight * 0.2 : impactGroupHeight * 0.1);
    const subGroupHeight = (impactGroupHeight - groupPadding) / parentTypes.length;
    // 实际条形高度 (减去标签空间)
    const barHeight = variables.has_spacing ? subGroupHeight - labelFontSize - subGroupHeight * 0.5  : subGroupHeight - labelFontSize - subGroupHeight * 0.4;
    
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
    
    // 添加阴影滤镜（如果启用）
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
    
    // 添加渐变（如果启用）
    if (variables.has_gradient) {
        genders.forEach(gender => {
            const gradientId = `gradient-${gender.replace(/\s+/g, '-').toLowerCase()}`;
            const baseColor = getGenderColor(gender);
            
            const gradient = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(baseColor).brighter(1.2));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(baseColor).darker(0.7));
        });
    }
    
    // ---------- 7. 创建比例尺 ----------
    
    // 计算最大值用于X轴比例尺
    const maxValue = d3.max(chartData, d => +d[valueField]);
    
    // 值的X比例尺 - 中心位置为0，向两侧延伸
    const xScale = d3.scaleLinear()
        .domain([0, maxValue * 1.1]) // 添加10%边距
        .range([0, innerWidth / 2]);  // 每侧占用一半宽度
    
    // ---------- 8. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 图表的中心线位置
    const centerX = innerWidth / 2;
    
    // ---------- 9. 绘制图例 ----------
    
    // 获取性别颜色
    function getGenderColor(gender) {
        // 优先使用指定颜色
        if (colors.field && colors.field[gender]) {
            return colors.field[gender];
        }
        
        // 如果有可用颜色数组，按索引使用
        if (colors.available_colors && colors.available_colors.length > 0) {
            const genderIndex = genders.indexOf(gender);
            return colors.available_colors[genderIndex % colors.available_colors.length];
        }
        
        // 默认颜色方案
        const defaultColors = {
            "Men": "#efb118",   // 橙色
            "Women": "#a463f2"  // 紫色
        };
        
        return defaultColors[gender] || "#999";
    }
    
    // 绘制图例
    const legendGroup = svg.append("g")
    .attr("transform", `translate(${width/2}, ${margin.top*0.8})`);

    // 图例圆点半径和间距
    const circleRadius = 10; // 圆点半径
    const spaceBetweenCircleAndText = 10; // 圆点右边缘到文本左边缘的间距
    const centerMargin = 10; // 中心线到两侧图例的间距

    
    

    // 获取左侧文本宽度
    const leftTextWidth = getTextWidth(
        leftGender,
        typography.label.font_family,
        typography.label.font_size,
        "bold"
    );

    // 左侧文本右边缘位置 = -centerMargin
    const leftTextRightEdge = -5* centerMargin
    const leftTextLeftEdge = leftTextRightEdge - leftTextWidth;

    // 左侧圆点右边缘位置 = 左侧文本左边缘 - spaceBetweenCircleAndText
    const leftCircleRightEdge = leftTextLeftEdge - spaceBetweenCircleAndText;
    const leftCircleCenter = leftCircleRightEdge - circleRadius;

    // 右侧圆点左边缘位置 = centerMargin
    const rightCircleLeftEdge = centerMargin;
    const rightCircleCenter = rightCircleLeftEdge + circleRadius;

    // 右侧文本左边缘位置 = 右侧圆点右边缘 + spaceBetweenCircleAndText
    const rightCircleRightEdge = rightCircleCenter + circleRadius;
    const rightTextLeftEdge = rightCircleRightEdge + spaceBetweenCircleAndText;

    // 绘制左侧图例
    legendGroup.append("circle")
        .attr("cx", leftCircleCenter)
        .attr("cy", 0)
        .attr("r", circleRadius)
        .attr("fill", getGenderColor(leftGender));

    legendGroup.append("text")
        .attr("x", leftTextLeftEdge)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", "bold")
        .style("fill", colors.text_color || "#333")
        .text(leftGender);

    // 绘制右侧图例
    legendGroup.append("circle")
        .attr("cx", rightCircleCenter)
        .attr("cy", 0)
        .attr("r", circleRadius)
        .attr("fill", getGenderColor(rightGender));

    legendGroup.append("text")
        .attr("x", rightTextLeftEdge)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", "bold")
        .style("fill", colors.text_color || "#333")
        .text(rightGender);
    
    
    // ---------- 10. 绘制分组条形图 ----------
    
    // 为每个Career Impact创建分组
    careerImpacts.forEach((impact, impactIndex) => {
        // 计算该Impact组的垂直位置
        const impactGroupY = impactIndex * impactGroupHeight;
        
        // 绘制Impact标题 - 居中显示并增加间距
        const titleFontSize = 24; // 标题使用较大字体
        const titleOffset = titleFontSize + 20; // 标题高度 + 额外间距
        
        g.append("text")
            .attr("x", centerX)
            .attr("y", impactGroupY + groupPadding - 20)
            .attr("text-anchor", "middle")
            .style("font-family", typography.title.font_family)
            .style("font-size", `${labelFontSize+1}px`)
            .style("font-weight", "bold")
            .style("fill", colors.text_color || "#333")
            .text(impact);
        
        // 为每个Parent Type绘制条形
        parentTypes.forEach((parentType, parentIndex) => {
            // 计算该Parent Type的垂直位置
            const barY = impactGroupY + groupPadding + parentIndex * subGroupHeight + subGroupHeight *0.1;
            
            // 绘制Parent Type标签 - 居中显示并确保不与条形图重叠
            
            
            g.append("text")
                .attr("x", centerX)
                .attr("y", barY ) // 使用动态计算的间距
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333")
                .text(parentType);
            
            // 处理每个性别的数据
            genders.forEach((gender) => {
                // 查找数据点
                const dataPoint = chartData.find(d => 
                    d[parentTypeField] === parentType && 
                    d[genderField] === gender && 
                    d[careerImpactField] === impact
                );
                
                if (dataPoint) {
                    // 获取数值
                    const value = +dataPoint[valueField];
                    const barWidth = xScale(value);
                    
                    // 确定条形位置和方向
                    let barX, textX, textAnchor;
                    if (gender === leftGender) {
                        // 左侧性别 - 向左延伸
                        barX = centerX - barWidth;
                        textX = barX - 10;
                        textAnchor = "end";
                    } else {
                        // 右侧性别 - 向右延伸
                        barX = centerX;
                        textX = barX + barWidth + 10;
                        textAnchor = "start";
                    }
                    
                    // 绘制条形
                    g.append("rect")
                        .attr("x", barX)
                        .attr("y", barY + labelFontSize / 2)
                        .attr("width", barWidth)
                        .attr("height", barHeight)
                        .attr("fill", variables.has_gradient ? 
                            `url(#gradient-${gender.replace(/\s+/g, '-').toLowerCase()})` : 
                            getGenderColor(gender))
                        .attr("rx", variables.has_rounded_corners ? 3 : 0)
                        .attr("ry", variables.has_rounded_corners ? 3 : 0)
                        .style("stroke", variables.has_stroke ? "#333" : "none")
                        .style("stroke-width", variables.has_stroke ? 1 : 0)
                        .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
                        .on("mouseover", function() {
                            d3.select(this).attr("opacity", 0.8);
                        })
                        .on("mouseout", function() {
                            d3.select(this).attr("opacity", 1);
                        });
                    // 计算动态字体大小（条形高度的60%）
                    const dynamicFontSize = `${barHeight * 0.6}px`;
                    // 显示数值
                    g.append("text")
                        .attr("x", textX)
                        .attr("y", barY + labelFontSize / 2 + barHeight / 2)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", textAnchor)
                        .style("font-family", typography.annotation.font_family)
                        .style("font-size", dynamicFontSize)
                        .style("font-weight", typography.annotation.font_weight)
                        .style("fill", colors.text_color || "#333")
                        .text(`${formatValue(value)}${valueUnit}`);
                }
            });
        });
    });
    
    return svg.node();
}