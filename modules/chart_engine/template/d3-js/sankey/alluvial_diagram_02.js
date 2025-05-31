/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Alluvial Diagram",
    "chart_name": "alluvial_diagram_02",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["temporal"]],
    "required_fields_range": [[2, 10], [0, "inf"], [2, 2]],
    "required_fields_icons": ["x"],
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
    const margin = { top: 40, right: 150, bottom: 40, left: 150 };
    
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
    
    // 获取两个时间点
    const timePoints = [...new Set(chartData.map(d => d[timeField]))].sort();
    if (timePoints.length !== 2) {
        console.error("需要恰好两个时间点");
        return;
    }
    
    // 获取所有分类
    const categories = [...new Set(chartData.map(d => d[xField]))];
    
    // 为每个时间点计算每个分类的总值
    const valuesByTimeAndCategory = {};
    timePoints.forEach(time => {
        valuesByTimeAndCategory[time] = {};
        categories.forEach(category => {
            const filteredData = chartData.filter(d => d[timeField] === time && d[xField] === category);
            const total = d3.sum(filteredData, d => +d[yField]);
            valuesByTimeAndCategory[time][category] = total;
        });
    });
    
    // 对每个时间点的分类进行排序（按值从大到小）
    const sortedCategoriesByTime = {};
    timePoints.forEach(time => {
        sortedCategoriesByTime[time] = categories
            .filter(cat => valuesByTimeAndCategory[time][cat] > 0)
            .sort((a, b) => valuesByTimeAndCategory[time][b] - valuesByTimeAndCategory[time][a]);
    });
    
    // 创建颜色映射
    const colorMap = colors.x || {};
    const defaultColors = [
        "#7293EE", "#211CB7", "#7293EE", "#211CB7", "#7293EE", 
        "#211CB7", "#7293EE", "#211CB7", "#7293EE", "#211CB7"
    ];
    
    const getColor = (category, index) => {
        if (colorMap[category]) {
            return colorMap[category];
        }
        return defaultColors[index % defaultColors.length];
    };
    
    // 获取图标
    const getIcon = (category) => {
        if (images && images.field[category]) {
            return images.field[category];
        }
        return null;
    };
    
    // 准备节点数据
    const nodes = [];
    
    // 添加左侧节点（第一个时间点）
    sortedCategoriesByTime[timePoints[0]].forEach((category, i) => {
        nodes.push({
            id: `${timePoints[0]}_${category}`,
            name: category,
            time: timePoints[0],
            value: valuesByTimeAndCategory[timePoints[0]][category],
            color: getColor(category, i),
            icon: getIcon(category),
            x: 0,
            order: i
        });
    });
    
    // 添加右侧节点（第二个时间点）
    sortedCategoriesByTime[timePoints[1]].forEach((category, i) => {
        nodes.push({
            id: `${timePoints[1]}_${category}`,
            name: category,
            time: timePoints[1],
            value: valuesByTimeAndCategory[timePoints[1]][category],
            color: getColor(category, sortedCategoriesByTime[timePoints[0]].indexOf(category) !== -1 
                ? sortedCategoriesByTime[timePoints[0]].indexOf(category) 
                : i),
            icon: getIcon(category),
            x: 1,
            order: i
        });
    });
    
    // 准备链接数据
    const links = [];
    
    sortedCategoriesByTime[timePoints[0]].forEach(category => {
        if (sortedCategoriesByTime[timePoints[1]].includes(category)) {
            links.push({
                source: `${timePoints[0]}_${category}`,
                target: `${timePoints[1]}_${category}`,
                value: valuesByTimeAndCategory[timePoints[0]][category],
                targetValue: valuesByTimeAndCategory[timePoints[1]][category],
                color: getColor(category, sortedCategoriesByTime[timePoints[0]].indexOf(category))
            });
        }
    });
    
    // 计算垂直布局
    const nodeWidth = 20;
    const nodePadding = 10;
    const totalHeight = chartHeight;
    
    // 为每个时间点的节点计算位置
    timePoints.forEach((time, timeIndex) => {
        const timeNodes = nodes.filter(n => n.time === time);
        const totalValue = d3.sum(timeNodes, d => d.value);
        
        let y = 0;
        timeNodes.forEach((node, i) => {
            const nodeHeight = (node.value / totalValue) * (totalHeight - (timeNodes.length - 1) * nodePadding);
            node.x0 = timeIndex * (chartWidth - nodeWidth);
            node.x1 = node.x0 + nodeWidth;
            node.y0 = y;
            node.y1 = y + nodeHeight;
            y = node.y1 + nodePadding;
        });
    });
    
    // 添加时间点标签
    g.append("text")
        .attr("x", 0)
        .attr("y", -15)
        .attr("text-anchor", "start")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(timePoints[0]);
    
    g.append("text")
        .attr("x", chartWidth)
        .attr("y", -15)
        .attr("text-anchor", "end")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(timePoints[1]);
    
    // 添加渐变定义
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
        
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", link.color)
            .attr("stop-opacity", 0.8);
        
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", link.color)
            .attr("stop-opacity", 0.8);
        
        link.gradientId = gradientId;
    });
    
    // 绘制桑基图流动连接
    g.append("g")
        .selectAll("path")
        .data(links)
        .enter()
        .append("path")
        .attr("d", d => {
            const sourceNode = nodes.find(n => n.id === d.source);
            const targetNode = nodes.find(n => n.id === d.target);
            
            const sourceHeight = sourceNode.y1 - sourceNode.y0;
            const targetHeight = targetNode.y1 - targetNode.y0;
            
            // 创建路径
            const path = d3.path();
            
            // 左侧起点（与节点宽度相同）
            path.moveTo(sourceNode.x1, sourceNode.y0);
            
            // 左上角控制点
            const leftTopX = sourceNode.x1 + (targetNode.x0 - sourceNode.x1) / 3;
            path.bezierCurveTo(
                leftTopX, sourceNode.y0,
                targetNode.x0 - (targetNode.x0 - sourceNode.x1) / 3, targetNode.y0,
                targetNode.x0, targetNode.y0
            );
            
            // 右侧
            path.lineTo(targetNode.x0, targetNode.y1);
            
            // 底部控制点
            const leftBottomX = sourceNode.x1 + (targetNode.x0 - sourceNode.x1) / 3;
            path.bezierCurveTo(
                targetNode.x0 - (targetNode.x0 - sourceNode.x1) / 3, targetNode.y1,
                leftBottomX, sourceNode.y1,
                sourceNode.x1, sourceNode.y1
            );
            
            path.closePath();
            return path.toString();
        })
        .attr("fill", d => `url(#${d.gradientId})`)
        .attr("stroke", "none");
    
    // 在流上添加值标签
    links.forEach(link => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        
        // 计算两个标签位置（紧贴桑基图矩形）
        const sourceX = sourceNode.x1 + 5; // 紧贴左侧矩形右边缘
        const targetX = targetNode.x0 - 5; // 紧贴右侧矩形左边缘
        
        // 计算Y位置（考虑到流可能是弯曲的）
        const sourceY = (sourceNode.y0 + sourceNode.y1) / 2 + 
                ((targetNode.y0 + targetNode.y1) / 2 - (sourceNode.y0 + sourceNode.y1) / 2) / 4;
        const targetY = (sourceNode.y0 + sourceNode.y1) / 2 + 
                ((targetNode.y0 + targetNode.y1) / 2 - (sourceNode.y0 + sourceNode.y1) / 2) * 3 / 4;
        
        // 添加左侧值标签（时间点1）
        g.append("text")
            .attr("x", sourceX)
            .attr("y", sourceY)
            .attr("text-anchor", "start") // 左对齐
            .attr("dy", "0.35em")
            .attr("font-size", "12px")
            .attr("fill", "#fff")
            .attr("font-weight", "bold")
            .text(`$${link.value.toFixed(1)}B`);
        
        // 添加右侧值标签（时间点2）
        g.append("text")
            .attr("x", targetX)
            .attr("y", targetY)
            .attr("text-anchor", "end") // 右对齐
            .attr("dy", "0.35em")
            .attr("font-size", "12px")
            .attr("fill", "#fff")
            .attr("font-weight", "bold")
            .text(`$${link.targetValue.toFixed(1)}B`);
    });
    
    // 绘制节点矩形
    g.append("g")
        .selectAll("rect")
        .data(nodes)
        .enter()
        .append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => d.color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5);
    
    // 添加分类标签和图标
    nodes.forEach(node => {
        // 计算节点高度和图标尺寸
        const nodeHeight = node.y1 - node.y0;
        const iconSize = Math.max(32, Math.min(64, nodeHeight / 2));
        const iconRadius = iconSize / 2;
        
        // 只在左侧添加标签，右侧添加图标
        if (node.time === timePoints[0]) {
            // 左侧：只添加分类标签
            const labelX = node.x0 - 10;
            g.append("text")
                .attr("x", labelX)
                .attr("y", (node.y0 + node.y1) / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .attr("font-size", "14px")
                .attr("font-weight", "bold")
                .text(node.name);
        } else {
            // 右侧：只添加图标，紧贴桑基图
            const iconX = node.x1 + iconRadius + 5; // 图标中心距离桑基图右边缘5像素
            const iconY = (node.y0 + node.y1) / 2;
            
            // 添加白色圆形背景
            g.append("circle")
                .attr("cx", iconX)
                .attr("cy", iconY)
                .attr("r", iconRadius + 2) // 比图标稍大一些
                .attr("fill", "#ffffff")
                .attr("stroke", "#eeeeee")
                .attr("stroke-width", 1);
            
            if (node.icon) {
                // 如果有图标，添加图片
                g.append("image")
                    .attr("x", iconX - iconRadius)
                    .attr("y", iconY - iconRadius)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("href", node.icon);
            } else {
                // 如果没有图标，使用彩色圆圈
                g.append("circle")
                    .attr("cx", iconX)
                    .attr("cy", iconY)
                    .attr("r", iconRadius - 2) // 比背景小一些
                    .attr("fill", node.color)
                    .attr("stroke", "none");
            }
        }
    });
    
    return svg.node();
} 