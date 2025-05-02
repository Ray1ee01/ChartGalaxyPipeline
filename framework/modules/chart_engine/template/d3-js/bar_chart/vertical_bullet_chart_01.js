/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Bullet Chart",
    "chart_name": "vertical_bullet_chart_01",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 20], [0, 100]],
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
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    const chartId = jsonData.chart_id;
    const chartName = jsonData.chart_name;

    const chartContainer = d3.select(containerSelector);
    const width = chartContainer.node().getBoundingClientRect().width;
    const height = chartContainer.node().getBoundingClientRect().height;
    d3.select(containerSelector).html("");

    const margin = { top: 120, right: 30, bottom: 120, left: 60 };
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // Get field names
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    
    // 设置图表的宽度和高度
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 假设我们有以下数据字段：
    // 类别名称(title)，实际值(actual)，目标值(target)，范围(ranges)
    
    // 对数据进行处理，提取所需字段
    const bulletData = chartData.map(d => ({
        title: d[xField],
        actual: +d[yField],
        target: +d.target || +d.Target || +d[yField] * 1.2,
        ranges: [
            +d.range1 || +d[yField] * 0.6,
            +d.range2 || +d[yField] * 0.8,
            +d.range3 || +d[yField] * 1
        ]
    }));
    
    // 计算最大值来设置比例尺
    const maxValue = d3.max(bulletData, d => Math.max(d3.max(d.ranges), d.actual, d.target)) * 1.1;
    
    // 创建x比例尺（用于放置每个子弹图）
    const bulletWidth = Math.min(50, innerWidth / bulletData.length - 10);
    const x = d3.scaleBand()
        .domain(bulletData.map(d => d.title))
        .range([0, innerWidth])
        .padding(0.2);
    
    // 创建y比例尺
    const y = d3.scaleLinear()
        .domain([0, maxValue])
        .range([innerHeight, 0])
        .nice();
    
    // 绘制x轴
    const xAxis = d3.axisBottom(x);
    g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis)
        .selectAll("text")
        .style("font-family", typography?.fontFamily || "Arial")
        .style("font-size", typography?.fontSize || "12px")
        .style("fill", colors.text_color || "#000000");
    
    // 绘制y轴
    const yAxis = d3.axisLeft(y);
    g.append("g")
        .attr("class", "y-axis")
        .call(yAxis)
        .selectAll("text")
        .style("font-family", typography?.fontFamily || "Arial")
        .style("font-size", typography?.fontSize || "12px")
        .style("fill", colors.text_color || "#000000");
    
    // 为每个类别创建一个组
    const bulletGroups = g.selectAll(".bullet")
        .data(bulletData)
        .enter()
        .append("g")
        .attr("class", "bullet")
        .attr("transform", d => `translate(${x(d.title) + x.bandwidth() / 2 - bulletWidth / 2}, 0)`);
    
    // 绘制范围矩形（背景）
    bulletGroups.selectAll("rect.range")
        .data(d => d.ranges.map(range => ({ range, title: d.title })))
        .enter()
        .append("rect")
        .attr("class", "range")
        .attr("width", bulletWidth)
        .attr("height", innerHeight)
        .attr("y", 0)
        .attr("fill", "none")
        .attr("stroke", "#aaaaaa")
        .attr("stroke-width", 0.5);
    
    // 绘制实际值条
    bulletGroups.append("rect")
        .attr("class", "measure")
        .attr("width", bulletWidth / 3)
        .attr("height", d => innerHeight - y(d.actual))
        .attr("x", bulletWidth / 3)
        .attr("y", d => y(d.actual))
        .attr("fill", colors.other.primary || "#2196F3");
    
    // 绘制目标线
    bulletGroups.append("line")
        .attr("class", "target")
        .attr("x1", 0)
        .attr("x2", bulletWidth)
        .attr("y1", d => y(d.target))
        .attr("y2", d => y(d.target))
        .attr("stroke", "#F44336")
        .attr("stroke-width", 2);

    
    return svg.node();
}