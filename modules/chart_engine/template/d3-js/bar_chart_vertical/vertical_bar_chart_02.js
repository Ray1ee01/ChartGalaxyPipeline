/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Bar Chart With Circle",
    "chart_name": "vertical_bar_chart_02",
    "is_composite": true,
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [
        ["categorical"],
        ["numerical"],
        ["numerical"]
    ],
    "required_fields_range": [[2, 12], [0, "inf"], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary","secondary"],
    "supported_effects": ["radius_corner", "spacing", "shadow", "gradient", "stroke"],
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

// 垂直条形图与百分比圆圈复合图表实现 - 使用D3.js vertical_bar_proportional_circle_area_chart_02
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                          
    const chartData = jsonData.data.data || [];          
    const variables = jsonData.variables || {};     
    const typography = jsonData.typography || {     
        title: { font_family: "Arial", font_size: "28px", font_weight: 700 },
        label: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        description: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: 400 }
    };
    const colors = jsonData.colors || { 
        text_color: "#000000", 
        field: {},
        other: { 
            primary: "#FF9F55",  // 默认柱状图颜色
            secondary: "#8BDB24"  // 默认指示器颜色
        } 
    };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];
    const titles = jsonData.titles || {};
    
    // 设置视觉效果变量
    variables.has_rounded_corners = variables.has_rounded_corners !== undefined ? variables.has_rounded_corners : false;
    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : true;
    variables.has_shadow = variables.has_shadow !== undefined ? variables.has_shadow : false;
    variables.has_gradient = variables.has_gradient !== undefined ? variables.has_gradient : false;
    variables.has_stroke = variables.has_stroke !== undefined ? variables.has_stroke : false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表尺寸
    const width = variables.width || 800;
    const height = variables.height || 500;
    
    // 设置边距
    const margin = {
        top: 80,       // 顶部留出空间用于百分比圆圈
        right: 30,
        bottom: 60,    // 底部留出空间用于标签
        left: 40
    };
    
    // 计算实际绘图区域大小
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 3. 提取字段名称和单位 ----------
    
    // 从数据列中提取字段名称
    const categoryField = dataColumns.find(col => col.role === "x")?.name || "Event";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "Spending (billion USD)";
    
    // 直接提取百分比字段名称，不做任何额外假设
    const percentageField = dataColumns.find(col => col.role === "y2")?.name || "Change vs. 2021";
    
    // 获取字段单位（如果存在）
    const valueUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : 
                     dataColumns.find(col => col.role === "y")?.unit || "";
    const percentageUnit = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : 
                         dataColumns.find(col => col.role === "y2")?.unit || "%";
    
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
    
    // ---------- 4. 数据处理 ----------
    
    // 使用提供的数据
    let useData = [...chartData];
    
    // 获取分类的唯一值
    const categories = useData.map(d => d[categoryField]);
    
    // 获取百分比的最小和最大值，用于缩放圆的面积
    const minPercentage = d3.min(useData, d => +d[percentageField]);
    const maxPercentage = d3.max(useData, d => +d[percentageField]);
    
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
    
    // 如果需要，为每个类别创建渐变
    if (variables.has_gradient) {
        categories.forEach((category, i) => {
            const color = getBarColor(category);
            
            const gradient = defs.append("linearGradient")
                .attr("id", `gradient-${i}`)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "0%")
                .attr("y2", "100%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(color).brighter(0.5));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(color).darker(0.3));
        });
    }
    
    // ---------- 7. 创建图表区域 ----------
    
    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 8. 创建比例尺 ----------
    
    // X比例尺（分类）
    const xScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerWidth])
        .padding(variables.has_spacing ? 0.4 : 0.1);
    
    // Y比例尺（数值）
    // 找出数据中的最大值并添加一些边距
    const dataMax = d3.max(useData, d => +d[valueField]) * 1.2;
    
    const yScale = d3.scaleLinear()
        .domain([0, dataMax])
        .range([innerHeight, 0]);
    
    // 修改: 创建圆圈面积的比例尺，而不是半径
    // 定义最小和最大面积
    const minArea = Math.PI * Math.pow(xScale.bandwidth() / 8, 2); // 最小圆的面积 (半径为20)
    const maxArea = Math.PI * Math.pow(xScale.bandwidth() / 3, 2); // 最大圆的面积 (半径为40)
    
    const areaScale = d3.scaleLinear()
        .domain([minPercentage, maxPercentage])
        .range([minArea, maxArea]);
    
    // ---------- 9. 获取颜色的辅助函数 ----------
    
    // 获取柱状图颜色
    function getBarColor(category) {
 
        return colors.other.primary || "#FF9F55";
    }
    
    // 获取指示器颜色
    function getIndicatorColor() {
        return colors.other.secondary || "#8BDB24";  // 亮绿色
    }
    
    // ---------- 10. 添加图例 ----------
    
    // 在图表顶部添加百分比圆圈图例
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${margin.left + innerWidth/2}, 80)`);
    
    // 添加图例圆圈
    legend.append("circle")
        .attr("cx", -10)
        .attr("cy", 0)
        .attr("r", 10)
        .attr("fill", getIndicatorColor());
    
    // 添加图例文本
    const legendText = legend.append("text")
        .attr("x", 10)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(percentageField);
    
    // 重新定位图例到真正的中心位置
    // 计算文本宽度 (使用getBBox获取实际文本尺寸)
    const textWidth = legendText.node().getBBox().width;
    // 计算整个图例的总宽度 (圆圈宽度 + 间距 + 文本宽度)
    const circleWidth = 20; // 圆直径
    const spacing = 10;     // 圆和文本之间的间距
    const totalLegendWidth = circleWidth + spacing + textWidth;
    
    // 重新定位整个图例组，使其整体居中
    legend.attr("transform", `translate(${margin.left + innerWidth/2 - totalLegendWidth/2}, 80)`);
    
    // ---------- 11. 计算动态文本大小的函数 ----------
    
    // 计算字体大小的函数，确保文本在指定宽度内
    const calculateFontSize = (text, maxWidth, baseSize = 14) => {
        // 检查参数是否有效
        if (!text || typeof text !== 'string' || !maxWidth || maxWidth <= 0 || !baseSize || baseSize <= 0) {
            return Math.max(10, baseSize || 14); // 返回一个合理的默认值或最小尺寸
        }
        
        // 估算每个字符的平均宽度 (假设为baseSize的60%)
        const avgCharWidth = baseSize * 0.6;
        // 计算文本的估计宽度
        const textWidth = text.length * avgCharWidth;
        
        // 如果文本宽度小于最大宽度，返回基础大小
        if (textWidth < maxWidth) {
            return baseSize;
        }
        
        // 否则，按比例缩小字体大小，确保不小于10
        return Math.max(10, Math.floor(baseSize * (maxWidth / textWidth)));
    };
    
    // ---------- 12. 创建底部x轴 (修改后) ----------

    // 获取 x 轴的值 (即分类)
    const xValues = categories; // 使用之前定义的 categories

    // 创建 x 轴的容器
    const xAxisGroup = chart.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    // 找出最长的标签文本
    const longestLabel = xValues.reduce((a, b) => a.toString().length > b.toString().length ? a : b, "").toString();

    // 定义每个标签的最大允许宽度 (稍微给一点余量，例如90%的带宽)
    const labelMaxWidth = xScale.bandwidth() * 0.9; 

    // 使用最长标签计算统一的字体大小
    const baseFontSize = parseInt(typography.label.font_size) || 16; // 获取基础字体大小
    const uniformFontSize = calculateFontSize(longestLabel, labelMaxWidth, baseFontSize);

    // 文本换行辅助函数 (添加 alignment 参数)
    function wrapText(text, str, width, lineHeight = 1.1, alignment = 'middle') {
        const words = str.split(/\s+/).reverse(); // 按空格分割单词
        let word;
        let line = [];
        let lineNumber = 0;
        const initialY = parseFloat(text.attr("y")); // 获取原始y坐标
        const initialX = parseFloat(text.attr("x")); // 获取原始x坐标
        const actualFontSize = parseFloat(text.style("font-size")); // 获取实际应用的字体大小

        text.text(null); // 清空现有文本

        let tspans = []; // 存储最终要渲染的行

        // 优先按单词换行
        if (words.length > 1) {
            let currentLine = [];
            while (word = words.pop()) {
                currentLine.push(word);
                const tempTspan = text.append("tspan").text(currentLine.join(" ")); // 创建临时tspan测试宽度
                const isOverflow = tempTspan.node().getComputedTextLength() > width;
                tempTspan.remove(); // 移除临时tspan

                if (isOverflow && currentLine.length > 1) {
                    currentLine.pop(); // 回退一个词
                    tspans.push(currentLine.join(" ")); // 添加完成的行
                    currentLine = [word]; // 新行以当前词开始
                    lineNumber++;
                }
            }
            // 添加最后一行
            if (currentLine.length > 0) {
                tspans.push(currentLine.join(" "));
            }
        } else { // 如果没有空格或只有一个词，则按字符换行
            const chars = str.split('');
            let currentLine = '';
            for (let i = 0; i < chars.length; i++) {
                const nextLine = currentLine + chars[i];
                const tempTspan = text.append("tspan").text(nextLine); // 测试宽度
                const isOverflow = tempTspan.node().getComputedTextLength() > width;
                tempTspan.remove();

                if (isOverflow && currentLine.length > 0) { // 如果加了新字符就超长了，并且当前行不为空
                    tspans.push(currentLine); // 添加当前行
                    currentLine = chars[i]; // 新行从这个字符开始
                    lineNumber++;
                } else {
                    currentLine = nextLine; // 没超长就继续加字符
                }
            }
            // 添加最后一行
            if (currentLine.length > 0) {
                tspans.push(currentLine);
            }
        }

        // 计算总行数
        const totalLines = tspans.length;
        let startDy = 0;
        
        // 根据对齐方式计算起始偏移
        if (alignment === 'middle') {
             // 垂直居中：向上移动半行*(总行数-1)
            startDy = -( (totalLines - 1) * lineHeight / 2);
        } else if (alignment === 'bottom') {
            // 底部对齐：计算总高度，向上移动 总高度 - 单行高度(近似)
            // 注意：em单位是相对于字体大小的，这里用 lineHeight * actualFontSize 近似计算像素高度
            const totalHeightEm = totalLines * lineHeight;
            startDy = -(totalHeightEm - lineHeight); // 将底部对齐到原始y
        }
        // 如果是 'top' 对齐，startDy 保持为 0，即第一行基线在原始y位置
        // 其他对齐方式（如 'top'）可以保持 startDy 为 0

        // 创建所有行的tspan元素
        tspans.forEach((lineText, i) => {
            text.append("tspan")
                .attr("x", initialX) // x坐标与父<text>相同
                .attr("dy", (i === 0 ? startDy : lineHeight) + "em") // 第一行应用起始偏移，后续行应用行高
                .text(lineText);
        });
        
        // 如果是底部对齐，可能需要重新设置 y 确保精确对齐 (可选优化)
        // if (alignment === 'bottom') {
        //    const bbox = text.node().getBBox();
        //    const currentBottom = bbox.y + bbox.height;
        //    const adjustment = initialY - currentBottom;
        //    text.attr("transform", `translate(0, ${adjustment})`);
        // }
    }

    // 绘制x轴标签
    xAxisGroup.selectAll(".x-label")
        .data(xValues)
        .enter()
        .append("text")
        .attr("class", "x-label")
        .attr("x", d => xScale(d) + xScale.bandwidth() / 2) // 定位到每个bar的中心下方
        .attr("y", 10) 
        .attr("text-anchor", "middle") // 文本居中对齐
        .style("font-family", typography.label.font_family)
        .style("font-size", `${uniformFontSize}px`) // 应用统一计算的字体大小
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(d => d.toString()) // 设置初始文本
        .each(function(d) { // 对每个标签进行检查
            const textElement = d3.select(this);
            // 检查使用统一字体大小后，文本实际渲染宽度是否仍然超过最大允许宽度
            if (this.getComputedTextLength() > labelMaxWidth) {
                // 如果仍然太长，则调用 wrapText 函数进行换行处理
                // 使用 'top' 对齐，确保第一行基线位置不变
                wrapText(textElement, d.toString(), labelMaxWidth, 1.1, 'top'); 
            }
        });
    
    // ---------- 13. 绘制柱状图和指示器 ----------
    
    useData.forEach((d, i) => {
        const category = d[categoryField];
        const value = +d[valueField];
        const percentage = +d[percentageField];
        
        const barWidth = xScale.bandwidth();
        const barHeight = innerHeight - yScale(value);
        const barX = xScale(category);
        const barY = yScale(value);
        
        // 绘制柱状图
        chart.append("rect")
            .attr("class", "bar")
            .attr("x", barX)
            .attr("y", barY)
            .attr("width", barWidth)
            .attr("height", barHeight)
            .attr("fill", variables.has_gradient ? `url(#gradient-${i})` : getBarColor(category))
            .attr("rx", variables.has_rounded_corners ? 5 : 0)
            .attr("ry", variables.has_rounded_corners ? 5 : 0)
            .attr("stroke", variables.has_stroke ? d3.rgb(getBarColor(category)).darker(0.5) : "none")
            .attr("stroke-width", variables.has_stroke ? 1.5 : 0)
            .style("filter", "none");
            
        // --- 数值标签 (底部) ---
        const valueTextContent = formatValue(value) + (valueUnit ? " " + valueUnit : "");
        const valueLabelMaxWidth = barWidth * 1.1; // 最大宽度设置为柱宽的1.1倍
        const valueBaseFontSize = parseInt(typography.label.font_size) || 14; // 基础字体大小
        const valueFontSize = calculateFontSize(valueTextContent, valueLabelMaxWidth, valueBaseFontSize);

        const valueLabel = chart.append("text")
            .attr("class", "value-label")
            .attr("x", barX + barWidth / 2)
            .attr("y", innerHeight - 5) // 定位到靠近底部的位置
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${valueFontSize}px`) // 应用计算出的字体大小
            .style("font-weight", "bold")
            .style("fill", "#ffffff")  // 保持白色
            .text(valueTextContent);
            
        // 检查数值标签是否需要换行
        valueLabel.each(function() {
            if (this.getComputedTextLength() > valueLabelMaxWidth) {
                wrapText(d3.select(this), valueTextContent, valueLabelMaxWidth, 1.1, 'bottom');
            }
        });

        // --- 百分比圆圈和标签 ---
        
        // 计算圆半径
        const area = areaScale(percentage);
        const circleRadius = Math.min(Math.sqrt(area / Math.PI), barWidth / 2);
        const circleX = barX + barWidth / 2;
        const circleY = barY; // 圆心在柱子顶部
        
        // 绘制百分比圆圈背景
        chart.append("circle")
            .attr("class", "percentage-circle")
            .attr("cx", circleX)
            .attr("cy", circleY)
            .attr("r", circleRadius)
            .attr("fill", getIndicatorColor())
            .attr("stroke", variables.has_stroke ? d3.rgb(getIndicatorColor()).darker(0.3) : "none")
            .attr("stroke-width", variables.has_stroke ? 1 : 0)
            .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
        
        // FIX: 添加带+号的百分比文本 (假设都需要+) - 如果不需要可以去掉
        // const percentageTextContent = (percentage > 0 ? '+' : '') + percentage + percentageUnit;
        const percentageTextContent = `${formatValue(percentage)}${percentageUnit}` ;

        const percentageLabelMaxWidth = barWidth * 1.1; // 最大宽度设置为柱宽的1.1倍
        const percentageBaseFontSize = parseInt(typography.label.font_size) || 12; // 基础字体大小
        const percentageFontSize = calculateFontSize(percentageTextContent, percentageLabelMaxWidth, percentageBaseFontSize);
        
        const percentageLabel = chart.append("text")
            .attr("class", "percentage-label")
            .attr("x", circleX)
            .attr("y", circleY - circleRadius ) // 移动到圆圈上方
            .attr("dy", "-0.3em") // 向上微调，使其刚好在圆上方
            .attr("text-anchor", "middle")
            // .attr("dominant-baseline", "auto") // 移除middle基线
            .style("font-family", typography.label.font_family)
            .style("font-size", `${percentageFontSize}px`)  // 应用计算出的字体大小
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color) // 使用默认文本颜色
            .text(percentageTextContent);
            
        // 检查百分比标签是否需要换行
        percentageLabel.each(function() {
            if (this.getComputedTextLength() > percentageLabelMaxWidth) {
                 wrapText(d3.select(this), percentageTextContent, percentageLabelMaxWidth, 1.1, 'middle'); // 换行使用middle对齐
            }
        });
        
        // 如果需要，添加阴影效果
        if (variables.has_shadow) {
            // 为圆圈添加阴影
            chart.append("circle")
                .attr("cx", circleX + 2)
                .attr("cy", circleY + 2)
                .attr("r", circleRadius)
                .attr("fill", "rgba(0,0,0,0.2)")
                .attr("opacity", 0.3)
                .style("filter", "blur(3px)")
                .lower();  // 将阴影移到圆圈后面
        }
    });
    
    // 返回SVG节点
    return svg.node();
}