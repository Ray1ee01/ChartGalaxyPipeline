/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Treemap",
    "chart_name": "treemap_plain_chart_02",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 20], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 600,
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
    // 获取单位
    const valueUnit = dataColumns[1].unit === "none" ? '' : dataColumns[1].unit;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    
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
    
    // 按类别分组数据
    const groupedData = d3.group(chartData, d => d[categoryField]);
    
    // 将分组数据转换为层次结构
    groupedData.forEach((values, category) => {
        // 计算该类别的总值
        const total = d3.sum(values, d => d[valueField]);
        
        hierarchyData.children.push({
            name: category,
            value: total
        });
    });
    
    // 创建颜色比例尺
    const colorScale = d => {
        if (colors.field && colors.field[d]) {
            return colors.field[d];
        }
        return d3.schemeTableau10[hierarchyData.children.findIndex(item => item.name === d) % 10];
    };
    
    // 计算树图布局
    const root = d3.treemap()
        .size([chartWidth, chartHeight])
        .padding(8)
        .round(true)
        (d3.hierarchy(hierarchyData)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value));
    
    // 为每个叶子节点创建一个单元格
    const leaf = g.selectAll("g")
        .data(root.leaves())
        .join("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);
    
    // 添加矩形
    leaf.append("rect")
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("fill", d => {
            // 获取类别名称
            const category = d.data.name;
            return colorScale(category);
        })
        .attr("fill-opacity", 0.8)
        .attr("stroke", "none");
    
    // 为每个矩形添加工具提示
    const format = d3.format(",d");
    leaf.append("title")
        .text(d => `${d.data.name}: ${format(d.value)}`);
    
    // 创建包含标签和图标的组
    const labelGroup = leaf.append("g")
        .attr("transform", "translate(12, 12)"); // 增加边距
    
    // 添加类别标签 (x label) - 变大并放在左上角，使用白色
    labelGroup.append("text")
        .attr("class", "category-label")
        .attr("x", 0)
        .attr("y", 18)
        .attr("fill", "#ffffff")
        .attr("font-size", "20px") // 字体变得更大
        .attr("font-weight", "bold") // 使用粗体
        .text(d => d.data.name)
        .each(function(d) {
            // 检查文本是否适合矩形（考虑图标宽度）
            const textWidth = this.getComputedTextLength();
            const rectWidth = d.x1 - d.x0 - 48; // 减去图标宽度和更多间距
            
            if (textWidth > rectWidth - 12) {
                // 如果文本太长，截断它
                const text = d3.select(this);
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
        
        // 获取图标
        if (images.field && images.field[categoryName]) {
            const textElement = g.select(".category-label").node();
            const textWidth = textElement ? textElement.getComputedTextLength() : 0;
            
            // 添加白色填充的圆形背景
            g.append("circle")
                .attr("cx", textWidth + 30) // 放在文本右侧，向右移动10px
                .attr("cy", 10) // 向下移动10px
                .attr("r", 22) // 半径增加到22 (17+5)
                .attr("fill", "#ffffff") // 纯白色填充
                .attr("fill-opacity", 0.75) // 75%透明度
                .attr("stroke", "none"); // 移除描边
            
            g.append("image")
                .attr("x", textWidth + 14) // 放在文本右侧，向右移动10px
                .attr("y", -6) // 调整y位置，向下移动10px
                .attr("width", 32)
                .attr("height", 32)
                .attr("xlink:href", images.field[categoryName]);
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
            
            if (textWidth > rectWidth - 24 || (d.y1 - d.y0) < 70) {
                // 如果文本太长或矩形太小，隐藏它
                d3.select(this).style("display", "none");
            }
        });
    
    return svg.node();
} 