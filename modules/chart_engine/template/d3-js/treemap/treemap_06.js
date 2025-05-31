/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Treemap",
    "chart_name": "treemap_06_hand",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 20], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
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
        .padding(3)
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
        .attr("rx", 3)
        .attr("ry", 3)
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
    
    // 创建包含标签的组
    const labelGroup = leaf.append("g")
        .attr("transform", "translate(12, 12)"); // 增加边距
    
    // 计算每个矩形的大小，用于自适应标签显示
    leaf.each(function(d) {
        d.rectWidth = d.x1 - d.x0 - 24; // 可用宽度
        d.rectHeight = d.y1 - d.y0 - 24; // 可用高度
    });
    
    // 添加类别标签背景 (x label背景)
    labelGroup.append("rect")
        .attr("class", "category-label-bg")
        .attr("x", -6)
        .attr("y", 0)
        .attr("rx", 3)
        .attr("ry", 3)
        .attr("fill", "#ffffff")
        .attr("fill-opacity", 0.75)
        .attr("width", d => Math.min(d.rectWidth, 200)) // 限制最大宽度
        .attr("height", d => {
            // 根据矩形大小调整背景高度
            const rectSize = Math.min(d.rectWidth, d.rectHeight);
            if (rectSize < 50) return 20; // 非常小的矩形
            if (rectSize < 80) return 24; // 较小的矩形
            return 28; // 正常大小的矩形
        });
    
    // 计算适合的字体大小函数
    function calculateFontSize(d) {
        const rectSize = Math.min(d.rectWidth, d.rectHeight);
        if (rectSize < 40) return 8; // 非常小的矩形
        if (rectSize < 60) return 10; // 较小的矩形
        if (rectSize < 80) return 12; // 中等大小的矩形
        if (rectSize < 100) return 14; // 较大的矩形
        if (rectSize < 150) return 16; // 大矩形
        return 20; // 非常大的矩形
    }
    
    // 添加类别标签 (x label) - 自适应大小并放在左上角，使用黑色
    labelGroup.append("text")
        .attr("class", "category-label")
        .attr("x", 0)
        .attr("y", d => {
            const fontSize = calculateFontSize(d);
            return Math.min(18, fontSize + 4); // 根据字体大小调整y位置
        })
        .attr("fill", "#000000")
        .attr("font-weight", "bold")
        .each(function(d) {
            const fontSize = calculateFontSize(d);
            d3.select(this).attr("font-size", `${fontSize}px`);
            
            // 处理文本自适应显示
            const text = d3.select(this);
            const maxWidth = Math.max(30, d.rectWidth - 12);
            const textContent = d.data.name;
            
            // 设置原始文本进行测量
            text.text(textContent);
            
            // 检查是否需要换行或截断
            if (text.node().getComputedTextLength() > maxWidth) {
                // 尝试分词并换行显示
                const words = textContent.split(/\s+/);
                // 如果只有一个词，则截断显示
                if (words.length <= 1) {
                    let displayText = textContent;
                    // 即使是非常小的矩形也尝试显示尽可能多的文本
                    while (text.node().getComputedTextLength() > maxWidth && displayText.length > 1) {
                        displayText = displayText.slice(0, -1);
                        text.text(displayText + "...");
                    }
                } else {
                    // 多个词尝试换行显示
                    text.text(null); // 清空文本
                    let line = [];
                    let lineNumber = 0;
                    const lineHeight = fontSize * 1.1;
                    let tspan = text.append("tspan")
                        .attr("x", 0)
                        .attr("dy", 0);
                    
                    // 一个一个词添加并检查是否需要换行
                    words.forEach((word, i) => {
                        line.push(word);
                        tspan.text(line.join(" "));
                        
                        if (tspan.node().getComputedTextLength() > maxWidth) {
                            if (line.length === 1) {
                                // 单词太长，需要截断
                                let wordToFit = line[0];
                                tspan.text("");
                                while (wordToFit.length > 1) {
                                    tspan.text(wordToFit);
                                    if (tspan.node().getComputedTextLength() <= maxWidth) break;
                                    wordToFit = wordToFit.slice(0, -1);
                                    tspan.text(wordToFit + "...");
                                }
                            } else {
                                // 回退一个词，换行
                                line.pop();
                                tspan.text(line.join(" "));
                                line = [word];
                                lineNumber++;
                                
                                // 最多显示2行
                                if (lineNumber >= 2) {
                                    tspan.text(tspan.text() + "...");
                                    return;
                                }
                                
                                tspan = text.append("tspan")
                                    .attr("x", 0)
                                    .attr("dy", lineHeight)
                                    .text(word);
                            }
                        }
                    });
                    
                    // 调整背景高度以适应多行文本
                    if (lineNumber > 0) {
                        const bgRect = d3.select(this.parentNode).select(".category-label-bg");
                        bgRect.attr("height", (lineNumber + 1) * lineHeight + 4);
                    }
                }
            }
        });
    
    // 添加值标签背景 (data label背景)
    labelGroup.append("rect")
        .attr("class", "value-label-bg")
        .attr("x", -6)
        .attr("y", function(d) {
            // 计算y位置，考虑类别标签可能是多行的情况
            const categoryLabel = d3.select(this.parentNode).select(".category-label");
            const categoryHeight = categoryLabel.node().getBBox().height;
            return categoryHeight + 6;
        })
        .attr("rx", 3)
        .attr("ry", 3)
        .attr("fill", "#ffffff")
        .attr("fill-opacity", 0.75)
        .each(function(d) {
            // 确定值标签背景的宽度和高度
            const fontSize = Math.max(8, calculateFontSize(d) - 4); // 值标签字体比类别标签小
            const valueText = `${format(d.value)}${valueUnit}`;
            
            // 创建临时文本元素计算宽度
            const parentNode = d3.select(this.parentNode);
            const tempText = parentNode.append("text").text(valueText).attr("font-size", `${fontSize}px`);
            const textWidth = tempText.node().getComputedTextLength();
            tempText.remove();
            
            const labelWidth = Math.min(textWidth + 12, d.rectWidth);
            d3.select(this)
                .attr("width", labelWidth)
                .attr("height", fontSize + 4);
            
            // 如果矩形太小，隐藏值标签
            if (d.rectHeight < 50) {
                d3.select(this).style("display", "none");
            }
        });
    
    // 添加值标签 (data label) - 放在x label下方，使用黑色，添加单位
    labelGroup.append("text")
        .attr("class", "value-label")
        .attr("x", 0)
        .attr("fill", "#000000")
        .each(function(d) {
            // 获取类别标签的高度，用于定位值标签
            const categoryLabel = d3.select(this.parentNode).select(".category-label");
            const categoryHeight = categoryLabel.node().getBBox().height;
            
            // 设置字体大小和y位置
            const fontSize = Math.max(8, calculateFontSize(d) - 4); // 值标签字体比类别标签小
            d3.select(this)
                .attr("font-size", `${fontSize}px`)
                .attr("y", categoryHeight + fontSize + 6)
                .text(`${format(d.value)}${valueUnit}`);
            
            // 如果矩形太小，隐藏值标签
            if (d.rectHeight < 50) {
                d3.select(this).style("display", "none");
                d3.select(this.parentNode).select(".value-label-bg").style("display", "none");
            }
        });

    const roughness = 1;
    const bowing = 2;
    const fillStyle = "hachure";
    const randomize = false;
    const pencilFilter = false;
        
    const svgConverter = new svg2roughjs.Svg2Roughjs(containerSelector);
    svgConverter.pencilFilter = pencilFilter;
    svgConverter.randomize = randomize;
    svgConverter.svg = svg.node();
    svgConverter.roughConfig = {
        bowing,
        roughness,
        fillStyle
    };
    svgConverter.sketch();
    // Remove the first SVG element if it exists
    const firstSvg = document.querySelector(`${containerSelector} svg`);
    if (firstSvg) {
        firstSvg.remove();
    }
    
    return svg.node();
} 