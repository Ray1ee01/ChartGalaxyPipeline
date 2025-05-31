/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Diverging Area Chart",
    "chart_name": "diverging_area_plain_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 50], [0, "inf"], [2, 2]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 600,
    "min_width": 800,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    const parseDate = d => {
        if (d instanceof Date) return d;
        if (typeof d === 'number') return new Date(d, 0, 1);
        if (typeof d === 'string') {
            const [y, m, day] = d.split('-');
            if (day) return new Date(+y, +m - 1, +day);
            if (m) return new Date(+y, +m - 1, 1);
            if (/^\d{4}$/.test(y)) return new Date(+y, 0, 1);
        }
        return new Date();
    };
    
    const createXAxisScaleAndTicks = (data, xField, rangeStart = 0, rangeEnd = 100, padding = 0.05) => {
        const dates = data.map(d => parseDate(d[xField]));
        const [minD, maxD] = d3.extent(dates);
        const span = +maxD - +minD;
        const daySpan = span / 86400000;
        const monthSpan = daySpan / 30;
        const yearSpan = daySpan / 365;
        const pad = span * padding;
    
        const xScale = d3.scaleTime()
            .domain([new Date(+minD - pad), new Date(+maxD + pad)])
            .range([rangeStart, rangeEnd]);
    
        let interval, format;
        if (yearSpan > 35) interval = d3.timeYear.every(10), format = d => d3.timeFormat("%Y")(d);
        else if (yearSpan > 15) interval = d3.timeYear.every(5), format = d => d3.timeFormat("%Y")(d);
        else if (yearSpan > 7) interval = d3.timeYear.every(2), format = d => d3.timeFormat("%Y")(d);
        else if (yearSpan > 2) interval = d3.timeYear.every(1), format = d => d3.timeFormat("%Y")(d);
        else if (yearSpan > 1) interval = d3.timeMonth.every(3), format = d => `${d.getFullYear().toString().slice(-2)}Q${Math.floor(d.getMonth()/3)+1}`;
        else if (monthSpan > 6) interval = d3.timeMonth.every(1), format = d => d3.timeFormat("%m %Y")(d);
        else if (monthSpan > 2) interval = d3.timeWeek.every(1), format = d => d3.timeFormat("%d %m")(d);
        else { const c = Math.max(1, Math.ceil(daySpan / 10)); interval = d3.timeDay.every(c); format = d => d3.timeFormat("%d %m")(d); }
    
        const xTicks = xScale.ticks(interval);
        if (xTicks.length && xTicks[xTicks.length - 1] < maxD) {
            const last = xTicks[xTicks.length - 1];
            const lx = xScale(last), mx = xScale(maxD);
            if (Math.abs(mx - lx) >= 60) xTicks.push(maxD);
            else xTicks[xTicks.length - 1] = maxD;
        }
    
        return { xScale, xTicks, xFormat: format, timeSpan: { days: daySpan, months: monthSpan, years: yearSpan } };
    };
    
    // 获取唯一的组值，限制为两个组
    let groups = [...new Set(chartData.map(d => d[groupField]))];
    if (groups.length > 2) groups = groups.slice(0, 2);
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 20, bottom: 80, left: 20 };
    
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
    
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartData, xField, 0, chartHeight);
    
    // 定义中心区域的宽度
    const centerWidth = 60;
    const halfCenter = centerWidth / 2;
    
    // 创建y轴比例尺（水平方向）- 对称布局
    const yMax = d3.max(chartData, d => d[yField]) * 1.1;
    
    const yScaleLeft = d3.scaleLinear()
        .domain([0, yMax])
        .range([chartWidth/2 - halfCenter, 0]);
    
    const yScaleRight = d3.scaleLinear()
        .domain([0, yMax])
        .range([chartWidth/2 + halfCenter, chartWidth]);
    
    // 添加y轴刻度文本
    const yTicks = d3.ticks(0, yMax, 5);
    yTicks.forEach(tick => {
        [yScaleLeft(tick), yScaleRight(tick)].forEach(x => {
            g.append("text")
                .attr("class", "value")
                .attr("x", x)
                .attr("y", chartHeight + 20)
                .attr("text-anchor", "middle")
                .attr("fill", colors.text_color || "#333")
                .style("font-size", "12px")
                .text(tick);
        });
    });
    
    // 为每个组创建面积图
    groups.forEach((group, i) => {
        const color = colors.field && colors.field[group] ? colors.field[group] : d3.schemeCategory10[i % 10];
        const groupData = chartData.filter(d => d[groupField] === group);
        groupData.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
        
        const yScale = i === 0 ? yScaleLeft : yScaleRight;
        
        // 创建面积生成器
        const area = d3.area()
            .x0(i === 0 ? chartWidth/2 - halfCenter : chartWidth/2 + halfCenter)
            .x1(d => yScale(d[yField]))
            .y(d => xScale(parseDate(d[xField])))
            .curve(d3.curveLinear);
        
        // 绘制面积
        g.append("path")
            .datum(groupData)
            .attr("class", "mark")
            .attr("fill", color)
            .attr("d", area);
    });

    // 添加X轴刻度和标签
    xTicks.forEach(tick => {
        g.append("text")
            .attr("class", "value")
            .attr("x", chartWidth/2)
            .attr("y", xScale(tick))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", colors.text_color || "#333")
            .style("font-size", "12px")
            .text(xFormat(tick));
        
        // 添加左侧短横线
        g.append("line")
            .attr("class", "axis")
            .attr("x1", chartWidth/2 - halfCenter - 10)
            .attr("y1", xScale(tick))
            .attr("x2", chartWidth/2 - halfCenter)
            .attr("y2", xScale(tick))
            .attr("stroke", colors.text_color || "#333")
            .attr("stroke-width", 1);
        
        // 添加右侧短横线
        g.append("line")
            .attr("class", "axis")
            .attr("x1", chartWidth/2 + halfCenter)
            .attr("y1", xScale(tick))
            .attr("x2", chartWidth/2 + halfCenter + 10)
            .attr("y2", xScale(tick))
            .attr("stroke", colors.text_color || "#333")
            .attr("stroke-width", 1);
    });
    
    // 添加y轴标题

    svg.append("text")
        .attr("class", "text")
        .attr("x", width / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("fill", colors.text_color || "#333")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text(yField);
    
    // 添加底部图例 - 动态计算宽度
    const legendGroup = svg.append("g").attr("class", "legend");
    const legendY = height - margin.bottom + 60;
    
    // 测量文本宽度
    const tempText = legendGroup.append("text")
        .attr("visibility", "hidden")
        .style("font-size", "14px")
        .style("font-weight", "bold");
    
    const legendItems = groups.map(group => {
        tempText.text(group);
        return {
            label: group,
            color: colors.field && colors.field[group] ? colors.field[group] : d3.schemeCategory10[groups.indexOf(group) % 10],
            width: 16 + 10 + tempText.node().getComputedTextLength() + 20 // 方块 + 间距 + 文本 + 边距
        };
    });
    tempText.remove();
    
    // 计算总宽度和起始位置
    const totalWidth = legendItems.reduce((sum, item) => sum + item.width, 0);
    const legendStartX = (width - totalWidth) / 2;
    
    let currentX = legendStartX;
    legendItems.forEach(item => {
        const legendItem = legendGroup.append("g")
            .attr("transform", `translate(${currentX}, ${legendY})`);
        
        // 添加方形颜色块
        legendItem.append("rect")
            .attr("class", "mark")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 16)
            .attr("height", 16)
            .attr("fill", item.color);
        
        // 添加标签文本
        legendItem.append("text")
            .attr("class", "label")
            .attr("x", 26)
            .attr("y", 8)
            .attr("dominant-baseline", "middle")
            .attr("fill", colors.text_color || "#333")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .text(item.label);
        
        currentX += item.width;
    });
    
    return svg.node();
} 