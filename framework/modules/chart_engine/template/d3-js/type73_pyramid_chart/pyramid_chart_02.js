/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Pyramid Chart",
    "chart_name": "pyramid_chart_02",
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
    
    // 按值从小到大排序数据（小的在顶部）
    const sortedData = [...chartData].sort((a, b) => a[valueField] - b[valueField]);
    
    // 计算总和以获取百分比
    const total = d3.sum(sortedData, d => d[valueField]);
    
    // 为每个数据点添加百分比和累积百分比
    let cumulativePercent = 0;
    sortedData.forEach(d => {
        d.percent = (d[valueField] / total) * 100;
        d.cumulativePercentStart = cumulativePercent;
        cumulativePercent += d.percent;
        d.cumulativePercentEnd = cumulativePercent;
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
    
    // 计算金字塔的最大宽度（底部）和高度
    const maxPyramidWidth = chartWidth * 0.6;
    const pyramidHeight = chartHeight * 0.6; // 使用90%的高度，留出上下空间
    
    // 计算面积比例
    // 金字塔总面积
    const totalArea = maxPyramidWidth * pyramidHeight / 2;
    
    // 计算每个部分的高度（基于面积比例）
    let currentHeight = 0;
    const sections = [];
    
    sortedData.forEach((d, i) => {
        // 该部分应占的面积比例
        const areaRatio = d.percent / 100;
        const sectionArea = totalArea * areaRatio;
        
        // 计算该部分的高度
        // 对于梯形，面积 = (上底+下底) * 高 / 2
        // 我们需要求解高度，已知面积和下底（上一部分的上底）
        
        // 首先计算该部分在整个三角形中的相对位置
        const bottomPosition = currentHeight / pyramidHeight;
        // 正三角形：底部宽，顶部窄
        const bottomWidth = maxPyramidWidth * bottomPosition;
        
        // 求解该部分的高度
        // 设高度为h，则上底 = maxPyramidWidth * (currentHeight + h) / pyramidHeight
        // 面积方程：sectionArea = (bottomWidth + topWidth) * h / 2
        
        // 简化后的二次方程：
        // h^2 * (maxPyramidWidth / (2 * pyramidHeight)) + h * bottomWidth - 2 * sectionArea = 0
        
        const a = maxPyramidWidth / (2 * pyramidHeight);
        const b = bottomWidth;
        const c = -2 * sectionArea;
        
        // 使用求根公式
        const h = (-b + Math.sqrt(b*b - 4*a*c)) / (2*a);
        
        // 计算该部分的上底宽度
        const topPosition = (currentHeight + h) / pyramidHeight;
        const topWidth = maxPyramidWidth * topPosition;
        
        sections.push({
            data: d,
            bottomY: currentHeight,
            topY: currentHeight + h,
            bottomWidth: bottomWidth,
            topWidth: topWidth
        });
        
        currentHeight += h;
    });
    
    // 计算垂直居中的偏移量
    const verticalOffset = (chartHeight - pyramidHeight) / 2;

    const y_padding = 5;
    
    // 绘制金字塔的每一层
    sections.forEach((section, i) => {
        const d = section.data;
        
        // 获取颜色
        const color = colors.field && colors.field[d[categoryField]] 
            ? colors.field[d[categoryField]] 
            : d3.schemeCategory10[i % 10];
        
        // 绘制梯形 - 添加垂直偏移
        const points = [
            [chartWidth / 2 - section.topWidth / 2, section.topY + verticalOffset + y_padding * i],
            [chartWidth / 2 + section.topWidth / 2, section.topY + verticalOffset + y_padding * i],
            [chartWidth / 2 + section.bottomWidth / 2, section.bottomY + verticalOffset + y_padding * i],
            [chartWidth / 2 - section.bottomWidth / 2, section.bottomY + verticalOffset + y_padding * i]
        ];
        
        g.append("polygon")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", color);
        
        // 计算标签位置，避免重叠 - 添加垂直偏移
        const labelY = (section.topY + section.bottomY) / 2 + verticalOffset + y_padding * i;
        const labelX = chartWidth / 2 + Math.max(section.topWidth, section.bottomWidth) / 2 + 10;
        
        // 添加标签
        g.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("dominant-baseline", "middle")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text(`${d[categoryField]} ${Math.round(d.percent)}%`);
    });
    
    return svg.node();
} 