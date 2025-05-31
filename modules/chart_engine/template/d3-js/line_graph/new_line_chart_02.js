/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Line Graph",
    "chart_name": "vertical_bar_chart_new_02",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[4, 12], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 800,
    "background": "dark",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes",
    "chart_for": "trend"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors_dark || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    
    // 获取y轴单位
    const yUnit = dataColumns[1].unit || '';
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 20, right: 30, bottom: 80, left: 50 };
    
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

    // 创建x轴比例尺 - 使用band scale来显示柱状图
    const categories = chartData.map(d => d[xField]);
    const xScale = d3.scaleBand()
        .domain(categories)
        .range([0, chartWidth])
        .padding(0.3);
    
    // 获取y值范围
    const yMax = d3.max(chartData, d => d[yField]);
    
    // 最小柱子高度
    const minBarHeight = 50;
    
    // 创建y轴比例尺 - 调整range使小值也有足够高度
    const effectiveHeight = chartHeight - minBarHeight; // 减去最小柱高
    const yScale = d3.scaleLinear()
        .domain([0, yMax * 1.2]) // 为标签留出空间
        .range([effectiveHeight, 0]); // 调整可用高度范围
    
    // 获取柱状图颜色 - 使用colors.other.primary
    const barColor = colors.other.primary;
    
    // 创建渐变定义
    const defs = svg.append("defs");
    
    // 为每个柱子创建唯一的渐变ID
    chartData.forEach((d, i) => {
        const gradientId = `barGradient-${i}`;
        
        // 创建线性渐变
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%") // 顶部
            .attr("x2", "0%")
            .attr("y2", "100%"); // 底部
        
        // 添加渐变停止点
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", barColor)
            .attr("stop-opacity", 0.25); // 顶部透明度
        
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "white")
            .attr("stop-opacity", 1.0); // 底部透明度
    });
    
    // 添加柱状图
    g.selectAll(".bar")
        .data(chartData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d[xField]))
        .attr("y", d => yScale(d[yField]))
        .attr("width", xScale.bandwidth())
        .attr("height", d => {
            // 确保柱子高度至少为minBarHeight
            return chartHeight - yScale(d[yField]);
        })
        .attr("fill", (d, i) => `url(#barGradient-${i})`) // 使用渐变填充
        .attr("rx", 4) // 圆角
        .attr("ry", 4);
    
    // 创建线条生成器，连接各个数据点
    const line = d3.line()
        .x(d => xScale(d[xField]) + xScale.bandwidth()/2)
        .y(d => yScale(d[yField]))
        .curve(d3.curveLinear);
    
    // 添加连接线
    g.append("path")
        .datum(chartData)
        .attr("fill", "none")
        .attr("stroke", barColor)
        .attr("stroke-width", 2)
        .attr("d", line);
    
    // 添加数据点圆圈和标签
    const circleRadius = 8; // 更小的圆圈
    
    // 添加数据点圆圈
    g.selectAll(".data-point")
        .data(chartData)
        .enter()
        .append("circle")
        .attr("class", "data-point")
        .attr("cx", d => xScale(d[xField]) + xScale.bandwidth()/2)
        .attr("cy", d => yScale(d[yField]))
        .attr("r", circleRadius)
        .attr("fill", "white")
        .attr("stroke", barColor)
        .attr("stroke-width", 2);
    
    // 添加数据标签，使用正确的单位
    g.selectAll(".value-text")
        .data(chartData)
        .enter()
        .append("text")
        .attr("x", d => xScale(d[xField]) + xScale.bandwidth()/2)
        .attr("y", d => yScale(d[yField]) - circleRadius - 5) // 放在圆圈上方
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "white")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .text(d => `${formatValue(d[yField])}`);
    
    // 添加图标，使用images对象中的base64数据
    // 放在柱状图底部，宽度与柱状图相同，减少空隙
    g.selectAll(".icon")
        .data(chartData)
        .enter()
        .append("image")
        .attr("x", d => xScale(d[xField])) // 与柱状图左边缘对齐
        .attr("y", chartHeight - xScale.bandwidth()) // 紧贴柱状图底部
        .attr("width", xScale.bandwidth()) // 宽度与柱状图相同
        .attr("height", xScale.bandwidth()) 
        .attr("xlink:href", d => {
            // 从images.field获取对应的图标base64数据
            if (images && images.field && images.field[d[xField]]) {
                return images.field[d[xField]];
            }
            // 如果没有找到对应的图标，返回null
            return null;
        });
    
    // 计算x轴标签是否需要换行和合适的字体大小
    const calculateLabelFormat = () => {
        // 创建临时canvas用于测量文本宽度
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // 初始字体大小
        let fontSize = 12;
        const minFontSize = 8; // 最小字体大小
        const padding = 5; // 标签之间的最小间距
        let needsWordWrap = false;
        
        // 测试字体大小是否会导致标签重叠
        while (fontSize >= minFontSize) {
            context.font = `${fontSize}px sans-serif`;
            
            let isOverlapping = false;
            
            // 计算每个标签的宽度
            const labelWidths = categories.map(category => {
                return context.measureText(category).width;
            });
            
            // 检查相邻标签是否重叠
            for (let i = 0; i < categories.length - 1; i++) {
                const leftLabelWidth = labelWidths[i] / 2;
                const rightLabelWidth = labelWidths[i + 1] / 2;
                
                const leftCenter = xScale(categories[i]) + xScale.bandwidth() / 2;
                const rightCenter = xScale(categories[i + 1]) + xScale.bandwidth() / 2;
                
                const distance = rightCenter - leftCenter;
                
                if (leftLabelWidth + rightLabelWidth + padding > distance) {
                    isOverlapping = true;
                    break;
                }
            }
            
            // 如果不重叠，无需继续减小字体
            if (!isOverlapping) {
                break;
            }
            
            // 减小字体大小
            fontSize -= 1;
        }
        
        // 检查是否需要换行（达到最小字体仍然重叠）
        if (fontSize < minFontSize) {
            fontSize = minFontSize;
            needsWordWrap = true;
        }
        
        return { fontSize, needsWordWrap };
    };
    
    // 将文本分成多行
    const wrapText = (text, bandWidth) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${minFontSize}px sans-serif`;
        
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];
        
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = context.measureText(currentLine + ' ' + word).width;
            
            if (width < bandWidth * 0.8) { // 保留一些边距
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        
        return lines;
    };
    
    // 获取合适的标签格式
    const { fontSize, needsWordWrap } = calculateLabelFormat();
    const minFontSize = 8; // 定义为常量，供wrapText使用
    
    // 添加x轴标签，调整位置使其靠近柱状图底部
    const labelYPosition = chartHeight + 25; // 减少与柱状图底部的间距
    
    if (!needsWordWrap) {
        // 单行标签
        g.selectAll(".x-label")
            .data(chartData)
            .enter()
            .append("text")
            .attr("x", d => xScale(d[xField]) + xScale.bandwidth()/2)
            .attr("y", labelYPosition)
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .style("font-size", `${fontSize}px`)
            .text(d => d[xField]);
    } else {
        // 多行标签
        chartData.forEach((d, i) => {
            const lines = wrapText(d[xField], xScale.bandwidth());
            const x = xScale(d[xField]) + xScale.bandwidth()/2;
            
            // 添加每一行文本
            lines.forEach((line, lineIndex) => {
                g.append("text")
                    .attr("x", x)
                    .attr("y", labelYPosition + lineIndex * (minFontSize + 2)) // 每行之间添加2px的间距
                    .attr("text-anchor", "middle")
                    .attr("fill", "white")
                    .style("font-size", `${minFontSize}px`)
                    .text(line);
            });
        });
    }
    
    // y轴标签 - 使用正确的单位
    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -chartHeight / 2)
        .attr("y", -30)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .style("font-size", "14px")
        .text(yUnit);
    
    return svg.node();
} 