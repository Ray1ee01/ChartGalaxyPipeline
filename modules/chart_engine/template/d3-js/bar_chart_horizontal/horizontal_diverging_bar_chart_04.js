/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Diverging Bar Chart",
    "chart_name": "diverging_bar_plain_chart_03",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
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

// 水平对比型条形图实现 - 使用D3.js horizontal_split_bar_chart_01
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
    
    // 如果存在第三个分组，可以用作总计分组（用于显示右侧的总数值）
    const totalGroup = groups.length > 2 ? groups[2] : null;
    
    // ---------- 5. 动态计算维度标签区域宽度 ----------
    
    // 创建临时SVG容器用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");

    // Check if we should show icons along with text
    const showIcons = jsonData.variation?.axis_label === "side";
    // 标志尺寸
    const flagWidth = 20;
    const flagHeight = 15;
    const flagPadding = 0;
    
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
        const totalWidth = showIcons ? flagWidth + flagPadding + textWidth : textWidth + 5;
        
        maxLabelWidth = Math.max(maxLabelWidth, totalWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 为计算出的宽度添加边距，确保有足够空间
    const dimensionLabelWidth = Math.max(maxLabelWidth + 5, 80);  // 最小值为80像素
    
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
    
    const formattedLeftGroup = groupUnit ? `${leftGroup}${groupUnit}` : `${leftGroup}`;
    svg.append("text")
        .attr("x", margin.left + innerWidth / 4)
        .attr("y", margin.top - 10)
        .attr("text-anchor", "middle")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(formattedLeftGroup);
    
    const formattedRightGroup = groupUnit ? `${rightGroup}${groupUnit}` : `${rightGroup}`;
    svg.append("text")
        .attr("x", margin.left + innerWidth * 3 / 4)
        .attr("y", margin.top - 10)
        .attr("text-anchor", "middle")
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
    
    const maxLeftValue = d3.max(chartData.filter(d => d[groupField] === leftGroup), d => d[valueField]);
    const maxRightValue = d3.max(chartData.filter(d => d[groupField] === rightGroup), d => d[valueField]);
    
    const leftXScale = d3.scaleLinear()
        .domain([0, maxLeftValue])
        .range([innerWidth / 2 - dimensionLabelWidth/2, 0]);
    
    const rightXScale = d3.scaleLinear()
        .domain([0, maxRightValue])
        .range([0, innerWidth / 2 - dimensionLabelWidth/2]);
    
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333";
    };
    const strokeColor = getStrokeColor();
    
    // ---------- 9. 添加交替行背景 ----------
    if (jsonData.variation?.background === "styled") {
        dimensions.forEach((dimension, i) => {
            if (i % 2 === 0) {
                g.append("rect")
                    .attr("x", -margin.left/2)
                    .attr("y", yScale(dimension))
                    .attr("width", innerWidth + margin.left/2 + margin.right/2)
                    .attr("height", yScale.bandwidth())
                    .attr("class","background")
                    .attr("fill", "#f5f5f5")
                    .attr("opacity", 0.8);
            }
        });
    }
    
