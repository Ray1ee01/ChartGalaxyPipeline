/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Stacked Bar Chart",
    "chart_name": "horizontal_stacked_bar_chart_2_hand",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 30], [0, "inf"], [2, 2]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
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

// 水平堆叠条形图实现 - 使用D3.js
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
    
    // 清空容器 - 在添加新图表前移除可能存在的内容
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸和边距
    const width = variables.width;                  // 图表总宽度
    const height = variables.height;                // 图表总高度
    // 边距：top-顶部，right-右侧，bottom-底部，left-左侧
    const margin = { top: 80, right: 160, bottom: 40, left: 60 };
    
    // 计算实际绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;    // 绘图区宽度
    const innerHeight = height - margin.top - margin.bottom;  // 绘图区高度
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 提取字段名称
    const dimensionField = dataColumns.length > 0 ? dataColumns[0].name : "dimension";
    const valueField = dataColumns.length > 1 ? dataColumns[1].name : "value";
    const groupField = dataColumns.length > 2 ? dataColumns[2].name : "group";
    
    // 获取所有字段的单位（如果存在且不是"none"）
    let dimensionUnit = "";
    let valueUnit = "";
    let groupUnit = "";
    
    // 维度字段的单位
    if (dataColumns.length > 0 && dataColumns[0].unit && dataColumns[0].unit !== "none") {
        dimensionUnit = dataColumns[0].unit;
    }
    
    // 数值字段的单位
    if (dataColumns.length > 1 && dataColumns[1].unit && dataColumns[1].unit !== "none") {
        valueUnit = dataColumns[1].unit;
    }
    
    // 分组字段的单位
    if (dataColumns.length > 2 && dataColumns[2].unit && dataColumns[2].unit !== "none") {
        groupUnit = dataColumns[2].unit;
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值和分组值
    const allDimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 找到要用的两个数据组（排除Total Paid Leave，因为它在图中不显示为单独的条）
    const displayGroups = groups.filter(g => g !== "Total Paid Leave");
    const firstGroup = displayGroups[0];  // 第一组（通常是年假）
    const secondGroup = displayGroups[1]; // 第二组（通常是公共假期）
    
    // 计算每个维度的总值，用于排序
    const dimensionTotals = {};
    allDimensions.forEach(dimension => {
        let total = 0;
        displayGroups.forEach(group => {
            const dataPoint = chartData.find(d => d[dimensionField] === dimension && d[groupField] === group);
            if (dataPoint) {
                total += +dataPoint[valueField];
            }
        });
        dimensionTotals[dimension] = total;
    });
    
    // 按总值降序排序维度
    const dimensions = [...allDimensions].sort((a, b) => {
        // 先按总值排序
        const diff = dimensionTotals[b] - dimensionTotals[a];
        if (diff !== 0) return diff;
        
        // 如果总值相同，按字母顺序排序
        return a.localeCompare(b);
    });
    
    // ---------- 5. 动态计算标签区域宽度 ----------
    
    // 创建临时SVG容器用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 标志尺寸
    const flagWidth = 20;
    const flagHeight = 15;
    const flagPadding = 5;
    
    // 图例方块尺寸
    const legendSquareSize = 12;
    const legendSpacing = 5;
    
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
        const totalWidth = flagWidth + flagPadding + textWidth;
        
        maxLabelWidth = Math.max(maxLabelWidth, totalWidth);
        
        tempText.remove();
    });
    
    // 计算组标签宽度，用于图例
    let maxGroupWidth = 0;
    displayGroups.forEach(group => {
        const formattedGroup = groupUnit ? 
            `${group}${groupUnit}` : 
            `${group}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(formattedGroup);
        
        const textWidth = tempText.node().getBBox().width;
        
        maxGroupWidth = Math.max(maxGroupWidth, textWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 调整左侧边距，确保有足够空间放置标签和国旗
    margin.left = Math.max(margin.left, maxLabelWidth + 20);
    
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
    
    // 获取颜色辅助函数
    const getColor = (group) => {
        return colors.field && colors.field[group] ? colors.field[group] : colors.other.primary;
    };
    
    // 添加阴影效果（如果启用）
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
    
    // 添加渐变效果（如果启用）
    if (variables.has_gradient) {
        displayGroups.forEach(group => {
            const gradientId = `gradient-${group.replace(/\s+/g, '-').toLowerCase()}`;
            const baseColor = getColor(group);
            
            const gradient = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(baseColor).brighter(0.5));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(baseColor).darker(0.3));
        });
    }

    //  7.添加组图例
    // Create legend group with better positioning
    const legendGroup = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top - 20})`);

    // Add legend
    const legendGap = 10;  // Gap between legends
    const availableWidth = innerWidth + margin.right -20; // Available width for legends

    // First group legend
    const legend1 = legendGroup.append("g");
    legend1.append("rect")
        .attr("width", legendSquareSize * 1.5)
        .attr("height", legendSquareSize * 1.5)
        .attr("fill", getColor(firstGroup));

    // Add first legend text with variable font size
    let fontSize1 = parseFloat(typography.label.font_size);
    const legendText1 = legend1.append("text")
        .attr("x", legendSquareSize * 1.5 + legendSpacing)
        .attr("y", legendSquareSize * 1.5 / 2)
        .attr("dy", "0.35em")
        .style("font-family", typography.label.font_family)
        .style("font-size", `${fontSize1}px`)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(firstGroup);

    // Calculate first legend width
    const legend1Width = legendSquareSize * 1.5 + legendSpacing + 
        legendText1.node().getBBox().width;

    // Initialize second legend position
    let legend2X = legend1Width + legendGap;

    // Second group legend
    const legend2 = legendGroup.append("g")
        .attr("transform", `translate(${legend2X}, 0)`);

    legend2.append("rect")
        .attr("width", legendSquareSize * 1.5)
        .attr("height", legendSquareSize * 1.5)
        .attr("fill", getColor(secondGroup));

    // Add second legend text with initial font size
    let fontSize2 = fontSize1;
    const legendText2 = legend2.append("text")
        .attr("x", legendSquareSize * 1.5 + legendSpacing)
        .attr("y", legendSquareSize * 1.5 / 2)
        .attr("dy", "0.35em")
        .style("font-family", typography.label.font_family)
        .style("font-size", `${fontSize2}px`)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(secondGroup);

    // Check if second legend extends beyond drawing area
    const legend2Width = legendSquareSize * 1.5 + legendSpacing + 
        legendText2.node().getBBox().width;
    const legend2RightEdge = legend2X + legend2Width;

    // Adjust font size if legends overflow
    if (legend2RightEdge > availableWidth) {
        // Reduce font size until it fits
        while (legend2RightEdge > availableWidth && fontSize2 > 8) {
            // Reduce font size
            fontSize2 -= 0.5;
            fontSize1 = fontSize2; // Keep same size for both legends
            
            // Update font sizes
            legendText1.style("font-size", `${fontSize1}px`);
            legendText2.style("font-size", `${fontSize2}px`);
            
            // Recalculate widths
            const newLegend1Width = legendSquareSize * 1.5 + legendSpacing + 
                legendText1.node().getBBox().width;
                
            // Update legend2 position
            legend2X = newLegend1Width + legendGap;
            legend2.attr("transform", `translate(${legend2X}, 0)`);
            
            // Check if it now fits
            const newLegend2Width = legendSquareSize * 1.5 + legendSpacing + 
                legendText2.node().getBBox().width;
            const newLegend2RightEdge = legend2X + newLegend2Width;
            
            if (newLegend2RightEdge <= availableWidth) {
                break;
            }
        }
    }
    
    // ---------- 8. 创建主绘图组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 9. 创建比例尺 ----------
    
    // 获取描边颜色
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333";
    };
    const strokeColor = getStrokeColor();
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(variables.has_spacing ? 0.3 : 0.2);
    
    // 计算最大总值
    const maxTotal = d3.max(Object.values(dimensionTotals));
    
    // X轴比例尺（用于数值） - 使用更多的可用空间，只保留5%的右侧边距
    const xScale = d3.scaleLinear()
        .domain([0, maxTotal * 1.05])
        .range([0, innerWidth]);
    
    // ---------- 10. 添加交替行背景 ----------
    if (jsonData.variation?.background === "styled") {
        dimensions.forEach((dimension, i) => {
            if (i % 2 === 0) {
                g.append("rect")
                    .attr("x", -margin.left/2)
                    .attr("y", yScale(dimension))
                    .attr("width", innerWidth + margin.left/2 + margin.right/2)
                    .attr("height", yScale.bandwidth())
                    .attr("class","background")
                    .attr("fill", colors.background_color || "#f5f5f5")
                    .attr("opacity", 0.8);
            }
        });
    }
    
    // ---------- 11. 绘制条形图和标签 ----------

    // 创建临时SVG元素用于测量文本宽度 (在循环外部创建，提高效率)
    const tempTextSvg = svg.append("g")
        .attr("visibility", "hidden");

    // 估算标签宽度的函数
    const estimateLabelWidth = (text) => {
        // 清空之前的文本
        tempTextSvg.selectAll("text").remove(); 
        
        const tempText = tempTextSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .text(text);
        
        const width = tempText.node().getBBox().width;
        // tempText.remove(); // 不需要移除，下次调用会清空
        return width;
    };
    
    // 格式化函数
    const formatValue = (value) => {
        return valueUnit ? `${value}${valueUnit}` : `${value}`;
    };

    // 标签内边距
    const labelPadding = 5;

    // 绘制条形和标签
    dimensions.forEach((dimension, dimIndex) => {
        // 当前行的Y位置
        const barY = yScale(dimension);
        const barHeight = yScale.bandwidth();
        const centerY = barY + barHeight / 2; // 垂直居中位置
        
        // 获取数据点
        const firstGroupData = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === firstGroup);
        const secondGroupData = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === secondGroup);
        
        // 绘制图标和维度标签 (这部分逻辑不变)
        const iconSize = Math.min(64, barHeight - 8); // 图标大小为条高度减8，最大为64
        const flagWidth = iconSize;
        const flagHeight = iconSize * 0.75; // 保持原有的宽高比
        const flagX = -flagWidth - flagPadding - 5; 
        
        // 添加图标（如果有）
        if (images.field && images.field[dimension]) {
            g.append("image")
                .attr("x", flagX)
                .attr("y", centerY - flagHeight / 2)
                .attr("width", flagWidth)
                .attr("height", flagHeight)
                .attr("preserveAspectRatio","xMidYMid meet")
                .attr("xlink:href", images.field[dimension]);
        }
        
        // 添加维度标签
        g.append("text")
            .attr("x", flagX - 5)
            .attr("y", centerY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(dimension);
        
        // 初始化条形宽度和位置
        let firstBarWidth = 0;
        let secondBarWidth = 0;
        let totalBarWidth = 0;
        let xPos = 0; // 当前绘制位置

        // 用于记录外部标签信息
        let firstLabelIsOutside = false;
        let firstLabelOutsideX = 0;
        let firstLabelOutsideWidth = 0;

        // 绘制第一组条形和标签
        if (firstGroupData) {
            firstBarWidth = xScale(+firstGroupData[valueField]);
            totalBarWidth += firstBarWidth;

            // 绘制条形
            g.append("rect")
                .attr("x", xPos)
                .attr("y", barY)
                .attr("width", firstBarWidth)
                .attr("height", barHeight)
                .attr("fill", variables.has_gradient ? 
                    `url(#gradient-${firstGroup.replace(/\s+/g, '-').toLowerCase()})` : 
                    getColor(firstGroup))
                .attr("rx", variables.has_rounded_corners ? 3 : 0)
                .attr("ry", variables.has_rounded_corners ? 3 : 0)
                .style("stroke", variables.has_stroke ? strokeColor : "none")
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
                // 移除 hover 效果，避免干扰
                // .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
                // .on("mouseout", function() { d3.select(this).attr("opacity", 1); });

            // 处理第一组标签
            const labelText = formatValue(firstGroupData[valueField]);
            const labelWidth = estimateLabelWidth(labelText);
            let labelX, labelColor, textAnchor;

            let label_size = typography.annotation.font_size;
            if (firstBarWidth < labelWidth) {
                label_size = label_size * (firstBarWidth / labelWidth);
            }
            // 内部居中
            labelX = xPos + firstBarWidth / 2;
            labelColor = "#ffffff";
            textAnchor = "middle";
            firstLabelIsOutside = false;

            // 绘制标签 (如果放在外部，暂时不绘制，等第二组处理完一起绘制外部标签)
            if (!firstLabelIsOutside) {
                g.append("text")
                    .attr("x", labelX)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", textAnchor)
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", label_size)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", labelColor)
                    .text(labelText);
            }
            
            // 更新X位置
            xPos += firstBarWidth;
        }
        
        // 绘制第二组条形和标签
        if (secondGroupData) {
            secondBarWidth = xScale(+secondGroupData[valueField]);
            totalBarWidth += secondBarWidth;

            // 绘制条形
            g.append("rect")
                .attr("x", xPos) // 从第一组结束的位置开始
                .attr("y", barY)
                .attr("width", secondBarWidth)
                .attr("height", barHeight)
                .attr("fill", variables.has_gradient ? 
                    `url(#gradient-${secondGroup.replace(/\s+/g, '-').toLowerCase()})` : 
                    getColor(secondGroup))
                .attr("rx", variables.has_rounded_corners ? 3 : 0)
                .attr("ry", variables.has_rounded_corners ? 3 : 0)
                .style("stroke", variables.has_stroke ? strokeColor : "none")
                .style("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
                // .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
                // .on("mouseout", function() { d3.select(this).attr("opacity", 1); });
            
             // 处理第二组标签
            const labelText = formatValue(secondGroupData[valueField]);
            const labelWidth = estimateLabelWidth(labelText);
            let labelX, labelColor, textAnchor;

            if (secondBarWidth >= labelWidth + 2 * labelPadding) {
                // 内部居中
                labelX = xPos + secondBarWidth / 2; // 在第二段内部居中
                labelColor = "#ffffff";
                textAnchor = "middle";

                 // 绘制标签
                 g.append("text")
                    .attr("x", labelX)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", textAnchor)
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", typography.annotation.font_size)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", labelColor)
                    .text(labelText);

            } else {
                 // 外部放置
                 if (firstLabelIsOutside) {
                     // 如果第一组也在外部，放在第一组外部标签的右侧
                     labelX = firstLabelOutsideX + firstLabelOutsideWidth + labelPadding;
                 } else {
                     // 否则，放在总条形的右侧
                     labelX = totalBarWidth + labelPadding;
                 }
                 labelColor = colors.text_color;
                 textAnchor = "start";

                 // 绘制标签
                 g.append("text")
                    .attr("x", labelX)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", textAnchor)
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", typography.annotation.font_size)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", labelColor)
                    .text(labelText);
            }
        }

        // 现在绘制可能被延迟的第一组外部标签
        if (firstLabelIsOutside) {
             g.append("text")
                .attr("x", firstLabelOutsideX)
                .attr("y", centerY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start") // 外部标签始终左对齐
                .style("font-family", typography.annotation.font_family)
                .style("font-size", typography.annotation.font_size)
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", colors.text_color) // 外部标签用默认色
                .text(formatValue(firstGroupData[valueField])); // 获取文本
        }

    });

    // 移除临时SVG元素
    tempTextSvg.remove();
    const roughness = 1;
    const bowing = 1;
    const fillStyle = "solid";
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