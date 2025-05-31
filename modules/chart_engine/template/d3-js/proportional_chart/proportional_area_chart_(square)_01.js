/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Square)",
    "chart_name": "proportional_area_chart_square_01",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[4, 10], [0, 100]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary", "secondary"],
    "supported_effects": [],
    "min_height": 600,
    "min_width": 800,
    "background": "styled",
    "background_color": ["#f4f6f8", "#e6e3db"],
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
    const groupField = dataColumns[0].name;
    const percentageField = dataColumns[1].name;
    
    // 过滤数据，只保留0-100范围内的百分比值
    const filteredData = chartData.filter(d => 
        d[percentageField] >= 0 && d[percentageField] <= 100
    );
    
    // 按百分比值降序排序
    filteredData.sort((a, b) => b[percentageField] - a[percentageField]);
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    
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
    
    // 创建背景图案和颜色
    const defs = svg.append("defs");
    
    // 创建网格线图案
    const gridPattern = defs.append("pattern")
        .attr("id", "grid-pattern")
        .attr("width", 10)
        .attr("height", 10)
        .attr("patternUnits", "userSpaceOnUse");
    
    // 添加水平网格线
    gridPattern.append("path")
        .attr("d", "M 0 0 L 10 0")
        .attr("stroke", "#666")
        .attr("stroke-width", 0.2)
        .attr("stroke-opacity", 0.4);
    
    // 添加垂直网格线
    gridPattern.append("path")
        .attr("d", "M 0 0 L 0 10")
        .attr("stroke", "#666")
        .attr("stroke-width", 0.2)
        .attr("stroke-opacity", 0.4);
    
    // 添加背景 - 上方三角形（浅色）
    svg.append("path")
        .attr("d", `M 0,0 L ${width},0 L ${width},${height} L 0,0 Z`)
        .attr("fill", "#f4f6f8")
        .attr("fill-opacity", 1)
        .attr("class", "background")
        .attr("stroke", "none");
    
    // 添加背景 - 下方三角形（深色）
    svg.append("path")
        .attr("d", `M 0,0 L 0,${height} L ${width},${height} L 0,0 Z`)
        .attr("fill", "#e6e3db")
        .attr("fill-opacity", 1)
        .attr("class", "background")
        .attr("stroke", "none");
    
    // 添加网格线覆盖整个SVG
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "url(#grid-pattern)")
        .attr("fill-opacity", 1)
        .attr("class", "background")
        .attr("stroke", "none");
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 计算正方形大小和间距
    const squareCount = filteredData.length;
    const padding = 10; // 正方形之间的间距
    const squareSize = Math.min(
        chartWidth, 
        (chartHeight - (squareCount - 1) * padding) / squareCount
    );
    
    // 获取颜色
    const primaryColor = colors.other && colors.other.primary ? colors.other.primary : "#f39c12"; // 橙色
    const secondaryColor = colors.other && colors.other.secondary ? colors.other.secondary : "#3498db"; // 蓝色
    
    // 为每个组创建正方形
    filteredData.forEach((d, i) => {
        const group = d[groupField];
        const percentage = d[percentageField];
        
        // 计算正方形的y位置（从上到下排列）
        const y = i * (squareSize + padding);
        
        // 计算正方形的x位置
        // 对于从左上角到右下角的45度线，正方形位置需要考虑：
        // 1. 正方形在图表中的位置(margin.left, margin.top + y)
        // 2. 正方形的大小(squareSize)
        // 3. 目标百分比(percentage)
        
        // 计算45度线在正方形y位置处的x坐标
        const diagonalX = (y) * (width / height);
        
        // 计算正方形的左上角x坐标，使得右上角面积比例等于目标百分比
        // 如果percentage = 0%，正方形应该完全在45度线右侧
        // 如果percentage = 100%，正方形应该完全在45度线左侧
        // 如果percentage = 50%，正方形应该被45度线平分
        
        let x = diagonalX + squareSize * (percentage / 50 - 1);
        
        // 创建正方形组
        const squareGroup = g.append("g")
            .attr("transform", `translate(${x}, ${y})`);
        
        // 创建整个正方形作为背景 (secondary color)
        squareGroup.append("path")
            .attr("d", `
                M 0,0
                L ${squareSize},0
                L ${squareSize},${squareSize}
                L 0,${squareSize}
                Z
            `)
            .attr("fill", secondaryColor);
            
        // 创建右上角部分 (primary color)
        squareGroup.append("path")
            .attr("d", () => {
                if (percentage <= 50) {
                    // 如果百分比<=50%，右上角是一个三角形
                    const diagonalX = (1 - percentage / 50) * squareSize;
                    return `
                        M ${diagonalX},0
                        L ${squareSize},0
                        L ${squareSize},${squareSize - diagonalX}
                        Z
                    `;
                } else {
                    // 如果百分比>50%，右上角是一个五边形
                    const diagonalX = (percentage / 50 - 1) * squareSize;
                    return `
                        M 0,0
                        L ${squareSize},0
                        L ${squareSize},${squareSize}
                        L ${squareSize - diagonalX},${squareSize}
                        L 0,${diagonalX}
                        Z
                    `;
                }
            })
            .attr("fill", primaryColor);
        
        // 添加组名标签
        const fontSize = Math.max(14, squareSize / 10);
        const maxWidth = squareSize * 0.9; // 留出一些边距
        
        // 将文本按空格分词
        const words = group.split(/\s+/);
        let lines = [];
        let currentLine = words[0];
        
        // 创建临时text元素测量文本宽度
        const tempText = squareGroup.append("text")
            .attr("visibility", "hidden")
            .style("font-size", `${fontSize}px`);
            
        // 将文本分行
        for(let i = 1; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine + " " + word;
            tempText.text(testLine);
            const width = tempText.node().getComputedTextLength();
            
            if(width > maxWidth) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);
        
        // 移除临时元素
        tempText.remove();
        
        // 添加文本,每行间隔为字体大小的1.2倍
        const lineHeight = fontSize * 1.2;
        const totalHeight = lineHeight * lines.length;
        const startY = squareSize/2 - totalHeight/2 + fontSize/2;
        
        lines.forEach((line, i) => {
            // 先添加描边文本
            squareGroup.append("text")
                .attr("x", squareSize / 2)
                .attr("y", startY + i * lineHeight)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", "none")
                .attr("stroke", percentage > 50 ? primaryColor : secondaryColor)
                .attr("stroke-width", 2)
                .attr("font-weight", "bold")
                .style("font-size", `${fontSize}px`)
                .text(line);
                
            // 再添加填充文本
            squareGroup.append("text")
                .attr("x", squareSize / 2)
                .attr("y", startY + i * lineHeight)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", "white")
                .attr("font-weight", "bold")
                .style("font-size", `${fontSize}px`)
                .text(line);
        });
        
        // 添加百分比标签和延伸线
        const isFirstSquare = i === 0;
        const isLastSquare = i === filteredData.length - 1;
        const extensionLength = 50; // 延伸线的长度
        // 根据 dataColumns[1].name 的长度估算额外延伸长度
        const extraExtension = Math.max(60, (dataColumns[1].name || "").length * 8); // 每个字符大约需要8px宽度
        
        if (isLastSquare) {
            // 最后一个矩形：右边界向上延伸
            squareGroup.append("line")
                .attr("x1", squareSize - 1)
                .attr("y1", 0)
                .attr("x2", squareSize - 1)
                .attr("y2", -extensionLength)
                .attr("stroke", primaryColor)
                .attr("stroke-width", 2);
            
            // 百分比标签绘制在延伸线的左侧
            squareGroup.append("text")
                .attr("x", squareSize - 5)
                .attr("y", -5)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("fill", primaryColor)
                .attr("font-weight", "bold")
                .style("font-size", `${Math.max(14, squareSize / 8)}px`)
                .text(`${Number(percentage).toFixed(1)}%`);
        } else {
            // 其他矩形：上边界向右延伸
            const extensionX = isFirstSquare ? squareSize + extensionLength + extraExtension : squareSize + extensionLength;
            
            squareGroup.append("line")
                .attr("x1", squareSize)
                .attr("y1", 1)
                .attr("x2", extensionX)
                .attr("y2", 1)
                .attr("stroke", primaryColor)
                .attr("stroke-width", 2);
            
            // 百分比标签绘制在延伸线的下方
            squareGroup.append("text")
                .attr("x", squareSize + 5)
                .attr("y", 10)
                .attr("text-anchor", "start")
                .attr("dominant-baseline", "middle")
                .attr("fill", primaryColor)
                .attr("font-weight", "bold")
                .style("font-size", `${Math.max(14, squareSize / 8)}px`)
                .text(`${Number(percentage).toFixed(1)}%`);
            
            // 第一个矩形：额外添加yfield name
            if (isFirstSquare) {
                squareGroup.append("text")
                    .attr("x", squareSize + extensionLength)
                    .attr("y", 10)
                    .attr("text-anchor", "start")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", primaryColor)
                    .attr("font-weight", "bold")
                    .style("font-size", `${Math.max(14, squareSize / 8)}px`)
                    .text(dataColumns[1].name || "Percentage");
            }
        }
        
        // 添加反百分比标签(100-原数值)
        const inversePercentage = 100 - percentage;
        
        if (isFirstSquare) {
            // 第一个矩形：左边界向下延伸
            squareGroup.append("line")
                .attr("x1", 1)
                .attr("y1", squareSize)
                .attr("x2", 1)
                .attr("y2", squareSize + extensionLength)
                .attr("stroke", secondaryColor)
                .attr("stroke-width", 2);
            
            // 反百分比绘制在延伸线右侧
            squareGroup.append("text")
                .attr("x", 5)
                .attr("y", squareSize + 10)
                .attr("text-anchor", "start")
                .attr("dominant-baseline", "middle")
                .attr("fill", secondaryColor)
                .attr("font-weight", "bold")
                .style("font-size", `${Math.max(14, squareSize / 8)}px`)
                .text(`${Number(inversePercentage).toFixed(1)}%`);
        } else {
            // 其他矩形：下边界向左延伸
            squareGroup.append("line")
                .attr("x1", 0)
                .attr("y1", squareSize - 1)
                .attr("x2", -extensionLength)
                .attr("y2", squareSize - 1)
                .attr("stroke", secondaryColor)
                .attr("stroke-width", 2);
            
            // 反百分比标签放在延伸线上方
            squareGroup.append("text")
                .attr("x", -5)
                .attr("y", squareSize - 10)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("fill", secondaryColor)
                .attr("font-weight", "bold")
                .style("font-size", `${Math.max(14, squareSize / 8)}px`)
                .text(`${Number(inversePercentage).toFixed(1)}%`);
        }
    });
    
    return svg.node();
} 