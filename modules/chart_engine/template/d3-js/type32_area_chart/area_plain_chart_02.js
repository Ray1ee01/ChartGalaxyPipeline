/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Area Chart",
    "chart_name": "area_plain_chart_02",
    "required_fields": ["x", "y"],
    "required_fields_type": [["temporal"], ["numerical"]],
    "required_fields_range": [[5, 30], [-100, 100]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["positive", "negative"],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 400,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes",
    "chart_for": "comparison"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    let chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;

    chartData = temporalFilter(chartData, xField);
    if (chartData.length === 0) {
        console.log("chartData is empty");
        return;
    }
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 创建x轴比例尺
    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, chartWidth);
    
    // 创建y轴比例尺
    const yScale = d3.scaleLinear()
        .domain([
            Math.min(0, d3.min(chartData, d => d[yField]) * 1.2), // 确保负值区域足够
            d3.max(chartData, d => d[yField]) * 1.2   // 确保正值区域足够
        ])
        .range([chartHeight, 0]);
    const xRange = d3.extent(chartData, d => xScale(parseDate(d[xField])));

    
    // 添加水平网格线 - 放在数据面积之后
    g.selectAll("grid-line")
    .data(yScale.ticks(8))
    .enter()
    .append("line")
    .attr("class", "background")
    .attr("x1", 0)
    .attr("y1", d => yScale(d))
    .attr("x2", chartWidth)
    .attr("y2", d => yScale(d))
    .attr("stroke", "#e0e0e0")
    .attr("stroke-width", 1);

    // 获取颜色
    const positiveColor = colors.other && colors.other.positive ? colors.other.positive : "#4CAF50";
    const negativeColor = colors.other && colors.other.negative ? colors.other.negative : "#E53935";
    
    // 处理数据，在正负值交替处添加零点
    const processedData = [];
    
    const numericalFormatter = createNumericalFormatter(chartData, yField);

    for (let i = 0; i < chartData.length; i++) {
        const current = chartData[i];
        const currentValue = current[yField];
        
        // 添加当前点
        processedData.push({
            x: parseDate(current[xField]),
            y: currentValue,
            original: current
        });
        
        // 如果不是最后一个点，检查是否需要添加零点
        if (i < chartData.length - 1) {
            const next = chartData[i + 1];
            const nextValue = next[yField];
            
            // 如果当前点和下一个点的符号不同（一正一负），添加零点
            if ((currentValue >= 0 && nextValue < 0) || (currentValue < 0 && nextValue >= 0)) {
                const currentDate = parseDate(current[xField]);
                const nextDate = parseDate(next[xField]);
                
                // 计算零点的位置（线性插值）
                const ratio = Math.abs(currentValue) / (Math.abs(currentValue) + Math.abs(nextValue));
                const zeroDate = new Date(currentDate.getTime() + ratio * (nextDate.getTime() - currentDate.getTime()));
                
                // 添加零点
                processedData.push({
                    x: zeroDate,
                    y: 0,
                    isZeroPoint: true
                });
            }
        }
    }
    
    // 创建正值和负值数据集
    const positiveData = processedData.filter(d => d.y >= 0);
    const negativeData = processedData.filter(d => d.y <= 0);
    
    // 创建正值区域生成器
    const positiveArea = d3.area()
        .x(d => xScale(d.x))
        .y0(yScale(0))
        .y1(d => yScale(d.y))
        .curve(d3.curveLinear);
    
    // 创建负值区域生成器
    const negativeArea = d3.area()
        .x(d => xScale(d.x))
        .y0(yScale(0))
        .y1(d => yScale(d.y))
        .curve(d3.curveLinear);
    
    // 绘制正值区域
    g.append("path")
        .datum(positiveData)
        .attr("fill", positiveColor)
        .attr("d", positiveArea);
    
    // 绘制负值区域
    g.append("path")
        .datum(negativeData)
        .attr("fill", negativeColor)
        .attr("d", negativeArea);
    
    // 添加条纹网格
    
    // 为每个X轴刻度创建条纹背景
    xTicks.forEach((tick, i) => {
        // 计算当前刻度和下一个刻度的位置
        const x1 = xScale(tick);
        const x2 = i < xTicks.length - 1 ? xScale(xTicks[i + 1]) : chartWidth;
        
        // 每隔一个刻度添加浅色背景
        if (i % 2 === 0) {
            g.append("rect")
                .attr("x", x1)
                .attr("y", 0)
                .attr("width", x2 - x1)
                .attr("height", chartHeight)
                .attr("fill", "#f0f0f0")
                .attr("class", "background")
                .attr("opacity", 0.5);
        }
    });
    
    // 将条纹背景移到最底层
    g.selectAll("rect").lower();
    
    // 添加零线
    g.append("line")
        .attr("x1", 0)
        .attr("y1", yScale(0))
        .attr("x2", chartWidth)
        .attr("y2", yScale(0))
        .attr("stroke", "#000")
        .attr("stroke-width", 1);
    
    // 添加X轴文本（不添加轴线和刻度线）
    xTicks.forEach(tick => {
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", chartHeight + 20)
            .attr("text-anchor", "middle")
            .attr("fill", "#666")
            .text(xFormat(tick));
    });
    
    // 添加Y轴文本（不添加轴线和刻度线）
    yScale.ticks(8).forEach(tick => {
        g.append("text")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#666")
            .text(numericalFormatter(tick));
    });
    
    // 找到最高点和最低点 - 使用原始数据
    const maxPoint = chartData.reduce((max, current) => 
        current[yField] > max[yField] ? current : max, chartData[0]);
    
    const minPoint = chartData.reduce((min, current) => 
        current[yField] < min[yField] ? current : min, chartData[0]);
    
    // 添加最高点标注
    const maxX = xScale(parseDate(maxPoint[xField]));
    const maxY = yScale(maxPoint[yField]);
    
    // 标签尺寸
    let labelWidth = 50;
    const labelHeight = 20;
    
    // 最高值标签位置 - 上边与最高值齐平
    const maxLabelX = maxX + 10;
    const maxLabelY = maxY; // 上边与最高值齐平

    function getTextColor(bgColor) {
    // 将颜色转换为RGB值
    const rgb = d3.color(bgColor).rgb();
    
    // 计算亮度 - 使用相对亮度公式
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    
    // 如果亮度小于128则返回白色,否则返回黑色
    return brightness < 180 ? "#ffffff" : "#000000";
    }
    
    let displayText = `+${numericalFormatter(maxPoint[yField])}`;
    let textWidth = getTextWidth(displayText, 12);
    if (textWidth > labelWidth) {
        labelWidth = textWidth * 1.3;
    }


    // 创建标注气泡 - 三角只占高度的一半
    g.append("path")
        .attr("d", `
            M${maxX + 3},${maxY} 
            L${maxLabelX},${maxLabelY - labelHeight/4} 
            L${maxLabelX},${maxLabelY - labelHeight} 
            L${maxLabelX + labelWidth},${maxLabelY - labelHeight} 
            L${maxLabelX + labelWidth},${maxLabelY} 
            L${maxLabelX},${maxLabelY} 
            Z
        `)
        .attr("fill", positiveColor);
    
    // 添加最高值文本
    g.append("text")
        .attr("x", maxLabelX + labelWidth/2)
        .attr("y", maxLabelY - labelHeight/2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", getTextColor(positiveColor))
        .attr("font-weight", "bold")
        .text(displayText);
    
    // 添加最低点标注
    const minX = xScale(parseDate(minPoint[xField]));
    const minY = yScale(minPoint[yField]);

    displayText = `${numericalFormatter(minPoint[yField])}`;
    textWidth = getTextWidth(displayText, 12);
    if (textWidth > labelWidth) {
        labelWidth = textWidth * 1.3;
    }
    // 最低值标签位置 - 下边与最低值齐平
    let minLabelX = minX - labelWidth - 10;
    let minLabelY = minY - labelHeight;
    console.log("minLabelX", minLabelX);
    let leftFlag = true;
    if (minLabelX < xRange[0]) {
        minLabelX = minX + 10;
        leftFlag = false;
        minLabelY = minY;
    }

    if (!leftFlag){
        // 创建标注气泡 - 三角只占高度的一半
        g.append("path")
            .attr("d", `
                M${minX + 3},${minY} 
                L${minLabelX},${minLabelY - labelHeight/4} 
                L${minLabelX},${minLabelY - labelHeight} 
                L${minLabelX + labelWidth},${minLabelY - labelHeight} 
                L${minLabelX + labelWidth},${minLabelY} 
                L${minLabelX},${minLabelY} 
                Z
            `)
            .attr("fill", negativeColor);
    }
    else {
        // 创建标注气泡 - 三角只占高度的一半
        g.append("path")
            .attr("d", `
                M${minX - 3},${minY} 
                L${minLabelX + labelWidth},${minLabelY + labelHeight - labelHeight/4} 
                L${minLabelX + labelWidth},${minLabelY} 
                L${minLabelX},${minLabelY} 
                L${minLabelX},${minLabelY + labelHeight} 
                L${minLabelX + labelWidth},${minLabelY + labelHeight} 
                Z
            `)
            .attr("fill", negativeColor);
    }
    if (leftFlag){
        // 添加最低值文本
        g.append("text")
            .attr("x", minLabelX + labelWidth/2)
            .attr("y", minLabelY + labelHeight/2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", getTextColor(negativeColor))
            .attr("font-weight", "bold")
            .text(displayText);
    }
    else{
        g.append("text")
            .attr("x", minLabelX + labelWidth/2)
            .attr("y", minLabelY - labelHeight/2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", getTextColor(negativeColor))
            .attr("font-weight", "bold")
            .text(displayText);
    }
    
    return svg.node();
} 