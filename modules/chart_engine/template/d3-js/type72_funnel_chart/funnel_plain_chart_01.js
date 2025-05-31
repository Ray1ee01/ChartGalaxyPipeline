/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Funnel Chart",
    "chart_name": "funnel_plain_chart_01",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 10], [0, 100]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 400,
    "background": "light",
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
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const categoryField = dataColumns[0].name;
    const valueField = dataColumns[1].name;
    
    // 按值从大到小排序数据（大的在顶部）
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    
    // 计算总和以获取百分比
    const total = d3.sum(sortedData, d => d[valueField]);
    
    // 为每个数据点添加百分比
    sortedData.forEach(d => {
        d.percent = (d[valueField] / total) * 100;
    });
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 120, bottom: 40, left: 60 };
    
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
    
    // 计算漏斗图的最大宽度和高度
    const maxFunnelWidth = chartWidth * 0.8;
    const funnelHeight = chartHeight * 0.8;
    
    // 计算每个部分的高度（均等分配）
    const sectionHeight = funnelHeight / sortedData.length;
    
    // 创建宽度比例尺
    const widthScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, maxFunnelWidth]);
    
    // 计算每个部分的宽度
    const sectionWidths = sortedData.map(d => widthScale(d.percent));
    
    // 计算垂直居中的偏移量
    const verticalOffset = (chartHeight - funnelHeight) / 2;
    
    // 绘制漏斗图的每一层
    sortedData.forEach((d, i) => {
        // 获取颜色
        const color = colors.field && colors.field[d[categoryField]] 
            ? colors.field[d[categoryField]] 
            : d3.schemeCategory10[i % 10];
        
        // 计算当前层的宽度
        const topWidth = sectionWidths[i];
        
        // 计算下一层的宽度（如果是最后一层，则使用当前宽度的80%）
        const bottomWidth = i < sortedData.length - 1 
            ? sectionWidths[i + 1] 
            : topWidth * 0.8;
        
        // 计算当前层的位置
        const sectionY = i * sectionHeight + verticalOffset;
        
        // 绘制梯形
        const points = [
            [chartWidth / 2 - topWidth / 2, sectionY],
            [chartWidth / 2 + topWidth / 2, sectionY],
            [chartWidth / 2 + bottomWidth / 2, sectionY + sectionHeight],
            [chartWidth / 2 - bottomWidth / 2, sectionY + sectionHeight]
        ];
        
        g.append("polygon")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", color);
        
        // 添加标签
        g.append("text")
            .attr("x", chartWidth / 2 + topWidth / 2 + 10)
            .attr("y", sectionY + sectionHeight / 2)
            .attr("dominant-baseline", "middle")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text(`${d[categoryField]} ${Math.round(d.percent)}%`);
    });
    
    return svg.node();
} 