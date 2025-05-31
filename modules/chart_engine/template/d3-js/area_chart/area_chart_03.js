/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Area Chart",
    "chart_name": "area_chart_03",
    "required_fields": ["x", "y"],
    "required_fields_type": [["temporal"], ["numerical"]],
    "required_fields_range": [[5, 30], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 400,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes",
    "chart_for": "trend"
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

    const numericalFormatter = createNumericalFormatter(chartData, yField);

    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };

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

    // X轴文本的高度
    const xAxisTextHeight = 30;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, chartWidth);

    // 创建y轴比例尺 - 使用数据的实际范围而不是固定范围
    const yMin = d3.min(chartData, d => d[yField]);
    const yMax = d3.max(chartData, d => d[yField]);

    // 为了美观，稍微扩展Y轴范围
    const yPadding = (yMax - yMin) * 0.1;
    const yDomainMax = yMax + yPadding;
    const yDomainMin = Math.max(0, yMin - yPadding);

    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax]) // 确保下限不小于0
        .range([chartHeight, 0]);

    // 获取颜色
    const areaColor = colors.other && colors.other.primary ? colors.other.primary : "#c62828";

    // 创建区域生成器
    const area = d3.area()
        .x(d => xScale(parseDate(d[xField])))
        .y0(chartHeight)
        .y1(d => yScale(d[yField]))
        .curve(d3.curveLinear);

    // 创建线条生成器（用于顶部边缘）
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveLinear);

    // 获取实际的Y轴刻度
    const yTicks = yScale.ticks(5);
    const maxYTick = yTicks[yTicks.length - 1]; // 最大的Y轴刻度值

    // 计算最大Y刻度的位置
    const maxYTickPosition = yScale(maxYTick);

    // 添加条纹背景

    // 为每个X轴刻度创建条纹背景，使条纹以刻度为中心
    for (let i = 0; i < xTicks.length; i++) {
        const currentTick = xTicks[i];

        // 计算当前刻度的位置
        const currentX = xScale(currentTick);

        // 计算前一个和后一个刻度的位置
        const prevX = i > 0 ? xScale(xTicks[i-1]) : 0;
        const nextX = i < xTicks.length - 1 ? xScale(xTicks[i+1]) : chartWidth;

        // 计算当前条纹的左右边界
        const leftX = (prevX + currentX) / 2;  // 当前刻度和前一个刻度的中点
        const rightX = (currentX + nextX) / 2; // 当前刻度和后一个刻度的中点

        // 每隔一个刻度添加浅色背景
        if (i % 2 === 0) {
            g.append("rect")
                .attr("x", leftX)
                .attr("y", maxYTickPosition) // 从最大Y刻度开始
                .attr("width", rightX - leftX)
                .attr("height", chartHeight - maxYTickPosition + xAxisTextHeight) // 延伸到X轴文本下方
                .attr("fill", "#ececec")
                .attr("class", "background")
                .attr("opacity", 0.8);
        }
    }

    // 将条纹背景移到最底层
    g.selectAll("rect").lower();

    // 添加水平网格线
    yTicks.forEach(tick => {
        g.append("line")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", chartWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", "#e0e0e0")
            .attr("stroke-width", 1)
            .attr("class", "background")
            .attr("stroke-dasharray", "2,2");
    });

    // 绘制区域
    g.append("path")
        .datum(chartData)
        .attr("fill", areaColor)
        .attr("fill-opacity", 0.6)
        .attr("d", area);

    // 绘制顶部边缘线
    g.append("path")
        .datum(chartData)
        .attr("fill", "none")
        .attr("stroke", areaColor)
        .attr("stroke-width", 3)
        .attr("d", line);

    // 添加X轴文本 - 确保在条纹背景之后添加
    xTicks.forEach(tick => {
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", chartHeight + 20)
            .attr("text-anchor", "middle")
            .attr("fill", "#666")
            .style("font-size", "12px")
            .text(xFormat(tick));
    });

    // 添加Y轴文本
    yScale.ticks(5).forEach(tick => {
        g.append("text")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#666")
            .style("font-size", "12px")
            .text(tick.toFixed(1));
    });

    // 找到关键点：起点、最低点和终点
    const firstPoint = chartData[0];
    const lastPoint = chartData[chartData.length - 1];

    // 找到最低点
    const lowestPoint = chartData.reduce((min, current) =>
        current[yField] < min[yField] ? current : min, chartData[0]);

    // 添加关键点标注
    const addDataLabel = (point, isHighest) => {
        const x = xScale(parseDate(point[xField]));
        const y = yScale(point[yField]);
        const displayText = numericalFormatter(point[yField]);
        let textWidth = getTextWidth(displayText, 12);
        // 创建标签背景
        let labelWidth = 45;
        if (textWidth > labelWidth) {
            labelWidth = textWidth * 1.3;
        }
        const labelHeight = 25;
        const labelX = x - labelWidth / 2;



        // 根据是最高点还是最低点调整标签位置和三角形方向
        let labelY, trianglePath;

        if (isHighest) {
            // 最高点 - 标签在上方，三角形指向下方
            labelY = y - labelHeight - 10;
            trianglePath = `M${x},${y - 5} L${x - 5},${labelY + labelHeight} L${x + 5},${labelY + labelHeight} Z`;
        } else {
            // 最低点 - 标签在下方，三角形指向上方
            labelY = y + 10;
            trianglePath = `M${x},${y + 5} L${x - 5},${labelY} L${x + 5},${labelY} Z`;
        }

        // 添加标签背景
        g.append("rect")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("width", labelWidth)
            .attr("height", labelHeight)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", areaColor);

        // 添加三角形指向数据点
        g.append("path")
            .attr("d", trianglePath)
            .attr("fill", areaColor);


        // 添加文本
        g.append("text")
            .attr("x", x)
            .attr("y", labelY + labelHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "white")
            .attr("font-weight", "bold")
            .style("font-size", "12px")
            .text(displayText);
    };

    // 只有当最低点不是起点或终点时才添加最低点标注
    if (lowestPoint !== firstPoint && lowestPoint !== lastPoint) {
        addDataLabel(lowestPoint, false);
    }

    // 添加起点标注
    addDataLabel(firstPoint, true);

    // 添加终点标注
    addDataLabel(lastPoint, true);

    return svg.node();
}
