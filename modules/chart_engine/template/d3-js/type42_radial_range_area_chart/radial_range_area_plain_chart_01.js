/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Radial Range Area Chart",
    "chart_name": "radial_range_area_plain_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 7], [0, "inf"], [1, 6]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
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
    const groupField = dataColumns[2].name;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };
    
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
    const radius = Math.min(chartWidth, chartHeight) / 2;
    
    const g = svg.append("g")
        .attr("transform", `translate(${width/2}, ${height/2})`);
    
    // 获取唯一类别和分组
    const categories = [...new Set(chartData.map(d => d[categoryField]))];
    const groupNames = [...new Set(chartData.map(d => d[groupField]))];
    
    // 计算每个组的平均值
    const groupAverages = groupNames.map(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        const avg = d3.mean(groupData, d => d[valueField]);
        return { group, avg };
    });
    
    // 按平均值排序
    groupAverages.sort((a, b) => b.avg - a.avg);
    
    // 选择平均值最高和最低的组
    const upperGroup = groupAverages[0].group;
    const lowerGroup = groupAverages[groupAverages.length - 1].group;
    
    // 获取这两个组的数据
    const upperGroupData = chartData.filter(d => d[groupField] === upperGroup);
    const lowerGroupData = chartData.filter(d => d[groupField] === lowerGroup);
    
    // 创建颜色比例尺
    const colorScale = d => {
        if (colors.field && colors.field[d]) {
            return colors.field[d];
        }
        return d3.schemeTableau10[groupNames.indexOf(d) % 10];
    };
    
    // 创建角度比例尺
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]);
    
    // 创建半径比例尺
    const allValues = chartData.map(d => d[valueField]);
    const minValue = Math.max(0, d3.min(allValues));
    const maxValue = d3.max(allValues);
    const padding = (maxValue - minValue) * 0.1;
    
    const radiusScale = d3.scaleLinear()
        .domain([minValue - padding, maxValue + padding])
        .range([0, radius])
        .nice();
    
    // 绘制背景圆环
    const ticks = radiusScale.ticks(5);
    
    // 绘制径向轴线
    g.selectAll(".axis-line")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radius * Math.cos(angleScale(d) - Math.PI/2))
        .attr("y2", d => radius * Math.sin(angleScale(d) - Math.PI/2))
        .attr("stroke", colors.text_color || "#cccccc")
        .attr("stroke-width", 1);
    
    // 添加类别标签
    g.selectAll(".category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("x", d => (radius + 20) * Math.cos(angleScale(d) - Math.PI/2))
        .attr("y", d => (radius + 20) * Math.sin(angleScale(d) - Math.PI/2))
        .attr("text-anchor", d => {
            const angle = angleScale(d);
            return angle > Math.PI ? "end" : "start";
        })
        .attr("dominant-baseline", "middle")
        .attr("fill", colors.text_color || "#414141")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(d => d);
    
    // 添加刻度值标签
    g.selectAll(".tick-label")
        .data(ticks.filter(d => d > 0))
        .enter()
        .append("text")
        .attr("class", "value")
        .attr("x", 5)
        .attr("y", d => -radiusScale(d) + 5)
        .attr("text-anchor", "start")
        .attr("font-size", "12px")
        .attr("fill", colors.text_color || "#666666")
        .text(d => d3.format(",.0f")(d));
    
    // 添加径向刻度线
    g.selectAll(".tick-line")
        .data(ticks.filter(d => d > 0))
        .enter()
        .append("line")
        .attr("class", "axis")
        .attr("x1", d => -5)
        .attr("y1", d => -radiusScale(d))
        .attr("x2", d => 5)
        .attr("y2", d => -radiusScale(d))
        .attr("stroke", colors.text_color || "#666666")
        .attr("stroke-width", 1);
    
    // 创建合并的数据集用于径向面积图
    const areaData = categories.map(category => {
        const upperPoint = upperGroupData.find(d => d[categoryField] === category);
        const lowerPoint = lowerGroupData.find(d => d[categoryField] === category);
        
        return {
            category: category,
            upperValue: upperPoint ? upperPoint[valueField] : 0,
            lowerValue: lowerPoint ? lowerPoint[valueField] : 0
        };
    });
    
    // 创建径向面积生成器
    const areaRadial = d3.areaRadial()
        .angle(d => angleScale(d.category))
        .innerRadius(d => radiusScale(d.lowerValue))
        .outerRadius(d => radiusScale(d.upperValue))
        .curve(d3.curveLinearClosed);
    
    // 绘制径向范围面积
    g.append("path")
        .datum(areaData)
        .attr("class", "mark")
        .attr("d", areaRadial)
        .attr("fill", colors.available_colors?.[0] || "#4f80ff")
        .attr("fill-opacity", 0.4)
        .attr("stroke", colors.available_colors?.[0] || "#4f80ff")
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.8);
    
    // 绘制上边界线
    const upperLine = d3.lineRadial()
        .angle(d => angleScale(d.category))
        .radius(d => radiusScale(d.upperValue))
        .curve(d3.curveLinearClosed);
    
    g.append("path")
        .datum(areaData)
        .attr("class", "mark")
        .attr("d", upperLine)
        .attr("fill", "none")
        .attr("stroke", colorScale(upperGroup))
        .attr("stroke-width", 3);
    
    // 绘制下边界线
    const lowerLine = d3.lineRadial()
        .angle(d => angleScale(d.category))
        .radius(d => radiusScale(d.lowerValue))
        .curve(d3.curveLinearClosed);
    
    g.append("path")
        .datum(areaData)
        .attr("class", "mark")
        .attr("d", lowerLine)
        .attr("fill", "none")
        .attr("stroke", colorScale(lowerGroup))
        .attr("stroke-width", 3);
    
    // 添加数据点
    areaData.forEach(d => {
        const angle = angleScale(d.category) - Math.PI/2;
        
        // 上边界点
        const upperRadius = radiusScale(d.upperValue);
        g.append("circle")
            .attr("class", "mark")
            .attr("cx", upperRadius * Math.cos(angle))
            .attr("cy", upperRadius * Math.sin(angle))
            .attr("r", 4)
            .attr("fill", colorScale(upperGroup))
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);
        
        // 下边界点
        const lowerRadius = radiusScale(d.lowerValue);
        g.append("circle")
            .attr("class", "mark")
            .attr("cx", lowerRadius * Math.cos(angle))
            .attr("cy", lowerRadius * Math.sin(angle))
            .attr("r", 4)
            .attr("fill", colorScale(lowerGroup))
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);
    });
    
    // 添加图例
    const legendData = [
        { label: upperGroup, color: colorScale(upperGroup) },
        { label: lowerGroup, color: colorScale(lowerGroup) }
    ];
    
    const legendGroup = svg.append("g")
        .attr("class", "legend");
    
    // 创建临时文本元素测量文本宽度
    const tempText = legendGroup.append("text")
        .attr("visibility", "hidden")
        .attr("font-size", "14px")
        .attr("font-weight", "bold");
    
    // 计算每个图例项的宽度
    const legendItemSpacing = 30; // 图例项之间的间距
    const iconTextSpacing = 10; // 圆点和文本之间的间距
    const iconSize = 16; // 圆点直径
    
    const legendItems = legendData.map(item => {
        tempText.text(item.label);
        const textWidth = tempText.node().getComputedTextLength();
        const itemWidth = iconSize + iconTextSpacing + textWidth;
        return {
            ...item,
            textWidth: textWidth,
            itemWidth: itemWidth
        };
    });
    
    // 移除临时文本
    tempText.remove();
    
    // 计算总宽度和起始位置
    const totalWidth = legendItems.reduce((sum, item, i) => {
        return sum + item.itemWidth + (i > 0 ? legendItemSpacing : 0);
    }, 0);
    
    const legendStartX = (width - totalWidth) / 2;
    const legendY = height - margin.bottom + 30;
    
    let currentX = legendStartX;
    legendItems.forEach((item, i) => {
        const legendItem = legendGroup.append("g")
            .attr("transform", `translate(${currentX}, ${legendY})`);
        
        // 添加颜色圆点
        legendItem.append("circle")
            .attr("class", "mark")
            .attr("cx", 8)
            .attr("cy", 8)
            .attr("r", 8)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .attr("fill", item.color);
        
        // 添加标签文本
        legendItem.append("text")
            .attr("class", "label")
            .attr("x", iconSize + iconTextSpacing)
            .attr("y", 8)
            .attr("dominant-baseline", "middle")
            .attr("fill", colors.text_color || "#414141")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text(item.label);
        
        // 更新下一个图例项的x位置
        currentX += item.itemWidth + legendItemSpacing;
    });
    
    return svg.node();
} 