/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Radial Stacked Area Chart",
    "chart_name": "radial_stacked_area_plain_chart_01",
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
    const groupAvgs = [...new Set(chartData.map(d => d[groupField]))]
        .map(group => ({
            group,
            avg: d3.mean(chartData.filter(d => d[groupField] === group), d => d[valueField])
        }))
        .sort((a, b) => a.avg - b.avg); // 堆叠图按平均值升序排列，小的在内层
    
    const groups = groupAvgs.map(d => d.group);
    
    // 创建颜色比例尺
    const colorScale = d => {
        if (colors.field && colors.field[d]) {
            return colors.field[d];
        }
        return d3.schemeTableau10[groups.indexOf(d) % 10];
    };
    
    // 创建角度比例尺
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]);
    
    // 为每个类别计算累积数据
    const stackedData = categories.map(category => {
        const categoryData = { category };
        let cumulative = 0;
        
        groups.forEach(group => {
            const point = chartData.find(d => d[categoryField] === category && d[groupField] === group);
            const value = point ? point[valueField] : 0;
            categoryData[`${group}_start`] = cumulative;
            categoryData[`${group}_end`] = cumulative + value;
            cumulative += value;
        });
        
        categoryData.total = cumulative;
        return categoryData;
    });
    
    // 创建半径比例尺 - 基于总最大值
    const maxTotal = d3.max(stackedData, d => d.total);
    const radiusScale = d3.scaleLinear()
        .domain([0, maxTotal])
        .range([0, radius])
        .nice();
    
    // 绘制背景圆环
    const ticks = radiusScale.ticks(5);
    
    // 绘制每个组的堆叠面积
    groups.forEach(group => {
        // 为当前组创建面积数据
        const groupAreaData = stackedData.map(d => ({
            category: d.category,
            innerValue: d[`${group}_start`],
            outerValue: d[`${group}_end`]
        }));
        
        // 创建径向面积生成器
        const areaRadial = d3.areaRadial()
            .angle(d => angleScale(d.category))
            .innerRadius(d => radiusScale(d.innerValue))
            .outerRadius(d => radiusScale(d.outerValue))
            .curve(d3.curveLinearClosed);
        
        // 绘制堆叠面积
        g.append("path")
            .datum(groupAreaData)
            .attr("class", "mark")
            .attr("d", areaRadial)
            .attr("fill", colorScale(group))
            .attr("stroke", colorScale(group))
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 1);
    });
    
    // 绘制径向轴线（在面积上层）
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
    
    // 添加类别标签（在面积上层）
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
    
    // 添加刻度值标签（在面积上层）
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
    
    // 添加径向刻度线（在面积上层）
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
    
    // 添加图例
    const legendGroup = svg.append("g").attr("class", "legend");
    
    // 图例配置
    const legendConfig = {
        itemSpacing: 25,
        rowSpacing: 20,
        iconSize: 16,
        iconTextSpacing: 8,
        maxWidth: chartWidth * 0.8
    };
    
    // 测量文本并计算布局
    const tempText = legendGroup.append("text")
        .attr("visibility", "hidden")
        .attr("font-size", "14px")
        .attr("font-weight", "bold");
    
    const legendItems = groups.map(group => {
        tempText.text(group);
        return {
            label: group,
            color: colorScale(group),
            width: legendConfig.iconSize + legendConfig.iconTextSpacing + tempText.node().getComputedTextLength()
        };
    });
    tempText.remove();
    
    // 自动换行布局
    const rows = [];
    let currentRow = [], currentRowWidth = 0;
    
    legendItems.forEach(item => {
        const needWidth = currentRowWidth + item.width + (currentRow.length > 0 ? legendConfig.itemSpacing : 0);
        if (currentRow.length === 0 || needWidth <= legendConfig.maxWidth) {
            currentRow.push(item);
            currentRowWidth = needWidth;
        } else {
            rows.push(currentRow);
            currentRow = [item];
            currentRowWidth = item.width;
        }
    });
    if (currentRow.length > 0) rows.push(currentRow);
    
    // 计算图例总尺寸和起始位置
    const totalHeight = rows.length * 20 + (rows.length - 1) * legendConfig.rowSpacing;
    const maxRowWidth = Math.max(...rows.map(row => 
        row.reduce((sum, item, i) => sum + item.width + (i > 0 ? legendConfig.itemSpacing : 0), 0)
    ));
    
    const legendStartX = (width - maxRowWidth) / 2;
    const legendStartY = height - margin.bottom + 30;
    
    // 绘制图例
    rows.forEach((row, rowIndex) => {
        const rowWidth = row.reduce((sum, item, i) => sum + item.width + (i > 0 ? legendConfig.itemSpacing : 0), 0);
        let x = legendStartX + (maxRowWidth - rowWidth) / 2; // 居中对齐
        const y = legendStartY + rowIndex * (20 + legendConfig.rowSpacing);
        
        row.forEach(item => {
            const itemGroup = legendGroup.append("g").attr("transform", `translate(${x}, ${y})`);
            
            itemGroup.append("circle")
                .attr("class", "mark")
                .attr("cx", 8).attr("cy", 8).attr("r", 8)
                .attr("fill", item.color);
            
            itemGroup.append("text")
                .attr("class", "label")
                .attr("x", legendConfig.iconSize + legendConfig.iconTextSpacing)
                .attr("y", 8)
                .attr("dominant-baseline", "middle")
                .attr("fill", colors.text_color || "#414141")
                .attr("font-size", "14px")
                .attr("font-weight", "bold")
                .text(item.label);
            
            x += item.width + legendConfig.itemSpacing;
        });
    });
    
    return svg.node();
} 