/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Stacked Bar Chart",
    "chart_name": "horizontal_stacked_bar_chart_5_hand",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 30], [0, "inf"], [2, 4]],
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
    "has_x_axis": "yes",
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
    };
    
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
    const margin = { top: 80, right: 160, bottom: 60, left: 80 }; // 增加左侧边距用于图标
    
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
    
    // 过滤出要显示的组（排除Total Paid Leave，因为它通常是前两组的总和）
    const displayGroups = groups.filter(g => g !== "Total Paid Leave");
    
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
    
    // 标志/图标尺寸
    const iconSize = 32; // 设置图标大小为32px
    const iconPadding = 10;
    
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
        const totalWidth = iconSize + iconPadding + textWidth;
        
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
    
    // 调整左侧边距，确保有足够空间放置标签和图标
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
    
    // 绘制所有组的图例
    let currentX = 0;
    const legendItems = [];
    
    // 为每个组创建图例
    displayGroups.forEach((group, i) => {
        const legend = legendGroup.append("g")
            .attr("transform", `translate(${currentX}, 0)`);
            
        legend.append("rect")
            .attr("width", legendSquareSize)
            .attr("height", legendSquareSize)
            .attr("fill", getColor(group));
            
        // 添加图例文本
        let fontSize = parseFloat(typography.label.font_size);
        const legendText = legend.append("text")
            .attr("x", legendSquareSize + legendSpacing)
            .attr("y", legendSquareSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${fontSize}px`)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(group);
            
        // 计算此图例项的宽度
        const legendWidth = legendSquareSize + legendSpacing + 
            legendText.node().getBBox().width;
            
        // 存储图例项信息
        legendItems.push({
            group: group,
            element: legend,
            text: legendText,
            width: legendWidth,
            x: currentX
        });
        
        // 更新下一个图例的X位置
        currentX += legendWidth + legendGap;
    });
    
    // 检查图例是否超出可用宽度
    const totalLegendWidth = currentX - legendGap;
    
    if (totalLegendWidth > availableWidth) {
        // 需要调整字体大小以适应
        let fontSize = parseFloat(typography.label.font_size);
        let fits = false;
        
        // 逐步减小字体直到适合
        while (!fits && fontSize > 8) {
            fontSize -= 0.5;
            currentX = 0;
            
            // 使用新字体大小更新所有图例项
            legendItems.forEach(item => {
                item.text.style("font-size", `${fontSize}px`);
                const newWidth = legendSquareSize + legendSpacing + 
                    item.text.node().getBBox().width;
                item.width = newWidth;
                item.x = currentX;
                item.element.attr("transform", `translate(${currentX}, 0)`);
                currentX += newWidth + legendGap;
            });
            
            // 检查是否现在适合
            if (currentX - legendGap <= availableWidth) {
                fits = true;
            }
        }
        
        // 如果仍然不适合，可能需要将图例分成多行
        if (!fits) {
            // 为简化起见，这里不实现多行图例
            // 但在实际应用中可以在这里添加多行图例逻辑
        }
    }
    
    // ---------- 8. 创建主绘图组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 9. 创建比例尺和条形高度设置 ----------
    
    // 获取描边颜色
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333";
    };
    const strokeColor = getStrokeColor();
    
    // 设置条形图的最大和最小高度
    const maxBarHeight = 24; // 最大高度24px
    const minBarHeight = 16; // 最小高度16px
    
    // 计算适合的条形高度 - 根据数据量调整，但在min-max范围内
    const calculatedBarHeight = Math.min(
        maxBarHeight, 
        Math.max(minBarHeight, innerHeight / dimensions.length / 2.5)
    );
    
    // 标签和条形之间的间距
    const barLabelGap = 5; // 增加到5px，与图中效果一致
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.5); // 增加padding使条形间距更大
    
    // 计算最大总值
    const maxTotal = d3.max(Object.values(dimensionTotals));
    
    // X轴比例尺（用于数值）
    const xScale = d3.scaleLinear()
        .domain([0, maxTotal * 1.05])
        .range([0, innerWidth]);
    
    // ---------- 10. 添加X轴（数值轴）----------
    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickSize(0) // 移除网格线
        .tickFormat(d => {
            // 如果单位长度大于3，则不显示单位
            if (valueUnit && valueUnit.length > 3) {
                return d;
            } else {
                return valueUnit ? `${d}${valueUnit}` : d;
            }
        });
    
    // 添加X轴，但移除轴线
    const xAxisG = g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);
    
    // 移除所有轴线和刻度线
    xAxisG.select("path.domain").remove();
    xAxisG.selectAll(".tick line").remove();
    
    // 仅保留文本
    xAxisG.selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", colors.text_color);
    
    // ---------- 11. 添加交替行背景 ----------
    if (jsonData.variation?.background === "styled") {
        dimensions.forEach((dimension, i) => {
            if (i % 2 === 0) {
                g.append("rect")
                    .attr("x", -margin.left/2)
                    .attr("y", yScale(dimension) - yScale.bandwidth()/2)
                    .attr("width", innerWidth + margin.left/2 + margin.right/2)
                    .attr("height", yScale.bandwidth())
                    .attr("class","background")
                    .attr("fill", colors.background_color || "#f5f5f5")
                    .attr("opacity", 0.8);
            }
        });
    }
    
    // ---------- 12. 绘制条形图和标签 ----------
    
    // 创建临时SVG元素用于测量文本宽度
    const tempTextSvg = svg.append("g")
        .attr("visibility", "hidden");

    // 估算标签宽度的函数
    const estimateLabelWidth = (text) => {
        // 清空之前的文本
        tempTextSvg.selectAll("text").remove(); 
        
        const tempText = tempTextSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", "14px") // 增大字体
            .style("font-weight", typography.annotation.font_weight)
            .text(text);
        
        const width = tempText.node().getBBox().width;
        return width;
    };
    
    // 格式化函数 - 如果单位长度超过3，不显示单位
    const formatValueWithUnit = (value) => {
        const formattedValue = formatValue(value);
        if (valueUnit && valueUnit.length > 3) {
            return `${formattedValue}`;
        } else {
            return valueUnit ? `${formattedValue}${valueUnit}` : `${formattedValue}`;
        }
    };

    // 标签内边距和偏移量
    const labelPadding = 4;

    // 绘制条形和标签
    dimensions.forEach((dimension, dimIndex) => {
        // 获取当前行的Y位置（中心）
        const rowCenterY = yScale(dimension);
        
        // 条形放在中心偏上
        const barY = rowCenterY - calculatedBarHeight - barLabelGap;
        const barHeight = calculatedBarHeight;
        
        // 标签位置下移5px
        const labelY = barY + barHeight + barLabelGap + labelPadding + 5;
        
        // 绘制图标和维度标签
        const iconX = -iconSize - iconPadding; 
        
        // 添加图标（如果有）
        if (images.field && images.field[dimension]) {
            g.append("image")
                .attr("x", iconX)
                .attr("y", rowCenterY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio","xMidYMid meet")
                .attr("xlink:href", images.field[dimension]);
        }
        
        // 添加维度标签
        g.append("text")
            .attr("x", iconX - 5)
            .attr("y", rowCenterY + 5)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(dimension);
        
        // 初始化X位置
        let xPos = 0; // 当前绘制位置
        
        // 保存标签数据以便之后处理重叠
        const labelData = [];

        // 为每个组绘制条形和收集标签数据
        displayGroups.forEach(group => {
            // 查找该维度和组的数据点
            const dataPoint = chartData.find(d => 
                d[dimensionField] === dimension && d[groupField] === group);
                
            if (dataPoint) {
                const barWidth = xScale(+dataPoint[valueField]);
                
                // 绘制条形
                g.append("rect")
                    .attr("x", xPos)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("fill", variables.has_gradient ? 
                        `url(#gradient-${group.replace(/\s+/g, '-').toLowerCase()})` : 
                        getColor(group))
                    .attr("rx", variables.has_rounded_corners ? 3 : 0)
                    .attr("ry", variables.has_rounded_corners ? 3 : 0)
                    .style("stroke", variables.has_stroke ? strokeColor : "none")
                    .style("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none");

                // 收集标签数据
                const labelText = formatValueWithUnit(+dataPoint[valueField]);
                const labelWidth = estimateLabelWidth(labelText);
                
                // 标签位置 - 默认放在条形图下方右对齐
                labelData.push({
                    text: labelText,
                    x: xPos + barWidth,
                    y: labelY,
                    width: labelWidth,
                    color: getColor(group),
                    barEndX: xPos + barWidth,
                    barStartX: xPos,
                    barWidth: barWidth,
                    group: group
                });
                
                // 更新X位置
                xPos += barWidth;
            }
        });
        
        // 处理标签重叠和位置调整
        if (labelData.length > 0) {
            // 设置所有标签的初始文本锚点为右对齐
            labelData.forEach(label => {
                label.textAnchor = "end";
                // 计算初始左边界
                label.leftEdge = label.x - label.width;
                // 检查是否超出左边界
                label.outOfBounds = label.leftEdge < label.barStartX;
            });
            
            // 处理超出左边界的标签
            labelData.forEach(label => {
                if (label.outOfBounds) {
                    // 如果条形宽度足够容纳文本+一些边距，则居中显示
                    if (label.barWidth > label.width + 10) {
                        label.x = label.barStartX + label.barWidth / 2;
                        label.textAnchor = "middle";
                    } else {
                        // 否则靠左侧显示
                        label.x = label.barStartX + 5; // 略微缩进
                        label.textAnchor = "start";
                    }
                }
            });
            
            // 更新所有标签的边界坐标
            labelData.forEach(label => {
                if (label.textAnchor === "end") {
                    label.rightEdge = label.x;
                    label.leftEdge = label.x - label.width;
                } else if (label.textAnchor === "middle") {
                    label.rightEdge = label.x + label.width / 2;
                    label.leftEdge = label.x - label.width / 2;
                } else { // start
                    label.rightEdge = label.x + label.width;
                    label.leftEdge = label.x;
                }
            });
            
            // 排序标签，从左到右
            labelData.sort((a, b) => a.barStartX - b.barStartX);
            
            // 处理标签重叠
            const minSpaceBetween = 15; // 标签之间的最小间距
            
            // 从左到右检查和修复重叠
            for (let i = 0; i < labelData.length - 1; i++) {
                const currentLabel = labelData[i];
                const nextLabel = labelData[i + 1];
                
                // 检查当前标签与下一个标签是否重叠
                if (currentLabel.rightEdge + minSpaceBetween > nextLabel.leftEdge) {
                    // 重叠处理策略：
                    // 1. 尝试将下一个标签向右移动
                    nextLabel.textAnchor = "start";
                    nextLabel.x = currentLabel.rightEdge + minSpaceBetween;
                    
                    // 更新边界
                    nextLabel.rightEdge = nextLabel.x + nextLabel.width;
                    nextLabel.leftEdge = nextLabel.x;
                    
                }
            }
            
            // 最后一轮检查 - 处理可能因前面调整产生的新重叠
            // 这种情况可能发生在有3个以上标签且空间紧张时
            for (let i = 0; i < labelData.length - 1; i++) {
                const currentLabel = labelData[i];
                let nextLabel = labelData[i + 1];
                
                // 如果已经垂直错开，则跳过
                if (nextLabel.offsetVertical) continue;
                
                // 再次检查重叠
                if (currentLabel.rightEdge + minSpaceBetween > nextLabel.leftEdge) {
                    // 如果仍然重叠，使用垂直错开
                    nextLabel.y += barHeight + 5;
                    nextLabel.offsetVertical = true;
                }
            }
        }
        
        // 为每个标签绘制半透明背景条形
        labelData.forEach(label => {
            // 绘制灰色半透明背景条形
            g.append("rect")
                .attr("x", label.barStartX)
                .attr("y", label.y - barHeight/2) // 垂直居中于标签
                .attr("width", label.barWidth)
                .attr("height", barHeight)
                .attr("fill", "white")
                .attr("opacity", 0.5)
                .attr("rx", variables.has_rounded_corners ? 3 : 0)
                .attr("ry", variables.has_rounded_corners ? 3 : 0);
        });
        
        // 绘制所有标签
        labelData.forEach(label => {
            g.append("text")
                .attr("x", label.x)
                .attr("y", label.y)
                .attr("text-anchor", label.textAnchor || "end") // 默认右对齐
                .style("font-family", typography.annotation.font_family)
                .style("font-size", "14px") // 增大字体
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", label.color)
                .text(label.text);
        });
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