// ---------- 10. 绘制维度标签和图标 ----------
    
    dimensions.forEach(dimension => {
        const yPos = yScale(dimension) + yScale.bandwidth() / 2;
        
        const flagWidth = 20;
        const flagHeight = 15;
        const flagPadding = 0;
        
        const formattedDimension = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        
        const tempText = g.append("text")
            .attr("font-family", typography.label.font_family)
            .attr("font-size", typography.label.font_size)
            .attr("font-weight", typography.label.font_weight)
            .style("visibility", "hidden")
            .text(formattedDimension);
        
        const textWidth = tempText.node().getBBox().width;
        tempText.remove();
        
        
        
        if (showIcons) {
            // If showing icons, calculate total width including the icon
            const totalWidth = flagWidth + flagPadding + textWidth;
            const startX = innerWidth/2 - totalWidth/2;
            
            // Add icon if it exists and if we should show icons
            if (images.field && images.field[dimension]) {
                g.append("image")
                    .attr("x", startX)
                    .attr("y", yPos - flagHeight/2)
                    .attr("width", flagWidth)
                    .attr("height", flagHeight)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", images.field[dimension]);
            }
            
            // Add text after the icon
            g.append("text")
                .attr("x", startX + flagWidth + flagPadding)
                .attr("y", yPos)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .text(formattedDimension);
        } else {
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
        }
    });
    
    // ---------- 11. 绘制左侧条形图 ----------
    
    dimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === leftGroup
        );
        
        if (dataPoint) {
            const barWidth = innerWidth/2 - dimensionLabelWidth/2 - leftXScale(dataPoint[valueField]);
            const yPos = yScale(dimension);
            
            // ★ 改动处：让"右边缘"竖直，"左边缘"倾斜，下边比上边略宽
            const slopeLeft = 5;  // 下边较上边多出的宽度
            const xStart = leftXScale(dataPoint[valueField]);
            const barHeight = yScale.bandwidth();
            
            // 顶部：从 xStart 到 xStart + barWidth（右侧垂直线起点）
            // 底部：右侧同样 xStart + barWidth，左侧 xStart - slopeLeft
            const pathDataLeft = [
                `M ${xStart}              ${yPos}`,                  // 左上
                `L ${xStart + barWidth}   ${yPos}`,                  // 右上(竖直边的上端)
                `L ${xStart + barWidth}   ${yPos + barHeight}`,      // 右下(竖直边的下端)
                `L ${xStart - slopeLeft}  ${yPos + barHeight}`,      // 左下(向左偏移 slope)
                "Z"
            ].join(" ");
            
            g.append("path")
                .attr("d", pathDataLeft)
                .attr("fill", variables.has_gradient ?
                    `url(#gradient-${leftGroup.replace(/\s+/g, '-').toLowerCase()})` :
                    getColor(leftGroup)
                )
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
            
            // ------- 以下是数值标签原逻辑，不作改动 -------
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            const tempText = g.append("text")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("visibility", "hidden")
                .text(formattedValue);
            
            const textWidth = tempText.node().getBBox().width;
            tempText.remove();
            
            let textX = leftXScale(dataPoint[valueField]) + barWidth/2;
            const rightBoundary = leftXScale(dataPoint[valueField]) + barWidth;
            if (textX + textWidth/2 > rightBoundary) {
                textX = rightBoundary - textWidth/2 - 2;
            }
            g.append("text")
                    .attr("class", "label")
                    .attr("x", leftXScale(dataPoint[valueField]) - slopeLeft*1.5) // More generous padding
                    .attr("y", yPos + yScale.bandwidth()/2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end")
                    .style("fill", colors.text_color)
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("pointer-events", "none")
                    .text(formattedValue);

            // if (barWidth < textWidth) {
            //     g.append("text")
            //         .attr("class", "label")
            //         .attr("x", leftXScale(dataPoint[valueField]) - slopeLeft) // More generous padding
            //         .attr("y", yPos + yScale.bandwidth()/2)
            //         .attr("dy", "0.35em")
            //         .attr("text-anchor", "end")
            //         .style("fill", colors.text_color)
            //         .style("font-family", typography.annotation.font_family)
            //         .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
            //         .style("font-weight", typography.annotation.font_weight)
            //         .style("pointer-events", "none")
            //         .text(formattedValue);
            // } else {
            //     g.append("text")
            //         .attr("class", "label")
            //         .attr("x", textX)
            //         .attr("y", yPos + yScale.bandwidth()/2)
            //         .attr("dy", "0.35em")
            //         .attr("text-anchor", "middle")
            //         .style("fill", "#ffffff")
            //         .style("font-family", typography.annotation.font_family)
            //         .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
            //         .style("font-weight", typography.annotation.font_weight)
            //         .style("pointer-events", "none")
            //         .text(formattedValue);
            // }
        }
    });
    
    // ---------- 12. 绘制右侧条形图 ----------
    
    dimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === rightGroup
        );
        
        if (dataPoint) {
            const barWidth = rightXScale(dataPoint[valueField]);
            const yPos = yScale(dimension);
            const barLeft = innerWidth/2 + dimensionLabelWidth/2;
            
            // ★ 改动处：让"左边缘"竖直，"右边缘"倾斜，下边比上边略宽
            const slopeRight = 5; // 下边比上边多出的宽度
            const barHeight = yScale.bandwidth();
            
            // 顶部：从 barLeft 到 barLeft + barWidth（左侧竖直线为barLeft）
            // 底部：左侧同样 barLeft，右侧为 barLeft + barWidth + slopeRight
            const pathDataRight = [
                `M ${barLeft}                ${yPos}`,               // 左上(竖直边的上端)
                `L ${barLeft + barWidth}     ${yPos}`,               // 右上
                `L ${barLeft + barWidth + slopeRight} ${yPos + barHeight}`, // 右下(向右偏移 slope)
                `L ${barLeft}                ${yPos + barHeight}`,   // 左下(竖直边的下端)
                "Z"
            ].join(" ");
            
            g.append("path")
                .attr("d", pathDataRight)
                .attr("fill", variables.has_gradient ?
                    `url(#gradient-${rightGroup.replace(/\s+/g, '-').toLowerCase()})` :
                    getColor(rightGroup)
                )
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
            
            // ------- 以下是数值标签原逻辑，不作改动 -------
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            const tempText = g.append("text")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("visibility", "hidden")
                .text(formattedValue);
            
            const textWidth = tempText.node().getBBox().width;
            tempText.remove();
            
            let textX = barLeft + barWidth/2;
            if (textX - textWidth/2 < barLeft) {
                textX = barLeft + textWidth/2 + 2;
            }
            g.append("text")
                    .attr("class", "label")
                    .attr("x", barLeft + barWidth + slopeRight*2)
                    .attr("y", yPos + yScale.bandwidth()/2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("fill", colors.text_color)
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("pointer-events", "none")
                    .text(formattedValue);
            // if (barWidth < textWidth) {
            //     g.append("text")
            //         .attr("class", "label")
            //         .attr("x", barLeft + barWidth + slopeRight*1.4)
            //         .attr("y", yPos + yScale.bandwidth()/2)
            //         .attr("dy", "0.35em")
            //         .attr("text-anchor", "start")
            //         .style("fill", colors.text_color)
            //         .style("font-family", typography.annotation.font_family)
            //         .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
            //         .style("font-weight", typography.annotation.font_weight)
            //         .style("pointer-events", "none")
            //         .text(formattedValue);
            // } else {
            //     g.append("text")
            //         .attr("class", "label")
            //         .attr("x", textX)
            //         .attr("y", yPos + yScale.bandwidth()/2)
            //         .attr("dy", "0.35em")
            //         .attr("text-anchor", "middle")
            //         .style("fill", "#ffffff")
            //         .style("font-family", typography.annotation.font_family)
            //         .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
            //         .style("font-weight", typography.annotation.font_weight)
            //         .style("pointer-events", "none")
            //         .text(formattedValue);
            // }
        }
    });
    
    // 返回SVG节点
    return svg.node();
}
