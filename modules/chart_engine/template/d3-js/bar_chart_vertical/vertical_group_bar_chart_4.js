/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Group Bar Chart",
    "chart_name": "vertical_group_bar_chart_4",
    "is_composite": false,
    "required_fields": ["x", "y", "group","group2"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"], ["categorical"]],
    "required_fields_range": [[2, 8], [0, "inf"], [2, 2], [2, 2]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
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

// 垂直分组条形图实现
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    // 提取数据和配置
    const jsonData = data;                          
    const chartData = jsonData.data.data || [];          
    const variables = jsonData.variables || {};     
    const typography = jsonData.typography || {     
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333", 
        field: {},
        other: { primary: "#4682B4" } 
    };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];
    
    // 如果不存在，添加副标题字段
    typography.subtitle = typography.subtitle || typography.description;
    
    // 设置视觉效果变量
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 清除容器
    d3.select(containerSelector).html("");
    
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
    
    // ---------- 2. 尺寸和布局设置 ----------
    // 设置图表尺寸和边距
    const width = variables.width || 800;
    const height = variables.height || 500;
    
    // 边距：上，右，下，左
    const margin = { 
        top: 100,    // 标题和副标题的空间
        right: 30,   // 右侧标签的空间
        bottom: 60,  // x轴和标签的空间
        left: 100    // y轴和标签的空间
    };
    
    // 计算实际绘图区域大小
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 3. 提取字段名称和单位 ----------
    let xField, yField, group1Field, group2Field;
    let yUnit = "";
    
    // 从数据列中安全提取字段名称
    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    
    
    if (xColumn) xField = xColumn.name;
    if (yColumn) yField = yColumn.name;
    group1Field = dataColumns.filter(col => col.role === "group")[0].name;
    group2Field = dataColumns.filter(col => col.role === "group2")[0].name;
    
    // 获取字段单位（如果存在）
    if (yColumn && yColumn.unit && yColumn.unit !== "none") {
        yUnit = yColumn.unit;
    }
    
    // ---------- 4. 数据处理 ----------
    // 使用提供的数据
    let useData = chartData;
    
    // 获取x轴和分组的唯一值
    const xValues = [...new Set(useData.map(d => d[xField]))];
    const group1Values = [...new Set(useData.map(d => d[group1Field]))]; // 第一个分组字段的唯一值
    const group2Values = [...new Set(useData.map(d => d[group2Field]))]; // 第二个分组字段的唯一值
    
    // ---------- 5. 创建SVG容器 ----------
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // ---------- 6. 创建视觉效果 ----------
    const defs = svg.append("defs");
    
    // 如果需要，创建阴影滤镜
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
    
    // ---------- 7. 创建图表区域 ----------
    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    
    
    // ---------- 8. 创建比例尺 ----------
    // X比例尺（分类）用于主分类
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.2);
    
    // Y比例尺（数值）
    // 找出数据中的最大值，如果没有则默认为100
    const dataMax = d3.max(useData, d => +d[yField]) || 100;
    // 向上取整到最接近的10，20，50或100
    let yMax;
    if (dataMax <= 10) yMax = 10;
    else if (dataMax <= 20) yMax = 20;
    else if (dataMax <= 50) yMax = 50;
    else if (dataMax <= 100) yMax = 100;
    else yMax = Math.ceil(dataMax / 100) * 100;
    
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerHeight, 0]);
    
    // 分组比例尺，用于每个类别内的细分
    const totalGroups = group1Values.length * group2Values.length;
    const groupScale = d3.scaleBand()
        .domain(d3.range(totalGroups))
        .range([0, xScale.bandwidth()])
        .padding(variables.has_spacing ? 0.1 : 0.05);
    
    // 从颜色数据中获取group1的颜色映射
    const colorMap = {};
    
    // 为每个group1值分配一个基础颜色
    group1Values.forEach(g1Value => {
        // 尝试从数据中获取颜色
        const baseColor = colors.field[g1Value] || colors.other.primary || "#4682B4";
        
        // 为group2的每个值分配不同深浅的颜色
        group2Values.forEach((g2Value, i) => {
            // 根据索引调整颜色深浅
            let colorVariant;
            if (group2Values.length === 1) {
                colorVariant = baseColor;
            } else if (group2Values.length === 2) {
                // 如果只有两个值，一个浅色一个深色
                if (i === 0) {
                    colorVariant = lightenColor(baseColor, 30); // 第一个值使用浅色
                } else {
                    colorVariant = baseColor; // 第二个值使用原色
                }
            } else {
                // 如果有多个值，创建颜色梯度
                const step = 60 / (group2Values.length - 1);
                colorVariant = lightenColor(baseColor, 40 - (i * step));
            }
            
            // 存储颜色映射
            colorMap[`${g1Value} ${g2Value}`] = colorVariant;
        });
    });
    
    // 辅助函数：根据百分比调亮颜色
    function lightenColor(color, percent) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        const lightenR = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
        const lightenG = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
        const lightenB = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
        
        return `#${lightenR.toString(16).padStart(2, '0')}${lightenG.toString(16).padStart(2, '0')}${lightenB.toString(16).padStart(2, '0')}`;
    }
    
    // ---------- 9. 创建坐标轴 ----------
    // 底部的X轴
    chart.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0))
        .call(g => {
            g.select(".domain").remove();
            
            // 计算四个小柱子的总宽度
            const fourBarsWidth = 4 * groupScale.bandwidth();
            
            // 找出最长的x轴标签
            let maxLabelLength = 0;
            let longestLabel = '';
            xValues.forEach(value => {
                if (value.toString().length > maxLabelLength) {
                    maxLabelLength = value.toString().length;
                    longestLabel = value.toString();
                }
            });
            
            // 创建临时文本元素来测量文本宽度
            const tempText = chart.append("text")
                .style("font-family", typography.label.font_family)
                .style("font-size", "10px") // 起始字体大小
                .style("font-weight", typography.label.font_weight)
                .text(longestLabel)
                .attr("visibility", "hidden");
            
            // 计算文本长度与所需长度的比率
            const tempTextLength = tempText.node().getComputedTextLength();
            const targetLength = fourBarsWidth * 1.2; // 四个小柱子宽度的1.1倍
            const ratio = targetLength / tempTextLength;
            
            // 计算新的字体大小
            const newFontSize = Math.max(4,  Math.floor(10 * ratio)); // 限制字体大小在8px到16px之间
            
            // 移除临时文本
            tempText.remove();
            
            // 应用新的字体大小
            g.selectAll(".tick text")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${newFontSize}px`)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color);
        });
    
   
    
    // ---------- 10. 绘制条形和为标签收集数据 ----------
    // 创建一个对象来存储每个x值和group1值组合的数据，用于后续绘制标签
    const labelData = {};
    
    // 为每个x值和分组组合绘制条形
    xValues.forEach(xValue => {
        // 筛选此x值的数据
        const xData = useData.filter(d => d[xField] === xValue);
        
        // 初始化此x值的标签数据
        labelData[xValue] = {};
        
        // 为每个group1值初始化数据数组
        group1Values.forEach(g1Value => {
            labelData[xValue][g1Value] = [];
        });
        
        // 为每个group1和group2组合绘制条形
        let groupIndex = 0;
        
        // 首先按group1分组，然后按group2分组
        group1Values.forEach(g1Value => {
            // 这里的 g1Value 对应样图中的 "2011-12" 或 "2020-21"
            group2Values.forEach((g2Value, g2Index) => {
                // 这里的 g2Value 对应样图中的 "Male" 或 "Female"
                
                // 查找此组合的数据点
                const dataPoint = xData.find(d => 
                    d[group1Field] === g1Value && 
                    d[group2Field] === g2Value
                );
                
                if (dataPoint) {
                    // 计算条形位置和尺寸
                    const barX = xScale(xValue) + groupScale(groupIndex);
                    const barY = yScale(dataPoint[yField]);
                    const barWidth = groupScale.bandwidth();
                    const barHeight = innerHeight - barY;
                    
                    // 获取此组合的颜色
                    const colorKey = `${g1Value} ${g2Value}`;
                    const barColor = colorMap[colorKey];
                    
                    // 绘制条形
                    chart.append("rect")
                        .attr("class", "bar")
                        .attr("x", barX)
                        .attr("y", barY)
                        .attr("width", barWidth)
                        .attr("height", barHeight)
                        .attr("fill", barColor)
                        .attr("rx", variables.has_rounded_corners ? 2 : 0)
                        .attr("ry", variables.has_rounded_corners ? 2 : 0)
                        .attr("stroke", variables.has_stroke ? "#555" : "none")
                        .attr("stroke-width", variables.has_stroke ? 1 : 0)
                        .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
                    
                    // 存储此条形的数据，以便后续绘制标签
                    labelData[xValue][g1Value].push({
                        value: dataPoint[yField],
                        barX: barX,
                        barWidth: barWidth,
                        barY: barY,
                        g2Index: g2Index // 保存group2的索引，以便知道哪个是第一个，哪个是第二个
                    });
                }
                
                groupIndex++;
            });
        });
    });
    
    // ---------- 11. 绘制标签 ----------
    // 为每个x值处理标签
    Object.keys(labelData).forEach(xValue => {
        // 为每个group1值处理标签
        Object.keys(labelData[xValue]).forEach(g1Value => {
            // 获取此group1值的所有条形数据
            const bars = labelData[xValue][g1Value];
            
            // 排序，确保按group2索引顺序处理
            bars.sort((a, b) => a.g2Index - b.g2Index);
            
            // 确保我们有两个条形（对应两个group2值）
            if (bars.length === 2) {
                // 获取两个条形
                const bar1 = bars[0]; // 第一个条形 (g2Index=0, 例如 Male)
                const bar2 = bars[1]; // 第二个条形 (g2Index=1, 例如 Female)
                
                // 找出两个条形的最小Y值（最高点，因为Y轴是反的）
                const minY = Math.min(bar1.barY, bar2.barY);
                
                // 计算两个条形之间的中心点 - 保持文本居中
                const textCenterX = bar1.barX + bar1.barWidth + (bar2.barX - (bar1.barX + bar1.barWidth)) / 2;
                
                // 计算标签背景矩形的宽度和高度
                const labelWidth = (bar1.barWidth + bar2.barWidth) * 0.9; // 两个柱子宽度之和的90%
                const labelHeight = (bar1.barWidth + bar2.barWidth) * 0.5; // 标签高度
                const labelPadding = 5; // 两个标签之间的垂直间距
                
                // 获取对应的颜色
                const color1 = colorMap[`${g1Value} ${group2Values[0]}`]; // 第一个条形的颜色
                const color2 = colorMap[`${g1Value} ${group2Values[1]}`]; // 第二个条形的颜色
                
                // 绘制第二个条形的标签背景和文本
                chart.append("rect")
                    .attr("x", bar1.barX) // Align background to the left edge of the first bar
                    .attr("y", minY - labelHeight - 5 )
                    .attr("width", labelWidth)
                    .attr("height", labelHeight)
                    .attr("fill", color2)
                    .attr("rx", variables.has_rounded_corners ? 2 : 0)
                    .attr("ry", variables.has_rounded_corners ? 2 : 0);
                
                chart.append("text")
                    .attr("class", "value-label")
                    .attr("x", textCenterX) // Keep text centered between bars
                    .attr("y", minY -5- labelHeight/2 ) // 垂直居中在矩形内
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", typography.label.font_family)
                    .style("font-size", `${labelHeight * 0.8}px`)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", "#FFFFFF") // 白色文本
                    .text(formatValue(bar2.value) + (yUnit ? ` ${yUnit}` : '')); // 使用格式化函数
                
                // 绘制第一个条形的标签背景和文本
                chart.append("rect")
                    .attr("x", bar1.barX) // Align background to the left edge of the first bar
                    .attr("y", minY - labelHeight - 5 - labelPadding - labelHeight)
                    .attr("width", labelWidth)
                    .attr("height", labelHeight)
                    .attr("fill", color1)
                    .attr("rx", variables.has_rounded_corners ? 2 : 0)
                    .attr("ry", variables.has_rounded_corners ? 2 : 0);
                
                chart.append("text")
                    .attr("class", "value-label")
                    .attr("x", textCenterX) // Keep text centered between bars
                    .attr("y", minY - 5 - labelHeight - labelPadding - labelHeight/2 ) // 垂直居中在矩形内
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", typography.label.font_family)
                    .style("font-size", `${labelHeight * 0.8}px`)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", "#FFFFFF") // 白色文本
                    .text(formatValue(bar1.value) + (yUnit ? ` ${yUnit}` : '')); // 使用格式化函数
            }
        });
    });
    
   

    // ---------- 12. 创建图例 ----------
    // 创建图例项数组
    const legendItems = [];

    // 为每个group2和group1组合创建图例项
    group2Values.forEach(g2Value => {
        group1Values.forEach(g1Value => {
            legendItems.push({
                group2: g2Value,
                group1: g1Value,
                color: colorMap[`${g1Value} ${g2Value}`]
            });
        });
    });

    // 预先测量所有文本宽度
    function measureTextWidth(text, fontSize, fontFamily, fontWeight) {
        const tempText = svg.append("text")
            .style("font-family", fontFamily)
            .style("font-size", fontSize)
            .style("font-weight", fontWeight)
            .text(text);
        
        const bbox = tempText.node().getBBox();
        tempText.remove();
        return bbox.width;
    }

    // 测量group2值（年份）的宽度
    const firstGroup2Width = measureTextWidth(group2Values[0], "16px", typography.label.font_family, "bold");
    const secondGroup2Width = measureTextWidth(group2Values[1], "16px", typography.label.font_family, "bold");

    // 测量所有group1值的宽度
    const group1Widths = {};
    group1Values.forEach(g1Value => {
        group1Widths[g1Value] = measureTextWidth(g1Value, "12px", typography.label.font_family, "normal");
    });

    // 找到最大的group1宽度
    const maxGroup1Width = Math.max(...Object.values(group1Widths));

    // 计算图例布局参数
    const legendPadding = 8;
    const legendRectSize = 15;
    const spaceBetweenRectAndText = 5;
    const spaceBetweenGroups = 30;
    const legendItemHeight = 25;

    // 计算两种布局的图例项组的宽度
    const legendGroupWidth = legendRectSize + spaceBetweenRectAndText + maxGroup1Width + legendPadding;

    // 计算图例总宽度
    const legendTotalWidth = firstGroup2Width + legendPadding + 
                            legendGroupWidth + spaceBetweenGroups + 
                            legendGroupWidth + legendPadding + secondGroup2Width;

    // 创建图例 - 居中顶部位置
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - legendTotalWidth}, ${margin.top - 50})`);

    // 当前X位置
    let currentX = 0;

    // 添加第一个年份标签（左侧）
    legend.append("text")
        .attr("x", currentX)
        .attr("y", 45)
        .attr("text-anchor", "start")
        .style("font-family", typography.label.font_family)
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("fill", colors.text_color)
        .text(group2Values[0]);

    currentX += firstGroup2Width + legendPadding;

    // 为第一个group2（例如"2011-12"）添加图例项
    for (let g1Index = 0; g1Index < group1Values.length; g1Index++) {
        const g1Value = group1Values[g1Index];
        const item = legendItems.find(item => item.group2 === group2Values[0] && item.group1 === g1Value);
        
        
        
        // 添加分类标签
        legend.append("text")
            .attr("x", currentX  + spaceBetweenRectAndText + maxGroup1Width)
            .attr("y", 20 + legendRectSize/2 + g1Index * legendItemHeight)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "central")
            .style("font-family", typography.label.font_family)
            .style("font-size", "12px")
            .style("font-weight", "normal")
            .style("fill", colors.text_color)
            .text(item.group1);

        // 添加颜色矩形
        legend.append("rect")
            .attr("x", currentX  + spaceBetweenRectAndText + maxGroup1Width + legendPadding)
            .attr("y", 20 +  g1Index * legendItemHeight)
            .attr("text-anchor", "start")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", item.color);
    }

    currentX += legendGroupWidth + spaceBetweenGroups;

    // 为第二个group2（例如"2020-21"）添加图例项 - 但放在年份标签左侧
    // 先添加图例项
    for (let g1Index = 0; g1Index < group1Values.length; g1Index++) {
        const g1Value = group1Values[g1Index];
        const item = legendItems.find(item => item.group2 === group2Values[1] && item.group1 === g1Value);
        
        // 添加颜色矩形
        legend.append("rect")
            .attr("x", currentX)
            .attr("y", 20 + g1Index * legendItemHeight)
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", item.color);
        
        // 添加分类标签
        legend.append("text")
            .attr("x", currentX + legendRectSize + spaceBetweenRectAndText)
            .attr("y", 20 + legendRectSize/2 + g1Index * legendItemHeight)
            .attr("dominant-baseline", "central")
            .style("font-family", typography.label.font_family)
            .style("font-size", "12px")
            .style("font-weight", "normal")
            .style("fill", colors.text_color)
            .text(item.group1);
    }

    // 再添加第二个年份标签（在图例项右侧）
    currentX += legendGroupWidth + legendPadding;
    legend.append("text")
        .attr("x", currentX)
        .attr("y", 45)
        .attr("text-anchor", "start")
        .style("font-family", typography.label.font_family)
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("fill", colors.text_color)
        .text(group2Values[1]);
        
        // 返回SVG节点
    return svg.node();
}