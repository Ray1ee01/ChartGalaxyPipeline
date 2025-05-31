/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Radial Stacked Bar Chart",
    "chart_name": "radial_stacked_bar_plain_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 10], [0, 100], [2, 20]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary", "secondary", "background"],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 600,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];

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

    d3.select(containerSelector).html("");

    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;

    // 获取单位信息
    let valueUnit = "";
    const valueCol = dataColumns.find(col => col.role === "y");
    if (valueCol && valueCol.unit && valueCol.unit !== "none") {
        valueUnit = valueCol.unit;
    }

    // 准备堆叠数据
    const stack = d3.stack()
        .keys([...new Set(chartData.map(d => d[groupField]))])
        .value((d, key) => d[key] || 0);

    // 按xField分组数据
    const groupedData = d3.group(chartData, d => d[xField]);
    const stackedData = Array.from(groupedData, ([key, values]) => {
        const obj = { [xField]: key };
        values.forEach(d => {
            obj[d[groupField]] = d[yField];
        });
        return obj;
    });

    const stackedSeries = stack(stackedData);

    // 尺寸
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const centerX = width / 2;
    const centerY = height / 2 + 50; // 将图表中心点向下移动50px
    const maxRadius = Math.min(chartWidth, chartHeight) / 2;

    const nBars = stackedData.length;
    const minRadius = maxRadius * 0.2;
    const maxBarRadius = maxRadius * 0.95;
    const barWidth = (maxBarRadius - minRadius) / nBars * 0.7;
    const barGap = (maxBarRadius - minRadius) / nBars * 0.3;

    // 角度比例尺（最大270°）
    const maxValue = d3.max(stackedSeries, series => d3.max(series, d => d[1]));
    const angleScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, 1.5 * Math.PI]);

    const g = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    // 辅助线
    const numTicks = 5;
    const ticks = d3.range(0, maxValue + 1, maxValue / numTicks);
    ticks.forEach(tick => {
        g.append("path")
            .attr("d", d3.arc()
                .innerRadius(minRadius)
                .outerRadius(maxBarRadius + barWidth * 0.5)
                .startAngle(angleScale(tick))
                .endAngle(angleScale(tick))
            )
            .attr("stroke", "#e0e0e0")
            .attr("stroke-width", 1)
            .attr("fill", "none");
        g.append("text")
            .attr("x", Math.cos(angleScale(tick) - Math.PI / 2) * (maxBarRadius + barWidth * 0.7))
            .attr("y", Math.sin(angleScale(tick) - Math.PI / 2) * (maxBarRadius + barWidth * 0.7))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#888")
            .style("font-size", "12px")
            .text(formatValue(tick) + valueUnit);
    });

    const labelPadding = 20;
    // 移除默认的colorScale定义
    // 使用传入的colors配置
    const getColor = (groupValue) => {
        return colors.field[groupValue] || "#cccccc"; // 如果没有对应的颜色配置，使用灰色作为后备
    };

    // 绘制堆叠条形
    stackedSeries.forEach((series, i) => {
        series.forEach((d, j) => {
            const innerR = minRadius + j * (barWidth + barGap);
            const outerR = innerR + barWidth;
            const startAngle = angleScale(d[0]);
            const endAngle = angleScale(d[1]);

            g.append("path")
                .attr("d", d3.arc()
                    .innerRadius(innerR)
                    .outerRadius(outerR)
                    .startAngle(startAngle)
                    .endAngle(endAngle)
                )
                .attr("fill", getColor(series.key))
                .attr("opacity", 0.85);

            // 类别标签
            if (i === 0) {
                g.append("text")
                    .attr("x", Math.cos(-Math.PI / 2) * (innerR + barWidth / 2) - labelPadding)
                    .attr("y", Math.sin(-Math.PI / 2) * (innerR + barWidth / 2))
                    .attr("text-anchor", "end")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", "#222b44")
                    .style("font-size", "16px")
                    .style("font-weight", "bold")
                    .text(d.data[xField]);
            }

            // 数值标签（沿弧线方向显示）
            if (d[1] - d[0] > maxValue * 0.08) { // 提高阈值，只显示较大的数值
                const value = d[1] - d[0];
                const formattedValue = formatValue(value);
                const valueRadius = innerR + barWidth / 2;
                const midAngle = (startAngle + endAngle) / 2;
                const valueTextPathId = `valueTextPath-${i}-${j}`;
                
                // 根据数值大小和弧长动态计算文字路径长度
                const valueTextLen = String(formattedValue).length * 6; // 减小字符宽度估计
                const arcLength = Math.abs(endAngle - startAngle) * valueRadius;
                const minAngle = 0.03; // 减小最小角度
                const maxAngle = Math.abs(endAngle - startAngle) * 0.7; // 减小最大角度为弧长的70%
                const valueShiftAngle = Math.min(Math.max(valueTextLen / valueRadius, minAngle), maxAngle);
                
                // 计算文字路径的起始和结束角度
                const pathStartAngle = Math.max(startAngle, midAngle - valueShiftAngle);
                const pathEndAngle = Math.min(endAngle, midAngle + valueShiftAngle);
                
                // 只有当弧长足够显示文字时才添加标签
                if (arcLength > valueTextLen) { // 增加间距要求
                    g.append("path")
                        .attr("id", valueTextPathId)
                        .attr("d", d3.arc()({
                            innerRadius: valueRadius,
                            outerRadius: valueRadius,
                            startAngle: pathStartAngle,
                            endAngle: pathEndAngle
                        }))
                        .style("fill", "none")
                        .style("stroke", "none");

                    g.append("text")
                        .attr("font-size", "8px")
                        .attr("fill", "white")
                        .attr("font-weight", "normal")
                        .append("textPath")
                        .attr("xlink:href", `#${valueTextPathId}`)
                        .attr("startOffset", "30%") 
                        .attr("text-anchor", "left")
                        .attr("dominant-baseline", "left")
                        .text(formattedValue);
                }
            }
        });
    });

    // 添加图例
    const legendItemHeight = 20; // 每个图例项的高度
    const legendPadding = 10; // 图例内边距
    const legendItems = stackedSeries.map(d => d.key);
    
    // 计算文本最大宽度
    const tempText = svg.append("text")
        .attr("visibility", "hidden");
    const maxTextWidth = d3.max(legendItems, item => {
        tempText.text(item);
        return tempText.node().getComputedTextLength();
    });
    tempText.remove();
    
    const legendWidth = maxTextWidth + 40; // 文本宽度 + 色块宽度(15) + 间距(5) + 左右内边距
    const legendHeight = legendItems.length * legendItemHeight + 2 * legendPadding;
    
    // 计算图例位置，确保不会与图表重叠
    const chartRadius = maxBarRadius + barWidth * 0.5;
    const legendX = width - legendWidth - margin.right - 20; // 额外20px右边距
    const legendY = margin.top + 10; // 向上移动到顶部，留出10px边距
    
    const legend = svg.append("g")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    // 添加图例背景，使用计算出的精确宽度
    legend.append("rect")
        .attr("x", -legendPadding)
        .attr("y", -legendPadding)
        .attr("width", legendWidth + 2 * legendPadding)
        .attr("height", legendHeight)
        .attr("fill", "white")
        .attr("fill-opacity", 0.9)
        .attr("rx", 4)
        .attr("ry", 4);

    stackedSeries.forEach((series, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(0, ${i * legendItemHeight + legendPadding})`);

        legendItem.append("rect")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", getColor(series.key));

        legendItem.append("text")
            .attr("x", 25)
            .attr("y", 12)
            .attr("font-size", "12px")
            .text(series.key);
    });

    return svg.node();
}