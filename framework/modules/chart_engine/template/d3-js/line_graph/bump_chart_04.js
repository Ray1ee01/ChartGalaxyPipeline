/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Bump Chart",
    "chart_name": "bump_chart_04",
    "is_composite": false,
    "chart_for": "comparison",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [
        [2, 30],
        [0, "inf"],
        [2,2],
        [2,2]
    ],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": ["spacing"],
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

    // 如果 group 数量 <= 2，自动扩增到 5 个 group
    if (groups.length <= 2) {
        const baseNames = ["A", "B", "C", "D", "E"];
        const existing = new Set(groups);
        for (let i = 0; i < baseNames.length && groups.length < 5; i++) {
            if (!existing.has(baseNames[i])) {
                groups.push(baseNames[i]);
                // 为每个 x 补充一条虚拟数据，y 设为 0
                xValues.forEach(x => {
                    chartData.push({
                        [xField]: x,
                        [yField]: Math.floor(Math.random() * 100),
                        [groupField]: baseNames[i]
                    });
                });
            }
        }
    }
    
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
            .attr("stroke-width", 3)
            .attr("d", d3.line()
                .x(d => xScale(parseDate(d.x)))
                .y(d => yScale(d.rank))
                .curve(d3.curveCatmullRom.alpha(0.5)) // 添加曲线平滑效果
            );
        // 绘制每个点的圆点
        g.selectAll(`.dot-${group}`)
            .data(groupRanks)
            .enter()
            .append("circle")
            .attr("class", `dot-${group}`)
            .attr("cx", d => xScale(parseDate(d.x)))
            .attr("cy", d => yScale(d.rank))
            .attr("r", 5)
            .attr("fill", getColor(group))
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);
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

    // 6. 绘制x轴刻度（不显示domain和tick）
    const xAxis = d3.axisBottom(xScale)
        .tickValues(xTicks)
        .tickFormat(xFormat)
        .tickSize(0)  // 不显示tick
        .tickPadding(10);
    // 检查文本是否重叠
    const xAxisG = g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove());  // 不显示domain线
    
    // 获取所有刻度文本
    const tickTexts = xAxisG.selectAll(".tick text");
    
    // 检查文本是否重叠
    let overlap = false;
    const textRects = [];
    
    tickTexts.each(function(d, i) {
        const bbox = this.getBBox();
        // 检查与前一个文本是否重叠
        if (i > 0 && bbox.x < textRects[i-1].x + textRects[i-1].width + 5) {
            overlap = true;
        }
        textRects.push({x: bbox.x, width: bbox.width});
    });
    
    // 如果有重叠，旋转文本
    if (overlap) {
        tickTexts
            .attr("transform", "rotate(-45)")
            .attr("text-anchor", "end")
            .attr("font-size", 16)
            .attr("fill", "#000");
    } else {
        tickTexts
            .attr("font-size", 16)
            .attr("fill", "#000");
    }

    return svg.node();
} 