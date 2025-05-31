/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Alluvial Diagram",
    "chart_name": "alluvial_diagram_plain_chart_02",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["temporal"]],
    "required_fields_range": [[2, 10], [0, "inf"], [2, 2]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary", "secondary"],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 600,
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
    const xField = dataColumns[0].name; // 分类字段
    const yField = dataColumns[1].name; // 数值字段
    const timeField = dataColumns[2].name; // 时间字段
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 50, bottom: 40, left: 150 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 获取时间点并验证
    const timePoints = [...new Set(chartData.map(d => d[timeField]))].sort();
    if (timePoints.length !== 2) {
        console.error("需要恰好两个时间点");
        return;
    }
    
    // 计算每个时间点和分类的总值
    const categories = [...new Set(chartData.map(d => d[xField]))];
    const valuesByTimeAndCategory = {};
    timePoints.forEach(time => {
        valuesByTimeAndCategory[time] = {};
        categories.forEach(category => {
            const filteredData = chartData.filter(d => d[timeField] === time && d[xField] === category);
            valuesByTimeAndCategory[time][category] = d3.sum(filteredData, d => +d[yField]);
        });
    });
    
    // 验证并过滤有效分类（两个时间点都有数据）
    const validCategories = categories.filter(category => 
        valuesByTimeAndCategory[timePoints[0]][category] > 0 && 
        valuesByTimeAndCategory[timePoints[1]][category] > 0
    );
    
    if (validCategories.length === 0) {
        console.error("没有维度在两个时间点都有数据");
        return;
    }
    
    // 按值排序分类
    const sortedCategoriesByTime = {};
    timePoints.forEach(time => {
        sortedCategoriesByTime[time] = validCategories
            .filter(cat => valuesByTimeAndCategory[time][cat] > 0)
            .sort((a, b) => valuesByTimeAndCategory[time][b] - valuesByTimeAndCategory[time][a]);
    });
    
    // 颜色映射函数
    const getColor = (category) => colors.field?.[category] || colors.other?.primary;
    
    // 准备节点数据
    const nodes = [];
    timePoints.forEach((time, timeIndex) => {
        sortedCategoriesByTime[time].forEach((category, i) => {
            nodes.push({
                id: `${time}_${category}`, name: category, time: time,
                value: valuesByTimeAndCategory[time][category],
                color: getColor(category), x: timeIndex, order: i
            });
        });
    });
    
    // 准备链接数据
    const links = sortedCategoriesByTime[timePoints[0]]
        .filter(category => sortedCategoriesByTime[timePoints[1]].includes(category))
        .map(category => ({
            source: `${timePoints[0]}_${category}`,
            target: `${timePoints[1]}_${category}`,
            value: valuesByTimeAndCategory[timePoints[0]][category],
            targetValue: valuesByTimeAndCategory[timePoints[1]][category],
            color: getColor(category)
        }));
    
    // 计算垂直布局
    const nodeWidth = 20, nodePadding = 10;
    timePoints.forEach((time, timeIndex) => {
        const timeNodes = nodes.filter(n => n.time === time);
        const totalValue = d3.sum(timeNodes, d => d.value);
        let y = 0;
        
        timeNodes.forEach(node => {
            const nodeHeight = (node.value / totalValue) * (chartHeight - (timeNodes.length - 1) * nodePadding);
            node.x0 = timeIndex * (chartWidth - nodeWidth);
            node.x1 = node.x0 + nodeWidth;
            node.y0 = y;
            node.y1 = y + nodeHeight;
            y = node.y1 + nodePadding;
        });
    });
    
    // 添加时间点标签
    timePoints.forEach((time, i) => {
        g.append("text")
            .attr("class", "text")
            .attr("x", i === 0 ? 0 : chartWidth)
            .attr("y", -15)
            .attr("text-anchor", i === 0 ? "start" : "end")
            .attr("font-size", "16px")
            .attr("font-weight", "bold")
            .text(time);
    });
    
    // 创建渐变定义
    const defs = svg.append("defs");
    links.forEach((link, i) => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        const gradientId = `link-gradient-${i}`;
        
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", sourceNode.x1)
            .attr("x2", targetNode.x0);
        
        gradient.append("stop").attr("offset", "0%").attr("stop-color", link.color).attr("stop-opacity", 0.8);
        gradient.append("stop").attr("offset", "100%").attr("stop-color", link.color).attr("stop-opacity", 0.8);
        link.gradientId = gradientId;
    });
    
    // 绘制桑基图流动连接
    g.append("g").attr("class", "other")
        .selectAll("path").data(links).enter().append("path")
        .attr("class", "mark")
        .attr("d", d => {
            const sourceNode = nodes.find(n => n.id === d.source);
            const targetNode = nodes.find(n => n.id === d.target);
            const path = d3.path();
            
            // 创建贝塞尔曲线路径
            const leftTopX = sourceNode.x1 + (targetNode.x0 - sourceNode.x1) / 3;
            path.moveTo(sourceNode.x1, sourceNode.y0);
            path.bezierCurveTo(leftTopX, sourceNode.y0, targetNode.x0 - (targetNode.x0 - sourceNode.x1) / 3, 
                              targetNode.y0, targetNode.x0, targetNode.y0);
            path.lineTo(targetNode.x0, targetNode.y1);
            path.bezierCurveTo(targetNode.x0 - (targetNode.x0 - sourceNode.x1) / 3, targetNode.y1, 
                              leftTopX, sourceNode.y1, sourceNode.x1, sourceNode.y1);
            path.closePath();
            return path.toString();
        })
        .attr("fill", d => `url(#${d.gradientId})`)
        .attr("stroke", "none");
    
    // 添加值标签
    const minHeightToShowLabel = 18;
    links.forEach(link => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        const sourceHeight = sourceNode.y1 - sourceNode.y0;
        const targetHeight = targetNode.y1 - targetNode.y0;
        
        // 左侧值标签
        if (sourceHeight >= minHeightToShowLabel) {
            g.append("text")
                .attr("class", "value")
                .attr("x", sourceNode.x1 + 5)
                .attr("y", (sourceNode.y0 + sourceNode.y1) / 2)
                .attr("text-anchor", "start")
                .attr("dy", "0.35em")
                .attr("font-size", "12px")
                .attr("fill", "#fff")
                .attr("font-weight", "bold")
                .text(`$${link.value.toFixed(1)}B`);
        }
        
        // 右侧值标签
        if (targetHeight >= minHeightToShowLabel) {
            g.append("text")
                .attr("class", "value")
                .attr("x", targetNode.x0 - 5)
                .attr("y", (targetNode.y0 + targetNode.y1) / 2)
                .attr("text-anchor", "end")
                .attr("dy", "0.35em")
                .attr("font-size", "12px")
                .attr("fill", "#fff")
                .attr("font-weight", "bold")
                .text(`$${link.targetValue.toFixed(1)}B`);
        }
    });
    
    // 绘制节点矩形
    g.append("g").attr("class", "other")
        .selectAll("rect").data(nodes).enter().append("rect")
        .attr("class", "mark")
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0).attr("width", d => d.x1 - d.x0)
        .attr("fill", d => d.color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5);
    
    // 添加分类标签（仅左侧）
    nodes.filter(node => node.time === timePoints[0]).forEach(node => {
        g.append("text")
            .attr("class", "label")
            .attr("x", node.x0 - 10)
            .attr("y", (node.y0 + node.y1) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text(node.name);
    });
    
    return svg.node();
} 