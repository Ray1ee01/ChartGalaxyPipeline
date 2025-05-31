/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Treemap",
    "chart_name": "treemap_04",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 20], [0, "inf"], [2, 6]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "hierarchy": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 600,
    "min_width": 800,
    "background": "light",
    "icon_mark": "overlay",
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
    const groupField = dataColumns[2].name; // 获取group字段
    // 获取单位
    const valueUnit = dataColumns[1].unit === "none" ? '' : dataColumns[1].unit;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 10, right: 10, bottom: 50, left: 10 }; // 增加底部边距为图例留出空间
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 准备层次结构数据
    // 将扁平数据转换为层次结构
    const hierarchyData = {
        name: "root",
        children: []
    };
    
    // 按组别分组数据
    const groupedData = d3.group(chartData, d => d[groupField]);
    
    // 获取所有唯一的组
    const groups = Array.from(groupedData.keys());
    
    // 将分组数据转换为层次结构
    groupedData.forEach((values, group) => {
        // 按类别再次分组
        const categoryGroups = d3.group(values, d => d[categoryField]);
        
        const children = [];
        categoryGroups.forEach((catValues, category) => {
            // 计算该类别的总值
            const total = d3.sum(catValues, d => d[valueField]);
            
            children.push({
                name: category,
                group: group,
                value: total
            });
        });
        
        hierarchyData.children.push({
            name: group,
            children: children
        });
    });
    
    // 创建颜色比例尺
    const colorScale = d => {
        if (colors.field && colors.field[d]) {
            return colors.field[d];
        }
        return d3.schemeTableau10[groups.indexOf(d) % 10];
    };
    
    // 计算树图布局
    const root = d3.treemap()
        .size([chartWidth, chartHeight])
        .padding(5)
        .round(true)
        .tile(d3.treemapSquarify.ratio(1.6)) // 直接在squarify上设置比例
        (d3.hierarchy(hierarchyData)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value));
    
    // 为每个叶子节点创建一个单元格
    const leaf = g.selectAll("g.leaf")
        .data(root.leaves())
        .join("g")
        .attr("class", "leaf")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);
    
    // 添加矩形
    leaf.append("rect")
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("fill", d => {
            // 获取组名称
            const group = d.data.group;
            return colorScale(group);
        })
        .attr("fill-opacity", 0.8)
        .attr("stroke", "none");
    
    // 为每个矩形添加工具提示
    const format = d3.format(",d");
    leaf.append("title")
        .text(d => `${d.data.name} (${d.data.group}): ${format(d.value)}`);
    
    // 创建包含标签和图标的组
    const labelGroup = leaf.append("g")
        .attr("transform", "translate(12, 12)"); // 增加边距
    
    // 添加类别标签 (x label) - 变大并放在左上角，使用白色
    labelGroup.append("text")
        .attr("class", "category-label")
        .attr("x", 0)
        .attr("y", 18)
        .attr("fill", "#ffffff")
        .attr("font-size", "16px") // 减小字体大小
        .attr("font-weight", "bold") // 使用粗体
        .text(d => d.data.name)
        .each(function(d) {
            const rectWidth = d.x1 - d.x0;
            const rectHeight = d.y1 - d.y0;
            const text = d3.select(this);
            const textWidth = this.getComputedTextLength();
            
            // 检查矩形是否过窄，但高度足够
            if (rectWidth < 70 && rectHeight > 120 && textWidth > rectWidth - 12) {
                // 对于窄而高的矩形，使用垂直文本
                text.attr("transform", "rotate(90)")
                    .attr("x", 18) // 现在x成为垂直位置
                    .attr("y", -5); // 现在y成为水平位置（负值向左移动）
                
                // 重新检查文本是否适合高度
                if (textWidth > rectHeight - 20) {
                    // 如果文本太长，截断它
                    let textContent = text.text();
                    while (text.node().getComputedTextLength() > rectHeight - 20 && textContent.length > 0) {
                        textContent = textContent.slice(0, -1);
                        text.text(textContent + "...");
                    }
                }
            } else if (textWidth > rectWidth - 12) {
                // 如果文本太长，截断它
                let textContent = text.text();
                while (text.node().getComputedTextLength() > rectWidth - 12 && textContent.length > 0) {
                    textContent = textContent.slice(0, -1);
                    text.text(textContent + "...");
                }
            }
        });
    
    // 添加图标（在x label右侧）
    labelGroup.each(function(d) {
        const g = d3.select(this);
        const categoryName = d.data.name;
        const rectWidth = d.x1 - d.x0;
        const rectHeight = d.y1 - d.y0;
        const textElement = g.select(".category-label").node();
        const isVertical = textElement && textElement.getAttribute("transform") && textElement.getAttribute("transform").includes("rotate(90)");
        
        // 获取图标，只在矩形足够宽或足够高且文本为垂直时显示
        if (images.field && images.field[categoryName] && 
            ((rectWidth > 100 && !isVertical) || (isVertical && rectHeight > 120))) {
            const textWidth = textElement ? textElement.getComputedTextLength() : 0;
            
            if (isVertical) {
                // 垂直布局时，图标放在下方
                g.append("circle")
                    .attr("cx", 18) // 与垂直文本同样的x值
                    .attr("cy", textWidth + 20) // 文本高度 + 一些间距
                    .attr("r", 16)
                    .attr("fill", "#ffffff")
                    .attr("fill-opacity", 0.75);
                
                g.append("image")
                    .attr("x", 2) // 居中放置
                    .attr("y", textWidth + 4) // 文本高度 + 一些间距
                    .attr("width", 32)
                    .attr("height", 32)
                    .attr("xlink:href", images.field[categoryName]);
            } else {
                // 水平布局
                g.append("circle")
                    .attr("cx", textWidth + 30)
                    .attr("cy", 10)
                    .attr("r", 22)
                    .attr("fill", "#ffffff")
                    .attr("fill-opacity", 0.75)
                    .attr("stroke", "none");
                
                g.append("image")
                    .attr("x", textWidth + 14)
                    .attr("y", -6)
                    .attr("width", 32)
                    .attr("height", 32)
                    .attr("xlink:href", images.field[categoryName]);
            }
        }
    });
    
    // 添加值标签 (data label) - 放在x label下方，使用黑色，添加单位
    labelGroup.append("text")
        .attr("x", 0)
        .attr("y", 42) // 放在x label下方
        .attr("fill", "#000000") // 使用黑色
        .attr("font-size", "16px") // 字体变大
        .text(d => `${format(d.value)}${valueUnit}`) // 添加单位
        .each(function(d) {
            // 检查文本是否适合矩形
            const textWidth = this.getComputedTextLength();
            const rectWidth = d.x1 - d.x0;
            const parentGroup = d3.select(this.parentNode);
            const categoryLabel = parentGroup.select(".category-label").node();
            const isVertical = categoryLabel && categoryLabel.getAttribute("transform") && categoryLabel.getAttribute("transform").includes("rotate(90)");
            
            // 如果类别标签是垂直的，值标签也应该调整
            if (isVertical) {
                d3.select(this)
                    .attr("transform", "rotate(90)")
                    .attr("x", 50) // 在垂直类别标签下方
                    .attr("y", -5); // 相同的水平位置
                
                if (textWidth > d.y1 - d.y0 - 70 || rectWidth < 50) {
                    // 如果文本太长或矩形太窄，隐藏它
                    d3.select(this).style("display", "none");
                }
            } else if (textWidth > rectWidth - 24 || (d.y1 - d.y0) < 70) {
                // 如果文本太长或矩形太小，隐藏它
                d3.select(this).style("display", "none");
            }
        });
    
    // 添加图例
    const legendGroup = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${margin.left}, ${height - margin.bottom + 10})`);
    
    // 计算图例项目的宽度和位置
    const legendItemWidth = chartWidth / groups.length;
    const legendItems = legendGroup.selectAll("g.legend-item")
        .data(groups)
        .join("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(${i * legendItemWidth}, 0)`);
    
    // 为每个图例项添加颜色矩形
    legendItems.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 20)
        .attr("height", 20)
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("fill", d => colorScale(d))
        .attr("fill-opacity", 0.8);
    
    // 为每个图例项添加文本标签
    legendItems.append("text")
        .attr("x", 25)
        .attr("y", 15)
        .attr("fill", "#333333")
        .attr("font-size", "14px")
        .text(d => d)
        .each(function(d) {
            // 检查文本是否适合分配的空间
            const textWidth = this.getComputedTextLength();
            if (textWidth > legendItemWidth - 40) {
                // 如果文本太长，截断它
                const text = d3.select(this);
                let textContent = text.text();
                while (text.node().getComputedTextLength() > legendItemWidth - 40 && textContent.length > 0) {
                    textContent = textContent.slice(0, -1);
                    text.text(textContent + "...");
                }
            }
        });
    
    return svg.node();
} 