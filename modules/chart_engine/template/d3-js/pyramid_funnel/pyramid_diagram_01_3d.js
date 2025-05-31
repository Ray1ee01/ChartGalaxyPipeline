/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Pyramid Diagram",
    "chart_name": "pyramid_diagram_01_3d",
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
    
    // 按值从大到小排序数据（大的在底部）
    const sortedData = [...chartData].sort((a, b) => b[valueField] - a[valueField]);
    
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
    const margin = { top: 40, right: 120, bottom: 40, left: 160 }; // 增加左侧边距
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 添加渐变和阴影定义
    const defs = svg.append("defs");
    
    // 添加阴影滤镜
    const filter = defs.append("filter")
        .attr("id", "shadow")
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%");
    
    filter.append("feOffset")
        .attr("result", "offOut")
        .attr("in", "SourceGraphic")
        .attr("dx", 5)
        .attr("dy", 5);
    
    filter.append("feGaussianBlur")
        .attr("result", "blurOut")
        .attr("in", "offOut")
        .attr("stdDeviation", 3);
    
    filter.append("feBlend")
        .attr("in", "SourceGraphic")
        .attr("in2", "blurOut")
        .attr("mode", "normal");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 计算金字塔的最大宽度（底部）和高度
    const maxPyramidWidth = chartWidth * 0.6;
    const pyramidHeight = chartHeight * 0.8; // 使用80%的高度，留出上下空间
    
    // 计算面积比例
    // 金字塔总面积
    const totalArea = maxPyramidWidth * pyramidHeight / 2;
    
    // 计算每个部分的高度（基于面积比例）
    let currentHeight = 0;
    const sections = [];
    
    // 计算所有部分的总高度，使高度与数据成正比
    const totalValue = d3.sum(sortedData, d => d[valueField]);
    const totalHeight = pyramidHeight;
    
    sortedData.forEach((d, i) => {
        // 根据数值在总和中的比例计算高度
        const heightRatio = d[valueField] / totalValue;
        const sectionHeight = heightRatio * totalHeight;
        
        // 计算该部分在金字塔中的位置
        const bottomY = currentHeight;
        const topY = currentHeight + sectionHeight;
        
        // 根据当前高度位置计算宽度（线性变化）
        const bottomPosition = bottomY / totalHeight;
        const topPosition = topY / totalHeight;
        
        // 底部宽度大，顶部宽度小
        const bottomWidth = maxPyramidWidth * (1 - bottomPosition);
        const topWidth = maxPyramidWidth * (1 - topPosition);
        
        sections.push({
            data: d,
            bottomY: bottomY,
            topY: topY,
            bottomWidth: bottomWidth,
            topWidth: topWidth
        });
        
        currentHeight += sectionHeight;
    });
    
    // 计算垂直居中的偏移量
    const verticalOffset = (chartHeight - pyramidHeight) / 2;
    
    // 绘制金字塔的左侧标签
    sections.forEach((section, i) => {
        const d = section.data;
        const labelY = (section.topY + section.bottomY) / 2 + verticalOffset;
        
        // 添加左侧的类别标签（x标签）
        g.append("text")
            .attr("x", -20) // 位于图形左侧
            .attr("y", labelY)
            .attr("text-anchor", "end") // 右对齐
            .attr("dominant-baseline", "middle")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("fill", "#333")
            .text(`${d[categoryField]}`);
            
        // 添加连接线
        g.append("line")
            .attr("x1", -15)
            .attr("y1", labelY)
            .attr("x2", chartWidth / 2 - section.bottomWidth / 2 - 5)
            .attr("y2", labelY)
            .attr("stroke", "#999")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");
    });
    
    // 绘制金字塔的每一层
    sections.forEach((section, i) => {
        const d = section.data;
        
        // 获取颜色
        const baseColor = colors.field && colors.field[d[categoryField]] 
            ? colors.field[d[categoryField]] 
            : d3.schemeCategory10[i % 10];
            
        // 为3D效果创建较深的颜色
        const darkerColor = d3.rgb(baseColor).darker(0.8);
        
        // 为每个截面创建渐变
        const gradientId = `gradient-${i}`;
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
            
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", darkerColor.toString());
            
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", baseColor);
        
        // 绘制主梯形 - 添加垂直偏移
        const points = [
            [chartWidth / 2 - section.topWidth / 2, section.topY + verticalOffset],
            [chartWidth / 2 + section.topWidth / 2, section.topY + verticalOffset],
            [chartWidth / 2 + section.bottomWidth / 2, section.bottomY + verticalOffset],
            [chartWidth / 2 - section.bottomWidth / 2, section.bottomY + verticalOffset]
        ];
        
        // 主体部分
        g.append("polygon")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", `url(#${gradientId})`)
            .attr("filter", "url(#shadow)");
            
        // 判断是否为底部三角形（最后一个元素，索引为0）
        const isBottom = (i === 0);
        
        // 右侧面（3D效果）- 对底部三角形特殊处理
        let sidePoints;
        
        if (isBottom) {
            // 底部三角形的侧面不应超出底部
            sidePoints = [
                [chartWidth / 2 + section.topWidth / 2, section.topY + verticalOffset],
                [chartWidth / 2 + section.topWidth / 2 + 15, section.topY + verticalOffset + 10],
                [chartWidth / 2 + section.bottomWidth / 2, section.bottomY + verticalOffset]
            ];
        } else {
            // 其他层的侧面正常绘制
            sidePoints = [
                [chartWidth / 2 + section.topWidth / 2, section.topY + verticalOffset],
                [chartWidth / 2 + section.topWidth / 2 + 15, section.topY + verticalOffset + 10],
                [chartWidth / 2 + section.bottomWidth / 2 + 15, section.bottomY + verticalOffset + 10],
                [chartWidth / 2 + section.bottomWidth / 2, section.bottomY + verticalOffset]
            ];
        }
        
        g.append("polygon")
            .attr("points", sidePoints.map(p => p.join(",")).join(" "))
            .attr("fill", darkerColor.toString());
            
        // 仅为最顶部的部分添加顶面
        if (i === sections.length - 1) {
            // 顶部面（仅最顶层部分）
            const topPoints = [
                [chartWidth / 2 - section.topWidth / 2, section.topY + verticalOffset],
                [chartWidth / 2 + section.topWidth / 2, section.topY + verticalOffset],
                [chartWidth / 2 + section.topWidth / 2 + 15, section.topY + verticalOffset + 10],
                [chartWidth / 2 - section.topWidth / 2 + 15, section.topY + verticalOffset + 10]
            ];
            
            g.append("polygon")
                .attr("points", topPoints.map(p => p.join(",")).join(" "))
                .attr("fill", darkerColor.brighter(0.5).toString());
        }
    });
    
    // 在梯形内部添加数据标签
    sections.forEach((section, i) => {
        const d = section.data;
        const centerY = (section.topY + section.bottomY) / 2 + verticalOffset;
        const centerX = chartWidth / 2;
        
        // 计算该部分占比的百分比文本
        const percentText = `${d[valueField]} (${d.percent.toFixed(1)}%)`;
        
        // 添加数值和百分比标签
        g.append("text")
            .attr("x", centerX)
            .attr("y", centerY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("fill", "white")
            .text(percentText);
    });
    
    // 辅助函数：估算文本宽度
    function getTextWidth(text, fontSize) {
        return text.length * fontSize * 0.6;
    }
    
    return svg.node();
} 