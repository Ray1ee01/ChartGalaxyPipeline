/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Bump Chart",
    "chart_name": "bump_chart_03",
    "is_composite": false,
    "chart_for": "comparison",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [
        [2, 12],
        [0, "inf"],
        [3, 10]
    ],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": ["spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "dark",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/



function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors_dark || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    // 获取颜色
    const getColor = (group) => {
        return colors.field && colors.field[group] ? colors.field[group] : (colors.other ? colors.other.primary : "#888");
    };
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 设置尺寸和边距 - 右侧留出更多空间用于标签
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 180, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 获取唯一的组值和X值
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    const xValues = [...new Set(chartData.map(d => d[xField]))].sort();

    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表组
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, innerWidth);
    
    
    // 1. 计算每个x下各group的排名
    // 构建排名数据结构：{ group1: [{x, rank}], group2: ... }
    const rankData = {};
    xValues.forEach(x => {
        // 取出该x下所有group的数据
        const items = chartData.filter(d => d[xField] === x);
        // 按yField降序排序（y越大排名越高）
        items.sort((a, b) => b[yField] - a[yField]);
        items.forEach((d, i) => {
            if (!rankData[d[groupField]]) rankData[d[groupField]] = [];
            rankData[d[groupField]].push({
                x: d[xField],
                rank: i + 1, // 排名从1开始
                value: d[yField]
            });
        });
    });

    // 2. y轴比例尺：排名（1在顶部）
    const yScale = d3.scaleLinear()
        .domain([1, groups.length])
        .range([0, innerHeight]);

    // 3. 绘制线条
    groups.forEach(group => {
        const groupRanks = rankData[group];
        g.append("path")
            .datum(groupRanks)
            .attr("fill", "none")
            .attr("stroke", getColor(group))
            .attr("stroke-width", 15)
            .attr("stroke-linecap", "round")
            .attr("d", d3.line()
                .x(d => xScale(parseDate(d.x)))
                .y(d => yScale(d.rank))
                .curve(d3.curveCatmullRom.alpha(0.5))
            );

        // 添加数值标签
        groupRanks.forEach(d => {
            g.append("text")
                .attr("x", xScale(parseDate(d.x)))
                .attr("y", yScale(d.rank))
                .attr("text-anchor", "middle")
                .attr("dy", 0) // 将标签放在线条上
                .attr("font-size", 14)
                .attr("fill", "#ffffff") // 改为白色
                .text(d.value); // 显示原始值而非排名
        });
    });

    // 4. 绘制y轴标签（排名）
    const yAxisG = g.append("g");
    for (let i = 1; i <= groups.length; i++) {
        yAxisG.append("text")
            .attr("x", -10)
            .attr("y", yScale(i) + 5)
            .attr("text-anchor", "end")
            .attr("font-weight", "bold")
            .attr("font-size", 16)
            .attr("fill", "#ffffff") // 改为白色
            .text(i);
    }

    // 5. 绘制group标签（左侧和右侧）
    // 左侧
    groups.forEach(group => {
        const first = rankData[group][0];
        g.append("text")
            .attr("x", -margin.left + 10)
            .attr("y", yScale(first.rank) + 5)
            .attr("text-anchor", "end")
            .attr("font-weight", "bold")
            .attr("font-size", 18)
            .attr("fill", getColor(group))
            .text(group);
    });
    // 右侧
    groups.forEach(group => {
        const last = rankData[group][rankData[group].length - 1];
        g.append("text")
            .attr("x", innerWidth + 10)
            .attr("y", yScale(last.rank) + 5)
            .attr("text-anchor", "start")
            .attr("font-weight", "bold")
            .attr("font-size", 18)
            .attr("fill", getColor(group))
            .text(group);
    });
    // 优化时间标签避免重叠
    const optimizeTimeLabels = (ticks, format, availableWidth) => {
        if (ticks.length <= 1) return ticks;
        
        // 创建临时文本元素计算宽度
        const tempLabelText = g.append("text")
            .attr("font-size", 14)
            .attr("visibility", "hidden");
        
        // 计算所有标签的宽度
        const calculateLabelWidth = (tick) => {
            tempLabelText.text(format(tick));
            return tempLabelText.node().getComputedTextLength() + 20; // 添加一些边距
        };
        
        const tickWidths = ticks.map(tick => calculateLabelWidth(tick));
        
        // 检查是否会重叠
        let willOverlap = false;
        let positions = ticks.map(t => xScale(t));
        
        for (let i = 0; i < positions.length - 1; i++) {
            const gap = positions[i+1] - positions[i];
            if (gap < (tickWidths[i] + tickWidths[i+1]) / 2) {
                willOverlap = true;
                break;
            }
        }
        
        // 如果不会重叠，显示所有标签
        if (!willOverlap) {
            tempLabelText.remove();
            return ticks;
        }
        
        // 计算可以显示的标签数量
        const averageWidth = tickWidths.reduce((a, b) => a + b, 0) / ticks.length;
        let maxLabels = Math.floor(availableWidth / averageWidth);
        
        // 确保至少显示首尾标签
        if (maxLabels <= 2) {
            tempLabelText.remove();
            return [ticks[0], ticks[ticks.length - 1]];
        }
        
        // 均匀选择标签
        const step = Math.ceil(ticks.length / maxLabels);
        const optimizedTicks = [];
        
        for (let i = 0; i < ticks.length; i += step) {
            optimizedTicks.push(ticks[i]);
        }
        
        // 确保包含最后一个标签
        if (optimizedTicks[optimizedTicks.length - 1] !== ticks[ticks.length - 1]) {
            optimizedTicks.push(ticks[ticks.length - 1]);
        }
        
        tempLabelText.remove();
        return optimizedTicks;
    };
    
    // 优化时间标签
    const optimizedXTicks = optimizeTimeLabels(xTicks, xFormat, innerWidth);

    // 添加顶部时间标签
    optimizedXTicks.forEach(tick => {
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", -40)
            .attr("text-anchor", "middle")
            .attr("font-size", 14)
            .attr("fill", "#fff")
            .text(xFormat(tick));
    });
    

    return svg.node();
} 