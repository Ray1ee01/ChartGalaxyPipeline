/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Waterfall Chart",
    "chart_name": "waterfall_chart_01",
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
    
    // 创建x比例尺
    const x = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, innerWidth])
        .nice();
    
    // 创建y比例尺（用于放置每个子弹图）
    const bulletHeight = Math.min(50, innerHeight / bulletData.length - 10);
    const y = d3.scaleBand()
        .domain(bulletData.map(d => d.title))
        .range([0, innerHeight])
        .padding(0.2);
    
    // 绘制x轴
    const xAxis = d3.axisBottom(x);
    g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis)
        .selectAll("text")
        .style("font-family", typography?.fontFamily || "Arial")
        .style("font-size", typography?.fontSize || "12px");
    
    // 绘制y轴
    const yAxis = d3.axisLeft(y);
    g.append("g")
        .attr("class", "y-axis")
        .call(yAxis)
        .selectAll("text")
        .style("font-family", typography?.fontFamily || "Arial")
        .style("font-size", typography?.fontSize || "12px");
    
    // 为每个类别创建一个组
    const bulletGroups = g.selectAll(".bullet")
        .data(bulletData)
        .enter()
        .append("g")
        .attr("class", "bullet")
        .attr("transform", d => `translate(0, ${y(d.title) + y.bandwidth() / 2 - bulletHeight / 2})`);
    
    // 绘制范围矩形（背景）
    bulletGroups.selectAll("rect.range")
        .data(d => d.ranges.map(range => ({ range, title: d.title })))
        .enter()
        .append("rect")
        .attr("class", "range")
        .attr("width", d => x(d.range))
        .attr("height", bulletHeight)
        .attr("x", 0)
        .attr("fill", (d, i) => {
            // 使用提供的颜色或默认灰度渐变
            const rangeColors = colors.ranges || ["#e0e0e0", "#bdbdbd", "#9e9e9e"];
            return rangeColors[i % rangeColors.length];
        });
    
    // 绘制实际值条
    bulletGroups.append("rect")
        .attr("class", "measure")
        .attr("width", d => x(d.actual))
        .attr("height", bulletHeight / 3)
        .attr("x", 0)
        .attr("y", bulletHeight / 3)
        .attr("fill", colors.actual || "#2196F3");
    
    // 绘制目标线
    bulletGroups.append("line")
        .attr("class", "target")
        .attr("x1", d => x(d.target))
        .attr("x2", d => x(d.target))
        .attr("y1", 0)
        .attr("y2", bulletHeight)
        .attr("stroke", colors.target || "#F44336")
        .attr("stroke-width", 2);
    
    // 添加标题
    svg.append("text")
        .attr("class", "chart-title")
        .attr("x", width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-family", typography?.fontFamily || "Arial")
        .style("font-size", typography?.titleSize || "18px")
        .style("font-weight", "bold")
        .text(chartName || "Bullet Chart");
    
    // 添加x轴标题
    g.append("text")
        .attr("class", "x-axis-title")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + margin.bottom / 2)
        .attr("text-anchor", "middle")
        .style("font-family", typography?.fontFamily || "Arial")
        .style("font-size", typography?.axisLabelSize || "14px")
        .text(dataColumns[1]?.label || yField);
    
    // 添加图例
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - margin.right - 150}, ${margin.top / 2 - 15})`);
    
    // 实际值图例
    legend.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", colors.actual || "#2196F3");
    
    legend.append("text")
        .attr("x", 20)
        .attr("y", 12.5)
        .style("font-family", typography?.fontFamily || "Arial")
        .style("font-size", typography?.legendSize || "12px")
        .text("Actual");
    
    // 目标值图例
    legend.append("line")
        .attr("x1", 70)
        .attr("x2", 85)
        .attr("y1", 7.5)
        .attr("y2", 7.5)
        .attr("stroke", colors.target || "#F44336")
        .attr("stroke-width", 2);
    
    legend.append("text")
        .attr("x", 90)
        .attr("y", 12.5)
        .style("font-family", typography?.fontFamily || "Arial")
        .style("font-size", typography?.legendSize || "12px")
        .text("Target");
    
    return svg.node();
}