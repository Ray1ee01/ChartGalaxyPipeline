/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Group Bar Chart",
    "chart_name": "vertical_group_bar_chart_5",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 10], [0, "inf"], [2, 2]],
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
    "has_x_axis": "yes",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 垂直分组条形图实现 - 带有百分比变化指示器
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
        field: {
            "2011 Sales": "#154360", // 深蓝色 (2011)
            "2012 Sales": "#3498DB", // 浅蓝色 (2012)
            "YoY Change": "#C0392B"  // 红色 (百分比变化)
        },
        other: { 
            primary: "#4682B4",
            percentage_indicator: "#C0392B" // 百分比指示器的红色
        } 
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
        right: 40,   // 右侧标签的空间
        bottom: 80,  // x轴和标签的空间
        left: 80     // y轴和标签的空间
    };
    
    // 计算实际绘图区域大小
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 3. 提取字段名称和单位 ----------
    let xField, yField, groupField;
    let xUnit = "", yUnit = "";
    
    // 安全提取字段名称
    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const groupColumn = dataColumns.find(col => col.role === "group");
    
    if (xColumn) xField = xColumn.name;
    if (yColumn) yField = yColumn.name;
    if (groupColumn) groupField = groupColumn.name;
    
    // 获取字段单位
    xUnit = xColumn?.unit === "none" ? "" : (xColumn?.unit || "");
    yUnit = yColumn?.unit === "none" ? "" : (yColumn?.unit || "");
    
    // ---------- 4. 数据处理 ----------
    // 使用提供的数据
    let useData = chartData;
    
    // 获取x轴和分组的唯一值
    const xValues = [...new Set(useData.map(d => d[xField]))];
    let groupValues = [...new Set(useData.map(d => d[groupField]))];
    
    // 确保我们只有两个组字段：第一个组是左侧柱子，第二个组是右侧柱子
    if (groupValues.length !== 2) {
        console.warn("此图表需要恰好2个组字段：用于左侧和右侧柱状图。");
    }
    
    // 第一个组是左侧柱子，第二个组是右侧柱子
    const leftBarGroup = groupValues[0];
    const rightBarGroup = groupValues[1];
    
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
    
    // 分组比例尺，用于每个类别内的细分
    const groupScale = d3.scaleBand()
        .domain([0, 1]) // 只有两个柱子，左侧和右侧
        .range([0, xScale.bandwidth()])
        .padding(0.2); // 增加同一维度柱子之间的间隙
    
    // Y比例尺（数值）
    // 找出数据中的最大值
    const dataMax = d3.max(useData, d => +d[yField]) ;
    // 找出数据中的最小值
    const dataMin = d3.min(useData, d => +d[yField]) ;
    // 向上取整到最接近的合适的刻度
    let yMax;
    yMax = Math.ceil(dataMax * 1.2 / 10) * 10; // 向上取整到最接近的10的倍数
    let yMin;
    if (dataMin < 0) {
        yMin = Math.floor(dataMin * 1.2 / 10) * 10; // 向下取整到最接近的10的倍数
    }
    else {
        yMin = 0; // 如果没有负值，则从0开始
    }
    
    
    const yScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([innerHeight, 0]);
    
    // 计算动态文本大小的函数
    const calculateFontSize = (text, maxWidth, baseSize = 12) => {
        // 估算每个字符的平均宽度 (假设为baseSize的60%)
        const avgCharWidth = baseSize * 0.6;
        // 计算文本的估计宽度
        const textWidth = text.length * avgCharWidth;
        // 如果文本宽度小于最大宽度，返回基础大小
        if (textWidth < maxWidth) {
            return baseSize;
        }
        // 否则，按比例缩小字体大小
        return Math.max(8, Math.floor(baseSize * (maxWidth / textWidth)));
    };
    
    // 检查是否应该显示x轴标签
    const shouldShowLabel = (text) => {
        const maxWidth = xScale.bandwidth() * 2; // 两个柱子宽度之和的两倍
        const avgCharWidth = 12 * 0.6; // 使用基础字体大小12
        const textWidth = text.length * avgCharWidth;
        return textWidth <= maxWidth;
    };
    
    // ---------- 9. 创建坐标轴 ----------
    // 底部的X轴
    chart.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0))
        .call(g => {
            g.select(".domain").remove();
            
            // 第一步：找出最长的标签并计算统一的字体大小
            let maxLabelLength = 0;
            const allLabels = [];
            
            // 收集所有标签并找出最长的一个
            g.selectAll(".tick text").each(function(d) {
                const labelText = d.toString();
                allLabels.push(labelText);
                if (labelText.length > maxLabelLength) {
                    maxLabelLength = labelText.length;
                }
            });
            
            // 使用最长标签计算合适的统一字体大小
            const maxWidth = xScale.bandwidth() ; 
            const longestLabel = allLabels.reduce((a, b) => a.length > b.length ? a : b, "");
            const uniformFontSize = calculateFontSize(longestLabel, maxWidth);
            
            // 第二步：应用统一字体大小，必要时进行换行处理
            g.selectAll(".tick text")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${uniformFontSize}px`) // 应用统一的字体大小
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .each(function(d) {
                    const text = d3.select(this);
                    
                    // 检查使用统一字体大小后，文本是否仍然超过可用宽度
                    if (this.getComputedTextLength() > maxWidth) {
                        // 如果仍然太长，应用文本换行
                        wrapText(text, d.toString(), maxWidth, 1.1);
                    }
                });
        });
    
    // 文本换行助手函数
    function wrapText(text, str, width, lineHeight) {
        const words = str.split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const y = text.attr("y");
        const dy = parseFloat(text.attr("dy") || 0);
        let tspan = text.text(null).append("tspan")
            .attr("x", 0)
            .attr("y", y)
            .attr("dy", dy + "em");
        
        // 如果没有空格可分割，按字符分割
        if (words.length <= 1) {
            const chars = str.split('');
            let currentLine = '';
            
            for (let i = 0; i < chars.length; i++) {
                currentLine += chars[i];
                tspan.text(currentLine);
                
                if (tspan.node().getComputedTextLength() > width && currentLine.length > 1) {
                    // 当前行过长，回退一个字符并换行
                    currentLine = currentLine.slice(0, -1);
                    tspan.text(currentLine);
                    
                    // 创建新行
                    currentLine = chars[i];
                    tspan = text.append("tspan")
                        .attr("x", 0)
                        .attr("y", y)
                        .attr("dy", ++lineNumber * lineHeight + dy + "em")
                        .text(currentLine);
                }
            }
        } else {
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                
                if (tspan.node().getComputedTextLength() > width && line.length > 1) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = text.append("tspan")
                        .attr("x", 0)
                        .attr("y", y)
                        .attr("dy", ++lineNumber * lineHeight + dy + "em")
                        .text(word);
                }
            }
        }
        
        // 调整标签位置以保持居中
        if (lineNumber > 0) {
            text.selectAll("tspan").attr("y", parseFloat(y) + 5);
        }
    }
    
    // 左侧的Y轴
    chart.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale)
            .tickSize(-innerWidth)
            .tickFormat(d => formatValue(d) + (yUnit ? ` ${yUnit}` : ''))
        )
        .call(g => {
            g.select(".domain").remove();
            g.selectAll(".tick line")
                .attr("stroke", "#e0e0e0")
                .attr("stroke-dasharray", "2,2");
            g.selectAll(".tick text")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color);
        });
    
    // ---------- 10. 绘制图例 ----------
    // 图例
    const legendData = [
        { key: leftBarGroup, color: colors.field[leftBarGroup] || "#154360" },
        { key: rightBarGroup, color: colors.field[rightBarGroup] || "#3498DB" }
    ];
    
    // 计算图例项宽度
    const tempSvg = d3.select(containerSelector).append("svg").style("visibility", "hidden");
    const legendItemWidths = [];
    let totalLegendWidth = 0;
    const legendPadding = 20; // 图例项之间的间距
    
    legendData.forEach(item => {
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", "12px")
            .style("font-weight", typography.label.font_weight)
            .text(item.key.toString().replace(" Sales", ""));
        
        const textWidth = tempText.node().getBBox().width;
        const legendItemWidth = 15 + 5 + textWidth + legendPadding; // 色块(15) + 间距(5) + 文本宽度 + 右侧填充
        
        legendItemWidths.push(legendItemWidth);
        totalLegendWidth += legendItemWidth;
        
        tempText.remove();
    });
    
    tempSvg.remove();
    
    // 创建图例并居中放置
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${(width - totalLegendWidth + legendPadding + 40) / 2}, 80)`);
    
    // 为每个组添加一个图例项，水平排列
    let legendOffset = 0;
    legendData.forEach((item, i) => {
        const legendItem = legend.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${legendOffset}, 0)`);
        
        // 图例颜色方块
        legendItem.append("rect")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", item.color);
        
        // 图例文本
        legendItem.append("text")
            .attr("x", 20)
            .attr("y", 12)
            .style("font-family", typography.label.font_family)
            .style("font-size", "12px")
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(item.key.toString().replace(" Sales", ""));
        
        // 累加偏移量，为下一个图例项做准备
        legendOffset += legendItemWidths[i];
    });
    
    // ---------- 11. 绘制条形图 ----------
    // 为每个x类别创建一个组
    const xGroups = chart.selectAll(".x-group")
        .data(xValues)
        .enter()
        .append("g")
        .attr("class", "x-group")
        .attr("transform", d => `translate(${xScale(d)}, 0)`);
    
    // 绘制条形图
    xValues.forEach(xValue => {
        // 获取当前x类别的数据
        const xData = useData.filter(d => d[xField] === xValue);
        
        // 获取左侧柱子的数据（2011年销售额）
        const leftBarData = xData.find(d => d[groupField] === leftBarGroup);
        
        // 获取右侧柱子的数据（2012年销售额）
        const rightBarData = xData.find(d => d[groupField] === rightBarGroup);
        
        // 计算百分比变化
        let percentValue = 0;
        if (leftBarData && rightBarData) {
            const leftValue = leftBarData[yField];
            const rightValue = rightBarData[yField];
            
            // 计算百分比变化：(新值-旧值)/旧值 * 100
            if (leftValue !== 0) {
                percentValue = Math.round(((rightValue - leftValue) / leftValue) * 100);
            }
        }
        
        // 计算左侧柱子的位置和高度
        if (leftBarData) {
            const barHeight = innerHeight - yScale(leftBarData[yField]);
            chart.append("rect")
                .attr("class", "bar left-bar")
                .attr("x", xScale(xValue))
                .attr("y", yScale(leftBarData[yField]))
                .attr("width", groupScale.bandwidth())
                .attr("height", barHeight)
                .attr("fill", colors.field[leftBarGroup] || "#154360")
                .attr("rx", variables.has_rounded_corners ? 2 : 0)
                .attr("ry", variables.has_rounded_corners ? 2 : 0)
                .attr("stroke", variables.has_stroke ? "#555" : "none")
                .attr("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
        }
        
        // 计算右侧柱子的位置和高度
        if (rightBarData) {
            const barHeight = innerHeight - yScale(rightBarData[yField]);
            chart.append("rect")
                .attr("class", "bar right-bar")
                .attr("x", xScale(xValue) + groupScale.bandwidth() + (xScale.bandwidth() - 2 * groupScale.bandwidth()) / 2)
                .attr("y", yScale(rightBarData[yField]))
                .attr("width", groupScale.bandwidth())
                .attr("height", barHeight)
                .attr("fill", colors.field[rightBarGroup] || "#3498DB")
                .attr("rx", variables.has_rounded_corners ? 2 : 0)
                .attr("ry", variables.has_rounded_corners ? 2 : 0)
                .attr("stroke", variables.has_stroke ? "#555" : "none")
                .attr("stroke-width", variables.has_stroke ? 1 : 0)
                .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
        }
        
        // 绘制百分比变化指示器
        if (leftBarData && rightBarData) {
            const percentText = percentValue <= 0 ? `${percentValue}%` : `+${percentValue}%`;
            const percentColor = colors.other.percentage_indicator || "#C0392B";
            
            // 计算两个柱子的中心位置，确保三角形指向正确位置
            const leftBarCenter = xScale(xValue) + groupScale.bandwidth() / 2;
            const rightBarCenter = xScale(xValue) + groupScale.bandwidth() + (xScale.bandwidth() - 2 * groupScale.bandwidth()) / 2 + groupScale.bandwidth() / 2;
            const centerBetweenBars = (leftBarCenter + rightBarCenter) / 2;
            
            // 创建指示器组，用于放置矩形和三角形
            const indicatorGroup = chart.append("g")
                .attr("class", "percent-indicator")
                .attr("transform", `translate(${centerBetweenBars}, 0)`);
            
            // 计算百分比指示器的位置
            const indicatorWidth = Math.min(2 * groupScale.bandwidth(),40);  // 指示器宽度
            const indicatorHeight = indicatorWidth / 2;  // 指示器高度
            const triangleHeight = indicatorHeight * 0.8;   // 三角形高度
            
            // 计算百分比文本的宽度和适当的字体大小
            const percentFontSize = calculateFontSize(percentText, indicatorWidth - 4, 14);
            
            // 如果是左侧柱子和右侧柱子中较高的那个的顶部位置
            const maxBarHeight = Math.max(
                leftBarData ? leftBarData[yField] : 0,
                rightBarData ? rightBarData[yField] : 0
            );
            const indicatorY = yScale(maxBarHeight) - indicatorHeight - triangleHeight - 5;
            
            // 绘制百分比背景矩形
            indicatorGroup.append("rect")
                .attr("x", -indicatorWidth / 2)
                .attr("y", indicatorY)
                .attr("width", indicatorWidth)
                .attr("height", indicatorHeight)
                .attr("fill", percentColor)
                .attr("rx", 2)
                .attr("ry", 2);
            
            // 绘制百分比三角形，确保指向两个柱子的中间
            indicatorGroup.append("path")
                .attr("d", `M${-triangleHeight},${indicatorY + indicatorHeight} L${triangleHeight},${indicatorY + indicatorHeight} L0,${indicatorY + indicatorHeight + triangleHeight} Z`)
                .attr("fill", percentColor);
            
            // 绘制百分比文本，并使用计算出的动态字体大小
            indicatorGroup.append("text")
                .attr("x", 0)
                .attr("y", indicatorY + indicatorHeight / 2 + 5)
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${percentFontSize}px`)
                .style("font-weight", "bold")
                .style("fill", "white")
                .text(percentText);
        }
    });
    // 添加x轴处的长黑横线
    chart.append("line")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    // 返回SVG节点
    return svg.node();
}